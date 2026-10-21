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
exports.ModelesEditionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../common/prisma.service");
const modeles_edition_1 = require("./modeles-edition");
const CHAMPS = { id: true, edition: true, nom: true, colonnes: true, saut: true, creeLe: true, modifieLe: true };
let ModelesEditionService = class ModelesEditionService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId, edition) {
        const [modeles, total] = await Promise.all([
            this.prisma.modeleEdition.findMany({ where: { tenantId, edition }, orderBy: { nom: 'asc' }, take: modeles_edition_1.PLAFOND_MODELES, select: CHAMPS }),
            this.prisma.modeleEdition.count({ where: { tenantId, edition } }),
        ]);
        return { modeles, total, tronque: total > modeles.length };
    }
    async creer(tenantId, userId, edition, brut) {
        const lu = (0, modeles_edition_1.modeleOuMotif)(edition, brut);
        if ('motif' in lu)
            throw new common_1.BadRequestException(lu.motif);
        try {
            return await this.prisma.modeleEdition.create({
                data: { tenantId, edition, nom: lu.nom, colonnes: lu.colonnes, saut: lu.saut, creePar: userId },
                select: CHAMPS,
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Un modèle de cette édition porte déjà le nom « ${lu.nom} » · remplacez-le ou choisissez un autre nom.`);
            }
            throw e;
        }
    }
    async remplacer(tenantId, id, brut) {
        const existant = await this.prisma.modeleEdition.findFirst({ where: { id, tenantId }, select: { id: true, edition: true } });
        if (!existant)
            throw new common_1.NotFoundException("Modèle d'édition introuvable pour ce dossier.");
        const lu = (0, modeles_edition_1.modeleOuMotif)(existant.edition, brut, false);
        if ('motif' in lu)
            throw new common_1.BadRequestException(lu.motif);
        return this.prisma.modeleEdition.update({
            where: { id: existant.id },
            data: { colonnes: lu.colonnes, ...(brut.saut === undefined ? {} : { saut: lu.saut }), modifieLe: new Date() },
            select: CHAMPS,
        });
    }
    async supprimer(tenantId, id) {
        const existant = await this.prisma.modeleEdition.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!existant)
            throw new common_1.NotFoundException("Modèle d'édition introuvable pour ce dossier.");
        await this.prisma.modeleEdition.delete({ where: { id: existant.id } });
        return { supprime: true };
    }
};
exports.ModelesEditionService = ModelesEditionService;
exports.ModelesEditionService = ModelesEditionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ModelesEditionService);
//# sourceMappingURL=modeles-edition.service.js.map