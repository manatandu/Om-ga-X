// TEST DE CHARGE k6 · L'USAGE COMPLET D'UN CABINET, par utilisateur virtuel.
//
// À quoi ça sert : savoir ce que le serveur d'OmegaX supporte quand beaucoup de
// cabinets travaillent en même temps, et trouver les défauts qu'aucun test
// unitaire ne voit (les suites de Jest tournent sur des Prisma factices ;
// CLAUDE.md § 5 et § 8 bis). Ce n'est PAS un test de la production : il vise un
// serveur et une base JETABLES, montés à la main (voir README.md et
// docs/test-de-charge-k6.md).
//
// Un tour de boucle = un cabinet neuf, du premier clic à la liasse :
//   inscription (ou essai public) → connexion → lecture du plan et des journaux
//   → personnalisation des comptes et ouverture de tiers → saisie de dizaines
//   d'écritures équilibrées (achats, ventes, trésorerie, paie) → validation →
//   lettrage → balance, grand livre, journal → états financiers et notes
//   annexes → TVA, contrôles, tableau de bord → immobilisation et dotation →
//   exports Excel en flux (journal, balance, grand livre, liasse) → sondes de
//   cloisonnement → déconnexion.
//
// COMMENT LE LIRE
//   · chaque requête porte l'étiquette `etape` ; chaque étape a SON seuil
//     (tableau ETAPES ci-dessous) donc SES p50, p95 et p99 dans le résumé ;
//   · un 4xx n'est PAS une panne (refus attendu, sonde de sécurité) ; seuls
//     les 5xx, les coupures réseau et les incohérences comptables comptent ;
//   · les contrôles de fond (balance bouclée, aucune fuite entre dossiers)
//     sont des Counter à seuil zéro : un seul suffit à faire échouer l'essai.
//
// VARIABLES (toutes facultatives)
//   BASE         adresse du serveur            (défaut http://localhost:8080)
//   PROFIL       fumee | nominal | palier | montee | stress | pic | rafale |
//                inscriptions   (défaut fumee)
//   VUS, DUREE   pour le profil `palier` : nombre de cabinets simultanés (défaut
//                20) et durée du palier une fois monté (défaut 3m)
//   RAFALE       pour le profil `rafale` : nombre d'inscriptions SIMULTANÉES (défaut 20)
//   TAUX         pour le profil `inscriptions` : paliers d'inscriptions par seconde,
//                séparés par des virgules (défaut 0.5,1,2,3,5)
//   PARCOURS     complet | entree  (défaut complet ; `entree` s'arrête après
//                l'inscription, la connexion et l'ouverture du dossier, c'est
//                le parcours des profils `rafale` et `inscriptions`)
//   REFERENTIEL  SYCEBNL | SYSCOHADA | MIX     (défaut MIX : un cabinet sur deux)
//   THINK        temps de réflexion moyen en secondes entre deux gestes
//                (défaut 1 ; 0 = marteler, c'est le profil `pic`)
//   LOTS         nombre de lots de 5 écritures par cabinet (défaut 8 = 40 pièces)
//   IP           distinctes | unique   (défaut distinctes · voir plus bas)
//   SINK         adresse du puits de courriel (puits-courriel.mjs) ; absent,
//                l'essai public n'est pas parcouru, seulement son /etat
//   ESSAI        part des cabinets qui entrent par l'essai public (défaut 0.3
//                si SINK est posé)
//   LIASSE       0 pour retirer l'export de la liasse complète (défaut 1)
//   RUN          marqueur du lancement, pour des adresses de courriel uniques
//
// JAMAIS : viser la production (oomega.web.app, *.run.app), ni une base réelle.
// Le script crée des dizaines de dossiers et les laisse en place.

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const BASE = __ENV.BASE || 'http://localhost:8080';
const PROFIL = __ENV.PROFIL || 'fumee';
const REFERENTIEL = __ENV.REFERENTIEL || 'MIX';
const THINK = __ENV.THINK !== undefined ? Number(__ENV.THINK) : 1;
const LOTS = Number(__ENV.LOTS || 8);
const IP = __ENV.IP || 'distinctes';
const SINK = __ENV.SINK || '';
const ESSAI = __ENV.ESSAI !== undefined ? Number(__ENV.ESSAI) : SINK ? 0.3 : 0;
const LIASSE = (__ENV.LIASSE || '1') !== '0';
const RUN = __ENV.RUN || String(Date.now());
const RAFALE = Number(__ENV.RAFALE || 20);
const VUS = Number(__ENV.VUS || 20);
const DUREE = __ENV.DUREE || '3m';
const TAUX = (__ENV.TAUX || '0.5,1,2,3,5').split(',').map(Number);
const PARCOURS = __ENV.PARCOURS || (['rafale', 'inscriptions'].includes(PROFIL) ? 'entree' : 'complet');
const MDP = 'MotDePasse-k6-1234';

// Un 4xx est un REFUS (sonde de sécurité, règle métier), pas une panne : seuls
// les 5xx et les coupures comptent dans `http_req_failed`.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

