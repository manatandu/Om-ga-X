/**
 * SIMULATION DES DOTATIONS FUTURES (ligne immos, fonction n° 72 · Sage
 * Immobilisations, « Simulation », M4 B-85) · les règles pures.
 *
 * CE N'EST PAS UN ÉTAT DÉPOSÉ, ET RIEN N'EST ÉCRIT. Aucun texte ne régit une
 * prévision · c'est un outil de budget (plan prévisionnel, budget d'un
 * bailleur), et la fenêtre le dit. La SEULE règle est qu'elle calcule comme le
 * plan · chaque annuité sort du moteur de la dotation
 * (`ImmobilisationService.calculerDotation`), avec les mêmes arguments que
 * `passerDotation` et le tableau des amortissements, les dotations simulées
 * des périodes précédentes tenant lieu de dotations passées. Une seconde
 * formule annoncerait une annuité que la dotation, le jour venu, ne passerait
 * pas.
 *
 * LES PÉRIODES · l'exercice choisi, puis les exercices déjà ouverts du dossier
 * qui le suivent sans trou, puis des périodes FICTIVES de douze mois, chacune
 * commençant le lendemain de la précédente (AUDCIF art. 7, « une période de
 * douze mois, appelée exercice »). Une période fictive est dite telle.
 *
 * NULL N'EST PAS ZÉRO · un bien aux unités d'œuvre n'a pas de relevé pour une
 * période future (aucun livre ne porte le compteur d'une machine) · son
 * annuité est `null`, « non calculée », et le total de la période dit combien
 * de biens il ne compte pas. Zéro est une réponse · un bien entièrement amorti,
 * ou pas encore mis en service.
 */

export interface PeriodeSimulee {
  dateDebut: Date;
  dateFin: Date;
  /** L'identifiant de l'exercice du dossier, null pour une période fictive. */
  exerciceId: string | null;
}

/** Le nombre de périodes admis · convention d'OmegaX (un plan prévisionnel dépasse rarement dix ans). */
export const PERIODES_MIN = 1;
export const PERIODES_MAX = 15;
export const PERIODES_PAR_DEFAUT = 5;

const JOUR = 86_400_000;

/** Le lendemain d'un jour (dates à minuit UTC, CLAUDE.md, échéances). */
function lendemain(d: Date): Date {
  return new Date(d.getTime() + JOUR);
}

/** La veille du même quantième douze mois plus tard · 1er janvier donne 31 décembre. */
function finDeDouzeMois(debut: Date): Date {
  const a = debut.getUTCFullYear() + 1;
  const m = debut.getUTCMonth();
  const j = debut.getUTCDate();
  // Un 29 février + un an tombe au 1er mars · Date.UTC le fait, la veille suit.
  const meme = new Date(Date.UTC(a, m, j));
  return new Date(meme.getTime() - JOUR);
}

/**
 * Les périodes de la simulation · l'exercice de départ, ses successeurs du
 * dossier tant qu'ils s'enchaînent jour pour jour, puis des années fictives.
 */
export function periodesDeSimulation(
  depart: { id: string; dateDebut: Date; dateFin: Date },
  exercicesDuDossier: readonly { id: string; dateDebut: Date; dateFin: Date }[],
  nombre: number,
): PeriodeSimulee[] {
  const n = Math.max(PERIODES_MIN, Math.min(PERIODES_MAX, Math.trunc(nombre)));
  const periodes: PeriodeSimulee[] = [{ dateDebut: depart.dateDebut, dateFin: depart.dateFin, exerciceId: depart.id }];
  const suivants = [...exercicesDuDossier].filter((e) => e.dateDebut > depart.dateFin).sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
  for (const e of suivants) {
    if (periodes.length >= n) break;
    const precedente = periodes[periodes.length - 1];
    // Un trou ou un chevauchement arrête la reprise des exercices réels · la
    // suite est fictive, comptée depuis la dernière période retenue.
    if (e.dateDebut.getTime() !== lendemain(precedente.dateFin).getTime()) break;
    periodes.push({ dateDebut: e.dateDebut, dateFin: e.dateFin, exerciceId: e.id });
  }
  while (periodes.length < n) {
    const debut = lendemain(periodes[periodes.length - 1].dateFin);
    periodes.push({ dateDebut: debut, dateFin: finDeDouzeMois(debut), exerciceId: null });
  }
  return periodes;
}

/** Le nombre de périodes demandé · illisible ou hors plage, un motif nommé ; absent, le défaut. */
export function lireNombreDePeriodes(brut: string | undefined): number | { motif: string } {
  if (brut === undefined || brut.trim() === '') return PERIODES_PAR_DEFAUT;
  const x = Number(brut);
  if (!Number.isInteger(x) || x < PERIODES_MIN || x > PERIODES_MAX) {
    return { motif: `Le nombre d'exercices simulés est un entier de ${PERIODES_MIN} à ${PERIODES_MAX}.` };
  }
  return x;
}

export interface LigneSimulee {
  /** Une annuité par période · null pour « non calculée ». */
  annuites: (number | null)[];
  /** La période dont la dotation est DÉJÀ passée · son montant est celui du journal. */
  passees: boolean[];
}

/**
 * Les totaux par période · la somme des annuités calculées, et le nombre de
 * biens qu'elle ne compte pas (annuité non calculée). Au centime.
 */
export function totauxDeLaSimulation(lignes: readonly LigneSimulee[], nombrePeriodes: number) {
  const totaux: { montant: number; nonCalcules: number }[] = [];
  for (let k = 0; k < nombrePeriodes; k += 1) {
    let centimes = 0;
    let nonCalcules = 0;
    for (const l of lignes) {
      const a = l.annuites[k];
      if (a === null || a === undefined) nonCalcules += 1;
      else centimes += Math.round(a * 100);
    }
    totaux.push({ montant: centimes / 100, nonCalcules });
  }
  return totaux;
}
