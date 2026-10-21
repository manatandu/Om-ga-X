"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
function service(options) {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date(`${(options.finExercice ?? '2026-12-31').slice(0, 4)}-01-01`),
                dateFin: new Date(options.finExercice ?? '2026-12-31'),
                dateArreteComptes: null,
            }),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                id: 't',
                nom: 'Dossier',
                referentiel: options.referentiel ?? client_1.Referentiel.SYCEBNL,
                formeJuridique: options.formeJuridique ?? client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE,
                droitEtranger: options.droitEtranger ?? false,
                actePersonnaliteJuridique: 'Arrêté n° 087/CAB/MIN/J/2024',
                attestationExemptionIs: options.attestationExemptionIs ?? null,
                dateAttestationExemptionIs: options.dateAttestationExemptionIs ?? null,
            }),
        },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
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
const attestation = async (s) => (await s.analyser('t', 'ex')).anomalies.find((a) => a.code === 'ATTESTATION_EXEMPTION_IS_ABSENTE');
describe("contrôle 25 · l'attestation d'exemption d'IS", () => {
    it('signale son absence à une ONG, sur un exercice postérieur à l’entrée en vigueur', async () => {
        const a = await attestation(service({ formeJuridique: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE }));
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.consequence).toContain('art. 2');
        expect(a.consequence).toContain("n’est pas automatique");
        expect(a.consequence).toContain('art. 3');
        expect(a.consequence).toContain('et 4');
    });
    it('se tait dès que l’attestation est enregistrée', async () => {
        const a = await attestation(service({ attestationExemptionIs: 'DGI/AE/2026/0789' }));
        expect(a).toBeUndefined();
    });
    it("se tait pour une ASSOCIATION · l'arrêté ne vise que les EUP et les ONG", async () => {
        const a = await attestation(service({ formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION }));
        expect(a).toBeUndefined();
    });
    describe('NULL n’est pas « non » · le fondement non qualifiable ne fait rien réclamer', () => {
        it("se tait pour une unité de gestion de projet · hors loi n° 004/2001", async () => {
            const a = await attestation(service({ formeJuridique: client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET }));
            expect(a).toBeUndefined();
        });
        it('se tait pour une forme « AUTRE » · rien n’est qualifiable', async () => {
            const a = await attestation(service({ formeJuridique: client_1.FormeJuridiqueEbnl.AUTRE }));
            expect(a).toBeUndefined();
        });
    });
    it('se tait pour un dossier SYSCOHADA · une société commerciale n’est pas une EBNL', async () => {
        const a = await attestation(service({ referentiel: client_1.Referentiel.SYSCOHADA }));
        expect(a).toBeUndefined();
    });
    describe("l'entrée en vigueur du 1er janvier 2026 · art. 6", () => {
        it('se tait sur un exercice clos le 31 décembre 2025', async () => {
            expect(await attestation(service({ finExercice: '2025-12-31' }))).toBeUndefined();
        });
        it('parle sur un exercice clos le 1er janvier 2026, premier jour couvert', async () => {
            expect(await attestation(service({ finExercice: '2026-01-01' }))).toBeDefined();
        });
    });
    it("ne surveille AUCUNE échéance · l'arrêté n'en fixe aucune", async () => {
        const vieille = await attestation(service({
            attestationExemptionIs: 'DGI/AE/2026/0001',
            dateAttestationExemptionIs: new Date('2026-01-02'),
            finExercice: '2036-12-31',
        }));
        expect(vieille).toBeUndefined();
    });
    it("aucune anomalie du dossier ne parle d'échéance ou de renouvellement d'attestation", async () => {
        const rapport = await service({ attestationExemptionIs: 'DGI/AE/2026/0001' }).analyser('t', 'ex');
        const texte = JSON.stringify(rapport.anomalies).toLowerCase();
        for (const interdit of ['attestation expirée', 'attestation périmée', 'renouveler l’attestation']) {
            expect(texte).not.toContain(interdit);
        }
    });
});
//# sourceMappingURL=attestation-exemption-is.spec.js.map