import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { InventaireService } from './inventaire.service';
import { AjouterMembreDto, AjouterSousCommissionDto, ArbitrerEcartDto, CreerCampagneDto, CreerFicheDto, EtablirProcesVerbalDto, EtablirPvCaisseDto, ModifierCampagneDto, RattacherEcritureEcartDto, SaisirComptageDto } from './dto/inventaire.dto';
export declare class InventaireController {
    private readonly inventaire;
    constructor(inventaire: InventaireService);
    lister(user: AuthenticatedUser, exerciceId?: string): Promise<({
        _count: {
            ecarts: number;
            sousCommissions: number;
            fiches: number;
        };
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    })[]>;
    resume(user: AuthenticatedUser, exerciceId: string): Promise<{
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
    editionPvCaisse(user: AuthenticatedUser, pvId: string): Promise<import("./editions-inventaire").EditionPvCaisse>;
    editionFichesVierges(user: AuthenticatedUser, id: string, sousCommissionId?: string): Promise<import("./editions-inventaire").EditionFichesVierges>;
    editionProcesVerbal(user: AuthenticatedUser, id: string): Promise<import("./editions-inventaire").EditionPvInventaire>;
    consulter(user: AuthenticatedUser, id: string): Promise<{
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
                createdAt: Date;
                tenantId: string;
                pvId: string;
                valeurUnitaire: import("@prisma/client/runtime/library").Decimal;
                nombre: number;
            }[];
        } & {
            id: string;
            tenantId: string;
            updatedAt: Date;
            compteId: string;
            campagneId: string;
            ecart: import("@prisma/client/runtime/library").Decimal;
            observations: string | null;
            etabliLe: Date;
            etabliPar: string;
            sousCommissionId: string;
            dateComptage: Date;
            heureComptage: string | null;
            soldeComptableFige: import("@prisma/client/runtime/library").Decimal;
            especesComptees: import("@prisma/client/runtime/library").Decimal;
            soldeALaCloture: import("@prisma/client/runtime/library").Decimal | null;
            encaissementsPosterieurs: import("@prisma/client/runtime/library").Decimal | null;
            decaissementsPosterieurs: import("@prisma/client/runtime/library").Decimal | null;
            mouvementsPosterieurs: number | null;
            mouvementsValeurAvantCloture: import("@prisma/client/runtime/library").Decimal | null;
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
            createdAt: Date;
            tenantId: string;
            updatedAt: Date;
            ecritureId: string | null;
            compteId: string;
            campagneId: string;
            valeurInventaire: import("@prisma/client/runtime/library").Decimal;
            soldeComptable: import("@prisma/client/runtime/library").Decimal;
            ecart: import("@prisma/client/runtime/library").Decimal;
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
                id: string;
                nom: string;
                createdAt: Date;
                role: import(".prisma/client").$Enums.RoleMembreInventaire;
                tenantId: string;
                sousCommissionId: string;
                fonction: string | null;
            }[];
        } & {
            id: string;
            nom: string;
            createdAt: Date;
            tenantId: string;
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
            createdAt: Date;
            tenantId: string;
            updatedAt: Date;
            compteId: string;
            designation: string;
            campagneId: string;
            valeurInventaire: import("@prisma/client/runtime/library").Decimal | null;
            immobilisationId: string | null;
            referencePiece: string | null;
            sousCommissionId: string | null;
            uniteMesure: string | null;
            emplacement: string | null;
            quantiteComptee: import("@prisma/client/runtime/library").Decimal | null;
        })[];
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    creer(user: AuthenticatedUser, dto: CreerCampagneDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierCampagneDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    ajouterSousCommission(user: AuthenticatedUser, id: string, dto: AjouterSousCommissionDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        campagneId: string;
        perimetre: string | null;
    }>;
    ajouterMembre(user: AuthenticatedUser, sousCommissionId: string, dto: AjouterMembreDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        role: import(".prisma/client").$Enums.RoleMembreInventaire;
        tenantId: string;
        sousCommissionId: string;
        fonction: string | null;
    }>;
    creerFiche(user: AuthenticatedUser, id: string, dto: CreerFicheDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        compteId: string;
        designation: string;
        campagneId: string;
        valeurInventaire: import("@prisma/client/runtime/library").Decimal | null;
        immobilisationId: string | null;
        referencePiece: string | null;
        sousCommissionId: string | null;
        uniteMesure: string | null;
        emplacement: string | null;
        quantiteComptee: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    engendrerFiches(user: AuthenticatedUser, id: string): Promise<{
        creees: number;
        deja: number;
        lieuxRecopies: number;
    }>;
    saisirComptage(user: AuthenticatedUser, ficheId: string, dto: SaisirComptageDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        compteId: string;
        designation: string;
        campagneId: string;
        valeurInventaire: import("@prisma/client/runtime/library").Decimal | null;
        immobilisationId: string | null;
        referencePiece: string | null;
        sousCommissionId: string | null;
        uniteMesure: string | null;
        emplacement: string | null;
        quantiteComptee: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    supprimerFiche(user: AuthenticatedUser, ficheId: string): Promise<{
        supprimee: boolean;
    }>;
    rapprocher(user: AuthenticatedUser, id: string): Promise<{
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
                createdAt: Date;
                tenantId: string;
                pvId: string;
                valeurUnitaire: import("@prisma/client/runtime/library").Decimal;
                nombre: number;
            }[];
        } & {
            id: string;
            tenantId: string;
            updatedAt: Date;
            compteId: string;
            campagneId: string;
            ecart: import("@prisma/client/runtime/library").Decimal;
            observations: string | null;
            etabliLe: Date;
            etabliPar: string;
            sousCommissionId: string;
            dateComptage: Date;
            heureComptage: string | null;
            soldeComptableFige: import("@prisma/client/runtime/library").Decimal;
            especesComptees: import("@prisma/client/runtime/library").Decimal;
            soldeALaCloture: import("@prisma/client/runtime/library").Decimal | null;
            encaissementsPosterieurs: import("@prisma/client/runtime/library").Decimal | null;
            decaissementsPosterieurs: import("@prisma/client/runtime/library").Decimal | null;
            mouvementsPosterieurs: number | null;
            mouvementsValeurAvantCloture: import("@prisma/client/runtime/library").Decimal | null;
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
            createdAt: Date;
            tenantId: string;
            updatedAt: Date;
            ecritureId: string | null;
            compteId: string;
            campagneId: string;
            valeurInventaire: import("@prisma/client/runtime/library").Decimal;
            soldeComptable: import("@prisma/client/runtime/library").Decimal;
            ecart: import("@prisma/client/runtime/library").Decimal;
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
                id: string;
                nom: string;
                createdAt: Date;
                role: import(".prisma/client").$Enums.RoleMembreInventaire;
                tenantId: string;
                sousCommissionId: string;
                fonction: string | null;
            }[];
        } & {
            id: string;
            nom: string;
            createdAt: Date;
            tenantId: string;
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
            createdAt: Date;
            tenantId: string;
            updatedAt: Date;
            compteId: string;
            designation: string;
            campagneId: string;
            valeurInventaire: import("@prisma/client/runtime/library").Decimal | null;
            immobilisationId: string | null;
            referencePiece: string | null;
            sousCommissionId: string | null;
            uniteMesure: string | null;
            emplacement: string | null;
            quantiteComptee: import("@prisma/client/runtime/library").Decimal | null;
        })[];
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    arbitrer(user: AuthenticatedUser, ecartId: string, dto: ArbitrerEcartDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        ecritureId: string | null;
        compteId: string;
        campagneId: string;
        valeurInventaire: import("@prisma/client/runtime/library").Decimal;
        soldeComptable: import("@prisma/client/runtime/library").Decimal;
        ecart: import("@prisma/client/runtime/library").Decimal;
        nombreFiches: number;
        rapprocheLe: Date;
        decision: import(".prisma/client").$Enums.DecisionEcartInventaire | null;
        responsable: string | null;
        explication: string | null;
        arbitreLe: Date | null;
        arbitrePar: string | null;
    }>;
    proposition(user: AuthenticatedUser, ecartId: string): Promise<{
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
    candidatesRedressement(user: AuthenticatedUser, ecartId: string): Promise<{
        date: string;
        id: string;
        statut: import(".prisma/client").$Enums.StatutEcriture;
        libelle: string;
        numeroPiece: number | null;
    }[]>;
    rattacherRedressement(user: AuthenticatedUser, ecartId: string, dto: RattacherEcritureEcartDto): Promise<{
        rattache: boolean;
        ecritureId: string;
    }>;
    detacherRedressement(user: AuthenticatedUser, ecartId: string): Promise<{
        detache: boolean;
    }>;
    etablirPv(user: AuthenticatedUser, id: string, dto: EtablirProcesVerbalDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
    etablirPvCaisse(user: AuthenticatedUser, id: string, dto: EtablirPvCaisseDto): Promise<{
        compte: {
            numero: string;
            intitule: string;
        };
        devise: {
            code: string;
        } | null;
        coupures: {
            id: string;
            createdAt: Date;
            tenantId: string;
            pvId: string;
            valeurUnitaire: import("@prisma/client/runtime/library").Decimal;
            nombre: number;
        }[];
    } & {
        id: string;
        tenantId: string;
        updatedAt: Date;
        compteId: string;
        campagneId: string;
        ecart: import("@prisma/client/runtime/library").Decimal;
        observations: string | null;
        etabliLe: Date;
        etabliPar: string;
        sousCommissionId: string;
        dateComptage: Date;
        heureComptage: string | null;
        soldeComptableFige: import("@prisma/client/runtime/library").Decimal;
        especesComptees: import("@prisma/client/runtime/library").Decimal;
        soldeALaCloture: import("@prisma/client/runtime/library").Decimal | null;
        encaissementsPosterieurs: import("@prisma/client/runtime/library").Decimal | null;
        decaissementsPosterieurs: import("@prisma/client/runtime/library").Decimal | null;
        mouvementsPosterieurs: number | null;
        mouvementsValeurAvantCloture: import("@prisma/client/runtime/library").Decimal | null;
        modeComparaison: import(".prisma/client").$Enums.ModeComparaisonCaisse;
        deviseId: string | null;
        attestationEtablieLe: Date | null;
        attestationPar: string | null;
    }>;
    apercuPvCaisse(user: AuthenticatedUser, id: string, compteId: string, dateComptage: string): Promise<{
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
    mouvementsReconstitution(user: AuthenticatedUser, pvId: string): Promise<{
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
    caissesNonComptees(user: AuthenticatedUser, id: string): Promise<{
        compteId: string;
        numero: string;
        intitule: string;
        solde: number;
    }[]>;
    clore(user: AuthenticatedUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutCampagneInventaire;
        tenantId: string;
        exerciceId: string;
        updatedAt: Date;
        libelle: string;
        createdBy: string;
        dateInventaire: Date;
        instructions: string | null;
        procesVerbalEtabliLe: Date | null;
        procesVerbalPar: string | null;
        clotureeLe: Date | null;
        clotureePar: string | null;
    }>;
}
