"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
const mentions_societe_1 = require("./mentions-societe");
const tenant_service_1 = require("./tenant.service");
const parametres_dossier_dto_1 = require("./dto/parametres-dossier.dto");
const auth_service_1 = require("../auth/auth.service");
describe('Mentions de l’art. 17 AUSCGIE', () => {
    const sarl = {
        referentiel: client_1.Referentiel.SYSCOHADA,
        formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        nom: 'Démo SARL',
        capitalSocial: 10000000,
        capitalVariable: false,
        adresse: '12, avenue du Commerce',
        ville: 'Kinshasa',
        rccm: 'CD/KIN/RCCM/24-B-00001',
        devise: 'CDF',
    };
    it('compose la forme, le capital, le siège et le RCCM, dans cet ordre', () => {
        const m = (0, mentions_societe_1.mentionsArticle17)(sarl);
        expect(m.ligne).toBe('Société à responsabilité limitée · au capital de 10 000 000 CDF · siège social : 12, avenue du Commerce, Kinshasa · RCCM CD/KIN/RCCM/24-B-00001');
        expect(m.manquantes).toEqual([]);
    });
    it('art. 269-2 · « à capital variable » s’ajoute à la forme sociale de la SA et de la SAS', () => {
        const sa = { ...sarl, formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, capitalVariable: true };
        expect((0, mentions_societe_1.mentionsArticle17)(sa).ligne).toMatch(/^Société anonyme à capital variable · au capital de/);
        expect((0, mentions_societe_1.mentionsArticle17)({ ...sa, formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE }).ligne).toMatch(/^Société par actions simplifiée à capital variable/);
    });
    it('art. 269-1 · un drapeau hérité sur une SARL n’est pas imprimé, il est DIT', () => {
        const m = (0, mentions_societe_1.mentionsArticle17)({ ...sarl, capitalVariable: true });
        expect(m.ligne).toMatch(/^Société à responsabilité limitée · au capital de/);
        expect(m.manquantes.join(' ')).toContain('AUSCGIE art. 269-1');
    });
    it('art. 269-1 · la variabilité est refusée aux SARL, SNC et SCS, pas à la SA, à la SAS ni à la coopérative', () => {
        for (const f of [
            client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF,
            client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE,
        ]) {
            expect((0, mentions_societe_1.motifRefusCapitalVariable)(f)).toMatch(/art\. 269-1/);
        }
        expect((0, mentions_societe_1.motifRefusCapitalVariable)(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME)).toBeNull();
        expect((0, mentions_societe_1.motifRefusCapitalVariable)(client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE)).toBeNull();
        expect((0, mentions_societe_1.motifRefusCapitalVariable)(client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE)).toBeNull();
    });
    it('art. 25 · une ville seule n’est pas une adresse · elle s’imprime, l’adresse reste manquante', () => {
        const m = (0, mentions_societe_1.mentionsArticle17)({ ...sarl, adresse: null });
        expect(m.ligne).toContain('siège social : Kinshasa');
        expect(m.manquantes).toEqual(['adresse du siège social']);
        expect((0, mentions_societe_1.mentionsArticle17)({ ...sarl, adresse: '  ' }).manquantes).toEqual(['adresse du siège social']);
    });
    it('une mention absente n’est pas remplacée, elle est DITE manquante', () => {
        const m = (0, mentions_societe_1.mentionsArticle17)({ ...sarl, capitalSocial: null, adresse: null, ville: null, rccm: null });
        expect(m.ligne).toBe('Société à responsabilité limitée');
        expect(m.manquantes).toEqual([
            'montant du capital social',
            'adresse du siège social',
            "numéro d'immatriculation au RCCM",
        ]);
    });
    it('les cinq sociétés commerciales de l’art. 6, et elles seules', () => {
        expect(mentions_societe_1.FORMES_SOCIETES_COMMERCIALES).toHaveLength(5);
        for (const f of Object.values(client_1.FormeJuridiqueSyscohada)) {
            const m = (0, mentions_societe_1.mentionsArticle17)({ ...sarl, formeJuridiqueSyscohada: f });
            if (mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(f))
                expect(m.ligne).not.toBeNull();
            else
                expect(m).toEqual({ ligne: null, manquantes: [] });
        }
    });
    it('rien pour un dossier SYCEBNL, ni pour une forme non renseignée', () => {
        expect((0, mentions_societe_1.mentionsArticle17)({ ...sarl, referentiel: client_1.Referentiel.SYCEBNL })).toEqual({ ligne: null, manquantes: [] });
        expect((0, mentions_societe_1.mentionsArticle17)({ ...sarl, formeJuridiqueSyscohada: null })).toEqual({ ligne: null, manquantes: [] });
    });
    it('une EBNL et une personne physique n’ont pas de capital social', () => {
        expect((0, mentions_societe_1.motifRefusCapital)(client_1.Referentiel.SYCEBNL, null)).toMatch(/but non lucratif/);
        expect((0, mentions_societe_1.motifRefusCapital)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.ENTREPRENANT)).toMatch(/personne physique/);
        expect((0, mentions_societe_1.motifRefusCapital)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE)).toMatch(/personne physique/);
        expect((0, mentions_societe_1.motifRefusCapital)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME)).toBeNull();
        expect((0, mentions_societe_1.motifRefusCapital)(client_1.Referentiel.SYSCOHADA, null)).toBeNull();
    });
});
describe('Capital, courriel et site · la route', () => {
    const service = (capture, tenant) => new tenant_service_1.TenantService({
        tenant: {
            findUnique: async () => tenant,
            update: async ({ data }) => {
                capture.data = data;
                return tenant;
            },
        },
        ecriture: { count: async () => 0 },
        compte: { findMany: async () => [] },
        devise: { findFirst: async () => null },
    });
    const sarl = {
        id: 't1',
        nom: 'Démo SARL',
        referentiel: client_1.Referentiel.SYSCOHADA,
        formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        capitalSocial: new client_1.Prisma.Decimal('2500000.50'),
        capitalVariable: false,
        adresse: null,
        ville: 'Kinshasa',
        rccm: null,
        devise: 'CDF',
    };
    it('pose le capital, le courriel et le site, et la chaîne vide efface', async () => {
        const capture = {};
        const sa = { ...sarl, formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME };
        await service(capture, sa).modifierCoordonnees('t1', {
            capitalSocial: 1000000,
            capitalVariable: true,
            email: '  contact@demo.cd ',
            siteWeb: '',
        });
        expect(String(capture.data.capitalSocial)).toBe('1000000');
        expect(capture.data.capitalVariable).toBe(true);
        expect(capture.data.email).toBe('contact@demo.cd');
        expect(capture.data.siteWeb).toBeNull();
    });
    it('art. 269-1 · la route refuse « à capital variable » à une SARL, sans rien écrire, et laisse le retrait', async () => {
        const capture = {};
        await expect(service(capture, sarl).modifierCoordonnees('t1', { capitalVariable: true })).rejects.toThrow(/art\. 269-1/);
        expect(capture.data).toBeUndefined();
        await service(capture, sarl).modifierCoordonnees('t1', { capitalVariable: false });
        expect(capture.data.capitalVariable).toBe(false);
    });
    it('null efface le capital · non envoyé, il n’est pas touché', async () => {
        const capture = {};
        await service(capture, sarl).modifierCoordonnees('t1', { capitalSocial: null });
        expect(capture.data.capitalSocial).toBeNull();
        await service(capture, sarl).modifierCoordonnees('t1', { ville: 'Goma' });
        expect(capture.data.capitalSocial).toBeUndefined();
    });
    it('refuse un capital à une ASBL et à un entreprenant, sans rien écrire', async () => {
        for (const t of [
            { ...sarl, referentiel: client_1.Referentiel.SYCEBNL, formeJuridiqueSyscohada: null },
            { ...sarl, formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.ENTREPRENANT },
        ]) {
            const capture = {};
            await expect(service(capture, t).modifierCoordonnees('t1', { capitalSocial: 1000 })).rejects.toThrow(/capital social/);
            await expect(service(capture, t).modifierCoordonnees('t1', { capitalVariable: true })).rejects.toThrow(/capital social/);
            expect(capture.data).toBeUndefined();
            await service(capture, t).modifierCoordonnees('t1', { capitalSocial: null, capitalVariable: false });
            expect(capture.data.capitalSocial).toBeNull();
        }
    });
    it('les paramètres rendent le capital en nombre et la ligne de l’art. 17', async () => {
        const p = (await service({}, { ...sarl, email: 'a@b.cd', siteWeb: 'demo.cd' }).parametres('t1'));
        expect(p.capitalSocial).toBe(2500000.5);
        expect(p.email).toBe('a@b.cd');
        expect(p.siteWeb).toBe('demo.cd');
        expect(p.mentionsSociete).toEqual({
            ligne: 'Société à responsabilité limitée · au capital de 2 500 000,5 CDF · siège social : Kinshasa',
            manquantes: ['adresse du siège social', "numéro d'immatriculation au RCCM"],
        });
    });
    it('/auth/me porte la ligne jusqu’à l’en-tête d’impression', async () => {
        const Auth = auth_service_1.AuthService;
        const auth = new Auth({
            user: {
                findUnique: async () => ({
                    id: 'u1',
                    email: 'x@y.cd',
                    role: 'ADMIN_CABINET',
                    tenantId: 't1',
                    estOperateurPlateforme: false,
                    doitChangerMotDePasse: false,
                    tenant: { ...sarl, _count: { cellules: 0 } },
                }),
            },
        }, ...Array.from({ length: 9 }, () => ({})));
        const me = (await auth.me('u1')).tenant;
        expect(me.mentionsSociete).toBe('Société à responsabilité limitée · au capital de 2 500 000,5 CDF · siège social : Kinshasa');
    });
});
describe('Courriel de l’entité · le DTO', () => {
    it('une adresse mal formée est refusée, la chaîne vide passe (effacement)', async () => {
        expect(await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierCoordonneesDto, { email: 'pas-une-adresse' }))).toHaveLength(1);
        expect(await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierCoordonneesDto, { email: '' }))).toHaveLength(0);
        expect(await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierCoordonneesDto, { capitalSocial: -5 }))).toHaveLength(1);
        expect(await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierCoordonneesDto, { capitalSocial: null }))).toHaveLength(0);
    });
});
//# sourceMappingURL=mentions-societe.spec.js.map