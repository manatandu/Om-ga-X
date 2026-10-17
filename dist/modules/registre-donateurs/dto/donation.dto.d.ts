import { ModeLiberation, NatureLiberalite, TypeDonateur } from '@prisma/client';
export declare class InscrireDonationDto {
    dateOperation: string;
    nature: NatureLiberalite;
    typeDonateur: TypeDonateur;
    nom?: string;
    prenoms?: string;
    domicile?: string;
    denomination?: string;
    numeroImmatriculation?: string;
    numeroIdentificationFiscale?: string;
    adresseSiegeSocial?: string;
    adresseElectronique?: string;
    montant: number;
    modeLiberation: ModeLiberation;
    designationNature?: string;
    ecritureId?: string;
}
export declare class ModifierDonationDto {
    nom?: string;
    prenoms?: string;
    domicile?: string;
    denomination?: string;
    numeroImmatriculation?: string;
    numeroIdentificationFiscale?: string;
    adresseSiegeSocial?: string;
    adresseElectronique?: string;
    designationNature?: string;
    ecritureId?: string;
}
export declare class SignerDonationDto {
    signeePar: string;
}
export declare class AnnulerDonationDto {
    motifAnnulation: string;
}
export declare class FiltreRegistreDto {
    exerciceId?: string;
    recherche?: string;
    masquerAnnulees?: boolean;
}
