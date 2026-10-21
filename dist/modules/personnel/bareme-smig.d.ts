export declare const SMIG_JOURNALIER_FC = 21500;
export declare const DECRET_SMIG: {
    readonly reference: "Décret n° 25/22 du 30 mai 2025";
    readonly objet: "portant fixation du salaire minimum interprofessionnel garanti, des allocations familiales minima et de la contre-valeur du logement";
    readonly signeLe: "2025-05-30";
    readonly entreEnVigueurLe: "2025-05-30";
    readonly formuleEntreeEnVigueur: "qui entre en vigueur à la date de sa signature";
    readonly abroge: "Décret n° 18/017 du 22 mai 2018";
    readonly fondement: "Code du travail, article 87";
    readonly annexesArreteesLe: "2025-09-17";
    readonly publieAu: "Journal officiel, première partie, numéro spécial du 28 octobre 2025";
};
export declare const DECRET_MODALITES: {
    readonly reference: "Décret n° 25/21 du 30 mai 2025";
    readonly objet: "déterminant les modalités de fixation et d'ajustement du salaire minimum interprofessionnel garanti, des allocations familiales minima et de la contre-valeur du logement";
    readonly signeLe: "2025-05-30";
    readonly entreEnVigueurLe: "2025-05-30";
    readonly abroge: "Décret n° 079/2002 du 3 juillet 2002";
    readonly fondement: "Code du travail, article 96";
    readonly seuilAjustementIpcPourCent: 50;
    readonly moisDAjustement: "janvier";
    readonly defalcationLogementEnNature: "art. 15, de l'indemnité de logement pour cause de mutation ; de la rémunération dès le logement en nature, arrêté n° 12/CAB.MIN/TPS/110/2005, art. 10";
};
export interface CategorieProfessionnelle {
    rang: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII';
    libelle: string;
    echelons: readonly (string | null)[];
    classes: readonly number[];
}
export declare const CATEGORIES: readonly CategorieProfessionnelle[];
export declare const TENSIONS: readonly number[];
export declare const COLONNE_ALLOCATIONS_FAMILIALES = 19;
export declare const COLONNE_CONTRE_VALEUR_LOGEMENT = 20;
export declare const colonneDeLaClasse: (classe: number) => number;
export interface Annexe {
    numero: 1 | 2 | null;
    decret18017?: true;
    reference?: string;
    duMoisDePaie: string;
    auMoisDePaie: string | null;
    smigJournalierFc: number;
    tauxParClasse: readonly number[];
    allocationFamilialeJournaliereFc: number;
    contreValeurLogementJournaliereFc: number;
}
export declare const ANNEXES: readonly Annexe[];
export declare const ANNEXE_DECRET_18_017: Annexe;
export declare const RESERVE_ANNEXE_18_017 = "D\u00C9CRET n\u00B0 18/017 \u00B7 annexe \u00E0 7 075 FC, transcrite avec deux r\u00E9serves de lecture : la classe 8 se lit 18 385,5 sur la reproduction et vaut 19 385,5 par l'arithm\u00E9tique (274 \u00D7 70,75) ; la colonne 20 se lit 52,40 et vaut 52,41 par l'article 6. Son article 7 majore les taux \u00AB de 3 % au moins par ann\u00E9e enti\u00E8re de service ininterrompu \u00BB dans la m\u00EAme entreprise.";
export declare const DIVISEUR_ALLOCATION_FAMILIALE = 27;
export declare const DIVISEUR_CONTRE_VALEUR_LOGEMENT = 5;
export declare const DECIMALES_ANNEXE = 2;
export type MotifRefusSmig = 'MOIS_MAL_FORME' | 'ANTERIEUR_AU_DECRET' | 'CLASSE_HORS_BAREME' | 'MAJORATION_ANCIENNETE_NON_RENSEIGNEE';
export interface Applicable<T> {
    valeur: T | null;
    annexe: Annexe | null;
    refus: MotifRefusSmig | null;
    explication: string;
}
export declare const nomAnnexe: (a: Annexe) => string;
export declare function annexeDuCabinet(v: {
    aPartirDu: string;
    reference: string;
    smigJournalierFc: number;
}): Annexe;
export declare const RESERVE_GRILLE_CABINET = "GRILLE SAISIE PAR LE CABINET \u00B7 OmegaX n'a pas lu ce texte. Le taux du man\u0153uvre ordinaire est celui que le cabinet a d\u00E9clar\u00E9 ; les dix-sept classes en sont tir\u00E9es par la tension salariale du d\u00E9cret n\u00B0 25/22 (d\u00E9cret n\u00B0 25/21, art. 6), l'allocation familiale et la contre-valeur du logement par les fractions de ses articles 5 et 6.";
export declare function annexeApplicable(moisDePaie: string, annexesDossier?: readonly Annexe[]): Applicable<Annexe>;
export declare function tauxJournalierDeLaClasse(classe: number, moisDePaie: string, annexesDossier?: readonly Annexe[], anneesServiceIninterrompu?: number | null): Applicable<{
    classe: number;
    tension: number;
    tauxFc: number;
    categorie: CategorieProfessionnelle;
    echelon: string | null;
    colonne: number;
}>;
export declare function allocationFamilialeJournaliere(moisDePaie: string, nombreEnfants?: number, annexesDossier?: readonly Annexe[]): Applicable<{
    parEnfantFc: number;
    totalFc: number;
    colonne: number;
}>;
export declare function contreValeurLogementJournaliere(moisDePaie: string, annexesDossier?: readonly Annexe[]): Applicable<{
    montantFc: number;
    colonne: number;
}>;
export declare const MULTIPLICATEURS_ARTICLE_7: {
    readonly SEMAINE: 6;
    readonly MOIS: 26;
    readonly ANNEE: 312;
};
export type PeriodeSmig = keyof typeof MULTIPLICATEURS_ARTICLE_7;
export declare function valeurPeriodique(montantJournalierFc: number, periode: PeriodeSmig): number;
