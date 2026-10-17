"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const ecriture_service_1 = require("./ecriture.service");
const COMPTES = [
    { id: 'actif', numero: '60110000', estActif: true, tenantId: 't1' },
    { id: 'dort', numero: '62400000', estActif: false, tenantId: 't1' },
    { id: 'dortAilleurs', numero: '62500000', estActif: false, tenantId: 't2' },
];
const prisma = {
    compte: {
        findMany: jest.fn(async ({ where }) => COMPTES.filter((c) => where.id.in.includes(c.id) && c.tenantId === where.tenantId && c.estActif === where.estActif).map((c) => ({ numero: c.numero }))),
    },
};
const service = new ecriture_service_1.EcritureService(prisma, {}, {}, {});
describe('compte en sommeil · la saisie se confirme', () => {
    it('refuse sans confirmation, en nommant le compte', async () => {
        await expect(service.verifierComptesEnSommeil('t1', [{ compteId: 'actif' }, { compteId: 'dort' }], undefined)).rejects.toThrow(new common_1.BadRequestException('Compte en sommeil : 62400000 · confirmez la saisie ou réactivez le compte dans le plan comptable.'));
    });
    it('laisse passer une fois la saisie confirmée', async () => {
        await expect(service.verifierComptesEnSommeil('t1', [{ compteId: 'dort' }], true)).resolves.toBeUndefined();
    });
    it('ne dit rien sur des comptes actifs, ni sur le compte endormi d’un autre dossier', async () => {
        await expect(service.verifierComptesEnSommeil('t1', [{ compteId: 'actif' }], undefined)).resolves.toBeUndefined();
        await expect(service.verifierComptesEnSommeil('t1', [{ compteId: 'dortAilleurs' }], undefined)).resolves.toBeUndefined();
    });
    it('une modification sans lignes n’est pas concernée', async () => {
        await expect(service.verifierComptesEnSommeil('t1', undefined, undefined)).resolves.toBeUndefined();
    });
    const controleur = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'ecriture.controller.ts'), 'utf8');
    it('POST et PATCH /ecritures vérifient avant d’écrire', () => {
        const appels = controleur.match(/verifierComptesEnSommeil\(user\.tenantId, dto\.lignes, dto\.confirmerComptesEnSommeil\)/g);
        expect(appels).toHaveLength(2);
    });
});
//# sourceMappingURL=compte-en-sommeil.spec.js.map