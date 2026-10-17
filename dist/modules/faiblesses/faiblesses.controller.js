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
exports.FaiblessesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const client_1 = require("@prisma/client");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const faiblesses_service_1 = require("./faiblesses.service");
const faiblesses_dto_1 = require("./dto/faiblesses.dto");
const exercice_requis_1 = require("../../common/exercice-requis");
let FaiblessesController = class FaiblessesController {
    constructor(faiblesses) {
        this.faiblesses = faiblesses;
    }
    lister(user, exerciceId) {
        return this.faiblesses.lister(user.tenantId, exerciceId);
    }
    indicateurs() {
        return {
            indicateursA7: faiblesses_service_1.FaiblessesService.INDICATEURS_A7,
            mentionsContexte: faiblesses_service_1.FaiblessesService.MENTIONS_CONTEXTE,
        };
    }
    consulter(user, id) {
        return this.faiblesses.consulter(user.tenantId, id);
    }
    creer(user, dto) {
        return this.faiblesses.creer(user.tenantId, user.userId, dto);
    }
    ajouter(user, id, dto) {
        return this.faiblesses.ajouter(user.tenantId, id, user.userId, dto);
    }
    qualifier(user, faiblesseId, dto) {
        return this.faiblesses.qualifier(user.tenantId, faiblesseId, user.userId, dto);
    }
    communiquer(user, faiblesseId, dto) {
        return this.faiblesses.communiquer(user.tenantId, faiblesseId, dto);
    }
    reponseDirection(user, faiblesseId, dto) {
        return this.faiblesses.reponseDirection(user.tenantId, faiblesseId, user.userId, dto);
    }
    suivre(user, faiblesseId, dto) {
        return this.faiblesses.suivre(user.tenantId, faiblesseId, dto);
    }
    reporter(user, faiblesseId, dto) {
        return this.faiblesses.reporter(user.tenantId, faiblesseId, dto);
    }
    escalader(user, faiblesseId, dto) {
        return this.faiblesses.escalader(user.tenantId, faiblesseId, user.userId, dto);
    }
    clore(user, id, dto) {
        return this.faiblesses.clore(user.tenantId, id, user.userId, dto);
    }
};
exports.FaiblessesController = FaiblessesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_FACULTATIF)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('indicateurs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "indicateurs", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "consulter", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, faiblesses_dto_1.CreerRegistreFaiblessesDto]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/faiblesses'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, faiblesses_dto_1.AjouterFaiblesseDto]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "ajouter", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('faiblesses/:faiblesseId/qualification'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('faiblesseId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, faiblesses_dto_1.QualifierDto]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "qualifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('faiblesses/:faiblesseId/communication'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('faiblesseId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, faiblesses_dto_1.CommuniquerDto]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "communiquer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('faiblesses/:faiblesseId/reponse-direction'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('faiblesseId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, faiblesses_dto_1.ReponseDirectionDto]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "reponseDirection", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('faiblesses/:faiblesseId/suivi'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('faiblesseId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, faiblesses_dto_1.SuivreDto]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "suivre", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('faiblesses/:faiblesseId/report'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('faiblesseId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, faiblesses_dto_1.ReporterDto]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "reporter", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('faiblesses/:faiblesseId/escalade'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('faiblesseId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, faiblesses_dto_1.EscaladerDto]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "escalader", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/clore'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, faiblesses_dto_1.ClorerRegistreDto]),
    __metadata("design:returntype", void 0)
], FaiblessesController.prototype, "clore", null);
exports.FaiblessesController = FaiblessesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('faiblesses'),
    __metadata("design:paramtypes", [faiblesses_service_1.FaiblessesService])
], FaiblessesController);
//# sourceMappingURL=faiblesses.controller.js.map