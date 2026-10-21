"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const client_1 = require("@prisma/client");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const etats_financiers_controller_1 = require("../etats-financiers/etats-financiers.controller");
const etats_financiers_syscohada_controller_1 = require("./etats-financiers-syscohada.controller");
describe('EtatsFinanciersSyscohadaController · cloisonnement SYSCOHADA', () => {
    it('porte @ReferentielsAutorises(SYSCOHADA) au niveau de la CLASSE', () => {
        const referentiels = Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, etats_financiers_syscohada_controller_1.EtatsFinanciersSyscohadaController);
        expect(referentiels).toEqual([client_1.Referentiel.SYSCOHADA]);
    });
    it("n'autorise PAS le SYCEBNL, dont les états ont leur propre contrôleur", () => {
        const referentiels = Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, etats_financiers_syscohada_controller_1.EtatsFinanciersSyscohadaController);
        expect(referentiels).not.toContain(client_1.Referentiel.SYCEBNL);
    });
    it('laisse le contrôleur SYCEBNL sur son propre référentiel · aucun recouvrement', () => {
        const syscohada = Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, etats_financiers_syscohada_controller_1.EtatsFinanciersSyscohadaController);
        const sycebnl = Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, etats_financiers_controller_1.EtatsFinanciersController);
        expect(sycebnl).toEqual([client_1.Referentiel.SYCEBNL]);
        expect(syscohada.filter((r) => sycebnl.includes(r))).toEqual([]);
    });
    it('monte ReferentielGuard, sans quoi le décorateur ne serait qu’un commentaire', () => {
        const gardes = Reflect.getMetadata(constants_1.GUARDS_METADATA, etats_financiers_syscohada_controller_1.EtatsFinanciersSyscohadaController) ?? [];
        expect(gardes).toContain(referentiel_guard_1.ReferentielGuard);
    });
    it('monte les quatre gardes du modèle, dans le même ordre', () => {
        const gardes = Reflect.getMetadata(constants_1.GUARDS_METADATA, etats_financiers_syscohada_controller_1.EtatsFinanciersSyscohadaController) ?? [];
        expect(gardes).toEqual([jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard]);
    });
    it('répond sous son propre préfixe, distinct de celui du SYCEBNL', () => {
        expect(Reflect.getMetadata(constants_1.PATH_METADATA, etats_financiers_syscohada_controller_1.EtatsFinanciersSyscohadaController)).toBe('etats-financiers-syscohada');
        expect(Reflect.getMetadata(constants_1.PATH_METADATA, etats_financiers_controller_1.EtatsFinanciersController)).toBe('etats-financiers');
    });
    describe('routes', () => {
        const prototype = etats_financiers_syscohada_controller_1.EtatsFinanciersSyscohadaController.prototype;
        const methodes = Object.getOwnPropertyNames(prototype).filter((nom) => nom !== 'constructor');
        const chemin = (nom) => Reflect.getMetadata(constants_1.PATH_METADATA, prototype[nom]);
        const verbe = (nom) => Reflect.getMetadata(constants_1.METHOD_METADATA, prototype[nom]);
        const attendues = [
            'bilan',
            'compte-de-resultat',
            'tableau-flux-tresorerie',
            'notes',
            'smt/bilan',
            'smt/compte-de-resultat',
            'smt/journal-tresorerie',
            'smt/notes',
            'smt/eligibilite',
        ];
        it.each(attendues)('expose GET %s', (route) => {
            const nom = methodes.find((m) => chemin(m) === route);
            expect(nom).toBeDefined();
            expect(verbe(nom)).toBe(common_1.RequestMethod.GET);
        });
        it("n'expose rien d'autre · une route en trop est une route non gardée par ce spec", () => {
            expect(methodes.map(chemin).sort()).toEqual([...attendues].sort());
        });
        it('ne redéfinit @ReferentielsAutorises sur AUCUNE route', () => {
            for (const nom of methodes) {
                expect(Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, prototype[nom])).toBeUndefined();
            }
        });
    });
});
describe('notes du SMT SYSCOHADA · câblage des états des garanties (passes O1a C7, O6 B3)', () => {
    it('la route des notes sert les états que la forme du dossier exige, lus pour le dossier de la session', async () => {
        const garanties = { article: 'AUSCGIE art. 139', etats: ['a', 'b'] };
        const smt = {
            note1MaterielMobilierCautions: jest.fn().mockResolvedValue({}),
            note2Stocks: jest.fn().mockResolvedValue({}),
            note3CreancesDettes: jest.fn().mockResolvedValue({}),
            journauxDeSuivi: jest.fn().mockResolvedValue({}),
            ficheNotes: jest.fn().mockReturnValue({}),
            etatsDesGaranties: jest.fn().mockResolvedValue(garanties),
        };
        const controleur = new etats_financiers_syscohada_controller_1.EtatsFinanciersSyscohadaController({}, smt, {});
        const r = await controleur.notesSmt({ tenantId: 't1' }, 'e1');
        expect(r.etatsDesGaranties).toBe(garanties);
        expect(smt.etatsDesGaranties).toHaveBeenCalledWith('t1');
    });
});
//# sourceMappingURL=etats-financiers-syscohada.controller.spec.js.map