import { EtatsIfrs, LigneLegale, RetraitementDeclare } from './etats-ifrs';
export interface RetraitementIfrs1 extends RetraitementDeclare {
    correctionErreur: boolean;
}
export interface LigneOuverture {
    numero: string;
    intitule: string;
    reportDebit: number;
    reportCredit: number;
}
export interface LigneRapprochement {
    cle: string;
    libelle: string;
    fondement?: string;
    nature?: 'METHODE' | 'ERREUR';
    montant: number;
}
export interface Rapprochement {
    titre: string;
    ref: string;
    lignes: LigneRapprochement[];
    depart: number;
    arrivee: number;
    ecart: number;
}
export interface PremiereApplication {
    dateTransition: string;
    ouverture: EtatsIfrs;
    rapprochements: Rapprochement[];
    mentions: string[];
    motifsNonPubliable: string[];
}
export declare function motifRefusAjustementTransition(r: Pick<RetraitementDeclare, 'libelle' | 'lignes'>): string | null;
export declare function lignesOuverture(lignes: LigneOuverture[]): LigneLegale[];
export declare function effetsRetraitement(r: Pick<RetraitementDeclare, 'lignes'>): {
    capitauxPropres: number;
    resultat: number;
    oci: number;
};
export declare function construirePremiereApplication(p: {
    dateTransition: Date;
    ouverture: EtatsIfrs;
    ajustementsTransition: RetraitementIfrs1[];
    capitauxPropresSyscohadaTransition: number;
    comparatif: EtatsIfrs;
    retraitementsComparatif: RetraitementIfrs1[];
    capitauxPropresSyscohadaComparatif: number;
}): PremiereApplication;
