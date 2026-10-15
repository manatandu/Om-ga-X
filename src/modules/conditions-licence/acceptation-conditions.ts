import {
  AbonnementAFacturer,
  premierePeriodeFacturable,
  verdictPeriode,
} from '../plateforme/abonnements/facturation-abonnements';
import { mentionsAArreter, VERSION_CONDITIONS_LICENCE } from './conditions-de-licence';
import { empreinteEnVigueur } from './versions-publiees';

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
  /**
   * L'empreinte SHA-256 du texte accepté (relecture M2) · le numéro seul ne
   * dit pas QUEL texte. `null` pour une acceptation qui ne l'aurait pas
   * enregistrée · aucune ne le peut depuis cette ligne.
   */
  empreinte: string | null;
  /** ISO 8601. */
  le: string;
  /** Courriel de l'administrateur, recopié au jour de l'acte · `null` s'il n'a pas été enregistré. */
  par: string | null;
}

/** Ce qui s'écrit à la place d'un auteur absent · jamais une chaîne vide, qui se lirait comme un nom (relecture, mineur 6). */
export const AUTEUR_NON_ENREGISTRE = 'auteur non enregistré';

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

/**
 * Ce que le dossier a accepté est-il le texte en vigueur ? Même numéro ET même
 * empreinte · le numéro seul laissait passer un texte retouché sous le même
 * numéro (relecture M2).
 */
export function estAJour(
  a: AcceptationEnregistree | null,
  versionEnVigueur: number = VERSION_CONDITIONS_LICENCE.numero,
  empreinte: string = empreinteEnVigueur(),
): boolean {
  return a !== null && a.version === versionEnVigueur && a.empreinte === empreinte;
}

/**
 * Le refus d'une acceptation reçue · le texte affiché à l'administrateur doit
 * être celui que le service tient en vigueur, même NUMÉRO et même EMPREINTE
 * (il a lu CE texte), et le dossier doit pouvoir accepter. `null` =
 * l'acceptation passe. L'écran envoie le numéro et l'empreinte de SON texte,
 * celui du code qu'il a chargé (relecture M1) · une page restée ouverte sur
 * une construction plus ancienne, ou plus récente, ne fait rien accepter.
 */
export function motifRefusAcceptation(
  versionLue: number,
  empreinteLue: string,
  c: ContexteAcceptation,
  versionEnVigueur: number = VERSION_CONDITIONS_LICENCE.numero,
  empreinte: string = empreinteEnVigueur(),
): string | null {
  if (!Number.isInteger(versionLue) || versionLue !== versionEnVigueur || empreinteLue !== empreinte) {
    return (
      `Le texte lu (version ${String(versionLue)}) n’est pas celui que le service tient en vigueur (version ${versionEnVigueur}) · ` +
      'rechargez la page et relisez la version en vigueur avant de l’accepter.'
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

/** Le dernier accusé de réception mis en file pour l'acceptation en vigueur. */
export interface AccuseEnFile {
  /** Le statut du message · EN_ATTENTE, SANS_TRANSPORT, ENVOYE, ECHEC ou ABANDONNE. */
  statut: string;
  /** ISO 8601 · sa mise en file. */
  le: string;
}

/** Les statuts d'un accusé qui partira ou est parti · un renvoi en ferait un doublon. */
const ACCUSE_EN_COURS_OU_PARTI = new Set(['EN_ATTENTE', 'SANS_TRANSPORT', 'ENVOYE']);

/**
 * Pourquoi l'accusé ne se renvoie pas, ou `null` (relecture, mineur 5) · il y
 * faut une acceptation du texte en vigueur, et aucun accusé en file, parti ou
 * en attente d'une messagerie. Un accusé en échec ou abandonné, ou jamais mis
 * en file, se renvoie.
 */
export function motifRefusRenvoiAccuse(a: AcceptationEnregistree | null, aJour: boolean, dernier: AccuseEnFile | null): string | null {
  if (!a || !aJour) return 'Aucune acceptation du texte en vigueur n’est enregistrée pour ce dossier · il n’y a pas d’accusé à renvoyer.';
  if (dernier && ACCUSE_EN_COURS_OU_PARTI.has(dernier.statut)) {
    return 'Un accusé de réception de cette acceptation est déjà en file ou parti · le renvoyer ferait un doublon.';
  }
  return null;
}

/** La vue que l'écran reçoit · tout est servi, rien n'est recalculé à l'écran. */
export interface EtatConditions {
  /** La version que le SERVICE tient en vigueur, avec l'empreinte de son texte · l'écran la compare à la sienne. */
  version: { numero: number; date: string; dateLisible: string; empreinte: string };
  acceptation: AcceptationEnregistree | null;
  aJour: boolean;
  /** Vrai quand l'administrateur doit encore accepter la version en vigueur. */
  aAccepter: boolean;
  motifFermeture: string | null;
  commande: DetailCommande | null;
  /** Le dernier accusé mis en file pour l'acceptation en vigueur, ou `null` s'il n'y en a aucun. */
  accuse: AccuseEnFile | null;
  /** Vrai quand l'accusé peut être renvoyé (`motifRefusRenvoiAccuse`). */
  renvoiAccusePossible: boolean;
}

export function etatConditions(
  a: AcceptationEnregistree | null,
  c: Omit<ContexteAcceptation, 'mentions'> & { mentions?: string[] },
  accuse: AccuseEnFile | null = null,
): EtatConditions {
  const contexte: ContexteAcceptation = { ...c, mentions: c.mentions ?? mentionsAArreter() };
  const motif = motifAcceptationFermee(contexte);
  const aJour = estAJour(a);
  return {
    version: { ...VERSION_CONDITIONS_LICENCE, empreinte: empreinteEnVigueur() },
    acceptation: a,
    aJour,
    aAccepter: motif === null && !aJour,
    motifFermeture: motif,
    commande: c.commande,
    accuse,
    renvoiAccusePossible: motifRefusRenvoiAccuse(a, aJour, accuse) === null,
  };
}
