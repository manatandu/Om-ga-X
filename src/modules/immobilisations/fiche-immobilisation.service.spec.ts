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

function fabrique(
  options: {
    statut?: 'BROUILLARD' | 'VALIDEE';
    repris?: boolean;
    usages?: Record<string, number>;
    nee?: boolean;
    exerciceClosQuiLaPorte?: boolean;
    /** La clôture de cet exercice précède la création de la fiche. */
    clotureAvantLaFiche?: boolean;
    numerotation?: 'CONTINUE_JOURNAL' | 'MENSUELLE';
  } = {},
) {
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
    createdAt: new Date('2026-01-01T09:00:00Z'),
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
    date: new Date('2026-01-01'),
    journal: { numerotation: options.numerotation ?? 'CONTINUE_JOURNAL' },
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
      delete: jest.fn().mockResolvedValue(fiche),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    ecriture: {
      findFirst: jest.fn().mockResolvedValue(ecritureAcq),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    // La doublure honore la requête · la lecture de l'exercice CLÔTURÉ qui a
    // porté le bien (relecture M4) ne rend rien, sauf quand le cas le pose.
    exercice: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { statut?: string } }) =>
        Promise.resolve(where?.statut === 'CLOTURE' ? null : { id: 'ex-n', statut: 'OUVERT' }),
      ),
      findMany: jest.fn().mockImplementation(({ where }: { where: { statut?: string } }) =>
        Promise.resolve(where?.statut === 'CLOTURE' && options.exerciceClosQuiLaPorte ? [{ id: 'ex-clos', dateFin: new Date('2026-12-31') }] : []),
      ),
    },
    // Le journal d'audit · la clôture de l'exercice clos, POSTÉRIEURE à la
    // fiche (créée le 2026-01-01) sauf quand le cas la pose avant ; la
    // doublure honore l'exercice et le filtre sur l'état d'après.
    evenementAudit: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { entite: string; entiteId: { in: string[] }; apres: { equals: string } } }) =>
        Promise.resolve(
          where.entite === 'Exercice' && where.entiteId.in.includes('ex-clos') && where.apres.equals === 'CLOTURE'
            ? [
                {
                  entiteId: 'ex-clos',
                  action: 'MODIFICATION',
                  avant: { statut: 'OUVERT' },
                  horodatage: options.clotureAvantLaFiche ? new Date('2025-12-01T00:00:00Z') : new Date('2027-02-01T00:00:00Z'),
                },
              ]
            : [],
        ),
      ),
      findFirst: jest.fn().mockResolvedValue({ horodatage: new Date('2025-01-01T00:00:00Z') }),
    },
    annulationTraitementImmobilisation: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([{ id: 'ann-1' }]),
      delete: jest.fn().mockResolvedValue({}),
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
  const ecritures = {
    creer: jest.fn().mockResolvedValue({ id: 'ecr-nouvelle' }),
    modifierPieceDuModule: jest.fn().mockResolvedValue(true),
  };
  const service = new FicheImmobilisationService(prisma as never, immobilisations as never, ecritures as never);
  return { service, prisma: base, immobilisations, ecritures };
}

