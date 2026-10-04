/**
 * LIGNE A22 BIS · LA DÉPRÉCIATION D'UN BIEN EN COURS SUIT LE BIEN À SA MISE EN
 * SERVICE · règles pures.
 *
 * LA DÉCISION (Manasse, 2026-10-04), prise sur le relevé d'A22 · à la mise en
 * service, la dépréciation constatée sur le 29x9 pendant les travaux est
 * « reprise et dotée de nouveau sur le bien achevé ». Deux écritures, datées
 * de la mise en service, du même montant ·
 *   (1) REPRISE   D 29x9 / C 79 (ou 863) ;
 *   (2) DOTATION  D 69 (ou 853) / C 29 du compte définitif.
 * Le résultat net n'en bouge pas, et le bilan range enfin la dépréciation sous
 * le poste du bien achevé (au SYSCOHADA, le 2939 suivait le poste de l'en-cours
 * par `correspondance-bilan-syscohada.ts`, pas celui du 231).
 *
 * CE QUE LES TEXTES DISENT, LU AVANT D'ÉCRIRE (§ 1 du règlement intérieur).
 *  · Fiches du compte 29 des DEUX plans · le 29 « est crédité de la dotation
 *    [...] par le débit du 691 [...] ou du 853 », « débité de la reprise [...]
 *    par le crédit du 791 [...] ou du 863 » (AUDCIF Titre VII ; SYCEBNL
 *    Partie 2 ch. 3, « 69 – Dotations aux dépréciations ; ou 853 », « 79 –
 *    Reprises de dépréciations ; ou 863 »). La décision n'invente donc AUCUN
 *    virement de 29 à 29 · elle n'emploie que les deux mouvements écrits.
 *  · Fiches du compte 69 et du compte 79 des deux plans · « les dépréciations
 *    sont créées ou ajustées en hausse en débitant le compte 69 par le crédit
 *    du compte [...] 29 », « ajustées en baisse ou annulées en débitant le
 *    compte 29 par le crédit du compte 79 ». Subdivisions identiques aux deux ·
 *    6913 / 7913 pour les incorporelles, 6914 / 7914 pour les corporelles.
 *  · Fiche du compte 79 des deux plans, Exclusions · « les reprises H.A.O. →
 *    86 » · une dépréciation dotée en 853 se reprend en 863, et c'est le
 *    niveau de la DOTATION d'origine qui le dit (même règle que
 *    `compteRepriseDepreciation` à la sortie).
 *  · AUDCIF Titre VII ch. 2 · « les comptes 28 et 29 ont été développés selon
 *    la structure des comptes de la classe 2 » · le 29 du bien achevé est
 *    celui de sa division (2931 pour un 231, 2944 pour un 2444).
 *
 * UNE TENSION, ÉCRITE ET NON CACHÉE · les deux fiches du compte 29 disent que
 * les dotations « doivent être pratiquées à la clôture de l'exercice », et le
 * ch. 12 § 2.1 place le TEST à la clôture. Les deux écritures sont datées de
 * la mise en service · elles ne constatent aucune perte de valeur nouvelle et
 * n'en reprennent aucune, elles déplacent une dépréciation constatée à une
 * clôture antérieure vers le compte du bien qu'elle corrige. La dépréciation
 * reste jugée à la clôture suivante, sur son nouveau compte. C'est la décision
 * de l'éditeur, prise en connaissance de cette phrase (relevé d'A22).
 *
 * TROIS ABSTENTIONS, DITES (le 29x9 reste alors où il est, comme sous A22) ·
 *  · le Système minimal de trésorerie · son modèle n'ouvre aucun poste de
 *    dépréciation, et la dotation y serait publiée comme un amortissement
 *    (`motifRefusDepreciationSmt`) ;
 *  · une dotation d'origine imputée en partie sur l'écart de réévaluation
 *    (ch. 12 § 2.5) · la reprendre au 79 ferait entrer au résultat ce qui n'en
 *    est jamais sorti, la même abstention que la reprise d'un bien réévalué ;
 *  · des niveaux d'origine mêlés, ou autres que 691 et 853, ou une
 *    dépréciation déjà répartie sur plusieurs comptes · le module ne devine
 *    pas lequel reprendre où.
 */

import { estCompteDepreciationEnCours } from './depreciation-en-cours';

