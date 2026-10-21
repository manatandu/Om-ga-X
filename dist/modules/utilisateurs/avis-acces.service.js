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
exports.AvisAccesService = exports.LIBELLE_ROLE = void 0;
exports.avisCompteCree = avisCompteCree;
exports.avisReinitialisation = avisReinitialisation;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const courrier_service_1 = require("../courrier/courrier.service");
exports.LIBELLE_ROLE = {
    [client_1.RoleUtilisateur.ADMIN_CABINET]: 'Administrateur',
    [client_1.RoleUtilisateur.COMPTABLE]: 'Comptable',
    [client_1.RoleUtilisateur.LECTURE_SEULE]: 'Lecture seule',
    [client_1.RoleUtilisateur.AIDE_COMPTABLE]: 'Aide-comptable',
    [client_1.RoleUtilisateur.GESTIONNAIRE_PAIE]: 'Gestionnaire de paie',
};
function mention(entite) {
    const nom = entite.trim();
    return nom.length > 0 ? ` (${nom})` : '';
}
function signature(entite) {
    return entite.trim().length > 0 ? entite.trim() : 'OmegaX';
}
function designation(entite) {
    const nom = entite.trim();
    return nom.length > 0 ? `au dossier « ${nom} »` : 'à un dossier';
}
function avisCompteCree(params) {
    return {
        sujet: `OmegaX · un accès a été ouvert à votre nom${mention(params.entite)}`,
        corps: [
            'Madame, Monsieur,',
            '',
            `Un accès ${designation(params.entite)} vient d'être ouvert à votre nom dans OmegaX, avec le rôle « ${exports.LIBELLE_ROLE[params.role]} ».`,
            '',
            `Votre identifiant est votre adresse de courriel : ${params.email}.`,
            '',
            "Votre mot de passe ne figure pas dans ce message. Il est provisoire, il a été choisi par l'administrateur qui a ouvert votre accès, et c'est lui qui vous le remet. Le logiciel vous demandera de le remplacer par le vôtre dès votre première connexion, et n'ouvrira aucune autre fenêtre tant que ce ne sera pas fait.",
            '',
            "Si vous n'attendiez pas cet accès, signalez-le à l'administrateur de votre dossier.",
            '',
            signature(params.entite),
        ].join('\n'),
    };
}
function avisReinitialisation(params) {
    return {
        sujet: `OmegaX · votre mot de passe a été réinitialisé${mention(params.entite)}`,
        corps: [
            'Madame, Monsieur,',
            '',
            `L'administrateur ${designation(params.entite)} vient de réinitialiser le mot de passe de votre compte OmegaX (${params.email}).`,
            '',
            "Ce mot de passe ne figure pas dans ce message. Il est provisoire, et c'est l'administrateur qui l'a posé qui vous le remet. Le logiciel vous demandera de le remplacer par le vôtre dès votre prochaine connexion.",
            '',
            "Vos sessions ouvertes ont toutes été fermées, y compris sur vos autres postes. C'est voulu : un mot de passe perdu peut avoir été trouvé par quelqu'un d'autre.",
            '',
            "Si vous n'avez pas demandé cette réinitialisation, prévenez sans attendre l'administrateur de votre dossier.",
            '',
            signature(params.entite),
        ].join('\n'),
    };
}
let AvisAccesService = class AvisAccesService {
    constructor(prisma, courrier) {
        this.prisma = prisma;
        this.courrier = courrier;
    }
    async annoncerCompteCree(tenantId, compte) {
        const entite = await this.nomDuDossier(tenantId);
        return this.remettre(tenantId, {
            destinataire: compte.email,
            ...avisCompteCree({ entite, email: compte.email, role: compte.role }),
            origineId: compte.userId,
            createdBy: compte.parQui,
        });
    }
    async annoncerReinitialisation(tenantId, compte) {
        const entite = await this.nomDuDossier(tenantId);
        return this.remettre(tenantId, {
            destinataire: compte.email,
            ...avisReinitialisation({ entite, email: compte.email }),
            origineId: compte.userId,
            createdBy: compte.parQui,
        });
    }
    async nomDuDossier(tenantId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { nom: true } });
        return tenant?.nom ?? '';
    }
    async remettre(tenantId, avis) {
        try {
            const message = await this.courrier.mettreEnFile(tenantId, {
                destinataire: avis.destinataire,
                sujet: avis.sujet,
                corps: avis.corps,
                origine: courrier_service_1.ORIGINE_MOT_DE_PASSE_TEMPORAIRE,
                origineId: avis.origineId,
                createdBy: avis.createdBy,
            });
            return { avise: true, destinataire: avis.destinataire, statut: message.statut, motif: null };
        }
        catch (erreur) {
            return {
                avise: false,
                destinataire: avis.destinataire,
                statut: null,
                motif: erreur instanceof Error
                    ? `Le titulaire n'a pas pu être averti · ${erreur.message}`
                    : "Le titulaire n'a pas pu être averti · la file a refusé le message.",
            };
        }
    }
};
exports.AvisAccesService = AvisAccesService;
exports.AvisAccesService = AvisAccesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        courrier_service_1.CourrierService])
], AvisAccesService);
//# sourceMappingURL=avis-acces.service.js.map