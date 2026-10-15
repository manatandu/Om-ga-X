import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pas d'import de « vitest » · convention du dépôt (le jest de la racine
// ramasse aussi client/src, describe/it/expect arrivent par les globales).

/**
 * UN SEUL TRAIT POUR LE GROUPE DE CE QUI SORT DU DOSSIER (relecture des
 * écrans de sage-l7, second tour, 13). « Exporter les modifications… » et
 * « Courriers sortants » portaient chacun `separateurAvant: !estAdmin` · le
 * non-administrateur, qui n'a ni l'import ni la restitution, voyait deux
 * traits de suite, l'export isolé entre eux. Le trait du groupe est porté par
 * la première entrée visible de tous, la file n'en porte aucun.
 */

const shell = readFileSync(join(__dirname, 'AppShell.tsx'), 'utf8');

/** La ligne de l'entrée de menu qui porte ce libellé, exactement une. */
function entree(label: string): { ligne: string; position: number } {
  const lignes = shell.split('\n');
  const trouvees = lignes.flatMap((l, i) => (l.includes(`label: '${label}'`) ? [i] : []));
  expect([label, trouvees.length]).toEqual([label, 1]);
  return { ligne: lignes[trouvees[0]], position: trouvees[0] };
}

describe('menu Fichier · le groupe des sorties du dossier', () => {
  it('l’export porte le trait du groupe quand l’import est absent', () => {
    expect(entree('Exporter les modifications…').ligne).toContain('separateurAvant: !estAdmin');
  });

  it('la file des courriels n’en porte pas un second', () => {
    const { ligne } = entree('Courriers sortants');
    expect(ligne).toContain('separateurAvant: false');
    expect(ligne).not.toContain('estAdmin');
  });

  it('les deux entrées se suivent · aucune autre entrée entre elles', () => {
    const exporter = entree('Exporter les modifications…').position;
    const courriers = entree('Courriers sortants').position;
    expect(courriers).toBeGreaterThan(exporter);
    const entre = shell.split('\n').slice(exporter + 1, courriers).join('\n');
    expect(entre).not.toMatch(/label:/);
  });
});
