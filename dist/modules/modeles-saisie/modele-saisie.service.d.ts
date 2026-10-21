import { PrismaService } from '../../common/prisma.service';
import { CreerModeleSaisieDto, ModifierModeleSaisieDto } from './dto/modele-saisie.dto';
export declare class ModeleSaisieService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string, journalId?: string, inclureInactifs?: boolean): Promise<{
        id: string;
        intitule: string;
        journalId: string | null;
        typeJournal: import(".prisma/client").$Enums.TypeJournal | null;
        journalCode: string | null;
        journalIntitule: string | null;
        sequenceSaisieId: string | null;
        sequenceNumero: number | null;
        sequenceIntitule: string | null;
        estActif: boolean;
        lignes: {
            ordre: number;
            compteId: string;
            compteNumero: string;
            compteIntitule: string;
            sens: import(".prisma/client").$Enums.SensModeleSaisie;
            libelle: string | null;
            montant: number | null;
            fonction: import(".prisma/client").$Enums.FonctionLigneModele;
            tauxTvaId: string | null;
        }[];
        avertissements: string[];
    }[]>;
    creer(tenantId: string, userId: string, dto: CreerModeleSaisieDto): Promise<{
        avertissements: string[];
        id: string;
    }>;
    modifier(tenantId: string, modeleId: string, dto: ModifierModeleSaisieDto): Promise<{
        avertissements: string[];
        id: string;
    }>;
    supprimer(tenantId: string, modeleId: string): Promise<{
        supprime: boolean;
    }>;
    private avertissementsDuModele;
    private versLigne;
    private verifierSequence;
    private verifierJournal;
    private verifierLignes;
}
