import {
  COLLECTE_SENTRY_COUPEE,
  messageRegime,
  nettoyerEvenementPosthog,
  nettoyerEvenementSentry,
  nettoyerMessage,
  nettoyerMietteSentry,
  nettoyerUrl,
  normaliserChemin,
  typeAuMessageLisible,
  regimePosthog,
  regimeSentry,
} from './nettoyage-telemetrie';

/**
 * RIEN DU DOSSIER NE PART (décision de Manasse du 2026-10-07). Les événements
 * de ces tests sont CHARGÉS à dessein de ce qu'un dossier peut porter · un
 * montant, un courriel, un nom, un cookie, un corps de requête, une chaîne de
 * requête, un uuid dans un chemin. On relit ce qui ressort, en entier.
 */

const DSN_UE = 'https://0123abcd@o4507000000000000.ingest.de.sentry.io/4507000000000001';
const DSN_US = 'https://0123abcd@o4507000000000000.ingest.us.sentry.io/4507000000000001';
const UUID = '3f2b8c1e-9a4d-4e2b-8f1a-0c9d8e7f6a5b';
const SECRETS = ['5000', '1 250 000', 'dupont@exemple.cd', 'Dupont', 'Kabila', UUID, '__session', 'jeton-csrf', 'mot-de-passe'];

function sansSecret(sortie: unknown) {
  const texte = JSON.stringify(sortie);
  for (const s of SECRETS) expect([s, texte.includes(s)]).toEqual([s, false]);
}

describe('régime · éteint sans clé, toujours éteint sur site', () => {
  it('actif avec une clé de la région UE, en ligne', () => {
    expect(regimeSentry(DSN_UE, false)).toEqual({ actif: true });
    expect(regimePosthog('phc_abc', false)).toEqual({ actif: true });
  });
  it('sur site, inactif même avec une clé', () => {
    expect(regimeSentry(DSN_UE, true)).toEqual({ actif: false, motif: 'sur-site' });
    expect(regimePosthog('phc_abc', true)).toEqual({ actif: false, motif: 'sur-site' });
  });
  it('sans clé, ou clé vide, inactif', () => {
    for (const cle of [undefined, null, '', '   ']) {
      expect(regimeSentry(cle, false)).toEqual({ actif: false, motif: 'aucune-cle' });
      expect(regimePosthog(cle, false)).toEqual({ actif: false, motif: 'aucune-cle' });
    }
  });
  it('une clé d’une autre région, ou illisible, n’ouvre rien', () => {
    expect(regimeSentry(DSN_US, false)).toEqual({ actif: false, motif: 'hors-ue' });
    expect(regimeSentry('pas une adresse', false)).toEqual({ actif: false, motif: 'hors-ue' });
    expect(regimeSentry('https://k@exemple.ingest.de.sentry.io.attaquant.net/1', false)).toEqual({
      actif: false,
      motif: 'hors-ue',
    });
  });
  it('la ligne de démarrage dit le régime, jamais la clé', () => {
    expect(messageRegime('Sentry', regimeSentry(DSN_UE, false))).toBe('Sentry · actif');
    expect(messageRegime('Sentry', regimeSentry(undefined, false))).toBe('Sentry · inactif (aucune clé)');
    expect(messageRegime('Sentry', regimeSentry(DSN_UE, true))).toBe('Sentry · inactif (installation sur site)');
    expect(messageRegime('Sentry', regimeSentry(DSN_US, false))).not.toContain('0123abcd');
    expect(messageRegime('Sentry', { actif: false, motif: 'echec' })).toBe('Sentry · inactif (échec du chargement)');
  });
});

describe('chemins et adresses', () => {
  it('un identifiant ou un nombre dans un chemin devient :id, la requête tombe', () => {
    expect(normaliserChemin(`/comptes/${UUID}/lettrage`)).toBe('/comptes/:id/lettrage');
    expect(normaliserChemin('/ecritures/recherche?montant=5000&compte=411')).toBe('/ecritures/recherche');
    expect(normaliserChemin('/grand-livre/41100000')).toBe('/grand-livre/:id');
    expect(normaliserChemin('/tiers/Dupont')).toBe('/tiers/:id');
    expect(normaliserChemin('/comptes/:compteId')).toBe('/comptes/:id');
    expect(normaliserChemin('')).toBe('/');
  });
  it('une route d’interface se lit dans le fragment', () => {
    expect(nettoyerUrl(`https://oomega.web.app/#/comptes/${UUID}/lettrage?x=5000`)).toBe(
      'https://oomega.web.app/#/comptes/:id/lettrage',
    );
    expect(nettoyerUrl('/api/ecritures/recherche?montant=5000')).toBe('/api/ecritures/recherche');
    expect(nettoyerUrl('#/journal?onglet=balance')).toBe('/#/journal');
  });
  it('ni identifiants de connexion, ni chaîne de base', () => {
    expect(nettoyerUrl('https://dupont:mot-de-passe@oomega.web.app/api')).toBe('https://oomega.web.app/api');
    expect(nettoyerUrl('postgresql://u:mot-de-passe@hote/base')).toBe('[adresse]');
  });
});

