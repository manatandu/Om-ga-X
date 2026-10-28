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

function fabrique(options: { statut: 'BROUILLARD' | 'VALIDEE'; dotationsSuivantes?: boolean; exerciceClos?: boolean; duTransfert?: boolean }) {
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
    transfertImmobilisationGroupe: {
      findFirst: jest.fn().mockResolvedValue(options.duTransfert ? { id: 'tr-1' } : null),
      findMany: vide(),
    },
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  prisma.$queryRaw = jest.fn().mockResolvedValue([]);
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

  it('la dotation complémentaire d’un transfert dans le groupe renvoie au siège · rien n’est écrit', async () => {
    const { service, prisma } = fabrique({ statut: 'VALIDEE', duTransfert: true });
    await expect(service.annuler('t-1', 'u-1', DTO)).rejects.toThrow(/annulez le transfert depuis le siège/);
    expect(prisma.transfertImmobilisationGroupe.findFirst).toHaveBeenCalledWith({ where: { tenantId: 't-1', ecritureId: 'ecr-1' }, select: { id: true } });
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

describe('la révision posée par une réévaluation se reconnaît à sa liaison (relecture M3)', () => {
  const revision = (reevaluationBilanId: string | null) => ({
    id: '22222222-2222-4222-8222-222222222222',
    immobilisationId: 'bien-1',
    exerciceId: EX_N.id,
    nature: 'PROSPECTIVE',
    // La date de la clôture, comme celle que pose la méthode 2 · la date
    // seule ne dit plus rien de l'auteur.
    dateDecision: EX_N.dateFin,
    dureeAvantAns: 5,
    dureeApresAns: 3,
    motif: 'Révision du cabinet',
    montantReprise: null,
    ecritureId: null,
    reevaluationBilanId,
    createdAt: new Date('2026-12-31T15:00:00Z'),
    createdBy: 'u-1',
    exercice: EX_N,
  });
  const preparer = (reevaluationBilanId: string | null) => {
    const f = fabrique({ statut: 'BROUILLARD' });
    const r = revision(reevaluationBilanId);
    f.prisma.revisionPlanAmortissement = {
      findFirst: jest.fn().mockResolvedValue(r),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    f.prisma.immobilisation.findFirst = jest.fn().mockResolvedValue({
      id: 'bien-1',
      dureeAmortissementAns: 3,
      reprisesAmortissement: 0,
      dateEffetRevisionPlan: new Date('2027-01-01'),
      dureeResiduelleRevisee: 3,
    });
    f.prisma.immobilisation.update = jest.fn().mockResolvedValue({});
    return f;
  };
  const DTO_REVISION = { nature: 'REVISION_PLAN' as const, acteId: '22222222-2222-4222-8222-222222222222', motif: 'Durée erronée' };

  it('une révision prospective du CABINET datée de la clôture s’annule comme la sienne · jamais prise pour celle de la réévaluation', async () => {
    const { service, prisma } = preparer(null);
    await expect(service.annuler('t-1', 'u-1', DTO_REVISION)).resolves.toMatchObject({ annule: true, nature: 'REVISION_PLAN' });
    expect(prisma.revisionPlanAmortissement.deleteMany).toHaveBeenCalledWith({ where: { id: DTO_REVISION.acteId, tenantId: 't-1' } });
    // La durée d'avant revient sur la fiche.
    expect(prisma.immobilisation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dureeAmortissementAns: 5 }) }));
  });

  it('la révision LIÉE à la réévaluation ne s’annule pas seule', async () => {
    const { service, prisma } = preparer('reev-1');
    await expect(service.annuler('t-1', 'u-1', DTO_REVISION)).rejects.toThrow(/avec la réévaluation/);
    expect(prisma.revisionPlanAmortissement.deleteMany).not.toHaveBeenCalled();
  });

  it('la réévaluation ne relit que les révisions qui lui sont liées', async () => {
    const { service, prisma } = preparer('reev-1');
    prisma.reevaluationBilan = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'reev-1',
        exerciceId: EX_N.id,
        exercice: EX_N,
        type: 'LIBRE',
        methodeLibre: 'ELIMINATION',
        neutraliteFiscale: false,
        dateReevaluation: EX_N.dateFin,
        decision: 'PV',
        traitementFiscal: 'x',
        totalEcart: 100,
        ecritureId: 'ecr-r',
        createdAt: new Date('2026-12-31T12:00:00Z'),
        lignes: [{ immobilisationId: 'bien-1', amortissementsApres: 0 }],
      }),
    };
    await service.annuler('t-1', 'u-1', { nature: 'REEVALUATION', acteId: 'reev-1', motif: 'Erreur de coefficient' }).catch(() => undefined);
    const lecture = prisma.revisionPlanAmortissement.findMany.mock.calls.find(([a]: [{ where: Record<string, unknown> }]) => 'reevaluationBilanId' in a.where);
    expect(lecture?.[0].where).toEqual({ tenantId: 't-1', reevaluationBilanId: 'reev-1' });
  });
});

