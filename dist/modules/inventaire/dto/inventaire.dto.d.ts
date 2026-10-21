import { DecisionEcartInventaire, ModeComparaisonCaisse, RoleMembreInventaire } from '@prisma/client';
export declare class CreerCampagneDto {
    exerciceId: string;
    dateInventaire: string;
    libelle: string;
    instructions?: string;
}
export declare class ModifierCampagneDto {
    libelle?: string;
    instructions?: string;
}
export declare class AjouterSousCommissionDto {
    nom: string;
    perimetre?: string;
}
export declare class AjouterMembreDto {
    nom: string;
    fonction?: string;
    role: RoleMembreInventaire;
}
export declare class CreerFicheDto {
    compteId: string;
    sousCommissionId?: string;
    designation: string;
    emplacement?: string;
    uniteMesure?: string;
}
export declare class SaisirComptageDto {
    quantiteComptee?: number;
    valeurInventaire?: number;
    referencePiece?: string;
    emplacement?: string;
    sousCommissionId?: string;
}
export declare class ArbitrerEcartDto {
    decision: DecisionEcartInventaire;
    responsable?: string;
    explication?: string;
}
export declare class RattacherEcritureEcartDto {
    ecritureId: string;
}
export declare class EtablirProcesVerbalDto {
    dateEtablissement?: string;
}
export declare class CoupureDto {
    valeurUnitaire: number;
    nombre: number;
}
export declare class EtablirPvCaisseDto {
    compteId: string;
    sousCommissionId: string;
    dateComptage: string;
    heureComptage?: string;
    modeComparaison: ModeComparaisonCaisse;
    deviseId?: string | null;
    especesComptees: number;
    coupures?: CoupureDto[];
    attestationEtablieLe?: string;
    attestationPar?: string;
    observations?: string;
}
