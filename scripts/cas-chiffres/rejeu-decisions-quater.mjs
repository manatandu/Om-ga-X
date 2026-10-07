#!/usr/bin/env node
/**
 * REJEU DES DÉCISIONS PAR LA LOI DU 2026-10-07, QUATRIÈME LOT ·
 * docs/decisions-par-la-loi-2026-10-07-quater.md et les seize constats de
 * docs/dissolution-a-reprendre.md.
 *
 * Sur une VRAIE base jetable, par l'API du serveur compilé (CLAUDE.md § 10,
 * « aucune ligne n'est intégrée sans un scénario sur vraie base qui traverse
 * une clôture »).
 *  R1 · SARL dissoute le 15 mai 2025, liquidation sur deux années civiles,
 *       close le 10 septembre 2026 · arrêt de l'exercice (écritures qui
 *       suivent leur date, numéros inchangés), annulation puis nouvel arrêt,
 *       fin de liquidation reportée, clôture de l'exercice arrêté (report dans
 *       la liquidation), puis de l'exercice de liquidation à la clôture
 *       déclarée ; deux cotisations (impôt totalisé), échéancier, planning
 *       (art. 232 et 233 à chaque 31 décembre avant la clôture) ;
 *  R2 · coopérative dissoute · AUSCOOP art. 196, cotisations dues ;
 *  R3 · réévaluation de clôture avec un 54 en devise · le 54 reste inchangé,
 *       nommé hors réévaluation, la créance en devise se réévalue ;
 *  R4 · bien en cours déprécié, mis en service l'exercice suivant · la
 *       phrase de la NOTE 28 (SYSCOHADA) et de la note 5F (SYCEBNL) ;
 *  R1 bis · le doublement de la dotation (relecture du 2026-10-07, bloquant
 *       1) · dotations 2026 de 1 200 000 passées au 31/12, l'une validée,
 *       l'autre au brouillard, dissolution du 30/06 déclarée ensuite ·
 *       l'arrêt les nomme et refuse, puis les retire à la demande, la
 *       dotation de l'exercice arrêté passe au prorata (600 000), celle de
 *       la liquidation de même, à travers la clôture de l'exercice arrêté ;
 *  R5 · dissolution sans liquidation (associé unique personne morale,
 *       majeur 2) · l'exercice suivant occupé est nommé, vide il est retiré,
 *       et la clôture de l'exercice arrêté ne crée aucun exercice.
 *
 * Ce script ne corrige rien · il relève, et chaque attendu calculé à la main
 * est confronté à ce qu'OmegaX rend (« OK » ou « ÉCART »).
 *
 *   OMEGAX_API=http://localhost:8147 node scripts/cas-chiffres/rejeu-decisions-quater.mjs [sortie.json]
 */
import { writeFileSync } from 'node:fs';

const BASE = process.env.OMEGAX_API ?? 'http://localhost:8147';
const MOT_DE_PASSE = 'MotDePasse-quater-2026!';
let compteurAdresse = 1;
const constats = [];

function constater(cas, quoi, attendu, obtenu) {
  const ok = JSON.stringify(attendu) === JSON.stringify(obtenu);
  constats.push({ cas, quoi, attendu, obtenu, ok });
  console.log(`${ok ? 'OK    ' : 'ÉCART '} ${cas} · ${quoi} · attendu ${JSON.stringify(attendu)} · obtenu ${JSON.stringify(obtenu)}`);
}

class Client {
  constructor() {
    const n = (Date.now() + compteurAdresse++ * 7919) % 16_777_216;
    this.adresse = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
    this.cookie = '';
    this.csrf = '';
  }

