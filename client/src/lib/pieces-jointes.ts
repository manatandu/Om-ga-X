/**
 * LES PIÈCES JOINTES, CÔTÉ ÉCRAN (ligne sage-l6, fonction n° 22).
 *
 * Quatre objets reçoivent une pièce, chacun chez lui · l'écriture (saisie et
 * journal), la section analytique (plans analytiques), le bien (fiche de
 * l'immobilisation) et le salarié (registre du personnel). Le serveur juge
 * tout · type lu dans les octets, 5 Mo, doublon, et CE QUE L'OBJET PERMET
 * (déposer, retirer), servi avec la liste (`depot`, `retrait`) et jamais
 * recalculé ici. Ce module ne porte que les adresses de chaque objet et le
 * refus immédiat d'un fichier trop gros, qui épargne une minute de liaison.
 */

export type ObjetDesPieces = 'ECRITURE' | 'SECTION' | 'IMMOBILISATION' | 'SALARIE';

export interface PieceJointe {
  id: string;
  nomFichier: string;
  typeMime: string;
  taille: number;
  commentaire: string | null;
  deposePar: string | null;
  createdAt: string;
}

/** Ce que le serveur rend pour un objet · la liste bornée, et ce que l'objet permet. */
export interface PiecesDeLObjet {
  description: string;
  pieces: PieceJointe[];
  total: number;
  tronque: boolean;
  depot: { permis: boolean; motif: string | null };
  retrait: { permis: boolean; motif: string | null };
}

/** Une pièce d'écriture retirée au brouillard · ce qu'elle justifiait, figé au dépôt. */
export interface PieceDetachee extends PieceJointe {
  ecritureDecrite: string;
}

/** Les routes de chaque objet, écrites UNE fois · celles des contrôleurs du serveur. */
export const ADRESSES_PIECES: Readonly<
  Record<ObjetDesPieces, { liste: (objetId: string) => string; piece: (pieceId: string) => string }>
> = {
  ECRITURE: {
    liste: (id) => `/ecritures/${encodeURIComponent(id)}/pieces-jointes`,
    piece: (id) => `/pieces-jointes-ecritures/${encodeURIComponent(id)}`,
  },
  SECTION: {
    liste: (id) => `/analytique/sections/${encodeURIComponent(id)}/pieces-jointes`,
    piece: (id) => `/pieces-jointes-sections/${encodeURIComponent(id)}`,
  },
  IMMOBILISATION: {
    liste: (id) => `/immobilisations/${encodeURIComponent(id)}/pieces-jointes`,
    piece: (id) => `/pieces-jointes-immobilisations/${encodeURIComponent(id)}`,
  },
  SALARIE: {
    liste: (id) => `/personnel/salaries/${encodeURIComponent(id)}/pieces-jointes`,
    piece: (id) => `/personnel/pieces-jointes/${encodeURIComponent(id)}`,
  },
};

/** Sage i7 · « un commentaire de 69 caractères » · même borne qu'au serveur. */
export const LONGUEUR_COMMENTAIRE_PIECE = 69;
/** 5 Mo · la borne du serveur (`TAILLE_MAX_DOCUMENT`). */
export const TAILLE_MAX_PIECE = 5 * 1024 * 1024;
/** Les formats admis par le serveur · le navigateur les propose d'abord. */
export const FORMATS_PIECE = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx,.doc,.xls';

/** Le refus immédiat d'un fichier trop gros · le serveur refuse de toute façon au-delà. */
export function refusAvantEnvoi(fichier: { size: number }): string | null {
  if (fichier.size === 0) return 'Le fichier est vide.';
  if (fichier.size > TAILLE_MAX_PIECE) {
    return 'Le fichier dépasse 5 Mo · réduisez-le ou numérisez-le en plus basse définition.';
  }
  return null;
}

export function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

/** Le décompte des pièces par écriture · null tant qu'il n'est pas lu, ou s'il est illisible. */
export interface DecomptePieces {
  parEcriture: Record<string, number>;
  tronque: boolean;
}

/**
 * Le nombre de pièces d'une écriture tel que l'écran peut le dire · `null`
 * quand le décompte n'est pas lu, ou qu'il est tronqué et ne porte pas
 * l'écriture (on ne dit jamais « aucune » sur une liste qui n'a pas été lue).
 */
export function piecesDeLEcriture(decompte: DecomptePieces | null, ecritureId: string): number | null {
  if (!decompte) return null;
  const n = decompte.parEcriture[ecritureId];
  if (n !== undefined) return n;
  return decompte.tronque ? null : 0;
}

/**
 * LE DÉCOMPTE ILLISIBLE SE DIT (relecture « échecs silencieux » de la ligne
 * sage-l6, mineur 3) · avalé, l'échec laissait la colonne PJ sans nombre et
 * sans raison, et l'on pouvait croire qu'aucune écriture n'en portait.
 */
export function motifDecompteIllisible(e: unknown): string {
  const motif = e instanceof Error && e.message ? e.message : 'réponse illisible';
  return `Pièces jointes · le décompte de l’exercice n’a pas pu être lu (${motif}). La colonne PJ ne dit aucun nombre tant qu’il ne l’est pas · ouvrez une écriture pour voir ses pièces.`;
}

/**
 * CE QUE LA SUPPRESSION D'UNE ÉCRITURE AU BROUILLARD A DÉTACHÉ (mineur 1) ·
 * ses pièces ne se perdent pas, elles se retrouvent au journal. Un retour
 * sans le nombre (serveur d'avant la ligne) ne dit rien de plus.
 */
export function messageSuppressionBrouillard(piecesDetachees: number | null | undefined): string {
  if (!piecesDetachees) return 'Écriture supprimée du brouillard.';
  const pieces = piecesDetachees === 1 ? '1 pièce jointe détachée' : `${piecesDetachees} pièces jointes détachées`;
  return `Écriture supprimée du brouillard · ${pieces}, à retrouver dans Journal > Pièces détachées.`;
}
