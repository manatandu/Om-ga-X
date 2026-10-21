import { PrismaService } from '../../common/prisma.service';
import { Prisma, Referentiel, StatutMessage, TypeRelance } from '@prisma/client';
import { CourrierService } from '../courrier/courrier.service';
import { CreerNiveauDto, EmettreRelancesDto, ModifierNiveauDto } from './dto/relances.dto';
import { type GroupesLusLigneALigne } from '../lettrage/reste-des-lignes-ouvertes';
export declare const MOTIF_COMPTE_INTROUVABLE_RELEVE = "Compte introuvable dans ce dossier : aucun relev\u00E9 ne peut \u00EAtre \u00E9tabli.";
export declare function qualiteDuCompte(numero: string, referentiel: Referentiel): string;
export declare function motifRienAReclamer(type: TypeRelance): string;
export declare const RACINES_RELANCABLES: Record<Referentiel, string[]>;
export interface PositionRelance {
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
    groupesLusLigneALigne: GroupesLusLigneALigne;
}
export declare function objetDeLaRelance(libelleNiveau: string, entite: string): string;
export interface RemiseLettre {
    destinataire: string | null;
    statut: StatutMessage | null;
    messageId: string | null;
    motif: string | null;
}
export declare class RelancesService {
    private readonly prisma;
    private readonly courrier;
    constructor(prisma: PrismaService, courrier: CourrierService);
    listerNiveaux(tenantId: string): Promise<{
        type: import(".prisma/client").$Enums.TypeRelance;
        id: string;
        tenantId: string;
        estActif: boolean;
        libelle: string;
        niveau: number;
        joursApresEcheance: number;
        modeleTexte: string;
    }[]>;
    seedNiveauxDefaut(tenantId: string, referentiel: Referentiel, client?: Prisma.TransactionClient): Promise<void>;
    creerNiveau(tenantId: string, dto: CreerNiveauDto): Promise<{
        type: import(".prisma/client").$Enums.TypeRelance;
        id: string;
        tenantId: string;
        estActif: boolean;
        libelle: string;
        niveau: number;
        joursApresEcheance: number;
        modeleTexte: string;
    }>;
    modifierNiveau(tenantId: string, niveauId: string, dto: ModifierNiveauDto): Promise<{
        type: import(".prisma/client").$Enums.TypeRelance;
        id: string;
        tenantId: string;
        estActif: boolean;
        libelle: string;
        niveau: number;
        joursApresEcheance: number;
        modeleTexte: string;
    }>;
    positions(tenantId: string, params: {
        exerciceId: string;
        dateReference?: string;
        type?: TypeRelance;
        racine?: string;
    }): Promise<PositionRelance[]>;
    releve(tenantId: string, compteId: string, exerciceId: string): Promise<{
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
        groupesLusLigneALigne: GroupesLusLigneALigne;
        entite: string;
    }>;
    private composer;
    emettre(tenantId: string, createdBy: string, dto: EmettreRelancesDto): Promise<{
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
            remise: RemiseLettre;
        }[];
    }>;
    private remettre;
    definirHorsRelance(tenantId: string, tiersId: string, params: {
        horsRelance: boolean;
        motif?: string;
    }): Promise<{
        email: string | null;
        nom: string;
        type: import(".prisma/client").$Enums.TypeTiers;
        id: string;
        tenantId: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        numeroImpot: string | null;
        estActif: boolean;
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
    historique(tenantId: string, filtre?: {
        compteId?: string;
        du?: string;
        au?: string;
    }): Promise<{
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
            montant: Prisma.Decimal;
            id: string;
            tenantId: string;
            createdAt: Date;
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
export declare const PLAFOND_HISTORIQUE = 500;
