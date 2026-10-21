export type Ref = 'SYSCOHADA' | 'SYCEBNL';
export type NatureReduction = 'REMBOURSEMENT' | 'NON_VERSEE';
export declare function motifRefusCompteSubvention(numero: string, estDetail: boolean): string | null;
export declare const CONTREPARTIES_OCTROI_PROPOSEES: Record<Ref, readonly string[]>;
export declare function motifRefusContrepartieOctroi(referentiel: Ref, numero: string): string | null;
export declare function ventilerAuProrata(montant: number, biens: readonly {
    id: string;
    valeurOrigine: number;
}[]): {
    immobilisationId: string;
    montant: number;
}[];
export declare function motifRefusSansVentilation(o: {
    principalAvecComposants: boolean;
    composantsRattaches: number;
    motif: string | null | undefined;
}): string | null;
export declare function motifRefusContrepartieReduction(referentiel: Ref, nature: NatureReduction, numero: string): string | null;
export declare function contrepartieRemboursementProposee(referentiel: Ref): string | null;
export declare function motifRefusReduction(o: {
    montant: number;
    resteRattachement: number;
    soldeNonReprisBien: number;
}): string | null;
export declare function lignesReduction(o: {
    nature: NatureReduction;
    montant: number;
    compte14Id: string;
    contrepartieId: string;
    compte6515Id?: string;
    compte799Id?: string;
}): {
    compteId: string;
    debit: number;
    credit: number;
}[];
export declare const COMPTE_PERTES_AUTRES_DEBITEURS = "65150000";
export declare const COMPTE_REPRISE_SUBVENTION = "79900000";
