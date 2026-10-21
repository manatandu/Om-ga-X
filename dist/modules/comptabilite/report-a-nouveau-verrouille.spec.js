"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const ecriture_service_1 = require("./ecriture.service");
const OUVERT = { statut: 'OUVERT', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };
function monter(ecriture, premierId) {
    const prisma = {
        ecriture: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'e1', tenantId: 't1', statut: 'BROUILLARD', lignes: [], journal: {}, exercice: OUVERT, ...ecriture,
            }),
            delete: jest.fn().mockResolvedValue({}),
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        exercice: { findFirst: jest.fn().mockResolvedValue({ id: premierId }) },
        ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({}) },
        pieceJointeEcriture: { count: jest.fn().mockResolvedValue(0) },
        $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const avecComptages = new Proxy(prisma, {
        get: (cible, cle) => cible[cle] ?? { count: jest.fn().mockResolvedValue(0) },
    });
    prisma.$transaction = jest.fn().mockImplementation((f) => f(prisma));
    const service = new ecriture_service_1.EcritureService(avecComptages, {}, {}, {});
    return { service, prisma };
}
describe('report à-nouveau et journal', () => {
    it('supprimer refuse le report d’un exercice qui n’est pas le premier, en le nommant', async () => {
        const { service, prisma } = monter({ exerciceId: 'ex2027', estGenereeParCloture: true }, 'ex2026');
        await expect(service.supprimer('t1', 'e1')).rejects.toThrow(common_1.ForbiddenException);
        await expect(service.supprimer('t1', 'e1')).rejects.toThrow(/report à-nouveau/);
        expect(prisma.ecriture.deleteMany).not.toHaveBeenCalled();
    });
    it('modifier le refuse de même', async () => {
        const { service } = monter({ exerciceId: 'ex2027', estGenereeParCloture: true }, 'ex2026');
        await expect(service.modifier('t1', 'e1', { lignes: [] })).rejects.toThrow(/report à-nouveau/);
    });
    it('le bilan d’ouverture du PREMIER exercice reste retouchable', async () => {
        const { service } = monter({ exerciceId: 'ex2026', estGenereeParCloture: true }, 'ex2026');
        await expect(service.supprimer('t1', 'e1')).resolves.toEqual({ supprime: true, piecesDetachees: 0 });
    });
});
//# sourceMappingURL=report-a-nouveau-verrouille.spec.js.map