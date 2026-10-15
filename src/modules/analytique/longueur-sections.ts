import { TypeCompteDetailTotal } from '@prisma/client';

/**
 * LA LONGUEUR FIXE DES CODES DE SECTION (ligne sage-l6, fonction n° 50 ·
 * Sage, P_DOSSIER, « longueur des sections analytiques » ; support de
 * formation Comptalia, création du dossier).
 *
 * POURQUOI · une rubrique budgétaire (section Total) agrège les sections Détail
 * dont le code COMMENCE PAR LE SIEN (`rubriques-budgetaires.ts`, préfixe de
 * CHAÎNE). En longueur libre, la rubrique « 1 Personnel » absorbe la section
 * « 10 Formation » comme « 11 Salaires », en silence · le budget du bailleur
 * se lit alors sous la mauvaise rubrique, et rien ne le dit. Une longueur
 * fixe des sections Détail fait qu'aucune feuille ne peut plus se glisser
 * sous une rubrique qui n'est pas la sienne par accident de longueur.
 *
 * AUCUN TEXTE LU NE LA FIXE · le SYCEBNL laisse l'analytique « à
 * l'initiative des entités qui utilisent les découpages convenant le mieux »
 * et que chacune « subdivise à sa convenance » (Partie 2 ch. 3, classe 9,
 * sous-section 2), et le tableau d'exécution budgétaire se remplit « code et
 * libellé, suivant la nomenclature budgétaire du projet » (Partie 4 ch. 3,
 * section 2) · la codification est celle de l'entité. La longueur fixe est
 * donc une OPTION du plan, sans défaut imposé, reprise de Sage.
 *
 * DÉCISIONS (à ne pas défaire).
 *  1. PAR PLAN, pas par dossier · les codes sont uniques dans un plan, les
 *     rubriques s'agrègent dans un plan, et un dossier tient souvent un axe
 *     « Projets » à rubriques et un axe « Bailleurs » sans. Sage la pose au
 *     dossier ; nul ne gagne à imposer au second axe la longueur du premier.
 *  2. ELLE VISE LES SECTIONS DÉTAIL, à la lettre près · les rubriques (Total)
 *     sont STRICTEMENT PLUS COURTES, sans quoi elles n'agrégeraient rien
 *     (deux codes d'un plan ne sont jamais égaux) ; leurs longueurs restent
 *     libres sous ce plafond, puisque les rubriques s'emboîtent (« 1 », puis
 *     « 11 », puis la feuille « 111 »).
 *  3. RIEN N'EST RENUMÉROTÉ · une section n'a pas de code modifiable, ses
 *     ventilations et ses budgets le citent. Un plan dont une section
 *     existante ne respecte pas la longueur demandée la REFUSE, en nommant
 *     les sections ; l'issue est de retirer celles qui ne servent pas, ou de
 *     garder le plan en longueur libre.
 *  4. UN SEUL CALCUL · la lecture (aperçu à l'écran) et l'écriture (pose du
 *     paramètre, création d'une section) passent par les fonctions ci-dessous.
 *  5. LA LONGUEUR SE COMPTE EN CARACTÈRES (points de code), jamais en unités
 *     UTF-16 · « É01 » fait trois caractères.
 *
 * Bornes de 2 à 13 · convention d'OmegaX : 13 est le plafond de Sage pour les
 * comptes (`Tenant.longueurCompte`), 2 laisse place à une rubrique d'un
 * caractère au-dessus des feuilles.
 */

export const LONGUEUR_SECTIONS_MIN = 2;
export const LONGUEUR_SECTIONS_MAX = 13;

/** Combien de sections hors longueur un refus nomme au plus · le total est toujours dit. */
export const SECTIONS_NOMMEES_AU_PLUS = 20;

export interface SectionAMesurer {
  code: string;
  type: TypeCompteDetailTotal;
}

export function longueurDuCode(code: string): number {
  return Array.from(code).length;
}

/** Le refus d'une longueur hors bornes, ou d'une valeur qui n'est pas un entier. */
export function motifRefusBornesLongueur(longueur: number): string | null {
  if (!Number.isInteger(longueur) || longueur < LONGUEUR_SECTIONS_MIN || longueur > LONGUEUR_SECTIONS_MAX) {
    return `La longueur des codes de section va de ${LONGUEUR_SECTIONS_MIN} à ${LONGUEUR_SECTIONS_MAX} caractères.`;
  }
  return null;
}

