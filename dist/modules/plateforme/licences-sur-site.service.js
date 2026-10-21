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
exports.LicencesSurSiteService = void 0;
exports.jourKinshasa = jourKinshasa;
exports.numeroSuivant = numeroSuivant;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../common/prisma.service");
const cle_publique_editeur_1 = require("../sur-site/cle-publique-editeur");
const licence_signee_1 = require("../sur-site/licence-signee");
const echeance_1 = require("../../common/echeance");
const plafond_console_1 = require("./plafond-console");
function jourKinshasa(d = new Date()) {
    return (0, echeance_1.jourDeKinshasaIso)(d);
}
function numeroSuivant(annee, numerosDeLAnnee) {
    const prefixe = `OMX-${annee}-`;
    const max = numerosDeLAnnee
        .filter((n) => n.startsWith(prefixe))
        .map((n) => Number.parseInt(n.slice(prefixe.length), 10))
        .filter(Number.isInteger)
        .reduce((a, b) => Math.max(a, b), 0);
    return `${prefixe}${String(max + 1).padStart(4, '0')}`;
}
let LicencesSurSiteService = class LicencesSurSiteService {
    constructor(prisma, env = process.env, clePublique = cle_publique_editeur_1.CLE_PUBLIQUE_EDITEUR) {
        this.prisma = prisma;
        this.env = env;
        this.clePublique = clePublique;
    }
    async lister() {
        const [licences, total] = await Promise.all([
            this.prisma.licenceSurSiteEmise.findMany({
                orderBy: { createdAt: 'desc' },
                take: plafond_console_1.PLAFOND_LISTE_CONSOLE,
                select: {
                    id: true,
                    numero: true,
                    titulaire: true,
                    empreinteMachine: true,
                    emiseLe: true,
                    finMaintenance: true,
                    expiration: true,
                    dossiersMax: true,
                    emisePar: true,
                    createdAt: true,
                },
            }),
            this.prisma.licenceSurSiteEmise.count(),
        ]);
        return { licences, ...(0, plafond_console_1.tranche)(licences.length, total) };
    }
    async fichier(id) {
        const l = await this.prisma.licenceSurSiteEmise.findUnique({ where: { id }, select: { numero: true, fichier: true } });
        if (!l)
            throw new common_1.NotFoundException('Licence introuvable.');
        return l;
    }
    async emettre(demande, operateur, maintenant = new Date()) {
        const clePrivee = this.env.CLE_PRIVEE_LICENCE?.replace(/\\n/g, '\n').trim();
        if (!clePrivee) {
            throw new common_1.BadRequestException('La clé privée de signature n’est pas posée sur ce serveur (secret API_CLE_PRIVEE_LICENCE) · aucune licence ne peut être émise.');
        }
        if (!this.clePublique) {
            throw new common_1.BadRequestException('Cette version ne porte pas la clé publique de VMG · une licence émise ne pourrait être vérifiée nulle part.');
        }
        const emiseLe = jourKinshasa(maintenant);
        const annee = emiseLe.slice(0, 4);
        const deLAnnee = await this.prisma.licenceSurSiteEmise.findMany({
            where: { numero: { startsWith: `OMX-${annee}-` } },
            select: { numero: true },
        });
        const contenu = {
            format: licence_signee_1.FORMAT_LICENCE,
            numero: numeroSuivant(annee, deLAnnee.map((l) => l.numero)),
            titulaire: demande.titulaire.trim(),
            empreinteMachine: demande.empreinteMachine.trim().toLowerCase(),
            emiseLe,
            finMaintenance: demande.finMaintenance,
            expiration: demande.expiration || null,
            dossiersMax: demande.dossiersMax,
        };
        const motif = (0, licence_signee_1.motifRefusContenu)(contenu);
        if (motif)
            throw new common_1.BadRequestException(`Licence irrecevable · ${motif}.`);
        let texte;
        try {
            (0, crypto_1.createPublicKey)(this.clePublique);
            texte = JSON.stringify((0, licence_signee_1.signerLicence)(contenu, clePrivee), null, 2);
        }
        catch (e) {
            throw new common_1.BadRequestException(`La signature a échoué · ${e.message}`);
        }
        const controle = (0, licence_signee_1.verifierLicence)(texte, {
            clePubliquePem: this.clePublique,
            empreinte: contenu.empreinteMachine,
            aujourdhui: emiseLe,
            horlogeMax: null,
            dateVersion: emiseLe,
        });
        if (controle.statut === 'SIGNATURE_INVALIDE') {
            throw new common_1.BadRequestException('La clé privée posée sur ce serveur ne correspond pas à la clé publique du logiciel · la licence serait refusée par tous les postes. Rien n’a été enregistré.');
        }
        if (controle.statut !== 'VALIDE') {
            throw new common_1.BadRequestException(controle.motif ?? `Licence refusée au contrôle · ${controle.statut}`);
        }
        return this.prisma.licenceSurSiteEmise.create({
            data: {
                numero: contenu.numero,
                titulaire: contenu.titulaire,
                empreinteMachine: contenu.empreinteMachine,
                emiseLe: contenu.emiseLe,
                finMaintenance: contenu.finMaintenance,
                expiration: contenu.expiration,
                dossiersMax: contenu.dossiersMax,
                fichier: texte,
                emisePar: operateur,
            },
            select: { id: true, numero: true, fichier: true },
        });
    }
};
exports.LicencesSurSiteService = LicencesSurSiteService;
exports.LicencesSurSiteService = LicencesSurSiteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object, Object])
], LicencesSurSiteService);
//# sourceMappingURL=licences-sur-site.service.js.map