"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreancesDouteusesModule = void 0;
const common_1 = require("@nestjs/common");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const lettrage_module_1 = require("../lettrage/lettrage.module");
const tva_module_1 = require("../tva/tva.module");
const creances_douteuses_controller_1 = require("./creances-douteuses.controller");
const creances_douteuses_service_1 = require("./creances-douteuses.service");
let CreancesDouteusesModule = class CreancesDouteusesModule {
};
exports.CreancesDouteusesModule = CreancesDouteusesModule;
exports.CreancesDouteusesModule = CreancesDouteusesModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, comptabilite_module_1.ComptabiliteModule, lettrage_module_1.LettrageModule, tva_module_1.TvaModule],
        controllers: [creances_douteuses_controller_1.CreancesDouteusesController],
        providers: [creances_douteuses_service_1.CreancesDouteusesService],
    })
], CreancesDouteusesModule);
//# sourceMappingURL=creances-douteuses.module.js.map