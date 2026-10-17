import type { FondementVentilation } from '../ventilation-prix-global';
import { FondementValeurAleatoire, MethodeEstimationPartie, NatureAcquisitionAleatoire, MethodeDepreciationBienSubventionne, NatureReductionSubvention, ModeAmortissement, NatureLocationAcquisition, NatureSortieImmobilisation, PeriodiciteLoyer, SensDepreciation, TypeComposant } from '@prisma/client';
export declare class CreerFamilleDto {
    code: string;
    intitule: string;
    compteImmobilisationId: string;
    compteAmortissementId: string;
    compteDotationId: string;
    dureeAmortissementAns: number;
    modeAmortissement?: ModeAmortissement;
}
export declare class ModifierFamilleDto {
    intitule?: string;
    dureeAmortissementAns?: number;
    estActif?: boolean;
}
export declare class CriteresFraisDeveloppementDto {
    FAISABILITE_TECHNIQUE?: string;
    INTENTION?: string;
    CAPACITE?: string;
    AVANTAGES_ECONOMIQUES?: string;
    RESSOURCES?: string;
    EVALUATION_FIABLE?: string;
}
export declare class CreerImmobilisationDto {
    familleId?: string;
    compteImmobilisationId?: string;
    designation: string;
    numeroInventaire?: string;
    lieuId?: string;
    dateAcquisition: string;
    dateMiseEnService?: string | null;
    compteEnCoursId?: string;
    natureFiscaleCle?: string | null;
    valeurOrigine: number;
    valeurResiduelle?: number;
    dureeAmortissementAns?: number;
    modeAmortissement?: ModeAmortissement;
    unitesOeuvrePrevues?: number;
    uniteOeuvreLibelle?: string;
    amortissementAnterieur?: number;
    repris?: boolean;
    compteContrepartieId?: string;
    exerciceId: string;
    journalId?: string;
    immobilisationPrincipaleId?: string;
    typeComposant?: TypeComposant;
    justificationDecomposition?: string;
    dernierRenouvellement?: boolean;
    dureeNonLimitee?: boolean;
    justificationDureeNonLimitee?: string;
    nomDeDomaine?: boolean;
    fondementDureeDixAns?: 'NON_ESTIMABLE' | 'SIMPLIFICATION_SMT';
    reserveDePropriete?: boolean;
    criteresFraisDeveloppement?: CriteresFraisDeveloppementDto;
    dateReunionCriteresDeveloppement?: string;
    coutFuturDemantelement?: number;
    tauxActualisationDemantelementPourcent?: number;
}
export declare class SaisirConsommationDto {
    exerciceId: string;
    unitesConsommees: number;
    source: string;
}
export declare class PasserDotationDto {
    exerciceId: string;
    journalId: string;
}
export declare class RattachementComposantDto {
    immobilisationPrincipaleId?: string;
    typeComposant?: TypeComposant;
    justificationDecomposition?: string;
    dernierRenouvellement?: boolean;
}
export declare class DepreciationDto {
    exerciceId: string;
    journalId: string;
    sens: SensDepreciation;
    montant: number;
    compteDepreciationId: string;
    compteContrepartieId: string;
    indice: string;
}
export declare class RenouvelerComposantDto {
    dateRenouvellement: string;
    compteReserveEcartId?: string;
    exerciceId: string;
    journalId: string;
    designation: string;
    coutRenouvellement: number;
    compteContrepartieId: string;
    dureeAmortissementAns: number;
    valeurResiduelle?: number;
    dernierRenouvellement?: boolean;
    cessionCourante?: boolean;
}
export declare enum TypeSortie {
    CESSION = "CESSION",
    MISE_HORS_SERVICE = "MISE_HORS_SERVICE"
}
export declare class SortirImmobilisationDto {
    dateSortie: string;
    type: TypeSortie;
    exerciceId: string;
    journalId: string;
    prixCession?: number;
    compteContrepartieId?: string;
    cessionCourante?: boolean;
    compteFondsProjetId?: string;
    valeurMaterielRecupere?: number;
    compteStockRecupereId?: string;
    sourceMaterielRecupere?: string;
    natureSortie: NatureSortieImmobilisation;
    referencePieceSortie: string;
    datePieceSortie: string;
    compteReserveEcartId?: string;
}
export type SortieImmobilisation = Omit<SortirImmobilisationDto, 'natureSortie' | 'referencePieceSortie' | 'datePieceSortie'> & Partial<Pick<SortirImmobilisationDto, 'natureSortie' | 'referencePieceSortie' | 'datePieceSortie'>>;
export declare class ReclasserImmobilisationDto {
    nouvelleFamilleId: string;
    dateReclassement: string;
    exerciceId: string;
    journalId: string;
    motif: string;
    nouveauCompteDepreciationId?: string;
    criteresFraisDeveloppement?: CriteresFraisDeveloppementDto;
    dateReunionCriteresDeveloppement?: string;
}
export declare class OptionDegressifDto {
    categorie: string;
    bienNeuf: boolean;
    dureeFiscaleAns: number;
    exceptionnel?: boolean;
    activiteIndustrielle?: boolean;
    chiffreAffairesExportHt?: number;
    chiffreAffairesTotalHt?: number;
    sourceChiffreAffaires?: string;
}
export declare class PasserDerogatoireDto {
    exerciceId: string;
    journalId: string;
}
export declare class LieuBienDto {
    code: string;
    intitule: string;
}
export declare class MiseEnServiceDto {
    date: string;
    exerciceId?: string;
    journalId?: string;
    compteDepreciationCibleId?: string;
}
export declare class TransfertDepreciationDto {
    exerciceId: string;
    journalId: string;
    compteDepreciationCibleId?: string;
}
export declare class AffecterLieuDto {
    lieuId?: string | null;
}
export declare class SimulerLocationAcquisitionDto {
    compteImmobilisationId: string;
    nature: NatureLocationAcquisition;
    datePriseEffet: string;
    dureeMois: number;
    periodicite: PeriodiciteLoyer;
    termeAEchoir: boolean;
    loyer: number;
    prixOption: number;
    tauxAnnuel?: number | null;
    valeurContrat?: number | null;
    optionRaisonnablementCertaine: boolean;
    bienDeFaibleValeur: boolean;
    garantieValeurResiduelle?: number;
    loyerIndexe?: boolean;
    indiceLoyer?: string;
    valeurIndiceCommencement?: number;
}
export declare class CreerLocationAcquisitionDto extends SimulerLocationAcquisitionDto {
    designation: string;
    numeroInventaire?: string;
    lieuId?: string;
    natureFiscaleCle?: string | null;
    dureeAmortissementAns: number;
    reference: string;
    bailleurTiersId?: string;
    dateConclusion: string;
    coutsDirects?: number;
    avantagesRecus?: number;
    compteContrepartieCoutsId?: string;
    exerciceId: string;
    journalId: string;
}
export declare class ClotureLocationAcquisitionDto {
    exerciceId: string;
    journalId: string;
}
export declare class DeclarerGarantieLocationAcquisitionDto {
    appelee: boolean;
}
export declare class DeclarerOptionLocationAcquisitionDto {
    levee: boolean;
    exerciceId?: string;
    journalId?: string;
    cessionCourante?: boolean;
    compteReserveEcartId?: string;
}
export declare class RepriseSubventionDto {
    exerciceId: string;
    journalId: string;
    dureeInalienabiliteAns?: number;
}
export declare class EchangerImmobilisationDto {
    dateEchange: string;
    compteReserveEcartId?: string;
    exerciceId: string;
    journalId: string;
    prixDeReprise: number;
    soulte: number;
    compteCreanceId: string;
    compteFournisseurId: string;
    cessionCourante?: boolean;
    compteImmobilisationId: string;
    designation: string;
    numeroInventaire?: string;
    lieuId?: string;
    natureFiscaleCle?: string | null;
    dureeAmortissementAns?: number;
    dateMiseEnService?: string | null;
}
export declare class LigneSubventionDto {
    immobilisationId: string;
    montant: number;
}
export declare class OctroiSubventionDto {
    compteSubventionId: string;
    compteContrepartieId: string;
    exerciceId: string;
    journalId: string;
    date: string;
    montant: number;
    reference: string;
}
export declare class RattacherSubventionDto {
    compteSubventionId: string;
    dateOctroi: string;
    reference: string;
    dureeInalienabiliteAns?: number;
    motifSansVentilation?: string;
    lignes: LigneSubventionDto[];
}
export declare class ReduireSubventionDto {
    nature: NatureReductionSubvention;
    exerciceId: string;
    journalId: string;
    date: string;
    montant: number;
    compteContrepartieId: string;
    motif: string;
}
export declare class MethodeDepreciationSubventionDto {
    methode: MethodeDepreciationBienSubventionne;
}
export declare class BienDuLegsDto {
    compteImmobilisationId: string;
    designation: string;
    valeurOrigine: number;
    dureeAmortissementAns?: number;
    dateMiseEnService?: string;
    natureFiscaleCle?: string;
}
export declare class RecevoirLegsDto {
    exerciceId: string;
    journalId: string;
    dateActe: string;
    referenceActe: string;
    compteFondsId: string;
    dettes: number;
    compteDettesId?: string;
    biens: BienDuLegsDto[];
}
export declare class BienDuPrixGlobalDto {
    compteImmobilisationId: string;
    designation: string;
    montant?: number;
    parDifference?: boolean;
    dureeAmortissementAns?: number;
    dateMiseEnService?: string;
}
export declare class StockDuFondsDto {
    compteId: string;
    montant: number;
}
export declare class AcquerirAPrixGlobalDto {
    exerciceId: string;
    journalId: string;
    dateAcquisition: string;
    referenceActe: string;
    compteContrepartieId: string;
    prix: number;
    nature: 'ENSEMBLE' | 'FONDS_DE_COMMERCE';
    fondement?: FondementVentilation;
    sourceValeurs?: string;
    motifSansComparaison?: string;
    biens: BienDuPrixGlobalDto[];
    stocks?: StockDuFondsDto[];
    dureeFondsCommercialAns?: number;
}
export declare class RemplacerPartieDto extends RenouvelerComposantDto {
    designationPartie: string;
    valeurOrigineEstimee: number;
    methodeEstimation: MethodeEstimationPartie;
    sourceEstimation: string;
    justificationDecomposition: string;
}
export declare class DureeLimiteeDto {
    dateDecision: string;
    dureeResiduelleAns: number;
    motif: string;
    testDepreciation: string;
    fondementDureeDixAns?: 'NON_ESTIMABLE' | 'SIMPLIFICATION_SMT';
}
export declare class IncorporerCoutsEmpruntDto {
    exerciceId: string;
    journalId: string;
    nature: 'SPECIFIQUE' | 'GENERAL';
    debutPreparation: string;
    finPreparation: string;
    justificationPeriodeCourte?: string;
    dateDebut: string;
    dateFin: string;
    base: number;
    tauxPourcent: number;
    produitsPlacement?: number;
}
export declare class ReviserPlanDto {
    nature: 'PROSPECTIVE' | 'RETROACTIVE';
    dateDecision: string;
    nouvelleDureeAns: number;
    motif: string;
    journalId?: string;
}
export declare class CategorieReevaluationDto {
    cle: string;
    libelle: string;
    coefficient: number;
    source: string;
    base?: 'ORIGINE' | 'DERNIERE_REEVALUATION' | null;
}
export declare class LigneReevaluationDto {
    immobilisationId: string;
    categorie?: string;
    valeurActuelle?: number;
    droitDeReprise?: boolean;
}
export declare class ReevaluerImmobilisationsDto {
    exerciceId: string;
    journalId: string;
    type: 'LEGALE' | 'LIBRE';
    methodeLibre?: 'AJUSTEMENT' | 'ELIMINATION';
    neutraliteFiscale?: boolean;
    decision: string;
    traitementFiscal: string;
    methodeEvaluation: string;
    categories?: CategorieReevaluationDto[];
    lignes: LigneReevaluationDto[];
}
export declare class RepriseProvisionReevaluationDto {
    exerciceId: string;
    journalId: string;
}
export declare class AcquerirAPrixAleatoireDto {
    nature: NatureAcquisitionAleatoire;
    compteImmobilisationId: string;
    designation: string;
    dateAcquisition: string;
    dateMiseEnService?: string;
    valeurOrigine: number;
    dureeAmortissementAns?: number;
    fondement: FondementValeurAleatoire;
    sourceValeur: string;
    compteDetteId: string;
    comptant?: number;
    compteComptantId?: string;
    exerciceId: string;
    journalId: string;
}
export declare class SolderDetteAleatoireDto {
    exerciceId: string;
    journalId: string;
    date: string;
    versementsCumules: number;
    sourceVersements: string;
}
export declare class ReserveProprieteDto {
    reserveDePropriete: boolean;
    leveeLe?: string | null;
}
export declare class DesactualisationDemantelementDto {
    exerciceId: string;
    journalId: string;
}
export declare class RepriseDemantelementDto {
    exerciceId: string;
    journalId: string;
    date: string;
    motif: 'ENGAGEMENT_COUTS' | 'CESSION_SOUS_JACENT';
}
