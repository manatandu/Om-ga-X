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
exports.RibsSalariesService = exports.PLAFOND_RIBS_SALARIE = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const banques_1 = require("../banques/banques");
const ribs_tiers_1 = require("../tiers/ribs-tiers");
const nul = (v) => (v === undefined || v.trim() === '' ? null : v.trim());
exports.PLAFOND_RIBS_SALARIE = 20;
let RibsSalariesService = class RibsSalariesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async salarie(tenantId, salarieId) {
        const s = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true, modePaiement: true } });
        if (!s)
            throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
        return s;
    }
    async trouver(tenantId, id) {
        const rib = await this.prisma.ribSalarie.findFirst({ where: { id, tenantId } });
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
            throw new common_1.BadRequestException(refus.replace('du tiers', 'du salarié'));
        return donnees;
    }
    async lire(tenantId, salarieId) {
        const s = await this.salarie(tenantId, salarieId);
        const [ribs, total] = await Promise.all([
            this.prisma.ribSalarie.findMany({
                where: { tenantId, salarieId },
                orderBy: [{ estPrincipal: 'desc' }, { createdAt: 'asc' }],
                take: exports.PLAFOND_RIBS_SALARIE,
            }),
            this.prisma.ribSalarie.count({ where: { tenantId, salarieId } }),
        ]);
        return {
            modePaiement: s.modePaiement,
            ribs: ribs.map((r) => ({ ...r, coordonnees: (0, ribs_tiers_1.coordonneesImprimees)(r) })),
            total,
            tronque: total > ribs.length,
        };
    }
    async definirMode(tenantId, salarieId, mode) {
        if (mode === undefined) {
            throw new common_1.BadRequestException('Le mode de paiement se déclare (virement, chèque, espèces), ou « pas encore dit » (null).');
        }
        await this.salarie(tenantId, salarieId);
        await this.prisma.salarie.update({ where: { id: salarieId, tenantId }, data: { modePaiement: mode } });
        return this.lire(tenantId, salarieId);
    }
    async creer(tenantId, salarieId, dto) {
        await this.salarie(tenantId, salarieId);
        const donnees = this.donnees(dto);
        const existants = await this.prisma.ribSalarie.count({ where: { tenantId, salarieId } });
        const principal = existants === 0 || dto.estPrincipal === true;
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            if (principal)
                await tx.ribSalarie.updateMany({ where: { tenantId, salarieId }, data: { estPrincipal: false } });
            return tx.ribSalarie.create({ data: { ...donnees, tenantId, salarieId, estPrincipal: principal } });
        });
    }
    async modifier(tenantId, id, dto) {
        const rib = await this.trouver(tenantId, id);
        const donnees = this.donnees(dto);
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            if (dto.estPrincipal === true && !rib.estPrincipal) {
                await tx.ribSalarie.updateMany({ where: { tenantId, salarieId: rib.salarieId }, data: { estPrincipal: false } });
            }
            return tx.ribSalarie.update({
                where: { id: rib.id },
                data: { ...donnees, ...(dto.estPrincipal === true ? { estPrincipal: true } : {}) },
            });
        });
    }
    async supprimer(tenantId, id) {
        const rib = await this.trouver(tenantId, id);
        await this.prisma.ribSalarie.delete({ where: { id: rib.id } });
        return { supprime: true };
    }
};
exports.RibsSalariesService = RibsSalariesService;
exports.RibsSalariesService = RibsSalariesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RibsSalariesService);
//# sourceMappingURL=ribs-salaries.service.js.map