#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DU LETTRAGE CONCURRENT ENTRE DOSSIERS (test de charge
 * § 4.4, banc k6 du 2026-10-29 · CLAUDE.md § 10). Serveur COMPILÉ contre une
 * base PostgreSQL JETABLE déjà migrée · DOSSIERS dossiers SYSCOHADA, chacun
 * PAIRES factures fournisseur réglées ; tous lettrent EN MÊME TEMPS, chacun ses
 * paires une à une (comme le banc). Le compte rendu dit combien de lettrages
 * ont reçu un 409 et combien de lignes restent ouvertes. Puis le premier
 * dossier traverse la clôture de 2026 et lettre en 2027 · soldes lus contre le
 * calcul à la main.
 *
 *   DATABASE_URL=postgresql://... [DIST=dist] node scripts/rejouer-lettrage-concurrent.cjs
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const DIST = process.env.DIST || join(RACINE, 'dist');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE || /neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('DATABASE_URL doit pointer une base JETABLE locale, déjà migrée.');
  process.exit(2);
}
const DOSSIERS = Number(process.env.DOSSIERS || 20);
const PAIRES = Number(process.env.PAIRES || 10);
const PORT = Number(process.env.PORT_REJEU || 8095);
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-rejeu-2026!';
const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
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
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 300)}`); e.statut = r.status; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b) { return this.appeler('PATCH', c, b).then((r) => r.corps); }
}

async function dossier(i) {
  const email = `lettrage-${i}-${Date.now()}@exemple.invalid`;
  const c = new Client();
  await c.post('/auth/register', { nomEntite: `Rejeu lettrage ${i}`, referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
  await c.post('/auth/login', { email, motDePasse: MDP });
  const ex26 = (await c.get('/exercices')).find((e) => e.dateDebut.startsWith('2026'));
  const comptes = await c.get('/comptes?typeCompte=DETAIL');
  const adopter = async (num) => { const x = comptes.find((k) => k.numero === num); await c.patch(`/comptes/${x.id}`, { estRetenu: true }); return x; };
  const journaux = await c.get('/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
  const fournisseur = await adopter('40110000');
  const charge = await adopter('60520000');
  const banque = await adopter('52110000');
  const ecr = (exId, date, libelle, lignes) => c.post('/ecritures', { exerciceId: exId, journalId: od.id, date, libelle, lignes });
  const paires = [];
  for (let p = 0; p < PAIRES; p++) {
    const m = 10_000 + p * 1_000 + i;
    const f = await ecr(ex26.id, `2026-03-${String(1 + (p % 28)).padStart(2, '0')}`, `Facture ${p}`, [
      { compteId: charge.id, libelle: 'F', debit: m, credit: 0 }, { compteId: fournisseur.id, libelle: 'F', debit: 0, credit: m },
    ]);
    const r = await ecr(ex26.id, `2026-04-${String(1 + (p % 28)).padStart(2, '0')}`, `Règlement ${p}`, [
      { compteId: fournisseur.id, libelle: 'R', debit: m, credit: 0 }, { compteId: banque.id, libelle: 'R', debit: 0, credit: m },
    ]);
    paires.push([f.id, r.id]);
  }
  await c.post('/ecritures/valider-jusqua', { exerciceId: ex26.id, dateLimite: '2026-12-31' });
  const ligneDu = async (ecritureId) => (await prisma.ligneEcriture.findFirst({ where: { ecritureId, compteId: fournisseur.id }, select: { id: true } })).id;
  const lignes = [];
  for (const [f, r] of paires) lignes.push([await ligneDu(f), await ligneDu(r)]);
  return { c, ex26, od, fournisseur, charge, banque, lignes, ecr };
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production', DATABASE_POOL_SIZE: '10' };
  // Bridé comme en production · un cœur (taskset si présent), tas de 460 Mio.
  const aTaskset = require('node:child_process').spawnSync('taskset', ['--version']).status === 0;
  const commande = aTaskset ? ['taskset', ['-c', '0', process.execPath, '--max-old-space-size=460', join(DIST, 'main.js')]] : [process.execPath, ['--max-old-space-size=460', join(DIST, 'main.js')]];
  if (!aTaskset) console.log('taskset absent · serveur non bridé à un cœur');
  const srv = spawn(commande[0], commande[1], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await attendre(1000); }
    const dossiers = [];
    for (let i = 0; i < DOSSIERS; i++) dossiers.push(await dossier(i));
    console.log(`${DOSSIERS} dossiers prêts, ${PAIRES} paires chacun`);

    // Tous les dossiers lettrent EN MÊME TEMPS, chacun ses paires une à une.
    let refus409 = 0, autres = 0;
    const debut = Date.now();
    await Promise.all(dossiers.map(async (d) => {
      for (const [a, b] of d.lignes) {
        const r = await d.c.appeler('POST', `/comptes/${d.fournisseur.id}/lettrage`, { ligneIds: [a, b] }, [200, 201, 409, 400, 500]);
        if (r.statut === 409) refus409++; else if (r.statut >= 400) { autres++; console.log(`  refus ${r.statut} · ${JSON.stringify(r.corps).slice(0, 200)}`); }
      }
    }));
    console.log(`lettrages concurrents · ${DOSSIERS * PAIRES} en ${((Date.now() - debut) / 1000).toFixed(1)} s · 409 : ${refus409} · autres refus : ${autres}`);
    verifier(refus409 === 0, `aucun lettrage refusé pour un conflit entre dossiers (${refus409})`);
    verifier(autres === 0, `aucun autre refus (${autres})`);
    let ouvertes = 0;
    for (const d of dossiers) ouvertes += await prisma.ligneEcriture.count({ where: { compteId: d.fournisseur.id, lettrageId: null } });
    verifier(ouvertes === 0, `aucune ligne fournisseur restée ouverte (${ouvertes})`);
    const codes = await prisma.lettrage.groupBy({ by: ['compteId'], where: { compteId: { in: dossiers.map((d) => d.fournisseur.id) } }, _count: { _all: true } });
    verifier(codes.length === DOSSIERS && codes.every((g) => g._count._all === PAIRES), `un groupe par paire dans chacun des ${DOSSIERS} dossiers`);
    // UN MAILLON PAR LETTRAGE, ni plus ni moins, dans CHAQUE dossier · une reprise qui en laisserait un de trop (F11) se verrait ici.
    let maillonsFaux = 0;
    for (const d of dossiers) {
      const tenantId = (await prisma.compte.findUnique({ where: { id: d.fournisseur.id }, select: { tenantId: true } })).tenantId;
      const crees = await prisma.evenementAudit.count({ where: { tenantId, entite: 'Lettrage', action: 'CREATION' } });
      if (crees !== PAIRES) maillonsFaux++;
    }
    verifier(maillonsFaux === 0, `un maillon de création par lettrage dans chaque dossier (${maillonsFaux} dossier(s) faux)`);

    // MÊME DOSSIER, MÊME COMPTE, EN MÊME TEMPS · deux lettrages qui visent la
    // même paire · un seul passe ; deux paires distinctes · deux lettres.
    {
      const d = dossiers[1];
      const nouvelles = [];
      for (let p = 0; p < 3; p++) {
        const m = 777_000 + p;
        const f = await d.ecr(d.ex26.id, '2026-05-02', `Facture concurrente ${p}`, [{ compteId: d.charge.id, libelle: 'F', debit: m, credit: 0 }, { compteId: d.fournisseur.id, libelle: 'F', debit: 0, credit: m }]);
        const r = await d.ecr(d.ex26.id, '2026-05-03', `Règlement concurrent ${p}`, [{ compteId: d.fournisseur.id, libelle: 'R', debit: m, credit: 0 }, { compteId: d.banque.id, libelle: 'R', debit: 0, credit: m }]);
        nouvelles.push([f.id, r.id]);
      }
      await d.c.post('/ecritures/valider-jusqua', { exerciceId: d.ex26.id, dateLimite: '2026-12-31' });
      const ids = [];
      for (const [f, r] of nouvelles) ids.push([(await prisma.ligneEcriture.findFirst({ where: { ecritureId: f, compteId: d.fournisseur.id } })).id, (await prisma.ligneEcriture.findFirst({ where: { ecritureId: r, compteId: d.fournisseur.id } })).id]);
      const lettrer = (paire) => d.c.appeler('POST', `/comptes/${d.fournisseur.id}/lettrage`, { ligneIds: paire }, [200, 201, 400, 409]);
      const memes = await Promise.all([lettrer(ids[0]), lettrer(ids[0]), lettrer(ids[0])]);
      verifier(memes.filter((x) => x.statut < 300).length === 1, `la même paire lettrée trois fois en même temps · une seule fois (${memes.map((x) => x.statut).join(', ')})`);
      const distinctes = await Promise.all([lettrer(ids[1]), lettrer(ids[2])]);
      verifier(distinctes.every((x) => x.statut < 300) && distinctes[0].corps.lettre !== distinctes[1].corps.lettre, `deux paires du même compte en même temps · deux lettres (${distinctes.map((x) => x.corps && x.corps.lettre).join(', ')})`);
      const groupes = await prisma.lettrage.count({ where: { compteId: d.fournisseur.id } });
      verifier(groupes === PAIRES + 3, `groupes du compte · ${groupes} = ${PAIRES + 3}`);
    }

    // LETTRAGE AUTOMATIQUE CONTRE LETTRAGES MANUELS DU MÊME COMPTE (point 4) ·
    // le calcul se fait hors du verrou, sa validité se relit sous lui · aucune
    // ligne lettrée deux fois, aucun groupe déséquilibré, aucune panne.
    {
      const d = dossiers[2];
      const AUTO = 20;
      const ids = [];
      for (let p = 0; p < AUTO; p++) {
        const m = 555_000 + p * 13;
        const f = await d.ecr(d.ex26.id, '2026-06-02', `Facture auto ${p}`, [{ compteId: d.charge.id, libelle: 'F', debit: m, credit: 0 }, { compteId: d.fournisseur.id, libelle: 'F', debit: 0, credit: m }]);
        const r = await d.ecr(d.ex26.id, '2026-06-03', `Règlement auto ${p}`, [{ compteId: d.fournisseur.id, libelle: 'R', debit: m, credit: 0 }, { compteId: d.banque.id, libelle: 'R', debit: 0, credit: m }]);
        ids.push([f.id, r.id]);
      }
      await d.c.post('/ecritures/valider-jusqua', { exerciceId: d.ex26.id, dateLimite: '2026-12-31' });
      const paires = [];
      for (const [f, r] of ids) paires.push([(await prisma.ligneEcriture.findFirst({ where: { ecritureId: f, compteId: d.fournisseur.id } })).id, (await prisma.ligneEcriture.findFirst({ where: { ecritureId: r, compteId: d.fournisseur.id } })).id]);
      const issues = await Promise.all([
        d.c.appeler('POST', `/comptes/${d.fournisseur.id}/lettrage/auto`, {}, [200, 201, 400, 409]),
        ...paires.slice(0, 3).map((q) => d.c.appeler('POST', `/comptes/${d.fournisseur.id}/lettrage`, { ligneIds: q }, [200, 201, 400, 409])),
      ]);
      // Ce qu'un refus a laissé se relettre au lancement suivant.
      await d.c.appeler('POST', `/comptes/${d.fournisseur.id}/lettrage/auto`, {}, [200, 201]);
      const ouvertesAuto = await prisma.ligneEcriture.count({ where: { id: { in: paires.flat() }, lettrageId: null } });
      const groupesAuto = await prisma.lettrage.findMany({ where: { compteId: d.fournisseur.id, lignes: { some: { id: { in: paires.flat() } } } }, include: { lignes: { select: { debit: true, credit: true } } } });
      const desequilibres = groupesAuto.filter((g) => Math.abs(g.lignes.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0)) > 0.005 || g.lignes.length !== 2);
      verifier(ouvertesAuto === 0 && groupesAuto.length === AUTO && desequilibres.length === 0,
        `lettrage automatique contre trois manuels · ${groupesAuto.length} groupes équilibrés pour ${AUTO} paires, ${ouvertesAuto} ligne(s) ouverte(s) (${issues.map((x) => x.statut).join(', ')})`);
    }

    // À travers la clôture · le premier dossier clôture 2026 et lettre en 2027.
    const d = dossiers[0];
    const ex27 = await d.c.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    try { await d.c.post(`/exercices/${d.ex26.id}/cloturer`, {}); verifier(true, 'clôture de 2026'); } catch (e) { verifier(false, `clôture de 2026 · ${e.message}`); }
    const report = await prisma.ligneEcriture.aggregate({ where: { compteId: d.banque.id, ecriture: { exerciceId: ex27.id } }, _sum: { debit: true, credit: true } });
    let attendu = 0; for (let p = 0; p < PAIRES; p++) attendu -= 10_000 + p * 1_000;
    const lu = Number(report._sum.debit ?? 0) - Number(report._sum.credit ?? 0);
    verifier(Math.abs(lu - attendu) < 0.005, `report 2027 du 521 · ${lu} = ${attendu}`);
    // Le 401 entièrement lettré en 2026 n'a rien à reporter, et aucune de ses lignes d'à-nouveau n'est ouverte.
    const r401 = await prisma.ligneEcriture.aggregate({ where: { compteId: d.fournisseur.id, ecriture: { exerciceId: ex27.id } }, _sum: { debit: true, credit: true } });
    const solde401 = Number(r401._sum.debit ?? 0) - Number(r401._sum.credit ?? 0);
    verifier(Math.abs(solde401) < 0.005, `report 2027 du 401 nul · ${solde401}`);
    const rf = await d.ecr(ex27.id, '2027-02-01', 'Facture 2027', [{ compteId: d.charge.id, libelle: 'F', debit: 5_000, credit: 0 }, { compteId: d.fournisseur.id, libelle: 'F', debit: 0, credit: 5_000 }]);
    const rr = await d.ecr(ex27.id, '2027-02-15', 'Règlement 2027', [{ compteId: d.fournisseur.id, libelle: 'R', debit: 5_000, credit: 0 }, { compteId: d.banque.id, libelle: 'R', debit: 0, credit: 5_000 }]);
    await d.c.post('/ecritures/valider-jusqua', { exerciceId: ex27.id, dateLimite: '2027-12-31' });
    const l1 = await prisma.ligneEcriture.findFirst({ where: { ecritureId: rf.id, compteId: d.fournisseur.id } });
    const l2 = await prisma.ligneEcriture.findFirst({ where: { ecritureId: rr.id, compteId: d.fournisseur.id } });
    const lt = await d.c.post(`/comptes/${d.fournisseur.id}/lettrage`, { ligneIds: [l1.id, l2.id] });
    const attendueLettre = String.fromCharCode(65 + PAIRES); // A…J en 2026, la suivante en 2027
    verifier(lt.lettre === attendueLettre && lt.statut === 'SOLDE', `lettrage en 2027 · lettre ${lt.lettre} (attendue ${attendueLettre}), statut ${lt.statut}`);
    verifier(!/Maillon d'audit NON écrit/.test(journal), 'aucun maillon manqué au journal du serveur');
    verifier(!/\b500\b|Internal server error|ERROR \[ExceptionsHandler\]/i.test(journal), 'aucune panne 500 au journal du serveur');
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
    require('node:fs').writeFileSync(join(process.env.JOURNAL_DIR || '/tmp', 'rejeu-lettrage-concurrent-serveur.log'), journal);
  }
  console.log(echecs.length === 0 ? '\nREJEU VERT' : `\nREJEU ROUGE · ${echecs.length} échec(s)`);
  process.exit(echecs.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
