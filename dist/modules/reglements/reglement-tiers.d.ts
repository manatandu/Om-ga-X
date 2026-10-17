export type SensReglement = 'FOURNISSEUR' | 'CLIENT';
export declare const MOTIF_416_PAR_LE_MODULE = "se r\u00E8gle par \u00AB Recouvrement \u00BB dans \u00AB Cr\u00E9ances douteuses ou litigieuses \u00BB \u00B7 le module compte l\u2019encaissement dans le reste de la cr\u00E9ance.";
export declare function estEcheanceAReglerSur(numeroCompte: string, sens: SensReglement): boolean;
export declare function motifHorsEcheance(numeroCompte: string): string;
export declare function motifReglementAuDelaDuNet(numeroCompte: string, compte416: string, dateReclassement: string, net: number, montant: number): string | null;
export declare function avertissementCreanceReclassee(numeroCompte: string, compte416: string, dateReclassement: string): string;
export declare function montantDu(ligne: {
    debit: number;
    credit: number;
}, sens: SensReglement): number;
export interface LigneReglement {
    compteId: string;
    debit?: number;
    credit?: number;
    libelle: string;
}
export declare function lignesDuReglement(params: {
    sens: SensReglement;
    compteTiersId: string;
    compteTresorerieId: string;
    montant: number;
    libelle: string;
}): LigneReglement[];
export declare function motifRefusMontant(montant: number, du: number): string | null;
export declare function motifRefusImputationReglement(e: {
    sens: SensReglement;
    parts: ReadonlyArray<{
        ligneId: string;
        montant: number;
    }>;
    dus: ReadonlyMap<string, number>;
    montant: number;
    enDevise: boolean;
    reduite: boolean;
    ordreVirement: boolean;
    pieceImputation?: string | null;
}): string | null;
export declare function imputationImprimee(parts: ReadonlyArray<{
    reference: string;
    montant: number;
}>): string;
export declare function libellesDesParts(base: string, factures: ReadonlyArray<{
    id: string;
    reference: string;
}>): Map<string, string>;
export declare function lignesDuReglementImpute(params: {
    compteTiersId: string;
    compteTresorerieId: string;
    parts: ReadonlyArray<{
        montant: number;
        libelle: string;
    }>;
    libelle: string;
}): LigneReglement[];
