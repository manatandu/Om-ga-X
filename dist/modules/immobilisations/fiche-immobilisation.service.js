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
var FicheImmobilisationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FicheImmobilisationService = void 0;
const common_1 = require("@nestjs/common");
const pieces_jointes_ecriture_1 = require("../comptabilite/pieces-jointes-ecriture");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const references_1 = require("../../common/suppression/references");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const lignes_tenues_1 = require("../comptabilite/lignes-tenues");
const immobilisation_service_1 = require("./immobilisation.service");
const bareme_fiscal_1 = require("./bareme-fiscal");
const fiche_immobilisation_1 = require("./fiche-immobilisation");
const jourIso = (d) => d.toISOString().slice(0, 10);
const n = (x) => Number(x ?? 0);
let FicheImmobilisationService = FicheImmobilisationService_1 = class FicheImmobilisationService {
    constructor(prisma, immobilisations, ecritures) {
        this.prisma = prisma;
        this.immobilisations = immobilisations;
        this.ecritures = ecritures;
        this.journal = new common_1.Logger(FicheImmobilisationService_1.name);
    }
    async etat(tenantId, id) {
        const lu = await this.lire(this.prisma, tenantId, id);
        const motifEffet = (0, fiche_immobilisation_1.motifRefusModificationAEffet)(lu.etat);
        const motifSuppression = (0, fiche_immobilisation_1.motifRefusSuppression)(lu.etat);
        const f = lu.fiche;
        return {
            valeurs: {
                designation: f.designation,
                numeroInventaire: f.numeroInventaire,
                natureFiscaleCle: f.natureFiscaleCle,
                compteImmobilisationId: f.compteImmobilisationId,
                compteContrepartieId: lu.contrepartieId,
                dateAcquisition: jourIso(f.dateAcquisition),
                dateMiseEnService: f.dateMiseEnService ? jourIso(f.dateMiseEnService) : null,
                valeurOrigine: n(f.valeurOrigine),
                valeurResiduelle: n(f.valeurResiduelle),
                dureeAmortissementAns: f.dureeAmortissementAns,
                modeAmortissement: f.modeAmortissement,
                unitesOeuvrePrevues: f.unitesOeuvrePrevues === null ? null : n(f.unitesOeuvrePrevues),
                uniteOeuvreLibelle: f.uniteOeuvreLibelle,
                amortissementAnterieur: n(f.amortissementAnterieur),
                repris: !f.ecritureAcquisitionId,
            },
            neeDUneEcriturePassee: lu.etat.neeDUneEcriturePassee,
            acquisition: lu.acquisition
                ? { numeroPiece: lu.acquisition.numeroPiece, statut: lu.acquisition.statut, journalId: lu.acquisition.journalId }
                : null,
            modificationAEffet: { ouverte: motifEffet === null, motif: motifEffet },
            suppression: { ouverte: motifSuppression === null, motif: motifSuppression },
        };
    }
    async modifier(tenantId, userId, id, dto) {
        const lu = await this.lire(this.prisma, tenantId, id);
        const f = lu.fiche;
        const libres = {};
        if (dto.designation !== undefined)
            libres.designation = dto.designation.trim();
        if (dto.numeroInventaire !== undefined)
            libres.numeroInventaire = dto.numeroInventaire?.trim() || null;
        if (dto.natureFiscaleCle !== undefined)
            libres.natureFiscaleCle = dto.natureFiscaleCle?.trim() || null;
        const aEffet = (0, fiche_immobilisation_1.champsAEffetDemandes)(dto);
        if (aEffet.length === 0) {
            if (Object.keys(libres).length === 0)
                throw new common_1.BadRequestException('Rien à modifier · indiquez au moins un champ.');
            const nature = libres.natureFiscaleCle;
            if (nature && !(0, bareme_fiscal_1.natureDuBareme)(nature)) {
                throw new common_1.BadRequestException(`Nature « ${nature} » absente du barème de l'arrêté n° 013/CAB/MIN/FINANCES/2025 (art. 2).`);
            }
            await this.prisma.immobilisation.update({ where: { id: f.id }, data: libres });
            return this.etat(tenantId, id);
        }
        const motif = (0, fiche_immobilisation_1.motifRefusModificationAEffet)(lu.etat);
        if (motif)
            throw new common_1.BadRequestException(motif);
        const repris = !f.ecritureAcquisitionId;
        const dateAcquisition = dto.dateAcquisition ?? jourIso(f.dateAcquisition);
        const exerciceId = await this.exercicePourLaFiche(tenantId, dateAcquisition, repris, lu.acquisition?.exerciceId ?? null);
        const fusion = {
            compteImmobilisationId: dto.compteImmobilisationId ?? f.compteImmobilisationId,
            designation: libres.designation ?? f.designation,
            numeroInventaire: (dto.numeroInventaire !== undefined ? dto.numeroInventaire?.trim() || undefined : f.numeroInventaire) ?? undefined,
            lieuId: f.lieuId ?? undefined,
            dateAcquisition,
            dateMiseEnService: dto.dateMiseEnService !== undefined ? dto.dateMiseEnService : f.dateMiseEnService ? jourIso(f.dateMiseEnService) : null,
            compteEnCoursId: f.compteEnCoursId ?? undefined,
            natureFiscaleCle: dto.natureFiscaleCle !== undefined ? dto.natureFiscaleCle : f.natureFiscaleCle,
            valeurOrigine: dto.valeurOrigine ?? n(f.valeurOrigine),
            valeurResiduelle: dto.valeurResiduelle ?? n(f.valeurResiduelle),
            dureeAmortissementAns: dto.dureeAmortissementAns ?? f.dureeAmortissementAns,
            modeAmortissement: dto.modeAmortissement ?? f.modeAmortissement,
            unitesOeuvrePrevues: dto.unitesOeuvrePrevues ?? (f.unitesOeuvrePrevues === null ? undefined : n(f.unitesOeuvrePrevues)),
            uniteOeuvreLibelle: dto.uniteOeuvreLibelle ?? f.uniteOeuvreLibelle ?? undefined,
            amortissementAnterieur: dto.amortissementAnterieur ?? n(f.amortissementAnterieur),
            repris: repris || undefined,
            compteContrepartieId: repris ? undefined : (dto.compteContrepartieId ?? lu.contrepartieId ?? undefined),
            exerciceId,
            journalId: repris ? undefined : (lu.acquisition?.journalId ?? undefined),
            immobilisationPrincipaleId: f.immobilisationPrincipaleId ?? undefined,
            typeComposant: f.typeComposant ?? undefined,
            justificationDecomposition: f.justificationDecomposition ?? undefined,
            dernierRenouvellement: f.immobilisationPrincipaleId && n(f.valeurResiduelle) > 0 ? true : undefined,
            dureeNonLimitee: f.dureeNonLimitee || undefined,
            justificationDureeNonLimitee: f.justificationDureeNonLimitee ?? undefined,
            fondementDureeDixAns: f.fondementDureeDixAns ?? undefined,
            reserveDePropriete: f.reserveDePropriete,
            criteresFraisDeveloppement: f.criteresFraisDeveloppement ?? undefined,
            dateReunionCriteresDeveloppement: f.dateReunionCriteresDeveloppement ? jourIso(f.dateReunionCriteresDeveloppement) : undefined,
            coutFuturDemantelement: f.coutFuturDemantelement === null ? undefined : n(f.coutFuturDemantelement),
            tauxActualisationDemantelementPourcent: f.tauxActualisationDemantelementPourcent === null ? undefined : n(f.tauxActualisationDemantelementPourcent),
        };
        const p = await this.immobilisations.preparerFiche(tenantId, fusion, { composantRemplaceId: f.composantRemplaceId ?? undefined });
        const libelleAcquisition = lu.acquisition?.libelle ?? `Acquisition · ${fusion.designation}`.slice(0, 190);
        const lignesAcquisition = [
            { compteId: p.compteEnCours?.id ?? p.famille.compteImmobilisationId, debit: fusion.valeurOrigine, credit: 0 },
            { compteId: fusion.compteContrepartieId, debit: 0, credit: fusion.valeurOrigine },
        ];
        const enPlace = !!lu.acquisition &&
            exerciceId === lu.acquisition.exerciceId &&
            !(lu.acquisition.journal.numerotation === client_1.NumerotationPiece.MENSUELLE && fusion.dateAcquisition.slice(0, 7) !== jourIso(lu.acquisition.date).slice(0, 7));
        const nouvelle = repris || enPlace
            ? null
            : await this.ecritures.creer(tenantId, userId, {
                exerciceId,
                journalId: fusion.journalId,
                date: fusion.dateAcquisition,
                libelle: libelleAcquisition,
                lignes: lignesAcquisition,
            });
        try {
            await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const relu = await this.lire(tx, tenantId, id);
                const encore = (0, fiche_immobilisation_1.motifRefusModificationAEffet)(relu.etat);
                if (encore)
                    throw new common_1.ConflictException(`La fiche a changé pendant la modification · ${encore}`);
                await tx.immobilisation.update({
                    where: { id: f.id },
                    data: {
                        designation: fusion.designation,
                        numeroInventaire: fusion.numeroInventaire ?? null,
                        natureFiscaleCle: p.natureFiscaleCle,
                        famille: { connect: { id: p.famille.id } },
                        compteImmobilisation: { connect: { id: p.famille.compteImmobilisationId } },
                        compteAmortissement: { connect: { id: p.famille.compteAmortissementId } },
                        compteDotation: { connect: { id: p.famille.compteDotationId } },
                        dateAcquisition: p.dateAcquisition,
                        dateMiseEnService: p.dateMiseEnService,
                        valeurOrigine: fusion.valeurOrigine,
                        valeurResiduelle: fusion.valeurResiduelle ?? 0,
                        dureeAmortissementAns: fusion.dureeAmortissementAns ?? p.famille.dureeAmortissementAns,
                        amortissementAnterieur: fusion.amortissementAnterieur ?? 0,
                        modeAmortissement: p.mode,
                        unitesOeuvrePrevues: p.mode === client_1.ModeAmortissement.UNITES_DOEUVRE ? fusion.unitesOeuvrePrevues : null,
                        uniteOeuvreLibelle: p.mode === client_1.ModeAmortissement.UNITES_DOEUVRE ? (fusion.uniteOeuvreLibelle?.trim() ?? null) : null,
                        reserveDePropriete: p.reserveDePropriete,
                        ...(nouvelle ? { ecritureAcquisition: { connect: { id: nouvelle.id } } } : {}),
                    },
                });
                if (enPlace && relu.acquisition) {
                    const fait = await this.ecritures.modifierPieceDuModule(tx, tenantId, relu.acquisition.id, {
                        date: fusion.dateAcquisition,
                        libelle: libelleAcquisition,
                        lignes: lignesAcquisition,
                    });
                    if (!fait)
                        throw new common_1.ConflictException("La pièce d'acquisition a changé pendant la modification · relancez-la.");
                }
                else if (relu.acquisition) {
                    if (nouvelle)
                        await (0, pieces_jointes_ecriture_1.reporterLesPieces)(tx, tenantId, relu.acquisition.id, nouvelle.id);
                    await tx.ligneEcriture.deleteMany({
                        where: { ecritureId: relu.acquisition.id, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } },
                    });
                    const r = await tx.ecriture.deleteMany({ where: { id: relu.acquisition.id, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
                    if (r.count !== 1) {
                        throw new common_1.ConflictException("L'écriture d'acquisition a été validée ou retirée pendant la modification · rien n'est modifié.");
                    }
                }
            });
        }
        catch (err) {
            if (nouvelle)
                await this.retirerEcritureOrpheline(tenantId, nouvelle.id);
            throw err;
        }
        return this.etat(tenantId, id);
    }
    async supprimer(tenantId, id) {
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const lu = await this.lire(tx, tenantId, id);
            const motif = (0, fiche_immobilisation_1.motifRefusSuppression)(lu.etat);
            if (motif)
                throw new common_1.BadRequestException(motif);
            const annulations = await tx.annulationTraitementImmobilisation.findMany({
                where: { tenantId, immobilisationId: id, ecritureOrigineId: null, ecritureNegatifId: null },
                select: { id: true },
                take: 1000,
            });
            for (const a of annulations)
                await tx.annulationTraitementImmobilisation.delete({ where: { id: a.id } });
            try {
                await tx.immobilisation.delete({ where: { id } });
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                    throw new common_1.ConflictException('La fiche a été retirée par un autre geste.');
                }
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
                    throw new common_1.ConflictException("La fiche a reçu un document ou un traitement pendant la suppression · rien n'est supprimé. Rechargez la fiche : " +
                        "retirez d'abord ce qui la porte (onglet Documents), ou mettez le bien en sommeil.");
                }
                throw err;
            }
            if (lu.acquisition && !lu.etat.neeDUneEcriturePassee) {
                await tx.ligneEcriture.deleteMany({ where: { ecritureId: lu.acquisition.id, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
                const e = await tx.ecriture.deleteMany({ where: { id: lu.acquisition.id, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
                if (e.count !== 1) {
                    throw new common_1.ConflictException("L'écriture d'acquisition a été validée pendant la suppression · la fiche est gardée.");
                }
            }
        });
        return { supprime: true };
    }
    async duplication(tenantId, id) {
        const f = await this.prisma.immobilisation.findFirst({ where: { id, tenantId } });
        if (!f)
            throw new common_1.NotFoundException('Immobilisation introuvable');
        return (0, fiche_immobilisation_1.propositionDeDuplication)({
            designation: f.designation,
            compteImmobilisationId: f.compteImmobilisationId,
            natureFiscaleCle: f.natureFiscaleCle,
            lieuId: f.lieuId,
            valeurOrigine: n(f.valeurOrigine),
            valeurResiduelle: n(f.valeurResiduelle),
            dureeAmortissementAns: f.dureeAmortissementAns,
            modeAmortissement: f.modeAmortissement,
            unitesOeuvrePrevues: f.unitesOeuvrePrevues === null ? null : n(f.unitesOeuvrePrevues),
            uniteOeuvreLibelle: f.uniteOeuvreLibelle,
        });
    }
    async lire(db, tenantId, id) {
        const fiche = await db.immobilisation.findFirst({ where: { id, tenantId } });
        if (!fiche)
            throw new common_1.NotFoundException('Immobilisation introuvable');
        const acquisition = fiche.ecritureAcquisitionId
            ? await db.ecriture.findFirst({
                where: { id: fiche.ecritureAcquisitionId, tenantId },
                select: {
                    id: true,
                    statut: true,
                    numeroPiece: true,
                    journalId: true,
                    exerciceId: true,
                    libelle: true,
                    date: true,
                    journal: { select: { numerotation: true } },
                    exercice: { select: { statut: true } },
                    lignes: { select: { compteId: true, debit: true, credit: true, lettre: true, lettrageId: true, rapprochementId: true } },
                },
            })
            : null;
        const refs = await (0, references_1.referencesVers)(db, 'Immobilisation', id, tenantId);
        const usages = refs.filter((r) => r.modele !== 'AnnulationTraitementImmobilisation' && r.modele !== 'PieceJointeImmobilisation');
        const documents = refs.filter((r) => r.modele === 'PieceJointeImmobilisation').reduce((s, r) => s + r.nombre, 0);
        const annulationsRetenant = await db.annulationTraitementImmobilisation.count({
            where: { tenantId, immobilisationId: id, OR: [{ ecritureOrigineId: { not: null } }, { ecritureNegatifId: { not: null } }] },
        });
        const credits = acquisition?.lignes.filter((l) => n(l.credit) > 0) ?? [];
        const contrepartieId = credits.length === 1 ? credits[0].compteId : null;
        const autresEcritures = [
            fiche.ecritureMiseEnServiceId ? "l'écriture de mise en service" : null,
            fiche.ecritureSortieId ? "l'écriture de sortie" : null,
            fiche.ecritureProduitCessionId ? 'le produit de cession' : null,
            fiche.ecritureSoldeDetteAleatoireId ? 'le solde de la dette aléatoire' : null,
            fiche.ecritureSortieEcartReevaluationId ? "le transfert de l'écart de réévaluation" : null,
        ].filter((x) => !!x);
        const neeDUneEcriturePassee = !!fiche.ligneAcquisitionId;
        const closQuiLaPorte = await this.exerciceClosQuiLaPorte(db, tenantId, fiche);
        const origineParticuliere = neeDUneEcriturePassee
            ? "d'une écriture déjà passée au journal"
            : fiche.natureAcquisitionAleatoire
                ? "d'une acquisition à prix aléatoire (rente viagère ou redevances)"
                : fiche.modaliteVentilation
                    ? "de la ventilation d'un prix global"
                    : acquisition && (acquisition.lignes.length !== 2 || !contrepartieId)
                        ? "d'une écriture d'acquisition à plusieurs contreparties (legs, location-acquisition ou opération du module)"
                        : null;
        const etat = {
            sortie: fiche.statut !== client_1.StatutImmobilisation.EN_SERVICE,
            autresEcritures,
            acquisition: acquisition
                ? {
                    validee: acquisition.statut !== client_1.StatutEcriture.BROUILLARD,
                    numeroPiece: acquisition.numeroPiece,
                    nombreLignes: acquisition.lignes.length,
                    exerciceClos: acquisition.exercice.statut === client_1.StatutExercice.CLOTURE,
                }
                : null,
            motifLignesTenues: acquisition
                ? (0, lignes_tenues_1.motifLignesTenues)(acquisition.lignes, "l'écriture d'acquisition", 'modifier ou supprimer la fiche')
                : null,
            origineParticuliere,
            neeDUneEcriturePassee,
            usages,
            annulationsRetenant,
            exerciceClosQuiLaPorte: closQuiLaPorte ? closQuiLaPorte.toISOString().slice(0, 10) : null,
            documents,
            renouvelle: fiche.composantRemplaceId
                ? ((await db.immobilisation.findFirst({ where: { id: fiche.composantRemplaceId, tenantId }, select: { designation: true } }))?.designation ?? '·')
                : null,
        };
        return { fiche, acquisition, contrepartieId, etat };
    }
    async exerciceClosQuiLaPorte(db, tenantId, fiche) {
        const clos = await db.exercice.findMany({
            where: { tenantId, statut: client_1.StatutExercice.CLOTURE, dateFin: { gte: fiche.dateAcquisition } },
            orderBy: { dateFin: 'asc' },
            select: { id: true, dateFin: true },
            take: 50,
        });
        if (clos.length === 0)
            return null;
        const [maillons, premier] = await Promise.all([
            db.evenementAudit.findMany({
                where: {
                    tenantId,
                    entite: 'Exercice',
                    entiteId: { in: clos.map((e) => e.id) },
                    action: { in: [client_1.ActionAudit.CREATION, client_1.ActionAudit.MODIFICATION] },
                    apres: { path: ['statut'], equals: client_1.StatutExercice.CLOTURE },
                },
                orderBy: { rang: 'desc' },
                select: { entiteId: true, horodatage: true, action: true, avant: true },
                take: 500,
            }),
            db.evenementAudit.findFirst({ where: { tenantId }, orderBy: { rang: 'asc' }, select: { horodatage: true } }),
        ]);
        const etaitClos = (avant) => !!avant && typeof avant === 'object' && avant.statut === client_1.StatutExercice.CLOTURE;
        const clotures = maillons.filter((m) => m.action === client_1.ActionAudit.CREATION || !etaitClos(m.avant));
        return (0, fiche_immobilisation_1.exerciceClosQuiPorteLaFiche)({
            ficheCreeeLe: fiche.createdAt,
            debutDuJournal: premier?.horodatage ?? null,
            clos: clos.map((e) => ({ dateFin: e.dateFin, clotures: clotures.filter((m) => m.entiteId === e.id).map((m) => m.horodatage) })),
        });
    }
    async exercicePourLaFiche(tenantId, dateAcquisition, repris, actuel) {
        const d = new Date(dateAcquisition);
        if (repris) {
            const ex = await this.prisma.exercice.findFirst({
                where: { tenantId, dateDebut: { gt: d } },
                orderBy: { dateDebut: 'asc' },
                select: { id: true },
            });
            if (!ex)
                throw new common_1.BadRequestException("Un bien repris est acquis avant l'ouverture d'un exercice du dossier · aucun ne s'ouvre après cette date.");
            return ex.id;
        }
        const ex = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { lte: d }, dateFin: { gte: d } },
            select: { id: true, statut: true },
        });
        if (!ex)
            throw new common_1.BadRequestException(`Aucun exercice du dossier ne couvre le ${dateAcquisition}.`);
        if (ex.statut === client_1.StatutExercice.CLOTURE && ex.id !== actuel) {
            throw new common_1.BadRequestException(`L'exercice qui couvre le ${dateAcquisition} est clôturé · l'acquisition ne s'y porte plus.`);
        }
        return ex.id;
    }
    async retirerEcritureOrpheline(tenantId, ecritureId) {
        try {
            await this.prisma.ligneEcriture.deleteMany({ where: { ecritureId, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
            await this.prisma.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
        }
        catch (e) {
            this.journal.error(`Modification d'une fiche · écriture ${ecritureId} à retirer à la main du brouillard · ${String(e)}`);
        }
    }
};
exports.FicheImmobilisationService = FicheImmobilisationService;
exports.FicheImmobilisationService = FicheImmobilisationService = FicheImmobilisationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        immobilisation_service_1.ImmobilisationService,
        ecriture_service_1.EcritureService])
], FicheImmobilisationService);
//# sourceMappingURL=fiche-immobilisation.service.js.map