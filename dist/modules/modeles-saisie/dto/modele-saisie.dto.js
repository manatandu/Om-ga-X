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
exports.ModifierModeleSaisieDto = exports.CreerModeleSaisieDto = exports.LigneModeleSaisieDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class LigneModeleSaisieDto {
}
exports.LigneModeleSaisieDto = LigneModeleSaisieDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LigneModeleSaisieDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.SensModeleSaisie),
    __metadata("design:type", String)
], LigneModeleSaisieDto.prototype, "sens", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], LigneModeleSaisieDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], LigneModeleSaisieDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FonctionLigneModele),
    __metadata("design:type", String)
], LigneModeleSaisieDto.prototype, "fonction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LigneModeleSaisieDto.prototype, "tauxTvaId", void 0);
class CreerModeleSaisieDto {
}
exports.CreerModeleSaisieDto = CreerModeleSaisieDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreerModeleSaisieDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerModeleSaisieDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TypeJournal),
    __metadata("design:type", String)
], CreerModeleSaisieDto.prototype, "typeJournal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerModeleSaisieDto.prototype, "sequenceSaisieId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneModeleSaisieDto),
    __metadata("design:type", Array)
], CreerModeleSaisieDto.prototype, "lignes", void 0);
class ModifierModeleSaisieDto {
}
exports.ModifierModeleSaisieDto = ModifierModeleSaisieDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ModifierModeleSaisieDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ModifierModeleSaisieDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TypeJournal),
    __metadata("design:type", Object)
], ModifierModeleSaisieDto.prototype, "typeJournal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ModifierModeleSaisieDto.prototype, "sequenceSaisieId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierModeleSaisieDto.prototype, "estActif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneModeleSaisieDto),
    __metadata("design:type", Array)
], ModifierModeleSaisieDto.prototype, "lignes", void 0);
//# sourceMappingURL=modele-saisie.dto.js.map