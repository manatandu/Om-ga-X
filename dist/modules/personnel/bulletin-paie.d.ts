export declare const TEXTE_ARTICLE_103: string;
export declare const TEXTE_NUMEROTATION = "Code du travail, art. 214 \u00B7 \u00AB feuilles num\u00E9rot\u00E9es de mani\u00E8re continue \u00BB. Un bulletin annul\u00E9 garde son num\u00E9ro.";
export declare const TEXTE_INALTERABILITE: string;
export declare const LIMITE_UN_BULLETIN_PAR_MOIS: string;
export type EnonciationPortee = {
    readonly rang: number;
    readonly valeur: string;
};
type BulletinLu = {
    matricule: string | null;
    nomComplet: string;
    emploi: string | null;
    categorieProfessionnelle: string | null;
    numeroAffiliationCnss: string | null;
    entree: unknown;
    calcul: unknown;
};
export declare function enonciationsDuBulletin(b: BulletinLu): {
    portees: EnonciationPortee[];
    nonPortees: number[];
};
export declare const RESERVE_MODELE: string;
export declare function moisValide(mois: string): boolean;
export declare function bornesDuMois(mois: string): {
    debut: Date;
    fin: Date;
};
export type ContratCandidat = {
    id: string;
    dateEntreeEnVigueur: Date;
    dateFin: Date | null;
};
export declare function contratCouvrantLeMois<T extends ContratCandidat>(contrats: readonly T[], mois: string): T | null;
export type SimulationEmissible = {
    baremeApplicable: boolean;
    motifBaremeInapplicable: string | null;
    retenue: {
        retenueFc: number;
    } | null;
    cotisations: {
        totalEmployeurFc: number;
        totalTravailleurFc: number;
        abstentions: readonly string[];
    };
    net: {
        totalVerseFc: number;
        netAPayerFc: number | null;
    };
    assiettes: {
        assietteSocialeFc: number | null;
    };
};
export declare function motifsRefusEmission(s: SimulationEmissible): string[];
export declare function chiffresFigeables(s: SimulationEmissible): {
    assietteSocialeFc: number;
    netAPayerFc: number;
    irppFc: number;
} | {
    motifs: string[];
};
export declare function nomCompletMajuscules(s: {
    nom: string;
    postNom: string | null;
    prenoms: string | null;
}): string;
export declare function motifRefusRemise(remisLe: Date, emisLe: Date, maintenant: Date): string | null;
export {};
