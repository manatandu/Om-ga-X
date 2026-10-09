import { NaturePieceVirement, SensVirementFonds } from '@prisma/client';

/**
 * VIREMENT DE FONDS (demande de Manasse du 2026-10-09) · d'une banque ou d'une
 * caisse vers une autre, banque à banque, banque à caisse, caisse à banque ou
 * caisse à caisse, chacune tenue par son journal de trésorerie et son compte
 * personnalisé.
 *
 * LE COMPTE DE PASSAGE EST LE 585, JAMAIS LE 581 · la demande citait le 581.
 * Au SYSCOHADA, c'est celui des « Régies d'avance » (AUDCIF Titre VII, compte
 * 58 · « fonds gérés par les régisseurs ») ; le SYCEBNL n'en ouvre aucun. Les
 * deux plans rangent le virement au 585 « Virements de fonds » · « comptes de
 * passage utiles à la comptabilisation d'opérations internes à l'entité »,
 * « débité, en cours d'exercice, du montant correspondant à un débit à porter
 * dans un compte support d'un journal auxiliaire, par le crédit des comptes
 * de trésorerie », « soldés au terme de leur utilisation » (AUDCIF Titre VII ;
 * SYCEBNL Partie 2 ch. 3, même compte). Quatre sous-comptes, un par sens,
 * personnalisés par défaut (décision de Manasse) ; chaque virement les solde,
 * ses deux pièces naissant ensemble.
 *
 * DEUX PIÈCES, UNE PAR JOURNAL · le journal d'origine D 585 / C sa trésorerie,
 * le journal de destination D sa trésorerie / C 585, à la même date · le 585
 * revient à zéro au virement même, et la centralisation des journaux ne compte
 * jamais deux fois la même somme (la raison d'être du compte de passage).
 *
 * LA PIÈCE JUSTIFICATIVE SE DÉCLARE · nature, référence et date (AUDCIF art.
 * 17, 3° et 5° · « pièces datées », « les références de la pièce
 * justificative qui l'appuie » ; non écartés par l'art. 3 du SYCEBNL, qui
 * n'exclut de l'art. 17 que ses alinéas 7 et 8). Le PORTEUR des espèces, dès
 * qu'une caisse est en jeu, est une exigence d'OmegaX · le texte ne le nomme
 * pas, et l'écran le dit.
 */

/** 57 · caisse ; tout autre compte de trésorerie d'un journal · banque et assimilés (52, 53, 55, 581, 582). */
export function estUneCaisse(numeroCompte: string): boolean {
  return numeroCompte.startsWith('57');
}

export function sensDuVirement(numeroOrigine: string, numeroDestination: string): SensVirementFonds {
  const o = estUneCaisse(numeroOrigine) ? 'CAISSE' : 'BANQUE';
  const d = estUneCaisse(numeroDestination) ? 'CAISSE' : 'BANQUE';
  return `${o}_${d}` as SensVirementFonds;
}

export function caisseEnJeu(sens: SensVirementFonds): boolean {
  return sens !== SensVirementFonds.BANQUE_BANQUE;
}

/** Les quatre comptes de passage · rang sous le 585 et intitulé, semés et migrés aux mêmes valeurs. */
export const COMPTES_DE_PASSAGE: Readonly<Record<SensVirementFonds, { rang: number; intitule: string }>> = {
  BANQUE_BANQUE: { rang: 1, intitule: 'Virements de fonds · banque vers banque' },
  BANQUE_CAISSE: { rang: 2, intitule: 'Virements de fonds · banque vers caisse' },
  CAISSE_BANQUE: { rang: 3, intitule: 'Virements de fonds · caisse vers banque' },
  CAISSE_CAISSE: { rang: 4, intitule: 'Virements de fonds · caisse vers caisse' },
};

/** Le compte du plan sous lequel naissent les comptes de passage, semé par les deux plans. */
export const COMPTE_DU_PLAN_585 = '58500000';
export const RACINE_585 = '585';

