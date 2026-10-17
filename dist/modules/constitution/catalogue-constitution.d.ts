import { FormeJuridiqueEbnl } from '@prisma/client';
export type Fondement = 'LOI' | 'PRATIQUE_ADMINISTRATIVE' | 'USAGE_SANS_BASE_LEGALE';
export interface PieceConstitution {
    cle: string;
    libelle: string;
    fondement: Fondement;
    source: string;
    reserve?: string;
}
export interface EtapeConstitution {
    cle: string;
    libelle: string;
    destinataire: string;
    source: string;
    pieces: PieceConstitution[];
    produit: string;
}
export declare function motifHorsParcours(formeJuridique: FormeJuridiqueEbnl): string | null;
export declare function parcoursConstitution(formeJuridique: FormeJuridiqueEbnl, droitEtranger: boolean): EtapeConstitution[];
export declare function champsIdentificationDeLaForme(formeJuridique: FormeJuridiqueEbnl, droitEtranger: boolean): {
    enregistrementSecteur: boolean;
    certificatPlan: boolean;
};
export declare function piecesDuParcours(formeJuridique: FormeJuridiqueEbnl, droitEtranger: boolean): PieceConstitution[];
