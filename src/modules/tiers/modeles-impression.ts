import type { NatureModeleImpression, TypeRelance } from '@prisma/client';

/**
 * LES MODÈLES D'IMPRESSION PROPRES AU TIERS (ligne sage-l2, fonction 27 ·
 * Sage 100 i7, volet « Modèles d'impression » de la fiche du tiers, extrait,
 * règlement, rappel ; structure F_COMPTETMODELE). Règles pures, sans Prisma.
 *
 * Chez Sage, le modèle est une MISE EN PAGE choisie par tiers. OmegaX n'a pas
 * de moteur de mise en page · ses lettres et ses relevés sont des textes
 * qu'il compose lui-même (relances.service.ts, avis-reglement.ts). Le modèle
 * du tiers est donc un TEXTE QUI HABILLE LE DOCUMENT · le cabinet y écrit ce
 * que ce tiers attend (service destinataire, référence de son contrat, formule
 * d'appel), et le jeton {document} marque l'endroit où s'imprime ce que le
 * logiciel compose.
 *
 * LE MODÈLE N'EST JAMAIS LE DOCUMENT · règle d'OmegaX, qu'aucun texte n'écrit.
 * Le document porte ce que la lettre réclame ou acquitte (montant, lignes,
 * échéance, factures payées) et, signé de l'entité, les mentions que sa
 * correspondance doit porter (AUDCG art. 59 ; AUSCGIE art. 17, `{entite}` des
 * relances). Un modèle qui pourrait l'omettre ferait partir un rappel sans le
 * montant dû, ou un avis sans les mentions de l'émetteur · d'où {document}
 * EXIGÉ, une fois et une seule.
 *
 * UN JETON INCONNU EST REFUSÉ · « {montnt} » s'imprimerait tel quel sur la
 * lettre du tiers, et personne ne le verrait avant lui.
 */

/** Le jeton du document, qu'un modèle porte une fois et une seule. */
export const JETON_DOCUMENT = '{document}';

/** Les jetons qu'un modèle peut porter, dans l'ordre où l'aide les dit. */
export const JETONS_MODELE_IMPRESSION: ReadonlyArray<{ jeton: string; sens: string }> = [
  { jeton: 'document', sens: 'le document composé par OmegaX (lettre de relance, relevé, avis de règlement)' },
  { jeton: 'tiers', sens: 'le nom du tiers' },
  { jeton: 'code', sens: 'le code du tiers' },
  { jeton: 'qualite', sens: 'la qualité du tiers' },
  { jeton: 'contact', sens: 'la personne à qui la lettre s’adresse' },
  { jeton: 'adresse', sens: 'l’adresse, la boîte postale, la ville et le pays de la fiche' },
  { jeton: 'entite', sens: 'le nom du dossier' },
  { jeton: 'date', sens: 'le jour du document' },
];

const NOMS_JETONS = new Set(JETONS_MODELE_IMPRESSION.map((j) => j.jeton));

/** Comme l'intitulé des lieux et des qualités · la zone de Sage. */
export const LONGUEUR_INTITULE_MODELE = 35;
/** Une lettre tient dans ce nombre de caractères, habillage compris · borne d'OmegaX. */
export const LONGUEUR_TEXTE_MODELE = 4000;
/** Modèles par dossier, toutes natures · borne de la table, celle de la liste. */
export const PLAFOND_MODELES_IMPRESSION = 100;

export const LIBELLES_NATURE_MODELE: Readonly<Record<NatureModeleImpression, string>> = {
  EXTRAIT: 'Extrait de compte',
  REGLEMENT: 'Avis de règlement',
  RAPPEL: 'Rappel',
};

/** Le document d'une nature, avec son article, pour les messages. */
const DOCUMENT_DE_LA_NATURE: Readonly<Record<NatureModeleImpression, string>> = {
  EXTRAIT: 'l’extrait de compte',
  REGLEMENT: 'l’avis de règlement',
  RAPPEL: 'le rappel',
};

/**
 * LE MODÈLE QU'UN NIVEAU DE RELANCE EMPLOIE · la relance préventive et le
 * rappel sont des RAPPELS ; le relevé de tout ce qui est dû est l'EXTRAIT du
 * compte du tiers (Sage, « impression de l'extrait de compte »).
 */
export function natureDuNiveau(type: TypeRelance): NatureModeleImpression {
  return type === 'RELEVE' ? 'EXTRAIT' : 'RAPPEL';
}

/** Le nom de la colonne du tiers qui porte le modèle d'une nature. */
export const COLONNE_DU_TIERS: Readonly<
  Record<NatureModeleImpression, 'modeleImpressionExtraitId' | 'modeleImpressionReglementId' | 'modeleImpressionRappelId'>
> = {
  EXTRAIT: 'modeleImpressionExtraitId',
  REGLEMENT: 'modeleImpressionReglementId',
  RAPPEL: 'modeleImpressionRappelId',
};

export function intituleDuModele(brut: string): string {
  return brut.trim().replace(/\s+/g, ' ');
}

/**
 * L'intitulé · exigé, borné, unique dans sa nature sans égard à la casse
 * (deux « Contrat cadre » d'extrait ne se distingueraient plus sur la fiche).
 */
