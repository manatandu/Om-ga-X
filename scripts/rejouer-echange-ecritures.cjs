#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DE L'ÉCHANGE D'ÉCRITURES (ligne dossier-l9, fonction
 * 102) À TRAVERS UNE CLÔTURE (CLAUDE.md § 10). Serveur COMPILÉ contre une base
 * PostgreSQL JETABLE déjà migrée, deux dossiers SYSCOHADA · l'expéditeur
 * exporte ses modifications, le dossier qui reçoit les relit ·
 *  · envoi n° 1 · trois pièces créées au brouillard, le même fichier refusé ;
 *  · envoi n° 2 · une pièce remplacée EN PLACE (même numéro), une retirée, une
 *    nouvelle ;
 *  · une pièce validée chez celui qui reçoit ne se remplace plus (nommée), une
 *    pièce détachée n'est plus touchée ;
 *  · la clôture de 2026 chez celui qui reçoit · une pièce 2027 entre dans
 *    l'exercice ouvert, une pièce 2026 est refusée (exercice clôturé) ;
 *  · une écriture reçue ne repart pas par l'export de celui qui la reçoit.
 * Chaque solde lu contre le calcul à la main.
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-echange-ecritures.cjs
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE || /neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('DATABASE_URL doit pointer une base JETABLE locale, déjà migrée.');
  process.exit(2);
}
const PORT = Number(process.env.PORT_REJEU || 8113);
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
  async brut(m, chemin, corps) {
    const k = (Date.now() + n++ * 7919) % 16777216;
    const h = { 'X-Forwarded-For': `10.${(k >> 16) & 255}.${(k >> 8) & 255}.${k & 255}` };
    if (corps !== undefined) h['Content-Type'] = 'application/json';
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([a, b]) => `${a}=${b}`).join('; ');
    if (this.csrf && m !== 'GET') h['X-CSRF-Token'] = this.csrf;
    const r = await fetch(API + chemin, { method: m, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
    for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(';'); const i = p.indexOf('='); const v = p.slice(i + 1); if (!v || /1970/.test(c)) this.cookies.delete(p.slice(0, i)); else this.cookies.set(p.slice(0, i), v); }
    return r;
  }
  async appeler(m, chemin, corps, attendu = [200, 201]) {
    const r = await this.brut(m, chemin, corps);
    const t = await r.text(); let j; try { j = t ? JSON.parse(t) : undefined; } catch { j = t; }
    if (j && typeof j === 'object' && typeof j.csrfToken === 'string') this.csrf = j.csrfToken;
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 600)}`); e.statut = r.status; e.corps = j; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b, a) { return this.appeler('PATCH', c, b, a).then((r) => r.corps); }
  async fichier(c) { const r = await this.brut('GET', c); if (!r.ok) throw new Error(`${c} · ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
}

