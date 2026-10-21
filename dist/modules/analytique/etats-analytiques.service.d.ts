import { PrismaService } from '../../common/prisma.service';
import type { LigneBalanceAnalytique, LigneEtatBudgetaire } from './analytique.service';
export interface LigneGrandLivreAnalytique {
    ligneEcritureId: string | null;
    date: string;
    journal: string;
    numeroPiece: number | null;
    compteNumero: string;
    compteIntitule: string;
    libelle: string;
    debit: number;
    credit: number;
    soldeProgressif: number;
}
export interface LigneControleCumuls {
    planId: string;
    planCode: string;
    planIntitule: string;
    mouvementsGenerauxDebit: number;
    mouvementsGenerauxCredit: number;
    mouvementsAnalytiquesDebit: number;
    mouvementsAnalytiquesCredit: number;
    ecartDebit: number;
    ecartCredit: number;
    nombreSansRepartition: number;
    tronque: boolean;
    lignesSansRepartition: {
        ligneId: string;
        ecritureId: string;
        date: string;
        journal: string;
        compteNumero: string;
        compteIntitule: string;
        libelle: string;
        debit: number;
        credit: number;
    }[];
}
export declare const PLAFOND_LIGNES_SANS_REPARTITION = 500;
export declare class EtatsAnalytiquesService {
    private readonly prisma;
    private readonly od;
    constructor(prisma: PrismaService);
    private cumulsPlan;
    private plan;
    private bornes;
    balance(tenantId: string, params: {
        planId: string;
        exerciceId: string;
        dateDebut?: string;
        dateFin?: string;
    }): Promise<{
        lignes: LigneBalanceAnalytique[];
        totaux: {
            debit: number;
            credit: number;
            solde: number;
        };
    }>;
    grandLivre(tenantId: string, params: {
        sectionId: string;
        exerciceId: string;
        dateDebut?: string;
        dateFin?: string;
    }): Promise<{
        section: {
            id: string;
            code: string;
            intitule: string;
            plan: {
                intitule: string;
                code: string;
            };
            dateDebut: string | null;
            dateFin: string | null;
        };
        lignes: LigneGrandLivreAnalytique[];
        totaux: {
            debit: number;
            credit: number;
            solde: number;
        };
    }>;
    controleCumuls(tenantId: string, params: {
        exerciceId: string;
        dateDebut?: string;
        dateFin?: string;
        planId?: string;
    }): Promise<LigneControleCumuls[]>;
    etatBudgetaire(tenantId: string, params: {
        planId: string;
        exerciceId: string;
        dateDebut?: string;
        dateFin?: string;
        mois?: number;
    }): Promise<{
        lignes: LigneEtatBudgetaire[];
        totaux: LigneEtatBudgetaire;
    }>;
}
