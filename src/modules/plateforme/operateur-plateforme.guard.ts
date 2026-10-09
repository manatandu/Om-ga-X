import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { refusDeSession } from '../auth/jwt-auth.guard';
import {
  authentificationTropAnciennePourLaConsole,
  MOTIF_CONSOLE_AUTHENTIFICATION_ANCIENNE,
  sessionDeLaRequete,
} from '../auth/session-longue';

export const MOTIF_CONSOLE_SANS_DOUBLE_AUTH =
  'La console exige la double authentification · activez-la dans Fichier > Mon compte…, puis revenez.';

/**
 * Réservé à l'OPÉRATEUR DE PLATEFORME : l'exploitant du logiciel (le
 * cabinet), qui gère les cabinets clients et leurs licences depuis la
 * console /plateforme. S'applique après JwtAuthGuard.
 *
 * Le drapeau `estOperateurPlateforme` est relu en base à CHAQUE requête par
 * JwtStrategy.validate (comme le rôle) · une révocation prend donc effet
 * immédiatement, sans attendre l'expiration du jeton. Il ne figure dans
 * aucun DTO : impossible de se l'attribuer par l'API, seul le bootstrap
 * OPERATEURS_PLATEFORME (variable d'environnement) l'accorde.
 *
 * NB : les routes /plateforme ne portent volontairement PAS LicenceGuard ·
 * la licence du propre dossier de l'opérateur (expirée ou suspendue) ne doit
 * jamais le verrouiller hors de la console qui sert justement à gérer les
 * licences.
 */
@Injectable()
export class OperateurPlateformeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.estOperateurPlateforme !== true) {
      throw new ForbiddenException('Réservé à l’opérateur de la plateforme');
    }
    // DOUBLE AUTHENTIFICATION EXIGÉE · la console rouvre et coupe les
    // licences, et réinitialise l'administrateur de n'importe quel cabinet.
    // Un mot de passe seul, volé une fois, en donnerait les clés à tous. Le
    // compte qui l'active a fermé ses autres sessions en le faisant : toute
    // session vivante a donc présenté le second facteur à la connexion.
    if (request.user?.doubleAuthentificationActive !== true) {
      // L'activation vit dans Fichier > Mon compte…, ouvert à tous les rôles
      // (audit de l'interface F3). La fenêtre Utilisateurs n'en montre que
      // l'état, et l'opérateur qui y cherchait le bouton ne le trouvait pas
      // (audit final F162).
      throw new ForbiddenException(MOTIF_CONSOLE_SANS_DOUBLE_AUTH);
    }
    // AUTHENTIFICATION DE MOINS DE HUIT HEURES (décision de Manasse du
    // 2026-10-09, « Long, console redemandée ») · une session « Rester
    // connecté » vit trente jours, la console ne la suit pas au-delà. Le refus
    // est une SESSION PERDUE (`refusDeSession`) · l'écran ramène à la
    // connexion avec le motif, où le mot de passe et le code se redemandent.
    if (authentificationTropAnciennePourLaConsole(sessionDeLaRequete(request), Math.floor(Date.now() / 1000))) {
      throw refusDeSession(MOTIF_CONSOLE_AUTHENTIFICATION_ANCIENNE);
    }
    return true;
  }
}
