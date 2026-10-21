export type JourIso = string;
export declare const jourUtc: (s: string) => Date | null;
export declare function moinsDeDixHuitAnsAu(date: Date, dateNaissance: Date | null, millesimeNaissance: number | null): boolean | null;
export type StatutMoisDeService = 'ACQUIS' | 'REPRIS' | 'EN_COURS' | 'SANS_BULLETIN' | 'NON_ENTIER' | 'HORS_CONTRAT' | 'AGE_INCONNU';
export type MoisDeService = {
    readonly du: JourIso;
    readonly au: JourIso;
    readonly statut: StatutMoisDeService;
    readonly jours: number | null;
    readonly motif: string | null;
};
export type PeriodeDeConges = {
    readonly rang: number;
    readonly du: JourIso;
    readonly au: JourIso;
    readonly etat: 'NEE' | 'EN_COURS' | 'REPRISE' | 'FIN_DE_SERVICE';
    readonly mois: readonly MoisDeService[];
    readonly moisAcquis: number;
    readonly joursDeBase: number | null;
    readonly joursDAnciennete: number;
    readonly joursAcquis: number | null;
};
export type FaitsDuCompteur = {
    readonly origine: JourIso;
    readonly fin: JourIso | null;
    readonly dateNaissance: JourIso | null;
    readonly millesimeNaissance: number | null;
    readonly moisPayes: readonly string[];
    readonly joursHorsService: readonly {
        readonly du: JourIso;
        readonly au: JourIso;
        readonly motif: string;
    }[];
    readonly reprise: {
        readonly arreteAu: JourIso;
        readonly joursNesNonPris: number;
        readonly moisEnCoursAccomplis: number;
    } | null;
    readonly conges: readonly {
        readonly id: string;
        readonly du: JourIso;
        readonly jours: number;
    }[];
    readonly aLa: JourIso;
};
export type CompteurConges = {
    readonly periodes: readonly PeriodeDeConges[];
    readonly droitsNes: number | null;
    readonly pris: number;
    readonly solde: number | null;
    readonly enCours: number | null;
    readonly signaux: readonly string[];
    readonly congesAvantReprise: readonly string[];
};
export declare function motifRefusReprise(p: {
    origine: JourIso;
    arreteAu: JourIso;
    joursNesNonPris: number;
    moisEnCoursAccomplis: number;
    source: string;
}): string | null;
export declare function joursDuConge(p: {
    du: JourIso;
    au: JourIso;
    joursVoyage: number;
    joursMaladie: ReadonlySet<JourIso>;
}): {
    jours: number;
    ouvrables: number;
    maladie: number;
} | {
    refus: string;
};
export declare function dernierJourOuvrableAvant(du: JourIso): JourIso | null;
export declare function compteurConges(f: FaitsDuCompteur): CompteurConges | {
    refus: string;
};
