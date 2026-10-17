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
exports.VentilerLigneDto = exports.LigneVentilationDto = exports.ModifierBudgetMoisDto = exports.DoterBudgetDto = exports.ModifierSectionDto = exports.CreerSectionDto = exports.ModifierPlanAnalytiqueDto = exports.CreerPlanAnalytiqueDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreerPlanAnalytiqueDto {
}
exports.CreerPlanAnalytiqueDto = CreerPlanAnalytiqueDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerPlanAnalytiqueDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerPlanAnalytiqueDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[1-9](,[1-9])*$/, {
        message: 'classesVentilees doit être une liste de chiffres de classe séparés par des virgules, ex. "2,6,7,9"',
    }),
    __metadata("design:type", String)
], CreerPlanAnalytiqueDto.prototype, "classesVentilees", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerPlanAnalytiqueDto.prototype, "ventilationObligatoire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerPlanAnalytiqueDto.prototype, "gererBudgets", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreerPlanAnalytiqueDto.prototype, "ordre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(2),
    (0, class_validator_1.Max)(13),
    __metadata("design:type", Object)
], CreerPlanAnalytiqueDto.prototype, "longueurSections", void 0);
class ModifierPlanAnalytiqueDto {
}
exports.ModifierPlanAnalytiqueDto = ModifierPlanAnalytiqueDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierPlanAnalytiqueDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[1-9](,[1-9])*$/),
    __metadata("design:type", String)
], ModifierPlanAnalytiqueDto.prototype, "classesVentilees", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierPlanAnalytiqueDto.prototype, "ventilationObligatoire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierPlanAnalytiqueDto.prototype, "gererBudgets", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierPlanAnalytiqueDto.prototype, "estActif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(2),
    (0, class_validator_1.Max)(13),
    __metadata("design:type", Object)
], ModifierPlanAnalytiqueDto.prototype, "longueurSections", void 0);
class CreerSectionDto {
}
exports.CreerSectionDto = CreerSectionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerSectionDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerSectionDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TypeCompteDetailTotal),
    __metadata("design:type", String)
], CreerSectionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerSectionDto.prototype, "bailleurId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerSectionDto.prototype, "dateDebut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerSectionDto.prototype, "dateFin", void 0);
class ModifierSectionDto {
}
exports.ModifierSectionDto = ModifierSectionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierSectionDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ModifierSectionDto.prototype, "bailleurId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ModifierSectionDto.prototype, "dateDebut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ModifierSectionDto.prototype, "dateFin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierSectionDto.prototype, "estActive", void 0);
class DoterBudgetDto {
}
exports.DoterBudgetDto = DoterBudgetDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DoterBudgetDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], DoterBudgetDto.prototype, "montantAnnuel", void 0);
class ModifierBudgetMoisDto {
}
exports.ModifierBudgetMoisDto = ModifierBudgetMoisDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierBudgetMoisDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(12),
    __metadata("design:type", Number)
], ModifierBudgetMoisDto.prototype, "mois", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ModifierBudgetMoisDto.prototype, "montant", void 0);
class LigneVentilationDto {
}
exports.LigneVentilationDto = LigneVentilationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LigneVentilationDto.prototype, "sectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], LigneVentilationDto.prototype, "debit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], LigneVentilationDto.prototype, "credit", void 0);
class VentilerLigneDto {
}
exports.VentilerLigneDto = VentilerLigneDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneVentilationDto),
    __metadata("design:type", Array)
], VentilerLigneDto.prototype, "ventilations", void 0);
//# sourceMappingURL=analytique.dto.js.map