import { type Annexe } from './bareme-smig';
export type PointArticle212 = 'NOM_EMPLOYEUR' | 'IMMATRICULATION_CNSS_EMPLOYEUR' | 'IDENTITE_TRAVAILLEUR' | 'AFFILIATION_CNSS_TRAVAILLEUR' | 'NAISSANCE_TRAVAILLEUR' | 'LIEU_NAISSANCE_ET_NATIONALITE' | 'SITUATION_FAMILIALE' | 'NATURE_DU_TRAVAIL' | 'REMUNERATION_ET_AVANTAGES' | 'LIEUX_EXECUTION' | 'DUREE_ENGAGEMENT' | 'DUREE_PREAVIS' | 'DATE_ENTREE_EN_VIGUEUR' | 'LIEU_ET_DATE_CONCLUSION' | 'APTITUDE_AU_TRAVAIL';
export interface EnonciationArticle212 {
    point: PointArticle212;
    numero: number;
    texte: string;
    ou: string;
}
export declare const ENONCIATIONS_ARTICLE_212: readonly EnonciationArticle212[];
export interface EmployeurPourControle {
    nom: string | null;
    numeroAffiliationCnssEmployeur: string | null;
}
export interface SalariePourControle {
    nom: string | null;
    postNom: string | null;
    prenoms: string | null;
    sexe: string | null;
    numeroAffiliationCnss: string | null;
    dateNaissance: Date | string | null;
    millesimeNaissance: number | null;
    lieuNaissance: string | null;
    nationalite: string | null;
    nomConjoint: string | null;
    aptitudeConstateeLe: Date | string | null;
    enfantsSansDateNaissance: number;
}
export interface ContratPourControle {
    type: string;
    constateParEcrit: boolean;
    viseParOnem: boolean;
    dateEntreeEnVigueur: Date | string | null;
    dateConclusion: Date | string | null;
    lieuConclusion: string | null;
    dateFinPrevue: Date | string | null;
    ouvrageDetermine: string | null;
    motifRemplacement: string | null;
    emploiPermanent: boolean;
    natureTravail: string | null;
    lieuExecution: string | null;
    remunerationBase: number | null;
    avantagesConvenus: string | null;
    dureePreavisJours: number | null;
    separeDeSaFamille: boolean;
    manoeuvreSansSpecialite: boolean;
    clauseEssai: boolean;
    essaiConstateParEcrit: boolean;
    essaiDureeJours: number | null;
    classeProfessionnelle: number | null;
    periodiciteRemuneration: 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE' | null;
    deviseRemuneration: string | null;
}
export interface MentionManquante extends EnonciationArticle212 {
    motif: string;
}
export declare function mentionsManquantes(employeur: EmployeurPourControle, salarie: SalariePourControle, contrat: ContratPourControle): MentionManquante[];
export type MotifRequalification = 'PAS_D_ECRIT' | 'CDD_SANS_MENTION_DE_SON_TERME' | 'REMPLACEMENT_SANS_MOTIF' | 'EMPLOI_PERMANENT' | 'CDD_TROP_LONG' | 'CDD_TROP_LONG_SEPARE_DE_SA_FAMILLE' | 'TROISIEME_CDD' | 'SECOND_RENOUVELLEMENT' | 'ENGAGEMENT_JOUR_LE_JOUR_REPETE' | 'APPRENTISSAGE_SANS_ECRIT' | 'APPRENTISSAGE_NON_VISE' | 'APPRENTISSAGE_TROP_LONG';
export interface Requalification {
    motif: MotifRequalification;
    article: string;
    formule: string;
    explication: string;
    effet: string;
    reserve: string | null;
}
export interface HistoriqueChezCetEmployeur {
    nombreCdd: number;
    nombreRenouvellements: number;
    journeesJourLeJour?: number | null;
}
export declare const JOURNEES_ARTICLE_40 = 22;
export declare function journeesJourLeJourAvant(anterieurs: readonly {
    type: string;
    dateEntreeEnVigueur: Date | string | null;
    dateFin: Date | string | null;
}[], nouveau: {
    dateEntreeEnVigueur: Date | string | null;
}): number | null;
export declare const EFFET_REQUALIFICATION_CDI = "Requalifi\u00E9 en contrat \u00E0 dur\u00E9e ind\u00E9termin\u00E9e";
export declare function joursEntre(debut: Date, fin: Date): number;
export declare const FORMULE_ARTICLE_41_ALINEAS_2_ET_3 = "Aucun travailleur ne peut conclure avec le m\u00EAme employeur ou avec la m\u00EAme entreprise plus de deux contrats \u00E0 dur\u00E9e d\u00E9termin\u00E9e ni renouveler plus d'une fois un contrat \u00E0 dur\u00E9e d\u00E9termin\u00E9e, sauf dans le cas d'ex\u00E9cution des travaux saisonniers, d'ouvrages bien d\u00E9finis et autres travaux d\u00E9termin\u00E9s par arr\u00EAt\u00E9 du Ministre ayant le Travail et la Pr\u00E9voyance Sociale dans ses attributions, pris apr\u00E8s avis du Conseil National du Travail. L'ex\u00E9cution de tout contrat conclu en violation des dispositions du pr\u00E9sent article ou la continuation de service en dehors des cas pr\u00E9vus \u00E0 l'alin\u00E9a pr\u00E9c\u00E9dent constituent de plein droit l'ex\u00E9cution d'un contrat de travail \u00E0 dur\u00E9e ind\u00E9termin\u00E9e.";
export declare function requalificationsApprentissage(contrat: ContratPourControle): Requalification[];
export declare function requalifications(contrat: ContratPourControle, historique: HistoriqueChezCetEmployeur): Requalification[];
export interface VerdictEssai {
    dureeOpposableJours: number | null;
    plafondJours: number;
    reduiteDePleinDroit: boolean;
    ecritManquant: boolean;
    reserve: string | null;
}
export declare const JOURS_PAR_MOIS_ESSAI = 30;
export declare function verdictEssai(contrat: ContratPourControle): VerdictEssai;
export declare const JOURS_DECLARATION_ARTICLE_217 = 15;
export type ObjetDeclaration = 'ENGAGEMENT' | 'DEPART';
export interface DeclarationDue {
    objet: ObjetDeclaration;
    faitLe: Date;
    echeance: Date;
    faite: boolean;
    enRetard: boolean;
    destinataires: string;
    article: string;
}
export declare function declarationsDues(entree: {
    dateEntreeEnVigueur: Date | string | null;
    declarationEngagementLe: Date | string | null;
    dateFin: Date | string | null;
    declarationDepartLe: Date | string | null;
}, aujourdhui: Date): DeclarationDue[];
export declare const MOIS_CONFIRMATION_APTITUDE = 3;
export declare function aptitudeProvisoirePerimee(salarie: {
    aptitudeProvisoire: boolean;
}, contrat: {
    dateEntreeEnVigueur: Date | string | null;
}, aujourdhui: Date): boolean;
export type MotifAbstentionMinimum = 'CLASSE_NON_RENSEIGNEE' | 'PERIODICITE_NON_RENSEIGNEE' | 'REMUNERATION_NON_RENSEIGNEE' | 'DEVISE_NON_RENSEIGNEE' | 'REMUNERATION_HORS_FRANC' | 'HORS_BAREME' | 'GRILLES_SMIG_NON_LUES';
export interface GrillesSmigNonLues {
    du: string;
    avant: string;
}
export declare const MONNAIE_DU_MINIMUM = "CDF";
export declare const MOTIF_MONNAIE_EXIGEE: string;
export declare function motifMonnaieExigee(remunerationBase: number | null | undefined, deviseRemuneration: string | null | undefined): string | null;
export declare const CONTRAT_A_COMPLETER: {
    readonly remunerationBase: {
        readonly not: null;
    };
    readonly deviseRemuneration: null;
};
export interface VerdictRemunerationMinimale {
    conforme: boolean | null;
    minimumFc: number | null;
    convenueFc: number | null;
    manqueFc: number | null;
    abstention: MotifAbstentionMinimum | null;
    explication: string;
}
export declare function verdictRemunerationMinimale(contrat: ContratPourControle, moisDeReference: string, annexesSmig?: readonly Annexe[], grillesNonLues?: GrillesSmigNonLues | null): VerdictRemunerationMinimale;
