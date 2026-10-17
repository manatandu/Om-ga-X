"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const lots_virement_1 = require("./lots-virement");
const lots_virement_service_1 = require("./lots-virement.service");
const c = (id, numero, typeCompte = 'DETAIL') => ({ id, numero, typeCompte });
describe('Lot de virements · la règle', () => {
    const comptes = [c('f1', '40110001'), c('f2', '40110002'), c('fnp', '40810000'), c('av', '40910000'), c('cl', '41110001'), c('tot', '401', 'TOTAL')];
    it('accepte des fournisseurs réglables avec un montant', () => {
        expect((0, lots_virement_1.motifRefusLot)('Loyers', [{ compteId: 'f1', montant: 1500 }, { compteId: 'f2', montant: 250.5 }], comptes)).toBeNull();
    });
    it('refuse le 408 et le 409 · ni une facture non parvenue ni une avance ne se règlent', () => {
        expect((0, lots_virement_1.motifRefusLot)('X', [{ compteId: 'fnp', montant: 10 }], comptes)).toMatch(/408/);
        expect((0, lots_virement_1.motifRefusLot)('X', [{ compteId: 'av', montant: 10 }], comptes)).toMatch(/409/);
    });
    it('refuse un compte client · un virement règle une dette fournisseur', () => {
        expect((0, lots_virement_1.motifRefusLot)('X', [{ compteId: 'cl', montant: 10 }], comptes)).toMatch(/fournisseur/);
    });
    it('refuse un compte Total, un doublon, un montant nul ou à trois décimales', () => {
        expect((0, lots_virement_1.motifRefusLot)('X', [{ compteId: 'tot', montant: 10 }], comptes)).toMatch(/Total/);
        expect((0, lots_virement_1.motifRefusLot)('X', [{ compteId: 'f1', montant: 10 }, { compteId: 'f1', montant: 5 }], comptes)).toMatch(/qu’une fois/);
        expect((0, lots_virement_1.motifRefusLot)('X', [{ compteId: 'f1', montant: 0 }], comptes)).toMatch(/positif/);
        expect((0, lots_virement_1.motifRefusLot)('X', [{ compteId: 'f1', montant: 1.005 }], comptes)).toMatch(/décimales/);
    });
    it.each([19.99, 1.1, 1234.1, 0.07])('accepte %p, qui a deux décimales', (montant) => {
        expect((0, lots_virement_1.motifRefusLot)('X', [{ compteId: 'f1', montant }], comptes)).toBeNull();
    });
    it('refuse un lot sans nom, sans ligne, ou un compte d’un autre dossier', () => {
        expect((0, lots_virement_1.motifRefusLot)(' ', [{ compteId: 'f1', montant: 1 }], comptes)).toMatch(/nom/);
        expect((0, lots_virement_1.motifRefusLot)('X', [], comptes)).toMatch(/au moins/);
        expect((0, lots_virement_1.motifRefusLot)('X', [{ compteId: 'ailleurs', montant: 1 }], comptes)).toMatch(/introuvable/);
    });
});
describe('Lot de virements · le service', () => {
    const faire = () => {
        const prisma = {
            compte: { findMany: jest.fn().mockResolvedValue([c('f1', '40110001')]) },
            journal: { findFirst: jest.fn().mockResolvedValue({ type: 'TRESORERIE' }) },
            lotVirement: {
                create: jest.fn().mockResolvedValue({ id: 'l1' }),
                findFirst: jest.fn().mockResolvedValue({ id: 'l1', tenantId: 't' }),
                update: jest.fn().mockResolvedValue({ id: 'l1' }),
            },
            ligneLotVirement: { deleteMany: jest.fn().mockResolvedValue({}) },
            $transaction: jest.fn(),
        };
        prisma.$transaction.mockImplementation((f) => f(prisma));
        return { svc: new lots_virement_service_1.LotsVirementService(prisma), prisma };
    };
    it('lit les comptes DANS LE DOSSIER et enregistre les lignes avec leur ordre', async () => {
        const { svc, prisma } = faire();
        await svc.creer('t', 'moi@x.cd', { nom: ' Loyers ', lignes: [{ compteId: 'f1', montant: 1500 }] });
        expect(prisma.compte.findMany.mock.calls[0][0].where.tenantId).toBe('t');
        const data = prisma.lotVirement.create.mock.calls[0][0].data;
        expect(data.nom).toBe('Loyers');
        expect(data.lignes.create).toEqual([{ tenantId: 't', compteId: 'f1', montant: new client_1.Prisma.Decimal(1500), ordre: 1 }]);
    });
    it('refuse avant d’écrire, et refuse un journal qui n’est pas de trésorerie', async () => {
        const { svc, prisma } = faire();
        await expect(svc.creer('t', 'm', { nom: 'X', lignes: [{ compteId: 'f1', montant: 0 }] })).rejects.toBeInstanceOf(common_1.BadRequestException);
        prisma.journal.findFirst.mockResolvedValue({ type: 'ACHATS' });
        await expect(svc.creer('t', 'm', { nom: 'X', journalId: 'j', lignes: [{ compteId: 'f1', montant: 5 }] })).rejects.toThrow(/trésorerie/);
        expect(prisma.lotVirement.create).not.toHaveBeenCalled();
    });
    it('la modification remplace les lignes, bornées au dossier', async () => {
        const { svc, prisma } = faire();
        await svc.modifier('t', 'l1', { nom: 'Loyers', lignes: [{ compteId: 'f1', montant: 1600 }] });
        expect(prisma.ligneLotVirement.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't', lotId: 'l1' } });
    });
});
//# sourceMappingURL=lots-virement.spec.js.map