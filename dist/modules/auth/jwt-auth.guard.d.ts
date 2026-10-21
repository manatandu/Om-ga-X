import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export declare const MOTIF_SESSION_ABSENTE = "Session absente ou expir\u00E9e \u00B7 reconnectez-vous.";
export declare const SIGNAL_SESSION_PERDUE = "perdue";
export declare function refusDeSession(message?: string): UnauthorizedException;
declare const JwtAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class JwtAuthGuard extends JwtAuthGuard_base {
    private readonly reflector;
    constructor(reflector: Reflector);
    handleRequest<T>(err: unknown, user: T): T;
    canActivate(contexte: ExecutionContext): Promise<boolean>;
}
export {};
