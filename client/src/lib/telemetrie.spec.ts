import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  environnementDe,
  optionsPosthog,
  optionsSentryInterface,
  persistancePosthog,
  proprietesPageVue,
  regimesInterface,
} from './telemetrie-interface';

/**
 * TÉLÉMÉTRIE DE L'INTERFACE · éteinte sans clé, toujours éteinte sur site,
 * rien du dossier dans ce qui part (décision de Manasse du 2026-10-07).
 */

const DSN = 'https://cle@o1.ingest.de.sentry.io/2';

/** La forme d'`ApiError` (lib/api.ts), sans en importer le module, qui lit import.meta. */
class ApiErreurDoublure extends Error {
  constructor(public status: number) {
    super('refus');
  }
}
const racine = join(__dirname, '..', '..');
const lire = (f: string) => readFileSync(join(racine, f), 'utf8');

describe('régimes', () => {
  it('sans clé, rien', () => {
    expect(regimesInterface({ adresseApi: '/api' })).toEqual({
      sentry: { actif: false, motif: 'aucune-cle' },
      posthog: { actif: false, motif: 'aucune-cle' },
    });
  });
  it('le paquet sur site (même origine) n’ouvre rien, même avec des clés', () => {
    expect(regimesInterface({ adresseApi: 'meme-origine', sentryDsn: DSN, posthogCle: 'phc_x' })).toEqual({
      sentry: { actif: false, motif: 'sur-site' },
      posthog: { actif: false, motif: 'sur-site' },
    });
  });
  it('en ligne avec les clés, les deux sont actifs', () => {
    expect(regimesInterface({ adresseApi: '/api', sentryDsn: DSN, posthogCle: 'phc_x' })).toEqual({
      sentry: { actif: true },
      posthog: { actif: true },
    });
  });
  it('l’environnement ne vaut qu’aperçu ou production', () => {
    expect(environnementDe('apercu')).toBe('apercu');
    expect(environnementDe(undefined)).toBe('production');
    expect(environnementDe('Dupont')).toBe('production');
  });
});

describe('PostHog · la page vue manuelle seule', () => {
  const o = optionsPosthog('localStorage');

  it('hôte UE, aucune capture automatique, aucun enregistrement, aucun script tiers', () => {
    expect(o).toMatchObject({
      api_host: 'https://eu.i.posthog.com',
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
      advanced_disable_flags: true,
      disable_external_dependency_loading: true,
      save_referrer: false,
      person_profiles: 'never',
    });
  });

  it('before_send jette tout ce qui n’est pas une page vue', () => {
    expect(o.before_send({ event: '$autocapture', properties: { $el_text: '1 250 000' } })).toBeNull();
    const vue = o.before_send({
      event: '$pageview',
      properties: { ...proprietesPageVue('/comptes/3f2b8c1e-9a4d-4e2b-8f1a-0c9d8e7f6a5b?m=5000', 'COMPTABLE', 'SYCEBNL', 'production'), title: 'Dupont' },
    }) as { properties: Record<string, unknown> };
    expect(vue.properties).toMatchObject({ chemin: '/comptes/:id', role: 'COMPTABLE', referentiel: 'SYCEBNL', $geoip_disable: true });
    expect(JSON.stringify(vue)).not.toMatch(/Dupont|5000|3f2b8c1e/);
  });

  it('le stockage local s’il s’écrit, la mémoire en fenêtre privée, jamais un cookie', () => {
    const memoire: Record<string, string> = {};
    const stockage = {
      setItem: (k: string, v: string) => void (memoire[k] = v),
      removeItem: (k: string) => void delete memoire[k],
    };
    expect(persistancePosthog(() => stockage)).toBe('localStorage');
    expect(memoire).toEqual({});
    expect(
      persistancePosthog(() => {
        throw new Error('SecurityError');
      }),
    ).toBe('memory');
    expect(
      persistancePosthog(() => ({
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => undefined,
      })),
    ).toBe('memory');
  });
});

describe('Sentry · interface', () => {
  const fabrique = (nom: string) => (opts?: unknown) => ({ name: nom, opts });
  const o = optionsSentryInterface(DSN, 'production', 'abc1234', {
    globalHandlersIntegration: fabrique('GlobalHandlers'),
    linkedErrorsIntegration: fabrique('LinkedErrors'),
    dedupeIntegration: fabrique('Dedupe'),
    breadcrumbsIntegration: fabrique('Breadcrumbs'),
  }, () => '/comptes/3f2b8c1e-9a4d-4e2b-8f1a-0c9d8e7f6a5b');

  it('aucune intégration par défaut, ni rejeu ni contexte HTTP, miettes sans clics', () => {
    expect(o.defaultIntegrations).toBe(false);
    expect(o.integrations.map((i) => i.name)).toEqual(['GlobalHandlers', 'LinkedErrors', 'Dedupe', 'Breadcrumbs']);
    expect(o.integrations[3].opts).toEqual({ dom: false, fetch: true, xhr: true, history: true, sentry: true });
    expect('tracesSampleRate' in o).toBe(false);
    expect(o.dataCollection).toMatchObject({ userInfo: false, cookies: false, urlQueryParams: false, httpBodies: [] });
  });

  it('l’événement part nettoyé, avec la route normalisée', () => {
    const e = o.beforeSend({
      exception: { values: [{ type: 'TypeError', value: 'montant 5000 pour Dupont' }] },
      request: { url: 'https://oomega.web.app/#/ecritures/recherche?montant=5000' },
    }) as Record<string, any>;
    expect(e.tags).toEqual({ route: '/comptes/:id' });
    expect(JSON.stringify(e)).not.toMatch(/Dupont|5000|3f2b8c1e/);
    expect(o.beforeBreadcrumb({ category: 'ui.input', message: '5000' })).toBeNull();
  });

  it('une réponse d’erreur de l’API ne part pas de l’interface · refus, ou panne déjà signalée par le serveur', () => {
    const evenement = { exception: { values: [{ type: 'Error', value: 'Montant refusé' }] } };
    expect(o.beforeSend(evenement, { originalException: new ApiErreurDoublure(400) })).toBeNull();
    expect(o.beforeSend(evenement, { originalException: new ApiErreurDoublure(500) })).toBeNull();
    expect(o.beforeSend(evenement, { originalException: new TypeError('x') })).not.toBeNull();
  });
});

describe('câblage de l’interface', () => {
  it('les SDK ne se chargent qu’à la demande, PostHog sans script tiers', () => {
    const t = lire('src/lib/telemetrie.ts');
    // Seuls les TYPES s'importent en tête · le code vient par import().
    expect(t).not.toMatch(/^import (?!type )[^;]*from '(@sentry\/react|posthog-js[^']*)'/m);
    expect(t).toContain("import('@sentry/react')");
    expect(t).toContain("import('posthog-js/no-external')");
  });
  it('démarrée dans main.tsx, pages vues sous le routeur, barrière d’erreur reliée', () => {
    expect(lire('src/main.tsx')).toContain('demarrerTelemetrieInterface();');
    const app = lire('src/App.tsx');
    expect(app).toContain('<SuiviDesPages />');
    expect(app.indexOf('<SuiviDesPages />')).toBeGreaterThan(app.indexOf('<HashRouter>'));
    expect(lire('src/components/chrome/LimiteErreur.tsx')).toContain('signalerErreurInterface(erreur);');
  });
});
