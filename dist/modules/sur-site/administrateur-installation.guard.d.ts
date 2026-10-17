import { CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
export declare class AdministrateurInstallationGuard implements CanActivate {
    private readonly auth;
    constructor(auth: AuthService);
    canActivate(ctx: ExecutionContext): Promise<boolean>;
}
