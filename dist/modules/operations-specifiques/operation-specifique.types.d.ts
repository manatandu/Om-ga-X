export type ModeMontant = {
    mode: 'PARAMETRE';
    parametre: string;
} | {
    mode: 'PROPORTION';
    parametre: string;
    taux: number | string;
} | {
    mode: 'COMPLEMENT';
} | {
    mode: 'ANNUITE';
    parametre: string;
    parametreDuree: string;
    parametreMois?: string;
};
export type SensLigne = 'DEBIT' | 'CREDIT';
export interface LigneModele {
    compte: string;
    exclusions?: string[];
    libelle: string;
    sens: SensLigne;
    montant: ModeMontant;
    auChoix?: boolean;
    note?: string;
}
export type TypeParametre = 'MONTANT' | 'TAUX' | 'DUREE_ANNEES' | 'MOIS';
export interface ParametreModele {
    nom: string;
    libelle: string;
    type: TypeParametre;
    defaut?: number;
    aide?: string;
}
export interface ModeleEcriture {
    code: string;
    libelle: string;
    objet: string;
    source: string;
    applicationGuide?: string;
    parametres: ParametreModele[];
    lignes: LigneModele[];
    anomalie?: string;
    aExtourner?: boolean;
    exigeDroitDAgir?: boolean;
    renvoiModule?: {
        fenetre: string;
        geste: string;
        motif?: string;
    };
}
export type PorteeOperation = 'ASSOCIATIONS' | 'PROJETS' | 'TOUS';
export interface OperationSpecifique {
    code: string;
    libelle: string;
    source: string;
    portee: PorteeOperation;
    modeles: ModeleEcriture[];
    politiqueADecider?: string;
}
export interface LigneProposee {
    compteId: string | null;
    numero: string;
    intitule: string;
    libelle: string;
    debit: number;
    credit: number;
    note?: string;
    choixRequis?: {
        racine: string;
        candidats: {
            id: string;
            numero: string;
            intitule: string;
        }[];
    };
}
export interface EcritureProposee {
    modele: string;
    libelle: string;
    objet: string;
    source: string;
    applicationGuide?: string;
    anomalie?: string;
    aExtourner?: boolean;
    lignes: LigneProposee[];
    totalDebit: number;
    totalCredit: number;
    equilibree: boolean;
    comptesIntrouvables: {
        compte: string;
        libelle: string;
    }[];
}
