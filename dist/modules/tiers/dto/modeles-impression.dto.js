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
exports.ModifierModeleImpressionDto = exports.CreerModeleImpressionDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
const modeles_impression_1 = require("../modeles-impression");
class CreerModeleImpressionDto {
}
exports.CreerModeleImpressionDto = CreerModeleImpressionDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureModeleImpression, { message: 'Nature de modèle inconnue · extrait de compte, avis de règlement ou rappel.' }),
    __metadata("design:type", String)
], CreerModeleImpressionDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(modeles_impression_1.LONGUEUR_INTITULE_MODELE, { message: `L'intitulé du modèle tient en ${modeles_impression_1.LONGUEUR_INTITULE_MODELE} caractères au plus.` }),
    __metadata("design:type", String)
], CreerModeleImpressionDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(modeles_impression_1.LONGUEUR_TEXTE_MODELE, { message: `Le texte du modèle tient en ${modeles_impression_1.LONGUEUR_TEXTE_MODELE} caractères au plus.` }),
    __metadata("design:type", String)
], CreerModeleImpressionDto.prototype, "texte", void 0);
class ModifierModeleImpressionDto {
}
exports.ModifierModeleImpressionDto = ModifierModeleImpressionDto;
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("L'intitulé du modèle ne s'efface pas."),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(modeles_impression_1.LONGUEUR_INTITULE_MODELE, { message: `L'intitulé du modèle tient en ${modeles_impression_1.LONGUEUR_INTITULE_MODELE} caractères au plus.` }),
    __metadata("design:type", String)
], ModifierModeleImpressionDto.prototype, "intitule", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("Le texte du modèle ne s'efface pas."),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(modeles_impression_1.LONGUEUR_TEXTE_MODELE, { message: `Le texte du modèle tient en ${modeles_impression_1.LONGUEUR_TEXTE_MODELE} caractères au plus.` }),
    __metadata("design:type", String)
], ModifierModeleImpressionDto.prototype, "texte", void 0);
//# sourceMappingURL=modeles-impression.dto.js.map