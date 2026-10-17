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
exports.LotsVirementService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const lots_virement_1 = require("./lots-virement");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
let LotsVirementService = class LotsVirementService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    lister(tenantId) {
        return this.prisma.lotVirement
            .findMany({
            where: { tenantId },
            orderBy: { nom: 'asc' },
            include: {
                lignes: {
                    where: { tenantId },
                    orderBy: { ordre: 'asc' },
                    include: { compte: { select: { numero: true, intitule: true } } },
                },
            },
        })
            .then((lots) => lots.map((l) => ({
            id: l.id,
            nom: l.nom,
            journalId: l.journalId,
            lignes: l.lignes.map((x) => ({
                compteId: x.compteId,
                numero: x.compte.numero,
                intitule: x.compte.intitule,
                montant: Number(x.montant),
            })),
        })));
    }
    async verifier(tenantId, dto) {
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, id: { in: dto.lignes.map((l) => l.compteId) } },
            select: { id: true, numero: true, typeCompte: true },
        });
        const refus = (0, lots_virement_1.motifRefusLot)(dto.nom, dto.lignes, comptes);
        if (refus)
            throw new common_1.BadRequestException(refus);
        if (dto.journalId) {
            const j = await this.prisma.journal.findFirst({ where: { id: dto.journalId, tenantId }, select: { type: true } });
            if (!j)
                throw new common_1.NotFoundException('Journal introuvable dans ce dossier.');
            if (j.type !== 'TRESORERIE')
                throw new common_1.BadRequestException('Un virement se passe dans un journal de trésorerie.');
        }
    }
    lignes(tenantId, dto) {
        return dto.lignes.map((l, i) => ({ tenantId, compteId: l.compteId, montant: new client_1.Prisma.Decimal(l.montant), ordre: i + 1 }));
    }
    conflit(e, nom) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            throw new common_1.ConflictException(`Un lot « ${nom.trim()} » existe déjà.`);
        }
        throw e;
    }
    async creer(tenantId, auteur, dto) {
        await this.verifier(tenantId, dto);
        try {
            return await this.prisma.lotVirement.create({
                data: { tenantId, nom: dto.nom.trim(), journalId: dto.journalId ?? null, creePar: auteur, lignes: { create: this.lignes(tenantId, dto) } },
            });
        }
        catch (e) {
            this.conflit(e, dto.nom);
        }
    }
    async modifier(tenantId, id, dto) {
        const lot = await this.prisma.lotVirement.findFirst({ where: { id, tenantId } });
        if (!lot)
            throw new common_1.NotFoundException('Lot introuvable dans ce dossier.');
        await this.verifier(tenantId, dto);
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                await tx.ligneLotVirement.deleteMany({ where: { tenantId, lotId: lot.id } });
                return tx.lotVirement.update({
                    where: { id: lot.id },
                    data: { nom: dto.nom.trim(), journalId: dto.journalId ?? null, lignes: { create: this.lignes(tenantId, dto) } },
                });
            });
        }
        catch (e) {
            this.conflit(e, dto.nom);
        }
    }
    async supprimer(tenantId, id) {
        const lot = await this.prisma.lotVirement.findFirst({ where: { id, tenantId } });
        if (!lot)
            throw new common_1.NotFoundException('Lot introuvable dans ce dossier.');
        await this.prisma.lotVirement.delete({ where: { id: lot.id } });
        return { supprime: true };
    }
};
exports.LotsVirementService = LotsVirementService;
exports.LotsVirementService = LotsVirementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LotsVirementService);
//# sourceMappingURL=lots-virement.service.js.map