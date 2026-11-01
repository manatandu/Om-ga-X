import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { horsCloisonnement } from '../../common/cloisonnement/contexte-cloisonnement';
import { ActeurAudit, dansContexteAudit } from '../../common/audit/contexte-audit';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { DECOMPTE_REMIS_A_ZERO } from './verrouillage';
import { secondFacteurLeveParReinitialisation } from './double-authentification';
import { acteurDuCompte, aDesAppartenances, verrouillerLeCompte } from './compte-de-connexion';

/**
 * RÉINITIALISER LE COMPTE D'UNE PERSONNE QUI A PLUSIEURS DOSSIERS (ligne
 * multi-dossiers, second tour de relecture, BLOQUANT 1).
 *
 * Le premier tour fermait tout geste d'administrateur sur la connexion d'une
 * personne qui a d'autres dossiers (C1) · un administrateur ne doit pas
 * CONNAÎTRE le mot de passe qui ouvre les dossiers d'un autre client. Mais
 * plus personne ne pouvait la dépanner · un oubli de mot de passe la laissait
 * dehors pour toujours. Le geste rouvert ne donne rien à l'administrateur ·
 * le mot de passe est TIRÉ AU SORT par le serveur et part à la SEULE adresse
 * du compte (`envoyerUnSecret`, jamais la file en clair), le changement est
 * exigé à la première connexion, toutes les sessions de la personne tombent.
 * L'administrateur apprend que c'est parti, rien d'autre.
 *
 * Le SECOND FACTEUR ne tombe pas par ce geste · un administrateur qui le
 * lèverait, avec un accès à la boîte de la personne, tiendrait tout. Il ne
 * se lève que par l'opérateur de la plateforme, et sur site par
 * l'administrateur de l'installation, qui tient le poste.
 */
export const ORIGINE_REINITIALISATION_PAR_COURRIEL = 'REINITIALISATION_PAR_COURRIEL';

export function avisReinitialisationParCourriel(
  motDePasseProvisoire: string,
  secondFacteurLeve: boolean,
): { sujet: string; corps: string; corpsGarde: string } {
  const texte = (mot: string) =>
    'Bonjour,\n\n' +
    "L'accès à votre compte OmegaX a été réinitialisé, à la demande d'un administrateur d'un de vos dossiers.\n\n" +
    `Mot de passe provisoire · ${mot}\n\n` +
    'Il vous sera demandé de le changer à votre première connexion. Vos sessions ouvertes ont été fermées' +
    (secondFacteurLeve ? ', et la double authentification devra être réactivée.' : '.') +
    "\n\nPersonne d'autre que vous n'a reçu ce mot de passe. Si vous n'attendiez pas ce message, changez-le dès votre connexion.\n";
  return {
    sujet: 'OmegaX · votre mot de passe provisoire',
    corps: texte(motDePasseProvisoire),
    corpsGarde: texte('[remis au seul destinataire, non conservé]'),
  };
}

/** Le verrou du compte, autour d'un geste · `verrouillerLeCompte` (`compte-de-connexion.ts`). */
export function sousVerrouDuCompte<T>(
  prisma: PrismaService,
  compte: { id: string; tenantId: string },
  raison: string,
  geste: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return horsCloisonnement(raison, () =>
    transactionJournalisee(prisma, async (tx) => {
      await verrouillerLeCompte(tx, compte);
      return geste(tx);
    }),
  );
}

export { aDesAppartenances };

/**
 * LE COMPTE REÇOIT SON MOT DE PASSE PROVISOIRE · sous l'acteur qu'est la
 * personne dans son dossier d'origine (`acteurDuCompte`) · un administrateur
 * d'un AUTRE dossier n'entre pas, par son nom, dans la chaîne de ce dossier-là
 * (il y dirait l'existence du sien) ; son geste est écrit dans la chaîne de
 * SON dossier, par la ligne qu'il y ferme.
 */
export async function poserLeProvisoire(
  tx: Prisma.TransactionClient,
  compte: User,
  motDePasseHache: string,
  leverSecondFacteur: boolean,
  maintenant: Date,
  acteur: ActeurAudit = acteurDuCompte(compte),
): Promise<void> {
  await dansContexteAudit(acteur, async () => {
    await tx.user.update({
      where: { id: compte.id },
      data: {
        motDePasse: motDePasseHache,
        doitChangerMotDePasse: true,
        sessionsInvalidesAvant: maintenant,
        sessionsDuCompteInvalidesAvant: maintenant,
        ...DECOMPTE_REMIS_A_ZERO,
        ...(leverSecondFacteur ? secondFacteurLeveParReinitialisation(compte) : {}),
      },
    });
  });
}
