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
exports.RepriseDemantelementDto = exports.DesactualisationDemantelementDto = exports.ReserveProprieteDto = exports.SolderDetteAleatoireDto = exports.AcquerirAPrixAleatoireDto = exports.RepriseProvisionReevaluationDto = exports.ReevaluerImmobilisationsDto = exports.LigneReevaluationDto = exports.CategorieReevaluationDto = exports.ReviserPlanDto = exports.IncorporerCoutsEmpruntDto = exports.DureeLimiteeDto = exports.RemplacerPartieDto = exports.AcquerirAPrixGlobalDto = exports.StockDuFondsDto = exports.BienDuPrixGlobalDto = exports.RecevoirLegsDto = exports.BienDuLegsDto = exports.MethodeDepreciationSubventionDto = exports.ReduireSubventionDto = exports.RattacherSubventionDto = exports.OctroiSubventionDto = exports.LigneSubventionDto = exports.EchangerImmobilisationDto = exports.RepriseSubventionDto = exports.DeclarerOptionLocationAcquisitionDto = exports.DeclarerGarantieLocationAcquisitionDto = exports.ClotureLocationAcquisitionDto = exports.CreerLocationAcquisitionDto = exports.SimulerLocationAcquisitionDto = exports.AffecterLieuDto = exports.TransfertDepreciationDto = exports.MiseEnServiceDto = exports.LieuBienDto = exports.PasserDerogatoireDto = exports.OptionDegressifDto = exports.ReclasserImmobilisationDto = exports.SortirImmobilisationDto = exports.TypeSortie = exports.RenouvelerComposantDto = exports.DepreciationDto = exports.RattachementComposantDto = exports.PasserDotationDto = exports.SaisirConsommationDto = exports.CreerImmobilisationDto = exports.CriteresFraisDeveloppementDto = exports.ModifierFamilleDto = exports.CreerFamilleDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
const client_1 = require("@prisma/client");
class CreerFamilleDto {
}
exports.CreerFamilleDto = CreerFamilleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerFamilleDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerFamilleDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerFamilleDto.prototype, "compteImmobilisationId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerFamilleDto.prototype, "compteAmortissementId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerFamilleDto.prototype, "compteDotationId", void 0);
__decorate([
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreerFamilleDto.prototype, "dureeAmortissementAns", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ModeAmortissement),
    __metadata("design:type", String)
], CreerFamilleDto.prototype, "modeAmortissement", void 0);
class ModifierFamilleDto {
}
exports.ModifierFamilleDto = ModifierFamilleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierFamilleDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ModifierFamilleDto.prototype, "dureeAmortissementAns", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], ModifierFamilleDto.prototype, "estActif", void 0);
class CriteresFraisDeveloppementDto {
}
exports.CriteresFraisDeveloppementDto = CriteresFraisDeveloppementDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CriteresFraisDeveloppementDto.prototype, "FAISABILITE_TECHNIQUE", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CriteresFraisDeveloppementDto.prototype, "INTENTION", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CriteresFraisDeveloppementDto.prototype, "CAPACITE", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CriteresFraisDeveloppementDto.prototype, "AVANTAGES_ECONOMIQUES", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CriteresFraisDeveloppementDto.prototype, "RESSOURCES", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CriteresFraisDeveloppementDto.prototype, "EVALUATION_FIABLE", void 0);
class CreerImmobilisationDto {
}
exports.CreerImmobilisationDto = CreerImmobilisationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "familleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "compteImmobilisationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "numeroInventaire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "lieuId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "dateAcquisition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], CreerImmobilisationDto.prototype, "dateMiseEnService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "compteEnCoursId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", Object)
], CreerImmobilisationDto.prototype, "natureFiscaleCle", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreerImmobilisationDto.prototype, "valeurOrigine", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerImmobilisationDto.prototype, "valeurResiduelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreerImmobilisationDto.prototype, "dureeAmortissementAns", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ModeAmortissement),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "modeAmortissement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreerImmobilisationDto.prototype, "unitesOeuvrePrevues", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "uniteOeuvreLibelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerImmobilisationDto.prototype, "amortissementAnterieur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerImmobilisationDto.prototype, "repris", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "compteContrepartieId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "immobilisationPrincipaleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TypeComposant),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "typeComposant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "justificationDecomposition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerImmobilisationDto.prototype, "dernierRenouvellement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerImmobilisationDto.prototype, "dureeNonLimitee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "justificationDureeNonLimitee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerImmobilisationDto.prototype, "nomDeDomaine", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['NON_ESTIMABLE', 'SIMPLIFICATION_SMT']),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "fondementDureeDixAns", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La réserve de propriété vaut vrai ou faux · omettez le champ pour la laisser déduire.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreerImmobilisationDto.prototype, "reserveDePropriete", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CriteresFraisDeveloppementDto),
    __metadata("design:type", CriteresFraisDeveloppementDto)
], CreerImmobilisationDto.prototype, "criteresFraisDeveloppement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerImmobilisationDto.prototype, "dateReunionCriteresDeveloppement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreerImmobilisationDto.prototype, "coutFuturDemantelement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreerImmobilisationDto.prototype, "tauxActualisationDemantelementPourcent", void 0);
class SaisirConsommationDto {
}
exports.SaisirConsommationDto = SaisirConsommationDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], SaisirConsommationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SaisirConsommationDto.prototype, "unitesConsommees", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SaisirConsommationDto.prototype, "source", void 0);
class PasserDotationDto {
}
exports.PasserDotationDto = PasserDotationDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PasserDotationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PasserDotationDto.prototype, "journalId", void 0);
class RattachementComposantDto {
}
exports.RattachementComposantDto = RattachementComposantDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RattachementComposantDto.prototype, "immobilisationPrincipaleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TypeComposant),
    __metadata("design:type", String)
], RattachementComposantDto.prototype, "typeComposant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RattachementComposantDto.prototype, "justificationDecomposition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RattachementComposantDto.prototype, "dernierRenouvellement", void 0);
class DepreciationDto {
}
exports.DepreciationDto = DepreciationDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DepreciationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DepreciationDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.SensDepreciation),
    __metadata("design:type", String)
], DepreciationDto.prototype, "sens", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], DepreciationDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DepreciationDto.prototype, "compteDepreciationId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DepreciationDto.prototype, "compteContrepartieId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], DepreciationDto.prototype, "indice", void 0);
class RenouvelerComposantDto {
}
exports.RenouvelerComposantDto = RenouvelerComposantDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RenouvelerComposantDto.prototype, "dateRenouvellement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RenouvelerComposantDto.prototype, "compteReserveEcartId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RenouvelerComposantDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RenouvelerComposantDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RenouvelerComposantDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], RenouvelerComposantDto.prototype, "coutRenouvellement", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RenouvelerComposantDto.prototype, "compteContrepartieId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], RenouvelerComposantDto.prototype, "dureeAmortissementAns", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RenouvelerComposantDto.prototype, "valeurResiduelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RenouvelerComposantDto.prototype, "dernierRenouvellement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RenouvelerComposantDto.prototype, "cessionCourante", void 0);
var TypeSortie;
(function (TypeSortie) {
    TypeSortie["CESSION"] = "CESSION";
    TypeSortie["MISE_HORS_SERVICE"] = "MISE_HORS_SERVICE";
})(TypeSortie || (exports.TypeSortie = TypeSortie = {}));
class SortirImmobilisationDto {
}
exports.SortirImmobilisationDto = SortirImmobilisationDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "dateSortie", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TypeSortie),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SortirImmobilisationDto.prototype, "prixCession", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "compteContrepartieId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SortirImmobilisationDto.prototype, "cessionCourante", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "compteFondsProjetId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SortirImmobilisationDto.prototype, "valeurMaterielRecupere", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "compteStockRecupereId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "sourceMaterielRecupere", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureSortieImmobilisation),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "natureSortie", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "referencePieceSortie", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "datePieceSortie", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], SortirImmobilisationDto.prototype, "compteReserveEcartId", void 0);
class ReclasserImmobilisationDto {
}
exports.ReclasserImmobilisationDto = ReclasserImmobilisationDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReclasserImmobilisationDto.prototype, "nouvelleFamilleId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReclasserImmobilisationDto.prototype, "dateReclassement", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReclasserImmobilisationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReclasserImmobilisationDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], ReclasserImmobilisationDto.prototype, "motif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReclasserImmobilisationDto.prototype, "nouveauCompteDepreciationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CriteresFraisDeveloppementDto),
    __metadata("design:type", CriteresFraisDeveloppementDto)
], ReclasserImmobilisationDto.prototype, "criteresFraisDeveloppement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReclasserImmobilisationDto.prototype, "dateReunionCriteresDeveloppement", void 0);
class OptionDegressifDto {
}
exports.OptionDegressifDto = OptionDegressifDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OptionDegressifDto.prototype, "categorie", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], OptionDegressifDto.prototype, "bienNeuf", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(99),
    __metadata("design:type", Number)
], OptionDegressifDto.prototype, "dureeFiscaleAns", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], OptionDegressifDto.prototype, "exceptionnel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], OptionDegressifDto.prototype, "activiteIndustrielle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], OptionDegressifDto.prototype, "chiffreAffairesExportHt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], OptionDegressifDto.prototype, "chiffreAffairesTotalHt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], OptionDegressifDto.prototype, "sourceChiffreAffaires", void 0);
class PasserDerogatoireDto {
}
exports.PasserDerogatoireDto = PasserDerogatoireDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PasserDerogatoireDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PasserDerogatoireDto.prototype, "journalId", void 0);
class LieuBienDto {
}
exports.LieuBienDto = LieuBienDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/, { message: 'Le code du lieu est obligatoire.' }),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], LieuBienDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/, { message: 'L’intitulé du lieu est obligatoire.' }),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], LieuBienDto.prototype, "intitule", void 0);
class MiseEnServiceDto {
}
exports.MiseEnServiceDto = MiseEnServiceDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MiseEnServiceDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], MiseEnServiceDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], MiseEnServiceDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], MiseEnServiceDto.prototype, "compteDepreciationCibleId", void 0);
class TransfertDepreciationDto {
}
exports.TransfertDepreciationDto = TransfertDepreciationDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], TransfertDepreciationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], TransfertDepreciationDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], TransfertDepreciationDto.prototype, "compteDepreciationCibleId", void 0);
class AffecterLieuDto {
}
exports.AffecterLieuDto = AffecterLieuDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", Object)
], AffecterLieuDto.prototype, "lieuId", void 0);
class SimulerLocationAcquisitionDto {
}
exports.SimulerLocationAcquisitionDto = SimulerLocationAcquisitionDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], SimulerLocationAcquisitionDto.prototype, "compteImmobilisationId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureLocationAcquisition),
    __metadata("design:type", String)
], SimulerLocationAcquisitionDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SimulerLocationAcquisitionDto.prototype, "datePriseEffet", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(600),
    __metadata("design:type", Number)
], SimulerLocationAcquisitionDto.prototype, "dureeMois", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.PeriodiciteLoyer),
    __metadata("design:type", String)
], SimulerLocationAcquisitionDto.prototype, "periodicite", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SimulerLocationAcquisitionDto.prototype, "termeAEchoir", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SimulerLocationAcquisitionDto.prototype, "loyer", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SimulerLocationAcquisitionDto.prototype, "prixOption", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], SimulerLocationAcquisitionDto.prototype, "tauxAnnuel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Object)
], SimulerLocationAcquisitionDto.prototype, "valeurContrat", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SimulerLocationAcquisitionDto.prototype, "optionRaisonnablementCertaine", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SimulerLocationAcquisitionDto.prototype, "bienDeFaibleValeur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SimulerLocationAcquisitionDto.prototype, "garantieValeurResiduelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SimulerLocationAcquisitionDto.prototype, "loyerIndexe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SimulerLocationAcquisitionDto.prototype, "indiceLoyer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SimulerLocationAcquisitionDto.prototype, "valeurIndiceCommencement", void 0);
class CreerLocationAcquisitionDto extends SimulerLocationAcquisitionDto {
}
exports.CreerLocationAcquisitionDto = CreerLocationAcquisitionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerLocationAcquisitionDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerLocationAcquisitionDto.prototype, "numeroInventaire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerLocationAcquisitionDto.prototype, "lieuId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", Object)
], CreerLocationAcquisitionDto.prototype, "natureFiscaleCle", void 0);
__decorate([
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreerLocationAcquisitionDto.prototype, "dureeAmortissementAns", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreerLocationAcquisitionDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerLocationAcquisitionDto.prototype, "bailleurTiersId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerLocationAcquisitionDto.prototype, "dateConclusion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerLocationAcquisitionDto.prototype, "coutsDirects", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreerLocationAcquisitionDto.prototype, "avantagesRecus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerLocationAcquisitionDto.prototype, "compteContrepartieCoutsId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerLocationAcquisitionDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreerLocationAcquisitionDto.prototype, "journalId", void 0);
class ClotureLocationAcquisitionDto {
}
exports.ClotureLocationAcquisitionDto = ClotureLocationAcquisitionDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ClotureLocationAcquisitionDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ClotureLocationAcquisitionDto.prototype, "journalId", void 0);
class DeclarerGarantieLocationAcquisitionDto {
}
exports.DeclarerGarantieLocationAcquisitionDto = DeclarerGarantieLocationAcquisitionDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DeclarerGarantieLocationAcquisitionDto.prototype, "appelee", void 0);
class DeclarerOptionLocationAcquisitionDto {
}
exports.DeclarerOptionLocationAcquisitionDto = DeclarerOptionLocationAcquisitionDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DeclarerOptionLocationAcquisitionDto.prototype, "levee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DeclarerOptionLocationAcquisitionDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DeclarerOptionLocationAcquisitionDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DeclarerOptionLocationAcquisitionDto.prototype, "cessionCourante", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DeclarerOptionLocationAcquisitionDto.prototype, "compteReserveEcartId", void 0);
class RepriseSubventionDto {
}
exports.RepriseSubventionDto = RepriseSubventionDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RepriseSubventionDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RepriseSubventionDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], RepriseSubventionDto.prototype, "dureeInalienabiliteAns", void 0);
class EchangerImmobilisationDto {
}
exports.EchangerImmobilisationDto = EchangerImmobilisationDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EchangerImmobilisationDto.prototype, "dateEchange", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EchangerImmobilisationDto.prototype, "compteReserveEcartId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EchangerImmobilisationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EchangerImmobilisationDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], EchangerImmobilisationDto.prototype, "prixDeReprise", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], EchangerImmobilisationDto.prototype, "soulte", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EchangerImmobilisationDto.prototype, "compteCreanceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EchangerImmobilisationDto.prototype, "compteFournisseurId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EchangerImmobilisationDto.prototype, "cessionCourante", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EchangerImmobilisationDto.prototype, "compteImmobilisationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], EchangerImmobilisationDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EchangerImmobilisationDto.prototype, "numeroInventaire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EchangerImmobilisationDto.prototype, "lieuId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", Object)
], EchangerImmobilisationDto.prototype, "natureFiscaleCle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], EchangerImmobilisationDto.prototype, "dureeAmortissementAns", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], EchangerImmobilisationDto.prototype, "dateMiseEnService", void 0);
class LigneSubventionDto {
}
exports.LigneSubventionDto = LigneSubventionDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], LigneSubventionDto.prototype, "immobilisationId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], LigneSubventionDto.prototype, "montant", void 0);
class OctroiSubventionDto {
}
exports.OctroiSubventionDto = OctroiSubventionDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], OctroiSubventionDto.prototype, "compteSubventionId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], OctroiSubventionDto.prototype, "compteContrepartieId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], OctroiSubventionDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], OctroiSubventionDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], OctroiSubventionDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], OctroiSubventionDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(190),
    (0, class_validator_1.Matches)(/\S/, { message: "La référence de l'acte d'octroi est obligatoire." }),
    __metadata("design:type", String)
], OctroiSubventionDto.prototype, "reference", void 0);
class RattacherSubventionDto {
}
exports.RattacherSubventionDto = RattacherSubventionDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RattacherSubventionDto.prototype, "compteSubventionId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RattacherSubventionDto.prototype, "dateOctroi", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(190),
    (0, class_validator_1.Matches)(/\S/, { message: "La référence de l'acte d'octroi est obligatoire." }),
    __metadata("design:type", String)
], RattacherSubventionDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], RattacherSubventionDto.prototype, "dureeInalienabiliteAns", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RattacherSubventionDto.prototype, "motifSansVentilation", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneSubventionDto),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(50),
    __metadata("design:type", Array)
], RattacherSubventionDto.prototype, "lignes", void 0);
class ReduireSubventionDto {
}
exports.ReduireSubventionDto = ReduireSubventionDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureReductionSubvention),
    __metadata("design:type", String)
], ReduireSubventionDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReduireSubventionDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReduireSubventionDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReduireSubventionDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ReduireSubventionDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReduireSubventionDto.prototype, "compteContrepartieId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    (0, class_validator_1.Matches)(/\S/, { message: 'Le motif est obligatoire.' }),
    __metadata("design:type", String)
], ReduireSubventionDto.prototype, "motif", void 0);
class MethodeDepreciationSubventionDto {
}
exports.MethodeDepreciationSubventionDto = MethodeDepreciationSubventionDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MethodeDepreciationBienSubventionne),
    __metadata("design:type", String)
], MethodeDepreciationSubventionDto.prototype, "methode", void 0);
class BienDuLegsDto {
}
exports.BienDuLegsDto = BienDuLegsDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], BienDuLegsDto.prototype, "compteImmobilisationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(190),
    (0, class_validator_1.Matches)(/\S/, { message: 'La désignation du bien est obligatoire.' }),
    __metadata("design:type", String)
], BienDuLegsDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], BienDuLegsDto.prototype, "valeurOrigine", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], BienDuLegsDto.prototype, "dureeAmortissementAns", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], BienDuLegsDto.prototype, "dateMiseEnService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], BienDuLegsDto.prototype, "natureFiscaleCle", void 0);
class RecevoirLegsDto {
}
exports.RecevoirLegsDto = RecevoirLegsDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RecevoirLegsDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RecevoirLegsDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RecevoirLegsDto.prototype, "dateActe", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    (0, class_validator_1.Matches)(/\S/, { message: "La référence de l'acte est obligatoire." }),
    __metadata("design:type", String)
], RecevoirLegsDto.prototype, "referenceActe", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RecevoirLegsDto.prototype, "compteFondsId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RecevoirLegsDto.prototype, "dettes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RecevoirLegsDto.prototype, "compteDettesId", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BienDuLegsDto),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(50),
    __metadata("design:type", Array)
], RecevoirLegsDto.prototype, "biens", void 0);
class BienDuPrixGlobalDto {
}
exports.BienDuPrixGlobalDto = BienDuPrixGlobalDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], BienDuPrixGlobalDto.prototype, "compteImmobilisationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(190),
    (0, class_validator_1.Matches)(/\S/, { message: 'La désignation du bien est obligatoire.' }),
    __metadata("design:type", String)
], BienDuPrixGlobalDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], BienDuPrixGlobalDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BienDuPrixGlobalDto.prototype, "parDifference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], BienDuPrixGlobalDto.prototype, "dureeAmortissementAns", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], BienDuPrixGlobalDto.prototype, "dateMiseEnService", void 0);
class StockDuFondsDto {
}
exports.StockDuFondsDto = StockDuFondsDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], StockDuFondsDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], StockDuFondsDto.prototype, "montant", void 0);
class AcquerirAPrixGlobalDto {
}
exports.AcquerirAPrixGlobalDto = AcquerirAPrixGlobalDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], AcquerirAPrixGlobalDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], AcquerirAPrixGlobalDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AcquerirAPrixGlobalDto.prototype, "dateAcquisition", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    (0, class_validator_1.Matches)(/\S/, { message: "La référence de l'acte ou de la facture est obligatoire." }),
    __metadata("design:type", String)
], AcquerirAPrixGlobalDto.prototype, "referenceActe", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], AcquerirAPrixGlobalDto.prototype, "compteContrepartieId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], AcquerirAPrixGlobalDto.prototype, "prix", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['ENSEMBLE', 'FONDS_DE_COMMERCE']),
    __metadata("design:type", String)
], AcquerirAPrixGlobalDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ACTE', 'VALEURS_ATTRIBUABLES', 'COMPARAISON_TERRAINS_NUS', 'COUT_RECONSTRUCTION', 'PRIX_DE_MARCHE', 'FORFAIT']),
    __metadata("design:type", String)
], AcquerirAPrixGlobalDto.prototype, "fondement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AcquerirAPrixGlobalDto.prototype, "sourceValeurs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AcquerirAPrixGlobalDto.prototype, "motifSansComparaison", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BienDuPrixGlobalDto),
    (0, class_validator_1.ArrayMaxSize)(50),
    __metadata("design:type", Array)
], AcquerirAPrixGlobalDto.prototype, "biens", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => StockDuFondsDto),
    (0, class_validator_1.ArrayMaxSize)(50),
    __metadata("design:type", Array)
], AcquerirAPrixGlobalDto.prototype, "stocks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], AcquerirAPrixGlobalDto.prototype, "dureeFondsCommercialAns", void 0);
class RemplacerPartieDto extends RenouvelerComposantDto {
}
exports.RemplacerPartieDto = RemplacerPartieDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(190),
    (0, class_validator_1.Matches)(/\S/, { message: 'Nommez la partie remplacée.' }),
    __metadata("design:type", String)
], RemplacerPartieDto.prototype, "designationPartie", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], RemplacerPartieDto.prototype, "valeurOrigineEstimee", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['COUT_ACTUEL_A_NEUF', 'POURCENTAGE_IMMOBILISATIONS_RECENTES', 'INFORMATIONS_FOURNISSEURS', 'DEPENSES_DE_RENOUVELLEMENT']),
    __metadata("design:type", String)
], RemplacerPartieDto.prototype, "methodeEstimation", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    (0, class_validator_1.Matches)(/\S/, { message: "Indiquez la source de l'estimation." }),
    __metadata("design:type", String)
], RemplacerPartieDto.prototype, "sourceEstimation", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    (0, class_validator_1.Matches)(/\S/, { message: 'Indiquez pourquoi la structure se décompose.' }),
    __metadata("design:type", String)
], RemplacerPartieDto.prototype, "justificationDecomposition", void 0);
class DureeLimiteeDto {
}
exports.DureeLimiteeDto = DureeLimiteeDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DureeLimiteeDto.prototype, "dateDecision", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], DureeLimiteeDto.prototype, "dureeResiduelleAns", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    (0, class_validator_1.Matches)(/\S/, { message: 'Dites ce qui rend la durée limitée.' }),
    __metadata("design:type", String)
], DureeLimiteeDto.prototype, "motif", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    (0, class_validator_1.Matches)(/\S/, { message: 'Indiquez le résultat du test de dépréciation.' }),
    __metadata("design:type", String)
], DureeLimiteeDto.prototype, "testDepreciation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['NON_ESTIMABLE', 'SIMPLIFICATION_SMT']),
    __metadata("design:type", String)
], DureeLimiteeDto.prototype, "fondementDureeDixAns", void 0);
class IncorporerCoutsEmpruntDto {
}
exports.IncorporerCoutsEmpruntDto = IncorporerCoutsEmpruntDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], IncorporerCoutsEmpruntDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], IncorporerCoutsEmpruntDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['SPECIFIQUE', 'GENERAL']),
    __metadata("design:type", String)
], IncorporerCoutsEmpruntDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], IncorporerCoutsEmpruntDto.prototype, "debutPreparation", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], IncorporerCoutsEmpruntDto.prototype, "finPreparation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], IncorporerCoutsEmpruntDto.prototype, "justificationPeriodeCourte", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], IncorporerCoutsEmpruntDto.prototype, "dateDebut", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], IncorporerCoutsEmpruntDto.prototype, "dateFin", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], IncorporerCoutsEmpruntDto.prototype, "base", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], IncorporerCoutsEmpruntDto.prototype, "tauxPourcent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], IncorporerCoutsEmpruntDto.prototype, "produitsPlacement", void 0);
class ReviserPlanDto {
}
exports.ReviserPlanDto = ReviserPlanDto;
__decorate([
    (0, class_validator_1.IsIn)(['PROSPECTIVE', 'RETROACTIVE']),
    __metadata("design:type", String)
], ReviserPlanDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReviserPlanDto.prototype, "dateDecision", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ReviserPlanDto.prototype, "nouvelleDureeAns", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    (0, class_validator_1.Matches)(/\S/, { message: 'Dites ce qui a changé.' }),
    __metadata("design:type", String)
], ReviserPlanDto.prototype, "motif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReviserPlanDto.prototype, "journalId", void 0);
class CategorieReevaluationDto {
}
exports.CategorieReevaluationDto = CategorieReevaluationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CategorieReevaluationDto.prototype, "cle", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CategorieReevaluationDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    (0, class_validator_1.Max)(1000),
    __metadata("design:type", Number)
], CategorieReevaluationDto.prototype, "coefficient", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CategorieReevaluationDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ORIGINE', 'DERNIERE_REEVALUATION']),
    __metadata("design:type", Object)
], CategorieReevaluationDto.prototype, "base", void 0);
class LigneReevaluationDto {
}
exports.LigneReevaluationDto = LigneReevaluationDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], LigneReevaluationDto.prototype, "immobilisationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], LigneReevaluationDto.prototype, "categorie", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LigneReevaluationDto.prototype, "valeurActuelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], LigneReevaluationDto.prototype, "droitDeReprise", void 0);
class ReevaluerImmobilisationsDto {
}
exports.ReevaluerImmobilisationsDto = ReevaluerImmobilisationsDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReevaluerImmobilisationsDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReevaluerImmobilisationsDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LEGALE', 'LIBRE']),
    __metadata("design:type", String)
], ReevaluerImmobilisationsDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['AJUSTEMENT', 'ELIMINATION']),
    __metadata("design:type", String)
], ReevaluerImmobilisationsDto.prototype, "methodeLibre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReevaluerImmobilisationsDto.prototype, "neutraliteFiscale", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ReevaluerImmobilisationsDto.prototype, "decision", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], ReevaluerImmobilisationsDto.prototype, "traitementFiscal", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], ReevaluerImmobilisationsDto.prototype, "methodeEvaluation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CategorieReevaluationDto),
    (0, class_validator_1.ArrayMaxSize)(20),
    __metadata("design:type", Array)
], ReevaluerImmobilisationsDto.prototype, "categories", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneReevaluationDto),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(500),
    __metadata("design:type", Array)
], ReevaluerImmobilisationsDto.prototype, "lignes", void 0);
class RepriseProvisionReevaluationDto {
}
exports.RepriseProvisionReevaluationDto = RepriseProvisionReevaluationDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RepriseProvisionReevaluationDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RepriseProvisionReevaluationDto.prototype, "journalId", void 0);
class AcquerirAPrixAleatoireDto {
}
exports.AcquerirAPrixAleatoireDto = AcquerirAPrixAleatoireDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureAcquisitionAleatoire),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "compteImmobilisationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(190),
    (0, class_validator_1.Matches)(/\S/, { message: 'Nommez le bien.' }),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "dateAcquisition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "dateMiseEnService", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], AcquerirAPrixAleatoireDto.prototype, "valeurOrigine", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], AcquerirAPrixAleatoireDto.prototype, "dureeAmortissementAns", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FondementValeurAleatoire),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "fondement", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "sourceValeur", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "compteDetteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AcquerirAPrixAleatoireDto.prototype, "comptant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "compteComptantId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], AcquerirAPrixAleatoireDto.prototype, "journalId", void 0);
