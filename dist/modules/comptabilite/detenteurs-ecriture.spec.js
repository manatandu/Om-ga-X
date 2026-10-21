"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const detenteurs_ecriture_1 = require("./detenteurs-ecriture");
const RACINE = (0, node_path_1.join)(__dirname, '../../..');
function relationsVersEcriture() {
    const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'prisma/schema.prisma'), 'utf8');
    const relations = [];
    let modele = '';
    for (const ligne of schema.split('\n')) {
        const tete = ligne.match(/^model (\w+) \{/);
        if (tete)
            modele = tete[1];
        const champ = ligne.match(/^\s+\w+\s+Ecriture\??\s+@relation\([^)]*fields: \[(\w+)\]/);
        if (champ)
            relations.push(`${modele}.${champ[1]}`);
    }
    return relations;
}
function corpsDetenteursDe() {
    const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'ecriture.service.ts'), 'utf8');
    const debut = source.indexOf('private async detenteursDe(');
    const ouvrante = source.indexOf('{', source.indexOf(')', debut));
    let profondeur = 0;
    for (let i = ouvrante; i < source.length; i++) {
        if (source[i] === '{')
            profondeur++;
        else if (source[i] === '}' && --profondeur === 0)
            return source.slice(ouvrante, i + 1);
    }
    throw new Error('detenteursDe introuvable');
}
describe('détenteurs d’une écriture · la décision est prise pour chaque relation', () => {
    const relations = relationsVersEcriture();
    const laissees = Object.keys(detenteurs_ecriture_1.ECRITURE_LAISSEE_PARTIR);
    it('le schéma porte des relations vers une écriture · sinon rien n’est vérifié', () => {
        expect(relations.length).toBeGreaterThan(20);
        expect(relations).toContain('ReclassementImmobilisation.ecritureId');
    });
    it('chaque relation est rangée, une seule fois', () => {
        const nonRangees = relations.filter((r) => !detenteurs_ecriture_1.COLONNES_QUI_RETIENNENT.includes(r) && !laissees.includes(r));
        const deuxFois = relations.filter((r) => detenteurs_ecriture_1.COLONNES_QUI_RETIENNENT.includes(r) && laissees.includes(r));
        const fantomes = [...detenteurs_ecriture_1.COLONNES_QUI_RETIENNENT, ...laissees].filter((r) => !relations.includes(r));
        expect(['non rangées', nonRangees, 'deux fois', deuxFois, 'hors schéma', fantomes]).toEqual([
            'non rangées', [], 'deux fois', [], 'hors schéma', [],
        ]);
    });
    it('chaque motif de départ est écrit', () => {
        const sansMotif = laissees.filter((r) => detenteurs_ecriture_1.ECRITURE_LAISSEE_PARTIR[r].trim().length < 20);
        expect(sansMotif).toEqual([]);
    });
    it('chaque colonne qui retient est comptée par detenteursDe', () => {
        const corps = corpsDetenteursDe();
        const absentes = detenteurs_ecriture_1.COLONNES_QUI_RETIENNENT.filter((r) => {
            const [modele, colonne] = r.split('.');
            const delegue = modele[0].toLowerCase() + modele.slice(1);
            if (!corps.includes(`this.prisma.${delegue}.count(`))
                return true;
            return colonne !== 'ecritureId' && !corps.includes(`${colonne}:`);
        });
        expect(absentes).toEqual([]);
    });
    it('un mouvement de magasin ANNULÉ ne tient plus son écriture (audit final F133)', () => {
        expect(corpsDetenteursDe()).toContain('this.prisma.mouvementStock.count({ where: { tenantId, ecritureId, annuleLe: null } })');
    });
    it('toute relation vers une LIGNE d’écriture est décidée, avec la règle que le schéma déclare (mineur du 2026-10-07)', () => {
        const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'prisma/schema.prisma'), 'utf8');
        const lues = new Map();
        let modele = '';
        for (const ligne of schema.split('\n')) {
            const tete = ligne.match(/^model (\w+) \{/);
            if (tete)
                modele = tete[1];
            const champ = ligne.match(/^\s+\w+\s+LigneEcriture\??\s+@relation\(([^)]*)\)/);
            if (!champ)
                continue;
            const colonne = champ[1].match(/fields: \[(\w+)\]/)?.[1];
            const regle = champ[1].match(/onDelete: (\w+)/)?.[1] ?? 'MUETTE';
            if (colonne)
                lues.set(`${modele}.${colonne}`, regle.toUpperCase());
        }
        expect(lues.size).toBeGreaterThanOrEqual(4);
        const decidees = Object.keys(detenteurs_ecriture_1.RELATIONS_VERS_UNE_LIGNE);
        expect([...lues.keys()].filter((r) => !decidees.includes(r))).toEqual([]);
        expect(decidees.filter((r) => !lues.has(r))).toEqual([]);
        const discordantes = decidees.filter((r) => !detenteurs_ecriture_1.RELATIONS_VERS_UNE_LIGNE[r].startsWith(`${lues.get(r)} · `));
        expect(discordantes).toEqual([]);
    });
    it('toute relation vers une écriture déclare son onDelete (audit du serveur I3)', () => {
        const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'prisma/schema.prisma'), 'utf8');
        const muettes = schema
            .split('\n')
            .filter((l) => /^\s+\w+\s+Ecriture\??\s+@relation\([^)]*fields:/.test(l))
            .filter((l) => !l.includes('onDelete:'));
        expect(muettes.map((l) => l.trim())).toEqual([]);
    });
});
//# sourceMappingURL=detenteurs-ecriture.spec.js.map