import { JeuEtatsFinanciersSycebnl, Referentiel, StatutLicence, SystemeComptableSyscohada, TypeLicence } from '@prisma/client';
export declare class CreerCabinetDto {
    nomEntite: string;
    emailAdmin: string;
    referentiel?: Referentiel;
    jeuEtatsFinanciersSycebnl?: JeuEtatsFinanciersSycebnl;
    systemeComptableSyscohada?: SystemeComptableSyscohada;
    typeLicence?: TypeLicence;
    dateExpiration?: string;
    activite?: string;
    adresse?: string;
    ville?: string;
    pays?: string;
    telephone?: string;
    dateDebutExercice?: string;
    dateFinExercice?: string;
    dossierMereId?: string;
}
export declare class ModifierLicenceDto {
    type?: TypeLicence;
    statut?: StatutLicence;
    dateExpiration?: string;
}
export declare class ModifierGroupeDto {
    dossierMereId?: string | null;
    plafondCellules?: number | null;
}
export declare class ReinitialiserAdminDto {
    email: string;
}
export declare class PreparerDemonstrationDto {
    nomEntite?: string;
    email: string;
    motDePasse: string;
    referentiel?: Referentiel;
}
export declare class EmettreLicenceSurSiteDto {
    titulaire: string;
    empreinteMachine: string;
    finMaintenance: string;
    expiration?: string | null;
    dossiersMax: number;
}
export declare class FixerPrixFormuleDto {
    prixMensuelUsd?: number | null;
    prixAnnuelUsd?: number | null;
}
export declare class EnregistrerAbonnementDto {
    cabinetId: string;
    formuleCode: string;
    options: string[];
    dossiersSupplementaires: number;
    periodicite: 'MENSUELLE' | 'ANNUELLE';
    debut: string;
    essai: boolean;
    tiersId: string;
}
export declare class ActiverAbonnementDto {
    actif: boolean;
}
export declare class FacturerAbonnementsDto {
    periode: string;
    dateFacture: string;
    tauxTvaId?: string | null;
    envoyer?: boolean;
}
export declare class EnvoyerParCourrielDto {
    destinataire?: string | null;
    destinataireNom?: string | null;
}
export declare class MarquerPayeeDto {
    payeeLe: string;
}
export declare class SupprimerEssaiEchuDto {
    confirmation: string;
}