  entetes(methode, avecCorps) {
    return {
      'X-Forwarded-For': this.adresse,
      ...(avecCorps ? { 'Content-Type': 'application/json' } : {}),
      ...(this.cookie ? { Cookie: this.cookie } : {}),
      ...(this.csrf && methode !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
    };
  }

  async req(methode, chemin, corps) {
    const r = await fetch(BASE + chemin, {
      method: methode,
      headers: this.entetes(methode, corps !== undefined),
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const kv = c.split(';')[0];
      if (kv.startsWith('__session=')) this.cookie = kv;
    }
    const texte = await r.text();
    let json;
    try {
      json = texte ? JSON.parse(texte) : undefined;
    } catch {
      json = texte;
    }
    if (json && typeof json.csrfToken === 'string') this.csrf = json.csrfToken;
    return { statut: r.status, corps: json };
  }

  async ok(methode, chemin, corps) {
    const r = await this.req(methode, chemin, corps);
    if (r.statut >= 400) throw new Error(`${methode} ${chemin} · ${r.statut} · ${JSON.stringify(r.corps).slice(0, 700)}`);
    return r.corps;
  }

  /** Un refus attendu · rend son statut et son motif. */
  async refus(methode, chemin, corps) {
    const r = await this.req(methode, chemin, corps);
    return { statut: r.statut, message: r.corps?.message ?? r.corps };
  }
}

async function dossier(nom, { referentiel = 'SYSCOHADA', forme, exercice, jeu } = {}) {
  const c = new Client();
  await c.ok('POST', '/auth/register', {
    nomEntite: nom,
    referentiel,
    ...(referentiel === 'SYSCOHADA' ? { systemeComptableSyscohada: 'NORMAL' } : { jeuEtatsFinanciersSycebnl: jeu ?? 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' }),
    email: `quater-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.cd`,
    motDePasse: MOT_DE_PASSE,
    ...(exercice ? { dateDebutExercice: exercice[0], dateFinExercice: exercice[1] } : {}),
  });
  if (forme) await c.ok('PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: forme });
  const comptes = await c.ok('GET', '/comptes?typeCompte=DETAIL');
  c.comptes = new Map(comptes.map((x) => [x.numero, x.id]));
  const journaux = await c.ok('GET', '/journaux');
  c.od = journaux.find((j) => j.code === 'OD') ?? journaux.find((j) => j.type === 'GENERAL');
  await relireExercices(c);
  return c;
}

async function relireExercices(c) {
  const exercices = await c.ok('GET', '/exercices');
  c.exercices = new Map(exercices.map((e) => [e.dateDebut.slice(0, 10), e]));
  c.listeExercices = exercices;
  return exercices;
}

const compte = (c, numero) => {
  const id = c.comptes.get(numero);
  if (!id) throw new Error(`Compte ${numero} absent du plan semé`);
  return id;
};

async function ecriture(c, exerciceId, date, libelle, lignes) {
  const e = await c.ok('POST', '/ecritures', {
    exerciceId,
    journalId: c.od.id,
    date,
    libelle,
    lignes: lignes.map(([numero, debit, credit, devise]) => ({
      compteId: compte(c, numero),
      libelle,
      debit,
      credit,
      ...(devise ? devise : {}),
    })),
  });
  return e;
}

const valider = (c, exerciceId, dateLimite) => c.ok('POST', '/ecritures/valider-jusqua', { exerciceId, dateLimite });
const planning = (c, exerciceId) => c.ok('GET', `/exercices/${exerciceId}/planning-cloture`);
const jour = (iso) => (iso ? String(iso).slice(0, 10) : null);
const centimes = (x) => Math.round(Number(x) * 100) / 100;

/** Une ligne de balance · mouvements et report, débit moins crédit. */
async function ligneBalance(c, exerciceId, numero) {
  const b = await c.ok('GET', `/ecritures/balance?exerciceId=${exerciceId}`);
  const lignes = Array.isArray(b) ? b : (b.lignes ?? []);
  const l = lignes.find((x) => x.numero === numero);
  if (!l) return { report: 0, mouvement: 0, solde: 0 };
  const report = centimes(Number(l.reportDebit ?? 0) - Number(l.reportCredit ?? 0));
  const mouvement = centimes(Number(l.mouvementDebit ?? 0) - Number(l.mouvementCredit ?? 0));
  return { report, mouvement, solde: centimes(report + mouvement) };
}

async function ecrituresDe(c, exerciceId) {
  const r = await c.ok('GET', `/ecritures?exerciceId=${exerciceId}`);
  return Array.isArray(r) ? r : (r.ecritures ?? r.lignes ?? r.donnees ?? []);
}

// --- R1 · SARL dissoute, liquidation sur deux ans -----------------------------
async function r1() {
  const cas = 'R1';
  const c = await dossier('Rejeu quater SARL dissoute', { forme: 'SOCIETE_RESPONSABILITE_LIMITEE', exercice: ['2025-01-01', '2025-12-31'] });
  const n = c.exercices.get('2025-01-01').id;
  // Période d'activité · CA 20 000 000, charges 10 000 000 (bénéfice 10 000 000).
  const vente = await ecriture(c, n, '2025-03-31', "Chiffre d'affaires", [['52110000', 20_000_000, 0], ['70110000', 0, 20_000_000]]);
  await ecriture(c, n, '2025-03-31', 'Achats', [['60410000', 10_000_000, 0], ['52110000', 0, 10_000_000]]);
  // Après la dissolution · CA 5 000 000, charges 2 000 000, acompte d'IS 300 000.
  const venteApres = await ecriture(c, n, '2025-07-15', "Chiffre d'affaires de liquidation", [['52110000', 5_000_000, 0], ['70110000', 0, 5_000_000]]);
  await ecriture(c, n, '2025-07-15', 'Charges de liquidation', [['60410000', 2_000_000, 0], ['52110000', 0, 2_000_000]]);
  await ecriture(c, n, '2025-07-25', "Acompte d'impôt sur les sociétés", [['44920000', 300_000, 0], ['52110000', 0, 300_000]]);
  await valider(c, n, '2025-12-31');

  // Avant toute dissolution, l'arrêt est refusé et le motif le dit.
  const sans = await c.refus('POST', `/exercices/${n}/arreter-a-la-dissolution`, {});
  constater(cas, 'arrêt sans dissolution déclarée · refusé', 400, sans.statut);

  await c.ok('PATCH', '/dossier/identite', {
    dateDissolution: '2025-05-15',
    liquidateurs: 'M. Liquidateur',
    dateNominationLiquidateur: '2025-05-15',
    regimeLiquidation: 'ARTICLE_223_1',
    associeUniquePersonneMorale: 'NON',
  });
  let p = await planning(c, n);
  constater(cas, 'arrêt proposé, aucun motif de refus (constat 15)', [true, null], [p.dissolution?.arretPropose, p.dissolution?.motifArret ?? null]);
  // Un exercice tout entier non arrêté · la totalisation ne se calcule pas, et c'est dit.
  let fiscal = await c.ok('GET', `/fiscalite/resultat-fiscal?exerciceId=${n}`);
  constater(cas, 'exercice non arrêté · cotisations non séparées', 'NON_CALCULEE', fiscal.bilansSuccessifs?.role);

  // ARRÊT · l'exercice de liquidation naît du 16 mai 2025, les écritures
  // datées après la dissolution le suivent, numéro et date inchangés.
  await c.ok('POST', `/exercices/${n}/arreter-a-la-dissolution`, {});
  await relireExercices(c);
  constater(cas, 'exercice arrêté au 15 mai 2025', '2025-05-15', jour(c.exercices.get('2025-01-01').dateFin));
  let l = c.exercices.get('2025-05-16');
  constater(cas, 'exercice de liquidation du 16 mai au 31 décembre 2025', ['2025-05-16', '2025-12-31'], [jour(l?.dateDebut), jour(l?.dateFin)]);
  constater(cas, 'N · CA 20 000 000 seul', -20_000_000, (await ligneBalance(c, n, '70110000')).mouvement);
  constater(cas, 'liquidation · CA 5 000 000 suivi', -5_000_000, (await ligneBalance(c, l.id, '70110000')).mouvement);
  const suivie = (await ecrituresDe(c, l.id)).find((e) => e.id === venteApres.id);
  constater(cas, 'écriture suivie · date, numéro et statut inchangés', [jour(venteApres.date), venteApres.numeroPiece ?? null, 'VALIDEE'], [jour(suivie?.date), suivie?.numeroPiece ?? null, suivie?.statut]);

  // ANNULATION puis nouvel arrêt (constat 2) · tout revient, puis repart.
  await c.ok('POST', `/exercices/${n}/annuler-arret-dissolution`, {});
  await relireExercices(c);
  constater(cas, 'annulation · fin d’origine, exercice de liquidation retiré', ['2025-12-31', false], [jour(c.exercices.get('2025-01-01').dateFin), c.exercices.has('2025-05-16')]);
  constater(cas, 'annulation · CA 25 000 000 revenu dans N', -25_000_000, (await ligneBalance(c, n, '70110000')).mouvement);
  // Le 10 mai · avant la nomination du 15 mai (un liquidateur nommé avant la
  // dissolution serait refusé, AUSCGIE art. 204).
  const changer = await c.refus('PATCH', '/dossier/identite', { dateDissolution: '2025-05-10' });
  constater(cas, 'dissolution modifiable une fois l’arrêt annulé', [200, null], [changer.statut, changer.statut >= 400 ? changer.message : null]);
  await c.ok('PATCH', '/dossier/identite', { dateDissolution: '2025-05-15' });
  await c.ok('POST', `/exercices/${n}/arreter-a-la-dissolution`, {});
  await relireExercices(c);
  l = c.exercices.get('2025-05-16');
  const verrou = await c.refus('PATCH', '/dossier/identite', { dateDissolution: '2025-06-30' });
  constater(cas, 'dissolution qui borne un exercice · refusée avec l’issue (constat 2)', [400, true], [verrou.statut, String(verrou.message).includes('Annuler l')]);
  const civil = await c.refus('POST', '/exercices', { dateDebut: '2026-01-01', dateFin: '2026-12-31' });
  constater(cas, 'exercice civil après la dissolution · refusé (constats 3 et 6)', 400, civil.statut);

  // La liquidation dure jusqu'au 10 septembre 2026 · sa fin se reporte.
  await c.ok('POST', `/exercices/${l.id}/fin-de-liquidation`, { dateFin: '2026-09-10' });
  await ecriture(c, l.id, '2026-03-02', "Chiffre d'affaires de liquidation 2026", [['52110000', 1_000_000, 0], ['70110000', 0, 1_000_000]]);
  await ecriture(c, l.id, '2026-03-02', 'Charges de liquidation 2026', [['60410000', 500_000, 0], ['52110000', 0, 500_000]]);
  await valider(c, l.id, '2026-09-10');
  await c.ok('PATCH', `/fiscalite/exercices/${l.id}/dossier`, { acomptesVerses: 300_000 });

  // PLANNING · art. 232 et 233 au 31 décembre 2025 seulement (point 6).
  p = await planning(c, l.id);
  const etats = p.jalons.filter((j) => j.libelle === 'États financiers annuels et rapport écrit du liquidateur');
  constater(cas, 'états annuels · au 31/12/2025 seulement, dus le 31/03/2026', ['2026-03-31'], etats.map((j) => jour(j.echeance)));

  // CLÔTURE DE L'EXERCICE ARRÊTÉ · son report s'ouvre dans la liquidation.
  await c.ok('POST', `/exercices/${n}/cloturer`, {});
  await relireExercices(c);
  // Banque · 20 000 000 - 10 000 000 = 10 000 000 reportés ; liquidation
  // 5 000 000 - 2 000 000 - 300 000 + 1 000 000 - 500 000 = 3 200 000.
  const banque = await ligneBalance(c, l.id, '52110000');
  constater(cas, 'liquidation · banque, report 10 000 000 et mouvements 3 200 000', [10_000_000, 3_200_000], [banque.report, banque.mouvement]);

  // FISCAL · une assiette, deux cotisations (point 2).
  // N · 10 000 000 × 30 % = 3 000 000 (minimum 1 % de 20 000 000 = 200 000).
  fiscal = await c.ok('GET', `/fiscalite/resultat-fiscal?exerciceId=${n}`);
  constater(cas, 'N · première cotisation 3 000 000', ['PREMIERE_COTISATION', 3_000_000], [fiscal.bilansSuccessifs?.role, fiscal.impotDu]);
  // Liquidation · 3 000 000 + 500 000 = 3 500 000 ; total 13 500 000 × 30 %
  // = 4 050 000 ; minimum 1 % de 26 000 000 = 260 000 ; réglé 3 000 000 +
  // 300 000 = 3 300 000 ; seconde 750 000.
  fiscal = await c.ok('GET', `/fiscalite/resultat-fiscal?exerciceId=${l.id}`);
  const t = fiscal.bilansSuccessifs?.totalisation;
  constater(
    cas,
    'liquidation · total 13 500 000, impôt 4 050 000, réglé 3 300 000, seconde 750 000',
    [13_500_000, 4_050_000, 3_300_000, 750_000, 0],
    [t?.total, t?.impotTotal, t?.dejaRegle, t?.secondeCotisation, t?.excedent],
  );
  constater(cas, 'aucune base d’acomptes pour l’année qui suit (point 3)', [null, 0], [fiscal.baseAcomptes, fiscal.acomptesProchainExercice?.length]);

  // ÉCHÉANCIER · au 1er juin 2025, puis au 15 janvier 2026 (points 3 à 5).
  await c.ok('PATCH', '/dossier/identite', { dateClotureLiquidation: '2026-09-10' });
  let ech = await c.ok('GET', `/retenues/echeancier?exerciceId=${n}&dateReference=2025-06-01`);
  let cles = new Map(ech.echeances.map((e) => [e.cle, e]));
  // 15 mai + un mois = 15 juin 2025, un dimanche · lundi 16 juin.
  constater(cas, 'cotisation (activité) · 16/06/2025', '2025-06-16', jour(cles.get('cotisationSpecialeActivite')?.date));
  constater(cas, 'pas de déclaration annuelle des revenus 2025', false, cles.has('declarationImpotSocietes'));
  constater(cas, 'acomptes de 2025 dus avant la dernière cotisation', [true, true, true], ['premierAcompteIs', 'deuxiemeAcompteIs', 'troisiemeAcompteIs'].map((k) => cles.has(k)));
  ech = await c.ok('GET', `/retenues/echeancier?exerciceId=${l.id}&dateReference=2026-01-15`);
  cles = new Map(ech.echeances.map((e) => [e.cle, e]));
  // 10 septembre 2026 + un mois = 10 octobre, un samedi · lundi 12 octobre.
  constater(cas, 'cotisation (liquidation) · 12/10/2026', '2026-10-12', jour(cles.get('cotisationSpecialeLiquidation')?.date));
  constater(cas, 'aucun acompte de 2026, aucune déclaration annuelle', [false, false], [cles.has('premierAcompteIs'), cles.has('declarationImpotSocietes')]);

  // CLÔTURE DE LA LIQUIDATION · à la clôture déclarée, sans exercice suivant (constats 6 et 7).
  const clos = await c.ok('POST', `/exercices/${l.id}/cloturer`, {});
  await relireExercices(c);
  constater(cas, 'liquidation close, aucun exercice ouvert après', ['CLOTURE', 2], [c.exercices.get('2025-05-16')?.statut, c.listeExercices.length]);
  return { clos, totalisation: t, echeancier: ech.echeances.map((e) => [e.cle, jour(e.date)]) };
}

// --- R2 · coopérative dissoute -------------------------------------------------
async function r2() {
  const cas = 'R2';
  const c = await dossier('Rejeu quater coopérative', { forme: 'SOCIETE_COOPERATIVE', exercice: ['2025-01-01', '2025-12-31'] });
  const n = c.exercices.get('2025-01-01').id;
  await ecriture(c, n, '2025-02-28', 'Ventes', [['52110000', 4_000_000, 0], ['70110000', 0, 4_000_000]]);
  await valider(c, n, '2025-12-31');
  await c.ok('PATCH', '/dossier/identite', {
    dateDissolution: '2025-05-15',
    liquidateurs: 'Mme Liquidatrice',
    dateNominationLiquidateur: '2025-05-20',
    regimeLiquidation: 'ARTICLE_223_1',
  });
  await c.ok('POST', `/exercices/${n}/arreter-a-la-dissolution`, {});
  await relireExercices(c);
  const l = c.exercices.get('2025-05-16');
  constater(cas, 'exercice de liquidation créé', '2025-05-16', jour(l?.dateDebut));
  const p = await planning(c, l.id);
  const etats = p.jalons.find((j) => j.libelle === 'États financiers annuels et rapport écrit du liquidateur');
  constater(cas, 'états annuels servis par l’AUSCOOP, art. 196, sans sanction de l’AUSCGIE', [true, null], [etats?.source?.includes('AUSCOOP, art. 196'), etats?.sanction ?? null]);
  const ech = await c.ok('GET', `/retenues/echeancier?exerciceId=${n}&dateReference=2025-05-20`);
  const activite = ech.echeances.find((e) => e.cle === 'cotisationSpecialeActivite');
  constater(cas, 'cotisation due par la coopérative · 16/06/2025', '2025-06-16', jour(activite?.date));
  const pm = await c.refus('PATCH', '/dossier/identite', { associeUniquePersonneMorale: 'OUI' });
  constater(cas, 'associé unique personne morale refusé à la coopérative', 400, pm.statut);
  return { etats };
}

// --- R3 · réévaluation de clôture avec un 54 en devise -------------------------
async function r3() {
  const cas = 'R3';
  const c = await dossier('Rejeu quater compte 54', { forme: 'SOCIETE_ANONYME', exercice: ['2025-01-01', '2025-12-31'] });
  const n = c.exercices.get('2025-01-01').id;
  const devises = await c.ok('GET', '/devises');
  let usd = (Array.isArray(devises) ? devises : devises.devises ?? []).find((d) => d.code === 'USD');
  if (!usd) usd = await c.ok('POST', '/devises', { code: 'USD', intitule: 'Dollar des États-Unis' });
  await c.ok('POST', `/devises/${usd.id}/cours`, { date: '2025-03-01', cours: 2500 });
  await c.ok('POST', `/devises/${usd.id}/cours`, { date: '2025-12-31', cours: 2800 });
  // Une option de change de 1 000 USD au coût historique (2 500 000), et une
  // créance client de 1 000 USD (2 500 000).
  const enDevise = { deviseId: usd.id, montantDevise: 1000, coursApplique: 2500 };
  await ecriture(c, n, '2025-03-01', 'Option de change', [['54200000', 2_500_000, 0, enDevise], ['52110000', 0, 2_500_000]]);
  await ecriture(c, n, '2025-03-01', 'Vente en devise', [['41110000', 2_500_000, 0, enDevise], ['70110000', 0, 2_500_000]]);
  await valider(c, n, '2025-12-31');
  const calcul = await c.ok('POST', '/devises/reevaluation/calcul', { exerciceId: n, dateReevaluation: '2025-12-31' });
  const hors = (calcul.positionsNonReevaluees ?? []).find((x) => x.numero === '54200000');
  constater(cas, 'le 54 nommé hors réévaluation, avec son motif', true, !!hors && hors.motif.includes('Titre VII, compte 54'));
  // Créance · 1 000 × 2 800 - 2 500 000 = 300 000 de gain latent, au 4791.
  constater(cas, 'la créance seule se réévalue · gain latent 300 000, perte 0', [300_000, 0], [calcul.gainLatent, calcul.perteLatente]);
  await c.ok('POST', '/devises/reevaluation', { exerciceId: n, dateReevaluation: '2025-12-31' });
  constater(cas, '54 inchangé · 2 500 000', 2_500_000, (await ligneBalance(c, n, '54200000')).solde);
  constater(cas, 'aucun 4786 ni 4797 · 0 et 0', [0, 0], [(await ligneBalance(c, n, '47860000')).solde, (await ligneBalance(c, n, '47970000')).solde]);
  constater(cas, 'créance · 2 800 000 après l’écart', 2_800_000, (await ligneBalance(c, n, '41110000')).solde);
  await valider(c, n, '2025-12-31');
  await c.ok('POST', `/exercices/${n}/cloturer`, {});
  await relireExercices(c);
  const n1 = c.exercices.get('2026-01-01');
  constater(cas, 'clôture traversée · 54 reporté à 2 500 000 en 2026', 2_500_000, (await ligneBalance(c, n1.id, '54200000')).report);
  return { calcul: { gainLatent: calcul.gainLatent, perteLatente: calcul.perteLatente, horsReevaluation: hors } };
}

// --- R4 · bien en cours déprécié puis mis en service ---------------------------
async function r4(referentiel) {
  const cas = `R4 ${referentiel}`;
  const syscohada = referentiel === 'SYSCOHADA';
  const c = await dossier(`Rejeu quater en cours ${referentiel}`, {
    referentiel,
    ...(syscohada ? { forme: 'SOCIETE_ANONYME' } : {}),
    exercice: ['2025-01-01', '2025-12-31'],
  });
  const n = c.exercices.get('2025-01-01').id;
  // SYSCOHADA · bâtiment en cours (239, définitif 231), dépréciation au 2939.
  // SYCEBNL · logiciel en cours (2193 « immobilisations incorporelles en
  // cours · logiciels », définitif 2131), dépréciation au 29190000, cible 29130000.
  const comptes = syscohada
    ? { definitif: '23110000', enCours: '23910000', dep: '29390000', cible: '29310000', dotation: '69140000' }
    : { definitif: '21310000', enCours: '21930000', dep: '29190000', cible: '29130000', dotation: '69130000' };
  const bien = await c.ok('POST', '/immobilisations', {
    compteImmobilisationId: compte(c, comptes.definitif),
    compteEnCoursId: compte(c, comptes.enCours),
    designation: syscohada ? 'Entrepôt en construction' : 'Logiciel en développement',
    dateAcquisition: '2025-02-01',
    valeurOrigine: 10_000_000,
    dureeAmortissementAns: syscohada ? 20 : 5,
    compteContrepartieId: compte(c, '52110000'),
    exerciceId: n,
    journalId: c.od.id,
  });
  await c.ok('POST', `/immobilisations/${bien.id}/depreciation`, {
    exerciceId: n,
    journalId: c.od.id,
    sens: 'DOTATION',
    montant: 1_400_000,
    compteDepreciationId: compte(c, comptes.dep),
    compteContrepartieId: compte(c, comptes.dotation),
    indice: 'Retard du chantier et dépassement du budget (test de clôture 2025)',
  });
  await valider(c, n, '2025-12-31');
  await c.ok('POST', `/exercices/${n}/cloturer`, {});
  await relireExercices(c);
  const n1 = c.exercices.get('2026-01-01').id;
  await c.ok('PATCH', `/immobilisations/${bien.id}/mise-en-service`, {
    date: '2026-06-30',
    exerciceId: n1,
    journalId: c.od.id,
    compteDepreciationCibleId: compte(c, comptes.cible),
  });
  await valider(c, n1, '2026-12-31');
  const route = syscohada ? `/etats-financiers-syscohada/notes?exerciceId=${n1}` : `/notes-annexes/associations?exerciceId=${n1}`;
  const r = await c.ok('GET', route);
  const note = r.notes.find((x) => x.code === (syscohada ? '28' : '5F'));
  const phrase = (note?.commentaireServi ?? [])[0] ?? null;
  const montant = (1_400_000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const attendue = syscohada
    ? `Dont transfert à la mise en service · ${montant} en reprise et ${montant} en dotation (exploitation), dépréciation déjà constatée sur l'immobilisation en cours, portée au compte du bien achevé, sans perte de valeur nouvelle.`
    : `Dont transfert à la mise en service · ${montant} en reprise sur la ligne « Autres immobilisations incorporelles » et ${montant} en dotation sur la ligne « Logiciels et sites internet » (exploitation), dépréciation déjà constatée sur l'immobilisation en cours, portée au compte du bien achevé, sans perte de valeur nouvelle.`;
  constater(cas, 'phrase de la note, chiffrée', attendue, phrase);
  // Les colonnes restent brutes · 1 400 000 de dotation et de reprise.
  const lignesDep = (note?.lignes ?? []).filter((x) => !x.estTotal && (x.valeurs?.DIMINUTION_EXPLOITATION || x.valeurs?.DIMINUTIONS || x.valeurs?.AUGMENTATION_EXPLOITATION || x.valeurs?.AUGMENTATIONS));
  const somme = (cle) => centimes(lignesDep.reduce((s, x) => s + Number(x.valeurs?.[cle] ?? 0), 0));
  constater(
    cas,
    'colonnes brutes · dotation et reprise de 1 400 000',
    [1_400_000, 1_400_000],
    syscohada ? [somme('AUGMENTATION_EXPLOITATION'), somme('DIMINUTION_EXPLOITATION')] : [somme('AUGMENTATIONS'), somme('DIMINUTIONS')],
  );
  constater(cas, 'au 2x9, 0 ; au 29 du bien achevé, 1 400 000 créditeur', [0, -1_400_000], [(await ligneBalance(c, n1, comptes.dep)).solde, (await ligneBalance(c, n1, comptes.cible)).solde]);
  return { phrase };
}

// --- R1 bis · le doublement de la dotation (bloquant 1) -----------------------
async function r1bis() {
  const cas = 'R1 bis';
  const c = await dossier('Rejeu quater dotation doublée', { forme: 'SOCIETE_RESPONSABILITE_LIMITEE', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026-01-01').id;
  const nouveauBien = (designation) =>
    c.ok('POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24440000'),
      designation,
      dateAcquisition: '2026-01-01',
      dateMiseEnService: '2026-01-01',
      valeurOrigine: 6_000_000,
      dureeAmortissementAns: 5,
      compteContrepartieId: compte(c, '52110000'),
      exerciceId: n,
      journalId: c.od.id,
    });
  // Bien B · dotation 2026 VALIDÉE ; bien A · dotation 2026 au BROUILLARD.
  const b = await nouveauBien('Mobilier B');
  const dotB = await c.ok('POST', `/immobilisations/${b.id}/dotation`, { exerciceId: n, journalId: c.od.id });
  await valider(c, n, '2026-12-31');
  const a = await nouveauBien('Mobilier A');
  const dotA = await c.ok('POST', `/immobilisations/${a.id}/dotation`, { exerciceId: n, journalId: c.od.id });
  constater(cas, 'dotations de l’année entière · 1 200 000 chacune', [1_200_000, 1_200_000], [centimes(dotA.montant ?? dotA.dotation?.montant), centimes(dotB.montant ?? dotB.dotation?.montant)]);
  const numeroDe = new Map([...c.comptes].map(([num, id]) => [id, num]));
  const dotation = numeroDe.get(b.compteDotationId);
  const amortissement = numeroDe.get(b.compteAmortissementId);
  constater(cas, '681 de 2026 avant la dissolution · 2 400 000', 2_400_000, (await ligneBalance(c, n, dotation)).mouvement);

  await c.ok('PATCH', '/dossier/identite', {
    dateDissolution: '2026-06-30',
    liquidateurs: 'M. Liquidateur',
    dateNominationLiquidateur: '2026-06-30',
    regimeLiquidation: 'ARTICLE_223_1',
    associeUniquePersonneMorale: 'NON',
  });
  const p = await planning(c, n);
  constater(cas, 'le bouton nomme les deux dotations à retirer', [true, 2], [p.dissolution?.arretPropose, p.dissolution?.actesDeLaPeriodeARetirer?.length]);
  const refus = await c.refus('POST', `/exercices/${n}/arreter-a-la-dissolution`, {});
  constater(
    cas,
    'sans accord · refus nommé (AUDCIF art. 59), rien ne bouge',
    [400, true, true, '2026-12-31'],
    [refus.statut, String(refus.message).includes('AUDCIF art. 59'), String(refus.message).includes('dotation aux amortissements'), jour((await relireExercices(c)).find((e) => e.id === n)?.dateFin)],
  );
  const arret = await c.ok('POST', `/exercices/${n}/arreter-a-la-dissolution`, { retirerActesDeLaPeriode: true });
  constater(cas, 'avec l’accord · deux actes retirés (un au brouillard, un en négatif)', [2, true, true], [
    arret.actesRetires?.length,
    arret.actesRetires?.some((x) => x.includes('au brouillard')),
    arret.actesRetires?.some((x) => x.includes('inscription en négatif')),
  ]);
  await relireExercices(c);
  const l = c.exercices.get('2026-07-01');
  constater(cas, 'exercice de liquidation du 01/07 au 31/12/2026', ['2026-07-01', '2026-12-31'], [jour(l?.dateDebut), jour(l?.dateFin)]);
  constater(cas, 'plus aucune dotation de l’année entière · 681 à 0 dans N et dans la liquidation', [0, 0], [
    (await ligneBalance(c, n, dotation)).mouvement,
    (await ligneBalance(c, l.id, dotation)).mouvement,
  ]);
  // La dotation de l'exercice arrêté · 6 000 000 / 5 × 6/12 = 600 000 par bien.
  const dA = await c.ok('POST', `/immobilisations/${a.id}/dotation`, { exerciceId: n, journalId: c.od.id });
  const dB = await c.ok('POST', `/immobilisations/${b.id}/dotation`, { exerciceId: n, journalId: c.od.id });
  constater(cas, 'dotation de l’exercice arrêté · 600 000 par bien', [600_000, 600_000], [centimes(dA.montant ?? dA.dotation?.montant), centimes(dB.montant ?? dB.dotation?.montant)]);
  constater(cas, '681 de 2026 · 1 200 000 au total, et non 3 600 000', [1_200_000, 0], [
    (await ligneBalance(c, n, dotation)).mouvement,
    (await ligneBalance(c, l.id, dotation)).mouvement,
  ]);
  // Traverser la clôture de l'exercice arrêté · le 28 se reporte dans la liquidation.
  await valider(c, n, '2026-06-30');
  await c.ok('POST', `/exercices/${n}/cloturer`, {});
  constater(cas, 'clôture · 28 reporté à 1 200 000 créditeur dans la liquidation', -1_200_000, (await ligneBalance(c, l.id, amortissement)).report);
  // La liquidation · six mois, 600 000 par bien.
  const lA = await c.ok('POST', `/immobilisations/${a.id}/dotation`, { exerciceId: l.id, journalId: c.od.id });
  constater(cas, 'dotation de la liquidation · 600 000 (six mois)', 600_000, centimes(lA.montant ?? lA.dotation?.montant));
  constater(cas, 'bien A · 1 200 000 sur l’année 2026, une seule fois', 1_200_000, centimes(600_000 + Number(lA.montant ?? lA.dotation?.montant)));
  return { actesRetires: arret.actesRetires };
}

// --- R5 · dissolution sans liquidation (majeur 2) ------------------------------
async function r5() {
  const cas = 'R5';
  const c = await dossier('Rejeu quater associé unique', { forme: 'SOCIETE_RESPONSABILITE_LIMITEE', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026-01-01').id;
  await ecriture(c, n, '2026-03-31', 'Apport en banque', [['52110000', 4_000_000, 0], ['10110000', 0, 4_000_000]]);
  await valider(c, n, '2026-06-30');
  // Un exercice 2027 ouvert d'avance, puis occupé par une écriture.
  await c.ok('POST', '/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
  await relireExercices(c);
  const n1 = c.exercices.get('2027-01-01').id;
  const e27 = await ecriture(c, n1, '2027-02-01', 'Opération 2027', [['52110000', 100_000, 0], ['10110000', 0, 100_000]]);
  await c.ok('PATCH', '/dossier/identite', { dateDissolution: '2026-06-30', associeUniquePersonneMorale: 'OUI' });
  const occupe = await c.refus('POST', `/exercices/${n}/arreter-a-la-dissolution`, {});
  constater(cas, 'exercice 2027 occupé · nommé, arrêt refusé', [400, true], [occupe.statut, String(occupe.message).includes("L'exercice du 01/01/2027 au 31/12/2027 suit celui-ci")]);
  await c.ok('DELETE', `/ecritures/${e27.id}`);
  const arret = await c.ok('POST', `/exercices/${n}/arreter-a-la-dissolution`, {});
  await relireExercices(c);
  constater(cas, 'exercice 2027 vide · retiré par l’arrêt', [['2027'], 1, '2026-06-30'], [arret.exercicesRetires, c.listeExercices.length, jour(c.exercices.get('2026-01-01').dateFin)]);
  const clos = await c.ok('POST', `/exercices/${n}/cloturer`, {});
  await relireExercices(c);
  constater(cas, 'clôture · aucun exercice créé, dernier exercice dit', [1, true], [c.listeExercices.length, String(clos.issueOuverture?.[0] ?? '').startsWith('Dernier exercice de la société, dissoute sans liquidation le 30/06/2026')]);
  constater(cas, 'comptes encore soldés nommés · 101 et 521', true, String(clos.issueOuverture?.[0] ?? '').includes('2 compte(s) de bilan restent soldés (10110000, 52110000)'));
  return { issue: clos.issueOuverture };
}

const sortie = {};
for (const [nom, fn] of [['R1', r1], ['R1 bis', r1bis], ['R2', r2], ['R3', r3], ['R4 SYSCOHADA', () => r4('SYSCOHADA')], ['R4 SYCEBNL', () => r4('SYCEBNL')], ['R5', r5]]) {
  if (process.env.REJEU_SEUL && !nom.startsWith(process.env.REJEU_SEUL)) continue;
  try {
    sortie[nom] = await fn();
  } catch (e) {
    console.log(`ÉCHEC ${nom} · ${e.message}`);
    sortie[nom] = { echec: e.message };
    constats.push({ cas: nom, quoi: 'exécution', ok: false, obtenu: e.message });
  }
}
sortie.constats = constats;
const ecarts = constats.filter((x) => !x.ok).length;
console.log(`\n${constats.length} constats, ${ecarts} écart(s).`);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(sortie, null, 2));
process.exit(ecarts === 0 ? 0 : 1);
