import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LettrageService } from './lettrage.service';
import { CompleterLettrageDto, ConfirmerPreLettrageDto, LettrerDto, ReconduireLettrageDto, VerrouillerLettrageDto } from './dto/lettrage.dto';
export declare class LettrageController {
    private readonly lettrageService;
    constructor(lettrageService: LettrageService);
    lister(user: AuthenticatedUser, compteId: string, nonLettreesSeulement?: string): Promise<{
        tronque: boolean;
        total: number;
        plafond: number;
        totaux: {
            debit: number;
            credit: number;
        };
        prochaineLettre: string;
        compte: {
            id: string;
            numero: string;
            intitule: string;
            lettrable: boolean;
        };
        lignes: {
            id: string;
            date: Date;
            journalCode: string;
            libelle: string;
            reference: string | null;
            debit: number;
            credit: number;
            lettre: string | null;
            lettrageId: string | null;
            codeLettrage: string | null;
            devise: string | null;
            montantDevise: number | null;
        }[];
        lettrages: {
            id: string;
            code: string;
            statut: import(".prisma/client").$Enums.StatutLettrage;
            solde: number;
            origine: import(".prisma/client").$Enums.OrigineLettrage;
            verrouille: boolean;
            ecartChange: number | null;
            createdAt: Date;
            createdBy: string;
            soldeAt: Date | null;
        }[];
    }>;
    lettrer(user: AuthenticatedUser, compteId: string, dto: LettrerDto): Promise<{
        lettre: string;
        statut: import(".prisma/client").$Enums.StatutLettrage;
        solde: number;
        ecartChange: number | null;
        nombreLignes: number;
    }>;
    lettrageAutomatique(user: AuthenticatedUser, compteId: string): Promise<{
        ecarteesReclassement: number;
        passesParMontantSuspendues: boolean;
        miseDeCote: string | null;
        groupes: number;
        parPiece: number;
        parMontant: number;
        lettres: string[];
    }>;
    preLettrage(user: AuthenticatedUser, compteId: string): Promise<{
        relettrages: {
            ligne: {
                ligneId: string;
                date: string;
                libelle: string;
                debit: number;
                credit: number;
            };
            candidates: {
                ligneId: string;
                date: string;
                libelle: string;
                debit: number;
                credit: number;
            }[];
        }[];
        reconductions: {
            lettrageId: string;
            code: string;
            reste: number;
            etat: import("./reconduction-lettrage").EtatNonReconduit;
            detail: string;
            lignes: {
                ligneId: string;
                date: string;
                libelle: string;
                debit: number;
                credit: number;
            }[];
        }[];
        reconductionsTotal: number;
        reconductionsTronque: boolean;
        propositions: {
            origine: import(".prisma/client").$Enums.OrigineLettrage;
            ligneIds: string[];
            lignes: {
                ligneId: string;
                date: string;
                libelle: string;
                reference: string;
                debit: number;
                credit: number;
            }[];
            montant: number;
            solde: number;
        }[];
        nonProposees: number;
        ecarteesReclassement: number;
        passesParMontantSuspendues: boolean;
        miseDeCote: string | null;
        avertissement: string;
    }>;
    confirmerPreLettrage(user: AuthenticatedUser, compteId: string, dto: ConfirmerPreLettrageDto): Promise<{
        groupes: number;
        lettres: string[];
    }>;
    reconduire(user: AuthenticatedUser, compteId: string, dto: ReconduireLettrageDto): Promise<{
        lettre: string;
        reconduitDe: string;
        reste: number;
    }>;
    completer(user: AuthenticatedUser, lettrageId: string, dto: CompleterLettrageDto): Promise<{
        lettre: string;
        statut: "SOLDE" | "PARTIEL";
        solde: number;
        nombreLignes: number;
    }>;
    propositionEcartChange(user: AuthenticatedUser, compteId: string, lettrageId: string): Promise<{
        ecart: null;
        motif: string;
        lettrageId: string;
        code: string;
        compteId: string;
        compteNumero: string;
    } | {
        aCheval: boolean;
        fige: boolean;
        ecart: number;
        sens: "PERTE" | "GAIN";
        devise: string | null;
        deviseId: string;
        date: Date;
        exerciceId: string;
        nature: import("../reglements/ecart-change-realise").NatureCreanceDette | null;
        comptePrescrit: {
            id: string;
            numero: string;
            intitule: string;
        } | null;
        numeroPrescrit: string | null;
        motif: string | null;
        lettrageId: string;
        code: string;
        compteId: string;
        compteNumero: string;
    }>;
    verrouiller(user: AuthenticatedUser, lettrageId: string, dto: VerrouillerLettrageDto): Promise<{
        code: string;
        verrouille: boolean;
    }>;
    delettrer(user: AuthenticatedUser, compteId: string, lettre: string): Promise<{
        lettre: string;
        nombreLignes: number;
    }>;
}
export declare class LettrageDossierController {
    private readonly lettrageService;
    constructor(lettrageService: LettrageService);
    listerTout(user: AuthenticatedUser, statut?: string): Promise<{
        id: string;
        compteId: string;
        compteNumero: string;
        compteIntitule: string;
        code: string;
        statut: import(".prisma/client").$Enums.StatutLettrage;
        solde: number;
        origine: import(".prisma/client").$Enums.OrigineLettrage;
        verrouille: boolean;
        ecartChange: number | null;
        nombreLignes: number;
        createdAt: Date;
        createdBy: string;
        soldeAt: Date | null;
    }[]>;
}
