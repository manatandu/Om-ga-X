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
exports.EtablirRapportActiviteDto = exports.ResumeInventaireDto = exports.TranscrireInventaireDto = void 0;
const class_validator_1 = require("class-validator");
class TranscrireInventaireDto {
}
exports.TranscrireInventaireDto = TranscrireInventaireDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], TranscrireInventaireDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TranscrireInventaireDto.prototype, "resumeOperationInventaire", void 0);
class ResumeInventaireDto {
}
exports.ResumeInventaireDto = ResumeInventaireDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ResumeInventaireDto.prototype, "resumeOperationInventaire", void 0);
class EtablirRapportActiviteDto {
}
exports.EtablirRapportActiviteDto = EtablirRapportActiviteDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EtablirRapportActiviteDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EtablirRapportActiviteDto.prototype, "etabliLe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EtablirRapportActiviteDto.prototype, "situationExerciceEcoule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EtablirRapportActiviteDto.prototype, "perspectivesDeveloppement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EtablirRapportActiviteDto.prototype, "evolutionTresorerie", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EtablirRapportActiviteDto.prototype, "evenementsPosterieurs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], EtablirRapportActiviteDto.prototype, "sections", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EtablirRapportActiviteDto.prototype, "entiteAvecAuditeur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EtablirRapportActiviteDto.prototype, "declarationDirigeants", void 0);
//# sourceMappingURL=documents-obligatoires.dto.js.map