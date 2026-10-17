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
exports.AnalytiqueService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const bailleur_referentiel_1 = require("../../common/bailleur-referentiel");
const gel_cloture_1 = require("../exercice/gel-cloture");
const client_1 = require("@prisma/client");
const mois_entre_1 = require("../../common/mois-entre");
const od_analytique_1 = require("./od-analytique");
const exercice_budgetaire_clos_1 = require("./exercice-budgetaire-clos");
const references_1 = require("../../common/suppression/references");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const longueur_sections_1 = require("./longueur-sections");
function conflitDeSuppressionAnalytique(err, objet) {
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new common_1.ConflictException(`${objet.charAt(0).toUpperCase()}${objet.slice(1)} a reçu un usage (document joint, ventilation, engagement) pendant ` +
            "sa suppression · rien n'est supprimé. Rechargez pour voir ce qui retient la suppression.");
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new common_1.ConflictException(`Un autre geste a déjà supprimé ${objet} · rechargez.`);
    }
    throw err;
}
function chiffreClasse(classe) {
    return classe.replace('CLASSE_', '');
}
let AnalytiqueService = class AnalytiqueService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async seedPlansDefaut(tenantId, referentiel, client = this.prisma) {
        const existants = await client.planAnalytique.count({ where: { tenantId } });
        if (existants > 0)
            return;
        await client.planAnalytique.createMany({
            data: [
                {
                    tenantId,
                    code: 'PROJ',
                    intitule: 'Projets et programmes',
                    classesVentilees: referentiel === client_1.Referentiel.SYCEBNL ? '2,6,7,9' : '2,6,7',
                    gererBudgets: true,
                    ordre: 1,
                },
                ...(referentiel === client_1.Referentiel.SYCEBNL
                    ? [
                        {
                            tenantId,
                            code: 'BAIL',
                            intitule: 'Bailleurs et financements',
                            classesVentilees: '2,6,7,9',
                            gererBudgets: false,
                            ordre: 2,
                        },
                    ]
                    : []),
            ],
        });
    }
    async listerPlans(tenantId) {
        return this.prisma.planAnalytique.findMany({
            where: { tenantId },
            orderBy: [{ ordre: 'asc' }, { code: 'asc' }],
            include: { _count: { select: { sections: true } } },
        });
    }
    async creerPlan(tenantId, dto) {
        const existant = await this.prisma.planAnalytique.findFirst({ where: { tenantId, code: dto.code } });
        if (existant) {
            throw new common_1.ConflictException(`Un plan analytique porte déjà le code ${dto.code}`);
        }
        const bornes = dto.longueurSections == null ? null : (0, longueur_sections_1.motifRefusBornesLongueur)(dto.longueurSections);
        if (bornes)
            throw new common_1.BadRequestException(bornes);
        return this.prisma.planAnalytique.create({
            data: {
                tenantId,
                code: dto.code,
                intitule: dto.intitule,
                classesVentilees: dto.classesVentilees,
                ventilationObligatoire: dto.ventilationObligatoire,
                gererBudgets: dto.gererBudgets,
                ordre: dto.ordre,
                longueurSections: dto.longueurSections ?? null,
            },
        });
    }
    async modifierPlan(tenantId, planId, dto) {
        const plan = await this.trouverPlan(tenantId, planId);
        const { longueurSections, ...autres } = dto;
        if (longueurSections === undefined) {
            return this.prisma.planAnalytique.update({ where: { id: planId }, data: autres });
        }
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await this.verrouillerPlan(tx, tenantId, planId);
            if (longueurSections !== null) {
                const releve = await this.releverLongueurs(tx, tenantId, planId, longueurSections);
                const motif = (0, longueur_sections_1.motifRefusLongueurSections)(plan.code, longueurSections, releve);
                if (motif)
                    throw new common_1.BadRequestException(motif);
            }
            return tx.planAnalytique.update({ where: { id: planId }, data: { ...autres, longueurSections } });
        });
    }
    async apercuLongueurSections(tenantId, planId, longueur) {
        const plan = await this.trouverPlan(tenantId, planId);
        const bornes = longueur === null ? null : (0, longueur_sections_1.motifRefusBornesLongueur)(longueur);
        const releve = await this.releverLongueurs(this.prisma, tenantId, planId, bornes ? null : longueur);
        return {
            longueurActuelle: plan.longueurSections,
            longueur,
            motif: bornes ?? (0, longueur_sections_1.motifRefusLongueurSections)(plan.code, longueur, releve),
            horsLongueur: releve.horsLongueur,
            nombreHorsLongueur: releve.nombreHorsLongueur,
            nombreSections: releve.nombreSections,
            proposee: releve.proposee,
        };
    }
    async releverLongueurs(db, tenantId, planId, longueur) {
        const releve = new longueur_sections_1.ReleveLongueurs(longueur);
        await (0, lecture_par_lots_1.lireParLots)((curseur) => db.sectionAnalytique.findMany({
            where: { tenantId, planId, ...(0, lecture_par_lots_1.idApres)(curseur) },
            select: { id: true, code: true, type: true },
            orderBy: { id: 'asc' },
            take: 5000,
        }), (section) => releve.ajouter(section), 5000);
        return releve;
    }
    async verrouillerPlan(db, tenantId, planId) {
        await db.$queryRaw `SELECT "id" FROM "plans_analytiques" WHERE "id" = ${planId} AND "tenantId" = ${tenantId} FOR UPDATE`;
    }
    async supprimerPlan(tenantId, planId) {
        const plan = await this.trouverPlan(tenantId, planId);
        const sections = await this.prisma.sectionAnalytique.findMany({ where: { planId, tenantId }, select: { id: true, code: true } });
        const ids = sections.map((x) => x.id);
        const refs = [
            ...(await (0, references_1.referencesVers)(this.prisma, 'PlanAnalytique', planId, tenantId, ['SectionAnalytique.planId'])),
            ...(ids.length ? await (0, references_1.referencesVers)(this.prisma, 'SectionAnalytique', ids, tenantId, ['BudgetSection.sectionId']) : []),
        ];
        const budgetsClos = ids.length
            ? await this.prisma.budgetSection.count({ where: { sectionId: { in: ids }, exercice: { statut: client_1.StatutExercice.CLOTURE } } })
            : 0;
        const documents = ids.length ? await this.sectionsQuiPortentUnDocument(tenantId, sections) : null;
        this.refuserSuppressionAnalytique(`Le plan ${plan.code} ne peut plus être supprimé`, refs, budgetsClos, documents
            ? `${documents} Retirez-les depuis le volet Documents de chaque section, ou mettez le plan en sommeil.`
            : 'Mettez-le en sommeil.');
        try {
            await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                await tx.sectionAnalytique.deleteMany({ where: { planId, tenantId } });
                await tx.planAnalytique.delete({ where: { id: planId } });
            });
        }
        catch (err) {
            conflitDeSuppressionAnalytique(err, `le plan ${plan.code}`);
        }
        return { supprime: true };
    }
    async sectionsQuiPortentUnDocument(tenantId, sections) {
        const groupes = await this.prisma.pieceJointeSection.groupBy({
            by: ['sectionId'],
            where: { tenantId, sectionId: { in: sections.map((x) => x.id) } },
            orderBy: { sectionId: 'asc' },
        });
        if (groupes.length === 0)
            return null;
        const codes = new Map(sections.map((x) => [x.id, x.code]));
        const nommees = groupes
            .map((g) => codes.get(g.sectionId) ?? g.sectionId)
            .sort((a, b) => a.localeCompare(b, 'fr'));
        const NOMMEES_AU_PLUS = 20;
        const liste = nommees.slice(0, NOMMEES_AU_PLUS).join(', ');
        const reste = nommees.length > NOMMEES_AU_PLUS ? ` et ${nommees.length - NOMMEES_AU_PLUS} autre(s)` : '';
        return `Sections qui portent un document (${nommees.length}) · ${liste}${reste}.`;
    }
    refuserSuppressionAnalytique(objet, refs, budgetsClos, issue) {
        const usages = refs.map(references_1.libelleReference);
        if (budgetsClos > 0)
            usages.push(`budgets d'un exercice clôturé (${budgetsClos})`);
        if (usages.length === 0)
            return;
        throw new common_1.BadRequestException(`${objet} · usages : ${usages.join(', ')}. ${issue}`);
    }
    async trouverPlan(tenantId, planId) {
        const plan = await this.prisma.planAnalytique.findFirst({ where: { id: planId, tenantId } });
        if (!plan)
            throw new common_1.NotFoundException('Plan analytique introuvable pour ce dossier');
        return plan;
    }
    async listerSections(tenantId, planId) {
        await this.trouverPlan(tenantId, planId);
        return this.prisma.sectionAnalytique.findMany({
            where: { planId, tenantId },
            orderBy: { code: 'asc' },
            include: { bailleur: { select: { id: true, code: true, nom: true } } },
        });
    }
    async creerSection(tenantId, planId, dto) {
        const plan = await this.trouverPlan(tenantId, planId);
        const refusLongueur = (0, longueur_sections_1.motifRefusCodeSection)({ code: dto.code, type: dto.type ?? client_1.TypeCompteDetailTotal.DETAIL }, plan.longueurSections);
        if (refusLongueur)
            throw new common_1.BadRequestException(refusLongueur);
        const existante = await this.prisma.sectionAnalytique.findFirst({ where: { planId, code: dto.code } });
        if (existante) {
            throw new common_1.ConflictException(`Une section porte déjà le code ${dto.code} dans ce plan`);
        }
        await (0, bailleur_referentiel_1.refuserBailleurHorsSycebnl)(this.prisma, tenantId, dto.bailleurId);
        if (dto.bailleurId) {
            const bailleur = await this.prisma.bailleur.findFirst({ where: { id: dto.bailleurId, tenantId } });
            if (!bailleur)
                throw new common_1.BadRequestException('Bailleur introuvable pour ce dossier');
        }
        const dateDebut = dto.dateDebut ? new Date(dto.dateDebut) : null;
        const dateFin = dto.dateFin ? new Date(dto.dateFin) : null;
        if (dateDebut && dateFin && dateFin < dateDebut) {
            throw new common_1.BadRequestException('La date de fin de la convention précède sa date de début');
        }
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await this.verrouillerPlan(tx, tenantId, planId);
            const relu = await tx.planAnalytique.findFirst({ where: { id: planId, tenantId }, select: { longueurSections: true } });
            if (!relu)
                throw new common_1.NotFoundException('Plan analytique introuvable pour ce dossier');
            const motif = (0, longueur_sections_1.motifRefusCodeSection)({ code: dto.code, type: dto.type ?? client_1.TypeCompteDetailTotal.DETAIL }, relu.longueurSections);
            if (motif)
                throw new common_1.BadRequestException(motif);
            return tx.sectionAnalytique.create({
                data: {
                    planId,
                    tenantId,
                    code: dto.code,
                    intitule: dto.intitule,
                    type: dto.type,
                    bailleurId: dto.bailleurId,
                    dateDebut,
                    dateFin,
                },
                include: { bailleur: { select: { id: true, code: true, nom: true } } },
            });
        });
    }
    async modifierSection(tenantId, sectionId, dto) {
        await this.trouverSection(tenantId, sectionId);
        await (0, bailleur_referentiel_1.refuserBailleurHorsSycebnl)(this.prisma, tenantId, dto.bailleurId);
        if (dto.bailleurId) {
            const bailleur = await this.prisma.bailleur.findFirst({ where: { id: dto.bailleurId, tenantId } });
            if (!bailleur)
                throw new common_1.BadRequestException('Bailleur introuvable pour ce dossier');
        }
        return this.prisma.sectionAnalytique.update({
            where: { id: sectionId },
            data: {
                intitule: dto.intitule,
                bailleurId: dto.bailleurId,
                dateDebut: dto.dateDebut === null ? null : dto.dateDebut ? new Date(dto.dateDebut) : undefined,
                dateFin: dto.dateFin === null ? null : dto.dateFin ? new Date(dto.dateFin) : undefined,
                estActive: dto.estActive,
            },
            include: { bailleur: { select: { id: true, code: true, nom: true } } },
        });
    }
    async supprimerSection(tenantId, sectionId) {
        const section = await this.trouverSection(tenantId, sectionId);
        const refs = await (0, references_1.referencesVers)(this.prisma, 'SectionAnalytique', sectionId, tenantId, ['BudgetSection.sectionId']);
        const budgetsClos = await this.prisma.budgetSection.count({
            where: { sectionId, exercice: { statut: client_1.StatutExercice.CLOTURE } },
        });
        this.refuserSuppressionAnalytique(`La section ${section.code} ne peut plus être supprimée`, refs, budgetsClos, 'Mettez-la en sommeil.');
        try {
            await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                await tx.budgetSection.deleteMany({ where: { sectionId } });
                await tx.sectionAnalytique.delete({ where: { id: sectionId } });
            });
        }
        catch (err) {
            conflitDeSuppressionAnalytique(err, `la section ${section.code}`);
        }
        return { supprime: true };
    }
    async trouverSection(tenantId, sectionId) {
        const section = await this.prisma.sectionAnalytique.findFirst({
            where: { id: sectionId, tenantId },
            include: { plan: true },
        });
        if (!section)
            throw new common_1.NotFoundException('Section analytique introuvable pour ce dossier');
        return section;
    }
    async sectionEtExerciceDotables(tenantId, sectionId, exerciceId) {
        const section = await this.trouverSection(tenantId, sectionId);
        if (section.type === client_1.TypeCompteDetailTotal.TOTAL) {
            throw new common_1.BadRequestException("Une section Total ne se dote pas : elle totalise ses sections Détail. Dotez les sections Détail qu'elle regroupe.");
        }
        if (!section.plan.gererBudgets) {
            throw new common_1.BadRequestException(`Le plan ${section.plan.code} ne gère pas les budgets. Activez « Gérer les budgets » sur le plan.`);
        }
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        (0, exercice_budgetaire_clos_1.refuserSiExerciceBudgetaireClos)(exercice.statut);
        const mois = this.moisCouverts(exercice.dateDebut, exercice.dateFin, section.dateDebut, section.dateFin);
        if (mois.length === 0) {
            throw new common_1.BadRequestException("La convention de cette section ne recouvre aucun mois de l'exercice : il n'y a rien à doter.");
        }
        const exerciceLong = (0, mois_entre_1.moisEntre)(exercice.dateDebut, exercice.dateFin) > 12;
        return { section, exercice, mois, exerciceLong };
    }
    async doterBudget(tenantId, sectionId, dto) {
        const { mois, exerciceLong } = await this.sectionEtExerciceDotables(tenantId, sectionId, dto.exerciceId);
        const centimes = Math.round(dto.montantAnnuel * 100);
        const part = Math.trunc(centimes / mois.length);
        const reliquat = centimes - part * mois.length;
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.budgetSection.deleteMany({ where: { sectionId, exerciceId: dto.exerciceId } });
            await tx.budgetSection.create({
                data: { sectionId, exerciceId: dto.exerciceId, mois: null, montant: new client_1.Prisma.Decimal(dto.montantAnnuel) },
            });
            if (exerciceLong)
                return;
            await tx.budgetSection.createMany({
                data: mois.map((m, i) => ({
                    sectionId,
                    exerciceId: dto.exerciceId,
                    mois: m,
                    montant: new client_1.Prisma.Decimal((part + (i === mois.length - 1 ? reliquat : 0)) / 100),
                })),
            });
        });
        return this.budget(tenantId, sectionId, dto.exerciceId);
    }
    async modifierBudgetMois(tenantId, sectionId, dto) {
        const { mois, exerciceLong } = await this.sectionEtExerciceDotables(tenantId, sectionId, dto.exerciceId);
        if (exerciceLong) {
            throw new common_1.BadRequestException("Sur un exercice de plus de douze mois, un même mois revient deux fois : la dotation reste annuelle et " +
                'ne se retouche pas au mois (AUDCIF art. 7).');
        }
        if (!mois.includes(dto.mois)) {
            throw new common_1.BadRequestException(`La convention de cette section ne couvre pas le mois ${dto.mois} de l'exercice · il n'a rien à recevoir.`);
        }
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.budgetSection.upsert({
                where: { sectionId_exerciceId_mois: { sectionId, exerciceId: dto.exerciceId, mois: dto.mois } },
                create: {
                    sectionId,
                    exerciceId: dto.exerciceId,
                    mois: dto.mois,
                    montant: new client_1.Prisma.Decimal(dto.montant),
                },
                update: { montant: new client_1.Prisma.Decimal(dto.montant) },
            });
            const mensuels = await tx.budgetSection.findMany({
                where: { sectionId, exerciceId: dto.exerciceId, mois: { not: null } },
            });
            const total = mensuels.reduce((s, b) => s + Number(b.montant), 0);
            const annuelle = await tx.budgetSection.findFirst({
                where: { sectionId, exerciceId: dto.exerciceId, mois: null },
                select: { id: true },
            });
            if (annuelle) {
                await tx.budgetSection.update({ where: { id: annuelle.id }, data: { montant: new client_1.Prisma.Decimal(total) } });
            }
            else {
                await tx.budgetSection.create({
                    data: { sectionId, exerciceId: dto.exerciceId, mois: null, montant: new client_1.Prisma.Decimal(total) },
                });
            }
        });
        return this.budget(tenantId, sectionId, dto.exerciceId);
    }
    async budget(tenantId, sectionId, exerciceId) {
        await this.trouverSection(tenantId, sectionId);
        const lignes = await this.prisma.budgetSection.findMany({
            where: { sectionId, exerciceId },
            orderBy: { mois: 'asc' },
        });
        return {
            annuel: Number(lignes.find((l) => l.mois === null)?.montant ?? 0),
            mensuel: lignes
                .filter((l) => l.mois !== null)
                .map((l) => ({ mois: l.mois, montant: Number(l.montant) })),
        };
    }
    moisCouverts(debutExercice, finExercice, debutSection, finSection) {
        const debut = debutSection && debutSection > debutExercice ? debutSection : debutExercice;
        const fin = finSection && finSection < finExercice ? finSection : finExercice;
        if (fin < debut)
            return [];
        const mois = [];
        const curseur = new Date(debut.getFullYear(), debut.getMonth(), 1);
        while (curseur <= fin) {
            mois.push(curseur.getMonth() + 1);
            curseur.setMonth(curseur.getMonth() + 1);
        }
        return mois;
    }
    async ventilerLigne(tenantId, ligneEcritureId, ventilations) {
        const ligne = await this.prisma.ligneEcriture.findFirst({
            where: { id: ligneEcritureId, ecriture: { tenantId } },
            include: { compte: { select: { numero: true, classe: true } } },
        });
        if (!ligne)
            throw new common_1.NotFoundException('Ligne d\'écriture introuvable pour ce dossier');
        await (0, gel_cloture_1.refuserSiLignesFigees)(this.prisma, tenantId, [ligneEcritureId], 'ventiler');
        const sectionIds = [...new Set(ventilations.map((v) => v.sectionId))];
        const sections = await this.prisma.sectionAnalytique.findMany({
            where: { id: { in: sectionIds }, tenantId },
            include: { plan: true },
        });
        if (sections.length !== sectionIds.length) {
            throw new common_1.BadRequestException('Une ou plusieurs sections sont introuvables pour ce dossier');
        }
        const totale = sections.find((s) => s.type === client_1.TypeCompteDetailTotal.TOTAL);
        if (totale) {
            throw new common_1.BadRequestException(`La section ${totale.code} est de type Total : elle totalise ses sections Détail dans les états et ne reçoit pas de ventilation directe.`);
        }
        const inactive = sections.find((s) => !s.estActive);
        if (inactive) {
            throw new common_1.BadRequestException(`La section ${inactive.code} est en sommeil`);
        }
        const classeCompte = ligne.compte.classe.replace('CLASSE_', '');
        for (const plan of new Map(sections.map((s) => [s.planId, s.plan])).values()) {
            const refusClasse = (0, od_analytique_1.motifRefusClasseVentilee)(classeCompte, plan.classesVentilees);
            if (refusClasse)
                throw new common_1.BadRequestException(`Plan ${plan.code} · ${refusClasse}`);
        }
        for (const [i, v] of ventilations.entries()) {
            const refusMontant = (0, od_analytique_1.motifRefusMontantAnalytique)(i + 1, v.debit ?? 0, v.credit ?? 0);
            if (refusMontant)
                throw new common_1.BadRequestException(refusMontant);
        }
        const parPlan = new Map();
        for (const v of ventilations) {
            const section = sections.find((s) => s.id === v.sectionId);
            const cumul = parPlan.get(section.planId) ?? { debit: 0, credit: 0, code: section.plan.code };
            cumul.debit += v.debit ?? 0;
            cumul.credit += v.credit ?? 0;
            parPlan.set(section.planId, cumul);
        }
        const debitLigne = Number(ligne.debit);
        const creditLigne = Number(ligne.credit);
        for (const [, cumul] of parPlan) {
            if (Math.abs(cumul.debit - debitLigne) > 0.005 || Math.abs(cumul.credit - creditLigne) > 0.005) {
                throw new common_1.BadRequestException(`Ventilation incomplète sur le plan ${cumul.code} : ${cumul.debit.toFixed(2)} au débit et ` +
                    `${cumul.credit.toFixed(2)} au crédit, pour une ligne de ${debitLigne.toFixed(2)} / ${creditLigne.toFixed(2)}. ` +
                    "Une ligne est ventilée en totalité sur un plan, ou pas du tout.");
            }
        }
        const plansTouches = [...parPlan.keys()];
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.ventilationAnalytique.deleteMany({
                where: {
                    ligneEcritureId,
                    ...(plansTouches.length > 0 ? { planId: { in: plansTouches } } : {}),
                },
            });
            if (ventilations.length > 0) {
                await tx.ventilationAnalytique.createMany({
                    data: ventilations.map((v) => ({
                        ligneEcritureId,
                        sectionId: v.sectionId,
                        planId: sections.find((s) => s.id === v.sectionId).planId,
                        debit: new client_1.Prisma.Decimal(v.debit ?? 0),
                        credit: new client_1.Prisma.Decimal(v.credit ?? 0),
                    })),
                });
            }
        });
        return this.ventilationsDeLigne(tenantId, ligneEcritureId);
    }
    async effacerVentilation(tenantId, ligneEcritureId) {
        const ligne = await this.prisma.ligneEcriture.findFirst({
            where: { id: ligneEcritureId, ecriture: { tenantId } },
            select: { id: true },
        });
        if (!ligne)
            throw new common_1.NotFoundException('Ligne d\'écriture introuvable pour ce dossier');
        await (0, gel_cloture_1.refuserSiLignesFigees)(this.prisma, tenantId, [ligneEcritureId], 'effacer la ventilation');
        await this.prisma.ventilationAnalytique.deleteMany({ where: { ligneEcritureId } });
        return { efface: true };
    }
    async ventilationsDeLigne(tenantId, ligneEcritureId) {
        return this.prisma.ventilationAnalytique.findMany({
            where: { ligneEcritureId, section: { tenantId } },
            include: { section: { select: { id: true, code: true, intitule: true, planId: true } } },
        });
    }
    async verifierVentilationObligatoire(tenantId, lignes) {
        const plans = await this.prisma.planAnalytique.findMany({
            where: { tenantId, estActif: true, ventilationObligatoire: true },
        });
        if (plans.length === 0)
            return;
        const comptes = await this.prisma.compte.findMany({
            where: { id: { in: [...new Set(lignes.map((l) => l.compteId))] }, tenantId },
            select: { id: true, numero: true, classe: true },
        });
        const sectionsUtilisees = await this.prisma.sectionAnalytique.findMany({
            where: { id: { in: lignes.flatMap((l) => (l.ventilations ?? []).map((v) => v.sectionId)) }, tenantId },
            select: { id: true, planId: true },
        });
        for (const ligne of lignes) {
            const compte = comptes.find((c) => c.id === ligne.compteId);
            if (!compte)
                continue;
            const chiffre = chiffreClasse(compte.classe);
            for (const plan of plans) {
                if (!plan.classesVentilees.split(',').includes(chiffre))
                    continue;
                const ventilee = (ligne.ventilations ?? []).some((v) => sectionsUtilisees.find((s) => s.id === v.sectionId)?.planId === plan.id);
                if (!ventilee) {
                    throw new common_1.BadRequestException(`Le compte ${compte.numero} (classe ${chiffre}) doit être ventilé sur le plan ${plan.code} · ` +
                        'la ventilation y est obligatoire.');
                }
            }
        }
    }
};
exports.AnalytiqueService = AnalytiqueService;
exports.AnalytiqueService = AnalytiqueService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalytiqueService);
//# sourceMappingURL=analytique.service.js.map