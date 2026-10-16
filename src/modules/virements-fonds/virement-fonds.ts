import { NaturePieceVirement, OperationVirementFonds, Referentiel, SensVirementFonds } from '@prisma/client';

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
 * DEUX OPÉRATIONS, DEUX PIÈCES (demande de Manasse du 2026-10-16) · la SORTIE
 * des fonds au journal d'origine, leur ENTRÉE au journal de destination, et
 * chaque écriture s'appuie sur SA pièce, nature, référence et date (AUDCIF
 * art. 17, 3° et 5° · « pièces datées », « les références de la pièce
 * justificative qui l'appuie » ; art. 22, 7°, « chaque enregistrement
 * s'appuie sur une pièce justificative » ; non écartés par l'art. 3 du
 * SYCEBNL, qui n'exclut de l'art. 17 que ses alinéas 7 et 8). Chaque écriture
 * est DATÉE PAR SA PIÈCE (art. 16, al. 2 · « celle de l'émission par l'entité
 * de la pièce justificative de l'opération, ou celle de la réception des
 * pièces d'origine externe ») · la sortie et l'entrée peuvent tomber à deux
 * jours, le 585 attendant l'entrée entre les deux (sa raison d'être), jamais
 * l'entrée avant la sortie. Le PORTEUR des espèces, dès qu'une caisse est en
 * jeu, est une exigence d'OmegaX · le texte ne le nomme pas, et l'écran le dit.
 */

/** 57 · caisse ; tout autre compte de trésorerie d'un journal · banque et assimilés (52, 53, 55, 581, 582). */
export function estUneCaisse(numeroCompte: string): boolean {
  return numeroCompte.startsWith('57');
}

/**
 * LA TRÉSORERIE EN DEVISES, par plan · les comptes que chaque plan sème « en
 * devises » (SYSCOHADA 52150000 « Banques en devises », 57120000 « Caisse en
 * devises », 57220000 et 57320000 « En devises » ; SYCEBNL 52150000
 * « Banques locales · devises », 57200000 « Caisse · devises »), relus dans
 * les deux semis par le spec. Une caisse ne porte jamais de RIB
 * (`banques/banques.ts`) : la devise d'un compte ne se lit donc pas sur son
 * seul RIB. Un virement de fonds en francs sur l'un d'eux sortirait de la
 * position en devise, que la réévaluation de clôture lit ligne à ligne
 * (AUDCIF art. 54 et 57), et fausserait la disponibilité au bilan.
 */
export const RACINES_TRESORERIE_EN_DEVISES: Readonly<Record<Referentiel, readonly string[]>> = {
  SYSCOHADA: ['5215', '5712', '5722', '5732'],
  SYCEBNL: ['5215', '572'],
};

export function estTresorerieEnDevises(numeroCompte: string, referentiel: Referentiel): boolean {
  return RACINES_TRESORERIE_EN_DEVISES[referentiel].some((r) => numeroCompte.startsWith(r));
}

/**
 * AU CENTIME, sans seuil · un écart fixe (1e-6) passait sous la résolution
 * d'un flottant au-delà d'environ 134 millions, et refusait des montants
 * justes (136 620 326,98).
 */
