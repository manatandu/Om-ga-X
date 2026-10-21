import { FormeJuridiqueSyscohada, Referentiel } from '@prisma/client';
export interface IdentiteImmatriculation {
    referentiel: Referentiel;
    formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null;
    rccm: string | null;
    numeroDeclarationActivite?: string | null;
    locataireGerantFonds?: boolean | null;
    numeroRegistreCooperatives?: string | null;
}
export interface MentionImmatriculation {
    ligne: string | null;
    manquantes: string[];
}
export declare const MENTION_ENTREPRENANT = "Entreprenant dispens\u00E9 d\u2019immatriculation";
export declare function mentionImmatriculation(t: IdentiteImmatriculation): MentionImmatriculation;
export declare function immatriculationDesLivres(t: IdentiteImmatriculation): string;
export declare function numeroRegistreLiasse(t: IdentiteImmatriculation): string;
