import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ImmobilisationService } from './immobilisation.service';
import { ParametresRenumerotation } from './maintenance-immobilisations';
export declare class MaintenanceImmobilisationsService {
    private readonly prisma;
    private readonly immobilisations;
    private readonly ecritures;
    constructor(prisma: PrismaService, immobilisations: ImmobilisationService, ecritures: EcritureService);
    apercuRenumerotation(tenantId: string, p: ParametresRenumerotation): Promise<{
        nombre: number;
        aChanger: number;
        attributions: import("./maintenance-immobilisations").Attribution[];
        tronque: boolean;
        motifRefus: string | null;
    }>;
    renumeroter(tenantId: string, p: ParametresRenumerotation): Promise<{
        renumerotes: number;
        inchanges: number;
    }>;
    private campagneOuverte;
    maintenance(tenantId: string, exerciceId: string): Promise<{
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
    private fichesANumeroter;
}
