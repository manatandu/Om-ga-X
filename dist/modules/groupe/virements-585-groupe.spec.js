"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const groupe_service_1 = require("./groupe.service");
const contexte_cloisonnement_1 = require("../../common/cloisonnement/contexte-cloisonnement");
const evaluer = (r, w) => Object.entries((w ?? {})).every(([cle, f]) => {
    if (cle === 'AND')
        return f.every((x) => evaluer(r, x));
    if (cle === 'OR')
        return f.some((x) => evaluer(r, x));
    if (cle === 'lignes')
        return !(r.lignes ?? []).some((l) => evaluer(l, f.none));
    if (f !== null && typeof f === 'object' && !(f instanceof Date) && ('is' in f || cle === 'journal' || cle === 'compte')) {
        const x = r[cle];
        const is = 'is' in f ? f.is : f;
        return is === null ? !x : !!x && evaluer(x, is);
    }
    if (f !== null && typeof f === 'object' && 'in' in f)
        return f.in.includes(r[cle]);
    if (f instanceof Date)
        return r[cle] instanceof Date && r[cle].getTime() === f.getTime();
    return (r[cle] ?? null) === f;
});
const ecritureDuPremierJour = (id, tenantId, exerciceId, debut, x = {}) => ({
    id,
    tenantId,
    exerciceId,
    numeroPiece: 1,
    statut: 'VALIDEE',
    date: new Date(debut),
    dateValeur: null,
    estANouveauProvisoire: false,
    estSoldeDesComptesDeGestion: false,
    estGenereeParCloture: false,
    journal: { type: 'GENERAL', code: 'OD' },
    corrigeEcriture: null,
    corrigeEcritureId: null,
    reevaluationExtourne: null,
    reevaluationContrePassationDeclaree: null,
    lignes: [
        { id: `${id}-1`, ecritureId: id, compteId: 'c521', debit: 100, credit: 0, deviseId: null, montantDevise: null, compte: { classe: 'CLASSE_5' } },
        { id: `${id}-2`, ecritureId: id, compteId: 'c101', debit: 0, credit: 100, deviseId: null, montantDevise: null, compte: { classe: 'CLASSE_1' } },
    ],
    ...x,
});
function monter(options) {
    const perimetres = [];
    const premierJour = [
        ...(options.ouvertures ?? []).map((id) => {
            const e = options.exercices.find((x) => x.id === id);
            return ecritureDuPremierJour(`od-${id}`, e.tenantId, id, e.dateDebut.toISOString().slice(0, 10));
        }),
        ...(options.ecritures ?? []),
    ];
    const retenues = (where) => premierJour.filter((e) => evaluer(e, where));
    const prisma = {
        tenant: {
            findUnique: jest.fn().mockResolvedValue({ dossierMereId: options.dossierMereId }),
            findMany: jest.fn().mockResolvedValue(options.membres.map((id) => ({ id }))),
        },
        exercice: {
            findMany: jest.fn((args) => {
                perimetres.push((0, contexte_cloisonnement_1.perimetreCourant)());
                return Promise.resolve(options.exercices
                    .filter((e) => e.dateDebut <= args.where.dateDebut.lte)
                    .sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime()));
            }),
        },
        ligneEcriture: {
            aggregate: jest.fn((args) => {
                perimetres.push((0, contexte_cloisonnement_1.perimetreCourant)());
                const s = options.soldes585[args.where.ecriture.exerciceId] ?? 0;
                return Promise.resolve({ _sum: { debit: s > 0 ? s : 0, credit: s < 0 ? -s : 0 } });
            }),
            count: jest.fn((args) => {
                perimetres.push((0, contexte_cloisonnement_1.perimetreCourant)());
                return Promise.resolve(retenues(args.where.ecriture).reduce((n, e) => n + e.lignes.length, 0));
            }),
            findMany: jest.fn((args) => {
                perimetres.push((0, contexte_cloisonnement_1.perimetreCourant)());
                return Promise.resolve(args.cursor ? [] : retenues(args.where.ecriture).flatMap((e) => e.lignes));
            }),
        },
        ecriture: {
            findMany: jest.fn((args) => {
                perimetres.push((0, contexte_cloisonnement_1.perimetreCourant)());
                return Promise.resolve(retenues(args.where));
            }),
        },
    };
    const service = new groupe_service_1.GroupeService(prisma, {}, {}, {});
    return { service, prisma, perimetres };
}
const ex = (id, tenantId, debut, statut = client_1.StatutExercice.OUVERT) => ({
    id,
    tenantId,
    dateDebut: new Date(debut),
    statut,
});
const AU_31_12_2026 = new Date('2026-12-31');
describe('le 585 du groupe à la date de clôture', () => {
    it('une cellule lit son groupe par SA mère, dans le périmètre du groupe', async () => {
        const { service, prisma, perimetres } = monter({
            dossierMereId: 'SIEGE',
            membres: ['SIEGE', 'C1'],
            exercices: [ex('s26', 'SIEGE', '2026-01-01'), ex('c26', 'C1', '2026-01-01')],
            soldes585: { s26: 2_000_000 },
        });
        const r = await service.virements585DuGroupe('C1', AU_31_12_2026);
        expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 'C1' }, select: { dossierMereId: true } });
        expect(prisma.tenant.findMany.mock.calls[0][0].where).toEqual({ OR: [{ id: 'SIEGE' }, { dossierMereId: 'SIEGE' }] });
        for (const p of perimetres)
            expect([...(p ?? [])].sort()).toEqual(['C1', 'SIEGE']);
        expect(r).toEqual({ solde: 2_000_000 });
    });
    it('bornes décalées · le premier exercice long du siège et l’exercice civil de la cellule se lisent tous deux', async () => {
        const { service } = monter({
            dossierMereId: null,
            membres: ['SIEGE', 'C1'],
            exercices: [ex('sLong', 'SIEGE', '2025-08-01'), ex('c26', 'C1', '2026-01-01')],
            soldes585: { sLong: 2_000_000, c26: -2_000_000 },
        });
        expect(await service.virements585DuGroupe('SIEGE', AU_31_12_2026)).toEqual({ solde: 0 });
    });
    it('un bilan d’ouverture IMPORTÉ de la cellule compte, il ne sort pas de la somme', async () => {
        const { service } = monter({
            dossierMereId: null,
            membres: ['SIEGE', 'C1'],
            exercices: [
                ex('s25', 'SIEGE', '2025-01-01', client_1.StatutExercice.CLOTURE),
                ex('s26', 'SIEGE', '2026-01-01'),
                ex('c26', 'C1', '2026-01-01'),
            ],
            soldes585: { s25: 2_000_000, s26: 2_000_000, c26: -2_000_000 },
        });
        expect(await service.virements585DuGroupe('SIEGE', AU_31_12_2026)).toEqual({ solde: 0 });
    });
    it('une ouverture saisie en OD n’est pas comptée deux fois avec l’historique qu’elle reprend', async () => {
        const { service, prisma } = monter({
            dossierMereId: null,
            membres: ['SIEGE', 'C1'],
            exercices: [
                ex('s26', 'SIEGE', '2026-01-01'),
                ex('c25', 'C1', '2025-01-01'),
                ex('c26', 'C1', '2026-01-01'),
            ],
            soldes585: { s26: 2_000_000, c25: -2_000_000, c26: -2_000_000 },
            ouvertures: ['c26'],
        });
        expect(await service.virements585DuGroupe('SIEGE', AU_31_12_2026)).toEqual({ solde: 0 });
        expect(prisma.ligneEcriture.aggregate.mock.calls.map((c) => c[0].where.ecriture.exerciceId).sort()).toEqual(['c26', 's26']);
    });
    it('un exercice précédent non clôturé, sans ouverture validée, se remonte · l’à-nouveau n’est que le provisoire', async () => {
        const { service } = monter({
            dossierMereId: null,
            membres: ['SIEGE', 'C1'],
            exercices: [
                ex('s25', 'SIEGE', '2025-01-01'),
                ex('s26', 'SIEGE', '2026-01-01'),
                ex('c25', 'C1', '2025-01-01', client_1.StatutExercice.CLOTURE),
                ex('c26', 'C1', '2026-01-01'),
            ],
            soldes585: { s25: 2_000_000, s26: 0, c25: -2_000_000, c26: -2_000_000 },
        });
        expect(await service.virements585DuGroupe('C1', AU_31_12_2026)).toEqual({ solde: 0 });
    });
    it('A8 · une contre-passation de réévaluation au premier jour n’arrête pas la remontée vers l’exercice précédent ouvert', async () => {
        const extourne = ecritureDuPremierJour('ext', 'C1', 'c26', '2026-01-01', { reevaluationExtourne: { id: 'r25' } });
        const jouer = () => monter({
            dossierMereId: null,
            membres: ['SIEGE', 'C1'],
            exercices: [ex('s26', 'SIEGE', '2026-01-01'), ex('c25', 'C1', '2025-01-01'), ex('c26', 'C1', '2026-01-01')],
            soldes585: { s26: 2_000_000, c25: -2_000_000, c26: 0 },
            ecritures: [extourne],
        }).service.virements585DuGroupe('SIEGE', AU_31_12_2026);
        expect(await jouer()).toEqual({ solde: 0 });
        extourne.reevaluationExtourne = null;
        expect(await jouer()).toEqual({ solde: 2_000_000 });
    });
    it('m4 · une contre-passation DÉCLARÉE au premier jour n’arrête pas la remontée vers l’exercice précédent ouvert', async () => {
        const declaree = ecritureDuPremierJour('cpm', 'C1', 'c26', '2026-01-01', {
            lignes: [
                { id: 'cpm-1', ecritureId: 'cpm', compteId: 'c479', debit: 100_000, credit: 0, deviseId: null, montantDevise: null, compte: { classe: 'CLASSE_4' } },
                { id: 'cpm-2', ecritureId: 'cpm', compteId: 'c411', debit: 0, credit: 100_000, deviseId: null, montantDevise: null, compte: { classe: 'CLASSE_4' } },
            ],
            reevaluationContrePassationDeclaree: {
                annuleeLe: null,
                ecritureEcarts: {
                    lignes: [
                        { compteId: 'c411', debit: 100_000, credit: 0, compte: { numero: '41110000' } },
                        { compteId: 'c479', debit: 0, credit: 100_000, compte: { numero: '47910000' } },
                    ],
                },
            },
        });
        const jouer = () => monter({
            dossierMereId: null,
            membres: ['SIEGE', 'C1'],
            exercices: [ex('s26', 'SIEGE', '2026-01-01'), ex('c25', 'C1', '2025-01-01'), ex('c26', 'C1', '2026-01-01')],
            soldes585: { s26: 2_000_000, c25: -2_000_000, c26: 0 },
            ecritures: [declaree],
        }).service.virements585DuGroupe('SIEGE', AU_31_12_2026);
        expect(await jouer()).toEqual({ solde: 0 });
        declaree.reevaluationContrePassationDeclaree.annuleeLe = new Date('2026-03-01');
        expect(await jouer()).toEqual({ solde: 2_000_000 });
    });
    it('B2 · une OD d’ouverture annulée par son négatif n’arrête pas la remontée', async () => {
        const od = ecritureDuPremierJour('od', 'C1', 'c26', '2026-01-01');
        const negatif = ecritureDuPremierJour('neg', 'C1', 'c26', '2026-02-15', {
            corrigeEcritureId: 'od',
            corrigeEcriture: od,
            lignes: od.lignes.map((l, i) => ({ ...l, id: `neg-${i}`, ecritureId: 'neg', debit: -l.debit, credit: -l.credit })),
        });
        const jouer = (ecritures) => monter({
            dossierMereId: null,
            membres: ['SIEGE', 'C1'],
            exercices: [ex('s26', 'SIEGE', '2026-01-01'), ex('c25', 'C1', '2025-01-01'), ex('c26', 'C1', '2026-01-01')],
            soldes585: { s26: 2_000_000, c25: -2_000_000, c26: 0 },
            ecritures,
        }).service.virements585DuGroupe('SIEGE', AU_31_12_2026);
        expect(await jouer([od, negatif])).toEqual({ solde: 0 });
        expect(await jouer([od])).toEqual({ solde: 2_000_000 });
    });
    it('lignes validées du 585 de l’exercice, datées au plus tard la date, hors solde des comptes de gestion', async () => {
        const { service, prisma } = monter({
            dossierMereId: null,
            membres: ['SIEGE'],
            exercices: [ex('s26', 'SIEGE', '2026-01-01')],
            soldes585: {},
        });
        await service.virements585DuGroupe('SIEGE', AU_31_12_2026);
        expect(prisma.exercice.findMany.mock.calls[0][0]).toEqual({
            where: { tenantId: { in: ['SIEGE'] }, dateDebut: { lte: AU_31_12_2026 } },
            select: { id: true, tenantId: true, dateDebut: true, statut: true },
            orderBy: { dateDebut: 'asc' },
        });
        expect(prisma.ligneEcriture.aggregate.mock.calls[0][0]).toEqual({
            where: {
                compte: { tenantId: 'SIEGE', numero: { startsWith: '585' }, virementFonds: { is: null } },
                ecriture: {
                    tenantId: 'SIEGE',
                    exerciceId: 's26',
                    date: { lte: AU_31_12_2026 },
                    statut: 'VALIDEE',
                    estSoldeDesComptesDeGestion: false,
                },
            },
            _sum: { debit: true, credit: true },
        });
    });
});
//# sourceMappingURL=virements-585-groupe.spec.js.map