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
exports.CreerCompteEnSaisieDto = exports.ModifierCompteDto = exports.CreerCompteDto = void 0;
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
const client_1 = require("@prisma/client");
class CreerCompteDto {
}
exports.CreerCompteDto = CreerCompteDto;
__decorate([
    (0, class_validator_1.Matches)(/^\d{3,13}$/, { message: 'Le numéro de compte doit être numérique (3 à 13 chiffres)' }),
    __metadata("design:type", String)
], CreerCompteDto.prototype, "numero", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerCompteDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ClasseCompte),
    __metadata("design:type", String)
], CreerCompteDto.prototype, "classe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ModeReportANouveau),
    __metadata("design:type", String)
], CreerCompteDto.prototype, "modeReportANouveau", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TypeCompteDetailTotal),
    __metadata("design:type", String)
], CreerCompteDto.prototype, "typeCompte", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerCompteDto.prototype, "lettrable", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreerCompteDto.prototype, "tauxTvaDefautId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerCompteDto.prototype, "codeRetraitementFiscal", void 0);
class ModifierCompteDto {
}
exports.ModifierCompteDto = ModifierCompteDto;
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Un compte est retenu ou non · null ne dit pas lequel des deux.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierCompteDto.prototype, "estRetenu", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierCompteDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierCompteDto.prototype, "codeRetraitementFiscal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierCompteDto.prototype, "estActif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ModeReportANouveau),
    __metadata("design:type", String)
], ModifierCompteDto.prototype, "modeReportANouveau", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TypeCompteDetailTotal),
    __metadata("design:type", String)
], ModifierCompteDto.prototype, "typeCompte", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ModifierCompteDto.prototype, "bailleurId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("Un compte porte ou non la contrepartie de l'État · null ne dit pas lequel des deux."),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierCompteDto.prototype, "porteFondsContrepartieEtat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierCompteDto.prototype, "lettrable", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ModifierCompteDto.prototype, "tauxTvaDefautId", void 0);
class CreerCompteEnSaisieDto {
}
exports.CreerCompteEnSaisieDto = CreerCompteEnSaisieDto;
__decorate([
    (0, class_validator_1.Matches)(/^\d{3,13}$/, { message: 'Le numéro de compte doit être numérique (3 à 13 chiffres)' }),
    __metadata("design:type", String)
], CreerCompteEnSaisieDto.prototype, "numero", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerCompteEnSaisieDto.prototype, "intitule", void 0);
//# sourceMappingURL=creer-compte.dto.js.map