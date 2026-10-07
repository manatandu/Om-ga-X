import { FormeJuridiqueSyscohada, RegimeLiquidation } from '@prisma/client';
import { echeanceDepassee } from '../../common/echeance';
import { FORMES_SOCIETES_COMMERCIALES } from '../tenant/mentions-societe';
import { reporterAuJourOuvrable } from '../retenues/jour-ouvrable';
import { jourFr, observationDuFait, type JalonServi } from './portefeuille-etat';

/**
 * LA LIQUIDATION D'UNE SOCIÉTÉ COMMERCIALE AU PLANNING DE CLÔTURE (décision
 * par la loi du 2026-10-04, point 4, `docs/decisions-par-la-loi-2026-10-04.md`).
 *
 * UN EXERCICE ARRÊTÉ À LA DISSOLUTION, PUIS UN SEUL EXERCICE DE LIQUIDATION
 * (décision par la loi du 2026-10-07, point 2, qui précise celle du
 * 2026-10-04). La loi fiscale exige l'arrêté des comptes hors du 31 décembre
 * « en cas de cession ou de cessation d'activité en cours d'année » (loi
 * n° 23/053, art. 12 al. 1) et une cotisation spéciale sur « les résultats de
 * la période pendant laquelle l'activité a été exercée » (art. 13 al. 1) · la
 * période du 1er janvier à la dissolution est un exercice ARRÊTÉ à cette date,
 * dont le bilan est le « bilan avant liquidation » (AUDCIF Titre VIII ch. 40
 * § 2.1). La liquidation forme ensuite UN SEUL exercice, du lendemain de la
 * dissolution à sa clôture, « sous réserve de l'établissement de situations
 * annuelles provisoires » (AUDCIF art. 7 al. 4) · une à chaque 31 décembre
 * qu'il traverse, que l'AUSCGIE art. 232 appelle « états financiers de
 * synthèse annuels » dans les cas de l'art. 223. Aucun « anniversaire » de la
 * dissolution n'est calculé. Un dossier tenu à l'année civile pendant sa
 * liquidation garde sa situation au 31 décembre de chaque exercice.
 *
 * CHAPITRE 1 (AUSCGIE art. 203 à 222), toute liquidation de société
 * commerciale sauf procédure collective (art. 203 al. 2) · bilan avant
 * liquidation à la dissolution (AUDCIF Titre VIII ch. 40 § 2.1), publication
 * de la nomination dans le mois (art. 266), clôture dans les trois ans de la
 * dissolution (art. 216), comptes définitifs, assemblée de clôture et dépôt
 * au RCCM (art. 217 et 219), radiation dans le mois de la publication de la
 * clôture (art. 220).
 * CHAPITRE 2 (art. 224 à 241) « exclusivement » dans les deux cas de
 * l'art. 223 · rapport dans les six mois de la nomination (art. 228), états
 * annuels et rapport écrit dans les trois mois de chaque clôture (art. 232),
 * assemblée dans les six mois, à défaut rapport déposé au RCCM (art. 233).
 *
 * AUCUN DÉLAI AU TEXTE, AUCUNE ÉCHÉANCE · le bilan avant liquidation
 * (ch. 40 § 2.1) et la situation annuelle provisoire (art. 7 al. 4) n'ont pas
 * de délai écrit · leur date reste dans `debut`, l'échéance est `null`, et
 * rien ne passe « en retard » le lendemain de la dissolution ou de la clôture.
 *
 * ASSOCIÉ UNIQUE PERSONNE MORALE (art. 201 al. 4) · la dissolution
 * « entraîne la transmission universelle du patrimoine de la société à cet
 * associé, sans qu'il y ait lieu à liquidation » · aucun jalon de liquidation,
 * le planning le dit en une ligne satisfaite. Elle reste dissoute (art. 201
 * et 202 · publication de la dissolution).
 *
 * Rien n'est déduit · la dissolution, la nomination, le régime et la clôture
 * de la liquidation sont DÉCLARÉS ; sans la date qui fait courir un délai,
 * l'échéance est `null` (« Non calculée »).
 *
 * LA COOPÉRATIVE (décision par la loi du 2026-10-07, quatrième lot, points 6
 * et 7, `docs/decisions-par-la-loi-2026-10-07-quater.md`) · dissoute, elle est
 * « de plein droit » en liquidation (AUSCOOP art. 180), sa personnalité
 * subsiste « jusqu'à la publication de la clôture » (art. 184), la clôture
 * intervient dans les trois ans (art. 191), ses comptes définitifs se déposent
 * à l'autorité des sociétés coopératives (art. 192) et la radiation suit dans
 * le mois (art. 193). Les jalons PROPRES de l'AUSCGIE ne la visent que par
 * l'AUSCOOP, art. 196 · « à défaut de clauses statutaires relatives à la
 * liquidation amiable », sa liquidation suit « les dispositions pertinentes et
 * compatibles des articles 203 à 241 » de l'AUSCGIE. Le régime déclaré le dit ·
 * selon les statuts (art. 182), aucun jalon de l'AUSCGIE ; à défaut de clause
 * (art. 223, 1° par l'art. 196) ou sur décision de justice, les art. 228, 232
 * et 233. Ni la publication de l'art. 266 (hors des art. 203 à 241) ni les
 * sanctions pénales des art. 902 et 903 de l'AUSCGIE ne lui sont servies · un
 * texte pénal ne s'étend pas par renvoi.
 */

/** Étape du planning qui porte la liquidation · après l'affectation (26). */
export const ETAPE_LIQUIDATION = 27;

/** AUSCGIE art. 902 · le liquidateur, sciemment (toute liquidation). */
const SANCTION_902_1 =
  'Article 902, 1° de l’AUSCGIE · encourt une sanction pénale le liquidateur qui, sciemment, n’a pas, dans le délai ' +
  'd’un mois à compter de sa nomination, publié l’acte le nommant liquidateur et déposé au registre du commerce et ' +
  'du crédit mobilier les décisions prononçant la dissolution.';
const SANCTION_902_2_3 =
  'Article 902, 2° et 3° de l’AUSCGIE · encourt une sanction pénale le liquidateur qui, sciemment, n’a pas convoqué ' +
  'les associés en fin de liquidation pour statuer sur le compte définitif, le quitus et la décharge et constater la ' +
  'clôture, ou n’a pas, dans le cas de l’article 219, déposé ses comptes définitifs au registre du commerce et du ' +
  'crédit mobilier, ni demandé en justice leur approbation.';
