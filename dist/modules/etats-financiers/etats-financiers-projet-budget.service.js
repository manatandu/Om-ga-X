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
exports.EtatsFinanciersProjetBudgetService = exports.AucunPlanABudgetsException = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
const engagement_service_1 = require("../analytique/engagement.service");
const rubriques_budgetaires_1 = require("../analytique/rubriques-budgetaires");
const correspondance_projet_emplois_ressources_1 = require("./correspondance-projet-emplois-ressources");
const ouverte_a_la_cloture_1 = require("../lettrage/ouverte-a-la-cloture");
const exercice_introuvable_1 = require("../../common/exercice-introuvable");
const engagements_anterieurs_1 = require("./engagements-anterieurs");
const COMPTES_ENGAGEMENT = ['40', '481'];
class AucunPlanABudgetsException extends common_1.NotFoundException {
}
exports.AucunPlanABudgetsException = AucunPlanABudgetsException;
let EtatsFinanciersProjetBudgetService = class EtatsFinanciersProjetBudgetService {
    constructor(ecritureService, prisma, engagementService) {
        this.ecritureService = ecritureService;
        this.prisma = prisma;
        this.engagementService = engagementService;
    }
    async chargerLignes(tenantId, exerciceId) {
        return (0, etats_financiers_communs_1.chargerLignes)(this.ecritureService, tenantId, exerciceId);
    }
    async lignesOuvertesParmi(tenantId, exerciceId, dateFin, ids) {
        const ouvertes = new Set();
        for (let i = 0; i < ids.length; i += lecture_par_lots_1.LOT_LECTURE) {
            const lignes = await this.prisma.ligneEcriture.findMany({
                where: {
                    id: { in: ids.slice(i, i + lecture_par_lots_1.LOT_LECTURE) },
                    ecriture: { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE },
                    ...(0, ouverte_a_la_cloture_1.ouverteALaCloture)(dateFin),
                },
                select: { id: true },
            });
            for (const l of lignes)
                ouvertes.add(l.id);
        }
        return ouvertes;
    }
    async executionBudgetaire(tenantId, exerciceId, planId) {
        const exercice = (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateDebut: true, dateFin: true } }));
        const plan = planId
            ? await this.prisma.planAnalytique.findFirst({ where: { id: planId, tenantId } })
            : await this.prisma.planAnalytique.findFirst({
                where: { tenantId, estActif: true, gererBudgets: true },
                orderBy: { ordre: 'asc' },
            });
        if (!plan) {
            throw new AucunPlanABudgetsException("Aucun plan analytique à budgets n'est défini pour ce dossier. Le tableau d'exécution budgétaire suit la nomenclature budgétaire du projet : créez un plan analytique et ses sections avant de l'établir.");
        }
        const decaisseParSection = new Map();
        const engageParSection = new Map();
        const toucheTresorerie = (lignes) => lignes.some((l) => (0, etats_financiers_communs_1.correspond)(l.compte.numero, correspondance_projet_emplois_ressources_1.COMPTES_TRESORERIE_PROJET));
        const estFournisseurQuiEngage = (numero) => (0, etats_financiers_communs_1.correspond)(numero, COMPTES_ENGAGEMENT, ['409']);
        const engagementsIllisibles = { nombre: 0, montant: 0 };
        const parcours = (0, lecture_par_lots_1.lireParLots)(async (curseur) => {
            const lot = await this.prisma.ecriture.findMany({
                where: {
                    tenantId,
                    exerciceId,
                    statut: client_1.StatutEcriture.VALIDEE,
                    estGenereeParCloture: false,
                    lignes: { some: { ventilations: { some: { planId: plan.id } } } },
                },
                select: {
                    id: true,
                    lignes: {
                        select: {
                            id: true,
                            debit: true,
                            credit: true,
                            lettrageId: true,
                            compte: { select: { numero: true } },
                            ventilations: {
                                where: { planId: plan.id },
                                select: { planId: true, sectionId: true, debit: true, credit: true },
                            },
                        },
                    },
                },
                ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
            });
            const candidates = lot
                .filter((e) => !toucheTresorerie(e.lignes))
                .flatMap((e) => e.lignes.filter((l) => estFournisseurQuiEngage(l.compte.numero)).map((l) => l.id));
            const ouvertes = await this.lignesOuvertesParmi(tenantId, exerciceId, exercice.dateFin, candidates);
            const resultat = [];
            for (const e of lot) {
                const engagee = !toucheTresorerie(e.lignes) && e.lignes.some((l) => estFournisseurQuiEngage(l.compte.numero) && ouvertes.has(l.id));
                if (!engagee) {
                    resultat.push({ id: e.id, lignes: e.lignes, partEngagee: 0 });
                    continue;
                }
                let dette = 0;
                let reste = 0;
                let lisible = true;
                for (const l of e.lignes) {
                    if (!estFournisseurQuiEngage(l.compte.numero))
                        continue;
                    dette += Number(l.credit) - Number(l.debit);
                    if (!ouvertes.has(l.id))
                        continue;
                    const r = await (0, engagements_anterieurs_1.resteDuALaDate)(this.prisma, tenantId, l, exercice.dateFin);
                    if (r === null)
                        lisible = false;
                    else
                        reste += r / 100;
                }
                resultat.push({ id: e.id, lignes: e.lignes, partEngagee: lisible && dette > 0.005 ? Math.min(1, reste / dette) : null });
            }
            return resultat;
        }, (e) => {
            if (e.partEngagee === null) {
                let montant = 0;
                for (const l of e.lignes)
                    for (const v of l.ventilations)
                        if (v.planId === plan.id)
                            montant += Number(v.debit) - Number(v.credit);
                engagementsIllisibles.nombre += 1;
                engagementsIllisibles.montant += montant;
                return;
            }
            for (const l of e.lignes) {
                for (const v of l.ventilations) {
                    if (v.planId !== plan.id)
                        continue;
                    const montant = Number(v.debit) - Number(v.credit);
                    if (Math.abs(montant) < 0.005)
                        continue;
                    const engage = Math.round(montant * e.partEngagee * 100) / 100;
                    const decaisse = Math.round((montant - engage) * 100) / 100;
                    if (Math.abs(engage) >= 0.005)
                        engageParSection.set(v.sectionId, (engageParSection.get(v.sectionId) ?? 0) + engage);
                    if (Math.abs(decaisse) >= 0.005)
                        decaisseParSection.set(v.sectionId, (decaisseParSection.get(v.sectionId) ?? 0) + decaisse);
                }
            }
        }, lecture_par_lots_1.LOT_ECRITURES);
        const nonSuivis = { nombre: 0, montant: 0 };
        const parcoursAnterieur = (async () => {
            const precedent = await this.prisma.exercice.findFirst({
                where: { tenantId, dateFin: { lt: exercice.dateDebut } },
                orderBy: { dateFin: 'desc' },
                select: { id: true, dateFin: true },
            });
            if (!precedent)
                return;
            await (0, lecture_par_lots_1.lireParLots)(async (curseur) => {
                const lot = await this.prisma.ecriture.findMany({
                    where: {
                        tenantId,
                        exerciceId: precedent.id,
                        statut: client_1.StatutEcriture.VALIDEE,
                        estGenereeParCloture: false,
                        lignes: { some: { ventilations: { some: { planId: plan.id } } } },
                    },
                    select: {
                        id: true,
                        libelle: true,
                        lignes: {
                            select: {
                                id: true,
                                compteId: true,
                                debit: true,
                                credit: true,
                                dateEcheance: true,
                                libelle: true,
                                lettrageId: true,
                                compte: { select: { numero: true } },
                                ventilations: {
                                    where: { planId: plan.id },
                                    select: { planId: true, sectionId: true, debit: true, credit: true },
                                },
                            },
                        },
                    },
                    ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
                });
                const candidates = lot
                    .filter((e) => !toucheTresorerie(e.lignes))
                    .flatMap((e) => e.lignes.filter((l) => estFournisseurQuiEngage(l.compte.numero)).map((l) => ({ e, l })));
                const ouvertesN1 = await this.lignesOuvertesParmi(tenantId, precedent.id, precedent.dateFin, candidates.map((c) => c.l.id));
                const suite = await (0, engagements_anterieurs_1.suiteEnNDesDettes)(this.prisma, tenantId, precedent, { id: exerciceId, dateFin: exercice.dateFin }, candidates
                    .filter((c) => ouvertesN1.has(c.l.id))
                    .map((c) => ({
                    id: c.l.id,
                    compteId: c.l.compteId,
                    numero: c.l.compte.numero,
                    debit: c.l.debit,
                    credit: c.l.credit,
                    dateEcheance: c.l.dateEcheance,
                    lettrageId: c.l.lettrageId,
                    libelle: c.l.libelle ?? c.e.libelle,
                })));
                return lot.map((e) => {
                    let dette = 0;
                    let decaisse = 0;
                    let engage = 0;
                    let suivie = false;
                    let inconnue = false;
                    for (const l of e.lignes) {
                        if (!estFournisseurQuiEngage(l.compte.numero))
                            continue;
                        dette += Number(l.credit) - Number(l.debit);
                        const s = suite.get(l.id);
                        if (s === undefined)
                            continue;
                        suivie = true;
                        if (s === 'INCONNUE')
                            inconnue = true;
                        else {
                            decaisse += s.decaisseEnN;
                            engage += s.engageEnN;
                        }
                    }
                    if (suivie && !inconnue && dette <= 0.005)
                        inconnue = true;
                    return {
                        id: e.id,
                        lignes: e.lignes,
                        suivie,
                        inconnue,
                        partDecaissee: suivie && !inconnue ? decaisse / dette : 0,
                        partEngagee: suivie && !inconnue ? engage / dette : 0,
                    };
                });
            }, (e) => {
                if (!e.suivie)
                    return;
                let montant = 0;
                for (const l of e.lignes)
                    for (const v of l.ventilations)
                        if (v.planId === plan.id)
                            montant += Number(v.debit) - Number(v.credit);
                if (e.inconnue) {
                    nonSuivis.nombre += 1;
                    nonSuivis.montant += montant;
                    return;
                }
                for (const l of e.lignes) {
                    for (const v of l.ventilations) {
                        if (v.planId !== plan.id)
                            continue;
                        const m = Number(v.debit) - Number(v.credit);
                        if (Math.abs(m) < 0.005)
                            continue;
                        for (const [cible, part] of [
                            [decaisseParSection, e.partDecaissee],
                            [engageParSection, e.partEngagee],
                        ]) {
                            const porte = Math.round(m * part * 100) / 100;
                            if (Math.abs(porte) < 0.005)
                                continue;
                            cible.set(v.sectionId, (cible.get(v.sectionId) ?? 0) + porte);
                        }
                    }
                }
            }, lecture_par_lots_1.LOT_ECRITURES);
        })();
        const [sections, budgets, resteEngageParSection, nombreOd] = await Promise.all([
            this.prisma.sectionAnalytique.findMany({
                where: { planId: plan.id, tenantId },
                orderBy: { code: 'asc' },
            }),
            this.prisma.budgetSection.findMany({ where: { exerciceId, mois: null, section: { planId: plan.id } } }),
            this.engagementService.resteParSection(tenantId, exerciceId),
            this.prisma.odAnalytique.count({ where: { tenantId, exerciceId, planId: plan.id } }),
            parcours,
            parcoursAnterieur,
        ]);
        const budgetParSection = new Map();
        for (const b of budgets) {
            budgetParSection.set(b.sectionId, (budgetParSection.get(b.sectionId) ?? 0) + Number(b.montant));
        }
        const budgetDe = (id) => budgetParSection.get(id) ?? 0;
        const decaisseDe = (id) => decaisseParSection.get(id) ?? 0;
        const engageComptableDe = (id) => engageParSection.get(id) ?? 0;
        const engageHorsComptaDe = (id) => resteEngageParSection.get(id) ?? 0;
        const composer = (code, libelle, estRubrique, budget, decaissement, engagementComptable, engagementHorsComptabilite) => {
            const engagement = engagementComptable + engagementHorsComptabilite;
            const realisation = decaissement + engagement;
            return {
                code,
                libelle,
                estRubrique,
                budget,
                decaissement,
                engagementComptable,
                engagementHorsComptabilite,
                engagement,
                realisation,
                creditDisponible: budget - realisation,
                executionPourcent: Math.abs(budget) < 0.005 ? null : (realisation / budget) * 100,
            };
        };
        const lignes = sections.map((s) => composer(s.code, s.intitule, s.type === client_1.TypeCompteDetailTotal.TOTAL, (0, rubriques_budgetaires_1.valeurDeLaLigne)(s, sections, budgetDe), (0, rubriques_budgetaires_1.valeurDeLaLigne)(s, sections, decaisseDe), (0, rubriques_budgetaires_1.valeurDeLaLigne)(s, sections, engageComptableDe), (0, rubriques_budgetaires_1.valeurDeLaLigne)(s, sections, engageHorsComptaDe)));
        const total = {
            budget: (0, rubriques_budgetaires_1.totalDesFeuilles)(sections, budgetDe),
            decaissement: (0, rubriques_budgetaires_1.totalDesFeuilles)(sections, decaisseDe),
            engagementComptable: (0, rubriques_budgetaires_1.totalDesFeuilles)(sections, engageComptableDe),
            engagementHorsComptabilite: (0, rubriques_budgetaires_1.totalDesFeuilles)(sections, engageHorsComptaDe),
            engagement: 0,
            realisation: 0,
            creditDisponible: 0,
        };
        total.engagement = total.engagementComptable + total.engagementHorsComptabilite;
        total.realisation = total.decaissement + total.engagement;
        total.creditDisponible = total.budget - total.realisation;
        return {
            plan: { id: plan.id, code: plan.code, intitule: plan.intitule },
            lignes,
            total: {
                ...total,
                executionPourcent: Math.abs(total.budget) < 0.005 ? null : (total.realisation / total.budget) * 100,
            },
            odAnalytiquesNonReprises: nombreOd > 0
                ? `${nombreOd} OD analytique(s) de ce plan ne sont pas reprises · ce tableau est établi sur la comptabilité, et une OD ne dit pas si le montant qu'elle déplace a été payé ou engagé. Pour qu'une correction y pèse, corrigez la ventilation de l'écriture d'origine.`
                : null,
            engagementsAnterieursNonSuivis: nonSuivis.nombre > 0
                ? `${nonSuivis.nombre} dépense(s) engagée(s) à la clôture de l'exercice précédent, pour ${nonSuivis.montant.toFixed(2)}, ne se suivent pas dans cet exercice · ni un lettrage qui les solde ni une ligne d'à-nouveau unique (report au détail, exercice précédent clôturé) ne se retrouvent. Elles ne sont comptées ni en décaissement ni en engagement.`
                : null,
            engagementsReglesSansImputation: engagementsIllisibles.nombre > 0
                ? `${engagementsIllisibles.nombre} dépense(s) passée(s) en compte fournisseur, pour ${engagementsIllisibles.montant.toFixed(2)}, sont réglées par un lettrage qui réunit plusieurs factures · la part encore due de chacune ne se lit pas (imputation des paiements, Code civil, Livre III, art. 151 à 154). Elles ne sont comptées ni en décaissement ni en engagement.`
                : null,
            engagementsHorsComptabilite: "La colonne Engagement réunit les trois termes du guide (ch. 7, APPLICATION 22, règle (d)) : le solde créditeur des comptes fournisseurs d'exploitation (40) et d'investissement (481), les bons de commande remis aux fournisseurs non exécutés, et les contrats signés non exécutés. Les deux derniers ne sont pas des écritures : ils viennent du registre des engagements, pour leur RESTE À EXÉCUTER. Un engagement qui n'y est pas saisi ne pèse pas sur ce tableau.",
        };
    }
    async reconciliationTresorerie(tenantId, exerciceId, paiementsEnInstance = null) {
        (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true } }));
        const estTresorerie = (numero) => (0, etats_financiers_communs_1.correspond)(numero, correspondance_projet_emplois_ressources_1.COMPTES_TRESORERIE_PROJET);
        let fondsBailleurs = 0;
        let interets = 0;
        let autresFonds = 0;
        let depenses = 0;
        const [lignes] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId),
            (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ecriture.findMany({
                where: {
                    tenantId,
                    exerciceId,
                    statut: client_1.StatutEcriture.VALIDEE,
                    estGenereeParCloture: false,
                    lignes: { some: { compte: { OR: correspondance_projet_emplois_ressources_1.COMPTES_TRESORERIE_PROJET.map((p) => ({ numero: { startsWith: p } })) } } },
                },
                select: {
                    id: true,
                    lignes: { select: { debit: true, credit: true, compte: { select: { numero: true } } } },
                },
                ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
            }), (e) => {
                const tresorerie = e.lignes.filter((l) => estTresorerie(l.compte.numero));
                if (tresorerie.length === 0)
                    return;
                const flux = tresorerie.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
                if (Math.abs(flux) < 0.005)
                    return;
                if (flux < 0) {
                    depenses += -flux;
                    return;
                }
                for (const l of e.lignes.filter((x) => !estTresorerie(x.compte.numero))) {
                    const contribution = Number(l.credit) - Number(l.debit);
                    if (Math.abs(contribution) < 0.005)
                        continue;
                    if ((0, etats_financiers_communs_1.correspond)(l.compte.numero, ['161', '162', '163', '164', '462', '463', '464'])) {
                        fondsBailleurs += contribution;
                    }
                    else if ((0, etats_financiers_communs_1.correspond)(l.compte.numero, ['77'])) {
                        interets += contribution;
                    }
                    else {
                        autresFonds += contribution;
                    }
                }
            }, lecture_par_lots_1.LOT_ECRITURES),
        ]);
        const lignesTresorerie = lignes.filter((l) => estTresorerie(l.numero));
        const tresorerieDebut = lignesTresorerie.reduce((s, l) => s + l.reportDebit - l.reportCredit, 0);
        const tresorerieFin = lignesTresorerie.reduce((s, l) => s + l.solde, 0);
        const g = tresorerieDebut + fondsBailleurs + interets + autresFonds - 0 - depenses;
        const repere = (rep, libelle, montant) => ({ rep, libelle, montant });
        return {
            lignes: [
                repere('A', 'TRESORERIE EN DEBUT EXERCICE N', tresorerieDebut),
                repere('B', "FONDS RECUS DES BAILLEURS AU COURS DE L'EXERCICE N", fondsBailleurs),
                repere('C', "INTERETS RECUS AU COURS DE L'EXERCICE N", interets),
                repere('D', "AUTRES FONDS REÇUS AU COURS DE L'EXERCICE N", autresFonds),
                repere('E', 'VIREMENTS SUR COMPTES OPÉRATIONNELS', 0),
                repere('F', "DEPENSES DE L'EXERCICE N", depenses),
                repere('G', "TRESORERIE EN FIN D'EXERCICE N (A+B+C+D-E-F)", g),
                repere('H', 'PAIEMENTS EN INSTANCE', paiementsEnInstance),
                repere('I', 'TRESORERIE NET DES PAIEMENTS EN INSTANCE (G-H)', paiementsEnInstance === null ? null : g - paiementsEnInstance),
            ],
            controle: {
                tresorerieBalance: tresorerieFin,
                ecart: g - tresorerieFin,
                boucle: Math.abs(g - tresorerieFin) < 0.01,
            },
            avertissements: [
                "Repère E : le tableau officiel est écrit du point de vue du compte spécial alimenté par le bailleur et retranche les virements vers les comptes opérationnels. Aucun modèle du logiciel ne désigne ce compte spécial ; l'état est donc établi sur la trésorerie consolidée du dossier, où les virements internes s'annulent. E vaut zéro par construction, ce n'est pas une omission.",
                "Repère H : les paiements en instance (chèques émis non encaissés, virements en cours) sont extra-comptables. Le montant est celui que vous avez saisi ; il n'est pas déduit de la comptabilité.",
            ],
        };
    }
};
exports.EtatsFinanciersProjetBudgetService = EtatsFinanciersProjetBudgetService;
exports.EtatsFinanciersProjetBudgetService = EtatsFinanciersProjetBudgetService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ecriture_service_1.EcritureService,
        prisma_service_1.PrismaService,
        engagement_service_1.EngagementService])
], EtatsFinanciersProjetBudgetService);
//# sourceMappingURL=etats-financiers-projet-budget.service.js.map