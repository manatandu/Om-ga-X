import { StatutLicence, TypeLicence } from '@prisma/client';
export interface LicenceReflet {
    type: TypeLicence;
    statut: StatutLicence;
    dateExpiration: Date | null;
}
export declare function licenceDeCellule(mere: LicenceReflet | null | undefined): LicenceReflet | null;
export declare function refuserCelluleEditeur(type: TypeLicence | null | undefined): void;
