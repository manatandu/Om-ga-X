import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { journaliserDansTransaction } from './contexte-audit';

/**
 * LE POOL ÉPUISÉ EST UN 503 NOMMÉ, JAMAIS UN 500 BRUT (relecture « échecs
 * silencieux » de la ligne k6-defauts, M1). Sous saturation, Prisma ne peut
 * pas ouvrir la transaction dans son délai (`P2028`, « Unable to start a
 * transaction in the given time ») · rien n'a commencé, donc rien n'est
 * écrit par cette transaction, et le message anglais de Prisma partait tel
 * quel à l'écran, compté par Sentry comme une panne. Le refus dit ce qu'il
 * est, porte un code que l'interface peut rejouer comme le 409 de
 * sérialisation (`reprise-conflit.ts`, sur les seules routes à une
 * transaction), et reste un 5xx · l'écran le lit comme une issue incertaine
 * de la REQUÊTE, qui a pu commettre une transaction antérieure.
 */
export const CODE_SERVEUR_SATURE = 'SERVEUR_SATURE';
export const MESSAGE_SERVEUR_SATURE =
  "Le serveur est saturé · cette étape n'a pas été enregistrée ; si votre demande en comptait plusieurs, une étape précédente a pu l'être · relisez le journal, puis réessayez dans un instant.";

export function estPoolEpuise(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2028' &&
    /Unable to start a transaction/i.test(err.message)
  );
}

/**
 * LA SEULE PORTE D'UNE TRANSACTION (audit final F159).
 *
 * Le journal d'audit s'écrit d'ordinaire par une connexion À PART. Dans une
 * transaction, c'est faux deux fois · le maillon d'un acte ANNULÉ survit à
 * l'annulation, et la chaîne atteste une écriture qui n'a jamais existé ; et
 * chaque écriture auditée prend une seconde connexion pendant que la
 * transaction tient la première, ce qui épuise un pool étroit. Déclarée par
 * `journaliserDansTransaction`, la transaction porte le maillon, qui naît et
 * meurt avec l'acte.
 *
 * Deux transactions l'oubliaient encore, et rien n'empêchait la trente-sixième
 * de l'oublier à son tour. Toute transaction du serveur passe donc par cette
 * fonction · `transaction-journalisee.spec.ts` relit les sources et refuse un
 * `$transaction(` écrit ailleurs. La forme TABLEAU de Prisma
 * (`$transaction([a, b])`) n'y a plus sa place · elle exécute un lot sans
 * contexte asynchrone, et son maillon repartait par la connexion à part.
 */
export type ClientTransactionnel = {
  $transaction: <R>(fn: (tx: Prisma.TransactionClient) => Promise<R>, options?: OptionsTransaction) => Promise<R>;
};

export type OptionsTransaction = {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait?: number;
  timeout?: number;
};

export function transactionJournalisee<T>(
  prisma: ClientTransactionnel,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: OptionsTransaction,
): Promise<T> {
  const acte = (tx: Prisma.TransactionClient) => journaliserDansTransaction(tx, () => fn(tx));
  const transaction = options === undefined ? prisma.$transaction(acte) : prisma.$transaction(acte, options);
  return transaction.catch((err: unknown) => {
    if (estPoolEpuise(err)) throw new ServiceUnavailableException({ message: MESSAGE_SERVEUR_SATURE, code: CODE_SERVEUR_SATURE });
    throw err;
  });
}
