"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LettrageModule = void 0;
const common_1 = require("@nestjs/common");
const lettrage_service_1 = require("./lettrage.service");
const lettrage_controller_1 = require("./lettrage.controller");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
let LettrageModule = class LettrageModule {
};
exports.LettrageModule = LettrageModule;
exports.LettrageModule = LettrageModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule],
        controllers: [lettrage_controller_1.LettrageController, lettrage_controller_1.LettrageDossierController],
        providers: [lettrage_service_1.LettrageService],
        exports: [lettrage_service_1.LettrageService],
    })
], LettrageModule);
//# sourceMappingURL=lettrage.module.js.map