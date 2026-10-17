import { DecisionEcartInventaire, ModeComparaisonCaisse, RoleMembreInventaire, StatutCampagneInventaire } from '@prisma/client';
export declare const TITRE_FICHES_DE_COMPTAGE = "Fiches de comptage";
export declare const TITRE_PV_INVENTAIRE = "Proc\u00E8s-verbal d'inventaire physique";
export declare const TITRE_PV_CAISSE = "Proc\u00E8s-verbal de comptage de caisse";
export declare const COLONNES_A_REMPLIR: readonly ["Quantité comptée", "Valeur d'inventaire", "Pièce de référence"];
export interface MembreEdition {
    nom: string;
    fonction: string | null;
}
export interface SousCommissionEdition {
    id: string;
    nom: string;
    perimetre: string | null;
    inventoriants: MembreEdition[];
    temoins: MembreEdition[];
}
export interface CampagneEdition {
    id: string;
    libelle: string;
    dateInventaire: Date;
    statut: StatutCampagneInventaire;
    instructions: string | null;
    exercice: {
        dateDebut: Date;
        dateFin: Date;
        dateArreteComptes: Date | null;
    };
}
export interface MembreLu {
    nom: string;
    fonction: string | null;
    role: RoleMembreInventaire;
}
export interface SousCommissionLue {
    id: string;
    nom: string;
    perimetre: string | null;
    membres: MembreLu[];
}
export interface FicheLue {
    id: string;
    designation: string;
    emplacement: string | null;
    uniteMesure: string | null;
    quantiteComptee: unknown;
    valeurInventaire: unknown;
    referencePiece: string | null;
    sousCommissionId: string | null;
    compte: {
        numero: string;
        intitule: string;
    };
}
export interface EcartLu {
    compte: {
        numero: string;
        intitule: string;
    };
    valeurInventaire: unknown;
    soldeComptable: unknown;
    ecart: unknown;
    nombreFiches: number;
    rapprocheLe: Date;
    decision: DecisionEcartInventaire | null;
    responsable: string | null;
    explication: string | null;
    arbitreLe: Date | null;
}
export declare function sousCommissionPourEdition(sc: SousCommissionLue): SousCommissionEdition;
export interface LigneFicheVierge {
    ficheId: string;
    designation: string;
    compte: string;
    lieu: string;
    unite: string | null;
}
export interface SectionFichesVierges {
    sousCommission: SousCommissionEdition | null;
    lignes: LigneFicheVierge[];
}
export interface EditionFichesVierges {
    nature: 'FICHES_DE_COMPTAGE';
    titre: string;
    campagne: CampagneEdition;
    perimetre: string;
    colonnesARemplir: readonly string[];
    sections: SectionFichesVierges[];
    nombreFiches: number;
    dejaComptees: number;
}
export declare function editionFichesVierges(entree: {
    campagne: CampagneEdition;
    sousCommissions: SousCommissionLue[];
    fiches: FicheLue[];
    sousCommissionId?: string | null;
}): EditionFichesVierges;
export interface LigneReleve {
    designation: string;
    compte: string;
    lieu: string;
    unite: string | null;
    quantite: number | null;
    valeur: number | null;
    piece: string | null;
    sousCommission: string | null;
}
export interface TotalCompte {
    compte: string;
    nombreFiches: number;
    valeurInventaire: number | null;
    nonValorisees: number;
}
export interface EcartEdition {
    compte: string;
    valeurInventaire: number;
    soldeComptable: number;
    ecart: number;
    sens: 'MANQUANT' | 'EXCEDENT' | 'SANS_ECART';
    nombreFiches: number;
    rapprocheLe: Date;
    decision: DecisionEcartInventaire | null;
    responsable: string | null;
    explication: string | null;
    arbitreLe: Date | null;
}
export interface CaisseCompteeEdition {
    pvId: string;
    caisse: string;
    dateComptage: Date;
    heureComptage: string | null;
    sousCommission: string;
    unite: string | null;
    especesComptees: number;
    soldeComptable: number;
    ecart: number;
}
export interface Signataire extends MembreEdition {
    sousCommission: string;
}
export interface EditionPvInventaire {
    nature: 'PROCES_VERBAL_INVENTAIRE';
    titre: string;
    campagne: CampagneEdition;
    etabli: {
        le: Date;
        par: string;
    } | null;
    sousCommissions: SousCommissionEdition[];
    releve: LigneReleve[];
    totauxParCompte: TotalCompte[];
    rapprochee: boolean;
    ecarts: EcartEdition[];
    caisses: CaisseCompteeEdition[];
    signataires: {
        inventoriants: Signataire[];
        temoins: Signataire[];
    };
    mentions: string[];
}
export interface PvCaisseLuPourResume {
    id: string;
    dateComptage: Date;
    heureComptage: string | null;
    especesComptees: unknown;
    soldeComptableFige: unknown;
    ecart: unknown;
    compte: {
        numero: string;
        intitule: string;
    };
    sousCommission: {
        nom: string;
    };
    unite: string | null;
}
export declare function editionPvInventaire(entree: {
    campagne: CampagneEdition;
    etabli: {
        le: Date;
        par: string;
    } | null;
    sousCommissions: SousCommissionLue[];
    fiches: FicheLue[];
    ecarts: EcartLu[];
    pvCaisses: PvCaisseLuPourResume[];
}): EditionPvInventaire;
export interface PvCaissePresente {
    id: string;
    dateComptage: Date;
    heureComptage: string | null;
    especesComptees: unknown;
    soldeComptableFige: unknown;
    ecart: unknown;
    soldeALaCloture: unknown;
    mouvementsValeurAvantCloture: unknown;
    encaissementsPosterieurs: unknown;
    decaissementsPosterieurs: unknown;
    mouvementsPosterieurs: number | null;
    modeComparaison: ModeComparaisonCaisse;
    attestationEtablieLe: Date | null;
    attestationPar: string | null;
    observations: string | null;
    etabliLe: Date;
    coupures: {
        valeurUnitaire: unknown;
        nombre: number;
    }[];
    compte: {
        numero: string;
        intitule: string;
    };
    dateCloture: Date;
    unite: string | null;
    compteApresLaCloture: boolean;
    reconstitutionManquante: boolean;
    especesReconstitueesALaCloture: number | null;
    mentions: string[];
}
export interface EditionPvCaisse {
    nature: 'PROCES_VERBAL_CAISSE';
    titre: string;
    campagne: CampagneEdition;
    pvId: string;
    caisse: string;
    sousCommission: SousCommissionEdition;
    dateComptage: Date;
    heureComptage: string | null;
    unite: string | null;
    modeComparaison: ModeComparaisonCaisse;
    especesComptees: number;
    soldeComptable: number;
    ecart: number;
    reconstitution: {
        dateCloture: Date;
        soldeALaCloture: number;
        mouvementsValeurAvantCloture: number | null;
        encaissementsPosterieurs: number;
        decaissementsPosterieurs: number;
        mouvementsPosterieurs: number | null;
        especesReconstitueesALaCloture: number | null;
    } | null;
    compteApresLaCloture: boolean;
    reconstitutionManquante: boolean;
    coupures: {
        valeurUnitaire: number;
        nombre: number;
        total: number;
    }[];
    totalCoupures: number | null;
    attestation: {
        le: Date;
        par: string | null;
    } | null;
    observations: string | null;
    etabli: {
        le: Date;
        par: string;
    };
    mentions: string[];
}
export declare function editionPvCaisse(entree: {
    campagne: CampagneEdition;
    pv: PvCaissePresente;
    sousCommission: SousCommissionLue;
    etabliPar: string;
}): EditionPvCaisse;
