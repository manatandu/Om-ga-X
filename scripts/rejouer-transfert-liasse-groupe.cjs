#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · anomalie n° 9 de la NOTE 3A (décision de Manasse du
 * 2026-10-29). Un matériel entre au bilan du siège en 2025 par écriture,
 * 2025 se clôture, le bien passe à un établissement en 2026 ; la balance
 * agrégée et la liasse du groupe ne lisent ni l'entrée ni la sortie, le
 * complément de dotation reste. Serveur COMPILÉ, base jetable déjà migrée.
 *   DATABASE_URL=postgresql://... node scripts/rejouer-transfert-liasse-groupe.cjs
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!RACINE || !/localhost|127\.0\.0\.1/.test(URL_BASE)) { console.error('RACINE et DATABASE_URL locale exigés'); process.exit(2); }
const PORT = 8098;
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
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 600)}`); e.statut = r.status; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b) { return this.appeler('PATCH', c, b).then((r) => r.corps); }
  del(c, a) { return this.appeler('DELETE', c, undefined, a).then((r) => r); }
  statut(m, c, b) { return this.appeler(m, c, b, [200, 201, 400, 403, 404, 409]).then((r) => r); }
}

const corps = (r) => JSON.stringify(r.corps).slice(0, 400);

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; const garder = (d) => { journal += d; globalThis.__journal = journal; }; srv.stdout.on('data', garder); srv.stderr.on('data', garder);
  try {
    let pret = false;
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) { pret = true; break; } } catch {} await attendre(1000); }
    if (!pret) throw new Error(`serveur non démarré\n${journal.slice(-3000)}`);
    const stamp = Date.now();
    const email = `tr9-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu anomalie 9 SA', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await prisma.user.findFirst({ where: { email } })).tenantId;
    const e2026 = (await A.get('/exercices')).find((e) => e.dateDebut.startsWith('2026'));
    const e2025 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
    const plan = await A.get('/comptes?typeCompte=DETAIL');
    const adopter = async (num) => { const x = plan.find((k) => k.numero === num); if (!x) throw new Error(`compte ${num} absent`); await A.patch(`/comptes/${x.id}`, { estRetenu: true }); return x; };
    const c244 = await adopter('24410000');
    const c4812 = await adopter('48120000');
    const c521 = await adopter('52110000');
    const c101 = await adopter('10130000');
    const journaux = await A.get('/journaux');
    const od = journaux.find((j) => j.code === 'OD') ?? journaux.find((j) => j.type === 'GENERAL');

    console.log('N = 2025 · capital, puis un matériel acquis par écriture');
    await A.post('/ecritures', { exerciceId: e2025.id, journalId: od.id, date: '2025-01-02', libelle: 'Apport', lignes: [
      { compteId: c521.id, libelle: 'Apport', debit: 5_000_000, credit: 0 }, { compteId: c101.id, libelle: 'Apport', debit: 0, credit: 5_000_000 },
    ] });
    const bien = await A.post('/immobilisations', {
      compteImmobilisationId: c244.id, designation: 'Groupe électrogène', numeroInventaire: 'INV-9001',
      dateAcquisition: '2025-02-01', dateMiseEnService: '2025-02-01', valeurOrigine: 1_200_000, dureeAmortissementAns: 4,
      compteContrepartieId: c4812.id, exerciceId: e2025.id, journalId: od.id,
    });
    await A.post('/ecritures/valider-jusqua', { exerciceId: e2025.id, dateLimite: '2025-12-31' });
    let r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
    verifier(r.statut < 300, `clôture de 2025 (${r.statut} ${corps(r)})`);
    const an244 = await prisma.ligneEcriture.aggregate({ where: { compteId: c244.id, ecriture: { exerciceId: e2026.id } }, _sum: { debit: true, credit: true } });
    verifier(Number(an244._sum.debit) === 1_200_000, `à-nouveau 2026 du 244 · ${an244._sum.debit}`);

    console.log('N+1 = 2026 · une cellule, le transfert du bien');
    await prisma.tenant.update({ where: { id: tenantId }, data: { plafondCellules: 3 } });
    const emailCell = `tr9-cell-${stamp}@exemple.invalid`;
    const cell = await A.post('/groupe/cellules', { nom: 'Rejeu anomalie 9 Établissement', emailAdmin: emailCell });
    const C = new Client();
    await C.post('/auth/login', { email: emailCell, motDePasse: cell.motDePasseTemporaire });
    await C.post('/auth/changer-mot-de-passe', { motDePasseActuel: cell.motDePasseTemporaire, nouveauMotDePasse: MDP });
    await C.post('/auth/login', { email: emailCell, motDePasse: MDP });
    const ctx = await A.get('/immobilisations/transferts-groupe/contexte');
    const dA = ctx.dossiers.find((d) => d.id === tenantId);
    const dC = ctx.dossiers.find((d) => d.id === cell.tenant.id);
    const planC = await C.get('/comptes?typeCompte=DETAIL');
    const c244C = planC.find((c) => c.numero === c244.numero);
    await C.patch(`/comptes/${c244C.id}`, { estRetenu: true });
    // La famille du compte naît chez la cellule avec un premier bien (`compte-du-bien.ts`).
    await C.post('/immobilisations', {
      compteImmobilisationId: c244C.id, designation: 'Bureau de la cellule', dateAcquisition: '2025-10-01', dateMiseEnService: '2025-10-01',
      valeurOrigine: 200_000, dureeAmortissementAns: 4, amortissementAnterieur: 0, repris: true, exerciceId: dC.exercicesOuverts[0].id,
    });
    const liaison = (d) => d.comptesLiaison.find((c) => /^18[4-7]/.test(c.numero)) ?? d.comptesLiaison[0];
    const od2 = (d) => d.journaux.find((j) => j.code === 'OD') ?? d.journaux[0];
    const tr = await A.statut('POST', '/immobilisations/transferts-groupe', {
      dossierCedantId: tenantId, immobilisationId: bien.id, dossierReceveurId: cell.tenant.id, date: '2026-06-01',
      referencePiece: 'TR-9-1', datePiece: '2026-06-01', journalCedantId: od2(dA).id, journalReceveurId: od2(dC).id,
      compteLiaisonCedantId: liaison(dA).id, compteLiaisonReceveurId: liaison(dC).id,
    });
    verifier(tr.statut < 300, `transfert passé (${tr.statut} ${corps(tr)})`);
    const cotes = await prisma.transfertImmobilisationGroupe.findMany({ where: { tenantId: { in: [tenantId, cell.tenant.id] } } });
    const cedant = cotes.find((c) => c.sens === 'SORTIE');
    const V = Number(cedant.valeurOrigine), AM = Number(cedant.amortissements), CPL = Number(cedant.complementDotation);
    console.log(`  valeur ${V}, amortissements ${AM} dont complément ${CPL}`);
    await A.post('/ecritures/valider-jusqua', { exerciceId: e2026.id, dateLimite: '2026-12-31' });
    await C.post('/ecritures/valider-jusqua', { exerciceId: dC.exercicesOuverts[0].id, dateLimite: '2026-12-31' });

    console.log('Balance agrégée du groupe, 2026');
    const ag = await A.get(`/groupe/balance-agregee?exerciceId=${e2026.id}`);
    const ligne = (n) => ag.lignes.find((x) => x.numero === n) ?? { totalDebit: 0, totalCredit: 0 };
    const l244 = ligne(c244.numero);
    verifier(Math.abs(l244.totalDebit - 1_200_000) < 0.005 && Math.abs(l244.totalCredit) < 0.005, `244 du groupe · l'à-nouveau seul, ni entrée ni sortie (${l244.totalDebit} / ${l244.totalCredit})`);
    const l28 = ag.lignes.filter((x) => x.numero.startsWith('284'));
    const credit28 = l28.reduce((t, x) => t + x.totalCredit, 0), debit28 = l28.reduce((t, x) => t + x.totalDebit, 0);
    verifier(Math.abs(debit28) < 0.005 && Math.abs(credit28 - (AM)) < 0.5, `284 du groupe · ni la reprise du cédant ni l'entrée chez le receveur, le cumul doté reste (${debit28} / ${credit28}, attendu 0 / ${AM})`);
    const elim = ag.eliminations.filter((e) => e.motif === 'Transfert d’un bien entre dossiers du groupe');
    const sd = elim.reduce((t, e) => t + e.debit, 0), sc = elim.reduce((t, e) => t + e.credit, 0);
    verifier(Math.abs(sd - (V + AM)) < 0.005 && Math.abs(sc - (V + AM)) < 0.005, `élimination du transfert, symétrique · ${sd} / ${sc} (attendu ${V + AM})`);
    verifier(Math.abs(ag.totaux.debit - ag.totaux.credit) < 0.005 && ag.controles.eliminationsSymetriques && ag.controles.liaison18Neutralisee, `agrégat équilibré, liaison neutralisée (${ag.totaux.debit} / ${ag.totaux.credit})`);

    console.log('Liasse du groupe · le dossier de combinaison');
    r = await A.appeler('GET', `/groupe/liasse/excel?exerciceId=${e2026.id}`, undefined, [200, 400, 409, 500]);
    if (r.statut === 500) { await attendre(1000); console.log(journal.split('\n').filter((x) => /ERROR|Error|at /.test(x)).slice(-30).join('\n')); }
    verifier(r.statut === 200, `liasse produite (${r.statut} ${typeof r.corps === 'string' ? '' : corps(r)})`);
    const comb = (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { dossierCombinaisonId: true } })).dossierCombinaisonId;
    const mvt244 = await prisma.ligneEcriture.aggregate({ where: { compte: { numero: c244.numero }, ecriture: { tenantId: comb, estGenereeParCloture: false } }, _sum: { debit: true, credit: true } });
    verifier(Number(mvt244._sum.debit ?? 0) === 0 && Number(mvt244._sum.credit ?? 0) === 0, `combinaison · aucun mouvement de l'exercice sur le 244, donc ni acquisition ni cession en NOTE 3A (${mvt244._sum.debit ?? 0} / ${mvt244._sum.credit ?? 0})`);
    verifier(!/\b500\b|Internal server error|ERROR \[ExceptionsHandler\]/i.test(journal), 'aucune panne 500 au journal du serveur');
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
    if (/Maillon d'audit NON écrit/.test(journal)) echecs.push('maillon d’audit non écrit au journal du serveur');
  }
  console.log(echecs.length ? `\n${echecs.length} ÉCHEC(S)` : '\nTOUT EST VERT');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
process.on('exit', () => { if (process.env.JOURNAL_SERVEUR) require('node:fs').writeFileSync(process.env.JOURNAL_SERVEUR, globalThis.__journal ?? ''); });
