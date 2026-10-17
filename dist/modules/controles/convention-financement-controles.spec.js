"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
function service(conventions, referentiel = client_1.Referentiel.SYCEBNL) {
    const servies = conventions.map((c) => ({
        reference: c.reference,
        objet: 'Programme de santé',
        dateFin: c.dateFin,
        montantAccorde: 500_000_000,
        caractere: c.caractere ?? 'FERME_INCONDITIONNEL',
        ecritSigne: c.ecritSigne ?? true,
        bailleur: { code: 'UE-01', nom: 'Union européenne' },
        rapports: c.rapports ?? [],
    }));
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
                dateArreteComptes: new Date('2027-04-28'),
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', nom: 'Dossier', referentiel }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue(servies) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const anomalies = async (conventions, referentiel = client_1.Referentiel.SYCEBNL) => (await service(conventions, referentiel).analyser('t', 'ex')).anomalies;
const trouver = (as, code) => as.find((a) => a.code === code);
const PASSEE = new Date('2025-12-31');
const FUTURE = new Date('2099-12-31');
describe('convention arrivée à terme et toujours en cours', () => {
    it('la signale, avec sa date échue', async () => {
        const a = trouver(await anomalies([{ reference: 'UE-2026-001', dateFin: PASSEE }]), 'CONVENTION_FINANCEMENT_EXPIREE');
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.occurrences[0].reference).toContain('UE-2026-001');
        expect(a.consequence).toMatch(/^Ces conventions portent une date de fin dépassée[\s\S]*rien ne le fonde plus\.$/);
        expect(a.action).toContain('avenant de prorogation');
    });
    it('se tait sur une convention encore valide', async () => {
        expect(trouver(await anomalies([{ reference: 'UE-2026-001', dateFin: FUTURE }]), 'CONVENTION_FINANCEMENT_EXPIREE')).toBeUndefined();
    });
});
describe('rapport dû au bailleur, échu et non transmis', () => {
    it('le signale', async () => {
        const a = trouver(await anomalies([
            {
                reference: 'UE-2026-001',
                dateFin: FUTURE,
                rapports: [{ intitule: 'Rapport financier S1', dateEcheance: PASSEE, dateTransmission: null }],
            },
        ]), 'RAPPORT_BAILLEUR_NON_TRANSMIS');
        expect(a).toBeDefined();
        expect(a.occurrences[0].detail).toContain('Rapport financier S1');
        expect(a.consequence).toContain('tranche suivante');
    });
    it('se tait sur un rapport transmis, même en retard', async () => {
        expect(trouver(await anomalies([
            {
                reference: 'UE-2026-001',
                dateFin: FUTURE,
                rapports: [{ intitule: 'Rapport S1', dateEcheance: PASSEE, dateTransmission: new Date('2026-08-01') }],
            },
        ]), 'RAPPORT_BAILLEUR_NON_TRANSMIS')).toBeUndefined();
    });
});
describe('engagement déclaré ferme, sans écrit signé', () => {
    it("le signale, et rappelle les DEUX conditions du § 5.4.2.4", async () => {
        const a = trouver(await anomalies([{ reference: 'UE-2026-001', dateFin: FUTURE, ecritSigne: false }]), 'ENGAGEMENT_FERME_SANS_ECRIT_SIGNE');
        expect(a).toBeDefined();
        expect(a.gravite).toBe('INFORMATION');
        expect(a.consequence).toContain('§ 5.4.2.4');
        expect(a.consequence).toContain('écrit signé');
    });
    it("se tait sur un CONDITIONNEL sans écrit · il n'a jamais prétendu à une créance", async () => {
        expect(trouver(await anomalies([
            { reference: 'UE-2026-001', dateFin: FUTURE, caractere: 'CONDITIONNEL', ecritSigne: false },
        ]), 'ENGAGEMENT_FERME_SANS_ECRIT_SIGNE')).toBeUndefined();
    });
});
describe('cloisonnement du contrôle', () => {
    it("ne s'exécute pas sur un dossier SYSCOHADA", async () => {
        const as = await anomalies([{ reference: 'UE-2026-001', dateFin: PASSEE }], client_1.Referentiel.SYSCOHADA);
        expect(trouver(as, 'CONVENTION_FINANCEMENT_EXPIREE')).toBeUndefined();
        expect(trouver(as, 'ENGAGEMENT_FERME_SANS_ECRIT_SIGNE')).toBeUndefined();
    });
});
//# sourceMappingURL=convention-financement-controles.spec.js.map