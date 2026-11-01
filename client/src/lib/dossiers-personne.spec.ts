import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exerciceLu, LIBELLES_ROLES_DOSSIER } from './dossiers-personne';

/**
 * L'ACCUEIL DU CABINET SUR SES DOSSIERS (ligne multi-dossiers, 2026-11-01).
 * Ce qui casserait en silence · une liste qui ne s'imposerait plus après la
 * connexion (la personne travaillerait dans le premier dossier venu sans le
 * savoir), un changement de dossier qui garderait la page de l'autre.
 */
const src = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

describe('les dossiers de la personne', () => {
  it('l’exercice ouvert se dit au jour, et son absence se nomme', () => {
    expect(exerciceLu({ dateDebut: '2026-01-01T00:00:00.000Z', dateFin: '2026-12-31T00:00:00.000Z' })).toBe('01/01/2026 au 31/12/2026');
    expect(exerciceLu(null)).toBe('Aucun exercice ouvert');
  });

  it('chacun des cinq rôles a son libellé', () => {
    expect(Object.keys(LIBELLES_ROLES_DOSSIER).sort()).toEqual(['ADMIN_CABINET', 'AIDE_COMPTABLE', 'COMPTABLE', 'GESTIONNAIRE_PAIE', 'LECTURE_SEULE']);
  });

  it('la liste s’impose après la connexion, après le mot de passe provisoire et avant l’espace de travail', () => {
    const app = src('App.tsx');
    const zone = app.slice(app.indexOf('function ZoneProtegee'), app.indexOf('function Routage'));
    const mdp = zone.indexOf('<ChangerMotDePassePage />');
    const choix = zone.indexOf('if (utilisateur?.plusieursDossiers && !dossierChoisiDansLaSession()) return <ChoixDossierPage />;');
    expect(mdp).toBeGreaterThan(0);
    expect(choix).toBeGreaterThan(mdp);
    expect(zone.indexOf('return children;')).toBeGreaterThan(choix);
  });

  it('une connexion neuve et une déconnexion reposent la question', () => {
    const auth = src('lib', 'auth.tsx');
    const connexion = auth.slice(auth.indexOf('const seConnecter'), auth.indexOf('const rafraichir'));
    expect(connexion).toContain('oublierLeDossierChoisi();');
    expect(auth.match(/oublierLeDossierChoisi\(\);/g)?.length).toBe(3);
  });

  it('entrer dans un dossier passe par la route dédiée, garde le jeton CSRF neuf et repart d’une page neuve', () => {
    const lib = src('lib', 'entree-dossier.ts');
    const corps = lib.slice(lib.indexOf('export async function entrerDansLeDossier'));
    expect(corps).toContain("api.post<{ change: boolean; csrfToken?: string }>('/auth/changer-dossier', { dossierId })");
    expect(corps).toContain('if (r.csrfToken) setCsrf(r.csrfToken);');
    expect(corps).toContain('window.location.reload();');
  });

  it('Fichier > Changer de dossier n’est offert qu’à qui en tient plusieurs, profil de paie compris', () => {
    const shell = src('components', 'chrome', 'AppShell.tsx');
    expect(shell.match(/\.\.\.\(utilisateur\?\.plusieursDossiers \? \[\{ label: 'Changer de dossier…', onClick: \(\) => setChangerDossierOuvert\(true\) \}\] : \[\]\)/g)?.length).toBe(2);
  });
});
