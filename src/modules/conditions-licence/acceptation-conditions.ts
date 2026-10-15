import {
  AbonnementAFacturer,
  premierePeriodeFacturable,
  verdictPeriode,
} from '../plateforme/abonnements/facturation-abonnements';
import { mentionsAArreter, VERSION_CONDITIONS_LICENCE } from './conditions-de-licence';

/**
 * L'ACCEPTATION EN LIGNE DES CONDITIONS DE LICENCE · moteur PUR, ni base ni
 * horloge. Le service lui passe ce qu'il lit.
 *
 * Code du numérique (ordonnance-loi n° 23/10 du 13 mars 2023), Livre I,
 * Titre VIII · OmegaX en ligne est un « commerce électronique » au sens de
 * l'art. 2, 15° (« activité commerciale par laquelle une personne propose ou
 * assure par voie électronique [...] moyennant paiement d'un prix, la
 * fourniture [...] de services »). Quatre articles commandent ce module.
 *
 *  · art. 54, al. 2 · « Les informations contenues dans l'offre sont fournies
 *    AVANT que le client du service [...] passe commande. » Tant que l'offre
 *    ne dit pas ce que les art. 52 et 53 exigent, l'acceptation est FERMÉE
 *    (`mentionsAArreter`), jamais ouverte sur un texte incomplet.
 *  · art. 55, al. 1er · le contrat est valablement conclu « si le client
 *    accepte l'offre, après avoir eu, au préalable, la possibilité de vérifier
 *    et de réagir aux détails de sa commande » · l'écran montre la version et
 *    l'abonnement du dossier AVANT la confirmation, et un abonnement dont un
 *    prix n'est pas fixé ferme l'acceptation (art. 53, 5°, l'offre énonce le
 *    prix).
 *  · art. 55, al. 2 · « L'auteur de l'offre accuse réception par voie
 *    électronique » · l'acceptation rend son accusé, et le service le met en
 *    file au courriel de son auteur.
 *  · art. 30, al. 3 · un utilisateur qui respecte ses conditions « ne subit
 *    pas d'interruption de fourniture des services » · l'acceptation n'est
 *    JAMAIS une condition d'accès au dossier. Rien ici ne ferme une route.
 */

export interface AcceptationEnregistree {
  version: number;
  /** ISO 8601. */
  le: string;
  /** Courriel de l'administrateur, recopié au jour de l'acte. */
  par: string;
}

/** Une ligne de l'abonnement du dossier, au prix de la grille en vigueur. */
export interface LigneCommande {
  designation: string;
  quantite: number;
  prixUnitaireUsd: number;
}

/** Les détails de la commande que l'administrateur vérifie (art. 55, al. 1er). */
export interface DetailCommande {
  formule: string;
  options: string[];
  periodicite: 'MENSUELLE' | 'ANNUELLE';
  /** AAAA-MM-JJ */
  debut: string;
  /** AAAA-MM-JJ, ou null sans essai. */
  finEssai: string | null;
  /** Les lignes d'une période et leur total, ou `null` quand un prix manque. */
  lignes: LigneCommande[] | null;
  totalUsd: number | null;
  /** Pourquoi le prix n'est pas rendu (prix non fixé), ou null. */
  motifPrix: string | null;
  actif: boolean;
  /** Vrai quand l'abonnement est celui du siège du groupe, lu pour une cellule. */
  duSiege: boolean;
}

export interface ContexteAcceptation {
  mentions: string[];
  /** Le type de la licence du dossier, `null` sans licence. */
  typeLicence: string | null;
  estDemonstration: boolean;
  surSite: boolean;
  /** L'abonnement du dossier, ou celui de son siège pour une cellule ; `null` sans abonnement. */
  commande: DetailCommande | null;
}

/**
 * Pourquoi ce dossier ne peut pas accepter en ligne, ou `null`. L'ordre est
 * celui de la loi · d'abord ce que l'offre ne dit pas, puis ce que le dossier
 * ne permet pas.
 */
