import { ModeEcartEvaluation, MotifExclusionConsolidation, NatureResultatInterne } from '@prisma/client';
export declare class EntitePerimetreDto {
    exerciceId: string;
    nom: string;
    designationMajoriteDeuxExercices?: boolean;
    aucunAutreAssocieSuperieur?: boolean;
    controleContractuel?: boolean;
    accordControleConjoint?: boolean;
    influenceNotableDeclaree?: boolean;
    motifExclusion?: MotifExclusionConsolidation | null;
    justificationExclusion?: string | null;
    dateCloture?: string | null;
    secteurActivite?: string | null;
}
export declare class ModifierEntitePerimetreDto {
    nom?: string;
    designationMajoriteDeuxExercices?: boolean;
    aucunAutreAssocieSuperieur?: boolean;
    controleContractuel?: boolean;
    accordControleConjoint?: boolean;
    influenceNotableDeclaree?: boolean;
    motifExclusion?: MotifExclusionConsolidation | null;
    justificationExclusion?: string | null;
    dateCloture?: string | null;
    secteurActivite?: string | null;
}
export declare class LienParticipationDto {
    exerciceId: string;
    detentriceId?: string | null;
    detenueId: string;
    pctDroitsVote: number;
    pctCapital: number;
}
export declare class ModifierLienParticipationDto {
    pctDroitsVote?: number;
    pctCapital?: number;
}
export declare class FaitsConsolidationDto {
    exerciceId: string;
    sousControleEntiteOhadaConsolidante?: boolean;
    siegesDansDeuxRegions?: boolean;
    appelPublicEpargne?: boolean;
    demandeAssociesDixieme?: boolean;
    entitesControleHorsOhada?: string | null;
    chiffreAffairesN?: number | null;
    chiffreAffairesN1?: number | null;
    seuilEquivalentFc?: number | null;
    sourceSeuil?: string | null;
}
export declare class ImporterBalanceEntiteDto {
    nomFichier: string;
    contenuBase64: string;
}
export declare class AcquisitionDto {
    coutAcquisition: number;
    compteTitres: string;
    dateEntree: string;
    capitauxPropresEntree: number;
    modeDureeEcart: 'LIMITEE' | 'NON_DETERMINABLE';
    dureeEcartAnnees?: number | null;
    depreciationEcartOuverture?: number;
    depreciationEcartCloture?: number;
    dividendesExercice?: number | null;
    compteDividendes?: string | null;
    obligationNonDesengagement?: boolean;
}
export declare class ResultatInterneDto {
    exerciceId: string;
    vendeuseId?: string | null;
    acheteuseId?: string | null;
    nature: NatureResultatInterne;
    compteActif: string;
    margeOuverture: number;
    margeCloture: number;
    libelle: string;
}
export declare class OperationReciproqueDto {
    exerciceId: string;
    entiteAId?: string | null;
    compteA: string;
    entiteBId?: string | null;
    compteB: string;
    montant: number;
    libelle: string;
}
export declare class EcartEvaluationDto {
    compte: string;
    compteAmortissement?: string | null;
    libelle: string;
    montant: number;
    mode: ModeEcartEvaluation;
    dureeAnnees?: number | null;
    dateRealisation?: string | null;
}
export declare class FiscaliteEntiteDto {
    exerciceId: string;
    entiteId?: string | null;
    tauxImpotDiffere?: number | null;
    sourceTauxImpot?: string | null;
    idaOuverture?: number | null;
    idaCloture?: number | null;
    idpOuverture?: number | null;
    idpCloture?: number | null;
    justificationIda?: string | null;
    ecartConversionActifN1?: number | null;
    ecartConversionPassifN1?: number | null;
}
export declare class ProvisionChangeDto {
    exerciceId: string;
    entiteId?: string | null;
    compteProvision: string;
    cloture: number;
    dotation: number;
    reprise: number;
}
export declare class MonnaieEntiteDto {
    monnaieBalance?: string | null;
    justificationMonnaie?: string | null;
    hyperinflation?: boolean;
    coursCloture?: number | null;
    coursProduitsCharges?: number | null;
    coursEntree?: number | null;
    capitauxPropresHistoriques?: number | null;
}
