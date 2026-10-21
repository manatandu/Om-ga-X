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
exports.UtilisateurService = exports.MOTIF_DERNIER_ADMINISTRATEUR = exports.MOTIF_ADRESSE_PRISE = void 0;
exports.retireUnAdministrateur = retireUnAdministrateur;
const common_1 = require("@nestjs/common");
const courriel_1 = require("../../common/courriel");
const double_authentification_1 = require("../auth/double-authentification");
const verrouillage_1 = require("../auth/verrouillage");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const SALT_ROUNDS = 12;
const SELECTION = {
    id: true,
    email: true,
    role: true,
    estActif: true,
    doitChangerMotDePasse: true,
    verrouilleJusqua: true,
    doubleAuthActiveDepuis: true,
    createdAt: true,
    restreindreFonctions: true,
    fonctionsAutorisees: true,
    restreindreJournaux: true,
    journauxAutorises: true,
};
exports.MOTIF_ADRESSE_PRISE = 'Un compte existe déjà avec cet email';
exports.MOTIF_DERNIER_ADMINISTRATEUR = "C'est le dernier administrateur actif du dossier · nommez d'abord un autre administrateur, sans quoi plus personne ne " +
    'pourrait gérer les comptes ni les paramètres du dossier.';
function retireUnAdministrateur(user, dto) {
    if (user.role !== client_1.RoleUtilisateur.ADMIN_CABINET || !user.estActif)
        return false;
    return (dto.role !== undefined && dto.role !== client_1.RoleUtilisateur.ADMIN_CABINET) || dto.estActif === false;
}
let UtilisateurService = class UtilisateurService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId) {
        return this.prisma.user.findMany({ where: { tenantId }, select: SELECTION, orderBy: { createdAt: 'asc' } });
    }
    async creer(tenantId, dto) {
        dto = { ...dto, email: (0, courriel_1.normaliserCourriel)(dto.email) };
        const existant = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existant) {
            throw new common_1.ConflictException(exports.MOTIF_ADRESSE_PRISE);
        }
        const motDePasseHache = await bcrypt.hash(dto.motDePasse, SALT_ROUNDS);
        try {
            return await this.prisma.user.create({
                data: { tenantId, email: dto.email, motDePasse: motDePasseHache, role: dto.role, doitChangerMotDePasse: true },
                select: SELECTION,
            });
        }
        catch (e) {
            if (e?.code === 'P2002')
                throw new common_1.ConflictException(exports.MOTIF_ADRESSE_PRISE);
            throw e;
        }
    }
    async definirFonctions(tenantId, userId, dto) {
        const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
        if (!user)
            throw new common_1.NotFoundException('Utilisateur introuvable pour ce tenant');
        if (user.role === client_1.RoleUtilisateur.ADMIN_CABINET && dto.restreindre) {
            throw new common_1.BadRequestException("Un administrateur n'est jamais restreint · c'est lui qui ouvre et ferme les fonctions des autres. Changez d'abord son rôle.");
        }
        const inconnue = dto.fonctions.find((f) => !Object.values(client_1.FonctionMetier).includes(f));
        if (inconnue)
            throw new common_1.BadRequestException(`Fonction inconnue : ${inconnue}`);
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                restreindreFonctions: dto.restreindre,
                fonctionsAutorisees: dto.restreindre ? [...new Set(dto.fonctions)] : [],
                sessionsInvalidesAvant: new Date(),
            },
            select: SELECTION,
        });
    }
    async definirJournaux(tenantId, userId, dto) {
        const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
        if (!user)
            throw new common_1.NotFoundException('Utilisateur introuvable pour ce tenant');
        if (user.role === client_1.RoleUtilisateur.ADMIN_CABINET && dto.restreindre) {
            throw new common_1.BadRequestException("Un administrateur n'est jamais restreint · c'est lui qui ouvre et ferme les journaux des autres. Changez d'abord son rôle.");
        }
        const ids = [...new Set(dto.journaux)];
        if (dto.restreindre && ids.length) {
            const trouves = await this.prisma.journal.count({ where: { tenantId, id: { in: ids } } });
            if (trouves !== ids.length)
                throw new common_1.BadRequestException('Un des journaux cochés n’appartient pas à ce dossier.');
        }
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                restreindreJournaux: dto.restreindre,
                journauxAutorises: dto.restreindre ? ids : [],
                sessionsInvalidesAvant: new Date(),
            },
            select: SELECTION,
        });
    }
    async modifier(tenantId, userId, utilisateurCourantId, dto) {
        const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur introuvable pour ce tenant');
        }
        if (userId === utilisateurCourantId && dto.estActif === false) {
            throw new common_1.BadRequestException('Impossible de désactiver son propre compte');
        }
        const ecrire = (client) => client.user.update({
            where: { id: userId },
            data: {
                ...dto,
                ...(dto.estActif === false || dto.role !== undefined ? { sessionsInvalidesAvant: new Date() } : {}),
            },
            select: SELECTION,
        });
        if (!retireUnAdministrateur(user, dto))
            return ecrire(this.prisma);
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`administrateurs:${tenantId}`}))`;
            const autres = await tx.user.count({
                where: { tenantId, role: client_1.RoleUtilisateur.ADMIN_CABINET, estActif: true, id: { not: userId } },
            });
            if (autres === 0)
                throw new common_1.BadRequestException(exports.MOTIF_DERNIER_ADMINISTRATEUR);
            return ecrire(tx);
        });
    }
    async reinitialiserMotDePasse(tenantId, userId, motDePasseProvisoire) {
        const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur introuvable pour ce tenant');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                motDePasse: await bcrypt.hash(motDePasseProvisoire, SALT_ROUNDS),
                doitChangerMotDePasse: true,
                sessionsInvalidesAvant: new Date(),
                ...verrouillage_1.DECOMPTE_REMIS_A_ZERO,
                ...double_authentification_1.SANS_DOUBLE_AUTH,
            },
        });
        return { reinitialise: true, email: user.email };
    }
    async deverrouiller(tenantId, userId) {
        const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur introuvable pour ce tenant');
        }
        return this.prisma.user.update({
            where: { id: userId },
            data: verrouillage_1.DECOMPTE_REMIS_A_ZERO,
            select: SELECTION,
        });
    }
};
exports.UtilisateurService = UtilisateurService;
exports.UtilisateurService = UtilisateurService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UtilisateurService);
//# sourceMappingURL=utilisateur.service.js.map