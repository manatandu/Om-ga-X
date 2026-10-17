import { FormeJuridiqueEbnl, FormeJuridiqueSyscohada, Referentiel, RegimeLiquidation, VarianteCooperative } from '@prisma/client';
export declare const FORMES_SOCIETES_COMMERCIALES: FormeJuridiqueSyscohada[];
export declare const FORMES_A_ASSOCIE_UNIQUE_DECLARE: FormeJuridiqueSyscohada[];
export declare const FORMES_CAPITAL_VARIABLE: FormeJuridiqueSyscohada[];
export declare function motifRefusCapitalVariable(forme: FormeJuridiqueSyscohada | null): string | null;
export declare function motifRefusCapital(referentiel: Referentiel, forme: FormeJuridiqueSyscohada | null): string | null;
export interface IdentiteSociete {
    referentiel: Referentiel;
    formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null;
    nom: string;
    capitalSocial: number | null;
    capitalVariable: boolean;
    adresse: string | null;
    ville: string | null;
    rccm: string | null;
    devise: string | null;
    numeroDeclarationActivite?: string | null;
    locataireGerantFonds?: boolean | null;
    formeJuridique?: FormeJuridiqueEbnl | null;
    droitEtranger?: boolean | null;
    numeroRegistreCooperatives?: string | null;
    varianteCooperative?: VarianteCooperative | null;
    modeAdministrationSa?: 'CONSEIL_ADMINISTRATION' | 'ADMINISTRATEUR_GENERAL' | null;
    associeUnique?: boolean | null;
    dateDissolution?: Date | null;
    liquidateurs?: string | null;
    associeUniquePersonneMorale?: boolean | null;
    regimeLiquidation?: RegimeLiquidation | null;
}
export declare const SELECT_IDENTITE_SOCIETE: {
    readonly referentiel: true;
    readonly formeJuridiqueSyscohada: true;
    readonly nom: true;
    readonly capitalSocial: true;
    readonly capitalVariable: true;
    readonly adresse: true;
    readonly ville: true;
    readonly rccm: true;
    readonly devise: true;
    readonly numeroDeclarationActivite: true;
    readonly locataireGerantFonds: true;
    readonly formeJuridique: true;
    readonly droitEtranger: true;
    readonly numeroRegistreCooperatives: true;
    readonly varianteCooperative: true;
    readonly modeAdministrationSa: true;
    readonly associeUnique: true;
    readonly dateDissolution: true;
    readonly liquidateurs: true;
    readonly associeUniquePersonneMorale: true;
    readonly regimeLiquidation: true;
};
export interface MentionsSociete {
    ligne: string | null;
    manquantes: string[];
}
export declare function mentionsArticle17(t: IdentiteSociete): MentionsSociete;
export declare function identiteSociete(t: Omit<IdentiteSociete, 'capitalSocial'> & {
    capitalSocial: {
        toString(): string;
    } | number | null;
}): IdentiteSociete;
export interface MentionsRecopiees extends MentionsSociete {
    denomination: string;
}
export declare function mentionsRecopiees(t: IdentiteSociete, datePiece?: Date): MentionsRecopiees;
export declare function mentionsCooperative(t: IdentiteSociete, datePiece?: Date): MentionsSociete;
export declare const FORMES_ASBL_ARTICLE_16: FormeJuridiqueEbnl[];
export declare const MENTION_ASBL = "Association sans but lucratif \u00B7 A.S.B.L.";
export declare function mentionsAsbl(t: IdentiteSociete): MentionsSociete;
export declare function mentionsEmetteur(t: IdentiteSociete, datePiece?: Date): MentionsSociete;
export declare function mentionLiquidation(t: IdentiteSociete, datePiece?: Date): MentionsSociete;
