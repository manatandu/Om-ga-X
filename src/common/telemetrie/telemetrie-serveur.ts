import { Logger } from '@nestjs/common';
import { estSurSite } from '../mode-installation';
import {
  COLLECTE_SENTRY_COUPEE,
  nettoyerEvenementSentry,
  nettoyerMietteSentry,
  regimeSentry,
  RegimeTelemetrie,
} from './nettoyage-telemetrie';

/**
 * SENTRY CÔTÉ SERVEUR · les PANNES, et rien d'autre (décision de Manasse du
 * 2026-10-07, voir nettoyage-telemetrie.ts).
 *
 * ÉTEINT TANT QUE LE SECRET MANQUE, ET TOUJOURS SUR SITE · `SENTRY_DSN` vient
 * du fichier de variables de deploy-cloud-run.yml (secret `API_SENTRY_DSN`).
 * Absent, rien n'est chargé, rien ne part, aucun avertissement · la ligne du
 * démarrage dit seulement le régime. Sur un poste client
 * (`MODE_INSTALLATION=SUR_SITE`), le SDK n'est même pas chargé, quelle que
 * soit la clé posée.
 *
 * LE SDK EST CHARGÉ À LA DEMANDE (`require`), pas importé · un import en tête
 * de fichier le chargerait sur chaque poste sur site, et sur Cloud Run sans
 * clé, pour rien.
 *
 * AUCUNE INTÉGRATION PAR DÉFAUT · celles du SDK lisent la requête (en-têtes,
 * cookies, corps, chaîne de requête), instrumentent HTTP et la console. On
 * ne garde que la capture des exceptions non gérées (le processus s'arrête
 * comme avant, `strict` reproduisant pour les promesses rejetées le défaut
 * de Node 22), les causes chaînées et le dédoublonnage. Les erreurs des
 * requêtes arrivent par `FiltrePannes`, qui ne signale que les 5xx.
 */

type SdkSentry = typeof import('@sentry/node');
type Signalement = (erreur: unknown, etiquettes: Record<string, string>) => void;

let signaler: Signalement | null = null;

export function optionsSentryServeur(dsn: string, revision: string | undefined, sdk: SdkSentry) {
  return {
    dsn,
    environment: 'production',
    release: revision || undefined,
    defaultIntegrations: false as const,
    integrations: [
      sdk.onUncaughtExceptionIntegration(),
      sdk.onUnhandledRejectionIntegration({ mode: 'strict' }),
      sdk.linkedErrorsIntegration(),
      sdk.dedupeIntegration(),
    ],
    dataCollection: COLLECTE_SENTRY_COUPEE,
    // Erreurs seulement · ni `tracesSampleRate` (posé, même à 0, il monte
    // l'intégration de traçage, relecture du 2026-10-07) ni
    // `beforeSendTransaction` (la v11 l'ignore et le dit au démarrage).
    sendClientReports: false,
    initialScope: { tags: { cote: 'serveur' } },
    beforeSend: <T>(evenement: T) => nettoyerEvenementSentry(evenement),
    beforeBreadcrumb: <T>(miette: T) => nettoyerMietteSentry(miette),
  };
}

/**
 * Appelée une fois, au tout début du démarrage (main.ts). Rend le régime,
 * que l'appelant écrit au journal.
 */
export function demarrerTelemetrieServeur(
  env: NodeJS.ProcessEnv = process.env,
  charger: () => SdkSentry = () => require('@sentry/node') as SdkSentry,
): RegimeTelemetrie {
  const regime = regimeSentry(env.SENTRY_DSN, estSurSite(env));
  signaler = null;
  if (!regime.actif) return regime;
  // UNE TÉLÉMÉTRIE QUI ÉCHOUE N'EMPÊCHE JAMAIS LE SERVICE DE DÉMARRER · le
  // régime le dit (« échec du chargement ») et le serveur continue sans elle.
  try {
    const sdk = charger();
    sdk.init(optionsSentryServeur(String(env.SENTRY_DSN).trim(), env.K_REVISION, sdk));
    signaler = (erreur, etiquettes) => {
      sdk.captureException(erreur, { tags: etiquettes });
    };
    return regime;
  } catch {
    return { actif: false, motif: 'echec' };
  }
}

/**
 * Une panne de requête · ne fait JAMAIS tomber la réponse. Un échec du
 * signalement est consigné (sans l'erreur, qui pourrait porter des données),
 * jamais avalé en silence.
 */
export function signalerPanneServeur(erreur: unknown, etiquettes: Record<string, string | undefined>): void {
  if (!signaler) return;
  const propres: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(etiquettes)) if (valeur !== undefined) propres[cle] = valeur;
  try {
    signaler(erreur, propres);
  } catch {
    new Logger('Telemetrie').warn('Signalement de panne non transmis à Sentry');
  }
}
