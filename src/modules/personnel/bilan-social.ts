/**
 * LE BILAN SOCIAL DE L'ONEM, REMPLI EN PARTIE DEPUIS LE DOSSIER (demande de
 * Manasse du 2026-10-29, « Termine la DASMO et enchaîne les autres », qui
 * lève le gel pour lui).
 *
 * Sources lues · Code du travail, art. 218 ; arrêté ministériel
 * n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023, art. 1er à 5
 * (J.O. RDC, première partie, n° 10 du 15 mai 2023), dont l'art. 3 fait
 * déposer le bilan social « au plus tard le 31 janvier de chaque année » ; et
 * le formulaire « Bilan social » de l'Office national de l'emploi, qui cite
 * l'art. 218 et cet arrêté (compétence `onem-rdc`, `formulaires-onem.md`, § 3).
 *
 * L'EXERCICE · le formulaire porte « EXERCICE … » et, pour chacune de ses
 * vingt et une lignes, un montant BUDGÉTISÉ, un montant RÉALISÉ et un solde ·
 * des chiffres d'une année écoulée. Lecture d'OmegaX · l'exercice E est
 * l'année civile E, et son bilan se dépose au plus tard le 31 janvier E+1
 * (art. 3), sans report au jour ouvrable (aucun n'est écrit).
 *
 * CE QUE LE DOSSIER DIT, ET CE QU'IL NE DIT PAS · les vingt et une lignes
 * (frais scolaires, funéraires, fêtes, soins, primes…) ne répondent à aucun
 * compte du plan · leurs nombres et leurs montants se SAISISSENT. Seule la
 * ligne 10 (« Rémunération annuelles ») reçoit une PROPOSITION, le total
 * versé des bulletins émis de l'année, jamais substituée · le formulaire ne
 * dit pas si la rémunération s'entend au sens de l'art. 7, point 8, et le
 * total versé comprend les natures que ce point en exclut. Les montants
 * versés à la CNSS, à l'INPP et à l'ONEM (lignes 12 à 14) ne sont pas
 * proposés · ce qui est VERSÉ se lit sur les reversements, pas sur les
 * cotisations dues que portent les bulletins.
 *
 * LES COLONNES · « (CDF/USD) » · chaque ligne chiffrée porte sa monnaie, et un
 * montant sans monnaie est refusé (comme un montant convenu au contrat). Le
 * SOLDE est le budgétisé moins le réalisé, lecture d'OmegaX, calculé quand
 * les deux sont saisis, jamais stocké. Le TOTAL s'additionne PAR MONNAIE,
 * jamais francs et dollars ensemble ; le total des « Nombre » n'est pas
 * calculé, ces nombres comptant des choses différentes (enfants, agents,
 * médailles).
 */

export const MODELE_BILAN_SOCIAL =
  "formulaire « Bilan social » de l'Office national de l'emploi (article 218 du Code du travail et arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023)";

export const FONDEMENT_BILAN_SOCIAL =
  "Code du travail, art. 218 ; arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023, art. 1er à 5 (J.O. RDC, première partie, n° 10 du 15 mai 2023), et le modèle de l'ONEM";

/** Les vingt et une lignes du formulaire, dans son ordre et sous ses intitulés. */
export const LIGNES_BILAN_SOCIAL = [
  'Frais scolaire enfants des travailleurs',
  'Frais funéraires',
  'Frais organisations fête 30 juin',
  'Frais organisations fête 1er Mai',
  'Journée internationale de la femme',
  'Restauration des travailleurs',
  'Soins médicaux+ médicaments',
  'Gratification',
  'Primes',
  'Rémunération annuelles',
  'Logement des agents',
  'Montant versé à la CNSS',
  'Montant versé à l’INPP',
  'Montant versé à l’ONEM',
  'Formation des travailleurs',
  'Pension et cadeaux retraites',
  'Médailles de mérite civique',
  'Transport des travailleurs',
  'Assurances',
  'Festivités fin d’année',
  'Imprévus et non budgétises',
].map((libelle, i) => ({ numero: i + 1, libelle }));

export const LIGNE_REMUNERATIONS = 10;
export const MONNAIES_BILAN_SOCIAL = ['CDF', 'USD'] as const;
export type MonnaieBilanSocial = (typeof MONNAIES_BILAN_SOCIAL)[number];

