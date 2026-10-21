"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
function service(biens, referentiel = client_1.Referentiel.SYSCOHADA, ventilation = {}) {
    const biensServis = biens.map((b) => ({
        designation: b.designation,
        valeurOrigine: 200_000_000,
        dateAcquisition: new Date('2026-02-10'),
        compteImmobilisation: { numero: b.numero, intitule: 'Bâtiment' },
        ecritureAcquisition: {
            numeroPiece: 'AC-000001',
            lignes: b.comptesAcquisition.map((numero) => ({ compte: { numero } })),
        },
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
        ligneEcriture: {
            findMany: jest.fn().mockImplementation((args) => {
                const w = args?.where;
                if (w?.compte?.numero?.startsWith !== '22' || !w.debit)
                    return Promise.resolve([]);
                const demandees = (w.ecriture?.date?.in ?? []).map((d) => d.toISOString().slice(0, 10));
                return Promise.resolve((ventilation.lignesTerrain ?? [])
                    .filter((d) => demandees.includes(d))
                    .map((d) => ({ ecriture: { date: new Date(d) } })));
            }),
            groupBy: jest.fn().mockResolvedValue([]),
        },
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
        immobilisation: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockImplementation((args) => {
                const racine = args?.where?.compteImmobilisation?.numero?.startsWith;
                if (racine === '22') {
                    return Promise.resolve((ventilation.terrains ?? []).map((d) => ({ dateAcquisition: new Date(d) })));
                }
                return Promise.resolve(racine ? biensServis.filter((b) => b.compteImmobilisation.numero.startsWith(racine)) : []);
            }),
        },
    };
    return new controles_service_1.ControlesService(prisma);
}
const anomalie = async (biens, referentiel = client_1.Referentiel.SYSCOHADA, ventilation = {}) => {
    const rapport = await service(biens, referentiel, ventilation).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === 'BATIMENT_SANS_VENTILATION_TERRAIN');
};
const BATIMENT_SEUL = {
    designation: 'Immeuble de siège',
    numero: '23130000',
    comptesAcquisition: ['23130000', '48100000'],
};
describe('la ventilation du terrain et de la construction', () => {
    it('signale un bâtiment sur sol propre entré sans aucune ligne de terrain', async () => {
        const a = await anomalie([BATIMENT_SEUL]);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.occurrences).toHaveLength(1);
        expect(a.occurrences[0].montant).toBe(200_000_000);
        expect(a.consequence).toContain('s’amortit EN ENTIER');
        expect(a.consequence).toContain('la balance boucle');
    });
    it('se tait dès que l’acquisition touche un compte de terrain', async () => {
        expect(await anomalie([{ ...BATIMENT_SEUL, comptesAcquisition: ['23130000', '22100000', '48100000'] }])).toBeUndefined();
    });
    it('un bâtiment créé par le module (deux lignes) se tait quand son terrain a sa fiche du même jour (R5-B3)', async () => {
        const duModule = { ...BATIMENT_SEUL, comptesAcquisition: ['23130000', '48120000'] };
        expect(await anomalie([duModule])).toBeDefined();
        expect(await anomalie([duModule], client_1.Referentiel.SYSCOHADA, { terrains: ['2026-02-10'] })).toBeUndefined();
        expect(await anomalie([duModule], client_1.Referentiel.SYSCOHADA, { lignesTerrain: ['2026-02-10'] })).toBeUndefined();
        expect(await anomalie([duModule], client_1.Referentiel.SYSCOHADA, { terrains: ['2026-06-01'] })).toBeDefined();
    });
    it('NE CRIE JAMAIS sur un bâtiment sur sol d’autrui · il n’a pas de terrain à ventiler', async () => {
        expect(await anomalie([{ ...BATIMENT_SEUL, numero: '23230000', comptesAcquisition: ['23230000'] }])).toBeUndefined();
    });
    it('ne crie pas non plus sur un ouvrage d’infrastructure (233)', async () => {
        expect(await anomalie([{ ...BATIMENT_SEUL, numero: '23310000', comptesAcquisition: ['23310000'] }])).toBeUndefined();
    });
    it('se tait quand le dossier ne tient aucune immobilisation', async () => {
        expect(await anomalie([])).toBeUndefined();
    });
    it('chaque référentiel cite SON texte, jamais celui de l’autre', async () => {
        const syscohada = await anomalie([BATIMENT_SEUL], client_1.Referentiel.SYSCOHADA);
        expect(syscohada.consequence).toContain('AUDCIF, Titre VIII ch. 11 § 1.7.1');
        expect(syscohada.consequence).not.toContain('SYCEBNL');
        const sycebnl = await anomalie([BATIMENT_SEUL], client_1.Referentiel.SYCEBNL);
        expect(sycebnl.consequence).toContain('SYCEBNL, Partie 2 ch. 3, fiche du compte 23');
        expect(sycebnl.consequence).not.toContain('AUDCIF');
    });
    it('dit au comptable que le montant lui appartient, et ne le lui impose pas', async () => {
        const a = await anomalie([BATIMENT_SEUL]);
        expect(a.action).toContain('art. 38');
        expect(a.action).toContain('vous appartient');
        expect(a.action).toContain('sol d’autrui');
    });
});
//# sourceMappingURL=ventilation-terrain-batiment.spec.js.map