"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const exercice_service_1 = require("./exercice.service");
const lire = (p) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, p), 'utf8');
describe('clôture · vocabulaire du compte 13', () => {
    it('nomme le résultat comme le plan du dossier le nomme', () => {
        const sycebnl = (0, exercice_service_1.libellesResultat)(client_1.Referentiel.SYCEBNL);
        expect(sycebnl.excedent).toBe("Excédent de l'exercice (131)");
        expect(sycebnl.deficit).toBe("Déficit de l'exercice (139)");
        expect(sycebnl.ligneExcedent).toBe("Excédent de l'exercice");
        const syscohada = (0, exercice_service_1.libellesResultat)(client_1.Referentiel.SYSCOHADA);
        expect(syscohada.excedent).toBe('Résultat net : bénéfice (131)');
        expect(syscohada.deficit).toBe('Résultat net : perte (139)');
        expect(syscohada.ligneExcedent).toBe("Bénéfice net de l'exercice");
        expect(syscohada.ligneDeficit).toBe("Perte nette de l'exercice");
    });
    it('nomme le bon plan dans le message d’erreur de configuration', () => {
        expect((0, exercice_service_1.libellesResultat)(client_1.Referentiel.SYCEBNL).plan).toBe('SYCEBNL');
        expect((0, exercice_service_1.libellesResultat)(client_1.Referentiel.SYSCOHADA).plan).toBe('SYSCOHADA');
    });
    it('reprend mot pour mot l’intitulé semé dans chaque plan', () => {
        const sycebnl = lire('../comptes/compte-seed.ts');
        expect(sycebnl).toContain(`['13100000', "${(0, exercice_service_1.libellesResultat)(client_1.Referentiel.SYCEBNL).ligneExcedent}"]`);
        expect(sycebnl).toContain(`['13900000', "${(0, exercice_service_1.libellesResultat)(client_1.Referentiel.SYCEBNL).ligneDeficit}"]`);
        const syscohada = lire('../comptes/compte-seed-syscohada.ts');
        expect(syscohada).toContain("d('13100000', 'Résultat net : bénéfice'");
        expect(syscohada).toContain("d('13900000', 'Résultat net : perte'");
    });
    it('n’écrit plus aucun libellé de résultat en dur dans la clôture', () => {
        const service = lire('./exercice.service.ts');
        const apresLaFonction = service.slice(service.indexOf('@Injectable()'));
        expect(apresLaFonction).not.toMatch(/"Excédent de l'exercice/);
        expect(apresLaFonction).not.toMatch(/"Déficit de l'exercice/);
        expect(apresLaFonction).toContain('mots.ligneDeficit');
        expect(apresLaFonction).toContain('libellesResultat(referentiel)');
    });
    it('garde les mêmes NUMÉROS des deux côtés · seuls les mots changent', () => {
        const service = lire('./exercice.service.ts');
        expect(service).toContain("deficitaire ? '13900000' : '13100000'");
        expect(service).not.toContain('13010000');
        expect(service).not.toContain('13090000');
    });
});
//# sourceMappingURL=cloture-vocabulaire.spec.js.map