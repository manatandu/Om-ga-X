#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · ligne restes-l8-immos.
 * Serveur COMPILÉ contre une base PostgreSQL jetable déjà migrée.
 *   DATABASE_URL=postgresql://... node scripts/rejouer-restes-l8-immos.cjs
 *
 * POINT 1 · LE PV D'INVENTAIRE DIT LA QUANTITÉ DU REGISTRE ET L'ÉCART EN UNITÉS.
 *   Lot de dix chaises (2025), doté, 2025 clôturé ; campagne 2026 · huit
 *   comptées · le PV imprime 10 au registre et un manquant de 2 ; onze
 *   comptées · excédent de 1, art. 43 cité, ni bien ni écriture créés.
 *
 * POINT 2 · LA SORTIE ENTIÈRE DOTE DANS L'ORDRE, COMME LA PARTIELLE.
 *   Camion 1 200 000 (cinq ans, en service le 01/01/2025), 2025 encore
 *   ouvert et non doté · la sortie du 30/09/2026 est refusée en nommant 2025,
 *   la sortie globale aussi, la sortie partielle d'un lot de même ; 2025
 *   doté (240 000), la sortie passe · complément 180 000, 812 = 780 000 ;
 *   2025 clôturé, la sortie partielle passe ensuite (812 + 195 000).
 *
 * POINT 3 · LA DUPLICATION D'UN TIERS REPREND REPRÉSENTANT ET DEVISE, JAMAIS
 *   L'ENCOURS MAXIMUM ; un représentant en sommeil n'est pas repris.
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
  const email = `restes-l8-${nom}-${Date.now()}@exemple.invalid`;
  await A.post('/auth/register', { nomEntite: `Rejeu ${nom} SARL`, referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
  await A.post('/auth/login', { email, motDePasse: MDP });
  const exercices = await A.get('/exercices');
  const e2026 = exercices.find((e) => e.dateDebut.startsWith('2026'));
  const e2025 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
  const plan = await A.get('/comptes?typeCompte=DETAIL');
  const premier = (prefixe) => plan.find((c) => c.numero.startsWith(prefixe) && c.typeCompte === 'DETAIL');
  return { e2025, e2026, plan, premier };
}

/** Un dossier à biens · un lot de dix chaises acquis et mis en service le 01/01/2025 (1 000 000, cinq ans). */
async function dossierABiens(A, nom) {
  const d = await dossier(A, nom);
  const journaux = await A.get('/journaux');
  const od = journaux.find((j) => j.code === 'OD') ?? journaux[0];
  const compte = (num) => d.plan.find((c) => c.numero === num);
  for (const num of ['24410000', '48120000', '29440000', '69140000', '79140000']) await A.patch(`/comptes/${compte(num).id}`, { estRetenu: true });
  const nouveau = (designation, valeur, duree, extra = {}) =>
    A.post('/immobilisations', {
      compteImmobilisationId: compte('24410000').id, designation, dateAcquisition: '2025-01-01', dateMiseEnService: '2025-01-01',
      valeurOrigine: valeur, dureeAmortissementAns: duree, compteContrepartieId: compte('48120000').id, journalId: od.id, exerciceId: d.e2025.id, ...extra,
    });
  return { ...d, od, compte, nouveau };
}

async function cloturer2025(A, e2025) {
  await A.post('/ecritures/valider-jusqua', { exerciceId: e2025.id, dateLimite: '2025-12-31' });
  const r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
  if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 1500));
  const ex = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
  verifier(ex.statut === 'CLOTURE', `2025 clôturé (${ex.statut})`);
}

/** Le solde (débit − crédit) d'une racine sur un exercice, hors écritures de clôture et de situation. */
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


const SORTIE = { type: 'MISE_HORS_SERVICE', natureSortie: 'MISE_AU_REBUT', referencePieceSortie: 'PV-REBUT-01' };

