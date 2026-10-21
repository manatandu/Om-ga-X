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
exports.ImmobilisationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const immobilisation_service_1 = require("./immobilisation.service");
const immobilisation_dto_1 = require("./dto/immobilisation.dto");
const client_1 = require("@prisma/client");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const exercice_requis_1 = require("../../common/exercice-requis");
let ImmobilisationController = class ImmobilisationController {
    constructor(immobilisationService) {
        this.immobilisationService = immobilisationService;
    }
    async tableau(user, dateArret) {
        return this.immobilisationService.tableauImmobilisations(user.tenantId, { dateArret });
    }
    async tableauAmortissements(user, exerciceId) {
        return this.immobilisationService.tableauAmortissements(user.tenantId, exerciceId);
    }
    async coutsEmpruntIncorpores(user, exerciceId) {
        return this.immobilisationService.coutsEmpruntIncorpores(user.tenantId, exerciceId);
    }
    async biensSousReserveDePropriete(user, exerciceId) {
        return this.immobilisationService.biensSousReserveDePropriete(user.tenantId, exerciceId);
    }
    async comptesMaterielRecupere(user) {
        return this.immobilisationService.comptesMaterielRecupere(user.tenantId);
    }
    async listerFamilles(user) {
        return this.immobilisationService.listerFamilles(user.tenantId);
    }
    async listerLieux(user) {
        return this.immobilisationService.listerLieux(user.tenantId);
    }
    async creerLieu(user, dto) {
        return this.immobilisationService.creerLieu(user.tenantId, dto);
    }
    async supprimerLieu(user, id) {
        return this.immobilisationService.supprimerLieu(user.tenantId, id);
    }
    async affecterLieu(user, id, dto) {
        return this.immobilisationService.affecterLieu(user.tenantId, id, dto.lieuId ?? null);
    }
    async mettreEnService(user, id, dto) {
        return this.immobilisationService.mettreEnService(user.tenantId, user.userId, id, dto);
    }
    async propositionTransfertDepreciation(user, id, compteDepreciationCibleId, date) {
        return this.immobilisationService.propositionTransfertDepreciation(user.tenantId, id, compteDepreciationCibleId || undefined, date || undefined);
    }
    async transfererDepreciation(user, id, dto) {
        return this.immobilisationService.transfererDepreciation(user.tenantId, user.userId, id, dto);
    }
    async baremeFiscal(user) {
        return this.immobilisationService.baremeFiscal(user.tenantId);
    }
    async comptesDuBien(user, retenus) {
        return this.immobilisationService.comptesDuBien(user.tenantId, retenus === 'true');
    }
    async comptesFondsProjet(user, retenus) {
        return this.immobilisationService.comptesFondsProjet(user.tenantId, retenus === 'true');
    }
    async seuilPetitMateriel(user, date) {
        if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date))
            throw new common_1.BadRequestException('Date attendue (AAAA-MM-JJ)');
        return this.immobilisationService.seuilPetitMateriel(user.tenantId, date);
    }
    async contrepartiesAcquisition(user, familleId, compteImmobilisationId, typeComposant, retenus) {
        if (typeComposant !== undefined && !Object.values(client_1.TypeComposant).includes(typeComposant)) {
            throw new common_1.BadRequestException(`Type de composant inconnu : ${typeComposant}`);
        }
        if (!!familleId === !!compteImmobilisationId) {
            throw new common_1.BadRequestException('Indiquez le compte du bien (ou la famille), un seul des deux.');
        }
        return this.immobilisationService.contrepartiesAcquisition(user.tenantId, { familleId, compteImmobilisationId }, typeComposant ?? null, retenus === 'true');
    }
    async lister(user, statut) {
        return this.immobilisationService.lister(user.tenantId, statut);
    }
    async simulerLocationAcquisition(user, dto) {
        return this.immobilisationService.simulerLocationAcquisition(user.tenantId, dto);
    }
    async creerEnLocationAcquisition(user, dto) {
        return this.immobilisationService.creerEnLocationAcquisition(user.tenantId, user.userId, dto);
    }
    async recevoirLegs(user, dto) {
        return this.immobilisationService.recevoirLegs(user.tenantId, user.userId, dto);
    }
    async acquerirAPrixGlobal(user, dto) {
        return this.immobilisationService.acquerirAPrixGlobal(user.tenantId, user.userId, dto);
    }
    async acquerirAPrixAleatoire(user, dto) {
        return this.immobilisationService.acquerirAPrixAleatoire(user.tenantId, user.userId, dto);
    }
    async creer(user, dto) {
        return this.immobilisationService.creer(user.tenantId, user.userId, dto);
    }
    async passerDotation(user, id, dto) {
        return this.immobilisationService.passerDotation(user.tenantId, user.userId, id, dto);
    }
    async estimerRevisionMajeure(user, id, coutRevisionActuel, intervalleRevisionsAns, dateReconstitution, derniereRevisionRealiseeLe) {
        return this.immobilisationService.estimerRevisionMajeure(user.tenantId, id, {
            coutRevisionActuel: Number(coutRevisionActuel),
            intervalleRevisionsAns: Number(intervalleRevisionsAns),
            dateReconstitution,
            derniereRevisionRealiseeLe,
        });
    }
    async saisirConsommation(user, id, dto) {
        return this.immobilisationService.saisirConsommation(user.tenantId, user.userId, id, dto);
    }
    async deprecier(user, id, dto) {
        return this.immobilisationService.enregistrerDepreciation(user.tenantId, user.userId, id, dto);
    }
    async plafondReprise(user, id, exerciceId) {
        return this.immobilisationService.plafondReprise(user.tenantId, id, exerciceId);
    }
    async renouveler(user, id, dto) {
        return this.immobilisationService.renouveler(user.tenantId, user.userId, id, dto);
    }
    async remplacerPartieNonIdentifiee(user, id, dto) {
        return this.immobilisationService.remplacerPartieNonIdentifiee(user.tenantId, user.userId, id, dto);
    }
    async declarerDureeLimitee(user, id, dto) {
        return this.immobilisationService.declarerDureeLimitee(user.tenantId, id, dto);
    }
    async solderDetteAleatoire(user, id, dto) {
        return this.immobilisationService.solderDetteAleatoire(user.tenantId, user.userId, id, dto);
    }
    async declarerReservePropriete(user, id, dto) {
        return this.immobilisationService.declarerReservePropriete(user.tenantId, id, dto);
    }
    async incorporerCoutsEmprunt(user, id, dto) {
        return this.immobilisationService.incorporerCoutsEmprunt(user.tenantId, user.userId, id, dto);
    }
    async reviserPlan(user, id, dto) {
        return this.immobilisationService.reviserPlan(user.tenantId, user.userId, id, dto);
    }
    async revisionsPlan(user, id) {
        return this.immobilisationService.revisionsPlan(user.tenantId, id);
    }
    async reclasser(user, id, dto) {
        return this.immobilisationService.reclasser(user.tenantId, user.userId, id, dto);
    }
    async echanger(user, id, dto) {
        return this.immobilisationService.echanger(user.tenantId, user.userId, id, dto);
    }
    async sortir(user, id, dto) {
        return this.immobilisationService.sortir(user.tenantId, user.userId, id, dto);
    }
};
exports.ImmobilisationController = ImmobilisationController;
__decorate([
    (0, common_1.Get)('tableau'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('dateArret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "tableau", null);
__decorate([
    (0, common_1.Get)('tableau-amortissements'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "tableauAmortissements", null);
__decorate([
    (0, common_1.Get)('couts-emprunt-incorpores'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "coutsEmpruntIncorpores", null);
__decorate([
    (0, common_1.Get)('reserve-de-propriete'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "biensSousReserveDePropriete", null);
__decorate([
    (0, common_1.Get)('materiel-recupere/comptes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "comptesMaterielRecupere", null);
__decorate([
    (0, common_1.Get)('familles'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "listerFamilles", null);
__decorate([
    (0, common_1.Get)('lieux'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "listerLieux", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('lieux'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.LieuBienDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "creerLieu", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)('lieux/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "supprimerLieu", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id/lieu'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.AffecterLieuDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "affecterLieu", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id/mise-en-service'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.MiseEnServiceDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "mettreEnService", null);
__decorate([
    (0, common_1.Get)(':id/transfert-depreciation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('compteDepreciationCibleId')),
    __param(3, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "propositionTransfertDepreciation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/transfert-depreciation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.TransfertDepreciationDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "transfererDepreciation", null);
__decorate([
    (0, common_1.Get)('bareme-fiscal'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "baremeFiscal", null);
__decorate([
    (0, common_1.Get)('comptes-du-bien'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('retenus')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "comptesDuBien", null);
__decorate([
    (0, common_1.Get)('comptes-fonds-projet'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('retenus')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "comptesFondsProjet", null);
__decorate([
    (0, common_1.Get)('seuil-petit-materiel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "seuilPetitMateriel", null);
__decorate([
    (0, common_1.Get)('contreparties-acquisition'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('familleId', new common_1.ParseUUIDPipe({ optional: true }))),
    __param(2, (0, common_1.Query)('compteImmobilisationId', new common_1.ParseUUIDPipe({ optional: true }))),
    __param(3, (0, common_1.Query)('typeComposant')),
    __param(4, (0, common_1.Query)('retenus')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "contrepartiesAcquisition", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('statut')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('location-acquisition/simulation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.SimulerLocationAcquisitionDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "simulerLocationAcquisition", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('location-acquisition'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.CreerLocationAcquisitionDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "creerEnLocationAcquisition", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('legs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.RecevoirLegsDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "recevoirLegs", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('prix-global'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.AcquerirAPrixGlobalDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "acquerirAPrixGlobal", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Post)('prix-aleatoire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.AcquerirAPrixAleatoireDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "acquerirAPrixAleatoire", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.CreerImmobilisationDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/dotation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.PasserDotationDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "passerDotation", null);
__decorate([
    (0, common_1.Get)(':id/reconstitution-revision-majeure'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('coutRevisionActuel')),
    __param(3, (0, common_1.Query)('intervalleRevisionsAns')),
    __param(4, (0, common_1.Query)('dateReconstitution')),
    __param(5, (0, common_1.Query)('derniereRevisionRealiseeLe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "estimerRevisionMajeure", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/consommation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.SaisirConsommationDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "saisirConsommation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/depreciation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.DepreciationDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "deprecier", null);
__decorate([
    (0, common_1.Get)(':id/plafond-reprise-depreciation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "plafondReprise", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/renouvellement'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.RenouvelerComposantDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "renouveler", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/remplacement-imprevu'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.RemplacerPartieDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "remplacerPartieNonIdentifiee", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/duree-limitee'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.DureeLimiteeDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "declarerDureeLimitee", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Post)(':id/solde-dette-aleatoire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.SolderDetteAleatoireDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "solderDetteAleatoire", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id/reserve-de-propriete'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.ReserveProprieteDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "declarerReservePropriete", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/couts-emprunt'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.IncorporerCoutsEmpruntDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "incorporerCoutsEmprunt", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/revision-plan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.ReviserPlanDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "reviserPlan", null);
__decorate([
    (0, common_1.Get)(':id/revisions-plan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "revisionsPlan", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/reclassement'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.ReclasserImmobilisationDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "reclasser", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/echange'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.EchangerImmobilisationDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "echanger", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/sortie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.SortirImmobilisationDto]),
    __metadata("design:returntype", Promise)
], ImmobilisationController.prototype, "sortir", null);
exports.ImmobilisationController = ImmobilisationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, common_1.Controller)('immobilisations'),
    __metadata("design:paramtypes", [immobilisation_service_1.ImmobilisationService])
], ImmobilisationController);
//# sourceMappingURL=immobilisation.controller.js.map