export type TypeColonneNote = 'EXERCICE_N' | 'EXERCICE_N1' | 'VARIATION_VALEUR' | 'VARIATION_POURCENT' | 'VARIATION_VALEUR_ABSOLUE' | 'OUVERTURE' | 'AUGMENTATIONS' | 'DIMINUTIONS' | 'CLOTURE' | 'VIREMENTS_AUGMENTATION' | 'VIREMENTS_DIMINUTION' | 'REEVALUATION' | 'AUGMENTATION_EXPLOITATION' | 'AUGMENTATION_FINANCIERE' | 'AUGMENTATION_HAO' | 'DIMINUTION_EXPLOITATION' | 'DIMINUTION_FINANCIERE' | 'DIMINUTION_HAO' | 'ECHEANCE_1AN' | 'ECHEANCE_2ANS' | 'ECHEANCE_PLUS_2ANS' | 'LIBRE';
export type SensAccroissement = 'DEBIT' | 'CREDIT';
export interface ColonneNote {
    type: TypeColonneNote;
    libelle: string;
    saisieSurLigneChiffree?: boolean;
    porteLeRenvoi?: boolean;
    formuleSaisie?: {
        plus: number[];
        moins: number[];
    };
}
export type SensRubrique = 'DEBITEUR' | 'CREDITEUR';
export interface RubriqueNote {
    cle?: string;
    libelle: string;
    comptes?: string[];
    exclusions?: string[];
    sens?: SensRubrique;
    natureCreditrice?: boolean;
    presenterEnNegatif?: boolean;
    totalDeRubriques?: number[];
    moinsRubriques?: number[];
    subdivisionAttendue?: string;
    saisie?: boolean;
    sommeDesSaisies?: number[];
    repetable?: true;
    confronteSaisiesDe?: {
        cleRubrique: string;
        colonne: number;
    };
    renvoi?: string;
}
export interface SpecificationNote {
    code: string;
    sousTableau?: string;
    titre: string;
    colonnes: ColonneNote[];
    rubriques: RubriqueNote[];
    sensAccroissement?: SensAccroissement;
    commentaire?: string;
    renvoiOfficiel?: string;
    precisionEditeur?: string;
    renvoyeeDepuis?: string[];
    horsBalance?: boolean;
    applicableDOffice?: string;
}
export interface CompteDeRubrique {
    numero: string;
    intitule: string;
    montant: number;
}
export interface LigneNoteCalculee {
    cle?: string;
    rang?: number;
    libelle: string;
    montantN: number;
    montantN1?: number;
    variationValeur?: number;
    variationPourcent?: number;
    estTotal: boolean;
    enAttenteDeRattachement?: string;
    rattachementDuDossier?: boolean;
    comptesRattaches?: string[];
    valeurs?: Partial<Record<TypeColonneNote, number>>;
    ecartCloture?: number;
    echeanceNonVentilee?: number;
    natureNonVentilee?: {
        augmentation: number;
        diminution: number;
    };
    comptes: CompteDeRubrique[];
    renvoi?: string;
    saisie?: (string | number | null)[];
    saisieVerrouillee?: boolean;
    saisieLibre?: (string | number | null)[];
    ecartsSaisie?: EcartSaisieNote[];
}
export interface EcartSaisieNote {
    colonne: number;
    saisi: number | null;
    attendu: number;
}
export interface RubriqueEnAttente {
    cle: string;
    libelle: string;
    attendu: string;
}
export interface ConfrontationSaisies {
    ligne: string;
    colonne: string;
    sommeSaisie: number;
    montantBalance: number;
}
export interface NoteCalculee {
    code: string;
    sousTableau?: string;
    titre: string;
    titreNote?: string;
    colonnes: ColonneNote[];
    lignes: LigneNoteCalculee[];
    commentaire?: string;
    commentaireServi?: string[];
    renvoiOfficiel?: string;
    precisionEditeur?: string;
    renvoyeeDepuis?: string[];
    horsBalance: boolean;
    exerciceN1Disponible: boolean;
    applicable: boolean;
    rubriquesEnAttente: RubriqueEnAttente[];
    confrontations?: ConfrontationSaisies[];
    saisiesFormatAnterieur?: Array<{
        cleRubrique: string;
        rubrique: string;
        colonneAnterieure: string;
        nature: 'EFFECTIF' | 'MASSE_SALARIALE';
        valeur: string;
    }>;
}
