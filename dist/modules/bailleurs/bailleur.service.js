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
exports.BailleurService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let BailleurService = class BailleurService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId, actifsSeuls = false) {
        return this.prisma.bailleur.findMany({
            where: { tenantId, ...(actifsSeuls ? { estActif: true } : {}) },
            orderBy: { code: 'asc' },
        });
    }
    async creer(tenantId, dto) {
        const existant = await this.prisma.bailleur.findUnique({
            where: { tenantId_code: { tenantId, code: dto.code } },
        });
        if (existant) {
            throw new common_1.ConflictException(`Un bailleur porte déjà le code "${dto.code}" pour ce tenant`);
        }
        return this.prisma.bailleur.create({ data: { ...dto, tenantId } });
    }
    async modifier(tenantId, bailleurId, dto) {
        const bailleur = await this.prisma.bailleur.findFirst({ where: { id: bailleurId, tenantId } });
        if (!bailleur) {
            throw new common_1.NotFoundException('Bailleur introuvable pour ce tenant');
        }
        return this.prisma.bailleur.update({ where: { id: bailleurId }, data: dto });
    }
};
exports.BailleurService = BailleurService;
exports.BailleurService = BailleurService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BailleurService);
//# sourceMappingURL=bailleur.service.js.map