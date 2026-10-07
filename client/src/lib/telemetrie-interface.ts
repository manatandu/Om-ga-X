import {
  COLLECTE_SENTRY_COUPEE,
  HOTE_POSTHOG_UE,
  nettoyerEvenementPosthog,
  nettoyerEvenementSentry,
  nettoyerMietteSentry,
  normaliserChemin,
  regimePosthog,
  regimeSentry,
  RegimeTelemetrie,
} from '../../../src/common/telemetrie/nettoyage-telemetrie';

/**
 * TÉLÉMÉTRIE DE L'INTERFACE · la partie PURE, testée (les règles de ce qui
 * part vivent dans le module partagé avec le serveur,
 * `src/common/telemetrie/nettoyage-telemetrie.ts`). `telemetrie.ts` lit les
 * variables de construction et charge les SDK ; rien ici ne touche au
 * navigateur, sauf le stockage qu'on lui passe.
 *
 * SUR SITE, RIEN · le paquet sur site construit l'interface sans les secrets
 * (donc sans clé) et avec `VITE_API_URL=meme-origine`, que ce module lit
 * comme un second verrou ; la politique de sécurité servie par le poste
 * n'ouvre d'ailleurs aucune adresse extérieure.
 */

export interface VariablesTelemetrie {
  sentryDsn?: string;
  posthogCle?: string;
  adresseApi?: string;
  environnement?: string;
}

export interface RegimesInterface {
  sentry: RegimeTelemetrie;
  posthog: RegimeTelemetrie;
}

export function regimesInterface(v: VariablesTelemetrie): RegimesInterface {
  const surSite = v.adresseApi === 'meme-origine';
  return { sentry: regimeSentry(v.sentryDsn, surSite), posthog: regimePosthog(v.posthogCle, surSite) };
}

/** `apercu` pour le canal de prévisualisation d'une demande de tirage, sinon `production`. */
export function environnementDe(brut: string | undefined): 'production' | 'apercu' {
  return brut === 'apercu' ? 'apercu' : 'production';
}

/**
 * Le stockage local s'il s'écrit, sinon la mémoire · en fenêtre privée ou
 * site bloqué, l'accès jette (comme `exercice-choix.ts`), et la mesure se
 * fait alors sans rien garder. Jamais de cookie · le seul témoin du site est
 * celui de la session.
 */
export function persistancePosthog(stockage: () => Pick<Storage, 'setItem' | 'removeItem'>): 'localStorage' | 'memory' {
  try {
    const s = stockage();
    s.setItem('omegax.essai-stockage', '1');
    s.removeItem('omegax.essai-stockage');
    return 'localStorage';
  } catch {
    return 'memory';
  }
}

/**
 * Options de PostHog · la page vue MANUELLE seule. Tout ce que le SDK sait
 * capter de lui-même est coupé (clics et texte des cellules, sortie de page,
 * exceptions, performances, cartes de chaleur, enregistrement de session),
 * aucun script tiers n'est chargé, aucun indicateur distant n'est lu, et
 * `before_send` jette tout événement qui n'est pas une page vue.
 */
export function optionsPosthog(persistance: 'localStorage' | 'memory') {
  return {
    api_host: HOTE_POSTHOG_UE,
    ui_host: null,
    persistence: persistance,
    person_profiles: 'never' as const,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    capture_exceptions: false,
    capture_performance: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    rageclick: false,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    advanced_disable_flags: true,
    advanced_disable_feature_flags: true,
    advanced_disable_toolbar_metrics: true,
    disable_external_dependency_loading: true,
    save_referrer: false,
    save_campaign_params: false,
    disable_capture_url_hashes: true,
    mask_personal_data_properties: true,
    internal_or_test_user_hostname: null,
    before_send: <T>(evenement: T) => nettoyerEvenementPosthog(evenement),
  };
}

/** Les propriétés d'une page vue · le chemin normalisé, et seulement le rôle et le référentiel. */
export function proprietesPageVue(
  chemin: string,
  role: string | undefined,
  referentiel: string | undefined,
  environnement: 'production' | 'apercu',
) {
  return { chemin: normaliserChemin(chemin), role, referentiel, environnement, $geoip_disable: true };
}

/** Ce que l'on demande du SDK de Sentry pour l'interface (une doublure suffit aux tests). */
export interface SdkSentryInterface<I> {
  globalHandlersIntegration: () => I;
  linkedErrorsIntegration: () => I;
  dedupeIntegration: () => I;
  breadcrumbsIntegration: (o: { dom: boolean; fetch: boolean; xhr: boolean; history: boolean; sentry: boolean }) => I;
}

/**
 * Options de Sentry pour l'interface · aucune intégration par défaut (ni
 * contexte HTTP, qui recopie l'adresse entière, ni suivi de session, ni
 * rejeu), les erreurs non rattrapées, et des miettes sans clics ni saisies
 * (`dom: false`), nettoyées une à une.
 */
export function optionsSentryInterface<I>(
  dsn: string,
  environnement: 'production' | 'apercu',
  revision: string | null,
  sdk: SdkSentryInterface<I>,
  lireRoute: () => string,
) {
  return {
    dsn,
    environment: environnement,
    release: revision ?? undefined,
    defaultIntegrations: false as const,
    integrations: [
      sdk.globalHandlersIntegration(),
      sdk.linkedErrorsIntegration(),
      sdk.dedupeIntegration(),
      sdk.breadcrumbsIntegration({ dom: false, fetch: true, xhr: true, history: true, sentry: true }),
    ],
    dataCollection: COLLECTE_SENTRY_COUPEE,
    // Aucun `tracesSampleRate` · posé, même à 0, il monte l'intégration de
    // traçage (relecture du 2026-10-07). Erreurs seulement.
    sendClientReports: false,
    initialScope: { tags: { cote: 'interface' } },
    beforeSend: <T>(evenement: T, indice?: { originalException?: unknown }) =>
      estUneReponseDuServeur(indice?.originalException) ? null : nettoyerEvenementSentry(evenement, { route: lireRoute() }),
    beforeBreadcrumb: <T>(miette: T) => nettoyerMietteSentry(miette),
  };
}

/**
 * Une réponse d'erreur de l'API (`ApiError`, qui porte son statut) ne part
 * pas de l'interface · un 4xx est un refus, jamais une panne, et un 5xx est
 * déjà signalé par le serveur, qui le connaît mieux.
 */
export function estUneReponseDuServeur(erreur: unknown): boolean {
  return typeof (erreur as { status?: unknown } | null)?.status === 'number';
}
