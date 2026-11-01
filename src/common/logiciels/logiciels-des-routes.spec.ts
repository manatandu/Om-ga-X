import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, normalize, relative } from 'path';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleUtilisateur } from '@prisma/client';
import {
  CONTROLEURS_COMMUNS,
  LOGICIEL_PAR_CONTROLEUR,
  LOGICIEL_PAR_METHODE,
  TOUS,
  logicielsOpposables,
  motifRefusLogiciel,
  porteeDeRoute,
} from './logiciels-des-routes';
import { LIBELLES_LOGICIEL, LOGICIELS, Logiciel } from '../../modules/utilisateurs/logiciels';
import { JwtAuthGuard } from '../../modules/auth/jwt-auth.guard';
import { EcritureController } from '../../modules/comptabilite/ecriture.controller';
import { JournalController } from '../../modules/journaux/journal.controller';
import { PersonnelController } from '../../modules/personnel/personnel.controller';

/**
 * Ligne commercial-site · le refus par le serveur, logiciel par logiciel.
 *
 * Deux relevés tiennent la table. (1) LES CONTRÔLEURS · chaque classe de
 * `src/` est rangée ou déclarée commune, aucune entrée ne vise ce qui n'existe
 * plus. (2) LES ÉCRANS · pour chaque tuile, chaque fenêtre qu'elle garde au
 * menu est suivie dans ses imports, et chacun de ses appels `api.*` à chemin
 * littéral doit être admis à un utilisateur qui n'a QUE cette tuile · sans
 * quoi un écran attribué tomberait sur un 403. Les routes réservées à
 * l'administrateur (jamais restreint) sont écartées du second relevé.
 */

const RACINE = join(__dirname, '..', '..', '..');
const SRC = join(RACINE, 'src');
const CLIENT = join(RACINE, 'client', 'src');

function fichiers(dossier: string, fin: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin, fin);
    return nom.endsWith(fin) ? [chemin] : [];
  });
}

interface Route {
  verbe: string;
  motif: RegExp;
  classe: string;
  methode: string;
  administrateurSeul: boolean;
}

/** Les routes de toutes les classes de contrôleur, lues dans les sources. */
function routesDuServeur(): { routes: Route[]; classes: Map<string, Set<string>> } {
  const routes: Route[] = [];
  const classes = new Map<string, Set<string>>();
  for (const chemin of fichiers(SRC, '.controller.ts')) {
    const source = readFileSync(chemin, 'utf-8');
    for (const bloc of source.split('@Controller(').slice(1)) {
      const prefixe = /^\s*(?:'([^']*)')?/.exec(bloc)?.[1] ?? '';
      const tete = bloc.slice(0, bloc.indexOf('export class'));
      const classe = /export class (\w+)/.exec(bloc)?.[1];
      if (!classe) continue;
      const methodes = new Set<string>();
      classes.set(classe, methodes);
      const classeAdmin = /@Roles\(RoleUtilisateur\.ADMIN_CABINET\)/.test(tete);
      const corps = bloc.slice(bloc.indexOf('export class'));
      // Le décorateur ouvre sa ligne · un `@Post()` cité dans un commentaire n'est pas une route.
      for (const m of corps.matchAll(/\n {2}@(Get|Post|Put|Patch|Delete)\((?:'([^']*)')?\)[\s\S]*?\n {2}(?:async )?(\w+)\(/g)) {
        const debut = Math.max(corps.lastIndexOf('\n  }', m.index ?? 0), 0);
        const decorateurs = corps.slice(debut, (m.index ?? 0) + m[0].length);
        const roles = /@Roles\(([^)]*)\)/.exec(decorateurs)?.[1];
        const administrateurSeul = roles !== undefined ? roles.trim() === 'RoleUtilisateur.ADMIN_CABINET' : classeAdmin;
        const plein = [prefixe, m[2] ?? ''].map((x) => x.replace(/^\/|\/$/g, '')).filter(Boolean).join('/');
        const motif = new RegExp('^/' + plein.replace(/:\w+/g, '[^/]+') + '$');
        routes.push({ verbe: m[1].toUpperCase(), motif, classe, methode: m[3], administrateurSeul });
        methodes.add(m[3]);
      }
    }
  }
  return { routes, classes };
}

