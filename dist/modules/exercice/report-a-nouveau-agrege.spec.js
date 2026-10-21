"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma_retry_util_1 = require("../../common/prisma-retry.util");
const reconduction_lettrage_1 = require("../lettrage/reconduction-lettrage");
const exercice_service_1 = require("./exercice.service");
const report_a_nouveau_1 = require("./report-a-nouveau");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const arrondi2 = (x) => Math.round(x * 100) / 100;
const soldeAncien = (c) => c.lignes.reduce((s, l) => s + l.debit - l.credit, 0);
function soldesParDeviseAncien(c) {
    const parDevise = new Map();
    for (const l of c.lignes) {
        if (!l.deviseId || !l.montantDevise)
            continue;
        const net = l.debit - l.credit;
        const sens = net >= 0 ? 1 : -1;
        const g = parDevise.get(l.deviseId) ?? { deviseId: l.deviseId, francs: 0, devise: 0 };
        g.francs += net;
        g.devise += sens * l.montantDevise;
        parDevise.set(l.deviseId, g);
    }
    return [...parDevise.values()]
        .map((g) => ({ ...g, francs: arrondi2(g.francs), devise: arrondi2(g.devise) }))
        .filter((g) => Math.abs(g.francs) > 0.005 && Math.abs(g.devise) > 0.005 && Math.sign(g.francs) === Math.sign(g.devise));
}
function reportLigneALigne(comptes, resultat) {
    const lignes = [];
    for (const c of comptes.filter((x) => x.modeReportANouveau === 'SOLDE')) {
        const s = soldeAncien(c) + (resultat && c.id === resultat.compteId ? resultat.montant : 0);
        if (Math.abs(s) <= 0.005)
            continue;
        let reste = s;
        for (const g of soldesParDeviseAncien(c)) {
            lignes.push({
                compteId: c.id,
                debit: g.francs > 0 ? g.francs : 0,
                credit: g.francs < 0 ? -g.francs : 0,
                libelle: `Report à-nouveau ${c.numero} · ${c.intitule} · en devise`,
                deviseId: g.deviseId,
                montantDevise: Math.abs(g.devise),
                coursApplique: Math.round((Math.abs(g.francs) / Math.abs(g.devise)) * 1e6) / 1e6,
            });
            reste -= g.francs;
        }
        reste = arrondi2(reste);
        if (Math.abs(reste) <= 0.005)
            continue;
        lignes.push({ compteId: c.id, debit: reste > 0 ? reste : 0, credit: reste < 0 ? -reste : 0, libelle: `Report à-nouveau ${c.numero} · ${c.intitule}` });
    }
    for (const c of comptes.filter((x) => x.modeReportANouveau === 'DETAIL')) {
        for (const l of c.lignes) {
            if (l.lettre)
                continue;
            lignes.push({
                compteId: c.id,
                debit: l.debit,
                credit: l.credit,
                libelle: `RAN détail ${c.numero} · ${l.libelle}`,
                dateEcheance: l.dateEcheance,
                ...(l.deviseId && l.montantDevise
                    ? { deviseId: l.deviseId, montantDevise: l.montantDevise, ...(l.coursApplique ? { coursApplique: l.coursApplique } : {}) }
                    : {}),
            });
        }
    }
    return lignes;
}
const canon = (lignes) => lignes
    .map((l) => JSON.stringify({
    compteId: l.compteId,
    debit: Math.round(Number(l.debit) * 100),
    credit: Math.round(Number(l.credit) * 100),
    libelle: l.libelle,
    deviseId: l.deviseId ?? null,
    montantDevise: l.montantDevise == null ? null : Math.round(Number(l.montantDevise) * 100),
    coursApplique: l.coursApplique == null ? null : Math.round(Number(l.coursApplique) * 1e6),
    dateEcheance: l.dateEcheance ? l.dateEcheance.toISOString() : null,
}))
    .sort();
