import { FormeJuridiqueEbnl, FormeJuridiqueSyscohada, Referentiel } from '@prisma/client';
export declare const DERNIERE_VERIFICATION = "2026-09-03";
export type NatureJalon = 'INTERNE' | 'LEGALE';
interface Decalage {
    moisApres: number;
    jour: 'FIN' | number;
}
export interface DefinitionJalon {
    etape: number;
    libelle: string;
    detail: string;
    nature: NatureJalon;
    debut: Decalage;
    echeance: Decalage;
    source: string;
    echeanceFiscale?: true;
    declarationAnnuelleImpotSocietes?: true;
    formes?: FormeJuridiqueEbnl[];
    formesSyscohada?: FormeJuridiqueSyscohada[];
    formesSyscohadaExclues?: FormeJuridiqueSyscohada[];
    referentiels?: Referentiel[];
    droitEtrangerSeulement?: boolean;
    droitCongolaisSeulement?: boolean;
    selonFormeSyscohada?: (forme: FormeJuridiqueSyscohada | null) => {
        detail: string;
        source: string;
    };
    selonAssocieUniqueSas?: (associeUnique: boolean | null) => {
        libelle: string;
        detail: string;
        source: string;
    };
    sanction?: string;
    observation?: 'BROUILLARD' | 'INVENTAIRE' | 'RAPPORT_ACTIVITE' | 'DONATEURS' | 'CLOTURE_ANNUELLE';
}
export declare const JALONS_CLOTURE: DefinitionJalon[];
export interface ObligationEvenementielle {
    cle: string;
    evenement: string;
    libelle: string;
    delai: string;
    destinataire: string;
    source: string;
    formes?: FormeJuridiqueEbnl[];
    referentiels?: Referentiel[];
    formesSyscohadaExclues?: FormeJuridiqueSyscohada[];
    formesSyscohada?: FormeJuridiqueSyscohada[];
    droitEtrangerSeulement?: boolean;
    droitCongolaisSeulement?: boolean;
    ecranDeclencheur?: string;
}
export declare const OBLIGATIONS_EVENEMENTIELLES: ObligationEvenementielle[];
export declare function obligationsEvenementiellesApplicables(contexte: {
    referentiel: Referentiel;
    formeJuridique: FormeJuridiqueEbnl;
    droitEtranger: boolean;
    formeJuridiqueSyscohada?: FormeJuridiqueSyscohada | null;
}): ObligationEvenementielle[];
export declare function jalonsApplicables(contexte: {
    referentiel: Referentiel;
    formeJuridique: FormeJuridiqueEbnl;
    formeJuridiqueSyscohada?: FormeJuridiqueSyscohada | null;
    droitEtranger: boolean;
    associeUnique?: boolean | null;
}): DefinitionJalon[];
export declare function dateJalon(dateFinExercice: Date, decalage: Decalage): Date;
export {};
