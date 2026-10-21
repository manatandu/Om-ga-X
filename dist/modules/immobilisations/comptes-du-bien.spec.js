"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const comptes_du_bien_1 = require("./comptes-du-bien");
const immobilisation_service_1 = require("./immobilisation.service");
const SYSCO = client_1.Referentiel.SYSCOHADA;
const EBNL = client_1.Referentiel.SYCEBNL;
describe('biens que le plan ne fait pas amortir (passe R1, A1 et R5, B1)', () => {
    it('SYCEBNL · la division 20 ne s’amortit pas, sauf l’usufruit temporaire (2011)', () => {
        expect((0, comptes_du_bien_1.motifNonAmortissable)('20300000', EBNL)).toContain('ne doivent pas être amortis');
        expect((0, comptes_du_bien_1.motifNonAmortissable)('20110000', EBNL)).toBeNull();
    });
    it('25, 26 et 27 n’ont aucun compte 28, dans les deux plans', () => {
        for (const ref of [SYSCO, EBNL]) {
            for (const compte of ['25200000', '26110000', '27400000']) {
                expect((0, comptes_du_bien_1.motifNonAmortissable)(compte, ref)).toContain("aucun compte d'amortissement");
            }
        }
    });
    it('les terrains hors 221 et 224 ne s’amortissent pas · le 282 ne s’ouvre que sur le 2824', () => {
        for (const compte of ['22210000', '22310000', '22510000', '22610000', '22700000', '22810000']) {
            expect((0, comptes_du_bien_1.motifNonAmortissable)(compte, SYSCO)).toContain('2824');
        }
        expect((0, comptes_du_bien_1.motifNonAmortissable)('22110000', SYSCO)).toBeNull();
        expect((0, comptes_du_bien_1.motifNonAmortissable)('22410000', SYSCO)).toBeNull();
        expect((0, comptes_du_bien_1.motifNonAmortissable)('23110000', SYSCO)).toBeNull();
        expect((0, comptes_du_bien_1.motifNonAmortissable)('24410000', EBNL)).toBeNull();
    });
    it('la prémisse du 282 se relit dans les deux semis · seul le 2824 y est ouvert', () => {
        for (const fichier of ['compte-seed-syscohada.ts', 'compte-seed.ts']) {
            const semis = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../comptes', fichier), 'utf8');
            const sous282 = semis.match(/'282\d{5}'/g) ?? [];
            expect(sous282).toEqual(["'28240000'"]);
        }
    });
});
describe('le 28 et le 29 suivent la division du bien, au SYSCOHADA (passe R1, A4)', () => {
    it('refuse un bâtiment amorti au 2844 et un matériel déprécié au 293', () => {
        expect((0, comptes_du_bien_1.motifRefusCompteAmortissement)(SYSCO, '23130000', '28440000')).toContain('attendu un 283');
        expect((0, comptes_du_bien_1.motifRefusCompteAmortissement)(SYSCO, '23130000', '28310000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusCompteDepreciation)(SYSCO, '24410000', '29310000')).toContain('attendu un 294');
        expect((0, comptes_du_bien_1.motifRefusCompteDepreciation)(SYSCO, '26110000', '29610000')).toBeNull();
    });
    it('le SYCEBNL n’est pas visé', () => {
        expect((0, comptes_du_bien_1.motifRefusCompteAmortissement)(EBNL, '23130000', '28440000')).toBeNull();
    });
    it('la création d’une famille refuse le 28 d’une autre division, avant toute écriture', async () => {
        const comptes = {
            cimmo: { numero: '23130000', classe: 'CLASSE_2' },
            c28: { numero: '28440000', classe: 'CLASSE_2' },
            c68: { numero: '68130000', classe: 'CLASSE_6' },
        };
        const create = jest.fn();
        const prisma = {
            compte: {
                findFirst: jest.fn(({ where }) => Promise.resolve(comptes[where.id] ?? null)),
            },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: SYSCO }) },
            familleImmobilisation: { findUnique: jest.fn().mockResolvedValue(null), create },
        };
        const svc = new immobilisation_service_1.ImmobilisationService(prisma, {});
        const dto = {
            code: 'BAT',
            intitule: 'Bâtiments',
            compteImmobilisationId: 'cimmo',
            compteAmortissementId: 'c28',
            compteDotationId: 'c68',
            dureeAmortissementAns: 20,
        };
        await expect(svc.creerFamille('t1', dto)).rejects.toThrow(/attendu un 283/);
        expect(create).not.toHaveBeenCalled();
        comptes.c28 = { numero: '28310000', classe: 'CLASSE_2' };
        await svc.creerFamille('t1', dto);
        expect(create).toHaveBeenCalledTimes(1);
    });
});
describe('la contrepartie d’une dépréciation, au SYSCOHADA (passe R1, A5)', () => {
    it('dotation sur 691, 697 ou 853 ; reprise sur 791, 797 ou 863', () => {
        expect(comptes_du_bien_1.CONTREPARTIES_DEPRECIATION_SYSCOHADA[client_1.SensDepreciation.DOTATION]).toEqual(['691', '697', '853']);
        expect(comptes_du_bien_1.CONTREPARTIES_DEPRECIATION_SYSCOHADA[client_1.SensDepreciation.REPRISE]).toEqual(['791', '797', '863']);
        expect((0, comptes_du_bien_1.motifRefusContrepartieDepreciation)(SYSCO, client_1.SensDepreciation.DOTATION, '68130000')).toContain('fiche du compte 29');
        expect((0, comptes_du_bien_1.motifRefusContrepartieDepreciation)(SYSCO, client_1.SensDepreciation.REPRISE, '75800000')).not.toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieDepreciation)(SYSCO, client_1.SensDepreciation.DOTATION, '85300000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieDepreciation)(SYSCO, client_1.SensDepreciation.REPRISE, '86300000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieDepreciation)(EBNL, client_1.SensDepreciation.DOTATION, '68130000')).toBeNull();
    });
});
describe('la créance née d’une cession, au SYSCOHADA (passe R1, B6)', () => {
    it('H.A.O. · jamais un 41 ; courante · jamais un 485 ; le reste reste libre', () => {
        expect((0, comptes_du_bien_1.motifRefusContrepartieCession)(SYSCO, false, '41110000')).toContain('485');
        expect((0, comptes_du_bien_1.motifRefusContrepartieCession)(SYSCO, false, '41420000')).not.toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieCession)(SYSCO, false, '48520000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieCession)(SYSCO, true, '48520000')).toContain('414');
        expect((0, comptes_du_bien_1.motifRefusContrepartieCession)(SYSCO, true, '41420000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieCession)(SYSCO, false, '51300000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieCession)(SYSCO, false, '26110000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieCession)(EBNL, false, '41110000')).toBeNull();
    });
});
//# sourceMappingURL=comptes-du-bien.spec.js.map