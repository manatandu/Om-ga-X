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
exports.ModeleBulletinDto = exports.LigneModeleBulletinDto = exports.VersionBaremePaieDto = exports.FinSaisieArretDto = exports.AvanceSalaireDto = exports.ModifierRubriquePaieDto = exports.RubriquePaieDto = exports.ComptabilisationPaieDto = exports.RemiseBulletinDto = exports.AnnulationBulletinDto = exports.LivreDePaieDto = exports.EmissionDecompteFinalDto = exports.VentilationAvantageDto = exports.DecompteFinalEmisDto = exports.MOTIF_MOIS_NON_COUVERTS_EXIGES = exports.MOTIF_ANCIENNETE_EXIGEE = exports.DecompteFinalDto = exports.IndemniteStipuleeDto = exports.GratificationStipuleeDto = exports.ParametresCotisationsDto = exports.SimulationPaieDto = exports.HeuresMajoreesDto = exports.AllocationCongePorteeDto = exports.RetenueAvanceDto = exports.ElementPaieDto = exports.MOTIF_MONTANT_AU_CENTIME = exports.TerminerContratDto = exports.DeviseRemunerationDto = exports.ContratTravailDto = exports.MOTIF_MONNAIE_REMUNERATION = exports.SalarieDto = exports.EnfantAChargeDto = void 0;
const baremes_dossier_1 = require("../baremes-dossier");
const bornes_registre_1 = require("../bornes-registre");
const regles_contrat_travail_1 = require("../regles-contrat-travail");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class EnfantAChargeDto {
}
exports.EnfantAChargeDto = EnfantAChargeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], EnfantAChargeDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], EnfantAChargeDto.prototype, "postNom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], EnfantAChargeDto.prototype, "prenoms", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EnfantAChargeDto.prototype, "dateNaissance", void 0);
class SalarieDto {
}
exports.SalarieDto = SalarieDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], SalarieDto.prototype, "matricule", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SalarieDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SalarieDto.prototype, "postNom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SalarieDto.prototype, "prenoms", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.SexeTravailleur),
    __metadata("design:type", String)
], SalarieDto.prototype, "sexe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], SalarieDto.prototype, "numeroAffiliationCnss", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SalarieDto.prototype, "dateNaissance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1900),
    __metadata("design:type", Number)
], SalarieDto.prototype, "millesimeNaissance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SalarieDto.prototype, "lieuNaissance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], SalarieDto.prototype, "nationalite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SalarieDto.prototype, "nomConjoint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SalarieDto.prototype, "aptitudeConstateeLe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SalarieDto.prototype, "aptitudeConstateePar", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SalarieDto.prototype, "aptitudeProvisoire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SalarieDto.prototype, "declarationEngagementLe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SalarieDto.prototype, "declarationDepartLe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SalarieDto.prototype, "actif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE, {
        message: `Une fiche porte au plus ${bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE} enfants à charge, ce que l'écran du registre peut montrer.`,
    }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => EnfantAChargeDto),
    __metadata("design:type", Array)
], SalarieDto.prototype, "enfants", void 0);
exports.MOTIF_MONNAIE_REMUNERATION = 'La monnaie de la rémunération convenue est le franc congolais (CDF) ou le dollar américain (USD).';
class ContratTravailDto {
}
exports.ContratTravailDto = ContratTravailDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TypeContratTravail),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ContratTravailDto.prototype, "constateParEcrit", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "dateEntreeEnVigueur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "dateConclusion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "lieuConclusion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "dateFinPrevue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ContratTravailDto.prototype, "separeDeSaFamille", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "ouvrageDetermine", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "motifRemplacement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ContratTravailDto.prototype, "emploiPermanent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "natureTravail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "lieuExecution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "categorieProfessionnelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(17),
    __metadata("design:type", Number)
], ContratTravailDto.prototype, "classeProfessionnelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PeriodiciteRemuneration),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "periodiciteRemuneration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ContratTravailDto.prototype, "manoeuvreSansSpecialite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ContratTravailDto.prototype, "remunerationBase", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => (o.deviseRemuneration !== undefined && o.deviseRemuneration !== null) ||
        (o.remunerationBase !== undefined && o.remunerationBase !== null)),
    (0, class_validator_1.IsDefined)({ message: regles_contrat_travail_1.MOTIF_MONNAIE_EXIGEE }),
    (0, class_validator_1.IsEnum)(['CDF', 'USD'], { message: exports.MOTIF_MONNAIE_REMUNERATION }),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "deviseRemuneration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "avantagesConvenus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ContratTravailDto.prototype, "clauseEssai", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ContratTravailDto.prototype, "essaiConstateParEcrit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ContratTravailDto.prototype, "essaiDureeJours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ContratTravailDto.prototype, "dureePreavisJours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ContratTravailDto.prototype, "viseParOnem", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "dateVisaOnem", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContratTravailDto.prototype, "renouvelleDeId", void 0);
