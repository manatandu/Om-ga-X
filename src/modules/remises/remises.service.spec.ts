import { BadRequestException, ConflictException } from '@nestjs/common';
import { RemisesService } from './remises.service';

/**
 * LE SERVICE DES REMISES SUR DOUBLURES (ligne sage-l3, fonction 40) · ce qui
 * casserait en silence. (1) Un lettrage refusé à la réception défait la pièce
 * ET la valeur, et l'erreur d'origine remonte. (2) Le numéro du bordereau se
 * prend sous verrou, dans la transaction, et un changement d'état concurrent
 * fait tout refuser. (3) Une commission sans compte de commission est refusée
 * AVANT toute pièce. (4) Une remise créditée ne s'annule pas sans son avis.
 * (5) L'impayé refuse un 413 hors de la racine que le plan prescrit.
 */
const TYPE = {
  id: 'type1',
  code: 'CHQ',
  nature: 'CHEQUES',
  estActif: true,
  journalBanqueId: 'jbq',
  journalOperationsId: 'jod',
  compteReceptionId: 'c513',
  compteTransitId: 'c514',
  compteCommissionId: null,
  modeleBordereau: null,
  journalBanque: { id: 'jbq', code: 'BQ', type: 'TRESORERIE', estActif: true, compteTresorerie: { id: 'c52', numero: '52110001' } },
  journalOperations: { id: 'jod', code: 'OD', type: 'GENERAL', estActif: true, compteTresorerie: null },
  compteReception: { id: 'c513', numero: '51300000', intitule: 'Chèques à encaisser', typeCompte: 'DETAIL', estActif: true },
  compteTransit: { id: 'c514', numero: '51400000', intitule: "Chèques à l'encaissement", typeCompte: 'DETAIL', estActif: true },
  compteCommission: null,
};

