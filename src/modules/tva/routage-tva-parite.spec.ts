import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as serveur from './routage-tva';

// PAR UN `require` AU CHEMIN CALCULÉ, jamais un import statique · `nest build`
// compilerait l'interface avec le serveur (`construction-serveur.spec.ts`).
const client = require(join(__dirname, '../../../client/src/lib/tva-syscohada')) as typeof serveur;
const { estTauxZero: estTauxZeroClient } = require(join(__dirname, '../../../client/src/lib/tva-saisie')) as {
  estTauxZero: (t: { taux: string | number }) => boolean;
};

/**
 * AUDIT FINAL F116 · UNE RÈGLE, DEUX PAQUETS. Le serveur ne peut pas importer
 * le client à la construction · ce test exécute les deux versions sur TOUS les
 * comptes des classes 2, 6 et 7 des deux semis, et sur les deux sens, et
 * exige la même réponse. Une divergence le fait tomber au premier correctif.
 */
const numeros = (f: string) =>
  [...readFileSync(join(__dirname, '..', 'comptes', f), 'utf8').matchAll(/'([267]\d{7})'/g)].map((m) => m[1]);

describe('F116 · le routage des comptes de TVA est le même au serveur et à la saisie', () => {
  const plan = new Set(['44310000', '44320000', '44330000', '44510000', '44520000', '44530000', '44540000']);
  for (const [referentiel, fichier] of [
    ['SYSCOHADA', 'compte-seed-syscohada.ts'],
    ['SYCEBNL', 'compte-seed.ts'],
  ] as const) {
    it(`${referentiel} · chaque compte de gestion, dans les deux sens`, () => {
      const liste = numeros(fichier);
      expect(liste.length).toBeGreaterThan(100);
      for (const n of liste) {
        for (const sens of ['recette', 'depense'] as const) {
          expect(serveur.compteTvaPourContrepartie(referentiel, sens, n, plan)).toBe(
            client.compteTvaPourContrepartie(referentiel, sens, n, plan),
          );
        }
      }
    });
  }

  it('les sous-comptes de taxe semés retenus sont exactement ceux que le routage impose, et semés au SYSCOHADA', () => {
    // Retenus d'office (CompteService.seedPlan, migration des comptes
    // personnalisés) · un compte routé absent de la liste ferait tomber la
    // ligne de TVA posée d'office sur un compte que le comptable ne peut pas
    // adopter ; un compte de trop serait proposé sans raison.
    const routes = new Set<string>();
    for (const n of numeros('compte-seed-syscohada.ts')) {
      for (const r of [serveur.compteTvaCollectee(n), serveur.compteTvaRecuperable(n)]) if (r) routes.add(r);
    }
    expect([...routes].sort()).toEqual([...serveur.COMPTES_DE_TAXE_ROUTES_SYSCOHADA].sort());
    const semis = readFileSync(join(__dirname, '..', 'comptes', 'compte-seed-syscohada.ts'), 'utf8');
    for (const n of serveur.COMPTES_DE_TAXE_ROUTES_SYSCOHADA) expect(semis).toContain(`'${n}'`);
    const migration = readFileSync(join(__dirname, '../../../prisma/migrations/20270164000000_comptes_personnalises/migration.sql'), 'utf8');
    expect(migration).toContain(serveur.COMPTES_DE_TAXE_ROUTES_SYSCOHADA.map((n) => `'${n}'`).join(', '));
  });

  it('le taux zéro se lit pareil', () => {
    for (const t of ['0', '0.00', '16', '8', '0.000001']) {
      expect(serveur.estTauxZero(t)).toBe(estTauxZeroClient({ taux: t } as never));
    }
  });
});
