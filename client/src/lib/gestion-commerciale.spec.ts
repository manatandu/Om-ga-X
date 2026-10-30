import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lireNombre, montantHTPropose, roleExigePour, ROLES_COLLABORATEUR } from './gestion-commerciale';

describe('gestion commerciale · aides de l’écran (ligne commercial-l8)', () => {
  it('le montant HT proposé est quantité × prix net, au centime', () => {
    expect(montantHTPropose(2, 27_000)).toBe(54_000);
    expect(montantHTPropose(3, 0.335)).toBe(1.01);
  });
  it('« 500.000 » est ambigu, vide efface', () => {
    expect(lireNombre('500.000')).toBeUndefined();
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('1 500,25')).toBe(1500.25);
  });
  it('le rôle exigé du représentant et la liste des rôles sont ceux du serveur, en miroir', () => {
    const serveur = readFileSync(join(__dirname, '..', '..', '..', 'src', 'modules', 'commercial', 'collaborateurs.ts'), 'utf8');
    expect(serveur).toContain(`export const ROLES_COLLABORATEUR = [${ROLES_COLLABORATEUR.map((r) => `'${r}'`).join(', ')}] as const;`);
    expect([roleExigePour('CLIENT'), roleExigePour('ADHERENT'), roleExigePour('FOURNISSEUR'), roleExigePour('SALARIE')]).toEqual(['vendeur', 'vendeur', 'acheteur', null]);
  });
});

describe('fonction 25 · la devise proposée en saisie ne suit pas un autre compte', () => {
  it('choisirCompte propose la devise habituelle et retire celle qu’il avait proposée', () => {
    const page = readFileSync(join(__dirname, '..', 'pages', 'SaisiePage.tsx'), 'utf8');
    const corps = page.slice(page.indexOf('const choisirCompte = (c: Compte) => {'), page.indexOf('const focusMontantConseille'));
    expect(corps).toContain('devisesDesComptes?.get(c.id)');
    expect(corps).toContain("choisirDevise('');");
    expect(corps).toContain('choisirDevise(habituelle.deviseId)');
    expect(page).toContain("'/tiers/devises-des-comptes'");
  });
});
