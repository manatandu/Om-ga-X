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
exports.AnnulationPaiementSalairesDto = exports.PaiementSalairesDto = exports.ReferencePaiementDto = exports.ModePaiementSalarieDto = void 0;
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const paiement_salaires_1 = require("../paiement-salaires");
class ModePaiementSalarieDto {
}
exports.ModePaiementSalarieDto = ModePaiementSalarieDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ModePaiementSalaire),
    __metadata("design:type", Object)
], ModePaiementSalarieDto.prototype, "modePaiement", void 0);
class ReferencePaiementDto {
}
exports.ReferencePaiementDto = ReferencePaiementDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReferencePaiementDto.prototype, "bulletinId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ReferencePaiementDto.prototype, "reference", void 0);
class PaiementSalairesDto {
}
exports.PaiementSalairesDto = PaiementSalairesDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.ModePaiementSalaire),
    __metadata("design:type", String)
], PaiementSalairesDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PaiementSalairesDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PaiementSalairesDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PaiementSalairesDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(paiement_salaires_1.PLAFOND_LIGNES_PAIEMENT),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], PaiementSalairesDto.prototype, "bulletinIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(paiement_salaires_1.PLAFOND_LIGNES_PAIEMENT),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ReferencePaiementDto),
    __metadata("design:type", Array)
], PaiementSalairesDto.prototype, "references", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(paiement_salaires_1.PLAFOND_COUPURES),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }, { each: true }),
    __metadata("design:type", Array)
], PaiementSalairesDto.prototype, "coupures", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(190),
    __metadata("design:type", String)
], PaiementSalairesDto.prototype, "libelle", void 0);
class AnnulationPaiementSalairesDto {
}
exports.AnnulationPaiementSalairesDto = AnnulationPaiementSalairesDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AnnulationPaiementSalairesDto.prototype, "motif", void 0);
//# sourceMappingURL=paiement-salaires.dto.js.map