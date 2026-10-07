import type { Compte } from './types';

/**
 * LES COMPTES QUI PEUVENT PORTER LA CONTREPARTIE DE L'ÉTAT (cas chiffrés de
 * la clôture, Q2, 2026-10-07) · miroir de `motifRefusFondsContrepartieEtat`
 * du serveur (`src/modules/comptes/fonds-contrepartie-etat.ts`). Le guide
 * (SYCEBNL, Application 21) lit les fonds de début et de fin du tableau
 * emplois-ressources sur « comptes 51, 52, 53, 55, 57 » · aucun texte ne dit
 * lequel porte la contrepartie de l'État, le cabinet le DÉCLARE. Le serveur
 * reste seul juge · cette liste ne fait que proposer les candidats.
 */
export const COMPTES_DE_FONDS_PROJET = ['51', '52', '53', '55', '57'];

export function comptesDeFondsProjet(comptes: Compte[]): Compte[] {
  return comptes.filter((c) => c.typeCompte === 'DETAIL' && COMPTES_DE_FONDS_PROJET.some((p) => c.numero.startsWith(p)));
}
