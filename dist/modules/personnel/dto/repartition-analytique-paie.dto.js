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
exports.RetraitRepartitionAnalytiqueDto = exports.RepartitionAnalytiquePaieDto = exports.LigneRepartitionAnalytiqueDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const ventilation_analytique_paie_1 = require("../ventilation-analytique-paie");
class LigneRepartitionAnalytiqueDto {
}
exports.LigneRepartitionAnalytiqueDto = LigneRepartitionAnalytiqueDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LigneRepartitionAnalytiqueDto.prototype, "sectionId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], LigneRepartitionAnalytiqueDto.prototype, "pourcentage", void 0);
class RepartitionAnalytiquePaieDto {
}
exports.RepartitionAnalytiquePaieDto = RepartitionAnalytiquePaieDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RepartitionAnalytiquePaieDto.prototype, "planId", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Mois d'effet illisible · la forme attendue est AAAA-MM." }),
    __metadata("design:type", String)
], RepartitionAnalytiquePaieDto.prototype, "moisEffet", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(ventilation_analytique_paie_1.PLAFOND_LIGNES_REPARTITION),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneRepartitionAnalytiqueDto),
    __metadata("design:type", Array)
], RepartitionAnalytiquePaieDto.prototype, "lignes", void 0);
class RetraitRepartitionAnalytiqueDto {
}
exports.RetraitRepartitionAnalytiqueDto = RetraitRepartitionAnalytiqueDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RetraitRepartitionAnalytiqueDto.prototype, "motif", void 0);
//# sourceMappingURL=repartition-analytique-paie.dto.js.map