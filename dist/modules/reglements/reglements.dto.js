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
exports.PasserEcartChangeDto = exports.EnregistrerReglementsDto = exports.ReglementTiersDto = exports.PartFactureReglementDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../common/facultatif-non-nul");
class PartFactureReglementDto {
}
exports.PartFactureReglementDto = PartFactureReglementDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PartFactureReglementDto.prototype, "ligneId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], PartFactureReglementDto.prototype, "montant", void 0);
class ReglementTiersDto {
}
exports.ReglementTiersDto = ReglementTiersDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReglementTiersDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], ReglementTiersDto.prototype, "ligneIds", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez le montant pour régler le dû entier · un montant payé est un nombre strictement positif.'),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ReglementTiersDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ReglementTiersDto.prototype, "reference", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez le montant en devise pour régler le dû entier.'),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ReglementTiersDto.prototype, "montantDevise", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Le cours du règlement est un nombre positif · omettez-le pour des factures en francs.'),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 6 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ReglementTiersDto.prototype, "coursReglement", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("Omettez le compte d'écart de change quand le texte le donne."),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReglementTiersDto.prototype, "compteEcartChangeId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez l’imputation pour un règlement sans parts désignées.'),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PartFactureReglementDto),
    __metadata("design:type", Array)
], ReglementTiersDto.prototype, "imputation", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez la pièce de l’imputation quand l’ordre de virement la porte.'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ReglementTiersDto.prototype, "pieceImputation", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez l’escompte pour un règlement sans escompte.'),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ReglementTiersDto.prototype, "escompte", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez « solder l’écart » ou passez false.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReglementTiersDto.prototype, "solderEcart", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez le compte de l’escompte quand un seul compte le porte.'),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReglementTiersDto.prototype, "compteEscompteId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez le compte de l’écart quand un seul compte le porte.'),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReglementTiersDto.prototype, "compteEcartId", void 0);
class EnregistrerReglementsDto {
}
exports.EnregistrerReglementsDto = EnregistrerReglementsDto;
__decorate([
    (0, class_validator_1.IsIn)(['FOURNISSEUR', 'CLIENT']),
    __metadata("design:type", String)
], EnregistrerReglementsDto.prototype, "sens", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EnregistrerReglementsDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EnregistrerReglementsDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EnregistrerReglementsDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ReglementTiersDto),
    __metadata("design:type", Array)
], EnregistrerReglementsDto.prototype, "reglements", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EnregistrerReglementsDto.prototype, "ordreVirement", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez « trésorerie en devise » ou passez false.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EnregistrerReglementsDto.prototype, "tresorerieEnDevise", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez la devise du moyen de paiement pour un règlement en francs.'),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EnregistrerReglementsDto.prototype, "deviseTresorerieId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez le mode de règlement pour n’en déclarer aucun.'),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EnregistrerReglementsDto.prototype, "modeReglementId", void 0);
class PasserEcartChangeDto {
}
exports.PasserEcartChangeDto = PasserEcartChangeDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PasserEcartChangeDto.prototype, "lettrageId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PasserEcartChangeDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PasserEcartChangeDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PasserEcartChangeDto.prototype, "date", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("Omettez le compte d'écart de change quand le texte le donne."),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PasserEcartChangeDto.prototype, "compteEcartChangeId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Omettez le report au premier jour ouvert, ou cochez-le.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PasserEcartChangeDto.prototype, "reporterAuPremierJourOuvert", void 0);
//# sourceMappingURL=reglements.dto.js.map