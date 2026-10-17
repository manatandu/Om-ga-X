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
    const lectures = [];
    const garde = (where, statut) => !statut || where.ecriture?.statut === statut;
    const prisma = {
        tenant: {
            findUnique: jest
                .fn()
                .mockResolvedValue({ regimeExigibiliteTva: 'DEBITS', referentiel: 'SYSCOHADA', dateAutorisationDebitsTva: null }),
        },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        compte: { findMany: jest.fn().mockResolvedValue([{ id: 'c4452' }]) },
        ecriture: {
            count: jest.fn().mockImplementation(({ where }) => Promise.resolve(lignes.filter((l) => l.statut === where.statut).length)),
        },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where }) => {
                lectures.push(where);
                if (!where.compte?.OR)
                    return Promise.resolve([]);
                const racines = where.compte.OR.map((c) => c.numero.startsWith);
                return Promise.resolve(lignes
                    .filter((l) => garde(where, l.statut) && racines.some((r) => l.numero.startsWith(r)))
                    .map((l, i) => ({
                    id: `l${i}`,
                    tauxTvaId: TAUX.id,
                    compte: { numero: l.numero },
                    debit: l.debit,
                    credit: l.credit,
                    ecriture: { date: new Date('2026-03-15'), lignes: [] },
                })));
            }),
            aggregate: jest.fn().mockImplementation(({ where }) => {
                lectures.push(where);
                const racine = where.compte?.numero?.startsWith;
                const retenues = racine
                    ? lignes.filter((l) => l.numero.startsWith(racine) && l.statut === where.ecriture?.statut)
                    : [];
                return Promise.resolve({
                    _sum: {
                        debit: retenues.reduce((s, l) => s + l.debit, 0),
                        credit: retenues.reduce((s, l) => s + l.credit, 0),
                    },
                });
            }),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: {
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({}),
        },
    };
    return { svc: new taux_tva_service_1.TauxTvaService(prisma, {}), lectures, prisma };
}
const DEBUT = new Date('2026-03-01');
const FIN = new Date('2026-03-31');
describe('Déclaration de TVA · le livre-journal seul (audit final F25)', () => {
    it('une facture au brouillard n’entre pas dans la déclaration', async () => {
        const { svc } = service([
            { numero: '44310000', debit: 0, credit: 100_000, statut: 'VALIDEE' },
            { numero: '44310000', debit: 0, credit: 40_000, statut: 'BROUILLARD' },
        ]);
        const d = await svc.declaration('t1', DEBUT, FIN);
        expect(d.totalCollecte).toBe(100_000);
    });
    it('ce qui reste au brouillard est compté et NOMMÉ dans la déclaration', async () => {
        const { svc } = service([
            { numero: '44310000', debit: 0, credit: 100_000, statut: 'VALIDEE' },
            { numero: '44310000', debit: 0, credit: 40_000, statut: 'BROUILLARD' },
            { numero: '44520000', debit: 8_000, credit: 0, statut: 'BROUILLARD' },
        ]);
        const d = await svc.declaration('t1', DEBUT, FIN);
        expect(d.tvaAuBrouillard).toEqual({ collecte: 40_000, deductible: 8_000, ecritures: 2 });
        const mention = d.mentionExigibilite;
        expect(mention).toContain('TVA RESTÉE AU BROUILLARD, HORS DE CETTE DÉCLARATION');
        expect(mention).toContain(`${(40_000).toLocaleString('fr-FR')} CDF de TVA facturée`);
        expect(mention).toContain(`${(8_000).toLocaleString('fr-FR')} CDF de TVA récupérable`);
        expect(mention).toContain('AUDCIF art. 22, 2°');
    });
    it('sans rien au brouillard, la déclaration ne dit rien de plus', async () => {
        const { svc } = service([{ numero: '44310000', debit: 0, credit: 100_000, statut: 'VALIDEE' }]);
        const d = await svc.declaration('t1', DEBUT, FIN);
        expect(d.tvaAuBrouillard.ecritures).toBe(0);
        expect(d.mentionExigibilite).not.toContain('TVA RESTÉE AU BROUILLARD');
    });
    it('toute lecture de lignes de la déclaration porte un statut · aucune ne lit les deux', async () => {
        const { svc, lectures } = service([{ numero: '44310000', debit: 0, credit: 100_000, statut: 'VALIDEE' }]);
        await svc.declaration('t1', DEBUT, FIN);
        expect(lectures.length).toBeGreaterThan(3);
        for (const w of lectures)
            expect(['VALIDEE', 'BROUILLARD']).toContain(w.ecriture?.statut);
    });
    it('le prorata définitif ne lit que le livre-journal', async () => {
        const { svc, lectures } = service([{ numero: '44520000', debit: 16_000, credit: 0, statut: 'VALIDEE' }]);
        await svc.prorataDefinitif('t1', 2026);
        expect(lectures.length).toBeGreaterThan(0);
        for (const w of lectures)
            expect(w.ecriture?.statut).toBe('VALIDEE');
    });
});
describe('Liquidation · refusée tant que la période porte de la TVA au brouillard (F25)', () => {
    it('nomme le nombre d’écritures et les montants, et ne liquide rien', async () => {
        const { svc, prisma } = service([
            { numero: '44310000', debit: 0, credit: 100_000, statut: 'VALIDEE' },
            { numero: '44310000', debit: 0, credit: 40_000, statut: 'BROUILLARD' },
        ]);
        await expect(svc.comptabiliserLiquidation('t1', 'u1', { exerciceId: 'ex1', dateDebut: '2026-03-01', dateFin: '2026-03-31' })).rejects.toThrow(/1 écriture\(s\) de la période portent encore de la TVA au brouillard/);
        expect(prisma.liquidationTva.create).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=tva-brouillard-f25.spec.js.map