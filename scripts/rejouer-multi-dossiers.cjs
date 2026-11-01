#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DE LA LIGNE multi-dossiers (2026-11-01). Serveur
 * COMPILÉ contre une base PostgreSQL JETABLE, en DEUX temps.
 *
 *  · PHASE=ancien · le serveur d'AVANT la ligne (dist de `origin/main`, base
 *    migrée sans `20270247000000_comptes_rattaches`) peuple la base · deux
 *    dossiers de référentiels différents, un collaborateur, une écriture. Les
 *    identifiants sont écrits dans ETAT (fichier JSON).
 *
 *  · PHASE=nouveau · la migration de la ligne est appliquée, le serveur de la
 *    ligne démarre · les comptes existants se connectent comme avant, rien
 *    n'est perdu ; puis une personne est rattachée au second dossier, change
 *    de dossier, n'y voit jamais les données de l'autre, y saisit, traverse une
 *    clôture, et le retrait de son appartenance lui coupe l'accès aussitôt.
 *
 *   PHASE=ancien RACINE=<dist d'avant> DATABASE_URL=... ETAT=... node scripts/rejouer-multi-dossiers.cjs
 *   PHASE=nouveau DATABASE_URL=... ETAT=... node scripts/rejouer-multi-dossiers.cjs
 */
const { join } = require('node:path');
const { readFileSync, writeFileSync } = require('node:fs');
const { spawn } = require('node:child_process');
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

