"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComptesModule = void 0;
const common_1 = require("@nestjs/common");
const compte_service_1 = require("./compte.service");
const compte_controller_1 = require("./compte.controller");
const natures_compte_controller_1 = require("./natures-compte.controller");
const natures_compte_service_1 = require("./natures-compte.service");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
let ComptesModule = class ComptesModule {
};
exports.ComptesModule = ComptesModule;
exports.ComptesModule = ComptesModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule],
        controllers: [compte_controller_1.CompteController, natures_compte_controller_1.NaturesCompteController],
        providers: [compte_service_1.CompteService, natures_compte_service_1.NaturesCompteService],
        exports: [compte_service_1.CompteService],
    })
], ComptesModule);
//# sourceMappingURL=comptes.module.js.map