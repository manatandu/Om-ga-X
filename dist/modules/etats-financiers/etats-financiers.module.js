"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EtatsFinanciersModule = void 0;
const common_1 = require("@nestjs/common");
const etats_financiers_service_1 = require("./etats-financiers.service");
const etats_financiers_projet_service_1 = require("./etats-financiers-projet.service");
const etats_financiers_smt_service_1 = require("./etats-financiers-smt.service");
const etats_financiers_projet_budget_service_1 = require("./etats-financiers-projet-budget.service");
const etats_financiers_controller_1 = require("./etats-financiers.controller");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const exercice_module_1 = require("../exercice/exercice.module");
const analytique_module_1 = require("../analytique/analytique.module");
const lecteurs_bilan_1 = require("../../common/lecteurs-bilan");
let EtatsFinanciersModule = class EtatsFinanciersModule {
};
exports.EtatsFinanciersModule = EtatsFinanciersModule;
exports.EtatsFinanciersModule = EtatsFinanciersModule = __decorate([
    (0, common_1.Module)({
        imports: [comptabilite_module_1.ComptabiliteModule, licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, exercice_module_1.ExerciceModule, analytique_module_1.AnalytiqueModule],
        controllers: [etats_financiers_controller_1.EtatsFinanciersController],
        providers: [
            etats_financiers_service_1.EtatsFinanciersService,
            etats_financiers_projet_service_1.EtatsFinanciersProjetService,
            etats_financiers_smt_service_1.EtatsFinanciersSmtService,
            etats_financiers_projet_budget_service_1.EtatsFinanciersProjetBudgetService,
            { provide: lecteurs_bilan_1.LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS, useExisting: etats_financiers_service_1.EtatsFinanciersService },
            { provide: lecteurs_bilan_1.LECTEUR_BILAN_SYCEBNL_PROJETS, useExisting: etats_financiers_projet_service_1.EtatsFinanciersProjetService },
            { provide: lecteurs_bilan_1.LECTEUR_BILAN_SYCEBNL_SMT, useExisting: etats_financiers_smt_service_1.EtatsFinanciersSmtService },
        ],
        exports: [etats_financiers_service_1.EtatsFinanciersService, etats_financiers_projet_service_1.EtatsFinanciersProjetService, etats_financiers_smt_service_1.EtatsFinanciersSmtService, etats_financiers_projet_budget_service_1.EtatsFinanciersProjetBudgetService],
    })
], EtatsFinanciersModule);
//# sourceMappingURL=etats-financiers.module.js.map