const { routes, classes } = routesDuServeur();

describe('la table est fermée · chaque contrôleur est rangé', () => {
  it('le relevé trouve encore des contrôleurs et des routes', () => {
    expect(classes.size).toBeGreaterThan(120);
    expect(routes.length).toBeGreaterThan(800);
    expect(classes.get('EcritureController')?.has('valider')).toBe(true);
  });

  it('aucun contrôleur n’est oublié, aucun n’est rangé deux fois', () => {
    const oublies = [...classes.keys()].filter((c) => !(c in LOGICIEL_PAR_CONTROLEUR) && !(c in CONTROLEURS_COMMUNS));
    expect(oublies).toEqual([]);
    expect(Object.keys(CONTROLEURS_COMMUNS).filter((c) => c in LOGICIEL_PAR_CONTROLEUR)).toEqual([]);
  });

  it('aucune entrée ne vise un contrôleur ou une méthode qui n’existe plus', () => {
    expect(Object.keys(LOGICIEL_PAR_CONTROLEUR).filter((c) => !classes.has(c))).toEqual([]);
    expect(Object.keys(CONTROLEURS_COMMUNS).filter((c) => !classes.has(c))).toEqual([]);
    for (const cle of Object.keys(LOGICIEL_PAR_METHODE)) {
      const [classe, methode] = cle.split('.');
      expect([cle, classes.get(classe)?.has(methode)]).toEqual([cle, true]);
    }
  });

  it('chaque entrée nomme au moins un logiciel connu, et chaque motif commun est écrit', () => {
    for (const [c, p] of Object.entries(LOGICIEL_PAR_CONTROLEUR)) {
      expect([c, p.logiciels.length > 0]).toEqual([c, true]);
      for (const l of [...p.logiciels, ...(p.lecture === TOUS || !p.lecture ? [] : p.lecture)]) expect(LOGICIELS).toContain(l);
    }
    for (const [c, motif] of Object.entries(CONTROLEURS_COMMUNS)) expect([c, motif.length > 20]).toEqual([c, true]);
  });

  it('les noms cités par le refus sont ceux des tuiles du client', () => {
    const client = readFileSync(join(CLIENT, 'lib', 'logiciels.ts'), 'utf-8');
    for (const l of LOGICIELS) {
      expect([l, new RegExp(`cle: '${l}',\\s*libelle: '([^']+)'`).exec(client)?.[1]]).toEqual([l, LIBELLES_LOGICIEL[l]]);
    }
  });
});

