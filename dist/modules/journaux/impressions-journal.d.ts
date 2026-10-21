import { FormeImpressionJournal, Prisma } from '@prisma/client';
import { type ClientTransactionnel } from '../../common/audit/transaction-journalisee';
import type { CriteresRecherche } from '../comptabilite/recherche-ecritures';
export interface PerimetreImpression {
    exerciceId?: string;
    journalId?: string | null;
    dateDebut?: string;
    dateFin?: string;
}
export interface ImpressionLue {
    journalId: string | null;
    dateDebut: Date;
    dateFin: Date;
    imprimeAt: Date;
}
export interface JourValide {
    journalId: string;
    date: Date;
    derniereValidation: Date | null;
}
export declare function estUneRecherche(criteres: CriteresRecherche): boolean;
export declare const MOTIF_RECHERCHE_NON_IMPRIMABLE = "Une recherche (compte, montant, libell\u00E9, pi\u00E8ce ou r\u00E9f\u00E9rence) n'est pas le journal \u00B7 retirez les crit\u00E8res pour imprimer le journal de la p\u00E9riode.";
export declare function jourCouvert(j: JourValide, impressions: readonly ImpressionLue[]): boolean;
export declare function joursNonImprimes(jours: readonly JourValide[], impressions: readonly ImpressionLue[]): JourValide[];
type Lecteur = {
    ecriture: {
        groupBy: (a: unknown) => Promise<Array<{
            journalId: string;
            date: Date;
            _max: {
                valideeAt: Date | null;
            };
        }>>;
    };
    impressionJournal: {
        findMany: (a: unknown) => Promise<ImpressionLue[]>;
    };
    journal: {
        findMany: (a: unknown) => Promise<Array<{
            id: string;
            code: string;
        }>>;
    };
};
export declare const PLAFOND_MOIS_NOMMES = 24;
export interface MoisNonImprime {
    journal: string;
    mois: string;
}
export declare function moisNonImprimes(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
    journalId: string | null;
    jusquau: Date;
}): Promise<{
    mois: MoisNonImprime[];
    total: number;
}>;
export declare function motifClotureNonImprimee(r: {
    mois: MoisNonImprime[];
    total: number;
}): string;
export declare function periodeCouverte(exercice: {
    dateDebut: Date;
    dateFin: Date;
}, p: PerimetreImpression): {
    dateDebut: Date;
    dateFin: Date;
};
export interface ImpressionAEnregistrer {
    tenantId: string;
    exerciceId: string;
    journalId: string | null;
    dateDebut: Date;
    dateFin: Date;
    forme: FormeImpressionJournal;
    nombreEcritures: number;
    imprimePar: string;
    imprimeAt?: Date;
}
export declare function enregistrerImpression(prisma: ClientTransactionnel, p: ImpressionAEnregistrer): Promise<{
    id: string;
    dateDebut: Date;
    tenantId: string;
    dateFin: Date;
    exerciceId: string;
    numero: number;
    journalId: string | null;
    forme: import(".prisma/client").$Enums.FormeImpressionJournal;
    nombreEcritures: number;
    imprimeAt: Date;
    imprimePar: string;
}>;
export declare function enregistrerImpressionDans(tx: Prisma.TransactionClient, p: ImpressionAEnregistrer): Promise<{
    id: string;
    dateDebut: Date;
    tenantId: string;
    dateFin: Date;
    exerciceId: string;
    numero: number;
    journalId: string | null;
    forme: import(".prisma/client").$Enums.FormeImpressionJournal;
    nombreEcritures: number;
    imprimeAt: Date;
    imprimePar: string;
}>;
export declare function rattacherLesImpressions(tx: Prisma.TransactionClient, tenantId: string, depuis: string, vers: string): Promise<number>;
export {};
