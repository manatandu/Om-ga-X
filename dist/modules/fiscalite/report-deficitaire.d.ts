export interface ExerciceRejoue {
    exerciceId: string;
    dateDebut: Date;
    dateFin: Date;
    base: number;
    debutImposable?: Date;
    ouvertureDeclaree?: {
        montant: number;
        origines: {
            dateFin: Date;
            montant: number;
        }[] | null;
    } | null;
}
export interface DeficitReportable {
    exerciceId: string;
    dateFin: Date;
    montant: number;
    simulation: boolean;
    declare: boolean;
    bornePrudente: boolean;
}
export interface ReportPerduParPrudence {
    exerciceDeclarationId: string;
    dateDebutDeclaration: Date;
    montant: number;
}
export declare function finDeFenetre(dateFinExerciceDeficitaire: Date, exercicesReport: number): Date;
export declare function deficitsReportables(precedents: ExerciceRejoue[], cible: {
    dateDebut: Date;
}, exercicesReport: number): DeficitReportable[];
export declare function dateFinPrudente(dateDebutDeclaration: Date, exercicesReport: number): Date;
export declare function rejouerReport(precedents: ExerciceRejoue[], cible: {
    dateDebut: Date;
}, exercicesReport: number): {
    detail: DeficitReportable[];
    perdusParPrudence: ReportPerduParPrudence[];
};
export declare function partImputableDeLaSaisie(montant: number, origines: {
    dateFin: Date;
    montant: number;
}[] | null, exercice: {
    dateDebut: Date;
}, exercicesReport: number): {
    imputable: number;
    horsFenetre: {
        dateFin: Date;
        montant: number;
        finDeFenetre: Date;
    }[];
};
export declare function originesHorsFenetre(origines: {
    dateFin: Date;
    montant: number;
}[], exercice: {
    dateDebut: Date;
}, exercicesReport: number): {
    dateFin: Date;
    finDeFenetre: Date;
}[];
export declare function avertissementsReportDeclare(detail: DeficitReportable[], perdus: ReportPerduParPrudence[], exercicesClos?: Set<string>): string[];
export declare function avertissementExercicesNonJointifs(precedents: {
    dateDebut: Date;
    dateFin: Date;
}[], cible: {
    dateDebut: Date;
}, exercicesReport: number): string | null;
export declare function avertissementDeficitsSimules(detail: DeficitReportable[], saisi: boolean): string | null;
