#!/usr/bin/env node
'use strict';
/**
 * REJEU DES CINQ ATTAQUES CLASSIQUES CONTRE LA PORTE D'ENTRÉE (2026-11-19,
 * demande de Manasse · « Fais les 2 », après la liste des cinq façons
 * d'ouvrir une page de connexion).
 *
 * Les protections sont décrites au CLAUDE.md § 8 et tenues par des tests
 * unitaires, qui tournent sur des Prisma factices. Ce script les éprouve sur
 * le SERVEUR COMPILÉ, par HTTP, contre une base PostgreSQL JETABLE (jamais
 * celle de production), comme le ferait un intrus :
 *
 *   1. il essaie encore et encore · le compte se ferme, et le débit par
 *      adresse est borné ;
 *   2. il écoute ce que la page répond · une seule phrase pour l'adresse
 *      inconnue, le mot de passe faux et le compte fermé ; la DURÉE est
 *      mesurée et dite (un écart résiduel est connu, auth.service.ts) ;
 *   3. il contourne le contrôle · sans session, sans jeton CSRF, avec le
 *      mot de passe provisoire, avec un rôle trop faible, et dans le dossier
 *      d'un autre cabinet ;
 *   4. il vole la base · aucun mot de passe en clair, nulle part dans
 *      l'export complet de la base ;
 *   5. il garde la porte ouverte · durée de la session, déconnexion,
 *      changement de mot de passe et désactivation du compte ferment la
 *      session sur le serveur.
 *
 * Usage · DATABASE_URL pointe une base jetable DÉJÀ migrée, le serveur est
 * compilé (`npm run build`), `pg_dump` est sur le chemin.
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-attaques-connexion.cjs
 *
 * Sort en code 0 si tout est prouvé, 1 sinon, avec ce qui ne l'est pas.
 */
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const RACINE = join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE) {
  console.error('DATABASE_URL est requis (une base JETABLE, déjà migrée).');
  process.exit(2);
}
if (/neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('Cette base ressemble à une base hébergée · ce script ne tourne que contre une base jetable locale.');
  process.exit(2);
}
const PORT = Number(process.env.PORT_REJEU || 8097);
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-Rejeu-Attaques-2026!';
const MDP_FAUX = 'Pas-le-bon-mot-de-passe-42';
const UNIQUE = Date.now();

const nonProuve = [];
const prouve = [];
function constat(condition, message) {
  (condition ? prouve : nonProuve).push(message);
  console.log(`${condition ? '  ok ' : '  KO '} ${message}`);
}

/** Une adresse cliente par geste · la limite par adresse ne doit pas fausser les autres épreuves. */
let compteurIp = 0;
const nouvelleIp = () => `10.77.${Math.floor(++compteurIp / 250)}.${(compteurIp % 250) + 1}`;

async function appel(methode, chemin, { corps, cookie, csrf, ip = nouvelleIp() } = {}) {
  const entetes = { 'X-Forwarded-For': ip };
  if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  if (cookie) entetes.cookie = cookie;
  if (csrf) entetes['x-csrf-token'] = csrf;
  const debut = process.hrtime.bigint();
  const r = await fetch(API + chemin, { method: methode, headers: entetes, body: corps === undefined ? undefined : JSON.stringify(corps) });
  const ms = Number(process.hrtime.bigint() - debut) / 1e6;
  const texte = await r.text();
  let json = null;
  try { json = JSON.parse(texte); } catch { /* corps non JSON */ }
  const poses = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  return { statut: r.status, json, ms, poses };
}

function cookieDe(poses) {
  const s = poses.find((c) => c.startsWith('__session='));
  return s ? s.split(';')[0] : null;
}

