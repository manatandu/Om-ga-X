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
exports.AnnulationTraitementService = void 0;
exports.posteeParUneReevaluation = posteeParUneReevaluation;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const lignes_tenues_1 = require("../comptabilite/lignes-tenues");
const annulation_traitement_1 = require("./annulation-traitement");
const n = (d) => Number(d ?? 0);
const centimes = (x) => Math.round(x * 100) / 100;
const jour = (d) => d.toISOString().slice(0, 10).split('-').reverse().join('/');
const LIBELLE_NATURE = {
    DOTATION: 'dotation aux amortissements',
    DEPRECIATION: 'dépréciation',
    REVISION_PLAN: 'révision du plan',
    DEROGATOIRE: 'amortissement dérogatoire',
    REEVALUATION: 'réévaluation des immobilisations',
    REPRISE_SUBVENTION: 'reprise de subvention',
    REPRISE_PROVISION_REEVALUATION: 'reprise de la provision spéciale',
};
const PLAFOND_ACTES = 2000;
const PLAFOND_HISTORIQUE = 200;
let AnnulationTraitementService = class AnnulationTraitementService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    async traitementsDuBien(tenantId, immobilisationId) {
        const bien = await this.prisma.immobilisation.findFirst({ where: { id: immobilisationId, tenantId }, select: { id: true } });
        if (!bien)
            throw new common_1.NotFoundException('Immobilisation introuvable pour ce dossier.');
        const cibles = await this.ciblesDuBien(this.prisma, tenantId, immobilisationId);
        const actesParBiens = new Map();
        const actesDe = (biens) => {
            const cle = [...biens].sort().join('|');
            if (!actesParBiens.has(cle))
                actesParBiens.set(cle, this.actesDesBiens(this.prisma, tenantId, biens));
            return actesParBiens.get(cle);
        };
        const idsEcritures = [...new Set(cibles.map((c) => c.ecritureId).filter((x) => !!x))];
        const ecritures = new Map((idsEcritures.length === 0
            ? []
            : await this.prisma.ecriture.findMany({
                where: { tenantId, id: { in: idsEcritures } },
                select: { id: true, numeroPiece: true, statut: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
            })).map((e) => [e.id, e]));
        const resultat = [];
        for (const c of cibles) {
            const actes = await actesDe(c.biens);
            const ecriture = c.ecritureId ? (ecritures.get(c.ecritureId) ?? null) : null;
            const motif = this.motifPour(c, actes) ??
                (ecriture && ecriture.statut !== client_1.StatutEcriture.BROUILLARD
                    ? (0, lignes_tenues_1.motifLignesTenues)(ecriture.lignes, `l'écriture n° ${ecriture.numeroPiece ?? '·'}`, 'annuler', ', puis annulez le traitement')
                    : null);
            resultat.push({
                nature: c.nature,
                acteId: c.acteId,
                libelle: c.libelle,
                exercice: { id: c.exercice.id, dateFin: c.exercice.dateFin, statut: c.exercice.statut },
                enregistreLe: c.creeLe,
                montant: c.montant,
                ecriture: ecriture ? { id: ecriture.id, numeroPiece: ecriture.numeroPiece, statut: ecriture.statut } : null,
                portePlusieursBiens: c.immobilisationId === null,
                motifRefus: motif,
            });
        }
        resultat.sort((a, b) => b.exercice.dateFin.getTime() - a.exercice.dateFin.getTime() || b.enregistreLe.getTime() - a.enregistreLe.getTime());
        return { traitements: resultat };
    }
    async annulations(tenantId, immobilisationId) {
        const filtre = immobilisationId
            ? {
                OR: [
                    { immobilisationId },
                    { immobilisationId: null, acte: { path: ['biens'], array_contains: [immobilisationId] } },
                ],
            }
            : {};
        const [lignes, total] = await Promise.all([
            this.prisma.annulationTraitementImmobilisation.findMany({
                where: { tenantId, ...filtre },
                orderBy: { annuleeLe: 'desc' },
                take: PLAFOND_HISTORIQUE,
                include: {
                    immobilisation: { select: { id: true, designation: true } },
                    exercice: { select: { id: true, dateFin: true } },
                    ecritureNegatif: { select: { id: true, numeroPiece: true, date: true } },
                },
            }),
            this.prisma.annulationTraitementImmobilisation.count({ where: { tenantId, ...filtre } }),
        ]);
        return {
            total,
            tronque: total > lignes.length,
            annulations: lignes.map((a) => ({
                id: a.id,
                nature: a.nature,
                libelle: a.acte?.libelle ?? LIBELLE_NATURE[a.nature],
                immobilisation: a.immobilisation,
                exercice: a.exercice,
                montant: a.montant === null ? null : n(a.montant),
                motif: a.motif,
                traitement: a.traitement,
                numeroPieceOrigine: a.numeroPieceOrigine,
                negatif: a.ecritureNegatif,
                annuleeLe: a.annuleeLe,
                annuleePar: a.annuleePar,
            })),
        };
    }
    async annuler(tenantId, userId, dto) {
        const refusMotif = (0, annulation_traitement_1.motifRefusMotifAnnulation)(dto.motif);
        if (refusMotif)
            throw new common_1.BadRequestException(refusMotif);
        const motif = dto.motif.trim();
        const avant = await this.cible(this.prisma, tenantId, dto.nature, dto.acteId);
        const refus = this.motifPour(avant, await this.actesDesBiens(this.prisma, tenantId, avant.biens));
        if (refus)
            throw new common_1.BadRequestException(refus);
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const c = await this.cible(tx, tenantId, dto.nature, dto.acteId);
            if (c.biens.length > 0) {
                const ids = [...c.biens].sort();
                await tx.$queryRaw `SELECT id FROM "immobilisations" WHERE "tenantId" = ${tenantId} AND id IN (${client_1.Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
            }
            const refusDansTx = this.motifPour(c, await this.actesDesBiens(tx, tenantId, c.biens));
            if (refusDansTx)
                throw new common_1.BadRequestException(refusDansTx);
            let traitement = 'SANS_ECRITURE';
            let numeroPieceOrigine = null;
            let negatif = null;
            if (c.ecritureId) {
                const e = await tx.ecriture.findFirst({
                    where: { id: c.ecritureId, tenantId },
                    select: { id: true, statut: true, numeroPiece: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
                });
                if (!e)
                    throw new common_1.ConflictException("L'écriture de ce traitement n'existe plus · relisez la fiche du bien avant d'annuler.");
                numeroPieceOrigine = e.numeroPiece;
                const tenues = (0, lignes_tenues_1.motifLignesTenues)(e.lignes, `l'écriture n° ${e.numeroPiece ?? '·'}`, 'annuler', ', puis annulez le traitement');
                if (tenues)
                    throw new common_1.BadRequestException(tenues);
                if (e.statut === client_1.StatutEcriture.BROUILLARD) {
                    traitement = 'SUPPRIMEE';
                }
                else {
                    traitement = 'INSCRITE_EN_NEGATIF';
                    negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, e.id, motif, tx);
                }
            }
            const retabli = await this.retablir(tx, tenantId, c);
            await tx.annulationTraitementImmobilisation.create({
                data: {
                    tenantId,
                    nature: c.nature,
                    immobilisationId: c.immobilisationId,
                    exerciceId: c.exercice.id,
                    acteId: c.acteId,
                    acte: { ...c.acte, libelle: c.libelle, biens: c.biens, retabli },
                    montant: c.montant,
                    motif,
                    traitement,
                    numeroPieceOrigine,
                    ecritureOrigineId: traitement === 'INSCRITE_EN_NEGATIF' ? c.ecritureId : null,
                    ecritureNegatifId: negatif?.id ?? null,
                    annuleePar: userId,
                },
            });
            await this.retirerLActe(tx, tenantId, c);
            if (traitement === 'SUPPRIMEE' && c.ecritureId) {
                await tx.ligneEcriture.deleteMany({ where: { ecritureId: c.ecritureId, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
                const r = await tx.ecriture.deleteMany({ where: { id: c.ecritureId, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
                if (r.count !== 1) {
                    throw new common_1.ConflictException("L'écriture a été validée ou retirée pendant l'annulation · rien n'est supprimé. Relancez l'annulation · validée, elle " +
                        "s'inscrira en négatif (AUDCIF art. 20, al. 2).");
                }
            }
            return {
                annule: true,
                nature: c.nature,
                traitement,
                numeroPieceOrigine,
                negatif: negatif ? { id: negatif.id, numeroPiece: negatif.numeroPiece, date: jour(negatif.date) } : null,
                retabli,
            };
        });
    }
    motifPour(c, actes) {
        const dependants = (0, annulation_traitement_1.actesQuiEnDependent)({
            nature: c.nature,
            id: c.acteId,
            exerciceFin: c.exercice.dateFin,
            creeLe: c.creeLe,
            libelle: c.libelle,
            soldeDerogatoire: c.soldeDerogatoire,
            repriseALaSortie: c.repriseALaSortie,
        }, c.nature === 'REEVALUATION' ? actes.filter((a) => !(a.nature === 'REVISION_PLAN' && c.acte.revisionsPosees?.includes(a.id))) : actes);
        return (0, annulation_traitement_1.motifRefusAnnulation)({
            exerciceClos: c.exercice.statut === client_1.StatutExercice.CLOTURE,
            transfertMiseEnService: c.transfertMiseEnService,
            revisionDeReevaluation: c.revisionDeReevaluation,
            dependants,
        });
    }
    async cible(db, tenantId, nature, acteId) {
        const introuvable = () => new common_1.NotFoundException(`Ce traitement (${LIBELLE_NATURE[nature]}) n'existe pas dans ce dossier, ou il a déjà été annulé.`);
        switch (nature) {
            case 'DOTATION': {
                const d = await db.dotationAmortissement.findFirst({
                    where: { id: acteId, immobilisation: { tenantId } },
                    include: { exercice: true, immobilisation: { select: { designation: true } } },
                });
                if (!d)
                    throw introuvable();
                return {
                    nature,
                    acteId,
                    immobilisationId: d.immobilisationId,
                    biens: [d.immobilisationId],
                    exercice: d.exercice,
                    creeLe: d.createdAt,
                    montant: n(d.montant),
                    ecritureId: d.ecritureId,
                    libelle: `Dotation de l'exercice clos le ${jour(d.exercice.dateFin)}`,
                    acte: { id: d.id, immobilisationId: d.immobilisationId, exerciceId: d.exerciceId, montant: n(d.montant), ecritureId: d.ecritureId, createdAt: d.createdAt },
                };
            }
            case 'DEPRECIATION': {
                const d = await db.depreciationImmobilisation.findFirst({
                    where: { id: acteId, immobilisation: { tenantId } },
                    include: { exercice: true },
                });
                if (!d)
                    throw introuvable();
                return {
                    nature,
                    acteId,
                    immobilisationId: d.immobilisationId,
                    biens: [d.immobilisationId],
                    exercice: d.exercice,
                    creeLe: d.createdAt,
                    montant: n(d.montant),
                    ecritureId: d.ecritureId,
                    libelle: `${d.sens === 'DOTATION' ? 'Dépréciation' : 'Reprise de dépréciation'} de l'exercice clos le ${jour(d.exercice.dateFin)}`,
                    transfertMiseEnService: d.nature !== client_1.NatureMouvementDepreciation.CLOTURE,
                    acte: {
                        id: d.id,
                        immobilisationId: d.immobilisationId,
                        exerciceId: d.exerciceId,
                        sens: d.sens,
                        nature: d.nature,
                        montant: n(d.montant),
                        montantImputeEcart: n(d.montantImputeEcart),
                        compteDepreciationId: d.compteDepreciationId,
                        compteContrepartieId: d.compteContrepartieId,
                        indice: d.indice,
                        ecritureId: d.ecritureId,
                        createdAt: d.createdAt,
                        createdBy: d.createdBy,
                    },
                };
            }
            case 'REVISION_PLAN': {
                const r = await db.revisionPlanAmortissement.findFirst({ where: { id: acteId, tenantId }, include: { exercice: true } });
                if (!r)
                    throw introuvable();
                const deReevaluation = posteeParUneReevaluation(r);
                return {
                    nature,
                    acteId,
                    immobilisationId: r.immobilisationId,
                    biens: [r.immobilisationId],
                    exercice: r.exercice,
                    creeLe: r.createdAt,
                    montant: r.montantReprise === null ? null : n(r.montantReprise),
                    ecritureId: r.ecritureId,
                    libelle: `Révision ${r.nature === client_1.NatureRevisionPlan.PROSPECTIVE ? 'prospective' : 'rétroactive'} du plan du ${jour(r.dateDecision)}`,
                    revisionDeReevaluation: deReevaluation,
                    acte: {
                        id: r.id,
                        immobilisationId: r.immobilisationId,
                        exerciceId: r.exerciceId,
                        nature: r.nature,
                        dateDecision: r.dateDecision,
                        dureeAvantAns: r.dureeAvantAns,
                        dureeApresAns: r.dureeApresAns,
                        motif: r.motif,
                        montantReprise: r.montantReprise === null ? null : n(r.montantReprise),
                        ecritureId: r.ecritureId,
                        createdAt: r.createdAt,
                        createdBy: r.createdBy,
                    },
                };
            }
            case 'DEROGATOIRE': {
                const d = await db.amortissementDerogatoire.findFirst({ where: { id: acteId, tenantId }, include: { exercice: true } });
                if (!d)
                    throw introuvable();
                const solde = d.nature === client_1.NatureDerogatoire.SOLDE_SORTIE;
                return {
                    nature,
                    acteId,
                    immobilisationId: d.immobilisationId,
                    biens: [d.immobilisationId],
                    exercice: d.exercice,
                    creeLe: d.createdAt,
                    montant: centimes(n(d.dotation) - n(d.reprise)),
                    ecritureId: d.ecritureId,
                    libelle: solde
                        ? `Reprise du solde du dérogatoire, exercice clos le ${jour(d.exercice.dateFin)}`
                        : `Dérogatoire de l'exercice clos le ${jour(d.exercice.dateFin)}`,
                    soldeDerogatoire: solde,
                    acte: {
                        id: d.id,
                        immobilisationId: d.immobilisationId,
                        exerciceId: d.exerciceId,
                        nature: d.nature,
                        annuiteFiscale: n(d.annuiteFiscale),
                        dotationComptable: n(d.dotationComptable),
                        dotation: n(d.dotation),
                        reprise: n(d.reprise),
                        excedentAReintegrer: n(d.excedentAReintegrer),
                        ecritureId: d.ecritureId,
                        createdAt: d.createdAt,
                    },
                };
            }
            case 'REEVALUATION': {
                const r = await db.reevaluationBilan.findFirst({
                    where: { id: acteId, tenantId },
                    include: { exercice: true, lignes: { take: PLAFOND_ACTES } },
                });
                if (!r)
                    throw introuvable();
                const revisionsPosees = await this.revisionsPoseesPar(db, tenantId, r);
                return {
                    nature,
                    acteId,
                    immobilisationId: null,
                    biens: [...new Set(r.lignes.filter((l) => n(l.ecart) > 0.004).map((l) => l.immobilisationId))],
                    exercice: r.exercice,
                    creeLe: r.createdAt,
                    montant: n(r.totalEcart),
                    ecritureId: r.ecritureId,
                    libelle: `Réévaluation ${r.type === 'LEGALE' ? 'légale' : 'libre'} du ${jour(r.dateReevaluation)}`,
                    acte: {
                        id: r.id,
                        exerciceId: r.exerciceId,
                        type: r.type,
                        methodeLibre: r.methodeLibre,
                        neutraliteFiscale: r.neutraliteFiscale,
                        dateReevaluation: r.dateReevaluation,
                        decision: r.decision,
                        traitementFiscal: r.traitementFiscal,
                        methodeEvaluation: r.methodeEvaluation,
                        categories: r.categories,
                        totalEcart: n(r.totalEcart),
                        ecritureId: r.ecritureId,
                        createdAt: r.createdAt,
                        createdBy: r.createdBy,
                        revisionsPosees,
                        lignes: r.lignes.map((l) => ({
                            id: l.id,
                            immobilisationId: l.immobilisationId,
                            categorie: l.categorie,
                            coefficient: l.coefficient === null ? null : n(l.coefficient),
                            valeurActuelle: l.valeurActuelle === null ? null : n(l.valeurActuelle),
                            coefficientRetenu: n(l.coefficientRetenu),
                            brutAvant: n(l.brutAvant),
                            amortissementsAvant: n(l.amortissementsAvant),
                            valeurNetteAvant: n(l.valeurNetteAvant),
                            brutApres: n(l.brutApres),
                            amortissementsApres: n(l.amortissementsApres),
                            valeurReevaluee: n(l.valeurReevaluee),
                            ecart: n(l.ecart),
                            compteEcart: l.compteEcart,
                            droitDeReprise: l.droitDeReprise,
                            motifNonReevalue: l.motifNonReevalue,
                            provisionReprise: n(l.provisionReprise),
                            ecartImpute: n(l.ecartImpute),
                            ecartTransfere: n(l.ecartTransfere),
                            valeurResiduelleAvant: l.valeurResiduelleAvant === null ? null : n(l.valeurResiduelleAvant),
                        })),
                    },
                };
            }
            case 'REPRISE_SUBVENTION': {
                const r = await db.repriseSubventionImmobilisation.findFirst({ where: { id: acteId, tenantId }, include: { exercice: true } });
                if (!r)
                    throw introuvable();
                return {
                    nature,
                    acteId,
                    immobilisationId: r.immobilisationId,
                    biens: [r.immobilisationId],
                    exercice: r.exercice,
                    creeLe: r.createdAt,
                    montant: n(r.montant),
                    ecritureId: r.ecritureId,
                    libelle: `Reprise de subvention${r.nature === 'SORTIE' ? ' à la sortie' : ''}, exercice clos le ${jour(r.exercice.dateFin)}`,
                    repriseALaSortie: r.nature === 'SORTIE',
                    acte: { id: r.id, immobilisationId: r.immobilisationId, exerciceId: r.exerciceId, nature: r.nature, montant: n(r.montant), ecritureId: r.ecritureId, createdAt: r.createdAt, createdBy: r.createdBy },
                };
            }
            case 'REPRISE_PROVISION_REEVALUATION': {
                const r = await db.repriseProvisionReevaluation.findFirst({ where: { id: acteId, tenantId }, include: { exercice: true } });
                if (!r)
                    throw introuvable();
                const detail = lireDetailReprise(r.detail);
                return {
                    nature,
                    acteId,
                    immobilisationId: null,
                    biens: [...new Set(detail.map((x) => x.immobilisationId))],
                    exercice: r.exercice,
                    creeLe: r.createdAt,
                    montant: n(r.montant),
                    ecritureId: r.ecritureId,
                    libelle: `Reprise de la provision spéciale, exercice clos le ${jour(r.exercice.dateFin)}`,
                    acte: { id: r.id, exerciceId: r.exerciceId, montant: n(r.montant), detail: r.detail, ecritureId: r.ecritureId, createdAt: r.createdAt, createdBy: r.createdBy },
                };
            }
        }
    }
    async ciblesDuBien(db, tenantId, id) {
        const [dotations, depreciations, revisions, derogatoires, lignesReev, reprises, reprisesProvision] = await Promise.all([
            db.dotationAmortissement.findMany({ where: { immobilisationId: id, immobilisation: { tenantId } }, select: { id: true }, take: PLAFOND_ACTES }),
            db.depreciationImmobilisation.findMany({ where: { immobilisationId: id, immobilisation: { tenantId } }, select: { id: true }, take: PLAFOND_ACTES }),
            db.revisionPlanAmortissement.findMany({ where: { tenantId, immobilisationId: id }, select: { id: true }, take: PLAFOND_ACTES }),
            db.amortissementDerogatoire.findMany({ where: { tenantId, immobilisationId: id }, select: { id: true }, take: PLAFOND_ACTES }),
            db.ligneReevaluationBilan.findMany({ where: { tenantId, immobilisationId: id }, select: { reevaluationId: true }, take: PLAFOND_ACTES }),
            db.repriseSubventionImmobilisation.findMany({ where: { tenantId, immobilisationId: id }, select: { id: true }, take: PLAFOND_ACTES }),
            db.repriseProvisionReevaluation.findMany({ where: { tenantId }, select: { id: true, detail: true }, take: PLAFOND_ACTES }),
        ]);
        const demandes = [
            ...dotations.map((x) => ['DOTATION', x.id]),
            ...depreciations.map((x) => ['DEPRECIATION', x.id]),
            ...revisions.map((x) => ['REVISION_PLAN', x.id]),
            ...derogatoires.map((x) => ['DEROGATOIRE', x.id]),
            ...[...new Set(lignesReev.map((l) => l.reevaluationId))].map((r) => ['REEVALUATION', r]),
            ...reprises.map((x) => ['REPRISE_SUBVENTION', x.id]),
            ...reprisesProvision
                .filter((r) => lireDetailReprise(r.detail).some((d) => d.immobilisationId === id))
                .map((x) => ['REPRISE_PROVISION_REEVALUATION', x.id]),
        ];
        const cibles = [];
        for (const [nature, acteId] of demandes)
            cibles.push(await this.cible(db, tenantId, nature, acteId));
        return cibles;
    }
    async actesDesBiens(db, tenantId, ids) {
        if (ids.length === 0)
            return [];
        const ex = { select: { dateFin: true } };
        const [biens, dotations, depreciations, revisions, derogatoires, lignesReev, reprises, reprisesProvision, reductions, reclassements, parties, exercices] = await Promise.all([
            db.immobilisation.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, designation: true, statut: true, dateSortie: true } }),
            db.dotationAmortissement.findMany({ where: { immobilisationId: { in: ids }, immobilisation: { tenantId } }, select: { id: true, immobilisationId: true, createdAt: true, exercice: ex }, take: PLAFOND_ACTES }),
            db.depreciationImmobilisation.findMany({ where: { immobilisationId: { in: ids }, immobilisation: { tenantId } }, select: { id: true, immobilisationId: true, createdAt: true, nature: true, exercice: ex }, take: PLAFOND_ACTES }),
            db.revisionPlanAmortissement.findMany({ where: { tenantId, immobilisationId: { in: ids } }, select: { id: true, immobilisationId: true, createdAt: true, dateDecision: true, exercice: ex }, take: PLAFOND_ACTES }),
            db.amortissementDerogatoire.findMany({ where: { tenantId, immobilisationId: { in: ids } }, select: { id: true, immobilisationId: true, createdAt: true, nature: true, exercice: ex }, take: PLAFOND_ACTES }),
            db.ligneReevaluationBilan.findMany({ where: { tenantId, immobilisationId: { in: ids } }, select: { immobilisationId: true, reevaluation: { select: { id: true, createdAt: true, dateReevaluation: true, exercice: ex } } }, take: PLAFOND_ACTES }),
            db.repriseSubventionImmobilisation.findMany({ where: { tenantId, immobilisationId: { in: ids } }, select: { id: true, immobilisationId: true, createdAt: true, nature: true, exercice: ex }, take: PLAFOND_ACTES }),
            db.repriseProvisionReevaluation.findMany({ where: { tenantId }, select: { id: true, createdAt: true, detail: true, exercice: ex }, take: PLAFOND_ACTES }),
            db.reductionSubventionImmobilisation.findMany({ where: { tenantId, subvention: { immobilisationId: { in: ids } } }, select: { id: true, createdAt: true, subvention: { select: { immobilisationId: true } }, exercice: ex }, take: PLAFOND_ACTES }),
            db.reclassementImmobilisation.findMany({ where: { immobilisationId: { in: ids }, immobilisation: { tenantId } }, select: { id: true, immobilisationId: true, createdAt: true, dateReclassement: true, exercice: ex }, take: PLAFOND_ACTES }),
            db.immobilisation.findMany({
                where: { tenantId, immobilisationPrincipaleId: { in: ids }, methodeEstimationPartie: { not: null } },
                select: { id: true, immobilisationPrincipaleId: true, createdAt: true, dateAcquisition: true },
                take: PLAFOND_ACTES,
            }),
            db.exercice.findMany({ where: { tenantId }, select: { dateDebut: true, dateFin: true }, take: PLAFOND_ACTES }),
        ]);
        const nom = new Map(biens.map((b) => [b.id, b.designation]));
        const finALaDate = (d) => exercices.find((e) => e.dateDebut <= d && e.dateFin >= d)?.dateFin ?? d;
        const actes = [
            ...dotations.map((d) => ({ nature: 'DOTATION', id: d.id, exerciceFin: d.exercice.dateFin, creeLe: d.createdAt, libelle: `la dotation de l'exercice clos le ${jour(d.exercice.dateFin)}`, bien: nom.get(d.immobilisationId) })),
            ...depreciations.map((d) => ({
                nature: d.nature === client_1.NatureMouvementDepreciation.CLOTURE ? 'DEPRECIATION' : 'TRANSFERT_DEPRECIATION',
                id: d.id,
                exerciceFin: d.exercice.dateFin,
                creeLe: d.createdAt,
                libelle: d.nature === client_1.NatureMouvementDepreciation.CLOTURE
                    ? `la dépréciation de l'exercice clos le ${jour(d.exercice.dateFin)}`
                    : 'le transfert de la dépréciation à la mise en service',
                bien: nom.get(d.immobilisationId),
            })),
            ...revisions.map((r) => ({ nature: 'REVISION_PLAN', id: r.id, exerciceFin: r.exercice.dateFin, creeLe: r.createdAt, libelle: `la révision du plan du ${jour(r.dateDecision)}`, bien: nom.get(r.immobilisationId) })),
            ...derogatoires.map((d) => ({
                nature: d.nature === client_1.NatureDerogatoire.SOLDE_SORTIE ? 'DEROGATOIRE_SOLDE' : 'DEROGATOIRE',
                id: d.id,
                exerciceFin: d.exercice.dateFin,
                creeLe: d.createdAt,
                libelle: d.nature === client_1.NatureDerogatoire.SOLDE_SORTIE
                    ? `la reprise du solde du dérogatoire (exercice clos le ${jour(d.exercice.dateFin)})`
                    : `le dérogatoire de l'exercice clos le ${jour(d.exercice.dateFin)}`,
                bien: nom.get(d.immobilisationId),
            })),
            ...[...new Map(lignesReev.map((l) => [l.reevaluation.id, l])).values()].map((l) => ({
                nature: 'REEVALUATION',
                id: l.reevaluation.id,
                exerciceFin: l.reevaluation.exercice.dateFin,
                creeLe: l.reevaluation.createdAt,
                libelle: `la réévaluation du ${jour(l.reevaluation.dateReevaluation)}`,
            })),
            ...reprises.map((r) => ({
                nature: 'REPRISE_SUBVENTION',
                id: r.id,
                exerciceFin: r.exercice.dateFin,
                creeLe: r.createdAt,
                libelle: `la reprise de subvention de l'exercice clos le ${jour(r.exercice.dateFin)}`,
                bien: nom.get(r.immobilisationId),
                repriseALaSortie: r.nature === 'SORTIE',
            })),
            ...reprisesProvision
                .filter((r) => lireDetailReprise(r.detail).some((d) => ids.includes(d.immobilisationId)))
                .map((r) => ({ nature: 'REPRISE_PROVISION_REEVALUATION', id: r.id, exerciceFin: r.exercice.dateFin, creeLe: r.createdAt, libelle: `la reprise de la provision spéciale de l'exercice clos le ${jour(r.exercice.dateFin)}` })),
            ...reductions.map((r) => ({ nature: 'REDUCTION_SUBVENTION', id: r.id, exerciceFin: r.exercice.dateFin, creeLe: r.createdAt, libelle: `la réduction de la subvention de l'exercice clos le ${jour(r.exercice.dateFin)}`, bien: nom.get(r.subvention.immobilisationId) })),
            ...reclassements.map((r) => ({ nature: 'RECLASSEMENT', id: r.id, exerciceFin: r.exercice.dateFin, creeLe: r.createdAt, libelle: `le reclassement du ${jour(r.dateReclassement)}`, bien: nom.get(r.immobilisationId) })),
            ...parties.map((p) => ({
                nature: 'REMPLACEMENT_IMPREVU',
                id: p.id,
                exerciceFin: finALaDate(p.dateAcquisition),
                creeLe: p.createdAt,
                libelle: 'le remplacement imprévu d’une partie de la structure',
                bien: p.immobilisationPrincipaleId ? nom.get(p.immobilisationPrincipaleId) : undefined,
            })),
            ...biens
                .filter((b) => b.statut !== client_1.StatutImmobilisation.EN_SERVICE)
                .map((b) => ({
                nature: 'SORTIE',
                id: b.id,
                exerciceFin: b.dateSortie ? finALaDate(b.dateSortie) : new Date(8.64e15),
                creeLe: b.dateSortie ?? new Date(8.64e15),
                libelle: `la sortie du bien${b.dateSortie ? ` le ${jour(b.dateSortie)}` : ''}`,
                bien: b.designation,
            })),
        ];
        return actes;
    }
    async retablir(tx, tenantId, c) {
        switch (c.nature) {
            case 'DOTATION':
            case 'DEROGATOIRE':
            case 'REPRISE_SUBVENTION':
                return {};
            case 'DEPRECIATION': {
                const impute = n(c.acte.montantImputeEcart);
                if (impute <= 0.004)
                    return {};
                const lignes = await tx.ligneReevaluationBilan.findMany({
                    where: { tenantId, immobilisationId: c.immobilisationId, ecart: { gt: 0 } },
                    select: { id: true, ecartImpute: true, compteEcart: true },
                    orderBy: { reevaluation: { dateReevaluation: 'asc' } },
                    take: PLAFOND_ACTES,
                });
                const rendu = (0, annulation_traitement_1.rendreEcartImpute)(lignes.map((l) => ({ id: l.id, ecartImpute: n(l.ecartImpute) })), impute);
                if (!rendu) {
                    throw new common_1.ConflictException(`La dépréciation avait imputé ${impute.toFixed(2)} sur l'écart de réévaluation du bien (AUDCIF Titre VIII ch. 12 § 2.5), ` +
                        "et les lignes de réévaluation ne portent plus de quoi le rendre au centime · l'état a changé depuis. Rien n'est annulé.");
                }
                for (const r of rendu) {
                    await tx.ligneReevaluationBilan.update({ where: { id: r.id }, data: { ecartImpute: { decrement: r.montant } } });
                }
                return { ecartImputeRendu: rendu };
            }
            case 'REVISION_PLAN': {
                const bien = await tx.immobilisation.findFirst({
                    where: { id: c.immobilisationId, tenantId },
                    select: { id: true, dureeAmortissementAns: true, reprisesAmortissement: true, dateEffetRevisionPlan: true, dureeResiduelleRevisee: true },
                });
                if (!bien)
                    throw new common_1.ConflictException("Le bien de cette révision n'existe plus.");
                const restantes = await this.revisionsLues(tx, tenantId, c.immobilisationId, c.acteId);
                const etat = (0, annulation_traitement_1.etatDuPlanApres)(restantes);
                const reprise = c.acte.nature === 'RETROACTIVE' ? n(c.acte.montantReprise) : 0;
                await tx.immobilisation.update({
                    where: { id: bien.id },
                    data: {
                        dureeAmortissementAns: c.acte.dureeAvantAns,
                        dateEffetRevisionPlan: etat.dateEffetRevisionPlan,
                        dureeResiduelleRevisee: etat.dureeResiduelleRevisee,
                        ...(reprise > 0 ? { reprisesAmortissement: { decrement: reprise } } : {}),
                    },
                });
                return {
                    avant: {
                        dureeAmortissementAns: bien.dureeAmortissementAns,
                        reprisesAmortissement: n(bien.reprisesAmortissement),
                        dateEffetRevisionPlan: bien.dateEffetRevisionPlan,
                        dureeResiduelleRevisee: bien.dureeResiduelleRevisee,
                    },
                    apres: { dureeAmortissementAns: c.acte.dureeAvantAns, ...etat, repriseRetranchee: reprise },
                };
            }
            case 'REPRISE_PROVISION_REEVALUATION': {
                const detail = lireDetailReprise(c.acte.detail);
                for (const d of detail) {
                    if (!(d.montant > 0))
                        continue;
                    const l = await tx.ligneReevaluationBilan.findFirst({ where: { id: d.ligneId, tenantId }, select: { id: true, provisionReprise: true } });
                    if (!l || n(l.provisionReprise) + 0.004 < d.montant) {
                        throw new common_1.ConflictException("Une ligne de réévaluation que la reprise avait soldée ne porte plus sa reprise · l'état a changé depuis (sortie du bien, " +
                            "autre reprise). Rien n'est annulé.");
                    }
                    await tx.ligneReevaluationBilan.update({ where: { id: l.id }, data: { provisionReprise: { decrement: d.montant } } });
                }
                return { provisionRendue: detail.map((d) => ({ ligneId: d.ligneId, montant: d.montant })) };
            }
            case 'REEVALUATION': {
                const lignes = c.acte.lignes ?? [];
                const retablis = [];
                for (const l of lignes) {
                    if (!(n(l.ecart) > 0.004))
                        continue;
                    const bien = await tx.immobilisation.findFirst({
                        where: { id: l.immobilisationId, tenantId },
                        select: { id: true, designation: true, valeurOrigine: true, valeurResiduelle: true, amortissementsReevaluation: true },
                    });
                    if (!bien)
                        throw new common_1.ConflictException('Un bien de cette réévaluation n’existe plus · rien n’est annulé.');
                    if (Math.abs(n(bien.valeurOrigine) - n(l.brutApres)) > 0.004) {
                        throw new common_1.ConflictException(`La valeur d'origine de « ${bien.designation} » (${n(bien.valeurOrigine).toFixed(2)}) n'est plus celle que la réévaluation ` +
                            `a posée (${n(l.brutApres).toFixed(2)}) · la fiche a changé depuis, rien n'est annulé.`);
                    }
                    const vr = (0, annulation_traitement_1.valeurResiduelleAvant)(l.valeurResiduelleAvant === null ? null : n(l.valeurResiduelleAvant), n(bien.valeurResiduelle));
                    if (vr === null) {
                        throw new common_1.BadRequestException(`« ${bien.designation} » porte une valeur résiduelle (${n(bien.valeurResiduelle).toFixed(2)}) multipliée par le coefficient ` +
                            "de cette réévaluation (décision D-41), et la valeur d'avant n'a pas été gardée · elle ne se retrouve pas au centime par une " +
                            "division. L'annulation ne rétablirait pas la fiche · rien n'est annulé. Corrigez par une écriture en négatif saisie par le " +
                            'cabinet, avec son motif (AUDCIF art. 20, al. 2).');
                    }
                    const delta = centimes(n(l.amortissementsApres) - n(l.amortissementsAvant));
                    await tx.immobilisation.update({
                        where: { id: bien.id },
                        data: {
                            valeurOrigine: n(l.brutAvant),
                            valeurResiduelle: vr,
                            amortissementsReevaluation: { decrement: delta },
                        },
                    });
                    retablis.push({ immobilisationId: bien.id, valeurOrigine: n(l.brutAvant), valeurResiduelle: vr, amortissementsRetranches: delta });
                }
                const posees = c.acte.revisionsPosees ?? [];
                const plans = [];
                for (const revisionId of posees) {
                    const r = await tx.revisionPlanAmortissement.findFirst({ where: { id: revisionId, tenantId }, select: { id: true, immobilisationId: true } });
                    if (!r)
                        continue;
                    await tx.revisionPlanAmortissement.deleteMany({ where: { id: r.id, tenantId } });
                    const etat = (0, annulation_traitement_1.etatDuPlanApres)(await this.revisionsLues(tx, tenantId, r.immobilisationId, null));
                    await tx.immobilisation.update({ where: { id: r.immobilisationId }, data: etat });
                    plans.push({ immobilisationId: r.immobilisationId, revisionRetiree: r.id, ...etat });
                }
                return { fichesRetablies: retablis, plans };
            }
        }
    }
    async retirerLActe(tx, tenantId, c) {
        let count = 0;
        switch (c.nature) {
            case 'DOTATION':
                count = (await tx.dotationAmortissement.deleteMany({ where: { id: c.acteId, immobilisation: { tenantId } } })).count;
                break;
            case 'DEPRECIATION':
                count = (await tx.depreciationImmobilisation.deleteMany({ where: { id: c.acteId, immobilisation: { tenantId } } })).count;
                break;
            case 'REVISION_PLAN':
                count = (await tx.revisionPlanAmortissement.deleteMany({ where: { id: c.acteId, tenantId } })).count;
                break;
            case 'DEROGATOIRE':
                count = (await tx.amortissementDerogatoire.deleteMany({ where: { id: c.acteId, tenantId } })).count;
                break;
            case 'REPRISE_SUBVENTION':
                count = (await tx.repriseSubventionImmobilisation.deleteMany({ where: { id: c.acteId, tenantId } })).count;
                break;
            case 'REPRISE_PROVISION_REEVALUATION':
                count = (await tx.repriseProvisionReevaluation.deleteMany({ where: { id: c.acteId, tenantId } })).count;
                break;
            case 'REEVALUATION':
                await tx.ligneReevaluationBilan.deleteMany({ where: { reevaluationId: c.acteId, tenantId } });
                count = (await tx.reevaluationBilan.deleteMany({ where: { id: c.acteId, tenantId } })).count;
                break;
        }
        if (count !== 1)
            throw new common_1.ConflictException('Ce traitement a été annulé ou retiré pendant le geste · rien n’est annulé deux fois.');
    }
    async revisionsLues(db, tenantId, immobilisationId, sauf) {
        const revisions = await db.revisionPlanAmortissement.findMany({
            where: { tenantId, immobilisationId, ...(sauf ? { id: { not: sauf } } : {}) },
            include: { exercice: { select: { dateDebut: true, dateFin: true } } },
            take: PLAFOND_ACTES,
        });
        const lues = [];
        for (const r of revisions) {
            const deReevaluation = posteeParUneReevaluation(r);
            lues.push({
                id: r.id,
                nature: r.nature,
                dureeApresAns: r.dureeApresAns,
                creeLe: r.createdAt,
                ouvertureExercice: r.exercice.dateDebut,
                ouvertureSuivante: deReevaluation ? new Date(r.exercice.dateFin.getTime() + 24 * 3600 * 1000) : null,
            });
        }
        return lues;
    }
    async revisionsPoseesPar(db, tenantId, reev) {
        const revisions = await db.revisionPlanAmortissement.findMany({
            where: { tenantId, reevaluationBilanId: reev.id },
            select: { id: true },
            take: PLAFOND_ACTES,
        });
        return revisions.map((r) => r.id);
    }
};
exports.AnnulationTraitementService = AnnulationTraitementService;
exports.AnnulationTraitementService = AnnulationTraitementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], AnnulationTraitementService);
function posteeParUneReevaluation(r) {
    return r.reevaluationBilanId !== null;
}
function lireDetailReprise(detail) {
    if (!Array.isArray(detail))
        return [];
    return detail
        .filter((d) => !!d && typeof d === 'object')
        .map((d) => ({ ligneId: String(d.ligneId ?? ''), immobilisationId: String(d.immobilisationId ?? ''), montant: n(d.montant) }))
        .filter((d) => d.ligneId && d.immobilisationId);
}
//# sourceMappingURL=annulation-traitement.service.js.map