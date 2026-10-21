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
import { lireConsentement, mesureAutorisee } from './consentement-mesure';
import { DATE_DE_MISE_A_JOUR } from './date-politique-confidentialite';

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

/** Une clé au moins est posée sur cette construction, hors installation sur site · le bandeau n'a de sens qu'alors. */
export function mesureDisponible(): boolean {
  return regimes.sentry.actif || regimes.posthog.actif;
}

let demarree = false;
// Un refus donné dans CETTE page prime sur le stockage · s'il n'a pas pu s'y
// écrire, l'ancien accord n'y relance rien (relecture « échecs silencieux », M1).
let refusEnMemoire = false;
let sdkSentry: typeof import('@sentry/react') | null = null;

/** Les SDK tournent-ils dans cette page ? */
export function telemetrieDemarree(): boolean {
  return demarree;
}

/**
 * D'où vient le démarrage · `demarrage` relit l'accord du stockage (et cède à
 * un refus donné dans la page) ; `accord` suit un « Accepter » enregistré ;
 * `accordNonEnregistre` suit un « Accepter » que le stockage a refusé, qui
 * vaut pour cette page et ne laissera rien au rechargement.
 */
export type SourceDemarrage = 'demarrage' | 'accord' | 'accordNonEnregistre';

/**
 * Démarre Sentry et PostHog dans le navigateur, SUR ACCORD seulement
 * (`lib/consentement-mesure.ts`, Code du numérique, art. 192). Appelée au
 * démarrage, puis par le bandeau quand la personne accepte.
 */
export function demarrerTelemetrieInterface(source: SourceDemarrage = 'demarrage'): void {
  if (source === 'demarrage') {
    if (refusEnMemoire || !mesureAutorisee(lireConsentement(() => window.localStorage), DATE_DE_MISE_A_JOUR)) return;
  } else {
    refusEnMemoire = false;
  }
  if (demarree) return;
  demarree = true;
  if (regimes.sentry.actif) {
    import('@sentry/react')
      .then((sdk) => {
        // Un refus arrivé pendant le chargement · rien ne démarre.
        if (!demarree) return;
        sdkSentry = sdk;
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
    if (posthog) {
      // Déjà chargé, arrêté par un refus, puis accepté de nouveau.
      posthog.opt_in_capturing();
    } else {
      import('posthog-js/no-external')
        .then(({ default: instance }) => {
          if (!demarree) return;
          const persistance = persistancePosthog(() => window.localStorage);
          instance.init(String(import.meta.env.VITE_POSTHOG_CLE).trim(), optionsPosthog(persistance) as Partial<PostHogConfig>);
          posthog = instance;
          if (vueEnAttente) instance.capture('$pageview', vueEnAttente);
          vueEnAttente = null;
        })
        .catch(() => chargementManque('PostHog'));
    }
  }
}

/**
 * ARRÊTE la mesure SUR PLACE, sans recharger la page · un rechargement ferait
 * perdre une saisie en cours, dans cet onglet ou dans un autre (relecture,
 * M2). PostHog cesse de capturer et oublie son identifiant, Sentry ferme son
 * client ; un démarrage ultérieur de la page cède au refus.
 */
export function arreterTelemetrieInterface(): void {
  refusEnMemoire = true;
  demarree = false;
  signaler = null;
  vueEnAttente = null;
  if (posthog) {
    posthog.opt_out_capturing();
    posthog.reset();
  }
  if (sdkSentry) void sdkSentry.close();
}

/** Une erreur rattrapée par une barrière de fenêtre · elle ne remonte pas d'elle-même. */
export function signalerErreurInterface(erreur: unknown): void {
  signaler?.(erreur);
}

/** Une page vue · le chemin seul, normalisé, avec le rôle et le référentiel. */
export function pageVue(chemin: string, role: string | undefined, referentiel: string | undefined): void {
  // Sans accord, aucune vue n'est gardée en attente · elle partirait au premier
  // accord avec la date d'un écran vu avant lui.
  if (!regimes.posthog.actif || !demarree) return;
  const proprietes = proprietesPageVue(chemin, role, referentiel, environnement);
  if (posthog) posthog.capture('$pageview', proprietes);
  else vueEnAttente = proprietes;
}
