"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ExcelJS = require("exceljs");
const export_service_1 = require("./export.service");
const TENANT = {
    id: 'tn',
    nom: 'Association Test',
    numeroImpot: 'A1234567X',
    deviseCode: 'CDF',
    referentiel: 'SYCEBNL',
};
function classeurDepuis(buffer) {
    const w = new ExcelJS.Workbook();
    return w.xlsx.load(buffer).then(() => w);
}
function cellule(f, adresse) {
    return f.getCell(adresse).value;
}
function estFormule(v) {
    return typeof v === 'object' && v !== null && 'formula' in v;
}
describe('exports · les totaux sont des formules Excel', () => {
    it('le tableau des amortissements lie dotation, cumul et valeur nette', async () => {
        const immos = {
            tableauAmortissements: jest.fn().mockResolvedValue({
                exercice: { dateDebut: '2025-01-01', dateFin: '2025-12-31' },
                mois: Array.from({ length: 12 }, (_, i) => ({ cle: `2025-${i + 1}`, libelle: `M${i + 1}` })),
                groupes: [
                    {
                        numero: '221499',
                        intitule: "Matériel d'exploitation",
                        lignes: [
                            {
                                id: 'a',
                                designation: 'Concasseur',
                                dateAcquisition: '2023-01-01',
                                valeurBrute: 12_000,
                                taux: 20,
                                base: 12_000,
                                parMois: Array.from({ length: 12 }, () => 200),
                                dotation: 2_400,
                                cumulN1: 4_800,
                                cumulN: 7_200,
                                depreciations: 1_000,
                                valeurNette: 3_800,
                                dotationPassee: true,
                            },
                        ],
                        parMois: Array.from({ length: 12 }, () => 200),
                        dotation: 2_400,
                        cumulN1: 4_800,
                        cumulN: 7_200,
                        depreciations: 1_000,
                        net: 3_800,
                    },
                ],
                totaux: {
                    parMois: Array.from({ length: 12 }, () => 200),
                    dotation: 2_400,
                    cumulN1: 4_800,
                    cumulN: 7_200,
                    depreciations: 1_000,
                    net: 3_800,
                },
            }),
        };
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(TENANT) },
            exercice: { findFirst: jest.fn().mockResolvedValue({ dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }) },
        };
        const service = new export_service_1.ExportService(prisma, {}, {}, {}, {}, {}, {}, {}, {}, {}, undefined, undefined, immos);
        const { buffer } = await service.tableauAmortissementsExcel('tn', 'ex');
        const f = (await classeurDepuis(buffer)).getWorksheet('Amortissements');
        expect(f.getCell('A6').value).toBe('Concasseur');
        const dotation = cellule(f, 'Q6');
        expect(estFormule(dotation)).toBe(true);
        expect(dotation.formula).toBe('SUM(E6:P6)');
        const cumulN = cellule(f, 'S6');
        expect(cumulN.formula).toBe('R6+Q6');
        expect(f.getCell('T4').value).toBe('Dépréciations');
        expect(f.getCell('T6').value).toBe(1_000);
        const net = cellule(f, 'U6');
        expect(net.formula).toBe('C6-S6-T6');
        expect(net.result).toBe(3_800);
        expect(cellule(f, 'T7').formula).toBe('SUM(T6:T6)');
        const sousTotal = cellule(f, 'Q7');
        expect(sousTotal.formula).toBe('SUM(Q6:Q6)');
        const totalGeneral = cellule(f, 'Q8');
        expect(totalGeneral.formula).toBe('Q7');
    });
    it('le tableau des immobilisations porte les biens sortis APRÈS le total, hors de lui (audit final F31)', async () => {
        const ligne = (id, designation, brut) => ({
            id,
            designation,
            numeroInventaire: '',
            dateAcquisition: '2021-01-01',
            dureeAns: 5,
            valeurBrute: brut,
            amortissements: 0,
            depreciations: 0,
            valeurNette: brut,
            statut: 'EN_SERVICE',
            dateSortie: null,
        });
        const immos = {
            tableauImmobilisations: jest.fn().mockResolvedValue({
                dateArret: '2025-12-31',
                groupes: [
                    {
                        numero: '221499',
                        intitule: 'Matériel',
                        lignes: [{ ...ligne('a', 'Concasseur', 100_000), depreciations: 7_000, valeurNette: 93_000 }],
                        brut: 100_000,
                        amortissements: 0,
                        depreciations: 7_000,
                        net: 93_000,
                    },
                ],
                sortis: [{ ...ligne('b', 'Camion cédé', 60_000), statut: 'CEDEE', dateSortie: '2025-06-30', compte: '245' }],
                totaux: { brut: 100_000, amortissements: 0, depreciations: 7_000, net: 93_000 },
            }),
        };
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(TENANT) },
            exercice: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        const vide = {};
        const service = new export_service_1.ExportService(prisma, vide, vide, vide, vide, vide, vide, vide, vide, vide, undefined, undefined, immos);
        const f = (await classeurDepuis((await service.tableauImmobilisationsExcel('tn', '2025-12-31')).buffer)).getWorksheet('Immobilisations');
        expect(f.getCell('A8').value).toBe('TOTAL GÉNÉRAL');
        expect(cellule(f, 'D8').formula).toBe('D7');
        expect(f.getCell('A10').value).toBe('BIENS SORTIS À CETTE DATE · hors total');
        expect(f.getCell('A11').value).toBe('(245) Camion cédé');
        expect(f.getCell('H11').value).toBe('Sorti le 30/06/2025');
        expect(f.getCell('F4').value).toBe('Dépréciations');
        const net = cellule(f, 'G6');
        expect({ formule: net.formula, resultat: net.result }).toEqual({ formule: 'D6-E6-F6', resultat: 93_000 });
        expect(cellule(f, 'F8').formula).toBe('F7');
    });
});
//# sourceMappingURL=formules-excel.spec.js.map