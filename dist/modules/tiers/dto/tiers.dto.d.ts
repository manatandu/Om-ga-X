import { TypeTiers } from '@prisma/client';
export declare class CreerTiersDto {
    type: TypeTiers;
    code: string;
    nom: string;
    modeleReglementId?: string;
    modeReglementId?: string;
    modeleImpressionExtraitId?: string;
    modeleImpressionReglementId?: string;
    modeleImpressionRappelId?: string;
    creerCompteIndividuel?: boolean;
    numeroCompte?: string;
    adresse?: string;
    boitePostale?: string;
    ville?: string;
    pays?: string;
    telephone?: string;
    email?: string;
    numeroImpot?: string;
    contact?: string;
    validationAutomatiqueEcheances?: boolean;
    qualite?: string;
    celluleGroupeId?: string;
    autoriseTvaDebits?: boolean;
    referenceAutorisationDebits?: string;
    dateEffetAutorisationDebits?: string;
    dateRevocationAutorisationDebits?: string;
}
export declare class ModifierTiersDto {
    nom?: string;
    estActif?: boolean;
    modeleReglementId?: string | null;
    modeReglementId?: string | null;
    modeleImpressionExtraitId?: string | null;
    modeleImpressionReglementId?: string | null;
    modeleImpressionRappelId?: string | null;
    adresse?: string;
    boitePostale?: string;
    ville?: string;
    pays?: string;
    telephone?: string;
    email?: string;
    numeroImpot?: string;
    contact?: string;
    qualite?: string | null;
    celluleGroupeId?: string | null;
    autoriseTvaDebits?: boolean;
    validationAutomatiqueEcheances?: boolean;
    referenceAutorisationDebits?: string | null;
    dateEffetAutorisationDebits?: string | null;
    dateRevocationAutorisationDebits?: string | null;
}
export declare class NumeroProposeDto {
    type: TypeTiers;
}
export declare class CompletionPanopliesDto {
    apres?: string;
}
export declare class RattacherCompteDto {
    compteId: string;
    estPrincipal?: boolean;
}
