import type { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import { StatutEcriture, TypeJournal } from '@prisma/client';
import type { CriteresRecherche } from '../comptabilite/recherche-ecritures';
import { type FeuilleEnFlux, type IdentiteEtat, type ParametresFeuilleEnFlux } from './classeur-en-flux';
export declare const NB_COLONNES_JOURNAL = 7;
export declare function formatDuJour(periode: {
    debut: Date;
    fin: Date;
} | null): string;
export interface StatutsDuBloc {
    validees: number;
    brouillard: number;
    situation: number;
}
export declare function compterStatut(s: StatutsDuBloc, statut: StatutEcriture | string, n?: number): void;
export declare function motifBlocChange(code: string, comptes: StatutsDuBloc, lus: StatutsDuBloc): string | null;
export declare function signatureDeLecture(e: {
    id: string;
    journalId: string;
    statut: StatutEcriture | string;
    date: Date;
    dateValeur: Date | null;
    numeroPiece: number | null;
    libelle: string;
}, nombreDeLignes: number): string;
export declare function motifPieceDeplacee(code: string, e: {
    numeroPiece: number | null;
    date: Date;
}): string;
export declare function titreDuBloc(journal: {
    type: TypeJournal;
}, statuts: StatutsDuBloc): string;
export declare function estHorsLivreJournal(statut: StatutEcriture | string): boolean;
export declare function libelleDeLaLigne(ligne: {
    libelle: string | null;
}, ecriture: {
    libelle: string;
    dateValeur: Date | null;
}): string;
export declare function tiersDeLaLigne(compte: {
    numero: string;
    tiersCompte: {
        tiers: {
            code: string;
        };
    } | null;
}, porteDesIndividuels: boolean): string;
export declare function criteresEnClair(c: CriteresRecherche): string | null;
export declare function etatDeCorrection(e: {
    correction?: {
        numeroPiece: number | null;
    } | null;
    corrigeEcriture?: {
        numeroPiece: number | null;
    } | null;
}): string;
export declare const COLONNES_PISTE_REVISION: Partial<ExcelJS.Column>[];
export declare const TITRES_COLONNES_JOURNAL: readonly ["Jour", "N° pièce", "N° compte", "N° tiers", "Libellé", "Débit", "Crédit"];
export interface LigneDuJournal {
    jour: Date;
    numeroPiece: number | null;
    compte: string;
    tiers: string;
    libelle: string;
    debit: number;
    credit: number;
    horsLivreJournal: boolean;
}
export declare function ouvrirJournalEdition(params: {
    sortie: Writable;
    identite: IdentiteEtat;
    formatJour: string;
    tire?: Date;
    selection?: string | null;
}): {
    feuille: ExcelJS.Worksheet;
    classeur: ExcelJS.stream.xlsx.WorkbookWriter;
    ouvrirBloc(journal: {
        code: string;
        intitule: string;
        type: TypeJournal;
    }, statuts: StatutsDuBloc): Promise<void>;
    ajouterLigne(l: LigneDuJournal): Promise<void>;
    fermerBloc(): Promise<void>;
    aucuneEcriture(journal?: {
        code: string;
        intitule: string;
        type: TypeJournal;
    } | null): Promise<void>;
    terminer(suivantes?: (ajouterFeuille: (p: ParametresFeuilleEnFlux) => FeuilleEnFlux) => Promise<void>): Promise<void>;
    totauxPeriode: () => {
        debit: number;
        credit: number;
    };
};
