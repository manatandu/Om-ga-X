export declare const ORDONNANCE_84_186 = "ordonnance n\u00B0 84/186 du 15 octobre 1984 fixant les modalit\u00E9s de paiement de la cotisation due par les employeurs \u00E0 l'INPP";
export declare const ECHEANCES_TRIMESTRIELLES_INPP: readonly {
    readonly trimestre: 1 | 2 | 3 | 4;
    readonly moisZeroBase: number;
    readonly jour: number;
    readonly anneeSuivante: boolean;
}[];
export declare function echeanceTrimestrielleInpp(annee: number, moisZeroBase: number): Date;
export declare function prochaineEcheanceInpp(reference: Date): Date;
export type PartInppOnem = 'INPP' | 'ONEM' | 'NON_VENTILEE';
export declare const RACINE_CHARGE_INPP = "6415";
export declare const RACINE_CHARGE_ONEM = "6413";
export type ChargeDeLEcriture = {
    readonly debit: unknown;
    readonly credit: unknown;
    readonly compte: {
        readonly numero: string;
    };
};
export declare function ventilerInppOnem(montant: number, numeroCompte: string, chargesDeLEcriture: readonly ChargeDeLEcriture[] | undefined): Array<{
    part: PartInppOnem;
    montant: number;
}>;
export type MoisDuRegistre = {
    readonly mois: string;
    readonly part: PartInppOnem | null;
    readonly solde: number;
    readonly echeance: Date;
    readonly enRetard: boolean;
};
export type LigneEcheancierInppOnem = {
    readonly part: 'ONEM' | 'INPP';
    readonly periodicite: 'MENSUELLE' | 'TRIMESTRIELLE';
    readonly date: Date;
    readonly montantDu: number;
    readonly moisEnRetard: number;
};
export declare function lignesEcheancierInppOnem(mois: readonly MoisDuRegistre[], prochaineOnem: Date, prochaineInpp: Date): LigneEcheancierInppOnem[];
export declare const RESERVE_IMPUTATION_INPP_ONEM = "Un reversement au 4428 ne dit pas s'il acquitte l'INPP ou l'ONEM. Le registre l'impute d'abord sur la dette \u00E9chue, en commen\u00E7ant par l'\u00E9ch\u00E9ance la plus ancienne, puis sur celles qui \u00E9choient ensuite \u00B7 ordre emprunt\u00E9 par analogie au Code civil, Livre III, art. 154, qui vise les dettes envers un m\u00EAme cr\u00E9ancier, alors que l'INPP et l'ONEM sont deux organismes. Le registre ne lit ni le bordereau qui dit \u00E0 qui le versement est all\u00E9, ni l'int\u00E9r\u00EAt que vous aviez \u00E0 acquitter l'une plut\u00F4t que l'autre ; il lit l'anciennet\u00E9 \u00E0 l'\u00E9ch\u00E9ance, et non \u00E0 la naissance de la dette. Si votre versement visait une autre dette, la r\u00E9partition affich\u00E9e n'est pas la v\u00F4tre.";
export declare function mentionNonVentilee(montantFc: number): string | null;
export declare const MAJORATION_RETARD_INPP = "MAJORATION DE RETARD \u00B7 l'employeur qui ne verse pas aux \u00E9ch\u00E9ances verse, en m\u00EAme temps que la cotisation, \u00AB une majoration du montant de celle-ci \u00E9gale \u00E0 0,5 pour mille par jour de retard \u00BB, \u00E0 partir de la date o\u00F9 la cotisation devait \u00EAtre vers\u00E9e (ordonnance n\u00B0 84/186, art. 4). Le montant est un acte de l'INPP \u00B7 ce registre ne le chiffre pas.";
export declare const TAXATION_D_OFFICE_INPP = "TAXATION D'OFFICE \u00B7 l'employeur qui ne produit pas la d\u00E9claration des r\u00E9mun\u00E9rations s'expose, apr\u00E8s mise en demeure, \u00E0 une taxation d'office calcul\u00E9e sur le salaire minimum l\u00E9gal le plus \u00E9lev\u00E9 (ordonnance n\u00B0 84/186, art. 6) ; \u00E0 d\u00E9faut de paiement, \u00E0 une ex\u00E9cution forc\u00E9e apr\u00E8s une mise en demeure rest\u00E9e sans suite pendant trente jours (art. 7). Actes de l'INPP, jamais calcul\u00E9s ici.";
export declare const FRACTION_MAXIMALE_REDUCTION_INPP = 0.25;
export declare function motifRefusReductionInpp(tauxPourCent: number, reductionPoints: number): string | null;
export declare const reserveReductionInpp: (reductionPoints: number, reference: string, tauxBareme: number) => string;
