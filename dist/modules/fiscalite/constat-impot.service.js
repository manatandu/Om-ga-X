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
var ConstatImpotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConstatImpotService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const lignes_tenues_1 = require("../comptabilite/lignes-tenues");
const fiscalite_service_1 = require("./fiscalite.service");
const ecriture_impot_resultat_1 = require("./ecriture-impot-resultat");
const arrondir = (n) => Math.round(n * 100) / 100;
let ConstatImpotService = ConstatImpotService_1 = class ConstatImpotService {
    constructor(prisma, fiscalite, ecritures) {
        this.prisma = prisma;
        this.fiscalite = fiscalite;
        this.ecritures = ecritures;
        this.journal = new common_1.Logger(ConstatImpotService_1.name);
    }
    async constatEnPlace(tenantId, exerciceId) {
        return this.prisma.constatImpotResultat.findFirst({
            where: { tenantId, exerciceId, annuleeLe: null },
            include: { ecriture: { select: { id: true, numeroPiece: true, statut: true, date: true } } },
        });
    }
    static impotDeLExercice(calcul) {
        const b = calcul.bilansSuccessifs;
        if (b?.role === 'SECONDE_COTISATION') {
            if (!b.calculable || !b.totalisation) {
                return { impotDu: null, minimumApplique: false, tropPaye: 0, motifTotalisation: b.motif ?? 'totalisation non calculée.', secondeCotisation: true };
            }
            return {
                impotDu: b.totalisation.cotisationDeLExercice,
                minimumApplique: b.totalisation.minimumApplique,
                tropPaye: b.totalisation.tropPayePremiereCotisation,
                motifTotalisation: null,
                secondeCotisation: true,
            };
        }
        return { impotDu: calcul.impotDu, minimumApplique: calcul.minimumApplique, tropPaye: 0, motifTotalisation: null, secondeCotisation: false };
    }
    async rejouer(tenantId, exerciceId, attestationRegime) {
        const calcul = await this.fiscalite.resultatFiscal(tenantId, exerciceId);
        const impotExercice = ConstatImpotService_1.impotDeLExercice(calcul);
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { statut: true, dateDebut: true, dateFin: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable');
        const brouillardGestion = await this.prisma.ecriture.count({
            where: {
                tenantId,
                exerciceId,
                statut: client_1.StatutEcriture.BROUILLARD,
                lignes: {
                    some: {
                        OR: [
                            { compte: { numero: { startsWith: '6' } } },
                            { compte: { numero: { startsWith: '7' } } },
                            { compte: { numero: { startsWith: '8' } } },
                        ],
                    },
                },
            },
        });
        const motifs = (0, ecriture_impot_resultat_1.motifsRefusConstat)({
            formeJuridique: calcul.formeJuridiqueSyscohada,
            regime: calcul.regime,
            impotDu: impotExercice.impotDu,
            minimumApplique: impotExercice.minimumApplique,
            tropPaye: impotExercice.tropPaye,
            motifTotalisation: impotExercice.motifTotalisation,
            simulationAvantLaLoi: calcul.simulationAvantLaLoi,
            periodeCreation: calcul.periodeCreation
                ? {
                    dateFin: calcul.periodeCreation.dateFin,
                    dateFinExercice: exercice.dateFin,
                    impotDu: calcul.periodeCreation.impotDu,
                    minimumApplique: calcul.periodeCreation.minimumApplique,
                }
                : null,
            exerciceClos: exercice.statut === client_1.StatutExercice.CLOTURE,
            brouillardGestion,
            impotDejaConstate: calcul.impotExerciceAu89,
            impotConstateAu89: calcul.impotConstateAu89,
            reintegrationsImpot: calcul.reintegrationsImpot,
            attestationRegime,
        });
        return { calcul, impotExercice, exercice, motifs };
    }
    async etat(tenantId, exerciceId) {
        const enPlace = await this.constatEnPlace(tenantId, exerciceId);
        const annulees = await this.prisma.constatImpotResultat.count({
            where: { tenantId, exerciceId, annuleeLe: { not: null } },
        });
        if (enPlace) {
            const calcul = await this.fiscalite.resultatFiscal(tenantId, exerciceId);
            const recalcule = ConstatImpotService_1.impotDeLExercice(calcul);
            const montant = Number(enPlace.montantImpot);
            const tropPaye = Number(enPlace.tropPayeLiquidation ?? 0);
            const ecart = recalcule.impotDu === null ? null : arrondir(recalcule.impotDu - montant);
            return {
                exerciceId,
                constat: {
                    id: enPlace.id,
                    montantImpot: montant,
                    minimumApplique: enPlace.minimumApplique,
                    montantImpute: Number(enPlace.montantImpute),
                    attestationRegime: enPlace.attestationRegime,
                    compteCharge: (0, ecriture_impot_resultat_1.compteDeLaCharge)(enPlace.minimumApplique),
                    ecriture: enPlace.ecriture,
                    createdAt: enPlace.createdAt,
                    impotRecalcule: recalcule.impotDu,
                    ecartAvecCalcul: ecart,
                    tropPayeLiquidation: tropPaye,
                    tropPayeRecalcule: recalcule.secondeCotisation ? recalcule.tropPaye : null,
                },
                proposition: null,
                motifsRefus: [],
                annulees,
            };
        }
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { formeJuridiqueSyscohada: true } });
        const { calcul, impotExercice, motifs } = await this.rejouer(tenantId, exerciceId, undefined);
        const conditionADeclarer = tenant?.formeJuridiqueSyscohada ? ecriture_impot_resultat_1.CONDITIONS_A_DECLARER[tenant.formeJuridiqueSyscohada] ?? null : null;
        const impot = impotExercice.impotDu ?? 0;
        const tropPaye = impotExercice.tropPaye;
        const imputation = (0, ecriture_impot_resultat_1.imputationAcomptes)({ declares: calcul.acomptesVerses, solde4492: calcul.acomptesAu4492, impot });
        return {
            exerciceId,
            constat: null,
            proposition: impotExercice.impotDu === null || (impotExercice.impotDu <= 0.005 && tropPaye <= 0.005)
                ? null
                : {
                    impot,
                    minimumApplique: impotExercice.minimumApplique,
                    explication: impotExercice.secondeCotisation
                        ? `Seconde cotisation spéciale de l'année de la dissolution · impôt calculé sur le total des bilans successifs moins la première cotisation (loi n° 23/053, art. 12, al. 4, et 13).`
                        : calcul.explication,
                    date: calcul.dateFin,
                    tropPaye,
                    lignes: (0, ecriture_impot_resultat_1.lignesConstat)(impot, impotExercice.minimumApplique, 0, tropPaye),
                    imputation: {
                        acomptesDeclares: calcul.acomptesVerses,
                        solde4492: calcul.acomptesAu4492,
                        montant: imputation.montant,
                        motifRefus: imputation.motifRefus,
                        lignes: imputation.montant > 0 ? (0, ecriture_impot_resultat_1.lignesConstat)(0, impotExercice.minimumApplique, imputation.montant) : [],
                    },
                    conditionADeclarer,
                    longueurMinAttestation: ecriture_impot_resultat_1.LONGUEUR_MIN_ATTESTATION,
                },
            motifsRefus: motifs,
            annulees,
        };
    }
    async compte(tenantId, numero) {
        const c = await this.prisma.compte.findFirst({
            where: { tenantId, numero },
            select: { id: true, typeCompte: true, estActif: true },
        });
        if (!c || c.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL || !c.estActif) {
            throw new common_1.BadRequestException(`Le compte ${numero} n'est pas ouvert en compte de détail actif dans le plan du dossier · l'écriture de l'impôt l'exige ` +
                '(AUDCIF Titre VII, comptes 89 et 44). Ouvrez-le ou réactivez-le dans Plan comptable.');
        }
        return c.id;
    }
    async journalOd(tenantId) {
        const od = await this.prisma.journal.findFirst({
            where: { tenantId, code: 'OD' },
            orderBy: [{ code: 'asc' }, { id: 'asc' }],
        });
        if (od)
            return { journal: od, repli: null };
        const general = await this.prisma.journal.findFirst({
            where: { tenantId, type: 'GENERAL' },
            orderBy: [{ code: 'asc' }, { id: 'asc' }],
        });
        if (!general) {
            throw new common_1.BadRequestException("Aucun journal des opérations diverses (code OD) ni journal de type général pour recevoir l'écriture de l'impôt · créez-en un dans Structure > Journaux.");
        }
        return {
            journal: general,
            repli: `Aucun journal de code OD dans le dossier · l'écriture est passée au journal général ${general.code}.`,
        };
    }
    async passer(tenantId, userId, exerciceId, dto) {
        const enPlace = await this.constatEnPlace(tenantId, exerciceId);
        if (enPlace) {
            throw new common_1.ConflictException(`L'impôt de cet exercice est déjà constaté (pièce n° ${enPlace.ecriture?.numeroPiece ?? '·'}) · annulez ce constat avant d'en passer un autre.`);
        }
        const attestation = dto.attestationRegime?.trim() || null;
        const { calcul, impotExercice, exercice, motifs } = await this.rejouer(tenantId, exerciceId, attestation);
        if (motifs.length > 0)
            throw new common_1.BadRequestException(motifs.join(' '));
        const impot = impotExercice.impotDu;
        const tropPaye = impotExercice.tropPaye;
        let impute = 0;
        if (dto.imputerAcomptes) {
            const imputation = (0, ecriture_impot_resultat_1.imputationAcomptes)({ declares: calcul.acomptesVerses, solde4492: calcul.acomptesAu4492, impot });
            if (imputation.motifRefus)
                throw new common_1.BadRequestException(imputation.motifRefus);
            impute = imputation.montant;
        }
        const lignes = (0, ecriture_impot_resultat_1.lignesConstat)(impot, impotExercice.minimumApplique, impute, tropPaye);
        const ids = new Map();
        for (const numero of new Set(lignes.map((l) => l.numero)))
            ids.set(numero, await this.compte(tenantId, numero));
        const { journal, repli } = await this.journalOd(tenantId);
        const ecriture = await this.ecritures.creer(tenantId, userId, {
            exerciceId,
            journalId: journal.id,
            date: exercice.dateFin.toISOString().slice(0, 10),
            libelle: impotExercice.secondeCotisation
                ? impot > 0.005
                    ? "Seconde cotisation spéciale de l'année de la dissolution (loi n° 23/053, art. 12, al. 4, et 13)"
                    : "Trop-payé de la première cotisation spéciale · créance sur l'État (loi n° 23/053, art. 12, al. 4, et 13)"
                : impotExercice.minimumApplique
                    ? "Impôt minimum de l'exercice (loi n° 23/053, art. 57)"
                    : "Impôt sur les bénéfices de l'exercice (loi n° 23/053, art. 56)",
            lignes: lignes.map((l) => ({
                compteId: ids.get(l.numero),
                ...(l.debit > 0 ? { debit: l.debit } : { credit: l.credit }),
                libelle: l.libelle,
            })),
        });
        try {
            const constat = await this.prisma.constatImpotResultat.create({
                data: {
                    tenantId,
                    exerciceId,
                    montantImpot: new client_1.Prisma.Decimal(impot),
                    minimumApplique: impotExercice.minimumApplique,
                    montantImpute: new client_1.Prisma.Decimal(impute),
                    tropPayeLiquidation: new client_1.Prisma.Decimal(tropPaye),
                    attestationRegime: attestation,
                    ecritureId: ecriture.id,
                    createdBy: userId,
                },
            });
            return {
                constat: { id: constat.id, montantImpot: impot, montantImpute: impute, tropPayeLiquidation: tropPaye },
                ecriture: { id: ecriture.id, numeroPiece: ecriture.numeroPiece },
                journal: { code: journal.code, repli },
            };
        }
        catch (err) {
            let orpheline = null;
            try {
                await this.ecritures.retirerCompensation(tenantId, ecriture.id);
            }
            catch (retrait) {
                orpheline = ` La pièce n° ${ecriture.numeroPiece ?? ecriture.id} créée par ce geste n'a pas pu être retirée · supprimez-la depuis le journal ${journal.code}, elle n'est rattachée à aucun constat.`;
                this.journal.error(`Écriture ${ecriture.id} (pièce ${ecriture.numeroPiece ?? '·'}) de l'impôt sur le résultat non retirée après l'échec du constat : ${retrait.message}`);
            }
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException(`L'impôt de cet exercice vient d'être constaté par un autre geste · relisez la fenêtre.${orpheline ?? ''}`);
            }
            throw err;
        }
    }
    async annuler(tenantId, userId, exerciceId, dto) {
        await this.fiscalite.tenantSyscohada(tenantId);
        const motif = dto.motif.trim();
        if (motif.length < 3)
            throw new common_1.BadRequestException("Le motif de l'annulation est obligatoire (AUDCIF art. 20).");
        const enPlace = await this.prisma.constatImpotResultat.findFirst({
            where: { tenantId, exerciceId, annuleeLe: null },
            include: {
                exercice: { select: { statut: true } },
                ecriture: { select: { id: true, numeroPiece: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } } },
            },
        });
        if (!enPlace)
            throw new common_1.NotFoundException("Aucun impôt constaté à annuler pour cet exercice.");
        if (enPlace.exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice est clôturé · l'écriture de l'impôt ne s'y annule plus. Une erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3), un rappel ou un dégrèvement ultérieur aux comptes 892 et 899.");
        }
        const objet = `l'écriture de l'impôt n° ${enPlace.ecriture?.numeroPiece ?? '·'}`;
        if (enPlace.ecriture) {
            const tenues = (0, lignes_tenues_1.motifLignesTenues)(enPlace.ecriture.lignes, objet, 'annuler', ", puis annulez l'impôt constaté");
            if (tenues)
                throw new common_1.BadRequestException(tenues);
        }
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const e = enPlace.ecriture;
            let annulation = { traitement: 'SANS_ECRITURE' };
            if (e) {
                const relues = await tx.ligneEcriture.findMany({
                    where: { ecritureId: e.id, ecriture: { tenantId } },
                    select: { lettre: true, lettrageId: true, rapprochementId: true },
                });
                const tenues = (0, lignes_tenues_1.motifLignesTenues)(relues, objet, 'annuler', ", puis annulez l'impôt constaté");
                if (tenues)
                    throw new common_1.BadRequestException(tenues);
                const statut = await tx.ecriture.findFirst({ where: { id: e.id, tenantId }, select: { statut: true } });
                if (!statut) {
                    throw new common_1.ConflictException(`L'écriture de l'impôt (pièce n° ${e.numeroPiece ?? e.id}) n'existe plus · relisez la fenêtre avant d'annuler.`);
                }
                if (statut.statut === client_1.StatutEcriture.BROUILLARD) {
                    annulation = { traitement: 'SUPPRIMEE', ecritureId: e.id, numeroPiece: e.numeroPiece };
                }
                else {
                    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, e.id, motif, tx);
                    annulation = {
                        traitement: 'INSCRITE_EN_NEGATIF',
                        ecritureId: e.id,
                        numeroPiece: e.numeroPiece,
                        negatifId: negatif.id,
                        negatifNumeroPiece: negatif.numeroPiece,
                    };
                }
            }
            try {
                await tx.constatImpotResultat.update({
                    where: { id: enPlace.id, tenantId, annuleeLe: null },
                    data: {
                        annuleeLe: new Date(),
                        annuleePar: userId,
                        motifAnnulation: motif,
                        annulation: annulation,
                        ...(annulation.traitement === 'SUPPRIMEE' ? { ecritureId: null } : {}),
                    },
                });
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                    throw new common_1.ConflictException('Cet impôt constaté est déjà annulé.');
                }
                throw err;
            }
            if (e && annulation.traitement === 'SUPPRIMEE') {
                await tx.ligneEcriture.deleteMany({ where: { ecritureId: e.id, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
                const r = await tx.ecriture.deleteMany({ where: { id: e.id, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
                if (r.count !== 1) {
                    throw new common_1.ConflictException("L'écriture a été validée pendant l'annulation · rien n'est supprimé. Relancez l'annulation · validée, elle s'inscrira en négatif (AUDCIF art. 20, al. 2).");
                }
            }
            return { annule: true, annulation };
        });
    }
};
exports.ConstatImpotService = ConstatImpotService;
exports.ConstatImpotService = ConstatImpotService = ConstatImpotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        fiscalite_service_1.FiscaliteService,
        ecriture_service_1.EcritureService])
], ConstatImpotService);
//# sourceMappingURL=constat-impot.service.js.map