/** AUSCGIE art. 903 · « Lorsque la liquidation intervient sur décision judiciaire » seulement. */
const SANCTION_903_1 =
  'Article 903, 1° de l’AUSCGIE (liquidation sur décision judiciaire) · encourt une sanction pénale le liquidateur ' +
  'qui, sciemment, n’a pas, dans les six mois de sa nomination, présenté un rapport sur la situation active et ' +
  'passive de la société et sur la poursuite des opérations, ni sollicité les autorisations nécessaires.';
const SANCTION_903_2 =
  'Article 903, 2° de l’AUSCGIE (liquidation sur décision judiciaire) · encourt une sanction pénale le liquidateur ' +
  'qui, sciemment, n’a pas, dans les trois mois de la clôture de chaque exercice, établi les états financiers de ' +
  'synthèse au vu de l’inventaire et un rapport écrit rendant compte des opérations de la liquidation.';

/** Les formes dont la dissolution est suivie de liquidation au planning · les
 * cinq sociétés commerciales (AUSCGIE art. 203) et la coopérative (AUSCOOP
 * art. 180). */
export const FORMES_EN_LIQUIDATION: readonly FormeJuridiqueSyscohada[] = [
  ...FORMES_SOCIETES_COMMERCIALES,
  FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE,
];

export function formeEnLiquidation(forme: FormeJuridiqueSyscohada | null | undefined): boolean {
  return !!forme && FORMES_EN_LIQUIDATION.includes(forme);
}

/**
 * UN DÉLAI EN MOIS SE COMPTE DE DATE À DATE (décision par la loi du
 * 2026-10-07, quatrième lot, point 5) · par analogie de l'AUPSRVE, art. 1-14,
 * al. 2, seul Acte uniforme du corpus qui compte un délai en mois · « il
 * expire le jour du dernier mois [...] qui porte le même quantième que le jour
 * de l'acte [...] ; à défaut de quantième identique, il expire le dernier jour
 * du mois ».
 */
export function plusMois(d: Date, n: number): Date {
  const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), Math.min(d.getUTCDate(), dernier)));
}

/**
 * L'AUTRE LECTURE DU MOIS, dite au détail (point 5) · le Code de procédure
 * civile de 1960, art. 195 (« le jour de l'acte [...] n'y est pas compris » ;
 * « de quantième à veille de quantième »), donne plus tard que l'AUPSRVE
 * quand l'événement tombe le DERNIER jour d'un mois plus court que celui
 * d'arrivée (30 juin · 30 juillet contre 31 juillet). La date servie est la
 * plus précoce, qui satisfait les deux lectures ; `null` quand elles
 * coïncident.
 */
export function autreLectureDuMois(evenement: Date, n: number): Date | null {
  const dernierDuMois = new Date(Date.UTC(evenement.getUTCFullYear(), evenement.getUTCMonth() + 1, 0)).getUTCDate();
  if (evenement.getUTCDate() !== dernierDuMois) return null;
  const finDuMoisDArrivee = new Date(Date.UTC(evenement.getUTCFullYear(), evenement.getUTCMonth() + n + 1, 0));
  const servie = plusMois(evenement, n);
  return finDuMoisDArrivee.getTime() === servie.getTime() ? null : finDuMoisDArrivee;
}

const dansLExercice = (d: Date, e: { dateDebut: Date; dateFin: Date }) =>
  d.getTime() >= e.dateDebut.getTime() && d.getTime() <= e.dateFin.getTime();

const JOUR_MS = 86_400_000;

/** Le lendemain de la dissolution · premier jour de l'exercice de liquidation. */
export function lendemainDe(d: Date): Date {
  return new Date(d.getTime() + JOUR_MS);
}

/**
 * L'EXERCICE DE LIQUIDATION · celui qui commence le lendemain de la
 * dissolution déclarée (AUDCIF art. 7 al. 4 ; décision par la loi du
 * 2026-10-07, point 2). Lu sur les dates, jamais sur un drapeau · la
 * création le refuse à toute autre date dès que la dissolution est déclarée.
 */
export function estExerciceDeLiquidation(exercice: { dateDebut: Date }, dateDissolution: Date | null): boolean {
  return !!dateDissolution && exercice.dateDebut.getTime() === lendemainDe(dateDissolution).getTime();
}

/**
 * LES SITUATIONS ANNUELLES PROVISOIRES DE L'EXERCICE (décision par la loi du
 * 2026-10-07, quatrième lot, point 6) · chaque 31 décembre STRICTEMENT compris
 * entre la dissolution et la clôture de la liquidation que l'exercice traverse
 * (AUDCIF art. 7 al. 2 et 4 · un seul exercice « sous réserve de
 * l'établissement de situations annuelles provisoires », l'année étant
 * civile). Un 31 décembre qui EST la clôture déclarée n'en est pas une · ses
 * comptes sont les comptes définitifs (AUSCGIE art. 217 et 219). Clôture non
 * déclarée, la fin de l'exercice de liquidation reste provisoire · un
 * 31 décembre qui la porte est une situation tant que la clôture n'y est pas
 * déclarée, l'exercice de liquidation ne se clôturant qu'à la clôture de la
 * liquidation (`ExerciceService.cloturer`).
 */
export function situationsAnnuelles(
  dissolution: Date,
  exercice: { dateDebut: Date; dateFin: Date },
  clotureLiquidation: Date | null,
): Date[] {
  const situations: Date[] = [];
  for (let a = exercice.dateDebut.getUTCFullYear(); a <= exercice.dateFin.getUTCFullYear(); a++) {
    const d = new Date(Date.UTC(a, 11, 31));
    if (d.getTime() <= dissolution.getTime() || !dansLExercice(d, exercice)) continue;
    if (clotureLiquidation && d.getTime() >= clotureLiquidation.getTime()) continue;
    situations.push(d);
  }
  return situations;
}

/**
 * LA SOCIÉTÉ DISSOUTE SANS LIQUIDATION · associé unique personne morale hors
 * procédure collective (AUSCGIE art. 201 al. 4, « sans qu'il y ait lieu à
 * liquidation » ; décision par la loi du 2026-10-07, point 1).
 */
