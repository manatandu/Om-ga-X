"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const ligne = (numero, intitule, credit, debit = 0, duModule = false) => ({
    debit,
    credit,
    compte: { numero, intitule },
    duModule,
});
const lignesSelon = (lignes) => jest.fn(({ where }) => Promise.resolve(lignes
    .filter((l) => !(l.duModule && where?.ecriture && 'reevaluationBilan' in where.ecriture && where.ecriture.reevaluationBilan === null))
    .map(({ duModule: _d, ...l }) => l)));
function service(lignes, nombreImmobilisations, referentiel = client_1.Referentiel.SYCEBNL) {
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
        ligneEcriture: { findMany: lignesSelon(lignes), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
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
const signale = async (lignes, nombreImmobilisations = 4, referentiel = client_1.Referentiel.SYCEBNL) => {
    const rapport = await service(lignes, nombreImmobilisations, referentiel).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === 'REEVALUATION_IMMO_HORS_MODULE');
};
describe('écart de réévaluation hors module', () => {
    it('signale un écart porté alors que le module tient des biens', async () => {
        const a = await signale([ligne('10610000', 'Écarts de réévaluation légale', 12_000_000)]);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.occurrences[0].montant).toBe(12_000_000);
        expect(a.consequence).toContain('valeur d’origine historique');
        expect(a.consequence).toContain('balance boucle');
        expect(a.action).toContain('partielle est');
    });
    it('se tait sur l’écart que le module a lui-même posé (lot 14) · il ne fabrique pas une anomalie', async () => {
        expect(await signale([ligne('10610000', 'Écarts de réévaluation légale', 240, 0, true)])).toBeUndefined();
        const a = await signale([
            ligne('10610000', 'Écarts de réévaluation légale', 240, 0, true),
            ligne('10610000', 'Écarts de réévaluation légale', 1_000),
        ]);
        expect(a.occurrences[0].montant).toBe(1_000);
    });
    it('se tait quand le dossier ne tient aucune immobilisation dans le module', async () => {
        expect(await signale([ligne('10610000', 'Écarts de réévaluation', 5_000_000)], 0)).toBeUndefined();
    });
    it('ne confond pas un solde débiteur avec un écart de réévaluation', async () => {
        expect(await signale([ligne('10610000', 'Écarts de réévaluation', 0, 4_000_000)])).toBeUndefined();
    });
    it('ne prête pas au SYCEBNL les deux règles que seul l’AUDCIF écrit', async () => {
        const sycebnl = await signale([ligne('10610000', 'Écarts', 1)], 4, client_1.Referentiel.SYCEBNL);
        expect(sycebnl.consequence).toContain('SYCEBNL');
        expect(sycebnl.consequence).not.toContain('art. 64');
        expect(sycebnl.consequence).not.toContain('réserve non distribuable');
        const syscohada = await signale([ligne('10610000', 'Écarts', 1)], 4, client_1.Referentiel.SYSCOHADA);
        expect(syscohada.consequence).toContain('art. 64');
        expect(syscohada.consequence).toContain('réserve non distribuable');
        expect(syscohada.consequence).not.toContain('SYCEBNL');
    });
});
//# sourceMappingURL=reevaluation-immo-hors-module.spec.js.map