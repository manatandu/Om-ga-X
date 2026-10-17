"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const export_controller_1 = require("../exports/export.controller");
const etats_financiers_controller_1 = require("./etats-financiers.controller");
const user = { tenantId: 't1' };
const res = () => ({ set: jest.fn(), send: jest.fn() });
const classeur = { buffer: Buffer.from(''), nomFichier: 'x.xlsx' };
describe('Repère H · câblage des portes (audit final F13)', () => {
    it('l’écran passe « non renseigné » au service, et un montant tel quel', async () => {
        const budget = { reconciliationTresorerie: jest.fn().mockResolvedValue({}) };
        const ctl = new etats_financiers_controller_1.EtatsFinanciersController({}, {}, {}, budget);
        await ctl.reconciliationTresorerie(user, 'ex', undefined);
        await ctl.reconciliationTresorerie(user, 'ex', '0');
        expect(budget.reconciliationTresorerie.mock.calls.map((c) => c[2])).toEqual([null, 0]);
    });
    it('les deux exports passent « non renseigné », et refusent l’illisible avant tout calcul', async () => {
        const svc = {
            reconciliationTresorerieExcel: jest.fn().mockResolvedValue(classeur),
            liasseCompleteExcel: jest.fn().mockResolvedValue(classeur),
        };
        const ctl = new export_controller_1.ExportController(svc, {}, {}, {});
        await ctl.reconciliationTresorerie(user, res(), 'ex', undefined);
        await ctl.liasseComplete(user, res(), 'ex', '');
        await expect(ctl.liasseComplete(user, res(), 'ex', 'mille')).rejects.toThrow(/illisibles/);
        expect({
            tableau: svc.reconciliationTresorerieExcel.mock.calls.map((c) => c[2]),
            liasse: svc.liasseCompleteExcel.mock.calls.map((c) => c[2]),
        }).toEqual({ tableau: [null], liasse: [null] });
    });
});
//# sourceMappingURL=paiements-en-instance-cablage.spec.js.map