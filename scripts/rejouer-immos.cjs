#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · ligne immos (fonctions 65, 69, 70, 71, 72).
 * Serveur COMPILÉ contre une base PostgreSQL jetable déjà migrée.
 *   DATABASE_URL=postgresql://... node scripts/rejouer-immos.cjs
 *
 * N = 2025 · un lot de dix chaises (1 000 000, cinq ans, en service le
 * 01/01/2025, section analytique sur la fiche, numéro de série) et deux
 * ordinateurs (300 000 chacun, trois ans) · dotations passées et ventilées,
 * dépréciation du lot de 100 000 à la clôture, validation, clôture.
 * N+1 = 2026 · simulation, sortie de trois chaises au 30/06 (part au
 * centime), sortie globale des deux ordinateurs au 30/09, dotation du lot ·
 * chaque solde lu contre le montant calculé à la main :
 *   chaises · annuité 2026 = (1 000 000 − 200 000 − 100 000) / 4 = 175 000 ;
 *     complément du lot au 30/06 = 87 500 ; 3/10 · brut 300 000, cumul
 *     60 000, dépréciation 30 000, complément 26 250, VNC au 81 = 213 750 ;
 *     le lot garde 700 000, cumul 140 000, dépréciation 70 000, et se dote
 *     de (700 000 − 140 000 − 70 000) / 4 = 122 500.
 *   ordinateurs · complément au 30/09 = 75 000 chacun, VNC 125 000 chacun.
 *   2441 = 700 000 ; 2844 = 262 500 ; 2944 = 70 000 ; 812 (2026) = 463 750 ;
 *   7914 (2026) = 30 000 ; 6813 (2026) = 298 750 ; ventilation de la section
 *   · 200 000 en 2025, 148 750 en 2026.
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(URL_BASE)) { console.error('DATABASE_URL locale exigée'); process.exit(2); }
const PORT = 8098;
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
    const stamp = Date.now();
    const email = `immos-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu immos SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await prisma.user.findFirst({ where: { email } })).tenantId;
    let exercices = await A.get('/exercices');
    const e2026 = exercices.find((e) => e.dateDebut.startsWith('2026'));
    const e2025 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
    const journaux = await A.get('/journaux');
    const od = journaux.find((j) => j.code === 'OD') ?? journaux[0];
    const plan = await A.get('/comptes?typeCompte=DETAIL');
    const compte = (num) => plan.find((c) => c.numero === num);
    for (const num of ['24410000', '48120000', '29440000', '69140000', '79140000']) await A.patch(`/comptes/${compte(num).id}`, { estRetenu: true });

    // La section analytique (n° 70) · un plan du dossier qui ventile la classe 6.
    const plans = await A.get('/analytique/plans');
    const planA = plans.find((p) => p.classesVentilees.split(',').includes('6'));
    const section = await A.post(`/analytique/plans/${planA.id}/sections`, { code: 'P01', intitule: 'Projet eau' });
    const servies = await A.get('/immobilisations/sections-analytiques');
    verifier(servies.sections.some((s) => s.id === section.id), 'n° 70 · la section est servie aux biens');

    console.log('N = 2025');
    const nouveau = (designation, valeur, duree, extra = {}) =>
      A.post('/immobilisations', {
        compteImmobilisationId: compte('24410000').id, designation, dateAcquisition: '2025-01-01', dateMiseEnService: '2025-01-01',
        valeurOrigine: valeur, dureeAmortissementAns: duree, compteContrepartieId: compte('48120000').id, journalId: od.id, exerciceId: e2025.id, ...extra,
      });
    const chaises = await nouveau('Chaises de la salle', 1_000_000, 5, { quantite: 10, numeroSerie: 'LOT-CH-2025', sectionAnalytiqueId: section.id });
    const pc1 = await nouveau('Ordinateur 1', 300_000, 3);
    const pc2 = await nouveau('Ordinateur 2', 300_000, 3);
    verifier(chaises.quantite === 10 && chaises.numeroSerie === 'LOT-CH-2025', 'n° 65 et 71 · quantité et numéro de série sur la fiche');
    const dot = await A.post(`/immobilisations/${chaises.id}/dotation`, { exerciceId: e2025.id, journalId: od.id });
    verifier(egal(dot.montant, 200_000) && dot.ventilation?.section === 'P01' && dot.ventilation.nonVentilee === null, `n° 70 · dotation 2025 des chaises 200 000, ventilée sur P01 (lu ${dot.montant}, ${JSON.stringify(dot.ventilation)})`);
    for (const b of [pc1, pc2]) await A.post(`/immobilisations/${b.id}/dotation`, { exerciceId: e2025.id, journalId: od.id });
    await A.post(`/immobilisations/${chaises.id}/depreciation`, {
      exerciceId: e2025.id, journalId: od.id, sens: 'DOTATION', montant: 100_000,
      compteDepreciationId: compte('29440000').id, compteContrepartieId: compte('69140000').id, indice: 'Usure constatée au comptage de décembre',
    });
    await A.post('/ecritures/valider-jusqua', { exerciceId: e2025.id, dateLimite: '2025-12-31' });
    console.log('Clôture de 2025');
    let r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
    if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 1500));
    const ex25 = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
    verifier(ex25.statut === 'CLOTURE', `exercice 2025 clôturé (${ex25.statut})`);

    console.log('N+1 = 2026 · simulation (n° 72)');
    const sim = await A.get(`/immobilisations/simulation-dotations?exerciceId=${e2026.id}&exercices=5`);
    const simCh = sim.biens.find((b) => b.id === chaises.id);
    verifier(JSON.stringify(simCh?.annuites) === JSON.stringify([175_000, 175_000, 175_000, 175_000, 0]), `simulation des chaises · 175 000 × 4 puis 0 (lu ${JSON.stringify(simCh?.annuites)})`);
    const simPc = sim.biens.find((b) => b.id === pc1.id);
    verifier(JSON.stringify(simPc?.annuites) === JSON.stringify([100_000, 100_000, 0, 0, 0]), `simulation d'un ordinateur · 2026 et 2027 puis 0 (lu ${JSON.stringify(simPc?.annuites)})`);
    verifier(sim.periodes.filter((p) => p.fictive).length >= 3, 'les années au-delà des exercices ouverts sont dites fictives');

    console.log('n° 65 · trois chaises sortent le 30/06/2026');
    const sortie = {
      type: 'MISE_HORS_SERVICE', dateSortie: '2026-06-30', exerciceId: e2026.id, journalId: od.id,
      natureSortie: 'MISE_AU_REBUT', referencePieceSortie: 'PV-REBUT-01', datePieceSortie: '2026-06-30',
    };
    r = await A.statut('POST', `/immobilisations/${chaises.id}/sortie-partielle`, { ...sortie, quantiteSortie: 10 });
    verifier(r.statut === 400 && /en entier/.test(JSON.stringify(r.corps)), `les dix chaises · refusé, c'est la sortie entière (${r.statut})`);
    const ecrituresAvant = await prisma.ecriture.count({ where: { tenantId } });
    const part = await A.post(`/immobilisations/${chaises.id}/sortie-partielle`, { ...sortie, quantiteSortie: 3 });
    verifier(egal(part.part.brut, 300_000) && egal(part.part.cumulOuverture, 60_000) && egal(part.part.depreciation, 30_000) && egal(part.part.complement, 26_250), `part des trois chaises · 300 000 / 60 000 / 30 000 / 26 250 (lu ${JSON.stringify(part.part)})`);
    const lot = await prisma.immobilisation.findUnique({ where: { id: chaises.id }, select: { quantite: true, valeurOrigine: true, amortissementsDetaches: true } });
    verifier(lot.quantite === 7 && egal(lot.valeurOrigine, 700_000) && egal(lot.amortissementsDetaches, 60_000), `le lot garde 7 chaises, 700 000, 60 000 détachés (lu ${lot.quantite}, ${lot.valeurOrigine}, ${lot.amortissementsDetaches})`);
    const unites = await prisma.immobilisation.findUnique({ where: { id: part.unites.id }, select: { statut: true, fractionDeId: true, quantite: true, ecritureSortieId: true } });
    verifier(unites.statut === 'MISE_HORS_SERVICE' && unites.fractionDeId === chaises.id && unites.quantite === 3, 'la fiche des unités, née du lot, est sortie');
    const lignesSortie = await prisma.ligneEcriture.findMany({ where: { ecritureId: unites.ecritureSortieId }, select: { debit: true, credit: true, compte: { select: { numero: true } } } });
    const l81 = lignesSortie.find((l) => l.compte.numero.startsWith('812'));
    verifier(l81 && egal(l81.debit, 213_750), `VNC des trois chaises au 812 · 213 750 (lu ${l81?.debit})`);
    console.log('   écritures nées ·', (await prisma.ecriture.count({ where: { tenantId } })) - ecrituresAvant);

    console.log('n° 69 · sortie globale des deux ordinateurs le 30/09/2026');
    r = await A.statut('POST', '/immobilisations/sortie-globale', { ...sortie, natureSortie: 'VOL', dateSortie: '2026-09-30', datePieceSortie: '2026-10-02', referencePieceSortie: 'PV-VOL-07', biens: [{ immobilisationId: pc1.id }, { immobilisationId: unites.id ?? part.unites.id }] });
    verifier(r.statut === 400 && /Aucun bien n’est sorti/.test(JSON.stringify(r.corps)), `un bien déjà sorti dans le lot · le lot entier refusé, rien n'est sorti (${r.statut})`);
    const pc1Encore = await prisma.immobilisation.findUnique({ where: { id: pc1.id }, select: { statut: true } });
    verifier(pc1Encore.statut === 'EN_SERVICE', 'l’ordinateur 1 est resté en service');
    const glob = await A.post('/immobilisations/sortie-globale', { ...sortie, natureSortie: 'VOL', dateSortie: '2026-09-30', datePieceSortie: '2026-10-02', referencePieceSortie: 'PV-VOL-07', biens: [{ immobilisationId: pc1.id }, { immobilisationId: pc2.id }] });
    verifier(glob.nombre === 2 && glob.biens.every((b) => egal(b.valeurComptableNette, 125_000)), `deux ordinateurs sortis, VNC 125 000 chacun (lu ${JSON.stringify(glob.biens)})`);
    const refs = await prisma.ecriture.findMany({ where: { tenantId, reference: 'PV-VOL-07' }, select: { id: true } });
    verifier(refs.length === 4, `une dotation complémentaire et une sortie par bien, sous la même pièce (lu ${refs.length})`);

    console.log('Dotation 2026 du lot');
    const dot26 = await A.post(`/immobilisations/${chaises.id}/dotation`, { exerciceId: e2026.id, journalId: od.id });
    verifier(egal(dot26.montant, 122_500), `dotation 2026 des sept chaises · 122 500 (lu ${dot26.montant})`);

    console.log('Soldes');
    const deux = [e2025.id, e2026.id];
    verifier(egal(await solde(tenantId, '2441', deux), 700_000), `2441 = 700 000 (lu ${await solde(tenantId, '2441', deux)})`);
    verifier(egal(await solde(tenantId, '2844', deux), -262_500), `2844 = 262 500 au crédit (lu ${await solde(tenantId, '2844', deux)})`);
    verifier(egal(await solde(tenantId, '2944', deux), -70_000), `2944 = 70 000 au crédit (lu ${await solde(tenantId, '2944', deux)})`);
    verifier(egal(await solde(tenantId, '812', [e2026.id]), 463_750), `812 (2026) = 463 750 (lu ${await solde(tenantId, '812', [e2026.id])})`);
    verifier(egal(await solde(tenantId, '7914', [e2026.id]), -30_000), `7914 (2026) = 30 000 au crédit (lu ${await solde(tenantId, '7914', [e2026.id])})`);
    verifier(egal(await solde(tenantId, '6813', [e2026.id]), 298_750), `6813 (2026) = 298 750 (lu ${await solde(tenantId, '6813', [e2026.id])})`);
    const vent = async (exerciceId) => {
      const v = await prisma.ventilationAnalytique.findMany({ where: { sectionId: section.id, ligne: { ecriture: { exerciceId } } }, select: { debit: true, credit: true } });
      return Math.round(v.reduce((t, x) => t + Number(x.debit) - Number(x.credit), 0) * 100) / 100;
    };
    verifier(egal(await vent(e2025.id), 200_000), `ventilation P01 2025 = 200 000 (lu ${await vent(e2025.id)})`);
    verifier(egal(await vent(e2026.id), 148_750), `ventilation P01 2026 = 148 750, complément des unités compris (lu ${await vent(e2026.id)})`);

    console.log('n° 71 · la fiche de comptage porte le numéro de série');
    const campagne = await A.post('/inventaire', { exerciceId: e2026.id, dateInventaire: '2026-12-31', libelle: 'Inventaire 2026' });
    await A.post(`/inventaire/${campagne.id}/fiches/immobilisations`, {});
    const fiches = await prisma.ficheInventaire.findMany({ where: { tenantId, campagneId: campagne.id }, select: { immobilisationId: true, numeroSerie: true } });
    verifier(fiches.length === 1 && fiches[0].immobilisationId === chaises.id && fiches[0].numeroSerie === 'LOT-CH-2025', `une fiche, le lot restant, avec son numéro de série (lu ${JSON.stringify(fiches)})`);

    console.log('n° 67 · une dotation de 2025 du lot ne s’annule plus (exercice clos) et la reprise de la part ne s’annule pas seule');
    const reprise = await prisma.depreciationImmobilisation.findFirst({ where: { immobilisationId: chaises.id, nature: 'CESSION_PARTIELLE' }, select: { id: true } });
    r = await A.statut('POST', '/immobilisations/traitements/annulation', { nature: 'DEPRECIATION', acteId: reprise.id, motif: 'essai' });
    verifier(r.statut === 400 && /sortie partielle/.test(JSON.stringify(r.corps)), `reprise de la part · refus nommé (${r.statut} ${JSON.stringify(r.corps).slice(0, 200)})`);
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
  }
  console.log(echecs.length === 0 ? '\nREJEU VERT' : `\nREJEU ROUGE · ${echecs.length} échec(s)`);
  process.exit(echecs.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
