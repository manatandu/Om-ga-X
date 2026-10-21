import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CompteService } from './compte.service';
import { CreerCompteDto, CreerCompteEnSaisieDto, ModifierCompteDto } from './dto/creer-compte.dto';
import { ClasseCompte, TypeCompteDetailTotal } from '@prisma/client';
export declare class CompteController {
    private readonly compteService;
    constructor(compteService: CompteService);
    lister(user: AuthenticatedUser, classe?: ClasseCompte, recherche?: string, actifsSeuls?: string, typeCompte?: TypeCompteDetailTotal, retenus?: string, usage?: string): Promise<{
        duPlan?: boolean | undefined;
        subdivise?: boolean | undefined;
        utilise?: boolean | undefined;
        nature: string | null;
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
    }[]>;
    renvois(user: AuthenticatedUser): Promise<import("./renvois-plan-syscohada").RenvoiDuCompte[]>;
    sousComptePropose(user: AuthenticatedUser, id: string): Promise<{
        numero: string | null;
        intitule: string;
        motif: string | null;
    }>;
    propositionEnSaisie(user: AuthenticatedUser, numero?: string): Promise<{
        numero: string;
        intitule: string;
        compteDuPlan: {
            numero: string;
            intitule: string;
        } | null;
        motif: string | null;
    }>;
    creerEnSaisie(user: AuthenticatedUser, dto: CreerCompteEnSaisieDto): Promise<{
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
    }>;
    neRetenirQueLesUtilises(user: AuthenticatedUser): Promise<{
        comptesDesretenus: number;
    }>;
    creer(user: AuthenticatedUser, dto: CreerCompteDto): Promise<{
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
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierCompteDto): Promise<{
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
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
