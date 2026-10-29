import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

/**
 * NOMMÉ `.test.ts`, PAS `.spec.ts` · le jest de la racine lit les `.spec.ts` du
 * client AVANT l'installation du client dans le déploiement, où ce
 * `node_modules` n'existe pas ; vitest lit les deux. describe/it/expect
 * arrivent par les globales de vitest (convention du dépôt).
 *
 * Le portillon `npx tsc --noEmit` doit typer en TypeScript 7 · sans
 * `scripts/lier-tsc-7.cjs`, npm lie la commande `tsc` de TypeScript 6, que
 * `@typescript/typescript6` (deux tests qui lisent le code source) emporte.
 */
describe('la commande tsc du client', () => {
  const racine = join(__dirname, '..');

  it('est celle de TypeScript 7', () => {
    const lien = realpathSync(join(racine, 'node_modules', '.bin', 'tsc'));
    const attendu = realpathSync(join(racine, 'node_modules', 'typescript', 'bin', 'tsc'));
    expect(lien).toBe(attendu);
    const version = JSON.parse(readFileSync(join(racine, 'node_modules', 'typescript', 'package.json'), 'utf8')).version;
    expect(version.startsWith('7.')).toBe(true);
  });

  it('est reliée à chaque installation', () => {
    const paquet = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
    expect(paquet.scripts.postinstall).toBe('node scripts/lier-tsc-7.cjs');
  });
});
