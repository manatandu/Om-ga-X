"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const paires_a_cheval_1 = require("./paires-a-cheval");
const relances_service_1 = require("../relances/relances.service");
const N1 = { id: 'n1', dateDebut: new Date('2027-01-01') };
const codes = { G: 'A', H: 'B' };
function retenue(lignes, l, where) {
    if (!where)
        return true;
    if (where.id?.in && !where.id.in.includes(l.id))
        return false;
    if (where.compteId?.in && !where.compteId.in.includes(l.compteId))
        return false;
    if (typeof where.compteId === 'string' && l.compteId !== where.compteId)
        return false;
    if (where.lettrageId === null && l.lettrageId !== null)
        return false;
    if (where.lettrageId?.not === null && l.lettrageId === null)
        return false;
    if (where.lettrageId?.in && !where.lettrageId.in.includes(l.lettrageId))
        return false;
    if ('lettre' in where && where.lettre === null && l.lettre !== null)
        return false;
    const e = where.ecriture;
    if (e?.tenantId && l.ecriture.tenantId !== e.tenantId)
        return false;
    if (e?.exerciceId && l.ecriture.exerciceId !== e.exerciceId)
        return false;
    if (e?.date?.lt && !(l.ecriture.date < e.date.lt))
        return false;
    if (e?.OR && !e.OR.some((c) => Object.entries(c).every(([k, v]) => (l.ecriture[k] ?? false) === v)))
        return false;
    const c = where.compte;
    if (c?.numero?.startsWith && !l.compte.numero.startsWith(c.numero.startsWith))
        return false;
    if (c?.id?.in && !c.id.in.includes(l.compteId))
        return false;
    if (c?.OR && !c.OR.some((o) => l.compte.numero.startsWith(o.numero.startsWith)))
        return false;
    const anterieure = where.lettrage?.lignes?.some?.ecriture?.date?.lt;
    if (anterieure && !lignes.some((x) => x.lettrageId !== null && x.lettrageId === l.lettrageId && x.ecriture.date < anterieure))
        return false;
    if (where.debit?.gt !== undefined && !(l.debit > where.debit.gt))
        return false;
    if (where.credit?.gt !== undefined && !(l.credit > where.credit.gt))
        return false;
    return true;
}
function lecteur(lignes) {
    return {
        ligneEcriture: {
            findMany: jest.fn(async ({ where, cursor, take }) => {
                const toutes = lignes
                    .filter((l) => retenue(lignes, l, where))
                    .map((l) => ({ ...l, lettrage: l.lettrageId ? { code: codes[l.lettrageId] ?? l.lettrageId } : null }))
                    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
                const depart = cursor ? toutes.findIndex((l) => l.id === cursor.id) + 1 : 0;
                return take ? toutes.slice(depart, depart + take) : toutes.slice(depart);
            }),
        },
    };
}
const compte401 = (mode = 'DETAIL') => ({ id: 'c401', numero: '40110000', intitule: 'NZUZI', modeReportANouveau: mode, tiersCompte: null });
const ecr = (exerciceId, date, enPlus = {}) => ({
    tenantId: 't',
    exerciceId,
    date: new Date(date),
    libelle: 'Facture NZUZI',
    ...enPlus,
});
function ligne(id, debit, credit, usd, ecriture, enPlus = {}) {
    return {
        id,
        compteId: 'c401',
        debit,
        credit,
        deviseId: usd === null ? null : 'usd',
        montantDevise: usd,
        lettrageId: null,
        lettre: null,
        dateEcheance: null,
        libelle: null,
        compte: compte401(),
        ecriture,
        ...enPlus,
    };
}
const CLOTURE = { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false };
const factureN = (enPlus = {}) => ligne('f0', 0, 1_948_800, 1160, ecr('n', '2026-12-15'), { lettrageId: 'G', ...enPlus });
const copieN1 = (enPlus = {}) => ligne('ran', 0, 1_948_800, 1160, ecr('n1', '2027-01-01', { libelle: 'Report à-nouveau', ...CLOTURE }), {
    libelle: 'RAN détail 40110000 · Facture NZUZI',
    ...enPlus,
});
describe('la paire à cheval · au Détail', () => {
    it('le groupe soldé · la ligne d’à-nouveau et le règlement s’éteignent ensemble', async () => {
        const lignes = [factureN(), copieN1(), ligne('p1', 1_948_800, 0, 1160, ecr('n1', '2027-02-10', { libelle: 'Règlement' }), { lettrageId: 'G', lettre: 'A' })];
        const r = await (0, paires_a_cheval_1.pairesACheval)(lecteur(lignes), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '40' } } });
        expect([...r.absorbees].sort()).toEqual(['p1', 'ran']);
        expect(r.groupeDe.get('ran')).toBe('A');
        expect(r.reste.size).toBe(0);
    });
    it('soldé dans sa devise et pas en francs, l’écart non passé · la ligne d’à-nouveau s’éteint quand même (le reste est l’écart, pas une dette)', async () => {
        const lignes = [factureN(), copieN1(), ligne('p1', 2_030_000, 0, 1160, ecr('n1', '2027-02-10'), { lettrageId: 'G' })];
        const r = await (0, paires_a_cheval_1.pairesACheval)(lecteur(lignes), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '40' } } });
        expect(r.absorbees.has('ran')).toBe(true);
        expect(r.reste.has('ran')).toBe(false);
    });
    it('une créance soldée dans sa devise, encaissée au payé (avant A6) · son reste en francs est le réalisé, la ligne d’à-nouveau s’éteint', async () => {
        const client = { compteId: 'c411', compte: { ...compte401(), id: 'c411', numero: '41110000' } };
        const lignes = [
            ligne('f0', 2_800_000, 0, 1000, ecr('n', '2026-12-15'), { ...client, lettrageId: 'G' }),
            ligne('ran', 2_800_000, 0, 1000, ecr('n1', '2027-01-01', CLOTURE), { ...client, libelle: 'RAN détail 41110000 · Facture NZUZI' }),
            ligne('p1', 0, 2_700_000, 1000, ecr('n1', '2027-02-10'), { ...client, lettrageId: 'G' }),
        ];
        const r = await (0, paires_a_cheval_1.pairesACheval)(lecteur(lignes), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '41' } } });
        expect([...r.absorbees].sort()).toEqual(['p1', 'ran']);
        expect(r.reste.size).toBe(0);
    });
    it('le groupe partiel · la ligne d’à-nouveau ne doit plus que son reste, en francs et en devise', async () => {
        const lignes = [factureN(), copieN1(), ligne('p1', 1_008_000, 0, 600, ecr('n1', '2027-02-10'), { lettrageId: 'G' })];
        const r = await (0, paires_a_cheval_1.pairesACheval)(lecteur(lignes), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '40' } } });
        expect([...r.absorbees]).toEqual(['p1']);
        expect(r.reste.get('ran')).toEqual({ francs: -940_800, devise: 560, groupe: 'A' });
    });
    it('deux factures d’un même groupe · le règlement éteint la plus ancienne d’abord, le reste demeure sur la plus récente', async () => {
        const lignes = [
            ligne('fa', 0, 1000, null, ecr('n', '2026-10-01', { libelle: 'Facture 1' }), { lettrageId: 'G' }),
            ligne('fb', 0, 500, null, ecr('n', '2026-11-01', { libelle: 'Facture 2' }), { lettrageId: 'G' }),
            ligne('ra', 0, 1000, null, ecr('n1', '2027-01-01', CLOTURE), { libelle: 'RAN détail 40110000 · Facture 1' }),
            ligne('rb', 0, 500, null, ecr('n1', '2027-01-01', CLOTURE), { libelle: 'RAN détail 40110000 · Facture 2' }),
            ligne('p1', 1200, 0, null, ecr('n1', '2027-02-10'), { lettrageId: 'G' }),
        ];
        const r = await (0, paires_a_cheval_1.pairesACheval)(lecteur(lignes), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '40' } } });
        expect([...r.absorbees].sort()).toEqual(['p1', 'ra']);
        expect(r.reste.get('rb')).toEqual({ francs: -300, devise: null, groupe: 'A' });
    });
    it('un report d’avant la règle 1 (aucune ligne d’à-nouveau pour la facture lettrée) · rien n’est apparié', async () => {
        const lignes = [factureN({ lettre: 'A' }), ligne('p1', 1_948_800, 0, 1160, ecr('n1', '2027-02-10'), { lettrageId: 'G', lettre: 'A' })];
        const r = await (0, paires_a_cheval_1.pairesACheval)(lecteur(lignes), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '40' } } });
        expect(r.absorbees.size + r.reste.size).toBe(0);
    });
    it('une ligne d’à-nouveau déjà lettrée ailleurs, ou d’un autre libellé · pas sa copie, rien n’est apparié', async () => {
        for (const autre of [copieN1({ lettrageId: 'H' }), copieN1({ libelle: 'RAN détail 40110000 · Autre facture' })]) {
            const lignes = [factureN(), autre, ligne('p1', 1_948_800, 0, 1160, ecr('n1', '2027-02-10'), { lettrageId: 'G' })];
            const r = await (0, paires_a_cheval_1.pairesACheval)(lecteur(lignes), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '40' } } });
            expect(r.absorbees.size + r.reste.size).toBe(0);
        }
    });
    it('aucun groupe à cheval · une seule lecture, rien d’autre n’est lu', async () => {
        const l = lecteur([copieN1()]);
        const r = await (0, paires_a_cheval_1.pairesACheval)(l, { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '40' } } });
        expect(r.absorbees.size + r.reste.size).toBe(0);
        expect(l.ligneEcriture.findMany).toHaveBeenCalledTimes(1);
        expect(l.ligneEcriture.findMany.mock.calls[0][0].where).toMatchObject({
            ecriture: { tenantId: 't', exerciceId: 'n1' },
            lettrageId: { not: null },
            lettrage: { lignes: { some: { ecriture: { tenantId: 't', date: { lt: N1.dateDebut } } } } },
        });
    });
});
describe('la paire à cheval · au Solde', () => {
    it('le règlement du groupe se retranche du solde reporté de sa devise, jamais du reste en francs', async () => {
        const auSolde = { compte: compte401('SOLDE') };
        const lignes = [
            factureN(auSolde),
            ligne('ranUsd', 0, 2_956_800, 1760, ecr('n1', '2027-01-01', CLOTURE), { ...auSolde, libelle: 'Report à-nouveau 40110000 · NZUZI · en devise' }),
            ligne('ranFc', 0, 50_000, null, ecr('n1', '2027-01-01', CLOTURE), { ...auSolde, libelle: 'Report à-nouveau 40110000 · NZUZI' }),
            ligne('p1', 1_948_800, 0, 1160, ecr('n1', '2027-02-10'), { ...auSolde, lettrageId: 'G', lettre: 'A' }),
        ];
        const r = await (0, paires_a_cheval_1.pairesACheval)(lecteur(lignes), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '40' } } });
        expect([...r.absorbees]).toEqual(['p1']);
        expect(r.reste.get('ranUsd')).toEqual({ francs: -1_008_000, devise: 600, groupe: 'A' });
        expect(r.reste.has('ranFc')).toBe(false);
    });
});
describe('le reste d’une paire en devise est au coût historique (A6 ter)', () => {
    const client = (mode) => ({ compteId: 'c411', compte: { ...compte401(mode), id: 'c411', numero: '41110000' } });
    it('au Solde · H reste due de 1 400 000 pour 500 USD, pas de 1 500 000', async () => {
        const c = client('SOLDE');
        const lignes = [
            ligne('g0', 2_800_000, 0, 1000, ecr('n', '2026-10-01'), { ...c, lettrageId: 'G' }),
            ligne('ranUsd', 4_200_000, 0, 1500, ecr('n1', '2027-01-01', CLOTURE), { ...c, libelle: 'Report à-nouveau 41110000 · Clients · en devise' }),
            ligne('ranFc', 0, 75_000, null, ecr('n1', '2027-01-01', CLOTURE), { ...c, libelle: 'Report à-nouveau 41110000 · Clients' }),
            ligne('rg', 0, 2_700_000, 1000, ecr('n1', '2027-02-10'), { ...c, lettrageId: 'G' }),
        ];
        const r = await (0, paires_a_cheval_1.pairesACheval)(lecteur(lignes), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '41' } } });
        expect(r.reste.get('ranUsd')).toEqual({ francs: 1_400_000, devise: 500, groupe: 'A' });
        const avecEcart = [...lignes, ligne('ec', 0, 100_000, null, ecr('n1', '2027-02-10'), { ...c, lettrageId: 'G', lettre: 'G' })];
        const r2 = await (0, paires_a_cheval_1.pairesACheval)(lecteur(avecEcart), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '41' } } });
        expect(r2.reste.get('ranUsd')).toEqual({ francs: 1_400_000, devise: 500, groupe: 'A' });
    });
    it('au Détail · 600 USD de G réglés à 2 700 · le reste est 400 USD à 2 800 (1 120 000), pas 1 180 000', async () => {
        const c = client('DETAIL');
        const lignes = [
            ligne('g0', 2_800_000, 0, 1000, ecr('n', '2026-10-01'), { ...c, lettrageId: 'G' }),
            ligne('ran', 2_800_000, 0, 1000, ecr('n1', '2027-01-01', CLOTURE), { ...c, libelle: 'RAN détail 41110000 · Facture NZUZI' }),
            ligne('rg', 0, 1_620_000, 600, ecr('n1', '2027-02-10'), { ...c, lettrageId: 'G' }),
        ];
        const r = await (0, paires_a_cheval_1.pairesACheval)(lecteur(lignes), { tenantId: 't', exercice: N1, compte: { numero: { startsWith: '41' } } });
        expect(r.reste.get('ran')).toEqual({ francs: 1_120_000, devise: 400, groupe: 'A' });
    });
});
describe('les relances lisent la paire (câblage, F4a)', () => {
    it('la créance reportée et encaissée par un groupe à cheval · aucune lettre de rappel', async () => {
        const compte411 = { id: 'c411', numero: '41110000', intitule: 'MBIKAYI', modeReportANouveau: 'DETAIL', tiersCompte: null };
        const surClient = { compteId: 'c411', compte: compte411 };
        const lignes = [
            ligne('f0', 1_948_800, 0, 1160, ecr('n', '2026-12-15'), { ...surClient, lettrageId: 'G' }),
            ligne('ran', 1_948_800, 0, 1160, ecr('n1', '2027-01-01', { libelle: 'Report', ...CLOTURE }), {
                ...surClient,
                libelle: 'RAN détail 41110000 · Facture NZUZI',
            }),
            ligne('p1', 0, 1_948_800, 1160, ecr('n1', '2027-02-10'), { ...surClient, lettrageId: 'G', lettre: 'A' }),
            ligne('k1', 500_000, 0, null, ecr('n1', '2027-03-01', { libelle: 'Facture 2' }), surClient),
        ];
        const l = lecteur(lignes);
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', dateDebut: N1.dateDebut }) },
            ligneEcriture: l.ligneEcriture,
            niveauRelance: { findMany: jest.fn().mockResolvedValue([]) },
            relance: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const svc = new relances_service_1.RelancesService(prisma, { mettreEnFile: jest.fn() });
        const positions = await svc.positions('t', { exerciceId: 'n1', dateReference: '2027-06-30' });
        expect(positions).toHaveLength(1);
        expect(positions[0]).toMatchObject({ numero: '41110000', montantDu: 500_000 });
        expect(positions[0].lignes.map((x) => x.libelle)).toEqual(['Facture 2']);
    });
});
//# sourceMappingURL=paires-a-cheval.spec.js.map