import { ConflictException } from '@nestjs/common';
import { Referentiel, SystemeComptableSyscohada } from '@prisma/client';
import { ImmobilisationService } from './immobilisation.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { TypeSortie } from './dto/immobilisation.dto';

/**
 * LA SORTIE D'UNE PARTIE DES UNITÉS (ligne immos, n° 65) · l'enchaînement.
 * Ce qui casserait en silence · la fiche des unités née sans sa part du cumul
 * (sa valeur nette au 81 gonflée), le complément recalculé sur sa seule
 * fiche, une sortie refusée qui laisserait le lot réduit.
 */

const LOT = {
  id: 'lot',
  tenantId: 't',
  familleId: 'f',
  designation: 'Chaises',
  quantite: 10,
  statut: 'EN_SERVICE',
  valeurOrigine: 1_000_000,
  valeurResiduelle: 0,
  dureeAmortissementAns: 5,
  modeAmortissement: 'LINEAIRE',
  dateAcquisition: new Date('2025-01-01'),
  dateMiseEnService: new Date('2025-01-01'),
  compteImmobilisationId: 'c244',
  compteAmortissementId: 'c284',
  compteDotationId: 'c681',
  compteImmobilisation: { numero: '24410000' },
  immobilisationPrincipaleId: null,
  degressifFiscal: false,
  amortissementsReevaluation: 0,
  amortissementsDetaches: 0,
  natureAcquisitionAleatoire: null,
  coutFuturDemantelement: null,
  dureeNonLimitee: false,
  ecritureAcquisitionId: null,
  dotations: [{ id: 'd25', exerciceId: 'ex25', montant: 200_000, exercice: { dateDebut: new Date('2025-01-01') } }],
  depreciations: [],
};

function service() {
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYSCOHADA, systemeComptableSyscohada: SystemeComptableSyscohada.NORMAL }) },
    exercice: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ex26', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    immobilisation: {
      findFirst: jest.fn().mockResolvedValue(LOT),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'unites' }),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    amortissementDerogatoire: { count: jest.fn().mockResolvedValue(0) },
    subventionImmobilisation: { count: jest.fn().mockResolvedValue(0) },
    ligneReevaluationBilan: { findFirst: jest.fn().mockResolvedValue(null) },
    contratLocationAcquisition: { findFirst: jest.fn().mockResolvedValue(null) },
    depreciationImmobilisation: { findFirst: jest.fn().mockResolvedValue(null) },
  } as Record<string, unknown>;
  prisma.$transaction = jest.fn((f: (tx: unknown) => unknown) => f(prisma));
  prisma.$queryRaw = jest.fn().mockResolvedValue([]);
  const svc = new ImmobilisationService(prisma as unknown as PrismaService, {} as EcritureService);
  return { svc, prisma: prisma as unknown as Record<string, Record<string, jest.Mock>> };
}

const DTO = {
  type: TypeSortie.MISE_HORS_SERVICE,
  dateSortie: '2026-06-30',
  exerciceId: 'ex26',
  journalId: 'j',
  natureSortie: 'MISE_AU_REBUT' as const,
  referencePieceSortie: 'PV-7',
  datePieceSortie: '2026-06-30',
  quantiteSortie: 3,
};

