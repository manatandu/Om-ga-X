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
exports.IndemniteCaisseDto = exports.AnnulationAbsenceDto = exports.AbsenceSalarieDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class AbsenceSalarieDto {
}
exports.AbsenceSalarieDto = AbsenceSalarieDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureAbsenceSalarie),
    __metadata("design:type", String)
], AbsenceSalarieDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AbsenceSalarieDto.prototype, "du", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AbsenceSalarieDto.prototype, "au", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AbsenceSalarieDto.prototype, "demiJourneeDebut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AbsenceSalarieDto.prototype, "demiJourneeFin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], AbsenceSalarieDto.prototype, "evenement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], AbsenceSalarieDto.prototype, "piece", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AbsenceSalarieDto.prototype, "observation", void 0);
class AnnulationAbsenceDto {
}
exports.AnnulationAbsenceDto = AnnulationAbsenceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AnnulationAbsenceDto.prototype, "motif", void 0);
class IndemniteCaisseDto {
}
exports.IndemniteCaisseDto = IndemniteCaisseDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Le mois se lit AAAA-MM.' }),
    __metadata("design:type", String)
], IndemniteCaisseDto.prototype, "mois", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], IndemniteCaisseDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TraitementIndemniteCaisse),
    __metadata("design:type", String)
], IndemniteCaisseDto.prototype, "traitement", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], IndemniteCaisseDto.prototype, "piece", void 0);
//# sourceMappingURL=absences.dto.js.map