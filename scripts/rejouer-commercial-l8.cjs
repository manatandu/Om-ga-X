#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DE LA LIGNE commercial-l8 À TRAVERS UNE CLÔTURE
 * (CLAUDE.md § 10). Serveur COMPILÉ contre une base PostgreSQL JETABLE déjà
 * migrée, dossier SYSCOHADA ·
 *  · fonction 30 · l'encours du client lu en 2027 AVANT la clôture de 2026
 *    (remontée sur l'exercice ouvert) puis APRÈS (à-nouveau de clôture), le
 *    même montant ; la vente au-delà de l'encours passe et l'avertit ;
 *  · fonction 90 · l'article et le tarif du client proposent le prix, la
 *    remise et le prix net arrondi (fonction 94) ; la ligne de facture garde
 *    l'article et la remise, qui ne se supprime plus ;
 *  · fonction 91 · le représentant vendeur posé sur le client, le retrait
 *    du rôle refusé ;
 *  · fonction 25 · la devise habituelle servie par compte.
 * Chaque montant lu contre le calcul à la main.
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-commercial-l8.cjs
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE || /neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('DATABASE_URL doit pointer une base JETABLE locale, déjà migrée.');
  process.exit(2);
}
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
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 500)}`); e.statut = r.status; e.corps = j; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b, a) { return this.appeler('PATCH', c, b, a).then((r) => r.corps); }
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await attendre(1000); }
    const email = `l8-${Date.now()}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu commercial-l8 SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const exercices = await A.get('/exercices');
    const ex26 = exercices.find((e) => e.dateDebut.startsWith('2026'));
    const ex27 = await A.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    const comptes = await A.get('/comptes?typeCompte=DETAIL');
    const adopter = async (racine) => { const x = comptes.find((c) => c.numero.startsWith(racine)); if (!x) throw new Error(`compte ${racine}`); await A.patch(`/comptes/${x.id}`, { estRetenu: true }); return x; };
    const vente = await adopter('7011');
    const banque = await adopter('5211');
    const journaux = await A.get('/journaux');
    const vt = journaux.find((j) => j.type === 'VENTES');
    const tr = journaux.find((j) => j.type === 'TRESORERIE') ?? journaux.find((j) => j.type === 'GENERAL');

    // Fonction 91 · un vendeur.
    const vendeur = await A.post('/commercial/collaborateurs', { nom: 'Mbala', prenom: 'Aline', vendeur: true });
    // Fonction 25 · une devise.
    const usd = await A.post('/devises', { code: 'USD', intitule: 'Dollar américain' });
    // Le client, ses comptes, son représentant, sa devise, son encours maximum (fonction 30).
    const cli = await A.post('/tiers', { type: 'CLIENT', code: 'C-L8', nom: 'Client rejeu', representantId: vendeur.id, deviseId: usd.id, encoursMaximum: 150_000 });
    const compteClient = cli.compteIndividuel;
    verifier(!!compteClient?.id, `le client naît avec son compte ${compteClient?.numero}`);
    let refus = null;
    try { await A.patch(`/commercial/collaborateurs/${vendeur.id}`, { vendeur: false }); } catch (e) { refus = e; }
    verifier(refus?.statut === 409 && /représente 1 tiers/.test(refus.message), `91 · retrait du rôle de vendeur refusé en 409 (${refus?.statut})`);
    const devisesComptes = await A.get('/tiers/devises-des-comptes');
    verifier(devisesComptes.comptes.some((c) => c.compteId === compteClient.id && c.devise === 'USD'), '25 · la devise habituelle est servie pour le compte du client');

    // 2026 · une vente de 100 000 et un règlement de 20 000, validés.
    await A.post('/ecritures', { exerciceId: ex26.id, journalId: vt.id, date: '2026-06-01', libelle: 'F2026', lignes: [{ compteId: compteClient.id, debit: 100_000, credit: 0, dateEcheance: '2026-06-30' }, { compteId: vente.id, debit: 0, credit: 100_000 }] });
    await A.post('/ecritures', { exerciceId: ex26.id, journalId: tr.id, date: '2026-07-01', libelle: 'R2026', lignes: [{ compteId: banque.id, debit: 20_000, credit: 0 }, { compteId: compteClient.id, debit: 0, credit: 20_000 }] });
    await A.post('/ecritures/valider-jusqua', { exerciceId: ex26.id, dateLimite: '2026-12-31' });

    // Fonction 30 · en 2027, AVANT la clôture · la remontée sur 2026 ouvert.
    let e = await A.get(`/commercial/encours/${cli.id}?date=2027-02-01`);
    verifier(e.soldeComptable === 80_000 && e.encours === 80_000 && e.depassement === null, `30 · 2027 avant clôture · solde ${e.soldeComptable}, encours ${e.encours}`);
    e = await A.get(`/commercial/encours/${cli.id}?date=2027-02-01&venteEnCours=80000`);
    verifier(e.depassement === 10_000 && /dépassé/.test(e.avertissement ?? ''), `30 · vente en préparation de 80 000 · dépassement ${e.depassement}`);

    await A.post(`/exercices/${ex26.id}/cloturer`, {});
    verifier(true, 'clôture de 2026');
    e = await A.get(`/commercial/encours/${cli.id}?date=2027-02-01`);
    verifier(e.soldeComptable === 80_000, `30 · 2027 après clôture · solde ${e.soldeComptable} lu sur l'à-nouveau, sans double compte`);

    // Fonctions 94 et 90 · mode d'arrondi, article, tarif du client.
    const mode = await A.post('/commercial/modes-arrondi', { intitule: 'Cent francs supérieur', methode: 'SUPERIEUR', pas: 100 });
    const art = await A.post('/commercial/articles', { reference: 'CIM50', designation: 'Ciment 50 kg', unite: 'sac', compteVenteId: vente.id, prixVenteHT: 30_000, modeArrondiId: mode.id });
    await A.appeler('PUT', '/commercial/tarifs', { articleId: art.id, tiersId: cli.id, remisePourcent: 12.5 });
    const p = await A.get(`/commercial/articles-proposition-prix?articleId=${art.id}&tiersId=${cli.id}`);
    // 30 000 × 0,875 = 26 250 · arrondi au cent supérieur, 26 300.
    verifier(p.prixUnitaireHT === 30_000 && p.remisePourcent === 12.5 && p.prixNetUnitaireHT === 26_300 && p.compteId === vente.id, `90 · prix ${p.prixUnitaireHT}, remise ${p.remisePourcent} %, net ${p.prixNetUnitaireHT}`);

    // La vente de 2027 · 3 sacs à 26 300 = 78 900 HT, au-delà de l'encours (80 000 + 78 900 > 150 000).
    const f = await A.post('/facturation', { sens: 'VENTE', numeroSerie: 'FV-L8-1', dateFacture: '2027-02-02', tiersId: cli.id, lignes: [{ designation: 'Ciment 50 kg', quantite: 3, prixUnitaire: 30_000, montantHT: 78_900, remisePourcent: 12.5, articleId: art.id }] });
    verifier(/dépassé · ce client devrait 158\s900,00/.test(f.avertissementEncours ?? ''), `30 · la facture passe et avertit · ${f.avertissementEncours}`);
    const lue = await prisma.ligneFacture.findFirst({ where: { factureId: f.id } });
    verifier(lue && String(lue.remisePourcent) === '12.5' && lue.articleId === art.id, '90 · la ligne garde la remise et l’article');
    refus = null;
    try { await A.appeler('DELETE', `/commercial/articles/${art.id}`); } catch (x) { refus = x; }
    verifier(refus && refus.statut >= 400 && /lignes de facture/.test(refus.message), `90 · l'article facturé ne se supprime plus (${refus?.statut})`);
  } finally {
    srv.kill();
    await prisma.$disconnect();
    if (echecs.length) {
      console.log(`\n${echecs.length} échec(s).`);
      console.log(journal.split('\n').filter((l) => /ERROR|Error/.test(l)).slice(-20).join('\n'));
      process.exitCode = 1;
    } else console.log('\nTout est conforme.');
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
