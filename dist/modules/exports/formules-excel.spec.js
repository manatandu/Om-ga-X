"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ExcelJS = require("exceljs");
const common_1 = require("@nestjs/common");
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
    it('les tableaux des immobilisations sortent en UN classeur à trois feuilles (demande de Manasse du 2026-10-16)', async () => {
        const immos = {
            tableauImmobilisations: jest.fn().mockResolvedValue({
                dateArret: '2025-12-31',
                groupes: [],
                sortis: [],
                totaux: { brut: 0, amortissements: 0, depreciations: 0, net: 0 },
            }),
            tableauAmortissements: jest.fn().mockResolvedValue({
                exercice: { dateDebut: '2025-01-01', dateFin: '2025-12-31' },
                mois: Array.from({ length: 12 }, (_, i) => ({ cle: `2025-${i + 1}`, libelle: `M${i + 1}` })),
                groupes: [],
                totaux: { parMois: Array.from({ length: 12 }, () => 0), dotation: 0, cumulN1: 0, cumulN: 0, depreciations: 0, net: 0 },
            }),
        };
        const reevaluationBilan = { findFirst: jest.fn().mockResolvedValue(null) };
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(TENANT) },
            exercice: {
                findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }),
            },
            reevaluationBilan,
        };
        const vide = {};
        const service = new export_service_1.ExportService(prisma, vide, vide, vide, vide, vide, vide, vide, vide, vide, undefined, undefined, immos);
        const classeur = await classeurDepuis((await service.tableauxImmobilisationsExcel('tn', 'ex')).buffer);
        expect(classeur.worksheets.map((f) => f.name)).toEqual(['Immobilisations', 'Amortissements', 'Réévaluations']);
        expect(immos.tableauImmobilisations.mock.calls[0][1]).toEqual({ dateArret: '2025-12-31' });
        expect(reevaluationBilan.findFirst.mock.calls[0][0].where).toEqual({ tenantId: 'tn', exerciceId: 'ex' });
        const r = classeur.getWorksheet('Réévaluations');
        const textes = [];
        r.eachRow((ligne) => textes.push(String(ligne.getCell(1).value ?? '')));
        expect(textes).toContain("Aucune réévaluation n'est passée dans cet exercice.");
    });
    it('la feuille Réévaluations rend chaque bien, un total en formule hors du filtre, et refuse une date hors de l\'exercice', async () => {
        const immos = {
            tableauImmobilisations: jest.fn().mockResolvedValue({
                dateArret: '2025-12-31',
                groupes: [],
                sortis: [],
                totaux: { brut: 0, amortissements: 0, depreciations: 0, net: 0 },
            }),
            tableauAmortissements: jest.fn().mockResolvedValue({
                exercice: { dateDebut: '2025-01-01', dateFin: '2025-12-31' },
                mois: Array.from({ length: 12 }, (_, i) => ({ cle: `2025-${i + 1}`, libelle: `M${i + 1}` })),
                groupes: [],
                totaux: { parMois: Array.from({ length: 12 }, () => 0), dotation: 0, cumulN1: 0, cumulN: 0, depreciations: 0, net: 0 },
            }),
        };
        const ligne = (designation, valeurs, motif) => ({
            coefficientRetenu: valeurs.coefficient ?? 0,
            brutAvant: valeurs.brutAvant ?? 0,
            amortissementsAvant: valeurs.amortAvant ?? 0,
            valeurNetteAvant: valeurs.netAvant ?? 0,
            valeurReevaluee: valeurs.reevaluee ?? 0,
            ecart: valeurs.ecart ?? 0,
            brutApres: valeurs.brutApres ?? 0,
            amortissementsApres: valeurs.amortApres ?? 0,
            compteEcart: motif ? null : '10610000',
            motifNonReevalue: motif,
            immobilisation: { designation, numeroInventaire: null },
        });
        const reevaluationBilan = {
            findFirst: jest.fn().mockResolvedValue({
                dateReevaluation: new Date('2025-12-31T00:00:00Z'),
                decision: 'AGE du 15 décembre 2025',
                totalEcart: 2_000_000,
                ecriture: { numeroPiece: 7, statut: 'BROUILLARD', journal: { code: 'OD' } },
                lignes: [
                    ligne('Bâtiment administratif', { coefficient: 1.25, brutAvant: 10_000_000, amortAvant: 2_000_000, netAvant: 8_000_000, reevaluee: 10_000_000, ecart: 2_000_000, brutApres: 12_500_000, amortApres: 2_500_000 }, null),
                    ligne('Terrain nu', { brutAvant: 3_000_000, netAvant: 3_000_000 }, 'Valeur actuelle non établie'),
                ],
            }),
        };
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(TENANT) },
            exercice: {
                findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }),
            },
            reevaluationBilan,
        };
        const vide = {};
        const service = new export_service_1.ExportService(prisma, vide, vide, vide, vide, vide, vide, vide, vide, vide, undefined, undefined, immos);
        const classeur = await classeurDepuis((await service.tableauxImmobilisationsExcel('tn', 'ex')).buffer);
        const r = classeur.getWorksheet('Réévaluations');
        const rangDe = (texte) => {
            let rang = 0;
            r.eachRow((l, n) => {
                if (l.getCell(1).value === texte)
                    rang = n;
            });
            return rang;
        };
        const batiment = rangDe('Bâtiment administratif');
        const terrain = rangDe('Terrain nu');
        const total = rangDe('Total');
        expect([batiment > 0, terrain === batiment + 1, total === terrain + 1]).toEqual([true, true, true]);
        expect(r.getRow(batiment).getCell(3).value).toBe(1.25);
        expect(r.getRow(batiment).getCell(8).value).toBe(2_000_000);
        expect(r.getRow(batiment).getCell(11).value).toBe('10610000');
        expect(r.getRow(terrain).getCell(8).value).toBeNull();
        expect(r.getRow(terrain).getCell(3).value).toBeNull();
        expect(r.getRow(terrain).getCell(12).value).toBe('Valeur actuelle non établie');
        const sommeBrut = r.getRow(total).getCell(4).value;
        expect({ formule: sommeBrut.formula, resultat: sommeBrut.result }).toEqual({
            formule: `SUM(D${batiment}:D${terrain})`,
            resultat: 13_000_000,
        });
        const sommeEcart = r.getRow(total).getCell(8).value;
        expect(sommeEcart.formula).toBe(`SUM(H${batiment}:H${terrain})`);
        const filtre = r.autoFilter;
        const fin = typeof filtre === 'string' ? Number(filtre.split(':')[1].replace(/\D/g, '')) : filtre.to.row;
        expect(fin).toBe(terrain);
        expect(r.getColumn(3).numFmt).toBe('0.0000000000');
        expect(r.getColumn(4).numFmt).toBe('#,##0.00');
        expect(r.getColumn(10).numFmt).toBe('#,##0.00');
        const textes = [];
        r.eachRow((l) => textes.push(String(l.getCell(1).value ?? '')));
        expect(textes).toContain('Réévaluation du 31/12/2025 · pièce OD 7 (au brouillard) · AGE du 15 décembre 2025');
        await expect(service.tableauxImmobilisationsExcel('tn', 'ex', '2026-01-15')).rejects.toThrow(common_1.BadRequestException);
        await expect(service.tableauxImmobilisationsExcel('tn', 'ex', '2025-02-30')).rejects.toThrow(common_1.BadRequestException);
    });
});
//# sourceMappingURL=formules-excel.spec.js.map