#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · la ligne paie-suite, à travers la clôture de 2026.
 * Comptes individuels sous le 422 (76) · un bulletin passé au collectif avant
 * l'option, puis payé sur le collectif ; décembre passé sur les comptes des
 * salariés, 2026 clôturé, décembre payé en janvier 2027 sur ces comptes, les
 * soldes lus contre le calcul à la main. Rappel de salaire (87) porté par le
 * bulletin de janvier 2027. Visa d'un plan d'étalement par un second
 * utilisateur. Plafond de l'art. 41 (81). Organigramme, fiche individuelle
 * (89) relue après la clôture, import du personnel (82). Cloisonnement.
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
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 900)}`); e.statut = r.status; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
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
    const email = `paie-suite-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu Paie Suite SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await prisma.user.findFirst({ where: { email } })).tenantId;
    const ex26 = (await A.get('/exercices')).find((e) => e.dateDebut.startsWith('2026'));
    const ex27 = await A.post('/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    const journaux = await A.get('/journaux');
    const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux.find((j) => j.code === 'OD');
    const bq = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerie?.numero?.startsWith('52'));
    if (!od || !bq) throw new Error(`journaux OD et banque introuvables · ${journaux.map((j) => `${j.code}:${j.type}:${j.compteTresorerie?.numero}`).join(', ')}`);

    const B = new Client();
    const emailB = `paie-suite-b-${stamp}@exemple.invalid`;
    await A.post('/utilisateurs', { email: emailB, motDePasse: 'Provisoire-2026-xyz!', role: 'COMPTABLE' });
    await B.post('/auth/login', { email: emailB, motDePasse: 'Provisoire-2026-xyz!' });
    await B.post('/auth/changer-mot-de-passe', { motDePasseActuel: 'Provisoire-2026-xyz!', nouveauMotDePasse: MDP });
    await B.post('/auth/login', { email: emailB, motDePasse: MDP });

    const corps = (mois, extra = {}) => ({ moisDePaie: mois, elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780000 }], natureEmployeurInpp: 'PRIVE', effectif: 12, ...extra });
    const lignes422 = async (ecritureId) => {
      const l = await prisma.ligneEcriture.findMany({ where: { ecritureId, compte: { numero: { startsWith: '422' } } }, select: { debit: true, credit: true, compte: { select: { numero: true } } } });
      const m = {};
      for (const x of l) m[x.compte.numero] = (m[x.compte.numero] ?? 0) + centimes(x.credit) - centimes(x.debit);
      return m;
    };
    const solde = async (numero, exId) => {
      const s = await prisma.ligneEcriture.aggregate({ where: { compte: { tenantId, numero }, ecriture: { tenantId, exerciceId: exId, statut: { in: ['VALIDEE', 'BROUILLARD'] } } }, _sum: { debit: true, credit: true } });
      return centimes(s._sum.credit ?? 0) - centimes(s._sum.debit ?? 0);
    };

    console.log('1. Novembre 2026 · passé au collectif, avant l’option');
    const s2 = await A.post('/personnel/salaries', { nom: 'LUKUSA', prenoms: 'Marie', sexe: 'FEMININ', dateNaissance: '1991-09-02', matricule: 'M002' });
    verifier(!s2.compteId, 'option retirée · le salarié naît sans compte');
    await A.post(`/personnel/salaries/${s2.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01', periodiciteRemuneration: 'MOIS', remunerationBase: 780000, deviseRemuneration: 'CDF' });
    await A.post(`/personnel/salaries/${s2.id}/mode-paiement`, { modePaiement: 'CHEQUE' });
    const b2nov = await A.post(`/personnel/salaries/${s2.id}/bulletins`, corps('2026-11'));
    const pNov = await A.post('/personnel/paie-du-mois/2026-11/comptabilisation', { exerciceId: ex26.id, journalId: od.id, date: '2026-11-30' });
    const eNov = pNov.ecriture?.id ?? pNov.ecritureId ?? pNov.id;
    const nov = await lignes422(eNov);
    verifier(JSON.stringify(nov) === JSON.stringify({ '42200000': centimes(b2nov.netAPayerFc) }), `novembre au collectif, son net (${JSON.stringify(nov)}, net ${b2nov.netAPayerFc})`);

    console.log('2. L’option et les comptes');
    let r = await A.statut('POST', '/personnel/comptes-individuels');
    verifier(r.statut === 400 && /activez l'option/.test(JSON.stringify(r.corps)), `ouvrir sans l’option est refusé (${r.statut})`);
    await A.patch('/dossier/comptes-individuels-salaries', { comptesIndividuelsSalaries: true });
    await A.patch('/dossier/visa-plans-etalement', { visaPlansEtalement: true });
    const s1 = await A.post('/personnel/salaries', { nom: 'KASONGO', prenoms: 'Jean', sexe: 'MASCULIN', dateNaissance: '1985-04-12', matricule: 'M001' });
    const c1 = await prisma.compte.findFirst({ where: { tenantId, salarie: { id: s1.id } }, select: { numero: true, intitule: true, collectif: { select: { numero: true } } } });
    verifier(c1 && c1.numero === '42200001' && c1.collectif.numero === '42200000', `le salarié créé naît avec son compte (${c1?.numero} sous ${c1?.collectif?.numero}, « ${c1?.intitule} »)`);
    r = await B.statut('POST', '/personnel/comptes-individuels');
    verifier(r.statut === 403, `le comptable n’ouvre pas les comptes, geste de structure (${r.statut})`);
    const ouv = await A.post('/personnel/comptes-individuels');
    verifier(ouv.ouverts === 1 && ouv.restent === 0, `le registre par tranches · ${ouv.ouverts} ouvert, ${ouv.restent} restent`);
    const c2 = await prisma.compte.findFirst({ where: { tenantId, salarie: { id: s2.id } }, select: { id: true, numero: true } });
    verifier(c2?.numero === '42200002', `compte de LUKUSA ${c2?.numero}`);
    const etat = await A.get('/personnel/comptes-individuels');
    verifier(etat.option === true && etat.avecCompte === 2 && etat.sansCompte === 0, `état · ${JSON.stringify(etat)}`);

    console.log('3. Plafond de l’art. 41 (81)');
    // Entré en vigueur le 1er janvier 2025 · deux ans de date à date mènent au 1er janvier 2027 (règle du contrôle des contrats, P1), dans l'horizon.
    await A.post(`/personnel/salaries/${s1.id}/contrats`, { type: 'DUREE_DETERMINEE', dateEntreeEnVigueur: '2025-01-01', periodiciteRemuneration: 'MOIS', remunerationBase: 780000, deviseRemuneration: 'CDF' });
    await A.post(`/personnel/salaries/${s1.id}/mode-paiement`, { modePaiement: 'CHEQUE' });
    const ech = await A.get('/personnel/echeancier-contrats?horizon=90');
    const p41 = (ech.echeances ?? []).find((e) => e.objet === 'PLAFOND_ARTICLE_41');
    verifier(p41?.echeance === '2026-12-31' && p41.depassee === false, `le CDD sans terme montre le plafond de l’art. 41, de date à date (${p41?.echeance})`);

    console.log('4. Décembre 2026 · sur les comptes des salariés');
    const b1dec = await A.post(`/personnel/salaries/${s1.id}/bulletins`, corps('2026-12'));
    const b2dec = await A.post(`/personnel/salaries/${s2.id}/bulletins`, corps('2026-12'));
    const pDec = await A.post('/personnel/paie-du-mois/2026-12/comptabilisation', { exerciceId: ex26.id, journalId: od.id, date: '2026-12-31' });
    const eDec = pDec.ecriture?.id ?? pDec.ecritureId ?? pDec.id;
    const dec = await lignes422(eDec);
    verifier(dec['42200001'] === centimes(b1dec.netAPayerFc) && dec['42200002'] === centimes(b2dec.netAPayerFc) && !dec['42200000'], `décembre · chaque net sur son compte, rien au collectif (${JSON.stringify(dec)})`);
    const eq = await prisma.ligneEcriture.aggregate({ where: { ecritureId: eDec }, _sum: { debit: true, credit: true } });
    verifier(centimes(eq._sum.debit) === centimes(eq._sum.credit), 'la pièce de décembre s’équilibre');

    console.log('5. Novembre payé en décembre · sur le collectif, où son net a été inscrit');
    const pay = await A.post('/personnel/paiement-salaires/2026-11', { mode: 'CHEQUE', exerciceId: ex26.id, journalId: bq.id, date: '2026-12-20', bulletinIds: [b2nov.id], references: [{ bulletinId: b2nov.id, reference: 'CHQ 0001' }] });
    const ePay = (await prisma.paiementSalaires.findUnique({ where: { id: pay.id }, select: { ecritureId: true } })).ecritureId;
    const payNov = await lignes422(ePay);
    verifier(JSON.stringify(payNov) === JSON.stringify({ '42200000': -centimes(b2nov.netAPayerFc) }), `débit au collectif, jamais au compte ouvert depuis (${JSON.stringify(payNov)})`);
    verifier((await solde('42200000', ex26.id)) === 0, 'le collectif soldé en 2026');

    console.log('6. Clôture de 2026');
    for (let k = 0; k < 3; k++) await A.post('/ecritures/valider-jusqua', { exerciceId: ex26.id, dateLimite: '2026-12-31' });
    r = await A.statut('POST', `/exercices/${ex26.id}/cloturer`, {});
    if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 900));
    verifier((await prisma.exercice.findUnique({ where: { id: ex26.id } })).statut === 'CLOTURE', 'exercice 2026 clôturé');
    const an1 = await solde('42200001', ex27.id);
    const an2 = await solde('42200002', ex27.id);
    verifier(an1 === centimes(b1dec.netAPayerFc) && an2 === centimes(b2dec.netAPayerFc), `l’à-nouveau de 2027 porte chaque net dû sur son compte (${an1 / 100}, ${an2 / 100})`);

    console.log('7. Décembre payé en janvier 2027 · sur les comptes des salariés');
    const prop = await A.get('/personnel/paiement-salaires/2026-12');
    verifier(prop.confrontation422 && prop.confrontation422.avertissement === null, `le 422 confronté, lu sur toute la racine (${JSON.stringify(prop.confrontation422)})`);
    const payDec = await A.post('/personnel/paiement-salaires/2026-12', { mode: 'CHEQUE', exerciceId: ex27.id, journalId: bq.id, date: '2027-01-10', bulletinIds: [b1dec.id, b2dec.id], references: [{ bulletinId: b1dec.id, reference: 'CHQ 0002' }, { bulletinId: b2dec.id, reference: 'CHQ 0003' }] });
    const pd = await lignes422((await prisma.paiementSalaires.findUnique({ where: { id: payDec.id }, select: { ecritureId: true } })).ecritureId);
    verifier(pd['42200001'] === -centimes(b1dec.netAPayerFc) && pd['42200002'] === -centimes(b2dec.netAPayerFc) && !pd['42200000'], `une ligne de débit par compte (${JSON.stringify(pd)})`);
    verifier((await solde('42200001', ex27.id)) === 0 && (await solde('42200002', ex27.id)) === 0, 'les deux comptes soldés en 2027');

    console.log('8. Rappel de salaire (87), porté par janvier 2027');
    const rap = await A.post(`/personnel/salaries/${s1.id}/rappels`, { moisDebut: '2026-12', moisFin: '2026-12', nouvelleBase: 800000, periodicite: 'MOIS', deviseBase: 'CDF', motif: 'Avenant de novembre', pieceJustificative: 'Avenant n° 1' });
    const aPorter = await A.get(`/personnel/salaries/${s1.id}/rappels/a-payer/2027-01`);
    verifier(JSON.stringify(aPorter).includes(rap.id), 'le rappel est à porter en janvier 2027');
    const b1jan = await A.post(`/personnel/salaries/${s1.id}/bulletins`, corps('2027-01', { rappelsPortes: [{ rappelId: rap.id }] }));
    const elems = (b1jan.entree?.elements ?? []).filter((e) => /rappel/i.test(e.libelle ?? ''));
    const totalRappel = elems.reduce((x, e) => x + centimes(e.montantFc), 0);
    verifier(totalRappel === 2_000_000, `rappel de décembre · 20 000 au bulletin de janvier (${totalRappel / 100})`);
    const rapLu = await prisma.rappelSalaire.findUnique({ where: { id: rap.id }, select: { bulletinId: true } });
    verifier(rapLu.bulletinId === b1jan.id, 'le rappel est lié au bulletin qui le paie');
    const b2bis = await A.statut('POST', `/personnel/salaries/${s1.id}/bulletins`, corps('2026-12'));
    verifier(b2bis.statut === 400 || b2bis.statut === 409, `aucun second bulletin du mois passé (${b2bis.statut})`);
    // Relecture indépendante, BLOQUANT · le bulletin source d'un rappel non annulé ne s'annule pas.
    r = await A.statut('POST', `/personnel/bulletins/${b1dec.id}/annulation`, { motif: 'Réémis au nouveau contrat' });
    verifier(r.statut === 409 && /Avenant de novembre/.test(JSON.stringify(r.corps)) && /Annulez d'abord le bulletin qui paie le rappel/.test(JSON.stringify(r.corps)), `bulletin source d'un rappel · annulation refusée, rappel et issue nommés (${r.statut})`);
    verifier((await prisma.bulletinPaie.findUnique({ where: { id: b1dec.id } })).statut === 'EMIS', 'décembre reste émis');

    console.log('8 bis. Payé avant d’être passé, option retirée entre les deux (relecture, MAJEUR)');
    const b2jan = await A.post(`/personnel/salaries/${s2.id}/bulletins`, corps('2027-01'));
    const payJan = await A.post('/personnel/paiement-salaires/2027-01', { mode: 'CHEQUE', exerciceId: ex27.id, journalId: bq.id, date: '2027-01-25', bulletinIds: [b2jan.id], references: [{ bulletinId: b2jan.id, reference: 'CHQ 0004' }] });
    const pj = await lignes422((await prisma.paiementSalaires.findUnique({ where: { id: payJan.id }, select: { ecritureId: true } })).ecritureId);
    verifier(JSON.stringify(pj) === JSON.stringify({ '42200002': -centimes(b2jan.netAPayerFc) }), `payé sous l'option, sur son compte (${JSON.stringify(pj)})`);
    await A.patch('/dossier/comptes-individuels-salaries', { comptesIndividuelsSalaries: false });
    const pJan = await A.post('/personnel/paie-du-mois/2027-01/comptabilisation', { exerciceId: ex27.id, journalId: od.id, date: '2027-01-31' });
    const eJan = pJan.ecriture?.id ?? pJan.ecritureId ?? pJan.id;
    const jan = await lignes422(eJan);
    verifier(jan['42200002'] === centimes(b2jan.netAPayerFc) && jan['42200000'] === centimes(b1jan.netAPayerFc) && !jan['42200001'], `option retirée · LUKUSA passé sur le compte que son paiement a débité, KASONGO au collectif (${JSON.stringify(jan)})`);
    verifier((await solde('42200002', ex27.id)) === 0, 'le compte de LUKUSA soldé · aucun 422 de sens contraire');

    console.log('8 ter. Reprise en négatif d’une pièce commune, option retirée (relecture, MAJEUR)');
    await A.post('/ecritures/valider-jusqua', { exerciceId: ex27.id, dateLimite: '2027-01-31' });
    await A.post(`/personnel/bulletins/${b1jan.id}/annulation`, { motif: 'Rappel porté par erreur' });
    const prJan = await A.get('/personnel/paie-du-mois/2027-01');
    verifier((prJan.refus ?? []).length === 0, `la reprise se reconstitue malgré l'option retirée (${JSON.stringify(prJan.refus ?? []).slice(0, 300)})`);
    const pRep = await A.post('/personnel/paie-du-mois/2027-01/comptabilisation', { exerciceId: ex27.id, journalId: od.id, date: '2027-01-31', inscrireNegatifs: true });
    const rep = await lignes422(pRep.ecriture?.id ?? pRep.ecritureId ?? pRep.id);
    verifier(rep['42200000'] === -centimes(b1jan.netAPayerFc) && !rep['42200002'], `KASONGO repris au collectif où il a été passé, LUKUSA intact (${JSON.stringify(rep)})`);
    await A.patch('/dossier/comptes-individuels-salaries', { comptesIndividuelsSalaries: true });

    console.log('9. Visa du plan d’étalement');
    const av = await A.post(`/personnel/salaries/${s1.id}/avances`, { type: 'AVANCE', dateOctroi: '2027-01-15', montantFc: 100000, objet: 'Avance', pieceJustificative: 'Reçu 1', premierMoisRetenue: '2027-02', nombreEcheances: 2 });
    let sim = await A.post(`/personnel/simulation?salarieId=${s1.id}`, corps('2027-02'));
    verifier((sim.retenuesPlanifiees ?? []).length === 0 && /vis/i.test(JSON.stringify(sim.avertissementsRetenuesPlanifiees ?? [])), 'le plan non visé n’est pas proposé, et c’est dit');
    const avances = await B.get(`/personnel/avances?salarieId=${s1.id}`);
    const lue = (avances.avances ?? avances).find((x) => x.id === av.id);
    const saisiLeLu = lue.visaPlan?.saisiLe ?? lue.planSaisiLe ?? null;
    r = await A.statut('POST', `/personnel/avances/${av.id}/viser-plan`, { saisiLeLu });
    verifier(r.statut === 403, `l’auteur ne vise pas son plan (${r.statut})`);
    r = await B.statut('POST', `/personnel/avances/${av.id}/viser-plan`, { saisiLeLu });
    verifier(r.statut === 200 || r.statut === 201, `le second utilisateur vise (${r.statut} ${JSON.stringify(r.corps).slice(0, 200)})`);
    sim = await A.post(`/personnel/simulation?salarieId=${s1.id}`, corps('2027-02'));
    verifier((sim.retenuesPlanifiees ?? []).some((x) => centimes(x.montantFc) === 5_000_000), `visé, le plan propose 50 000 (${JSON.stringify(sim.retenuesPlanifiees)})`);

    console.log('10. Organigramme et fiche individuelle après la clôture');
    const u = await A.post('/personnel/organigramme', { code: 'DG', intitule: 'Direction générale', niveau: 'Direction' });
    await A.post(`/personnel/salaries/${s1.id}/rattachements`, { uniteId: u.id, dateEffet: '2026-01-01' });
    const org = await A.get('/personnel/organigramme');
    verifier(JSON.stringify(org).includes('Direction générale') && /"effectifAuJour":1\b/.test(JSON.stringify(org)), 'l’unité et son effectif au jour');
    const fiche = await A.get(`/personnel/salaries/${s1.id}/fiche-individuelle?annee=2026`);
    const brut = JSON.stringify(fiche);
    verifier(brut.includes(String(Number(b1dec.totalVerseFc ?? 780000))) || brut.includes('780000'), 'la fiche 2026 relue après la clôture porte le salaire de décembre');

    console.log('11. Import du personnel (82), sous l’option');
    const csv = Buffer.from('Matricule;Nom;Sexe\nM003;MBUYI;F\n', 'utf8').toString('base64');
    const simu = await A.post('/personnel/import/simulation', { nomFichier: 'p.csv', contenuBase64: csv });
    verifier(simu.aImporter === 1 && simu.refusees === 0, `simulation · ${simu.aImporter} à importer`);
    await A.post('/personnel/import', { nomFichier: 'p.csv', contenuBase64: csv });
    const s3 = await prisma.salarie.findFirst({ where: { tenantId, matricule: 'M003' }, select: { compte: { select: { numero: true } } } });
    verifier(s3?.compte?.numero === '42200003', `le salarié importé naît avec son compte (${s3?.compte?.numero})`);

    console.log('12. Cloisonnement');
    const V = new Client();
    const emailV = `paie-suite-v-${stamp}@exemple.invalid`;
    await V.post('/auth/register', { nomEntite: 'Voisin', referentiel: 'SYCEBNL', email: emailV, motDePasse: MDP });
    await V.post('/auth/login', { email: emailV, motDePasse: MDP });
    const ev = await V.get('/personnel/comptes-individuels');
    verifier(ev.option === false && ev.avecCompte === 0, 'le voisin ne voit aucun compte du dossier');
    r = await V.statut('GET', `/personnel/salaries/${s1.id}/fiche-individuelle?annee=2026`);
    verifier(r.statut === 404, `la fiche d’un salarié d’un autre dossier est inexistante (${r.statut})`);
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
    if (/Maillon d'audit NON écrit/.test(journal)) { echecs.push('maillon d’audit non écrit au journal du serveur'); }
  }
  console.log(echecs.length ? `\n${echecs.length} ÉCHEC(S)` : '\nTOUT EST VERT');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
