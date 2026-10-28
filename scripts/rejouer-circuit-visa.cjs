#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DU CIRCUIT DE VISA SOUS LE DOUBLE REGARD (ligne
 * microfina-m1, relecture du 2026-10-28, constats M1 et M5 · CLAUDE.md § 10).
 * Serveur COMPILÉ contre une base PostgreSQL JETABLE déjà migrée, dossier
 * SYSCOHADA, double regard et circuit actifs · A saisit, B vise, C valide ·
 *  · un mois chargé (1 200 pièces) validé par période, par tranches ;
 *  · la réimputation par C lancée en même temps que la validation par B des
 *    mêmes pièces · aucune ligne d'une pièce validée ne change de compte en
 *    place, le refus est un 409 nommé ;
 *  · à travers la clôture de 2026, puis dans 2027 · soldes lus contre le
 *    calcul à la main.
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-circuit-visa.cjs
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE || /neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('DATABASE_URL doit pointer une base JETABLE locale, déjà migrée.');
  process.exit(2);
}
const PORT = 8093;
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-rejeu-2026!';
const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
const echecs = [];
const verifier = (c, m) => { if (!c) { echecs.push(m); console.log(`  ECHEC · ${m}`); } else console.log(`  ok · ${m}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 1;
class Client {
  constructor() { this.cookies = new Map(); this.csrf = null; const k = (Date.now() + n++ * 7919) % 16777216; this.ip = `10.${(k >> 16) & 255}.${(k >> 8) & 255}.${k & 255}`; }
  async appeler(m, chemin, corps, attendu = [200, 201]) {
    // Une adresse par requête · la limite de débit est par adresse, et le rejeu n'en éprouve pas la limite.
    const k = (Date.now() + n++ * 7919) % 16777216;
    const h = { 'X-Forwarded-For': `10.${(k >> 16) & 255}.${(k >> 8) & 255}.${k & 255}` };
    if (corps !== undefined) h['Content-Type'] = 'application/json';
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([a, b]) => `${a}=${b}`).join('; ');
    if (this.csrf && m !== 'GET') h['X-CSRF-Token'] = this.csrf;
    const r = await fetch(API + chemin, { method: m, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
    for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(';'); const i = p.indexOf('='); const v = p.slice(i + 1); if (!v || /1970/.test(c)) this.cookies.delete(p.slice(0, i)); else this.cookies.set(p.slice(0, i), v); }
    const t = await r.text(); let j; try { j = t ? JSON.parse(t) : undefined; } catch { j = t; }
    if (j && typeof j === 'object' && typeof j.csrfToken === 'string') this.csrf = j.csrfToken;
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 500)}`); e.statut = r.status; e.corps = j; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b) { return this.appeler('PATCH', c, b).then((r) => r.corps); }
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await attendre(1000); }
    const stamp = Date.now();
    const emailA = `a-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu M1 SARL', referentiel: 'SYSCOHADA', email: emailA, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email: emailA, motDePasse: MDP });
    const comptables = {};
    for (const nom of ['B', 'C']) {
      const email = `${nom.toLowerCase()}-${stamp}@exemple.invalid`;
      await A.post('/utilisateurs', { email, motDePasse: 'Provisoire-2026-xyz!', role: 'COMPTABLE' });
      const c = new Client();
      await c.post('/auth/login', { email, motDePasse: 'Provisoire-2026-xyz!' });
      await c.post('/auth/changer-mot-de-passe', { motDePasseActuel: 'Provisoire-2026-xyz!', nouveauMotDePasse: MDP });
      await c.post('/auth/login', { email, motDePasse: MDP });
      comptables[nom] = c;
    }
    const { B, C } = comptables;
    await A.patch('/dossier/double-regard', { doubleRegardValidation: true });
    await A.patch('/dossier/circuit-visa', { circuitVisa: true });
    let exercices = await A.get('/exercices');
    const ex26 = exercices.find((e) => e.dateDebut.startsWith('2026'));
    verifier(!!ex26, `exercice 2026 présent (${exercices.map((e) => e.dateDebut.slice(0, 10)).join(', ')})`);
    const ex27 = await A.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    const comptes = await A.get('/comptes?typeCompte=DETAIL');
    const adopter = async (racine) => { const x = comptes.find((c) => c.numero.startsWith(racine)); if (!x) throw new Error(`compte ${racine}`); await A.patch(`/comptes/${x.id}`, { estRetenu: true }); return x; };
    const journaux = await A.get('/journaux');
    const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
    const banque = await adopter('5211');
    const capital = await adopter('1013');
    const charge = await adopter('6052');
    const cible = await adopter('6053');
    const ecr = (cli, ex, date, libelle, lignes) => cli.post('/ecritures', { exerciceId: ex.id, journalId: od.id, date, libelle, lignes });
    const deux = (d, c, m) => [{ compteId: d.id, libelle: 'L', debit: m, credit: 0 }, { compteId: c.id, libelle: 'L', debit: 0, credit: m }];

    // 1. Le mois chargé · 1 200 pièces de janvier 2026, saisies par A.
    console.log('Saisie de 1 200 pièces de janvier par A…');
    await ecr(A, ex26, '2026-01-01', 'Apport', deux(banque, capital, 50_000_000));
    for (let i = 1; i < 1200; i++) {
      const jour = String(1 + (i % 31)).padStart(2, '0');
      await ecr(A, ex26, `2026-01-${jour}`, `Charge ${i}`, deux(charge, banque, 1000)).catch((e) => { throw new Error(`pièce ${i} · ${e.message}`); });
    }
    // 2. B vise tout janvier, par lots de 200.
    let etat = await B.get(`/ecritures/brouillard?exerciceId=${ex26.id}&dateFin=2026-01-31`);
    verifier(etat.lignes.length === 1200, `brouillard de janvier · ${etat.lignes.length} pièces`);
    let visees = 0;
    for (let i = 0; i < etat.lignes.length; i += 200) {
      const r = await B.post('/circuit-visa/ecritures', { pieces: etat.lignes.slice(i, i + 200).map((l) => ({ id: l.id, empreinte: l.empreinte })) });
      visees += r.visees;
    }
    verifier(visees === 1200, `B vise les 1 200 pièces (${visees})`);
    // 3. C valide la période (M5) · trois tranches.
    const t0 = Date.now();
    const v = await C.post('/ecritures/valider-jusqua', { exerciceId: ex26.id, dateLimite: '2026-01-31' });
    const duree = Date.now() - t0;
    verifier(v.validees === 1200 && v.refuseesVisa === 0 && v.refuseesSecondRegard === 0 && v.retireesEntreTemps === 0, `C valide janvier · ${v.validees} validées en ${duree} ms, ${v.refuseesVisa} sans visa, ${v.retireesEntreTemps} retirées`);
    const [{ n: valideesBase }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int n FROM ecritures WHERE "tenantId"=$1 AND statut='VALIDEE' AND date <= '2026-01-31'`, ex26.tenantId ?? (await A.get('/auth/me')).tenantId);
    verifier(valideesBase === 1200, `base · 1 200 pièces de janvier validées (${valideesBase})`);
    // Le double regard sous tranches · A, auteur, valide février · écarté et compté.
    for (let i = 0; i < 3; i++) await ecr(A, ex26, '2026-02-10', `Février ${i}`, deux(charge, banque, 2000));
    etat = await B.get(`/ecritures/brouillard?exerciceId=${ex26.id}&dateDebut=2026-02-01&dateFin=2026-02-28`);
    await B.post('/circuit-visa/ecritures', { pieces: etat.lignes.map((l) => ({ id: l.id, empreinte: l.empreinte })) });
    const parA = await A.post('/ecritures/valider-jusqua', { exerciceId: ex26.id, dateLimite: '2026-02-28' });
    verifier(parA.validees === 0 && parA.refuseesSecondRegard === 3, `A, auteur, ne valide pas février · ${parA.refuseesSecondRegard} écartées par le double regard`);

    // 4. La course de M1 · C réimpute des brouillards visés pendant que B valide.
    const tenantId = (await A.get('/auth/me')).tenantId ?? (await A.get('/auth/me')).user?.tenantId;
    const course = async (ex, mois, tour) => {
      const ids = [];
      for (let i = 0; i < 60; i++) ids.push((await ecr(A, ex, `${mois}-15`, `Course ${tour}-${i}`, deux(charge, banque, 500))).id);
      const e = await B.get(`/ecritures/brouillard?exerciceId=${ex.id}&dateDebut=${mois}-15&dateFin=${mois}-15`);
      const a = e.lignes.filter((l) => ids.includes(l.id));
      await B.post('/circuit-visa/ecritures', { pieces: a.map((l) => ({ id: l.id, empreinte: l.empreinte })) });
      const lignesCharge = await prisma.ligneEcriture.findMany({ where: { ecritureId: { in: ids }, compteId: charge.id }, select: { id: true } });
      const decalage = (tour % 4) * 15;
      const [reimp, valid] = await Promise.allSettled([
        attendre(decalage).then(() => C.post('/ecritures/reimputation', { ligneIds: lignesCharge.map((l) => l.id), compteCibleId: cible.id, motif: 'Course de rejeu', date: `${mois}-28` })),
        B.post('/ecritures/valider', { ecritureIds: ids }),
      ]);
      // L'invariant · aucune ligne d'une pièce VALIDÉE n'a changé de compte en place.
      const fautives = await prisma.ligneEcriture.count({ where: { ecritureId: { in: ids }, compteId: cible.id, ecriture: { statut: 'VALIDEE' } } });
      const issueR = reimp.status === 'fulfilled' ? `réimputation passée (${reimp.value.auBrouillard} au brouillard, ${reimp.value.validees} validées)` : `réimputation refusée ${reimp.reason.statut}`;
      const issueV = valid.status === 'fulfilled' ? `validation ${valid.value.validees}, visa tombé ${valid.value.refuseesVisa}` : `validation refusée ${valid.reason.statut}`;
      verifier(fautives === 0, `course ${tour} (${mois}) · ${issueR} · ${issueV} · ${fautives} ligne(s) validée(s) déplacée(s) en place`);
      if (reimp.status === 'rejected') verifier([409].includes(reimp.reason.statut), `course ${tour} · le refus est un 409 nommé · ${String(reimp.reason.message).slice(0, 200)}`);
      // Ce qui reste au brouillard se valide par C après revisa par B, pour la clôture.
      return reimp.status === 'rejected' ? 'R' : 'P';
    };
    const issues = [];
    for (let t = 0; t < 8; t++) issues.push(await course(ex26, '2026-03', t));
    console.log(`  issues des courses 2026 · ${issues.join('')}`);

    // 5. Tout valider pour la clôture · B vise, C valide.
    const toutValider = async (ex, fin) => {
      for (let k = 0; k < 5; k++) {
        const e = await B.get(`/ecritures/brouillard?exerciceId=${ex.id}`);
        if (e.lignes.length === 0) return;
        const avis = e.lignes.filter((l) => l.empreinte);
        for (let i = 0; i < avis.length; i += 200) await B.post('/circuit-visa/ecritures', { pieces: avis.slice(i, i + 200).map((l) => ({ id: l.id, empreinte: l.empreinte })) });
        // Les pièces dont B est l'auteur du dernier contenu (aucune ici) iraient à C.
        await C.post('/ecritures/valider-jusqua', { exerciceId: ex.id, dateLimite: fin });
        await A.post('/ecritures/valider-jusqua', { exerciceId: ex.id, dateLimite: fin }).catch(() => {});
      }
    };
    await toutValider(ex26, '2026-12-31');
    const restant = await prisma.ecriture.count({ where: { tenantId, exerciceId: ex26.id, statut: 'BROUILLARD', estANouveauProvisoire: false } });
    verifier(restant === 0, `brouillard 2026 vide avant la clôture (${restant})`);

    // 6. Soldes 2026 contre le calcul à la main.
    const solde = async (compteId, exId) => {
      const s = await prisma.ligneEcriture.aggregate({ where: { compteId, ecriture: { tenantId, exerciceId: exId, statut: 'VALIDEE', estGenereeParCloture: false } }, _sum: { debit: true, credit: true } });
      return Number(s._sum.debit ?? 0) - Number(s._sum.credit ?? 0);
    };
    const reimputees = Number((await prisma.ligneEcriture.aggregate({ where: { compteId: cible.id, ecriture: { tenantId, exerciceId: ex26.id, statut: 'VALIDEE' } }, _sum: { debit: true } }))._sum.debit ?? 0);
    const chargeAttendue = 1199 * 1000 + 3 * 2000 + 8 * 60 * 500 - reimputees;
    const s6052 = await solde(charge.id, ex26.id);
    const s6053 = await solde(cible.id, ex26.id);
    const s521 = await solde(banque.id, ex26.id);
    verifier(Math.round(s6052) === chargeAttendue, `6052 · ${s6052} = 1 199 × 1 000 + 3 × 2 000 + 480 × 500 − ${reimputees} réimputés`);
    verifier(Math.round(s6052 + s6053) === 1199 * 1000 + 3 * 2000 + 480 * 500, `6052 + 6053 · ${s6052 + s6053} = 1 445 000`);
    verifier(Math.round(s521) === 50_000_000 - 1_445_000, `521 · ${s521} = 50 000 000 − 1 445 000`);

    // 7. Clôture de 2026.
    try {
      await A.post(`/exercices/${ex26.id}/cloturer`, {});
      verifier(true, 'clôture de 2026');
    } catch (e) {
      verifier(false, `clôture de 2026 · ${e.message}`);
      throw e;
    }
    const report = await prisma.ligneEcriture.aggregate({ where: { compteId: banque.id, ecriture: { tenantId, exerciceId: ex27.id } }, _sum: { debit: true, credit: true } });
    verifier(Number(report._sum.debit ?? 0) - Number(report._sum.credit ?? 0) === 50_000_000 - 1_445_000, `report 2027 du 521 · ${Number(report._sum.debit ?? 0) - Number(report._sum.credit ?? 0)}`);

    // 8. 2027 · mois chargé de 600 pièces (deux tranches), puis la course.
    for (let i = 0; i < 600; i++) await ecr(A, ex27, `2027-01-${String(1 + (i % 31)).padStart(2, '0')}`, `2027 ${i}`, deux(charge, banque, 100));
    etat = await B.get(`/ecritures/brouillard?exerciceId=${ex27.id}&dateFin=2027-01-31`);
    const avis27 = etat.lignes.filter((l) => l.empreinte);
    for (let i = 0; i < avis27.length; i += 200) await B.post('/circuit-visa/ecritures', { pieces: avis27.slice(i, i + 200).map((l) => ({ id: l.id, empreinte: l.empreinte })) });
    const v27 = await C.post('/ecritures/valider-jusqua', { exerciceId: ex27.id, dateLimite: '2027-01-31' });
    verifier(v27.validees === 600, `2027 · C valide janvier (${v27.validees}, à-nouveau ${etat.lignes.length - 600} autre(s) pièce(s) au brouillard)`);
    const issues27 = [];
    for (let t = 0; t < 6; t++) issues27.push(await course(ex27, '2027-03', t));
    console.log(`  issues des courses 2027 · ${issues27.join('')}`);
    await toutValider(ex27, '2027-12-31');
    // Les mouvements de 2027, hors à-nouveau (écriture de clôture), puis le solde avec lui.
    const s27 = await solde(banque.id, ex27.id);
    verifier(Math.round(s27) === -(600 * 100 + 6 * 60 * 500), `521, mouvements de 2027 · ${s27} = − 60 000 − 180 000`);
    verifier(Math.round(s27 + Number(report._sum.debit ?? 0) - Number(report._sum.credit ?? 0)) === 48_315_000, `521 fin 2027 · report 48 555 000 − 240 000 = 48 315 000`);
    const erreurs = journal.split('\n').filter((l) => /ERROR|Maillon d'audit NON/i.test(l));
    verifier(erreurs.length === 0, `journal du serveur sans erreur (${erreurs.length})${erreurs.length ? ' · ' + erreurs.slice(0, 3).join(' | ') : ''}`);
  } catch (e) {
    echecs.push(String(e.message));
    console.log('ARRÊT · ' + e.message);
    const lignes = journal.split('\n'); const i = lignes.findIndex((l) => /ERROR/.test(l)); console.log(i < 0 ? '(aucune ERROR au journal)' : lignes.slice(i, i + 30).join('\n'));
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
  }
  console.log(echecs.length === 0 ? 'TOUT EST PROUVÉ' : `${echecs.length} ÉCHEC(S)`);
  process.exit(echecs.length ? 1 : 0);
}
main();
