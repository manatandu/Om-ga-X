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
exports.ModifierJournalDto = exports.CompteDuJournalProposeDto = exports.CreerJournalDto = void 0;
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
const client_1 = require("@prisma/client");
class CreerJournalDto {
}
exports.CreerJournalDto = CreerJournalDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 6),
    __metadata("design:type", String)
], CreerJournalDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerJournalDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TypeJournal),
    __metadata("design:type", String)
], CreerJournalDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerJournalDto.prototype, "compteTresorerieId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("Le compte du plan sous lequel ouvrir le compte du journal · omettez le champ pour choisir un compte existant."),
    (0, class_validator_1.IsUUID)('all', { message: 'Compte du plan inconnu' }),
    __metadata("design:type", String)
], CreerJournalDto.prototype, "ouvrirCompteSousId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("Un numéro de compte choisi est un numéro · omettez le champ pour garder celui qu'OmegaX propose."),
    (0, class_validator_1.IsString)({ message: 'Le numéro de compte choisi est une suite de chiffres' }),
    (0, class_validator_1.IsNotEmpty)({ message: "Un numéro de compte choisi ne peut pas être vide · omettez le champ pour garder celui qu'OmegaX propose." }),
    (0, class_validator_1.MaxLength)(13, { message: 'Un numéro de compte compte au plus 13 chiffres' }),
    __metadata("design:type", String)
], CreerJournalDto.prototype, "numeroCompte", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.NumerotationPiece),
    __metadata("design:type", String)
], CreerJournalDto.prototype, "numerotation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerJournalDto.prototype, "contrepartieChaqueLigne", void 0);
class CompteDuJournalProposeDto {
}
exports.CompteDuJournalProposeDto = CompteDuJournalProposeDto;
__decorate([
    (0, class_validator_1.IsUUID)('all', { message: 'Compte du plan inconnu' }),
    __metadata("design:type", String)
], CompteDuJournalProposeDto.prototype, "sousId", void 0);
class ModifierJournalDto {
}
exports.ModifierJournalDto = ModifierJournalDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierJournalDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ModifierJournalDto.prototype, "compteTresorerieId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.NumerotationPiece),
    __metadata("design:type", String)
], ModifierJournalDto.prototype, "numerotation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierJournalDto.prototype, "estActif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierJournalDto.prototype, "contrepartieChaqueLigne", void 0);
//# sourceMappingURL=journal.dto.js.map