"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const immobilisation_dto_1 = require("./dto/immobilisation.dto");
const amortissement_degressif_1 = require("./amortissement-degressif");
const degressif_service_1 = require("./degressif.service");
const EXERCICE = { id: 'ex2026', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
function harnaisCreation() {
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
        exercice: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.id === EXERCICE.id && where.tenantId === 't1' ? EXERCICE : null)),
        },
        compte: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.tenantId !== 't1'
                ? null
                : where.id === 'c521'
                    ? { id: 'c521', numero: '52110000' }
                    : where.id === 'cimmo'
                        ? { id: 'cimmo', numero: '24420000' }
                        : null)),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        immobilisation: {
            create: jest.fn(({ data }) => {
                creations.push(data);
                return Promise.resolve({ ...data, id: 'i1', valeurOrigine: 0, valeurResiduelle: 0, prixCession: null, dotations: [] });
            }),
        },
    };
    const ecritures = { creer: jest.fn().mockResolvedValue({ id: 'eAcq' }) };
    return { svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures), creations };
}
const ACQUIS = {
    familleId: 'f1',
    designation: 'Groupe électrogène livré en pièces',
    dateAcquisition: '2026-03-15',
    valeurOrigine: 50_000_000,
    exerciceId: 'ex2026',
    compteContrepartieId: 'c521',
    journalId: 'j1',
};
describe('création · la date de mise en service peut manquer', () => {
    it('un bien acquis sans date naît « non mis en service » · la fiche porte null, jamais une date inventée', async () => {
        const { svc, creations } = harnaisCreation();
        await svc.creer('t1', 'u1', ACQUIS);
        expect(creations).toHaveLength(1);
        expect(creations[0].dateMiseEnService).toBeNull();
    });
    it('une date fournie est gardée', async () => {
        const { svc, creations } = harnaisCreation();
        await svc.creer('t1', 'u1', { ...ACQUIS, dateMiseEnService: '2026-04-01' });
        expect(creations[0].dateMiseEnService.toISOString().slice(0, 10)).toBe('2026-04-01');
    });
    it('un bien repris déjà amorti a forcément été mis en service · sans date, refusé', async () => {
        const { svc, creations } = harnaisCreation();
        await expect(svc.creer('t1', 'u1', {
            ...ACQUIS,
            dateAcquisition: '2022-03-15',
            repris: true,
            amortissementAnterieur: 10_000_000,
            compteContrepartieId: undefined,
            journalId: undefined,
        })).rejects.toThrow(/mis en service/);
        expect(creations).toEqual([]);
    });
    it('la nature du barème fiscal est gardée quand elle existe, refusée sinon', async () => {
        const ok = harnaisCreation();
        await ok.svc.creer('t1', 'u1', { ...ACQUIS, natureFiscaleCle: 'I.1' });
        expect(ok.creations[0].natureFiscaleCle).toBe('I.1');
        const ko = harnaisCreation();
        await expect(ko.svc.creer('t1', 'u1', { ...ACQUIS, natureFiscaleCle: 'XX.99' })).rejects.toThrow(/absente du barème/);
        expect(ko.creations).toEqual([]);
    });
    it('le DTO laisse la date absente, et refuse une date illisible', async () => {
        const base = {
            familleId: '3f1c9a52-1f3b-4c8e-9d1a-2b6f0e7c4a10',
            designation: 'Groupe',
            dateAcquisition: '2026-03-15',
            valeurOrigine: 1_000,
            exerciceId: '7b2e4d61-8c9a-4f3e-a1b2-c3d4e5f60718',
        };
        expect(await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(immobilisation_dto_1.CreerImmobilisationDto, base))).toEqual([]);
        const illisible = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(immobilisation_dto_1.CreerImmobilisationDto, { ...base, dateMiseEnService: 'demain' }));
        expect(illisible.map((e) => e.property)).toContain('dateMiseEnService');
    });
});
function harnaisMiseEnService(immo, echecCourse = false) {
    const update = jest.fn(({ where, data }) => {
        if (echecCourse) {
            return Promise.reject(new client_1.Prisma.PrismaClientKnownRequestError('course', { code: 'P2025', clientVersion: 'x' }));
        }
        return Promise.resolve({ id: where.id, ...data });
    });
    const updateMany = jest.fn();
    const prisma = {
        immobilisation: {
            findFirst: jest.fn(({ where }) => Promise.resolve(immo && where.id === 'i1' && where.tenantId === 't1' ? { depreciations: [], ...immo } : null)),
            update,
            updateMany,
        },
        coutEmpruntIncorpore: { aggregate: jest.fn().mockResolvedValue({ _max: { dateFin: null } }) },
        ligneReevaluationBilan: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return { svc: new immobilisation_service_1.ImmobilisationService(prisma, {}), update, updateMany };
}
const EN_ATTENTE = { id: 'i1', dateAcquisition: new Date('2026-03-15'), dateMiseEnService: null, statut: 'EN_SERVICE' };
describe('route de mise en service', () => {
    it('pose la date par une écriture UNITAIRE, conditionnée à une date encore nulle', async () => {
        const { svc, update, updateMany } = harnaisMiseEnService(EN_ATTENTE);
        await svc.mettreEnService('t1', 'u1', 'i1', { date: '2026-05-02' });
        expect(updateMany).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledTimes(1);
        const arg = update.mock.calls[0][0];
        expect(arg.where).toEqual({ id: 'i1', tenantId: 't1', dateMiseEnService: null });
        expect(arg.data.dateMiseEnService.toISOString().slice(0, 10)).toBe('2026-05-02');
    });
    it('une seule fois · un bien déjà mis en service est refusé en 409, sans écriture', async () => {
        const { svc, update } = harnaisMiseEnService({ ...EN_ATTENTE, dateMiseEnService: new Date('2026-04-01') });
        await expect(svc.mettreEnService('t1', 'u1', 'i1', { date: '2026-05-02' })).rejects.toMatchObject({ status: 409 });
        expect(update).not.toHaveBeenCalled();
    });
    it('jamais avant l’acquisition', async () => {
        const { svc, update } = harnaisMiseEnService(EN_ATTENTE);
        await expect(svc.mettreEnService('t1', 'u1', 'i1', { date: '2026-03-14' })).rejects.toThrow(/précéder l'acquisition/);
        expect(update).not.toHaveBeenCalled();
    });
    it('le jour même de l’acquisition est admis', async () => {
        const { svc, update } = harnaisMiseEnService(EN_ATTENTE);
        await svc.mettreEnService('t1', 'u1', 'i1', { date: '2026-03-15' });
        expect(update).toHaveBeenCalledTimes(1);
    });
    it('un bien sorti n’a plus de plan à ouvrir', async () => {
        const { svc, update } = harnaisMiseEnService({ ...EN_ATTENTE, statut: 'CEDEE' });
        await expect(svc.mettreEnService('t1', 'u1', 'i1', { date: '2026-05-02' })).rejects.toThrow(/sorti de l'actif/);
        expect(update).not.toHaveBeenCalled();
    });
    it('le bien d’un autre dossier n’existe pas', async () => {
        const { svc, update } = harnaisMiseEnService(EN_ATTENTE);
        await expect(svc.mettreEnService('t2', 'u1', 'i1', { date: '2026-05-02' })).rejects.toMatchObject({ status: 404 });
        expect(update).not.toHaveBeenCalled();
    });
    it('une course perdue contre un autre poste rend un 409 nommé, jamais une erreur de base', async () => {
        const { svc } = harnaisMiseEnService(EN_ATTENTE, true);
        await expect(svc.mettreEnService('t1', 'u1', 'i1', { date: '2026-05-02' })).rejects.toMatchObject({ status: 409 });
    });
    it('le DTO exige la date', async () => {
        const erreurs = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(immobilisation_dto_1.MiseEnServiceDto, {}));
        expect(erreurs.map((e) => e.property)).toEqual(['date']);
    });
});
function bienTableau(dateMiseEnService) {
    return {
        id: 'a',
        designation: 'Groupe en attente',
        numeroInventaire: null,
        compteImmobilisation: { id: 'c', numero: '24420000', intitule: 'Matériel' },
        dateAcquisition: new Date('2026-03-15'),
        dateMiseEnService,
        valeurOrigine: 12_000,
        valeurResiduelle: 0,
        dureeAmortissementAns: 5,
        amortissementAnterieur: 0,
        modeAmortissement: 'LINEAIRE',
        statut: 'EN_SERVICE',
        dateSortie: null,
        dotations: [],
        depreciations: [],
    };
}
function serviceTableau(biens) {
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL,
            }),
        },
        immobilisation: { findMany: jest.fn().mockResolvedValue(biens) },
        exercice: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.id === EXERCICE.id && where.tenantId === 't1' ? EXERCICE : null)),
        },
    };
    return new immobilisation_service_1.ImmobilisationService(prisma, {});
}
describe('aucune dotation tant que le bien n’est pas mis en service', () => {
    it('tableau des amortissements · dotation nulle et douze mois vides', async () => {
        const t = await serviceTableau([bienTableau(null)]).tableauAmortissements('t1', EXERCICE.id);
        const l = t.groupes[0].lignes[0];
        expect(l.dotation).toBe(0);
        expect(l.parMois.every((m) => m === 0)).toBe(true);
    });
    it('le même bien mis en service en juin est doté · la seule différence est la date', async () => {
        const t = await serviceTableau([bienTableau(new Date('2026-06-01'))]).tableauAmortissements('t1', EXERCICE.id);
        expect(t.groupes[0].lignes[0].dotation).toBeGreaterThan(0);
    });
    it('passer la dotation est refusé, et le refus dit pourquoi', async () => {
        const prisma = {
            immobilisation: {
                findFirst: jest.fn().mockResolvedValue({ ...bienTableau(null), famille: null }),
            },
            exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
            tenant: {
                findUniqueOrThrow: jest.fn().mockResolvedValue({
                    referentiel: client_1.Referentiel.SYSCOHADA,
                    systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL,
                }),
            },
            dotationAmortissement: { findUnique: jest.fn().mockResolvedValue(null) },
            ligneReevaluationBilan: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        const creer = jest.fn();
        const svc = new immobilisation_service_1.ImmobilisationService(prisma, { creer });
        await expect(svc.passerDotation('t1', 'u1', 'a', { exerciceId: EXERCICE.id, journalId: 'j1' })).rejects.toThrow(/pas encore mis en service/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('plan fiscal dégressif · aucun exercice sans date de mise en service', () => {
        const exercices = [EXERCICE];
        expect((0, amortissement_degressif_1.planFiscalDegressif)({ base: 10_000, dureeFiscaleAns: 5, dateMiseEnService: null, exercices })).toEqual([]);
        expect((0, amortissement_degressif_1.planFiscalDegressif)({ base: 10_000, dureeFiscaleAns: 5, dateMiseEnService: new Date('2026-01-01'), exercices })).toHaveLength(1);
    });
    it('dérogatoire · refusé et nommé sur un bien pas encore mis en service', async () => {
        const prisma = {
            immobilisation: {
                findFirst: jest.fn().mockResolvedValue({
                    ...bienTableau(null),
                    degressifFiscal: true,
                    dureeFiscaleAns: 5,
                    compteImmobilisation: { numero: '24420000' },
                    derogatoires: [],
                }),
            },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL' }) },
            exercice: { findMany: jest.fn().mockResolvedValue([EXERCICE]) },
        };
        const creer = jest.fn();
        const svc = new degressif_service_1.DegressifService(prisma, { creer });
        await expect(svc.passer('t1', 'u1', 'a', { exerciceId: EXERCICE.id, journalId: 'j1' })).rejects.toThrow(/pas encore mis en service/);
        expect(creer).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=mise-en-service.spec.js.map