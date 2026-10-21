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
exports.DevisesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const devises_service_1 = require("./devises.service");
const declaration_devise_a_nouveau_service_1 = require("./declaration-devise-a-nouveau.service");
const declaration_devise_a_nouveau_dto_1 = require("./dto/declaration-devise-a-nouveau.dto");
const devises_dto_1 = require("./dto/devises.dto");
const client_1 = require("@prisma/client");
const conversion_usd_1 = require("../personnel/conversion-usd");
const exercice_requis_1 = require("../../common/exercice-requis");
let DevisesController = class DevisesController {
    constructor(devises, declarations) {
        this.devises = devises;
        this.declarations = declarations;
    }
    async aNouveauxADeclarer(user) {
        return this.declarations.restantADeclarer(user.tenantId);
    }
    async declarerDeviseANouveau(user, dto) {
        return this.declarations.declarer(user.tenantId, user.userId, dto);
    }
    async lister(user) {
        return this.devises.lister(user.tenantId);
    }
    async creer(user, dto) {
        return this.devises.creer(user.tenantId, dto);
    }
    async modifier(user, id, dto) {
        return this.devises.modifier(user.tenantId, id, dto);
    }
    async poserCours(user, id, dto) {
        if (user.role === client_1.RoleUtilisateur.GESTIONNAIRE_PAIE) {
            const devise = (await this.devises.lister(user.tenantId)).find((d) => d.id === id);
            if (!devise)
                throw new common_1.NotFoundException('Devise introuvable pour ce dossier');
            const maintenant = new Date();
            const motif = (0, conversion_usd_1.motifRefusCotationGestionnairePaie)(devise.code, dto.date, maintenant);
            if (motif)
                throw new common_1.ForbiddenException(motif);
            return this.devises.ajouterCours(user.tenantId, id, dto, (0, conversion_usd_1.messageCoursDejaCote)((0, conversion_usd_1.jourDeKinshasa)(maintenant)));
        }
        return this.devises.poserCours(user.tenantId, id, dto);
    }
    async calculer(user, dto) {
        return this.devises.calculer(user.tenantId, dto);
    }
    async reevaluer(user, dto) {
        return this.devises.reevaluer(user.tenantId, user.userId, dto);
    }
    async listerReevaluations(user, exerciceId) {
        return this.devises.listerReevaluations(user.tenantId, exerciceId);
    }
    async provisionsOuverture(user, exerciceId) {
        return this.devises.provisionsOuverture(user.tenantId, exerciceId);
    }
    async declarerProvisionOuverture(user, dto) {
        return this.devises.declarerProvisionOuverture(user.tenantId, user.userId, dto);
    }
    async retirerProvisionOuverture(user, id) {
        return this.devises.retirerProvisionOuverture(user.tenantId, id);
    }
    async extourner(user, id, body) {
        return this.devises.extourner(user.tenantId, user.userId, id, body.exerciceSuivantId, { integrale: body.integrale === true });
    }
    async annulerContrePassation(user, id, body) {
        return this.devises.annulerContrePassation(user.tenantId, user.userId, id, body.motif);
    }
    async candidatesContrePassationManuelle(user, id) {
        return this.devises.candidatesContrePassationManuelle(user.tenantId, id);
    }
    async declarerContrePassationManuelle(user, id, body) {
        return this.devises.declarerContrePassationManuelle(user.tenantId, user.userId, id, body.ecritureId, body.motif);
    }
    async retirerContrePassationManuelle(user, id, body) {
        return this.devises.retirerContrePassationManuelle(user.tenantId, user.userId, id, body.motif);
    }
    async attesterEtatDeLEcart(user, id, body) {
        return this.devises.attesterEtatDeLEcart(user.tenantId, user.userId, id, body.motif);
    }
    async retirerAttestationEtatDeLEcart(user, id, body) {
        return this.devises.retirerAttestationEtatDeLEcart(user.tenantId, user.userId, id, body.motif);
    }
    async annulerReevaluation(user, id, body) {
        return this.devises.annulerReevaluation(user.tenantId, user.userId, id, body.motif);
    }
    async declarerVentilationDisponibilites(user, id, body) {
        return this.devises.declarerVentilationDisponibilites(user.tenantId, user.userId, id, body);
    }
};
exports.DevisesController = DevisesController;
__decorate([
    (0, common_1.Get)('a-nouveaux/a-declarer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "aNouveauxADeclarer", null);
__decorate([
    (0, common_1.Post)('a-nouveaux/declaration'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, declaration_devise_a_nouveau_dto_1.DeclarerDeviseANouveauDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "declarerDeviseANouveau", null);
__decorate([
    (0, common_1.Get)(),
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "lister", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, devises_dto_1.CreerDeviseDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "creer", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, devises_dto_1.ModifierDeviseDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "modifier", null);
__decorate([
    (0, common_1.Post)(':id/cours'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, devises_dto_1.PoserCoursDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "poserCours", null);
__decorate([
    (0, common_1.Post)('reevaluation/calcul'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, devises_dto_1.ReevaluerDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "calculer", null);
__decorate([
    (0, common_1.Post)('reevaluation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, devises_dto_1.ReevaluerDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "reevaluer", null);
__decorate([
    (0, common_1.Get)('reevaluation/liste'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "listerReevaluations", null);
__decorate([
    (0, common_1.Get)('provision-ouverture'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "provisionsOuverture", null);
__decorate([
    (0, common_1.Post)('provision-ouverture'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, devises_dto_1.DeclarerProvisionOuvertureDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "declarerProvisionOuverture", null);
__decorate([
    (0, common_1.Delete)('provision-ouverture/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "retirerProvisionOuverture", null);
__decorate([
    (0, common_1.Post)('reevaluation/:id/extourne'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, devises_dto_1.ExtournerReevaluationDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "extourner", null);
__decorate([
    (0, common_1.Post)('reevaluations/:id/contre-passation/annuler'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, devises_dto_1.AnnulerReevaluationDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "annulerContrePassation", null);
__decorate([
    (0, common_1.Get)('reevaluations/:id/contre-passation-manuelle/candidates'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "candidatesContrePassationManuelle", null);
__decorate([
    (0, common_1.Post)('reevaluations/:id/contre-passation-manuelle'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, devises_dto_1.DeclarerContrePassationManuelleDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "declarerContrePassationManuelle", null);
__decorate([
    (0, common_1.Delete)('reevaluations/:id/contre-passation-manuelle'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, devises_dto_1.RetirerContrePassationManuelleDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "retirerContrePassationManuelle", null);
__decorate([
    (0, common_1.Post)('reevaluations/:id/attestation-etat'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, devises_dto_1.MotifAttestationEtatDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "attesterEtatDeLEcart", null);
__decorate([
    (0, common_1.Delete)('reevaluations/:id/attestation-etat'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, devises_dto_1.MotifAttestationEtatDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "retirerAttestationEtatDeLEcart", null);
__decorate([
    (0, common_1.Post)('reevaluations/:id/annuler'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, devises_dto_1.AnnulerReevaluationDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "annulerReevaluation", null);
__decorate([
    (0, common_1.Post)('reevaluations/:id/ventilation-disponibilites'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, devises_dto_1.DeclarerVentilationDisponibilitesDto]),
    __metadata("design:returntype", Promise)
], DevisesController.prototype, "declarerVentilationDisponibilites", null);
exports.DevisesController = DevisesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('devises'),
    __metadata("design:paramtypes", [devises_service_1.DevisesService,
        declaration_devise_a_nouveau_service_1.DeclarationDeviseANouveauService])
], DevisesController);
//# sourceMappingURL=devises.controller.js.map