export function estAuCentime(montant: number): boolean {
  return Math.round(montant * 100) / 100 === montant;
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

export const LIBELLES_OPERATION: Readonly<Record<OperationVirementFonds, string>> = {
  SORTIE: 'sortie des fonds',
  ENTREE: 'entrée des fonds',
};

/** « de la sortie des fonds », « de l'entrée des fonds » · l'article s'élide devant la voyelle. */
export function deLOperation(operation: OperationVirementFonds): string {
  return operation === OperationVirementFonds.SORTIE ? 'de la sortie des fonds' : "de l'entrée des fonds";
}

/** « à la sortie des fonds », « à l'entrée des fonds ». */
export function aLOperation(operation: OperationVirementFonds): string {
  return operation === OperationVirementFonds.SORTIE ? 'à la sortie des fonds' : "à l'entrée des fonds";
}

export const LIBELLES_NATURE_PIECE: Readonly<Record<NaturePieceVirement, string>> = {
  BORDEREAU_VERSEMENT: 'Bordereau de versement',
  CHEQUE: 'Chèque',
  ORDRE_VIREMENT: 'Ordre de virement',
  AVIS_DEBIT_CREDIT: 'Avis de débit ou de crédit',
  BON_CAISSE: 'Bon de caisse',
  AUTRE: 'Autre pièce',
  BON_SORTIE_CAISSE: 'Bon de sortie de caisse',
  BON_ENTREE_CAISSE: "Bon d'entrée de caisse",
  AVIS_DEBIT: 'Avis de débit',
  AVIS_CREDIT: 'Avis de crédit',
  EXTRAIT_COMPTE: 'Extrait de compte',
  BORDEREAU_REMISE_CHEQUE: 'Bordereau de remise de chèque',
};

/**
 * LES PIÈCES PROPOSÉES SELON LA TRÉSORERIE ET L'OPÉRATION (demande de Manasse
 * du 2026-10-16, listes choisies par lui) · tableau des pièces de trésorerie
 * du CPCC (organisation comptable, opérations de trésorerie, lignes
 * « Caisses » · « bon de sortie caisse », « bon d'entrée de caisse » ; et
 * « Banques » · avis de débit et de crédit, extraits, bordereau de remise de
 * chèque), complété des pièces que le dossier remplit lui-même au guichet
 * (ordre de virement, chèque de retrait, bordereau de versement). « Autre
 * pièce » reste en dernier · aucun texte ne ferme la liste (AUDCIF art. 17).
 * « Avis de débit ou de crédit » et « Bon de caisse », d'avant, se lisent
 * encore sur les virements passés et ne se proposent plus.
 */
export const NATURES_PROPOSEES: Readonly<
  Record<'BANQUE' | 'CAISSE', Readonly<Record<OperationVirementFonds, readonly NaturePieceVirement[]>>>
> = {
  CAISSE: {
    SORTIE: [NaturePieceVirement.BON_SORTIE_CAISSE, NaturePieceVirement.AUTRE],
    ENTREE: [NaturePieceVirement.BON_ENTREE_CAISSE, NaturePieceVirement.AUTRE],
  },
  BANQUE: {
    SORTIE: [
      NaturePieceVirement.ORDRE_VIREMENT,
      NaturePieceVirement.CHEQUE,
      NaturePieceVirement.AVIS_DEBIT,
      NaturePieceVirement.EXTRAIT_COMPTE,
      NaturePieceVirement.AUTRE,
    ],
    ENTREE: [
      NaturePieceVirement.BORDEREAU_VERSEMENT,
      NaturePieceVirement.BORDEREAU_REMISE_CHEQUE,
      NaturePieceVirement.AVIS_CREDIT,
      NaturePieceVirement.EXTRAIT_COMPTE,
      NaturePieceVirement.AUTRE,
    ],
  },
};

/** Les pièces d'une opération · la sortie se lit sur la trésorerie d'origine, l'entrée sur celle de destination. */
export function naturesProposees(sens: SensVirementFonds, operation: OperationVirementFonds): readonly NaturePieceVirement[] {
  const [origine, destination] = sens.split('_') as ['BANQUE' | 'CAISSE', 'BANQUE' | 'CAISSE'];
  return NATURES_PROPOSEES[operation === OperationVirementFonds.SORTIE ? origine : destination][operation];
}

export interface JournalDeTresorerie {
  id: string;
  code: string;
  type: string;
  estActif: boolean;
  compteTresorerie: { id: string; numero: string; intitule: string } | null;
}

/**
 * La pièce d'une opération TELLE QUE REÇUE · rien n'en est jugé à la porte, un
 * champ peut manquer ou ne pas être un texte, une clé de trop s'y glisser. Ses
 * champs sont donc `unknown` · un `.trim()` posé ailleurs sur un nombre reçu
 * tomberait en 500 (relecture TypeScript, mineur 1). La règle les juge ici,
 * où le refus nomme l'opération.
 */
export interface PieceRecue {
  nature?: unknown;
  reference?: unknown;
  date?: unknown;
}

/** La pièce d'une opération JUGÉE · ce qui s'écrit. */
export interface PieceOperation {
  nature: NaturePieceVirement;
  reference: string;
  /** Le jour, AAAA-MM-JJ. */
  date: string;
}

/** Les seules clés d'une pièce · une autre est refusée, nommée, jamais ignorée en silence. */
const CHAMPS_PIECE: readonly string[] = ['nature', 'reference', 'date'];

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * LE JOUR, ET UN JOUR QUI EXISTE · « 2026-02-30 » avait la forme et tombait
 * en 500 à l'écriture ; une heure ou une semaine ISO n'est pas un jour.
 */
export function estUnJour(texte: string): boolean {
  if (!JOUR.test(texte)) return false;
  const d = new Date(`${texte}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texte;
}

const NATURES_ADMISES: readonly unknown[] = Object.values(NaturePieceVirement);

/** Une nature du schéma · la garde que la règle et le service partagent, jamais un cast. */
export function estNaturePiece(v: unknown): v is NaturePieceVirement {
  return NATURES_ADMISES.includes(v);
}

/**
 * La pièce typée, ou `null` si un de ses champs n'est pas ce qu'il doit être ·
 * la référence rognée. Le refus nommé vient de `motifRefusVirement`.
 */
export function pieceJugee(p: PieceRecue): PieceOperation | null {
  if (!estNaturePiece(p.nature) || typeof p.reference !== 'string' || typeof p.date !== 'string') return null;
  const reference = p.reference.trim();
  if (!reference || reference.length > 100 || !estUnJour(p.date)) return null;
  return { nature: p.nature, reference, date: p.date };
}

export interface DemandeVirement {
  montant: number;
  objet: string;
  sortie: PieceRecue;
  entree: PieceRecue;
  porteur: string | null | undefined;
}

/**
 * LES REFUS QUI NE LISENT RIEN · deux journaux de trésorerie actifs et
 * distincts, chacun avec son compte, deux comptes distincts, un montant
 * positif au centime, la pièce de chaque opération et un objet écrits,
 * l'entrée jamais avant la sortie, le porteur des espèces dès qu'une caisse
 * est en jeu. `null` si rien ne s'y oppose.
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
  if (!estAuCentime(demande.montant)) return 'Le montant se saisit au centime près.';
  if (!demande.objet.trim()) return "L'objet du virement est exigé · il dit pourquoi les fonds changent de place.";
  // LES REFUS DE LA PIÈCE SE DISENT ICI, l'opération nommée · posés au DTO
  // imbriqué, la validation les rendait préfixés « sortie. » ou « entree. ».
  for (const [piece, operation] of [
    [demande.sortie, OperationVirementFonds.SORTIE],
    [demande.entree, OperationVirementFonds.ENTREE],
  ] as const) {
    // UNE CLÉ DE TROP SE DIT (relecture TypeScript, mineur 3) · la porte ne
    // descend pas dans l'objet, et une faute de frappe (« reférence ») passait
    // pour une clé ignorée.
    const deTrop = Object.keys(piece).filter((cle) => !CHAMPS_PIECE.includes(cle));
    if (deTrop.length) {
      return `La pièce ${deLOperation(operation)} ne porte que sa nature, sa référence et sa date · ${deTrop.join(', ')} n'y est pas admis.`;
    }
    if (!estNaturePiece(piece.nature)) return `Choisissez la nature de la pièce ${deLOperation(operation)}.`;
    if (typeof piece.reference !== 'string' || !piece.reference.trim()) {
      return `La référence de la pièce ${deLOperation(operation)} est exigée · chaque écriture porte les références de la pièce qui l’appuie (AUDCIF art. 17, 5°).`;
    }
    if (piece.reference.trim().length > 100) return `La référence de la pièce ${deLOperation(operation)} se saisit en 100 caractères au plus.`;
    if (typeof piece.date !== 'string' || !estUnJour(piece.date)) return `La date de la pièce ${deLOperation(operation)} se donne au jour (AAAA-MM-JJ).`;
  }
  // Toutes deux jugées · `pieceJugee` les rend typées.
  const sortie = pieceJugee(demande.sortie)!;
  const entree = pieceJugee(demande.entree)!;
  // Le jour s'écrit AAAA-MM-JJ · l'ordre des chaînes est celui des dates.
  if (entree.date < sortie.date) {
    return "L'entrée des fonds est datée avant leur sortie · chaque écriture prend la date de sa pièce (AUDCIF art. 16, al. 2), et les fonds n'arrivent pas avant d'être partis.";
  }
  const sens = sensDuVirement(origine.compteTresorerie!.numero, destination.compteTresorerie!.numero);
  // LA PIÈCE SUIT SA TRÉSORERIE · masquer à l'écran n'est pas refuser, un
  // « Bon de sortie de caisse » sur une sortie de banque se refuse ici.
  for (const [piece, operation] of [
    [sortie, OperationVirementFonds.SORTIE],
    [entree, OperationVirementFonds.ENTREE],
  ] as const) {
    const admises = naturesProposees(sens, operation);
    if (!admises.includes(piece.nature)) {
      const tresorerie = (operation === OperationVirementFonds.SORTIE ? sens.split('_')[0] : sens.split('_')[1]) === 'CAISSE' ? 'caisse' : 'banque';
      return `La pièce ${deLOperation(operation)} d'une ${tresorerie} se choisit parmi · ${admises.map((n) => LIBELLES_NATURE_PIECE[n]).join(', ')}.`;
    }
  }
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
