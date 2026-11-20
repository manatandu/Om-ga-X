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
 * Et les cinq corrections de l'audit de sécurité du 2026-11-19, sur un
 * SECOND serveur compilé, relié à une boîte SMTP de poche (rien ne sort) :
 *
 *   6. un inconnu ne tient plus un compte fermé · le titulaire entre avec un
 *      code de secours, ou rouvre par le lien reçu à son adresse, et la
 *      réponse au bon mot de passe reste celle d'un mot de passe faux ;
 *   7. la limite d'essais compte par adresse e-mail · une même adresse est
 *      freinée malgré des adresses IP toutes différentes ; au-delà, un mot de
 *      passe faux reste en 429, le BON mot de passe d'un compte fermé reçoit
 *      le même 429 (et son lien part), et une fois le verrou échu le
 *      titulaire entre sur un appareil JAMAIS reconnu (relecture du
 *      2026-11-20, C) ; l'appareil reconnu passe aussi ;
 *   6 bis. le code de la double authentification pendant le verrou · un code
 *      faux avec le bon mot de passe fait partir le lien, et après cinq codes
 *      faux même le bon code n'est plus jugé (relecture du 2026-11-20, A) ;
 *   8. le mot de passe actuel faux d'un geste authentifié finit par fermer
 *      le geste, la session restant ouverte ;
 *   9. le serveur refuse de démarrer en production avec un secret court ;
 *  10. une déconnexion postée en formulaire est refusée (415).
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
const net = require('node:net');
const { createHmac } = require('node:crypto');

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
const PORT_MESSAGERIE = PORT + 1;
const PORT_REFUS = PORT + 2;
const PORT_SMTP = Number(process.env.PORT_SMTP_REJEU || 2531);
let API = `http://127.0.0.1:${PORT}`;
const SECRET_JETABLE = `rejeu-jetable-0123456789abcdef-${Date.now()}`;
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

