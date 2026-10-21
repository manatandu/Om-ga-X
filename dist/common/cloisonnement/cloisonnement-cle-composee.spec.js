"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const extension_cloisonnement_1 = require("./extension-cloisonnement");
describe('cloisonnement · écriture par clé composée', () => {
    it('la garde reconnaît bornées les deux formes corrigées', () => {
        expect((0, extension_cloisonnement_1.filtreBorne)({ questionnaireId_code: { questionnaireId: 'q1', code: 'CPCC-1' }, tenantId: 't1' }, 't1')).toBe(true);
        expect((0, extension_cloisonnement_1.filtreBorne)({ immobilisationId_exerciceId: { immobilisationId: 'i1', exerciceId: 'e1' }, tenantId: 't1' }, 't1')).toBe(true);
        expect((0, extension_cloisonnement_1.filtreBorne)({ questionnaireId_code: { questionnaireId: 'q1', code: 'CPCC-1' }, tenantId: 't2' }, 't1')).toBe(false);
    });
    it('toute écriture du serveur par une telle clé nomme le dossier', () => {
        const racine = (0, node_path_1.join)(__dirname, '../../..');
        const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(racine, 'prisma/schema.prisma'), 'utf8');
        const cles = [];
        for (const m of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
            const corps = m[2];
            if (!/^\s+tenantId\s/m.test(corps))
                continue;
            for (const u of corps.matchAll(/@@(?:unique|id)\(\[([^\]]+)\](?:,\s*name:\s*"(\w+)")?/g)) {
                const champs = u[1].split(',').map((c) => c.trim());
                if (champs.includes('tenantId'))
                    continue;
                cles.push(u[2] ?? champs.join('_'));
            }
        }
        expect(cles).toEqual(expect.arrayContaining(['questionnaireId_code', 'immobilisationId_exerciceId']));
        const fichiers = [];
        const parcourir = (d) => {
            for (const n of (0, node_fs_1.readdirSync)(d)) {
                const p = (0, node_path_1.join)(d, n);
                if ((0, node_fs_1.statSync)(p).isDirectory())
                    parcourir(p);
                else if (p.endsWith('.ts') && !p.endsWith('.spec.ts'))
                    fichiers.push(p);
            }
        };
        parcourir((0, node_path_1.join)(racine, 'src'));
        const fautifs = [];
        for (const f of fichiers) {
            const src = (0, node_fs_1.readFileSync)(f, 'utf8');
            for (const cle of cles) {
                let i = src.indexOf(`where: { ${cle}:`);
                while (i !== -1) {
                    const avant = src.slice(Math.max(0, i - 200), i);
                    const methode = [...avant.matchAll(/\.(\w+)\(\{/g)].pop()?.[1];
                    let profondeur = 0;
                    let fin = i + 'where: '.length;
                    for (; fin < src.length; fin++) {
                        if (src[fin] === '{')
                            profondeur++;
                        else if (src[fin] === '}' && --profondeur === 0)
                            break;
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
//# sourceMappingURL=cloisonnement-cle-composee.spec.js.map