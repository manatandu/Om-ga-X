import { FormeJuridiqueSyscohada } from '@prisma/client';
export interface FormeDatee {
    formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null;
    formeJuridiqueSyscohadaAnterieure?: FormeJuridiqueSyscohada | null;
    dateTransformationForme?: Date | null;
}
export declare function formeApplicable(t: FormeDatee, dateFinExercice: Date): FormeJuridiqueSyscohada | null;
export declare function exerciceDeTransformation(t: FormeDatee, exercice: {
    dateDebut: Date;
    dateFin: Date;
}): boolean;
export declare function motifRefusTransformation(ancienne: FormeJuridiqueSyscohada | null, nouvelle: FormeJuridiqueSyscohada, dateEffet: Date, aujourdHui: Date): string | null;
