import { NatureCreanceDouteuse, Prisma, Referentiel, TypeMouvementCreanceDouteuse } from '@prisma/client';
export declare function nonCorrigeeAu(au: Date): Prisma.CreanceDouteuseWhereInput;
export declare const RACINES_CREANCE_SOURCE: Readonly<Record<Referentiel, readonly string[]>>;
export declare const COMPTES_CREANCES_DOUTEUSES: {
    readonly dotation: "6594";
    readonly reprise: "7594";
    readonly creances416: "416";
    readonly pertes651: "651";
};
export declare function compte491(nature: NatureCreanceDouteuse): string;
export declare function debiteurSycebnl(numeroSource: string): 'ADHERENT' | 'CLIENT_USAGER' | null;
export declare function compte416Propose(referentiel: Referentiel, nature: NatureCreanceDouteuse, numeroSource: string): string | null;
export declare function comptePertePropose(referentiel: Referentiel, numeroSource: string): string | null;
export declare function motifRefus651Croise(referentiel: Referentiel, numeroSource: string, numeroPerte: string): string | null;
export type MethodeCotisationsDeclaree = 'APPEL' | 'ENCAISSEMENT' | null;
export declare function estImpayeAdherent(numeroSource: string): boolean;
export type MethodeAuReclassement = {
    connue: true;
    methode: MethodeCotisationsDeclaree;
} | {
    connue: false;
    motif: string;
};
export interface EtatDeLaMethodeLu {
    le: Date;
    avant: MethodeCotisationsDeclaree | undefined;
    apres: MethodeCotisationsDeclaree | undefined;
}
export declare function methodeLueDansLeJournal(etat: unknown): MethodeCotisationsDeclaree | undefined;
export declare function avertissementMethodeInconnue(motif: string): string;
export declare function methodeAuReclassement(e: {
    figee: 'APPEL' | 'ENCAISSEMENT' | 'NON_DECLAREE' | null;
    geste: Date;
    actuelle: MethodeCotisationsDeclaree;
    journal: {
        debut: Date | null;
        dernierAvant: EtatDeLaMethodeLu | null;
        premierApres: EtatDeLaMethodeLu | null;
    } | null;
}): MethodeAuReclassement;
export declare const ISSUES_IMPAYE_RECLASSE: string;
export declare function motifRefusDotationImpayeAdherent(referentiel: Referentiel | undefined, numeroSource: string | undefined, methodeAuReclassementConnue: MethodeCotisationsDeclaree | undefined): string | null;
export declare const ISSUES_IMPAYE_ADHERENT: string;
export declare function motifImpayeAdherentSousEncaissement(numeroSource: string): string;
export declare function motifRefusCotisationsEncaissement(referentiel: Referentiel, numeroSource: string, methode: MethodeCotisationsDeclaree): string | null;
export declare function motifRefusPerteImpayeAdherent(referentiel: Referentiel | undefined, numeroSource: string | undefined, methode: MethodeCotisationsDeclaree | undefined): string | null;
export declare const CONTROLE_CREANCE_ADHERENT_SOUS_ENCAISSEMENT: {
    readonly libelle: "Impayé d'adhérent reclassé au 4161 sous la méthode de l'encaissement";
    readonly consequence: string;
    readonly action: string;
};
export declare function avertissementMethodeCotisations(referentiel: Referentiel, numeroSource: string, methode: MethodeCotisationsDeclaree): string | null;
export declare const centimes: (x: number) => number;
export interface PieceJustificative {
    nature: string;
    reference: string;
    date: string | null;
}
export declare function piecesLisibles(pieces: readonly {
    nature?: string | null;
    reference?: string | null;
    date?: string | null;
}[] | null | undefined): PieceJustificative[];
export declare function motifRefus416Croise(referentiel: Referentiel, nature: NatureCreanceDouteuse, numeroSource: string, numero416: string): string | null;
export declare const MOTIF_CREANCE_EN_DEVISE: string;
export interface EntreeReclassement {
    referentiel: Referentiel;
    nature: NatureCreanceDouteuse;
    numeroSource: string;
    sourceEstDetail: boolean;
    numero416: string;
    numero416EstDetail: boolean;
    montant: number;
    soldeDebiteur: number;
    soldeDernier?: number;
    positionEnDevise: boolean;
    motif: string | null | undefined;
    pieces: PieceJustificative[];
    exerciceOuvert: boolean;
    dateDansExercice: boolean;
    journalGeneral: boolean;
    methodeCotisations?: MethodeCotisationsDeclaree;
}
export declare function motifRefusReclassement(e: EntreeReclassement): string | null;
export declare function depreciationEnPlace(revues: readonly {
    exerciceDateFin: Date;
    ecart: number;
}[], avant: Date): number;
export declare function resteDeLaCreance(montant: number, mouvements: readonly {
    date: Date;
    montant: number;
}[], au: Date): number;
export declare function resteFinalDeLaCreance(montant: number, mouvements: readonly {
    montant: number;
}[]): number;
export declare function motifResteNegatif(creance: string, resteFinal: number): string | null;
export declare function ecartDeDepreciation(enPlace: number, necessaire: number): number;
export interface EntreeRevue {
    necessaire: number;
    enPlace: number;
    reste: number;
    resteNegatif?: string | null;
    motif: string | null | undefined;
    pieces: PieceJustificative[];
    exerciceOuvert: boolean;
    avantReclassement: boolean;
    revuePosterieure: string | null;
    anterieursSansRevue: string[];
    refusSmt: string | null;
    refusImpaye?: string | null;
    journalGeneral: boolean;
}
export declare function motifRefusRevue(e: EntreeRevue): string | null;
export interface EntreeMouvement {
    type: TypeMouvementCreanceDouteuse;
    montant: number;
    reste: number;
    resteFinal?: number;
    motif: string | null | undefined;
    pieces: PieceJustificative[];
    exerciceOuvert: boolean;
    dateDansExercice: boolean;
    avantReclassement: boolean;
    revueApres: string | null;
    journalAttendu: boolean;
    numeroPerte?: string | null;
    numeroPerteEstDetail?: boolean;
    referentiel?: Referentiel;
    numeroSource?: string;
    methodeCotisations?: MethodeCotisationsDeclaree;
}
export declare function motifRefusMouvement(e: EntreeMouvement): string | null;
export declare function enPlaceAvant(c: {
    declareeOuverture: boolean;
    depreciationOuverture: number;
    dateReclassement: Date;
}, revues: readonly {
    exerciceDateFin: Date;
    ecart: number;
}[], avant: Date): number;
export declare function revueAFaire(p: {
    revueDeLExercice: boolean;
    enPlace: number;
    reste: number;
    aucuneRevue: boolean;
}): boolean;
export interface DepreciationOrpheline {
    creance: string;
    enPlace: number;
    reste: number;
    resteFinal?: number;
}
export declare function motifClotureDepreciationsOrphelines(liste: readonly DepreciationOrpheline[]): string | null;
export declare function motifNonRetirable(p: {
    revuesTotal: number;
    mouvementsTotal: number;
    exerciceClos: boolean;
    ecriture: {
        statut: 'BROUILLARD' | 'VALIDEE';
        tenue: boolean;
    } | null;
}): string | null;
export declare function motifLettrageFigeAuBrouillard(code: string, figee: string, objet: 'le mouvement' | 'le reclassement'): string;
export declare const INFORMATION_BORNE_RECONSTITUEE: string;
export declare function motifLignesANouveauADesigner(numero416: string): string;
export declare function informationLettrageMaintenu(code: string, figee: string): string;
export declare const MOTIF_ANNULATION_MIN = 3;
export declare const MOTIF_ANNULATION_MAX = 500;
export declare function motifRefusAnnulationRevue(p: {
    dejaAnnulee: string | null;
    exerciceClos: boolean;
    posterieureNonAnnulee: string | null;
    motif: string | null | undefined;
}): string | null;
export declare function motifRefusAnnulationReclassement(p: {
    dejaAnnulee: string | null;
    exerciceClos: boolean;
    revuesNonAnnulees: number;
    mouvementsNonAnnules: number;
    motif: string | null | undefined;
}): string | null;
export declare function motifRefus491(nature: NatureCreanceDouteuse, numero491: string, estDetail: boolean): string | null;
export interface EntreeDeclaration {
    referentiel: Referentiel;
    nature: NatureCreanceDouteuse;
    numeroSource: string;
    numero416: string;
    numero416EstDetail: boolean;
    montant: number;
    depreciation: number;
    source: string | null | undefined;
    dateDebutExercice: boolean;
    exerciceOuvert: boolean;
    aNouveau: boolean;
    aNouveau416: number;
    dejaDeclare416: number;
    aNouveau491: number;
    dejaDeclare491: number;
    sourceEstDetail?: boolean;
    comptesEnSommeil?: string[];
    positionEnDevise?: boolean;
    enDevise416?: number;
    methodeCotisations?: MethodeCotisationsDeclaree;
}
export declare function motifRefusDeclaration(e: EntreeDeclaration): string | null;
export declare function motifRefusAnnulationMouvement(p: {
    dejaAnnule: string | null;
    exerciceClos: boolean;
    revueNonAnnulee: string | null;
    motif: string | null | undefined;
}): string | null;
export declare function mouvementsSansRevue(p: {
    revueDeLExercice: boolean;
    mouvementsDeLExercice: number;
}): number;
export declare const MOTIF_LETTRAGE_PARTAGE = "cette facture partage son lettrage avec d\u2019autres ; le recouvrement sera list\u00E9 parmi les recouvrements sans facture d\u00E9sign\u00E9e, TVA \u00E0 d\u00E9clarer par le cabinet";
export declare function partageSonLettrage(x: {
    debit: unknown;
    credit: unknown;
    lettrage?: {
        lignes?: Array<{
            debit: unknown;
            credit: unknown;
        }>;
    } | null;
}): boolean;
export declare const MOTIF_SANS_FACTURE_DESIGNEE = "aucune facture d\u00E9sign\u00E9e";
export declare const MOTIF_SANS_LIGNE_DE_TVA = "la facture d\u00E9sign\u00E9e ne porte aucune ligne de TVA lue";
export declare function motifRefusDesignation(p: {
    creanceAnnulee: boolean;
    memeCompte: boolean;
    validee: boolean;
    sensFacture: number;
    montant: number;
    ouvert: number;
    designeeAilleurs: boolean;
    dejaDesignee: boolean;
    aNouveau?: boolean;
    lettragePartage?: boolean;
    totalDesigne: number;
    montantCreance: number;
    numeroCompte: string;
}): string | null;
export interface EntreeCorrectionParResultat {
    referentiel: Referentiel;
    numeroSource: string;
    methode: MethodeAuReclassement;
    actuelle: MethodeCotisationsDeclaree;
    declareeOuverture: boolean;
    exerciceCreanceClos: boolean;
    exerciceEcritureApres: boolean;
    exerciceEcritureOuvert: boolean;
    ecritureValidee: boolean;
    detenteurs: readonly string[];
    credit416: number;
    debit491: number;
    autres: readonly {
        numero: string;
        gestion: boolean;
    }[];
    reste: number;
    enPlace: number;
    mouvementApres: string | null;
    revueApres: string | null;
    motif: string | null | undefined;
}
export declare function motifRefusCorrectionParResultat(e: EntreeCorrectionParResultat): string | null;