/** Une ligne telle que le cabinet la saisit · montants en chaînes décimales, deux décimales au plus. */
export interface SaisieLigneBilanSocial {
  numero: number;
  nombre: number | null;
  budgete: string | null;
  realise: string | null;
  devise: MonnaieBilanSocial | null;
}

export interface SaisieBilanSocial {
  lignes: SaisieLigneBilanSocial[];
  commentaire: string | null;
}

export const LONGUEUR_COMMENTAIRE = 4000;
const MONTANT = /^\d{1,16}(\.\d{1,2})?$/;

/** Les dates de l'exercice E · l'année civile E, déposée au plus tard le 31 janvier E+1 (art. 3). */
export function datesDuBilanSocial(exercice: number) {
  return { du: `${exercice}-01-01`, au: `${exercice}-12-31`, dateLimite: `${exercice + 1}-01-31` };
}

/**
 * Le motif du refus d'une saisie, ou null. Toute la saisie est jugée avant
 * d'être gardée · une ligne fausse refuse l'enregistrement entier, plutôt
 * qu'un bilan à moitié retenu.
 */
export function motifRefusSaisie(s: unknown): string | null {
  if (!s || typeof s !== 'object') return 'La saisie du bilan social est illisible.';
  const { lignes, commentaire } = s as Record<string, unknown>;
  if (!Array.isArray(lignes)) return 'Les lignes du bilan social sont illisibles.';
  if (lignes.length > LIGNES_BILAN_SOCIAL.length) return `Le formulaire compte ${LIGNES_BILAN_SOCIAL.length} lignes.`;
  if (commentaire !== null && commentaire !== undefined && (typeof commentaire !== 'string' || commentaire.length > LONGUEUR_COMMENTAIRE)) {
    return `Le commentaire se lit en texte, ${LONGUEUR_COMMENTAIRE} caractères au plus.`;
  }
  const vus = new Set<number>();
  for (const l of lignes as Record<string, unknown>[]) {
    const numero = l?.numero;
    if (!Number.isInteger(numero) || (numero as number) < 1 || (numero as number) > LIGNES_BILAN_SOCIAL.length) return 'Un numéro de ligne est hors du formulaire (1 à 21).';
    if (vus.has(numero as number)) return `La ligne ${numero} est saisie deux fois.`;
    vus.add(numero as number);
    const n = l.nombre;
    if (n !== null && n !== undefined && (!Number.isInteger(n) || (n as number) < 0 || (n as number) > 10_000_000)) return `Ligne ${numero} · le nombre se lit en entier positif.`;
    for (const champ of ['budgete', 'realise'] as const) {
      const v = l[champ];
      if (v !== null && v !== undefined && (typeof v !== 'string' || !MONTANT.test(v))) {
        return `Ligne ${numero} · le montant ${champ === 'budgete' ? 'budgétisé' : 'réalisé'} se lit en nombre positif, deux décimales au plus.`;
      }
    }
    const devise = l.devise;
    if (devise !== null && devise !== undefined && !MONNAIES_BILAN_SOCIAL.includes(devise as MonnaieBilanSocial)) return `Ligne ${numero} · la monnaie est CDF ou USD.`;
    const chiffree = (l.budgete ?? null) !== null || (l.realise ?? null) !== null;
    if (chiffree && (devise ?? null) === null) return `Ligne ${numero} · un montant exige sa monnaie (CDF ou USD).`;
  }
  return null;
}

/** La saisie ramenée à sa forme gardée · lignes triées, champs absents à null, lignes vides retirées. */
export function normaliserSaisie(s: SaisieBilanSocial): SaisieBilanSocial {
  const lignes = s.lignes
    .map((l) => ({
      numero: l.numero,
      nombre: l.nombre ?? null,
      budgete: l.budgete ?? null,
      realise: l.realise ?? null,
      devise: (l.budgete ?? null) === null && (l.realise ?? null) === null ? null : (l.devise ?? null),
    }))
    .filter((l) => l.nombre !== null || l.budgete !== null || l.realise !== null)
    .sort((a, b) => a.numero - b.numero);
  const commentaire = (s.commentaire ?? '').trim();
  return { lignes, commentaire: commentaire || null };
}

/** Les centimes d'un montant décimal en chaîne, sans flottant. */
function centimes(v: string): bigint {
  const [ent, dec = ''] = v.split('.');
  return BigInt(ent) * 100n + BigInt((dec + '00').slice(0, 2));
}

