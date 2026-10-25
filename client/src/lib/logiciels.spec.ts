import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MenuDef } from '../components/chrome/menu-groupes';
import { cheminAuMenu } from './profil-dossier';
import {
  LOGICIELS,
  baseDuChemin,
  cheminDansLogiciel,
  cheminsDuMenu,
  estCommun,
  etatDuChoix,
  filtrerParLogiciel,
  logicielsServis,
} from './logiciels';

// Aucun import de « vitest » · convention du dépôt.

/**
 * LES LOGICIELS (TUILES) · la table est CONFRONTÉE AU MENU RÉEL, jamais
 * recopiée à la main hors d'une table unique. Ce qui casserait en silence :
 * une commande du menu rangée dans aucune tuile (elle disparaîtrait dès qu'on
 * choisit un logiciel), une tuile qui nomme une commande que le menu n'a plus,
 * une tuile servie à un dossier qui n'a aucune de ses fonctions, une clé du
 * client qui diverge de celle du serveur.
 */
const src = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');
const cheminsDe = (source: string) =>
  [...source.matchAll(/chemin: '([^']+)'/g)].map((m) => baseDuChemin(m[1]));

const MENU_REEL = [...new Set(cheminsDe(src('../components/chrome/AppShell.tsx')))].filter((c) => !estCommun(c));
const TOUS_LES_CHEMINS_DE_LA_TABLE = [...new Set(LOGICIELS.flatMap((l) => [...l.chemins]))];

/** Un menu à plat construit sur les chemins réels, passé par le même filtre que l'AppShell. */
function menuDuDossier(t: Parameters<typeof cheminAuMenu>[1]): MenuDef[] {
  return [
    {
      titre: 'Tout',
      items: MENU_REEL.filter((c) => cheminAuMenu(c, t)).map((chemin) => ({ label: chemin, chemin })),
    },
  ];
}

