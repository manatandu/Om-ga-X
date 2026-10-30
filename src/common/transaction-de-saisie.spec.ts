import { ConflictException } from '@nestjs/common';
import { NumerotationPiece, Prisma } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prochainNumeroPiece } from '../modules/journaux/numerotation-piece';
import { CODE_CONFLIT_SERIALISATION } from './prisma-retry.util';
import { transactionDeSaisie } from './transaction-de-saisie';

/**
 * LA SAISIE SE SÉRIALISE PAR DOSSIER (ligne saisie-serialisable, 2026-10-30).
 * Ce que l'isolation sérialisable protégeait se tient par l'ORDRE des requêtes ·
 * verrou du dossier, puis marque des exercices ouverts, puis le geste ; et le
 * numéro de pièce se lit sous le verrou et la ligne de son exercice. Rejoué sur
 * vraie base par `scripts/rejouer-saisie-concurrente.cjs`.
 */

type Appel = { sql: string; valeurs: unknown[] };
function client() {
  const appels: Appel[] = [];
  const brut = jest.fn(async (texte: TemplateStringsArray | Prisma.Sql, ...valeurs: unknown[]) => {
    appels.push({ sql: Array.isArray(texte) ? (texte as TemplateStringsArray).join('?') : (texte as Prisma.Sql).sql, valeurs });
    return 0;
  });
  const options: unknown[] = [];
  const tx = { $executeRaw: brut, ecriture: { aggregate: jest.fn(async () => { appels.push({ sql: 'AGGREGATE', valeurs: [] }); return { _max: { numeroPiece: 4 } }; }) } };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown, opts?: unknown) => {
      options.push(opts);
      return fn(tx);
    }),
  };
  return { prisma, tx, appels, options };
}

describe('transactionDeSaisie', () => {
  it('en lecture validée, le verrou du dossier pris EN PREMIER, puis les exercices ouverts réécrits, puis le geste', async () => {
    const { prisma, appels, options } = client();
    const geste = jest.fn(async () => {
      appels.push({ sql: 'GESTE', valeurs: [] });
      return 'fait';
    });
    await expect(transactionDeSaisie(prisma as never, 'dossier-a', geste, 'refus')).resolves.toBe('fait');
    expect((options[0] as { isolationLevel: string }).isolationLevel).toBe(Prisma.TransactionIsolationLevel.ReadCommitted);
    const ordre = appels.map((a) => a.sql);
    expect(ordre[0]).toMatch(/lock_timeout/);
    expect(ordre[1]).toMatch(/pg_advisory_xact_lock\(hashtext/);
    expect(appels[1].valeurs).toEqual(['dossier-a']);
    expect(ordre[2]).toMatch(/UPDATE "exercices" SET "statut" = "statut" WHERE "tenantId" = \? AND "statut" = 'OUVERT'/);
    expect(appels[2].valeurs).toEqual(['dossier-a']);
    expect(ordre[3]).toBe('GESTE');
  });

  it('un interblocage se rejoue, et à bout de tentatives le refus est un 409 nommé, jamais un 500', async () => {
    const { prisma } = client();
    const interblocage = new Prisma.PrismaClientKnownRequestError('deadlock', { code: 'P2010', clientVersion: 'x', meta: { code: '40P01' } });
    let n = 0;
    const geste = jest.fn(async () => {
      n++;
      if (n === 1) throw interblocage;
      return n;
    });
    await expect(transactionDeSaisie(prisma as never, 'd', geste, 'refus')).resolves.toBe(2);
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const toujours = jest.fn(async () => { throw interblocage; });
      const promesse = transactionDeSaisie(prisma as never, 'd', toujours, 'Trop au même instant').catch((e) => e);
      await jest.runAllTimersAsync();
      const e = await promesse;
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toMatchObject({ code: CODE_CONFLIT_SERIALISATION });
    } finally {
      jest.useRealTimers();
    }
  });

  it('une attente de verrou expirée rend DOSSIER_OCCUPE', async () => {
    const { prisma } = client();
    const expiree = new Prisma.PrismaClientKnownRequestError('canceling statement due to lock timeout 55P03', { code: 'P2010', clientVersion: 'x', meta: { code: '55P03' } });
    const e = await transactionDeSaisie(prisma as never, 'd', async () => { throw expiree; }, 'refus').catch((x) => x);
    expect((e as ConflictException).getResponse()).toMatchObject({ code: 'DOSSIER_OCCUPE' });
  });
});

describe('prochainNumeroPiece · le maximum se lit sous le verrou du dossier et la ligne de son exercice', () => {
  for (const numerotation of [NumerotationPiece.CONTINUE_JOURNAL, NumerotationPiece.CONTINUE_FICHIER, NumerotationPiece.MENSUELLE]) {
    it(`${numerotation} · verrou, ligne de l'exercice, puis le maximum`, async () => {
      const { tx, appels } = client();
      await expect(prochainNumeroPiece(tx as never, 'dossier-a', { id: 'j', numerotation }, 'ex-1', new Date('2026-05-10'))).resolves.toBe(5);
      expect(appels.map((a) => a.sql)).toEqual([
        expect.stringMatching(/pg_advisory_xact_lock\(hashtext/),
        expect.stringMatching(/UPDATE "exercices" SET "statut" = "statut" WHERE "id" = \? AND "tenantId" = \?/),
        'AGGREGATE',
      ]);
      expect(appels[0].valeurs).toEqual(['dossier-a']);
      expect(appels[1].valeurs).toEqual(['ex-1', 'dossier-a']);
    });
  }

  it('MANUELLE · aucun numéro, aucun verrou', async () => {
    const { tx, appels } = client();
    await expect(prochainNumeroPiece(tx as never, 'd', { id: 'j', numerotation: NumerotationPiece.MANUELLE }, 'ex', new Date())).resolves.toBeNull();
    expect(appels).toHaveLength(0);
  });
});

describe('la saisie et les gestes de trésorerie ne passent plus par la transaction sérialisable', () => {
  // Un geste resté sérialisable qui relit sur son image ce qu'une saisie en
  // lecture validée vient d'écrire ne la verrait pas (relecture du 2026-10-22, B1) ·
  // ceux qui suivent `creerAvec` suivent son isolation.
  for (const fichier of [
    'modules/comptabilite/ecriture.service.ts',
    'modules/tresorerie/titres-placement.service.ts',
    'modules/tresorerie/operations-tresorerie.service.ts',
  ]) {
    it(fichier, () => {
      const source = readFileSync(join(__dirname, '..', fichier), 'utf8');
      expect(source).toContain('transactionDeSaisie(');
      expect(source).not.toMatch(/avecRetrySerialisable\s*\(/);
    });
  }
});
