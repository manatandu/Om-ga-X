import { CycleQuestionnaire, Referentiel } from '@prisma/client';
export type OrigineItem = 'CPCC' | 'VMG';
export type FormeItem = 'OUI_NON' | 'DONNEE' | 'TEXTE_LIBRE' | 'TRAVAIL';
export interface ItemQuestionnaire {
    code: string;
    cycle: CycleQuestionnaire;
    libelle: string;
    origine: OrigineItem;
    forme: FormeItem;
    polariteException?: 'OUI' | 'NON';
    ouvertPar?: {
        code: string;
        reponse: 'OUI' | 'NON';
    };
    objets?: string[];
    source?: string;
    fondement?: string;
    referentiel?: Referentiel;
}
export declare const ITEMS_QUESTIONNAIRE: readonly ItemQuestionnaire[];
export declare const ITEM_PAR_CODE: Map<string, ItemQuestionnaire>;