export function sansLiquidation(faits: {
  forme: FormeJuridiqueSyscohada | null;
  regimeLiquidation: RegimeLiquidation | null;
  associeUniquePersonneMorale?: boolean | null;
}): boolean {
  return (
    !!faits.forme &&
    FORMES_SOCIETES_COMMERCIALES.includes(faits.forme) &&
    faits.associeUniquePersonneMorale === true &&
    faits.regimeLiquidation !== RegimeLiquidation.PROCEDURE_COLLECTIVE
  );
}

/**
 * L'EXERCICE ARRÊTÉ À UNE DISSOLUTION SANS LIQUIDATION EST LE DERNIER
 * (relecture du 2026-10-07, majeur 2) · la société dissoute par l'associé
 * unique personne morale ne se liquide pas, son patrimoine lui est transmis
 * (AUSCGIE art. 201 al. 4). Sa clôture suit la branche de fin, comme celle de
 * la liquidation · aucun exercice ne suit, aucun report à-nouveau, et les
 * comptes encore soldés se DISENT.
 */
export function estFinSansLiquidation(
  exercice: { dateFin: Date },
  dossier: {
    dateDissolution: Date | null;
    formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null;
    regimeLiquidation: RegimeLiquidation | null;
    associeUniquePersonneMorale?: boolean | null;
  },
): boolean {
  return (
    !!dossier.dateDissolution &&
    exercice.dateFin.getTime() === dossier.dateDissolution.getTime() &&
    sansLiquidation({
      forme: dossier.formeJuridiqueSyscohada,
      regimeLiquidation: dossier.regimeLiquidation,
      associeUniquePersonneMorale: dossier.associeUniquePersonneMorale,
    })
  );
}

/**
 * LOI N° 23/053, ART. 12 AL. 4, ET ART. 13 (décision par la loi du
 * 2026-10-07, quatrième lot, point 2) · UNE assiette, celle de l'année de la
 * dissolution, payée en DEUX cotisations. La seconde se calcule sur le total
 * des résultats de la période d'activité et de l'exercice de liquidation
 * entier, impôt minimum compris, moins la première cotisation et les acomptes
 * qui la suivent · `FiscaliteService.resultatFiscal`, bloc `bilansSuccessifs`,
 * le sert sur l'exercice de liquidation.
 */
export const TOTALISATION_ARTICLE_12_AL_4 =
  'Lorsqu’il est dressé des bilans successifs au cours d’une même année, les résultats en sont totalisés pour ' +
  'l’assiette de l’impôt dû au titre de ladite année · la première cotisation se calcule sur la période ' +
  'd’activité, la seconde sur le total de l’année de la dissolution, moins ce qui est déjà réglé (État > ' +
  'Résultat fiscal, sur l’exercice de liquidation).';

/** Les faits DÉCLARÉS de la dissolution et de la liquidation. */
export interface FaitsLiquidation {
  forme: FormeJuridiqueSyscohada | null;
  dateDissolution: Date | null;
  dateNominationLiquidateur: Date | null;
  regimeLiquidation: RegimeLiquidation | null;
  associeUniquePersonneMorale?: boolean | null;
  /** Clôture de la liquidation déclarée (AUSCGIE art. 216 et 217) · jamais future. */
  dateClotureLiquidation?: Date | null;
}

