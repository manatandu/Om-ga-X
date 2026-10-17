"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const ligne = (numero, intitule, debit, credit = 0, soldeDeGestion = false) => ({
    debit,
    credit,
    compte: { numero, intitule },
    soldeDeGestion,
});
function service(lignes637, referentiel = client_1.Referentiel.SYCEBNL) {
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
        ligneEcriture: {
            findMany: jest.fn(async ({ where }) => lignes637.filter((l) => !(l.soldeDeGestion && where.ecriture?.estSoldeDesComptesDeGestion === false))),
            groupBy: jest.fn().mockResolvedValue([]),
        },
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
        immobilisation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const signale = async (lignes, referentiel = client_1.Referentiel.SYCEBNL) => {
    const rapport = await service(lignes, referentiel).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === 'PERSONNEL_EXTERIEUR_NON_VIRE');
};
describe('personnel extérieur resté au compte 637', () => {
    it('signale encore un exercice CLOS · le solde de clôture ne vaut pas virement (régression de F4)', async () => {
        const a = await signale([
            ligne('63710000', 'Personnel intérimaire', 4_500_000),
            ligne('63710000', 'Personnel intérimaire', 0, 4_500_000, true),
        ]);
        expect(a?.occurrences.map((o) => o.montant)).toEqual([4_500_000]);
    });
    it('signale un solde débiteur non viré', async () => {
        const a = await signale([ligne('63710000', 'Personnel intérimaire', 4_500_000)]);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.occurrences).toHaveLength(1);
        expect(a.occurrences[0].montant).toBe(4_500_000);
        expect(a.consequence).toContain('résultat net ne bouge pas');
        expect(a.consequence).toContain('Services extérieurs');
    });
    it('se tait quand le virement a été passé', async () => {
        const a = await signale([
            ligne('63710000', 'Personnel intérimaire', 4_500_000),
            ligne('63710000', 'Personnel intérimaire', 0, 4_500_000),
        ]);
        expect(a).toBeUndefined();
    });
    it('se tait quand aucun personnel extérieur n’a été facturé', async () => {
        expect(await signale([])).toBeUndefined();
    });
    it('additionne par sous-compte et les cite un à un', async () => {
        const a = await signale([
            ligne('63710000', 'Personnel intérimaire', 3_000_000),
            ligne('63710000', 'Personnel intérimaire', 1_000_000),
            ligne('63720000', 'Personnel détaché ou prêté à l’entité', 2_000_000),
        ]);
        expect(a.occurrences.map((o) => o.montant)).toEqual([4_000_000, 2_000_000]);
    });
    it('cite le texte du référentiel du dossier, jamais celui de l’autre', async () => {
        const sycebnl = await signale([ligne('63710000', 'Personnel intérimaire', 1)], client_1.Referentiel.SYCEBNL);
        expect(sycebnl.consequence).toContain('SYCEBNL, Partie 2 ch. 3');
        expect(sycebnl.consequence).not.toContain('Titre VIII ch. 27');
        const syscohada = await signale([ligne('63710000', 'Personnel intérimaire', 1)], client_1.Referentiel.SYSCOHADA);
        expect(syscohada.consequence).toContain('AUDCIF, Titre VIII ch. 27');
        expect(syscohada.consequence).not.toContain('SYCEBNL');
    });
});
//# sourceMappingURL=personnel-exterieur-non-vire.spec.js.map