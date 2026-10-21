"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const depreciation_en_cours_1 = require("./depreciation-en-cours");
const immobilisation_service_1 = require("./immobilisation.service");
const D = (s) => new Date(`${s}T00:00:00.000Z`);
describe('les comptes 29x9', () => {
    it('2919, 2929, 2939, 2949 et leurs subdivisions déprécient un en-cours, pas le 2931 ni le 2959', () => {
        for (const n of ['29190000', '29290000', '29390000', '29490000', '29391000'])
            expect((0, depreciation_en_cours_1.estCompteDepreciationEnCours)(n)).toBe(true);
        for (const n of ['29310000', '29410000', '29590000', '29690000'])
            expect((0, depreciation_en_cours_1.estCompteDepreciationEnCours)(n)).toBe(false);
    });
});
describe('cumul porté par chaque compte 29', () => {
    it('dotations moins reprises, compte par compte, les comptes soldés écartés', () => {
        const c = (0, depreciation_en_cours_1.cumulsParCompte29)([
            { sens: 'DOTATION', montant: 1_000_000, compteDepreciationId: 'a' },
            { sens: 'REPRISE', montant: 400_000, compteDepreciationId: 'a' },
            { sens: 'DOTATION', montant: 300_000, compteDepreciationId: 'b' },
            { sens: 'REPRISE', montant: 300_000, compteDepreciationId: 'b' },
        ]);
        expect([...c.entries()]).toEqual([['a', 600_000]]);
    });
});
describe('un bien, un compte 29', () => {
    const numeros = new Map([
        ['c2939', '29390000'],
        ['c2931', '29310000'],
    ]);
    it('une reprise au 2931 d’une dépréciation dotée au 2939 est refusée · le 2931 deviendrait débiteur', () => {
        const motif = (0, depreciation_en_cours_1.motifRefusCompte29DuBien)({
            syscohada: true,
            compteChoisi: { id: 'c2931', numero: '29310000' },
            cumuls: new Map([['c2939', 500_000]]),
            numeros,
            inscritEnCours: false,
        });
        expect(motif).toMatch(/inscrite au 29390000 \(500000\.00\)/);
        expect(motif).toMatch(/n'a pas été transférée au 29 du bien achevé/);
    });
    it('le compte qui porte la dépréciation reste admis, même après la mise en service (le 2939 d’un bien achevé)', () => {
        expect((0, depreciation_en_cours_1.motifRefusCompte29DuBien)({
            syscohada: true,
            compteChoisi: { id: 'c2939', numero: '29390000' },
            cumuls: new Map([['c2939', 500_000]]),
            numeros,
            inscritEnCours: false,
        })).toBeNull();
    });
    it('SYCEBNL aussi · la règle tient à la fiche du compte 29, pas à la division', () => {
        expect((0, depreciation_en_cours_1.motifRefusCompte29DuBien)({
            syscohada: false,
            compteChoisi: { id: 'c2931', numero: '29310000' },
            cumuls: new Map([['c2939', 500_000]]),
            numeros,
            inscritEnCours: false,
        })).toMatch(/inscrite au 29390000/);
    });
    it('un historique déjà réparti n’enferme pas · l’un des comptes qui portent reste admis', () => {
        const cumuls = new Map([
            ['c2939', 500_000],
            ['c2931', 200_000],
        ]);
        expect((0, depreciation_en_cours_1.motifRefusCompte29DuBien)({ syscohada: true, compteChoisi: { id: 'c2931', numero: '29310000' }, cumuls, numeros, inscritEnCours: false })).toBeNull();
        expect((0, depreciation_en_cours_1.motifRefusCompte29DuBien)({ syscohada: true, compteChoisi: { id: 'c2938', numero: '29380000' }, cumuls, numeros, inscritEnCours: false })).toMatch(/plusieurs comptes/);
    });
});
describe('la première dotation suit le compte où le bien est inscrit (SYSCOHADA, Titre VII ch. 2)', () => {
    const vide = new Map();
    const aucun = new Map();
    it('un bien au 239 se déprécie au 2939, jamais au 2931', () => {
        expect((0, depreciation_en_cours_1.motifRefusCompte29DuBien)({ syscohada: true, compteChoisi: { id: 'x', numero: '29310000' }, cumuls: vide, numeros: aucun, inscritEnCours: true })).toMatch(/encore inscrit en cours/);
        expect((0, depreciation_en_cours_1.motifRefusCompte29DuBien)({ syscohada: true, compteChoisi: { id: 'x', numero: '29390000' }, cumuls: vide, numeros: aucun, inscritEnCours: true })).toBeNull();
    });
    it('un bien achevé ne se déprécie jamais au 29x9', () => {
        expect((0, depreciation_en_cours_1.motifRefusCompte29DuBien)({ syscohada: true, compteChoisi: { id: 'x', numero: '29390000' }, cumuls: vide, numeros: aucun, inscritEnCours: false })).toMatch(/EN COURS/);
    });
    it('SYCEBNL · rien n’est transposé, son texte n’écrit pas la phrase du Titre VII ch. 2', () => {
        expect((0, depreciation_en_cours_1.motifRefusCompte29DuBien)({ syscohada: false, compteChoisi: { id: 'x', numero: '29310000' }, cumuls: vide, numeros: aucun, inscritEnCours: true })).toBeNull();
    });
});
function harnais(o) {
    const immo = {
        id: 'i1',
        designation: 'Entrepôt',
        statut: 'EN_SERVICE',
        valeurOrigine: 10_000_000,
        valeurResiduelle: 0,
        compteImmobilisationId: 'c231',
        compteImmobilisation: { id: 'c231', numero: '23110000' },
        compteEnCoursId: o.enCours ? 'c239' : null,
        dateMiseEnService: o.dateMiseEnService ?? null,
        dotations: [],
        depreciations: (o.depreciations ?? []).map((d) => ({
            sens: d.sens,
            montant: d.montant,
            compteDepreciationId: d.compteId,
            compteDepreciation: { numero: d.numero },
            exercice: { dateFin: D('2025-12-31') },
        })),
    };
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: o.referentiel ?? client_1.Referentiel.SYSCOHADA, systemeComptableSyscohada: 'NORMAL', jeuEtatsFinanciersSycebnl: null }) },
        immobilisation: { findFirst: jest.fn().mockResolvedValue(immo) },
        exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e26', dateDebut: D('2026-01-01'), dateFin: D('2026-12-31') }) },
        compte: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.id === 'c29' ? { id: 'c29', numero: o.compte29 } : where.id === 'c69' ? { id: 'c69', numero: '69130000' } : { id: where.id, numero: '79140000' })),
        },
        ligneReevaluationBilan: { findMany: jest.fn().mockRejectedValue(new Error('SUITE')) },
    };
    return new immobilisation_service_1.ImmobilisationService(prisma, {});
}
const DOTATION = { exerciceId: 'e26', journalId: 'j1', sens: client_1.SensDepreciation.DOTATION, montant: 100_000, compteDepreciationId: 'c29', compteContrepartieId: 'c69', indice: 'Chantier arrêté' };
describe('câblage de la porte de la dépréciation', () => {
    it('SYSCOHADA · bien au 239 à la clôture, dotation au 2931 refusée, au 2939 admise', async () => {
        await expect(harnais({ compte29: '29310000', enCours: true }).enregistrerDepreciation('t1', 'u1', 'i1', DOTATION)).rejects.toThrow(/encore inscrit en cours/);
        await expect(harnais({ compte29: '29390000', enCours: true }).enregistrerDepreciation('t1', 'u1', 'i1', DOTATION)).rejects.toThrow('SUITE');
    });
    it('bien mis en service AVANT la clôture · il est au 231, le 2939 refusé pour une première dotation', async () => {
        await expect(harnais({ compte29: '29390000', enCours: true, dateMiseEnService: D('2026-06-01') }).enregistrerDepreciation('t1', 'u1', 'i1', DOTATION)).rejects.toThrow(/EN COURS/);
    });
    it('dépréciation en place au 2939 · la reprise au 2931 est refusée, au 2939 admise', async () => {
        const depreciations = [{ sens: client_1.SensDepreciation.DOTATION, montant: 400_000, compteId: 'c2939', numero: '29390000' }];
        const reprise = { ...DOTATION, sens: client_1.SensDepreciation.REPRISE, compteContrepartieId: 'c79' };
        await expect(harnais({ compte29: '29310000', enCours: true, dateMiseEnService: D('2026-06-01'), depreciations }).enregistrerDepreciation('t1', 'u1', 'i1', reprise)).rejects.toThrow(/inscrite au 29390000/);
    });
});
//# sourceMappingURL=depreciation-en-cours.spec.js.map