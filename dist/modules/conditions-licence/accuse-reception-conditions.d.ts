import { AcceptationEnregistree, DetailCommande } from './acceptation-conditions';
export declare function horodatageKinshasa(instant: Date): string;
export declare function nomPieceJointeConditions(version?: number): string;
export declare function lignesDeLaCommande(c: DetailCommande | null): string[];
export declare function accuseReceptionConditions(acceptation: AcceptationEnregistree, dossier: string): {
    sujet: string;
    corps: string;
    pieceJointe: {
        nom: string;
        texte: string;
    };
};
