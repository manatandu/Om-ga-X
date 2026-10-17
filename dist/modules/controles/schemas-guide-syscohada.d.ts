export interface SchemaAtteste {
    source: string;
    titre: string;
    debits: string[];
    credits: string[];
    transition?: boolean;
}
export declare const SCHEMAS_GUIDE_SYSCOHADA: SchemaAtteste[];
