#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DE LA LIGNE multi-dossiers (2026-11-01). Serveur
 * COMPILÉ contre une base PostgreSQL JETABLE, en DEUX temps.
 *
 *  · PHASE=ancien · le serveur d'AVANT la ligne (dist de `origin/main`, base
 *    migrée sans `20270248000000_comptes_rattaches`) peuple la base · deux
 *    dossiers de référentiels différents, un collaborateur, une écriture. Les
 *    identifiants sont écrits dans ETAT (fichier JSON).
 *
 *  · PHASE=nouveau · la migration de la ligne est appliquée, le serveur de la
 *    ligne démarre, une messagerie de poche branchée (mode INVITATION) · les
 *    comptes existants se connectent comme avant, rien n'est perdu ; puis le
 *    second dossier INVITE une personne du premier (même réponse qu'une
 *    adresse neuve, rien de créé avant l'acceptation), qui accepte avec le
 *    code reçu ET sa session, change de dossier, n'y voit jamais les données
 *    de l'autre, y saisit, traverse une clôture ; l'onglet resté sur l'autre
 *    dossier est refusé en 409, l'administrateur d'origine ne réinitialise
 *    rien et ne ferme que ses propres sessions, et le retrait de
 *    l'appartenance coupe l'accès aussitôt.
 *
 *   PHASE=ancien RACINE=<dist d'avant> DATABASE_URL=... ETAT=... node scripts/rejouer-multi-dossiers.cjs
 *   PHASE=nouveau DATABASE_URL=... ETAT=... node scripts/rejouer-multi-dossiers.cjs
 */
const { join } = require('node:path');
const { readFileSync, writeFileSync } = require('node:fs');
const { spawn } = require('node:child_process');
const net = require('node:net');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
const PHASE = process.env.PHASE || 'nouveau';
const ETAT = process.env.ETAT || '';
if (!URL_BASE || /neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE) || !ETAT) {
  console.error('DATABASE_URL doit pointer une base JETABLE locale, déjà migrée, et ETAT un fichier de travail.');
  process.exit(2);
}
const PORT = Number(process.env.PORT_REJEU || 8131);
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-rejeu-2026!';
const echecs = [];
const verifier = (c, m) => { if (!c) { echecs.push(m); console.log(`  ECHEC · ${m}`); } else console.log(`  ok · ${m}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT_SMTP = Number(process.env.PORT_SMTP_REJEU || 2527);

// Une boîte SMTP de poche · reçoit les invitations sans rien envoyer dehors
// (même montage que `rejouer-suppression-essais.cjs`).
const courriels = [];
function decoderCorps(brut) {
  const coupe = brut.indexOf('\r\n\r\n');
  const entetes = coupe < 0 ? brut : brut.slice(0, coupe);
  let corps = coupe < 0 ? '' : brut.slice(coupe + 4);
  if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(entetes)) {
    const sansSouples = corps.replace(/=\r?\n/g, '');
    const octets = [];
    for (let i = 0; i < sansSouples.length; i += 1) {
      if (sansSouples[i] === '=' && /^[0-9A-F]{2}$/i.test(sansSouples.slice(i + 1, i + 3))) { octets.push(parseInt(sansSouples.slice(i + 1, i + 3), 16)); i += 2; }
      else octets.push(...Buffer.from(sansSouples[i], 'utf8'));
    }
    corps = Buffer.from(octets).toString('utf8');
  } else if (/Content-Transfer-Encoding:\s*base64/i.test(entetes)) corps = Buffer.from(corps.replace(/\s+/g, ''), 'base64').toString('utf8');
  return `${entetes}\r\n\r\n${corps}`;
}
function demarrerSmtp() {
  const serveur = net.createServer((socket) => {
    let enDonnees = false; let tampon = ''; let courant = { a: [], corps: '' };
    const ecrire = (x) => socket.write(x + '\r\n');
    ecrire('220 rejeu ESMTP');
    socket.on('data', (morceau) => {
      tampon += morceau.toString('utf8');
      for (;;) {
        if (enDonnees) {
          const fin = tampon.indexOf('\r\n.\r\n');
          if (fin < 0) return;
          courant.corps = decoderCorps(tampon.slice(0, fin)); tampon = tampon.slice(fin + 5);
          courriels.push(courant); courant = { a: [], corps: '' }; enDonnees = false; ecrire('250 ok'); continue;
        }
        const i = tampon.indexOf('\r\n');
        if (i < 0) return;
        const ligne = tampon.slice(0, i); tampon = tampon.slice(i + 2);
        const cmd = ligne.toUpperCase();
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) socket.write('250-rejeu\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        else if (cmd.startsWith('AUTH PLAIN')) ecrire('235 ok');
        else if (cmd.startsWith('AUTH LOGIN')) { ecrire('334 VXNlcm5hbWU6'); socket.once('data', () => { ecrire('334 UGFzc3dvcmQ6'); socket.once('data', () => ecrire('235 ok')); }); }
        else if (cmd.startsWith('RCPT TO')) { courant.a.push(ligne.slice(8).replace(/[<>]/g, '').trim().toLowerCase()); ecrire('250 ok'); }
        else if (cmd === 'DATA') { enDonnees = true; ecrire('354 go'); }
        else if (cmd === 'QUIT') { ecrire('221 bye'); socket.end(); }
        else ecrire('250 ok');
      }
    });
    socket.on('error', () => {});
  });
  return new Promise((resolve) => serveur.listen(PORT_SMTP, '127.0.0.1', () => resolve(serveur)));
}
/** Le code de l'invitation reçue par `adresse` · le dernier arrivé. */
async function codeRecu(adresse) {
  for (let i = 0; i < 40; i++) {
    const c = [...courriels].reverse().find((m) => m.a.includes(adresse.toLowerCase()) && /Ou saisissez ce code : /.test(m.corps));
    if (c) return /Ou saisissez ce code : (\S+)/.exec(c.corps)[1];
    await attendre(250);
  }
  throw new Error(`aucune invitation arrivée pour ${adresse}`);
}

let n = 1;
class Client {
  constructor() { this.cookies = new Map(); this.csrf = null; this.dossier = null; }
  async appeler(m, chemin, corps, attendu = [200, 201]) {
    const k = (Date.now() + n++ * 7919) % 16777216;
    const h = { 'X-Forwarded-For': `10.${(k >> 16) & 255}.${(k >> 8) & 255}.${k & 255}` };
    if (corps !== undefined) h['Content-Type'] = 'application/json';
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([a, b]) => `${a}=${b}`).join('; ');
    if (this.csrf && m !== 'GET') h['X-CSRF-Token'] = this.csrf;
    // Le dossier de l'onglet, sur ce qui modifie (ligne multi-dossiers, B1).
    if (this.dossier && m !== 'GET') h['X-Dossier'] = this.dossier;
    const r = await fetch(API + chemin, { method: m, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
    for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(';'); const i = p.indexOf('='); const v = p.slice(i + 1); if (!v || /1970/.test(c)) this.cookies.delete(p.slice(0, i)); else this.cookies.set(p.slice(0, i), v); }
    const t = await r.text(); let j; try { j = t ? JSON.parse(t) : undefined; } catch { j = t; }
    if (j && typeof j === 'object' && typeof j.csrfToken === 'string') this.csrf = j.csrfToken;
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 600)}`); e.statut = r.status; e.corps = j; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c, a) { return this.appeler('GET', c, undefined, a).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b, a) { return this.appeler('PATCH', c, b, a).then((r) => r.corps); }
}

