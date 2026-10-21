export interface LigneAReimputer {
    id: string;
    compteId: string;
    compteNumero: string;
    debit: number;
    credit: number;
    lettre: string | null;
    lettrageId: string | null;
    rapprochementId: string | null;
    tauxTvaId: string | null;
    statut: 'BROUILLARD' | 'VALIDEE' | 'SITUATION';
    exerciceClos: boolean;
    estGenereeParCloture: boolean;
    tenueParImmobilisation: boolean;
}
export declare function motifRefusLigne(l: LigneAReimputer, compteCibleId: string): string | null;
export interface LignePassee {
    compteId: string;
    debit: number;
    credit: number;
    signeAnalytique: 1 | -1;
}
export declare function lignesDeReimputation(l: {
    compteId: string;
    debit: number;
    credit: number;
}, compteCibleId: string): LignePassee[];
export declare function motifRefusFusionComptes(source: {
    id: string;
    numero: string;
    classe: string;
    typeCompte: string;
}, cible: {
    id: string;
    numero: string;
    classe: string;
    typeCompte: string;
    estActif: boolean;
}): string | null;
export declare function dateDansExercice(aujourdhui: Date, exercice: {
    dateDebut: Date;
    dateFin: Date;
}): Date;
