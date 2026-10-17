"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const ANCIEN = new Date('2025-01-10');
const ecriture = (id, drapeaux = {}) => ({
    id,
    date: new Date('2026-12-31'),
    libelle: id,
    reference: 'REF',
    numeroPiece: 1,
    statut: 'BROUILLARD',
    createdAt: ANCIEN,
    createdBy: 'u',
    valideeBy: null,
    secondRegardNom: null,
    estGenereeParCloture: false,
    estANouveauProvisoire: false,
    journal: { code: 'OD' },
    lignes: [],
    ...drapeaux,
});
function analyser(statutExercice, ecritures) {
    const prisma = {
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex', statut: statutExercice, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'),
                dateArreteComptes: new Date('2027-04-28'),
            }),
            findMany: jest.fn().mockResolvedValue([{ id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' }]),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', nom: 'Dossier', referentiel: client_1.Referentiel.SYCEBNL }) },
        ecriture: { findMany: jest.fn().mockResolvedValue(ecritures) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        cloture: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    return new controles_service_1.ControlesService(prisma).analyser('t', 'ex');
}
const retard = async (statut, ecritures) => (await analyser(statut, ecritures)).anomalies.find((a) => a.code === 'BROUILLARD_EN_RETARD');
describe('brouillard en retard et écritures invalidables', () => {
    it('l’écriture de clôture d’un exercice clôturé n’est pas signalée', async () => {
        expect(await retard('CLOTURE', [ecriture('cloture', { estGenereeParCloture: true })])).toBeUndefined();
    });
    it('le report à-nouveau provisoire n’est pas signalé', async () => {
        expect(await retard('OUVERT', [ecriture('ran-provisoire', { estGenereeParCloture: true, estANouveauProvisoire: true })])).toBeUndefined();
    });
    it('une écriture ordinaire en retard l’est toujours, seule', async () => {
        const a = await retard('OUVERT', [ecriture('achat'), ecriture('ran-provisoire', { estANouveauProvisoire: true })]);
        expect(a?.occurrences.map((o) => o.detail?.split(' · ')[0])).toEqual(['achat']);
    });
    it('le report définitif d’un exercice OUVERT reste signalé · lui se valide', async () => {
        const a = await retard('OUVERT', [ecriture('ran', { estGenereeParCloture: true })]);
        expect(a?.occurrences.map((o) => o.detail?.split(' · ')[0])).toEqual(['ran']);
    });
});
//# sourceMappingURL=brouillard-invalidable.spec.js.map