async function dossier(nom) {
  const email = `ech-${nom.toLowerCase().replace(/\W/g, '')}-${Date.now()}@exemple.invalid`;
  const c = new Client();
  await c.post('/auth/register', { nomEntite: nom, referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
  await c.post('/auth/login', { email, motDePasse: MDP });
  const me = await c.get('/auth/me');
  const tenantId = me.tenant?.id ?? me.tenantId;
  const exercices = await c.get('/exercices');
  const ex26 = exercices.find((e) => e.dateDebut.startsWith('2026'));
  const ex27 = await c.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
  const comptes = await c.get('/comptes?typeCompte=DETAIL');
  const adopter = async (racine) => { const x = comptes.find((y) => y.numero.startsWith(racine)); if (!x) throw new Error(`compte ${racine}`); await c.patch(`/comptes/${x.id}`, { estRetenu: true }); return x; };
  const journaux = await c.get('/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL');
  return { c, email, tenantId, ex26, ex27, adopter, od };
}

/** Le solde (débit moins crédit) d'un compte dans un dossier, par numéro, tous statuts. */
async function solde(tenantId, numero, exerciceId) {
  const r = await prisma.ligneEcriture.aggregate({
    where: { compte: { tenantId, numero }, ecriture: { tenantId, exerciceId, estANouveauProvisoire: false, statut: { in: ['BROUILLARD', 'VALIDEE'] } } },
    _sum: { debit: true, credit: true },
  });
  return Number(r._sum.debit ?? 0) - Number(r._sum.credit ?? 0);
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await attendre(1000); }
    const S = await dossier('Expéditeur SARL');
    const R = await dossier('Cabinet qui reçoit');
    // Les comptes du plan, adoptés chez l'expéditeur (sa saisie l'exige) · chez
    // celui qui reçoit, l'échange les lit tels quels, comme l'import.
    const loyer = await S.adopter('6222');
    const fournisseur = await S.adopter('4011');
    const banque = await S.adopter('5211');
    const capital = await S.adopter('1013');
    const piece = (ex, date, libelle, lignes) => S.c.post('/ecritures', { exerciceId: ex.id, journalId: S.od.id, date, libelle, lignes });
    const deux = (debit, credit, montant) => [{ compteId: debit.id, debit: montant, credit: 0 }, { compteId: credit.id, debit: 0, credit: montant }];

    const p1 = await piece(S.ex26, '2026-03-01', 'Loyer de mars', deux(loyer, fournisseur, 100_000));
    const p2 = await piece(S.ex26, '2026-04-01', 'Loyer d’avril', deux(loyer, fournisseur, 50_000));
    const p3 = await piece(S.ex26, '2026-01-02', 'Apport', deux(banque, capital, 1_000_000));
    await S.c.post('/ecritures/valider-jusqua', { exerciceId: S.ex26.id, dateLimite: '2026-01-31' });

    const exporter = async () => {
      const e = await S.c.post('/exports-ecritures', { mode: 'MODIFICATIONS', inclureBrouillard: true });
      const contenu = await S.c.fichier(`/exports-ecritures/${e.id}/fichier`);
      return { nomFichier: e.nomFichier, contenuBase64: contenu.toString('base64') };
    };

    console.log('== Envoi n° 1');
    const envoi1 = await exporter();
    const apercu1 = await R.c.post('/echanges-ecritures/apercu', envoi1);
    verifier(apercu1.creees === 3 && apercu1.simulation === true, `aperçu · 3 créées (${apercu1.creees}), rien d'écrit`);
    verifier((await prisma.ecriture.count({ where: { tenantId: R.tenantId } })) === 0, 'aperçu · aucune écriture chez celui qui reçoit');
    const recu1 = await R.c.post('/echanges-ecritures', envoi1);
    verifier(recu1.creees === 3 && recu1.refusees === 0, `réception n° 1 · 3 créées (${recu1.creees}), ${recu1.refusees} refusées · ${JSON.stringify(recu1.pieces)}`);
    const brouillardR = await prisma.ecriture.count({ where: { tenantId: R.tenantId, statut: 'BROUILLARD' } });
    verifier(brouillardR === 3, `les trois naissent au brouillard, apport validé chez l'expéditeur compris (${brouillardR})`);
    verifier((await solde(R.tenantId, '62220000', R.ex26.id)) === 150_000, `6222 chez celui qui reçoit · 150 000 (${await solde(R.tenantId, '62220000', R.ex26.id)})`);
    let refus = null;
    try { await R.c.post('/echanges-ecritures', envoi1); } catch (e) { refus = e; }
    verifier(refus?.statut === 409, `le même fichier ne se relit pas (${refus?.statut})`);

    // Le dossier qui reçoit ne peut ni retoucher ni retirer une écriture tenue.
    const recue1 = await prisma.ecritureRecue.findFirst({ where: { tenantId: R.tenantId, identifiantSource: p1.id } });
    let retouche = null;
    try { await R.c.appeler('DELETE', `/ecritures/${recue1.ecritureId}`); } catch (e) { retouche = e; }
    verifier(retouche && /échange/.test(retouche.message), `une écriture tenue par l'échange ne se supprime pas depuis le journal (${retouche?.statut})`);
    const numeroAvant = (await prisma.ecriture.findFirst({ where: { id: recue1.ecritureId } })).numeroPiece;

    console.log('== Envoi n° 2 · une remplacée, une retirée, une nouvelle');
    await S.c.patch(`/ecritures/${p1.id}`, { libelle: 'Loyer de mars corrigé', lignes: deux(loyer, fournisseur, 120_000) });
    await S.c.appeler('DELETE', `/ecritures/${p2.id}`);
    const p4 = await piece(S.ex26, '2026-05-02', 'Loyer de mai', deux(loyer, fournisseur, 70_000));
    const envoi2 = await exporter();
    const recu2 = await R.c.post('/echanges-ecritures', envoi2);
    verifier(recu2.creees === 1 && recu2.modifiees === 1 && recu2.retirees === 1, `réception n° 2 · ${recu2.creees} créée, ${recu2.modifiees} remplacée, ${recu2.retirees} retirée · ${JSON.stringify(recu2.pieces)}`);
    const remplacee = await prisma.ecriture.findFirst({ where: { id: recue1.ecritureId } });
    verifier(remplacee && remplacee.numeroPiece === numeroAvant, `remplacée en place, même numéro de pièce (${remplacee?.numeroPiece} contre ${numeroAvant})`);
    verifier((await solde(R.tenantId, '62220000', R.ex26.id)) === 190_000, `6222 · 120 000 + 70 000 = 190 000 (${await solde(R.tenantId, '62220000', R.ex26.id)})`);
    const p2recue = await prisma.ecritureRecue.findFirst({ where: { tenantId: R.tenantId, identifiantSource: p2.id } });
    verifier(p2recue.etat === 'RETIREE_PAR_LA_SOURCE' && p2recue.ecritureId === null, `P2 retirée, le registre le dit (${p2recue.etat})`);

    console.log('== Validée chez celui qui reçoit, détachée');
    await R.c.post('/ecritures/valider-jusqua', { exerciceId: R.ex26.id, dateLimite: '2026-03-31' });
    const p4recue = await prisma.ecritureRecue.findFirst({ where: { tenantId: R.tenantId, identifiantSource: p4.id } });
    await R.c.post(`/echanges-ecritures/recues/${p4recue.id}/detacher`, {});
    await S.c.patch(`/ecritures/${p1.id}`, { libelle: 'Loyer de mars, troisième', lignes: deux(loyer, fournisseur, 130_000) });
    await S.c.patch(`/ecritures/${p4.id}`, { libelle: 'Loyer de mai corrigé', lignes: deux(loyer, fournisseur, 75_000) });
    const envoi3 = await exporter();
    const recu3 = await R.c.post('/echanges-ecritures', envoi3);
    const nommes = recu3.pieces.map((x) => x.message).join(' | ');
    verifier(recu3.modifiees === 0 && recu3.refusees === 2, `réception n° 3 · rien de remplacé, 2 refus nommés · ${nommes}`);
    verifier(/validée dans ce dossier/.test(nommes) && /détachée/.test(nommes), 'la validée et la détachée sont nommées');
    verifier((await solde(R.tenantId, '62220000', R.ex26.id)) === 190_000, `6222 inchangé · 190 000 (${await solde(R.tenantId, '62220000', R.ex26.id)})`);
    // Détachée, elle se supprime comme toute écriture du brouillard.
    await R.c.appeler('DELETE', `/ecritures/${p4recue.ecritureId}`);
    verifier((await solde(R.tenantId, '62220000', R.ex26.id)) === 120_000, 'détachée, elle se retire au journal · 6222 à 120 000');

    console.log('== Une écriture reçue ne repart pas');
    let vide = null;
    try { await R.c.post('/exports-ecritures', { mode: 'MODIFICATIONS', inclureBrouillard: true }); } catch (e) { vide = e; }
    verifier(vide?.statut === 400, `l'export de celui qui reçoit n'a rien à envoyer (${vide?.statut})`);

    console.log('== Clôture de 2026 chez celui qui reçoit');
    await R.c.post('/ecritures/valider-jusqua', { exerciceId: R.ex26.id, dateLimite: '2026-12-31' });
    await R.c.post(`/exercices/${R.ex26.id}/cloturer`, {});
    const p5 = await piece(S.ex27, '2027-02-01', 'Loyer de février 2027', deux(loyer, fournisseur, 80_000));
    const p6 = await piece(S.ex26, '2026-12-15', 'Loyer de décembre', deux(loyer, fournisseur, 10_000));
    const envoi4 = await exporter();
    const recu4 = await R.c.post('/echanges-ecritures', envoi4);
    const nommes4 = recu4.pieces.map((x) => `${x.piece} · ${x.message}`).join(' | ');
    verifier(recu4.creees === 1 && /clôturé/.test(nommes4), `réception n° 4 · 2027 créée, 2026 refusée (exercice clôturé) · ${nommes4}`);
    const p5recue = await prisma.ecritureRecue.findFirst({ where: { tenantId: R.tenantId, identifiantSource: p5.id }, include: { ecriture: true } });
    verifier(p5recue?.ecriture?.exerciceId === R.ex27.id && p5recue.ecriture.statut === 'BROUILLARD', 'la pièce de 2027 entre dans 2027, au brouillard');
    const report401 = await solde(R.tenantId, '40110000', R.ex27.id);
    verifier(report401 === -200_000, `401 en 2027 · à-nouveau -120 000 et février -80 000 = -200 000 (${report401})`);
    const p6recue = await prisma.ecritureRecue.findFirst({ where: { tenantId: R.tenantId, identifiantSource: p6.id } });
    verifier(p6recue === null, 'la pièce de décembre 2026 n’est pas reçue, ni au registre');
    const receptions = await R.c.get('/echanges-ecritures');
    verifier(receptions.total === 4 && receptions.receptions.every((x) => x.etat === 'TERMINEE'), `${receptions.total} réceptions, toutes terminées`);
    void p3;
  } catch (e) {
    echecs.push(String(e));
    console.error(e);
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
