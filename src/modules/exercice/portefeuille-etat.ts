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
 * (3) Le procès-verbal à l'Administration des recettes non fiscales S'AJOUTE,
 *     le cas échéant, à celui de la DGI (LPF art. 13 bis), il ne le remplace
 *     pas · celui de la DGI n'est dû que sous commissaire aux comptes
 *     (décision par la loi du 2026-10-07, point 7).
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
 * LE DIVIDENDE PRIORITAIRE DES ENTREPRISES MINIÈRES (décision par la loi du
 * 2026-10-07, point 3) · arrêté interministériel n° 005/CAB/MIN/PF/2025 et
 * n° 159bis/CAB/MIN/FINANCES/2025 du 10 décembre 2025, en vigueur à sa
 * signature (art. 9). Art. 2 · « Lorsqu'un bénéfice net comptable est
 * réalisé par les entreprises minières du portefeuille de l'État, le
 * dividende dû à l'État est prioritaire et intangible [...] Déclaré au plus
 * tard le 15 mai de chaque année, indépendamment de la tenue de l'Assemblée
 * Générale Ordinaire ; paiement dans les huit jours de la réception de la
 * note de perception. » Art. 3 · toutes les entreprises du portefeuille du
 * SECTEUR MINIER. Art. 1er, point 2 · « Montant correspondant à la quote-part
 * de l'État ». La transcription de la compétence est un OCR « non revérifié
 * mot à mot » ; le 15 mai et les huit jours concordent avec les résumés de
 * la LF n° 25/060 (2026). La LF n° 24/011 (2025), art. 73, résumée, insère
 * l'art. 112 quater à l'O.-L. n° 13/003 et porte la PRIORITÉ et la quote-part
 * (« taux égal à la quote-part de l'État dans le capital »), ni le 15 mai ni
 * les huit jours. LE MONTANT EST UNE LECTURE · bénéfice net comptable
 * multiplié par la quote-part déclarée, lu dans l'arrêté (art. 1er, point 2)
 * et dans ce résumé ; aucun texte lu n'écrit la formule. La distribution reste
 * soumise à l'AUSCGIE · aucune distribution quand les capitaux propres sont
 * ou deviendraient inférieurs au capital augmenté des réserves indisponibles
 * (art. 143, dernier alinéa), et un dividende distribué hors des sommes
 * distribuables constatées est FICTIF (art. 144) · le jalon le dit, et
 * avertit sur un report à nouveau débiteur ou des capitaux propres sous le
 * capital quand le livre-journal les montre. QUATRE RÈGLES. (a) Le secteur
 * minier et la quote-part se DÉCLARENT, jamais déduits · sans quote-part, le
 * montant n'est pas calculé et le jalon le dit. (b) Pas de bénéfice net
 * comptable sur un exercice clôturé, pas de dividende · le jalon le constate ;
 * exercice ouvert, le montant est PROVISOIRE, ou en attente du résultat quand
 * celui-ci est nul ou négatif ; passé le 15 mai sans déclaration, le jalon est
 * en retard dans les deux cas. (c) Le paiement court de la RÉCEPTION de la
 * note de perception, date déclarée · sans elle, rien n'est calculé. (d) Après
 * la dissolution déclarée, l'État ne reçoit plus un dividende mais un boni ou
 * produit de liquidation (arrêté, art. 1er, point 4 ; loi n° 08/010, art. 7) ·
 * aucun jalon de dividende sur un exercice qui finit après elle.
 * Art. 5 · les procès-verbaux d'assemblée et de conseil d'administration vont
 * aussi au Secrétariat Général du Portefeuille dans les dix jours ; l'astreinte
 * de 100 USD par jour de retard (art. 1er, point 11) est DITE, jamais
 * calculée (monnaie hors tenue). Aucune autre sanction n'est chiffrée · les
 * art. 112 et 113 n'en posent pas.
 */

/** Art. 115 · publication au Journal officiel. */
export const ENTREE_EN_VIGUEUR_OL_13_003 = new Date(Date.UTC(2013, 1, 27));

const SOURCE_112 = 'Ordonnance-loi n° 13/003 du 23 février 2013, art. 112 ; loi n° 08/010 du 7 juillet 2008, art. 3';
const SOURCE_113 = 'Ordonnance-loi n° 13/003 du 23 février 2013, art. 113';

/** Art. 9 de l'arrêté interministériel du 10 décembre 2025 · en vigueur à sa signature. */
export const ENTREE_EN_VIGUEUR_ARRETE_PORTEFEUILLE_2025 = new Date(Date.UTC(2025, 11, 10));
const ARRETE_2025 =
  'Arrêté interministériel n° 005/CAB/MIN/PF/2025 et n° 159bis/CAB/MIN/FINANCES/2025 du 10 décembre 2025';
const SOURCE_DIVIDENDE = `${ARRETE_2025}, art. 1er (point 2), 2 et 3`;
const SOURCE_ART_5 = `${ARRETE_2025}, art. 1er (point 11) et 5`;

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
  /**
   * Le MONTANT que le jalon fait payer, quand le texte le chiffre (dividende
   * prioritaire) · `null` NON CALCULÉ, faute d'un fait déclaré (quote-part de
   * l'État), et le détail le dit · jamais un zéro.
   */
  montant?: number | null;
  /** Le montant est calculé sur le résultat d'un exercice NON clôturé · il peut encore changer. */
  montantProvisoire?: true;
  /**
   * Le montant ATTEND le résultat de l'exercice (exercice ouvert, résultat
   * provisoire nul ou négatif) · ni zéro ni « non calculé ».
   */
  montantEnAttente?: true;
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
  /**
   * Date d'arrêté des comptes (AUDCIF Titre VIII ch. 31 § 1.3, art. 23) ·
   * des comptes ARRÊTÉS ne sont plus provisoires, même avant la clôture dans
   * OmegaX. Facultative · absente, seul l'exercice clos fait foi.
   */
  dateArreteComptes?: Date | null;
  dateAssembleeGenerale: Date | null;
  dateDepotEtatsPortefeuille: Date | null;
  /** Communication du PV à l'Administration des recettes non fiscales · lève le jalon. */
  dateTransmissionPvPortefeuille: Date | null;
  /** Décision d'affectation enregistrée (fenêtre Affectation) · lève le jalon. */
  dateDecisionAffectation: Date | null;
  /**
   * Entreprise du portefeuille du SECTEUR MINIER (arrêté du 10 décembre 2025,
   * art. 3) · `null` pas encore dit, et aucun jalon du dividende n'est servi.
   */
  secteurMinier?: boolean | null;
  /** Quote-part de l'État dans le capital, en pourcentage, déclarée avec sa source · `null` non déclarée. */
  quotePartEtat?: number | null;
  sourceQuotePartEtat?: string | null;
  /**
   * Résultat net comptable de l'exercice (classes 6 à 8, livre-journal, avant
   * l'écriture qui solde les comptes de gestion) · `null` non lu.
   */
  resultatNet?: number | null;
  /** Déclaration du dividende prioritaire · lève le jalon du 15 mai. */
  dateDeclarationDividendeEtat?: Date | null;
  /** Réception de la note de perception · fait courir les huit jours. */
  dateNotePerceptionDividende?: Date | null;
  /** Paiement du dividende prioritaire · lève le jalon du paiement. */
  datePaiementDividendeEtat?: Date | null;
  /** Dissolution déclarée (AUSCGIE art. 204) · après elle, plus de dividende prioritaire. */
  dateDissolution?: Date | null;
  /**
   * Ce que le livre-journal montre des capitaux propres à la clôture (postes
   * CA à CM du bilan, résultat de l'exercice compris), `null` quand il ne les
   * montre pas · sert les avertissements de l'AUSCGIE art. 143 et 144.
   */
  capitauxPropres?: { capital: number; capitauxPropres: number; reportANouveau: number } | null;
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
    const echeance = plusJours(assembleeDeReference, -regle.joursAvant);
    if (borne && j.echeance && j.echeance.getTime() <= echeance.getTime()) return j;
    return {
      ...j,
      detail:
        `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · ${borne ? 'borné à' : 'compté à'} ` +
        `${regle.jours === 45 ? 'quarante-cinq' : 'quinze'} jours${regle.franc ? ' francs' : ''} avant ${reference} · ` +
        `${regle.motif}${regle.franc ? ` ${MENTION_DELAI_NON_FRANC}` : ''}`,
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
  // ART. 5 DE L'ARRÊTÉ DU 10 DÉCEMBRE 2025 · le Secrétariat Général du
  // Portefeuille reçoit aussi les procès-verbaux d'assemblée ET de conseil
  // d'administration, dans les mêmes dix jours, sous astreinte de 100 USD par
  // jour de retard (art. 1er, point 11), DITE et jamais calculée. Borné à son
  // entrée en vigueur (art. 9) · une assemblée tenue avant la signature ne
  // se voit rien reprocher en son nom.
  const assembleeSousArrete =
    basePv !== null && basePv.getTime() >= ENTREE_EN_VIGUEUR_ARRETE_PORTEFEUILLE_2025.getTime();
  ajoutes.push({
    etape: 23,
    libelle: 'Procès-verbal à l’Administration des recettes non fiscales',
    detail:
      'Le procès-verbal de l’assemblée générale ordinaire est communiqué à l’Administration des recettes non ' +
      'fiscales « dans les dix (10) jours qui suivent la tenue de ces assemblées », jours calendaires. Il s’ajoute, ' +
      'le cas échéant, à celui que reçoit la Direction générale des impôts (états certifiés par un commissaire aux ' +
      'comptes), il ne le remplace pas. ' +
      (assembleeSousArrete
        ? 'Les procès-verbaux de l’assemblée et du conseil d’administration sont aussi transmis au Secrétariat ' +
          'Général du Portefeuille dans les mêmes dix jours ; la transmission tardive donne lieu à une astreinte de ' +
          '100 USD par jour de retard, qu’OmegaX ne calcule pas. '
        : '') +
      (faits.dateAssembleeGenerale
        ? 'Délai compté depuis la date de l’assemblée déclarée.'
        : pv
          ? 'Au plus tard, faute de date d’assemblée déclarée · dix jours après le 31 mars.'
          : 'Échéance non calculée · déclarez la date de l’assemblée sur l’exercice.') +
      ' Déclarez la date de communication dans la fenêtre Exercices.',
    nature: 'LEGALE',
    source: assembleeSousArrete ? `${SOURCE_112} ; ${SOURCE_ART_5}` : SOURCE_112,
    sanction: null,
    debut: basePv,
    echeance: pv,
    observation: observationPv,
    enRetard: enRetard(pv, observationPv),
  });
  ajoutes.push(...jalonsDividendePrioritaire(faits, aujourdHui));
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
      ' Le jalon se lève par la décision d’affectation enregistrée.' +
      // SECTEUR MINIER « PAS ENCORE DIT » · comme `inviterADeclarerPortefeuille`,
      // une ligne qui invite à le déclarer · rien ne se calcule sans lui.
      (faits.secteurMinier === null
        ? ' SECTEUR MINIER NON DÉCLARÉ · une entreprise du portefeuille du secteur minier déclare au plus tard le ' +
          '15 mai un dividende prioritaire sur son bénéfice net comptable (arrêté interministériel du 10 décembre ' +
          '2025, art. 2 et 3) · déclarez-le dans Paramètres du dossier.'
        : ''),
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

/** Arrondi au centime · le montant servi est celui qu'on déclare. */
const auCentime = (x: number) => Math.round(x * 100) / 100;

/**
 * LE DIVIDENDE PRIORITAIRE D'UNE ENTREPRISE MINIÈRE DU PORTEFEUILLE (arrêté
 * du 10 décembre 2025, art. 2 et 3) · deux jalons à l'étape de l'affectation,
 * servis AVANT elle, le dividende étant « versé au Trésor public avant toute
 * autre affectation du bénéfice net comptable ».
 *
 * Rien sans le secteur minier DÉCLARÉ, rien pour un exercice dont le 15 mai
 * précède la signature de l'arrêté (art. 9). Le 15 mai est celui de l'année
 * qui suit la clôture (décision du 2026-10-07) · l'arrêté dit « de chaque
 * année » sans viser la date de clôture, et le détail le dit hors d'un
 * exercice clos au 31 décembre. Après la dissolution déclarée, un seul jalon
 * sans délai qui dit pourquoi il n'y a plus de dividende (règle (d)).
 */
export function jalonsDividendePrioritaire(faits: FaitsPortefeuille, aujourdHui: Date): JalonServi[] {
  if (faits.secteurMinier !== true) return [];
  const quinzeMai = new Date(Date.UTC(faits.dateFin.getUTCFullYear() + 1, 4, 15));
  if (quinzeMai.getTime() < ENTREE_EN_VIGUEUR_ARRETE_PORTEFEUILLE_2025.getTime()) return [];
  const enRetard = (echeance: Date | null, observation?: { satisfait: boolean }) =>
    echeance !== null && echeanceDepassee(echeance, aujourdHui) && !(observation?.satisfait ?? false);

  const base = {
    etape: 26,
    nature: 'LEGALE' as const,
    source: SOURCE_DIVIDENDE,
    sanction: null,
  };

  // (d) APRÈS LA DISSOLUTION · la société est en liquidation (AUSCGIE
  // art. 204) ; ce que l'État reçoit est un boni ou produit de liquidation
  // (arrêté, art. 1er, point 4 ; loi n° 08/010, art. 7), pas un dividende.
  const dissolution = faits.dateDissolution ?? null;
  if (dissolution && faits.dateFin.getTime() > dissolution.getTime()) {
    return [
      {
        ...base,
        source: `${ARRETE_2025}, art. 1er (points 2 et 4) ; loi n° 08/010 du 7 juillet 2008, art. 7`,
        libelle: 'Dividende prioritaire de l’État · société dissoute',
        detail:
          `Dissolution déclarée le ${jourFr(dissolution)} · l’exercice finit après elle, et aucun dividende ` +
          'prioritaire ne se calcule. Ce que l’État reçoit d’une entreprise du portefeuille en liquidation est un ' +
          'boni ou produit de liquidation, « valeur de liquidation déduite de toutes les charges et dettes ' +
          'inhérentes », logé aux recettes des participations.',
        debut: null,
        echeance: null,
        sansDelai: true,
        enRetard: false,
      },
    ];
  }

  const resultat = faits.resultatNet ?? null;
  const quote = faits.quotePartEtat ?? null;
  const benefice = resultat !== null && resultat > 0;
  // PROVISOIRE · ni clôturé dans OmegaX, ni arrêté (relecture du
  // 2026-10-07) · des comptes arrêtés en perte ne font naître aucun dividende
  // (arrêté, art. 2, « lorsqu'un bénéfice net comptable est réalisé »), et les
  // dire « en retard » fabriquait une obligation.
  const provisoire = !faits.exerciceClos && !faits.dateArreteComptes;
  const autreCloture = closAu31Decembre(faits.dateFin)
    ? ''
    : ' L’arrêté fixe le 15 mai « de chaque année » sans viser la date de clôture · le 15 mai retenu est celui de ' +
      'l’année qui suit la clôture.';
  // AUSCGIE art. 143 et 144 · la priorité porte sur l'AFFECTATION du
  // bénéfice, pas sur les règles de distribution, que le jalon rappelle.
  const cp = faits.capitauxPropres ?? null;
  const avertissements = [
    cp !== null && cp.reportANouveau < 0
      ? `AVERTISSEMENT · report à nouveau débiteur (${montantFr(-cp.reportANouveau)}) · le bénéfice distribuable est ` +
        'diminué des pertes antérieures (AUSCGIE art. 143, al. 1er).'
      : '',
    cp !== null && cp.capital > 0 && cp.capitauxPropres < cp.capital
      ? `AVERTISSEMENT · capitaux propres (${montantFr(cp.capitauxPropres)}) inférieurs au capital ` +
        `(${montantFr(cp.capital)}) · « aucune distribution ne peut être faite aux associés lorsque les capitaux ` +
        'propres sont ou deviendraient, à la suite de cette distribution, inférieurs au montant du capital augmenté ' +
        'des réserves que la loi ou les statuts ne permettent pas de distribuer » (AUSCGIE art. 143, dernier alinéa).'
      : '',
  ]
    .filter((a) => a !== '')
    .map((a) => ` ${a}`)
    .join('');
  // LA RÉSERVE LÉGALE PASSE AVANT · l'AUSCGIE impose la dotation « à peine de
  // nullité de toute délibération contraire » (art. 546, 2°, SA ; art. 346,
  // SARL) et retranche du distribuable les pertes antérieures et les sommes
  // portées en réserve en application de la loi (art. 143, al. 1er). Un Acte
  // uniforme s'applique nonobstant toute disposition contraire de droit
  // interne (AUDCIF, Titre VI, entrée « Acte uniforme ») · le « avant toute autre affectation » de
  // l'arrêté ne l'écarte pas. Le plafond chiffré n'est pas encore servi (suivi).
  const regleDistribution =
    ' La distribution reste soumise à l’AUSCGIE, qui prime sur l’arrêté · le bénéfice distribuable est diminué des ' +
    'pertes antérieures et de la dotation à la réserve légale (art. 143, al. 1er ; art. 546, 2°, et 346), les ' +
    'capitaux propres ne deviennent jamais inférieurs au capital augmenté des réserves indisponibles (art. 143), et ' +
    'un dividende distribué hors des sommes distribuables constatées est un dividende fictif (art. 144). Le montant ' +
    'ci-dessus ne retranche ni les pertes antérieures ni la réserve légale.';

  const observationDeclaration = observationDuFait(
    { passe: 'Dividende déclaré', prevu: 'Déclaration du dividende prévue' },
    faits.dateDeclarationDividendeEtat ?? null,
    quinzeMai,
    aujourdHui,
  );

  // AUCUN BÉNÉFICE · sur un exercice clôturé, le dividende n'est pas dû, et
  // c'est un fait établi ; ouvert, le résultat peut encore bouger · le montant
  // attend le résultat, le 15 mai reste l'échéance, et passé cette date sans
  // déclaration le jalon est en retard comme un autre.
  if (!benefice) {
    const lu =
      resultat === null
        ? 'Le résultat net comptable de l’exercice n’a pas pu être lu.'
        : `Résultat net comptable ${provisoire ? 'provisoire, lu à ce jour sur le livre-journal' : 'de l’exercice'} · ` +
          `${resultat === 0 ? 'nul' : 'perte'}.`;
    const constat: ObservationJalon | undefined =
      resultat !== null && !provisoire
        ? { libelle: 'Aucun bénéfice net comptable · aucun dividende prioritaire', satisfait: true }
        : undefined;
    const observation = observationDeclaration ?? constat;
    const attend = resultat !== null && provisoire;
    return [
      {
        ...base,
        libelle: 'Déclaration du dividende prioritaire de l’État',
        detail:
          'Lorsqu’un bénéfice net comptable est réalisé par une entreprise minière du portefeuille de l’État, le ' +
          'dividende dû à l’État est prioritaire et intangible, déclaré au plus tard le 15 mai, indépendamment de ' +
          `l’assemblée générale. ${lu}${attend ? ' Le montant attend le résultat de l’exercice.' : ''}` +
          (attend && aujourdHui.getTime() > quinzeMai.getTime() && !observation
            ? ' À vérifier · le 15 mai est passé et les comptes ne sont ni arrêtés ni clôturés · si le résultat ' +
              'définitif est un bénéfice, la déclaration était due ; arrêtez les comptes ou déclarez.'
            : '') +
          autreCloture,
        debut: faits.dateFin,
        echeance: quinzeMai,
        ...(attend && !observation ? { enAttente: 'En attente du résultat de l’exercice' } : {}),
        montant: resultat !== null && !provisoire ? 0 : null,
        ...(attend ? { montantEnAttente: true as const } : {}),
        observation,
        enRetard: provisoire || resultat === null ? enRetard(quinzeMai, observation) : false,
      },
    ];
  }

  const montant = quote === null ? null : auCentime((resultat * quote) / 100);
  const lectureMontant =
    quote === null
      ? 'Montant non calculé · déclarez la quote-part de l’État dans le capital, avec sa source, dans Paramètres du dossier.'
      : `Montant${provisoire ? ' provisoire' : ''} · bénéfice net comptable multiplié par la quote-part de l’État ` +
        `(${quote} %, ${faits.sourceQuotePartEtat ?? 'source non dite'}) · lecture de l’arrêté (« montant correspondant ` +
        'à la quote-part de l’État ») et de la loi de finances qui a inséré l’article 112 quater (« taux égal à la ' +
        'quote-part de l’État dans le capital »).';
  const declaration: JalonServi = {
    ...base,
    libelle: 'Déclaration du dividende prioritaire de l’État',
    detail:
      'Le bénéfice net comptable réalisé par une entreprise minière du portefeuille de l’État fait naître un ' +
      'dividende prioritaire et intangible, versé au Trésor public avant toute autre affectation, déclaré au plus ' +
      `tard le 15 mai, indépendamment de l’assemblée générale. ${lectureMontant}` +
      (provisoire ? ' Exercice non clôturé · le résultat est lu à ce jour sur le livre-journal, et peut encore changer.' : '') +
      regleDistribution +
      avertissements +
      autreCloture +
      ' Déclarez la date de déclaration dans la fenêtre Exercices.',
    debut: faits.dateFin,
    echeance: quinzeMai,
    montant,
    ...(provisoire && montant !== null ? { montantProvisoire: true as const } : {}),
    observation: observationDeclaration,
    enRetard: enRetard(quinzeMai, observationDeclaration),
  };

  // LE PAIEMENT · huit jours de la RÉCEPTION de la note de perception, jours
  // calendaires (l'O.-L. n° 13/003 ne pose aucune règle de jour ouvrable).
  // Avant la déclaration, la note ne peut pas exister · en attente.
  const note = faits.dateNotePerceptionDividende ?? null;
  const echeancePaiement = note ? plusJours(note, 8) : null;
  const observationPaiement = observationDuFait(
    { passe: 'Dividende payé', prevu: 'Paiement du dividende prévu' },
    faits.datePaiementDividendeEtat ?? null,
    echeancePaiement,
    aujourdHui,
  );
  const enAttenteDeLaNote = !note && !faits.dateDeclarationDividendeEtat && !observationPaiement?.satisfait;
  const paiement: JalonServi = {
    ...base,
    libelle: 'Paiement du dividende prioritaire de l’État',
    detail:
      'Le dividende prioritaire se paie « dans les huit jours de la réception de la note de perception », jours ' +
      'calendaires. ' +
      (note
        ? `Délai compté depuis la réception de la note de perception, le ${jourFr(note)}.`
        : enAttenteDeLaNote
          ? 'La note de perception suit la déclaration · l’échéance se calculera sur sa date de réception déclarée.'
          : 'Échéance non calculée · déclarez la date de réception de la note de perception sur l’exercice.') +
      ' Le jalon se lève par la date de paiement déclarée.',
    debut: note,
    echeance: echeancePaiement,
    montant,
    ...(provisoire && montant !== null ? { montantProvisoire: true as const } : {}),
    ...(enAttenteDeLaNote ? { enAttente: 'En attente de la note de perception' } : {}),
    observation: observationPaiement,
    enRetard: enRetard(echeancePaiement, observationPaiement),
  };
  return [declaration, paiement];
}

/** Un montant écrit en français au centime, dans un détail de jalon. */
const FORMAT_MONTANT = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function montantFr(n: number): string {
  return FORMAT_MONTANT.format(auCentime(n));
}

/**
 * Un délai compté à rebours de l'assemblée, avec ce qui le fonde.
 *
 * DÉLAI FRANC (décision par la loi du 2026-10-07, point 6). « Quarante-cinq
 * (45) jours au moins avant » (AUSCGIE art. 140, AUDCIF art. 71 al. 3) et
 * « au moins quinze (15) jours avant » (art. 288 et 306) · l'AUSCGIE ne porte
 * aucune règle de computation, et les deux lectures diffèrent d'UN jour. Le
 * délai protège ceux qui reçoivent les documents (commissaires, associés) ·
 * « une règle de protection ne se tranche pas contre celui qu'elle protège »
 * (CLAUDE.md, P5), et les deux seules règles de computation du droit OHADA au
 * corpus excluent les deux bornes (AUPSRVE art. 1-14 ; AUPCAP art. 218). OmegaX
 * sert donc la date qui satisfait LES DEUX lectures · l'assemblée moins 46
 * jours (13 février pour un 31 mars, 14 février en année bissextile), moins
 * 16 pour les art. 288 et 306. L'art. 345 (« durant les quinze (15) jours
 * précédant ») ouvre une période · moins 15, sans jour franc. Le détail dit
 * l'autre lecture · un geste fait le lendemain n'est jamais dit hors délai
 * sans cette mention.
 */
interface RegleARebours {
  /** Le nombre de jours que le texte écrit. */
  jours: 45 | 15;
  /** Le nombre de jours retranché de l'assemblée · 46 et 16 en délai franc, 15 pour l'art. 345. */
  joursAvant: 46 | 16 | 15;
  /** Délai « au moins … avant », servi franc · le détail dit l'autre lecture. */
  franc: boolean;
  source: string;
  motif: string;
}

/** L'autre lecture, dite à côté de chaque délai servi franc. */
export const MENTION_DELAI_NON_FRANC =
  'Délai servi en jours francs, ni le jour de l’envoi ni celui de l’assemblée n’étant comptés · un jour plus tard si le délai n’est pas franc.';

const QUARANTE_CINQ_ART_140: RegleARebours = {
  jours: 45,
  joursAvant: 46,
  franc: true,
  source: 'AUSCGIE, art. 140',
  motif:
    'les états financiers et le rapport de gestion sont adressés aux commissaires aux comptes « quarante-cinq (45) ' +
    'jours au moins avant » l’assemblée (AUSCGIE art. 140).',
};
const QUARANTE_CINQ_ART_71: RegleARebours = {
  jours: 45,
  joursAvant: 46,
  franc: true,
  source: 'AUDCIF, art. 71',
  motif:
    'les documents sont transmis aux commissaires aux comptes, « s’ils existent, quarante-cinq jours au moins avant » ' +
    'l’assemblée (AUDCIF art. 71).',
};
const QUINZE_ART_288_306: RegleARebours = {
  jours: 15,
  joursAvant: 16,
  franc: true,
  source: 'AUSCGIE, art. 288 et 306',
  motif:
    'les documents sont communiqués aux associés « au moins quinze (15) jours avant la tenue de l’assemblée » ' +
    '(AUSCGIE art. 288 pour la SNC, 306 pour la SCS).',
};
const QUINZE_ART_345: RegleARebours = {
  jours: 15,
  joursAvant: 15,
  franc: false,
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
