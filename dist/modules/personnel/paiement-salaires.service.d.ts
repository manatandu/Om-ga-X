import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { OrdresVirementService } from '../reglements/ordres-virement.service';
import { type BilletageDuPaiement } from './paiement-salaires';
import { AnnulationPaiementSalairesDto, PaiementSalairesDto } from './dto/paiement-salaires.dto';
export declare const PLAFOND_BULLETINS_DU_MOIS = 2000;
export declare const PLAFOND_PAIEMENTS_DU_MOIS = 200;
export declare class PaiementSalairesService {
    private readonly prisma;
    private readonly ecritures;
    private readonly ordres;
    constructor(prisma: PrismaService, ecritures: EcritureService, ordres: OrdresVirementService);
    private dejaPayes;
    proposition(tenantId: string, mois: string, coupuresDemandees?: number[]): Promise<{
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
            billetage: BilletageDuPaiement | null;
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
        billetage: BilletageDuPaiement | null;
    }>;
    versementsDesBulletins(tenantId: string, bulletins: readonly {
        id: string;
        numero: number;
        nomComplet: string;
    }[]): Promise<{
        bulletinId: string;
        numero: number;
        nomComplet: string;
        montant: number;
        pieces: {
            date: Date;
            piece: string;
        }[];
    }[]>;
    private confronterAu422;
    payer(tenantId: string, userId: string, email: string, mois: string, dto: PaiementSalairesDto): Promise<{
        total: number;
        billetage: BilletageDuPaiement | null;
        ordreVirement: {
            numero: number;
        } | null;
        id: string;
        piecePassee: string;
    }>;
    annuler(tenantId: string, userId: string, email: string, id: string, dto: AnnulationPaiementSalairesDto): Promise<{
        id: string;
        annuleLe: Date | null;
        ecritureNegatifId: string | null;
    }>;
}
