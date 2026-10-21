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
exports.DemantelementService = exports.COMPTES_DEMANTELEMENT = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const systeme_minimal_1 = require("../../common/systeme-minimal");
const demantelement_1 = require("./demantelement");
const n = (v) => Number(v ?? 0);
const centimes = (x) => Math.round(x * 100) / 100;
exports.COMPTES_DEMANTELEMENT = {
    provision: '1984',
    desactualisation: '6971',
    repriseExploitation: '7911',
    repriseFinanciere: '7971',
};
let DemantelementService = class DemantelementService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    valeurActualisee(coutFutur, tauxPourcent, annees) {
        if (!(coutFutur > 0) || !(tauxPourcent >= 0) || !(annees > 0)) {
            throw new common_1.BadRequestException("Indiquez le coût attendu, le taux d'actualisation et le nombre d'années jusqu'au démantèlement.");
        }
        return { valeurActualisee: (0, demantelement_1.valeurActualiseeDemantelement)(coutFutur, tauxPourcent, annees) };
    }
    async composant(tenantId, id) {
        const immo = await this.prisma.immobilisation.findFirst({
            where: { id, tenantId },
            select: {
                id: true,
                designation: true,
                typeComposant: true,
                immobilisationPrincipaleId: true,
                valeurOrigine: true,
                dateAcquisition: true,
                statut: true,
                ecritureAcquisitionId: true,
                coutFuturDemantelement: true,
                tauxActualisationDemantelementPourcent: true,
                mouvementsDemantelement: { orderBy: { date: 'asc' } },
            },
        });
        if (!immo)
            throw new common_1.NotFoundException('Immobilisation introuvable');
        const credit1984 = immo.ecritureAcquisitionId
            ? await this.prisma.ligneEcriture.count({
                where: {
                    ecritureId: immo.ecritureAcquisitionId,
                    ecriture: { tenantId },
                    credit: { gt: 0 },
                    compte: { tenantId, numero: { startsWith: exports.COMPTES_DEMANTELEMENT.provision } },
                },
            })
            : 0;
        const estComposantDemantelement = !!immo.immobilisationPrincipaleId && immo.typeComposant === client_1.TypeComposant.DEMANTELEMENT;
        const desactualisations = immo.mouvementsDemantelement.filter((m) => m.nature === client_1.NatureMouvementDemantelement.DESACTUALISATION);
        const reprise = immo.mouvementsDemantelement.find((m) => m.nature === client_1.NatureMouvementDemantelement.REPRISE) ?? null;
        return {
            immo,
            entreParLaProvision: credit1984 > 0,
            repris: !immo.ecritureAcquisitionId,
            estComposantDemantelement,
            desactualisations,
            reprise,
        };
    }
    async regime(tenantId) {
        return this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, systemeComptableSyscohada: true, jeuEtatsFinanciersSycebnl: true },
        });
    }
    async exercicesManquants(tenantId, c, exercice) {
        const anterieurs = await this.prisma.exercice.findMany({
            where: { tenantId, dateFin: { gte: c.immo.dateAcquisition }, dateDebut: { lt: exercice.dateDebut } },
            select: { id: true, dateDebut: true, dateFin: true },
            orderBy: { dateDebut: 'asc' },
            take: 50,
        });
        const passes = new Set(c.desactualisations.map((m) => m.exerciceId));
        return anterieurs
            .filter((e) => !passes.has(e.id))
            .map((e) => `l'exercice du ${e.dateDebut.toISOString().slice(0, 10)} au ${e.dateFin.toISOString().slice(0, 10)}`);
    }
    async compte(tenantId, racine) {
        const c = await this.prisma.compte.findFirst({
            where: { tenantId, numero: { startsWith: racine }, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true },
            orderBy: { numero: 'asc' },
            select: { id: true, numero: true },
        });
        if (!c)
            throw new common_1.BadRequestException(`Aucun compte ${racine} de détail au plan du dossier · ouvrez-le d'abord.`);
        return c;
    }
    async etat(tenantId, id, exerciceId) {
        const c = await this.composant(tenantId, id);
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        const [proposition, regime] = await Promise.all([this.proposition(tenantId, c, exercice), this.regime(tenantId)]);
        const cumul = centimes(c.desactualisations.reduce((s, m) => s + n(m.montant), 0));
        return {
            repriseFaite: !!c.reprise,
            composantRepris: c.repris,
            systemeMinimal: !!(0, systeme_minimal_1.motifRefusProvisionSmt)(regime),
            provisionInitiale: c.entreParLaProvision ? n(c.immo.valeurOrigine) : null,
            cumulDesactualisations: cumul,
            provision: c.entreParLaProvision && !c.reprise ? centimes(n(c.immo.valeurOrigine) + cumul) : 0,
            coutFutur: c.immo.coutFuturDemantelement != null ? n(c.immo.coutFuturDemantelement) : null,
            tauxPourcent: c.immo.tauxActualisationDemantelementPourcent != null ? n(c.immo.tauxActualisationDemantelementPourcent) : null,
            mouvements: c.immo.mouvementsDemantelement.map((m) => ({
                id: m.id,
                nature: m.nature,
                date: m.date,
                montant: n(m.montant),
                repriseExploitation: m.repriseExploitation != null ? n(m.repriseExploitation) : null,
                repriseFinanciere: m.repriseFinanciere != null ? n(m.repriseFinanciere) : null,
                motifReprise: m.motifReprise,
            })),
            desactualisation: proposition,
            reprise: c.entreParLaProvision && !c.repris && !c.reprise
                ? (0, demantelement_1.ventilationReprise)(n(c.immo.valeurOrigine), c.desactualisations.map((m) => n(m.montant)))
                : null,
        };
    }
    async proposition(tenantId, c, exercice, arreteAu) {
        const mois = (0, demantelement_1.moisDeDesactualisation)(exercice, c.immo.dateAcquisition, arreteAu);
        const [manquants, regime] = await Promise.all([this.exercicesManquants(tenantId, c, exercice), this.regime(tenantId)]);
        const passes = new Set(c.desactualisations.map((m) => m.exerciceId));
        const taux = c.immo.tauxActualisationDemantelementPourcent != null ? n(c.immo.tauxActualisationDemantelementPourcent) : null;
        const motif = (0, demantelement_1.motifRefusDesactualisation)({
            estComposantDemantelement: c.estComposantDemantelement,
            refusSystemeMinimal: (0, systeme_minimal_1.motifRefusProvisionSmt)(regime),
            repris: c.repris,
            entreParLaProvision: c.entreParLaProvision,
            tauxPourcent: taux,
            exerciceOuvert: exercice.statut === client_1.StatutExercice.OUVERT,
            dejaPassee: passes.has(exercice.id),
            repriseFaite: !!c.reprise,
            enService: c.immo.statut === client_1.StatutImmobilisation.EN_SERVICE,
            mois,
            exercicesManquants: manquants,
        });
        const provisionOuverture = centimes(n(c.immo.valeurOrigine) +
            c.desactualisations.filter((m) => !(m.exerciceId === exercice.id)).reduce((s, m) => s + n(m.montant), 0));
        const montant = taux == null
            ? 0
            : (0, demantelement_1.desactualisationExercice)({
                provisionOuverture,
                tauxPourcent: taux,
                mois,
                coutFutur: c.immo.coutFuturDemantelement != null ? n(c.immo.coutFuturDemantelement) : null,
            });
        return { mois, provisionOuverture, montant, motifRefus: motif ?? (montant <= 0 ? 'Rien à désactualiser pour cet exercice.' : null) };
    }
    async desactualiser(tenantId, userId, id, dto) {
        const c = await this.composant(tenantId, id);
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        const p = await this.proposition(tenantId, c, exercice);
        if (p.motifRefus)
            throw new common_1.BadRequestException(p.motifRefus);
        const [dotation, provision] = await Promise.all([
            this.compte(tenantId, exports.COMPTES_DEMANTELEMENT.desactualisation),
            this.compte(tenantId, exports.COMPTES_DEMANTELEMENT.provision),
        ]);
        const date = exercice.dateFin.toISOString().slice(0, 10);
        const ecriture = await this.ecritures.creer(tenantId, userId, {
            exerciceId: exercice.id,
            journalId: dto.journalId,
            date,
            libelle: `Désactualisation de la provision pour démantèlement · ${c.immo.designation}`.slice(0, 190),
            lignes: [
                { compteId: dotation.id, debit: p.montant, credit: 0 },
                { compteId: provision.id, debit: 0, credit: p.montant },
            ],
        });
        return this.enregistrer(tenantId, ecriture.id, {
            tenantId,
            immobilisationId: id,
            exerciceId: exercice.id,
            nature: client_1.NatureMouvementDemantelement.DESACTUALISATION,
            date: new Date(date),
            montant: p.montant,
            ecritureId: ecriture.id,
            createdBy: userId,
        });
    }
    async reprendre(tenantId, userId, id, dto) {
        const c = await this.composant(tenantId, id);
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        const date = new Date(dto.date.slice(0, 10));
        const regime = await this.regime(tenantId);
        const auSmt = !!(0, systeme_minimal_1.motifRefusProvisionSmt)(regime);
        const taux = c.immo.tauxActualisationDemantelementPourcent != null ? n(c.immo.tauxActualisationDemantelementPourcent) : null;
        const coutFutur = c.immo.coutFuturDemantelement != null ? n(c.immo.coutFuturDemantelement) : null;
        const provisionAvant = centimes(n(c.immo.valeurOrigine) + c.desactualisations.reduce((s, m) => s + n(m.montant), 0));
        const doitDesactualiser = !auSmt && (0, demantelement_1.resteADesactualiser)({ tauxPourcent: taux, provision: provisionAvant, coutFutur });
        const courante = c.desactualisations.find((m) => m.exerciceId === exercice.id) ?? null;
        const motif = (0, demantelement_1.motifRefusReprise)({
            estComposantDemantelement: c.estComposantDemantelement,
            repris: c.repris,
            entreParLaProvision: c.entreParLaProvision,
            exerciceOuvert: exercice.statut === client_1.StatutExercice.OUVERT,
            repriseFaite: !!c.reprise,
            dateDansExercice: date >= exercice.dateDebut && date <= exercice.dateFin,
            exercicesManquants: doitDesactualiser ? await this.exercicesManquants(tenantId, c, exercice) : [],
            desactualiseeJusquAu: courante && courante.date > date ? courante.date.toISOString().slice(0, 10) : null,
        });
        if (motif)
            throw new common_1.BadRequestException(motif);
        const courue = doitDesactualiser && !courante
            ? (0, demantelement_1.desactualisationExercice)({
                provisionOuverture: provisionAvant,
                tauxPourcent: taux,
                mois: (0, demantelement_1.moisDeDesactualisation)(exercice, c.immo.dateAcquisition, date),
                coutFutur,
            })
            : 0;
        const v = (0, demantelement_1.ventilationReprise)(n(c.immo.valeurOrigine), [...c.desactualisations.map((m) => n(m.montant)), courue]);
        const [provision, exploitation, financiere, dotation] = await Promise.all([
            this.compte(tenantId, exports.COMPTES_DEMANTELEMENT.provision),
            this.compte(tenantId, exports.COMPTES_DEMANTELEMENT.repriseExploitation),
            v.financiere > 0 ? this.compte(tenantId, exports.COMPTES_DEMANTELEMENT.repriseFinanciere) : Promise.resolve(null),
            courue > 0 ? this.compte(tenantId, exports.COMPTES_DEMANTELEMENT.desactualisation) : Promise.resolve(null),
        ]);
        let mouvementCouru = null;
        if (courue > 0 && dotation) {
            const ecr = await this.ecritures.creer(tenantId, userId, {
                exerciceId: exercice.id,
                journalId: dto.journalId,
                date: dto.date.slice(0, 10),
                libelle: `Désactualisation courue jusqu'à la reprise · ${c.immo.designation}`.slice(0, 190),
                lignes: [
                    { compteId: dotation.id, debit: courue, credit: 0 },
                    { compteId: provision.id, debit: 0, credit: courue },
                ],
            });
            const m = await this.enregistrer(tenantId, ecr.id, {
                tenantId,
                immobilisationId: id,
                exerciceId: exercice.id,
                nature: client_1.NatureMouvementDemantelement.DESACTUALISATION,
                date,
                montant: courue,
                ecritureId: ecr.id,
                createdBy: userId,
            });
            mouvementCouru = { id: m.id, ecritureId: ecr.id };
        }
        try {
            const ecriture = await this.ecritures.creer(tenantId, userId, {
                exerciceId: exercice.id,
                journalId: dto.journalId,
                date: dto.date.slice(0, 10),
                libelle: `Reprise de la provision pour démantèlement · ${c.immo.designation}`.slice(0, 190),
                lignes: [
                    { compteId: provision.id, debit: v.total, credit: 0 },
                    { compteId: exploitation.id, debit: 0, credit: v.exploitation },
                    ...(financiere ? [{ compteId: financiere.id, debit: 0, credit: v.financiere }] : []),
                ],
            });
            return await this.enregistrer(tenantId, ecriture.id, {
                tenantId,
                immobilisationId: id,
                exerciceId: exercice.id,
                nature: client_1.NatureMouvementDemantelement.REPRISE,
                date,
                montant: v.total,
                repriseExploitation: v.exploitation,
                repriseFinanciere: v.financiere,
                motifReprise: dto.motif,
                ecritureId: ecriture.id,
                createdBy: userId,
            });
        }
        catch (err) {
            if (mouvementCouru) {
                const { id: mvId, ecritureId } = mouvementCouru;
                await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => tx.mouvementDemantelement.delete({ where: { id: mvId } }));
                await this.ecritures.retirerCompensation(tenantId, ecritureId);
            }
            throw err;
        }
    }
    async enregistrer(tenantId, ecritureId, data) {
        try {
            const ligne = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => tx.mouvementDemantelement.create({ data }));
            return { ...ligne, montant: n(ligne.montant) };
        }
        catch (err) {
            await this.ecritures.retirerCompensation(tenantId, ecritureId);
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('Ce mouvement de la provision est déjà passé pour cet exercice.');
            }
            throw err;
        }
    }
};
exports.DemantelementService = DemantelementService;
exports.DemantelementService = DemantelementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], DemantelementService);
//# sourceMappingURL=demantelement.service.js.map