describe('la table des logiciels contre le menu réel', () => {
  it('lit bien des chemins dans le menu (une lecture vide ne prouverait rien)', () => {
    expect(MENU_REEL.length).toBeGreaterThan(70);
  });

  it('chaque commande du menu est rangée dans au moins un logiciel', () => {
    const orphelins = MENU_REEL.filter((c) => !TOUS_LES_CHEMINS_DE_LA_TABLE.includes(c));
    expect(orphelins).toEqual([]);
  });

  it('chaque chemin de la table existe encore au menu (aucune tuile ne garde une commande disparue)', () => {
    const auMenu = new Set(MENU_REEL);
    const disparus = TOUS_LES_CHEMINS_DE_LA_TABLE.filter((c) => !auMenu.has(c));
    expect(disparus).toEqual([]);
  });

  it("les raccourcis de l'accueil et des tâches par métier sont rangés eux aussi", () => {
    const raccourcis = new Set([
      ...cheminsDe(src('../pages/AccueilPage.tsx')),
      ...cheminsDe(src('./accueil-par-metier.ts')),
    ]);
    const orphelins = [...raccourcis].filter((c) => !estCommun(c) && !TOUS_LES_CHEMINS_DE_LA_TABLE.includes(c));
    expect(orphelins).toEqual([]);
  });

  it('chaque logiciel a une clé unique, un libellé, une aide et au moins un chemin sans chaîne de requête', () => {
    expect(new Set(LOGICIELS.map((l) => l.cle)).size).toBe(LOGICIELS.length);
    for (const l of LOGICIELS) {
      expect(l.libelle.length).toBeGreaterThan(2);
      expect(l.aide.length).toBeGreaterThan(10);
      expect(l.chemins.length).toBeGreaterThan(0);
      for (const c of l.chemins) expect([l.cle, c.includes('?')]).toEqual([l.cle, false]);
    }
  });

  it('les neuf tuiles demandées, et seulement elles', () => {
    expect(LOGICIELS.map((l) => l.libelle)).toEqual([
      'Comptabilité',
      'Tiers et trésorerie',
      'Immobilisations',
      'Paie',
      'Révision et audit',
      'Gestion commerciale',
      'Groupe et consolidation',
      'IFRS',
      'Administration',
    ]);
  });

  it('les clés du client sont celles du serveur, dans le même ordre', () => {
    const serveur = readFileSync(join(__dirname, '../../../src/modules/utilisateurs/logiciels.ts'), 'utf8');
    const bloc = serveur.slice(serveur.indexOf('export const LOGICIELS = ['), serveur.indexOf('] as const;'));
    const cles = [...bloc.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect(LOGICIELS.map((l) => l.cle)).toEqual(cles);
  });
});

describe("une tuile n'est servie que si le dossier a l'une de ses fonctions", () => {
  it('un dossier complet sert toutes les tuiles', () => {
    expect(logicielsServis(menuDuDossier(undefined), null).map((l) => l.cle)).toEqual(LOGICIELS.map((l) => l.cle));
  });

  it('un menu sans /ifrs ne sert pas la tuile IFRS, quelle que soit l’attribution', () => {
    const menu: MenuDef[] = [{ titre: 'X', items: [{ label: 'a', chemin: '/saisie' }] }];
    expect(logicielsServis(menu, null).map((l) => l.cle)).toEqual(['COMPTABILITE']);
    expect(logicielsServis(menu, ['IFRS']).map((l) => l.cle)).toEqual([]);
  });

  it('le Système minimal de trésorerie ne voit ni IFRS ni révision', () => {
    const smt = { referentiel: 'SYSCOHADA' as const, systemeComptableSyscohada: 'MINIMAL_TRESORERIE' as const };
    const cles = logicielsServis(menuDuDossier(smt), null).map((l) => l.cle);
    expect(cles).not.toContain('IFRS');
    expect(cles).toContain('COMPTABILITE');
    // Le contrôle et la révision gardent /controles, commun à la comptabilité · la tuile
    // de révision tient encore par /inventaire (inventaire physique, ouvert aux deux systèmes).
    expect(cles).toContain('REVISION_AUDIT');
  });

  it("un module non activé retire sa tuile (paie, gestion commerciale, consolidation, IFRS)", () => {
    const t = { referentiel: 'SYSCOHADA' as const, modulesActives: [] };
    // /groupe ne dépend pas d'un module (il suit les cellules du dossier) · il est écarté ici
    // pour ne juger que la consolidation, que le module CONSOLIDATION commande.
    const sansGroupe = menuDuDossier(t).map((m) => ({ ...m, items: m.items.filter((i) => !('chemin' in i) || i.chemin !== '/groupe') }));
    const cles = logicielsServis(sansGroupe, null).map((l) => l.cle);
    expect(cles).not.toContain('PAIE');
    expect(cles).not.toContain('IFRS');
    expect(cles).not.toContain('GROUPE_CONSOLIDATION');
    // La facturation reste (la loi l'impose à tous), la tuile de gestion commerciale aussi.
    expect(cles).toContain('GESTION_COMMERCIALE');
  });

  it('un module activé rend sa tuile', () => {
    const t = { referentiel: 'SYSCOHADA' as const, modulesActives: ['PAIE' as const, 'IFRS' as const, 'CONSOLIDATION' as const] };
    const cles = logicielsServis(menuDuDossier(t), null).map((l) => l.cle);
    expect(cles).toEqual(expect.arrayContaining(['PAIE', 'IFRS', 'GROUPE_CONSOLIDATION']));
  });

  it("l'attribution null ou absente = toutes les tuiles servies ; une liste ne retire que des tuiles", () => {
    const menu = menuDuDossier(undefined);
    const toutes = logicielsServis(menu, null).map((l) => l.cle);
    expect(logicielsServis(menu, undefined).map((l) => l.cle)).toEqual(toutes);
    expect(logicielsServis(menu, ['PAIE', 'IFRS']).map((l) => l.cle)).toEqual(['PAIE', 'IFRS']);
    // Une liste vide est une attribution (aucune tuile), pas « toutes ».
    expect(logicielsServis(menu, [])).toEqual([]);
    // Une clé que la table ne connaît pas n'ouvre rien.
    expect(logicielsServis(menu, ['INCONNUE'])).toEqual([]);
  });

  it('le menu du serveur fait foi : la tuile Groupe suit la présence de /groupe, qui dépend des cellules', () => {
    const source = src('../components/chrome/AppShell.tsx');
    expect(source).toContain("(utilisateur?.tenant.nombreCellules ?? 0) > 0 || (estAdmin && utilisateur?.tenant.peutCreerCellules)");
    const sansGroupe: MenuDef[] = [{ titre: 'X', items: [{ label: 'a', chemin: '/consolidation' }] }];
    expect(logicielsServis(sansGroupe, null).map((l) => l.cle)).toEqual(['GROUPE_CONSOLIDATION']);
    expect(logicielsServis([{ titre: 'X', items: [{ label: 'a', chemin: '/saisie' }] }], null).map((l) => l.cle)).not.toContain(
      'GROUPE_CONSOLIDATION',
    );
  });
});

describe('choisir un logiciel restreint la barre de menus', () => {
  const menus: MenuDef[] = [
    { titre: 'Fichier', items: [{ label: 'Mon compte' }, { label: 'Courriers', chemin: '/courrier' }, { label: 'Journal d’audit', chemin: '/journal-audit' }] },
    {
      titre: 'Traitement',
      items: [
        { label: 'Saisie', chemin: '/saisie' },
        { titre: 'Tiers', items: [{ label: 'Lettrage', chemin: '/lettrage' }] },
        { titre: 'Paie', items: [{ label: 'Paie du mois', chemin: '/personnel?onglet=bulletins' }] },
      ],
    },
    { titre: 'Fenêtre', items: [{ label: 'Réorganiser' }] },
    { titre: '?', items: [{ label: 'Aide', chemin: '/aide/contrat-de-licence' }] },
  ];

  it('ne garde que les commandes du logiciel, les communs et celles sans fenêtre', () => {
    const compta = filtrerParLogiciel(menus, 'COMPTABILITE');
    expect(cheminsDuMenu(compta).sort()).toEqual(['/aide/contrat-de-licence', '/courrier', '/saisie']);
    expect(compta.find((m) => m.titre === 'Fichier')?.items.map((i) => ('label' in i ? i.label : i.titre))).toEqual(['Mon compte', 'Courriers']);
    expect(compta.map((m) => m.titre)).toContain('Fenêtre');
  });

  it('un groupe qui se vide et un menu qui se vide disparaissent', () => {
    const paie = filtrerParLogiciel(menus, 'PAIE');
    const traitement = paie.find((m) => m.titre === 'Traitement');
    expect(traitement?.items.map((i) => ('titre' in i ? i.titre : i.label))).toEqual(['Paie']);
    // Sans logiciel choisi (l'écran est ouvert), seuls restent les communs et les commandes sans fenêtre.
    const aucun = filtrerParLogiciel(menus, null);
    expect(aucun.map((m) => m.titre)).toEqual(['Fichier', 'Fenêtre', '?']);
  });

  it("l'administration porte le journal d'audit, pas la comptabilité", () => {
    expect(cheminDansLogiciel('/journal-audit', 'ADMINISTRATION')).toBe(true);
    expect(cheminDansLogiciel('/journal-audit', 'COMPTABILITE')).toBe(false);
    expect(cheminDansLogiciel('/journal?onglet=balance', 'COMPTABILITE')).toBe(true);
  });
});

describe("l'écran des tuiles : quand il se montre", () => {
  const deux = LOGICIELS.filter((l) => ['COMPTABILITE', 'PAIE'].includes(l.cle));

  it('aucune tuile servie : l’écran, qui le dit', () => {
    expect(etatDuChoix([], null, true, false)).toEqual({ logiciel: null, ecran: true });
  });

  it('une seule tuile : on y entre directement, sans écran', () => {
    expect(etatDuChoix([deux[1]], null, false, false)).toEqual({ logiciel: 'PAIE', ecran: false });
  });

  it('plusieurs tuiles, première connexion de la session : l’écran', () => {
    expect(etatDuChoix(deux, 'PAIE', false, false)).toEqual({ logiciel: 'PAIE', ecran: true });
    expect(etatDuChoix(deux, null, false, false)).toEqual({ logiciel: null, ecran: true });
  });

  it('un choix déjà fait dans la session est gardé ; le rappel rouvre l’écran', () => {
    expect(etatDuChoix(deux, 'PAIE', true, false)).toEqual({ logiciel: 'PAIE', ecran: false });
    expect(etatDuChoix(deux, 'PAIE', true, true)).toEqual({ logiciel: 'PAIE', ecran: true });
  });

  it("un choix mémorisé que l'attribution a retiré n'est pas suivi", () => {
    expect(etatDuChoix(deux, 'IFRS', true, false)).toEqual({ logiciel: null, ecran: true });
  });
});

describe('le chrome (lecture de la source)', () => {
  const shell = src('../components/chrome/AppShell.tsx');

  it('le filtre des logiciels se pose APRÈS celui du profil, jamais à sa place', () => {
    expect(shell.indexOf('filtrerParProfil(menusComplets')).toBeLessThan(shell.indexOf('filtrerParLogiciel(menusDuProfil'));
    expect(shell).toContain('logicielsServis(menusDuProfil, utilisateur?.logicielsAutorises)');
  });

  it("le gestionnaire de paie, qui a son menu, ne suit pas les logiciels", () => {
    expect(shell).toContain("const suitLesLogiciels = utilisateur?.role !== 'GESTIONNAIRE_PAIE';");
  });

  it("le bouton « Logiciels » n'est offert que s'il y a plusieurs tuiles à choisir", () => {
    expect(shell).toContain('const peutChoisirUnLogiciel = suitLesLogiciels && logicielsDuDossier.length > 1;');
    expect(shell).toContain('onLogiciels={peutChoisirUnLogiciel ?');
  });

  it("l'écran se pose sur l'espace de travail sans démonter les fenêtres", () => {
    const main = shell.slice(shell.indexOf('<main'), shell.indexOf('</main>'));
    expect(main).toContain('fenetres.map((f)');
    expect(main.indexOf('fenetres.map((f)')).toBeLessThan(main.indexOf('<EcranLogiciels'));
  });

  it("la préférence est celle du poste, sous try/catch, jamais envoyée au serveur", () => {
    const lib = src('./logiciels.ts');
    expect(lib).toContain('localStorage.getItem');
    expect(lib.match(/try \{/g)?.length).toBeGreaterThanOrEqual(5);
    expect(lib).not.toMatch(/api\.(put|post|patch)/);
  });
});
