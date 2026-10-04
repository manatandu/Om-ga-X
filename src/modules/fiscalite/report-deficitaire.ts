import { ENTREE_EN_VIGUEUR_LOI_23_053 } from '../../common/entree-en-vigueur-loi-23-053';

/**
 * LE REPORT DÉFICITAIRE, REJOUÉ DANS L'ORDRE DE LA VIE DE L'ENTREPRISE · loi
 * n° 23/053, art. 51 et 52 (compilation DGI au 19/07/2026, lue le 2026-10-04).
 *
 * Art. 51, al. 1er · « Les pertes constatées au cours d'un exercice sont
 * considérées comme une charge déductible du bénéfice imposable de l'exercice
 * suivant. Si ce bénéfice n'est pas suffisant pour que la déduction puisse
 * être intégralement opérée, il est procédé à un report déficitaire sur les
 * exercices suivants jusqu'au troisième exercice qui suit l'exercice
 * déficitaire. » Art. 52, 2° · le caractère bénéficiaire ou déficitaire
 * s'apprécie « abstraction faite des déficits reportables des exercices
 * antérieurs ».
 *
 * LE MÉCANISME EST SÉQUENTIEL · chaque perte s'impute sur les PREMIERS
 * bénéfices qui la suivent, et un bénéfice consommé une année ne se consomme
 * plus jamais. La lecture d'avant (cas chiffré C05, `docs/cas-chiffres/is.md`)
 * ne rejouait que les trois exercices de la fenêtre de l'exercice LU · vu de
 * 2029, le bénéfice de 2028 avait consommé le déficit de 2026 ; vu de 2030, la
 * fenêtre ne voyait plus 2026, et ce même bénéfice consommait celui de 2027,
 * qui tombait de 500 000 à 410 000. Le cumul imputé changeait selon l'année
 * d'où l'on regardait, et l'impôt de 2030 sortait à 177 000 au lieu de
 * 150 000. Une fenêtre bornée ne peut pas être juste · ce qui reste d'un
 * déficit dépend des bénéfices qui l'ont suivi, que se sont d'abord partagés
 * des déficits plus anciens, et ainsi de suite. Le rejeu part donc du PREMIER
 * exercice du dossier, toujours le même, quel que soit l'exercice lu.
 *
 * L'ORDRE D'IMPUTATION ENTRE PLUSIEURS DÉFICITS · le texte ne le fixe pas.
 * OmegaX impute le plus ancien d'abord (premier à s'éteindre), règle déjà
 * écrite et servie par ce module · ce qui ne se peut pas, c'est de l'appliquer
 * en 2029 et une autre en 2030.
 *
 * LA FENÊTRE DE CHAQUE PERTE · même borne de date que la lecture d'avant
 * (passe F4b) · la perte d'un exercice clos le 31 décembre de l'année A
 * s'impute sur tout exercice qui ouvre au plus tard le 31 décembre de A + 3,
 * soit, aux exercices civils de l'art. 12, les trois exercices qui suivent.
 * Comptée en DATE, et non en lignes présentes dans le dossier · un dossier
 * qui tient 2020, 2021 puis 2026 ne réimpute pas en 2026 la perte de 2020.
 */

export interface ExerciceRejoue {
  exerciceId: string;
  dateDebut: Date;
  dateFin: Date;
  /**
   * Base de l'exercice au sens de l'art. 52, 2° · résultat fiscal AVANT
   * imputation des déficits antérieurs. Pour le premier exercice long de
   * l'art. 12, al. 3, c'est le résultat du premier exercice clos, après
   * déduction des bénéfices de la période de création.
   */
  base: number;
}

export interface DeficitReportable {
  exerciceId: string;
  dateFin: Date;
  montant: number;
  /**
   * L'exercice déficitaire ouvre avant le 1er janvier 2026 · sa perte est
   * calculée par OmegaX sous la loi n° 23/053, qui ne le régissait pas
   * (art. 153). Voir `avertissementDeficitsSimules`.
   */
  simulation: boolean;
}

const arrondir = (n: number) => Math.round(n * 100) / 100;

/** Le dernier jour où une perte de l'exercice clos à cette date s'impute encore. */
export function finDeFenetre(dateFinExerciceDeficitaire: Date, exercicesReport: number): Date {
  return new Date(
    Date.UTC(
      dateFinExerciceDeficitaire.getUTCFullYear() + exercicesReport,
      dateFinExerciceDeficitaire.getUTCMonth(),
      dateFinExerciceDeficitaire.getUTCDate(),
    ),
  );
}

