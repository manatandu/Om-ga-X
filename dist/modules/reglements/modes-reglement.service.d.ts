import { PrismaService } from '../../common/prisma.service';
import { CreerModeReglementDto, ModifierModeReglementDto } from './modes-reglement.dto';
type LecteurModes = Pick<PrismaService, 'modeReglement'>;
export declare function modeDuDossier(prisma: LecteurModes, tenantId: string, id: string): Promise<{
    nature: import(".prisma/client").$Enums.NatureModeReglement;
    id: string;
    estActif: boolean;
    intitule: string;
    code: string;
    journalId: string | null;
}>;
export declare class ModesReglementService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Promise<{
        nature: import(".prisma/client").$Enums.NatureModeReglement;
        journal: {
            intitule: string;
            code: string;
        } | null;
        id: string;
        estActif: boolean;
        intitule: string;
        code: string;
        journalId: string | null;
        codeInterbancaire: string | null;
    }[]>;
    creer(tenantId: string, userId: string, dto: CreerModeReglementDto): Promise<{
        nature: import(".prisma/client").$Enums.NatureModeReglement;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        code: string;
        journalId: string | null;
        createdBy: string;
        codeInterbancaire: string | null;
    }>;
    creerUsuels(tenantId: string, userId: string): Promise<{
        crees: string[];
        dejaPresents: string[];
    }>;
    modifier(tenantId: string, id: string, dto: ModifierModeReglementDto): Promise<{
        nature: import(".prisma/client").$Enums.NatureModeReglement;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        code: string;
        journalId: string | null;
        createdBy: string;
        codeInterbancaire: string | null;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    private verifierJournal;
    private refuserIntitulePris;
    private dejaPris;
}
export {};
