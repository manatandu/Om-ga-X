#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DE LA LIGNE dossier-l9 HORS ÉCRITURES (fonctions 95,
 * 100, 101). Serveur COMPILÉ contre une base PostgreSQL JETABLE déjà migrée ·
 *  · 95 · la présence s'écrit à la requête (cloisonnement compris), la liste
 *    ne rend jamais d'empreinte, la déconnexion la retire ; un message va
 *    d'un utilisateur à un autre du MÊME dossier, jamais au-delà, l'objet et
 *    le corps hors du journal d'audit, l'administrateur ne lit pas les
 *    messages des autres.
 *
 *  · 100 · un message, une clôture notifient leurs seuls destinataires, jamais
 *    l'auteur ni le voisin ; un événement coupé ne notifie plus ; l'anglais
 *    est refusé tant que le contrat dit le français seul ; l'aide à la
 *    formule lit le plan du dossier par la règle du calcul.
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-dossier-l9.cjs
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE || /neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('DATABASE_URL doit pointer une base JETABLE locale, déjà migrée.');
  process.exit(2);
}
const PORT = Number(process.env.PORT_REJEU || 8114);
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-rejeu-2026!';
const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
const echecs = [];
const verifier = (c, m) => { if (!c) { echecs.push(m); console.log(`  ECHEC · ${m}`); } else console.log(`  ok · ${m}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 1;
class Client {
  constructor(agent) { this.cookies = new Map(); this.csrf = null; this.agent = agent; }
  async appeler(m, chemin, corps, attendu = [200, 201]) {
    const k = (Date.now() + n++ * 7919) % 16777216;
    const h = { 'X-Forwarded-For': `10.${(k >> 16) & 255}.${(k >> 8) & 255}.${k & 255}` };
    if (this.agent) h['User-Agent'] = this.agent;
    if (corps !== undefined) h['Content-Type'] = 'application/json';
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([a, b]) => `${a}=${b}`).join('; ');
    if (this.csrf && m !== 'GET') h['X-CSRF-Token'] = this.csrf;
    const r = await fetch(API + chemin, { method: m, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
    for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(';'); const i = p.indexOf('='); const v = p.slice(i + 1); if (!v || /1970/.test(c)) this.cookies.delete(p.slice(0, i)); else this.cookies.set(p.slice(0, i), v); }
    const t = await r.text(); let j; try { j = t ? JSON.parse(t) : undefined; } catch { j = t; }
    if (j && typeof j === 'object' && typeof j.csrfToken === 'string') this.csrf = j.csrfToken;
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 600)}`); e.statut = r.status; e.corps = j; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b, a) { return this.appeler('PATCH', c, b, a).then((r) => r.corps); }
  put(c, b, a) { return this.appeler('PUT', c, b, a).then((r) => r.corps); }
}

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

