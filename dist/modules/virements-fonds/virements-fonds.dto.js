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
exports.AnnulerVirementDto = exports.CreerVirementDto = exports.PieceOperationDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../common/facultatif-non-nul");
class PieceOperationDto {
}
exports.PieceOperationDto = PieceOperationDto;
class CreerVirementDto {
}
exports.CreerVirementDto = CreerVirementDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerVirementDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerVirementDto.prototype, "journalOrigineId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerVirementDto.prototype, "journalDestinationId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }, { message: 'Le montant se saisit au centime près.' }),
    (0, class_validator_1.Min)(0.01, { message: 'Le montant du virement doit être positif.' }),
    __metadata("design:type", Number)
], CreerVirementDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsObject)({ message: 'La pièce de la sortie des fonds se donne avec sa nature, sa référence et sa date.' }),
    (0, class_transformer_1.Type)(() => PieceOperationDto),
    __metadata("design:type", PieceOperationDto)
], CreerVirementDto.prototype, "sortie", void 0);
__decorate([
    (0, class_validator_1.IsObject)({ message: "La pièce de l'entrée des fonds se donne avec sa nature, sa référence et sa date." }),
    (0, class_transformer_1.Type)(() => PieceOperationDto),
    __metadata("design:type", PieceOperationDto)
], CreerVirementDto.prototype, "entree", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 200),
    __metadata("design:type", String)
], CreerVirementDto.prototype, "objet", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez le porteur, ou nommez-le.'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreerVirementDto.prototype, "porteur", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez les observations, ou écrivez-les.'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreerVirementDto.prototype, "observations", void 0);
class AnnulerVirementDto {
}
exports.AnnulerVirementDto = AnnulerVirementDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 500),
    __metadata("design:type", String)
], AnnulerVirementDto.prototype, "motif", void 0);
//# sourceMappingURL=virements-fonds.dto.js.map