import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * UN SEUL ORDRE DE VERROUS · LE DOSSIER, PUIS LES LIGNES (ligne
 * saisie-suites, point 1, 2026-10-30).
 *
 * Tout acte audité dans une transaction prend le verrou consultatif du
 * dossier avant sa ligne (`extension-audit.ts`), et la saisie, la clôture, le
 * lettrage le prennent en tête. Un geste qui verrouillait une ligne
 * (`SELECT … FOR UPDATE`) AVANT son premier acte audité attendait ensuite ce
 * verrou en tenant sa ligne · une transaction qui tenait déjà le dossier et
 * voulait la même ligne fermait le cycle, PostgreSQL abattait l'une des deux
 * (40P01) et l'utilisateur recevait une 500. Trente et un gestes avaient cet
 * ordre inverse (fiches de bien, RIB, salariés, rappels, missions, feuilles
 * de temps, formations, campagnes d'inventaire, budgets, grilles, visa des
 * factures, impressions différées).
 *
 * La règle se relit par STRUCTURE, jamais par une distance · chaque
 * `FOR UPDATE` ou `FOR SHARE` écrit dans `src/` est précédé, dans la
 * fonction qui l'écrit (le corps de la transaction `async (tx) =>`, ou la
 * fonction d'aide qui verrouille), par la prise du verrou du dossier. Le
 * verrou consultatif est réentrant · le reprendre dans une aide appelée sous
 * lui ne coûte qu'un aller-retour.
 */

const RACINE = join(__dirname, '..');

function sources(dossier: string, liste: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) sources(chemin, liste);
    else if (chemin.endsWith('.ts') && !chemin.endsWith('.spec.ts')) liste.push(chemin);
  }
  return liste;
}

/** Le début de la fonction qui écrit la requête · corps d'une transaction, méthode, ou fonction. */
const OUVERTURE = /async\s*\(\s*(tx|t|db)\b[^)]*\)\s*=>|^\s*(export\s+)?(async\s+)?function\s+\w+|^\s{2}(private\s+|public\s+|protected\s+)?(static\s+)?async\s+\w+\s*\(/gm;
/** La prise du verrou du dossier, sous l'une de ses formes. */
const VERROU = /prendreLeVerrouDuDossier(Borne)?\s*\(|transactionDeSaisie\s*\(|transactionSousVerrouDuDossier\s*\(|pg_advisory_xact_lock/;

function sansCommentaires(source: string): string {
  // Les commentaires remplacés par des blancs de même longueur · les positions
  // restent celles du fichier, et un « FOR UPDATE » cité en commentaire ne
  // compte pas.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (c, avant: string) => avant + ' '.repeat(c.length - avant.length));
}

export function verrousDeLigneSansDossier(source: string): number[] {
  const code = sansCommentaires(source);
  const fautes: number[] = [];
  for (const m of code.matchAll(/FOR (UPDATE|SHARE)\b/g)) {
    const position = m.index ?? 0;
    let debut = 0;
    for (const o of code.slice(0, position).matchAll(OUVERTURE)) debut = o.index ?? 0;
    if (!VERROU.test(code.slice(debut, position))) fautes.push(code.slice(0, position).split('\n').length);
  }
  return fautes;
}

describe('un seul ordre de verrous · le dossier, puis les lignes', () => {
  it('le relevé reconnaît un verrou de ligne pris avant le dossier, et l’ordre juste', () => {
    const faux = 'return transactionJournalisee(this.prisma, async (tx) => {\n  await tx.$queryRaw`SELECT id FROM "x" WHERE id = ${id} FOR UPDATE`;\n  await prendreLeVerrouDuDossierBorne(tx, d);\n});';
    const juste = 'return transactionJournalisee(this.prisma, async (tx) => {\n  await prendreLeVerrouDuDossierBorne(tx, d);\n  await tx.$queryRaw`SELECT id FROM "x" WHERE id = ${id} FOR UPDATE`;\n});';
    const aide = 'async function verrouiller(tx: T, d: string) {\n  await tx.$queryRaw`SELECT id FROM "x" FOR UPDATE`;\n}';
    expect(verrousDeLigneSansDossier(faux)).toEqual([2]);
    expect(verrousDeLigneSansDossier(juste)).toEqual([]);
    expect(verrousDeLigneSansDossier(aide)).toEqual([2]);
    expect(verrousDeLigneSansDossier('// un FOR UPDATE cité\n/* FOR SHARE */')).toEqual([]);
  });

  it('aucun FOR UPDATE ni FOR SHARE de src/ n’est pris avant le verrou du dossier', () => {
    const fichiers = sources(RACINE);
    let vus = 0;
    const fautes: string[] = [];
    for (const f of fichiers) {
      const source = readFileSync(f, 'utf8');
      if (!/FOR (UPDATE|SHARE)/.test(source)) continue;
      vus++;
      for (const ligne of verrousDeLigneSansDossier(source)) fautes.push(`${relative(RACINE, f)}:${ligne}`);
    }
    // Le relevé trouve encore quelque chose · un dépôt sans aucun verrou de
    // ligne ferait passer le test pour rien.
    expect(vus).toBeGreaterThan(20);
    expect(fautes).toEqual([]);
  });
});
