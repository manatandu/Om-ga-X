import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Referentiel } from '@prisma/client';
import { LigneACreer, motifRefusLigneACreer } from './creation-depuis-ecritures';
import { CreationDepuisEcrituresService } from './creation-depuis-ecritures.service';

/**
 * CRÉER LES BIENS À PARTIR DES ÉCRITURES DÉJÀ PASSÉES (ligne sage-l4,
 * fonction n° 68). Ce qui casserait en silence · une fiche qui passerait une
 * SECONDE écriture d'acquisition (brut doublé au bilan, balance bouclée),
 * deux fiches sur la même ligne (le bien amorti deux fois), une fiche née
 * d'une écriture au brouillard (valeur que le journal n'a pas), une fiche
 * qui laisserait l'écriture supprimable depuis le journal (lien dénoué).
 */

const ordinaire: LigneACreer = {
  referentiel: Referentiel.SYSCOHADA,
  statutEcriture: 'VALIDEE',
  exerciceClos: false,
  estANouveau: false,
  debit: 12_000_000,
  numeroCompte: '24510000',
  dejaRattacheeA: null,
  acquisitionDuModule: null,
  autresModules: [],
  lignesDeBien: 1,
  fondsAuCredit: [],
};

describe('la ligne qui fait naître un bien', () => {
  it('une ligne validée, au débit d’un compte de bien, d’une écriture que rien ne tient', () => {
    expect(motifRefusLigneACreer(ordinaire)).toBeNull();
    // Plusieurs biens dans une pièce sans fonds · une fiche par ligne.
    expect(motifRefusLigneACreer({ ...ordinaire, lignesDeBien: 3 })).toBeNull();
    // Le 20 n'est un compte de bien qu'au SYCEBNL (« Immobilisations destinées à la vente […] et usufruit temporaire », semé).
    expect(motifRefusLigneACreer({ ...ordinaire, referentiel: Referentiel.SYCEBNL, numeroCompte: '20110000' })).toBeNull();
  });

  it('une ligne, un bien · la ligne déjà rattachée est nommée', () => {
    expect(motifRefusLigneACreer({ ...ordinaire, dejaRattacheeA: 'Camion A' })).toMatch(/« Camion A » · une ligne, un bien/);
  });

  it('le brouillard se valide d’abord · la fiche ne garde pas une valeur que le journal n’a pas', () => {
    expect(motifRefusLigneACreer({ ...ordinaire, statutEcriture: 'BROUILLARD' })).toMatch(/AUDCIF art\. 22, 2°/);
  });

  it('un exercice clôturé ou un à-nouveau renvoie au bien repris, sans écriture', () => {
    expect(motifRefusLigneACreer({ ...ordinaire, exerciceClos: true })).toMatch(/bien repris/);
    expect(motifRefusLigneACreer({ ...ordinaire, estANouveau: true })).toMatch(/bien repris/);
  });

  it('un crédit, un compte hors des comptes de bien, un en-cours sont refusés', () => {
    expect(motifRefusLigneACreer({ ...ordinaire, debit: 0 })).toMatch(/au débit/);
    expect(motifRefusLigneACreer({ ...ordinaire, numeroCompte: '26110000' })).toMatch(/n'est pas un compte de bien \(21 à 24\)/);
    // Le plan SYSCOHADA semé n'ouvre aucune division 20 · le 20 n'y est pas un compte de bien.
    expect(motifRefusLigneACreer({ ...ordinaire, numeroCompte: '20110000' })).toMatch(/n'est pas un compte de bien/);
    expect(motifRefusLigneACreer({ ...ordinaire, numeroCompte: '24910000' })).toMatch(/compte en cours/);
  });

  it('l’écriture que le module a passée, ou qu’un autre module tient, n’est pas une acquisition à reprendre', () => {
    expect(motifRefusLigneACreer({ ...ordinaire, acquisitionDuModule: 'Camion B' })).toMatch(/module a passée pour « Camion B »/);
    expect(motifRefusLigneACreer({ ...ordinaire, autresModules: ['une immobilisation (mise en service)'] })).toMatch(/mise en service/);
  });

  it('plusieurs biens et un fonds crédité · la reprise du fonds ne se répartirait pas, l’issue est nommée', () => {
    const m = motifRefusLigneACreer({ ...ordinaire, lignesDeBien: 2, fondsAuCredit: ['14100000'] });
    expect(m).toMatch(/porte 2 biens et crédite un fonds \(14100000\)/);
    expect(m).toMatch(/une pièce par bien/);
    // Un seul bien · le fonds se reprend sur lui, comme à la création.
    expect(motifRefusLigneACreer({ ...ordinaire, fondsAuCredit: ['14100000'] })).toBeNull();
  });
});

const ID_LIGNE = '22222222-2222-4222-8222-222222222222';

function ligneLue(options: { statut?: string; exercice?: string; debit?: number; avec4816?: boolean; duModule?: boolean } = {}) {
  return {
    id: ID_LIGNE,
    debit: new Prisma.Decimal(options.debit ?? 12_000_000),
    credit: new Prisma.Decimal(0),
    libelle: 'Camion benne',
    compteId: 'c-2451',
    compte: { numero: '24510000', intitule: 'Matériel automobile' },
    immobilisationAcquise: null,
    ecriture: {
      id: 'ecr-1',
      statut: options.statut ?? 'VALIDEE',
      date: new Date('2026-03-15T00:00:00Z'),
      numeroPiece: 7,
      libelle: 'Facture SOCAM',
      journalId: 'j-ach',
      exerciceId: 'ex-n',
      estGenereeParCloture: false,
      estANouveauProvisoire: false,
      journal: { code: 'ACH' },
      exercice: { statut: options.exercice ?? 'OUVERT', dateFin: new Date('2026-12-31') },
      immobilisationsAcquisition: options.duModule ? [{ designation: 'Camion du module', ligneAcquisitionId: null }] : [],
      lignes: [
        { debit: new Prisma.Decimal(12_000_000), credit: new Prisma.Decimal(0), compte: { numero: '24510000' } },
        { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(12_000_000), compte: { numero: options.avec4816 ? '48160000' : '48120000' } },
      ],
    },
  };
}

function fabrique(
  options: {
    ligne?: ReturnType<typeof ligneLue> | null;
    lignes?: ReturnType<typeof ligneLue>[];
    detenteurs?: string[];
    tenues?: { id: string; libelles: string[] }[];
    referentiel?: Referentiel;
    total?: number;
  } = {},
) {
  const ligne = options.ligne === undefined ? ligneLue() : options.ligne;
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: options.referentiel ?? Referentiel.SYSCOHADA }) },
    ligneEcriture: {
      findMany: jest.fn().mockResolvedValue(options.lignes ?? (ligne ? [ligne] : [])),
      count: jest.fn().mockResolvedValue(options.total ?? (ligne ? 1 : 0)),
      findFirst: jest.fn().mockResolvedValue(ligne),
    },
  };
  const immobilisations = { creer: jest.fn().mockResolvedValue({ id: 'immo-1' }) };
  const ecritures = {
    detenteursDeLEcriture: jest.fn().mockResolvedValue(options.detenteurs ?? []),
    // Le lot répond pour toutes ses écritures · tenu dès qu'une le serait.
    detenteursDesEcritures: jest.fn(async (_t: string, ids: string[]) => (options.tenues ?? []).filter((t) => ids.includes(t.id)).flatMap((t) => t.libelles)),
  };
  const service = new CreationDepuisEcrituresService(prisma as never, immobilisations as never, ecritures as never);
  return { service, prisma, immobilisations, ecritures };
}

