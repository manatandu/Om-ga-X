/**
 * LA DÉCLARATION ANNUELLE DE LA SITUATION DE LA MAIN-D'ŒUVRE (« DASMO »),
 * REMPLIE DEPUIS LE REGISTRE (demande de Manasse du 2026-10-29, « Oui », qui
 * lève le gel pour elle).
 *
 * Sources lues · Code du travail, art. 218 et 219 ; arrêté ministériel
 * n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023, art. 1er à 5
 * et 9 (J.O. RDC, première partie, n° 10 du 15 mai 2023) ; et le formulaire de
 * l'Office national de l'emploi qui porte « Vu pour être annexé » à cet arrêté
 * (« Déclaration annuelle de la situation de la main-d'œuvre », exercice 2024,
 * `docs/sources/arrete-087-2023-declarations.md`). C'est le MODÈLE de l'art. 4
 * pour la seule situation annuelle.
 *
 * L'EXERCICE EST CELUI DU 1er JANVIER · le formulaire de l'« Exercice 2024 »
 * compte le « personnel permanent au 1er janvier de l'année en cours » et la
 * « masse salariale brute au 1er janvier 2024 », et l'art. 3 le fait déposer
 * « au plus tard le 31 janvier de chaque année ». L'exercice E se lit donc au
 * 1er janvier E et se dépose au plus tard le 31 janvier E, sans report au
 * jour ouvrable (aucun n'est écrit).
 *
 * LES LIGNES DU FORMULAIRE ET LES CATÉGORIES DU DÉCRET · les lignes 21 à 29
 * nomment « Catégorie I » à « Catégorie V », « Agent de maîtrise »,
 * « Cadres de collaboration », « Cadre de direction » et « Hors cadres ». La
 * grille du décret n° 25/22 (art. 4) range les dix-sept classes en sept
 * catégories, numérotées I à VII (`bareme-smig.ts`) · I à V se reportent sur
 * les lignes de même numéro, la VI (Maîtrise) sur « Agent de maîtrise », la
 * VII (Cadre de collaboration) sur « Cadres de collaboration ». Lecture
 * d'OmegaX, par le nom et le rang. Les cadres de direction et les hors cadres
 * sont au-dessus de la grille · aucune classe ne les dit, et un contrat sans
 * classe est NOMMÉ, jamais rangé d'office.
 *
 * PERMANENT OU NON · la note du formulaire définit le temporaire comme la
 * « personne engagée à durée déterminée » et le journalier comme la personne
 * engagée « au jour le jour » · le permanent est donc le contrat à durée
 * indéterminée. Consultants et saisonniers sont des contrats à durée
 * déterminée que le registre ne distingue pas · comptés parmi les
 * temporaires, et c'est dit. Les « 22 jours » et « 2 ans » de cette note sont
 * des définitions de l'ONEM, pas d'un texte · ni comptés ni refusés.
 *
 * CE QUI N'EST PAS REMPLI, ET POURQUOI · la masse salariale « au 1er janvier »
 * (le formulaire ne dit pas quelle période elle couvre), la durée
 * hebdomadaire moyenne, les effectifs maximaux des non-permanents (la période
 * n'est pas dite), les besoins en main-d'œuvre et en formation · rendus vides
 * et nommés, à remplir par le cabinet. Une nationalité absente rend la
 * répartition congolaise et étrangère NON CALCULÉE, jamais devinée.
 */
import { CATEGORIES } from './bareme-smig';
import { estNationaliteCongolaise } from './effectif-registre';

export const MODELE_DASMO =
  "formulaire « Déclaration annuelle de la situation de la main-d'œuvre » de l'Office national de l'emploi, « vu pour être annexé » à l'arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023";

export const FONDEMENT_DASMO =
  "Code du travail, art. 218 et 219 ; arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023, art. 1er à 5 et 9, et son modèle annexé (J.O. RDC, première partie, n° 10 du 15 mai 2023)";

/** Les neuf lignes de catégorie du formulaire (21 à 29), dans son ordre. */
export const LIGNES_DASMO = [
  { cle: 'I', libelle: 'Catégorie I', rangDecret: 'I' },
  { cle: 'II', libelle: 'Catégorie II', rangDecret: 'II' },
  { cle: 'III', libelle: 'Catégorie III', rangDecret: 'III' },
  { cle: 'IV', libelle: 'Catégorie IV', rangDecret: 'IV' },
  { cle: 'V', libelle: 'Catégorie V', rangDecret: 'V' },
  { cle: 'MAITRISE', libelle: 'Agent de maîtrise', rangDecret: 'VI' },
  { cle: 'COLLABORATION', libelle: 'Cadres de collaboration', rangDecret: 'VII' },
  { cle: 'DIRECTION', libelle: 'Cadre de direction', rangDecret: null },
  { cle: 'HORS_CADRES', libelle: 'Hors cadres', rangDecret: null },
] as const;

