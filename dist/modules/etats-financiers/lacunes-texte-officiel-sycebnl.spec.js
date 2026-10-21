"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_notes_projets_1 = require("../notes-annexes/correspondance-notes-projets");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const correspondance_projet_bilan_1 = require("./correspondance-projet-bilan");
const correspondance_projet_compte_exploitation_1 = require("./correspondance-projet-compte-exploitation");
const correspondance_bilan_1 = require("./correspondance-bilan");
const POSTES_COMPTE_EXPLOITATION_PROJET = [...correspondance_projet_compte_exploitation_1.POSTES_REVENUS, ...correspondance_projet_compte_exploitation_1.POSTES_CHARGES];
const projetCE = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'correspondance-projet-compte-exploitation.ts'), 'utf8');
const projetBilan = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'correspondance-projet-bilan.ts'), 'utf8');
function prefixesCaptes(postes) {
    return postes.flatMap((p) => [...(p.comptes ?? []), ...(p.comptesAmortissement ?? [])]);
}
describe('SYCEBNL · le compte 46 n’est pas un orphelin', () => {
    it('est rattaché au poste DF du bilan des PROJETS, comme le veut le texte', () => {
        const df = correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DF');
        expect(df).toBeDefined();
        expect(df.libelle).toBe("Fonds d'administration");
        expect(df.comptes).toContain('46');
    });
    it('est absent du bilan des ASSOCIATIONS, et c’est correct', () => {
        const capte = prefixesCaptes([...correspondance_bilan_1.POSTES_ACTIF, ...correspondance_bilan_1.POSTES_PASSIF]);
        expect(capte).not.toContain('46');
    });
});
describe('SYCEBNL · lacunes du texte officiel, non comblées et signalées', () => {
    it('le compte 68 n’est rattaché à aucun poste du compte d’exploitation projets', () => {
        expect(prefixesCaptes(POSTES_COMPTE_EXPLOITATION_PROJET)).not.toContain('68');
        expect(projetCE).toContain('Compte 68 (Dotations aux amortissements) absent de tout poste');
        expect(projetCE).toContain('[texte officiel]');
    });
    it('cinq subdivisions du compte 70 ne sont réclamées par aucun poste', () => {
        const capte = prefixesCaptes(POSTES_COMPTE_EXPLOITATION_PROJET);
        for (const present of ['702', '705', '707'])
            expect(capte).toContain(present);
        for (const absent of ['701', '703', '704', '706', '708'])
            expect(capte).not.toContain(absent);
        expect(capte).not.toContain('70');
        expect(projetCE).toContain('Cinq subdivisions du compte 70 absentes de tout poste');
    });
    it('la note 14 qui détaille RD ne capte aucune des cinq subdivisions refusées aux postes (passe R6, D5)', () => {
        const note14 = correspondance_notes_projets_1.NOTES_PROJETS.filter((n) => n.code === '14').flatMap((n) => n.rubriques);
        for (const absent of ['701', '703', '704', '706', '708']) {
            const capteurs = note14.filter((r) => (r.comptes ?? []).some((p) => `${absent}00000`.startsWith(p) || p.startsWith(absent)));
            expect([absent, capteurs.map((r) => r.libelle)]).toEqual([absent, []]);
        }
    });
    it('les comptes 499 et 599 ne sont réclamés par aucun poste du bilan projets', () => {
        expect(prefixesCaptes(correspondance_projet_bilan_1.POSTES_PASSIF)).not.toContain('499');
        expect(prefixesCaptes(correspondance_projet_bilan_1.POSTES_PASSIF)).not.toContain('599');
        expect(projetBilan).toContain('les comptes 499/599 ne');
    });
    it('le poste DI du bilan projets porte bien « 20 », transcrit tel quel', () => {
        const di = correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DI');
        expect(di.comptes).toEqual(['20']);
        expect(projetBilan).toContain('corruption de scan');
    });
    it('chaque lacune est signalée dans le fichier, jamais corrigée en silence', () => {
        for (const fichier of [projetCE, projetBilan]) {
            expect(fichier).toContain('[texte officiel]');
            expect(fichier).toMatch(/comptes non rattachés/i);
        }
    });
});
//# sourceMappingURL=lacunes-texte-officiel-sycebnl.spec.js.map