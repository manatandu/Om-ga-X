"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UtilisateursModule = void 0;
const common_1 = require("@nestjs/common");
const utilisateur_service_1 = require("./utilisateur.service");
const utilisateur_controller_1 = require("./utilisateur.controller");
const avis_acces_service_1 = require("./avis-acces.service");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const courrier_module_1 = require("../courrier/courrier.module");
let UtilisateursModule = class UtilisateursModule {
};
exports.UtilisateursModule = UtilisateursModule;
exports.UtilisateursModule = UtilisateursModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, courrier_module_1.CourrierModule],
        controllers: [utilisateur_controller_1.UtilisateurController],
        providers: [utilisateur_service_1.UtilisateurService, avis_acces_service_1.AvisAccesService],
        exports: [utilisateur_service_1.UtilisateurService],
    })
], UtilisateursModule);
//# sourceMappingURL=utilisateurs.module.js.map