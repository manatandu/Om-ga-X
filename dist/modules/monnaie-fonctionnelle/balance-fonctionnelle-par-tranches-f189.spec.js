"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const balance_fonctionnelle_service_1 = require("./balance-fonctionnelle.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const j = (s) => new Date(`${s}T00:00:00.000Z`);
const COURS = [
    { date: j('2026-01-01'), cours: 2500 },
    { date: j('2026-06-01'), cours: 2800 },
];
const EX26 = { id: 'ex26', tenantId: 't1', dateDebut: j('2026-01-01'), dateFin: j('2026-12-31') };
const ligne = (numero, debit, credit, usd = null) => ({
    debit,
    credit,
    montantDevise: usd,
    devise: usd === null ? null : { code: 'USD' },
    compte: { id: `c${numero}`, numero, intitule: `Compte ${numero}` },
});
const idDe = (i) => `e-${String(i).padStart(5, '0')}`;
function ecritureNo(i, exerciceId = 'ex26') {
    const base = { id: idDe(i), tenantId: 't1', exerciceId };
    if (i % 3 === 0) {
        return { ...base, date: j('2026-03-01'), lignes: [ligne('60100000', 250_000, 0), ligne('40100000', 0, 250_000)] };
    }
    if (i % 3 === 1) {
        return { ...base, date: j('2026-07-01'), lignes: [ligne('52100000', 280_000, 0), ligne('70100000', 0, 280_000)] };
    }
    return {
        ...base,
        date: j('2026-09-15'),
        lignes: [ligne('52100000', 285_600, 0, 100), ligne('41100000', 0, 285_600)],
    };
}
const N = 2 * lecture_par_lots_1.LOT_ECRITURES + 7;
function doublure(stock, exercices = [EX26], cours = COURS) {
    const lectures = [];
    const retient = (e, w) => (w.tenantId === undefined || e.tenantId === w.tenantId) &&
        (w.exerciceId === undefined || e.exerciceId === w.exerciceId) &&
        (w.estGenereeParCloture === undefined || (e.gpc ?? false) === w.estGenereeParCloture) &&
        (w.estSoldeDesComptesDeGestion === undefined || (e.sdcg ?? false) === w.estSoldeDesComptesDeGestion);
    const pagine = (liste, p) => {
        const triee = p.orderBy?.id ? [...liste].sort((a, b) => a.id.localeCompare(b.id)) : liste;
        if (p.orderBy?.id === 'desc')
            triee.reverse();
        const debut = p.cursor ? triee.findIndex((x) => x.id === p.cursor.id) + (p.skip ?? 0) : 0;
        return triee.slice(debut, p.take === undefined ? undefined : debut + p.take);
    };
    const vuesLignes = stock.flatMap((e) => e.lignes.map((l, i) => ({ id: `${e.id}-${i}`, e, l })));
    const noter = (modele, where, p, rendues) => lectures.push({ modele, where, ...p, rendues: rendues.length, ids: rendues.map((x) => x.id) });
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ devise: 'CDF', deviseFonctionnelle: 'USD' }) },
        exercice: {
            findFirst: jest.fn(({ where }) => {
                const du = exercices.filter((e) => e.tenantId === where.tenantId);
                if (where.id)
                    return Promise.resolve(du.find((e) => e.id === where.id) ?? null);
                const avant = du.filter((e) => e.dateFin.getTime() < where.dateFin.lt.getTime());
                return Promise.resolve(avant.sort((a, b) => b.dateFin.getTime() - a.dateFin.getTime())[0] ?? null);
            }),
        },
        devise: { findFirst: jest.fn().mockResolvedValue({ id: 'd1', code: 'USD', cours }) },
        ecriture: {
            findMany: jest.fn(async ({ where, ...p }) => {
                const rendues = pagine(stock.filter((e) => retient(e, where)), p).map((e) => ({ id: e.id, date: e.date, lignes: e.lignes }));
                noter('ecriture', where, p, rendues);
                return rendues;
            }),
        },
        ligneEcriture: {
            findMany: jest.fn(async ({ where, ...p }) => {
                const rendues = pagine(vuesLignes.filter((v) => retient(v.e, where.ecriture)), p).map((v) => ({ id: v.id, ...v.l, ecriture: { id: v.e.id, date: v.e.date } }));
                noter('ligneEcriture', where.ecriture, p, rendues);
                return rendues;
            }),
            findFirst: jest.fn(async ({ where }) => {
                const v = vuesLignes.find((x) => retient(x.e, where.ecriture) &&
                    (!where.compte || x.l.compte.numero.startsWith(where.compte.numero.startsWith)));
                return v ? { id: v.id, compte: v.l.compte } : null;
            }),
        },
    };
    return { svc: new balance_fonctionnelle_service_1.BalanceFonctionnelleService(prisma), lectures };
}
const stockDeTroisTranches = () => Array.from({ length: N }, (_, i) => ecritureNo(i)).reverse();
describe('F189 · la balance fonctionnelle lue par tranches', () => {
    it('rend, sur trois tranches, la balance calculée à la main', async () => {
        const { svc } = doublure(stockDeTroisTranches());
        const r = await svc.balance('t1', 'ex26');
        expect(r.lignes.map((l) => [l.numero, l.ouvertureDebit, l.ouvertureCredit, l.debit, l.credit, l.solde])).toEqual([
            ['40100000', 0, 0, 0, 33_600, -33_600],
            ['41100000', 0, 0, 0, 34_170, -34_170],
            ['52100000', 0, 0, 67_100, 0, 67_100],
            ['60100000', 0, 0, 33_600, 0, 33_600],
            ['70100000', 0, 0, 0, 33_600, -33_600],
        ]);
        expect(r.totaux).toEqual({ debit: 100_700, credit: 101_370, ecartDeConversion: -670, dontOuverture: 0 });
        expect(r.origine).toEqual({
            lignes: 2 * N,
            lignesExactes: 335,
            lignesConverties: 2 * N - 335,
            ecritures: N,
            ouverture: 'AUCUNE',
        });
        expect(r.mention).toBe(balance_fonctionnelle_service_1.BalanceFonctionnelleService.MENTION_SANS_VALEUR_LEGALE);
    });
    it('aucune lecture n’est sans borne · les écritures viennent par LOT_ECRITURES, curseur exclu', async () => {
        const { svc, lectures } = doublure(stockDeTroisTranches());
        await svc.balance('t1', 'ex26');
        expect(lectures.length).toBeGreaterThan(0);
        for (const l of lectures) {
            expect(l.take).toBe(lecture_par_lots_1.LOT_ECRITURES);
            expect(l.rendues).toBeLessThanOrEqual(lecture_par_lots_1.LOT_ECRITURES);
        }
        const mouvements = lectures.filter((l) => l.modele === 'ecriture' && l.where.estGenereeParCloture === false);
        expect(mouvements).toHaveLength(3);
        expect(mouvements.map((l) => l.rendues)).toEqual([lecture_par_lots_1.LOT_ECRITURES, lecture_par_lots_1.LOT_ECRITURES, 7]);
        expect(mouvements[0].cursor).toBeUndefined();
        expect(mouvements[1]).toMatchObject({ cursor: { id: idDe(lecture_par_lots_1.LOT_ECRITURES - 1) }, skip: 1, orderBy: { id: 'asc' } });
        expect(mouvements[2]).toMatchObject({ cursor: { id: idDe(2 * lecture_par_lots_1.LOT_ECRITURES - 1) }, skip: 1 });
        for (const l of mouvements)
            expect(l.where).toMatchObject({ tenantId: 't1', exerciceId: 'ex26' });
        const lues = mouvements.flatMap((l) => l.ids);
        expect(new Set(lues).size).toBe(N);
    });
    it('le refus rend les dates sans cours de TOUTES les tranches, pas seulement de la première', async () => {
        const stock = Array.from({ length: N }, (_, i) => ecritureNo(i));
        stock[3] = { ...stock[3], date: j('2025-12-10') };
        stock[2 * lecture_par_lots_1.LOT_ECRITURES + 5] = { ...stock[2 * lecture_par_lots_1.LOT_ECRITURES + 5], date: j('2025-12-20') };
        const { svc, lectures } = doublure(stock);
        const refus = svc.balance('t1', 'ex26');
        await expect(refus).rejects.toThrow(/à 2 date\(s\) d'écriture \(2025-12-10, 2025-12-20\)/);
        expect(lectures.filter((l) => l.modele === 'ecriture' && l.where.estGenereeParCloture === false)).toHaveLength(3);
    });
    it('le cours se cherche une fois par date, pas une fois par écriture', async () => {
        const espion = jest.spyOn(balance_fonctionnelle_service_1.BalanceFonctionnelleService, 'coursApplicable');
        try {
            const { svc } = doublure(stockDeTroisTranches());
            await svc.balance('t1', 'ex26');
            expect(espion).toHaveBeenCalledTimes(3);
        }
        finally {
            espion.mockRestore();
        }
    });
    it('une écriture sans ligne n’est ni comptée ni datée · comme avant, quand la lecture partait des lignes', async () => {
        const stock = stockDeTroisTranches();
        stock.push({ id: 'e-vide', tenantId: 't1', exerciceId: 'ex26', date: j('2025-06-01'), lignes: [] });
        const { svc } = doublure(stock);
        const r = await svc.balance('t1', 'ex26');
        expect(r.origine.ecritures).toBe(N);
        expect(r.totaux.ecartDeConversion).toBe(-670);
    });
});
describe('F189 · l’à-nouveau ne se relit que s’il faut le convertir', () => {
    const EX27 = { id: 'ex27', tenantId: 't1', dateDebut: j('2027-01-01'), dateFin: j('2027-12-31') };
    const COURS_27 = [...COURS, { date: j('2027-01-01'), cours: 3200 }];
    const aNouveau = {
        id: 'an-27',
        tenantId: 't1',
        exerciceId: 'ex27',
        date: j('2027-01-01'),
        gpc: true,
        lignes: [ligne('52100000', 3_200_000, 0), ligne('10100000', 0, 3_200_000)],
    };
    const recette = {
        id: 'rec-27',
        tenantId: 't1',
        exerciceId: 'ex27',
        date: j('2027-03-10'),
        lignes: [ligne('52100000', 320_000, 0), ligne('70100000', 0, 320_000)],
    };
    it('avec un exercice précédent, l’ouverture vient de son jeu, et l’à-nouveau n’est jamais lu en entier', async () => {
        const stock2026 = Array.from({ length: N }, (_, i) => ecritureNo(i));
        const { svc, lectures } = doublure([...stock2026, aNouveau, recette], [EX26, EX27], COURS_27);
        const r = await svc.balance('t1', 'ex27');
        expect(r.origine.ouverture).toBe('EXERCICE_PRECEDENT');
        const lu2026 = lectures.filter((l) => l.modele === 'ecriture' && l.where.exerciceId === 'ex26');
        expect(lu2026.map((l) => l.rendues)).toEqual([lecture_par_lots_1.LOT_ECRITURES, lecture_par_lots_1.LOT_ECRITURES, 7]);
        expect(lectures.filter((l) => l.where.estGenereeParCloture === true)).toEqual([]);
        expect(r.lignes.find((l) => l.numero === '52100000')).toMatchObject({ ouvertureDebit: 67_100, debit: 67_200 });
    });
    it('sans exercice précédent (reprise), l’à-nouveau est lu par tranches et converti à sa date', async () => {
        const { svc, lectures } = doublure([aNouveau, recette], [EX27], COURS_27);
        const r = await svc.balance('t1', 'ex27');
        expect(r.origine.ouverture).toBe('CONVERTIE_A_SA_DATE');
        const lu = lectures.filter((l) => l.where.estGenereeParCloture === true);
        expect(lu).toHaveLength(1);
        expect(lu[0]).toMatchObject({ take: lecture_par_lots_1.LOT_ECRITURES, where: { tenantId: 't1', exerciceId: 'ex27' } });
        expect(r.lignes.find((l) => l.numero === '52100000')).toMatchObject({ ouvertureDebit: 1000, debit: 1100 });
        expect(r.origine).toMatchObject({ lignes: 4, ecritures: 2 });
    });
    it('une reprise CLOSE · la relecture de l’à-nouveau laisse dehors l’écriture qui solde les comptes de gestion', async () => {
        const cloture = {
            id: 'clo-27',
            tenantId: 't1',
            exerciceId: 'ex27',
            date: j('2027-12-31'),
            gpc: true,
            sdcg: true,
            lignes: [ligne('70100000', 320_000, 0), ligne('13100000', 0, 320_000)],
        };
        const { svc, lectures } = doublure([aNouveau, recette, cloture], [EX27], COURS_27);
        const r = await svc.balance('t1', 'ex27');
        expect(r.origine).toEqual({ lignes: 4, lignesExactes: 0, lignesConverties: 4, ecritures: 2, ouverture: 'CONVERTIE_A_SA_DATE' });
        expect(r.lignes.map((l) => [l.numero, l.ouvertureDebit, l.ouvertureCredit, l.debit, l.credit])).toEqual([
            ['10100000', 0, 1000, 0, 1000],
            ['52100000', 1000, 0, 1100, 0],
            ['70100000', 0, 0, 0, 100],
        ]);
        const lu = lectures.filter((l) => l.where.estGenereeParCloture === true);
        expect(lu).toHaveLength(1);
        expect(lu[0].where).toEqual({
            tenantId: 't1',
            exerciceId: 'ex27',
            estGenereeParCloture: true,
            estSoldeDesComptesDeGestion: false,
            statut: { not: 'SITUATION' },
        });
    });
});
//# sourceMappingURL=balance-fonctionnelle-par-tranches-f189.spec.js.map