"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const immobilisation_service_1 = require("./immobilisation.service");
const immobilisation_dto_1 = require("./dto/immobilisation.dto");
function harnais() {
    const creations = [];
    const ecrituresPostees = [];
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
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'ex2026' && where.tenantId === 't1' ? { dateDebut: new Date('2026-01-01') } : null)),
        },
        compte: {
            findFirst: jest
                .fn()
                .mockImplementation(({ where }) => Promise.resolve(where.tenantId !== 't1'
                ? null
                : where.id === 'c521'
                    ? { id: 'c521', numero: '52110000' }
                    : where.id === 'cimmo'
                        ? { id: 'cimmo', numero: '24420000' }
                        : null)),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        immobilisation: {
            create: jest.fn().mockImplementation(({ data }) => {
                creations.push(data);
                return Promise.resolve({ ...data, id: 'i1', valeurOrigine: 0, valeurResiduelle: 0, prixCession: null, dotations: [] });
            }),
        },
    };
    const ecritures = {
        creer: jest.fn().mockImplementation((_t, _u, dto) => {
            ecrituresPostees.push({ date: dto.date, journalId: dto.journalId });
            return Promise.resolve({ id: 'eAcq' });
        }),
    };
    return { svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures), creations, ecrituresPostees };
}
const CAMION = {
    familleId: 'f1',
    designation: 'Camion',
    dateAcquisition: '2022-03-15',
    dateMiseEnService: '2022-04-01',
    valeurOrigine: 50_000_000,
    exerciceId: 'ex2026',
};
describe('F32 · la fiche d’un bien repris naît sans écriture', () => {
    it('acquis avant l’ouverture et déclaré repris · aucune écriture, fiche sans acquisition, antérieur conservé', async () => {
        const { svc, creations, ecrituresPostees } = harnais();
        await svc.creer('t1', 'u1', { ...CAMION, repris: true, amortissementAnterieur: 30_000_000 });
        expect(ecrituresPostees).toEqual([]);
        expect(creations).toHaveLength(1);
        expect(creations[0]).toMatchObject({ ecritureAcquisitionId: null, amortissementAnterieur: 30_000_000 });
    });
    it('un bien repris n’a besoin ni de contrepartie ni de journal', async () => {
        const { svc, creations } = harnais();
        await svc.creer('t1', 'u1', { ...CAMION, repris: true });
        expect(creations).toHaveLength(1);
    });
    it('repris mais acquis dans l’exercice · refusé, rien n’est créé', async () => {
        const { svc, creations, ecrituresPostees } = harnais();
        await expect(svc.creer('t1', 'u1', { ...CAMION, dateAcquisition: '2026-02-01', dateMiseEnService: '2026-02-01', repris: true })).rejects.toThrow(/acquis avant le 2026-01-01/);
        expect(creations).toEqual([]);
        expect(ecrituresPostees).toEqual([]);
    });
    it('acquis le jour de l’ouverture n’est pas repris · la borne est stricte', async () => {
        const { svc } = harnais();
        await expect(svc.creer('t1', 'u1', { ...CAMION, dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01', repris: true })).rejects.toThrow(/déjà porté au bilan d'ouverture/);
    });
    it('l’amortissement antérieur reste plafonné à la base amortissable', async () => {
        const { svc, creations } = harnais();
        await expect(svc.creer('t1', 'u1', { ...CAMION, repris: true, amortissementAnterieur: 60_000_000 })).rejects.toThrow(/dépasse la base/);
        expect(creations).toEqual([]);
    });
    it('l’exercice d’un autre dossier n’existe pas', async () => {
        const { svc, creations } = harnais();
        await expect(svc.creer('t2', 'u1', { ...CAMION, repris: true })).rejects.toThrow(/Exercice introuvable/);
        expect(creations).toEqual([]);
    });
});
describe('F32 · un bien acquis garde son écriture, et seulement dans l’exercice', () => {
    const ACQUIS = {
        ...CAMION,
        dateAcquisition: '2026-03-15',
        dateMiseEnService: '2026-04-01',
        compteContrepartieId: 'c521',
        journalId: 'j1',
    };
    it('acquis dans l’exercice · l’écriture est postée à la date d’acquisition et liée à la fiche', async () => {
        const { svc, creations, ecrituresPostees } = harnais();
        await svc.creer('t1', 'u1', ACQUIS);
        expect(ecrituresPostees).toEqual([{ date: '2026-03-15', journalId: 'j1' }]);
        expect(creations[0]).toMatchObject({ ecritureAcquisitionId: 'eAcq' });
    });
    it('acquis avant l’ouverture sans être déclaré repris · refusé, avec les deux issues', async () => {
        const { svc, creations, ecrituresPostees } = harnais();
        const refus = svc.creer('t1', 'u1', { ...ACQUIS, dateAcquisition: '2025-12-20', dateMiseEnService: '2025-12-20' });
        await expect(refus).rejects.toThrow(/bien repris/);
        await expect(refus).rejects.toThrow(/exercice de l'acquisition/);
        expect(ecrituresPostees).toEqual([]);
        expect(creations).toEqual([]);
    });
    it('un amortissement antérieur sur un bien acquis dans l’exercice est refusé', async () => {
        const { svc, ecrituresPostees } = harnais();
        await expect(svc.creer('t1', 'u1', { ...ACQUIS, amortissementAnterieur: 1_000 })).rejects.toThrow(/ne vaut que pour un bien repris/);
        expect(ecrituresPostees).toEqual([]);
    });
    it('sans contrepartie ou sans journal, rien n’est posté', async () => {
        for (const manque of ['compteContrepartieId', 'journalId']) {
            const { svc, ecrituresPostees } = harnais();
            const dto = { ...ACQUIS };
            delete dto[manque];
            await expect(svc.creer('t1', 'u1', dto)).rejects.toThrow(/financement/);
            expect(ecrituresPostees).toEqual([]);
        }
    });
    it('une contrepartie d’un autre dossier est refusée avant l’écriture', async () => {
        const { svc, ecrituresPostees } = harnais();
        await expect(svc.creer('t1', 'u1', { ...ACQUIS, compteContrepartieId: 'autre' })).rejects.toThrow(/contrepartie introuvable/);
        expect(ecrituresPostees).toEqual([]);
    });
});
describe('F32 · la porte de la route laisse passer un bien repris', () => {
    it('le DTO valide un bien repris sans contrepartie ni journal', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(immobilisation_dto_1.CreerImmobilisationDto, {
            familleId: '3f1c9a52-1f3b-4c8e-9d1a-2b6f0e7c4a10',
            designation: 'Camion',
            dateAcquisition: '2022-03-15',
            dateMiseEnService: '2022-04-01',
            valeurOrigine: 50_000_000,
            amortissementAnterieur: 30_000_000,
            exerciceId: '7b2e4d61-8c9a-4f3e-a1b2-c3d4e5f60718',
            repris: true,
        });
        expect(await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    });
});
//# sourceMappingURL=bien-repris-f32.spec.js.map