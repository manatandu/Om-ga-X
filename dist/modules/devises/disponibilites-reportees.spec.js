"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const devises_service_1 = require("./devises.service");
const N = { id: 'e26', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'CLOTURE' };
const N1 = { id: 'e27', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31'), statut: 'OUVERT' };
const caisseN = {
    compteId: 'c-5712',
    numero: '57120000',
    deviseId: 'usd',
    debit: 2_800_000,
    credit: 0,
    montantDevise: 1000,
    exerciceId: 'e26',
    date: new Date('2026-03-01'),
};
const ouvertureN1 = (ouverture = 'DEFINITIF', creeeLe = new Date('2027-01-10')) => ({
    ...caisseN,
    exerciceId: 'e27',
    date: N1.dateDebut,
    ouverture,
    creeeLe,
});
function correspond(valeur, filtre) {
    if (filtre === undefined)
        return true;
    if (filtre === null)
        return valeur === null || valeur === undefined;
    if (filtre instanceof Date)
        return valeur instanceof Date && valeur.getTime() === filtre.getTime();
    if (typeof filtre === 'object') {
        const f = filtre;
        if ('in' in f)
            return f.in.includes(valeur);
        if ('not' in f)
            return f.not === null ? valeur !== null && valeur !== undefined : valeur !== f.not;
        const t = valeur.getTime();
        if ('lt' in f && !(t < f.lt.getTime()))
            return false;
        if ('lte' in f && !(t <= f.lte.getTime()))
            return false;
        if ('gt' in f && !(t > f.gt.getTime()))
            return false;
        if ('gte' in f && !(t >= f.gte.getTime()))
            return false;
        return true;
    }
    return valeur === filtre;
}
const CHAMP_CREDIT = { champ: 'credit' };
function monter(p) {
    const exercices = p.exercices ?? [N, N1];
    const reevals = [...(p.reeval ? [p.reeval] : []), ...(p.reevals ?? [])];
    const filtrerExercices = (where = {}) => exercices.filter((e) => Object.entries(where).every(([cle, f]) => (cle === 'tenantId' ? true : correspond(e[cle], f))));
    const trier = (liste, orderBy) => {
        if (!orderBy)
            return liste;
        const [cle, sens] = Object.entries(orderBy)[0];
        return [...liste].sort((a, b) => {
            const d = a[cle].getTime() - b[cle].getTime();
            return sens === 'desc' ? -d : d;
        });
    };
    const CLES_CONNUES = new Set(['compteId', 'deviseId', 'lettre', 'ecriture']);
    const ouvertesOuACheval = (ou) => Array.isArray(ou) && ou.some((b) => b.lettre === null);
    const lignesFiltrees = (where = {}) => {
        if (Object.keys(where).some((k) => !CLES_CONNUES.has(k) && !(k === 'OR' && ouvertesOuACheval(where.OR))))
            return [];
        const e = (where.ecriture ?? {});
        return p.lignes.filter((l) => {
            if (!correspond(l.compteId, where.compteId))
                return false;
            if (!correspond(l.deviseId, where.deviseId))
                return false;
            if (!correspond(l.exerciceId, e.exerciceId))
                return false;
            if (!correspond(l.date, e.date))
                return false;
            if (e.estGenereeParCloture === true && !(l.ouverture === 'DEFINITIF' || l.ouverture === 'PROVISOIRE'))
                return false;
            if (e.estGenereeParCloture === false && (l.ouverture === 'DEFINITIF' || l.ouverture === 'PROVISOIRE'))
                return false;
            if (e.estANouveauProvisoire === false && l.ouverture === 'PROVISOIRE')
                return false;
            const non = e.NOT;
            if (non?.estGenereeParCloture === true && (l.ouverture === 'DEFINITIF' || l.ouverture === 'PROVISOIRE'))
                return false;
            return true;
        });
    };
    const habiller = (l) => ({
        ...l,
        lettre: null,
        lettrageId: null,
        compte: { id: l.compteId, numero: l.numero, intitule: `Compte ${l.numero}` },
        devise: l.deviseId ? { id: l.deviseId, code: l.deviseId.toUpperCase() } : null,
        ecriture: { estANouveauProvisoire: l.ouverture === 'PROVISOIRE', createdAt: l.creeeLe ?? new Date('2027-01-10') },
    });
    const grouper = (a) => {
        const w = a.where;
        const e = (w.ecriture ?? {});
        const branches = Array.isArray(e.OR) ? e.OR : null;
        const sens = w.debit;
        const retenues = p.lignes.filter((l) => {
            if (!correspond(l.compteId, w.compteId) || !correspond(l.deviseId, w.deviseId))
                return false;
            if (!correspond(l.exerciceId, e.exerciceId) || !correspond(l.date, e.date))
                return false;
            const ouverte = l.ouverture === 'DEFINITIF' || l.ouverture === 'PROVISOIRE';
            if (e.estGenereeParCloture === true && !ouverte)
                return false;
            if (e.estANouveauProvisoire === false && l.ouverture === 'PROVISOIRE')
                return false;
            const non = e.NOT;
            if (non?.estGenereeParCloture === true && ouverte)
                return false;
            if (branches) {
                const saisieAvant = branches.some((b) => b.createdAt
                    ? correspond(l.creeeLe ?? new Date('2026-06-01'), b.createdAt)
                    :
                        b.exerciceId !== undefined
                            ? correspond(l.exerciceId, b.exerciceId) && correspond(l.date, b.date)
                            : b.date !== undefined && correspond(l.date, b.date) && (l.ouverture === 'DEFINITIF' || l.ouverture === 'PROVISOIRE'));
                if (!saisieAvant)
                    return false;
            }
            if (sens?.gte === CHAMP_CREDIT && !(l.debit >= l.credit))
                return false;
            if (sens?.lt === CHAMP_CREDIT && !(l.debit < l.credit))
                return false;
            return true;
        });
        const groupes = new Map();
        for (const l of retenues) {
            const cle = `${l.compteId}|${l.deviseId}`;
            const g = groupes.get(cle) ?? { compteId: l.compteId, deviseId: l.deviseId, _sum: { debit: 0, credit: 0, montantDevise: 0 } };
            g._sum.debit += l.debit;
            g._sum.credit += l.credit;
            g._sum.montantDevise += l.montantDevise ?? 0;
            groupes.set(cle, g);
        }
        return [...groupes.values()];
    };
    const suivantDe = (exerciceId) => {
        const i = exercices.findIndex((x) => x.id === exerciceId);
        return i >= 0 && i + 1 < exercices.length ? exercices[i + 1].id : 'e-suivant';
    };
    const exerciceDe = (id) => ({ dateDebut: exercices.find((x) => x.id === id)?.dateDebut ?? new Date('2028-01-01') });
    const reevaluationDe = (exerciceId) => {
        const r = reevals.find((x) => x.exerciceId === exerciceId);
        if (!r)
            return null;
        const lignesEcarts = r.lignesEcarts ?? [
            { compteId: 'c-676', numero: '67600000', debit: -(r.passeSurLaCaisse ?? -300_000), credit: 0 },
            { compteId: 'c-5712', numero: '57120000', debit: 0, credit: -(r.passeSurLaCaisse ?? -300_000) },
        ];
        const exo = exercices.find((x) => x.id === r.exerciceId);
        return {
            id: `r-${r.exerciceId}`,
            exerciceId: r.exerciceId,
            exercice: exo ? { id: exo.id, dateDebut: exo.dateDebut, dateFin: exo.dateFin } : { id: r.exerciceId, dateDebut: N.dateDebut, dateFin: N.dateFin },
            dateReevaluation: r.dateReevaluation ?? exo?.dateFin ?? N.dateFin,
            ecritureExtourneId: r.contrePassee || r.extourneInverseLaCaisse ? 'cp' : null,
            createdAt: new Date('2027-01-05'),
            annuleeLe: null,
            coursUtilises: r.coursUtilises === undefined ? { usd: 2500 } : r.coursUtilises,
            ecartsDisponibilites: r.ecartsDisponibilites ?? null,
            ventilationDisponibilites: r.ventilation ?? null,
            ecritureEcarts: {
                statut: r.statutEcarts ?? 'VALIDEE',
                valideeAt: r.valideeAt === undefined ? new Date('2027-01-05') : r.valideeAt,
                lignes: lignesEcarts.map((l) => ({ compteId: l.compteId, debit: l.debit, credit: l.credit, compte: { numero: l.numero } })),
            },
            ecritureExtourne: r.extourneInverseLaCaisse
                ? {
                    exerciceId: r.contrePasseeDans ?? suivantDe(r.exerciceId),
                    exercice: exerciceDe(r.contrePasseeDans ?? suivantDe(r.exerciceId)),
                    numeroPiece: 12,
                    date: new Date('2027-01-01'),
                    lignes: lignesEcarts.map((l) => ({ compte: { numero: l.numero } })),
                }
                : r.contrePassee
                    ? {
                        exerciceId: r.contrePasseeDans ?? suivantDe(r.exerciceId),
                        exercice: exerciceDe(r.contrePasseeDans ?? suivantDe(r.exerciceId)),
                        numeroPiece: 12,
                        date: new Date('2028-01-01'),
                        lignes: lignesEcarts.filter((l) => !/^(52|53|55|57|58|676|776)/.test(l.numero)).map((l) => ({ compte: { numero: l.numero } })),
                    }
                    : null,
            contrePassationDeclareeId: r.declareeDans ? 'od-manuelle' : null,
            contrePassationDeclaree: r.declareeDans
                ? {
                    id: 'od-manuelle',
                    exerciceId: r.declareeDans,
                    exercice: exerciceDe(r.declareeDans),
                    numeroPiece: 40,
                    date: exerciceDe(r.declareeDans).dateDebut,
                    lignes: lignesEcarts
                        .filter((l) => r.declareeInverseTout || !/^(52|53|55|57|58|676|776)/.test(l.numero))
                        .map((l) => ({ compteId: l.compteId, debit: l.credit, credit: l.debit, compte: { numero: l.numero } })),
                }
                : null,
        };
    };
    const creer = jest.fn().mockResolvedValue({ id: 'ecr' });
    const create = jest.fn().mockResolvedValue({ id: 'r27' });
    const update = jest.fn(async (a) => {
        const r = reevals[0];
        if (r && a.data.ventilationDisponibilites)
            r.ventilation = a.data.ventilationDisponibilites;
        if (typeof a.data.ecritureExtourneId === 'string') {
            const visee = reevals.find((x) => `r-${x.exerciceId}` === a.where?.id);
            const derniere = creer.mock.calls.at(-1)?.[2];
            if (visee) {
                visee.contrePassee = true;
                visee.contrePasseeDans = derniere?.exerciceId;
            }
        }
        return { id: 'r' };
    });
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        exercice: {
            findMany: jest.fn(async (a = {}) => trier(filtrerExercices(a.where), a.orderBy)),
            findFirst: jest.fn(async (a = {}) => trier(filtrerExercices(a.where), a.orderBy)[0] ?? null),
        },
        ligneEcriture: {
            aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { debit: 0, credit: 0 } }),
            findMany: jest.fn(async (a = {}) => lignesFiltrees(a.where).map(habiller)),
            groupBy: jest.fn(async (a) => grouper(a)),
            fields: { credit: CHAMP_CREDIT },
        },
        reevaluation: {
            findMany: jest.fn(async (a = {}) => {
                const w = a.where ?? {};
                const ex = w.exercice;
                const borne = ex?.dateFin?.lt;
                const debutAuPlusTard = ex?.dateDebut?.lte;
                if (!borne && !debutAuPlusTard)
                    return [];
                const sauf = w.exerciceId?.not;
                return reevals
                    .filter((r) => r.exerciceId !== sauf)
                    .map((r) => reevaluationDe(r.exerciceId))
                    .filter((r) => (borne ? r.exercice.dateFin.getTime() < borne.getTime() : r.exercice.dateDebut.getTime() <= debutAuPlusTard.getTime()))
                    .sort((x, y) => y.dateReevaluation.getTime() - x.dateReevaluation.getTime());
            }),
            findFirst: jest.fn(async (a = {}) => {
                const id = a.where?.id;
                if (typeof id === 'string')
                    return reevaluationDe(id.replace(/^r-/, ''));
                return reevaluationDe(String(a.where?.exerciceId ?? ''));
            }),
            findFirstOrThrow: jest.fn(async () => ({ id: 'r' })),
            create,
            update,
        },
        devise: {
            findMany: jest.fn().mockResolvedValue([
                { id: 'usd', code: 'USD' },
                { id: 'eur', code: 'EUR' },
                { id: 'gbp', code: 'GBP' },
            ]),
        },
        provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
        verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
        ecriture: {
            count: jest.fn().mockResolvedValue(1),
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn(async (a = {}) => {
                if (!a.distinct?.includes('exerciceId'))
                    return [];
                const exercicesLus = a.where?.exerciceId?.in ?? [];
                return [...new Set(p.lignes.filter((l) => l.ouverture === 'DEFINITIF' && exercicesLus.includes(l.exerciceId)).map((l) => l.exerciceId))].map((exerciceId) => ({ exerciceId }));
            }),
        },
        coursDevise: {
            findFirst: jest.fn(async (a) => {
                const c = typeof p.cours === 'function' ? p.cours(a.where.date.lte, a.where.deviseId) : (p.cours ?? 2400);
                return c === null ? null : { cours: c };
            }),
        },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'od' }) },
        compte: { findFirst: jest.fn(async (a) => ({ id: `c-${a.where.numero.startsWith}` })) },
    };
    return {
        svc: new devises_service_1.DevisesService(prisma, { creer, retirerCompensation: jest.fn() }),
        creer,
        create,
        update,
    };
}
const caisse = (r) => r.positions.find((x) => x.numero === '57120000');
describe('A5 bis · la caisse en devise part de sa valeur de clôture précédente', () => {
    it('écart de N gardé et à-nouveau d’OmegaX · la position vaut 2 500 000, la perte de N+1 est de 100 000', async () => {
        const { svc } = monter({
            lignes: [caisseN, ouvertureN1()],
            reeval: { exerciceId: 'e26', ecartsDisponibilites: [{ compteId: 'c-5712', deviseId: 'usd', ecart: -300_000 }] },
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(caisse(r)).toMatchObject({ valeurComptable: 2_500_000, ecart: -100_000 });
        expect(r.perteRealisee).toBe(100_000);
        expect(r.reportsDisponibilitesNonEtablis).toEqual([]);
    });
    it('réévaluation antérieure à A5 bis, écart non gardé · relu sur son écriture (compte en une seule devise)', async () => {
        const { svc } = monter({ lignes: [caisseN, ouvertureN1()], reeval: { exerciceId: 'e26' } });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(caisse(r)).toMatchObject({ valeurComptable: 2_500_000, ecart: -100_000 });
    });
    it('ancienne contre-passation qui a inversé la caisse · la caisse est revenue au coût historique, rien n’est reporté', async () => {
        const { svc } = monter({
            lignes: [caisseN, ouvertureN1()],
            reeval: { exerciceId: 'e26', extourneInverseLaCaisse: true },
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(caisse(r)).toMatchObject({ valeurComptable: 2_800_000, ecart: -400_000 });
    });
    it('troisième tour · contre-passation faite À LA MAIN et déclarée, qui a inversé la caisse · revenue au coût historique, rien n’est reporté', async () => {
        const { svc } = monter({
            lignes: [caisseN, ouvertureN1()],
            reeval: {
                exerciceId: 'e26',
                lignesEcarts: [
                    { compteId: 'c-4791', numero: '47910000', debit: 0, credit: 50_000 },
                    { compteId: 'c-4111', numero: '41110000', debit: 50_000, credit: 0 },
                    { compteId: 'c-676', numero: '67600000', debit: 300_000, credit: 0 },
                    { compteId: 'c-5712', numero: '57120000', debit: 0, credit: 300_000 },
                ],
                declareeDans: 'e27',
                declareeInverseTout: true,
            },
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(caisse(r)).toMatchObject({ valeurComptable: 2_800_000, ecart: -400_000 });
    });
    it('troisième tour · déclarée, mais du seul écart de conversion · la caisse garde l’écart de N, reporté', async () => {
        const { svc } = monter({
            lignes: [caisseN, ouvertureN1()],
            reeval: {
                exerciceId: 'e26',
                lignesEcarts: [
                    { compteId: 'c-4791', numero: '47910000', debit: 0, credit: 50_000 },
                    { compteId: 'c-4111', numero: '41110000', debit: 50_000, credit: 0 },
                    { compteId: 'c-676', numero: '67600000', debit: 300_000, credit: 0 },
                    { compteId: 'c-5712', numero: '57120000', debit: 0, credit: 300_000 },
                ],
                declareeDans: 'e27',
            },
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(caisse(r)).toMatchObject({ valeurComptable: 2_500_000, ecart: -100_000 });
    });
    it('M1 · une ancienne contre-passation passée plus loin que l’exercice qui suit · la caisse n’y est pas revenue au coût, l’écart est reporté', async () => {
        const { svc } = monter({
            lignes: [caisseN, ouvertureN1()],
            reeval: { exerciceId: 'e26', extourneInverseLaCaisse: true, contrePasseeDans: 'e28' },
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(caisse(r)).toMatchObject({ valeurComptable: 2_500_000, ecart: -100_000 });
    });
    it('ouverture saisie par le cabinet (pas un report d’OmegaX) · elle porte sa propre valeur, rien n’est ajouté', async () => {
        const { svc } = monter({
            lignes: [caisseN, { ...ouvertureN1('SAISIE'), debit: 2_500_000 }],
            reeval: { exerciceId: 'e26', ecartsDisponibilites: [{ compteId: 'c-5712', deviseId: 'usd', ecart: -300_000 }] },
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(caisse(r)).toMatchObject({ valeurComptable: 2_500_000, ecart: -100_000 });
    });
    it('à-nouveau provisoire passé avant la validation de l’écart · réserve nommée, passage refusé, rien écrit', async () => {
        const { svc, creer } = monter({
            lignes: [caisseN, ouvertureN1('PROVISOIRE', new Date('2027-01-02'))],
            reeval: { exerciceId: 'e26', ecartsDisponibilites: [{ compteId: 'c-5712', deviseId: 'usd', ecart: -300_000 }], valideeAt: new Date('2027-01-05') },
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(r.reportsDisponibilitesNonEtablis).toEqual([
            expect.stringMatching(/Relancez l'à-nouveau provisoire, ou clôturez l'exercice précédent/),
        ]);
        expect(r.reportsDisponibilitesNonEtablis[0]).not.toMatch(/Validez/);
        expect(r.avertissements).toEqual(expect.arrayContaining([expect.stringMatching(/Relancez l'à-nouveau provisoire/)]));
        await expect(svc.reevaluer('t', 'u', { exerciceId: 'e27' })).rejects.toThrow(/Relancez l'à-nouveau provisoire/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('écriture des écarts encore au brouillard (M3) · « validez-la », puis relancer ou clôturer', async () => {
        const { svc } = monter({
            lignes: [caisseN, ouvertureN1('PROVISOIRE', new Date('2027-01-02'))],
            reeval: {
                exerciceId: 'e26',
                ecartsDisponibilites: [{ compteId: 'c-5712', deviseId: 'usd', ecart: -300_000 }],
                statutEcarts: 'BROUILLARD',
                valideeAt: null,
            },
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(r.reportsDisponibilitesNonEtablis).toEqual([
            expect.stringMatching(/Validez l'écriture des écarts, puis relancez l'à-nouveau provisoire ou clôturez l'exercice précédent/),
        ]);
    });
    it('la réévaluation garde l’écart de chaque disponibilité pour la suivante', async () => {
        const { svc, create } = monter({ lignes: [{ ...caisseN, exerciceId: 'e27', date: new Date('2027-03-01') }] });
        await svc.reevaluer('t', 'u', { exerciceId: 'e27' });
        expect(create.mock.calls[0][0].data.ecartsDisponibilites).toEqual([{ compteId: 'c-5712', deviseId: 'usd', ecart: -400_000 }]);
    });
    describe('caisse tenue en deux devises, réévaluation antérieure à A5 bis', () => {
        const euroN = { ...caisseN, deviseId: 'eur', debit: 300_000, montantDevise: 100 };
        const lignes = [caisseN, euroN, ouvertureN1(), { ...ouvertureN1(), deviseId: 'eur', debit: 300_000, montantDevise: 100 }];
        it('le cours gardé (D5) rend chaque devise, et leur somme rend la ligne passée · reporté devise par devise', async () => {
            const { svc } = monter({ lignes, reeval: { exerciceId: 'e26', coursUtilises: { usd: 2500, eur: 3100 }, passeSurLaCaisse: -290_000 } });
            const r = await svc.calculer('t', { exerciceId: 'e27' });
            const usd = r.positions.find((x) => x.deviseCode === 'USD');
            expect(usd).toMatchObject({ valeurComptable: 2_500_000, ecart: -100_000 });
            expect(r.reportsDisponibilitesNonEtablis).toEqual([]);
        });
        it('sans cours gardé, ou si la somme ne rend pas la ligne · rien n’est deviné, le passage est refusé', async () => {
            for (const reeval of [
                { exerciceId: 'e26', coursUtilises: null, passeSurLaCaisse: -290_000 },
                { exerciceId: 'e26', coursUtilises: { usd: 2500, eur: 3100 }, passeSurLaCaisse: -280_000 },
            ]) {
                const { svc, creer } = monter({ lignes, reeval });
                const r = await svc.calculer('t', { exerciceId: 'e27' });
                expect(r.reportsDisponibilitesNonEtablis).toEqual([expect.stringMatching(/ne se relit pas/)]);
                await expect(svc.reevaluer('t', 'u', { exerciceId: 'e27' })).rejects.toThrow(/ne se relit pas/);
                expect(creer).not.toHaveBeenCalled();
            }
        });
        it('(a) une devise soldée en N, nulle en devise ET en francs, ne compte plus · la devise restante reçoit la ligne', async () => {
            const entreeEur = { ...caisseN, deviseId: 'eur', debit: 300_000, montantDevise: 100 };
            const sortieEur = { ...caisseN, deviseId: 'eur', debit: 0, credit: 300_000, montantDevise: 100, date: new Date('2026-07-01') };
            const { svc } = monter({
                lignes: [caisseN, entreeEur, sortieEur, ouvertureN1()],
                reeval: { exerciceId: 'e26', coursUtilises: null, passeSurLaCaisse: -300_000 },
            });
            const r = await svc.calculer('t', { exerciceId: 'e27' });
            expect(r.reportsDisponibilitesNonEtablis).toEqual([]);
            expect(caisse(r)).toMatchObject({ valeurComptable: 2_500_000, ecart: -100_000 });
        });
        it('(b) sans cours gardé, le cours de la table à la date de la réévaluation rend la ligne au centime · reporté', async () => {
            const cours = (date, deviseId) => date.getTime() <= N.dateFin.getTime() ? (deviseId === 'eur' ? 3100 : 2500) : deviseId === 'eur' ? 3000 : 2400;
            const { svc } = monter({ lignes, reeval: { exerciceId: 'e26', coursUtilises: null, passeSurLaCaisse: -290_000 }, cours });
            const r = await svc.calculer('t', { exerciceId: 'e27' });
            expect(r.reportsDisponibilitesNonEtablis).toEqual([]);
            const usd = r.positions.find((x) => x.deviseCode === 'USD');
            expect(usd).toMatchObject({ valeurComptable: 2_500_000, ecart: -100_000 });
        });
        it('la relecture voit la caisse TELLE QU’ELLE ÉTAIT · une ligne saisie après la réévaluation, même antidatée, ne la fausse pas', async () => {
            const tardive = { ...caisseN, deviseId: 'eur', debit: 30_000, montantDevise: 10, date: new Date('2026-11-01'), creeeLe: new Date('2027-02-01') };
            const { svc } = monter({
                lignes: [...lignes, tardive],
                reeval: { exerciceId: 'e26', coursUtilises: { usd: 2500, eur: 3100 }, passeSurLaCaisse: -290_000 },
            });
            const r = await svc.calculer('t', { exerciceId: 'e27' });
            expect(r.reportsDisponibilitesNonEtablis).toEqual([]);
        });
        it('(c) rien ne se relit · la ventilation se DÉCLARE avec sa source, vérifiée au centime, puis sert au report', async () => {
            const reeval = { exerciceId: 'e26', coursUtilises: null, passeSurLaCaisse: -290_000 };
            const { svc, update } = monter({ lignes, reeval });
            const ventilation = [
                { compteId: 'c-5712', deviseId: 'usd', ecart: -300_000 },
                { compteId: 'c-5712', deviseId: 'eur', ecart: 10_000 },
            ];
            await expect(svc.declarerVentilationDisponibilites('t', 'u', 'r-e26', {
                ventilation: [{ ...ventilation[0], ecart: -310_000 }, ventilation[1]],
                source: 'Relevé USD et EUR',
            })).rejects.toThrow(/ne rend pas la ligne passée/);
            await expect(svc.declarerVentilationDisponibilites('t', 'u', 'r-e26', { ventilation, source: ' ' })).rejects.toThrow(/source/);
            expect(update).not.toHaveBeenCalled();
            await svc.declarerVentilationDisponibilites('t', 'u', 'r-e26', { ventilation, source: 'Relevés USD et EUR au 31/12/2026' });
            expect(update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'r-e26', tenantId: 't' },
                data: expect.objectContaining({ ventilationDisponibilites: ventilation, ventilationDisponibilitesSource: 'Relevés USD et EUR au 31/12/2026' }),
            }));
            const r = await svc.calculer('t', { exerciceId: 'e27' });
            expect(r.reportsDisponibilitesNonEtablis).toEqual([]);
            expect(r.positions.find((x) => x.deviseCode === 'USD')).toMatchObject({ valeurComptable: 2_500_000, ecart: -100_000 });
        });
        it('m1 · seules les devises que la réévaluation a lues sur le compte, toutes déclarées, chacune dans ses bornes', async () => {
            const reeval = { exerciceId: 'e26', coursUtilises: null, passeSurLaCaisse: -290_000 };
            const source = 'Relevés au 31/12/2026';
            for (const [ventilation, motif] of [
                [
                    [
                        { compteId: 'c-5712', deviseId: 'usd', ecart: -300_000 },
                        { compteId: 'c-5712', deviseId: 'eur', ecart: 0 },
                        { compteId: 'c-5712', deviseId: 'gbp', ecart: 10_000 },
                    ],
                    /n'a pas été lue par la réévaluation sur ce compte/,
                ],
                [[{ compteId: 'c-5712', deviseId: 'usd', ecart: -290_000 }], /Chaque devise lue/],
                [
                    [
                        { compteId: 'c-5712', deviseId: 'usd', ecart: -3_000_000 },
                        { compteId: 'c-5712', deviseId: 'eur', ecart: 2_710_000 },
                    ],
                    /signe contraire à son montant en devise/,
                ],
            ]) {
                const { svc, update } = monter({ lignes, reeval });
                await expect(svc.declarerVentilationDisponibilites('t', 'u', 'r-e26', { ventilation: [...ventilation], source })).rejects.toThrow(motif);
                expect(update).not.toHaveBeenCalled();
            }
        });
        it('m1 · une devise soldée en devise mais non en francs valait zéro · son écart est l’opposé de ses francs', async () => {
            const sortieEur = { ...caisseN, deviseId: 'eur', debit: 0, credit: 290_000, montantDevise: 100, date: new Date('2026-07-01') };
            const reeval = { exerciceId: 'e26', coursUtilises: null, passeSurLaCaisse: -310_000 };
            const avecSortie = [...lignes, sortieEur];
            const source = 'Relevés au 31/12/2026';
            const faux = monter({ lignes: avecSortie, reeval });
            await expect(faux.svc.declarerVentilationDisponibilites('t', 'u', 'r-e26', {
                ventilation: [
                    { compteId: 'c-5712', deviseId: 'usd', ecart: -305_000 },
                    { compteId: 'c-5712', deviseId: 'eur', ecart: -5_000 },
                ],
                source,
            })).rejects.toThrow(/l'opposé de ses francs \(-10000\.00\)/);
            const juste = monter({ lignes: avecSortie, reeval });
            await juste.svc.declarerVentilationDisponibilites('t', 'u', 'r-e26', {
                ventilation: [
                    { compteId: 'c-5712', deviseId: 'usd', ecart: -300_000 },
                    { compteId: 'c-5712', deviseId: 'eur', ecart: -10_000 },
                ],
                source,
            });
            expect(juste.update).toHaveBeenCalled();
        });
        it('(c) une ligne qui se relit n’admet pas de déclaration · rien à déclarer', async () => {
            const { svc, update } = monter({ lignes, reeval: { exerciceId: 'e26', coursUtilises: { usd: 2500, eur: 3100 }, passeSurLaCaisse: -290_000 } });
            await expect(svc.declarerVentilationDisponibilites('t', 'u', 'r-e26', {
                ventilation: [{ compteId: 'c-5712', deviseId: 'usd', ecart: -290_000 }],
                source: 'Relevé',
            })).rejects.toThrow(/rien à déclarer/);
            expect(update).not.toHaveBeenCalled();
        });
        it('(d) exercice clôturé · la réserve nomme la déclaration, jamais l’annulation ; ouvert · les deux', async () => {
            const reeval = { exerciceId: 'e26', coursUtilises: null, passeSurLaCaisse: -290_000 };
            const clos = await monter({ lignes, reeval }).svc.calculer('t', { exerciceId: 'e27' });
            expect(clos.reportsDisponibilitesNonEtablis[0]).toMatch(/Ventiler l'écart des disponibilités/);
            expect(clos.reportsDisponibilitesNonEtablis[0]).not.toMatch(/annulez/i);
            const ouvert = await monter({ lignes, reeval, exercices: [{ ...N, statut: 'OUVERT' }, N1] }).svc.calculer('t', { exerciceId: 'e27' });
            expect(ouvert.reportsDisponibilitesNonEtablis[0]).toMatch(/Ventiler l'écart des disponibilités.*ou annulez cette réévaluation/);
        });
    });
});
describe('A5 bis · la banque en devise sur deux exercices, report en SOLDE et en DÉTAIL', () => {
    const banqueN = {
        compteId: 'c-5215',
        numero: '52150000',
        deviseId: 'usd',
        debit: 2_000_000,
        credit: 0,
        montantDevise: 1000,
        exerciceId: 'e26',
        date: new Date('2026-06-01'),
    };
    const ecartsN = [
        { compteId: 'c-5215', numero: '52150000', debit: 100_000, credit: 0 },
        { compteId: 'c-776', numero: '77600000', debit: 0, credit: 100_000 },
    ];
    const ouverture = { exerciceId: 'e27', date: N1.dateDebut, ouverture: 'DEFINITIF' };
    const reportSolde = [
        { ...banqueN, ...ouverture },
        { ...banqueN, ...ouverture, deviseId: null, montantDevise: null, debit: 100_000 },
    ];
    const reportDetail = [
        { ...banqueN, ...ouverture, debit: 1_200_000, montantDevise: 600 },
        { ...banqueN, ...ouverture, debit: 800_000, montantDevise: 400 },
        { ...banqueN, ...ouverture, deviseId: null, montantDevise: null, debit: 100_000 },
    ];
    const cours = 2150;
    it.each([
        ['SOLDE', reportSolde],
        ['DÉTAIL', reportDetail],
    ])('nouveau régime (aucune contre-passation de la banque), report en %s · gain de N+1 de 50 000', async (_mode, report) => {
        const { svc } = monter({
            lignes: [banqueN, ...report],
            reeval: { exerciceId: 'e26', lignesEcarts: ecartsN, ecartsDisponibilites: [{ compteId: 'c-5215', deviseId: 'usd', ecart: 100_000 }] },
            cours,
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(r.positions).toEqual([expect.objectContaining({ numero: '52150000', valeurComptable: 2_100_000, valeurReevaluee: 2_150_000, ecart: 50_000 })]);
        expect(r.gainRealise).toBe(50_000);
    });
    it.each([
        ['SOLDE', reportSolde],
        ['DÉTAIL', reportDetail],
    ])('ancien régime (la contre-passation a déjà inversé la banque de 100 000), report en %s · total juste', async (_mode, report) => {
        const { svc } = monter({
            lignes: [banqueN, ...report],
            reeval: { exerciceId: 'e26', lignesEcarts: ecartsN, extourneInverseLaCaisse: true },
            cours,
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(r.positions).toEqual([expect.objectContaining({ valeurComptable: 2_000_000, ecart: 150_000 })]);
        const contrePassation = -100_000;
        expect(r.gainRealise + contrePassation).toBe(50_000);
    });
    it('trois exercices · les écarts de N-1 et de N s’ajoutent au fil des reports d’OmegaX', async () => {
        const N0 = { id: 'e25', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31'), statut: 'CLOTURE' };
        const banqueN0 = { ...banqueN, exerciceId: 'e25', date: new Date('2025-06-01') };
        const { svc } = monter({
            exercices: [N0, N, N1],
            lignes: [
                banqueN0,
                { ...banqueN0, exerciceId: 'e26', date: N.dateDebut, ouverture: 'DEFINITIF' },
                { ...banqueN0, exerciceId: 'e27', date: N1.dateDebut, ouverture: 'DEFINITIF' },
            ],
            reevals: [
                { exerciceId: 'e25', dateReevaluation: N0.dateFin, ecartsDisponibilites: [{ compteId: 'c-5215', deviseId: 'usd', ecart: 50_000 }] },
                { exerciceId: 'e26', ecartsDisponibilites: [{ compteId: 'c-5215', deviseId: 'usd', ecart: 50_000 }] },
            ],
            cours,
        });
        const r = await svc.calculer('t', { exerciceId: 'e27' });
        expect(r.positions).toEqual([expect.objectContaining({ valeurComptable: 2_100_000, ecart: 50_000 })]);
    });
    describe('B-I · contre-passation de N posée à l’ouverture de N+2', () => {
        const N2 = { id: 'e28', dateDebut: new Date('2028-01-01'), dateFin: new Date('2028-12-31'), statut: 'OUVERT' };
        const banque = { ...banqueN, debit: 1_364_000 };
        const ouvertures = [
            { ...banque, exerciceId: 'e27', date: N1.dateDebut, ouverture: 'DEFINITIF' },
            { ...banque, exerciceId: 'e28', date: N2.dateDebut, ouverture: 'DEFINITIF' },
        ];
        const reevalN = { exerciceId: 'e26', lignesEcarts: ecartsN, extourneInverseLaCaisse: true, contrePasseeDans: 'e28' };
        const cours1600 = (date) => (date.getTime() >= N2.dateDebut.getTime() ? 1600 : 1605);
        it('N+1 réévalué après A5 bis (+141 000) · la banque vaut 1 505 000 avant la réévaluation de N+2, et finit à 1 600 000', async () => {
            const { svc } = monter({
                exercices: [N, { ...N1, statut: 'CLOTURE' }, N2],
                lignes: [banque, ...ouvertures],
                reevals: [
                    reevalN,
                    {
                        exerciceId: 'e27',
                        dateReevaluation: N1.dateFin,
                        lignesEcarts: [
                            { compteId: 'c-5215', numero: '52150000', debit: 141_000, credit: 0 },
                            { compteId: 'c-776', numero: '77600000', debit: 0, credit: 141_000 },
                        ],
                        ecartsDisponibilites: [{ compteId: 'c-5215', deviseId: 'usd', ecart: 141_000 }],
                    },
                ],
                cours: cours1600,
            });
            const r = await svc.calculer('t', { exerciceId: 'e28' });
            expect(r.positions).toEqual([expect.objectContaining({ valeurComptable: 1_505_000, valeurReevaluee: 1_600_000, ecart: 95_000 })]);
        });
        it('N+1 clôturé sans réévaluation · la banque vaut 1 364 000 avant la réévaluation de N+2, et finit à 1 600 000', async () => {
            const { svc } = monter({
                exercices: [N, { ...N1, statut: 'CLOTURE' }, N2],
                lignes: [banque, ...ouvertures],
                reevals: [reevalN],
                cours: cours1600,
            });
            const r = await svc.calculer('t', { exerciceId: 'e28' });
            expect(r.positions).toEqual([expect.objectContaining({ valeurComptable: 1_364_000, valeurReevaluee: 1_600_000, ecart: 236_000 })]);
        });
        it('lue pour N+1, la même contre-passation n’a pas encore eu lieu · l’écart de N se reporte', async () => {
            const { svc } = monter({ exercices: [N, N1, N2], lignes: [banque, ...ouvertures], reevals: [reevalN], cours: cours1600 });
            const r = await svc.calculer('t', { exerciceId: 'e27' });
            expect(r.positions).toEqual([expect.objectContaining({ valeurComptable: 1_464_000 })]);
        });
    });
});
describe('A5 bis · la créance en devise · réévaluer N+1 exige la contre-passation de N', () => {
    const creanceN = {
        compteId: 'c-4111',
        numero: '41110000',
        deviseId: 'usd',
        debit: 2_000_000,
        credit: 0,
        montantDevise: 1000,
        exerciceId: 'e26',
        date: new Date('2026-06-01'),
    };
    const ecartsN = [
        { compteId: 'c-4111', numero: '41110000', debit: 100_000, credit: 0 },
        { compteId: 'c-4791', numero: '47910000', debit: 0, credit: 100_000 },
    ];
    const report = { ...creanceN, exerciceId: 'e27', date: N1.dateDebut, ouverture: 'DEFINITIF' };
    const ecartOuvert = (exerciceId, dateDebut, credit) => ({
        compteId: 'c-4791',
        numero: '47910000',
        deviseId: null,
        debit: 0,
        credit,
        montantDevise: null,
        exerciceId,
        date: dateDebut,
        ouverture: 'DEFINITIF',
    });
    const ecart479N1 = ecartOuvert('e27', N1.dateDebut, 100_000);
    it('non contre-passée · refus nommé, avec son issue, rien écrit', async () => {
        const { svc, creer } = monter({ lignes: [creanceN, report, ecart479N1], reeval: { exerciceId: 'e26', lignesEcarts: ecartsN }, cours: 2150 });
        await expect(svc.reevaluer('t', 'u', { exerciceId: 'e27' })).rejects.toThrow(/Passez la contre-passation de la réévaluation du 2026-12-31/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('contre-passée · la réévaluation de N+1 passe, sur l’écart depuis le coût historique (150 000, le 479 de N étant soldé)', async () => {
        const { svc, creer } = monter({
            lignes: [creanceN, report, ecart479N1],
            reeval: { exerciceId: 'e26', lignesEcarts: ecartsN, contrePassee: true },
            cours: 2150,
        });
        const { rapport } = await svc.reevaluer('t', 'u', { exerciceId: 'e27' });
        expect(rapport.positions).toEqual([expect.objectContaining({ numero: '41110000', valeurComptable: 2_000_000, ecart: 150_000 })]);
        expect(creer).toHaveBeenCalled();
    });
    it('B3 · le refus nomme le report au premier jour non clôturé quand la première période est close (art. 22, 4°)', async () => {
        const { svc } = monter({ lignes: [creanceN, report, ecart479N1], reeval: { exerciceId: 'e26', lignesEcarts: ecartsN }, cours: 2150 });
        await expect(svc.reevaluer('t', 'u', { exerciceId: 'e27' })).rejects.toThrow(/premier jour non clôturé.*AUDCIF art\. 22, 4°/);
    });
    it('M1 · contre-passée dans un exercice plus lointain · refus nommé, l’issue (annuler la contre-passation) dite, rien écrit', async () => {
        const { svc, creer } = monter({
            lignes: [creanceN, report, ecart479N1],
            reeval: { exerciceId: 'e26', lignesEcarts: ecartsN, contrePassee: true, contrePasseeDans: 'e28' },
            cours: 2150,
        });
        await expect(svc.reevaluer('t', 'u', { exerciceId: 'e27' })).rejects.toThrow(/n'est pas à l'ouverture du premier exercice ouvert[\s\S]*Annuler la contre-passation[\s\S]*passez-la à l'ouverture de cet exercice/);
        expect(creer).not.toHaveBeenCalled();
    });
    describe('B-II · N+1 clôturé sans réévaluation', () => {
        const N2 = { id: 'e28', dateDebut: new Date('2028-01-01'), dateFin: new Date('2028-12-31'), statut: 'OUVERT' };
        const exercices = [N, { ...N1, statut: 'CLOTURE' }, N2];
        const ecarts500 = [
            { compteId: 'c-4111', numero: '41110000', debit: 500_000, credit: 0 },
            { compteId: 'c-4791', numero: '47910000', debit: 0, credit: 500_000 },
        ];
        const lignes = [
            creanceN,
            report,
            { ...creanceN, exerciceId: 'e28', date: N2.dateDebut, ouverture: 'DEFINITIF' },
            ecartOuvert('e27', N1.dateDebut, 500_000),
            ecartOuvert('e28', N2.dateDebut, 500_000),
        ];
        it('non contre-passée · N+2 refusé, la cible (cet exercice) nommée, rien écrit', async () => {
            const { svc, creer } = monter({ exercices, lignes, reeval: { exerciceId: 'e26', lignesEcarts: ecarts500 }, cours: 2600 });
            await expect(svc.reevaluer('t', 'u', { exerciceId: 'e28' })).rejects.toThrow(/réévaluation du 2026-12-31 n'est pas contre-passée[\s\S]*Passez la contre-passation de la réévaluation du 2026-12-31 \(Devises\) à l'ouverture de cet exercice/);
            expect(creer).not.toHaveBeenCalled();
        });
        it('contre-passée à l’ouverture de N+2 · N+2 passe depuis le coût · 411 à 2 600 000 et 479 à −600 000', async () => {
            const { svc } = monter({
                exercices,
                lignes,
                reeval: { exerciceId: 'e26', lignesEcarts: ecarts500, contrePassee: true, contrePasseeDans: 'e28' },
                cours: 2600,
            });
            const { rapport } = await svc.reevaluer('t', 'u', { exerciceId: 'e28' });
            const p = rapport.positions.find((x) => x.numero === '41110000');
            expect(p).toMatchObject({ valeurComptable: 2_000_000, ecart: 600_000 });
            expect(2_000_000 + 500_000 - 500_000 + p.ecart).toBe(2_600_000);
            expect(-500_000 + 500_000 - p.ecart).toBe(-600_000);
        });
        it('N+1 OUVERT, contre-passation posée en N+2 · N+2 attend N+1, et N+1 nomme la contre-passation à annuler et à repasser chez lui', async () => {
            const { svc } = monter({
                exercices: [N, N1, N2],
                lignes,
                reeval: { exerciceId: 'e26', lignesEcarts: ecarts500, contrePassee: true, contrePasseeDans: 'e28' },
                cours: 2600,
            });
            await expect(svc.reevaluer('t', 'u', { exerciceId: 'e28' })).rejects.toThrow(/antérieur et encore ouvert, n'est pas réévalué/);
            await expect(svc.reevaluer('t', 'u', { exerciceId: 'e27' })).rejects.toThrow(/Annuler la contre-passation[\s\S]*passez-la à l'ouverture de cet exercice/);
        });
    });
    describe('s11 · N oubliée derrière N+1 réévalué et contre-passé', () => {
        const N2 = { id: 'e28', dateDebut: new Date('2028-01-01'), dateFin: new Date('2028-12-31'), statut: 'OUVERT' };
        const exercices = [N, { ...N1, statut: 'CLOTURE' }, N2];
        const ecartsN = [
            { compteId: 'c-4111', numero: '41110000', debit: 500_000, credit: 0 },
            { compteId: 'c-4791', numero: '47910000', debit: 0, credit: 500_000 },
        ];
        const ecartsN1 = [
            { compteId: 'c-4111', numero: '41110000', debit: 400_000, credit: 0 },
            { compteId: 'c-4791', numero: '47910000', debit: 0, credit: 400_000 },
        ];
        const livreN2 = [
            { compteId: 'c-4111', solde: 2_000_000 + 500_000 + 400_000 - 400_000 },
            { compteId: 'c-4791', solde: -500_000 - 400_000 + 400_000 },
        ];
        const ecart479 = (exerciceId, date, debit, credit) => ({
            compteId: 'c-4791',
            numero: '47910000',
            deviseId: null,
            debit,
            credit,
            montantDevise: null,
            exerciceId,
            date,
        });
        const livre479 = [ecart479('e27', N1.dateFin, 0, 400_000), ecart479('e28', N2.dateDebut, 400_000, 0)];
        const monterS11 = () => monter({
            exercices,
            lignes: [
                creanceN,
                report,
                { ...creanceN, exerciceId: 'e28', date: N2.dateDebut, ouverture: 'DEFINITIF' },
                ecartOuvert('e27', N1.dateDebut, 500_000),
                ecartOuvert('e28', N2.dateDebut, 900_000),
                ...livre479,
            ],
            reevals: [
                { exerciceId: 'e26', lignesEcarts: ecartsN },
                { exerciceId: 'e27', lignesEcarts: ecartsN1, dateReevaluation: N1.dateFin, contrePassee: true, contrePasseeDans: 'e28' },
            ],
            cours: 2600,
        });
        const solde = (creer, compte, depart) => creer.mock.calls.reduce((t, [, , dto]) => {
            const lignes = dto.lignes;
            return t + lignes.filter((l) => l.compteId.startsWith(compte)).reduce((s, l) => s + (l.debit ?? 0) - (l.credit ?? 0), 0);
        }, depart);
        it('N+2 refusé · le refus nomme N, son exercice et les montants à contre-passer, pas N+1 déjà contre-passée ; rien écrit', async () => {
            const { svc, creer } = monterS11();
            const refus = svc.reevaluer('t', 'u', { exerciceId: 'e28' });
            await expect(refus).rejects.toThrow(/La réévaluation du 2026-12-31 n'est pas contre-passée \(exercice du 2026-01-01 au 2026-12-31\)[\s\S]*41110000 au crédit de 500000\.00, 47910000 au débit de 500000\.00[\s\S]*à l'ouverture de cet exercice/);
            await expect(svc.reevaluer('t', 'u', { exerciceId: 'e28' })).rejects.not.toThrow(/2027-12-31/);
            let message = '';
            await svc.reevaluer('t', 'u', { exerciceId: 'e28' }).catch((e) => (message = e.message));
            expect(message).toMatch(/Passez la contre-passation de la réévaluation du 2026-12-31 \(Devises\)/);
            expect(message).not.toMatch(/Déclarer une contre-passation manuelle/);
            expect(creer).not.toHaveBeenCalled();
        });
        it('N contre-passée À LA MAIN dans N+2 et déclarée · N+2 passe sans rien repasser · 411 à 2 600 000 et 479 à −600 000', async () => {
            const { svc, creer } = monter({
                exercices,
                lignes: [
                    creanceN,
                    report,
                    { ...creanceN, exerciceId: 'e28', date: N2.dateDebut, ouverture: 'DEFINITIF' },
                    ecartOuvert('e27', N1.dateDebut, 500_000),
                    ecartOuvert('e28', N2.dateDebut, 900_000),
                ],
                reevals: [
                    { exerciceId: 'e26', lignesEcarts: ecartsN, declareeDans: 'e28' },
                    { exerciceId: 'e27', lignesEcarts: ecartsN1, dateReevaluation: N1.dateFin, contrePassee: true, contrePasseeDans: 'e28' },
                ],
                cours: 2600,
            });
            await svc.reevaluer('t', 'u', { exerciceId: 'e28' });
            expect(solde(creer, 'c-4111', livreN2[0].solde - 500_000)).toBe(2_600_000);
            expect(solde(creer, 'c-479', livreN2[1].solde + 500_000)).toBe(-600_000);
        });
        it('déclarée hors de sa place (N+2 alors que N+1 est ouvert) · le portillon de N+1 la nomme, l’issue est de retirer la déclaration', async () => {
            const { svc } = monter({
                exercices: [N, N1, N2],
                lignes: [creanceN, report, ecart479N1],
                reevals: [{ exerciceId: 'e26', lignesEcarts: ecartsN, declareeDans: 'e28' }],
                cours: 2400,
            });
            await expect(svc.reevaluer('t', 'u', { exerciceId: 'e27' })).rejects.toThrow(/La contre-passation déclarée de la réévaluation du 2026-12-31[\s\S]*Retirez la déclaration/);
        });
        it('la contre-passation de N passée dans N+2, sa cible · N+2 passe · 411 à 2 600 000 et 479 à −600 000', async () => {
            const { svc, creer } = monterS11();
            await svc.extourner('t', 'u', 'r-e26', 'e28');
            expect(creer.mock.calls[0][2]).toMatchObject({
                exerciceId: 'e28',
                lignes: [{ compteId: 'c-4111', credit: 500_000 }, { compteId: 'c-4791', debit: 500_000 }],
            });
            const { rapport } = await svc.reevaluer('t', 'u', { exerciceId: 'e28' });
            expect(rapport.positions.find((x) => x.numero === '41110000')).toMatchObject({ valeurComptable: 2_000_000, ecart: 600_000 });
            expect(solde(creer, 'c-4111', livreN2[0].solde)).toBe(2_600_000);
            expect(solde(creer, 'c-479', livreN2[1].solde)).toBe(-600_000);
        });
        it('cinquante réévaluations lues au plus · le dépassement est dit avec la réévaluation passée', async () => {
            const { svc } = monterS11();
            const regles = Array.from({ length: 51 }, (_, i) => ({
                id: `r-${i}`,
                dateReevaluation: new Date(Date.UTC(1970 + i, 11, 31)),
                exercice: { id: `x-${i}`, dateDebut: new Date(Date.UTC(1970 + i, 0, 1)), dateFin: new Date(Date.UTC(1970 + i, 11, 31)) },
                ecritureExtourneId: null,
                ecritureExtourne: null,
                ecritureEcarts: null,
            }));
            const prisma = svc.prisma;
            prisma.reevaluation.findMany.mockImplementationOnce(async (a) => {
                expect(a.orderBy).toEqual([{ dateReevaluation: 'desc' }, { id: 'asc' }]);
                return regles.slice(0, a.take);
            });
            const { rapport } = await svc.reevaluer('t', 'u', { exerciceId: 'e28' });
            expect(rapport.avertissements).toEqual(expect.arrayContaining([expect.stringMatching(/vérifiées sur les 50 réévaluations antérieures les plus récentes/)]));
        });
    });
    it('mineur 1 (s12) · seules disponibilités, ancienne contre-passation posée en N+2, N+1 ouvert · N+1 n’est pas refusé (rien à repasser)', async () => {
        const N2 = { id: 'e28', dateDebut: new Date('2028-01-01'), dateFin: new Date('2028-12-31'), statut: 'OUVERT' };
        const { svc, creer } = monter({
            exercices: [N, N1, N2],
            lignes: [caisseN, ouvertureN1()],
            reeval: { exerciceId: 'e26', extourneInverseLaCaisse: true, contrePasseeDans: 'e28' },
            cours: 2400,
        });
        const { rapport } = await svc.reevaluer('t', 'u', { exerciceId: 'e27' });
        expect(caisse(rapport)).toMatchObject({ valeurComptable: 2_500_000, ecart: -100_000 });
        expect(creer).toHaveBeenCalled();
    });
    it('une réévaluation qui ne portait que des disponibilités n’a rien à contre-passer · ne bloque pas', async () => {
        const { svc, creer } = monter({ lignes: [creanceN, report, ecart479N1], reeval: { exerciceId: 'e26' }, cours: 2150 });
        await svc.reevaluer('t', 'u', { exerciceId: 'e27' });
        expect(creer).toHaveBeenCalled();
    });
});
//# sourceMappingURL=disponibilites-reportees.spec.js.map