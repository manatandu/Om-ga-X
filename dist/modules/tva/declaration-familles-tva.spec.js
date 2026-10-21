"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const TAUX = {
    id: 'tx16',
    code: 'TVA16',
    intitule: 'Taux normal 16 %',
    taux: 16,
    compteCollecteId: 'c4431',
    compteDeductibleId: 'c4452',
    estActif: true,
};
function service(lignes) {
    const requetesLignes = [];
    const prisma = {
        tenant: {
            findUnique: jest
                .fn()
                .mockResolvedValue({ regimeExigibiliteTva: 'DEBITS', referentiel: 'SYSCOHADA', dateAutorisationDebitsTva: null }),
        },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where }) => {
                const compte = where.compte;
                if (!compte?.OR)
                    return Promise.resolve([]);
                requetesLignes.push(where);
                const racines = compte.OR.map((c) => c.numero.startsWith);
                return Promise.resolve(lignes
                    .filter((l) => racines.some((r) => l.numero.startsWith(r)))
                    .map((l) => ({
                    id: `l-${l.numero}`,
                    compteId: `c${l.numero.slice(0, 4)}`,
                    tauxTvaId: TAUX.id,
                    compte: { numero: l.numero },
                    debit: l.debit,
                    credit: l.credit,
                    ecriture: {
                        date: new Date('2026-03-15'),
                        lignes: l.charge ? [{ debit: l.debit * 6.25, credit: 0, compte: { numero: l.charge, classe: 'CLASSE_6' } }] : [],
                    },
                })));
            }),
            aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
        compte: {
            findFirst: jest.fn(({ where }) => Promise.resolve({ id: `c${where.numero.slice(0, 4)}`, numero: where.numero })),
        },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j-od', code: 'OD' }) },
    };
    const ecrites = [];
    const ecritureService = {
        creer: jest.fn((_t, _u, dto) => {
            ecrites.push(dto.lignes);
            return Promise.resolve({ id: 'e1' });
        }),
    };
    return { svc: new taux_tva_service_1.TauxTvaService(prisma, ecritureService), requetesLignes, ecrites };
}
const DEBUT = new Date('2026-03-01');
const FIN = new Date('2026-03-31');
describe('Déclaration de TVA · sélection par famille de compte', () => {
    it('compte la TVA sur PRESTATIONS (4432), que le taux ne désigne pas', async () => {
        const { svc } = service([
            { numero: '44310000', debit: 0, credit: 100_000 },
            { numero: '44320000', debit: 0, credit: 60_000 },
        ]);
        const d = await svc.declaration('t1', DEBUT, FIN);
        expect(d.totalCollecte).toBe(160_000);
    });
    it('compte la TVA récupérable sur SERVICES EXTÉRIEURS (4454) et sur IMMOBILISATIONS (4451)', async () => {
        const { svc } = service([
            { numero: '44520000', debit: 40_000, credit: 0 },
            { numero: '44540000', debit: 25_000, credit: 0 },
            { numero: '44510000', debit: 80_000, credit: 0 },
        ]);
        const d = await svc.declaration('t1', DEBUT, FIN);
        expect(d.totalDeductible).toBe(145_000);
    });
    it('ne confond jamais les deux familles · 443 au crédit, 445 au débit', async () => {
        const { svc } = service([
            { numero: '44330000', debit: 0, credit: 90_000 },
            { numero: '44530000', debit: 12_000, credit: 0 },
        ]);
        const d = await svc.declaration('t1', DEBUT, FIN);
        expect(d.totalCollecte).toBe(90_000);
        expect(d.totalDeductible).toBe(12_000);
        expect(d.net).toBe(78_000);
        expect(d.sens).toBe('A_PAYER');
    });
    it('n’interroge PLUS la base par l’identifiant du compte porté par le taux', async () => {
        const { svc, requetesLignes } = service([{ numero: '44310000', debit: 0, credit: 1000 }]);
        await svc.declaration('t1', DEBUT, FIN);
        expect(requetesLignes.length).toBeGreaterThan(0);
        for (const where of requetesLignes) {
            expect(where.compteId).toBeUndefined();
            const compte = where.compte;
            expect(compte.OR.map((c) => c.numero.startsWith).sort()).toEqual(['443', '445']);
            expect(where.tauxTvaId).toEqual({ in: [TAUX.id] });
        }
    });
    it('un dossier SYCEBNL, dont le plan ne subdivise pas, est servi par la même règle', async () => {
        const { svc } = service([
            { numero: '44310000', debit: 0, credit: 32_000 },
            { numero: '44510000', debit: 8_000, credit: 0 },
        ]);
        const d = await svc.declaration('t1', DEBUT, FIN);
        expect(d.totalCollecte).toBe(32_000);
        expect(d.totalDeductible).toBe(8_000);
    });
    it('la LIQUIDATION solde chaque compte réellement mouvementé, jamais le compte du taux', async () => {
        const { svc, ecrites } = service([
            { numero: '44320000', debit: 0, credit: 60_000 },
            { numero: '44310000', debit: 0, credit: 100_000 },
            { numero: '44540000', debit: 25_000, credit: 0 },
        ]);
        await svc.comptabiliserLiquidation('t1', 'u1', { exerciceId: 'ex1', dateDebut: '2026-03-01', dateFin: '2026-03-31' });
        const solde = (compteId) => ecrites[0].filter((l) => l.compteId === compteId).reduce((x, l) => x + (l.debit ?? 0) - (l.credit ?? 0), 0);
        expect(solde('c4432')).toBe(60_000);
        expect(solde('c4431')).toBe(100_000);
        expect(solde('c4454')).toBe(-25_000);
        expect(solde('c4452')).toBe(0);
        expect(solde('c4441')).toBe(-135_000);
    });
    it('la LIQUIDATION ne solde du 445 que la déduction admise · la TVA exclue par l’art. 41 n’y est pas comptée', async () => {
        const { svc, ecrites } = service([
            { numero: '44310000', debit: 0, credit: 100_000 },
            { numero: '44540000', debit: 16_000, credit: 0, charge: '63830000' },
        ]);
        await svc.comptabiliserLiquidation('t1', 'u1', { exerciceId: 'ex1', dateDebut: '2026-03-01', dateFin: '2026-03-31' });
        const solde = (compteId) => ecrites[0].filter((l) => l.compteId === compteId).reduce((x, l) => x + (l.debit ?? 0) - (l.credit ?? 0), 0);
        expect(solde('c4454')).toBe(0);
        expect(solde('c4441')).toBe(-100_000);
    });
});
//# sourceMappingURL=declaration-familles-tva.spec.js.map