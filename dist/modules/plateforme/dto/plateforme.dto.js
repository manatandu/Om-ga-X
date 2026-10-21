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
exports.SupprimerEssaiEchuDto = exports.MarquerPayeeDto = exports.EnvoyerParCourrielDto = exports.FacturerAbonnementsDto = exports.ActiverAbonnementDto = exports.EnregistrerAbonnementDto = exports.FixerPrixFormuleDto = exports.EmettreLicenceSurSiteDto = exports.PreparerDemonstrationDto = exports.ReinitialiserAdminDto = exports.ModifierGroupeDto = exports.ModifierLicenceDto = exports.CreerCabinetDto = void 0;
const class_validator_1 = require("class-validator");
const courriel_1 = require("../../../common/courriel");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
const client_1 = require("@prisma/client");
class CreerCabinetDto {
}
exports.CreerCabinetDto = CreerCabinetDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "nomEntite", void 0);
__decorate([
    (0, courriel_1.CourrielNormalise)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "emailAdmin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Referentiel),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "referentiel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.JeuEtatsFinanciersSycebnl),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "jeuEtatsFinanciersSycebnl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SystemeComptableSyscohada),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "systemeComptableSyscohada", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TypeLicence),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "typeLicence", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "dateExpiration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "activite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "adresse", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "ville", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "pays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "telephone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "dateDebutExercice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "dateFinExercice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerCabinetDto.prototype, "dossierMereId", void 0);
class ModifierLicenceDto {
}
exports.ModifierLicenceDto = ModifierLicenceDto;
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Le type de licence ne s’efface pas · omettez le champ pour le laisser inchangé.'),
    (0, class_validator_1.IsEnum)(client_1.TypeLicence),
    __metadata("design:type", String)
], ModifierLicenceDto.prototype, "type", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Le statut de la licence est ACTIVE ou SUSPENDUE, jamais null · omettez le champ pour le laisser inchangé.'),
    (0, class_validator_1.IsIn)([client_1.StatutLicence.ACTIVE, client_1.StatutLicence.SUSPENDUE]),
    __metadata("design:type", String)
], ModifierLicenceDto.prototype, "statut", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('L’échéance de la licence ne s’efface pas par null · envoyez une date AAAA-MM-JJ, ou une chaîne vide pour lever l’échéance (licence perpétuelle).'),
    (0, class_validator_1.ValidateIf)((o) => o.dateExpiration !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierLicenceDto.prototype, "dateExpiration", void 0);
class ModifierGroupeDto {
}
exports.ModifierGroupeDto = ModifierGroupeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ModifierGroupeDto.prototype, "dossierMereId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], ModifierGroupeDto.prototype, "plafondCellules", void 0);
class ReinitialiserAdminDto {
}
exports.ReinitialiserAdminDto = ReinitialiserAdminDto;
__decorate([
    (0, courriel_1.CourrielNormalise)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], ReinitialiserAdminDto.prototype, "email", void 0);
class PreparerDemonstrationDto {
}
exports.PreparerDemonstrationDto = PreparerDemonstrationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PreparerDemonstrationDto.prototype, "nomEntite", void 0);
__decorate([
    (0, courriel_1.CourrielNormalise)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], PreparerDemonstrationDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], PreparerDemonstrationDto.prototype, "motDePasse", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Referentiel),
    __metadata("design:type", String)
], PreparerDemonstrationDto.prototype, "referentiel", void 0);
class EmettreLicenceSurSiteDto {
}
exports.EmettreLicenceSurSiteDto = EmettreLicenceSurSiteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], EmettreLicenceSurSiteDto.prototype, "titulaire", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^[0-9a-fA-F]{64}$/, { message: 'L’empreinte du poste compte 64 caractères hexadécimaux.' }),
    __metadata("design:type", String)
], EmettreLicenceSurSiteDto.prototype, "empreinteMachine", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({ strict: true }),
    __metadata("design:type", String)
], EmettreLicenceSurSiteDto.prototype, "finMaintenance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({ strict: true }),
    __metadata("design:type", Object)
], EmettreLicenceSurSiteDto.prototype, "expiration", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], EmettreLicenceSurSiteDto.prototype, "dossiersMax", void 0);
class FixerPrixFormuleDto {
}
exports.FixerPrixFormuleDto = FixerPrixFormuleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], FixerPrixFormuleDto.prototype, "prixMensuelUsd", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], FixerPrixFormuleDto.prototype, "prixAnnuelUsd", void 0);
class EnregistrerAbonnementDto {
}
exports.EnregistrerAbonnementDto = EnregistrerAbonnementDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EnregistrerAbonnementDto.prototype, "cabinetId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnregistrerAbonnementDto.prototype, "formuleCode", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], EnregistrerAbonnementDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], EnregistrerAbonnementDto.prototype, "dossiersSupplementaires", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['MENSUELLE', 'ANNUELLE']),
    __metadata("design:type", String)
], EnregistrerAbonnementDto.prototype, "periodicite", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({ strict: true }),
    __metadata("design:type", String)
], EnregistrerAbonnementDto.prototype, "debut", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EnregistrerAbonnementDto.prototype, "essai", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EnregistrerAbonnementDto.prototype, "tiersId", void 0);
class ActiverAbonnementDto {
}
exports.ActiverAbonnementDto = ActiverAbonnementDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ActiverAbonnementDto.prototype, "actif", void 0);
class FacturerAbonnementsDto {
}
exports.FacturerAbonnementsDto = FacturerAbonnementsDto;
__decorate([
    (0, class_validator_1.Matches)(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'La période s’écrit AAAA-MM.' }),
    __metadata("design:type", String)
], FacturerAbonnementsDto.prototype, "periode", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({ strict: true }),
    __metadata("design:type", String)
], FacturerAbonnementsDto.prototype, "dateFacture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], FacturerAbonnementsDto.prototype, "tauxTvaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FacturerAbonnementsDto.prototype, "envoyer", void 0);
class EnvoyerParCourrielDto {
}
exports.EnvoyerParCourrielDto = EnvoyerParCourrielDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(320),
    __metadata("design:type", Object)
], EnvoyerParCourrielDto.prototype, "destinataire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], EnvoyerParCourrielDto.prototype, "destinataireNom", void 0);
class MarquerPayeeDto {
}
exports.MarquerPayeeDto = MarquerPayeeDto;
__decorate([
    (0, class_validator_1.IsDateString)({ strict: true }),
    __metadata("design:type", String)
], MarquerPayeeDto.prototype, "payeeLe", void 0);
class SupprimerEssaiEchuDto {
}
exports.SupprimerEssaiEchuDto = SupprimerEssaiEchuDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SupprimerEssaiEchuDto.prototype, "confirmation", void 0);
//# sourceMappingURL=plateforme.dto.js.map