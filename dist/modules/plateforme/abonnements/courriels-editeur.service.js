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
exports.CourrielsEditeurService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../common/prisma.service");
const courrier_service_1 = require("../../courrier/courrier.service");
const mentions_facture_1 = require("../../facturation/mentions-facture");
const courriels_editeur_1 = require("./courriels-editeur");
const nombre = (d) => (d === null ? 0 : Number(d.toString()));
const jour = (d) => (d ? d.toISOString().slice(0, 10) : null);
let CourrielsEditeurService = class CourrielsEditeurService {
    constructor(prisma, courrier) {
        this.prisma = prisma;
        this.courrier = courrier;
    }
    async envoyerLicence(qui, id, destinataire, destinataireNom = null) {
        const l = await this.prisma.licenceSurSiteEmise.findUnique({ where: { id } });
        if (!l)
            throw new common_1.NotFoundException('Licence introuvable.');
        const c = (0, courriels_editeur_1.courrielLicenceSurSite)(l);
        return this.courrier.mettreEnFile(qui.tenantId, {
            destinataire,
            destinataireNom,
            sujet: c.sujet,
            corps: c.corps,
            pieceJointe: c.pieceJointe,
            origine: courrier_service_1.ORIGINE_LICENCE_SUR_SITE,
            origineId: l.id,
            createdBy: qui.userId,
        });
    }
    async envoyerFacture(qui, factureAbonnementId, destinataire = null) {
        const fa = await this.prisma.factureAbonnement.findUnique({
            where: { id: factureAbonnementId },
            select: {
                id: true,
                periode: true,
                montantUsd: true,
                cours: true,
                abonnement: { select: { cabinet: { select: { licence: { select: { dateExpiration: true } } } } } },
                facture: {
                    select: {
                        tenantId: true,
                        numeroSerie: true,
                        dateFacture: true,
                        emetteurNom: true,
                        mentionsSocieteEmetteur: true,
                        contrepartieNom: true,
                        tiers: { select: { email: true, nom: true } },
                        lignes: { orderBy: { ordre: 'asc' }, select: { designation: true, quantite: true, prixUnitaire: true, montantHT: true, montantTva: true, imposable: true } },
                    },
                },
            },
        });
        if (!fa)
            throw new common_1.NotFoundException('Facture d’abonnement introuvable.');
        if (fa.facture.tenantId !== qui.tenantId) {
            throw new common_1.BadRequestException('Connectez-vous au dossier de l’éditeur pour envoyer ses factures.');
        }
        const adresse = (destinataire ?? '').trim() || fa.facture.tiers?.email?.trim() || '';
        if (!adresse) {
            throw new common_1.BadRequestException(`Le client ${fa.facture.contrepartieNom} n’a pas d’adresse de courriel · renseignez-la sur sa fiche dans le plan des tiers, ou saisissez-la.`);
        }
        const lignes = fa.facture.lignes.map((l) => ({
            designation: l.designation,
            quantite: nombre(l.quantite),
            prixUnitaire: nombre(l.prixUnitaire),
            montantHT: nombre(l.montantHT),
            montantTva: nombre(l.montantTva),
            imposable: l.imposable,
        }));
        const c = (0, courriels_editeur_1.courrielFactureAbonnement)({
            numeroSerie: fa.facture.numeroSerie,
            dateFacture: jour(fa.facture.dateFacture),
            periode: fa.periode,
            emetteurNom: fa.facture.emetteurNom,
            mentionsLigne: fa.facture.mentionsSocieteEmetteur?.ligne ?? null,
            contrepartieNom: fa.facture.contrepartieNom,
            lignes,
            totaux: (0, mentions_facture_1.totauxFacture)({ lignes: lignes.map((l) => ({ ...l, tauxApplique: null })) }),
            montantUsd: nombre(fa.montantUsd),
            cours: nombre(fa.cours),
            echeanceLicence: jour(fa.abonnement.cabinet.licence?.dateExpiration ?? null),
        });
        return this.courrier.mettreEnFile(qui.tenantId, {
            destinataire: adresse,
            destinataireNom: fa.facture.tiers?.nom ?? fa.facture.contrepartieNom,
            sujet: c.sujet,
            corps: c.corps,
            origine: courrier_service_1.ORIGINE_FACTURE_ABONNEMENT,
            origineId: fa.id,
            createdBy: qui.userId,
        });
    }
};
exports.CourrielsEditeurService = CourrielsEditeurService;
exports.CourrielsEditeurService = CourrielsEditeurService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        courrier_service_1.CourrierService])
], CourrielsEditeurService);
//# sourceMappingURL=courriels-editeur.service.js.map