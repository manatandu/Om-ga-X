import { Prisma, Referentiel, StatutExercice } from '@prisma/client';
export declare const JOURS_CENTRALISATION: Record<Referentiel, number>;
export declare function brouillardInvalidable(e: {
    estANouveauProvisoire: boolean;
    estGenereeParCloture: boolean;
}, statutExercice: StatutExercice): boolean;
export declare function filtreBrouillardAValider(statutExercice: StatutExercice): Prisma.EcritureWhereInput;
export declare function ancienneteJours(createdAt: Date, maintenant: number): number;
export declare function enRetardDeCentralisation(e: {
    estANouveauProvisoire: boolean;
    estGenereeParCloture: boolean;
    createdAt: Date;
}, statutExercice: StatutExercice, referentiel: Referentiel, maintenant: number): boolean;