/** La perte s'impute sur l'exercice qui ouvre au plus tard à la fin de sa fenêtre. */
function imputable(d: { dateFin: Date }, exercice: { dateDebut: Date }, exercicesReport: number): boolean {
  return exercice.dateDebut.getTime() <= finDeFenetre(d.dateFin, exercicesReport).getTime();
}

/**
 * Les déficits encore reportables à l'ouverture de `cible`, du plus ancien au
 * plus récent. `precedents` · TOUS les exercices du dossier clos avant
 * l'ouverture de la cible, dans n'importe quel ordre · ils sont triés ici.
 */
export function deficitsReportables(
  precedents: ExerciceRejoue[],
  cible: { dateDebut: Date },
  exercicesReport: number,
): DeficitReportable[] {
  const chronologiques = [...precedents].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
  const enCours: { exerciceId: string; dateDebut: Date; dateFin: Date; restant: number }[] = [];
  for (const ex of chronologiques) {
    if (ex.base < 0) {
      enCours.push({ exerciceId: ex.exerciceId, dateDebut: ex.dateDebut, dateFin: ex.dateFin, restant: -ex.base });
      continue;
    }
    let benefice = ex.base;
    for (const d of enCours) {
      if (benefice <= 0) break;
      // Une perte éteinte ne consomme plus rien · le bénéfice va à la suivante.
      if (d.restant <= 0 || !imputable(d, ex, exercicesReport)) continue;
      const impute = Math.min(d.restant, benefice);
      d.restant = arrondir(d.restant - impute);
      benefice = arrondir(benefice - impute);
    }
  }
  return enCours
    .filter((d) => d.restant > 0.005 && imputable(d, cible, exercicesReport))
    .map((d) => ({
      exerciceId: d.exerciceId,
      dateFin: d.dateFin,
      montant: arrondir(d.restant),
      simulation: d.dateDebut.getTime() < ENTREE_EN_VIGUEUR_LOI_23_053.getTime(),
    }));
}

/**
 * C15 · LE DÉFICIT D'AVANT LA LOI, DIT LÀ OÙ IL S'IMPUTE.
 *
 * Tranché par la loi, lu le 2026-10-04. Art. 51, al. 1er · ce qui s'impute,
 * ce sont « les pertes CONSTATÉES au cours d'un exercice ». Art. 153 · la loi
 * « entre en vigueur après vingt-quatre mois à compter du 31 décembre de
 * l'année de sa promulgation », le 1er janvier 2026, et aucune de ses
 * dispositions ne fait recalculer le résultat d'un exercice antérieur. La
 * perte de 2025 est donc celle qui a été constatée pour 2025, sous le texte
 * qui régissait 2025 (titres III et IV de l'O.-L. n° 69/009, abrogés par
 * l'art. 152, 2°, hors du corpus de calcul) ; son IMPUTATION sur 2026, elle,
 * suit l'art. 51 en vigueur. OmegaX ne détient pas la perte constatée · il
 * garde son chiffre recalculé (le montant ne change pas, cas chiffré C15) et
 * le dit dans la vue de l'exercice qui l'impute, avec la saisie qui le
 * remplace.
 */
export function avertissementDeficitsSimules(detail: DeficitReportable[], saisi: boolean): string | null {
  if (saisi) return null;
  const simules = detail.filter((d) => d.simulation);
  if (!simules.length) return null;
  const liste = simules
    .map((d) => `${d.montant.toLocaleString('fr-FR')} de l'exercice clos le ${d.dateFin.toISOString().slice(0, 10)}`)
    .join(', ');
  return (
    `DÉFICIT D'AVANT LA LOI, RECALCULÉ · ${liste}. L'exercice qui l'a subi ouvre avant le 1er janvier 2026 ; OmegaX l'a ` +
    "recalculé sous la loi n° 23/053, qui ne le régissait pas (art. 153). Ce qui s'impute est la perte CONSTATÉE pour cet " +
    "exercice (art. 51, al. 1er), sous le texte de l'époque, que le dossier ne contient pas ; son imputation suit, elle, " +
    "l'art. 51 en vigueur. Le montant affiché est une SIMULATION · saisissez le déficit réellement constaté dans « Déficits " +
    "antérieurs », il prime sur le calcul."
  );
}