class DeviseRemunerationDto {
}
exports.DeviseRemunerationDto = DeviseRemunerationDto;
__decorate([
    (0, class_validator_1.IsEnum)(['CDF', 'USD'], { message: exports.MOTIF_MONNAIE_REMUNERATION }),
    __metadata("design:type", String)
], DeviseRemunerationDto.prototype, "deviseRemuneration", void 0);
class TerminerContratDto {
}
exports.TerminerContratDto = TerminerContratDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], TerminerContratDto.prototype, "dateFin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], TerminerContratDto.prototype, "motifFin", void 0);
exports.MOTIF_MONTANT_AU_CENTIME = "Le montant d'un élément de paie se saisit en francs, au centime (deux décimales au plus).";
class ElementPaieDto {
}
exports.ElementPaieDto = ElementPaieDto;
__decorate([
    (0, class_validator_1.IsEnum)([
        'SALAIRE_OU_TRAITEMENT',
        'COMMISSION',
        'INDEMNITE_DE_VIE_CHERE',
        'PRIME',
        'PARTICIPATION_AUX_BENEFICES',
        'GRATIFICATION_OU_MOIS_COMPLEMENTAIRE',
        'PRESTATION_SUPPLEMENTAIRE',
        'AVANTAGE_EN_NATURE',
        'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE',
        'INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT',
        'SOINS_DE_SANTE',
        'LOGEMENT_OU_SON_INDEMNITE',
        'ALLOCATIONS_FAMILIALES_LEGALES',
        'INDEMNITE_DE_TRANSPORT',
        'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION',
    ]),
    __metadata("design:type", String)
], ElementPaieDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], ElementPaieDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((e) => e.montantUsd === undefined),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }, { message: exports.MOTIF_MONTANT_AU_CENTIME }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ElementPaieDto.prototype, "montantFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ElementPaieDto.prototype, "montantUsd", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ElementPaieDto.prototype, "remboursementDeDepenseProfessionnelleEffective", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ElementPaieDto.prototype, "conditionArticle69Attestee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ElementPaieDto.prototype, "enNature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ElementPaieDto.prototype, "rubriqueId", void 0);
class RetenueAvanceDto {
}
exports.RetenueAvanceDto = RetenueAvanceDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RetenueAvanceDto.prototype, "avanceId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], RetenueAvanceDto.prototype, "montantFc", void 0);
class AllocationCongePorteeDto {
}
exports.AllocationCongePorteeDto = AllocationCongePorteeDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], AllocationCongePorteeDto.prototype, "congeId", void 0);
class HeuresMajoreesDto {
}
exports.HeuresMajoreesDto = HeuresMajoreesDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], HeuresMajoreesDto.prototype, "majorationId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.Max)(744),
    __metadata("design:type", Number)
], HeuresMajoreesDto.prototype, "heures", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], HeuresMajoreesDto.prototype, "tauxHoraire", void 0);
class SimulationPaieDto {
}
exports.SimulationPaieDto = SimulationPaieDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(7),
    __metadata("design:type", String)
], SimulationPaieDto.prototype, "moisDePaie", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(12),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AllocationCongePorteeDto),
    __metadata("design:type", Array)
], SimulationPaieDto.prototype, "allocationsConge", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => HeuresMajoreesDto),
    __metadata("design:type", Array)
], SimulationPaieDto.prototype, "heuresMajorees", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => RetenueAvanceDto),
    __metadata("design:type", Array)
], SimulationPaieDto.prototype, "retenuesAvances", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ElementPaieDto),
    __metadata("design:type", Array)
], SimulationPaieDto.prototype, "elements", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['CDF', 'USD']),
    __metadata("design:type", String)
], SimulationPaieDto.prototype, "deviseStipulation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SimulationPaieDto.prototype, "dateMiseADisposition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(99),
    __metadata("design:type", Number)
], SimulationPaieDto.prototype, "personnesACharge", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SimulationPaieDto.prototype, "retenuesArticle71Fc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SimulationPaieDto.prototype, "tauxLegalAllocationsFamilialesFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(30),
    __metadata("design:type", Number)
], SimulationPaieDto.prototype, "enfantsBeneficiairesAllocations", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(31),
    __metadata("design:type", Number)
], SimulationPaieDto.prototype, "joursAllocationsFamiliales", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['PUBLIC', 'PRIVE']),
    __metadata("design:type", String)
], SimulationPaieDto.prototype, "natureEmployeurInpp", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 3 }),
    (0, class_validator_1.Min)(0.001),
    __metadata("design:type", Number)
], SimulationPaieDto.prototype, "reductionTauxInppPoints", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], SimulationPaieDto.prototype, "referenceReductionInpp", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['BAREME_ARTICLE_118', 'FORFAIT_PERSONNEL_DOMESTIQUE', 'FORFAIT_SALARIE_DE_MICRO_ENTREPRISE']),
    __metadata("design:type", String)
], SimulationPaieDto.prototype, "regimeSalarial", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(26),
    __metadata("design:type", Number)
], SimulationPaieDto.prototype, "joursPayes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SimulationPaieDto.prototype, "effectif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([50, 100]),
    __metadata("design:type", Number)
], SimulationPaieDto.prototype, "majorationRisquesProfessionnelsPourCent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(17),
    __metadata("design:type", Number)
], SimulationPaieDto.prototype, "classeProfessionnelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SimulationPaieDto.prototype, "logementFourniEnNature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SimulationPaieDto.prototype, "logementEnNatureDejaDefalque", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SimulationPaieDto.prototype, "obligationAlimentaireLegale", void 0);
class ParametresCotisationsDto {
}
exports.ParametresCotisationsDto = ParametresCotisationsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['PUBLIC', 'PRIVE']),
    __metadata("design:type", String)
], ParametresCotisationsDto.prototype, "natureEmployeurInpp", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ParametresCotisationsDto.prototype, "effectif", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([50, 100]),
    __metadata("design:type", Number)
], ParametresCotisationsDto.prototype, "majorationRisquesProfessionnelsPourCent", void 0);
class GratificationStipuleeDto {
}
exports.GratificationStipuleeDto = GratificationStipuleeDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GratificationStipuleeDto.prototype, "montantAnnuelFc", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], GratificationStipuleeDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], GratificationStipuleeDto.prototype, "debutPeriode", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], GratificationStipuleeDto.prototype, "finPeriode", void 0);
class IndemniteStipuleeDto {
}
exports.IndemniteStipuleeDto = IndemniteStipuleeDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], IndemniteStipuleeDto.prototype, "montantFc", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], IndemniteStipuleeDto.prototype, "source", void 0);
class DecompteFinalDto {
}
exports.DecompteFinalDto = DecompteFinalDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(99),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "anneesAnciennete", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1200),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "moisNonCouvertsParUnConge", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DecompteFinalDto.prototype, "moinsDeDixHuitAns", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['EMPLOYEUR', 'TRAVAILLEUR']),
    __metadata("design:type", String)
], DecompteFinalDto.prototype, "initiative", void 0);
__decorate([
    (0, class_validator_1.IsEnum)([
        'LICENCIEMENT',
        'DEMISSION',
        'FAUTE_LOURDE',
        'FORCE_MAJEURE',
        'TERME_DU_CDD',
        'COMMUN_ACCORD',
    ]),
    __metadata("design:type", String)
], DecompteFinalDto.prototype, "motif", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['DUREE_INDETERMINEE', 'DUREE_DETERMINEE']),
    __metadata("design:type", String)
], DecompteFinalDto.prototype, "typeContrat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DecompteFinalDto.prototype, "periodeDEssai", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(400),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "joursDEssaiEcoules", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DecompteFinalDto.prototype, "delegueSyndical", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DecompteFinalDto.prototype, "dateNotification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(2000),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "preavisRetenuJours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DecompteFinalDto.prototype, "forceMajeureConstateeParInspecteur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DecompteFinalDto.prototype, "deuxMoisDeSuspension", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)([
        'PRESTE',
        'NON_OBSERVE',
        'DISPENSE_PAR_EMPLOYEUR',
        'DISPENSE_A_LA_DEMANDE_DU_TRAVAILLEUR',
        'DEPART_A_MI_PREAVIS',
        'DEPART_POUR_NOUVEL_EMPLOI',
    ]),
    __metadata("design:type", String)
], DecompteFinalDto.prototype, "executionPreavis", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "joursPreavisNonObserves", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "avantagesEnNatureRestantsFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DecompteFinalDto.prototype, "nouvelEmploiJustifie", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(366),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "delaiDepartNouvelEmploiJours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['EMPLOYEUR', 'TRAVAILLEUR']),
    __metadata("design:type", String)
], DecompteFinalDto.prototype, "partieResponsable", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "remunerationJournaliereFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "remunerationMensuelleFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "moyenneMensuelleArticle66Fc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "moyenneMensuelleArticle142Fc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "avantagesPendantPreavisFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DecompteFinalDto.prototype, "dateRuptureContrat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DecompteFinalDto.prototype, "dateTermeContrat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "avantagesJusquAuTermeFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "montantConvenuCommunAccordFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "arrieresFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "gratificationFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GratificationStipuleeDto),
    __metadata("design:type", GratificationStipuleeDto)
], DecompteFinalDto.prototype, "gratificationStipulee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => IndemniteStipuleeDto),
    __metadata("design:type", IndemniteStipuleeDto)
], DecompteFinalDto.prototype, "indemniteStipulee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(7),
    __metadata("design:type", String)
], DecompteFinalDto.prototype, "moisDeCessation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "enfantsBeneficiairesAllocations", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DecompteFinalDto.prototype, "joursAllocationsFamiliales", void 0);
exports.MOTIF_ANCIENNETE_EXIGEE = "Déclarez l'ancienneté du travailleur en années entières, zéro compris · le préavis en dépend (article 64).";
exports.MOTIF_MOIS_NON_COUVERTS_EXIGES = "Déclarez les mois de service non couverts par un congé, zéro compris · l'indemnité compensatoire en dépend (article 144).";
class DecompteFinalEmisDto extends DecompteFinalDto {
}
exports.DecompteFinalEmisDto = DecompteFinalEmisDto;
__decorate([
    (0, class_validator_1.IsDefined)({ message: exports.MOTIF_ANCIENNETE_EXIGEE }),
    __metadata("design:type", Number)
], DecompteFinalEmisDto.prototype, "anneesAnciennete", void 0);
__decorate([
    (0, class_validator_1.IsDefined)({ message: exports.MOTIF_MOIS_NON_COUVERTS_EXIGES }),
    __metadata("design:type", Number)
], DecompteFinalEmisDto.prototype, "moisNonCouvertsParUnConge", void 0);
class VentilationAvantageDto {
}
exports.VentilationAvantageDto = VentilationAvantageDto;
__decorate([
    (0, class_validator_1.IsIn)(['preavis', 'dommages-interets-art-70']),
    __metadata("design:type", String)
], VentilationAvantageDto.prototype, "rubrique", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LOGEMENT_OU_SON_INDEMNITE', 'INDEMNITE_DE_TRANSPORT', 'SOINS_DE_SANTE', 'REMUNERATION']),
    __metadata("design:type", String)
], VentilationAvantageDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], VentilationAvantageDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], VentilationAvantageDto.prototype, "montantFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], VentilationAvantageDto.prototype, "conditionArticle69Attestee", void 0);
class EmissionDecompteFinalDto {
}
exports.EmissionDecompteFinalDto = EmissionDecompteFinalDto;
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DecompteFinalEmisDto),
    __metadata("design:type", DecompteFinalEmisDto)
], EmissionDecompteFinalDto.prototype, "decompte", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SimulationPaieDto),
    __metadata("design:type", SimulationPaieDto)
], EmissionDecompteFinalDto.prototype, "paie", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => VentilationAvantageDto),
    __metadata("design:type", Array)
], EmissionDecompteFinalDto.prototype, "ventilationAvantages", void 0);
class LivreDePaieDto {
}
exports.LivreDePaieDto = LivreDePaieDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], LivreDePaieDto.prototype, "siegeDExploitation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['LIVRE_PAPIER', 'FICHIER_INFORMATISE', 'AUTRE_DOCUMENT']),
    __metadata("design:type", String)
], LivreDePaieDto.prototype, "formeDuDocument", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], LivreDePaieDto.prototype, "autorisationInspecteurDuTravail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LivreDePaieDto.prototype, "effectifHabituel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], LivreDePaieDto.prototype, "exclusivementPersonnelDomestique", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.Min)(1, { each: true }),
    (0, class_validator_1.Max)(33, { each: true }),
    __metadata("design:type", Array)
], LivreDePaieDto.prototype, "mentionsPortees", void 0);
class AnnulationBulletinDto {
}
exports.AnnulationBulletinDto = AnnulationBulletinDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AnnulationBulletinDto.prototype, "motif", void 0);
class RemiseBulletinDto {
}
exports.RemiseBulletinDto = RemiseBulletinDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RemiseBulletinDto.prototype, "remisLe", void 0);
class ComptabilisationPaieDto {
}
exports.ComptabilisationPaieDto = ComptabilisationPaieDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ComptabilisationPaieDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ComptabilisationPaieDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ComptabilisationPaieDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ComptabilisationPaieDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ComptabilisationPaieDto.prototype, "inscrireNegatifs", void 0);
class RubriquePaieDto {
}
exports.RubriquePaieDto = RubriquePaieDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], RubriquePaieDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], RubriquePaieDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RubriquePaieDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], RubriquePaieDto.prototype, "fondement", void 0);
class ModifierRubriquePaieDto {
}
exports.ModifierRubriquePaieDto = ModifierRubriquePaieDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ModifierRubriquePaieDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ModifierRubriquePaieDto.prototype, "fondement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierRubriquePaieDto.prototype, "actif", void 0);
class AvanceSalaireDto {
}
exports.AvanceSalaireDto = AvanceSalaireDto;
__decorate([
    (0, class_validator_1.IsEnum)(['AVANCE', 'ACOMPTE', 'PRET', 'SAISIE_ARRET']),
    __metadata("design:type", String)
], AvanceSalaireDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['IMMOBILIER', 'MOBILIER_ET_INSTALLATION', 'AUTRE']),
    __metadata("design:type", String)
], AvanceSalaireDto.prototype, "categoriePret", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AvanceSalaireDto.prototype, "dateOctroi", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], AvanceSalaireDto.prototype, "montantFc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], AvanceSalaireDto.prototype, "retenueMensuelleFc", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AvanceSalaireDto.prototype, "objet", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AvanceSalaireDto.prototype, "pieceJustificative", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AvanceSalaireDto.prototype, "referenceActe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AvanceSalaireDto.prototype, "greffe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AvanceSalaireDto.prototype, "destinataire", void 0);
class FinSaisieArretDto {
}
exports.FinSaisieArretDto = FinSaisieArretDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], FinSaisieArretDto.prototype, "dateFin", void 0);
class VersionBaremePaieDto {
}
exports.VersionBaremePaieDto = VersionBaremePaieDto;
__decorate([
    (0, class_validator_1.IsEnum)(baremes_dossier_1.BAREMES_SERVIS, { message: baremes_dossier_1.MOTIF_BAREME_NON_SAISISSABLE }),
    __metadata("design:type", String)
], VersionBaremePaieDto.prototype, "bareme", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], VersionBaremePaieDto.prototype, "aPartirDu", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], VersionBaremePaieDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], VersionBaremePaieDto.prototype, "valeurs", void 0);
class LigneModeleBulletinDto {
}
exports.LigneModeleBulletinDto = LigneModeleBulletinDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], LigneModeleBulletinDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], LigneModeleBulletinDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", Object)
], LigneModeleBulletinDto.prototype, "rubriqueId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], LigneModeleBulletinDto.prototype, "montant", void 0);
class ModeleBulletinDto {
}
exports.ModeleBulletinDto = ModeleBulletinDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ModeleBulletinDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ModeleBulletinDto.prototype, "categorie", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['CDF', 'USD']),
    __metadata("design:type", String)
], ModeleBulletinDto.prototype, "deviseStipulation", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneModeleBulletinDto),
    __metadata("design:type", Array)
], ModeleBulletinDto.prototype, "lignes", void 0);
//# sourceMappingURL=personnel.dto.js.map