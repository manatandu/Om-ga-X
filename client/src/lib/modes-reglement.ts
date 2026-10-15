/**
 * MODES DE RÈGLEMENT (ligne sage-l2, fonction 1) · ce que l'écran sait d'un
 * mode, et rien de plus. Les natures et leurs libellés sont le MIROIR de
 * l'énumération `NatureModeReglement` du schéma et de `LIBELLES_NATURES` du
 * serveur (`src/modules/reglements/modes-reglement.ts`) · le spec relit les
 * deux fichiers et tombe dès qu'ils divergent. La seule règle de droit
 * (O.-L. n° 10/001, art. 59 bis) vit au serveur, qui avertit au règlement.
 */
export type NatureModeReglement =
  | 'ESPECES'
  | 'CHEQUE'
  | 'VIREMENT'
  | 'CARTE_BANCAIRE'
  | 'MONNAIE_ELECTRONIQUE'
  | 'EFFET_DE_COMMERCE'
  | 'PRELEVEMENT'
  | 'AUTRE';

export const LIBELLES_NATURES: Readonly<Record<NatureModeReglement, string>> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  CARTE_BANCAIRE: 'Carte bancaire',
  MONNAIE_ELECTRONIQUE: 'Monnaie électronique',
  EFFET_DE_COMMERCE: 'Effet de commerce',
  PRELEVEMENT: 'Prélèvement',
  AUTRE: 'Autre',
};

/** L'ordre des listes de choix · celui de l'énumération. */
export const NATURES: readonly NatureModeReglement[] = Object.keys(LIBELLES_NATURES) as NatureModeReglement[];

/** Sage, P_REGLEMENT · trente modes au plus, la borne du serveur. */
export const PLAFOND_MODES_REGLEMENT = 30;

export interface ModeReglement {
  id: string;
  code: string;
  intitule: string;
  nature: NatureModeReglement;
  codeInterbancaire: string | null;
  journalId: string | null;
  estActif: boolean;
  journal?: { code: string; intitule: string } | null;
}

/** Ce que la fiche d'un tiers sert de son mode. */
export interface ModeReglementResume {
  id: string;
  code: string;
  intitule: string;
  nature: NatureModeReglement;
  estActif: boolean;
}

export function libelleMode(m: Pick<ModeReglement, 'code' | 'intitule' | 'estActif'>): string {
  return `${m.code} · ${m.intitule}${m.estActif ? '' : ' (en sommeil)'}`;
}

/**
 * LES MODES PROPOSÉS DANS UNE LISTE DE CHOIX · les actifs, et celui déjà
 * posé même s'il est en sommeil · sans lui, la liste afficherait un autre
 * mode (ou rien) à la place de celui que la fiche porte vraiment, et un
 * simple enregistrement l'effacerait. Le serveur refuse de POSER un mode en
 * sommeil, pas de le garder.
 */
export function modesProposables<M extends Pick<ModeReglement, 'id' | 'estActif'>>(modes: readonly M[], choisiId: string | null | undefined): M[] {
  return modes.filter((m) => m.estActif || m.id === choisiId);
}

/**
 * LE JOURNAL QUE LE MODE PROPOSE au règlement · seulement s'il fait partie
 * des journaux offerts (trésorerie active, compte rattaché) · un journal en
 * sommeil depuis ne se présélectionne pas, et le choix en place reste.
 */
export function journalProposeParLeMode(
  mode: Pick<ModeReglement, 'journalId'> | null | undefined,
  journauxOfferts: readonly { id: string }[],
): string | null {
  if (!mode?.journalId) return null;
  return journauxOfferts.some((j) => j.id === mode.journalId) ? mode.journalId : null;
}
