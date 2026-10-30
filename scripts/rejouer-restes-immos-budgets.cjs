#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · ligne restes-immos-budgets.
 * Serveur COMPILÉ contre une base PostgreSQL jetable déjà migrée.
 *   DATABASE_URL=postgresql://... node scripts/rejouer-restes-immos-budgets.cjs
 *
 * POINT 1 · REPORT DES BUDGETS PAR COMPTE.
 *   N = 2025 · charge A dotée 1 200 puis mars à 250 (l'année suit · 1 350),
 *   charge B dotée 600, produit doté 5 000 ; N+1 = 2026 · le produit déjà
 *   doté 4 000 ; la charge B mise en sommeil. 2025 clôturé, puis report.
 *   Attendu à la main · aperçu = A repris ; produit non repris (déjà doté) ;
 *   B non repris (sommeil). Après confirmation · A en 2026 = 1 350, mars 250,
 *   janvier 100 ; produit 2026 = 4 000, jamais 5 000. Un second report ne
 *   reprend rien (A déjà doté) et ne double aucune ligne.
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(URL_BASE)) { console.error('DATABASE_URL locale exigée'); process.exit(2); }
const PORT = 8099;
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-rejeu-2026!';
const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
const echecs = [];
const verifier = (c, m) => { if (!c) { echecs.push(m); console.log(`  ECHEC · ${m}`); } else console.log(`  ok · ${m}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const egal = (a, b) => a !== null && a !== undefined && Math.abs(Number(a) - Number(b)) < 0.005;
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
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 900)}`); e.statut = r.status; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b) { return this.appeler('PATCH', c, b).then((r) => r.corps); }
  del(c) { return this.appeler('DELETE', c).then((r) => r.corps); }
  statut(m, c, b) { return this.appeler(m, c, b, [200, 201, 400, 403, 404, 409]).then((r) => r); }
}

async function dossier(A, nom) {
  const email = `restes-${nom}-${Date.now()}@exemple.invalid`;
  await A.post('/auth/register', { nomEntite: `Rejeu ${nom} SARL`, referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
  await A.post('/auth/login', { email, motDePasse: MDP });
  const exercices = await A.get('/exercices');
  const e2026 = exercices.find((e) => e.dateDebut.startsWith('2026'));
  const e2025 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
  const plan = await A.get('/comptes?typeCompte=DETAIL');
  const premier = (prefixe) => plan.find((c) => c.numero.startsWith(prefixe) && c.typeCompte === 'DETAIL');
  return { e2025, e2026, plan, premier };
}

async function point1(A) {
  console.log('POINT 1 · report des budgets par compte');
  const { e2025, e2026, premier } = await dossier(A, 'budgets');
  const chargeA = premier('604');
  const chargeB = premier('605');
  const produit = premier('701');
  for (const c of [chargeA, chargeB, produit]) await A.patch(`/comptes/${c.id}`, { estRetenu: true });
  await A.post(`/analytique/comptes/${chargeA.id}/budget`, { exerciceId: e2025.id, montantAnnuel: 1200 });
  await A.patch(`/analytique/comptes/${chargeA.id}/budget`, { exerciceId: e2025.id, mois: 3, montant: 250 });
  await A.post(`/analytique/comptes/${chargeB.id}/budget`, { exerciceId: e2025.id, montantAnnuel: 600 });
  await A.post(`/analytique/comptes/${produit.id}/budget`, { exerciceId: e2025.id, montantAnnuel: 5000 });
  await A.post(`/analytique/comptes/${produit.id}/budget`, { exerciceId: e2026.id, montantAnnuel: 4000 });
  await A.patch(`/comptes/${chargeB.id}`, { estActif: false });

  let r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
  if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 800));
  const ex25 = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
  verifier(ex25.statut === 'CLOTURE', `2025 clôturé (${ex25.statut})`);

  const apercu = await A.get(`/analytique/budgets-comptes/report?exerciceId=${e2025.id}`);
  verifier(apercu.reporte === false && apercu.motifRefus === null, 'aperçu servi, rien écrit');
  verifier(apercu.repris.length === 1 && apercu.repris[0].compteId === chargeA.id && egal(apercu.repris[0].annuel, 1350), `repris · la charge A, 1 350 (lu ${JSON.stringify(apercu.repris.map((x) => [x.numero, x.annuel]))})`);
  const np = new Map(apercu.nonRepris.map((x) => [x.compteId, x.motif]));
  verifier(/jamais écrasé/.test(np.get(produit.id) ?? ''), `produit non repris · déjà doté (${np.get(produit.id)})`);
  verifier(/sommeil/.test(np.get(chargeB.id) ?? ''), `charge B non reprise · en sommeil (${np.get(chargeB.id)})`);
  verifier((await prisma.budgetCompte.count({ where: { exerciceId: e2026.id, compteId: chargeA.id } })) === 0, "l'aperçu n'a rien écrit");

  const fait = await A.post(`/analytique/budgets-comptes/report?exerciceId=${e2025.id}`, {});
  verifier(fait.reporte === true && fait.repris.length === 1, 'report confirmé · un compte');
  const bA = await A.get(`/analytique/comptes/${chargeA.id}/budget?exerciceId=${e2026.id}`);
  const mars = bA.mensuel.find((m) => m.mois === 3);
  const janv = bA.mensuel.find((m) => m.mois === 1);
  const somme = bA.mensuel.reduce((t, m) => t + Math.round(m.montant * 100), 0) / 100;
  verifier(egal(bA.annuel, 1350) && egal(mars?.montant, 250) && egal(janv?.montant, 100) && egal(somme, 1350), `A en 2026 · 1 350, mars 250, janvier 100, mois = année (lu ${bA.annuel}, ${mars?.montant}, ${janv?.montant}, ${somme})`);
  const bP = await A.get(`/analytique/comptes/${produit.id}/budget?exerciceId=${e2026.id}`);
  verifier(egal(bP.annuel, 4000), `produit 2026 · 4 000 gardé, jamais écrasé par 5 000 (lu ${bP.annuel})`);
  verifier((await prisma.budgetCompte.count({ where: { exerciceId: e2026.id, compteId: chargeB.id } })) === 0, 'la charge en sommeil n’est pas dotée');

  const avant = await prisma.budgetCompte.count({ where: { exerciceId: e2026.id } });
  const second = await A.post(`/analytique/budgets-comptes/report?exerciceId=${e2025.id}`, {});
  const apres = await prisma.budgetCompte.count({ where: { exerciceId: e2026.id } });
  verifier(second.repris.length === 0 && avant === apres, `second report · rien repris, aucune ligne doublée (${avant} → ${apres})`);
  r = await A.statut('POST', `/analytique/budgets-comptes/report?exerciceId=${e2026.id}`, {});
  verifier(r.statut === 400 && /exercice suivant n'existe pas/.test(JSON.stringify(r.corps)), `2026 sans exercice suivant · refus nommé (${r.statut})`);
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    let pret = false;
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) { pret = true; break; } } catch {} await attendre(1000); }
    if (!pret) throw new Error(`serveur non démarré\n${journal.slice(-3000)}`);
    const points = (process.env.POINTS || '1').split(',');
    if (points.includes('1')) await point1(new Client());
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
  }
  console.log(echecs.length === 0 ? '\nREJEU VERT' : `\nREJEU ROUGE · ${echecs.length} échec(s)`);
  process.exit(echecs.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
