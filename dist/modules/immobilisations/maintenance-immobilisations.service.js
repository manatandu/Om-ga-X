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
exports.MaintenanceImmobilisationsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const exercice_introuvable_1 = require("../../common/exercice-introuvable");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const immobilisation_service_1 = require("./immobilisation.service");
const compte_du_bien_1 = require("./compte-du-bien");
const creation_depuis_ecritures_service_1 = require("./creation-depuis-ecritures.service");
const maintenance_immobilisations_1 = require("./maintenance-immobilisations");
const PLAFOND_FICHES = 50_000;
const PLAFOND_APERCU = 200;
const PLAFOND_NOMMES = 50;
let MaintenanceImmobilisationsService = class MaintenanceImmobilisationsService {
    constructor(prisma, immobilisations, ecritures) {
        this.prisma = prisma;
        this.immobilisations = immobilisations;
        this.ecritures = ecritures;
    }
    async apercuRenumerotation(tenantId, p) {
        const refus = (0, maintenance_immobilisations_1.motifRefusParametres)(p);
        if (refus)
            throw new common_1.BadRequestException(refus);
        const [fiches, campagne] = await Promise.all([this.fichesANumeroter(this.prisma, tenantId), this.campagneOuverte(this.prisma, tenantId)]);
        const plan = (0, maintenance_immobilisations_1.planDeRenumerotation)(fiches, p);
        return {
            nombre: plan.nombre,
            aChanger: plan.attributions.length,
            attributions: plan.attributions.slice(0, PLAFOND_APERCU),
            tronque: plan.attributions.length > PLAFOND_APERCU,
            motifRefus: campagne ?? (0, maintenance_immobilisations_1.motifRefusPlan)(plan, p),
        };
    }
    async renumeroter(tenantId, p) {
        const refus = (0, maintenance_immobilisations_1.motifRefusParametres)(p);
        if (refus)
            throw new common_1.BadRequestException(refus);
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`renumerotation-immobilisations:${tenantId}`}))`;
            const campagne = await this.campagneOuverte(tx, tenantId);
            if (campagne)
                throw new common_1.BadRequestException(campagne);
            const plan = (0, maintenance_immobilisations_1.planDeRenumerotation)(await this.fichesANumeroter(tx, tenantId), p);
            const motif = (0, maintenance_immobilisations_1.motifRefusPlan)(plan, p);
            if (motif)
                throw new common_1.BadRequestException(motif);
            for (const a of plan.attributions) {
                await tx.immobilisation.update({ where: { id: a.id }, data: { numeroInventaire: a.nouveau } });
            }
            return { renumerotes: plan.attributions.length, inchanges: plan.nombre - plan.attributions.length };
        }, { timeout: 120_000 });
    }
    async campagneOuverte(db, tenantId) {
        const campagnes = await db.campagneInventaire.findMany({
            where: { tenantId, statut: { not: client_1.StatutCampagneInventaire.CLOTUREE } },
            select: { libelle: true, dateInventaire: true, statut: true },
            orderBy: { dateInventaire: 'asc' },
            take: 1,
        });
        return (0, maintenance_immobilisations_1.motifRefusCampagneOuverte)(campagnes);
    }
    async maintenance(tenantId, exerciceId) {
        const exercice = (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true, dateFin: true } }));
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        const [tableau, balance, fiches, sansFiche] = await Promise.all([
            this.immobilisations.tableauAmortissements(tenantId, exerciceId),
            this.ecritures.balance(tenantId, exerciceId),
            this.prisma.immobilisation.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    designation: true,
                    numeroInventaire: true,
                    statut: true,
                    compteAmortissement: { select: { numero: true, intitule: true } },
                    reclassements: {
                        where: { dateReclassement: { gt: exercice.dateFin } },
                        orderBy: { dateReclassement: 'asc' },
                        take: 1,
                        select: { dateReclassement: true, ancienCompteImmobilisation: { select: { numero: true } } },
                    },
                },
                take: PLAFOND_FICHES + 1,
            }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: (0, creation_depuis_ecritures_service_1.filtreLignesDeBienSansFiche)(tenantId, referentiel, { exerciceId }),
                _count: { _all: true },
                _sum: { debit: true },
            }),
        ]);
        if (fiches.length > PLAFOND_FICHES) {
            throw new common_1.BadRequestException(`Plus de ${PLAFOND_FICHES} fiches · la maintenance ne les relit pas d'un coup.`);
        }
        const parId = new Map(fiches.map((f) => [f.id, f]));
        const brut = new Map();
        const amortissement = new Map();
        let dotationsAPasser = 0;
        let biensAPasser = 0;
        const reclasses = [];
        for (const g of tableau.groupes) {
            for (const l of g.lignes) {
                if (l.sortiLe)
                    continue;
                const ajouter = (m, numero, intitule, montant) => {
                    const v = m.get(numero) ?? { intitule, montant: 0 };
                    v.montant += montant;
                    m.set(numero, v);
                };
                ajouter(brut, g.numero, g.intitule, l.valeurBrute);
                const fiche = parId.get(l.id);
                const dotationPassee = l.dotationPassee ? l.dotation : 0;
                if (!l.dotationPassee && l.dotation > 0) {
                    dotationsAPasser += l.dotation;
                    biensAPasser += 1;
                }
                if (fiche)
                    ajouter(amortissement, fiche.compteAmortissement.numero, fiche.compteAmortissement.intitule, l.cumulN - l.dotation + dotationPassee);
                const r = fiche?.reclassements[0];
                if (r) {
                    reclasses.push({ designation: l.designation, date: r.dateReclassement.toISOString().slice(0, 10), ancienCompte: r.ancienCompteImmobilisation.numero, compteActuel: g.numero });
                }
            }
        }
        const soldesBien = new Map();
        const soldesAmortissement = new Map();
        const comptesAmortissement = new Set([...amortissement.keys()]);
        for (const l of balance.lignes) {
            if ((0, compte_du_bien_1.estCompteDeBien)(referentiel, l.numero))
                soldesBien.set(l.numero, { intitule: l.intitule, solde: l.solde });
            else if (l.numero.startsWith('28') || comptesAmortissement.has(l.numero)) {
                soldesAmortissement.set(l.numero, { intitule: l.intitule, solde: -l.solde });
            }
        }
        const numerosSansFiche = await this.prisma.compte.findMany({
            where: { tenantId, id: { in: sansFiche.map((s) => s.compteId) } },
            select: { id: true, numero: true },
        });
        const numeroDe = new Map(numerosSansFiche.map((c) => [c.id, c.numero]));
        const lignesSansFiche = new Map();
        for (const s of sansFiche) {
            const numero = numeroDe.get(s.compteId);
            if (!numero)
                continue;
            lignesSansFiche.set(numero, { nombre: s._count._all, montant: Number(s._sum.debit ?? 0) });
        }
        const doubles = (0, maintenance_immobilisations_1.numerosEnDouble)(fiches);
        const enService = fiches.filter((f) => f.statut === client_1.StatutImmobilisation.EN_SERVICE);
        return {
            exercice: { id: exercice.id, dateFin: exercice.dateFin.toISOString().slice(0, 10) },
            comptesBien: (0, maintenance_immobilisations_1.rapprocher)(brut, soldesBien).map((l) => ({
                ...l,
                lignesSansFiche: lignesSansFiche.get(l.numero) ?? { nombre: 0, montant: 0 },
            })),
            comptesAmortissement: (0, maintenance_immobilisations_1.rapprocher)(amortissement, soldesAmortissement),
            dotationsAPasser: { nombre: biensAPasser, montant: Math.round(dotationsAPasser * 100) / 100 },
            reclassesApresLaCloture: reclasses.slice(0, PLAFOND_NOMMES),
            reclassesApresLaClotureTotal: reclasses.length,
            numerosEnDouble: doubles.slice(0, PLAFOND_NOMMES),
            numerosEnDoubleTotal: doubles.length,
            biensEnServiceSansNumero: enService.filter((f) => !(f.numeroInventaire ?? '').trim()).length,
        };
    }
    async fichesANumeroter(db, tenantId) {
        const lues = await db.immobilisation.findMany({
            where: { tenantId },
            select: {
                id: true,
                designation: true,
                numeroInventaire: true,
                dateAcquisition: true,
                createdAt: true,
                statut: true,
                compteImmobilisation: { select: { numero: true } },
            },
            take: PLAFOND_FICHES + 1,
        });
        if (lues.length > PLAFOND_FICHES) {
            throw new common_1.BadRequestException(`Plus de ${PLAFOND_FICHES} fiches · la renumérotation ne les relit pas d'un coup.`);
        }
        return lues.map((f) => ({
            id: f.id,
            designation: f.designation,
            numeroInventaire: f.numeroInventaire,
            dateAcquisition: f.dateAcquisition,
            createdAt: f.createdAt,
            sortie: f.statut !== client_1.StatutImmobilisation.EN_SERVICE,
            compteNumero: f.compteImmobilisation.numero,
        }));
    }
};
exports.MaintenanceImmobilisationsService = MaintenanceImmobilisationsService;
exports.MaintenanceImmobilisationsService = MaintenanceImmobilisationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        immobilisation_service_1.ImmobilisationService,
        ecriture_service_1.EcritureService])
], MaintenanceImmobilisationsService);
//# sourceMappingURL=maintenance-immobilisations.service.js.map