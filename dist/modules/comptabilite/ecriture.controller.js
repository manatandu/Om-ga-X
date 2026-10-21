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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcritureController = void 0;
const common_1 = require("@nestjs/common");
const recherche_ecritures_1 = require("./recherche-ecritures");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const ecriture_service_1 = require("./ecriture.service");
const familles_tiers_1 = require("./familles-tiers");
const ecriture_service_2 = require("./ecriture.service");
const creer_ecriture_dto_1 = require("./dto/creer-ecriture.dto");
const corriger_ecriture_dto_1 = require("./dto/corriger-ecriture.dto");
const reimputer_dto_1 = require("./dto/reimputer.dto");
const brouillard_dto_1 = require("./dto/brouillard.dto");
const client_1 = require("@prisma/client");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const exercice_requis_1 = require("../../common/exercice-requis");
const journal_du_dossier_1 = require("../../common/journal-du-dossier");
const periode_extrait_1 = require("./periode-extrait");
let EcritureController = class EcritureController {
    constructor(ecritureService) {
        this.ecritureService = ecritureService;
    }
    async creer(user, dto) {
        await this.ecritureService.verifierComptesCollectifs(user.tenantId, dto.lignes);
        await this.ecritureService.verifierComptesPersonnalises(user.tenantId, dto.lignes);
        await this.ecritureService.verifierComptesEnSommeil(user.tenantId, dto.lignes, dto.confirmerComptesEnSommeil);
        return this.ecritureService.creer(user.tenantId, user.userId, dto, { saisie: true, jugerLaCaisse: true });
    }
    async imputerOuverture(user, dto) {
        return this.ecritureService.imputerAuxCapitauxPropresDOuverture(user.tenantId, user.userId, dto);
    }
    async fusionnerComptes(user, dto) {
        await this.ecritureService.verifierComptesCollectifs(user.tenantId, [{ compteId: dto.compteCibleId }], undefined, dto.compteSourceId);
        await this.ecritureService.verifierComptesPersonnalises(user.tenantId, [{ compteId: dto.compteCibleId }], 'une fusion');
        return this.ecritureService.fusionnerComptes(user.tenantId, user.userId, dto.compteSourceId, dto.compteCibleId, dto.motif);
    }
    async reimputer(user, dto) {
        await this.ecritureService.verifierComptesCollectifs(user.tenantId, [{ compteId: dto.compteCibleId }]);
        await this.ecritureService.verifierComptesPersonnalises(user.tenantId, [{ compteId: dto.compteCibleId }], 'une réimputation');
        return this.ecritureService.reimputer(user.tenantId, user.userId, dto);
    }
    async corriger(user, id, dto) {
        return this.ecritureService.corrigerParInscriptionEnNegatif(user.tenantId, user.userId, id, dto);
    }
    async brouillard(user, exerciceId, journalId, dateDebut, dateFin) {
        return this.ecritureService.brouillard(user.tenantId, { exerciceId, journalId, dateDebut, dateFin });
    }
    async modifier(user, id, dto) {
        await this.ecritureService.verifierComptesCollectifs(user.tenantId, dto.lignes, id);
        await this.ecritureService.verifierComptesPersonnalises(user.tenantId, dto.lignes);
        await this.ecritureService.verifierComptesEnSommeil(user.tenantId, dto.lignes, dto.confirmerComptesEnSommeil);
        return this.ecritureService.modifier(user.tenantId, id, dto, { jugerLaCaisse: true });
    }
    async transferer(user, id, dto) {
        return this.ecritureService.transfererDansUnJournalOrdinaire(user.tenantId, id, dto);
    }
    async supprimer(user, id) {
        return this.ecritureService.supprimer(user.tenantId, id);
    }
    async valider(user, dto) {
        return this.ecritureService.valider(user.tenantId, user.userId, dto.ecritureIds, dto);
    }
    async validerJusqua(user, dto) {
        return this.ecritureService.validerJusqua(user.tenantId, user.userId, dto);
    }
    async lister(user, exerciceId, journalId, dateDebut, dateFin, recherche, inclureBrouillard, limite, compte, montant, montantMax, numeroPiece, reference, plusRecentes) {
        const limiteN = limite ? Math.min(Math.max(parseInt(limite, 10) || 0, 0), 500) : undefined;
        return this.ecritureService.lister(user.tenantId, {
            exerciceId,
            journalId,
            dateDebut,
            dateFin,
            recherche,
            ...(0, recherche_ecritures_1.criteresOuRefus)({ compte, montant, montantMax, numeroPiece, reference }),
            inclureBrouillard: inclureBrouillard !== 'false',
            ...(limiteN ? { limite: limiteN } : {}),
            ...(plusRecentes === '1' ? { plusRecentesDAbord: true } : {}),
        });
    }
    async balance(user, exerciceId, regrouperTiers, du, au) {
        const periode = await this.ecritureService.periodeDemandee(user.tenantId, exerciceId, { du, au });
        const balance = regrouperTiers === '1'
            ? await this.ecritureService.balanceRegroupeeParCollectif(user.tenantId, exerciceId, periode ?? undefined)
            : await this.ecritureService.balance(user.tenantId, exerciceId, true, undefined, periode ? { periode } : {});
        return { ...balance, periode: (0, periode_extrait_1.periodeServie)(periode) };
    }
    async echeancier(user, exerciceId, dateReference) {
        return this.ecritureService.echeancier(user.tenantId, { exerciceId, dateReference });
    }
    async balanceAgee(user, exerciceId, dateReference, type) {
        const perimetre = type && type in ecriture_service_2.PERIMETRES_BALANCE_AGEE ? type : 'TOUS';
        return this.ecritureService.balanceAgee(user.tenantId, { exerciceId, dateReference, type: perimetre });
    }
    async balanceAuxiliaire(user, exerciceId, type) {
        if (type !== undefined && type !== 'TOUS' && !(0, familles_tiers_1.estFamilleTiers)(type)) {
            throw new common_1.BadRequestException('Type de tiers inconnu · TOUS, FOURNISSEURS, CLIENTS, SALARIES ou AUTRES.');
        }
        return this.ecritureService.balanceAuxiliaire(user.tenantId, { exerciceId, type });
    }
    async justificatifSolde(user, compteId, exerciceId, dateArret, masquerLettrees) {
        return this.ecritureService.justificatifSolde(user.tenantId, {
            compteId,
            exerciceId,
            dateArret,
            masquerLettrees: masquerLettrees === 'true',
        });
    }
    async evolutionSoldes(user, nbExercices) {
        return this.ecritureService.evolutionSoldes(user.tenantId, {
            nbExercices: nbExercices ? Number(nbExercices) : undefined,
        });
    }
    async grandLivreComplet(user, exerciceId, du, au) {
        const periode = await this.ecritureService.periodeDemandee(user.tenantId, exerciceId, { du, au });
        return this.ecritureService.grandLivreComplet(user.tenantId, exerciceId, periode ?? undefined);
    }
    async grandLivre(user, compteId, exerciceId, du, au) {
        const periode = await this.ecritureService.periodeDemandee(user.tenantId, exerciceId, { du, au });
        return this.ecritureService.grandLivre(user.tenantId, compteId, exerciceId, ecriture_service_2.PLAFOND_LIGNES_GRAND_LIVRE, periode ?? undefined);
    }
};
exports.EcritureController = EcritureController;
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, creer_ecriture_dto_1.CreerEcritureDto]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('imputation-ouverture'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, creer_ecriture_dto_1.ImputationOuvertureDto]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "imputerOuverture", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('fusion-comptes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reimputer_dto_1.FusionnerComptesDto]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "fusionnerComptes", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)('reimputation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reimputer_dto_1.ReimputerDto]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "reimputer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(':id/correction'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, corriger_ecriture_dto_1.CorrigerEcritureDto]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "corriger", null);
__decorate([
    (0, common_1.Get)('brouillard'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('journalId', journal_du_dossier_1.JOURNAL_FACULTATIF)),
    __param(3, (0, common_1.Query)('dateDebut')),
    __param(4, (0, common_1.Query)('dateFin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "brouillard", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, brouillard_dto_1.ModifierEcritureDto]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "modifier", null);
__decorate([
    (0, common_1.Post)(':id/transfert'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, brouillard_dto_1.TransfererEcritureDto]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "transferer", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "supprimer", null);
__decorate([
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)('valider'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, brouillard_dto_1.ValiderEcrituresDto]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "valider", null);
__decorate([
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)('valider-jusqua'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, brouillard_dto_1.ValiderJusquaDto]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "validerJusqua", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_FACULTATIF)),
    __param(2, (0, common_1.Query)('journalId', journal_du_dossier_1.JOURNAL_FACULTATIF)),
    __param(3, (0, common_1.Query)('dateDebut')),
    __param(4, (0, common_1.Query)('dateFin')),
    __param(5, (0, common_1.Query)('recherche')),
    __param(6, (0, common_1.Query)('inclureBrouillard')),
    __param(7, (0, common_1.Query)('limite')),
    __param(8, (0, common_1.Query)('compte')),
    __param(9, (0, common_1.Query)('montant')),
    __param(10, (0, common_1.Query)('montantMax')),
    __param(11, (0, common_1.Query)('numeroPiece')),
    __param(12, (0, common_1.Query)('reference')),
    __param(13, (0, common_1.Query)('plusRecentes')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('balance'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('regrouperTiers')),
    __param(3, (0, common_1.Query)('du')),
    __param(4, (0, common_1.Query)('au')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "balance", null);
__decorate([
    (0, common_1.Get)('echeancier'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('dateReference')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "echeancier", null);
__decorate([
    (0, common_1.Get)('balance-agee'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('dateReference')),
    __param(3, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "balanceAgee", null);
__decorate([
    (0, common_1.Get)('balance-auxiliaire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "balanceAuxiliaire", null);
__decorate([
    (0, common_1.Get)('justificatif-solde/:compteId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('dateArret')),
    __param(4, (0, common_1.Query)('masquerLettrees')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "justificatifSolde", null);
__decorate([
    (0, common_1.Get)('evolution-soldes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('nbExercices')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "evolutionSoldes", null);
__decorate([
    (0, common_1.Get)('grand-livre'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('du')),
    __param(3, (0, common_1.Query)('au')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "grandLivreComplet", null);
__decorate([
    (0, common_1.Get)('grand-livre/:compteId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('du')),
    __param(4, (0, common_1.Query)('au')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], EcritureController.prototype, "grandLivre", null);
exports.EcritureController = EcritureController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('ecritures'),
    __metadata("design:paramtypes", [ecriture_service_1.EcritureService])
], EcritureController);
//# sourceMappingURL=ecriture.controller.js.map