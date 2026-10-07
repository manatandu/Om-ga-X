import type { PostHog, PostHogConfig } from 'posthog-js';
import {
  environnementDe,
  optionsPosthog,
  optionsSentryInterface,
  persistancePosthog,
  proprietesPageVue,
  regimesInterface,
} from './telemetrie-interface';
import { identiteConstruction } from './version';

/**
 * TÉLÉMÉTRIE DE L'INTERFACE · Sentry (pannes) et PostHog (pages vues),
 * région UE, ÉTEINTS tant que la clé manque (décision de Manasse du
 * 2026-10-07). Les règles sont dans `telemetrie-interface.ts` et dans le
 * module partagé avec le serveur ; ce fichier lit les variables de
 * construction et charge les SDK À LA DEMANDE (`import()`) · sans clé, leur
 * code n'est jamais téléchargé.
 *
 * Les clés viennent des secrets `CLIENT_SENTRY_DSN` et `CLIENT_POSTHOG_CLE`,
 * passés à la construction par firebase-hosting-merge.yml (et le canal
 * d'aperçu) · jamais par paquet-sur-site.yml.
 */

/** Le type d'une intégration, tel que le SDK l'accepte. */
type Integration = Parameters<typeof import('@sentry/react').addIntegration>[0];

/** Vérifiée à la compilation · une option mal nommée ne serait que muette. */
type OptionsPosthog = ReturnType<typeof optionsPosthog>;
const optionsReconnues: Exclude<keyof OptionsPosthog, keyof PostHogConfig> extends never ? true : never = true;
void optionsReconnues;

const environnement = environnementDe(import.meta.env.VITE_ENVIRONNEMENT);
const regimes = regimesInterface({
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  posthogCle: import.meta.env.VITE_POSTHOG_CLE,
  adresseApi: import.meta.env.VITE_API_URL,
  environnement,
});

let signaler: ((erreur: unknown) => void) | null = null;
let posthog: PostHog | null = null;
let vueEnAttente: ReturnType<typeof proprietesPageVue> | null = null;

/** La route de l'interface (HashRouter) · nettoyée par le module partagé. */
const routeCourante = () => window.location.hash.replace(/^#/, '') || '/';

function chargementManque(service: string) {
  // Un chunk introuvable après un déploiement · l'application continue, et
  // la console le dit (aucune donnée du dossier dans ce message).
  console.warn(`[OmegaX] ${service} n’a pas pu être chargé · aucune donnée n’est envoyée.`);
}

export function demarrerTelemetrieInterface(): void {
  if (regimes.sentry.actif) {
    import('@sentry/react')
      .then((sdk) => {
        sdk.init(
          optionsSentryInterface<Integration>(
            String(import.meta.env.VITE_SENTRY_DSN).trim(),
            environnement,
            identiteConstruction().commit,
            sdk,
            routeCourante,
          ),
        );
        signaler = (erreur) => sdk.captureException(erreur);
      })
      .catch(() => chargementManque('Sentry'));
  }
  if (regimes.posthog.actif) {
    import('posthog-js/no-external')
      .then(({ default: instance }) => {
        const persistance = persistancePosthog(() => window.localStorage);
        instance.init(String(import.meta.env.VITE_POSTHOG_CLE).trim(), optionsPosthog(persistance) as Partial<PostHogConfig>);
        posthog = instance;
        if (vueEnAttente) instance.capture('$pageview', vueEnAttente);
        vueEnAttente = null;
      })
      .catch(() => chargementManque('PostHog'));
  }
}

/** Une erreur rattrapée par une barrière de fenêtre · elle ne remonte pas d'elle-même. */
export function signalerErreurInterface(erreur: unknown): void {
  signaler?.(erreur);
}

/** Une page vue · le chemin seul, normalisé, avec le rôle et le référentiel. */
export function pageVue(chemin: string, role: string | undefined, referentiel: string | undefined): void {
  if (!regimes.posthog.actif) return;
  const proprietes = proprietesPageVue(chemin, role, referentiel, environnement);
  if (posthog) posthog.capture('$pageview', proprietes);
  else vueEnAttente = proprietes;
}
