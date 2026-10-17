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
var EngagementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngagementService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const exercice_budgetaire_clos_1 = require("./exercice-budgetaire-clos");
const exercice_requis_1 = require("../../common/exercice-requis");
const EPSILON = 0.005;
const PLAFOND_RATTACHABLES = 200;
let EngagementService = EngagementService_1 = class EngagementService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    static resteAExecuter(engagement) {
        if (engagement.statut === client_1.StatutEngagement.CLOS)
            return 0;
        const execute = engagement.executions.reduce((s, e) => s + Number(e.montant), 0);
        return Math.max(0, Number(engagement.montant) - execute);
    }
    async resteParSection(tenantId, exerciceId) {
        const engagements = await this.prisma.engagementDepense.findMany({
            where: { tenantId, exerciceId },
            select: { sectionId: true, statut: true, montant: true, executions: { select: { montant: true } } },
        });
        const parSection = new Map();
        for (const e of engagements) {
            const reste = EngagementService_1.resteAExecuter(e);
            if (reste < EPSILON)
                continue;
            parSection.set(e.sectionId, (parSection.get(e.sectionId) ?? 0) + reste);
        }
        return parSection;
    }
    async lister(tenantId, exerciceId) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        const engagements = await this.prisma.engagementDepense.findMany({
            where: { tenantId, exerciceId },
            orderBy: [{ date: 'asc' }, { reference: 'asc' }],
            include: {
                section: { select: { id: true, code: true, intitule: true } },
                executions: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        ecriture: { select: { id: true, date: true, numeroPiece: true, libelle: true, statut: true } },
                    },
                },
            },
        });
        return engagements.map((e) => {
            const execute = e.executions.reduce((s, x) => s + Number(x.montant), 0);
            return {
                id: e.id,
                nature: e.nature,
                reference: e.reference,
                objet: e.objet,
                beneficiaire: e.beneficiaire,
                date: e.date,
                montant: Number(e.montant),
                statut: e.statut,
                motifCloture: e.motifCloture,
                section: e.section,
                montantExecute: execute,
                resteAExecuter: EngagementService_1.resteAExecuter(e),
                executions: e.executions.map((x) => ({
                    id: x.id,
                    montant: Number(x.montant),
                    ecriture: x.ecriture,
                })),
            };
        });
    }
    async creer(tenantId, userId, dto) {
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: dto.exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true, statut: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException("Exercice introuvable dans ce dossier.");
        (0, exercice_budgetaire_clos_1.refuserSiExerciceBudgetaireClos)(exercice.statut);
        const section = await this.prisma.sectionAnalytique.findFirst({
            where: { id: dto.sectionId, tenantId },
            select: { id: true, code: true, intitule: true, plan: { select: { gererBudgets: true, code: true } } },
        });
        if (!section)
            throw new common_1.NotFoundException('Section analytique introuvable dans ce dossier.');
        if (!section.plan.gererBudgets) {
            throw new common_1.BadRequestException(`La section ${section.code} appartient au plan « ${section.plan.code} », qui ne gère pas les budgets. ` +
                "Un engagement pèse sur une ligne du tableau d'exécution budgétaire : il ne peut viser qu'une section d'un plan budgétaire.");
        }
        const date = new Date(dto.date);
        if (date < exercice.dateDebut || date > exercice.dateFin) {
            throw new common_1.BadRequestException(`La date de l'engagement (${date.toISOString().slice(0, 10)}) est hors de l'exercice ` +
                `(${exercice.dateDebut.toISOString().slice(0, 10)} au ${exercice.dateFin.toISOString().slice(0, 10)}). ` +
                "Le guide ne retient que les engagements pris « au cours de l'exercice budgétaire ».");
        }
        if (dto.montant <= 0) {
            throw new common_1.BadRequestException("Le montant de l'engagement doit être strictement positif.");
        }
        const doublon = await this.prisma.engagementDepense.findFirst({
            where: { tenantId, exerciceId: dto.exerciceId, nature: dto.nature, reference: dto.reference.trim() },
            select: { id: true },
        });
        if (doublon) {
            throw new common_1.BadRequestException(`Un engagement de même nature porte déjà la référence « ${dto.reference.trim()} » sur cet exercice. ` +
                'Une double saisie doublerait le poids de cette commande sur le budget.');
        }
        return this.prisma.engagementDepense.create({
            data: {
                tenantId,
                exerciceId: dto.exerciceId,
                sectionId: dto.sectionId,
                nature: dto.nature,
                reference: dto.reference.trim(),
                objet: dto.objet.trim(),
                beneficiaire: dto.beneficiaire.trim(),
                date,
                montant: dto.montant,
                createdBy: userId,
            },
        });
    }
    async rattacherExecution(tenantId, userId, engagementId, dto) {
        const engagement = await this.prisma.engagementDepense.findFirst({
            where: { id: engagementId, tenantId },
            include: { executions: { select: { montant: true, ecritureId: true } }, exercice: { select: { statut: true } } },
        });
        if (!engagement)
            throw new common_1.NotFoundException('Engagement introuvable dans ce dossier.');
        (0, exercice_budgetaire_clos_1.refuserSiExerciceBudgetaireClos)(engagement.exercice.statut);
        if (engagement.statut === client_1.StatutEngagement.CLOS) {
            throw new common_1.BadRequestException("Cet engagement est clos : il ne pèse plus sur le budget et ne peut plus recevoir d'exécution. Rouvrez-le d'abord.");
        }
        const ecriture = await this.prisma.ecriture.findFirst({
            where: { id: dto.ecritureId, tenantId },
            select: { id: true, exerciceId: true, statut: true, numeroPiece: true },
        });
        if (!ecriture)
            throw new common_1.NotFoundException('Écriture introuvable dans ce dossier.');
        if (ecriture.statut !== client_1.StatutEcriture.VALIDEE) {
            throw new common_1.BadRequestException("Seule une écriture VALIDÉE exécute un engagement · le tableau d'exécution budgétaire ne lit que le livre-journal.");
        }
        if (ecriture.exerciceId !== engagement.exerciceId) {
            throw new common_1.BadRequestException("L'écriture appartient à un autre exercice que l'engagement. Le tableau d'exécution budgétaire est établi exercice par exercice.");
        }
        if (engagement.executions.some((x) => x.ecritureId === dto.ecritureId)) {
            throw new common_1.BadRequestException('Cette écriture est déjà rattachée à cet engagement. La rattacher deux fois retrancherait deux fois le même reste à exécuter.');
        }
        if (dto.montant <= 0) {
            throw new common_1.BadRequestException("Le montant d'exécution doit être strictement positif.");
        }
        const dejaExecute = engagement.executions.reduce((s, x) => s + Number(x.montant), 0);
        if (dejaExecute + dto.montant - Number(engagement.montant) > EPSILON) {
            throw new common_1.BadRequestException(`L'exécution cumulée (${(dejaExecute + dto.montant).toFixed(2)}) dépasserait le montant engagé ` +
                `(${Number(engagement.montant).toFixed(2)}). Si la dépense réelle excède la commande, rattachez le montant ` +
                "engagé et laissez l'excédent suivre son cours comptable : il est déjà porté par la colonne Décaissement.");
        }
        const [dejaSurLaPiece, piece] = await Promise.all([
            this.prisma.executionEngagement.aggregate({
                where: { ecritureId: dto.ecritureId, engagement: { tenantId } },
                _sum: { montant: true },
            }),
            this.prisma.ligneEcriture.aggregate({ where: { ecritureId: dto.ecritureId }, _sum: { debit: true } }),
        ]);
        const rattache = Number(dejaSurLaPiece._sum.montant ?? 0);
        const totalPiece = Number(piece._sum.debit ?? 0);
        if (rattache + dto.montant - totalPiece > EPSILON) {
            throw new common_1.BadRequestException(`La pièce ${ecriture.numeroPiece ?? ''} porte ${totalPiece.toFixed(2)} et en exécute déjà ${rattache.toFixed(2)} ` +
                `sur d'autres engagements · rattacher ${dto.montant.toFixed(2)} de plus la ferait servir au-delà d'elle-même.`);
        }
        return this.prisma.executionEngagement.create({
            data: { engagementId, ecritureId: dto.ecritureId, montant: dto.montant, createdBy: userId },
        });
    }
    async detacherExecution(tenantId, engagementId, executionId) {
        const execution = await this.prisma.executionEngagement.findFirst({
            where: { id: executionId, engagementId, engagement: { tenantId } },
            select: { id: true, engagement: { select: { exercice: { select: { statut: true } } } } },
        });
        if (!execution)
            throw new common_1.NotFoundException("Rattachement introuvable sur cet engagement.");
        (0, exercice_budgetaire_clos_1.refuserSiExerciceBudgetaireClos)(execution.engagement.exercice.statut);
        await this.prisma.executionEngagement.delete({ where: { id: executionId } });
        return { detache: true };
    }
    async clore(tenantId, engagementId, dto) {
        const engagement = await this.prisma.engagementDepense.findFirst({
            where: { id: engagementId, tenantId },
            select: { id: true, statut: true, exercice: { select: { statut: true } } },
        });
        if (!engagement)
            throw new common_1.NotFoundException('Engagement introuvable dans ce dossier.');
        (0, exercice_budgetaire_clos_1.refuserSiExerciceBudgetaireClos)(engagement.exercice.statut);
        if (engagement.statut === client_1.StatutEngagement.CLOS) {
            throw new common_1.BadRequestException('Cet engagement est déjà clos.');
        }
        if (!dto.motif?.trim()) {
            throw new common_1.BadRequestException("Le motif de clôture est obligatoire : clore un engagement libère du crédit disponible sur le projet, et le bailleur doit pouvoir savoir pourquoi.");
        }
        return this.prisma.engagementDepense.update({
            where: { id: engagementId },
            data: { statut: client_1.StatutEngagement.CLOS, motifCloture: dto.motif.trim() },
        });
    }
    async rouvrir(tenantId, engagementId) {
        const engagement = await this.prisma.engagementDepense.findFirst({
            where: { id: engagementId, tenantId },
            select: { id: true, statut: true, exercice: { select: { statut: true } } },
        });
        if (!engagement)
            throw new common_1.NotFoundException('Engagement introuvable dans ce dossier.');
        (0, exercice_budgetaire_clos_1.refuserSiExerciceBudgetaireClos)(engagement.exercice.statut);
        if (engagement.statut !== client_1.StatutEngagement.CLOS) {
            throw new common_1.BadRequestException("Cet engagement n'est pas clos.");
        }
        return this.prisma.engagementDepense.update({
            where: { id: engagementId },
            data: { statut: client_1.StatutEngagement.OUVERT, motifCloture: null },
        });
    }
    async supprimer(tenantId, engagementId) {
        const engagement = await this.prisma.engagementDepense.findFirst({
            where: { id: engagementId, tenantId },
            select: { id: true, _count: { select: { executions: true } }, exercice: { select: { statut: true } } },
        });
        if (!engagement)
            throw new common_1.NotFoundException('Engagement introuvable dans ce dossier.');
        (0, exercice_budgetaire_clos_1.refuserSiExerciceBudgetaireClos)(engagement.exercice.statut);
        if (engagement._count.executions > 0) {
            throw new common_1.BadRequestException("Cet engagement porte des écritures d'exécution : il ne s'efface pas. Clôturez-le avec son motif, ou détachez d'abord ses exécutions.");
        }
        await this.prisma.engagementDepense.delete({ where: { id: engagementId } });
        return { supprime: true };
    }
    async ecrituresRattachables(tenantId, exerciceId, recherche) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        const texte = recherche?.trim();
        const numero = texte && /^\d+$/.test(texte) ? Number(texte) : null;
        const filtre = {
            exerciceId,
            statut: client_1.StatutEcriture.VALIDEE,
            estGenereeParCloture: false,
            ...(texte
                ? {
                    OR: [
                        { libelle: { contains: texte, mode: 'insensitive' } },
                        { reference: { contains: texte, mode: 'insensitive' } },
                        ...(numero !== null && Number.isSafeInteger(numero) && numero <= 2_147_483_647 ? [{ numeroPiece: numero }] : []),
                    ],
                }
                : {}),
        };
        const [ecritures, total] = await Promise.all([
            this.prisma.ecriture.findMany({
                where: { tenantId, ...filtre },
                orderBy: [{ date: 'desc' }],
                take: PLAFOND_RATTACHABLES,
                select: { id: true, date: true, numeroPiece: true, libelle: true, reference: true },
            }),
            this.prisma.ecriture.count({ where: { tenantId, ...filtre } }),
        ]);
        return { ecritures, total, tronque: total > ecritures.length };
    }
};
exports.EngagementService = EngagementService;
exports.EngagementService = EngagementService = EngagementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EngagementService);
//# sourceMappingURL=engagement.service.js.map