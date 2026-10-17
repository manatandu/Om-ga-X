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
exports.OdAnalytiqueService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const od_analytique_1 = require("./od-analytique");
const gel_cloture_1 = require("../exercice/gel-cloture");
let OdAnalytiqueService = class OdAnalytiqueService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId, exerciceId, planId) {
        const ods = await this.prisma.odAnalytique.findMany({
            where: { tenantId, exerciceId, ...(planId ? { planId } : {}) },
            include: {
                plan: { select: { code: true, intitule: true } },
                compte: { select: { numero: true, intitule: true } },
                lignes: { include: { section: { select: { code: true, intitule: true } } } },
            },
            orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        });
        return ods.map((o) => ({
            id: o.id,
            date: o.date.toISOString().slice(0, 10),
            reference: o.reference,
            libelle: o.libelle,
            planId: o.planId,
            plan: o.plan,
            compte: o.compte,
            montant: o.lignes.reduce((t, l) => t + Number(l.debit), 0),
            lignes: o.lignes.map((l) => ({
                sectionId: l.sectionId,
                sectionCode: l.section.code,
                sectionIntitule: l.section.intitule,
                debit: Number(l.debit),
                credit: Number(l.credit),
            })),
        }));
    }
    async creer(tenantId, userId, dto) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice est clôturé · son analytique ne se corrige plus.");
        }
        const date = new Date(dto.date);
        if (date < exercice.dateDebut || date > exercice.dateFin) {
            throw new common_1.BadRequestException("La date de l'OD tombe hors de l'exercice.");
        }
        await this.refuserSiPeriodeClose(tenantId, date);
        const plan = await this.prisma.planAnalytique.findFirst({ where: { id: dto.planId, tenantId } });
        if (!plan)
            throw new common_1.NotFoundException('Plan analytique introuvable pour ce dossier.');
        const compte = await this.prisma.compte.findFirst({ where: { id: dto.compteId, tenantId } });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable pour ce dossier.');
        const sections = await this.prisma.sectionAnalytique.findMany({
            where: { tenantId, id: { in: dto.lignes.map((l) => l.sectionId) } },
            select: { id: true, planId: true, code: true, type: true },
        });
        const refus = (0, od_analytique_1.motifRefusOd)({
            planId: plan.id,
            lignes: dto.lignes,
            sections: sections.map((s) => ({ ...s, estTotal: s.type === client_1.TypeCompteDetailTotal.TOTAL })),
            classeCompte: compte.classe.replace('CLASSE_', ''),
            classesVentilees: plan.classesVentilees,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        return this.prisma.odAnalytique.create({
            data: {
                tenantId,
                exerciceId: exercice.id,
                planId: plan.id,
                compteId: compte.id,
                date,
                reference: dto.reference || null,
                libelle: dto.libelle,
                createdBy: userId,
                lignes: {
                    create: dto.lignes.map((l) => ({
                        tenantId,
                        sectionId: l.sectionId,
                        debit: l.debit ?? 0,
                        credit: l.credit ?? 0,
                    })),
                },
            },
            select: { id: true },
        });
    }
    async supprimer(tenantId, id) {
        const od = await this.prisma.odAnalytique.findFirst({ where: { id, tenantId }, include: { exercice: true } });
        if (!od)
            throw new common_1.NotFoundException('OD analytique introuvable pour ce dossier.');
        if (od.exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice est clôturé · son analytique ne se corrige plus.");
        }
        await this.refuserSiPeriodeClose(tenantId, od.date);
        await this.prisma.odAnalytique.delete({ where: { id } });
        return { supprime: true };
    }
    async refuserSiPeriodeClose(tenantId, date) {
        const clotures = await this.prisma.cloture.findMany({
            where: { tenantId, annuleeAt: null, granularite: client_1.GranulariteCloture.PERIODE },
            select: { granularite: true, journalId: true, dateLimite: true },
        });
        const motif = (0, gel_cloture_1.motifLigneFigee)({ journalId: '', date, exerciceClos: false }, clotures);
        if (motif) {
            throw new common_1.BadRequestException(`L'OD analytique ne se passe ni ne se retire à cette date : ${motif}.`);
        }
    }
    async cumulsParSection(tenantId, planId, exerciceId, du, au) {
        const groupes = await this.prisma.ligneOdAnalytique.groupBy({
            by: ['sectionId'],
            where: { tenantId, od: { tenantId, planId, exerciceId, date: { gte: du, lte: au } } },
            _sum: { debit: true, credit: true },
        });
        return new Map(groupes.map((g) => [g.sectionId, { debit: Number(g._sum.debit ?? 0), credit: Number(g._sum.credit ?? 0) }]));
    }
};
exports.OdAnalytiqueService = OdAnalytiqueService;
exports.OdAnalytiqueService = OdAnalytiqueService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OdAnalytiqueService);
//# sourceMappingURL=od-analytique.service.js.map