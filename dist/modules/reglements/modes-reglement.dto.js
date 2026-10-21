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
exports.ModifierModeReglementDto = exports.CreerModeReglementDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const facultatif_non_nul_1 = require("../../common/facultatif-non-nul");
class CreerModeReglementDto {
}
exports.CreerModeReglementDto = CreerModeReglementDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", String)
], CreerModeReglementDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerModeReglementDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureModeReglement, { message: 'Nature de mode de règlement inconnue' }),
    __metadata("design:type", String)
], CreerModeReglementDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(17),
    __metadata("design:type", Object)
], CreerModeReglementDto.prototype, "codeInterbancaire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], CreerModeReglementDto.prototype, "journalId", void 0);
class ModifierModeReglementDto {
}
exports.ModifierModeReglementDto = ModifierModeReglementDto;
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('L’intitulé du mode de règlement ne s’efface pas · omettez le champ pour le garder.'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ModifierModeReglementDto.prototype, "intitule", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La nature du mode de règlement ne s’efface pas · omettez le champ pour la garder.'),
    (0, class_validator_1.IsEnum)(client_1.NatureModeReglement, { message: 'Nature de mode de règlement inconnue' }),
    __metadata("design:type", String)
], ModifierModeReglementDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(17),
    __metadata("design:type", Object)
], ModifierModeReglementDto.prototype, "codeInterbancaire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ModifierModeReglementDto.prototype, "journalId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Un mode est actif ou en sommeil · omettez le champ pour le garder.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierModeReglementDto.prototype, "estActif", void 0);
//# sourceMappingURL=modes-reglement.dto.js.map