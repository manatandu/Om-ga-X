import { CookieOptions, Response } from 'express';
export declare const COOKIE_SESSION = "__session";
export declare const ANCIEN_COOKIE_SESSION = "omegax_session";
export declare const ENTETE_CSRF = "x-csrf-token";
export declare const OPTIONS_COOKIE_SESSION: CookieOptions;
export declare function optionsCookieSession(surSite?: boolean, httpLocal?: boolean): CookieOptions;
export declare function estHttpLocal(req?: {
    secure?: boolean;
    hostname?: string;
} | null): boolean;
export declare function poserCookieSession(res: Response, jeton: string, maxAgeMs: number | null): void;
export declare function effacerCookiesSession(res: Response): void;
