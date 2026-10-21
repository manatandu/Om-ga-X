"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("../modules/immobilisations/immobilisation.service");
const systeme_minimal_1 = require("./systeme-minimal");
const SMT_SYCEBNL = { referentiel: client_1.Referentiel.SYCEBNL, jeuEtatsFinanciersSycebnl: 'SYSTEME_MINIMAL_TRESORERIE' };
const ASSOCIATIONS = { referentiel: client_1.Referentiel.SYCEBNL, jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' };
const PROJETS = { referentiel: client_1.Referentiel.SYCEBNL, jeuEtatsFinanciersSycebnl: 'PROJETS_DEVELOPPEMENT' };
const SMT_SYSCOHADA = { referentiel: client_1.Referentiel.SYSCOHADA, systemeComptableSyscohada: 'MINIMAL_TRESORERIE' };
const NORMAL = { referentiel: client_1.Referentiel.SYSCOHADA, systemeComptableSyscohada: 'NORMAL' };
describe('estSystemeMinimal', () => {
    it('lit le jeu au SYCEBNL et le système au SYSCOHADA, jamais l’un pour l’autre', () => {
        expect((0, systeme_minimal_1.estSystemeMinimal)(SMT_SYCEBNL)).toBe(true);
        expect((0, systeme_minimal_1.estSystemeMinimal)(SMT_SYSCOHADA)).toBe(true);
        expect((0, systeme_minimal_1.estSystemeMinimal)(ASSOCIATIONS)).toBe(false);
        expect((0, systeme_minimal_1.estSystemeMinimal)(PROJETS)).toBe(false);
        expect((0, systeme_minimal_1.estSystemeMinimal)(NORMAL)).toBe(false);
        expect((0, systeme_minimal_1.estSystemeMinimal)({ ...ASSOCIATIONS, systemeComptableSyscohada: 'MINIMAL_TRESORERIE' })).toBe(false);
    });
});
describe('la dépréciation, refusée aux deux SMT', () => {
    it('cite le modèle de CHAQUE texte', () => {
        expect((0, systeme_minimal_1.motifRefusDepreciationSmt)(SMT_SYCEBNL)).toMatch(/SYCEBNL, Partie 4 ch\. 4/);
        expect((0, systeme_minimal_1.motifRefusDepreciationSmt)(SMT_SYCEBNL)).not.toMatch(/AUDCIF/);
        expect((0, systeme_minimal_1.motifRefusDepreciationSmt)(SMT_SYSCOHADA)).toMatch(/AUDCIF, Titre X ch\. 2/);
        expect((0, systeme_minimal_1.motifRefusDepreciationSmt)(SMT_SYSCOHADA)).not.toMatch(/SYCEBNL/);
    });
    it('laisse passer les trois autres profils', () => {
        for (const t of [ASSOCIATIONS, PROJETS, NORMAL])
            expect((0, systeme_minimal_1.motifRefusDepreciationSmt)(t)).toBeNull();
    });
});
describe('le mode linéaire, au seul SMT SYSCOHADA', () => {
    it('refuse au SMT SYSCOHADA avec la phrase du Titre X', () => {
        expect((0, systeme_minimal_1.motifRefusAmortissementNonLineaireSmt)(SMT_SYSCOHADA, 'X')).toMatch(/linéaire sans prorata temporis/);
    });
    it('ne transpose pas la règle au SMT SYCEBNL, qui ne prescrit aucun mode', () => {
        expect((0, systeme_minimal_1.motifRefusAmortissementNonLineaireSmt)(SMT_SYCEBNL, 'X')).toBeNull();
        expect((0, systeme_minimal_1.motifRefusAmortissementNonLineaireSmt)(NORMAL, 'X')).toBeNull();
    });
});
describe('le câblage · un bien aux unités d’œuvre à la création', () => {
    function harnais(regime) {
        const creations = [];
        const prisma = {
            familleImmobilisation: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'f1',
                    estActif: true,
                    compteImmobilisationId: 'cimmo',
                    compteAmortissementId: 'camort',
                    compteDotationId: 'cdot',
                    dureeAmortissementAns: 5,
                }),
            },
            compte: { findFirst: jest.fn().mockResolvedValue({ id: 'ctreso', numero: '52110000' }) },
            exercice: {
                findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'exN' && where.tenantId === 't1' ? { dateDebut: new Date('2026-01-01') } : null)),
            },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(regime) },
            immobilisation: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockImplementation(({ data }) => {
                    creations.push(data);
                    return Promise.resolve({ ...data, valeurOrigine: 0, valeurResiduelle: 0, prixCession: null, dotations: [] });
                }),
            },
        };
        const ecritures = { creer: jest.fn().mockResolvedValue({ id: 'e1' }) };
        return { svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures), creations };
    }
    const CAMION = {
        familleId: 'f1',
        designation: 'Camion',
        dateAcquisition: '2026-01-10',
        dateMiseEnService: '2026-01-10',
        valeurOrigine: 40_000_000,
        dureeAmortissementAns: 5,
        compteContrepartieId: 'ctreso',
        exerciceId: 'exN',
        journalId: 'j1',
        modeAmortissement: 'UNITES_DOEUVRE',
        unitesOeuvrePrevues: 400_000,
        uniteOeuvreLibelle: 'km',
    };
    it('refusé au SMT SYSCOHADA, rien n’est créé', async () => {
        const { svc, creations } = harnais(SMT_SYSCOHADA);
        await expect(svc.creer('t1', 'u1', CAMION)).rejects.toThrow(/Titre X ch\. 1 § 1/);
        expect(creations).toHaveLength(0);
    });
    it('admis au SMT SYCEBNL et au Système normal', async () => {
        for (const regime of [SMT_SYCEBNL, NORMAL]) {
            const { svc, creations } = harnais(regime);
            await svc.creer('t1', 'u1', CAMION).catch(() => undefined);
            expect(creations).toHaveLength(1);
        }
    });
});
//# sourceMappingURL=systeme-minimal.spec.js.map