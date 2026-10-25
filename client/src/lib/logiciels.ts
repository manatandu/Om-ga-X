import type { MenuDef, MenuEntreeDef, MenuItemDef } from '../components/chrome/menu-groupes';
import { estGroupe } from '../components/chrome/menu-groupes';

/**
 * LES « LOGICIELS » (TUILES) · ce que l'utilisateur choisit après sa
 * connexion, et qui restreint sa barre de menus à ce qui le concerne.
 * Demande de Manasse du 2026-10-25.
 *
 * UNE SEULE TABLE, CONFRONTÉE AU MENU RÉEL. Le regroupement des commandes en
 * logiciels n'est écrit qu'ici, par chemin de fenêtre ; `logiciels.spec.ts`
 * relit `AppShell.tsx` (les menus), `AccueilPage.tsx` et
 * `accueil-par-metier.ts` et fait tomber le test si un chemin du menu n'est
 * rangé dans aucune tuile (il disparaîtrait de la barre dès qu'on choisit un
 * logiciel) ou si une tuile nomme un chemin que le menu n'a plus.
 *
 * C'EST UN AFFICHAGE, JAMAIS UN DROIT (« masquer n'est pas refuser », comme
 * `profil-dossier.ts`). La route reste ouverte : une adresse tapée ou collée
 * ouvre sa fenêtre, et le serveur ne refuse rien sur le fondement d'un
 * logiciel. Refuser module par module est le niveau 3, au suivi.
 *
 * UNE TUILE N'EXISTE QUE SI LE DOSSIER LA SERT. On ne recopie aucune règle
 * de référentiel, de module, de profil ou de rôle : une tuile est servie si
 * au moins une de ses commandes figure DANS LE MENU DÉJÀ FILTRÉ par ces
 * règles (`logicielsServis`). Une règle qui change au menu change donc la
 * tuile avec lui, sans second endroit à tenir.
 */
export type CleLogiciel =
  | 'COMPTABILITE'
  | 'TIERS_TRESORERIE'
  | 'IMMOBILISATIONS'
  | 'PAIE'
  | 'REVISION_AUDIT'
  | 'GESTION_COMMERCIALE'
  | 'GROUPE_CONSOLIDATION'
  | 'IFRS'
  | 'ADMINISTRATION';

export interface LogicielDef {
  cle: CleLogiciel;
  libelle: string;
  /** Dans la bulle d'aide de la tuile · jamais en paragraphe à l'écran. */
  aide: string;
  /**
   * Chemins de fenêtre (sans `?query`) que ce logiciel garde dans la barre
   * de menus. Un chemin peut figurer dans plusieurs logiciels : les
   * paramètres du dossier servent la comptabilité comme l'administration.
   */
  chemins: readonly string[];
}

export const LOGICIELS: readonly LogicielDef[] = [
  {
    cle: 'COMPTABILITE',
    libelle: 'Comptabilité',
    aide: 'Saisie des journaux, plan comptable, clôture, livres, états financiers, notes annexes et fiscalité du dossier.',
    chemins: [
      '/tableau-de-bord',
      '/saisie',
      '/od-analytiques',
      '/journal',
      '/brouillard',
      '/comptes',
      '/journaux',
      '/modeles-saisie',
      '/sequences-saisie',
      '/libelles',
      '/taux-tva',
      '/plans-analytiques',
      '/regularisations',
      '/creances-douteuses',
      '/devises',
      '/affectation-resultat',
      '/exercice',
      '/declaration-tva',
      '/registre-donateurs',
      '/engagements',
      '/exonerations',
      '/bailleurs',
      '/conventions-financement',
      '/parametres-dossier',
      '/exports-ecritures',
      '/balance-fonctionnelle',
      '/justificatif-solde',
      '/evolution-soldes',
      '/palmares-journaux',
      '/etats-personnalises',
      '/etats-analytiques',
      '/simulations-budgetaires',
      '/comptabilite-gestion',
      '/etats-financiers',
      '/notes-annexes',
      '/documents-obligatoires',
      '/retenues',
      '/fiscalite',
      '/controles',
    ],
  },
  {
    cle: 'TIERS_TRESORERIE',
    libelle: 'Tiers et trésorerie',
    aide: 'Plan des tiers, lettrage, règlements, banques, remises, effets, rapprochement bancaire, relances et balances des tiers.',
    chemins: [
      '/tiers',
      '/banques',
      '/conditions-bancaires',
      '/taux-reference',
      '/modes-reglement',
      '/modeles-impression',
      '/remises/types',
      '/lettrage',
      '/reglements',
      '/virements-fonds',
      '/remises',
      '/effets',
      '/financements-placements',
      '/rapprochement',
      '/extraits-bancaires',
      '/relances',
      '/balance-agee',
      '/balance-auxiliaire',
      '/echeancier',
    ],
  },
  {
    cle: 'IMMOBILISATIONS',
    libelle: 'Immobilisations',
    aide: 'Registre des biens, acquisitions, amortissements, dépréciations, réévaluation et sorties.',
    chemins: ['/immobilisations'],
  },
  {
    cle: 'PAIE',
    libelle: 'Paie',
    aide: 'Registre du personnel, bulletins, décompte final et passation de la paie au journal.',
    chemins: ['/personnel'],
  },
  {
    cle: 'REVISION_AUDIT',
    libelle: 'Révision et audit',
    aide: 'Analyse et contrôles, concordance des modules, dossier de révision, inventaire physique, circularisation, provisions, questionnaire et faiblesses du contrôle interne.',
    chemins: [
      '/controles',
      '/concordance',
      '/dossier-revision',
      '/inventaire',
      '/circularisation',
      '/provisions',
      '/questionnaire-revision',
      '/faiblesses',
    ],
  },
  {
    cle: 'GESTION_COMMERCIALE',
    libelle: 'Gestion commerciale',
    aide: 'Devis et commandes, facturation, variation des stocks, magasin et emballages consignés.',
    chemins: ['/devis', '/facturation', '/variation-stocks', '/magasin', '/emballages'],
  },
  {
    cle: 'GROUPE_CONSOLIDATION',
    libelle: 'Groupe et consolidation',
    aide: 'Balance agrégée du groupe d’établissements et périmètre de consolidation.',
    chemins: ['/groupe', '/consolidation'],
  },
  {
    cle: 'IFRS',
    libelle: 'IFRS',
    aide: 'États financiers selon les normes IFRS.',
    chemins: ['/ifrs'],
  },
  {
    cle: 'ADMINISTRATION',
    libelle: 'Administration',
    aide: 'Autorisations d’accès, journal d’audit, import, restitution du dossier, paramètres, mandat du contrôleur des comptes et pièces de constitution.',
    chemins: [
      '/utilisateurs',
      '/journal-audit',
      '/import',
      '/restitution',
      '/exports-ecritures',
      '/parametres-dossier',
      '/mandat-auditeur',
      '/accord-cadre',
      '/constitution',
    ],
  },
];