export function jalonsLiquidation(
  faits: FaitsLiquidation,
  exercice: { dateDebut: Date; dateFin: Date },
  aujourdHui: Date,
): JalonServi[] {
  const dissolution = faits.dateDissolution;
  if (!dissolution || !formeEnLiquidation(faits.forme)) return [];
  // Les exercices d'AVANT la dissolution ne sont pas en liquidation.
  if (exercice.dateFin.getTime() < dissolution.getTime()) return [];
  const cooperative = faits.forme === FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE;
  // Un texte pénal ne s'étend pas par renvoi · les sanctions de l'AUSCGIE ne
  // sont servies qu'à la société commerciale.
  const sanction = (texte: string) => (cooperative ? null : texte);
  const clotureDeclaree = faits.dateClotureLiquidation ?? null;

  const jalon = (j: Omit<JalonServi, 'etape' | 'sanction' | 'enRetard'> & { sanction?: string | null }): JalonServi => ({
    etape: ETAPE_LIQUIDATION,
    ...j,
    sanction: j.sanction ?? null,
    enRetard: j.echeance !== null && echeanceDepassee(j.echeance, aujourdHui) && !(j.observation?.satisfait ?? false),
  });
  const exerciceDeDissolution = dansLExercice(dissolution, exercice);

  // LA PROCÉDURE COLLECTIVE PASSE AVANT L'ASSOCIÉ UNIQUE (décision par la loi
  // du 2026-10-07, point 1). Jugement de liquidation des biens (AUSCGIE
  // art. 200, 6°) · le patrimoine est sous le dessaisissement de l'AUPCAP
  // (art. 53), réalisé par le syndic pour les créanciers · la transmission
  // universelle de l'art. 201 al. 4 ne joue pas, même à un associé unique
  // personne morale, et les art. 203 à 241 ne s'appliquent pas (art. 203 al. 2).
  if (faits.regimeLiquidation === RegimeLiquidation.PROCEDURE_COLLECTIVE) {
    return [
      jalon({
        libelle: 'Liquidation dans une procédure collective',
        detail:
          'La liquidation intervient dans le cadre de l’Acte uniforme portant organisation des procédures ' +
          'collectives d’apurement du passif · les dispositions générales de la liquidation des sociétés ne ' +
          's’appliquent pas, et aucun jalon n’est calculé ici. La décision qui prononce la liquidation des biens ' +
          'emporte dessaisissement du débiteur, ses actes étant accomplis par le syndic' +
          (faits.associeUniquePersonneMorale === true
            ? ' · la transmission universelle du patrimoine à l’associé unique personne morale ne joue pas.'
            : '.'),
        nature: 'LEGALE',
        source:
          faits.associeUniquePersonneMorale === true
            ? 'AUSCGIE, art. 200, 6°, 201 al. 4 et 203 al. 2 ; AUPCAP, art. 53'
            : 'AUSCGIE, art. 203 al. 2 ; AUPCAP, art. 53',
        debut: dissolution,
        echeance: null,
        observation: { libelle: 'Hors des articles 203 à 241 de l’AUSCGIE', satisfait: true },
      }),
    ];
  }

  // Art. 201 al. 4 · aucune liquidation · le planning le dit, sans rien dater.
  if (sansLiquidation(faits)) {
    return exerciceDeDissolution
      ? [
          jalon({
            libelle: 'Dissolution sans liquidation · associé unique personne morale',
            detail:
              'Tous les titres étant détenus par un seul associé personne morale, la dissolution « entraîne la ' +
              'transmission universelle du patrimoine de la société à cet associé, sans qu’il y ait lieu à ' +
              'liquidation » · aucun jalon de liquidation n’est servi, et les pièces ne portent pas la mention ' +
              '« société en liquidation ». La transmission n’est réalisée qu’à l’issue du délai d’opposition des ' +
              'créanciers (trente jours de la publication de la dissolution).',
            nature: 'LEGALE',
            source: 'AUSCGIE, art. 201 al. 4 et 202',
            debut: dissolution,
            echeance: null,
            observation: { libelle: 'Aucune liquidation à conduire', satisfait: true },
          }),
        ]
      : [];
  }

  const jalons: JalonServi[] = [];
  const nomination = faits.dateNominationLiquidateur;

  if (exerciceDeDissolution) {
    jalons.push(
      jalon({
        libelle: 'Bilan avant liquidation',
        detail:
          'Au début de la liquidation · inventaire du patrimoine, solde des amortissements et des provisions ' +
          'existants, établissement du bilan avant liquidation à la date de dissolution. Le texte ne fixe AUCUN ' +
          'DÉLAI · aucune échéance n’est calculée. La continuité d’exploitation n’étant plus assurée, ' +
          'l’évaluation des biens est reconsidérée (AUDCIF art. 39). Les opérations de liquidation passent aux ' +
          'comptes 837 et 847, leur résultat au 1384 « Résultat de liquidation », le capital à rembourser aux ' +
          'associés au 4619. Les actes et documents destinés aux tiers portent la mention « société en ' +
          (cooperative
            ? 'liquidation » et le nom du ou des liquidateurs (AUSCOOP art. 183).'
            : 'liquidation » et le nom du ou des liquidateurs (AUSCGIE art. 204).'),
        // ANOMALIE DU TEXTE, signalée et non suivie · le ch. 40 § 2.2.1 écrit
        // « 1374 : Résultat de liquidation », compte qu'aucun plan n'ouvre ·
        // le Titre VII (compte 13) n'ouvre que 1384 « Résultat de
        // liquidation » sous 138, le 137 n'étant pas subdivisé, et le Guide
        // d'application passe toutes ses écritures au 1384 (le semis porte
        // 13840000).
        nature: 'LEGALE',
        source: cooperative
          ? 'AUDCIF, Titre VIII ch. 40 § 2.1 et § 2.2 ; Titre VII, compte 13 (1384) ; art. 39 ; AUSCOOP, art. 180 et 183'
          : 'AUDCIF, Titre VIII ch. 40 § 2.1 et § 2.2 ; Titre VII, compte 13 (1384) ; art. 39 ; AUSCGIE, art. 204',
        debut: dissolution,
        echeance: null,
        sansDelai: true,
      }),
    );
  }
  // L'art. 266 est hors des art. 203 à 241 · la coopérative ne le reçoit pas
  // par l'AUSCOOP, art. 196.
  if (!cooperative && (nomination ? dansLExercice(nomination, exercice) : exerciceDeDissolution)) {
    const publication = nomination ? plusMois(nomination, 1) : null;
    jalons.push(
      jalon({
        libelle: 'Publication de la nomination du liquidateur',
        detail:
          'L’acte de nomination du ou des liquidateurs, quelle que soit sa forme, est publié dans un journal ' +
          'habilité à recevoir les annonces légales dans le délai d’un mois à compter de la nomination. ' +
          (nomination
            ? 'Délai compté depuis la nomination déclarée.'
            : 'Échéance non calculée · déclarez la date de nomination dans Paramètres du dossier.'),
        nature: 'LEGALE',
        source: 'AUSCGIE, art. 266',
        sanction: SANCTION_902_1,
        debut: nomination,
        echeance: publication,
      }),
    );
  }
  // DEUX JALONS, DEUX RÉGIMES (relecture 2) · le délai de trois ans (art.
  // 216) n'est assorti d'aucune sanction pénale · à défaut, le ministère
  // public ou tout intéressé saisit le juge (al. 2). L'art. 902, 2° et 3°
  // punit l'absence de CONVOCATION de fin de liquidation et de DÉPÔT des
  // comptes définitifs (art. 217 et 219), qui n'ont pas de date au texte.
  const cloture = plusMois(dissolution, 36);
  // La clôture DÉCLARÉE lève le jalon (règle commune des faits déclarés) ·
  // sans elle, il resterait rouge pour toujours passé les trois ans.
  const observationCloture = observationDuFait(
    { passe: 'Liquidation clôturée', prevu: 'Clôture prévue' },
    faits.dateClotureLiquidation ?? null,
    cloture,
    aujourdHui,
  );
  jalons.push(
    jalon({
      libelle: 'Clôture de la liquidation',
      detail:
        'La clôture de la liquidation intervient dans un délai de trois ans à compter de la dissolution. À défaut, ' +
        'le ministère public ou tout intéressé peut saisir la juridiction compétente du siège afin qu’il soit ' +
        'procédé à la liquidation ou à son achèvement. Déclarez la date de clôture dans Paramètres du dossier.',
      nature: 'LEGALE',
      source: cooperative ? 'AUSCOOP, art. 191' : 'AUSCGIE, art. 216',
      debut: dissolution,
      echeance: cloture,
      observation: observationCloture,
    }),
    jalon({
      libelle: 'Comptes définitifs, assemblée de clôture et dépôt au registre',
      detail: cooperative
        ? 'Les comptes définitifs établis par le liquidateur sont déposés auprès de l’autorité chargée des sociétés ' +
          'coopératives, avec la décision de l’assemblée des coopérateurs statuant sur les comptes de la liquidation, ' +
          'le quitus et la décharge du liquidateur, ou à défaut la décision de justice. Le liquidateur demande la ' +
          'radiation au Registre des Sociétés Coopératives dans le mois de la publication de la clôture · délai non ' +
          'calculé, la date de cette publication n’étant pas déclarée.'
        : 'En fin de liquidation, les associés sont convoqués pour statuer sur les comptes définitifs, le quitus et ' +
          'la décharge du liquidateur, et constater la clôture ; les comptes définitifs sont déposés au registre du ' +
          'commerce et du crédit mobilier avec cette décision, ou avec la décision de justice qui en tient lieu. Le ' +
          'texte ne fixe aucun délai pour ces actes, sinon la clôture dans les trois ans. Le liquidateur demande la ' +
          'radiation dans le mois de la publication de la clôture · délai non calculé, la date de cette publication ' +
          'n’étant pas déclarée.',
      nature: 'LEGALE',
      source: cooperative ? 'AUSCOOP, art. 192 et 193' : 'AUSCGIE, art. 217, 218, 219 et 220',
      sanction: sanction(SANCTION_902_2_3),
      debut: null,
      echeance: null,
      sansDelai: true,
    }),
  );

  if (faits.regimeLiquidation === null) {
    // RÉGIME NON DÉCLARÉ · rien de plus n'est calculé, et le manque se voit.
    jalons.push(
      jalon({
        libelle: 'Régime de la liquidation à déclarer',
        detail: cooperative
          ? 'Le régime de la liquidation n’est pas déclaré · selon les statuts, aucun article de l’AUSCGIE ne ' +
            's’applique ; à défaut de clauses statutaires, la liquidation suit les articles 203 à 241 de l’AUSCGIE, ' +
            'états annuels et assemblée du liquidateur compris (articles 228, 232 et 233). Déclarez-le dans ' +
            'Paramètres du dossier.'
          : 'Le régime de la liquidation n’est pas déclaré · les états annuels et l’assemblée du liquidateur ' +
            '(articles 228, 232 et 233) ne s’appliquent que dans les deux cas de l’article 223, et la seule ' +
            'situation annuelle provisoire de l’AUDCIF dans les autres. Déclarez-le dans Paramètres du dossier.',
        nature: 'LEGALE',
        source: cooperative ? 'AUSCOOP, art. 182 et 196 ; AUDCIF, art. 7 al. 4' : 'AUSCGIE, art. 203 et 223 ; AUDCIF, art. 7 al. 4',
        debut: dissolution,
        echeance: null,
      }),
    );
    return jalons;
  }

  const chapitre2 =
    faits.regimeLiquidation === RegimeLiquidation.ARTICLE_223_1 ||
    faits.regimeLiquidation === RegimeLiquidation.ARTICLE_223_2_JUDICIAIRE;
  const judiciaire = faits.regimeLiquidation === RegimeLiquidation.ARTICLE_223_2_JUDICIAIRE;
  if (chapitre2) {
    if (nomination ? dansLExercice(nomination, exercice) : exerciceDeDissolution) {
      const rapport = nomination ? plusMois(nomination, 6) : null;
      jalons.push(
        jalon({
          libelle: 'Rapport du liquidateur à l’assemblée des associés',
          detail:
            'Dans les six mois de sa nomination, le liquidateur convoque l’assemblée des associés et lui fait ' +
            'rapport sur l’actif et le passif, la poursuite des opérations et le délai pour les terminer · délai ' +
            'portable à douze mois par décision de justice. ' +
            (nomination ? '' : 'Échéance non calculée · déclarez la date de nomination.'),
          nature: 'LEGALE',
          source: cooperative ? 'AUSCOOP, art. 196 ; AUSCGIE, art. 223 et 228' : 'AUSCGIE, art. 223 et 228',
          sanction: judiciaire ? sanction(SANCTION_903_1) : null,
          debut: nomination,
          echeance: rapport,
        }),
      );
    }
    // Les états annuels des art. 232 et 233 SONT les situations annuelles de
    // l'AUDCIF art. 7 al. 4 (décision par la loi du 2026-10-07, quatrième lot,
    // point 6) · un jeu par 31 décembre STRICTEMENT compris entre la
    // dissolution et la clôture, compté de cette date (31 mars, 30 juin). Ce
    // sont des obligations du liquidateur en fonctions · un jalon dont
    // l'échéance suit la clôture déclarée n'est plus servi, la fin relevant des
    // comptes définitifs (art. 217 et 219).
    const avantLaCloture = (echeance: Date) => !clotureDeclaree || echeance.getTime() <= clotureDeclaree.getTime();
    const source232 = cooperative
      ? 'AUSCOOP, art. 196 ; AUSCGIE, art. 223 et 232 ; AUDCIF, art. 7 al. 2 et 4'
      : 'AUSCGIE, art. 223 et 232 ; AUDCIF, art. 7 al. 2 et 4';
    const source233 = cooperative ? 'AUSCOOP, art. 196 ; AUSCGIE, art. 225 et 233' : 'AUSCGIE, art. 225 et 233';
    for (const situation of situationsAnnuelles(dissolution, exercice, clotureDeclaree)) {
      const etats = plusMois(situation, 3);
      const assemblee = plusMois(situation, 6);
      jalons.push(
        ...(avantLaCloture(etats) ? [jalon({
          libelle: 'États financiers annuels et rapport écrit du liquidateur',
          detail:
            `Situation au ${jourFr(situation)} · dans les trois mois de la clôture de l’exercice, le liquidateur ` +
            'établit les états financiers de synthèse annuels au vu de l’inventaire, et un rapport écrit rendant ' +
            'compte des opérations de la liquidation au cours de l’exercice écoulé. La liquidation formant un seul ' +
            'exercice, ces états sont les situations annuelles provisoires, arrêtées à chaque 31 décembre.',
          nature: 'LEGALE',
          source: source232,
          sanction: judiciaire ? sanction(SANCTION_903_2) : null,
          debut: situation,
          echeance: etats,
        })] : []),
        ...(avantLaCloture(assemblee) ? [jalon({
          libelle: 'Assemblée des associés sur les états annuels de liquidation',
          detail:
            `Situation au ${jourFr(situation)} · sauf dispense de la juridiction compétente, le liquidateur ` +
            'convoque l’assemblée des associés au moins une fois par an et dans les six mois de la clôture de ' +
            'l’exercice · elle statue sur les états financiers annuels et renouvelle, le cas échéant, le mandat du ' +
            'commissaire aux comptes, qui reste en fonctions. Si l’assemblée n’est pas réunie, le rapport écrit du ' +
            'liquidateur est déposé au registre du commerce et du crédit mobilier.',
          nature: 'LEGALE',
          source: source233,
          debut: situation,
          echeance: assemblee,
        })] : []),
      );
    }
  } else {
    for (const situation of situationsAnnuelles(dissolution, exercice, clotureDeclaree)) {
      jalons.push(
        jalon({
          libelle: 'Situation annuelle provisoire de liquidation',
          detail:
            `Situation au ${jourFr(situation)} · la durée des opérations de liquidation compte pour un seul ` +
            'exercice, sous réserve de situations annuelles provisoires, arrêtées à chaque 31 décembre que ' +
            'l’exercice traverse (situation intermédiaire du logiciel). Le texte ne fixe AUCUN DÉLAI pour les ' +
            'établir · aucune échéance n’est calculée. ' +
            (cooperative
              ? 'Liquidation amiable selon les statuts · les articles 203 à 241 de l’AUSCGIE ne s’appliquent pas.'
              : 'Liquidation amiable selon les statuts · les articles 224 à 241 ne s’appliquent pas.'),
          nature: 'LEGALE',
          source: cooperative ? 'AUDCIF, art. 7 al. 2 et 4 ; AUSCOOP, art. 182 et 196' : 'AUDCIF, art. 7 al. 2 et 4 ; AUSCGIE, art. 223',
          debut: situation,
          echeance: null,
          sansDelai: true,
        }),
      );
    }
  }
  return jalons;
}

