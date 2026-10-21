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
exports.LicenceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const licence_sur_site_service_1 = require("../sur-site/licence-sur-site.service");
let LicenceService = class LicenceService {
    constructor(prisma, surSite) {
        this.prisma = prisma;
        this.surSite = surSite;
    }
    async estAccesAutorise(tenantId) {
        const licence = await this.prisma.licence.findUnique({ where: { tenantId } });
        return this.evaluerLicence(licence);
    }
    evaluerLicence(licence) {
        if (this.surSite?.surSite)
            return this.surSite.autorisation();
        if (!licence) {
            return { autorise: false, motif: 'Aucune licence associée à ce tenant' };
        }
        if (licence.type === client_1.TypeLicence.PROPRIETAIRE) {
            return { autorise: true };
        }
        if (licence.statut === client_1.StatutLicence.SUSPENDUE) {
            return { autorise: false, motif: 'Licence suspendue' };
        }
        switch (licence.type) {
            case client_1.TypeLicence.ABONNEMENT: {
                if (licence.dateExpiration && licence.dateExpiration < new Date()) {
                    return { autorise: false, motif: 'Abonnement expiré', lectureSeule: true };
                }
                return { autorise: true };
            }
            case client_1.TypeLicence.PERPETUEL_SAAS: {
                return { autorise: true };
            }
            case client_1.TypeLicence.PERPETUEL_ONPREMISE: {
                if (!licence.dernierHeartbeatAt) {
                    return {
                        autorise: false,
                        motif: "Licence « Perpétuelle (sur site) » · aucune vérification en ligne n'a jamais été reçue de cette " +
                            'installation',
                    };
                }
                const limite = new Date();
                limite.setDate(limite.getDate() - licence.joursGraceHorsLigne);
                if (licence.dernierHeartbeatAt < limite) {
                    const derniere = licence.dernierHeartbeatAt.toISOString().slice(0, 10);
                    return {
                        autorise: false,
                        motif: `Licence « Perpétuelle (sur site) » · dernière vérification en ligne le ${derniere}, au-delà de la ` +
                            `tolérance de ${licence.joursGraceHorsLigne} jours hors ligne`,
                    };
                }
                return { autorise: true };
            }
            default:
                return { autorise: false, motif: 'Type de licence inconnu' };
        }
    }
    async enregistrerHeartbeat(tenantId) {
        await this.prisma.licence.update({
            where: { tenantId },
            data: { dernierHeartbeatAt: new Date() },
        });
    }
};
exports.LicenceService = LicenceService;
exports.LicenceService = LicenceService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        licence_sur_site_service_1.LicenceSurSiteService])
], LicenceService);
//# sourceMappingURL=licence.service.js.map