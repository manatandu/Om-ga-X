#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DES RELEVÉS DU PAQUET 1 (lignes A, B et C, second
 * tour) À TRAVERS UNE CLÔTURE (CLAUDE.md § 10). Serveur COMPILÉ contre une
 * base PostgreSQL JETABLE déjà migrée, dossier SYSCOHADA ·
 *  · B7 · 2024 gardé (vide), 2025 ouvert par un bilan d'ouverture IMPORTÉ
 *    (F0, 1 000 000 au 4111), F1 de mars 2025 ; 2024 puis 2025 clôturés ;
 *    en 2026 les deux reports lettrés à la main avec un règlement de
 *    1 000 000 · le groupe se lit par l'imputation légale, aucun « à-nouveau
 *    sans pièce d'origine » ;
 *  · B, mineur 3 · caisse comptée le 20 décembre (995 000 contre 1 000 000),
 *    300 000 payés le 28 · la clôture de la campagne nomme 695 000 à porter
 *    sur la fiche, jamais 995 000 ;
 *  · B, voisin · campagne mixte · le rapprochement réclame la fiche de la
 *    caisse au PV à écart ;
 *  · C, R3 · un compte d'un AUTRE dossier, au lettrage, à la fiche
 *    d'inventaire et aux comptes d'un tiers · refusé, rien écrit.
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-releves-paquet1.cjs
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE || /neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('DATABASE_URL doit pointer une base JETABLE locale, déjà migrée.');
  process.exit(2);
}
const PORT = Number(process.env.PORT_REJEU || 8131);
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-rejeu-2025!';
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
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 600)}`); e.statut = r.status; e.corps = j; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b, a) { return this.appeler('PATCH', c, b, a).then((r) => r.corps); }
  put(c, b, a) { return this.appeler('PUT', c, b ?? {}, a).then((r) => r.corps); }
  async refus(m, c, b) { try { await this.appeler(m, c, b); return null; } catch (e) { return e; } }
}

async function dossier(nom) {
  const email = `rp1-${nom}-${Date.now()}@exemple.invalid`;
  const A = new Client();
  await A.post('/auth/register', { nomEntite: `Rejeu relevés ${nom} SARL`, referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
  await A.post('/auth/login', { email, motDePasse: MDP });
  const me = await A.get('/auth/me');
  return { A, tenantId: me.tenant?.id ?? me.tenantId };
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await attendre(1000); }
    const { A, tenantId } = await dossier('a');
    const exercices = await A.get('/exercices');
    const ex27 = exercices.find((e) => e.dateDebut.startsWith('2026'));
    const ex26 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
    const ex24 = await A.post('/exercices', { dateDebut: '2024-01-01', dateFin: '2024-12-31' });
    const comptes = await A.get('/comptes?typeCompte=DETAIL');
    const adopter = async (numero) => { const x = comptes.find((c) => c.numero === numero); if (!x) throw new Error(`compte ${numero}`); await A.patch(`/comptes/${x.id}`, { estRetenu: true }); return x; };
    const client = await adopter('41110000');
    const vente = await adopter('70110000');
    const caisse = comptes.find((c) => c.numero.startsWith('571')) ?? null;
    const capital = await adopter('10130000');
    await A.patch(`/comptes/${client.id}`, { modeReportANouveau: 'DETAIL' });
    const journaux = await A.get('/journaux');
    const vt = journaux.find((j) => j.type === 'VENTES');
    const od = journaux.find((j) => j.type === 'GENERAL');
    const ca = journaux.find((j) => j.type === 'TRESORERIE' && j.compte?.numero?.startsWith('57')) ?? journaux.find((j) => j.type === 'TRESORERIE' && /CA|caisse/i.test(`${j.code} ${j.libelle}`));
    const bq = journaux.find((j) => j.type === 'TRESORERIE' && j.id !== ca?.id);
    const piece = (ex, jr, date, libelle, lignes) => A.post('/ecritures', { exerciceId: ex.id, journalId: jr.id, date, libelle, lignes });

    // --- B7 · le bilan d'ouverture importé dans 2025, derrière 2024 gardé.
    const csv = 'Compte;Intitulé;Débit;Crédit\n41110000;Clients;1000000;0\n10130000;Capital;0;1000000\n';
    const contenuBase64 = Buffer.from(csv, 'utf8').toString('base64');
    const analyse = await A.post('/import/analyser', { type: 'BALANCE', nomFichier: 'ouverture.csv', contenuBase64 });
    const mapping = analyse.mappingPropose ?? analyse.mapping ?? analyse.correspondance;
    const imp = await A.post('/import/executer', { type: 'BALANCE', nomFichier: 'ouverture.csv', contenuBase64, mapping, exerciceId: ex26.id, journalId: od.id, dateOperation: '2025-01-01', bilanDOuverture: true, separateur: ';' });
    verifier(!!imp, 'B7 · bilan d’ouverture importé dans 2025');
    const f1 = await piece(ex26, vt, '2025-03-01', 'Facture FV-1', [{ compteId: client.id, debit: 1_000_000, credit: 0 }, { compteId: vente.id, debit: 0, credit: 1_000_000 }]);
    verifier(!!f1.id, 'B7 · F1 de mars 2025');

    // --- Caisse comptée avant la clôture (B, mineur 3) et campagne mixte.
    const caisseId = ca?.compteId ?? ca?.compte?.id ?? caisse?.id;
    const charge = await adopter('62410000').catch(() => adopter('63180000'));
    await piece(ex26, ca, '2025-01-02', 'Apport en caisse', [{ compteId: caisseId, debit: 1_000_000, credit: 0 }, { compteId: capital.id, debit: 0, credit: 1_000_000 }]);
    await piece(ex26, ca, '2025-12-28', 'Réparation payée en caisse', [{ compteId: charge.id, debit: 300_000, credit: 0 }, { compteId: caisseId, debit: 0, credit: 300_000 }]);
    await A.post('/ecritures/valider-jusqua', { exerciceId: ex26.id, dateLimite: '2025-12-31' });
    const camp = await A.post('/inventaire', { exerciceId: ex26.id, dateInventaire: '2025-12-20', libelle: 'Caisse au 20 décembre' });
    const sc = await A.post(`/inventaire/${camp.id}/sous-commissions`, { nom: 'Caisse' });
    await A.post(`/inventaire/sous-commissions/${sc.id}/membres`, { nom: 'Compteur', role: 'INVENTORIANT' });
    await A.post(`/inventaire/sous-commissions/${sc.id}/membres`, { nom: 'Témoin', role: 'TEMOIN' });
    const pv = await A.post(`/inventaire/${camp.id}/pv-caisse`, { compteId: caisseId, sousCommissionId: sc.id, dateComptage: '2025-12-20', modeComparaison: 'FRANCS', especesComptees: 995_000 });
    verifier(Number(pv.ecart) === -5_000 && Number(pv.soldeComptableFige) === 1_000_000, `B3 · PV figé · solde ${pv.soldeComptableFige}, écart ${pv.ecart}`);
    const refusClore = await A.refus('POST', `/inventaire/${camp.id}/clore`, {});
    const msg = refusClore?.corps?.message ?? '';
    verifier(/695\s?000,00/.test(msg.replace(/ | /g, ' ')) && !/portez sur sa fiche les espèces comptées/.test(msg), `B3 · la clôture nomme 695 000 à porter (${refusClore?.statut})`);
    // Campagne mixte · une fiche sur un autre compte, le rapprochement réclame celle de la caisse.
    const stock = await adopter('31110000');
    {
      const f = await A.post(`/inventaire/${camp.id}/fiches`, { compteId: stock.id, designation: 'Stock' });
      await A.patch(`/inventaire/fiches/${f.id}`, { valeurInventaire: 0 });
      const refusRap = await A.refus('POST', `/inventaire/${camp.id}/rapprocher`, {});
      verifier(refusRap?.statut === 400 && /créez la fiche de chaque caisse/.test(refusRap?.corps?.message ?? ''), `B voisin · rapprochement refusé, fiche de la caisse réclamée (${refusRap?.statut} · ${(refusRap?.corps?.message ?? '').slice(0, 90)})`);
    }

    // --- C, R3 · un compte d'un autre dossier.
    const { A: B } = await dossier('b');
    const comptesB = await B.get('/comptes?typeCompte=DETAIL');
    const etranger = comptesB.find((c) => c.numero === '41110000');
    const lignesAvant = await prisma.ligneEcriture.count({ where: { compteId: etranger.id } });
    const r3a = await A.refus('GET', `/comptes/${etranger.id}/lettrage`);
    const r3b = await A.refus('POST', `/comptes/${etranger.id}/lettrage`, { ligneIds: [] });
    const r3c = await A.refus('POST', `/inventaire/${camp.id}/fiches`, { compteId: etranger.id, designation: 'Étranger' });
    const tiers = await A.post('/tiers', { type: 'CLIENT', nom: 'Client R3' }).catch(() => null);
    const r3d = tiers ? await A.refus('PUT', `/tiers/${tiers.id}/comptes/${etranger.id}/principal`, {}) : { statut: 404 };
    const r3e = tiers ? await A.refus('DELETE', `/tiers/${tiers.id}/comptes/${etranger.id}`) : { statut: 404 };
    const ok = (e) => e && [400, 403, 404].includes(e.statut);
    verifier(ok(r3a) && ok(r3b) && ok(r3c) && ok(r3d) && ok(r3e), `R3 · compte d’un autre dossier refusé · lettrage ${r3a?.statut}/${r3b?.statut}, fiche ${r3c?.statut}, tiers ${r3d?.statut}/${r3e?.statut}`);
    verifier((await prisma.ligneEcriture.count({ where: { compteId: etranger.id } })) === lignesAvant && (await prisma.ficheInventaire.count({ where: { compteId: etranger.id } })) === 0, 'R3 · rien écrit sur le compte étranger');

    // --- Clôtures 2024 puis 2025 · la campagne se retire du chemin si elle bloque.
    await A.post(`/exercices/${ex24.id}/cloturer`, {});
    let c26 = await A.refus('POST', `/exercices/${ex26.id}/cloturer`, {});
    if (c26) console.log(`  (clôture 2025 · ${c26.statut} · ${(c26.corps?.message ?? '').slice(0, 200)})`);
    verifier(!c26, 'clôture 2025 passée');

    // --- B7 · en 2026, les deux reports et le règlement lettrés à la main.
    const reports = await prisma.ligneEcriture.findMany({ where: { compteId: client.id, ecriture: { exerciceId: ex27.id, tenantId } }, select: { id: true, debit: true } });
    verifier(reports.length === 2, `B7 · deux lignes reportées au détail en 2026 (${reports.length})`);
    const banque = await adopter('52110000');
    const reg = await piece(ex27, bq ?? od, '2026-02-01', 'Règlement client', [{ compteId: banque.id, debit: 1_000_000, credit: 0 }, { compteId: client.id, debit: 0, credit: 1_000_000 }]);
    await A.post('/ecritures/valider-jusqua', { exerciceId: ex27.id, dateLimite: '2026-12-31' });
    const ligneReg = await prisma.ligneEcriture.findFirst({ where: { ecritureId: reg.id, compteId: client.id }, select: { id: true } });
    await A.post(`/comptes/${client.id}/lettrage`, { ligneIds: [...reports.map((r) => r.id), ligneReg.id], autoriserPartiel: true });
    const agee = await A.get(`/ecritures/balance-agee?exerciceId=${ex27.id}&dateReference=2026-03-31&type=CLIENTS_41`);
    const lus = agee.groupesLusLigneALigne ?? { total: -1, groupes: [] };
    verifier(lus.total === 0, `B7 · aucun groupe lu ligne à ligne (${lus.total} · ${JSON.stringify(lus.groupes)})`);
    verifier(Math.abs(agee.totaux.net - 1_000_000) < 0.01, `B7 · le net client reste 1 000 000 (${agee.totaux.net})`);
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
    if (echecs.length) console.log(journal.split('\n').filter((l) => /error|Error|ERREUR/.test(l)).slice(-15).join('\n'));
  }
  console.log(echecs.length ? `PREUVE ROUGE · ${echecs.length} échec(s)` : 'PREUVE VERTE');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
