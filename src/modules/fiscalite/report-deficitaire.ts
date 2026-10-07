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
  /**
   * B2, P1 · le report disponible À L'OUVERTURE de cet exercice, DÉCLARÉ par
   * le cabinet (`deficitAnterieurSaisi`). Il FAIT FOI dans le rejeu · il
   * remplace le reste calculé à cette date, et la suite du rejeu part de lui.
   * `origines` · les exercices d'où viennent les pertes (date de clôture et
   * montant), qui donnent à chacune sa fenêtre de l'art. 51 ; null quand le
   * cabinet ne les a pas dites.
   */
  ouvertureDeclaree?: { montant: number; origines: { dateFin: Date; montant: number }[] | null } | null;
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
  /** Le reste vient d'un report DÉCLARÉ à l'ouverture d'un exercice antérieur (B2, P1). */
  declare: boolean;
  /**
   * Déclaré SANS origine · borné par prudence à la fenêtre la plus courte
   * (une perte qui ne s'imputait plus que sur l'exercice de la déclaration).
   */
  bornePrudente: boolean;
}

/** Ce que le rejeu a perdu d'un report déclaré sans origine, et où. */
export interface ReportPerduParPrudence {
  exerciceDeclarationId: string;
  dateDebutDeclaration: Date;
  montant: number;
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
  return rejouerReport(precedents, cible, exercicesReport).detail;
}

/**
 * LA DATE DE CLÔTURE PRUDENTE d'une perte déclarée sans origine · celle de la
 * perte la plus ancienne encore imputable à l'ouverture de la déclaration,
 * donc la fenêtre la plus courte (elle ne couvre que l'exercice de la
 * déclaration, aux exercices civils). Prudence voulue · supposer une perte
 * plus récente prolongerait un droit qui peut être éteint.
 */
export function dateFinPrudente(dateDebutDeclaration: Date, exercicesReport: number): Date {
  return new Date(
    Date.UTC(
      dateDebutDeclaration.getUTCFullYear() - exercicesReport,
      dateDebutDeclaration.getUTCMonth(),
      dateDebutDeclaration.getUTCDate(),
    ),
  );
}

/** Le rejeu complet · le détail à l'ouverture de la cible, et ce que la prudence a perdu en route. */
export function rejouerReport(
  precedents: ExerciceRejoue[],
  cible: { dateDebut: Date },
  exercicesReport: number,
): { detail: DeficitReportable[]; perdusParPrudence: ReportPerduParPrudence[] } {
  const chronologiques = [...precedents].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
  type EnCours = {
    exerciceId: string;
    dateDebut: Date;
    dateFin: Date;
    restant: number;
    simulation: boolean;
    declare: boolean;
    bornePrudente: boolean;
    declarationId: string | null;
    dateDebutDeclaration: Date | null;
  };
  let enCours: EnCours[] = [];
  for (const ex of chronologiques) {
    if (ex.ouvertureDeclaree) {
      // LA DÉCLARATION FAIT FOI · elle remplace tout le reste calculé à cette
      // ouverture. Chaque perte garde la fenêtre de SON exercice d'origine.
      const o = ex.ouvertureDeclaree;
      const origines =
        o.origines && o.origines.length
          ? o.origines.map((x) => ({ dateFin: x.dateFin, montant: x.montant, prudente: false }))
          : [{ dateFin: dateFinPrudente(ex.dateDebut, exercicesReport), montant: o.montant, prudente: true }];
      enCours = origines
        .filter((x) => x.montant > 0.005)
        .map((x) => ({
          exerciceId: ex.exerciceId,
          dateDebut: x.dateFin,
          dateFin: x.dateFin,
          restant: arrondir(x.montant),
          simulation: false,
          declare: true,
          bornePrudente: x.prudente,
          declarationId: ex.exerciceId,
          dateDebutDeclaration: ex.dateDebut,
        }));
    }
    if (ex.base < 0) {
      enCours.push({
        exerciceId: ex.exerciceId,
        dateDebut: ex.dateDebut,
        dateFin: ex.dateFin,
        restant: -ex.base,
        simulation: ex.dateDebut.getTime() < ENTREE_EN_VIGUEUR_LOI_23_053.getTime(),
        declare: false,
        bornePrudente: false,
        declarationId: null,
        dateDebutDeclaration: null,
      });
      continue;
    }
    let benefice = ex.base;
    // Le plus ancien d'abord · l'ordre se lit sur la date de clôture de la
    // perte, une déclaration pouvant porter des pertes plus anciennes que
    // celles calculées après elle.
    for (const d of [...enCours].sort((a, b) => a.dateFin.getTime() - b.dateFin.getTime())) {
      if (benefice <= 0) break;
      // Une perte éteinte ne consomme plus rien · le bénéfice va à la suivante.
      if (d.restant <= 0 || !imputable(d, ex, exercicesReport)) continue;
      const impute = Math.min(d.restant, benefice);
      d.restant = arrondir(d.restant - impute);
      benefice = arrondir(benefice - impute);
    }
  }
  const perdusParPrudence = enCours
    .filter((d) => d.bornePrudente && d.restant > 0.005 && !imputable(d, cible, exercicesReport))
    .map((d) => ({
      exerciceDeclarationId: d.declarationId!,
      dateDebutDeclaration: d.dateDebutDeclaration!,
      montant: arrondir(d.restant),
    }));
  const detail = enCours
    .filter((d) => d.restant > 0.005 && imputable(d, cible, exercicesReport))
    .sort((a, b) => a.dateFin.getTime() - b.dateFin.getTime())
    .map((d) => ({
      exerciceId: d.exerciceId,
      dateFin: d.dateFin,
      montant: arrondir(d.restant),
      simulation: d.simulation,
      declare: d.declare,
      bornePrudente: d.bornePrudente,
    }));
  return { detail, perdusParPrudence };
}

