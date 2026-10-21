import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MethodeDepreciationSubventionDto, OctroiSubventionDto, RattacherSubventionDto, ReduireSubventionDto } from './dto/immobilisation.dto';
import { SubventionRattacheeService } from './subvention-rattachee.service';
export declare class SubventionRattacheeController {
    private readonly service;
    constructor(service: SubventionRattacheeService);
    lister(user: AuthenticatedUser, immobilisationId?: string): Promise<{
        subventions: {
            montant: import("@prisma/client/runtime/library").Decimal;
            immobilisation: {
                id: string;
                designation: string;
                numeroInventaire: string | null;
            };
            id: string;
            reference: string;
            dateOctroi: Date;
            dureeInalienabiliteAns: number | null;
            motifSansVentilation: string | null;
            compteSubvention: {
                id: string;
                numero: string;
                intitule: string;
            };
            reductions: {
                nature: import(".prisma/client").$Enums.NatureReductionSubvention;
                montant: import("@prisma/client/runtime/library").Decimal;
                id: string;
                createdAt: Date;
                motif: string;
            }[];
        }[];
        tronque: boolean;
        methodeDepreciation: import(".prisma/client").$Enums.MethodeDepreciationBienSubventionne | null;
        contrepartieRemboursementProposee: string | null;
        compteRemboursementPropose: {
            id: string;
            numero: string;
            intitule: string;
        } | null;
    }>;
    octrois(user: AuthenticatedUser, compteSubventionId: string): Promise<{
        octrois: {
            ligneId: string;
            ecritureId: string;
            date: Date;
            numeroPiece: number | null;
            reference: string | null;
            libelle: string;
            montant: number;
        }[];
        tronque: boolean;
        credite: number;
        dejaRattache: number;
        resteARattacher: number;
        contrepartiesProposees: {
            id: string;
            numero: string;
            intitule: string;
        }[];
        autresTiersAdmis: boolean;
    }>;
    enregistrerOctroi(user: AuthenticatedUser, dto: OctroiSubventionDto): Promise<{
        journal: {
            type: import(".prisma/client").$Enums.TypeJournal;
            id: string;
            tenantId: string;
            createdAt: Date;
            estActif: boolean;
            intitule: string;
            code: string;
            compteTresorerieId: string | null;
            numerotation: import(".prisma/client").$Enums.NumerotationPiece;
            contrepartieChaqueLigne: boolean;
        };
        lignes: {
            id: string;
            modeReglementId: string | null;
            ecritureId: string;
            libelle: string | null;
            compteId: string;
            ligneReleveId: string | null;
            debit: import("@prisma/client/runtime/library").Decimal;
            credit: import("@prisma/client/runtime/library").Decimal;
            deviseId: string | null;
            dateEcheance: Date | null;
            lettre: string | null;
            lettrageId: string | null;
            aRelettrerDepuis: Date | null;
            tauxTvaId: string | null;
            rapprochementId: string | null;
            dateVersement: Date | null;
            montantDevise: import("@prisma/client/runtime/library").Decimal | null;
            coursApplique: import("@prisma/client/runtime/library").Decimal | null;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEcriture;
        journalId: string;
        createdBy: string;
        date: Date;
        exerciceId: string;
        reference: string | null;
        numeroPiece: number | null;
        dateValeur: Date | null;
        libelle: string;
        valideeAt: Date | null;
        valideeBy: string | null;
        secondRegardNom: string | null;
        secondRegardMotif: string | null;
        estGenereeParCloture: boolean;
        estSoldeDesComptesDeGestion: boolean;
        estANouveauProvisoire: boolean;
        motifImputationOuverture: import(".prisma/client").$Enums.MotifImputationOuverture | null;
        justificationImputationOuverture: string | null;
        corrigeEcritureId: string | null;
        motifCorrection: string | null;
    }>;
    ventilation(user: AuthenticatedUser, id: string, montant: string): Promise<{
        lignes: {
            montant: number;
            id: string;
            designation: string;
            valeurOrigine: number;
        }[];
        aDesComposants: boolean;
    }>;
    rattacher(user: AuthenticatedUser, dto: RattacherSubventionDto): Promise<{
        montant: import("@prisma/client/runtime/library").Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        reference: string;
        immobilisationId: string;
        compteSubventionId: string;
        dateOctroi: Date;
        dureeInalienabiliteAns: number | null;
        motifSansVentilation: string | null;
    }[]>;
    reduire(user: AuthenticatedUser, id: string, dto: ReduireSubventionDto): Promise<{
        nature: import(".prisma/client").$Enums.NatureReductionSubvention;
        montant: import("@prisma/client/runtime/library").Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        exerciceId: string;
        ecritureId: string;
        motif: string;
        subventionId: string;
        compteContrepartieId: string;
    }>;
    declarerMethode(user: AuthenticatedUser, dto: MethodeDepreciationSubventionDto): Promise<{
        methodeDepreciationBienSubventionne: import(".prisma/client").$Enums.MethodeDepreciationBienSubventionne | null;
    }>;
}
