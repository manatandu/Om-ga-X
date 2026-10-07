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
  enRetard: boolean;
  observation?: { libelle: string; satisfait: boolean };
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

/** Les faits DÉCLARÉS qui font courir ou lèvent les délais de l'O.-L. n° 13/003. */
export interface FaitsPortefeuille {
  dateFin: Date;
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
  // La base des délais à rebours (AUSCGIE art. 140, quarante-cinq jours) et
  // du RCCM (art. 269, un mois) · l'assemblée déclarée, sinon la date limite
  // du 31 mars.
  const assembleeDeReference = faits.dateAssembleeGenerale ?? trenteEtUnMars;
  const reference = faits.dateAssembleeGenerale ? 'l’assemblée déclarée' : 'la date limite du 31 mars (art. 112)';
  const quaranteCinqJoursAvant = plusJours(assembleeDeReference, -45);

  // L'assemblée DÉCLARÉE lève les étapes 21 et 23 si elle tient le 31 mars.
  const observationAssemblee = faits.dateAssembleeGenerale
    ? faits.dateAssembleeGenerale.getTime() <= trenteEtUnMars.getTime()
      ? { libelle: `Assemblée tenue le ${jourFr(faits.dateAssembleeGenerale)}`, satisfait: true }
      : {
          libelle: `Assemblée tenue le ${jourFr(faits.dateAssembleeGenerale)}, après le 31 mars (art. 112)`,
          satisfait: false,
        }
    : undefined;

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
    // Étapes 17 et 18 · les QUARANTE-CINQ JOURS AU MOINS de l'art. 140
    // AUSCGIE (commissaires aux comptes), à rebours de l'assemblée · 14 février
    // (15 en année bissextile) pour un 31 mars.
    if (j.etape === 17 || j.etape === 18) {
      const echeance = quaranteCinqJoursAvant;
      return {
        ...j,
        detail: `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · l’échéance est comptée à rebours de ${reference}.`,
        source: `${j.source} ; ${SOURCE_112}`,
        debut: debutBorne(j.debut, echeance),
        echeance,
        enRetard: enRetard(echeance, j.observation),
      };
    }
    // Étapes 13 (états financiers) et 16 (rapport de gestion) · ils partent
    // aux commissaires quarante-cinq jours avant l'assemblée (art. 140) · le
    // 30 avril tomberait après l'assemblée elle-même. Bornés à cette date.
    if (j.etape === 13 || j.etape === 16) {
      if (j.echeance && j.echeance.getTime() <= quaranteCinqJoursAvant.getTime()) return j;
      const echeance = quaranteCinqJoursAvant;
      return {
        ...j,
        detail:
          `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · borné à quarante-cinq jours avant ${reference} · ` +
          'les états financiers et le rapport de gestion sont adressés aux commissaires aux comptes « quarante-cinq ' +
          '(45) jours au moins avant » l’assemblée (AUSCGIE art. 140).',
        source: `${j.source} ; ${SOURCE_112} ; AUSCGIE, art. 140`,
        debut: debutBorne(j.debut, echeance),
        echeance,
        enRetard: enRetard(echeance, j.observation),
      };
    }
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
      enRetard: false,
    });
  }
  // LE PROCÈS-VERBAL · dix jours après l'assemblée déclarée ; sans elle, au
  // plus tard dix jours après le 31 mars (même plafond que le RCCM), et dit.
  const basePv = faits.dateAssembleeGenerale ?? (clos31 ? trenteEtUnMars : null);
  const pv = basePv ? plusJours(basePv, 10) : null;
  const observationPv = faits.dateTransmissionPvPortefeuille
    ? { libelle: `Procès-verbal communiqué le ${jourFr(faits.dateTransmissionPvPortefeuille)}`, satisfait: true }
    : undefined;
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
  const affectation = faits.dateDepotEtatsPortefeuille ? plusJours(faits.dateDepotEtatsPortefeuille, 60) : null;
  const observationAffectation = faits.dateDecisionAffectation
    ? { libelle: `Affectation décidée le ${jourFr(faits.dateDecisionAffectation)}`, satisfait: true }
    : undefined;
  ajoutes.push({
    etape: 26,
    libelle: 'Affectation des résultats · entreprise du portefeuille de l’État',
    detail:
      'L’affectation des résultats intervient « endéans soixante (60) jours, à compter de la date de dépôt des ' +
      'états financiers à l’administration compétente du ministère ayant le portefeuille de l’Etat dans ses ' +
      'attributions », jours calendaires. ' +
      (faits.dateDepotEtatsPortefeuille
        ? 'Délai compté depuis la date de dépôt déclarée.'
        : 'Échéance non calculée · déclarez la date de dépôt sur l’exercice.') +
      ' Le jalon se lève par la décision d’affectation enregistrée.',
    nature: 'LEGALE',
    source: SOURCE_113,
    sanction: null,
    debut: faits.dateDepotEtatsPortefeuille,
    echeance: affectation,
    observation: observationAffectation,
    enRetard: enRetard(affectation, observationAffectation),
  });

  // Rangés par étape, les ajoutés après les jalons de même étape.
  const tous = [...resultat.map((j, i) => ({ j, i })), ...ajoutes.map((j, k) => ({ j, i: resultat.length + k }))];
  tous.sort((a, b) => a.j.etape - b.j.etape || a.i - b.i);
  return tous.map((x) => x.j);
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
