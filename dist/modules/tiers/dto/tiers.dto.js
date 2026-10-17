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
exports.RattacherCompteDto = exports.CompletionPanopliesDto = exports.NumeroProposeDto = exports.ModifierTiersDto = exports.CreerTiersDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
class CreerTiersDto {
}
exports.CreerTiersDto = CreerTiersDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TypeTiers),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^\S+$/, { message: 'Le code ne doit pas contenir d’espaces' }),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "modeleReglementId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "modeReglementId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "modeleImpressionExtraitId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "modeleImpressionReglementId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "modeleImpressionRappelId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerTiersDto.prototype, "creerCompteIndividuel", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("Un numéro de compte choisi est un numéro · omettez le champ pour garder celui qu'OmegaX propose."),
    (0, class_validator_1.IsString)({ message: 'Le numéro de compte choisi est une suite de chiffres' }),
    (0, class_validator_1.IsNotEmpty)({ message: "Un numéro de compte choisi ne peut pas être vide · omettez le champ pour garder celui qu'OmegaX propose." }),
    (0, class_validator_1.MaxLength)(13, { message: 'Un numéro de compte compte au plus 13 chiffres' }),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "numeroCompte", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "adresse", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "boitePostale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "ville", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "pays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "telephone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)({}, { message: 'Adresse électronique invalide' }),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "numeroImpot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "contact", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('L’échéancier appliqué sans fenêtre vaut vrai ou faux · omettez le champ pour le laisser faux.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerTiersDto.prototype, "validationAutomatiqueEcheances", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(35, { message: 'La qualité du tiers compte au plus 35 caractères.' }),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "qualite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "celluleGroupeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerTiersDto.prototype, "autoriseTvaDebits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "referenceAutorisationDebits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateEffetAutorisationDebits !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "dateEffetAutorisationDebits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateRevocationAutorisationDebits !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerTiersDto.prototype, "dateRevocationAutorisationDebits", void 0);
class ModifierTiersDto {
}
exports.ModifierTiersDto = ModifierTiersDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierTiersDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierTiersDto.prototype, "estActif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ModifierTiersDto.prototype, "modeleReglementId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ModifierTiersDto.prototype, "modeReglementId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ModifierTiersDto.prototype, "modeleImpressionExtraitId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ModifierTiersDto.prototype, "modeleImpressionReglementId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ModifierTiersDto.prototype, "modeleImpressionRappelId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierTiersDto.prototype, "adresse", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierTiersDto.prototype, "boitePostale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierTiersDto.prototype, "ville", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierTiersDto.prototype, "pays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierTiersDto.prototype, "telephone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)({}, { message: 'Adresse électronique invalide' }),
    __metadata("design:type", String)
], ModifierTiersDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierTiersDto.prototype, "numeroImpot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierTiersDto.prototype, "contact", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(35, { message: 'La qualité du tiers compte au plus 35 caractères.' }),
    __metadata("design:type", Object)
], ModifierTiersDto.prototype, "qualite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ModifierTiersDto.prototype, "celluleGroupeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierTiersDto.prototype, "autoriseTvaDebits", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('L’échéancier appliqué sans fenêtre vaut vrai ou faux · omettez le champ pour le garder.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierTiersDto.prototype, "validationAutomatiqueEcheances", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ModifierTiersDto.prototype, "referenceAutorisationDebits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateEffetAutorisationDebits !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ModifierTiersDto.prototype, "dateEffetAutorisationDebits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateRevocationAutorisationDebits !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ModifierTiersDto.prototype, "dateRevocationAutorisationDebits", void 0);
class NumeroProposeDto {
}
exports.NumeroProposeDto = NumeroProposeDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TypeTiers, { message: 'Type de tiers inconnu' }),
    __metadata("design:type", String)
], NumeroProposeDto.prototype, "type", void 0);
class CompletionPanopliesDto {
}
exports.CompletionPanopliesDto = CompletionPanopliesDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CompletionPanopliesDto.prototype, "apres", void 0);
class RattacherCompteDto {
}
exports.RattacherCompteDto = RattacherCompteDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RattacherCompteDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RattacherCompteDto.prototype, "estPrincipal", void 0);
//# sourceMappingURL=tiers.dto.js.map