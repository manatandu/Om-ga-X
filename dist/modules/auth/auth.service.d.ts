import { LicenceSurSiteService } from '../sur-site/licence-sur-site.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { CompteService } from '../comptes/compte.service';
import { ExerciceService } from '../exercice/exercice.service';
import { JournalService } from '../journaux/journal.service';
import { TauxTvaService } from '../tva/taux-tva.service';
import { ImmobilisationService } from '../immobilisations/immobilisation.service';
import { AnalytiqueService } from '../analytique/analytique.service';
import { RelancesService } from '../relances/relances.service';
import { RegisterDto } from './dto/register.dto';
import { InscriptionEssaiDto } from './dto/inscription-essai.dto';
import { LoginDto } from './dto/login.dto';
import { Prisma } from '@prisma/client';
import { CourrierService } from '../courrier/courrier.service';
import { SessionEmise, SessionEnCours } from './session-longue';
export declare const SALT_ROUNDS = 12;
export declare const EMPREINTE_FACTICE = "$2b$12$zNSRXkByzfZhOQSR4/60ze6WWpSytqcVD.yZf5fl0OqDCsgj6X03y";
export declare const MOTIF_LICENCE_EDITEUR_A_LA_CREATION: string;
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly tenantService;
    private readonly compteService;
    private readonly exerciceService;
    private readonly journalService;
    private readonly tauxTvaService;
    private readonly immobilisationService;
    private readonly analytiqueService;
    private readonly relancesService;
    private readonly surSite?;
    private readonly courrier?;
    private readonly logger;
    constructor(prisma: PrismaService, jwt: JwtService, tenantService: TenantService, compteService: CompteService, exerciceService: ExerciceService, journalService: JournalService, tauxTvaService: TauxTvaService, immobilisationService: ImmobilisationService, analytiqueService: AnalytiqueService, relancesService: RelancesService, surSite?: LicenceSurSiteService | undefined, courrier?: CourrierService | undefined);
    register(dto: RegisterDto, options?: {
        dateExpirationLicence?: Date;
        motDePasseProvisoire?: boolean;
    }): Promise<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
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
            ecartsOuvertureSuivanteConservee: Prisma.JsonValue | null;
            defaitsParLaCloture: Prisma.JsonValue | null;
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
    }>;
    inscrireEnEssai(dto: InscriptionEssaiDto): Promise<{
        message: string;
        joursEssai: number;
    }>;
    dossierDInstallation(): Promise<string | null>;
    premierDossierAttendu(): Promise<boolean>;
    login(dto: LoginDto, adresseIp?: string | null): Promise<SessionEmise | {
        deuxiemeFacteurRequis: true;
    }>;
    private journaliserConnexion;
    private compteDoubleAuth;
    etatDoubleAuth(userId: string): Promise<{
        active: boolean;
        depuis: Date | null;
        codesSecoursRestants: number;
        exigeePourLaConsole: boolean;
    }>;
    initierDoubleAuth(userId: string): Promise<{
        secret: string;
        uri: string;
    }>;
    activerDoubleAuth(userId: string, motDePasseActuel: string, code: string, maintenant?: Date, session?: SessionEnCours | null): Promise<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
        codesSecours: string[];
    }>;
    desactiverDoubleAuth(userId: string, motDePasse: string, code: string, maintenant?: Date, session?: SessionEnCours | null): Promise<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
        desactivee: boolean;
    }>;
    regenererCodesSecours(userId: string, motDePasseActuel: string, code: string, maintenant?: Date): Promise<{
        codesSecours: string[];
    }>;
    private aviserDoubleAuth;
    changerMotDePasse(userId: string, motDePasseActuel: string, nouveauMotDePasse: string, session?: SessionEnCours | null): Promise<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
        change: boolean;
    }>;
    changerAdresse(userId: string, motDePasseActuel: string, nouvelleAdresse: string, session?: SessionEnCours | null): Promise<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
        adresse: string;
    }>;
    deconnecterAutresAppareils(userId: string, motDePasseActuel: string, session: SessionEnCours | null, maintenant?: Date): Promise<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
        autresAppareilsDeconnectes: boolean;
    }>;
    deconnecterPartout(userId: string): Promise<{
        sessionsFermees: boolean;
    }>;
    me(userId: string): Promise<{
        id: string;
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        estOperateurPlateforme: boolean;
        doitChangerMotDePasse: boolean;
        tenant: {
            id: string;
            nom: string;
            referentiel: import(".prisma/client").$Enums.Referentiel;
            jeuEtatsFinanciersSycebnl: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
            systemeComptableSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
            devise: string | null;
            numeroImpot: string | null;
            mentionsSociete: string | null;
            nombreCellules: number;
            peutCreerCellules: boolean;
            ongEtrangere: boolean | null;
            assujettissementTva: boolean | null;
            venteBiensServices: boolean | null;
            modulesActives: import(".prisma/client").$Enums.ModuleOptionnel[];
            longueurCompte: number;
            estDemonstration: boolean;
        };
    }>;
    private reemettre;
}
