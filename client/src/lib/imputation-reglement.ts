import { montant } from './montants';

/**
 * LA PART DE CHAQUE FACTURE DANS UN RÈGLEMENT FOURNISSEUR (Code civil,
 * Livre III, art. 151 ; décision par la loi du 2026-10-07, point 4, jumeau 3).
 * Le dossier qui paie déclare quelle facture il acquitte · la part saisie pour
 * chaque facture cochée part au serveur (`imputation`), qui la rejoue et pose
 * une ligne au 40 par facture. Aucune part saisie · rien n'est envoyé, et un
 * règlement partiel de plusieurs factures suit l'imputation légale (art. 154),
 * ce que le serveur dit. Le montant réglé devient la somme des parts.
 *
 * UNE SEULE RÈGLE POUR L'AFFICHAGE, LE TOTAL ET L'ENVOI (relecture du
 * 2026-10-07, mineurs écran) · `partsServies` dit si le champ « Part » existe,
 * `imputationDuReglement` lit les parts, `montantRegle` lit « Réglé ».
 */

/** Une facture cochée d'un tiers, telle que l'écran la tient. */
export interface FactureCochee {
  id: string;
  /** Le dû de la facture. */
  montant: number;
  journalCode?: string;
  numeroPiece?: number | null;
  libelle?: string;
  deviseId?: string | null;
  regleParLettrageACheval?: { groupe: string; montant: number } | null;
}

/** Le nom d'une facture dans un motif ou une étiquette · sa pièce, sinon son libellé. */
export function nomDeFacture(l: FactureCochee): string {
  if (l.numeroPiece !== null && l.numeroPiece !== undefined) return `pièce ${[l.journalCode, l.numeroPiece].filter(Boolean).join(' ')}`;
  return l.libelle ? `« ${l.libelle} »` : 'la facture';
}

/**
 * Une saisie lue en montant · vide, illisible ou nombre. Distinctes, pour que
 * le motif dise laquelle (« illisible » n'est pas « non positif »).
 */
export function lireMontant(saisie: string | undefined): { vide: true } | { illisible: string } | { valeur: number } {
  const brute = (saisie ?? '').trim();
  if (brute === '') return { vide: true };
  const propre = brute.replace(/\s/g, '').replace(',', '.');
  const n = Number(propre);
  return Number.isFinite(n) ? { valeur: Math.round(n * 100) / 100 } : { illisible: brute };
}

/**
 * LE CHAMP « PART » EXISTE-T-IL POUR CE TIERS ? Fournisseur seulement, deux
 * factures cochées au moins, aucune en devise (le règlement porte alors une
 * seule ligne au tiers avec son écart réalisé), aucune réglée en partie à
 * cheval (elle se règle seule) · le serveur refuse les mêmes cas
 * (`motifRefusImputationReglement`). Le motif, quand il y en a un, se DIT
 * sous le tiers · jamais un champ qui disparaît sans un mot.
 */
export function partsServies(e: { sens: 'FOURNISSEUR' | 'CLIENT'; cochees: ReadonlyArray<FactureCochee> }): { servies: boolean; motif: string | null } {
  if (e.sens !== 'FOURNISSEUR' || e.cochees.length < 2) return { servies: false, motif: null };
  if (e.cochees.some((l) => l.deviseId)) {
    return {
      servies: false,
      motif: 'Facture en devise · le règlement porte une seule ligne au tiers avec son écart réalisé ; réglez ces factures une à une pour désigner la part de chacune.',
    };
  }
  if (e.cochees.some((l) => l.regleParLettrageACheval)) {
    return {
      servies: false,
      motif: 'Une ligne d’à-nouveau réglée en partie à cheval se règle seule · retirez-la de ce règlement pour désigner les parts des autres.',
    };
  }
  return { servies: true, motif: null };
}

/** Le motif propre à la part d'une facture, s'il y en a un (champ en erreur). */
export function motifDePart(l: FactureCochee, saisie: string | undefined): string | null {
  const lu = lireMontant(saisie);
  if ('vide' in lu) return null;
  if ('illisible' in lu) return `La part de ${nomDeFacture(l)} est illisible (« ${lu.illisible} »).`;
  if (!(lu.valeur > 0)) return `La part de ${nomDeFacture(l)} doit être un montant strictement positif.`;
  if (lu.valeur > Math.round(l.montant * 100) / 100) return `La part de ${nomDeFacture(l)} (${montant(lu.valeur)}) dépasse son dû (${montant(l.montant)}).`;
  return null;
}

/** « Réglé » lu · vide (le dû entier), illisible ou non positif (motif), ou le montant. */
export function montantRegle(saisie: string | undefined): { montant?: number; motif?: string } {
  const lu = lireMontant(saisie);
  if ('vide' in lu) return {};
  if ('illisible' in lu) return { motif: `Le montant réglé est illisible (« ${lu.illisible} »).` };
  if (!(lu.valeur > 0)) return { motif: 'Le montant réglé doit être un montant strictement positif.' };
  return { montant: lu.valeur };
}

