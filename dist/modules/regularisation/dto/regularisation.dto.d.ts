import type { NatureTiersRattachement } from '../regularisation.service';
import { PeriodiciteAbonnement, TypeRegularisation } from '@prisma/client';
export declare class CreerRegularisationDto {
    exerciceId: string;
    type: TypeRegularisation;
    libelle: string;
    compteChargeProduitId: string;
    compteDifferId?: string;
    montantTotal: number;
    periodeDebut: string;
    periodeFin: string;
    journalId?: string;
    montantDiffere?: number;
    natureTiers?: NatureTiersRattachement;
    compteEmpruntId?: string;
    montantTva?: number;
}
export declare class CreerAbonnementDto {
    code: string;
    intitule: string;
    journalId: string;
    compteDebitId: string;
    compteCreditId: string;
    periodicite: PeriodiciteAbonnement;
    dateDebut: string;
    dateFin: string;
    montant: number;
}
export declare class ModifierAbonnementDto {
    intitule?: string;
    estActif?: boolean;
}
export declare class GenererAbonnementDto {
    exerciceId: string;
    jusquA: string;
}
export declare class ReprendreRegularisationDto {
    exerciceCibleId: string;
}
