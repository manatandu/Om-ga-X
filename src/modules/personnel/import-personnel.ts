/**
 * LIGNE PAIE-SUITE, FONCTION 82 · L'IMPORT DU PERSONNEL DEPUIS EXCEL (ou CSV)
 * · règles pures, sans Prisma.
 *
 * POURQUOI · reprendre un dossier dont le registre existe déjà dans un tableur
 * (art. 212 du Code du travail, énonciations du contrat), sans ressaisir
 * chaque fiche. LA RÈGLE · CHAQUE LIGNE EST JUGÉE PAR LES RÈGLES DE LA SAISIE
 * · les mêmes DTO que la fiche (`SalarieDto`, `ContratTravailDto`), la même
 * monnaie exigée d'un montant convenu (`motifMonnaieExigee`, décision de
 * Manasse du 2026-09-28), le même matricule unique · un import ne fait jamais
 * entrer ce que la saisie aurait refusé.
 *
 * DEUX TEMPS · la SIMULATION lit, juge et rend chaque ligne avec ses refus,
 * sans rien écrire ; l'IMPORT rejoue la simulation sur le même fichier et
 * n'écrit que si AUCUNE ligne n'est refusée, tout dans une transaction · un
 * registre à moitié importé laisserait le cabinet deviner quelles lignes
 * relancer.
 *
 * TROIS LECTURES, dites comme telles.
 * (1) LES EN-TÊTES SE LISENT PAR LEUR NOM, accents et casse ignorés · une
 *     colonne inconnue est NOMMÉE et laissée de côté, jamais devinée.
 * (2) UN MONTANT AU POINT DES MILLIERS (« 500.000 ») EST REFUSÉ comme ambigu
 *     · en RDC le point sépare souvent les milliers, et le contrat partait à
 *     500 (même règle que la saisie des conditions bancaires).
 * (3) LE CONTRAT EST FACULTATIF · une ligne sans type ni date d'entrée en
 *     vigueur ne crée que la fiche ; l'une sans l'autre est refusée.
 *
 * Purge et import multi-sociétés de Sage sont ÉCARTÉS (plan du 2026-10-29,
 * § 1) · chaque dossier tient son registre.
 */

export const PLAFOND_LIGNES_IMPORT = 1_000;

export type GenreColonne = 'texte' | 'date' | 'entier' | 'montant' | 'booleen' | 'sexe' | 'typeContrat' | 'periodicite' | 'devise';

export type ColonneImport = {
  cle: string;
  entete: string;
  /** Le DTO qui porte le champ · la fiche ou le premier contrat. */
  cible: 'salarie' | 'contrat';
  genre: GenreColonne;
  obligatoire?: boolean;
};

export const COLONNES_IMPORT: readonly ColonneImport[] = [
  { cle: 'matricule', entete: 'Matricule', cible: 'salarie', genre: 'texte' },
  { cle: 'nom', entete: 'Nom', cible: 'salarie', genre: 'texte', obligatoire: true },
  { cle: 'postNom', entete: 'Post-nom', cible: 'salarie', genre: 'texte' },
  { cle: 'prenoms', entete: 'Prénoms', cible: 'salarie', genre: 'texte' },
  { cle: 'sexe', entete: 'Sexe', cible: 'salarie', genre: 'sexe', obligatoire: true },
  { cle: 'numeroAffiliationCnss', entete: 'N° CNSS', cible: 'salarie', genre: 'texte' },
  { cle: 'dateNaissance', entete: 'Date de naissance', cible: 'salarie', genre: 'date' },
  { cle: 'millesimeNaissance', entete: 'Année de naissance présumée', cible: 'salarie', genre: 'entier' },
  { cle: 'lieuNaissance', entete: 'Lieu de naissance', cible: 'salarie', genre: 'texte' },
  { cle: 'nationalite', entete: 'Nationalité', cible: 'salarie', genre: 'texte' },
  { cle: 'nomConjoint', entete: 'Conjoint', cible: 'salarie', genre: 'texte' },
  { cle: 'declarationEngagementLe', entete: "Déclaration d'engagement le", cible: 'salarie', genre: 'date' },
  { cle: 'type', entete: 'Type de contrat', cible: 'contrat', genre: 'typeContrat' },
  { cle: 'dateEntreeEnVigueur', entete: "Date d'entrée en vigueur", cible: 'contrat', genre: 'date' },
  { cle: 'dateFinPrevue', entete: 'Date de fin prévue', cible: 'contrat', genre: 'date' },
  { cle: 'constateParEcrit', entete: 'Contrat écrit', cible: 'contrat', genre: 'booleen' },
  { cle: 'emploiPermanent', entete: 'Emploi permanent', cible: 'contrat', genre: 'booleen' },
  { cle: 'natureTravail', entete: 'Nature du travail', cible: 'contrat', genre: 'texte' },
  { cle: 'lieuExecution', entete: "Lieu d'exécution", cible: 'contrat', genre: 'texte' },
  { cle: 'categorieProfessionnelle', entete: 'Catégorie professionnelle', cible: 'contrat', genre: 'texte' },
  { cle: 'classeProfessionnelle', entete: 'Classe', cible: 'contrat', genre: 'entier' },
  { cle: 'periodiciteRemuneration', entete: 'Périodicité', cible: 'contrat', genre: 'periodicite' },
  { cle: 'remunerationBase', entete: 'Rémunération de base', cible: 'contrat', genre: 'montant' },
  { cle: 'deviseRemuneration', entete: 'Monnaie', cible: 'contrat', genre: 'devise' },
  { cle: 'clauseEssai', entete: "Clause d'essai", cible: 'contrat', genre: 'booleen' },
  { cle: 'essaiDureeJours', entete: "Durée d'essai (jours)", cible: 'contrat', genre: 'entier' },
  { cle: 'dureePreavisJours', entete: 'Préavis (jours)', cible: 'contrat', genre: 'entier' },
];

