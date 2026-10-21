"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalytiqueModule = void 0;
const common_1 = require("@nestjs/common");
const analytique_service_1 = require("./analytique.service");
const etats_analytiques_service_1 = require("./etats-analytiques.service");
const engagement_service_1 = require("./engagement.service");
const od_analytique_service_1 = require("./od-analytique.service");
const analytique_controller_1 = require("./analytique.controller");
const comptabilite_gestion_controller_1 = require("./gestion/comptabilite-gestion.controller");
const comptabilite_gestion_service_1 = require("./gestion/comptabilite-gestion.service");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const pieces_jointes_module_1 = require("../../common/pieces-jointes/pieces-jointes.module");
const pieces_jointes_section_controller_1 = require("./pieces-jointes-section.controller");
let AnalytiqueModule = class AnalytiqueModule {
};
exports.AnalytiqueModule = AnalytiqueModule;
exports.AnalytiqueModule = AnalytiqueModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, pieces_jointes_module_1.PiecesJointesModule],
        controllers: [analytique_controller_1.AnalytiqueController, comptabilite_gestion_controller_1.ComptabiliteGestionController, pieces_jointes_section_controller_1.PiecesJointesSectionController],
        providers: [analytique_service_1.AnalytiqueService, etats_analytiques_service_1.EtatsAnalytiquesService, engagement_service_1.EngagementService, od_analytique_service_1.OdAnalytiqueService, comptabilite_gestion_service_1.ComptabiliteGestionService],
        exports: [analytique_service_1.AnalytiqueService, engagement_service_1.EngagementService],
    })
], AnalytiqueModule);
//# sourceMappingURL=analytique.module.js.map