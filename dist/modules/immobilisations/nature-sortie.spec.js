"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const path_1 = require("path");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const immobilisation_service_1 = require("./immobilisation.service");
const immobilisation_dto_1 = require("./dto/immobilisation.dto");
const nature_sortie_1 = require("./nature-sortie");
const ctx = (o) => (0, nature_sortie_1.motifRefusNatureSortie)({ nature: 'VOL', type: 'MISE_HORS_SERVICE', projetDeveloppement: false, usufruit: false, ...o });
describe('A14 · la liste fermée des natures', () => {
    it('huit natures, chacune nommée par un texte lu, et aucun « pillage »', () => {
        expect([...nature_sortie_1.NATURES_SORTIE]).toEqual([
            'VENTE', 'ECHANGE', 'MISE_AU_REBUT', 'DESTRUCTION', 'VOL', 'DISPARITION', 'REMISE_GRATUITE', 'RESTITUTION',
        ]);
        const schema = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../prisma/schema.prisma'), 'utf8');
        const bloc = /enum NatureSortieImmobilisation \{([^}]*)\}/.exec(schema)[1];
        expect(bloc.split(/\s+/).filter((m) => /^[A-Z_]+$/.test(m))).toEqual([...nature_sortie_1.NATURES_SORTIE]);
    });
    it('une cession avec prix est une vente, et une vente se déclare en cession', () => {
        expect(ctx({ type: 'CESSION', nature: 'VENTE' })).toBeNull();
        expect(ctx({ type: 'CESSION', nature: 'VOL' })).toMatch(/mise hors service, sans prix/);
        expect(ctx({ type: 'MISE_HORS_SERVICE', nature: 'VENTE' })).toMatch(/déclarez-la en cession/);
    });
    it('l’échange n’entre que par son geste', () => {
        expect(ctx({ type: 'CESSION', nature: 'ECHANGE' })).toMatch(/Échanger/);
        expect(ctx({ type: 'CESSION', nature: 'ECHANGE', depuisEchange: true })).toBeNull();
    });
    it('mise au rebut, destruction, vol, disparition · partout', () => {
        for (const nature of ['MISE_AU_REBUT', 'DESTRUCTION', 'VOL', 'DISPARITION'])
            expect(ctx({ nature })).toBeNull();
    });
    it('remise gratuite · fin de projet seule ; restitution · fin de projet ou usufruit', () => {
        expect(ctx({ nature: 'REMISE_GRATUITE' })).toMatch(/§ 2.5.2/);
        expect(ctx({ nature: 'REMISE_GRATUITE', projetDeveloppement: true })).toBeNull();
        expect(ctx({ nature: 'RESTITUTION' })).toMatch(/§ 2.5.3/);
        expect(ctx({ nature: 'RESTITUTION', usufruit: true })).toBeNull();
        expect(ctx({ nature: 'RESTITUTION', projetDeveloppement: true })).toBeNull();
    });
    it('la pièce · référence et date exigées', () => {
        expect((0, nature_sortie_1.motifRefusPieceSortie)('', new Date('2026-09-30'))).toMatch(/art\. 17, 3° et 5°/);
        expect((0, nature_sortie_1.motifRefusPieceSortie)('PV 12', null)).toMatch(/datée/);
        expect((0, nature_sortie_1.motifRefusPieceSortie)('PV 12', new Date('2026-09-30'))).toBeNull();
    });
    it('le libellé de l’écriture nomme la nature', () => {
        expect((0, nature_sortie_1.libelleSortie)({ projet: false, type: 'MISE_HORS_SERVICE', nature: 'VOL', designation: 'Camion' })).toBe('Mise hors service (vol) · Camion');
        expect((0, nature_sortie_1.libelleSortie)({ projet: true, type: 'MISE_HORS_SERVICE', nature: 'RESTITUTION', designation: 'Jeep' })).toBe('Fin de projet · Mise hors service (restitution) · Jeep');
        expect((0, nature_sortie_1.libelleSortie)({ projet: false, type: 'CESSION', nature: null, designation: 'Camion' })).toBe('Cession · Camion');
    });
    it('la route exige nature, référence et date de la pièce', () => {
        const base = { dateSortie: '2026-09-30', type: 'MISE_HORS_SERVICE', exerciceId: '6f1a4c1e-1d2b-4c3d-8e4f-5a6b7c8d9e0f', journalId: '6f1a4c1e-1d2b-4c3d-8e4f-5a6b7c8d9e0f' };
        const champs = (o) => (0, class_validator_1.validateSync)((0, class_transformer_1.plainToInstance)(immobilisation_dto_1.SortirImmobilisationDto, o)).map((e) => e.property).sort();
        expect(champs(base)).toEqual(['datePieceSortie', 'natureSortie', 'referencePieceSortie']);
        expect(champs({ ...base, natureSortie: 'PILLAGE', referencePieceSortie: 'PV', datePieceSortie: '2026-09-30' })).toEqual(['natureSortie']);
        expect(champs({ ...base, natureSortie: 'VOL', referencePieceSortie: 'PV', datePieceSortie: '2026-09-30' })).toEqual([]);
    });
});
function harnais(jeu = null, referentiel = client_1.Referentiel.SYSCOHADA) {
    const postees = [];
    const immo = {
        id: 'i1',
        designation: 'Camion',
        statut: 'EN_SERVICE',
        valeurOrigine: 12_000,
        valeurResiduelle: 0,
        dureeAmortissementAns: 5,
        dateMiseEnService: new Date('2024-01-01'),
        dateAcquisition: new Date('2023-06-01'),
        amortissementAnterieur: 0,
        modeAmortissement: 'LINEAIRE',
        compteImmobilisationId: 'cimmo',
        compteImmobilisation: { id: 'cimmo', numero: '24500000', intitule: 'Matériel de transport' },
        compteDotationId: 'cd',
        compteAmortissementId: 'ca',
        dotations: [2_400, 2_400].map((m, i) => ({ montant: m, exerciceId: `exAnt${i}` })),
        depreciations: [],
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel, systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL, jeuEtatsFinanciersSycebnl: jeu }),
        },
        immobilisation: {
            findFirst: jest.fn().mockResolvedValue(immo),
            findMany: jest.fn().mockResolvedValue([]),
            updateMany,
            update: jest.fn().mockResolvedValue(immo),
        },
        exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'exN', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }) },
        compte: {
            findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: `n${where.tenantId_numero.numero}`, numero: where.tenantId_numero.numero })),
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id, numero: '48520000' })),
        },
        dotationAmortissement: { create: jest.fn().mockResolvedValue({ id: 'dot1' }), delete: jest.fn() },
        ligneReevaluationBilan: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { deleteMany: jest.fn() },
        ecriture: { delete: jest.fn() },
    };
    let n = 0;
    const ecritures = {
        creer: jest.fn().mockImplementation((_t, _u, dto) => {
            n += 1;
            postees.push(dto);
            return Promise.resolve({ id: `e${n}` });
        }),
    };
    return { svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures), postees, updateMany };
}
const sortie = (o = {}) => ({
    dateSortie: '2026-09-30',
    type: 'MISE_HORS_SERVICE',
    exerciceId: 'exN',
    journalId: 'j1',
    natureSortie: 'VOL',
    referencePieceSortie: 'PV de constat n° 4',
    datePieceSortie: '2026-10-02',
    ...o,
});
describe('A14 · la sortie porte nature et pièce jusqu’à son écriture', () => {
    it('le bien garde nature, référence et date de la pièce ; les écritures portent la référence', async () => {
        const { svc, postees, updateMany } = harnais();
        await svc.sortir('t1', 'u1', 'i1', sortie());
        expect(updateMany.mock.calls[0][0].data).toMatchObject({
            natureSortie: 'VOL',
            referencePieceSortie: 'PV de constat n° 4',
            datePieceSortie: new Date('2026-10-02'),
        });
        const sortieEcr = postees.find((e) => e.libelle.startsWith('Mise hors service'));
        expect(sortieEcr.libelle).toBe('Mise hors service (vol) · Camion');
        expect(postees.every((e) => e.reference === 'PV de constat n° 4')).toBe(true);
        expect(sortieEcr.lignes.find((l) => l.compteId === 'n81200000').debit).toBe(5_400);
    });
    it('une nature qui ne convient pas refuse AVANT le verrou', async () => {
        const { svc, postees, updateMany } = harnais();
        await expect(svc.sortir('t1', 'u1', 'i1', sortie({ natureSortie: 'REMISE_GRATUITE' }))).rejects.toThrow(/§ 2.5.2/);
        expect(updateMany).not.toHaveBeenCalled();
        expect(postees).toEqual([]);
    });
    it('une pièce sans référence refuse AVANT le verrou', async () => {
        const { svc, updateMany } = harnais();
        await expect(svc.sortir('t1', 'u1', 'i1', sortie({ referencePieceSortie: '  ' }))).rejects.toThrow(/art\. 17/);
        expect(updateMany).not.toHaveBeenCalled();
    });
    it('une sortie interne sans nature (renouvellement) passe comme avant, sans référence', async () => {
        const { svc, postees, updateMany } = harnais();
        await svc.sortir('t1', 'u1', 'i1', { dateSortie: '2026-09-30', type: 'MISE_HORS_SERVICE', exerciceId: 'exN', journalId: 'j1' });
        expect(updateMany.mock.calls[0][0].data).toMatchObject({ natureSortie: null, referencePieceSortie: null, datePieceSortie: null });
        expect(postees.find((e) => e.libelle === 'Mise hors service · Camion').reference).toBeUndefined();
    });
    it('l’échange déclare sa nature par son propre geste', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'immobilisation.service.ts'), 'utf8');
        const echanger = source.slice(source.indexOf('async echanger('), source.indexOf('async sortir('));
        expect(echanger).toMatch(/natureSortie: 'ECHANGE'/);
        expect(echanger).toMatch(/\{ depuisEchange: true \}/);
    });
});
//# sourceMappingURL=nature-sortie.spec.js.map