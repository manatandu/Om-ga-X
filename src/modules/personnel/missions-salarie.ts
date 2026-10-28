/**
 * MISSIONS ET FRAIS DE MISSION (ligne microfina-m3, idée 3) · règles pures,
 * sans Prisma.
 *
 * L'ORDRE DE MISSION N'EST IMPOSÉ PAR AUCUN TEXTE LU · c'est une pièce de
 * gestion, numérotée par dossier (convention d'OmegaX), qui dit qui part, où,
 * quand et pourquoi. Ce que les textes règlent, c'est le SORT DES FRAIS, et
 * il dépend d'UNE qualification, que le cabinet déclare ligne par ligne :
 *
 *  · LE REMBOURSEMENT D'UNE DÉPENSE EFFECTIVE (« JUSTIFIÉ », sur pièce) ·
 *    loi n° 23/053, art. 68, 1° · sont imposables « les traitements, salaires,
 *    émoluments, indemnités QUI NE REPRÉSENTENT PAS LE REMBOURSEMENT DE
 *    DÉPENSES PROFESSIONNELLES EFFECTIVES » · le remboursement d'une dépense
 *    effective n'est donc pas un revenu imposable. Il n'est pas davantage un
 *    élément de la rémunération · Code du travail, art. 7, point 8, « Ne sont
 *    pas éléments de la rémunération : […] les frais de voyage ainsi que les
 *    avantages accordés exclusivement en vue de faciliter au travailleur
 *    l'accomplissement de ses fonctions ». Il ne passe donc PAS par le
 *    bulletin · il s'y porte comme un REMBOURSEMENT (l'élément marqué
 *    « remboursement de dépense effective » que le moteur des assiettes sort
 *    de l'impôt, `assiettes-paie.ts`), hors des deux assiettes, et entre au
 *    net à payer ; l'effectivité se prouve par la pièce justificative (AUDCIF
 *    art. 17, 3°), exigée.
 *
 *  · L'INDEMNITÉ FORFAITAIRE (« FORFAIT », sans pièce) · elle ne représente
 *    pas une dépense effective · imposable (art. 68, 1°, « quelle que soit leur
 *    qualification »). Elle se porte AU BULLETIN, sous la nature des frais de
 *    voyage et avantages de fonction · hors rémunération sociale (art. 7,
 *    point 8, liste sans condition), dans l'assiette fiscale (art. 68 ; elle
 *    n'est dans aucun point de la liste fermée de l'art. 69). C'est
 *    exactement ce que le moteur des assiettes fait déjà de cette nature
 *    (`assiettes-paie.ts`). Un barème forfaitaire par zone n'est donc jamais
 *    un remboursement présumé.
 *
 *  · LA DÉPENSE RÉGLÉE PAR L'ENTITÉ ELLE-MÊME (« RÉGLÉ PAR L'ENTITÉ » ·
 *    billet ou hôtel facturé à l'entité) · rien n'est dû au travailleur ·
 *    elle se passe par sa facture au journal, et la mission ne la suit que
 *    pour son coût, jamais au bulletin. Pièce exigée.
 *
 * LE COMPTE · « Les frais de voyage, de réception et les diverses dépenses
 * exposées par le personnel dans l'exercice de ses fonctions pour le compte de
 * son employeur, et dont le montant lui est soit remboursé, soit compris dans
 * les rémunérations, doivent en principe être enregistrés en 62 ou 63 »
 * (fiche du compte 66, AUDCIF Titre VII ; SYCEBNL Partie 2 ch. 3, même
 * phrase). Les deux plans ouvrent sous le 638 le 6384 « Missions »
 * (`passation-paie.ts`, rôle MISSIONS, relu dans les deux semis) · les deux
 * branches portées au bulletin y vont par sa passation, remboursement et
 * forfait ; la dépense réglée par l'entité y va par sa facture.
 *
 * LA TVA · « N'ouvre pas droit à déduction, la taxe ayant grevé : 1. les
 * dépenses de logement, d'hébergement, de restauration, de réception, de
 * spectacles, de location de véhicules de tourisme et de transport de
 * personnes » (O.-L. n° 10/001, art. 41, 1°). Hébergement, restauration et
 * transport d'une mission sont dans la liste · la pièce porte la dépense TTC
 * en charge, AUCUNE ligne 445 (la passation de la paie n'en pose jamais). Pour les frais DIVERS, la loi ne tranche pas
 * à partir du seul mot · la pièce les porte TTC sans ligne de taxe, et c'est
 * dit · une TVA déductible sur une facture normalisée au nom de l'entité
 * (décret n° 23/10, art. 25) se passe à la main.
 */

export type ElementFraisMission = 'HEBERGEMENT' | 'RESTAURATION' | 'TRANSPORT' | 'DIVERS';
export type QualificationFraisMission = 'JUSTIFIE' | 'FORFAIT' | 'REGLE_PAR_ENTITE';

export const ELEMENTS_FRAIS_MISSION: readonly ElementFraisMission[] = ['HEBERGEMENT', 'RESTAURATION', 'TRANSPORT', 'DIVERS'];

export const LIBELLE_ELEMENT: Readonly<Record<ElementFraisMission, string>> = {
  HEBERGEMENT: 'Hébergement',
  RESTAURATION: 'Restauration',
  TRANSPORT: 'Transport',
  DIVERS: 'Frais divers',
};

/** Les éléments que l'art. 41, 1° nomme · leur TVA n'ouvre pas droit à déduction. */
export const ELEMENTS_TVA_NON_DEDUCTIBLE_ART_41: readonly ElementFraisMission[] = ['HEBERGEMENT', 'RESTAURATION', 'TRANSPORT'];

