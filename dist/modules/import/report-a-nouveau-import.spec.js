"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const import_service_1 = require("./import.service");
const compte_seed_1 = require("../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
describe('report à-nouveau · l’import suit les semis, classe par classe', () => {
    const semis = [
        { nom: 'SYCEBNL', referentiel: client_1.Referentiel.SYCEBNL, lignes: compte_seed_1.PLAN_COMPTES_SYCEBNL },
        { nom: 'SYSCOHADA', referentiel: client_1.Referentiel.SYSCOHADA, lignes: compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA },
    ];
    it.each(semis.map((s) => [s.nom, s]))('aucun compte de gestion du semis %s n’est reporté par l’import, et aucun compte de bilan n’est perdu', (_, { referentiel, lignes }) => {
        const divergences = lignes
            .filter((c) => {
            const semisReporte = c.modeReportANouveau !== client_1.ModeReportANouveau.AUCUN;
            const importReporte = (0, import_service_1.modeReportPourClasse)(c.classe, c.numero, referentiel) !== client_1.ModeReportANouveau.AUCUN;
            return semisReporte !== importReporte;
        })
            .map((c) => ({ numero: c.numero, semis: c.modeReportANouveau, import: (0, import_service_1.modeReportPourClasse)(c.classe, c.numero, referentiel) }));
        expect(divergences).toEqual([]);
    });
    it('les classes soldées sur le résultat sont 6, 7 ET 8 · la 8 manquait', () => {
        expect((0, import_service_1.modeReportPourClasse)(client_1.ClasseCompte.CLASSE_6, '60100000', client_1.Referentiel.SYSCOHADA)).toBe(client_1.ModeReportANouveau.AUCUN);
        expect((0, import_service_1.modeReportPourClasse)(client_1.ClasseCompte.CLASSE_7, '70100000', client_1.Referentiel.SYSCOHADA)).toBe(client_1.ModeReportANouveau.AUCUN);
        expect((0, import_service_1.modeReportPourClasse)(client_1.ClasseCompte.CLASSE_8, '81000000', client_1.Referentiel.SYSCOHADA)).toBe(client_1.ModeReportANouveau.AUCUN);
    });
    it('les classes de bilan se reportent, elles', () => {
        for (const c of [client_1.ClasseCompte.CLASSE_1, client_1.ClasseCompte.CLASSE_2, client_1.ClasseCompte.CLASSE_3, client_1.ClasseCompte.CLASSE_4, client_1.ClasseCompte.CLASSE_5]) {
            expect((0, import_service_1.modeReportPourClasse)(c, `${c.slice(-1)}0000000`, client_1.Referentiel.SYSCOHADA)).toBe(client_1.ModeReportANouveau.SOLDE);
        }
    });
    it('un 90 ou un 91 importé ne se reporte pas au SYCEBNL, et se reporte au SYSCOHADA (un numéro, deux sens)', () => {
        expect((0, import_service_1.modeReportPourClasse)(client_1.ClasseCompte.CLASSE_9, '90000000', client_1.Referentiel.SYCEBNL)).toBe(client_1.ModeReportANouveau.AUCUN);
        expect((0, import_service_1.modeReportPourClasse)(client_1.ClasseCompte.CLASSE_9, '91100000', client_1.Referentiel.SYCEBNL)).toBe(client_1.ModeReportANouveau.AUCUN);
        expect((0, import_service_1.modeReportPourClasse)(client_1.ClasseCompte.CLASSE_9, '90100000', client_1.Referentiel.SYSCOHADA)).toBe(client_1.ModeReportANouveau.SOLDE);
    });
});
//# sourceMappingURL=report-a-nouveau-import.spec.js.map