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
exports.ModifierImmobilisationDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
class ModifierImmobilisationDto {
}
exports.ModifierImmobilisationDto = ModifierImmobilisationDto;
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La désignation ne s’efface pas · omettez le champ pour la garder.'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    (0, class_validator_1.Matches)(/\S/, { message: 'Indiquez une désignation.' }),
    __metadata("design:type", String)
], ModifierImmobilisationDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", Object)
], ModifierImmobilisationDto.prototype, "numeroInventaire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", Object)
], ModifierImmobilisationDto.prototype, "natureFiscaleCle", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Le compte du bien ne s’efface pas · omettez le champ pour le garder.'),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ModifierImmobilisationDto.prototype, "compteImmobilisationId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La contrepartie ne s’efface pas · omettez le champ pour la garder.'),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ModifierImmobilisationDto.prototype, "compteContrepartieId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("La date d'acquisition ne s’efface pas · omettez le champ pour la garder."),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierImmobilisationDto.prototype, "dateAcquisition", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ModifierImmobilisationDto.prototype, "dateMiseEnService", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La valeur d’origine ne s’efface pas · omettez le champ pour la garder.'),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ModifierImmobilisationDto.prototype, "valeurOrigine", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La valeur résiduelle ne s’efface pas · 0 pour aucune.'),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ModifierImmobilisationDto.prototype, "valeurResiduelle", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La durée ne s’efface pas · omettez le champ pour la garder.'),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ModifierImmobilisationDto.prototype, "dureeAmortissementAns", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Le mode ne s’efface pas · omettez le champ pour le garder.'),
    (0, class_validator_1.IsEnum)(client_1.ModeAmortissement),
    __metadata("design:type", String)
], ModifierImmobilisationDto.prototype, "modeAmortissement", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Le total d’unités prévues ne s’efface pas · omettez le champ pour le garder.'),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ModifierImmobilisationDto.prototype, "unitesOeuvrePrevues", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('L’unité ne s’efface pas · omettez le champ pour la garder.'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ModifierImmobilisationDto.prototype, "uniteOeuvreLibelle", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('L’amortissement déjà pratiqué ne s’efface pas · 0 pour aucun.'),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ModifierImmobilisationDto.prototype, "amortissementAnterieur", void 0);
//# sourceMappingURL=fiche-immobilisation.dto.js.map