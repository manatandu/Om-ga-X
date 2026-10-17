import type { Prisma } from '@prisma/client';
import { CompteDuPoste } from './etats-financiers.communs';
export interface ReglementARattacher {
    ligneId: string;
    numero: string;
    montant: number;
}
export interface ReglementNonRattache {
    numero: string;
    montant: number;
    motif: string;
}
export interface NaturesDesReglements {
    parLigne: Map<string, CompteDuPoste[]>;
    nonRattaches: ReglementNonRattache[];
}
export declare const MOTIF_REGLEMENT_NON_LETTRE = "R\u00E8glement non lettr\u00E9 avec sa facture \u00B7 sa nature ne se lit pas.";
export declare const MOTIF_GROUPE_A_PLUSIEURS_FACTURES = "R\u00E8glement lettr\u00E9 avec plusieurs factures \u00B7 aucune r\u00E9partition entre elles ne se devine.";
export declare const MOTIF_A_NOUVEAU_SANS_FACTURE = "R\u00E8glement d'une ligne d'\u00E0-nouveau dont la facture d'origine ne se retrouve pas une fois et une seule.";
export declare const MOTIF_FACTURE_SANS_CHARGE = "Facture r\u00E9gl\u00E9e sans ligne de charge lisible.";
export declare const MOTIF_PART_HORS_RESULTAT = "Part du r\u00E8glement d'une facture port\u00E9e sur un compte qui n'entre pas au r\u00E9sultat (taxe, autre compte de bilan) \u00B7 elle reste au 40.";
export declare function partRattachable(numero: string): boolean;
export declare function entreAuResultat(numero: string): boolean;
export declare const DETTES_FOURNISSEURS_RATTACHEES: {
    comptes: string[];
    exclusions: string[];
};
export declare function estDetteFournisseurRattachee(numero: string): boolean;
export type Lecteur = {
    ligneEcriture: {
        findMany: (args: Prisma.LigneEcritureFindManyArgs) => Promise<unknown[]>;
    };
};
export interface LigneDuGroupe {
    id: string;
    lettrageId: string | null;
    compteId: string;
    debit: unknown;
    credit: unknown;
    libelle: string | null;
    dateEcheance: Date | null;
    compte: {
        numero: string;
    };
    ecriture: {
        id: string;
        date: Date;
        libelle: string;
        estANouveauProvisoire: boolean;
        estGenereeParCloture: boolean;
        estSoldeDesComptesDeGestion: boolean;
    };
}
export declare const SELECT_LIGNE: {
    id: true;
    lettrageId: true;
    compteId: true;
    debit: true;
    credit: true;
    libelle: true;
    dateEcheance: true;
    compte: {
        select: {
            numero: true;
        };
    };
    ecriture: {
        select: {
            id: true;
            date: true;
            libelle: true;
            estANouveauProvisoire: true;
            estGenereeParCloture: true;
            estSoldeDesComptesDeGestion: true;
        };
    };
};
export declare const estANouveau: (e: LigneDuGroupe["ecriture"]) => boolean;
export declare function factureDOrigine(db: Lecteur, tenantId: string, an: LigneDuGroupe): Promise<LigneDuGroupe | null>;
export declare function naturesDesReglementsFournisseurs(db: Lecteur, tenantId: string, reglements: ReglementARattacher[]): Promise<NaturesDesReglements>;
export declare function depensesRattachees(depenses: Map<string, CompteDuPoste>, reglements: ReglementARattacher[], natures: NaturesDesReglements): Map<string, CompteDuPoste>;