const EPSILON = 0.005;
const centimes = (x: number) => Math.round(x * 100) / 100;

export type ReferentielTransfert = 'SYSCOHADA' | 'SYCEBNL';
export type NiveauDepreciation = 'EXPLOITATION' | 'HAO';

/** Un mouvement de dépréciation enregistré par le module, numéros lus. */
export interface MouvementLu {
  sens: 'DOTATION' | 'REPRISE';
  montant: number;
  compteDepreciationId: string;
  numeroCompteDepreciation: string;
  numeroContrepartie: string;
  montantImputeEcart: number;
}

export type PropositionTransfert =
  | { etat: 'SANS_OBJET' }
  | { etat: 'ABSTENTION'; motif: string }
  | {
      etat: 'A_PASSER';
      montant: number;
      compteSourceId: string;
      numeroSource: string;
      niveau: NiveauDepreciation;
      /** Le compte de reprise (79 ou 863) et de dotation (69 ou 853), numéros semés aux deux plans. */
      numeroReprise: string;
      numeroDotation: string;
      /** La division du 29 du bien achevé · 29 + les deux chiffres qui suivent la classe du compte définitif. */
      racineCible: string;
    };

/**
 * Les comptes de dotation et de reprise · fiches 69 et 79 des deux plans,
 * mêmes numéros aux deux semis. La nature se lit sur le 29x9 · 2919 déprécie
 * un incorporel, 2929, 2939 et 2949 des corporels.
 */
function comptesDuNiveau(niveau: NiveauDepreciation, numeroSource: string): { reprise: string; dotation: string } {
  if (niveau === 'HAO') return { reprise: '86300000', dotation: '85300000' };
  return numeroSource.startsWith('291')
    ? { reprise: '79130000', dotation: '69130000' }
    : { reprise: '79140000', dotation: '69140000' };
}

/** La division du 29 qui corrige le compte définitif · 23110000 → 2931. */
export function racine29DuCompteDefinitif(numeroDefinitif: string): string {
  return `29${numeroDefinitif.slice(1, 3)}`;
}

/**
 * Ce que la mise en service fait de la dépréciation portée par le 29x9 ·
 * rien (SANS_OBJET), une abstention nommée, ou les deux écritures à passer.
 */
export function propositionTransfert(o: {
  smt: boolean;
  numeroCompteDefinitif: string;
  mouvements: readonly MouvementLu[];
}): PropositionTransfert {
  const cumuls = new Map<string, { cumul: number; numero: string }>();
  for (const m of o.mouvements) {
    const c = cumuls.get(m.compteDepreciationId) ?? { cumul: 0, numero: m.numeroCompteDepreciation };
    c.cumul = centimes(c.cumul + (m.sens === 'DOTATION' ? m.montant : -m.montant));
    cumuls.set(m.compteDepreciationId, c);
  }
  const porteurs = [...cumuls.entries()].filter(([, c]) => Math.abs(c.cumul) > EPSILON);
  const enCours = porteurs.filter(([, c]) => estCompteDepreciationEnCours(c.numero));
  if (enCours.length === 0) return { etat: 'SANS_OBJET' };

  const liste = enCours.map(([, c]) => `${c.cumul.toFixed(2)} au ${c.numero}`).join(', ');
  if (o.smt) {
    return {
      etat: 'ABSTENTION',
      motif:
        `La dépréciation constatée pendant les travaux (${liste}) n'est pas transférée · ce dossier tient le Système ` +
        "minimal de trésorerie, dont le modèle n'ouvre aucun poste de dépréciation, et la dotation y serait publiée " +
        'comme un amortissement.',
    };
  }
  if (porteurs.length > 1) {
    return {
      etat: 'ABSTENTION',
      motif:
        `La dépréciation de ce bien est répartie sur plusieurs comptes 29 (${porteurs.map(([, c]) => `${c.numero} ${c.cumul.toFixed(2)}`).join(', ')}) · ` +
        "OmegaX ne devine pas laquelle reprendre où, et le transfert à la mise en service n'est pas passé. Ramenez-la à un seul compte, puis transférez-la depuis la fiche du bien.",
    };
  }
  const [compteSourceId, source] = enCours[0];
  if (source.cumul < 0) {
    return {
      etat: 'ABSTENTION',
      motif: `Le compte ${source.numero} est débiteur pour ce bien (${source.cumul.toFixed(2)}) · une dépréciation est une correction d'actif de sens négatif (fiche du compte 29), rien n'est transféré.`,
    };
  }
  const dotations = o.mouvements.filter((m) => m.compteDepreciationId === compteSourceId && m.sens === 'DOTATION');
  if (dotations.some((m) => m.montantImputeEcart > EPSILON)) {
    return {
      etat: 'ABSTENTION',
      motif:
        `La dépréciation au ${source.numero} a été imputée en partie sur l'écart de réévaluation du bien (AUDCIF Titre VIII ` +
        "ch. 12 § 2.5) · la reprendre au 79 ferait entrer au résultat ce qui n'en est jamais sorti, et le texte ne dit pas comment la reprendre. Elle reste à ce compte.",
    };
  }
  const niveaux = new Set<NiveauDepreciation | 'AUTRE'>(
    dotations.map((m) => (m.numeroContrepartie.startsWith('853') ? 'HAO' : m.numeroContrepartie.startsWith('691') ? 'EXPLOITATION' : 'AUTRE')),
  );
  if (niveaux.size !== 1 || niveaux.has('AUTRE')) {
    return {
      etat: 'ABSTENTION',
      motif:
        `La dépréciation au ${source.numero} a été dotée par ${[...new Set(dotations.map((m) => m.numeroContrepartie))].join(', ')} · ` +
        'le transfert reprend et dote au même niveau (691 et 791, ou 853 et 863, fiches des comptes 29 et 79), et ce mélange ne permet pas de le dire. Elle reste à ce compte.',
    };
  }
  const niveau = [...niveaux][0] as NiveauDepreciation;
  const comptes = comptesDuNiveau(niveau, source.numero);
  return {
    etat: 'A_PASSER',
    montant: source.cumul,
    compteSourceId,
    numeroSource: source.numero,
    niveau,
    numeroReprise: comptes.reprise,
    numeroDotation: comptes.dotation,
    racineCible: racine29DuCompteDefinitif(o.numeroCompteDefinitif),
  };
}

