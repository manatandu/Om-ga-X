"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const devises_service_1 = require("./devises.service");
function service(lignes, coursCloture) {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex1',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
                statut: 'OUVERT',
            }),
        },
        ligneEcriture: {
            aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }),
            findMany: jest.fn().mockResolvedValue(lignes.map((l, i) => ({
                compteId: `c-${l.compteNumero}`,
                deviseId: `d-${l.deviseCode}`,
                debit: l.debit,
                credit: l.credit,
                montantDevise: l.montantDevise,
                compte: { id: `c-${l.compteNumero}`, numero: l.compteNumero, intitule: `Compte ${i}` },
                devise: { id: `d-${l.deviseCode}`, code: l.deviseCode },
            }))),
        },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]), },
        provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
        verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
        ecriture: { count: jest.fn().mockResolvedValue(1) },
        coursDevise: {
            findFirst: jest.fn().mockResolvedValue(coursCloture === null ? null : { cours: coursCloture }),
        },
    };
    return new devises_service_1.DevisesService(prisma, {});
}
describe('réévaluation · créances et dettes contre disponibilités', () => {
    it('une créance en USD qui se déprécie donne une PERTE LATENTE, provisionnée', async () => {
        const r = await service([{ compteNumero: '41200000', deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }], 2500).calculer('t1', { exerciceId: 'ex1' });
        expect(r.positions).toHaveLength(1);
        expect(r.positions[0].ecart).toBe(-300_000);
        expect(r.perteLatente).toBe(300_000);
        expect(r.perteRealisee).toBe(0);
        expect(r.provision).toBe(300_000);
    });
    it('une créance qui s’apprécie donne un GAIN LATENT, jamais provisionné', async () => {
        const r = await service([{ compteNumero: '41200000', deviseCode: 'USD', debit: 2_500_000, credit: 0, montantDevise: 1000 }], 2800).calculer('t1', { exerciceId: 'ex1' });
        expect(r.gainLatent).toBe(300_000);
        expect(r.perteLatente).toBe(0);
        expect(r.provision).toBe(0);
    });
    it('une disponibilité en devise donne un écart RÉALISÉ, sans provision', async () => {
        const r = await service([{ compteNumero: '52120000', deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }], 2500).calculer('t1', { exerciceId: 'ex1' });
        expect(r.positions[0].estTresorerie).toBe(true);
        expect(r.perteRealisee).toBe(300_000);
        expect(r.perteLatente).toBe(0);
        expect(r.provision).toBe(0);
    });
    it('une dette en devise se réévalue comme une position nette créditrice', async () => {
        const r = await service([{ compteNumero: '40110000', deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }], 2800).calculer('t1', { exerciceId: 'ex1' });
        expect(r.positions[0].montantDevise).toBe(-1000);
        expect(r.positions[0].valeurComptable).toBe(-2_500_000);
        expect(r.positions[0].valeurReevaluee).toBe(-2_800_000);
        expect(r.perteLatente).toBe(300_000);
    });
    it('agrège les lignes d’un même compte et d’une même devise', async () => {
        const r = await service([
            { compteNumero: '41200000', deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 },
            { compteNumero: '41200000', deviseCode: 'USD', debit: 0, credit: 1_400_000, montantDevise: 500 },
        ], 2500).calculer('t1', { exerciceId: 'ex1' });
        expect(r.positions).toHaveLength(1);
        expect(r.positions[0].montantDevise).toBe(500);
        expect(r.positions[0].valeurComptable).toBe(1_400_000);
        expect(r.positions[0].ecart).toBe(-150_000);
    });
    it('une ligne de crédit inscrite en négatif annule la position qu’elle corrige', async () => {
        const r = await service([
            { compteNumero: '40100000', deviseCode: 'USD', debit: 0, credit: 2_800_000, montantDevise: 1000 },
            { compteNumero: '40100000', deviseCode: 'USD', debit: 0, credit: -2_800_000, montantDevise: 1000 },
        ], 2500).calculer('t1', { exerciceId: 'ex1' });
        expect(r.positions).toHaveLength(0);
    });
    it('signale la devise sans cours coté plutôt que de réévaluer à l’aveugle', async () => {
        const r = await service([{ compteNumero: '41200000', deviseCode: 'EUR', debit: 3_000_000, credit: 0, montantDevise: 1000 }], null).calculer('t1', { exerciceId: 'ex1' });
        expect(r.positions).toHaveLength(0);
        expect(r.coursManquants).toEqual(['EUR']);
    });
    it('ignore une position soldée', async () => {
        const r = await service([
            { compteNumero: '41200000', deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 },
            { compteNumero: '41200000', deviseCode: 'USD', debit: 0, credit: 2_800_000, montantDevise: 1000 },
        ], 2500).calculer('t1', { exerciceId: 'ex1' });
        expect(r.positions).toHaveLength(0);
    });
});
function serviceEcritures(lignes, coursCloture, referentiel) {
    const ecrites = [];
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex1',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
                statut: 'OUVERT',
            }),
        },
        ligneEcriture: {
            aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }),
            findMany: jest.fn().mockResolvedValue(lignes.map((l, i) => ({
                compteId: `c-${l.compteNumero}`,
                deviseId: `d-${l.deviseCode}`,
                debit: l.debit,
                credit: l.credit,
                montantDevise: l.montantDevise,
                compte: { id: `c-${l.compteNumero}`, numero: l.compteNumero, intitule: `Compte ${i}` },
                devise: { id: `d-${l.deviseCode}`, code: l.deviseCode },
            }))),
        },
        coursDevise: { findFirst: jest.fn().mockResolvedValue({ cours: coursCloture }) },
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel }) },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j-od', code: 'OD' }) },
        compte: {
            findFirst: jest.fn(({ where }) => {
                const racine = where.numero.startsWith;
                return Promise.resolve({ id: `c-${racine}`, numero: racine.padEnd(8, '0') });
            }),
        },
        provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
        verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
        ecriture: { count: jest.fn().mockResolvedValue(1) },
        reevaluation: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'r1' }),
        },
    };
    const ecritureService = {
        creer: jest.fn((_t, _u, dto) => {
            ecrites.push({
                libelle: dto.libelle,
                lignes: dto.lignes.map((l) => ({ numero: l.compteId.replace(/^c-/, ''), debit: l.debit, credit: l.credit })),
            });
            return Promise.resolve({ id: `e-${ecrites.length}` });
        }),
    };
    const svc = new devises_service_1.DevisesService(prisma, ecritureService);
    return { svc, ecrites };
}
const CLIENT = '41200000';
const FOURNISSEUR = '40100000';
const EMPRUNT = '16200000';
describe('imputation des écritures de réévaluation · SYSCOHADA', () => {
    it('une CRÉANCE qui se déprécie va en 4781, jamais en 478 au hasard', async () => {
        const { svc, ecrites } = serviceEcritures([{ compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }], 2500, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        const ecarts = ecrites[0].lignes.map((l) => l.numero);
        expect(ecarts).toContain('4781');
        expect(ecarts).not.toContain('4783');
    });
    it('une DETTE qui s’alourdit va en 4783, et surtout PAS sur les créances', async () => {
        const { svc, ecrites } = serviceEcritures([{ compteNumero: FOURNISSEUR, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }], 2800, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        const ecarts = ecrites[0].lignes.map((l) => l.numero);
        expect(ecarts).toContain('4783');
        expect(ecarts).not.toContain('4781');
    });
    it('une dette FINANCIÈRE va en 4784, pas en 4783', async () => {
        const { svc, ecrites } = serviceEcritures([{ compteNumero: EMPRUNT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }], 2800, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        expect(ecrites[0].lignes.map((l) => l.numero)).toContain('4784');
    });
    it('un GAIN sur créance va en 4791, un gain sur dette en 4793', async () => {
        const { svc, ecrites } = serviceEcritures([
            { compteNumero: CLIENT, deviseCode: 'USD', debit: 2_300_000, credit: 0, montantDevise: 1000 },
            { compteNumero: FOURNISSEUR, deviseCode: 'USD', debit: 0, credit: 2_800_000, montantDevise: 1000 },
        ], 2500, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        const ecarts = ecrites[0].lignes.map((l) => l.numero);
        expect(ecarts).toContain('4791');
        expect(ecarts).toContain('4793');
    });
    it('la provision sur une CRÉANCE COMMERCIALE est une charge d’EXPLOITATION · 6591 par 4991', async () => {
        const { svc, ecrites } = serviceEcritures([{ compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }], 2500, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        const provision = ecrites.find((e) => e.libelle.startsWith('Provision'));
        const numeros = provision.lignes.map((l) => l.numero);
        expect(numeros).toEqual(['6591', '4991']);
        expect(numeros).not.toContain('6971');
    });
    it('la provision sur un EMPRUNT reste financière · 6971 par 194', async () => {
        const { svc, ecrites } = serviceEcritures([{ compteNumero: EMPRUNT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }], 2800, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        const provision = ecrites.find((e) => e.libelle.startsWith('Provision'));
        expect(provision.lignes.map((l) => l.numero)).toEqual(['6971', '194']);
    });
    it('une perte sur créance ET une perte sur emprunt donnent DEUX couples, pas un seul', async () => {
        const { svc, ecrites } = serviceEcritures([
            { compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 },
            { compteNumero: EMPRUNT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1100 },
        ], 2500, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        const provision = ecrites.find((e) => e.libelle.startsWith('Provision'));
        const numeros = provision.lignes.map((l) => l.numero);
        expect(numeros).toContain('6591');
        expect(numeros).toContain('6971');
        const debits = provision.lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
        const credits = provision.lignes.reduce((s, l) => s + (l.credit ?? 0), 0);
        expect(Math.round(debits * 100)).toBe(Math.round(credits * 100));
    });
});
describe('imputation des écritures de réévaluation · SYCEBNL, subdivisions du 478 et du 479 (A5 ter)', () => {
    const ecartDe = async (compteNumero, debit, credit, cours) => {
        const { svc, ecrites } = serviceEcritures([{ compteNumero, deviseCode: 'USD', debit, credit, montantDevise: 1000 }], cours, 'SYCEBNL');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        return ecrites[0].lignes.map((l) => l.numero).filter((n) => n.startsWith('47'));
    };
    it('dette fournisseur qui s’alourdit · 47831, augmentation des dettes d’exploitation', async () => {
        expect(await ecartDe(FOURNISSEUR, 0, 2_500_000, 2800)).toEqual(['47831']);
    });
    it('créance client qui baisse · 47811 ; qui monte · 47911', async () => {
        expect(await ecartDe(CLIENT, 2_800_000, 0, 2500)).toEqual(['47811']);
        expect(await ecartDe(CLIENT, 2_500_000, 0, 2800)).toEqual(['47911']);
    });
    it('dette fournisseur qui s’allège · 47931', async () => {
        expect(await ecartDe(FOURNISSEUR, 0, 2_800_000, 2500)).toEqual(['47931']);
    });
    it('autre dette H.A.O. (484) · 47838 et 47938', async () => {
        expect(await ecartDe('48400000', 0, 2_500_000, 2800)).toEqual(['47838']);
        expect(await ecartDe('48400000', 0, 2_800_000, 2500)).toEqual(['47938']);
    });
    it('second tour · fournisseur d’investissements (481) · dette FINANCIÈRE, 4784 et 4794 (§ 1.1, comme le réalisé d’A6)', async () => {
        expect(await ecartDe('48120000', 0, 2_500_000, 2800)).toEqual(['4784']);
        expect(await ecartDe('48120000', 0, 2_800_000, 2500)).toEqual(['4794']);
    });
    it('second tour · intérêts courus (186, 276) · 4784 et 4782, financiers', async () => {
        expect(await ecartDe('18620000', 0, 2_500_000, 2800)).toEqual(['4784']);
        expect(await ecartDe('27610000', 2_800_000, 0, 2500)).toEqual(['4782']);
    });
    it('emprunt (18) et crédit de trésorerie (56) · 4784 et 4794, dettes FINANCIÈRES', async () => {
        expect(await ecartDe('18100000', 0, 2_500_000, 2800)).toEqual(['4784']);
        expect(await ecartDe('56100000', 0, 2_800_000, 2500)).toEqual(['4794']);
    });
    it('prêt (27) · 4782 et 4792, créances FINANCIÈRES', async () => {
        expect(await ecartDe('27100000', 2_800_000, 0, 2500)).toEqual(['4782']);
        expect(await ecartDe('27100000', 2_500_000, 0, 2800)).toEqual(['4792']);
    });
    it('créance client · provision au 4991 par le 6591, jamais le 194 (fiche du compte 19, exclusions)', async () => {
        const { svc, ecrites } = serviceEcritures([{ compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }], 2500, 'SYCEBNL');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        const provision = ecrites.find((e) => e.libelle.startsWith('Provision'));
        expect(provision.lignes.map((l) => l.numero)).toEqual(['6591', '4991']);
    });
    it('chaque subdivision servie est ouverte en DÉTAIL au semis SYCEBNL', () => {
        const { PLAN_COMPTES_SYCEBNL } = jest.requireActual('../comptes/compte-seed');
        for (const r of ['47811', '47818', '4782', '47831', '47838', '4784', '47911', '47918', '4792', '47931', '47938', '4794']) {
            expect([r, PLAN_COMPTES_SYCEBNL.some((c) => c.numero === r.padEnd(8, '0') && c.typeCompte !== 'TOTAL')]).toEqual([r, true]);
        }
    });
});
describe('SYSCOHADA · un instrument de trésorerie (54) en devise · hors réévaluation (quatrième lot, point 8)', () => {
    it('aucun écart ni provision, le 54 nommé avec son motif ; un 54 au bilan reste inchangé', async () => {
        const r = await service([{ compteNumero: '54200000', deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }], 2500).calculer('t1', { exerciceId: 'ex1' });
        expect([r.perteLatente, r.gainLatent, r.perteRealisee, r.provision]).toEqual([0, 0, 0, 0]);
        expect(r.positionsNonReevaluees).toEqual([
            expect.objectContaining({ numero: '54200000', motif: expect.stringContaining('Titre VII, compte 54') }),
        ]);
        const { svc, ecrites } = serviceEcritures([{ compteNumero: '54200000', deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }], 2500, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' }).catch(() => undefined);
        expect(ecrites.flatMap((e) => e.lignes.map((l) => l.numero)).filter((n) => /^(54|4786|4797|4997)/.test(n))).toEqual([]);
    });
    it('le motif vaut aux deux référentiels, et 4786 / 4797 ne sont plus servis par la subdivision de l’écart', () => {
        const { motifHorsReevaluation, seReevalueALaCloture } = jest.requireActual('./perimetre-reevaluation');
        expect(seReevalueALaCloture('54200000', 'SYSCOHADA')).toBe(false);
        expect(seReevalueALaCloture('54200000', 'SYCEBNL')).toBe(false);
        expect(motifHorsReevaluation('54400000', 'SYSCOHADA')).toContain('art. 58-1 à 58-4');
        const { racineEcartDeConversion } = jest.requireActual('./devises.service');
        expect(racineEcartDeConversion('SYSCOHADA', '54200000', true, true)).not.toBe('4786');
        expect(racineEcartDeConversion('SYSCOHADA', '54200000', true, false)).not.toBe('4797');
    });
});
const DECOUVERT = '56100000';
const PLACEMENT = '50100000';
const BANQUE = '52100000';
describe('disponibilités contre trésorerie financière', () => {
    it('un DÉCOUVERT bancaire en devise donne un écart LATENT, pas une perte réalisée', async () => {
        const r = await service([{ compteNumero: DECOUVERT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }], 2800).calculer('t1', { exerciceId: 'ex1' });
        expect(r.perteLatente).toBe(300_000);
        expect(r.perteRealisee).toBe(0);
        expect(r.provision).toBe(300_000);
    });
    it('un TITRE DE PLACEMENT en devise n’est ni une disponibilité ni une créance · aucun écart (§ 1.3, A5 ter)', async () => {
        const r = await service([{ compteNumero: PLACEMENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }], 2500).calculer('t1', { exerciceId: 'ex1' });
        expect(r.perteLatente).toBe(0);
        expect(r.perteRealisee).toBe(0);
        expect(r.positionsNonReevaluees).toEqual([expect.objectContaining({ numero: PLACEMENT, motif: expect.stringContaining('§ 1.3') })]);
    });
    it('une BANQUE, elle, reste une disponibilité · écart réalisé, aucune provision', async () => {
        const r = await service([{ compteNumero: BANQUE, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }], 2500).calculer('t1', { exerciceId: 'ex1' });
        expect(r.perteRealisee).toBe(300_000);
        expect(r.perteLatente).toBe(0);
        expect(r.provision).toBe(0);
    });
});
describe('les TROIS couples de provision du texte sont servis', () => {
    it('un découvert bancaire est un risque financier à COURT terme · 6791 par 4997', async () => {
        const { svc, ecrites } = serviceEcritures([{ compteNumero: DECOUVERT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }], 2800, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        const provision = ecrites.find((e) => e.libelle.startsWith('Provision'));
        expect(provision.lignes.map((l) => l.numero)).toEqual(['6791', '4997']);
    });
    it('son écart va en 4784 · augmentation d’une dette FINANCIÈRE', async () => {
        const { svc, ecrites } = serviceEcritures([{ compteNumero: DECOUVERT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }], 2800, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        expect(ecrites[0].lignes.map((l) => l.numero)).toContain('4784');
    });
    it('exploitation, court terme et long terme cohabitent dans UNE écriture équilibrée', async () => {
        const { svc, ecrites } = serviceEcritures([
            { compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 },
            { compteNumero: DECOUVERT, deviseCode: 'USD', debit: 0, credit: 2_400_000, montantDevise: 1000 },
            { compteNumero: EMPRUNT, deviseCode: 'USD', debit: 0, credit: 2_400_000, montantDevise: 1000 },
        ], 2500, 'SYSCOHADA');
        await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
        const provision = ecrites.find((e) => e.libelle.startsWith('Provision'));
        const numeros = provision.lignes.map((l) => l.numero);
        expect(numeros).toContain('6591');
        expect(numeros).toContain('6791');
        expect(numeros).toContain('6971');
        const debits = provision.lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
        const credits = provision.lignes.reduce((s, l) => s + (l.credit ?? 0), 0);
        expect(Math.round(debits * 100)).toBe(Math.round(credits * 100));
    });
});
describe('A5 ter, second tour · un dossier introuvable ne prend jamais le SYSCOHADA par défaut', () => {
    it('reevaluer · refus nommé, aucune écriture', async () => {
        const { svc, ecrites } = serviceEcritures([{ compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }], 2500, 'SYCEBNL');
        svc.prisma.tenant.findUnique.mockResolvedValue(null);
        await expect(svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' })).rejects.toThrow(/Dossier introuvable/);
        expect(ecrites).toEqual([]);
    });
});
//# sourceMappingURL=reevaluation.spec.js.map