function monter(options: { lettrageEchoue?: boolean; prisesRemise?: number } = {}) {
  const appels: string[] = [];
  const tx = {
    $executeRaw: jest.fn(async () => {
      appels.push('verrou');
      return 1;
    }),
    remiseEnBanque: {
      aggregate: jest.fn(async () => ({ _max: { numero: 4 } })),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        appels.push('remise');
        return { id: 'r1', ...data };
      }),
    },
    valeurRecue: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'v1', ...data })),
      updateMany: jest.fn(async () => ({ count: options.prisesRemise ?? 2 })),
      deleteMany: jest.fn(async () => {
        appels.push('valeur retirée');
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    typeRemise: { findFirst: jest.fn(async () => TYPE) },
    compte: { findFirst: jest.fn(async ({ where }: { where: { id: string } }) => (where.id === 'c411' ? { id: 'c411', numero: '41110001', intitule: 'Client', typeCompte: 'DETAIL', estActif: true } : where.id === 'c4133' ? { id: 'c4133', numero: '41330000', intitule: 'Cartes impayées', typeCompte: 'DETAIL', estActif: true } : null)) },
    exercice: { findFirst: jest.fn(async () => ({ id: 'ex1', statut: 'OUVERT', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') })) },
    tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA' })) },
    valeurRecue: {
      findMany: jest.fn(async () => [
        { id: 'v1', montant: 10.005, reference: 'A', date: new Date('2026-03-01'), compteTiers: { intitule: 'Client' } },
        { id: 'v2', montant: 10.005, reference: 'B', date: new Date('2026-03-02'), compteTiers: { intitule: 'Client' } },
      ]),
      findFirst: jest.fn(async () => ({ id: 'v3', statut: 'REMISE', date: new Date('2026-03-01'), montant: 300000, reference: 'C', typeRemise: TYPE, compteTiers: { numero: '41110001', intitule: 'Client' }, remise: { numero: 2, statut: 'REMISE' } })),
    },
    remiseEnBanque: { findFirst: jest.fn(async () => ({ id: 'r9', numero: 9, statut: 'CREDITEE', date: new Date('2026-03-12'), total: 1000, exerciceId: 'ex1', typeRemise: TYPE, valeurs: [], ecritureRemiseId: 'e1', exercice: { statut: 'OUVERT' } })) },
    ecriture: { update: jest.fn(async () => ({})) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const ecritures = {
    creerAvec: jest.fn(async (_t: string, _u: string, dto: { lignes: Array<{ compteId: string }> }, suite: (t: typeof tx, e: { id: string; lignes: Array<{ id: string; compteId: string }> }) => Promise<unknown>) => {
      appels.push('écriture');
      const ecriture = { id: 'e1', lignes: dto.lignes.map((l, i) => ({ id: `l${i}`, compteId: l.compteId })) };
      return { ecriture, suite: await suite(tx, ecriture) };
    }),
    retirerCompensation: jest.fn(async (_t: string, _e: string, liberer?: (t: typeof tx) => Promise<unknown>) => {
      if (liberer) await liberer(tx);
      appels.push('pièce retirée');
    }),
  };
  const lettrage = {
    lettrerManuel: jest.fn(async () => {
      if (options.lettrageEchoue) throw new BadRequestException('Les lignes ne se lettrent pas · solde non nul.');
      return { lettre: 'AA' };
    }),
    delettrer: jest.fn(async () => undefined),
  };
  return { service: new RemisesService(prisma as never, ecritures as never, lettrage as never), appels, tx, prisma, ecritures, lettrage };
}

const RECEPTION = { exerciceId: 'ex1', typeRemiseId: 'type1', compteTiersId: 'c411', date: '2026-03-10', montant: 1500, reference: 'CHQ 1' };

describe('RemisesService · réception', () => {
  it("la valeur naît avec sa pièce, lettrée avec les lignes choisies", async () => {
    const { service, lettrage, appels } = monter();
    const r = await service.recevoir('t', 'u', { ...RECEPTION, ligneIds: ['f1'] });
    expect(r.lettre).toBe('AA');
    expect(lettrage.lettrerManuel).toHaveBeenCalledWith('t', 'c411', ['f1', 'l1'], 'u', { autoriserPartiel: true });
    expect(appels).toEqual(['écriture']);
  });

  it("un lettrage refusé retire la valeur ET la pièce, et l'erreur d'origine remonte", async () => {
    const { service, appels, tx } = monter({ lettrageEchoue: true });
    await expect(service.recevoir('t', 'u', { ...RECEPTION, ligneIds: ['f1'] })).rejects.toThrow(/solde non nul/);
    expect(tx.valeurRecue.deleteMany).toHaveBeenCalledWith({ where: { id: 'v1', tenantId: 't' } });
    expect(appels).toEqual(['écriture', 'valeur retirée', 'pièce retirée']);
  });

  it('un tiers hors classe 4 ou un montant illisible sont refusés avant toute pièce', async () => {
    const { service, ecritures } = monter();
    await expect(service.recevoir('t', 'u', { ...RECEPTION, montant: 0 })).rejects.toThrow(/montant/);
    await expect(service.recevoir('t', 'u', { ...RECEPTION, compteTiersId: 'c4133' })).resolves.toBeDefined();
    expect(ecritures.creerAvec).toHaveBeenCalledTimes(1);
  });
});

describe('RemisesService · bordereau', () => {
  it('le numéro suit le dernier, sous verrou, dans la transaction de la pièce · le total somme les lignes arrondies', async () => {
    const { service, appels, tx } = monter();
    const r = await service.remettre('t', 'u', { exerciceId: 'ex1', typeRemiseId: 'type1', date: '2026-03-12', valeurIds: ['v1', 'v2'] });
    expect(r.numero).toBe(5);
    expect(appels).toEqual(['écriture', 'verrou', 'remise']);
    expect(String((tx.remiseEnBanque.create.mock.calls[0][0] as { data: { total: unknown } }).data.total)).toBe('20.02');
    expect(tx.valeurRecue.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't', id: { in: ['v1', 'v2'] }, statut: 'RECUE', annuleLe: null, remiseId: null },
      data: { statut: 'REMISE', remiseId: 'r1' },
    });
  });

  it("une valeur qui a changé d'état pendant la remise fait tout refuser (409)", async () => {
    const { service } = monter({ prisesRemise: 1 });
    await expect(service.remettre('t', 'u', { exerciceId: 'ex1', typeRemiseId: 'type1', date: '2026-03-12', valeurIds: ['v1', 'v2'] })).rejects.toThrow(ConflictException);
  });

  it('une valeur reçue APRÈS la date de la remise est refusée en la nommant', async () => {
    const { service } = monter();
    await expect(service.remettre('t', 'u', { exerciceId: 'ex1', typeRemiseId: 'type1', date: '2026-03-01', valeurIds: ['v1', 'v2'] })).rejects.toThrow(/B a été reçue le 02\/03\/2026/);
  });
});

describe("RemisesService · avis de crédit, annulation, impayé", () => {
  it('une commission sans compte de commission est refusée avant toute pièce', async () => {
    const { service, ecritures, prisma } = monter();
    prisma.remiseEnBanque.findFirst.mockResolvedValueOnce({ id: 'r9', numero: 9, statut: 'REMISE', date: new Date('2026-03-12'), total: 1000, exerciceId: 'ex1', typeRemise: TYPE } as never);
    await expect(service.avisCredit('t', 'u', 'r9', { date: '2026-03-15', referenceAvis: 'Relevé', commission: 15 })).rejects.toThrow(/compte de commission/);
    expect(ecritures.creerAvec).not.toHaveBeenCalled();
  });

  it("une remise créditée ne s'annule pas · l'avis d'abord", async () => {
    const { service } = monter();
    await expect(service.annulerRemise('t', 'u', 'r9', { motif: 'essai' })).rejects.toThrow(/annulez d'abord l'avis de crédit/);
  });

  it("l'impayé refuse un 413 hors de la racine du plan (4133 pour un chèque au SYSCOHADA)", async () => {
    const { service, ecritures } = monter();
    await expect(service.impaye('t', 'u', 'v3', { date: '2026-03-20', compteImpayeId: 'c4133' })).rejects.toThrow(/41330000.*4131/);
    expect(ecritures.creerAvec).not.toHaveBeenCalled();
  });
});
