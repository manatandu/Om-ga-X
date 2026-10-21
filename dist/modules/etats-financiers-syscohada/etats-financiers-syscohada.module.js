"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EtatsFinanciersSyscohadaModule = void 0;
const lecteurs_bilan_1 = require("../../common/lecteurs-bilan");
const common_1 = require("@nestjs/common");
const etats_financiers_syscohada_service_1 = require("./etats-financiers-syscohada.service");
const etats_financiers_smt_syscohada_service_1 = require("./etats-financiers-smt-syscohada.service");
const etats_financiers_syscohada_controller_1 = require("./etats-financiers-syscohada.controller");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const exercice_module_1 = require("../exercice/exercice.module");
const notes_annexes_module_1 = require("../notes-annexes/notes-annexes.module");
let EtatsFinanciersSyscohadaModule = class EtatsFinanciersSyscohadaModule {
};
exports.EtatsFinanciersSyscohadaModule = EtatsFinanciersSyscohadaModule;
exports.EtatsFinanciersSyscohadaModule = EtatsFinanciersSyscohadaModule = __decorate([
    (0, common_1.Module)({
        imports: [comptabilite_module_1.ComptabiliteModule, licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, exercice_module_1.ExerciceModule, notes_annexes_module_1.NotesAnnexesModule],
        controllers: [etats_financiers_syscohada_controller_1.EtatsFinanciersSyscohadaController],
        providers: [
            etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService,
            etats_financiers_smt_syscohada_service_1.EtatsFinanciersSmtSyscohadaService,
            { provide: lecteurs_bilan_1.LECTEUR_BILAN_SYSCOHADA_NORMAL, useExisting: etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService },
            { provide: lecteurs_bilan_1.LECTEUR_BILAN_SYSCOHADA_SMT, useExisting: etats_financiers_smt_syscohada_service_1.EtatsFinanciersSmtSyscohadaService },
        ],
        exports: [etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService, etats_financiers_smt_syscohada_service_1.EtatsFinanciersSmtSyscohadaService],
    })
], EtatsFinanciersSyscohadaModule);
//# sourceMappingURL=etats-financiers-syscohada.module.js.map