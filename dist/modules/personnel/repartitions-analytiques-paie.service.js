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
exports.RepartitionsAnalytiquesPaieService = exports.PLAFOND_VERSIONS_DU_MOIS = exports.PLAFOND_VERSIONS_LUES = exports.PLAFOND_SECTIONS_PAR_PLAN = exports.PLAFOND_PLANS_LUS = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const od_analytique_1 = require("../analytique/od-analytique");
const ventilation_analytique_paie_1 = require("./ventilation-analytique-paie");
exports.PLAFOND_PLANS_LUS = 50;
exports.PLAFOND_SECTIONS_PAR_PLAN = 500;
exports.PLAFOND_VERSIONS_LUES = 200;
exports.PLAFOND_VERSIONS_DU_MOIS = 20_000;
function estDoublon(e) {
    for (let x = e, n = 0; x && n < 5; x = x.cause, n++) {
        if (x instanceof client_1.Prisma.PrismaClientKnownRequestError && x.code === 'P2002')
            return true;
    }
    return false;
}
const versionLue = (v) => ({
    id: v.id,
    salarieId: v.salarieId,
    planId: v.planId,
    moisEffet: v.moisEffet,
    lignes: v.lignes.map((l) => ({ sectionId: l.sectionId, pourcentage: Number(l.pourcentage) })),
});
let RepartitionsAnalytiquesPaieService = class RepartitionsAnalytiquesPaieService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async salarie(tenantId, salarieId) {
        const s = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true } });
        if (!s)
            throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
        return s;
    }
    async lire(tenantId, salarieId) {
        await this.salarie(tenantId, salarieId);
        const [plans, versions, total] = await Promise.all([
            this.prisma.planAnalytique.findMany({
                where: { tenantId, estActif: true },
                orderBy: [{ ordre: 'asc' }, { code: 'asc' }],
                take: exports.PLAFOND_PLANS_LUS,
                select: {
                    id: true,
                    code: true,
                    intitule: true,
                    classesVentilees: true,
                    sections: {
                        where: { type: client_1.TypeCompteDetailTotal.DETAIL, estActive: true },
                        orderBy: { code: 'asc' },
                        take: exports.PLAFOND_SECTIONS_PAR_PLAN + 1,
                        select: { id: true, code: true, intitule: true },
                    },
                },
            }),
            this.prisma.repartitionAnalytiquePaie.findMany({
                where: { tenantId, salarieId },
                orderBy: [{ moisEffet: 'desc' }, { createdAt: 'desc' }],
                take: exports.PLAFOND_VERSIONS_LUES,
                select: {
                    id: true,
                    planId: true,
                    moisEffet: true,
                    createdAt: true,
                    retireLe: true,
                    motifRetrait: true,
                    plan: { select: { code: true, intitule: true } },
                    lignes: {
                        orderBy: { section: { code: 'asc' } },
                        select: { sectionId: true, pourcentage: true, section: { select: { code: true, intitule: true } } },
                    },
                },
            }),
            this.prisma.repartitionAnalytiquePaie.count({ where: { tenantId, salarieId } }),
        ]);
        return {
            plans: plans.map((p) => ({
                id: p.id,
                code: p.code,
                intitule: p.intitule,
                ventileLaPaie: (0, od_analytique_1.motifRefusClasseVentilee)(ventilation_analytique_paie_1.CLASSE_DES_CHARGES_DE_PERSONNEL, p.classesVentilees) === null,
                sections: p.sections.slice(0, exports.PLAFOND_SECTIONS_PAR_PLAN),
                sectionsTronquees: p.sections.length > exports.PLAFOND_SECTIONS_PAR_PLAN,
            })),
            plansTronques: plans.length === exports.PLAFOND_PLANS_LUS,
            versions: versions.map((v) => ({
                id: v.id,
                planId: v.planId,
                planCode: v.plan.code,
                planIntitule: v.plan.intitule,
                moisEffet: v.moisEffet,
                createdAt: v.createdAt,
                retireLe: v.retireLe,
                motifRetrait: v.motifRetrait,
                lignes: v.lignes.map((l) => ({
                    sectionId: l.sectionId,
                    sectionCode: l.section.code,
                    sectionIntitule: l.section.intitule,
                    pourcentage: Number(l.pourcentage),
                })),
            })),
            total,
            tronque: total > versions.length,
        };
    }
    async declarer(tenantId, userId, salarieId, dto) {
        await this.salarie(tenantId, salarieId);
        const [plan, sections] = await Promise.all([
            this.prisma.planAnalytique.findFirst({
                where: { id: dto.planId, tenantId },
                select: { id: true, code: true, classesVentilees: true, estActif: true },
            }),
            dto.lignes.length
                ? this.prisma.sectionAnalytique.findMany({
                    where: { tenantId, id: { in: dto.lignes.map((l) => l.sectionId) } },
                    select: { id: true, planId: true, code: true, type: true, estActive: true },
                })
                : Promise.resolve([]),
        ]);
        const connues = sections.map((s) => ({
            id: s.id,
            planId: s.planId,
            code: s.code,
            estTotal: s.type === client_1.TypeCompteDetailTotal.TOTAL,
            estActive: s.estActive,
        }));
        const motif = (0, ventilation_analytique_paie_1.motifRefusRepartition)({ plan, sections: connues, lignes: dto.lignes, moisEffet: dto.moisEffet });
        if (motif)
            throw new common_1.BadRequestException(motif);
        const existante = await this.prisma.repartitionAnalytiquePaie.findFirst({
            where: { tenantId, salarieId, planId: dto.planId, moisEffet: dto.moisEffet, retireLe: null },
            select: { id: true },
        });
        const refusDoublon = () => new common_1.ConflictException(`Une répartition sur le plan ${plan.code} vaut déjà à partir de ${dto.moisEffet} · une version ne se modifie pas · ` +
            'retirez-la avec son motif, puis déclarez la nouvelle.');
        if (existante)
            throw refusDoublon();
        try {
            return await this.prisma.repartitionAnalytiquePaie.create({
                data: {
                    tenantId,
                    salarieId,
                    planId: dto.planId,
                    moisEffet: dto.moisEffet,
                    creePar: userId,
                    lignes: {
                        create: dto.lignes.map((l) => ({
                            tenantId,
                            sectionId: l.sectionId,
                            pourcentage: new client_1.Prisma.Decimal(l.pourcentage.toFixed(2)),
                        })),
                    },
                },
                select: { id: true, moisEffet: true },
            });
        }
        catch (e) {
            if (estDoublon(e))
                throw refusDoublon();
            throw e;
        }
    }
    async retirer(tenantId, userId, id, motif) {
        const v = await this.prisma.repartitionAnalytiquePaie.findFirst({
            where: { id, tenantId },
            select: { id: true, retireLe: true },
        });
        if (!v)
            throw new common_1.NotFoundException('Répartition introuvable dans ce dossier.');
        if (v.retireLe)
            throw new common_1.ConflictException('Cette répartition est déjà retirée.');
        return this.prisma.repartitionAnalytiquePaie.update({
            where: { id, tenantId },
            data: { retireLe: new Date(), retirePar: userId, motifRetrait: motif.trim() },
            select: { id: true, retireLe: true },
        });
    }
    async pourLaPassation(tenantId, mois, salarieIds) {
        const plans = await this.prisma.planAnalytique.findMany({
            where: { tenantId, estActif: true },
            take: exports.PLAFOND_PLANS_LUS + 1,
            select: { id: true, code: true, classesVentilees: true, estActif: true, ventilationObligatoire: true },
        });
        if (plans.length > exports.PLAFOND_PLANS_LUS)
            return null;
        if (plans.length === 0 || salarieIds.length === 0) {
            return { plans, sections: [], versions: [], obligatoires: plans.filter((p) => p.ventilationObligatoire).map((p) => p.code) };
        }
        const versions = await this.prisma.repartitionAnalytiquePaie.findMany({
            where: { tenantId, salarieId: { in: [...salarieIds] }, moisEffet: { lte: mois }, retireLe: null, planId: { in: plans.map((p) => p.id) } },
            take: exports.PLAFOND_VERSIONS_DU_MOIS + 1,
            select: { id: true, salarieId: true, planId: true, moisEffet: true, lignes: { select: { sectionId: true, pourcentage: true } } },
        });
        if (versions.length > exports.PLAFOND_VERSIONS_DU_MOIS)
            return null;
        const sectionIds = [...new Set(versions.flatMap((v) => v.lignes.map((l) => l.sectionId)))];
        const sections = sectionIds.length
            ? await this.prisma.sectionAnalytique.findMany({
                where: { tenantId, id: { in: sectionIds } },
                select: { id: true, planId: true, code: true, type: true, estActive: true },
            })
            : [];
        return {
            plans,
            sections: sections.map((s) => ({
                id: s.id,
                planId: s.planId,
                code: s.code,
                estTotal: s.type === client_1.TypeCompteDetailTotal.TOTAL,
                estActive: s.estActive,
            })),
            versions: versions.map(versionLue),
            obligatoires: plans.filter((p) => p.ventilationObligatoire).map((p) => p.code),
        };
    }
};
exports.RepartitionsAnalytiquesPaieService = RepartitionsAnalytiquesPaieService;
exports.RepartitionsAnalytiquesPaieService = RepartitionsAnalytiquesPaieService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RepartitionsAnalytiquesPaieService);
//# sourceMappingURL=repartitions-analytiques-paie.service.js.map