/**
 * CE QUI RESTE AU MENU QUEL QUE SOIT LE LOGICIEL · le courrier sortant et les
 * impressions différées (outils du dossier, ouverts à tous les rôles), la
 * console de l'éditeur (c'est la raison d'être d'un dossier d'opérateur) et
 * l'aide (« ? »). Les commandes sans fenêtre (Mon compte, Fermer le dossier,
 * Imprimer, menu Fenêtre) n'ont pas de chemin et ne se filtrent jamais.
 */
export const CHEMINS_COMMUNS: readonly string[] = ['/courrier', '/impressions-differees', '/plateforme'];
export const PREFIXES_COMMUNS: readonly string[] = ['/aide/'];

/** Le chemin sans sa chaîne de requête · `/journal?onglet=balance` devient `/journal`. */
export function baseDuChemin(chemin: string): string {
  return chemin.split('?')[0];
}

export function estCommun(chemin: string): boolean {
  const base = baseDuChemin(chemin);
  return CHEMINS_COMMUNS.includes(base) || PREFIXES_COMMUNS.some((p) => base.startsWith(p));
}

export function logicielDef(cle: string | null | undefined): LogicielDef | null {
  return LOGICIELS.find((l) => l.cle === cle) ?? null;
}

/**
 * Cette commande reste-t-elle au menu quand `cle` est choisi ? Sans logiciel
 * choisi (`null`, l'écran des tuiles est affiché), seuls les communs restent.
 */
export function cheminDansLogiciel(chemin: string, cle: string | null): boolean {
  if (estCommun(chemin)) return true;
  const def = logicielDef(cle);
  return def ? def.chemins.includes(baseDuChemin(chemin)) : false;
}

/** Tous les chemins qu'un menu porte, groupes compris. */
export function cheminsDuMenu(menus: readonly MenuDef[]): string[] {
  const chemins: string[] = [];
  const voir = (e: MenuEntreeDef) => {
    if (estGroupe(e)) e.items.forEach(voir);
    else if ((e as MenuItemDef).chemin) chemins.push(baseDuChemin((e as MenuItemDef).chemin as string));
  };
  menus.forEach((m) => m.items.forEach(voir));
  return chemins;
}

/**
 * LES TUILES QUE CE DOSSIER SERT À CET UTILISATEUR. `menus` est le menu DÉJÀ
 * filtré par le référentiel, le profil, les modules et le rôle · une tuile
 * est servie si une de ses commandes y figure. `autorisees` vient de
 * l'administrateur du dossier : `null` ou absent = toutes (les utilisateurs
 * existants ne changent pas). Une clé attribuée que la table ne connaît plus
 * ne sert rien.
 */