/**
 * Ce qui met une section hors de la longueur `longueur`, dit en clair, ou null
 * si elle la respecte. LE prédicat, servi à la création comme à la pose.
 */
export function ecartALaLongueur(section: SectionAMesurer, longueur: number): string | null {
  const n = longueurDuCode(section.code);
  if (section.type === TypeCompteDetailTotal.TOTAL) {
    return n < longueur ? null : `rubrique de ${n} caractère${n > 1 ? 's' : ''}, qui doit être plus courte que ${longueur}`;
  }
  return n === longueur ? null : `section Détail de ${n} caractère${n > 1 ? 's' : ''} au lieu de ${longueur}`;
}

/** Le refus d'un code à la création d'une section, dans un plan à longueur fixe. */
export function motifRefusCodeSection(section: SectionAMesurer, longueur: number | null): string | null {
  if (longueur === null) return null;
  const ecart = ecartALaLongueur(section, longueur);
  if (!ecart) return null;
  return section.type === TypeCompteDetailTotal.TOTAL
    ? `Le code ${section.code} est une ${ecart} · dans ce plan, les codes des sections Détail font ${longueur} caractères, et une rubrique ne regroupe que des codes plus longs qu'elle.`
    : `Le code ${section.code} est une ${ecart} · dans ce plan, les codes des sections Détail font exactement ${longueur} caractères.`;
}

export interface SectionHorsLongueur {
  code: string;
  type: TypeCompteDetailTotal;
  ecart: string;
}

/**
 * LE RELEVÉ D'UN PLAN, en un passage · les sections hors de la longueur
 * demandée (bornées, le total compté) et la longueur que ses sections
 * suggèrent (celle de toutes ses feuilles quand elle est unique et que ses
 * rubriques sont plus courtes), servie à l'écran comme proposition, jamais
 * posée d'office.
 */
export class ReleveLongueurs {
  readonly horsLongueur: SectionHorsLongueur[] = [];
  nombreHorsLongueur = 0;
  nombreSections = 0;
  private readonly longueursDetail = new Set<number>();
  private longueurTotalMax = 0;

  constructor(private readonly longueur: number | null) {}

  ajouter(section: SectionAMesurer): void {
    this.nombreSections++;
    const n = longueurDuCode(section.code);
    if (section.type === TypeCompteDetailTotal.TOTAL) this.longueurTotalMax = Math.max(this.longueurTotalMax, n);
    else this.longueursDetail.add(n);
    if (this.longueur === null) return;
    const ecart = ecartALaLongueur(section, this.longueur);
    if (!ecart) return;
    this.nombreHorsLongueur++;
    if (this.horsLongueur.length < SECTIONS_NOMMEES_AU_PLUS) this.horsLongueur.push({ code: section.code, type: section.type, ecart });
  }

  /** La longueur commune des feuilles, si elle existe et laisse les rubriques plus courtes. */
  get proposee(): number | null {
    if (this.longueursDetail.size !== 1) return null;
    const [n] = [...this.longueursDetail];
    if (n < LONGUEUR_SECTIONS_MIN || n > LONGUEUR_SECTIONS_MAX || this.longueurTotalMax >= n) return null;
    return n;
  }
}

/** Le refus de poser `longueur` sur le plan `planCode`, tel que le relevé le fonde. */
export function motifRefusLongueurSections(planCode: string, longueur: number | null, releve: ReleveLongueurs): string | null {
  if (longueur === null) return null;
  const bornes = motifRefusBornesLongueur(longueur);
  if (bornes) return bornes;
  if (releve.nombreHorsLongueur === 0) return null;
  const noms = releve.horsLongueur.map((s) => `${s.code} (${s.ecart})`).join(', ');
  const reste = releve.nombreHorsLongueur - releve.horsLongueur.length;
  return (
    `Le plan ${planCode} ne peut pas passer à des codes de ${longueur} caractères · ` +
    `${releve.nombreHorsLongueur} section${releve.nombreHorsLongueur > 1 ? 's' : ''} ne la respecte${releve.nombreHorsLongueur > 1 ? 'nt' : ''} pas : ${noms}` +
    (reste > 0 ? `, et ${reste} autre${reste > 1 ? 's' : ''}` : '') +
    '. Aucun code n’est renuméroté · retirez les sections qui ne servent pas, ou gardez le plan en longueur libre.'
  );
}
