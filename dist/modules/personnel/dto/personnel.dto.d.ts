import type { RegimeSalarial } from '../bareme-irpp';
import { PeriodiciteRemuneration, SexeTravailleur, TypeContratTravail } from '@prisma/client';
export declare class EnfantAChargeDto {
    nom: string;
    postNom?: string;
    prenoms?: string;
    dateNaissance?: string;
}
export declare class SalarieDto {
    matricule?: string;
    nom: string;
    postNom?: string;
    prenoms?: string;
    sexe: SexeTravailleur;
    numeroAffiliationCnss?: string;
    dateNaissance?: string;
    millesimeNaissance?: number;
    lieuNaissance?: string;
    nationalite?: string;
    nomConjoint?: string;
    aptitudeConstateeLe?: string;
    aptitudeConstateePar?: string;
    aptitudeProvisoire?: boolean;
    declarationEngagementLe?: string;
    declarationDepartLe?: string;
    actif?: boolean;
    enfants?: EnfantAChargeDto[];
}
export declare const MOTIF_MONNAIE_REMUNERATION = "La monnaie de la r\u00E9mun\u00E9ration convenue est le franc congolais (CDF) ou le dollar am\u00E9ricain (USD).";
export declare class ContratTravailDto {
    type: TypeContratTravail;
    constateParEcrit?: boolean;
    dateEntreeEnVigueur: string;
    dateConclusion?: string;
    lieuConclusion?: string;
    dateFinPrevue?: string;
    separeDeSaFamille?: boolean;
    ouvrageDetermine?: string;
    motifRemplacement?: string;
    emploiPermanent?: boolean;
    natureTravail?: string;
    lieuExecution?: string;
    categorieProfessionnelle?: string;
    classeProfessionnelle?: number;
    periodiciteRemuneration?: PeriodiciteRemuneration;
    manoeuvreSansSpecialite?: boolean;
    remunerationBase?: number;
    deviseRemuneration?: 'CDF' | 'USD';
    avantagesConvenus?: string;
    clauseEssai?: boolean;
    essaiConstateParEcrit?: boolean;
    essaiDureeJours?: number;
    dureePreavisJours?: number;
    viseParOnem?: boolean;
    dateVisaOnem?: string;
    renouvelleDeId?: string;
}
export declare class DeviseRemunerationDto {
    deviseRemuneration: 'CDF' | 'USD';
}
export declare class TerminerContratDto {
    dateFin: string;
    motifFin?: string;
}
export declare const MOTIF_MONTANT_AU_CENTIME = "Le montant d'un \u00E9l\u00E9ment de paie se saisit en francs, au centime (deux d\u00E9cimales au plus).";
export declare class ElementPaieDto {
    nature: string;
    libelle: string;
    montantFc: number;
    montantUsd?: number;
    remboursementDeDepenseProfessionnelleEffective?: boolean;
    conditionArticle69Attestee?: boolean;
    enNature?: boolean;
    rubriqueId?: string;
}
export declare class RetenueAvanceDto {
    avanceId: string;
    montantFc: number;
}
export declare class AllocationCongePorteeDto {
    congeId: string;
}
export declare class HeuresMajoreesDto {
    majorationId: string;
    heures: number;
    tauxHoraire: number;
}
export declare class SimulationPaieDto {
    moisDePaie: string;
    allocationsConge?: AllocationCongePorteeDto[];
    heuresMajorees?: HeuresMajoreesDto[];
    retenuesAvances?: RetenueAvanceDto[];
    elements: ElementPaieDto[];
    deviseStipulation?: 'CDF' | 'USD';
    dateMiseADisposition?: string;
    personnesACharge?: number;
    retenuesArticle71Fc?: number;
    tauxLegalAllocationsFamilialesFc?: number;
    enfantsBeneficiairesAllocations?: number;
    joursAllocationsFamiliales?: number;
    natureEmployeurInpp?: string;
    reductionTauxInppPoints?: number;
    referenceReductionInpp?: string;
    regimeSalarial?: RegimeSalarial;
    joursPayes?: number;
    effectif?: number;
    majorationRisquesProfessionnelsPourCent?: 50 | 100;
    classeProfessionnelle?: number;
    logementFourniEnNature?: boolean;
    logementEnNatureDejaDefalque?: boolean;
    obligationAlimentaireLegale?: boolean;
}
export declare class ParametresCotisationsDto {
    natureEmployeurInpp?: string;
    effectif?: number;
    majorationRisquesProfessionnelsPourCent?: 50 | 100;
}
export declare class GratificationStipuleeDto {
    montantAnnuelFc: number;
    source: string;
    debutPeriode: string;
    finPeriode: string;
}
export declare class IndemniteStipuleeDto {
    montantFc: number;
    source: string;
}
export declare class DecompteFinalDto {
    anneesAnciennete: number;
    moisNonCouvertsParUnConge: number;
    moinsDeDixHuitAns?: boolean;
    initiative: string;
    motif: string;
    typeContrat: string;
    periodeDEssai?: boolean;
    joursDEssaiEcoules?: number;
    delegueSyndical?: boolean;
    dateNotification?: string;
    preavisRetenuJours?: number;
    forceMajeureConstateeParInspecteur?: boolean;
    deuxMoisDeSuspension?: boolean;
    executionPreavis?: string;
    joursPreavisNonObserves?: number;
    avantagesEnNatureRestantsFc?: number;
    nouvelEmploiJustifie?: boolean;
    delaiDepartNouvelEmploiJours?: number;
    partieResponsable?: string;
    remunerationJournaliereFc?: number;
    remunerationMensuelleFc?: number;
    moyenneMensuelleArticle66Fc?: number;
    moyenneMensuelleArticle142Fc?: number;
    avantagesPendantPreavisFc?: number;
    dateRuptureContrat?: string;
    dateTermeContrat?: string;
    avantagesJusquAuTermeFc?: number;
    montantConvenuCommunAccordFc?: number;
    arrieresFc?: number;
    gratificationFc?: number;
    gratificationStipulee?: GratificationStipuleeDto;
    indemniteStipulee?: IndemniteStipuleeDto;
    moisDeCessation?: string;
    enfantsBeneficiairesAllocations?: number;
    joursAllocationsFamiliales?: number;
}
export declare const MOTIF_ANCIENNETE_EXIGEE = "D\u00E9clarez l'anciennet\u00E9 du travailleur en ann\u00E9es enti\u00E8res, z\u00E9ro compris \u00B7 le pr\u00E9avis en d\u00E9pend (article 64).";
export declare const MOTIF_MOIS_NON_COUVERTS_EXIGES = "D\u00E9clarez les mois de service non couverts par un cong\u00E9, z\u00E9ro compris \u00B7 l'indemnit\u00E9 compensatoire en d\u00E9pend (article 144).";
export declare class DecompteFinalEmisDto extends DecompteFinalDto {
    anneesAnciennete: number;
    moisNonCouvertsParUnConge: number;
}
export declare class VentilationAvantageDto {
    rubrique: string;
    nature: 'LOGEMENT_OU_SON_INDEMNITE' | 'INDEMNITE_DE_TRANSPORT' | 'SOINS_DE_SANTE' | 'REMUNERATION';
    libelle: string;
    montantFc: number;
    conditionArticle69Attestee?: boolean;
}
export declare class EmissionDecompteFinalDto {
    decompte: DecompteFinalEmisDto;
    paie: SimulationPaieDto;
    ventilationAvantages?: VentilationAvantageDto[];
}
export declare class LivreDePaieDto {
    siegeDExploitation?: string;
    formeDuDocument?: string;
    autorisationInspecteurDuTravail?: boolean;
    effectifHabituel?: number;
    exclusivementPersonnelDomestique?: boolean;
    mentionsPortees?: number[];
}
export declare class AnnulationBulletinDto {
    motif: string;
}
export declare class RemiseBulletinDto {
    remisLe: string;
}
export declare class ComptabilisationPaieDto {
    exerciceId: string;
    journalId: string;
    date: string;
    libelle?: string;
    inscrireNegatifs?: boolean;
}
export declare class RubriquePaieDto {
    code: string;
    libelle: string;
    nature: string;
    fondement: string;
}
export declare class ModifierRubriquePaieDto {
    libelle?: string;
    fondement?: string;
    actif?: boolean;
}
export declare class AvanceSalaireDto {
    type: 'AVANCE' | 'ACOMPTE' | 'PRET' | 'SAISIE_ARRET';
    categoriePret?: 'IMMOBILIER' | 'MOBILIER_ET_INSTALLATION' | 'AUTRE';
    dateOctroi: string;
    montantFc: number;
    retenueMensuelleFc?: number;
    objet: string;
    pieceJustificative: string;
    referenceActe?: string;
    greffe?: string;
    destinataire?: string;
}
export declare class FinSaisieArretDto {
    dateFin: string;
}
export declare class VersionBaremePaieDto {
    bareme: 'CNSS' | 'INPP' | 'ONEM' | 'SMIG';
    aPartirDu: string;
    reference: string;
    valeurs: Record<string, unknown>;
}
export declare class LigneModeleBulletinDto {
    nature: string;
    libelle: string;
    rubriqueId?: string | null;
    montant?: number | null;
}
export declare class ModeleBulletinDto {
    nom: string;
    categorie?: string;
    deviseStipulation: 'CDF' | 'USD';
    lignes: LigneModeleBulletinDto[];
}
