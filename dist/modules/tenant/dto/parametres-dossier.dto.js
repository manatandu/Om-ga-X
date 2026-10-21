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
exports.ModifierSeuilEcartReglementDto = exports.SEUIL_ECART_REGLEMENT_MAX = exports.ModifierCreationCompteEnSaisieDto = exports.ModifierModulesDto = exports.ModifierLongueurCompteDto = exports.ModifierRefusClotureNonImprimeDto = exports.ModifierDoubleRegardDto = exports.ModifierMethodeInventaireStocksDto = exports.ModifierMethodeCotisationsDto = exports.ModifierRegimeDto = exports.REPONSES_FAIT = exports.ModifierFormeSyscohadaDto = exports.ModifierFormeJuridiqueDto = exports.ModifierIdentiteDto = exports.ModifierCoordonneesDto = exports.ModifierSystemeSyscohadaDto = exports.ModifierJeuEtatsDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
class ModifierJeuEtatsDto {
}
exports.ModifierJeuEtatsDto = ModifierJeuEtatsDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.JeuEtatsFinanciersSycebnl),
    __metadata("design:type", String)
], ModifierJeuEtatsDto.prototype, "jeuEtatsFinanciersSycebnl", void 0);
class ModifierSystemeSyscohadaDto {
}
exports.ModifierSystemeSyscohadaDto = ModifierSystemeSyscohadaDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.SystemeComptableSyscohada),
    __metadata("design:type", String)
], ModifierSystemeSyscohadaDto.prototype, "systemeComptableSyscohada", void 0);
class ModifierCoordonneesDto {
}
exports.ModifierCoordonneesDto = ModifierCoordonneesDto;
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("La raison sociale ne s'efface pas : elle est imprimée en tête de chaque état. Omettez le champ pour la laisser inchangée."),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ModifierCoordonneesDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], ModifierCoordonneesDto.prototype, "activite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", Object)
], ModifierCoordonneesDto.prototype, "codeActivitePrincipale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], ModifierCoordonneesDto.prototype, "adresse", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", Object)
], ModifierCoordonneesDto.prototype, "ville", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", Object)
], ModifierCoordonneesDto.prototype, "pays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", Object)
], ModifierCoordonneesDto.prototype, "telephone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== ''),
    (0, class_validator_1.IsEmail)({}, { message: "Le courriel de l'entité n'est pas une adresse valide." }),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], ModifierCoordonneesDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], ModifierCoordonneesDto.prototype, "siteWeb", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }, { message: 'Le capital social est un montant, à deux décimales au plus.' }),
    (0, class_validator_1.Min)(0.01, { message: 'Le capital social est un montant positif.' }),
    __metadata("design:type", Object)
], ModifierCoordonneesDto.prototype, "capitalSocial", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('« À capital variable » se répond par true ou false, jamais par null. Le retrait s’écrit false ; omettez le champ pour le laisser inchangé.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierCoordonneesDto.prototype, "capitalVariable", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", Object)
], ModifierCoordonneesDto.prototype, "deviseFonctionnelle", void 0);
class ModifierIdentiteDto {
}
exports.ModifierIdentiteDto = ModifierIdentiteDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "numeroImpot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "idNat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "rccm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "numeroDeclarationActivite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['OUI', 'NON', 'PAS_ENCORE_DIT'], { message: 'La location-gérance se déclare OUI, NON ou PAS_ENCORE_DIT.' }),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "locataireGerantFonds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "numeroRegistreCooperatives", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['SCOOPS', 'COOP_CA', 'PAS_ENCORE_DIT'], {
        message: 'La variante de la coopérative se déclare SCOOPS, COOP_CA ou PAS_ENCORE_DIT.',
    }),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "varianteCooperative", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['CONSEIL_ADMINISTRATION', 'ADMINISTRATEUR_GENERAL', 'PAS_ENCORE_DIT'], {
        message: 'Le mode d’administration se déclare CONSEIL_ADMINISTRATION, ADMINISTRATEUR_GENERAL ou PAS_ENCORE_DIT.',
    }),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "modeAdministrationSa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['OUI', 'NON', 'PAS_ENCORE_DIT'], { message: 'L’associé unique se déclare OUI, NON ou PAS_ENCORE_DIT.' }),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "associeUnique", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['OUI', 'NON', 'PAS_ENCORE_DIT'], {
        message: 'La qualité d’entreprise du portefeuille de l’État se déclare OUI, NON ou PAS_ENCORE_DIT.',
    }),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "entreprisePortefeuilleEtat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateDissolution !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "dateDissolution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "liquidateurs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateNominationLiquidateur !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "dateNominationLiquidateur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['AMIABLE_STATUTAIRE', 'ARTICLE_223_1', 'ARTICLE_223_2_JUDICIAIRE', 'PROCEDURE_COLLECTIVE', 'PAS_ENCORE_DIT'], {
        message: 'Le régime de la liquidation se déclare AMIABLE_STATUTAIRE, ARTICLE_223_1, ARTICLE_223_2_JUDICIAIRE, ' +
            'PROCEDURE_COLLECTIVE ou PAS_ENCORE_DIT.',
    }),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "regimeLiquidation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['OUI', 'NON', 'PAS_ENCORE_DIT'], {
        message: 'L’associé unique personne morale se déclare OUI, NON ou PAS_ENCORE_DIT.',
    }),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "associeUniquePersonneMorale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateClotureLiquidation !== '' && o.dateClotureLiquidation !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ModifierIdentiteDto.prototype, "dateClotureLiquidation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateDeclarationCotisationActivite !== '' && o.dateDeclarationCotisationActivite !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ModifierIdentiteDto.prototype, "dateDeclarationCotisationActivite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateDeclarationCotisationLiquidation !== '' && o.dateDeclarationCotisationLiquidation !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ModifierIdentiteDto.prototype, "dateDeclarationCotisationLiquidation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['OUI', 'NON', 'PAS_ENCORE_DIT'], {
        message: 'Le secteur minier se déclare OUI, NON ou PAS_ENCORE_DIT.',
    }),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "portefeuilleSecteurMinier", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.quotePartEtatCapital !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }, { message: 'La quote-part de l’État est un pourcentage, à quatre décimales au plus.' }),
    (0, class_validator_1.Min)(0, { message: 'La quote-part de l’État est un pourcentage de 0 à 100.' }),
    (0, class_validator_1.Max)(100, { message: 'La quote-part de l’État est un pourcentage de 0 à 100.' }),
    __metadata("design:type", Object)
], ModifierIdentiteDto.prototype, "quotePartEtatCapital", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", Object)
], ModifierIdentiteDto.prototype, "sourceQuotePartEtat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "actePersonnaliteJuridique", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateActePersonnalite !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "dateActePersonnalite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "numeroEnregistrementSecteur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "certificatEnregistrementPlan", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "attestationExemptionIs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateAttestationExemptionIs !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierIdentiteDto.prototype, "dateAttestationExemptionIs", void 0);
class ModifierFormeJuridiqueDto {
}
exports.ModifierFormeJuridiqueDto = ModifierFormeJuridiqueDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FormeJuridiqueEbnl),
    __metadata("design:type", String)
], ModifierFormeJuridiqueDto.prototype, "formeJuridique", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Le droit étranger se répond par true ou false, jamais par null. Omettez le champ pour le laisser inchangé.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierFormeJuridiqueDto.prototype, "droitEtranger", void 0);
class ModifierFormeSyscohadaDto {
}
exports.ModifierFormeSyscohadaDto = ModifierFormeSyscohadaDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FormeJuridiqueSyscohada),
    __metadata("design:type", String)
], ModifierFormeSyscohadaDto.prototype, "formeJuridiqueSyscohada", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], ModifierFormeSyscohadaDto.prototype, "dateEffetTransformation", void 0);
exports.REPONSES_FAIT = ['OUI', 'NON', 'PAS_ENCORE_DIT'];
class ModifierRegimeDto {
}
exports.ModifierRegimeDto = ModifierRegimeDto;
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("L'assujettissement à la TVA se répond par true ou false · « pas encore dit » s'écrit reponseAssujettissementTva = PAS_ENCORE_DIT, jamais null."),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierRegimeDto.prototype, "assujettiTva", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Une réponse déclarée s’écrit OUI, NON ou PAS_ENCORE_DIT · null ne dit pas laquelle des trois.'),
    (0, class_validator_1.IsIn)(exports.REPONSES_FAIT),
    __metadata("design:type", String)
], ModifierRegimeDto.prototype, "reponseAssujettissementTva", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('Une réponse déclarée s’écrit OUI, NON ou PAS_ENCORE_DIT · null ne dit pas laquelle des trois.'),
    (0, class_validator_1.IsIn)(exports.REPONSES_FAIT),
    __metadata("design:type", String)
], ModifierRegimeDto.prototype, "venteBiensServices", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateOptionTva !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierRegimeDto.prototype, "dateOptionTva", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("L'effectif permanent est un nombre entier, zéro compris · null n'en est pas un. Omettez le champ pour le laisser inchangé."),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ModifierRegimeDto.prototype, "effectifPermanent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", Object)
], ModifierRegimeDto.prototype, "numeroAffiliationCnssEmployeur", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)("Le régime d'exigibilité de la TVA se choisit parmi ses valeurs · null n'en est pas une. Omettez le champ pour le laisser inchangé."),
    (0, class_validator_1.IsEnum)(client_1.RegimeExigibiliteTva),
    __metadata("design:type", String)
], ModifierRegimeDto.prototype, "regimeExigibiliteTva", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateAutorisationDebitsTva !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ModifierRegimeDto.prototype, "dateAutorisationDebitsTva", void 0);
class ModifierMethodeCotisationsDto {
}
exports.ModifierMethodeCotisationsDto = ModifierMethodeCotisationsDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MethodeCotisations),
    __metadata("design:type", String)
], ModifierMethodeCotisationsDto.prototype, "methodeCotisations", void 0);
class ModifierMethodeInventaireStocksDto {
}
exports.ModifierMethodeInventaireStocksDto = ModifierMethodeInventaireStocksDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MethodeInventaireStocks),
    __metadata("design:type", String)
], ModifierMethodeInventaireStocksDto.prototype, "methodeInventaireStocks", void 0);
class ModifierDoubleRegardDto {
}
exports.ModifierDoubleRegardDto = ModifierDoubleRegardDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierDoubleRegardDto.prototype, "doubleRegardValidation", void 0);
class ModifierRefusClotureNonImprimeDto {
}
exports.ModifierRefusClotureNonImprimeDto = ModifierRefusClotureNonImprimeDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierRefusClotureNonImprimeDto.prototype, "refusClotureJournalNonImprime", void 0);
class ModifierLongueurCompteDto {
}
exports.ModifierLongueurCompteDto = ModifierLongueurCompteDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(3),
    (0, class_validator_1.Max)(13),
    __metadata("design:type", Number)
], ModifierLongueurCompteDto.prototype, "longueurCompte", void 0);
class ModifierModulesDto {
}
exports.ModifierModulesDto = ModifierModulesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsEnum)(client_1.ModuleOptionnel, { each: true }),
    __metadata("design:type", Array)
], ModifierModulesDto.prototype, "modulesActives", void 0);
class ModifierCreationCompteEnSaisieDto {
}
exports.ModifierCreationCompteEnSaisieDto = ModifierCreationCompteEnSaisieDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierCreationCompteEnSaisieDto.prototype, "creationCompteEnSaisie", void 0);
exports.SEUIL_ECART_REGLEMENT_MAX = 999_999_999_999_999;
class ModifierSeuilEcartReglementDto {
}
exports.ModifierSeuilEcartReglementDto = ModifierSeuilEcartReglementDto;
__decorate([
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }, { message: "Le seuil de l'écart de règlement est un montant au centime, ou vide pour le retirer." }),
    (0, class_validator_1.IsPositive)({ message: "Le seuil de l'écart de règlement est strictement positif · videz-le pour n'en fixer aucun." }),
    (0, class_validator_1.Max)(exports.SEUIL_ECART_REGLEMENT_MAX, {
        message: `Le seuil de l'écart de règlement est au plus ${exports.SEUIL_ECART_REGLEMENT_MAX.toLocaleString('fr-FR')}.`,
    }),
    __metadata("design:type", Object)
], ModifierSeuilEcartReglementDto.prototype, "seuilEcartReglement", void 0);
//# sourceMappingURL=parametres-dossier.dto.js.map