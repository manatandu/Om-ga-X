import { Prisma } from '@prisma/client';
import { avecRetrySerialisable, estConflitDeSerialisation, TENTATIVES_MAX, delaiDeReprise, CODE_CONFLIT_SERIALISATION } from './prisma-retry.util';
import { ConflictException } from '@nestjs/common';
import { transactionAuditee } from './audit/contexte-audit';
import { ErreurMaillonDansTransaction } from './audit/extension-audit';

/**
 * UN MAILLON D'AUDIT NAÎT ET MEURT AVEC L'ACTE.
 *
 * Audit du serveur du 2026-09-27, F11 · hors de `journaliserDansTransaction`,
 * le maillon s'écrit par une connexion à part et survit à une transaction
 * annulée. `avecRetrySerialisable` porte la plupart des actes audités
 * (création d'écriture, lettrage…) : c'est elle qui doit déclarer sa
 * transaction.
 */
describe('transaction sérialisable et journal d’audit', () => {
  it('le corps de l’acte voit SA transaction comme celle du journal', async () => {
    const tx = { marque: 'tx-1' };
    const prisma = { $transaction: jest.fn(async (f: (t: unknown) => unknown) => f(tx)) };
    let vue: unknown;
    await avecRetrySerialisable(prisma as never, async () => {
      vue = transactionAuditee();
      return null;
    }, 'conflit');
    expect(vue).toBe(tx);
  });

  it('chaque reprise après conflit voit sa propre transaction, pas la précédente', async () => {
    const vues: unknown[] = [];
    let n = 0;
    const prisma = {
      $transaction: jest.fn(async (f: (t: unknown) => unknown) => {
        n += 1;
        const tx = { tentative: n };
        const r = await f(tx);
        if (n === 1) throw new Prisma.PrismaClientKnownRequestError('conflit', { code: 'P2034', clientVersion: 'x' });
        return r;
      }),
    };
    await avecRetrySerialisable(prisma as never, async () => {
      vues.push(transactionAuditee());
      return null;
    }, 'conflit');
    expect(vues).toEqual([{ tentative: 1 }, { tentative: 2 }]);
  });

  it('hors de la transaction, rien n’est déclaré', async () => {
    const prisma = { $transaction: jest.fn(async (f: (t: unknown) => unknown) => f({})) };
    await avecRetrySerialisable(prisma as never, async () => null, 'conflit');
    expect(transactionAuditee()).toBeUndefined();
  });

  it('un conflit de sérialisation du MAILLON (40001 en requête brute, enveloppé) est rejoué, pas rendu en 500', async () => {
    let n = 0;
    const prisma = {
      $transaction: jest.fn(async (f: (t: unknown) => unknown) => {
        n += 1;
        if (n === 1) {
          const brut = new Prisma.PrismaClientKnownRequestError('could not serialize access', {
            code: 'P2010',
            clientVersion: 'x',
            meta: { code: '40001' },
          });
          // La VRAIE erreur de l'extension d'audit · sa cause doit rester lisible.
          throw new ErreurMaillonDansTransaction('Ecriture', 'create', brut);
        }
        return f({});
      }),
    };
    await expect(avecRetrySerialisable(prisma as never, async () => 'ok', 'conflit')).resolves.toBe('ok');
    expect(n).toBe(2);
  });

  it('un interblocage (40P01) rendu en erreur INCONNUE est un conflit à rejouer (relecture TypeScript, MAJEUR 2)', () => {
    const tuee = new Prisma.PrismaClientUnknownRequestError(
      'ConnectorError(ConnectorError { kind: QueryError(PostgresError { code: "40P01", message: "deadlock detected" }) })',
      { clientVersion: 'x' },
    );
    expect(estConflitDeSerialisation(tuee)).toBe(true);
    expect(estConflitDeSerialisation(Object.assign(new Error('x'), { cause: tuee }))).toBe(true);
    expect(estConflitDeSerialisation(new Prisma.PrismaClientUnknownRequestError('autre chose', { clientVersion: 'x' }))).toBe(false);
    // Sur une requête BRUTE (le verrou du maillon), Prisma rend P2010 avec l'état SQL en meta.code (second tour, Z2bis).
    const brute = new Prisma.PrismaClientKnownRequestError('Raw query failed. Code: `40P01`. Message: `deadlock detected`', {
      code: 'P2010',
      clientVersion: 'x',
      meta: { code: '40P01', message: 'ERROR: deadlock detected' },
    });
    expect(estConflitDeSerialisation(brute)).toBe(true);
    const autreBrute = new Prisma.PrismaClientKnownRequestError('Raw query failed', { code: 'P2010', clientVersion: 'x', meta: { code: '23505' } });
    expect(estConflitDeSerialisation(autreBrute)).toBe(false);
  });

  it('une autre erreur brute n’est pas prise pour un conflit', () => {
    const autre = new Prisma.PrismaClientKnownRequestError('x', { code: 'P2010', clientVersion: 'x', meta: { code: '23505' } });
    expect(estConflitDeSerialisation(Object.assign(new Error('e'), { cause: autre }))).toBe(false);
  });
});

describe('la reprise après conflit (ligne k6-defauts, test de charge § 4.4)', () => {
  it('huit tentatives, délai croissant et largement aléatoire · deux reprises reparties ensemble se dispersent', () => {
    expect(TENTATIVES_MAX).toBe(8);
    expect(delaiDeReprise(1, () => 0)).toBe(20);
    expect(delaiDeReprise(7, () => 0)).toBe(140);
    expect(delaiDeReprise(1, () => 0.999)).toBeLessThan(60);
    expect(delaiDeReprise(7, () => 0.999)).toBeLessThan(420);
    expect(delaiDeReprise(3, () => 0.5)).not.toBe(delaiDeReprise(3, () => 0.25));
    // Au pire, de l'ordre de deux secondes cumulées avant le 409.
    let cumul = 0;
    for (let t = 1; t < TENTATIVES_MAX; t++) cumul += delaiDeReprise(t, () => 0.999);
    expect(cumul).toBeLessThan(2000);
  });
});

describe('le 409 à bout de tentatives porte son code (ligne k6-defauts, relecture B1 et M4)', () => {
  it('message lisible ET code structuré · c’est le code, jamais le texte, que l’interface rejoue', async () => {
    // Une transaction qui tombe en conflit à chaque tentative, sans attente réelle.
    const conflit = new Prisma.PrismaClientKnownRequestError('conflit', { code: 'P2034', clientVersion: 'x' });
    const prisma = { $transaction: jest.fn(async () => { throw conflit; }) };
    jest.useFakeTimers();
    const promesse = avecRetrySerialisable(prisma as never, async () => 1, 'Trop d’écritures au même instant · réessayez.');
    const attente = expect(promesse).rejects.toBeInstanceOf(ConflictException);
    await jest.runAllTimersAsync();
    await attente;
    jest.useRealTimers();
    const erreur = (await promesse.catch((e: unknown) => e)) as ConflictException;
    expect(erreur.message).toBe('Trop d’écritures au même instant · réessayez.');
    expect(erreur.getResponse()).toEqual({ message: 'Trop d’écritures au même instant · réessayez.', code: CODE_CONFLIT_SERIALISATION });
    expect(CODE_CONFLIT_SERIALISATION).toBe('CONFLIT_SERIALISATION');
    expect(prisma.$transaction).toHaveBeenCalledTimes(TENTATIVES_MAX);
  });
});