async function connecter(email, motDePasse = MDP) {
  const c = new Client();
  const r = await c.post('/auth/login', { email, motDePasse });
  return { c, r };
}

async function adopterComptes(c, racines) {
  const comptes = await c.get('/comptes?typeCompte=DETAIL');
  const pris = {};
  for (const racine of racines) {
    const x = comptes.find((k) => k.numero.startsWith(racine));
    if (!x) throw new Error(`compte ${racine}`);
    await c.patch(`/comptes/${x.id}`, { estRetenu: true });
    pris[racine] = x;
  }
  return pris;
}

async function phaseAncien() {
  const stamp = Date.now();
  const etat = { stamp };
  // Dossier A · SYCEBNL ; dossier B · SYSCOHADA (référentiels différents).
  etat.adminA = `md-admin-a-${stamp}@exemple.invalid`;
  etat.adminB = `md-admin-b-${stamp}@exemple.invalid`;
  etat.collab = `md-collab-${stamp}@exemple.invalid`;
  const a = new Client();
  await a.post('/auth/register', { nomEntite: 'Association Lumière MD', referentiel: 'SYCEBNL', email: etat.adminA, motDePasse: MDP });
  const b = new Client();
  await b.post('/auth/register', { nomEntite: 'Société Kivu MD', referentiel: 'SYSCOHADA', email: etat.adminB, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
  const A = (await connecter(etat.adminA)).c;
  const B = (await connecter(etat.adminB)).c;
  etat.dossierA = (await A.get('/auth/me')).tenant.id;
  etat.dossierB = (await B.get('/auth/me')).tenant.id;
  // Un collaborateur du dossier A, qui pose son mot de passe.
  await A.post('/utilisateurs', { email: etat.collab, motDePasse: 'Provisoire-2026-abc!', role: 'COMPTABLE' });
  const k = (await connecter(etat.collab, 'Provisoire-2026-abc!')).c;
  await k.post('/auth/changer-mot-de-passe', { motDePasseActuel: 'Provisoire-2026-abc!', nouveauMotDePasse: MDP });
  // Une écriture dans A, par le collaborateur.
  const exA = (await A.get('/exercices'))[0];
  const journauxA = await A.get('/journaux');
  const odA = journauxA.find((j) => j.type === 'GENERAL') ?? journauxA[0];
  const comptesA = await adopterComptes(A, ['52', '10']);
  const k2 = (await connecter(etat.collab)).c;
  const piece = await k2.post('/ecritures', {
    exerciceId: exA.id, journalId: odA.id, date: exA.dateDebut.slice(0, 10), libelle: 'Dotation initiale',
    lignes: [{ compteId: comptesA['52'].id, libelle: 'L', debit: 1_000_000, credit: 0 }, { compteId: comptesA['10'].id, libelle: 'L', debit: 0, credit: 1_000_000 }],
  });
  etat.ecritureA = piece.id;
  writeFileSync(ETAT, JSON.stringify(etat, null, 2));
  console.log(`  ok · base peuplée par l'ancien serveur (${etat.dossierA}, ${etat.dossierB})`);
}

async function phaseNouveau() {
  const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
  const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
  const etat = JSON.parse(readFileSync(ETAT, 'utf8'));
  try {
    console.log('== Migration sans perte · les comptes existants se connectent comme avant');
    const lignes = await prisma.user.findMany({ where: { email: { in: [etat.adminA, etat.adminB, etat.collab] } } });
    verifier(lignes.length === 3 && lignes.every((l) => l.compteDeConnexionId === null && l.courrielDeConnexion === l.email),
      'chaque utilisateur existant est son propre compte de connexion, adresse de connexion posée');
    for (const email of [etat.adminA, etat.adminB, etat.collab]) {
      const { r } = await connecter(email);
      verifier(typeof r.csrfToken === 'string' && r.plusieursDossiers === false, `${email.split('-')[1]}-${email.split('-')[2]} se connecte, un seul dossier`);
    }
    const A = (await connecter(etat.adminA)).c;
    const B = (await connecter(etat.adminB)).c;
    verifier((await A.get('/auth/me')).tenant.id === etat.dossierA && (await B.get('/auth/me')).tenant.id === etat.dossierB, 'chacun dans son dossier');
    const ecr = await prisma.ecriture.findUnique({ where: { id: etat.ecritureA } });
    verifier(ecr && ecr.tenantId === etat.dossierA, "l'écriture de l'ancien serveur est là, dans A");

    console.log("== Inviter · l'administrateur de B invite le collaborateur de A, même réponse qu'une adresse neuve");
    const adresseNeuve = `md-neuf-${etat.stamp}@exemple.invalid`;
    const invite = await B.post('/utilisateurs', { email: etat.collab.toUpperCase(), role: 'COMPTABLE' });
    const neuf = await B.post('/utilisateurs', { email: adresseNeuve, role: 'LECTURE_SEULE' });
    const formeDe = (x) => JSON.stringify(Object.keys(x.invitation ?? {}).sort());
    verifier(invite.invitation && neuf.invitation && formeDe(invite) === formeDe(neuf), 'même réponse que pour une adresse inconnue · une invitation');
    verifier(!JSON.stringify(invite).includes(etat.dossierA) && !JSON.stringify(invite).includes('compteDeConnexion'), 'la réponse ne nomme ni le dossier A ni le compte');
    verifier((await prisma.user.count({ where: { tenantId: etat.dossierB, email: { in: [etat.collab, adresseNeuve] } } })) === 0, "rien n'est créé dans B avant l'acceptation");
    const sansMdp = await prisma.user.findMany({ where: { tenantId: etat.dossierB }, select: { email: true } });
    verifier(!sansMdp.some((u) => u.email === etat.collab), "aucun mot de passe posé pour l'adresse connue");
    const deja = await B.appeler('POST', '/utilisateurs', { email: etat.adminB, role: 'COMPTABLE' }, [409]);
    verifier(deja.statut === 409, "une adresse déjà utilisatrice du dossier se refuse (409)");
    const code = await codeRecu(etat.collab);
    const codeNeuf = await codeRecu(adresseNeuve);
    const file = await prisma.message.findMany({ where: { tenantId: etat.dossierB }, select: { corps: true } });
    verifier(file.length >= 2 && file.every((m) => !m.corps.includes(code) && !m.corps.includes(codeNeuf)), "le code de l'invitation n'est jamais dans la file du dossier");
    const journalB = await B.get('/journal-audit?entite=User');
    const compte = lignes.find((l) => l.email === etat.collab);
    verifier(!JSON.stringify(journalB).includes(compte.id) && !JSON.stringify(journalB).includes(etat.dossierA), "le journal d'audit de B ne dit pas que la personne existe ailleurs");

    console.log("== Accepter · le code reçu ET la session de la personne");
    const { c: K0, r: r0 } = await connecter(etat.collab);
    verifier(r0.plusieursDossiers === false, 'avant acceptation · un seul dossier');
    K0.dossier = (await K0.get('/auth/me')).tenant.id;
    const recues = await K0.get('/auth/invitations');
    verifier(Array.isArray(recues) && recues.length === 1 && !JSON.stringify(recues).includes(code), 'une invitation reçue, servie sans son code');
    const autre = (await connecter(etat.adminA)).c;
    const vole = await autre.appeler('POST', '/auth/invitations/accepter', { jeton: code }, [404]);
    verifier(vole.statut === 404, "un autre compte avec le même code n'entre pas (404)");
    const faux = await K0.appeler('POST', '/auth/invitations/accepter', { jeton: 'x'.repeat(43) }, [404]);
    verifier(faux.statut === 404, 'sans le code reçu, aucun chemin (404)');
    await K0.post('/auth/invitations/accepter', { jeton: code });
    const encore = await K0.appeler('POST', '/auth/invitations/accepter', { jeton: code }, [404, 409]);
    verifier(encore.statut >= 400, `le code ne resert pas (${encore.statut})`);
    const ligneB = await prisma.user.findFirst({ where: { tenantId: etat.dossierB, email: etat.collab } });
    verifier(ligneB && ligneB.compteDeConnexionId === compte.id && ligneB.courrielDeConnexion === null && ligneB.doitChangerMotDePasse === false,
      'la ligne de B pointe le compte de connexion, sans adresse de connexion ni mot de passe à changer');
    const creeVole = await new Client().appeler('POST', '/auth/invitations/creer-compte', { jeton: code, motDePasse: 'Autre-mdp-2026-xyz!' }, [404, 409]);
    verifier(creeVole.statut >= 400, `un code utilisé ne crée aucun compte (${creeVole.statut})`);
    await new Client().post('/auth/invitations/creer-compte', { jeton: codeNeuf, motDePasse: 'Neuf-mdp-2026-xyz!' });
    const { r: rNeuf } = await connecter(adresseNeuve, 'Neuf-mdp-2026-xyz!');
    verifier(typeof rNeuf.csrfToken === 'string', "l'adresse neuve a créé son compte avec SON mot de passe");
    let lien = null;
    try { await prisma.$executeRawUnsafe(`UPDATE "users" SET "compteDeConnexionId" = NULL WHERE "id" = '${ligneB.id}'`); } catch (e) { lien = e; }
    verifier(lien !== null, 'la base refuse de changer le lien d’une appartenance (F1)');
    const ligneNeuf = await prisma.user.findFirst({ where: { tenantId: etat.dossierB, email: adresseNeuve } });
    let chaine = null;
    try { await prisma.$executeRawUnsafe(`UPDATE "users" SET "compteDeConnexionId" = '${ligneB.id}' WHERE "id" = '${ligneNeuf.id}'`); } catch (e) { chaine = e; }
    verifier(chaine !== null, 'la base refuse un rattachement posé après coup (chaîne comprise)');

    console.log("== L'administrateur d'origine · aucun geste sur la connexion de la personne");
    const ligneA = compte;
    const reinit = await A.appeler('POST', `/utilisateurs/${ligneA.id}/reinitialiser-mot-de-passe`, { motDePasseProvisoire: 'Squat-2026-abcdef!' }, [403]);
    verifier(reinit.statut === 403, "l'administrateur de A ne réinitialise plus un compte qui ouvre B (403)");
    const deverr = await A.appeler('POST', `/utilisateurs/${ligneA.id}/deverrouiller`, {}, [403]);
    verifier(deverr.statut === 403, "ni ne le déverrouille (403)");
    const reinitB = await B.appeler('POST', `/utilisateurs/${ligneB.id}/reinitialiser-mot-de-passe`, { motDePasseProvisoire: 'Squat-2026-abcdef!' }, [403]);
    verifier(reinitB.statut === 403, "l'administrateur de B ne réinitialise pas une ligne rattachée (403)");
    const vueB = (await B.get('/utilisateurs')).find((u) => u.email === etat.collab);
    verifier(vueB && vueB.connexionTenueParLaPersonne === true && vueB.verrouilleJusqua == null, 'la liste de B dit la connexion tenue par la personne');

    console.log('== Connexion · deux dossiers, le choix, le changement');
    const { c: K, r } = await connecter(etat.collab);
    verifier(r.plusieursDossiers === true, 'la connexion dit plusieurs dossiers');
    const meA = await K.get('/auth/me');
    K.dossier = meA.tenant.id;
    verifier(meA.tenant.id === etat.dossierA && meA.plusieursDossiers === true, 'la session s’ouvre sur le dossier d’origine');
    const { dossiers: liste, total, tronque } = await K.get('/auth/mes-dossiers');
    verifier(liste.length === 2 && total === 2 && tronque === false && liste.map((d) => d.referentiel).sort().join() === 'SYCEBNL,SYSCOHADA', 'mes dossiers · A et B, référentiels différents, liste entière');
    verifier(liste.find((d) => d.dossierId === etat.dossierA).courant === true && liste.every((d) => d.exercice && d.acces === 'NORMAL'), 'le dossier courant, l’exercice ouvert et l’accès de chacun');
    const listeB = (await B.get('/auth/mes-dossiers')).dossiers;
    verifier(listeB.length === 1 && listeB[0].dossierId === etat.dossierB, "l'administrateur de B ne voit que B");
    // Un paramètre de requête ne change pas le dossier.
    const exercicesA = await prisma.exercice.findMany({ where: { tenantId: etat.dossierA }, select: { id: true } });
    const exParam = await K.appeler('GET', `/exercices?tenantId=${etat.dossierB}&dossierId=${etat.dossierB}`, undefined, [200, 400]);
    verifier(exParam.statut === 400 || exParam.corps.every((e) => exercicesA.some((x) => x.id === e.id)), `un paramètre ?dossierId ne change rien (${exParam.statut})`);
    // Sans jeton CSRF, refusé.
    const sansCsrf = new Client();
    sansCsrf.cookies = new Map(K.cookies);
    const r403 = await sansCsrf.appeler('POST', '/auth/changer-dossier', { dossierId: etat.dossierB }, [403]);
    verifier(r403.statut === 403, 'sans jeton CSRF, le changement est refusé (403)');
    const csrfAvant = K.csrf;
    // Une copie du cookie d'avant le changement · elle doit être fermée.
    const copie = new Client();
    copie.cookies = new Map(K.cookies);
    const maillonsAvant = await prisma.evenementAudit.count({ where: { tenantId: etat.dossierA, entite: 'User', entiteId: compte.id } });
    const change = await K.post('/auth/changer-dossier', { dossierId: etat.dossierB });
    const maillonsApres = await prisma.evenementAudit.count({ where: { tenantId: etat.dossierA, entite: 'User', entiteId: compte.id } });
    verifier(maillonsApres === maillonsAvant, `changer de dossier ne pose aucun maillon vide dans le dossier quitté (${maillonsAvant} puis ${maillonsApres})`);
    // L'onglet qui a changé suit son dossier ; un autre, resté sur A, est refusé.
    K.dossier = change.dossierId;
    const ongletA = new Client();
    ongletA.cookies = new Map(K.cookies); ongletA.csrf = K.csrf; ongletA.dossier = etat.dossierA;
    const r409 = await ongletA.appeler('POST', '/exercices', { dateDebut: '2040-01-01', dateFin: '2040-12-31' }, [409]);
    verifier(r409.statut === 409 && r409.corps.dossierChange === true, "l'onglet resté sur A n'écrit pas dans B (409 nommé)");
    ongletA.dossier = null;
    const r409b = await ongletA.appeler('POST', '/exercices', { dateDebut: '2040-01-01', dateFin: '2040-12-31' }, [409]);
    verifier(r409b.statut === 409, "sans en-tête de dossier, une personne à plusieurs dossiers est refusée (409)");
    verifier(change.change === true && change.dossierId === etat.dossierB && K.csrf !== csrfAvant, 'changer de dossier · un jeton CSRF neuf');
    const meB = await K.get('/auth/me');
    verifier(meB.tenant.id === etat.dossierB && meB.tenant.referentiel === 'SYSCOHADA' && meB.role === 'COMPTABLE', 'dans B · son dossier, son référentiel, son rôle');
    const vuParB = (await B.get('/utilisateurs')).find((u) => u.email === etat.collab);
    verifier(vuParB && vuParB.doitChangerMotDePasse === false, "entré avec son propre mot de passe, B ne le voit plus « à changer »");
    const fermee = await copie.appeler('GET', '/auth/me', undefined, [401]);
    verifier(fermee.statut === 401, "la session d'avant le changement est fermée (une copie du cookie ne rouvre rien)");
    const etranger = await K.appeler('POST', '/auth/changer-dossier', { dossierId: 'dossier-inexistant' }, [404]);
    verifier(etranger.statut === 404, "un dossier qui n'est pas le sien est introuvable (404)");

    await attendre(1100); // la révocation tronque à la seconde
    await A.post(`/utilisateurs/${compte.id}/deconnecter`, {});
    verifier((await K.appeler('GET', '/auth/me', undefined, [200])).corps.tenant.id === etat.dossierB,
      "l'administrateur de A ferme les sessions de A seulement · la session dans B reste ouverte (m2)");

    console.log("== Dans B · il ne voit jamais les données de A");
    const exB = await K.get('/exercices');
    verifier(exB.length >= 1 && exB.every((e) => !exercicesA.some((x) => x.id === e.id)), "les exercices lus sont ceux de B, aucun de A");
    const lectureA = await K.appeler('GET', `/ecritures/${etat.ecritureA}`, undefined, [403, 404]);
    verifier(lectureA.statut === 404 || lectureA.statut === 403, `l'écriture de A est introuvable depuis B (${lectureA.statut})`);

    console.log('== Dans B · il saisit, la clôture se traverse');
    const comptesB = await adopterComptes(B, ['5211', '1013']);
    const journauxB = await B.get('/journaux');
    const odB = journauxB.find((j) => j.type === 'GENERAL') ?? journauxB[0];
    const ex26 = exB[0];
    const pieceB = await K.post('/ecritures', {
      exerciceId: ex26.id, journalId: odB.id, date: ex26.dateDebut.slice(0, 10), libelle: 'Apport du rattaché',
      lignes: [{ compteId: comptesB['5211'].id, libelle: 'L', debit: 2_500_000, credit: 0 }, { compteId: comptesB['1013'].id, libelle: 'L', debit: 0, credit: 2_500_000 }],
    });
    const enBase = await prisma.ecriture.findUnique({ where: { id: pieceB.id } });
    verifier(enBase.tenantId === etat.dossierB && enBase.createdBy === ligneB.id, "l'écriture naît dans B, au nom de la ligne de B");
    const suivant = await B.post('/exercices', { dateDebut: `${Number(ex26.dateDebut.slice(0, 4)) + 1}-01-01`, dateFin: `${Number(ex26.dateDebut.slice(0, 4)) + 1}-12-31` });
    await B.post('/ecritures/valider-jusqua', { exerciceId: ex26.id, dateLimite: ex26.dateFin.slice(0, 10) });
    const cloture = await B.appeler('POST', `/exercices/${ex26.id}/cloturer`, {}, [200, 201, 400, 409]);
    verifier(cloture.statut < 300, `clôture de N dans B (${cloture.statut} ${cloture.statut >= 300 ? JSON.stringify(cloture.corps).slice(0, 200) : ''})`);
    const balance = await K.get(`/ecritures/balance?exerciceId=${suivant.id}`, [200]);
    const lignesBalance = Array.isArray(balance) ? balance : balance.lignes ?? [];
    const banque = lignesBalance.find((l) => String(l.numero ?? l.compte?.numero ?? '').startsWith('5211'));
    verifier(banque !== undefined && Math.abs(Number(banque.solde) - 2_500_000) < 0.005,
      `N+1 lu par le rattaché · la banque reportée vaut 2 500 000 à la balance (${banque?.solde})`);
    const ecrituresA = await prisma.ecriture.count({ where: { tenantId: etat.dossierA } });
    verifier(ecrituresA === 1, "rien n'est entré dans A (une seule écriture, celle d'avant)");

    console.log('== Retour dans A, puis retrait de l’appartenance de B');
    // Les sessions de A ont été fermées par son administrateur · y revenir exige une reconnexion.
    const refuseA = await K.appeler('POST', '/auth/changer-dossier', { dossierId: etat.dossierA }, [403]);
    verifier(refuseA.statut === 403, 'revenir dans A, dont les sessions ont été fermées, demande une reconnexion (403)');
    const Kr = (await connecter(etat.collab)).c;
    Kr.dossier = (await Kr.get('/auth/me')).tenant.id;
    verifier(Kr.dossier === etat.dossierA, 'reconnecté · de retour dans A');
    Kr.dossier = (await Kr.post('/auth/changer-dossier', { dossierId: etat.dossierB })).dossierId;
    K.cookies = Kr.cookies; K.csrf = Kr.csrf; K.dossier = Kr.dossier;
    await B.patch(`/utilisateurs/${ligneB.id}`, { estActif: false });
    const coupe = await K.appeler('GET', '/auth/me', undefined, [401]);
    verifier(coupe.statut === 401, "l'appartenance retirée coupe la session de B aussitôt (401)");
    const { c: K2, r: r2 } = await connecter(etat.collab);
    verifier(r2.plusieursDossiers === false, 'reconnecté · un seul dossier');
    const plusB = await K2.appeler('POST', '/auth/changer-dossier', { dossierId: etat.dossierB }, [404]);
    verifier(plusB.statut === 404, 'B ne lui est plus ouvert (404)');
    verifier((await K2.get('/auth/me')).tenant.id === etat.dossierA, 'A reste ouvert');

    console.log('== Le compte de la personne · son mot de passe, changé depuis B, vaut partout');
    await B.patch(`/utilisateurs/${ligneB.id}`, { estActif: true });
    const K3 = (await connecter(etat.collab)).c;
    K3.dossier = (await K3.get('/auth/me')).tenant.id;
    K3.dossier = (await K3.post('/auth/changer-dossier', { dossierId: etat.dossierB })).dossierId;
    await K3.post('/auth/changer-mot-de-passe', { motDePasseActuel: MDP, nouveauMotDePasse: 'Nouveau-mdp-2026-xyz!' });
    verifier((await K3.get('/auth/me')).tenant.id === etat.dossierB, 'la session réémise reste dans B');
    const vieux = await new Client().appeler('POST', '/auth/login', { email: etat.collab, motDePasse: MDP }, [401]);
    verifier(vieux.statut === 401, "l'ancien mot de passe n'ouvre plus rien");
    const { r: r4 } = await connecter(etat.collab, 'Nouveau-mdp-2026-xyz!');
    verifier(r4.plusieursDossiers === true, 'le nouveau ouvre ses deux dossiers');

    console.log("== Dépannage · l'administrateur de B réinitialise par courriel, sans rien voir");
    const avantReinit = courriels.length;
    const reponse = await B.post(`/utilisateurs/${ligneB.id}/reinitialiser-par-courriel`, {});
    verifier(!JSON.stringify(reponse).match(/motDePasse|Provisoire/i), "la réponse ne porte aucun mot de passe");
    let provisoire = null;
    for (let i = 0; i < 40 && !provisoire; i++) {
      const m = courriels.slice(avantReinit).find((c) => c.a.includes(etat.collab.toLowerCase()) && /Mot de passe provisoire · /.test(c.corps));
      if (m) provisoire = /Mot de passe provisoire · (\S+)/.exec(m.corps)[1];
      else await attendre(250);
    }
    verifier(!!provisoire, 'le mot de passe tiré au sort part à la seule adresse de la personne');
    const ancien = await new Client().appeler('POST', '/auth/login', { email: etat.collab, motDePasse: 'Nouveau-mdp-2026-xyz!' }, [401]);
    verifier(ancien.statut === 401, "l'ancien mot de passe n'ouvre plus rien");
    const { c: K5, r: r5 } = await connecter(etat.collab, provisoire);
    verifier(r5.doitChangerMotDePasse === true || (await K5.get('/auth/me')).doitChangerMotDePasse === true, 'le provisoire ouvre, changement exigé');
    K5.dossier = (await K5.get('/auth/me')).tenant.id;
    await K5.post('/auth/changer-mot-de-passe', { motDePasseActuel: provisoire, nouveauMotDePasse: MDP });

    console.log("== Nouvelle adresse · posée par le code reçu à cette adresse seulement");
    const K6 = (await connecter(etat.collab)).c;
    K6.dossier = (await K6.get('/auth/me')).tenant.id;
    const neuve = `md-neuve-${etat.stamp}@exemple.invalid`;
    const demande = await K6.post('/auth/changer-adresse', { motDePasseActuel: MDP, nouvelleAdresse: neuve });
    verifier(demande.confirmationEnvoyee === true, 'la demande attend son code');
    verifier((await prisma.user.findUnique({ where: { id: compte.id } })).email === etat.collab, "rien n'a changé avant le code");
    const codeAdresse = await (async () => {
      for (let i = 0; i < 40; i++) {
        const m = [...courriels].reverse().find((c) => c.a.includes(neuve) && /Code de confirmation · /.test(c.corps));
        if (m) return /Code de confirmation · (\S+)/.exec(m.corps)[1];
        await attendre(250);
      }
      throw new Error('aucun code de confirmation');
    })();
    await K6.post('/auth/confirmer-adresse', { jeton: codeAdresse });
    const { r: r6 } = await connecter(neuve);
    verifier(typeof r6.csrfToken === 'string', 'la nouvelle adresse ouvre le compte');
    const lignesNeuves = await prisma.user.findMany({ where: { OR: [{ id: compte.id }, { compteDeConnexionId: compte.id }] }, select: { email: true } });
    verifier(lignesNeuves.every((l) => l.email === neuve), "l'adresse est recopiée sur ses appartenances");
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const smtp = PHASE === 'nouveau' ? await demarrerSmtp() : null;
  const messagerie = smtp ? { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(PORT_SMTP), SMTP_USER: 'rejeu', SMTP_PASS: 'rejeu', SMTP_SECURE: 'false', COURRIER_EXPEDITEUR: 'rejeu@exemple.invalid' } : {};
  const env = { ...process.env, ...messagerie, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await attendre(1000); }
    if (PHASE === 'ancien') await phaseAncien();
    else await phaseNouveau();
  } catch (e) {
    echecs.push(String(e));
    console.error(e);
  } finally {
    srv.kill();
    smtp?.close();
    if (echecs.length) {
      console.log(`\n${echecs.length} échec(s).`);
      console.log(journal.split('\n').filter((l) => /ERROR|Error/.test(l)).slice(-20).join('\n'));
      process.exitCode = 1;
    } else console.log('\nTout est conforme.');
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
