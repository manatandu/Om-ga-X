import type { Logiciel } from '../utilisateurs/logiciels';

/**
 * LA FILE DES COURRIERS, LUE PAR LOGICIEL (ligne commercial-site, relecture du
 * 2026-11-01).
 *
 * La fenêtre du courrier est commune à toutes les tuiles, mais le CORPS d'un
 * message ne l'est pas · une relance cite les créances d'un client, un avis de
 * règlement ce qu'un fournisseur reçoit. Un utilisateur restreint ne voit
 * donc, dans la liste, la cloche, la fiche d'un message et la reprise, que
 * les messages qu'émet un logiciel qui lui est attribué · CE QU'UNE TUILE
 * ÉMET, ELLE LE LIT.
 *
 * TABLE FERMÉE · une origine absente n'est servie à AUCUN utilisateur
 * restreint (jamais présumée lisible), et `origines-par-logiciel.spec.ts` fait
 * tomber le test pour toute constante `ORIGINE_` de `src/` qui n'y est pas
 * rangée. Les messages de compte et de licence (avis d'accès, double
 * authentification, conditions de licence, essai, console) relèvent de
 * l'Administration.
 */
export const LOGICIELS_PAR_ORIGINE: Record<string, readonly Logiciel[]> = {
  RELANCE: ['TIERS_TRESORERIE'],
  AVIS_REGLEMENT: ['TIERS_TRESORERIE'],
  MOT_DE_PASSE_TEMPORAIRE: ['ADMINISTRATION'],
  DOUBLE_AUTHENTIFICATION: ['ADMINISTRATION'],
  CONDITIONS_LICENCE: ['ADMINISTRATION'],
  INSCRIPTION_ESSAI: ['ADMINISTRATION'],
  RAPPEL_SUPPRESSION_ESSAI: ['ADMINISTRATION'],
  LICENCE_SUR_SITE: ['ADMINISTRATION'],
  FACTURE_ABONNEMENT: ['ADMINISTRATION'],
  CREATION_CABINET: ['ADMINISTRATION'],
  REINITIALISATION_ADMIN: ['ADMINISTRATION'],
  DEMANDE_INFORMATION: ['ADMINISTRATION'],
};

/**
 * Les origines qu'un utilisateur lit · `null` quand il n'est pas restreint
 * (toute la file). Une liste vide est une vraie réponse · il ne lit rien.
 */
export function originesLisibles(attribues: readonly Logiciel[] | null): string[] | null {
  if (!attribues) return null;
  return Object.entries(LOGICIELS_PAR_ORIGINE)
    .filter(([, logiciels]) => logiciels.some((l) => attribues.includes(l)))
    .map(([origine]) => origine);
}
