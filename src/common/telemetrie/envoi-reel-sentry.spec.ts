import { demarrerTelemetrieServeur, signalerPanneServeur } from './telemetrie-serveur';

/**
 * LE VRAI SDK, L'ENVELOPPE RELUE (relecture du 2026-10-07). Les autres specs
 * prouvent la règle sur une doublure ; celle-ci fait tourner `@sentry/node`
 * tel qu'il est installé, avec un transport qui garde ce qu'il aurait envoyé,
 * et relit l'enveloppe octet par octet. La portée est chargée de ce que le
 * SDK sait d'ordinaire joindre de lui-même · utilisateur, adresse IP,
 * données libres, miette de console, cause chaînée.
 *
 * Les deux intégrations de processus (exceptions et promesses non gérées)
 * sont retirées ICI seulement · le processus de jest est partagé entre les
 * fichiers de spec, et elles l'arrêteraient sur une promesse d'un autre
 * test. Elles n'ajoutent rien à ce qui part.
 */

type Sdk = typeof import('@sentry/node');
const SECRETS = ['5000', 'dupont', 'Dupont', 'kabila', '41.243.1.7', 'loyer', '__session', 'jeton-csrf'];

describe('le vrai @sentry/node · ce qui sort dans l’enveloppe', () => {
  const envoyes: string[] = [];
  let sdk: Sdk;

  beforeAll(() => {
    sdk = require('@sentry/node') as Sdk;
    const avecTransport = new Proxy(sdk, {
      get(cible, cle) {
        if (cle !== 'init') return (cible as any)[cle];
        return (options: any) =>
          cible.init({
            ...options,
            integrations: options.integrations.filter((i: { name: string }) => !/^OnUn/.test(i.name)),
            transport: (opts: any) =>
              cible.createTransport(opts, async (requete: { body: string | Uint8Array }) => {
                envoyes.push(typeof requete.body === 'string' ? requete.body : Buffer.from(requete.body).toString('utf8'));
                return { statusCode: 200 };
              }),
          });
      },
    });
    const regime = demarrerTelemetrieServeur({ SENTRY_DSN: 'https://cle@o1.ingest.de.sentry.io/2' }, () => avecTransport);
    expect(regime).toEqual({ actif: true });
  });

  afterAll(async () => {
    await sdk.close(2000);
    demarrerTelemetrieServeur({});
  });

  it('ni utilisateur, ni IP, ni données libres, ni console, ni texte de la cause', async () => {
    sdk.setUser({ email: 'dupont@exemple.cd', ip_address: '41.243.1.7', username: 'Dupont' });
    sdk.setExtra('corps', { libelle: 'loyer janvier', montant: 5000 });
    sdk.setTag('nom', 'kabila');
    sdk.addBreadcrumb({ category: 'console', message: 'compte loyer janvier du tiers dupont kabila' });
    sdk.addBreadcrumb({ category: 'http', data: { method: 'GET', url: '/ecritures/recherche?montant=5000', status_code: 500 } });
    const cause = new Error('compte loyer janvier du tiers dupont kabila 5000');
    const erreur = Object.assign(new Error('échec pour dupont'), { cause });
    signalerPanneServeur(erreur, { route: '/ecritures/recherche', statut: '500', methode: 'GET' });
    await sdk.flush(2000);

    const enveloppe = envoyes.join('\n');
    expect(enveloppe).toContain('"exception"');
    for (const s of SECRETS) expect([s, enveloppe.includes(s)]).toEqual([s, false]);
    const evenement = JSON.parse(enveloppe.split('\n').find((l) => l.includes('"exception"'))!);
    for (const champ of ['user', 'extra', 'request', 'server_name']) {
      expect([champ, champ in evenement]).toEqual([champ, false]);
    }
    // La cause chaînée part, réduite à son type et à sa pile.
    expect(evenement.exception.values.map((v: { value: string }) => v.value)).toEqual(['[message]', '[message]']);
    expect(evenement.tags).toEqual({ cote: 'serveur', route: '/ecritures/recherche', statut: '500', methode: 'GET' });
    expect(evenement.breadcrumbs.map((m: { category: string }) => m.category)).toEqual(['http']);
    expect(evenement.breadcrumbs[0].data.url).toBe('/ecritures/recherche');
  });
});
