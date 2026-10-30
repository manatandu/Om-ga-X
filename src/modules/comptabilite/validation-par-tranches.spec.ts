import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { EcritureService } from './ecriture.service';
import type { PrismaService } from '../../common/prisma.service';
import type { JournalService } from '../journaux/journal.service';
import type { ExerciceService } from '../exercice/exercice.service';
import type { AnalytiqueService } from '../analytique/analytique.service';

/**
 * LA VALIDATION PAR PÉRIODE SE FAIT PAR TRANCHES (relecture du circuit de
 * visa, M5). Une seule transaction pour tout le mois verrouillait chaque pièce
 * jusqu'à soixante secondes, et son échec tombait en 500 opaque · le cabinet
 * ne savait pas ce qui était entré au livre-journal. Ce spec gèle · une
 * transaction par tranche, le contenu visé lu sous le circuit seul, l'échec
 * d'une tranche nommé avec ce qui est passé avant, l'équilibre et l'exercice
 * relus sous verrou, et la pièce retirée entre deux lectures distinguée de la
 * pièce validée ailleurs.
 */

type Faux = Record<string, any>;

function piece(id: string, options: { exercice?: string; debit?: number } = {}) {
  return {
    id,
    statut: 'BROUILLARD',
    numeroPiece: 1,
    createdBy: 'A',
    contenuPar: null,
    contenuLe: null,
    viseePar: null,
    viseeLe: null,
    viseeEmpreinte: null,
    estGenereeParCloture: false,
    estANouveauProvisoire: false,
    exercice: { statut: options.exercice ?? 'OUVERT' },
    journal: { code: 'OD', type: 'GENERAL' },
    lignes: [
      { debit: options.debit ?? 100, credit: 0 },
      { debit: 0, credit: 100 },
    ],
  };
}

function monter(pieces: Faux[], options: { sousVerrou?: (ids: string[], appel: number) => Faux[]; panneALaTranche?: number; validees?: string[] } = {}) {
  let tranche = 0;
  const transactions: string[][] = [];
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const enTransaction = (ids: string[]) => ({
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    ecriture: {
      findMany: jest.fn(async ({ where, select }: Faux) => {
        transactions[transactions.length - 1].push(JSON.stringify(Object.keys(select)));
        const lues = options.sousVerrou ? options.sousVerrou(where.id.in, tranche) : pieces.filter((p) => where.id.in.includes(p.id));
        return lues;
      }),
      updateMany,
      count: jest.fn(async ({ where }: Faux) => (options.validees ?? []).filter((id) => where.id.in.includes(id)).length),
    },
    ids,
  });
  const prisma: Faux = {
    ecriture: {
      findMany: jest.fn(async ({ where }: Faux) => pieces.filter((p) => where.id.in.includes(p.id))),
    },
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ doubleRegardValidation: false, circuitVisa: false, referentiel: 'SYSCOHADA' }) },
    $transaction: jest.fn(async (fn: (tx: Faux) => Promise<unknown>) => {
      tranche += 1;
      transactions.push([]);
      if (options.panneALaTranche === tranche) throw new Error('connexion perdue');
      return fn(enTransaction([]));
    }),
  };
  const service = new EcritureService(
    prisma as unknown as PrismaService,
    {} as JournalService,
    {} as unknown as ExerciceService,
    {} as AnalytiqueService,
  );
  return { service, prisma, updateMany, transactions };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${String(i).padStart(4, '0')}`);

describe('la validation par période, tranche par tranche', () => {
  it('une transaction par tranche de cinq cents pièces, sans le contenu visé hors du circuit', async () => {
    const tous = ids(1200);
    const { service, prisma, updateMany, transactions } = monter(tous.map((id) => piece(id)));
    const r = await service.valider('t', 'B', tous);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(updateMany.mock.calls.map((c) => c[0].where.id.in.length)).toEqual([500, 500, 200]);
    expect(r.validees).toBe(1200);
    // Hors du circuit, ni la date, ni le libellé, ni la référence ne sont lus · le contenu visé n'est pas chargé.
    for (const t of transactions) expect(t[0]).not.toMatch(/"libelle"|"reference"|"dateValeur"/);
  });

  it('une panne à la deuxième tranche se dit avec ce que la première a fait entrer au livre-journal', async () => {
    const tous = ids(700);
    const { service } = monter(tous.map((id) => piece(id)), { panneALaTranche: 2 });
    const refus = await service.valider('t', 'B', tous).catch((e: unknown) => e);
    expect(refus).toBeInstanceOf(ServiceUnavailableException);
    expect((refus as Error).message).toMatch(/tranche 2 sur 2[\s\S]*500 écriture\(s\) des tranches précédentes sont entrées au livre-journal/);
  });

  it('un exercice clôturé entre les deux lectures arrête la tranche, sous verrou, en le nommant', async () => {
    const tous = ids(600);
    const { service } = monter(tous.map((id) => piece(id)), {
      sousVerrou: (demandes, tranche) => demandes.map((id) => piece(id, { exercice: tranche === 2 ? 'CLOTURE' : 'OUVERT' })),
    });
    const refus = await service.valider('t', 'B', tous).catch((e: unknown) => e);
    // Le statut du refus est gardé (403), son message complété de ce qui est passé.
    expect((refus as ForbiddenException).getStatus()).toBe(403);
    expect((refus as Error).message).toMatch(/est clôturé \(tranche 2 sur 2\)\. 500 écriture\(s\)/);
  });

  it('une pièce déséquilibrée entre les deux lectures ne passe pas · l’équilibre se relit sous verrou', async () => {
    const { service, updateMany } = monter([piece('e1')], { sousVerrou: (demandes) => demandes.map((id) => piece(id, { debit: 90 })) });
    await expect(service.valider('t', 'B', ['e1'])).rejects.toThrow(/déséquilibrée/);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('une pièce retirée entre deux lectures n’est pas « déjà validée »', async () => {
    const { service } = monter([piece('e1'), piece('e2'), piece('e3')], {
      sousVerrou: (demandes) => demandes.filter((id) => id === 'e1').map((id) => piece(id)),
      validees: ['e2'],
    });
    const r = await service.valider('t', 'B', ['e1', 'e2', 'e3']);
    expect(r).toMatchObject({ validees: 1, dejaValidees: 1, retireesEntreTemps: 1 });
  });
});
