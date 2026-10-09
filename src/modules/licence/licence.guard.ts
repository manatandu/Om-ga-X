import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { LicenceService } from './licence.service';

/**
 * À poser sur toute route métier (comptabilité, facturation, etc.), APRÈS la
 * garde d'authentification · `@UseGuards(JwtAuthGuard, LicenceGuard)`. Le
 * dossier se lit sur `request.user.tenantId`, que `JwtAuthGuard` pose.
 * Restent hors d'elle, à dessein · la console de l'opérateur, la restitution
 * du dossier et les sauvegardes sur site (CLAUDE.md § 8).
 */
/** Ce qu'un dossier en lecture seule admet · ni POST, ni PUT, ni PATCH, ni DELETE. */
const METHODES_DE_LECTURE = new Set(['GET', 'HEAD']);

@Injectable()
export class LicenceGuard implements CanActivate {
  constructor(private readonly licenceService: LicenceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant non résolu');
    }

    // Licence préchargée par JwtStrategy (le cas normal) : évaluation pure,
    // zéro requête. Un request.user construit sans elle (tests, appels
    // internes) retombe sur la lecture directe.
    const { autorise, motif, lectureSeule } =
      request.user.licence !== undefined
        ? this.licenceService.evaluerLicence(request.user.licence)
        : await this.licenceService.estAccesAutorise(tenantId);
    if (!autorise) {
      // ABONNEMENT ÉCHU · le dossier se CONSULTE (lectures, impressions,
      // exports servis en GET), rien ne s'y écrit. Le refus d'une écriture le
      // dit, pour que le client sache quoi faire.
      if (lectureSeule && METHODES_DE_LECTURE.has(String(request.method).toUpperCase())) return true;
      throw new ForbiddenException(
        lectureSeule
          ? `${motif} · le dossier est en lecture seule : consultation et impression possibles, aucune modification ` +
              "jusqu'au renouvellement de l'abonnement."
          : (motif ?? 'Accès refusé : licence invalide'),
      );
    }

    return true;
  }
}
