import { OnModuleInit } from '@nestjs/common';
import { CourrierService } from '../courrier/courrier.service';
import { ConfigService } from '@nestjs/config';
import { Referentiel } from '@prisma/client';
import { GarnissageDemonstrationService } from './garnissage-demonstration.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreerCabinetDto, ModifierGroupeDto, ModifierLicenceDto } from './dto/plateforme.dto';
export declare const MOTIF_SUR_SITE_NON_ATTRIBUABLE: string;
export declare class PlateformeService implements OnModuleInit {
    private readonly prisma;
    private readonly config;
    private readonly authService;
    private readonly garnissage?;
    private readonly courrier?;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, authService: AuthService, garnissage?: GarnissageDemonstrationService | undefined, courrier?: CourrierService | undefined);
    onModuleInit(): Promise<void>;
    listeCabinets(): Promise<{
        total: number;
        tronque: boolean;
        plafond: number;
        cabinets: {
            id: string;
            nom: string;
            referentiel: import(".prisma/client").$Enums.Referentiel;
            jeuEtatsFinanciersSycebnl: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
            systemeComptableSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
            ville: string | null;
            pays: string | null;
            numeroImpot: string | null;
            createdAt: Date;
            licence: {
                statut: import(".prisma/client").$Enums.StatutLicence;
                type: import(".prisma/client").$Enums.TypeLicence;
                dateDebut: Date;
                dateExpiration: Date | null;
                dernierHeartbeatAt: Date | null;
            } | null;
            dossierMere: {
                id: string;
                nom: string;
            } | null;
            plafondCellules: number | null;
            nbCellules: number;
            nbUtilisateurs: number;
            nbEcritures: number;
        }[];
    }>;
    private refuserAttributionSurSite;
    modifierLicence(tenantId: string, dto: ModifierLicenceDto): Promise<{
        cellulesEnCascade: number;
        statut: import(".prisma/client").$Enums.StatutLicence;
        type: import(".prisma/client").$Enums.TypeLicence;
        dateDebut: Date;
        dateExpiration: Date | null;
        dernierHeartbeatAt: Date | null;
    }>;
    echeanceAbonnement(cabinetId: string, echeance: string): Promise<string>;
    private echeanceDeLaMere;
    private modifierLicenceSansGarde;
    private refuserTouchePropriete;
    modifierGroupe(tenantId: string, dto: ModifierGroupeDto): Promise<{
        id: string;
        plafondCellules: number | null;
        dossierMereId?: undefined;
    } | {
        id: string;
        dossierMereId: string;
        plafondCellules?: undefined;
    } | {
        id: string;
        dossierMereId: null;
        plafondCellules?: undefined;
    }>;
    private verifierMere;
    creerCabinet(dto: CreerCabinetDto): Promise<{
        tenant: {
            id: string;
            nom: string;
            referentiel: import(".prisma/client").$Enums.Referentiel;
            jeuEtatsFinanciersSycebnl: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
            systemeComptableSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
            numeroImpot: string | null;
        };
        exercice: {
            tenantId: string;
            id: string;
            statut: import(".prisma/client").$Enums.StatutExercice;
            dateDebut: Date;
            dateFin: Date;
            dateArreteComptes: Date | null;
            motifOuvertureSuivanteConservee: string | null;
            ecartsOuvertureSuivanteConservee: import("@prisma/client/runtime/library").JsonValue | null;
            defaitsParLaCloture: import("@prisma/client/runtime/library").JsonValue | null;
            nombreEtablissementsPays: number | null;
            nombreEtablissementsHorsPays: number | null;
            premiereAnneeExercicePays: number | null;
            controleEntreprise: import(".prisma/client").$Enums.ControleEntreprise | null;
            dateAssembleeGenerale: Date | null;
            dateDepotEtatsPortefeuille: Date | null;
            dateTransmissionPvPortefeuille: Date | null;
            dateDeclarationDividendeEtat: Date | null;
            dateNotePerceptionDividende: Date | null;
            datePaiementDividendeEtat: Date | null;
        };
        adminEmail: string;
        motDePasseTemporaire: string;
    }>;
    reinitialiserAdmin(tenantId: string, dto: {
        email: string;
    }): Promise<{
        reinitialise: boolean;
        email: string;
        courriel: import(".prisma/client").$Enums.StatutMessage;
    }>;
    designerDossierEditeur(tenantId: string): Promise<{
        statut: import(".prisma/client").$Enums.StatutLicence;
        type: import(".prisma/client").$Enums.TypeLicence;
        dateDebut: Date;
        dateExpiration: Date | null;
        dernierHeartbeatAt: Date | null;
    }>;
    dossierEditeurId(): Promise<string | null>;
    preparerDossierDemonstration(dto: {
        nomEntite?: string;
        email: string;
        motDePasse: string;
        referentiel?: Referentiel;
    }): Promise<{
        tenantId: string;
        garni: {
            tiers: number;
            ecritures: number;
        } | null;
        repris: boolean;
        nom: string;
        email: string;
        rappel: string;
    }>;
    private reprendreGarnissage;
}
