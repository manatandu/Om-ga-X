"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const licence_module_1 = require("../licence/licence.module");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const jwt_strategy_1 = require("./jwt.strategy");
const tenant_module_1 = require("../tenant/tenant.module");
const comptes_module_1 = require("../comptes/comptes.module");
const exercice_module_1 = require("../exercice/exercice.module");
const journaux_module_1 = require("../journaux/journaux.module");
const tva_module_1 = require("../tva/tva.module");
const immobilisations_module_1 = require("../immobilisations/immobilisations.module");
const analytique_module_1 = require("../analytique/analytique.module");
const relances_module_1 = require("../relances/relances.module");
const jwt_auth_module_1 = require("./jwt-auth.module");
const courrier_module_1 = require("../courrier/courrier.module");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            passport_1.PassportModule,
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get('JWT_SECRET'),
                    signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '8h') },
                }),
            }),
            tenant_module_1.TenantModule,
            licence_module_1.LicenceModule,
            comptes_module_1.ComptesModule,
            exercice_module_1.ExerciceModule,
            journaux_module_1.JournauxModule,
            tva_module_1.TvaModule,
            immobilisations_module_1.ImmobilisationsModule,
            analytique_module_1.AnalytiqueModule,
            relances_module_1.RelancesModule,
            jwt_auth_module_1.JwtAuthModule,
            courrier_module_1.CourrierModule,
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, jwt_strategy_1.JwtStrategy],
        exports: [auth_service_1.AuthService],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map