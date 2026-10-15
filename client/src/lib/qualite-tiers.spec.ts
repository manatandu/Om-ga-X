import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LONGUEUR_QUALITE, QUALITES_PROPOSEES, qualiteAEnvoyer } from './qualite-tiers';

// Aucun import de « vitest » · convention du dépôt.

/**
 * LA QUALITÉ DU TIERS (ligne sage-l2, fonction 24) · le miroir de l'écran
 * relit la liste et la longueur du serveur · une liste recopiée qui
 * divergerait proposerait des libellés que la colonne refuse.
 */
describe('la qualité du tiers à l’écran', () => {
  const serveur = readFileSync(join(__dirname, '../../../src/modules/tiers/qualite-tiers.ts'), 'utf8');

  it('la même liste et la même longueur que le serveur', () => {
    expect(serveur).toContain(`export const LONGUEUR_QUALITE = ${LONGUEUR_QUALITE};`);
    const bloc = serveur.slice(serveur.indexOf('QUALITES_PROPOSEES'), serveur.indexOf('];', serveur.indexOf('QUALITES_PROPOSEES')));
    const lus = [...bloc.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(lus).toEqual([...QUALITES_PROPOSEES]);
  });

  it('un blanc efface, un libellé se range', () => {
    expect(qualiteAEnvoyer('   ')).toBeNull();
    expect(qualiteAEnvoyer(' Société   anonyme ')).toBe('Société anonyme');
  });
});
