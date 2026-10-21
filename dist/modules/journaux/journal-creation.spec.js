"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const journal_service_1 = require("./journal.service");
const COMPTES = [
    { id: 'banque', tenantId: 't1', numero: '52110000', typeCompte: 'DETAIL', estRetenu: true },
    { id: 'banque-bq', tenantId: 't1', numero: '52120000', typeCompte: 'DETAIL', estRetenu: true },
    { id: 'banque-voisin', tenantId: 't2', numero: '52110000', typeCompte: 'DETAIL', estRetenu: true },
    { id: 'charge', tenantId: 't1', numero: '60500000', typeCompte: 'DETAIL', estRetenu: true },
    { id: 'total-52', tenantId: 't1', numero: '52', typeCompte: 'TOTAL', estRetenu: true },
];
function monde() {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'j-neuf', ...data }));
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'j1', ...data }));
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA' })) },
        journal: {
            findUnique: jest.fn().mockResolvedValue(null),
            findFirst: jest.fn().mockImplementation(({ where }) => {
                const j1 = { id: 'j1', tenantId: 't1', code: 'BQ', type: 'TRESORERIE', compteTresorerieId: 'banque-bq' };
                if (where.compteTresorerieId === undefined)
                    return Promise.resolve(j1);
                const exclu = typeof where.id === 'object' ? where.id.not : null;
                return Promise.resolve(where.compteTresorerieId === j1.compteTresorerieId && exclu !== j1.id ? j1 : null);
            }),
            create,
            update,
        },
        compte: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(COMPTES.find((c) => c.id === where.id && c.tenantId === where.tenantId) ?? null)),
            findMany: jest.fn(async ({ where }) => COMPTES.filter((c) => c.tenantId === where.tenantId && where.id.in.includes(c.id) && (where.estRetenu === undefined || c.estRetenu === where.estRetenu))),
        },
    };
    return { svc: new journal_service_1.JournalService(prisma), create, update, prisma };
}
describe('F59 · un journal créé sans choix est numéroté en continu', () => {
    it('sans numérotation demandée, la continue par journal', async () => {
        const { svc, create } = monde();
        await svc.creer('t1', { code: 'ACH2', intitule: 'Achats', type: 'ACHATS' });
        expect(create.mock.calls[0][0].data.numerotation).toBe(client_1.NumerotationPiece.CONTINUE_JOURNAL);
    });
    it('la manuelle reste un choix', async () => {
        const { svc, create } = monde();
        await svc.creer('t1', { code: 'ACH2', intitule: 'Achats', type: 'ACHATS', numerotation: 'MANUELLE' });
        expect(create.mock.calls[0][0].data.numerotation).toBe(client_1.NumerotationPiece.MANUELLE);
    });
    it('le défaut de la base est le même', () => {
        const schema = require('fs').readFileSync(require('path').join(__dirname, '../../../prisma/schema.prisma'), 'utf8');
        expect(schema).toMatch(/numerotation NumerotationPiece @default\(CONTINUE_JOURNAL\)/);
    });
});
describe('F60 · le compte de trésorerie d’un journal', () => {
    const tresorerie = (compteTresorerieId) => ({ code: 'BQ2', intitule: 'Banque 2', type: 'TRESORERIE', compteTresorerieId });
    it('accepte un compte de trésorerie de détail du dossier', async () => {
        const { svc, create, prisma } = monde();
        await svc.creer('t1', tresorerie('banque'));
        expect(prisma.compte.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'banque', tenantId: 't1' } }));
        expect(create.mock.calls[0][0].data.compteTresorerieId).toBe('banque');
    });
    it.each([
        ['un compte d’un autre dossier', 'banque-voisin', /introuvable pour ce dossier/],
        ['un compte de classe 6', 'charge', /60500000 n'est pas un compte de banque ou de caisse/],
        ['un compte Total', 'total-52', /52 est un compte Total/],
    ])('refuse à la création %s', async (_cas, id, motif) => {
        const { svc, create } = monde();
        await expect(svc.creer('t1', tresorerie(id))).rejects.toThrow(motif);
        expect(create).not.toHaveBeenCalled();
    });
    it('refuse aussi à la modification, et ne touche pas au journal', async () => {
        const { svc, update } = monde();
        await expect(svc.modifier('t1', 'j1', { compteTresorerieId: 'banque-voisin' })).rejects.toThrow(/introuvable/);
        await expect(svc.modifier('t1', 'j1', { compteTresorerieId: 'charge' })).rejects.toThrow(/divisions 52, 53, 55, 57, 581 ou 582/);
        expect(update).not.toHaveBeenCalled();
        await svc.modifier('t1', 'j1', { compteTresorerieId: 'banque' });
        expect(update).toHaveBeenCalledTimes(1);
    });
});
describe('un compte de trésorerie par journal (décision de Manasse du 2026-10-09)', () => {
    it('refuse à la création le compte d’un autre journal, en nommant ce journal', async () => {
        const { svc, create } = monde();
        await expect(svc.creer('t1', { code: 'BQ2', intitule: 'Banque 2', type: 'TRESORERIE', compteTresorerieId: 'banque-bq' })).rejects.toThrow(/52120000 est déjà celui du journal BQ/);
        expect(create).not.toHaveBeenCalled();
    });
    it('le journal qui garde son propre compte se modifie librement', async () => {
        const { svc, update } = monde();
        await svc.modifier('t1', 'j1', { compteTresorerieId: 'banque-bq', intitule: 'Banque principale' });
        expect(update).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=journal-creation.spec.js.map