export type CleLigneDasmo = (typeof LIGNES_DASMO)[number]['cle'];

/** La ligne du formulaire d'une classe du décret n° 25/22, ou null (classe absente ou hors grille). */
export function ligneDeLaClasse(classe: number | null): CleLigneDasmo | null {
  if (classe === null || !Number.isInteger(classe)) return null;
  const categorie = CATEGORIES.find((c) => c.classes.includes(classe));
  if (!categorie) return null;
  return LIGNES_DASMO.find((l) => l.rangDecret === categorie.rang)?.cle ?? null;
}

/** L'exercice E · lu au 1er janvier E, déposé au plus tard le 31 janvier E (art. 3). */
export function datesDeLExercice(exercice: number) {
  return {
    au: `${exercice}-01-01`,
    dateLimite: `${exercice}-01-31`,
    anneePrecedente: `${exercice - 1}-01-01`,
    anneeAnterieure: `${exercice - 2}-01-01`,
  };
}

export interface ContratAuPremierJanvier {
  salarie: string;
  sexe: 'MASCULIN' | 'FEMININ';
  nationalite: string | null;
  type: 'DUREE_DETERMINEE' | 'DUREE_INDETERMINEE' | 'JOUR_LE_JOUR' | 'APPRENTISSAGE';
  classeProfessionnelle: number | null;
}

/** Un contrat lu au registre, avec ce qu'il faut pour le dater. */
export interface ContratLu extends ContratAuPremierJanvier {
  salarieId: string;
  dateEntreeEnVigueur: string;
  dateFin: string | null;
  dateFinPrevue: string | null;
}

/**
 * LES CONTRATS RETENUS AU 1er JANVIER D, UNE RÈGLE POUR LES TROIS DATES
 * (relecture « échecs silencieux », bloquant · l'année E gardait le contrat
 * le plus récent quand E-1 et E-2 comptaient tout salarié qui avait un CDI,
 * et un salarié passait de permanent à temporaire sans départ). Un salarié
 * compte une fois · PERMANENT dès qu'un contrat à durée indéterminée est en
 * vigueur à la date, sinon par son contrat le plus récent. Deux contrats en
 * vigueur le même jour ne sont jamais tranchés en silence · le salarié est
 * nommé. Un contrat à durée déterminée dont la fin prévue est passée sans
 * fin posée au registre est compté comme le registre le porte, et nommé.
 */
export function contratsRetenusAu(contrats: ContratLu[], d: string) {
  const enVigueur = contrats.filter((c) => c.dateEntreeEnVigueur <= d && (c.dateFin === null || c.dateFin >= d));
  const parSalarie = new Map<string, ContratLu[]>();
  for (const c of enVigueur) parSalarie.set(c.salarieId, [...(parSalarie.get(c.salarieId) ?? []), c]);
  const retenus: ContratAuPremierJanvier[] = [];
  const plusieurs: string[] = [];
  for (const liste of parSalarie.values()) {
    const tries = [...liste].sort((a, b) => b.dateEntreeEnVigueur.localeCompare(a.dateEntreeEnVigueur));
    const choisi = tries.find((c) => c.type === 'DUREE_INDETERMINEE') ?? tries[0];
    retenus.push({ salarie: choisi.salarie, sexe: choisi.sexe, nationalite: choisi.nationalite, type: choisi.type, classeProfessionnelle: choisi.classeProfessionnelle });
    if (liste.length > 1) plusieurs.push(choisi.salarie);
  }
  const echusNonClos = enVigueur
    .filter((c) => c.type === 'DUREE_DETERMINEE' && c.dateFin === null && c.dateFinPrevue !== null && c.dateFinPrevue < d)
    .map((c) => c.salarie);
  return { retenus, plusieurs, echusNonClos };
}

export const RESERVE_REQUALIFICATIONS =
  "Un contrat à durée déterminée requalifié de plein droit en contrat à durée indéterminée (Code du travail, art. 40 à 45) est compté ici selon son type au registre · le contrôle des contrats du registre nomme ces requalifications, à reporter sur le formulaire.";

export interface Cellules {
  congolais: { h: number; f: number; total: number } | null;
  etrangers: { h: number; f: number; total: number } | null;
  totaux: { h: number; f: number; total: number };
}

