#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · la déclaration annuelle de la situation de la
 * main-d'œuvre (DASMO, arrêté du 24 février 2023, art. 3 et modèle annexé).
 * Sept contrats autour du 1er janvier 2026, l'exercice 2025 clôturé, le
 * formulaire lu par l'API du serveur compilé avant et après la clôture ·
 * lignes de catégorie, permanents des trois années, non-permanents,
 * manquants, cloisonnement.
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


async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    let pret = false;
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) { pret = true; break; } } catch {} await attendre(1000); }
    if (!pret) throw new Error(`serveur non démarré\n${journal.slice(-3000)}`);
    const stamp = Date.now();
    const email = `dasmo-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu DASMO SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await prisma.user.findFirst({ where: { email } })).tenantId;
    const e2025 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
    await prisma.tenant.update({ where: { id: tenantId }, data: { adresse: 'Av. du Port 4', ville: 'Kinshasa', activite: 'Commerce', rccm: 'CD/KIN/RCCM/25-B-001', numeroAffiliationCnssEmployeur: 'CNSS-E-77' } });

    const salarie = (nom, sexe, nationalite) => A.post('/personnel/salaries', { nom, prenoms: 'X', sexe, ...(nationalite ? { nationalite } : {}) });
    const contrat = (s, corps) => A.post(`/personnel/salaries/${s.id}/contrats`, corps);
    const s1 = await salarie('UN', 'MASCULIN', 'Congolaise');
    await contrat(s1, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2024-03-01', classeProfessionnelle: 5 });
    const s2 = await salarie('DEUX', 'FEMININ', 'Française');
    await contrat(s2, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2025-06-01', classeProfessionnelle: 11 });
    const s3 = await salarie('TROIS', 'FEMININ', 'Congolaise');
    await contrat(s3, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2025-02-01' });
    const s4 = await salarie('QUATRE', 'MASCULIN', 'Congolaise');
    await contrat(s4, { type: 'DUREE_DETERMINEE', dateEntreeEnVigueur: '2025-09-01', dateFinPrevue: '2026-08-31' });
    const s5 = await salarie('CINQ', 'MASCULIN', 'Congolaise');
    const c5 = await contrat(s5, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2023-01-01', classeProfessionnelle: 2 });
    await A.post(`/personnel/contrats/${c5.id}/fin`, { dateFin: '2025-12-31', motifFin: 'Démission' });
    const s6 = await salarie('SIX', 'MASCULIN', 'Congolaise');
    await contrat(s6, { type: 'JOUR_LE_JOUR', dateEntreeEnVigueur: '2025-12-15' });
    const s7 = await salarie('SEPT', 'FEMININ', 'Congolaise');
    await contrat(s7, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01', classeProfessionnelle: 1 });
    const s8 = await salarie('HUIT', 'MASCULIN', null);
    await contrat(s8, { type: 'DUREE_DETERMINEE', dateEntreeEnVigueur: '2025-12-01', dateFinPrevue: '2026-11-30' });

    const lire = async (ex) => (await A.get(`/personnel/declaration-main-oeuvre/${ex}`));
    const controler = (d, quand) => {
      const f = d.formulaire;
      const l = (cle) => f.effectifs.lignes.find((x) => x.cle === cle).cellules;
      verifier(d.exercice === 2026 && d.au === '2026-01-01' && d.dateLimite === '2026-01-31', `${quand} · exercice lu au 1er janvier, déposé au 31 janvier (${d.au} ${d.dateLimite})`);
      verifier(f.permanents.annee === 4 && f.permanents.anneePrecedente === 2 && f.permanents.anneeAnterieure === 1, `${quand} · permanents 4 / 2 / 1 (${JSON.stringify(f.permanents)})`);
      verifier(JSON.stringify(l('I')) === JSON.stringify({ congolais: { h: 0, f: 1, total: 1 }, etrangers: { h: 0, f: 0, total: 0 }, totaux: { h: 0, f: 1, total: 1 } }), `${quand} · catégorie I, la classe 1 entrée le 1er janvier`);
      verifier(l('III').totaux.h === 1 && l('III').totaux.total === 1 && l('II').totaux.total === 0, `${quand} · classe 5 en catégorie III, le CDI fini le 31 décembre hors du 1er janvier`);
      verifier(l('MAITRISE').etrangers.f === 1 && l('DIRECTION') === null && l('HORS_CADRES') === null, `${quand} · classe 11 en agent de maîtrise, direction et hors cadres non calculés`);
      verifier(f.effectifs.sansClasse.length === 1 && /TROIS/.test(f.effectifs.sansClasse[0]), `${quand} · permanent sans classe nommé (${f.effectifs.sansClasse})`);
      verifier(f.effectifs.totaux.totaux.total === 4 && f.effectifs.totaux.congolais.total === 3 && f.effectifs.totaux.etrangers.f === 1, `${quand} · totaux par nationalité (${JSON.stringify(f.effectifs.totaux)})`);
      verifier(f.nonPermanents.temporaires === 2 && f.nonPermanents.journaliers === 1, `${quand} · deux temporaires, un journalier (${JSON.stringify(f.nonPermanents)})`);
      verifier(f.manquants.some((m) => /1 salarié\(s\) sans nationalité/.test(m)) && f.manquants.some((m) => /1 permanent\(s\) sans classe/.test(m)), `${quand} · manquants nommés`);
      const id = (n) => f.identification.find((c) => c.numero === n).valeur;
      verifier(id(1) === 'Rejeu DASMO SARL' && id(11) === 'CD/KIN/RCCM/25-B-001' && id(16) === 'CNSS-E-77' && id(18) === null, `${quand} · identification recopiée, l'ONEM vide`);
    };
    controler(await lire(2026), 'avant clôture');

    console.log('Clôture de 2025');
    const r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
    if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 600));
    const ex25 = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
    verifier(ex25.statut === 'CLOTURE', `exercice 2025 clôturé (${ex25.statut})`);
    controler(await lire(2026), 'après clôture');

    const d25 = await lire(2025);
    verifier(d25.formulaire.permanents.annee === 2 && d25.formulaire.nonPermanents.temporaires === 0, `exercice 2025 · lu au 1er janvier 2025 (${JSON.stringify(d25.formulaire.permanents)})`);
    let s = await A.statut('GET', '/personnel/declaration-main-oeuvre/abc');
    verifier(s.statut === 400, `exercice illisible refusé (${s.statut})`);

    const B = new Client();
    const emailB = `dasmob-${stamp}@exemple.invalid`;
    await B.post('/auth/register', { nomEntite: 'Voisin', referentiel: 'SYCEBNL', email: emailB, motDePasse: MDP });
    await B.post('/auth/login', { email: emailB, motDePasse: MDP });
    const dB = await B.get('/personnel/declaration-main-oeuvre/2026');
    verifier(dB.formulaire.permanents.annee === 0 && dB.formulaire.nonPermanents.temporaires === 0, 'un autre dossier ne voit aucun contrat');
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
    if (/Maillon d'audit NON écrit/.test(journal)) { echecs.push('maillon d’audit non écrit au journal du serveur'); }
  }
  console.log(echecs.length ? `\n${echecs.length} ÉCHEC(S)` : '\nTOUT EST VERT');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
