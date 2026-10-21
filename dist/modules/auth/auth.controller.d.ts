import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { InscriptionEssaiDto } from './dto/inscription-essai.dto';
import { LoginDto } from './dto/login.dto';
import { ChangerMotDePasseDto } from './dto/changer-mot-de-passe.dto';
import { ChangerAdresseDto } from './dto/changer-adresse.dto';
import { ActiverDoubleAuthDto, DesactiverDoubleAuthDto, RegenererCodesSecoursDto } from './dto/double-authentification.dto';
import { DeconnecterAutresAppareilsDto } from './dto/deconnecter-autres-appareils.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
export declare class AuthController {
    private readonly authService;
    private readonly config;
    constructor(authService: AuthService, config: ConfigService);
    private poserSession;
    register(dto: RegisterDto, res: Response): Promise<Omit<{
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
    }, "accessToken" | "maxAgeMs">>;
    private inscriptionEssaiOuverte;
    etatInscriptionEssai(): {
        ouverte: boolean;
        joursEssai: number;
    };
    inscrireEnEssai(dto: InscriptionEssaiDto): Promise<{
        message: string;
        joursEssai: number;
    }>;
    login(dto: LoginDto, res: Response, req?: Request): Promise<{
        deuxiemeFacteurRequis: true;
    } | Omit<import("./session-longue").SessionEmise, "accessToken" | "maxAgeMs">>;
    logout(res: Response): Promise<{
        deconnecte: boolean;
    }>;
    me(user: AuthenticatedUser, req?: Request): Promise<{
        sessionLongue: boolean;
        csrfToken?: string | undefined;
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
    changerMotDePasse(user: AuthenticatedUser, dto: ChangerMotDePasseDto, res: Response): Promise<Omit<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
        change: boolean;
    }, "accessToken" | "maxAgeMs">>;
    changerAdresse(user: AuthenticatedUser, dto: ChangerAdresseDto, res: Response): Promise<Omit<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
        adresse: string;
    }, "accessToken" | "maxAgeMs">>;
    etatDoubleAuth(user: AuthenticatedUser): Promise<{
        active: boolean;
        depuis: Date | null;
        codesSecoursRestants: number;
        exigeePourLaConsole: boolean;
    }>;
    initierDoubleAuth(user: AuthenticatedUser): Promise<{
        secret: string;
        uri: string;
    }>;
    activerDoubleAuth(user: AuthenticatedUser, dto: ActiverDoubleAuthDto, res: Response): Promise<Omit<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
        codesSecours: string[];
    }, "accessToken" | "maxAgeMs">>;
    desactiverDoubleAuth(user: AuthenticatedUser, dto: DesactiverDoubleAuthDto, res: Response): Promise<Omit<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
        desactivee: boolean;
    }, "accessToken" | "maxAgeMs">>;
    regenererCodesSecours(user: AuthenticatedUser, dto: RegenererCodesSecoursDto): Promise<{
        codesSecours: string[];
    }>;
    deconnecterPartout(user: AuthenticatedUser, res: Response): Promise<{
        sessionsFermees: boolean;
    }>;
    deconnecterAutresAppareils(user: AuthenticatedUser, dto: DeconnecterAutresAppareilsDto, res: Response): Promise<Omit<{
        accessToken: string;
        csrfToken: string;
        sessionLongue: boolean;
        maxAgeMs: number | null;
        autresAppareilsDeconnectes: boolean;
    }, "accessToken" | "maxAgeMs">>;
}