class SolderDetteAleatoireDto {
}
exports.SolderDetteAleatoireDto = SolderDetteAleatoireDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], SolderDetteAleatoireDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], SolderDetteAleatoireDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SolderDetteAleatoireDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SolderDetteAleatoireDto.prototype, "versementsCumules", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    (0, class_validator_1.Matches)(/\S/, { message: 'Dites d\'où vient le cumul des versements.' }),
    __metadata("design:type", String)
], SolderDetteAleatoireDto.prototype, "sourceVersements", void 0);
class ReserveProprieteDto {
}
exports.ReserveProprieteDto = ReserveProprieteDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReserveProprieteDto.prototype, "reserveDePropriete", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ReserveProprieteDto.prototype, "leveeLe", void 0);
class DesactualisationDemantelementDto {
}
exports.DesactualisationDemantelementDto = DesactualisationDemantelementDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DesactualisationDemantelementDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DesactualisationDemantelementDto.prototype, "journalId", void 0);
class RepriseDemantelementDto {
}
exports.RepriseDemantelementDto = RepriseDemantelementDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RepriseDemantelementDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RepriseDemantelementDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RepriseDemantelementDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['ENGAGEMENT_COUTS', 'CESSION_SOUS_JACENT']),
    __metadata("design:type", String)
], RepriseDemantelementDto.prototype, "motif", void 0);
//# sourceMappingURL=immobilisation.dto.js.map