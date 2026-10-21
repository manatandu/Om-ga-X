"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JournalAuditModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma.module");
const licence_module_1 = require("../../modules/licence/licence.module");
const jwt_auth_module_1 = require("../../modules/auth/jwt-auth.module");
const journal_audit_service_1 = require("./journal-audit.service");
const journal_audit_controller_1 = require("./journal-audit.controller");
let JournalAuditModule = class JournalAuditModule {
};
exports.JournalAuditModule = JournalAuditModule;
exports.JournalAuditModule = JournalAuditModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule],
        controllers: [journal_audit_controller_1.JournalAuditController],
        providers: [journal_audit_service_1.JournalAuditService],
        exports: [journal_audit_service_1.JournalAuditService],
    })
], JournalAuditModule);
//# sourceMappingURL=journal-audit.module.js.map