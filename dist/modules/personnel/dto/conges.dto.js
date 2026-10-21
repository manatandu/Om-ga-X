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
exports.AnnulationCongeDto = exports.CongeSalarieDto = exports.AllocationCongeDto = exports.RepriseCongesDto = void 0;
const class_validator_1 = require("class-validator");
class RepriseCongesDto {
}
exports.RepriseCongesDto = RepriseCongesDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RepriseCongesDto.prototype, "arreteAu", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 1 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(400),
    __metadata("design:type", Number)
], RepriseCongesDto.prototype, "joursNesNonPris", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(11),
    __metadata("design:type", Number)
], RepriseCongesDto.prototype, "moisEnCoursAccomplis", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], RepriseCongesDto.prototype, "source", void 0);
class AllocationCongeDto {
}
exports.AllocationCongeDto = AllocationCongeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['CDF', 'USD']),
    __metadata("design:type", String)
], AllocationCongeDto.prototype, "deviseAllocation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AllocationCongeDto.prototype, "remunerationJournaliere", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AllocationCongeDto.prototype, "moyenneMensuelleArticle142", void 0);
class CongeSalarieDto extends AllocationCongeDto {
}
exports.CongeSalarieDto = CongeSalarieDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CongeSalarieDto.prototype, "du", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CongeSalarieDto.prototype, "au", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(60),
    __metadata("design:type", Number)
], CongeSalarieDto.prototype, "joursVoyage", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Le mois de paie se lit AAAA-MM.' }),
    __metadata("design:type", String)
], CongeSalarieDto.prototype, "moisDePaie", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CongeSalarieDto.prototype, "auDelaDuSolde", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CongeSalarieDto.prototype, "motifAuDelaDuSolde", void 0);
class AnnulationCongeDto {
}
exports.AnnulationCongeDto = AnnulationCongeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AnnulationCongeDto.prototype, "motif", void 0);
//# sourceMappingURL=conges.dto.js.map