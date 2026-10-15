import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QUESTIONS_FREQUENTES } from '../lib/questions-frequentes';
import { mentionsAArreter, texteBrutDesConditions } from '../../../src/modules/conditions-licence/conditions-de-licence';

// Aucun import de « vitest » (globales) · convention du dépôt, le spec tourne
// aussi sous le jest de la racine.

/**
 * LES PAGES LÉGALES ET L'AIDE (ligne pages-legales, demande de Manasse du
 * 2026-10-15) · questions fréquentes, contrat de licence, politique de
 * confidentialité. Ce qui casserait en silence · une page publique passée
 * derrière le mot de passe, un lien d'ouverture perdu, une réponse de la FAQ
 * qui dirait un délai que le code ne tient plus, une promesse « bientôt ».
 */

const RACINE = join(__dirname, '..', '..');
const lire = (p: string) => readFileSync(join(RACINE, p), 'utf8');
const serveur = (p: string) => readFileSync(join(RACINE, '..', p), 'utf8');
const constante = (source: string, nom: string) => new RegExp(`export const ${nom} = ([^;\\n]+)`).exec(source)?.[1] ?? '';

const reponses = QUESTIONS_FREQUENTES.flatMap((r) => r.questions);
const reponse = (id: string) => (reponses.find((q) => q.id === id)?.reponse ?? []).join(' ');

describe('les pages publiques se lisent sans session', () => {
  it('leurs routes sont hors de la zone protégée', () => {
    const app = lire('src/App.tsx');
    const zone = app.indexOf('<ZoneProtegee>');
    for (const chemin of ['/confidentialite', '/contrat-de-licence', '/questions-frequentes']) {
      const i = app.indexOf(`path="${chemin}"`);
      expect([chemin, i > 0 && i < zone]).toEqual([chemin, true]);
    }
  });

  it('l’écran d’ouverture y renvoie, toutes les trois', () => {
    const auth = lire('src/pages/AuthPage.tsx');
    for (const lien of ['#/questions-frequentes', '#/contrat-de-licence', '#/confidentialite']) expect(auth).toContain(`href="${lien}"`);
  });

  it('le cadre public ramène à l’ouverture et permet d’imprimer (Code du numérique, art. 53, al. 1er)', () => {
    const cadre = lire('src/components/CadrePagePublique.tsx');
    expect(cadre).toContain('href="#/connexion"');
    expect(cadre).toContain('onClick={() => window.print()}');
  });
});

describe('le menu « ? » ouvre les trois pages en fenêtre, et À propos', () => {
  const shell = lire('src/components/chrome/AppShell.tsx');
  const registre = lire('src/lib/registre-fenetres.tsx');
  const fenetres = [
    { chemin: '/aide/questions-frequentes', titre: 'Questions fréquentes' },
    { chemin: '/aide/contrat-de-licence', titre: 'Contrat de licence' },
    { chemin: '/aide/confidentialite', titre: 'Politique de confidentialité' },
  ];

  it('chaque commande porte son chemin, que le balayage des tests navigateur lit', () => {
    for (const f of fenetres) expect(shell).toContain(`{ label: '${f.titre}', chemin: '${f.chemin}'`);
    const menu = shell.slice(shell.indexOf("titre: '?'"));
    expect(menu.indexOf('Questions fréquentes')).toBeLessThan(menu.indexOf('À propos d’OmegaX'));
  });

  it('chaque chemin est une fenêtre du registre, au titre de sa commande', () => {
    for (const f of fenetres) {
      const motif = `motif: /^${f.chemin.replace(/\//g, '\\/')}$/,\n    titre: '${f.titre}'`;
      expect([f.chemin, registre.includes(motif)]).toEqual([f.chemin, true]);
    }
  });
});

