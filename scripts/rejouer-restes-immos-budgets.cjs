#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · ligne restes-immos-budgets.
 * Serveur COMPILÉ contre une base PostgreSQL jetable déjà migrée.
 *   DATABASE_URL=postgresql://... node scripts/rejouer-restes-immos-budgets.cjs
 *
 * POINTS=1,2,3,4 choisit les points rejoués (par défaut, tous).
 *
 * POINT 1 · REPORT DES BUDGETS PAR COMPTE.
 *   N = 2025 · charge A dotée 1 200 puis mars à 250 (l'année suit · 1 350),
 *   charge B dotée 600, produit doté 5 000 ; N+1 = 2026 · le produit déjà
 *   doté 4 000 ; la charge B mise en sommeil. 2025 clôturé, puis report.
 *   Attendu à la main · aperçu = A repris ; produit non repris (déjà doté) ;
 *   B non repris (sommeil). Après confirmation · A en 2026 = 1 350, mars 250,
 *   janvier 100 ; produit 2026 = 4 000, jamais 5 000. Un second report ne
 *   reprend rien (A déjà doté) et ne double aucune ligne.
 *
 * POINT 2 · QUANTITÉ DU BIEN SUR LA FICHE DE COMPTAGE.
 *   Lot de dix chaises (2025), doté, 2025 clôturé ; trois chaises sortent le
 *   30/06/2026. Campagne 2026 · la fiche du lot attend 7 unités (jamais 10) ;
 *   2,5 refusé ; non compté, aucun écart ; 6 comptées, manquant 1 ; 9
 *   comptées, excédent 2, ni bien ni écriture créés, le registre garde 7.
 *
 * POINT 3 · ANNULATION D'UNE SORTIE.
 *   2025 · ordinateur 300 000 (3 ans), imprimante 120 000 (3 ans, sortie le
 *   31/12/2025), lot de dix chaises 1 000 000 (5 ans) déprécié de 100 000 ;
 *   dotations, clôture. La sortie de l'imprimante ne s'annule plus (exercice
 *   clos). 2026 · l'ordinateur sort le 30/09 (complément 75 000, 812 125 000)
 *   · annulé au brouillard, puis repassé, validé, annulé en négatif · 812 et
 *   6813 nets à zéro, le bien se dote de 100 000. Trois chaises sortent le
 *   30/06 (complément 26 250, reprise 30 000 sur le lot) · annulé, le lot
 *   revient à 10 unités, 1 000 000, dépréciation 100 000. Repassé, validé,
 *   la dotation du lot (122 500) refuse l'annulation ; annulée, la sortie
 *   s'annule en trois négatifs et le lot entier se dote de 175 000.
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(URL_BASE)) { console.error('DATABASE_URL locale exigée'); process.exit(2); }
const PORT = 8099;
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-rejeu-2026!';
const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
const echecs = [];
const verifier = (c, m) => { if (!c) { echecs.push(m); console.log(`  ECHEC · ${m}`); } else console.log(`  ok · ${m}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const egal = (a, b) => a !== null && a !== undefined && Math.abs(Number(a) - Number(b)) < 0.005;
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
  del(c) { return this.appeler('DELETE', c).then((r) => r.corps); }
  statut(m, c, b) { return this.appeler(m, c, b, [200, 201, 400, 403, 404, 409]).then((r) => r); }
}

async function dossier(A, nom) {
  const email = `restes-${nom}-${Date.now()}@exemple.invalid`;
  await A.post('/auth/register', { nomEntite: `Rejeu ${nom} SARL`, referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
  await A.post('/auth/login', { email, motDePasse: MDP });
  const exercices = await A.get('/exercices');
  const e2026 = exercices.find((e) => e.dateDebut.startsWith('2026'));
  const e2025 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
  const plan = await A.get('/comptes?typeCompte=DETAIL');
  const premier = (prefixe) => plan.find((c) => c.numero.startsWith(prefixe) && c.typeCompte === 'DETAIL');
  return { e2025, e2026, plan, premier };
}

async function point1(A) {
  console.log('POINT 1 · report des budgets par compte');
  const { e2025, e2026, premier } = await dossier(A, 'budgets');
  const chargeA = premier('604');
  const chargeB = premier('605');
  const produit = premier('701');
  for (const c of [chargeA, chargeB, produit]) await A.patch(`/comptes/${c.id}`, { estRetenu: true });
  await A.post(`/analytique/comptes/${chargeA.id}/budget`, { exerciceId: e2025.id, montantAnnuel: 1200 });
  await A.patch(`/analytique/comptes/${chargeA.id}/budget`, { exerciceId: e2025.id, mois: 3, montant: 250 });
  await A.post(`/analytique/comptes/${chargeB.id}/budget`, { exerciceId: e2025.id, montantAnnuel: 600 });
  await A.post(`/analytique/comptes/${produit.id}/budget`, { exerciceId: e2025.id, montantAnnuel: 5000 });
  await A.post(`/analytique/comptes/${produit.id}/budget`, { exerciceId: e2026.id, montantAnnuel: 4000 });
  await A.patch(`/comptes/${chargeB.id}`, { estActif: false });

  let r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
  if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 800));
  const ex25 = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
  verifier(ex25.statut === 'CLOTURE', `2025 clôturé (${ex25.statut})`);

  const apercu = await A.get(`/analytique/budgets-comptes/report?exerciceId=${e2025.id}`);
  verifier(apercu.reporte === false && apercu.motifRefus === null, 'aperçu servi, rien écrit');
  verifier(apercu.repris.length === 1 && apercu.repris[0].compteId === chargeA.id && egal(apercu.repris[0].annuel, 1350), `repris · la charge A, 1 350 (lu ${JSON.stringify(apercu.repris.map((x) => [x.numero, x.annuel]))})`);
  const np = new Map(apercu.nonRepris.map((x) => [x.compteId, x.motif]));
  verifier(/jamais écrasé/.test(np.get(produit.id) ?? ''), `produit non repris · déjà doté (${np.get(produit.id)})`);
  verifier(/sommeil/.test(np.get(chargeB.id) ?? ''), `charge B non reprise · en sommeil (${np.get(chargeB.id)})`);
  verifier((await prisma.budgetCompte.count({ where: { exerciceId: e2026.id, compteId: chargeA.id } })) === 0, "l'aperçu n'a rien écrit");

  const fait = await A.post(`/analytique/budgets-comptes/report?exerciceId=${e2025.id}`, {});
  verifier(fait.reporte === true && fait.repris.length === 1, 'report confirmé · un compte');
  const bA = await A.get(`/analytique/comptes/${chargeA.id}/budget?exerciceId=${e2026.id}`);
  const mars = bA.mensuel.find((m) => m.mois === 3);
  const janv = bA.mensuel.find((m) => m.mois === 1);
  const somme = bA.mensuel.reduce((t, m) => t + Math.round(m.montant * 100), 0) / 100;
  verifier(egal(bA.annuel, 1350) && egal(mars?.montant, 250) && egal(janv?.montant, 100) && egal(somme, 1350), `A en 2026 · 1 350, mars 250, janvier 100, mois = année (lu ${bA.annuel}, ${mars?.montant}, ${janv?.montant}, ${somme})`);
  const bP = await A.get(`/analytique/comptes/${produit.id}/budget?exerciceId=${e2026.id}`);
  verifier(egal(bP.annuel, 4000), `produit 2026 · 4 000 gardé, jamais écrasé par 5 000 (lu ${bP.annuel})`);
  verifier((await prisma.budgetCompte.count({ where: { exerciceId: e2026.id, compteId: chargeB.id } })) === 0, 'la charge en sommeil n’est pas dotée');

  const avant = await prisma.budgetCompte.count({ where: { exerciceId: e2026.id } });
  const second = await A.post(`/analytique/budgets-comptes/report?exerciceId=${e2025.id}`, {});
  const apres = await prisma.budgetCompte.count({ where: { exerciceId: e2026.id } });
  verifier(second.repris.length === 0 && avant === apres, `second report · rien repris, aucune ligne doublée (${avant} → ${apres})`);
  r = await A.statut('POST', `/analytique/budgets-comptes/report?exerciceId=${e2026.id}`, {});
  verifier(r.statut === 400 && /exercice suivant n'existe pas/.test(JSON.stringify(r.corps)), `2026 sans exercice suivant · refus nommé (${r.statut})`);
}

/** Un dossier à biens · un lot de dix chaises acquis et mis en service le 01/01/2025 (1 000 000, cinq ans). */
async function dossierABiens(A, nom) {
  const d = await dossier(A, nom);
  const journaux = await A.get('/journaux');
  const od = journaux.find((j) => j.code === 'OD') ?? journaux[0];
  const compte = (num) => d.plan.find((c) => c.numero === num);
  for (const num of ['24410000', '48120000', '29440000', '69140000', '79140000']) await A.patch(`/comptes/${compte(num).id}`, { estRetenu: true });
  const nouveau = (designation, valeur, duree, extra = {}) =>
    A.post('/immobilisations', {
      compteImmobilisationId: compte('24410000').id, designation, dateAcquisition: '2025-01-01', dateMiseEnService: '2025-01-01',
      valeurOrigine: valeur, dureeAmortissementAns: duree, compteContrepartieId: compte('48120000').id, journalId: od.id, exerciceId: d.e2025.id, ...extra,
    });
  return { ...d, od, compte, nouveau };
}

async function cloturer2025(A, e2025) {
  await A.post('/ecritures/valider-jusqua', { exerciceId: e2025.id, dateLimite: '2025-12-31' });
  const r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
  if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 1500));
  const ex = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
  verifier(ex.statut === 'CLOTURE', `2025 clôturé (${ex.statut})`);
}

const SORTIE = { type: 'MISE_HORS_SERVICE', natureSortie: 'MISE_AU_REBUT', referencePieceSortie: 'PV-REBUT-01' };

async function point2(A) {
  console.log('POINT 2 · quantité du bien sur la fiche de comptage');
  const { e2025, e2026, od, nouveau } = await dossierABiens(A, 'quantite');
  const chaises = await nouveau('Chaises de la salle', 1_000_000, 5, { quantite: 10 });
  await A.post(`/immobilisations/${chaises.id}/dotation`, { exerciceId: e2025.id, journalId: od.id });
  await cloturer2025(A, e2025);
  await A.post(`/immobilisations/${chaises.id}/sortie-partielle`, {
    ...SORTIE, dateSortie: '2026-06-30', datePieceSortie: '2026-06-30', exerciceId: e2026.id, journalId: od.id, quantiteSortie: 3,
  });
  const campagne = await A.post('/inventaire', { exerciceId: e2026.id, dateInventaire: '2026-12-31', libelle: 'Inventaire 2026' });
  await A.post(`/inventaire/${campagne.id}/fiches/immobilisations`, {});
  const tenantId = (await prisma.campagneInventaire.findUnique({ where: { id: campagne.id }, select: { tenantId: true } })).tenantId;
  const fiches = await prisma.ficheInventaire.findMany({ where: { campagneId: campagne.id }, select: { id: true, immobilisationId: true, quantiteAttendue: true } });
  verifier(fiches.length === 1 && fiches[0].immobilisationId === chaises.id && fiches[0].quantiteAttendue === 7, `une fiche, le lot restant · 7 unités attendues, jamais 10 (lu ${JSON.stringify(fiches)})`);
  const fiche = fiches[0];
  let r = await A.statut('PATCH', `/inventaire/fiches/${fiche.id}`, { quantiteComptee: 2.5 });
  verifier(r.statut === 400 && /unités entières/.test(JSON.stringify(r.corps)), `une fraction d'unité refusée (${r.statut})`);
  let vue = await A.get(`/inventaire/${campagne.id}`);
  let e = vue.fiches[0].ecartUnites;
  verifier(e && e.attendue === 7 && e.comptee === null && e.ecart === null, `non compté · aucun écart, jamais un manquant de 7 (lu ${JSON.stringify(e)})`);
  await A.patch(`/inventaire/fiches/${fiche.id}`, { quantiteComptee: 6 });
  vue = await A.get(`/inventaire/${campagne.id}`);
  e = vue.fiches[0].ecartUnites;
  verifier(e.ecart === -1 && e.sens === 'MANQUANT', `six comptées · manquant d'une unité (lu ${JSON.stringify(e)})`);
  const biensAvant = await prisma.immobilisation.count({ where: { tenantId } });
  const ecrituresAvant = await prisma.ecriture.count({ where: { tenantId } });
  await A.patch(`/inventaire/fiches/${fiche.id}`, { quantiteComptee: 9 });
  vue = await A.get(`/inventaire/${campagne.id}`);
  e = vue.fiches[0].ecartUnites;
  verifier(e.ecart === 2 && e.sens === 'EXCEDENT' && /art\. 43/.test(e.mention), `neuf comptées · excédent de deux, art. 43 cité (lu ${JSON.stringify(e)})`);
  verifier((await prisma.immobilisation.count({ where: { tenantId } })) === biensAvant && (await prisma.ecriture.count({ where: { tenantId } })) === ecrituresAvant, "l'excédent ne crée ni bien ni écriture");
  const lot = await prisma.immobilisation.findUnique({ where: { id: chaises.id }, select: { quantite: true, valeurOrigine: true } });
  verifier(lot.quantite === 7 && egal(lot.valeurOrigine, 700_000), `le registre garde 7 chaises, 700 000 (lu ${lot.quantite}, ${lot.valeurOrigine})`);
  // Une fiche d'avant la règle · recopiée au geste suivant si elle n'est pas comptée, jamais si elle l'est.
  await prisma.ficheInventaire.update({ where: { id: fiche.id }, data: { quantiteAttendue: null } });
  const re = await A.post(`/inventaire/${campagne.id}/fiches/immobilisations`, {});
  verifier((await prisma.ficheInventaire.findUnique({ where: { id: fiche.id } })).quantiteAttendue === null && re.quantitesRecopiees === 0, `fiche déjà comptée · rien recopié après coup (${JSON.stringify(re)})`);
  await prisma.ficheInventaire.update({ where: { id: fiche.id }, data: { quantiteComptee: null } });
  await A.post(`/inventaire/${campagne.id}/fiches/immobilisations`, {});
  verifier((await prisma.ficheInventaire.findUnique({ where: { id: fiche.id } })).quantiteAttendue === 7, 'fiche non comptée d’avant la règle · la quantité recopiée');
}

/** Le solde (débit − crédit) d'une racine sur un exercice, hors écritures de clôture et de situation. */
async function solde(tenantId, racine, exerciceIds) {
  const lignes = await prisma.ligneEcriture.findMany({
    where: {
      compte: { tenantId, numero: { startsWith: racine } },
      ecriture: { tenantId, exerciceId: { in: exerciceIds }, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false, statut: { not: 'SITUATION' } },
    },
    select: { debit: true, credit: true },
  });
  return Math.round(lignes.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0) * 100) / 100;
}

