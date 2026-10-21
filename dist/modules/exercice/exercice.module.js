"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExerciceModule = void 0;
const common_1 = require("@nestjs/common");
const exercice_service_1 = require("./exercice.service");
const exercice_controller_1 = require("./exercice.controller");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const journaux_module_1 = require("../journaux/journaux.module");
let ExerciceModule = class ExerciceModule {
};
exports.ExerciceModule = ExerciceModule;
exports.ExerciceModule = ExerciceModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, journaux_module_1.JournauxModule],
        controllers: [exercice_controller_1.ExerciceController],
        providers: [exercice_service_1.ExerciceService],
        exports: [exercice_service_1.ExerciceService],
    })
], ExerciceModule);
//# sourceMappingURL=exercice.module.js.map