function enMontant(c: bigint): string {
  const signe = c < 0n ? '-' : '';
  const a = c < 0n ? -c : c;
  return `${signe}${a / 100n}.${(a % 100n).toString().padStart(2, '0')}`;
}

export interface IdentiteBilanSocial {
  nom: string;
  numeroAffiliationCnssEmployeur: string | null;
  activite: string | null;
  formeJuridique: string | null;
}

/**
 * Le formulaire rempli · identification, les vingt et une lignes (saisies,
 * solde calculé), le total par monnaie, la proposition de la ligne 10.
 * `effectifActif` · les salariés en vigueur au 31 décembre E (lecture
 * d'OmegaX de l'« effectif actif », dite) ; `remunerationsProposees` · le
 * total versé des bulletins émis de l'année en francs, ou null sans bulletin.
 */
export function formulaireBilanSocial(entree: {
  exercice: number;
  identite: IdentiteBilanSocial;
  effectifActif: number;
  remunerationsProposees: string | null;
  saisie: SaisieBilanSocial | null;
  enregistreLe: string | null;
  enregistrePar: string | null;
}) {
  const dates = datesDuBilanSocial(entree.exercice);
  const parNumero = new Map((entree.saisie?.lignes ?? []).map((l) => [l.numero, l]));
  const totaux = new Map<MonnaieBilanSocial, { budgete: bigint; realise: bigint; budgeteComplet: boolean; realiseComplet: boolean }>();
  const lignes = LIGNES_BILAN_SOCIAL.map(({ numero, libelle }) => {
    const s = parNumero.get(numero);
    const budgete = s?.budgete ?? null;
    const realise = s?.realise ?? null;
    const devise = s?.devise ?? null;
    if (devise) {
      const t = totaux.get(devise) ?? { budgete: 0n, realise: 0n, budgeteComplet: true, realiseComplet: true };
      if (budgete !== null) t.budgete += centimes(budgete);
      else t.budgeteComplet = false;
      if (realise !== null) t.realise += centimes(realise);
      else t.realiseComplet = false;
      totaux.set(devise, t);
    }
    return {
      numero,
      libelle,
      nombre: s?.nombre ?? null,
      budgete,
      realise,
      devise,
      // Le solde ne se calcule que sur les deux montants · un seul saisi n'est pas un solde.
      solde: budgete !== null && realise !== null ? enMontant(centimes(budgete) - centimes(realise)) : null,
      proposition: numero === LIGNE_REMUNERATIONS && entree.remunerationsProposees !== null
        ? { realise: entree.remunerationsProposees, devise: 'CDF' as const, origine: "total versé des bulletins émis de l'année, natures exclues de la rémunération par l'art. 7, point 8 du Code du travail comprises" }
        : null,
    };
  });
  const total = MONNAIES_BILAN_SOCIAL.filter((m) => totaux.has(m)).map((m) => {
    const t = totaux.get(m)!;
    return {
      devise: m,
      budgete: enMontant(t.budgete),
      realise: enMontant(t.realise),
      solde: enMontant(t.budgete - t.realise),
      // Une ligne chiffrée d'un seul côté · le total de l'autre colonne ne la compte pas, et c'est dit.
      incomplet: !t.budgeteComplet || !t.realiseComplet,
    };
  });
  return {
    exercice: entree.exercice,
    ...dates,
    identification: [
      { libelle: 'Nom ou raison sociale', valeur: entree.identite.nom },
      { libelle: 'Effectif actif', valeur: String(entree.effectifActif) },
      { libelle: 'N° Aff. CNSS', valeur: entree.identite.numeroAffiliationCnssEmployeur },
      { libelle: 'N° Aff. ONEM', valeur: null },
      { libelle: 'N° Aff. INPP', valeur: null },
      { libelle: 'Activité principale', valeur: entree.identite.activite },
      { libelle: 'Activités Secondaire', valeur: null },
      { libelle: 'Forme juridique', valeur: entree.identite.formeJuridique },
    ],
    effectifActifAu: dates.au,
    lignes,
    total,
    commentaire: entree.saisie?.commentaire ?? null,
    enregistreLe: entree.enregistreLe,
    enregistrePar: entree.enregistrePar,
    modele: MODELE_BILAN_SOCIAL,
    fondement: FONDEMENT_BILAN_SOCIAL,
  };
}
