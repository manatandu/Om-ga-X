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
var ConventionFinancementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConventionFinancementService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const EPSILON = 0.005;
let ConventionFinancementService = ConventionFinancementService_1 = class ConventionFinancementService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    static traitement(convention) {
        return convention.caractere === client_1.CaractereEngagement.FERME_INCONDITIONNEL && convention.ecritSigne
            ? 'CREANCE_A_RECEVOIR'
            : 'MENTION_NOTES_ANNEXES';
    }
    static resteARecevoir(convention) {
        if (convention.statut === client_1.StatutConvention.RESILIEE)
            return 0;
        const encaisse = convention.tranches.reduce((s, t) => s + Number(t.montantEncaisse ?? 0), 0);
        return Math.max(0, Number(convention.montantAccorde) - encaisse);
    }
    async lister(tenantId, aujourdhui = new Date()) {
        const conventions = await this.prisma.conventionFinancement.findMany({
            where: { tenantId },
            orderBy: [{ dateDebut: 'desc' }],
            include: {
                bailleur: { select: { id: true, code: true, nom: true } },
                tranches: { orderBy: { numero: 'asc' } },
                rapports: { orderBy: { dateEcheance: 'asc' } },
            },
        });
        return conventions.map((c) => {
            const encaisse = c.tranches.reduce((s, t) => s + Number(t.montantEncaisse ?? 0), 0);
            return {
                id: c.id,
                bailleur: c.bailleur,
                reference: c.reference,
                objet: c.objet,
                ecritSigne: c.ecritSigne,
                signataire: c.signataire,
                dateSignature: c.dateSignature,
                dateDebut: c.dateDebut,
                dateFin: c.dateFin,
                montantAccorde: Number(c.montantAccorde),
                caractere: c.caractere,
                conditions: c.conditions,
                statut: c.statut,
                motifCloture: c.motifCloture,
                traitement: ConventionFinancementService_1.traitement(c),
                montantEncaisse: encaisse,
                resteARecevoir: ConventionFinancementService_1.resteARecevoir(c),
                expiree: c.statut === client_1.StatutConvention.EN_COURS && c.dateFin < aujourdhui,
                tranches: c.tranches.map((t) => ({
                    id: t.id,
                    numero: t.numero,
                    libelle: t.libelle,
                    montant: Number(t.montant),
                    datePrevue: t.datePrevue,
                    dateEncaissement: t.dateEncaissement,
                    montantEncaisse: t.montantEncaisse === null ? null : Number(t.montantEncaisse),
                    enRetard: t.dateEncaissement === null && t.datePrevue < aujourdhui,
                })),
                rapports: c.rapports.map((r) => ({
                    id: r.id,
                    intitule: r.intitule,
                    nature: r.nature,
                    dateEcheance: r.dateEcheance,
                    dateTransmission: r.dateTransmission,
                    observation: r.observation,
                    enRetard: r.dateTransmission === null && r.dateEcheance < aujourdhui,
                })),
            };
        });
    }
    async mentionsEngagementsConditionnels(tenantId) {
        const conventions = await this.prisma.conventionFinancement.findMany({
            where: {
                tenantId,
                caractere: client_1.CaractereEngagement.CONDITIONNEL,
                statut: { not: client_1.StatutConvention.RESILIEE },
            },
            orderBy: [{ dateDebut: 'asc' }],
            include: { bailleur: { select: { code: true, nom: true } }, tranches: { select: { montantEncaisse: true } } },
        });
        return conventions.map((c) => {
            const reste = ConventionFinancementService_1.resteARecevoir(c);
            return (`${c.bailleur.nom} (${c.bailleur.code}) · convention ${c.reference}, ${c.objet}. ` +
                `Engagement CONDITIONNEL de ${Number(c.montantAccorde).toLocaleString('fr-FR')}, ` +
                `dont ${reste.toLocaleString('fr-FR')} restant à recevoir. Conditions : ${c.conditions ?? '·'}. ` +
                "Cet engagement n'est pas comptabilisé en créance : il ne le sera que lorsque les conditions seront remplies " +
                '(SYCEBNL, cadre conceptuel § 5.4.2.4).');
        });
    }
    async creancesARecevoir(tenantId) {
        const conventions = await this.prisma.conventionFinancement.findMany({
            where: {
                tenantId,
                caractere: client_1.CaractereEngagement.FERME_INCONDITIONNEL,
                ecritSigne: true,
                statut: client_1.StatutConvention.EN_COURS,
            },
            include: { bailleur: { select: { code: true, nom: true } }, tranches: { select: { montantEncaisse: true } } },
        });
        return conventions
            .map((c) => ({
            reference: c.reference,
            bailleur: `${c.bailleur.code} · ${c.bailleur.nom}`,
            montantAccorde: Number(c.montantAccorde),
            resteARecevoir: ConventionFinancementService_1.resteARecevoir(c),
        }))
            .filter((c) => c.resteARecevoir > EPSILON);
    }
    async creer(tenantId, userId, dto) {
        const bailleur = await this.prisma.bailleur.findFirst({
            where: { id: dto.bailleurId, tenantId },
            select: { id: true },
        });
        if (!bailleur)
            throw new common_1.NotFoundException('Bailleur introuvable dans ce dossier.');
        this.verifierCoherence(dto);
        const doublon = await this.prisma.conventionFinancement.findFirst({
            where: { tenantId, bailleurId: dto.bailleurId, reference: dto.reference.trim() },
            select: { id: true },
        });
        if (doublon) {
            throw new common_1.BadRequestException(`Ce bailleur porte déjà une convention « ${dto.reference.trim()} ». Deux exemplaires de la même convention ` +
                'doubleraient le montant accordé, et donc la créance à recevoir.');
        }
        return this.prisma.conventionFinancement.create({
            data: {
                tenantId,
                bailleurId: dto.bailleurId,
                reference: dto.reference.trim(),
                objet: dto.objet.trim(),
                ecritSigne: dto.ecritSigne ?? false,
                signataire: dto.signataire?.trim() || null,
                dateSignature: dto.dateSignature ? new Date(dto.dateSignature) : null,
                dateDebut: new Date(dto.dateDebut),
                dateFin: new Date(dto.dateFin),
                montantAccorde: dto.montantAccorde,
                caractere: dto.caractere,
                conditions: dto.conditions?.trim() || null,
                createdBy: userId,
            },
        });
    }
    verifierCoherence(dto) {
        if (dto.montantAccorde <= 0) {
            throw new common_1.BadRequestException('Le montant accordé doit être strictement positif.');
        }
        if (new Date(dto.dateFin) < new Date(dto.dateDebut)) {
            throw new common_1.BadRequestException('La date de fin de la convention précède sa date de début.');
        }
        if (dto.caractere === client_1.CaractereEngagement.CONDITIONNEL && !dto.conditions?.trim()) {
            throw new common_1.BadRequestException("Un engagement CONDITIONNEL doit dire à quoi il est conditionné : le § 5.4.2.4 impose de le mentionner en " +
                "Notes annexes, et « conditionnel » sans ses conditions ne se mentionne pas.");
        }
        if (dto.ecritSigne && !dto.signataire?.trim()) {
            throw new common_1.BadRequestException("Nommez le signataire : le texte parle des « représentants HABILITÉS des tiers financeurs », et un écrit signé " +
                "par quelqu'un d'autre n'engage pas le financeur.");
        }
    }
    async modifier(tenantId, conventionId, dto) {
        const convention = await this.prisma.conventionFinancement.findFirst({
            where: { id: conventionId, tenantId },
            include: { tranches: { select: { montant: true } } },
        });
        if (!convention)
            throw new common_1.NotFoundException('Convention introuvable dans ce dossier.');
        if (dto.montantAccorde !== undefined) {
            const prevu = (convention.tranches ?? []).reduce((s, t) => s + Number(t.montant), 0);
            if (prevu - dto.montantAccorde > EPSILON) {
                throw new common_1.BadRequestException(`Le montant accordé (${dto.montantAccorde.toFixed(2)}) serait inférieur au total des tranches ` +
                    `(${prevu.toFixed(2)}). Retirez ou réduisez d'abord les tranches qu'il ne fonde plus.`);
            }
        }
        const fusion = {
            caractere: dto.caractere ?? convention.caractere,
            conditions: dto.conditions ?? convention.conditions ?? undefined,
            ecritSigne: dto.ecritSigne ?? convention.ecritSigne,
            signataire: dto.signataire ?? convention.signataire ?? undefined,
            montantAccorde: dto.montantAccorde ?? Number(convention.montantAccorde),
            dateDebut: dto.dateDebut ?? convention.dateDebut.toISOString(),
            dateFin: dto.dateFin ?? convention.dateFin.toISOString(),
        };
        this.verifierCoherence(fusion);
        return this.prisma.conventionFinancement.update({
            where: { id: conventionId },
            data: {
                objet: dto.objet?.trim(),
                ecritSigne: dto.ecritSigne,
                signataire: dto.signataire?.trim(),
                dateSignature: dto.dateSignature ? new Date(dto.dateSignature) : undefined,
                dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
                dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
                montantAccorde: dto.montantAccorde,
                caractere: dto.caractere,
                conditions: dto.conditions?.trim(),
            },
        });
    }
    async clore(tenantId, conventionId, dto) {
        const convention = await this.prisma.conventionFinancement.findFirst({
            where: { id: conventionId, tenantId },
            select: { id: true, statut: true },
        });
        if (!convention)
            throw new common_1.NotFoundException('Convention introuvable dans ce dossier.');
        if (convention.statut !== client_1.StatutConvention.EN_COURS) {
            throw new common_1.BadRequestException("Cette convention n'est plus en cours.");
        }
        if (dto.statut === client_1.StatutConvention.RESILIEE && !dto.motif?.trim()) {
            throw new common_1.BadRequestException('Le motif de résiliation est obligatoire : elle fait tomber le reste à recevoir de la convention.');
        }
        return this.prisma.conventionFinancement.update({
            where: { id: conventionId },
            data: { statut: dto.statut, motifCloture: dto.motif?.trim() || null },
        });
    }
    async ajouterTranche(tenantId, conventionId, dto) {
        const convention = await this.prisma.conventionFinancement.findFirst({
            where: { id: conventionId, tenantId },
            include: { tranches: { select: { numero: true, montant: true } } },
        });
        if (!convention)
            throw new common_1.NotFoundException('Convention introuvable dans ce dossier.');
        if (dto.montant <= 0)
            throw new common_1.BadRequestException('Le montant de la tranche doit être strictement positif.');
        const dejaPrevu = convention.tranches.reduce((s, t) => s + Number(t.montant), 0);
        if (dejaPrevu + dto.montant - Number(convention.montantAccorde) > EPSILON) {
            throw new common_1.BadRequestException(`Le total des tranches (${(dejaPrevu + dto.montant).toFixed(2)}) dépasserait le montant accordé ` +
                `(${Number(convention.montantAccorde).toFixed(2)}).`);
        }
        if (convention.tranches.some((t) => t.numero === dto.numero)) {
            throw new common_1.BadRequestException(`La tranche n° ${dto.numero} existe déjà sur cette convention.`);
        }
        return this.prisma.trancheFinancement.create({
            data: {
                conventionId,
                numero: dto.numero,
                libelle: dto.libelle.trim(),
                montant: dto.montant,
                datePrevue: new Date(dto.datePrevue),
            },
        });
    }
    async encaisserTranche(tenantId, conventionId, trancheId, dto) {
        const tranche = await this.prisma.trancheFinancement.findFirst({
            where: { id: trancheId, conventionId, convention: { tenantId } },
            select: { id: true, dateEncaissement: true },
        });
        if (!tranche)
            throw new common_1.NotFoundException('Tranche introuvable sur cette convention.');
        if (tranche.dateEncaissement) {
            throw new common_1.BadRequestException('Cette tranche est déjà encaissée.');
        }
        if (dto.montantEncaisse <= 0) {
            throw new common_1.BadRequestException('Le montant encaissé doit être strictement positif.');
        }
        return this.prisma.trancheFinancement.update({
            where: { id: trancheId },
            data: { dateEncaissement: new Date(dto.dateEncaissement), montantEncaisse: dto.montantEncaisse },
        });
    }
    async supprimerTranche(tenantId, conventionId, trancheId) {
        const tranche = await this.prisma.trancheFinancement.findFirst({
            where: { id: trancheId, conventionId, convention: { tenantId } },
            select: { id: true, dateEncaissement: true },
        });
        if (!tranche)
            throw new common_1.NotFoundException('Tranche introuvable sur cette convention.');
        if (tranche.dateEncaissement) {
            throw new common_1.BadRequestException("Cette tranche est encaissée : elle ne s'efface pas. Un encaissement effacé ferait remonter le reste à recevoir sans qu'aucun remboursement ne l'explique.");
        }
        await this.prisma.trancheFinancement.delete({ where: { id: trancheId } });
        return { supprime: true };
    }
    async ajouterRapport(tenantId, conventionId, dto) {
        const convention = await this.prisma.conventionFinancement.findFirst({
            where: { id: conventionId, tenantId },
            select: { id: true },
        });
        if (!convention)
            throw new common_1.NotFoundException('Convention introuvable dans ce dossier.');
        return this.prisma.rapportBailleur.create({
            data: {
                conventionId,
                intitule: dto.intitule.trim(),
                nature: dto.nature,
                dateEcheance: new Date(dto.dateEcheance),
                observation: dto.observation?.trim() || null,
            },
        });
    }
    async transmettreRapport(tenantId, conventionId, rapportId, dateTransmission) {
        const rapport = await this.prisma.rapportBailleur.findFirst({
            where: { id: rapportId, conventionId, convention: { tenantId } },
            select: { id: true },
        });
        if (!rapport)
            throw new common_1.NotFoundException('Rapport introuvable sur cette convention.');
        return this.prisma.rapportBailleur.update({
            where: { id: rapportId },
            data: { dateTransmission: new Date(dateTransmission) },
        });
    }
    async supprimerRapport(tenantId, conventionId, rapportId) {
        const rapport = await this.prisma.rapportBailleur.findFirst({
            where: { id: rapportId, conventionId, convention: { tenantId } },
            select: { id: true },
        });
        if (!rapport)
            throw new common_1.NotFoundException('Rapport introuvable sur cette convention.');
        await this.prisma.rapportBailleur.delete({ where: { id: rapportId } });
        return { supprime: true };
    }
};
exports.ConventionFinancementService = ConventionFinancementService;
exports.ConventionFinancementService = ConventionFinancementService = ConventionFinancementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ConventionFinancementService);
//# sourceMappingURL=convention-financement.service.js.map