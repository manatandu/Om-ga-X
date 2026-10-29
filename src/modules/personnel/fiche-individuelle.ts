/**
 * LIGNE PAIE-SUITE, FONCTION 89 · LA FICHE INDIVIDUELLE ET LES CUMULS ANNUELS
 * PAR RUBRIQUE · moteur pur, sans Prisma.
 *
 * CE QUE C'EST · le relevé, pour UN salarié et UNE année civile, de ce que
 * ses bulletins ÉMIS ont figé · mois par mois, le total versé, l'assiette
 * sociale, les cotisations des deux côtés, la retenue de l'impôt (art. 119 de
 * la loi n° 23/053), les retenues d'avance et le net, puis le cumul de chaque
 * élément de rémunération par rubrique. Il sert les attestations de salaire
 * et le contrôle de la retenue de l'année · la retenue mensuelle est un
 * ACOMPTE sur l'impôt annuel · l'impôt s'établit sur le revenu net annuel
 * (art. 116) et se diminue des retenues de l'année (art. 121) ; l'année se
 * lit donc en cumul.
 *
 * CE QUE CE N'EST PAS · ni le livre de paie (art. 213 à 215 du Code du
 * travail, `livre-de-paie.ts`), ni un document déposé · une édition de
 * travail, dite telle, qui ne calcule RIEN · elle additionne ce que les
 * bulletins émis portent, au centime (les chiffres que le travailleur a lus).
 *
 * TROIS RÈGLES.
 * (1) SEULS LES BULLETINS ÉMIS COMPTENT · un bulletin annulé n'a rien versé
 *     qui reste (son remplaçant le porte) ; il est COMPTÉ et nommé à part,
 *     jamais additionné en silence.
 * (2) L'ANNÉE EST CELLE DU MOIS DE PAIE · le mois du bulletin (`moisDePaie`),
 *     jamais sa date d'émission. Un rappel de salaire se porte sur le
 *     bulletin du mois où il est PAYÉ (fonction 87, `rappel-salaire.ts` ·
 *     « à chaque paie », Code du travail, art. 213) · il compte dans ce
 *     mois-là, sous sa rubrique.
 * (3) UNE RUBRIQUE EST LA RUBRIQUE DU CABINET (`rubriqueId`), SINON LA NATURE
 *     DE L'ÉLÉMENT · une prime sans rubrique se range sous la nature « Prime »,
 *     et les libellés libres ne font pas autant de lignes que de bulletins.
 *     Les montants sont les FRANCS du bulletin (une stipulation en dollars se
 *     lit sur ses éléments convertis et figés, `elementsEnFrancs`) · un
 *     bulletin illisible ne nourrit aucune rubrique, et c'est DIT, ses totaux
 *     figés restant comptés.
 */
import { elementsEnFrancs } from './comptabilisation-paie';

export type BulletinPourFiche = {
  readonly numero: number;
  readonly moisDePaie: string;
  readonly nature: string;
  readonly statut: 'EMIS' | 'ANNULE';
  readonly totalVerseFc: number;
  readonly assietteSocialeFc: number;
  readonly cotisationsTravailleurFc: number;
  readonly cotisationsEmployeurFc: number;
  readonly irppFc: number;
  readonly netAPayerFc: number;
  readonly entree: unknown;
  readonly calcul: unknown;
};

export type TotauxFiche = {
  brut: number;
  assietteSociale: number;
  cotisationsTravailleur: number;
  cotisationsEmployeur: number;
  irpp: number;
  retenuesAvances: number;
  net: number;
};

export type LigneRubrique = {
  cle: string;
  code: string | null;
  libelle: string;
  nature: string;
  parMois: Record<string, number>;
  total: number;
};

export type FicheIndividuelle = {
  annee: number;
  mois: { mois: string; bulletins: { numero: number; nature: string }[]; totaux: TotauxFiche }[];
  cumul: TotauxFiche;
  rubriques: LigneRubrique[];
  annules: { numero: number; moisDePaie: string }[];
  illisibles: number[];
};

const c = (n: number) => Math.round(n * 100);
const f = (centimes: number) => centimes / 100;
const objet = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' ? (x as Record<string, unknown>) : null);
const vides = (): TotauxFiche => ({ brut: 0, assietteSociale: 0, cotisationsTravailleur: 0, cotisationsEmployeur: 0, irpp: 0, retenuesAvances: 0, net: 0 });

