/**
 * TÉLÉMÉTRIE · CE QUI PART, ET CE QUI NE PART JAMAIS (décision de Manasse du
 * 2026-10-07).
 *
 * Deux services, région de données de l'Union européenne pour les deux ·
 * Sentry reçoit les PANNES (serveur et interface), PostHog les PAGES VUES de
 * l'interface. Ni l'un ni l'autre ne reçoit une donnée du dossier · aucun
 * montant, aucun nom, aucun courriel, aucun contenu saisi, aucun corps de
 * requête ou de réponse, aucun cookie, aucun en-tête, aucune chaîne de
 * requête (la recherche d'écritures met des montants dans l'adresse).
 *
 * CE FICHIER EST ÉCRIT UNE FOIS, POUR LES DEUX CÔTÉS · le serveur l'importe,
 * l'interface aussi (`client/src/lib/telemetrie.ts`). Il est PUR · aucun
 * import, aucune API du navigateur ni de Node, sans quoi il ne se
 * compilerait pas des deux côtés. Pas de « lookbehind » dans les expressions
 * régulières · Safari ne les lit qu'à partir de 16.4, et une expression
 * illisible au chargement casserait l'interface entière sur un iPhone ancien.
 *
 * LE NETTOYAGE RECONSTRUIT, IL NE RETRANCHE PAS · chaque événement est rebâti
 * à partir d'une liste FERMÉE de champs. Retirer les champs dangereux connus
 * laisserait passer celui qu'une version suivante du SDK ajoutera demain ;
 * ne recopier que les champs connus ne laisse passer que ce qui a été relu.
 */

/** Hôtes de la région UE, les seuls que la politique de sécurité du site ouvre. */
export const HOTES_TELEMETRIE_UE = ['https://*.ingest.de.sentry.io', 'https://eu.i.posthog.com'] as const;
/** Adresse d'ingestion de PostHog, région UE. */
export const HOTE_POSTHOG_UE = 'https://eu.i.posthog.com';
/** Suffixe d'hôte d'une clé Sentry de la région UE (`o123.ingest.de.sentry.io`). */
const SUFFIXE_SENTRY_UE = '.ingest.de.sentry.io';

// ---------------------------------------------------------------------------
// RÉGIME · actif ou non, et pourquoi
// ---------------------------------------------------------------------------

export type RegimeTelemetrie =
  | { actif: true }
  | { actif: false; motif: 'aucune-cle' | 'sur-site' | 'hors-ue' | 'echec' };

/**
 * Sentry. L'installation sur site PASSE AVANT la clé · une clé posée par
 * mégarde sur un poste client n'ouvre rien. Une clé d'une autre région que
 * l'UE n'ouvre rien non plus · les données partiraient ailleurs que là où la
 * politique de confidentialité le dit.
 */
export function regimeSentry(dsn: string | undefined | null, surSite: boolean): RegimeTelemetrie {
  if (surSite) return { actif: false, motif: 'sur-site' };
  const cle = (dsn ?? '').trim();
  if (!cle) return { actif: false, motif: 'aucune-cle' };
  return hoteSentryUe(cle) ? { actif: true } : { actif: false, motif: 'hors-ue' };
}

/** PostHog · la clé est un jeton de projet, l'hôte UE est écrit ici, jamais reçu. */
export function regimePosthog(cle: string | undefined | null, surSite: boolean): RegimeTelemetrie {
  if (surSite) return { actif: false, motif: 'sur-site' };
  return (cle ?? '').trim() ? { actif: true } : { actif: false, motif: 'aucune-cle' };
}

function hoteSentryUe(dsn: string): boolean {
  const m = /^https:\/\/[^@/\s]+@([^/:\s]+)(?::\d+)?\/\d+\/?$/.exec(dsn);
  return !!m && m[1].toLowerCase().endsWith(SUFFIXE_SENTRY_UE);
}

/**
 * La ligne écrite au démarrage · le RÉGIME, jamais la clé (même esprit que
 * `common/pooling-base.ts`).
 */
export function messageRegime(service: 'Sentry' | 'PostHog', regime: RegimeTelemetrie): string {
  if (regime.actif) return `${service} · actif`;
  const motifs = {
    'aucune-cle': 'aucune clé',
    'sur-site': 'installation sur site',
    'hors-ue': 'clé illisible ou hors de la région UE',
    echec: 'échec du chargement',
  } as const;
  return `${service} · inactif (${motifs[regime.motif]})`;
}

// ---------------------------------------------------------------------------
// CHEMINS, ADRESSES, MESSAGES
// ---------------------------------------------------------------------------

