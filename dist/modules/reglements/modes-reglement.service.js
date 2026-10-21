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
exports.ModesReglementService = void 0;
exports.modeDuDossier = modeDuDossier;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const reference_retiree_1 = require("../tiers/reference-retiree");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const references_1 = require("../../common/suppression/references");
const modes_reglement_1 = require("./modes-reglement");
async function modeDuDossier(prisma, tenantId, id) {
    const mode = await prisma.modeReglement.findFirst({
        where: { id, tenantId },
        select: { id: true, code: true, intitule: true, nature: true, estActif: true, journalId: true },
    });
    if (!mode)
        throw new common_1.NotFoundException('Mode de règlement introuvable pour ce dossier.');
    if (!mode.estActif) {
        throw new common_1.BadRequestException(`Le mode de règlement ${mode.code} (${mode.intitule}) est en sommeil · réactivez-le dans Modes de règlement, ou choisissez-en un autre.`);
    }
    return mode;
}
let ModesReglementService = class ModesReglementService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId) {
        const modes = await this.prisma.modeReglement.findMany({
            where: { tenantId },
            orderBy: { code: 'asc' },
            take: modes_reglement_1.PLAFOND_MODES_REGLEMENT,
            select: {
                id: true,
                code: true,
                intitule: true,
                nature: true,
                codeInterbancaire: true,
                journalId: true,
                estActif: true,
                journal: { select: { code: true, intitule: true } },
            },
        });
        return modes;
    }
    async creer(tenantId, userId, dto) {
        const motif = (0, modes_reglement_1.motifRefusIdentiteMode)(dto.code, dto.intitule);
        if (motif)
            throw new common_1.BadRequestException(motif);
        if (dto.journalId)
            await this.verifierJournal(tenantId, dto.journalId);
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`modes-reglement:${tenantId}`}))`;
                await this.refuserIntitulePris(tx, tenantId, dto.intitule, null);
                const nombre = await tx.modeReglement.count({ where: { tenantId } });
                if (nombre >= modes_reglement_1.PLAFOND_MODES_REGLEMENT) {
                    throw new common_1.BadRequestException(`Le dossier tient déjà ${modes_reglement_1.PLAFOND_MODES_REGLEMENT} modes de règlement, le nombre que Sage admet · mettez en sommeil ou supprimez un mode inutile.`);
                }
                return tx.modeReglement.create({
                    data: {
                        tenantId,
                        code: dto.code.trim().toUpperCase(),
                        intitule: dto.intitule.trim(),
                        nature: dto.nature,
                        codeInterbancaire: dto.codeInterbancaire?.trim() || null,
                        journalId: dto.journalId ?? null,
                        createdBy: userId,
                    },
                });
            });
        }
        catch (e) {
            throw this.dejaPris(e, dto.code, dto.intitule);
        }
    }
    async creerUsuels(tenantId, userId) {
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`modes-reglement:${tenantId}`}))`;
            const existants = await tx.modeReglement.findMany({ where: { tenantId }, select: { code: true, intitule: true } });
            const codes = new Set(existants.map((m) => m.code));
            const intitules = new Set(existants.map((m) => m.intitule.toLowerCase()));
            const crees = [];
            const dejaPresents = [];
            let place = modes_reglement_1.PLAFOND_MODES_REGLEMENT - existants.length;
            for (const u of modes_reglement_1.MODES_USUELS) {
                if (codes.has(u.code) || intitules.has(u.intitule.toLowerCase())) {
                    dejaPresents.push(u.intitule);
                    continue;
                }
                if (place <= 0) {
                    dejaPresents.push(`${u.intitule} (plafond de ${modes_reglement_1.PLAFOND_MODES_REGLEMENT} modes atteint)`);
                    continue;
                }
                await tx.modeReglement.create({ data: { tenantId, code: u.code, intitule: u.intitule, nature: u.nature, createdBy: userId } });
                crees.push(u.intitule);
                place--;
            }
            return { crees, dejaPresents };
        });
    }
    async modifier(tenantId, id, dto) {
        const existant = await this.prisma.modeReglement.findFirst({ where: { id, tenantId }, select: { id: true, code: true } });
        if (!existant)
            throw new common_1.NotFoundException('Mode de règlement introuvable pour ce dossier.');
        if (dto.intitule !== undefined) {
            const motif = (0, modes_reglement_1.motifRefusIdentiteMode)(existant.code, dto.intitule);
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        if (dto.journalId)
            await this.verifierJournal(tenantId, dto.journalId);
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                if (dto.intitule !== undefined) {
                    await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`modes-reglement:${tenantId}`}))`;
                    await this.refuserIntitulePris(tx, tenantId, dto.intitule, id);
                }
                return tx.modeReglement.update({
                    where: { id },
                    data: {
                        ...(dto.intitule !== undefined ? { intitule: dto.intitule.trim() } : {}),
                        ...(dto.nature !== undefined ? { nature: dto.nature } : {}),
                        ...(dto.codeInterbancaire !== undefined ? { codeInterbancaire: dto.codeInterbancaire?.trim() || null } : {}),
                        ...(dto.journalId !== undefined ? { journalId: dto.journalId } : {}),
                        ...(dto.estActif !== undefined ? { estActif: dto.estActif } : {}),
                    },
                });
            });
        }
        catch (e) {
            throw this.dejaPris(e, existant.code, dto.intitule ?? '');
        }
    }
    async supprimer(tenantId, id) {
        const existant = await this.prisma.modeReglement.findFirst({ where: { id, tenantId }, select: { id: true, code: true } });
        if (!existant)
            throw new common_1.NotFoundException('Mode de règlement introuvable pour ce dossier.');
        (0, references_1.refuserSiReferences)(`Le mode de règlement ${existant.code}`, await (0, references_1.referencesVers)(this.prisma, 'ModeReglement', id, tenantId));
        try {
            await this.prisma.modeReglement.delete({ where: { id } });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
                (0, references_1.refuserSiReferences)(`Le mode de règlement ${existant.code}`, await (0, references_1.referencesVers)(this.prisma, 'ModeReglement', id, tenantId));
                throw new common_1.ConflictException(`Le mode de règlement ${existant.code} vient d’être employé · mettez-le en sommeil.`);
            }
            throw e;
        }
        return { supprime: true };
    }
    async verifierJournal(tenantId, journalId) {
        const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { code: true, type: true } });
        if (!journal)
            throw new common_1.NotFoundException('Journal introuvable pour ce dossier.');
        if (journal.type !== client_1.TypeJournal.TRESORERIE) {
            throw new common_1.BadRequestException(`Le journal ${journal.code} n'est pas un journal de trésorerie · un mode de règlement ne propose qu'un journal de banque ou de caisse.`);
        }
    }
    async refuserIntitulePris(tx, tenantId, intitule, idModifie) {
        const voulu = intitule.trim();
        const homonymes = await tx.modeReglement.findMany({
            where: { tenantId, intitule: { equals: voulu, mode: 'insensitive' }, ...(idModifie ? { NOT: { id: idModifie } } : {}) },
            select: { intitule: true },
            take: 50,
        });
        const pris = homonymes.find((m) => m.intitule.toLocaleLowerCase('fr') === voulu.toLocaleLowerCase('fr'));
        if (pris)
            throw new common_1.ConflictException(`Un mode de règlement « ${pris.intitule} » existe déjà dans ce dossier.`);
    }
    dejaPris(e, code, intitule) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2003')
            return (0, reference_retiree_1.conflitSiReferenceRetiree)(e);
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            const cible = JSON.stringify(e.meta?.target ?? '');
            return new common_1.ConflictException(cible.includes('intitule')
                ? `Un mode de règlement « ${intitule.trim()} » existe déjà dans ce dossier.`
                : `Le code ${code.trim().toUpperCase()} est déjà celui d'un mode de règlement de ce dossier.`);
        }
        return e;
    }
};
exports.ModesReglementService = ModesReglementService;
exports.ModesReglementService = ModesReglementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ModesReglementService);
//# sourceMappingURL=modes-reglement.service.js.map