/**
 * Le 29 du bien achevé · choisi par le cabinet, ou proposé quand le plan n'en
 * ouvre qu'un sous la division. Pourquoi ce compte ne convient pas · null s'il
 * convient.
 */
/*
 * La division vaut aux DEUX référentiels ici, quand `comptes-du-bien.ts` ne la
 * transpose pas au SYCEBNL pour une dotation ordinaire · c'est le contenu même
 * de la décision (« dotée de nouveau sur le bien achevé », le 29 qui corrige
 * SON compte), et le plan SYCEBNL ouvre la même structure (Partie 2 ch. 2 ·
 * 293 « Dépréciations des bâtiments, installations techniques et
 * agencements », 2931 « sur sol propre »).
 */
export function motifRefusCompteCible(numeroCible: string, racineCible: string): string | null {
  if (!numeroCible.startsWith('29')) {
    return `Le compte ${numeroCible} n'est pas un compte de dépréciation d'immobilisation (29) · fiche du compte 29.`;
  }
  if (estCompteDepreciationEnCours(numeroCible)) {
    return `Le compte ${numeroCible} déprécie une immobilisation EN COURS · le transfert porte la dépréciation au 29 du bien achevé.`;
  }
  if (!numeroCible.startsWith(racineCible.slice(0, 3))) {
    return (
      `Le compte ${numeroCible} ne correspond pas à la division du bien achevé · attendu un ${racineCible.slice(0, 3)}. ` +
      '« Les comptes 28 et 29 ont été développés selon la structure des comptes de la classe 2 » (AUDCIF, Titre VII ch. 2).'
    );
  }
  return null;
}

/**
 * Le compte proposé parmi les comptes de détail du plan · l'unique compte
 * sous la racine à quatre chiffres (2931), à défaut l'unique compte hors
 * en-cours sous la division (293). Plusieurs ou aucun · null, le cabinet
 * choisit.
 */
export function compteCiblePropose<T extends { numero: string }>(racineCible: string, candidats: readonly T[]): T | null {
  const admissibles = candidats.filter((c) => motifRefusCompteCible(c.numero, racineCible) === null);
  const fins = admissibles.filter((c) => c.numero.startsWith(racineCible));
  if (fins.length === 1) return fins[0];
  if (fins.length === 0 && admissibles.length === 1) return admissibles[0];
  return null;
}

