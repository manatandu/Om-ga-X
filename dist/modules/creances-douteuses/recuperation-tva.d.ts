import { PieceJustificative } from './creances-douteuses';
export declare function mentionDuplicata(ht: number, tva: number): string;
export interface FactureDeLaCreance {
    designationId: string;
    ligneEcritureId: string;
    montant: number;
    dateFacture: Date;
    dateEcheance: Date | null;
    libelle: string;
    numeroPiece: number | null;
    taxe: {
        ttc: number;
        lignesTva: Array<{
            ligneId: string;
            compteId: string;
            numero: string;
            tauxTvaId: string;
            tva: number;
            base: 'DATE_ECRITURE' | 'ENCAISSEMENT';
        }>;
    } | null;
}
export interface TaxeRecuperable {
    compteId: string;
    numero: string;
    tauxTvaId: string;
    tva: number;
}
export interface FactureChiffree {
    designationId: string;
    ligneEcritureId: string;
    libelle: string;
    numeroPiece: number | null;
    dateFacture: string;
    designe: number;
    recouvre: number;
    impayeTtc: number;
    impayeHt: number;
    tvaCorrespondante: number;
    recuperable: TaxeRecuperable[];
    tvaRecuperable: number;
    annulable: TaxeRecuperable[];
    tvaAnnulable: number;
    motifs: string[];
    mention: string;
}
export declare const MOTIF_TAXE_A_L_ENCAISSEMENT = "taxe exigible \u00E0 l\u2019encaissement (O.-L. n\u00B0 10/001, art. 25, 2\u00B0) \u00B7 l\u2019impay\u00E9 n\u2019a jamais \u00E9t\u00E9 encaiss\u00E9, sa taxe jamais acquitt\u00E9e, rien \u00E0 r\u00E9cup\u00E9rer";
export declare const MOTIF_FACTURE_SANS_TVA = "la pi\u00E8ce de la facture ne porte aucune ligne de TVA collect\u00E9e lisible (compte 443 \u00E0 un taux)";
export declare const MOTIF_FACTURE_NON_LUE = "la pi\u00E8ce de la facture n\u2019est pas lue (non valid\u00E9e) \u00B7 sa taxe ne se chiffre pas";
export declare const MOTIF_FACTURE_PAYEE = "les recouvrements ont pay\u00E9 la facture en entier \u00B7 aucun impay\u00E9";
export declare function chiffrerFactures(p: {
    reclasse: number;
    factures: readonly FactureDeLaCreance[];
    recouvrements: ReadonlyArray<{
        date: Date;
        montant: number;
    }>;
}): FactureChiffree[];
export declare function finDuDroit(derniereConstatation: Date): Date;
export declare function derniereDateEcriture(derniereConstatation: Date): Date;
export declare function derniereDateEcritureTrimestrielle(derniereConstatation: Date): Date;
export interface DuplicataSaisi {
    designationId: string;
    reference: string | null | undefined;
    dateEnvoi: string | null | undefined;
}
export interface EntreeRecuperation {
    creanceAnnulee: boolean;
    creanceCorrigee: boolean;
    resteFinal: number;
    pertes: ReadonlyArray<{
        date: Date;
        validee: boolean;
        numeroPiece: number | null;
    }>;
    designationsActives: number;
    chiffrees: readonly FactureChiffree[];
    dejaRecuperees: ReadonlySet<string>;
    duplicatas: readonly DuplicataSaisi[];
    motif: string | null | undefined;
    pieces: readonly PieceJustificative[];
    date: Date;
    exerciceOuvert: boolean;
    dateDansExercice: boolean;
    journalGeneral: boolean;
    finDerniereLiquidation: Date | null;
}
export declare function motifRefusRecuperation(e: EntreeRecuperation): string | null;
export declare function motifRefusDuplicatas(e: {
    chiffrees: readonly FactureChiffree[];
    dejaRecuperees: ReadonlySet<string>;
    duplicatas: readonly DuplicataSaisi[];
    date: Date;
}): string | null;
export declare function motifRefusDateRecuperation(date: Date, derniere: Date, finDerniereLiquidation: Date | null): string | null;
export declare const MOTIF_ANNULATION_RECUPERATION_MIN = 3;
export declare const MOTIF_ANNULATION_RECUPERATION_MAX = 500;
export declare function motifRefusAnnulationRecuperation(p: {
    dejaAnnulee: string | null;
    exerciceClos: boolean;
    liquidationCouvrante: string | null;
    periodeClose: string | null;
    motif: string | null | undefined;
}): string | null;
export declare function motifRecuperationEnPlace(geste: string, nombre: number): string | null;
export declare const RACINE_PROFITS_SUR_CREANCES = "751";
export declare const MESSAGE_TVA_PAR_LA_REGLE_3: string;
export interface VentilationPerte {
    recuperee: TaxeRecuperable[];
    annulee: Array<{
        compteId: string;
        numero: string;
        tva: number;
    }>;
    tva: number;
    tvaAnnulee: number;
}
export declare function ventilerPerte(choisies: readonly FactureChiffree[]): VentilationPerte;
export declare function motifRefusPerteAvecTva(e: {
    montant: number;
    resteFinal: number;
    pertesAnterieures: number;
    chiffrees: readonly FactureChiffree[];
    dejaRecuperees: ReadonlySet<string>;
    duplicatas: readonly DuplicataSaisi[];
    date: Date;
    finDerniereLiquidation: Date | null;
}): string | null;
export declare function motifRefusAnnulationPerteAvecTva(liquidationCouvrante: string | null): string | null;
export declare function informationDecalagePerte(premierJourOuvert: string): string;
