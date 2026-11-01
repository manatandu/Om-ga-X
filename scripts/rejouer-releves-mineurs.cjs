#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · la ligne releves-mineurs, à travers la clôture de 2026.
 * Trois corrections qui touchent un montant, lues contre le calcul à la main :
 *  · second jeu en monnaie fonctionnelle · chaque ligne au cours de la date de
 *    l'écriture, totaux égaux à la somme des lignes servies au centime, et
 *    ouverture de 2027 égale à la clôture du même jeu en 2026 ;
 *  · quotité saisissable · la classe du CONTRAT du mois sert quand la saisie
 *    ne la dit pas (un cinquième de la base sous cinq fois le minimum) ;
 *  · registre des retenues · la quote-part ouvrière CNSS de décembre 2026,
 *    restée due à la clôture, se lit dans le registre de 2027.
 * Base jetable et serveur compilé seulement (`npm run build`).
 *
 *   DATABASE_URL=postgresql://postgres@127.0.0.1/rejeu_rm node scripts/rejouer-releves-mineurs.cjs
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
}
const centimes = (x) => Math.round(Number(x) * 100);

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    let pret = false;
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) { pret = true; break; } } catch {} await attendre(1000); }
    if (!pret) throw new Error(`serveur non démarré\n${journal.slice(-3000)}`);
    const stamp = Date.now();
    const email = `releves-mineurs-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu Relevés Mineurs SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const ex26 = (await A.get('/exercices')).find((e) => e.dateDebut.startsWith('2026'));
    const ex27 = await A.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    const journaux = await A.get('/journaux');
    const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux.find((j) => j.code === 'OD');
    const bq = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerie?.numero?.startsWith('52'));
    const comptes = await A.get('/comptes');
    const compte = (num) => { const c = comptes.find((x) => x.numero === num); if (!c) throw new Error(`compte ${num} absent`); return c; };
    for (const num of ['60110000', '70110000', '10130000', '66110000', '43110000', '42200000', '44710000']) await A.patch(`/comptes/${compte(num).id}`, { estRetenu: true });
    const banque = bq.compteTresorerie;

    console.log('1 · second jeu en monnaie fonctionnelle, à travers la clôture');
    const devises = await A.get('/devises');
    const usd = devises.find((x) => x.code === 'USD') ?? (await A.post('/devises', { code: 'USD', intitule: 'Dollar américain' }));
    // Des cours choisis pour que chaque conversion laisse un demi-centime ou presque.
    const coursDuJour = { '2026-01-02': 2817.33, '2026-03-15': 2841.07, '2026-06-30': 2863.91, '2026-11-20': 2879.13 };
    for (const [date, cours] of Object.entries(coursDuJour)) await A.post(`/devises/${usd.id}/cours`, { date, cours, source: 'Rejeu' });
    await A.patch('/dossier/coordonnees', { deviseFonctionnelle: 'USD' });
    const pieces = [
      { date: '2026-01-02', journalId: bq.id, libelle: 'Apport', d: banque.id, c: compte('10130000').id, m: 10_000_000 },
      { date: '2026-03-15', journalId: bq.id, libelle: 'Achat', d: compte('60110000').id, c: banque.id, m: 1_234_567 },
      { date: '2026-06-30', journalId: bq.id, libelle: 'Vente', d: banque.id, c: compte('70110000').id, m: 3_333_333 },
      { date: '2026-11-20', journalId: bq.id, libelle: 'Achat', d: compte('60110000').id, c: banque.id, m: 777_777 },
    ];
    for (const p of pieces) {
      await A.post('/ecritures', { exerciceId: ex26.id, journalId: p.journalId, date: p.date, libelle: p.libelle, lignes: [{ compteId: p.d, debit: p.m, libelle: p.libelle }, { compteId: p.c, credit: p.m, libelle: p.libelle }] });
    }
    // À la main · chaque ligne divisée par le cours de sa date, sommée par compte, arrondie au centime.
    const attendu = new Map();
    const ajouter = (id, sens, montant) => { const v = attendu.get(id) ?? { d: 0, c: 0 }; v[sens] += montant; attendu.set(id, v); };
    for (const p of pieces) { const u = p.m / coursDuJour[p.date]; ajouter(p.d, 'd', u); ajouter(p.c, 'c', u); }
    const bal26 = await A.get(`/monnaie-fonctionnelle/balance/${ex26.id}`);
    for (const [id, v] of attendu) {
      const l = bal26.lignes.find((x) => x.compteId === id);
      verifier(l && centimes(l.debit) === Math.round(v.d * 100) && centimes(l.credit) === Math.round(v.c * 100), `ligne ${l?.numero} · ${l?.debit} / ${l?.credit} contre ${(Math.round(v.d * 100) / 100)} / ${(Math.round(v.c * 100) / 100)} à la main`);
    }
    const sommeD = bal26.lignes.reduce((t, l) => t + centimes(l.debit), 0);
    const sommeC = bal26.lignes.reduce((t, l) => t + centimes(l.credit), 0);
    verifier(centimes(bal26.totaux.debit) === sommeD && centimes(bal26.totaux.credit) === sommeC, `totaux ${bal26.totaux.debit} / ${bal26.totaux.credit} = somme des lignes servies ${sommeD / 100} / ${sommeC / 100}`);
    verifier(centimes(bal26.totaux.ecartDeConversion) === sommeD - sommeC, `écart de conversion ${bal26.totaux.ecartDeConversion} = débit moins crédit des lignes`);

    console.log('2 · quotité saisissable · classe du contrat du mois');
    const s1 = await A.post('/personnel/salaries', { nom: 'KASONGO', prenoms: 'Jean', sexe: 'MASCULIN', dateNaissance: '1985-04-12' });
    await A.post(`/personnel/salaries/${s1.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01', periodiciteRemuneration: 'MOIS', remunerationBase: 780000, deviseRemuneration: 'CDF', classeProfessionnelle: 1 });
    const sim = await A.post(`/personnel/simulation?salarieId=${s1.id}`, { moisDePaie: '2026-12', elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780000 }], natureEmployeurInpp: 'PRIVE', effectif: 12 });
    const q = sim.quotite;
    verifier(!q.abstentions.some((a) => a.motif === 'CLASSE_PROFESSIONNELLE_ABSENTE'), 'la classe du contrat sert · aucune abstention « classe absente »');
    // Minimum de la classe 1 (manœuvre ordinaire) · 21 500 FC × 26 = 559 000 (décret n° 25/22, art. 2 et 7) ; seuil cinq fois.
    verifier(centimes(q.mensuelMinimumFc) === centimes(559000) && centimes(q.seuilFc) === centimes(2795000), `minimum ${q.mensuelMinimumFc}, seuil ${q.seuilFc} · 559 000 et 2 795 000 à la main`);
    const qpo = 780000 * 0.05;
    const base = 780000 - qpo - sim.retenue.retenueFc;
    verifier(Math.abs(q.baseFc - base) < 0.005, `base ${q.baseFc} = 780 000 − 39 000 (QPO) − ${sim.retenue.retenueFc} (impôt) = ${base}`);
    verifier(Math.abs(q.quotiteOrdinaireFc - base / 5) < 0.005, `quotité ${q.quotiteOrdinaireFc} = un cinquième de la base sous le seuil (${base / 5})`);

    console.log('3 · registre des retenues · la CNSS de décembre reste due en 2027');
    await A.post('/ecritures', { exerciceId: ex26.id, journalId: od.id, date: '2026-12-31', libelle: 'Paie de décembre', lignes: [
      { compteId: compte('66110000').id, debit: 780000, libelle: 'Salaire' },
      { compteId: compte('43110000').id, credit: 39000, libelle: 'CNSS quote-part ouvrière' },
      { compteId: compte('42200000').id, credit: 741000, libelle: 'Net' },
    ] });
    for (let k = 0; k < 3; k++) await A.post('/ecritures/valider-jusqua', { exerciceId: ex26.id, dateLimite: '2026-12-31' });
    await A.post(`/exercices/${ex26.id}/cloturer`, {});
    const reg27 = await A.get(`/retenues/registre?exerciceId=${ex27.id}&dateReference=2027-01-20`);
    const cnss = (reg27.natures ?? []).filter((x) => /cnss/i.test(x.cle));
    const texte = JSON.stringify(cnss);
    verifier(cnss.length > 0 && /\b39000\b/.test(texte), `la nature CNSS du registre de 2027 porte les 39 000 dus à l’ouverture (${cnss.map((x) => x.cle).join(', ')})`);
    console.log(`    (nature CNSS) ${texte.slice(0, 700)}`);

    console.log('4 · second jeu de 2027 · ouverture = clôture du même jeu en 2026');
    const bal27 = await A.get(`/monnaie-fonctionnelle/balance/${ex27.id}`);
    const bal26b = await A.get(`/monnaie-fonctionnelle/balance/${ex26.id}`);
    for (const id of [banque.id, compte('10130000').id]) {
      const l26 = bal26b.lignes.find((x) => x.compteId === id);
      const l27 = bal27.lignes.find((x) => x.compteId === id);
      const ouv27 = l27 ? centimes(l27.ouvertureDebit) - centimes(l27.ouvertureCredit) : null;
      verifier(l26 && ouv27 === centimes(l26.solde), `${l26?.numero} · ouverture 2027 ${ouv27 === null ? 'absente' : ouv27 / 100} = solde 2026 du même jeu ${l26?.solde}`);
    }
    const sD = bal27.lignes.reduce((t, l) => t + centimes(l.debit), 0);
    verifier(centimes(bal27.totaux.debit) === sD, `2027 · total débit ${bal27.totaux.debit} = somme des lignes ${sD / 100}`);
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
  }
  console.log(echecs.length ? `\n${echecs.length} ÉCHEC(S)` : '\nTout concorde.');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
