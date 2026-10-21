"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schemas_guide_sycebnl_1 = require("./schemas-guide-sycebnl");
const schemas_guide_syscohada_1 = require("./schemas-guide-syscohada");
const compte_seed_1 = require("../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const rapprochement_guide_plan_1 = require("./rapprochement-guide-plan");
const numeros = (plan) => plan.map((c) => c.numero);
function rapprochable(numero, plan) {
    return ((0, rapprochement_guide_plan_1.racinePlan)(numero, plan) !== null ||
        numero in rapprochement_guide_plan_1.COMPTES_HORS_PLAN ||
        numero in rapprochement_guide_plan_1.COMPTES_ABOLIS_PAR_LA_REVISION);
}
describe('extraction du guide SYCEBNL', () => {
    const plan = numeros(compte_seed_1.PLAN_COMPTES_SYCEBNL);
    it('rend les 96 écritures des 20 applications qui en portent', () => {
        expect(schemas_guide_sycebnl_1.SCHEMAS_GUIDE_SYCEBNL).toHaveLength(96);
        expect(new Set(schemas_guide_sycebnl_1.SCHEMAS_GUIDE_SYCEBNL.map((s) => s.source)).size).toBe(20);
    });
    it('chaque schéma a au moins un débit et un crédit', () => {
        const bancals = schemas_guide_sycebnl_1.SCHEMAS_GUIDE_SYCEBNL.filter((s) => !s.debits.length || !s.credits.length);
        expect(bancals).toEqual([]);
    });
    it('aucun compte inventé · chacun se rattache au plan SYCEBNL', () => {
        const inconnus = [
            ...new Set(schemas_guide_sycebnl_1.SCHEMAS_GUIDE_SYCEBNL.flatMap((s) => [...s.debits, ...s.credits]).filter((n) => !rapprochable(n, plan))),
        ].sort();
        expect(inconnus).toEqual([]);
    });
    it('les subdivisions du guide se rattachent à leur racine', () => {
        expect((0, rapprochement_guide_plan_1.racinePlan)('6011', plan)).toBe('6011');
        expect((0, rapprochement_guide_plan_1.racinePlan)('7961', plan)).toBe('7961');
        expect((0, rapprochement_guide_plan_1.racinePlan)('28442', plan)).toBe('2844');
    });
    it('chaque schéma porte sa preuve · le guide et son application', () => {
        for (const s of schemas_guide_sycebnl_1.SCHEMAS_GUIDE_SYCEBNL) {
            expect(s.source).toMatch(/^SYCEBNL · Application \d+$/);
            expect(s.titre.length).toBeGreaterThan(3);
        }
    });
});
describe('extraction du guide SYSCOHADA', () => {
    const plan = numeros(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA);
    it('rend les 275 écritures des 103 applications qui en portent', () => {
        expect(schemas_guide_syscohada_1.SCHEMAS_GUIDE_SYSCOHADA).toHaveLength(275);
        expect(new Set(schemas_guide_syscohada_1.SCHEMAS_GUIDE_SYSCOHADA.map((s) => s.source)).size).toBe(103);
    });
    it('chaque schéma a au moins un débit et un crédit', () => {
        const bancals = schemas_guide_syscohada_1.SCHEMAS_GUIDE_SYSCOHADA.filter((s) => !s.debits.length || !s.credits.length);
        expect(bancals).toEqual([]);
    });
    it('aucun compte inventé · chacun se rattache au plan SYSCOHADA', () => {
        const inconnus = [
            ...new Set(schemas_guide_syscohada_1.SCHEMAS_GUIDE_SYSCOHADA.flatMap((s) => [...s.debits, ...s.credits]).filter((n) => !rapprochable(n, plan))),
        ].sort();
        expect(inconnus).toEqual([]);
    });
    it('les subdivisions du guide se rattachent à leur racine', () => {
        expect((0, rapprochement_guide_plan_1.racinePlan)('5212', plan)).toBe('521');
        expect((0, rapprochement_guide_plan_1.racinePlan)('23111', plan)).toBe('2311');
    });
    it('les écritures de transition sont marquées, et elles seules', () => {
        const transition = schemas_guide_syscohada_1.SCHEMAS_GUIDE_SYSCOHADA.filter((s) => s.transition);
        expect(transition).toHaveLength(13);
        for (const s of transition)
            expect(s.source).toMatch(/Application 12[3-9]|Application 1[3-9]\d/);
        const courants = schemas_guide_syscohada_1.SCHEMAS_GUIDE_SYSCOHADA.filter((s) => !s.transition);
        expect(courants.length).toBe(schemas_guide_syscohada_1.SCHEMAS_GUIDE_SYSCOHADA.length - 13);
    });
    it('un compte aboli ne se rattache pas à un compte vivant', () => {
        expect((0, rapprochement_guide_plan_1.racinePlan)('6811', plan)).toBeNull();
        expect((0, rapprochement_guide_plan_1.racinePlan)('2011', plan)).toBeNull();
        expect((0, rapprochement_guide_plan_1.racinePlan)('206', plan)).toBeNull();
        expect(Object.keys(rapprochement_guide_plan_1.COMPTES_ABOLIS_PAR_LA_REVISION).sort()).toEqual(['2011', '206', '6811']);
    });
    it('les deux comptes HORS PLAN de l’Application 107 restent nommés', () => {
        expect((0, rapprochement_guide_plan_1.racinePlan)('06', plan)).toBeNull();
        expect((0, rapprochement_guide_plan_1.racinePlan)('07', plan)).toBeNull();
        expect(Object.keys(rapprochement_guide_plan_1.COMPTES_HORS_PLAN).sort()).toEqual(['06', '07']);
    });
});
describe('les deux tables ne se mélangent pas', () => {
    it('elles ne partagent aucune écriture', () => {
        const cle = (s) => `${s.source}|${s.debits.join()}|${s.credits.join()}`;
        const a = new Set(schemas_guide_sycebnl_1.SCHEMAS_GUIDE_SYCEBNL.map(cle));
        const communs = schemas_guide_syscohada_1.SCHEMAS_GUIDE_SYSCOHADA.map(cle).filter((k) => a.has(k));
        expect(communs).toEqual([]);
    });
});
//# sourceMappingURL=schemas-guides.spec.js.map