"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const ligne = (numero, intitule, credit, debit = 0) => ({
    debit,
    credit,
    compte: { numero, intitule },
});
function service(lignes, nombreImmobilisations, referentiel = client_1.Referentiel.SYCEBNL, duModule = []) {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: {
            findMany: jest.fn().mockResolvedValue(duModule.map((d) => ({ sens: d.sens, montant: d.montant, compteDepreciation: { numero: d.numero } }))),
        },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: {
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(nombreImmobilisations),
        },
    };
    return new controles_service_1.ControlesService(prisma);
}
const signale = async (lignes, nombreImmobilisations = 3, referentiel = client_1.Referentiel.SYCEBNL, duModule = []) => {
    const rapport = await service(lignes, nombreImmobilisations, referentiel, duModule).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === 'DEPRECIATION_IMMO_HORS_MODULE');
};
describe('dépréciation d’immobilisation hors module', () => {
    it('signale une dépréciation portée alors que le module tient des biens', async () => {
        const a = await signale([ligne('29310000', 'Dépréciations des bâtiments', 8_000_000)]);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.occurrences[0].montant).toBe(8_000_000);
        expect(a.consequence).toContain('base');
        expect(a.consequence).toContain('ne solde pas le compte 29');
        expect(a.consequence).toContain('surévaluée');
    });
    it('se tait quand le dossier ne tient aucune immobilisation dans le module', async () => {
        expect(await signale([ligne('29610000', 'Dépréciations des titres', 5_000_000)], 0)).toBeUndefined();
    });
    it('se tait quand la dépréciation a été entièrement reprise', async () => {
        const a = await signale([
            ligne('29310000', 'Dépréciations des bâtiments', 8_000_000),
            ligne('29310000', 'Dépréciations des bâtiments', 0, 8_000_000),
        ]);
        expect(a).toBeUndefined();
    });
    it('ne confond pas un solde débiteur avec une dépréciation', async () => {
        expect(await signale([ligne('29310000', 'Dépréciations des bâtiments', 0, 3_000_000)])).toBeUndefined();
    });
    it('cite le texte du référentiel du dossier, jamais celui de l’autre', async () => {
        const sycebnl = await signale([ligne('29310000', 'Dépréciations', 1)], 3, client_1.Referentiel.SYCEBNL);
        expect(sycebnl.consequence).toContain('SYCEBNL, Partie 2 ch. 3');
        expect(sycebnl.consequence).not.toContain('art. 46');
        const syscohada = await signale([ligne('29310000', 'Dépréciations', 1)], 3, client_1.Referentiel.SYSCOHADA);
        expect(syscohada.consequence).toContain('AUDCIF art. 46');
        expect(syscohada.consequence).not.toContain('SYCEBNL');
    });
});
describe('ce que le module a lui-même posté ne compte pas', () => {
    it('se tait quand la dépréciation vient entièrement du module', async () => {
        const a = await signale([ligne('29310000', 'Dépréciations des bâtiments', 8_000_000)], 3, client_1.Referentiel.SYCEBNL, [
            { sens: 'DOTATION', montant: 8_000_000, numero: '29310000' },
        ]);
        expect(a).toBeUndefined();
    });
    it('signale le seul excédent passé à la main', async () => {
        const a = await signale([ligne('29310000', 'Dépréciations des bâtiments', 8_000_000)], 3, client_1.Referentiel.SYCEBNL, [
            { sens: 'DOTATION', montant: 5_000_000, numero: '29310000' },
        ]);
        expect(a).toBeDefined();
        expect(a.occurrences[0].montant).toBe(3_000_000);
    });
    it('une reprise du module se retranche dans le bon sens', async () => {
        const a = await signale([ligne('29310000', 'Dépréciations des bâtiments', 6_000_000)], 3, client_1.Referentiel.SYCEBNL, [
            { sens: 'DOTATION', montant: 8_000_000, numero: '29310000' },
            { sens: 'REPRISE', montant: 2_000_000, numero: '29310000' },
        ]);
        expect(a).toBeUndefined();
    });
});
//# sourceMappingURL=depreciation-immo-hors-module.spec.js.map