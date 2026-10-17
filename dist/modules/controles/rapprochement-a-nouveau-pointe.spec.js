"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const D = (s) => new Date(`${s}T00:00:00Z`);
const an = (exerciceId, date, debit) => ({
    debit,
    credit: 0,
    ecriture: { date: D(date), exerciceId, estGenereeParCloture: true, estSoldeDesComptesDeGestion: false },
});
function analyser(rapprochements) {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn(async ({ orderBy }) => orderBy
                ? { id: 'ex2025' }
                : { id: 'ex2026', statut: 'OUVERT', dateDebut: D('2026-01-01'), dateFin: D('2026-12-31'), dateArreteComptes: D('2027-04-28') }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', nom: 'Dossier', referentiel: client_1.Referentiel.SYCEBNL }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: {
            findMany: jest.fn(async ({ where }) => {
                if (where.statut === 'CLOTURE')
                    return rapprochements.filter((r) => r.statut === 'CLOTURE');
                if (where.statut === 'EN_COURS')
                    return [];
                const b = where.dateReleve;
                return rapprochements.filter((r) => r.lignes.length > 0 && r.dateReleve.getTime() >= b.gte.getTime() && r.dateReleve.getTime() <= b.lte.getTime());
            }),
            groupBy: jest.fn().mockResolvedValue([]),
        },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    return new controles_service_1.ControlesService(prisma).analyser('t', 'ex2026');
}
const anomalie = async (r) => (await analyser(r)).anomalies.find((a) => a.code === 'RAPPROCHEMENT_A_NOUVEAU_POINTE');
const compte = { numero: '52110000', intitule: 'Banque' };
describe('contrôle 30 · un à-nouveau pointé est trouvé, à sa place dans la chaîne', () => {
    it('un rapprochement clos après un autre, qui tient le report de 2026, est signalé', async () => {
        const a = await anomalie([
            { id: 'rap0', compteId: 'c', statut: 'CLOTURE', dateReleve: D('2025-12-31'), clotureAt: D('2026-01-10'), soldeDepartDeclare: null, compte, lignes: [] },
            {
                id: 'rap1',
                compteId: 'c',
                statut: 'CLOTURE',
                dateReleve: D('2026-02-28'),
                clotureAt: D('2026-03-05'),
                soldeDepartDeclare: null,
                compte,
                lignes: [an('ex2026', '2026-01-01', 1300)],
            },
        ]);
        expect(a?.gravite).toBe('AVERTISSEMENT');
        expect(a?.occurrences).toEqual([
            {
                reference: '52110000 Banque · relevé du 2026-02-28',
                detail: 'Rapprochement clos · report à-nouveau du 2026-01-01 pointé',
                date: '2026-01-01',
                montant: 1300,
            },
        ]);
    });
    it('un premier rapprochement en cours, à départ déclaré, qui tient le bilan d’ouverture, est signalé', async () => {
        const a = await anomalie([
            {
                id: 'rap1',
                compteId: 'c',
                statut: 'EN_COURS',
                dateReleve: D('2026-02-28'),
                clotureAt: null,
                soldeDepartDeclare: 1000,
                compte,
                lignes: [an('ex2025', '2026-01-01', 1000)],
            },
        ]);
        expect(a?.occurrences.map((o) => o.detail)).toEqual(['Rapprochement en cours · report à-nouveau du 2026-01-01 pointé']);
    });
    it('le premier rapprochement d’avant la règle, parti de zéro, qui tient le bilan d’ouverture du premier exercice, ne l’est pas', async () => {
        const a = await anomalie([
            {
                id: 'rap0',
                compteId: 'c',
                statut: 'CLOTURE',
                dateReleve: D('2026-02-28'),
                clotureAt: D('2026-03-05'),
                soldeDepartDeclare: null,
                compte,
                lignes: [an('ex2025', '2026-01-01', 1000)],
            },
        ]);
        expect(a).toBeUndefined();
    });
    it('le même, s’il tient le report d’un exercice suivant, l’est · les lignes recopiées étaient au dossier', async () => {
        const a = await anomalie([
            {
                id: 'rap0',
                compteId: 'c',
                statut: 'CLOTURE',
                dateReleve: D('2026-02-28'),
                clotureAt: D('2026-03-05'),
                soldeDepartDeclare: null,
                compte,
                lignes: [an('ex2026', '2026-01-01', 1300)],
            },
        ]);
        expect(a?.occurrences).toHaveLength(1);
    });
});
//# sourceMappingURL=rapprochement-a-nouveau-pointe.spec.js.map