describe('la liste des lignes à transformer', () => {
  it('ne lit que ce dossier, ses écritures validées d’un exercice ouvert, hors clôture et hors à-nouveau provisoire', async () => {
    const { service, prisma } = fabrique();
    const r = await service.lignes('t-1');
    const where = prisma.ligneEcriture.findMany.mock.calls[0][0].where;
    expect(where.compte.tenantId).toBe('t-1');
    expect(where.ecriture).toMatchObject({
      tenantId: 't-1',
      statut: 'VALIDEE',
      estGenereeParCloture: false,
      estANouveauProvisoire: false,
      exercice: { statut: 'OUVERT' },
    });
    // Une ligne déjà rattachée n'est plus proposée, ni une opération du module sur un bien.
    expect(where.immobilisationAcquise).toBeNull();
    expect(where.ecriture).toMatchObject({
      immobilisationsAcquisition: { none: { ligneAcquisitionId: null } },
      immobilisationMiseEnService: null,
      reclassementImmobilisation: null,
      reevaluationBilan: null,
      coutEmpruntIncorpore: null,
      mouvementDemantelement: null,
      annulationTraitementOrigine: null,
      annulationTraitementNegatif: null,
    });
    expect(where.debit).toEqual({ gt: 0 });
    expect(where.compte.OR.map((o: { numero: { startsWith: string } }) => o.numero.startsWith)).toEqual(['21', '22', '23', '24']);
    expect(r.lignes).toEqual([
      expect.objectContaining({ ligneId: ID_LIGNE, numeroPiece: 7, journal: 'ACH', date: '2026-03-15', montant: 12_000_000, motifRefus: null }),
    ]);
  });

  it('au SYCEBNL, le 20 est un compte de bien', async () => {
    const { service, prisma } = fabrique({ referentiel: Referentiel.SYCEBNL });
    await service.lignes('t-1');
    const ou = prisma.ligneEcriture.findMany.mock.calls[0][0].where.compte.OR;
    expect(ou.map((o: { numero: { startsWith: string } }) => o.numero.startsWith)).toEqual(['20', '21', '22', '23', '24']);
  });

  it('une liste bornée le dit, avec son total', async () => {
    const { service, prisma } = fabrique({ total: 350 });
    const r = await service.lignes('t-1');
    expect(prisma.ligneEcriture.findMany.mock.calls[0][0].take).toBe(200);
    expect(r).toMatchObject({ total: 350, tronque: true });
  });

  it('une écriture qu’un autre module tient est nommée, et elle seule · la page se lit par moitiés', async () => {
    const lignes = ['e-1', 'e-2', 'e-3', 'e-4', 'e-5'].map((id, i) => {
      const l = ligneLue();
      return { ...l, id: `l-${i}`, ecriture: { ...l.ecriture, id } };
    });
    const { service, ecritures } = fabrique({ lignes, total: 5, tenues: [{ id: 'e-4', libelles: ['une donation'] }] });
    const r = await service.lignes('t-1');
    expect(r.lignes.map((l) => l.motifRefus)).toEqual([null, null, null, expect.stringMatching(/tenue par une donation/), null]);
    // Une page sans écriture tenue coûte une seule lecture.
    const sansTenue = fabrique({ lignes, total: 5 });
    await sansTenue.service.lignes('t-1');
    expect(sansTenue.ecritures.detenteursDesEcritures).toHaveBeenCalledTimes(1);
    expect(ecritures.detenteursDesEcritures.mock.calls.length).toBeLessThan(10);
  });

  it('chaque ligne dit pourquoi elle ne peut pas faire naître un bien', async () => {
    const { service } = fabrique({ ligne: ligneLue({ duModule: true }) });
    const r = await service.lignes('t-1');
    expect(r.lignes[0].motifRefus).toMatch(/module a passée pour « Camion du module »/);
  });
});

