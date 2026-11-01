#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · relevés MAJEURS de la simulation du 2026-10-08
 * (ligne releves-simulation-majeurs). Serveur COMPILÉ contre une base
 * PostgreSQL jetable déjà migrée.
 *   DATABASE_URL=postgresql://... node scripts/rejouer-releves-simulation-majeurs.cjs
 *
 * N = 2025 · un bien de 1 000 000 sur cinq ans, en service le 01/01/2025,
 * dotation 200 000, dépréciation PAR LE MODULE de 100 000, et une dépréciation
 * de 50 000 passée À LA MAIN (D 6914 / C 2944) ; validation, clôture.
 * N+1 = 2026 ·
 *  · F D2 K1 · le contrôle `DEPRECIATION_IMMO_HORS_MODULE` de 2026 ne nomme
 *    que les 50 000 passés à la main (150 000 avant la correction, l'à-nouveau
 *    de la dépréciation du module étant compté) ;
 *  · F D3 · un second bien de 600 000 sur trois ans, doté de 200 000 en 2025,
 *    révisé RÉTROACTIVEMENT à six ans (cumul rejoué 100 000), reprise D 28 /
 *    C 798 de 100 000 lue en base ; validée, le tableau des flux de 2026 rend FG à zéro (la reprise
 *    en fausse acquisition avant la correction) et ne lève plus la réserve du
 *    798.
 *  · MAG-LIEN · un article tenu sur le 31110000 semé, l'achat porté au
 *    31110001 ouvert dessous · le lien passe (sous le verrou de l'écriture,
 *    requête brute éprouvée sur la base), un second lien au-delà des 300 000
 *    que l'écriture porte est refusé.
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(URL_BASE)) { console.error('DATABASE_URL locale exigée'); process.exit(2); }
const PORT = 8121;
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-rejeu-2026!';
const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
const echecs = [];
const verifier = (c, m) => { if (!c) { echecs.push(m); console.log(`  ECHEC · ${m}`); } else console.log(`  ok · ${m}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const egal = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
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
  statut(m, c, b) { return this.appeler(m, c, b, [200, 201, 400, 403, 404, 409]).then((r) => r); }
}

/** Le solde (débit − crédit) d'une racine, hors écritures de clôture, sur les exercices donnés. */
async function solde(tenantId, racine, exerciceIds) {
  const lignes = await prisma.ligneEcriture.findMany({
    where: {
      compte: { tenantId, numero: { startsWith: racine } },
      ecriture: { tenantId, exerciceId: { in: exerciceIds }, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false, statut: { not: 'SITUATION' } },
    },
    select: { debit: true, credit: true },
  });
  return Math.round(lignes.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0) * 100) / 100;
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    let pret = false;
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) { pret = true; break; } } catch {} await attendre(1000); }
    if (!pret) throw new Error(`serveur non démarré\n${journal.slice(-3000)}`);
    const email = `releves-${Date.now()}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu relevés SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await prisma.user.findFirst({ where: { email } })).tenantId;
    const exercices = await A.get('/exercices');
    const e2026 = exercices.find((e) => e.dateDebut.startsWith('2026'));
    const e2025 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
    const journaux = await A.get('/journaux');
    const od = journaux.find((j) => j.code === 'OD') ?? journaux[0];
    const plan = await A.get('/comptes?typeCompte=DETAIL');
    const compte = (num) => plan.find((c) => c.numero === num);
    for (const num of ['24410000', '48120000', '29440000', '69140000', '79140000', '79800000']) await A.patch(`/comptes/${compte(num).id}`, { estRetenu: true });

    console.log('N = 2025');
    const bien = await A.post('/immobilisations', {
      compteImmobilisationId: compte('24410000').id, designation: 'Mobilier de la salle', dateAcquisition: '2025-01-01', dateMiseEnService: '2025-01-01',
      valeurOrigine: 1_000_000, dureeAmortissementAns: 5, compteContrepartieId: compte('48120000').id, journalId: od.id, exerciceId: e2025.id,
    });
    const dot = await A.post(`/immobilisations/${bien.id}/dotation`, { exerciceId: e2025.id, journalId: od.id });
    verifier(egal(dot.montant, 200_000), `dotation 2025 · 200 000 (lu ${dot.montant})`);
    // Un second bien, sans dépréciation · la révision rétroactive refuse un bien déprécié.
    const bien2 = await A.post('/immobilisations', {
      compteImmobilisationId: compte('24410000').id, designation: 'Rayonnages', dateAcquisition: '2025-01-01', dateMiseEnService: '2025-01-01',
      valeurOrigine: 600_000, dureeAmortissementAns: 3, compteContrepartieId: compte('48120000').id, journalId: od.id, exerciceId: e2025.id,
    });
    const dot2 = await A.post(`/immobilisations/${bien2.id}/dotation`, { exerciceId: e2025.id, journalId: od.id });
    verifier(egal(dot2.montant, 200_000), `dotation 2025 des rayonnages · 200 000 (lu ${dot2.montant})`);
    await A.post(`/immobilisations/${bien.id}/depreciation`, {
      exerciceId: e2025.id, journalId: od.id, sens: 'DOTATION', montant: 100_000,
      compteDepreciationId: compte('29440000').id, compteContrepartieId: compte('69140000').id, indice: 'Usure constatée au comptage de décembre',
    });
    await A.post('/ecritures', {
      exerciceId: e2025.id, journalId: od.id, date: '2025-12-31', libelle: 'Dépréciation passée à la main',
      lignes: [
        { compteId: compte('69140000').id, debit: 50_000, credit: 0 },
        { compteId: compte('29440000').id, debit: 0, credit: 50_000 },
      ],
    });
    await A.post('/ecritures/valider-jusqua', { exerciceId: e2025.id, dateLimite: '2025-12-31' });
    const c25 = await A.get(`/controles?exerciceId=${e2025.id}`);
    const d25 = c25.anomalies.find((a) => a.code === 'DEPRECIATION_IMMO_HORS_MODULE');
    verifier(d25 && egal(d25.occurrences[0].montant, 50_000), `2025 · seule la dépréciation à la main est nommée (lu ${d25?.occurrences?.[0]?.montant})`);
    console.log('Clôture de 2025');
    const r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
    if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 1500));
    const ex25 = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
    verifier(ex25.statut === 'CLOTURE', `exercice 2025 clôturé (${ex25.statut})`);
    const ouverture2944 = await prisma.ligneEcriture.findMany({
      where: { compte: { tenantId, numero: { startsWith: '2944' } }, ecriture: { tenantId, exerciceId: e2026.id } },
      select: { debit: true, credit: true },
    });
    const solde2944 = ouverture2944.reduce((t, l) => t + Number(l.credit) - Number(l.debit), 0);
    verifier(egal(solde2944, 150_000), `2944 à l'ouverture de 2026 · 150 000 au crédit (lu ${solde2944})`);

    console.log('N+1 = 2026 · relevé F D2 K1');
    const c26 = await A.get(`/controles?exerciceId=${e2026.id}`);
    const d26 = c26.anomalies.find((a) => a.code === 'DEPRECIATION_IMMO_HORS_MODULE');
    verifier(d26 && egal(d26.occurrences[0].montant, 50_000), `2026 · l'à-nouveau de la dépréciation du module n'est plus nommé, 50 000 restent (lu ${d26?.occurrences?.[0]?.montant})`);

    console.log('N+1 = 2026 · relevé F D3, révision rétroactive du plan');
    const rev = await A.statut('POST', `/immobilisations/${bien2.id}/revision-plan`, {
      nature: 'RETROACTIVE', dateDecision: '2026-01-02', nouvelleDureeAns: 6, motif: 'Durée d’utilité réestimée', journalId: od.id,
    });
    if (rev.statut >= 400) console.log('   refus de révision ·', JSON.stringify(rev.corps).slice(0, 1500));
    const revision = await prisma.revisionPlanAmortissement.findFirst({ where: { immobilisationId: bien2.id }, select: { ecritureId: true } });
    verifier(revision?.ecritureId, 'la révision rétroactive porte son écriture de reprise');
    const lignesRev = revision?.ecritureId
      ? await prisma.ligneEcriture.findMany({ where: { ecritureId: revision.ecritureId }, select: { debit: true, credit: true, compte: { select: { numero: true } } } })
      : [];
    const reprise = lignesRev.filter((l) => l.compte.numero.startsWith('28')).reduce((t, l) => t + Number(l.debit), 0);
    verifier(egal(reprise, 100_000) && lignesRev.some((l) => l.compte.numero.startsWith('798') && egal(l.credit, reprise)), `reprise D 28 / C 798 de ${reprise}`);
    await A.post('/ecritures/valider-jusqua', { exerciceId: e2026.id, dateLimite: '2026-12-31' });
    const tft = await A.get(`/etats-financiers-syscohada/tableau-flux-tresorerie?exerciceId=${e2026.id}`);
    const fg = tft.lignes.find((l) => l.ref === 'FG');
    verifier(fg && egal(fg.montant, 0), `FG de 2026 à zéro, la reprise neutralisée par sa liaison (lu ${fg?.montant})`);
    const reserve798 = (tft.postesNonCalculables ?? []).filter((p) => p.ref === 'FG' && /798/.test(p.raison));
    verifier(reserve798.length === 0, `la réserve du 798 n'est plus levée pour la reprise du module`);

    console.log('N+1 = 2026 · MAG-LIEN, article sur le 31110000 semé, achat porté au sous-compte 31110001');
    await A.patch(`/comptes/${compte('31110000').id}`, { estRetenu: true });
    const sousCompte = await A.post('/comptes', { numero: '31110001', intitule: 'Marchandises A1 · dépôt central' });
    const article = await A.post('/magasin/articles', { compteId: compte('31110000').id, code: 'CIM', designation: 'Ciment', uniteMesure: 'sac', methodeValorisation: 'CMPACE' });
    const achat = await A.post('/ecritures', {
      exerciceId: e2026.id, journalId: od.id, date: '2026-03-01', libelle: 'Achat de ciment',
      lignes: [
        { compteId: sousCompte.id, debit: 300_000, credit: 0 },
        { compteId: compte('48120000').id, debit: 0, credit: 300_000 },
      ],
    });
    const lien = await A.statut('POST', `/magasin/articles/${article.id}/mouvements`, { date: '2026-03-01', sens: 'ENTREE', quantite: 10, cout: 300_000, piece: 'BL-1', ecritureId: achat.id });
    if (lien.statut >= 400) console.log('   refus du lien ·', JSON.stringify(lien.corps).slice(0, 600));
    verifier(lien.statut < 400, `le lien à l'écriture portée au sous-compte passe, sous le verrou de l'écriture (statut ${lien.statut})`);
    const deTrop = await A.statut('POST', `/magasin/articles/${article.id}/mouvements`, { date: '2026-03-02', sens: 'ENTREE', quantite: 1, cout: 30_000, piece: 'BL-2', ecritureId: achat.id });
    verifier(deTrop.statut === 400 && /en valent 300/.test(JSON.stringify(deTrop.corps)), `un second lien au-delà de ce que l'écriture porte est refusé (statut ${deTrop.statut})`);
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
  }
  console.log(echecs.length === 0 ? '\nTOUT CONCORDE' : `\n${echecs.length} ÉCHEC(S)`);
  process.exit(echecs.length === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
