"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const garnissage_demonstration_service_1 = require("./garnissage-demonstration.service");
const scenario_demonstration_1 = require("./scenario-demonstration");
function monde(referentiel, existant = {}, simulationEmissible = true) {
    const s = (0, scenario_demonstration_1.scenarioDemonstration)(referentiel);
    const numeros = [...new Set(s.operations.flatMap((o) => o.lignes.flatMap((l) => ('nature' in l ? [l.nature] : []))))];
    const lignes = [];
    let nl = 0;
    const deposer = (ecritureId, date, ls) => {
        for (const l of ls)
            lignes.push({ id: `l${++nl}`, ecritureId, date, ...l });
    };
    const prisma = {
        tiers: {
            findUnique: jest.fn(async ({ where }) => existant.tiers?.includes(where.tenantId_code.code)
                ? { comptesRattaches: [{ compteId: `c-${where.tenantId_code.code}` }] }
                : null),
        },
        ecriture: {
            findFirst: jest.fn(async ({ where }) => {
                const i = (existant.ecritures ?? []).findIndex((e) => e.journalId === where.journalId && e.date === where.date.toISOString().slice(0, 10) && e.libelle === where.libelle);
                return i < 0 ? null : { id: `deja-${i}` };
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel })) },
        exercice: { findFirst: jest.fn(async () => ({ id: 'ex', dateDebut: new Date('2026-01-01T00:00:00Z') })) },
        journal: { findMany: jest.fn(async () => ['ACH', 'VEN', 'BQ', 'OD'].map((code) => ({ id: `j-${code}`, code, compteTresorerieId: code === 'BQ' ? 'c-banque' : null }))) },
        compte: { findMany: jest.fn(async () => numeros.map((numero) => ({ id: `c-${numero}`, numero }))) },
        familleImmobilisation: {
            findMany: jest.fn(async ({ where }) => ['INFORMATIQUE', 'MOBILIER', 'VEHICULES'].filter((c) => where.code.in.includes(c)).map((code) => ({ id: `f-${code}`, code }))),
        },
        immobilisation: {
            findFirst: jest.fn(async ({ where }) => existant.immobilisations?.includes(where.designation) ? { ecritureAcquisitionId: `acq-deja-${where.designation}` } : null),
        },
        salarie: {
            findFirst: jest.fn(async ({ where }) => existant.salarie && where.matricule === s.salarie.matricule ? { id: 'sal-deja' } : null),
        },
        contratTravail: {
            findFirst: jest.fn(async ({ where }) => existant.contrat && where.salarieId === 'sal-deja' ? { id: 'ct-deja' } : null),
        },
        bulletinPaie: {
            findFirst: jest.fn(async ({ where }) => existant.bulletin && where.salarieId === 'sal-deja' && where.moisDePaie === `2026-${s.salarie.moisBulletin}` && where.statut === 'EMIS'
                ? { id: 'b-deja' }
                : null),
        },
        ligneEcriture: {
            findMany: jest.fn(async ({ where }) => lignes
                .filter((l) => l.compteId === where.compteId &&
                where.ecritureId.in.includes(l.ecritureId) &&
                new Date(`${l.date}T00:00:00Z`).getTime() <= where.ecriture.date.lte.getTime())
                .map((l) => ({ id: l.id, debit: l.debit, credit: l.credit }))),
        },
        rapprochementBancaire: {
            findFirst: jest.fn(async ({ where }) => existant.rapprochement && where.compteId === 'c-banque' ? { id: 'r-deja', ...existant.rapprochement } : null),
        },
        questionnaireRevision: {
            findFirst: jest.fn(async ({ where }) => existant.questionnaire && where.exerciceId === 'ex' && where.libelle === s.questionnaire ? { id: 'q-deja' } : null),
        },
    };
    const tiers = { creer: jest.fn(async (_t, dto) => ({ compteIndividuel: { id: `c-${dto.code}` } })) };
    let n = 0;
    const ecritures = {
        creer: jest.fn(async (_t, _u, dto) => {
            const id = `e${++n}`;
            deposer(id, dto.date, dto.lignes);
            return { id };
        }),
        valider: jest.fn(async () => ({})),
    };
    let na = 0;
    const immobilisations = {
        creer: jest.fn(async (_t, _u, dto) => {
            const id = `acq${++na}`;
            deposer(id, dto.dateAcquisition, [
                { compteId: 'c-immo', debit: dto.valeurOrigine, credit: 0 },
                { compteId: dto.compteContrepartieId, debit: 0, credit: dto.valeurOrigine },
            ]);
            return { id: `immo${na}`, ecritureAcquisitionId: id };
        }),
    };
    const simulation = simulationEmissible
        ? { baremeApplicable: true, motifBaremeInapplicable: null, retenue: { retenueFc: 1 }, cotisations: { totalEmployeurFc: 1, totalTravailleurFc: 1, abstentions: [] }, net: { totalVerseFc: 1, netAPayerFc: 1 }, assiettes: { assietteSocialeFc: 1 } }
        : { baremeApplicable: false, motifBaremeInapplicable: 'hors barème', retenue: null, cotisations: { totalEmployeurFc: 1, totalTravailleurFc: 1, abstentions: [] }, net: { totalVerseFc: 1, netAPayerFc: null }, assiettes: { assietteSocialeFc: 1 } };
    const personnel = {
        creerSalarie: jest.fn(async () => ({ id: 'sal-neuf' })),
        creerContrat: jest.fn(async () => ({ id: 'ct-neuf' })),
        simulerPaie: jest.fn(async () => simulation),
        emettreBulletin: jest.fn(async () => ({ id: 'b-neuf' })),
    };
    const rapprochements = {
        ouvrir: jest.fn(async () => ({ id: 'r-neuf', soldeDepartDeclare: null })),
        declarerDepart: jest.fn(async () => ({})),
        pointer: jest.fn(async () => ({})),
    };
    const questionnaires = { creer: jest.fn(async () => ({ id: 'q-neuf' })) };
    const svc = new garnissage_demonstration_service_1.GarnissageDemonstrationService(prisma, tiers, ecritures, immobilisations, personnel, rapprochements, questionnaires);
    return { svc, s, tiers, ecritures, immobilisations, personnel, rapprochements, questionnaires, lignes };
}
const creesComplets = (s) => s.tiers.length + s.operations.length + s.immobilisations.length + 3 + 1 + 1;
describe.each(['SYCEBNL', 'SYSCOHADA'])('garnissage %s', (referentiel) => {
    it('crée les tiers, passe chaque opération par la saisie ordinaire, et valide tout', async () => {
        const m = monde(referentiel);
        const r = await m.svc.garnir('t', 'u');
        expect(r).toEqual({
            tiers: m.s.tiers.length,
            ecritures: m.s.operations.length + m.s.immobilisations.length,
            immobilisations: m.s.immobilisations.length,
            bulletins: 1,
            crees: creesComplets(m.s),
            ecartes: [],
        });
        expect(m.tiers.creer).toHaveBeenCalledTimes(m.s.tiers.length);
        expect(m.ecritures.creer).toHaveBeenCalledTimes(m.s.operations.length);
        const acquisitions = m.s.immobilisations.map((_, i) => `acq${i + 1}`);
        expect(m.ecritures.valider).toHaveBeenCalledWith('t', 'u', [...m.s.operations.map((_, i) => `e${i + 1}`), ...acquisitions]);
    });
    it('le tiers passe par son compte individuel, la trésorerie par le compte du journal de banque', async () => {
        const m = monde(referentiel);
        await m.svc.garnir('t', 'u');
        const appels = m.ecritures.creer.mock.calls.map((c) => c[2]);
        const comptes = appels.flatMap((a) => a.lignes.map((l) => l.compteId));
        expect(comptes).toContain('c-banque');
        for (const t of m.s.tiers)
            expect(comptes).toContain(`c-${t.code}`);
        expect(comptes.some((c) => /^c-4(01|11)[0-9]*0000$/.test(c))).toBe(false);
        expect(appels.every((a) => a.date.startsWith('2026-'))).toBe(true);
        expect(appels.filter((a) => a.journalId === 'j-BQ').length).toBeGreaterThan(0);
    });
    it('LA VALIDATION VIENT EN DERNIER · la console lit son absence pour reprendre une vitrine (F174)', async () => {
        const m = monde(referentiel);
        await m.svc.garnir('t', 'u');
        const derniere = m.ecritures.valider.mock.invocationCallOrder[0];
        const avant = [
            ...m.immobilisations.creer.mock.invocationCallOrder,
            ...m.personnel.creerSalarie.mock.invocationCallOrder,
            ...m.personnel.creerContrat.mock.invocationCallOrder,
            ...m.personnel.emettreBulletin.mock.invocationCallOrder,
            ...m.rapprochements.ouvrir.mock.invocationCallOrder,
            ...m.rapprochements.declarerDepart.mock.invocationCallOrder,
            ...m.rapprochements.pointer.mock.invocationCallOrder,
            ...m.questionnaires.creer.mock.invocationCallOrder,
        ];
        expect(avant.length).toBeGreaterThan(0);
        expect(Math.max(...avant)).toBeLessThan(derniere);
    });
    it('les biens entrent par le module des immobilisations, dans leur famille, payés par la banque du journal BQ', async () => {
        const m = monde(referentiel);
        await m.svc.garnir('t', 'u');
        const appels = m.immobilisations.creer.mock.calls.map((c) => c[2]);
        expect(appels).toHaveLength(m.s.immobilisations.length);
        m.s.immobilisations.forEach((i, k) => {
            expect(appels[k]).toMatchObject({
                familleId: `f-${i.famille}`,
                designation: i.designation,
                dateAcquisition: `2026-${i.jour}`,
                dateMiseEnService: `2026-${i.jour}`,
                valeurOrigine: i.valeur,
                exerciceId: 'ex',
                journalId: 'j-BQ',
                compteContrepartieId: 'c-banque',
            });
            expect(appels[k].repris).toBeUndefined();
        });
    });
    it('le contrat porte sa rémunération ET sa monnaie, et le bulletin est stipulé en francs', async () => {
        const m = monde(referentiel);
        await m.svc.garnir('t', 'u');
        const contrat = m.personnel.creerContrat.mock.calls[0];
        expect(contrat[2]).toBe('sal-neuf');
        expect(contrat[3]).toMatchObject({
            remunerationBase: m.s.salarie.remunerationMensuelleFc,
            deviseRemuneration: 'CDF',
            periodiciteRemuneration: 'MOIS',
            dateEntreeEnVigueur: '2026-01-01',
        });
        const bulletin = m.personnel.emettreBulletin.mock.calls[0];
        expect(bulletin[2]).toBe('sal-neuf');
        expect(bulletin[3]).toMatchObject({ moisDePaie: `2026-${m.s.salarie.moisBulletin}`, deviseStipulation: 'CDF', natureEmployeurInpp: 'PRIVE' });
    });
    it('un bulletin que la simulation ne chiffre pas n’est pas émis, et le motif revient au lieu d’être tu', async () => {
        const m = monde(referentiel, {}, false);
        const r = await m.svc.garnir('t', 'u');
        expect(m.personnel.emettreBulletin).not.toHaveBeenCalled();
        expect(r.bulletins).toBe(0);
        expect(r.ecartes).toHaveLength(1);
        expect(r.ecartes[0]).toMatch(/non émis · Barème de l'impôt inapplicable/);
        expect(m.ecritures.valider).toHaveBeenCalled();
    });
    it('le relevé porte les lignes de banque arrêtées à sa date, son solde en est la somme, et le départ est DÉCLARÉ', async () => {
        const m = monde(referentiel);
        await m.svc.garnir('t', 'u');
        const attendu = (0, scenario_demonstration_1.mouvementsBanque)(m.s)
            .filter((x) => x.jour <= m.s.jourReleve)
            .reduce((a, x) => a + x.montant, 0);
        expect(attendu).toBeGreaterThan(0);
        expect(m.rapprochements.ouvrir).toHaveBeenCalledWith('t', 'u', { compteId: 'c-banque', dateReleve: `2026-${m.s.jourReleve}`, soldeReleve: attendu });
        expect(m.rapprochements.declarerDepart).toHaveBeenCalledWith('t', 'r-neuf', { soldeDepart: 0, dateDepart: '2026-01-01' });
        const pointees = m.rapprochements.pointer.mock.calls[0][2];
        const attenduesIds = m.lignes
            .filter((l) => l.compteId === 'c-banque' && l.date <= `2026-${m.s.jourReleve}`)
            .map((l) => l.id);
        expect([...pointees].sort()).toEqual([...attenduesIds].sort());
        expect(m.lignes.some((l) => l.compteId === 'c-banque' && l.date > `2026-${m.s.jourReleve}`)).toBe(true);
    });
    it('un questionnaire de révision ouvert, sans réponse', async () => {
        const m = monde(referentiel);
        await m.svc.garnir('t', 'u');
        expect(m.questionnaires.creer).toHaveBeenCalledWith('t', 'u', { exerciceId: 'ex', libelle: m.s.questionnaire });
    });
    it('se reprend sans rien recréer · un tiers et une écriture déjà là sont retrouvés (audit final F174)', async () => {
        const vierge = monde(referentiel);
        await vierge.svc.garnir('t', 'u');
        const premiere = vierge.ecritures.creer.mock.calls[0][2];
        const m = monde(referentiel, {
            tiers: [vierge.s.tiers[0].code],
            ecritures: [{ journalId: premiere.journalId, date: premiere.date, libelle: premiere.libelle }],
        });
        const r = await m.svc.garnir('t', 'u');
        expect(m.tiers.creer).toHaveBeenCalledTimes(m.s.tiers.length - 1);
        expect(m.ecritures.creer).toHaveBeenCalledTimes(m.s.operations.length - 1);
        expect(r.crees).toBe(creesComplets(m.s) - 2);
        expect(m.ecritures.valider.mock.calls[0][2][0]).toBe('deja-0');
        const comptes = m.ecritures.creer.mock.calls.flatMap((c) => c[2].lignes.map((l) => l.compteId));
        const tiersRetrouve = m.s.tiers[0].code;
        const utiliseLeTiers = m.s.operations.slice(1).some((o) => o.lignes.some((l) => 'tiers' in l && l.tiers === tiersRetrouve));
        expect(utiliseLeTiers).toBe(true);
        expect(comptes).toContain(`c-${tiersRetrouve}`);
    });
    it('une vitrine qui a déjà tout reçu ne recrée ni bien, ni salarié, ni contrat, ni bulletin, ni rapprochement, ni questionnaire', async () => {
        const m = monde(referentiel, {
            immobilisations: (0, scenario_demonstration_1.scenarioDemonstration)(referentiel).immobilisations.map((i) => i.designation),
            salarie: true,
            contrat: true,
            bulletin: true,
            rapprochement: { soldeDepartDeclare: 0 },
            questionnaire: true,
        });
        const r = await m.svc.garnir('t', 'u');
        expect(m.immobilisations.creer).not.toHaveBeenCalled();
        expect(m.personnel.creerSalarie).not.toHaveBeenCalled();
        expect(m.personnel.creerContrat).not.toHaveBeenCalled();
        expect(m.personnel.simulerPaie).not.toHaveBeenCalled();
        expect(m.personnel.emettreBulletin).not.toHaveBeenCalled();
        expect(m.rapprochements.ouvrir).not.toHaveBeenCalled();
        expect(m.rapprochements.declarerDepart).not.toHaveBeenCalled();
        expect(m.questionnaires.creer).not.toHaveBeenCalled();
        expect(r.crees).toBe(m.s.tiers.length + m.s.operations.length);
        expect(r.bulletins).toBe(1);
        const valides = m.ecritures.valider.mock.calls[0][2];
        for (const i of m.s.immobilisations)
            expect(valides).toContain(`acq-deja-${i.designation}`);
        expect(m.rapprochements.pointer.mock.calls[0][1]).toBe('r-deja');
    });
    it('un rapprochement ouvert sans départ déclaré reçoit son départ à la reprise', async () => {
        const m = monde(referentiel, { rapprochement: { soldeDepartDeclare: null } });
        await m.svc.garnir('t', 'u');
        expect(m.rapprochements.ouvrir).not.toHaveBeenCalled();
        expect(m.rapprochements.declarerDepart).toHaveBeenCalledWith('t', 'r-deja', { soldeDepart: 0, dateDepart: '2026-01-01' });
    });
});
//# sourceMappingURL=garnissage-demonstration.spec.js.map