async function dossier(nom) {
  const email = `l9-${nom.toLowerCase().replace(/\W/g, '')}-${Date.now()}@exemple.invalid`;
  const c = new Client(CHROME_WINDOWS);
  await c.post('/auth/register', { nomEntite: nom, referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
  await c.post('/auth/login', { email, motDePasse: MDP });
  const me = await c.get('/auth/me');
  return { c, email, tenantId: me.tenant?.id ?? me.tenantId, userId: me.id ?? me.user?.id };
}

/** Un collaborateur du dossier, créé par l'administrateur, qui pose son mot de passe. */
async function collaborateur(admin, role) {
  const email = `l9-collab-${role.toLowerCase()}-${Date.now()}@exemple.invalid`;
  const cree = await admin.c.post('/utilisateurs', { email, motDePasse: 'Provisoire-2026-abc!', role });
  const c = new Client('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15');
  await c.post('/auth/login', { email, motDePasse: 'Provisoire-2026-abc!' });
  await c.post('/auth/changer-mot-de-passe', { motDePasseActuel: 'Provisoire-2026-abc!', nouveauMotDePasse: MDP });
  return { c, email, id: cree.id };
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await attendre(1000); }
    const A = await dossier('Cabinet L9');
    const B = await dossier('Voisin L9');
    const comptable = await collaborateur(A, 'COMPTABLE');
    const paie = await collaborateur(A, 'GESTIONNAIRE_PAIE');

    console.log('== 95 · utilisateurs connectés');
    await comptable.c.get('/exercices');
    await paie.c.get('/messages/non-lus');
    await attendre(300);
    const liste = await A.c.get('/utilisateurs-connectes');
    const emails = liste.sessions.map((s) => s.email);
    verifier(emails.includes(A.email) && emails.includes(comptable.email) && emails.includes(paie.email), `les trois sessions du dossier sont vues (${liste.total})`);
    verifier(!emails.includes(B.email), "la session du voisin n'y est pas");
    verifier(!/empreinte|csrf|jeton/i.test(JSON.stringify(liste)), 'ni jeton ni empreinte dans la réponse');
    const vue = liste.sessions.find((s) => s.email === A.email);
    verifier(vue?.appareil === 'Chrome · Windows' && vue.connectee === true, `appareil résumé (${vue?.appareil}), connecté`);
    let refus = null;
    try { await comptable.c.get('/utilisateurs-connectes'); } catch (e) { refus = e; }
    verifier(refus?.statut === 403, `réservée à l'administrateur (${refus?.statut})`);
    const presencesB = await prisma.presenceSession.count({ where: { tenantId: B.tenantId } });
    verifier(presencesB >= 1, `chaque dossier a ses présences (${presencesB} pour le voisin)`);
    await comptable.c.post('/auth/logout', {});
    const apres = await A.c.get('/utilisateurs-connectes');
    verifier(!apres.sessions.some((s) => s.email === comptable.email), 'la session déconnectée quitte la liste');

    console.log('== 95 · messagerie');
    const comptable2 = new Client();
    await comptable2.post('/auth/login', { email: comptable.email, motDePasse: MDP });
    const envoi = await A.c.post('/messages', { objet: 'Clôture de mars', corps: 'Merci de valider le brouillard de mars avant vendredi.', destinataireIds: [comptable.id, paie.id] });
    verifier(envoi.destinataires === 2, 'envoyé à deux collaborateurs');
    const nonLus = await comptable2.get('/messages/non-lus');
    verifier(nonLus.nonLus === 1, `un message non lu chez le comptable (${nonLus.nonLus})`);
    const recus = await paie.c.get('/messages/recus');
    verifier(recus.messages[0]?.objet === 'Clôture de mars', 'le gestionnaire de paie le reçoit');
    const lu = await comptable2.get(`/messages/${envoi.id}`);
    verifier(lu.corps.startsWith('Merci'), 'le comptable le lit');
    await comptable2.post(`/messages/${envoi.id}/lu`, {});
    const reponse = await comptable2.post('/messages', { objet: 'Re : Clôture de mars', corps: 'Fait.', destinataireIds: [A.userId], repondAId: envoi.id });
    verifier(!!reponse.id, 'il répond');
    // Le voisin ne lit rien, ne reçoit rien.
    let voisin = null;
    try { await B.c.get(`/messages/${envoi.id}`); } catch (e) { voisin = e; }
    verifier(voisin?.statut === 404, `le voisin ne lit pas le message (${voisin?.statut})`);
    let horsDossier = null;
    try { await A.c.post('/messages', { objet: 'x', corps: 'y', destinataireIds: [B.userId] }); } catch (e) { horsDossier = e; }
    verifier(horsDossier?.statut === 400, `un destinataire d'un autre dossier refuse l'envoi (${horsDossier?.statut})`);
    // L'administrateur ne lit pas la réponse adressée à un autre.
    const entre = await paie.c.post('/messages', { objet: 'Bulletins', corps: 'Confidentiel', destinataireIds: [comptable.id] });
    let admin = null;
    try { await A.c.get(`/messages/${entre.id}`); } catch (e) { admin = e; }
    verifier(admin?.statut === 404, `l'administrateur ne lit pas un message entre deux autres (${admin?.statut})`);
    const maillons = await prisma.evenementAudit.findMany({ where: { tenantId: A.tenantId, entite: 'MessageInterne' } });
    const texte = JSON.stringify(maillons);
    verifier(maillons.length >= 3 && !texte.includes('Confidentiel') && !texte.includes('Clôture de mars'), `${maillons.length} envois au journal d'audit, ni objet ni corps`);
    // Chacun retire de sa boîte · retiré par tous, supprimé.
    await A.c.post(`/messages/${envoi.id}/retirer`, {});
    await comptable2.post(`/messages/${envoi.id}/retirer`, {});
    verifier((await prisma.messageInterne.count({ where: { id: envoi.id } })) === 1, 'encore dans la boîte du gestionnaire · gardé');
    await paie.c.post(`/messages/${envoi.id}/retirer`, {});
    verifier((await prisma.messageInterne.count({ where: { id: envoi.id } })) === 0, 'retiré par tous · supprimé');

    console.log('== 100 · notifications et préférences');
    const notesComptable = await comptable2.get('/notifications');
    const deMessage = notesComptable.notifications.filter((x) => x.type === 'MESSAGE_RECU');
    verifier(deMessage.length === 2 && deMessage.every((x) => x.lien === '/messages'), `le comptable est notifié de ses deux messages reçus (${deMessage.length})`);
    const notesAdmin = await A.c.get('/notifications');
    verifier(notesAdmin.notifications.filter((x) => x.type === 'MESSAGE_RECU').length === 1, "l'administrateur n'est notifié que de la réponse qu'il a reçue, jamais de son propre envoi");
    verifier((await B.c.get('/notifications')).total === 0, "le voisin n'a aucune notification");
    verifier((await paie.c.get('/notifications/non-lues')).nonLues === 1, 'le gestionnaire de paie lit les siennes');
    await comptable2.put('/preferences', { notificationsCoupees: ['MESSAGE_RECU'] });
    const avant = (await comptable2.get('/notifications/non-lues')).nonLues;
    await A.c.post('/messages', { objet: 'Rappel', corps: 'Brouillard de mars.', destinataireIds: [comptable.id] });
    verifier((await comptable2.get('/notifications/non-lues')).nonLues === avant, 'un événement coupé ne notifie plus');
    verifier((await comptable2.get('/messages/non-lus')).nonLus >= 1, 'le message, lui, arrive');
    let langue = null;
    try { await comptable2.put('/preferences', { langue: 'EN' }); } catch (e) { langue = e; }
    verifier(langue?.statut === 400 && /seule langue proposée/.test(JSON.stringify(langue.corps)), `l'anglais est refusé tant que le contrat dit le français seul (${langue?.statut})`);
    const prefs = await comptable2.get('/preferences');
    verifier(prefs.langue === 'FR' && JSON.stringify(prefs.languesProposees) === '["FR"]' && prefs.notificationsCoupees.includes('MESSAGE_RECU'), 'ses préférences relues · français, message coupé');
    const une = notesComptable.notifications[0];
    await comptable2.post(`/notifications/${une.id}/lue`, {});
    let autre = null;
    try { await A.c.post(`/notifications/${une.id}/lue`, {}); } catch (e) { autre = e; }
    verifier(autre?.statut === 404, `nul ne marque lue la notification d'un autre (${autre?.statut})`);
    const tout = await comptable2.post('/notifications/tout-lu', {});
    verifier((await comptable2.get('/notifications/non-lues')).nonLues === 0 && tout.lues >= 1, 'tout marquer lu');

    console.log('== 100 · clôture notifiée');
    const exercices = await A.c.get('/exercices');
    const ex = Array.isArray(exercices) ? exercices[0] : exercices.exercices?.[0];
    await comptable2.put('/preferences', { notificationsCoupees: [] });
    const cloture = await A.c.appeler('POST', `/exercices/${ex.id}/cloturer`, {}, [200, 201, 400, 409]);
    if (cloture.statut < 300) {
      const n2 = (await comptable2.get('/notifications')).notifications.filter((x) => x.type === 'EXERCICE_CLOTURE');
      verifier(n2.length === 1 && /clôturé par/.test(n2[0].titre), `le comptable est notifié de la clôture (${n2[0]?.titre})`);
      verifier((await A.c.get('/notifications')).notifications.every((x) => x.type !== 'EXERCICE_CLOTURE'), "l'auteur de la clôture ne se notifie pas");
    } else {
      verifier(false, `clôture refusée, notification non éprouvée · ${JSON.stringify(cloture.corps).slice(0, 300)}`);
    }

    console.log('== 100 · aide à la formule');
    // Au SYSCOHADA, les rabais accordés sont au 7019 (aucun 709 n'est semé) ·
    // la racine sans compte se NOMME, jamais lue comme un zéro.
    const f = await A.c.get(`/etats-personnalises/formule?racines=${encodeURIComponent('70 71 -7019 -709')}`);
    verifier(f.motif === null && f.nombreInclus > 0 && f.inclus.every((x) => /^7[01]/.test(x.numero) && !x.numero.startsWith('7019')), `${f.nombreInclus} comptes additionnés, aucun 7019`);
    verifier(f.nombreExclus === 1 && f.exclus[0].numero === '70190000', `le 7019 écarté par le moins (${f.nombreExclus})`);
    verifier(JSON.stringify(f.racinesSansCompte) === '["-709"]', `la racine sans compte est nommée (${f.racinesSansCompte})`);
    const fx = await A.c.get(`/etats-personnalises/formule?racines=${encodeURIComponent('-709')}`);
    verifier(typeof fx.motif === 'string' && fx.nombreInclus === 0, `une formule refusée dit son motif (${fx.motif})`);
    let tableau = null;
    try { await A.c.get('/etats-personnalises/formule?racines=70&racines=71'); } catch (e) { tableau = e; }
    verifier(tableau?.statut === 400, `une formule donnée deux fois est refusée en 400, jamais en 500 (${tableau?.statut})`);
  } catch (e) {
    echecs.push(String(e));
    console.error(e);
  } finally {
    srv.kill();
    await prisma.$disconnect();
    if (echecs.length) {
      console.log(`\n${echecs.length} échec(s).`);
      console.log(journal.split('\n').filter((l) => /ERROR|Error|WARN|Présence/.test(l)).slice(-20).join('\n'));
      process.exitCode = 1;
    } else console.log('\nTout est conforme.');
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
