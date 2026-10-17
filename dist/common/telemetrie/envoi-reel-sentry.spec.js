"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const telemetrie_serveur_1 = require("./telemetrie-serveur");
const SECRETS = ['5000', 'dupont', 'Dupont', 'kabila', '41.243.1.7', 'loyer', '__session', 'jeton-csrf'];
describe('le vrai @sentry/node · ce qui sort dans l’enveloppe', () => {
    const envoyes = [];
    let sdk;
    beforeAll(() => {
        sdk = require('@sentry/node');
        const avecTransport = new Proxy(sdk, {
            get(cible, cle) {
                if (cle !== 'init')
                    return cible[cle];
                return (options) => cible.init({
                    ...options,
                    integrations: options.integrations.filter((i) => !/^OnUn/.test(i.name)),
                    transport: (opts) => cible.createTransport(opts, async (requete) => {
                        envoyes.push(typeof requete.body === 'string' ? requete.body : Buffer.from(requete.body).toString('utf8'));
                        return { statusCode: 200 };
                    }),
                });
            },
        });
        const regime = (0, telemetrie_serveur_1.demarrerTelemetrieServeur)({ SENTRY_DSN: 'https://cle@o1.ingest.de.sentry.io/2' }, () => avecTransport);
        expect(regime).toEqual({ actif: true });
    });
    afterAll(async () => {
        await sdk.close(2000);
        (0, telemetrie_serveur_1.demarrerTelemetrieServeur)({});
    });
    it('ni utilisateur, ni IP, ni données libres, ni console, ni texte de la cause', async () => {
        sdk.setUser({ email: 'dupont@exemple.cd', ip_address: '41.243.1.7', username: 'Dupont' });
        sdk.setExtra('corps', { libelle: 'loyer janvier', montant: 5000 });
        sdk.setTag('nom', 'kabila');
        sdk.addBreadcrumb({ category: 'console', message: 'compte loyer janvier du tiers dupont kabila' });
        sdk.addBreadcrumb({ category: 'http', data: { method: 'GET', url: '/ecritures/recherche?montant=5000', status_code: 500 } });
        const cause = new Error('compte loyer janvier du tiers dupont kabila 5000');
        const erreur = Object.assign(new Error('échec pour dupont'), { cause });
        (0, telemetrie_serveur_1.signalerPanneServeur)(erreur, { route: '/ecritures/recherche', statut: '500', methode: 'GET' });
        await sdk.flush(2000);
        const enveloppe = envoyes.join('\n');
        expect(enveloppe).toContain('"exception"');
        for (const s of SECRETS)
            expect([s, enveloppe.includes(s)]).toEqual([s, false]);
        const evenement = JSON.parse(enveloppe.split('\n').find((l) => l.includes('"exception"')));
        for (const champ of ['user', 'extra', 'request', 'server_name']) {
            expect([champ, champ in evenement]).toEqual([champ, false]);
        }
        expect(evenement.exception.values.map((v) => v.value)).toEqual(['[message]', '[message]']);
        expect(evenement.tags).toEqual({ cote: 'serveur', route: '/ecritures/recherche', statut: '500', methode: 'GET' });
        expect(evenement.breadcrumbs.map((m) => m.category)).toEqual(['http']);
        expect(evenement.breadcrumbs[0].data.url).toBe('/ecritures/recherche');
    });
});
//# sourceMappingURL=envoi-reel-sentry.spec.js.map