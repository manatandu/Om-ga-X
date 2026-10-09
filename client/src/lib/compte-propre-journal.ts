import { numeroAEnvoyer } from './numero-compte-tiers';

/**
 * LE COMPTE PROPRE D'UN JOURNAL DE BANQUE OU DE CAISSE (décision de Manasse
 * du 2026-10-09) · à la création, le journal OUVRE son compte sous un compte
 * du plan de la classe 5, ou reprend un compte existant. Le serveur propose
 * le numéro (`GET /journaux/compte-propose`) et juge seul le numéro choisi ·
 * l'écran ne recopie pas ses règles.
 */
export type ModeCompteJournal = 'OUVRIR' | 'EXISTANT';

/** Un compte du plan sous lequel ouvrir (`GET /journaux/comptes-du-plan`). */
export interface CompteDuPlan {
  id: string;
  numero: string;
  intitule: string;
}

/** La proposition du serveur · `numero` nul quand rien ne peut s'ouvrir, `motif` dit pourquoi. */
export interface CompteDuJournalPropose {
  numero: string | null;
  racine: string;
  longueur: number;
  compteDuPlan: { numero: string; intitule: string };
  motif: string | null;
}

/**
 * Ce qui part, pour le compte, avec la création d'un journal de trésorerie ·
 * le compte du plan et le numéro choisi, ou le compte existant. Le numéro
 * gardé tel que proposé ne part pas (`numeroAEnvoyer`) · le serveur prend
 * alors le premier libre au moment même.
 */
export function corpsCompteDuJournal(
  mode: ModeCompteJournal,
  choix: { sousId: string; numeroSaisi: string; propose: CompteDuJournalPropose | null; compteTresorerieId: string },
): { ouvrirCompteSousId: string; numeroCompte?: string } | { compteTresorerieId: string } {
  if (mode === 'EXISTANT') return { compteTresorerieId: choix.compteTresorerieId };
  const numeroCompte = numeroAEnvoyer(choix.numeroSaisi, choix.propose);
  return numeroCompte === undefined
    ? { ouvrirCompteSousId: choix.sousId }
    : { ouvrirCompteSousId: choix.sousId, numeroCompte };
}
