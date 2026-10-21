"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonnaieFonctionnelleController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const balance_fonctionnelle_service_1 = require("./balance-fonctionnelle.service");
const exercice_requis_1 = require("../../common/exercice-requis");
let MonnaieFonctionnelleController = class MonnaieFonctionnelleController {
    constructor(balanceFonctionnelle) {
        this.balanceFonctionnelle = balanceFonctionnelle;
    }
    balance(user, exerciceId) {
        return this.balanceFonctionnelle.balance(user.tenantId, exerciceId);
    }
};
exports.MonnaieFonctionnelleController = MonnaieFonctionnelleController;
__decorate([
    (0, common_1.Get)('balance/:exerciceId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MonnaieFonctionnelleController.prototype, "balance", null);
exports.MonnaieFonctionnelleController = MonnaieFonctionnelleController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('monnaie-fonctionnelle'),
    __metadata("design:paramtypes", [balance_fonctionnelle_service_1.BalanceFonctionnelleService])
], MonnaieFonctionnelleController);
//# sourceMappingURL=monnaie-fonctionnelle.controller.js.map