// ---------------------------------------------------------------------------
// SEUILS PAR ÉTAPE · p95 en millisecondes, posés AVANT la mesure sur ce qu'un
// utilisateur supporte, pas sur ce que le serveur sait faire :
//   · 1 000 ms pour une lecture ou un geste courant (Nielsen : au-delà d'une
//     seconde le fil de la pensée se casse) ;
//   · 3 000 ms pour la connexion et l'inscription, qui hachent un mot de passe
//     (bcryptjs, 12 tours, sur un seul cœur) et, en essai, parlent à SMTP ;
//   · 3 000 ms pour les états lourds (notes annexes, TFT, contrôles) ;
//   · 10 000 ms pour un export Excel en flux ; 15 000 ms pour la liasse
//     complète (CLAUDE.md § 8 bis : 48 s pour UN MILLION de lignes, une liasse
//     de petit dossier doit rester sans commune mesure).
// ---------------------------------------------------------------------------
const ETAPES = {
  etat_essai: 1000,
  inscription: 3000,
  inscription_essai: 3000,
  connexion: 3000,
  changer_mdp: 3000,
  me: 1000,
  exercices: 1000,
  journaux: 1000,
  plan_retenu: 1000,
  plan_complet: 2000,
  demarrage: 1000,
  adopter_compte: 1000,
  creer_tiers: 1000,
  saisie_ecriture: 1000,
  brouillard: 1000,
  valider: 1500,
  lettrer: 1000,
  journal: 1000,
  balance: 1000,
  grand_livre: 1500,
  grand_livre_compte: 1000,
  balance_agee: 1500,
  balance_auxiliaire: 1500,
  echeancier: 1500,
  evolution: 1500,
  bilan: 1500,
  resultat: 1500,
  flux: 3000,
  notes: 3000,
  tva: 1500,
  controles: 3000,
  immo_creer: 1500,
  immo_dotation: 1500,
  immo_tableaux: 1500,
  export_journal: 10000,
  export_balance: 10000,
  export_grand_livre: 10000,
  export_liasse: 15000,
  cloisonnement: 1000,
  deconnexion: 1000,
};

const seuils = {
  // Aucune réponse 5xx, aucune coupure : le seuil qui compte avant tous les autres.
  reponses_5xx: ['count==0'],
  http_req_failed: ['rate<0.001'],
  // Les deux défauts qui rendraient le logiciel faux sans qu'il plante.
  fuites_entre_dossiers: ['count==0'],
  incoherences_comptables: ['count==0'],
  // Un refus inattendu (400/403/404 sur un geste normal) = scénario ou serveur défaillant.
  refus_inattendus: ['count==0'],
};
for (const [etape, limite] of Object.entries(ETAPES)) {
  seuils[`http_req_duration{etape:${etape}}`] = [`p(95)<${limite}`];
}

const dureeEtape = {}; // inutile pour k6 ; gardé pour lisibilité des étiquettes
void dureeEtape;

const reponses5xx = new Counter('reponses_5xx');
const fuites = new Counter('fuites_entre_dossiers');
const incoherences = new Counter('incoherences_comptables');
const refusInattendus = new Counter('refus_inattendus');
// Un 409 « trop d'écritures au même instant » est un conflit de sérialisation
// que le serveur n'a pas réussi à rejouer en cinq tentatives. Le message dit
// « veuillez réessayer » : le script réessaie UNE fois après une seconde, comme
// le ferait la personne. `conflits_409` compte les premiers refus,
// `refus_inattendus` ne compte que ce qui résiste à la reprise.
const conflits409 = new Counter('conflits_409');
const cabinetsTermines = new Counter('cabinets_termines');
const sondesLancees = new Counter('sondes_cloisonnement');
const sondesRefusees = new Counter('sondes_refusees');
const ecrituresSaisies = new Counter('ecritures_saisies');
const delaiCourriel = new Trend('delai_courriel_essai', true);
const parcours = new Trend('duree_parcours_cabinet', true);

// ---------------------------------------------------------------------------
// PROFILS
//   fumee    1 cabinet, une fois · prouve que le scénario passe sur un serveur
//            neuf avant de charger quoi que ce soit.
//   nominal  20 cabinets simultanés pendant 5 minutes, temps de réflexion
//            réaliste · c'est « 20 cabinets qui travaillent en même temps ».
//   montee   de 5 à 120 cabinets simultanés par paliers de 2 minutes · on
//            cherche le palier où les seuils cassent, pas à tuer le serveur.
//   stress   pointe brutale à 150 cabinets pendant 90 s puis retour à 5 : le
//            serveur revient-il quand la vague passe (mémoire, pool, files) ?
//   pic      20 cabinets SANS temps de réflexion (THINK=0) : le débit maximal
//            brut, utile pour dimensionner mais PAS réaliste pour du public.
// ---------------------------------------------------------------------------
const scenarios = {
  fumee: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '10m' },
  // Montée en une minute (jamais 20 inscriptions dans la même seconde : c'est le
  // profil `rafale`, mesuré à part), puis palier de cinq minutes.
  nominal: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 20 },
      { duration: '5m', target: 20 },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '2m',
    gracefulStop: '2m',
  },
  montee: {
    executor: 'ramping-vus',
    startVUs: 5,
    stages: [
      { duration: '2m', target: 5 },
      { duration: '2m', target: 20 },
      { duration: '2m', target: 40 },
      { duration: '2m', target: 60 },
      { duration: '2m', target: 80 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 120 },
    ],
    gracefulRampDown: '2m',
    gracefulStop: '3m',
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 5,
    stages: [
      { duration: '1m', target: 5 },
      { duration: '30s', target: 150 },
      { duration: '90s', target: 150 },
      { duration: '30s', target: 5 },
      { duration: '2m', target: 5 },
    ],
    gracefulRampDown: '1m',
    gracefulStop: '3m',
  },
  pic: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 20 },
      { duration: '3m', target: 20 },
    ],
    gracefulRampDown: '2m',
    gracefulStop: '2m',
  },
  // Un palier isolé : VUS cabinets simultanés, montés en trente secondes puis
  // tenus DUREE · c'est le moyen de lire la courbe latence et refus en fonction
  // du nombre de cabinets, un point par lancement, sans mélanger les paliers.
  palier: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: VUS },
      { duration: DUREE, target: VUS },
    ],
    gracefulRampDown: '2m',
    gracefulStop: '2m',
  },
  // N inscriptions dans la MÊME seconde (lancement, courriel de masse, article
  // de presse) · une seule itération par VU, tous partis ensemble.
  rafale: { executor: 'per-vu-iterations', vus: RAFALE, iterations: 1, maxDuration: '5m' },
  // Débit soutenu d'inscriptions, par paliers de 60 s · jusqu'où le serveur
  // suit-il un flux régulier de nouveaux cabinets ?
  inscriptions: {
    executor: 'ramping-arrival-rate',
    startRate: 0,
    timeUnit: '1s',
    preAllocatedVUs: 60,
    maxVUs: 400,
    stages: TAUX.map((t) => ({ duration: '60s', target: t })),
    gracefulStop: '2m',
  },
};

