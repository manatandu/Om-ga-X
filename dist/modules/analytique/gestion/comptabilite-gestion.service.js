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
exports.ComptabiliteGestionService = void 0;
const ecritures_de_situation_1 = require("../../comptabilite/ecritures-de-situation");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../common/prisma.service");
const transaction_journalisee_1 = require("../../../common/audit/transaction-journalisee");
const lecture_par_lots_1 = require("../../../common/lecture-par-lots");
const balance_trois_colonnes_1 = require("../../comptabilite/balance-trois-colonnes");
const comparabilite_exercices_1 = require("../../etats-financiers/comparabilite-exercices");
const od_analytique_1 = require("../od-analytique");
const od_analytique_service_1 = require("../od-analytique.service");
const comportement_gestion_1 = require("./comportement-gestion");
const cles_repartition_1 = require("./cles-repartition");
const cout_production_1 = require("./cout-production");
const seuil_rentabilite_1 = require("./seuil-rentabilite");
const classeChiffre = (c) => c.replace('CLASSE_', '');
const jour = (d) => d.toISOString().slice(0, 10);
function dateDuJour(texte) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texte))
        throw new common_1.BadRequestException('La date est une date AAAA-MM-JJ.');
    const d = new Date(`${texte}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()))
        throw new common_1.BadRequestException('La date est une date AAAA-MM-JJ.');
    return d;
}
let ComptabiliteGestionService = class ComptabiliteGestionService {
    constructor(prisma, od) {
        this.prisma = prisma;
        this.od = od;
    }
    async exercice(tenantId, exerciceId) {
        const ex = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!ex)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        return ex;
    }
    refuserSiClos(ex) {
        if (ex.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice est clôturé · son analytique ne se corrige plus.");
        }
    }
    async mouvementsDeGestion(tenantId, exerciceId) {
        const filtres = (0, balance_trois_colonnes_1.filtresDesTroisColonnes)({ tenantId, exerciceId });
        const groupes = await this.prisma.ligneEcriture.groupBy({
            by: ['compteId'],
            where: {
                ecriture: filtres.mouvements,
                compte: { tenantId, classe: { in: [client_1.ClasseCompte.CLASSE_6, client_1.ClasseCompte.CLASSE_7] } },
            },
            _sum: { debit: true, credit: true },
        });
        return new Map(groupes.map((g) => [g.compteId, { debit: Number(g._sum.debit ?? 0), credit: Number(g._sum.credit ?? 0) }]));
    }
    async comportements(tenantId, exerciceId) {
        await this.exercice(tenantId, exerciceId);
        const mouvements = await this.mouvementsDeGestion(tenantId, exerciceId);
        const PLAFOND = 2000;
        const where = {
            tenantId,
            typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
            classe: { in: [client_1.ClasseCompte.CLASSE_6, client_1.ClasseCompte.CLASSE_7] },
            OR: [{ id: { in: [...mouvements.keys()] } }, { comportementGestion: { not: null } }],
        };
        const [comptes, total] = await Promise.all([
            this.prisma.compte.findMany({
                where: { ...where, tenantId },
                orderBy: { numero: 'asc' },
                take: PLAFOND,
                select: { id: true, numero: true, intitule: true, classe: true, comportementGestion: true, partVariableGestionPct: true },
            }),
            this.prisma.compte.count({ where: { ...where, tenantId } }),
        ]);
        return {
            comptes: comptes.map((c) => {
                const m = mouvements.get(c.id) ?? { debit: 0, credit: 0 };
                return {
                    compteId: c.id,
                    numero: c.numero,
                    intitule: c.intitule,
                    classe: classeChiffre(c.classe),
                    comportement: c.comportementGestion,
                    partVariablePct: c.partVariableGestionPct === null ? null : Number(c.partVariableGestionPct),
                    mouvementDebit: m.debit,
                    mouvementCredit: m.credit,
                };
            }),
            total,
            tronque: total > comptes.length,
        };
    }
    async declarerComportements(tenantId, dto) {
        const ids = dto.declarations.map((d) => d.compteId);
        if (new Set(ids).size !== ids.length)
            throw new common_1.BadRequestException('Un compte figure deux fois dans la déclaration.');
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, id: { in: ids } },
            select: { id: true, numero: true, classe: true, typeCompte: true },
        });
        const parId = new Map(comptes.map((c) => [c.id, c]));
        for (const d of dto.declarations) {
            const c = parId.get(d.compteId);
            if (!c)
                throw new common_1.NotFoundException('Compte introuvable pour ce dossier.');
            if (c.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL) {
                throw new common_1.BadRequestException(`Le compte ${c.numero} est un compte Total · le comportement se déclare sur ses comptes de détail.`);
            }
            const motif = (0, comportement_gestion_1.motifRefusComportement)({
                numero: c.numero,
                classe: classeChiffre(c.classe),
                comportement: (d.comportement ?? null),
                partVariablePct: d.partVariablePct ?? null,
            });
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await this.figerLesExercicesClos(tx, tenantId);
            for (const d of dto.declarations) {
                await tx.compte.update({
                    where: { id: d.compteId },
                    data: {
                        comportementGestion: (d.comportement ?? null),
                        partVariableGestionPct: d.partVariablePct ?? null,
                    },
                });
            }
        });
        return { declares: dto.declarations.length };
    }
    async figerLesExercicesClos(tx, tenantId) {
        const clos = await tx.exercice.findMany({
            where: { tenantId, statut: client_1.StatutExercice.CLOTURE, comportementsGestionFiges: null },
            select: { id: true },
        });
        if (clos.length === 0)
            return;
        const declares = await tx.compte.findMany({
            where: { tenantId, comportementGestion: { not: null } },
            select: { id: true, comportementGestion: true, partVariableGestionPct: true },
        });
        const instantane = Object.fromEntries(declares.map((c) => [
            c.id,
            { comportement: c.comportementGestion, partVariablePct: c.partVariableGestionPct === null ? null : Number(c.partVariableGestionPct) },
        ]));
        for (const e of clos) {
            await tx.comportementsGestionFiges.create({
                data: { tenantId, exerciceId: e.id, comportements: instantane },
            });
        }
    }
    async comportementsDe(tenantId, exerciceId, ids) {
        const fige = await this.prisma.comportementsGestionFiges.findFirst({ where: { tenantId, exerciceId } });
        if (fige) {
            const instantane = fige.comportements;
            return {
                figeLe: fige.figeLe.toISOString(),
                lire: (id) => instantane[id] ?? { comportement: null, partVariablePct: null },
            };
        }
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, id: { in: ids } },
            select: { id: true, comportementGestion: true, partVariableGestionPct: true },
        });
        const parId = new Map(comptes.map((c) => [c.id, c]));
        return {
            figeLe: null,
            lire: (id) => {
                const c = parId.get(id);
                return {
                    comportement: (c?.comportementGestion ?? null),
                    partVariablePct: c?.partVariableGestionPct == null ? null : Number(c.partVariableGestionPct),
                };
            },
        };
    }
    async seuilRentabilite(tenantId, exerciceId) {
        const ex = await this.exercice(tenantId, exerciceId);
        const mouvements = await this.mouvementsDeGestion(tenantId, exerciceId);
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, id: { in: [...mouvements.keys()] } },
            select: { id: true, numero: true, intitule: true, classe: true },
            orderBy: { numero: 'asc' },
        });
        const comportements = await this.comportementsDe(tenantId, ex.id, comptes.map((c) => c.id));
        const mois = (0, comparabilite_exercices_1.moisCouverts)(ex);
        const resultat = (0, seuil_rentabilite_1.seuilDeRentabilite)(comptes.map((c) => ({
            numero: c.numero,
            intitule: c.intitule,
            classe: classeChiffre(c.classe),
            mouvementDebit: mouvements.get(c.id)?.debit ?? 0,
            mouvementCredit: mouvements.get(c.id)?.credit ?? 0,
            ...comportements.lire(c.id),
        })), mois);
        return {
            exercice: { id: ex.id, dateDebut: jour(ex.dateDebut), dateFin: jour(ex.dateFin), mois },
            brouillardCompris: true,
            comportementsFigesLe: comportements.figeLe,
            ...resultat,
        };
    }
    async cumulsDeSection(tenantId, sectionId, exerciceId, du, au, client = this.prisma) {
        const parCompte = new Map();
        const ajouter = (compteId, d, c) => {
            const a = parCompte.get(compteId) ?? { debit: 0, credit: 0 };
            a.debit = Math.round((a.debit + d) * 100) / 100;
            a.credit = Math.round((a.credit + c) * 100) / 100;
            parCompte.set(compteId, a);
        };
        await (0, lecture_par_lots_1.lireParLots)((curseur) => client.ventilationAnalytique.findMany({
            where: {
                sectionId,
                ligne: { ecriture: { tenantId, exerciceId, date: { gte: du, lte: au }, estSoldeDesComptesDeGestion: false, ...ecritures_de_situation_1.HORS_SITUATION } },
            },
            select: { id: true, debit: true, credit: true, ligne: { select: { compteId: true } } },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
        }), (v) => ajouter(v.ligne.compteId, Number(v.debit), Number(v.credit)));
        await (0, lecture_par_lots_1.lireParLots)((curseur) => client.ligneOdAnalytique.findMany({
            where: { tenantId, sectionId, od: { tenantId, exerciceId, date: { gte: du, lte: au } } },
            select: { id: true, debit: true, credit: true, od: { select: { compteId: true } } },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
        }), (l) => ajouter(l.od.compteId, Number(l.debit), Number(l.credit)));
        if (parCompte.size === 0)
            return [];
        const comptes = await client.compte.findMany({
            where: { tenantId, id: { in: [...parCompte.keys()] } },
            select: { id: true, numero: true, intitule: true, classe: true },
        });
        return comptes.map((c) => ({
            compteId: c.id,
            numero: c.numero,
            intitule: c.intitule,
            classe: classeChiffre(c.classe),
            ...parCompte.get(c.id),
        }));
    }
    async cles(tenantId, exerciceId) {
        await this.exercice(tenantId, exerciceId);
        const cles = await this.prisma.cleRepartition.findMany({
            where: { tenantId, exerciceId },
            orderBy: { createdAt: 'asc' },
            include: {
                plan: { select: { code: true, intitule: true } },
                sectionSource: { select: { code: true, intitule: true } },
                lignes: { include: { sectionCible: { select: { code: true, intitule: true } } } },
                _count: { select: { ods: true } },
            },
        });
        return cles.map((k) => ({
            id: k.id,
            planId: k.planId,
            plan: k.plan,
            sectionSourceId: k.sectionSourceId,
            sectionSource: k.sectionSource,
            libelle: k.libelle,
            mode: k.mode,
            unite: k.unite,
            source: k.source,
            odsProduites: k._count.ods,
            lignes: k.lignes
                .map((l) => ({ sectionCibleId: l.sectionCibleId, code: l.sectionCible.code, intitule: l.sectionCible.intitule, valeur: Number(l.valeur) }))
                .sort((a, b) => a.code.localeCompare(b.code)),
        }));
    }
    async sectionsDuPlan(tenantId, planId, client = this.prisma) {
        const sections = await client.sectionAnalytique.findMany({
            where: { tenantId, planId },
            select: { id: true, planId: true, code: true, type: true, estActive: true },
        });
        return sections.map((s) => ({ ...s, estTotal: s.type === client_1.TypeCompteDetailTotal.TOTAL }));
    }
    async creerCle(tenantId, userId, dto) {
        const ex = await this.exercice(tenantId, dto.exerciceId);
        this.refuserSiClos(ex);
        const plan = await this.prisma.planAnalytique.findFirst({ where: { id: dto.planId, tenantId } });
        if (!plan)
            throw new common_1.NotFoundException('Plan analytique introuvable pour ce dossier.');
        const sections = await this.sectionsDuPlan(tenantId, plan.id);
        const motif = (0, cles_repartition_1.motifRefusCle)({
            planId: plan.id,
            sectionSourceId: dto.sectionSourceId,
            mode: dto.mode,
            lignes: dto.lignes,
            sections,
            source: dto.source,
        });
        if (motif)
            throw new common_1.BadRequestException(motif);
        if (dto.mode === 'UNITES' && !dto.unite?.trim()) {
            throw new common_1.BadRequestException("Une clé en unités nomme son unité (m², heures, effectif).");
        }
        try {
            return await this.prisma.cleRepartition.create({
                data: {
                    tenantId,
                    exerciceId: ex.id,
                    planId: plan.id,
                    sectionSourceId: dto.sectionSourceId,
                    libelle: dto.libelle.trim(),
                    mode: dto.mode,
                    unite: dto.mode === 'UNITES' ? dto.unite.trim() : null,
                    source: dto.source.trim(),
                    createdBy: userId,
                    lignes: { create: dto.lignes.map((l) => ({ tenantId, sectionCibleId: l.sectionCibleId, valeur: l.valeur })) },
                },
                select: { id: true },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException('Cette section a déjà une clé sur cet exercice · retirez-la avant d’en déclarer une autre.');
            }
            throw e;
        }
    }
    async supprimerCle(tenantId, id) {
        const cle = await this.prisma.cleRepartition.findFirst({
            where: { id, tenantId },
            include: { exercice: true, _count: { select: { ods: true } } },
        });
        if (!cle)
            throw new common_1.NotFoundException('Clé de répartition introuvable pour ce dossier.');
        this.refuserSiClos(cle.exercice);
        if (cle._count.ods > 0) {
            throw new common_1.ConflictException(`La clé a produit ${cle._count.ods} OD analytique(s) · retirez-les d'abord (Saisie des OD analytiques), elles portent sa justification.`);
        }
        await this.prisma.cleRepartition.delete({ where: { id: cle.id } });
        return { supprime: true };
    }
    async reprendreCles(tenantId, userId, exerciceId) {
        const ex = await this.exercice(tenantId, exerciceId);
        this.refuserSiClos(ex);
        const precedent = await this.prisma.exercice.findFirst({
            where: { tenantId, dateFin: { lt: ex.dateDebut } },
            orderBy: { dateFin: 'desc' },
        });
        if (!precedent)
            throw new common_1.BadRequestException("Aucun exercice ne précède celui-ci · rien à reprendre.");
        const [anciennes, deja] = await Promise.all([
            this.prisma.cleRepartition.findMany({ where: { tenantId, exerciceId: precedent.id }, include: { lignes: true, sectionSource: { select: { code: true } } } }),
            this.prisma.cleRepartition.findMany({ where: { tenantId, exerciceId: ex.id }, select: { sectionSourceId: true } }),
        ]);
        const occupees = new Set(deja.map((d) => d.sectionSourceId));
        const ecartees = [];
        let reprises = 0;
        for (const k of anciennes) {
            if (occupees.has(k.sectionSourceId)) {
                ecartees.push({ section: k.sectionSource.code, motif: 'une clé existe déjà sur cet exercice' });
                continue;
            }
            const sections = await this.sectionsDuPlan(tenantId, k.planId);
            const lignes = k.lignes.map((l) => ({ sectionCibleId: l.sectionCibleId, valeur: Number(l.valeur) }));
            const motif = (0, cles_repartition_1.motifRefusCle)({ planId: k.planId, sectionSourceId: k.sectionSourceId, mode: k.mode, lignes, sections, source: k.source });
            if (motif) {
                ecartees.push({ section: k.sectionSource.code, motif });
                continue;
            }
            await this.prisma.cleRepartition.create({
                data: {
                    tenantId,
                    exerciceId: ex.id,
                    planId: k.planId,
                    sectionSourceId: k.sectionSourceId,
                    libelle: k.libelle,
                    mode: k.mode,
                    unite: k.unite,
                    source: `${k.source} (reprise de l'exercice clos le ${jour(precedent.dateFin)})`,
                    createdBy: userId,
                    lignes: { create: lignes.map((l) => ({ tenantId, sectionCibleId: l.sectionCibleId, valeur: l.valeur })) },
                },
            });
            reprises++;
        }
        return { reprises, ecartees };
    }
    async proposition(tenantId, cleId, dateTexte) {
        const { interne: _interne, ...servie } = await this.calculerProposition(this.prisma, tenantId, cleId, dateTexte);
        return servie;
    }
    async calculerProposition(client, tenantId, cleId, dateTexte) {
        const cle = await client.cleRepartition.findFirst({
            where: { id: cleId, tenantId },
            include: { exercice: true, lignes: true, plan: true, sectionSource: { select: { code: true, intitule: true } } },
        });
        if (!cle)
            throw new common_1.NotFoundException('Clé de répartition introuvable pour ce dossier.');
        const ex = cle.exercice;
        const date = dateTexte ? dateDuJour(dateTexte) : ex.dateFin;
        if (date < ex.dateDebut || date > ex.dateFin)
            throw new common_1.BadRequestException("La date de la répartition tombe hors de l'exercice.");
        const au = new Date(date.getTime() + 24 * 3600 * 1000 - 1);
        const cumuls = await this.cumulsDeSection(tenantId, cle.sectionSourceId, ex.id, ex.dateDebut, au, client);
        const lignes = cle.lignes.map((l) => ({ sectionCibleId: l.sectionCibleId, valeur: Number(l.valeur) }));
        const ods = (0, cles_repartition_1.propositionRepartition)(cumuls, cle.sectionSourceId, lignes);
        const codes = new Map((await client.sectionAnalytique.findMany({
            where: { tenantId, id: { in: [cle.sectionSourceId, ...lignes.map((l) => l.sectionCibleId)] } },
            select: { id: true, code: true },
        })).map((s) => [s.id, s.code]));
        return {
            cle: { id: cle.id, libelle: cle.libelle, sectionSource: cle.sectionSource },
            date: jour(date),
            exerciceClos: ex.statut === client_1.StatutExercice.CLOTURE,
            ods: ods.map((o) => ({ ...o, lignes: o.lignes.map((l) => ({ ...l, code: codes.get(l.sectionId) ?? null })) })),
            total: ods.reduce((t, o) => t + Math.abs(o.solde), 0),
            interne: { exerciceId: cle.exerciceId, planId: cle.planId, libelle: cle.libelle, classesVentilees: cle.plan.classesVentilees },
        };
    }
    async repartir(tenantId, userId, cleId, dto) {
        const date = dateDuJour(dto.date);
        await this.od.refuserSiPeriodeClose(tenantId, date);
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`repartition-analytique:${tenantId}`}))`;
            const prop = await this.calculerProposition(tx, tenantId, cleId, dto.date);
            if (prop.exerciceClos)
                throw new common_1.BadRequestException("L'exercice est clôturé · son analytique ne se corrige plus.");
            if (prop.ods.length === 0) {
                throw new common_1.ConflictException("La section ne porte plus aucun solde à cette date · la répartition est déjà passée, ou rien n'est à répartir.");
            }
            const vus = dto.soldes ?? {};
            const centimes = (n) => Math.round(n * 100);
            const divergent = Object.keys(vus).length !== prop.ods.length ||
                prop.ods.some((o) => vus[o.compteId] === undefined || centimes(vus[o.compteId]) !== centimes(o.solde));
            if (divergent) {
                throw new common_1.ConflictException('Les soldes de la section ont changé depuis la proposition (répartition déjà passée ou ventilation nouvelle) · relisez-la avant de passer la répartition.');
            }
            const { exerciceId, planId, libelle, classesVentilees } = prop.interne;
            const sections = await this.sectionsDuPlan(tenantId, planId, tx);
            const comptes = await tx.compte.findMany({
                where: { tenantId, id: { in: prop.ods.map((o) => o.compteId) } },
                select: { id: true, classe: true },
            });
            const classeDe = new Map(comptes.map((c) => [c.id, classeChiffre(c.classe)]));
            for (const o of prop.ods) {
                const motif = (0, od_analytique_1.motifRefusOd)({
                    planId,
                    lignes: o.lignes,
                    sections: sections.map((s) => ({ id: s.id, planId: s.planId, code: s.code, estTotal: s.estTotal })),
                    classeCompte: classeDe.get(o.compteId) ?? '',
                    classesVentilees,
                });
                if (motif)
                    throw new common_1.BadRequestException(`Compte ${o.numero} · ${motif}`);
            }
            for (const o of prop.ods) {
                await tx.odAnalytique.create({
                    data: {
                        tenantId,
                        exerciceId,
                        planId,
                        compteId: o.compteId,
                        cleRepartitionId: cleId,
                        date,
                        reference: 'REPARTITION',
                        libelle: `Répartition · ${libelle}`.slice(0, 200),
                        createdBy: userId,
                        lignes: { create: o.lignes.map((l) => ({ tenantId, sectionId: l.sectionId, debit: l.debit, credit: l.credit })) },
                    },
                });
            }
            return { ods: prop.ods.length, total: prop.total };
        }, { maxWait: 10_000, timeout: 60_000 });
    }
    async coutsProduction(tenantId, exerciceId) {
        const ex = await this.exercice(tenantId, exerciceId);
        const declarations = await this.prisma.coutProductionDeclare.findMany({
            where: { tenantId, exerciceId },
            include: { section: { select: { code: true, intitule: true } } },
            orderBy: { createdAt: 'asc' },
        });
        const resultat = [];
        let figeLe = null;
        for (const d of declarations) {
            const cumuls = await this.cumulsDeSection(tenantId, d.sectionId, ex.id, ex.dateDebut, ex.dateFin);
            const ids = cumuls.filter((c) => c.classe === '6').map((c) => c.compteId);
            const comportements = await this.comportementsDe(tenantId, ex.id, ids);
            figeLe = comportements.figeLe;
            const charges = cumuls
                .filter((c) => c.classe === '6')
                .map((c) => ({
                compteId: c.compteId,
                numero: c.numero,
                intitule: c.intitule,
                montant: Math.round((c.debit - c.credit) * 100) / 100,
                ...comportements.lire(c.compteId),
            }))
                .sort((a, b) => a.numero.localeCompare(b.numero));
            const donnees = {
                capaciteNormale: Number(d.capaciteNormale),
                activiteReelle: Number(d.activiteReelle),
                quantiteProduite: d.quantiteProduite === null ? null : Number(d.quantiteProduite),
            };
            resultat.push({
                id: d.id,
                sectionId: d.sectionId,
                section: d.section,
                unite: d.unite,
                source: d.source,
                ...donnees,
                charges,
                produitsVentiles: cumuls.filter((c) => c.classe !== '6').length,
                calcul: (0, cout_production_1.coutDeProduction)(charges, donnees),
            });
        }
        return {
            exercice: { id: ex.id, dateDebut: jour(ex.dateDebut), dateFin: jour(ex.dateFin) },
            comportementsFigesLe: figeLe,
            declarations: resultat,
        };
    }
    async declarerCoutProduction(tenantId, userId, dto) {
        const ex = await this.exercice(tenantId, dto.exerciceId);
        this.refuserSiClos(ex);
        const section = await this.prisma.sectionAnalytique.findFirst({ where: { id: dto.sectionId, tenantId } });
        if (!section)
            throw new common_1.NotFoundException('Section analytique introuvable pour ce dossier.');
        if (section.type === client_1.TypeCompteDetailTotal.TOTAL) {
            throw new common_1.BadRequestException(`${section.code} est une rubrique (section Total) · le coût se calcule sur une section de détail.`);
        }
        const donnees = {
            capaciteNormale: dto.capaciteNormale,
            activiteReelle: dto.activiteReelle,
            quantiteProduite: dto.quantiteProduite ?? null,
            source: dto.source,
            unite: dto.unite,
        };
        const motif = (0, cout_production_1.motifRefusDonnees)(donnees);
        if (motif)
            throw new common_1.BadRequestException(motif);
        const data = {
            unite: dto.unite.trim(),
            capaciteNormale: dto.capaciteNormale,
            activiteReelle: dto.activiteReelle,
            quantiteProduite: dto.quantiteProduite ?? null,
            source: dto.source.trim(),
        };
        const existante = await this.prisma.coutProductionDeclare.findFirst({ where: { tenantId, exerciceId: ex.id, sectionId: section.id } });
        if (existante) {
            await this.prisma.coutProductionDeclare.update({ where: { id: existante.id }, data });
            return { id: existante.id };
        }
        return this.prisma.coutProductionDeclare.create({
            data: { tenantId, exerciceId: ex.id, sectionId: section.id, createdBy: userId, ...data },
            select: { id: true },
        });
    }
    async supprimerCoutProduction(tenantId, id) {
        const d = await this.prisma.coutProductionDeclare.findFirst({ where: { id, tenantId }, include: { exercice: true } });
        if (!d)
            throw new common_1.NotFoundException('Déclaration introuvable pour ce dossier.');
        this.refuserSiClos(d.exercice);
        await this.prisma.coutProductionDeclare.delete({ where: { id: d.id } });
        return { supprime: true };
    }
};
exports.ComptabiliteGestionService = ComptabiliteGestionService;
exports.ComptabiliteGestionService = ComptabiliteGestionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        od_analytique_service_1.OdAnalytiqueService])
], ComptabiliteGestionService);
//# sourceMappingURL=comptabilite-gestion.service.js.map