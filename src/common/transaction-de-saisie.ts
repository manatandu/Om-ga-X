import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ATTENTE_VERROU_DOSSIER_MS,
  CODE_DOSSIER_OCCUPE,
  estAttenteDeVerrouExpiree,
  MESSAGE_DOSSIER_OCCUPE,
  prendreLeVerrouDuDossier,
} from './audit/extension-audit';
import { ClientTransactionnel, transactionJournalisee } from './audit/transaction-journalisee';
import {
  CODE_CONFLIT_SERIALISATION,
  delaiDeReprise,
  delaiSelonVolume,
  estConflitDeSerialisation,
  estDoublonDeCodeDeLettrage,
  TENTATIVES_MAX,
} from './prisma-retry.util';

/**
 * LES GESTES QUI ÉCRIVENT DES ÉCRITURES SE SÉRIALISENT PAR DOSSIER, PLUS PAR
 * PRÉDICAT (ligne saisie-serialisable, 2026-10-30 · test de charge § 4.4).
 *
 * En isolation SERIALIZABLE, PostgreSQL pose ses verrous de lecture au niveau
 * de la PAGE des index partagés par tous les cabinets. Mesuré sur vraie base
 * (`scripts/rejouer-saisie-concurrente.cjs`) · vingt dossiers saisissant
 * chacun ses pièces UNE À UNE faisaient près d'un rejeu par pièce, et de 1,3 à
 * 2,3 % des pièces étaient refusées en 409 à cause d'un AUTRE dossier ; la
 * clôture de N, sérialisable, tombait huit fois de suite en 40001 pendant que
 * quatre postes saisissaient N+1, le cas normal (mesure 7).
 *
 * La transaction est en lecture validée (READ COMMITTED), et ce que
 * l'isolation sérialisable protégeait tient par le VERROU CONSULTATIF DU
 * DOSSIER, PRIS EN PREMIER · celui que le journal d'audit prend à chaque
 * écriture auditée (`Ecriture`, `Exercice`, `Cloture`, `Lettrage`…) et garde
 * jusqu'à la validation. Tous les gestes qui écrivent les écritures, leurs
 * lignes, leur lettrage ou leur pointage le prennent avant leurs lectures
 * décisives · la saisie et ses variantes (ici), la clôture, les à-nouveaux
 * provisoires, la dissolution, le rapprochement et le pointage (ici aussi), le
 * lettrage (`lettrage/transaction-sous-verrou-du-dossier.ts`), la validation
 * par période, le visa, les pièces jointes et la ventilation
 * (`prendreLeVerrouDuDossierBorne`), et toute pièce numérotée ou non
 * (`prochainNumeroPiece`, qui relit en plus l'exercice ouvert sous ce verrou).
 * Ce qui a pris le verrou voit, instruction par instruction, tout ce que les
 * autres ont validé ; ce qui ne l'a pas encore attend sa libération. Plus
 * aucune transaction sérialisable ne demeure, et plus aucune marque des
 * exercices n'est nécessaire pour la faire tomber.
 *
 * Deux dossiers ne s'attendent plus · seule une collision de `hashtext`
 * (32 bits) en ferait attendre deux, sans autre effet qu'un délai. Un
 * interblocage avec une transaction qui a verrouillé des lignes AVANT ce
 * verrou est abattu par PostgreSQL (40P01) et rejoué, comme le doublon du code
 * d'un lettrage qu'un module pose dans la même transaction. Un rejeu n'est
 * jamais un 500.
 */

/**
 * LE VERROU DU DOSSIER, ATTENTE BORNÉE À LUI SEUL (relecture de la ligne,
 * point 8) · `lock_timeout` posé pour la seule attente du verrou du dossier,
 * puis rendu à sa valeur par défaut · posé pour toute la transaction, il
 * bornait aussi les verrous de lignes que le geste prend ensuite, et un geste
 * juste tombait en 409 derrière une ligne tenue une seconde de trop. Au-delà
 * de la borne, le 409 nommé `DOSSIER_OCCUPE`, que l'écran rejoue et dont le
 * message dit ce qui tient le dossier (validation par période, import,
 * clôture) · la connexion n'attend pas plus que la borne.
 *
 * À PRENDRE EN TÊTE DE TOUTE TRANSACTION QUI VERROUILLE DES ÉCRITURES OU DES
 * EXERCICES (point 1) · la validation par période, le visa, les pièces jointes,
 * la ventilation prenaient leurs lignes `FOR UPDATE` ou `FOR SHARE` AVANT ce
 * verrou, la saisie le prend AVANT ses lignes · deux ordres inverses
 * s'interbloquaient. Un seul ordre partout · le dossier, puis les lignes.
 */
export async function prendreLeVerrouDuDossierBorne(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  try {
    // `SET` ne prend aucun paramètre lié · la valeur est une constante du
    // module, jamais une donnée.
    await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = ${Prisma.raw(String(ATTENTE_VERROU_DOSSIER_MS))}`);
    await prendreLeVerrouDuDossier(tx, tenantId);
    await tx.$executeRaw`SET LOCAL lock_timeout TO DEFAULT`;
  } catch (err) {
    if (estAttenteDeVerrouExpiree(err)) throw new ConflictException({ message: MESSAGE_DOSSIER_OCCUPE, code: CODE_DOSSIER_OCCUPE });
    throw err;
  }
}

export async function transactionDeSaisie<T>(
  prisma: ClientTransactionnel,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  messageConflit: string,
  options: { operations?: number } = {},
): Promise<T> {
  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative++) {
    try {
      return await transactionJournalisee(
        prisma,
        async (tx) => {
          await prendreLeVerrouDuDossierBorne(tx, tenantId);
          return fn(tx);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          // Le délai compte l'attente du verrou · jamais les cinq secondes
          // par défaut de Prisma, qu'une attente de trois secondes et un geste
          // ordinaire suffiraient à dépasser.
          maxWait: 10_000,
          timeout: delaiSelonVolume(options.operations ?? 0),
        },
      );
    } catch (err) {
      if (estAttenteDeVerrouExpiree(err)) throw new ConflictException({ message: MESSAGE_DOSSIER_OCCUPE, code: CODE_DOSSIER_OCCUPE });
      if (!estConflitDeSerialisation(err) && !estDoublonDeCodeDeLettrage(err)) throw err;
      if (tentative === TENTATIVES_MAX) throw new ConflictException({ message: messageConflit, code: CODE_CONFLIT_SERIALISATION });
      await new Promise((r) => setTimeout(r, delaiDeReprise(tentative)));
    }
  }
  throw new Error('Échec inattendu de la transaction de saisie');
}
