export interface PeriodeCreation {
    dateDebut: Date;
    dateFin: Date;
    annee: number;
    sousLaLoi: boolean;
}
export declare function periodeDeCreation(exercice: {
    dateDebut: Date;
    dateFin: Date;
}, premierExerciceDuDossier: boolean): PeriodeCreation | null;
export declare function deductionPeriodeCreation(resultatPeriode: number): number;
export declare function chiffreAffairesMinimumPremierExercice(chiffreAffairesExercice: number, chiffreAffairesPeriode: number): number;
export declare const OBSERVATION_CHIFFRE_AFFAIRES_PREMIER_EXERCICE = "CHIFFRE D'AFFAIRES DU MINIMUM DU PREMIER EXERCICE CLOS \u00B7 l'imp\u00F4t est \u00E9tabli chaque ann\u00E9e (loi n\u00B0 23/053, art. 12, al. 1 et 4), et l'art. 12, al. 3 d\u00E9coupe le premier exercice long en deux impositions. Le minimum de l'art. 57, assis sur le chiffre d'affaires \u00AB d\u00E9clar\u00E9 \u00BB, se calcule donc pour le premier exercice clos sur le chiffre d'affaires de l'ann\u00E9e qui suit la cr\u00E9ation \u00B7 celui de l'exercice MOINS celui de la p\u00E9riode de cr\u00E9ation, qui a port\u00E9 son propre minimum dans la d\u00E9claration de l'ann\u00E9e de cr\u00E9ation (LPF, art. 12 et 13, al. 3 ; loi n\u00B0 23/053, art. 151). Le compter deux fois serait la double imposition que l'art. 55 \u00E9carte, et, pour une p\u00E9riode de cr\u00E9ation ant\u00E9rieure au 1er janvier 2026, ferait porter le minimum sur des ventes d'avant l'entr\u00E9e en vigueur de la loi (art. 153).";
export declare function sourceChiffreAffairesPeriode(e: {
    chiffreAffairesDeclare: boolean;
    beneficeDeclare: boolean;
}): string;
export declare const OBSERVATION_PERTE_PERIODE_CREATION = "PERTE DE LA P\u00C9RIODE DE CR\u00C9ATION \u00B7 elle n'est ni d\u00E9duite ni report\u00E9e \u00E0 part \u00B7 l'art. 12, al. 3 ne fait venir en d\u00E9duction que \u00AB ces b\u00E9n\u00E9fices \u00BB, et l'art. 51 ne reporte que \u00AB les pertes constat\u00E9es au cours d'un exercice \u00BB, la p\u00E9riode n'en \u00E9tant pas un. Elle reste dans les r\u00E9sultats du premier exercice clos et en diminue la base. Si celui-ci est d\u00E9ficitaire, c'est sa perte qui se reporte (art. 51), son caract\u00E8re s'appr\u00E9ciant sur son r\u00E9sultat fiscal (art. 52, 2\u00B0) ; l'imp\u00F4t minimum pay\u00E9 sur la p\u00E9riode ne s'impute sur rien (art. 51 et 52).";
