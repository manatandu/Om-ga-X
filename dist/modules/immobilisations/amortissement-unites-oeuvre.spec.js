"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
async function dotation(c) {
    const exercice = { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
    let montant = 0;
    const consommations = [
        ...(c.consommees !== undefined
            ? [{ exerciceId: 'exN', unitesConsommees: c.consommees, exercice: { dateFin: exercice.dateFin } }]
            : []),
        ...(c.consommeesAnterieures
            ? [
                {
                    exerciceId: 'exN1',
                    unitesConsommees: c.consommeesAnterieures,
                    exercice: { dateFin: new Date('2025-12-31') },
                },
            ]
            : []),
    ];
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL,
            }),
        },
        immobilisation: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'i1',
                designation: 'Camion',
                statut: 'EN_SERVICE',
                valeurOrigine: c.valeurOrigine,
                valeurResiduelle: c.valeurResiduelle ?? 0,
                dureeAmortissementAns: c.dureeAns ?? 5,
                dateMiseEnService: new Date(c.dateMiseEnService ?? '2026-01-01'),
                amortissementAnterieur: 0,
                modeAmortissement: c.mode ?? client_1.ModeAmortissement.UNITES_DOEUVRE,
                unitesOeuvrePrevues: c.unitesOeuvrePrevues ?? 400_000,
                compteDotationId: 'cd',
                compteAmortissementId: 'ca',
                compteImmobilisation: { numero: '24510000' },
                dotations: [],
                depreciations: c.depreciations ?? [],
            }),
        },
        exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'exN', ...exercice }) },
        consommationUniteOeuvre: { findMany: jest.fn().mockResolvedValue(consommations) },
        dotationAmortissement: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'd1' }),
        },
        ligneReevaluationBilan: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    prisma.$transaction = jest.fn((f) => f(prisma));
    prisma.$queryRaw = jest.fn().mockResolvedValue([]);
    const ecritures = {
        creer: jest.fn().mockImplementation((_t, _u, dto) => {
            montant = dto.lignes[0].debit ?? 0;
            return Promise.resolve({ id: 'e1' });
        }),
    };
    const svc = new immobilisation_service_1.ImmobilisationService(prisma, ecritures);
    await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' });
    return Math.round(montant * 100) / 100;
}
describe('la formule du glossaire, et rien de plus', () => {
    it('AD = base amortissable × consommées / prévues', () => {
        expect(immobilisation_service_1.ImmobilisationService.dotationUnitesOeuvre(60_000_000, 50_000, 400_000)).toBe(7_500_000);
    });
    it('rend zéro sans consommation et sans total prévu · jamais NaN ni Infinity', () => {
        expect(immobilisation_service_1.ImmobilisationService.dotationUnitesOeuvre(60_000_000, 0, 400_000)).toBe(0);
        expect(immobilisation_service_1.ImmobilisationService.dotationUnitesOeuvre(60_000_000, 50_000, 0)).toBe(0);
        expect(Number.isFinite(immobilisation_service_1.ImmobilisationService.dotationUnitesOeuvre(1, 1, 0))).toBe(true);
    });
    it('déduit la valeur résiduelle · c’est la BASE AMORTISSABLE qui est répartie', async () => {
        const m = await dotation({ valeurOrigine: 60_000_000, valeurResiduelle: 10_000_000, consommees: 50_000 });
        expect(m).toBe(6_250_000);
    });
});
describe('aucun prorata temporis ne s’ajoute au rapport', () => {
    it('un bien mis en service en octobre reçoit ses unités entières', async () => {
        const m = await dotation({
            valeurOrigine: 60_000_000,
            dateMiseEnService: '2026-10-05',
            consommees: 9_000,
        });
        expect(m).toBe(1_350_000);
    });
    it('le linéaire, lui, proratise bien · c’est la différence que l’on fige', async () => {
        const m = await dotation({
            valeurOrigine: 60_000_000,
            dureeAns: 5,
            dateMiseEnService: '2026-10-05',
            mode: client_1.ModeAmortissement.LINEAIRE,
            consommees: 9_000,
        });
        expect(m).toBe(3_000_000);
    });
});
describe('le reliquat reste la seule borne', () => {
    it('ne dote jamais au-delà de ce qui reste, même sur un usage supérieur au prévu', async () => {
        const m = await dotation({ valeurOrigine: 60_000_000, consommees: 500_000 });
        expect(m).toBe(60_000_000);
    });
});
describe('le plan se ré-étale après une dépréciation, en unités', () => {
    it('répartit la valeur révisée sur les unités qui RESTENT, pas sur le total', async () => {
        const m = await dotation({
            valeurOrigine: 60_000_000,
            consommees: 40_000,
            consommeesAnterieures: 150_000,
            depreciations: [{ sens: 'DOTATION', montant: 10_000_000, exercice: { dateFin: new Date('2025-12-31') } }],
        });
        expect(m).toBe(8_000_000);
    });
});
describe('les unités ne sont dans aucun livre', () => {
    it('refuse de doter tant que le relevé n’a pas été saisi', async () => {
        await expect(dotation({ valeurOrigine: 60_000_000 })).rejects.toThrow(/Aucune consommation d’unités d’œuvre|Aucune consommation d'unités d'œuvre/);
    });
    it('le dit dans les termes du problème · le relevé, pas le calcul', async () => {
        await expect(dotation({ valeurOrigine: 60_000_000 })).rejects.toThrow(/compteur|carnet de bord|fiche de production/);
    });
    it('ne réclame rien à un bien amorti linéairement', async () => {
        const m = await dotation({ valeurOrigine: 60_000_000, dureeAns: 5, mode: client_1.ModeAmortissement.LINEAIRE });
        expect(m).toBe(12_000_000);
    });
});
describe('le mode ne s’ouvre pas à moitié', () => {
    const refus = (mode, prevues, libelle) => immobilisation_service_1.ImmobilisationService.motifRefusUnitesOeuvre(mode, prevues, libelle);
    it('exige le total d’unités prévues · c’est le dénominateur de la formule', () => {
        expect(refus(client_1.ModeAmortissement.UNITES_DOEUVRE, undefined, 'kilomètres')).toMatch(/TOTAL D’UNITÉS PRÉVUES|TOTAL D'UNITÉS PRÉVUES/);
        expect(refus(client_1.ModeAmortissement.UNITES_DOEUVRE, 0, 'kilomètres')).not.toBeNull();
        expect(refus(client_1.ModeAmortissement.UNITES_DOEUVRE, -1, 'kilomètres')).not.toBeNull();
    });
    it('exige de nommer l’unité · un total sans unité ne se vérifie pas', () => {
        expect(refus(client_1.ModeAmortissement.UNITES_DOEUVRE, 400_000, undefined)).toMatch(/Nommer l’unité|Nommer l'unité/);
        expect(refus(client_1.ModeAmortissement.UNITES_DOEUVRE, 400_000, '   ')).not.toBeNull();
    });
    it('laisse passer un plan complet', () => {
        expect(refus(client_1.ModeAmortissement.UNITES_DOEUVRE, 400_000, 'kilomètres')).toBeNull();
    });
    it('refuse des unités posées sur un plan linéaire', () => {
        expect(refus(client_1.ModeAmortissement.LINEAIRE, 400_000)).toMatch(/ne se renseignent qu/);
        expect(refus(client_1.ModeAmortissement.LINEAIRE, undefined, 'kilomètres')).not.toBeNull();
        expect(refus(client_1.ModeAmortissement.LINEAIRE)).toBeNull();
    });
});
describe('ce que l’énumération des modes ne doit jamais porter', () => {
    const schema = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../prisma/schema.prisma'), 'utf8');
    const enumeration = schema.slice(schema.indexOf('enum ModeAmortissement {'), schema.indexOf('enum StatutImmobilisation'));
    it('n’ouvre que le linéaire, les unités d’œuvre et le dégressif', () => {
        const valeurs = [...enumeration.matchAll(/^\s{2}([A-Z_]+)$/gm)].map((m) => m[1]);
        expect(valeurs).toEqual(['LINEAIRE', 'UNITES_DOEUVRE', 'DEGRESSIF']);
    });
    it('ne porte aucun des deux modes que l’art. 45 interdit', () => {
        const valeurs = [...enumeration.matchAll(/^\s{2}([A-Z_]+)$/gm)].map((m) => m[1]);
        expect(valeurs.some((v) => /REVENU|CHIFFRE_AFFAIRES|FINANCIER/.test(v))).toBe(false);
    });
});
describe('usufruit temporaire · le linéaire est imposé', () => {
    function creer(referentiel, numero) {
        const create = jest.fn();
        const prisma = {
            familleImmobilisation: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'f', intitule: 'Famille', estActif: true, compteImmobilisationId: 'cimmo', dureeAmortissementAns: 5, modeAmortissement: null,
                }),
            },
            compte: {
                findFirst: jest.fn(({ where }) => Promise.resolve(where.id === 'cimmo'
                    ? { id: 'cimmo', numero }
                    : { id: where.id, numero: numero.startsWith('2011') ? '17100000' : '48120000' })),
            },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel, systemeComptableSyscohada: referentiel === 'SYSCOHADA' ? 'NORMAL' : null, jeuEtatsFinanciersSycebnl: null }) },
            immobilisation: { create, findFirst: jest.fn().mockResolvedValue(null) },
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' }) },
            journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j', code: 'OD' }) },
        };
        const svc = new immobilisation_service_1.ImmobilisationService(prisma, { creer: jest.fn() });
        return {
            create,
            essai: svc.creer('t1', 'u1', {
                familleId: 'f', designation: 'Usufruit', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01', valeurOrigine: 1_000_000,
                exerciceId: 'e', journalId: 'j', compteContrepartieId: 'cfin', modeAmortissement: 'UNITES_DOEUVRE', unitesOeuvrePrevues: 1000, uniteOeuvreLibelle: 'heures',
            }),
        };
    }
    it('refuse les unités d’œuvre sur un 2011 du SYCEBNL, avant toute écriture', async () => {
        const { essai, create } = creer('SYCEBNL', '20110000');
        await expect(essai).rejects.toThrow(/mode linéaire/);
        expect(create).not.toHaveBeenCalled();
    });
    it('un autre bien du SYCEBNL n’est pas visé par ce refus', async () => {
        const { essai } = creer('SYCEBNL', '24110000');
        await expect(essai).rejects.not.toThrow(/mode linéaire/);
    });
});
//# sourceMappingURL=amortissement-unites-oeuvre.spec.js.map