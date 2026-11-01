#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · ligne paie-lot. Paramètres de paie déclarés, puis la
 * paie de décembre 2026 et de janvier 2027 (changement d'année) proposée en
 * lot, émise par la route unitaire pour les seuls salariés choisis, chaque
 * montant lu contre le calcul fait à la main ; refus nommés, déjà émis
 * écartés, soldes de congés, journal d'audit des paramètres, cloisonnement.
 *
 *   RACINE=… DATABASE_URL=postgresql://…localhost… node scripts/rejouer-paie-lot.cjs
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
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 800)}`); e.statut = r.status; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  put(c, b) { return this.appeler('PUT', c, b).then((r) => r.corps); }
  statut(m, c, b) { return this.appeler(m, c, b, [200, 201, 400, 403, 404, 409]).then((r) => r); }
}

/** Le barème de l'art. 118, mensualisé comme le moteur (annuel, millier inférieur, plafond de 30 %, / 12), à la main. */
function irppMensuel(baseNetteMensuelle) {
  const annuel = Math.floor((baseNetteMensuelle * 12) / 1000) * 1000;
  const tranches = [[1944000, 3], [21600000, 15], [43200000, 30], [Infinity, 40]];
  let bas = 0; let impot = 0;
  for (const [haut, taux] of tranches) { const b = Math.max(0, Math.min(annuel, haut) - bas); impot += (b * taux) / 100; bas = haut; if (annuel <= haut) break; }
  impot = Math.min(impot, annuel * 0.3);
  // Art. 150 de la loi n° 23/053 · la retenue du mois à la centaine, la
  // demi-centaine en haut (`arrondi-article-150.ts`, relu).
  const mois = Math.round(impot / 12);
  const reste = mois % 100;
  return reste >= 50 ? mois - reste + 100 : mois - reste;
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
    const email = `paie-lot-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu Paie en lot SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await prisma.user.findFirst({ where: { email } })).tenantId;

    console.log('1. Paramètres de paie · jamais présumés');
    let p = await A.get('/personnel/parametres-paie');
    verifier(p.natureEmployeurInpp === null && p.regimeSalarial === null && p.effectifInpp === null && p.inppDepuisMois === null, 'dossier neuf · tout « pas encore dit »');
    const sansDate = await A.statut('PUT', '/personnel/parametres-paie', { natureEmployeurInpp: 'PRIVE', effectifInpp: 12 });
    verifier(sansDate.statut === 400, `nature et effectif sans mois d'effet refusés (${sansDate.statut})`);
    const domestique = await A.statut('PUT', '/personnel/parametres-paie', { regimeSalarial: 'FORFAIT_PERSONNEL_DOMESTIQUE' });
    verifier(domestique.statut === 400, `personnel domestique refusé au dossier, il se déclare au salarié (${domestique.statut})`);
    const jours = await A.statut('PUT', '/personnel/parametres-paie', { joursPayes: 20 });
    verifier(jours.statut === 400, `les jours payés ne sont plus un paramètre du dossier (${jours.statut})`);
    p = await A.put('/personnel/parametres-paie', { natureEmployeurInpp: 'PRIVE', effectifInpp: 12, inppDepuisMois: '2026-12', regimeSalarial: 'BAREME_ARTICLE_118' });
    verifier(p.natureEmployeurInpp === 'PRIVE' && p.effectifInpp === 12 && p.inppDepuisMois === '2026-12' && p.regimeSalarial === 'BAREME_ARTICLE_118', 'déclarés à partir de décembre 2026');
    const refusNature = await A.statut('PUT', '/personnel/parametres-paie', { natureEmployeurInpp: 'MIXTE', inppDepuisMois: '2026-12' });
    verifier(refusNature.statut === 400, `nature inconnue refusée (${refusNature.statut})`);
    const audit = await prisma.evenementAudit.findMany({ where: { tenantId, entite: 'Tenant' }, orderBy: { rang: 'asc' } }).catch(() => null);
    verifier(audit !== null && audit.some((a) => JSON.stringify(a).includes('paieNatureEmployeurInpp')), `déclaration au journal d'audit (${audit?.length ?? 'lecture impossible'} maillon(s) Tenant)`);

    console.log('2. Registre');
    const devises = await A.get('/devises');
    const usd = (Array.isArray(devises) ? devises : devises.devises ?? []).find((d) => d.code === 'USD');
    const aujourdhui = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
    if (usd) await A.post(`/devises/${usd.id}/cours`, { date: aujourdhui, cours: 2800, source: 'Rejeu' });
    const contrat = (s, extra) => A.post(`/personnel/salaries/${s.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01', periodiciteRemuneration: 'MOIS', classeProfessionnelle: 5, ...extra });
    const s1 = await A.post('/personnel/salaries', { nom: 'AMANI', prenoms: 'Paul', sexe: 'MASCULIN', dateNaissance: '1985-04-12', nomConjoint: 'AMANI Rose' });
    await contrat(s1, { remunerationBase: 800000, deviseRemuneration: 'CDF' });
    const s2 = await A.post('/personnel/salaries', { nom: 'BAHATI', prenoms: 'Marie', sexe: 'FEMININ', dateNaissance: '1990-02-02' });
    await contrat(s2, { remunerationBase: 1300000, deviseRemuneration: 'CDF' });
    await A.post(`/personnel/salaries/${s2.id}/absences`, { nature: 'ABSENCE_NON_AUTORISEE', du: '2026-12-15', au: '2026-12-15' });
    const s3 = await A.post('/personnel/salaries', { nom: 'CIZA', prenoms: 'Jean', sexe: 'MASCULIN', dateNaissance: '1980-06-06' });
    await contrat(s3, { remunerationBase: 600, deviseRemuneration: 'USD' });
    const s4 = await A.post('/personnel/salaries', { nom: 'DIBWE', prenoms: 'Luc', sexe: 'MASCULIN', dateNaissance: '1979-01-01' });
    await contrat(s4, { remunerationBase: 30000, deviseRemuneration: 'CDF', periodiciteRemuneration: 'JOUR' });
    const s5 = await A.post('/personnel/salaries', { nom: 'ESAKA', prenoms: 'Anne', sexe: 'FEMININ', dateNaissance: '1995-03-03' });
    // Un salarié actif SANS contrat · hors du lot, compté.
    console.log('3. Novembre 2026 · avant le mois d\'effet');
    const nov = await A.get('/personnel/paie-en-lot/2026-11');
    const n1 = nov.lignes.find((x) => x.salarieId === s1.id);
    verifier(n1.etat === 'NON_EMISSIBLE' && !('natureEmployeurInpp' in n1.corps) && n1.manques.some((m) => /à partir de 12\/2026/.test(m)), `novembre · rien de l'INPP repris, la ligne le dit, non émissible (${n1.etat})`);
    console.log('3 bis. Décembre 2026 · proposition');
    let lot = await A.get('/personnel/paie-en-lot/2026-12');
    const ligne = (l, s) => l.lignes.find((x) => x.salarieId === s.id);
    verifier(lot.lignes.length === 4 && lot.sansContrat === 1 && lot.totalActifs === 5, `4 sous contrat, 1 sans contrat, 5 actifs (${lot.lignes.length}, ${lot.sansContrat}, ${lot.totalActifs})`);
    const l1 = ligne(lot, s1);
    const cnss1 = 800000 * 0.05; const irpp1 = irppMensuel(800000 - cnss1); const net1 = 800000 - cnss1 - irpp1;
    verifier(l1.etat === 'EMISSIBLE' && l1.corps.elements[0].montantFc === 800000 && l1.corps.natureEmployeurInpp === 'PRIVE' && l1.corps.effectif === 12 && l1.corps.classeProfessionnelle === 5 && !('personnesACharge' in l1.corps), 'S1 · salaire du contrat 800 000, paramètres et classe repris, personnes à charge jamais reprises');
    verifier(Math.abs(l1.verdict.cotisationsTravailleurFc - cnss1) < 0.005 && Math.abs(l1.verdict.irppFc - irpp1) < 0.005 && Math.abs(l1.verdict.netAPayerFc - net1) < 0.005, `S1 · CNSS ${l1.verdict.cotisationsTravailleurFc} (main ${cnss1}), IRPP ${l1.verdict.irppFc} (main ${irpp1}), net ${l1.verdict.netAPayerFc} (main ${net1})`);
    verifier(l1.personnesAChargeProposees === 1, `S1 · le registre propose 1 personne à charge, non substituée (${l1.personnesAChargeProposees})`);
    const l2 = ligne(lot, s2);
    verifier(l2.etat === 'EMISSIBLE' && l2.corps.elements[0].montantFc === 1250000 && l2.corps.elements[0].libelle === 'Salaire des jours dus', `S2 · une absence non autorisée retranche 1/26 · 1 250 000 (${l2.corps.elements[0]?.montantFc})`);
    verifier(l2.corps.joursPayes === 25 && !('joursPayes' in l1.corps), `jours payés du salarié · S2 25 (absence d'un jour), S1 rien envoyé, mois entier (${l2.corps.joursPayes})`);
    verifier(l1.reprise.natureEmployeurInpp === 'PRIVE' && l1.reprise.effectifInpp === 12 && l1.reprise.inppDepuisMois === '2026-12' && l1.reprise.source === 'Déclaré au dossier', 'la ligne dit la nature et l’effectif repris, avec leur source');
    const l3 = ligne(lot, s3);
    verifier(l3.corps.deviseStipulation === 'USD' && l3.corps.elements[0].montantUsd === 600 && !('montantFc' in l3.corps.elements[0]), 'S3 · salaire en dollars, 600 USD, jamais des francs');
    if (usd) verifier(l3.etat === 'EMISSIBLE' && Math.abs(l3.verdict.totalVerseFc - 1680000) < 0.005, `S3 · converti au cours du jour 2 800 · 1 680 000 FC (${l3.verdict?.totalVerseFc})`);
    const l4 = ligne(lot, s4);
    verifier(l4.etat !== 'EMISSIBLE' && l4.corps.elements.length === 0 && l4.manques.some((m) => /au jour/.test(m)), 'S4 · rémunération au jour · rien de deviné, non émissible, dit');

    console.log('4. Émission des seuls choisis, par la route unitaire');
    const b1 = await A.post(`/personnel/salaries/${s1.id}/bulletins`, l1.corps);
    verifier(Math.abs(Number(b1.netAPayerFc) - net1) < 0.005 && Math.abs(Number(b1.irppFc) - irpp1) < 0.005, `bulletin S1 n° ${b1.numero} · net ${b1.netAPayerFc}, IRPP ${b1.irppFc} = verdict du lot`);
    const corps2 = { ...l2.corps, personnesACharge: 0 };
    const b2 = await A.post(`/personnel/salaries/${s2.id}/bulletins`, corps2);
    const cnss2 = 1250000 * 0.05; const irpp2 = irppMensuel(1250000 - cnss2);
    verifier(Math.abs(Number(b2.irppFc) - irpp2) < 0.005 && Math.abs(Number(b2.netAPayerFc) - (1250000 - cnss2 - irpp2)) < 0.005, `bulletin S2 n° ${b2.numero} · IRPP ${b2.irppFc} (main ${irpp2})`);
    const encore = await A.statut('POST', `/personnel/salaries/${s1.id}/bulletins`, l1.corps);
    verifier(encore.statut === 400 || encore.statut === 409, `S1 une seconde fois refusé comme à l'unité (${encore.statut})`);
    const vide = await A.statut('POST', `/personnel/salaries/${s4.id}/bulletins`, l4.corps);
    verifier(vide.statut !== 200 && vide.statut !== 201, `S4 sans élément · l'émission ne passe pas non plus à l'unité (${vide.statut}) · sinon le lot seul l'en garde`);
    lot = await A.get('/personnel/paie-en-lot/2026-12');
    verifier(ligne(lot, s1).etat === 'DEJA_EMIS' && ligne(lot, s1).bulletinNumero === b1.numero && ligne(lot, s2).etat === 'DEJA_EMIS' && ligne(lot, s3).etat !== 'DEJA_EMIS', 'relue · S1 et S2 déjà émis et écartés, S3 non coché reste proposé');

    console.log('5. Janvier 2027 · changement d\'année');
    lot = await A.get('/personnel/paie-en-lot/2027-01');
    const j1 = ligne(lot, s1);
    verifier(j1.etat !== 'DEJA_EMIS' && j1.corps.elements[0].montantFc === 800000 && j1.corps.moisDePaie === '2027-01', `S1 · janvier proposé, 800 000, l'absence de décembre ne pèse plus (${j1.etat}${j1.motifs?.length ? ' · ' + j1.motifs.join(' / ') : ''})`);
    if (j1.etat === 'EMISSIBLE') {
      const bj = await A.post(`/personnel/salaries/${s1.id}/bulletins`, { ...j1.corps, personnesACharge: 1 });
      verifier(bj.numero === b2.numero + 1 && bj.moisDePaie === '2027-01', `numérotation continue à travers l'année · n° ${bj.numero}`);
      verifier(Number(bj.irppFc) < irpp1, `une personne à charge retenue réduit l'IRPP (${bj.irppFc} < ${irpp1})`);
    } else {
      console.log(`  info · janvier 2027 non émissible · ${j1.motifs.join(' / ')}`);
    }
    const j2 = ligne(lot, s2);
    verifier(j2.corps.elements[0]?.montantFc === 1300000, `S2 · janvier au salaire plein 1 300 000 (${j2.corps.elements[0]?.montantFc})`);

    console.log('6. Soldes de congés');
    const so = await A.get('/personnel/soldes-conges?ala=2027-01-15');
    verifier(so.aLa === '2027-01-15' && so.lignes.length === 5 && !so.tronque, `cinq salariés actifs lus au 15 janvier 2027 (${so.lignes.length})`);
    verifier(so.lignes.every((l) => l.refus !== null || l.solde === null || typeof l.solde === 'number'), 'chaque solde chiffré ou nul avec son motif');
    const sol1 = so.lignes.find((l) => l.salarieId === s1.id);
    // À la main · année de service 2026 révolue le 31 décembre ; seul décembre
    // porte un bulletin émis, un jour ouvrable par mois entier au-delà de
    // dix-huit ans (Code du travail, art. 141) · un jour né, rien de pris.
    verifier(sol1.droitsNes === 1 && sol1.pris === 0 && sol1.solde === 1 && sol1.signaux.length > 0, `S1 · un jour né (décembre seul payé), solde 1, les mois sans bulletin signalés (${sol1.droitsNes}, ${sol1.solde}, ${sol1.signaux.length})`);
    const mauvaiseDate = await A.statut('GET', '/personnel/soldes-conges?ala=2027-13-45');
    verifier(mauvaiseDate.statut === 400, `date illisible refusée une fois (${mauvaiseDate.statut})`);

    console.log('7. Cloisonnement');
    const B = new Client();
    const emailB = `paie-lot-b-${stamp}@exemple.invalid`;
    await B.post('/auth/register', { nomEntite: 'Voisin SARL', referentiel: 'SYSCOHADA', email: emailB, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await B.post('/auth/login', { email: emailB, motDePasse: MDP });
    const lotB = await B.get('/personnel/paie-en-lot/2026-12');
    verifier(lotB.lignes.length === 0 && lotB.parametres.natureEmployeurInpp === null, 'le voisin ne voit ni les salariés ni les paramètres');
    const prop = await B.statut('GET', `/personnel/salaries/${s1.id}/proposition-bulletin/2026-12`);
    verifier(prop.statut === 404, `proposition d'un salarié d'un autre dossier · 404 (${prop.statut})`);
  } finally {
    srv.kill();
    await prisma.$disconnect();
  }
  console.log(echecs.length ? `\n${echecs.length} ÉCHEC(S)` : '\nTOUT VERT');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
