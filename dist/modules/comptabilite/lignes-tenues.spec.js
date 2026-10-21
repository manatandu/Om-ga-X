"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const lignes_tenues_1 = require("./lignes-tenues");
describe('les issues d’une ligne lettrée ou pointée', () => {
    const libre = { lettre: null, lettrageId: null, rapprochementId: null };
    it('pointée · dépointer en cours, sinon la réouverture par l’administrateur, le dernier clos seulement', () => {
        const motif = (0, lignes_tenues_1.motifLignesTenues)([{ ...libre, rapprochementId: 'r' }], 'cette écriture', 'corriger');
        expect(motif).toMatch(/clos, seul l’administrateur le rouvre \(« Rouvrir le rapprochement », le dernier clos du compte seulement, motif exigé\)/);
    });
    it('lettrée · délettrer, et une ligne figée par une clôture définitive ne se délettre plus', () => {
        const motif = (0, lignes_tenues_1.motifLignesTenues)([{ ...libre, lettre: 'A', lettrageId: 'g' }], 'cette écriture', 'corriger');
        expect(motif).toMatch(/Délettrez-les d’abord\. Une ligne figée par une clôture totale, de période ou d’exercice ne se délettre plus/);
    });
    it('B-1 · l’issue d’un lettrage figé distingue l’exercice clôturé de l’exercice encore ouvert', () => {
        const motif = (0, lignes_tenues_1.motifLignesTenues)([{ ...libre, lettre: 'A', lettrageId: 'g' }], 'cette écriture', 'corriger');
        expect(motif).toMatch(/Exercice clôturé · l’erreur relève du report à nouveau \(AUDCIF art\. 20, al\. 3\)/);
        expect(motif).toMatch(/Exercice encore ouvert · l’inscription en négatif reste due dans l’exercice \(art\. 20, al\. 2\), au premier jour non clôturé \(art\. 22, 4°\)/);
        expect(motif).not.toMatch(/l’erreur relève alors du report à nouveau/);
    });
    it('A7 ter, B2b · seul le groupe TOLÉRÉ est ignoré · toute autre ligne lettrée ou pointée refuse comme avant', () => {
        const module = { ...libre, lettre: 'A', lettrageId: 'g-A' };
        expect((0, lignes_tenues_1.motifLignesTenues)([module, libre], 'cette écriture', 'annuler', '', 'g-A')).toBeNull();
        expect((0, lignes_tenues_1.motifLignesTenues)([module, { ...libre, lettre: 'B', lettrageId: 'g-B' }], 'cette écriture', 'annuler', '', 'g-A')).toMatch(/1 ligne\(s\) .*lettrées \(B\)/);
        expect((0, lignes_tenues_1.motifLignesTenues)([module, { ...libre, rapprochementId: 'r' }], 'cette écriture', 'annuler', '', 'g-A')).toMatch(/pointées/);
        expect((0, lignes_tenues_1.motifLignesTenues)([module], 'cette écriture', 'annuler')).toMatch(/lettrées \(A\)/);
    });
    it('les gestes cités existent tels qu’ils sont décrits', () => {
        const rapprochement = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../rapprochement/rapprochement.controller.ts'), 'utf8');
        expect(rapprochement).toContain("@Post(':id/rouvrir')");
        const service = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../rapprochement/rapprochement.service.ts'), 'utf8');
        expect(service).toContain('Seul le dernier rapprochement clos du compte se rouvre');
        const exercice = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../exercice/exercice.service.ts'), 'utf8');
        expect(exercice).toContain('Cette clôture est définitive et ne peut pas être annulée (Totale/Période)');
    });
});
//# sourceMappingURL=lignes-tenues.spec.js.map