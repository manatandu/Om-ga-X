import { ArgumentsHost, Catch, ConflictException, HttpException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

/**
 * UNE TRANSACTION EXPIRÉE EST UN REFUS NOMMÉ, JAMAIS UNE 500 MUETTE (relecture
 * de la ligne saisie-suites, M2). Prisma annule une transaction interactive qui
 * dépasse son délai et rend `P2028` · « Transaction already closed », « expired
 * transaction », ou la transaction introuvable parce que déjà fermée. Dans ces
 * trois formes, le moteur a fait le ROLLBACK avant de répondre, et un commit
 * demandé sur une transaction expirée n'est pas exécuté · rien de CETTE étape
 * n'est validé, d'où le même texte que l'interblocage. Le P2028 qui n'a pas pu
 * OUVRIR la transaction est déjà un 503 nommé (`SERVEUR_SATURE`,
 * `transaction-journalisee.ts`). Toute autre forme de P2028 n'est pas
 * traduite · sans preuve que rien n'a été validé, on ne le dit pas. Le statut
 * reste un 5xx (la cause est un geste trop long, pas un refus du métier), et
 * le défaut reste signalé à Sentry.
 */
export const CODE_ETAPE_EXPIREE = 'ETAPE_EXPIREE';
export const MESSAGE_ETAPE_EXPIREE =
  "Cette étape a dépassé son délai et a été annulée · elle n'a pas été enregistrée ; si votre demande en comptait plusieurs, une étape précédente a pu l'être · relisez, puis réessayez dans un instant.";

export function estTransactionExpiree(exception: unknown): boolean {
  for (let e: unknown = exception, n = 0; e && n < 5; e = (e as { cause?: unknown }).cause, n++) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2028' &&
      /Transaction already closed|expired transaction|old closed transaction/i.test(e.message)
    ) {
      return true;
    }
  }
  return false;
}

/** L'exception que le filtre rendra · l'interblocage, le conflit d'écriture ou la transaction expirée traduits, tout le reste tel quel. */
export function exceptionRendue(exception: unknown): unknown {
  if (exception instanceof HttpException) return exception;
  if (estConflitDeSerialisation(exception)) return new ConflictException({ message: MESSAGE_GESTE_CONCURRENT, code: CODE_GESTE_CONCURRENT });
  if (estTransactionExpiree(exception)) return new ServiceUnavailableException({ message: MESSAGE_ETAPE_EXPIREE, code: CODE_ETAPE_EXPIREE });
  return exception;
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
      if (rendue !== exception) journal.warn(`Interblocage, conflit d'écriture ou transaction expirée rendu en refus nommé · ${exception instanceof Error ? exception.message.split('\n')[0] : String(exception)}`);
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
