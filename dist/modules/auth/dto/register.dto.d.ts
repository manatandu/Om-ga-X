import { JeuEtatsFinanciersSycebnl, Referentiel, SystemeComptableSyscohada, TypeLicence } from '@prisma/client';
export declare class RegisterDto {
    nomEntite: string;
    referentiel: Referentiel;
    email: string;
    motDePasse: string;
    jeuEtatsFinanciersSycebnl?: JeuEtatsFinanciersSycebnl;
    systemeComptableSyscohada?: SystemeComptableSyscohada;
    typeLicence?: TypeLicence;
    activite?: string;
    adresse?: string;
    ville?: string;
    pays?: string;
    telephone?: string;
    dateDebutExercice?: string;
    dateFinExercice?: string;
}
