"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const lettrage_service_1 = require("./lettrage.service");
function harnais(total, aggregat = { debit: 0, credit: 0 }) {
    const lignes = Array.from({ length: Math.min(total, lettrage_service_1.PLAFOND_LIGNES_LETTRAGE) }, (_, i) => ({
        id: `l${i}`,
        libelle: null,
        debit: 10,
        credit: 0,
        lettre: null,
        lettrageId: i === 0 ? 'g-solde' : null,
        lettrage: null,
        devise: null,
        montantDevise: null,
        ecriture: { date: new Date('2026-01-01'), libelle: 'x', reference: null, journal: { code: 'VT' } },
    }));
    const prisma = {
        compte: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', numero: '41110000', intitule: 'C', lettrable: true }) },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where?.lettre?.not === null ? lignes.filter((l) => l.lettre !== null) : lignes)),
            count: jest.fn().mockResolvedValue(total),
            aggregate: jest.fn().mockResolvedValue({ _sum: aggregat }),
        },
        lettrage: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { svc: new lettrage_service_1.LettrageService(prisma), prisma };
}
describe('fenêtre de lettrage · une tranche qui se dit (F185)', () => {
    it('la lecture est bornée au plafond, et les totaux viennent de l’agrégat du compte entier', async () => {
        const { svc, prisma } = harnais(lettrage_service_1.PLAFOND_LIGNES_LETTRAGE + 1, { debit: 999_999, credit: 1 });
        const r = await svc.lister('t', 'c1');
        expect(prisma.ligneEcriture.findMany.mock.calls[0][0].take).toBe(lettrage_service_1.PLAFOND_LIGNES_LETTRAGE);
        expect(r.tronque).toBe(true);
        expect(r.total).toBe(lettrage_service_1.PLAFOND_LIGNES_LETTRAGE + 1);
        expect(r.totaux).toEqual({ debit: 999_999, credit: 1 });
        const where = prisma.ligneEcriture.findMany.mock.calls[0][0].where;
        expect(prisma.ligneEcriture.count.mock.calls[0][0].where).toEqual(where);
        expect(prisma.ligneEcriture.aggregate.mock.calls[0][0].where).toEqual(where);
    });
    it('tronquée, elle garde les groupes partiels et ceux de ses lignes', async () => {
        const { svc, prisma } = harnais(lettrage_service_1.PLAFOND_LIGNES_LETTRAGE + 1);
        await svc.lister('t', 'c1');
        expect(prisma.lettrage.findMany.mock.calls[0][0].where).toEqual({
            compteId: 'c1',
            tenantId: 't',
            OR: [{ statut: client_1.StatutLettrage.PARTIEL }, { id: { in: ['g-solde'] } }],
        });
    });
    it('entière, elle rend tous les groupes du compte, comme avant', async () => {
        const { svc, prisma } = harnais(3);
        const r = await svc.lister('t', 'c1');
        expect(r.tronque).toBe(false);
        expect(prisma.lettrage.findMany.mock.calls[0][0].where).toEqual({ compteId: 'c1', tenantId: 't' });
    });
});
//# sourceMappingURL=lettrage-fenetre-bornee.spec.js.map