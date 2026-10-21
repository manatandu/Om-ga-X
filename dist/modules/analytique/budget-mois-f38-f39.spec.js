"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const analytique_service_1 = require("./analytique.service");
const etats_analytiques_service_1 = require("./etats-analytiques.service");
const ANNEE = { id: 'ex1', tenantId: 't1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const LONG = { id: 'exL', tenantId: 't1', dateDebut: new Date('2025-07-01'), dateFin: new Date('2026-12-31') };
function table(initiales, options = {}) {
    let lignes = initiales.map((l) => ({ ...l }));
    let n = 100;
    const correspond = (l, w) => (w.sectionId === undefined || l.sectionId === w.sectionId) &&
        (w.exerciceId === undefined || l.exerciceId === w.exerciceId) &&
        (!('mois' in w) ||
            (w.mois !== null && typeof w.mois === 'object' ? l.mois !== null : l.mois === w.mois));
    const inserer = (data) => {
        if (lignes.some((l) => l.sectionId === data.sectionId && l.exerciceId === data.exerciceId && l.mois === data.mois)) {
            throw new Error('Unique constraint failed');
        }
        const ligne = { ...data, id: `b${n++}`, montant: Number(data.montant) };
        lignes.push(ligne);
        return ligne;
    };
    const delegue = () => ({
        findMany: jest.fn(({ where }) => Promise.resolve(lignes.filter((l) => correspond(l, where)).sort((a, b) => (a.mois ?? 0) - (b.mois ?? 0)))),
        findFirst: jest.fn(({ where }) => Promise.resolve(lignes.find((l) => correspond(l, where)) ?? null)),
        deleteMany: jest.fn(({ where }) => {
            lignes = lignes.filter((l) => !correspond(l, where));
            return Promise.resolve({});
        }),
        create: jest.fn(({ data }) => Promise.resolve(inserer(data))),
        createMany: jest.fn(({ data }) => {
            data.forEach(inserer);
            return Promise.resolve({ count: data.length });
        }),
        update: jest.fn(({ where, data }) => {
            if (options.echecAnnuelle)
                return Promise.reject(new Error('panne'));
            const l = lignes.find((x) => x.id === where.id);
            l.montant = Number(data.montant);
            return Promise.resolve(l);
        }),
        upsert: jest.fn(({ where, create, update }) => {
            const cle = where.sectionId_exerciceId_mois;
            if (cle.mois === null || cle.mois === undefined)
                return Promise.reject(new Error('Argument `mois` must not be null.'));
            const l = lignes.find((x) => x.sectionId === cle.sectionId && x.exerciceId === cle.exerciceId && x.mois === cle.mois);
            if (l) {
                l.montant = Number(update.montant);
                return Promise.resolve(l);
            }
            return Promise.resolve(inserer(create));
        }),
    });
    const budgetSection = delegue();
    return {
        budgetSection,
        lire: () => lignes,
        $transaction: jest.fn(async (fn) => {
            const avant = lignes.map((l) => ({ ...l }));
            try {
                return await fn({ budgetSection });
            }
            catch (e) {
                lignes = avant;
                throw e;
            }
        }),
    };
}
function service(lignes, options = {}) {
    const t = table(lignes, options);
    const prisma = {
        sectionAnalytique: {
            findFirst: jest.fn().mockResolvedValue({
                id: 's1',
                tenantId: 't1',
                type: 'DETAIL',
                dateDebut: null,
                dateFin: null,
                plan: { gererBudgets: true, code: 'PROJ' },
                ...options.section,
            }),
        },
        exercice: {
            findFirst: jest.fn(({ where }) => Promise.resolve([ANNEE, LONG].find((e) => e.id === where.id && e.tenantId === where.tenantId) ?? null)),
        },
        budgetSection: t.budgetSection,
        $transaction: t.$transaction,
    };
    return { svc: new analytique_service_1.AnalytiqueService(prisma), lire: t.lire };
}
const dote = (montantAnnuel, exerciceId = 'ex1') => [
    { id: 'a', sectionId: 's1', exerciceId, mois: null, montant: montantAnnuel },
    ...Array.from({ length: 12 }, (_, i) => ({
        id: `m${i + 1}`,
        sectionId: 's1',
        exerciceId,
        mois: i + 1,
        montant: montantAnnuel / 12,
    })),
];
const annuelles = (lignes) => lignes.filter((l) => l.mois === null);
describe('F38 · la retouche d’un mois atteint l’annuelle, dans la même transaction', () => {
    it('le mois change et l’annuelle suit la somme des mois · une seule ligne annuelle', async () => {
        const { svc, lire } = service(dote(1200));
        await svc.modifierBudgetMois('t1', 's1', { exerciceId: 'ex1', mois: 3, montant: 400 });
        expect(lire().find((l) => l.mois === 3).montant).toBe(400);
        expect(annuelles(lire())).toEqual([expect.objectContaining({ montant: 1500 })]);
    });
    it('sans ligne annuelle, elle est créée à la somme des mois', async () => {
        const { svc, lire } = service(dote(1200).filter((l) => l.mois !== null));
        await svc.modifierBudgetMois('t1', 's1', { exerciceId: 'ex1', mois: 1, montant: 0 });
        expect(annuelles(lire())).toEqual([expect.objectContaining({ montant: 1100 })]);
    });
    it('une annuelle qui ne s’écrit pas laisse le mois intact', async () => {
        const { svc, lire } = service(dote(1200), { echecAnnuelle: true });
        await expect(svc.modifierBudgetMois('t1', 's1', { exerciceId: 'ex1', mois: 3, montant: 400 })).rejects.toThrow(/panne/);
        expect(lire().find((l) => l.mois === 3).montant).toBe(100);
    });
    it('les refus de la dotation valent pour la retouche', async () => {
        const total = service(dote(1200), { section: { type: 'TOTAL' } });
        await expect(total.svc.modifierBudgetMois('t1', 's1', { exerciceId: 'ex1', mois: 3, montant: 1 })).rejects.toThrow(/Total ne se dote pas/);
        const sansBudget = service(dote(1200), { section: { plan: { gererBudgets: false, code: 'PROJ' } } });
        await expect(sansBudget.svc.modifierBudgetMois('t1', 's1', { exerciceId: 'ex1', mois: 3, montant: 1 })).rejects.toThrow(/ne gère pas les budgets/);
        const voisin = service(dote(1200));
        await expect(voisin.svc.modifierBudgetMois('t2', 's1', { exerciceId: 'ex1', mois: 3, montant: 1 })).rejects.toThrow(/Exercice introuvable/);
    });
    it('un mois que la convention ne couvre pas ne reçoit rien', async () => {
        const { svc, lire } = service(dote(1200), {
            section: { dateDebut: new Date('2026-03-01'), dateFin: new Date('2026-10-31') },
        });
        await expect(svc.modifierBudgetMois('t1', 's1', { exerciceId: 'ex1', mois: 12, montant: 50 })).rejects.toThrow(/ne couvre pas le mois 12/);
        expect(lire().find((l) => l.mois === 12).montant).toBe(100);
    });
});
describe('F39 · un exercice de plus de douze mois se dote à l’année', () => {
    it('la dotation d’un exercice de dix-huit mois pose l’annuelle seule', async () => {
        const { svc, lire } = service([]);
        await svc.doterBudget('t1', 's1', { exerciceId: 'exL', montantAnnuel: 1800 });
        expect(lire()).toEqual([expect.objectContaining({ exerciceId: 'exL', mois: null, montant: 1800 })]);
    });
    it('un exercice civil garde sa répartition mensuelle', async () => {
        const { svc, lire } = service([]);
        await svc.doterBudget('t1', 's1', { exerciceId: 'ex1', montantAnnuel: 1200 });
        expect(lire().filter((l) => l.mois !== null)).toHaveLength(12);
    });
    it('la retouche d’un mois y est refusée', async () => {
        const { svc } = service([{ id: 'a', sectionId: 's1', exerciceId: 'exL', mois: null, montant: 1800 }]);
        await expect(svc.modifierBudgetMois('t1', 's1', { exerciceId: 'exL', mois: 8, montant: 100 })).rejects.toThrow(/revient deux fois/);
    });
    it('l’état budgétaire d’un mois y est refusé · le mois ne dit pas lequel des deux', async () => {
        const prisma = {
            planAnalytique: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', code: 'PROJ', gererBudgets: true }) },
            exercice: { findFirst: jest.fn().mockResolvedValue(LONG) },
        };
        const etats = new etats_analytiques_service_1.EtatsAnalytiquesService(prisma);
        await expect(etats.etatBudgetaire('t1', { planId: 'p1', exerciceId: 'exL', mois: 8 })).rejects.toThrow(/revient deux fois/);
    });
});
//# sourceMappingURL=budget-mois-f38-f39.spec.js.map