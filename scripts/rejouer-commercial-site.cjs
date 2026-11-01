#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DE LA LIGNE COMMERCIAL-SITE (gel levé par Manasse le
 * 2026-11-01) · le refus des logiciels non attribués par le serveur, et la
 * demande d'information de la page publique.
 *
 * CLAUDE.md § 10 · les tests unitaires tournent sur des Prisma factices et
 * appellent les gardes à la main ; seul un serveur compilé, contre une base
 * PostgreSQL JETABLE (jamais celle de production), prouve que JwtStrategy
 * relit l'attribution, que JwtAuthGuard refuse en 403 nommé, que
 * l'attribution ferme les sessions, et que la demande arrive en file puis à
 * la boîte des opérateurs. Ce script monte le serveur deux fois · avec une
 * boîte SMTP de poche, puis sans messagerie (503, rien d'écrit).
 *
 * Usage · DATABASE_URL pointe une base jetable DÉJÀ migrée (`prisma migrate
 * deploy`), le serveur est compilé (`npm run build`, `dist/`).
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-commercial-site.cjs
 *
 * Sort en code 0 si tout est prouvé, 1 sinon, avec la liste de ce qui ne l'est pas.
 */
const net = require('node:net');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawn } = require('node:child_process');

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
const PORT_SERVEUR = Number(process.env.PORT_REJEU || 8092);
const PORT_SMTP = Number(process.env.PORT_SMTP_REJEU || 2527);
const API = `http://127.0.0.1:${PORT_SERVEUR}`;
const MOT_DE_PASSE = 'MotDePasse-rejeu-2026!';
const EMAIL_OPERATEUR = `operateur-${Date.now()}@exemple.invalid`;

const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });

