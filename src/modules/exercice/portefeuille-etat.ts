import { FormeJuridiqueSyscohada } from '@prisma/client';
import { echeanceDepassee } from '../../common/echeance';

/**
 * ENTREPRISE RELEVANT DU PORTEFEUILLE DE L'ÉTAT · le calendrier de clôture
 * que lui impose l'ordonnance-loi n° 13/003 du 23 février 2013 (décision par
 * la loi du 2026-10-04, point 1, `docs/decisions-par-la-loi-2026-10-04.md`).
 *
 * Art. 112, VERBATIM : « Les entreprises relevant du portefeuille de l'Etat
 * ont l'obligation de tenir leurs assemblées générales ordinaires statuant
 * sur les résultats de l'exercice clos au 31 décembre de chaque année au
 * plus tard le 31 mars de l'année qui suit celle de réalisation des revenus,
 * et d'en communiquer le procès-verbal à l'Administration des recettes non
 * fiscales dans les dix (10) jours qui suivent la tenue de ces assemblées. »
 *
 * Art. 113 · l'affectation des résultats « doit intervenir endéans soixante
 * (60) jours, à compter de la date de dépôt des états financiers à
 * l'administration compétente du ministère ayant le portefeuille de l'Etat
 * dans ses attributions ». Art. 115 · en vigueur à la publication au J.O.,
 * le 27 février 2013.
 *
 * TROIS RÈGLES À NE PAS DÉFAIRE.
 * (1) Le 31 mars ne vaut que pour un exercice CLOS AU 31 DÉCEMBRE, comme le
 *     texte l'écrit · sur une autre clôture, rien n'est calculé et le jalon
 *     le dit. Il REMPLACE les six mois de l'approbation (AUSCGIE art. 140
 *     et AUDCIF art. 72), qu'il ne contredit pas.
 * (2) Les dix jours se comptent depuis la date de l'assemblée DÉCLARÉE (à
 *     défaut, au plus tard dix jours après le 31 mars, dit comme tel), les
 *     soixante depuis le dépôt DÉCLARÉ · sans lui, aucune échéance (`null`),
 *     jamais une date supposée. Jours CALENDAIRES · l'O.-L.
 *     n° 13/003 ne pose aucune règle de jour ouvrable, et l'art. 110 bis LPF
 *     ne régit que « la législation fiscale ».
 * (3) Le procès-verbal à l'Administration des recettes non fiscales S'AJOUTE
 *     à celui de la DGI (LPF art. 13 bis), il ne le remplace pas.
 *
 * SEULE LA DATE DE L'ASSEMBLÉE CHANGE (relecture 2) · les délais comptés à
 * rebours d'elle restent ceux que le planning de base applique à CHAQUE
 * forme. Les quarante-cinq jours de l'AUSCGIE art. 140 ne visent que « les
 * sociétés anonymes, les sociétés par actions simplifiées et, le cas
 * échéant, [...] les sociétés à responsabilité limitée » ; ceux de l'AUDCIF
 * art. 71 l'envoi aux commissaires aux comptes « s'ils existent ». La SNC et
 * la SCS communiquent leurs documents aux associés « au moins quinze (15)
 * jours avant » l'assemblée (AUSCGIE art. 288 et 306), et l'associé de SARL
 * exerce son droit de communication « durant les quinze (15) jours
 * précédant » (art. 345). Un commissaire se lit sur la table des mandats ·
 * sans mandat enregistré, le délai qui le suppose n'est pas calculé, et
 * aucun retard n'est fabriqué.
 *
 * NON SERVI, et dit · le dividende prioritaire des entreprises MINIÈRES du
 * portefeuille (art. 112 quater, inséré par la LF 2025 ; « déclaré au plus
 * tard le 15 mai » par la LF 2026), que le corpus ne donne qu'en résumé,
 * sous deux numéros d'article différents · à confirmer sur le texte même de
 * la loi de finances avant tout calcul. Aucune sanction n'est chiffrée · les
 * art. 112 et 113 n'en posent pas.
 */

/** Art. 115 · publication au Journal officiel. */
export const ENTREE_EN_VIGUEUR_OL_13_003 = new Date(Date.UTC(2013, 1, 27));

