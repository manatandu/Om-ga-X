import { FormeJuridiqueEbnl, FormeJuridiqueSyscohada, JeuEtatsFinanciersSycebnl, MethodeCotisations, RegimeExigibiliteTva, SystemeComptableSyscohada, MethodeInventaireStocks, ModuleOptionnel } from '@prisma/client';
export declare class ModifierJeuEtatsDto {
    jeuEtatsFinanciersSycebnl: JeuEtatsFinanciersSycebnl;
}
export declare class ModifierSystemeSyscohadaDto {
    systemeComptableSyscohada: SystemeComptableSyscohada;
}
export declare class ModifierCoordonneesDto {
    nom?: string;
    activite?: string | null;
    codeActivitePrincipale?: string | null;
    adresse?: string | null;
    ville?: string | null;
    pays?: string | null;
    telephone?: string | null;
    email?: string | null;
    siteWeb?: string | null;
    capitalSocial?: number | null;
    capitalVariable?: boolean;
    deviseFonctionnelle?: string | null;
}
export declare class ModifierIdentiteDto {
    numeroImpot?: string;
    idNat?: string;
    rccm?: string;
    numeroDeclarationActivite?: string;
    locataireGerantFonds?: ReponseFait;
    numeroRegistreCooperatives?: string;
    varianteCooperative?: 'SCOOPS' | 'COOP_CA' | 'PAS_ENCORE_DIT';
    modeAdministrationSa?: 'CONSEIL_ADMINISTRATION' | 'ADMINISTRATEUR_GENERAL' | 'PAS_ENCORE_DIT';
    associeUnique?: ReponseFait;
    entreprisePortefeuilleEtat?: ReponseFait;
    dateDissolution?: string;
    liquidateurs?: string;
    dateNominationLiquidateur?: string;
    regimeLiquidation?: 'AMIABLE_STATUTAIRE' | 'ARTICLE_223_1' | 'ARTICLE_223_2_JUDICIAIRE' | 'PROCEDURE_COLLECTIVE' | 'PAS_ENCORE_DIT';
    associeUniquePersonneMorale?: ReponseFait;
    dateClotureLiquidation?: string | null;
    dateDeclarationCotisationActivite?: string | null;
    dateDeclarationCotisationLiquidation?: string | null;
    portefeuilleSecteurMinier?: ReponseFait;
    quotePartEtatCapital?: number | null;
    sourceQuotePartEtat?: string | null;
    actePersonnaliteJuridique?: string;
    dateActePersonnalite?: string;
    numeroEnregistrementSecteur?: string;
    certificatEnregistrementPlan?: string;
    attestationExemptionIs?: string;
    dateAttestationExemptionIs?: string;
}
export declare class ModifierFormeJuridiqueDto {
    formeJuridique: FormeJuridiqueEbnl;
    droitEtranger?: boolean;
}
export declare class ModifierFormeSyscohadaDto {
    formeJuridiqueSyscohada: FormeJuridiqueSyscohada;
    dateEffetTransformation?: string;
}
export declare const REPONSES_FAIT: readonly ["OUI", "NON", "PAS_ENCORE_DIT"];
export type ReponseFait = (typeof REPONSES_FAIT)[number];
export declare class ModifierRegimeDto {
    assujettiTva?: boolean;
    reponseAssujettissementTva?: ReponseFait;
    venteBiensServices?: ReponseFait;
    dateOptionTva?: string;
    effectifPermanent?: number;
    numeroAffiliationCnssEmployeur?: string | null;
    regimeExigibiliteTva?: RegimeExigibiliteTva;
    dateAutorisationDebitsTva?: string;
}
export declare class ModifierMethodeCotisationsDto {
    methodeCotisations: MethodeCotisations;
}
export declare class ModifierMethodeInventaireStocksDto {
    methodeInventaireStocks: MethodeInventaireStocks;
}
export declare class ModifierDoubleRegardDto {
    doubleRegardValidation: boolean;
}
export declare class ModifierRefusClotureNonImprimeDto {
    refusClotureJournalNonImprime: boolean;
}
export declare class ModifierLongueurCompteDto {
    longueurCompte: number;
}
export declare class ModifierModulesDto {
    modulesActives: ModuleOptionnel[];
}
export declare class ModifierCreationCompteEnSaisieDto {
    creationCompteEnSaisie: boolean;
}
export declare const SEUIL_ECART_REGLEMENT_MAX = 999999999999999;
export declare class ModifierSeuilEcartReglementDto {
    seuilEcartReglement: number | null;
}