export const PLAFOND_FRAIS_PAR_MISSION = 50;

const c = (n: number) => Math.round(n * 100);
const jour = (d: Date | string) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

export function motifRefusMission(m: {
  objet?: string;
  destination?: string;
  dateDepart: string;
  dateRetour: string;
}): string | null {
  if (!m.objet?.trim()) return "L'objet de la mission est obligatoire.";
  if (!m.destination?.trim()) return 'La destination de la mission est obligatoire.';
  if (!/^\d{4}-\d{2}-\d{2}/.test(m.dateDepart) || !/^\d{4}-\d{2}-\d{2}/.test(m.dateRetour)) {
    return 'Les dates de départ et de retour se lisent AAAA-MM-JJ.';
  }
  if (jour(m.dateRetour) < jour(m.dateDepart)) return 'Le retour ne peut précéder le départ.';
  return null;
}

export function motifRefusFrais(f: {
  element: string;
  qualification: string;
  montantFc: number;
  piece?: string | null;
}): string | null {
  if (!ELEMENTS_FRAIS_MISSION.includes(f.element as ElementFraisMission)) return 'Élément de frais inconnu.';
  if (f.qualification !== 'JUSTIFIE' && f.qualification !== 'FORFAIT' && f.qualification !== 'REGLE_PAR_ENTITE') {
    return "Un frais se qualifie · remboursement sur pièce, indemnité forfaitaire, ou dépense réglée par l'entité.";
  }
  if (!(f.montantFc > 0)) return 'Le montant du frais doit être positif.';
  if (f.qualification === 'REGLE_PAR_ENTITE' && !f.piece?.trim()) {
    return "Une dépense réglée par l'entité se suit par sa facture · sa référence est obligatoire (AUDCIF art. 17, 3°).";
  }
  if (f.qualification === 'JUSTIFIE' && !f.piece?.trim()) {
    return (
      "Un remboursement de dépense effective exige sa pièce justificative (AUDCIF art. 17, 3°) · sans elle, la somme " +
      "est une indemnité qui ne représente pas une dépense effective, imposable (loi n° 23/053, art. 68, 1°). " +
      'Qualifiez-la alors de forfait.'
    );
  }
  return null;
}

export type FraisLu = {
  element: ElementFraisMission;
  qualification: QualificationFraisMission;
  montantFc: number;
};

/** Les totaux d'une mission, en centimes entiers · le coût comprend ce que l'entité a réglé elle-même. */
export function totauxMission(frais: readonly FraisLu[]): { justifieFc: number; forfaitFc: number; regleParEntiteFc: number; totalFc: number } {
  const somme = (q: QualificationFraisMission) => frais.filter((x) => x.qualification === q).reduce((s, x) => s + c(x.montantFc), 0);
  const j = somme('JUSTIFIE');
  const f = somme('FORFAIT');
  const e = somme('REGLE_PAR_ENTITE');
  return { justifieFc: j / 100, forfaitFc: f / 100, regleParEntiteFc: e / 100, totalFc: (j + f + e) / 100 };
}

/** Le sort de chaque frais, dit à l'écran avec son texte. */
export function sortDuFrais(f: FraisLu): string {
  const tva = ELEMENTS_TVA_NON_DEDUCTIBLE_ART_41.includes(f.element)
    ? "TVA non déductible (O.-L. n° 10/001, art. 41, 1°)."
    : 'TVA non portée par le module · une taxe déductible sur facture normalisée au nom de l’entité se passe à la main.';
  if (f.qualification === 'REGLE_PAR_ENTITE') {
    return `Dépense réglée par l'entité · rien n'est dû au travailleur, elle se passe par sa facture au journal, jamais au bulletin. ${tva}`;
  }
  return f.qualification === 'JUSTIFIE'
    ? `Remboursement d'une dépense effective · hors rémunération (Code du travail, art. 7, point 8) et hors impôt (loi n° 23/053, art. 68, 1°) · porté au bulletin comme remboursement, passé au 6384. ${tva}`
    : `Indemnité forfaitaire · hors rémunération sociale (art. 7, point 8), imposable (loi n° 23/053, art. 68, 1°) · portée au bulletin, passée au 6384.`;
}

/**
 * LES FRAIS SE PORTENT AU BULLETIN D'UN MOIS QUI NE PRÉCÈDE PAS LE DÉPART ·
 * l'indemnité d'une mission qui n'a pas commencé n'est pas due.
 */
export function motifRefusForfaitAuMois(
  mission: { numero: number; dateDepart: Date | string; annuleLe: Date | null; aPorterFc: number },
  moisDePaie: string,
): string | null {
  if (mission.annuleLe) return `La mission n° ${mission.numero} est annulée · ses frais ne se portent plus.`;
  if (!(mission.aPorterFc > 0)) return `La mission n° ${mission.numero} ne porte aucun frais dû au travailleur.`;
  if (moisDePaie < jour(mission.dateDepart).slice(0, 7)) {
    return `La mission n° ${mission.numero} part le ${jour(mission.dateDepart)} · son forfait ne se porte pas sur la paie de ${moisDePaie}.`;
  }
  return null;
}

export const libelleForfaitMission = (numero: number, destination: string) =>
  `Indemnité forfaitaire de mission n° ${numero} · ${destination}`.slice(0, 150);
export const libelleRemboursementMission = (numero: number, destination: string) =>
  `Remboursement des frais de mission n° ${numero} sur pièces · ${destination}`.slice(0, 150);
