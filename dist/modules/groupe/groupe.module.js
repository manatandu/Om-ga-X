"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupeModule = void 0;
const common_1 = require("@nestjs/common");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const auth_module_1 = require("../auth/auth.module");
const exports_module_1 = require("../exports/exports.module");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const groupe_service_1 = require("./groupe.service");
const groupe_controller_1 = require("./groupe.controller");
const lecteurs_bilan_1 = require("../../common/lecteurs-bilan");
let GroupeModule = class GroupeModule {
};
exports.GroupeModule = GroupeModule;
exports.GroupeModule = GroupeModule = __decorate([
    (0, common_1.Module)({
        imports: [comptabilite_module_1.ComptabiliteModule, auth_module_1.AuthModule, exports_module_1.ExportsModule, licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule],
        controllers: [groupe_controller_1.GroupeController],
        providers: [groupe_service_1.GroupeService, { provide: lecteurs_bilan_1.LECTEUR_VIREMENTS_GROUPE, useExisting: groupe_service_1.GroupeService }],
    })
], GroupeModule);
//# sourceMappingURL=groupe.module.js.map