/** Les retenues d'avance figées sur le bulletin · absentes d'un bulletin d'avant ce chantier, zéro et rien d'autre. */
function retenuesDuBulletin(calcul: unknown): number {
  const r = objet(calcul)?.retenuesAvances;
  if (!Array.isArray(r)) return 0;
  return r.reduce((n: number, x) => n + (typeof objet(x)?.montantFc === 'number' ? c(objet(x)!.montantFc as number) : 0), 0);
}

export function ficheIndividuelle(
  annee: number,
  bulletins: readonly BulletinPourFiche[],
  rubriques: ReadonlyMap<string, { code: string; libelle: string }>,
): FicheIndividuelle {
  const prefixe = `${annee}-`;
  const del = bulletins.filter((b) => b.moisDePaie.startsWith(prefixe));
  const annules = del.filter((b) => b.statut !== 'EMIS').map((b) => ({ numero: b.numero, moisDePaie: b.moisDePaie }));
  const emis = del.filter((b) => b.statut === 'EMIS').sort((a, b) => a.moisDePaie.localeCompare(b.moisDePaie) || a.numero - b.numero);

  const parMois = new Map<string, { bulletins: { numero: number; nature: string }[]; totaux: TotauxFiche }>();
  const cumul = vides();
  const lignes = new Map<string, LigneRubrique>();
  const illisibles: number[] = [];

  for (const b of emis) {
    const m = parMois.get(b.moisDePaie) ?? { bulletins: [], totaux: vides() };
    const t = {
      brut: c(b.totalVerseFc),
      assietteSociale: c(b.assietteSocialeFc),
      cotisationsTravailleur: c(b.cotisationsTravailleurFc),
      cotisationsEmployeur: c(b.cotisationsEmployeurFc),
      irpp: c(b.irppFc),
      retenuesAvances: retenuesDuBulletin(b.calcul),
      net: c(b.netAPayerFc),
    };
    for (const k of Object.keys(t) as (keyof TotauxFiche)[]) {
      m.totaux[k] += t[k];
      cumul[k] += t[k];
    }
    m.bulletins.push({ numero: b.numero, nature: b.nature });
    parMois.set(b.moisDePaie, m);

    const elements = elementsEnFrancs(objet(b.entree)?.elements, objet(objet(b.calcul)?.conversion));
    if (!elements) {
      illisibles.push(b.numero);
      continue;
    }
    for (const e of elements as readonly { nature: string; libelle: string; montantFc: number; rubriqueId?: string }[]) {
      const rubrique = e.rubriqueId ? rubriques.get(e.rubriqueId) : undefined;
      const cle = rubrique ? `R:${e.rubriqueId}` : `N:${e.nature}`;
      const l = lignes.get(cle) ?? {
        cle,
        code: rubrique?.code ?? null,
        libelle: rubrique?.libelle ?? e.libelle,
        nature: e.nature,
        parMois: {},
        total: 0,
      };
      l.parMois[b.moisDePaie] = (l.parMois[b.moisDePaie] ?? 0) + c(e.montantFc);
      l.total += c(e.montantFc);
      lignes.set(cle, l);
    }
  }

  const enFrancs = (t: TotauxFiche): TotauxFiche => ({
    brut: f(t.brut),
    assietteSociale: f(t.assietteSociale),
    cotisationsTravailleur: f(t.cotisationsTravailleur),
    cotisationsEmployeur: f(t.cotisationsEmployeur),
    irpp: f(t.irpp),
    retenuesAvances: f(t.retenuesAvances),
    net: f(t.net),
  });
  return {
    annee,
    mois: [...parMois.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mois, v]) => ({ mois, bulletins: v.bulletins, totaux: enFrancs(v.totaux) })),
    cumul: enFrancs(cumul),
    rubriques: [...lignes.values()]
      .sort((a, b) => (a.code ?? '￿').localeCompare(b.code ?? '￿') || a.nature.localeCompare(b.nature))
      .map((l) => ({ ...l, parMois: Object.fromEntries(Object.entries(l.parMois).map(([k, v]) => [k, f(v)])), total: f(l.total) })),
    annules,
    illisibles,
  };
}

export const RESERVE_FICHE_INDIVIDUELLE =
  "Édition de travail · elle additionne ce que les bulletins ÉMIS de l'année ont figé, au mois de paie auquel ils se rapportent, et ne calcule rien. L'impôt s'établit sur le revenu net annuel et se diminue des retenues de l'année (loi n° 23/053, art. 116 et 121) · la retenue mensuelle se lit donc en cumul. Ce n'est ni le livre de paie (Code du travail, art. 213 à 215) ni un document déposé.";
