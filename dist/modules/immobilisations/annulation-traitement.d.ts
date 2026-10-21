export type NatureTraitement = 'DOTATION' | 'DEPRECIATION' | 'REVISION_PLAN' | 'DEROGATOIRE' | 'REEVALUATION' | 'REPRISE_SUBVENTION' | 'REPRISE_PROVISION_REEVALUATION';
export type NatureActe = NatureTraitement | 'DEROGATOIRE_SOLDE' | 'SORTIE' | 'RECLASSEMENT' | 'TRANSFERT_DEPRECIATION' | 'REMPLACEMENT_IMPREVU' | 'REDUCTION_SUBVENTION';
export interface ActeDuBien {
    nature: NatureActe;
    id: string;
    exerciceFin: Date;
    creeLe: Date;
    libelle: string;
    bien?: string;
    repriseALaSortie?: boolean;
}
export declare const NATURES_ANNULABLES: readonly NatureTraitement[];
export declare function actesQuiEnDependent(cible: ActeDuBien & {
    soldeDerogatoire?: boolean;
}, actes: readonly ActeDuBien[]): ActeDuBien[];
export declare function motifRefusAnnulation(entree: {
    exerciceClos: boolean;
    transfertMiseEnService?: boolean;
    revisionDeReevaluation?: boolean;
    dependants: readonly ActeDuBien[];
}): string | null;
export declare function motifRefusMotifAnnulation(motif: string | undefined | null): string | null;
export declare function rendreEcartImpute(lignes: ReadonlyArray<{
    id: string;
    ecartImpute: number;
}>, montant: number): Array<{
    id: string;
    montant: number;
}> | null;
export interface RevisionLue {
    id: string;
    nature: 'PROSPECTIVE' | 'RETROACTIVE';
    dureeApresAns: number;
    creeLe: Date;
    ouvertureExercice: Date;
    ouvertureSuivante: Date | null;
}
export declare function etatDuPlanApres(revisionsRestantes: readonly RevisionLue[]): {
    dateEffetRevisionPlan: Date | null;
    dureeResiduelleRevisee: number | null;
};
export declare function valeurResiduelleAvant(gardee: number | null, actuelle: number): number | null;
