import type { StatutOrdreVirement } from '@prisma/client';
export declare const CADRE_AVIS_PAR_DEFAUT = "{tiers}\n{adresse}\n\nLe {date}\n\nObjet : avis de r\u00E8glement\n\n{document}";
export declare function motifRefusAvis(statut: StatutOrdreVirement): string | null;
export declare function documentAvisReglement(ligne: {
    montant: number;
    banque: string;
    reference: string | null;
    imputationDeclaree: string | null;
}, ordre: {
    numero: number;
    date: Date;
}, entite: string): string;
