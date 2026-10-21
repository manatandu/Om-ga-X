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
exports.AnnulerRecuperationTvaDto = exports.RecupererTvaCreanceDto = exports.DuplicataFactureDto = exports.DeclarerCreanceOuvertureDto = exports.Lettrer416Dto = exports.CorrigerParResultatDto = exports.AnnulerReclassementDto = exports.RetirerDesignationDto = exports.AnnulerMouvementDto = exports.AnnulerRevueDto = exports.RecouvrementCreanceDto = exports.PerteCreanceDto = exports.RevoirDepreciationDto = exports.ReclasserCreanceDto = exports.DesignerFacturesDto = exports.FactureDesigneeDto = exports.PieceJustificativeDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class PieceJustificativeDto {
}
exports.PieceJustificativeDto = PieceJustificativeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], PieceJustificativeDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], PieceJustificativeDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PieceJustificativeDto.prototype, "date", void 0);
class MotifEtPiecesDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], MotifEtPiecesDto.prototype, "motif", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PieceJustificativeDto),
    __metadata("design:type", Array)
], MotifEtPiecesDto.prototype, "pieces", void 0);
class FactureDesigneeDto {
}
exports.FactureDesigneeDto = FactureDesigneeDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], FactureDesigneeDto.prototype, "ligneEcritureId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], FactureDesigneeDto.prototype, "montant", void 0);
class DesignerFacturesDto {
}
exports.DesignerFacturesDto = DesignerFacturesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FactureDesigneeDto),
    __metadata("design:type", Array)
], DesignerFacturesDto.prototype, "factures", void 0);
class ReclasserCreanceDto extends MotifEtPiecesDto {
}
exports.ReclasserCreanceDto = ReclasserCreanceDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FactureDesigneeDto),
    __metadata("design:type", Array)
], ReclasserCreanceDto.prototype, "factures", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReclasserCreanceDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReclasserCreanceDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReclasserCreanceDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReclasserCreanceDto.prototype, "compteCreanceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReclasserCreanceDto.prototype, "compte416Id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReclasserCreanceDto.prototype, "compte491Id", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureCreanceDouteuse),
    __metadata("design:type", String)
], ReclasserCreanceDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], ReclasserCreanceDto.prototype, "montant", void 0);
class RevoirDepreciationDto extends MotifEtPiecesDto {
}
exports.RevoirDepreciationDto = RevoirDepreciationDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RevoirDepreciationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RevoirDepreciationDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], RevoirDepreciationDto.prototype, "depreciationNecessaire", void 0);
class PerteCreanceDto extends MotifEtPiecesDto {
}
exports.PerteCreanceDto = PerteCreanceDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PerteCreanceDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PerteCreanceDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PerteCreanceDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], PerteCreanceDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PerteCreanceDto.prototype, "comptePerteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DuplicataFactureDto),
    __metadata("design:type", Array)
], PerteCreanceDto.prototype, "duplicatas", void 0);
class RecouvrementCreanceDto extends MotifEtPiecesDto {
}
exports.RecouvrementCreanceDto = RecouvrementCreanceDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RecouvrementCreanceDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RecouvrementCreanceDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RecouvrementCreanceDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], RecouvrementCreanceDto.prototype, "montant", void 0);
class AnnulerRevueDto {
}
exports.AnnulerRevueDto = AnnulerRevueDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AnnulerRevueDto.prototype, "motif", void 0);
class AnnulerMouvementDto extends AnnulerRevueDto {
}
exports.AnnulerMouvementDto = AnnulerMouvementDto;
class RetirerDesignationDto extends AnnulerRevueDto {
}
exports.RetirerDesignationDto = RetirerDesignationDto;
class AnnulerReclassementDto extends AnnulerRevueDto {
}
exports.AnnulerReclassementDto = AnnulerReclassementDto;
class CorrigerParResultatDto extends AnnulerRevueDto {
}
exports.CorrigerParResultatDto = CorrigerParResultatDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CorrigerParResultatDto.prototype, "ecritureId", void 0);
class Lettrer416Dto {
}
exports.Lettrer416Dto = Lettrer416Dto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], Lettrer416Dto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], Lettrer416Dto.prototype, "ligneIds", void 0);
class DeclarerCreanceOuvertureDto {
}
exports.DeclarerCreanceOuvertureDto = DeclarerCreanceOuvertureDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DeclarerCreanceOuvertureDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DeclarerCreanceOuvertureDto.prototype, "compteCreanceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DeclarerCreanceOuvertureDto.prototype, "compte416Id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DeclarerCreanceOuvertureDto.prototype, "compte491Id", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureCreanceDouteuse),
    __metadata("design:type", String)
], DeclarerCreanceOuvertureDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], DeclarerCreanceOuvertureDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], DeclarerCreanceOuvertureDto.prototype, "depreciationOuverture", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], DeclarerCreanceOuvertureDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], DeclarerCreanceOuvertureDto.prototype, "motif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PieceJustificativeDto),
    __metadata("design:type", Array)
], DeclarerCreanceOuvertureDto.prototype, "pieces", void 0);
class DuplicataFactureDto {
}
exports.DuplicataFactureDto = DuplicataFactureDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DuplicataFactureDto.prototype, "designationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], DuplicataFactureDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DuplicataFactureDto.prototype, "dateEnvoi", void 0);
class RecupererTvaCreanceDto extends MotifEtPiecesDto {
}
exports.RecupererTvaCreanceDto = RecupererTvaCreanceDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RecupererTvaCreanceDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RecupererTvaCreanceDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RecupererTvaCreanceDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DuplicataFactureDto),
    __metadata("design:type", Array)
], RecupererTvaCreanceDto.prototype, "duplicatas", void 0);
class AnnulerRecuperationTvaDto extends AnnulerRevueDto {
}
exports.AnnulerRecuperationTvaDto = AnnulerRecuperationTvaDto;
//# sourceMappingURL=creances-douteuses.dto.js.map