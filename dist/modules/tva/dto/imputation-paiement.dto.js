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
exports.RetirerImputationDto = exports.DeclarerImputationDto = exports.FactureImputeeDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
class FactureImputeeDto {
}
exports.FactureImputeeDto = FactureImputeeDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], FactureImputeeDto.prototype, "ligneFactureId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], FactureImputeeDto.prototype, "montant", void 0);
class DeclarerImputationDto {
}
exports.DeclarerImputationDto = DeclarerImputationDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DeclarerImputationDto.prototype, "ligneReglementId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['DECLARATION_DU_DEBITEUR', 'QUITTANCE_ACCEPTEE']),
    __metadata("design:type", String)
], DeclarerImputationDto.prototype, "fondement", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], DeclarerImputationDto.prototype, "pieceReference", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DeclarerImputationDto.prototype, "pieceDate", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La preuve de l’acceptation ne peut pas être nulle · omettez-la pour une déclaration du débiteur.'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], DeclarerImputationDto.prototype, "preuveAcceptation", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FactureImputeeDto),
    __metadata("design:type", Array)
], DeclarerImputationDto.prototype, "factures", void 0);
class RetirerImputationDto {
}
exports.RetirerImputationDto = RetirerImputationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RetirerImputationDto.prototype, "motif", void 0);
//# sourceMappingURL=imputation-paiement.dto.js.map