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
exports.ClorerCampagneDto = exports.ProceduresAlternativesDto = exports.DepouillerDto = exports.EnvoyerDto = exports.CreerDemandeDto = exports.CreerCampagneCircularisationDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreerCampagneCircularisationDto {
}
exports.CreerCampagneCircularisationDto = CreerCampagneCircularisationDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerCampagneCircularisationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerCampagneCircularisationDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerCampagneCircularisationDto.prototype, "dateArrete", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.CycleCircularisation),
    __metadata("design:type", String)
], CreerCampagneCircularisationDto.prototype, "cycle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FormeConfirmation),
    __metadata("design:type", String)
], CreerCampagneCircularisationDto.prototype, "forme", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], CreerCampagneCircularisationDto.prototype, "methodeSelection", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreerCampagneCircularisationDto.prototype, "conditionsNegativeReunies", void 0);
class CreerDemandeDto {
}
exports.CreerDemandeDto = CreerDemandeDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerDemandeDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerDemandeDto.prototype, "tiersId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], CreerDemandeDto.prototype, "destinataire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreerDemandeDto.prototype, "adresse", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreerDemandeDto.prototype, "soldeAConfirmer", void 0);
class EnvoyerDto {
}
exports.EnvoyerDto = EnvoyerDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EnvoyerDto.prototype, "date", void 0);
class DepouillerDto {
}
exports.DepouillerDto = DepouillerDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.StatutDemandeConfirmation),
    __metadata("design:type", String)
], DepouillerDto.prototype, "statut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DepouillerDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], DepouillerDto.prototype, "soldeConfirme", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.NatureEcartConfirmation),
    __metadata("design:type", String)
], DepouillerDto.prototype, "natureEcart", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], DepouillerDto.prototype, "investigation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DepouillerDto.prototype, "reponseIndirecte", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], DepouillerDto.prototype, "doutefiabilite", void 0);
class ProceduresAlternativesDto {
}
exports.ProceduresAlternativesDto = ProceduresAlternativesDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], ProceduresAlternativesDto.prototype, "proceduresAlternatives", void 0);
class ClorerCampagneDto {
}
exports.ClorerCampagneDto = ClorerCampagneDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], ClorerCampagneDto.prototype, "refusDirectionMotif", void 0);
//# sourceMappingURL=circularisation.dto.js.map