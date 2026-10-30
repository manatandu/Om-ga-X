#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DE LA SAISIE CONCURRENTE (test de charge § 4.4 ·
 * CLAUDE.md § 10). Serveur COMPILÉ contre une base PostgreSQL JETABLE déjà
 * migrée, bridé comme en production (un cœur si taskset existe, tas de
 * 460 Mio, pool de 10).
 *
 * Trois mesures :
 *  1. ENTRE DOSSIERS · DOSSIERS dossiers saisissent EN MÊME TEMPS, chacun ses
 *     PIECES écritures une à une, sur son journal d'opérations diverses ;
 *  2. DANS UN MÊME DOSSIER, MÊME JOURNAL · RAFALE écritures envoyées au même
 *     instant ;
 *  3. DANS UN MÊME DOSSIER, JOURNAUX DIFFÉRENTS · RAFALE écritures réparties
 *     sur les journaux du dossier, au même instant.
 * Puis le premier dossier valide, clôture 2026 et saisit en 2027 · la
 * numérotation repart à 1 en 2027, et la balance de 2027 porte l'à-nouveau.
 *
 * Pour chaque mesure · statuts rendus (201, 409, 5xx), et pour chaque
 * journal et exercice, la suite des numéros de pièce (doublon, trou).
 * Les échecs de sérialisation et les interblocages vus par PostgreSQL se
 * comptent dans son journal quand PG_LOG est lisible (rejeux du serveur).
 *
 *   DATABASE_URL=postgresql://... [DIST=dist] [PG_LOG=/var/log/postgresql/postgresql-16-main.log] \
 *     node scripts/rejouer-saisie-concurrente.cjs
 */
const { join } = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const DIST = process.env.DIST || join(RACINE, 'dist');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE || /neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('DATABASE_URL doit pointer une base JETABLE locale, déjà migrée.');
  process.exit(2);
}
const DOSSIERS = Number(process.env.DOSSIERS || 20);
const PIECES = Number(process.env.PIECES || 15);
const RAFALE = Number(process.env.RAFALE || 30);
const PORT = Number(process.env.PORT_REJEU || 8096);
const PG_LOG = process.env.PG_LOG || '/var/log/postgresql/postgresql-16-main.log';
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-rejeu-2026!';
const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
const echecs = [];
const verifier = (c, m) => { if (!c) { echecs.push(m); console.log(`  ECHEC · ${m}`); } else console.log(`  ok · ${m}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Le journal de PostgreSQL · lu à partir d'une position, jamais réécrit.
function tailleJournalPg() { try { return fs.statSync(PG_LOG).size; } catch { return null; } }
function conflitsPgDepuis(position) {
  if (position === null) return null;
  try {
    const fd = fs.openSync(PG_LOG, 'r');
    const fin = fs.fstatSync(fd).size;
    const tampon = Buffer.alloc(Math.max(0, fin - position));
    fs.readSync(fd, tampon, 0, tampon.length, position);
    fs.closeSync(fd);
    const t = tampon.toString('utf8');
    return {
      serialisation: (t.match(/could not serialize access/g) || []).length,
      interblocages: (t.match(/deadlock detected/g) || []).length,
      verrou: (t.match(/canceling statement due to lock timeout/g) || []).length,
    };
  } catch { return null; }
}

let n = 1;
class Client {
  constructor() { this.cookies = new Map(); this.csrf = null; }
  async appeler(m, chemin, corps, attendu = [200, 201]) {
    const k = (Date.now() + n++ * 7919) % 16777216;
    const h = { 'X-Forwarded-For': `10.${(k >> 16) & 255}.${(k >> 8) & 255}.${k & 255}` };
    if (corps !== undefined) h['Content-Type'] = 'application/json';
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([a, b]) => `${a}=${b}`).join('; ');
    if (this.csrf && m !== 'GET') h['X-CSRF-Token'] = this.csrf;
    const debut = Date.now();
    const r = await fetch(API + chemin, { method: m, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
    for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(';'); const i = p.indexOf('='); const v = p.slice(i + 1); if (!v || /1970/.test(c)) this.cookies.delete(p.slice(0, i)); else this.cookies.set(p.slice(0, i), v); }
    const t = await r.text(); let j; try { j = t ? JSON.parse(t) : undefined; } catch { j = t; }
    if (j && typeof j === 'object' && typeof j.csrfToken === 'string') this.csrf = j.csrfToken;
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 300)}`); e.statut = r.status; throw e; }
    return { statut: r.status, corps: j, duree: Date.now() - debut };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b) { return this.appeler('PATCH', c, b).then((r) => r.corps); }
}

