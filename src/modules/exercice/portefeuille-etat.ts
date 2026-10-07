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
 * (2) Les dix jours se comptent depuis la date de l'assemblée DÉCLARÉE, les
 *     soixante depuis le dépôt DÉCLARÉ · sans la date, aucune échéance
 *     (`null`), jamais une date supposée. Jours CALENDAIRES · l'O.-L.
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
  enRetard: boolean;
  observation?: { libelle: string; satisfait: boolean };
}

const JOUR_MS = 86_400_000;
const plusJours = (d: Date, n: number) => new Date(d.getTime() + n * JOUR_MS);

/** L'exercice est-il clos au 31 décembre, seul cas que vise l'art. 112 ? */
export function closAu31Decembre(dateFin: Date): boolean {
  return dateFin.getUTCMonth() === 11 && dateFin.getUTCDate() === 31;
}

/**
 * Applique au planning d'un exercice SYSCOHADA les échéances de l'O.-L.
 * n° 13/003, quand le dossier a DÉCLARÉ relever du portefeuille de l'État.
 * Rend le planning tel quel pour un exercice clos avant le 27 février 2013.
 */
export function appliquerPortefeuilleEtat(
  jalons: JalonServi[],
  faits: { dateFin: Date; dateAssembleeGenerale: Date | null; dateDepotEtatsPortefeuille: Date | null },
  aujourdHui: Date,
): JalonServi[] {
  if (faits.dateFin.getTime() < ENTREE_EN_VIGUEUR_OL_13_003.getTime()) return jalons;
  const enRetard = (echeance: Date | null, j?: JalonServi) =>
    echeance !== null && echeanceDepassee(echeance, aujourdHui) && !(j?.observation?.satisfait ?? false);

  const clos31 = closAu31Decembre(faits.dateFin);
  const trenteEtUnMars = new Date(Date.UTC(faits.dateFin.getUTCFullYear() + 1, 2, 31));
  // La base des quarante-cinq jours de l'art. 140 AUSCGIE · l'assemblée
  // déclarée, sinon la date limite du 31 mars (information, point 4).
  const assembleeDeReference = faits.dateAssembleeGenerale ?? trenteEtUnMars;

  const resultat = jalons.map((j) => {
    if (!clos31) return j;
    // Étapes 21 (approbation) et 23 (assemblée) · le 31 mars REMPLACE les six mois.
    if (j.etape === 21 || j.etape === 23) {
      const echeance = trenteEtUnMars;
      return {
        ...j,
        detail:
          `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · l’assemblée générale ordinaire statuant sur les ` +
          'résultats de l’exercice clos au 31 décembre se tient « au plus tard le 31 mars de l’année qui suit celle ' +
          'de réalisation des revenus » (ordonnance-loi n° 13/003, art. 112) · cette échéance remplace les six mois.',
        source: `${j.source} ; ${SOURCE_112}`,
        echeance,
        enRetard: enRetard(echeance, j),
      };
    }
    // Étape 17 · les quarante-cinq jours de l'art. 140 AUSCGIE, à rebours de
    // l'assemblée · 14 février (15 en année bissextile) pour un 31 mars.
    if (j.etape === 17) {
      const echeance = plusJours(assembleeDeReference, -45);
      return {
        ...j,
        detail:
          `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · l’échéance est comptée à rebours de ` +
          (faits.dateAssembleeGenerale ? 'l’assemblée déclarée' : 'la date limite du 31 mars (art. 112)') + '.',
        source: `${j.source} ; ${SOURCE_112}`,
        echeance,
        enRetard: enRetard(echeance, j),
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
  const pv = faits.dateAssembleeGenerale ? plusJours(faits.dateAssembleeGenerale, 10) : null;
  ajoutes.push({
    etape: 23,
    libelle: 'Procès-verbal à l’Administration des recettes non fiscales',
    detail:
      'Le procès-verbal de l’assemblée générale ordinaire est communiqué à l’Administration des recettes non ' +
      'fiscales « dans les dix (10) jours qui suivent la tenue de ces assemblées », jours calendaires. Il s’ajoute ' +
      'à celui que reçoit la Direction générale des impôts, il ne le remplace pas. ' +
      (faits.dateAssembleeGenerale
        ? 'Délai compté depuis la date de l’assemblée déclarée.'
        : 'Échéance non calculée · déclarez la date de l’assemblée sur l’exercice.'),
    nature: 'LEGALE',
    source: SOURCE_112,
    sanction: null,
    debut: faits.dateAssembleeGenerale,
    echeance: pv,
    enRetard: enRetard(pv),
  });
  const affectation = faits.dateDepotEtatsPortefeuille ? plusJours(faits.dateDepotEtatsPortefeuille, 60) : null;
  ajoutes.push({
    etape: 26,
    libelle: 'Affectation des résultats · entreprise du portefeuille de l’État',
    detail:
      'L’affectation des résultats intervient « endéans soixante (60) jours, à compter de la date de dépôt des ' +
      'états financiers à l’administration compétente du ministère ayant le portefeuille de l’Etat dans ses ' +
      'attributions », jours calendaires. ' +
      (faits.dateDepotEtatsPortefeuille
        ? 'Délai compté depuis la date de dépôt déclarée.'
        : 'Échéance non calculée · déclarez la date de dépôt sur l’exercice.'),
    nature: 'LEGALE',
    source: SOURCE_113,
    sanction: null,
    debut: faits.dateDepotEtatsPortefeuille,
    echeance: affectation,
    enRetard: enRetard(affectation),
  });

  // Rangés par étape, les ajoutés après les jalons de même étape.
  const tous = [...resultat.map((j, i) => ({ j, i })), ...ajoutes.map((j, k) => ({ j, i: resultat.length + k }))];
  tous.sort((a, b) => a.j.etape - b.j.etape || a.i - b.i);
  return tous.map((x) => x.j);
}
