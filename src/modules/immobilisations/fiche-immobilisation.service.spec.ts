import { BadRequestException, ConflictException } from '@nestjs/common';
import { FicheImmobilisationService } from './fiche-immobilisation.service';

/**
 * LE CÂBLAGE DE LA MODIFICATION ET DE LA SUPPRESSION D'UNE FICHE (ligne
 * sage-l4, fonction n° 66). Les règles sont éprouvées par
 * `fiche-immobilisation.spec.ts` ; ici, ce que le service FAIT · les
 * contrôles de la création rejoués, l'écriture d'acquisition du brouillard
 * remplacée (jamais une fiche à 15 000 000 sur une écriture à 12 000 000),
 * l'écriture validée jamais touchée.
 */

const ID = '11111111-1111-4111-8111-111111111111';

function fabrique(options: { statut?: 'BROUILLARD' | 'VALIDEE'; repris?: boolean; usages?: Record<string, number>; nee?: boolean } = {}) {
  const statut = options.statut ?? 'BROUILLARD';
  const fiche = {
    id: ID,
    tenantId: 't-1',
    designation: 'Camion',
    numeroInventaire: 'INV-1',
    natureFiscaleCle: null,
    lieuId: null,
    familleId: 'fam-1',
    compteImmobilisationId: 'c-2451',
    compteEnCoursId: null,
    dateAcquisition: new Date('2026-01-01'),
    dateMiseEnService: new Date('2026-01-01'),
    valeurOrigine: 12_000_000,
    valeurResiduelle: 0,
    dureeAmortissementAns: 4,
    modeAmortissement: 'LINEAIRE',
    unitesOeuvrePrevues: null,
    uniteOeuvreLibelle: null,
    amortissementAnterieur: 0,
    statut: 'EN_SERVICE',
    ecritureAcquisitionId: options.repris ? null : 'ecr-acq',
    ligneAcquisitionId: options.nee ? 'l-2451' : null,
    ecritureMiseEnServiceId: null,
    ecritureSortieId: null,
    ecritureProduitCessionId: null,
    ecritureSoldeDetteAleatoireId: null,
    ecritureSortieEcartReevaluationId: null,
    natureAcquisitionAleatoire: null,
    modaliteVentilation: null,
    immobilisationPrincipaleId: null,
    typeComposant: null,
    justificationDecomposition: null,
    composantRemplaceId: null,
    dureeNonLimitee: false,
    justificationDureeNonLimitee: null,
    fondementDureeDixAns: null,
    reserveDePropriete: false,
    criteresFraisDeveloppement: null,
    dateReunionCriteresDeveloppement: null,
    coutFuturDemantelement: null,
    tauxActualisationDemantelementPourcent: null,
  };
  const ecritureAcq = {
    id: 'ecr-acq',
    statut,
    numeroPiece: 4,
    journalId: 'j-od',
    exerciceId: 'ex-n',
    libelle: 'Acquisition · Camion',
    exercice: { statut: 'OUVERT' },
    lignes: [
      { compteId: 'c-2451', debit: 12_000_000, credit: 0, lettre: null, lettrageId: null, rapprochementId: null },
      { compteId: 'c-521', debit: 0, credit: 12_000_000, lettre: null, lettrageId: null, rapprochementId: null },
    ],
  };
  const usages = options.usages ?? {};
  const base: Record<string, any> = {
    immobilisation: {
      findFirst: jest.fn().mockResolvedValue(fiche),
      update: jest.fn().mockResolvedValue(fiche),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    ecriture: {
      findFirst: jest.fn().mockResolvedValue(ecritureAcq),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex-n', statut: 'OUVERT' }) },
    annulationTraitementImmobilisation: {
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  // Les usages du bien se comptent relation par relation, lues dans le schéma ·
  // toute table non déclarée ici compte zéro, sauf celles que le cas nomme.
  const prisma: Record<string, any> = new Proxy(base, {
    get: (cible, cle: string) => {
      if (cle in cible) return cible[cle];
      if (cle.startsWith('$')) return undefined;
      return { count: jest.fn().mockResolvedValue(usages[cle] ?? 0) };
    },
  });
  base.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  const famille = { id: 'fam-1', compteImmobilisationId: 'c-2451', compteAmortissementId: 'c-2845', compteDotationId: 'c-6813', dureeAmortissementAns: 4 };
  const immobilisations = {
    preparerFiche: jest.fn().mockResolvedValue({
      famille,
      dateAcquisition: new Date('2026-01-01'),
      dateMiseEnService: new Date('2026-01-01'),
      compteEnCours: null,
      natureFiscaleCle: null,
      mode: 'LINEAIRE',
      principal: null,
      dureeIncorporel: { dureeNonLimitee: false, justification: null, fondementDureeDixAns: null },
      reserveDePropriete: false,
      criteresRd: null,
      dateReunionCriteres: null,
      numeroContrepartie: '52110000',
    }),
  };
  const ecritures = { creer: jest.fn().mockResolvedValue({ id: 'ecr-nouvelle' }) };
  const service = new FicheImmobilisationService(prisma as never, immobilisations as never, ecritures as never);
  return { service, prisma: base, immobilisations, ecritures };
}

describe('la modification d’une fiche', () => {
  it('les champs libres passent sur une écriture validée, sans toucher au journal', async () => {
    const { service, prisma, ecritures } = fabrique({ statut: 'VALIDEE' });
    await service.modifier('t-1', 'u-1', ID, { designation: ' Camion benne ', numeroInventaire: '' });
    expect(prisma.immobilisation.update).toHaveBeenCalledWith({ where: { id: ID }, data: { designation: 'Camion benne', numeroInventaire: null } });
    expect(ecritures.creer).not.toHaveBeenCalled();
  });

  it('refuse un champ à effet quand l’écriture d’acquisition est validée · rien n’est écrit', async () => {
    const { service, prisma, ecritures } = fabrique({ statut: 'VALIDEE' });
    await expect(service.modifier('t-1', 'u-1', ID, { valeurOrigine: 15_000_000 })).rejects.toThrow(/validée/);
    expect(prisma.immobilisation.update).not.toHaveBeenCalled();
    expect(ecritures.creer).not.toHaveBeenCalled();
  });

  it('refuse tant qu’une dotation a lu la fiche', async () => {
    const { service } = fabrique({ usages: { dotationAmortissement: 1 } });
    await expect(service.modifier('t-1', 'u-1', ID, { valeurOrigine: 15_000_000 })).rejects.toThrow(/dotations \(1\)/);
  });

  it('au brouillard · rejoue les contrôles de la création et REMPLACE l’écriture d’acquisition', async () => {
    const { service, prisma, immobilisations, ecritures } = fabrique();
    await service.modifier('t-1', 'u-1', ID, { valeurOrigine: 15_000_000 });
    // Les contrôles de la création, sur la fiche entière · contrepartie et journal relus sur l'écriture.
    expect(immobilisations.preparerFiche.mock.calls[0][1]).toMatchObject({
      compteImmobilisationId: 'c-2451',
      valeurOrigine: 15_000_000,
      compteContrepartieId: 'c-521',
      journalId: 'j-od',
      exerciceId: 'ex-n',
      dureeAmortissementAns: 4,
    });
    // La nouvelle écriture porte la nouvelle valeur, débit et crédit.
    expect(ecritures.creer.mock.calls[0][2].lignes).toEqual([
      { compteId: 'c-2451', debit: 15_000_000, credit: 0 },
      { compteId: 'c-521', debit: 0, credit: 15_000_000 },
    ]);
    const data = prisma.immobilisation.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ valeurOrigine: 15_000_000, ecritureAcquisition: { connect: { id: 'ecr-nouvelle' } } });
    // L'ancienne ne part que si elle est ENCORE au brouillard.
    expect(prisma.ecriture.deleteMany).toHaveBeenCalledWith({ where: { id: 'ecr-acq', tenantId: 't-1', statut: 'BROUILLARD' } });
    expect(prisma.immobilisation.update.mock.invocationCallOrder[0]).toBeLessThan(prisma.ecriture.deleteMany.mock.invocationCallOrder[0]);
  });

  it('l’ancienne écriture validée entre-temps · 409, et la nouvelle est retirée du brouillard', async () => {
    const { service, prisma } = fabrique();
    prisma.ecriture.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.modifier('t-1', 'u-1', ID, { valeurOrigine: 15_000_000 })).rejects.toThrow(ConflictException);
    expect(prisma.ecriture.deleteMany).toHaveBeenLastCalledWith({ where: { id: 'ecr-nouvelle', tenantId: 't-1', statut: 'BROUILLARD' } });
  });

  it('un bien repris n’a pas d’écriture · la fiche seule change', async () => {
    const { service, prisma, ecritures } = fabrique({ repris: true });
    prisma.exercice.findFirst.mockResolvedValue({ id: 'ex-n' });
    await service.modifier('t-1', 'u-1', ID, { dureeAmortissementAns: 5 });
    expect(ecritures.creer).not.toHaveBeenCalled();
    expect(prisma.immobilisation.update.mock.calls[0][0].data).toMatchObject({ dureeAmortissementAns: 5 });
    expect(prisma.ecriture.deleteMany).not.toHaveBeenCalled();
  });

  it('rien à modifier · refus nommé', async () => {
    const { service } = fabrique();
    await expect(service.modifier('t-1', 'u-1', ID, {})).rejects.toThrow(BadRequestException);
  });
});

describe('la suppression d’une fiche', () => {
  it('au brouillard · la fiche part avec son écriture, filtrée sur le statut', async () => {
    const { service, prisma } = fabrique();
    await expect(service.supprimer('t-1', ID)).resolves.toEqual({ supprime: true });
    expect(prisma.immobilisation.deleteMany).toHaveBeenCalledWith({ where: { id: ID, tenantId: 't-1' } });
    expect(prisma.ecriture.deleteMany).toHaveBeenCalledWith({ where: { id: 'ecr-acq', tenantId: 't-1', statut: 'BROUILLARD' } });
    // Les annulations qui ne retiennent rien partent avec elle.
    expect(prisma.annulationTraitementImmobilisation.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', immobilisationId: ID, ecritureOrigineId: null, ecritureNegatifId: null },
    });
  });

  it('refuse une fiche dont l’écriture est validée, ou qu’un usage retient', async () => {
    await expect(fabrique({ statut: 'VALIDEE' }).service.supprimer('t-1', ID)).rejects.toThrow(/se sort/);
    await expect(fabrique({ usages: { ficheInventaire: 2 } }).service.supprimer('t-1', ID)).rejects.toThrow(/fiches d'inventaire \(2\)/);
  });
});

describe('la fiche née d’une écriture déjà passée (fonction n° 68)', () => {
  it('se retire seule · l’écriture validée du journal n’est jamais touchée', async () => {
    const { service, prisma } = fabrique({ statut: 'VALIDEE', nee: true });
    await expect(service.supprimer('t-1', ID)).resolves.toEqual({ supprime: true });
    expect(prisma.immobilisation.deleteMany).toHaveBeenCalledWith({ where: { id: ID, tenantId: 't-1' } });
    expect(prisma.ecriture.deleteMany).not.toHaveBeenCalled();
    expect(prisma.ligneEcriture.deleteMany).not.toHaveBeenCalled();
  });

  it('refuse un champ à effet en nommant l’origine · rien n’est écrit', async () => {
    const { service, prisma, ecritures } = fabrique({ statut: 'VALIDEE', nee: true });
    await expect(service.modifier('t-1', 'u-1', ID, { dureeAmortissementAns: 5 })).rejects.toThrow(/née d’une écriture déjà passée/);
    expect(prisma.immobilisation.update).not.toHaveBeenCalled();
    expect(ecritures.creer).not.toHaveBeenCalled();
  });

  it('dit son origine à l’écran', async () => {
    const { service } = fabrique({ statut: 'VALIDEE', nee: true });
    const etat = await service.etat('t-1', ID);
    expect(etat.neeDUneEcriturePassee).toBe(true);
    expect(etat.suppression.ouverte).toBe(true);
    expect(etat.modificationAEffet.ouverte).toBe(false);
  });
});
