import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { Prisma } from '@prisma/client';
import { journaliserDansTransaction, transactionAuditee } from './contexte-audit';
import { transactionJournalisee, CODE_SERVEUR_SATURE, estPoolEpuise } from './transaction-journalisee';
import { ServiceUnavailableException } from '@nestjs/common';

/**
 * AUDIT FINAL F159 · toute transaction du serveur porte son journal d'audit.
 *
 * Hors de `journaliserDansTransaction`, le maillon d'un acte partait par une
 * connexion à part · il survivait à l'annulation de l'acte, et la chaîne
 * attestait une écriture qui n'a jamais existé. Deux transactions l'oubliaient
 * encore, et rien n'empêchait la suivante de l'oublier.
 */

const RACINE = join(__dirname, '..', '..');

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return nom.endsWith('.ts') && !nom.endsWith('.spec.ts') ? [chemin] : [];
  });
}

/** Le CODE seul · un commentaire qui nomme `$transaction(` ne fait rien. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

/**
 * Les deux seules exceptions, et pourquoi. L'utilitaire lui-même ; et
 * l'écrivain de la chaîne, qui ouvre sa transaction courte sur le client NU
 * pour un maillon hors de tout acte transactionnel (`ajouterMaillon`).
 */
const EXCEPTIONS = new Set(['common/audit/transaction-journalisee.ts', 'common/audit/extension-audit.ts']);

describe('F159 · une seule porte pour une transaction', () => {
  const fichiers = sources(RACINE);

  it('le recensement trouve encore des transactions · un garde-fou qui ne trouve rien ne vérifie rien', () => {
    const appelants = fichiers.filter((f) => /transactionJournalisee\(/.test(sansCommentaires(readFileSync(f, 'utf8'))));
    expect(appelants.length).toBeGreaterThan(15);
  });

  it('aucun fichier du serveur n’ouvre une transaction ailleurs que par transactionJournalisee', () => {
    const fautifs = fichiers
      .map((f) => relative(RACINE, f).split('\\').join('/'))
      .filter((r) => !EXCEPTIONS.has(r))
      .filter((r) => /\.\$transaction\s*\(/.test(sansCommentaires(readFileSync(join(RACINE, r), 'utf8'))));
    expect(fautifs).toEqual([]);
  });

  it('la transaction ouverte est celle que le journal d’audit voit', async () => {
    const tx = { marque: 'tx' } as unknown as Prisma.TransactionClient;
    let vue: unknown;
    const prisma = { $transaction: jest.fn(async (fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)) };
    const rendu = await transactionJournalisee(prisma as never, async (recu) => {
      vue = transactionAuditee();
      return recu;
    });
    expect(vue).toBe(tx);
    expect(rendu).toBe(tx);
    // Hors de la transaction, plus rien n'est déclaré.
    expect(transactionAuditee()).toBeUndefined();
  });

  it('les options passent telles quelles, et leur absence ne passe pas un second argument', async () => {
    const prisma = { $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>, _options?: unknown) => fn({})) };
    await transactionJournalisee(prisma as never, async () => 1, { maxWait: 10_000, timeout: 30_000 });
    await transactionJournalisee(prisma as never, async () => 2);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({ maxWait: 10_000, timeout: 30_000 });
    expect(prisma.$transaction.mock.calls[1]).toHaveLength(1);
  });

  it('le retrait des commentaires ne retire pas le code', () => {
    expect(sansCommentaires("await this.prisma.$transaction([a]); // $transaction(")).toContain('this.prisma.$transaction([a]);');
    expect(sansCommentaires('/* this.prisma.$transaction( */ x')).not.toContain('$transaction');
    expect(sansCommentaires("const u = 'https://exemple.cd'; this.prisma.$transaction(f)")).toContain('$transaction(f)');
  });
});

describe('journaliserDansTransaction et la promesse paresseuse (ligne k6-defauts)', () => {
  it('une promesse dont le `.then` serait appelé hors de la portée voit quand même la transaction', async () => {
    // Le `.then` d'une requête Prisma non attendue est appelé par Prisma une
    // fois la portée refermée · sans abonnement dans la portée, la
    // transaction disparaissait du contexte et le crochet d'audit en ouvrait
    // une autre, à l'infini (rejeu sur vraie base).
    const tx = { nom: 'tx-1' };
    let vuAuThen: unknown = 'jamais';
    const paresseuse = {
      then(ok: (v: number) => void) {
        vuAuThen = transactionAuditee();
        ok(42);
      },
    };
    const r = await journaliserDansTransaction(tx, () => paresseuse as unknown as Promise<number>);
    expect(r).toBe(42);
    expect(vuAuThen).toBe(tx);
    expect(transactionAuditee()).toBeUndefined();
  });

  it('un rejet traverse, et une valeur simple est rendue telle quelle', async () => {
    await expect(journaliserDansTransaction({}, () => Promise.reject(new Error('boum')))).rejects.toThrow('boum');
    expect(journaliserDansTransaction({}, () => 7)).toBe(7);
  });
});

describe('le pool épuisé est un 503 nommé (ligne k6-defauts, relecture M1)', () => {
  const p2028 = (message: string) => new Prisma.PrismaClientKnownRequestError(message, { code: 'P2028', clientVersion: 'x' });

  it('« Unable to start a transaction » devient un 503 au code SERVEUR_SATURE, en français', async () => {
    const prisma = { $transaction: jest.fn(async () => { throw p2028('Transaction API error: Unable to start a transaction in the given time.'); }) };
    const erreur = await transactionJournalisee(prisma as never, async () => 1).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ServiceUnavailableException);
    expect((erreur as ServiceUnavailableException).getResponse()).toEqual(
      expect.objectContaining({ code: CODE_SERVEUR_SATURE, message: expect.stringMatching(/saturé/) }),
    );
  });

  it('un autre P2028 (transaction expirée) et toute autre erreur traversent tels quels', async () => {
    const expiree = p2028('Transaction API error: Transaction already closed');
    expect(estPoolEpuise(expiree)).toBe(false);
    await expect(transactionJournalisee({ $transaction: jest.fn(async () => { throw expiree; }) } as never, async () => 1)).rejects.toBe(expiree);
    const autre = new Error('boum');
    await expect(transactionJournalisee({ $transaction: jest.fn(async () => { throw autre; }) } as never, async () => 1)).rejects.toBe(autre);
  });
});