function compter(contrats: ContratAuPremierJanvier[]): Cellules {
  const sansNationalite = contrats.some((c) => !(c.nationalite ?? '').trim());
  const part = (garder: (c: ContratAuPremierJanvier) => boolean) => {
    const choisis = contrats.filter(garder);
    const h = choisis.filter((c) => c.sexe === 'MASCULIN').length;
    const f = choisis.filter((c) => c.sexe === 'FEMININ').length;
    return { h, f, total: h + f };
  };
  return {
    congolais: sansNationalite ? null : part((c) => estNationaliteCongolaise(c.nationalite)),
    etrangers: sansNationalite ? null : part((c) => !estNationaliteCongolaise(c.nationalite)),
    totaux: part(() => true),
  };
}

export interface ChampDasmo {
  numero: number;
  libelle: string;
  /** `null` · le dossier ne le tient pas, et le champ est nommé parmi les manquants. */
  valeur: string | null;
}

export interface IdentiteDasmo {
  nom: string;
  adresse: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  formeJuridique: string | null;
  rccm: string | null;
  numeroImpot: string | null;
  activite: string | null;
  idNat: string | null;
  numeroAffiliationCnssEmployeur: string | null;
}

/** Les rubriques 1 à 19 · celles que le dossier ne tient pas restent vides et nommées. */
export function identificationDasmo(brut: IdentiteDasmo): ChampDasmo[] {
  // Un champ enregistré vide n'est pas rempli · sans cela la case sortait
  // blanche, ni en pointillés ni nommée parmi les manquants.
  const v = (x: string | null) => ((x ?? '').trim() || null);
  const t = Object.fromEntries(Object.entries(brut).map(([k, x]) => [k, v(x)])) as Record<keyof IdentiteDasmo, string | null>;
  return [
    { numero: 1, libelle: 'Nom ou raison sociale', valeur: t.nom },
    { numero: 2, libelle: 'Province', valeur: null },
    { numero: 3, libelle: 'Adresse physique', valeur: t.adresse },
    { numero: 4, libelle: 'Quartier', valeur: null },
    { numero: 5, libelle: 'Commune', valeur: null },
    { numero: 6, libelle: 'Ville', valeur: t.ville },
    { numero: 7, libelle: 'Année de création', valeur: null },
    { numero: 8, libelle: 'N° téléphone', valeur: t.telephone },
    { numero: 9, libelle: 'Mail', valeur: t.email },
    { numero: 10, libelle: 'Forme juridique', valeur: t.formeJuridique },
    { numero: 11, libelle: 'N° RCCM', valeur: t.rccm },
    { numero: 12, libelle: 'N° impôt', valeur: t.numeroImpot },
    { numero: 13, libelle: 'Activité principale', valeur: t.activite },
    { numero: 14, libelle: 'Activité secondaire', valeur: null },
    { numero: 15, libelle: 'N° IDN', valeur: t.idNat },
    { numero: 16, libelle: "N° d'immatriculation CNSS", valeur: t.numeroAffiliationCnssEmployeur },
    { numero: 17, libelle: "N° d'immatriculation INPP", valeur: null },
    { numero: 18, libelle: "N° d'immatriculation ONEM", valeur: null },
    { numero: 19, libelle: "Nom de l'employeur", valeur: null },
  ];
}

export const RUBRIQUES_NON_REMPLIES = [
  "Masse salariale brute au 1er janvier (rubriques 34 à 44) · le formulaire ne dit pas quelle période elle couvre, rien n'est calculé.",
  'Durée hebdomadaire moyenne du travail (45 et 46) · à remplir.',
  'Effectifs maximaux des non-permanents et leurs périodes (31 à 33) · la période n’est pas dite, à remplir.',
  'Besoins en main-d’œuvre (47 à 61) et besoins de formation, apprentis, perfectionnement (62 à 71) · à remplir.',
];

export const NOTE_TEMPORAIRES =
  "Temporaires · tous les contrats à durée déterminée en vigueur. Le registre ne distingue ni les consultants (prestation intellectuelle) ni les saisonniers, que le formulaire compte à part · à reporter à la main.";

/**
 * Le formulaire rempli pour l'exercice E. `contrats` · les contrats du
 * registre en vigueur à l'un des trois 1er janvier (E, E-1, E-2), lus par
 * `contratsRetenusAu`, une règle pour les trois dates.
 */