export function motifRefusIntituleModele(
  intitule: string,
  autres: ReadonlyArray<{ id: string; intitule: string }>,
  idModifie: string | null,
): string | null {
  if (!intitule) return "L'intitulé du modèle est obligatoire.";
  if (intitule.length > LONGUEUR_INTITULE_MODELE) {
    return `L'intitulé du modèle tient en ${LONGUEUR_INTITULE_MODELE} caractères au plus.`;
  }
  const pris = autres.find((a) => a.id !== idModifie && a.intitule.toLocaleLowerCase('fr') === intitule.toLocaleLowerCase('fr'));
  return pris ? `Le dossier a déjà un modèle « ${pris.intitule} » pour ce document.` : null;
}

/** Les jetons écrits dans un texte, dans l'ordre, doublons compris. */
function jetonsDuTexte(texte: string): string[] {
  return [...texte.matchAll(/\{([^{}\s]*)\}/g)].map((m) => m[1]);
}

/**
 * Le texte · exigé, borné, {document} une fois et une seule, aucun jeton
 * inconnu. Le refus nomme ce qui manque et les jetons admis.
 */
export function motifRefusTexteModele(texte: string): string | null {
  if (!texte.trim()) return 'Le texte du modèle est obligatoire.';
  if (texte.length > LONGUEUR_TEXTE_MODELE) return `Le texte du modèle tient en ${LONGUEUR_TEXTE_MODELE} caractères au plus.`;
  const jetons = jetonsDuTexte(texte);
  const inconnus = [...new Set(jetons.filter((j) => !NOMS_JETONS.has(j)))];
  if (inconnus.length) {
    return (
      `Jeton inconnu : ${inconnus.map((j) => `{${j}}`).join(', ')} · il s'imprimerait tel quel sur la lettre du tiers. ` +
      `Jetons admis : ${[...NOMS_JETONS].map((j) => `{${j}}`).join(', ')}.`
    );
  }
  const documents = jetons.filter((j) => j === 'document').length;
  if (documents !== 1) {
    return documents === 0
      ? `Le modèle porte le jeton ${JETON_DOCUMENT}, là où s'imprime le document · sans lui, la lettre partirait sans ce qu'elle réclame ou acquitte.`
      : `Le modèle porte le jeton ${JETON_DOCUMENT} une fois et une seule · le document s'imprimerait ${documents} fois.`;
  }
  return null;
}

/** Ce que la fiche du tiers donne aux jetons. */
export interface IdentiteDuTiers {
  nom: string;
  code: string;
  qualite: string | null;
  contact: string | null;
  adresse: string | null;
  boitePostale: string | null;
  ville: string | null;
  pays: string | null;
}

/** L'adresse de la fiche, une ligne par élément renseigné. */
export function adresseDuTiers(t: Pick<IdentiteDuTiers, 'adresse' | 'boitePostale' | 'ville' | 'pays'>): string {
  return [t.adresse, t.boitePostale, t.ville, t.pays].map((x) => (x ?? '').trim()).filter(Boolean).join('\n');
}

/** Un jour (minuit UTC, convention du dépôt) au format de la lettre. */
export function jourImprime(jour: Date): string {
  return jour.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

export interface Cadre {
  /** L'intitulé du modèle du tiers appliqué · `null`, le cadre par défaut du document. */
  modele: string | null;
  /** Ce qui s'imprime avant le document, jetons remplacés. */
  avant: string;
  /** Ce qui s'imprime après. */
  apres: string;
}

/**
 * LE CADRE · le texte du modèle coupé au jeton {document}, les autres jetons
 * remplacés EN UNE PASSE sur le seul texte du modèle · le document ne passe
 * jamais par le remplacement, et un libellé de facture qui écrirait « {tiers} »
 * s'imprime tel qu'il est.
 */
export function cadreDuModele(
  modele: { intitule: string | null; texte: string },
  tiers: IdentiteDuTiers,
  contexte: { entite: string; jour: Date },
): Cadre {
  const valeurs: Record<string, string> = {
    tiers: tiers.nom,
    code: tiers.code,
    qualite: tiers.qualite ?? '',
    contact: tiers.contact ?? '',
    adresse: adresseDuTiers(tiers),
    entite: contexte.entite,
    date: jourImprime(contexte.jour),
  };
  const remplacer = (morceau: string) => morceau.replace(/\{([^{}\s]*)\}/g, (brut, nom: string) => valeurs[nom] ?? brut);
  const position = modele.texte.indexOf(JETON_DOCUMENT);
  // Un modèle enregistré a passé `motifRefusTexteModele` · un texte sans le
  // jeton (base retouchée à la main) habille quand même, le document APRÈS
  // le texte, jamais perdu.
  if (position < 0) return { modele: modele.intitule, avant: remplacer(modele.texte), apres: '' };
  return {
    modele: modele.intitule,
    avant: remplacer(modele.texte.slice(0, position)),
    apres: remplacer(modele.texte.slice(position + JETON_DOCUMENT.length)),
  };
}

/** Le document habillé · le cadre, le document à sa place. */
export function habiller(cadre: Cadre | null, document: string): string {
  return cadre ? `${cadre.avant}${document}${cadre.apres}` : document;
}

/**
 * LE MODÈLE CHOISI SUR LA FICHE EST DE LA NATURE DE SA ZONE · un modèle
 * d'avis de règlement posé dans la zone du rappel habillerait la mauvaise
 * lettre.
 */
export function motifRefusAttribution(attendue: NatureModeleImpression, modele: { intitule: string; nature: NatureModeleImpression }): string | null {
  return modele.nature === attendue
    ? null
    : `Le modèle « ${modele.intitule} » habille ${DOCUMENT_DE_LA_NATURE[modele.nature]}, pas ${DOCUMENT_DE_LA_NATURE[attendue]} · choisissez un modèle de cette nature.`;
}