/**
 * LA SAISIE DANS L'EXERCICE MÊME QUI LA DÉCLARE · même règle que le rejeu, par
 * la même fonction `imputable`. Une origine dont la fenêtre de l'art. 51 est
 * close à l'ouverture de l'exercice n'y est pas imputable · la saisie entière
 * s'imputait (perte de 2021 déclarée en 2026, fenêtre close en 2024 · impôt
 * de 150 000 au lieu de 300 000, sans un mot). Sans origine dite, la saisie
 * est imputable dans son exercice (la borne prudente le couvre toujours).
 */
export function partImputableDeLaSaisie(
  montant: number,
  origines: { dateFin: Date; montant: number }[] | null,
  exercice: { dateDebut: Date },
  exercicesReport: number,
): { imputable: number; horsFenetre: { dateFin: Date; montant: number; finDeFenetre: Date }[] } {
  if (!origines || !origines.length) return { imputable: arrondir(montant), horsFenetre: [] };
  const horsFenetre = origines
    .filter((o) => !imputable(o, exercice, exercicesReport))
    .map((o) => ({ ...o, finDeFenetre: finDeFenetre(o.dateFin, exercicesReport) }));
  const exclu = horsFenetre.reduce((t, o) => t + o.montant, 0);
  return { imputable: arrondir(Math.max(montant - exclu, 0)), horsFenetre };
}

/** L'exercice d'une perte dont la fenêtre est close avant `dateDebut` · refus à la saisie (art. 51). */
export function originesHorsFenetre(
  origines: { dateFin: Date; montant: number }[],
  exercice: { dateDebut: Date },
  exercicesReport: number,
): { dateFin: Date; finDeFenetre: Date }[] {
  return origines
    .filter((o) => !imputable(o, exercice, exercicesReport))
    .map((o) => ({ dateFin: o.dateFin, finDeFenetre: finDeFenetre(o.dateFin, exercicesReport) }));
}

/**
 * B2, P1 · LE REPORT DÉCLARÉ SANS ORIGINE, borné par prudence et DIT. Une
 * part encore disponible y est nommée avec la limite qu'on lui a posée ; une
 * part perdue à cause de cette borne l'est avec son montant, pour que le
 * cabinet déclare l'origine plutôt que de perdre un droit sans un mot.
 */
