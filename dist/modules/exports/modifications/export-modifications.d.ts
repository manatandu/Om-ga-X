import { StatutEcriture } from '@prisma/client';
export declare const FEUILLE_ECRITURES = "\u00C9critures";
export declare const FEUILLE_SUPPRIMEES = "Supprim\u00E9es";
export declare const FEUILLE_EXPORT = "Export";
export declare const COLONNES_ECHANGE: readonly [{
    readonly header: "Date";
    readonly key: "date";
    readonly width: 12;
    readonly style: {
        readonly numFmt: "dd/mm/yyyy";
    };
}, {
    readonly header: "Code journal";
    readonly key: "journal";
    readonly width: 10;
}, {
    readonly header: "N° de pièce";
    readonly key: "piece";
    readonly width: 14;
}, {
    readonly header: "Référence";
    readonly key: "reference";
    readonly width: 16;
}, {
    readonly header: "Numéro de compte";
    readonly key: "compte";
    readonly width: 14;
}, {
    readonly header: "Libellé";
    readonly key: "libelle";
    readonly width: 36;
}, {
    readonly header: "Débit";
    readonly key: "debit";
    readonly width: 16;
    readonly style: {
        readonly numFmt: "#,##0.00";
    };
}, {
    readonly header: "Crédit";
    readonly key: "credit";
    readonly width: 16;
    readonly style: {
        readonly numFmt: "#,##0.00";
    };
}, {
    readonly header: "Montant en devise";
    readonly key: "montantDevise";
    readonly width: 16;
    readonly style: {
        readonly numFmt: "#,##0.00";
    };
}, {
    readonly header: "Devise";
    readonly key: "devise";
    readonly width: 8;
}, {
    readonly header: "Cours";
    readonly key: "cours";
    readonly width: 12;
    readonly style: {
        readonly numFmt: "0.000000";
    };
}, {
    readonly header: "Échéance";
    readonly key: "echeance";
    readonly width: 12;
    readonly style: {
        readonly numFmt: "dd/mm/yyyy";
    };
}, {
    readonly header: "Jour de valeur";
    readonly key: "jourValeur";
    readonly width: 12;
    readonly style: {
        readonly numFmt: "dd/mm/yyyy";
    };
}, {
    readonly header: "Statut";
    readonly key: "statut";
    readonly width: 11;
}, {
    readonly header: "Mouvement";
    readonly key: "mouvement";
    readonly width: 34;
}, {
    readonly header: "Identifiant de l'écriture";
    readonly key: "identifiant";
    readonly width: 38;
}];
export declare const COLONNES_SUPPRIMEES: readonly [{
    readonly header: "Identifiant de l'écriture";
    readonly key: "identifiant";
    readonly width: 38;
}, {
    readonly header: "Date";
    readonly key: "date";
    readonly width: 12;
    readonly style: {
        readonly numFmt: "dd/mm/yyyy";
    };
}, {
    readonly header: "Code journal";
    readonly key: "journal";
    readonly width: 10;
}, {
    readonly header: "N° de pièce";
    readonly key: "piece";
    readonly width: 14;
}, {
    readonly header: "Libellé";
    readonly key: "libelle";
    readonly width: 36;
}, {
    readonly header: "Envoyée à l'export n°";
    readonly key: "envoyee";
    readonly width: 14;
}];
export interface LigneEchange {
    compte: string;
    libelle: string | null;
    debit: string;
    credit: string;
    devise: string | null;
    montantDevise: string | null;
    cours: string | null;
    echeance: string | null;
}
export interface EcritureEchange {
    id: string;
    date: Date;
    dateValeur: Date | null;
    journal: string;
    numeroPiece: number | null;
    reference: string | null;
    libelle: string;
    statut: StatutEcriture;
    lignes: LigneEchange[];
}
export declare function ordonnerLignes<L extends LigneEchange>(lignes: L[]): L[];
export declare function empreinteEcriture(e: EcritureEchange): string;
export declare function pieceDuFichier(numeroPiece: number | null, id: string): string;
export declare class PiecesDistinctes {
    private jour;
    private prises;
    piece(e: {
        id: string;
        date: Date;
        journal: string;
        numeroPiece: number | null;
    }): string;
}
export interface EntreeRegistre {
    numeroExport: number;
    statutExporte: StatutEcriture;
    empreinte: string;
}
export type Mouvement = 'NOUVELLE' | 'MODIFIEE' | 'RENVOYEE';
export declare function mouvementDe(entree: EntreeRegistre | undefined, empreinteActuelle: string): Mouvement;
export declare function libelleMouvement(m: Mouvement, entree: EntreeRegistre | undefined, statutActuel: StatutEcriture): string;
export declare function nomFichierExport(numero: number, jour: Date): string;
export declare function empreinteFichier(contenu: Buffer): string;
export declare function motifExportVide(dernierNumero: number | null): string;
export declare function motifHorsPlafond(e: {
    journal: string;
    numeroPiece: number | null;
    date: Date;
    lignes: number;
}, plafond: number): string;
export declare const MENTION_RELECTURE: string;
export declare function motifEnvoiNonRelu(colonnes: string[], lignes: string[][], lignesSupprimees: number): string | null;
