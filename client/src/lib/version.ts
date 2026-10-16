/**
 * CE QUE « À PROPOS » DIT DE LA CONSTRUCTION (audit final F180).
 *
 * La boîte annonçait « Version de développement » partout, production
 * comprise. Or une installation sur site ne reçoit que les versions dont le
 * PAQUET est antérieur à sa fin de maintenance (`sur-site/licence-signee.ts`) ·
 * sans la date du paquet à l'écran, le client ne peut pas dire ce qu'il a.
 *
 * Les trois valeurs viennent de `vite.config.ts`. Lues par `typeof`, jamais
 * directement · un lanceur de tests qui ne les définit pas lèverait sinon.
 */
// Posés par `vite.config.ts` · déclarés ICI et non dans vite-env.d.ts, que le
// jest de la racine ne lit pas en vérifiant les types de ce module.
declare const __OMEGAX_VERSION__: string | null | undefined;
declare const __OMEGAX_COMMIT__: string | null | undefined;
declare const __OMEGAX_CONSTRUIT_LE__: string | undefined;
declare const __OMEGAX_MISE_EN_PRODUCTION__: { le: string; publication: string | null } | null | undefined;

export interface IdentiteConstruction {
  version: string | null;
  commit: string | null;
  construitLe: string | null;
  /**
   * La publication qui a mis cette interface en production · posée par le
   * workflow qui construit ET déploie (`vite.config.ts`), `null` partout
   * ailleurs. Facultative pour les appelants qui ne la lisent pas.
   */
  miseEnProduction?: { le: string; publication: string | null } | null;
}

export function identiteConstruction(): IdentiteConstruction {
  return {
    version: typeof __OMEGAX_VERSION__ !== 'undefined' ? __OMEGAX_VERSION__ : null,
    commit: typeof __OMEGAX_COMMIT__ !== 'undefined' ? __OMEGAX_COMMIT__ : null,
    construitLe: typeof __OMEGAX_CONSTRUIT_LE__ !== 'undefined' ? __OMEGAX_CONSTRUIT_LE__ : null,
    miseEnProduction: typeof __OMEGAX_MISE_EN_PRODUCTION__ !== 'undefined' ? __OMEGAX_MISE_EN_PRODUCTION__ : null,
  };
}

/**
 * La ligne affichée · ce qui manque est DIT (« révision non renseignée »),
 * jamais remplacé, et la date du paquet sur site s'ajoute quand le poste la
 * connaît.
 */
export function ligneVersion(c: IdentiteConstruction, datePaquetSurSite?: string | null): string {
  const morceaux = [
    c.version ? `Version ${c.version}` : 'Version non renseignée',
    c.commit ? `révision ${c.commit}` : 'révision non renseignée (construction locale)',
  ];
  if (c.construitLe) morceaux.push(`construite le ${c.construitLe}`);
  if (datePaquetSurSite) morceaux.push(`paquet sur site du ${datePaquetSurSite}`);
  return `${morceaux.join(' · ')}.`;
}

/**
 * LA MISE EN PRODUCTION (demande de Manasse du 2026-10-15 · « indiquer la
 * version, mise en production et langue »). Elle ne se distingue de la date
 * de construction que par sa SOURCE · la publication qui a déployé cette
 * interface, son numéro compris. Sans elle (construction locale, aperçu,
 * paquet sur site, dont la date de publication est déjà dite par la ligne de
 * version), elle est dite inconnue, jamais devinée.
 */
export function ligneMiseEnProduction(c: IdentiteConstruction): string {
  const m = c.miseEnProduction;
  if (!m) return 'Mise en production · non renseignée (construction hors de la chaîne de publication en ligne).';
  return `Mise en production de l’interface · le ${m.le}${m.publication ? `, publication n° ${m.publication}` : ''}.`;
}

/**
 * LA LANGUE · OmegaX n'a qu'une langue, le français · la comptabilité se
 * tient en français (loi n° 23/053, art. 141, 1°), et le contrat de licence se
 * conclut en français (Code du numérique, art. 53, 8°). La ligne ne promet
 * aucune autre langue.
 */
export const LANGUE_INTERFACE = 'français';

export function ligneLangue(): string {
  return `Langue de l’interface · ${LANGUE_INTERFACE}, seule langue disponible.`;
}
