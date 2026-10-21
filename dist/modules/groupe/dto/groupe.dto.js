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
exports.ImporterCanevasDto = exports.CreerCelluleDto = void 0;
const class_validator_1 = require("class-validator");
const courriel_1 = require("../../../common/courriel");
const client_1 = require("@prisma/client");
class CreerCelluleDto {
}
exports.CreerCelluleDto = CreerCelluleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreerCelluleDto.prototype, "nom", void 0);
__decorate([
    (0, courriel_1.CourrielNormalise)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreerCelluleDto.prototype, "emailAdmin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.JeuEtatsFinanciersSycebnl),
    __metadata("design:type", String)
], CreerCelluleDto.prototype, "jeuEtatsFinanciersSycebnl", void 0);
class ImporterCanevasDto {
}
exports.ImporterCanevasDto = ImporterCanevasDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], ImporterCanevasDto.prototype, "nomFichier", void 0);
__decorate([
    (0, class_validator_1.IsBase64)(),
    (0, class_validator_1.MaxLength)(11_000_000),
    __metadata("design:type", String)
], ImporterCanevasDto.prototype, "contenuBase64", void 0);
//# sourceMappingURL=groupe.dto.js.map