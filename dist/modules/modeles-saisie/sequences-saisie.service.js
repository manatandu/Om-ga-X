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
exports.SequencesSaisieService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const sequences_saisie_1 = require("./sequences-saisie");
let SequencesSaisieService = class SequencesSaisieService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId) {
        const [sequences, parSequence] = await Promise.all([
            this.prisma.sequenceSaisie.findMany({
                where: { tenantId },
                orderBy: { numero: 'asc' },
                take: sequences_saisie_1.NOMBRE_MAX_SEQUENCES,
                select: { id: true, numero: true, intitule: true },
            }),
            this.prisma.modeleSaisie.groupBy({
                by: ['sequenceSaisieId'],
                where: { tenantId, sequenceSaisieId: { not: null } },
                _count: { _all: true },
            }),
        ]);
        const compte = new Map(parSequence.map((g) => [g.sequenceSaisieId, g._count._all]));
        return sequences.map((s) => ({ ...s, nombreModeles: compte.get(s.id) ?? 0 }));
    }
    async creer(tenantId, userId, intitule) {
        const motif = (0, sequences_saisie_1.motifRefusIntituleSequence)(intitule);
        if (motif)
            throw new common_1.BadRequestException(motif);
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`sequences-saisie:${tenantId}`}))`;
                const pris = await tx.sequenceSaisie.findMany({ where: { tenantId }, select: { numero: true } });
                const numero = (0, sequences_saisie_1.premierRangLibre)(pris.map((p) => p.numero));
                if (numero === null)
                    throw new common_1.BadRequestException(sequences_saisie_1.MOTIF_DIX_SEQUENCES);
                return tx.sequenceSaisie.create({
                    data: { tenantId, numero, intitule: intitule.trim(), createdBy: userId },
                    select: { id: true, numero: true, intitule: true },
                });
            });
        }
        catch (e) {
            throw this.intituleDejaPris(e, intitule);
        }
    }
    async renommer(tenantId, id, intitule) {
        const motif = (0, sequences_saisie_1.motifRefusIntituleSequence)(intitule);
        if (motif)
            throw new common_1.BadRequestException(motif);
        const existante = await this.prisma.sequenceSaisie.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!existante)
            throw new common_1.NotFoundException('Séquence de saisie introuvable');
        try {
            return await this.prisma.sequenceSaisie.update({
                where: { id },
                data: { intitule: intitule.trim() },
                select: { id: true, numero: true, intitule: true },
            });
        }
        catch (e) {
            throw this.intituleDejaPris(e, intitule);
        }
    }
    async supprimer(tenantId, id) {
        const existante = await this.prisma.sequenceSaisie.findFirst({ where: { id, tenantId }, select: { id: true, intitule: true } });
        if (!existante)
            throw new common_1.NotFoundException('Séquence de saisie introuvable');
        const nombre = await this.prisma.modeleSaisie.count({ where: { tenantId, sequenceSaisieId: id } });
        if (nombre > 0)
            throw new common_1.ConflictException((0, sequences_saisie_1.motifSequenceOccupee)(existante.intitule, nombre));
        try {
            await this.prisma.sequenceSaisie.delete({ where: { id } });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
                const recompte = await this.prisma.modeleSaisie.count({ where: { tenantId, sequenceSaisieId: id } });
                throw new common_1.ConflictException((0, sequences_saisie_1.motifSequenceOccupee)(existante.intitule, Math.max(recompte, 1)));
            }
            throw e;
        }
        return { supprime: true };
    }
    intituleDejaPris(e, intitule) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            return new common_1.ConflictException(`Une séquence « ${intitule.trim()} » existe déjà dans ce dossier.`);
        }
        return e;
    }
};
exports.SequencesSaisieService = SequencesSaisieService;
exports.SequencesSaisieService = SequencesSaisieService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SequencesSaisieService);
//# sourceMappingURL=sequences-saisie.service.js.map