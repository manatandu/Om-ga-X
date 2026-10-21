export declare const CHAMPS_LIBRES: readonly ["designation", "numeroInventaire", "natureFiscaleCle"];
export declare const CHAMPS_A_EFFET: readonly ["compteImmobilisationId", "compteContrepartieId", "dateAcquisition", "dateMiseEnService", "valeurOrigine", "valeurResiduelle", "dureeAmortissementAns", "modeAmortissement", "unitesOeuvrePrevues", "uniteOeuvreLibelle", "amortissementAnterieur"];
export type ChampAEffet = (typeof CHAMPS_A_EFFET)[number];
export declare function champsAEffetDemandes(dto: Partial<Record<ChampAEffet, unknown>>): ChampAEffet[];
export interface UsageDuBien {
    modele: string;
    champ: string;
    nombre: number;
}
export declare function libelleUsage(u: UsageDuBien): string;
export interface EtatDeLaFiche {
    sortie: boolean;
    autresEcritures: string[];
    acquisition: null | {
        validee: boolean;
        numeroPiece: number | null;
        nombreLignes: number;
        exerciceClos: boolean;
    };
    motifLignesTenues: string | null;
    origineParticuliere: string | null;
    neeDUneEcriturePassee: boolean;
    usages: UsageDuBien[];
    annulationsRetenant: number;
    exerciceClosQuiLaPorte: string | null;
    renouvelle: string | null;
    documents?: number;
}
export declare function exerciceClosQuiPorteLaFiche(p: {
    ficheCreeeLe: Date;
    debutDuJournal: Date | null;
    clos: readonly {
        dateFin: Date;
        clotures: readonly Date[];
    }[];
}): Date | null;
export declare function motifRefusModificationAEffet(e: EtatDeLaFiche): string | null;
export declare function motifRefusSuppression(e: EtatDeLaFiche): string | null;
export interface FicheACopier {
    designation: string;
    compteImmobilisationId: string;
    natureFiscaleCle: string | null;
    lieuId: string | null;
    valeurOrigine: number;
    valeurResiduelle: number;
    dureeAmortissementAns: number;
    modeAmortissement: string;
    unitesOeuvrePrevues: number | null;
    uniteOeuvreLibelle: string | null;
}
export declare function propositionDeDuplication(f: FicheACopier): {
    designation: string;
    compteImmobilisationId: string;
    natureFiscaleCle: string | null;
    lieuId: string | null;
    valeurOrigine: number;
    valeurResiduelle: number;
    dureeAmortissementAns: number;
    modeAmortissement: string;
    unitesOeuvrePrevues: number | null;
    uniteOeuvreLibelle: string | null;
};
