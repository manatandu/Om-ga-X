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
exports.EtatsAnalytiquesService = exports.PLAFOND_LIGNES_SANS_REPARTITION = void 0;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const rubriques_budgetaires_1 = require("./rubriques-budgetaires");
const od_analytique_1 = require("./od-analytique");
const od_analytique_service_1 = require("./od-analytique.service");
const mois_entre_1 = require("../../common/mois-entre");
const mois_de_l_exercice_1 = require("./mois-de-l-exercice");
exports.PLAFOND_LIGNES_SANS_REPARTITION = 500;
const TRI_SANS_REPARTITION = [
    { ecriture: { date: 'asc' } },
    { ecriture: { numeroPiece: 'asc' } },
    { id: 'asc' },
];
let EtatsAnalytiquesService = class EtatsAnalytiquesService {
    constructor(prisma) {
        this.prisma = prisma;
        this.od = new od_analytique_service_1.OdAnalytiqueService(prisma);
    }
    async cumulsPlan(tenantId, planId, exerciceId, du, au) {
        const ventilations = await this.prisma.ventilationAnalytique.groupBy({
            by: ['sectionId'],
            where: { planId, ligne: { ecriture: { tenantId, exerciceId, date: { gte: du, lte: au }, ...ecritures_de_situation_1.HORS_SITUATION } } },
            _sum: { debit: true, credit: true },
        });
        const v = new Map(ventilations.map((x) => [x.sectionId, { debit: Number(x._sum.debit ?? 0), credit: Number(x._sum.credit ?? 0) }]));
        return (0, od_analytique_1.fusionnerCumuls)(v, await this.od.cumulsParSection(tenantId, planId, exerciceId, du, au));
    }
    async plan(tenantId, planId) {
        const plan = await this.prisma.planAnalytique.findFirst({ where: { id: planId, tenantId } });
        if (!plan)
            throw new common_1.NotFoundException('Plan analytique introuvable pour ce dossier');
        return plan;
    }
    async bornes(tenantId, exerciceId, dateDebut, dateFin) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        return {
            exercice,
            du: dateDebut ? new Date(dateDebut) : exercice.dateDebut,
            au: dateFin ? new Date(dateFin) : exercice.dateFin,
        };
    }
    async balance(tenantId, params) {
        await this.plan(tenantId, params.planId);
        const { du, au } = await this.bornes(tenantId, params.exerciceId, params.dateDebut, params.dateFin);
        const sections = await this.prisma.sectionAnalytique.findMany({
            where: { planId: params.planId, tenantId },
            orderBy: { code: 'asc' },
        });
        const cumuls = await this.cumulsPlan(tenantId, params.planId, params.exerciceId, du, au);
        const debitDe = (id) => Number(cumuls.get(id)?.debit ?? 0);
        const creditDe = (id) => Number(cumuls.get(id)?.credit ?? 0);
        const lignes = sections.map((s) => {
            const debit = (0, rubriques_budgetaires_1.valeurDeLaLigne)(s, sections, debitDe);
            const credit = (0, rubriques_budgetaires_1.valeurDeLaLigne)(s, sections, creditDe);
            return { sectionId: s.id, code: s.code, intitule: s.intitule, type: s.type, debit, credit, solde: debit - credit };
        });
        const debit = (0, rubriques_budgetaires_1.totalDesFeuilles)(sections, debitDe);
        const credit = (0, rubriques_budgetaires_1.totalDesFeuilles)(sections, creditDe);
        return { lignes, totaux: { debit, credit, solde: debit - credit } };
    }
    async grandLivre(tenantId, params) {
        const section = await this.prisma.sectionAnalytique.findFirst({
            where: { id: params.sectionId, tenantId },
            include: { plan: { select: { code: true, intitule: true } } },
        });
        if (!section)
            throw new common_1.NotFoundException('Section analytique introuvable pour ce dossier');
        const { du, au } = await this.bornes(tenantId, params.exerciceId, params.dateDebut, params.dateFin);
        const ventilations = await this.prisma.ventilationAnalytique.findMany({
            where: {
                sectionId: params.sectionId,
                ligne: { ecriture: { tenantId, exerciceId: params.exerciceId, date: { gte: du, lte: au }, ...ecritures_de_situation_1.HORS_SITUATION } },
            },
            include: {
                ligne: {
                    include: {
                        compte: { select: { numero: true, intitule: true } },
                        ecriture: { select: { id: true, date: true, libelle: true, numeroPiece: true, journal: { select: { code: true } } } },
                    },
                },
            },
        });
        const lignesOd = await this.prisma.ligneOdAnalytique.findMany({
            where: {
                tenantId,
                sectionId: params.sectionId,
                od: { tenantId, exerciceId: params.exerciceId, date: { gte: du, lte: au } },
            },
            include: { od: { include: { compte: { select: { numero: true, intitule: true } } } } },
        });
        const brutes = [
            ...ventilations.map((v) => ({
                ligneEcritureId: v.ligne.id,
                date: v.ligne.ecriture.date,
                journal: v.ligne.ecriture.journal.code,
                numeroPiece: v.ligne.ecriture.numeroPiece,
                compteNumero: v.ligne.compte.numero,
                compteIntitule: v.ligne.compte.intitule,
                libelle: v.ligne.libelle ?? v.ligne.ecriture.libelle,
                debit: Number(v.debit),
                credit: Number(v.credit),
            })),
            ...lignesOd.map((l) => ({
                ligneEcritureId: null,
                date: l.od.date,
                journal: 'OD ANA',
                numeroPiece: null,
                compteNumero: l.od.compte.numero,
                compteIntitule: l.od.compte.intitule,
                libelle: l.od.libelle,
                debit: Number(l.debit),
                credit: Number(l.credit),
            })),
        ];
        brutes.sort((a, b) => {
            const d = a.date.getTime() - b.date.getTime();
            return d !== 0 ? d : (a.numeroPiece ?? 0) - (b.numeroPiece ?? 0);
        });
        let cumul = 0;
        const lignes = brutes.map((b) => {
            cumul += b.debit - b.credit;
            return { ...b, date: b.date.toISOString().slice(0, 10), soldeProgressif: cumul };
        });
        return {
            section: {
                id: section.id,
                code: section.code,
                intitule: section.intitule,
                plan: section.plan,
                dateDebut: section.dateDebut?.toISOString().slice(0, 10) ?? null,
                dateFin: section.dateFin?.toISOString().slice(0, 10) ?? null,
            },
            lignes,
            totaux: {
                debit: lignes.reduce((t, l) => t + l.debit, 0),
                credit: lignes.reduce((t, l) => t + l.credit, 0),
                solde: cumul,
            },
        };
    }
    async controleCumuls(tenantId, params) {
        const { du, au } = await this.bornes(tenantId, params.exerciceId, params.dateDebut, params.dateFin);
        const plans = await this.prisma.planAnalytique.findMany({
            where: { tenantId, estActif: true, ...(params.planId ? { id: params.planId } : {}) },
            orderBy: [{ ordre: 'asc' }, { code: 'asc' }],
        });
        const resultats = [];
        for (const plan of plans) {
            const classes = plan.classesVentilees
                .split(',')
                .map((c) => `CLASSE_${c}`)
                .filter((c) => Object.values(client_1.ClasseCompte).includes(c));
            const perimetre = {
                ecriture: {
                    tenantId,
                    exerciceId: params.exerciceId,
                    date: { gte: du, lte: au },
                    estSoldeDesComptesDeGestion: false,
                    ...ecritures_de_situation_1.HORS_SITUATION,
                },
                compte: { classe: { in: classes } },
            };
            const sansRepartition = {
                ...perimetre,
                ventilations: { none: { planId: plan.id } },
                OR: [{ debit: { not: 0 } }, { credit: { not: 0 } }],
            };
            const [general, analytique, tranche, nombreSansRepartition] = await Promise.all([
                this.prisma.ligneEcriture.aggregate({ where: perimetre, _sum: { debit: true, credit: true } }),
                this.prisma.ventilationAnalytique.aggregate({
                    where: { planId: plan.id, ligne: perimetre },
                    _sum: { debit: true, credit: true },
                }),
                this.prisma.ligneEcriture.findMany({
                    where: sansRepartition,
                    include: {
                        compte: { select: { numero: true, intitule: true } },
                        ecriture: { select: { id: true, date: true, libelle: true, journal: { select: { code: true } } } },
                    },
                    orderBy: TRI_SANS_REPARTITION,
                    take: exports.PLAFOND_LIGNES_SANS_REPARTITION,
                }),
                this.prisma.ligneEcriture.count({ where: sansRepartition }),
            ]);
            const generalDebit = Number(general._sum.debit ?? 0);
            const generalCredit = Number(general._sum.credit ?? 0);
            const analytiqueDebit = Number(analytique._sum.debit ?? 0);
            const analytiqueCredit = Number(analytique._sum.credit ?? 0);
            resultats.push({
                planId: plan.id,
                planCode: plan.code,
                planIntitule: plan.intitule,
                mouvementsGenerauxDebit: generalDebit,
                mouvementsGenerauxCredit: generalCredit,
                mouvementsAnalytiquesDebit: analytiqueDebit,
                mouvementsAnalytiquesCredit: analytiqueCredit,
                ecartDebit: generalDebit - analytiqueDebit,
                ecartCredit: generalCredit - analytiqueCredit,
                nombreSansRepartition,
                tronque: nombreSansRepartition > tranche.length,
                lignesSansRepartition: tranche.map((l) => ({
                    ligneId: l.id,
                    ecritureId: l.ecriture.id,
                    date: l.ecriture.date.toISOString().slice(0, 10),
                    journal: l.ecriture.journal.code,
                    compteNumero: l.compte.numero,
                    compteIntitule: l.compte.intitule,
                    libelle: l.libelle ?? l.ecriture.libelle,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                })),
            });
        }
        return resultats;
    }
    async etatBudgetaire(tenantId, params) {
        const plan = await this.plan(tenantId, params.planId);
        if (!plan.gererBudgets) {
            throw new common_1.BadRequestException(`Le plan ${plan.code} ne gère pas les budgets.`);
        }
        const { exercice, du, au } = await this.bornes(tenantId, params.exerciceId, params.dateDebut, params.dateFin);
        let debut = du;
        let fin = au;
        if (params.mois) {
            if ((0, mois_entre_1.moisEntre)(exercice.dateDebut, exercice.dateFin) > 12) {
                throw new common_1.BadRequestException("Sur un exercice de plus de douze mois, un même mois revient deux fois : choisissez une période par " +
                    'ses dates. La dotation y est annuelle.');
            }
            ({ debut, fin } = (0, mois_de_l_exercice_1.bornesDuMois)(exercice.dateDebut, params.mois));
        }
        const sections = await this.prisma.sectionAnalytique.findMany({
            where: { planId: params.planId, tenantId },
            orderBy: { code: 'asc' },
        });
        const budgets = await this.prisma.budgetSection.findMany({
            where: {
                exerciceId: params.exerciceId,
                sectionId: { in: sections.map((s) => s.id) },
                mois: params.mois ?? null,
            },
        });
        const budgetDe = (id) => Number(budgets.find((b) => b.sectionId === id)?.montant ?? 0);
        const cumuls = await this.cumulsPlan(tenantId, params.planId, params.exerciceId, debut, fin);
        const realiseDe = (id) => {
            const somme = cumuls.get(id);
            return Math.abs(Number(somme?.debit ?? 0) - Number(somme?.credit ?? 0));
        };
        const lignes = sections.map((s) => {
            const estRubrique = s.type === client_1.TypeCompteDetailTotal.TOTAL;
            const budget = (0, rubriques_budgetaires_1.valeurDeLaLigne)(s, sections, budgetDe);
            const realise = (0, rubriques_budgetaires_1.valeurDeLaLigne)(s, sections, realiseDe);
            return {
                sectionId: s.id,
                code: s.code,
                intitule: s.intitule,
                estRubrique,
                budget,
                realise,
                ecart: budget - realise,
                tauxConsommation: budget !== 0 ? (realise / budget) * 100 : null,
                horsBudget: !estRubrique && budget === 0 && realise !== 0,
            };
        });
        const budgetTotal = (0, rubriques_budgetaires_1.totalDesFeuilles)(sections, budgetDe);
        const realiseTotal = (0, rubriques_budgetaires_1.totalDesFeuilles)(sections, realiseDe);
        return {
            lignes,
            totaux: {
                sectionId: null,
                code: '',
                intitule: 'Total',
                estRubrique: false,
                budget: budgetTotal,
                realise: realiseTotal,
                ecart: budgetTotal - realiseTotal,
                tauxConsommation: budgetTotal !== 0 ? (realiseTotal / budgetTotal) * 100 : null,
                horsBudget: false,
            },
        };
    }
};
exports.EtatsAnalytiquesService = EtatsAnalytiquesService;
exports.EtatsAnalytiquesService = EtatsAnalytiquesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EtatsAnalytiquesService);
//# sourceMappingURL=etats-analytiques.service.js.map