"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const journal_service_1 = require("./journal.service");
function monter(type) {
    const update = jest.fn(async (a) => a);
    const prisma = {
        journal: {
            findFirst: jest.fn(async () => ({ id: 'j', code: 'X', type, compteTresorerieId: type === 'TRESORERIE' ? 'c' : null })),
            update,
        },
    };
    return { service: new journal_service_1.JournalService(prisma), update };
}
describe('contrepartie à chaque ligne', () => {
    it('se coche sur un journal de trésorerie', async () => {
        const { service, update } = monter('TRESORERIE');
        await service.modifier('t', 'j', { contrepartieChaqueLigne: true });
        expect(update).toHaveBeenCalledWith({ where: { id: 'j' }, data: { contrepartieChaqueLigne: true } });
    });
    it('est refusée sur un journal d’achats', async () => {
        const { service, update } = monter('ACHATS');
        await expect(service.modifier('t', 'j', { contrepartieChaqueLigne: true })).rejects.toThrow(common_1.BadRequestException);
        expect(update).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=contrepartie-chaque-ligne.spec.js.map