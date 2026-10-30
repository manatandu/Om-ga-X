#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · ligne analytique (fonctions 48, 51, 52, 53).
 * Serveur COMPILÉ contre une base PostgreSQL jetable déjà migrée.
 *   DATABASE_URL=postgresql://... node scripts/rejouer-analytique.cjs
 *
 * N = 2025 · un axe à trois sections (P1, P2, P3), une grille du compte de
 * charge (P1 60 %, P2 40 %), une pièce du 10/03 · charge 1 000 ventilée selon
 * la grille (600 / 400), produit 2 000 non ventilé, banque en contrepartie ;
 * budget du compte de charge 1 200, mars retouché à 250 (l'année suit,
 * 1 350) ; validation, clôture.
 * N+1 = 2026 · budget 1 500 ; pièce du 15/01 · charge 800 sur P1, autre
 * charge 50 non ventilée ; OD analytique de 100 de P1 vers P2.
 * Chaque chiffre lu contre le calcul à la main ·
 *   2025 après clôture · réalisé de la charge 1 000 (jamais 0, jamais 2 000 ·
 *     l'écriture qui solde les comptes de gestion est exclue) ; non ventilées
 *     · une ligne, le produit de 2 000 ; journal · deux lignes, 1 000 au débit.
 *   2026 · réalisé 800, N-1 1 000 ; janvier · budget 125, réalisé 800, N-1 0 ;
 *     le produit, sans budget, mouvementé en N-1 · hors budget ; journal ·
 *     trois lignes (une ventilation, deux lignes d'OD), « OD seules » deux ;
 *     balance · P1 700, P2 100, P3 masquée sous « mouvementées », totaux
 *     inchangés ; non ventilées · la charge de 50.
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(URL_BASE)) { console.error('DATABASE_URL locale exigée'); process.exit(2); }
const PORT = 8097;
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

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    let pret = false;
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) { pret = true; break; } } catch {} await attendre(1000); }
    if (!pret) throw new Error(`serveur non démarré\n${journal.slice(-3000)}`);
    const email = `analytique-${Date.now()}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu analytique SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const exercices = await A.get('/exercices');
    const e2026 = exercices.find((e) => e.dateDebut.startsWith('2026'));
    const e2025 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
    const journaux = await A.get('/journaux');
    const od = journaux.find((j) => j.code === 'OD') ?? journaux[0];
    const plan = await A.get('/comptes?typeCompte=DETAIL');
    const premier = (prefixe) => plan.find((c) => c.numero.startsWith(prefixe) && c.typeCompte === 'DETAIL');
    const charge = premier('604');
    const autre = premier('605');
    const produit = premier('701');
    const banque = premier('521');
    for (const c of [charge, autre, produit, banque]) await A.patch(`/comptes/${c.id}`, { estRetenu: true });
    console.log(`comptes · ${charge.numero}, ${autre.numero}, ${produit.numero}, ${banque.numero}`);

    const plans = await A.get('/analytique/plans');
    const axe = plans.find((p) => ['6', '7'].every((c) => p.classesVentilees.split(',').includes(c)));
    const s1 = await A.post(`/analytique/plans/${axe.id}/sections`, { code: 'P1', intitule: 'Projet eau' });
    const s2 = await A.post(`/analytique/plans/${axe.id}/sections`, { code: 'P2', intitule: 'Projet école' });
    const s3 = await A.post(`/analytique/plans/${axe.id}/sections`, { code: 'P3', intitule: 'Projet santé' });

    console.log('n° 48 · la grille du compte de charge');
    let r = await A.statut('POST', '/analytique/grilles', { compteId: charge.id, planId: axe.id, lignes: [{ sectionId: s1.id, pourcentage: 60 }, { sectionId: s2.id, pourcentage: 39 }] });
    verifier(r.statut === 400 && /99\.00 %/.test(JSON.stringify(r.corps)), `une grille à 99 % est refusée (${r.statut})`);
    r = await A.statut('POST', '/analytique/grilles', { compteId: banque.id, planId: axe.id, lignes: [{ sectionId: s1.id, pourcentage: 100 }] });
    verifier(r.statut === 400 && /ne ventile pas la classe 5/.test(JSON.stringify(r.corps)), `une grille sur la banque est refusée (${r.statut})`);
    let grilles = await A.post('/analytique/grilles', { compteId: charge.id, planId: axe.id, lignes: [{ sectionId: s1.id, pourcentage: 60 }, { sectionId: s2.id, pourcentage: 40 }] });
    verifier(grilles.grilles.length === 1 && grilles.grilles[0].inapplicable === null, 'la grille est posée et se propose');
    grilles = await A.post('/analytique/grilles', { compteId: charge.id, planId: axe.id, lignes: [{ sectionId: s1.id, pourcentage: 60 }, { sectionId: s2.id, pourcentage: 40 }] });
    verifier(grilles.grilles.length === 1, 'reposée, elle remplace la précédente · une grille par compte et par axe');

    console.log('N = 2025');
    const piece = await A.post('/ecritures', {
      exerciceId: e2025.id, journalId: od.id, date: '2025-03-10', libelle: 'Achats et ventes de mars',
      lignes: [
        // La grille répartie comme l'écran la répartit · 1 000 en 60 / 40.
        { compteId: charge.id, debit: 1000, ventilations: [{ sectionId: s1.id, debit: 600 }, { sectionId: s2.id, debit: 400 }] },
        { compteId: banque.id, credit: 1000 },
        { compteId: banque.id, debit: 2000 },
        { compteId: produit.id, credit: 2000 },
      ],
    });
    verifier(!!piece.id, 'la pièce ventilée selon la grille est acceptée par le serveur');

    console.log('n° 51 · budget 2025 du compte de charge');
    let b = await A.post(`/analytique/comptes/${charge.id}/budget`, { exerciceId: e2025.id, montantAnnuel: 1200 });
    verifier(egal(b.annuel, 1200) && b.mensuel.length === 12 && b.mensuel.every((m) => egal(m.montant, 100)), `1 200 réparti en douze fois 100 (lu ${JSON.stringify(b)})`);
    b = await A.patch(`/analytique/comptes/${charge.id}/budget`, { exerciceId: e2025.id, mois: 3, montant: 250 });
    verifier(egal(b.annuel, 1350), `mars à 250, l'année suit · 1 350 (lu ${b.annuel})`);
    r = await A.statut('POST', `/analytique/comptes/${banque.id}/budget`, { exerciceId: e2025.id, montantAnnuel: 10 });
    verifier(r.statut === 400 && /classes 6 et 7/.test(JSON.stringify(r.corps)), `la banque ne se budgète pas (${r.statut})`);

    await A.post('/ecritures/valider-jusqua', { exerciceId: e2025.id, dateLimite: '2025-12-31' });
    console.log('Clôture de 2025');
    r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
    if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 1500));
    const ex25 = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
    verifier(ex25.statut === 'CLOTURE', `exercice 2025 clôturé (${ex25.statut})`);
    const soldeGestion = await prisma.ecriture.count({ where: { exerciceId: e2025.id, estSoldeDesComptesDeGestion: true } });
    verifier(soldeGestion >= 1, `l'écriture qui solde les comptes de gestion existe (${soldeGestion})`);

    console.log('2025 relu après la clôture');
    let etat = await A.get(`/analytique/etats/budget-comptes?exerciceId=${e2025.id}`);
    const l25 = etat.lignes.find((l) => l.compteId === charge.id);
    verifier(egal(l25?.realise, 1000) && egal(l25?.budget, 1350), `réalisé 2025 de la charge · 1 000, budget 1 350 (lu ${l25?.realise}, ${l25?.budget})`);
    const p25 = etat.lignes.find((l) => l.compteId === produit.id);
    verifier(egal(p25?.realise, 2000) && p25?.horsBudget === true, `produit 2025 · 2 000, hors budget (lu ${p25?.realise})`);
    verifier(etat.exercicePrecedent === null && /pas d'exercice précédent/.test(etat.motifN1 ?? ''), 'aucun N-1 pour 2025, et c’est dit');
    r = await A.statut('POST', `/analytique/comptes/${charge.id}/budget`, { exerciceId: e2025.id, montantAnnuel: 5 });
    verifier(r.statut === 400 && /clôturé/.test(JSON.stringify(r.corps)), `le budget d'un exercice clôturé ne se modifie plus (${r.statut})`);
    let nv = await A.get(`/analytique/etats/non-ventilees?planId=${axe.id}&exerciceId=${e2025.id}`);
    verifier(nv.total === 1 && egal(nv.totaux.credit, 2000) && nv.lignes[0]?.compteNumero === produit.numero, `non ventilées 2025 · le seul produit de 2 000, jamais l'écriture de clôture (lu ${nv.total}, ${JSON.stringify(nv.totaux)})`);
    let jr = await A.get(`/analytique/etats/journal?planId=${axe.id}&exerciceId=${e2025.id}`);
    verifier(jr.total === 2 && egal(jr.totaux.debit, 1000) && !jr.tronque, `journal 2025 · deux lignes, 1 000 au débit (lu ${jr.total}, ${JSON.stringify(jr.totaux)})`);
    const cc = await A.get(`/analytique/etats/controle-cumuls?exerciceId=${e2025.id}&planId=${axe.id}`);
    verifier(cc[0]?.nombreSansRepartition === nv.total, `le contrôle des cumuls compte les mêmes lignes (${cc[0]?.nombreSansRepartition})`);

    console.log('N+1 = 2026');
    await A.post(`/analytique/comptes/${charge.id}/budget`, { exerciceId: e2026.id, montantAnnuel: 1500 });
    await A.post('/ecritures', {
      exerciceId: e2026.id, journalId: od.id, date: '2026-01-15', libelle: 'Achats de janvier',
      lignes: [
        { compteId: charge.id, debit: 800, ventilations: [{ sectionId: s1.id, debit: 800 }] },
        { compteId: autre.id, debit: 50 },
        { compteId: banque.id, credit: 850 },
      ],
    });
    await A.post('/analytique/od', {
      exerciceId: e2026.id, planId: axe.id, compteId: charge.id, date: '2026-01-31', libelle: 'Reclassement P1 vers P2',
      lignes: [{ sectionId: s1.id, credit: 100 }, { sectionId: s2.id, debit: 100 }],
    });
    etat = await A.get(`/analytique/etats/budget-comptes?exerciceId=${e2026.id}`);
    const l26 = etat.lignes.find((l) => l.compteId === charge.id);
    verifier(egal(l26?.realise, 800) && egal(l26?.realiseN1, 1000) && egal(l26?.budget, 1500), `2026 · réalisé 800, N-1 1 000, budget 1 500 (lu ${JSON.stringify(l26)})`);
    const p26 = etat.lignes.find((l) => l.compteId === produit.id);
    verifier(p26?.horsBudget === true && egal(p26?.realise, 0) && egal(p26?.realiseN1, 2000), `le produit, mouvementé en N-1 seulement · hors budget (lu ${JSON.stringify(p26)})`);
    etat = await A.get(`/analytique/etats/budget-comptes?exerciceId=${e2026.id}&mois=1`);
    const j26 = etat.lignes.find((l) => l.compteId === charge.id);
    verifier(egal(j26?.budget, 125) && egal(j26?.realise, 800) && egal(j26?.realiseN1, 0), `janvier 2026 · budget 125, réalisé 800, N-1 0 (lu ${JSON.stringify(j26)})`);
    verifier(j26?.defavorable === true, 'une charge au-delà de son budget est défavorable');

    jr = await A.get(`/analytique/etats/journal?planId=${axe.id}&exerciceId=${e2026.id}`);
    verifier(jr.total === 3 && egal(jr.totaux.debit, 900) && egal(jr.totaux.credit, 100), `journal 2026 · trois lignes, 900 / 100 (lu ${jr.total}, ${JSON.stringify(jr.totaux)})`);
    const jrOd = await A.get(`/analytique/etats/journal?planId=${axe.id}&exerciceId=${e2026.id}&origine=OD`);
    verifier(jrOd.total === 2 && jrOd.lignes.every((l) => l.journal === 'OD ANA'), `journal 2026, OD seules · deux lignes « OD ANA » (lu ${jrOd.total})`);
    r = await A.statut('GET', `/analytique/etats/journal?planId=${axe.id}&exerciceId=${e2026.id}&origine=REPORTS`);
    verifier(r.statut === 400, `une origine inconnue est refusée (${r.statut})`);

    console.log('n° 53 · balance 2026 filtrée');
    const toutes = await A.get(`/analytique/etats/balance?planId=${axe.id}&exerciceId=${e2026.id}`);
    const mvt = await A.get(`/analytique/etats/balance?planId=${axe.id}&exerciceId=${e2026.id}&filtre=MOUVEMENTEES`);
    const lp1 = toutes.lignes.find((l) => l.code === 'P1');
    const lp2 = toutes.lignes.find((l) => l.code === 'P2');
    verifier(egal(lp1?.solde, 700) && egal(lp2?.solde, 100), `P1 700, P2 100 (lu ${lp1?.solde}, ${lp2?.solde})`);
    verifier(!mvt.lignes.some((l) => l.code === 'P3') && mvt.masquees >= 1, `P3 masquée sous « mouvementées » (${mvt.masquees} masquée·s)`);
    verifier(egal(mvt.totaux.debit, toutes.totaux.debit) && egal(mvt.totaux.credit, toutes.totaux.credit), 'les totaux ne changent pas avec le filtre');
    r = await A.statut('GET', `/analytique/etats/balance?planId=${axe.id}&exerciceId=${e2026.id}&filtre=SOLDEES`);
    verifier(r.statut === 400, `un filtre inconnu est refusé (${r.statut})`);

    nv = await A.get(`/analytique/etats/non-ventilees?planId=${axe.id}&exerciceId=${e2026.id}`);
    verifier(nv.total === 1 && egal(nv.totaux.debit, 50) && nv.lignes[0]?.compteNumero === autre.numero, `non ventilées 2026 · la charge de 50 (lu ${nv.total})`);

    console.log('n° 48 · une section en sommeil suspend la grille');
    await A.patch(`/analytique/sections/${s2.id}`, { estActive: false });
    grilles = await A.get('/analytique/grilles');
    verifier(/sommeil/.test(grilles.grilles[0]?.inapplicable ?? ''), `la grille dit pourquoi elle ne se propose plus (${grilles.grilles[0]?.inapplicable})`);
    r = await A.statut('DELETE', `/analytique/sections/${s2.id}`);
    verifier(r.statut === 409 || r.statut === 400, `la section que la grille nomme ne se supprime pas (${r.statut} ${JSON.stringify(r.corps).slice(0, 160)})`);
    await A.del(`/analytique/grilles/${grilles.grilles[0].id}`);
    grilles = await A.get('/analytique/grilles');
    verifier(grilles.total === 0, 'la grille retirée, la liste est vide');
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
  }
  console.log(echecs.length === 0 ? '\nREJEU VERT' : `\nREJEU ROUGE · ${echecs.length} échec(s)`);
  process.exit(echecs.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
