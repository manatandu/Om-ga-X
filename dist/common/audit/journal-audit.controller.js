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
exports.JournalAuditController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../modules/auth/jwt-auth.guard");
const licence_guard_1 = require("../../modules/licence/licence.guard");
const roles_guard_1 = require("../guards/roles.guard");
const roles_decorator_1 = require("../decorators/roles.decorator");
const current_user_decorator_1 = require("../decorators/current-user.decorator");
const client_1 = require("@prisma/client");
const journal_audit_service_1 = require("./journal-audit.service");
const libelles_objets_audites_1 = require("./libelles-objets-audites");
const filtre_journal_audit_dto_1 = require("./filtre-journal-audit.dto");
let JournalAuditController = class JournalAuditController {
    constructor(service) {
        this.service = service;
    }
    async lister(user, filtre) {
        return this.service.lister(user.tenantId, filtre);
    }
    objets() {
        return (0, libelles_objets_audites_1.objetsAudites)();
    }
    async verifier(user) {
        return this.service.verifier(user.tenantId);
    }
};
exports.JournalAuditController = JournalAuditController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, filtre_journal_audit_dto_1.FiltreJournalAuditDto]),
    __metadata("design:returntype", Promise)
], JournalAuditController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('objets'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JournalAuditController.prototype, "objets", null);
__decorate([
    (0, common_1.Get)('verification'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], JournalAuditController.prototype, "verifier", null);
exports.JournalAuditController = JournalAuditController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Controller)('journal-audit'),
    __metadata("design:paramtypes", [journal_audit_service_1.JournalAuditService])
], JournalAuditController);
//# sourceMappingURL=journal-audit.controller.js.map