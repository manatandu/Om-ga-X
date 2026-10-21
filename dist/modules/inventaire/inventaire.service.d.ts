import { MethodeInventaireStocks, ModeComparaisonCaisse, Prisma, Referentiel, RoleMembreInventaire } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { AjouterMembreDto, AjouterSousCommissionDto, ArbitrerEcartDto, CreerCampagneDto, CreerFicheDto, EtablirProcesVerbalDto, EtablirPvCaisseDto, ModifierCampagneDto, SaisirComptageDto } from './dto/inventaire.dto';
export declare class InventaireService {
    private readonly prisma;
    private readonly ecritures;
    constructor(prisma: PrismaService, ecritures: EcritureService);
    static noteContrepartieManquant(numeroCompte: string, modeInventaireStocks?: MethodeInventaireStocks | null): string;
    static motifRefusExcedent(numeroCompte: string, modeInventaireStocks?: MethodeInventaireStocks | null): string;
    static sanctionApplicable(referentiel: Referentiel): {
        texte: string;
        article: string;
    };
    private campagneOuverte;
    creer(tenantId: string, userId: string, dto: CreerCampagneDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    modifier(tenantId: string, id: string, dto: ModifierCampagneDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    ajouterSousCommission(tenantId: string, campagneId: string, dto: AjouterSousCommissionDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        campagneId: string;
        perimetre: string | null;
    }>;
    ajouterMembre(tenantId: string, sousCommissionId: string, dto: AjouterMembreDto): Promise<{
        role: import(".prisma/client").$Enums.RoleMembreInventaire;
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        sousCommissionId: string;
        fonction: string | null;
    }>;
    engendrerFichesImmobilisations(tenantId: string, campagneId: string): Promise<{
        creees: number;
        deja: number;
        lieuxRecopies: number;
    }>;
    creerFiche(tenantId: string, campagneId: string, dto: CreerFicheDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        compteId: string;
        designation: string;
        campagneId: string;
        valeurInventaire: Prisma.Decimal | null;
        immobilisationId: string | null;
        referencePiece: string | null;
        sousCommissionId: string | null;
        uniteMesure: string | null;
        emplacement: string | null;
        quantiteComptee: Prisma.Decimal | null;
    }>;
    private sousCommissionDeLaCampagne;
    saisirComptage(tenantId: string, ficheId: string, dto: SaisirComptageDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        compteId: string;
        designation: string;
        campagneId: string;
        valeurInventaire: Prisma.Decimal | null;
        immobilisationId: string | null;
        referencePiece: string | null;
        sousCommissionId: string | null;
        uniteMesure: string | null;
        emplacement: string | null;
        quantiteComptee: Prisma.Decimal | null;
    }>;
    private entrerEnRecensement;
    supprimerFiche(tenantId: string, ficheId: string): Promise<{
        supprimee: boolean;
    }>;
    rapprocher(tenantId: string, campagneId: string): Promise<{
        pvComptageCaisse: ({
            compte: {
                numero: string;
                intitule: string;
            };
            devise: {
                code: string;
            } | null;
            coupures: {
                id: string;
                tenantId: string;
                createdAt: Date;
                pvId: string;
                valeurUnitaire: Prisma.Decimal;
                nombre: number;
            }[];
        } & {
            id: string;
            tenantId: string;
            updatedAt: Date;
            compteId: string;
            campagneId: string;
            ecart: Prisma.Decimal;
            observations: string | null;
            etabliLe: Date;
            etabliPar: string;
            sousCommissionId: string;
            dateComptage: Date;
            heureComptage: string | null;
            soldeComptableFige: Prisma.Decimal;
            especesComptees: Prisma.Decimal;
            soldeALaCloture: Prisma.Decimal | null;
            encaissementsPosterieurs: Prisma.Decimal | null;
            decaissementsPosterieurs: Prisma.Decimal | null;
            mouvementsPosterieurs: number | null;
            mouvementsValeurAvantCloture: Prisma.Decimal | null;
            modeComparaison: import(".prisma/client").$Enums.ModeComparaisonCaisse;
            deviseId: string | null;
            attestationEtablieLe: Date | null;
            attestationPar: string | null;
        } & {
            dateCloture: Date;
            unite: string | null;
            compteApresLaCloture: boolean;
            reconstitutionManquante: boolean;
            especesReconstitueesALaCloture: number | null;
            mentions: string[];
        })[];
        sanction: {
            texte: string;
            article: string;
        };
        ecarts: ({
            compte: {
                numero: string;
                intitule: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            ecritureId: string | null;
            compteId: string;
            campagneId: string;
            valeurInventaire: Prisma.Decimal;
            soldeComptable: Prisma.Decimal;
            ecart: Prisma.Decimal;
            nombreFiches: number;
            rapprocheLe: Date;
            decision: import(".prisma/client").$Enums.DecisionEcartInventaire | null;
            responsable: string | null;
            explication: string | null;
            arbitreLe: Date | null;
            arbitrePar: string | null;
        })[];
        sousCommissions: ({
            membres: {
                role: import(".prisma/client").$Enums.RoleMembreInventaire;
                nom: string;
                id: string;
                tenantId: string;
                createdAt: Date;
                sousCommissionId: string;
                fonction: string | null;
            }[];
        } & {
            nom: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            campagneId: string;
            perimetre: string | null;
        })[];
        fiches: ({
            compte: {
                numero: string;
                intitule: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            compteId: string;
            designation: string;
            campagneId: string;
            valeurInventaire: Prisma.Decimal | null;
            immobilisationId: string | null;
            referencePiece: string | null;
            sousCommissionId: string | null;
            uniteMesure: string | null;
            emplacement: string | null;
            quantiteComptee: Prisma.Decimal | null;
        })[];
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    arbitrer(tenantId: string, ecartId: string, userId: string, dto: ArbitrerEcartDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        ecritureId: string | null;
        compteId: string;
        campagneId: string;
        valeurInventaire: Prisma.Decimal;
        soldeComptable: Prisma.Decimal;
        ecart: Prisma.Decimal;
        nombreFiches: number;
        rapprocheLe: Date;
        decision: import(".prisma/client").$Enums.DecisionEcartInventaire | null;
        responsable: string | null;
        explication: string | null;
        arbitreLe: Date | null;
        arbitrePar: string | null;
    }>;
    propositionRedressement(tenantId: string, ecartId: string): Promise<{
        proposable: false;
        motif: string;
        lignes?: undefined;
        responsable?: undefined;
    } | {
        proposable: true;
        lignes: ({
            compte: null;
            libelle: string;
            sens: "DEBIT";
            montant: number;
            note: string;
        } | {
            compte: string;
            libelle: string;
            sens: "CREDIT";
            montant: number;
            note?: undefined;
        })[];
        responsable: string | null;
        motif?: undefined;
    }>;
    private ecartARattacher;
    ecrituresCandidatesRedressement(tenantId: string, ecartId: string): Promise<{
        date: string;
        id: string;
        statut: import(".prisma/client").$Enums.StatutEcriture;
        numeroPiece: number | null;
        libelle: string;
    }[]>;
    rattacherEcritureRedressement(tenantId: string, ecartId: string, ecritureId: string): Promise<{
        rattache: boolean;
        ecritureId: string;
    }>;
    detacherEcritureRedressement(tenantId: string, ecartId: string): Promise<{
        detache: boolean;
    }>;
    etablirProcesVerbal(tenantId: string, campagneId: string, userId: string, dto: EtablirProcesVerbalDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    etablirPvCaisse(tenantId: string, campagneId: string, userId: string, dto: EtablirPvCaisseDto): Promise<{
        compte: {
            numero: string;
            intitule: string;
        };
        devise: {
            code: string;
        } | null;
        coupures: {
            id: string;
            tenantId: string;
            createdAt: Date;
            pvId: string;
            valeurUnitaire: Prisma.Decimal;
            nombre: number;
        }[];
    } & {
        id: string;
        tenantId: string;
        updatedAt: Date;
        compteId: string;
        campagneId: string;
        ecart: Prisma.Decimal;
        observations: string | null;
        etabliLe: Date;
        etabliPar: string;
        sousCommissionId: string;
        dateComptage: Date;
        heureComptage: string | null;
        soldeComptableFige: Prisma.Decimal;
        especesComptees: Prisma.Decimal;
        soldeALaCloture: Prisma.Decimal | null;
        encaissementsPosterieurs: Prisma.Decimal | null;
        decaissementsPosterieurs: Prisma.Decimal | null;
        mouvementsPosterieurs: number | null;
        mouvementsValeurAvantCloture: Prisma.Decimal | null;
        modeComparaison: import(".prisma/client").$Enums.ModeComparaisonCaisse;
        deviseId: string | null;
        attestationEtablieLe: Date | null;
        attestationPar: string | null;
    }>;
    static lireDateComptage(texte: string): Date;
    apercuPvCaisse(tenantId: string, campagneId: string, compteId: string, dateComptageTexte: string): Promise<{
        lisible: false;
        motif: string;
        soldeComptable?: undefined;
        modeComparaison?: undefined;
        deviseId?: undefined;
        devise?: undefined;
        dateCloture?: undefined;
        reconstitution?: undefined;
        mentions?: undefined;
    } | {
        lisible: true;
        soldeComptable: number;
        modeComparaison: import(".prisma/client").$Enums.ModeComparaisonCaisse;
        deviseId: string | null;
        devise: string | null;
        dateCloture: Date;
        reconstitution: import("./solde-caisse-au-comptage").ReconstitutionCaisse | null;
        mentions: string[];
        motif?: undefined;
    }>;
    static signaturesManquantes(membres: {
        role: RoleMembreInventaire;
    }[]): string | null;
    caissesNonComptees(tenantId: string, campagneId: string, db?: Prisma.TransactionClient | PrismaService): Promise<{
        compteId: string;
        numero: string;
        intitule: string;
        solde: number;
    }[]>;
    clore(tenantId: string, campagneId: string, userId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    private verifierCampagneDeCaissesSeules;
    lister(tenantId: string, exerciceId?: string): Promise<({
        _count: {
            ecarts: number;
            sousCommissions: number;
            fiches: number;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    })[]>;
    consulter(tenantId: string, campagneId: string): Promise<{
        pvComptageCaisse: ({
            compte: {
                numero: string;
                intitule: string;
            };
            devise: {
                code: string;
            } | null;
            coupures: {
                id: string;
                tenantId: string;
                createdAt: Date;
                pvId: string;
                valeurUnitaire: Prisma.Decimal;
                nombre: number;
            }[];
        } & {
            id: string;
            tenantId: string;
            updatedAt: Date;
            compteId: string;
            campagneId: string;
            ecart: Prisma.Decimal;
            observations: string | null;
            etabliLe: Date;
            etabliPar: string;
            sousCommissionId: string;
            dateComptage: Date;
            heureComptage: string | null;
            soldeComptableFige: Prisma.Decimal;
            especesComptees: Prisma.Decimal;
            soldeALaCloture: Prisma.Decimal | null;
            encaissementsPosterieurs: Prisma.Decimal | null;
            decaissementsPosterieurs: Prisma.Decimal | null;
            mouvementsPosterieurs: number | null;
            mouvementsValeurAvantCloture: Prisma.Decimal | null;
            modeComparaison: import(".prisma/client").$Enums.ModeComparaisonCaisse;
            deviseId: string | null;
            attestationEtablieLe: Date | null;
            attestationPar: string | null;
        } & {
            dateCloture: Date;
            unite: string | null;
            compteApresLaCloture: boolean;
            reconstitutionManquante: boolean;
            especesReconstitueesALaCloture: number | null;
            mentions: string[];
        })[];
        sanction: {
            texte: string;
            article: string;
        };
        ecarts: ({
            compte: {
                numero: string;
                intitule: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            ecritureId: string | null;
            compteId: string;
            campagneId: string;
            valeurInventaire: Prisma.Decimal;
            soldeComptable: Prisma.Decimal;
            ecart: Prisma.Decimal;
            nombreFiches: number;
            rapprocheLe: Date;
            decision: import(".prisma/client").$Enums.DecisionEcartInventaire | null;
            responsable: string | null;
            explication: string | null;
            arbitreLe: Date | null;
            arbitrePar: string | null;
        })[];
        sousCommissions: ({
            membres: {
                role: import(".prisma/client").$Enums.RoleMembreInventaire;
                nom: string;
                id: string;
                tenantId: string;
                createdAt: Date;
                sousCommissionId: string;
                fonction: string | null;
            }[];
        } & {
            nom: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            campagneId: string;
            perimetre: string | null;
        })[];
        fiches: ({
            compte: {
                numero: string;
                intitule: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            compteId: string;
            designation: string;
            campagneId: string;
            valeurInventaire: Prisma.Decimal | null;
            immobilisationId: string | null;
            referencePiece: string | null;
            sousCommissionId: string | null;
            uniteMesure: string | null;
            emplacement: string | null;
            quantiteComptee: Prisma.Decimal | null;
        })[];
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        updatedAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    static presenterPvCaisse<T extends {
        dateComptage: Date;
        especesComptees: unknown;
        soldeComptableFige: unknown;
        soldeALaCloture: unknown;
        mouvementsValeurAvantCloture: unknown;
        encaissementsPosterieurs: unknown;
        decaissementsPosterieurs: unknown;
        mouvementsPosterieurs: number | null;
        modeComparaison: ModeComparaisonCaisse;
        devise?: {
            code: string;
        } | null;
    }>(pv: T, dateCloture: Date): T & {
        dateCloture: Date;
        unite: string | null;
        compteApresLaCloture: boolean;
        reconstitutionManquante: boolean;
        especesReconstitueesALaCloture: number | null;
        mentions: string[];
    };
    mouvementsReconstitution(tenantId: string, pvId: string): Promise<{
        applicable: false;
        motif: string;
    } | {
        concorde: boolean | null;
        saisiesDepuisLePv: {
            nombre: number;
            net: number;
        };
        soldeALaCloture: number;
        mouvementsValeurAvantCloture: number;
        encaissements: number;
        decaissements: number;
        applicable: true;
        unite: string | null;
        lignes: {
            id: string;
            date: Date;
            journal: string;
            numeroPiece: number | null;
            libelle: string;
            encaissement: number;
            decaissement: number;
        }[];
        total: number;
        tronque: boolean;
        motif?: undefined;
    }>;
    static unitePourMessage(mode: ModeComparaisonCaisse, code?: string | null): string;
    static readonly PLAFOND_MOUVEMENTS_RECONSTITUTION = 500;
    private campagnePourEdition;
    private courrielDe;
    private sousCommissionsAvecMembres;
    private fichesPourEdition;
    editionFichesVierges(tenantId: string, campagneId: string, sousCommissionId?: string): Promise<import("./editions-inventaire").EditionFichesVierges>;
    editionProcesVerbal(tenantId: string, campagneId: string): Promise<import("./editions-inventaire").EditionPvInventaire>;
    editionPvCaisse(tenantId: string, pvId: string): Promise<import("./editions-inventaire").EditionPvCaisse>;
    resumePourLivreInventaire(tenantId: string, exerciceId: string): Promise<{
        campagneId: string;
        libelle: string;
        dateInventaire: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        procesVerbalEtabliLe: Date | null;
        fiches: number;
        comptesRapproches: number;
        manquants: number;
        excedents: number;
        sansEcart: number;
        totalManquants: number;
        totalExcedents: number;
        ecartsSansDecision: number;
    }[]>;
}
