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
exports.PLAFOND_LISTE_DEVIS = exports.CommercialService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const mentions_societe_1 = require("../tenant/mentions-societe");
const periode_de_liste_1 = require("../../common/periode-de-liste");
const vente_commerciale_1 = require("./vente-commerciale");
const INCLUSION_DEVIS = { lignes: true, contreProposition: { select: { id: true } } };
let CommercialService = class CommercialService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async dossier(tenantId) {
        return this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: {
                id: true,
                ...mentions_societe_1.SELECT_IDENTITE_SOCIETE,
            },
        });
    }
    async exigerCommercant(tenantId) {
        const t = await this.dossier(tenantId);
        if (t.referentiel !== client_1.Referentiel.SYSCOHADA)
            throw new common_1.BadRequestException(vente_commerciale_1.MOTIF_HORS_SYCEBNL);
        return t;
    }
    vue(d, reference) {
        const lignes = d.lignes
            .slice()
            .sort((a, b) => a.ordre - b.ordre)
            .map((l) => ({
            id: l.id,
            ordre: l.ordre,
            designation: l.designation,
            quantite: Number(l.quantite),
            prixUnitaire: Number(l.prixUnitaire),
            montantHT: Number(l.montantHT),
        }));
        const etat = (0, vente_commerciale_1.etatDevis)({
            dateEmission: d.dateEmission,
            delaiJours: d.delaiJours,
            dateReponse: d.dateReponse,
            natureReponse: d.natureReponse,
            revoqueLe: d.revoqueLe,
            reference,
        });
        return {
            id: d.id,
            emetteur: d.emetteur,
            numero: d.numero,
            dateEmission: d.dateEmission,
            dateReception: d.dateReception,
            delaiJours: d.delaiJours,
            declareeIrrevocable: d.declareeIrrevocable,
            nature: d.nature,
            clientNom: d.clientNom,
            objet: d.objet,
            mentionsSocieteEmetteur: d.mentionsSocieteEmetteur,
            natureReponse: d.natureReponse,
            dateReponse: d.dateReponse,
            detailReponse: d.detailReponse,
            revoqueLe: d.revoqueLe,
            motifRevocation: d.motifRevocation,
            contrePropositionDeId: d.contrePropositionDeId,
            contrePropositionId: d.contreProposition?.id ?? null,
            lignes,
            totalHT: lignes.reduce((s, l) => s + l.montantHT, 0),
            prixPresume: vente_commerciale_1.PRIX_PRESUME_HORS_TAXES,
            perimetre: (0, vente_commerciale_1.perimetreVenteCommerciale)(d.nature),
            qualification: (0, vente_commerciale_1.qualifierOffre)({
                destinataireDetermine: d.destinataireDetermine,
                volonteDEtreLie: d.volonteDEtreLie,
                lignes,
            }),
            etat,
            revocabilite: (0, vente_commerciale_1.revocabilite)({
                delaiJours: d.delaiJours,
                declareeIrrevocable: d.declareeIrrevocable,
                dejaAcceptee: etat.etat === 'ACCEPTE',
            }),
        };
    }
    async lister(tenantId, params = {}) {
        const periode = (0, periode_de_liste_1.lirePeriodeDeListe)(params);
        await this.exigerCommercant(tenantId);
        const reference = params.dateReference ? new Date(params.dateReference) : new Date();
        const filtre = periode.bornes ? { dateEmission: periode.bornes } : {};
        const [devis, total] = await Promise.all([
            this.prisma.devis.findMany({
                where: { tenantId, ...filtre },
                include: INCLUSION_DEVIS,
                orderBy: [{ dateEmission: 'desc' }, { numero: 'desc' }],
                take: exports.PLAFOND_LISTE_DEVIS,
            }),
            this.prisma.devis.count({ where: { tenantId, ...filtre } }),
        ]);
        return {
            dateReference: reference.toISOString().slice(0, 10),
            aucuneConditionDeForme: vente_commerciale_1.AUCUNE_CONDITION_DE_FORME,
            delaisDeConformite: vente_commerciale_1.DELAIS_DE_CONFORMITE,
            periode: { du: periode.du, au: periode.au },
            total,
            plafond: exports.PLAFOND_LISTE_DEVIS,
            tronque: total > devis.length,
            devis: devis.map((d) => this.vue(d, reference)),
        };
    }
    async emettre(tenantId, dto) {
        const t = await this.exigerCommercant(tenantId);
        let clientNom = dto.clientNom?.trim() ?? '';
        if (dto.tiersId) {
            const tiers = await this.prisma.tiers.findFirst({
                where: { id: dto.tiersId, tenantId },
                select: { nom: true },
            });
            if (!tiers)
                throw new common_1.NotFoundException('Tiers introuvable dans ce dossier.');
            clientNom = clientNom || tiers.nom;
        }
        if (!clientNom) {
            throw new common_1.BadRequestException('Le destinataire doit être nommé · l’art. 241 réserve la qualité d’offre à la proposition adressée à ' +
                'des personnes DÉTERMINÉES, une proposition à des personnes indéterminées n’étant qu’une invitation à l’offre.');
        }
        const doublon = await this.prisma.devis.findFirst({
            where: { tenantId, numero: dto.numero.trim() },
            select: { id: true },
        });
        if (doublon)
            throw new common_1.BadRequestException(`Le numéro « ${dto.numero.trim()} » est déjà porté par un devis de ce dossier.`);
        let emetteur = 'DOSSIER';
        if (dto.contrePropositionDeId) {
            const precedent = await this.prisma.devis.findFirst({
                where: { id: dto.contrePropositionDeId, tenantId },
                include: { contreProposition: { select: { id: true } } },
            });
            if (!precedent)
                throw new common_1.NotFoundException('Devis d’origine introuvable dans ce dossier.');
            if (precedent.natureReponse !== client_1.NatureReponseDevis.MODIFICATION_SUBSTANTIELLE) {
                throw new common_1.BadRequestException('Une contre-proposition ne naît que d’une réponse portant une MODIFICATION SUBSTANTIELLE, qui « vaut ' +
                    'rejet de l’offre et constitue une contre-proposition » (AUDCG art. 245, premier alinéa). Enregistrez ' +
                    'd’abord cette réponse sur le devis d’origine.');
            }
            if (precedent.contreProposition) {
                throw new common_1.BadRequestException('Ce devis a déjà donné lieu à une contre-proposition.');
            }
            emetteur = precedent.emetteur === 'DOSSIER' ? 'CLIENT' : 'DOSSIER';
        }
        const devis = await this.prisma.devis.create({
            data: {
                tenantId,
                emetteur,
                numero: dto.numero.trim(),
                dateEmission: new Date(dto.dateEmission),
                dateReception: dto.dateReception ? new Date(dto.dateReception) : null,
                delaiJours: dto.delaiJours ?? null,
                declareeIrrevocable: dto.declareeIrrevocable ?? false,
                destinataireDetermine: dto.destinataireDetermine ?? true,
                volonteDEtreLie: dto.volonteDEtreLie ?? true,
                nature: dto.nature,
                tiersId: dto.tiersId ?? null,
                clientNom,
                objet: dto.objet?.trim() || null,
                mentionsSocieteEmetteur: emetteur === 'DOSSIER' ? (0, mentions_societe_1.mentionsRecopiees)((0, mentions_societe_1.identiteSociete)(t), new Date(dto.dateEmission)) : client_1.Prisma.DbNull,
                contrePropositionDeId: dto.contrePropositionDeId ?? null,
                lignes: {
                    create: dto.lignes.map((l, i) => ({
                        ordre: i + 1,
                        designation: l.designation.trim(),
                        quantite: new client_1.Prisma.Decimal(l.quantite),
                        prixUnitaire: new client_1.Prisma.Decimal(l.prixUnitaire),
                        montantHT: new client_1.Prisma.Decimal(l.montantHT),
                    })),
                },
            },
            include: INCLUSION_DEVIS,
        });
        return this.vue(devis, new Date());
    }
    async enregistrerReponse(tenantId, id, dto) {
        await this.exigerCommercant(tenantId);
        const devis = await this.prisma.devis.findFirst({ where: { id, tenantId }, include: INCLUSION_DEVIS });
        if (!devis)
            throw new common_1.NotFoundException('Devis introuvable dans ce dossier.');
        if (devis.natureReponse)
            throw new common_1.BadRequestException('Une réponse est déjà enregistrée sur ce devis.');
        const reponse = new Date(dto.dateReponse);
        if (reponse.getTime() < devis.dateEmission.getTime()) {
            throw new common_1.BadRequestException('Une réponse ne peut pas parvenir avant que l’offre n’ait été émise.');
        }
        if (devis.revoqueLe && devis.revoqueLe.getTime() < reponse.getTime()) {
            throw new common_1.BadRequestException('Cette offre a été révoquée avant la date de cette réponse · l’art. 242 ne lui laisse plus d’effet.');
        }
        if ((dto.natureReponse === client_1.NatureReponseDevis.MODIFICATION_NON_SUBSTANTIELLE ||
            dto.natureReponse === client_1.NatureReponseDevis.MODIFICATION_SUBSTANTIELLE) &&
            !dto.detailReponse?.trim()) {
            throw new common_1.BadRequestException('Dites ce que la réponse modifie. L’art. 245 fait de la substantialité de la modification la charnière ' +
                'entre une acceptation et un rejet valant contre-proposition : elle se qualifie, elle ne se calcule pas.');
        }
        const maj = await this.prisma.devis.update({
            where: { id: devis.id },
            data: {
                natureReponse: dto.natureReponse,
                dateReponse: reponse,
                detailReponse: dto.detailReponse?.trim() || null,
            },
            include: INCLUSION_DEVIS,
        });
        return this.vue(maj, new Date());
    }
    async revoquer(tenantId, id, dto) {
        await this.exigerCommercant(tenantId);
        const devis = await this.prisma.devis.findFirst({ where: { id, tenantId }, include: INCLUSION_DEVIS });
        if (!devis)
            throw new common_1.NotFoundException('Devis introuvable dans ce dossier.');
        const vue = this.vue(devis, new Date());
        if (!vue.revocabilite.revocable) {
            throw new common_1.BadRequestException(`${vue.revocabilite.motif} (${vue.revocabilite.article})`);
        }
        const maj = await this.prisma.devis.update({
            where: { id: devis.id },
            data: { revoqueLe: new Date(dto.revoqueLe), motifRevocation: dto.motifRevocation.trim() },
            include: INCLUSION_DEVIS,
        });
        return this.vue(maj, new Date());
    }
};
exports.CommercialService = CommercialService;
exports.CommercialService = CommercialService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CommercialService);
exports.PLAFOND_LISTE_DEVIS = 500;
//# sourceMappingURL=commercial.service.js.map