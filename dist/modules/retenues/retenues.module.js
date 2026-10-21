"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetenuesModule = void 0;
const common_1 = require("@nestjs/common");
const retenues_service_1 = require("./retenues.service");
const retenues_controller_1 = require("./retenues.controller");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
let RetenuesModule = class RetenuesModule {
};
exports.RetenuesModule = RetenuesModule;
exports.RetenuesModule = RetenuesModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule],
        controllers: [retenues_controller_1.RetenuesController],
        providers: [retenues_service_1.RetenuesService],
        exports: [retenues_service_1.RetenuesService],
    })
], RetenuesModule);
//# sourceMappingURL=retenues.module.js.map