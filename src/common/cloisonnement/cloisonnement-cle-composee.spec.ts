import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { filtreBorne } from './extension-cloisonnement';

/**
 * UNE ÉCRITURE PAR CLÉ COMPOSÉE PORTE LE DOSSIER (simulation du logiciel
 * complet du 2026-10-08, lots D et F).
 *
 * La garde de cloisonnement relit, avant une écriture unitaire (`update`,
 * `delete`, `upsert`) dont le filtre ne nomme pas le dossier, la ligne visée
 * par `findFirst({ where })`. Or `findFirst` n'accepte pas une clé composée
 * (`questionnaireId_code`, `immobilisationId_exerciceId`) · Prisma levait
 * « Unknown argument », et le geste tombait en erreur 500. Aucune réponse au
 * questionnaire de révision ne s'enregistrait, aucun relevé d'unités d'œuvre
 * non plus, donc aucun bien amorti aux unités d'œuvre ne s'amortissait. Les
 * suites unitaires tournent sur des doublures, qui acceptent tout · seule une
 * vraie base l'a montré.
 *
 * La règle · une écriture qui vise une ligne cloisonnée par une clé composée
 * SANS `tenantId` met le dossier dans son filtre (Prisma 5 l'admet à côté de la
 * clé unique), et la garde la reconnaît bornée sans relire.
 */

describe('cloisonnement · écriture par clé composée', () => {
  it('la garde reconnaît bornées les deux formes corrigées', () => {
    expect(filtreBorne({ questionnaireId_code: { questionnaireId: 'q1', code: 'CPCC-1' }, tenantId: 't1' }, 't1')).toBe(true);
    expect(filtreBorne({ immobilisationId_exerciceId: { immobilisationId: 'i1', exerciceId: 'e1' }, tenantId: 't1' }, 't1')).toBe(true);
    // Le dossier d'un autre n'est pas une borne (audit du 2026-09-17).
    expect(filtreBorne({ questionnaireId_code: { questionnaireId: 'q1', code: 'CPCC-1' }, tenantId: 't2' }, 't1')).toBe(false);
  });

  /**
   * Le balayage relit le SCHÉMA · chaque modèle cloisonné dont une clé unique
   * ne contient pas `tenantId`, puis chaque appel d'écriture du serveur qui
   * passe par cette clé · son filtre doit nommer `tenantId`. Une clé ou une
   * écriture ajoutée demain tombe sous la même règle sans qu'on la recopie.
   */
  it('toute écriture du serveur par une telle clé nomme le dossier', () => {
    const racine = join(__dirname, '../../..');
    const schema = readFileSync(join(racine, 'prisma/schema.prisma'), 'utf8');
    const cles: string[] = [];
    for (const m of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
      const corps = m[2];
      if (!/^\s+tenantId\s/m.test(corps)) continue;
      for (const u of corps.matchAll(/@@(?:unique|id)\(\[([^\]]+)\](?:,\s*name:\s*"(\w+)")?/g)) {
        const champs = u[1].split(',').map((c) => c.trim());
        if (champs.includes('tenantId')) continue;
        cles.push(u[2] ?? champs.join('_'));
      }
    }
    // Le balayage trouve encore quelque chose · sinon il ne prouverait rien.
    expect(cles).toEqual(expect.arrayContaining(['questionnaireId_code', 'immobilisationId_exerciceId']));

    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) fichiers.push(p);
      }
    };
    parcourir(join(racine, 'src'));

    const fautifs: string[] = [];
    for (const f of fichiers) {
      const src = readFileSync(f, 'utf8');
      for (const cle of cles) {
        let i = src.indexOf(`where: { ${cle}:`);
        while (i !== -1) {
          // L'appel qui porte ce filtre · le dernier `.methode(` avant lui.
          const avant = src.slice(Math.max(0, i - 200), i);
          const methode = [...avant.matchAll(/\.(\w+)\(\{/g)].pop()?.[1];
          // Le filtre entier, accolades équilibrées.
          let profondeur = 0;
          let fin = i + 'where: '.length;
          for (; fin < src.length; fin++) {
            if (src[fin] === '{') profondeur++;
            else if (src[fin] === '}' && --profondeur === 0) break;
          }
          const filtre = src.slice(i, fin + 1);
          if (['update', 'delete', 'upsert'].includes(methode ?? '') && !/\btenantId\b/.test(filtre.replace(`${cle}:`, ''))) {
            fautifs.push(`${f.slice(racine.length + 1)} · ${methode} par ${cle}`);
          }
          i = src.indexOf(`where: { ${cle}:`, i + 1);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});
