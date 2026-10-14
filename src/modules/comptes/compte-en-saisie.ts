import { Referentiel, TypeCompteDetailTotal } from '@prisma/client';
import { PANOPLIES_TIERS } from '../tiers/collectifs-tiers';

/**
 * CRÉER UN COMPTE PENDANT LA SAISIE (ligne sage-l1, fonction 14 · Sage 100
 * i7, manuel 10, Journaux et saisie, « création d'un compte pendant la
 * saisie », une option du dossier).
 *
 * Aucun texte ne régit le geste · l'AUDCIF art. 18, al. 3 (« peut ouvrir
 * toutes subdivisions nécessaires ») et, au SYCEBNL dont l'art. 3 écarte
 * l'art. 18, la Partie 2 ch. 2, section 1 (le plan « peut être complété par
 * des codes établis en fonction des besoins ») laissent l'entité subdiviser.
 * Ce qui est tenu ici est la règle d'organisation d'OmegaX, la même que la
 * personnalisation du Plan comptable (décision de Manasse du 2026-10-09) ·
 *  · une OPTION du dossier, fermée par défaut (`creationCompteEnSaisie`) · le
 *    plan reste la structure de l'administrateur tant qu'il ne l'ouvre pas ;
 *  · le compte créé est un SOUS-COMPTE d'un compte d'imputation du plan
 *    officiel (`compteSemeSubdivise`), jamais un numéro hors plan ni un
 *    compte semé · il fonctionne alors comme son compte du plan (réglages
 *    repris par `CompteService.creer`) et les états le lisent par sa racine ;
 *  · il naît PERSONNALISÉ (« créé retenu ») et se saisit aussitôt ;
 *  · jamais sous un collectif de tiers · le compte d'un tiers naît avec sa
 *    fiche (§ 6, compte individuel de tiers, panoplie), et un compte ouvert
 *    ici n'aurait ni tiers ni lien au collectif ;
 *  · la longueur est celle que le dossier admet (`Tenant.longueurCompte`),
 *    jugée par `CompteService.creer`.
 */

export const MOTIF_OPTION_FERMEE =
  "La création d'un compte pendant la saisie n'est pas ouverte dans ce dossier · l'administrateur l'ouvre dans " +
  'Paramètres du dossier, ou personnalise le compte dans Plan comptable.';

/** Le collectif de tiers dont le compte du plan est l'un des comptes, s'il l'est (toutes les panoplies du référentiel). */
export function collectifDeTiers(referentiel: Referentiel, numeroDuPlan: string): string | null {
  for (const panoplie of Object.values(PANOPLIES_TIERS[referentiel])) {
    for (const c of panoplie ?? []) if (c.collectif === numeroDuPlan) return c.collectif;
  }
  return null;
}

export interface CompteDuPlanLu {
  numero: string;
  intitule: string;
  typeCompte: TypeCompteDetailTotal;
  estActif: boolean;
}

/**
 * Le motif qui refuse le numéro tapé, ou null s'il peut naître · l'ordre dit
 * d'abord ce qui se corrige dans la saisie (un compte existant, un numéro
 * trop long), puis ce qui relève du plan.
 */
export function motifRefusCompteEnSaisie(p: {
  referentiel: Referentiel;
  numero: string;
  longueurCompte: number;
  existe: boolean;
  /** Le compte du plan que le numéro subdivise (`compteSemeSubdivise`), null s'il n'en subdivise aucun. */
  numeroDuPlan: string | null;
  /** Ce compte du plan tel que le dossier le tient · null s'il n'y est plus. */
  compteDuPlan: CompteDuPlanLu | null;
}): string | null {
  if (!/^\d+$/.test(p.numero)) return 'Le numéro de compte se compose de chiffres seuls.';
  if (p.existe) {
    return (
      `Le compte ${p.numero} existe déjà dans ce dossier · choisissez-le dans la liste ; s'il n'y est pas, ` +
      "l'administrateur le personnalise dans Plan comptable."
    );
  }
  if (p.numero.length > p.longueurCompte) {
    return (
      `Le numéro ${p.numero} dépasse la longueur des comptes de ce dossier (${p.longueurCompte} chiffres) · ` +
      'Structure > Paramètres du dossier.'
    );
  }
  if (p.numeroDuPlan === null) {
    return (
      `Le numéro ${p.numero} ne subdivise aucun compte d'imputation du plan · un compte créé en saisie s'ouvre ` +
      "sous un compte d'imputation du plan officiel (tapez son numéro suivi du rang voulu)."
    );
  }
  if (p.compteDuPlan === null) {
    return `Le compte du plan ${p.numeroDuPlan}, que ce numéro subdiviserait, n'existe plus dans ce dossier · Plan comptable.`;
  }
  if (p.compteDuPlan.typeCompte !== TypeCompteDetailTotal.DETAIL) {
    return `Le compte du plan ${p.numeroDuPlan} n'est pas un compte d'imputation dans ce dossier · Plan comptable.`;
  }
  if (!p.compteDuPlan.estActif) {
    return (
      `Le compte du plan ${p.numeroDuPlan} est en sommeil · l'administrateur le réactive dans Plan comptable avant ` +
      "qu'un sous-compte s'ouvre sous lui."
    );
  }
  const collectif = collectifDeTiers(p.referentiel, p.numeroDuPlan);
  if (collectif) {
    return (
      `Le numéro ${p.numero} se rangerait sous le collectif ${collectif} des tiers · le compte d'un tiers naît avec ` +
      'sa fiche (Structure > Plan tiers), qui le rattache à son collectif.'
    );
  }
  return null;
}
