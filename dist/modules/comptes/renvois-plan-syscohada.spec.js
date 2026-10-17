"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const compte_seed_syscohada_1 = require("./compte-seed-syscohada");
const renvois_plan_syscohada_1 = require("./renvois-plan-syscohada");
const compte_service_1 = require("./compte.service");
describe('renvois annexés au plan SYSCOHADA', () => {
    it('chaque marqueur du semis a son texte · aucun n’est orphelin', () => {
        const marqueurs = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.flatMap((l) => [...l.intitule.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
        expect(marqueurs.length).toBeGreaterThan(20);
        for (const n of new Set(marqueurs))
            expect([n, typeof renvois_plan_syscohada_1.RENVOIS_PLAN_SYSCOHADA[n]]).toEqual([n, 'string']);
        expect(Object.keys(renvois_plan_syscohada_1.RENVOIS_PLAN_SYSCOHADA).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
    it('le renvoi [8] suit les 7072, 7073, 7075 et 7076, et dit le 706', () => {
        const huit = (0, renvois_plan_syscohada_1.renvoisDuPlanSyscohada)().filter((r) => r.renvoi === 8).map((r) => r.numero);
        expect(huit.sort()).toEqual(['70720000', '70730000', '70750000', '70760000']);
        expect(renvois_plan_syscohada_1.RENVOIS_PLAN_SYSCOHADA[8]).toBe("À inscrire au compte 706 si ces produits correspondent à une activité principale de l'entité.");
    });
    it('le serveur ne sert les renvois qu’à un dossier SYSCOHADA', async () => {
        const service = (referentiel) => new compte_service_1.CompteService({
            tenant: {
                findFirst: jest.fn(({ where }) => Promise.resolve(where.id === 't' ? { referentiel } : null)),
            },
        });
        expect((await service(client_1.Referentiel.SYSCOHADA).renvoisDuPlan('t')).length).toBeGreaterThan(20);
        expect(await service(client_1.Referentiel.SYCEBNL).renvoisDuPlan('t')).toEqual([]);
        expect(await service(client_1.Referentiel.SYSCOHADA).renvoisDuPlan('autre')).toEqual([]);
    });
});
//# sourceMappingURL=renvois-plan-syscohada.spec.js.map