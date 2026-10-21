"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const date_origine_des_reports_1 = require("./date-origine-des-reports");
const relances_service_1 = require("./relances.service");
const d = (iso) => new Date(`${iso}T00:00:00.000Z`);
const report = (id, debit, libelle, date = '2027-01-01') => ({
    id,
    compteId: 'c1',
    numeroCompte: '41110001',
    debit,
    credit: 0,
    libelle: `RAN détail 41110001 · ${libelle}`,
    date: d(date),
});
const origine = (id, debit, libelle, date, estReport = false) => ({
    id,
    compteId: 'c1',
    numeroCompte: '41110001',
    debit,
    credit: 0,
    libelle,
    date: d(date),
    estReport,
    validee: true,
});
const honoreLeReport = (l, w) => l.exerciceId === w.ecriture.exerciceId &&
    w.compte?.modeReportANouveau === 'DETAIL' &&
    w.compteId.in.includes(l.compteId) &&
    w.OR.some((o) => 'lettre' in o
        ? l.lettre === o.lettre
        : (l.exercicesDuGroupe ?? []).some((ex) => ex !== o.lettrage.lignes.some.ecriture.exerciceId.not));
describe('date d’origine des reports · l’appariement', () => {
    it('rattache le report à la facture de même compte, montant et libellé', () => {
        const r = (0, date_origine_des_reports_1.apparierAuxOrigines)([report('r1', 1_300_000, 'Facture FV-001')], [
            origine('o1', 1_300_000, 'Facture FV-001', '2026-03-01'),
            origine('o2', 400_000, 'Facture FV-002', '2026-05-10'),
        ]);
        expect(r.get('r1')?.date).toEqual(d('2026-03-01'));
    });
    it('des lignes identiques s’apparient dans l’ordre, la plus ancienne pièce d’abord', () => {
        const r = (0, date_origine_des_reports_1.apparierAuxOrigines)([report('r2', 100_000, 'Cotisation'), report('r1', 100_000, 'Cotisation')], [origine('o2', 100_000, 'Cotisation', '2026-06-01'), origine('o1', 100_000, 'Cotisation', '2026-02-01')]);
        expect(r.get('r1')?.date).toEqual(d('2026-02-01'));
        expect(r.get('r2')?.date).toEqual(d('2026-06-01'));
    });
    it('un nombre différent des deux côtés ne rattache rien · aucune date n’est devinée', () => {
        const r = (0, date_origine_des_reports_1.apparierAuxOrigines)([report('r1', 100_000, 'Cotisation')], [
            origine('o1', 100_000, 'Cotisation', '2026-02-01'),
            origine('o2', 100_000, 'Cotisation', '2026-06-01'),
        ]);
        expect(r.size).toBe(0);
    });
    it('un montant différent au centime ne rattache rien', () => {
        expect((0, date_origine_des_reports_1.apparierAuxOrigines)([report('r1', 1_300_000, 'Facture FV-001')], [origine('o1', 1_300_000.01, 'Facture FV-001', '2026-03-01')]).size).toBe(0);
    });
});
describe('date d’origine des reports · la lecture sur plusieurs exercices', () => {
    const exercices = [
        { id: 'e2025', dateDebut: d('2025-01-01'), dateFin: d('2025-12-31') },
        { id: 'e2026', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') },
    ];
    const lignes = [
        { exerciceId: 'e2025', id: 'f25', compteId: 'c1', debit: 500_000, credit: 0, libelle: 'Facture FV-2025-9', lettre: null, date: d('2025-11-20'), report: false },
        { exerciceId: 'e2025', id: 'f25b', compteId: 'c1', debit: 500_000, credit: 0, libelle: 'Facture FV-2025-9', lettre: 'AA', date: d('2025-02-01'), report: false },
        { exerciceId: 'e2026', id: 'r26', compteId: 'c1', debit: 500_000, credit: 0, libelle: 'RAN détail 41110001 · Facture FV-2025-9', lettre: null, date: d('2026-01-01'), report: true },
        { exerciceId: 'e2026', id: 'f26', compteId: 'c1', debit: 1_300_000, credit: 0, libelle: 'Facture FV-001', lettre: null, date: d('2026-03-01'), report: false },
    ];
    const client = {
        exercice: {
            findFirst: async (a) => exercices.filter((e) => e.dateFin < a.where.dateFin.lt).sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0] ?? null,
        },
        ligneEcriture: {
            findMany: async (a) => a.cursor
                ? []
                : lignes
                    .filter((l) => honoreLeReport(l, a.where))
                    .map((l) => ({
                    id: l.id,
                    compteId: l.compteId,
                    debit: l.debit,
                    credit: l.credit,
                    libelle: l.libelle,
                    ecriture: { date: l.date, statut: 'VALIDEE', estGenereeParCloture: l.report, estANouveauProvisoire: false },
                })),
        },
    };
    it('remonte d’exercice en exercice jusqu’à la pièce, et rattache la facture de l’année', async () => {
        const dates = await (0, date_origine_des_reports_1.datesOrigineDesReports)(client, 't1', d('2027-01-01'), [
            { id: 'r27a', compteId: 'c1', numeroCompte: '41110001', debit: 1_300_000, credit: 0, libelle: 'RAN détail 41110001 · Facture FV-001', date: d('2027-01-01') },
            {
                id: 'r27b',
                compteId: 'c1',
                numeroCompte: '41110001',
                debit: 500_000,
                credit: 0,
                libelle: 'RAN détail 41110001 · RAN détail 41110001 · Facture FV-2025-9',
                date: d('2027-01-01'),
            },
        ]);
        expect(dates.get('r27a')).toEqual(d('2026-03-01'));
        expect(dates.get('r27b')).toEqual(d('2025-11-20'));
    });
    it('une ligne sans origine retrouvée n’a pas de date · la relance garde celle de l’écriture', async () => {
        const dates = await (0, date_origine_des_reports_1.datesOrigineDesReports)(client, 't1', d('2027-01-01'), [
            { id: 'r27c', compteId: 'c1', numeroCompte: '41110001', debit: 7_000, credit: 0, libelle: 'RAN détail 41110001 · Inconnue', date: d('2027-01-01') },
        ]);
        expect(dates.has('r27c')).toBe(false);
    });
});
describe('date d’origine des reports · l’échéance et le libellé recopiés (paquet 1, B7)', () => {
    const avecEcheance = (l, echeance) => ({ ...l, dateEcheance: echeance ? d(echeance) : null });
    it('même montant, même libellé · chaque report rejoint l’origine de SON échéance, quel que soit l’ordre des identifiants', () => {
        const r = (0, date_origine_des_reports_1.apparierAuxOrigines)([avecEcheance(report('ra', 600_000, 'Vente marchandises'), '2026-08-31'), avecEcheance(report('rb', 600_000, 'Vente marchandises'), '2026-02-28')], [
            avecEcheance(origine('fev', 600_000, 'Vente marchandises', '2026-02-01'), '2026-02-28'),
            avecEcheance(origine('aou', 600_000, 'Vente marchandises', '2026-08-01'), '2026-08-31'),
        ]);
        expect(r.get('ra')?.id).toBe('aou');
        expect(r.get('rb')?.id).toBe('fev');
    });
    it('un report sans échéance ne prend pas une origine qui en porte une · le report l’aurait recopiée', () => {
        const r = (0, date_origine_des_reports_1.apparierAuxOrigines)([report('r1', 100_000, 'Cotisation')], [
            origine('sans', 100_000, 'Cotisation', '2026-02-01'),
            avecEcheance(origine('avec', 100_000, 'Cotisation', '2026-06-01'), '2026-06-30'),
        ]);
        expect(r.get('r1')?.id).toBe('sans');
    });
    const exercices = [{ id: 'e2026', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }];
    const client = (lignes) => ({
        exercice: {
            findFirst: async (a) => exercices.filter((e) => e.dateFin < a.where.dateFin.lt).sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0] ?? null,
        },
        ligneEcriture: {
            findMany: async (a) => a.cursor
                ? []
                : lignes
                    .filter((l) => honoreLeReport({ exerciceId: 'e2026', compteId: 'c1', lettre: null }, a.where))
                    .map((l) => ({
                    id: l.id,
                    compteId: 'c1',
                    debit: l.debit,
                    credit: 0,
                    libelle: l.libelle,
                    dateEcheance: l.echeance,
                    ecriture: { date: l.date, libelle: l.libelleEcriture, statut: 'VALIDEE', estGenereeParCloture: false, estANouveauProvisoire: false },
                })),
        },
    });
    it('une ligne sans libellé se retrouve par celui de son écriture, que le report a recopié', async () => {
        const { origines, introuvables } = await (0, date_origine_des_reports_1.originesDesReports)(client([{ id: 'f9', debit: 250_000, libelle: null, libelleEcriture: 'Facture FV-009', date: d('2026-04-02'), echeance: d('2026-05-02') }]), 't1', d('2027-01-01'), [avecEcheance(report('r9', 250_000, 'Facture FV-009'), '2026-05-02')]);
        expect(origines.get('r9')).toEqual({ date: d('2026-04-02'), id: 'f9' });
        expect(introuvables).toEqual([]);
    });
    it('une ligne dont l’exercice précédent ne porte aucune origine sûre est rendue introuvable', async () => {
        const { origines, introuvables } = await (0, date_origine_des_reports_1.originesDesReports)(client([{ id: 'f9', debit: 250_000, libelle: 'Facture FV-009', libelleEcriture: 'Pièce', date: d('2026-04-02'), echeance: null }]), 't1', d('2027-01-01'), [report('r-inconnu', 7_000, 'Inconnue')]);
        expect(origines.size).toBe(0);
        expect(introuvables).toEqual(['r-inconnu']);
    });
});
describe('date d’origine des reports · le premier exercice tenu (relecture, M1)', () => {
    const exercices = [{ id: 'e2026', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }];
    const lignes2026 = [
        { id: 'imp', debit: 1_000_000, libelle: null, libelleEcriture: 'Bilan d’ouverture · ouverture.csv', date: d('2026-01-01'), report: true },
        { id: 'f1', debit: 1_000_000, libelle: 'Facture FV-1', libelleEcriture: 'Facture FV-1', date: d('2026-03-01'), report: false },
    ];
    const client = {
        exercice: {
            findFirst: async (a) => exercices.filter((e) => e.dateFin < a.where.dateFin.lt).sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0] ?? null,
        },
        ligneEcriture: {
            findMany: async (a) => a.cursor
                ? []
                : lignes2026
                    .filter(() => honoreLeReport({ exerciceId: 'e2026', compteId: 'c1', lettre: null }, a.where))
                    .map((l) => ({
                    id: l.id,
                    compteId: 'c1',
                    debit: l.debit,
                    credit: 0,
                    libelle: l.libelle,
                    dateEcheance: null,
                    ecriture: { date: l.date, libelle: l.libelleEcriture, statut: 'VALIDEE', estGenereeParCloture: l.report, estANouveauProvisoire: false },
                })),
        },
    };
    it('le report de la ligne importée remonte à elle, et elle EST l’origine, à la date de son écriture', async () => {
        const { origines, introuvables } = await (0, date_origine_des_reports_1.originesDesReports)(client, 't1', d('2027-01-01'), [
            report('r-imp', 1_000_000, 'Bilan d’ouverture · ouverture.csv'),
            report('r-f1', 1_000_000, 'Facture FV-1'),
        ]);
        expect(origines.get('r-imp')).toEqual({ date: d('2026-01-01'), id: 'imp' });
        expect(origines.get('r-f1')).toEqual({ date: d('2026-03-01'), id: 'f1' });
        expect(introuvables).toEqual([]);
    });
    it('dans le premier exercice lui-même, la ligne d’ouverture est sa propre origine', async () => {
        const { origines, introuvables } = await (0, date_origine_des_reports_1.originesDesReports)(client, 't1', d('2026-01-01'), [
            { id: 'imp', compteId: 'c1', numeroCompte: '41110001', debit: 1_000_000, credit: 0, libelle: null, date: d('2026-01-01') },
        ]);
        expect(origines.get('imp')).toEqual({ date: d('2026-01-01'), id: 'imp' });
        expect(introuvables).toEqual([]);
    });
    it('une ligne d’à-nouveau d’un exercice qui A un précédent se cherche dans ce précédent, et introuvable elle est rendue', async () => {
        const { origines, introuvables } = await (0, date_origine_des_reports_1.originesDesReports)(client, 't1', d('2027-01-01'), [report('r-x', 5_000, 'Inconnue')]);
        expect(origines.size).toBe(0);
        expect(introuvables).toEqual(['r-x']);
    });
});
describe('date d’origine des reports · le filtre du report (relecture, mineur 2)', () => {
    const exercices = [{ id: 'e2026', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }];
    const statutRetenu = (statut, f) => f === undefined || (typeof f === 'string' ? statut === f : statut !== f.not);
    const client = (lignes) => ({
        exercice: {
            findFirst: async (a) => exercices.filter((e) => e.dateFin < a.where.dateFin.lt).sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0] ?? null,
        },
        ligneEcriture: {
            findMany: async (a) => a.cursor
                ? []
                : lignes
                    .filter((l) => honoreLeReport(l, a.where) && statutRetenu(l.statut, a.where.ecriture.statut))
                    .map((l) => ({
                    id: l.id,
                    compteId: l.compteId,
                    debit: l.debit,
                    credit: 0,
                    libelle: l.libelle,
                    dateEcheance: null,
                    ecriture: { date: l.date, libelle: l.libelle, statut: l.statut, estGenereeParCloture: false, estANouveauProvisoire: false },
                })),
        },
    });
    const base = (l) => ({
        exerciceId: 'e2026',
        compteId: 'c1',
        lettre: null,
        debit: 1_000_000,
        libelle: 'Facture FV-1',
        date: d('2026-03-01'),
        statut: 'VALIDEE',
        ...l,
    });
    it('une lettre vide et une ligne d’un groupe à cheval sont des candidates, comme au report', async () => {
        const { origines, introuvables } = await (0, date_origine_des_reports_1.originesDesReports)(client([
            base({ id: 'vide', lettre: '' }),
            base({ id: 'cheval', lettre: 'A', libelle: 'Facture FV-2', date: d('2026-09-01'), exercicesDuGroupe: ['e2026', 'e2027'] }),
            base({ id: 'soldee', lettre: 'B', libelle: 'Facture FV-3', exercicesDuGroupe: ['e2026'] }),
        ]), 't1', d('2027-01-01'), [report('r-vide', 1_000_000, 'Facture FV-1'), report('r-cheval', 1_000_000, 'Facture FV-2'), report('r-soldee', 1_000_000, 'Facture FV-3')]);
        expect(origines.get('r-vide')).toEqual({ date: d('2026-03-01'), id: 'vide' });
        expect(origines.get('r-cheval')).toEqual({ date: d('2026-09-01'), id: 'cheval' });
        expect(introuvables).toEqual(['r-soldee']);
    });
    it('le report PROVISOIRE ne prend que le livre-journal · un doublon au brouillard ne lui dispute pas sa pièce', async () => {
        const lignes = [base({ id: 'f' }), base({ id: 'f-bis', date: d('2026-04-02'), statut: 'BROUILLARD' })];
        const provisoire = await (0, date_origine_des_reports_1.originesDesReports)(client(lignes), 't1', d('2027-01-01'), [{ ...report('r', 1_000_000, 'Facture FV-1'), provisoire: true }]);
        expect(provisoire.origines.get('r')).toEqual({ date: d('2026-03-01'), id: 'f' });
        const cloture = await (0, date_origine_des_reports_1.originesDesReports)(client(lignes), 't1', d('2027-01-01'), [report('r', 1_000_000, 'Facture FV-1')]);
        expect(cloture.introuvables).toEqual(['r']);
    });
    it('une SIMULATION ne dispute jamais sa pièce au report · le report ne la porte pas (relecture du premier tour)', async () => {
        const lignes = [base({ id: 'f' }), base({ id: 'f-sim', date: d('2026-04-02'), statut: 'SITUATION' })];
        const cloture = await (0, date_origine_des_reports_1.originesDesReports)(client(lignes), 't1', d('2027-01-01'), [report('r', 1_000_000, 'Facture FV-1')]);
        expect(cloture.origines.get('r')).toEqual({ date: d('2026-03-01'), id: 'f' });
        expect(cloture.introuvables).toEqual([]);
    });
    it('une seule définition · le report et la recherche des origines lisent le même filtre', () => {
        const fs = require('node:fs');
        const path = require('node:path');
        const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
        expect(lire('exercice/exercice.service.ts')).toMatch(/where: lignesReporteesAuDetail\(ecritureLue\),/);
        expect(lire('relances/date-origine-des-reports.ts')).toMatch(/\.\.\.lignesReporteesAuDetail\(\{ tenantId, exerciceId: precedent\.id \}\),/);
    });
});
describe('date d’origine des reports · le branchement dans les relances', () => {
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'relances.service.ts'), 'utf8');
    it('l’échéance de repli, la pièce la plus ancienne et la ligne imprimée lisent la date d’origine', () => {
        expect(src).toMatch(/const datePiece = datesOrigine\.get\(l\.id\) \?\? l\.ecriture\.date;/);
        expect(src).toMatch(/const echeance = l\.dateEcheance \?\? datePiece;/);
        expect(src).toMatch(/piecePlusAncienne\.set\(l\.compte\.id, datePiece\)/);
        expect(src).toMatch(/date: datePiece\.toISOString\(\)\.slice\(0, 10\)/);
    });
});
describe('date d’origine des reports · un report AVEC échéance garde la date de sa pièce (relecture, voisin)', () => {
    const exercices = [
        { id: 'e2026', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') },
        { id: 'e2027', dateDebut: d('2027-01-01'), dateFin: d('2027-12-31') },
    ];
    const tiers = { id: 't-c41', nom: 'C41', type: 'CLIENT', email: null, horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null };
    const compte = { id: 'c1', numero: '41110001', intitule: 'Client C41', tiersCompte: { tiers } };
    const reportLu = {
        id: 'r27',
        compteId: 'c1',
        debit: 1_000_000,
        credit: 0,
        libelle: 'RAN détail 41110001 · Facture FV-VOIS-1',
        dateEcheance: d('2026-03-31'),
        lettre: null,
        lettrageId: null,
        deviseId: null,
        montantDevise: null,
        compte,
        ecriture: { date: d('2027-01-01'), libelle: 'Report à-nouveau', estANouveauProvisoire: false, estGenereeParCloture: true, estSoldeDesComptesDeGestion: false },
    };
    const facture2026 = { exerciceId: 'e2026', compteId: 'c1', lettre: null, id: 'f26', libelle: 'Facture FV-VOIS-1', date: d('2026-03-01') };
    const relanceN = { id: 'rel', compteId: 'c1', dateRelance: d('2026-06-30'), niveauRelance: { niveau: 3 } };
    const prisma = () => ({
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        exercice: {
            findFirst: jest.fn(async (a) => a.where.id
                ? (exercices.find((e) => e.id === a.where.id) ?? null)
                : (exercices.filter((e) => e.dateFin < a.where.dateFin.lt).sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0] ?? null)),
        },
        ligneEcriture: {
            findMany: jest.fn(async (a) => {
                if (a.cursor)
                    return [];
                if ('lettrageId' in a.where)
                    return [];
                if ('compteId' in a.where) {
                    return honoreLeReport(facture2026, a.where)
                        ? [
                            {
                                id: facture2026.id,
                                compteId: 'c1',
                                debit: 1_000_000,
                                credit: 0,
                                libelle: facture2026.libelle,
                                dateEcheance: d('2026-03-31'),
                                ecriture: { date: facture2026.date, libelle: facture2026.libelle, statut: 'VALIDEE', estGenereeParCloture: false, estANouveauProvisoire: false },
                            },
                        ]
                        : [];
                }
                return a.where.ecriture.exerciceId === 'e2027' ? [reportLu] : [];
            }),
            groupBy: jest.fn(async () => []),
        },
        lettrage: { findMany: jest.fn(async () => []) },
        imputationPaiement: { findMany: jest.fn(async () => []) },
        niveauRelance: {
            findMany: jest.fn(async () => [
                { id: 'n3', niveau: 3, joursApresEcheance: 45, type: client_1.TypeRelance.RAPPEL },
                { id: 'n2', niveau: 2, joursApresEcheance: 15, type: client_1.TypeRelance.RAPPEL },
            ]),
        },
        relance: {
            findMany: jest.fn(async (a) => (relanceN.dateRelance >= a.where.dateRelance.gte ? [relanceN] : [])),
        },
    });
    it('la ligne imprime la date de sa pièce, et la mise en demeure de N reste la dernière relance', async () => {
        const [p] = await new relances_service_1.RelancesService(prisma(), {}).positions('t1', {
            exerciceId: 'e2027',
            type: client_1.TypeRelance.RAPPEL,
            dateReference: '2027-02-15',
        });
        expect(p.lignes.map((l) => [l.date, l.echeance])).toEqual([['2026-03-01', '2026-03-31']]);
        expect(p.derniereRelance).toEqual({ niveau: 3, date: '2026-06-30' });
        expect(p.niveauSuggere).toBeNull();
    });
});
//# sourceMappingURL=date-origine-des-reports.spec.js.map