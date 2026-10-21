"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ExcelJS = require("exceljs");
const fs_1 = require("fs");
const path_1 = require("path");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const etats_financiers_smt_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-smt-syscohada.service");
const correspondance_compte_resultat_syscohada_1 = require("../etats-financiers-syscohada/correspondance-compte-resultat-syscohada");
const note_annexe_service_1 = require("../notes-annexes/note-annexe.service");
const export_service_1 = require("./export.service");
const resultat_de_l_exercice_1 = require("../etats-financiers/resultat-de-l-exercice");
const theme_etafi_1 = require("./theme-etafi");
const presentation_fpm_1 = require("./presentation-fpm");
const relecture_balances_liasse_1 = require("./relecture-balances-liasse");
jest.setTimeout(30000);
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
        clotureDebit: 0,
        clotureCredit: 0,
        totalDebit: reportDebit + mouvementDebit,
        totalCredit: reportCredit + mouvementCredit,
        solde: reportDebit + mouvementDebit - reportCredit - mouvementCredit,
    };
}
const BALANCE_N = [
    ligne('10130000', 'Capital souscrit, appelé, versé, non amorti', client_1.ClasseCompte.CLASSE_1, 0, 800_000, 0, 0),
    ligne('24410000', 'Matériel de bureau', client_1.ClasseCompte.CLASSE_2, 600_000, 0, 150_000, 0),
    ligne('28440000', 'Amortissements du matériel et mobilier', client_1.ClasseCompte.CLASSE_2, 0, 100_000, 0, 50_000),
    ligne('41110000', 'Clients', client_1.ClasseCompte.CLASSE_4, 0, 0, 620_000, 400_000),
    ligne('40110000', 'Fournisseurs', client_1.ClasseCompte.CLASSE_4, 0, 0, 145_000, 190_000),
    ligne('52110000', 'Banques en monnaie nationale', client_1.ClasseCompte.CLASSE_5, 300_000, 0, 400_000, 415_000),
    ligne('60110000', 'Achats de marchandises dans la Région', client_1.ClasseCompte.CLASSE_6, 0, 0, 190_000, 0),
    ligne('66110000', 'Appointements salaires et commissions', client_1.ClasseCompte.CLASSE_6, 0, 0, 120_000, 0),
    ligne('68110000', 'Dotations aux amortissements d’exploitation', client_1.ClasseCompte.CLASSE_6, 0, 0, 50_000, 0),
    ligne('70110000', 'Ventes de marchandises dans la Région', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 620_000),
];
const BALANCE_N1 = [
    ligne('10130000', 'Capital souscrit, appelé, versé, non amorti', client_1.ClasseCompte.CLASSE_1, 0, 800_000, 0, 0),
    ligne('24410000', 'Matériel de bureau', client_1.ClasseCompte.CLASSE_2, 600_000, 0, 0, 0),
    ligne('28440000', 'Amortissements du matériel et mobilier', client_1.ClasseCompte.CLASSE_2, 0, 100_000, 0, 0),
    ligne('52110000', 'Banques en monnaie nationale', client_1.ClasseCompte.CLASSE_5, 300_000, 0, 0, 0),
];
const BALANCE_SMT_N = [
    ligne('10300000', 'Capital personnel', client_1.ClasseCompte.CLASSE_1, 0, 50_000, 0, 0),
    ligne('57110000', 'Caisse en monnaie nationale', client_1.ClasseCompte.CLASSE_5, 50_000, 0, 300_000, 120_000),
    ligne('60110000', 'Achats de marchandises dans la Région', client_1.ClasseCompte.CLASSE_6, 0, 0, 120_000, 0),
    ligne('70110000', 'Ventes de marchandises dans la Région', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 300_000),
];
const compteStub = (numero, intitule) => ({ numero, intitule });
const ECRITURES_SMT = [
    {
        id: 'ec1',
        date: new Date('2026-03-01T00:00:00Z'),
        createdAt: new Date('2026-03-01T00:00:00Z'),
        libelle: 'Vente au comptant',
        reference: 'V-001',
        statut: client_1.StatutEcriture.VALIDEE,
        estGenereeParCloture: false,
        lignes: [
            {
                compteId: 'id-57110000',
                debit: 300_000,
                credit: 0,
                compte: compteStub('57110000', 'Caisse en monnaie nationale'),
            },
            {
                compteId: 'id-70110000',
                debit: 0,
                credit: 300_000,
                compte: compteStub('70110000', 'Ventes de marchandises dans la Région'),
            },
        ],
    },
    {
        id: 'ec2',
        date: new Date('2026-06-01T00:00:00Z'),
        createdAt: new Date('2026-06-01T00:00:00Z'),
        libelle: 'Achat de marchandises payé comptant',
        reference: 'A-001',
        statut: client_1.StatutEcriture.VALIDEE,
        estGenereeParCloture: false,
        lignes: [
            {
                compteId: 'id-60110000',
                debit: 120_000,
                credit: 0,
                compte: compteStub('60110000', 'Achats de marchandises dans la Région'),
            },
            {
                compteId: 'id-57110000',
                debit: 0,
                credit: 120_000,
                compte: compteStub('57110000', 'Caisse en monnaie nationale'),
            },
        ],
    },
];
const TENANT = {
    id: 't1',
    nom: 'SARL BATIMAT',
    referentiel: client_1.Referentiel.SYSCOHADA,
    systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL,
    numeroImpot: 'A0900123X',
    rccm: 'CD/KIN/RCCM/22-B-01234',
    adresse: '145 av. du Commerce',
    ville: 'Kinshasa',
    pays: 'RD Congo',
    devise: 'CDF',
};
const EXERCICES = [
    { id: 'e1', tenantId: 't1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') },
    { id: 'e0', tenantId: 't1', dateDebut: new Date('2025-01-01T00:00:00Z'), dateFin: new Date('2025-12-31T00:00:00Z') },
];
function fabriquerExport(systeme = client_1.SystemeComptableSyscohada.NORMAL, saisies = [], immobilisations = [], mandats = []) {
    const smt = systeme === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE;
    const balances = smt
        ? { e1: BALANCE_SMT_N, e0: [] }
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
        virementsDeMiseEnService: jest.fn().mockResolvedValue(new Map()),
        mouvementsDeCoutsEmpruntIncorpores: jest.fn().mockResolvedValue(new Map()),
        mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
    };
    const exerciceService = {
        lister: jest.fn().mockResolvedValue([...EXERCICES]),
    };
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ ...TENANT, systemeComptableSyscohada: systeme }),
        },
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
        saisieNote: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(saisies
                .filter((c) => c.exerciceId === where.exerciceId)
                .map(({ exerciceId: _e, ...c }) => ({ valeurNombre: null, ...c })))),
        },
        compte: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
        ecriture: { findMany: jest.fn().mockResolvedValue(smt ? ECRITURES_SMT : []) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        immobilisation: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(immobilisations.filter((i) => {
                if (where?.tenantId !== 't1')
                    return false;
                if (where.dateAcquisition?.lte && i.dateAcquisition > where.dateAcquisition.lte)
                    return false;
                if (where.OR) {
                    return where.OR.some((o) => o.dateSortie === null ? i.dateSortie === null : i.dateSortie !== null && i.dateSortie >= o.dateSortie.gte);
                }
                return true;
            }))),
        },
        campagneInventaire: { findFirst: jest.fn().mockResolvedValue(null) },
        tiersCompte: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(mandats
                .filter((m) => m.tenantId === where.tenantId && (where.finAnticipeeLe !== null || m.finAnticipeeLe === null))
                .sort((a, b) => b.premierExercice - a.premierExercice))),
        },
        ribBanque: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve([
                { tenantId: 't1', numeroCompte: '00011-0123456-78', iban: null, banque: { intitule: 'RAWBANK' } },
                { tenantId: 't1', numeroCompte: null, iban: 'CD0800011000123456789', banque: { intitule: 'EQUITY BCDC' } },
                { tenantId: 'autre', numeroCompte: '999', iban: null, banque: { intitule: 'VOISINE' } },
            ]
                .filter((r) => r.tenantId === where.tenantId)
                .map(({ tenantId: _t, ...r }) => r))),
        },
    };
    const syscohada = new etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService(ecritureService, exerciceService);
    const smtSyscohada = new etats_financiers_smt_syscohada_service_1.EtatsFinanciersSmtSyscohadaService(ecritureService, exerciceService, prisma);
    const notes = new note_annexe_service_1.NoteAnnexeService(ecritureService, exerciceService, prisma, {
        executionBudgetaire: jest.fn(),
    }, { bilan: jest.fn(), compteDeResultat: jest.fn(), tableauFluxTresorerie: jest.fn() });
    return new export_service_1.ExportService(prisma, ecritureService, {}, {}, {}, {}, notes, {}, {}, {}, syscohada, smtSyscohada);
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
function rangsParRef(ws) {
    const rangs = new Map();
    ws.eachRow((row, n) => {
        const ref = row.getCell(1).value;
        if (typeof ref === 'string' && /^[A-Z]{2}$/.test(ref) && !rangs.has(ref))
            rangs.set(ref, n);
    });
    return rangs;
}
function formuleDe(cell) {
    return cell.value?.formula ?? '';
}
function texteFeuille(wb, nom) {
    const t = [];
    wb.getWorksheet(nom).eachRow((row) => row.eachCell((c) => t.push(String(c.value ?? ''))));
    return t;
}
describe('exports SYSCOHADA individuels · charte ETAFI, état seul en valeurs', () => {
    it('le bilan tient sur Bilan-Actif et Bilan-Passif, cartouche, palette et renvois du ch. 3', async () => {
        const { buffer, nomFichier } = await fabriquerExport().bilanSyscohadaExcel('t1', 'e1');
        expect(nomFichier).toBe('bilan-syscohada-2026.xlsx');
        const wb = await ouvrir(buffer);
        expect(wb.worksheets.map((w) => w.name)).toEqual(['Bilan-Actif', 'Bilan-Passif']);
        const actif = wb.getWorksheet('Bilan-Actif');
        expect(actif.getCell('A3').value).toBe('Dénomination sociale : SARL BATIMAT');
        expect(String(actif.getCell('A5').value)).toContain("N° d'identification fiscale (NIF) : A0900123X");
        expect(actif.getCell('B7').value).toBe('BILAN AU 31 DECEMBRE N');
        expect(actif.getCell('B7').font?.name).toBe('Arial Black');
        expect(actif.getCell('B7').font?.color?.argb).toBe('FF008000');
        expect(fondDe(actif.getCell('A8'))).toBe('FFCCFFFF');
        expect(actif.getCell('D9').value).toBe('BRUT');
        expect(actif.getCell('E9').value).toBe('AMORT. et DEPREC.');
        expect(actif.getCell('G9').value).toBe('NET');
        const ra = rangsParRef(actif);
        expect([...ra.keys()]).toEqual([
            'AD', 'AE', 'AF', 'AG', 'AH',
            'AI', 'AJ', 'AK', 'AL', 'AM', 'AN',
            'AP', 'AQ', 'AR', 'AS', 'AZ',
            'BA', 'BB', 'BG', 'BH', 'BI', 'BJ', 'BK',
            'BQ', 'BR', 'BS', 'BT', 'BU', 'BZ',
        ]);
        expect(actif.getCell(ra.get('AD'), 3).value).toBe('3');
        expect(actif.getCell(ra.get('BS'), 3).value).toBe('11');
        expect(formuleDe(actif.getCell(ra.get('AM'), 6))).toBe(`D${ra.get('AM')}-E${ra.get('AM')}`);
        expect(formuleDe(actif.getCell(ra.get('AZ'), 6))).toBe(`F${ra.get('AD')}+F${ra.get('AI')}+F${ra.get('AP')}+F${ra.get('AQ')}`);
        expect(fondDe(actif.getCell(ra.get('BZ'), 2))).toBe('FF000080');
        expect(fondDe(actif.getCell(ra.get('BZ'), 1))).toBe('');
        expect(actif.getCell(ra.get('AM'), 4).value).toBe(750_000);
        expect(actif.getCell(ra.get('AM'), 5).value).toBe(150_000);
        const passif = wb.getWorksheet('Bilan-Passif');
        const rp = rangsParRef(passif);
        expect(passif.getCell(rp.get('CJ'), 4).value).toBe(260_000);
        expect(passif.getCell(rp.get('CE'), 3).value).toBe('3e');
        expect(formuleDe(passif.getCell(rp.get('DZ'), 4))).toBe(`D${rp.get('DF')}+D${rp.get('DP')}+D${rp.get('DT')}+D${rp.get('DV')}`);
    });
    it('le compte de résultat suit la convention de signe du ch. 4 · les soldes sont des SOMMES', async () => {
        const { buffer } = await fabriquerExport().compteDeResultatSyscohadaExcel('t1', 'e1');
        const ws = (await ouvrir(buffer)).getWorksheet('Résultat');
        const r = rangsParRef(ws);
        expect(r.has('TA')).toBe(true);
        expect(r.has('XI')).toBe(true);
        expect(ws.getCell(r.get('RA'), 4).value).toBe(-190_000);
        expect(ws.getCell(r.get('RK'), 4).value).toBe(-120_000);
        expect(ws.getCell(r.get('TA'), 4).value).toBe(620_000);
        expect(formuleDe(ws.getCell(r.get('XA'), 4))).toBe(`D${r.get('TA')}+D${r.get('RA')}+D${r.get('RB')}`);
        expect(formuleDe(ws.getCell(r.get('XD'), 4))).toBe(`D${r.get('XC')}+D${r.get('RK')}`);
        expect(formuleDe(ws.getCell(r.get('XE'), 4))).toBe(`D${r.get('XD')}+D${r.get('TJ')}+D${r.get('RL')}+0+0`);
        expect(formuleDe(ws.getCell(r.get('XI'), 4))).toBe(`D${r.get('XG')}+D${r.get('XH')}+D${r.get('RQ')}+D${r.get('RS')}`);
        expect(ws.getCell(r.get('XA'), 2).value).toBe('MARGE COMMERCIALE (Somme TA à RB)');
        expect(ws.getCell(r.get('RK'), 3).value).toBe('27A et 27B');
        expect(ws.getCell(r.get('RL'), 3).value).toBe('3C et 28');
        expect(fondDe(ws.getCell(r.get('XI'), 2))).toBe('FF000080');
    });
    it('le contrôle sous le bilan nomme un compte à solder à la clôture, avec sa fiche (audit final F92)', async () => {
        const exportService = fabriquerExport();
        const syscohada = exportService.syscohada;
        const reel = syscohada.bilan.bind(syscohada);
        syscohada.bilan = async (t, e) => ({
            ...(await reel(t, e)),
            comptesASolderALaCloture: [{ numero: '10410000', intitule: 'Apports temporaires', montant: 300, source: 'Titre VII COMPTE 104' }],
        });
        const wb = await ouvrir((await exportService.bilanSyscohadaExcel('t1', 'e1')).buffer);
        expect(texteFeuille(wb, 'Bilan-Actif').join(' ')).toContain('Comptes à solder à la clôture portant un solde : 10410000 (Titre VII COMPTE 104).');
    });
    it('RQP, quand il est servi, garde sa colonne REF vide et entre dans XE (audit final F89)', async () => {
        const exportService = fabriquerExport();
        const syscohada = exportService
            .syscohada;
        const reel = syscohada.compteDeResultat.bind(syscohada);
        syscohada.compteDeResultat = async (t, e) => {
            const cr = await reel(t, e);
            const i = cr.lignes.findIndex((l) => l.ref === 'XE');
            cr.lignes.splice(i, 0, { ref: 'RQP', libelle: 'Quote-part de résultat partagé', montant: -400, comptes: [], notes: [] });
            return cr;
        };
        const ws = (await ouvrir((await exportService.compteDeResultatSyscohadaExcel('t1', 'e1')).buffer)).getWorksheet('Résultat');
        let rangRqp = 0;
        ws.eachRow((row, n) => {
            if (row.getCell(2).value === 'Quote-part de résultat partagé')
                rangRqp = n;
        });
        expect(rangRqp).toBeGreaterThan(0);
        expect(ws.getCell(rangRqp, 1).value ?? '').toBe('');
        const r = rangsParRef(ws);
        expect(formuleDe(ws.getCell(r.get('XE'), 4))).toBe(`D${r.get('XD')}+D${r.get('TJ')}+D${r.get('RL')}+D${rangRqp}+0`);
    });
    it('le TFT porte les clés A à H du modèle, ses bandes de sections et ses totaux en formules', async () => {
        const { buffer } = await fabriquerExport().tableauFluxTresorerieSyscohadaExcel('t1', 'e1');
        const ws = (await ouvrir(buffer)).getWorksheet('TFT');
        const r = rangsParRef(ws);
        expect(ws.getCell(8, 6).value).toBe('Clé');
        for (const [ref, cle] of [
            ['ZA', 'A'],
            ['ZB', 'B'],
            ['ZC', 'C'],
            ['ZD', 'D'],
            ['ZE', 'E'],
            ['ZF', 'F'],
            ['ZG', 'G'],
            ['ZH', 'H'],
        ]) {
            expect(ws.getCell(r.get(ref), 6).value).toBe(cle);
        }
        expect(formuleDe(ws.getCell(r.get('ZB'), 4))).toBe(`D${r.get('FA')}+D${r.get('FB')}+D${r.get('FC')}+D${r.get('FD')}+D${r.get('FE')}`);
        expect(formuleDe(ws.getCell(r.get('ZF'), 4))).toBe(`D${r.get('ZD')}+D${r.get('ZE')}`);
        expect(formuleDe(ws.getCell(r.get('ZH'), 4))).toBe(`D${r.get('ZG')}+D${r.get('ZA')}`);
        expect([typeof ws.getCell(r.get('ZA'), 5).value, typeof ws.getCell(r.get('FA'), 5).value]).toEqual(['number', 'number']);
        expect(fondDe(ws.getCell(r.get('ZH'), 2))).toBe('FF003366');
        let bandes = 0;
        ws.eachRow((row) => {
            if (fondDe(row.getCell(2)) === 'FFC0C0C0' && row.getCell(1).value == null)
                bandes += 1;
        });
        expect(bandes).toBeGreaterThanOrEqual(4);
    });
});
describe('liasse complète · Système normal SYSCOHADA', () => {
    it('le contrôle du TFT nomme les comptes tenus sans la subdivision que le tableau lit', () => {
        const message = fabriquerExport().controlesTftSyscohada({
            controle: { coherent: false, tresorerieClotureParFlux: 1, tresorerieClotureParBilan: 2, ecart: 1 },
            comptesNonVentiles: [],
            postesNonCalculables: [],
            comptesTropAgreges: [{ numero: '48100000', intitule: 'x', montant: -5000, subdivisions: ['4811', '4812'] }],
        });
        expect(message).toContain('1 compte(s) tenu(s) sans la subdivision que le tableau lit : 48100000 (lu en 4811, 4812).');
    });
    it('reproduit le classeur du modèle, ses 36 notes et ses recoupements', async () => {
        const { buffer, nomFichier } = await fabriquerExport().liasseCompleteExcel('t1', 'e1');
        expect(nomFichier).toBe('liasse-complete-2026.xlsx');
        const wb = await ouvrir(buffer);
        const noms = wb.worksheets.map((w) => w.name);
        expect(noms.slice(0, 14)).toEqual([
            'BALANCE N',
            'BALANCE N-1',
            'CONTROLE BALANCE',
            'Couverture',
            'Garde',
            'Fiche 1',
            'Fiche R2',
            'Fiche 2',
            'Bilan paysage',
            'Bilan-Actif',
            'Bilan-Passif',
            'Résultat',
            'TFT',
            'NOTES ANNEXES',
        ]);
        expect(noms.slice(-3)).toEqual(['TABLE COMMENTAIRE', 'CONTROLES', 'ANOMALIES']);
        const feuillesNotes = noms.slice(14, -3);
        expect(new Set(feuillesNotes).size).toBe(feuillesNotes.length);
        expect(feuillesNotes).toEqual(correspondance_compte_resultat_syscohada_1.CODES_NOTES_CH6.map((c) => `NOTE ${c}`));
        expect(feuillesNotes).toContain('NOTE 16B bis');
        const avecNeant = feuillesNotes.filter((n) => texteFeuille(wb, n).includes('NEANT'));
        const sansNeant = feuillesNotes.filter((n) => !texteFeuille(wb, n).includes('NEANT'));
        expect(avecNeant.length).toBeGreaterThan(0);
        expect(sansNeant.length).toBeGreaterThan(0);
        expect(avecNeant).toEqual(expect.arrayContaining(['NOTE 32', 'NOTE 35']));
        expect(sansNeant).toContain('NOTE 2');
        const numeros = (l) => l.map((x) => x.numero);
        expect((0, relecture_balances_liasse_1.defautsDeFeuilleBalance)(wb, theme_etafi_1.NOM_BALANCE, numeros(BALANCE_N), 'Mouvements au 31/12/25', presentation_fpm_1.FOND_ENTETE_FPM)).toEqual([]);
        expect((0, relecture_balances_liasse_1.defautsDeFeuilleBalance)(wb, theme_etafi_1.NOM_BALANCE_N1, numeros(BALANCE_N1), 'Mouvements au 31/12/24', presentation_fpm_1.FOND_ENTETE_FPM)).toEqual([]);
        expect(formuleDe(wb.getWorksheet('Bilan paysage').getCell(10, 4))).toBe("'Bilan-Actif'!D10");
        const fiche1 = wb.getWorksheet('Fiche 1');
        let ze = '';
        fiche1.eachRow((row) => {
            if (row.getCell(1).value === 'ZE')
                ze = String(row.getCell(7).value ?? '');
        });
        expect(ze).toBe('CD/KIN/RCCM/22-B-01234');
        expect(String(fiche1.getCell(8, 1).value)).toBe('SYSCOHADA - Système normal');
        const garde = wb.getWorksheet('Garde');
        expect(String(garde.getCell(12, 2).value)).toContain('SYSTEME COMPTABLE OHADA (SYSCOHADA)');
        expect(String(garde.getCell(32, 2).value)).toBe('SYSTEME NORMAL');
        expect(texteFeuille(wb, 'Garde')).toContain('Tableau des flux de trésorerie');
        expect(texteFeuille(wb, 'Couverture')).toContain('LIASSE SYSTEME NORMAL');
        const ctl = wb.getWorksheet('CONTROLES');
        expect(formuleDe(ctl.getCell(2, 2))).toMatch(/^SUM\('BALANCE N'!G10:G\d+\)$/);
        const libelles = [];
        ctl.eachRow((row) => libelles.push(String(row.getCell(1).value ?? '')));
        expect(libelles).toContain('Écart de bouclage du TFT (doit être 0)');
        expect(libelles).toContain('Résultat net logé au bilan (CJ)');
        const valeurDe = (libelle) => ctl.getCell(libelles.indexOf(libelle) + 1, 2);
        for (const libelle of [
            'TOTAL GÉNÉRAL actif net (BZ)',
            'TOTAL GÉNÉRAL passif (DZ)',
            'RÉSULTAT NET du compte de résultat (XI)',
            'Résultat net logé au bilan (CJ)',
            'Écart résultat CR / bilan (doit être 0)',
        ]) {
            expect([libelle, formuleDe(valeurDe(libelle))]).toEqual([libelle, expect.stringMatching(/!|^B\d/)]);
        }
        const gravites = [];
        wb.getWorksheet('ANOMALIES').eachRow((row, n) => {
            if (n > 1)
                gravites.push(String(row.getCell(1).value ?? ''));
        });
        expect(gravites).not.toContain('BLOQUANT');
        expect(gravites).not.toContain('A_TRAITER');
        expect(gravites).toContain('INFO');
        const etats = [];
        wb.getWorksheet('ANOMALIES').eachRow((row) => etats.push(String(row.getCell(3).value ?? '')));
        expect(etats).not.toContain('Tableau des flux · colonne N-1');
        expect(fiche1.getCell('A1').value).toMatch(/^- \d+ -$/);
        if (process.env.LIASSE_SYSCOHADA_DEBUG_SORTIE)
            (0, fs_1.writeFileSync)(process.env.LIASSE_SYSCOHADA_DEBUG_SORTIE, buffer);
    });
});
describe('Paquet 1, relecture M1 · TFT SYSCOHADA dont le contrôle n’est pas effectué', () => {
    const MOTIF = "Le premier jour de l'exercice porte une position de bilan passée en opérations diverses (OD n° 1)";
    const MOTIF_CONTROLE = 'Contrôle non effectué · la trésorerie d’ouverture (ZA) et la variation de la trésorerie (ZG) sont laissées vides.';
    const VIDES = ['ZA', 'FK', 'ZD', 'ZF', 'ZG', 'ZH'];
    const nonControlable = () => {
        const exportService = fabriquerExport();
        const etats = exportService.syscohada;
        const reel = etats.tableauFluxTresorerie.bind(etats);
        jest.spyOn(etats, 'tableauFluxTresorerie').mockImplementation(async (t, e) => {
            const tft = await reel(t, e);
            return {
                ...tft,
                postesVides: VIDES,
                postesNonCalculables: VIDES.map((ref) => ({ ref, raison: MOTIF, aLever: true })),
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
    const rangDe = (ws, ref) => {
        let rang = 0;
        ws.eachRow((row, n) => {
            if (n > 8 && row.getCell(1).value === ref)
                rang = n;
        });
        return rang;
    };
    it('les postes vides restent des cellules vides en colonne N, leurs totaux sans formule', async () => {
        const { buffer } = await nonControlable().tableauFluxTresorerieSyscohadaExcel('t1', 'e1');
        const ws = (await ouvrir(buffer)).getWorksheet('TFT');
        for (const ref of VIDES)
            expect(ws.getCell(rangDe(ws, ref), 4).value ?? null).toBeNull();
        expect(ws.getCell(rangDe(ws, 'FA'), 4).value).not.toBeNull();
    });
    it('l’export du seul tableau écrit sous l’état le motif des postes vides, une ligne par motif (relecture M2)', async () => {
        const { buffer } = await nonControlable().tableauFluxTresorerieSyscohadaExcel('t1', 'e1');
        const textes = [];
        (await ouvrir(buffer)).getWorksheet('TFT').eachRow((row) => row.eachCell((c) => textes.push(String(c.value ?? ''))));
        expect(textes.filter((t) => t.startsWith('Exercice N · '))).toEqual([`Exercice N · ${VIDES.join(', ')} · ${MOTIF}`]);
    });
    it('l’export du seul tableau dit le motif du contrôle, jamais un écart chiffré', async () => {
        const { buffer } = await nonControlable().tableauFluxTresorerieSyscohadaExcel('t1', 'e1');
        const textes = [];
        (await ouvrir(buffer)).getWorksheet('TFT').eachRow((row) => row.eachCell((c) => textes.push(String(c.value ?? ''))));
        expect(textes.some((t) => t.startsWith(MOTIF_CONTROLE))).toBe(true);
        expect(textes.some((t) => /diffère de BT - DT/.test(t))).toBe(false);
    });
    it('la liasse · aucune anomalie « à traiter » sur ZH, et CONTROLES ne juge aucune ligne du tableau à zéro', async () => {
        const wb = await ouvrir((await nonControlable().liasseCompleteExcel('t1', 'e1')).buffer);
        const anomalies = [];
        wb.getWorksheet('ANOMALIES').eachRow((row) => anomalies.push([1, 2, 3, 4].map((c) => String(row.getCell(c).value ?? ''))));
        expect(anomalies.filter((l) => l[0] === 'A_TRAITER' && l[1] === 'ZH')).toEqual([]);
        expect(anomalies).toContainEqual(['INFO', 'ZH', 'Tableau des flux de trésorerie', MOTIF_CONTROLE]);
        const lignesTft = [];
        wb.getWorksheet('CONTROLES').eachRow((row, n) => {
            if (n > 1 && /TFT/.test(String(row.getCell(1).value ?? '')))
                lignesTft.push({ valeur: row.getCell(2).value, attendu: row.getCell(3).value });
        });
        expect(lignesTft.length).toBe(2);
        for (const l of lignesTft)
            expect({ attendu: l.attendu, texte: typeof l.valeur }).toEqual({ attendu: '', texte: 'string' });
    });
    it('relecture m3 · les postes vidés par l’OD sont « à vérifier » et renvoient au geste du motif, jamais « Aucune action »', async () => {
        const wb = await ouvrir((await nonControlable().liasseCompleteExcel('t1', 'e1')).buffer);
        const anomalies = [];
        wb.getWorksheet('ANOMALIES').eachRow((row) => anomalies.push([1, 2, 3, 4, 5].map((c) => String(row.getCell(c).value ?? ''))));
        const auMotif = anomalies.filter((l) => l[3] === MOTIF);
        expect(auMotif.map((l) => l[1])).toEqual(VIDES);
        for (const l of auMotif) {
            expect(l[0]).toBe('A_VERIFIER');
            expect(l[4]).toMatch(/^Suivre l’issue que le motif nomme/);
        }
        expect(anomalies.filter((l) => /^Aucune action si la provenance est la bonne/.test(l[4]))).toEqual([]);
    });
});
describe('liasse complète · Système minimal de trésorerie SYSCOHADA', () => {
    it('reproduit le classeur du Titre X · pas de TFT, notes 1 à 4, résultat G = C - D + E - F', async () => {
        const exportService = fabriquerExport(client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE);
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
            'NOTE 1 MATERIEL-CAUTIONS',
            'NOTE 2 STOCKS',
            'NOTE 3 CREANCES-DETTES',
            'NOTE 4 JOURNAL TRESORERIE',
            'JOURNAUX DE SUIVI',
            'TABLE COMMENTAIRE',
            'CONTROLES',
            'ANOMALIES',
        ]);
        expect(noms).not.toContain('TFT');
        expect(String(wb.getWorksheet('Garde').getCell(32, 2).value)).toBe('SYSTEME MINIMAL DE TRESORERIE');
        const actif = wb.getWorksheet('Bilan-Actif');
        expect(actif.getCell(8, 1).value).toBe('ACTIF');
        expect(actif.getCell(9, 1).value).toBe('Immobilisations (1)');
        let rangTotalActif = 0;
        actif.eachRow((row, n) => {
            if (row.getCell(1).value === 'Total actif')
                rangTotalActif = n;
        });
        expect(formuleDe(actif.getCell(rangTotalActif, 3))).toBe(`SUM(C9:C${rangTotalActif - 1})`);
        const cr = wb.getWorksheet('Résultat');
        const rangs = new Map();
        cr.eachRow((row, n) => {
            const v = row.getCell(1).value;
            if (typeof v === 'string')
                rangs.set(v, n);
        });
        const rA = rangs.get('TOTAL DES RECETTES SUR PRODUITS');
        const rB = rangs.get('TOTAL DÉPENSES SUR CHARGES');
        const rC = rangs.get('SOLDE : Excédent (+) ou insuffisance (–) de recettes (C = A – B)');
        const rG = rangs.get('RÉSULTAT EXERCICE (G = C – D + E – F)');
        expect(cr.getCell(rA, 5).value).toBe('A');
        expect(cr.getCell(rG, 5).value).toBe('G');
        expect(formuleDe(cr.getCell(rC, 3))).toBe(`C${rA}-C${rB}`);
        expect(formuleDe(cr.getCell(rG, 3))).toMatch(/^C\d+-\(C\d+\+C\d+\)\+\(C\d+\)-C\d+$/);
        const montants = [];
        cr.eachRow((row) => {
            const v = row.getCell(3).value;
            if (typeof v === 'number')
                montants.push(v);
        });
        expect(montants).toContain(300_000);
        expect(montants).toContain(120_000);
        const note4 = texteFeuille(wb, 'NOTE 4 JOURNAL TRESORERIE');
        expect(note4).toContain('Report à nouveau');
        expect(note4).toContain('Solde à reporter');
        expect(texteFeuille(wb, 'NOTE 2 STOCKS')).toContain('NEANT');
        const suivi = texteFeuille(wb, 'JOURNAUX DE SUIVI');
        expect(suivi).toContain('Journal de suivi des créances impayées SMT');
        expect(suivi).toContain('Date paiement');
        expect(suivi).toContain('NEANT');
        const ctlSmt = texteFeuille(wb, 'CONTROLES');
        expect(ctlSmt.some((t) => t.includes('Entités de négoce'))).toBe(true);
        expect(ctlSmt.some((t) => t.includes("ou l'équivalent dans l'unité monétaire"))).toBe(true);
    });
});
describe('feuille BALANCE de la liasse · exercice clos', () => {
    it('rend les comptes de gestion avant leur solde, et retire le 13 que seule la clôture a mouvementé', async () => {
        const charge = {
            ...ligne('60110000', 'Achats', client_1.ClasseCompte.CLASSE_6, 0, 0, 3000, 0),
            clotureCredit: 3000,
            totalCredit: 3000,
            solde: 0,
        };
        const resultat = {
            ...ligne('13900000', 'Résultat net : perte', client_1.ClasseCompte.CLASSE_1, 0, 0, 0, 0),
            clotureDebit: 3000,
            totalDebit: 3000,
            solde: 3000,
        };
        const service = fabriquerExport();
        service.ecritureService.balance = jest
            .fn()
            .mockResolvedValue({ lignes: [charge, resultat] });
        const bal = await service.lignesBalanceLiasse('t1', 'e1');
        expect(bal.lignes.map((l) => l.numero)).toEqual(['60110000']);
        const [l] = bal.lignes;
        expect({
            avantDebit: l.avantDebit,
            avantCredit: l.avantCredit,
            mouvementDebit: l.mouvementDebit,
            mouvementCredit: l.mouvementCredit,
            solde: l.totalDebit - l.totalCredit,
        }).toEqual({ avantDebit: 0, avantCredit: 0, mouvementDebit: 3000, mouvementCredit: 0, solde: 3000 });
        expect(bal.mention).toBe("Avant l'écriture qui solde les comptes de gestion · livre-journal seul");
    });
});
describe('Fiche 1 de la liasse SYSCOHADA · ce que le dossier sait', () => {
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
    ])('ZA porte les dates exactes d’un premier exercice %s (AUDCIF art. 7)', async (_nom, debut, attendu) => {
        for (const systeme of [client_1.SystemeComptableSyscohada.NORMAL, client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE]) {
            const wb = await avec({ dateDebut: new Date(`${debut}T00:00:00Z`) }, {}, async () => ouvrir((await fabriquerExport(systeme).liasseCompleteExcel('t1', 'e1')).buffer));
            expect(caseFiche1(wb, 'ZA')).toBe(attendu);
        }
    });
    it('préremplit ZB, ZC, ZD, ZG, ZK, ZM et le code activité en ZI, dans les deux liasses', async () => {
        for (const systeme of [client_1.SystemeComptableSyscohada.NORMAL, client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE]) {
            const wb = await avec({ dateArreteComptes: new Date('2027-03-15T00:00:00Z') }, {
                numeroAffiliationCnssEmployeur: 'CNSS-0042',
                telephone: '+243 81 000 00 00',
                email: 'contact@batimat.cd',
                ville: 'Kinshasa',
                activite: 'Travaux de construction',
                codeActivitePrincipale: '030000',
            }, async () => ouvrir((await fabriquerExport(systeme).liasseCompleteExcel('t1', 'e1')).buffer));
            expect(caseFiche1(wb, 'ZB')).toBe('15/03/2027');
            expect(caseFiche1(wb, 'ZC')).toBe('31/12/2025');
            expect(caseFiche1(wb, 'ZD')).toBe('12');
            expect(caseFiche1(wb, 'ZG')).toBe('CNSS-0042');
            expect(caseFiche1(wb, 'ZK')).toBe('+243 81 000 00 00 · contact@batimat.cd · Kinshasa');
            expect(caseFiche1(wb, 'ZM')).toBe('Travaux de construction');
            expect(caseFiche1(wb, 'ZI')).toBe('030000');
            expect(caseFiche1(wb, 'ZE')).toBe('CD/KIN/RCCM/22-B-01234');
        }
    });
    it('la NOTE 36 imprimée nomme les codes par leur fiche de l’AUDCIF, et la case ZI de la Fiche 1', async () => {
        const wb = await ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer);
        const texte = texteFeuille(wb, 'NOTE 36').join(' ');
        expect(texte).toContain('fiche R2 : ZK forme juridique');
        expect(texte).toContain('ZI');
    });
    it('sans exercice précédent ni arrêté, ZC et ZD restent vides et ZB le dit', async () => {
        const e0 = EXERCICES.splice(1, 1);
        try {
            const wb = await ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer);
            expect(caseFiche1(wb, 'ZC')).toBe('');
            expect(caseFiche1(wb, 'ZD')).toBe('');
            expect(caseFiche1(wb, 'ZB')).toBe('Non renseignée');
            expect(caseFiche1(wb, 'ZI')).toBe('');
        }
        finally {
            EXERCICES.push(...e0);
        }
    });
});
describe('NOTE 1 · les sûretés réelles saisies sortent dans la liasse (passe O3, constat A1/D1)', () => {
    it('la sûreté écrite sur une ligne de dette chiffrée sort dans SA colonne, à côté du montant calculé', async () => {
        const exportService = fabriquerExport(client_1.SystemeComptableSyscohada.NORMAL, [
            { exerciceId: 'e1', codeNote: '1', cleRubrique: 'dettes-garanties-fournisseurs', colonne: 4, valeurTexte: 'Gage sur stock' },
            { exerciceId: 'e0', codeNote: '1', cleRubrique: 'dettes-garanties-fournisseurs', colonne: 2, valeurTexte: 'Hypothèque 2025' },
        ]);
        const wb = await ouvrir((await exportService.notesSyscohadaExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('NOTE 1');
        let rang = 0;
        ws.eachRow((row, n) => {
            if (row.getCell(1).value === 'Fournisseurs et comptes rattachés' && rang === 0)
                rang = n;
        });
        expect(rang).toBeGreaterThan(0);
        const ligneDette = ws.getRow(rang);
        expect(ligneDette.getCell(3).value).toBe(45_000);
        expect(ligneDette.getCell(6).value).toBe('Gage sur stock');
        expect(ligneDette.getCell(4).value).toBeNull();
        expect(ligneDette.getCell(2).value).toBe('17');
    });
});
describe('Passe R2 · liasse SYSCOHADA et Titre IX ch. 2', () => {
    it('A1 · la fiche R4 porte en pied le renvoi (1) de l’AUDCIF, pas celui du SYCEBNL', async () => {
        for (const buffer of [
            (await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer,
            (await fabriquerExport().notesSyscohadaExcel('t1', 'e1')).buffer,
        ]) {
            const texte = texteFeuille(await ouvrir(buffer), 'NOTES ANNEXES');
            expect(texte).toContain('(1) Les Notes non documentées ne doivent pas être jointes aux états financiers. Leur contenu peut être amélioré par les entités.');
        }
    });
});
describe('Passe R2, C2 · l’écart de G se décompose comme à l’écran', () => {
    it('nomme les écritures sans trésorerie, jamais les flux hors résultat qui ne participent pas à l’écart', () => {
        const texte = fabriquerExport().decompositionEcartSmtSyscohada({
            residuel: 0,
            composantesEcart: { classe1: 0, classe2: 320_000, depreciationsTresorerie: 0, autresComptes: 0, dotations: 0 },
        });
        expect(texte).toContain('investissement enregistré sans passer par la trésorerie 320');
        expect(texte).toContain('résiduel 0.');
    });
    it('la feuille ANOMALIES et l’export du compte de résultat appellent cette décomposition', () => {
        const source = require('fs').readFileSync(require('path').join(__dirname, 'export.service.ts'), 'utf8');
        expect(source.match(/this\.decompositionEcartSmtSyscohada\(cr\.controle\)/g)?.length).toBe(2);
    });
});
describe('Passe R2, A2 · l’unité monétaire sur chaque page de la liasse', () => {
    it('le cartouche de Bilan-Actif, Résultat, TFT et des notes porte « Montants en CDF », sans écraser la date d’arrêté', async () => {
        const wb = await ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer);
        for (const nom of ['Bilan-Actif', 'Bilan-Passif', 'Résultat', 'TFT', 'NOTES ANNEXES', 'NOTE 1']) {
            const ligne6 = [];
            wb.getWorksheet(nom).getRow(6).eachCell((c) => ligne6.push(String(c.value ?? '')));
            expect({ nom, monnaie: ligne6.some((t) => t.includes('Montants en CDF')) }).toEqual({ nom, monnaie: true });
            expect({ nom, arrete: ligne6.some((t) => t.includes("Date d'arrêté des comptes non renseignée")) }).toEqual({
                nom,
                arrete: true,
            });
        }
    });
});
describe('Passe R2, A2 · page étroite', () => {
    it('sur trois colonnes, la monnaie suit la date d’arrêté dans la même cellule, jamais par-dessus', () => {
        const { ecrireCartouche } = require('./theme-etafi');
        const ws = new ExcelJS.Workbook().addWorksheet('X');
        ecrireCartouche(ws, { entite: 'E', nif: '', exercice: '2026', dateDebut: '', dateFin: '', duree: '12', adresse: '', sigle: '', ntd: '', dateArrete: '15/03/2027', monnaie: 'CDF' }, 'P', 3);
        expect(String(ws.getCell(6, 3).value)).toBe('Comptes arrêtés le 15/03/2027 · Montants en CDF');
    });
});
describe('Passe R2, A4 et A5 · Fiche 2 et page de garde du Système normal SYSCOHADA', () => {
    it('A4 · la Fiche 2 porte les deux blocs de la fiche R3 et le renvoi (1) qui définit les dirigeants', async () => {
        const wb = await ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer);
        const texte = texteFeuille(wb, 'Fiche 2');
        expect(texte).toContain('DIRIGEANTS (1)');
        expect(texte).toContain("MEMBRES DU CONSEIL D'ADMINISTRATION");
        expect(texte).toContain('(1) Dirigeants = Président Directeur Général, Directeur Général, Administrateur Général, Gérant, Autres.');
    });
    it('A5 · la page de garde porte les quatre mentions et la zone réservée à la DGI, rangs du bandeau inchangés', async () => {
        const wb = await ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer);
        const texte = texteFeuille(wb, 'Garde');
        for (const m of ['REPUBLIQUE', 'MINISTERE', 'DIRECTION', 'CENTRE DE DEPOT DE'])
            expect(texte).toContain(m);
        expect(texte).toContain('Réservé à la Direction Générale des Impôts');
        expect(texte).toContain("Nom de l'agent de la DGI ayant réceptionné le dépôt");
        const garde = wb.getWorksheet('Garde');
        expect(String(garde.getCell(12, 2).value)).toContain('SYSTEME COMPTABLE OHADA (SYSCOHADA)');
        expect(String(garde.getCell(32, 2).value)).toBe('SYSTEME NORMAL');
    });
    it('A5 · la garde du S.M.T SYSCOHADA ne reçoit pas la contexture du Titre IX', async () => {
        const wb = await ouvrir((await fabriquerExport(client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE).liasseCompleteExcel('t1', 'e1')).buffer);
        expect(texteFeuille(wb, 'Garde')).toContain("Réservé à l'administration");
    });
});
describe('Passe R2, A7 · domiciliations bancaires en case ZW', () => {
    it('la Fiche 1 du Système normal porte les RIB du dossier, banque et numéro ou IBAN', async () => {
        const wb = await ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer);
        let zw = '';
        wb.getWorksheet('Fiche 1').eachRow((row) => {
            if (row.getCell(1).value === 'ZW')
                zw = String(row.getCell(7).value ?? '');
        });
        expect(zw).toBe('RAWBANK 00011-0123456-78 · EQUITY BCDC CD0800011000123456789');
    });
});
describe('Passe R6, E15 · NOTE 1 du S.M.T SYSCOHADA dans le classeur', () => {
    it('le total ne porte que les biens détenus, le bien sorti dans l’exercice est présenté à part', async () => {
        const exportService = fabriquerExport(client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE, [], [
            { designation: 'Vitrine', valeurOrigine: 400_000, compteImmobilisationId: 'id-24440000', dateAcquisition: new Date('2025-03-01'), dateSortie: null, prixCession: null },
            { designation: 'Balance cédée', valeurOrigine: 150_000, compteImmobilisationId: 'id-24440000', dateAcquisition: new Date('2024-03-01'), dateSortie: new Date('2026-05-31'), prixCession: 60_000 },
        ]);
        const wb = await ouvrir((await exportService.notesSmtSyscohadaExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('NOTE 1 MATERIEL-CAUTIONS');
        let rangTotal = 0;
        let rangSorties = 0;
        let rangCede = 0;
        ws.eachRow((row, n) => {
            if (row.getCell(2).value === 'TOTAL DES BIENS DÉTENUS À LA CLÔTURE')
                rangTotal = n;
            if (row.getCell(1).value === "Biens sortis pendant l'exercice · hors du total")
                rangSorties = n;
            if (row.getCell(2).value === 'Balance cédée')
                rangCede = n;
        });
        expect(ws.getCell(rangTotal, 3).value).toBe(400_000);
        expect(rangSorties).toBeGreaterThan(rangTotal);
        expect(rangCede).toBeGreaterThan(rangSorties);
        expect(ws.getCell(rangCede, 5).value).toBe(60_000);
        expect(texteFeuille(wb, 'NOTE 1 MATERIEL-CAUTIONS').join(' ')).toContain('Fiche sans solde au compte : Vitrine');
    });
});
describe('Passe D3, A2 · commissaire aux comptes en case ZR de la Fiche 1', () => {
    const caseFiche = async (mandats) => {
        const wb = await ouvrir((await fabriquerExport(client_1.SystemeComptableSyscohada.NORMAL, [], [], mandats).liasseCompleteExcel('t1', 'e1')).buffer);
        let zr = '';
        wb.getWorksheet('Fiche 1').eachRow((row) => {
            if (row.getCell(1).value === 'ZR')
                zr = String(row.getCell(7).value ?? '');
        });
        return zr;
    };
    it('préremplit le mandat qui couvre l’exercice, jamais un mandat échu, terminé ou d’un autre dossier', async () => {
        const zr = await caseFiche([
            { tenantId: 't1', nom: 'Cabinet Ancien', inscriptionOrdre: 'ONEC-001', premierExercice: 2020, nombreExercices: 3, finAnticipeeLe: null },
            { tenantId: 't1', nom: 'Cabinet Révoqué', inscriptionOrdre: 'ONEC-009', premierExercice: 2026, nombreExercices: 3, finAnticipeeLe: new Date('2026-04-01') },
            { tenantId: 't1', nom: 'Cabinet Kasongo', inscriptionOrdre: 'ONEC-042', premierExercice: 2025, nombreExercices: 3, finAnticipeeLe: null },
            { tenantId: 'autre', nom: 'Voisin', inscriptionOrdre: 'ONEC-777', premierExercice: 2026, nombreExercices: 6, finAnticipeeLe: null },
        ]);
        expect(zr).toBe("Cabinet Kasongo · inscription à l'Ordre : ONEC-042");
    });
    it('sans mandat couvrant, la case reste vide', async () => {
        expect(await caseFiche([{ tenantId: 't1', nom: 'Cabinet Ancien', inscriptionOrdre: 'ONEC-001', premierExercice: 2020, nombreExercices: 3, finAnticipeeLe: null }])).toBe('');
    });
});
describe('Passe R2, C5 · la NOTE 4 du S.M.T SYSCOHADA est un journal mensuel', () => {
    it('un bloc par mois mouvementé, titré comme le texte, le report d’un mois étant le solde à reporter du précédent', async () => {
        const wb = await ouvrir((await fabriquerExport(client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE).notesSmtSyscohadaExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('NOTE 4 JOURNAL TRESORERIE');
        const rangs = (texte, col) => {
            const t = [];
            ws.eachRow((row, n) => {
                if (row.getCell(col).value === texte)
                    t.push(n);
            });
            return t;
        };
        const [mars] = rangs('Journal de trésorerie SMT · mois de mars Année 2026', 1);
        const [juin] = rangs('Journal de trésorerie SMT · mois de juin Année 2026', 1);
        expect(mars).toBeGreaterThan(0);
        expect(juin).toBeGreaterThan(mars);
        const reports = rangs('Report à nouveau', 2);
        const soldes = rangs('Solde à reporter', 2);
        expect(reports.length).toBe(2);
        expect(soldes.length).toBe(2);
        expect(ws.getCell(reports[0], 5).value).toBe(50_000);
        expect(formuleDe(ws.getCell(reports[1], 5))).toBe(`E${soldes[0]}`);
    });
});
describe('Passe R2, A3 et B6 · fiche R2 du Système normal SYSCOHADA', () => {
    const caseR2 = (wb, code) => {
        let v = '';
        wb.getWorksheet('Fiche R2').eachRow((row) => {
            if (row.getCell(1).value === code && !v)
                v = String(row.getCell(7).value ?? '');
        });
        return v;
    };
    it('lit ZK, ZL et ZM dans les rubriques en saisie de la NOTE 36, seul porteur des codes', async () => {
        const exportService = fabriquerExport(client_1.SystemeComptableSyscohada.NORMAL, [
            { exerciceId: 'e1', codeNote: '36', cleRubrique: '1-code-forme-juridique-1', colonne: 0, valeurTexte: '12' },
            { exerciceId: 'e1', codeNote: '36', cleRubrique: '2-code-regime-fiscal', colonne: 0, valeurTexte: '1' },
            { exerciceId: 'e1', codeNote: '36', cleRubrique: '3-code-pays-du-siege-social-2', colonne: 0, valeurTexte: '17' },
        ]);
        const wb = await ouvrir((await exportService.liasseCompleteExcel('t1', 'e1')).buffer);
        expect(caseR2(wb, 'ZK')).toBe('12');
        expect(caseR2(wb, 'ZL')).toBe('1');
        expect(caseR2(wb, 'ZM')).toBe('17');
    });
    it('non déclarés, rien n’est présumé · ZK proposé en clair pour une forme univoque, ZL et ZM non renseignés', async () => {
        const e = fabriquerExport();
        const prisma = e.prisma;
        prisma.tenant.findUniqueOrThrow.mockResolvedValue({ ...TENANT, formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
        const wb = await ouvrir((await e.liasseCompleteExcel('t1', 'e1')).buffer);
        expect(caseR2(wb, 'ZK')).toBe('Non renseigné · la NOTE 36 donne 02 (12 avec agrément prioritaire)');
        expect(caseR2(wb, 'ZL')).toBe('Non renseigné · à déclarer à la NOTE 36');
        const texte = texteFeuille(wb, 'Fiche R2');
        expect(texte).toContain("Contrôle de l'entreprise : entreprise sous contrôle privé national [texte officiel : code ZQ employé deux fois]");
        expect(texte).toContain('(3) Rayer la mention inutile (utiliser de préférence la VA).');
    });
    it('ZN à ZS · déclarés sur l’exercice, imprimés tels quels ; non déclarés, « Non renseignée », jamais zéro', async () => {
        const vides = await ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer);
        for (const code of ['ZN', 'ZO', 'ZP', 'ZQ', 'ZS'])
            expect(caseR2(vides, code)).toBe('Non renseignée');
        const e = fabriquerExport();
        const prisma = e.prisma;
        const origine = prisma.exercice.findFirst.getMockImplementation();
        prisma.exercice.findFirst.mockImplementation((args) => args?.select && 'controleEntreprise' in args.select
            ? Promise.resolve({
                nombreEtablissementsPays: 0,
                nombreEtablissementsHorsPays: 2,
                premiereAnneeExercicePays: 1998,
                controleEntreprise: 'PRIVE_NATIONAL',
            })
            : origine(args));
        const wb = await ouvrir((await e.liasseCompleteExcel('t1', 'e1')).buffer);
        expect(caseR2(wb, 'ZN')).toBe('0');
        expect(caseR2(wb, 'ZO')).toBe('2');
        expect(caseR2(wb, 'ZP')).toBe('1998');
        const zq = [];
        wb.getWorksheet('Fiche R2').eachRow((row) => {
            if (row.getCell(1).value === 'ZQ')
                zq.push(String(row.getCell(7).value ?? ''));
        });
        expect(zq).toEqual(['', 'X']);
        expect(caseR2(wb, 'ZS')).toBe('');
        expect(caseR2(wb, 'ZR')).toBe('');
    });
    it('NOTE 13 · trois apporteurs saisis en ressortent trois dans la liasse (lignes répétables, décision du 2026-10-04)', async () => {
        const A = 'apporteurs-une-ligne-par-apporteur-nom-et-prenom';
        const wb = await ouvrir((await fabriquerExport(client_1.SystemeComptableSyscohada.NORMAL, [
            { exerciceId: 'e1', codeNote: '13', cleRubrique: A, colonne: 0, valeurTexte: 'MUKENDI Jean' },
            { exerciceId: 'e1', codeNote: '13', cleRubrique: A, rang: 1, colonne: 0, valeurTexte: 'ILUNGA Paul' },
            { exerciceId: 'e1', codeNote: '13', cleRubrique: A, rang: 2, colonne: 0, valeurTexte: 'KABEYA Rose' },
        ]).liasseCompleteExcel('t1', 'e1')).buffer);
        const feuille = wb.worksheets.find((w) => /^NOTE 13\b/.test(w.name));
        const texte = texteFeuille(wb, feuille.name);
        for (const nom of ['MUKENDI Jean', 'ILUNGA Paul', 'KABEYA Rose']) {
            expect(texte.filter((t) => t === nom)).toHaveLength(1);
        }
        expect(texte.indexOf('MUKENDI Jean')).toBeLessThan(texte.indexOf('ILUNGA Paul'));
        expect(texte.indexOf('ILUNGA Paul')).toBeLessThan(texte.indexOf('KABEYA Rose'));
    });
    it('une SA n’est jamais codée d’office · 00 ou 01 dépend d’une participation publique que le dossier ne porte pas', async () => {
        const e = fabriquerExport();
        const prisma = e.prisma;
        prisma.tenant.findUniqueOrThrow.mockResolvedValue({ ...TENANT, formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });
        const wb = await ouvrir((await e.liasseCompleteExcel('t1', 'e1')).buffer);
        expect(caseR2(wb, 'ZK')).toBe('Non renseigné · à déclarer à la NOTE 36');
    });
    it('SA du portefeuille DÉCLARÉE · 00 proposé en clair (jamais imprimé comme déclaré) ; ZQ public proposé au-delà de 50 % de quote-part', async () => {
        const avec = async (tenant, controleEntreprise = null) => {
            const e = fabriquerExport();
            const prisma = e
                .prisma;
            prisma.tenant.findUniqueOrThrow.mockResolvedValue({ ...TENANT, ...tenant });
            const origine = prisma.exercice.findFirst.getMockImplementation();
            prisma.exercice.findFirst.mockImplementation((args) => args?.select && 'controleEntreprise' in args.select ? Promise.resolve({ controleEntreprise }) : origine(args));
            return ouvrir((await e.liasseCompleteExcel('t1', 'e1')).buffer);
        };
        const zq = (wb) => {
            const v = [];
            wb.getWorksheet('Fiche R2').eachRow((row) => {
                if (row.getCell(1).value === 'ZQ')
                    v.push(String(row.getCell(7).value ?? ''));
            });
            return v;
        };
        const sa = await avec({ formeJuridiqueSyscohada: 'SOCIETE_ANONYME', entreprisePortefeuilleEtat: true, quotePartEtatCapital: '60' });
        expect(caseR2(sa, 'ZK')).toBe('Non renseigné · la NOTE 36 donne 00 (10 avec agrément prioritaire) · SA à participation publique, entreprise du portefeuille de l’État déclarée');
        expect(zq(sa)).toEqual(['Non renseignée · contrôle public proposé (quote-part de l’État déclarée · 60 %)', 'Non renseignée']);
        const sarl = await avec({
            formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE',
            entreprisePortefeuilleEtat: true,
            quotePartEtatCapital: '50',
        });
        expect(caseR2(sarl, 'ZK')).toBe('Non renseigné · la NOTE 36 donne 02 (12 avec agrément prioritaire)');
        expect(zq(sarl)).toEqual(['Non renseignée', 'Non renseignée']);
        const declare = await avec({ formeJuridiqueSyscohada: 'SOCIETE_ANONYME', entreprisePortefeuilleEtat: true, quotePartEtatCapital: '80' }, 'PRIVE_ETRANGER');
        expect(zq(declare)).toEqual(['', '']);
        expect(caseR2(declare, 'ZS')).toBe('X');
        const nonDit = await avec({ formeJuridiqueSyscohada: 'SOCIETE_ANONYME', entreprisePortefeuilleEtat: null, quotePartEtatCapital: '80' });
        expect(caseR2(nonDit, 'ZK')).toBe('Non renseigné · à déclarer à la NOTE 36');
        expect(zq(nonDit)).toEqual(['Non renseignée', 'Non renseignée']);
        const saisi = fabriquerExport(client_1.SystemeComptableSyscohada.NORMAL, [
            { exerciceId: 'e1', codeNote: '36', cleRubrique: '1-code-forme-juridique-1', colonne: 0, valeurTexte: '01' },
        ]);
        const p = saisi.prisma;
        p.tenant.findUniqueOrThrow.mockResolvedValue({ ...TENANT, formeJuridiqueSyscohada: 'SOCIETE_ANONYME', entreprisePortefeuilleEtat: true });
        expect(caseR2(await ouvrir((await saisi.liasseCompleteExcel('t1', 'e1')).buffer), 'ZK')).toBe('01');
    });
    it('le CA HT et la VA de la liasse sont relus sur la feuille Résultat, par leur code REF', async () => {
        const wb = await ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer);
        const ws = wb.getWorksheet('Fiche R2');
        const formules = [];
        ws.eachRow((row) => {
            const f = row.getCell(7).value?.formula;
            if (f)
                formules.push(f);
        });
        expect(formules).toEqual([
            `INDEX('Résultat'!D:D,MATCH("XB",'Résultat'!A:A,0))`,
            `INDEX('Résultat'!D:D,MATCH("XC",'Résultat'!A:A,0))`,
        ]);
        const rangs = rangsParRef(wb.getWorksheet('Résultat'));
        expect(wb.getWorksheet('Résultat').getCell(rangs.get('XB'), 4).value).not.toBeNull();
        expect(wb.getWorksheet('Résultat').getCell(8, 4).value).toBe('EXERCICE AU 31/12/N');
    });
    it('le S.M.T SYSCOHADA ne reçoit pas de fiche R2 · le Titre X n’en porte pas', async () => {
        const wb = await ouvrir((await fabriquerExport(client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE).liasseCompleteExcel('t1', 'e1')).buffer);
        expect(wb.worksheets.map((w) => w.name)).not.toContain('Fiche R2');
    });
});
describe('liasses SYSCOHADA · formules qui lisent BALANCE N et BALANCE N-1', () => {
    const N1_CLOS = [
        ...BALANCE_N1.filter((l) => l.numero !== '52110000'),
        ligne('52110000', 'Banques en monnaie nationale', client_1.ClasseCompte.CLASSE_5, 300_000, 0, 0, 3000),
        {
            ...ligne('60110000', 'Achats de marchandises dans la Région', client_1.ClasseCompte.CLASSE_6, 0, 0, 3000, 0),
            clotureCredit: 3000,
            totalCredit: 3000,
            solde: 0,
        },
        {
            ...ligne('13900000', 'Résultat net : perte', client_1.ClasseCompte.CLASSE_1, 0, 0, 0, 0),
            clotureDebit: 3000,
            totalDebit: 3000,
            solde: 3000,
        },
    ];
    const N1_CLOS_VU = [
        ...BALANCE_N1.filter((l) => l.numero !== '52110000'),
        ligne('52110000', 'Banques en monnaie nationale', client_1.ClasseCompte.CLASSE_5, 300_000, 0, 0, 3000),
        ligne('60110000', 'Achats de marchandises dans la Région', client_1.ClasseCompte.CLASSE_6, 0, 0, 3000, 0),
    ];
    const cas = [
        ['normal', client_1.SystemeComptableSyscohada.NORMAL, BALANCE_N, BALANCE_N1, null],
        ['SMT', client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE, BALANCE_SMT_N, [], null],
        ['normal, N-1 clos', client_1.SystemeComptableSyscohada.NORMAL, BALANCE_N, N1_CLOS_VU, N1_CLOS],
    ];
    it.each(cas)('%s · chaque plage vise les comptes de la bonne colonne, et se recalcule', async (_n, systeme, n, n1, n1Serveur) => {
        const service = fabriquerExport(systeme);
        if (n1Serveur) {
            service.ecritureService.balance.mockImplementation((_t, e) => {
                const lignes = e === 'e0' ? n1Serveur : n;
                return Promise.resolve({
                    lignes,
                    totaux: {
                        debit: lignes.reduce((s, l) => s + l.totalDebit, 0),
                        credit: lignes.reduce((s, l) => s + l.totalCredit, 0),
                    },
                });
            });
        }
        const wb = await ouvrir((await service.liasseCompleteExcel('t1', 'e1')).buffer);
        const { plages, defauts } = (0, relecture_balances_liasse_1.defautsDesFormulesDeBalance)(wb);
        const nonVides = n1.length > 0 ? 2 : 1;
        expect(new Set(plages.map((p) => p.feuille)).size).toBe(nonVides);
        expect(plages.filter((p) => p.feuilleSource === 'CONTROLE BALANCE')).toHaveLength(6 * nonVides);
        expect(plages.filter((p) => p.feuilleSource === 'CONTROLES').map((p) => p.colonne)).toEqual(['G', 'H']);
        expect(defauts).toEqual([]);
        for (const p of plages) {
            const formule = formuleDe(wb.getWorksheet(p.feuilleSource).getCell(p.celluleSource));
            expect((0, relecture_balances_liasse_1.evaluerSomme)(wb, formule)).toBe((0, relecture_balances_liasse_1.sommeAttendue)(p.feuille === theme_etafi_1.NOM_BALANCE ? n : n1, p.colonne));
        }
        const verdicts = (0, relecture_balances_liasse_1.verdictsControleBalance)(wb);
        expect(verdicts).toHaveLength(6);
        for (const v of verdicts)
            expect(v.verdict).toBe('Equilibre');
        if (n1.length) {
            expect((0, relecture_balances_liasse_1.defautsDeFeuilleBalance)(wb, theme_etafi_1.NOM_BALANCE_N1, n1.map((l) => l.numero), 'Mouvements au 31/12/24', presentation_fpm_1.FOND_ENTETE_FPM)).toEqual([]);
        }
    });
    it('une balance faussée dit son écart, colonne par colonne', async () => {
        const wb = await ouvrir((await fabriquerExport().liasseCompleteExcel('t1', 'e1')).buffer);
        const bal = wb.getWorksheet(theme_etafi_1.NOM_BALANCE_N1);
        expect(bal.getCell('A10').value).toBe('10130000');
        bal.getCell('H10').value = Number(bal.getCell('H10').value ?? 0) + 100;
        bal.getCell('E10').value = Number(bal.getCell('E10').value ?? 0) + 40;
        const verdicts = (0, relecture_balances_liasse_1.verdictsControleBalance)(wb);
        expect(verdicts.filter((v) => v.bloc === 'BALANCE N-1').map((v) => v.verdict)).toEqual([
            'Equilibre',
            'Déséquilibre : écart de 40',
            'Déséquilibre : écart de -100',
        ]);
        for (const v of verdicts.filter((x) => x.bloc === 'BALANCE N'))
            expect(v.verdict).toBe('Equilibre');
    });
});
describe('liasse · la provenance de la colonne N-1, dite', () => {
    const provenance = export_service_1.ExportService.prototype.provenanceDuComparatif;
    it('écrit la mention du bilan, le motif du compte de résultat et l’ouverture du tableau des flux quand elle diffère', () => {
        const lignes = provenance({ mentionComparatif: 'Colonne N-1 lue sur le bilan d’ouverture' }, { motifComparatifAbsent: 'Exercice précédent non tenu' }, { mentionOuverture: 'Ouverture présumée nulle' });
        expect(lignes.map((l) => [l[0], l[2], l[3]])).toEqual([
            ['INFO', 'Bilan · colonne N-1', 'Colonne N-1 lue sur le bilan d’ouverture'],
            ['INFO', 'Compte de résultat · colonne N-1', 'Exercice précédent non tenu'],
            ['INFO', 'Tableau des flux · ouverture', 'Ouverture présumée nulle'],
        ]);
    });
    it('exercice précédent tenu · rien à dire, et la même mention n’est pas répétée', () => {
        expect(provenance({ mentionComparatif: null }, { motifComparatifAbsent: null })).toEqual([]);
        expect(provenance({ mentionComparatif: 'M' }, {}, { mentionOuverture: 'M' })).toHaveLength(1);
    });
});
describe('liasses · résultat logé au bilan et résultat précédent non viré', () => {
    it('exercice ouvert · la part antérieure est retranchée, aucune anomalie', () => {
        const bilan = { controle: { resultatAnterieurNonAffecte: -300_000 }, resultatAnterieurNonVire: null };
        expect((0, export_service_1.resultatDeLExerciceLogeAuBilan)("'Bilan-Passif'!D40", bilan)).toBe("'Bilan-Passif'!D40-(-300000)");
        expect((0, export_service_1.anomalieResultatAnterieurNonVire)(bilan)).toEqual([]);
    });
    it('exercice clôturé sans le virement · rien n’est retranché, et l’anomalie « à traiter » le nomme', () => {
        const avis = (0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(true, -46_072_000, 'CJ', 'SYSCOHADA');
        const bilan = { controle: { resultatAnterieurNonAffecte: -46_072_000 }, resultatAnterieurNonVire: avis };
        expect((0, export_service_1.resultatDeLExerciceLogeAuBilan)("'Bilan-Passif'!D40", bilan)).toBe("'Bilan-Passif'!D40");
        const [anomalie, ...reste] = (0, export_service_1.anomalieResultatAnterieurNonVire)(bilan);
        expect(reste).toEqual([]);
        expect(anomalie.slice(0, 2)).toEqual(['A_TRAITER', 'CJ']);
        expect(anomalie[3]).toContain('AUDCIF, Titre VII, compte 13');
    });
    it('paquet 1, A1 · la colonne N-1 qui reprend le défaut de l’exercice précédent lève sa propre anomalie', () => {
        const n1 = (0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)('EXERCICE_N1', true, 1_000_000, 'CJ', 'SYSCOHADA');
        const bilan = { controle: { resultatAnterieurNonAffecte: 1_400_000 }, resultatAnterieurNonVire: null, resultatAnterieurNonVireN1: n1 };
        expect((0, export_service_1.resultatDeLExerciceLogeAuBilan)("'Bilan-Passif'!D40", bilan)).toBe("'Bilan-Passif'!D40-(1400000)");
        const anomalies = (0, export_service_1.anomalieResultatAnterieurNonVire)(bilan);
        expect(anomalies).toHaveLength(1);
        expect(anomalies[0].slice(0, 3)).toEqual(['A_TRAITER', 'CJ', "Résultat net de l'exercice · colonne N-1"]);
        expect(anomalies[0][3]).toMatch(/^Colonne N-1 · /);
    });
    it('les cinq liasses posent l’anomalie, et les quatre lignes de contrôle lisent le bilan entier', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'export.service.ts'), 'utf8');
        expect(source.match(/anomalies\.push\(\.\.\.anomalieResultatAnterieurNonVire\(bilan\)\)/g)?.length).toBe(5);
        expect(source.match(/anomalies\.push\(\.\.\.this\.provenanceDuComparatif\(bilan, /g)?.length).toBe(5);
        expect(source.match(/resultatDeLExerciceLogeAuBilan\(`'Bilan-Passif'![CD]\$\{rangsPassif\.get\('(HB|CH|CJ|SP2)'\)\}`, bilan\)/g)?.length).toBe(4);
    });
});
//# sourceMappingURL=liasse-syscohada.spec.js.map