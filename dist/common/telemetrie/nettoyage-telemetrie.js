"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTE_SENTRY_COUPEE = exports.HOTE_POSTHOG_UE = exports.HOTES_TELEMETRIE_UE = void 0;
exports.regimeSentry = regimeSentry;
exports.regimePosthog = regimePosthog;
exports.messageRegime = messageRegime;
exports.normaliserChemin = normaliserChemin;
exports.nettoyerUrl = nettoyerUrl;
exports.nettoyerMessage = nettoyerMessage;
exports.nettoyerEvenementSentry = nettoyerEvenementSentry;
exports.typeAuMessageLisible = typeAuMessageLisible;
exports.nettoyerMietteSentry = nettoyerMietteSentry;
exports.nettoyerEvenementPosthog = nettoyerEvenementPosthog;
exports.HOTES_TELEMETRIE_UE = ['https://*.ingest.de.sentry.io', 'https://eu.i.posthog.com'];
exports.HOTE_POSTHOG_UE = 'https://eu.i.posthog.com';
const SUFFIXE_SENTRY_UE = '.ingest.de.sentry.io';
function regimeSentry(dsn, surSite) {
    if (surSite)
        return { actif: false, motif: 'sur-site' };
    const cle = (dsn ?? '').trim();
    if (!cle)
        return { actif: false, motif: 'aucune-cle' };
    return hoteSentryUe(cle) ? { actif: true } : { actif: false, motif: 'hors-ue' };
}
function regimePosthog(cle, surSite) {
    if (surSite)
        return { actif: false, motif: 'sur-site' };
    return (cle ?? '').trim() ? { actif: true } : { actif: false, motif: 'aucune-cle' };
}
function hoteSentryUe(dsn) {
    const m = /^https:\/\/[^@/\s]+@([^/:\s]+)(?::\d+)?\/\d+\/?$/.exec(dsn);
    return !!m && m[1].toLowerCase().endsWith(SUFFIXE_SENTRY_UE);
}
function messageRegime(service, regime) {
    if (regime.actif)
        return `${service} · actif`;
    const motifs = {
        'aucune-cle': 'aucune clé',
        'sur-site': 'installation sur site',
        'hors-ue': 'clé illisible ou hors de la région UE',
        echec: 'échec du chargement',
    };
    return `${service} · inactif (${motifs[regime.motif]})`;
}
const SEGMENT_DE_ROUTE = /^[a-z]+(?:-[a-z]+)*$/;
function normaliserChemin(chemin) {
    const sansRequete = String(chemin ?? '').split(/[?#]/)[0];
    const segments = sansRequete.split('/').filter((s) => s.length > 0);
    if (segments.length === 0)
        return '/';
    return '/' + segments.map((s) => (SEGMENT_DE_ROUTE.test(s) ? s : ':id')).join('/');
}
function nettoyerUrl(url) {
    const brute = String(url ?? '').trim();
    const absolue = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)(.*)$/i.exec(brute);
    if (!absolue) {
        const diese = brute.indexOf('#');
        const fragment = diese >= 0 ? brute.slice(diese + 1) : '';
        const chemin = normaliserChemin(diese >= 0 ? brute.slice(0, diese) : brute);
        return fragment.startsWith('/') ? `${chemin}#${normaliserChemin(fragment)}` : chemin;
    }
    const schema = absolue[1].toLowerCase();
    if (schema !== 'http' && schema !== 'https')
        return '[adresse]';
    const hote = absolue[2].split('@').pop() ?? '';
    const reste = absolue[3];
    const diese = reste.indexOf('#');
    const fragment = diese >= 0 ? reste.slice(diese + 1) : '';
    const chemin = normaliserChemin(diese >= 0 ? reste.slice(0, diese) : reste);
    const route = fragment.startsWith('/') ? `#${normaliserChemin(fragment)}` : '';
    return `${schema}://${hote}${chemin}${route}`;
}
function nettoyerFichier(fichier) {
    if (typeof fichier !== 'string')
        return undefined;
    if (/^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i.test(fichier))
        return '[adresse]';
    return fichier.split(/[?#]/)[0].slice(0, 300);
}
const IDENTIFIANT_DE_CODE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\(\))?$/;
const LONGUEUR_MESSAGE = 200;
function nettoyerMessage(texte) {
    if (typeof texte !== 'string')
        return '';
    const ligne = texte.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? '';
    const morceaux = ligne.split(/(`[^`]*`)/);
    const nettoye = morceaux
        .map((m, i) => {
        if (m.startsWith('`') && m.endsWith('`') && m.length >= 2) {
            return IDENTIFIANT_DE_CODE.test(m.slice(1, -1)) ? m : '[texte]';
        }
        return nettoyerProse(m, i === 0);
    })
        .join('');
    const resserre = nettoye.replace(/\s+/g, ' ').trim();
    return resserre.length > LONGUEUR_MESSAGE ? `${resserre.slice(0, LONGUEUR_MESSAGE)}…` : resserre;
}
function nettoyerProse(texte, enTete) {
    let t = texte
        .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[adresse]')
        .replace(/[^\s@'"`<>()[\]]+@[^\s@'"`<>()[\]]+/g, '[courriel]')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
        .replace(/'[^']*'|"[^"]*"|«[^»]*»|“[^”]*”|‘[^’]*’/g, '[texte]')
        .replace(/[-+]?\d(?:[\d\s  .,']*\d)?/g, '[nombre]');
    t = t.replace(/(^|[^\p{L}\p{M}[])(\p{Lu}[\p{L}\p{M}'’-]*)/gu, (tout, avant, _mot, position) => enTete && position === 0 && avant === '' ? tout : `${avant}[mot]`);
    return t;
}
const estObjet = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const chaine = (v, max = 200) => typeof v === 'string' ? v.slice(0, max) : undefined;
const nombre = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const ETIQUETTES = {
    route: (v) => (typeof v === 'string' ? normaliserChemin(v) : undefined),
    methode: (v) => (typeof v === 'string' && /^[A-Z]{3,7}$/.test(v) ? v : undefined),
    statut: (v) => (typeof v === 'string' && /^\d{3}$/.test(v) ? v : undefined),
    code_prisma: (v) => (typeof v === 'string' && /^P\d{4}$/.test(v) ? v : undefined),
    cote: (v) => (v === 'serveur' || v === 'interface' ? v : undefined),
};
function nettoyerEvenementSentry(evenement, contexte = {}) {
    if (!estObjet(evenement))
        return null;
    if (evenement.type !== undefined)
        return null;
    const exception = nettoyerException(evenement.exception);
    const message = nettoyerMessageSentry(evenement.message);
    if (!exception && !message)
        return null;
    const propre = {};
    for (const cle of ['event_id', 'level', 'platform', 'environment', 'release', 'dist', 'logger']) {
        const v = chaine(evenement[cle]);
        if (v !== undefined)
            propre[cle] = v;
    }
    for (const cle of ['timestamp', 'start_timestamp']) {
        const v = nombre(evenement[cle]);
        if (v !== undefined)
            propre[cle] = v;
    }
    if (exception)
        propre.exception = exception;
    if (message)
        propre.message = message;
    const etiquettes = {};
    const recues = estObjet(evenement.tags) ? evenement.tags : {};
    for (const [cle, lire] of Object.entries(ETIQUETTES)) {
        const v = lire(recues[cle]);
        if (v !== undefined)
            etiquettes[cle] = v;
    }
    if (contexte.route !== undefined)
        etiquettes.route = normaliserChemin(contexte.route);
    if (Object.keys(etiquettes).length > 0)
        propre.tags = etiquettes;
    if (etiquettes.route)
        propre.transaction = etiquettes.route;
    const contextes = nettoyerContextes(evenement.contexts);
    if (contextes)
        propre.contexts = contextes;
    const miettes = Array.isArray(evenement.breadcrumbs)
        ? evenement.breadcrumbs.map((m) => nettoyerMietteSentry(m)).filter((m) => m !== null)
        : [];
    if (miettes.length > 0)
        propre.breadcrumbs = miettes.slice(-50);
    if (Array.isArray(evenement.fingerprint)) {
        propre.fingerprint = evenement.fingerprint.filter((f) => typeof f === 'string').map((f) => nettoyerMessage(f));
    }
    if (estObjet(evenement.sdk)) {
        const sdk = evenement.sdk;
        propre.sdk = {
            name: chaine(sdk.name),
            version: chaine(sdk.version),
            integrations: Array.isArray(sdk.integrations) ? sdk.integrations.filter((i) => typeof i === 'string') : undefined,
        };
    }
    const meta = nettoyerDebugMeta(evenement.debug_meta);
    if (meta)
        propre.debug_meta = meta;
    return propre;
}
function nettoyerException(brute) {
    if (!estObjet(brute) || !Array.isArray(brute.values))
        return undefined;
    const valeurs = brute.values.filter(estObjet).map((v) => {
        const sortie = {
            type: typeof v.type === 'string' && IDENTIFIANT_DE_CODE.test(v.type) ? v.type : 'Error',
            value: typeAuMessageLisible(v.type) ? nettoyerMessage(v.value) : '[message]',
        };
        if (estObjet(v.mechanism)) {
            sortie.mechanism = {
                type: chaine(v.mechanism.type, 60),
                handled: typeof v.mechanism.handled === 'boolean' ? v.mechanism.handled : undefined,
            };
        }
        if (estObjet(v.stacktrace) && Array.isArray(v.stacktrace.frames)) {
            sortie.stacktrace = { frames: v.stacktrace.frames.filter(estObjet).map(nettoyerCadre) };
        }
        return sortie;
    });
    return valeurs.length > 0 ? { values: valeurs } : undefined;
}
function nettoyerCadre(cadre) {
    const fonction = typeof cadre.function === 'string' && cadre.function.length <= 200 ? cadre.function : undefined;
    return {
        filename: nettoyerFichier(cadre.filename),
        abs_path: nettoyerFichier(cadre.abs_path),
        module: chaine(cadre.module),
        function: fonction,
        lineno: nombre(cadre.lineno),
        colno: nombre(cadre.colno),
        in_app: typeof cadre.in_app === 'boolean' ? cadre.in_app : undefined,
    };
}
function nettoyerMessageSentry(brut) {
    if (typeof brut === 'string' && brut)
        return '[message]';
    if (estObjet(brut) && (brut.formatted || brut.message))
        return '[message]';
    return undefined;
}
const TYPES_AU_MESSAGE_LISIBLE = new Set([
    'TypeError',
    'RangeError',
    'SyntaxError',
    'ReferenceError',
    'HttpException',
    'BadRequestException',
    'UnauthorizedException',
    'NotFoundException',
    'ForbiddenException',
    'NotAcceptableException',
    'RequestTimeoutException',
    'ConflictException',
    'GoneException',
    'HttpVersionNotSupportedException',
    'PayloadTooLargeException',
    'UnsupportedMediaTypeException',
    'UnprocessableEntityException',
    'InternalServerErrorException',
    'NotImplementedException',
    'ImATeapotException',
    'MethodNotAllowedException',
    'BadGatewayException',
    'ServiceUnavailableException',
    'GatewayTimeoutException',
    'PreconditionFailedException',
    'MisdirectedException',
]);
function typeAuMessageLisible(type) {
    return typeof type === 'string' && (TYPES_AU_MESSAGE_LISIBLE.has(type) || /^Prisma[A-Za-z]*Error$/.test(type));
}
function nettoyerContextes(bruts) {
    if (!estObjet(bruts))
        return undefined;
    const sortie = {};
    for (const cle of ['runtime', 'os', 'browser']) {
        const c = bruts[cle];
        if (estObjet(c))
            sortie[cle] = { name: chaine(c.name, 60), version: chaine(c.version, 60) };
    }
    return Object.keys(sortie).length > 0 ? sortie : undefined;
}
function nettoyerDebugMeta(brute) {
    if (!estObjet(brute) || !Array.isArray(brute.images))
        return undefined;
    const images = brute.images.filter(estObjet).map((i) => ({
        type: chaine(i.type, 30),
        code_file: nettoyerFichier(i.code_file),
        debug_id: chaine(i.debug_id, 60),
    }));
    return images.length > 0 ? { images } : undefined;
}
function nettoyerMietteSentry(miette) {
    if (!estObjet(miette))
        return null;
    const categorie = typeof miette.category === 'string' ? miette.category : '';
    const donnees = estObjet(miette.data) ? miette.data : {};
    const base = {
        category: categorie,
        type: chaine(miette.type, 30),
        level: chaine(miette.level, 20),
        timestamp: nombre(miette.timestamp),
    };
    if (categorie === 'fetch' || categorie === 'xhr' || categorie === 'http') {
        base.data = {
            method: typeof donnees.method === 'string' && /^[A-Z]{3,7}$/.test(donnees.method) ? donnees.method : undefined,
            url: typeof donnees.url === 'string' ? nettoyerUrl(donnees.url) : undefined,
            status_code: nombre(donnees.status_code),
        };
        return base;
    }
    if (categorie === 'navigation') {
        base.data = {
            from: typeof donnees.from === 'string' ? nettoyerUrl(donnees.from) : undefined,
            to: typeof donnees.to === 'string' ? nettoyerUrl(donnees.to) : undefined,
        };
        return base;
    }
    if (categorie === 'sentry.event') {
        base.message = '[message]';
        return base;
    }
    return null;
}
const PROPRIETES_POSTHOG_ADMISES = [
    'token',
    'distinct_id',
    '$device_id',
    '$session_id',
    '$window_id',
    '$pageview_id',
    '$insert_id',
    '$time',
    '$lib',
    '$lib_version',
    '$browser',
    '$browser_version',
    '$os',
    '$os_version',
    '$device_type',
    '$screen_height',
    '$screen_width',
    '$viewport_height',
    '$viewport_width',
    '$timezone',
    '$host',
    '$process_person_profile',
    '$is_identified',
    '$geoip_disable',
];
const ROLES = ['ADMIN_CABINET', 'COMPTABLE', 'LECTURE_SEULE', 'AIDE_COMPTABLE', 'GESTIONNAIRE_PAIE'];
const REFERENTIELS = ['SYCEBNL', 'SYSCOHADA'];
function nettoyerEvenementPosthog(evenement) {
    if (!estObjet(evenement) || evenement.event !== '$pageview')
        return null;
    const recues = estObjet(evenement.properties) ? evenement.properties : {};
    const proprietes = {};
    for (const cle of PROPRIETES_POSTHOG_ADMISES) {
        const v = recues[cle];
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
            proprietes[cle] = v;
    }
    if (typeof proprietes.$host === 'string' && !/^[a-z0-9.-]+(:\d+)?$/i.test(proprietes.$host))
        delete proprietes.$host;
    const chemin = normaliserChemin(typeof recues.chemin === 'string' ? recues.chemin : '/');
    proprietes.chemin = chemin;
    proprietes.$pathname = chemin;
    const hote = typeof proprietes.$host === 'string' ? proprietes.$host : '';
    proprietes.$current_url = hote ? `https://${hote}/#${chemin}` : `/#${chemin}`;
    if (typeof recues.role === 'string' && ROLES.includes(recues.role))
        proprietes.role = recues.role;
    if (typeof recues.referentiel === 'string' && REFERENTIELS.includes(recues.referentiel)) {
        proprietes.referentiel = recues.referentiel;
    }
    if (recues.environnement === 'production' || recues.environnement === 'apercu') {
        proprietes.environnement = recues.environnement;
    }
    proprietes.$geoip_disable = true;
    const propre = { event: '$pageview', properties: proprietes };
    if (typeof evenement.uuid === 'string')
        propre.uuid = evenement.uuid;
    if (typeof evenement.timestamp === 'string' || evenement.timestamp instanceof Date)
        propre.timestamp = evenement.timestamp;
    return propre;
}
exports.COLLECTE_SENTRY_COUPEE = {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    frameContextLines: 0,
};
//# sourceMappingURL=nettoyage-telemetrie.js.map