describe('la règle', () => {
  const paie = { role: RoleUtilisateur.COMPTABLE, restreindreLogiciels: true, logicielsAutorises: ['PAIE'] };

  it('refuse lecture ET écriture d’un logiciel non attribué, en le nommant', () => {
    expect(motifRefusLogiciel(paie, 'GET', porteeDeRoute('FacturationController', 'lister'))).toMatch(/« Gestion commerciale ».*ne vous est pas attribué/);
    expect(motifRefusLogiciel(paie, 'POST', porteeDeRoute('EcritureController', 'creer'))).toMatch(/« Comptabilité »/);
    expect(motifRefusLogiciel(paie, 'GET', porteeDeRoute('EcritureController', 'lister'))).not.toBeNull();
  });

  it('laisse ce que le logiciel attribué lit d’un autre, jamais ce qu’il y écrit', () => {
    expect(motifRefusLogiciel(paie, 'GET', porteeDeRoute('JournalController', 'lister'))).toBeNull();
    expect(motifRefusLogiciel(paie, 'POST', porteeDeRoute('JournalController', 'creer'))).toMatch(/Comptabilité/);
    expect(motifRefusLogiciel(paie, 'HEAD', porteeDeRoute('CompteController', 'lister'))).toBeNull();
  });

  it('laisse le commun et le logiciel attribué', () => {
    expect(motifRefusLogiciel(paie, 'POST', porteeDeRoute('AuthController', 'changerMotDePasse'))).toBeNull();
    expect(motifRefusLogiciel(paie, 'POST', porteeDeRoute('PersonnelController', 'x'))).toBeNull();
    // L'accueil de toute tuile lit la synthèse (compteurs) ; le rapport complet porte comptes, tiers et montants.
    expect(motifRefusLogiciel(paie, 'GET', porteeDeRoute('ControlesController', 'synthese'))).toBeNull();
    expect(motifRefusLogiciel(paie, 'GET', porteeDeRoute('ControlesController', 'analyser'))).toMatch(/Comptabilité.*Révision et audit/);
  });

  it('nomme plusieurs logiciels au pluriel', () => {
    expect(motifRefusLogiciel(paie, 'GET', porteeDeRoute('ControlesController', 'lister'))).toMatch(
      /des logiciels « Comptabilité » ou « Révision et audit », qui ne vous sont pas attribués/,
    );
  });

  it('refuse un contrôleur que la table ne connaît pas', () => {
    expect(motifRefusLogiciel(paie, 'GET', porteeDeRoute('InconnuController', 'lire'))).toMatch(/aucun logiciel/);
  });

  it('ne restreint ni l’utilisateur sans attribution, ni l’administrateur, ni le gestionnaire de paie', () => {
    const porte = porteeDeRoute('FacturationController', 'lister');
    expect(motifRefusLogiciel({ ...paie, restreindreLogiciels: false }, 'GET', porte)).toBeNull();
    expect(motifRefusLogiciel({ ...paie, role: RoleUtilisateur.ADMIN_CABINET }, 'GET', porte)).toBeNull();
    expect(motifRefusLogiciel({ ...paie, role: RoleUtilisateur.GESTIONNAIRE_PAIE }, 'GET', porte)).toBeNull();
    expect(logicielsOpposables({ role: RoleUtilisateur.COMPTABLE })).toBeNull();
  });

  it('une clé retirée n’ouvre rien · une attribution morte refuse tout ce qui n’est pas commun', () => {
    const mort = { ...paie, logicielsAutorises: ['PIRATE'] };
    expect(logicielsOpposables(mort)).toEqual([]);
    expect(motifRefusLogiciel(mort, 'POST', porteeDeRoute('PersonnelController', 'x'))).not.toBeNull();
    expect(motifRefusLogiciel(mort, 'GET', porteeDeRoute('MessagerieController', 'recus'))).toBeNull();
  });
});

describe('JwtAuthGuard applique le refus', () => {
  const garde = new JwtAuthGuard(new Reflector());
  const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as { canActivate: () => Promise<boolean> };
  const contexte = (user: unknown, methode: string, handler: object, classe: object) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user, method: methode }), getResponse: () => ({}) }),
      getHandler: () => handler,
      getClass: () => classe,
    }) as unknown as ExecutionContext;
  beforeEach(() => jest.spyOn(parent, 'canActivate').mockResolvedValue(true));
  afterEach(() => jest.restoreAllMocks());

  const paie = { role: RoleUtilisateur.COMPTABLE, restreindreLogiciels: true, logicielsAutorises: ['PAIE'] };
  const unHandler = (classe: { prototype: object }) =>
    (classe.prototype as Record<string, object>)[Object.getOwnPropertyNames(classe.prototype).find((m) => m !== 'constructor') as string];

  it('refuse au logiciel de paie la lecture du journal des écritures, en 403 nommé', async () => {
    await expect(garde.canActivate(contexte(paie, 'GET', unHandler(EcritureController), EcritureController))).rejects.toThrow(
      /« Comptabilité ».*ne vous est pas attribué/,
    );
  });

  it('laisse la paie, et la liste des journaux qu’elle lit', async () => {
    await expect(garde.canActivate(contexte(paie, 'GET', unHandler(PersonnelController), PersonnelController))).resolves.toBe(true);
    await expect(garde.canActivate(contexte(paie, 'GET', JournalController.prototype.lister, JournalController))).resolves.toBe(true);
  });

  it('l’administrateur passe partout', async () => {
    const admin = { ...paie, role: RoleUtilisateur.ADMIN_CABINET };
    await expect(garde.canActivate(contexte(admin, 'POST', EcritureController.prototype.creer, EcritureController))).resolves.toBe(true);
  });
});

