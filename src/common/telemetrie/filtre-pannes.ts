import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { signalerPanneServeur } from './telemetrie-serveur';

/**
 * UNE PANNE SE SIGNALE, UN REFUS JAMAIS · un 4xx est la réponse voulue
 * d'OmegaX (un refus nommé, une session perdue, un débit limité), un 5xx est
 * un défaut. Seul le second part à Sentry.
 *
 * Le filtre ne change RIEN à la réponse · il signale, puis rend la main au
 * filtre de base de Nest, celui qui répondait jusqu'ici (même corps, même
 * statut, même ligne au journal). Sentry inactif, le signalement est sans
 * effet.
 *
 * L'étiquette `route` est le MOTIF de la route déclarée (`/comptes/:id`),
 * jamais l'adresse appelée · celle-ci porte des identifiants, et la recherche
 * d'écritures des montants dans sa chaîne de requête.
 */
@Catch()
export class FiltrePannes extends BaseExceptionFilter {
  catch(exception: unknown, hote: ArgumentsHost) {
    if (hote.getType() === 'http') {
      const statut = statutDe(exception);
      if (statut >= 500) {
        const requete = hote.switchToHttp().getRequest<{ method?: string; route?: { path?: unknown }; path?: string }>();
        const motif = typeof requete?.route?.path === 'string' ? requete.route.path : requete?.path ?? '/';
        signalerPanneServeur(exception, {
          route: motif,
          methode: requete?.method,
          statut: String(statut),
          code_prisma: codePrisma(exception),
        });
      }
    }
    super.catch(exception, hote);
  }
}

/**
 * Le statut que Nest rendra · celui d'une HttpException, celui d'une erreur
 * de la bibliothèque http-errors (le même critère que le filtre de base,
 * `isHttpError`), sinon 500.
 */
export function statutDe(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  const e = exception as { statusCode?: unknown; message?: unknown } | null;
  if (e && typeof e.statusCode === 'number' && e.message) return e.statusCode;
  return 500;
}

function codePrisma(exception: unknown): string | undefined {
  const code = (exception as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}
