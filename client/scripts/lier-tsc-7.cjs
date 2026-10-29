/**
 * LA COMMANDE `tsc` EST CELLE DE TYPESCRIPT 7.
 *
 * TypeScript 7 n'expose plus l'API du compilateur (seulement `typescript/
 * unstable/*`). Deux tests lisent le code source par cette API
 * (`entetes-de-grille-f242.spec.ts`, `grilles-fixes-etroites.spec.ts`) · ils
 * la prennent dans `@typescript/typescript6`, le paquet de compatibilité de
 * Microsoft. Mais celui-ci dépend de `@typescript/old` (TypeScript 6), que npm
 * remonte à la racine de `node_modules` avec sa propre commande `tsc`, et c'est
 * ELLE que npm lie dans `node_modules/.bin`, à chaque `npm ci` (constaté le
 * 2026-10-29) · `npx tsc --noEmit`, le portillon du dépôt, typait alors en
 * TypeScript 6 sans rien dire.
 *
 * Ce script, lancé après l'installation, relie `.bin/tsc` à TypeScript 7.
 * `src/lier-tsc-7.test.ts` vérifie que la commande liée est bien la 7.
 */
const { existsSync, lstatSync, symlinkSync, unlinkSync, writeFileSync, chmodSync } = require('node:fs');
const { join, relative } = require('node:path');

const racine = join(__dirname, '..');
const cible = join(racine, 'node_modules', 'typescript', 'bin', 'tsc');
const lien = join(racine, 'node_modules', '.bin', 'tsc');

if (!existsSync(cible)) {
  // Une installation sans TypeScript (production) n'a rien à relier.
  process.exit(0);
}
try {
  lstatSync(lien);
  unlinkSync(lien);
} catch {
  // Pas de lien à retirer.
}
if (process.platform === 'win32') {
  // Pas de lien symbolique sans droits sur Windows · un relais de commande.
  writeFileSync(`${lien}.cmd`, `@node "%~dp0\\${relative(join(racine, 'node_modules', '.bin'), cible)}" %*\r\n`);
} else {
  symlinkSync(relative(join(racine, 'node_modules', '.bin'), cible), lien);
  chmodSync(cible, 0o755);
}