// SONDE · un appel à /health toutes les deux secondes, hors de la charge, qui
// écrit « SONDE <heure> <ms> <statut> » au journal de k6. /health joint la base
// (CLAUDE.md § 5) : elle voit un pool saturé avant n'importe quel écran. C'est
// la série temporelle qui dit si le serveur REVIENT après une pointe, ce que le
// résumé agrégé ne dit pas. SONDE=0 la retire.
function secondes(d) {
  const m = /^(\d+)(s|m|h)$/.exec(String(d));
  return m ? Number(m[1]) * { s: 1, m: 60, h: 3600 }[m[2]] : 0;
}
// La sonde couvre le palier de charge et deux minutes de retour au calme.
function dureeDeLaCharge(sc) {
  if (sc.stages) return sc.stages.reduce((t, e) => t + secondes(e.duration), 0) + 120;
  if (sc.duration) return secondes(sc.duration) + 120;
  return 300;
}
const AVEC_SONDE = (__ENV.SONDE || '1') !== '0' && PROFIL !== 'fumee';
const toutesLesScenes = { [PROFIL]: scenarios[PROFIL] || scenarios.fumee };
if (AVEC_SONDE) {
  toutesLesScenes.sonde = {
    executor: 'constant-arrival-rate',
    rate: 1,
    timeUnit: '2s',
    duration: `${dureeDeLaCharge(toutesLesScenes[PROFIL])}s`,
    preAllocatedVUs: 2,
    maxVUs: 20,
    exec: 'sonde',
    gracefulStop: '0s',
  };
}

export const options = {
  scenarios: toutesLesScenes,
  thresholds: seuils,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
  // Pas de réutilisation de connexion entre cabinets : chaque VU est un poste.
  noConnectionReuse: false,
};

// ---------------------------------------------------------------------------
// OUTILS
// ---------------------------------------------------------------------------
let csrf = '';
let ipDuVu = '198.18.0.1';
let erreursAffichees = 0;

function adresseIp() {
  if (IP === 'unique') return ''; // tous les VU partagent l'adresse du poste de test (NAT)
  const vu = exec.vu.idInTest;
  const it = exec.vu.iterationInScenario;
  // 198.18.0.0/15 est la plage de référence pour les bancs d'essai (RFC 2544).
  return `198.${18 + ((vu >> 8) & 1)}.${vu & 255}.${it & 255}`;
}

function appel(etape, methode, chemin, corps, opts) {
  opts = opts || {};
  const entetes = { Accept: 'application/json' };
  if (ipDuVu) entetes['X-Forwarded-For'] = `${ipDuVu}, 10.0.0.1`; // 2 relais, comme Firebase puis Cloud Run
  if (methode !== 'GET') {
    entetes['Content-Type'] = 'application/json';
    if (csrf) entetes['X-CSRF-Token'] = csrf;
  }
  const res = http.request(methode, BASE + chemin, corps === undefined || corps === null ? null : JSON.stringify(corps), {
    headers: entetes,
    tags: { etape },
    responseType: opts.binaire ? 'binary' : 'text',
    timeout: opts.timeout || '120s',
  });
  if (res.status === 0 || res.status >= 500) {
    reponses5xx.add(1, { etape });
    if (erreursAffichees++ < 15) {
      console.error(`5xx/0 · ${etape} · ${methode} ${chemin.split('?')[0]} → ${res.status} · ${res.error || ''} ${opts.binaire ? '' : String(res.body).slice(0, 200)}`);
    }
  }
  return res;
}

function avecReprise(etape, methode, chemin, corps) {
  let res = appel(etape, methode, chemin, corps);
  if (res.status === 409 && /même instant/.test(String(res.body))) {
    conflits409.add(1, { etape });
    sleep(1);
    res = appel(etape, methode, chemin, corps);
  }
  return res;
}

// Une réponse attendue 2xx ; tout 4xx ici est un refus INATTENDU (le scénario ou le serveur est en défaut).
function attendu(res, etape, libelle) {
  const ok = res.status >= 200 && res.status < 300;
  if (!ok && res.status < 500 && res.status !== 0) {
    refusInattendus.add(1, { etape });
    if (erreursAffichees++ < 15) console.error(`refus inattendu · ${etape} · ${libelle} → ${res.status} ${String(res.body).slice(0, 200)}`);
  }
  return ok;
}