/** Les faits qui font courir et lèvent les deux cotisations spéciales. */
export interface FaitsCotisationsSpeciales extends FaitsLiquidation {
  dateDeclarationCotisationActivite?: Date | null;
  dateDeclarationCotisationLiquidation?: Date | null;
}

/**
 * LE PÉRIMÈTRE DES COTISATIONS SPÉCIALES (décision par la loi du 2026-10-07,
 * quatrième lot, point 7) · la loi n° 23/053 dit « société » de tous ses
 * redevables, et range « les sociétés coopératives » parmi eux (art. 3) · les
 * cinq sociétés commerciales et la coopérative du SYSCOHADA, procédure
 * collective comprise (« en cas de dissolution d'une société », sans
 * distinguer la cause · AUPCAP art. 53). La coopérative agricole de forme
 * civile, exemptée (art. 5, 2°), ne les doit pas · aucun champ du dossier ne
 * porte ce fait, et le détail le dit.
 */
export function cotisationsDues(faits: { forme: FormeJuridiqueSyscohada | null; dateDissolution: Date | null }): boolean {
  return !!faits.dateDissolution && formeEnLiquidation(faits.forme);
}

const RESERVE_COOPERATIVE_EXEMPTEE =
  ' La coopérative agricole de production, de transformation, de conservation ou de vente qui revêt la forme ' +
  'civile est exemptée de l’impôt sur les sociétés et ne doit pas ces cotisations · le dossier ne porte pas ce ' +
  'fait, à vérifier par le cabinet.';

