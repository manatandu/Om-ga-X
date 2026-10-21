import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RapprochementService } from './rapprochement.service';
import { ConfirmerCorrespondancesDto, DeclarerDepartDto, DeclarerEncoursDto, ImporterReleveDto, OuvrirRapprochementDto, PointerDto, PointerEncoursDto, PropositionsRapprochementDto, RouvrirRapprochementDto } from './dto/rapprochement.dto';
export declare class RapprochementController {
    private readonly rapprochementService;
    constructor(rapprochementService: RapprochementService);
    lister(user: AuthenticatedUser, compteId?: string): Promise<({
        compte: {
            id: string;
            estActif: boolean;
            tenantId: string;
            numero: string;
            intitule: string;
            classe: import(".prisma/client").$Enums.ClasseCompte;
            typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
            modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
            estRetenu: boolean;
            lettrable: boolean;
            collectifId: string | null;
            tauxTvaDefautId: string | null;
            codeRetraitementFiscal: string | null;
            comportementGestion: import(".prisma/client").$Enums.ComportementGestion | null;
            partVariableGestionPct: import("@prisma/client/runtime/library").Decimal | null;
            bailleurId: string | null;
            porteFondsContrepartieEtat: boolean;
        };
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutRapprochement;
        tenantId: string;
        createdBy: string;
        compteId: string;
        dateReleve: Date;
        soldeReleve: import("@prisma/client/runtime/library").Decimal;
        clotureAt: Date | null;
        soldeDepartDeclare: import("@prisma/client/runtime/library").Decimal | null;
        dateDepart: Date | null;
        rouvertAt: Date | null;
        rouvertBy: string | null;
        motifReouverture: string | null;
    })[]>;
    obtenir(user: AuthenticatedUser, id: string): Promise<{
        rapprochement: {
            id: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutRapprochement;
            tenantId: string;
            createdBy: string;
            compteId: string;
            dateReleve: Date;
            soldeReleve: import("@prisma/client/runtime/library").Decimal;
            clotureAt: Date | null;
            soldeDepartDeclare: import("@prisma/client/runtime/library").Decimal | null;
            dateDepart: Date | null;
            rouvertAt: Date | null;
            rouvertBy: string | null;
            motifReouverture: string | null;
        };
        premier: boolean;
        soldeDepart: number | null;
        soldePointe: number | null;
        ecart: number | null;
        equilibre: boolean;
        ecartReleve: number | null;
        ouverture: import("./rapprochement.service").OuvertureRapprochement | null;
        releve: {
            id: string;
            rang: number;
            date: Date;
            libelle: string;
            reference: string | null;
            debit: number;
            credit: number;
            ligneEcritureIds: string[];
            encoursIds: string[];
        }[];
        tronque: boolean;
        totalLignes: number;
        aNouveauEcartes: number;
        fonduesDansLeDepart: number;
        lignes: {
            id: string;
            date: Date;
            journalCode: string;
            libelle: string;
            reference: string | null;
            debit: number;
            credit: number;
            pointee: boolean;
            ligneReleveId: string | null;
        }[];
        encours: {
            id: string;
            date: Date;
            libelle: string;
            debit: number;
            credit: number;
            pointee: boolean;
            ligneReleveId: string | null;
            declareIci: boolean;
        }[];
    }>;
    ouvrir(user: AuthenticatedUser, dto: OuvrirRapprochementDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutRapprochement;
        tenantId: string;
        createdBy: string;
        compteId: string;
        dateReleve: Date;
        soldeReleve: import("@prisma/client/runtime/library").Decimal;
        clotureAt: Date | null;
        soldeDepartDeclare: import("@prisma/client/runtime/library").Decimal | null;
        dateDepart: Date | null;
        rouvertAt: Date | null;
        rouvertBy: string | null;
        motifReouverture: string | null;
    }>;
    pointer(user: AuthenticatedUser, id: string, dto: PointerDto): Promise<{
        nombreLignes: number;
    }>;
    depointer(user: AuthenticatedUser, id: string, dto: PointerDto): Promise<{
        nombreLignes: number;
    }>;
    cloturer(user: AuthenticatedUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutRapprochement;
        tenantId: string;
        createdBy: string;
        compteId: string;
        dateReleve: Date;
        soldeReleve: import("@prisma/client/runtime/library").Decimal;
        clotureAt: Date | null;
        soldeDepartDeclare: import("@prisma/client/runtime/library").Decimal | null;
        dateDepart: Date | null;
        rouvertAt: Date | null;
        rouvertBy: string | null;
        motifReouverture: string | null;
    }>;
    rouvrir(user: AuthenticatedUser, id: string, dto: RouvrirRapprochementDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutRapprochement;
        tenantId: string;
        createdBy: string;
        compteId: string;
        dateReleve: Date;
        soldeReleve: import("@prisma/client/runtime/library").Decimal;
        clotureAt: Date | null;
        soldeDepartDeclare: import("@prisma/client/runtime/library").Decimal | null;
        dateDepart: Date | null;
        rouvertAt: Date | null;
        rouvertBy: string | null;
        motifReouverture: string | null;
    }>;
    declarerDepart(user: AuthenticatedUser, id: string, dto: DeclarerDepartDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutRapprochement;
        tenantId: string;
        createdBy: string;
        compteId: string;
        dateReleve: Date;
        soldeReleve: import("@prisma/client/runtime/library").Decimal;
        clotureAt: Date | null;
        soldeDepartDeclare: import("@prisma/client/runtime/library").Decimal | null;
        dateDepart: Date | null;
        rouvertAt: Date | null;
        rouvertBy: string | null;
        motifReouverture: string | null;
    }>;
    declarerEncours(user: AuthenticatedUser, id: string, dto: DeclarerEncoursDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        libelle: string;
        createdBy: string;
        date: Date;
        declareSurId: string;
        pointeSurId: string | null;
        ligneReleveId: string | null;
        debit: import("@prisma/client/runtime/library").Decimal;
        credit: import("@prisma/client/runtime/library").Decimal;
    }>;
    retirerEncours(user: AuthenticatedUser, id: string, encoursId: string): Promise<{
        supprime: boolean;
    }>;
    pointerEncours(user: AuthenticatedUser, id: string, dto: PointerEncoursDto): Promise<{
        nombreEncours: number;
    }>;
    depointerEncours(user: AuthenticatedUser, id: string, dto: PointerEncoursDto): Promise<{
        nombreEncours: number;
    }>;
    annuler(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
    importerReleve(user: AuthenticatedUser, id: string, dto: ImporterReleveDto): Promise<{
        nombreLignes: number;
    }>;
    retirerReleve(user: AuthenticatedUser, id: string): Promise<{
        nombreLignes: number;
    }>;
    proposer(user: AuthenticatedUser, id: string, requete: PropositionsRapprochementDto): Promise<{
        fenetreJours: number;
        propositions: {
            ligneEcritureIds: string[];
            encoursIds: string[];
            ligneReleveId: string;
            motif: "REFERENCE" | "MONTANT_DATE";
        }[];
        lignesReleveSansProposition: number;
    }>;
    confirmer(user: AuthenticatedUser, id: string, dto: ConfirmerCorrespondancesDto): Promise<{
        nombreCorrespondances: number;
    }>;
    dissocier(user: AuthenticatedUser, id: string, ligneReleveId: string): Promise<{
        nombreLignes: number;
    }>;
}
