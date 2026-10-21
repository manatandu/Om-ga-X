"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BailleursModule = void 0;
const common_1 = require("@nestjs/common");
const bailleur_service_1 = require("./bailleur.service");
const bailleur_controller_1 = require("./bailleur.controller");
const convention_financement_service_1 = require("./convention-financement.service");
const convention_financement_controller_1 = require("./convention-financement.controller");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
let BailleursModule = class BailleursModule {
};
exports.BailleursModule = BailleursModule;
exports.BailleursModule = BailleursModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule],
        controllers: [bailleur_controller_1.BailleurController, convention_financement_controller_1.ConventionFinancementController],
        providers: [bailleur_service_1.BailleurService, convention_financement_service_1.ConventionFinancementService],
        exports: [bailleur_service_1.BailleurService, convention_financement_service_1.ConventionFinancementService],
    })
], BailleursModule);
//# sourceMappingURL=bailleurs.module.js.map