async function point3(A) {
  console.log('POINT 3 · annulation d’une sortie, entière et partielle');
  const { e2025, e2026, od, nouveau, compte } = await dossierABiens(A, 'annulation');
  const pc = await nouveau('Ordinateur', 300_000, 3);
  const vieux = await nouveau('Imprimante', 120_000, 3);
  const chaises = await nouveau('Chaises de la salle', 1_000_000, 5, { quantite: 10 });
  const tenantId = (await prisma.immobilisation.findUnique({ where: { id: pc.id }, select: { tenantId: true } })).tenantId;
  for (const b of [pc, vieux, chaises]) await A.post(`/immobilisations/${b.id}/dotation`, { exerciceId: e2025.id, journalId: od.id });
  await A.post(`/immobilisations/${chaises.id}/depreciation`, {
    exerciceId: e2025.id, journalId: od.id, sens: 'DOTATION', montant: 100_000,
    compteDepreciationId: compte('29440000').id, compteContrepartieId: compte('69140000').id, indice: 'Usure constatée au comptage',
  });
  // L'imprimante sort en 2025, avant la clôture · sa sortie ne s'annule plus ensuite.
  await A.post(`/immobilisations/${vieux.id}/sortie`, { ...SORTIE, dateSortie: '2025-12-31', datePieceSortie: '2025-12-31', exerciceId: e2025.id, journalId: od.id });
  await cloturer2025(A, e2025);
  const deux = [e2025.id, e2026.id];
  let r = await A.statut('POST', `/immobilisations/${vieux.id}/annuler-sortie`, { motif: 'essai' });
  verifier(r.statut === 400 && /clôturé/.test(JSON.stringify(r.corps)), `sortie d'un exercice clôturé · refus nommé, art. 20 al. 3 (${r.statut})`);
  r = await A.statut('POST', `/immobilisations/${pc.id}/annuler-sortie`, { motif: 'essai' });
  verifier(r.statut === 400 && /pas sorti/.test(JSON.stringify(r.corps)), `bien en service · refus (${r.statut})`);

  console.log(' entière · au brouillard');
  const sortiePc = { ...SORTIE, dateSortie: '2026-09-30', datePieceSortie: '2026-09-30', exerciceId: e2026.id, journalId: od.id };
  await A.post(`/immobilisations/${pc.id}/sortie`, sortiePc);
  verifier(egal(await solde(tenantId, '812', [e2026.id]), 125_000) && egal(await solde(tenantId, '6813', [e2026.id]), 75_000), 'sortie passée · 812 = 125 000, complément 75 000');
  let ap = await A.get(`/immobilisations/${pc.id}/annulation-sortie`);
  verifier(ap.annulable && ap.ecritures.length === 2 && ap.ecritures.every((x) => x.traitement === 'SUPPRIMEE'), `aperçu · deux écritures du brouillard à retirer (lu ${JSON.stringify(ap.ecritures.map((x) => [x.role, x.traitement]))})`);
  r = await A.statut('POST', `/immobilisations/${pc.id}/annuler-sortie`, { motif: '' });
  verifier(r.statut === 400, `sans motif · refus (${r.statut})`);
  await A.post(`/immobilisations/${pc.id}/annuler-sortie`, { motif: 'Rebut saisi par erreur' });
  let fiche = await prisma.immobilisation.findUnique({ where: { id: pc.id }, include: { dotations: true } });
  verifier(fiche.statut === 'EN_SERVICE' && fiche.dateSortie === null && fiche.ecritureSortieId === null && fiche.dotations.length === 1, `fiche rendue · en service, sans date, une dotation (2025) (lu ${fiche.statut}, ${fiche.dotations.length})`);
  verifier(egal(await solde(tenantId, '812', [e2026.id]), 0) && egal(await solde(tenantId, '6813', [e2026.id]), 0) && egal(await solde(tenantId, '2441', deux), 1_300_000), '812 et 6813 de 2026 à zéro, 2441 = 1 300 000 (ordinateur et lot)');

  console.log(' entière · validée');
  await A.post(`/immobilisations/${pc.id}/sortie`, sortiePc);
  await A.post('/ecritures/valider-jusqua', { exerciceId: e2026.id, dateLimite: '2026-12-31' });
  ap = await A.get(`/immobilisations/${pc.id}/annulation-sortie`);
  verifier(ap.annulable && ap.ecritures.every((x) => x.traitement === 'INSCRITE_EN_NEGATIF'), 'aperçu · écritures validées, inscrites en négatif');
  const ann = await A.post(`/immobilisations/${pc.id}/annuler-sortie`, { motif: 'Sortie validée par erreur' });
  verifier(ann.ecritures.length === 2 && ann.ecritures.every((x) => x.negatif && x.negatif.numeroPiece !== null), 'deux négatifs numérotés');
  verifier(egal(await solde(tenantId, '812', [e2026.id]), 0) && egal(await solde(tenantId, '6813', [e2026.id]), 0) && egal(await solde(tenantId, '2844', deux), -300_000), `négatifs · 812 et 6813 nets à zéro, 2844 = 300 000 au crédit (dotations 2025 · 100 000 + 200 000) (lu ${await solde(tenantId, '2844', deux)})`);
  const historique = await prisma.annulationTraitementImmobilisation.groupBy({ by: ['traitement'], where: { tenantId, immobilisationId: pc.id, nature: 'SORTIE' }, _count: true });
  const parTraitement = Object.fromEntries(historique.map((h) => [h.traitement, h._count]));
  verifier(parTraitement.SUPPRIMEE === 2 && parTraitement.INSCRITE_EN_NEGATIF === 2, `historique · deux lignes par annulation (complément, sortie), retirées puis en négatif (lu ${JSON.stringify(parTraitement)})`);
  const dot26 = await A.post(`/immobilisations/${pc.id}/dotation`, { exerciceId: e2026.id, journalId: od.id });
  verifier(egal(dot26.montant, 100_000), `le bien rendu se dote de son annuité 2026 · 100 000 (lu ${dot26.montant})`);

  console.log(' partielle');
  const sortieLot = { ...SORTIE, dateSortie: '2026-06-30', datePieceSortie: '2026-06-30', exerciceId: e2026.id, journalId: od.id };
  let part = await A.post(`/immobilisations/${chaises.id}/sortie-partielle`, { ...sortieLot, quantiteSortie: 3 });
  verifier(egal(part.part.complement, 26_250) && egal(part.part.depreciation, 30_000), 'trois chaises sorties · complément 26 250, dépréciation 30 000');
  await A.post(`/immobilisations/${part.unites.id}/annuler-sortie`, { motif: 'Unités sorties par erreur' });
  let lot = await prisma.immobilisation.findUnique({ where: { id: chaises.id }, include: { depreciations: true } });
  const net = (d) => Math.round(d.reduce((t, x) => t + (x.sens === 'DOTATION' ? 1 : -1) * Number(x.montant), 0) * 100) / 100;
  verifier(lot.quantite === 10 && egal(lot.valeurOrigine, 1_000_000) && egal(lot.amortissementsDetaches, 0) && egal(net(lot.depreciations), 100_000), `lot rendu · 10 unités, 1 000 000, 0 détaché, dépréciation 100 000 (lu ${lot.quantite}, ${lot.valeurOrigine}, ${lot.amortissementsDetaches}, ${net(lot.depreciations)})`);
  verifier((await prisma.immobilisation.findUnique({ where: { id: part.unites.id } })) === null, 'la fiche des unités a disparu');
  verifier(egal(await solde(tenantId, '7914', [e2026.id]), 0) && egal(await solde(tenantId, '812', [e2026.id]), 0) && egal(await solde(tenantId, '2944', deux), -100_000), '7914 et 812 de 2026 à zéro, 2944 = 100 000 au crédit');

  console.log(' partielle validée, puis la dotation du lot qui l’a lue');
  part = await A.post(`/immobilisations/${chaises.id}/sortie-partielle`, { ...sortieLot, quantiteSortie: 3 });
  await A.post('/ecritures/valider-jusqua', { exerciceId: e2026.id, dateLimite: '2026-12-31' });
  const dotLot = await A.post(`/immobilisations/${chaises.id}/dotation`, { exerciceId: e2026.id, journalId: od.id });
  verifier(egal(dotLot.montant, 122_500), `dotation 2026 du lot réduit · 122 500 (lu ${dotLot.montant})`);
  r = await A.statut('POST', `/immobilisations/${part.unites.id}/annuler-sortie`, { motif: 'Unités sorties par erreur' });
  verifier(r.statut === 400 && /dotation/.test(JSON.stringify(r.corps)) && /Traitements/.test(JSON.stringify(r.corps)), `la dotation du lot a lu la sortie · refus nommé avec son issue (${r.statut} ${JSON.stringify(r.corps).slice(0, 260)})`);
  const tr = await A.get(`/immobilisations/${chaises.id}/traitements`);
  const dotation26 = tr.traitements.find((t) => t.nature === 'DOTATION' && t.exercice.id === e2026.id);
  await A.post('/immobilisations/traitements/annulation', { nature: 'DOTATION', acteId: dotation26.acteId, motif: 'Annulée avant la sortie' });
  const fin = await A.post(`/immobilisations/${part.unites.id}/annuler-sortie`, { motif: 'Unités sorties par erreur' });
  verifier(fin.ecritures.length === 3 && fin.ecritures.every((x) => x.negatif), `trois négatifs · complément, sortie, reprise sur le lot (lu ${JSON.stringify(fin.ecritures.map((x) => x.role))})`);
  lot = await prisma.immobilisation.findUnique({ where: { id: chaises.id }, include: { depreciations: true } });
  verifier(lot.quantite === 10 && egal(lot.valeurOrigine, 1_000_000) && egal(lot.amortissementsDetaches, 0) && egal(net(lot.depreciations), 100_000), 'lot rendu au centime après négatifs');
  verifier(egal(await solde(tenantId, '2441', deux), 1_300_000) && egal(await solde(tenantId, '2944', deux), -100_000) && egal(await solde(tenantId, '7914', [e2026.id]), 0), '2441 = 1 300 000 ; 2944 = 100 000 au crédit ; 7914 net à zéro');
  const dotLot2 = await A.post(`/immobilisations/${chaises.id}/dotation`, { exerciceId: e2026.id, journalId: od.id });
  verifier(egal(dotLot2.montant, 175_000), `le lot entier se dote de (1 000 000 − 200 000 − 100 000) / 4 = 175 000 (lu ${dotLot2.montant})`);
  verifier(egal(await solde(tenantId, '2844', deux), -775_000 + 200_000), `2844 = 300 000 (2025, imprimante soldée) + 100 000 (ordinateur 2026) + 175 000 (lot 2026) = 575 000 au crédit (lu ${await solde(tenantId, '2844', deux)})`);
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    let pret = false;
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) { pret = true; break; } } catch {} await attendre(1000); }
    if (!pret) throw new Error(`serveur non démarré\n${journal.slice(-3000)}`);
    const points = (process.env.POINTS || '1,2,3,4').split(',');
    if (points.includes('1')) await point1(new Client());
    if (points.includes('2')) await point2(new Client());
    if (points.includes('3')) await point3(new Client());
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
  }
  console.log(echecs.length === 0 ? '\nREJEU VERT' : `\nREJEU ROUGE · ${echecs.length} échec(s)`);
  process.exit(echecs.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
