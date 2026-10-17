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
exports.RetirerFormatAnterieurDto = exports.SaisirNoteDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
const effectifs_seize_colonnes_1 = require("../effectifs-seize-colonnes");
class SaisirNoteDto {
}
exports.SaisirNoteDto = SaisirNoteDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaisirNoteDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.JeuNotesAnnexes),
    __metadata("design:type", String)
], SaisirNoteDto.prototype, "jeu", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], SaisirNoteDto.prototype, "codeNote", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], SaisirNoteDto.prototype, "cleRubrique", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaisirNoteDto.prototype, "colonne", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Le rang de ligne se donne par un entier à partir de 0, ou s’omet pour la ligne unique · jamais null.'),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999),
    __metadata("design:type", Number)
], SaisirNoteDto.prototype, "rang", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], SaisirNoteDto.prototype, "valeur", void 0);
class RetirerFormatAnterieurDto {
}
exports.RetirerFormatAnterieurDto = RetirerFormatAnterieurDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RetirerFormatAnterieurDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.JeuNotesAnnexes),
    __metadata("design:type", String)
], RetirerFormatAnterieurDto.prototype, "jeu", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], RetirerFormatAnterieurDto.prototype, "codeNote", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(effectifs_seize_colonnes_1.MOTIF_RETRAIT_MIN, { message: `Le motif du retrait compte ${effectifs_seize_colonnes_1.MOTIF_RETRAIT_MIN} caractères au moins.` }),
    (0, class_validator_1.MaxLength)(effectifs_seize_colonnes_1.MOTIF_RETRAIT_MAX, { message: `Le motif du retrait compte ${effectifs_seize_colonnes_1.MOTIF_RETRAIT_MAX} caractères au plus.` }),
    __metadata("design:type", String)
], RetirerFormatAnterieurDto.prototype, "motif", void 0);
//# sourceMappingURL=saisie-note.dto.js.map