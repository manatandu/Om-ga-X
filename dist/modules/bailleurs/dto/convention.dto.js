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
exports.TransmettreRapportDto = exports.CreerRapportDto = exports.EncaisserTrancheDto = exports.CreerTrancheDto = exports.CloreConventionDto = exports.ModifierConventionDto = exports.CreerConventionDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreerConventionDto {
}
exports.CreerConventionDto = CreerConventionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerConventionDto.prototype, "bailleurId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreerConventionDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreerConventionDto.prototype, "objet", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerConventionDto.prototype, "ecritSigne", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerConventionDto.prototype, "signataire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerConventionDto.prototype, "dateSignature", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerConventionDto.prototype, "dateDebut", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerConventionDto.prototype, "dateFin", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreerConventionDto.prototype, "montantAccorde", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.CaractereEngagement),
    __metadata("design:type", String)
], CreerConventionDto.prototype, "caractere", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerConventionDto.prototype, "conditions", void 0);
class ModifierConventionDto {
}
exports.ModifierConventionDto = ModifierConventionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierConventionDto.prototype, "objet", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierConventionDto.prototype, "ecritSigne", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierConventionDto.prototype, "signataire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierConventionDto.prototype, "dateSignature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierConventionDto.prototype, "dateDebut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierConventionDto.prototype, "dateFin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ModifierConventionDto.prototype, "montantAccorde", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CaractereEngagement),
    __metadata("design:type", String)
], ModifierConventionDto.prototype, "caractere", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierConventionDto.prototype, "conditions", void 0);
class CloreConventionDto {
}
exports.CloreConventionDto = CloreConventionDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.StatutConvention),
    __metadata("design:type", String)
], CloreConventionDto.prototype, "statut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CloreConventionDto.prototype, "motif", void 0);
class CreerTrancheDto {
}
exports.CreerTrancheDto = CreerTrancheDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreerTrancheDto.prototype, "numero", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreerTrancheDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreerTrancheDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerTrancheDto.prototype, "datePrevue", void 0);
class EncaisserTrancheDto {
}
exports.EncaisserTrancheDto = EncaisserTrancheDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EncaisserTrancheDto.prototype, "dateEncaissement", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], EncaisserTrancheDto.prototype, "montantEncaisse", void 0);
class CreerRapportDto {
}
exports.CreerRapportDto = CreerRapportDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreerRapportDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureRapportBailleur),
    __metadata("design:type", String)
], CreerRapportDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerRapportDto.prototype, "dateEcheance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerRapportDto.prototype, "observation", void 0);
class TransmettreRapportDto {
}
exports.TransmettreRapportDto = TransmettreRapportDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], TransmettreRapportDto.prototype, "dateTransmission", void 0);
//# sourceMappingURL=convention.dto.js.map