async function point1(A) {
  console.log('POINT 1 · le PV d’inventaire dit la quantité du registre et l’écart en unités');
  const { e2025, e2026, od, nouveau } = await dossierABiens(A, 'pv');
  const chaises = await nouveau('Chaises de la salle', 1_000_000, 5, { quantite: 10 });
  await A.post(`/immobilisations/${chaises.id}/dotation`, { exerciceId: e2025.id, journalId: od.id });
  await cloturer2025(A, e2025);
  const campagne = await A.post('/inventaire', { exerciceId: e2026.id, dateInventaire: '2026-12-31', libelle: 'Inventaire 2026' });
  await A.post(`/inventaire/${campagne.id}/fiches/immobilisations`, {});
  const fiche = await prisma.ficheInventaire.findFirst({ where: { campagneId: campagne.id }, select: { id: true, tenantId: true } });
  let pv = await A.get(`/inventaire/${campagne.id}/editions/proces-verbal`);
  let l = pv.releve[0];
  verifier(l.unites && l.unites.attendue === 10 && l.unites.ecart === null, `non compté · registre 10, aucun écart (lu ${JSON.stringify(l.unites)})`);
  await A.patch(`/inventaire/fiches/${fiche.id}`, { quantiteComptee: 8 });
  pv = await A.get(`/inventaire/${campagne.id}/editions/proces-verbal`);
  l = pv.releve[0];
  verifier(l.quantite === 8 && l.unites.attendue === 10 && l.unites.ecart === -2 && l.unites.sens === 'MANQUANT', `huit comptées · registre 10, manquant 2 (lu ${l.quantite}, ${JSON.stringify(l.unites)})`);
  verifier(pv.mentions.some((m) => /manquant d'unités/.test(m)), `mention du manquant sur le PV (lu ${JSON.stringify(pv.mentions)})`);
  const biensAvant = await prisma.immobilisation.count({ where: { tenantId: fiche.tenantId } });
  const ecrituresAvant = await prisma.ecriture.count({ where: { tenantId: fiche.tenantId } });
  await A.patch(`/inventaire/fiches/${fiche.id}`, { quantiteComptee: 11 });
  pv = await A.get(`/inventaire/${campagne.id}/editions/proces-verbal`);
  l = pv.releve[0];
  verifier(l.unites.ecart === 1 && l.unites.sens === 'EXCEDENT', `onze comptées · excédent 1 (lu ${JSON.stringify(l.unites)})`);
  verifier(pv.mentions.some((m) => /excédent d'unités/.test(m) && /art\. 43/.test(m)), 'mention de l’excédent, art. 43 cité');
  verifier(
    (await prisma.immobilisation.count({ where: { tenantId: fiche.tenantId } })) === biensAvant &&
      (await prisma.ecriture.count({ where: { tenantId: fiche.tenantId } })) === ecrituresAvant,
    "l'édition ne crée ni bien ni écriture",
  );
}

async function point2(A) {
  console.log('POINT 2 · la sortie entière dote dans l’ordre, comme la partielle');
  const { e2025, e2026, od, nouveau } = await dossierABiens(A, 'sortie');
  const camion = await nouveau('Camion', 1_200_000, 5);
  const chaises = await nouveau('Chaises', 1_000_000, 5, { quantite: 10 });
  const bureau = await nouveau('Bureau', 600_000, 5);
  const tenantId = (await prisma.immobilisation.findUnique({ where: { id: camion.id }, select: { tenantId: true } })).tenantId;
  const sortieCamion = { ...SORTIE, dateSortie: '2026-09-30', datePieceSortie: '2026-09-30', exerciceId: e2026.id, journalId: od.id };
  let r = await A.statut('POST', `/immobilisations/${camion.id}/sortie`, sortieCamion);
  const dit = JSON.stringify(r.corps);
  verifier(
    r.statut === 400 && /clos le 2025-12-31 n’a pas reçu la dotation du bien/.test(dit) && /passez-la d’abord/.test(dit),
    `2025 ouvert non doté · sortie entière refusée, issue dite (${r.statut} ${dit.slice(0, 260)})`,
  );
  r = await A.statut('POST', '/immobilisations/sortie-globale', { ...sortieCamion, biens: [{ immobilisationId: camion.id }, { immobilisationId: bureau.id }] });
  verifier(r.statut === 400 && /clos le 2025-12-31/.test(JSON.stringify(r.corps)), `sortie globale · refusée de même (${r.statut} ${JSON.stringify(r.corps).slice(0, 260)})`);
  r = await A.statut('POST', `/immobilisations/${chaises.id}/sortie-partielle`, { ...sortieCamion, quantiteSortie: 3 });
  verifier(r.statut === 400 && /dotation du lot/.test(JSON.stringify(r.corps)), `sortie partielle · même règle, même motif (${r.statut})`);
  const fiche = await prisma.immobilisation.findUnique({ where: { id: camion.id }, select: { statut: true } });
  verifier(fiche.statut === 'EN_SERVICE' && (await solde(tenantId, '812', [e2026.id])) === 0, 'rien de posé · le camion en service, 812 vide');
  await A.post(`/immobilisations/${camion.id}/dotation`, { exerciceId: e2025.id, journalId: od.id });
  await A.post(`/immobilisations/${chaises.id}/dotation`, { exerciceId: e2025.id, journalId: od.id });
  verifier(egal(await solde(tenantId, '6813', [e2025.id]), 440_000), `2025 doté · 240 000 + 200 000 (lu ${await solde(tenantId, '6813', [e2025.id])})`);
  await A.post(`/immobilisations/${camion.id}/sortie`, sortieCamion);
  verifier(egal(await solde(tenantId, '6813', [e2026.id]), 180_000), `complément 2026 · 180 000, neuf mois (lu ${await solde(tenantId, '6813', [e2026.id])})`);
  verifier(egal(await solde(tenantId, '812', [e2026.id]), 780_000), `812 = 1 200 000 − 240 000 − 180 000 = 780 000 (lu ${await solde(tenantId, '812', [e2026.id])})`);
  await cloturer2025(A, e2025);
  await A.post(`/immobilisations/${chaises.id}/sortie-partielle`, { ...sortieCamion, quantiteSortie: 3 });
  // Trois chaises · 300 000 brut, 60 000 amortis en 2025, 45 000 de complément (neuf mois) · 195 000 au 812.
  verifier(egal(await solde(tenantId, '812', [e2026.id]), 975_000), `2025 clôturé · la sortie partielle passe ensuite, 812 = 780 000 + 195 000 (lu ${await solde(tenantId, '812', [e2026.id])})`);
}

async function point3(A) {
  console.log('POINT 3 · duplication d’un tiers');
  await dossier(A, 'tiers');
  const col = await A.post('/commercial/collaborateurs', { nom: 'Kasa', prenom: 'Jean', vendeur: true });
  const devises = await A.get('/devises');
  const usd = devises.find((x) => x.code === 'USD') ?? (await A.post('/devises', { code: 'USD', intitule: 'Dollar américain' }));
  const source = await A.post('/tiers', {
    type: 'CLIENT', code: 'CLI-SRC', nom: 'Client source', ville: 'Goma', representantId: col.id, deviseId: usd.id, encoursMaximum: 5_000_000,
  });
  const copie = await A.get(`/tiers/${source.id}/duplication`);
  verifier(
    copie.corps.representantId === col.id && copie.corps.deviseId === usd.id && !('encoursMaximum' in copie.corps),
    `copie · représentant et devise repris, encours absent (lu ${JSON.stringify(copie.corps)})`,
  );
  verifier(copie.nonRepris.some((x) => x.champ === 'Encours maximum'), 'l’encours non repris est nommé');
  const neuf = await A.post('/tiers', { ...copie.corps, code: 'CLI-COPIE' });
  const lu = await prisma.tiers.findUnique({ where: { id: neuf.id }, select: { representantId: true, deviseId: true, encoursMaximum: true } });
  verifier(lu.representantId === col.id && lu.deviseId === usd.id && lu.encoursMaximum === null, `créé depuis la copie · représentant et devise, aucun encours (lu ${JSON.stringify(lu)})`);
  // Un représentant ne se met pas en sommeil tant qu'il représente (409 du module) · le cas « en sommeil »
  // de la copie est tenu par le test unitaire (`duplication-tiers.spec.ts`).
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    let pret = false;
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) { pret = true; break; } } catch {} await attendre(1000); }
    if (!pret) throw new Error(`serveur non démarré\n${journal.slice(-3000)}`);
    const points = (process.env.POINTS || '1,2,3').split(',');
    if (points.includes('1')) await point1(new Client());
    if (points.includes('2')) await point2(new Client());
    if (points.includes('3')) await point3(new Client());
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
  }
  console.log(echecs.length === 0 ? '\nREJEU VERT' : `\nREJEU ROUGE · ${echecs.length} échec(s)`);
  process.exit(echecs.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
