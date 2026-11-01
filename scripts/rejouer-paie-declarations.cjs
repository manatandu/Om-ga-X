#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · la ligne paie-declarations, à travers la clôture de
 * 2026 (CLAUDE.md § 10). Serveur compilé, base PostgreSQL jetable.
 *
 * Mission 1 (décembre 2026) · avance de 300 000 par la banque, frais
 * justifiés 350 000,50 répartis 60 / 40 entre deux projets, forfait 30 000 ·
 * le bulletin de décembre ne porte que le forfait ; régularisation avec un
 * complément de 50 000,50. Mission 2 · avance de 200 000, frais justifiés
 * 150 000, NON régularisée à la clôture · le 4213 reporte 200 000 en 2027 ;
 * régularisée en janvier 2027, trop-versé de 50 000 RETENU sur la paie de
 * janvier · reclassé au 4211 par la régularisation, puis soldé par la retenue, le 4213 soldé. La déclaration CNSS de décembre relue contre les
 * bulletins figés ; le gestionnaire de paie lit le registre des retenues, qui
 * compte les pièces de paie au brouillard. Annulations · au brouillard
 * retirée, validée en négatif ; une régularisation dont le trop-versé est
 * retenu ne s'annule pas. Une caisse vide refuse l'avance.
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
  put(c, b) { return this.appeler('PUT', c, b).then((r) => r.corps); }
  patch(c, b) { return this.appeler('PATCH', c, b).then((r) => r.corps); }
  statut(m, c, b) { return this.appeler(m, c, b, [200, 201, 400, 403, 404, 409]).then((r) => r); }
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
    const email = `paie-decl-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu Paie Déclarations SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await prisma.user.findFirst({ where: { email } })).tenantId;
    const ex26 = (await A.get('/exercices')).find((e) => e.dateDebut.startsWith('2026'));
    const ex27 = await A.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    const journaux = await A.get('/journaux');
    const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux.find((j) => j.code === 'OD');
    const bq = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerie?.numero?.startsWith('52'));
    const ca = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerie?.numero?.startsWith('57'));
    if (!od || !bq || !ca) throw new Error(`journaux introuvables · ${journaux.map((j) => `${j.code}:${j.type}:${j.compteTresorerie?.numero}`).join(', ')}`);

    const solde = async (numero, exId) => {
      const s = await prisma.ligneEcriture.aggregate({ where: { compte: { tenantId, numero }, ecriture: { tenantId, exerciceId: exId, statut: { in: ['VALIDEE', 'BROUILLARD'] } } }, _sum: { debit: true, credit: true } });
      return centimes(s._sum.debit ?? 0) - centimes(s._sum.credit ?? 0);
    };

    console.log('0. Paie non activée · le dossier neuf part sans elle (amorce)');
    const me = await A.get('/auth/me');
    verifier(Array.isArray(me.tenant?.modulesActives) && !me.tenant.modulesActives.includes('PAIE'), `dossier neuf sans le module Paie (${JSON.stringify(me.tenant?.modulesActives)})`);
    await A.patch('/dossier/modules', { modulesActives: ['PAIE'] });

    console.log('1. Projets, salarié, missions');
    const plans = await A.get('/analytique/plans');
    const axe = plans.find((p) => p.classesVentilees.split(',').includes('6'));
    const p1 = await A.post(`/analytique/plans/${axe.id}/sections`, { code: 'P1', intitule: 'Projet eau' });
    const p2 = await A.post(`/analytique/plans/${axe.id}/sections`, { code: 'P2', intitule: 'Projet école' });
    const s = await A.post('/personnel/salaries', { nom: 'MBUYI', prenoms: 'Paul', sexe: 'MASCULIN', dateNaissance: '1988-03-12', matricule: 'M010', numeroAffiliationCnss: 'CNSS-777' });
    await A.post(`/personnel/salaries/${s.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01', periodiciteRemuneration: 'MOIS', remunerationBase: 900000, deviseRemuneration: 'CDF' });
    const m1 = await A.post(`/personnel/salaries/${s.id}/missions`, { objet: 'Suivi des forages', destination: 'Kikwit', dateDepart: '2026-12-02', dateRetour: '2026-12-10' });
    const m2 = await A.post(`/personnel/salaries/${s.id}/missions`, { objet: 'Formation', destination: 'Matadi', dateDepart: '2026-12-14', dateRetour: '2026-12-18' });

    let r = await A.statut('PUT', `/personnel/missions/${m1.id}/repartitions/${axe.id}`, { lignes: [{ sectionId: p1.id, pourcentage: 60 }, { sectionId: p2.id, pourcentage: 40 }] });
    verifier(r.statut === 400 && /pas d'avance/.test(JSON.stringify(r.corps)), `sans avance, la répartition par projet est refusée, nommée (${r.statut})`);

    console.log('2. Avances');
    r = await A.statut('POST', `/personnel/missions/${m1.id}/avance`, { exerciceId: ex26.id, journalId: ca.id, date: '2026-12-01', montantFc: 300000, pieceJustificative: 'Bon de caisse 1' });
    verifier(r.statut === 400 && /caisse|57/i.test(JSON.stringify(r.corps)), `une caisse vide ne verse pas l'avance (${r.statut} · ${JSON.stringify(r.corps).slice(0, 160)})`);
    const av1 = await A.post(`/personnel/missions/${m1.id}/avance`, { exerciceId: ex26.id, journalId: bq.id, date: '2026-12-01', montantFc: 300000, pieceJustificative: 'Virement 1' });
    r = await A.statut('POST', `/personnel/missions/${m1.id}/avance`, { exerciceId: ex26.id, journalId: bq.id, date: '2026-12-01', montantFc: 1000, pieceJustificative: 'Virement bis' });
    verifier(r.statut === 400 && /une seule avance/.test(JSON.stringify(r.corps)), `une seconde avance est refusée (${r.statut})`);
    const av2 = await A.post(`/personnel/missions/${m2.id}/avance`, { exerciceId: ex26.id, journalId: bq.id, date: '2026-12-12', montantFc: 200000, pieceJustificative: 'Virement 2' });
    verifier((await solde('42130000', ex26.id)) === 50_000_000, '4213 (frais avancés) débité de 500 000 après les deux avances');
    r = await A.statut('PUT', `/personnel/missions/${m1.id}/repartitions/${axe.id}`, { lignes: [{ sectionId: p1.id, pourcentage: 60 }, { sectionId: p2.id, pourcentage: 39 }] });
    verifier(r.statut === 400 && /99\.00 %/.test(JSON.stringify(r.corps)), `une répartition à 99 % est refusée (${r.statut})`);
    await A.put(`/personnel/missions/${m1.id}/repartitions/${axe.id}`, { lignes: [{ sectionId: p1.id, pourcentage: 60 }, { sectionId: p2.id, pourcentage: 40 }] });
    r = await A.statut('POST', `/personnel/missions/${m2.id}/avance`, { exerciceId: ex27.id, journalId: bq.id, date: '2026-12-12', montantFc: 1000, pieceJustificative: 'x' });
    verifier(r.statut === 400, `une date hors de l'exercice choisi est refusée, nommée (${r.statut})`);

    console.log('3. Frais et bulletin de décembre');
    await A.post(`/personnel/missions/${m1.id}/frais`, { element: 'HEBERGEMENT', qualification: 'JUSTIFIE', montantFc: 350000.5, piece: 'Hôtel 12' });
    await A.post(`/personnel/missions/${m1.id}/frais`, { element: 'DIVERS', qualification: 'FORFAIT', montantFc: 30000 });
    await A.post(`/personnel/missions/${m2.id}/frais`, { element: 'TRANSPORT', qualification: 'JUSTIFIE', montantFc: 150000, piece: 'Billet 7' });
    const duMois = await A.get(`/personnel/salaries/${s.id}/missions/mois/2026-12`);
    const lu1 = duMois.find((x) => x.id === m1.id);
    verifier(lu1 && lu1.aPorterAuBulletin.justifieFc === 0 && lu1.aPorterAuBulletin.forfaitFc === 30000, `mission avancée · le bulletin ne porte que le forfait (${JSON.stringify(lu1?.aPorterAuBulletin)})`);
    verifier(!duMois.some((x) => x.id === m2.id), 'mission 2 avancée sans forfait · rien à porter au bulletin');
    const bDec = await A.post(`/personnel/salaries/${s.id}/bulletins`, {
      moisDePaie: '2026-12',
      elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 900000 }],
      natureEmployeurInpp: 'PRIVE',
      effectif: 5,
      enfantsBeneficiairesAllocations: 2,
      missionsPortees: [{ missionId: m1.id }],
    });
    const elemMission = (bDec.entree?.elements ?? []).filter((e) => e.missionId === m1.id);
    verifier(elemMission.length === 1 && centimes(elemMission[0].montantFc) === 3_000_000, `le bulletin porte le seul forfait de 30 000 (${JSON.stringify(elemMission)})`);
    await A.post('/personnel/paie-du-mois/2026-12/comptabilisation', { exerciceId: ex26.id, journalId: od.id, date: '2026-12-31' });

    console.log('4. Déclaration CNSS de décembre, relue contre le bulletin figé');
    const d = await A.get('/personnel/declaration-cnss/2026-12');
    const v = (rang) => d.enonciations.find((e) => e.rang === rang).valeur;
    const bLu = await prisma.bulletinPaie.findUnique({ where: { id: bDec.id }, select: { totalVerseFc: true, calcul: true } });
    const lignesCnss = bLu.calcul.cotisations.lignes.filter((l) => l.organisme === 'CNSS');
    verifier(centimes(v(5)) === centimes(bLu.totalVerseFc), `point 5 · total versé ${v(5)} = bulletin ${bLu.totalVerseFc}`);
    verifier(centimes(v(6)) === centimes(lignesCnss[0].assietteFc), `point 6 · base ${v(6)} = assiette figée ${lignesCnss[0].assietteFc}`);
    verifier(centimes(v(7)) === lignesCnss.reduce((t, l) => t + centimes(l.montantFc), 0), `point 7 · cotisations ${v(7)}`);
    // À la main · base 900 000 + 30 000 de forfait exclu de l'assiette (art. 7, point 8) · 18 % de 900 000 = 162 000.
    verifier(centimes(v(7)) === 16_200_000, `18 % de 900 000 = 162 000 (${v(7)})`);
    verifier(v(8) === 1 && v(9) === 2 && v(2) === null, `points 8 (${v(8)}), 9 (${v(9)}), affiliation non renseignée nommée (${v(2)})`);
    verifier(d.echeance.dateLimite === '2027-01-15', `échéance au 15 janvier 2027 (${d.echeance.dateLimite})`);
    const vide = await A.get('/personnel/declaration-cnss/2027-02');
    verifier(/Aucun bulletin émis/.test(vide.aucunBulletin ?? ''), 'février 2027 sans bulletin · dit');
    r = await A.statut('GET', '/personnel/declaration-cnss/2026-12/excel');
    verifier(r.statut === 200, `export Excel (${r.statut})`);

    console.log('5. Régularisation de la mission 1 · complément de 50 000,50, ventilé 60 / 40');
    r = await A.statut('POST', `/personnel/missions/avances/${av1.id}/regularisation`, { exerciceId: ex26.id, journalId: bq.id, date: '2026-12-20', pieceJustificative: 'Décompte 1' });
    verifier(r.statut === 400 && /pas constatée/.test(JSON.stringify(r.corps)), `refusée avant la fin de mission (${r.statut})`);
    await A.patch(`/personnel/missions/${m1.id}/fin`, { accomplieLe: '2026-12-10' });
    await A.patch(`/personnel/missions/${m2.id}/fin`, { accomplieLe: '2026-12-18' });
    const reg1 = await A.post(`/personnel/missions/avances/${av1.id}/regularisation`, { exerciceId: ex26.id, journalId: bq.id, date: '2026-12-20', pieceJustificative: 'Décompte 1' });
    verifier(reg1.issue === 'COMPLEMENT_PAYE' && centimes(reg1.ecartFc) === 5_000_050 && reg1.ventilee === true, `complément de 50 000,50, ventilé (${JSON.stringify(reg1)})`);
    const eReg1 = (await prisma.regularisationMission.findUnique({ where: { id: reg1.id }, select: { ecritureId: true } })).ecritureId;
    const vent = await prisma.ventilationAnalytique.findMany({ where: { ligne: { ecritureId: eReg1 } }, select: { debit: true, section: { select: { code: true } } } });
    const parSection = Object.fromEntries(vent.map((x) => [x.section.code, centimes(x.debit)]));
    verifier(parSection.P1 === 21_000_030 && parSection.P2 === 14_000_020, `6384 ventilé · P1 210 000,30, P2 140 000,20 (${JSON.stringify(parSection)})`);
    r = await A.statut('POST', `/personnel/missions/${m1.id}/frais`, { element: 'DIVERS', qualification: 'JUSTIFIE', montantFc: 100, piece: 'x' });
    verifier(r.statut === 409, `une mission régularisée ne change plus (${r.statut})`);
    r = await A.statut('POST', `/personnel/missions/avances/${av2.id}/regularisation`, { exerciceId: ex26.id, journalId: od.id, date: '2026-12-20', pieceJustificative: 'Décompte 2' });
    verifier(r.statut === 400 && /trop-versé/.test(JSON.stringify(r.corps)), `trop-versé sans choix · refus qui demande le sort (${r.statut})`);

    console.log('6. Clôture de 2026, mission 2 non régularisée');
    // 6384 · 350 000,50 de la régularisation + 30 000 de forfait passés par la paie.
    verifier((await solde('63840000', ex26.id)) === 38_000_050, `6384 de 2026 · 380 000,50 (${(await solde('63840000', ex26.id)) / 100})`);
    verifier((await solde('42130000', ex26.id)) === 20_000_000, `4213 de 2026 · 200 000 de la mission 2 (${(await solde('42130000', ex26.id)) / 100})`);
    verifier((await solde('42110000', ex26.id)) === 0, '4211 de 2026 intact');
    for (let k = 0; k < 3; k++) await A.post('/ecritures/valider-jusqua', { exerciceId: ex26.id, dateLimite: '2026-12-31' });
    r = await A.statut('POST', `/exercices/${ex26.id}/cloturer`, {});
    if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 900));
    verifier((await prisma.exercice.findUnique({ where: { id: ex26.id } })).statut === 'CLOTURE', 'exercice 2026 clôturé');
    verifier((await solde('42130000', ex27.id)) === 20_000_000, `à-nouveau 2027 · 4213 de 200 000 (${(await solde('42130000', ex27.id)) / 100})`);
    r = await A.statut('POST', `/personnel/missions/avances/${av1.id}/annulation`, { motif: 'Essai après clôture' });
    verifier(r.statut === 409 || r.statut === 400, `l'avance régularisée d'un exercice clos ne s'annule pas (${r.statut})`);

    console.log('7. Janvier 2027 · trop-versé de 50 000 retenu sur la paie');
    const reg2 = await A.post(`/personnel/missions/avances/${av2.id}/regularisation`, { exerciceId: ex27.id, journalId: od.id, date: '2027-01-05', pieceJustificative: 'Décompte 2', tropVerse: 'RETENU' });
    verifier(reg2.issue === 'TROP_VERSE_RETENU' && reg2.avanceSalaireId, `trop-versé retenu · une avance du registre (${JSON.stringify(reg2)})`);
    verifier((await solde('42130000', ex27.id)) === 0, `4213 soldé par la régularisation (${(await solde('42130000', ex27.id)) / 100})`);
    verifier((await solde('42110000', ex27.id)) === 5_000_000, `4211 · 50 000 reclassés, restent dus (${(await solde('42110000', ex27.id)) / 100})`);
    const bJan = await A.post(`/personnel/salaries/${s.id}/bulletins`, {
      moisDePaie: '2027-01',
      elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 900000 }],
      natureEmployeurInpp: 'PRIVE',
      effectif: 5,
      enfantsBeneficiairesAllocations: 2,
      retenuesAvances: [{ avanceId: reg2.avanceSalaireId, montantFc: 50000 }],
    });
    await A.post('/personnel/paie-du-mois/2027-01/comptabilisation', { exerciceId: ex27.id, journalId: od.id, date: '2027-01-31' });
    verifier((await solde('42110000', ex27.id)) === 0, `4211 soldé par la retenue du bulletin n° ${bJan.numero}`);
    r = await A.statut('POST', `/personnel/missions/regularisations/${reg2.id}/annulation`, { motif: 'Essai' });
    verifier(r.statut === 409 && /retenu par 1 bulletin/.test(JSON.stringify(r.corps)), `trop-versé déjà retenu · annulation refusée (${r.statut})`);
    r = await A.statut('DELETE', `/personnel/avances/${reg2.avanceSalaireId}`);
    verifier(r.statut === 409, `l'avance née d'une régularisation ne se supprime pas seule (${r.statut})`);

    console.log('8. Gestionnaire de paie · le registre des retenues, en lecture');
    const emailG = `paie-decl-g-${stamp}@exemple.invalid`;
    await A.post('/utilisateurs', { email: emailG, motDePasse: 'Provisoire-2026-xyz!', role: 'GESTIONNAIRE_PAIE' });
    const G = new Client();
    await G.post('/auth/login', { email: emailG, motDePasse: 'Provisoire-2026-xyz!' });
    await G.post('/auth/changer-mot-de-passe', { motDePasseActuel: 'Provisoire-2026-xyz!', nouveauMotDePasse: MDP });
    await G.post('/auth/login', { email: emailG, motDePasse: MDP });
    const reg = await G.get(`/retenues/registre?exerciceId=${ex27.id}&dateReference=2027-02-20`);
    verifier(reg.piecesDePaieAuBrouillard === 1, `la paie de janvier au brouillard se compte (${reg.piecesDePaieAuBrouillard})`);
    verifier(reg.vueDeLaPaie === true && reg.natures.every((n) => ['irppSalaires', 'cnss', 'inppOnem', 'autresOrganismesSociaux'].includes(n.cle)), `vue de la paie · ${reg.natures.map((n) => n.cle).join(', ')}`);
    const regA = await A.get(`/retenues/registre?exerciceId=${ex27.id}&dateReference=2027-02-20`);
    verifier(regA.natures.some((n) => n.cle === 'tva') && !regA.vueDeLaPaie, 'l’administrateur lit le registre entier');
    const ech = await G.get(`/retenues/echeancier?exerciceId=${ex27.id}&dateReference=2027-02-20`);
    verifier(Array.isArray(ech.echeances), 'le gestionnaire lit l’échéancier');
    r = await G.statut('GET', `/ecritures?exerciceId=${ex27.id}`);
    verifier(r.statut === 403, `le journal lui reste fermé (${r.statut})`);
    r = await G.statut('POST', `/personnel/missions/avances/${av2.id}/annulation`, { motif: 'Essai gestionnaire' });
    verifier(r.statut === 403, `l'annulation d'une avance lui est fermée (${r.statut})`);
    const decl = await G.get('/personnel/declaration-cnss/2027-01');
    verifier(decl.bulletins.length === 1, 'le gestionnaire prépare la déclaration CNSS');
    await A.post('/ecritures/valider-jusqua', { exerciceId: ex27.id, dateLimite: '2027-01-31' });
    const reg3 = await G.get(`/retenues/registre?exerciceId=${ex27.id}&dateReference=2027-02-20`);
    verifier(reg3.piecesDePaieAuBrouillard === 0, 'validée, la paie entre au registre');

    console.log('9. Annulations · au brouillard retirée, validée en négatif');
    const m3 = await A.post(`/personnel/salaries/${s.id}/missions`, { objet: 'Audit', destination: 'Goma', dateDepart: '2027-02-02', dateRetour: '2027-02-05' });
    const av3 = await A.post(`/personnel/missions/${m3.id}/avance`, { exerciceId: ex27.id, journalId: bq.id, date: '2027-02-01', montantFc: 80000, pieceJustificative: 'Virement 3' });
    const e3 = (await prisma.avanceMission.findUnique({ where: { id: av3.id }, select: { ecritureId: true } })).ecritureId;
    r = await A.statut('DELETE', `/ecritures/${e3}`);
    verifier(r.statut >= 400, `la pièce de l'avance ne se supprime pas depuis le journal (${r.statut})`);
    await A.post(`/personnel/missions/avances/${av3.id}/annulation`, { motif: 'Mission reportée' });
    verifier((await prisma.ecriture.count({ where: { id: e3 } })) === 0, 'au brouillard, la pièce est retirée');
    const av4 = await A.post(`/personnel/missions/${m3.id}/avance`, { exerciceId: ex27.id, journalId: bq.id, date: '2027-02-01', montantFc: 90000, pieceJustificative: 'Virement 4' });
    await A.post('/ecritures/valider-jusqua', { exerciceId: ex27.id, dateLimite: '2027-02-28' });
    await A.post(`/personnel/missions/avances/${av4.id}/annulation`, { motif: 'Montant faux' });
    const a4 = await prisma.avanceMission.findUnique({ where: { id: av4.id }, select: { ecritureNegatifId: true, annuleLe: true } });
    verifier(a4.annuleLe && a4.ecritureNegatifId, 'validée, la pièce est inscrite en négatif');
    verifier((await solde('42130000', ex27.id)) === 0, '4213 de 2027 revenu à zéro après le négatif');
    r = await A.statut('POST', `/personnel/missions/${m1.id}/annulation`, { motif: 'Essai' });
    verifier(r.statut === 409 && /annulez la régularisation, puis l'avance, puis la mission/.test(JSON.stringify(r.corps)), `mission régularisée · l'ordre des gestes est nommé (${r.statut})`);

    console.log('10. Cloisonnement');
    const autre = new Client();
    const emailX = `paie-decl-x-${stamp}@exemple.invalid`;
    await autre.post('/auth/register', { nomEntite: 'Voisin', referentiel: 'SYCEBNL', email: emailX, motDePasse: MDP });
    await autre.post('/auth/login', { email: emailX, motDePasse: MDP });
    r = await autre.statut('GET', `/personnel/missions/avances/${av2.id}/regularisation/proposition`);
    verifier(r.statut === 404, `l'avance d'un autre dossier est introuvable (${r.statut})`);
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
  }
  console.log(echecs.length ? `\n${echecs.length} ÉCHEC(S)` : '\nTOUT EST VERT');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
