"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const controles_service_1 = require("./controles.service");
const bien = (p) => ({
    dateMiseEnService: new Date('2024-03-01'),
    valeurOrigine: 1_000_000,
    valeurResiduelle: 0,
    amortissementAnterieur: 0,
    dotations: [],
    compteImmobilisation: { numero: '24410000' },
    ...p,
});
function passeFiltreDate(d, f) {
    if (!f)
        return true;
    if ('not' in f && f.not === null && d === null)
        return false;
    if (f.lt !== undefined && (d === null || !(d < f.lt)))
        return false;
    if (f.lte !== undefined && (d === null || !(d <= f.lte)))
        return false;
    return true;
}
function service(immobilisations, referentiel = 'SYSCOHADA', jeuEtatsFinanciersSycebnl = null) {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel, jeuEtatsFinanciersSycebnl }) },
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
        immobilisation: {
            findMany: jest.fn(async (args) => immobilisations.filter((i) => passeFiltreDate(i.dateMiseEnService, args?.where?.dateMiseEnService))),
        },
    };
    return new controles_service_1.ControlesService(prisma);
}
const signale = async (immobilisations) => {
    const rapport = await service(immobilisations).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === 'IMMO_SANS_DOTATION');
};
describe('immobilisation amortissable sans dotation sur l’exercice', () => {
    it('signale le bien en service dont la dotation n’a pas été passée', async () => {
        const a = await signale([bien({ designation: 'Véhicule de service' })]);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.occurrences).toHaveLength(1);
        expect(a.occurrences[0].reference).toBe('Véhicule de service');
        expect(a.consequence).toContain('résultat est surévalué');
        expect(a.consequence).toContain('art. 45');
    });
    it('se tait quand la dotation de l’exercice a été passée', async () => {
        const a = await signale([
            bien({ designation: 'Véhicule', dotations: [{ exerciceId: 'ex', montant: 200_000 }] }),
        ]);
        expect(a).toBeUndefined();
    });
    it('se tait sur un bien intégralement amorti', async () => {
        const a = await signale([
            bien({ designation: 'Ordinateur de 2020', amortissementAnterieur: 1_000_000 }),
        ]);
        expect(a).toBeUndefined();
    });
    it('se tait sur un bien amorti jusqu’à sa valeur résiduelle', async () => {
        const a = await signale([
            bien({
                designation: 'Camion',
                valeurOrigine: 1_000_000,
                valeurResiduelle: 200_000,
                amortissementAnterieur: 800_000,
            }),
        ]);
        expect(a).toBeUndefined();
    });
    it('signale encore un bien qui n’est amorti qu’en partie', async () => {
        const a = await signale([
            bien({ designation: 'Camion', valeurResiduelle: 200_000, amortissementAnterieur: 500_000 }),
        ]);
        expect(a).toBeDefined();
    });
    it('cite chaque bien concerné, pas seulement leur nombre', async () => {
        const a = await signale([
            bien({ designation: 'Véhicule' }),
            bien({ designation: 'Mobilier' }),
            bien({ designation: 'Ordinateur', dotations: [{ exerciceId: 'ex', montant: 1 }] }),
        ]);
        expect(a.occurrences.map((o) => o.reference)).toEqual(['Véhicule', 'Mobilier']);
    });
    it('se tait sur un bien acquis et jamais mis en service (AUDCIF art. 45)', async () => {
        const a = await signale([bien({ designation: 'Groupe électrogène en caisse', dateMiseEnService: null })]);
        expect(a).toBeUndefined();
    });
    it('le contrôle 12 ne réclame pas d\'antérieur à un bien jamais mis en service', async () => {
        const rapport = await service([
            bien({ designation: 'Groupe électrogène en caisse', dateMiseEnService: null }),
            bien({ designation: 'Véhicule repris', dateMiseEnService: new Date('2024-03-01') }),
        ]).analyser('t', 'ex');
        const repris = rapport.anomalies.find((x) => x.code === 'IMMO_REPRISE_SANS_ANTERIEUR');
        expect(repris.occurrences.map((o) => o.reference)).toEqual(['Véhicule repris']);
    });
    const nonAmortissables = [
        ['Terrain nu', 'SYSCOHADA', '22210000'],
        ['Titres de participation', 'SYSCOHADA', '26110000'],
        ['Dépôt et cautionnement', 'SYCEBNL', '27500000'],
        ['Bien reçu en don destiné à la vente', 'SYCEBNL', '20300000'],
    ];
    for (const [designation, referentiel, numero] of nonAmortissables) {
        it(`${referentiel} · ni dotation ni antérieur réclamés sur « ${designation} » (${numero})`, async () => {
            const rapport = await service([bien({ designation, compteImmobilisation: { numero } }), bien({ designation: 'Véhicule' })], referentiel).analyser('t', 'ex');
            const sans = rapport.anomalies.find((x) => x.code === 'IMMO_SANS_DOTATION');
            const repris = rapport.anomalies.find((x) => x.code === 'IMMO_REPRISE_SANS_ANTERIEUR');
            expect(sans.occurrences.map((o) => o.reference)).toEqual(['Véhicule']);
            expect(repris.occurrences.map((o) => o.reference)).toEqual(['Véhicule']);
        });
    }
    it('l’usufruit temporaire (2011) s’amortit, et reste réclamé au SYCEBNL', async () => {
        const a = await service([bien({ designation: 'Usufruit temporaire', compteImmobilisation: { numero: '20110000' } })], 'SYCEBNL').analyser('t', 'ex');
        expect(a.anomalies.find((x) => x.code === 'IMMO_SANS_DOTATION').occurrences[0].reference).toBe('Usufruit temporaire');
    });
});
describe('projet de développement · aucun des deux contrôles d’amortissement', () => {
    const projet = (immos) => service(immos, 'SYCEBNL', 'PROJETS_DEVELOPPEMENT').analyser('t', 'ex');
    it('se tait sur un bien du projet sans dotation', async () => {
        const r = await projet([bien({ designation: 'Véhicule du projet' })]);
        expect(r.anomalies.find((a) => a.code === 'IMMO_SANS_DOTATION')).toBeUndefined();
    });
    it('se tait sur un bien du projet mis en service avant le dossier', async () => {
        const r = await projet([bien({ designation: 'Groupe électrogène', dateMiseEnService: new Date('2020-01-01') })]);
        expect(r.anomalies.find((a) => a.code === 'IMMO_REPRISE_SANS_ANTERIEUR')).toBeUndefined();
    });
    it('une association du même référentiel reste signalée', async () => {
        const r = await service([bien({ designation: 'Véhicule' })], 'SYCEBNL', 'ASSOCIATIONS_ORDRES_PROFESSIONNELS').analyser('t', 'ex');
        expect(r.anomalies.find((a) => a.code === 'IMMO_SANS_DOTATION')).toBeDefined();
    });
});
//# sourceMappingURL=immobilisation-sans-dotation.spec.js.map