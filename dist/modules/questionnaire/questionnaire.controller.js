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
exports.QuestionnaireController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const client_1 = require("@prisma/client");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const questionnaire_service_1 = require("./questionnaire.service");
const questionnaire_dto_1 = require("./dto/questionnaire.dto");
const exercice_requis_1 = require("../../common/exercice-requis");
let QuestionnaireController = class QuestionnaireController {
    constructor(questionnaire) {
        this.questionnaire = questionnaire;
    }
    lister(user, exerciceId) {
        return this.questionnaire.lister(user.tenantId, exerciceId);
    }
    catalogue() {
        return {
            items: questionnaire_service_1.QuestionnaireService.ITEMS,
            interrogatifsCpcc: questionnaire_service_1.QuestionnaireService.itemsInterrogatifsCpcc().length,
        };
    }
    consulter(user, id) {
        return this.questionnaire.consulter(user.tenantId, id);
    }
    creer(user, dto) {
        return this.questionnaire.creer(user.tenantId, user.userId, dto);
    }
    repondre(user, id, dto) {
        return this.questionnaire.repondre(user.tenantId, id, user.userId, dto);
    }
    clore(user, id, dto) {
        return this.questionnaire.clore(user.tenantId, id, user.userId, dto);
    }
};
exports.QuestionnaireController = QuestionnaireController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_FACULTATIF)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], QuestionnaireController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('catalogue'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], QuestionnaireController.prototype, "catalogue", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], QuestionnaireController.prototype, "consulter", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, questionnaire_dto_1.CreerQuestionnaireDto]),
    __metadata("design:returntype", void 0)
], QuestionnaireController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/reponses'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, questionnaire_dto_1.RepondreDto]),
    __metadata("design:returntype", void 0)
], QuestionnaireController.prototype, "repondre", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/clore'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, questionnaire_dto_1.ClorerQuestionnaireDto]),
    __metadata("design:returntype", void 0)
], QuestionnaireController.prototype, "clore", null);
exports.QuestionnaireController = QuestionnaireController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('questionnaire-revision'),
    __metadata("design:paramtypes", [questionnaire_service_1.QuestionnaireService])
], QuestionnaireController);
//# sourceMappingURL=questionnaire.controller.js.map