/** Un segment de route d'OmegaX · des mots en minuscules liés par des traits d'union. */
const SEGMENT_DE_ROUTE = /^[a-z]+(?:-[a-z]+)*$/;

/**
 * Le chemin sans ce qu'il porte du dossier · chaîne de requête et fragment
 * retirés, tout segment qui n'est pas un mot de route (identifiant, numéro,
 * montant, nom) remplacé par `:id`. Liste FERMÉE · un segment inconnu tombe.
 */
export function normaliserChemin(chemin: string): string {
  const sansRequete = String(chemin ?? '').split(/[?#]/)[0];
  const segments = sansRequete.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return '/';
  return '/' + segments.map((s) => (SEGMENT_DE_ROUTE.test(s) ? s : ':id')).join('/');
}

/**
 * Une adresse · l'origine http(s) sans identifiants de connexion, puis le
 * chemin normalisé. Une route d'interface (HashRouter, `#/comptes/…`) se lit
 * dans le fragment. Tout autre schéma (une chaîne de connexion, un `data:`)
 * ne se recopie pas.
 */
export function nettoyerUrl(url: string): string {
  const brute = String(url ?? '').trim();
  const absolue = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)(.*)$/i.exec(brute);
  if (!absolue) {
    const diese = brute.indexOf('#');
    const fragment = diese >= 0 ? brute.slice(diese + 1) : '';
    const chemin = normaliserChemin(diese >= 0 ? brute.slice(0, diese) : brute);
    return fragment.startsWith('/') ? `${chemin}#${normaliserChemin(fragment)}` : chemin;
  }
  const schema = absolue[1].toLowerCase();
  if (schema !== 'http' && schema !== 'https') return '[adresse]';
  const hote = absolue[2].split('@').pop() ?? '';
  const reste = absolue[3];
  const diese = reste.indexOf('#');
  const fragment = diese >= 0 ? reste.slice(diese + 1) : '';
  const chemin = normaliserChemin(diese >= 0 ? reste.slice(0, diese) : reste);
  const route = fragment.startsWith('/') ? `#${normaliserChemin(fragment)}` : '';
  return `${schema}://${hote}${chemin}${route}`;
}

/** Une adresse de fichier de script ou de source · la requête et le fragment seuls tombent. */
function nettoyerFichier(fichier: unknown): string | undefined {
  if (typeof fichier !== 'string') return undefined;
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i.test(fichier)) return '[adresse]';
  return fichier.split(/[?#]/)[0].slice(0, 300);
}

const IDENTIFIANT_DE_CODE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\(\))?$/;
const LONGUEUR_MESSAGE = 200;

/**
 * Le message d'une erreur, sans ce qu'il peut porter du dossier. Une erreur
 * de Prisma recopie les arguments de la requête (libellés, montants), un
 * message écrit dans un service peut citer un tiers · on ne garde que la
 * PREMIÈRE ligne, puis on remplace adresses, courriels, identifiants,
 * nombres, textes entre guillemets (sauf un identifiant de code entre
 * accents graves, `JSON.parse()`) et tout mot à majuscule qui
 * n'ouvre pas la phrase (un nom propre). Ce qui reste dit la FORME de la
 * panne, jamais son contenu.
 */
export function nettoyerMessage(texte: unknown): string {
  if (typeof texte !== 'string') return '';
  const ligne = texte.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  // Les identifiants de code entre accents graves sont mis à l'abri, le reste nettoyé.
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

function nettoyerProse(texte: string, enTete: boolean): string {
  let t = texte
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[adresse]')
    .replace(/[^\s@'"`<>()[\]]+@[^\s@'"`<>()[\]]+/g, '[courriel]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .replace(/'[^']*'|"[^"]*"|«[^»]*»|“[^”]*”|‘[^’]*’/g, '[texte]')
    .replace(/[-+]?\d(?:[\d\s  .,']*\d)?/g, '[nombre]');
  // Un mot à majuscule qui n'ouvre pas la phrase est tenu pour un nom propre.
  t = t.replace(/(^|[^\p{L}\p{M}[])(\p{Lu}[\p{L}\p{M}'’-]*)/gu, (tout, avant: string, _mot: string, position: number) =>
    enTete && position === 0 && avant === '' ? tout : `${avant}[mot]`,
  );
  return t;
}

// ---------------------------------------------------------------------------
// SENTRY · événements et miettes
// ---------------------------------------------------------------------------

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);
const chaine = (v: unknown, max = 200): string | undefined =>
  typeof v === 'string' ? v.slice(0, max) : undefined;
const nombre = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Les seules étiquettes qui partent, et ce que chacune peut valoir. */
const ETIQUETTES: Record<string, (v: unknown) => string | undefined> = {
  route: (v) => (typeof v === 'string' ? normaliserChemin(v) : undefined),
  methode: (v) => (typeof v === 'string' && /^[A-Z]{3,7}$/.test(v) ? v : undefined),
  statut: (v) => (typeof v === 'string' && /^\d{3}$/.test(v) ? v : undefined),
  code_prisma: (v) => (typeof v === 'string' && /^P\d{4}$/.test(v) ? v : undefined),
  cote: (v) => (v === 'serveur' || v === 'interface' ? v : undefined),
};

/** Contexte facultatif que l'appelant connaît mieux que l'événement (la route de l'interface). */
export interface ContexteNettoyage {
  route?: string;
}

/**
 * `beforeSend` de Sentry, serveur et interface. Rend `null` (rien ne part)
 * pour ce qui n'est ni une exception ni un message.
 */
export function nettoyerEvenementSentry<T>(evenement: T, contexte: ContexteNettoyage = {}): T | null {
  if (!estObjet(evenement)) return null;
  if (evenement.type !== undefined) return null; // transactions, profils, retours · jamais
  const exception = nettoyerException(evenement.exception);
  const message = nettoyerMessageSentry(evenement.message);
  if (!exception && !message) return null;

  const propre: Objet = {};
  for (const cle of ['event_id', 'level', 'platform', 'environment', 'release', 'dist', 'logger'] as const) {
    const v = chaine(evenement[cle]);
    if (v !== undefined) propre[cle] = v;
  }
  for (const cle of ['timestamp', 'start_timestamp'] as const) {
    const v = nombre(evenement[cle]);
    if (v !== undefined) propre[cle] = v;
  }
  if (exception) propre.exception = exception;
  if (message) propre.message = message;

  const etiquettes: Record<string, string> = {};
  const recues = estObjet(evenement.tags) ? evenement.tags : {};
  for (const [cle, lire] of Object.entries(ETIQUETTES)) {
    const v = lire(recues[cle]);
    if (v !== undefined) etiquettes[cle] = v;
  }
  if (contexte.route !== undefined) etiquettes.route = normaliserChemin(contexte.route);
  if (Object.keys(etiquettes).length > 0) propre.tags = etiquettes;
  if (etiquettes.route) propre.transaction = etiquettes.route;

  const contextes = nettoyerContextes(evenement.contexts);
  if (contextes) propre.contexts = contextes;
  const miettes = Array.isArray(evenement.breadcrumbs)
    ? evenement.breadcrumbs.map((m) => nettoyerMietteSentry(m)).filter((m): m is Objet => m !== null)
    : [];
  if (miettes.length > 0) propre.breadcrumbs = miettes.slice(-50);
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
  if (meta) propre.debug_meta = meta;
  return propre as T;
}

function nettoyerException(brute: unknown): Objet | undefined {
  if (!estObjet(brute) || !Array.isArray(brute.values)) return undefined;
  const valeurs = brute.values.filter(estObjet).map((v) => {
    const sortie: Objet = {
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

/** Un cadre de pile · fichier, fonction, ligne, colonne. Ni variables, ni lignes de source. */
function nettoyerCadre(cadre: Objet): Objet {
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

/** Un message libre (`captureMessage`) n'a pas de type connu · il ne part pas. */
function nettoyerMessageSentry(brut: unknown): string | undefined {
  if (typeof brut === 'string' && brut) return '[message]';
  if (estObjet(brut) && (brut.formatted || brut.message)) return '[message]';
  return undefined;
}

/**
 * LE MESSAGE NE PART QUE POUR UN TYPE CONNU · liste FERMÉE (relecture du
 * 2026-10-07). Le nettoyage du texte procède par retranchement, et un
 * libellé tout en minuscules (« compte loyer janvier du tiers dupont ») le
 * traverserait intact. Seules les erreurs du moteur JavaScript, celles de
 * Prisma et les exceptions HTTP de Nest gardent leur message, nettoyé ;
 * toute autre erreur (une `Error` écrite dans un service, une exception
 * propre à OmegaX) part avec son type et sa pile, et `[message]`.
 */
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

export function typeAuMessageLisible(type: unknown): boolean {
  return typeof type === 'string' && (TYPES_AU_MESSAGE_LISIBLE.has(type) || /^Prisma[A-Za-z]*Error$/.test(type));
}

function nettoyerContextes(bruts: unknown): Objet | undefined {
  if (!estObjet(bruts)) return undefined;
  const sortie: Objet = {};
  for (const cle of ['runtime', 'os', 'browser'] as const) {
    const c = bruts[cle];
    if (estObjet(c)) sortie[cle] = { name: chaine(c.name, 60), version: chaine(c.version, 60) };
  }
  return Object.keys(sortie).length > 0 ? sortie : undefined;
}

function nettoyerDebugMeta(brute: unknown): Objet | undefined {
  if (!estObjet(brute) || !Array.isArray(brute.images)) return undefined;
  const images = brute.images.filter(estObjet).map((i) => ({
    type: chaine(i.type, 30),
    code_file: nettoyerFichier(i.code_file),
    debug_id: chaine(i.debug_id, 60),
  }));
  return images.length > 0 ? { images } : undefined;
}

/**
 * `beforeBreadcrumb` de Sentry · seules les requêtes (méthode, adresse
 * nettoyée, statut) et les changements de page (adresses nettoyées) sont
 * gardés. Clics, saisies, console · jamais (`ui.*` lit le texte des
 * boutons et des cellules, donc des montants).
 */
export function nettoyerMietteSentry<T>(miette: T): T | null {
  if (!estObjet(miette)) return null;
  const categorie = typeof miette.category === 'string' ? miette.category : '';
  const donnees = estObjet(miette.data) ? miette.data : {};
  const base: Objet = {
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
    return base as T;
  }
  if (categorie === 'navigation') {
    base.data = {
      from: typeof donnees.from === 'string' ? nettoyerUrl(donnees.from) : undefined,
      to: typeof donnees.to === 'string' ? nettoyerUrl(donnees.to) : undefined,
    };
    return base as T;
  }
  if (categorie === 'sentry.event') {
    // Le message de l'erreur précédente, sans son type · il ne part pas.
    base.message = '[message]';
    return base as T;
  }
  return null;
}

// ---------------------------------------------------------------------------
// POSTHOG · pages vues
// ---------------------------------------------------------------------------

/** Propriétés qu'ajoute le SDK et qui ne disent rien du dossier. */
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
] as const;

const ROLES = ['ADMIN_CABINET', 'COMPTABLE', 'LECTURE_SEULE', 'AIDE_COMPTABLE', 'GESTIONNAIRE_PAIE'];
const REFERENTIELS = ['SYCEBNL', 'SYSCOHADA'];

/**
 * `before_send` de PostHog. Seule la page vue part ; ses propriétés sont
 * rebâties sur une liste fermée, l'adresse est réécrite sur la route
 * normalisée, et le rôle et le référentiel ne passent que s'ils valent une
 * valeur connue. Aucune propriété de personne (`$set`, `$set_once`), ni
 * référent, ni titre de page.
 */
export function nettoyerEvenementPosthog<T>(evenement: T): T | null {
  if (!estObjet(evenement) || evenement.event !== '$pageview') return null;
  const recues = estObjet(evenement.properties) ? evenement.properties : {};
  const proprietes: Objet = {};
  for (const cle of PROPRIETES_POSTHOG_ADMISES) {
    const v = recues[cle];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') proprietes[cle] = v;
  }
  if (typeof proprietes.$host === 'string' && !/^[a-z0-9.-]+(:\d+)?$/i.test(proprietes.$host)) delete proprietes.$host;
  const chemin = normaliserChemin(typeof recues.chemin === 'string' ? recues.chemin : '/');
  proprietes.chemin = chemin;
  proprietes.$pathname = chemin;
  const hote = typeof proprietes.$host === 'string' ? proprietes.$host : '';
  proprietes.$current_url = hote ? `https://${hote}/#${chemin}` : `/#${chemin}`;
  if (typeof recues.role === 'string' && ROLES.includes(recues.role)) proprietes.role = recues.role;
  if (typeof recues.referentiel === 'string' && REFERENTIELS.includes(recues.referentiel)) {
    proprietes.referentiel = recues.referentiel;
  }
  if (recues.environnement === 'production' || recues.environnement === 'apercu') {
    proprietes.environnement = recues.environnement;
  }
  // Aucune localisation déduite de l'adresse réseau à l'ingestion · posé ici
  // quoi que le SDK ait envoyé (relecture du 2026-10-07).
  proprietes.$geoip_disable = true;
  const propre: Objet = { event: '$pageview', properties: proprietes };
  if (typeof evenement.uuid === 'string') propre.uuid = evenement.uuid;
  if (typeof evenement.timestamp === 'string' || evenement.timestamp instanceof Date) propre.timestamp = evenement.timestamp;
  return propre as T;
}

/**
 * Ce que Sentry ne doit JAMAIS collecter de lui-même (`dataCollection` du
 * SDK v11, qui a remplacé `sendDefaultPii` · absente, la v11 collecte TOUT).
 * Partagé par le serveur et l'interface.
 */
export const COLLECTE_SENTRY_COUPEE = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [] as never[],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
};
