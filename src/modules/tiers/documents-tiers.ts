/**
 * DOCUMENTS ATTACHÉS AUX TIERS (point 21 de la comparaison Sage i7).
 *
 * Les règles de la pièce (type lu dans les octets, 5 Mo, téléchargement seul,
 * empreinte SHA-256, nom tronqué par points de code) sont celles de toutes les
 * pièces jointes d'OmegaX, écrites UNE fois dans
 * `common/pieces-jointes/pieces-jointes.ts` (ligne sage-l6, fonction n° 22).
 * Ce fichier les réexporte pour les documents des tiers et les pièces des
 * virements de fonds, qui les employaient avant leur mise en commun · leurs
 * routes et leurs tests ne changent pas.
 */
export {
  TAILLE_MAX_DOCUMENT,
  LONGUEUR_MAX_COMMENTAIRE,
  LONGUEUR_MAX_NOM,
  TYPES_ADMIS,
  nettoyerNomFichier,
  decoderNomMultipart,
  identifierType,
  motifRefusDocument,
  empreinteDocument,
  dispositionTelechargement,
} from '../../common/pieces-jointes/pieces-jointes';
export type { PieceDeposee } from '../../common/pieces-jointes/pieces-jointes';
