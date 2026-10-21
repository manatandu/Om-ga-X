import { JeuNotesAnnexes } from '@prisma/client';
export declare const NOTE_DU_TRANSFERT: Partial<Record<JeuNotesAnnexes, string>>;
export interface MouvementDeTransfert {
    nature: 'TRANSFERT_REPRISE' | 'TRANSFERT_DOTATION';
    montant: number;
    numeroCompteDepreciation: string;
    numeroContrepartie: string;
    valide: boolean;
}
export declare function phrasesTransfertDepreciation(mouvements: MouvementDeTransfert[], ligneDe: (numero: string) => string | null): string[];
export declare function rubriqueQuiLit(numero: string, rubriques: Array<{
    libelle: string;
    comptes?: string[];
    totalDeRubriques?: number[];
}>, rattaches: Array<{
    libelle: string;
    comptesRattaches?: string[];
}>): string | null;
