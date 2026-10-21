"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiscaliteModule = void 0;
const common_1 = require("@nestjs/common");
const fiscalite_controller_1 = require("./fiscalite.controller");
const fiscalite_service_1 = require("./fiscalite.service");
const constat_impot_service_1 = require("./constat-impot.service");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
let FiscaliteModule = class FiscaliteModule {
};
exports.FiscaliteModule = FiscaliteModule;
exports.FiscaliteModule = FiscaliteModule = __decorate([
    (0, common_1.Module)({
        imports: [comptabilite_module_1.ComptabiliteModule, licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule],
        controllers: [fiscalite_controller_1.FiscaliteController],
        providers: [fiscalite_service_1.FiscaliteService, constat_impot_service_1.ConstatImpotService],
    })
], FiscaliteModule);
//# sourceMappingURL=fiscalite.module.js.map