/** La somme des parts saisies et lisibles · montrée à côté de « Réglé ». */
export function sommeDesParts(lignes: ReadonlyArray<FactureCochee>, parts: Readonly<Record<string, string | undefined>>): number | null {
  let total = 0;
  let une = false;
  for (const l of lignes) {
    const lu = lireMontant(parts[l.id]);
    if ('valeur' in lu) {
      total += lu.valeur;
      une = true;
    }
  }
  return une ? Math.round(total * 100) / 100 : null;
}

export function imputationDuReglement(e: {
  lignes: ReadonlyArray<FactureCochee>;
  parts: Readonly<Record<string, string | undefined>>;
  montantSaisi: string | undefined;
}): { imputation?: Array<{ ligneId: string; montant: number }>; montant?: number; motif?: string } {
  const remplies = e.lignes.filter((l) => !('vide' in lireMontant(e.parts[l.id])));
  if (remplies.length === 0) return {};
  if (remplies.length !== e.lignes.length) {
    return { motif: 'Donnez la part de chaque facture cochée, ou d’aucune.' };
  }
  const imputation: Array<{ ligneId: string; montant: number }> = [];
  for (const l of e.lignes) {
    const motif = motifDePart(l, e.parts[l.id]);
    if (motif) return { motif };
    const lu = lireMontant(e.parts[l.id]) as { valeur: number };
    imputation.push({ ligneId: l.id, montant: lu.valeur });
  }
  const total = Math.round(imputation.reduce((t, x) => t + x.montant, 0) * 100) / 100;
  const regle = montantRegle(e.montantSaisi);
  if (regle.motif) return { motif: regle.motif };
  if (regle.montant !== undefined && Math.round(regle.montant * 100) !== Math.round(total * 100)) {
    return { motif: `La somme des parts (${montant(total)}) diffère du montant réglé (${montant(regle.montant)}).` };
  }
  return { imputation, montant: total };
}

/**
 * UNE PART SAISIE NE DISPARAÎT PAS SANS UN MOT (relecture du 2026-10-07,
 * mineur écran). Quand une case se décoche, les parts des factures décochées
 * partent avec elles ; s'il ne reste qu'UNE facture cochée et que sa part
 * était saisie, elle est reprise dans « Réglé » (vide), ou retirée si
 * « Réglé » est déjà rempli · et un constat le dit.
 */
export function reprendreLesParts(e: {
  /** Toutes les factures du tiers. */
  lignes: ReadonlyArray<FactureCochee>;
  /** Les factures du tiers qui restent cochées. */
  restantes: ReadonlyArray<FactureCochee>;
  parts: Readonly<Record<string, string | undefined>>;
  montantSaisi: string | undefined;
}): { parts: Record<string, string>; montantSaisi: string | undefined; constat: string | null } {
  const restantes = new Set(e.restantes.map((l) => l.id));
  const parts: Record<string, string> = {};
  for (const [id, v] of Object.entries(e.parts)) {
    if (v === undefined) continue;
    const duTiers = e.lignes.some((l) => l.id === id);
    if (!duTiers || (restantes.has(id) && e.restantes.length >= 2)) parts[id] = v;
  }
  if (e.restantes.length !== 1) return { parts, montantSaisi: e.montantSaisi, constat: null };
  const seule = e.restantes[0];
  const saisie = (e.parts[seule.id] ?? '').trim();
  if (saisie === '') return { parts, montantSaisi: e.montantSaisi, constat: null };
  if ((e.montantSaisi ?? '').trim() === '') {
    return { parts, montantSaisi: saisie, constat: `La part saisie de ${nomDeFacture(seule)} (${saisie}) est reprise dans « Réglé ».` };
  }
  return {
    parts,
    montantSaisi: e.montantSaisi,
    constat: `La part saisie de ${nomDeFacture(seule)} (${saisie}) est retirée · « Réglé » garde ${e.montantSaisi!.trim()}.`,
  };
}

/**
 * L'IMPUTATION SE NOTIFIE AU FOURNISSEUR (Code civil, Livre III, art. 151 ;
 * relecture du 2026-10-07, M6) · l'ordre de virement l'imprime, sinon la
 * pièce qui la lui a notifiée est exigée, comme au serveur.
 */
export function motifPieceImputation(e: { avecParts: boolean; ordreVirement: boolean; pieceImputation: string | undefined }): string | null {
  if (!e.avecParts || e.ordreVirement) return null;
  if ((e.pieceImputation ?? '').trim().length >= 3) return null;
  return 'Préparez l’ordre de virement, qui imprime chaque facture et sa part, ou donnez la pièce qui a notifié l’imputation au fournisseur (lettre, courriel).';
}