export function logicielsServis(menus: readonly MenuDef[], autorisees: readonly string[] | null | undefined): LogicielDef[] {
  const presents = new Set(cheminsDuMenu(menus));
  return LOGICIELS.filter(
    (l) => (!autorisees || autorisees.includes(l.cle)) && l.chemins.some((c) => presents.has(c)),
  );
}

/**
 * LES LOGICIELS ATTRIBUÉS QUE LE DOSSIER NE SERT PAS (module éteint,
 * référentiel sans la fonction, aucune cellule) · ils ne donnent aucune tuile,
 * et l'écran doit les NOMMER, sans quoi l'utilisateur lit « aucun logiciel »
 * sans savoir que son administrateur lui en a bien attribué. `servisParLeDossier`
 * est `logicielsServis(menus, null)`.
 */
export function logicielsNonServis(
  servisParLeDossier: readonly LogicielDef[],
  autorisees: readonly string[] | null | undefined,
): LogicielDef[] {
  if (!autorisees) return [];
  return LOGICIELS.filter((l) => autorisees.includes(l.cle) && !servisParLeDossier.some((s) => s.cle === l.cle));
}

/**
 * Restreint la barre de menus au logiciel choisi. Un groupe qui se vide ne
 * s'affiche pas (règle commune de `lignesDuMenu`), et un menu qui n'a plus
 * aucune commande disparaît de la barre plutôt que de s'ouvrir sur du vide.
 */
export function filtrerParLogiciel(menus: MenuDef[], cle: string | null): MenuDef[] {
  const garde = (i: MenuItemDef) => !i.chemin || cheminDansLogiciel(i.chemin, cle);
  return menus
    .map((m) => ({
      ...m,
      items: m.items
        .map((e) => (estGroupe(e) ? { ...e, items: e.items.filter(garde) } : e))
        .filter((e) => (estGroupe(e) ? e.items.length > 0 : garde(e))),
    }))
    .filter((m) => m.items.length > 0);
}

/* ------------------------------------------------------------------------ *
 * PRÉFÉRENCE DU POSTE · jamais une donnée du dossier. Chaque accès au
 * stockage est sous try/catch (fenêtre privée, données bloquées) et la page
 * se rend correctement sans lui : au pire l'écran des tuiles se montre à
 * chaque ouverture.
 * ------------------------------------------------------------------------ */

const cleChoix = (tenantId: string, userId: string) => `omegax.logiciel.${tenantId}.${userId}`;
const cleVu = (tenantId: string, userId: string) => `omegax.logiciel.vu.${tenantId}.${userId}`;

export function lireLogicielChoisi(tenantId: string, userId: string): string | null {
  try {
    return localStorage.getItem(cleChoix(tenantId, userId));
  } catch {
    return null;
  }
}

/** Le choix du poste, et la marque « déjà passé par l'écran des tuiles dans cette session ». */
export function ecrireLogicielChoisi(tenantId: string, userId: string, cle: string): void {
  try {
    localStorage.setItem(cleChoix(tenantId, userId), cle);
  } catch {
    /* préférence perdue · l'écran se remontrera, rien de plus */
  }
  try {
    sessionStorage.setItem(cleVu(tenantId, userId), '1');
  } catch {
    /* idem */
  }
}

export function ecranDejaVuDansLaSession(tenantId: string, userId: string): boolean {
  try {
    return sessionStorage.getItem(cleVu(tenantId, userId)) === '1';
  } catch {
    return false;
  }
}

/**
 * À la fermeture de la session · la connexion suivante, dans le même onglet,
 * montre de nouveau l'écran des tuiles (sessionStorage survit à une
 * déconnexion tant que l'onglet reste ouvert).
 */
export function oublierLEcranVu(): void {
  try {
    const aSupprimer: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('omegax.logiciel.vu.')) aSupprimer.push(k);
    }
    aSupprimer.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* rien à oublier si le stockage est fermé */
  }
}

/**
 * CE QUE LE CHROME DOIT MONTRER. Une fonction pure, pour que la règle
 * s'exécute dans un test au lieu de se relire dans un composant.
 *  - aucune tuile servie       · l'écran, avec son motif (jamais une barre vide muette) ;
 *  - une seule                 · on y entre directement, sans écran ;
 *  - plusieurs, choix valide, écran déjà passé dans la session · le choix ;
 *  - plusieurs sinon           · l'écran.
 * `rappel` : l'utilisateur a demandé à revoir l'écran (bouton du chrome).
 */
export function etatDuChoix(
  servis: readonly LogicielDef[],
  choix: string | null,
  dejaVu: boolean,
  rappel: boolean,
): { logiciel: string | null; ecran: boolean } {
  if (servis.length === 0) return { logiciel: null, ecran: true };
  if (servis.length === 1) return { logiciel: servis[0].cle, ecran: false };
  const valide = servis.some((l) => l.cle === choix) ? choix : null;
  if (rappel || !valide || !dejaVu) return { logiciel: valide, ecran: true };
  return { logiciel: valide, ecran: false };
}