/** L'échéance de la déclaration « dans le mois » (LPF art. 16), date à date, reportée au jour ouvrable. */
export function echeanceDansLeMois(evenement: Date): Date {
  return reporterAuJourOuvrable(plusMois(evenement, 1), 'DECLARATION');
}

/** La mention de l'autre lecture du mois (point 5), vide quand les deux coïncident. */
function mentionAutreLecture(evenement: Date): string {
  const autre = autreLectureDuMois(evenement, 1);
  return autre
    ? ` Lu de quantième à veille de quantième (Code de procédure civile de 1960, art. 195), le mois finirait le ` +
        `${jourFr(autre)} · l’échéance servie est la plus précoce, qui satisfait les deux lectures.`
    : '';
}

/**
 * L'ÉCHÉANCE DE LA DERNIÈRE COTISATION (point 3) · la seconde, dans le mois
 * de la clôture de la liquidation · la première, quand il n'y a pas de
 * liquidation (AUSCGIE art. 201 al. 4). `null` · la clôture n'est pas
 * encore déclarée, l'échéance n'existe pas encore.
 */
export function echeanceDerniereCotisation(faits: FaitsCotisationsSpeciales): Date | null {
  if (!faits.dateDissolution) return null;
  if (sansLiquidation(faits)) return echeanceDansLeMois(faits.dateDissolution);
  return faits.dateClotureLiquidation ? echeanceDansLeMois(faits.dateClotureLiquidation) : null;
}

/**
 * L'EXERCICE QUI PORTE LA SECONDE COTISATION (constat 8 de la relecture) ·
 * celui qui contient la clôture déclarée, qu'il contienne aussi la
 * dissolution ou non ; à défaut (clôture non déclarée, ou déclarée hors de
 * tout exercice), l'exercice de liquidation, puis le dernier exercice qui
 * finit après la dissolution. Sans cette règle, une clôture déclarée hors de
 * l'exercice de liquidation, ou un exercice non arrêté qui contient la
 * dissolution et la clôture, faisaient disparaître la cotisation.
 */
export function exercicePorteurSecondeCotisation(
  exercices: Array<{ id: string; dateDebut: Date; dateFin: Date }>,
  faits: FaitsCotisationsSpeciales,
): string | null {
  const dissolution = faits.dateDissolution;
  if (!dissolution || !cotisationsDues(faits) || sansLiquidation(faits)) return null;
  const cloture = faits.dateClotureLiquidation ?? null;
  if (cloture) {
    const contient = exercices.find((e) => dansLExercice(cloture, e));
    if (contient) return contient.id;
  }
  const liquidation = exercices.find((e) => estExerciceDeLiquidation(e, dissolution));
  if (liquidation) return liquidation.id;
  const apres = exercices
    .filter((e) => e.dateFin.getTime() >= dissolution.getTime())
    .sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime());
  return apres[0]?.id ?? null;
}

/**
 * L'IMPÔT ANNUEL CÈDE AUX COTISATIONS (décision par la loi du 2026-10-07,
 * quatrième lot, point 4) · la LPF, art. 16, règle spéciale, déroge à
 * l'échéance annuelle de l'art. 12 « en cas de dissolution, de liquidation de
 * société » · aucune déclaration annuelle de l'IS n'est due pour l'année de la
 * dissolution ni pour les suivantes. Un exercice dont la fin tombe dans
 * l'année de la dissolution ou après ne sert plus la déclaration du 30 avril.
 */
export function impotAnnuelCedeAuxCotisations(
  faits: { forme: FormeJuridiqueSyscohada | null; dateDissolution: Date | null },
  exercice: { dateFin: Date },
): boolean {
  return (
    cotisationsDues(faits) && exercice.dateFin.getUTCFullYear() >= faits.dateDissolution!.getUTCFullYear()
  );
}

