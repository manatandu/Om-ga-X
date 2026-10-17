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
exports.LicenceGuard = void 0;
const common_1 = require("@nestjs/common");
const licence_service_1 = require("./licence.service");
const METHODES_DE_LECTURE = new Set(['GET', 'HEAD']);
let LicenceGuard = class LicenceGuard {
    constructor(licenceService) {
        this.licenceService = licenceService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const tenantId = request.user?.tenantId;
        if (!tenantId) {
            throw new common_1.ForbiddenException('Tenant non résolu');
        }
        const { autorise, motif, lectureSeule } = request.user.licence !== undefined
            ? this.licenceService.evaluerLicence(request.user.licence)
            : await this.licenceService.estAccesAutorise(tenantId);
        if (!autorise) {
            if (lectureSeule && METHODES_DE_LECTURE.has(String(request.method).toUpperCase()))
                return true;
            throw new common_1.ForbiddenException(lectureSeule
                ? `${motif} · le dossier est en lecture seule : consultation et impression possibles, aucune modification ` +
                    "jusqu'au renouvellement de l'abonnement."
                : (motif ?? 'Accès refusé : licence invalide'));
        }
        return true;
    }
};
exports.LicenceGuard = LicenceGuard;
exports.LicenceGuard = LicenceGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [licence_service_1.LicenceService])
], LicenceGuard);
//# sourceMappingURL=licence.guard.js.map