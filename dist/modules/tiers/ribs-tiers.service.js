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
exports.RibsTiersService = void 0;
exports.courrielsDesAuteurs = courrielsDesAuteurs;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const banques_1 = require("../banques/banques");
const ribs_tiers_1 = require("./ribs-tiers");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const visa_rib_1 = require("./visa-rib");
const nul = (v) => (v === undefined || v.trim() === '' ? null : v.trim());
let RibsTiersService = class RibsTiersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async tiersDuDossier(tenantId, tiersId) {
        const tiers = await this.prisma.tiers.findFirst({ where: { id: tiersId, tenantId }, select: { id: true } });
        if (!tiers)
            throw new common_1.NotFoundException('Tiers introuvable pour ce dossier.');
        return tiers;
    }
    async trouver(tenantId, id) {
        const rib = await this.prisma.ribTiers.findFirst({ where: { id, tenantId } });
        if (!rib)
            throw new common_1.NotFoundException('RIB introuvable pour ce dossier.');
        return rib;
    }
    donnees(dto) {
        const iban = nul(dto.iban);
        const donnees = {
            banque: dto.banque.trim(),
            titulaire: nul(dto.titulaire),
            codeBanque: nul(dto.codeBanque),
            codeGuichet: nul(dto.codeGuichet),
            numeroCompte: nul(dto.numeroCompte),
            cle: nul(dto.cle),
            iban: iban ? (0, banques_1.normaliserIban)(iban) : null,
            codeBic: nul(dto.codeBic)?.toUpperCase() ?? null,
            devise: nul(dto.devise)?.toUpperCase() ?? null,
            commentaire: nul(dto.commentaire),
        };
        const refus = (0, ribs_tiers_1.motifRefusRibTiers)(donnees);
        if (refus)
            throw new common_1.BadRequestException(refus);
        return donnees;
    }
    async lister(tenantId, tiersId, utilisateurId) {
        await this.tiersDuDossier(tenantId, tiersId);
        const [ribs, dossier] = await Promise.all([
            this.prisma.ribTiers.findMany({
                where: { tenantId, tiersId },
                orderBy: [{ estPrincipal: 'desc' }, { createdAt: 'asc' }],
            }),
            this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { visaRibs: true } }),
        ]);
        const courriels = await courrielsDesAuteurs(this.prisma, tenantId, (0, visa_rib_1.auteursDesVisas)(ribs));
        const exige = dossier?.visaRibs === true;
        return ribs.map((r) => ({ ...r, visa: (0, visa_rib_1.presenterVisa)(r, exige, utilisateurId, courriels) }));
    }
    async creer(tenantId, tiersId, dto, utilisateurId) {
        await this.tiersDuDossier(tenantId, tiersId);
        const donnees = this.donnees(dto);
        const existants = await this.prisma.ribTiers.count({ where: { tenantId, tiersId } });
        const principal = existants === 0 || dto.estPrincipal === true;
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            if (principal)
                await tx.ribTiers.updateMany({ where: { tenantId, tiersId }, data: { estPrincipal: false } });
            return tx.ribTiers.create({
                data: { ...donnees, tenantId, tiersId, estPrincipal: principal, ...(0, visa_rib_1.saisieDesCoordonnees)(utilisateurId, new Date()) },
            });
        });
    }
    async modifier(tenantId, id, dto, utilisateurId) {
        await this.trouver(tenantId, id);
        const donnees = this.donnees(dto);
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$queryRaw `SELECT id FROM "ribs_tiers" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
            const rib = await tx.ribTiers.findFirst({ where: { id, tenantId } });
            if (!rib)
                throw new common_1.NotFoundException('RIB introuvable pour ce dossier.');
            if (dto.estPrincipal === true && !rib.estPrincipal) {
                await tx.ribTiers.updateMany({ where: { tenantId, tiersId: rib.tiersId }, data: { estPrincipal: false } });
            }
            return tx.ribTiers.update({
                where: { id: rib.id },
                data: {
                    ...donnees,
                    ...(dto.estPrincipal === true ? { estPrincipal: true } : {}),
                    ...((0, visa_rib_1.coordonneesChangees)(rib, donnees) ? (0, visa_rib_1.saisieDesCoordonnees)(utilisateurId, new Date()) : {}),
                },
            });
        });
    }
    async viser(tenantId, id, utilisateurId, saisiLeLu) {
        await this.trouver(tenantId, id);
        const vise = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$queryRaw `SELECT id FROM "ribs_tiers" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
            const rib = await tx.ribTiers.findFirst({ where: { id, tenantId } });
            if (!rib)
                throw new common_1.NotFoundException('RIB introuvable pour ce dossier.');
            const refus = (0, visa_rib_1.motifRefusVisa)(rib, utilisateurId, saisiLeLu);
            if (refus === visa_rib_1.MOTIF_VISA_PAR_SON_AUTEUR)
                throw new common_1.ForbiddenException(refus);
            if (refus)
                throw new common_1.ConflictException(refus);
            return tx.ribTiers.update({ where: { id: rib.id }, data: { visePar: utilisateurId, viseLe: new Date() } });
        });
        return { rib: vise, avertissement: vise.saisiPar === null ? visa_rib_1.AVERTISSEMENT_AUTEUR_INCONNU : null };
    }
    async supprimer(tenantId, id) {
        const rib = await this.trouver(tenantId, id);
        await this.prisma.ribTiers.delete({ where: { id: rib.id } });
        return { supprime: true };
    }
};
exports.RibsTiersService = RibsTiersService;
exports.RibsTiersService = RibsTiersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RibsTiersService);
async function courrielsDesAuteurs(prisma, tenantId, ids) {
    if (ids.length === 0)
        return new Map();
    const users = await prisma.user.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, email: true } });
    return new Map(users.map((u) => [u.id, u.email]));
}
//# sourceMappingURL=ribs-tiers.service.js.map