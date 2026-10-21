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
exports.LieuxLivraisonService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const references_1 = require("../../common/suppression/references");
const lieux_livraison_1 = require("./lieux-livraison");
const CHAMPS = ['adresse', 'complement', 'boitePostale', 'ville', 'pays', 'contact', 'telephone', 'email'];
const coordonnee = (v) => (v === undefined ? undefined : v === null || v.trim() === '' ? null : v.trim());
let LieuxLivraisonService = class LieuxLivraisonService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async clientDuDossier(tenantId, tiersId) {
        const tiers = await this.prisma.tiers.findFirst({ where: { id: tiersId, tenantId }, select: { id: true, type: true } });
        if (!tiers)
            throw new common_1.NotFoundException('Tiers introuvable pour ce dossier.');
        return tiers;
    }
    async trouver(tenantId, id) {
        const lieu = await this.prisma.lieuLivraison.findFirst({ where: { id, tenantId } });
        if (!lieu)
            throw new common_1.NotFoundException('Lieu de livraison introuvable pour ce dossier.');
        return lieu;
    }
    async verrouillerLeClient(tx, tenantId, tiersId) {
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`lieux-livraison:${tenantId}:${tiersId}`}))`;
    }
    async jugerLeGeste(tx, tenantId, tiersId, intitule, idCourant) {
        const sauf = idCourant ? { NOT: { id: idCourant } } : {};
        const homonymes = await tx.lieuLivraison.findMany({
            where: { tenantId, tiersId, intitule: { equals: intitule, mode: 'insensitive' }, ...sauf },
            select: { id: true, intitule: true },
            take: 50,
        });
        const refus = (0, lieux_livraison_1.motifRefusIntitule)(intitule, homonymes, idCourant);
        if (refus)
            throw new common_1.BadRequestException(refus);
        return tx.lieuLivraison.count({ where: { tenantId, tiersId, estActif: true, ...sauf } });
    }
    async lister(tenantId, tiersId) {
        await this.clientDuDossier(tenantId, tiersId);
        const [lieux, total] = await Promise.all([
            this.prisma.lieuLivraison.findMany({
                where: { tenantId, tiersId },
                orderBy: [{ estPrincipal: 'desc' }, { estActif: 'desc' }, { createdAt: 'asc' }],
                take: lieux_livraison_1.LIEUX_SERVIS_PAR_CLIENT,
            }),
            this.prisma.lieuLivraison.count({ where: { tenantId, tiersId } }),
        ]);
        return { lieux, total, tronque: total > lieux.length };
    }
    async creer(tenantId, tiersId, dto) {
        const tiers = await this.clientDuDossier(tenantId, tiersId);
        const refusType = (0, lieux_livraison_1.motifRefusTypeLieu)(tiers.type);
        if (refusType)
            throw new common_1.BadRequestException(refusType);
        const intitule = (0, lieux_livraison_1.intituleDuLieu)(dto.intitule);
        const refusForme = (0, lieux_livraison_1.motifRefusIntitule)(intitule, [], null);
        if (refusForme)
            throw new common_1.BadRequestException(refusForme);
        const actif = dto.estActif !== false;
        const donnees = Object.fromEntries(CHAMPS.map((c) => [c, coordonnee(dto[c]) ?? null]));
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await this.verrouillerLeClient(tx, tenantId, tiersId);
            const autresLieuxActifs = await this.jugerLeGeste(tx, tenantId, tiersId, intitule, null);
            const principal = (0, lieux_livraison_1.principalApres)({ demande: dto.estPrincipal, actuel: false, actifApres: actif, autresLieuxActifs });
            if ('motif' in principal)
                throw new common_1.BadRequestException(principal.motif);
            if (principal.estPrincipal)
                await tx.lieuLivraison.updateMany({ where: { tenantId, tiersId }, data: { estPrincipal: false } });
            return tx.lieuLivraison.create({ data: { ...donnees, intitule, tenantId, tiersId, estActif: actif, estPrincipal: principal.estPrincipal } });
        });
    }
    async modifier(tenantId, id, dto) {
        const trouve = await this.trouver(tenantId, id);
        const intitule = (0, lieux_livraison_1.intituleDuLieu)(dto.intitule);
        const refusForme = (0, lieux_livraison_1.motifRefusIntitule)(intitule, [], trouve.id);
        if (refusForme)
            throw new common_1.BadRequestException(refusForme);
        const donnees = Object.fromEntries(CHAMPS.flatMap((c) => (coordonnee(dto[c]) === undefined ? [] : [[c, coordonnee(dto[c])]])));
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await this.verrouillerLeClient(tx, tenantId, trouve.tiersId);
            const lieu = await tx.lieuLivraison.findFirst({ where: { id: trouve.id, tenantId } });
            if (!lieu)
                throw new common_1.NotFoundException('Lieu de livraison introuvable pour ce dossier.');
            const autresLieuxActifs = await this.jugerLeGeste(tx, tenantId, lieu.tiersId, intitule, lieu.id);
            const actif = dto.estActif ?? lieu.estActif;
            const principal = (0, lieux_livraison_1.principalApres)({ demande: dto.estPrincipal, actuel: lieu.estPrincipal, actifApres: actif, autresLieuxActifs });
            if ('motif' in principal)
                throw new common_1.BadRequestException(principal.motif);
            if (principal.estPrincipal && !lieu.estPrincipal) {
                await tx.lieuLivraison.updateMany({ where: { tenantId, tiersId: lieu.tiersId }, data: { estPrincipal: false } });
            }
            return tx.lieuLivraison.update({ where: { id: lieu.id }, data: { ...donnees, intitule, estActif: actif, estPrincipal: principal.estPrincipal } });
        });
    }
    async supprimer(tenantId, id) {
        const lieu = await this.trouver(tenantId, id);
        (0, references_1.refuserSiReferences)(`Le lieu de livraison « ${lieu.intitule} »`, await (0, references_1.referencesVers)(this.prisma, 'LieuLivraison', lieu.id, tenantId));
        await this.prisma.lieuLivraison.delete({ where: { id: lieu.id } });
        return { supprime: true };
    }
};
exports.LieuxLivraisonService = LieuxLivraisonService;
exports.LieuxLivraisonService = LieuxLivraisonService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LieuxLivraisonService);
//# sourceMappingURL=lieux-livraison.service.js.map