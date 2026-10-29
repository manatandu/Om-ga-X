#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DE LA LIGNE gl-saisie À TRAVERS UNE CLÔTURE
 * (CLAUDE.md § 10). Serveur COMPILÉ contre une base PostgreSQL JETABLE déjà
 * migrée, dossier SYSCOHADA ·
 *  · fonction 2 · l'échéance obligatoire refuse la facture sans échéance ;
 *  · fonction 13 · l'interrogation du compte lit le livre-journal, puis, en
 *    2027, l'à-nouveau de clôture ;
 *  · fonction 64 · la revue d'une écriture validée, le brouillard écarté, le
 *    filtre du journal ;
 *  · fonction 33 · une facture exclue de la relance, une autre décalée ·
 *    l'une et l'autre SUIVENT LE REPORT en 2027, par la pièce d'origine ;
 *  · fonction 34 · les échéances des tiers en 2027, l'exclusion n'y jouant
 *    pas (elle ne porte que sur le courrier).
 * Chaque solde lu contre le calcul à la main.
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-gl-saisie.cjs
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE || /neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('DATABASE_URL doit pointer une base JETABLE locale, déjà migrée.');
  process.exit(2);
}
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
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 500)}`); e.statut = r.status; e.corps = j; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b, a) { return this.appeler('PATCH', c, b, a).then((r) => r.corps); }
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await attendre(1000); }
    const email = `gls-${Date.now()}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu gl-saisie SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await A.get('/auth/me')).tenant?.id ?? (await A.get('/auth/me')).tenantId;
    const exercices = await A.get('/exercices');
    const ex26 = exercices.find((e) => e.dateDebut.startsWith('2026'));
    const ex27 = await A.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    const comptes = await A.get('/comptes?typeCompte=DETAIL');
    const adopter = async (racine) => { const x = comptes.find((c) => c.numero.startsWith(racine)); if (!x) throw new Error(`compte ${racine}`); await A.patch(`/comptes/${x.id}`, { estRetenu: true }); return x; };
    const client = await adopter('4111');
    const vente = await adopter('7011');
    const banque = await adopter('5211');
    const capital = await adopter('1013');
    const journaux = await A.get('/journaux');
    const vt = journaux.find((j) => j.type === 'VENTES');
    const od = journaux.find((j) => j.type === 'GENERAL');
    const piece = (ex, journal, date, libelle, lignes) => A.post('/ecritures', { exerciceId: ex.id, journalId: journal.id, date, libelle, lignes });

    // Fonction 2 · l'option ouverte, la facture sans échéance est refusée.
    await A.patch('/dossier/echeance-obligatoire', { echeanceObligatoireTiers: true });
    let refus = null;
    try { await piece(ex26, vt, '2026-03-01', 'F0 sans échéance', [{ compteId: client.id, debit: 10_000, credit: 0 }, { compteId: vente.id, debit: 0, credit: 10_000 }]); } catch (e) { refus = e; }
    verifier(refus?.statut === 400 && /échéance/.test(refus.message), `2 · facture sans échéance refusée en 400 (${refus?.statut})`);
    const f1 = await piece(ex26, vt, '2026-03-01', 'F1', [{ compteId: client.id, debit: 100_000, credit: 0, dateEcheance: '2026-03-31' }, { compteId: vente.id, debit: 0, credit: 100_000 }]);
    const f2 = await piece(ex26, vt, '2026-04-01', 'F2', [{ compteId: client.id, debit: 0 + 50_000, credit: 0, dateEcheance: '2026-04-30' }, { compteId: vente.id, debit: 0, credit: 50_000 }]);
    await piece(ex26, od, '2026-01-02', 'Apport', [{ compteId: banque.id, debit: 1_000_000, credit: 0 }, { compteId: capital.id, debit: 0, credit: 1_000_000 }]);
    verifier(!!f1.id && !!f2.id, '2 · les factures portant leur échéance passent');
    await A.patch('/dossier/echeance-obligatoire', { echeanceObligatoireTiers: false });

    // Un brouillard laissé pour la revue (fonction 64), retiré avant la clôture.
    const brouillon = await piece(ex26, od, '2026-05-02', 'Brouillon', [{ compteId: banque.id, debit: 1, credit: 0 }, { compteId: capital.id, debit: 0, credit: 1 }]);
    const r64b = await A.post('/revues-ecritures', { ecritureIds: [f1.id, brouillon.id] });
    verifier(r64b.revues === 0 && r64b.ecartees.length === 2, `64 · tant qu'elles sont au brouillard, les pièces sont écartées (${r64b.ecartees.length})`);
    await A.appeler('DELETE', `/ecritures/${brouillon.id}`);
    await A.post('/ecritures/valider-jusqua', { exerciceId: ex26.id, dateLimite: '2026-12-31' });

    // Fonction 13 · l'interrogation lit le livre-journal.
    const i13 = await A.get(`/interrogation-compte/${client.id}?exerciceId=${ex26.id}`);
    verifier(i13.livreJournal.solde === 150_000 && i13.brouillard.solde === 0 && i13.nombreLignes === 2, `13 · 2026 · livre-journal ${i13.livreJournal.solde}, brouillard ${i13.brouillard.solde}, ${i13.nombreLignes} lignes`);

    // Fonction 64 · la revue d'une écriture validée, le filtre du journal.
    const r64 = await A.post('/revues-ecritures', { ecritureIds: [f1.id] });
    const revues = await A.get(`/ecritures?exerciceId=${ex26.id}&revue=oui`);
    const aRevoir = await A.get(`/ecritures?exerciceId=${ex26.id}&revue=non`);
    verifier(r64.revues === 1 && revues.total === 1 && revues.ecritures[0].revue?.auteur === email, `64 · F1 revue par ${revues.ecritures[0]?.revue?.auteur}, ${revues.total} revue`);
    verifier(aRevoir.total === 2, `64 · ${aRevoir.total} écritures à revoir (F2 et l'apport)`);

    // Fonction 33 · F2 exclue, F1 décalée au 30 juin.
    const lignes41 = await prisma.ligneEcriture.findMany({ where: { compteId: client.id, ecriture: { tenantId } }, select: { id: true, ecritureId: true } });
    const l1 = lignes41.find((l) => l.ecritureId === f1.id).id;
    const l2 = lignes41.find((l) => l.ecritureId === f2.id).id;
    let sansMotif = null;
    try { await A.patch(`/relances/lignes/${l2}/exclusion`, { exclue: true }); } catch (e) { sansMotif = e; }
    verifier(sansMotif?.statut === 400, '33 · exclusion sans motif refusée en 400');
    await A.patch(`/relances/lignes/${l2}/exclusion`, { exclue: true, motif: 'Facture contestée par le client' });
    await A.patch(`/relances/lignes/${l1}/echeance`, { echeanceAccordee: '2026-06-30', motif: 'Accord du 15 mars' });
    let mai = await A.get(`/relances?exerciceId=${ex26.id}&type=RAPPEL&dateReference=2026-05-15`);
    let p = mai.find((x) => x.compteId === client.id);
    verifier(p && p.montantDu === 0 && p.lignes.length === 0 && p.lignesExclues.length === 1, `33 · mai 2026 · F1 décalée hors rappel, F2 montrée exclue, dû ${p?.montantDu}`);
    const juillet = await A.get(`/relances?exerciceId=${ex26.id}&type=RAPPEL&dateReference=2026-07-15`);
    p = juillet.find((x) => x.compteId === client.id);
    verifier(p && p.montantDu === 100_000 && p.lignes[0].echeance === '2026-06-30' && p.retardMaxJours === 15, `33 · juillet 2026 · F1 rappelée depuis l'échéance accordée (${p?.lignes[0]?.echeance}, ${p?.retardMaxJours} j)`);

    // La clôture de 2026.
    await A.post(`/exercices/${ex26.id}/cloturer`, {});
    verifier(true, 'clôture de 2026');
    const reports = await prisma.ligneEcriture.findMany({ where: { compteId: client.id, ecriture: { tenantId, exerciceId: ex27.id } }, select: { debit: true, dateEcheance: true } });
    verifier(reports.length === 2, `report 2027 du 4111 au détail · ${reports.length} lignes (${reports.map((r) => Number(r.debit)).join(', ')})`);

    // Fonction 13 · en 2027, l'à-nouveau de clôture, validé.
    const i13b = await A.get(`/interrogation-compte/${client.id}?exerciceId=${ex27.id}`);
    verifier(i13b.livreJournal.solde === 150_000 && i13b.aNouveauProvisoire.solde === 0, `13 · 2027 · livre-journal ${i13b.livreJournal.solde} (à-nouveau), provisoire ${i13b.aNouveauProvisoire.solde}`);

    // Fonction 33 · les décisions suivent le report.
    const jan = await A.get(`/relances?exerciceId=${ex27.id}&type=RAPPEL&dateReference=2027-01-15`);
    p = jan.find((x) => x.compteId === client.id);
    verifier(p && p.montantDu === 100_000 && p.lignesExclues.length === 1 && p.lignesExclues[0].montant === 50_000, `33 · 2027 · F2 reste exclue après le report (${p?.lignesExclues?.length}), dû ${p?.montantDu}`);
    verifier(p && p.lignes[0]?.echeance === '2026-06-30', `33 · 2027 · F1 garde son échéance accordée (${p?.lignes[0]?.echeance})`);

    // Fonction 34 · les échéances des tiers ignorent l'exclusion · tout est échu.
    const e34 = await A.get(`/echeances-tiers?exerciceId=${ex27.id}`);
    verifier(e34.echu.nombre === 2 && e34.echu.aEncaisser === 150_000, `34 · 2027 · échu ${e34.echu.nombre} pour ${e34.echu.aEncaisser}`);

    // Fonction 64 · la revue de F1 reste attachée à sa pièce de 2026.
    const toujours = await prisma.revueEcriture.count({ where: { tenantId, ecritureId: f1.id } });
    verifier(toujours === 1, '64 · la revue de F1 traverse la clôture');
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
