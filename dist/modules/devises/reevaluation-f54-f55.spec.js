"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const devises_service_1 = require("./devises.service");
const exercice_service_1 = require("../exercice/exercice.service");
const report_a_nouveau_1 = require("../exercice/report-a-nouveau");
const ligne = (debit, credit, devise, lettre = null) => ({
    debit,
    credit,
    lettre,
    libelle: 'L',
    dateEcheance: null,
    deviseId: devise?.id ?? null,
    montantDevise: devise?.montant ?? null,
    coursApplique: devise?.cours ?? null,
});
describe('F55 · la devise suit le report à-nouveau', () => {
    it('en DÉTAIL, chaque ligne reportée garde sa devise, son montant et son cours', () => {
        const client = {
            id: '411',
            numero: '41110000',
            intitule: 'Clients',
            modeReportANouveau: 'DETAIL',
            lignes: [ligne(280_000, 0, { id: 'usd', montant: 100, cours: 2800 }), ligne(5_000, 0)],
        };
        const r = (0, report_a_nouveau_1.lignesReportANouveau)([client], null);
        expect(r.map((l) => [l.debit, l.deviseId ?? null, l.montantDevise ?? null, l.coursApplique ?? null])).toEqual([
            [280_000, 'usd', 100, 2800],
            [5_000, null, null, null],
        ]);
    });
    it('en SOLDE, une ligne par devise au cours moyen, et le reste en francs', () => {
        const banque = {
            id: '521',
            numero: '52120000',
            intitule: 'Banque USD',
            modeReportANouveau: 'SOLDE',
            lignes: [
                ligne(280_000, 0, { id: 'usd', montant: 100 }),
                ligne(0, 145_000, { id: 'usd', montant: 50 }),
                ligne(10_000, 0),
            ],
        };
        const r = (0, report_a_nouveau_1.lignesReportANouveau)([banque], null);
        expect(r).toEqual([
            expect.objectContaining({ debit: 135_000, credit: 0, deviseId: 'usd', montantDevise: 50, coursApplique: 2700 }),
            expect.objectContaining({ debit: 10_000, credit: 0 }),
        ]);
        expect(r[1].deviseId).toBeUndefined();
        expect(r.reduce((t, l) => t + l.debit - l.credit, 0)).toBe(145_000);
    });
    it('une dette en devise se reporte au crédit, avec son montant en devise sans signe', () => {
        const fournisseur = {
            id: '162',
            numero: '16200000',
            intitule: 'Emprunt',
            modeReportANouveau: 'SOLDE',
            lignes: [ligne(0, 2_800_000, { id: 'usd', montant: 1000 })],
        };
        expect((0, report_a_nouveau_1.lignesReportANouveau)([fournisseur], null)).toEqual([
            expect.objectContaining({ debit: 0, credit: 2_800_000, deviseId: 'usd', montantDevise: 1000, coursApplique: 2800 }),
        ]);
    });
    it('une devise dont les deux soldes ne sont pas de même sens reste en francs', () => {
        const banque = {
            id: '521',
            numero: '52120000',
            intitule: 'Banque USD',
            modeReportANouveau: 'SOLDE',
            lignes: [ligne(280_000, 0, { id: 'usd', montant: 100 }), ligne(0, 272_700, { id: 'usd', montant: 101 })],
        };
        const r = (0, report_a_nouveau_1.lignesReportANouveau)([banque], null);
        expect(r).toHaveLength(1);
        expect(r[0]).toMatchObject({ debit: 7_300 });
        expect(r[0].deviseId).toBeUndefined();
    });
});
const estReference = (x) => !!x && typeof x === 'object' && 'modelName' in x;
function champ(r, v, f) {
    if (f === null || typeof f !== 'object')
        return v === f;
    return Object.entries(f).every(([op, x]) => {
        const o = estReference(x) ? r[x.name] : x;
        if (op === 'not')
            return o === null ? v !== null : typeof o === 'object' ? !champ(r, v, o) : v !== null && v !== o;
        if (v === null || v === undefined)
            return false;
        if (op === 'equals')
            return v === o;
        if (op === 'in')
            return o.includes(v);
        if (op === 'gt')
            return v > o;
        if (op === 'gte')
            return v >= o;
        if (op === 'lt')
            return v < o;
        if (op === 'lte')
            return v <= o;
        throw new Error(`doublure : filtre « ${op} » non honoré`);
    });
}
function correspond(r, where) {
    return Object.entries((where ?? {})).every(([cle, f]) => {
        if (cle === 'AND')
            return [].concat(f).every((w) => correspond(r, w));
        if (cle === 'OR')
            return f.some((w) => correspond(r, w));
        if (cle === 'NOT')
            return [].concat(f).every((w) => !correspond(r, w));
        if (cle === 'ecriture' || cle === 'compte')
            return correspond(r[cle], f);
        return champ(r, r[cle], f);
    });
}
function lectureDuReport(comptes) {
    const lignes = comptes.flatMap((c) => c.lignesEcriture.map((l, i) => ({
        id: `${c.id}-${String(i).padStart(4, '0')}`,
        compteId: c.id,
        compte: c,
        deviseId: null,
        montantDevise: null,
        coursApplique: null,
        ...l,
        ecriture: { tenantId: 't', exerciceId: 'n', statut: 'VALIDEE', ...l.ecriture },
    })));
    const projeter = (r, select) => Object.fromEntries(Object.entries(select).map(([k, v]) => [k, v === true ? r[k] : { libelle: r[k].libelle }]));
    return {
        compte: {
            findMany: jest.fn(async (a) => {
                if (a.include)
                    throw new Error('doublure : include non honoré');
                return comptes
                    .filter((c) => correspond({ tenantId: 't', ...c }, a.where))
                    .sort((x, y) => (x.numero < y.numero ? -1 : 1))
                    .map((c) => Object.fromEntries(Object.keys(a.select).map((k) => [k, c[k]])));
            }),
        },
        ligneEcriture: {
            fields: { credit: { modelName: 'LigneEcriture', name: 'credit' } },
            groupBy: jest.fn(async (a) => {
                const groupes = new Map();
                for (const l of lignes.filter((x) => correspond(x, a.where))) {
                    const cle = JSON.stringify(a.by.map((k) => l[k]));
                    const g = groupes.get(cle) ?? { ...Object.fromEntries(a.by.map((k) => [k, l[k]])), _sum: {} };
                    const somme = g._sum;
                    for (const k of Object.keys(a._sum))
                        somme[k] = l[k] === null ? (somme[k] ?? null) : (somme[k] ?? 0) + l[k];
                    groupes.set(cle, g);
                }
                return [...groupes.values()];
            }),
            findMany: jest.fn(async (a) => {
                let r = lignes.filter((x) => correspond(x, a.where)).sort((x, y) => (x.id < y.id ? -1 : 1));
                if (a.cursor)
                    r = r.slice(r.findIndex((x) => x.id === a.cursor.id) + (a.skip ?? 0));
                return r.slice(0, a.take).map((x) => projeter(x, a.select));
            }),
        },
    };
}
describe('F55 · la clôture passe la devise au report', () => {
    const N = { id: 'n', tenantId: 't', statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
    const N1 = { id: 'n1', tenantId: 't', statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };
    const prismaLigne = (debit, credit, devise) => ({
        debit,
        credit,
        lettre: null,
        libelle: 'L',
        dateEcheance: null,
        deviseId: devise?.id ?? null,
        montantDevise: devise?.montant ?? null,
        coursApplique: null,
        ecriture: { libelle: 'E' },
    });
    it('la ligne de report de la banque en dollars porte la devise et son montant', async () => {
        const comptes = [
            { id: '521', numero: '52120000', intitule: 'Banque USD', modeReportANouveau: 'SOLDE', lignesEcriture: [prismaLigne(280_000, 0, { id: 'usd', montant: 100 })] },
            { id: '101', numero: '10100000', intitule: 'Capital', modeReportANouveau: 'SOLDE', lignesEcriture: [prismaLigne(0, 280_000, null)] },
        ];
        const lecture = lectureDuReport(comptes);
        const tx = {
            compte: { findMany: lecture.compte.findMany, findUnique: jest.fn().mockResolvedValue({ id: '131' }) },
            journal: { findFirst: jest.fn().mockResolvedValue({ id: 'od', code: 'OD' }) },
            exercice: { findFirst: jest.fn().mockResolvedValue(N1), findMany: jest.fn().mockResolvedValue([N, N1]), create: jest.fn(), update: jest.fn().mockResolvedValue({ ...N, statut: 'CLOTURE' }) },
            ecriture: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), delete: jest.fn(), create: jest.fn().mockResolvedValue({ lignes: [] }) },
            ligneEcriture: { ...lecture.ligneEcriture, count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn() },
            creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
            lettrage: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const prisma = {
            exercice: {
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.dateFin || where.dateDebut ? null : N)),
            },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
            ecriture: { count: jest.fn().mockResolvedValue(0) },
            lettrage: { count: jest.fn().mockResolvedValue(0) },
            ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
            creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
            $transaction: jest.fn((fn) => fn(tx)),
        };
        const s = new exercice_service_1.ExerciceService(prisma, { prochainNumeroPiece: jest.fn().mockResolvedValue(1) });
        await s.cloturer('t', 'n', 'u');
        const ran = tx.ecriture.create.mock.calls.map((c) => c[0].data).find((d) => d.exerciceId === 'n1');
        expect(ran.lignes.create.find((l) => l.compteId === '521')).toMatchObject({
            debit: 280_000,
            deviseId: 'usd',
            montantDevise: 100,
            coursApplique: 2800,
        });
    });
});
describe('F54 · une seule réévaluation passée par exercice', () => {
    function service(dejaPassee) {
        const prisma = {
            exercice: {
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn().mockResolvedValue({ id: 'ex1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' }),
            },
            ligneEcriture: {
                aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }),
                findMany: jest.fn().mockResolvedValue([
                    {
                        compteId: 'c411',
                        deviseId: 'usd',
                        debit: 2_800_000,
                        credit: 0,
                        montantDevise: 1000,
                        compte: { id: 'c411', numero: '41110000', intitule: 'Clients' },
                        devise: { id: 'usd', code: 'USD' },
                    },
                ]),
            },
            coursDevise: { findFirst: jest.fn().mockResolvedValue({ cours: 2500 }) },
            provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
            verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
            ecriture: { count: jest.fn().mockResolvedValue(1) },
            reevaluation: {
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(dejaPassee && (!where.dateReevaluation || where.dateReevaluation.getTime() === dejaPassee.dateReevaluation.getTime())
                    ? dejaPassee
                    : null)),
                create: jest.fn().mockResolvedValue({ id: 'r1' }),
            },
            tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
            journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j-od', code: 'OD' }) },
            compte: {
                findFirst: jest.fn(({ where }) => Promise.resolve({ id: `c-${where.numero.startsWith}`, numero: where.numero.startsWith.padEnd(8, '0') })),
            },
        };
        const ecritureService = { creer: jest.fn().mockResolvedValue({ id: 'e1' }) };
        return { s: new devises_service_1.DevisesService(prisma, ecritureService), ecritureService };
    }
    it('refuse une seconde réévaluation à une autre date, et ne passe rien', async () => {
        const { s, ecritureService } = service({ dateReevaluation: new Date('2026-06-30') });
        await expect(s.reevaluer('t1', 'u1', { exerciceId: 'ex1', dateReevaluation: '2026-12-31' })).rejects.toThrow(/déjà été passée au 2026-06-30.*repasserait l'écart entier/);
        expect(ecritureService.creer).not.toHaveBeenCalled();
    });
    it('passe la première', async () => {
        const { s, ecritureService } = service(null);
        await s.reevaluer('t1', 'u1', { exerciceId: 'ex1', dateReevaluation: '2026-12-31' });
        expect(ecritureService.creer).toHaveBeenCalled();
    });
    it('le calcul, qui n’enregistre rien, reste ouvert pour une situation intermédiaire', async () => {
        const { s } = service({ dateReevaluation: new Date('2026-06-30') });
        await expect(s.calculer('t1', { exerciceId: 'ex1', dateReevaluation: '2026-12-31' })).resolves.toMatchObject({
            positions: [expect.objectContaining({ ecart: -300_000 })],
        });
    });
});
//# sourceMappingURL=reevaluation-f54-f55.spec.js.map