"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ExcelJS = require("exceljs");
const etats_financiers_service_1 = require("../etats-financiers/etats-financiers.service");
const etats_financiers_projet_service_1 = require("../etats-financiers/etats-financiers-projet.service");
const etats_financiers_projet_budget_service_1 = require("../etats-financiers/etats-financiers-projet-budget.service");
const engagement_service_1 = require("../analytique/engagement.service");
const etats_financiers_smt_service_1 = require("../etats-financiers/etats-financiers-smt.service");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const etats_financiers_smt_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-smt-syscohada.service");
const note_annexe_service_1 = require("../notes-annexes/note-annexe.service");
const export_service_1 = require("./export.service");
function ligne(numero, intitule, classe, reportDebit, reportCredit, mouvementDebit, mouvementCredit) {
    return {
        compteId: `id-${numero}`,
        numero,
        intitule,
        classe,
        typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
        reportDebit,
        reportCredit,
        mouvementDebit,
        mouvementCredit,
        totalDebit: reportDebit + mouvementDebit,
        totalCredit: reportCredit + mouvementCredit,
        solde: reportDebit + mouvementDebit - reportCredit - mouvementCredit,
    };
}
const BALANCE = [
    ligne('41100000', 'Clients', client_1.ClasseCompte.CLASSE_4, 40_000, 0, 60_000, 0),
    ligne('40110000', 'Fournisseurs', client_1.ClasseCompte.CLASSE_4, 0, 0, 0, 60_000),
    ligne('57110000', 'Caisse', client_1.ClasseCompte.CLASSE_5, 50_000, 0, 300_000, 120_000),
    ligne('70110000', 'Cotisations', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 300_000),
    ligne('60410000', 'Achats', client_1.ClasseCompte.CLASSE_6, 0, 0, 120_000, 0),
    ligne('10110000', 'Dotation', client_1.ClasseCompte.CLASSE_1, 0, 50_000, 0, 0),
];
const CLOTURE = new Date('2026-12-31T00:00:00Z');
const APRES_CLOTURE = new Date('2027-03-31T00:00:00Z');
const AVANT_CLOTURE = new Date('2026-06-30T00:00:00Z');
const LIGNES_TENUES = [
    { compteId: 'id-41100000', debit: 70_000, credit: 0, dateEcheance: APRES_CLOTURE },
    { compteId: 'id-41100000', debit: 30_000, credit: 0, dateEcheance: AVANT_CLOTURE },
    { compteId: 'id-40110000', debit: 0, credit: 60_000, dateEcheance: APRES_CLOTURE },
];
const LIGNES_NON_LETTREES = [
    { compteId: 'id-41100000', debit: 120_000, credit: 0, dateEcheance: APRES_CLOTURE },
    { compteId: 'id-41100000', debit: 0, credit: 20_000, dateEcheance: null },
];
function sommesParEcheance(lignesTiers) {
    return jest.fn(({ where }) => {
        const borne = where.dateEcheance ?? {};
        const parCompte = new Map();
        for (const l of lignesTiers) {
            if (!l.dateEcheance)
                continue;
            if (where.compteId && !where.compteId.in.includes(l.compteId))
                continue;
            if (borne.gt && !(l.dateEcheance > borne.gt))
                continue;
            if (borne.lte && !(l.dateEcheance <= borne.lte))
                continue;
            const cumul = parCompte.get(l.compteId) ?? { debit: 0, credit: 0 };
            cumul.debit += l.debit;
            cumul.credit += l.credit;
            parCompte.set(l.compteId, cumul);
        }
        return Promise.resolve([...parCompte].map(([compteId, s]) => ({ compteId, _sum: { debit: s.debit, credit: s.credit } })));
    });
}
const TENANT = {
    id: 't1',
    nom: 'ASBL GRACE',
    numeroImpot: 'A1234567B',
    adresse: '12 av. de la Justice',
    ville: 'Kinshasa',
    pays: 'RD Congo',
    jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE,
    actePersonnaliteJuridique: 'Arrêté n° 087/CAB/MIN/J/2024',
};
const EXERCICES = [{ id: 'e1', tenantId: 't1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: CLOTURE }];
function fabriquerExport(lignesTiers) {
    const ecritureService = {
        balance: jest.fn().mockResolvedValue({
            lignes: BALANCE,
            totaux: {
                debit: BALANCE.reduce((s, l) => s + l.totalDebit, 0),
                credit: BALANCE.reduce((s, l) => s + l.totalCredit, 0),
            },
        }),
    };
    const exerciceService = { lister: jest.fn().mockResolvedValue([...EXERCICES]) };
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ ...TENANT }) },
        exercice: {
            findFirstOrThrow: jest.fn().mockResolvedValue(EXERCICES[0]),
            findFirst: jest.fn().mockResolvedValue(EXERCICES[0]),
        },
        rattachementNote: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        provisionRisqueCharge: { findMany: jest.fn().mockResolvedValue([]) },
        saisieNote: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { groupBy: sommesParEcheance(lignesTiers), findMany: jest.fn().mockResolvedValue([]) },
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
async function feuilleNote3(lignesTiers) {
    const { buffer } = await fabriquerExport(lignesTiers).notesSmtExcel('t1', 'e1');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb.getWorksheet('NOTE 3 CREANCES-DETTES');
}
function rangDuCompte(ws, numero) {
    let rang = 0;
    ws.eachRow((row, n) => {
        if (String(row.getCell(2).value ?? '').startsWith(`${numero} `))
            rang = n;
    });
    expect(rang).toBeGreaterThan(9);
    return rang;
}
function rangDuTotal(ws, libelle) {
    let rang = 0;
    ws.eachRow((row, n) => {
        if (row.getCell(2).value === libelle)
            rang = n;
    });
    expect(rang).toBeGreaterThan(9);
    return rang;
}
function ligneDeControle(ws) {
    let texte = '';
    ws.eachRow((row) => {
        const c = row.getCell(1);
        if (c.font?.italic && c.font?.size === 8 && typeof c.value === 'string')
            texte = c.value;
    });
    return texte;
}
describe('NOTE 3 du S.M.T · la ventilation par échéance atteint la feuille', () => {
    it('coiffe les six colonnes officielles et les trois ajoutées de deux bandeaux distincts', async () => {
        const ws = await feuilleNote3(LIGNES_TENUES);
        expect(String(ws.getCell(8, 1).value)).toContain('MAQUETTE OFFICIELLE');
        expect(String(ws.getCell(8, 1).value)).toContain('Partie 4, ch. 4, section 3');
        expect(String(ws.getCell(8, 7).value)).toContain('hors maquette');
        const entetes = [];
        ws.eachRow((row) => {
            if (row.getCell(1).value === 'DATE')
                entetes.push(row.values);
        });
        const ajoutees = ['Dont non échu au 31/12/N', 'Dont échu au 31/12/N', 'Part non ventilée · signal de tenue'];
        const officielles = (nom) => [
            undefined,
            'DATE',
            nom,
            'Montant au 31 décembre N',
            'Montant au 1er janvier N',
            'Variation en valeur',
            'Variation en %',
            ...ajoutees,
        ];
        expect(entetes).toEqual([
            officielles('NOM CLIENTS-USAGERS ET AUTRES DEBITEURS'),
            officielles('NOM DES FOURNISSEURS ET AUTRES CRÉDITEURS'),
        ]);
    });
    it('laisse vide la colonne DATE de chaque ligne de détail, le numéro suivant le nom', async () => {
        const ws = await feuilleNote3(LIGNES_TENUES);
        for (const numero of ['41100000', '40110000']) {
            const rang = rangDuCompte(ws, numero);
            expect(ws.getCell(rang, 1).value ?? null).toBeNull();
        }
        expect(ws.getCell(rangDuCompte(ws, '41100000'), 2).value).toBe('41100000 Clients');
    });
    it('ventile la créance et la dette, et les trois parts somment au montant du 31/12', async () => {
        const ws = await feuilleNote3(LIGNES_TENUES);
        const client = rangDuCompte(ws, '41100000');
        expect(ws.getCell(client, 3).value).toBe(100_000);
        expect(ws.getCell(client, 7).value).toBe(70_000);
        expect(ws.getCell(client, 8).value).toBe(30_000);
        expect(ws.getCell(client, 9).value).toBe(0);
        const fournisseur = rangDuCompte(ws, '40110000');
        expect(ws.getCell(fournisseur, 3).value).toBe(60_000);
        expect(ws.getCell(fournisseur, 7).value).toBe(60_000);
        expect(ws.getCell(fournisseur, 8).value).toBe(0);
        for (const rang of [client, fournisseur]) {
            const [c, nonEchu, echu, reste] = [3, 7, 8, 9].map((col) => Number(ws.getCell(rang, col).value));
            expect(nonEchu + echu + reste).toBeCloseTo(c, 2);
        }
    });
    it('porte les trois parts sur les DEUX lignes de total, à côté du total officiel', async () => {
        const ws = await feuilleNote3(LIGNES_TENUES);
        const totalCreances = rangDuTotal(ws, 'TOTAL DES CRÉANCES');
        expect(ws.getCell(totalCreances, 3).value).toBe(100_000);
        expect(ws.getCell(totalCreances, 7).value).toBe(70_000);
        expect(ws.getCell(totalCreances, 8).value).toBe(30_000);
        expect(ws.getCell(totalCreances, 9).value).toBe(0);
        const totalDettes = rangDuTotal(ws, 'TOTAL DES DETTES');
        expect(ws.getCell(totalDettes, 3).value).toBe(60_000);
        expect(ws.getCell(totalDettes, 7).value).toBe(60_000);
        expect(ws.getCell(totalDettes, 9).value).toBe(0);
        expect(ligneDeControle(ws)).toContain('Ventilation complète');
    });
    it('rend à l’identique les six colonnes officielles d’un dossier qui n’a saisi aucune échéance', async () => {
        const ws = await feuilleNote3([]);
        const client = rangDuCompte(ws, '41100000');
        expect(ws.getCell(client, 1).value ?? null).toBeNull();
        expect(ws.getCell(client, 2).value).toBe('41100000 Clients');
        expect(ws.getCell(client, 3).value).toBe(100_000);
        expect(ws.getCell(client, 4).value).toBe(40_000);
        expect(ws.getCell(client, 5).value).toBe(60_000);
        expect(ws.getCell(client, 6).value).toBe(150);
        expect(rangDuTotal(ws, 'TOTAL DES CRÉANCES')).toBeGreaterThan(client);
        expect(ws.getCell(rangDuTotal(ws, 'TOTAL DES CRÉANCES'), 3).value).toBe(100_000);
        expect(ws.getCell(rangDuTotal(ws, 'TOTAL DES DETTES'), 3).value).toBe(60_000);
        expect(ws.getCell(client, 7).value).toBe(0);
        expect(ws.getCell(client, 8).value).toBe(0);
        expect(ws.getCell(client, 9).value).toBe(100_000);
        expect(ws.getCell(rangDuTotal(ws, 'TOTAL DES CRÉANCES'), 9).value).toBe(100_000);
        const controle = ligneDeControle(ws);
        expect(controle).toContain('Etat des créances et des dettes non échues');
        expect(controle).toContain("Renseigner la date d'échéance");
    });
    it('présente une part non ventilée négative comme un signal de tenue, jamais comme un montant', async () => {
        const ws = await feuilleNote3(LIGNES_NON_LETTREES);
        const client = rangDuCompte(ws, '41100000');
        expect(ws.getCell(client, 3).value).toBe(100_000);
        expect(ws.getCell(client, 7).value).toBe(120_000);
        expect(ws.getCell(client, 9).value).toBe(-20_000);
        expect(String(ws.getCell(client, 9).note ?? '')).toContain('NÉGATIVE');
        expect(String(ws.getCell(client, 9).note ?? '')).toContain('non lettré');
        const controle = ligneDeControle(ws);
        expect(controle).toContain('NÉGATIVE');
        expect(controle).toContain('Signal de tenue');
    });
    it('sert la même feuille dans la liasse complète que dans l’export individuel', async () => {
        const { buffer } = await fabriquerExport(LIGNES_TENUES).liasseCompleteExcel('t1', 'e1');
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.getWorksheet('NOTE 3 CREANCES-DETTES');
        expect(ws.getCell(9, 7).value).toBe('Dont non échu au 31/12/N');
        expect(ws.getCell(9, 9).value).toBe('Part non ventilée · signal de tenue');
        const client = rangDuCompte(ws, '41100000');
        expect(ws.getCell(client, 7).value).toBe(70_000);
        expect(ws.getCell(client, 8).value).toBe(30_000);
    });
});
function fabriquerExportSyscohada(lignesTiers) {
    const ecritureService = {
        balance: jest.fn().mockResolvedValue({
            lignes: BALANCE,
            totaux: {
                debit: BALANCE.reduce((s, l) => s + l.totalDebit, 0),
                credit: BALANCE.reduce((s, l) => s + l.totalCredit, 0),
            },
        }),
    };
    const exerciceService = { lister: jest.fn().mockResolvedValue([...EXERCICES]) };
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                ...TENANT,
                systemeComptableSyscohada: client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE,
                devise: 'CDF',
            }),
        },
        exercice: {
            findFirstOrThrow: jest.fn().mockResolvedValue(EXERCICES[0]),
            findFirst: jest.fn().mockResolvedValue(EXERCICES[0]),
        },
        rattachementNote: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        provisionRisqueCharge: { findMany: jest.fn().mockResolvedValue([]) },
        saisieNote: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { groupBy: sommesParEcheance(lignesTiers), findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        campagneInventaire: { findFirst: jest.fn().mockResolvedValue(null) },
        tiersCompte: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const syscohada = new etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService(ecritureService, exerciceService);
    const smtSyscohada = new etats_financiers_smt_syscohada_service_1.EtatsFinanciersSmtSyscohadaService(ecritureService, exerciceService, prisma);
    const notes = new note_annexe_service_1.NoteAnnexeService(ecritureService, exerciceService, prisma, { executionBudgetaire: jest.fn() }, { bilan: jest.fn(), compteDeResultat: jest.fn(), tableauFluxTresorerie: jest.fn() });
    return new export_service_1.ExportService(prisma, ecritureService, {}, {}, {}, {}, notes, {}, {}, {}, syscohada, smtSyscohada);
}
async function feuilleNote3Syscohada(lignesTiers) {
    const { buffer } = await fabriquerExportSyscohada(lignesTiers).notesSmtSyscohadaExcel('t1', 'e1');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb.getWorksheet('NOTE 3 CREANCES-DETTES');
}
function rangDuCompteSyscohada(ws, numero) {
    let rang = 0;
    ws.eachRow((row, n) => {
        if (String(row.getCell(2).value ?? '').startsWith(numero))
            rang = n;
    });
    expect(rang).toBeGreaterThan(8);
    return rang;
}
describe('NOTE 3 du S.M.T SYSCOHADA · la même ventilation, imprimée de la même façon', () => {
    it('ajoute les trois mêmes colonnes après les cinq du Titre X, sous le même bandeau', async () => {
        const ws = await feuilleNote3Syscohada(LIGNES_TENUES);
        let rangEntetes = 0;
        ws.eachRow((row, n) => {
            if (rangEntetes === 0 && row.getCell(1).value === 'Date')
                rangEntetes = n;
        });
        expect(rangEntetes).toBeGreaterThan(8);
        expect(ws.getRow(rangEntetes).values).toEqual([
            undefined,
            'Date',
            'Nom du client',
            'Montant au 31 décembre',
            'Montant au 1er janvier',
            'Variation %',
            'Dont non échu au 31/12/N',
            'Dont échu au 31/12/N',
            'Part non ventilée · signal de tenue',
        ]);
        expect(String(ws.getCell(rangEntetes - 1, 1).value)).toContain('Titre X, ch. 3');
        expect(String(ws.getCell(rangEntetes - 1, 6).value)).toContain('hors maquette');
    });
    it('ventile la créance sans toucher aux montants de la maquette', async () => {
        const ws = await feuilleNote3Syscohada(LIGNES_TENUES);
        const client = rangDuCompteSyscohada(ws, '41100000');
        expect(ws.getCell(client, 3).value).toBe(100_000);
        expect(ws.getCell(client, 4).value).toBe(40_000);
        expect(ws.getCell(client, 6).value).toBe(70_000);
        expect(ws.getCell(client, 7).value).toBe(30_000);
        expect(ws.getCell(client, 8).value).toBe(0);
        const totalCreances = rangDuTotal(ws, 'TOTAL DES CRÉANCES');
        expect(ws.getCell(totalCreances, 3).value).toBe(100_000);
        expect(ws.getCell(totalCreances, 6).value).toBe(70_000);
        expect(ws.getCell(totalCreances, 7).value).toBe(30_000);
    });
    it('imprime la lacune de tenue sans écraser la réserve sur la variation en %', async () => {
        const ws = await feuilleNote3Syscohada([]);
        const client = rangDuCompteSyscohada(ws, '41100000');
        expect(ws.getCell(client, 8).value).toBe(100_000);
        const controles = [];
        ws.eachRow((row) => {
            const c = row.getCell(1);
            if (c.font?.italic && c.font?.size === 8 && typeof c.value === 'string')
                controles.push(c.value);
        });
        expect(controles).toHaveLength(2);
        expect(controles[0]).toContain('Variations portées au compte de résultat');
        expect(controles[1]).toContain('non échues');
        expect(controles[1]).toContain("Renseignez la date d'échéance");
    });
});
//# sourceMappingURL=note3-ventilation-echeance.spec.js.map