export const LIBELLES_SENS: Readonly<Record<SensVirementFonds, string>> = {
  BANQUE_BANQUE: 'banque vers banque',
  BANQUE_CAISSE: 'banque vers caisse',
  CAISSE_BANQUE: 'caisse vers banque',
  CAISSE_CAISSE: 'caisse vers caisse',
};

export const LIBELLES_NATURE_PIECE: Readonly<Record<NaturePieceVirement, string>> = {
  BORDEREAU_VERSEMENT: 'Bordereau de versement',
  CHEQUE: 'Chèque',
  ORDRE_VIREMENT: 'Ordre de virement',
  AVIS_DEBIT_CREDIT: 'Avis de débit ou de crédit',
  BON_CAISSE: 'Bon de caisse',
  AUTRE: 'Autre pièce',
};

export interface JournalDeTresorerie {
  id: string;
  code: string;
  type: string;
  estActif: boolean;
  compteTresorerie: { id: string; numero: string; intitule: string } | null;
}

export interface DemandeVirement {
  montant: number;
  objet: string;
  referencePiece: string;
  porteur: string | null | undefined;
}

/**
 * LES REFUS QUI NE LISENT RIEN · deux journaux de trésorerie actifs et
 * distincts, chacun avec son compte, deux comptes distincts, un montant
 * positif au centime, une pièce et un objet écrits, le porteur des espèces
 * dès qu'une caisse est en jeu. `null` si rien ne s'y oppose.
 */
export function motifRefusVirement(
  origine: JournalDeTresorerie | null,
  destination: JournalDeTresorerie | null,
  demande: DemandeVirement,
): string | null {
  if (!origine || !destination) return 'Journal introuvable pour ce dossier.';
  for (const j of [origine, destination]) {
    if (j.type !== 'TRESORERIE') {
      return `Le journal ${j.code} n'est pas un journal de banque ou de caisse · un virement de fonds va d'un journal de trésorerie à un autre.`;
    }
    if (!j.estActif) return `Le journal ${j.code} est en sommeil · réactivez-le avant d'y passer un virement.`;
    if (!j.compteTresorerie) return `Le journal ${j.code} n'a pas de compte de trésorerie · rattachez-lui son compte dans Journaux.`;
  }
  if (origine.id === destination.id) return 'Le journal d’origine et le journal de destination sont le même · un virement va d’une trésorerie à une autre.';
  if (origine.compteTresorerie!.id === destination.compteTresorerie!.id) {
    return `Les deux journaux portent le même compte ${origine.compteTresorerie!.numero} · un virement entre eux ne déplacerait rien.`;
  }
  if (!Number.isFinite(demande.montant) || demande.montant <= 0) return 'Le montant du virement doit être positif.';
  if (Math.abs(demande.montant * 100 - Math.round(demande.montant * 100)) > 1e-6) return 'Le montant se saisit au centime près.';
  if (!demande.objet.trim()) return "L'objet du virement est exigé · il dit pourquoi les fonds changent de place.";
  if (!demande.referencePiece.trim()) {
    return 'La référence de la pièce justificative est exigée · une écriture porte les références de la pièce qui l’appuie (AUDCIF art. 17, 5°).';
  }
  const sens = sensDuVirement(origine.compteTresorerie!.numero, destination.compteTresorerie!.numero);
  if (caisseEnJeu(sens) && !(demande.porteur ?? '').trim()) {
    return 'Une caisse est en jeu · nommez la personne qui a déposé ou retiré les espèces (porteur).';
  }
  return null;
}

/** Les deux pièces · origine D 585 / C sa trésorerie ; destination D sa trésorerie / C 585. */
export function lignesDuVirement(entree: {
  compteOrigineId: string;
  compteDestinationId: string;
  comptePassageId: string;
  montant: number;
  libelle: string;
}) {
  const { compteOrigineId, compteDestinationId, comptePassageId, montant, libelle } = entree;
  return {
    origine: [
      { compteId: comptePassageId, debit: montant, credit: 0, libelle },
      { compteId: compteOrigineId, debit: 0, credit: montant, libelle },
    ],
    destination: [
      { compteId: compteDestinationId, debit: montant, credit: 0, libelle },
      { compteId: comptePassageId, debit: 0, credit: montant, libelle },
    ],
  };
}
