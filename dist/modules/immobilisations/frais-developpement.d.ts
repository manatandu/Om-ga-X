export declare const CRITERES_FRAIS_DEVELOPPEMENT: readonly [{
    readonly cle: "FAISABILITE_TECHNIQUE";
    readonly rang: 1;
    readonly libelle: "la faisabilité technique nécessaire à l'achèvement de l'immobilisation incorporelle en vue de sa mise en service ou de sa vente";
}, {
    readonly cle: "INTENTION";
    readonly rang: 2;
    readonly libelle: "son intention d'achever l'immobilisation incorporelle et de l'utiliser ou de la vendre";
}, {
    readonly cle: "CAPACITE";
    readonly rang: 3;
    readonly libelle: "sa capacité à utiliser ou à vendre l'immobilisation incorporelle";
}, {
    readonly cle: "AVANTAGES_ECONOMIQUES";
    readonly rang: 4;
    readonly libelle: "la façon dont l'immobilisation incorporelle générera des avantages économiques futurs probables";
}, {
    readonly cle: "RESSOURCES";
    readonly rang: 5;
    readonly libelle: "la disponibilité de ressources techniques, financières et autres, appropriées pour achever le développement et utiliser ou vendre l'immobilisation incorporelle";
}, {
    readonly cle: "EVALUATION_FIABLE";
    readonly rang: 6;
    readonly libelle: "sa capacité à évaluer de manière fiable les dépenses attribuables à l'immobilisation incorporelle au cours de son développement";
}];
export type CleCritereDeveloppement = (typeof CRITERES_FRAIS_DEVELOPPEMENT)[number]['cle'];
export type CriteresDeclares = Partial<Record<CleCritereDeveloppement, string | null | undefined>>;
export declare function estFraisDeveloppement(referentiel: 'SYSCOHADA' | 'SYCEBNL', numeroCompte: string): boolean;
export interface InscriptionFraisDeveloppement {
    referentiel: 'SYSCOHADA' | 'SYCEBNL';
    numeroCompte: string;
    repris: boolean;
    criteres: CriteresDeclares | null | undefined;
    dateReunion: Date | null;
    dateInscription: Date;
}
export declare function motifRefusFraisDeveloppement(i: InscriptionFraisDeveloppement): string | null;
export declare function criteresRetenus(criteres: CriteresDeclares | null | undefined): Record<CleCritereDeveloppement, string> | null;