describe('la sortie de trois chaises sur dix', () => {
  it('la fiche des unités prend 3/10 du brut et du cumul, le lot le reste, et la sortie reçoit 3/10 du complément du lot', async () => {
    const { svc, prisma } = service();
    jest.spyOn(svc, 'simulerSortie').mockResolvedValue({
      simulee: true,
      id: 'lot',
      designation: 'Chaises',
      cumulAvantComplement: 200_000,
      montantComplement: 100_000,
      cumulDepreciation: 0,
      valeurComptableNette: 700_000,
      repriseDepreciation: null,
      passesEcart: [],
    });
    const sortir = jest.spyOn(svc, 'sortir').mockResolvedValue({ id: 'unites' } as never);
    await svc.sortirUnePartie('t', 'u', 'lot', DTO as never);
    // Sous le verrou de la fiche, une mise à jour UNITAIRE (journal d'audit).
    expect((prisma as unknown as { $queryRaw: jest.Mock }).$queryRaw).toHaveBeenCalled();
    expect(prisma.immobilisation.updateMany).not.toHaveBeenCalled();
    expect(prisma.immobilisation.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'lot' },
      data: { quantite: { decrement: 3 }, valeurOrigine: { decrement: 300_000 }, amortissementsDetaches: { increment: 60_000 } },
    });
    expect(prisma.immobilisation.create.mock.calls[0][0].data).toMatchObject({
      quantite: 3,
      fractionDeId: 'lot',
      valeurOrigine: 300_000,
      amortissementAnterieur: 60_000,
      compteImmobilisationId: 'c244',
      dureeAmortissementAns: 5,
    });
    expect(sortir.mock.calls[0][2]).toBe('unites');
    expect(sortir.mock.calls[0][4]).toEqual({ complementImpose: 30_000 });
  });

  it('une sortie des unités refusée défait le fractionnement · le lot retrouve ses dix chaises', async () => {
    const { svc, prisma } = service();
    jest.spyOn(svc, 'simulerSortie').mockResolvedValue({
      simulee: true,
      id: 'lot',
      designation: 'Chaises',
      cumulAvantComplement: 200_000,
      montantComplement: 100_000,
      cumulDepreciation: 0,
      valeurComptableNette: 700_000,
      repriseDepreciation: null,
      passesEcart: [],
    });
    jest.spyOn(svc, 'sortir').mockRejectedValue(new ConflictException('course'));
    await expect(svc.sortirUnePartie('t', 'u', 'lot', DTO as never)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.immobilisation.delete).toHaveBeenCalledWith({ where: { id: 'unites' } });
    expect(prisma.immobilisation.update.mock.calls[1][0].data).toMatchObject({
      quantite: { increment: 3 },
      valeurOrigine: { increment: 300_000 },
      amortissementsDetaches: { decrement: 60_000 },
    });
  });

  it('la dotation de l’exercice déjà passée sur le lot refuse, avant tout geste', async () => {
    const { svc, prisma } = service();
    prisma.immobilisation.findFirst.mockResolvedValue({
      ...LOT,
      dotations: [...LOT.dotations, { id: 'd26', exerciceId: 'ex26', montant: 200_000, exercice: { dateDebut: new Date('2026-01-01') } }],
    });
    await expect(svc.sortirUnePartie('t', 'u', 'lot', DTO as never)).rejects.toThrow(/Annulez la dotation/);
    expect(prisma.immobilisation.update).not.toHaveBeenCalled();
    expect(prisma.immobilisation.create).not.toHaveBeenCalled();
  });
});

/**
 * LIGNE RESTES-L8-IMMOS · LA PARTIELLE JUGE L'ANNUITÉ, COMME L'ENTIÈRE
 * (`anterieurNonDote`) · la seule absence d'une ligne de dotation sur 2025
 * encore ouvert refusait aussi un lot qui n'avait rien à y doter.
 */
describe('la sortie partielle et l’exercice antérieur encore ouvert', () => {
  const ouvert2025 = [{ id: 'ex25', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }];
  const monter = (lot: Record<string, unknown>) => {
    const s = service();
    s.prisma.immobilisation.findFirst.mockResolvedValue({ ...LOT, ecritureAcquisitionId: 'acq', ...lot });
    s.prisma.exercice.findMany.mockResolvedValue(ouvert2025);
    (s.prisma as Record<string, unknown>).ligneEcriture = { findMany: jest.fn().mockResolvedValue([]) };
    return s;
  };

  it('acquis dans OmegaX, 2025 ouvert sans son annuité · refus nommé', async () => {
    const { svc } = monter({ dotations: [] });
    await expect(svc.sortirUnePartie('t', 'u', 'lot', DTO as never)).rejects.toThrow(
      'L’exercice clos le 2025-12-31 n’a pas reçu la dotation du lot · passez-la d’abord',
    );
  });

  it('B3 · amortissement qui ne commence qu’en 2026 · aucune annuité en 2025, aucun refus de ce chef', async () => {
    const { svc } = monter({ dotations: [], dateDebutAmortissement: new Date('2026-01-01') });
    jest.spyOn(svc, 'simulerSortie').mockRejectedValue(new Error('suite du geste'));
    await expect(svc.sortirUnePartie('t', 'u', 'lot', DTO as never)).rejects.toThrow('suite du geste');
  });

  it('B2 · lot repris (sans écriture d’acquisition) sans dotation dans OmegaX · l’antérieur le couvre, aucun refus de ce chef', async () => {
    const { svc } = monter({ dotations: [], ecritureAcquisitionId: null, amortissementAnterieur: 200_000 });
    jest.spyOn(svc, 'simulerSortie').mockRejectedValue(new Error('suite du geste'));
    await expect(svc.sortirUnePartie('t', 'u', 'lot', DTO as never)).rejects.toThrow('suite du geste');
  });
});
