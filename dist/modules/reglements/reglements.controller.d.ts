import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReglementsService } from './reglements.service';
import { EnregistrerReglementsDto, PasserEcartChangeDto } from './reglements.dto';
export declare class ReglementsController {
    private readonly reglements;
    constructor(reglements: ReglementsService);
    echeances(user: AuthenticatedUser, exerciceId: string, sens: string, jusquau?: string): Promise<{
        compteId: string;
        numero: string;
        intitule: string;
        tiers: string | null;
        creanceReclassee: {
            compte416: string;
            date: string;
        } | null;
        lignes: {
            id: string;
            compteId: string;
            echeance: Date;
            date: Date;
            journalCode: string;
            numeroPiece: number | null;
            reference: string | null;
            libelle: string;
            montant: number;
            deviseId: string | null;
            deviseCode: string | null;
            montantDevise: number | null;
            coursApplique: number | null;
            regleParLettrageACheval: {
                groupe: string;
                montant: number;
            } | null;
            regleParLettragePartiel: {
                deviseIndeterminee?: boolean | undefined;
                groupe: string;
                montant: number;
            } | null;
        }[];
        aNouveauProvisoireEcartees: number;
    }[]>;
    comptesEscompteEcart(user: AuthenticatedUser, sens: string): Promise<{
        seuil: number | null;
        roles: {
            role: import("./ecart-escompte").RoleEcartEscompte;
            racine: string;
            comptes: import("./ecart-escompte").CompteCandidat[];
            proposeId: string | null;
            motif: string | null;
        }[];
    }>;
    enregistrer(user: AuthenticatedUser, dto: EnregistrerReglementsDto): Promise<{
        reglements: {
            ecartReglement?: number | undefined;
            escompte?: number | undefined;
            montantDevise?: number | undefined;
            ecartChange?: number | undefined;
            compte: string;
            ecritureId: string;
            montant: number;
            partiel: boolean;
            lettre: string;
        }[];
        ordre: {
            id: string;
            total: import("@prisma/client/runtime/library").Decimal;
            numero: number;
        } | null;
        avertissements: string[];
    }>;
    passerEcartChange(user: AuthenticatedUser, dto: PasserEcartChangeDto): Promise<{
        ecritureId: string;
        ecart: number;
        compte: string;
        lettre: string;
        statut: "SOLDE";
        date: Date;
        dateValeur: Date | null;
        avertissement: string | null;
    }>;
}
