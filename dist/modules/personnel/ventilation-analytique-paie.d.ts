import { type BulletinAComptabiliser, type LigneDuMois, type OrigineDuBulletin } from './comptabilisation-paie';
import { type Referentiel } from './passation-paie';
export declare const PLAFOND_LIGNES_REPARTITION = 50;
export declare const CLASSE_DES_CHARGES_DE_PERSONNEL = "6";
export type LigneRepartition = {
    readonly sectionId: string;
    readonly pourcentage: number;
};
export type VersionRepartition = {
    readonly id: string;
    readonly salarieId: string;
    readonly planId: string;
    readonly moisEffet: string;
    readonly lignes: readonly LigneRepartition[];
};
export type PlanConnu = {
    readonly id: string;
    readonly code: string;
    readonly classesVentilees: string;
    readonly estActif: boolean;
};
export type SectionConnue = {
    readonly id: string;
    readonly planId: string;
    readonly code: string;
    readonly estTotal: boolean;
    readonly estActive: boolean;
};
export declare function enPointsDeBase(pourcentage: number): number | null;
export declare function motifRefusRepartition(params: {
    readonly plan: PlanConnu | null;
    readonly sections: readonly SectionConnue[];
    readonly lignes: readonly LigneRepartition[];
    readonly moisEffet: string;
}): string | null;
export declare function versionDuMois(versions: readonly VersionRepartition[], salarieId: string, planId: string, mois: string): VersionRepartition | null;
export type BulletinVentile = BulletinAComptabiliser & {
    readonly salarieId: string;
};
export declare function cleDeLaLigne(l: LigneDuMois, referentiel: Referentiel): string | null;
export declare function partsDesBulletins(bulletins: readonly (BulletinAComptabiliser & {
    readonly id: string;
})[], referentiel: Referentiel): Map<string, Map<string, number>>;
export type VentilationDeLigne = {
    readonly planId: string;
    readonly planCode: string;
    readonly sectionId: string;
    readonly sectionCode: string;
    readonly montantFc: number;
};
export type CauseNonVentilee = 'AUCUNE_REPARTITION_DU_PLAN' | 'SANS_REPARTITION' | 'REPARTITION_VIDE' | 'SECTION_HORS_USAGE' | 'ORIGINE_NON_VENTILEE' | 'ORIGINE_NON_RECONSTITUEE' | 'PART_ILLISIBLE';
export type LigneNonVentilee = {
    readonly index: number;
    readonly compte: string;
    readonly intitule: string;
    readonly planCode: string;
    readonly cause: CauseNonVentilee;
    readonly motif: string;
    readonly issue: string;
};
export type VentilationDeLaPaie = {
    readonly parLigne: readonly (readonly VentilationDeLigne[])[];
    readonly nonVentilees: readonly LigneNonVentilee[];
    readonly reserves: readonly string[];
};
export type RepriseAVentiler = {
    readonly mode: 'EXACTE' | 'REJEU';
    readonly origine: OrigineDuBulletin;
    readonly bulletins: readonly BulletinAComptabiliser[];
    readonly portes?: readonly BulletinVentile[];
};
export declare function ventilerLaPaie(params: {
    readonly mois: string;
    readonly referentiel: Referentiel;
    readonly lignes: readonly LigneDuMois[];
    readonly bulletins: readonly BulletinVentile[];
    readonly plans: readonly PlanConnu[];
    readonly sections: readonly SectionConnue[];
    readonly versions: readonly VersionRepartition[];
    readonly reprises?: readonly RepriseAVentiler[];
}): VentilationDeLaPaie;
export declare const ISSUE_ORIGINE_NON_VENTILEE: string;
export declare function issueDeLaCause(cause: CauseNonVentilee): string;
