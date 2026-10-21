import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MaintenanceImmobilisationsService } from './maintenance-immobilisations.service';
import { ParametresRenumerotationDto } from './dto/maintenance-immobilisations.dto';
export declare class MaintenanceImmobilisationsController {
    private readonly maintenance;
    constructor(maintenance: MaintenanceImmobilisationsService);
    apercu(user: AuthenticatedUser, parametres: ParametresRenumerotationDto): Promise<{
        nombre: number;
        aChanger: number;
        attributions: import("./maintenance-immobilisations").Attribution[];
        tronque: boolean;
        motifRefus: string | null;
    }>;
    renumeroter(user: AuthenticatedUser, parametres: ParametresRenumerotationDto): Promise<{
        renumerotes: number;
        inchanges: number;
    }>;
    lire(user: AuthenticatedUser, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateFin: string;
        };
        comptesBien: {
            lignesSansFiche: {
                nombre: number;
                montant: number;
            };
            numero: string;
            intitule: string;
            registre: number;
            balance: number;
            ecart: number;
        }[];
        comptesAmortissement: import("./maintenance-immobilisations").LigneRapprochement[];
        dotationsAPasser: {
            nombre: number;
            montant: number;
        };
        reclassesApresLaCloture: {
            designation: string;
            date: string;
            ancienCompte: string;
            compteActuel: string;
        }[];
        reclassesApresLaClotureTotal: number;
        numerosEnDouble: {
            numero: string;
            fiches: {
                id: string;
                designation: string;
            }[];
        }[];
        numerosEnDoubleTotal: number;
        biensEnServiceSansNumero: number;
    }>;
}
