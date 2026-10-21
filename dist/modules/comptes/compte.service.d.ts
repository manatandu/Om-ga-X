import { PrismaService } from '../../common/prisma.service';
import { ClasseCompte, Prisma, Referentiel, TypeCompteDetailTotal } from '@prisma/client';
import { CreerCompteDto, CreerCompteEnSaisieDto, ModifierCompteDto } from './dto/creer-compte.dto';
export declare function estLettrableParDefaut(numero: string): boolean;
export declare class CompteService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    seedPlan(tenantId: string, referentiel: Referentiel, client?: Prisma.TransactionClient): Promise<void>;
    renvoisDuPlan(tenantId: string): Promise<import("./renvois-plan-syscohada").RenvoiDuCompte[]>;
    lister(tenantId: string, filtres: {
        classe?: ClasseCompte;
        recherche?: string;
        actifsSeuls?: boolean;
        typeCompte?: TypeCompteDetailTotal;
        retenus?: boolean;
        usage?: boolean;
    }): Promise<{
        duPlan?: boolean | undefined;
        subdivise?: boolean | undefined;
        utilise?: boolean | undefined;
        nature: string | null;
        id: string;
        tenantId: string;
        estActif: boolean;
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
        partVariableGestionPct: Prisma.Decimal | null;
        bailleurId: string | null;
        porteFondsContrepartieEtat: boolean;
    }[]>;
    creer(tenantId: string, dto: CreerCompteDto): Promise<{
        id: string;
        tenantId: string;
        estActif: boolean;
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
        partVariableGestionPct: Prisma.Decimal | null;
        bailleurId: string | null;
        porteFondsContrepartieEtat: boolean;
    }>;
    propositionEnSaisie(tenantId: string, numero: string): Promise<{
        numero: string;
        intitule: string;
        compteDuPlan: {
            numero: string;
            intitule: string;
        } | null;
        motif: string | null;
    }>;
    creerEnSaisie(tenantId: string, dto: CreerCompteEnSaisieDto): Promise<{
        id: string;
        tenantId: string;
        estActif: boolean;
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
        partVariableGestionPct: Prisma.Decimal | null;
        bailleurId: string | null;
        porteFondsContrepartieEtat: boolean;
    }>;
    private jugerCompteEnSaisie;
    sousComptePropose(tenantId: string, compteId: string): Promise<{
        numero: string | null;
        intitule: string;
        motif: string | null;
    }>;
    private verifierCodeRetraitement;
    supprimer(tenantId: string, compteId: string): Promise<{
        supprime: boolean;
    }>;
    neRetenirQueLesUtilises(tenantId: string): Promise<{
        comptesDesretenus: number;
    }>;
    modifier(tenantId: string, compteId: string, dto: ModifierCompteDto): Promise<{
        id: string;
        tenantId: string;
        estActif: boolean;
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
        partVariableGestionPct: Prisma.Decimal | null;
        bailleurId: string | null;
        porteFondsContrepartieEtat: boolean;
    }>;
}
