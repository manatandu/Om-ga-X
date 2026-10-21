"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const restitution_controller_1 = require("./restitution.controller");
const restitution_service_1 = require("./restitution.service");
const JOUR = new Date('2026-09-28T10:00:00Z');
const DOSSIERS = {
    'd-1': { id: 'd-1', nom: 'ASBL Espoir' },
    'd-2': { id: 'd-2', nom: 'ASBL Espoir' },
};
function prismaFactice() {
    return {
        tenant: {
            findUnique: jest.fn(({ where }) => Promise.resolve(DOSSIERS[where.id] ?? null)),
        },
    };
}
function reponse() {
    const entetes = {};
    const res = {
        set: jest.fn((valeurs) => Object.assign(entetes, valeurs)),
    };
    return { res, entetes };
}
async function nomServi(tenantId) {
    const service = new restitution_service_1.RestitutionService(prismaFactice());
    jest.spyOn(service, 'produire').mockResolvedValue(undefined);
    const controleur = new restitution_controller_1.RestitutionController(service);
    const { res, entetes } = reponse();
    await controleur.archive({ tenantId, userId: 'u-1', email: 'chef@asbl.cd' }, { ip: '127.0.0.1' }, res);
    const disposition = entetes['Content-Disposition'];
    const m = /filename="([^"]+)"/.exec(disposition);
    if (!m)
        throw new Error(`Content-Disposition illisible · ${disposition}`);
    return m[1];
}
describe('le nom de l’archive de restitution (audit final F225)', () => {
    it('le contrôleur sert deux noms différents à deux dossiers de même dénomination', async () => {
        const [premier, second] = await Promise.all([nomServi('d-1'), nomServi('d-2')]);
        expect(premier).not.toBe(second);
        expect(premier).toContain('d-1');
        expect(second).toContain('d-2');
        expect(premier).toMatch(/^restitution-asbl-espoir-/);
    });
    it('le nom servi est celui que le service calcule pour ce dossier', async () => {
        const avant = new Date();
        const servi = await nomServi('d-1');
        const apres = new Date();
        expect([(0, restitution_service_1.nomDeLArchive)(DOSSIERS['d-1'], avant), (0, restitution_service_1.nomDeLArchive)(DOSSIERS['d-1'], apres)]).toContain(servi);
    });
    it('dénomination, identifiant et jour, en caractères sûrs pour un en-tête', () => {
        expect((0, restitution_service_1.nomDeLArchive)({ id: 'd-1', nom: 'ASBL Espoir' }, JOUR)).toBe('restitution-asbl-espoir-d-1-2026-09-28.zip');
        const nom = (0, restitution_service_1.nomDeLArchive)({ id: 'd-1', nom: 'Église "Évangélique"\nde Goma' }, JOUR);
        expect(nom).toBe('restitution-eglise-evangelique-de-goma-d-1-2026-09-28.zip');
        expect(nom).toMatch(/^[a-z0-9.-]+$/);
    });
    it('une dénomination qui se réduit à rien garde l’identifiant, jamais un nom vide', () => {
        expect((0, restitution_service_1.nomDeLArchive)({ id: 'd-9', nom: '联合会' }, JOUR)).toBe('restitution-d-9-2026-09-28.zip');
    });
    it('un dossier introuvable est un refus nommé, avant tout en-tête', async () => {
        const service = new restitution_service_1.RestitutionService(prismaFactice());
        await expect(service.nomDeLArchive('d-inconnu', JOUR)).rejects.toBeInstanceOf(common_1.NotFoundException);
        const produire = jest.spyOn(service, 'produire').mockResolvedValue(undefined);
        const { res } = reponse();
        await expect(new restitution_controller_1.RestitutionController(service).archive({ tenantId: 'd-inconnu', userId: 'u-1', email: 'chef@asbl.cd' }, { ip: '127.0.0.1' }, res)).rejects.toBeInstanceOf(common_1.NotFoundException);
        expect(res.set).not.toHaveBeenCalled();
        expect(produire).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=restitution-nom.spec.js.map