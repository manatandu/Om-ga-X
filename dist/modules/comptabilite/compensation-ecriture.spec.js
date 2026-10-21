"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const ecriture_service_1 = require("./ecriture.service");
function monter(options = {}) {
    const ordre = [];
    let lignesPresentes = true;
    const prisma = {
        ecriture: {
            findFirst: jest.fn().mockResolvedValue({ id: 'e1' }),
            delete: jest.fn().mockImplementation(async () => {
                if (lignesPresentes)
                    throw new Error('P2003 · lignes_ecriture RESTRICT');
                ordre.push('tete');
            }),
        },
        ligneEcriture: {
            deleteMany: jest.fn().mockImplementation(async () => {
                if (options.echecLignes)
                    throw new Error('base indisponible');
                lignesPresentes = false;
                ordre.push('lignes');
            }),
        },
    };
    prisma.$transaction = jest.fn().mockImplementation((f) => f(prisma));
    const service = new ecriture_service_1.EcritureService(prisma, {}, {}, {});
    return { service, ordre };
}
describe('compensation d’une écriture', () => {
    it('retire les lignes PUIS la tête', async () => {
        const m = monter();
        await m.service.retirerCompensation('t1', 'e1');
        expect(m.ordre).toEqual(['lignes', 'tete']);
    });
    it('le lien du module appelant se dénoue en premier, dans la transaction', async () => {
        const m = monter();
        await m.service.retirerCompensation('t1', 'e1', async () => {
            m.ordre.push('liberer');
        });
        expect(m.ordre).toEqual(['liberer', 'lignes', 'tete']);
    });
    it('un échec remonte, il ne se tait jamais', async () => {
        const m = monter({ echecLignes: true });
        await expect(m.service.retirerCompensation('t1', 'e1')).rejects.toThrow('base indisponible');
    });
    it('la liquidation de TVA et la facturation compensent par elle, sans avaler', () => {
        const lire = (f) => (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', f), 'utf8');
        const tva = lire('tva/taux-tva.service.ts');
        const catchTva = tva.slice(tva.indexOf('} catch (e) {', tva.indexOf('this.prisma.liquidationTva.create')));
        expect(catchTva.slice(0, catchTva.indexOf('throw e;'))).toContain('this.ecritureService.retirerCompensation(tenantId, ecriture.id)');
        expect(catchTva.slice(0, catchTva.indexOf('throw e;'))).not.toContain('.catch(');
        const fac = lire('facturation/comptabilisation-facture.service.ts');
        const bloc = fac.slice(fac.indexOf('if (count === 0) {'), fac.indexOf('}', fac.indexOf('if (count === 0) {')));
        expect(bloc).toContain('this.ecritures.retirerCompensation(tenantId, e.id)');
    });
});
//# sourceMappingURL=compensation-ecriture.spec.js.map