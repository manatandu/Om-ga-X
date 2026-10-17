"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const exercice_service_1 = require("./exercice.service");
const ASSOCIATION = { referentiel: 'SYCEBNL', formeJuridiqueSyscohada: null, dateDissolution: null };
const service = (nombreDExercicesExistants, dejaCouvert = null, espion, dossier = ASSOCIATION) => new exercice_service_1.ExerciceService({
    exercice: {
        count: async () => nombreDExercicesExistants,
        findFirst: async (args) => {
            if (espion)
                espion.where = args?.where;
            return dejaCouvert;
        },
        create: async (a) => a,
    },
    tenant: { findUnique: async () => dossier },
}, {});
const creer = (nbExistants, dateDebut, dateFin, liquidation) => service(nbExistants).creer('t1', { dateDebut, dateFin, ...(liquidation ? { liquidation } : {}) });
describe('article 7 · la création d’exercice', () => {
    it('accepte l’année civile', async () => {
        await expect(creer(3, '2026-01-01', '2026-12-31')).resolves.toBeDefined();
    });
    it('refuse un exercice qui ne finit pas un 31 décembre', async () => {
        await expect(creer(0, '2026-03-15', '2026-08-20')).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse à un exercice qui n’est pas le premier de s’écarter de l’année civile', async () => {
        await expect(creer(1, '2026-04-01', '2026-12-31')).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('accepte le premier exercice du premier semestre, plus court que douze mois', async () => {
        await expect(creer(0, '2026-04-01', '2026-12-31')).resolves.toBeDefined();
    });
    it('refuse au premier exercice du premier semestre de déborder sur l’année suivante', async () => {
        await expect(creer(0, '2026-04-01', '2027-12-31')).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('accepte le premier exercice du deuxième semestre, plus long que douze mois', async () => {
        await expect(creer(0, '2026-09-01', '2027-12-31')).resolves.toBeDefined();
        await expect(creer(0, '2026-09-01', '2026-12-31')).resolves.toBeDefined();
    });
    it('refuse un premier exercice de plus de vingt-quatre mois', async () => {
        await expect(creer(0, '2026-09-01', '2028-12-31')).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it("le drapeau de liquidation n'exempte QUE de la règle du 31 décembre", async () => {
        const clos = { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
        await expect(service(3, clos).creer('t1', { dateDebut: '2026-03-15', dateFin: '2028-06-30', liquidation: true })).rejects.toThrow(/CLÔTURÉ couvre déjà cette période/);
    });
    it("ne regarde, pour la liquidation, que les exercices CLÔTURÉS", async () => {
        const espion = {};
        await service(3, null, espion).creer('t1', {
            dateDebut: '2026-03-15',
            dateFin: '2028-06-30',
            liquidation: true,
        });
        expect(espion.where?.statut).toBe('CLOTURE');
    });
    it('laisse passer l’exercice de liquidation, et lui seul', async () => {
        await expect(creer(4, '2026-03-15', '2028-06-30', true)).resolves.toBeDefined();
        await expect(creer(4, '2026-03-15', '2028-06-30')).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
});
describe('article 7 al. 4 · l’exercice de liquidation d’une société dissoute (décision par la loi du 2026-10-07, point 2)', () => {
    const SARL_DISSOUTE = {
        referentiel: 'SYSCOHADA',
        formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE',
        dateDissolution: new Date(Date.UTC(2026, 5, 30)),
    };
    it('court du LENDEMAIN de la dissolution, sans plafond de durée ni fin au 31 décembre', async () => {
        await expect(service(1, null, undefined, SARL_DISSOUTE).creer('t1', { dateDebut: '2026-07-01', dateFin: '2029-03-31', liquidation: true })).resolves.toBeDefined();
        await expect(service(1, null, undefined, SARL_DISSOUTE).creer('t1', { dateDebut: '2026-08-01', dateFin: '2027-03-31', liquidation: true })).rejects.toThrow('le 01/07/2026');
    });
    it('SEUL sur sa période · l’unicité vaut aussi contre un exercice OUVERT, et l’issue est nommée', async () => {
        const ouvert2026 = { dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) };
        const espion = {};
        await expect(service(1, ouvert2026, espion, SARL_DISSOUTE).creer('t1', {
            dateDebut: '2026-07-01',
            dateFin: '2027-03-31',
            liquidation: true,
        })).rejects.toThrow('arrêtez-le d');
        expect(espion.where?.statut).toBeUndefined();
    });
    it('une société sans dissolution déclarée la déclare d’abord ; l’association garde le régime d’avant', async () => {
        await expect(service(1, null, undefined, { ...SARL_DISSOUTE, dateDissolution: null }).creer('t1', {
            dateDebut: '2026-07-01',
            dateFin: '2027-03-31',
            liquidation: true,
        })).rejects.toThrow('Déclarez d’abord la date de dissolution');
        await expect(service(1).creer('t1', { dateDebut: '2026-07-01', dateFin: '2027-03-31', liquidation: true })).resolves.toBeDefined();
    });
});
describe('article 7 · l’exercice engendré par la clôture', () => {
    it('finit toujours un 31 décembre, y compris autour des années bissextiles', () => {
        for (const annee of [2023, 2024, 2025, 2026, 2027, 2028]) {
            const suivant = (0, exercice_service_1.exerciceSuivantApres)(new Date(Date.UTC(annee, 11, 31)));
            expect({
                annee,
                debut: suivant.dateDebut.toISOString().slice(0, 10),
                fin: suivant.dateFin.toISOString().slice(0, 10),
            }).toEqual({
                annee,
                debut: `${annee + 1}-01-01`,
                fin: `${annee + 1}-12-31`,
            });
        }
    });
    it('régularise un exercice hérité qui ne finissait pas un 31 décembre', () => {
        const suivant = (0, exercice_service_1.exerciceSuivantApres)(new Date(Date.UTC(2026, 7, 20)));
        expect(suivant.dateDebut.toISOString().slice(0, 10)).toBe('2026-08-21');
        expect(suivant.dateFin.toISOString().slice(0, 10)).toBe('2026-12-31');
    });
});
//# sourceMappingURL=article-7-annee-civile.spec.js.map