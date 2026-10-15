/**
 * RENUMÉROTATION ET MAINTENANCE DU REGISTRE DES IMMOBILISATIONS (ligne
 * sage-l4, fonction n° 73 · Sage, « Renumérotation » et « Maintenance » du
 * fichier des immobilisations) · les règles pures.
 *
 * LA RENUMÉROTATION ne touche qu'un IDENTIFIANT de registre, le numéro
 * d'inventaire · aucune écriture, aucun montant. Aucun texte lu ne fixe la
 * forme d'un numéro d'inventaire (AUDCIF art. 42 impose le recensement, non
 * une numérotation) · préfixe, premier numéro et largeur sont des choix du
 * cabinet, et l'UNICITÉ est une convention d'OmegaX, celle du code
 * d'immobilisation de Sage · deux biens sous un même numéro ne se distinguent
 * plus à l'inventaire physique. Un bien SORTI garde son numéro · il figure
 * sous lui aux états et au livre d'inventaire des exercices qui l'ont vu, et
 * le renuméroter ferait dire à une réimpression autre chose que le document
 * remis ; son numéro reste compté pour l'unicité.
 *
 * LA MAINTENANCE LIT, ELLE NE CORRIGE RIEN · le registre (ce que les fiches
 * portent, tel que le tableau des amortissements le relit à la clôture de
 * l'exercice) face à la balance, compte par compte. Un écart n'est pas une
 * anomalie (CLAUDE.md § 10 bis, le contrôle qui fabrique une anomalie) · il
 * est NOMMÉ avec les causes que le module connaît, et le cabinet l'explique.
 */

export type OrdreRenumerotation = 'ACQUISITION' | 'COMPTE';
export type PerimetreRenumerotation = 'EN_SERVICE' | 'SANS_NUMERO';

export interface ParametresRenumerotation {
  prefixe: string;
  premierNumero: number;
  largeur: number;
  ordre: OrdreRenumerotation;
  perimetre: PerimetreRenumerotation;
}

/** Ce que la renumérotation lit d'une fiche. */
export interface FicheANumeroter {
  id: string;
  designation: string;
  numeroInventaire: string | null;
  dateAcquisition: Date;
  createdAt: Date;
  sortie: boolean;
  compteNumero: string;
}

export interface Attribution {
  id: string;
  designation: string;
  ancien: string | null;
  nouveau: string;
}

/** La longueur que la colonne admet à la saisie (DTO de la fiche). */
export const LONGUEUR_MAX_NUMERO = 100;
/** Au-delà, un seul geste tiendrait trop longtemps sa transaction · convention d'OmegaX. */
export const PLAFOND_RENUMEROTATION = 5_000;

/** Pourquoi les paramètres ne se lisent pas, ou null. */
export function motifRefusParametres(p: ParametresRenumerotation): string | null {
  if (typeof p.prefixe !== 'string' || p.prefixe.length > 20) return 'Le préfixe tient en vingt caractères au plus.';
  if (!/^[A-Za-z0-9._/-]*$/.test(p.prefixe)) {
    return 'Le préfixe ne prend que des lettres sans accent, des chiffres et les signes « . », « _ », « / », « - ».';
  }
  if (!Number.isInteger(p.premierNumero) || p.premierNumero < 0 || p.premierNumero > 99_999_999) {
    return 'Le premier numéro est un entier de 0 à 99 999 999.';
  }
  if (!Number.isInteger(p.largeur) || p.largeur < 1 || p.largeur > 8) return 'La largeur est de 1 à 8 chiffres.';
  if (p.ordre !== 'ACQUISITION' && p.ordre !== 'COMPTE') return 'Ordre inconnu.';
  if (p.perimetre !== 'EN_SERVICE' && p.perimetre !== 'SANS_NUMERO') return 'Périmètre inconnu.';
  return null;
}

export function numeroForme(p: Pick<ParametresRenumerotation, 'prefixe' | 'largeur'>, n: number): string {
  return `${p.prefixe}${String(n).padStart(p.largeur, '0')}`;
}

