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
exports.EnregistrerRegularisationInventaireDto = exports.ConfronterInventaireDto = exports.ComptagePhysiqueDto = exports.AnnulerMouvementStockDto = exports.EnregistrerMouvementStockDto = exports.CreerArticleStockDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreerArticleStockDto {
}
exports.CreerArticleStockDto = CreerArticleStockDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerArticleStockDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreerArticleStockDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerArticleStockDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreerArticleStockDto.prototype, "uniteMesure", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MethodeValorisationStock),
    __metadata("design:type", String)
], CreerArticleStockDto.prototype, "methodeValorisation", void 0);
class EnregistrerMouvementStockDto {
}
exports.EnregistrerMouvementStockDto = EnregistrerMouvementStockDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EnregistrerMouvementStockDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.SensMouvementStock),
    __metadata("design:type", String)
], EnregistrerMouvementStockDto.prototype, "sens", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 3 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], EnregistrerMouvementStockDto.prototype, "quantite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], EnregistrerMouvementStockDto.prototype, "cout", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], EnregistrerMouvementStockDto.prototype, "piece", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], EnregistrerMouvementStockDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EnregistrerMouvementStockDto.prototype, "ecritureId", void 0);
class AnnulerMouvementStockDto {
}
exports.AnnulerMouvementStockDto = AnnulerMouvementStockDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], AnnulerMouvementStockDto.prototype, "motif", void 0);
class ComptagePhysiqueDto {
}
exports.ComptagePhysiqueDto = ComptagePhysiqueDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ComptagePhysiqueDto.prototype, "articleId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 3 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ComptagePhysiqueDto.prototype, "quantitePhysique", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 6 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ComptagePhysiqueDto.prototype, "coutUnitaireBoni", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ComptagePhysiqueDto.prototype, "sourceCoutBoni", void 0);
class ConfronterInventaireDto {
}
exports.ConfronterInventaireDto = ConfronterInventaireDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ConfronterInventaireDto.prototype, "dateComptage", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ComptagePhysiqueDto),
    __metadata("design:type", Array)
], ConfronterInventaireDto.prototype, "comptages", void 0);
class EnregistrerRegularisationInventaireDto extends ConfronterInventaireDto {
}
exports.EnregistrerRegularisationInventaireDto = EnregistrerRegularisationInventaireDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EnregistrerRegularisationInventaireDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EnregistrerRegularisationInventaireDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EnregistrerRegularisationInventaireDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], EnregistrerRegularisationInventaireDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], EnregistrerRegularisationInventaireDto.prototype, "reference", void 0);
//# sourceMappingURL=magasin.dto.js.map