describe('messages d’erreur', () => {
  it('montants, courriels, noms, uuids et textes cités disparaissent', () => {
    const m = nettoyerMessage(
      `Le tiers Dupont (dupont@exemple.cd) doit 1 250 000,00 sur ${UUID} : 'Facture Kabila' "5000"`,
    );
    sansSecret(m);
    expect(m.startsWith('Le tiers [mot]')).toBe(true);
  });
  it('une erreur de Prisma ne garde que sa première ligne, et l’appel en cause', () => {
    const m = nettoyerMessage(
      '\nInvalid `prisma.ecriture.create()` invocation in\n/app/dist/x.js:12:3\n  data: { libelle: "Facture Dupont", montant: 5000 }',
    );
    expect(m).toBe('Invalid `prisma.ecriture.create()` invocation in');
  });
  it('une adresse de base dans un message ne passe pas', () => {
    expect(nettoyerMessage("Can't reach database at postgresql://u:mot-de-passe@ep-x.neon.tech/db")).not.toContain(
      'mot-de-passe',
    );
    expect(nettoyerMessage('Échec sur `ep-x.neon.tech:5432`')).toBe('Échec sur [texte]');
  });
  it('la forme de la panne reste lisible', () => {
    expect(nettoyerMessage("Cannot read properties of undefined (reading 'montant')")).toBe(
      'Cannot read properties of undefined (reading [texte])',
    );
  });
});

describe('événement Sentry · reconstruit sur une liste fermée', () => {
  const evenement = {
    event_id: 'abc',
    level: 'error',
    platform: 'node',
    environment: 'production',
    timestamp: 1_790_000_000,
    server_name: 'machine',
    exception: {
      values: [
        {
          type: 'PrismaClientKnownRequestError',
          value: 'Unique constraint failed for dupont@exemple.cd montant 5000',
          mechanism: { type: 'generic', handled: true, data: { secret: 'mot-de-passe' } },
          stacktrace: {
            frames: [
              {
                filename: '/app/dist/modules/x.js',
                function: 'EcritureService.creer',
                lineno: 12,
                colno: 3,
                in_app: true,
                vars: { montant: 5000, libelle: 'Facture Dupont' },
                context_line: 'const montant = 5000; // Dupont',
                pre_context: ['Kabila'],
              },
              { filename: `https://oomega.web.app/assets/index.js?jeton=${UUID}`, function: 'x' },
            ],
          },
        },
      ],
    },
    request: {
      url: '/api/ecritures/recherche?montant=5000',
      cookies: { __session: 'jeton' },
      headers: { cookie: '__session=jeton', 'x-csrf-token': 'jeton-csrf', authorization: 'mot-de-passe' },
      data: '{"libelle":"Facture Dupont","montant":1250000}',
      query_string: 'montant=5000',
    },
    user: { email: 'dupont@exemple.cd', ip_address: '1.2.3.4', id: UUID },
    extra: { corps: { montant: 5000 } },
    tags: { route: `/comptes/${UUID}`, statut: '500', nom: 'Dupont', code_prisma: 'P2002' },
    contexts: { runtime: { name: 'node', version: 'v22' }, reponse: { corps: 'Dupont' } },
    breadcrumbs: [
      { category: 'ui.input', message: 'input[name=montant] 5000' },
      { category: 'ui.click', message: 'td « Dupont 1 250 000 »' },
      { category: 'console', message: 'dupont@exemple.cd' },
      { category: 'fetch', type: 'http', data: { method: 'GET', url: '/api/ecritures/recherche?montant=5000', status_code: 500 } },
      { category: 'navigation', data: { from: `/#/comptes/${UUID}`, to: '/#/journal?onglet=5000' } },
    ],
    sdkProcessingMetadata: { normalizedRequest: { cookies: { __session: 'jeton' } } },
  };

  const sortie = nettoyerEvenementSentry(evenement) as Record<string, any>;

  it('rien du dossier ne ressort, ni cookie, ni en-tête, ni corps, ni utilisateur', () => {
    sansSecret(sortie);
    for (const champ of ['request', 'user', 'extra', 'server_name', 'sdkProcessingMetadata']) {
      expect([champ, champ in sortie]).toEqual([champ, false]);
    }
  });

  it('la pile reste, sans variables ni source', () => {
    const cadres = sortie.exception.values[0].stacktrace.frames;
    expect(cadres[0]).toMatchObject({ filename: '/app/dist/modules/x.js', function: 'EcritureService.creer', lineno: 12 });
    expect(Object.keys(cadres[0])).not.toEqual(expect.arrayContaining(['vars']));
    expect(cadres[1].filename).toBe('https://oomega.web.app/assets/index.js');
    expect(sortie.exception.values[0].type).toBe('PrismaClientKnownRequestError');
  });

  it('seules les étiquettes connues passent, la route normalisée', () => {
    expect(sortie.tags).toEqual({ route: '/comptes/:id', statut: '500', code_prisma: 'P2002' });
    expect(sortie.contexts).toEqual({ runtime: { name: 'node', version: 'v22' } });
  });

  it('miettes · requêtes et navigation nettoyées, clics, saisies et console écartés', () => {
    expect(sortie.breadcrumbs.map((m: any) => m.category)).toEqual(['fetch', 'navigation']);
    expect(sortie.breadcrumbs[0].data.url).toBe('/api/ecritures/recherche');
    expect(sortie.breadcrumbs[1].data).toEqual({ from: '/#/comptes/:id', to: '/#/journal' });
  });

  it('une transaction ou un événement sans exception ne part pas', () => {
    expect(nettoyerEvenementSentry({ type: 'transaction', spans: [] })).toBeNull();
    expect(nettoyerEvenementSentry({ event_id: 'x', extra: { montant: 5000 } })).toBeNull();
    expect(nettoyerEvenementSentry(null)).toBeNull();
  });

  it('le message ne part que pour un type connu · un libellé en minuscules ne traverse pas', () => {
    const libelle = 'compte loyer janvier du tiers dupont kabila';
    const evt = (type: string) =>
      nettoyerEvenementSentry({ exception: { values: [{ type, value: libelle }] } }) as Record<string, any>;
    // Une Error écrite dans un service, une exception propre à OmegaX · le texte ne part pas.
    expect(evt('Error').exception.values[0].value).toBe('[message]');
    expect(evt('AucunPlanABudgetsException').exception.values[0].value).toBe('[message]');
    // Les erreurs du moteur, de Prisma et de Nest gardent leur message, nettoyé.
    expect(evt('TypeError').exception.values[0].value).toBe(libelle);
    for (const t of ['RangeError', 'SyntaxError', 'ReferenceError', 'PrismaClientKnownRequestError', 'HttpException', 'InternalServerErrorException']) {
      expect([t, typeAuMessageLisible(t)]).toEqual([t, true]);
    }
    for (const t of ['Error', 'PrismaClient', 'MonException', undefined]) {
      expect([t, typeAuMessageLisible(t)]).toEqual([t, false]);
    }
    // Un message libre (captureMessage) ne part pas non plus.
    expect((nettoyerEvenementSentry({ message: libelle }) as Record<string, any>).message).toBe('[message]');
  });

  it('la miette seule suit la même règle', () => {
    expect(nettoyerMietteSentry({ category: 'ui.click', message: 'Dupont' })).toBeNull();
    expect(nettoyerMietteSentry({ category: 'console', message: 'Dupont' })).toBeNull();
  });

  it('la collecte du SDK est coupée en entier', () => {
    expect(COLLECTE_SENTRY_COUPEE).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      frameContextLines: 0,
      databaseQueryData: false,
    });
  });
});