/** Un en-tête, sans accents, sans casse, sans ponctuation · « Date d'entrée en vigueur » et « date d entree en vigueur » se valent. */
export function normaliserEntete(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Les colonnes du fichier reconnues, et celles qui ne le sont pas (nommées, ignorées). */
export function apparierColonnes(entetes: readonly string[]): { rangs: Map<string, number>; ignorees: string[]; doublons: string[] } {
  const parNom = new Map(COLONNES_IMPORT.map((c) => [normaliserEntete(c.entete), c.cle]));
  const rangs = new Map<string, number>();
  const ignorees: string[] = [];
  const doublons: string[] = [];
  entetes.forEach((e, i) => {
    if (!e.trim()) return;
    const cle = parNom.get(normaliserEntete(e));
    if (!cle) ignorees.push(e);
    else if (rangs.has(cle)) doublons.push(e);
    else rangs.set(cle, i);
  });
  return { rangs, ignorees, doublons };
}

const sans = (t: string) => normaliserEntete(t);

function lireBooleen(v: string): boolean | null {
  const n = sans(v);
  if (['oui', 'o', 'vrai', 'x', '1', 'yes'].includes(n)) return true;
  if (['non', 'n', 'faux', '0', 'no'].includes(n)) return false;
  return null;
}

function lireDateImport(v: string): string | null {
  const t = v.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(t);
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  const [a, m, j] = iso ? [iso[1], iso[2], iso[3]] : fr ? [fr[3], fr[2], fr[1]] : [null, null, null];
  if (a === null || m === null || j === null) return null;
  const d = new Date(Date.UTC(Number(a), Number(m) - 1, Number(j)));
  // Le 31/02 n'existe pas · une date que JavaScript « répare » est refusée.
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(j) || d.getUTCMonth() !== Number(m) - 1) return null;
  return d.toISOString().slice(0, 10);
}

/** Un montant · espaces de milliers admis, virgule ou point décimal, le point des milliers refusé (lecture 2). */
export function lireMontantImport(v: string): number | 'ambigu' | null {
  const t = v.replace(/[\s   ]/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return 'ambigu';
  const n = t.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(n)) return null;
  return Number(n);
}

const TYPES_CONTRAT: Record<string, string> = {
  cdd: 'DUREE_DETERMINEE',
  'duree determinee': 'DUREE_DETERMINEE',
  'a duree determinee': 'DUREE_DETERMINEE',
  cdi: 'DUREE_INDETERMINEE',
  'duree indeterminee': 'DUREE_INDETERMINEE',
  'a duree indeterminee': 'DUREE_INDETERMINEE',
  'jour le jour': 'JOUR_LE_JOUR',
  'au jour le jour': 'JOUR_LE_JOUR',
  apprentissage: 'APPRENTISSAGE',
};
const PERIODICITES: Record<string, string> = { jour: 'JOUR', journalier: 'JOUR', semaine: 'SEMAINE', hebdomadaire: 'SEMAINE', mois: 'MOIS', mensuel: 'MOIS', annee: 'ANNEE', annuel: 'ANNEE' };

export type LigneLue = {
  rang: number;
  salarie: Record<string, unknown>;
  contrat: Record<string, unknown> | null;
  refus: string[];
};

