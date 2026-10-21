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
exports.InscriptionEssaiDto = void 0;
const class_validator_1 = require("class-validator");
const courriel_1 = require("../../../common/courriel");
const client_1 = require("@prisma/client");
class InscriptionEssaiDto {
}
exports.InscriptionEssaiDto = InscriptionEssaiDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2, { message: "Le nom de l'entité compte au moins 2 caractères" }),
    (0, class_validator_1.MaxLength)(120, { message: "Le nom de l'entité compte au plus 120 caractères" }),
    __metadata("design:type", String)
], InscriptionEssaiDto.prototype, "nomEntite", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.Referentiel),
    __metadata("design:type", String)
], InscriptionEssaiDto.prototype, "referentiel", void 0);
__decorate([
    (0, courriel_1.CourrielNormalise)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], InscriptionEssaiDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.JeuEtatsFinanciersSycebnl),
    __metadata("design:type", String)
], InscriptionEssaiDto.prototype, "jeuEtatsFinanciersSycebnl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SystemeComptableSyscohada),
    __metadata("design:type", String)
], InscriptionEssaiDto.prototype, "systemeComptableSyscohada", void 0);
//# sourceMappingURL=inscription-essai.dto.js.map