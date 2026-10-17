"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../../prisma/schema.prisma'), 'utf8');
function blocsDeModeles() {
    const blocs = new Map();
    const re = /^model (\w+) \{\n([\s\S]*?)^\}/gm;
    for (let m = re.exec(schema); m; m = re.exec(schema))
        blocs.set(m[1], m[2]);
    return blocs;
}
const CIBLES = ['ModeReglement', 'ModeleImpressionTiers'];
describe('index des références de la ligne sage-l2', () => {
    const blocs = blocsDeModeles();
    const relations = [];
    for (const [modele, corps] of blocs) {
        for (const ligne of corps.split('\n')) {
            const cible = /^\s+\w+\s+(\w+)\??\s+@relation\(/.exec(ligne)?.[1];
            if (!cible || !CIBLES.includes(cible))
                continue;
            const colonne = /fields:\s*\[(\w+)\]/.exec(ligne)?.[1];
            if (colonne)
                relations.push({ modele, colonne });
        }
    }
    it('le recensement trouve les relations attendues', () => {
        expect(relations).toEqual(expect.arrayContaining([
            { modele: 'Tiers', colonne: 'modeReglementId' },
            { modele: 'Tiers', colonne: 'modeleImpressionExtraitId' },
            { modele: 'Tiers', colonne: 'modeleImpressionReglementId' },
            { modele: 'Tiers', colonne: 'modeleImpressionRappelId' },
            { modele: 'ModeleReglement', colonne: 'modeReglementId' },
            { modele: 'EcheanceReglement', colonne: 'modeReglementId' },
            { modele: 'LigneEcriture', colonne: 'modeReglementId' },
        ]));
    });
    it('chaque relation a un index qui commence par sa colonne', () => {
        const sansIndex = relations.filter(({ modele, colonne }) => {
            const corps = blocs.get(modele) ?? '';
            return !new RegExp(`@@(index|unique)\\(\\[${colonne}[,\\]]`).test(corps);
        });
        expect(sansIndex).toEqual([]);
    });
});
//# sourceMappingURL=index-des-references-sage-l2.spec.js.map