/** L'ordre des fiches renumérotées · stable, la saisie départage deux biens du même jour. */
function comparer(ordre: OrdreRenumerotation) {
  return (a: FicheANumeroter, b: FicheANumeroter) => {
    if (ordre === 'COMPTE' && a.compteNumero !== b.compteNumero) return a.compteNumero < b.compteNumero ? -1 : 1;
    const d = a.dateAcquisition.getTime() - b.dateAcquisition.getTime();
    if (d !== 0) return d;
    const c = a.createdAt.getTime() - b.createdAt.getTime();
    if (c !== 0) return c;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

export interface PlanDeRenumerotation {
  attributions: Attribution[];
  /** Numéros nouveaux déjà portés par une fiche HORS du périmètre (sortie, ou numérotée en « sans numéro »). */
  collisions: { numero: string; designation: string }[];
  /** Fiches du périmètre, avant tout refus · le plafond se juge sur lui. */
  nombre: number;
}

/**
 * Le plan · les fiches du périmètre, rangées, reçoivent la suite des numéros.
 * Rien n'est attribué à une fiche qui garde déjà ce numéro (aucune écriture
 * inutile au journal d'audit). Une collision avec un numéro gardé hors du
 * périmètre est NOMMÉE, jamais contournée en sautant un numéro.
 */
export function planDeRenumerotation(fiches: FicheANumeroter[], p: ParametresRenumerotation): PlanDeRenumerotation {
  const dansLePerimetre = (f: FicheANumeroter) =>
    !f.sortie && (p.perimetre === 'EN_SERVICE' || !(f.numeroInventaire ?? '').trim());
  const perimetre = fiches.filter(dansLePerimetre).sort(comparer(p.ordre));
  const gardes = new Map<string, string>();
  for (const f of fiches) {
    const num = (f.numeroInventaire ?? '').trim();
    if (!dansLePerimetre(f) && num) gardes.set(num, f.designation);
  }
  const attributions: Attribution[] = [];
  const collisions: PlanDeRenumerotation['collisions'] = [];
  perimetre.forEach((f, i) => {
    const nouveau = numeroForme(p, p.premierNumero + i);
    const garde = gardes.get(nouveau);
    if (garde !== undefined) collisions.push({ numero: nouveau, designation: garde });
    if ((f.numeroInventaire ?? '').trim() !== nouveau) {
      attributions.push({ id: f.id, designation: f.designation, ancien: f.numeroInventaire, nouveau });
    }
  });
  return { attributions, collisions, nombre: perimetre.length };
}

/** Pourquoi le plan ne s'applique pas, ou null. */
export function motifRefusPlan(plan: PlanDeRenumerotation, p: ParametresRenumerotation): string | null {
  if (plan.nombre === 0) {
    return p.perimetre === 'SANS_NUMERO' ? 'Aucun bien en service sans numéro d’inventaire.' : 'Aucun bien en service à renuméroter.';
  }
  if (plan.nombre > PLAFOND_RENUMEROTATION) {
    return `${plan.nombre} biens · un geste en renumérote ${PLAFOND_RENUMEROTATION} au plus. Renumérotez d’abord les biens sans numéro.`;
  }
  const dernier = numeroForme(p, p.premierNumero + plan.nombre - 1);
  if (String(p.premierNumero + plan.nombre - 1).length > p.largeur) {
    return `La largeur de ${p.largeur} chiffres ne suffit pas · le dernier numéro serait ${dernier}.`;
  }
  if (dernier.length > LONGUEUR_MAX_NUMERO) return 'Le numéro dépasse la longueur admise.';
  if (plan.collisions.length > 0) {
    const nommes = plan.collisions
      .slice(0, 5)
      .map((c) => `${c.numero} (« ${c.designation} »)`)
      .join(', ');
    return (
      `${plan.collisions.length} numéro(s) nouveau(x) déjà porté(s) par un bien hors du périmètre · ${nommes}` +
      `${plan.collisions.length > 5 ? '…' : ''}. Choisissez un autre préfixe ou un autre premier numéro.`
    );
  }
  return null;
}

/**
 * UNE CAMPAGNE D'INVENTAIRE OUVERTE FIGE LES NUMÉROS (relecture de la ligne) ·
 * ses fiches recopient le numéro d'inventaire du bien à leur création
 * (`InventaireService`, désignation « numéro · bien »), et le recensement
 * (AUDCIF art. 42) se fait sur les étiquettes en place · renuméroter pendant
 * le comptage ferait parler le registre et les fiches de deux biens
 * différents. La renumérotation attend la clôture de la campagne.
 */
export function motifRefusCampagneOuverte(campagnes: { libelle: string; dateInventaire: Date; statut: string }[]): string | null {
  const ouverte = campagnes.find((c) => c.statut !== 'CLOTUREE');
  if (!ouverte) return null;
  return (
    `La campagne d’inventaire « ${ouverte.libelle} » du ${ouverte.dateInventaire.toISOString().slice(0, 10)} n’est pas clôturée · ` +
    'ses fiches portent les numéros d’inventaire en place, et le comptage se fait sur eux. Renumérotez après sa clôture.'
  );
}

/** Les numéros portés par plusieurs fiches · nommés par la maintenance, jamais corrigés d'office. */
export function numerosEnDouble(fiches: { id: string; designation: string; numeroInventaire: string | null }[]) {
  const parNumero = new Map<string, { id: string; designation: string }[]>();
  for (const f of fiches) {
    const num = (f.numeroInventaire ?? '').trim();
    if (!num) continue;
    const l = parNumero.get(num) ?? [];
    l.push({ id: f.id, designation: f.designation });
    parNumero.set(num, l);
  }
  return [...parNumero.entries()]
    .filter(([, l]) => l.length > 1)
    .map(([numero, fichesDuNumero]) => ({ numero, fiches: fichesDuNumero }))
    .sort((a, b) => (a.numero < b.numero ? -1 : 1));
}

const centimes = (x: number) => Math.round(x * 100);

export interface LigneRapprochement {
  numero: string;
  intitule: string;
  registre: number;
  balance: number;
  ecart: number;
}

/**
 * Le rapprochement compte par compte · le registre (positif, au sens normal
 * du compte · débit du bien, crédit de l'amortissement) contre le solde de la
 * balance lu dans le même sens. Un compte présent d'un seul côté paraît avec
 * zéro de l'autre. Comparé en centimes entiers.
 */
export function rapprocher(
  registre: Map<string, { intitule: string; montant: number }>,
  balance: Map<string, { intitule: string; solde: number }>,
): LigneRapprochement[] {
  const numeros = new Set([...registre.keys(), ...balance.keys()]);
  return [...numeros]
    .sort()
    .map((numero) => {
      const r = centimes(registre.get(numero)?.montant ?? 0);
      const b = centimes(balance.get(numero)?.solde ?? 0);
      return {
        numero,
        intitule: registre.get(numero)?.intitule ?? balance.get(numero)?.intitule ?? '',
        registre: r / 100,
        balance: b / 100,
        ecart: (b - r) / 100,
      };
    })
    .filter((l) => l.registre !== 0 || l.balance !== 0);
}