export function avertissementsReportDeclare(
  detail: DeficitReportable[],
  perdus: ReportPerduParPrudence[],
  /** Exercices clos · on n'y déclare plus rien, l'issue est l'exercice ouvert suivant. */
  exercicesClos: Set<string> = new Set(),
): string[] {
  const avertissements: string[] = [];
  const bornes = detail.filter((d) => d.bornePrudente);
  if (bornes.length) {
    avertissements.push(
      `REPORT DÉCLARÉ SANS ORIGINE · ${bornes.map((d) => d.montant.toLocaleString('fr-FR')).join(', ')} vient d'un report saisi à l'ouverture d'un exercice antérieur sans dire de quels exercices viennent les pertes. ` +
        "Chacune garde sa fenêtre de l'art. 51 (jusqu'au troisième exercice qui suit l'exercice déficitaire) · faute de la connaître, OmegaX la borne par PRUDENCE à la plus courte, comme si la perte venait du plus ancien exercice encore imputable. Déclarez l'origine des pertes avec le report saisi pour lui rendre sa vraie fenêtre.",
    );
  }
  for (const p of perdus) {
    avertissements.push(
      `REPORT PERDU PAR PRUDENCE · ${p.montant.toLocaleString('fr-FR')} du report déclaré à l'ouverture du ${p.dateDebutDeclaration.toISOString().slice(0, 10)} ne s'impute plus ici, sa fenêtre ayant été bornée faute d'origine déclarée. ` +
        (exercicesClos.has(p.exerciceDeclarationId)
          ? "L'exercice de cette saisie est clôturé et ne se retouche plus · si ces pertes viennent d'exercices plus récents, déclarez à l'ouverture de l'exercice OUVERT suivant le report qui y reste disponible, avec son origine · elles y retrouvent leur fenêtre de l'art. 51."
          : "Si ces pertes viennent d'exercices plus récents, déclarez leur origine sur l'exercice de la saisie · elles retrouvent alors leur fenêtre de l'art. 51."),
    );
  }
  return avertissements;
}

/**
 * (8) DES EXERCICES NON JOINTIFS DANS LA FENÊTRE · la fenêtre de l'art. 51 se
 * compte en date, mais le rejeu n'impute que sur les bénéfices des exercices
 * TENUS ici · un trou dans la suite des exercices est un bénéfice (ou une
 * perte) que le rejeu ne voit pas. Nommé, jamais comblé.
 */
export function avertissementExercicesNonJointifs(
  precedents: { dateDebut: Date; dateFin: Date }[],
  cible: { dateDebut: Date },
  exercicesReport: number,
): string | null {
  const debutFenetre = dateFinPrudente(cible.dateDebut, exercicesReport);
  const suite = [...precedents, { dateDebut: cible.dateDebut, dateFin: cible.dateDebut }].sort(
    (a, b) => a.dateDebut.getTime() - b.dateDebut.getTime(),
  );
  const trous: string[] = [];
  for (let i = 1; i < suite.length; i++) {
    const fin = suite[i - 1].dateFin;
    const lendemain = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate() + 1));
    if (suite[i].dateDebut.getTime() > lendemain.getTime() && suite[i].dateDebut.getTime() > debutFenetre.getTime()) {
      const veille = new Date(suite[i].dateDebut.getTime() - 86_400_000);
      trous.push(`du ${lendemain.toISOString().slice(0, 10)} au ${veille.toISOString().slice(0, 10)}`);
    }
  }
  if (!trous.length) return null;
  return (
    `EXERCICES NON JOINTIFS DANS LA FENÊTRE DU REPORT · aucune comptabilité n'est tenue ici ${trous.join(', ')}. ` +
    "Le report de l'art. 51 se compte jusqu'au troisième exercice qui suit l'exercice déficitaire, et un exercice absent du dossier a pu consommer une perte (ou en créer une) que le rejeu ne voit pas · le déficit affiché peut être trop fort ou trop faible. Saisissez le report réellement disponible à l'ouverture de cet exercice."
  );
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
    "l'art. 51 en vigueur. Le montant affiché est une SIMULATION · saisissez dans « Déficits antérieurs » le reste à " +
    "reporter à l'ouverture de cet exercice, il prime sur le calcul et fait foi pour les exercices suivants."
  );
}
