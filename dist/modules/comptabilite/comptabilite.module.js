"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComptabiliteModule = void 0;
const common_1 = require("@nestjs/common");
const ecriture_service_1 = require("./ecriture.service");
const ecriture_controller_1 = require("./ecriture.controller");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const journaux_module_1 = require("../journaux/journaux.module");
const exercice_module_1 = require("../exercice/exercice.module");
const analytique_module_1 = require("../analytique/analytique.module");
const pieces_jointes_module_1 = require("../../common/pieces-jointes/pieces-jointes.module");
const pieces_jointes_ecriture_controller_1 = require("./pieces-jointes-ecriture.controller");
let ComptabiliteModule = class ComptabiliteModule {
};
exports.ComptabiliteModule = ComptabiliteModule;
exports.ComptabiliteModule = ComptabiliteModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, journaux_module_1.JournauxModule, exercice_module_1.ExerciceModule, analytique_module_1.AnalytiqueModule, pieces_jointes_module_1.PiecesJointesModule],
        controllers: [ecriture_controller_1.EcritureController, pieces_jointes_ecriture_controller_1.PiecesJointesEcritureController],
        providers: [ecriture_service_1.EcritureService],
        exports: [ecriture_service_1.EcritureService],
    })
], ComptabiliteModule);
//# sourceMappingURL=comptabilite.module.js.map