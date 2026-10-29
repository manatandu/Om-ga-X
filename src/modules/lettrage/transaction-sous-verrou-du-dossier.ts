import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ATTENTE_VERROU_DOSSIER_MS,
  CODE_DOSSIER_OCCUPE,
  estAttenteDeVerrouExpiree,
  MESSAGE_DOSSIER_OCCUPE,
  prendreLeVerrouDuDossier,
} from '../../common/audit/extension-audit';
import { ClientTransactionnel, transactionJournalisee } from '../../common/audit/transaction-journalisee';
import {
  CODE_CONFLIT_SERIALISATION,
  delaiDeReprise,
  delaiSelonVolume,
  estConflitDeSerialisation,
  estDoublonDeCodeDeLettrage,
  TENTATIVES_MAX,
} from '../../common/prisma-retry.util';

/**
 * LE LETTRAGE SE SÉRIALISE PAR DOSSIER, PLUS PAR PRÉDICAT (test de charge
 * § 4.4, banc k6 du 2026-10-29).
 *
 * En isolation SERIALIZABLE, PostgreSQL pose ses verrous de lecture au niveau
 * de la PAGE d'index, et ces pages sont partagées par tous les cabinets · au
 * banc, vingt-quatre lettrages ont été refusés (« Trop de lettrages effectués
 * au même instant ») alors que chaque cabinet lettrait ses paires UNE À UNE.
 * Le conflit opposait deux dossiers sans rapport, et le lettrage refusé
 * laissait des lignes ouvertes chez un fournisseur que l'utilisateur croyait
 * soldé.
 *
 * Ce que l'isolation sérialisable protégeait se protège ici par le verrou
 * consultatif du DOSSIER, pris en PREMIER, la transaction en lecture validée
 * (READ COMMITTED) · c'est le verrou que le journal d'audit prend à chaque
 * écriture auditée et garde jusqu'à la validation (`prendreLeVerrouDuDossier`,
 * même clé). `Lettrage`, `Cloture`, `Exercice` et `CreanceDouteuse` sont
 * audités · un autre lettrage, une clôture qui fige les lignes, le
 * reclassement d'une créance ne peuvent donc ni se valider pendant les
 * contrôles de celui-ci, ni l'avoir précédé sans qu'il les lise (chaque
 * instruction relit l'état validé). La prise concurrente des lignes reste
 * gardée par `creerGroupe` (mise à jour sur `lettrageId` nul, nombre relu).
 *
 * Deux dossiers ne s'attendent plus par les pages d'index · seule une
 * collision de `hashtext` (32 bits) en ferait attendre deux, sans autre effet
 * qu'un délai. L'ATTENTE DU VERROU EST BORNÉE (`lock_timeout`, la même borne
 * que l'audit) · derrière un lettrage automatique long du même dossier, le
 * geste reçoit le 409 nommé `DOSSIER_OCCUPE`, que l'interface rejoue, au lieu
 * d'expirer en 500 en retenant une connexion du pool partagé par tous les
 * cabinets. Un interblocage avec une transaction qui a verrouillé des lignes
 * AVANT ce verrou est abattu par PostgreSQL (40P01) et rejoué.
 */

/**
 * LES TRANSACTIONS SÉRIALISABLES QUI LISENT LE LETTRAGE (relecture de la ligne
 * lettrage-verrou, 2026-10-29, BLOQUANT 1). PostgreSQL ne surveille les
 * conflits lecture-écriture qu'entre transactions SERIALIZABLE · la CLÔTURE,
 * restée sérialisable, figeait son image avant ce lettrage, lisait les lignes
 * ouvertes, et reportait au Détail en N+1 une facture et son règlement que N
 * venait de lettrer · balance bouclée, relances et balance âgée fausses, sans
 * un mot. Le lettrage RÉÉCRIT donc, sans en changer une valeur, la ligne de
 * chaque exercice OUVERT du dossier · la clôture écrit toujours la sienne (son
 * statut), et une transaction sérialisable qui met à jour une ligne qu'une
 * autre a réécrite après son image tombe en 40001, que `avecRetrySerialisable`
 * rejoue sur une image qui voit le lettrage. En requête brute · ni journal
 * d'audit (aucune valeur ne change), ni garde de cloisonnement à juger (la
 * borne du dossier est dans la requête).
 */
async function marquerLesExercicesOuverts(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  await tx.$executeRaw`UPDATE "exercices" SET "statut" = "statut" WHERE "tenantId" = ${tenantId} AND "statut" = 'OUVERT'::"StatutExercice"`;
}

export async function transactionSousVerrouDuDossier<T>(
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
          const resultat = await fn(tx);
          await marquerLesExercicesOuverts(tx, tenantId);
          return resultat;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          // Le délai de la transaction compte l'attente du verrou · jamais
          // les cinq secondes par défaut de Prisma, qu'une attente de trois
          // secondes et un geste ordinaire suffiraient à dépasser.
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
  throw new Error('Échec inattendu de la transaction sous verrou du dossier');
}
