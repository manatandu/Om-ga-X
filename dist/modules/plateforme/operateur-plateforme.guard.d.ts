import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare const MOTIF_CONSOLE_SANS_DOUBLE_AUTH = "La console exige la double authentification \u00B7 activez-la dans Fichier > Mon compte\u2026, puis revenez.";
export declare class OperateurPlateformeGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
