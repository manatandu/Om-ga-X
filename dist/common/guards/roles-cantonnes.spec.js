"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const testing_1 = require("@nestjs/testing");
const client_1 = require("@prisma/client");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const passport_1 = require("@nestjs/passport");
const roles_cantonnes_1 = require("./roles-cantonnes");
const acces_roles_cantonnes_decorator_1 = require("../decorators/acces-roles-cantonnes.decorator");
const jwt_auth_guard_1 = require("../../modules/auth/jwt-auth.guard");
const mot_de_passe_a_changer_guard_1 = require("./mot-de-passe-a-changer.guard");
const personnel_controller_1 = require("../../modules/personnel/personnel.controller");
const avances_rubriques_controller_1 = require("../../modules/personnel/avances-rubriques.controller");
const baremes_paie_controller_1 = require("../../modules/personnel/baremes-paie.controller");
const conges_controller_1 = require("../../modules/personnel/conges.controller");
const absences_controller_1 = require("../../modules/personnel/absences.controller");
const majorations_heures_controller_1 = require("../../modules/personnel/majorations-heures.controller");
const paiement_salaires_controller_1 = require("../../modules/personnel/paiement-salaires.controller");
const repartitions_analytiques_paie_controller_1 = require("../../modules/personnel/repartitions-analytiques-paie.controller");
const questionnaire_paie_controller_1 = require("../../modules/personnel/questionnaire-paie.controller");
const pieces_jointes_salarie_controller_1 = require("../../modules/personnel/pieces-jointes-salarie.controller");
const ecriture_controller_1 = require("../../modules/comptabilite/ecriture.controller");
const affectation_controller_1 = require("../../modules/affectation/affectation.controller");
const groupe_controller_1 = require("../../modules/groupe/groupe.controller");
const exercice_controller_1 = require("../../modules/exercice/exercice.controller");
const auth_controller_1 = require("../../modules/auth/auth.controller");
const devises_controller_1 = require("../../modules/devises/devises.controller");
const { ADMIN_CABINET, COMPTABLE, LECTURE_SEULE, AIDE_COMPTABLE, GESTIONNAIRE_PAIE } = client_1.RoleUtilisateur;
describe('rolesSatisfaits · la règle', () => {
    it('l’aide-comptable passe là où passe le comptable ou la lecture seule, sauf refus', () => {
        expect((0, roles_cantonnes_1.rolesSatisfaits)(AIDE_COMPTABLE, [ADMIN_CABINET, COMPTABLE], undefined)).toBe(true);
        expect((0, roles_cantonnes_1.rolesSatisfaits)(AIDE_COMPTABLE, [ADMIN_CABINET, COMPTABLE, LECTURE_SEULE], undefined)).toBe(true);
        expect((0, roles_cantonnes_1.rolesSatisfaits)(AIDE_COMPTABLE, [ADMIN_CABINET], undefined)).toBe(false);
        expect((0, roles_cantonnes_1.rolesSatisfaits)(AIDE_COMPTABLE, [ADMIN_CABINET, COMPTABLE], { aideComptable: false })).toBe(false);
    });
    it('le gestionnaire de paie ne passe que là où la route l’ouvre', () => {
        expect((0, roles_cantonnes_1.rolesSatisfaits)(GESTIONNAIRE_PAIE, [ADMIN_CABINET, COMPTABLE], undefined)).toBe(false);
        expect((0, roles_cantonnes_1.rolesSatisfaits)(GESTIONNAIRE_PAIE, [ADMIN_CABINET, COMPTABLE], { gestionnairePaie: true })).toBe(true);
        expect((0, roles_cantonnes_1.rolesSatisfaits)(GESTIONNAIRE_PAIE, [ADMIN_CABINET], { gestionnairePaie: true })).toBe(false);
        expect((0, roles_cantonnes_1.routeOuverteAuRoleCantonne)(GESTIONNAIRE_PAIE, undefined)).toBe(false);
        expect((0, roles_cantonnes_1.routeOuverteAuRoleCantonne)(AIDE_COMPTABLE, undefined)).toBe(true);
    });
    it('les trois rôles d’origine ne sont pas touchés', () => {
        expect((0, roles_cantonnes_1.rolesSatisfaits)(COMPTABLE, [ADMIN_CABINET, COMPTABLE], { aideComptable: false, gestionnairePaie: false })).toBe(true);
        expect((0, roles_cantonnes_1.rolesSatisfaits)(LECTURE_SEULE, [ADMIN_CABINET, COMPTABLE], undefined)).toBe(false);
        expect((0, roles_cantonnes_1.routeOuverteAuRoleCantonne)(COMPTABLE, { aideComptable: false, gestionnairePaie: false })).toBe(true);
    });
});
describe('JwtAuthGuard · les contrôles qui ont besoin de l’utilisateur', () => {
    const garde = new jwt_auth_guard_1.JwtAuthGuard(new core_1.Reflector());
    const parent = Object.getPrototypeOf(jwt_auth_guard_1.JwtAuthGuard.prototype);
    const contexte = (user, handler, classe = class {
    }) => ({
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
        getHandler: () => handler,
        getClass: () => classe,
    });
    beforeEach(() => jest.spyOn(parent, 'canActivate').mockResolvedValue(true));
    afterEach(() => jest.restoreAllMocks());
    it('refuse le gestionnaire de paie sur une lecture sans @Roles, l’ouvre au personnel', async () => {
        const lectureOrdinaire = () => undefined;
        await expect(garde.canActivate(contexte({ role: GESTIONNAIRE_PAIE }, lectureOrdinaire))).rejects.toThrow(/cantonné au personnel et à la paie/);
        const lister = personnel_controller_1.PersonnelController.prototype.lister;
        await expect(garde.canActivate(contexte({ role: GESTIONNAIRE_PAIE }, lister, personnel_controller_1.PersonnelController))).resolves.toBe(true);
    });
    it('refuse l’aide-comptable sur la validation, la laisse saisir', async () => {
        await expect(garde.canActivate(contexte({ role: AIDE_COMPTABLE }, ecriture_controller_1.EcritureController.prototype.valider, ecriture_controller_1.EcritureController))).rejects.toThrow(/réservée au comptable/);
        await expect(garde.canActivate(contexte({ role: AIDE_COMPTABLE }, ecriture_controller_1.EcritureController.prototype.creer, ecriture_controller_1.EcritureController))).resolves.toBe(true);
    });
    it('ferme le logiciel au mot de passe provisoire, sauf les routes de sortie', async () => {
        const quelconque = () => undefined;
        await expect(garde.canActivate(contexte({ role: COMPTABLE, doitChangerMotDePasse: true }, quelconque))).rejects.toThrow(common_1.ForbiddenException);
        await expect(garde.canActivate(contexte({ role: COMPTABLE, doitChangerMotDePasse: true }, auth_controller_1.AuthController.prototype.me, auth_controller_1.AuthController))).resolves.toBe(true);
    });
});
describe('POURQUOI JwtAuthGuard · une garde globale ne voit jamais l’utilisateur', () => {
    let AuthDeControleur = class AuthDeControleur {
        canActivate(ctx) {
            ctx.switchToHttp().getRequest().user = { doitChangerMotDePasse: true };
            return true;
        }
    };
    AuthDeControleur = __decorate([
        (0, common_1.Injectable)()
    ], AuthDeControleur);
    let PreuveController = class PreuveController {
        lire() {
            return { ok: true };
        }
    };
    __decorate([
        (0, common_1.Get)(),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], PreuveController.prototype, "lire", null);
    PreuveController = __decorate([
        (0, common_1.UseGuards)(AuthDeControleur),
        (0, common_1.Controller)('preuve')
    ], PreuveController);
    it('Nest passe la garde globale AVANT celle du contrôleur · elle laisse donc tout passer', async () => {
        const mod = await testing_1.Test.createTestingModule({
            controllers: [PreuveController],
            providers: [{ provide: core_1.APP_GUARD, useClass: mot_de_passe_a_changer_guard_1.MotDePasseAChangerGuard }],
        }).compile();
        const app = mod.createNestApplication();
        await app.listen(0);
        const { port } = app.getHttpServer().address();
        const reponse = await fetch(`http://127.0.0.1:${port}/preuve`);
        await app.close();
        expect(reponse.status).toBe(200);
    });
    it('le module ne pose plus de garde globale qui lirait l’utilisateur', () => {
        const module = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../app.module.ts'), 'utf8');
        const gardes = [...module.matchAll(/provide: APP_GUARD, useClass: (\w+)/g)].map((m) => m[1]);
        expect(gardes).toEqual(['ThrottlerGuard']);
    });
    it('JwtAuthGuard est bien une AuthGuard passport', () => {
        expect(jwt_auth_guard_1.JwtAuthGuard.prototype).toBeInstanceOf((0, passport_1.AuthGuard)('jwt'));
    });
});
describe('les routes marquées', () => {
    const acces = (cible) => Reflect.getMetadata(acces_roles_cantonnes_decorator_1.CLE_ACCES_ROLES_CANTONNES, cible);
    it('le personnel est au gestionnaire de paie, pas à l’aide ; la comptabilisation au comptable seul', () => {
        expect(acces(personnel_controller_1.PersonnelController)).toEqual({ aideComptable: false, gestionnairePaie: true });
        expect(acces(personnel_controller_1.PersonnelController.prototype.comptabiliserPaieDuMois)).toEqual({ aideComptable: false, gestionnairePaie: false });
        expect(acces(personnel_controller_1.PersonnelController.prototype.annulerComptabilisationPaie)).toEqual({ aideComptable: false, gestionnairePaie: false });
    });
    it('valider, corriger, affecter et produire la liasse du groupe sont réservés au comptable', () => {
        for (const cible of [
            ecriture_controller_1.EcritureController.prototype.valider,
            ecriture_controller_1.EcritureController.prototype.validerJusqua,
            ecriture_controller_1.EcritureController.prototype.corriger,
            affectation_controller_1.AffectationController.prototype.enregistrer,
            affectation_controller_1.AffectationController.prototype.supprimer,
            groupe_controller_1.GroupeController.prototype.liasseGroupe,
        ]) {
            expect(acces(cible)).toEqual({ aideComptable: false, gestionnairePaie: false });
        }
    });
    it('le gestionnaire de paie peut entrer · se voir, changer son mot de passe, lister les exercices', () => {
        for (const cible of [auth_controller_1.AuthController.prototype.me, auth_controller_1.AuthController.prototype.changerMotDePasse, exercice_controller_1.ExerciceController.prototype.lister]) {
            expect(acces(cible)).toEqual({ gestionnairePaie: true });
        }
    });
    it('le gestionnaire de paie lit les devises et cote le cours du jour que sa paie lit (audit final F247)', () => {
        for (const cible of [devises_controller_1.DevisesController.prototype.lister, devises_controller_1.DevisesController.prototype.poserCours]) {
            expect(acces(cible)).toEqual({ gestionnairePaie: true });
        }
        expect(acces(devises_controller_1.DevisesController.prototype.reevaluer)).toBeUndefined();
    });
});
describe('les portes du gestionnaire de paie · une liste FERMÉE (audit de cohérence du lot F247, F270)', () => {
    const acces = (cible) => Reflect.getMetadata(acces_roles_cantonnes_decorator_1.CLE_ACCES_ROLES_CANTONNES, cible);
    const methodesOuvertes = (classe) => {
        const proto = classe.prototype;
        return Object.getOwnPropertyNames(proto)
            .filter((m) => m !== 'constructor' && acces(proto[m])?.gestionnairePaie === true)
            .map((m) => `${classe.name}.${m}`);
    };
    it('le module du personnel lui est ouvert en entier, par la classe · et lui seul', () => {
        for (const classe of [personnel_controller_1.PersonnelController, avances_rubriques_controller_1.AvancesRubriquesController, baremes_paie_controller_1.BaremesPaieController, conges_controller_1.CongesController, absences_controller_1.AbsencesController, majorations_heures_controller_1.MajorationsHeuresController, paiement_salaires_controller_1.PaiementSalairesController, repartitions_analytiques_paie_controller_1.RepartitionsAnalytiquesPaieController, questionnaire_paie_controller_1.QuestionnairePaieController, pieces_jointes_salarie_controller_1.PiecesJointesSalarieController]) {
            expect([classe.name, acces(classe)?.gestionnairePaie]).toEqual([classe.name, true]);
        }
        for (const classe of [auth_controller_1.AuthController, exercice_controller_1.ExerciceController, devises_controller_1.DevisesController]) {
            expect([classe.name, acces(classe)]).toEqual([classe.name, undefined]);
        }
    });
    it('hors du personnel, route par route · se voir, son propre compte, les exercices, le cours du jour', () => {
        expect([auth_controller_1.AuthController, exercice_controller_1.ExerciceController, devises_controller_1.DevisesController].flatMap(methodesOuvertes).sort()).toEqual([
            'AuthController.me',
            'AuthController.changerMotDePasse',
            'AuthController.changerAdresse',
            'AuthController.etatDoubleAuth',
            'AuthController.initierDoubleAuth',
            'AuthController.activerDoubleAuth',
            'AuthController.desactiverDoubleAuth',
            'AuthController.regenererCodesSecours',
            'AuthController.deconnecterPartout',
            'AuthController.deconnecterAutresAppareils',
            'ExerciceController.lister',
            'DevisesController.lister',
            'DevisesController.poserCours',
        ].sort());
    });
    it('aucun autre fichier du serveur ne lui ouvre une porte', () => {
        const racine = (0, node_path_1.join)(__dirname, '../..');
        const sources = (dossier) => (0, node_fs_1.readdirSync)(dossier).flatMap((nom) => {
            const chemin = (0, node_path_1.join)(dossier, nom);
            if ((0, node_fs_1.statSync)(chemin).isDirectory())
                return sources(chemin);
            return nom.endsWith('.ts') && !nom.endsWith('.spec.ts') ? [chemin] : [];
        });
        const ouvrent = sources(racine)
            .filter((f) => /gestionnairePaie\s*:\s*true/.test((0, node_fs_1.readFileSync)(f, 'utf8')))
            .map((f) => (0, node_path_1.relative)(racine, f).split('\\').join('/'))
            .sort();
        expect(ouvrent).toEqual([
            'modules/auth/auth.controller.ts',
            'modules/devises/devises.controller.ts',
            'modules/exercice/exercice.controller.ts',
            'modules/personnel/absences.controller.ts',
            'modules/personnel/avances-rubriques.controller.ts',
            'modules/personnel/baremes-paie.controller.ts',
            'modules/personnel/conges.controller.ts',
            'modules/personnel/majorations-heures.controller.ts',
            'modules/personnel/paiement-salaires.controller.ts',
            'modules/personnel/personnel.controller.ts',
            'modules/personnel/pieces-jointes-salarie.controller.ts',
            'modules/personnel/questionnaire-paie.controller.ts',
            'modules/personnel/repartitions-analytiques-paie.controller.ts',
        ]);
    });
});
describe('toute route authentifiée traverse JwtAuthGuard', () => {
    it('chaque contrôleur la pose, hors la santé qui n’authentifie personne', () => {
        const { globSync } = require('node:fs');
        const racine = (0, node_path_1.join)(__dirname, '../..');
        const fichiers = globSync
            ? globSync('**/*.controller.ts', { cwd: racine })
            : require('child_process').execSync('find . -name "*.controller.ts"', { cwd: racine }).toString().trim().split('\n');
        const sans = fichiers.filter((f) => !f.endsWith('sante.controller.ts') && !(0, node_fs_1.readFileSync)((0, node_path_1.join)(racine, f), 'utf8').includes('JwtAuthGuard'));
        expect(fichiers.length).toBeGreaterThan(40);
        expect(sans).toEqual([]);
    });
});
//# sourceMappingURL=roles-cantonnes.spec.js.map