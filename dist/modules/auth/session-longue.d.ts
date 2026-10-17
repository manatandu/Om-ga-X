import type { JwtService } from '@nestjs/jwt';
export declare const SECONDES_PAR_JOUR = 86400;
export declare const DUREE_MAXIMALE_SESSION_LONGUE_S: number;
export declare const DUREE_INACTIVITE_SESSION_LONGUE_S: number;
export declare const INTERVALLE_PROLONGATION_S = 86400;
export declare const DELAI_CONSOLE_DEPUIS_AUTHENTIFICATION_S: number;
export declare const MOTIF_CONSOLE_AUTHENTIFICATION_ANCIENNE = "La console de l'\u00E9diteur demande une connexion de moins de huit heures \u00B7 reconnectez-vous avec votre mot de passe et votre code.";
export declare function authentificationTropAnciennePourLaConsole(session: SessionEnCours | null, maintenantS: number): boolean;
export interface ChargeJeton {
    sub: string;
    csrf?: string;
    iat?: number;
    exp?: number;
    longue?: boolean;
    origine?: number;
    authentification?: number;
    connexionComplete?: number;
}
export interface SessionEnCours {
    longue: boolean;
    origine: number;
    iat: number | null;
    exp: number | null;
    csrf: string | null;
    authentification?: number | null;
    connexionComplete?: number | null;
}
export declare function sessionDuJeton(charge: ChargeJeton, instantS: number): SessionEnCours;
export declare function echeanceSessionLongue(origine: number, instantS: number): number;
export declare function prolongationDue(session: SessionEnCours, instantS: number): boolean;
export interface DemandeSession {
    longue: boolean;
    origine?: number;
    expCourte?: number | null;
    csrf?: string | null;
    authentification?: number | null;
    connexionComplete?: 'maintenant' | number | null;
}
export interface SessionEmise {
    accessToken: string;
    csrfToken: string;
    sessionLongue: boolean;
    maxAgeMs: number | null;
}
export declare function emettreSession(jwt: Pick<JwtService, 'sign'>, userId: string, demande: DemandeSession, instantMs?: number): SessionEmise;
export declare const CLE_SESSION_REQUETE = "sessionOmegax";
export interface SessionDeRequete extends SessionEnCours {
    prolongation?: {
        accessToken: string;
        maxAgeMs: number;
    };
}
export declare function sessionDeLaRequete(requete: unknown): SessionDeRequete | null;
export declare function demandeDeReemission(session: SessionEnCours | null): DemandeSession;
