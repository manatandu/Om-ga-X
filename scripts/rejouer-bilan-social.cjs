#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · le bilan social de l'ONEM (Code du travail, art. 218 ;
 * arrêté du 24 février 2023, art. 3). Deux bulletins émis en 2026 et un
 * annulé, la proposition de la ligne 10 lue contre leurs totaux versés, une
 * saisie en francs et en dollars enregistrée, puis 2026 clôturé · le bilan
 * relu à l'identique, solde et total par monnaie, refus nommés,
 * cloisonnement.
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!RACINE || !/localhost|127\.0\.0\.1/.test(URL_BASE)) { console.error('RACINE et DATABASE_URL locale exigés'); process.exit(2); }
const PORT = 8099;
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
    const email = `bilan-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu Bilan Social SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await prisma.user.findFirst({ where: { email } })).tenantId;
    const e2025 = (await A.get('/exercices')).find((e) => e.dateDebut.startsWith('2026'));
    await prisma.tenant.update({ where: { id: tenantId }, data: { activite: 'Commerce', numeroAffiliationCnssEmployeur: 'CNSS-E-88' } });

    const s1 = await A.post('/personnel/salaries', { nom: 'KASONGO', prenoms: 'Jean', sexe: 'MASCULIN', dateNaissance: '1985-04-12' });
    await A.post(`/personnel/salaries/${s1.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01', periodiciteRemuneration: 'MOIS', remunerationBase: 780000, deviseRemuneration: 'CDF' });
    const s2 = await A.post('/personnel/salaries', { nom: 'LUKUSA', prenoms: 'Marie', sexe: 'FEMININ', dateNaissance: '1991-09-02' });
    const c2 = await A.post(`/personnel/salaries/${s2.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01', periodiciteRemuneration: 'MOIS', remunerationBase: 780000, deviseRemuneration: 'CDF' });
    await A.post(`/personnel/contrats/${c2.id}/fin`, { dateFin: '2026-12-15', motifFin: 'Démission' });
    const corps = (mois) => ({ moisDePaie: mois, elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780000 }], natureEmployeurInpp: 'PRIVE', effectif: 12 });
    const b1 = await A.post(`/personnel/salaries/${s1.id}/bulletins`, corps('2026-11'));
    const b2 = await A.post(`/personnel/salaries/${s2.id}/bulletins`, corps('2026-11'));
    const b3 = await A.post(`/personnel/salaries/${s1.id}/bulletins`, corps('2026-12'));
    await A.post(`/personnel/bulletins/${b3.id}/annulation`, { motif: 'Erreur de saisie' });
    const attendu = (Number(b1.totalVerseFc) + Number(b2.totalVerseFc)).toFixed(2);

    let f = await A.get('/personnel/bilan-social/2026');
    verifier(f.dateLimite === '2027-01-31' && f.enregistreLe === null, `exercice 2026 à déposer au 31 janvier 2027, pas encore enregistré (${f.dateLimite})`);
    verifier(f.lignes.length === 21 && f.lignes[9].proposition?.realise === attendu && f.lignes[9].realise === null, `ligne 10 proposée sur les bulletins émis, l'annulé exclu (${f.lignes[9].proposition?.realise} contre ${attendu}), jamais substituée`);
    verifier(f.identification.find((c) => c.libelle === 'Effectif actif').valeur === '1', `effectif actif au 31 décembre · la démission du 15 décembre exclue (${f.identification.find((c) => c.libelle === 'Effectif actif').valeur})`);
    verifier(f.identification.find((c) => c.libelle === 'N° Aff. CNSS').valeur === 'CNSS-E-88', 'identification recopiée du dossier');

    let r = await A.statut('PUT', '/personnel/bilan-social/2026', { lignes: [{ numero: 1, budgete: '100' }], commentaire: null });
    verifier(r.statut === 400 && /exige sa monnaie/.test(JSON.stringify(r.corps)), `montant sans monnaie refusé (${r.statut})`);
    r = await A.statut('PUT', '/personnel/bilan-social/2026', { lignes: [{ numero: 30 }] });
    verifier(r.statut === 400, `ligne hors du formulaire refusée (${r.statut})`);
    const saisie = {
      lignes: [
        { numero: 1, nombre: 14, budgete: '2500000', realise: '2350000.50', devise: 'CDF' },
        { numero: 10, nombre: 2, budgete: null, realise: attendu, devise: 'CDF' },
        { numero: 19, nombre: null, budgete: '1200', realise: '1350', devise: 'USD' },
      ],
      commentaire: 'Exercice sans imprévu.',
    };
    f = await A.appeler('PUT', '/personnel/bilan-social/2026', saisie).then((x) => x.corps);
    verifier(f.lignes[0].solde === '149999.50' && f.lignes[18].solde === '-150.00' && f.lignes[9].solde === null, `soldes au centime (${f.lignes[0].solde} ${f.lignes[18].solde})`);
    const cdf = (Number('2350000.50') + Number(attendu)).toFixed(2);
    verifier(JSON.stringify(f.total) === JSON.stringify([{ devise: 'CDF', budgete: '2500000.00', realise: cdf, solde: (2500000 - Number(cdf)).toFixed(2), incomplet: true }, { devise: 'USD', budgete: '1200.00', realise: '1350.00', solde: '-150.00', incomplet: false }]), `total par monnaie, jamais mêlé (${JSON.stringify(f.total)})`);
    const audit = await prisma.evenementAudit.count({ where: { tenantId, entite: 'BilanSocial' } });
    verifier(audit >= 1, `enregistrement au journal d'audit (${audit})`);

    console.log('Clôture de 2026');
    r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
    if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 600));
    const ex25 = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
    verifier(ex25.statut === 'CLOTURE', `exercice 2026 clôturé (${ex25.statut})`);
    const apres = await A.get('/personnel/bilan-social/2026');
    verifier(JSON.stringify(apres.lignes) === JSON.stringify(f.lignes) && apres.commentaire === 'Exercice sans imprévu.' && apres.enregistrePar === email, 'bilan relu à l’identique après la clôture');
    const vide = await A.get('/personnel/bilan-social/2027');
    verifier(vide.enregistreLe === null && vide.lignes[9].proposition === null && vide.total.length === 0, '2027 · rien saisi, aucune proposition sans bulletin');

    const B = new Client();
    const emailB = `bilanb-${stamp}@exemple.invalid`;
    await B.post('/auth/register', { nomEntite: 'Voisin', referentiel: 'SYCEBNL', email: emailB, motDePasse: MDP });
    await B.post('/auth/login', { email: emailB, motDePasse: MDP });
    const dB = await B.get('/personnel/bilan-social/2026');
    verifier(dB.enregistreLe === null && dB.lignes[9].proposition === null, 'un autre dossier ne voit ni la saisie ni les bulletins');
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
    if (/Maillon d'audit NON écrit/.test(journal)) { echecs.push('maillon d’audit non écrit au journal du serveur'); }
  }
  console.log(echecs.length ? `\n${echecs.length} ÉCHEC(S)` : '\nTOUT EST VERT');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
