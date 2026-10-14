import { BadRequestException, ConflictException } from '@nestjs/common';
import { AnnulationTraitementService } from './annulation-traitement.service';

/**
 * LE CÂBLAGE DE L'ANNULATION (ligne sage-l4, fonction n° 67) · la règle est
 * éprouvée par `annulation-traitement.spec.ts` ; ici, ce que le service FAIT
 * de l'écriture et de l'enregistrement. Ce qui casserait en silence · une
 * écriture validée supprimée (AUDCIF art. 22, 2°), une dotation retirée sans
 * que son écriture parte, une annulation passée malgré la dotation suivante.
 */

const EX_N = { id: 'ex-n', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' };
const EX_N1 = { id: 'ex-n1', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31'), statut: 'OUVERT' };

function fabrique(options: { statut: 'BROUILLARD' | 'VALIDEE'; dotationsSuivantes?: boolean; exerciceClos?: boolean }) {
  const exN = { ...EX_N, statut: options.exerciceClos ? 'CLOTURE' : 'OUVERT' };
  const dotation = {
    id: '11111111-1111-4111-8111-111111111111',
    immobilisationId: 'bien-1',
    exerciceId: exN.id,
    montant: 1_000_000,
    ecritureId: 'ecr-1',
    createdAt: new Date('2026-12-31T10:00:00Z'),
    exercice: exN,
    immobilisation: { designation: 'Camion' },
  };
  const dotations = [
    { ...dotation, exercice: { dateFin: exN.dateFin } },
    ...(options.dotationsSuivantes ? [{ id: 'dot-n1', immobilisationId: 'bien-1', createdAt: new Date('2027-12-31T10:00:00Z'), exercice: { dateFin: EX_N1.dateFin } }] : []),
  ];
  const vide = () => jest.fn().mockResolvedValue([]);
  const prisma: Record<string, any> = {
    immobilisation: {
      findFirst: jest.fn().mockResolvedValue({ id: 'bien-1' }),
      findMany: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(where?.immobilisationPrincipaleId ? [] : [{ id: 'bien-1', designation: 'Camion', statut: 'EN_SERVICE', dateSortie: null }]),
      ),
    },
    dotationAmortissement: {
      findFirst: jest.fn().mockResolvedValue(dotation),
      findMany: jest.fn().mockResolvedValue(dotations),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    depreciationImmobilisation: { findMany: vide() },
    revisionPlanAmortissement: { findMany: vide() },
    amortissementDerogatoire: { findMany: vide() },
    ligneReevaluationBilan: { findMany: vide() },
    repriseSubventionImmobilisation: { findMany: vide() },
    repriseProvisionReevaluation: { findMany: vide() },
    reductionSubventionImmobilisation: { findMany: vide() },
    reclassementImmobilisation: { findMany: vide() },
    exercice: { findMany: jest.fn().mockResolvedValue([exN, EX_N1]) },
    ecriture: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ecr-1', statut: options.statut, numeroPiece: 7, lignes: [{ lettre: null, lettrageId: null, rapprochementId: null }] }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    annulationTraitementImmobilisation: { create: jest.fn().mockResolvedValue({ id: 'ann-1' }) },
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  const ecritures = { inscrireEnNegatifPourAnnulation: jest.fn().mockResolvedValue({ id: 'neg-1', numeroPiece: 9, date: new Date('2026-12-31') }) };
  const service = new AnnulationTraitementService(prisma as never, ecritures as never);
  return { service, prisma, ecritures, dotation };
}

const DTO = { nature: 'DOTATION' as const, acteId: '11111111-1111-4111-8111-111111111111', motif: 'Durée erronée' };

describe("l'annulation d'une dotation", () => {
  it('au brouillard · retire la dotation PUIS son écriture, filtrée sur le statut, sans négatif', async () => {
    const { service, prisma, ecritures } = fabrique({ statut: 'BROUILLARD' });
    const r = await service.annuler('t-1', 'u-1', DTO);
    expect(r.traitement).toBe('SUPPRIMEE');
    expect(ecritures.inscrireEnNegatifPourAnnulation).not.toHaveBeenCalled();
    expect(prisma.dotationAmortissement.deleteMany).toHaveBeenCalledWith({ where: { id: DTO.acteId, immobilisation: { tenantId: 't-1' } } });
    expect(prisma.ecriture.deleteMany).toHaveBeenCalledWith({ where: { id: 'ecr-1', tenantId: 't-1', statut: 'BROUILLARD' } });
    // La dotation part avant l'écriture qu'elle retient (RESTRICT).
    expect(prisma.dotationAmortissement.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(prisma.ecriture.deleteMany.mock.invocationCallOrder[0]);
    const cree = prisma.annulationTraitementImmobilisation.create.mock.calls[0][0].data;
    expect(cree).toMatchObject({ nature: 'DOTATION', traitement: 'SUPPRIMEE', ecritureOrigineId: null, ecritureNegatifId: null, motif: 'Durée erronée', numeroPieceOrigine: 7 });
  });

  it('validée · inscrite en négatif, jamais supprimée, et l’acte retient l’origine et le négatif', async () => {
    const { service, prisma, ecritures } = fabrique({ statut: 'VALIDEE' });
    const r = await service.annuler('t-1', 'u-1', DTO);
    expect(r.traitement).toBe('INSCRITE_EN_NEGATIF');
    expect(ecritures.inscrireEnNegatifPourAnnulation).toHaveBeenCalledWith('t-1', 'u-1', 'ecr-1', 'Durée erronée', prisma);
    expect(prisma.ecriture.deleteMany).not.toHaveBeenCalled();
    const cree = prisma.annulationTraitementImmobilisation.create.mock.calls[0][0].data;
    expect(cree).toMatchObject({ ecritureOrigineId: 'ecr-1', ecritureNegatifId: 'neg-1' });
  });

  it("refuse tant que la dotation de l'exercice suivant existe · rien n'est écrit", async () => {
    const { service, prisma } = fabrique({ statut: 'BROUILLARD', dotationsSuivantes: true });
    await expect(service.annuler('t-1', 'u-1', DTO)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.dotationAmortissement.deleteMany).not.toHaveBeenCalled();
  });

  it('refuse dans un exercice clôturé', async () => {
    const { service } = fabrique({ statut: 'VALIDEE', exerciceClos: true });
    await expect(service.annuler('t-1', 'u-1', DTO)).rejects.toThrow(/clôturé/);
  });

  it('409 quand un autre geste a déjà retiré la dotation', async () => {
    const { service, prisma } = fabrique({ statut: 'BROUILLARD' });
    prisma.dotationAmortissement.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.annuler('t-1', 'u-1', DTO)).rejects.toThrow(ConflictException);
  });

  it('409 quand l’écriture a été validée entre-temps et ne se supprime plus', async () => {
    const { service, prisma } = fabrique({ statut: 'BROUILLARD' });
    prisma.ecriture.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.annuler('t-1', 'u-1', DTO)).rejects.toThrow(ConflictException);
  });

  it('refuse une ligne lettrée', async () => {
    const { service, prisma } = fabrique({ statut: 'VALIDEE' });
    prisma.ecriture.findFirst.mockResolvedValue({ id: 'ecr-1', statut: 'VALIDEE', numeroPiece: 7, lignes: [{ lettre: 'AA', lettrageId: 'l-1', rapprochementId: null }] });
    await expect(service.annuler('t-1', 'u-1', DTO)).rejects.toThrow(/lettrées/);
  });
});
