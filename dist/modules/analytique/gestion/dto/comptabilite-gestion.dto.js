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
exports.DeclarerCoutProductionDto = exports.RepartirDto = exports.ReprendreClesDto = exports.CreerCleRepartitionDto = exports.LigneCleDto = exports.DeclarerComportementsDto = exports.DeclarationComportementDto = exports.COMPORTEMENTS = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../../../common/facultatif-non-nul");
exports.COMPORTEMENTS = ['CHARGE_FIXE', 'CHARGE_VARIABLE', 'CHARGE_SEMI_VARIABLE', 'PRODUIT_ACTIVITE', 'HORS_CALCUL'];
class DeclarationComportementDto {
}
exports.DeclarationComportementDto = DeclarationComportementDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], DeclarationComportementDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.COMPORTEMENTS),
    __metadata("design:type", Object)
], DeclarationComportementDto.prototype, "comportement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Object)
], DeclarationComportementDto.prototype, "partVariablePct", void 0);
class DeclarerComportementsDto {
}
exports.DeclarerComportementsDto = DeclarerComportementsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DeclarationComportementDto),
    __metadata("design:type", Array)
], DeclarerComportementsDto.prototype, "declarations", void 0);
class LigneCleDto {
}
exports.LigneCleDto = LigneCleDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LigneCleDto.prototype, "sectionCibleId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    __metadata("design:type", Number)
], LigneCleDto.prototype, "valeur", void 0);
class CreerCleRepartitionDto {
}
exports.CreerCleRepartitionDto = CreerCleRepartitionDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerCleRepartitionDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerCleRepartitionDto.prototype, "planId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerCleRepartitionDto.prototype, "sectionSourceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreerCleRepartitionDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['POURCENTAGE', 'UNITES']),
    __metadata("design:type", String)
], CreerCleRepartitionDto.prototype, "mode", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("L'unité se nomme par une chaîne · omettez le champ en pourcentages."),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreerCleRepartitionDto.prototype, "unite", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], CreerCleRepartitionDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneCleDto),
    __metadata("design:type", Array)
], CreerCleRepartitionDto.prototype, "lignes", void 0);
class ReprendreClesDto {
}
exports.ReprendreClesDto = ReprendreClesDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReprendreClesDto.prototype, "exerciceId", void 0);
class RepartirDto {
}
exports.RepartirDto = RepartirDto;
__decorate([
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date est une date AAAA-MM-JJ.' }),
    __metadata("design:type", String)
], RepartirDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RepartirDto.prototype, "soldes", void 0);
class DeclarerCoutProductionDto {
}
exports.DeclarerCoutProductionDto = DeclarerCoutProductionDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], DeclarerCoutProductionDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], DeclarerCoutProductionDto.prototype, "sectionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], DeclarerCoutProductionDto.prototype, "unite", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    __metadata("design:type", Number)
], DeclarerCoutProductionDto.prototype, "capaciteNormale", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    __metadata("design:type", Number)
], DeclarerCoutProductionDto.prototype, "activiteReelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    __metadata("design:type", Object)
], DeclarerCoutProductionDto.prototype, "quantiteProduite", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], DeclarerCoutProductionDto.prototype, "source", void 0);
//# sourceMappingURL=comptabilite-gestion.dto.js.map