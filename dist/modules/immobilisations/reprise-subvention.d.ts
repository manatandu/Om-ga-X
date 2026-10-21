export type NatureReprise = 'EXERCICE' | 'SORTIE';
export type RegleReprise = 'SUBVENTION' | 'DONS_LEGS' | 'USUFRUIT' | 'A_VENDRE';
export interface FondsRepris {
    racine: string;
    exclure?: string;
    regle: RegleReprise;
    compteReprise: string;
    libelle: string;
}
export declare const FONDS_REPRIS: Record<'SYSCOHADA' | 'SYCEBNL', readonly FondsRepris[]>;
export declare function fondsDuCompte(referentiel: 'SYSCOHADA' | 'SYCEBNL', numero: string): FondsRepris | undefined;
export interface EntreeReprise {
    subvention: number;
    valeurOrigine: number;
    amortissable: boolean;
    dotationExercice: number | null;
    cumulRepris: number;
    sorti: boolean;
    dureeInalienabiliteAns?: number | null;
    regle?: RegleReprise;
    depreciationExercice?: number;
    reductions?: number;
    resteAAmortirOuverture?: number | null;
    derogatoireNetExercice?: number;
    exercicesRepris?: number;
    methodeDepreciation?: 'VNC_MINOREE_DES_SUBVENTIONS' | 'VNC_ENTIERE' | null;
}
export interface PropositionReprise {
    montant: number;
    nature: NatureReprise;
    motif: string | null;
    reserve?: string | null;
}
export declare const RESERVE_METHODE_DEPRECIATION_NON_DECLAREE = "Le bien est d\u00E9pr\u00E9ci\u00E9 sur l'exercice et le dossier n'a pas d\u00E9clar\u00E9 sa m\u00E9thode de d\u00E9pr\u00E9ciation des biens subventionn\u00E9s (AUDCIF Titre VIII ch. 17 \u00A7 4.6) \u00B7 aucune reprise n'est ajout\u00E9e pour la d\u00E9pr\u00E9ciation.";
export declare function proposerReprise(e: EntreeReprise): PropositionReprise;