/**
 * LES DEUX COTISATIONS SPÉCIALES DE LA DISSOLUTION (décisions par la loi du
 * 2026-10-07, point 2, et quatrième lot, points 2, 4, 5 et 7) · loi
 * n° 23/053, art. 13 · « En cas de dissolution d'une société […], une
 * cotisation spéciale est réglée immédiatement […] d'après les résultats de la
 * période pendant laquelle l'activité a été exercée. En cas de dissolution de
 * la société suivie de liquidation, une autre cotisation spéciale est réglée
 * d'après les résultats accusés par le dernier bilan de liquidation. » LPF
 * art. 16 · « la déclaration doit être remise dans le mois et, en tout cas,
 * avant que le dirigeant ne quitte la République Démocratique du Congo ».
 * Un mois DATE À DATE (point 5), reporté au premier jour ouvrable (LPF
 * art. 110 bis, al. 2).
 *
 * CE QU'ELLES REMPLACENT · servies sous l'étape 15, elles prennent la place
 * de la déclaration annuelle de l'impôt sur les sociétés
 * (`impotAnnuelCedeAuxCotisations`).
 *
 * `porteurSeconde` · l'exercice porte la seconde cotisation
 * (`exercicePorteurSecondeCotisation`, lu par le service sur tous les
 * exercices du dossier) ; absent, la règle se lit sur l'exercice seul.
 */
export function cotisationsSpeciales(
  faits: FaitsCotisationsSpeciales,
  exercice: { dateDebut: Date; dateFin: Date; clos: boolean },
  aujourdHui: Date,
  options: { porteurSeconde?: boolean } = {},
): JalonServi[] {
  const dissolution = faits.dateDissolution;
  if (!dissolution || !cotisationsDues(faits)) return [];
  if (exercice.dateFin.getTime() < dissolution.getTime()) return [];
  const cooperative = faits.forme === FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE;
  const reserveCooperative = cooperative ? RESERVE_COOPERATIVE_EXEMPTEE : '';
  const enRetard = (echeance: Date | null, observation?: { satisfait: boolean }) =>
    echeance !== null && echeanceDepassee(echeance, aujourdHui) && !(observation?.satisfait ?? false);
  const quitterLaRdc = ' et, en tout cas, avant que le dirigeant ne quitte la République démocratique du Congo.';
  const jalons: JalonServi[] = [];

  if (dansLExercice(dissolution, exercice)) {
    const echeance = echeanceDansLeMois(dissolution);
    const observation = observationDuFait(
      { passe: 'Déclarée', prevu: 'Déclaration prévue' },
      faits.dateDeclarationCotisationActivite ?? null,
      echeance,
      aujourdHui,
    );
    const arrete = exercice.dateFin.getTime() === dissolution.getTime();
    jalons.push({
      etape: 15,
      libelle: 'Déclaration de la cotisation spéciale (période d’activité)',
      detail:
        'En cas de dissolution, une cotisation spéciale est réglée immédiatement d’après les résultats de la ' +
        'période pendant laquelle l’activité a été exercée · la déclaration se remet dans le mois de la ' +
        `dissolution${quitterLaRdc}${mentionAutreLecture(dissolution)} ` +
        (arrete
          ? 'L’exercice est arrêté à la date de dissolution · son bilan est le bilan avant liquidation. '
          : 'L’exercice n’est pas arrêté à la date de dissolution · arrêtez-le dans la fenêtre Exercices, la loi ' +
            'fiscale exigeant l’arrêté des comptes en cas de cessation en cours d’année. ') +
        (sansLiquidation(faits)
          ? 'Sans liquidation, cette cotisation est la seule de l’année de la dissolution. '
          : `${TOTALISATION_ARTICLE_12_AL_4} `) +
        `Déclarez la date de dépôt dans Paramètres du dossier.${reserveCooperative}`,
      nature: 'LEGALE',
      source:
        'Loi n° 23/053, art. 3, 12 al. 1 et 4 et art. 13 al. 1 et 3 ; loi de procédures fiscales, art. 16 et 110 bis ; ' +
        'AUDCIF, Titre VIII ch. 40 § 2.1 ; AUPSRVE, art. 1-14 (délai en mois)',
      sanction: null,
      debut: dissolution,
      echeance,
      observation,
      enRetard: enRetard(echeance, observation),
    });
  }

  // La seconde · sur l'exercice qui la porte (constat 8). En ATTENTE tant
  // que la clôture ne peut pas encore être intervenue (un fait futur ne se
  // déclare pas), NON CALCULÉE ensuite.
  if (!sansLiquidation(faits)) {
    const clotureL = faits.dateClotureLiquidation ?? null;
    const porteur =
      options.porteurSeconde ??
      (clotureL
        ? dansLExercice(clotureL, exercice)
        : estExerciceDeLiquidation(exercice, dissolution) ||
          (!exercice.clos && exercice.dateDebut.getTime() > dissolution.getTime()));
    if (porteur) {
      const echeance = clotureL ? echeanceDansLeMois(clotureL) : null;
      const observation = observationDuFait(
        { passe: 'Déclarée', prevu: 'Déclaration prévue' },
        faits.dateDeclarationCotisationLiquidation ?? null,
        echeance,
        aujourdHui,
      );
      const enAttente = !clotureL && !exercice.clos && aujourdHui.getTime() <= exercice.dateFin.getTime();
      const horsExercice = clotureL && !dansLExercice(clotureL, exercice);
      jalons.push({
        etape: 15,
        libelle: 'Déclaration de la cotisation spéciale (dernier bilan de liquidation)',
        detail:
          'En cas de dissolution suivie de liquidation, une autre cotisation spéciale est réglée d’après les ' +
          'résultats accusés par le dernier bilan de liquidation, rattachée à l’exercice désigné par le millésime de ' +
          `l’année de la dissolution · la déclaration se remet dans le mois de la clôture de la liquidation${quitterLaRdc} ` +
          (clotureL
            ? `Délai compté depuis la clôture déclarée le ${jourFr(clotureL)}.${mentionAutreLecture(clotureL)} ` +
              (horsExercice
                ? `Cette clôture tombe hors de l’exercice (du ${jourFr(exercice.dateDebut)} au ${jourFr(exercice.dateFin)}) · ` +
                  'portez la fin de l’exercice de liquidation à la date de clôture. '
                : '')
            : 'Échéance non calculée · déclarez la date de clôture de la liquidation dans Paramètres du dossier une ' +
              'fois intervenue. ') +
          TOTALISATION_ARTICLE_12_AL_4 +
          reserveCooperative,
        nature: 'LEGALE',
        source:
          'Loi n° 23/053, art. 11, 1°, 12 al. 4 et 13 al. 2 et 3 ; loi de procédures fiscales, art. 16 et 110 bis ; ' +
          'AUPSRVE, art. 1-14 (délai en mois)',
        sanction: null,
        debut: clotureL,
        echeance,
        ...(enAttente ? { enAttente: 'En attente de la clôture de la liquidation' } : {}),
        observation,
        enRetard: enRetard(echeance, observation),
      });
    }
  }
  return jalons;
}

