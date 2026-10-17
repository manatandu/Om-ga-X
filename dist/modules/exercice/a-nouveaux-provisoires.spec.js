"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const exercice_service_1 = require("./exercice.service");
const N = { id: 'n', tenantId: 't', statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const N1 = { id: 'n1', tenantId: 't', statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };
const ligne = (debit, credit) => ({ debit, credit, lettre: null, libelle: 'L', dateEcheance: null, ecriture: { libelle: 'E' } });
const COMPTES = [
    { id: '601', numero: '60110000', intitule: 'Achats', modeReportANouveau: 'AUCUN', lignesEcriture: [ligne(1000, 0)] },
    { id: '701', numero: '70110000', intitule: 'Ventes', modeReportANouveau: 'AUCUN', lignesEcriture: [ligne(0, 1500)] },
    { id: '521', numero: '52110000', intitule: 'Banque', modeReportANouveau: 'SOLDE', lignesEcriture: [ligne(1500, 0), ligne(0, 1000)] },
    { id: '131', numero: '13100000', intitule: 'Excédent', modeReportANouveau: 'SOLDE', lignesEcriture: [] },
];
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
function service(provisoire) {
    const lecture = lectureDuReport(COMPTES);
    const tx = {
        compte: {
            findMany: lecture.compte.findMany,
            findUnique: jest.fn().mockResolvedValue({ id: '131', numero: '13100000' }),
        },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'od', code: 'OD' }) },
        exercice: { findFirst: jest.fn().mockResolvedValue(N1), create: jest.fn() },
        ecriture: {
            findFirst: jest.fn().mockResolvedValue(provisoire),
            findMany: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue({}),
            create: jest.fn().mockResolvedValue({ lignes: [] }),
        },
        ligneEcriture: { ...lecture.ligneEcriture, count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({}) },
        lettrage: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const prisma = {
        exercice: { findFirst: jest.fn().mockResolvedValue(N) },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        ecriture: { count: jest.fn().mockResolvedValue(2) },
        $transaction: jest.fn((fn) => fn(tx)),
    };
    const journalService = { prochainNumeroPiece: jest.fn().mockResolvedValue(99) };
    return { s: new exercice_service_1.ExerciceService(prisma, journalService), tx, journalService };
}
describe('À-nouveaux provisoires · lettrage partiel (audit final F50)', () => {
    it('refuse de remplacer un report dont une ligne est dans un groupe PARTIEL, et lit le groupe', async () => {
        const { s, tx } = service({ id: 'p', numeroPiece: 3, lignes: [{ lettre: null, lettrageId: 'g1', rapprochementId: null }] });
        await expect(s.genererANouveauxProvisoires('t', 'n', 'u')).rejects.toThrow(/lettrées ou pointées/);
        expect(tx.ecriture.findFirst.mock.calls[0][0].include.lignes.select).toMatchObject({ lettre: true, lettrageId: true });
        expect(tx.ecriture.delete).not.toHaveBeenCalled();
    });
});
describe('À-nouveaux provisoires', () => {
    it('passe au brouillard, marqué provisoire, le report du livre-journal avec le résultat sur le 13 · équilibré', async () => {
        const { s, tx } = service(null);
        const r = await s.genererANouveauxProvisoires('t', 'n', 'u');
        const data = tx.ecriture.create.mock.calls[0][0].data;
        expect(data).toMatchObject({ exerciceId: 'n1', estANouveauProvisoire: true, estGenereeParCloture: true, numeroPiece: 99 });
        expect(data.statut).toBeUndefined();
        const lignes = data.lignes.create;
        expect(lignes.find((l) => l.compteId === '131')).toMatchObject({ credit: 500 });
        expect(lignes.reduce((t, l) => t + l.debit - l.credit, 0)).toBe(0);
        const statut = (a) => a.where.ecriture.statut;
        expect(tx.ligneEcriture.groupBy.mock.calls.map((c) => statut(c[0]))).toEqual(['VALIDEE', 'VALIDEE', 'VALIDEE']);
        expect(statut(tx.ligneEcriture.findMany.mock.calls[0][0])).toBe('VALIDEE');
        expect(r.brouillardNonRepris).toBe(2);
    });
    it('F185 · le plan se lit sans ses lignes, et une ligne au DÉTAIL par les seules colonnes du report', async () => {
        const { s, tx } = service(null);
        await s.genererANouveauxProvisoires('t', 'n', 'u');
        expect(tx.compte.findMany.mock.calls[0][0].include).toBeUndefined();
        const detail = tx.ligneEcriture.findMany.mock.calls[0][0];
        expect(detail.include).toBeUndefined();
        expect(detail.select.ecriture).toEqual({ select: { libelle: true } });
        expect(Object.keys(detail.select).sort()).toEqual(['compteId', 'coursApplique', 'credit', 'dateEcheance', 'debit', 'deviseId', 'ecriture', 'id', 'lettre', 'libelle', 'montantDevise']);
    });
    it('la relance REMPLACE le report précédent et reprend son numéro de pièce', async () => {
        const { s, tx, journalService } = service({ id: 'p', numeroPiece: 3, lignes: [{ lettre: null, rapprochementId: null }] });
        await s.genererANouveauxProvisoires('t', 'n', 'u');
        expect(tx.ecriture.delete).toHaveBeenCalledWith({ where: { id: 'p' } });
        expect(tx.ecriture.create.mock.calls[0][0].data.numeroPiece).toBe(3);
        expect(journalService.prochainNumeroPiece).not.toHaveBeenCalled();
    });
    it('refuse de remplacer un report dont une ligne a été lettrée sur le nouvel exercice', async () => {
        const { s, tx } = service({ id: 'p', numeroPiece: 3, lignes: [{ lettre: 'AA', rapprochementId: null }] });
        await expect(s.genererANouveauxProvisoires('t', 'n', 'u')).rejects.toThrow(/lettrées ou pointées/);
        expect(tx.ecriture.delete).not.toHaveBeenCalled();
        expect(tx.ecriture.create).not.toHaveBeenCalled();
    });
});
const ecriture_service_1 = require("../comptabilite/ecriture.service");
describe('Le report provisoire ne se valide pas', () => {
    it('valider le refuse en le nommant', async () => {
        const prisma = {
            ecriture: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 'p', statut: 'BROUILLARD', estANouveauProvisoire: true, lignes: [], exercice: { statut: 'OUVERT' }, journal: { code: 'OD' }, numeroPiece: 3 },
                ]),
            },
        };
        const s = new ecriture_service_1.EcritureService(prisma, {}, {}, {});
        await expect(s.valider('t', 'u', ['p'])).rejects.toThrow(/PROVISOIRE ne se valide pas/);
    });
});
//# sourceMappingURL=a-nouveaux-provisoires.spec.js.map