import { ConflictException, ForbiddenException } from '@nestjs/common';
import { NumerotationPiece, Prisma } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { numeroteurDeLot, prochainNumeroPiece } from '../modules/journaux/numerotation-piece';
import { CODE_CONFLIT_SERIALISATION } from './prisma-retry.util';
import { prendreLeVerrouDuDossierBorne, transactionDeSaisie } from './transaction-de-saisie';

/**
 * LES GESTES QUI ÉCRIVENT DES ÉCRITURES SE SÉRIALISENT PAR DOSSIER (ligne
 * saisie-serialisable, 2026-10-30). Ce que l'isolation sérialisable protégeait
 * se tient par l'ORDRE des requêtes · le verrou du dossier, attente bornée à
 * lui seul, puis le geste ; et le numéro de pièce se lit sous le verrou,
 * l'exercice relu ouvert. Rejoué sur vraie base par
 * `scripts/rejouer-saisie-concurrente.cjs`.
 */

type Appel = { sql: string; valeurs: unknown[] };
function client(statutExercice: string | null = 'OUVERT') {
  const appels: Appel[] = [];
  const texte = (t: TemplateStringsArray | Prisma.Sql) => (Array.isArray(t) ? (t as TemplateStringsArray).join('?') : (t as Prisma.Sql).sql);
  const tx = {
    $executeRaw: jest.fn(async (t: TemplateStringsArray | Prisma.Sql, ...valeurs: unknown[]) => {
      appels.push({ sql: texte(t), valeurs });
      return 1;
    }),
    $queryRaw: jest.fn(async (t: TemplateStringsArray | Prisma.Sql, ...valeurs: unknown[]) => {
      appels.push({ sql: texte(t), valeurs });
      return statutExercice === null ? [] : [{ statut: statutExercice }];
    }),
    ecriture: {
      aggregate: jest.fn(async () => {
        appels.push({ sql: 'AGGREGATE', valeurs: [] });
        return { _max: { numeroPiece: 4 } };
      }),
    },
  };
  const options: unknown[] = [];
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown, opts?: unknown) => {
      options.push(opts);
      return fn(tx);
    }),
  };
  return { prisma, tx, appels, options };
}

