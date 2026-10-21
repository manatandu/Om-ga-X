import { PlateformeService } from './plateforme.service';
import { LicencesSurSiteService } from './licences-sur-site.service';
import { AbonnementsService } from './abonnements/abonnements.service';
import { CourrielsEditeurService } from './abonnements/courriels-editeur.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreerCabinetDto, ActiverAbonnementDto, EmettreLicenceSurSiteDto, EnregistrerAbonnementDto, EnvoyerParCourrielDto, FacturerAbonnementsDto, FixerPrixFormuleDto, MarquerPayeeDto, ModifierGroupeDto, ModifierLicenceDto, PreparerDemonstrationDto, ReinitialiserAdminDto } from './dto/plateforme.dto';
export declare class PlateformeController {
    private readonly plateformeService;
    private readonly licencesSurSite;
    private readonly abonnements;
    private readonly courriels;
    constructor(plateformeService: PlateformeService, licencesSurSite: LicencesSurSiteService, abonnements: AbonnementsService, courriels: CourrielsEditeurService);
    formules(): Promise<{
        prixMensuelUsd: number | null;
        prixAnnuelUsd: number | null;
        id: string;
        type: import(".prisma/client").$Enums.TypeFormuleAbonnement;
        libelle: string;
        code: string;
        actif: boolean;
        contenu: string | null;
    }[]>;
    fixerPrix(code: string, dto: FixerPrixFormuleDto): Promise<{
        prixMensuelUsd: number | null;
        prixAnnuelUsd: number | null;
        id: string;
        type: import(".prisma/client").$Enums.TypeFormuleAbonnement;
        libelle: string;
        code: string;
        actif: boolean;
        contenu: string | null;
    }[]>;
    listeAbonnements(): Promise<{
        total: number;
        tronque: boolean;
        plafond: number;
        abonnements: {
            id: string;
            cabinetId: string;
            cabinet: string;
            formule: {
                libelle: string;
                code: string;
            };
            options: {
                libelle: string;
                code: string;
            }[];
            dossiersSupplementaires: number;
            periodicite: import(".prisma/client").$Enums.PeriodiciteFacturationEditeur;
            debut: string | null;
            finEssai: string | null;
            tiers: string;
            actif: boolean;
            echeanceLicence: string | null;
            licenceSuspendue: boolean;
            factures: {
                id: string;
                periode: string;
                montantUsd: number;
                numero: string;
                emiseLe: string | null;
                payeeLe: string | null;
                joursImpayee: number | null;
            }[];
        }[];
    }>;
    enregistrerAbonnement(dto: EnregistrerAbonnementDto): Promise<{
        id: string;
    }>;
    activerAbonnement(id: string, dto: ActiverAbonnementDto): Promise<{
        id: string;
        actif: boolean;
    }>;
    marquerPayee(id: string, dto: MarquerPayeeDto): Promise<{
        echeanceLicence: string;
    }>;
    facturerAbonnements(dto: FacturerAbonnementsDto, operateur: AuthenticatedUser): Promise<{
        periode: string;
        cours: number;
        assujetti: boolean;
        resultats: {
            cabinet: string;
            statut: "FACTURE" | "DEJA_FACTURE" | "NON_DU";
            motif?: string;
            numero?: string;
            totalUsd?: number;
            courriel?: string;
        }[];
    }>;
    envoyerFactureAbonnement(id: string, dto: EnvoyerParCourrielDto, operateur: AuthenticatedUser): Promise<import("../courrier/courrier.service").ResultatMiseEnFile>;
    listeLicencesSurSite(): Promise<{
        total: number;
        tronque: boolean;
        plafond: number;
        licences: {
            id: string;
            createdAt: Date;
            numero: string;
            titulaire: string;
            empreinteMachine: string;
            emiseLe: string;
            finMaintenance: string;
            expiration: string | null;
            dossiersMax: number;
            emisePar: string;
        }[];
    }>;
    fichierLicenceSurSite(id: string): Promise<{
        numero: string;
        fichier: string;
    }>;
    envoyerLicenceSurSite(id: string, dto: EnvoyerParCourrielDto, operateur: AuthenticatedUser): Promise<import("../courrier/courrier.service").ResultatMiseEnFile>;
    emettreLicenceSurSite(dto: EmettreLicenceSurSiteDto, operateur: AuthenticatedUser): Promise<{
        id: string;
        numero: string;
        fichier: string;
    }>;
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
    modifierLicence(tenantId: string, dto: ModifierLicenceDto): Promise<{
        cellulesEnCascade: number;
        statut: import(".prisma/client").$Enums.StatutLicence;
        type: import(".prisma/client").$Enums.TypeLicence;
        dateDebut: Date;
        dateExpiration: Date | null;
        dernierHeartbeatAt: Date | null;
    }>;
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
    designerDossierEditeur(tenantId: string): Promise<{
        statut: import(".prisma/client").$Enums.StatutLicence;
        type: import(".prisma/client").$Enums.TypeLicence;
        dateDebut: Date;
        dateExpiration: Date | null;
        dernierHeartbeatAt: Date | null;
    }>;
    preparerDemonstration(dto: PreparerDemonstrationDto): Promise<{
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
    reinitialiserAdmin(tenantId: string, dto: ReinitialiserAdminDto): Promise<{
        reinitialise: boolean;
        email: string;
        courriel: import(".prisma/client").$Enums.StatutMessage;
    }>;
}