async function dossier(i) {
  const email = `saisie-${i}-${Date.now()}@exemple.invalid`;
  const c = new Client();
  await c.post('/auth/register', { nomEntite: `Rejeu saisie ${i}`, referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
  await c.post('/auth/login', { email, motDePasse: MDP });
  const exercices = await c.get('/exercices');
  const ex26 = exercices.find((e) => e.dateDebut.startsWith('2026'));
  const comptes = await c.get('/comptes?typeCompte=DETAIL');
  const adopter = async (num) => { const x = comptes.find((k) => k.numero === num); await c.patch(`/comptes/${x.id}`, { estRetenu: true }); return x; };
  const journaux = await c.get('/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
  const charge = await adopter('60520000');
  const capital = await adopter('10130000');
  const tenantId = (await prisma.compte.findUnique({ where: { id: charge.id }, select: { tenantId: true } })).tenantId;
  const ecrire = (journalId, exId, date, libelle, m, attendu) => c.appeler('POST', '/ecritures', {
    exerciceId: exId, journalId, date, libelle,
    lignes: [{ compteId: charge.id, libelle, debit: m, credit: 0 }, { compteId: capital.id, libelle, debit: 0, credit: m }],
  }, attendu);
  return { c, ex26, od, journaux, charge, capital, tenantId, ecrire };
}

const ACCEPTES = [200, 201, 400, 403, 409, 500, 502, 503];
function compter(issues) {
  const s = {};
  for (const r of issues) s[r.statut] = (s[r.statut] || 0) + 1;
  return s;
}

/** Suite des numéros de pièce d'un journal sur un exercice · doublons et trous. */
async function sequence(tenantId, journalId, exerciceId) {
  const lignes = await prisma.ecriture.findMany({ where: { tenantId, journalId, exerciceId }, select: { numeroPiece: true }, orderBy: { numeroPiece: 'asc' } });
  const nums = lignes.map((l) => l.numeroPiece).filter((x) => x !== null);
  const vus = new Set(); let doublons = 0;
  for (const x of nums) { if (vus.has(x)) doublons++; vus.add(x); }
  const max = nums.length ? nums[nums.length - 1] : 0;
  const trous = max - vus.size;
  return { nombre: lignes.length, sansNumero: lignes.length - nums.length, doublons, trous, max };
}

async function mesurer(titre, envois) {
  const pos = tailleJournalPg();
  const debut = Date.now();
  const issues = await envois();
  const duree = ((Date.now() - debut) / 1000).toFixed(1);
  await attendre(300);
  const pg = conflitsPgDepuis(pos);
  const durees = issues.map((r) => r.duree).sort((a, b) => a - b);
  const p95 = durees[Math.floor(durees.length * 0.95)] ?? 0;
  const p50 = durees[Math.floor(durees.length * 0.5)] ?? 0;
  console.log(`${titre} · ${issues.length} saisies en ${duree} s · statuts ${JSON.stringify(compter(issues))} · p50 ${p50} ms · p95 ${p95} ms · PostgreSQL ${pg ? JSON.stringify(pg) : 'journal illisible'}`);
  for (const r of issues.filter((x) => x.statut >= 400).slice(0, 3)) console.log(`    refus ${r.statut} · ${JSON.stringify(r.corps).slice(0, 220)}`);
  return { issues, pg };
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production', DATABASE_POOL_SIZE: '10' };
  const aTaskset = require('node:child_process').spawnSync('taskset', ['--version']).status === 0;
  const commande = aTaskset ? ['taskset', ['-c', '0', process.execPath, '--max-old-space-size=460', join(DIST, 'main.js')]] : [process.execPath, ['--max-old-space-size=460', join(DIST, 'main.js')]];
  if (!aTaskset) console.log('taskset absent · serveur non bridé à un cœur');
  const srv = spawn(commande[0], commande[1], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await attendre(1000); }
    const dossiers = [];
    for (let i = 0; i < DOSSIERS; i++) dossiers.push(await dossier(i));
    console.log(`${DOSSIERS} dossiers prêts`);

    // 1. ENTRE DOSSIERS.
    const m1 = await mesurer(`1. entre ${DOSSIERS} dossiers`, async () => {
      const toutes = [];
      await Promise.all(dossiers.map(async (d, i) => {
        for (let p = 0; p < PIECES; p++) toutes.push(await d.ecrire(d.od.id, d.ex26.id, `2026-03-${String(1 + (p % 28)).padStart(2, '0')}`, `Pièce ${p}`, 1000 + p + i, ACCEPTES));
      }));
      return toutes;
    });
    verifier(m1.issues.every((r) => r.statut === 201), `entre dossiers · toutes les saisies passent (${JSON.stringify(compter(m1.issues))})`);
    let faux1 = 0;
    for (const d of dossiers) { const s = await sequence(d.tenantId, d.od.id, d.ex26.id); if (s.doublons || s.trous || s.sansNumero || s.nombre !== PIECES) { faux1++; console.log(`    séquence fausse · ${JSON.stringify(s)}`); } }
    verifier(faux1 === 0, `entre dossiers · ${PIECES} pièces numérotées 1 à ${PIECES} dans chaque dossier (${faux1} faux)`);

    // 2. MÊME DOSSIER, MÊME JOURNAL.
    const d0 = dossiers[0];
    const avant2 = await sequence(d0.tenantId, d0.od.id, d0.ex26.id);
    const m2 = await mesurer(`2. même dossier, même journal, rafale de ${RAFALE}`, () => Promise.all(
      Array.from({ length: RAFALE }, (_, k) => d0.ecrire(d0.od.id, d0.ex26.id, '2026-05-10', `Rafale ${k}`, 5000 + k, ACCEPTES)),
    ));
    const s2 = await sequence(d0.tenantId, d0.od.id, d0.ex26.id);
    const passees2 = m2.issues.filter((r) => r.statut === 201).length;
    verifier(m2.issues.every((r) => r.statut < 500), `même journal · aucune réponse 5xx (${JSON.stringify(compter(m2.issues))})`);
    verifier(s2.doublons === 0 && s2.trous === 0 && s2.nombre === avant2.nombre + passees2, `même journal · séquence sans doublon ni trou (${JSON.stringify(s2)})`);

    // 3. MÊME DOSSIER, JOURNAUX DIFFÉRENTS.
    const d1 = dossiers[1];
    const ordinaires = d1.journaux.filter((j) => j.type !== 'SITUATION' && j.actif !== false);
    const m3 = await mesurer(`3. même dossier, ${ordinaires.length} journaux, rafale de ${RAFALE}`, () => Promise.all(
      Array.from({ length: RAFALE }, (_, k) => d1.ecrire(ordinaires[k % ordinaires.length].id, d1.ex26.id, '2026-06-10', `Croisée ${k}`, 7000 + k, ACCEPTES)),
    ));
    verifier(m3.issues.every((r) => r.statut < 500), `journaux différents · aucune réponse 5xx (${JSON.stringify(compter(m3.issues))})`);
    let faux3 = 0;
    for (const j of ordinaires) { const s = await sequence(d1.tenantId, j.id, d1.ex26.id); if (s.doublons || s.trous) { faux3++; console.log(`    ${j.code} · ${JSON.stringify(s)}`); } }
    verifier(faux3 === 0, `journaux différents · aucun doublon ni trou (${faux3} journal faux)`);

    // 4. MODIFICATIONS CONCURRENTES ENTRE DOSSIERS (brouillard) · chaque dossier modifie ses pièces.
    const m4 = await mesurer(`4. modifications entre ${DOSSIERS} dossiers`, async () => {
      const toutes = [];
      await Promise.all(dossiers.map(async (d) => {
        const ecr = await prisma.ecriture.findMany({ where: { tenantId: d.tenantId, journalId: d.od.id, statut: 'BROUILLARD' }, select: { id: true, numeroPiece: true }, take: 5, orderBy: { numeroPiece: 'asc' } });
        for (const e of ecr) {
          toutes.push(await d.c.appeler('PATCH', `/ecritures/${e.id}`, {
            libelle: `Modifiée ${e.numeroPiece}`,
            lignes: [{ compteId: d.charge.id, libelle: 'M', debit: 4321, credit: 0 }, { compteId: d.capital.id, libelle: 'M', debit: 0, credit: 4321 }],
          }, ACCEPTES));
        }
      }));
      return toutes;
    });
    verifier(m4.issues.every((r) => r.statut === 200), `modifications entre dossiers · toutes passent (${JSON.stringify(compter(m4.issues))})`);

    // 5. À TRAVERS LA CLÔTURE · validation, clôture de 2026, saisie concurrente en 2027.
    const d2 = dossiers[2];
    const capitalN = async (exId) => prisma.ligneEcriture.aggregate({ where: { compteId: d2.capital.id, ecriture: { exerciceId: exId } }, _sum: { credit: true, debit: true } });
    const avantCloture = await capitalN(d2.ex26.id);
    await d2.c.post('/ecritures/valider-jusqua', { exerciceId: d2.ex26.id, dateLimite: '2026-12-31' });
    let ex27 = (await d2.c.get('/exercices')).find((e) => e.dateDebut.startsWith('2027'));
    if (!ex27) ex27 = await d2.c.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    const cloture = await d2.c.appeler('POST', `/exercices/${d2.ex26.id}/cloturer`, {}, [200, 201, 400, 409]);
    console.log(`  clôture de 2026 · ${cloture.statut}${cloture.statut >= 400 ? ' · ' + JSON.stringify(cloture.corps).slice(0, 300) : ''}`);
    const m5 = await mesurer('5. saisie concurrente en 2027 après clôture', () => Promise.all(
      Array.from({ length: 10 }, (_, k) => d2.ecrire(d2.od.id, ex27.id, '2027-01-15', `2027 ${k}`, 900 + k, ACCEPTES)),
    ));
    const s5 = await sequence(d2.tenantId, d2.od.id, ex27.id);
    const anouveau = await prisma.ecriture.count({ where: { tenantId: d2.tenantId, exerciceId: ex27.id, estGenereeParCloture: true } });
    verifier(m5.issues.every((r) => r.statut === 201), `2027 · toutes les saisies passent (${JSON.stringify(compter(m5.issues))})`);
    verifier(s5.doublons === 0 && s5.trous === 0, `2027 · séquence sans doublon ni trou (${JSON.stringify(s5)}, à-nouveau du journal compris)`);
    const report = await prisma.ligneEcriture.aggregate({ where: { compteId: d2.capital.id, ecriture: { exerciceId: ex27.id, estGenereeParCloture: true } }, _sum: { credit: true, debit: true } });
    const soldeN = Number(avantCloture._sum.credit) - Number(avantCloture._sum.debit);
    const soldeReporte = Number(report._sum.credit) - Number(report._sum.debit);
    verifier(cloture.statut < 300 && anouveau >= 1 && Math.abs(soldeN - soldeReporte) < 0.005, `clôture · capital de 2026 ${soldeN} reporté en 2027 pour ${soldeReporte}`);

    // 6. CLÔTURE ET SAISIES AU MÊME INSTANT · la clôture, restée sérialisable,
    // ne se valide jamais sur une image qui ignore une pièce passée pendant
    // elle · ni pièce au brouillard dans un exercice clos, ni doublon de
    // numéro dans l'exercice suivant, où la clôture pose son à-nouveau.
    const d3 = dossiers[3];
    await d3.c.post('/ecritures/valider-jusqua', { exerciceId: d3.ex26.id, dateLimite: '2026-12-31' });
    let ex27b = (await d3.c.get('/exercices')).find((e) => e.dateDebut.startsWith('2027'));
    if (!ex27b) ex27b = await d3.c.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    const m6 = await mesurer('6. clôture de 2026 et vingt saisies en 2026 et 2027 au même instant', () => Promise.all([
      d3.c.appeler('POST', `/exercices/${d3.ex26.id}/cloturer`, {}, ACCEPTES),
      ...Array.from({ length: 10 }, (_, k) => d3.ecrire(d3.od.id, d3.ex26.id, '2026-12-31', `Fin ${k}`, 300 + k, ACCEPTES)),
      ...Array.from({ length: 10 }, (_, k) => d3.ecrire(d3.od.id, ex27b.id, '2027-01-02', `Début ${k}`, 400 + k, ACCEPTES)),
    ]));
    const statut26 = (await prisma.exercice.findUnique({ where: { id: d3.ex26.id }, select: { statut: true } })).statut;
    const brouillard26 = await prisma.ecriture.count({ where: { exerciceId: d3.ex26.id, statut: 'BROUILLARD' } });
    console.log(`  clôture · ${m6.issues[0].statut} · exercice 2026 ${statut26}, ${brouillard26} pièce(s) au brouillard en 2026`);
    verifier(m6.issues.every((r) => r.statut < 500), `clôture et saisies · aucune réponse 5xx (${JSON.stringify(compter(m6.issues))})`);
    verifier(!(statut26 === 'CLOTURE' && brouillard26 > 0), 'clôture et saisies · aucun exercice clos avec une pièce au brouillard');
    const s6a = await sequence(d3.tenantId, d3.od.id, d3.ex26.id);
    const s6b = await sequence(d3.tenantId, d3.od.id, ex27b.id);
    verifier(s6a.doublons === 0 && s6a.trous === 0 && s6b.doublons === 0 && s6b.trous === 0, `clôture et saisies · séquences sans doublon ni trou (2026 ${JSON.stringify(s6a)}, 2027 ${JSON.stringify(s6b)})`);

    // 7. LA CLÔTURE DE N PENDANT LA SAISIE DE N+1 · le cas normal (on ouvre
    // N+1 avant de clôturer N, AUDCIF art. 23). Quatre postes saisissent en
    // 2027 sans arrêt pendant toute la clôture · elle doit passer, sans
    // rejeu en série, et les séquences de 2027 restent continues.
    const d4 = dossiers[4];
    await d4.c.post('/ecritures/valider-jusqua', { exerciceId: d4.ex26.id, dateLimite: '2026-12-31' });
    let ex27c = (await d4.c.get('/exercices')).find((e) => e.dateDebut.startsWith('2027'));
    if (!ex27c) ex27c = await d4.c.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    let enCours = true;
    let clotureIssue = null;
    const m7 = await mesurer('7. clôture de 2026 pendant que quatre postes saisissent en 2027', async () => {
      const issues = [];
      const postes = Array.from({ length: 4 }, async (_, p) => {
        let k = 0;
        while (enCours) issues.push(await d4.ecrire(d4.od.id, ex27c.id, '2027-02-01', `N+1 ${p}-${k++}`, 100 + k, ACCEPTES));
      });
      await attendre(300);
      clotureIssue = await d4.c.appeler('POST', `/exercices/${d4.ex26.id}/cloturer`, {}, ACCEPTES);
      enCours = false;
      await Promise.all(postes);
      return issues;
    });
    console.log(`  clôture · ${clotureIssue.statut} en ${clotureIssue.duree} ms${clotureIssue.statut >= 300 ? ' · ' + JSON.stringify(clotureIssue.corps).slice(0, 200) : ''}`);
    verifier(clotureIssue.statut === 201, `clôture pendant la saisie de N+1 · elle passe (${clotureIssue.statut})`);
    verifier(m7.issues.every((r) => r.statut < 500), `saisies de N+1 pendant la clôture · aucune réponse 5xx (${JSON.stringify(compter(m7.issues))})`);
    const s7 = await sequence(d4.tenantId, d4.od.id, ex27c.id);
    verifier(s7.doublons === 0 && s7.trous === 0, `2027 · séquence sans doublon ni trou, à-nouveau compris (${JSON.stringify(s7)})`);

    // 8. DEUX CORRECTIONS DE LA MÊME ÉCRITURE AU MÊME INSTANT (relecture,
    // point 6) · une passe, l'autre est refusée nommée, jamais un 500, et
    // l'écriture n'a qu'une inscription en négatif.
    const d5 = dossiers[5];
    const aCorriger = await d5.ecrire(d5.od.id, d5.ex26.id, '2026-07-01', 'À corriger', 777, [201]);
    await d5.c.post('/ecritures/valider-jusqua', { exerciceId: d5.ex26.id, dateLimite: '2026-12-31' });
    const m8 = await mesurer('8. deux corrections de la même écriture au même instant', () => Promise.all(
      [0, 1, 2].map(() => d5.c.appeler('POST', `/ecritures/${aCorriger.corps.id}/correction`, { motifCorrection: 'Erreur de compte' }, ACCEPTES)),
    ));
    const negatifs = await prisma.ecriture.count({ where: { corrigeEcritureId: aCorriger.corps.id } });
    verifier(m8.issues.filter((r) => r.statut < 300).length === 1 && m8.issues.every((r) => r.statut < 500) && negatifs === 1,
      `corrections simultanées · une seule passe, aucun 5xx, un seul négatif (${JSON.stringify(compter(m8.issues))}, ${negatifs})`);

    // 9. CLÔTURE DE PÉRIODE ET SAISIES DANS LA PÉRIODE AU MÊME INSTANT (point 7) ·
    // aucune pièce ne naît dans la période après sa clôture.
    const d6 = dossiers[6];
    const m9 = await mesurer('9. clôture de période et dix saisies dans la période au même instant', () => Promise.all([
      d6.c.appeler('POST', `/exercices/${d6.ex26.id}/clotures/periode`, { dateLimite: '2026-08-31' }, ACCEPTES),
      ...Array.from({ length: 10 }, (_, k) => d6.ecrire(d6.od.id, d6.ex26.id, '2026-08-15', `Période ${k}`, 600 + k, ACCEPTES)),
    ]));
    const clotureP = await prisma.cloture.findFirst({ where: { tenantId: d6.tenantId, granularite: 'PERIODE', annuleeAt: null }, select: { createdAt: true } });
    const apres = clotureP ? await prisma.ecriture.count({ where: { tenantId: d6.tenantId, date: { lte: new Date('2026-08-31') }, libelle: { startsWith: 'Période' }, createdAt: { gt: clotureP.createdAt } } }) : -1;
    verifier(m9.issues.every((r) => r.statut < 500) && apres === 0, `période close · aucune pièce saisie dans la période après sa clôture (${JSON.stringify(compter(m9.issues))}, ${apres} après)`);

    // 10. POINTAGE ET SUPPRESSION DU MÊME BROUILLARD AU MÊME INSTANT (point 2) ·
    // jamais une ligne pointée partie avec son écriture.
    const d7 = dossiers[7];
    const banque = (await d7.c.get('/comptes?typeCompte=DETAIL')).find((k) => k.numero === '52110000');
    await d7.c.patch(`/comptes/${banque.id}`, { estRetenu: true });
    const rap = await d7.c.appeler('POST', '/rapprochements', { compteId: banque.id, dateReleve: '2026-09-30', soldeReleve: 0 }, ACCEPTES);
    if (rap.statut >= 300) {
      console.log(`  10 non joué · ouverture du rapprochement ${rap.statut} · ${JSON.stringify(rap.corps).slice(0, 200)}`);
    } else {
      let deuxGagnes = 0, issues10 = [];
      for (let k = 0; k < 10; k++) {
        const e = await d7.c.appeler('POST', '/ecritures', { exerciceId: d7.ex26.id, journalId: d7.od.id, date: '2026-09-10', libelle: `Banque ${k}`,
          lignes: [{ compteId: banque.id, libelle: 'B', debit: 50 + k, credit: 0 }, { compteId: d7.capital.id, libelle: 'B', debit: 0, credit: 50 + k }] }, [201]);
        const ligneBanque = e.corps.lignes.find((l) => l.compteId === banque.id).id;
        const [p, sup] = await Promise.all([
          d7.c.appeler('POST', `/rapprochements/${rap.corps.id}/pointer`, { ligneIds: [ligneBanque] }, ACCEPTES.concat([404])),
          d7.c.appeler('DELETE', `/ecritures/${e.corps.id}`, undefined, ACCEPTES.concat([404])),
        ]);
        issues10.push(p, sup);
        if (p.statut < 300 && sup.statut < 300) deuxGagnes++;
      }
      verifier(deuxGagnes === 0 && issues10.every((r) => r.statut < 500), `pointage contre suppression · jamais les deux, aucun 5xx (${JSON.stringify(compter(issues10))}, ${deuxGagnes} doubles)`);
    }

    const toutes = [...m1.issues, ...m2.issues, ...m3.issues, ...m4.issues, ...m5.issues, ...m6.issues, ...m7.issues, ...m8.issues, ...m9.issues];
    const pannes = toutes.filter((r) => r.statut >= 500).length;
    verifier(pannes === 0, `aucune réponse 5xx sur l'ensemble (${pannes})`);
    verifier(!/Maillon d'audit NON écrit/.test(journal), 'aucun maillon d\'audit manqué au journal du serveur');
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
  }
  console.log(echecs.length ? `\n${echecs.length} échec(s)` : '\nTout est vert');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