const estReference = (x) => !!x && typeof x === 'object' && 'modelName' in x && 'name' in x;
function champ(r, v, f) {
    if (f === null)
        return (v ?? null) === null;
    if (typeof f !== 'object' || f instanceof Date)
        return v === f;
    return Object.entries(f).every(([op, x]) => {
        const o = estReference(x) ? r[x.name] : x;
        switch (op) {
            case 'equals':
                return v === o;
            case 'not':
                if (o === null)
                    return v !== null;
                if (typeof o === 'object')
                    return !champ(r, v, o);
                return v !== null && v !== o;
            case 'in':
                return o.includes(v);
            case 'gt':
                return v !== null && v > o;
            case 'gte':
                return v !== null && v >= o;
            case 'lt':
                return v !== null && v < o;
            case 'lte':
                return v !== null && v <= o;
            default:
                throw new Error(`doublure : filtre « ${op} » non honoré`);
        }
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
        if (cle === 'correction') {
            const relation = f;
            if (!('is' in relation) || relation.is !== null)
                throw new Error('doublure : filtre de correction non honoré');
            return !r.correction;
        }
        if (cle === 'lettrage') {
            const groupe = r.lettrage;
            if (!groupe)
                return false;
            return Object.entries(f).every(([k, v]) => {
                const relation = v;
                if (k !== 'lignes' || relation.some === undefined)
                    throw new Error(`doublure : filtre de groupe « ${k} » non honoré`);
                return groupe.lignes.some((x) => correspond(x, relation.some));
            });
        }
        return champ(r, r[cle], f);
    });
}
function projeter(r, select) {
    if (!select)
        return { ...r };
    const sortie = {};
    for (const [cle, v] of Object.entries(select)) {
        if (v === true)
            sortie[cle] = ['debit', 'credit', 'montantDevise', 'coursApplique'].includes(cle) && r[cle] !== null ? new client_1.Prisma.Decimal(r[cle]) : r[cle];
        else if (v && typeof v === 'object') {
            const sous = v.select;
            sortie[cle] = Array.isArray(r[cle])
                ? r[cle].map((x) => projeter(x, sous))
                : r[cle] === null || r[cle] === undefined
                    ? null
                    : projeter(r[cle], sous);
        }
    }
    return sortie;
}
const N = { id: 'n', tenantId: 't', statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const N1 = { id: 'n1', tenantId: 't', statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };
function groupeCorrespond(g, where) {
    return Object.entries((where ?? {})).every(([cle, f]) => {
        if (cle === 'NOT')
            return [].concat(f).every((w) => !groupeCorrespond(g, w));
        if (cle === 'compte')
            return correspond(g.compte, f);
        if (cle === 'lignes') {
            const some = f.some;
            if (some === undefined)
                throw new Error('doublure : filtre de lignes non honoré');
            return g.lignes.some((l) => correspond(l, some));
        }
        return champ(g, g[cle] ?? null, f);
    });
}
function base(comptes, lignes, referentiel = 'SYSCOHADA', groupes = [], exercicesDuJeu = [
    { ...N, statut: 'OUVERT' },
    { ...N1, statut: 'OUVERT' },
]) {
    const lus = [];
    let creees = 0;
    const groupeVu = (g) => ({
        ...g,
        compte: comptes.find((c) => c.id === g.compteId),
        lignes: lignes.filter((l) => l.lettrageId === g.id),
    });
    const tx = {
        lettrage: {
            findMany: jest.fn(async (a) => {
                let r = groupes.map(groupeVu).filter((g) => groupeCorrespond(g, a.where)).sort((x, y) => (x.id < y.id ? -1 : 1));
                if (a.cursor)
                    r = r.slice(r.findIndex((x) => x.id === a.cursor.id) + (a.skip ?? 0));
                if (a.take !== undefined)
                    r = r.slice(0, a.take);
                return r.map((g) => projeter(g, a.select));
            }),
            create: jest.fn(async (a) => {
                const g = { id: `R${groupes.length + 1}`, ...a.data };
                groupes.push(g);
                return { id: g.id, statut: g.statut };
            }),
        },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        compte: {
            findMany: jest.fn(async (a) => {
                if (a.include)
                    throw new Error('doublure : include non honoré');
                expect(a.orderBy).toEqual({ numero: 'asc' });
                return comptes
                    .filter((c) => correspond(c, a.where))
                    .sort((x, y) => (x.numero < y.numero ? -1 : 1))
                    .map((c) => projeter(c, a.select));
            }),
            findUnique: jest.fn(async (a) => comptes.find((c) => c.tenantId === a.where.tenantId_numero.tenantId && c.numero === a.where.tenantId_numero.numero) ?? null),
        },
        ligneEcriture: {
            count: jest.fn().mockResolvedValue(0),
            fields: { credit: { modelName: 'LigneEcriture', name: 'credit' }, debit: { modelName: 'LigneEcriture', name: 'debit' } },
            groupBy: jest.fn(async (a) => {
                const groupes = new Map();
                for (const l of lignes.filter((x) => correspond(x, a.where))) {
                    const cle = JSON.stringify(a.by.map((k) => l[k]));
                    const g = groupes.get(cle) ?? {
                        ...Object.fromEntries(a.by.map((k) => [k, l[k]])),
                        _sum: Object.fromEntries(Object.keys(a._sum).map((k) => [k, null])),
                    };
                    const somme = g._sum;
                    for (const k of Object.keys(a._sum)) {
                        const v = l[k];
                        if (v !== null)
                            somme[k] = (somme[k] ?? new client_1.Prisma.Decimal(0)).plus(v);
                    }
                    groupes.set(cle, g);
                }
                return [...groupes.values()];
            }),
            findMany: jest.fn(async (a) => {
                if (a.take !== undefined)
                    expect(a.orderBy).toEqual({ id: 'asc' });
                let r = lignes.filter((x) => correspond(x, a.where)).sort((x, y) => (x.id < y.id ? -1 : 1));
                if (a.cursor)
                    r = r.slice(r.findIndex((x) => x.id === a.cursor.id) + (a.skip ?? 0));
                if (a.take !== undefined)
                    r = r.slice(0, a.take);
                if (a.distinct) {
                    const vus = new Set();
                    r = r.filter((x) => {
                        const cle = JSON.stringify(a.distinct.map((k) => x[k]));
                        if (vus.has(cle))
                            return false;
                        vus.add(cle);
                        return true;
                    });
                }
                lus.push(r);
                return r.map((x) => projeter(x, a.select));
            }),
            deleteMany: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn(async (a) => {
                const visees = lignes.filter((l) => correspond(l, a.where));
                for (const l of visees)
                    Object.assign(l, a.data);
                return { count: visees.length };
            }),
        },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'od', code: 'OD' }) },
        exercice: {
            findFirst: jest.fn().mockResolvedValue(N1),
            findMany: jest.fn(async () => exercicesDuJeu),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({ ...N, statut: 'CLOTURE' }),
        },
        ecriture: {
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            delete: jest.fn(),
            create: jest.fn(async (a) => {
                if (a.data.exerciceId !== N1.id)
                    return { lignes: [] };
                const nouvelles = a.data.lignes.create.map((l) => ({
                    lettre: null,
                    libelle: null,
                    dateEcheance: null,
                    deviseId: null,
                    montantDevise: null,
                    coursApplique: null,
                    lettrageId: null,
                    ...l,
                    id: l.id ?? `ran${String(++creees).padStart(4, '0')}`,
                    compte: comptes.find((c) => c.id === l.compteId),
                    ecriture: { tenantId: 't', exerciceId: N1.id, statut: 'VALIDEE', libelle: a.data.libelle, date: N1.dateDebut, estANouveauProvisoire: false },
                }));
                lignes.push(...nouvelles);
                return { lignes: nouvelles.map((l) => ({ id: l.id, compteId: l.compteId, debit: l.debit, credit: l.credit, dateEcheance: l.dateEcheance, deviseId: l.deviseId, montantDevise: l.montantDevise })) };
            }),
        },
    };
    const prisma = {
        exercice: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.dateFin || where.dateDebut ? null : N)),
        },
        lettrage: {
            count: jest.fn(async (a) => groupes.map(groupeVu).filter((g) => groupeCorrespond(g, a.where)).length),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel }) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        $transaction: jest.fn((fn) => fn(tx)),
    };
    const service = new exercice_service_1.ExerciceService(prisma, { prochainNumeroPiece: jest.fn().mockResolvedValue(7) });
    return { service, tx, lus, prisma };
}
const compte = (id, numero, mode, tenantId = 't') => ({ id, tenantId, numero, intitule: `Compte ${numero}`, modeReportANouveau: mode });
const COMPTES = [
    compte('601', '60110000', 'AUCUN'),
    compte('701', '70110000', 'AUCUN'),
    compte('521', '52110000', 'SOLDE'),
    compte('522', '52120000', 'SOLDE'),
    compte('162', '16200000', 'SOLDE'),
    compte('101', '10100000', 'SOLDE'),
    compte('131', '13100000', 'SOLDE'),
    compte('139', '13900000', 'SOLDE'),
    compte('411', '41110000', 'DETAIL'),
    compte('401', '40110000', 'DETAIL'),
    compte('v521', '52110000', 'SOLDE', 'voisin'),
];
const parId = new Map(COMPTES.map((c) => [c.id, c]));
let rang = 0;
function ligne(compteId, debit, credit, x = {}) {
    rang++;
    return {
        id: `l${String(rang).padStart(6, '0')}`,
        compteId,
        compte: parId.get(compteId),
        ecriture: { tenantId: parId.get(compteId).tenantId, exerciceId: 'n', statut: 'VALIDEE', libelle: 'Pièce', ...(x.ecriture ?? {}) },
        debit,
        credit,
        lettre: x.lettre ?? null,
        libelle: x.libelle === undefined ? 'L' : x.libelle,
        dateEcheance: x.dateEcheance ?? null,
        deviseId: x.deviseId ?? null,
        montantDevise: x.montantDevise ?? null,
        coursApplique: x.coursApplique ?? null,
        lettrageId: x.lettrageId ?? null,
    };
}
function relierLesGroupes(lignes) {
    for (const l of lignes)
        l.lettrage = l.lettrageId ? { lignes: lignes.filter((x) => x.lettrageId === l.lettrageId) } : null;
    return lignes;
}
const usd = { deviseId: 'usd' };
const eur = { deviseId: 'eur' };
const JEU = [
    ligne('521', 280_000.1, 0, { ...usd, montantDevise: 100.03 }),
    ligne('521', 0, 145_000.2, { ...usd, montantDevise: 50.01 }),
    ligne('521', -28_000.33, 0, { ...usd, montantDevise: 10 }),
    ligne('521', 0, -2_800.07, { ...usd, montantDevise: 1 }),
    ligne('521', 500, 500, { ...usd, montantDevise: 3 }),
    ligne('521', 700.01, 0, { ...usd }),
    ligne('521', 400, 0, { ...usd, montantDevise: 0 }),
    ligne('521', 900.5, 0, { montantDevise: 50 }),
    ligne('521', 10_000.02, 0),
    ligne('521', 330_000.3, 0, { ...eur, montantDevise: 100.07 }),
    ligne('521', 2_800_000.55, 0),
    ligne('521', 200, 0),
    ligne('522', 280_000, 0, { ...eur, montantDevise: 100 }),
    ligne('522', 0, 272_700.11, { ...eur, montantDevise: 101 }),
    ligne('162', 0, 2_800_000.55, { ...usd, montantDevise: 1000.2, coursApplique: 2799.45 }),
    ligne('162', 1_400.5, 0, { ...usd, montantDevise: 0.5, lettre: 'ZZ' }),
    ligne('521', 0, 1_400.5, { lettre: 'ZZ' }),
    ligne('101', 0, 280_000.1),
    ligne('101', 0, -28_000.33),
    ligne('101', -2_800.07, 0),
    ligne('101', 0, 330_000.3),
    ligne('101', 0, 280_000),
    ligne('601', 145_000.2, 0),
    ligne('601', 272_700.11, 0),
    ligne('601', 300.3, 0),
    ligne('701', 0, 700.01 + 400 + 900.5 + 10_000.02 + 300.1 + 200 + 50.5),
    ligne('411', 300.1, 0, { dateEcheance: new Date('2027-02-01'), ...usd, montantDevise: 0.11, coursApplique: 2728.18 }),
    ligne('411', 200, 0, { lettre: 'AA' }),
    ligne('411', 0, 200, { lettre: 'AA' }),
    ligne('411', 50.5, 0, { lettre: '', libelle: null }),
    ligne('401', 0, 300.3),
    ligne('521', 7_777.77, 0, { ...usd, montantDevise: 2.5, ecriture: { statut: 'BROUILLARD' } }),
    ligne('701', 0, 7_777.77, { ecriture: { statut: 'BROUILLARD' } }),
    ligne('411', 99.99, 0, { ecriture: { statut: 'BROUILLARD' } }),
    ligne('701', 0, 99.99, { ecriture: { statut: 'BROUILLARD' } }),
    ligne('521', 123_456, 0, { ...usd, montantDevise: 44, ecriture: { exerciceId: 'n0' } }),
    ligne('411', 11, 0, { ecriture: { exerciceId: 'n0' } }),
    ligne('v521', 5_555, 0, { ecriture: { exerciceId: 'nv' } }),
];
function ancienneLecture(filtre) {
    return COMPTES.filter((c) => c.tenantId === 't').map((c) => ({
        ...c,
        lignes: JEU.filter((l) => l.compteId === c.id && l.ecriture.tenantId === 't' && l.ecriture.exerciceId === 'n' && filtre(l)).map((l) => ({
            debit: l.debit,
            credit: l.credit,
            lettre: l.lettre,
            libelle: l.libelle ?? l.ecriture.libelle,
            dateEcheance: l.dateEcheance,
            deviseId: l.deviseId,
            montantDevise: l.montantDevise,
            coursApplique: l.coursApplique,
        })),
    }));
}
describe('F185 · le report se lit en sommes, et rend le report de la lecture ligne à ligne', () => {
    it('le jeu porte bien les cas qui décident · sinon l’égalité ne prouverait rien', () => {
        const r521 = reportLigneALigne(ancienneLecture((l) => l.ecriture.statut === 'VALIDEE'), null).filter((l) => l.compteId === '521');
        expect(r521.map((l) => l.deviseId ?? null).sort()).toEqual(['eur', 'usd', null].sort());
        expect(r521.find((l) => l.deviseId === 'usd')).toMatchObject({ montantDevise: 44.02 });
        const r162 = reportLigneALigne(ancienneLecture((l) => l.ecriture.statut === 'VALIDEE'), null).filter((l) => l.compteId === '162');
        expect(r162).toEqual([expect.objectContaining({ deviseId: 'usd', credit: 2_798_600.05, montantDevise: 999.7 })]);
    });
    it('le PROVISOIRE, sur le livre-journal seul, rend le même report au centime', async () => {
        const { service, tx } = base(COMPTES, JEU);
        const r = await service.genererANouveauxProvisoires('t', 'n', 'u');
        const ancien = ancienneLecture((l) => l.ecriture.statut === 'VALIDEE');
        const delta = arrondi2(ancien.filter((c) => c.modeReportANouveau === 'AUCUN').reduce((s, c) => s + soldeAncien(c), 0));
        const attendu = reportLigneALigne(ancien, { compteId: delta > 0 ? '139' : '131', montant: delta });
        const obtenu = tx.ecriture.create.mock.calls[0][0].data.lignes.create;
        expect(canon(obtenu)).toEqual(canon(attendu));
        expect(r.resultat).toBe(delta);
    });
    it('la CLÔTURE rend la même écriture de solde et le même report définitif', async () => {
        const { service, tx } = base(COMPTES, JEU);
        await service.cloturer('t', 'n', 'u');
        const ancien = ancienneLecture(() => true);
        const aucun = ancien
            .filter((c) => c.modeReportANouveau === 'AUCUN')
            .map((c) => ({ c, s: soldeAncien(c) }))
            .filter((x) => Math.abs(x.s) > 0.005);
        const delta = aucun.reduce((t, x) => t + x.s, 0);
        const compteResultat = delta > 0 ? '139' : '131';
        const solde = aucun.map(({ c, s }) => ({ compteId: c.id, debit: s > 0 ? 0 : -s, credit: s > 0 ? s : 0, libelle: `Clôture ${c.numero} · ${c.intitule}` }));
        solde.push({
            compteId: compteResultat,
            debit: delta > 0 ? delta : 0,
            credit: delta < 0 ? -delta : 0,
            libelle: delta > 0 ? "Perte nette de l'exercice" : "Bénéfice net de l'exercice",
        });
        const [cloture, ran] = tx.ecriture.create.mock.calls.map((c) => c[0].data);
        expect(canon(cloture.lignes.create)).toEqual(canon(solde));
        expect(canon(ran.lignes.create)).toEqual(canon(reportLigneALigne(ancien, { compteId: compteResultat, montant: delta })));
    });
    it('le calcul, nourri des lignes elles-mêmes, rend le même report que l’ancien · sommesDesLignes en est la définition', () => {
        const ancien = ancienneLecture((l) => l.ecriture.statut === 'VALIDEE');
        const nouveau = ancien.map((c) => ({ ...c, modeReportANouveau: c.modeReportANouveau }));
        const resultat = { compteId: '131', montant: -1234.56 };
        expect(canon((0, report_a_nouveau_1.lignesReportANouveau)(nouveau, resultat))).toEqual(canon(reportLigneALigne(ancien, resultat)));
    });
    it('aucune ligne d’un compte au SOLDE ou de gestion, ni aucune lettrée, ne monte en mémoire', async () => {
        const { service, tx, lus } = base(COMPTES, JEU);
        await service.genererANouveauxProvisoires('t', 'n', 'u');
        expect(tx.compte.findMany.mock.calls[0][0].include).toBeUndefined();
        const lues = lus.flat();
        expect(lues.length).toBeGreaterThan(0);
        expect(lues.every((l) => l.compte.modeReportANouveau === 'DETAIL')).toBe(true);
        expect(lues.every((l) => !l.lettre)).toBe(true);
        const perimetre = (a) => a.where.ecriture;
        for (const appel of tx.ligneEcriture.groupBy.mock.calls)
            expect(perimetre(appel[0])).toEqual({ tenantId: 't', exerciceId: 'n', statut: 'VALIDEE' });
        expect(perimetre(tx.ligneEcriture.findMany.mock.calls[0][0])).toEqual({ tenantId: 't', exerciceId: 'n', statut: 'VALIDEE' });
    });
    it('au-delà d’une tranche, chaque mouvement non lettré du DÉTAIL passe une fois, et une seule', async () => {
        const nombre = lecture_par_lots_1.LOT_LECTURE + 3;
        const factures = Array.from({ length: nombre }, (_, i) => ligne('411', 1 + (i % 7) / 100, 0, { libelle: `F${i}` }));
        const jeu = [...factures, ligne('701', 0, factures.reduce((s, l) => s + l.debit, 0))];
        const { service, tx } = base(COMPTES, jeu);
        await service.genererANouveauxProvisoires('t', 'n', 'u');
        const reportees = tx.ecriture.create.mock.calls[0][0].data.lignes.create.filter((l) => l.compteId === '411');
        expect(reportees).toHaveLength(nombre);
        expect(new Set(reportees.map((l) => l.libelle)).size).toBe(nombre);
        const tranches = tx.ligneEcriture.findMany.mock.calls.map((c) => c[0]);
        expect(tranches).toHaveLength(2);
        expect(tranches[1].cursor).toEqual({ id: [...factures].sort((a, b) => (a.id < b.id ? -1 : 1))[lecture_par_lots_1.LOT_LECTURE - 1].id });
    });
});
describe('N5 · la classe 9 du SYCEBNL ne se reporte pas', () => {
    const COMPTES9 = [...COMPTES, compte('904', '90400000', 'SOLDE'), compte('914', '91400000', 'AUCUN')];
    for (const c of COMPTES9)
        parId.set(c.id, c);
    const JEU9 = [ligne('521', 1000, 0), ligne('701', 0, 1000), ligne('904', 1_000_000, 0), ligne('914', 0, 1_000_000)];
    it('ni au report définitif, ni à l’écriture qui solde les comptes de gestion', async () => {
        const { service, tx } = base(COMPTES9, JEU9, 'SYCEBNL');
        await service.cloturer('t', 'n', 'u');
        const [cloture, ran] = tx.ecriture.create.mock.calls.map((c) => c[0].data);
        const comptesTouches = [...cloture.lignes.create, ...ran.lignes.create].map((l) => l.compteId);
        expect(comptesTouches).not.toContain('904');
        expect(comptesTouches).not.toContain('914');
        expect(ran.lignes.create.find((l) => l.compteId === '131')).toMatchObject({ credit: 1000 });
    });
    it('ni au report provisoire', async () => {
        const { service, tx } = base(COMPTES9, JEU9, 'SYCEBNL');
        await service.genererANouveauxProvisoires('t', 'n', 'u');
        const comptesTouches = tx.ecriture.create.mock.calls[0][0].data.lignes.create.map((l) => l.compteId);
        expect(comptesTouches).not.toContain('904');
    });
    it('au SYSCOHADA, un 90 et un 91 au SOLDE (engagements) se reportent comme avant', async () => {
        const comptes = COMPTES9.map((c) => (c.id === '914' ? { ...c, modeReportANouveau: 'SOLDE' } : c));
        const jeu = JEU9.map((l) => (l.compteId === '914' ? { ...l, compte: comptes.find((c) => c.id === '914') } : l));
        const { service, tx } = base(comptes, jeu, 'SYSCOHADA');
        await service.genererANouveauxProvisoires('t', 'n', 'u');
        const comptesTouches = tx.ecriture.create.mock.calls[0][0].data.lignes.create.map((l) => l.compteId);
        expect(comptesTouches).toContain('904');
    });
});
describe('A6 bis · un groupe à cheval de deux exercices se lit non lettré pour le report de son exercice', () => {
    const n1 = { exerciceId: 'n1' };
    const jeu = () => relierLesGroupes([
        ligne('601', 1000, 0),
        ligne('401', 0, 1000, { libelle: 'Facture du 15/12/2026', lettrageId: 'g1' }),
        ligne('401', 600, 0, { lettrageId: 'g1', ecriture: n1 }),
        ligne('601', 700, 0),
        ligne('401', 0, 700, { libelle: 'Facture soldée en N+1', lettre: 'A', lettrageId: 'g2' }),
        ligne('401', 700, 0, { lettre: 'A', lettrageId: 'g2', ecriture: n1 }),
        ligne('601', 500, 0),
        ligne('162', 0, 500, { lettre: 'B', lettrageId: 'g3' }),
        ligne('162', 500, 0, { lettre: 'B', lettrageId: 'g3', ecriture: n1 }),
        ligne('401', 50, 0, { lettre: 'C', lettrageId: 'g4' }),
        ligne('401', 0, 50, { lettre: 'C', lettrageId: 'g4' }),
    ]);
    const resume = (lignes) => lignes.filter((l) => l.compteId === '401' || l.compteId === '162' || l.compteId === '139').map((l) => [l.compteId, Number(l.debit), Number(l.credit)]);
    const equilibre = (lignes) => Math.round(lignes.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0) * 100);
    it('la CLÔTURE passe · les lignes de N des groupes à cheval, partiel ou soldé, sont reportées, le report boucle', async () => {
        const { service, tx } = base(COMPTES, jeu());
        await service.cloturer('t', 'n', 'u');
        const ran = tx.ecriture.create.mock.calls[1][0].data.lignes.create;
        expect(equilibre(ran)).toBe(0);
        expect(resume(ran).sort()).toEqual([
            ['139', 2200, 0],
            ['162', 0, 500],
            ['401', 0, 1000],
            ['401', 0, 700],
        ].sort());
        expect(ran.some((l) => l.libelle === 'RAN détail 40110000 · Facture soldée en N+1')).toBe(true);
    });
    it('l’À-NOUVEAU PROVISOIRE de même · rien n’est refusé, le report boucle', async () => {
        const { service, tx } = base(COMPTES, jeu());
        await service.genererANouveauxProvisoires('t', 'n', 'u');
        const ran = tx.ecriture.create.mock.calls[0][0].data.lignes.create;
        expect(equilibre(ran)).toBe(0);
        expect(resume(ran).filter((l) => l[0] === '401').sort()).toEqual([
            ['401', 0, 1000],
            ['401', 0, 700],
        ]);
    });
    it('la lecture du DÉTAIL nomme l’exercice lu · un groupe se dit « à cheval » contre lui, borné au dossier', async () => {
        const { service, tx } = base(COMPTES, jeu());
        await service.genererANouveauxProvisoires('t', 'n', 'u');
        const ou = tx.ligneEcriture.findMany.mock.calls[0][0].where.OR;
        expect(ou).toContainEqual({ lettrage: { lignes: { some: { ecriture: { tenantId: 't', exerciceId: { not: 'n' } } } } } });
    });
});
describe('Clôture de N+1 · le résultat de N non affecté passe au report à nouveau', () => {
    const COMPTES_RAN = [
        ...COMPTES,
        compte('121', '12100000', 'SOLDE'),
        compte('1291', '12910000', 'SOLDE'),
        compte('1290', '12900000', 'SOLDE'),
    ];
    for (const c of COMPTES_RAN)
        parId.set(c.id, c);
    const AN = { ecriture: { libelle: 'Report à-nouveau' } };
    function monter(jeu, referentiel) {
        const lignes = [...jeu];
        const m = base(COMPTES_RAN, lignes, referentiel);
        m.tx.ecriture.create = jest.fn(async ({ data }) => {
            for (const l of data.lignes.create)
                lignes.push(ligne(l.compteId, l.debit, l.credit));
            return { lignes: [] };
        });
        return m;
    }
    const ecritures = (tx) => tx.ecriture.create.mock.calls.map((c) => c[0].data);
    const sur = (e, id) => e.lignes.create.filter((l) => l.compteId === id).reduce((s, l) => s + l.debit - l.credit, 0);
    it('SYSCOHADA, perte non affectée · virée au 12910000 dans une écriture de clôture liée, le report ne porte plus que le résultat de N+1', async () => {
        const jeu = [ligne('139', 46_072_000, 0, AN), ligne('101', 0, 46_072_000, AN), ligne('601', 11_600_000, 0), ligne('521', 0, 11_600_000)];
        const { service, tx } = monter(jeu, 'SYSCOHADA');
        const r = await service.cloturer('t', 'n', 'u');
        const [virement, cloture, ran] = ecritures(tx);
        expect(virement.estGenereeParCloture).toBe(true);
        expect(virement.estSoldeDesComptesDeGestion).toBe(false);
        expect(sur(virement, '139')).toBe(-46_072_000);
        expect(sur(virement, '1291')).toBe(46_072_000);
        expect(cloture.estSoldeDesComptesDeGestion).toBe(true);
        expect(sur(ran, '139')).toBe(11_600_000);
        expect(sur(ran, '1291')).toBe(46_072_000);
        expect(r.virementResultatNonAffecte).toEqual({ montant: -46_072_000, compte: '12910000' });
        expect(r.issueOuverture[0]).toMatch(/non affecté viré au report à nouveau · perte de 46\s072\s000,00 au compte 12910000/);
        expect(r.issueOuverture[0]).toMatch(/AVERTISSEMENT/);
    });
    it('SYCEBNL, excédent non affecté · viré au 12100000', async () => {
        const jeu = [ligne('131', 0, 2_700_000, AN), ligne('521', 2_700_000, 0, AN), ligne('701', 0, 500_000), ligne('521', 500_000, 0)];
        const { service, tx } = monter(jeu, 'SYCEBNL');
        const r = await service.cloturer('t', 'n', 'u');
        const [virement, , ran] = ecritures(tx);
        expect(sur(virement, '131')).toBe(2_700_000);
        expect(sur(virement, '121')).toBe(-2_700_000);
        expect(sur(ran, '121')).toBe(-2_700_000);
        expect(sur(ran, '131')).toBe(-500_000);
        expect(r.virementResultatNonAffecte).toEqual({ montant: 2_700_000, compte: '12100000' });
        expect(r.issueOuverture[0]).toMatch(/excédent de 2\s700\s000,00 au compte 12100000 \(SYCEBNL/);
    });
    it.each(['SYSCOHADA', 'SYCEBNL'])('%s · affectation passée avant la clôture · le 13 est soldé, rien n’est viré', async (referentiel) => {
        const jeu = [
            ligne('139', 46_072_000, 0, AN),
            ligne('101', 0, 46_072_000, AN),
            ligne(referentiel === 'SYSCOHADA' ? '1291' : '1290', 46_072_000, 0),
            ligne('139', 0, 46_072_000),
            ligne('601', 11_600_000, 0),
            ligne('521', 0, 11_600_000),
        ];
        const { service, tx } = monter(jeu, referentiel);
        const r = await service.cloturer('t', 'n', 'u');
        const crees = ecritures(tx);
        expect(crees).toHaveLength(2);
        expect(crees[0].estSoldeDesComptesDeGestion).toBe(true);
        expect(r.virementResultatNonAffecte).toBeNull();
        expect(sur(crees[1], '139')).toBe(11_600_000);
    });
    it('le report PROVISOIRE fond le même virement · même report que la clôture', async () => {
        const jeu = [ligne('139', 46_072_000, 0, AN), ligne('101', 0, 46_072_000, AN), ligne('601', 11_600_000, 0), ligne('521', 0, 11_600_000)];
        const { service, tx } = monter(jeu, 'SYSCOHADA');
        await service.genererANouveauxProvisoires('t', 'n', 'u');
        const [ran] = ecritures(tx);
        expect(sur(ran, '139')).toBe(11_600_000);
        expect(sur(ran, '1291')).toBe(46_072_000);
    });
});
describe('Lettrage partiel · la clôture le reconduit sur ses lignes d’à-nouveau', () => {
    const groupe = (id, compteId, code = 'A') => ({ id, tenantId: 't', code, statut: 'PARTIEL', compteId, ecartChange: null });
    const jeuClient = () => [
        ligne('411', 34_800_000, 0, { lettrageId: 'G', libelle: 'Facture F1' }),
        ligne('701', 0, 34_800_000),
        ligne('521', 20_000_000, 0),
        ligne('411', 0, 20_000_000, { lettrageId: 'G', libelle: 'Acompte F1' }),
    ];
    it('la facture et son acompte arrivent dans UN groupe partiel, origine CLÔTURE, lié au groupe de N · le reste est 14 800 000', async () => {
        const jeu = jeuClient();
        const { service, tx } = base(COMPTES, jeu, 'SYSCOHADA', [groupe('G', '411')]);
        const r = (await service.cloturer('t', 'n', 'u'));
        expect(tx.lettrage.create).toHaveBeenCalledTimes(1);
        const data = tx.lettrage.create.mock.calls[0][0].data;
        expect(data).toMatchObject({ origine: 'CLOTURE', statut: 'PARTIEL', solde: 14_800_000, lettrageReconduitId: 'G', compteId: '411' });
        const ran = jeu.filter((l) => l.ecriture.exerciceId === 'n1' && l.compteId === '411');
        expect(ran).toHaveLength(2);
        expect(ran.map((l) => [l.libelle, l.debit, l.credit, l.lettre])).toEqual(expect.arrayContaining([
            ['RAN détail 41110000 · Facture F1', 34_800_000, 0, null],
            ['RAN détail 41110000 · Acompte F1', 0, 20_000_000, null],
        ]));
        expect(new Set(ran.map((l) => l.lettrageId))).toEqual(new Set(['R2']));
        expect(jeu.filter((l) => l.ecriture.exerciceId === 'n' && l.lettrageId === 'G')).toHaveLength(2);
        expect(r.lettragesPartiels).toEqual({ reconduits: 1, nonReconduits: 0 });
        expect(r.issueOuverture.join(' ')).toMatch(/1 lettrage\(s\) partiel\(s\) reconduit\(s\).*compte 41110000, a → b \(reste 14 800 000,00 au débit\)/);
    });
    it('le délai de la transaction de clôture est annoncé selon les lettrages partiels', async () => {
        const { service, prisma } = base(COMPTES, jeuClient(), 'SYSCOHADA', [groupe('G', '411')]);
        await service.cloturer('t', 'n', 'u');
        expect(prisma.$transaction.mock.calls[0][1]).toMatchObject({ timeout: (0, prisma_retry_util_1.delaiSelonVolume)((0, reconduction_lettrage_1.operationsDeLaCloture)(1)) });
    });
    it('un groupe de N-1 jamais reconduit en N · la clôture de N le reconduit vers N+1 et le dit', async () => {
        const P = { id: 'p', tenantId: 't', statut: 'CLOTURE', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') };
        const ran = { exerciceId: 'n', date: N.dateDebut, libelle: 'Report à-nouveau', estGenereeParCloture: true, estANouveauProvisoire: false, estSoldeDesComptesDeGestion: false };
        const jeu = [
            ligne('411', 34_800_000, 0, { lettrageId: 'G0', libelle: 'Facture F0', ecriture: { exerciceId: 'p', date: new Date('2025-11-15') } }),
            ligne('411', 0, 20_000_000, { lettrageId: 'G0', libelle: 'Acompte F0', ecriture: { exerciceId: 'p', date: new Date('2025-10-01') } }),
            ligne('411', 34_800_000, 0, { libelle: 'RAN détail 41110000 · Facture F0', ecriture: ran }),
            ligne('411', 0, 20_000_000, { libelle: 'RAN détail 41110000 · Acompte F0', ecriture: ran }),
            ligne('101', 0, 14_800_000, { ecriture: ran }),
        ];
        const { service, tx } = base(COMPTES, jeu, 'SYSCOHADA', [groupe('G0', '411')], [P, { ...N, statut: 'OUVERT' }, { ...N1, statut: 'OUVERT' }]);
        const r = (await service.cloturer('t', 'n', 'u'));
        expect(tx.lettrage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ origine: 'CLOTURE', statut: 'PARTIEL', solde: 14_800_000, lettrageReconduitId: 'G0' }) }));
        const reports = jeu.filter((l) => l.ecriture.exerciceId === 'n1' && l.compteId === '411');
        expect(reports).toHaveLength(2);
        expect(new Set(reports.map((l) => l.lettrageId)).size).toBe(1);
        expect(r.issueOuverture.join(' ')).toMatch(/Lettrage partiel a de l'exercice ouvert le 2025-01-01.*jamais reconduit.*reportées et réunies par cette clôture/);
    });
    it('deux groupes de N-1 rivaux pour la même paire de lignes · la clôture passe, l’un reconduit, l’autre nommé', async () => {
        const P = { id: 'p', tenantId: 't', statut: 'CLOTURE', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') };
        const ran = { exerciceId: 'n', date: N.dateDebut, libelle: 'Report à-nouveau', estGenereeParCloture: true, estANouveauProvisoire: false, estSoldeDesComptesDeGestion: false };
        const enP = (date) => ({ exerciceId: 'p', date: new Date(date) });
        const jeu = [
            ligne('411', 34_800_000, 0, { lettrageId: 'G0', libelle: 'Facture', ecriture: enP('2025-11-15') }),
            ligne('411', 0, 20_000_000, { lettrageId: 'G0', libelle: 'Acompte', ecriture: enP('2025-10-01') }),
            ligne('411', 34_800_000, 0, { lettrageId: 'G9', libelle: 'Facture', ecriture: enP('2025-11-16') }),
            ligne('411', 0, 20_000_000, { lettrageId: 'G9', libelle: 'Acompte', ecriture: enP('2025-10-02') }),
            ligne('411', 34_800_000, 0, { libelle: 'RAN détail 41110000 · Facture', ecriture: ran }),
            ligne('411', 0, 20_000_000, { libelle: 'RAN détail 41110000 · Acompte', ecriture: ran }),
            ligne('101', 0, 14_800_000, { ecriture: ran }),
        ];
        const { service, tx } = base(COMPTES, jeu, 'SYSCOHADA', [groupe('G0', '411'), groupe('G9', '411', 'B')], [P, { ...N, statut: 'OUVERT' }, { ...N1, statut: 'OUVERT' }]);
        const r = (await service.cloturer('t', 'n', 'u'));
        expect(tx.lettrage.create).toHaveBeenCalledTimes(1);
        expect(tx.lettrage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lettrageReconduitId: 'G0' }) }));
        const issue = r.issueOuverture.join(' ');
        expect(issue).toMatch(/Lettrage partiel a .*jamais reconduit.*reportées et réunies par cette clôture/);
        expect(issue).toMatch(/Lettrage partiel b .*jamais reconduit.*pas d'équivalent sûr au report.*la clôture ne le suit pas/);
    });
    it('EN DEVISE · la facture fournisseur et son règlement partiel arrivent ensemble, devise et montants en devise compris', async () => {
        const jeu = [
            ligne('401', 0, 2_800_000, { lettrageId: 'H', libelle: 'Facture USD', deviseId: 'usd', montantDevise: 1000, coursApplique: 2800 }),
            ligne('601', 2_800_000, 0),
            ligne('401', 1_120_000, 0, { lettrageId: 'H', libelle: 'Règlement partiel', deviseId: 'usd', montantDevise: 400, coursApplique: 2800 }),
            ligne('521', 0, 1_120_000),
        ];
        const { service, tx } = base(COMPTES, jeu, 'SYSCOHADA', [groupe('H', '401')]);
        await service.cloturer('t', 'n', 'u');
        expect(tx.lettrage.create.mock.calls[0][0].data).toMatchObject({ origine: 'CLOTURE', statut: 'PARTIEL', solde: -1_680_000, lettrageReconduitId: 'H' });
        const ran = jeu.filter((l) => l.ecriture.exerciceId === 'n1' && l.compteId === '401');
        expect(ran.map((l) => [l.debit, l.credit, l.deviseId, l.montantDevise, l.lettrageId])).toEqual(expect.arrayContaining([
            [0, 2_800_000, 'usd', 1000, 'R2'],
            [1_120_000, 0, 'usd', 400, 'R2'],
        ]));
    });
    it('un groupe À CHEVAL de deux exercices n’est pas reconduit · la paire le lit déjà', async () => {
        const jeu = [
            ligne('411', 34_800_000, 0, { lettrageId: 'G' }),
            ligne('701', 0, 34_800_000),
            ligne('411', 0, 20_000_000, { lettrageId: 'G', ecriture: { exerciceId: 'n1' } }),
        ];
        const { service, tx } = base(COMPTES, relierLesGroupes(jeu), 'SYSCOHADA', [groupe('G', '411')]);
        await service.cloturer('t', 'n', 'u');
        expect(tx.lettrage.create).not.toHaveBeenCalled();
    });
    it('un groupe SOLDÉ ne se reconduit pas · ses lignes ne passent pas au report', async () => {
        const jeu = [
            ligne('411', 1_000, 0, { lettrageId: 'S', lettre: 'A' }),
            ligne('701', 0, 1_000),
            ligne('521', 1_000, 0),
            ligne('411', 0, 1_000, { lettrageId: 'S', lettre: 'A' }),
        ];
        const { service, tx } = base(COMPTES, jeu, 'SYSCOHADA', [{ ...groupe('S', '411'), statut: 'SOLDE' }]);
        await service.cloturer('t', 'n', 'u');
        expect(tx.lettrage.create).not.toHaveBeenCalled();
        expect(jeu.filter((l) => l.ecriture.exerciceId === 'n1' && l.compteId === '411')).toHaveLength(0);
    });
    it('le report PROVISOIRE ne lettre rien, et annonce ce que la clôture reconduira', async () => {
        const jeu = jeuClient();
        const { service, tx } = base(COMPTES, jeu, 'SYSCOHADA', [groupe('G', '411')]);
        const r = (await service.genererANouveauxProvisoires('t', 'n', 'u'));
        expect(tx.lettrage.create).not.toHaveBeenCalled();
        expect(r.lettragesPartielsAReconduire.total).toBe(1);
        expect(r.lettragesPartielsAReconduire.groupes).toEqual([{ code: 'a', compte: '41110000', reste: 14_800_000 }]);
        expect(r.lettragesPartielsAReconduire.annonce).toMatch(/1 lettrage\(s\) partiel\(s\) de cet exercice seront reconduits par la clôture/);
    });
});
//# sourceMappingURL=report-a-nouveau-agrege.spec.js.map