/** Une ligne de l'échéancier fiscal que la dissolution fait naître. */
export interface EcheanceCotisation {
  cle: 'cotisationSpecialeActivite' | 'cotisationSpecialeLiquidation';
  libelle: string;
  date: Date;
  echeance: string;
  baseLegale: string;
  reserve: string | null;
}

/**
 * L'ÉCHÉANCIER FISCAL D'UNE SOCIÉTÉ DISSOUTE (décision par la loi du
 * 2026-10-07, quatrième lot, points 3, 4 et 5 ; constat 9 de la relecture).
 *
 * (1) LA DÉCLARATION ANNUELLE DE L'IS cède pour l'année de la dissolution et
 * les suivantes (LPF art. 16 sur l'art. 12) · l'occurrence du 30 avril de
 * l'année Y vise les revenus de Y - 1, retirée dès que Y - 1 atteint l'année de
 * la dissolution.
 * (2) LES ACOMPTES (LPF art. 57 bis) · dus dans l'année de la dissolution
 * jusqu'à l'échéance de la dernière cotisation, à déduire de la cotisation
 * dont la déclaration les suit ; jamais pour une année suivante (tous les
 * bénéfices de la liquidation sont rattachés à l'année de la dissolution,
 * art. 13 al. 3), ni après la dernière cotisation.
 * (3) LES DEUX DÉCLARATIONS DE COTISATION, chacune tant qu'elle n'est pas
 * déclarée déposée et que son échéance n'est pas passée (une date échue n'est
 * pas la prochaine).
 */
export function echeancierDissolution(
  faits: FaitsCotisationsSpeciales,
  reference: Date,
): {
  /** Le dossier doit les cotisations (société ou coopérative dissoute). */
  cotisationsDues: boolean;
  /** L'occurrence ANNUELLE d'une obligation (date de sa prochaine échéance) est-elle encore due ? */
  retenir: (cle: string, prochaine: Date) => boolean;
  /** Mention ajoutée à un acompte encore dû. */
  mentionAcompte: string | null;
  cotisations: EcheanceCotisation[];
  avertissements: string[];
} {
  const dissolution = faits.dateDissolution;
  if (!dissolution || !cotisationsDues(faits)) {
    return { cotisationsDues: false, retenir: () => true, mentionAcompte: null, cotisations: [], avertissements: [] };
  }
  const anneeDissolution = dissolution.getUTCFullYear();
  const derniere = echeanceDerniereCotisation(faits);
  const acompte = /^(premier|deuxieme|troisieme)AcompteIs$/;
  const retenir = (cle: string, prochaine: Date) => {
    if (cle === 'declarationImpotSocietes') return prochaine.getUTCFullYear() - 1 < anneeDissolution;
    if (acompte.test(cle)) {
      const annee = prochaine.getUTCFullYear();
      if (annee < anneeDissolution) return true;
      if (annee > anneeDissolution) return false;
      return !derniere || prochaine.getTime() < derniere.getTime();
    }
    return true;
  };
  const cotisations: EcheanceCotisation[] = [];
  const avertissements: string[] = [];
  const aServir = (date: Date, deposee: Date | null | undefined) => !deposee && !echeanceDepassee(date, reference);
  const premiere = echeanceDansLeMois(dissolution);
  if (aServir(premiere, faits.dateDeclarationCotisationActivite)) {
    cotisations.push({
      cle: 'cotisationSpecialeActivite',
      libelle: 'Déclaration de la cotisation spéciale (période d’activité)',
      date: premiere,
      echeance:
        `Dans le mois de la dissolution du ${jourFr(dissolution)}, et en tout cas avant que le dirigeant ne quitte ` +
        `la République démocratique du Congo${mentionAutreLecture(dissolution)}`,
      baseLegale:
        'Loi n° 23/053, art. 13 al. 1 et 3 · « une cotisation spéciale est réglée immédiatement par chaque société ' +
        'd’après les résultats de la période pendant laquelle l’activité a été exercée » ; loi de procédures ' +
        'fiscales, art. 16 et 110 bis',
      reserve: null,
    });
  }
  if (!sansLiquidation(faits)) {
    const cloture = faits.dateClotureLiquidation ?? null;
    if (cloture) {
      const seconde = echeanceDansLeMois(cloture);
      if (aServir(seconde, faits.dateDeclarationCotisationLiquidation)) {
        cotisations.push({
          cle: 'cotisationSpecialeLiquidation',
          libelle: 'Déclaration de la cotisation spéciale (dernier bilan de liquidation)',
          date: seconde,
          echeance:
            `Dans le mois de la clôture de la liquidation du ${jourFr(cloture)}, et en tout cas avant que le ` +
            `dirigeant ne quitte la République démocratique du Congo${mentionAutreLecture(cloture)}`,
          baseLegale:
            'Loi n° 23/053, art. 12 al. 4 et 13 al. 2 et 3 · impôt de l’année de la dissolution, sur le total des ' +
            'résultats de la période d’activité et de la liquidation, moins ce qui est déjà réglé ; loi de procédures ' +
            'fiscales, art. 16 et 110 bis',
          reserve: null,
        });
      }
    } else if (!faits.dateDeclarationCotisationLiquidation) {
      avertissements.push(
        'Société dissoute · la seconde cotisation spéciale (dernier bilan de liquidation) se déclare dans le mois de ' +
          'la clôture de la liquidation · échéance non calculée tant que la clôture n’est pas déclarée dans ' +
          'Paramètres du dossier. Les acomptes de l’année de la dissolution restent dus jusque-là.',
      );
    }
  }
  const mentionAcompte =
    'Société dissoute · acompte de l’année de la dissolution, à déduire de la cotisation spéciale dont la ' +
    'déclaration le suit (LPF art. 57 bis, al. 3) ; aucun acompte n’est dû pour les années suivantes.';
  return { cotisationsDues: true, retenir, mentionAcompte, cotisations, avertissements };
}
