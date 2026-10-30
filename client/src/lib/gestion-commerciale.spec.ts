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
