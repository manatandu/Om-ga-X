import { ClasseCompte, TypeCompteDetailTotal } from '@prisma/client';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import { NegatifTardif } from '../exercice/ouverture-passee';
import { MOTIF_EXERCICE_INTROUVABLE } from '../../common/exercice-introuvable';
export interface CompteDuPoste {
    numero: string;
    intitule: string;
    montant: number;
}
export interface LigneBalancePourEtat {
    compteId: string;
    numero: string;
    intitule: string;
    classe: ClasseCompte;
    typeCompte: TypeCompteDetailTotal;
    totalDebit: number;
    totalCredit: number;
    reportDebit: number;
    reportCredit: number;
    mouvementDebit: number;
    mouvementCredit: number;
    solde: number;
}
export declare function correspond(numero: string, prefixes: readonly string[], exclusions?: readonly string[]): boolean;
export { MOTIF_EXERCICE_INTROUVABLE };
export declare function trouverExerciceN1(exerciceService: ExerciceService, tenantId: string, exerciceId: string): Promise<string | null>;
export declare function exerciceCloture(exerciceService: ExerciceService, tenantId: string, exerciceId: string): Promise<boolean>;
export declare function exercicePrecedentCloture(exerciceService: ExerciceService, tenantId: string, exerciceN1Id: string | null): Promise<boolean>;
export declare function exercicePrecedentTenu(exercicePrecedentId: string | null, lignesPrecedent: readonly LigneBalancePourEtat[]): boolean;
export declare function mentionExercicePrecedentVide(referentiel: 'SYSCOHADA' | 'SYCEBNL', ouvertureLue: boolean, auBrouillard?: number, clos?: boolean): string;
export declare function brouillardDuPrecedentNonTenu(ecritureService: EcritureService, tenantId: string, exerciceN1Id: string | null, n1Tenu: boolean): Promise<number>;
export declare function precedentNonTenuCloture(exerciceService: ExerciceService, tenantId: string, exerciceN1Id: string | null, n1Tenu: boolean): Promise<boolean>;
export declare function motifColonneN1NonTenue(referentiel: 'SYSCOHADA' | 'SYCEBNL', auBrouillard?: number, clos?: boolean): string;
export type ProvenanceComparatif = 'EXERCICE_N1' | 'BILAN_D_OUVERTURE';
export declare function lignesALOuverture<L extends LigneBalancePourEtat>(lignes: readonly L[]): L[];
export declare function ouvertureTenue(lignes: readonly LigneBalancePourEtat[]): boolean;
export interface OuverturePasseeEnOd {
    nombre: number;
    pieces: string[];
}
export declare function lireOuverturePasseeEnOd(ecritureService: EcritureService, tenantId: string, exerciceId: string, exerciceN1Id: string | null, ouvertureN: readonly LigneBalancePourEtat[]): Promise<OuverturePasseeEnOd | null>;
export declare function lireNegatifsTardifsDeLOuverture(ecritureService: EcritureService, tenantId: string, exerciceId: string, exerciceN1Id: string | null, ouvertureN: readonly LigneBalancePourEtat[]): Promise<NegatifTardif[]>;
export declare function mentionNegatifsTardifs(negatifs: readonly NegatifTardif[], referentiel: 'SYSCOHADA' | 'SYCEBNL'): string | null;
export declare function avecNegatifsTardifs(mention: string | null, negatifs: readonly NegatifTardif[], referentiel: 'SYSCOHADA' | 'SYCEBNL'): string | null;
export interface EtatDuPrecedentNonTenu {
    auBrouillard: number;
    clos: boolean;
}
export declare function etatDuPrecedentNonTenu(ecritureService: EcritureService, exerciceService: ExerciceService, tenantId: string, precedentId: string | null, tenu: boolean): Promise<EtatDuPrecedentNonTenu | null>;
export declare function motifOuverturePasseeEnOd(o: OuverturePasseeEnOd, referentiel: 'SYSCOHADA' | 'SYCEBNL', precedent?: EtatDuPrecedentNonTenu | null): string;
export interface PosteDeFluxVide {
    ref: string;
    raison: string;
    aLever: boolean;
}
export interface ControleTableauDesFlux {
    tresorerieOuverture: number | null;
    variation: number | null;
    tresorerieClotureParFlux: number | null;
    tresorerieClotureParBilan: number;
    ecart: number | null;
    coherent: boolean | null;
    motifNonControlable: string | null;
}
export declare function controleDuTableauDesFlux(p: {
    ouverture: {
        ref: string;
        montant: number;
    };
    variation: {
        ref: string;
        montant: number;
    };
    clotureParFlux: {
        ref: string;
        montant: number;
    };
    clotureParBilan: number;
    vides: ReadonlySet<string>;
}): ControleTableauDesFlux;
export declare function mentionOuverturePresumeeNulle(referentiel: 'SYSCOHADA' | 'SYCEBNL'): string;
export declare function comparatifDuBilan(exerciceN1Id: string | null, lignesN1: LigneBalancePourEtat[], ouvertureN: LigneBalancePourEtat[], ouverturePassee: OuverturePasseeEnOd | null, referentiel: 'SYSCOHADA' | 'SYCEBNL'): {
    provenance: ProvenanceComparatif | null;
    lignes: LigneBalancePourEtat[];
    mention: string | null;
};
export declare function mentionComparatifSurOuverture(referentiel: 'SYSCOHADA' | 'SYCEBNL'): string;
export declare const MOTIF_RESULTAT_N1_NON_TENU: string;
export declare function chargerLignesCumulees(ecritureService: EcritureService, tenantId: string, exerciceId: string | null): Promise<LigneBalancePourEtat[]>;
export declare function chargerLignes(ecritureService: EcritureService, tenantId: string, exerciceId: string | null, arreteAu?: Date): Promise<LigneBalancePourEtat[]>;
export declare function chargerOuverture(ecritureService: EcritureService, tenantId: string, exerciceId: string | null, arreteAu?: Date): Promise<LigneBalancePourEtat[]>;
