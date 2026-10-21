"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
function service(net, referentiel, creditAnterieur = 0) {
    const ecrites = [];
    const traces = [];
    const plan = referentiel === 'SYSCOHADA' ? ['44410000', '44490000'] : ['44410000'];
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel }) },
        compte: {
            findFirst: jest.fn(({ where }) => Promise.resolve(plan.includes(where.numero) ? { id: `c-${where.numero}`, numero: where.numero } : null)),
        },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j-od', code: 'OD' }) },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn((args) => {
                traces.push(args.data);
                return Promise.resolve({});
            }),
        },
    };
    const ecritureService = {
        creer: jest.fn((_t, _u, dto) => {
            ecrites.push(dto.lignes);
            return Promise.resolve({ id: 'e1' });
        }),
    };
    const svc = new taux_tva_service_1.TauxTvaService(prisma, ecritureService);
    const creditImpute = Math.min(creditAnterieur, Math.max(0, net));
    const collecte = 6_000_000;
    const deductibleAdmise = collecte - net;
    jest.spyOn(svc, 'declaration').mockResolvedValue({
        totalCollecte: collecte,
        totalDeductibleAdmise: deductibleAdmise,
        netAvantImputation: net,
        creditAnterieur,
        creditImpute,
        recuperationArt52: 0,
        net: net - creditAnterieur,
        tvaAuBrouillard: { collecte: 0, deductible: 0, ecritures: 0 },
        prorata: { pourcentage: 100 },
        lignes: [
            {
                compteCollecteId: 'c-443',
                totalCollecte: collecte,
                compteDeductibleId: 'c-445',
                totalDeductible: deductibleAdmise,
                recuperationArt52: 0,
                parCompte: [
                    { compteId: 'c-443', collecte, deductible: 0, recuperation: 0 },
                    { compteId: 'c-445', collecte: 0, deductible: deductibleAdmise, recuperation: 0 },
                ],
            },
        ],
    });
    return { svc, ecrites, traces };
}
const liquider = (svc) => svc.comptabiliserLiquidation('t1', 'u1', { exerciceId: 'ex1', dateDebut: '2026-01-01', dateFin: '2026-01-31' });
const equilibre = (lignes) => {
    const d = lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
    const c = lignes.reduce((s, l) => s + (l.credit ?? 0), 0);
    return Math.round((d - c) * 100) / 100;
};
describe('liquidation de TVA · le compte d’arrivée dépend du SENS et du référentiel', () => {
    it('SYSCOHADA · une TVA DUE se crédite au 4441', async () => {
        const { svc, ecrites } = service(200, 'SYSCOHADA');
        await liquider(svc);
        const ligne = ecrites[0].find((l) => (l.credit ?? 0) === 200);
        expect(ligne?.compteId).toBe('c-44410000');
    });
    it('SYSCOHADA · un CRÉDIT DE TVA se débite au 4449, jamais au 4441', async () => {
        const { svc, ecrites } = service(-200, 'SYSCOHADA');
        await liquider(svc);
        const ligne = ecrites[0].find((l) => (l.debit ?? 0) === 200);
        expect(ligne?.compteId).toBe('c-44490000');
        expect(ecrites[0].map((l) => l.compteId)).not.toContain('c-44410000');
    });
    it('SYCEBNL · les deux sens restent sur son unique 44410000, que son plan ne subdivise pas', async () => {
        const due = service(200, 'SYCEBNL');
        await liquider(due.svc);
        expect(due.ecrites[0].find((l) => (l.credit ?? 0) === 200)?.compteId).toBe('c-44410000');
        const credit = service(-200, 'SYCEBNL');
        await liquider(credit.svc);
        expect(credit.ecrites[0].find((l) => (l.debit ?? 0) === 200)?.compteId).toBe('c-44410000');
    });
    it('un dossier SYSCOHADA sans 44490000 échoue en le NOMMANT, au lieu de retomber sur le 4441', async () => {
        const { svc } = service(-200, 'SYSCOHADA');
        const prisma = svc.prisma;
        prisma.compte.findFirst = jest.fn(({ where }) => Promise.resolve(where.numero === '44410000' ? { id: 'c-44410000', numero: '44410000' } : null));
        await expect(liquider(svc)).rejects.toThrow(/44490000/);
    });
});
describe('report du crédit de TVA · article 63', () => {
    it('le crédit antérieur ÉTEINT la taxe de la période, et seul le solde est dû', async () => {
        const { svc, ecrites } = service(5_000_000, 'SYSCOHADA', 3_000_000);
        await liquider(svc);
        const imputation = ecrites[0].find((l) => l.libelle?.includes('Imputation du crédit'));
        expect(imputation?.compteId).toBe('c-44490000');
        expect(imputation?.credit).toBe(3_000_000);
        const due = ecrites[0].find((l) => l.libelle === 'TVA due');
        expect(due?.compteId).toBe('c-44410000');
        expect(due?.credit).toBe(2_000_000);
        expect(equilibre(ecrites[0])).toBe(0);
    });
    it('un crédit plus grand que la taxe du mois s’impute jusqu’à concurrence, le reste demeure reportable', async () => {
        const { svc, ecrites, traces } = service(1_000_000, 'SYSCOHADA', 3_000_000);
        await liquider(svc);
        const imputation = ecrites[0].find((l) => l.libelle?.includes('Imputation du crédit'));
        expect(imputation?.credit).toBe(1_000_000);
        expect(ecrites[0].find((l) => l.libelle === 'TVA due')).toBeUndefined();
        expect(equilibre(ecrites[0])).toBe(0);
        expect(traces[0].net).toBe(-2_000_000);
    });
    it('une période qui dégage elle-même un crédit l’AJOUTE au report, sans réinscrire l’ancien', async () => {
        const { svc, ecrites, traces } = service(-2_000_000, 'SYSCOHADA', 3_000_000);
        await liquider(svc);
        const report = ecrites[0].find((l) => l.libelle === 'Crédit de TVA à reporter');
        expect(report?.debit).toBe(2_000_000);
        expect(ecrites[0].some((l) => l.libelle?.includes('Imputation du crédit'))).toBe(false);
        expect(equilibre(ecrites[0])).toBe(0);
        expect(traces[0].net).toBe(-5_000_000);
    });
    it('sans crédit antérieur, l’écriture est celle d’avant · aucune ligne d’imputation parasite', async () => {
        const { svc, ecrites } = service(200, 'SYSCOHADA', 0);
        await liquider(svc);
        expect(ecrites[0].some((l) => l.libelle?.includes('Imputation du crédit'))).toBe(false);
        expect(equilibre(ecrites[0])).toBe(0);
    });
});
function declarant(precedente, tvaDuMois) {
    const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCollecteId: 'c443', compteDeductibleId: 'c445' };
    const prisma = {
        tenant: {
            findUnique: jest.fn().mockResolvedValue({ regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }),
        },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: {
            findMany: jest.fn().mockResolvedValue([
                {
                    id: 'l1',
                    tauxTvaId: TAUX.id,
                    compte: { numero: '44310000' },
                    debit: 0,
                    credit: tvaDuMois,
                    ecriture: { date: new Date('2026-04-15'), lignes: [] },
                },
            ]),
            aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockImplementation(({ where }) => {
                if (!where.dateFin?.lt || !precedente)
                    return Promise.resolve(null);
                return Promise.resolve({
                    id: 'liq-mars',
                    dateDebut: new Date(precedente.dateDebut),
                    dateFin: new Date(precedente.dateFin),
                    net: precedente.net,
                    ecritureId: 'ecr-mars',
                });
            }),
        },
    };
    return new taux_tva_service_1.TauxTvaService(prisma, {});
}
const AVRIL = new Date('2026-04-01');
const FIN_AVRIL = new Date('2026-04-30T23:59:59.999Z');
describe('la DÉCLARATION impute le crédit reporté avant d’annoncer un montant à décaisser', () => {
    it('3 000 000 de crédit en mars, 5 000 000 de taxe en avril · 2 000 000 à payer, pas 5 000 000', async () => {
        const s = declarant({ dateDebut: '2026-03-01', dateFin: '2026-03-31', net: -3_000_000 }, 5_000_000);
        const d = await s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(d.netAvantImputation).toBe(5_000_000);
        expect(d.creditAnterieur).toBe(3_000_000);
        expect(d.creditImpute).toBe(3_000_000);
        expect(d.net).toBe(2_000_000);
        expect(d.sens).toBe('A_PAYER');
        expect(d.mentionExigibilite).toContain('article 63');
        expect(d.creditAnterieurOrigine).toMatchObject({ dateDebut: '2026-03-01', dateFin: '2026-03-31' });
    });
    it('un crédit supérieur à la taxe du mois bascule la déclaration en CRÉDIT, sans le perdre', async () => {
        const s = declarant({ dateDebut: '2026-03-01', dateFin: '2026-03-31', net: -3_000_000 }, 1_000_000);
        const d = await s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(d.creditImpute).toBe(1_000_000);
        expect(d.net).toBe(-2_000_000);
        expect(d.sens).toBe('CREDIT');
    });
    it('une période précédente DÉBITRICE ne laisse aucun crédit · rien à imputer', async () => {
        const s = declarant({ dateDebut: '2026-03-01', dateFin: '2026-03-31', net: 800_000 }, 5_000_000);
        const d = await s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(d.creditAnterieur).toBe(0);
        expect(d.net).toBe(5_000_000);
        expect(d.mentionExigibilite).not.toContain('article 63');
    });
    it('sans aucune liquidation antérieure, la déclaration est celle d’avant', async () => {
        const s = declarant(null, 5_000_000);
        const d = await s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(d.creditAnterieur).toBe(0);
        expect(d.net).toBe(5_000_000);
    });
});
//# sourceMappingURL=liquidation-credit-tva.spec.js.map