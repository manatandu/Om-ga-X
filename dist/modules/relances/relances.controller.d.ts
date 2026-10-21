import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RelancesService } from './relances.service';
import { CreerNiveauDto, EmettreRelancesDto, HorsRelanceDto, ModifierNiveauDto } from './dto/relances.dto';
import { TypeRelance } from '@prisma/client';
export declare class RelancesController {
    private readonly relances;
    constructor(relances: RelancesService);
    listerNiveaux(user: AuthenticatedUser): Promise<{
        id: string;
        type: import(".prisma/client").$Enums.TypeRelance;
        estActif: boolean;
        tenantId: string;
        libelle: string;
        niveau: number;
        joursApresEcheance: number;
        modeleTexte: string;
    }[]>;
    creerNiveau(user: AuthenticatedUser, dto: CreerNiveauDto): Promise<{
        id: string;
        type: import(".prisma/client").$Enums.TypeRelance;
        estActif: boolean;
        tenantId: string;
        libelle: string;
        niveau: number;
        joursApresEcheance: number;
        modeleTexte: string;
    }>;
    modifierNiveau(user: AuthenticatedUser, id: string, dto: ModifierNiveauDto): Promise<{
        id: string;
        type: import(".prisma/client").$Enums.TypeRelance;
        estActif: boolean;
        tenantId: string;
        libelle: string;
        niveau: number;
        joursApresEcheance: number;
        modeleTexte: string;
    }>;
    positions(user: AuthenticatedUser, exerciceId: string, type?: TypeRelance, dateReference?: string, racine?: string): Promise<import("./relances.service").PositionRelance[]>;
    releve(user: AuthenticatedUser, compteId: string, exerciceId: string): Promise<{
        cadre: import("../tiers/modeles-impression").Cadre | null;
        compteId: string;
        numero: string;
        intitule: string;
        tiersId: string | null;
        tiersNom: string | null;
        qualite: string;
        tiersEmail: string | null;
        montantDu: number;
        horsRelance: boolean;
        motifHorsRelance: string | null;
        horsRelanceDepuis: string | null;
        retardMaxJours: number;
        echeancePlusAncienne: string | null;
        niveauSuggere: number | null;
        derniereRelance: {
            niveau: number;
            date: string;
        } | null;
        lignes: {
            date: string;
            echeance: string | null;
            libelle: string;
            montant: number;
            retardJours: number;
        }[];
        ecartsChangeNonPasses: {
            code: string;
            ecart: number;
            libelle: string;
        }[];
        groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
        entite: string;
    }>;
    emettre(user: AuthenticatedUser, dto: EmettreRelancesDto): Promise<{
        emises: number;
        niveau: number;
        misesEnFile: number;
        nonRemises: number;
        exclues: {
            compteId: string;
            tiers: string;
            motif: string;
        }[];
        sansObjet: {
            compteId: string;
            compte: string;
            motif: string;
        }[];
        dejaEmises: {
            compteId: string;
            compte: string;
            motif: string;
        }[];
        lettres: {
            compteId: string;
            tiers: string;
            montant: number;
            texte: string;
            modeleImpression: string | null;
            remise: import("./relances.service").RemiseLettre;
        }[];
    }>;
    horsRelance(user: AuthenticatedUser, tiersId: string, dto: HorsRelanceDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        email: string | null;
        numeroImpot: string | null;
        type: import(".prisma/client").$Enums.TypeTiers;
        estActif: boolean;
        tenantId: string;
        code: string;
        contact: string | null;
        boitePostale: string | null;
        qualite: string | null;
        horsRelance: boolean;
        motifHorsRelance: string | null;
        horsRelanceDepuis: Date | null;
        celluleGroupeId: string | null;
        autoriseTvaDebits: boolean;
        referenceAutorisationDebits: string | null;
        dateEffetAutorisationDebits: Date | null;
        dateRevocationAutorisationDebits: Date | null;
        modeleReglementId: string | null;
        modeReglementId: string | null;
        validationAutomatiqueEcheances: boolean;
        modeleImpressionExtraitId: string | null;
        modeleImpressionReglementId: string | null;
        modeleImpressionRappelId: string | null;
    }>;
    historique(user: AuthenticatedUser, compteId?: string, du?: string, au?: string): Promise<{
        relances: ({
            compte: {
                numero: string;
                intitule: string;
            };
            tiers: {
                nom: string;
            } | null;
            niveauRelance: {
                libelle: string;
                niveau: number;
            };
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            montant: import("@prisma/client/runtime/library").Decimal;
            createdBy: string;
            tiersId: string | null;
            compteId: string;
            texte: string;
            niveauId: string;
            dateRelance: Date;
        })[];
        total: number;
        tronque: boolean;
        montantTotal: number;
    }>;
}
