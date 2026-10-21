export type MethodeIntegree = 'IG' | 'IP' | 'ME';
export interface LigneBalanceEntree {
    numero: string;
    intitule: string;
    solde: number;
    mouvementDebit?: number | null;
    mouvementCredit?: number | null;
}
export interface EntiteACumuler {
    id: string;
    nom: string;
    estConsolidante: boolean;
    methode: MethodeIntegree;
    pctInteret: number;
    balance: LigneBalanceEntree[] | null;
}
export type ModeDureeEcart = 'LIMITEE' | 'NON_DETERMINABLE';
export declare const DUREE_ECART_NON_DETERMINABLE_ANNEES = 10;
export interface AcquisitionDeclaree {
    detentriceId: string;
    detenueId: string;
    pctCapital: number;
    coutAcquisition: number;
    compteTitres: string;
    dateEntree: Date;
    capitauxPropresEntree: number;
    modeDureeEcart: ModeDureeEcart;
    dureeEcartAnnees?: number | null;
    depreciationEcartOuverture?: number;
    depreciationEcartCloture?: number;
    dividendesExercice?: number | null;
    compteDividendes?: string | null;
    obligationNonDesengagement?: boolean;
    ecartsEvaluation?: EcartEvaluation[];
}
export type ModeEcartEvaluation = 'AMORTISSABLE' | 'NON_AMORTISSABLE' | 'REALISE';
export interface EcartEvaluation {
    compte: string;
    compteAmortissement?: string | null;
    libelle: string;
    montant: number;
    mode: ModeEcartEvaluation;
    dureeAnnees?: number | null;
    dateRealisation?: Date | null;
}
export interface FiscaliteEntite {
    entiteId: string;
    tauxImpot: number | null;
    tauxImpotOuverture?: number | null;
    idaOuverture: number | null;
    idaCloture: number | null;
    idpOuverture: number | null;
    idpCloture: number | null;
    justificationIda?: string | null;
}
export interface OperationReciproque {
    entiteAId: string;
    compteA: string;
    entiteBId: string;
    compteB: string;
    montant: number;
    libelle: string;
}
export interface ResultatInterne {
    vendeuseId: string;
    acheteuseId: string;
    nature: 'STOCK' | 'IMMOBILISATION';
    compteActif: string;
    margeOuverture: number;
    margeCloture: number;
    libelle: string;
}
export interface ConversionIndividuelle {
    entiteId: string;
    actifN1: number;
    passifN1: number;
    provisions: {
        compteProvision: string;
        cloture: number;
        dotation: number;
        reprise: number;
    }[];
}
export interface MonnaieEntite {
    entiteId: string;
    monnaie: string | null;
    hyperinflation?: boolean;
    coursCloture?: number | null;
    coursProduitsCharges?: number | null;
    capitauxPropresHistoriques?: number | null;
    coursEntree?: number | null;
}
export interface ConversionEntiteCalculee {
    entite: string;
    monnaie: string;
    coursCloture: number;
    coursProduitsCharges: number;
    ecartConversion: number;
}
export declare const FAMILLES_PROVISION_CHANGE: {
    provision: string;
    dotation: string;
    reprise: string;
    nature: string;
}[];
export type PosteConsolidation = 'ECART_ACQUISITION' | 'AMORTISSEMENT_ECART_ACQUISITION' | 'DEPRECIATION_ECART_ACQUISITION' | 'ECART_ACQUISITION_NEGATIF' | 'DOTATION_ECART_ACQUISITION' | 'REPRISE_ECART_ACQUISITION_NEGATIF' | 'TITRES_MIS_EN_EQUIVALENCE' | 'QUOTE_PART_RESULTAT_ME' | 'PROVISION_ME_NEGATIVE' | 'CAPITAL' | 'PRIMES_CONSOLIDANTE' | 'ECARTS_REEVALUATION_CONSOLIDANTE' | 'RESERVES_GROUPE' | 'INTERETS_MINORITAIRES' | 'RESULTAT_DEJA_CONSTATE' | 'ELIMINATION_RESULTATS_INTERNES' | 'ECARTS_EVALUATION_RESULTAT' | 'IMPOTS_DIFFERES_ACTIF' | 'IMPOTS_DIFFERES_PASSIF' | 'IMPOTS_DIFFERES_RESULTAT' | 'ECARTS_CONVERSION_INDIVIDUELS_RESULTAT' | 'ECARTS_CONVERSION';
export declare const LIBELLE_POSTE: Record<PosteConsolidation, string>;
export declare const POSTES_DE_RESULTAT: Set<PosteConsolidation>;
export interface LigneConsolidee {
    cle: string;
    intitule: string;
    solde: number;
    poste: boolean;
}
export interface EcartCalcule {
    detentrice: string;
    detenue: string;
    methode: MethodeIntegree;
    coutAcquisition: number;
    quotePartCapitauxPropresEntree: number;
    ecart: number;
    dureeAnnees: number;
    amortissementCumuleOuverture: number;
    amortissementCumuleCloture: number;
    dotationExercice: number;
    depreciationCumuleeCloture: number;
}
export interface ResultatCumul {
    lignes: LigneConsolidee[];
    capitauxPropres: {
        capital: number;
        primes: number;
        ecartsReevaluation: number;
        reservesGroupe: number;
        ecartsConversion: number;
        ecartsConversionMinoritaires: number;
        ecartsConversionMe: number;
        resultatGroupe: number;
        interetsMinoritairesHorsResultat: number;
        resultatMinoritaires: number;
        resultatEnsemble: number;
    };
    ecarts: EcartCalcule[];
    avertissements: string[];
    equilibre: number;
    mouvements: {
        cle: string;
        intitule: string;
        debit: number;
        credit: number;
    }[];
    obstaclesFlux: string[];
    dividendesRecusMe: number;
    ecartsEvaluationStocksResultat: number;
    ecartsEvaluation: EcartEvaluationCalcule[];
    impotsDifferesIncomplets: string[];
    conversions: ConversionEntiteCalculee[];
    conversionsIncompletes: string[];
    retraitementsNonJoues: string[];
}
export interface EcartEvaluationCalcule {
    detenue: string;
    libelle: string;
    compte: string;
    montantEntree: number;
    restantOuverture: number;
    restantCloture: number;
    tauxImpot: number;
    impotDiffereCloture: number;
}
export declare class RefusConsolidation extends Error {
}
export declare function motifRefusEcartEvaluation(ev: EcartEvaluation, dateEntree: Date | null): string | null;
export declare function cumulerConsolidation(exercice: {
    dateDebut: Date;
    dateFin: Date;
}, entites: EntiteACumuler[], acquisitions: AcquisitionDeclaree[], reciproques: OperationReciproque[], resultatsInternes?: ResultatInterne[], fiscalites?: FiscaliteEntite[], conversions?: ConversionIndividuelle[], monnaies?: {
    presentation: string;
    entites: MonnaieEntite[];
}): ResultatCumul;
