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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExerciceController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const exercice_service_1 = require("./exercice.service");
const creer_exercice_dto_1 = require("./dto/creer-exercice.dto");
const cloture_dto_1 = require("./dto/cloture.dto");
const arrete_comptes_dto_1 = require("./dto/arrete-comptes.dto");
const a_nouveaux_provisoires_dto_1 = require("./dto/a-nouveaux-provisoires.dto");
const cloturer_exercice_dto_1 = require("./dto/cloturer-exercice.dto");
const client_1 = require("@prisma/client");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const fiche_r2_dto_1 = require("./dto/fiche-r2.dto");
const dates_portefeuille_dto_1 = require("./dto/dates-portefeuille.dto");
const fin_liquidation_dto_1 = require("./dto/fin-liquidation.dto");
const geste_dissolution_dto_1 = require("./dto/geste-dissolution.dto");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
let ExerciceController = class ExerciceController {
    constructor(exerciceService) {
        this.exerciceService = exerciceService;
    }
    async lister(user) {
        return this.exerciceService.lister(user.tenantId);
    }
    async creer(user, dto) {
        return this.exerciceService.creer(user.tenantId, dto);
    }
    async aNouveauxProvisoires(user, id, body) {
        return this.exerciceService.genererANouveauxProvisoires(user.tenantId, id, user.userId, {
            reporterBudgets: body?.reporterBudgets === true,
        });
    }
    async reporterBudgets(user, id) {
        return this.exerciceService.reporterBudgets(user.tenantId, id);
    }
    async cloturer(user, id, dto) {
        return this.exerciceService.cloturer(user.tenantId, id, user.userId, dto ?? {});
    }
    async ouvertureSuivante(user, id) {
        return this.exerciceService.confrontationOuvertureSuivante(user.tenantId, id);
    }
    async arreterComptes(user, id, dto) {
        return this.exerciceService.arreterComptes(user.tenantId, id, dto);
    }
    async declarerFicheR2(user, id, dto) {
        return this.exerciceService.declarerFicheR2(user.tenantId, id, dto);
    }
    async declarerDatesPortefeuille(user, id, dto) {
        return this.exerciceService.declarerDatesPortefeuille(user.tenantId, id, dto);
    }
    async arreterALaDissolution(user, id, dto) {
        return this.exerciceService.arreterALaDissolution(user.tenantId, id, {
            retirerActesDeLaPeriode: dto.retirerActesDeLaPeriode === true,
            ouvertureAnnuleeNonRessaisie: dto.ouvertureAnnuleeNonRessaisie === true,
            userId: user.userId,
        });
    }
    async annulerArretDissolution(user, id, dto) {
        return this.exerciceService.annulerArretDissolution(user.tenantId, id, {
            retirerActesDeLaPeriode: dto.retirerActesDeLaPeriode === true,
            ouvertureAnnuleeNonRessaisie: dto.ouvertureAnnuleeNonRessaisie === true,
            userId: user.userId,
        });
    }
    async rattacherALaLiquidation(user, id, dto) {
        return this.exerciceService.rattacherALaLiquidation(user.tenantId, id, {
            retirerActesDeLaPeriode: dto.retirerActesDeLaPeriode === true,
            ouvertureAnnuleeNonRessaisie: dto.ouvertureAnnuleeNonRessaisie === true,
            userId: user.userId,
        });
    }
    async modifierFinDeLiquidation(user, id, dto) {
        return this.exerciceService.modifierFinDeLiquidation(user.tenantId, id, dto);
    }
    async planningCloture(user, id) {
        return this.exerciceService.planningCloture(user.tenantId, id);
    }
    async listerClotures(user, id) {
        return this.exerciceService.listerClotures(user.tenantId, id);
    }
    async clorePartielle(user, id, dto) {
        return this.exerciceService.clorePartielle(user.tenantId, id, user.userId, dto);
    }
    async cloreTotale(user, id, dto) {
        return this.exerciceService.cloreTotale(user.tenantId, id, user.userId, dto);
    }
    async clorePeriode(user, id, dto) {
        return this.exerciceService.clorePeriode(user.tenantId, id, user.userId, dto);
    }
    async annulerCloture(user, clotureId) {
        return this.exerciceService.annulerCloture(user.tenantId, clotureId, user.userId);
    }
};
exports.ExerciceController = ExerciceController;
__decorate([
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, creer_exercice_dto_1.CreerExerciceDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/a-nouveaux-provisoires'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, a_nouveaux_provisoires_dto_1.ANouveauxProvisoiresDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "aNouveauxProvisoires", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/reporter-budgets'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "reporterBudgets", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/cloturer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, cloturer_exercice_dto_1.CloturerExerciceDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "cloturer", null);
__decorate([
    (0, common_1.Get)(':id/ouverture-suivante'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "ouvertureSuivante", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/arrete-comptes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, arrete_comptes_dto_1.ArreterComptesDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "arreterComptes", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Post)(':id/fiche-r2'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fiche_r2_dto_1.FicheR2Dto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "declarerFicheR2", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Post)(':id/dates-portefeuille'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dates_portefeuille_dto_1.DatesPortefeuilleDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "declarerDatesPortefeuille", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/arreter-a-la-dissolution'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, geste_dissolution_dto_1.GesteDissolutionDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "arreterALaDissolution", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/annuler-arret-dissolution'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, geste_dissolution_dto_1.GesteDissolutionDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "annulerArretDissolution", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/rattacher-a-la-liquidation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, geste_dissolution_dto_1.GesteDissolutionDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "rattacherALaLiquidation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/fin-de-liquidation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fin_liquidation_dto_1.FinLiquidationDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "modifierFinDeLiquidation", null);
__decorate([
    (0, common_1.Get)(':id/planning-cloture'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "planningCloture", null);
__decorate([
    (0, common_1.Get)(':id/clotures'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "listerClotures", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/clotures/partielle'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, cloture_dto_1.ClorePartielleDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "clorePartielle", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/clotures/totale'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, cloture_dto_1.CloreTotaleDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "cloreTotale", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/clotures/periode'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, cloture_dto_1.ClorePeriodeDto]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "clorePeriode", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('clotures/:clotureId/annuler'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('clotureId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExerciceController.prototype, "annulerCloture", null);
exports.ExerciceController = ExerciceController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, common_1.Controller)('exercices'),
    __metadata("design:paramtypes", [exercice_service_1.ExerciceService])
], ExerciceController);
//# sourceMappingURL=exercice.controller.js.map