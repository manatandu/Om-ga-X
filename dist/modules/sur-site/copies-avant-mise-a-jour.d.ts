export declare const SUFFIXE_PROVISOIRE = ".partiel";
export declare function horodatageCopie(d: Date): string;
export declare const MOTIF_AVANT_MISE_A_JOUR: RegExp;
export declare const MOTIF_AVANT_MISE_A_JOUR_CHIFFRE: RegExp;
export declare function nomCopieAvantMiseAJour(d: Date, versionDeLaBase: string | null): string;
export declare function provisoiresAvantMiseAJour(noms: string[]): string[];
export declare const AVANT_MISE_A_JOUR_A_GARDER_PAR_DEFAUT = 5;
export declare function avantMiseAJourAGarder(env: NodeJS.ProcessEnv): number;
export interface RepereVersion {
    commit: string | null;
    enCours?: {
        vers: string;
        copie: string;
    } | null;
    nonAbouties?: string[];
}
export declare function lireRepere(texte: string | null): RepereVersion | null;
export type PlanMiseAJour = {
    action: 'PREMIER_DEMARRAGE';
} | {
    action: 'AUCUNE';
} | {
    action: 'COPIER';
    versionDeLaBase: string | null;
    copiePerdue: string | null;
} | {
    action: 'REPRENDRE';
    copie: string;
};
export declare function planMiseAJour(repere: RepereVersion | null, version: string, copieExiste: (nom: string) => boolean): PlanMiseAJour;
export declare function etatDeLaBaseAuRefus(plan: PlanMiseAJour): string;
export declare function repereApresCopie(repere: RepereVersion | null, version: string, copie: string): RepereVersion;
export declare function repereApresReprise(repere: RepereVersion, version: string): RepereVersion;
export declare function repereApresMigration(repere: RepereVersion | null, version: string): RepereVersion;
export declare function copiesProtegees(avant: RepereVersion | null, apres: RepereVersion): string[];
export declare function copiesAvantMiseAJourARetirer(noms: string[], garder: number, protegees?: string[], motif?: RegExp): string[];
