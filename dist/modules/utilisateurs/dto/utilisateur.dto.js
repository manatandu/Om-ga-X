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
exports.DefinirJournauxDto = exports.DefinirFonctionsDto = exports.ReinitialiserMotDePasseDto = exports.ModifierUtilisateurDto = exports.CreerUtilisateurDto = void 0;
const class_validator_1 = require("class-validator");
const courriel_1 = require("../../../common/courriel");
const client_1 = require("@prisma/client");
class CreerUtilisateurDto {
}
exports.CreerUtilisateurDto = CreerUtilisateurDto;
__decorate([
    (0, courriel_1.CourrielNormalise)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreerUtilisateurDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.MinLength)(10, { message: 'Le mot de passe doit contenir au moins 10 caractères' }),
    __metadata("design:type", String)
], CreerUtilisateurDto.prototype, "motDePasse", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.RoleUtilisateur),
    __metadata("design:type", String)
], CreerUtilisateurDto.prototype, "role", void 0);
class ModifierUtilisateurDto {
}
exports.ModifierUtilisateurDto = ModifierUtilisateurDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.RoleUtilisateur),
    __metadata("design:type", String)
], ModifierUtilisateurDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierUtilisateurDto.prototype, "estActif", void 0);
class ReinitialiserMotDePasseDto {
}
exports.ReinitialiserMotDePasseDto = ReinitialiserMotDePasseDto;
__decorate([
    (0, class_validator_1.MinLength)(10, { message: 'Le mot de passe doit contenir au moins 10 caractères' }),
    __metadata("design:type", String)
], ReinitialiserMotDePasseDto.prototype, "motDePasseProvisoire", void 0);
class DefinirFonctionsDto {
}
exports.DefinirFonctionsDto = DefinirFonctionsDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DefinirFonctionsDto.prototype, "restreindre", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(client_1.FonctionMetier, { each: true }),
    __metadata("design:type", Array)
], DefinirFonctionsDto.prototype, "fonctions", void 0);
class DefinirJournauxDto {
}
exports.DefinirJournauxDto = DefinirJournauxDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DefinirJournauxDto.prototype, "restreindre", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], DefinirJournauxDto.prototype, "journaux", void 0);
//# sourceMappingURL=utilisateur.dto.js.map