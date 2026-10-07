import { JeuEtatsFinanciersSycebnl, Referentiel, TypeCompteDetailTotal } from '@prisma/client';

/**
 * LE COMPTE DE TRÉSORERIE QUI PORTE LA CONTREPARTIE DE L'ÉTAT (cas chiffrés
 * de la clôture, question Q2 et constat N7, 2026-10-07).
 *
 * Au tableau emplois-ressources d'un projet, FU, FV et FW (début) et FX, FY
 * et FZ (fin) se lisent tous sur « comptes 51, 52, 53, 55, 57 », la seule
 * différence étant la nature du fonds · bailleur, contrepartie de l'État,
 * autres (SYCEBNL, guide d'application, Application 21). Aucun texte ne dit
 * quel compte porte quel fonds · le plan subdivise le 52 par lieu et par
 * monnaie, le 57 par monnaie, jamais par source de financement. C'est donc
 * une CONVENTION D'OMEGAX, déclarée par le cabinet sur le compte, dite à
 * l'écran, jamais déduite (ni d'un intitulé, ni d'un mouvement du 163 ou du
 * 463).
 *
 * Trois refus · hors d'un dossier SYCEBNL « projets de développement » (le
 * tableau n'existe pas ailleurs) ; sur un compte qui n'est pas de trésorerie
 * (51, 52, 53, 55, 57) ou qui est un TOTAL ; sur un compte rattaché à un
 * bailleur (`Compte.bailleurId`, FU et FX) · un compte ne porte qu'une
 * nature de fonds.
 */
export const COMPTES_DE_FONDS_PROJET = ['51', '52', '53', '55', '57'];

export function motifRefusFondsContrepartieEtat(c: {
  referentiel: Referentiel;
  jeu: JeuEtatsFinanciersSycebnl | null;
  numero: string;
  typeCompte: TypeCompteDetailTotal;
  bailleurId: string | null;
}): string | null {
  if (c.referentiel !== Referentiel.SYCEBNL || c.jeu !== JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT) {
    return "La contrepartie de l'État ne se déclare que dans un dossier SYCEBNL « projets de développement », seul à tenir le tableau emplois-ressources.";
  }
  if (!COMPTES_DE_FONDS_PROJET.some((p) => c.numero.startsWith(p))) {
    return `Le compte ${c.numero} n'est pas un compte de trésorerie du tableau emplois-ressources (comptes 51, 52, 53, 55, 57).`;
  }
  if (c.typeCompte === TypeCompteDetailTotal.TOTAL) {
    return `Le compte ${c.numero} est un compte Total · la contrepartie de l'État se déclare sur le compte de détail qui la porte.`;
  }
  if (c.bailleurId) {
    return `Le compte ${c.numero} est rattaché à un bailleur (fonds bailleur, FU et FX) · un compte ne porte qu'une nature de fonds. Détachez-le du bailleur d'abord.`;
  }
  return null;
}
