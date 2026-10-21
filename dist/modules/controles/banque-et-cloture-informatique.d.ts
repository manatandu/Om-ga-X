import { GranulariteCloture, Referentiel } from '@prisma/client';
export declare const ENTREE_EN_VIGUEUR_AUDCIF_2017: Date;
export declare const ENTREE_EN_VIGUEUR_SYCEBNL: Date;
export declare function texteEnVigueurPourLExercice(referentiel: Referentiel, dateDebut: Date): boolean;
export declare function estCompteBancaireARapprocher(numero: string): boolean;
export declare function sourceFicheCompte52(referentiel: Referentiel): string;
export declare function sourceClotureInformatique(referentiel: Referentiel): string;
export interface CompteBancaireMouvemente {
    compteId: string;
    numero: string;
    intitule: string;
    soldeCloture: number;
    derniereLigne: Date | null;
}
export interface EtatRapprochementCompte {
    dernierClos: Date | null;
    soldeDernierClos: number | null;
    enCours: Date | null;
}
export interface CompteSansRapprochement {
    reference: string;
    detail: string;
    date?: string;
}
export declare function compteFermeCouvert(c: CompteBancaireMouvemente, etat: EtatRapprochementCompte): boolean;
export declare function releveCouvreLaCloture(etat: EtatRapprochementCompte, dateFin: Date): boolean;
export declare function comptesBancairesSansRapprochement(comptes: CompteBancaireMouvemente[], etats: Map<string, EtatRapprochementCompte>, dateFin: Date, aujourdhui: Date): CompteSansRapprochement[];
export interface CloturePosee {
    granularite: GranulariteCloture;
    journalId: string | null;
    dateLimite: Date;
}
export interface JournalEcrit {
    journalId: string;
    code: string;
}
export interface PeriodeOuverte {
    debut: Date;
    finAuPlusTard: Date;
    echeance: Date;
}
export declare function finDeTroisMois(debut: Date): Date;
export declare function periodeOuverte(dernierJourFige: Date | null, dateDebut: Date, dateFin: Date): PeriodeOuverte | null;
export declare function dernierJourFige(journalId: string, clotures: CloturePosee[]): Date | null;
export declare function premiereEcheanceDepassee(dateDebut: Date, dateFin: Date, aujourdhui: Date): boolean;
export interface JournalEnRetard {
    reference: string;
    detail: string;
    date: string;
}
export declare function journauxEnRetardDeClotureInformatique(journaux: JournalEcrit[], clotures: CloturePosee[], dateDebut: Date, dateFin: Date, aujourdhui: Date): JournalEnRetard[];
export declare function estCompteDeVirementInterne(numero: string): boolean;
export declare function sourceFicheCompte58(referentiel: Referentiel): string;
export interface CompteDeVirementInterne {
    compteId: string;
    numero: string;
    intitule: string;
    soldeLivreJournalCentimes: number;
    soldeToutesLignesCentimes: number;
}
export interface VirementInterneNonSolde {
    reference: string;
    detail: string;
    montant: number;
}
export declare function virementsInternesNonSoldes(comptes: CompteDeVirementInterne[], dateFin: Date, aujourdhui: Date): VirementInterneNonSolde[];
