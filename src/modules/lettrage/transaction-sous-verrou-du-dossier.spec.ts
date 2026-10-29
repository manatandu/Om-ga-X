import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { transactionSousVerrouDuDossier } from './transaction-sous-verrou-du-dossier';
import { CODE_CONFLIT_SERIALISATION, TENTATIVES_MAX } from '../../common/prisma-retry.util';
import { CODE_DOSSIER_OCCUPE } from '../../common/audit/extension-audit';

/**
 * TEST DE CHARGE § 4.4, banc k6 du 2026-10-29 · vingt-quatre lettrages
 * refusés entre cabinets sans rapport, en isolation sérialisable. Le lettrage
 * prend désormais le verrou du dossier EN PREMIER, en lecture validée.
 */

const conflit = () => new Prisma.PrismaClientKnownRequestError('conflit', { code: 'P2034', clientVersion: 'x' });
const doublon = (modelName: string, target: unknown = ['compteId', 'code']) =>
  new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x', meta: { modelName, target } });
const interblocage = () => new Prisma.PrismaClientUnknownRequestError('ERROR: deadlock detected', { clientVersion: 'x' });
const attenteExpiree = () => new Prisma.PrismaClientUnknownRequestError('ERROR: 55P03 canceling statement due to lock timeout', { clientVersion: 'x' });

function client(echecs: unknown[] = []) {
  const journal: string[] = [];
  const options: unknown[] = [];
  const tx = {
    $executeRaw: jest.fn(async (gabarit: TemplateStringsArray | Prisma.Sql, ...valeurs: unknown[]) => {
      journal.push(!Array.isArray(gabarit) && typeof (gabarit as Prisma.Sql).sql === 'string' ? (gabarit as Prisma.Sql).sql : `verrou ${(gabarit as TemplateStringsArray).join('?')} ${valeurs.join(',')}`);
      return 0;
    }),
  };
  return {
    journal,
    options,
    prisma: {
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>, opts?: unknown) => {
        options.push(opts);
        const r = await fn(tx);
        const e = echecs.shift();
        if (e) throw e;
        return r;
      }),
    } as any,
  };
}

describe('le lettrage sous le verrou du dossier', () => {
  it('prend le verrou du dossier AVANT tout autre geste, en lecture validée', async () => {
    const { prisma, journal, options } = client();
    await transactionSousVerrouDuDossier(prisma, 'd-1', async () => {
      journal.push('acte');
      return 'ok';
    }, 'conflit');
    expect(journal).toEqual([
      'SET LOCAL lock_timeout = 3000',
      'verrou SELECT pg_advisory_xact_lock(hashtext(?)) d-1',
      'acte',
      // BLOQUANT 1 · la ligne de chaque exercice ouvert réécrite, pour que la clôture sérialisable qui a lu avant tombe en 40001.
      'verrou UPDATE "exercices" SET "statut" = "statut" WHERE "tenantId" = ? AND "statut" = \'OUVERT\'::"StatutExercice" d-1',
    ]);
    // Le délai de la transaction couvre l'attente du verrou, jamais les cinq secondes de Prisma.
    expect(options[0]).toMatchObject({ isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 });
  });

  it('rejoue un interblocage ou un doublon de code de lettrage, jamais une autre erreur', async () => {
    const r = client([conflit(), interblocage(), doublon('Lettrage'), doublon('Lettrage', 'lettrages_compteId_code_key')]);
    await expect(transactionSousVerrouDuDossier(r.prisma, 'd-1', async () => 'ok', 'conflit')).resolves.toBe('ok');
    expect(r.prisma.$transaction).toHaveBeenCalledTimes(5);

    // L'unicité du groupe reconduit est un doublon de DONNÉE · jamais rejoué.
    const reconduit = client([doublon('Lettrage', ['lettrageReconduitId'])]);
    await expect(transactionSousVerrouDuDossier(reconduit.prisma, 'd-1', async () => 'ok', 'conflit')).rejects.toMatchObject({ code: 'P2002' });
    expect(reconduit.prisma.$transaction).toHaveBeenCalledTimes(1);

    const autre = client([doublon('Tiers')]);
    await expect(transactionSousVerrouDuDossier(autre.prisma, 'd-1', async () => 'ok', 'conflit')).rejects.toMatchObject({ code: 'P2002' });
    expect(autre.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('une attente du verrou expirée est le 409 DOSSIER_OCCUPE, jamais rejouée ici ni rendue en 500', async () => {
    const r = client([attenteExpiree()]);
    const e = await transactionSousVerrouDuDossier(r.prisma, 'd-1', async () => 'ok', 'conflit').catch((x) => x);
    expect(e).toBeInstanceOf(ConflictException);
    expect(e.getResponse()).toMatchObject({ code: CODE_DOSSIER_OCCUPE });
    expect(r.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('à bout de tentatives, le 409 nommé que l’interface sait rejouer', async () => {
    const r = client(Array.from({ length: TENTATIVES_MAX }, conflit));
    const e = await transactionSousVerrouDuDossier(r.prisma, 'd-1', async () => 'ok', 'Trop de lettrages').catch((x) => x);
    expect(e).toBeInstanceOf(ConflictException);
    expect(e.getResponse()).toEqual({ message: 'Trop de lettrages', code: CODE_CONFLIT_SERIALISATION });
  }, 20_000);

  it('le service de lettrage ne retourne plus à l’isolation sérialisable', () => {
    const source = readFileSync(join(__dirname, 'lettrage.service.ts'), 'utf-8');
    expect(source).not.toMatch(/avecRetrySerialisable\(/);
    expect(source.match(/transactionSousVerrouDuDossier\(\s*this\.prisma,\s*tenantId,/g)).toHaveLength(6);
  });
});

describe('la clôture et les modules restés sérialisables (relecture lettrage-verrou, M1)', () => {
  it('avecRetrySerialisable rejoue le doublon du code de lettrage, jamais une autre unicité', async () => {
    const { avecRetrySerialisable } = await import('../../common/prisma-retry.util');
    const r = client([doublon('Lettrage')]);
    await expect(avecRetrySerialisable(r.prisma, async () => 'ok', 'conflit')).resolves.toBe('ok');
    expect(r.prisma.$transaction).toHaveBeenCalledTimes(2);
    const autre = client([doublon('Tiers')]);
    await expect(avecRetrySerialisable(autre.prisma, async () => 'ok', 'conflit')).rejects.toMatchObject({ code: 'P2002' });
  });
});
