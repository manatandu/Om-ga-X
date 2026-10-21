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
exports.MonnaieEntiteDto = exports.ProvisionChangeDto = exports.FiscaliteEntiteDto = exports.EcartEvaluationDto = exports.OperationReciproqueDto = exports.ResultatInterneDto = exports.AcquisitionDto = exports.ImporterBalanceEntiteDto = exports.FaitsConsolidationDto = exports.ModifierLienParticipationDto = exports.LienParticipationDto = exports.ModifierEntitePerimetreDto = exports.EntitePerimetreDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class EntitePerimetreDto {
}
exports.EntitePerimetreDto = EntitePerimetreDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EntitePerimetreDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], EntitePerimetreDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EntitePerimetreDto.prototype, "designationMajoriteDeuxExercices", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EntitePerimetreDto.prototype, "aucunAutreAssocieSuperieur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EntitePerimetreDto.prototype, "controleContractuel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EntitePerimetreDto.prototype, "accordControleConjoint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EntitePerimetreDto.prototype, "influenceNotableDeclaree", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsEnum)(client_1.MotifExclusionConsolidation),
    __metadata("design:type", Object)
], EntitePerimetreDto.prototype, "motifExclusion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", Object)
], EntitePerimetreDto.prototype, "justificationExclusion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], EntitePerimetreDto.prototype, "dateCloture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], EntitePerimetreDto.prototype, "secteurActivite", void 0);
class ModifierEntitePerimetreDto {
}
exports.ModifierEntitePerimetreDto = ModifierEntitePerimetreDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ModifierEntitePerimetreDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierEntitePerimetreDto.prototype, "designationMajoriteDeuxExercices", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierEntitePerimetreDto.prototype, "aucunAutreAssocieSuperieur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierEntitePerimetreDto.prototype, "controleContractuel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierEntitePerimetreDto.prototype, "accordControleConjoint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierEntitePerimetreDto.prototype, "influenceNotableDeclaree", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsEnum)(client_1.MotifExclusionConsolidation),
    __metadata("design:type", Object)
], ModifierEntitePerimetreDto.prototype, "motifExclusion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", Object)
], ModifierEntitePerimetreDto.prototype, "justificationExclusion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ModifierEntitePerimetreDto.prototype, "dateCloture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], ModifierEntitePerimetreDto.prototype, "secteurActivite", void 0);
class LienParticipationDto {
}
exports.LienParticipationDto = LienParticipationDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LienParticipationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], LienParticipationDto.prototype, "detentriceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LienParticipationDto.prototype, "detenueId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], LienParticipationDto.prototype, "pctDroitsVote", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], LienParticipationDto.prototype, "pctCapital", void 0);
class ModifierLienParticipationDto {
}
exports.ModifierLienParticipationDto = ModifierLienParticipationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ModifierLienParticipationDto.prototype, "pctDroitsVote", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ModifierLienParticipationDto.prototype, "pctCapital", void 0);
class FaitsConsolidationDto {
}
exports.FaitsConsolidationDto = FaitsConsolidationDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], FaitsConsolidationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FaitsConsolidationDto.prototype, "sousControleEntiteOhadaConsolidante", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FaitsConsolidationDto.prototype, "siegesDansDeuxRegions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FaitsConsolidationDto.prototype, "appelPublicEpargne", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FaitsConsolidationDto.prototype, "demandeAssociesDixieme", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], FaitsConsolidationDto.prototype, "entitesControleHorsOhada", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], FaitsConsolidationDto.prototype, "chiffreAffairesN", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], FaitsConsolidationDto.prototype, "chiffreAffairesN1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], FaitsConsolidationDto.prototype, "seuilEquivalentFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], FaitsConsolidationDto.prototype, "sourceSeuil", void 0);
class ImporterBalanceEntiteDto {
}
exports.ImporterBalanceEntiteDto = ImporterBalanceEntiteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ImporterBalanceEntiteDto.prototype, "nomFichier", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImporterBalanceEntiteDto.prototype, "contenuBase64", void 0);
class AcquisitionDto {
}
exports.AcquisitionDto = AcquisitionDto;
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AcquisitionDto.prototype, "coutAcquisition", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(13),
    __metadata("design:type", String)
], AcquisitionDto.prototype, "compteTitres", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AcquisitionDto.prototype, "dateEntree", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], AcquisitionDto.prototype, "capitauxPropresEntree", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['LIMITEE', 'NON_DETERMINABLE']),
    __metadata("design:type", String)
], AcquisitionDto.prototype, "modeDureeEcart", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(99),
    __metadata("design:type", Object)
], AcquisitionDto.prototype, "dureeEcartAnnees", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AcquisitionDto.prototype, "depreciationEcartOuverture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AcquisitionDto.prototype, "depreciationEcartCloture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], AcquisitionDto.prototype, "dividendesExercice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(13),
    __metadata("design:type", Object)
], AcquisitionDto.prototype, "compteDividendes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AcquisitionDto.prototype, "obligationNonDesengagement", void 0);
class ResultatInterneDto {
}
exports.ResultatInterneDto = ResultatInterneDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ResultatInterneDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ResultatInterneDto.prototype, "vendeuseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ResultatInterneDto.prototype, "acheteuseId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureResultatInterne),
    __metadata("design:type", String)
], ResultatInterneDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(13),
    __metadata("design:type", String)
], ResultatInterneDto.prototype, "compteActif", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], ResultatInterneDto.prototype, "margeOuverture", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], ResultatInterneDto.prototype, "margeCloture", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ResultatInterneDto.prototype, "libelle", void 0);
class OperationReciproqueDto {
}
exports.OperationReciproqueDto = OperationReciproqueDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], OperationReciproqueDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], OperationReciproqueDto.prototype, "entiteAId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(13),
    __metadata("design:type", String)
], OperationReciproqueDto.prototype, "compteA", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], OperationReciproqueDto.prototype, "entiteBId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(13),
    __metadata("design:type", String)
], OperationReciproqueDto.prototype, "compteB", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], OperationReciproqueDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], OperationReciproqueDto.prototype, "libelle", void 0);
class EcartEvaluationDto {
}
exports.EcartEvaluationDto = EcartEvaluationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(13),
    __metadata("design:type", String)
], EcartEvaluationDto.prototype, "compte", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(13),
    __metadata("design:type", Object)
], EcartEvaluationDto.prototype, "compteAmortissement", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], EcartEvaluationDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], EcartEvaluationDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.ModeEcartEvaluation),
    __metadata("design:type", String)
], EcartEvaluationDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(99),
    __metadata("design:type", Object)
], EcartEvaluationDto.prototype, "dureeAnnees", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], EcartEvaluationDto.prototype, "dateRealisation", void 0);
class FiscaliteEntiteDto {
}
exports.FiscaliteEntiteDto = FiscaliteEntiteDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], FiscaliteEntiteDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], FiscaliteEntiteDto.prototype, "entiteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Object)
], FiscaliteEntiteDto.prototype, "tauxImpotDiffere", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], FiscaliteEntiteDto.prototype, "sourceTauxImpot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], FiscaliteEntiteDto.prototype, "idaOuverture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], FiscaliteEntiteDto.prototype, "idaCloture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], FiscaliteEntiteDto.prototype, "idpOuverture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], FiscaliteEntiteDto.prototype, "idpCloture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", Object)
], FiscaliteEntiteDto.prototype, "justificationIda", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], FiscaliteEntiteDto.prototype, "ecartConversionActifN1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], FiscaliteEntiteDto.prototype, "ecartConversionPassifN1", void 0);
class ProvisionChangeDto {
}
exports.ProvisionChangeDto = ProvisionChangeDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ProvisionChangeDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], ProvisionChangeDto.prototype, "entiteId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(13),
    __metadata("design:type", String)
], ProvisionChangeDto.prototype, "compteProvision", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ProvisionChangeDto.prototype, "cloture", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ProvisionChangeDto.prototype, "dotation", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ProvisionChangeDto.prototype, "reprise", void 0);
class MonnaieEntiteDto {
}
exports.MonnaieEntiteDto = MonnaieEntiteDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.Matches)(/^[A-Za-z]{3}$/, { message: 'La monnaie se donne par son code ISO à trois lettres (USD, EUR, XAF...).' }),
    __metadata("design:type", Object)
], MonnaieEntiteDto.prototype, "monnaieBalance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", Object)
], MonnaieEntiteDto.prototype, "justificationMonnaie", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MonnaieEntiteDto.prototype, "hyperinflation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], MonnaieEntiteDto.prototype, "coursCloture", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], MonnaieEntiteDto.prototype, "coursProduitsCharges", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], MonnaieEntiteDto.prototype, "coursEntree", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Object)
], MonnaieEntiteDto.prototype, "capitauxPropresHistoriques", void 0);
//# sourceMappingURL=perimetre.dto.js.map