async function inscrire(email, nom) {
  const r = await appel('POST', '/auth/register', {
    corps: { nomEntite: nom, referentiel: 'SYCEBNL', email, motDePasse: MDP, jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' },
  });
  if (r.statut !== 201) throw new Error(`Inscription refusée (${r.statut}) · ${JSON.stringify(r.json)}`);
}

async function connecter(email, motDePasse = MDP, extra = {}) {
  const r = await appel('POST', '/auth/login', { corps: { email, motDePasse, ...extra } });
  return { ...r, cookie: cookieDe(r.poses), csrf: r.json?.csrfToken ?? null };
}

const mediane = (t) => { const s = [...t].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

function demarrerServeur() {
  const dist = process.env.OMEGAX_DIST || join(RACINE, 'dist');
  const point = [join(dist, 'main.js'), join(dist, 'src', 'main.js')].find((p) => existsSync(p));
  if (!point) throw new Error(`Serveur compilé introuvable sous ${dist} · lancer npm run build.`);
  const enfant = spawn(process.execPath, [point], {
    cwd: RACINE,
    env: {
      PATH: process.env.PATH,
      DATABASE_URL: URL_BASE,
      JWT_SECRET: `rejeu-jetable-0123456789abcdef-${UNIQUE}`,
      PORT: String(PORT),
      INSCRIPTION_PUBLIQUE: 'true',
      CORS_ORIGIN: 'http://localhost:4173',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let journal = '';
  enfant.stdout.on('data', (d) => { journal += d; });
  enfant.stderr.on('data', (d) => { journal += d; });
  return { enfant, journal: () => journal };
}

async function attendreSante() {
  for (let i = 0; i < 120; i += 1) {
    try { if ((await fetch(`${API}/health`)).status === 200) return; } catch { /* pas encore */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Le serveur ne répond pas sur /health.');
}

async function principal() {
  const serveur = demarrerServeur();
  try {
    await attendreSante();
    const emailA = `attaque-a-${UNIQUE}@exemple.invalid`;
    const emailB = `attaque-b-${UNIQUE}@exemple.invalid`;
    const emailsTemps = [1, 2, 3, 4].map((k) => `attaque-t${k}-${UNIQUE}@exemple.invalid`);
    await inscrire(emailA, 'Cabinet A (rejeu attaques)');
    await inscrire(emailB, 'Cabinet B (rejeu attaques)');
    for (const [k, e] of emailsTemps.entries()) await inscrire(e, `Cabinet T${k + 1} (rejeu attaques)`);

    // ── 1. FORCE BRUTE ─────────────────────────────────────────────────────
    console.log('\n1. Il essaie encore et encore');
    const victime = `attaque-v-${UNIQUE}@exemple.invalid`;
    await inscrire(victime, 'Cabinet V (rejeu attaques)');
    let refus = 0;
    for (let i = 0; i < 6; i += 1) if ((await connecter(victime, MDP_FAUX)).statut === 401) refus += 1;
    constat(refus === 6, `six mots de passe faux, six refus (${refus})`);
    const bonPendantVerrou = await connecter(victime, MDP);
    constat(bonPendantVerrou.statut === 401 && !bonPendantVerrou.cookie, `le BON mot de passe est refusé tant que le compte est fermé (${bonPendantVerrou.statut})`);
    // Débit par adresse · vingt connexions par minute, toutes adresses inconnues.
    const ipFixe = '10.99.99.99';
    const statuts = [];
    for (let i = 0; i < 22; i += 1) {
      statuts.push((await appel('POST', '/auth/login', { corps: { email: `inconnu-${i}-${UNIQUE}@exemple.invalid`, motDePasse: MDP_FAUX }, ip: ipFixe })).statut);
    }
    constat(statuts.includes(429), `une même adresse est freinée après une vingtaine d'essais par minute (premier 429 au ${statuts.indexOf(429) + 1}e)`);

    // ── 2. ÉNUMÉRATION ─────────────────────────────────────────────────────
    console.log('\n2. Il écoute ce que la page répond');
    const inconnu = await connecter(`personne-${UNIQUE}@exemple.invalid`, MDP_FAUX);
    const faux = await connecter(emailsTemps[0], MDP_FAUX);
    const ferme = await connecter(victime, MDP_FAUX);
    const msg = (r) => JSON.stringify(r.json?.message ?? r.json);
    constat(
      inconnu.statut === 401 && faux.statut === 401 && ferme.statut === 401,
      `adresse inconnue, mot de passe faux, compte fermé · même code (${inconnu.statut}, ${faux.statut}, ${ferme.statut})`,
    );
    constat(msg(inconnu) === msg(faux) && msg(faux) === msg(ferme), 'adresse inconnue, mot de passe faux, compte fermé · même phrase, mot pour mot');
    // La durée · trois essais faux par compte connu (sous le seuil du verrou),
    // autant d'adresses inconnues, en alternance pour que le serveur chauffe pareil.
    const tConnu = [];
    const tInconnu = [];
    for (let tour = 0; tour < 3; tour += 1) {
      for (const e of emailsTemps.slice(1)) {
        tConnu.push((await connecter(e, MDP_FAUX)).ms);
        tInconnu.push((await connecter(`absent-${tour}-${e}`, MDP_FAUX)).ms);
      }
    }
    const ecart = mediane(tConnu) - mediane(tInconnu);
    console.log(`     durée médiane · compte existant ${mediane(tConnu).toFixed(0)} ms, adresse inconnue ${mediane(tInconnu).toFixed(0)} ms, écart ${ecart.toFixed(0)} ms`);
    constat(Math.abs(ecart) < mediane(tInconnu) * 0.5, `l'écart de durée reste petit devant le coût du hachage (${ecart.toFixed(0)} ms) · écart CONNU et documenté, non nul`);

    // ── 3. CONTOURNEMENT ───────────────────────────────────────────────────
    console.log('\n3. Il contourne le contrôle');
    for (const chemin of ['/exercices', '/comptes', '/journaux', '/utilisateurs', '/tiers', '/journal-audit']) {
      const r = await appel('GET', chemin);
      constat(r.statut === 401, `sans session, ${chemin} est refusé par le serveur (${r.statut})`);
    }
    const a = await connecter(emailA);
    const b = await connecter(emailB);
    constat(Boolean(a.cookie && a.csrf && b.cookie), 'les deux cabinets ouvrent leur session');
    const sansCsrf = await appel('POST', '/exercices', { corps: { dateDebut: '2031-01-01', dateFin: '2031-12-31' }, cookie: a.cookie });
    constat(sansCsrf.statut === 403, `une écriture sans jeton CSRF est refusée (${sansCsrf.statut})`);
    const exB = await appel('GET', '/exercices', { cookie: b.cookie });
    const exerciceB = exB.json?.[0]?.id;
    constat(Boolean(exerciceB), 'le cabinet B a un exercice');
    const intrusion = await appel('GET', `/ecritures?exerciceId=${exerciceB}`, { cookie: a.cookie });
    constat(intrusion.statut === 404 || intrusion.statut === 403, `A ne lit pas les écritures de l'exercice de B (${intrusion.statut})`);
    const comptesB = await appel('GET', '/comptes', { cookie: b.cookie });
    const compteB = (comptesB.json?.comptes ?? comptesB.json ?? [])[0]?.id;
    if (compteB) {
      const modif = await appel('PATCH', `/comptes/${compteB}`, { corps: { estRetenu: true }, cookie: a.cookie, csrf: a.csrf });
      constat(modif.statut === 404 || modif.statut === 403, `A ne modifie pas un compte de B (${modif.statut})`);
    }
    // Rôle trop faible, et mot de passe provisoire.
    const emailLecteur = `attaque-lecteur-${UNIQUE}@exemple.invalid`;
    const MDP_PROVISOIRE = 'Provisoire-Rejeu-2026';
    const cree = await appel('POST', '/utilisateurs', { corps: { email: emailLecteur, motDePasse: MDP_PROVISOIRE, role: 'LECTURE_SEULE' }, cookie: a.cookie, csrf: a.csrf });
    constat(cree.statut === 201, `l'administrateur de A crée un collaborateur en lecture seule (${cree.statut})`);
    let lecteur = await connecter(emailLecteur, MDP_PROVISOIRE);
    const avantChangement = await appel('GET', '/exercices', { cookie: lecteur.cookie });
    constat(avantChangement.statut === 403, `avec le mot de passe provisoire, le dossier reste fermé (${avantChangement.statut})`);
    const NOUVEAU = 'Lecteur-Rejeu-Nouveau-2026!';
    const change = await appel('POST', '/auth/changer-mot-de-passe', {
      corps: { motDePasseActuel: MDP_PROVISOIRE, nouveauMotDePasse: NOUVEAU }, cookie: lecteur.cookie, csrf: lecteur.csrf,
    });
    constat(change.statut === 201 || change.statut === 200, `le collaborateur remplace son mot de passe provisoire (${change.statut})`);
    lecteur = await connecter(emailLecteur, NOUVEAU);
    const ecritureRefusee = await appel('POST', '/exercices', { corps: { dateDebut: '2031-01-01', dateFin: '2031-12-31' }, cookie: lecteur.cookie, csrf: lecteur.csrf });
    constat(ecritureRefusee.statut === 403, `en lecture seule, le serveur refuse d'écrire (${ecritureRefusee.statut})`);
    const gestionRefusee = await appel('GET', '/utilisateurs', { cookie: lecteur.cookie });
    constat(gestionRefusee.statut === 403, `en lecture seule, la liste des utilisateurs est refusée (${gestionRefusee.statut})`);

    // ── 4. VOL DE LA BASE ──────────────────────────────────────────────────
    console.log('\n4. Il vole la base');
    const export_ = execFileSync('pg_dump', ['--data-only', URL_BASE], { maxBuffer: 1024 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
    const motsDePasse = [MDP, MDP_FAUX, MDP_PROVISOIRE, NOUVEAU];
    const enClair = motsDePasse.filter((m) => export_.includes(m));
    constat(enClair.length === 0, `aucun des ${motsDePasse.length} mots de passe utilisés n'apparaît dans l'export complet de la base (${enClair.length} trouvé)`);
    const empreintes = execFileSync('psql', [URL_BASE, '-tAc', 'select "motDePasse" from users'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    constat(empreintes.length > 0 && empreintes.every((e) => /^\$2[aby]\$12\$.{53}$/.test(e)), `les ${empreintes.length} mots de passe sont des empreintes bcrypt à 12 tours`);

    // ── 5. PORTE LAISSÉE OUVERTE ───────────────────────────────────────────
    console.log('\n5. Il garde la porte ouverte');
    const courte = await connecter(emailA);
    const pose = courte.poses.find((c) => c.startsWith('__session=')) ?? '';
    constat(!/max-age|expires/i.test(pose), 'sans « Rester connecté », le cookie meurt avec le navigateur (aucune date posée)');
    constat(/httponly/i.test(pose), 'le cookie de session est hors de portée du JavaScript (HttpOnly)');
    const charge = JSON.parse(Buffer.from(courte.cookie.split('=')[1].split('.')[1], 'base64url').toString());
    constat(charge.exp - charge.iat === 8 * 3600, `le jeton expire au bout de ${(charge.exp - charge.iat) / 3600} heures`);
    const longue = await connecter(emailA, MDP, { resterConnecte: true });
    const poseLongue = longue.poses.find((c) => c.startsWith('__session=')) ?? '';
    const maxAge = Number(/max-age=(\d+)/i.exec(poseLongue)?.[1] ?? NaN);
    constat(maxAge > 0 && maxAge <= 30 * 86400, `« Rester connecté » · cookie borné à ${(maxAge / 86400).toFixed(1)} jours (trente au plus)`);
    // Déconnexion · la copie du cookie prise avant ne rouvre rien.
    const copie = courte.cookie;
    const sortie = await appel('POST', '/auth/logout', { cookie: copie, csrf: courte.csrf });
    constat(sortie.json?.sessionFermee === true, 'la déconnexion ferme la session sur le serveur');
    constat((await appel('GET', '/exercices', { cookie: copie })).statut === 401, 'une copie du cookie prise avant la déconnexion est refusée');
    // Changement de mot de passe · les autres sessions tombent.
    const ailleurs = await connecter(emailLecteur, NOUVEAU);
    const ici = await connecter(emailLecteur, NOUVEAU);
    await new Promise((r) => setTimeout(r, 1100)); // la révocation tronque à la seconde
    const AUTRE = 'Lecteur-Rejeu-Encore-2026!';
    const c2 = await appel('POST', '/auth/changer-mot-de-passe', { corps: { motDePasseActuel: NOUVEAU, nouveauMotDePasse: AUTRE }, cookie: ici.cookie, csrf: ici.csrf });
    constat(c2.statut === 201 || c2.statut === 200, `le collaborateur change son mot de passe (${c2.statut})`);
    constat((await appel('GET', '/exercices', { cookie: ailleurs.cookie })).statut === 401, "la session ouverte ailleurs avant le changement est refusée");
    // Désactivation du compte par l'administrateur.
    const actif = await connecter(emailLecteur, AUTRE);
    constat((await appel('GET', '/exercices', { cookie: actif.cookie })).statut === 200, 'le collaborateur lit son dossier avant la désactivation');
    await new Promise((r) => setTimeout(r, 1100));
    const aDeNouveau = await connecter(emailA);
    const desactive = await appel('PATCH', `/utilisateurs/${cree.json?.id}`, { corps: { estActif: false }, cookie: aDeNouveau.cookie, csrf: aDeNouveau.csrf });
    constat(desactive.statut === 200, `l'administrateur désactive le collaborateur (${desactive.statut})`);
    constat((await appel('GET', '/exercices', { cookie: actif.cookie })).statut === 401, 'la session du collaborateur désactivé est refusée aussitôt');
    constat((await connecter(emailLecteur, AUTRE)).statut === 401, 'le collaborateur désactivé ne peut plus se connecter');
  } finally {
    serveur.enfant.kill('SIGTERM');
  }
  console.log(`\n${prouve.length} prouvé(s), ${nonProuve.length} non prouvé(s).`);
  if (nonProuve.length) {
    console.log('NON PROUVÉ :');
    for (const m of nonProuve) console.log(`  - ${m}`);
    process.exit(1);
  }
}

principal().catch((e) => {
  console.error(`Rejeu interrompu · ${e.message}`);
  process.exit(1);
});
