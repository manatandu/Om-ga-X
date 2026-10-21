import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ModeleSaisieService } from './modele-saisie.service';
import { CreerModeleSaisieDto, ModifierModeleSaisieDto } from './dto/modele-saisie.dto';
export declare class ModeleSaisieController {
    private readonly service;
    constructor(service: ModeleSaisieService);
    lister(user: AuthenticatedUser, journalId?: string, inclureInactifs?: string): Promise<{
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
    creer(user: AuthenticatedUser, dto: CreerModeleSaisieDto): Promise<{
        avertissements: string[];
        id: string;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierModeleSaisieDto): Promise<{
        avertissements: string[];
        id: string;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