describe('la réévaluation ne relit que les biens qu’elle a changés (relecture, mineur)', () => {
  it('un bien recensé sans écart ne la bloque pas par ses actes suivants', async () => {
    const f = fabrique({ statut: 'BROUILLARD' });
    f.prisma.reevaluationBilan = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'reev-1',
        exerciceId: EX_N.id,
        exercice: EX_N,
        type: 'LEGALE',
        methodeLibre: null,
        neutraliteFiscale: false,
        dateReevaluation: EX_N.dateFin,
        decision: 'PV',
        traitementFiscal: 'x',
        totalEcart: 100,
        ecritureId: 'ecr-r',
        createdAt: new Date('2026-12-31T12:00:00Z'),
        lignes: [
          { immobilisationId: 'bien-1', ecart: 100, amortissementsApres: 40, amortissementsAvant: 0, brutAvant: 1000, brutApres: 1100 },
          { immobilisationId: 'terrain', ecart: 0, amortissementsApres: 0, amortissementsAvant: 0, brutAvant: 500, brutApres: 500 },
        ],
      }),
    };
    await f.service.annuler('t-1', 'u-1', { nature: 'REEVALUATION', acteId: 'reev-1', motif: 'Erreur de coefficient' }).catch(() => undefined);
    const lecture = f.prisma.dotationAmortissement.findMany.mock.calls[0][0];
    expect(lecture.where.immobilisationId).toEqual({ in: ['bien-1'] });
  });
});

describe('l’annulation prend le verrou des fiches avant de juger (relecture)', () => {
  it('SELECT … FOR UPDATE sur les biens de l’acte, avant la lecture des actes qui en dépendent', async () => {
    const { service, prisma } = fabrique({ statut: 'BROUILLARD' });
    await service.annuler('t-1', 'u-1', DTO);
    const sql = (prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toMatch(/FROM "immobilisations" WHERE "tenantId" = \? AND id IN \(\?\) ORDER BY id FOR UPDATE/);
    // Le verrou précède la relecture des actes dans la transaction.
    const ordreVerrou = prisma.$queryRaw.mock.invocationCallOrder[0];
    const lectures = prisma.dotationAmortissement.findMany.mock.invocationCallOrder;
    expect(lectures.some((o: number) => o > ordreVerrou)).toBe(true);
  });
});

describe('l’onglet Traitements lit en lot (relecture, performance)', () => {
  it('une lecture des actes par ensemble de biens, une seule lecture des écritures', async () => {
    const { service, prisma } = fabrique({ statut: 'VALIDEE' });
    const cible = (acteId: string, ecritureId: string, biens: string[]) => ({
      nature: 'DOTATION',
      acteId,
      immobilisationId: biens.length === 1 ? biens[0] : null,
      biens,
      exercice: { id: 'ex-n', dateFin: new Date('2026-12-31'), statut: 'OUVERT' },
      creeLe: new Date('2026-12-31T10:00:00Z'),
      montant: 1,
      ecritureId,
      libelle: 'x',
      acte: {},
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = service as any;
    jest.spyOn(s, 'ciblesDuBien').mockResolvedValue([cible('a', 'ecr-1', ['bien-1']), cible('b', 'ecr-2', ['bien-1']), cible('c', 'ecr-3', ['bien-2', 'bien-1'])]);
    const actes = jest.spyOn(s, 'actesDesBiens').mockResolvedValue([]);
    prisma.ecriture.findMany = jest.fn().mockImplementation(({ where }) =>
      Promise.resolve(where.id.in.map((id: string) => ({ id, numeroPiece: 1, statut: 'VALIDEE', lignes: [] }))),
    );
    const { traitements } = await service.traitementsDuBien('t-1', 'bien-1');
    expect(traitements).toHaveLength(3);
    expect(actes).toHaveBeenCalledTimes(2);
    expect(prisma.ecriture.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.ecriture.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: 't-1', id: { in: ['ecr-1', 'ecr-2', 'ecr-3'] } });
    expect(prisma.ecriture.findFirst).not.toHaveBeenCalled();
    expect(traitements.map((t: { ecriture: { id: string } | null }) => t.ecriture?.id).sort()).toEqual(['ecr-1', 'ecr-2', 'ecr-3']);
  });
});
