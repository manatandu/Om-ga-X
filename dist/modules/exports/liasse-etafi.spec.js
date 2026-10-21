"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ExcelJS = require("exceljs");
const fs_1 = require("fs");
const etats_financiers_service_1 = require("../etats-financiers/etats-financiers.service");
const etats_financiers_projet_service_1 = require("../etats-financiers/etats-financiers-projet.service");
const etats_financiers_projet_budget_service_1 = require("../etats-financiers/etats-financiers-projet-budget.service");
const engagement_service_1 = require("../analytique/engagement.service");
const etats_financiers_smt_service_1 = require("../etats-financiers/etats-financiers-smt.service");
const note_annexe_service_1 = require("../notes-annexes/note-annexe.service");
const export_service_1 = require("./export.service");
const theme_etafi_1 = require("./theme-etafi");
const presentation_fpm_1 = require("./presentation-fpm");
const relecture_balances_liasse_1 = require("./relecture-balances-liasse");
const correspondance_smt_1 = require("../etats-financiers/correspondance-smt");
jest.setTimeout(30000);
function ligne(numero, classe, reportDebit, reportCredit, mouvementDebit, mouvementCredit) {
    return {
        compteId: `id-${numero}`,
        numero,
        intitule: `Compte ${numero}`,
        classe,
        typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
        reportDebit,
        reportCredit,
        mouvementDebit,
        mouvementCredit,
        clotureDebit: 0,
        clotureCredit: 0,
        totalDebit: reportDebit + mouvementDebit,
        totalCredit: reportCredit + mouvementCredit,
        solde: reportDebit + mouvementDebit - reportCredit - mouvementCredit,
    };
}
const BALANCE_N = [
    ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 800_000, 0, 0),
    ligne('23110000', client_1.ClasseCompte.CLASSE_2, 600_000, 0, 150_000, 0),
    ligne('28310000', client_1.ClasseCompte.CLASSE_2, 0, 100_000, 0, 50_000),
    ligne('40110000', client_1.ClasseCompte.CLASSE_4, 0, 0, 145_000, 190_000),
    ligne('52110000', client_1.ClasseCompte.CLASSE_5, 300_000, 0, 600_000, 415_000),
    ligne('60410000', client_1.ClasseCompte.CLASSE_6, 0, 0, 190_000, 0),
    ligne('66110000', client_1.ClasseCompte.CLASSE_6, 0, 0, 120_000, 0),
    ligne('68110000', client_1.ClasseCompte.CLASSE_6, 0, 0, 50_000, 0),
    ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 400_000),
    ligne('71110000', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 200_000),
];
const BALANCE_N1 = [
    ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 800_000, 0, 0),
    ligne('23110000', client_1.ClasseCompte.CLASSE_2, 600_000, 0, 0, 0),
    ligne('28310000', client_1.ClasseCompte.CLASSE_2, 0, 100_000, 0, 0),
    ligne('52110000', client_1.ClasseCompte.CLASSE_5, 300_000, 0, 0, 0),
];
const BALANCE_PROJET_N = [
    ligne('46210000', client_1.ClasseCompte.CLASSE_4, 0, 0, 0, 400_000),
    ligne('70210000', client_1.ClasseCompte.CLASSE_7, 0, 0, 250_000, 250_000 + 250_000),
    ligne('60410000', client_1.ClasseCompte.CLASSE_6, 0, 0, 180_000, 0),
    ligne('66110000', client_1.ClasseCompte.CLASSE_6, 0, 0, 70_000, 0),
    ligne('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, 400_000, 250_000),
];
const BALANCE_PROJET_N1 = [];
const BALANCE_SMT_N = [
    ligne('57110000', client_1.ClasseCompte.CLASSE_5, 50_000, 0, 300_000, 120_000),
    ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 300_000),
    ligne('60410000', client_1.ClasseCompte.CLASSE_6, 0, 0, 120_000, 0),
    ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 50_000, 0, 0),
];
const TENANT = {
    id: 't1',
    nom: 'ASBL GRACE',
    numeroImpot: 'A1234567B',
    adresse: '12 av. de la Justice',
    ville: 'Kinshasa',
    pays: 'RD Congo',
    jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
    actePersonnaliteJuridique: 'Arrêté n° 087/CAB/MIN/J/2024',
};
const EXERCICES = [
    { id: 'e1', tenantId: 't1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') },
    { id: 'e0', tenantId: 't1', dateDebut: new Date('2025-01-01T00:00:00Z'), dateFin: new Date('2025-12-31T00:00:00Z') },
];
function fabriquerExport(jeu = TENANT.jeuEtatsFinanciersSycebnl, surcharge) {
    const balances = surcharge
        ? surcharge
        : jeu === client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT
            ? { e1: BALANCE_PROJET_N, e0: BALANCE_PROJET_N1 }
            : jeu === client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE
                ? { e1: BALANCE_SMT_N }
                : { e1: BALANCE_N, e0: BALANCE_N1 };
    const ecritureService = {
        balance: jest.fn().mockImplementation((_t, exerciceId) => {
            const lignes = balances[exerciceId] ?? [];
            return Promise.resolve({
                lignes,
                totaux: {
                    debit: lignes.reduce((s, l) => s + l.totalDebit, 0),
                    credit: lignes.reduce((s, l) => s + l.totalCredit, 0),
                },
            });
        }),
        balanceCumulee: jest.fn().mockImplementation((_t, exerciceId) => {
            const borne = EXERCICES.find((e) => e.id === exerciceId);
            const retenus = EXERCICES.filter((e) => borne && e.dateDebut <= borne.dateDebut).map((e) => e.id);
            const parCompte = new Map();
            for (const id of retenus) {
                for (const l of balances[id] ?? []) {
                    const cumul = parCompte.get(l.numero);
                    if (!cumul) {
                        parCompte.set(l.numero, { ...l });
                        continue;
                    }
                    cumul.totalDebit += l.totalDebit;
                    cumul.totalCredit += l.totalCredit;
                    cumul.mouvementDebit += l.mouvementDebit;
                    cumul.mouvementCredit += l.mouvementCredit;
                    cumul.solde = cumul.totalDebit - cumul.totalCredit;
                }
            }
            const lignes = [...parCompte.values()];
            return Promise.resolve({
                lignes,
                totaux: {
                    debit: lignes.reduce((s, l) => s + l.totalDebit, 0),
                    credit: lignes.reduce((s, l) => s + l.totalCredit, 0),
                },
            });
        }),
        virementsDeMiseEnService: jest.fn().mockResolvedValue(new Map()),
        mouvementsDeCoutsEmpruntIncorpores: jest.fn().mockResolvedValue(new Map()),
        mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
    };
    const exerciceService = {
        lister: jest.fn().mockResolvedValue([...EXERCICES]),
    };
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ ...TENANT, jeuEtatsFinanciersSycebnl: jeu }) },
        exercice: {
            findFirstOrThrow: jest
                .fn()
                .mockImplementation(({ where }) => Promise.resolve(EXERCICES.find((e) => e.id === where.id))),
            findFirst: jest.fn().mockImplementation(({ where }) => {
                if (where?.id !== undefined) {
                    return Promise.resolve(EXERCICES.find((e) => e.id === where.id && e.tenantId === where.tenantId) ?? null);
                }
                if (where?.dateDebut?.lt) {
                    const avant = EXERCICES.filter((e) => e.dateDebut < where.dateDebut.lt);
                    avant.sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime());
                    return Promise.resolve(avant[0] ?? null);
                }
                return Promise.resolve(EXERCICES[0]);
            }),
        },
        rattachementNote: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        provisionRisqueCharge: { findMany: jest.fn().mockResolvedValue([]) },
        saisieNote: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        bailleur: { findMany: jest.fn().mockResolvedValue([]) },
        planAnalytique: { findFirst: jest.fn().mockResolvedValue(null) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        campagneInventaire: { findFirst: jest.fn().mockResolvedValue(null) },
        tiersCompte: { findMany: jest.fn().mockResolvedValue([]) },
        engagementDepense: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const etatsFinanciers = new etats_financiers_service_1.EtatsFinanciersService(ecritureService, exerciceService);
    const etatsProjet = new etats_financiers_projet_service_1.EtatsFinanciersProjetService(ecritureService, exerciceService, prisma);
    const budgetProjet = new etats_financiers_projet_budget_service_1.EtatsFinanciersProjetBudgetService(ecritureService, prisma, new engagement_service_1.EngagementService(prisma));
    const etatsSmt = new etats_financiers_smt_service_1.EtatsFinanciersSmtService(ecritureService, exerciceService, prisma);
    const notes = new note_annexe_service_1.NoteAnnexeService(ecritureService, exerciceService, prisma, budgetProjet, etatsFinanciers);
    return new export_service_1.ExportService(prisma, ecritureService, etatsFinanciers, etatsProjet, etatsSmt, budgetProjet, notes, {}, {}, {});
}
function rangDeRecon(ws, rep) {
    let rang = 0;
    ws.eachRow((row, n) => {
        if (row.getCell(2).value === rep)
            rang = n;
    });
    return rang;
}
async function ouvrir(buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb;
}
const fondDe = (cell) => {
    const f = cell.fill;
    return f?.fgColor?.argb ?? '';
};
describe('exports individuels · charte ETAFI, état seul en valeurs', () => {
    it('le bilan tient sur Bilan-Actif et Bilan-Passif, cartouche et palette du modèle', async () => {
        const exportService = fabriquerExport();
        const { buffer } = await exportService.bilanExcel('t1', 'e1');
        const wb = await ouvrir(buffer);
        expect(wb.worksheets.map((w) => w.name)).toEqual(['Bilan-Actif', 'Bilan-Passif']);
        const actif = wb.getWorksheet('Bilan-Actif');
        expect(actif.getCell('A3').value).toBe('Dénomination sociale : ASBL GRACE');
        expect(String(actif.getCell('A5').value)).toContain("N° d'identification fiscale (NIF) : A1234567B");
        expect(actif.getCell('A1').value).toBe('- 1 -');
        expect(actif.getCell('B7').value).toBe('BILAN');
        expect(actif.getCell('B7').font?.name).toBe('Arial Black');
        expect(actif.getCell('B7').font?.color?.argb).toBe('FF008000');
        expect(actif.getCell('A8').value).toBe('REF');
        expect(fondDe(actif.getCell('A8'))).toBe('FFCCFFFF');
        expect(actif.getCell('D9').value).toBe('BRUT');
        let rangBz = 0;
        actif.eachRow((row, n) => {
            if (row.getCell(1).value === 'BZ')
                rangBz = n;
        });
        expect(rangBz).toBeGreaterThan(9);
        expect(fondDe(actif.getCell(rangBz, 2))).toBe('FF000080');
        const bz = actif.getCell(rangBz, 6).value;
        expect(bz.formula).toContain('F');
        expect(fondDe(actif.getCell(rangBz, 1))).toBe('');
    });
    it('le compte de résultat suit ses conventions officielles · XC = XA - XB en formule', async () => {
        const exportService = fabriquerExport();
        const { buffer } = await exportService.compteDeResultatExcel('t1', 'e1');
        const wb = await ouvrir(buffer);
        const ws = wb.getWorksheet('Résultat');
        const rangs = new Map();
        ws.eachRow((row, n) => {
            const ref = row.getCell(1).value;
            if (typeof ref === 'string')
                rangs.set(ref, n);
        });
        const xc = ws.getCell(rangs.get('XC'), 4).value;
        expect(xc.formula).toBe(`D${rangs.get('XA')}-D${rangs.get('XB')}`);
        expect(ws.getCell(rangs.get('RA'), 4).value).toBe(400_000);
    });
    it('le TFT porte les six colonnes du modèle officiel, Note comprise et vide (passe R6)', async () => {
        const exportService = fabriquerExport();
        const { buffer } = await exportService.tableauFluxTresorerieExcel('t1', 'e1');
        const ws = (await ouvrir(buffer)).getWorksheet('TFT');
        expect([1, 2, 3, 4, 5, 6].map((c) => ws.getCell(8, c).value)).toEqual([
            'REF',
            'LIBELLES',
            'Rep.',
            'Note',
            'EXERCICE N',
            'EXERCICE N-1',
        ]);
        ws.eachRow((row, n) => {
            if (n > 8 && typeof row.getCell(1).value === 'string' && row.getCell(1).value !== '') {
                expect({ ref: row.getCell(1).value, note: row.getCell(4).value ?? null }).toEqual({ ref: row.getCell(1).value, note: null });
            }
        });
    });
    it('le TFT porte les bandes de sections et la ligne clef ZG sur bleu 003366', async () => {
        const exportService = fabriquerExport();
        const { buffer } = await exportService.tableauFluxTresorerieExcel('t1', 'e1');
        const ws = (await ouvrir(buffer)).getWorksheet('TFT');
        let rangZg = 0;
        let bandes = 0;
        ws.eachRow((row, n) => {
            if (row.getCell(1).value === 'ZG')
                rangZg = n;
            if (fondDe(row.getCell(2)) === 'FFC0C0C0' && row.getCell(1).value == null)
                bandes += 1;
        });
        expect(rangZg).toBeGreaterThan(8);
        expect(fondDe(ws.getCell(rangZg, 2))).toBe('FF003366');
        expect(bandes).toBeGreaterThanOrEqual(4);
    });
});
describe('Paquet 1, A7 · TFT des associations · les postes vides au classeur', () => {
    const MOTIF = "Le premier jour de l'exercice porte une position de bilan passée en opérations diverses (OD n° 1)";
    const MOTIF_N1 = "L'exercice précédent est ouvert sans aucune écriture au livre-journal";
    const avecVides = (exportService) => {
        const etats = exportService.etatsFinanciersService;
        const reel = etats.tableauFluxTresorerie.bind(etats);
        jest.spyOn(etats, 'tableauFluxTresorerie').mockImplementation(async (t, e) => {
            const tft = await reel(t, e);
            return {
                ...tft,
                postesVides: ['ZA', 'FM', 'ZD', 'ZF', 'ZG'],
                postesNonCalculables: [{ ref: 'FM', raison: MOTIF, aLever: true }],
                postesNonCalculablesN1: [
                    { ref: 'ZA', raison: MOTIF_N1, aLever: true },
                    { ref: 'FA', raison: MOTIF_N1, aLever: true },
                    { ref: 'FM', raison: MOTIF_N1, aLever: true },
                ],
            };
        });
        return exportService;
    };
    const rangDe = (ws, ref) => {
        let rang = 0;
        ws.eachRow((row, n) => {
            if (n > 8 && row.getCell(1).value === ref)
                rang = n;
        });
        return rang;
    };
    it('la cellule N d’un poste vide reste vide, les autres portent leur montant', async () => {
        const { buffer } = await avecVides(fabriquerExport()).tableauFluxTresorerieExcel('t1', 'e1');
        const ws = (await ouvrir(buffer)).getWorksheet('TFT');
        expect(ws.getCell(rangDe(ws, 'FM'), 5).value ?? null).toBeNull();
        expect(ws.getCell(rangDe(ws, 'ZA'), 5).value ?? null).toBeNull();
        expect(typeof ws.getCell(rangDe(ws, 'FA'), 5).value).toBe('number');
    });
    it('l’export du seul tableau écrit le motif des postes vides sous l’état, colonne N et colonne N-1', async () => {
        const { buffer } = await avecVides(fabriquerExport()).tableauFluxTresorerieExcel('t1', 'e1');
        const wb = await ouvrir(buffer);
        expect(wb.getWorksheet('ANOMALIES')).toBeUndefined();
        const textes = [];
        wb.getWorksheet('TFT').eachRow((row) => row.eachCell((c) => textes.push(String(c.value ?? ''))));
        expect(textes).toContain(`Exercice N · FM · ${MOTIF}`);
        expect(textes).toContain(`Exercice N-1 · ZA, FA, FM · ${MOTIF_N1}`);
        expect(textes.some((t) => /feuille ANOMALIES/.test(t))).toBe(false);
    });
    it('la feuille ANOMALIES dit le motif, colonne N et colonne N-1, une ligne par motif, « à vérifier » quand il nomme un geste', async () => {
        const { buffer } = await avecVides(fabriquerExport()).liasseCompleteExcel('t1', 'e1');
        const an = (await ouvrir(buffer)).getWorksheet('ANOMALIES');
        const lignes = [];
        an.eachRow((row) => lignes.push([1, 2, 3, 4, 5].map((c) => String(row.getCell(c).value ?? ''))));
        expect(lignes.find((l) => l[1] === 'FM' && l[2] === 'Tableau des flux de trésorerie')?.slice(0, 4)).toEqual([
            'A_VERIFIER', 'FM', 'Tableau des flux de trésorerie', MOTIF,
        ]);
        expect(lignes.filter((l) => l[2] === 'Tableau des flux · colonne N-1').map((l) => l.slice(0, 4))).toEqual([
            ['A_VERIFIER', 'ZA, FA, FM', 'Tableau des flux · colonne N-1', MOTIF_N1],
        ]);
        const auMotif = lignes.filter((l) => l[3] === MOTIF || l[3] === MOTIF_N1);
        expect(auMotif.every((l) => l[4].startsWith('Suivre l’issue que le motif nomme'))).toBe(true);
        expect(lignes.filter((l) => /^Aucune action si la provenance est la bonne/.test(l[4]))).toEqual([]);
    });
    it('relecture m3 · un motif qui ne nomme aucun geste reste une information, sans action', async () => {
        const exportService = fabriquerExport();
        const etats = exportService.etatsFinanciersService;
        const reel = etats.tableauFluxTresorerie.bind(etats);
        jest.spyOn(etats, 'tableauFluxTresorerie').mockImplementation(async (t, e) => ({
            ...(await reel(t, e)),
            postesNonCalculablesN1: [{ ref: 'ZA', raison: MOTIF_N1, aLever: false }],
        }));
        const { buffer } = await exportService.liasseCompleteExcel('t1', 'e1');
        const lignes = [];
        (await ouvrir(buffer)).getWorksheet('ANOMALIES').eachRow((row) => lignes.push([1, 2, 3, 4, 5].map((c) => String(row.getCell(c).value ?? ''))));
        expect(lignes.filter((l) => l[2] === 'Tableau des flux · colonne N-1')).toEqual([
            ['INFO', 'ZA', 'Tableau des flux · colonne N-1', MOTIF_N1, 'Aucune action : la cellule N-1 reste vide, elle n’est pas un zéro.'],
        ]);
    });
    const MOTIF_CONTROLE = 'Contrôle non effectué · la trésorerie d’ouverture (ZA) est laissée vide.';
    const nonControlable = (exportService) => {
        const etats = exportService.etatsFinanciersService;
        const reel = etats.tableauFluxTresorerie.bind(etats);
        jest.spyOn(etats, 'tableauFluxTresorerie').mockImplementation(async (t, e) => {
            const tft = await reel(t, e);
            return {
                ...tft,
                postesVides: ['ZA', 'FM', 'ZD', 'ZF', 'ZG'],
                postesNonCalculables: [{ ref: 'FM', raison: MOTIF, aLever: true }],
                controle: {
                    ...tft.controle,
                    tresorerieOuverture: null,
                    variation: null,
                    tresorerieClotureParFlux: null,
                    ecart: null,
                    coherent: null,
                    motifNonControlable: MOTIF_CONTROLE,
                },
            };
        });
        return exportService;
    };
    it('contrôle non effectué · aucune anomalie « à traiter » sur ZG, le motif dit en information', async () => {
        const { buffer } = await nonControlable(fabriquerExport()).liasseCompleteExcel('t1', 'e1');
        const an = (await ouvrir(buffer)).getWorksheet('ANOMALIES');
        const lignes = [];
        an.eachRow((row) => lignes.push([1, 2, 3, 4].map((c) => String(row.getCell(c).value ?? ''))));
        expect(lignes.filter((l) => l[0] === 'A_TRAITER' && l[1] === 'ZG')).toEqual([]);
        expect(lignes).toContainEqual(['INFO', 'ZG', 'Tableau des flux de trésorerie', MOTIF_CONTROLE]);
    });
    it('contrôle non effectué · CONTROLES ne lit pas la cellule vide de ZG et ne juge aucune ligne du tableau à zéro', async () => {
        const { buffer } = await nonControlable(fabriquerExport()).liasseCompleteExcel('t1', 'e1');
        const ctl = (await ouvrir(buffer)).getWorksheet('CONTROLES');
        const lignesTft = [];
        ctl.eachRow((row, n) => {
            const intitule = String(row.getCell(1).value ?? '');
            if (n > 1 && /TFT/.test(intitule))
                lignesTft.push({ intitule, valeur: row.getCell(2).value, attendu: row.getCell(3).value });
        });
        expect(lignesTft.length).toBe(2);
        for (const l of lignesTft) {
            expect(l.attendu).toBe('');
            expect(typeof l.valeur).toBe('string');
        }
    });
    it('contrôle non effectué · l’export du seul tableau dit le motif, jamais un écart de bouclage', async () => {
        const { buffer } = await nonControlable(fabriquerExport()).tableauFluxTresorerieExcel('t1', 'e1');
        const textes = [];
        (await ouvrir(buffer)).getWorksheet('TFT').eachRow((row) => row.eachCell((c) => textes.push(String(c.value ?? ''))));
        expect(textes).toContain(MOTIF_CONTROLE);
        expect(textes.some((t) => /écart de bouclage/i.test(t))).toBe(false);
    });
});
describe('liasse complète · le classeur entier du modèle', () => {
    it('reproduit les feuilles du modèle, dans son ordre, et boucle', async () => {
        const exportService = fabriquerExport();
        const { buffer, nomFichier } = await exportService.liasseCompleteExcel('t1', 'e1');
        expect(nomFichier).toBe('liasse-complete-2026.xlsx');
        const wb = await ouvrir(buffer);
        const noms = wb.worksheets.map((w) => w.name);
        expect(noms.slice(0, 13)).toEqual([
            'BALANCE N',
            'BALANCE N-1',
            'CONTROLE BALANCE',
            'Couverture',
            'Garde',
            'Fiche 1',
            'Fiche 2',
            'Bilan paysage',
            'Bilan-Actif',
            'Bilan-Passif',
            'Résultat',
            'TFT',
            'NOTES ANNEXES',
        ]);
        expect(noms.slice(-3)).toEqual(['TABLE COMMENTAIRE', 'CONTROLES', 'ANOMALIES']);
        const feuillesNotes = noms.slice(13, -3);
        for (const nom of feuillesNotes)
            expect(nom).toMatch(/^NOTE /);
        expect(new Set(feuillesNotes).size).toBe(feuillesNotes.length);
        const ORDRE = ['1', '2', '3', '4', '5A', '5B', '5C', '5D', '5E', '5F', '5G', '5H', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17A', '17B', '18A', '18B', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29A', '29B', '30', '31', '32', '33', '34', '35'];
        expect(feuillesNotes).toEqual(ORDRE.map((c) => `NOTE ${c}`));
        const texteFeuille = (nom) => {
            const t = [];
            wb.getWorksheet(nom).eachRow((row) => row.eachCell((c) => t.push(String(c.value ?? ''))));
            return t;
        };
        expect(texteFeuille('NOTE 8')).toContain('NEANT');
        expect(texteFeuille('NOTE 13')).not.toContain('NEANT');
        expect(texteFeuille('NOTE 4')).toContain('NEANT');
        expect(texteFeuille('NOTE 2')).not.toContain('NEANT');
        expect(texteFeuille('NOTE 2')).toContain('A - IDENTITE, ORGANISATION');
        const numeros = (l) => l.map((x) => x.numero);
        expect((0, relecture_balances_liasse_1.defautsDeFeuilleBalance)(wb, theme_etafi_1.NOM_BALANCE, numeros(BALANCE_N), 'Mouvements au 31/12/25', presentation_fpm_1.FOND_ENTETE_FPM)).toEqual([]);
        expect((0, relecture_balances_liasse_1.defautsDeFeuilleBalance)(wb, theme_etafi_1.NOM_BALANCE_N1, numeros(BALANCE_N1), 'Mouvements au 31/12/24', presentation_fpm_1.FOND_ENTETE_FPM)).toEqual([]);
        const paysage = wb.getWorksheet('Bilan paysage');
        const lien = paysage.getCell(10, 4).value;
        expect(lien.formula).toBe("'Bilan-Actif'!D10");
        const fiche1 = wb.getWorksheet('Fiche 1');
        let zeValeur = '';
        fiche1.eachRow((row) => {
            if (row.getCell(1).value === 'ZE')
                zeValeur = String(row.getCell(7).value ?? '');
        });
        expect(zeValeur).toBe('Arrêté n° 087/CAB/MIN/J/2024');
        const garde = wb.getWorksheet('Garde');
        expect(String(garde.getCell(12, 2).value)).toContain('SYCEBNL');
        expect(String(garde.getCell(32, 2).value)).toBe('SYSTEME NORMAL');
        const ctl = wb.getWorksheet('CONTROLES');
        expect(ctl.getCell(2, 2).value.formula).toMatch(/^SUM\('BALANCE N'!G10:G\d+\)$/);
        const tftLiasse = wb.getWorksheet('TFT');
        let rangZgLiasse = 0;
        tftLiasse.eachRow((row, n) => {
            if (row.getCell(1).value === 'ZG')
                rangZgLiasse = n;
        });
        let formuleZg = '';
        ctl.eachRow((row) => {
            if (String(row.getCell(1).value).includes('(TFT, ZG)'))
                formuleZg = row.getCell(2).value.formula ?? '';
        });
        expect(formuleZg).toBe(`TFT!E${rangZgLiasse}`);
        expect(wb.getWorksheet('Fiche 1').getCell('A1').value).toMatch(/^- \d+ -$/);
        if (process.env.LIASSE_DEBUG_SORTIE)
            (0, fs_1.writeFileSync)(process.env.LIASSE_DEBUG_SORTIE, buffer);
    });
});
describe('liasse complète · jeu projets de développement', () => {
    it('une panne du tableau budgétaire fait tomber la liasse, sans grille vierge sous un motif faux (audit final F83)', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT);
        exportService
            .etatsFinanciersProjetBudgetService.executionBudgetaire = jest
            .fn()
            .mockRejectedValueOnce(new etats_financiers_projet_budget_service_1.AucunPlanABudgetsException('Aucun plan analytique à budgets.'))
            .mockRejectedValue(new Error('connexion perdue'));
        await expect(exportService.liasseCompleteExcel('t1', 'e1')).rejects.toThrow('connexion perdue');
    });
    it('la feuille NOTE 9 porte les montants de la note du bailleur, dans l’orientation de la maquette (passe R6, D13)', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT);
        const projet = exportService
            .etatsFinanciersProjetService;
        const m = (decaisse, consomme) => ({ decaisse, consomme, soldeRestant: decaisse - consomme });
        projet.noteBailleur = jest.fn().mockResolvedValue({
            investissement: [{ bailleur: { id: 'b1', code: 'UE', nom: 'Union' }, ...m(900, 300) }],
            investissementNonAffecte: m(0, 0),
            totalInvestissement: m(900, 300),
            administration: [{ bailleur: { id: 'b1', code: 'UE', nom: 'Union' }, ...m(200, 150) }],
            administrationNonAffecte: m(0, 0),
            totalAdministration: m(200, 150),
            totalFondsDuBailleur: m(1100, 450),
        });
        const wb = await ouvrir((await exportService.liasseCompleteExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('NOTE 9');
        const valeurs = {};
        ws.eachRow((row) => {
            const libelle = row.getCell(1).value;
            if (typeof libelle === 'string')
                valeurs[libelle] = [2, 3, 4, 5, 6, 7].map((c) => row.getCell(c).value);
        });
        expect(ws.getCell(8, 2).value).toBe('UE · Union');
        expect(ws.getCell(8, 5).value).toBe('TOTAL');
        expect(valeurs["TOTAL FONDS D'INVESTISSEMENT"]).toEqual([900, 300, 600, 900, 300, 600]);
        expect(valeurs["TOTAL FONDS D'ADMINISTRATION"]).toEqual([200, 150, 50, 200, 150, 50]);
        expect(valeurs['TOTAL DES FONDS DU BAILLEUR']).toEqual([1100, 450, 650, 1100, 450, 650]);
    });
    it('GR additionne CHAQUE ligne FA et FB, dans les trois colonnes (passe R6, D9)', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT);
        const projet = exportService
            .etatsFinanciersProjetService;
        const reel = projet.tableauEmploisRessources.bind(projet);
        projet.tableauEmploisRessources = (async (t, e) => {
            const er = await reel(t, e);
            const fa = er.lignes.findIndex((l) => l.ref === 'FA');
            const fb = (nom) => ({ ...er.lignes[fa], cle: `BAILLEUR:${nom}`, ref: 'FB', libelle: `Fonds reçus, Bailleur ${nom}` });
            er.lignes.splice(fa + 1, 0, fb('Beta'), fb('Gamma'));
            return er;
        });
        const wb = await ouvrir((await exportService.liasseCompleteExcel('t1', 'e1')).buffer);
        const er = wb.getWorksheet('Emplois-Ressources');
        const rangsDe = (ref) => {
            const rangs = [];
            er.eachRow((row, n) => {
                if (row.getCell(1).value === ref)
                    rangs.push(n);
            });
            return rangs;
        };
        const [fa] = rangsDe('FA');
        const fbs = rangsDe('FB');
        const [fc] = rangsDe('FC');
        const [fd] = rangsDe('FD');
        const [gr] = rangsDe('GR');
        expect(fbs).toHaveLength(2);
        for (const lettre of ['C', 'D', 'E']) {
            expect(er.getCell(gr, lettre.charCodeAt(0) - 64).value.formula).toBe(`${lettre}${fa}+(${fbs.map((n) => `${lettre}${n}`).join('+')})+${lettre}${fc}+${lettre}${fd}`);
        }
    });
    it('reproduit le classeur du modèle projets, grille budgétaire vierge comprise', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT);
        const { buffer } = await exportService.liasseCompleteExcel('t1', 'e1');
        const wb = await ouvrir(buffer);
        const noms = wb.worksheets.map((w) => w.name);
        expect(noms.slice(0, 14)).toEqual([
            'BALANCE N',
            'BALANCE N-1',
            'CONTROLE BALANCE',
            'Couverture',
            'Garde',
            'Fiche 1',
            'Fiche 2',
            'Emplois-Ressources',
            'Execution budgetaire',
            'Reconciliation tresorerie',
            'Bilan paysage',
            'Bilan-Actif',
            'Bilan-Passif',
            'Compte Exploitation',
        ]);
        expect(noms.slice(-3)).toEqual(['TABLE COMMENTAIRE', 'CONTROLES', 'ANOMALIES']);
        expect(noms).toContain('NOTES ANNEXES');
        const ORDRE_PROJETS = ['1', '2', '3A', '3B', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20A', '20B', '21', '22', '23', '24'];
        const notesProjets = noms.filter((n) => n.startsWith('NOTE '));
        expect(notesProjets).toEqual(ORDRE_PROJETS.map((c) => `NOTE ${c}`));
        const er = wb.getWorksheet('Emplois-Ressources');
        let rangGr = 0;
        let rangFa = 0;
        er.eachRow((row, n) => {
            if (row.getCell(1).value === 'GR')
                rangGr = n;
            if (row.getCell(1).value === 'FA')
                rangFa = n;
        });
        expect(er.getCell(rangGr, 4).value.formula).toContain(`D${rangFa}`);
        expect(er.getCell(rangFa, 5).value.formula).toBe(`C${rangFa}+D${rangFa}`);
        expect(typeof er.getCell(rangFa, 3).value).toBe('number');
        let rangFx = 0;
        er.eachRow((row, n) => {
            if (row.getCell(1).value === 'FX')
                rangFx = n;
        });
        expect(typeof er.getCell(rangFx, 5).value).toBe('number');
        const recon = wb.getWorksheet('Reconciliation tresorerie');
        let rangB = 0;
        recon.eachRow((row, n) => {
            if (row.getCell(2).value === 'B')
                rangB = n;
        });
        const reconServeur = await exportService.etatsFinanciersProjetBudgetService.reconciliationTresorerie('t1', 'e1', null);
        const valeurServeur = (rep) => reconServeur.lignes.find((l) => l.rep === rep).montant;
        expect(['B', 'C', 'D', 'F'].map((rep) => recon.getCell(rangDeRecon(recon, rep), 3).value)).toEqual(['B', 'C', 'D', 'F'].map(valeurServeur));
        const rangDe = (rep) => {
            let n0 = 0;
            recon.eachRow((row, n) => {
                if (row.getCell(2).value === rep)
                    n0 = n;
            });
            return n0;
        };
        expect([recon.getCell(rangDe('H'), 3).value, typeof recon.getCell(rangDe('I'), 3).value === 'object']).toEqual([
            'non renseigné',
            false,
        ]);
        const eb = wb.getWorksheet('Execution budgetaire');
        expect(eb.getCell(9, 6).value.formula).toBe('D9+E9');
        let rangTotalEb = 0;
        eb.eachRow((row, n) => {
            if (row.getCell(2).value === 'TOTAL')
                rangTotalEb = n;
        });
        expect(eb.getCell(rangTotalEb, 3).value.formula).toMatch(/^SUM\(C\d+:C\d+\)$/);
        for (const nom of ['Bilan-Actif', 'Bilan-Passif']) {
            const b = wb.getWorksheet(nom);
            expect([b.getCell(7, 2).value, b.getCell(8, 4).value, b.getCell(8, 5).value, b.getCell(9, 4).value]).toEqual([
                'BILAN',
                'EXERCICE AU 31/12/N',
                'EXERCICE AU 31/12/N-1',
                '',
            ]);
        }
        const ce = wb.getWorksheet('Compte Exploitation');
        const refs = [];
        const rangsCe = new Map();
        ce.eachRow((row, n) => {
            const ref = row.getCell(1).value;
            if (typeof ref === 'string') {
                refs.push(ref);
                if (!rangsCe.has(ref))
                    rangsCe.set(ref, n);
            }
        });
        expect(refs.filter((x) => x === 'TJ')).toHaveLength(2);
        let rangXa = 0;
        let rangXb = 0;
        let rangXc = 0;
        ce.eachRow((row, n) => {
            if (row.getCell(1).value === 'XA')
                rangXa = n;
            if (row.getCell(1).value === 'XB')
                rangXb = n;
            if (row.getCell(1).value === 'XC')
                rangXc = n;
        });
        expect(ce.getCell(rangXc, 4).value.formula).toBe(`D${rangXa}-D${rangXb}`);
        const lignesCharges = [];
        ce.eachRow((row, n) => {
            if (n > rangXa && n < rangXb)
                lignesCharges.push(n);
        });
        expect(lignesCharges).toHaveLength(12);
        const rangProduitsHao = lignesCharges.find((n) => ce.getCell(n, 2).value === 'Produits H.A.O.');
        const attenduXb = lignesCharges
            .map((n, i) => `${i === 0 ? '' : n === rangProduitsHao ? '-' : '+'}D${n}`)
            .join('');
        expect(ce.getCell(rangXb, 4).value.formula).toBe(attenduXb);
        const noteDe = (libelle) => ce.getCell(lignesCharges.find((n) => ce.getCell(n, 2).value === libelle), 3).value;
        expect(['Charges de personnel', 'Frais financiers et charges assimilées', 'Dotations aux provisions', 'Produits H.A.O.'].map(noteDe)).toEqual(['20A', '21', '22', '23']);
        expect([ce.getCell(rangXa, 2).value, ce.getCell(rangXb, 2).value, ce.getCell(rangXc, 2).value]).toEqual([
            'REVENUS (Somme RA à RE)',
            'CHARGES DE FONCTIONNEMENT (Somme TA à TL)',
            "SOLDE DES OPERATIONS DE L'EXERCICE : XA-XB",
        ]);
        expect(ce.getCell(rangsCe.get('RA'), 3).value).toBe('9');
    });
});
const BALANCE_PROJET_INTERETS = [
    ligne('46210000', client_1.ClasseCompte.CLASSE_4, 0, 0, 250_000, 400_000),
    ligne('70210000', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 250_000),
    ligne('60410000', client_1.ClasseCompte.CLASSE_6, 0, 0, 180_000, 0),
    ligne('66110000', client_1.ClasseCompte.CLASSE_6, 0, 0, 70_000, 0),
    ligne('77470000', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 120_000),
    ligne('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, 520_000, 250_000),
];
describe('Paquet 1, A9 · la feuille CONTROLES de la liasse projet ne tient pas XC à zéro', () => {
    const lignesControles = (wb) => {
        const ws = wb.getWorksheet('CONTROLES');
        const lignes = [];
        ws.eachRow((row, rang) => {
            if (rang === 1)
                return;
            const v = row.getCell(2).value;
            lignes.push({
                rang,
                intitule: String(row.getCell(1).value ?? ''),
                formule: v && typeof v === 'object' && 'formula' in v ? v.formula : undefined,
                valeur: v,
                attendu: row.getCell(3).value,
            });
        });
        return lignes;
    };
    const rangDeRef = (ws, ref) => {
        let rang = 0;
        ws.eachRow((row, n) => {
            if (row.getCell(1).value === ref)
                rang = n;
        });
        return rang;
    };
    it('XC est une valeur lue, CC est lu au bilan, et leur écart est l’égalité attendue', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT, { e1: BALANCE_PROJET_INTERETS, e0: [] });
        const wb = await ouvrir((await exportService.liasseCompleteExcel('t1', 'e1')).buffer);
        const lignes = lignesControles(wb);
        const xc = lignes.find((l) => /\(XC\)$/.test(l.intitule));
        const cc = lignes.find((l) => /\(CC\)$/.test(l.intitule));
        const ecart = lignes.find((l) => /XC-CC/.test(l.intitule));
        expect(xc).toBeDefined();
        expect(cc).toBeDefined();
        expect(ecart).toBeDefined();
        expect(xc.attendu === null || xc.attendu === '').toBe(true);
        expect(xc.formule).toBe(`'Compte Exploitation'!D${rangDeRef(wb.getWorksheet('Compte Exploitation'), 'XC')}`);
        const passif = wb.getWorksheet('Bilan-Passif');
        const rangCc = rangDeRef(passif, 'CC');
        expect(cc.formule).toBe(`'Bilan-Passif'!D${rangCc}`);
        expect(passif.getCell(rangCc, 4).value).toBe(120_000);
        expect(ecart.formule).toBe(`B${xc.rang}-B${cc.rang}`);
        expect(ecart.attendu).toBe(0);
        expect(lignes.filter((l) => /régime normal/.test(l.intitule))).toEqual([]);
    });
    it('N+1 dont le 13 porte encore le solde de N · la ligne CC le retranche, XC-CC reste nul', async () => {
        const N_PLUS_1 = [
            ligne('46210000', client_1.ClasseCompte.CLASSE_4, 0, 150_000, 0, 0),
            ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 120_000, 0, 0),
            ligne('52110000', client_1.ClasseCompte.CLASSE_5, 270_000, 0, 0, 0),
        ];
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT, { e1: N_PLUS_1, e0: BALANCE_PROJET_INTERETS });
        const wb = await ouvrir((await exportService.liasseCompleteExcel('t1', 'e1')).buffer);
        const lignes = lignesControles(wb);
        const cc = lignes.find((l) => /\(CC\)$/.test(l.intitule));
        const passif = wb.getWorksheet('Bilan-Passif');
        const rangCc = rangDeRef(passif, 'CC');
        expect(passif.getCell(rangCc, 4).value).toBe(120_000);
        expect(cc.formule).toBe(`'Bilan-Passif'!D${rangCc}-(120000)`);
        const n = await ouvrir((await fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT, { e1: BALANCE_PROJET_INTERETS, e0: [] }).liasseCompleteExcel('t1', 'e1')).buffer);
        expect(lignesControles(n).find((l) => /\(CC\)$/.test(l.intitule)).formule).toBe(`'Bilan-Passif'!D${rangDeRef(n.getWorksheet('Bilan-Passif'), 'CC')}`);
    });
    it('chaque écart de la feuille se lit sur les deux lignes qui le précèdent', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT, { e1: BALANCE_PROJET_INTERETS, e0: [] });
        const wb = await ouvrir((await exportService.liasseCompleteExcel('t1', 'e1')).buffer);
        const ecarts = lignesControles(wb).filter((l) => l.formule && /^B\d+-B\d+$/.test(l.formule));
        expect(ecarts.map((l) => l.intitule)).toEqual([
            'Écart balance (doit être 0)',
            'Écart bilan actif - passif (doit être 0)',
            "Écart compte d'exploitation / bilan (XC-CC, doit être 0)",
            'Écart réconciliation / balance (doit être 0)',
        ]);
        for (const l of ecarts)
            expect(l.formule).toBe(`B${l.rang - 2}-B${l.rang - 1}`);
    });
    it('le compte d’exploitation exporté seul dit le solde sans le juger à zéro', async () => {
        const lire = async (surcharge) => {
            const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT, surcharge);
            const wb = await ouvrir((await exportService.compteExploitationProjetExcel('t1', 'e1')).buffer);
            const textes = [];
            wb.getWorksheet('Compte Exploitation').eachRow((row) => row.eachCell((cell) => {
                if (typeof cell.value === 'string' && /XC =/.test(cell.value))
                    textes.push(cell.value);
            }));
            return textes;
        };
        const [nonNul] = await lire({ e1: BALANCE_PROJET_INTERETS, e0: [] });
        expect(nonNul).toMatch(/^Solde des opérations de l'exercice : XC = 120\s?000 · non nul, à expliquer en Notes/);
        expect(nonNul).not.toMatch(/régime normal|ne boucle pas/);
        const sansInterets = BALANCE_PROJET_INTERETS.filter((l) => l.numero !== '77470000');
        expect(await lire({ e1: sansInterets, e0: [] })).toEqual(['Solde des opérations de l’exercice : XC = 0.']);
    });
});
describe('liasse complète · Système minimal de trésorerie', () => {
    it('NOTE 2 · quantité et prix unitaire lus sur la campagne sont écrits, avec la source (audit final F85)', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        exportService.etatsFinanciersSmtService.note2Stocks =
            jest.fn().mockResolvedValue({
                lignes: [{ reference: '31100000', designation: 'Riz (kg)', quantite: 12.5, prixUnitaire: 160, montant: 2000 }],
                valeurStockFinal: 2000,
                valeurStockInitial: 0,
                quantitesTenues: true,
                sourceQuantites: "Quantités et prix unitaires lus sur la campagne d'inventaire « Clôture » du 31/12/2026.",
                motifQuantites: '',
            });
        const wb = await ouvrir((await exportService.liasseCompleteExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('NOTE 2 STOCKS');
        let rang = 0;
        ws.eachRow((row, n) => {
            if (row.getCell(2).value === 'Riz (kg)')
                rang = n;
        });
        expect(rang).toBeGreaterThan(0);
        expect(ws.getCell(rang, 3).value).toBe(12.5);
        expect(ws.getCell(rang, 3).numFmt).toBe('#,##0.###');
        expect(ws.getCell(rang, 4).value).toBe(160);
        expect(ws.getCell(rang, 5).value).toBe(2000);
        const textes = [];
        ws.eachRow((row) => row.eachCell((c) => typeof c.value === 'string' && textes.push(c.value)));
        expect(textes.join(' ')).toContain('« Clôture » du 31/12/2026');
    });
    it('reproduit le classeur du modèle SMT, notes 1 à 5 comprises', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        const { buffer } = await exportService.liasseCompleteExcel('t1', 'e1');
        const wb = await ouvrir(buffer);
        const noms = wb.worksheets.map((w) => w.name);
        expect(noms).toEqual([
            'BALANCE N',
            'BALANCE N-1',
            'CONTROLE BALANCE',
            'Couverture',
            'Garde',
            'Fiche 1',
            'Fiche 2',
            'Bilan paysage',
            'Bilan-Actif',
            'Bilan-Passif',
            'Résultat',
            'NOTES ANNEXES',
            'NOTE 1 IMMOBILISATIONS',
            'NOTE 2 STOCKS',
            'NOTE 3 CREANCES-DETTES',
            'NOTE 5 DOTATIONS',
            'NOTE 4 JOURNAL TRESORERIE',
            'TABLE COMMENTAIRE',
            'CONTROLES',
            'ANOMALIES',
        ]);
        const actif = wb.getWorksheet('Bilan-Actif');
        let rangGz = 0;
        actif.eachRow((row, n) => {
            if (row.getCell(1).value === 'GZ')
                rangGz = n;
        });
        expect(rangGz).toBeGreaterThan(8);
        expect(actif.getCell(rangGz, 4).value.formula).toMatch(/^SUM\(D9:D\d+\)$/);
        const fondGz = actif.getCell(rangGz, 2).fill;
        expect(fondGz?.fgColor?.argb).toBe('FF000080');
        const cr = wb.getWorksheet('Résultat');
        const rangs = new Map();
        cr.eachRow((row, n) => {
            const ref = row.getCell(1).value;
            if (typeof ref === 'string')
                rangs.set(ref, n);
        });
        expect(cr.getCell(rangs.get('KZC'), 4).value.formula).toBe(`D${rangs.get('KZ')}+D${rangs.get('VA')}+D${rangs.get('VB')}-D${rangs.get('VC')}-D${rangs.get('JG')}`);
        const note4 = wb.getWorksheet('NOTE 4 JOURNAL TRESORERIE');
        let reportTrouve = false;
        note4.eachRow((row) => {
            if (row.getCell(2).value === 'Report à nouveau' && row.getCell(5).value === 50_000)
                reportTrouve = true;
        });
        expect(reportTrouve).toBe(true);
    });
});
describe('Fiche 1 des liasses SYCEBNL · ce que le dossier sait', () => {
    const JEUX = [
        client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
        client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT,
        client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE,
    ];
    function caseFiche1(wb, code) {
        let valeur = '';
        wb.getWorksheet('Fiche 1').eachRow((row) => {
            if (row.getCell(1).value === code)
                valeur = String(row.getCell(7).value ?? '');
        });
        return valeur;
    }
    async function avec(exercice, tenant, fn) {
        const e1 = EXERCICES[0];
        const t = TENANT;
        const avantE = { ...e1 };
        const avantT = { ...t };
        Object.assign(e1, exercice);
        Object.assign(t, tenant);
        try {
            return await fn();
        }
        finally {
            for (const k of Object.keys(e1))
                delete e1[k];
            Object.assign(e1, avantE);
            for (const k of Object.keys(t))
                delete t[k];
            Object.assign(t, avantT);
        }
    }
    it.each([
        ['court', '2026-04-01', 'DU : 01/04/2026    AU : 31/12/2026'],
        ['long', '2025-07-01', 'DU : 01/07/2025    AU : 31/12/2026'],
    ])('ZA porte les dates exactes d’un premier exercice %s, dans les trois jeux', async (_nom, debut, attendu) => {
        for (const jeu of JEUX) {
            const wb = await avec({ dateDebut: new Date(`${debut}T00:00:00Z`) }, {}, async () => ouvrir((await fabriquerExport(jeu).liasseCompleteExcel('t1', 'e1')).buffer));
            expect({ jeu, za: caseFiche1(wb, 'ZA') }).toEqual({ jeu, za: attendu });
        }
    });
    it('préremplit ZB, ZC, ZD, ZG, ZK et ZM dans les trois jeux, l’acte restant en ZE', async () => {
        for (const jeu of JEUX) {
            const wb = await avec({ dateArreteComptes: new Date('2027-03-15T00:00:00Z') }, {
                numeroAffiliationCnssEmployeur: 'CNSS-0099',
                telephone: '+243 99 111 22 33',
                email: 'grace@asbl.cd',
                ville: 'Bukavu',
                activite: 'Appui aux écoles rurales',
            }, async () => ouvrir((await fabriquerExport(jeu).liasseCompleteExcel('t1', 'e1')).buffer));
            expect({
                jeu,
                ZB: caseFiche1(wb, 'ZB'),
                ZC: caseFiche1(wb, 'ZC'),
                ZD: caseFiche1(wb, 'ZD'),
                ZG: caseFiche1(wb, 'ZG'),
                ZK: caseFiche1(wb, 'ZK'),
                ZM: caseFiche1(wb, 'ZM'),
                ZE: caseFiche1(wb, 'ZE'),
            }).toEqual({
                jeu,
                ZB: '15/03/2027',
                ZC: '31/12/2025',
                ZD: '12',
                ZG: 'CNSS-0099',
                ZK: '+243 99 111 22 33 · grace@asbl.cd · Bukavu',
                ZM: 'Appui aux écoles rurales',
                ZE: 'Arrêté n° 087/CAB/MIN/J/2024',
            });
        }
    });
    it('une valeur absente laisse la case vide', async () => {
        const wb = await avec({}, { telephone: null, email: '  ', ville: null, activite: null }, async () => ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer));
        expect(caseFiche1(wb, 'ZK')).toBe('');
        expect(caseFiche1(wb, 'ZM')).toBe('');
        expect(caseFiche1(wb, 'ZG')).toBe('');
    });
});
describe('S.M.T SYCEBNL · feuilles relues (passe R6)', () => {
    const smt = (e) => e.etatsFinanciersSmtService;
    const textes = (ws) => {
        const t = [];
        ws.eachRow((row) => row.eachCell((c) => typeof c.value === 'string' && t.push(c.value)));
        return t;
    };
    const rangsParRef = (ws) => {
        const rangs = new Map();
        ws.eachRow((row, n) => {
            const ref = row.getCell(1).value;
            if (typeof ref === 'string')
                rangs.set(ref, n);
        });
        return rangs;
    };
    it('Résultat · le renvoi « 4 » sur KA à JF, rien sur JG (la maquette ne le porte pas)', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        const wb = await ouvrir((await exportService.compteDeResultatSmtExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('Résultat');
        const rangs = rangsParRef(ws);
        for (const ref of ['KA', 'KB', 'JA', 'JB', 'JC', 'JD', 'JE', 'JF']) {
            expect([ref, ws.getCell(rangs.get(ref), 3).value]).toEqual([ref, '4']);
        }
        expect(ws.getCell(rangs.get('JG'), 3).value ?? '').toBe('');
    });
    it('Résultat · la colonne EXERCICE N-1 est remplie et totalisée quand l’exercice N-1 existe', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        const wb = await ouvrir((await exportService.liasseCompleteExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('Résultat');
        const rangs = rangsParRef(ws);
        expect(ws.getCell(rangs.get('KA'), 5).value).toBe(0);
        expect(ws.getCell(rangs.get('JG'), 5).value).toBe(0);
        expect(ws.getCell(rangs.get('KZC'), 5).value.formula).toBe(`E${rangs.get('KZ')}+E${rangs.get('VA')}+E${rangs.get('VB')}-E${rangs.get('VC')}-E${rangs.get('JG')}`);
    });
    it('Résultat · sans exercice N-1, la colonne E reste vide, sans formule qui rendrait 0', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        const service = smt(exportService);
        const reel = service.compteDeResultat.bind(service);
        service.compteDeResultat = jest.fn(async (t, e) => {
            const cr = await reel(t, e);
            const sansN1 = (l) => l.map((p) => ({ ...p, montantN1: undefined }));
            return { ...cr, recettes: sansN1(cr.recettes), depenses: sansN1(cr.depenses), retraitements: sansN1(cr.retraitements), exerciceN1Disponible: false };
        });
        const wb = await ouvrir((await exportService.compteDeResultatSmtExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('Résultat');
        const rangs = rangsParRef(ws);
        expect(ws.getCell(rangs.get('KA'), 5).value ?? null).toBeNull();
        expect(ws.getCell(rangs.get('KZC'), 5).value ?? null).toBeNull();
    });
    it('Bilan-Actif · imprime le renvoi (1) mot pour mot, celui que l’écran sert', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        const wb = await ouvrir((await exportService.bilanSmtExcel('t1', 'e1')).buffer);
        expect(textes(wb.getWorksheet('Bilan-Actif'))).toContain(correspondance_smt_1.RENVOI_IMMOBILISATIONS);
    });
    it('Fiche NOTES ANNEXES · chaque note est cochée A ou N/A, N/A pour chaque feuille NEANT', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        const wb = await ouvrir((await exportService.liasseCompleteExcel('t1', 'e1')).buffer);
        const fiche = wb.getWorksheet('NOTES ANNEXES');
        const coche = new Map();
        fiche.eachRow((row) => {
            const note = row.getCell(1).value;
            if (typeof note !== 'string' || !note.startsWith('Note '))
                return;
            const a = row.getCell(9).value === 'X';
            const na = row.getCell(10).value === 'X';
            expect([note, a !== na]).toEqual([note, true]);
            coche.set(note, a ? 'A' : 'N/A');
        });
        expect(Object.fromEntries(coche)).toEqual({
            'Note 1': 'N/A',
            'Note 2': 'N/A',
            'Note 3': 'N/A',
            'Note 5': 'A',
            'Note 4': 'A',
        });
        for (const [note, feuille] of [
            ['Note 1', 'NOTE 1 IMMOBILISATIONS'],
            ['Note 2', 'NOTE 2 STOCKS'],
        ]) {
            expect(coche.get(note)).toBe('N/A');
            expect(textes(wb.getWorksheet(feuille)).some((t) => /n[ée]ant/i.test(t))).toBe(true);
        }
    });
    it('NOTE 4 · une recette en « Autres » ne s’imprime pas sous « Autres » des dépenses (SYCEBNL et SYSCOHADA)', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        const operation = (sens, autres) => ({
            date: new Date('2026-03-01'),
            libelle: sens === 'RECETTE' ? 'Don reçu' : 'Règlement fournisseur',
            reference: null,
            sens,
            recette: sens === 'RECETTE' ? autres : 0,
            depense: sens === 'DEPENSE' ? autres : 0,
            solde: 0,
            virementInterne: false,
            ventile: true,
            ventilation: { autres },
        });
        const journal = (colonne) => ({
            journaux: [
                {
                    compteId: 'c',
                    numero: '57110000',
                    intitule: 'Caisse',
                    reportANouveau: 0,
                    operations: [operation('RECETTE', 500), operation('DEPENSE', 200)],
                    soldeAReporter: 300,
                    totalRecettes: 500,
                    totalDepenses: 200,
                    lignesNonVentilees: 0,
                    soldeBalance: 300,
                    boucle: true,
                },
            ],
            colonnesRecettes: [colonne('cotisations', 'Cotisations'), colonne('autres', 'Autres')],
            colonnesDepenses: [colonne('salaires', 'Salaires'), colonne('autres', 'Autres')],
            nb: 'NB',
        });
        const prive = exportService;
        const ident = await prive.identiteLiasse('t1', 'e1');
        for (const [methode, colonne] of [
            ['feuilleJournalTresorerieEtafi', (cle, libelle) => ({ cle, libelle })],
            ['feuilleJournalTresorerieSmtSyscohadaEtafi', (cle, libelle) => ({ cle, libelle, rajoutAutorise: false })],
        ]) {
            const wb = new ExcelJS.Workbook();
            const ws = prive[methode].call(exportService, wb, journal(colonne), ident);
            let rangRecette = 0;
            let rangDepense = 0;
            let rangBandeau = 0;
            ws.eachRow((row, n) => {
                if (row.getCell(2).value === 'Don reçu')
                    rangRecette = n;
                if (row.getCell(2).value === 'Règlement fournisseur')
                    rangDepense = n;
                if (row.getCell(6).value === 'Ventilation recettes')
                    rangBandeau = n;
            });
            expect([methode, ws.getCell(rangRecette, 7).value]).toEqual([methode, 500]);
            expect([methode, ws.getCell(rangRecette, 9).value ?? null]).toEqual([methode, null]);
            expect([methode, ws.getCell(rangDepense, 9).value]).toEqual([methode, 200]);
            expect([methode, ws.getCell(rangDepense, 7).value ?? null]).toEqual([methode, null]);
            expect([methode, ws.getCell(rangBandeau, 8).value]).toEqual([methode, 'Ventilation dépenses']);
        }
    });
    it('NOTE 5 · l’intitulé officiel de la quatrième colonne, le motif des deux colonnes et le 106 hors rubriques', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        smt(exportService).note5Dotation = jest.fn().mockResolvedValue({
            rubriques: [{ cle: 'nonConsomptible', libelle: 'Dotation non consomptible', montant: 5000, comptes: [] }],
            total: 5000,
            horsRubriques: [{ numero: '10611000', intitule: 'Écarts de réévaluation', montant: 900 }],
            totalHorsRubriques: 900,
            totalPosteHA: 5900,
            motifHorsRubriques: 'MOTIF 106',
            membres: [{ nom: 'Apporteur', nationalite: null, montant: 5000, precisionDroitEntree: null, numero: '45120000' }],
            nationaliteTenue: false,
            precisionDroitEntreeTenue: false,
            motifColonnesNonTenues: 'MOTIF DEUX COLONNES',
            motifMembres: 'MOTIF MEMBRES',
        });
        const wb = await ouvrir((await exportService.notesSmtExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('NOTE 5 DOTATIONS');
        expect(ws.getCell(8, 4).value).toBe("Préciser avec droit d'entrée ou sans droit d'entrée");
        const t = textes(ws);
        expect(t).toEqual(expect.arrayContaining(['MOTIF DEUX COLONNES', 'MOTIF MEMBRES', 'MOTIF 106']));
        let rangTotal = 0;
        let rangHa = 0;
        ws.eachRow((row, n) => {
            if (row.getCell(1).value === 'TOTAL')
                rangTotal = n;
            if (String(row.getCell(1).value ?? '').startsWith('POSTE HA'))
                rangHa = n;
        });
        expect(ws.getCell(rangTotal, 3).value).toBe(5000);
        expect(rangHa).toBeGreaterThan(rangTotal);
        expect(ws.getCell(rangHa, 3).value).toBe(5900);
    });
    it('NOTE 1 · total des seuls biens détenus, sorties à part, cautions et comptes non couverts nommés', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        const bien = (designation, montant, sortie) => ({
            origine: 'REGISTRE',
            dateMiseEnService: new Date('2024-02-01'),
            designation,
            montant,
            dateAcquisition: new Date('2024-02-01'),
            dureeUtiliteAns: 5,
            dateSortie: sortie ? new Date(sortie) : null,
            prixCession: sortie ? 100 : null,
        });
        smt(exportService).note1Immobilisations = jest.fn().mockResolvedValue({
            lignes: [
                bien('Véhicule', 3000, null),
                { ...bien('27510000 Cautions', 400, null), origine: 'BALANCE', dateMiseEnService: null, dateAcquisition: null, dureeUtiliteAns: null },
            ],
            sortiesDeLExercice: [bien('Ordinateur cédé', 900, '2026-06-30')],
            total: 3400,
            totalRegistre: 3000,
            totalCautions: 400,
            motifCautions: 'MOTIF CAUTIONS',
            ecartsGA: [{ numero: '24500000', intitule: 'Matériel', soldeBalance: 1000, valeurFiches: 0, ecart: 1000 }],
            fichesSansSolde: [],
            motifEcartsGA: 'MOTIF GA',
        });
        const wb = await ouvrir((await exportService.notesSmtExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('NOTE 1 IMMOBILISATIONS');
        const rangDe = (libelle) => {
            let rang = 0;
            ws.eachRow((row, n) => {
                if (String(row.getCell(2).value ?? '').startsWith(libelle))
                    rang = n;
            });
            return rang;
        };
        const total = rangDe('TOTAL DES BIENS DÉTENUS');
        expect(ws.getCell(total, 3).value).toBe(3400);
        expect(rangDe('Ordinateur cédé')).toBeGreaterThan(total);
        expect(ws.getCell(rangDe('27510000'), 1).value ?? null).toBeNull();
        const t = textes(ws);
        expect(t).toEqual(expect.arrayContaining(['MOTIF CAUTIONS', 'MOTIF GA']));
        expect(t.some((x) => x.startsWith('24500000 Matériel') && x.includes('écart'))).toBe(true);
    });
    it('NOTE 3 · la dépréciation se lit en déduction des créances, puis les créances nettes (poste GC)', async () => {
        const exportService = fabriquerExport(client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        const service = smt(exportService);
        const reel = service.note3CreancesDettes.bind(service);
        service.note3CreancesDettes = jest.fn(async (t, e) => ({
            ...(await reel(t, e)),
            depreciationsCreances: [
                { numero: '49120000', intitule: 'Créances douteuses', montantCloture: -300, montantOuverture: 0, variationValeur: -300 },
            ],
            totalDepreciationsCreances: -300,
            totalCreancesNettes: -300,
        }));
        const wb = await ouvrir((await exportService.notesSmtExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('NOTE 3 CREANCES-DETTES');
        let rangDep = 0;
        let rangNettes = 0;
        let rangDettes = 0;
        ws.eachRow((row, n) => {
            const b = String(row.getCell(2).value ?? '');
            if (b.startsWith('49120000'))
                rangDep = n;
            if (b.startsWith('CRÉANCES NETTES'))
                rangNettes = n;
            if (row.getCell(1).value === 'DETTES')
                rangDettes = n;
        });
        expect(ws.getCell(rangDep, 3).value).toBe(-300);
        expect(ws.getCell(rangNettes, 3).value).toBe(-300);
        expect(rangNettes).toBeLessThan(rangDettes);
    });
});
describe('liasses SYCEBNL · formules qui lisent BALANCE N et BALANCE N-1', () => {
    const jeux = [
        ['associations', client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS, BALANCE_N, BALANCE_N1],
        ['projets', client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT, BALANCE_PROJET_N, BALANCE_PROJET_N1],
        ['SMT', client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE, BALANCE_SMT_N, []],
    ];
    it.each(jeux)('%s · chaque plage vise les comptes de la bonne colonne, et se recalcule', async (_n, jeu, n, n1) => {
        const wb = await ouvrir((await fabriquerExport(jeu).liasseCompleteExcel('t1', 'e1')).buffer);
        const { plages, defauts } = (0, relecture_balances_liasse_1.defautsDesFormulesDeBalance)(wb);
        const nonVides = n1.length > 0 ? 2 : 1;
        expect(new Set(plages.map((p) => p.feuille)).size).toBe(nonVides);
        expect(plages.filter((p) => p.feuilleSource === 'CONTROLE BALANCE')).toHaveLength(6 * nonVides);
        expect(plages.filter((p) => p.feuilleSource === 'CONTROLES').map((p) => p.colonne)).toEqual(['G', 'H']);
        expect(defauts).toEqual([]);
        for (const p of plages) {
            const source = wb.getWorksheet(p.feuilleSource).getCell(p.celluleSource);
            const formule = source.value.formula;
            expect((0, relecture_balances_liasse_1.evaluerSomme)(wb, formule)).toBe((0, relecture_balances_liasse_1.sommeAttendue)(p.feuille === theme_etafi_1.NOM_BALANCE ? n : n1, p.colonne));
        }
        const verdicts = (0, relecture_balances_liasse_1.verdictsControleBalance)(wb);
        const soldesN = plages.filter((p) => p.feuille === theme_etafi_1.NOM_BALANCE && p.feuilleSource === 'CONTROLES');
        expect(soldesN.some((p) => (0, relecture_balances_liasse_1.sommeAttendue)(n, p.colonne) !== 0)).toBe(true);
        expect(verdicts).toHaveLength(6);
        const attendu = (lignes, a, b) => {
            const ecart = Math.round((0, relecture_balances_liasse_1.sommeAttendue)(lignes, a) - (0, relecture_balances_liasse_1.sommeAttendue)(lignes, b));
            return ecart === 0 ? 'Equilibre' : `Déséquilibre : écart de ${ecart.toLocaleString('en-US')}`;
        };
        expect(verdicts.map((v) => v.verdict)).toEqual([
            attendu(n, 'C', 'D'),
            attendu(n, 'E', 'F'),
            attendu(n, 'G', 'H'),
            attendu(n1, 'C', 'D'),
            attendu(n1, 'E', 'F'),
            attendu(n1, 'G', 'H'),
        ]);
        if (jeu !== client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT) {
            for (const v of verdicts)
                expect(v.verdict).toBe('Equilibre');
        }
    });
    it('une balance faussée dit son écart, colonne par colonne', async () => {
        const wb = await ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer);
        const bal = wb.getWorksheet(theme_etafi_1.NOM_BALANCE);
        let premier = 0;
        bal.eachRow((_row, r) => {
            if (!premier && (0, relecture_balances_liasse_1.estLigneDeCompte)(bal, r))
                premier = r;
        });
        const g = bal.getCell(premier, 7);
        g.value = Number(g.value ?? 0) + 100;
        const d = bal.getCell(premier, 4);
        d.value = Number(d.value ?? 0) + 250;
        const verdicts = (0, relecture_balances_liasse_1.verdictsControleBalance)(wb).filter((v) => v.bloc === 'BALANCE N');
        expect(verdicts.map((v) => v.verdict)).toEqual([
            'Déséquilibre : écart de -250',
            'Equilibre',
            'Déséquilibre : écart de 100',
        ]);
        for (const v of (0, relecture_balances_liasse_1.verdictsControleBalance)(wb).filter((x) => x.bloc === 'BALANCE N-1'))
            expect(v.verdict).toBe('Equilibre');
    });
});
//# sourceMappingURL=liasse-etafi.spec.js.map