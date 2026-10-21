import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RibTiersDto } from '../tiers/dto/ribs-tiers.dto';
import { RibsSalariesService } from './ribs-salaries.service';
import { PaiementSalairesService } from './paiement-salaires.service';
import { AnnulationPaiementSalairesDto, ModePaiementSalarieDto, PaiementSalairesDto } from './dto/paiement-salaires.dto';
export declare class PaiementSalairesController {
    private readonly ribs;
    private readonly paiements;
    constructor(ribs: RibsSalariesService, paiements: PaiementSalairesService);
    lire(user: AuthenticatedUser, salarieId: string): Promise<{
        modePaiement: import(".prisma/client").$Enums.ModePaiementSalaire | null;
        ribs: {
            coordonnees: string;
            devise: string | null;
            banque: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            commentaire: string | null;
            titulaire: string | null;
            codeBanque: string | null;
            codeGuichet: string | null;
            numeroCompte: string | null;
            cle: string | null;
            iban: string | null;
            codeBic: string | null;
            estPrincipal: boolean;
            salarieId: string;
        }[];
        total: number;
        tronque: boolean;
    }>;
    definirMode(user: AuthenticatedUser, salarieId: string, dto: ModePaiementSalarieDto): Promise<{
        modePaiement: import(".prisma/client").$Enums.ModePaiementSalaire | null;
        ribs: {
            coordonnees: string;
            devise: string | null;
            banque: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            commentaire: string | null;
            titulaire: string | null;
            codeBanque: string | null;
            codeGuichet: string | null;
            numeroCompte: string | null;
            cle: string | null;
            iban: string | null;
            codeBic: string | null;
            estPrincipal: boolean;
            salarieId: string;
        }[];
        total: number;
        tronque: boolean;
    }>;
    creerRib(user: AuthenticatedUser, salarieId: string, dto: RibTiersDto): Promise<{
        devise: string | null;
        banque: string;
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
        titulaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        estPrincipal: boolean;
        salarieId: string;
    }>;
    modifierRib(user: AuthenticatedUser, id: string, dto: RibTiersDto): Promise<{
        devise: string | null;
        banque: string;
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
        titulaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        estPrincipal: boolean;
        salarieId: string;
    }>;
    supprimerRib(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
    proposition(user: AuthenticatedUser, mois: string, coupures?: string): Promise<{
        mois: string;
        echeanceArticle99: string;
        aPayer: {
            bulletinId: string;
            numero: number;
            nature: import(".prisma/client").$Enums.NatureBulletinPaie;
            salarieId: string;
            nomComplet: string;
            netAPayer: number;
            dejaPayeAutres: number;
            montant: number;
            mode: import(".prisma/client").$Enums.ModePaiementSalaire | null;
            rib: string | null;
            passeAuJournal: boolean;
            remisLe: Date | null;
        }[];
        tropPayes: {
            bulletinId: string;
            numero: number;
            salarieId: string;
            nomComplet: string;
            netAPayer: number;
            dejaPaye: number;
            excedent: number;
        }[];
        versementsSansBulletin: {
            bulletinId: string;
            numero: number;
            nomComplet: string;
            montant: number;
            pieces: {
                date: Date;
                piece: string;
            }[];
        }[];
        confrontation422: {
            compte: string;
            solde: number;
            totalPasse: number;
            exercice: {
                debut: Date;
                fin: Date;
            };
            avertissement: string | null;
        } | null;
        tronque: boolean;
        paiements: {
            id: string;
            mode: import(".prisma/client").$Enums.ModePaiementSalaire;
            date: Date;
            journal: string;
            total: number;
            piecePassee: string;
            statutEcriture: import(".prisma/client").$Enums.StatutEcriture | null;
            ordreVirement: {
                numero: number;
                statut: import(".prisma/client").$Enums.StatutOrdreVirement;
            } | null;
            billetage: import("./paiement-salaires").BilletageDuPaiement | null;
            annuleLe: Date | null;
            motifAnnulation: string | null;
            ecritureNegatif: boolean;
            lignes: {
                montant: number;
                reference: string | null;
                nomComplet: string;
                bulletinId: string;
            }[];
        }[];
        journaux: {
            id: string;
            code: string;
            intitule: string;
            compte: string | null;
            caisse: boolean;
            devise: string | null;
        }[];
        coupuresProposees: number[];
        billetage: import("./paiement-salaires").BilletageDuPaiement | null;
    }>;
    payer(user: AuthenticatedUser, mois: string, dto: PaiementSalairesDto): Promise<{
        total: number;
        billetage: import("./paiement-salaires").BilletageDuPaiement | null;
        ordreVirement: {
            numero: number;
        } | null;
        id: string;
        piecePassee: string;
    }>;
    annuler(user: AuthenticatedUser, id: string, dto: AnnulationPaiementSalairesDto): Promise<{
        id: string;
        annuleLe: Date | null;
        ecritureNegatifId: string | null;
    }>;
}
