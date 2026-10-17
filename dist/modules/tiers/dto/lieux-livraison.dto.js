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
exports.LieuLivraisonDto = void 0;
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
class LieuLivraisonDto {
}
exports.LieuLivraisonDto = LieuLivraisonDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(35, { message: "L'intitulé du lieu compte au plus 35 caractères." }),
    __metadata("design:type", String)
], LieuLivraisonDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], LieuLivraisonDto.prototype, "adresse", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], LieuLivraisonDto.prototype, "complement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], LieuLivraisonDto.prototype, "boitePostale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], LieuLivraisonDto.prototype, "ville", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], LieuLivraisonDto.prototype, "pays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], LieuLivraisonDto.prototype, "contact", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], LieuLivraisonDto.prototype, "telephone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)({}, { message: 'Adresse électronique du lieu invalide' }),
    __metadata("design:type", Object)
], LieuLivraisonDto.prototype, "email", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Le lieu principal vaut vrai ou faux · omettez le champ pour le garder.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], LieuLivraisonDto.prototype, "estPrincipal", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('L’état du lieu vaut vrai ou faux · omettez le champ pour le garder.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], LieuLivraisonDto.prototype, "estActif", void 0);
//# sourceMappingURL=lieux-livraison.dto.js.map