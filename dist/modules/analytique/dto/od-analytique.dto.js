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
exports.CreerOdAnalytiqueDto = exports.LigneOdAnalytiqueDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class LigneOdAnalytiqueDto {
}
exports.LigneOdAnalytiqueDto = LigneOdAnalytiqueDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LigneOdAnalytiqueDto.prototype, "sectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], LigneOdAnalytiqueDto.prototype, "debit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], LigneOdAnalytiqueDto.prototype, "credit", void 0);
class CreerOdAnalytiqueDto {
}
exports.CreerOdAnalytiqueDto = CreerOdAnalytiqueDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerOdAnalytiqueDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerOdAnalytiqueDto.prototype, "planId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerOdAnalytiqueDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerOdAnalytiqueDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerOdAnalytiqueDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreerOdAnalytiqueDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneOdAnalytiqueDto),
    __metadata("design:type", Array)
], CreerOdAnalytiqueDto.prototype, "lignes", void 0);
//# sourceMappingURL=od-analytique.dto.js.map