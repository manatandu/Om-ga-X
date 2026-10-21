"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const mentions_immatriculation_1 = require("./mentions-immatriculation");
const mentions_societe_1 = require("./mentions-societe");
const facturation_service_1 = require("../facturation/facturation.service");
const commercial_service_1 = require("../commercial/commercial.service");
const tenant_service_1 = require("./tenant.service");
const export_service_1 = require("../exports/export.service");
const classeur_en_flux_1 = require("../exports/classeur-en-flux");
const id = (forme, extra = {}) => ({
    referentiel: client_1.Referentiel.SYSCOHADA,
    formeJuridiqueSyscohada: forme,
    rccm: null,
    ...extra,
});
describe('AUDCG art. 59 · toute personne immatriculée, pas les seules sociétés', () => {
    it('le commerçant personne physique porte son RCCM, ou le manque se dit', () => {
        expect((0, mentions_immatriculation_1.mentionImmatriculation)(id(client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, { rccm: 'CD/KIN/RCCM/23-A-1' }))).toEqual({
            ligne: 'RCCM CD/KIN/RCCM/23-A-1',
            manquantes: [],
        });
        expect((0, mentions_immatriculation_1.mentionImmatriculation)(id(client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE)).manquantes.join(' ')).toContain('AUDCG art. 59');
        expect((0, mentions_immatriculation_1.mentionImmatriculation)(id(client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE)).manquantes).toHaveLength(1);
        expect((0, mentions_immatriculation_1.mentionImmatriculation)(id(client_1.FormeJuridiqueSyscohada.SUCCURSALE)).manquantes).toHaveLength(1);
    });
    it('la coopérative n’est pas au RCCM (l’AUDCG se tait, l’AUSCOOP parle plus bas), l’entité publique ne se voit rien reprocher, une ASBL rien au titre de l’AUDCG', () => {
        expect((0, mentions_immatriculation_1.mentionImmatriculation)(id(client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE, { rccm: 'X' }))).toEqual({ ligne: null, manquantes: [] });
        expect((0, mentions_immatriculation_1.mentionImmatriculation)(id(client_1.FormeJuridiqueSyscohada.ENTITE_PUBLIQUE))).toEqual({ ligne: null, manquantes: [] });
        expect((0, mentions_immatriculation_1.mentionImmatriculation)(id(client_1.FormeJuridiqueSyscohada.ENTITE_PUBLIQUE, { rccm: 'R1' })).ligne).toBe('RCCM R1');
        expect((0, mentions_immatriculation_1.mentionImmatriculation)({ referentiel: client_1.Referentiel.SYCEBNL, formeJuridiqueSyscohada: null, rccm: 'R' })).toEqual({ ligne: null, manquantes: [] });
    });
    it('art. 62 et 64 · l’entreprenant porte sa déclaration d’activité et la mention littérale, jamais un RCCM', () => {
        const e = (0, mentions_immatriculation_1.mentionImmatriculation)(id(client_1.FormeJuridiqueSyscohada.ENTREPRENANT, { numeroDeclarationActivite: 'CD/KIN/D-7', rccm: 'IGNORÉ' }));
        expect(e.ligne).toBe(`N° de déclaration d’activité CD/KIN/D-7 (RCCM) · ${mentions_immatriculation_1.MENTION_ENTREPRENANT}`);
        expect(mentions_immatriculation_1.MENTION_ENTREPRENANT).toBe('Entreprenant dispensé d’immatriculation');
        expect((0, mentions_immatriculation_1.mentionImmatriculation)(id(client_1.FormeJuridiqueSyscohada.ENTREPRENANT)).manquantes.join(' ')).toContain('art. 62');
        expect((0, mentions_immatriculation_1.numeroRegistreLiasse)(id(client_1.FormeJuridiqueSyscohada.ENTREPRENANT, { numeroDeclarationActivite: 'D-7', rccm: 'R' }))).toContain('déclaration d’activité D-7');
        expect((0, mentions_immatriculation_1.numeroRegistreLiasse)(id(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, { rccm: 'R' }))).toBe('R');
    });
    it('art. 140 · le locataire-gérant en tête, quelle que soit la forme', () => {
        expect((0, mentions_immatriculation_1.mentionImmatriculation)(id(client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, { rccm: 'R', locataireGerantFonds: true })).ligne).toBe('Locataire-gérant du fonds de commerce · RCCM R');
        const societe = {
            ...id(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, { rccm: 'R', locataireGerantFonds: true }),
            nom: 'SARL',
            capitalSocial: 1000,
            capitalVariable: false,
            adresse: 'Av. 1',
            ville: 'Kinshasa',
            devise: 'CDF',
        };
        expect((0, mentions_societe_1.mentionsEmetteur)(societe).ligne).toMatch(/^Locataire-gérant du fonds de commerce · Société à responsabilité limitée/);
        expect((0, mentions_societe_1.mentionsRecopiees)({ ...societe, formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, capitalSocial: null }).ligne).toContain('RCCM R');
    });
});
describe('AUDCG art. 14 · le numéro sur les livres de commerce', () => {
    it('le segment dit le numéro, ou le manque, jamais un blanc', () => {
        expect((0, mentions_immatriculation_1.immatriculationDesLivres)(id(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, { rccm: 'R9' }))).toBe('RCCM R9');
        expect((0, mentions_immatriculation_1.immatriculationDesLivres)(id(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME))).toBe('RCCM non renseigné');
        expect((0, mentions_immatriculation_1.immatriculationDesLivres)(id(client_1.FormeJuridiqueSyscohada.ENTREPRENANT))).toContain('N° de déclaration d’activité non renseigné');
        expect((0, classeur_en_flux_1.segmentIdentification)({ entite: 'E', nif: 'N1', periode: 'p', devise: 'CDF', immatriculation: 'RCCM R9' })).toBe('NIF N1 · RCCM R9');
    });
    it('le cartouche des livres le lit dans le dossier', async () => {
        const prisma = {
            tenant: {
                findUniqueOrThrow: jest.fn().mockResolvedValue({
                    nom: 'Ets Kabila',
                    numeroImpot: 'A1',
                    devise: 'CDF',
                    referentiel: 'SYSCOHADA',
                    formeJuridiqueSyscohada: 'ENTREPRISE_INDIVIDUELLE',
                    rccm: 'CD/KIN/RCCM/24-A-5',
                }),
            },
            exercice: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        const svc = new export_service_1.ExportService(prisma, {}, {}, {}, {}, {}, {}, {}, {}, {});
        const identite = await svc.identiteEtat('t', {});
        expect(identite.immatriculation).toBe('RCCM CD/KIN/RCCM/24-A-5');
    });
});
describe('TenantService.modifierIdentite · les refus des art. 62, 64 et 138', () => {
    const service = (forme, referentiel = 'SYSCOHADA') => {
        const appels = [];
        const prisma = {
            tenant: {
                findUnique: async () => ({ id: 't1', referentiel, formeJuridiqueSyscohada: forme }),
                update: async (args) => {
                    appels.push(args);
                    return { id: 't1' };
                },
            },
        };
        const s = new tenant_service_1.TenantService(prisma);
        s.parametres = async () => null;
        return { s, appels };
    };
    it('un RCCM refusé à l’entreprenant, une déclaration d’activité refusée aux autres', async () => {
        await expect(service('ENTREPRENANT').s.modifierIdentite('t1', { rccm: 'R' })).rejects.toThrow(/art\. 64/);
        await expect(service('SOCIETE_ANONYME').s.modifierIdentite('t1', { numeroDeclarationActivite: 'D' })).rejects.toThrow(common_1.BadRequestException);
        const ok = service('ENTREPRENANT');
        await ok.s.modifierIdentite('t1', { numeroDeclarationActivite: ' D-7 ' });
        expect(ok.appels[0]).toMatchObject({ data: { numeroDeclarationActivite: 'D-7' } });
    });
    it('la location-gérance · refusée à l’entreprenant (art. 138), trois réponses sinon', async () => {
        await expect(service('ENTREPRENANT').s.modifierIdentite('t1', { locataireGerantFonds: 'OUI' })).rejects.toThrow(/art\. 138/);
        await expect(service(null, 'SYCEBNL').s.modifierIdentite('t1', { locataireGerantFonds: 'OUI' })).rejects.toThrow(common_1.BadRequestException);
        const ok = service('ENTREPRISE_INDIVIDUELLE');
        await ok.s.modifierIdentite('t1', { locataireGerantFonds: 'OUI' });
        await ok.s.modifierIdentite('t1', { locataireGerantFonds: 'PAS_ENCORE_DIT' });
        expect(ok.appels).toMatchObject([{ data: { locataireGerantFonds: true } }, { data: { locataireGerantFonds: null } }]);
    });
});
const cooperative = (extra = {}) => ({
    referentiel: client_1.Referentiel.SYSCOHADA,
    formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE,
    nom: 'COOPEC Tujenge',
    capitalSocial: 500000,
    capitalVariable: false,
    adresse: '3, av. des Palmiers',
    ville: 'Bukavu',
    rccm: null,
    devise: 'CDF',
    numeroRegistreCooperatives: 'CD/BKV/RSC/24-0012',
    varianteCooperative: client_1.VarianteCooperative.COOP_CA,
    ...extra,
});
describe('AUSCOOP art. 19 · la ligne de la coopérative', () => {
    it('forme mot pour mot (art. 268), siège et numéro au Registre des Sociétés Coopératives · jamais le capital', () => {
        expect((0, mentions_societe_1.mentionsEmetteur)(cooperative())).toEqual({
            ligne: "Société Coopérative avec Conseil d'Administration · COOP-CA · siège social : 3, av. des Palmiers, Bukavu · Registre des Sociétés Coopératives n° CD/BKV/RSC/24-0012",
            manquantes: [],
        });
        expect((0, mentions_societe_1.mentionsEmetteur)(cooperative({ varianteCooperative: client_1.VarianteCooperative.SCOOPS })).ligne).toMatch(/^Société Coopérative Simplifiée · SCOOPS · /);
    });
    it('chaque absence est NOMMÉE avec son article, un RCCM saisi n’y supplée pas', () => {
        const m = (0, mentions_societe_1.mentionsEmetteur)(cooperative({ varianteCooperative: null, adresse: null, numeroRegistreCooperatives: null, rccm: 'CD/KIN/RCCM/1' }));
        expect(m.ligne).toBe('siège social : Bukavu');
        expect(m.manquantes).toEqual([
            'forme de la société coopérative (AUSCOOP art. 19, 205 ou 268)',
            'adresse du siège social (AUSCOOP art. 19)',
            "numéro d'immatriculation au Registre des Sociétés Coopératives (AUSCOOP art. 19 et 74)",
        ]);
    });
    it('art. 183 · « société en liquidation » et le liquidateur sur les pièces datées de la dissolution ou après', () => {
        const dissoute = cooperative({ dateDissolution: new Date('2026-06-30'), liquidateurs: 'Me Kasongo' });
        expect((0, mentions_societe_1.mentionsEmetteur)(dissoute, new Date('2026-07-01')).ligne).toMatch(/^Société en liquidation · liquidateur : Me Kasongo · /);
        expect((0, mentions_societe_1.mentionsEmetteur)(dissoute, new Date('2026-06-29')).ligne).not.toBeNull();
        expect((0, mentions_societe_1.mentionsEmetteur)(dissoute, new Date('2026-06-29')).ligne).toMatch(/^Société Coopérative avec/);
        const sansNom = (0, mentions_societe_1.mentionsRecopiees)(cooperative({ dateDissolution: new Date('2026-06-30') }), new Date('2026-08-01'));
        expect(sansNom.ligne).toMatch(/^Société en liquidation · /);
        expect(sansNom.manquantes).toContain('nom du ou des liquidateurs (AUSCOOP art. 183)');
    });
    it('la liasse porte le numéro de la coopérative NOMMÉ, jamais nu', () => {
        expect((0, mentions_immatriculation_1.numeroRegistreLiasse)(id(client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE, { rccm: 'R', numeroRegistreCooperatives: 'RSC-9' }))).toBe('Registre des Sociétés Coopératives n° RSC-9');
        expect((0, mentions_immatriculation_1.numeroRegistreLiasse)(id(client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE, { rccm: 'R' }))).toBe('');
    });
});
describe('Loi n° 004/2001, art. 16 · la mention de l’ASBL', () => {
    const asbl = (extra = {}) => ({
        referentiel: client_1.Referentiel.SYCEBNL,
        formeJuridiqueSyscohada: null,
        nom: 'Mwinda',
        capitalSocial: null,
        capitalVariable: false,
        adresse: null,
        ville: null,
        rccm: null,
        devise: 'CDF',
        formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
        droitEtranger: false,
        ...extra,
    });
    it('l’association, l’ONG et l’association confessionnelle de droit congolais portent les mots et le sigle', () => {
        expect(mentions_societe_1.MENTION_ASBL).toBe('Association sans but lucratif · A.S.B.L.');
        for (const f of [
            client_1.FormeJuridiqueEbnl.ASSOCIATION,
            client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE,
            client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE,
        ]) {
            expect((0, mentions_societe_1.mentionsEmetteur)(asbl({ formeJuridique: f }))).toEqual({ ligne: mentions_societe_1.MENTION_ASBL, manquantes: [] });
        }
        expect((0, mentions_societe_1.mentionsRecopiees)(asbl()).ligne).toBe(mentions_societe_1.MENTION_ASBL);
    });
    it('rien à ajouter quand la dénomination les porte déjà', () => {
        expect((0, mentions_societe_1.mentionsEmetteur)(asbl({ nom: 'Mwinda ASBL' })).ligne).toBeNull();
        expect((0, mentions_societe_1.mentionsEmetteur)(asbl({ nom: 'Mwinda, A.S.B.L.' })).ligne).toBeNull();
        expect((0, mentions_societe_1.mentionsEmetteur)(asbl({ nom: 'Mwinda, association sans but lucratif' })).ligne).toBeNull();
    });
    it('hors de la Section I · ni l’EUP, ni l’unité de gestion de projet, ni l’entité de droit étranger', () => {
        expect((0, mentions_societe_1.mentionsEmetteur)(asbl({ formeJuridique: client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE })).ligne).toBeNull();
        expect((0, mentions_societe_1.mentionsEmetteur)(asbl({ formeJuridique: client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET })).ligne).toBeNull();
        expect((0, mentions_societe_1.mentionsEmetteur)(asbl({ droitEtranger: true })).ligne).toBeNull();
    });
});
describe('Les pièces émises lisent ce que la règle demande', () => {
    it('la facture et le devis sélectionnent les champs de la coopérative et de l’ASBL', async () => {
        for (const Service of [facturation_service_1.FacturationService, commercial_service_1.CommercialService]) {
            let select = {};
            const prisma = {
                tenant: {
                    findUniqueOrThrow: async (args) => {
                        select = args.select;
                        return {};
                    },
                },
            };
            const svc = new Service(prisma, {}, {});
            await svc.dossier('t1');
            for (const champ of [
                'numeroRegistreCooperatives',
                'varianteCooperative',
                'dateDissolution',
                'liquidateurs',
                'formeJuridique',
                'droitEtranger',
            ]) {
                expect(select[champ]).toBe(true);
            }
        }
    });
});
describe('TenantService.modifierIdentite · la coopérative (AUSCOOP art. 74, 77, 183)', () => {
    const service = (forme, referentiel = 'SYSCOHADA') => {
        const appels = [];
        const prisma = {
            tenant: {
                findUnique: async () => ({ id: 't1', referentiel, formeJuridiqueSyscohada: forme }),
                update: async (args) => {
                    appels.push(args);
                    return { id: 't1' };
                },
            },
        };
        const s = new tenant_service_1.TenantService(prisma);
        s.parametres = async () => null;
        return { s, appels };
    };
    it('le RCCM est refusé à la coopérative (art. 77 al. 1), son numéro au RSC accepté', async () => {
        await expect(service('SOCIETE_COOPERATIVE').s.modifierIdentite('t1', { rccm: 'R' })).rejects.toThrow(/art\. 77/);
        const ok = service('SOCIETE_COOPERATIVE');
        await ok.s.modifierIdentite('t1', {
            numeroRegistreCooperatives: ' RSC-1 ',
            varianteCooperative: 'SCOOPS',
            dateDissolution: '2026-06-30',
            liquidateurs: 'Me K.',
        });
        expect(ok.appels[0]).toMatchObject({
            data: { numeroRegistreCooperatives: 'RSC-1', varianteCooperative: 'SCOOPS', liquidateurs: 'Me K.' },
        });
        await ok.s.modifierIdentite('t1', { varianteCooperative: 'PAS_ENCORE_DIT', dateDissolution: '' });
        expect(ok.appels[1]).toMatchObject({ data: { varianteCooperative: null, dateDissolution: null } });
    });
    it('les champs de la coopérative sont refusés aux autres formes, l’effacement reste permis', async () => {
        await expect(service('SOCIETE_ANONYME').s.modifierIdentite('t1', { numeroRegistreCooperatives: 'X' })).rejects.toThrow(/AUSCOOP/);
        await expect(service(null, 'SYCEBNL').s.modifierIdentite('t1', { varianteCooperative: 'COOP_CA' })).rejects.toThrow(/AUSCOOP/);
        await expect(service('ENTREPRENANT').s.modifierIdentite('t1', { liquidateurs: 'X' })).rejects.toThrow(common_1.BadRequestException);
        const ok = service('SOCIETE_ANONYME');
        await ok.s.modifierIdentite('t1', { numeroRegistreCooperatives: '', varianteCooperative: 'PAS_ENCORE_DIT' });
        expect(ok.appels).toHaveLength(1);
    });
});
//# sourceMappingURL=mentions-immatriculation.spec.js.map