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
exports.RemplacerModeleEditionDto = exports.CreerModeleEditionDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../../../common/facultatif-non-nul");
class CreerModeleEditionDto {
}
exports.CreerModeleEditionDto = CreerModeleEditionDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.EditionModele, { message: 'Édition inconnue · PLAN_COMPTABLE, PLAN_TIERS ou PLAN_ANALYTIQUE.' }),
    __metadata("design:type", String)
], CreerModeleEditionDto.prototype, "edition", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'Le nom du modèle est exigé.' }),
    __metadata("design:type", String)
], CreerModeleEditionDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsArray)({ message: 'Les colonnes du modèle sont exigées.' }),
    __metadata("design:type", Array)
], CreerModeleEditionDto.prototype, "colonnes", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Saut nul refusé · omettez le champ pour « Aucun », ou envoyez AUCUN, LIGNE ou PAGE.'),
    (0, class_validator_1.IsString)({ message: 'Saut inconnu · AUCUN, LIGNE ou PAGE.' }),
    __metadata("design:type", String)
], CreerModeleEditionDto.prototype, "saut", void 0);
class RemplacerModeleEditionDto {
}
exports.RemplacerModeleEditionDto = RemplacerModeleEditionDto;
__decorate([
    (0, class_validator_1.IsArray)({ message: 'Les colonnes du modèle sont exigées.' }),
    __metadata("design:type", Array)
], RemplacerModeleEditionDto.prototype, "colonnes", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Saut nul refusé · omettez le champ pour garder le saut du modèle, ou envoyez AUCUN, LIGNE ou PAGE.'),
    (0, class_validator_1.IsString)({ message: 'Saut inconnu · AUCUN, LIGNE ou PAGE.' }),
    __metadata("design:type", String)
], RemplacerModeleEditionDto.prototype, "saut", void 0);
//# sourceMappingURL=modele-edition.dto.js.map