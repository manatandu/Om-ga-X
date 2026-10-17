export declare const COMPTES_RESULTAT_DE_L_EXERCICE: readonly ["131", "132", "133", "134", "135", "136", "137", "138", "139"];
export declare function estCompteDuResultatDeLExercice(numero: string): boolean;
export declare function estResultatEnInstanceDAffectation(numero: string): boolean;
export declare function resultatEnInstanceAuBilan(lignes: readonly {
    numero: string;
    solde: number;
}[]): number | null;
export declare function resultatAuBilan(resultatClasses678: number, resultatCompte13: number): number;
export declare function resultatDeLExerciceAuxClassesDeGestion(gestionNonSoldee: boolean, mouvementPropre13: boolean): boolean;
export interface LigneLueParLaRegleDuResultat {
    solde: number;
    mouvementDebit: number;
    mouvementCredit: number;
}
export interface PartsDuResultatAuBilan {
    resultatDeLExercice: number;
    resultatAnterieurNonAffecte: number;
}
export declare function partsDuResultatAuBilan(resultatClasses678: number, resultatCompte13: number, lignes678: readonly Pick<LigneLueParLaRegleDuResultat, 'solde'>[], lignes13: readonly Pick<LigneLueParLaRegleDuResultat, 'mouvementDebit' | 'mouvementCredit'>[]): PartsDuResultatAuBilan;
export interface ResultatAnterieurNonVire {
    montant: number;
    poste: string;
    motif: string;
}
export declare function resultatAnterieurNonVire(exerciceCloture: boolean, resultatAnterieurNonAffecte: number, poste: string, referentiel: 'SYSCOHADA' | 'SYCEBNL'): ResultatAnterieurNonVire | null;
export declare function resultatAnterieurNonVireDuComparatif(provenanceComparatif: string | null, exercicePrecedentCloture: boolean, resultatAnterieurNonAffecteN1: number, poste: string, referentiel: 'SYSCOHADA' | 'SYCEBNL'): ResultatAnterieurNonVire | null;