export function formulaireSituationMainOeuvre(entree: { exercice: number; identite: IdentiteDasmo; contrats: ContratLu[] }) {
  const dates = datesDeLExercice(entree.exercice);
  const au = contratsRetenusAu(entree.contrats, dates.au);
  const auPremierJanvier = au.retenus;
  const permanentsAu = (d: string) => contratsRetenusAu(entree.contrats, d).retenus.filter((c) => c.type === 'DUREE_INDETERMINEE').length;
  const permanents = auPremierJanvier.filter((c) => c.type === 'DUREE_INDETERMINEE');
  const lignes = LIGNES_DASMO.map((l) => ({
    cle: l.cle,
    libelle: l.libelle,
    // Direction et hors cadres ne se lisent sur aucune classe · null, jamais zéro.
    cellules: l.rangDecret === null ? null : compter(permanents.filter((c) => ligneDeLaClasse(c.classeProfessionnelle) === l.cle)),
  }));
  const sansClasse = permanents.filter((c) => ligneDeLaClasse(c.classeProfessionnelle) === null).map((c) => c.salarie);
  const totaux = compter(permanents);
  const identification = identificationDasmo(entree.identite);
  const sansNationalite = auPremierJanvier.filter((c) => !(c.nationalite ?? '').trim()).length;
  const temporaires = auPremierJanvier.filter((c) => c.type === 'DUREE_DETERMINEE').length;
  return {
    exercice: entree.exercice,
    ...dates,
    identification,
    effectifs: { lignes, totaux, sansClasse },
    permanents: {
      annee: permanents.length,
      anneePrecedente: permanentsAu(dates.anneePrecedente),
      anneeAnterieure: permanentsAu(dates.anneeAnterieure),
    },
    nonPermanents: {
      journaliers: auPremierJanvier.filter((c) => c.type === 'JOUR_LE_JOUR').length,
      temporaires,
      apprentis: auPremierJanvier.filter((c) => c.type === 'APPRENTISSAGE').length,
      noteTemporaires: NOTE_TEMPORAIRES,
    },
    manquants: [
      ...identification.filter((c) => c.valeur === null).map((c) => `${c.numero}. ${c.libelle}`),
      ...(sansClasse.length ? [`${sansClasse.length} permanent(s) sans classe du décret n° 25/22 au contrat · à ranger à la main (cadre de direction, hors cadres, ou classe à renseigner)`] : []),
      ...(sansNationalite ? [`${sansNationalite} salarié(s) sans nationalité au registre · la répartition congolaise et étrangère n'est pas calculée`] : []),
      ...(au.plusieurs.length ? [`Plusieurs contrats en vigueur au ${dates.au} pour ${au.plusieurs.join(', ')} · compté(s) une fois, permanent(s) dès qu'un contrat à durée indéterminée est en vigueur, à vérifier au registre`] : []),
      ...(au.echusNonClos.length ? [`Contrat à durée déterminée échu sans fin posée au registre · ${au.echusNonClos.join(', ')} · compté parmi les temporaires, fin à poser au registre ou renouvellement à vérifier`] : []),
    ],
    reserveRequalifications: temporaires > 0 ? RESERVE_REQUALIFICATIONS : null,
    nonRemplies: RUBRIQUES_NON_REMPLIES,
    modele: MODELE_DASMO,
    fondement: FONDEMENT_DASMO,
  };
}

/** Les libellés des formes juridiques, tels que le formulaire les attend en clair. */
export const LIBELLE_FORME: Record<string, string> = {
  ASSOCIATION: 'Association sans but lucratif',
  ORGANISATION_NON_GOUVERNEMENTALE: 'Organisation non gouvernementale',
  ASSOCIATION_CONFESSIONNELLE: 'Association confessionnelle',
  ETABLISSEMENT_UTILITE_PUBLIQUE: "Établissement d'utilité publique",
  UNITE_GESTION_PROJET: 'Unité de gestion de projet',
  SOCIETE_ANONYME: 'Société anonyme',
  SOCIETE_PAR_ACTIONS_SIMPLIFIEE: 'Société par actions simplifiée',
  SOCIETE_RESPONSABILITE_LIMITEE: 'Société à responsabilité limitée',
  SOCIETE_NOM_COLLECTIF: 'Société en nom collectif',
  SOCIETE_COMMANDITE_SIMPLE: 'Société en commandite simple',
  GROUPEMENT_INTERET_ECONOMIQUE: "Groupement d'intérêt économique",
  SOCIETE_COOPERATIVE: 'Société coopérative',
  ENTREPRISE_INDIVIDUELLE: 'Entreprise individuelle',
  ENTREPRENANT: 'Entreprenant',
  SUCCURSALE: 'Succursale',
  ENTITE_PUBLIQUE: 'Entité publique',
};
