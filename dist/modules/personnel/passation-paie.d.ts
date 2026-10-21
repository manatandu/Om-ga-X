import { type NatureElementPaie } from './assiettes-paie';
import { type CategoriePret, type TypeAvance } from './avances-salaire';
export type Referentiel = 'SYSCOHADA' | 'SYCEBNL';
export type RoleComptePaie = 'APPOINTEMENTS_ET_COMMISSIONS' | 'PRIMES_ET_GRATIFICATIONS' | 'CONGES_PAYES' | 'INDEMNITES_DE_PREAVIS_ET_LICENCIEMENT' | 'INDEMNITES_DE_MALADIE' | 'AVANTAGES_EN_NATURE' | 'AUTRES_REMUNERATIONS_DIRECTES' | 'INDEMNITE_DE_LOGEMENT' | 'INDEMNITE_DE_TRANSPORT' | 'AUTRES_INDEMNITES' | 'CHARGES_SOCIALES_PATRONALES' | 'CNSS_PRESTATIONS_FAMILIALES' | 'CNSS_RISQUES_PROFESSIONNELS' | 'CNSS_PENSIONS' | 'FORMATION_PROFESSIONNELLE_CONTINUE' | 'TAXES_SUR_SALAIRES' | 'AUTRES_IMPOTS_ET_TAXES' | 'IRPP_RETENU' | 'REMUNERATIONS_DUES' | 'TRANSFERTS_DE_CHARGES';
export type CompteDuRole = {
    readonly SYSCOHADA: string;
    readonly SYCEBNL: string;
    readonly intitule: string;
    readonly divergent: boolean;
};
export declare const NOMENCLATURE_PAIE: Readonly<Record<RoleComptePaie, CompteDuRole>>;
export declare const RESERVE_INDEMNITES_PERSONNEL_NATIONAL = "Le 6614 vise le personnel NATIONAL. Une indemnit\u00E9 de fin de contrat due \u00E0 un non-national va au 66240000, et OmegaX ne conna\u00EEt pas la nationalit\u00E9 ligne \u00E0 ligne.";
export declare const compteDuRole: (role: RoleComptePaie, referentiel: Referentiel) => string;
export declare const NATURES_SANS_IMPUTATION: Readonly<Partial<Record<NatureElementPaie, string>>>;
export declare const IMPUTATION_PAR_NATURE: Readonly<Partial<Record<NatureElementPaie, RoleComptePaie>>>;
export type SensLigne = 'DEBIT' | 'CREDIT';
export type BlocPaie = 'BRUT' | 'RETENUES' | 'PATRONALES' | 'IMPOTS_ET_TAXES_SUR_SALAIRES' | 'AVANTAGES_EN_NATURE';
export declare function estVerseEnEspeces(nature: NatureElementPaie, enNature?: boolean): boolean;
export type LigneProposee = {
    readonly bloc: BlocPaie;
    readonly compte: string;
    readonly intitule: string;
    readonly sens: SensLigne;
    readonly montantFc: number;
    readonly reserve: string | null;
};
export type MotifRefusPassation = 'NATURE_SANS_IMPUTATION' | 'COTISATION_EN_ABSTENTION' | 'IMPOT_INDETERMINE' | 'ECRITURE_DESEQUILIBREE';
export type VerdictPassation = {
    readonly referentiel: Referentiel;
    readonly lignes: readonly LigneProposee[];
    readonly totalDebitFc: number;
    readonly totalCreditFc: number;
    readonly equilibree: boolean;
    readonly refus: readonly {
        motif: MotifRefusPassation;
        explication: string;
    }[];
    readonly reserves: readonly string[];
};
export type EntreePassation = {
    readonly referentiel: Referentiel;
    readonly elements: readonly {
        nature: NatureElementPaie;
        libelle: string;
        montantFc: number;
        enNature?: boolean;
    }[];
    readonly cotisations: readonly {
        cle: string;
        charge: 'EMPLOYEUR' | 'TRAVAILLEUR';
        montantFc: number;
    }[];
    readonly abstentionsCotisations: readonly string[];
    readonly irppFc: number | null;
    readonly netAPayerFc: number | null;
    readonly retenuesAvances?: readonly {
        type: TypeAvance;
        categoriePret: CategoriePret | null;
        libelle: string;
        montantFc: number;
    }[];
};
export declare const RESERVE_DETTE_INPP_ONEM = "L'INPP ET L'ONEM SONT DES IMP\u00D4TS ET TAXES, pas des charges sociales \u00B7 la fiche du compte 64 des deux textes les d\u00E9bite \u00AB par le cr\u00E9dit du compte 44 \u00BB, et la fiche du compte 66 exclut \u00AB les imp\u00F4ts dont l'assiette repose sur la r\u00E9mun\u00E9ration \u00BB. La dette va au 44280000 \u00AB Autres imp\u00F4ts et taxes \u00BB ; le cabinet qui veut suivre l'INPP et l'ONEM \u00E0 part subdivise le 4428 au cinqui\u00E8me chiffre.";
export declare function passationPaie(entree: EntreePassation): VerdictPassation;
