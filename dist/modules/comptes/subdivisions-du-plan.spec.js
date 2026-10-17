"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const compte_seed_1 = require("./compte-seed");
const compte_seed_syscohada_1 = require("./compte-seed-syscohada");
const subdivisions_du_plan_1 = require("./subdivisions-du-plan");
const PLANS = [
    [client_1.Referentiel.SYCEBNL, compte_seed_1.PLAN_COMPTES_SYCEBNL],
    [client_1.Referentiel.SYSCOHADA, compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA],
];
describe('la racine d’un compte semé', () => {
    it('est son numéro officiel, lu dans le plan semé', () => {
        expect((0, subdivisions_du_plan_1.racineDuCompteSeme)(client_1.Referentiel.SYSCOHADA, '52110000')).toBe('5211');
        expect((0, subdivisions_du_plan_1.racineDuCompteSeme)(client_1.Referentiel.SYCEBNL, '57100000')).toBe('571');
        expect((0, subdivisions_du_plan_1.racineDuCompteSeme)(client_1.Referentiel.SYSCOHADA, '57110000')).toBe('5711');
        expect((0, subdivisions_du_plan_1.racineDuCompteSeme)(client_1.Referentiel.SYSCOHADA, '521')).toBeNull();
        expect((0, subdivisions_du_plan_1.racineDuCompteSeme)(client_1.Referentiel.SYSCOHADA, '52110001')).toBeNull();
    });
    it('n’est jamais le numéro dépouillé quand ce dernier est un TOTAL semé · liste gelée', () => {
        const ecarts = (ref, plan) => plan
            .filter((c) => c.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL)
            .filter((c) => (0, subdivisions_du_plan_1.racineDuCompteSeme)(ref, c.numero) !== c.numero.replace(/0+$/, ''))
            .map((c) => `${c.numero}:${(0, subdivisions_du_plan_1.racineDuCompteSeme)(ref, c.numero)}`);
        expect(ecarts(client_1.Referentiel.SYCEBNL, compte_seed_1.PLAN_COMPTES_SYCEBNL)).toEqual([
            '28000000:280',
            '35000000:350',
            '49000000:490',
            '59000000:590',
            '68000000:680',
            '87000000:870',
            '90000000:900',
            '91000000:910',
        ]);
        expect(ecarts(client_1.Referentiel.SYSCOHADA, compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA)).toEqual(['49000000:490', '59000000:590']);
    });
    it('tout compte d’imputation semé en a une, et tout numéro semé se reconnaît', () => {
        for (const [ref, plan] of PLANS) {
            for (const c of plan) {
                expect((0, subdivisions_du_plan_1.estCompteSeme)(ref, c.numero)).toBe(true);
                if (c.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL)
                    expect((0, subdivisions_du_plan_1.racineDuCompteSeme)(ref, c.numero)).not.toBeNull();
            }
        }
    });
});
describe('le compte semé que le dossier subdivise', () => {
    it('est la plus longue racine semée qui préfixe le numéro, si c’est un compte d’imputation', () => {
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYSCOHADA, '52110001')).toBe('52110000');
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYSCOHADA, '5211000001')).toBe('52110000');
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYCEBNL, '57100003')).toBe('57100000');
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYSCOHADA, '41110001')).toBe('41110000');
    });
    it('490 garde les siens et ne prend pas ceux du 491 ni du 499', () => {
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYSCOHADA, '49000001')).toBe('49000000');
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYSCOHADA, '49110001')).toBe('49110000');
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYCEBNL, '90000001')).toBe('90000000');
    });
    it('un numéro rangé sous un TOTAL, ou semé, n’est la subdivision d’aucun compte', () => {
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYSCOHADA, '52120000')).toBeNull();
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYSCOHADA, '52110000')).toBeNull();
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYSCOHADA, '41100001')).toBeNull();
    });
    it('un sous-compte semé sous un compte d’imputation prend les siens · gelé', () => {
        const sous = (ref, plan) => plan
            .filter((c) => c.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL)
            .filter((c) => (0, subdivisions_du_plan_1.racinesSousLeCompteSeme)(ref, c.numero).length > 0)
            .map((c) => `${c.numero}:${(0, subdivisions_du_plan_1.racinesSousLeCompteSeme)(ref, c.numero).sort().join(',')}`);
        expect(sous(client_1.Referentiel.SYCEBNL, compte_seed_1.PLAN_COMPTES_SYCEBNL)).toEqual([
            '44780000:44781,44782,44783,44784,44785',
            '83100000:8311,8315',
            '84100000:8411,8412,8415',
        ]);
        expect(sous(client_1.Referentiel.SYSCOHADA, compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA)).toEqual([]);
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYCEBNL, '83110001')).toBe('83110000');
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYCEBNL, '83190001')).toBe('83100000');
    });
});
//# sourceMappingURL=subdivisions-du-plan.spec.js.map