describe('la fiche née de la ligne', () => {
  it('passe par la création ordinaire, liée à CETTE écriture, sans écriture nouvelle', async () => {
    const { service, immobilisations } = fabrique();
    await service.creer('t-1', 'u-1', { ligneId: ID_LIGNE, dureeAmortissementAns: 4 });
    expect(immobilisations.creer).toHaveBeenCalledTimes(1);
    const [tenantId, userId, dto, interne] = immobilisations.creer.mock.calls[0];
    expect(tenantId).toBe('t-1');
    expect(userId).toBe('u-1');
    expect(interne).toEqual({ ecritureExistante: { ecritureId: 'ecr-1', ligneId: ID_LIGNE } });
    expect(dto).toMatchObject({
      compteImmobilisationId: 'c-2451',
      valeurOrigine: 12_000_000,
      dateAcquisition: '2026-03-15',
      exerciceId: 'ex-n',
      journalId: 'j-ach',
      dureeAmortissementAns: 4,
      designation: 'Camion benne',
    });
    // Aucune contrepartie · la fiche ne passe rien.
    expect(dto.compteContrepartieId).toBeUndefined();
    // La mise en service n'est jamais posée d'office (AUDCIF art. 45).
    expect(dto.dateMiseEnService).toBeUndefined();
    expect(dto.reserveDePropriete).toBeUndefined();
  });

  it('une dette au 4816 de la pièce dit la réserve de propriété, comme à la création', async () => {
    const { service, immobilisations } = fabrique({ ligne: ligneLue({ avec4816: true }) });
    await service.creer('t-1', 'u-1', { ligneId: ID_LIGNE, dateMiseEnService: '2026-03-20' });
    const dto = immobilisations.creer.mock.calls[0][2];
    expect(dto.reserveDePropriete).toBe(true);
    expect(dto.dateMiseEnService).toBe('2026-03-20');
  });

  it('refuse avant toute écriture · brouillard, exercice clôturé, écriture tenue par un autre module', async () => {
    const brouillard = fabrique({ ligne: ligneLue({ statut: 'BROUILLARD' }) });
    await expect(brouillard.service.creer('t-1', 'u-1', { ligneId: ID_LIGNE })).rejects.toThrow(BadRequestException);
    expect(brouillard.immobilisations.creer).not.toHaveBeenCalled();

    const clos = fabrique({ ligne: ligneLue({ exercice: 'CLOTURE' }) });
    await expect(clos.service.creer('t-1', 'u-1', { ligneId: ID_LIGNE })).rejects.toThrow(/bien repris/);

    const tenue = fabrique({ detenteurs: ['une immobilisation (acquisition)', 'une dotation aux amortissements'] });
    await expect(tenue.service.creer('t-1', 'u-1', { ligneId: ID_LIGNE })).rejects.toThrow(/une dotation aux amortissements/);
    expect(tenue.immobilisations.creer).not.toHaveBeenCalled();
  });

  it('une autre fiche née de la même écriture ne bloque pas la ligne suivante', async () => {
    const { service, immobilisations } = fabrique({ detenteurs: ['une immobilisation (acquisition)'] });
    await service.creer('t-1', 'u-1', { ligneId: ID_LIGNE });
    expect(immobilisations.creer).toHaveBeenCalledTimes(1);
  });

  it('une ligne d’un autre dossier n’existe pas', async () => {
    const { service, prisma } = fabrique({ ligne: null });
    await expect(service.creer('t-1', 'u-1', { ligneId: ID_LIGNE })).rejects.toThrow(NotFoundException);
    expect(prisma.ligneEcriture.findFirst.mock.calls[0][0].where).toEqual({ id: ID_LIGNE, ecriture: { tenantId: 't-1' } });
  });

  it('deux gestes sur la même ligne · l’unicité tranche en 409', async () => {
    const { service, immobilisations } = fabrique();
    immobilisations.creer.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' }));
    await expect(service.creer('t-1', 'u-1', { ligneId: ID_LIGNE })).rejects.toThrow(ConflictException);
  });
});
