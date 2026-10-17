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
exports.PersonnelController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const personnel_service_1 = require("./personnel.service");
const comptabilisation_paie_service_1 = require("./comptabilisation-paie.service");
const personnel_dto_1 = require("./dto/personnel.dto");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
let PersonnelController = class PersonnelController {
    constructor(personnel, paieDuMois) {
        this.personnel = personnel;
        this.paieDuMois = paieDuMois;
    }
    async lister(user, tous, aCompleter) {
        return this.personnel.lister(user.tenantId, tous === 'true', aCompleter === 'true');
    }
    async creerSalarie(user, dto) {
        return this.personnel.creerSalarie(user.tenantId, user.userId, dto);
    }
    async modifierSalarie(user, salarieId, dto) {
        return this.personnel.modifierSalarie(user.tenantId, salarieId, dto);
    }
    async creerContrat(user, salarieId, dto) {
        return this.personnel.creerContrat(user.tenantId, user.userId, salarieId, dto);
    }
    async declarerDeviseRemuneration(user, contratId, dto) {
        return this.personnel.declarerDeviseRemuneration(user.tenantId, contratId, dto.deviseRemuneration);
    }
    async terminerContrat(user, contratId, dto) {
        return this.personnel.terminerContrat(user.tenantId, contratId, dto);
    }
    async confronter(user) {
        return this.personnel.confronter(user.tenantId);
    }
    async simulerPaie(user, dto, salarieId) {
        return this.personnel.simulerPaie(user.tenantId, salarieId ?? null, dto);
    }
    async decompteFinal(user, dto) {
        return this.personnel.decompteFinal(user.tenantId, dto);
    }
    async livreDePaie(user, dto) {
        return this.personnel.livreDePaie(user.tenantId, dto);
    }
    async effectif(user, ala) {
        const date = ala ? new Date(ala) : new Date();
        return this.personnel.effectif(user.tenantId, Number.isNaN(date.getTime()) ? new Date() : date);
    }
    async listerBulletins(user, mois) {
        return this.personnel.listerBulletins(user.tenantId, mois || undefined);
    }
    async lireBulletin(user, id) {
        return this.personnel.lireBulletin(user.tenantId, id);
    }
    async emettreBulletin(user, salarieId, dto) {
        return this.personnel.emettreBulletin(user.tenantId, user.userId, salarieId, dto);
    }
    async emettreDecompteFinal(user, salarieId, dto) {
        return this.personnel.emettreDecompteFinal(user.tenantId, user.userId, salarieId, dto);
    }
    async proposerRetenuesDecompte(user, salarieId, dto) {
        return this.personnel.proposerRetenuesDecompte(user.tenantId, salarieId, dto);
    }
    async annulerBulletin(user, id, dto) {
        return this.personnel.annulerBulletin(user.tenantId, user.userId, id, dto.motif);
    }
    async propositionPaieDuMois(user, mois) {
        return this.paieDuMois.proposition(user.tenantId, mois);
    }
    async comptabiliserPaieDuMois(user, mois, dto) {
        return this.paieDuMois.comptabiliser(user.tenantId, user.userId, mois, dto);
    }
    async annulerComptabilisationPaie(user, ecritureId) {
        return this.paieDuMois.annulerComptabilisation(user.tenantId, ecritureId);
    }
    async declarerRemise(user, id, dto) {
        return this.personnel.declarerRemise(user.tenantId, id, dto.remisLe);
    }
};
exports.PersonnelController = PersonnelController;
__decorate([
    (0, common_1.Get)('salaries'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('tous')),
    __param(2, (0, common_1.Query)('aCompleter')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "lister", null);
__decorate([
    (0, common_1.Post)('salaries'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, personnel_dto_1.SalarieDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "creerSalarie", null);
__decorate([
    (0, common_1.Put)('salaries/:salarieId'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.SalarieDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "modifierSalarie", null);
__decorate([
    (0, common_1.Post)('salaries/:salarieId/contrats'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.ContratTravailDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "creerContrat", null);
__decorate([
    (0, common_1.Post)('contrats/:contratId/devise-remuneration'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('contratId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.DeviseRemunerationDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "declarerDeviseRemuneration", null);
__decorate([
    (0, common_1.Post)('contrats/:contratId/fin'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('contratId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.TerminerContratDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "terminerContrat", null);
__decorate([
    (0, common_1.Get)('confrontation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "confronter", null);
__decorate([
    (0, common_1.Post)('simulation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('salarieId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, personnel_dto_1.SimulationPaieDto, String]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "simulerPaie", null);
__decorate([
    (0, common_1.Post)('decompte-final'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, personnel_dto_1.DecompteFinalDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "decompteFinal", null);
__decorate([
    (0, common_1.Post)('livre-de-paie'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, personnel_dto_1.LivreDePaieDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "livreDePaie", null);
__decorate([
    (0, common_1.Get)('effectif'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('ala')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "effectif", null);
__decorate([
    (0, common_1.Get)('bulletins'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('mois')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "listerBulletins", null);
__decorate([
    (0, common_1.Get)('bulletins/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "lireBulletin", null);
__decorate([
    (0, common_1.Post)('salaries/:salarieId/bulletins'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.SimulationPaieDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "emettreBulletin", null);
__decorate([
    (0, common_1.Post)('salaries/:salarieId/decompte-final'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.EmissionDecompteFinalDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "emettreDecompteFinal", null);
__decorate([
    (0, common_1.Post)('salaries/:salarieId/decompte-final/retenues-proposees'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.EmissionDecompteFinalDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "proposerRetenuesDecompte", null);
__decorate([
    (0, common_1.Post)('bulletins/:id/annulation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.AnnulationBulletinDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "annulerBulletin", null);
__decorate([
    (0, common_1.Get)('paie-du-mois/:mois'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('mois')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "propositionPaieDuMois", null);
__decorate([
    (0, common_1.Post)('paie-du-mois/:mois/comptabilisation'),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('mois')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.ComptabilisationPaieDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "comptabiliserPaieDuMois", null);
__decorate([
    (0, common_1.Delete)('paie-du-mois/comptabilisation/:ecritureId'),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ecritureId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "annulerComptabilisationPaie", null);
__decorate([
    (0, common_1.Post)('bulletins/:id/remise'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.RemiseBulletinDto]),
    __metadata("design:returntype", Promise)
], PersonnelController.prototype, "declarerRemise", null);
exports.PersonnelController = PersonnelController = __decorate([
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ aideComptable: false, gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('personnel'),
    __metadata("design:paramtypes", [personnel_service_1.PersonnelService,
        comptabilisation_paie_service_1.ComptabilisationPaieService])
], PersonnelController);
//# sourceMappingURL=personnel.controller.js.map