/** Une ligne du fichier, lue colonne par colonne · chaque valeur illisible est un refus nommé, jamais une valeur devinée. */
export function lireLigne(rang: number, valeurs: readonly string[], rangs: ReadonlyMap<string, number>): LigneLue {
  const salarie: Record<string, unknown> = {};
  const contrat: Record<string, unknown> = {};
  const refus: string[] = [];
  for (const c of COLONNES_IMPORT) {
    const i = rangs.get(c.cle);
    const brut = i === undefined ? '' : (valeurs[i] ?? '').trim();
    if (!brut) {
      if (c.obligatoire) refus.push(`Colonne « ${c.entete} » · obligatoire.`);
      continue;
    }
    let valeur: unknown = brut;
    let illisible: string | null = null;
    switch (c.genre) {
      case 'date':
        valeur = lireDateImport(brut);
        if (valeur === null) illisible = 'date illisible (AAAA-MM-JJ ou JJ/MM/AAAA)';
        break;
      case 'entier':
        valeur = /^\d+$/.test(brut) ? Number(brut) : null;
        if (valeur === null) illisible = 'nombre entier attendu';
        break;
      case 'montant': {
        const m = lireMontantImport(brut);
        if (m === 'ambigu') illisible = 'montant ambigu · écrivez 500 000 ou 500000,00, le point ne sépare pas les milliers';
        else if (m === null) illisible = 'montant illisible';
        else valeur = m;
        break;
      }
      case 'booleen':
        valeur = lireBooleen(brut);
        if (valeur === null) illisible = 'oui ou non attendu';
        break;
      case 'sexe': {
        const n = sans(brut);
        valeur = ['m', 'masculin', 'homme', 'h'].includes(n) ? 'MASCULIN' : ['f', 'feminin', 'femme'].includes(n) ? 'FEMININ' : null;
        if (valeur === null) illisible = 'M ou F attendu';
        break;
      }
      case 'typeContrat':
        valeur = TYPES_CONTRAT[sans(brut)] ?? null;
        if (valeur === null) illisible = 'CDD, CDI, jour le jour ou apprentissage attendu';
        break;
      case 'periodicite':
        valeur = PERIODICITES[sans(brut)] ?? null;
        if (valeur === null) illisible = 'jour, semaine, mois ou année attendu';
        break;
      case 'devise': {
        const n = brut.toUpperCase();
        valeur = n === 'CDF' || n === 'FC' ? 'CDF' : n === 'USD' || n === '$' ? 'USD' : null;
        if (valeur === null) illisible = 'CDF ou USD attendu';
        break;
      }
    }
    if (illisible) {
      refus.push(`Colonne « ${c.entete} » · ${illisible} (« ${brut} »).`);
      continue;
    }
    (c.cible === 'salarie' ? salarie : contrat)[c.cle] = valeur;
  }
  const aContrat = Object.keys(contrat).length > 0;
  if (aContrat && (!contrat.type || !contrat.dateEntreeEnVigueur)) {
    refus.push("Un contrat s'importe avec son type et sa date d'entrée en vigueur · les deux, ou aucune colonne de contrat.");
  }
  return { rang, salarie, contrat: aContrat ? contrat : null, refus };
}

/** Les messages de class-validator, en français quand ils ne le sont pas déjà. */
const MESSAGES: Record<string, string> = {
  maxLength: 'trop long',
  isDateString: 'date illisible',
  isEnum: 'valeur non admise',
  isInt: 'nombre entier attendu',
  isNumber: 'nombre attendu',
  min: 'trop petit',
  max: 'trop grand',
  isBoolean: 'oui ou non attendu',
  isString: 'texte attendu',
};

export function messageDeValidation(
  champ: string,
  contraintes: Record<string, string> | undefined,
): string {
  const colonne = COLONNES_IMPORT.find((c) => c.cle === champ)?.entete ?? champ;
  const textes = Object.entries(contraintes ?? {}).map(([k, m]) => (/[éèàçù·]/.test(m) ? m : (MESSAGES[k] ?? m)));
  return `Colonne « ${colonne} » · ${textes.join(' ; ') || 'valeur refusée'}.`;
}

/** Deux lignes du fichier ne portent pas le même matricule · le registre le refuserait à la seconde. */
export function doublonsDeMatricule(lignes: readonly LigneLue[]): Map<number, string> {
  const vus = new Map<string, number>();
  const refus = new Map<number, string>();
  for (const l of lignes) {
    // Comparé tel quel, comme le registre le compare (`verifierMatriculeLibre`).
    const m = typeof l.salarie.matricule === 'string' ? l.salarie.matricule.trim() : '';
    if (!m) continue;
    const deja = vus.get(m);
    if (deja !== undefined) refus.set(l.rang, `Le matricule ${l.salarie.matricule} figure déjà à la ligne ${deja} du fichier.`);
    else vus.set(m, l.rang);
  }
  return refus;
}
