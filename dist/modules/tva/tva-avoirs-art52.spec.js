"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const TAUX = {
    id: 'tx16',
    code: 'TVA16',
    intitule: 'TVA 16 %',
    taux: 16,
    compteCollecteId: 'c443',
    compteDeductibleId: 'c445',
};
function service(lignes, derniere = null) {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where }) => {
                const compte = where.compte;
                if (!compte?.OR)
                    return Promise.resolve([]);
                return Promise.resolve(lignes.map((l) => ({
                    id: `l-${l.numero}-${l.date}`,
                    tauxTvaId: TAUX.id,
                    compte: { numero: l.numero },
                    debit: l.debit ?? 0,
                    credit: l.credit ?? 0,
                    ecriture: { date: new Date(l.date), lignes: [] },
                })));
            }),
            aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockImplementation(({ where }) => {
                const dateFin = where.dateFin;
                if (dateFin?.lt === undefined)
                    return Promise.resolve(null);
                return Promise.resolve(derniere
                    ? { id: 'liq1', dateDebut: derniere.dateDebut, dateFin: derniere.dateFin, net: derniere.net, ecritureId: 'e-liq1' }
                    : null);
            }),
        },
    };
    return new taux_tva_service_1.TauxTvaService(prisma, {});
}
const MARS = new Date('2026-03-01');
const FIN_MARS = new Date('2026-03-31T23:59:59.999Z');
const AVRIL = new Date('2026-04-01');
const FIN_AVRIL = new Date('2026-04-30T23:59:59.999Z');
const LIQUIDATION_DE_MARS = { dateDebut: MARS, dateFin: FIN_MARS, net: 0 };
describe('Avoir sur VENTE · reporté sur la déclaration suivante (art. 52, décret art. 126)', () => {
    it('ne minore PAS la collecte du mois de sa constatation, et le montant est rendu', async () => {
        const s = service([
            { numero: '44310000', date: '2026-03-10', credit: 3_200_000 },
            { numero: '44310000', date: '2026-03-20', debit: 1_600_000 },
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(3_200_000);
        expect(d.avoirsCollecteConstates).toBe(1_600_000);
        expect(d.mentionExigibilite).toContain('AVOIRS SUR VENTES CONSTATÉS');
        expect(d.mentionExigibilite).toContain('art. 126');
        expect(d.mentionExigibilite).toContain('ENVOYÉE au client');
    });
    it('s’inscrit en DÉDUCTION de la déclaration suivante et diminue le net d’autant', async () => {
        const s = service([
            { numero: '44310000', date: '2026-03-20', debit: 1_600_000 },
            { numero: '44310000', date: '2026-04-15', credit: 2_000_000 },
        ], LIQUIDATION_DE_MARS);
        const d = await s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(d.totalCollecte).toBe(2_000_000);
        expect(d.recuperationArt52).toBe(1_600_000);
        expect(d.netAvantImputation).toBe(400_000);
        expect(d.mentionExigibilite).toContain('RÉCUPÉRATION SUR VENTES ANNULÉES');
    });
    it('n’est PAS amputée par le prorata de l’article 43', async () => {
        const s = service([
            { numero: '44310000', date: '2026-03-20', debit: 100_000 },
            { numero: '44310000', date: '2026-04-15', credit: 1_000_000 },
            { numero: '44520000', date: '2026-04-16', debit: 400_000 },
        ], LIQUIDATION_DE_MARS);
        jest.spyOn(s, 'prorataApplicable').mockResolvedValue({ pourcentage: 50, recettesNonQualifiees: 0 });
        const d = await s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(d.totalDeductibleAdmise).toBe(200_000);
        expect(d.netAvantImputation).toBe(700_000);
    });
    it('un avoir plus ancien que la dernière période liquidée n’est ni réimputé, ni signalé', async () => {
        const s = service([
            { numero: '44310000', date: '2026-01-20', debit: 900_000 },
            { numero: '44310000', date: '2026-04-15', credit: 2_000_000 },
        ], LIQUIDATION_DE_MARS);
        const d = await s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(d.recuperationArt52).toBe(0);
        expect(d.avoirsCollecteNonImputes).toBe(0);
        expect(d.netAvantImputation).toBe(2_000_000);
    });
    it('sans aucune liquidation antérieure, rien n’est imputé d’office · le montant est NOMMÉ', async () => {
        const s = service([
            { numero: '44310000', date: '2026-03-20', debit: 1_600_000 },
            { numero: '44310000', date: '2026-04-15', credit: 2_000_000 },
        ], null);
        const d = await s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(d.recuperationArt52).toBe(0);
        expect(d.avoirsCollecteNonImputes).toBe(1_600_000);
        expect(d.netAvantImputation).toBe(2_000_000);
        expect(d.mentionExigibilite).toContain('AVOIRS ANTÉRIEURS NON IMPUTÉS');
    });
});
describe('Avoir FOURNISSEUR · la déduction est reprise à la constatation (décret art. 127)', () => {
    it('vient en diminution de la TVA déductible de la période', async () => {
        const s = service([
            { numero: '44520000', date: '2026-03-10', debit: 800_000 },
            { numero: '44520000', date: '2026-03-25', credit: 300_000 },
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(500_000);
    });
    it('peut rendre la déduction de la période NÉGATIVE · c’est un reversement, pas un zéro', async () => {
        const s = service([
            { numero: '44310000', date: '2026-03-10', credit: 1_000_000 },
            { numero: '44520000', date: '2026-03-11', debit: 100_000 },
            { numero: '44520000', date: '2026-03-25', credit: 400_000 },
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(-300_000);
        expect(d.netAvantImputation).toBe(1_300_000);
    });
});
describe('Comptabilisation · la récupération solde le 443 et l’écriture reste équilibrée', () => {
    function liquidation(recuperation, totalDeductible) {
        const ecrites = [];
        const prisma = {
            tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
            compte: { findFirst: jest.fn(({ where }) => Promise.resolve({ id: `c-${where.numero}`, numero: where.numero })) },
            journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j-od', code: 'OD' }) },
            factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
            creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
            liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
        };
        const ecritureService = {
            creer: jest.fn((_t, _u, dto) => {
                ecrites.push(dto.lignes);
                return Promise.resolve({ id: 'e1' });
            }),
        };
        const svc = new taux_tva_service_1.TauxTvaService(prisma, ecritureService);
        const collecte = 2_000_000;
        jest.spyOn(svc, 'declaration').mockResolvedValue({
            totalCollecte: collecte,
            totalDeductibleAdmise: totalDeductible,
            recuperationArt52: recuperation,
            netAvantImputation: collecte - totalDeductible - recuperation,
            creditAnterieur: 0,
            creditImpute: 0,
            net: collecte - totalDeductible - recuperation,
            tvaAuBrouillard: { collecte: 0, deductible: 0, ecritures: 0 },
            prorata: { pourcentage: 100 },
            lignes: [
                {
                    compteCollecteId: 'c-443',
                    totalCollecte: collecte,
                    compteDeductibleId: 'c-445',
                    totalDeductible,
                    recuperationArt52: recuperation,
                    parCompte: [
                        { compteId: 'c-443', collecte, deductible: 0, recuperation },
                        { compteId: 'c-445', collecte: 0, deductible: totalDeductible, recuperation: 0 },
                    ],
                },
            ],
        });
        return { svc, ecrites };
    }
    const equilibre = (lignes) => {
        const d = lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
        const c = lignes.reduce((s, l) => s + (l.credit ?? 0), 0);
        return Math.round((d - c) * 100) / 100;
    };
    it('crédite le compte de TVA facturée du montant récupéré, et reste équilibrée', async () => {
        const { svc, ecrites } = liquidation(600_000, 500_000);
        await svc.comptabiliserLiquidation('t1', 'u1', { exerciceId: 'ex1', dateDebut: '2026-04-01', dateFin: '2026-04-30' });
        const ligne = ecrites[0].find((l) => l.libelle?.includes('art. 52'));
        expect(ligne?.compteId).toBe('c-443');
        expect(ligne?.credit).toBe(600_000);
        expect(equilibre(ecrites[0])).toBe(0);
    });
    it('porte au DÉBIT du 445 une déduction devenue négative, au lieu de l’omettre', async () => {
        const { svc, ecrites } = liquidation(0, -300_000);
        await svc.comptabiliserLiquidation('t1', 'u1', { exerciceId: 'ex1', dateDebut: '2026-03-01', dateFin: '2026-03-31' });
        const ligne = ecrites[0].find((l) => l.compteId === 'c-445');
        expect(ligne?.debit).toBe(300_000);
        expect(equilibre(ecrites[0])).toBe(0);
    });
});
//# sourceMappingURL=tva-avoirs-art52.spec.js.map