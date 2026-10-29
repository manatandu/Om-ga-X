#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · les déclarations de mouvement du travailleur et
 * d'établissement (art. 216 et 217 ; arrêtés n° 006 et 008 de 2010). Un
 * engagement en 2025, un départ déclaré après la clôture de 2025, le
 * formulaire lu par l'API du serveur compilé · délai de quinze jours de la
 * loi, motif refusé sans date de fin, champs du registre recopiés, manquants
 * nommés, quinzaine d'établissement.
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!RACINE || !/localhost|127\.0\.0\.1/.test(URL_BASE)) { console.error('RACINE et DATABASE_URL locale exigés'); process.exit(2); }
const PORT = 8097;
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
    const email = `decl-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu Declarations SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await A.get('/auth/me')).tenant?.id ?? (await prisma.user.findFirst({ where: { email } })).tenantId;
    let exercices = await A.get('/exercices');
    const e2026 = exercices.find((e) => e.dateDebut.startsWith('2026'));
    const e2025 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
    await prisma.tenant.update({ where: { id: tenantId }, data: { adresse: 'Av. du Port 4', ville: 'Kinshasa', activite: 'Commerce', numeroAffiliationCnssEmployeur: 'CNSS-E-77' } });

    const s1 = await A.post('/personnel/salaries', { nom: 'MBALA', postNom: 'KIESE', prenoms: 'Jean', sexe: 'MASCULIN', nationalite: 'Congolaise', lieuNaissance: 'Matadi', dateNaissance: '1990-03-04' });
    const c1 = await A.post(`/personnel/salaries/${s1.id}/contrats`, {
      type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2025-11-03', natureTravail: 'Magasinier', classeProfessionnelle: 5,
      periodiciteRemuneration: 'MOIS', remunerationBase: 650000, deviseRemuneration: 'CDF',
    });
    const s2 = await A.post('/personnel/salaries', { nom: 'DUPONT', prenoms: 'Anne', sexe: 'FEMININ', nationalite: 'Française' });
    const c2 = await A.post(`/personnel/salaries/${s2.id}/contrats`, { type: 'DUREE_DETERMINEE', dateEntreeEnVigueur: '2025-06-01', dateFinPrevue: '2026-05-31' });

    let r = await A.statut('GET', `/personnel/contrats/${c1.id}/declaration-mouvement?motif=EMBAUCHE`);
    verifier(r.statut === 200, `formulaire d'embauche lu (${r.statut})`);
    const f = r.corps;
    const v = (l) => [...f.employeur, ...f.travailleur].find((c) => c.libelle === l)?.valeur;
    verifier(f.echeance === '2025-11-18', `échéance à quinze jours de la loi (${f.echeance})`);
    verifier(v('Nom et prénoms') === 'MBALA, KIESE, Jean' && v('Emploi') === 'Magasinier' && v('Salaire') === '650000.00 CDF par mois', 'champs recopiés du registre');
    verifier(v('Adresse') === 'Av. du Port 4, Kinshasa' && v('N° INSS (CNSS)') === 'CNSS-E-77', "identité de l'employeur recopiée de la fiche du dossier");
    verifier(f.manquants.includes('Téléphone') && !f.travailleur.some((c) => c.libelle.startsWith('Carte de travail')), 'manquants nommés · pas de carte de travail pour un national');
    verifier(f.enRetard === true && f.faiteLe === null, 'délai couru, non déclarée');
    verifier(/Direction provinciale de l'Office national de l'emploi/.test(f.destinataires) && /Division provinciale de l'Emploi et du Travail \(deux exemplaires\)/.test(f.exemplaires) && /tel que l'ONEM le remet/.test(f.formulaire) && /10 USD par travailleur/.test(f.redevance), "services et exemplaires de l'arrêté du 24 février 2023, formulaire de 2010 tel que l’ONEM le remet");

    console.log('Clôture de 2025');
    r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
    if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 600));
    const ex25 = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
    verifier(ex25.statut === 'CLOTURE', `exercice 2025 clôturé (${ex25.statut})`);

    r = await A.statut('GET', `/personnel/contrats/${c2.id}/declaration-mouvement?motif=EXPIRATION_NORMALE`);
    verifier(r.statut === 400 && /date du départ/.test(JSON.stringify(r.corps)), `départ refusé sans date de fin au registre (${r.statut})`);
    await A.post(`/personnel/contrats/${c2.id}/fin`, { dateFin: '2026-05-31', motifFin: 'Terme' });
    r = await A.statut('GET', `/personnel/contrats/${c2.id}/declaration-mouvement?motif=EXPIRATION_NORMALE`);
    verifier(r.statut === 200 && r.corps.motif.le === '2026-05-31' && r.corps.offreAPreciser === true && r.corps.echeance === '2026-06-15', `formulaire de départ en 2026 · date, offre, échéance (${JSON.stringify(r.corps.motif)} ${r.corps.echeance})`);
    verifier(r.corps.manquants.includes('Carte de travail, délivrée le'), "carte de travail réclamée d'une étrangère");
    r = await A.statut('GET', `/personnel/contrats/${c2.id}/declaration-mouvement?motif=RETRAITE`);
    verifier(r.statut === 400, `motif inconnu refusé (${r.statut})`);

    // Réembauche · la date de déclaration de la fiche ne vaut que pour le DERNIER contrat.
    await prisma.salarie.update({ where: { id: s2.id }, data: { declarationEngagementLe: new Date('2025-06-05T00:00:00Z') } });
    const c3 = await A.post(`/personnel/salaries/${s2.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-07-01' });
    r = await A.statut('GET', `/personnel/contrats/${c2.id}/declaration-mouvement?motif=EMBAUCHE`);
    verifier(r.statut === 200 && r.corps.faiteLe === null && r.corps.enRetard === null && /pas le dernier/.test(r.corps.etatNonTenu ?? ''), `contrat antérieur · état non lu, dit (${r.corps.faiteLe} ${r.corps.enRetard})`);
    r = await A.statut('GET', `/personnel/contrats/${c3.id}/declaration-mouvement?motif=EMBAUCHE`);
    verifier(r.statut === 200 && r.corps.etatNonTenu === null && r.corps.echeance === '2026-07-16', `dernier contrat · état lu, échéance à quinze jours (${r.corps.echeance})`);

    r = await A.statut('GET', '/personnel/declaration-etablissement?nature=FERMETURE&date=2026-03-01');
    verifier(r.statut === 200 && r.corps.fenetre.du === '2026-02-14' && r.corps.fenetre.au === '2026-02-28', `quinzaine qui précède (${JSON.stringify(r.corps.fenetre)})`);
    verifier(r.corps.nature === 'FERMETURE' && r.corps.date === '2026-03-01' && r.corps.natureLibelle === 'Fermeture' && ['AVANT', 'DANS', 'APRES'].includes(r.corps.position), `nature, date et position rendues par le serveur (${r.corps.position})`);
    r = await A.statut('GET', '/personnel/declaration-etablissement?nature=OUVERTURE&date=2099-01-20');
    verifier(r.corps.position === 'AVANT', `quinzaine pas encore ouverte (${r.corps.position})`);
    r = await A.statut('GET', '/personnel/declaration-etablissement?nature=VENTE');
    verifier(r.statut === 400, `nature inconnue refusée (${r.statut})`);

    // Un autre dossier ne lit pas le contrat de celui-ci.
    const B = new Client();
    const emailB = `declb-${stamp}@exemple.invalid`;
    await B.post('/auth/register', { nomEntite: 'Voisin', referentiel: 'SYCEBNL', email: emailB, motDePasse: MDP });
    await B.post('/auth/login', { email: emailB, motDePasse: MDP });
    r = await B.statut('GET', `/personnel/contrats/${c1.id}/declaration-mouvement?motif=EMBAUCHE`);
    verifier(r.statut === 404, `contrat d'un autre dossier introuvable (${r.statut})`);
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
    if (/Maillon d'audit NON écrit/.test(journal)) { echecs.push('maillon d’audit non écrit au journal du serveur'); }
  }
  console.log(echecs.length ? `\n${echecs.length} ÉCHEC(S)` : '\nTOUT EST VERT');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
