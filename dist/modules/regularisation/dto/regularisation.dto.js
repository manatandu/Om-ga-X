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
exports.ReprendreRegularisationDto = exports.GenererAbonnementDto = exports.ModifierAbonnementDto = exports.CreerAbonnementDto = exports.CreerRegularisationDto = void 0;
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreerRegularisationDto {
}
exports.CreerRegularisationDto = CreerRegularisationDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerRegularisationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TypeRegularisation),
    __metadata("design:type", String)
], CreerRegularisationDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerRegularisationDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerRegularisationDto.prototype, "compteChargeProduitId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerRegularisationDto.prototype, "compteDifferId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerRegularisationDto.prototype, "montantTotal", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerRegularisationDto.prototype, "periodeDebut", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerRegularisationDto.prototype, "periodeFin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerRegularisationDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerRegularisationDto.prototype, "montantDiffere", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['FOURNISSEURS', 'CLIENTS', 'PERSONNEL', 'ORGANISMES_SOCIAUX', 'ETAT', 'PRETEURS']),
    __metadata("design:type", String)
], CreerRegularisationDto.prototype, "natureTiers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerRegularisationDto.prototype, "compteEmpruntId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La TVA du rattachement ne peut pas être nulle · omettez le champ, ou indiquez 0.'),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerRegularisationDto.prototype, "montantTva", void 0);
class CreerAbonnementDto {
}
exports.CreerAbonnementDto = CreerAbonnementDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerAbonnementDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerAbonnementDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerAbonnementDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerAbonnementDto.prototype, "compteDebitId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerAbonnementDto.prototype, "compteCreditId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.PeriodiciteAbonnement),
    __metadata("design:type", String)
], CreerAbonnementDto.prototype, "periodicite", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerAbonnementDto.prototype, "dateDebut", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerAbonnementDto.prototype, "dateFin", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerAbonnementDto.prototype, "montant", void 0);
class ModifierAbonnementDto {
}
exports.ModifierAbonnementDto = ModifierAbonnementDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierAbonnementDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierAbonnementDto.prototype, "estActif", void 0);
class GenererAbonnementDto {
}
exports.GenererAbonnementDto = GenererAbonnementDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GenererAbonnementDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], GenererAbonnementDto.prototype, "jusquA", void 0);
class ReprendreRegularisationDto {
}
exports.ReprendreRegularisationDto = ReprendreRegularisationDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReprendreRegularisationDto.prototype, "exerciceCibleId", void 0);
//# sourceMappingURL=regularisation.dto.js.map