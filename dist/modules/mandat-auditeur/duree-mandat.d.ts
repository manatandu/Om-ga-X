import { FormeJuridiqueSyscohada, Referentiel } from '@prisma/client';
export type OrganeDesignation = 'STATUTS_OU_AG_CONSTITUTIVE' | 'ASSEMBLEE_GENERALE_ORDINAIRE' | 'ASSOCIES' | 'BAILLEUR_OU_ETAT' | 'JURIDICTION';
export interface DureeMandat {
    exercices: number | null;
    mandatsMaximum: number | null;
    source: string;
}
export declare function dureeMandat(referentiel: Referentiel, formeJuridique: FormeJuridiqueSyscohada | null, organe: OrganeDesignation, gieEmetDesObligations?: boolean | null): DureeMandat;
export declare function dernierExerciceCouvert(premierExercice: number, exercices: number): number;
export declare function regleDeProrogation(referentiel: Referentiel, formeJuridique: FormeJuridiqueSyscohada | null): {
    source: string;
    citation: string;
} | null;
export declare function estDansLaProrogation(premierExercice: number, exercices: number, anneeExercice: number): boolean;
export declare function motifRefusDuree(referentiel: Referentiel, duree: number | null, saisie: number): string | null;
export declare function motifRefusOrgane(referentiel: Referentiel, formeJuridique: FormeJuridiqueSyscohada | null, organe: OrganeDesignation): string | null;
export type NatureSuccession = 'REMPLACEMENT' | 'SUPPLEANT';
export declare function successionOuverte(referentiel: Referentiel, forme: FormeJuridiqueSyscohada | null): boolean;
export declare function motifRefusSuccession(nature: NatureSuccession, origine: {
    premierExercice: number;
    nombreExercices: number;
}, premierExercice: number, nombreExercices: number): string | null;
export declare function fondementInscription(referentiel: Referentiel, formeJuridique: FormeJuridiqueSyscohada | null): {
    source: string;
    texte: string;
};
export declare function mandatCouvrant<T extends {
    premierExercice: number;
    nombreExercices: number;
}>(mandats: readonly T[], anneeExercice: number): T | undefined;
export declare function commissaireCouvreLExercice(mandats: readonly {
    premierExercice: number;
    nombreExercices: number;
    refusDeProrogation: boolean;
    finAnticipeeLe?: Date | null;
}[], anneeExercice: number, referentiel: Referentiel, formeJuridique: FormeJuridiqueSyscohada | null, dateFinExercice?: Date): boolean;