/**
 * Le compte 29 qui porte la dépréciation d'un bien, et la contrepartie de sa
 * dernière DOTATION · pour la sortie et le reclassement.
 *
 * Le dernier mouvement ne suffit plus · après un transfert, l'exercice de la
 * mise en service porte DEUX mouvements (reprise au 29x9, dotation au 29 du
 * bien achevé) dont l'ordre de lecture n'est pas garanti, et la sortie aurait
 * pu solder le 29x9 déjà vide en laissant le 2931 au bilan. Le compte qui
 * PORTE le cumul est celui qui se solde ; la reprise suit le niveau de la
 * dotation (853 → 863), jamais la contrepartie d'une reprise.
 */
export function porteurDeLaDepreciation<
  M extends { sens: 'DOTATION' | 'REPRISE'; montant: number; compteDepreciationId: string; compteContrepartieId: string },
>(mouvements: readonly M[]): { compteDepreciationId: string; compteContrepartieDotationId: string | null } | null {
  if (mouvements.length === 0) return null;
  const cumuls = new Map<string, number>();
  for (const m of mouvements) {
    cumuls.set(m.compteDepreciationId, centimes((cumuls.get(m.compteDepreciationId) ?? 0) + (m.sens === 'DOTATION' ? m.montant : -m.montant)));
  }
  const porteurs = [...cumuls.entries()].filter(([, c]) => c > EPSILON);
  const porteur = porteurs.length === 1 ? porteurs[0][0] : mouvements[mouvements.length - 1].compteDepreciationId;
  const dotationsDuPorteur = mouvements.filter((m) => m.sens === 'DOTATION' && m.compteDepreciationId === porteur);
  const derniereDotation = dotationsDuPorteur.at(-1) ?? mouvements.filter((m) => m.sens === 'DOTATION').at(-1) ?? null;
  return { compteDepreciationId: porteur, compteContrepartieDotationId: derniereDotation?.compteContrepartieId ?? null };
}

/**
 * LE DERNIER TEST DE CLÔTURE PASSÉ AU OU APRÈS UNE DATE · null s'il n'y en a
 * pas. Cas réel (seconde relecture d'A22 bis) · un bien achevé le 2027-06-01
 * dont la mise en service n'avait pas été saisie a été testé au 29x9 aux
 * clôtures 2026 ET 2027. Sa mise en service se pose à sa VRAIE date (AUDCIF
 * art. 45, l'amortissement court de là), mais le transfert ne peut plus se
 * dater de ce jour · il reprendrait au 29x9, le 2027-06-01, une dépréciation
 * dotée le 2027-12-31. Il se passe alors au premier jour d'un exercice ouvert
 * qui commence APRÈS ce test (art. 22, 4°), pour tout ce que porte le 29x9.
 */
export function dernierTestDeClotureDepuis(
  mouvements: readonly { nature: string; exercice: { dateFin: Date }; compteDepreciation: { numero: string } }[],
  date: Date,
): Date | null {
  let dernier: Date | null = null;
  for (const m of mouvements) {
    // Seuls les tests passés AU 29x9 comptent · un test au 29 du bien achevé
    // ne reprend rien au compte en cours.
    if (m.nature !== 'CLOTURE' || !estCompteDepreciationEnCours(m.compteDepreciation.numero) || m.exercice.dateFin < date) continue;
    if (!dernier || m.exercice.dateFin > dernier) dernier = m.exercice.dateFin;
  }
  return dernier;
}

/** Ce que la mise en service et l'aperçu disent quand le transfert attend un exercice postérieur. */
export function motifTransfertDiffere(numeroSource: string, montant: number, dernierTest: Date): string {
  const jour = dernierTest.toISOString().slice(0, 10);
  return (
    `La dépréciation de ${montant.toFixed(2)} au ${numeroSource} a été testée à la clôture du ${jour}, après la date de mise ` +
    'en service · elle reste à ce compte, et le transfert ne se passe pas à cette date (il reprendrait une dépréciation dotée ' +
    `après lui). Transférez-la avec « Transférer la dépréciation » dans un exercice ouvert qui commence après le ${jour} · ` +
    'le transfert est daté de son premier jour (AUDCIF art. 22, 4°) et porte tout ce que le compte en cours garde pour ce bien.'
  );
}
