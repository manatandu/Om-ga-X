"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const compte_service_1 = require("./compte.service");
const creer_compte_dto_1 = require("./dto/creer-compte.dto");
const classe_du_numero_1 = require("./classe-du-numero");
const compte_seed_1 = require("./compte-seed");
const compte_seed_syscohada_1 = require("./compte-seed-syscohada");
function harnais() {
    const crees = [];
    const p = {
        tenant: { findUniqueOrThrow: jest.fn(async () => ({ longueurCompte: 8 })) },
        natureCompte: {
            findMany: jest.fn(async () => [{ nature: 'CHARGES', fourchettes: [], modeReportANouveau: 'AUCUN', lettrable: false }]),
            createMany: jest.fn(async () => ({ count: 0 })),
        },
        compte: {
            findUnique: jest.fn(async () => null),
            create: jest.fn(async ({ data }) => {
                crees.push(data);
                return data;
            }),
        },
    };
    return { svc: new compte_service_1.CompteService(p), crees };
}
describe('F40 · la règle, écrite une fois', () => {
    it('le premier chiffre du numéro donne la classe', () => {
        expect((0, classe_du_numero_1.classeDuNumero)('60110000')).toBe('CLASSE_6');
        expect((0, classe_du_numero_1.classeDuNumero)('9')).toBe('CLASSE_9');
        expect((0, classe_du_numero_1.classeDuNumero)('0123')).toBeNull();
        expect((0, classe_du_numero_1.classeDuNumero)('')).toBeNull();
    });
    it('les deux plans semés la respectent sans exception', () => {
        for (const plan of [compte_seed_1.PLAN_COMPTES_SYCEBNL, compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA]) {
            const ecarts = plan.filter((c) => c.classe !== (0, classe_du_numero_1.classeDuNumero)(c.numero)).map((c) => c.numero);
            expect(ecarts).toEqual([]);
        }
    });
});
describe('F40 · la création range le compte dans la classe de son numéro', () => {
    it('sans classe envoyée, un 6xxx est en classe 6', async () => {
        const { svc, crees } = harnais();
        await svc.creer('t1', { numero: '60110010', intitule: 'Achats de riz' });
        expect(crees).toEqual([expect.objectContaining({ numero: '60110010', classe: 'CLASSE_6' })]);
    });
    it('une classe envoyée qui contredit le numéro est refusée, rien n’est créé', async () => {
        const { svc, crees } = harnais();
        await expect(svc.creer('t1', { numero: '60110010', intitule: 'x', classe: 'CLASSE_1' })).rejects.toThrow(/est de la classe 6/);
        expect(crees).toEqual([]);
    });
    it('une classe envoyée qui concorde est acceptée', async () => {
        const { svc, crees } = harnais();
        await svc.creer('t1', { numero: '41110010', intitule: 'Client A', classe: 'CLASSE_4' });
        expect(crees[0]).toMatchObject({ classe: 'CLASSE_4' });
    });
    it('un numéro qui commence par 0 n’a pas de classe · refusé', async () => {
        const { svc, crees } = harnais();
        await expect(svc.creer('t1', { numero: '0123', intitule: 'x' })).rejects.toThrow(/chiffre de classe/);
        expect(crees).toEqual([]);
    });
});
describe('F40 · la porte n’exige plus la classe', () => {
    it('le DTO valide sans classe, et refuse une classe inconnue', async () => {
        const sans = (0, class_transformer_1.plainToInstance)(creer_compte_dto_1.CreerCompteDto, { numero: '601', intitule: 'x' });
        const inconnue = (0, class_transformer_1.plainToInstance)(creer_compte_dto_1.CreerCompteDto, { numero: '601', intitule: 'x', classe: 'CLASSE_0' });
        expect(await (0, class_validator_1.validate)(sans)).toEqual([]);
        expect((await (0, class_validator_1.validate)(inconnue)).map((e) => e.property)).toEqual(['classe']);
    });
});
//# sourceMappingURL=classe-du-numero-f40.spec.js.map