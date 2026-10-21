import { AuthService } from '../auth/auth.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { LicenceSurSiteService } from './licence-sur-site.service';
import { SauvegardeSurSiteService } from './sauvegarde-sur-site.service';
import { CopieExterneDto, DeposerLicenceDto } from './sur-site.dto';
export declare class SurSiteController {
    private readonly licence;
    private readonly sauvegardes;
    private readonly auth;
    constructor(licence: LicenceSurSiteService, sauvegardes: SauvegardeSurSiteService, auth: AuthService);
    etat(): Promise<{
        surSite: boolean;
        premierDossierAttendu?: undefined;
        statut?: undefined;
        motif?: undefined;
        empreinte?: undefined;
        dateVersion?: undefined;
        licence?: undefined;
    } | {
        surSite: boolean;
        premierDossierAttendu: boolean;
        statut: import("./licence-signee").StatutLicenceSurSite;
        motif: string | null;
        empreinte: string | null;
        dateVersion: string | null;
        licence: {
            numero: string;
            titulaire: string;
            emiseLe: string;
            finMaintenance: string;
            expiration: string | null;
            dossiersMax: number;
        } | null;
    }>;
    deposer(dto: DeposerLicenceDto): Promise<{
        surSite: boolean;
        premierDossierAttendu?: undefined;
        statut?: undefined;
        motif?: undefined;
        empreinte?: undefined;
        dateVersion?: undefined;
        licence?: undefined;
    } | {
        surSite: boolean;
        premierDossierAttendu: boolean;
        statut: import("./licence-signee").StatutLicenceSurSite;
        motif: string | null;
        empreinte: string | null;
        dateVersion: string | null;
        licence: {
            numero: string;
            titulaire: string;
            emiseLe: string;
            finMaintenance: string;
            expiration: string | null;
            dossiersMax: number;
        } | null;
    }>;
    lister(): {
        dossier: string;
        copies: import("./sauvegarde-sur-site.service").CopieSauvegarde[];
        copieExterne: import("./sauvegarde-sur-site.service").EtatCopieExterne;
    };
    copieExterne(dto: CopieExterneDto): Promise<import("./sauvegarde-sur-site.service").EtatCopieExterne>;
    sauvegarder(): Promise<import("./sauvegarde-sur-site.service").CopieSauvegarde>;
    creerDossier(dto: RegisterDto): Promise<{
        dossier: string;
        email: string;
    }>;
}
