import { ArgumentsHost, Catch, ConflictException, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { estConflitDeSerialisation } from '../prisma-retry.util';
import { signalerPanneServeur } from './telemetrie-serveur';

/**
 * UN INTERBLOCAGE QUI S'ÉCHAPPE EST UN 409 NOMMÉ, JAMAIS UNE 500 MUETTE (ligne
 * saisie-suites, point 1, 2026-10-30). PostgreSQL abat l'une de deux
 * transactions qui s'attendent en cycle (40P01), ou refuse une écriture
 * concurrente (40001, P2034) · la transaction abattue est annulée ENTIÈRE,
 * rien de CETTE étape n'est écrit. La racine est corrigée (un seul ordre de
 * verrous, `ordre-des-verrous.spec.ts`), la saisie et ses variantes rejouent
 * d'elles-mêmes (`transactionDeSaisie`) ; ce qui s'échapperait encore d'un
 * autre geste (un verrou de ligne posé par une mise à jour ordinaire avant le
 * premier acte audité) arrive ici · le refus dit ce qu'il est, sous un code
 * PROPRE que l'interface ne rejoue PAS d'office (`reprise-conflit.ts` ne
 * rejoue que `CONFLIT_SERIALISATION`, `DOSSIER_OCCUPE`, `SERVEUR_SATURE`) ·
 * une demande à plusieurs étapes a pu en commettre une avant, et la rejouer
 * en entier la doublerait. Il reste signalé à Sentry · un interblocage qui
 * s'échappe est un ordre de verrous à corriger.
 */
export const CODE_GESTE_CONCURRENT = 'GESTE_CONCURRENT';
export const MESSAGE_GESTE_CONCURRENT =
  "Un autre geste du dossier était en cours sur les mêmes données · cette étape n'a pas été enregistrée ; si votre demande en comptait plusieurs, une étape précédente a pu l'être · relisez, puis réessayez.";

/** L'exception que le filtre rendra · l'interblocage ou le conflit d'écriture traduit, tout le reste tel quel. */
export function exceptionRendue(exception: unknown): unknown {
  if (exception instanceof HttpException) return exception;
  if (!estConflitDeSerialisation(exception)) return exception;
  return new ConflictException({ message: MESSAGE_GESTE_CONCURRENT, code: CODE_GESTE_CONCURRENT });
}

const journal = new Logger('FiltrePannes');

/**
 * UNE PANNE SE SIGNALE, UN REFUS JAMAIS · un 4xx est la réponse voulue
 * d'OmegaX (un refus nommé, une session perdue, un débit limité), un 5xx est
 * un défaut. Seul le second part à Sentry.
 *
 * Le filtre ne change rien à la réponse, sauf l'interblocage ou le conflit
 * d'écriture qui s'échappe (`exceptionRendue`, ci-dessus) · il signale, puis
 * rend la main au filtre de base de Nest, celui qui répondait jusqu'ici (même
 * corps, même statut, même ligne au journal). Sentry inactif, le signalement
 * est sans effet.
 *
 * L'étiquette `route` est le MOTIF de la route déclarée (`/comptes/:id`),
 * jamais l'adresse appelée · celle-ci porte des identifiants, et la recherche
 * d'écritures des montants dans sa chaîne de requête.
 */
@Catch()
export class FiltrePannes extends BaseExceptionFilter {
  catch(exception: unknown, hote: ArgumentsHost) {
    const rendue = exceptionRendue(exception);
    if (hote.getType() === 'http') {
      const statut = statutDe(exception);
      if (rendue !== exception) journal.warn(`Interblocage ou conflit d'écriture rendu en 409 · ${exception instanceof Error ? exception.message.split('\n')[0] : String(exception)}`);
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
    super.catch(rendue, hote);
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
