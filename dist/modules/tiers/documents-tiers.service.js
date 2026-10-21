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
exports.DocumentsTiersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const documents_tiers_1 = require("./documents-tiers");
const SANS_CONTENU = {
    id: true,
    tiersId: true,
    nomFichier: true,
    typeMime: true,
    taille: true,
    empreinte: true,
    commentaire: true,
    deposePar: true,
    createdAt: true,
};
let DocumentsTiersService = class DocumentsTiersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async tiersDuDossier(tenantId, tiersId) {
        const tiers = await this.prisma.tiers.findFirst({ where: { id: tiersId, tenantId }, select: { id: true, code: true } });
        if (!tiers)
            throw new common_1.NotFoundException('Tiers introuvable pour ce dossier.');
        return tiers;
    }
    async lister(tenantId, tiersId) {
        await this.tiersDuDossier(tenantId, tiersId);
        return this.prisma.documentTiers.findMany({
            where: { tenantId, tiersId },
            orderBy: { createdAt: 'desc' },
            select: SANS_CONTENU,
        });
    }
    async deposer(tenantId, tiersId, fichier, commentaire, auteur) {
        await this.tiersDuDossier(tenantId, tiersId);
        if (!fichier)
            throw new common_1.BadRequestException('Aucun fichier reçu.');
        const nomRecu = (0, documents_tiers_1.decoderNomMultipart)(fichier.originalname);
        const refus = (0, documents_tiers_1.motifRefusDocument)({ nom: nomRecu, contenu: fichier.buffer, commentaire });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const nomFichier = (0, documents_tiers_1.nettoyerNomFichier)(nomRecu);
        const type = (0, documents_tiers_1.identifierType)(fichier.buffer, nomFichier);
        if ('refus' in type)
            throw new common_1.BadRequestException(type.refus);
        const empreinte = (0, documents_tiers_1.empreinteDocument)(fichier.buffer);
        try {
            return await this.prisma.documentTiers.create({
                data: {
                    tenantId,
                    tiersId,
                    nomFichier,
                    typeMime: type.typeMime,
                    taille: fichier.buffer.length,
                    empreinte,
                    commentaire: commentaire?.trim() || null,
                    contenu: fichier.buffer,
                    deposePar: auteur,
                },
                select: SANS_CONTENU,
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException('Ce fichier est déjà attaché à ce tiers (même contenu).');
            }
            throw e;
        }
    }
    async modifierCommentaire(tenantId, id, commentaire) {
        const texte = (commentaire ?? '').trim();
        if (texte.length > documents_tiers_1.LONGUEUR_MAX_COMMENTAIRE) {
            throw new common_1.BadRequestException(`Le commentaire dépasse ${documents_tiers_1.LONGUEUR_MAX_COMMENTAIRE} caractères (${texte.length}).`);
        }
        await this.trouver(tenantId, id);
        return this.prisma.documentTiers.update({
            where: { id },
            data: { commentaire: texte || null },
            select: SANS_CONTENU,
        });
    }
    async trouver(tenantId, id) {
        const document = await this.prisma.documentTiers.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!document)
            throw new common_1.NotFoundException('Document introuvable pour ce dossier.');
        return document;
    }
    async telecharger(tenantId, id) {
        const document = await this.prisma.documentTiers.findFirst({
            where: { id, tenantId },
            select: { nomFichier: true, typeMime: true, contenu: true },
        });
        if (!document)
            throw new common_1.NotFoundException('Document introuvable pour ce dossier.');
        return document;
    }
    async supprimer(tenantId, id) {
        await this.trouver(tenantId, id);
        await this.prisma.documentTiers.delete({ where: { id }, select: { id: true } });
        return { supprime: true };
    }
};
exports.DocumentsTiersService = DocumentsTiersService;
exports.DocumentsTiersService = DocumentsTiersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DocumentsTiersService);
//# sourceMappingURL=documents-tiers.service.js.map