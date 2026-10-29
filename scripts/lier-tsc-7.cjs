/**
 * LA COMMANDE `tsc` DU SERVEUR EST CELLE DE TYPESCRIPT 7 (mise à jour du
 * 2026-10-29, demandée par Manasse).
 *
 * Le paquet `typescript` de la racine reste en VERSION 6 · `ts-jest`, `ts-node`
 * et la CLI de NestJS lisent l'API du compilateur, que TypeScript 7 n'expose
 * plus (ts-jest la borne à `<7`). TypeScript 7 est installé sous le nom
 * `typescript7` (alias npm) et c'est LUI qui type (`npx tsc --noEmit`, le
 * portillon) et construit (`npm run build`). Les deux paquets portent une
 * commande `tsc` · npm lie celle du paquet `typescript`, d'où ce script, lancé
 * après l'installation, qui relie `.bin/tsc` à TypeScript 7.
 * `src/common/exploitation/tsc-7.spec.ts` le vérifie.
 */
const { existsSync, lstatSync, symlinkSync, unlinkSync, writeFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const racine = join(__dirname, '..');
const dossierBin = join(racine, 'node_modules', '.bin');
const cible = join(racine, 'node_modules', 'typescript7', 'bin', 'tsc');
const lien = join(dossierBin, 'tsc');

if (!existsSync(cible)) {
  // Installation de production (`npm ci --omit=dev`) · aucun compilateur à relier.
  process.exit(0);
}
try {
  lstatSync(lien);
  unlinkSync(lien);
} catch {
  // Pas de lien à retirer.
}
if (process.platform === 'win32') {
  writeFileSync(`${lien}.cmd`, `@node "%~dp0\\${relative(dossierBin, cible)}" %*\r\n`);
} else {
  symlinkSync(relative(dossierBin, cible), lien);
}