let n = 1;
class Client {
  constructor() { this.cookies = new Map(); this.csrf = null; }
  async appeler(m, chemin, corps, attendu = [200, 201]) {
    const k = (Date.now() + n++ * 7919) % 16777216;
    const h = { 'X-Forwarded-For': `10.${(k >> 16) & 255}.${(k >> 8) & 255}.${k & 255}` };
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

    console.log("== Rattacher · l'administrateur de B rattache le collaborateur de A, réponse identique à une création");
    const rattache = await B.post('/utilisateurs', { email: etat.collab.toUpperCase(), motDePasse: 'Choisi-par-B-2026!', role: 'COMPTABLE' });
    const neuf = await B.post('/utilisateurs', { email: `md-neuf-${etat.stamp}@exemple.invalid`, motDePasse: 'Choisi-par-B-2026!', role: 'LECTURE_SEULE' });
    verifier(JSON.stringify(Object.keys(rattache).sort()) === JSON.stringify(Object.keys(neuf).sort()) && rattache.doitChangerMotDePasse === neuf.doitChangerMotDePasse,
      'même réponse que la création d’une adresse inconnue');
    verifier(!JSON.stringify(rattache).includes(etat.dossierA) && !('compteDeConnexionId' in rattache), 'la réponse ne nomme ni le dossier A ni le compte');
    const deux = await B.appeler('POST', '/utilisateurs', { email: etat.collab, motDePasse: 'Choisi-par-B-2026!', role: 'COMPTABLE' }, [409]);
    verifier(deux.statut === 409, 'la même personne ne se rattache pas deux fois au même dossier (409)');
    const ligneB = await prisma.user.findFirst({ where: { tenantId: etat.dossierB, email: etat.collab } });
    const compte = lignes.find((l) => l.email === etat.collab);
    verifier(ligneB.compteDeConnexionId === compte.id && ligneB.courrielDeConnexion === null, 'la ligne de B pointe le compte de connexion, sans adresse de connexion (déclencheur)');
    const journalB = await B.get('/journal-audit?entite=User');
    const texteJournal = JSON.stringify(journalB);
    verifier(!texteJournal.includes(compte.id) && !texteJournal.includes(etat.dossierA), "le journal d'audit de B ne dit pas que la personne existe ailleurs");
    let chaine = null;
    try { await prisma.$executeRawUnsafe(`UPDATE "users" SET "compteDeConnexionId" = '${ligneB.id}' WHERE "id" = '${neuf.id}'`); } catch (e) { chaine = e; }
    verifier(chaine && /jamais à une autre appartenance/.test(String(chaine.message)), 'la base refuse une chaîne de rattachements');

    console.log('== Connexion · deux dossiers, le choix, le changement');
    const { c: K, r } = await connecter(etat.collab);
    verifier(r.plusieursDossiers === true, 'la connexion dit plusieurs dossiers');
    const meA = await K.get('/auth/me');
    verifier(meA.tenant.id === etat.dossierA && meA.plusieursDossiers === true, 'la session s’ouvre sur le dossier d’origine');
    const liste = await K.get('/auth/mes-dossiers');
    verifier(liste.length === 2 && liste.map((d) => d.referentiel).sort().join() === 'SYCEBNL,SYSCOHADA', 'mes dossiers · A et B, référentiels différents');
    verifier(liste.find((d) => d.dossierId === etat.dossierA).courant === true && liste.every((d) => d.exercice), 'le dossier courant et l’exercice ouvert de chacun');
    const listeB = await B.get('/auth/mes-dossiers');
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
    const change = await K.post('/auth/changer-dossier', { dossierId: etat.dossierB });
    verifier(change.change === true && change.dossierId === etat.dossierB && K.csrf !== csrfAvant, 'changer de dossier · un jeton CSRF neuf');
    const meB = await K.get('/auth/me');
    verifier(meB.tenant.id === etat.dossierB && meB.tenant.referentiel === 'SYSCOHADA' && meB.role === 'COMPTABLE', 'dans B · son dossier, son référentiel, son rôle');
    const vuParB = (await B.get('/utilisateurs')).find((u) => u.email === etat.collab);
    verifier(vuParB && vuParB.doitChangerMotDePasse === false, "entré avec son propre mot de passe, B ne le voit plus « à changer »");
    const fermee = await copie.appeler('GET', '/auth/me', undefined, [401]);
    verifier(fermee.statut === 401, "la session d'avant le changement est fermée (une copie du cookie ne rouvre rien)");
    const etranger = await K.appeler('POST', '/auth/changer-dossier', { dossierId: 'dossier-inexistant' }, [404]);
    verifier(etranger.statut === 404, "un dossier qui n'est pas le sien est introuvable (404)");

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
    await K.post('/auth/changer-dossier', { dossierId: etat.dossierA });
    verifier((await K.get('/auth/me')).tenant.id === etat.dossierA, 'de retour dans A');
    await K.post('/auth/changer-dossier', { dossierId: etat.dossierB });
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
    await K3.post('/auth/changer-dossier', { dossierId: etat.dossierB });
    await K3.post('/auth/changer-mot-de-passe', { motDePasseActuel: MDP, nouveauMotDePasse: 'Nouveau-mdp-2026-xyz!' });
    verifier((await K3.get('/auth/me')).tenant.id === etat.dossierB, 'la session réémise reste dans B');
    const vieux = await new Client().appeler('POST', '/auth/login', { email: etat.collab, motDePasse: MDP }, [401]);
    verifier(vieux.statut === 401, "l'ancien mot de passe n'ouvre plus rien");
    const { r: r4 } = await connecter(etat.collab, 'Nouveau-mdp-2026-xyz!');
    verifier(r4.plusieursDossiers === true, 'le nouveau ouvre ses deux dossiers');
    const mdpChoisiParB = await new Client().appeler('POST', '/auth/login', { email: etat.collab, motDePasse: 'Choisi-par-B-2026!' }, [401]);
    verifier(mdpChoisiParB.statut === 401, "le mot de passe saisi par l'administrateur de B n'a jamais ouvert le compte");
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
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
    if (echecs.length) {
      console.log(`\n${echecs.length} échec(s).`);
      console.log(journal.split('\n').filter((l) => /ERROR|Error/.test(l)).slice(-20).join('\n'));
      process.exitCode = 1;
    } else console.log('\nTout est conforme.');
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
