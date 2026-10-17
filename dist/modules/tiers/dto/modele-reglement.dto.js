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
exports.EcheancierDeLigneDto = exports.CalculerEcheancesDto = exports.CreerEcheanceReglementDto = exports.ModifierModeleReglementDto = exports.CreerModeleReglementDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
class CreerModeleReglementDto {
}
exports.CreerModeleReglementDto = CreerModeleReglementDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerModeleReglementDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerModeleReglementDto.prototype, "delaiJours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ConditionEcheance),
    __metadata("design:type", String)
], CreerModeleReglementDto.prototype, "echeance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerModeleReglementDto.prototype, "modeReglementId", void 0);
class ModifierModeleReglementDto {
}
exports.ModifierModeleReglementDto = ModifierModeleReglementDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierModeleReglementDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ModifierModeleReglementDto.prototype, "delaiJours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ConditionEcheance),
    __metadata("design:type", String)
], ModifierModeleReglementDto.prototype, "echeance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierModeleReglementDto.prototype, "estActif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ModifierModeleReglementDto.prototype, "modeReglementId", void 0);
class CreerEcheanceReglementDto {
}
exports.CreerEcheanceReglementDto = CreerEcheanceReglementDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreerEcheanceReglementDto.prototype, "ordre", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TypeEcheance),
    __metadata("design:type", String)
], CreerEcheanceReglementDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerEcheanceReglementDto.prototype, "valeur", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerEcheanceReglementDto.prototype, "delaiJours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ConditionEcheance),
    __metadata("design:type", String)
], CreerEcheanceReglementDto.prototype, "echeance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerEcheanceReglementDto.prototype, "modeReglementId", void 0);
class CalculerEcheancesDto {
}
exports.CalculerEcheancesDto = CalculerEcheancesDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CalculerEcheancesDto.prototype, "dateFacture", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], CalculerEcheancesDto.prototype, "montantTotal", void 0);
class EcheancierDeLigneDto {
}
exports.EcheancierDeLigneDto = EcheancierDeLigneDto;
__decorate([
    (0, class_validator_1.IsDateString)({}, { message: 'La date de la pièce est attendue au format AAAA-MM-JJ.' }),
    __metadata("design:type", String)
], EcheancierDeLigneDto.prototype, "date", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'Le montant de la ligne est illisible.' }),
    (0, class_validator_1.Min)(0.01, { message: 'Le montant de la ligne doit être positif.' }),
    __metadata("design:type", Number)
], EcheancierDeLigneDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['DEBIT', 'CREDIT'], { message: 'Le sens de la ligne vaut DEBIT ou CREDIT.' }),
    __metadata("design:type", String)
], EcheancierDeLigneDto.prototype, "sens", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TypeJournal, { message: 'Type de journal inconnu.' }),
    __metadata("design:type", String)
], EcheancierDeLigneDto.prototype, "typeJournal", void 0);
//# sourceMappingURL=modele-reglement.dto.js.map