"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const exercice_requis_1 = require("../../common/exercice-requis");
const groupe_service_1 = require("./groupe.service");
function temoin(nom, touches) {
    return new Proxy({}, {
        get: (_cible, modele) => new Proxy((..._args) => {
            touches.push(`${nom}.${String(modele)}`);
            return Promise.reject(new Error(`appel inattendu ${nom}.${String(modele)}`));
        }, {
            get: (_m, operation) => (..._args) => {
                touches.push(`${nom}.${String(modele)}.${String(operation)}`);
                return Promise.reject(new Error(`appel inattendu ${nom}.${String(modele)}.${String(operation)}`));
            },
        }),
    });
}
function service() {
    const touches = [];
    const s = new groupe_service_1.GroupeService(temoin('prisma', touches), temoin('ecritures', touches), temoin('auth', touches), temoin('export', touches));
    return { s, touches };
}
const ENTREES = [
    ['balanceAgregee', (s, e) => s.balanceAgregee('siege', e)],
    ['balanceAgregeeExcel', (s, e) => s.balanceAgregeeExcel('siege', e)],
    ['supervision', (s, e) => s.supervision('siege', e)],
    ['balanceCellule', (s, e) => s.balanceCellule('siege', 'cellule', e)],
    ['liasseGroupe', (s, e) => s.liasseGroupe('siege', e, 'utilisateur')],
];
describe('groupe · l’exercice absent est refusé avant toute lecture (F234, suite)', () => {
    it.each(ENTREES)('%s refuse un exercice absent ou vide par le 400 du porteur, sans rien toucher', async (_nom, appel) => {
        for (const absent of [undefined, '', '   ']) {
            const { s, touches } = service();
            const refus = await appel(s, absent).then(() => null, (e) => e);
            expect(refus).toBeInstanceOf(common_1.BadRequestException);
            expect(refus.message).toBe(exercice_requis_1.MESSAGE_EXERCICE_REQUIS);
            expect(touches).toEqual([]);
        }
    });
    it('le témoin n’est pas muet · un exercice donné atteint bien la base (un garde-fou qui ne voit rien ne garde rien)', async () => {
        const { s, touches } = service();
        await s.supervision('siege', '0b5f9c1e-3a4d-4c2b-9f1e-2a7d6c8b1e30').catch(() => undefined);
        expect(touches.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=exercice-requis-groupe.spec.js.map