/* ------------------------------------------------------------------------ *
 * LES ÉCRANS DE CHAQUE TUILE N'APPELLENT QUE CE QUI LEUR EST OUVERT.
 * ------------------------------------------------------------------------ */

function resoudre(depuis: string, imp: string): string | null {
  const base = normalize(join(dirname(depuis), imp));
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) if (existsSync(base + ext)) return base + ext;
  return null;
}
const importsDe = new Map<string, string[]>();
function imports(f: string): string[] {
  if (!importsDe.has(f)) {
    const s = readFileSync(f, 'utf-8');
    const sortie: string[] = [];
    for (const m of s.matchAll(/(?:import|from)\s*\(?\s*'(\.[^']+)'/g)) {
      const r = resoudre(f, m[1]);
      if (r && !/\.spec\.tsx?$/.test(r)) sortie.push(r);
    }
    importsDe.set(f, sortie);
  }
  return importsDe.get(f) as string[];
}
function fermeture(depart: string, exclus: Set<string>): Set<string> {
  const vus = new Set<string>();
  const pile = [depart];
  while (pile.length) {
    const x = pile.pop() as string;
    if (vus.has(x) || exclus.has(x)) continue;
    vus.add(x);
    pile.push(...imports(x));
  }
  return vus;
}

const APPEL =
  /(?:api)?\s*\.(get|post|put|patch|delete|telecharger|telechargerOuSignaler|envoyerFichier)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\(\s*([`'"])(\/[^`'"]*)\2/g;
function appels(f: string): { verbe: string; url: string }[] {
  const s = readFileSync(f, 'utf-8');
  return [...s.matchAll(APPEL)].map((m) => ({
    verbe: ['get', 'telecharger', 'telechargerOuSignaler'].includes(m[1]) ? 'GET' : m[1] === 'envoyerFichier' ? 'POST' : m[1].toUpperCase(),
    url: m[3],
  }));
}
function routesAppelees(verbe: string, url: string): Route[] {
  let u = url.replace(/(?<=\/)\$\{[^}]*\}/g, 'X');
  u = u.replace(/\$\{[^}]*\}/g, '').split('?')[0].replace(/\/$/, '') || '/';
  return routes.filter((r) => r.verbe === verbe && r.motif.test(u));
}

const registre = readFileSync(join(CLIENT, 'lib', 'registre-fenetres.tsx'), 'utf-8');
const paresseux = new Map([...registre.matchAll(/const (\w+) = lazy\(\(\) =>\s*import\('([^']+)'\)/g)].map((m) => [m[1], m[2]]));
const entrees = [...registre.matchAll(/motif: \/(.+?)\/,[\s\S]*?rendre: [^\n]*?<(\w+)/g)].map((m) => ({ motif: new RegExp(m[1]), composant: m[2] }));
const pagesParesseuses = new Set([...paresseux.values()].map((p) => resoudre(join(CLIENT, 'lib', 'x'), p) as string));

function pageDe(chemin: string): string | null {
  const entree = entrees.find((e) => e.motif.test(chemin));
  const imp = entree ? paresseux.get(entree.composant) : undefined;
  return imp ? resoudre(join(CLIENT, 'lib', 'x'), imp) : null;
}

const clientLogiciels = readFileSync(join(CLIENT, 'lib', 'logiciels.ts'), 'utf-8');
const cheminsParLogiciel = new Map<string, string[]>(
  [...clientLogiciels.matchAll(/cle: '(\w+)',[\s\S]*?chemins: \[([\s\S]*?)\]/g)].map((m) => [m[1], [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])]),
);
const cheminsCommuns = [...(/CHEMINS_COMMUNS: readonly string\[\] = \[([^\]]*)\]/.exec(clientLogiciels)?.[1] ?? '').matchAll(/'([^']+)'/g)]
  .map((m) => m[1])
  .filter((c) => c !== '/plateforme');

/*
 * LES ADRESSES CALCULÉES · un appel dont le chemin vient d'une variable
 * (`api.telecharger(chemin)`, `api.post(p.chemin)`, `${base}/bilan`, une
 * fonction qui compose l'adresse) échappe au relevé des appels littéraux.
 * LISTE FERMÉE, chaque fichier avec son motif · on y relève TOUT littéral de
 * chemin (`const base = '…'` substitué), et chacun est éprouvé sous chaque
 * verbe qu'une route du serveur porte à cette adresse. Un fichier nouveau qui
 * compose ses adresses s'ajoute ici.
 */
const ADRESSES_CALCULEES: Record<string, string> = {
  'lib/regle-par.ts': 'contreparties admises d’une acquisition, composées par contrepartiesAdmises (ChampReglePar)',
  'lib/export-livres.ts': 'adresses des exports du journal, des balances et des grands livres, passées à api.telecharger(chemin) de JournalPage',
  'pages/JournalPage.tsx': 'lancerExport(chemin) · le chemin vient de lib/export-livres.ts ou d’un littéral du fichier',
  'pages/EtatsSmtSyscohadaPage.tsx': '`${base}/bilan`, base littérale du fichier',
  'pages/FinancementsPlacementsPage.tsx': 'api.post(p.chemin) · les chemins d’annulation sont des littéraux du fichier ou de TitresPlacementSection',
  'components/TitresPlacementSection.tsx': 'chemins d’annulation des titres, passés à ModaleMotif',
  'pages/RemisesPage.tsx': 'api.post(p.chemin) · chemins d’annulation littéraux du fichier',
  'pages/EffetsPage.tsx': 'api.post(p.chemin) · chemins d’annulation littéraux du fichier',
  'pages/CreancesDouteusesPage.tsx': 'api.post(chemin) et api.delete(chemin) · chemins littéraux du fichier',
  'pages/DevisesPage.tsx': 'api.post(chemin) et api.delete(chemin) · chemins littéraux du fichier',
};

/** Les pièces jointes · l'objet rendu dit les adresses (lib/pieces-jointes.ts, ADRESSES_PIECES). */
const piecesSource = readFileSync(join(CLIENT, 'lib', 'pieces-jointes.ts'), 'utf-8');
const ADRESSES_PAR_OBJET = new Map(
  [...piecesSource.matchAll(/(ECRITURE|SECTION|IMMOBILISATION|SALARIE): \{\s*liste: \(id\) => `([^`]+)`,\s*piece: \(id\) => `([^`]+)`/g)].map((m) => [
    m[1],
    [m[2], m[3], `${m[3]}/fichier`],
  ]),
);
/** Les composants de PiecesJointes.tsx qui n'agissent que sur les pièces d'écriture. */
const COMPOSANTS_ECRITURE = /\b(ModalePiecesEcriture|ModalePiecesDetachees|BoutonPiecesEcriture)\b/;

const VERBES = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
function adressesCalculees(f: string): { verbe: string; url: string }[] {
  const rel = relative(CLIENT, f);
  const sortie: { verbe: string; url: string }[] = [];
  const source = readFileSync(f, 'utf-8');
  const eprouver = (url: string) => VERBES.forEach((verbe) => sortie.push({ verbe, url }));
  if (rel in ADRESSES_CALCULEES) {
    const base = /const base = '([^']+)'/.exec(source)?.[1];
    for (const m of source.matchAll(/[`'"](\/[a-z][^`'"\s]*|\$\{base\}[^`'"\s]*)[`'"]/g)) {
      eprouver(base ? m[1].replace('${base}', base) : m[1]);
    }
  }
  if (rel !== 'components/PiecesJointes.tsx' && rel !== 'lib/pieces-jointes.ts') {
    for (const m of source.matchAll(/objet="(ECRITURE|SECTION|IMMOBILISATION|SALARIE)"/g)) (ADRESSES_PAR_OBJET.get(m[1]) ?? []).forEach(eprouver);
    if (/from '[./]+components\/PiecesJointes'|from '\.\/PiecesJointes'/.test(source) && COMPOSANTS_ECRITURE.test(source)) {
      (ADRESSES_PAR_OBJET.get('ECRITURE') ?? []).forEach(eprouver);
    }
  }
  return sortie;
}

function refusesPour(logiciel: Logiciel, fichiersLus: Iterable<string>): string[] {
  const utilisateur = { role: RoleUtilisateur.COMPTABLE, restreindreLogiciels: true, logicielsAutorises: [logiciel] };
  const refus = new Set<string>();
  for (const f of fichiersLus) {
    for (const { verbe, url } of [...appels(f), ...adressesCalculees(f)]) {
      for (const r of routesAppelees(verbe, url)) {
        if (r.administrateurSeul) continue;
        if (motifRefusLogiciel(utilisateur, verbe, porteeDeRoute(r.classe, r.methode))) {
          refus.add(`${verbe} ${url} → ${r.classe}.${r.methode} (${relative(CLIENT, f)})`);
        }
      }
    }
  }
  return [...refus].sort();
}

describe('les écrans d’une tuile ne tombent pas sur un refus', () => {
  it('le relevé lit encore les tuiles, les fenêtres et des appels', () => {
    expect(cheminsParLogiciel.size).toBe(LOGICIELS.length);
    expect(entrees.length).toBeGreaterThan(80);
    expect(cheminsCommuns).toEqual(expect.arrayContaining(['/courrier', '/messages']));
    const saisie = pageDe('/saisie') as string;
    expect(appels(saisie).length).toBeGreaterThan(5);
  });

  it('la liste des adresses calculées vise des fichiers qui existent, et les pièces se lisent par objet', () => {
    for (const f of Object.keys(ADRESSES_CALCULEES)) expect([f, existsSync(join(CLIENT, f))]).toEqual([f, true]);
    expect([...ADRESSES_PAR_OBJET.keys()].sort()).toEqual(['ECRITURE', 'IMMOBILISATION', 'SALARIE', 'SECTION']);
    // Le relevé trouve bien des adresses calculées (un relevé vide ne prouverait rien).
    expect(adressesCalculees(join(CLIENT, 'pages', 'EtatsSmtSyscohadaPage.tsx')).some((a) => a.url.startsWith('/etats-financiers-syscohada/smt/bilan'))).toBe(true);
    expect(adressesCalculees(join(CLIENT, 'pages', 'PersonnelPage.tsx')).some((a) => a.url.startsWith('/personnel/salaries/'))).toBe(true);
  });

  it.each(LOGICIELS.map((l) => [l]))('%s · chaque fenêtre gardée au menu et ses imports', (logiciel) => {
    const lus = new Set<string>();
    for (const chemin of cheminsParLogiciel.get(logiciel) ?? []) {
      const page = pageDe(chemin);
      expect([chemin, page !== null]).toEqual([chemin, true]);
      for (const f of fermeture(page as string, new Set())) lus.add(f);
    }
    expect(refusesPour(logiciel as Logiciel, lus)).toEqual([]);
  });

  it.each(LOGICIELS.map((l) => [l]))('%s · le chrome et les fenêtres communes', (logiciel) => {
    const lus = new Set<string>();
    for (const depart of [join(CLIENT, 'App.tsx'), join(CLIENT, 'components', 'chrome', 'AppShell.tsx')]) {
      for (const f of fermeture(depart, pagesParesseuses)) lus.add(f);
    }
    for (const chemin of [...cheminsCommuns, '/aide/x']) {
      const page = pageDe(chemin);
      if (page) for (const f of fermeture(page, new Set())) lus.add(f);
    }
    expect(refusesPour(logiciel as Logiciel, lus)).toEqual([]);
  });
});
