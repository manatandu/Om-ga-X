import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma.service';

/**
 * LES OBJETS QUI REÇOIVENT UNE PIÈCE, ET CE QUE CHACUN DÉCIDE CHEZ LUI
 * (ligne sage-l6, fonction n° 22).
 *
 * Le mécanisme (type lu dans les octets, 5 Mo, empreinte, téléchargement
 * seul, journal d'audit sans le binaire, restitution à part) est commun et
 * vit ici ; ce qui dépend de l'objet vit dans SON module, sous la forme d'une
 * `RegleDesPieces` · l'écriture dans `comptabilite/`, la section dans
 * `analytique/`, le bien dans `immobilisations/`, le salarié dans
 * `personnel/`. Chacun dit si l'objet existe dans le dossier, comment il se
 * décrit, si une pièce peut s'y déposer et si elle peut s'en retirer.
 */
export type ObjetDesPieces = 'ECRITURE' | 'SECTION' | 'IMMOBILISATION' | 'SALARIE';

/** Une transaction ou le client Prisma · la règle lit par le même que le geste. */
export type LecteurDesPieces = Prisma.TransactionClient | PrismaService;

export interface ObjetLu {
  /** Ce que la pièce justifie, dit en une ligne (journal et numéro, code et intitulé). */
  description: string;
  /** Le motif qui refuse un DÉPÔT sur cet objet, ou null. */
  motifRefusDepot: string | null;
  /** Le motif qui refuse de RETIRER une pièce de cet objet, ou null. */
  motifRefusRetrait: string | null;
  /**
   * Le motif qui refuse dépôt ET retrait à CET acteur (403), ou null · les
   * journaux autorisés pour la pièce d'une écriture (mineur 6 de la relecture).
   * La consultation et le téléchargement ne le lisent pas.
   */
  motifHorsPerimetre?: string | null;
}

export interface RegleDesPieces {
  objet: ObjetDesPieces;
  /** « cette écriture », « cette section » · pour les refus. */
  designation: string;
  /**
   * L'objet du dossier et ce qu'il permet, ou null s'il n'existe pas dans le
   * dossier. Appelée DANS la transaction du retrait, après le verrou que la
   * règle pose (`verrouiller`), pour que la réponse soit encore vraie au
   * moment où la pièce part.
   */
  lireObjet(db: LecteurDesPieces, tenantId: string, objetId: string): Promise<ObjetLu | null>;
  /**
   * Le verrou à poser en tête de la transaction du retrait, quand le droit de
   * retirer dépend d'un état de l'objet qu'un autre geste peut changer
   * (l'écriture validée entre la lecture et le retrait). Facultatif.
   */
  verrouiller?(db: LecteurDesPieces, tenantId: string, objetId: string): Promise<void>;
  /**
   * Le motif qui refuse à CET acteur de retirer une pièce DÉTACHÉE (objet
   * retiré depuis), ou null. Facultatif.
   */
  motifHorsPerimetreDetachee?(): string | null;
}

/**
 * Les quatre tables, une par objet · la clé de chacune et son délégué.
 * Écrite UNE fois ; le service ne connaît que cette table, jamais un nom de
 * colonne recopié.
 */
export const TABLES_DES_PIECES: Readonly<Record<ObjetDesPieces, { delegue: string; colonne: string }>> = {
  ECRITURE: { delegue: 'pieceJointeEcriture', colonne: 'ecritureId' },
  SECTION: { delegue: 'pieceJointeSection', colonne: 'sectionId' },
  IMMOBILISATION: { delegue: 'pieceJointeImmobilisation', colonne: 'immobilisationId' },
  SALARIE: { delegue: 'pieceJointeSalarie', colonne: 'salarieId' },
};

/**
 * Combien de pièces une liste rend au plus pour un objet · convention
 * d'OmegaX (CLAUDE.md § 8 bis, aucune collection sans borne). Au-delà, la
 * liste le DIT (`tronque`, `total`).
 */
export const PLAFOND_PIECES_PAR_LISTE = 200;