describe('événement PostHog · la page vue seule, anonyme', () => {
  const evenement = {
    uuid: 'u-1',
    event: '$pageview',
    timestamp: '2026-10-07T10:00:00Z',
    properties: {
      token: 'phc_abc',
      distinct_id: 'anonyme-1',
      $current_url: `https://oomega.web.app/#/ecritures/recherche?montant=5000&tiers=Dupont`,
      $host: 'oomega.web.app',
      $pathname: '/',
      $referrer: 'https://exemple.cd/?courriel=dupont@exemple.cd',
      title: 'Grand livre · Dupont',
      $browser: 'Chrome',
      chemin: `/comptes/${UUID}/lettrage?montant=5000`,
      role: 'COMPTABLE',
      referentiel: 'SYSCOHADA',
      nom: 'Dupont',
      $raw_user_agent: 'Mozilla',
      $elements: [{ $el_text: '1 250 000' }],
    },
    $set: { email: 'dupont@exemple.cd' },
    $set_once: { $initial_current_url: `https://oomega.web.app/#/comptes/${UUID}` },
  };
  const sortie = nettoyerEvenementPosthog(evenement) as Record<string, any>;

  it('rien du dossier ne ressort', () => {
    sansSecret(sortie);
    expect('$set' in sortie).toBe(false);
    expect('$set_once' in sortie).toBe(false);
  });

  it('l’adresse est la route normalisée, rôle et référentiel connus seuls', () => {
    expect(sortie.properties).toMatchObject({
      chemin: '/comptes/:id/lettrage',
      $pathname: '/comptes/:id/lettrage',
      $current_url: 'https://oomega.web.app/#/comptes/:id/lettrage',
      role: 'COMPTABLE',
      referentiel: 'SYSCOHADA',
      token: 'phc_abc',
      $geoip_disable: true,
    });
    for (const champ of ['$referrer', 'title', 'nom', '$raw_user_agent', '$elements']) {
      expect([champ, champ in sortie.properties]).toEqual([champ, false]);
    }
    expect(nettoyerEvenementPosthog({ ...evenement, properties: { role: 'Dupont' } })).not.toHaveProperty('properties.role');
  });

  it('tout autre événement est jeté · clics, sortie de page, exceptions, enregistrements', () => {
    for (const nom of ['$autocapture', '$pageleave', '$exception', '$snapshot', '$web_vitals', '$identify', '$rageclick']) {
      expect([nom, nettoyerEvenementPosthog({ event: nom, properties: {} })]).toEqual([nom, null]);
    }
  });
});