describe('transactionDeSaisie', () => {
  it('en lecture validée · borne posée, verrou du dossier pris EN PREMIER, borne rendue, puis le geste', async () => {
    const { prisma, appels, options } = client();
    const geste = jest.fn(async () => {
      appels.push({ sql: 'GESTE', valeurs: [] });
      return 'fait';
    });
    await expect(transactionDeSaisie(prisma as never, 'dossier-a', geste, 'refus')).resolves.toBe('fait');
    expect((options[0] as { isolationLevel: string }).isolationLevel).toBe(Prisma.TransactionIsolationLevel.ReadCommitted);
    expect(appels.map((a) => a.sql)).toEqual([
      expect.stringMatching(/SET LOCAL lock_timeout = \d+/),
      expect.stringMatching(/pg_advisory_xact_lock\(hashtext/),
      expect.stringMatching(/SET LOCAL lock_timeout TO DEFAULT/),
      'GESTE',
    ]);
    expect(appels[1].valeurs).toEqual(['dossier-a']);
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

  it('une attente du verrou du dossier expirée rend DOSSIER_OCCUPE, et le message dit ce qui tient le dossier', async () => {
    const { tx } = client();
    const expiree = new Prisma.PrismaClientKnownRequestError('canceling statement due to lock timeout 55P03', { code: 'P2010', clientVersion: 'x', meta: { code: '55P03' } });
    tx.$executeRaw.mockImplementationOnce(async () => 1).mockImplementationOnce(async () => { throw expiree; });
    const e = await prendreLeVerrouDuDossierBorne(tx as never, 'd').catch((x) => x);
    expect((e as ConflictException).getResponse()).toMatchObject({ code: 'DOSSIER_OCCUPE', message: expect.stringMatching(/validation par période, import/) });
  });
});

describe('prochainNumeroPiece · le maximum se lit sous le verrou du dossier, l’exercice relu ouvert', () => {
  for (const numerotation of [NumerotationPiece.CONTINUE_JOURNAL, NumerotationPiece.CONTINUE_FICHIER, NumerotationPiece.MENSUELLE]) {
    it(`${numerotation} · verrou, exercice relu, puis le maximum`, async () => {
      const { tx, appels } = client();
      await expect(prochainNumeroPiece(tx as never, 'dossier-a', { id: 'j', numerotation }, 'ex-1', new Date('2026-05-10'))).resolves.toBe(5);
      expect(appels.map((a) => a.sql)).toEqual([
        expect.stringMatching(/pg_advisory_xact_lock\(hashtext/),
        expect.stringMatching(/SELECT "statut"::text AS "statut" FROM "exercices" WHERE "id" = \? AND "tenantId" = \?/),
        'AGGREGATE',
      ]);
      expect(appels[0].valeurs).toEqual(['dossier-a']);
      expect(appels[1].valeurs).toEqual(['ex-1', 'dossier-a']);
    });
  }

  it('MANUELLE · aucun numéro, mais le verrou et l’exercice relu (point 4)', async () => {
    const { tx, appels } = client();
    await expect(prochainNumeroPiece(tx as never, 'd', { id: 'j', numerotation: NumerotationPiece.MANUELLE }, 'ex', new Date())).resolves.toBeNull();
    expect(appels.map((a) => a.sql)).toEqual([expect.stringMatching(/pg_advisory_xact_lock/), expect.stringMatching(/FROM "exercices"/)]);
  });

  it('un exercice clôturé sous le verrou refuse, dans tous les modes', async () => {
    for (const numerotation of [NumerotationPiece.MANUELLE, NumerotationPiece.CONTINUE_JOURNAL]) {
      const { tx } = client('CLOTURE');
      await expect(prochainNumeroPiece(tx as never, 'd', { id: 'j', numerotation }, 'ex', new Date())).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('le numéroteur d’un lot prend le verrou une fois, même sur un journal sans numéro', async () => {
    const { tx, appels } = client();
    const numeroter = numeroteurDeLot(tx as never, 'd', 'ex');
    await numeroter({ id: 'j', numerotation: NumerotationPiece.MANUELLE }, new Date('2026-01-02'));
    await numeroter({ id: 'j', numerotation: NumerotationPiece.MANUELLE }, new Date('2026-01-03'));
    expect(appels.filter((a) => /pg_advisory_xact_lock/.test(a.sql))).toHaveLength(1);
  });
});

describe('aucun geste qui écrit les écritures ne passe plus par la transaction sérialisable', () => {
  // Un geste resté sérialisable qui relit sur son image ce qu'un geste en
  // lecture validée vient d'écrire ne le verrait pas (relecture du 2026-10-22, B1 ;
  // clôture, mesure 6) · tous prennent le verrou du dossier en tête.
  for (const fichier of [
    'modules/comptabilite/ecriture.service.ts',
    'modules/tresorerie/titres-placement.service.ts',
    'modules/tresorerie/operations-tresorerie.service.ts',
    'modules/exercice/exercice.service.ts',
    'modules/rapprochement/rapprochement.service.ts',
  ]) {
    it(fichier, () => {
      const source = readFileSync(join(__dirname, '..', fichier), 'utf8');
      expect(source).toContain('transactionDeSaisie(');
      expect(source).not.toMatch(/isolationLevel:\s*Prisma\.TransactionIsolationLevel\.Serializable/);
    });
  }

  it('les verrous de lignes d’écritures ou d’exercices suivent le verrou du dossier', () => {
    for (const [fichier, marque] of [
      ['modules/comptabilite/ecriture.service.ts', 'private async validerUneTranche('],
      ['modules/comptabilite/circuit-visa.service.ts', 'transactionJournalisee(this.prisma, async (tx) => {'],
      ['modules/comptabilite/pieces-jointes-ecriture.ts', 'export async function verrouillerEcriture('],
      ['modules/analytique/analytique.service.ts', 'private async poserAuteurDeLaVentilation('],
    ] as const) {
      const source = readFileSync(join(__dirname, '..', fichier), 'utf8');
      const debut = source.indexOf(marque);
      expect(debut).toBeGreaterThan(-1);
      const suite = source.slice(source.lastIndexOf('\n', debut));
      const verrou = suite.indexOf('prendreLeVerrouDuDossierBorne(');
      const ligne = suite.search(/FOR (UPDATE|SHARE)/);
      expect(verrou).toBeGreaterThan(-1);
      expect(verrou).toBeLessThan(ligne);
    }
  });
});
