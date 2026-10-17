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
exports.AnnulerConstatImpotDto = exports.PasserConstatImpotDto = exports.OrigineDeficitDto = exports.ModifierDossierFiscalDto = exports.ModifierRetraitementDto = exports.CreerRetraitementDto = exports.ORIGINES_DEFICIT_MAX = exports.MONTANT_FISCAL_MAX = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
exports.MONTANT_FISCAL_MAX = 999_999_999_999_999;
const MOTIF_MONTANT_MAX = `Montant hors des bornes · au plus ${exports.MONTANT_FISCAL_MAX.toLocaleString('fr-FR')} en valeur absolue.`;
exports.ORIGINES_DEFICIT_MAX = 20;
const nonNul = (champ) => `${champ} ne s'efface pas · la colonne n'admet pas de valeur vide. Omettez le champ pour le laisser inchangé, ou envoyez 0.`;
class CreerRetraitementDto {
}
exports.CreerRetraitementDto = CreerRetraitementDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], CreerRetraitementDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SensRetraitementFiscal),
    __metadata("design:type", String)
], CreerRetraitementDto.prototype, "sens", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerRetraitementDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.Max)(exports.MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX }),
    __metadata("design:type", Number)
], CreerRetraitementDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreerRetraitementDto.prototype, "commentaire", void 0);
class ModifierRetraitementDto {
}
exports.ModifierRetraitementDto = ModifierRetraitementDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.Max)(exports.MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX }),
    __metadata("design:type", Number)
], ModifierRetraitementDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], ModifierRetraitementDto.prototype, "commentaire", void 0);
class ModifierDossierFiscalDto {
}
exports.ModifierDossierFiscalDto = ModifierDossierFiscalDto;
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)(nonNul('Le montant des acomptes versés')),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(exports.MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX }),
    __metadata("design:type", Number)
], ModifierDossierFiscalDto.prototype, "acomptesVerses", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)(nonNul("Le montant des suppléments de l'Administration")),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(exports.MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX }),
    __metadata("design:type", Number)
], ModifierDossierFiscalDto.prototype, "supplementsAdministration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(exports.MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX }),
    __metadata("design:type", Object)
], ModifierDossierFiscalDto.prototype, "deficitAnterieurSaisi", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsEnum)(client_1.NatureActiviteFiscale),
    __metadata("design:type", Object)
], ModifierDossierFiscalDto.prototype, "natureActivite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(-exports.MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX }),
    (0, class_validator_1.Max)(exports.MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX }),
    __metadata("design:type", Object)
], ModifierDossierFiscalDto.prototype, "resultatPeriodeCreationSaisi", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(exports.MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX }),
    __metadata("design:type", Object)
], ModifierDossierFiscalDto.prototype, "chiffreAffairesPeriodeCreationSaisi", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)(nonNul('Le montant des suppléments sur la période de création')),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(exports.MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX }),
    __metadata("design:type", Number)
], ModifierDossierFiscalDto.prototype, "supplementsPeriodeCreation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(exports.ORIGINES_DEFICIT_MAX, {
        message: `L'origine du report se déclare en ${exports.ORIGINES_DEFICIT_MAX} parts au plus · une par exercice déficitaire encore imputable.`,
    }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => OrigineDeficitDto),
    __metadata("design:type", Object)
], ModifierDossierFiscalDto.prototype, "deficitAnterieurOrigines", void 0);
class OrigineDeficitDto {
}
exports.OrigineDeficitDto = OrigineDeficitDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], OrigineDeficitDto.prototype, "dateFin", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.Max)(exports.MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX }),
    __metadata("design:type", Number)
], OrigineDeficitDto.prototype, "montant", void 0);
class PasserConstatImpotDto {
}
exports.PasserConstatImpotDto = PasserConstatImpotDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PasserConstatImpotDto.prototype, "imputerAcomptes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], PasserConstatImpotDto.prototype, "attestationRegime", void 0);
class AnnulerConstatImpotDto {
}
exports.AnnulerConstatImpotDto = AnnulerConstatImpotDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AnnulerConstatImpotDto.prototype, "motif", void 0);
//# sourceMappingURL=fiscalite.dto.js.map