const SOURCE_112 = 'Ordonnance-loi n° 13/003 du 23 février 2013, art. 112 ; loi n° 08/010 du 7 juillet 2008, art. 3';
const SOURCE_113 = 'Ordonnance-loi n° 13/003 du 23 février 2013, art. 113';

/** Le jalon tel que le planning le sert (`ExerciceService.planningCloture`). */
export interface JalonServi {
  etape: number;
  libelle: string;
  detail: string;
  nature: 'INTERNE' | 'LEGALE';
  source: string;
  sanction: string | null;
  debut: Date | null;
  /** `null` · échéance NON CALCULÉE, faute de la date que le texte fait courir. */
  echeance: Date | null;
  /**
   * Le TEXTE ne fixe aucun délai (bilan avant liquidation, situation annuelle
   * provisoire) · `echeance` est `null` par construction, et ce n'est pas un
   * manque du dossier · l'écran dit « Aucun délai », pas « Non calculée ».
   */
  sansDelai?: true;
  /**
   * Le jalon ATTEND un fait qui ne peut pas encore exister (le dépôt pendant
   * l'exercice) ou dont dépend son délai (un commissaire aux comptes) · dit
   * à la place de l'échéance, jamais compté comme une échéance non calculée.
   */
  enAttente?: string;
  enRetard: boolean;
  observation?: ObservationJalon;
}

/**
 * Ce qu'OmegaX sait du jalon · `horsDelai` · le fait déclaré le lève, mais
 * après son échéance (l'écran le montre en ambre, jamais en vert muet).
 */
export interface ObservationJalon {
  libelle: string;
  satisfait: boolean;
  horsDelai?: true;
}

const JOUR_MS = 86_400_000;
const plusJours = (d: Date, n: number) => new Date(d.getTime() + n * JOUR_MS);
/** Un mois DATE À DATE, ramené au dernier jour du mois d'arrivée (31 mars · 30 avril). */
function plusUnMois(d: Date): Date {
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)).getUTCDate();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, Math.min(d.getUTCDate(), dernier)));
}

/** L'exercice est-il clos au 31 décembre, seul cas que vise l'art. 112 ? */
export function closAu31Decembre(dateFin: Date): boolean {
  return dateFin.getUTCMonth() === 11 && dateFin.getUTCDate() === 31;
}

