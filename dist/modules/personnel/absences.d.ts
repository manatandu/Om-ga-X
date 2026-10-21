export type JourIso = string;
export type NatureAbsence = 'MALADIE_OU_ACCIDENT' | 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE' | 'MATERNITE' | 'CONGE_DE_CIRCONSTANCE' | 'EMPECHEMENT_DU_FAIT_DE_L_EMPLOYEUR' | 'ABSENCE_NON_AUTORISEE' | 'MISE_A_PIED' | 'OBLIGATIONS_MILITAIRES' | 'REQUISITION' | 'MANDAT_PUBLIC' | 'GREVE_OU_LOCK_OUT' | 'INCARCERATION' | 'FORCE_MAJEURE';
export type RegimeRemuneration = 'DUE' | 'DEUX_TIERS' | 'NON_DUE' | 'ARRETE_ABSENT';
export type EffetSurLeConge = 'SERVICE' | 'INCAPACITE_PLAFONNEE' | 'INCAPACITE_SANS_PLAFOND' | 'HORS_SERVICE';
export type DefinitionAbsence = {
    readonly libelle: string;
    readonly fondement: string;
    readonly regime: RegimeRemuneration;
    readonly conge: EffetSurLeConge;
    readonly maladie: boolean;
    readonly piece: string | null;
    readonly demiJournees: boolean;
};
export declare const NATURES_ABSENCE: Readonly<Record<NatureAbsence, DefinitionAbsence>>;
export declare const NATURES_ABSENCE_LISTE: NatureAbsence[];
export declare const EVENEMENTS_CIRCONSTANCE: {
    readonly MARIAGE_DU_TRAVAILLEUR: {
        readonly libelle: "Mariage du travailleur";
        readonly jours: 2;
    };
    readonly ACCOUCHEMENT_DE_L_EPOUSE: {
        readonly libelle: "Accouchement de l'épouse";
        readonly jours: 2;
    };
    readonly DECES_CONJOINT_OU_PARENT_PREMIER_DEGRE: {
        readonly libelle: "Décès du conjoint, ou d'un parent allié au 1er degré";
        readonly jours: 4;
    };
    readonly MARIAGE_D_UN_ENFANT: {
        readonly libelle: "Mariage d'un enfant";
        readonly jours: 1;
    };
    readonly DECES_PARENT_SECOND_DEGRE: {
        readonly libelle: "Décès d'un parent ou allié au second degré";
        readonly jours: 2;
    };
};
export type EvenementCirconstance = keyof typeof EVENEMENTS_CIRCONSTANCE;
export declare const PLAFOND_CIRCONSTANCE_PAR_AN = 15;
export declare const MISE_A_PIED_JOURS_AU_PLUS = 15;
export declare const MISES_A_PIED_PAR_AN = 2;
export declare const MATERNITE_JOURS_AU_PLUS: number;
export declare const PREMIER_JOUR_LISIBLE = "2023-03-30";
export declare const iso: (d: Date) => JourIso;
export declare function jourUtc(s: string): Date | null;
export type AbsenceLue = {
    readonly id: string;
    readonly nature: NatureAbsence;
    readonly du: JourIso;
    readonly au: JourIso;
    readonly demiJourneeDebut: boolean;
    readonly demiJourneeFin: boolean;
};
export type JourDAbsence = {
    readonly jour: JourIso;
    readonly ouvrable: boolean;
    readonly poids: number;
};
export declare function joursDeLAbsence(a: Pick<AbsenceLue, 'du' | 'au' | 'demiJourneeDebut' | 'demiJourneeFin'>): JourDAbsence[] | {
    refus: string;
};
export declare const joursOuvrables: (jours: readonly JourDAbsence[]) => number;
export declare function motifRefusAbsence(a: AbsenceLue & {
    readonly evenement: string | null;
    readonly piece: string | null;
}, autres: readonly AbsenceLue[]): string | null;
export declare const finDesSixMois: (du: JourIso) => JourIso;
export declare function debutsDesSuspensions(absences: readonly AbsenceLue[]): Map<string, JourIso>;
export type JourDuMois = {
    readonly jour: JourIso;
    readonly absenceId: string;
    readonly nature: NatureAbsence;
    readonly poids: number;
    readonly regime: RegimeRemuneration;
};
export declare function joursOuvrablesDuMois(absences: readonly AbsenceLue[], mois: string, subrogees?: ReadonlySet<string>): JourDuMois[];
export type CongeLu = {
    readonly id: string;
    readonly du: JourIso;
    readonly au: JourIso;
    readonly joursVoyage: number;
};
export type CongeDuMois = {
    readonly id: string;
    readonly du: JourIso;
    readonly au: JourIso;
    readonly ouvrablesDuMois: number;
    readonly joursDeConge: number | null;
    readonly auMoins: number;
};
export declare function congesDuMois(conges: readonly CongeLu[], mois: string, joursMaladie: ReadonlySet<JourIso>): CongeDuMois[];
export type CongeConfronte = CongeDuMois & {
    readonly remunerationJournaliere?: number | null;
    readonly deviseAllocation?: string | null;
};
export declare function motifRefusSalairePleinPendantLeConge(p: {
    readonly mois: string;
    readonly conges: readonly CongeConfronte[];
    readonly salaireDuBulletin: number;
    readonly salaireMensuel: number | null;
    readonly devise: string;
    readonly joursAbsenceDuMois?: number;
    readonly bulletinEmis?: {
        readonly numero: number;
        readonly issue: string;
    };
}): string | null;
export declare function motifRefusAnnulationDuCongeRetranche(p: {
    readonly mois: string;
    readonly numero: number;
    readonly conge: CongeDuMois;
    readonly salaireDuBulletin: number;
    readonly salaireMensuel: number;
    readonly devise: string;
    readonly joursAbsenceDuMois?: number;
}): string | null;
export declare function raisonDeLaGardeMuette(contrat: {
    readonly remunerationBase: unknown;
    readonly periodiciteRemuneration: string | null;
    readonly deviseRemuneration: string | null;
} | null, devise: string): string | null;
export declare function avertissementGardeMuette(p: {
    readonly mois: string;
    readonly conges: readonly CongeDuMois[];
    readonly raison: string;
    readonly numero?: number;
}): string | null;
export type PropositionDuMois = {
    readonly joursDeuxTiers: number;
    readonly joursNonDus: number;
    readonly joursNonTranches: number;
    readonly joursDeConge: number;
    readonly joursPayesAPlein: number | null;
    readonly salaireDesJoursDus: number | null;
    readonly indemniteDeuxTiers: number | null;
    readonly deductionsCaisse: number;
    readonly aRecevoirDeLaCaisse: number | null;
    readonly baseDuMois: number;
    readonly motifs: readonly string[];
    readonly explication: string | null;
};
export declare function propositionDuMois(p: {
    readonly jours: readonly JourDuMois[];
    readonly salaireMensuel: number | null;
    readonly moyenneMensuelleArticle66: number | null;
    readonly deductionsParAbsence?: ReadonlyMap<string, number>;
    readonly aRecevoirDeLaCaisse?: number;
    readonly subrogationsPartielles?: ReadonlyMap<string, number>;
    readonly mois?: string;
    readonly conges?: readonly CongeDuMois[];
}): PropositionDuMois;
export declare function absencesPourLeCompteur(absences: readonly AbsenceLue[], origine: JourIso | null): {
    joursHorsService: {
        du: JourIso;
        au: JourIso;
        motif: string;
    }[];
    joursMaladie: Set<JourIso>;
};
export declare const NATURES_INDEMNISEES_PAR_LA_CAISSE: ReadonlySet<NatureAbsence>;
export declare function motifRefusIndemniteCaisse(p: {
    nature: NatureAbsence;
    du: JourIso;
    au: JourIso;
    mois: string;
    montant: number;
    traitement: 'DEDUITE' | 'SUBROGATION' | 'SUBROGATION_PARTIELLE';
    piece: string;
    dejaDeclareCeMois: boolean;
}): string | null;
