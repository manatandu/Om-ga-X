import { ConflictException } from '@nestjs/common';
import { prendreLeVerrouDuDossierBorne } from '../../common/transaction-de-saisie';
import { Prisma } from '@prisma/client';
import { CODE_DOSSIER_OCCUPE, estAttenteDeVerrouExpiree, MESSAGE_DOSSIER_OCCUPE } from '../../common/audit/extension-audit';
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
 * lettrage-verrou, 2026-10-29, BLOQUANT 1) · le lettrage réécrivait la ligne de
 * chaque exercice ouvert pour faire tomber la clôture sérialisable en 40001.
 * RETIRÉ (ligne saisie-serialisable, second tour, point 5) · la clôture et le
 * provisoire tournent en lecture validée sous ce même verrou du dossier, pris
 * en tête ; le lettrage qui le tient les fait attendre, et ils lisent ensuite
 * ce qu'il a validé. La réécriture ne protégeait plus rien et coûtait une mise
 * à jour par geste.
 */
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
          // L'attente bornée au seul verrou du dossier (saisie-serialisable,
          // second tour, point 5) · posée pour toute la transaction, elle
          // bornait aussi les verrous de lignes que le lettrage prend ensuite.
          await prendreLeVerrouDuDossierBorne(tx, tenantId);
          return fn(tx);
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
