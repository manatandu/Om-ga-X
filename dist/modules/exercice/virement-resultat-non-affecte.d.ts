import { type CompteRan, type LigneRan } from './report-a-nouveau';
export interface DestinationsVirement {
    credit: string;
    debit: string;
}
export declare function destinationsDuVirement(referentiel: 'SYSCOHADA' | 'SYCEBNL', entiteIndividuelle: boolean): DestinationsVirement;
export declare function montantFr(n: number): string;
export declare function estCompteDuResultat(c: Pick<CompteRan, 'numero' | 'modeReportANouveau'>): boolean;
export declare function virementResultatNonAffecte(comptes: CompteRan[], destination: {
    credit: string;
    debit: string;
}, idDuNumero: (numero: string) => string | undefined): {
    montant: number;
    lignes: LigneRan[];
    compteDestination: string | null;
};
export declare function appliquerVirementAuReport(report: LigneRan[], virement: LigneRan[]): LigneRan[];
export declare function ecartInexpliqueDuBilan(bilan: {
    totalActif: number;
    totalPassif: number;
    controle?: {
        resultatClasses678: number;
        resultatCompte13: number;
        compte13LuHorsDuResultat?: number;
    } | null;
}, resultat13: number): number | null;
