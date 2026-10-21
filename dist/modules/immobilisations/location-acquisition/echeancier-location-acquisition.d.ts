import { NatureLocationAcquisition } from '@prisma/client';
export type Periodicite = 'MENSUELLE' | 'TRIMESTRIELLE' | 'SEMESTRIELLE' | 'ANNUELLE';
export declare const MOIS_PAR_PERIODE: Record<Periodicite, number>;
export interface ContratSaisi {
    nature: NatureLocationAcquisition;
    datePriseEffet: Date;
    dureeMois: number;
    periodicite: Periodicite;
    termeAEchoir: boolean;
    loyer: number;
    prixOption: number;
    optionRaisonnablementCertaine: boolean;
    bienDeFaibleValeur: boolean;
    tauxAnnuel?: number | null;
    valeurContrat?: number | null;
    garantieValeurResiduelle?: number;
    loyerIndexe?: boolean;
    indiceLoyer?: string | null;
    valeurIndiceCommencement?: number | null;
}
export declare function motifLocationSimple(c: Pick<ContratSaisi, 'nature' | 'dureeMois' | 'optionRaisonnablementCertaine' | 'bienDeFaibleValeur'>): string | null;
export declare function tauxPeriodiqueEquivalent(tauxAnnuel: number, moisParPeriode: number): number;
export declare function valeurActualisee(c: ContratSaisi, i: number): number;
export declare function tauxImplicitePeriodique(c: ContratSaisi, valeur: number): number | null;
export interface LigneEcheancier {
    rang: number;
    date: Date;
    paiement: number;
    interets: number;
    capital: number;
    restant: number;
    option: boolean;
    garantie: boolean;
}
export interface Echeancier {
    dette: number;
    tauxPeriodique: number;
    lignes: LigneEcheancier[];
}
export declare function motifRefusContrat(c: ContratSaisi): string | null;
export declare function construireEcheancier(c: ContratSaisi): Echeancier;
export declare function motifRefusComplements(c: Pick<ContratSaisi, 'garantieValeurResiduelle' | 'loyerIndexe' | 'indiceLoyer' | 'valeurIndiceCommencement'>): string | null;
