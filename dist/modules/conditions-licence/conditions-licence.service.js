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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ConditionsLicenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConditionsLicenceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const mode_installation_1 = require("../../common/mode-installation");
const courrier_service_1 = require("../courrier/courrier.service");
const acceptation_conditions_1 = require("./acceptation-conditions");
const accuse_reception_conditions_1 = require("./accuse-reception-conditions");
const conditions_de_licence_1 = require("./conditions-de-licence");
const versions_publiees_1 = require("./versions-publiees");
const LICENCES = {
    ABONNEMENT: 'ABONNEMENT',
    PERPETUEL_SAAS: 'PERPETUEL_SAAS',
    PERPETUEL_ONPREMISE: 'PERPETUEL_ONPREMISE',
    PROPRIETAIRE: 'PROPRIETAIRE',
};
const STATUTS = {
    EN_ATTENTE: 'EN_ATTENTE',
    SANS_TRANSPORT: 'SANS_TRANSPORT',
    ENVOYE: 'ENVOYE',
    ECHEC: 'ECHEC',
    ABANDONNE: 'ABANDONNE',
};
const FORMULES = { FORMULE: 'FORMULE', OPTION: 'OPTION' };
function jour(d) {
    return d ? d.toISOString().slice(0, 10) : null;
}
const nombre = (d) => (d === null ? null : d.toNumber());
const SELECT_FORMULE = { code: true, libelle: true, type: true, prixMensuelUsd: true, prixAnnuelUsd: true };
function commandeGardee(json) {
    if (json === null || typeof json !== 'object' || Array.isArray(json))
        return null;
    const c = json;
    if (typeof c.formule !== 'string' || typeof c.periodicite !== 'string' || !Array.isArray(c.options))
        return null;
    return c;
}
let ConditionsLicenceService = ConditionsLicenceService_1 = class ConditionsLicenceService {
    constructor(prisma, courrier) {
        this.prisma = prisma;
        this.courrier = courrier;
        this.logger = new common_1.Logger(ConditionsLicenceService_1.name);
    }
    async commande(client, tenantId, dossierMereId) {
        const cabinetId = dossierMereId ?? tenantId;
        const a = await client.abonnementCabinet.findUnique({
            where: { cabinetId },
            select: {
                periodicite: true,
                debut: true,
                finEssai: true,
                actif: true,
                dossiersSupplementaires: true,
                formule: { select: SELECT_FORMULE },
                options: { select: { formule: { select: SELECT_FORMULE } } },
            },
        });
        if (!a)
            return null;
        const prix = (f) => ({
            code: f.code,
            libelle: f.libelle,
            type: FORMULES[f.type],
            prixMensuelUsd: nombre(f.prixMensuelUsd),
            prixAnnuelUsd: nombre(f.prixAnnuelUsd),
        });
        const aFacturer = {
            formule: prix(a.formule),
            options: a.options.map((o) => prix(o.formule)),
            dossiersSupplementaires: a.dossiersSupplementaires,
            periodicite: a.periodicite,
            debut: jour(a.debut),
            finEssai: jour(a.finEssai),
            actif: a.actif,
        };
        return (0, acceptation_conditions_1.detailCommande)(aFacturer, dossierMereId !== null);
    }
    async lire(client, tenantId) {
        const t = await client.tenant.findUnique({
            where: { id: tenantId },
            select: {
                nom: true,
                estDemonstration: true,
                dossierMereId: true,
                conditionsLicenceVersion: true,
                conditionsLicenceEmpreinte: true,
                conditionsLicenceAccepteesLe: true,
                conditionsLicenceAccepteesPar: true,
                conditionsLicenceCommande: true,
                licence: { select: { type: true } },
            },
        });
        if (!t)
            throw new common_1.NotFoundException('Dossier introuvable.');
        const acceptation = t.conditionsLicenceVersion !== null && t.conditionsLicenceAccepteesLe !== null
            ? {
                version: t.conditionsLicenceVersion,
                empreinte: t.conditionsLicenceEmpreinte,
                le: t.conditionsLicenceAccepteesLe.toISOString(),
                par: t.conditionsLicenceAccepteesPar,
                commande: commandeGardee(t.conditionsLicenceCommande),
            }
            : null;
        const contexte = {
            mentions: (0, conditions_de_licence_1.mentionsAArreter)(),
            typeLicence: t.licence ? LICENCES[t.licence.type] : null,
            estDemonstration: t.estDemonstration === true,
            surSite: (0, mode_installation_1.estSurSite)(),
            commande: await this.commande(client, tenantId, t.dossierMereId),
        };
        return { acceptation, contexte, nom: t.nom };
    }
    async etat(tenantId) {
        const { acceptation, contexte } = await this.lire(this.prisma, tenantId);
        return (0, acceptation_conditions_1.etatConditions)(acceptation, contexte, await this.dernierAccuse(this.prisma, tenantId, acceptation));
    }
    async dernierAccuse(client, tenantId, acceptation) {
        if (!acceptation)
            return null;
        const m = await client.message.findFirst({
            where: { tenantId, origine: courrier_service_1.ORIGINE_CONDITIONS_LICENCE, origineId: tenantId, createdAt: { gte: new Date(acceptation.le) } },
            orderBy: { createdAt: 'desc' },
            select: { statut: true, createdAt: true },
        });
        return m ? { statut: STATUTS[m.statut], le: m.createdAt.toISOString() } : null;
    }
    async renvoyerAccuse(tenantId, auteur) {
        const courrier = this.courrier;
        const r = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`conditions-licence:${tenantId}`}))`;
            const { acceptation, contexte, nom } = await this.lire(tx, tenantId);
            const dernier = await this.dernierAccuse(tx, tenantId, acceptation);
            const refus = (0, acceptation_conditions_1.motifRefusRenvoiAccuse)(acceptation, (0, acceptation_conditions_1.estAJour)(acceptation), dernier);
            if (refus || !acceptation)
                throw new common_1.ConflictException(refus ?? 'Aucune acceptation à accuser.');
            if (!courrier)
                return { acceptation, contexte, accuse: null };
            try {
                const [ecrit] = await courrier.ecrireEnFileSansTenter(tx, tenantId, [
                    {
                        destinataire: acceptation.par ?? auteur.email,
                        ...(0, accuse_reception_conditions_1.accuseReceptionConditions)(acceptation, nom),
                        origine: courrier_service_1.ORIGINE_CONDITIONS_LICENCE,
                        origineId: tenantId,
                        createdBy: auteur.userId,
                    },
                ]);
                if (ecrit.statut === null) {
                    this.consignerAccuseManque(tenantId, acceptation.version, ecrit.motif);
                    return { acceptation, contexte, accuse: { statut: 'NON_MIS_EN_FILE' } };
                }
                return { acceptation, contexte, accuse: { statut: STATUTS[ecrit.statut] } };
            }
            catch (erreur) {
                this.consignerAccuseManque(tenantId, acceptation.version, erreur);
                return { acceptation, contexte, accuse: { statut: 'NON_MIS_EN_FILE' } };
            }
        });
        return {
            etat: (0, acceptation_conditions_1.etatConditions)(r.acceptation, r.contexte, await this.dernierAccuse(this.prisma, tenantId, r.acceptation)),
            accuse: r.accuse,
        };
    }
    async accepter(tenantId, auteur, versionLue, empreinteLue, empreinteCommandeLue) {
        const resultat = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`conditions-licence:${tenantId}`}))`;
            const { acceptation, contexte, nom } = await this.lire(tx, tenantId);
            if (acceptation && (0, acceptation_conditions_1.estAJour)(acceptation))
                return { deja: true, acceptation, contexte, nom };
            const refus = (0, acceptation_conditions_1.motifRefusAcceptation)(versionLue, empreinteLue, empreinteCommandeLue, contexte);
            if (refus)
                throw new common_1.ConflictException(refus);
            const le = new Date();
            const empreinte = (0, versions_publiees_1.empreinteEnVigueur)();
            await tx.tenant.update({
                where: { id: tenantId },
                data: {
                    conditionsLicenceVersion: conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.numero,
                    conditionsLicenceEmpreinte: empreinte,
                    conditionsLicenceAccepteesLe: le,
                    conditionsLicenceAccepteesPar: auteur.email,
                    conditionsLicenceCommande: contexte.commande === null ? client_1.Prisma.DbNull : contexte.commande,
                },
            });
            const faite = {
                version: conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.numero,
                empreinte,
                le: le.toISOString(),
                par: auteur.email,
                commande: contexte.commande,
            };
            return { deja: false, acceptation: faite, contexte, nom };
        });
        const accuse = resultat.deja ? null : await this.accuserReception(tenantId, auteur.email, auteur.userId, resultat.acceptation, resultat.nom);
        return {
            etat: (0, acceptation_conditions_1.etatConditions)(resultat.acceptation, resultat.contexte, await this.dernierAccuse(this.prisma, tenantId, resultat.acceptation)),
            deja: resultat.deja,
            accuse,
        };
    }
    async accuserReception(tenantId, destinataire, createdBy, acceptation, dossier) {
        if (!this.courrier)
            return null;
        try {
            const r = await this.courrier.mettreEnFile(tenantId, {
                destinataire,
                ...(0, accuse_reception_conditions_1.accuseReceptionConditions)(acceptation, dossier),
                origine: courrier_service_1.ORIGINE_CONDITIONS_LICENCE,
                origineId: tenantId,
                createdBy,
            });
            return { statut: STATUTS[r.statut] };
        }
        catch (erreur) {
            this.consignerAccuseManque(tenantId, acceptation.version, erreur);
            return { statut: 'NON_MIS_EN_FILE' };
        }
    }
    consignerAccuseManque(tenantId, version, cause) {
        this.logger.error(`Accusé de réception des conditions non mis en file · dossier ${tenantId}, version ${version} · ${cause instanceof Error ? cause.message : String(cause)}`);
    }
};
exports.ConditionsLicenceService = ConditionsLicenceService;
exports.ConditionsLicenceService = ConditionsLicenceService = ConditionsLicenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        courrier_service_1.CourrierService])
], ConditionsLicenceService);
//# sourceMappingURL=conditions-licence.service.js.map