import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pas d'import de « vitest » · convention du dépôt (le jest de la racine
// ramasse aussi client/src, describe/it/expect arrivent par les globales).

/**
 * LES ÉDITIONS DES STRUCTURES NE S'IMPRIMENT QUE LUES (relecture des écrans,
 * second tour, 11 et 12 · jumeaux de m6). Une réponse périmée est jetée par
 * un jeton, et une liste pas encore lue pour la recherche tapée ne s'imprime
 * pas sous ses critères ; aucun « 0 section » sur des sections non lues.
 */

const lire = (p: string) => readFileSync(join(__dirname, p), 'utf8');

/** Le corps d'une fonction fléchée déclarée à deux espaces, jusqu'à sa fermeture. */
function corps(source: string, nom: string): string {
  const debut = source.indexOf(`  const ${nom} = async () => {`);
  expect([nom, debut >= 0]).toEqual([nom, true]);
  return source.slice(debut, source.indexOf('\n  };', debut));
}

describe('plan comptable et plan des tiers · jeton et recherche lue (12)', () => {
  it.each([
    { fichier: 'PlanComptesPage.tsx', jeton: 'jetonComptes', pose: 'setComptes(lus)', liste: 'comptes', quoi: 'Plan comptable' },
    { fichier: 'TiersPage.tsx', jeton: 'jetonTiers', pose: 'setListe(lus)', liste: 'liste', quoi: 'Plan des tiers' },
  ])('$fichier · une réponse périmée est jetée, l’édition dit la liste non lue', ({ fichier, jeton, pose, liste, quoi }) => {
    const source = lire(fichier);
    const charger = corps(source, 'charger');
    expect(charger).toContain(`const mien = ++${jeton}.current;`);
    // Le jeton se juge AVANT que la liste soit posée, avec la recherche lue.
    const garde = charger.indexOf(`if (mien !== ${jeton}.current) return;`);
    expect(garde).toBeGreaterThan(0);
    expect(charger.indexOf(pose)).toBeGreaterThan(garde);
    expect(charger).toContain('setRechercheLue(demandee)');
    const lue = `${liste} !== null && rechercheLue === recherche`;
    const echappe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(source).toMatch(new RegExp(`perimetreSiLue\\(\\s*${echappe(lue)},\\s*'${quoi}',`));
    // Les lignes imprimées suivent la même condition · rien d'une autre recherche.
    expect(source).toMatch(new RegExp(`edition=\\{edition\\w+\\(${echappe(lue)} \\?`));
  });
});

describe('plan analytique · aucun « 0 section » sur des sections non lues (11)', () => {
  it('le pied de la liste dit « non lues » plutôt qu’un nombre', () => {
    const source = lire('PlansAnalytiquesPage.tsx');
    expect(source).toContain("sections === null ? 'Sections non lues' : `${listeFiltree.length} section");
  });
});
