"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConstitutionModule = void 0;
const common_1 = require("@nestjs/common");
const constitution_service_1 = require("./constitution.service");
const constitution_controller_1 = require("./constitution.controller");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
let ConstitutionModule = class ConstitutionModule {
};
exports.ConstitutionModule = ConstitutionModule;
exports.ConstitutionModule = ConstitutionModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule],
        controllers: [constitution_controller_1.ConstitutionController],
        providers: [constitution_service_1.ConstitutionService],
        exports: [constitution_service_1.ConstitutionService],
    })
], ConstitutionModule);
//# sourceMappingURL=constitution.module.js.map