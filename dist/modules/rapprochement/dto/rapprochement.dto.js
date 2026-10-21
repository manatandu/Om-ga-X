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
exports.RouvrirRapprochementDto = exports.PointerEncoursDto = exports.DeclarerEncoursDto = exports.DeclarerDepartDto = exports.ConfirmerCorrespondancesDto = exports.CorrespondanceDto = exports.ImporterReleveDto = exports.PointerDto = exports.OuvrirRapprochementDto = exports.PropositionsRapprochementDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const filtre_journal_audit_dto_1 = require("../../../common/audit/filtre-journal-audit.dto");
const releve_bancaire_1 = require("../releve-bancaire");
class PropositionsRapprochementDto {
}
exports.PropositionsRapprochementDto = PropositionsRapprochementDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(filtre_journal_audit_dto_1.enEntier),
    (0, class_validator_1.IsInt)({ message: `Fenêtre de dates illisible · un nombre entier de jours, de 0 à ${releve_bancaire_1.FENETRE_JOURS_MAX}, est attendu.` }),
    (0, class_validator_1.Min)(0, { message: `Fenêtre de dates illisible · un nombre entier de jours, de 0 à ${releve_bancaire_1.FENETRE_JOURS_MAX}, est attendu.` }),
    (0, class_validator_1.Max)(releve_bancaire_1.FENETRE_JOURS_MAX, {
        message: `Fenêtre de dates hors limite · ${releve_bancaire_1.FENETRE_JOURS_MAX} jours au plus, comme à l'écran.`,
    }),
    __metadata("design:type", Number)
], PropositionsRapprochementDto.prototype, "fenetreJours", void 0);
class OuvrirRapprochementDto {
}
exports.OuvrirRapprochementDto = OuvrirRapprochementDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], OuvrirRapprochementDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], OuvrirRapprochementDto.prototype, "dateReleve", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OuvrirRapprochementDto.prototype, "soldeReleve", void 0);
class PointerDto {
}
exports.PointerDto = PointerDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], PointerDto.prototype, "ligneIds", void 0);
const TAILLE_MAX_BASE64 = 11_000_000;
class ImporterReleveDto {
}
exports.ImporterReleveDto = ImporterReleveDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImporterReleveDto.prototype, "nomFichier", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(TAILLE_MAX_BASE64, { message: 'Fichier trop volumineux (8 Mo maximum)' }),
    __metadata("design:type", String)
], ImporterReleveDto.prototype, "contenuBase64", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ImporterReleveDto.prototype, "colonnes", void 0);
class CorrespondanceDto {
}
exports.CorrespondanceDto = CorrespondanceDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CorrespondanceDto.prototype, "ligneReleveId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], CorrespondanceDto.prototype, "ligneEcritureIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], CorrespondanceDto.prototype, "encoursIds", void 0);
class ConfirmerCorrespondancesDto {
}
exports.ConfirmerCorrespondancesDto = ConfirmerCorrespondancesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CorrespondanceDto),
    __metadata("design:type", Array)
], ConfirmerCorrespondancesDto.prototype, "correspondances", void 0);
class DeclarerDepartDto {
}
exports.DeclarerDepartDto = DeclarerDepartDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], DeclarerDepartDto.prototype, "soldeDepart", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DeclarerDepartDto.prototype, "dateDepart", void 0);
class DeclarerEncoursDto {
}
exports.DeclarerEncoursDto = DeclarerEncoursDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], DeclarerEncoursDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DeclarerEncoursDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], DeclarerEncoursDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['DEBIT', 'CREDIT']),
    __metadata("design:type", String)
], DeclarerEncoursDto.prototype, "sens", void 0);
class PointerEncoursDto {
}
exports.PointerEncoursDto = PointerEncoursDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], PointerEncoursDto.prototype, "encoursIds", void 0);
class RouvrirRapprochementDto {
}
exports.RouvrirRapprochementDto = RouvrirRapprochementDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RouvrirRapprochementDto.prototype, "motif", void 0);
//# sourceMappingURL=rapprochement.dto.js.map