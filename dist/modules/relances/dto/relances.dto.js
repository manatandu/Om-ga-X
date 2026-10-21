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
exports.HorsRelanceDto = exports.EmettreRelancesDto = exports.PLAFOND_COMPTES_PAR_EMISSION = exports.ModifierNiveauDto = exports.CreerNiveauDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreerNiveauDto {
}
exports.CreerNiveauDto = CreerNiveauDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreerNiveauDto.prototype, "niveau", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerNiveauDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TypeRelance),
    __metadata("design:type", String)
], CreerNiveauDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreerNiveauDto.prototype, "joursApresEcheance", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerNiveauDto.prototype, "modeleTexte", void 0);
class ModifierNiveauDto {
}
exports.ModifierNiveauDto = ModifierNiveauDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierNiveauDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], ModifierNiveauDto.prototype, "joursApresEcheance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierNiveauDto.prototype, "modeleTexte", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierNiveauDto.prototype, "estActif", void 0);
exports.PLAFOND_COMPTES_PAR_EMISSION = 500;
class EmettreRelancesDto {
}
exports.EmettreRelancesDto = EmettreRelancesDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EmettreRelancesDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)(undefined, { each: true }),
    (0, class_validator_1.ArrayMaxSize)(exports.PLAFOND_COMPTES_PAR_EMISSION, {
        message: `Au plus ${exports.PLAFOND_COMPTES_PAR_EMISSION} comptes par émission · découpez la sélection.`,
    }),
    (0, class_validator_1.ArrayUnique)({ message: 'Un même compte figure deux fois dans la sélection.' }),
    __metadata("design:type", Array)
], EmettreRelancesDto.prototype, "compteIds", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EmettreRelancesDto.prototype, "niveauId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EmettreRelancesDto.prototype, "dateReference", void 0);
class HorsRelanceDto {
}
exports.HorsRelanceDto = HorsRelanceDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], HorsRelanceDto.prototype, "horsRelance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HorsRelanceDto.prototype, "motif", void 0);
//# sourceMappingURL=relances.dto.js.map