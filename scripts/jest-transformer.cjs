/**
 * LE TRANSFORMATEUR DES TESTS · ts-jest pour le code du dépôt, une conversion
 * à part pour les modules ESM de NestJS.
 *
 * NestJS 12 n'est publié qu'en modules ESM (`type: module`). Le serveur reste
 * en CommonJS · Node 22 charge un module ESM par `require()`, la production ne
 * voit rien. Jest 29 n'en sait rien · il exécute chaque fichier comme du
 * CommonJS, d'où la conversion des fichiers de `node_modules/@nestjs`
 * (`transformIgnorePatterns` de package.json). Deux règles la séparent de
 * ts-jest, qui garde le code du dépôt tel qu'il était.
 *
 *  1. `esModuleInterop` VRAI · `@nestjs/jwt` importe `jsonwebtoken`, un module
 *     CommonJS, par défaut (`import jsonwebtoken from`). Le code du dépôt, lui,
 *     le garde FAUX (sans quoi `jest.spyOn(bcrypt, …)` ne redéfinit plus
 *     l'export). ts-jest ne tient qu'un réglage par configuration de Jest, les
 *     deux ne cohabitent pas dans lui.
 *  2. `import.meta.url`, que `@nestjs/common` emploie pour charger ses paquets
 *     facultatifs, devient l'adresse du fichier, ce qu'il vaut en ESM · une
 *     conversion vers CommonJS ne le traduit pas.
 */
const { createHash } = require('node:crypto');
const ts = require('typescript');
const { TsJestTransformer } = require('ts-jest');

const URL_DU_FICHIER = "require('node:url').pathToFileURL(__filename).href";
const OPTIONS_ESM = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  allowJs: true,
  esModuleInterop: true,
  inlineSourceMap: true,
};

const estDesModulesEsm = (chemin) => /[\\/]node_modules[\\/]/.test(chemin);

function convertir(source, chemin) {
  const traduit = source.replace(/\bimport\.meta\.url\b/g, URL_DU_FICHIER);
  return { code: ts.transpileModule(traduit, { compilerOptions: OPTIONS_ESM, fileName: chemin }).outputText };
}

module.exports = {
  createTransformer(options) {
    const tsJest = new TsJestTransformer(options);
    return {
      canInstrument: false,
      process(source, chemin, opts) {
        return estDesModulesEsm(chemin) ? convertir(source, chemin) : tsJest.process(source, chemin, opts);
      },
      async processAsync(source, chemin, opts) {
        return estDesModulesEsm(chemin) ? convertir(source, chemin) : tsJest.processAsync(source, chemin, opts);
      },
      getCacheKey(source, chemin, opts) {
        if (!estDesModulesEsm(chemin)) return tsJest.getCacheKey(source, chemin, opts);
        return createHash('sha256').update('esm-1').update(ts.version).update(chemin).update(source).digest('hex');
      },
    };
  },
};
