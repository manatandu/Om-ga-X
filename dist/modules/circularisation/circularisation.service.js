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
var CircularisationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircularisationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
let CircularisationService = CircularisationService_1 = class CircularisationService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    static racinesDuCycle(cycle) {
        switch (cycle) {
            case client_1.CycleCircularisation.BANQUES:
                return ['52', '53'];
            case client_1.CycleCircularisation.FOURNISSEURS:
                return ['40'];
            case client_1.CycleCircularisation.CLIENTS_ADHERENTS:
                return ['41'];
            case client_1.CycleCircularisation.AUTRES_TIERS:
                return ['42', '43', '44', '47'];
            default:
                return [];
        }
    }
    static estDepouillee(statuts) {
        return statuts.length > 0 && statuts.every((s) => CircularisationService_1.ISSUES_DEPOUILLEMENT.includes(s));
    }
    async campagne(tenantId, id, statutsAdmis) {
        const c = await this.prisma.campagneCircularisation.findFirst({ where: { id, tenantId } });
        if (!c)
            throw new common_1.NotFoundException('Campagne de circularisation introuvable.');
        if (statutsAdmis && !statutsAdmis.includes(c.statut)) {
            throw new common_1.ForbiddenException(`Cette campagne est au statut ${c.statut} · l'opération demandée n'est possible qu'en ${statutsAdmis.join(' ou ')}.`);
        }
        return c;
    }
    async creer(tenantId, userId, dto) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable.');
        const dateArrete = new Date(dto.dateArrete);
        if (Number.isNaN(dateArrete.getTime()) || dateArrete < exercice.dateDebut || dateArrete > exercice.dateFin) {
            throw new common_1.BadRequestException(`La date d'arrêté doit tomber dans l'exercice (du ${exercice.dateDebut.toISOString().slice(0, 10)} au ` +
                `${exercice.dateFin.toISOString().slice(0, 10)}) · c'est à cette date que les soldes sont lus et confirmés.`);
        }
        if (dto.forme === client_1.FormeConfirmation.NEGATIVE) {
            const declarees = new Set(dto.conditionsNegativeReunies ?? []);
            const manquantes = CircularisationService_1.CONDITIONS_NEGATIVE.filter((c) => !declarees.has(c));
            if (manquantes.length > 0) {
                throw new common_1.BadRequestException("ISA 505 § 15 · une demande NÉGATIVE ne peut être la seule procédure de substance que si les quatre conditions sont réunies, et elles le sont cumulativement. " +
                    `Non déclarée(s) : ${manquantes.join(', ')}. ` +
                    'À défaut, utiliser la forme positive · « negative confirmations provide less persuasive audit evidence than positive confirmations ».');
            }
        }
        return this.prisma.campagneCircularisation.create({
            data: {
                tenantId,
                exerciceId: dto.exerciceId,
                libelle: dto.libelle.trim(),
                dateArrete,
                cycle: dto.cycle,
                forme: dto.forme ?? client_1.FormeConfirmation.POSITIVE,
                methodeSelection: dto.methodeSelection?.trim() || null,
                conditionsNegativeReunies: dto.conditionsNegativeReunies ?? [],
                createdBy: userId,
            },
        });
    }
    async soldesDuCycle(tenantId, campagne) {
        const racines = CircularisationService_1.racinesDuCycle(campagne.cycle);
        const { lignes } = await this.ecritures.balance(tenantId, campagne.exerciceId, false, campagne.dateArrete);
        const duCycle = lignes
            .filter((l) => l.typeCompte !== 'TOTAL' && racines.some((r) => l.numero.startsWith(r)))
            .map((l) => ({ compteId: l.compteId, numero: l.numero, intitule: l.intitule, solde: l.solde }));
        const nonNuls = duCycle.filter((l) => Math.abs(l.solde) > 0.005);
        return {
            racines,
            lignes,
            candidats: nonNuls.sort((a, b) => Math.abs(b.solde) - Math.abs(a.solde)),
            total: nonNuls.reduce((t, c) => t + Math.abs(c.solde), 0),
        };
    }
    async echantillonPropose(tenantId, campagneId) {
        const campagne = await this.campagne(tenantId, campagneId);
        const { racines, candidats, total } = await this.soldesDuCycle(tenantId, campagne);
        const deja = await this.prisma.demandeConfirmation.findMany({
            where: { tenantId, campagneId },
            select: { compteId: true },
        });
        const retenus = new Set(deja.map((d) => d.compteId));
        return {
            cycle: campagne.cycle,
            racines,
            totalCycle: Number(total.toFixed(2)),
            candidats: candidats.map((c) => ({
                ...c,
                solde: Number(c.solde.toFixed(2)),
                poids: total > 0 ? Number(((Math.abs(c.solde) / total) * 100).toFixed(2)) : 0,
                dejaRetenu: retenus.has(c.compteId),
            })),
        };
    }
    async creerDemande(tenantId, campagneId, dto) {
        const campagne = await this.campagne(tenantId, campagneId, [client_1.StatutCampagneCircularisation.PREPARATION]);
        const compte = await this.prisma.compte.findFirst({ where: { id: dto.compteId, tenantId } });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable.');
        const deja = await this.prisma.demandeConfirmation.findFirst({
            where: { tenantId, campagneId, compteId: dto.compteId },
            select: { destinataire: true },
        });
        if (deja) {
            throw new common_1.ConflictException(`Le compte ${compte.numero} a déjà sa demande dans cette campagne (${deja.destinataire}) · une seconde lettre ` +
                'sur le même solde compterait deux fois la même confirmation.');
        }
        const { lignes } = await this.soldesDuCycle(tenantId, campagne);
        const ligne = lignes.find((l) => l.compteId === dto.compteId);
        const solde = dto.soldeAConfirmer ?? Number((ligne?.solde ?? 0).toFixed(2));
        return this.prisma.demandeConfirmation.create({
            data: {
                tenantId,
                campagneId,
                compteId: dto.compteId,
                tiersId: dto.tiersId ?? null,
                destinataire: dto.destinataire.trim(),
                adresse: dto.adresse?.trim() || null,
                soldeAConfirmer: solde,
            },
        });
    }
    async retirerDemande(tenantId, demandeId) {
        const demande = await this.prisma.demandeConfirmation.findFirst({
            where: { id: demandeId, tenantId },
            include: { campagne: { select: { statut: true } } },
        });
        if (!demande)
            throw new common_1.NotFoundException('Demande introuvable.');
        if (demande.campagne.statut === client_1.StatutCampagneCircularisation.CLOTUREE) {
            throw new common_1.ForbiddenException('La campagne est close · ses demandes ne se retirent plus.');
        }
        if (demande.statut !== client_1.StatutDemandeConfirmation.A_ENVOYER) {
            throw new common_1.BadRequestException('Cette lettre est partie · elle ne se retire pas, elle se classe (réponse reçue, sans réponse ou non distribuée).');
        }
        await this.prisma.demandeConfirmation.delete({ where: { id: demande.id } });
        await this.suivreDepouillement(tenantId, demande.campagneId, demande.campagne.statut);
        return { retiree: true };
    }
    async envoyer(tenantId, campagneId, dto) {
        const campagne = await this.campagne(tenantId, campagneId, [
            client_1.StatutCampagneCircularisation.PREPARATION,
            client_1.StatutCampagneCircularisation.ENVOYEE,
        ]);
        const nombre = await this.prisma.demandeConfirmation.count({ where: { tenantId, campagneId } });
        if (nombre === 0)
            throw new common_1.BadRequestException('Aucune demande dans cette campagne.');
        const quand = dto.date ? new Date(dto.date) : new Date();
        const relance = campagne.statut === client_1.StatutCampagneCircularisation.ENVOYEE;
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.demandeConfirmation.updateMany({
                where: {
                    tenantId,
                    campagneId,
                    statut: relance ? client_1.StatutDemandeConfirmation.ENVOYEE : client_1.StatutDemandeConfirmation.A_ENVOYER,
                },
                data: relance
                    ? { statut: client_1.StatutDemandeConfirmation.RELANCEE, relanceeLe: quand }
                    : { statut: client_1.StatutDemandeConfirmation.ENVOYEE, envoyeeLe: quand },
            });
            await tx.campagneCircularisation.update({
                where: { id: campagneId },
                data: relance
                    ? { statut: client_1.StatutCampagneCircularisation.RELANCEE, relanceeLe: quand }
                    : { statut: client_1.StatutCampagneCircularisation.ENVOYEE, envoyeeLe: quand },
            });
        });
        return this.consulter(tenantId, campagneId);
    }
    async depouiller(tenantId, demandeId, dto) {
        const demande = await this.prisma.demandeConfirmation.findFirst({
            where: { id: demandeId, tenantId },
            include: { campagne: true },
        });
        if (!demande)
            throw new common_1.NotFoundException('Demande introuvable.');
        if (demande.campagne.statut === client_1.StatutCampagneCircularisation.CLOTUREE) {
            throw new common_1.ForbiddenException('La campagne est close · son dépouillement ne se rouvre pas.');
        }
        if (!CircularisationService_1.ISSUES_DEPOUILLEMENT.includes(dto.statut)) {
            throw new common_1.BadRequestException('Le dépouillement classe une lettre partie : réponse reçue, sans réponse ou non distribuée. « Envoyée » et ' +
                '« relancée » se posent par l’envoi, jamais ici.');
        }
        if (demande.statut === client_1.StatutDemandeConfirmation.A_ENVOYER) {
            throw new common_1.BadRequestException('Cette lettre n’est pas partie · elle ne se classe ni en réponse ni en non-réponse. Envoyez-la, ou retirez-la de la campagne.');
        }
        const classee = await this.classer(demandeId, demande.soldeAConfirmer, dto);
        await this.suivreDepouillement(tenantId, demande.campagneId, demande.campagne.statut);
        return classee;
    }
    async classer(demandeId, soldeAConfirmer, dto) {
        if (dto.statut === client_1.StatutDemandeConfirmation.REPONSE_RECUE) {
            if (dto.soldeConfirme === undefined || dto.soldeConfirme === null) {
                throw new common_1.BadRequestException("Une réponse reçue porte un solde confirmé · zéro EST une réponse (« je ne vous dois rien »), l'absence n'en est pas une.");
            }
            const ecart = Number((dto.soldeConfirme - Number(soldeAConfirmer)).toFixed(2));
            if (Math.abs(ecart) > 0.005 && !dto.natureEcart) {
                throw new common_1.BadRequestException(`Écart de ${ecart} à qualifier · ISA 505 § 14, « the auditor shall INVESTIGATE exceptions to determine whether or not they are indicative of misstatements ». ` +
                    'Le § A22 rappelle que certains écarts n’en sont pas : délai, mesure, erreur matérielle. Choisir la nature, et dire ce que l’investigation a montré.');
            }
            if (Math.abs(ecart) > 0.005 && !dto.investigation?.trim()) {
                throw new common_1.BadRequestException("Un écart qualifié porte le résultat de son investigation · sans lui, il est classé, pas investigué.");
            }
            return this.prisma.demandeConfirmation.update({
                where: { id: demandeId },
                data: {
                    statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE,
                    recueLe: dto.date ? new Date(dto.date) : new Date(),
                    soldeConfirme: dto.soldeConfirme,
                    ecart,
                    natureEcart: Math.abs(ecart) > 0.005 ? dto.natureEcart : null,
                    investigation: dto.investigation?.trim() || null,
                    reponseIndirecte: dto.reponseIndirecte ?? false,
                    doutefiabilite: dto.reponseIndirecte
                        ? (dto.doutefiabilite?.trim() ||
                            "Réponse parvenue par l'entité et non directement · ISA 505 § 7 c) et § 10, fiabilité à corroborer.")
                        : dto.doutefiabilite?.trim() || null,
                },
            });
        }
        return this.prisma.demandeConfirmation.update({
            where: { id: demandeId },
            data: {
                statut: dto.statut,
                soldeConfirme: null,
                ecart: null,
                natureEcart: null,
            },
        });
    }
    async suivreDepouillement(tenantId, campagneId, statutLu) {
        if (statutLu !== client_1.StatutCampagneCircularisation.ENVOYEE && statutLu !== client_1.StatutCampagneCircularisation.RELANCEE) {
            return;
        }
        const demandes = await this.prisma.demandeConfirmation.findMany({
            where: { tenantId, campagneId },
            select: { statut: true },
        });
        if (!CircularisationService_1.estDepouillee(demandes.map((d) => d.statut)))
            return;
        await this.prisma.campagneCircularisation.updateMany({
            where: {
                id: campagneId,
                tenantId,
                statut: { in: [client_1.StatutCampagneCircularisation.ENVOYEE, client_1.StatutCampagneCircularisation.RELANCEE] },
            },
            data: { statut: client_1.StatutCampagneCircularisation.DEPOUILLEE },
        });
    }
    async consignerProceduresAlternatives(tenantId, demandeId, dto) {
        const demande = await this.prisma.demandeConfirmation.findFirst({ where: { id: demandeId, tenantId } });
        if (!demande)
            throw new common_1.NotFoundException('Demande introuvable.');
        if (demande.statut !== client_1.StatutDemandeConfirmation.SANS_REPONSE &&
            demande.statut !== client_1.StatutDemandeConfirmation.NON_DISTRIBUEE) {
            throw new common_1.BadRequestException("Les procédures alternatives ne se consignent que sur une NON-RÉPONSE · ISA 505 § 6 d), l'absence de réponse ou la lettre revenue non distribuée.");
        }
        return this.prisma.demandeConfirmation.update({
            where: { id: demandeId },
            data: { proceduresAlternatives: dto.proceduresAlternatives.trim() },
        });
    }
    async clore(tenantId, campagneId, userId, dto) {
        await this.campagne(tenantId, campagneId, [
            client_1.StatutCampagneCircularisation.ENVOYEE,
            client_1.StatutCampagneCircularisation.RELANCEE,
            client_1.StatutCampagneCircularisation.DEPOUILLEE,
        ]);
        const demandes = await this.prisma.demandeConfirmation.findMany({ where: { tenantId, campagneId } });
        const jamaisEnvoyees = demandes.filter((d) => d.statut === client_1.StatutDemandeConfirmation.A_ENVOYER);
        if (jamaisEnvoyees.length > 0) {
            throw new common_1.ForbiddenException(`${jamaisEnvoyees.length} demande(s) jamais envoyée(s) · retirez-les de la campagne ou envoyez-les avant de ` +
                'clore. Une lettre qui n’est pas partie n’a rien établi, et ne se classe pas en non-réponse.');
        }
        const enAttente = demandes.filter((d) => d.statut === client_1.StatutDemandeConfirmation.ENVOYEE || d.statut === client_1.StatutDemandeConfirmation.RELANCEE);
        if (enAttente.length > 0) {
            throw new common_1.ForbiddenException(`${enAttente.length} demande(s) encore en attente · les classer en réponse reçue ou en non-réponse avant de clore. Une demande laissée « envoyée » n'est ni confirmée ni traitée.`);
        }
        const nonReponsesNues = demandes.filter((d) => (d.statut === client_1.StatutDemandeConfirmation.SANS_REPONSE ||
            d.statut === client_1.StatutDemandeConfirmation.NON_DISTRIBUEE) &&
            !d.proceduresAlternatives?.trim());
        if (nonReponsesNues.length > 0) {
            throw new common_1.ForbiddenException(`${nonReponsesNues.length} non-réponse(s) sans procédure alternative · ISA 505 § 12 : « in the case of EACH non-response, the auditor shall perform alternative audit procedures ». ` +
                'Une non-réponse n’est pas une confirmation : sans procédure alternative, le solde n’est pas établi.');
        }
        return this.prisma.campagneCircularisation.update({
            where: { id: campagneId },
            data: {
                statut: client_1.StatutCampagneCircularisation.CLOTUREE,
                clotureeLe: new Date(),
                clotureePar: userId,
                ...(dto.refusDirectionMotif !== undefined
                    ? { refusDirectionMotif: dto.refusDirectionMotif?.trim() || null }
                    : {}),
            },
        });
    }
    async lister(tenantId, exerciceId) {
        return this.prisma.campagneCircularisation.findMany({
            where: { tenantId, ...(exerciceId ? { exerciceId } : {}) },
            orderBy: { dateArrete: 'desc' },
            include: { _count: { select: { demandes: true } } },
        });
    }
    async consulter(tenantId, campagneId) {
        const campagne = await this.prisma.campagneCircularisation.findFirst({
            where: { id: campagneId, tenantId },
            include: {
                demandes: {
                    include: { compte: { select: { numero: true, intitule: true } }, tiers: { select: { code: true, nom: true } } },
                    orderBy: { destinataire: 'asc' },
                },
            },
        });
        if (!campagne)
            throw new common_1.NotFoundException('Campagne de circularisation introuvable.');
        const d = campagne.demandes;
        const { racines, total: totalCycle } = await this.soldesDuCycle(tenantId, campagne);
        const envoyees = d.filter((x) => x.statut !== client_1.StatutDemandeConfirmation.A_ENVOYER);
        const recues = d.filter((x) => x.statut === client_1.StatutDemandeConfirmation.REPONSE_RECUE);
        const nonReponses = d.filter((x) => x.statut === client_1.StatutDemandeConfirmation.SANS_REPONSE || x.statut === client_1.StatutDemandeConfirmation.NON_DISTRIBUEE);
        const abs = (v) => Math.abs(Number(v ?? 0));
        const soldeEnvoye = envoyees.reduce((s, x) => s + abs(x.soldeAConfirmer), 0);
        const soldeConfirme = recues
            .filter((x) => racines.some((r) => x.compte.numero.startsWith(r)))
            .reduce((s, x) => s + abs(x.soldeAConfirmer), 0);
        const ecarts = recues.filter((x) => Math.abs(Number(x.ecart ?? 0)) > 0.005);
        return {
            ...campagne,
            synthese: {
                demandes: d.length,
                envoyees: envoyees.length,
                reponses: recues.length,
                nonReponses: nonReponses.length,
                nonReponsesSansProcedure: nonReponses.filter((x) => !x.proceduresAlternatives?.trim()).length,
                tauxReponse: envoyees.length > 0 ? Number(((recues.length / envoyees.length) * 100).toFixed(1)) : 0,
                tauxCouverture: totalCycle > 0 ? Number(((soldeConfirme / totalCycle) * 100).toFixed(1)) : 0,
                totalCycle: Number(totalCycle.toFixed(2)),
                soldeEnvoye: Number(soldeEnvoye.toFixed(2)),
                soldeConfirme: Number(soldeConfirme.toFixed(2)),
                ecarts: ecarts.length,
                anomaliesPotentielles: ecarts.filter((x) => x.natureEcart === client_1.NatureEcartConfirmation.ANOMALIE_POTENTIELLE).length,
                reponsesIndirectes: recues.filter((x) => x.reponseIndirecte).length,
            },
        };
    }
};
exports.CircularisationService = CircularisationService;
CircularisationService.ISSUES_DEPOUILLEMENT = [
    client_1.StatutDemandeConfirmation.REPONSE_RECUE,
    client_1.StatutDemandeConfirmation.SANS_REPONSE,
    client_1.StatutDemandeConfirmation.NON_DISTRIBUEE,
];
CircularisationService.CONDITIONS_NEGATIVE = [
    'RISQUE_FAIBLE_ET_CONTROLES_TESTES',
    'POPULATION_NOMBREUSE_PETITE_HOMOGENE',
    'TAUX_EXCEPTION_ATTENDU_TRES_FAIBLE',
    'AUCUNE_RAISON_DE_CROIRE_A_UN_REJET',
];
exports.CircularisationService = CircularisationService = CircularisationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], CircularisationService);
//# sourceMappingURL=circularisation.service.js.map