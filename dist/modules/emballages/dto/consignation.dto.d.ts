import { NatureObjetConsigne, SensConsignation } from '@prisma/client';
import type { ModeDenouement } from '../consignation';
export declare class CreerConsignationDto {
    tiersId: string;
    sens: SensConsignation;
    nature: NatureObjetConsigne;
    designation: string;
    quantite?: number;
    dateConsignation: string;
    montant: number;
}
export declare class DenouerConsignationDto {
    mode: ModeDenouement;
    dateDenouement: string;
    prixDeReprise?: number;
}
export declare class RattacherEcritureConsignationDto {
    ecritureId: string;
}
