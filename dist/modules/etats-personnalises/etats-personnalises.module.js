"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EtatsPersonnalisesModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../../common/prisma.module");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const etats_personnalises_service_1 = require("./etats-personnalises.service");
const etats_personnalises_controller_1 = require("./etats-personnalises.controller");
let EtatsPersonnalisesModule = class EtatsPersonnalisesModule {
};
exports.EtatsPersonnalisesModule = EtatsPersonnalisesModule;
exports.EtatsPersonnalisesModule = EtatsPersonnalisesModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, comptabilite_module_1.ComptabiliteModule],
        controllers: [etats_personnalises_controller_1.EtatsPersonnalisesController],
        providers: [etats_personnalises_service_1.EtatsPersonnalisesService],
    })
], EtatsPersonnalisesModule);
//# sourceMappingURL=etats-personnalises.module.js.map