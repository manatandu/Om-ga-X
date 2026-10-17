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
exports.ExecuterImportDto = exports.AnalyserImportDto = exports.TypeImport = void 0;
const class_validator_1 = require("class-validator");
var TypeImport;
(function (TypeImport) {
    TypeImport["PLAN_COMPTES"] = "PLAN_COMPTES";
    TypeImport["BALANCE"] = "BALANCE";
    TypeImport["ECRITURES"] = "ECRITURES";
})(TypeImport || (exports.TypeImport = TypeImport = {}));
const TAILLE_MAX_BASE64 = 11_000_000;
class AnalyserImportDto {
}
exports.AnalyserImportDto = AnalyserImportDto;
__decorate([
    (0, class_validator_1.IsEnum)(TypeImport),
    __metadata("design:type", String)
], AnalyserImportDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AnalyserImportDto.prototype, "nomFichier", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(TAILLE_MAX_BASE64, { message: 'Fichier trop volumineux (8 Mo maximum)' }),
    __metadata("design:type", String)
], AnalyserImportDto.prototype, "contenuBase64", void 0);
class ExecuterImportDto extends AnalyserImportDto {
}
exports.ExecuterImportDto = ExecuterImportDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ExecuterImportDto.prototype, "mapping", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ExecuterImportDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ExecuterImportDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ExecuterImportDto.prototype, "dateOperation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ExecuterImportDto.prototype, "creerComptesManquants", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ExecuterImportDto.prototype, "bilanDOuverture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ExecuterImportDto.prototype, "simulation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([';', ',', '\t']),
    __metadata("design:type", String)
], ExecuterImportDto.prototype, "separateur", void 0);
//# sourceMappingURL=import.dto.js.map