describe('la foire aux questions dit ce que le code fait', () => {
  it('chaque question a une ancre unique, chaque rubrique aussi', () => {
    const ids = reponses.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rubriques = QUESTIONS_FREQUENTES.map((r) => r.id);
    expect(new Set(rubriques).size).toBe(rubriques.length);
    expect(reponses.length).toBeGreaterThan(25);
  });

  it('l’essai et le délai de paiement sont ceux du moteur de facturation', () => {
    const f = serveur('src/modules/plateforme/abonnements/facturation-abonnements.ts');
    expect(constante(f, 'JOURS_ESSAI')).toBe('30');
    expect(constante(f, 'DELAI_PAIEMENT_JOURS')).toBe('15');
    expect(reponse('q-essai')).toContain('Trente jours, gratuits.');
    expect(reponse('q-echeance')).toContain('quinze jours après la fin de l’essai');
  });

  it('le verrou de connexion est celui de verrouillage.ts', () => {
    const v = serveur('src/modules/auth/verrouillage.ts');
    expect(constante(v, 'SEUIL_VERROUILLAGE')).toBe('5');
    expect(constante(v, 'PALIERS_VERROU_MINUTES')).toBe('[1, 5, 15, 30, 60] as const');
    expect(constante(v, 'DELAI_OUBLI_ECHECS_HEURES')).toBe('12');
    expect(reponse('q-verrou')).toContain('Après cinq essais manqués');
    expect(reponse('q-verrou')).toContain('une minute, puis cinq, quinze, trente et soixante minutes');
    expect(reponse('q-verrou')).toContain('douze heures après le dernier échec');
  });

  it('le second facteur est celui de double-authentification.ts', () => {
    const d = serveur('src/modules/auth/double-authentification.ts');
    expect(constante(d, 'CHIFFRES')).toBe('6');
    expect(constante(d, 'PAS_SECONDES')).toBe('30');
    expect(constante(d, 'NOMBRE_CODES_SECOURS')).toBe('8');
    expect(reponse('q-double-authentification')).toContain('un code de six chiffres renouvelé toutes les trente secondes');
    expect(reponse('q-double-authentification')).toContain('Huit codes de secours');
  });

  it('les durées de session sont celles de session-longue.ts', () => {
    const s = serveur('src/modules/auth/session-longue.ts');
    expect(constante(s, 'DUREE_MAXIMALE_SESSION_LONGUE_S')).toBe('30 * SECONDES_PAR_JOUR');
    expect(constante(s, 'DUREE_INACTIVITE_SESSION_LONGUE_S')).toBe('7 * SECONDES_PAR_JOUR');
    expect(reponse('q-rester-connecte')).toContain('trente jours au plus, et se ferme après sept jours sans utilisation');
    expect(reponse('q-rester-connecte')).toContain('au plus tard huit heures après la connexion');
  });

  it('la grille des formules vient du contrat, qui la confronte à la console', () => {
    expect(reponse('q-formules')).toContain('Essentiel (1 dossier, 2 utilisateurs · tenue, états financiers, notes)');
  });

  it('dit la pratique de VMG Consulting sur les données, comme la politique de confidentialité, jamais une impossibilité', () => {
    // Relecture B1 · la FAQ répondait « Non. » à « VMG voit-il mes données ? »
    // alors que la sauvegarde de chaque nuit lit toute la base et la
    // restaure pour contrôle. La réponse dit ce que VMG fait et nomme ses
    // accès, les mêmes que la politique.
    const r = reponse('q-vmg-voit');
    expect(r.startsWith('VMG Consulting ne consulte pas le contenu de vos dossiers.')).toBe(true);
    expect(r).toContain('la sauvegarde chiffrée de chaque nuit, dont elle détient la clé');
    expect(r).toContain('la restauration de contrôle automatique');
    expect(r).toContain('requêtes de maintenance');
    const politique = lire('src/pages/ConfidentialitePage.tsx').replace(/\s+/g, ' ');
    expect(politique).toContain('à la restauration de contrôle automatique qui l’éprouve et ne rend que des décomptes');
  });

  it('dit le français, seul, et ne promet aucune autre langue', () => {
    expect(reponse('q-langue')).toContain('En français seulement.');
    expect(reponse('q-langue')).toContain('aucune autre langue n’est proposée');
  });

  it('dit les coordonnées de VMG Consulting à arrêter tant que le contrat les dit à arrêter', () => {
    // Le jour où VMG Consulting les arrête dans le contrat, la réponse se
    // réécrit avec elles · ce test tombe pour qu'on n'oublie pas.
    expect(mentionsAArreter().length > 0).toBe(reponse('q-joindre').includes('doivent être arrêtés par VMG Consulting'));
  });

  it('aucune réponse n’annonce une fonction à venir (CLAUDE.md § 4)', () => {
    for (const q of reponses) expect([q.id, /bient[ôo]t|prochainement|à venir/i.test(q.reponse.join(' '))]).toEqual([q.id, false]);
  });
});

describe('le contrat de licence se lit sur la page tel que le serveur le joint', () => {
  it('la page le rend depuis le module partagé, sans second texte', () => {
    const page = lire('src/pages/ContratLicencePage.tsx');
    expect(page).toContain("from '../../../src/modules/conditions-licence/conditions-de-licence'");
    expect(page).toContain('articlesDesConditions().map(');
    expect(page).toContain('texteBrutDesConditions()');
  });

  it('la fenêtre porte l’acceptation, la page publique non', () => {
    const page = lire('src/pages/ContratLicencePage.tsx');
    const publique = page.slice(page.indexOf('export function ContratLicencePage'), page.indexOf('export function ContratLicenceFenetre'));
    const fenetre = page.slice(page.indexOf('export function ContratLicenceFenetre'));
    expect(publique).not.toContain('<AcceptationConditionsLicence />');
    expect(fenetre).toContain('<AcceptationConditionsLicence />');
  });

  it('l’acceptation se fait par la route du serveur, case cochée, version lue', () => {
    const bloc = lire('src/components/AcceptationConditionsLicence.tsx');
    expect(bloc).toMatch(/api\.post<[^>]*>\('\/conditions-licence\/acceptation', \{/);
    expect(bloc).toContain('version: etat.version.numero,');
    expect(bloc).toContain('lu: true,');
    expect(bloc).toContain('{etat.aAccepter && estAdmin && (');
  });

  it('le rappel de l’espace de travail ne ferme rien · une ligne, pour l’administrateur, servie par le serveur', () => {
    const bandeau = lire('src/components/chrome/BandeauConditions.tsx');
    expect(bandeau).toMatch(/\.get<EtatConditions>\('\/conditions-licence'\)/);
    expect(bandeau).toContain('if (!estAdmin || !tenantId)');
    expect(bandeau).toContain('if (!aAccepter) return null;');
  });

  it('le texte brut porte la version et la langue', () => {
    expect(texteBrutDesConditions().split('\n')[1]).toMatch(/^Version \d+ du .+ · langue du contrat · français$/);
  });
});
