export interface RegleCompte {
    numero: string;
    intitule: string;
    exclusions: string | null;
    comptesAUtiliser: string[];
    renvoisDiscordants: {
        numero: string;
        intituleCite: string;
        intitulePlan: string;
    }[];
    elementsDeControle: string | null;
}
export declare const REGLES_COMPTES_SYCEBNL: RegleCompte[];
