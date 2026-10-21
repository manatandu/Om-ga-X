"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const AN = 365.25 * 24 * 3600 * 1000;
describe('l’estimation du ch. 5 § 1', () => {
    const base = {
        coutRevisionActuel: 10_000_000,
        intervalleRevisionsAns: 2,
        dateAcquisition: new Date('2025-01-01T00:00:00.000Z'),
    };
    it('amortit le coût ACTUEL sur l’intervalle, depuis l’acquisition', () => {
        const r = immobilisation_service_1.ImmobilisationService.reconstitutionRevisionMajeure({
            ...base,
            dateReconstitution: new Date(base.dateAcquisition.getTime() + AN),
        });
        expect(r.possible).toBe(true);
        if (!r.possible)
            return;
        expect(r.amortissementEstime).toBe(5_000_000);
        expect(r.valeurNetteEstimee).toBe(5_000_000);
    });
    it('rend le coût entier le jour de l’acquisition · rien n’est encore couru', () => {
        const r = immobilisation_service_1.ImmobilisationService.reconstitutionRevisionMajeure({
            ...base,
            dateReconstitution: base.dateAcquisition,
        });
        expect(r.possible).toBe(true);
        if (!r.possible)
            return;
        expect(r.amortissementEstime).toBe(0);
        expect(r.valeurNetteEstimee).toBe(10_000_000);
    });
    it('refuse au-delà d’un intervalle complet · la fiction ne se prolonge pas', () => {
        const r = immobilisation_service_1.ImmobilisationService.reconstitutionRevisionMajeure({
            ...base,
            dateReconstitution: new Date(base.dateAcquisition.getTime() + 3 * AN),
        });
        expect(r.possible).toBe(false);
        if (r.possible)
            return;
        expect(r.motif).toContain('dernière révision réalisée');
        expect(r.motif).toContain('modulo');
    });
    it('repart de la dernière révision RÉELLEMENT réalisée quand elle est donnée', () => {
        const dateReconstitution = new Date(base.dateAcquisition.getTime() + 6 * AN);
        const r = immobilisation_service_1.ImmobilisationService.reconstitutionRevisionMajeure({
            ...base,
            dateReconstitution,
            derniereRevisionRealiseeLe: new Date(dateReconstitution.getTime() - AN / 2),
        });
        expect(r.possible).toBe(true);
        if (!r.possible)
            return;
        expect(r.amortissementEstime).toBe(2_500_000);
        expect(r.valeurNetteEstimee).toBe(7_500_000);
    });
    it('refuse sans le coût actuel ou sans l’intervalle · aucun ne se déduit d’une comptabilité', () => {
        for (const manque of [{ coutRevisionActuel: 0 }, { intervalleRevisionsAns: 0 }]) {
            const r = immobilisation_service_1.ImmobilisationService.reconstitutionRevisionMajeure({
                ...base,
                ...manque,
                dateReconstitution: new Date(base.dateAcquisition.getTime() + AN),
            });
            expect({ manque: Object.keys(manque)[0], possible: r.possible }).toEqual({
                manque: Object.keys(manque)[0],
                possible: false,
            });
        }
    });
    it('ne rend jamais une valeur nette négative', () => {
        for (const ans of [0, 0.5, 1, 1.5, 1.99]) {
            const r = immobilisation_service_1.ImmobilisationService.reconstitutionRevisionMajeure({
                ...base,
                dateReconstitution: new Date(base.dateAcquisition.getTime() + ans * AN),
            });
            if (r.possible)
                expect(r.valeurNetteEstimee).toBeGreaterThanOrEqual(0);
        }
    });
});
describe('l’estimation servie sur un bien précis', () => {
    function service(composantsRevision) {
        const prisma = {
            immobilisation: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'i1',
                    designation: 'Matériel industriel',
                    dateAcquisition: new Date('2025-01-01T00:00:00.000Z'),
                    valeurOrigine: 190_000_000,
                    valeurResiduelle: 0,
                    dureeAmortissementAns: 6,
                    dateMiseEnService: new Date('2025-01-01T00:00:00.000Z'),
                    amortissementAnterieur: 0,
                    modeAmortissement: client_1.ModeAmortissement.LINEAIRE,
                    statut: 'EN_SERVICE',
                    dotations: [],
                    depreciations: [],
                }),
                count: jest.fn().mockResolvedValue(composantsRevision),
            },
        };
        return new immobilisation_service_1.ImmobilisationService(prisma, {});
    }
    it('rend le calcul avec son fondement et la suite à donner', async () => {
        const r = await service(0).estimerRevisionMajeure('t1', 'i1', {
            coutRevisionActuel: 10_000_000,
            intervalleRevisionsAns: 2,
            dateReconstitution: '2026-01-01',
        });
        expect(r.possible).toBe(true);
        expect(r.fondement).toContain('ch. 5 § 1');
        expect(r.suite).toContain('aucune provision pour grosses réparations');
    });
    it('refuse sur un bien dont le composant a bien été identifié à l’origine', async () => {
        await expect(service(1).estimerRevisionMajeure('t1', 'i1', {
            coutRevisionActuel: 10_000_000,
            intervalleRevisionsAns: 2,
            dateReconstitution: '2026-01-01',
        })).rejects.toThrow(/porte déjà un composant/);
    });
});
describe('une révision majeure s’amortit sur l’intervalle, jamais sur la structure', () => {
    function service() {
        const prisma = {
            immobilisation: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'p1',
                    dateAcquisition: new Date('2025-01-01T00:00:00.000Z'),
                    dureeAmortissementAns: 6,
                    compteImmobilisation: { numero: '24100000', intitule: 'Matériel industriel' },
                }),
            },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
            exercice: {
                findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'ex1' && where.tenantId === 't1' ? { dateDebut: new Date('2025-01-01') } : null)),
            },
            familleImmobilisation: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'f1',
                    estActif: true,
                    compteImmobilisationId: 'ci',
                    compteAmortissementId: 'ca',
                    compteDotationId: 'cd',
                    dureeAmortissementAns: 2,
                }),
            },
            compte: {
                findFirst: jest
                    .fn()
                    .mockResolvedValue({ id: 'c1', numero: '52100000', intitule: 'Banque', classe: 'CLASSE_5' }),
            },
        };
        return new immobilisation_service_1.ImmobilisationService(prisma, {});
    }
    const composant = (dureeAmortissementAns) => ({
        familleId: 'f1',
        designation: 'Révision majeure',
        dateAcquisition: '2025-01-01',
        dateMiseEnService: '2025-01-01',
        valeurOrigine: 10_000_000,
        dureeAmortissementAns,
        compteContrepartieId: 'c1',
        exerciceId: 'ex1',
        journalId: 'j1',
        immobilisationPrincipaleId: 'p1',
        typeComposant: client_1.TypeComposant.REVISION_MAJEURE,
        justificationDecomposition: 'Contrat de révision biennale.',
    });
    it('refuse une durée égale ou supérieure à celle de la structure', async () => {
        for (const duree of [6, 7]) {
            await expect(service().creer('t1', 'u1', composant(duree))).rejects.toThrow(/intervalle qui sépare deux révisions/);
        }
    });
    it('cite l’exemple officiel · 190 000 000 sur six ans, révision de 10 000 000 sur deux ans', async () => {
        await expect(service().creer('t1', 'u1', composant(6))).rejects.toThrow(/190 000 000/);
        await expect(service().creer('t1', 'u1', composant(6))).rejects.toThrow(/DEUX ans/);
    });
    it('laisse passer une durée strictement plus courte · elle va chercher la famille ensuite', async () => {
        const erreur = await service()
            .creer('t1', 'u1', composant(2))
            .then(() => null, (e) => e);
        expect(String(erreur)).not.toMatch(/intervalle qui sépare deux révisions/);
    });
});
//# sourceMappingURL=revision-majeure-reconstitution.spec.js.map