/** Un jour écrit JJ/MM/AAAA · la date d'un fait déclaré, dans une observation. */
export function jourFr(d: Date): string {
  const iso = d.toISOString().slice(0, 10);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * UNE SEULE RÈGLE POUR UN FAIT DÉCLARÉ QUI LÈVE UN JALON (relecture 2) ·
 * assemblée, communication du procès-verbal, dépôt, affectation.
 * - Daté au plus tard d'aujourd'hui (jour de Kinshasa) · il lève le jalon.
 * - Postérieur à l'échéance · il le lève aussi, mais le libellé le dit
 *   (« après l'échéance du ») et `horsDelai` le marque · une assemblée tenue
 *   le 15 avril restait rouge à vie, un procès-verbal tardif passait au vert
 *   sans un mot.
 * - FUTUR · « prévu le », et il ne lève rien (seule l'assemblée future est
 *   admise au serveur, pour les délais comptés à rebours d'elle).
 */
export function observationDuFait(
  fait: { passe: string; prevu: string },
  date: Date | null,
  echeance: Date | null,
  aujourdHui: Date,
): ObservationJalon | undefined {
  if (!date) return undefined;
  if (date.getTime() > aujourdHui.getTime()) return { libelle: `${fait.prevu} le ${jourFr(date)}`, satisfait: false };
  if (echeance && date.getTime() > echeance.getTime()) {
    return {
      libelle: `${fait.passe} le ${jourFr(date)}, après l’échéance du ${jourFr(echeance)}`,
      satisfait: true,
      horsDelai: true,
    };
  }
  return { libelle: `${fait.passe} le ${jourFr(date)}`, satisfait: true };
}

/** Les faits DÉCLARÉS qui font courir ou lèvent les délais de l'O.-L. n° 13/003. */
export interface FaitsPortefeuille {
  dateFin: Date;
  /** Forme de l'exercice · décide des délais comptés à rebours de l'assemblée. */
  forme: FormeJuridiqueSyscohada;
  /**
   * Un commissaire aux comptes couvre l'exercice (mandat enregistré, ou
   * prorogé) · `null` quand la table des mandats n'en dit rien, jamais lu
   * « pas de commissaire ».
   */
  commissaireDesigne: boolean | null;
  /** L'exercice est clôturé · le dépôt des états est alors possible. */
  exerciceClos: boolean;
  dateAssembleeGenerale: Date | null;
  dateDepotEtatsPortefeuille: Date | null;
  /** Communication du PV à l'Administration des recettes non fiscales · lève le jalon. */
  dateTransmissionPvPortefeuille: Date | null;
  /** Décision d'affectation enregistrée (fenêtre Affectation) · lève le jalon. */
  dateDecisionAffectation: Date | null;
}

/**
 * Applique au planning d'un exercice SYSCOHADA les échéances de l'O.-L.
 * n° 13/003, quand le dossier a DÉCLARÉ relever du portefeuille de l'État.
 * Rend le planning tel quel pour un exercice clos avant le 27 février 2013.
 *
 * JAMAIS UN ROUGE QU'AUCUN GESTE NE LÈVE · l'assemblée (étapes 21 et 23) se
 * lève par sa date déclarée au plus tard le 31 mars, le procès-verbal par sa
 * date de communication déclarée, l'affectation par la décision enregistrée
 * dans la fenêtre Affectation · chacune en OBSERVATION, comme les jalons que
 * le logiciel sait vérifier.
 */
export function appliquerPortefeuilleEtat(jalons: JalonServi[], faits: FaitsPortefeuille, aujourdHui: Date): JalonServi[] {
  if (faits.dateFin.getTime() < ENTREE_EN_VIGUEUR_OL_13_003.getTime()) return jalons;
  const enRetard = (echeance: Date | null, observation?: { satisfait: boolean }) =>
    echeance !== null && echeanceDepassee(echeance, aujourdHui) && !(observation?.satisfait ?? false);
  // Un début ne suit jamais son échéance · ramené à elle quand le délai raccourcit.
  const debutBorne = (debut: Date | null, echeance: Date) =>
    debut && debut.getTime() <= echeance.getTime() ? debut : echeance;

  const clos31 = closAu31Decembre(faits.dateFin);
  const trenteEtUnMars = new Date(Date.UTC(faits.dateFin.getUTCFullYear() + 1, 2, 31));
  // La base des délais à rebours et du RCCM (art. 269, un mois) ·
  // l'assemblée déclarée, FUTURE comprise, sinon la date limite du 31 mars.
  const assembleeDeReference = faits.dateAssembleeGenerale ?? trenteEtUnMars;
  const reference = faits.dateAssembleeGenerale
    ? faits.dateAssembleeGenerale.getTime() > aujourdHui.getTime()
      ? 'l’assemblée prévue'
      : 'l’assemblée déclarée'
    : 'la date limite du 31 mars (art. 112)';
  const delais = delaisAvantAssemblee(faits.forme, faits.commissaireDesigne);

  // L'assemblée DÉCLARÉE lève les étapes 21 et 23 · la règle commune des faits.
  const observationAssemblee = observationDuFait(
    { passe: 'Assemblée tenue', prevu: 'Assemblée prévue' },
    faits.dateAssembleeGenerale,
    trenteEtUnMars,
    aujourdHui,
  );

  /** Recale un jalon sur un délai à rebours, ou le met en attente du commissaire. */
  const aRebours = (j: JalonServi, regle: RegleARebours | null, borne: boolean): JalonServi => {
    if (regle === null) {
      return {
        ...j,
        detail:
          `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · l’assemblée se tient au plus tard le 31 mars ; le ` +
          'délai de quarante-cinq jours ne vaut que si un commissaire aux comptes est désigné (« le cas échéant », ' +
          'AUSCGIE art. 140 ; « s’ils existent », AUDCIF art. 71), et aucun mandat n’est enregistré pour cet ' +
          'exercice · enregistrez-le dans la fenêtre du mandat du contrôleur des comptes pour que l’échéance se calcule.',
        source: `${j.source} ; ${SOURCE_112}`,
        debut: null,
        echeance: null,
        enAttente: 'Sans commissaire enregistré',
        enRetard: false,
      };
    }
    const echeance = plusJours(assembleeDeReference, -regle.jours);
    if (borne && j.echeance && j.echeance.getTime() <= echeance.getTime()) return j;
    return {
      ...j,
      detail:
        `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · ${borne ? 'borné à' : 'compté à'} ` +
        `${regle.jours === 45 ? 'quarante-cinq' : 'quinze'} jours avant ${reference} · ${regle.motif}`,
      source: `${j.source} ; ${SOURCE_112} ; ${regle.source}`,
      debut: debutBorne(j.debut, echeance),
      echeance,
      enRetard: enRetard(echeance, j.observation),
    };
  };

  const resultat = jalons.map((j): JalonServi => {
    if (!clos31) return j;
    // Étapes 21 (approbation) et 23 (assemblée) · le 31 mars REMPLACE les six mois.
    if (j.etape === 21 || j.etape === 23) {
      const echeance = trenteEtUnMars;
      const observation = observationAssemblee ?? j.observation;
      return {
        ...j,
        detail:
          `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · l’assemblée générale ordinaire statuant sur les ` +
          'résultats de l’exercice clos au 31 décembre se tient « au plus tard le 31 mars de l’année qui suit celle ' +
          'de réalisation des revenus » (ordonnance-loi n° 13/003, art. 112) · cette échéance remplace les six mois. ' +
          'Déclarez la date de l’assemblée dans la fenêtre Exercices.',
        source: `${j.source} ; ${SOURCE_112}`,
        debut: debutBorne(j.debut, echeance),
        echeance,
        observation,
        enRetard: enRetard(echeance, observation),
      };
    }
    // Étape 17 · l'envoi aux commissaires de l'art. 140 (SA, SAS, SARL « le
    // cas échéant ») · servie par le planning de base à ces seules formes.
    if (j.etape === 17) return aRebours(j, delais.commissaire140, false);
    // Étape 18 · la remise au commissaire de l'AUDCIF art. 71 (« s'ils
    // existent »), toute forme.
    if (j.etape === 18) return aRebours(j, delais.commissaire71, false);
    // Étapes 13 (états financiers) et 16 (rapport de gestion) · ils doivent
    // exister à la date d'envoi ou de communication · le 30 avril tomberait
    // après l'assemblée elle-même. Bornés à cette date, jamais repoussés.
    if (j.etape === 13 || j.etape === 16) return aRebours(j, delais.documents, true);
    // Étape 24 · le dépôt au RCCM « dans le mois qui suit » l'approbation
    // (AUSCGIE art. 269) · laissé au septième mois, il dirait « dans les
    // délais » une société du portefeuille dont l'assemblée est au 31 mars.
    if (j.etape === 24) {
      const echeance = plusUnMois(assembleeDeReference);
      return {
        ...j,
        detail: `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · le mois se compte depuis ${reference}.`,
        source: `${j.source} ; ${SOURCE_112}`,
        debut: debutBorne(j.debut, echeance),
        echeance,
        enRetard: enRetard(echeance, j.observation),
      };
    }
    return j;
  });

  const ajoutes: JalonServi[] = [];
  if (!clos31) {
    // Le texte se TAIT sur cette clôture · ni échéance ni manque du dossier.
    ajoutes.push({
      etape: 23,
      libelle: 'Assemblée générale · entreprise du portefeuille de l’État',
      detail:
        'L’article 112 fixe le 31 mars pour « l’exercice clos au 31 décembre » · cet exercice se clôt à une autre ' +
        'date, et le texte ne dit pas comment le délai s’y applique. Aucune échéance n’est calculée ; le délai de ' +
        'six mois de l’Acte uniforme reste servi.',
      nature: 'LEGALE',
      source: SOURCE_112,
      sanction: null,
      debut: null,
      echeance: null,
      sansDelai: true,
      enRetard: false,
    });
  }
  // LE PROCÈS-VERBAL · dix jours après l'assemblée déclarée ; sans elle, au
  // plus tard dix jours après le 31 mars (même plafond que le RCCM), et dit.
  const basePv = faits.dateAssembleeGenerale ?? (clos31 ? trenteEtUnMars : null);
  const pv = basePv ? plusJours(basePv, 10) : null;
  const observationPv = observationDuFait(
    { passe: 'Procès-verbal communiqué', prevu: 'Communication du procès-verbal prévue' },
    faits.dateTransmissionPvPortefeuille,
    pv,
    aujourdHui,
  );
  ajoutes.push({
    etape: 23,
    libelle: 'Procès-verbal à l’Administration des recettes non fiscales',
    detail:
      'Le procès-verbal de l’assemblée générale ordinaire est communiqué à l’Administration des recettes non ' +
      'fiscales « dans les dix (10) jours qui suivent la tenue de ces assemblées », jours calendaires. Il s’ajoute ' +
      'à celui que reçoit la Direction générale des impôts, il ne le remplace pas. ' +
      (faits.dateAssembleeGenerale
        ? 'Délai compté depuis la date de l’assemblée déclarée.'
        : pv
          ? 'Au plus tard, faute de date d’assemblée déclarée · dix jours après le 31 mars.'
          : 'Échéance non calculée · déclarez la date de l’assemblée sur l’exercice.') +
      ' Déclarez la date de communication dans la fenêtre Exercices.',
    nature: 'LEGALE',
    source: SOURCE_112,
    sanction: null,
    debut: basePv,
    echeance: pv,
    observation: observationPv,
    enRetard: enRetard(pv, observationPv),
  });
  // L'AFFECTATION · soixante jours du dépôt déclaré. Le dépôt ne peut pas
  // exister pendant l'exercice · tant qu'il n'est pas possible (exercice non
  // clôturé et date limite de l'assemblée non passée · le 31 mars, sinon les
  // six mois de l'AUDCIF art. 72), le jalon est EN ATTENTE, hors du compte
  // des échéances non calculées.
  const affectation = faits.dateDepotEtatsPortefeuille ? plusJours(faits.dateDepotEtatsPortefeuille, 60) : null;
  const observationAffectation = observationDuFait(
    { passe: 'Affectation décidée', prevu: 'Affectation prévue' },
    faits.dateDecisionAffectation,
    affectation,
    aujourdHui,
  );
  const limiteAssemblee = clos31 ? trenteEtUnMars : plusMoisDateADate(faits.dateFin, 6);
  const depotPossible = faits.exerciceClos || aujourdHui.getTime() > limiteAssemblee.getTime();
  const enAttenteDuDepot = !faits.dateDepotEtatsPortefeuille && !depotPossible && !observationAffectation?.satisfait;
  ajoutes.push({
    etape: 26,
    libelle: 'Affectation des résultats · entreprise du portefeuille de l’État',
    detail:
      'L’affectation des résultats intervient « endéans soixante (60) jours, à compter de la date de dépôt des ' +
      'états financiers à l’administration compétente du ministère ayant le portefeuille de l’Etat dans ses ' +
      'attributions », jours calendaires. ' +
      (faits.dateDepotEtatsPortefeuille
        ? 'Délai compté depuis la date de dépôt déclarée.'
        : enAttenteDuDepot
          ? 'Le dépôt suit l’arrêté et l’approbation des états · l’échéance se calculera sur sa date déclarée.'
          : 'Échéance non calculée · déclarez la date de dépôt sur l’exercice.') +
      ' Le jalon se lève par la décision d’affectation enregistrée.',
    nature: 'LEGALE',
    source: SOURCE_113,
    sanction: null,
    debut: faits.dateDepotEtatsPortefeuille,
    echeance: affectation,
    ...(enAttenteDuDepot ? { enAttente: 'En attente du dépôt' } : {}),
    observation: observationAffectation,
    enRetard: enRetard(affectation, observationAffectation),
  });

  // Rangés par étape, les ajoutés après les jalons de même étape.
  const tous = [...resultat.map((j, i) => ({ j, i })), ...ajoutes.map((j, k) => ({ j, i: resultat.length + k }))];
  tous.sort((a, b) => a.j.etape - b.j.etape || a.i - b.i);
  return tous.map((x) => x.j);
}

/** Un délai compté à rebours de l'assemblée, avec ce qui le fonde. */
interface RegleARebours {
  jours: 45 | 15;
  source: string;
  motif: string;
}

const QUARANTE_CINQ_ART_140: RegleARebours = {
  jours: 45,
  source: 'AUSCGIE, art. 140',
  motif:
    'les états financiers et le rapport de gestion sont adressés aux commissaires aux comptes « quarante-cinq (45) ' +
    'jours au moins avant » l’assemblée (AUSCGIE art. 140).',
};
const QUARANTE_CINQ_ART_71: RegleARebours = {
  jours: 45,
  source: 'AUDCIF, art. 71',
  motif:
    'les documents sont transmis aux commissaires aux comptes, « s’ils existent, quarante-cinq jours au moins avant » ' +
    'l’assemblée (AUDCIF art. 71).',
};
const QUINZE_ART_288_306: RegleARebours = {
  jours: 15,
  source: 'AUSCGIE, art. 288 et 306',
  motif:
    'les documents sont communiqués aux associés « au moins quinze (15) jours avant la tenue de l’assemblée » ' +
    '(AUSCGIE art. 288 pour la SNC, 306 pour la SCS).',
};
const QUINZE_ART_345: RegleARebours = {
  jours: 15,
  source: 'AUSCGIE, art. 345',
  motif:
    'le droit de communication des associés « s’exerce durant les quinze (15) jours précédant la tenue » de ' +
    'l’assemblée (AUSCGIE art. 345) · les documents doivent alors exister.',
};

/**
 * LES DÉLAIS À REBOURS DE L'ASSEMBLÉE, FORME PAR FORME (relecture 2) · ceux
 * que le planning de base applique déjà, l'assemblée seule changeant de date.
 * `null` · le délai suppose un commissaire aux comptes que la table des
 * mandats ne montre pas (jalon EN ATTENTE, aucun retard fabriqué).
 */
export function delaisAvantAssemblee(
  forme: FormeJuridiqueSyscohada,
  commissaireDesigne: boolean | null,
): { commissaire140: RegleARebours | null; commissaire71: RegleARebours | null; documents: RegleARebours } {
  const commissaire = commissaireDesigne === true;
  switch (forme) {
    // Art. 140 · la SA et la SAS sans condition.
    case FormeJuridiqueSyscohada.SOCIETE_ANONYME:
    case FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE:
      return { commissaire140: QUARANTE_CINQ_ART_140, commissaire71: QUARANTE_CINQ_ART_71, documents: QUARANTE_CINQ_ART_140 };
    // Art. 140 · la SARL « le cas échéant », c'est-à-dire avec un commissaire.
    case FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE:
      return commissaire
        ? { commissaire140: QUARANTE_CINQ_ART_140, commissaire71: QUARANTE_CINQ_ART_71, documents: QUARANTE_CINQ_ART_140 }
        : { commissaire140: null, commissaire71: null, documents: QUINZE_ART_345 };
    // Art. 288 et 306 · la SNC et la SCS, que l'art. 140 ne vise pas.
    default:
      return commissaire
        ? { commissaire140: null, commissaire71: QUARANTE_CINQ_ART_71, documents: QUARANTE_CINQ_ART_71 }
        : { commissaire140: null, commissaire71: null, documents: QUINZE_ART_288_306 };
  }
}

/** n mois DATE À DATE, ramené au dernier jour du mois d'arrivée. */
function plusMoisDateADate(d: Date, n: number): Date {
  const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), Math.min(d.getUTCDate(), dernier)));
}

/**
 * PORTEFEUILLE « PAS ENCORE DIT » · une ligne dans le détail des étapes 21
 * et 23 d'une société qui n'a pas répondu · l'assemblée d'une entreprise du
 * portefeuille se tient au 31 mars et non dans les six mois, et rien ne se
 * calcule tant que le fait n'est pas déclaré.
 */
export function inviterADeclarerPortefeuille(jalons: JalonServi[]): JalonServi[] {
  return jalons.map((j) =>
    j.etape === 21 || j.etape === 23
      ? {
          ...j,
          detail:
            `${j.detail} PORTEFEUILLE DE L’ÉTAT NON DÉCLARÉ · si l’État ou une personne morale de droit public ` +
            'détient des actions de la société, l’assemblée se tient au plus tard le 31 mars (ordonnance-loi ' +
            'n° 13/003, art. 112) · déclarez-le dans Paramètres du dossier.',
        }
      : j,
  );
}
