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
exports.NotesIfrsDto = exports.EffetChangeIfrsDto = exports.TresorerieIfrsDto = exports.MouvementCpIfrsDto = exports.PremiereApplicationIfrsDto = exports.RegleConsolidationIfrsDto = exports.RetraitementIfrsDto = exports.LigneRetraitementIfrsDto = exports.RegleIfrsDto = exports.ActiviteIfrsDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class ActiviteIfrsDto {
}
exports.ActiviteIfrsDto = ActiviteIfrsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsEnum)(client_1.ActivitePrincipaleIfrs),
    __metadata("design:type", Object)
], ActiviteIfrsDto.prototype, "activitePrincipale", void 0);
class RegleIfrsDto {
}
exports.RegleIfrsDto = RegleIfrsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(13),
    __metadata("design:type", String)
], RegleIfrsDto.prototype, "prefixe", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], RegleIfrsDto.prototype, "rubrique", void 0);
class LigneRetraitementIfrsDto {
}
exports.LigneRetraitementIfrsDto = LigneRetraitementIfrsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], LigneRetraitementIfrsDto.prototype, "rubrique", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], LigneRetraitementIfrsDto.prototype, "montant", void 0);
class RetraitementIfrsDto {
}
exports.RetraitementIfrsDto = RetraitementIfrsDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RetraitementIfrsDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], RetraitementIfrsDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], RetraitementIfrsDto.prototype, "fondement", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneRetraitementIfrsDto),
    __metadata("design:type", Array)
], RetraitementIfrsDto.prototype, "lignes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RetraitementIfrsDto.prototype, "aLaTransition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RetraitementIfrsDto.prototype, "correctionErreur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RetraitementIfrsDto.prototype, "consolide", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Object)
], RetraitementIfrsDto.prototype, "partMinoritairesResultat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Object)
], RetraitementIfrsDto.prototype, "partMinoritairesOci", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Object)
], RetraitementIfrsDto.prototype, "partMinoritairesCapitauxPropres", void 0);
class RegleConsolidationIfrsDto {
}
exports.RegleConsolidationIfrsDto = RegleConsolidationIfrsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], RegleConsolidationIfrsDto.prototype, "poste", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], RegleConsolidationIfrsDto.prototype, "rubrique", void 0);
class PremiereApplicationIfrsDto {
}
exports.PremiereApplicationIfrsDto = PremiereApplicationIfrsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], PremiereApplicationIfrsDto.prototype, "premierExerciceIfrsId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PremiereApplicationIfrsDto.prototype, "dejaAdoptant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PremiereApplicationIfrsDto.prototype, "consolide", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], PremiereApplicationIfrsDto.prototype, "exemptionRegroupementsC1", void 0);
class MouvementCpIfrsDto {
}
exports.MouvementCpIfrsDto = MouvementCpIfrsDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MouvementCpIfrsDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TypeMouvementCpIfrs),
    __metadata("design:type", String)
], MouvementCpIfrsDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.ComposanteCpIfrs),
    __metadata("design:type", String)
], MouvementCpIfrsDto.prototype, "composante", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], MouvementCpIfrsDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], MouvementCpIfrsDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], MouvementCpIfrsDto.prototype, "justification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MouvementCpIfrsDto.prototype, "consolide", void 0);
class TresorerieIfrsDto {
}
exports.TresorerieIfrsDto = TresorerieIfrsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], TresorerieIfrsDto.prototype, "decouvertsDansTresorerie", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], TresorerieIfrsDto.prototype, "tresorerieEnDevises", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], TresorerieIfrsDto.prototype, "tresorerieGroupeEnDevises", void 0);
class EffetChangeIfrsDto {
}
exports.EffetChangeIfrsDto = EffetChangeIfrsDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EffetChangeIfrsDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], EffetChangeIfrsDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.CategorieEffetChangeIfrs),
    __metadata("design:type", String)
], EffetChangeIfrsDto.prototype, "categorie", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], EffetChangeIfrsDto.prototype, "justification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EffetChangeIfrsDto.prototype, "consolide", void 0);
class NotesIfrsDto {
}
exports.NotesIfrsDto = NotesIfrsDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], NotesIfrsDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], NotesIfrsDto.prototype, "contenu", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotesIfrsDto.prototype, "consolide", void 0);
//# sourceMappingURL=ifrs.dto.js.map