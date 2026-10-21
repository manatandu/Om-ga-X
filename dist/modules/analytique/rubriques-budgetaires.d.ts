import { TypeCompteDetailTotal } from '@prisma/client';
export interface SectionPourRubrique {
    id: string;
    code: string;
    type: TypeCompteDetailTotal;
}
export declare function appartientALaRubrique(section: SectionPourRubrique, rubrique: SectionPourRubrique): boolean;
export declare function feuillesDeLaRubrique(rubrique: SectionPourRubrique, sections: SectionPourRubrique[]): string[];
export declare function valeurDeLaLigne(section: SectionPourRubrique, sections: SectionPourRubrique[], mesure: (sectionId: string) => number): number;
export declare function totalDesFeuilles(sections: SectionPourRubrique[], mesure: (sectionId: string) => number): number;
