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
exports.BaremesPaieService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const cotisations_paie_1 = require("./cotisations-paie");
const baremes_dossier_1 = require("./baremes-dossier");
let BaremesPaieService = class BaremesPaieService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId) {
        const dossier = await this.prisma.versionBaremePaie.findMany({
            where: { tenantId },
            orderBy: [{ bareme: 'asc' }, { aPartirDu: 'asc' }],
        });
        return {
            baremes: baremes_dossier_1.BAREMES_SERVIS,
            livrees: (0, baremes_dossier_1.versionsLivrees)(),
            dossier: dossier.map((v) => ({
                id: v.id,
                bareme: v.bareme,
                aPartirDu: v.aPartirDu,
                reference: v.reference,
                valeurs: v.valeurs,
                saisiPar: v.saisiPar,
                createdAt: v.createdAt,
            })),
            reserve: cotisations_paie_1.RESERVE_BAREME_CABINET,
        };
    }
    bulletinsCouverts(tenantId, depuis, avant) {
        return this.prisma.bulletinPaie.findMany({
            where: {
                tenantId,
                statut: client_1.StatutBulletinPaie.EMIS,
                moisDePaie: { gte: depuis, ...(avant ? { lt: avant } : {}) },
            },
            select: { numero: true, moisDePaie: true },
            orderBy: { numero: 'asc' },
        });
    }
    async ajouter(tenantId, auteur, dto) {
        const existantes = await this.prisma.versionBaremePaie.findMany({
            where: { tenantId, bareme: dto.bareme },
            select: { aPartirDu: true },
        });
        const refus = (0, baremes_dossier_1.motifRefusVersion)(dto, existantes.map((e) => e.aPartirDu));
        if (refus)
            throw new common_1.BadRequestException(refus);
        const lecture = (0, baremes_dossier_1.lireValeurs)(dto.bareme, dto.valeurs);
        if (!lecture.ok)
            throw new common_1.BadRequestException(lecture.motif);
        let version;
        try {
            version = await this.prisma.versionBaremePaie.create({
                data: {
                    tenantId,
                    bareme: dto.bareme,
                    aPartirDu: dto.aPartirDu,
                    reference: dto.reference.trim(),
                    valeurs: lecture.valeurs,
                    saisiPar: auteur,
                },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Une version ${dto.bareme} du ${dto.aPartirDu} existe déjà.`);
            }
            throw e;
        }
        const { depuis } = (0, baremes_dossier_1.moisCouverts)(dto.aPartirDu, null);
        const bulletinsDejaEmis = await this.bulletinsCouverts(tenantId, depuis, null);
        return { version, bulletinsDejaEmis };
    }
    async supprimer(tenantId, id) {
        const v = await this.prisma.versionBaremePaie.findFirst({ where: { id, tenantId } });
        if (!v)
            throw new common_1.NotFoundException('Version de barème introuvable dans ce dossier.');
        const suivante = await this.prisma.versionBaremePaie.findFirst({
            where: { tenantId, bareme: v.bareme, aPartirDu: { gt: v.aPartirDu } },
            orderBy: { aPartirDu: 'asc' },
            select: { aPartirDu: true },
        });
        const { depuis, avant } = (0, baremes_dossier_1.moisCouverts)(v.aPartirDu, suivante?.aPartirDu ?? null);
        const emis = await this.bulletinsCouverts(tenantId, depuis, avant);
        if (emis.length) {
            const liste = emis.slice(0, 5).map((b) => `n° ${b.numero} (${b.moisDePaie})`).join(', ');
            throw new common_1.BadRequestException(`${emis.length} bulletin(s) émis sur la période de cette version (${liste}${emis.length > 5 ? ', …' : ''}) ont pu être calculés avec elle · ` +
                'annulez-les avant de la retirer, sans quoi leur taux ne se relirait plus nulle part.');
        }
        await this.prisma.versionBaremePaie.delete({ where: { id: v.id } });
        return { supprime: true };
    }
};
exports.BaremesPaieService = BaremesPaieService;
exports.BaremesPaieService = BaremesPaieService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BaremesPaieService);
//# sourceMappingURL=baremes-paie.service.js.map