export function motifAcceptationFermee(c: ContexteAcceptation): string | null {
  if (c.mentions.length > 0) {
    return (
      'L’acceptation en ligne s’ouvrira quand l’offre dira ce que la loi exige qu’elle dise avant toute commande ' +
      `(Code du numérique, art. 54, al. 2) · ${c.mentions.join(' ; ')}.`
    );
  }
  // Le dossier de l'éditeur ne contracte pas avec lui-même · en ligne
  // seulement, une installation sur site ne lit pas la licence du dossier.
  if (!c.surSite && c.typeLicence === 'PROPRIETAIRE') return 'Le dossier de l’éditeur ne contracte pas avec lui-même.';
  if (c.estDemonstration) return 'Un dossier de démonstration ne porte aucun contrat.';
  // EN LIGNE, LE CONTRAT NE CONNAÎT QUE L'ABONNEMENT (article 6) · une licence
  // perpétuelle hébergée n'a ni formule ni prix dans le texte, et une offre
  // acceptée sans prix ne vaut pas offre (art. 53, 5° ; art. 55, al. 1er).
  // Relecture « échecs silencieux », M4 · l'acceptation s'ouvrait sur ces
  // dossiers, sans aucun prix à vérifier. Sur site, le fichier signé tient
  // la licence (article 8) · aucun abonnement n'y est lu.
  if (!c.surSite && c.typeLicence === 'PERPETUEL_SAAS') {
    return (
      'Ce dossier tient une licence perpétuelle hébergée, que les présentes conditions ne décrivent pas · ' +
      'ses conditions et son prix sont à arrêter par VMG Consulting avant toute acceptation en ligne ' +
      '(Code du numérique, art. 53, 5°, et art. 55, al. 1er).'
    );
  }
  if (!c.surSite && c.commande === null) {
    return (
      'Aucun abonnement n’est rattaché à ce dossier, ni à son siège · l’offre doit dire le prix avant son acceptation ' +
      '(Code du numérique, art. 53, 5°, et art. 55, al. 1er). VMG Consulting rattache l’abonnement depuis sa console.'
    );
  }
  if (c.commande && c.commande.motifPrix) {
    return `L’offre doit dire le prix de l’abonnement de ce dossier avant son acceptation (Code du numérique, art. 53, 5°) · ${c.commande.motifPrix}`;
  }
  return null;
}

/** Ce que le dossier a accepté est-il la version en vigueur ? */
export function estAJour(a: AcceptationEnregistree | null, versionEnVigueur: number = VERSION_CONDITIONS_LICENCE.numero): boolean {
  return a !== null && a.version === versionEnVigueur;
}

/**
 * Le refus d'une acceptation reçue · la version affichée à l'administrateur
 * doit être celle en vigueur (il a lu CE texte), et le dossier doit pouvoir
 * accepter. `null` = l'acceptation passe.
 */
export function motifRefusAcceptation(
  versionLue: number,
  c: ContexteAcceptation,
  versionEnVigueur: number = VERSION_CONDITIONS_LICENCE.numero,
): string | null {
  if (!Number.isInteger(versionLue) || versionLue !== versionEnVigueur) {
    return (
      `La version lue (${String(versionLue)}) n’est pas la version en vigueur (${versionEnVigueur}) · ` +
      'rouvrez les conditions et relisez la version en vigueur avant de l’accepter.'
    );
  }
  return motifAcceptationFermee(c);
}

/**
 * Les détails de l'abonnement, calculés par le MÊME moteur que la facture
 * (`verdictPeriode`) sur la première période facturable · un prix rendu ici
 * qui différerait de celui que la facture portera serait une offre fausse.
 * L'abonnement suspendu se montre quand même, prix compris · la suspension
 * est un geste de l'opérateur, pas une absence d'offre.
 */
export function detailCommande(a: AbonnementAFacturer, duSiege = false): DetailCommande {
  const periode = premierePeriodeFacturable(a.debut, a.finEssai);
  const v = verdictPeriode({ ...a, actif: true }, periode);
  return {
    formule: a.formule.libelle,
    options: a.options.map((o) => o.libelle),
    periodicite: a.periodicite,
    debut: a.debut,
    finEssai: a.finEssai,
    lignes: v.du ? v.lignes : null,
    totalUsd: v.du ? v.totalUsd : null,
    motifPrix: v.du ? null : v.motif,
    actif: a.actif,
    duSiege,
  };
}

/** La vue que l'écran reçoit · tout est servi, rien n'est recalculé à l'écran. */
export interface EtatConditions {
  version: { numero: number; date: string; dateLisible: string };
  acceptation: AcceptationEnregistree | null;
  aJour: boolean;
  /** Vrai quand l'administrateur doit encore accepter la version en vigueur. */
  aAccepter: boolean;
  motifFermeture: string | null;
  commande: DetailCommande | null;
}

export function etatConditions(a: AcceptationEnregistree | null, c: Omit<ContexteAcceptation, 'mentions'> & { mentions?: string[] }): EtatConditions {
  const contexte: ContexteAcceptation = { ...c, mentions: c.mentions ?? mentionsAArreter() };
  const motif = motifAcceptationFermee(contexte);
  const aJour = estAJour(a);
  return {
    version: { ...VERSION_CONDITIONS_LICENCE },
    acceptation: a,
    aJour,
    aAccepter: motif === null && !aJour,
    motifFermeture: motif,
    commande: c.commande,
  };
}
