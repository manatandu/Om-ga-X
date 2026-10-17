"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const exercice_service_1 = require("./exercice.service");
const controles_service_1 = require("../controles/controles.service");
const CLOTURE = new Date('2026-12-31');
function serviceExercice() {
    const misAJour = [];
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: CLOTURE }),
            update: jest.fn().mockImplementation(({ data }) => {
                misAJour.push(data);
                return Promise.resolve({ id: 'ex', ...data });
            }),
        },
    };
    return {
        svc: new exercice_service_1.ExerciceService(prisma, {}),
        misAJour,
    };
}
describe('enregistrement de la date d’arrêté', () => {
    it('accepte une date postérieure à la clôture', async () => {
        const { svc, misAJour } = serviceExercice();
        await svc.arreterComptes('t1', 'ex', { dateArreteComptes: '2027-04-28' });
        expect(misAJour[0].dateArreteComptes.toISOString().slice(0, 10)).toBe('2027-04-28');
    });
    it('refuse une date antérieure à la clôture', async () => {
        const { svc } = serviceExercice();
        await expect(svc.arreterComptes('t1', 'ex', { dateArreteComptes: '2026-11-30' })).rejects.toThrow(/ne peut pas précéder la clôture/i);
    });
    it('n’interdit PAS un arrêté au-delà des quatre mois', async () => {
        const { svc, misAJour } = serviceExercice();
        await svc.arreterComptes('t1', 'ex', { dateArreteComptes: '2027-09-15' });
        expect(misAJour[0].dateArreteComptes).toBeInstanceOf(Date);
    });
    it('accepte l’effacement · le texte prévoit un nouvel arrêté', async () => {
        const { svc, misAJour } = serviceExercice();
        await svc.arreterComptes('t1', 'ex', { dateArreteComptes: null });
        expect(misAJour[0].dateArreteComptes).toBeNull();
    });
});
function serviceControles(referentiel, dateArreteComptes) {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2026-01-01'),
                dateFin: CLOTURE,
                dateArreteComptes,
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const anomalie = async (referentiel, dateArreteComptes) => {
    const rapport = await serviceControles(referentiel, dateArreteComptes).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === 'DATE_ARRETE_NON_RENSEIGNEE');
};
describe('le contrôle qui signale la mention manquante', () => {
    for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
        it(`${referentiel} · signale l’absence de date d’arrêté`, async () => {
            const a = await anomalie(referentiel, null);
            expect(a).toBeDefined();
            expect(a.gravite).toBe('AVERTISSEMENT');
            expect(a.consequence).toContain('Ce n’est pas la date de clôture');
        });
        it(`${referentiel} · se tait dès que la date est renseignée`, async () => {
            expect(await anomalie(referentiel, new Date('2027-04-28'))).toBeUndefined();
        });
    }
    it('chaque référentiel cite le chemin par lequel l’obligation lui parvient', async () => {
        const sycebnl = await anomalie(client_1.Referentiel.SYCEBNL, null);
        expect(sycebnl.consequence).toContain('art. 3 du SYCEBNL');
        expect(sycebnl.consequence).not.toContain('Titre IX');
        const syscohada = await anomalie(client_1.Referentiel.SYSCOHADA, null);
        expect(syscohada.consequence).toContain('Titre IX ch. 1 § 2.4');
        expect(syscohada.consequence).not.toContain('SYCEBNL');
    });
});
//# sourceMappingURL=date-arrete-comptes.spec.js.map