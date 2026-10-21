"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const magasin_service_1 = require("./magasin.service");
function monter(ecritureDuDossier, statut = 'BROUILLARD') {
    const create = jest.fn().mockResolvedValue({ id: 'm1' });
    const findFirstEcriture = jest.fn().mockResolvedValue(ecritureDuDossier ? { id: 'e1', statut, numeroPiece: 4 } : null);
    const prisma = {
        articleStock: { findFirst: jest.fn().mockResolvedValue({ id: 'a1', actif: true, code: 'ART1' }) },
        ecriture: { findFirst: findFirstEcriture },
        mouvementStock: { aggregate: jest.fn().mockResolvedValue({ _max: { ordre: 3 } }), findMany: jest.fn().mockResolvedValue([]), create },
    };
    const service = new magasin_service_1.MagasinService(prisma, {});
    return { service, create, findFirstEcriture };
}
const DTO = { date: '2026-03-01', sens: 'ENTREE', quantite: 5, cout: 100, piece: 'BL-1', ecritureId: 'e1' };
describe('mouvement de magasin et écriture liée', () => {
    it('refuse une écriture absente du dossier, sans rien créer', async () => {
        const m = monter(false);
        await expect(m.service.enregistrerMouvement('t1', 'u', 'a1', DTO)).rejects.toThrow(common_1.BadRequestException);
        expect(m.create).not.toHaveBeenCalled();
        expect(m.findFirstEcriture).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e1', tenantId: 't1' } }));
    });
    it('accepte l’écriture du dossier', async () => {
        const m = monter(true);
        await m.service.enregistrerMouvement('t1', 'u', 'a1', DTO);
        expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ecritureId: 'e1' }) }));
    });
    it('refuse une écriture de situation, qui ne fait entrer aucun bien (ligne sage-l1, relecture B3)', async () => {
        const m = monter(true, 'SITUATION');
        await expect(m.service.enregistrerMouvement('t1', 'u', 'a1', DTO)).rejects.toThrow(/écriture de situation/);
        expect(m.create).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=mouvement-ecriture-du-dossier.spec.js.map