const sorties = [];
const verifier = (condition, message) => {
  if (!condition) {
    sorties.push(message);
    console.error(`  ECHEC · ${message}`);
  } else console.log(`  ok · ${message}`);
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Une boîte SMTP de poche · elle reçoit sans rien envoyer dehors.
const courriels = [];
function demarrerSmtp() {
  const serveur = net.createServer((socket) => {
    let enDonnees = false;
    let tampon = '';
    let courant = { a: [], corps: '' };
    const ecrire = (s) => socket.write(s + '\r\n');
    ecrire('220 rejeu ESMTP');
    socket.on('data', (morceau) => {
      tampon += morceau.toString('utf8');
      for (;;) {
        if (enDonnees) {
          const fin = tampon.indexOf('\r\n.\r\n');
          if (fin < 0) return;
          courant.corps = tampon.slice(0, fin);
          tampon = tampon.slice(fin + 5);
          courriels.push(courant);
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

function demarrerServeur(avecMessagerie) {
  const dist = process.env.OMEGAX_DIST || join(RACINE, 'dist');
  const point = [join(dist, 'main.js'), join(dist, 'src', 'main.js')].find((p) => existsSync(p));
  if (!point) throw new Error(`Serveur compilé introuvable sous ${dist} · lancer npm run build.`);
  const env = {
    ...process.env,
    DATABASE_URL: URL_BASE,
    JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef',
    JWT_EXPIRES_IN: '8h',
    PORT: String(PORT_SERVEUR),
    CORS_ORIGIN: 'http://localhost:4173',
    INSCRIPTION_PUBLIQUE: 'true',
    OPERATEURS_PLATEFORME: EMAIL_OPERATEUR,
    NODE_ENV: 'production',
    NODE_PATH: join(RACINE, 'node_modules'),
  };
  for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'COURRIER_EXPEDITEUR']) delete env[k];
  if (avecMessagerie) {
    Object.assign(env, {
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(PORT_SMTP),
      SMTP_USER: 'rejeu',
      SMTP_PASS: 'rejeu',
      SMTP_SECURE: 'false',
      COURRIER_EXPEDITEUR: 'rejeu@exemple.invalid',
    });
  }
  const enfant = spawn(process.execPath, [point], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = '';
  enfant.stdout.on('data', (d) => (journal += d));
  enfant.stderr.on('data', (d) => (journal += d));
  return { enfant, journal: () => journal };
}

async function attendreSante() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(`${API}/health`)).ok) return;
    } catch {
      /* pas encore */
    }
    await attendre(1000);
  }
  throw new Error('Le serveur ne répond pas sur /health.');
}

async function arreter(serveur) {
  serveur.enfant.kill('SIGTERM');
  await new Promise((r) => serveur.enfant.once('exit', r));
}

let compteurAdresse = 1;
class Client {
  constructor() {
    this.cookies = new Map();
    this.csrf = null;
    const n = (Date.now() + compteurAdresse++ * 7919) % 16_777_216;
    this.adresse = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
  }
  async appeler(methode, chemin, corps, { entetes = {}, brut } = {}) {
    const h = { 'X-Forwarded-For': this.adresse, ...entetes };
    if (corps !== undefined && !brut) h['Content-Type'] = 'application/json';
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (this.csrf && methode !== 'GET') h['X-CSRF-Token'] = this.csrf;
    const r = await fetch(API + chemin, { method: methode, headers: h, body: brut ?? (corps === undefined ? undefined : JSON.stringify(corps)) });
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const [paire] = c.split(';');
      const i = paire.indexOf('=');
      const nom = paire.slice(0, i);
      const valeur = paire.slice(i + 1);
      if (valeur === '' || /expires=Thu, 01 Jan 1970/i.test(c)) this.cookies.delete(nom);
      else this.cookies.set(nom, valeur);
    }
    const texte = await r.text();
    let json;
    try {
      json = texte ? JSON.parse(texte) : undefined;
    } catch {
      json = texte;
    }
    if (json && typeof json === 'object' && typeof json.csrfToken === 'string') this.csrf = json.csrfToken;
    return { statut: r.status, corps: json, texte };
  }
  async ok(methode, chemin, corps) {
    const r = await this.appeler(methode, chemin, corps);
    if (r.statut >= 300) throw new Error(`${methode} ${chemin} · ${r.statut} · ${r.texte.slice(0, 300)}`);
    return r.corps;
  }
}

const DEMANDE = {
  nom: 'Ruth Kabeya',
  organisation: 'ASBL Lumière du rejeu',
  email: 'ruth@exemple.invalid',
  message: 'Nous voulons tenir notre comptabilité SYCEBNL avec OmegaX.',
  consentement: true,
};
const compterDemandes = () => prisma.message.count({ where: { origine: 'DEMANDE_INFORMATION' } });

async function principal() {
  const smtp = await demarrerSmtp();
  let serveur = demarrerServeur(true);
  try {
    await attendreSante();
    console.log('== 1. Le refus des logiciels non attribués');
    const admin = new Client();
    const emailAdmin = `admin-${Date.now()}@exemple.invalid`;
    await admin.ok('POST', '/auth/register', {
      nomEntite: 'Rejeu commercial-site SARL',
      referentiel: 'SYSCOHADA',
      email: emailAdmin,
      motDePasse: MOT_DE_PASSE,
      systemeComptableSyscohada: 'NORMAL',
    });
    await admin.ok('POST', '/auth/login', { email: emailAdmin, motDePasse: MOT_DE_PASSE });
    const exercices = await admin.ok('GET', '/exercices');
    const exerciceId = exercices[0].id;
    const emailCollab = `collab-${Date.now()}@exemple.invalid`;
    const collabCree = await admin.ok('POST', '/utilisateurs', { email: emailCollab, motDePasse: MOT_DE_PASSE, role: 'COMPTABLE' });
    const collab = new Client();
    const sonMot = `${MOT_DE_PASSE}-c`;
    await collab.ok('POST', '/auth/login', { email: emailCollab, motDePasse: MOT_DE_PASSE });
    await collab.ok('POST', '/auth/changer-mot-de-passe', { motDePasseActuel: MOT_DE_PASSE, nouveauMotDePasse: sonMot });
    await attendre(1100);
    await collab.ok('POST', '/auth/login', { email: emailCollab, motDePasse: sonMot });
    const avant = await collab.appeler('GET', `/ecritures/balance?exerciceId=${exerciceId}`);
    verifier(avant.statut === 200, `sans attribution, la balance est servie (${avant.statut})`);

    await attendre(1100);
    await admin.ok('PUT', `/utilisateurs/${collabCree.id}/logiciels`, { restreindre: true, logiciels: ['PAIE'] });
    const close = await collab.appeler('GET', '/journaux');
    verifier(close.statut === 401, `l'attribution ferme la session du collaborateur (${close.statut})`);
    await attendre(1100);
    await collab.ok('POST', '/auth/login', { email: emailCollab, motDePasse: sonMot });
    const me = await collab.ok('GET', '/auth/me');
    verifier(JSON.stringify(me.logicielsAutorises) === '["PAIE"]', `/auth/me rend la seule paie (${JSON.stringify(me.logicielsAutorises)})`);

    const balance = await collab.appeler('GET', `/ecritures/balance?exerciceId=${exerciceId}`);
    verifier(balance.statut === 403 && /« Comptabilité ».*ne vous est pas attribué/.test(balance.texte), `la balance lui est refusée, nommée (${balance.statut} · ${balance.texte.slice(0, 160)})`);
    const factures = await collab.appeler('GET', '/facturation');
    verifier(factures.statut === 403 && /Gestion commerciale/.test(factures.texte), `la facturation lui est refusée en lecture (${factures.statut})`);
    const creerJournal = await collab.appeler('POST', '/journaux', { code: 'ZZ', libelle: 'Refusé', type: 'GENERAL' });
    verifier(creerJournal.statut === 403 && /Comptabilité/.test(creerJournal.texte), `créer un journal lui est refusé (${creerJournal.statut})`);
    for (const chemin of ['/journaux', '/comptes?retenus=true', '/tiers', '/devises', '/exercices', '/dossier/parametres', '/personnel/salaries']) {
      const r = await collab.appeler('GET', chemin);
      verifier(r.statut === 200, `la paie lit ${chemin} (${r.statut}${r.statut === 200 ? '' : ' · ' + r.texte.slice(0, 160)})`);
    }
    const rapport = await collab.appeler('GET', `/controles?exerciceId=${exerciceId}`);
    verifier(rapport.statut === 403, `le rapport complet des contrôles lui est refusé (${rapport.statut})`);
    const synthese = await collab.appeler('GET', `/controles/synthese?exerciceId=${exerciceId}`);
    verifier(
      synthese.statut === 200 && synthese.corps?.totaux && !('anomalies' in (synthese.corps ?? {})),
      `l'accueil lit la synthèse, compteurs seuls (${synthese.statut})`,
    );
    // La file des courriers · un message de relance du dossier, que la paie ne lit pas.
    const relance = await prisma.message.create({
      data: { tenantId: me.tenantId ?? (await prisma.user.findUnique({ where: { email: emailAdmin } })).tenantId, destinataire: 'client@exemple.invalid', sujet: 'Relance', corps: 'Créance de 1 000 000', origine: 'RELANCE', statut: 'SANS_TRANSPORT' },
    });
    const fileAdmin = await admin.ok('GET', '/courrier');
    const filePaie = await collab.appeler('GET', '/courrier');
    verifier(fileAdmin.messages.some((m) => m.id === relance.id), 'l’administrateur voit la relance dans la file');
    verifier(filePaie.statut === 200 && filePaie.corps.total === 0, `la paie ne voit aucun message de la file (${filePaie.statut} · total ${filePaie.corps?.total})`);
    const fichePaie = await collab.appeler('GET', `/courrier/${relance.id}`);
    verifier(fichePaie.statut === 404, `la fiche de la relance lui est introuvable (${fichePaie.statut})`);

    const adminBalance = await admin.appeler('GET', `/ecritures/balance?exerciceId=${exerciceId}`);
    verifier(adminBalance.statut === 200, `l'administrateur n'est jamais restreint (${adminBalance.statut})`);

    await attendre(1100);
    await admin.ok('PUT', `/utilisateurs/${collabCree.id}/logiciels`, { restreindre: false, logiciels: [] });
    await attendre(1100);
    await collab.ok('POST', '/auth/login', { email: emailCollab, motDePasse: sonMot });
    const leve = await collab.appeler('GET', `/ecritures/balance?exerciceId=${exerciceId}`);
    verifier(leve.statut === 200, `restriction levée, la balance est de nouveau servie (${leve.statut})`);

    console.log('== 2. La demande d’information, avec messagerie');
    const tenantEditeur = me.tenantId ?? (await prisma.user.findUnique({ where: { email: emailAdmin } })).tenantId;
    await prisma.$executeRawUnsafe(`UPDATE "licences" SET "type" = 'PROPRIETAIRE', "dateExpiration" = NULL WHERE "tenantId" = $1`, tenantEditeur);
    const visiteur = new Client();
    const avantDemandes = await compterDemandes();
    const r1 = await visiteur.appeler('POST', '/demandes/information', DEMANDE);
    verifier(r1.statut === 200 && r1.corps?.recue === true, `la demande est reçue (${r1.statut} · ${r1.texte.slice(0, 200)})`);
    verifier(!/@/.test(r1.texte), 'la réponse ne rend aucune adresse');
    const enFile = await prisma.message.findMany({ where: { origine: 'DEMANDE_INFORMATION' }, orderBy: { createdAt: 'desc' }, take: 1 });
    verifier((await compterDemandes()) === avantDemandes + 1, 'un message en file, un seul');
    verifier(enFile[0]?.tenantId === tenantEditeur, 'dans le dossier de l’éditeur');
    verifier(enFile[0]?.destinataire === EMAIL_OPERATEUR, 'adressé à l’opérateur de la plateforme');
    verifier(/Consentement/.test(enFile[0]?.corps ?? '') && /ruth@exemple\.invalid/.test(enFile[0]?.corps ?? ''), 'le corps porte l’adresse de réponse et la preuve du consentement');
    for (let i = 0; i < 20 && !courriels.some((c) => c.a.includes(EMAIL_OPERATEUR)); i += 1) await attendre(250);
    verifier(courriels.some((c) => c.a.includes(EMAIL_OPERATEUR)), 'le courriel arrive à la boîte de l’opérateur');

    const sansCase = await new Client().appeler('POST', '/demandes/information', { ...DEMANDE, consentement: false });
    verifier(sansCase.statut === 400, `sans la case, 400 (${sansCase.statut})`);
    const formulaire = await new Client().appeler('POST', '/demandes/information', undefined, {
      brut: 'nom=x&organisation=y&email=a%40b.cd&message=bonjour+bonjour&consentement=true',
      entetes: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // Le pipe de validation refuse d'abord (une case cochée n'est jamais un booléen
    // dans un formulaire), la porte JSON ensuite · refusé dans les deux cas, rien écrit.
    verifier([400, 415].includes(formulaire.statut), `un formulaire posté hors JSON est refusé (${formulaire.statut})`);
    const rafale = new Client();
    const statuts = [];
    for (let i = 0; i < 6; i += 1) statuts.push((await rafale.appeler('POST', '/demandes/information', { ...DEMANDE, nom: `Rafale ${i}` })).statut);
    verifier(statuts.slice(0, 5).every((s) => s === 200) && statuts[5] === 429, `cinq par heure et par adresse, la sixième en 429 (${statuts.join(', ')})`);

    const avantPiege = await compterDemandes();
    const piege = await new Client().appeler('POST', '/demandes/information', { ...DEMANDE, site: 'http://robot.invalid' });
    verifier(piege.statut === 200 && piege.corps?.recue === true, `le champ piège rempli reçoit la réponse ordinaire (${piege.statut})`);
    verifier((await compterDemandes()) === avantPiege, 'et rien n’est écrit');
    // Le plafond global de l'heure, lu en base · on remplit la file jusqu'au plafond.
    const deja = await prisma.message.count({ where: { tenantId: tenantEditeur, origine: 'DEMANDE_INFORMATION', createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    const manque = Math.max(0, 60 - deja);
    if (manque > 0) {
      await prisma.message.createMany({
        data: Array.from({ length: manque }, (_, i) => ({ tenantId: tenantEditeur, destinataire: EMAIL_OPERATEUR, sujet: `Rempli ${i}`, corps: 'rempli', origine: 'DEMANDE_INFORMATION', statut: 'ENVOYE' })),
      });
    }
    const avantPlafond = await compterDemandes();
    const plafond = await new Client().appeler('POST', '/demandes/information', DEMANDE);
    verifier(plafond.statut === 429 && /Trop de demandes ont été reçues dans l'heure/.test(plafond.texte), `au plafond global de l’heure, 429 nommé (${plafond.statut} · ${plafond.texte.slice(0, 120)})`);
    verifier((await compterDemandes()) === avantPlafond, 'et rien n’est écrit');

    console.log('== 3. La demande d’information, sans messagerie');
    await arreter(serveur);
    serveur = demarrerServeur(false);
    await attendreSante();
    await prisma.message.deleteMany({ where: { origine: 'DEMANDE_INFORMATION', sujet: { startsWith: 'Rempli ' } } });
    const avantSans = await compterDemandes();
    const r503 = await new Client().appeler('POST', '/demandes/information', DEMANDE);
    verifier(r503.statut === 503 && /aucune messagerie/.test(r503.texte), `sans messagerie, 503 nommé (${r503.statut} · ${r503.texte.slice(0, 160)})`);
    verifier((await compterDemandes()) === avantSans, 'et rien n’est écrit');
  } finally {
    await arreter(serveur).catch(() => undefined);
    smtp.close();
    await prisma.$disconnect();
  }
  if (sorties.length) {
    console.error(`\n${sorties.length} point(s) non prouvé(s) :\n - ${sorties.join('\n - ')}`);
    process.exit(1);
  }
  console.log('\nTout est prouvé.');
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
