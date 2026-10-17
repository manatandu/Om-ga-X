"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlesModule = void 0;
const common_1 = require("@nestjs/common");
const controles_service_1 = require("./controles.service");
const dossier_revision_service_1 = require("./dossier-revision.service");
const test_ecritures_journal_service_1 = require("./test-ecritures-journal.service");
const controles_controller_1 = require("./controles.controller");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const etats_financiers_syscohada_module_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.module");
let ControlesModule = class ControlesModule {
};
exports.ControlesModule = ControlesModule;
exports.ControlesModule = ControlesModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, comptabilite_module_1.ComptabiliteModule, etats_financiers_syscohada_module_1.EtatsFinanciersSyscohadaModule],
        controllers: [controles_controller_1.ControlesController],
        providers: [controles_service_1.ControlesService, dossier_revision_service_1.DossierRevisionService, test_ecritures_journal_service_1.TestEcrituresJournalService],
        exports: [controles_service_1.ControlesService, dossier_revision_service_1.DossierRevisionService, test_ecritures_journal_service_1.TestEcrituresJournalService],
    })
], ControlesModule);
//# sourceMappingURL=controles.module.js.map