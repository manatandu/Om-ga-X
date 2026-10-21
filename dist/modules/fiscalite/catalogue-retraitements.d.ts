import { SensRetraitementFiscal } from '@prisma/client';
export type AssiettePlafond = 'CHIFFRE_AFFAIRES' | 'CHARGE';
export interface DefinitionRetraitement {
    code: string;
    sens: SensRetraitementFiscal;
    libelle: string;
    aide: string;
    source: string;
    plafond?: {
        part: number;
        assiette: AssiettePlafond;
        enonce: string;
    };
    conditionResultatNetPositif?: {
        enonce: string;
        source: string;
    };
    assietteHorsPortee?: string;
    revenusDistribues?: string;
}
export declare const CODE_LIBRE = "AUTRE";
export declare const CATALOGUE_RETRAITEMENTS: DefinitionRetraitement[];
export declare const CODES_HORS_ARTICLE_73_5: Readonly<Record<string, string>>;
export declare const MENTION_ARTICLE_73_5 = "Dans une soci\u00E9t\u00E9 passible de l'IS, la charge r\u00E9int\u00E9gr\u00E9e est aussi un REVENU DISTRIBU\u00C9 (loi n\u00B0 23/053, art. 73, al. 2, 5\u00B0), qui porte la retenue de 20 % de l'art. 120 \u00B7 OmegaX ne la chiffre pas, la qualification reste au cabinet.";
export declare const RETRAITEMENT_PAR_CODE: Map<string, DefinitionRetraitement>;
