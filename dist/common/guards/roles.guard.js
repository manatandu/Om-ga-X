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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const roles_decorator_1 = require("../decorators/roles.decorator");
const acces_roles_cantonnes_decorator_1 = require("../decorators/acces-roles-cantonnes.decorator");
const roles_cantonnes_1 = require("./roles-cantonnes");
let RolesGuard = class RolesGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const rolesRequis = this.reflector.getAllAndOverride(roles_decorator_1.ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!rolesRequis || rolesRequis.length === 0) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const role = request.user?.role;
        const acces = this.reflector.getAllAndOverride(acces_roles_cantonnes_decorator_1.CLE_ACCES_ROLES_CANTONNES, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!role || !(0, roles_cantonnes_1.rolesSatisfaits)(role, rolesRequis, acces)) {
            throw new common_1.ForbiddenException(`Rôle insuffisant · requis : ${rolesRequis.join(', ')}`);
        }
        return true;
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RolesGuard);
//# sourceMappingURL=roles.guard.js.map