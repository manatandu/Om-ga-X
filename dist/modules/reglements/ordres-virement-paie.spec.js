"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const ordres_virement_service_1 = require("./ordres-virement.service");
const ORDRES = [
    { id: 'o1', tenantId: 'd', numero: 1, statut: 'A_IMPRIMER', lignes: [{ salarieId: null }] },
    { id: 'o2', tenantId: 'd', numero: 2, statut: 'A_IMPRIMER', lignes: [{ salarieId: 's1' }, { salarieId: 's2' }] },
    { id: 'o3', tenantId: 'd', numero: 3, statut: 'IMPRIME', lignes: [{ salarieId: null }] },
];
function prismaFactice() {
    const garde = (w) => ORDRES.filter((o) => o.tenantId === w.tenantId &&
        (w.id === undefined || o.id === w.id) &&
        (w.statut === undefined || o.statut === w.statut) &&
        (w.lignes === undefined || o.lignes.every((l) => l.salarieId === null)));
    return {
        ordreVirement: {
            findMany: jest.fn(async ({ where, take }) => garde(where).sort((a, b) => b.numero - a.numero).slice(0, take)),
            count: jest.fn(async ({ where }) => garde(where).length),
            findFirst: jest.fn(async ({ where }) => garde(where)[0] ?? null),
        },
    };
}
describe('les ordres de salaires et le personnel fermé', () => {
    it('ouvert, la liste rend tout ; fermé, elle exclut les ordres de salaires de la liste et des décomptes', async () => {
        const service = new ordres_virement_service_1.OrdresVirementService(prismaFactice());
        const ouvert = await service.lister('d');
        expect(ouvert.ordres.map((o) => o.numero)).toEqual([3, 2, 1]);
        expect([ouvert.total, ouvert.enAttenteImpression]).toEqual([3, 2]);
        const ferme = await service.lister('d', undefined, false);
        expect(ferme.ordres.map((o) => o.numero)).toEqual([3, 1]);
        expect([ferme.total, ferme.enAttenteImpression, ferme.tronque]).toEqual([2, 1, false]);
    });
    it('fermé, le détail, l’impression et l’annulation d’un ordre de salaires sont refusés ; un ordre de tiers se lit', async () => {
        const service = new ordres_virement_service_1.OrdresVirementService(prismaFactice());
        await expect(service.detail('d', 'o2', false)).rejects.toBeInstanceOf(common_1.ForbiddenException);
        await expect(service.imprimer('d', 'o2', 'x@y.cd', false)).rejects.toBeInstanceOf(common_1.ForbiddenException);
        await expect(service.annuler('d', 'o2', 'x@y.cd', 'motif', false)).rejects.toBeInstanceOf(common_1.ForbiddenException);
        await expect(service.detail('d', 'o1', false)).resolves.toMatchObject({ numero: 1 });
        await expect(service.detail('d', 'o2')).resolves.toMatchObject({ numero: 2 });
    });
});
//# sourceMappingURL=ordres-virement-paie.spec.js.map