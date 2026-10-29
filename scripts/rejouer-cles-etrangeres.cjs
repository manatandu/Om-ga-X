#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DE LA RÈGLE F DU CLOISONNEMENT (clés étrangères
 * jugées dans le dossier · audit de sécurité du 2026-10-25, zone différée 1 et
 * piste 6 · CLAUDE.md § 10). Serveur COMPILÉ contre une base PostgreSQL
 * JETABLE déjà migrée · deux dossiers SYSCOHADA, A et B ·
 *  · A passe une écriture sur un compte de B, puis sur un journal de B · refus,
 *    rien d'écrit chez A ni chez B ;
 *  · A passe ses écritures ordinaires, les valide, traverse la clôture de 2026
 *    (report à nouveau, solde des comptes de gestion) et saisit en 2027 · rien
 *    n'est refusé à tort, soldes lus contre le calcul à la main.
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-cles-etrangeres.cjs
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE || /neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('DATABASE_URL doit pointer une base JETABLE locale, déjà migrée.');
  process.exit(2);
}
const PORT = 8094;
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
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 500)}`); e.statut = r.status; e.corps = j; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b) { return this.appeler('PATCH', c, b).then((r) => r.corps); }
}

async function dossier(nom) {
  const email = `${nom}-${Date.now()}@exemple.invalid`;
  const c = new Client();
  await c.post('/auth/register', { nomEntite: `Rejeu F ${nom}`, referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
  await c.post('/auth/login', { email, motDePasse: MDP });
  const exercices = await c.get('/exercices');
  const ex26 = exercices.find((e) => e.dateDebut.startsWith('2026'));
  const comptes = await c.get('/comptes?typeCompte=DETAIL');
  const adopter = async (racine) => { const x = comptes.find((k) => k.numero.startsWith(racine)); await c.patch(`/comptes/${x.id}`, { estRetenu: true }); return x; };
  const journaux = await c.get('/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
  const tenantId = (await prisma.user.findUnique({ where: { email }, select: { tenantId: true } })).tenantId;
  return { c, ex26, od, adopter, tenantId };
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await attendre(1000); }
    const A = await dossier('a');
    const B = await dossier('b');
    const banqueA = await A.adopter('5211');
    const capitalA = await A.adopter('1013');
    const chargeA = await A.adopter('6052');
    const produitA = await A.adopter('7011');
    const banqueB = await B.adopter('5211');
    const deux = (d, c, m) => [{ compteId: d.id, libelle: 'L', debit: m, credit: 0 }, { compteId: c.id, libelle: 'L', debit: 0, credit: m }];
    const ecr = (x, exId, journalId, date, libelle, lignes, attendu) => x.c.post('/ecritures', { exerciceId: exId, journalId, date, libelle, lignes }, attendu);

    // 1. La ligne voisine · un compte de B dans une écriture de A.
    const avant = await prisma.ecriture.count();
    const refus = await A.c.appeler('POST', '/ecritures', { exerciceId: A.ex26.id, journalId: A.od.id, date: '2026-02-01', libelle: 'Compte voisin', lignes: deux(banqueA, banqueB, 1000) }, [400, 403, 404, 409, 422, 500]);
    verifier(refus.statut >= 400, `écriture sur un compte de B refusée (${refus.statut})`);
    const refusJ = await A.c.appeler('POST', '/ecritures', { exerciceId: A.ex26.id, journalId: B.od.id, date: '2026-02-01', libelle: 'Journal voisin', lignes: deux(banqueA, capitalA, 1000) }, [400, 403, 404, 409, 422, 500]);
    verifier(refusJ.statut >= 400, `écriture sur un journal de B refusée (${refusJ.statut})`);
    verifier((await prisma.ecriture.count()) === avant, 'rien d’écrit par les deux refus');
    const lignesB = await prisma.ligneEcriture.count({ where: { compteId: banqueB.id } });
    verifier(lignesB === 0, `aucune ligne sur le compte de B (${lignesB})`);

    // 1 bis. LA RÈGLE ELLE-MÊME, par le client étendu du serveur compilé · une
    // mise à jour qu'aucun service ne contrôle porte une ligne de A sur le
    // compte de B. Les refus ci-dessus venaient des contrôles du service.
    {
      const { PrismaService } = require(join(RACINE, 'dist', 'common', 'prisma.service.js'));
      const { dansContexteAudit } = require(join(RACINE, 'dist', 'common', 'audit', 'contexte-audit.js'));
      const etendu = new PrismaService();
      await etendu.$connect();
      try {
        const e = await ecr(A, A.ex26.id, A.od.id, '2026-01-03', 'Témoin', deux(banqueA, capitalA, 1));
        const ligne = await prisma.ligneEcriture.findFirst({ where: { ecritureId: e.id }, select: { id: true } });
        const tenterVers = (compteId) =>
          dansContexteAudit({ acteurEmail: 'rejeu@exemple.invalid', tenantId: A.tenantId }, async () => {
            // ATTENDUE DANS LA PORTÉE · une requête Prisma rendue sans être
            // attendue ne s'exécute qu'après la fin du contexte du dossier.
            await etendu.ligneEcriture.update({ where: { id: ligne.id }, data: { compteId } });
          }).then(() => 'passé', (x) => `${x.name} · ${x.message}`);
        const etranger = await tenterVers(banqueB.id);
        verifier(/introuvable dans ce dossier/.test(etranger), `règle F · compte de B refusé par la garde (${etranger.slice(0, 120)})`);
        const relue = await prisma.ligneEcriture.findUnique({ where: { id: ligne.id }, select: { compteId: true } });
        verifier(relue.compteId === banqueA.id, 'la ligne garde son compte');
        verifier((await tenterVers(banqueA.id)) === 'passé', 'règle F · le compte du dossier passe');
        await A.c.appeler('DELETE', `/ecritures/${e.id}`, undefined, [200, 204]);
      } finally {
        await etendu.$disconnect();
      }
    }

    // 2. Le chemin ordinaire à travers une clôture.
    await ecr(A, A.ex26.id, A.od.id, '2026-01-02', 'Apport', deux(banqueA, capitalA, 10_000_000));
    for (let i = 0; i < 40; i++) await ecr(A, A.ex26.id, A.od.id, `2026-03-${String(1 + (i % 28)).padStart(2, '0')}`, `Charge ${i}`, deux(chargeA, banqueA, 50_000));
    for (let i = 0; i < 20; i++) await ecr(A, A.ex26.id, A.od.id, `2026-06-${String(1 + (i % 28)).padStart(2, '0')}`, `Vente ${i}`, deux(banqueA, produitA, 120_000));
    await A.c.post('/ecritures/valider-jusqua', { exerciceId: A.ex26.id, dateLimite: '2026-12-31' });
    const ex27 = await A.c.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    try {
      await A.c.post(`/exercices/${A.ex26.id}/cloturer`, {});
      verifier(true, 'clôture de 2026');
    } catch (e) {
      verifier(false, `clôture de 2026 · ${e.message}`);
    }
    const report = await prisma.ligneEcriture.aggregate({ where: { compteId: banqueA.id, ecriture: { exerciceId: ex27.id } }, _sum: { debit: true, credit: true } });
    const attendu = 10_000_000 - 40 * 50_000 + 20 * 120_000;
    verifier(Number(report._sum.debit ?? 0) - Number(report._sum.credit ?? 0) === attendu, `report 2027 du 521 · ${Number(report._sum.debit ?? 0) - Number(report._sum.credit ?? 0)} = ${attendu}`);
    await ecr(A, ex27.id, A.od.id, '2027-01-15', 'Charge 2027', deux(chargeA, banqueA, 30_000));
    verifier(true, 'saisie en 2027');
    verifier((journal.match(/CloisonnementViole|introuvable dans ce dossier/g) ?? []).length === 0, 'aucun refus de la garde au journal du serveur');
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
    require('node:fs').writeFileSync(join(process.env.JOURNAL_DIR || '/tmp', 'rejeu-cles-etrangeres-serveur.log'), journal);
  }
  console.log(echecs.length === 0 ? '\nREJEU VERT' : `\nREJEU ROUGE · ${echecs.length} échec(s)`);
  process.exit(echecs.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
