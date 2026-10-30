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
 * LA SAISIE SE SÉRIALISE PAR DOSSIER, PLUS PAR PRÉDICAT (ligne
 * saisie-serialisable, 2026-10-30 · test de charge § 4.4).
 *
 * En isolation SERIALIZABLE, PostgreSQL pose ses verrous de lecture au niveau
 * de la PAGE des index partagés par tous les cabinets. Mesuré sur vraie base
 * (`scripts/rejouer-saisie-concurrente.cjs`) · vingt dossiers saisissant
 * chacun ses pièces UNE À UNE faisaient près d'un rejeu par pièce, et de 1,3 à
 * 2,3 % des pièces étaient refusées en 409 après les huit tentatives · un
 * cabinet perdait sa saisie à cause d'un autre, sans rapport avec lui.
 *
 * Ce que l'isolation sérialisable protégeait se protège ici autrement, la
 * transaction en lecture validée (READ COMMITTED) :
 *
 *  1. LE VERROU CONSULTATIF DU DOSSIER, PRIS EN PREMIER · celui que le journal
 *     d'audit prend à chaque écriture auditée (`Ecriture`, `Exercice`,
 *     `Cloture`, `Lettrage`… ) et garde jusqu'à la validation. Une autre
 *     saisie, une validation, un lettrage, une clôture du même dossier ne se
 *     valident donc ni pendant les contrôles de celle-ci, ni avant sans
 *     qu'elle les lise · en lecture validée, chaque instruction prise après le
 *     verrou relit l'état validé. Le numéro de pièce se lit dessous
 *     (`prochainNumeroPiece`), et deux pièces ne peuvent plus lire le même
 *     maximum.
 *  2. LES LIGNES DES EXERCICES OUVERTS DU DOSSIER RÉÉCRITES AUSSITÔT, sans
 *     qu'aucune valeur change (même marque que le lettrage,
 *     `lettrage/transaction-sous-verrou-du-dossier.ts`). PostgreSQL ne
 *     surveille les conflits lecture-écriture qu'entre transactions
 *     sérialisables · une CLÔTURE, un à-nouveau provisoire ou un arrêt à la
 *     dissolution, restés sérialisables, qui auraient pris leur image avant
 *     cette saisie ne la verraient pas, et cloraient sur une lecture
 *     périmée. Ils écrivent toujours la ligne de leur exercice · réécrite par
 *     cette saisie validée après leur image, elle les fait tomber en 40001, et
 *     leur reprise relit. Posée EN TÊTE et non en fin · si la clôture a déjà
 *     écrit la ligne de son exercice, la saisie attend sa validation, puis
 *     relit l'exercice clôturé et refuse (`relireLExerciceDansLaTransaction`),
 *     au lieu d'entrer dans un exercice clos.
 *
 * Deux dossiers ne s'attendent plus · seule une collision de `hashtext`
 * (32 bits) en ferait attendre deux, sans autre effet qu'un délai.
 * L'ATTENTE DU VERROU EST BORNÉE (`lock_timeout`, la borne de l'audit) ·
 * derrière un geste long du même dossier (clôture, import), la saisie reçoit le
 * 409 nommé `DOSSIER_OCCUPE`, que l'interface rejoue, au lieu d'expirer en 500
 * en retenant une connexion du pool partagé. Un interblocage avec une
 * transaction qui a verrouillé des lignes AVANT ce verrou est abattu par
 * PostgreSQL (40P01) et rejoué, comme le doublon du code d'un lettrage qu'un
 * module pose dans la même transaction. Un rejeu n'est jamais un 500.
 */
async function marquerLesExercicesOuverts(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  // En requête brute · ni journal d'audit (aucune valeur ne change), ni garde
  // de cloisonnement à juger (la borne du dossier est dans la requête).
  await tx.$executeRaw`UPDATE "exercices" SET "statut" = "statut" WHERE "tenantId" = ${tenantId} AND "statut" = 'OUVERT'::"StatutExercice"`;
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
          // `SET` ne prend aucun paramètre lié · la valeur est une constante
          // du module, jamais une donnée.
          await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = ${Prisma.raw(String(ATTENTE_VERROU_DOSSIER_MS))}`);
          await prendreLeVerrouDuDossier(tx, tenantId);
          await marquerLesExercicesOuverts(tx, tenantId);
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
