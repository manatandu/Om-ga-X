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
exports.MajorationsHeuresService = void 0;
exports.heuresAPorter = heuresAPorter;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const heures_majorees_1 = require("./heures-majorees");
const PLAFOND_MAJORATIONS = 200;
async function heuresAPorter(db, tenantId, moisDePaie, lignes) {
    const ids = [...new Set(lignes.map((l) => l.majorationId))];
    const majorations = await db.majorationHeures.findMany({ where: { tenantId, id: { in: ids } } });
    const [a, m] = moisDePaie.split('-').map(Number);
    const dernierJour = new Date(Date.UTC(a, m, 0));
    return lignes.map((l) => {
        const maj = majorations.find((x) => x.id === l.majorationId);
        if (!maj)
            throw new common_1.BadRequestException('Majoration introuvable dans ce dossier.');
        if (!maj.actif)
            throw new common_1.BadRequestException(`La majoration « ${maj.libelle} » est désactivée.`);
        if (maj.dateEffet.getTime() > dernierJour.getTime()) {
            throw new common_1.BadRequestException(`La majoration « ${maj.libelle} » prend effet le ${maj.dateEffet.toISOString().slice(0, 10)}, après ${moisDePaie}.`);
        }
        const tauxPourCent = Number(maj.tauxPourCent);
        const p = { nature: maj.nature, heures: l.heures, tauxHoraire: l.tauxHoraire, tauxPourCent };
        return {
            majorationId: maj.id,
            ...p,
            source: maj.source,
            libelle: (0, heures_majorees_1.libelleDesHeures)({ ...p, libelleMajoration: maj.libelle }),
            montant: (0, heures_majorees_1.montantDesHeures)(p),
        };
    });
}
let MajorationsHeuresService = class MajorationsHeuresService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId) {
        const lignes = await this.prisma.majorationHeures.findMany({
            where: { tenantId },
            orderBy: [{ actif: 'desc' }, { nature: 'asc' }, { dateEffet: 'desc' }],
            take: PLAFOND_MAJORATIONS,
        });
        return {
            natures: Object.entries(heures_majorees_1.NATURES_MAJORATION).map(([cle, d]) => ({ cle, ...d })),
            majorations: lignes.map((x) => ({
                id: x.id,
                nature: x.nature,
                libelle: x.libelle,
                tauxPourCent: Number(x.tauxPourCent),
                source: x.source,
                dateEffet: x.dateEffet.toISOString().slice(0, 10),
                actif: x.actif,
                desactiveLe: x.desactiveLe,
                creePar: x.creePar,
            })),
            tronque: lignes.length >= PLAFOND_MAJORATIONS,
        };
    }
    async creer(tenantId, userEmail, dto) {
        const refus = (0, heures_majorees_1.motifRefusMajoration)(dto);
        if (refus)
            throw new common_1.BadRequestException(refus);
        const cree = await this.prisma.majorationHeures.create({
            data: {
                tenantId,
                nature: dto.nature,
                libelle: dto.libelle.trim(),
                tauxPourCent: new client_1.Prisma.Decimal(dto.tauxPourCent),
                source: dto.source.trim(),
                dateEffet: new Date(`${dto.dateEffet.slice(0, 10)}T00:00:00.000Z`),
                creePar: userEmail,
            },
            select: { id: true },
        });
        return cree;
    }
    async desactiver(tenantId, userEmail, id) {
        const m = await this.prisma.majorationHeures.findFirst({ where: { id, tenantId }, select: { id: true, actif: true } });
        if (!m)
            throw new common_1.NotFoundException('Majoration introuvable dans ce dossier.');
        if (!m.actif)
            throw new common_1.BadRequestException('Cette majoration est déjà désactivée.');
        await this.prisma.majorationHeures.update({ where: { id: m.id }, data: { actif: false, desactiveLe: new Date(), desactivePar: userEmail } });
        return { desactive: true };
    }
};
exports.MajorationsHeuresService = MajorationsHeuresService;
exports.MajorationsHeuresService = MajorationsHeuresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MajorationsHeuresService);
//# sourceMappingURL=majorations-heures.service.js.map