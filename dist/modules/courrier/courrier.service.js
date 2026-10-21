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
exports.CourrierService = exports.LISTE_PAR_DEFAUT = exports.REPRISE_PAR_APPEL = exports.ORIGINE_CONDITIONS_LICENCE = exports.ORIGINE_DOUBLE_AUTHENTIFICATION = exports.ORIGINE_FACTURE_ABONNEMENT = exports.ORIGINE_LICENCE_SUR_SITE = exports.ORIGINE_MOT_DE_PASSE_TEMPORAIRE = exports.ORIGINE_RELANCE = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const adresse_courriel_1 = require("./adresse-courriel");
const report_tentatives_1 = require("./report-tentatives");
const transport_courriel_1 = require("./transport-courriel");
exports.ORIGINE_RELANCE = 'RELANCE';
exports.ORIGINE_MOT_DE_PASSE_TEMPORAIRE = 'MOT_DE_PASSE_TEMPORAIRE';
exports.ORIGINE_LICENCE_SUR_SITE = 'LICENCE_SUR_SITE';
exports.ORIGINE_FACTURE_ABONNEMENT = 'FACTURE_ABONNEMENT';
exports.ORIGINE_DOUBLE_AUTHENTIFICATION = 'DOUBLE_AUTHENTIFICATION';
exports.ORIGINE_CONDITIONS_LICENCE = 'CONDITIONS_LICENCE';
const DELAI_ORPHELIN_MS = 5 * 60_000;
exports.REPRISE_PAR_APPEL = 25;
const REPRISE_MAXIMUM = 100;
exports.LISTE_PAR_DEFAUT = 200;
const LISTE_MAXIMUM = 500;
const CHAMPS_LISTE = {
    id: true,
    destinataire: true,
    destinataireNom: true,
    sujet: true,
    origine: true,
    origineId: true,
    statut: true,
    tentatives: true,
    dernierEssaiAt: true,
    prochainEssaiAt: true,
    erreur: true,
    envoyeAt: true,
    createdBy: true,
    createdAt: true,
};
let CourrierService = class CourrierService {
    constructor(prisma, transport) {
        this.prisma = prisma;
        this.transport = transport;
    }
    etatDuTransport() {
        return this.transport.etat();
    }
    async mettreEnFile(tenantId, message) {
        const ligne = await this.prisma.message.create({ data: this.preparer(tenantId, message) });
        return this.tenter(tenantId, ligne);
    }
    async envoyerUnSecret(tenantId, message, corpsGarde) {
        if (!this.transport.etat().configure) {
            throw new common_1.ConflictException("Aucune messagerie n'est configurée · un mot de passe ne s'envoie que directement, jamais mis en file.");
        }
        if (corpsGarde.includes(message.corps)) {
            throw new common_1.BadRequestException('Le corps gardé reprend le message entier · le secret serait écrit dans la file.');
        }
        const donnees = this.preparer(tenantId, { ...message, corps: corpsGarde, pieceJointe: null });
        try {
            await this.transport.envoyer({
                destinataire: donnees.destinataire,
                destinataireNom: donnees.destinataireNom ?? null,
                sujet: donnees.sujet,
                corps: message.corps,
                pieceJointe: null,
            });
        }
        catch (erreur) {
            throw new common_1.ServiceUnavailableException(`Le courriel n'est pas parti · ${(0, transport_courriel_1.texteDErreur)(erreur)}. Rien n'a été changé, recommencez.`);
        }
        const maintenant = new Date();
        const ligne = await this.prisma.message.create({
            data: {
                ...donnees,
                statut: client_1.StatutMessage.ENVOYE,
                tentatives: 1,
                dernierEssaiAt: maintenant,
                envoyeAt: maintenant,
                prochainEssaiAt: null,
                erreur: null,
            },
        });
        return { id: ligne.id, statut: client_1.StatutMessage.ENVOYE, erreur: null };
    }
    async ecrireEnFileSansTenter(client, tenantId, messages) {
        const etat = this.transport.etat().configure
            ? { statut: client_1.StatutMessage.EN_ATTENTE, prochainEssaiAt: new Date() }
            : { statut: client_1.StatutMessage.SANS_TRANSPORT };
        const lignes = [];
        const resultats = messages.map((message) => {
            try {
                const id = (0, crypto_1.randomUUID)();
                lignes.push({ ...this.preparer(tenantId, message), id, ...etat });
                return { id, statut: etat.statut, motif: null };
            }
            catch (erreur) {
                if (!(erreur instanceof common_1.BadRequestException))
                    throw erreur;
                return { id: null, statut: null, motif: erreur.message };
            }
        });
        if (lignes.length > 0)
            await client.message.createMany({ data: lignes });
        return resultats;
    }
    preparer(tenantId, message) {
        const destinataire = (0, adresse_courriel_1.normaliserAdresse)(message.destinataire);
        if (!(0, adresse_courriel_1.adresseAcceptable)(destinataire)) {
            throw new common_1.BadRequestException(`Adresse de destinataire inutilisable · « ${destinataire || '(vide)'} ». Le message n'a pas été mis en file.`);
        }
        const sujet = (message.sujet ?? '').trim();
        if (sujet.length === 0) {
            throw new common_1.BadRequestException("Message sans objet · le sujet est obligatoire.");
        }
        if ((message.corps ?? '').trim().length === 0) {
            throw new common_1.BadRequestException('Message sans corps · rien à envoyer.');
        }
        const origine = (message.origine ?? '').trim();
        if (origine.length === 0) {
            throw new common_1.BadRequestException("Message sans origine · la file serait illisible sans elle.");
        }
        const piece = message.pieceJointe ?? null;
        if (piece && (piece.nom.trim().length === 0 || piece.texte.trim().length === 0)) {
            throw new common_1.BadRequestException('Pièce jointe sans nom ou sans contenu · le message n’a pas été mis en file.');
        }
        return {
            tenantId,
            destinataire,
            destinataireNom: message.destinataireNom ?? null,
            sujet,
            corps: message.corps,
            origine,
            origineId: message.origineId ?? null,
            createdBy: message.createdBy ?? null,
            pieceJointeNom: piece?.nom.trim() ?? null,
            pieceJointeTexte: piece?.texte ?? null,
        };
    }
    async reprendre(tenantId, limite = exports.REPRISE_PAR_APPEL) {
        const etat = this.transport.etat();
        const maintenant = new Date();
        if (!etat.configure) {
            return {
                transportConfigure: false,
                manques: etat.manques,
                examines: 0,
                envoyes: 0,
                echoues: 0,
                abandonnes: 0,
                ignores: 0,
                restants: await this.prisma.message.count({ where: this.filtreEligibles(tenantId, maintenant) }),
            };
        }
        const candidats = await this.prisma.message.findMany({
            where: this.filtreEligibles(tenantId, maintenant),
            orderBy: { createdAt: 'asc' },
            take: Math.min(Math.max(1, Math.trunc(limite)), REPRISE_MAXIMUM),
        });
        const bilan = {
            transportConfigure: true,
            manques: [],
            examines: 0,
            envoyes: 0,
            echoues: 0,
            abandonnes: 0,
            ignores: 0,
            restants: 0,
        };
        for (const candidat of candidats) {
            if (!(await this.revendiquer(tenantId, candidat, new Date()))) {
                bilan.ignores += 1;
                continue;
            }
            bilan.examines += 1;
            try {
                const resultat = await this.tenter(tenantId, candidat);
                if (resultat.statut === client_1.StatutMessage.ENVOYE)
                    bilan.envoyes += 1;
                else if (resultat.statut === client_1.StatutMessage.ABANDONNE)
                    bilan.abandonnes += 1;
                else
                    bilan.echoues += 1;
            }
            catch {
                bilan.examines -= 1;
                bilan.ignores += 1;
            }
        }
        bilan.restants = await this.prisma.message.count({
            where: this.filtreEligibles(tenantId, new Date()),
        });
        return bilan;
    }
    async lister(tenantId, options = {}) {
        const plafond = Math.min(Math.max(1, Math.trunc(options.limite ?? exports.LISTE_PAR_DEFAUT)), LISTE_MAXIMUM);
        const etat = options.statut ? { statut: options.statut } : {};
        const total = await this.prisma.message.count({ where: { tenantId, ...etat } });
        const messages = await this.prisma.message.findMany({
            where: { tenantId, ...etat },
            orderBy: { createdAt: 'desc' },
            take: plafond,
            select: CHAMPS_LISTE,
        });
        return { messages, total, plafond, tronque: total > messages.length };
    }
    async lire(tenantId, id) {
        const message = await this.prisma.message.findFirst({ where: { id, tenantId } });
        if (!message)
            throw new common_1.NotFoundException('Message introuvable dans ce dossier');
        return message;
    }
    async compterParStatut(tenantId) {
        const groupes = await this.prisma.message.groupBy({
            by: ['statut'],
            where: { tenantId },
            _count: { _all: true },
        });
        const compteurs = Object.values(client_1.StatutMessage).reduce((acc, statut) => ({ ...acc, [statut]: 0 }), {});
        for (const groupe of groupes)
            compteurs[groupe.statut] = groupe._count._all;
        return {
            ...compteurs,
            aRelancer: await this.prisma.message.count({ where: this.filtreEligibles(tenantId, new Date()) }),
        };
    }
    filtreEligibles(tenantId, maintenant) {
        const seuilOrphelin = new Date(maintenant.getTime() - DELAI_ORPHELIN_MS);
        return {
            tenantId,
            OR: [
                { statut: client_1.StatutMessage.SANS_TRANSPORT },
                { statut: client_1.StatutMessage.ECHEC, prochainEssaiAt: { lte: maintenant } },
                { statut: client_1.StatutMessage.ECHEC, prochainEssaiAt: null },
                { statut: client_1.StatutMessage.EN_ATTENTE, dernierEssaiAt: null, prochainEssaiAt: { lte: maintenant } },
                { statut: client_1.StatutMessage.EN_ATTENTE, dernierEssaiAt: null, createdAt: { lte: seuilOrphelin } },
                { statut: client_1.StatutMessage.EN_ATTENTE, dernierEssaiAt: { lte: seuilOrphelin } },
            ],
        };
    }
    async revendiquer(tenantId, ligne, maintenant) {
        const { count } = await this.prisma.message.updateMany({
            where: {
                id: ligne.id,
                tenantId,
                statut: ligne.statut,
                tentatives: ligne.tentatives,
                dernierEssaiAt: ligne.dernierEssaiAt,
            },
            data: { statut: client_1.StatutMessage.EN_ATTENTE, dernierEssaiAt: maintenant },
        });
        return count === 1;
    }
    async tenter(tenantId, ligne) {
        if (!this.transport.etat().configure) {
            return this.marquer(tenantId, ligne.id, { statut: client_1.StatutMessage.SANS_TRANSPORT, erreur: null });
        }
        const maintenant = new Date();
        const tentatives = ligne.tentatives + 1;
        try {
            await this.transport.envoyer({
                destinataire: ligne.destinataire,
                destinataireNom: ligne.destinataireNom,
                sujet: ligne.sujet,
                corps: ligne.corps,
                pieceJointe: ligne.pieceJointeNom && ligne.pieceJointeTexte ? { nom: ligne.pieceJointeNom, texte: ligne.pieceJointeTexte } : null,
            });
            return this.marquer(tenantId, ligne.id, {
                statut: client_1.StatutMessage.ENVOYE,
                tentatives,
                dernierEssaiAt: maintenant,
                envoyeAt: maintenant,
                prochainEssaiAt: null,
                erreur: null,
            });
        }
        catch (erreur) {
            const statut = (0, report_tentatives_1.statutApresEchec)(tentatives);
            return this.marquer(tenantId, ligne.id, {
                statut,
                tentatives,
                dernierEssaiAt: maintenant,
                prochainEssaiAt: (0, report_tentatives_1.prochainEssaiApresEchec)(tentatives, maintenant),
                erreur: (0, transport_courriel_1.texteDErreur)(erreur),
            });
        }
    }
    async marquer(tenantId, id, champs) {
        const { count } = await this.prisma.message.updateMany({ where: { id, tenantId }, data: champs });
        if (count !== 1)
            throw new common_1.NotFoundException('Message introuvable dans ce dossier');
        return { id, statut: champs.statut, erreur: champs.erreur };
    }
};
exports.CourrierService = CourrierService;
exports.CourrierService = CourrierService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        transport_courriel_1.TransportCourriel])
], CourrierService);
//# sourceMappingURL=courrier.service.js.map