async function appel(methode, chemin, { corps, cookie, csrf, ip = nouvelleIp(), type, brut } = {}) {
  const entetes = { 'X-Forwarded-For': ip };
  if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  if (type) entetes['Content-Type'] = type;
  if (cookie) entetes.cookie = cookie;
  if (csrf) entetes['x-csrf-token'] = csrf;
  const debut = process.hrtime.bigint();
  const r = await fetch(API + chemin, { method: methode, headers: entetes, body: brut !== undefined ? brut : corps === undefined ? undefined : JSON.stringify(corps) });
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

async function connecter(email, motDePasse = MDP, extra = {}, ip) {
  const r = await appel('POST', '/auth/login', { corps: { email, motDePasse, ...extra }, ...(ip ? { ip } : {}) });
  return { ...r, cookie: cookieDe(r.poses), csrf: r.json?.csrfToken ?? null };
}

const mediane = (t) => { const s = [...t].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

function demarrerServeur({ port = PORT, secret = SECRET_JETABLE, messagerie = false, production = false } = {}) {
  const dist = process.env.OMEGAX_DIST || join(RACINE, 'dist');
  const point = [join(dist, 'main.js'), join(dist, 'src', 'main.js')].find((p) => existsSync(p));
  if (!point) throw new Error(`Serveur compilé introuvable sous ${dist} · lancer npm run build.`);
  const enfant = spawn(process.execPath, [point], {
    cwd: RACINE,
    env: {
      PATH: process.env.PATH,
      DATABASE_URL: URL_BASE,
      JWT_SECRET: secret,
      PORT: String(port),
      INSCRIPTION_PUBLIQUE: 'true',
      CORS_ORIGIN: 'http://localhost:4173',
      ...(production ? { NODE_ENV: 'production' } : {}),
      ...(messagerie
        ? { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(PORT_SMTP), SMTP_USER: 'rejeu', SMTP_PASS: 'rejeu', SMTP_SECURE: 'false', COURRIER_EXPEDITEUR: 'rejeu@exemple.invalid' }
        : {}),
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


// ---------------------------------------------------------------------------
// Une boîte SMTP de poche (même forme que rejouer-suppression-essais.cjs) ·
// reçoit les courriels du second serveur, rien ne part dehors.
// ---------------------------------------------------------------------------
const courriels = [];
function decoderCorps(brut) {
  const coupe = brut.indexOf('\r\n\r\n');
  const entetes = coupe < 0 ? brut : brut.slice(0, coupe);
  let corps = coupe < 0 ? '' : brut.slice(coupe + 4);
  if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(entetes)) {
    const sansSouples = corps.replace(/=\r?\n/g, '');
    const octets = [];
    for (let i = 0; i < sansSouples.length; i += 1) {
      if (sansSouples[i] === '=' && /^[0-9A-F]{2}$/i.test(sansSouples.slice(i + 1, i + 3))) {
        octets.push(parseInt(sansSouples.slice(i + 1, i + 3), 16));
        i += 2;
      } else octets.push(...Buffer.from(sansSouples[i], 'utf8'));
    }
    corps = Buffer.from(octets).toString('utf8');
  } else if (/Content-Transfer-Encoding:\s*base64/i.test(entetes)) {
    corps = Buffer.from(corps.replace(/\s+/g, ''), 'base64').toString('utf8');
  }
  return `${entetes}\r\n\r\n${corps}`;
}
function demarrerSmtp() {
  const serveur = net.createServer((socket) => {
    let enDonnees = false;
    let tampon = '';
    let courant = { a: [], corps: '' };
    const ecrire = (t) => socket.write(t + '\r\n');
    ecrire('220 rejeu ESMTP');
    socket.on('data', (morceau) => {
      tampon += morceau.toString('utf8');
      for (;;) {
        if (enDonnees) {
          const fin = tampon.indexOf('\r\n.\r\n');
          if (fin < 0) return;
          courant.corps = decoderCorps(tampon.slice(0, fin));
          tampon = tampon.slice(fin + 5);
          courriels.push({ ...courant, recuLe: Date.now() });
          courant = { a: [], corps: '' };
          enDonnees = false;
          ecrire('250 ok');
          continue;
        }
        const i = tampon.indexOf('\r\n');
        if (i < 0) return;
        const ligne = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        const cmd = ligne.toUpperCase();
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) socket.write('250-rejeu\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        else if (cmd.startsWith('AUTH PLAIN')) ecrire('235 ok');
        else if (cmd.startsWith('AUTH LOGIN')) {
          ecrire('334 VXNlcm5hbWU6');
          socket.once('data', () => {
            ecrire('334 UGFzc3dvcmQ6');
            socket.once('data', () => ecrire('235 ok'));
          });
        } else if (cmd.startsWith('RCPT TO')) {
          courant.a.push(ligne.slice(8).replace(/[<>]/g, '').trim());
          ecrire('250 ok');
        } else if (cmd === 'DATA') {
          enDonnees = true;
          ecrire('354 go');
        } else if (cmd === 'QUIT') {
          ecrire('221 bye');
          socket.end();
        } else ecrire('250 ok');
      }
    });
    socket.on('error', () => {});
  });
  return new Promise((resolve) => serveur.listen(PORT_SMTP, '127.0.0.1', () => resolve(serveur)));
}
const courrielsPour = (email) => courriels.filter((c) => c.a.includes(email));
// Les seuls LIENS DE DÉVERROUILLAGE · l'avis d'activation de la double
// authentification part à la même adresse et ne doit pas être compté pour un lien.
const liensPour = (email) => courrielsPour(email).filter((c) => /deverrouiller\?jeton=/.test(c.corps));
async function attendreLien(email, nombre = 1, delaiMs = 15_000) {
  const fin = Date.now() + delaiMs;
  while (Date.now() < fin) {
    if (liensPour(email).length >= nombre) return liensPour(email)[nombre - 1];
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}
async function attendreCourriel(email, nombre = 1, delaiMs = 15_000) {
  const fin = Date.now() + delaiMs;
  while (Date.now() < fin) {
    if (courrielsPour(email).length >= nombre) return courrielsPour(email)[nombre - 1];
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

/** Le code TOTP du moment (RFC 6238, SHA-1, six chiffres, pas de trente secondes). */
function codeTotp(secretBase32, instantMs = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretBase32.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const octets = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) octets.push(parseInt(bits.slice(i, i + 8), 2));
  const pas = Buffer.alloc(8);
  pas.writeBigUInt64BE(BigInt(Math.floor(instantMs / 30_000)));
  const h = createHmac('sha1', Buffer.from(octets)).update(pas).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** Attend la fin d'un processus fils, ou le tue passé le délai. */
function attendreFin(enfant, delaiMs) {
  return new Promise((resolve) => {
    const minuteur = setTimeout(() => {
      enfant.kill('SIGKILL');
      resolve(null);
    }, delaiMs);
    enfant.on('exit', (code) => {
      clearTimeout(minuteur);
      resolve(code);
    });
  });
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
    const sortie = await appel('POST', '/auth/logout', { corps: {}, cookie: copie, csrf: courte.csrf });
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

    // ── 6 À 10 · LES CINQ CORRECTIONS DE L'AUDIT DU 2026-11-19 ─────────────
    // Un second serveur compilé, relié à la boîte SMTP de poche, sur la MÊME base.
    const smtp = await demarrerSmtp();
    const apiPremier = API;
    const second = demarrerServeur({ port: PORT_MESSAGERIE, messagerie: true });
    API = `http://127.0.0.1:${PORT_MESSAGERIE}`;
    try {
      await attendreSante();

      console.log('\n6. Un inconnu ne tient plus un compte fermé');
      // (b) le lien de déverrouillage, compte sans double authentification.
      const titulaire = `verrou-b-${UNIQUE}@exemple.invalid`;
      await inscrire(titulaire, 'Cabinet verrou B (rejeu attaques)');
      for (let i = 0; i < 5; i += 1) await connecter(titulaire, MDP_FAUX);
      const fauxPendant = await connecter(titulaire, MDP_FAUX);
      const bonPendant = await connecter(titulaire, MDP);
      constat(
        bonPendant.statut === 401 && fauxPendant.statut === 401 && !bonPendant.cookie,
        `compte fermé · bon et faux mot de passe, même code (${bonPendant.statut}, ${fauxPendant.statut}), aucune session`,
      );
      constat(JSON.stringify(bonPendant.json) === JSON.stringify(fauxPendant.json), 'compte fermé · bon et faux mot de passe, même corps de réponse, mot pour mot');
      const lien = await attendreLien(titulaire, 1);
      constat(Boolean(lien), 'le bon mot de passe pendant le verrou fait partir un lien au seul courriel du compte');
      const jeton = lien ? decodeURIComponent((/deverrouiller\?jeton=([A-Za-z0-9_%-]+)/.exec(lien.corps) ?? [])[1] ?? '') : '';
      constat(jeton.length >= 40, 'le courriel porte un lien de déverrouillage');
      const base = execFileSync('psql', [URL_BASE, '-tAc', `select coalesce("empreinteDeverrouillage", '') from users where "courrielDeConnexion" = '${titulaire}'`], { encoding: 'utf8' }).trim();
      constat(base.length === 64 && !base.includes(jeton), 'la base ne garde que l’empreinte du jeton, jamais le jeton');
      const file = execFileSync('psql', [URL_BASE, '-tAc', `select count(*) from messages where corps like '%${jeton.slice(0, 20)}%'`], { encoding: 'utf8' }).trim();
      constat(file === '0', 'le jeton n’est jamais écrit dans la file des courriels du dossier');
      await connecter(titulaire, MDP);
      await new Promise((r) => setTimeout(r, 1500));
      constat(liensPour(titulaire).length === 1, `un seul lien par période de verrou (${liensPour(titulaire).length} reçu)`);
      const ouvre = await appel('POST', '/auth/deverrouiller', { corps: { jeton } });
      constat(ouvre.statut === 201 && ouvre.json?.deverrouille === true, `le lien rouvre le compte (${ouvre.statut})`);
      const apres = await connecter(titulaire, MDP);
      constat(apres.statut === 201 && Boolean(apres.cookie), `le titulaire entre aussitôt (${apres.statut})`);
      constat((await appel('POST', '/auth/deverrouiller', { corps: { jeton } })).statut === 404, 'le lien ne sert qu’une fois');

      // (a) le second facteur, compte à double authentification.
      const deux = `verrou-a-${UNIQUE}@exemple.invalid`;
      await inscrire(deux, 'Cabinet verrou A (rejeu attaques)');
      const s2 = await connecter(deux, MDP);
      const init = await appel('POST', '/auth/double-authentification/initier', { corps: {}, cookie: s2.cookie, csrf: s2.csrf });
      const act = await appel('POST', '/auth/double-authentification/activer', {
        corps: { motDePasseActuel: MDP, code: codeTotp(init.json?.secret ?? '') }, cookie: s2.cookie, csrf: s2.csrf,
      });
      const secours = act.json?.codesSecours ?? [];
      constat(act.statut === 201 && secours.length === 8, `double authentification activée (${act.statut})`);
      for (let i = 0; i < 5; i += 1) await connecter(deux, MDP_FAUX);
      const sansCode = await connecter(deux, MDP);
      constat(sansCode.statut === 401 && !sansCode.json?.deuxiemeFacteurRequis, 'compte fermé · le bon mot de passe sans code ne réclame pas de code (il ne dit rien)');
      const codeFaux = await connecter(deux, MDP, { code: '000000' });
      constat(codeFaux.statut === 401 && JSON.stringify(codeFaux.json) === JSON.stringify(fauxPendant.json), 'compte fermé · bon mot de passe et code faux, la réponse commune');
      const avecSecours = await connecter(deux, MDP, { code: secours[0] });
      constat(avecSecours.statut === 201 && Boolean(avecSecours.cookie), `compte fermé · bon mot de passe et code de secours, le titulaire entre (${avecSecours.statut})`);
      const compteur = execFileSync('psql', [URL_BASE, '-tAc', `select "tentativesEchouees" || ':' || coalesce("verrouilleJusqua"::text, 'aucun') from users where "courrielDeConnexion" = '${deux}'`], { encoding: 'utf8' }).trim();
      constat(compteur === '0:aucun', `le compteur et le verrou tombent (${compteur})`);

      console.log('\n6 bis. Le code de la double authentification pendant le verrou');
      const budget = `verrou-code-${UNIQUE}@exemple.invalid`;
      await inscrire(budget, 'Cabinet verrou code (rejeu attaques)');
      const s3 = await connecter(budget, MDP);
      const init3 = await appel('POST', '/auth/double-authentification/initier', { corps: {}, cookie: s3.cookie, csrf: s3.csrf });
      const secret3 = init3.json?.secret ?? '';
      const act3 = await appel('POST', '/auth/double-authentification/activer', { corps: { motDePasseActuel: MDP, code: codeTotp(secret3) }, cookie: s3.cookie, csrf: s3.csrf });
      constat(act3.statut === 201, `double authentification activée (${act3.statut})`);
      for (let i = 0; i < 5; i += 1) await connecter(budget, MDP_FAUX);
      const premierCodeFaux = await connecter(budget, MDP, { code: '000000' });
      constat(premierCodeFaux.statut === 401 && JSON.stringify(premierCodeFaux.json) === JSON.stringify(fauxPendant.json), 'compte fermé · bon mot de passe et code faux, la réponse commune');
      constat(Boolean(await attendreLien(budget, 1)), 'un code faux avec le bon mot de passe pendant le verrou · le lien de déverrouillage part bien');
      for (let i = 1; i < 5; i += 1) await connecter(budget, MDP, { code: `00000${i}` });
      await new Promise((r) => setTimeout(r, 1000));
      const budgetBase = execFileSync('psql', [URL_BASE, '-tAc', `select "codesFauxSousVerrou" from users where "courrielDeConnexion" = '${budget}'`], { encoding: 'utf8' }).trim();
      constat(budgetBase === '5', `cinq codes faux comptés pour la période de verrou (${budgetBase})`);
      const bonCodeRefuse = await connecter(budget, MDP, { code: codeTotp(secret3) });
      constat(
        bonCodeRefuse.statut === 401 && !bonCodeRefuse.cookie && JSON.stringify(bonCodeRefuse.json) === JSON.stringify(fauxPendant.json),
        `au-delà de cinq codes faux, même le BON code n’est plus jugé jusqu’à l’échéance (${bonCodeRefuse.statut})`,
      );
      await new Promise((r) => setTimeout(r, 1000));
      constat(liensPour(budget).length === 1, `un seul lien pour la période, prolongations comprises (${liensPour(budget).length})`);

      console.log('\n7. La limite d’essais compte par adresse e-mail');
      const visee = `jamais-inscrite-${UNIQUE}@exemple.invalid`;
      const statutsAdresse = [];
      for (let i = 0; i < 12; i += 1) statutsAdresse.push((await connecter(visee, MDP_FAUX, {}, `10.66.${i}.${i + 1}`)).statut);
      constat(
        statutsAdresse.slice(0, 10).every((x) => x === 401) && statutsAdresse[10] === 429 && statutsAdresse[11] === 429,
        `une adresse inconnue est freinée au 11e essai malgré douze adresses IP différentes (${statutsAdresse.join(',')})`,
      );
      const habitue = `appareil-${UNIQUE}@exemple.invalid`;
      await inscrire(habitue, 'Cabinet appareil (rejeu attaques)');
      const premiere = await connecter(habitue, MDP, {}, '10.55.0.1');
      const appareil = premiere.json?.appareil;
      constat(typeof appareil === 'string' && appareil.split('.').length === 3, 'la connexion réussie rend un jeton d’appareil');
      // Un tiers freine l'adresse du titulaire depuis des adresses IP variées ·
      // dix mots de passe faux. Le cinquième ferme le compte (palier d'une minute).
      const tiers = [];
      for (let i = 0; i < 10; i += 1) tiers.push(await connecter(habitue, MDP_FAUX, {}, `10.55.1.${i + 1}`));
      const fauxFreine = tiers[9];
      constat(fauxFreine.statut === 429, `au-delà de la limite, un mot de passe faux · 429 (${tiers.map((r) => r.statut).join(',')})`);
      const inconnuFreine = await connecter(visee, MDP_FAUX, {}, '10.55.2.2');
      constat(JSON.stringify(fauxFreine.json) === JSON.stringify(inconnuFreine.json), 'adresse connue et adresse inconnue freinées · même réponse');
      // Compte fermé · le BON mot de passe reçoit exactement le 429 du faux, et le lien part.
      const avantLiens = liensPour(habitue).length;
      const bonFerme = await connecter(habitue, MDP, {}, '10.55.3.1');
      constat(
        bonFerme.statut === 429 && !bonFerme.cookie && JSON.stringify(bonFerme.json) === JSON.stringify(fauxFreine.json),
        `au-delà de la limite, compte fermé · le bon mot de passe reçoit le même 429 que le faux (${bonFerme.statut})`,
      );
      constat(Boolean(await attendreLien(habitue, avantLiens + 1)), 'et le lien de déverrouillage part quand même, au seul titulaire');
      // Le verrou échu (le palier d'une minute), l'adresse reste freinée · le
      // titulaire entre quand même, sur un appareil JAMAIS reconnu.
      const echeance = execFileSync('psql', [URL_BASE, '-tAc', `select extract(epoch from "verrouilleJusqua")*1000 from users where "courrielDeConnexion" = '${habitue}'`], { encoding: 'utf8' }).trim();
      const attente = Math.max(0, Number(echeance) - Date.now()) + 1500;
      console.log(`     attente de l'échéance du verrou · ${(attente / 1000).toFixed(0)} s`);
      await new Promise((r) => setTimeout(r, attente));
      const essaisAdresse = execFileSync('psql', [URL_BASE, '-tAc', 'select count(*) from essais_connexion_adresse where cardinality(instants) > 10'], { encoding: 'utf8' }).trim();
      constat(Number(essaisAdresse) >= 1, 'l’adresse est toujours au-delà de la limite');
      const titulaireEntre = await connecter(habitue, MDP, {}, '10.55.4.1');
      constat(
        titulaireEntre.statut === 201 && Boolean(titulaireEntre.cookie),
        `adresse freinée par un tiers, appareil jamais reconnu · le titulaire entre avec le bon mot de passe (${titulaireEntre.statut})`,
      );
      const encoreFaux = await connecter(habitue, MDP_FAUX, {}, '10.55.4.2');
      constat(encoreFaux.statut === 429, `et un mauvais mot de passe reste en 429 (${encoreFaux.statut})`);
      const reconnu = await connecter(habitue, MDP, { appareil }, '10.55.2.3');
      constat(reconnu.statut === 201 && Boolean(reconnu.cookie), `l’appareil reconnu passe la limite (${reconnu.statut})`);
      const volee = await connecter(visee, MDP_FAUX, { appareil }, '10.55.2.4');
      constat(volee.statut === 429, `le jeton d’appareil d’un compte ne dispense pas une autre adresse freinée (${volee.statut})`);

      console.log('\n8. Le mot de passe actuel compte ses échecs');
      const geste = `geste-${UNIQUE}@exemple.invalid`;
      await inscrire(geste, 'Cabinet geste (rejeu attaques)');
      const sg = await connecter(geste, MDP);
      const reponses = [];
      for (let i = 0; i < 5; i += 1) {
        const r = await appel('POST', '/auth/changer-mot-de-passe', { corps: { motDePasseActuel: MDP_FAUX, nouveauMotDePasse: 'Nouveau-Rejeu-2026-xyz!' }, cookie: sg.cookie, csrf: sg.csrf });
        reponses.push(r);
      }
      constat(reponses.every((r) => r.statut === 401), 'cinq mots de passe actuels faux, cinq refus');
      constat(/compte est fermé/.test(String(reponses[4].json?.message)) && /session en cours reste ouverte/.test(String(reponses[4].json?.message)), 'le cinquième ferme le compte, et le message dit que la session reste ouverte');
      const bonRefuse = await appel('POST', '/auth/changer-mot-de-passe', { corps: { motDePasseActuel: MDP, nouveauMotDePasse: 'Nouveau-Rejeu-2026-xyz!' }, cookie: sg.cookie, csrf: sg.csrf });
      constat(bonRefuse.statut === 401 && /compte est fermé/.test(String(bonRefuse.json?.message)), 'compte fermé · le geste est refusé même avec le bon mot de passe');
      constat((await appel('GET', '/exercices', { cookie: sg.cookie })).statut === 200, 'la session en cours n’est pas éjectée');
      constat((await connecter(geste, MDP)).statut === 401, 'le même verrou ferme la connexion');
      constat((await appel('POST', '/auth/deconnecter-autres-appareils', { corps: { motDePasseActuel: MDP }, cookie: sg.cookie, csrf: sg.csrf })).statut === 401, 'les autres gestes au mot de passe actuel sont fermés aussi');

      console.log('\n10. La déconnexion depuis un autre site');
      const sd = await connecter(habitue, MDP, { appareil });
      const formulaire = await appel('POST', '/auth/logout', { cookie: sd.cookie, type: 'application/x-www-form-urlencoded', brut: 'a=1' });
      constat(formulaire.statut === 415, `une déconnexion postée en formulaire est refusée (${formulaire.statut})`);
      constat((await appel('GET', '/exercices', { cookie: sd.cookie })).statut === 200, 'la session visée reste ouverte');
      const enTexte = await appel('POST', '/auth/logout', { cookie: sd.cookie, type: 'text/plain', brut: '{}' });
      constat(enTexte.statut === 415, `une déconnexion en text/plain est refusée (${enTexte.statut})`);
      const enJson = await appel('POST', '/auth/logout', { corps: {}, cookie: sd.cookie });
      constat(enJson.statut === 201 && enJson.json?.sessionFermee === true, 'la déconnexion en JSON ferme la session');
      const echue = await appel('POST', '/auth/logout', { corps: {} });
      constat(echue.statut === 201, 'une déconnexion sans session (cookie échu) répond encore');
    } finally {
      second.enfant.kill('SIGTERM');
      smtp.close();
      API = apiPremier;
    }

    console.log('\n9. Un secret de session court en production');
    const SECRET_COURT = 'court-et-devinable';
    const serveurRefuse = demarrerServeur({ port: PORT_REFUS, secret: SECRET_COURT, production: true });
    const codeSortie = await attendreFin(serveurRefuse.enfant, 60_000);
    const journal = serveurRefuse.journal();
    constat(codeSortie !== null && codeSortie !== 0, `le serveur refuse de démarrer (code de sortie ${codeSortie})`);
    constat(/JWT_SECRET refusé en production/.test(journal), 'le refus est nommé au journal du démarrage');
    constat(!journal.includes(SECRET_COURT), 'le journal ne cite jamais la valeur du secret');
    let repond = false;
    try { repond = (await fetch(`http://127.0.0.1:${PORT_REFUS}/health`)).ok; } catch { /* rien n'écoute */ }
    constat(!repond, 'rien n’écoute sur le port du serveur refusé');
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
