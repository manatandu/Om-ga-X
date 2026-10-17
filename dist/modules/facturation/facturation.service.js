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
exports.PLAFOND_LISTE_FACTURES = exports.FacturationService = void 0;
const common_1 = require("@nestjs/common");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const mentions_facture_1 = require("./mentions-facture");
const etat_detaille_tva_1 = require("./etat-detaille-tva");
const correspondance_retenues_1 = require("../retenues/correspondance-retenues");
const mentions_societe_1 = require("../tenant/mentions-societe");
const periode_de_liste_1 = require("../../common/periode-de-liste");
const date_reception_1 = require("./date-reception");
const echeance_1 = require("../../common/echeance");
const nombre = (d) => d === null || d === undefined ? null : Number(d);
let FacturationService = class FacturationService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async dossier(tenantId) {
        return this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: {
                id: true,
                numeroImpot: true,
                ...mentions_societe_1.SELECT_IDENTITE_SOCIETE,
                regimeExigibiliteTva: true,
            },
        });
    }
    estPersonneMorale(t) {
        return !correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES.includes(t.formeJuridiqueSyscohada);
    }
    verifiable(f) {
        return {
            emetteurNom: f.emetteurNom,
            emetteurAdresse: f.emetteurAdresse,
            emetteurNumeroImpot: f.emetteurNumeroImpot,
            contrepartieNom: f.contrepartieNom,
            contrepartieAdresse: f.contrepartieAdresse,
            contrepartieNumeroImpot: f.contrepartieNumeroImpot,
            dateFacture: f.dateFacture,
            numeroSerie: f.numeroSerie,
            mentionTvaDebits: f.mentionTvaDebits,
            autresImpotsEtTaxes: nombre(f.autresImpotsEtTaxes),
            lignes: f.lignes.map((l) => ({
                designation: l.designation,
                quantite: nombre(l.quantite),
                prixUnitaire: nombre(l.prixUnitaire),
                montantHT: nombre(l.montantHT),
                imposable: l.imposable,
                tauxApplique: nombre(l.tauxApplique),
                montantTva: nombre(l.montantTva),
            })),
        };
    }
    async lister(tenantId, params = {}) {
        const periode = (0, periode_de_liste_1.lirePeriodeDeListe)(params);
        const t = await this.dossier(tenantId);
        const morale = this.estPersonneMorale(t);
        const filtre = {
            ...(params.sens ? { sens: params.sens } : {}),
            ...(periode.bornes ? { dateFacture: periode.bornes } : {}),
        };
        const [factures, total] = await Promise.all([
            this.prisma.facture.findMany({
                where: { tenantId, ...filtre },
                include: {
                    lignes: { orderBy: { ordre: 'asc' } },
                    tiers: { select: { id: true, code: true, nom: true } },
                    factureAnnulee: { select: { id: true, numeroSerie: true, dateFacture: true } },
                    noteDeCredit: { select: { id: true, numeroSerie: true, dateFacture: true } },
                },
                orderBy: [{ dateFacture: 'desc' }, { numeroSerie: 'desc' }, { id: 'desc' }],
                take: exports.PLAFOND_LISTE_FACTURES,
            }),
            this.prisma.facture.count({ where: { tenantId, ...filtre } }),
        ]);
        return {
            homologation: mentions_facture_1.HOMOLOGATION,
            obligationDAcceptation: mentions_facture_1.OBLIGATION_DACCEPTATION,
            regimeExigibiliteTva: t.regimeExigibiliteTva,
            periode: { du: periode.du, au: periode.au },
            total,
            plafond: exports.PLAFOND_LISTE_FACTURES,
            tronque: total > factures.length,
            factures: factures.map((f) => {
                const v = this.verifiable(f);
                return {
                    id: f.id,
                    sens: f.sens,
                    nature: f.nature,
                    factureAnnulee: f.factureAnnulee,
                    noteDeCredit: f.noteDeCredit,
                    barree: f.noteDeCredit !== null,
                    numeroSerie: f.numeroSerie,
                    dateFacture: f.dateFacture,
                    dateReception: f.dateReception,
                    tiers: f.tiers,
                    emetteurNom: f.emetteurNom,
                    emetteurAdresse: f.emetteurAdresse,
                    emetteurNumeroImpot: f.emetteurNumeroImpot,
                    contrepartieNom: f.contrepartieNom,
                    contrepartieAdresse: f.contrepartieAdresse,
                    contrepartieNumeroImpot: f.contrepartieNumeroImpot,
                    mentionTvaDebits: f.mentionTvaDebits,
                    mentionsSocieteEmetteur: f.mentionsSocieteEmetteur,
                    autresImpotsEtTaxes: nombre(f.autresImpotsEtTaxes),
                    ecritureId: f.ecritureId,
                    lignes: f.lignes.map((l) => ({
                        id: l.id,
                        ordre: l.ordre,
                        designation: l.designation,
                        quantite: nombre(l.quantite),
                        prixUnitaire: nombre(l.prixUnitaire),
                        montantHT: nombre(l.montantHT),
                        imposable: l.imposable,
                        tauxApplique: nombre(l.tauxApplique),
                        montantTva: nombre(l.montantTva),
                    })),
                    totaux: (0, mentions_facture_1.totauxFacture)(v),
                    mentions: (0, mentions_facture_1.verifierMentions)(v, morale, {
                        sensVente: f.sens === client_1.SensFacture.VENTE,
                        regimeExigibiliteTva: t.regimeExigibiliteTva,
                    }),
                };
            }),
        };
    }
    async enregistrer(tenantId, dto) {
        const t = await this.dossier(tenantId);
        const dateFacture = new Date(dto.dateFacture);
        const dateReception = dto.dateReception ? new Date(dto.dateReception) : null;
        const motifReception = (0, date_reception_1.motifRefusDateReception)({ sens: dto.sens, dateFacture, dateReception }, (0, echeance_1.jourDeKinshasa)(new Date()));
        if (motifReception)
            throw new common_1.BadRequestException(motifReception);
        let contrepartieNom = dto.contrepartieNom?.trim() ?? '';
        let contrepartieAdresse = dto.contrepartieAdresse?.trim() || null;
        let contrepartieNumeroImpot = dto.contrepartieNumeroImpot?.trim() || null;
        if (dto.tiersId) {
            const tiers = await this.prisma.tiers.findFirst({
                where: { id: dto.tiersId, tenantId },
                select: { nom: true, numeroImpot: true, adresse: true, ville: true },
            });
            if (!tiers)
                throw new common_1.NotFoundException('Tiers introuvable dans ce dossier.');
            contrepartieNom = contrepartieNom || tiers.nom;
            contrepartieNumeroImpot = contrepartieNumeroImpot ?? tiers.numeroImpot;
            contrepartieAdresse = contrepartieAdresse ?? ([tiers.adresse, tiers.ville].filter(Boolean).join(', ') || null);
        }
        if (!contrepartieNom) {
            const vente = dto.sens === client_1.SensFacture.VENTE;
            throw new common_1.BadRequestException(`L’identité ${vente ? 'du client' : 'du vendeur ou prestataire'} est exigée au ` +
                `${(0, mentions_facture_1.renvoiALaMention)(dateFacture, vente ? 'IDENTITE_CLIENT' : 'IDENTITE_VENDEUR')} · ` +
                'renseignez un tiers ou saisissez le nom.');
        }
        const idsTaux = [...new Set(dto.lignes.map((l) => l.tauxTvaId).filter((x) => !!x))];
        if (idsTaux.length) {
            const trouves = await this.prisma.tauxTva.findMany({ where: { id: { in: idsTaux }, tenantId }, select: { id: true } });
            if (trouves.length !== idsTaux.length)
                throw new common_1.NotFoundException('Taux de taxe introuvable dans ce dossier.');
        }
        if (dto.ecritureId) {
            const ecriture = await this.prisma.ecriture.findFirst({
                where: { id: dto.ecritureId, tenantId },
                select: { id: true, statut: true, numeroPiece: true },
            });
            if (!ecriture)
                throw new common_1.NotFoundException('Écriture introuvable dans ce dossier.');
            if (ecriture.statut === client_1.StatutEcriture.SITUATION) {
                throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSimulationNonRattachable)(`n° ${ecriture.numeroPiece ?? '·'}`, 'une facture'));
            }
        }
        const doublon = await this.prisma.facture.findFirst({
            where: { tenantId, sens: dto.sens, numeroSerie: dto.numeroSerie.trim() },
            select: { id: true },
        });
        if (doublon) {
            throw new common_1.BadRequestException(`Le numéro de série « ${dto.numeroSerie.trim()} » est déjà porté par une facture de ce sens dans ce ` +
                `dossier. Le n° de série est exigé au ${(0, mentions_facture_1.renvoiALaMention)(dateFacture, 'DATE_ET_NUMERO')} : deux pièces ` +
                'ne peuvent pas le partager.');
        }
        const adresseDossier = [t.adresse, t.ville].filter(Boolean).join(', ') || null;
        const facture = await this.prisma.facture.create({
            data: {
                tenantId,
                sens: dto.sens,
                numeroSerie: dto.numeroSerie.trim(),
                dateFacture,
                dateReception,
                tiersId: dto.tiersId ?? null,
                emetteurNom: dto.sens === client_1.SensFacture.VENTE ? t.nom : contrepartieNom,
                emetteurAdresse: dto.sens === client_1.SensFacture.VENTE ? adresseDossier : contrepartieAdresse,
                emetteurNumeroImpot: dto.sens === client_1.SensFacture.VENTE ? t.numeroImpot : contrepartieNumeroImpot,
                contrepartieNom: dto.sens === client_1.SensFacture.VENTE ? contrepartieNom : t.nom,
                contrepartieAdresse: dto.sens === client_1.SensFacture.VENTE ? contrepartieAdresse : adresseDossier,
                contrepartieNumeroImpot: dto.sens === client_1.SensFacture.VENTE ? contrepartieNumeroImpot : t.numeroImpot,
                mentionTvaDebits: dto.mentionTvaDebits ?? false,
                mentionsSocieteEmetteur: dto.sens === client_1.SensFacture.VENTE ? (0, mentions_societe_1.mentionsRecopiees)((0, mentions_societe_1.identiteSociete)(t), dateFacture) : client_1.Prisma.DbNull,
                autresImpotsEtTaxes: dto.autresImpotsEtTaxes === undefined ? null : new client_1.Prisma.Decimal(dto.autresImpotsEtTaxes),
                ecritureId: dto.ecritureId ?? null,
                lignes: {
                    create: dto.lignes.map((l, i) => ({
                        ordre: i + 1,
                        designation: l.designation.trim(),
                        quantite: new client_1.Prisma.Decimal(l.quantite),
                        prixUnitaire: new client_1.Prisma.Decimal(l.prixUnitaire),
                        montantHT: new client_1.Prisma.Decimal(l.montantHT),
                        imposable: l.imposable ?? true,
                        tauxTvaId: l.tauxTvaId ?? null,
                        tauxApplique: l.tauxApplique === undefined ? null : new client_1.Prisma.Decimal(l.tauxApplique),
                        montantTva: new client_1.Prisma.Decimal(l.montantTva ?? 0),
                    })),
                },
            },
            include: { lignes: { orderBy: { ordre: 'asc' } } },
        });
        const v = this.verifiable(facture);
        return {
            id: facture.id,
            totaux: (0, mentions_facture_1.totauxFacture)(v),
            mentions: (0, mentions_facture_1.verifierMentions)(v, this.estPersonneMorale(t), {
                sensVente: facture.sens === client_1.SensFacture.VENTE,
                regimeExigibiliteTva: t.regimeExigibiliteTva,
            }),
            homologation: mentions_facture_1.HOMOLOGATION,
        };
    }
    async emettreNoteDeCredit(tenantId, factureId, dto) {
        const initiale = await this.prisma.facture.findFirst({
            where: { id: factureId, tenantId },
            include: { lignes: { orderBy: { ordre: 'asc' } }, noteDeCredit: { select: { numeroSerie: true } } },
        });
        if (!initiale)
            throw new common_1.NotFoundException('Facture introuvable dans ce dossier.');
        if (initiale.nature !== client_1.NatureFacture.FACTURE) {
            throw new common_1.BadRequestException('Une note de crédit annule une FACTURE (décret n° 011/42, art. 127). Pour revenir sur une note émise ' +
                'à tort, établissez une facture nouvelle.');
        }
        if (initiale.noteDeCredit) {
            throw new common_1.BadRequestException(`Cette facture est déjà annulée par la note de crédit « ${initiale.noteDeCredit.numeroSerie} ».`);
        }
        const dateNote = new Date(dto.dateNote);
        if (dateNote < initiale.dateFacture) {
            throw new common_1.BadRequestException('La note de crédit ne peut pas être antérieure à la facture qu’elle annule.');
        }
        const dateReceptionNote = dto.dateReception ? new Date(dto.dateReception) : null;
        const motifReception = (0, date_reception_1.motifRefusDateReception)({ sens: initiale.sens, dateFacture: dateNote, dateReception: dateReceptionNote }, (0, echeance_1.jourDeKinshasa)(new Date()));
        if (motifReception)
            throw new common_1.BadRequestException(motifReception);
        const numeroSerie = dto.numeroSerie.trim();
        const doublon = await this.prisma.facture.findFirst({
            where: { tenantId, sens: initiale.sens, numeroSerie },
            select: { id: true },
        });
        if (doublon) {
            throw new common_1.BadRequestException(`Le numéro de série « ${numeroSerie} » est déjà porté par une pièce de ce sens dans ce dossier. ` +
                'La note de crédit est rangée dans le même facturier que les factures : deux pièces ne partagent pas un numéro.');
        }
        if (dto.ecritureId) {
            const ecriture = await this.prisma.ecriture.findFirst({
                where: { id: dto.ecritureId, tenantId },
                select: { id: true, statut: true, numeroPiece: true },
            });
            if (!ecriture)
                throw new common_1.NotFoundException('Écriture introuvable dans ce dossier.');
            if (ecriture.statut === client_1.StatutEcriture.SITUATION) {
                throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSimulationNonRattachable)(`n° ${ecriture.numeroPiece ?? '·'}`, 'une facture'));
            }
        }
        const note = await this.prisma.facture.create({
            data: {
                tenantId,
                sens: initiale.sens,
                nature: client_1.NatureFacture.NOTE_DE_CREDIT,
                factureAnnuleeId: initiale.id,
                numeroSerie,
                dateFacture: dateNote,
                dateReception: dateReceptionNote,
                tiersId: initiale.tiersId,
                emetteurNom: initiale.emetteurNom,
                emetteurAdresse: initiale.emetteurAdresse,
                emetteurNumeroImpot: initiale.emetteurNumeroImpot,
                contrepartieNom: initiale.contrepartieNom,
                contrepartieAdresse: initiale.contrepartieAdresse,
                contrepartieNumeroImpot: initiale.contrepartieNumeroImpot,
                mentionTvaDebits: initiale.mentionTvaDebits,
                mentionsSocieteEmetteur: (initiale.mentionsSocieteEmetteur ?? client_1.Prisma.DbNull),
                autresImpotsEtTaxes: initiale.autresImpotsEtTaxes,
                ecritureId: dto.ecritureId ?? null,
                lignes: {
                    create: initiale.lignes.map((l) => ({
                        ordre: l.ordre,
                        designation: l.designation,
                        quantite: l.quantite,
                        prixUnitaire: l.prixUnitaire,
                        montantHT: l.montantHT,
                        imposable: l.imposable,
                        tauxTvaId: l.tauxTvaId,
                        tauxApplique: l.tauxApplique,
                        montantTva: l.montantTva,
                    })),
                },
            },
            include: { lignes: { orderBy: { ordre: 'asc' } } },
        });
        return {
            id: note.id,
            nature: note.nature,
            factureAnnulee: { id: initiale.id, numeroSerie: initiale.numeroSerie },
            totaux: (0, mentions_facture_1.totauxFacture)(this.verifiable(note)),
        };
    }
    async supprimer(tenantId, id) {
        const facture = await this.prisma.facture.findFirst({
            where: { id, tenantId },
            select: {
                id: true,
                nature: true,
                numeroSerie: true,
                ecritureId: true,
                factureAnnulee: { select: { numeroSerie: true } },
                noteDeCredit: { select: { numeroSerie: true } },
                factureAbonnement: { select: { periode: true } },
            },
        });
        if (!facture)
            throw new common_1.NotFoundException('Facture introuvable dans ce dossier.');
        if (facture.ecritureId) {
            throw new common_1.BadRequestException(`La pièce « ${facture.numeroSerie} » est passée au journal · retirez d’abord son écriture tant qu’elle est au ` +
                'brouillard ; validée, la pièce se conserve et s’annule par une note de crédit.');
        }
        if (facture.nature === client_1.NatureFacture.NOTE_DE_CREDIT) {
            throw new common_1.BadRequestException(`La note de crédit « ${facture.numeroSerie} » annule la facture « ${facture.factureAnnulee?.numeroSerie ?? '·'} » ` +
                '(décret n° 011/42, art. 127) · elle se conserve et ne se supprime pas.');
        }
        if (facture.factureAbonnement) {
            throw new common_1.BadRequestException(`Cette facture est celle de l’abonnement pour ${facture.factureAbonnement.periode} · elle ne se supprime pas ; une erreur s’annule par une note de crédit.`);
        }
        if (facture.noteDeCredit) {
            throw new common_1.BadRequestException(`Cette facture est annulée par la note de crédit « ${facture.noteDeCredit.numeroSerie} ». Elle doit être ` +
                'barrée et CONSERVÉE dans le facturier (décret n° 011/42, art. 127) : elle ne se supprime pas.');
        }
        await this.prisma.facture.delete({ where: { id: facture.id } });
        return { supprimee: true };
    }
    async etatDetaille(tenantId, periode) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode ?? '')) {
            throw new common_1.BadRequestException('Période attendue au format AAAA-MM · la déclaration de TVA est mensuelle (art. 60).');
        }
        const [annee, mois] = periode.split('-').map(Number);
        const debut = new Date(Date.UTC(annee, mois - 1, 1));
        const finExclue = new Date(Date.UTC(annee, mois, 1));
        const factures = await this.prisma.facture.findMany({
            where: {
                tenantId,
                sens: client_1.SensFacture.ACHAT,
                nature: client_1.NatureFacture.FACTURE,
                OR: [
                    { dateReception: { gte: debut, lt: finExclue } },
                    { dateReception: null, dateFacture: { gte: debut, lt: finExclue } },
                ],
            },
            include: {
                lignes: { orderBy: { ordre: 'asc' } },
                noteDeCredit: { select: { numeroSerie: true, dateFacture: true } },
            },
            orderBy: [{ dateFacture: 'asc' }, { numeroSerie: 'asc' }],
        });
        const source = factures.map((f) => ({
            numeroSerie: f.numeroSerie,
            dateFacture: f.dateFacture,
            annuleePar: f.noteDeCredit ? { numeroSerie: f.noteDeCredit.numeroSerie, dateFacture: f.noteDeCredit.dateFacture } : null,
            fournisseurNom: f.emetteurNom,
            fournisseurNumeroImpot: f.emetteurNumeroImpot,
            lignes: f.lignes.map((l) => ({
                designation: l.designation,
                quantite: Number(l.quantite),
                prixHT: Number(l.montantHT),
                montantTva: Number(l.montantTva),
                imposable: l.imposable,
            })),
        }));
        return (0, etat_detaille_tva_1.construireEtatDetaille)(periode, source);
    }
};
exports.FacturationService = FacturationService;
exports.FacturationService = FacturationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FacturationService);
exports.PLAFOND_LISTE_FACTURES = 500;
//# sourceMappingURL=facturation.service.js.map