function json(res) {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

function reflechir() {
  if (THINK > 0) sleep(THINK * (0.5 + Math.random()));
}

const pad = (n) => String(n).padStart(2, '0');
const montant = (i) => 50000 + ((i * 7919) % 90000);
const dateDe = (i) => `2026-${pad(3 + (i % 8))}-${pad(1 + ((i * 3) % 27))}`;

export function sonde() {
  const r = http.get(`${BASE}/health`, { tags: { etape: 'sonde' }, timeout: '60s' });
  console.log(`SONDE ${new Date().toISOString().slice(11, 19)} ${Math.round(r.timings.duration)} ${r.status}`);
}

// ---------------------------------------------------------------------------
// PRÉPARATION · un dossier SENTINELLE, créé une fois, que nul cabinet ne doit
// jamais voir ni toucher. Les sondes de cloisonnement le visent ; le teardown
// vérifie qu'il est resté intact.
// ---------------------------------------------------------------------------
export function setup() {
  const email = `sentinelle-${RUN}@charge.test`;
  const marqueur = `SENTINELLE-SECRETE-${RUN}`;
  const entetes = { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.7, 10.0.0.1' };
  const inscription = http.post(
    `${BASE}/auth/register`,
    JSON.stringify({ nomEntite: marqueur, referentiel: 'SYCEBNL', email, motDePasse: MDP }),
    { headers: entetes, tags: { etape: 'setup' } },
  );
  if (inscription.status !== 201) throw new Error(`Impossible d'ouvrir le dossier sentinelle (${inscription.status}) : ${inscription.body}`);
  const reg = inscription.json();
  const lire = (chemin) => {
    const r = http.get(`${BASE}${chemin}`, { headers: { 'X-Forwarded-For': '198.51.100.7, 10.0.0.1', Accept: 'application/json' }, tags: { etape: 'setup' } });
    return r.json();
  };
  const pose = (chemin, corps, methode) =>
    http.request(methode || 'POST', `${BASE}${chemin}`, JSON.stringify(corps), {
      headers: { ...entetes, 'X-CSRF-Token': reg.csrfToken },
      tags: { etape: 'setup' },
    });
  const exercice = reg.exercice;
  const journaux = lire('/journaux');
  const plan = lire('/comptes');
  const compte = (n) => plan.find((c) => c.numero === n);
  const charge = compte('60110000');
  pose(`/comptes/${charge.id}`, { estRetenu: true }, 'PATCH');
  const tiers = pose('/tiers', { type: 'FOURNISSEUR', code: 'S001', nom: marqueur }).json();
  const ach = journaux.find((j) => j.code === 'ACH');
  const ecr = pose('/ecritures', {
    exerciceId: exercice.id,
    journalId: ach.id,
    date: '2026-03-03',
    libelle: marqueur,
    lignes: [
      { compteId: charge.id, debit: 424242 },
      { compteId: tiers.compteIndividuel.id, credit: 424242 },
    ],
  }).json();
  const balance = lire(`/ecritures/balance?exerciceId=${exercice.id}`);
  return {
    email,
    marqueur,
    tenantId: reg.tenant.id,
    exerciceId: exercice.id,
    journalId: ach.id,
    compteChargeId: charge.id,
    compteTiersId: tiers.compteIndividuel.id,
    tiersId: tiers.id,
    ecritureId: ecr.id,
    totauxInitiaux: balance.totaux,
  };
}

// ---------------------------------------------------------------------------
// LE PARCOURS D'UN CABINET
// ---------------------------------------------------------------------------
export default function (sentinelle) {
  const debut = Date.now();
  http.cookieJar().clear(BASE);
  csrf = '';
  ipDuVu = adresseIp();
  const vu = exec.vu.idInTest;
  const it = exec.vu.iterationInScenario;
  const referentiel = REFERENTIEL === 'MIX' ? (vu % 2 === 0 ? 'SYCEBNL' : 'SYSCOHADA') : REFERENTIEL;
  const syscohada = referentiel === 'SYSCOHADA';
  const tag = `K6-${RUN}-${vu}-${it}`;
  const email = `k6-${RUN}-${vu}-${it}@charge.test`.toLowerCase();
  const parEssai = SINK !== '' && Math.random() < ESSAI;

  // ---- 1. Entrée dans le logiciel ---------------------------------------
  group('entrée', () => {
    attendu(appel('etat_essai', 'GET', '/auth/inscription-essai/etat'), 'etat_essai', 'état de l’essai');
    reflechir();
    if (parEssai) {
      const r = appel('inscription_essai', 'POST', '/auth/inscription-essai', { nomEntite: `Cabinet ${tag}`, referentiel, email });
      attendu(r, 'inscription_essai', 'essai');
      // Le mot de passe provisoire ne part que par courriel · on le prend au puits.
      let mot = '';
      const t0 = Date.now();
      for (let k = 0; k < 40 && !mot; k++) {
        const p = http.get(`${SINK}/mot-de-passe?courriel=${encodeURIComponent(email)}`, { tags: { etape: 'puits' } });
        if (p.status === 200) mot = p.body;
        else sleep(0.25);
      }
      delaiCourriel.add(Date.now() - t0);
      if (!mot) {
        refusInattendus.add(1, { etape: 'inscription_essai' });
        console.error(`essai · aucun courriel reçu pour ${email}`);
        sleep(10);
        return;
      }
      const c = appel('connexion', 'POST', '/auth/login', { email, motDePasse: mot });
      attendu(c, 'connexion', 'connexion provisoire');
      csrf = (json(c) || {}).csrfToken || '';
      const ch = appel('changer_mdp', 'POST', '/auth/changer-mot-de-passe', { motDePasseActuel: mot, nouveauMotDePasse: MDP });
      attendu(ch, 'changer_mdp', 'changer le mot de passe');
      csrf = (json(ch) || {}).csrfToken || csrf;
    } else {
      const r = appel('inscription', 'POST', '/auth/register', { nomEntite: `Cabinet ${tag}`, referentiel, email, motDePasse: MDP });
      attendu(r, 'inscription', 'inscription');
      csrf = (json(r) || {}).csrfToken || '';
      if (!csrf) return; // inscription refusée : pas de compte à connecter
      reflechir();
      // Une seconde connexion, comme le lendemain matin : mesure le hachage seul.
      const c = appel('connexion', 'POST', '/auth/login', { email, motDePasse: MDP });
      attendu(c, 'connexion', 'connexion');
      csrf = (json(c) || {}).csrfToken || csrf;
    }
  });
  if (!csrf) {
    refusInattendus.add(1, { etape: 'connexion' });
    // Pas de session : rien d'autre à jouer. Un humain qui voit un échec attend
    // avant de réessayer · sans pause, la boucle martèlerait l'inscription et
    // fabriquerait la panique qu'elle prétend mesurer.
    sleep(10);
    return;
  }

  // ---- 2. Ouverture du dossier : ce que l'écran charge au démarrage -----
  let exerciceId = '';
  let journaux = [];
  let plan = [];
  group('ouverture', () => {
    attendu(appel('me', 'GET', '/auth/me'), 'me', 'me');
    const ex = appel('exercices', 'GET', '/exercices');
    attendu(ex, 'exercices', 'exercices');
    exerciceId = ((json(ex) || [])[0] || {}).id;
    const jr = appel('journaux', 'GET', '/journaux');
    attendu(jr, 'journaux', 'journaux');
    journaux = json(jr) || [];
    attendu(appel('plan_retenu', 'GET', '/comptes?retenus=true'), 'plan_retenu', 'plan retenu');
    const pl = appel('plan_complet', 'GET', '/comptes');
    attendu(pl, 'plan_complet', 'plan complet');
    plan = json(pl) || [];
    attendu(appel('demarrage', 'GET', '/dossier/demarrage'), 'demarrage', 'démarrage guidé');
    reflechir();
  });
  if (!exerciceId || journaux.length === 0 || plan.length === 0) {
    refusInattendus.add(1, { etape: 'ouverture' });
    sleep(10);
    return;
  }
  if (PARCOURS === 'entree') {
    cabinetsTermines.add(1);
    parcours.add(Date.now() - debut);
    return;
  }
  const numero = (n) => plan.find((c) => c.numero === n);
  const journal = (code) => journaux.find((j) => j.code === code);

  // ---- 3. Structure : comptes personnalisés et tiers --------------------
  const chargeN = '60110000';
  const produitN = syscohada ? '70110000' : '70100000';
  const banqueN = '52110000';
  const caisseN = syscohada ? '57110000' : '57100000';
  const tiers = { F: [], C: [] };
  group('structure', () => {
    // Seuls les comptes personnalisés se saisissent (CLAUDE.md § 6, « Comptes retenus »).
    for (const n of [chargeN, produitN, '66110000', '42200000']) {
      const c = numero(n);
      if (!c) {
        refusInattendus.add(1, { etape: 'adopter_compte' });
        console.error(`compte ${n} absent du plan ${referentiel}`);
        continue;
      }
      attendu(appel('adopter_compte', 'PATCH', `/comptes/${c.id}`, { estRetenu: true }), 'adopter_compte', `adopter ${n}`);
    }
    for (let k = 0; k < 2; k++) {
      for (const [type, cle] of [['FOURNISSEUR', 'F'], ['CLIENT', 'C']]) {
        const r = appel('creer_tiers', 'POST', '/tiers', { type, code: `${cle}${k}`, nom: `${type === 'CLIENT' ? 'Client' : 'Fournisseur'} ${k} ${tag}` });
        if (attendu(r, 'creer_tiers', `tiers ${cle}${k}`)) tiers[cle].push((json(r) || {}).compteIndividuel);
      }
    }
    reflechir();
  });
  const comptesOk = [chargeN, produitN, banqueN, caisseN, '66110000', '42200000'].every((n) => numero(n)) && tiers.F.length === 2 && tiers.C.length === 2 && tiers.F.every((t) => t) && tiers.C.every((t) => t);
  if (!comptesOk) {
    refusInattendus.add(1, { etape: 'structure' });
    sleep(10);
    return;
  }

  // ---- 4. Saisie : LOTS × 5 pièces équilibrées --------------------------
  let attenduDebit = 0;
  const idsEcritures = [];
  const paires = []; // [ligneA, ligneB, compteId] à lettrer après validation
  group('saisie', () => {
    const poser = (code, date, libelle, lignes) => {
      const r = avecReprise('saisie_ecriture', 'POST', '/ecritures', { exerciceId, journalId: journal(code).id, date, libelle: `${libelle} ${tag}`, lignes });
      if (!attendu(r, 'saisie_ecriture', `${code} ${libelle}`)) return null;
      const e = json(r) || {};
      idsEcritures.push(e.id);
      ecrituresSaisies.add(1);
      attenduDebit += lignes.reduce((s, l) => s + (l.debit || 0), 0);
      return e;
    };
    const ligneDe = (e, compteId) => (e.lignes || []).find((l) => l.compteId === compteId);
    for (let i = 0; i < LOTS; i++) {
      const m = montant(i);
      const f = tiers.F[i % 2];
      const c = tiers.C[i % 2];
      const d = dateDe(i);
      const achat = poser('ACH', d, `Achat ${i}`, [{ compteId: numero(chargeN).id, debit: m }, { compteId: f.id, credit: m }]);
      const regl = poser('BQ', d, `Règlement fournisseur ${i}`, [{ compteId: f.id, debit: m }, { compteId: numero(banqueN).id, credit: m }]);
      const vente = poser('VEN', d, `Vente ${i}`, [{ compteId: c.id, debit: 2 * m }, { compteId: numero(produitN).id, credit: 2 * m }]);
      const enc = poser('CA', d, `Encaissement client ${i}`, [{ compteId: numero(caisseN).id, debit: 2 * m }, { compteId: c.id, credit: 2 * m }]);
      poser('OD', d, `Paie ${i}`, [{ compteId: numero('66110000').id, debit: 3 * m }, { compteId: numero('42200000').id, credit: 3 * m }]);
      if (achat && regl) paires.push([ligneDe(achat, f.id), ligneDe(regl, f.id), f.id]);
      if (vente && enc) paires.push([ligneDe(vente, c.id), ligneDe(enc, c.id), c.id]);
      if (i % 3 === 2) reflechir();
    }
    attendu(appel('brouillard', 'GET', `/ecritures/brouillard?exerciceId=${exerciceId}`), 'brouillard', 'brouillard');
  });

  // ---- 5. Validation puis lettrage --------------------------------------
  group('validation', () => {
    for (let k = 0; k < idsEcritures.length; k += 25) {
      const lot = idsEcritures.slice(k, k + 25).filter(Boolean);
      const r = avecReprise('valider', 'POST', '/ecritures/valider', { ecritureIds: lot });
      if (attendu(r, 'valider', 'valider un lot')) {
        const v = json(r) || {};
        if (v.validees !== lot.length) {
          incoherences.add(1);
          console.error(`validation partielle : ${v.validees} sur ${lot.length} (${v.motifRefus || ''})`);
        }
      }
    }
    reflechir();
    for (const [a, b, compteId] of paires) {
      if (!a || !b) continue;
      attendu(avecReprise('lettrer', 'POST', `/comptes/${compteId}/lettrage`, { ligneIds: [a.id, b.id] }), 'lettrer', 'lettrage');
    }
    reflechir();
  });

  // ---- 6. Les livres : journal, balance, grand livre --------------------
  group('livres', () => {
    attendu(appel('journal', 'GET', `/ecritures?exerciceId=${exerciceId}&limite=200`), 'journal', 'journal');
    const bal = appel('balance', 'GET', `/ecritures/balance?exerciceId=${exerciceId}`);
    if (attendu(bal, 'balance', 'balance')) {
      const t = (json(bal) || {}).totaux || {};
      // La balance DOIT boucler, et reprendre à l'unité près ce qui vient d'être saisi.
      if (!(Math.abs(Number(t.debit) - Number(t.credit)) < 0.005) || Math.abs(Number(t.debit) - attenduDebit) > 0.005) {
        incoherences.add(1);
        console.error(`balance fausse · débit ${t.debit} crédit ${t.credit} attendu ${attenduDebit}`);
      }
    }
    attendu(appel('grand_livre', 'GET', `/ecritures/grand-livre?exerciceId=${exerciceId}`), 'grand_livre', 'grand livre');
    attendu(appel('grand_livre_compte', 'GET', `/ecritures/grand-livre/${numero(chargeN).id}?exerciceId=${exerciceId}`), 'grand_livre_compte', 'grand livre d’un compte');
    attendu(appel('balance_agee', 'GET', `/ecritures/balance-agee?exerciceId=${exerciceId}`), 'balance_agee', 'balance âgée');
    attendu(appel('balance_auxiliaire', 'GET', `/ecritures/balance-auxiliaire?exerciceId=${exerciceId}`), 'balance_auxiliaire', 'balance auxiliaire');
    attendu(appel('echeancier', 'GET', `/ecritures/echeancier?exerciceId=${exerciceId}`), 'echeancier', 'échéancier');
    attendu(appel('evolution', 'GET', `/ecritures/evolution-soldes?exerciceId=${exerciceId}`), 'evolution', 'évolution des soldes');
    // Chaque lettrage a bien été posé : le compte du fournisseur ne montre plus rien d'ouvert.
    const ouvert = appel('journal', 'GET', `/comptes/${tiers.F[0].id}/lettrage?nonLettreesSeulement=true`);
    if (attendu(ouvert, 'journal', 'lignes ouvertes du fournisseur')) {
      const lignes = (json(ouvert) || {}).lignes || [];
      if (lignes.length > 0) {
        incoherences.add(1);
        console.error(`lettrage incomplet : ${lignes.length} ligne(s) ouverte(s) sur le fournisseur 0`);
      }
    }
    reflechir();
  });

  // ---- 7. États financiers, notes annexes, TVA, contrôles ---------------
  group('états', () => {
    const base = syscohada ? '/etats-financiers-syscohada' : '/etats-financiers';
    const bilan = appel('bilan', 'GET', `${base}/bilan?exerciceId=${exerciceId}`);
    if (attendu(bilan, 'bilan', 'bilan')) {
      const b = json(bilan) || {};
      if (b.equilibre === false || Math.abs(Number(b.totalActif) - Number(b.totalPassif)) > 0.005) {
        incoherences.add(1);
        console.error(`bilan non équilibré · actif ${b.totalActif} passif ${b.totalPassif}`);
      }
    }
    attendu(appel('resultat', 'GET', `${base}/compte-de-resultat?exerciceId=${exerciceId}`), 'resultat', 'compte de résultat');
    attendu(appel('flux', 'GET', `${base}/tableau-flux-tresorerie?exerciceId=${exerciceId}`), 'flux', 'tableau des flux');
    attendu(appel('notes', 'GET', syscohada ? `${base}/notes?exerciceId=${exerciceId}` : `/notes-annexes/associations?exerciceId=${exerciceId}`), 'notes', 'notes annexes');
    attendu(appel('tva', 'GET', '/taux-tva/declaration?dateDebut=2026-01-01&dateFin=2026-12-31'), 'tva', 'déclaration de TVA');
    attendu(appel('controles', 'GET', `/controles?exerciceId=${exerciceId}`), 'controles', 'contrôles');
    // Tableau de bord : ce que l'accueil lit (DashboardPage.tsx).
    attendu(appel('journal', 'GET', `/ecritures?exerciceId=${exerciceId}&limite=8`), 'journal', 'tableau de bord · dernières écritures');
    attendu(appel('balance', 'GET', `/ecritures/balance?exerciceId=${exerciceId}`), 'balance', 'tableau de bord · balance');
    reflechir();
  });

  // ---- 8. Immobilisation et dotation ------------------------------------
  group('immobilisations', () => {
    const fam = appel('immo_tableaux', 'GET', '/immobilisations/familles');
    const familles = json(fam) || [];
    const famille = familles.find((f) => f.code === 'INFORMATIQUE') || familles[0];
    if (!attendu(fam, 'immo_tableaux', 'familles') || !famille) return;
    const ctp = appel('immo_tableaux', 'GET', `/immobilisations/contreparties-acquisition?familleId=${famille.id}`);
    const contreparties = json(ctp) || [];
    const contre = contreparties.find((c) => /^5[27]/.test(c.numero)) || contreparties[0];
    if (!contre) return;
    const bien = avecReprise('immo_creer', 'POST', '/immobilisations', {
      familleId: famille.id,
      designation: `Ordinateur ${tag}`,
      dateAcquisition: '2026-03-01',
      dateMiseEnService: '2026-03-01',
      valeurOrigine: 1200000,
      exerciceId,
      journalId: journal('BQ').id,
      compteContrepartieId: contre.id,
    });
    if (!attendu(bien, 'immo_creer', 'immobilisation')) return;
    const idBien = (json(bien) || {}).id;
    attendu(avecReprise('immo_dotation', 'POST', `/immobilisations/${idBien}/dotation`, { exerciceId, journalId: journal('OD').id }), 'immo_dotation', 'dotation');
    attendu(appel('immo_tableaux', 'GET', `/immobilisations/tableau?exerciceId=${exerciceId}`), 'immo_tableaux', 'tableau des immobilisations');
    attendu(appel('immo_tableaux', 'GET', `/immobilisations/tableau-amortissements?exerciceId=${exerciceId}`), 'immo_tableaux', 'tableau des amortissements');
    // Après l'acquisition et la dotation, la balance boucle encore.
    const bal = appel('balance', 'GET', `/ecritures/balance?exerciceId=${exerciceId}`);
    if (attendu(bal, 'balance', 'balance après immobilisation')) {
      const t = (json(bal) || {}).totaux || {};
      if (!(Math.abs(Number(t.debit) - Number(t.credit)) < 0.005) || Number(t.debit) < attenduDebit) {
        incoherences.add(1);
        console.error(`balance fausse après immobilisation · débit ${t.debit} crédit ${t.credit}`);
      }
    }
    reflechir();
  });

  // ---- 9. Exports Excel en flux ----------------------------------------
  group('exports', () => {
    const xlsx = (etape, chemin) => {
      const r = appel(etape, 'GET', chemin, null, { binaire: true });
      const ok = attendu(r, etape, chemin.split('?')[0]);
      // Un classeur .xlsx est un ZIP : il commence par « PK ». Une réponse tronquée ne le ferait pas.
      if (ok && !(r.body && r.body.byteLength > 1000 && new Uint8Array(r.body, 0, 2)[0] === 0x50 && new Uint8Array(r.body, 0, 2)[1] === 0x4b)) {
        incoherences.add(1);
        console.error(`export illisible · ${chemin.split('?')[0]} · ${r.body ? r.body.byteLength : 0} octets`);
      }
    };
    xlsx('export_journal', `/exports/journal?exerciceId=${exerciceId}`);
    xlsx('export_balance', `/exports/balance?exerciceId=${exerciceId}`);
    xlsx('export_grand_livre', `/exports/grand-livre?exerciceId=${exerciceId}`);
    if (LIASSE) xlsx('export_liasse', syscohada ? `/exports/etats-financiers-syscohada/liasse-complete?exerciceId=${exerciceId}` : `/exports/etats-financiers/liasse-complete?exerciceId=${exerciceId}`);
  });

  // ---- 10. Sondes de cloisonnement --------------------------------------
  group('cloisonnement', () => {
    const baseSync = syscohada ? '/etats-financiers-syscohada' : '/etats-financiers';
    const lectures = [
      `/ecritures?exerciceId=${sentinelle.exerciceId}`,
      `/ecritures/balance?exerciceId=${sentinelle.exerciceId}`,
      `/ecritures/grand-livre?exerciceId=${sentinelle.exerciceId}`,
      `/ecritures/grand-livre/${sentinelle.compteChargeId}?exerciceId=${sentinelle.exerciceId}`,
      `/ecritures/brouillard?exerciceId=${sentinelle.exerciceId}`,
      `/tiers/${sentinelle.tiersId}`,
      `/comptes/${sentinelle.compteTiersId}/lettrage`,
      `${baseSync}/bilan?exerciceId=${sentinelle.exerciceId}`,
      `/immobilisations/tableau?exerciceId=${sentinelle.exerciceId}`,
    ];
    const fuite = (res, quoi) => {
      const corps = String(res.body || '');
      if (corps.includes(sentinelle.marqueur) || corps.includes(sentinelle.tenantId)) {
        fuites.add(1);
        console.error(`FUITE · ${quoi} → ${res.status} montre le dossier sentinelle`);
      }
    };
    for (const chemin of lectures) {
      const r = appel('cloisonnement', 'GET', chemin);
      sondesLancees.add(1);
      if (r.status >= 400 && r.status < 500) sondesRefusees.add(1);
      fuite(r, `GET ${chemin.split('?')[0]}`);
    }
    const xl = appel('cloisonnement', 'GET', `/exports/balance?exerciceId=${sentinelle.exerciceId}`, null, { binaire: true });
    sondesLancees.add(1);
    if (xl.status >= 400 && xl.status < 500) sondesRefusees.add(1);
    if (xl.status === 200) {
      fuites.add(1);
      console.error('FUITE · export de la balance du dossier sentinelle servi');
    }
    // Les écritures : un cabinet ne passe, ne valide, ne modifie rien chez un autre.
    const ecritures = [
      ['POST', '/ecritures', { exerciceId: sentinelle.exerciceId, journalId: sentinelle.journalId, date: '2026-04-01', libelle: 'INTRUSION', lignes: [{ compteId: sentinelle.compteChargeId, debit: 1 }, { compteId: sentinelle.compteTiersId, credit: 1 }] }],
      ['POST', '/ecritures', { exerciceId, journalId: journal('ACH').id, date: '2026-04-01', libelle: 'INTRUSION', lignes: [{ compteId: sentinelle.compteChargeId, debit: 1 }, { compteId: sentinelle.compteTiersId, credit: 1 }] }],
      ['POST', '/ecritures/valider', { ecritureIds: [sentinelle.ecritureId] }],
      ['PATCH', `/comptes/${sentinelle.compteChargeId}`, { estRetenu: false, intitule: 'INTRUSION' }],
      ['DELETE', `/tiers/${sentinelle.tiersId}`, null],
      ['POST', `/comptes/${sentinelle.compteTiersId}/lettrage`, { ligneIds: [sentinelle.ecritureId, sentinelle.ecritureId] }],
    ];
    for (const [methode, chemin, corps] of ecritures) {
      const r = appel('cloisonnement', methode, chemin, corps);
      sondesLancees.add(1);
      if (r.status >= 400 && r.status < 500) sondesRefusees.add(1);
      if (r.status >= 200 && r.status < 300) {
        fuites.add(1);
        console.error(`FUITE · ${methode} ${chemin.split('?')[0]} accepté (${r.status}) sur le dossier sentinelle`);
      }
      fuite(r, `${methode} ${chemin.split('?')[0]}`);
    }
    // Dans l'autre sens : ses propres listes ne montrent que son dossier.
    const mesTiers = appel('cloisonnement', 'GET', '/tiers');
    const liste = json(mesTiers) || [];
    if (liste.length !== 4 || !liste.every((t) => String(t.nom).includes(tag))) {
      fuites.add(1);
      console.error(`FUITE · /tiers rend ${liste.length} tiers dont certains ne sont pas à ce cabinet`);
    }
    const mesEcritures = appel('cloisonnement', 'GET', `/ecritures?exerciceId=${exerciceId}&limite=500`);
    const lesEcritures = (json(mesEcritures) || {}).ecritures || [];
    if (lesEcritures.some((e) => !String(e.libelle).includes(tag) && !String(e.libelle).includes('Ordinateur') && !/amort|dotation/i.test(String(e.libelle)))) {
      fuites.add(1);
      console.error('FUITE · le journal contient une écriture qui n’est pas de ce cabinet');
    }
  });

  group('sortie', () => {
    attendu(appel('deconnexion', 'POST', '/auth/logout', {}), 'deconnexion', 'déconnexion');
  });
  cabinetsTermines.add(1);
  parcours.add(Date.now() - debut);
}

// ---------------------------------------------------------------------------
// ÉPILOGUE · le dossier sentinelle est resté tel qu'il était.
// ---------------------------------------------------------------------------
export function teardown(sentinelle) {
  const entetes = { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.8, 10.0.0.1' };
  const c = http.post(`${BASE}/auth/login`, JSON.stringify({ email: sentinelle.email, motDePasse: MDP }), { headers: entetes, tags: { etape: 'epilogue' } });
  if (c.status !== 201) {
    console.error(`ÉPILOGUE · connexion sentinelle impossible (${c.status})`);
    fuites.add(1);
    return;
  }
  const lire = (chemin) => http.get(`${BASE}${chemin}`, { headers: entetes, tags: { etape: 'epilogue' } }).json();
  const balance = lire(`/ecritures/balance?exerciceId=${sentinelle.exerciceId}`);
  const journal = lire(`/ecritures?exerciceId=${sentinelle.exerciceId}`);
  const tiers = lire('/tiers');
  const intact =
    Number(balance.totaux.debit) === Number(sentinelle.totauxInitiaux.debit) &&
    Number(balance.totaux.credit) === Number(sentinelle.totauxInitiaux.credit) &&
    journal.total === 1 &&
    tiers.length === 1;
  console.log(`ÉPILOGUE · dossier sentinelle ${intact ? 'INTACT' : 'ALTÉRÉ'} · balance ${balance.totaux.debit}/${balance.totaux.credit}, ${journal.total} écriture(s), ${tiers.length} tiers`);
  if (!intact) fuites.add(1);
}