describe('le bien repris qu’un exercice clos a porté (relecture M4)', () => {
  it('ses champs à effet et sa suppression sont refusés, rien n’est écrit', async () => {
    const { service, prisma, ecritures } = fabrique({ repris: true, exerciceClosQuiLaPorte: true });
    await expect(service.modifier('t-1', 'u-1', ID, { amortissementAnterieur: 1_000_000 })).rejects.toThrow(/clos le 2026-12-31 a porté ce bien/);
    await expect(service.supprimer('t-1', ID)).rejects.toThrow(/clos le 2026-12-31 a porté ce bien/);
    expect(prisma.immobilisation.update).not.toHaveBeenCalled();
    expect(prisma.immobilisation.deleteMany).not.toHaveBeenCalled();
    expect(ecritures.creer).not.toHaveBeenCalled();
    // La lecture vise les exercices clos qui finissent au plus tôt à l'acquisition.
    expect(prisma.exercice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', statut: 'CLOTURE', dateFin: { gte: new Date('2026-01-01') } } }),
    );
  });

  it('une fiche créée APRÈS la clôture n’a été lue par aucun état arrêté · elle se corrige et se retire', async () => {
    const { service, prisma } = fabrique({ repris: true, exerciceClosQuiLaPorte: true, clotureAvantLaFiche: true });
    await expect(service.modifier('t-1', 'u-1', ID, { amortissementAnterieur: 1_000_000 })).resolves.toBeDefined();
    expect(prisma.immobilisation.update).toHaveBeenCalled();
    await expect(service.supprimer('t-1', ID)).resolves.toEqual({ supprime: true });
  });

  it('sans exercice clos qui le porte, la désignation comme la valeur restent modifiables', async () => {
    const { service } = fabrique({ repris: true });
    await expect(service.modifier('t-1', 'u-1', ID, { designation: 'Camion repris' })).resolves.toBeDefined();
  });
});

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

  it('au brouillard · rejoue les contrôles de la création et RETOUCHE la pièce d’acquisition en place, son numéro gardé', async () => {
    const { service, prisma, immobilisations, ecritures } = fabrique();
    await service.modifier('t-1', 'u-1', ID, { valeurOrigine: 15_000_000 });
    expect(immobilisations.preparerFiche.mock.calls[0][1]).toMatchObject({ valeurOrigine: 15_000_000, compteContrepartieId: 'c-521', exerciceId: 'ex-n' });
    // Relecture de la ligne · aucune pièce neuve, aucun trou dans la séquence du journal.
    expect(ecritures.creer).not.toHaveBeenCalled();
    expect(ecritures.modifierPieceDuModule).toHaveBeenCalledWith(expect.anything(), 't-1', 'ecr-acq', {
      date: '2026-01-01',
      libelle: 'Acquisition · Camion',
      lignes: [
        { compteId: 'c-2451', debit: 15_000_000, credit: 0 },
        { compteId: 'c-521', debit: 0, credit: 15_000_000 },
      ],
    });
    expect(prisma.immobilisation.update.mock.calls[0][0].data).toMatchObject({ valeurOrigine: 15_000_000 });
    expect(prisma.immobilisation.update.mock.calls[0][0].data.ecritureAcquisition).toBeUndefined();
    expect(prisma.ecriture.deleteMany).not.toHaveBeenCalled();
  });

  it('changée de mois dans un journal numéroté par mois · la pièce se REMPLACE, contrôles de la création rejoués', async () => {
    const { service, prisma, immobilisations, ecritures } = fabrique({ numerotation: 'MENSUELLE' });
    await service.modifier('t-1', 'u-1', ID, { valeurOrigine: 15_000_000, dateAcquisition: '2026-02-10' });
    expect(ecritures.modifierPieceDuModule).not.toHaveBeenCalled();
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
    const { service, prisma } = fabrique({ numerotation: 'MENSUELLE' });
    prisma.ecriture.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.modifier('t-1', 'u-1', ID, { valeurOrigine: 15_000_000, dateAcquisition: '2026-02-10' })).rejects.toThrow(ConflictException);
    expect(prisma.ecriture.deleteMany).toHaveBeenLastCalledWith({ where: { id: 'ecr-nouvelle', tenantId: 't-1', statut: 'BROUILLARD' } });
  });

  it('un bien repris n’a pas d’écriture · la fiche seule change', async () => {
    const { service, prisma, ecritures } = fabrique({ repris: true });
    prisma.exercice.findFirst.mockImplementation(({ where }: { where: { statut?: string } }) =>
      Promise.resolve(where?.statut === 'CLOTURE' ? null : { id: 'ex-n' }),
    );
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
    // Une suppression UNITAIRE · le journal d'audit en garde la pré-image.
    expect(prisma.immobilisation.delete).toHaveBeenCalledWith({ where: { id: ID } });
    expect(prisma.immobilisation.deleteMany).not.toHaveBeenCalled();
    expect(prisma.ecriture.deleteMany).toHaveBeenCalledWith({ where: { id: 'ecr-acq', tenantId: 't-1', statut: 'BROUILLARD' } });
    // Les annulations qui ne retiennent rien partent avec elle, une à une.
    expect(prisma.annulationTraitementImmobilisation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', immobilisationId: ID, ecritureOrigineId: null, ecritureNegatifId: null } }),
    );
    expect(prisma.annulationTraitementImmobilisation.delete).toHaveBeenCalledWith({ where: { id: 'ann-1' } });
    expect(prisma.annulationTraitementImmobilisation.deleteMany).not.toHaveBeenCalled();
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
    expect(prisma.immobilisation.delete).toHaveBeenCalledWith({ where: { id: ID } });
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
