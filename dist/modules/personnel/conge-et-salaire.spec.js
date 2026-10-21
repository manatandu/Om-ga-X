"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const personnel_service_1 = require("./personnel.service");
const absences_1 = require("./absences");
const SANS_MALADIE = new Set();
const conge = (p = {}) => ({
    id: 'c-1',
    du: '2026-08-03',
    au: '2026-08-15',
    joursVoyage: 0,
    ...p,
});
describe('les jours de congé du mois (art. 142 ; mentions 6, 14 et 28)', () => {
    it('le congé du 3 au 15 août 2026 compte douze jours ouvrables du Code dans août', () => {
        const [c] = (0, absences_1.congesDuMois)([conge()], '2026-08', SANS_MALADIE);
        expect([c.ouvrablesDuMois, c.joursDeConge, c.auMoins]).toEqual([12, 12, 12]);
    });
    it('le salaire des jours hors congé · 1 040 000 × 14 / 26 = 560 000, et 560 000 + 480 000 = 1 040 000 au bulletin', () => {
        const p = (0, absences_1.propositionDuMois)({ jours: [], salaireMensuel: 1_040_000, moyenneMensuelleArticle66: null, conges: (0, absences_1.congesDuMois)([conge()], '2026-08', SANS_MALADIE) });
        expect([p.joursDeConge, p.joursPayesAPlein, p.salaireDesJoursDus]).toEqual([12, 14, 560_000]);
        expect(p.salaireDesJoursDus + 480_000).toBe(1_040_000);
        expect(p.explication).toContain('art. 142');
    });
    it('les jours de maladie du congé ne sont pas des jours de congé (art. 141, al. 4) · ils restent à l’absence', () => {
        const [c] = (0, absences_1.congesDuMois)([conge()], '2026-08', new Set(['2026-08-10', '2026-08-11']));
        expect(c.joursDeConge).toBe(10);
    });
    it('un congé à cheval compte dans chaque mois SES jours, quel que soit le bulletin qui porte l’allocation', () => {
        const aCheval = conge({ du: '2026-08-24', au: '2026-09-05' });
        const [aout] = (0, absences_1.congesDuMois)([aCheval], '2026-08', SANS_MALADIE);
        const [septembre] = (0, absences_1.congesDuMois)([aCheval], '2026-09', SANS_MALADIE);
        expect([aout.joursDeConge, septembre.joursDeConge]).toEqual([7, 5]);
    });
    it('à cheval avec des jours de voyage, rien n’est proposé · le mois des jours de voyage n’est écrit nulle part', () => {
        const conges = (0, absences_1.congesDuMois)([conge({ du: '2026-08-24', au: '2026-09-05', joursVoyage: 2 })], '2026-08', SANS_MALADIE);
        expect([conges[0].joursDeConge, conges[0].auMoins]).toEqual([null, 5]);
        const p = (0, absences_1.propositionDuMois)({ jours: [], salaireMensuel: 1_040_000, moyenneMensuelleArticle66: null, conges });
        expect(p.salaireDesJoursDus).toBeNull();
        expect(p.motifs.join(' ')).toContain('jours de voyage');
    });
    it('les jours de voyage d’un congé du mois restent au salaire (art. 141, al. 3, lecture protectrice)', () => {
        const [c] = (0, absences_1.congesDuMois)([conge({ joursVoyage: 2 })], '2026-08', SANS_MALADIE);
        expect(c.joursDeConge).toBe(10);
    });
});
describe('le salaire plein et l’allocation pour les mêmes jours se refusent à l’émission', () => {
    const conges = (0, absences_1.congesDuMois)([conge()], '2026-08', SANS_MALADIE);
    const refus = (salaireDuBulletin) => (0, absences_1.motifRefusSalairePleinPendantLeConge)({ mois: '2026-08', conges, salaireDuBulletin, salaireMensuel: 1_040_000, devise: 'CDF' });
    it('1 040 000 de salaire avec douze jours de congé · refusé, le plafond et l’article nommés', () => {
        const m = refus(1_040_000);
        expect(m).toContain('560000.00 CDF');
        expect(m).toContain('art. 142');
        expect(m).toContain('mentions 6, 14 et 28');
    });
    it('560 000 passe, et un centime de plus ne passe pas', () => {
        expect(refus(560_000)).toBeNull();
        expect(refus(560_000.01)).not.toBeNull();
    });
    it('sans salaire au mois du contrat, ou sans congé dans le mois, rien n’est opposé', () => {
        expect((0, absences_1.motifRefusSalairePleinPendantLeConge)({ mois: '2026-08', conges, salaireDuBulletin: 2_000_000, salaireMensuel: null, devise: 'CDF' })).toBeNull();
        expect((0, absences_1.motifRefusSalairePleinPendantLeConge)({ mois: '2026-08', conges: [], salaireDuBulletin: 2_000_000, salaireMensuel: 1_040_000, devise: 'CDF' })).toBeNull();
    });
    it('à cheval avec voyage, seul le certain s’oppose · cinq jours au moins en août', () => {
        const incertains = (0, absences_1.congesDuMois)([conge({ du: '2026-08-24', au: '2026-09-05', joursVoyage: 2 })], '2026-08', SANS_MALADIE);
        const plafond = (1_040_000 * 21) / 26;
        expect((0, absences_1.motifRefusSalairePleinPendantLeConge)({ mois: '2026-08', conges: incertains, salaireDuBulletin: plafond, salaireMensuel: 1_040_000, devise: 'CDF' })).toBeNull();
        expect((0, absences_1.motifRefusSalairePleinPendantLeConge)({ mois: '2026-08', conges: incertains, salaireDuBulletin: 1_040_000, salaireMensuel: 1_040_000, devise: 'CDF' })).not.toBeNull();
    });
});
describe('l’émission du bulletin refuse avant toute simulation', () => {
    it('bulletin d’août à 1 040 000 + allocation de douze jours · « Bulletin non émis », art. 142', async () => {
        const ligneConge = {
            id: 'c-1',
            tenantId: 't',
            salarieId: 's-1',
            du: new Date('2026-08-03T00:00:00Z'),
            au: new Date('2026-08-15T00:00:00Z'),
            joursVoyage: 0,
            moisDePaie: '2026-08',
            deviseAllocation: 'CDF',
            remunerationJournaliere: new client_1.Prisma.Decimal(40_000),
            moyenneMensuelleArticle142: new client_1.Prisma.Decimal(0),
            annuleLe: null,
            bulletin: null,
        };
        const prisma = {
            salarie: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 's-1',
                    nom: 'KABONGO',
                    postNom: null,
                    prenoms: 'Jean',
                    matricule: null,
                    numeroAffiliationCnss: null,
                    contrats: [
                        {
                            id: 'k-1',
                            dateEntreeEnVigueur: new Date('2025-06-01T00:00:00Z'),
                            dateFin: null,
                            natureTravail: null,
                            categorieProfessionnelle: null,
                            remunerationBase: new client_1.Prisma.Decimal(1_040_000),
                            periodiciteRemuneration: 'MOIS',
                            deviseRemuneration: 'CDF',
                        },
                    ],
                }),
            },
            congeSalarie: { findMany: jest.fn().mockResolvedValue([ligneConge]) },
            rubriquePaie: { findMany: jest.fn().mockResolvedValue([]) },
            absenceSalarie: { findMany: jest.fn().mockResolvedValue([]) },
            contratTravail: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const svc = new personnel_service_1.PersonnelService(prisma);
        const simuler = jest.spyOn(svc, 'simulerPaie');
        const dto = {
            moisDePaie: '2026-08',
            elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_040_000 }],
            allocationsConge: [{ congeId: 'c-1' }],
        };
        const echec = svc.emettreBulletin('t', 'u', 's-1', dto);
        await expect(echec).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(svc.emettreBulletin('t', 'u', 's-1', dto)).rejects.toThrow(/Bulletin non émis · .*art\. 142/);
        expect(simuler).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=conge-et-salaire.spec.js.map