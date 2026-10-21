"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionsSentryServeur = optionsSentryServeur;
exports.demarrerTelemetrieServeur = demarrerTelemetrieServeur;
exports.signalerPanneServeur = signalerPanneServeur;
const common_1 = require("@nestjs/common");
const mode_installation_1 = require("../mode-installation");
const nettoyage_telemetrie_1 = require("./nettoyage-telemetrie");
let signaler = null;
function optionsSentryServeur(dsn, revision, sdk) {
    return {
        dsn,
        environment: 'production',
        release: revision || undefined,
        defaultIntegrations: false,
        integrations: [
            sdk.onUncaughtExceptionIntegration(),
            sdk.onUnhandledRejectionIntegration({ mode: 'strict' }),
            sdk.linkedErrorsIntegration(),
            sdk.dedupeIntegration(),
        ],
        dataCollection: nettoyage_telemetrie_1.COLLECTE_SENTRY_COUPEE,
        sendClientReports: false,
        initialScope: { tags: { cote: 'serveur' } },
        beforeSend: (evenement) => (0, nettoyage_telemetrie_1.nettoyerEvenementSentry)(evenement),
        beforeBreadcrumb: (miette) => (0, nettoyage_telemetrie_1.nettoyerMietteSentry)(miette),
    };
}
function demarrerTelemetrieServeur(env = process.env, charger = () => require('@sentry/node')) {
    const regime = (0, nettoyage_telemetrie_1.regimeSentry)(env.SENTRY_DSN, (0, mode_installation_1.estSurSite)(env));
    signaler = null;
    if (!regime.actif)
        return regime;
    try {
        const sdk = charger();
        sdk.init(optionsSentryServeur(String(env.SENTRY_DSN).trim(), env.K_REVISION, sdk));
        signaler = (erreur, etiquettes) => {
            sdk.captureException(erreur, { tags: etiquettes });
        };
        return regime;
    }
    catch {
        return { actif: false, motif: 'echec' };
    }
}
function signalerPanneServeur(erreur, etiquettes) {
    if (!signaler)
        return;
    const propres = {};
    for (const [cle, valeur] of Object.entries(etiquettes))
        if (valeur !== undefined)
            propres[cle] = valeur;
    try {
        signaler(erreur, propres);
    }
    catch {
        new common_1.Logger('Telemetrie').warn('Signalement de panne non transmis à Sentry');
    }
}
//# sourceMappingURL=telemetrie-serveur.js.map