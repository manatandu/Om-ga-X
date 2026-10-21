"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const contrepartie_acquisition_1 = require("./contrepartie-acquisition");
const immobilisation_service_1 = require("./immobilisation.service");
const SYSCO = client_1.Referentiel.SYSCOHADA;
const EBNL = client_1.Referentiel.SYCEBNL;
describe('contrepartie d’une acquisition d’immobilisation', () => {
    it('admet trésorerie, fournisseurs d’investissements et apports, refuse charges, clients et TVA', () => {
        for (const ok of ['52110000', '57110000', '48120000', '40420000', '46110000', '10130000', '72210000']) {
            expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', ok)).toBe(true);
        }
        for (const ko of ['60100000', '41110000', '44520000', '40110000', '10610000', '48130000', '58100000']) {
            expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', ko)).toBe(false);
        }
    });
    it('le fournisseur suit la nature du bien · 4811 pour un incorporel, 4812 pour un corporel', () => {
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '21300000', '48110000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '21300000', '48120000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', '48110000')).toBe(false);
    });
    it('chaque texte ses propres comptes · 16 et 45 au SYCEBNL, 46 au SYSCOHADA seulement', () => {
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '16200000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '45110000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '46110000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '16100000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '10300000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', '16200000')).toBe(false);
    });
    it('au SYCEBNL, la réserve de propriété et les factures non parvenues suivent la nature du bien', () => {
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '48161000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '48181000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '21300000', '48162000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '21300000', '48182000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '48162000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '48182000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '21300000', '48161000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '21300000', '48181000')).toBe(true);
        expect((0, contrepartie_acquisition_1.racinesContrepartieAcquisition)(EBNL, '24420000')).toEqual(['101', '102', '104', '162', '163', '164', '165', '167', '45', '4812', '48162', '48182', '4822', '52', '53', '55', '57', '249', '252', '14', '72']);
        expect((0, contrepartie_acquisition_1.racinesContrepartieAcquisition)(EBNL, '21300000')).toEqual(['101', '102', '104', '162', '163', '164', '165', '167', '45', '4811', '48161', '48181', '4821', '52', '53', '55', '57', '251', '14', '72']);
    });
    it('au SYSCOHADA, le 4816 et le 4818 non subdivisés restent communs aux deux natures', () => {
        for (const immo of ['21300000', '24420000']) {
            expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, immo, '48160000')).toBe(true);
            expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, immo, '48180000')).toBe(true);
        }
    });
    it('ce que la fiche du bien ajoute · AUDCIF Titre VII, classe 2 (passe R1, A2)', () => {
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '23110000', '23910000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '21300000', '21930000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '22200000', '22920000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', '24910000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', '23910000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '23910000', '23910000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '21300000', '25100000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '21300000', '25200000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', '25200000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '26110000', '48130000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '27400000', '48130000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', '48130000')).toBe(false);
        const demantelement = { typeComposant: client_1.TypeComposant.DEMANTELEMENT };
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', '19840000', demantelement)).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', '19840000', { typeComposant: client_1.TypeComposant.COMPOSANT })).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', '19840000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '19840000', demantelement)).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '19840000', { typeComposant: client_1.TypeComposant.COMPOSANT })).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '19840000')).toBe(false);
    });
    it('ce que la fiche du bien ajoute · SYCEBNL Partie 2 ch. 3 (passe R5, B2)', () => {
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '14110000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '20300000', '17200000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '20300000', '17100000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '20110000', '17100000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '17200000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '23110000', '23910000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '24910000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '21300000', '21930000')).toBe(false);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '25200000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '26100000', '48130000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '24420000', '72200000')).toBe(true);
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(EBNL, '22200000', '72200000')).toBe(false);
    });
    it('le refus cite la fiche du compte du bien', () => {
        expect((0, contrepartie_acquisition_1.motifRefusContrepartie)(SYSCO, '24420000', '60100000')).toContain('AUDCIF, Titre VII, fiche du compte 24');
        expect((0, contrepartie_acquisition_1.motifRefusContrepartie)(EBNL, '26100000', '60100000')).toContain('SYCEBNL, Partie 2 ch. 3, fiche du compte 26');
        expect((0, contrepartie_acquisition_1.motifRefusContrepartie)(EBNL, '24420000', '52110000')).toBeNull();
    });
    it('chaque racine admise ouvre au moins un compte dans le semis de son référentiel', () => {
        const semis = {
            [SYSCO]: (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../comptes/compte-seed-syscohada.ts'), 'utf8'),
            [EBNL]: (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../comptes/compte-seed.ts'), 'utf8'),
        };
        for (const ref of [SYSCO, EBNL]) {
            for (const immo of ['21300000', '24420000']) {
                const orphelines = (0, contrepartie_acquisition_1.racinesContrepartieAcquisition)(ref, immo).filter((r) => !new RegExp(`'${r}\\d*'`).test(semis[ref]));
                expect(orphelines.filter((r) => !(ref === EBNL && ['4821', '4822'].includes(r)))).toEqual([]);
            }
        }
    });
    it('la création refuse une contrepartie hors liste, avant toute écriture', async () => {
        const creerEcriture = jest.fn();
        const prisma = {
            familleImmobilisation: { findFirst: jest.fn().mockResolvedValue({ id: 'f1', estActif: true, compteImmobilisationId: 'cimmo', dureeAmortissementAns: 5 }) },
            exercice: { findFirst: jest.fn().mockResolvedValue({ dateDebut: new Date('2026-01-01') }) },
            compte: {
                findFirst: jest.fn(({ where }) => Promise.resolve(where.id === 'cimmo' ? { id: 'cimmo', numero: '24420000' } : where.id === 'c601' ? { id: 'c601', numero: '60100000' } : null)),
            },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        };
        const svc = new immobilisation_service_1.ImmobilisationService(prisma, { creer: creerEcriture });
        await expect(svc.creer('t1', 'u1', {
            familleId: 'f1',
            designation: 'Ordinateur',
            dateAcquisition: '2026-03-01',
            dateMiseEnService: '2026-03-01',
            valeurOrigine: 1000,
            exerciceId: 'ex',
            journalId: 'j',
            compteContrepartieId: 'c601',
        })).rejects.toThrow("n'est pas une contrepartie d'acquisition");
        expect(creerEcriture).not.toHaveBeenCalled();
    });
    it('la liste servie à l’écran reçoit le type du composant · câblage du 1984', async () => {
        const findMany = jest.fn().mockResolvedValue([]);
        const prisma = {
            tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: SYSCO }) },
            familleImmobilisation: {
                findFirst: jest.fn().mockResolvedValue({ compteImmobilisation: { numero: '24420000' } }),
            },
            compte: { findMany },
        };
        const svc = new immobilisation_service_1.ImmobilisationService(prisma, {});
        await svc.contrepartiesAcquisition('t1', { familleId: 'f1' }, client_1.TypeComposant.DEMANTELEMENT);
        const racines = findMany.mock.calls[0][0].where.OR.map((o) => o.numero.startsWith);
        expect(racines).toContain('1984');
        await svc.contrepartiesAcquisition('t1', { familleId: 'f1' });
        const sans = findMany.mock.calls[1][0].where.OR.map((o) => o.numero.startsWith);
        expect(sans).not.toContain('1984');
    });
    it('au Système minimal de trésorerie, le 1984 n’est plus offert (aucun poste de provision)', async () => {
        const findMany = jest.fn().mockResolvedValue([]);
        const prisma = {
            tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: EBNL, jeuEtatsFinanciersSycebnl: 'SYSTEME_MINIMAL_TRESORERIE' }) },
            familleImmobilisation: {
                findFirst: jest.fn().mockResolvedValue({ compteImmobilisation: { numero: '24420000' } }),
            },
            compte: { findMany },
        };
        const svc = new immobilisation_service_1.ImmobilisationService(prisma, {});
        await svc.contrepartiesAcquisition('t1', { familleId: 'f1' }, client_1.TypeComposant.DEMANTELEMENT);
        const racines = findMany.mock.calls[0][0].where.OR.map((o) => o.numero.startsWith);
        expect(racines).not.toContain('1984');
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(SYSCO, '24420000', '19840000', { typeComposant: client_1.TypeComposant.DEMANTELEMENT, systemeMinimal: true })).toBe(false);
    });
});
//# sourceMappingURL=contrepartie-acquisition.spec.js.map