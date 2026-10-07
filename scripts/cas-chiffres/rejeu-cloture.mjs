#!/usr/bin/env node
/**
 * REJEU DES CAS CHIFFRÉS DE LA CLÔTURE ET DES ÉTATS FINANCIERS ·
 * docs/cas-chiffres/cloture-etats-financiers.md.
 *
 * Même méthode que `rejeu-is.mjs` · on part des CALCULS. Chaque situation est
 * calculée à la main dans le document, poste par poste, d'après les textes lus
 * (AUDCIF Titres VII, IX et X ; SYCEBNL Partie 2 ch. 3, Partie 4 ch. 1 à 4,
 * Guide d'application, Applications 8, 20, 21 et 22 ; AUSCGIE art. 142, 143
 * et 346), puis rejouée ici dans OmegaX, sur une VRAIE base, par l'API du
 * serveur compilé · inscription d'un dossier, écritures, validation, clôtures
 * annuelles de N et de N+1, affectation, puis lecture des états par leurs
 * routes.
 *
 * Ce script NE CORRIGE RIEN et NE TRANCHE RIEN · il relève, compare à
 * l'attendu recopié du document et imprime chaque écart.
 *
 * Usage (serveur compilé démarré contre une base JETABLE, jamais celle de
 * production, avec INSCRIPTION_PUBLIQUE=true) :
 *
 *   OMEGAX_API=http://localhost:8231 node scripts/cas-chiffres/rejeu-cloture.mjs [sortie.json]
 *
 * OMEGAX_CAS=C01,C02 ne rejoue que les situations nommées.
 */
import { writeFileSync } from 'node:fs';

const BASE = process.env.OMEGAX_API ?? 'http://localhost:8231';
const MOT_DE_PASSE = 'MotDePasse-cas-cloture-2026!';
let compteurAdresse = 1;

/** Un client par dossier · cookie de session et jeton CSRF à lui. */
class Client {
  constructor() {
    // UNE ADRESSE CLIENTE PAR DOSSIER · la limite générale de débit est par
    // adresse (app.module.ts), comme dans les tests navigateur (outils.ts).
    const n = (Date.now() + compteurAdresse++ * 7919) % 16_777_216;
    this.adresse = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
    this.cookie = '';
    this.csrf = '';
  }

  async req(methode, chemin, corps) {
    const r = await fetch(BASE + chemin, {
      method: methode,
      headers: {
        'X-Forwarded-For': this.adresse,
        ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(this.csrf && methode !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
      },
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

  /** Comme `req`, mais un refus arrête la situation avec son motif. */
  async ok(methode, chemin, corps) {
    const r = await this.req(methode, chemin, corps);
    if (r.statut >= 400) {
      throw new Error(`${methode} ${chemin} · ${r.statut} · ${JSON.stringify(r.corps).slice(0, 700)}`);
    }
    return r.corps;
  }
}

/** Un dossier neuf · inscription, forme, plan, journaux et exercices chargés. */
async function dossier(nom, options) {
  const c = new Client();
  await c.ok('POST', '/auth/register', {
    nomEntite: nom,
    referentiel: options.referentiel,
    ...(options.systeme ? { systemeComptableSyscohada: options.systeme } : {}),
    ...(options.jeu ? { jeuEtatsFinanciersSycebnl: options.jeu } : {}),
    email: `cas-cloture-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.cd`,
    motDePasse: MOT_DE_PASSE,
    dateDebutExercice: options.exercice[0],
    dateFinExercice: options.exercice[1],
  });
  if (options.forme) await c.ok('PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: options.forme });
  await rechargerComptes(c);
  const journaux = await c.ok('GET', '/journaux');
  c.journaux = journaux;
  c.od = journaux.find((j) => j.code === 'OD') ?? journaux.find((j) => j.type === 'GENERAL');
  await rechargerExercices(c);
  return c;
}

async function rechargerComptes(c) {
  const comptes = await c.ok('GET', '/comptes?typeCompte=DETAIL');
  c.comptes = new Map(comptes.map((x) => [x.numero, x.id]));
}

async function rechargerExercices(c) {
  const exercices = await c.ok('GET', '/exercices');
  c.exercices = new Map(exercices.map((e) => [e.dateDebut.slice(0, 4), e.id]));
  c.statuts = new Map(exercices.map((e) => [e.dateDebut.slice(0, 4), e.statut]));
}

async function exercice(c, annee) {
  await rechargerExercices(c);
  if (c.exercices.has(annee)) return c.exercices.get(annee);
  const e = await c.ok('POST', '/exercices', { dateDebut: `${annee}-01-01`, dateFin: `${annee}-12-31` });
  c.exercices.set(annee, e.id);
  return e.id;
}

function idCompte(c, numero) {
  const id = c.comptes.get(numero);
  if (!id) throw new Error(`Compte ${numero} absent du plan semé`);
  return id;
}

/** Une écriture au journal OD · lignes [numéro, débit, crédit, ventilations?]. */
async function ecriture(c, exerciceId, date, libelle, lignes, extra = {}) {
  return c.ok('POST', '/ecritures', {
    exerciceId,
    journalId: (extra.journal ?? c.od).id,
    date,
    libelle,
    lignes: lignes.map(([numero, debit, credit, ventilations]) => ({
      compteId: idCompte(c, numero),
      libelle,
      debit,
      credit,
      ...(ventilations ? { ventilations } : {}),
    })),
    ...(extra.reporter ? { reporterAuPremierJourOuvert: true } : {}),
  });
}

const valider = (c, exerciceId, dateLimite) => c.ok('POST', '/ecritures/valider-jusqua', { exerciceId, dateLimite });

async function cloturer(c, annee, corps = {}) {
  const id = c.exercices.get(annee);
  const r = await c.req('POST', `/exercices/${id}/cloturer`, corps);
  await rechargerExercices(c);
  return r.statut < 400 ? 'CLOTURE' : `REFUS ${r.statut} · ${JSON.stringify(r.corps).slice(0, 500)}`;
}

// --- Lecture des états ------------------------------------------------------

/** Aplatit un état en { ref → { n, n1 } } (lignes ou sections sans ref ignorées). */
function parRef(lignes) {
  const m = {};
  for (const l of lignes ?? []) {
    if (!l || !l.ref) continue;
    m[l.ref] = { n: l.montant ?? l.net ?? null, n1: l.montantN1 ?? l.netN1 ?? null };
  }
  return m;
}

const etatSys = (c, ex, route) => c.ok('GET', `/etats-financiers-syscohada/${route}?exerciceId=${ex}`);
const etatSyc = (c, ex, route) => c.ok('GET', `/etats-financiers/${route}?exerciceId=${ex}`);

async function bilanSyscohada(c, ex) {
  const b = await etatSys(c, ex, 'bilan');
  return {
    postes: { ...parRef(b.actif), ...parRef(b.passif) },
    brut: Object.fromEntries((b.actif ?? []).filter((l) => l.ref).map((l) => [l.ref, { brut: l.brut, amort: l.amortissement }])),
    totaux: { actif: b.totalActif, passif: b.totalPassif, actifN1: b.totalActifN1, passifN1: b.totalPassifN1 },
    exerciceN1Disponible: b.exerciceN1Disponible,
    comparatif: b.comparatif,
    mentionComparatif: b.mentionComparatif,
    equilibre: b.equilibre,
    comptesNonRattaches: b.comptesNonRattaches,
    comptesASolderALaCloture: b.comptesASolderALaCloture,
    controle: b.controle,
  };
}

async function resultatSyscohada(c, ex) {
  const r = await etatSys(c, ex, 'compte-de-resultat');
  return {
    postes: parRef(r.lignes),
    soldes: r.soldes,
    soldesN1: r.soldesN1,
    exerciceN1Disponible: r.exerciceN1Disponible,
    comptesNonRattaches: r.comptesNonRattaches,
    controle: r.controle,
  };
}

async function fluxSyscohada(c, ex) {
  const t = await etatSys(c, ex, 'tableau-flux-tresorerie');
  return {
    postes: parRef(t.lignes),
    exerciceN1Disponible: t.exerciceN1Disponible,
    postesNonCalculables: t.postesNonCalculables,
    postesNonCalculablesN1: t.postesNonCalculablesN1,
    comptesNonVentiles: t.comptesNonVentiles,
    comptesTropAgreges: t.comptesTropAgreges,
    postesVides: t.postesVides,
    mentionOuverture: t.mentionOuverture,
    controle: t.controle,
  };
}

/** Lecture générique d'un état SYCEBNL ou SMT · toutes les listes de lignes rencontrées. */
function aplatirTout(objet) {
  const m = {};
  const visiter = (o) => {
    if (Array.isArray(o)) {
      for (const x of o) visiter(x);
      return;
    }
    if (o && typeof o === 'object') {
      if (typeof o.ref === 'string' && o.ref && ('montant' in o || 'net' in o || 'montantN1' in o)) {
        // Un même poste peut paraître deux fois (la ligne de l'état, puis le
        // détail du calcul) · la première lecture qui porte une colonne N-1
        // l'emporte, le détail sans colonne ne l'efface pas.
        const lu = { n: o.montant ?? o.net ?? null, n1: o.montantN1 ?? o.netN1 ?? null };
        m[o.ref] = m[o.ref] ? { n: m[o.ref].n ?? lu.n, n1: m[o.ref].n1 ?? lu.n1 } : lu;
      }
      for (const v of Object.values(o)) if (v && typeof v === 'object') visiter(v);
    }
  };
  visiter(objet);
  return m;
}

/**
 * Compte de résultat SYCEBNL des associations · les postes en lignes, les
 * soldes XA à XE en champs nommés (`EtatsFinanciersService.compteDeResultat`).
 */
async function crSycebnl(c, ex) {
  const r = await etatSyc(c, ex, 'compte-de-resultat');
  const m = aplatirTout({ produits: r.produits, charges: r.charges, hao: [r.produitsHao, r.chargesHao] });
  const total = (ref, n, n1) => (m[ref] = { n: n ?? null, n1: n1 ?? null });
  total('XA', r.totalProduits, r.totalProduitsN1);
  total('XB', r.totalCharges, r.totalChargesN1);
  total('XC', r.resultatActivitesOrdinaires, r.resultatActivitesOrdinairesN1);
  total('XD', r.resultatHao, r.resultatHaoN1);
  total('XE', r.resultatNet, r.resultatNetN1);
  return m;
}

const controles = async (c, ex) => (await c.ok('GET', `/controles?exerciceId=${ex}`)).anomalies ?? [];
const codesControles = (anomalies) => anomalies.map((a) => a.code);

// --- Comparaison ------------------------------------------------------------

/**
 * Compare un attendu { ref: montant } à ce qu'OmegaX rend ({ ref: { n, n1 } }),
 * sur la colonne demandée. Un poste absent d'OmegaX est lu `null`, jamais zéro.
 */
function comparer(attendu, obtenu, colonne = 'n') {
  return Object.entries(attendu).map(([ref, montant]) => {
    const o = obtenu[ref]?.[colonne];
    const omegax = o === undefined ? null : o;
    const ecart = omegax === null ? 'ABSENT' : Math.round((omegax - montant) * 100) / 100;
    return { ref, attendu: montant, omegax, ecart };
  });
}

const ecarts = (comparaisons) => comparaisons.filter((x) => x.ecart !== 0);

// --- Les situations ---------------------------------------------------------

const CAS = [];
const cas = (code, titre, fn) => CAS.push({ code, titre, fn });

// --- C01 à C04 · SARL bénéficiaire, Système normal --------------------------

/** Attendus calculés à la main · voir le document, situations C01 à C04. */
const C01_BILAN_2025 = {
  AI: 5_400_000, AM: 5_400_000, AZ: 5_400_000, BB: 1_000_000, BG: 3_000_000, BI: 3_000_000, BK: 4_000_000,
  BS: 12_300_000, BT: 12_300_000, BZ: 21_700_000,
  CA: 10_000_000, CJ: 3_290_000, CP: 13_290_000, DA: 5_000_000, DD: 5_000_000, DF: 18_290_000,
  DJ: 2_000_000, DK: 1_410_000, DP: 3_410_000, DZ: 21_700_000,
};
const C01_CR_2025 = {
  TA: 20_000_000, RA: -12_000_000, RB: 1_000_000, XA: 9_000_000, XB: 20_000_000, RH: -400_000, XC: 8_600_000,
  RK: -3_000_000, XD: 5_600_000, RL: -600_000, XE: 5_000_000, RM: -300_000, XF: -300_000, XG: 4_700_000,
  XH: 0, RS: -1_410_000, XI: 3_290_000,
};
const C01_TFT_2025 = {
  ZA: 0, FA: 3_890_000, FB: 0, FC: -1_000_000, FD: -3_000_000, FE: 3_410_000, ZB: 3_300_000,
  FF: 0, FG: -6_000_000, FH: 0, FI: 0, FJ: 0, ZC: -6_000_000,
  FK: 10_000_000, FL: 0, FM: 0, FN: 0, ZD: 10_000_000, FO: 5_000_000, FP: 0, FQ: 0, ZE: 5_000_000,
  ZF: 15_000_000, ZG: 12_300_000, ZH: 12_300_000,
};
const C03_BILAN_2026 = {
  AI: 4_200_000, AM: 4_200_000, AZ: 4_200_000, BB: 1_500_000, BG: 4_000_000, BI: 4_000_000, BK: 5_500_000,
  BS: 12_740_000, BT: 12_740_000, BZ: 22_440_000,
  CA: 10_000_000, CF: 329_000, CH: 1_961_000, CJ: 3_605_000, CP: 15_895_000, DA: 4_000_000, DD: 4_000_000,
  DF: 19_895_000, DJ: 1_000_000, DK: 1_545_000, DP: 2_545_000, DZ: 22_440_000,
};
const C03_CR_2026 = {
  TA: 25_000_000, RA: -15_000_000, RB: 500_000, XA: 10_500_000, XB: 25_000_000, RH: 0, XC: 10_500_000,
  RK: -3_900_000, XD: 6_600_000, RL: -1_200_000, XE: 5_400_000, RM: -250_000, XF: -250_000, XG: 5_150_000,
  XH: 0, RS: -1_545_000, XI: 3_605_000,
};
const C03_TFT_2026 = {
  ZA: 12_300_000, FA: 4_805_000, FB: 0, FC: -500_000, FD: -1_000_000, FE: -865_000, ZB: 2_440_000,
  FF: 0, FG: 0, FH: 0, FI: 0, FJ: 0, ZC: 0,
  FK: 0, FL: 0, FM: 0, FN: -1_000_000, ZD: -1_000_000, FO: 0, FP: 0, FQ: -1_000_000, ZE: -1_000_000,
  ZF: -2_000_000, ZG: 440_000, ZH: 12_740_000,
};

const etiqueter = (etat, liste) => liste.map((x) => ({ etat, ...x }));

/** Un geste ou un contrôle tenu pour vrai (1) ou faux (0), comparé à l'attendu. */
const verifie = (etat, ref, attendu, vrai) => ({ etat, ref, attendu, omegax: vrai ? 1 : 0, ecart: (vrai ? 1 : 0) - attendu });
/** Une réserve « non calculable » nommée sur un poste du TFT (constat N2). */
const reserveSur = (postes, ref) => (postes ?? []).some((x) => x.ref === ref);

cas('C01', 'SARL bénéficiaire · clôture N, affectation en N+1, états N et N+1, deux clôtures traversées', async () => {
  const c = await dossier('Cas clôture C01 SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', forme: 'SOCIETE_RESPONSABILITE_LIMITEE', exercice: ['2025-01-01', '2025-12-31'],
  });
  const n = c.exercices.get('2025');
  const B = '52110000';
  const e = (d, l, lignes) => ecriture(c, n, d, l, lignes);
  await e('2025-01-05', 'Apport du capital', [[B, 10_000_000, 0], ['10130000', 0, 10_000_000]]);
  await e('2025-01-10', 'Emprunt bancaire', [[B, 5_000_000, 0], ['16200000', 0, 5_000_000]]);
  await e('2025-07-01', 'Matériel de bureau', [['24410000', 6_000_000, 0], [B, 0, 6_000_000]]);
  await e('2025-06-30', 'Ventes de marchandises', [['41110000', 20_000_000, 0], ['70110000', 0, 20_000_000]]);
  await e('2025-09-30', 'Encaissement clients', [[B, 17_000_000, 0], ['41110000', 0, 17_000_000]]);
  await e('2025-06-30', 'Achats de marchandises', [['60110000', 12_000_000, 0], ['40110000', 0, 12_000_000]]);
  await e('2025-09-30', 'Règlement fournisseurs', [['40110000', 10_000_000, 0], [B, 0, 10_000_000]]);
  await e('2025-12-31', 'Salaires de l’exercice', [['66110000', 3_000_000, 0], ['42200000', 0, 3_000_000]]);
  await e('2025-12-31', 'Paiement des salaires', [['42200000', 3_000_000, 0], [B, 0, 3_000_000]]);
  await e('2025-09-30', 'Personnel intérimaire', [['63710000', 400_000, 0], [B, 0, 400_000]]);
  await e('2025-12-31', 'Intérêts de l’emprunt', [['67120000', 300_000, 0], [B, 0, 300_000]]);
  await e('2025-12-31', 'Stock final de marchandises', [['31110000', 1_000_000, 0], ['60310000', 0, 1_000_000]]);
  await e('2025-12-31', 'Dotation aux amortissements', [['68130000', 600_000, 0], ['28440000', 0, 600_000]]);
  await e('2025-12-31', 'Impôt sur le résultat', [['89110000', 1_410_000, 0], ['44100000', 0, 1_410_000]]);
  await valider(c, n, '2025-12-31');

  const avant2025 = { bilan: await bilanSyscohada(c, n), cr: await resultatSyscohada(c, n), tft: await fluxSyscohada(c, n) };
  const controles2025 = codesControles(await controles(c, n));
  const cloture2025 = await cloturer(c, '2025');
  const n1 = c.exercices.get('2026');
  const apres2025 = { bilan: await bilanSyscohada(c, n), cr: await resultatSyscohada(c, n), tft: await fluxSyscohada(c, n) };

  // C02 · affectation · d'abord une réserve légale inférieure au dixième (refus attendu), puis la décision conforme.
  await rechargerComptes(c);
  const lignesAff = (reserve, dividendes, report) => [
    { compteId: idCompte(c, '11100000'), montant: reserve },
    { compteId: idCompte(c, '46500000'), montant: dividendes },
    { compteId: idCompte(c, '12100000'), montant: report },
  ];
  const preparation = await c.ok('GET', `/affectation-resultat/exercice/${n}`);
  const refusReserve = await c.req('POST', '/affectation-resultat', {
    exerciceId: n, dateDecision: '2026-06-30', organe: 'Assemblée générale ordinaire', lignes: lignesAff(300_000, 1_000_000, 1_990_000),
  });
  const affectation = await c.req('POST', '/affectation-resultat', {
    exerciceId: n, dateDecision: '2026-06-30', organe: 'Assemblée générale ordinaire', lignes: lignesAff(329_000, 1_000_000, 1_961_000),
  });

  const f = (d, l, lignes) => ecriture(c, n1, d, l, lignes);
  await f('2026-04-30', 'Paiement de l’impôt 2025', [['44100000', 1_410_000, 0], [B, 0, 1_410_000]]);
  await f('2026-07-15', 'Paiement des dividendes', [['46500000', 1_000_000, 0], [B, 0, 1_000_000]]);
  await f('2026-02-15', 'Encaissement clients 2025', [[B, 3_000_000, 0], ['41110000', 0, 3_000_000]]);
  await f('2026-02-15', 'Règlement fournisseurs 2025', [['40110000', 2_000_000, 0], [B, 0, 2_000_000]]);
  await f('2026-06-30', 'Ventes de marchandises', [['41110000', 25_000_000, 0], ['70110000', 0, 25_000_000]]);
  await f('2026-09-30', 'Encaissement clients', [[B, 21_000_000, 0], ['41110000', 0, 21_000_000]]);
  await f('2026-06-30', 'Achats de marchandises', [['60110000', 15_000_000, 0], ['40110000', 0, 15_000_000]]);
  await f('2026-09-30', 'Règlement fournisseurs', [['40110000', 14_000_000, 0], [B, 0, 14_000_000]]);
  await f('2026-12-31', 'Annulation du stock initial', [['60310000', 1_000_000, 0], ['31110000', 0, 1_000_000]]);
  await f('2026-12-31', 'Stock final de marchandises', [['31110000', 1_500_000, 0], ['60310000', 0, 1_500_000]]);
  await f('2026-12-31', 'Salaires de l’exercice', [['66110000', 3_500_000, 0], ['42200000', 0, 3_500_000]]);
  await f('2026-12-31', 'Paiement des salaires', [['42200000', 3_500_000, 0], [B, 0, 3_500_000]]);
  await f('2026-09-30', 'Personnel intérimaire', [['63710000', 400_000, 0], [B, 0, 400_000]]);
  await f('2026-12-31', 'Virement du 637 au 667 (AUDCIF Titre VIII ch. 27 § 2)', [['66710000', 400_000, 0], ['63710000', 0, 400_000]]);
  await f('2026-12-31', 'Intérêts de l’emprunt', [['67120000', 250_000, 0], [B, 0, 250_000]]);
  await f('2026-12-31', 'Remboursement d’emprunt', [['16200000', 1_000_000, 0], [B, 0, 1_000_000]]);
  await f('2026-12-31', 'Dotation aux amortissements', [['68130000', 1_200_000, 0], ['28440000', 0, 1_200_000]]);
  await f('2026-12-31', 'Impôt sur le résultat', [['89110000', 1_545_000, 0], ['44100000', 0, 1_545_000]]);
  await valider(c, n1, '2026-12-31');

  const avant2026 = { bilan: await bilanSyscohada(c, n1), cr: await resultatSyscohada(c, n1), tft: await fluxSyscohada(c, n1) };
  const controles2026 = codesControles(await controles(c, n1));
  const cloture2026 = await cloturer(c, '2026');
  const n2 = c.exercices.get('2027');
  const apres2026 = { bilan: await bilanSyscohada(c, n1), cr: await resultatSyscohada(c, n1), tft: await fluxSyscohada(c, n1) };
  const bilan2027 = await bilanSyscohada(c, n2);
  const cr2027 = await resultatSyscohada(c, n2);

  return {
    clotures: { 2025: cloture2025, 2026: cloture2026 },
    reserveLegale: { preparation, refus: { statut: refusReserve.statut, motif: refusReserve.corps?.message }, decision: { statut: affectation.statut, corps: affectation.statut < 400 ? { montant: affectation.corps.montant, ecriture: affectation.corps.ecriture } : affectation.corps } },
    controles: {
      2025: { personnelExterieur: controles2025.includes('PERSONNEL_EXTERIEUR_NON_VIRE'), codes: controles2025 },
      2026: { personnelExterieur: controles2026.includes('PERSONNEL_EXTERIEUR_NON_VIRE'), codes: controles2026 },
    },
    lu: {
      bilan2025Avant: { totaux: avant2025.bilan.totaux, n1: avant2025.bilan.exerciceN1Disponible, controle: avant2025.bilan.controle, nonRattaches: avant2025.bilan.comptesNonRattaches, brutAM: avant2025.bilan.brut.AM },
      tft2025: { nonCalculables: avant2025.tft.postesNonCalculables, nonVentiles: avant2025.tft.comptesNonVentiles, controle: avant2025.tft.controle },
      tft2026: { nonCalculables: avant2026.tft.postesNonCalculables, nonCalculablesN1: avant2026.tft.postesNonCalculablesN1, nonVentiles: avant2026.tft.comptesNonVentiles, controle: avant2026.tft.controle },
      bilan2026Avant: { totaux: avant2026.bilan.totaux, controle: avant2026.bilan.controle, nonRattaches: avant2026.bilan.comptesNonRattaches },
      bilan2027: { totaux: bilan2027.totaux, controle: bilan2027.controle, n1: bilan2027.exerciceN1Disponible },
      cr2027: { n1: cr2027.exerciceN1Disponible, soldes: cr2027.soldes, soldesN1: cr2027.soldesN1 },
    },
    comparaisons: {
      bilan2025AvantCloture: etiqueter('Bilan 2025 avant clôture', comparer(C01_BILAN_2025, avant2025.bilan.postes)),
      cr2025AvantCloture: etiqueter('CR 2025 avant clôture', comparer(C01_CR_2025, avant2025.cr.postes)),
      tft2025: etiqueter('TFT 2025', comparer(C01_TFT_2025, avant2025.tft.postes)),
      bilan2025ApresCloture: etiqueter('Bilan 2025 après clôture', comparer(C01_BILAN_2025, apres2025.bilan.postes)),
      cr2025ApresCloture: etiqueter('CR 2025 après clôture', comparer(C01_CR_2025, apres2025.cr.postes)),
      tft2025ApresCloture: etiqueter('TFT 2025 après clôture', comparer(C01_TFT_2025, apres2025.tft.postes)),
      bilan2026: etiqueter('Bilan 2026 avant clôture', comparer(C03_BILAN_2026, avant2026.bilan.postes)),
      bilan2026N1: etiqueter('Bilan 2026, colonne N-1', comparer(C01_BILAN_2025, avant2026.bilan.postes, 'n1')),
      cr2026: etiqueter('CR 2026 avant clôture', comparer(C03_CR_2026, avant2026.cr.postes)),
      cr2026N1: etiqueter('CR 2026, colonne N-1', comparer(C01_CR_2025, avant2026.cr.postes, 'n1')),
      tft2026: etiqueter('TFT 2026', comparer(C03_TFT_2026, avant2026.tft.postes)),
      tft2026N1: etiqueter('TFT 2026, colonne N-1', comparer(C01_TFT_2025, avant2026.tft.postes, 'n1')),
      bilan2026Apres: etiqueter('Bilan 2026 après clôture', comparer(C03_BILAN_2026, apres2026.bilan.postes)),
      cr2026Apres: etiqueter('CR 2026 après clôture', comparer(C03_CR_2026, apres2026.cr.postes)),
      tft2026Apres: etiqueter('TFT 2026 après clôture', comparer(C03_TFT_2026, apres2026.tft.postes)),
      bilan2027N1: etiqueter('Bilan 2027, colonne N-1', comparer(C03_BILAN_2026, bilan2027.postes, 'n1')),
      cr2027N1: etiqueter('CR 2027, colonne N-1', comparer(C03_CR_2026, cr2027.postes, 'n1')),
      controle637: [
        { etat: 'Contrôle 637 en 2025 (non viré, doit se lever)', ref: 'PERSONNEL_EXTERIEUR_NON_VIRE', attendu: 1, omegax: controles2025.includes('PERSONNEL_EXTERIEUR_NON_VIRE') ? 1 : 0, ecart: controles2025.includes('PERSONNEL_EXTERIEUR_NON_VIRE') ? 0 : -1 },
        { etat: 'Contrôle 637 en 2026 (viré, doit se taire)', ref: 'PERSONNEL_EXTERIEUR_NON_VIRE', attendu: 0, omegax: controles2026.includes('PERSONNEL_EXTERIEUR_NON_VIRE') ? 1 : 0, ecart: controles2026.includes('PERSONNEL_EXTERIEUR_NON_VIRE') ? 1 : 0 },
        { etat: 'Réserve légale sous le dixième (refus attendu)', ref: 'AUSCGIE art. 346', attendu: 400, omegax: refusReserve.statut, ecart: refusReserve.statut === 400 ? 0 : refusReserve.statut - 400 },
        // Mineur 7 de la relecture du 2026-10-07 · le refus se juge à son MOTIF,
        // pas au seul statut · un 400 d'une autre cause passait pour lui.
        verifie('Réserve légale sous le dixième · le motif dit la dotation exigée', 'AUSCGIE art. 346', 1,
          typeof refusReserve.corps?.message === 'string' && refusReserve.corps.message.includes('La réserve légale doit recevoir au moins 329000.00')),
        { etat: 'Affectation conforme (acceptée)', ref: 'AUSCGIE art. 346', attendu: 201, omegax: affectation.statut, ecart: affectation.statut < 300 ? 0 : affectation.statut - 201 },
        verifie('TFT 2026 · aucune réserve « réévaluation hors module » sur FG (dotation au 28)', 'N2 · FG', 0, reserveSur(avant2026.tft.postesNonCalculables, 'FG')),
      ],
    },
  };
});

// --- C05 · SARL déficitaire, puis bénéficiaire sur pertes antérieures -------

const C05_CR_2026 = {
  TA: 8_000_000, RA: -9_000_000, XA: -1_000_000, XB: 8_000_000, XC: -1_000_000, RK: -1_500_000, XD: -2_500_000,
  XE: -2_500_000, XF: 0, XG: -2_500_000, XH: 0, RS: -80_000, XI: -2_580_000,
};
const C05_BILAN_2026 = { BS: 2_500_000, BT: 2_500_000, BZ: 2_500_000, CA: 5_000_000, CH: 0, CJ: -2_580_000, CP: 2_420_000, DK: 80_000, DP: 80_000, DZ: 2_500_000 };
const C05_CR_2027 = {
  TA: 10_000_000, RA: -7_000_000, XA: 3_000_000, XB: 10_000_000, XC: 3_000_000, RK: -1_500_000, XD: 1_500_000,
  XE: 1_500_000, XG: 1_500_000, RS: -100_000, XI: 1_400_000,
};
const C05_BILAN_2027 = { BS: 3_920_000, BT: 3_920_000, BZ: 3_920_000, CA: 5_000_000, CH: -2_580_000, CJ: 1_400_000, CP: 3_820_000, DK: 100_000, DP: 100_000, DZ: 3_920_000 };

cas('C05', 'SARL déficitaire en N, bénéficiaire en N+1 sur pertes antérieures · affectation de la perte, réserve légale nulle', async () => {
  const c = await dossier('Cas clôture C05 SARL déficitaire', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', forme: 'SOCIETE_RESPONSABILITE_LIMITEE', exercice: ['2026-01-01', '2026-12-31'],
  });
  const B = '52110000';
  const n = c.exercices.get('2026');
  const e = (ex, d, l, lignes) => ecriture(c, ex, d, l, lignes);
  await e(n, '2026-01-05', 'Apport du capital', [[B, 5_000_000, 0], ['10130000', 0, 5_000_000]]);
  await e(n, '2026-06-30', 'Ventes au comptant', [[B, 8_000_000, 0], ['70110000', 0, 8_000_000]]);
  await e(n, '2026-06-30', 'Achats au comptant', [['60110000', 9_000_000, 0], [B, 0, 9_000_000]]);
  await e(n, '2026-12-31', 'Salaires', [['66110000', 1_500_000, 0], [B, 0, 1_500_000]]);
  await e(n, '2026-12-31', 'Impôt minimum (art. 57)', [['89500000', 80_000, 0], ['44100000', 0, 80_000]]);
  await valider(c, n, '2026-12-31');
  const bilan2026 = await bilanSyscohada(c, n);
  const cr2026 = await resultatSyscohada(c, n);
  const controles2026 = codesControles(await controles(c, n));
  const cloture2026 = await cloturer(c, '2026');
  const n1 = c.exercices.get('2027');
  await rechargerComptes(c);
  const preparation2026 = await c.ok('GET', `/affectation-resultat/exercice/${n}`);
  const affectation2026 = await c.req('POST', '/affectation-resultat', {
    exerciceId: n, dateDecision: '2027-06-30', organe: 'Assemblée générale ordinaire',
    lignes: [{ compteId: idCompte(c, '12910000'), montant: 2_580_000 }],
  });
  await e(n1, '2027-04-30', 'Paiement de l’impôt minimum 2026', [['44100000', 80_000, 0], [B, 0, 80_000]]);
  await e(n1, '2027-06-30', 'Ventes au comptant', [[B, 10_000_000, 0], ['70110000', 0, 10_000_000]]);
  await e(n1, '2027-06-30', 'Achats au comptant', [['60110000', 7_000_000, 0], [B, 0, 7_000_000]]);
  await e(n1, '2027-12-31', 'Salaires', [['66110000', 1_500_000, 0], [B, 0, 1_500_000]]);
  await e(n1, '2027-12-31', 'Impôt minimum (art. 57)', [['89500000', 100_000, 0], ['44100000', 0, 100_000]]);
  await valider(c, n1, '2027-12-31');
  const bilan2027 = await bilanSyscohada(c, n1);
  const cr2027 = await resultatSyscohada(c, n1);
  const controles2027 = codesControles(await controles(c, n1));
  const cloture2027 = await cloturer(c, '2027');
  await rechargerComptes(c);
  const preparation2027 = await c.ok('GET', `/affectation-resultat/exercice/${n1}`);
  // Bénéfice 1 400 000 diminué des pertes antérieures 2 580 000 · rien n'est dû à la réserve légale (AUSCGIE art. 346).
  const affectation2027 = await c.req('POST', '/affectation-resultat', {
    exerciceId: n1, dateDecision: '2028-06-30', organe: 'Assemblée générale ordinaire',
    lignes: [{ compteId: idCompte(c, '12910000'), montant: 1_400_000 }],
  });
  const n2 = c.exercices.get('2028');
  // L'écriture d'affectation naît au brouillard (AUDCIF art. 22, 2°) · validée avant lecture.
  await valider(c, n2, '2028-12-31');
  const bilan2028 = await bilanSyscohada(c, n2);
  const moitie = (codes) => (codes.includes('CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL') ? 1 : 0);
  return {
    clotures: { 2026: cloture2026, 2027: cloture2027 },
    affectations: {
      2026: { statut: affectation2026.statut, corps: affectation2026.statut < 400 ? { montant: affectation2026.corps.montant } : affectation2026.corps, preparation: { montant: preparation2026.montant, estBenefice: preparation2026.estBenefice, reserveLegale: preparation2026.reserveLegale } },
      2027: { statut: affectation2027.statut, corps: affectation2027.statut < 400 ? { montant: affectation2027.corps.montant } : affectation2027.corps, preparation: { montant: preparation2027.montant, pertesAnterieures: preparation2027.pertesAnterieures, reserveLegale: preparation2027.reserveLegale } },
    },
    controles: { 2026: controles2026, 2027: controles2027 },
    lu: { bilan2028: { CH: bilan2028.postes.CH, CJ: bilan2028.postes.CJ, CP: bilan2028.postes.CP } },
    comparaisons: {
      cr2026: etiqueter('CR 2026', comparer(C05_CR_2026, cr2026.postes)),
      bilan2026: etiqueter('Bilan 2026', comparer(C05_BILAN_2026, bilan2026.postes)),
      cr2027: etiqueter('CR 2027', comparer(C05_CR_2027, cr2027.postes)),
      cr2027N1: etiqueter('CR 2027, colonne N-1', comparer(C05_CR_2026, cr2027.postes, 'n1')),
      bilan2027: etiqueter('Bilan 2027', comparer(C05_BILAN_2027, bilan2027.postes)),
      bilan2027N1: etiqueter('Bilan 2027, colonne N-1', comparer(C05_BILAN_2026, bilan2027.postes, 'n1')),
      bilan2028: etiqueter('Bilan 2028 après affectation de 2027 (report)', comparer({ CH: -1_180_000, CJ: 0, CP: 3_820_000 }, bilan2028.postes)),
      gestes: [
        { etat: 'Moitié du capital en 2026 (doit se lever)', ref: 'CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL', attendu: 1, omegax: moitie(controles2026), ecart: moitie(controles2026) - 1 },
        { etat: 'Moitié du capital en 2027 (doit se taire)', ref: 'CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL', attendu: 0, omegax: moitie(controles2027), ecart: moitie(controles2027) },
        { etat: 'Affectation de la perte 2026 au 1291', ref: 'Titre VII compte 12', attendu: 201, omegax: affectation2026.statut, ecart: affectation2026.statut < 300 ? 0 : affectation2026.statut - 201 },
        { etat: 'Affectation 2027 sans réserve légale (pertes antérieures)', ref: 'AUSCGIE art. 346', attendu: 201, omegax: affectation2027.statut, ecart: affectation2027.statut < 300 ? 0 : affectation2027.statut - 201 },
      ],
    },
  };
});

// --- C06 · bilan d'ouverture importé -----------------------------------------

const C06_OUVERTURE = [
  ['10130000', 'Capital', 0, 2_000_000],
  ['12100000', 'Report à nouveau', 0, 500_000],
  ['24410000', 'Matériel de bureau', 3_000_000, 0],
  ['28440000', 'Amortissements', 0, 900_000],
  ['41110000', 'Clients', 800_000, 0],
  ['40110000', 'Fournisseurs', 0, 600_000],
  ['52110000', 'Banque', 200_000, 0],
];
const C06_BILAN_2026 = { AM: 1_500_000, AZ: 1_500_000, BI: 800_000, BG: 800_000, BS: 3_200_000, BT: 3_200_000, BZ: 5_500_000, CA: 2_000_000, CH: 500_000, CJ: 2_400_000, CP: 4_900_000, DJ: 600_000, DP: 600_000, DZ: 5_500_000 };
const C06_BILAN_OUVERTURE = { AM: 2_100_000, AZ: 2_100_000, BI: 800_000, BS: 200_000, BZ: 3_100_000, CA: 2_000_000, CH: 500_000, CP: 2_500_000, DJ: 600_000, DZ: 3_100_000 };
const C06_CR_2026 = { TA: 5_000_000, XB: 5_000_000, RH: -2_000_000, XC: 3_000_000, XD: 3_000_000, RL: -600_000, XE: 2_400_000, XI: 2_400_000 };
const C06_TFT_2026 = { ZA: 200_000, FA: 3_000_000, FB: 0, FC: 0, FD: 0, FE: 0, ZB: 3_000_000, FG: 0, ZC: 0, ZD: 0, ZE: 0, ZF: 0, ZG: 3_000_000, ZH: 3_200_000 };

cas('C06', 'SARL reprise · bilan d’ouverture importé au 1er janvier, colonne N-1 et TFT du premier exercice tenu', async () => {
  const c = await dossier('Cas clôture C06 SARL reprise', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', forme: 'SOCIETE_RESPONSABILITE_LIMITEE', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026');
  const csv = ['Compte;Intitule;Debit;Credit', ...C06_OUVERTURE.map(([num, lib, d, cr]) => `${num};${lib};${d};${cr}`)].join('\n');
  const importe = await c.ok('POST', '/import/executer', {
    type: 'BALANCE', nomFichier: 'ouverture-2026.csv', contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
    mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
    exerciceId: n, dateOperation: '2026-01-01', bilanDOuverture: true, separateur: ';',
  });
  const B = '52110000';
  await ecriture(c, n, '2026-06-30', 'Ventes au comptant', [[B, 5_000_000, 0], ['70110000', 0, 5_000_000]]);
  await ecriture(c, n, '2026-06-30', 'Entretien et réparations', [['62410000', 2_000_000, 0], [B, 0, 2_000_000]]);
  await ecriture(c, n, '2026-12-31', 'Dotation aux amortissements', [['68130000', 600_000, 0], ['28440000', 0, 600_000]]);
  const validation = await valider(c, n, '2026-12-31');
  const brouillardRestant = await c.ok('GET', `/ecritures/brouillard?exerciceId=${n}`).catch((x) => x.message);
  const bilan = await bilanSyscohada(c, n);
  const cr = await resultatSyscohada(c, n);
  const tft = await fluxSyscohada(c, n);
  const cloture2026 = await cloturer(c, '2026');
  const n1 = c.exercices.get('2027');
  const bilan2027 = await bilanSyscohada(c, n1);
  const tft2027 = await fluxSyscohada(c, n1);
  return {
    import: { ecritures: importe.ecrituresCreees, totalDebit: importe.totalDebit, totalCredit: importe.totalCredit, anomalies: importe.anomalies },
    validation,
    brouillardRestant: Array.isArray(brouillardRestant) ? brouillardRestant.length : brouillardRestant?.ecritures?.length ?? brouillardRestant,
    cloture: cloture2026,
    lu: {
      bilan: { n1Disponible: bilan.exerciceN1Disponible, totaux: bilan.totaux, nonRattaches: bilan.comptesNonRattaches, brutAM: bilan.brut.AM },
      tft: { nonCalculables: tft.postesNonCalculables, controle: tft.controle },
      tft2027N1: { nonCalculablesN1: tft2027.postesNonCalculablesN1 },
    },
    comparaisons: {
      bilan2026: etiqueter('Bilan 2026', comparer(C06_BILAN_2026, bilan.postes)),
      bilan2026N1: etiqueter('Bilan 2026, colonne N-1 (bilan d’ouverture importé)', comparer(C06_BILAN_OUVERTURE, bilan.postes, 'n1')),
      cr2026: etiqueter('CR 2026', comparer(C06_CR_2026, cr.postes)),
      tft2026: etiqueter('TFT 2026', comparer(C06_TFT_2026, tft.postes)),
      bilan2027N1: etiqueter('Bilan 2027, colonne N-1', comparer(C06_BILAN_2026, bilan2027.postes, 'n1')),
      bilan2027: etiqueter('Bilan 2027 (ouverture = clôture 2026)', comparer({ AM: 1_500_000, BI: 800_000, BS: 3_200_000, CA: 2_000_000, DJ: 600_000 }, bilan2027.postes)),
    },
  };
});

// --- C07 · écriture de N saisie après l'ouverture de N+1 ; art. 22, 4° -------

cas('C07', 'Écriture de N passée après l’ouverture de N+1 (à-nouveaux provisoires), période close de N et art. 22, 4°', async () => {
  const c = await dossier('Cas clôture C07 SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', forme: 'SOCIETE_RESPONSABILITE_LIMITEE', exercice: ['2026-01-01', '2026-12-31'],
  });
  const B = '52110000';
  const n = c.exercices.get('2026');
  await ecriture(c, n, '2026-01-05', 'Apport du capital', [[B, 3_000_000, 0], ['10130000', 0, 3_000_000]]);
  await ecriture(c, n, '2026-06-30', 'Ventes au comptant', [[B, 4_000_000, 0], ['70110000', 0, 4_000_000]]);
  await ecriture(c, n, '2026-06-30', 'Entretien', [['62410000', 1_000_000, 0], [B, 0, 1_000_000]]);
  await valider(c, n, '2026-12-31');
  // Ouverture de N+1 avant la clôture de N (AUDCIF art. 23 · quatre mois pour arrêter).
  const ouverture = await c.ok('POST', `/exercices/${n}/a-nouveaux-provisoires`, {});
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027');
  await ecriture(c, n1, '2027-02-10', 'Ventes au comptant', [[B, 2_000_000, 0], ['70110000', 0, 2_000_000]]);
  await valider(c, n1, '2027-12-31');
  // Période close de N jusqu'au 30 novembre (art. 22, 3°).
  const periode = await c.req('POST', `/exercices/${n}/clotures/periode`, { dateLimite: '2026-11-30' });
  // Facture de décembre N reçue en février N+1, enregistrée dans N.
  await ecriture(c, n, '2026-12-20', 'Facture d’entretien de décembre reçue en février', [['62410000', 500_000, 0], ['40110000', 0, 500_000]]);
  // Opération du 15 novembre découverte après la clôture de période · sans demande, puis avec (art. 22, 4°).
  const sansReport = await c.req('POST', '/ecritures', {
    exerciceId: n, journalId: c.od.id, date: '2026-11-15', libelle: 'Frais bancaires de novembre',
    lignes: [{ compteId: idCompte(c, '62410000'), debit: 200_000, credit: 0 }, { compteId: idCompte(c, B), debit: 0, credit: 200_000 }],
  });
  const avecReport = await c.req('POST', '/ecritures', {
    exerciceId: n, journalId: c.od.id, date: '2026-11-15', libelle: 'Frais bancaires de novembre', reporterAuPremierJourOuvert: true,
    lignes: [{ compteId: idCompte(c, '62410000'), debit: 200_000, credit: 0 }, { compteId: idCompte(c, B), debit: 0, credit: 200_000 }],
  });
  await valider(c, n, '2026-12-31');
  // Clôture dans l'ordre · N+1 avant N refusée.
  const clotureN1AvantN = await c.req('POST', `/exercices/${n1}/cloturer`, {});
  const apercu = await c.req('GET', `/exercices/${n}/ouverture-suivante`);
  const cloture2026 = await cloturer(c, '2026');
  const bilan2026 = await bilanSyscohada(c, n);
  const cr2026 = await resultatSyscohada(c, n);
  const bilan2027 = await bilanSyscohada(c, n1);
  const balance2027 = await c.ok('GET', `/ecritures/balance?exerciceId=${n1}`);
  const ligne = (num) => (balance2027.lignes ?? []).find((l) => l.numero === num);
  // Omission découverte après la clôture de N · par le résultat de N+1 (Titre V, correspondance bilan de clôture / bilan d'ouverture).
  const apresCloture = await c.req('POST', '/ecritures', {
    exerciceId: n, journalId: c.od.id, date: '2026-12-28', libelle: 'Facture de décembre oubliée', reporterAuPremierJourOuvert: true,
    lignes: [{ compteId: idCompte(c, '62410000'), debit: 100_000, credit: 0 }, { compteId: idCompte(c, '40110000'), debit: 0, credit: 100_000 }],
  });
  const dansN1 = await c.req('POST', '/ecritures', {
    exerciceId: n1, journalId: c.od.id, date: '2027-01-15', libelle: 'Facture de décembre 2026 oubliée (charge sur exercice antérieur)',
    lignes: [{ compteId: idCompte(c, '62410000'), debit: 100_000, credit: 0 }, { compteId: idCompte(c, '40110000'), debit: 0, credit: 100_000 }],
  });
  const reportee = avecReport.statut < 400 ? { date: avecReport.corps.date, dateValeur: avecReport.corps.dateValeur } : null;
  return {
    ouverture: { exercice: ouverture?.exerciceSuivant?.id ?? ouverture?.exercice?.id ?? Object.keys(ouverture ?? {}) },
    periode: { statut: periode.statut, corps: periode.statut < 400 ? undefined : periode.corps },
    sansReport: { statut: sansReport.statut, motif: sansReport.corps?.message },
    avecReport: { statut: avecReport.statut, reportee, motif: avecReport.statut < 400 ? undefined : avecReport.corps?.message },
    apercu: apercu.statut < 400 ? apercu.corps : { statut: apercu.statut, corps: apercu.corps },
    cloture: cloture2026,
    apresCloture: { statut: apresCloture.statut, motif: apresCloture.corps?.message },
    dansN1: { statut: dansN1.statut },
    clotureN1AvantN: { statut: clotureN1AvantN.statut, motif: clotureN1AvantN.corps?.message },
    report2027: Object.fromEntries(['40110000', B, '13100000', '10130000'].map((num) => [num, ligne(num) ? { reportDebit: ligne(num).reportDebit, reportCredit: ligne(num).reportCredit, solde: ligne(num).solde } : null])),
    comparaisons: {
      bilan2026: etiqueter('Bilan 2026 après clôture', comparer({ BS: 5_800_000, BZ: 5_800_000, CA: 3_000_000, CJ: 2_300_000, DJ: 500_000, DZ: 5_800_000 }, bilan2026.postes)),
      cr2026: etiqueter('CR 2026 après clôture', comparer({ TA: 4_000_000, RH: -1_700_000, XI: 2_300_000 }, cr2026.postes)),
      bilan2027N1: etiqueter('Bilan 2027, colonne N-1', comparer({ BS: 5_800_000, BZ: 5_800_000, CA: 3_000_000, CJ: 2_300_000, DJ: 500_000, DZ: 5_800_000 }, bilan2027.postes, 'n1')),
      report2027: [
        { etat: 'À-nouveau 2027 (définitif)', ref: '40110000 crédit', attendu: 500_000, omegax: ligne('40110000')?.reportCredit ?? null, ecart: ligne('40110000') ? ligne('40110000').reportCredit - 500_000 : 'ABSENT' },
        { etat: 'À-nouveau 2027 (définitif)', ref: '52110000 débit', attendu: 5_800_000, omegax: ligne(B)?.reportDebit ?? null, ecart: ligne(B) ? ligne(B).reportDebit - 5_800_000 : 'ABSENT' },
      ],
      gestes: [
        { etat: 'Opération d’une période close sans demande de report (refus attendu, motif qui nomme le report)', ref: 'art. 22, 4°', attendu: 'refus 4xx', omegax: sansReport.statut, ecart: sansReport.statut >= 400 && sansReport.statut < 500 ? 0 : 'ACCEPTÉ' },
        { etat: 'Opération d’une période close avec demande de report (acceptée)', ref: 'art. 22, 4°', attendu: 201, omegax: avecReport.statut, ecart: avecReport.statut < 300 ? 0 : avecReport.statut - 201 },
        { etat: 'Date de l’opération reportée', ref: 'date', attendu: '2026-12-01', omegax: reportee?.date?.slice(0, 10) ?? null, ecart: reportee?.date?.slice(0, 10) === '2026-12-01' ? 0 : 'DIFFÉRENT' },
        { etat: 'Date de valeur mentionnée distinctement', ref: 'dateValeur', attendu: '2026-11-15', omegax: reportee?.dateValeur?.slice(0, 10) ?? null, ecart: reportee?.dateValeur?.slice(0, 10) === '2026-11-15' ? 0 : 'DIFFÉRENT' },
        { etat: 'Charge omise de N après la clôture de N, passée en N+1 (acceptée)', ref: 'Titre V', attendu: 201, omegax: dansN1.statut, ecart: dansN1.statut < 300 ? 0 : dansN1.statut - 201 },
        { etat: 'Clôture de N+1 avant N (refus attendu)', ref: 'clôture dans l’ordre', attendu: 400, omegax: clotureN1AvantN.statut, ecart: clotureN1AvantN.statut === 400 ? 0 : clotureN1AvantN.statut - 400 },
      ],
    },
  };
});

// --- C08 · SYSCOHADA, Système minimal de trésorerie, entreprise individuelle -

const C08_BILAN_2026 = { SA1: 800_000, SA2: 700_000, SA3: 500_000, SA4: 1_800_000, SA5: 0, SAZ: 3_800_000, SP1: 2_000_000, SP2: 1_500_000, SP3: 0, SP4: 300_000, SPZ: 3_800_000 };
const C08_CR_2026 = { SR1: 6_000_000, SR2: 0, SRA: 6_000_000, SD1: 3_500_000, SD2: 600_000, SD3: 800_000, SD4: 100_000, SD5: 0, SD6: 0, SDB: 5_000_000, SC: 1_000_000, SG: 1_500_000 };
const C08_BILAN_2027 = { SA1: 400_000, SA2: 900_000, SA3: 200_000, SA4: 2_800_000, SA5: 0, SAZ: 4_300_000, SP1: 3_000_000, SP2: 900_000, SP3: 0, SP4: 400_000, SPZ: 4_300_000 };
const C08_CR_2027 = { SR1: 7_000_000, SR2: 0, SRA: 7_000_000, SD1: 4_000_000, SD2: 600_000, SD3: 900_000, SD4: 0, SD5: 0, SD6: 0, SDB: 5_500_000, SC: 1_500_000, SG: 900_000 };

cas('C08', 'SYSCOHADA Système minimal de trésorerie · entreprise individuelle, deux exercices et deux clôtures, journal de trésorerie', async () => {
  const c = await dossier('Cas clôture C08 SMT', {
    referentiel: 'SYSCOHADA', systeme: 'MINIMAL_TRESORERIE', forme: 'ENTREPRISE_INDIVIDUELLE', exercice: ['2026-01-01', '2026-12-31'],
  });
  const K = '57110000';
  const n = c.exercices.get('2026');
  const e = (ex, d, l, lignes) => ecriture(c, ex, d, l, lignes);
  await e(n, '2026-01-02', 'Apport de l’exploitant', [[K, 2_000_000, 0], ['10300000', 0, 2_000_000]]);
  await e(n, '2026-01-10', 'Achat de matériel', [['24410000', 1_200_000, 0], [K, 0, 1_200_000]]);
  await e(n, '2026-06-30', 'Ventes encaissées', [[K, 6_000_000, 0], ['70110000', 0, 6_000_000]]);
  await e(n, '2026-06-30', 'Achats payés', [['60110000', 3_500_000, 0], [K, 0, 3_500_000]]);
  await e(n, '2026-06-30', 'Loyer', [['62220000', 600_000, 0], [K, 0, 600_000]]);
  await e(n, '2026-06-30', 'Salaires', [['66110000', 800_000, 0], [K, 0, 800_000]]);
  await e(n, '2026-06-30', 'Impôts et taxes', [['64110000', 100_000, 0], [K, 0, 100_000]]);
  // Inventaire extra-comptable de fin d'exercice (Titre X ch. 1 § 1).
  await e(n, '2026-12-31', 'Créances clients à la clôture', [['41110000', 500_000, 0], ['70110000', 0, 500_000]]);
  await e(n, '2026-12-31', 'Dettes fournisseurs à la clôture', [['60110000', 300_000, 0], ['40110000', 0, 300_000]]);
  await e(n, '2026-12-31', 'Stock final', [['31110000', 700_000, 0], ['60310000', 0, 700_000]]);
  await e(n, '2026-12-31', 'Amortissement linéaire sans prorata (Titre X ch. 1 § 1)', [['68130000', 400_000, 0], ['28440000', 0, 400_000]]);
  await valider(c, n, '2026-12-31');
  const bilan2026 = aplatirTout(await etatSys(c, n, 'smt/bilan'));
  const crBrut2026 = await etatSys(c, n, 'smt/compte-de-resultat');
  const cr2026 = aplatirTout(crBrut2026);
  const journal2026 = await etatSys(c, n, 'smt/journal-tresorerie');
  const cloture2026 = await cloturer(c, '2026');
  const n1 = c.exercices.get('2027');
  await rechargerComptes(c);
  const affectation = await c.req('POST', '/affectation-resultat', {
    exerciceId: n, dateDecision: '2027-03-31', organe: 'Exploitant', lignes: [{ compteId: idCompte(c, '10300000'), montant: 1_500_000 }],
  });
  await e(n1, '2027-02-10', 'Encaissement de la créance 2026', [[K, 500_000, 0], ['41110000', 0, 500_000]]);
  await e(n1, '2027-02-10', 'Paiement de la dette 2026', [['40110000', 300_000, 0], [K, 0, 300_000]]);
  await e(n1, '2027-06-30', 'Ventes encaissées', [[K, 6_500_000, 0], ['70110000', 0, 6_500_000]]);
  await e(n1, '2027-06-30', 'Achats payés', [['60110000', 3_700_000, 0], [K, 0, 3_700_000]]);
  await e(n1, '2027-06-30', 'Loyer', [['62220000', 600_000, 0], [K, 0, 600_000]]);
  await e(n1, '2027-06-30', 'Salaires', [['66110000', 900_000, 0], [K, 0, 900_000]]);
  await e(n1, '2027-09-30', 'Prélèvement de l’exploitant', [['10480000', 500_000, 0], [K, 0, 500_000]]);
  await e(n1, '2027-12-31', 'Créances clients à la clôture', [['41110000', 200_000, 0], ['70110000', 0, 200_000]]);
  await e(n1, '2027-12-31', 'Dettes fournisseurs à la clôture', [['60110000', 400_000, 0], ['40110000', 0, 400_000]]);
  await e(n1, '2027-12-31', 'Annulation du stock initial', [['60310000', 700_000, 0], ['31110000', 0, 700_000]]);
  await e(n1, '2027-12-31', 'Stock final', [['31110000', 900_000, 0], ['60310000', 0, 900_000]]);
  await e(n1, '2027-12-31', 'Amortissement linéaire sans prorata', [['68130000', 400_000, 0], ['28440000', 0, 400_000]]);
  await valider(c, n1, '2027-12-31');
  // N3 et N4 · le paiement de la dette 2026 lettré avec sa ligne d'à-nouveau ·
  // il prend la ligne de la facture qu'il règle (achats, SD1).
  const dette2026 = (await lignesOuvertes(c, '40110000'))
    .filter((l) => montantLigne(l) === 300_000 && dateLigne(l) >= '2027-01-01' && dateLigne(l) <= '2027-02-10')
    .map((l) => l.id);
  const lettrageDette = await c.req('POST', `/comptes/${idCompte(c, '40110000')}/lettrage`, { ligneIds: dette2026 });
  const bilan2027 = aplatirTout(await etatSys(c, n1, 'smt/bilan'));
  const crBrut2027 = await etatSys(c, n1, 'smt/compte-de-resultat');
  const cr2027 = aplatirTout(crBrut2027);
  const journal2027 = await etatSys(c, n1, 'smt/journal-tresorerie');
  const cloture2027 = await cloturer(c, '2027');
  const bilan2027Apres = aplatirTout(await etatSys(c, n1, 'smt/bilan'));
  const cr2027Apres = aplatirTout(await etatSys(c, n1, 'smt/compte-de-resultat'));
  const resumeJournal = (j) => (j.journaux ?? []).map((x) => ({ compte: x.compte?.numero ?? x.numero, report: x.reportANouveau, recettes: x.totalRecettes ?? x.totaux?.recettes, depenses: x.totalDepenses ?? x.totaux?.depenses, solde: x.soldeAReporter ?? x.solde, ventilation: x.totauxVentilation ?? x.ventilation }));
  return {
    clotures: { 2026: cloture2026, 2027: cloture2027 },
    affectation: { statut: affectation.statut, motif: affectation.statut < 400 ? undefined : affectation.corps?.message },
    lettrageDette2026: { statut: lettrageDette.statut, lignes: dette2026.length, motif: lettrageDette.statut < 400 ? undefined : lettrageDette.corps?.message },
    lu: {
      reglementsNonRattaches2027: crBrut2027.reglementsNonRattaches,
      variations2026: Object.fromEntries(['SV1', 'SV2', 'SV3', 'SF'].map((r) => [r, cr2026[r]])),
      variations2027: Object.fromEntries(['SV1', 'SV2', 'SV3', 'SF'].map((r) => [r, cr2027[r]])),
      controles: { 2026: crBrut2026.controle ?? crBrut2026.concordance, 2027: crBrut2027.controle ?? crBrut2027.concordance },
      journal2026: resumeJournal(journal2026), journal2027: resumeJournal(journal2027),
      journalBrut2026: JSON.stringify(journal2026).slice(0, 1500),
    },
    comparaisons: {
      bilan2026: etiqueter('Bilan SMT 2026', comparer(C08_BILAN_2026, bilan2026)),
      cr2026: etiqueter('CR SMT 2026', comparer(C08_CR_2026, cr2026)),
      bilan2027: etiqueter('Bilan SMT 2027', comparer(C08_BILAN_2027, bilan2027)),
      bilan2027N1: etiqueter('Bilan SMT 2027, colonne N-1', comparer(C08_BILAN_2026, bilan2027, 'n1')),
      cr2027: etiqueter('CR SMT 2027', comparer(C08_CR_2027, cr2027)),
      cr2027N1: etiqueter('CR SMT 2027, colonne N-1', comparer(C08_CR_2026, cr2027, 'n1')),
      bilan2027Apres: etiqueter('Bilan SMT 2027 après clôture', comparer(C08_BILAN_2027, bilan2027Apres)),
      cr2027Apres: etiqueter('CR SMT 2027 après clôture', comparer(C08_CR_2027, cr2027Apres)),
    },
  };
});

// --- C09 · SYCEBNL, associations · fonds affectés, subvention reprise, classe 9

const C09_BILAN_2026 = {
  AM: 3_000_000, AH: 3_000_000, AZ: 3_000_000, BD: 500_000, BT: 500_000, BW: 6_900_000, BX: 6_900_000, BZ: 10_400_000,
  CA: 5_000_000, CH: 1_300_000, CI: 3_000_000, CK: 9_300_000, CW: 800_000, CY: 800_000, CZ: 10_100_000, DE: 10_100_000,
  DH: 300_000, DV: 300_000, DZ: 10_400_000,
};
const C09_CR_2026 = { RA: 3_000_000, RC: 1_000_000, RH: 2_200_000, XA: 6_200_000, TA: 1_200_000, TD: 300_000, TG: 600_000, TJ: 1_800_000, TL: 1_000_000, XB: 4_900_000, XC: 1_300_000, XD: 0, XE: 1_300_000 };
const C09_TFT_2026 = { ZA: 0, FA: 2_500_000, FB: 0, FC: 1_000_000, FD: 0, FE: 0, FF: -1_800_000, FG: -1_800_000, FH: 0, ZB: -100_000, FI: -4_000_000, FJ: 0, FK: 0, FL: 0, ZC: -4_000_000, FM: 7_000_000, FN: 4_000_000, FO: 0, ZD: 11_000_000, FP: 0, FQ: 0, ZE: 0, ZF: 6_900_000, ZG: 6_900_000 };
const C09_BILAN_2027 = {
  AM: 2_000_000, AH: 2_000_000, AZ: 2_000_000, BD: 700_000, BT: 700_000, BW: 7_700_000, BX: 7_700_000, BZ: 10_400_000,
  CA: 5_000_000, CF: 300_000, CG: 1_000_000, CH: 1_700_000, CI: 2_000_000, CK: 10_000_000, CW: 0, CY: 0, CZ: 10_000_000, DE: 10_000_000,
  DH: 400_000, DV: 400_000, DZ: 10_400_000,
};
const C09_CR_2027 = { RA: 3_200_000, RC: 1_500_000, RH: 1_800_000, XA: 6_500_000, TA: 800_000, TD: 400_000, TG: 600_000, TJ: 2_000_000, TL: 1_000_000, XB: 4_800_000, XC: 1_700_000, XD: 0, XE: 1_700_000 };
const C09_TFT_2027 = { ZA: 6_900_000, FA: 3_000_000, FB: 0, FC: 1_500_000, FD: 0, FE: 0, FF: -1_700_000, FG: -2_000_000, FH: 0, ZB: 800_000, FI: 0, ZC: 0, FM: 0, FN: 0, FO: 0, ZD: 0, FP: 0, FQ: 0, ZE: 0, ZF: 800_000, ZG: 7_700_000 };

cas('C09', 'SYCEBNL associations · fonds affectés (165), subvention d’investissement reprise (14 au 799), contributions en nature (classe 9), deux clôtures', async () => {
  const c = await dossier('Cas clôture C09 Association', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', exercice: ['2026-01-01', '2026-12-31'],
  });
  const B = '52110000';
  const n = c.exercices.get('2026');
  const e = (ex, d, l, lignes) => ecriture(c, ex, d, l, lignes);
  await e(n, '2026-01-05', 'Dotation non consomptible des fondateurs', [[B, 5_000_000, 0], ['10110000', 0, 5_000_000]]);
  await e(n, '2026-01-31', 'Appel des cotisations', [['41100000', 3_000_000, 0], ['70100000', 0, 3_000_000]]);
  await e(n, '2026-03-31', 'Encaissement des cotisations', [[B, 2_500_000, 0], ['41100000', 0, 2_500_000]]);
  await e(n, '2026-04-15', 'Dons manuels', [[B, 1_000_000, 0], ['70410000', 0, 1_000_000]]);
  await e(n, '2026-01-15', 'Subvention d’équipement reçue', [[B, 4_000_000, 0], ['14170000', 0, 4_000_000]]);
  await e(n, '2026-01-20', 'Achat du véhicule', [['24510000', 4_000_000, 0], [B, 0, 4_000_000]]);
  await e(n, '2026-02-01', 'Fonds affectés à un projet spécifique', [[B, 2_000_000, 0], ['16500000', 0, 2_000_000]]);
  await e(n, '2026-06-30', 'Kits distribués (projet spécifique)', [['60110000', 1_200_000, 0], [B, 0, 1_200_000]]);
  await e(n, '2026-06-30', 'Consommation des fonds affectés', [['16500000', 1_200_000, 0], ['79250000', 0, 1_200_000]]);
  await e(n, '2026-12-31', 'Salaires', [['66110000', 1_800_000, 0], [B, 0, 1_800_000]]);
  await e(n, '2026-12-31', 'Loyer', [['62220000', 600_000, 0], [B, 0, 600_000]]);
  await e(n, '2026-11-30', 'Fournitures de bureau', [['60470000', 300_000, 0], ['40110000', 0, 300_000]]);
  await e(n, '2026-12-31', 'Dotation aux amortissements', [['68130000', 1_000_000, 0], ['28450000', 0, 1_000_000]]);
  await e(n, '2026-12-31', 'Reprise de la subvention d’investissement', [['14170000', 1_000_000, 0], ['79900000', 0, 1_000_000]]);
  await e(n, '2026-12-31', 'Locaux mis à disposition gratuitement', [['90100000', 500_000, 0], ['91100000', 0, 500_000]]);
  await e(n, '2026-12-31', 'Bénévolat valorisé', [['90400000', 900_000, 0], ['91400000', 0, 900_000]]);
  await valider(c, n, '2026-12-31');
  const bilan2026 = aplatirTout(await etatSyc(c, n, 'bilan'));
  const bilanBrut2026 = await etatSyc(c, n, 'bilan');
  const cr2026 = await crSycebnl(c, n);
  const tftBrut2026 = await etatSyc(c, n, 'tableau-flux-tresorerie');
  const tft2026 = aplatirTout(tftBrut2026);
  const controles2026 = codesControles(await controles(c, n));
  const cloture2026 = await cloturer(c, '2026');
  const n1 = c.exercices.get('2027');
  await rechargerComptes(c);
  const methode = await c.req('PATCH', '/dossier/methode-cotisations', { methodeCotisations: 'APPEL' });
  const affectation = await c.req('POST', '/affectation-resultat', {
    exerciceId: n, dateDecision: '2027-06-30', organe: 'Assemblée générale',
    lignes: [{ compteId: idCompte(c, '11800000'), montant: 300_000 }, { compteId: idCompte(c, '12100000'), montant: 1_000_000 }],
  });
  await e(n1, '2027-01-31', 'Appel des cotisations', [['41100000', 3_200_000, 0], ['70100000', 0, 3_200_000]]);
  await e(n1, '2027-03-31', 'Encaissement des cotisations', [[B, 3_000_000, 0], ['41100000', 0, 3_000_000]]);
  await e(n1, '2027-04-15', 'Dons manuels', [[B, 1_500_000, 0], ['70410000', 0, 1_500_000]]);
  await e(n1, '2027-05-31', 'Kits distribués (projet spécifique)', [['60110000', 800_000, 0], [B, 0, 800_000]]);
  await e(n1, '2027-05-31', 'Consommation des fonds affectés', [['16500000', 800_000, 0], ['79250000', 0, 800_000]]);
  await e(n1, '2027-01-15', 'Règlement du fournisseur 2026', [['40110000', 300_000, 0], [B, 0, 300_000]]);
  await e(n1, '2027-11-30', 'Fournitures de bureau', [['60470000', 400_000, 0], ['40110000', 0, 400_000]]);
  await e(n1, '2027-12-31', 'Salaires', [['66110000', 2_000_000, 0], [B, 0, 2_000_000]]);
  await e(n1, '2027-12-31', 'Loyer', [['62220000', 600_000, 0], [B, 0, 600_000]]);
  await e(n1, '2027-12-31', 'Dotation aux amortissements', [['68130000', 1_000_000, 0], ['28450000', 0, 1_000_000]]);
  await e(n1, '2027-12-31', 'Reprise de la subvention d’investissement', [['14170000', 1_000_000, 0], ['79900000', 0, 1_000_000]]);
  await e(n1, '2027-12-31', 'Bénévolat valorisé', [['90400000', 1_000_000, 0], ['91400000', 0, 1_000_000]]);
  await valider(c, n1, '2027-12-31');
  const bilan2027 = aplatirTout(await etatSyc(c, n1, 'bilan'));
  const cr2027 = await crSycebnl(c, n1);
  const tftBrut2027 = await etatSyc(c, n1, 'tableau-flux-tresorerie');
  const tft2027 = aplatirTout(tftBrut2027);
  const controles2027 = codesControles(await controles(c, n1));
  const cloture2027 = await cloturer(c, '2027');
  const bilan2027Apres = aplatirTout(await etatSyc(c, n1, 'bilan'));
  const cr2027Apres = await crSycebnl(c, n1);
  const notes2026 = await c.req('GET', `/notes-annexes?exerciceId=${n}`);
  // N5 · les contributions volontaires (90, 91) ne se reportent pas · 2027 les
  // lit au seul mouvement de l'année.
  const balance2027 = await c.ok('GET', `/ecritures/balance?exerciceId=${n1}`);
  const reportDe = (num) => {
    const l = (balance2027.lignes ?? []).find((x) => x.numero === num);
    return l ? Number(l.reportDebit ?? 0) + Number(l.reportCredit ?? 0) : 0;
  };
  const classe9NonVentilee = (t) => (t.comptesNonVentiles ?? []).some((x) => String(x.numero ?? x).startsWith('9'));
  const methodeCot = (codes) => (codes.includes('METHODE_COTISATIONS_NON_PRECISEE') ? 1 : 0);
  const sansClasse9 = (b) => !(b.comptesNonRattaches ?? []).some((x) => x.numero?.startsWith('9'));
  return {
    clotures: { 2026: cloture2026, 2027: cloture2027 },
    methode: methode.statut, affectation: { statut: affectation.statut, motif: affectation.statut < 400 ? undefined : affectation.corps?.message },
    controles: { 2026: controles2026, 2027: controles2027 },
    lu: {
      bilan2026: { nonRattaches: bilanBrut2026.comptesNonRattaches, controle: bilanBrut2026.controle, cles: Object.keys(bilanBrut2026) },
      tft2026: { controle: tftBrut2026.controle, nonVentiles: tftBrut2026.comptesNonVentiles, nonCalculables: tftBrut2026.postesNonCalculables, cles: Object.keys(tftBrut2026) },
      tft2027: { controle: tftBrut2027.controle, nonVentiles: tftBrut2027.comptesNonVentiles, nonCalculablesN1: tftBrut2027.postesNonCalculablesN1 },
      notes: notes2026.statut,
    },
    comparaisons: {
      bilan2026: etiqueter('Bilan 2026', comparer(C09_BILAN_2026, bilan2026)),
      cr2026: etiqueter('CR 2026', comparer(C09_CR_2026, cr2026)),
      tft2026: etiqueter('TFT 2026', comparer(C09_TFT_2026, tft2026)),
      bilan2027: etiqueter('Bilan 2027', comparer(C09_BILAN_2027, bilan2027)),
      bilan2027N1: etiqueter('Bilan 2027, colonne N-1', comparer(C09_BILAN_2026, bilan2027, 'n1')),
      cr2027: etiqueter('CR 2027', comparer(C09_CR_2027, cr2027)),
      cr2027N1: etiqueter('CR 2027, colonne N-1', comparer(C09_CR_2026, cr2027, 'n1')),
      tft2027: etiqueter('TFT 2027', comparer(C09_TFT_2027, tft2027)),
      tft2027N1: etiqueter('TFT 2027, colonne N-1', comparer(C09_TFT_2026, tft2027, 'n1')),
      bilan2027Apres: etiqueter('Bilan 2027 après clôture', comparer(C09_BILAN_2027, bilan2027Apres)),
      cr2027Apres: etiqueter('CR 2027 après clôture', comparer(C09_CR_2027, cr2027Apres)),
      gestes: [
        { etat: 'Méthode des cotisations non déclarée en 2026 (doit se lever)', ref: 'METHODE_COTISATIONS_NON_PRECISEE', attendu: 1, omegax: methodeCot(controles2026), ecart: methodeCot(controles2026) - 1 },
        { etat: 'Méthode déclarée (APPEL) en 2027 (doit se taire)', ref: 'METHODE_COTISATIONS_NON_PRECISEE', attendu: 0, omegax: methodeCot(controles2027), ecart: methodeCot(controles2027) },
        { etat: 'Classe 9 hors bilan (aucun compte 9 non rattaché)', ref: 'classe 9', attendu: 1, omegax: sansClasse9(bilanBrut2026) ? 1 : 0, ecart: sansClasse9(bilanBrut2026) ? 0 : -1 },
        { etat: 'Affectation de l’excédent (11 et 12)', ref: 'SYCEBNL compte 13', attendu: 201, omegax: affectation.statut, ecart: affectation.statut < 300 ? 0 : affectation.statut - 201 },
        verifie('TFT 2026 · aucun compte de classe 9 « non ventilé »', 'N5 · classe 9', 0, classe9NonVentilee(tftBrut2026)),
        verifie('TFT 2027 · aucun compte de classe 9 « non ventilé »', 'N5 · classe 9', 0, classe9NonVentilee(tftBrut2027)),
        verifie('Balance 2027 · le 904 sans report', 'N5 · 90400000', 0, reportDe('90400000') > 0.005),
        verifie('Balance 2027 · le 914 sans report', 'N5 · 91400000', 0, reportDe('91400000') > 0.005),
      ],
    },
  };
});

// --- C10 · SYCEBNL, projet de développement · emplois-ressources et budget ---

/** Lignes non lettrées d'un compte, pour désigner celles d'un lettrage. */
async function lignesOuvertes(c, numero) {
  const r = await c.ok('GET', `/comptes/${idCompte(c, numero)}/lettrage?nonLettreesSeulement=true`);
  return Array.isArray(r) ? r : (r.lignes ?? []);
}
const montantLigne = (l) => Number(l.debit ?? 0) || Number(l.credit ?? 0);
const dateLigne = (l) => String(l.date ?? l.ecriture?.date ?? '').slice(0, 10);

// Q2 · le 57100000 est DÉCLARÉ porter la contrepartie de l'État · FV et FY le lisent.
const C10_ER_2026 = { FA: 13_000_000, FC: 1_000_000, FD: 0, GR: 14_000_000, FJ: 3_000_000, GS: 3_000_000, FM: 1_500_000, FN: 400_000, FO: 1_000_000, FP: 100_000, FR: 3_000_000, GT: 6_000_000, GU: 9_000_000, GV: 5_000_000, FU: 0, FV: 0, FW: 0, GW: 0, GX: 5_000_000, FX: 4_000_000, FY: 1_000_000, FZ: 0, GY: 5_000_000 };
const C10_ER_2027_EXERCICE = { FA: 6_000_000, FC: 0, GR: 6_000_000, FJ: 0, GS: 0, FM: 1_500_000, FO: 800_000, FR: 3_000_000, GT: 5_300_000, GU: 5_300_000, GV: 700_000, FU: 4_000_000, FV: 1_000_000, FW: 0, GW: 5_000_000, GX: 5_700_000, FX: 4_700_000, FY: 1_000_000, FZ: 0, GY: 5_700_000 };
const C10_ER_2027_DEBUT = { FA: 13_000_000, FC: 1_000_000, GR: 14_000_000, FJ: 3_000_000, FM: 1_500_000, FO: 1_000_000, FR: 3_000_000, GT: 6_000_000, GU: 9_000_000, GV: 5_000_000, GW: 0, GX: 5_000_000, FX: 4_000_000, FY: 1_000_000, FZ: 0, GY: 5_000_000 };
const C10_ER_2027_FIN = { FA: 19_000_000, FC: 1_000_000, GR: 20_000_000, FJ: 3_000_000, FM: 3_000_000, FN: 400_000, FO: 1_800_000, FP: 100_000, FR: 6_000_000, GT: 11_300_000, GU: 14_300_000, GV: 5_700_000, GW: 0, GX: 5_700_000, FX: 4_700_000, FY: 1_000_000, FZ: 0, GY: 5_700_000 };

/** Une colonne du tableau emplois-ressources, aplatie par REF. */
function colonneER(etat, cle) {
  const m = {};
  const visiter = (o) => {
    if (Array.isArray(o)) return o.forEach(visiter);
    if (o && typeof o === 'object') {
      if (typeof o.ref === 'string' && o.ref && cle in o) m[o.ref] = { n: o[cle] };
      Object.values(o).forEach((v) => v && typeof v === 'object' && visiter(v));
    }
  };
  visiter(etat);
  return m;
}

/** Tableau d'exécution budgétaire · une ligne par code de section. */
function lignesBudget(etat) {
  const m = {};
  for (const l of etat.lignes ?? []) m[l.code] = l;
  return m;
}

cas('C10', 'SYCEBNL projet de développement · emplois-ressources à trois colonnes et exécution budgétaire sur deux exercices', async () => {
  const c = await dossier('Cas clôture C10 Projet', {
    referentiel: 'SYCEBNL', jeu: 'PROJETS_DEVELOPPEMENT', exercice: ['2026-01-01', '2026-12-31'],
  });
  const B = '52110000';
  const K = '57100000';
  const n = c.exercices.get('2026');
  // Bailleur et comptes qui portent ses fonds (Compte.bailleurId).
  const bailleur = await c.ok('POST', '/bailleurs', { code: 'BM', nom: 'Bailleur multilatéral' });
  for (const num of ['16200000', '46200000', B]) await c.ok('PATCH', `/comptes/${idCompte(c, num)}`, { bailleurId: bailleur.id });
  // Q2 · la caisse porte la contrepartie de l'État, déclarée par le cabinet ;
  // la banque du bailleur la refuse (un compte, une nature de fonds).
  const contrepartie = await c.req('PATCH', `/comptes/${idCompte(c, K)}`, { porteFondsContrepartieEtat: true });
  const contrepartieSurBailleur = await c.req('PATCH', `/comptes/${idCompte(c, B)}`, { porteFondsContrepartieEtat: true });
  // Nomenclature budgétaire du projet · un plan analytique à budgets.
  const plan = await c.ok('POST', '/analytique/plans', { code: 'BUD', intitule: 'Nomenclature budgétaire', classesVentilees: '6', gererBudgets: true });
  const section = {};
  for (const [code, intitule] of [['B1', 'Fournitures'], ['B2', 'Transports'], ['B3', 'Services'], ['B4', 'Personnel']]) {
    section[code] = (await c.ok('POST', `/analytique/plans/${plan.id}/sections`, { code, intitule })).id;
  }
  const doter = async (ex, code, montant) => c.ok('POST', `/analytique/sections/${section[code]}/budget`, { exerciceId: ex, montantAnnuel: montant });
  await doter(n, 'B1', 2_500_000); await doter(n, 'B2', 500_000); await doter(n, 'B3', 1_200_000); await doter(n, 'B4', 3_200_000);
  const v = (code, montant) => [{ sectionId: section[code], debit: montant }];
  const e = (ex, d, l, lignes) => ecriture(c, ex, d, l, lignes);
  await e(n, '2026-01-05', 'Fonds d’investissement du bailleur', [[B, 3_000_000, 0], ['16200000', 0, 3_000_000]]);
  await e(n, '2026-01-05', 'Fonds d’administration du bailleur', [[B, 10_000_000, 0], ['46200000', 0, 10_000_000]]);
  await e(n, '2026-01-20', 'Fonds de contrepartie de l’État', [[K, 1_000_000, 0], ['46300000', 0, 1_000_000]]);
  await e(n, '2026-02-01', 'Véhicule du projet', [['24510000', 3_000_000, 0], ['48120000', 0, 3_000_000]]);
  await e(n, '2026-02-10', 'Règlement du véhicule', [['48120000', 3_000_000, 0], [B, 0, 3_000_000]]);
  await e(n, '2026-03-31', 'Facture A · fournitures', [['60110000', 1_500_000, 0, v('B1', 1_500_000)], ['40110000', 0, 1_500_000]]);
  await e(n, '2026-04-30', 'Règlement de la facture A', [['40110000', 1_500_000, 0], [B, 0, 1_500_000]]);
  await e(n, '2026-11-30', 'Facture B · fournitures (impayée à la clôture)', [['60110000', 500_000, 0, v('B1', 500_000)], ['40110000', 0, 500_000]]);
  await e(n, '2026-06-30', 'Transports', [['61810000', 400_000, 0, v('B2', 400_000)], [B, 0, 400_000]]);
  await e(n, '2026-06-30', 'Prestataires', [['63270000', 1_000_000, 0, v('B3', 1_000_000)], [B, 0, 1_000_000]]);
  await e(n, '2026-12-31', 'Salaires', [['66110000', 3_000_000, 0, v('B4', 3_000_000)], [B, 0, 3_000_000]]);
  await e(n, '2026-12-31', 'Taxes sur salaires', [['64130000', 100_000, 0, v('B4', 100_000)], [B, 0, 100_000]]);
  await e(n, '2026-12-31', 'Fonds d’administration transférés (Application 8)', [['46200000', 6_500_000, 0], ['70200000', 0, 6_500_000]]);
  await valider(c, n, '2026-12-31');
  // Facture A lettrée avec son règlement · elle devient décaissement (B reste un engagement).
  const ouvertes401 = await lignesOuvertes(c, '40110000');
  const a = ouvertes401.filter((l) => montantLigne(l) === 1_500_000).map((l) => l.id);
  const lettrageA = await c.req('POST', `/comptes/${idCompte(c, '40110000')}/lettrage`, { ligneIds: a });
  const er2026 = await etatSyc(c, n, 'projet/emplois-ressources');
  const budget2026 = await etatSyc(c, n, 'projet/execution-budgetaire');
  const ce2026 = await etatSyc(c, n, 'projet/compte-exploitation');
  const cloture2026 = await cloturer(c, '2026');
  const n1 = c.exercices.get('2027');
  await doter(n1, 'B1', 1_200_000); await doter(n1, 'B3', 1_000_000); await doter(n1, 'B4', 3_000_000);
  await e(n1, '2027-01-10', 'Fonds d’administration du bailleur', [[B, 6_000_000, 0], ['46200000', 0, 6_000_000]]);
  await e(n1, '2027-01-20', 'Règlement de la facture B de 2026', [['40110000', 500_000, 0], [B, 0, 500_000]]);
  await e(n1, '2027-03-31', 'Fournitures au comptant', [['60110000', 1_000_000, 0, v('B1', 1_000_000)], [B, 0, 1_000_000]]);
  await e(n1, '2027-06-30', 'Prestataires', [['63270000', 800_000, 0, v('B3', 800_000)], [B, 0, 800_000]]);
  await e(n1, '2027-12-31', 'Salaires', [['66110000', 3_000_000, 0, v('B4', 3_000_000)], [B, 0, 3_000_000]]);
  await e(n1, '2027-12-31', 'Fonds d’administration transférés', [['46200000', 4_800_000, 0], ['70200000', 0, 4_800_000]]);
  await valider(c, n1, '2027-12-31');
  const ouvertes2027 = await lignesOuvertes(c, '40110000');
  const b = ouvertes2027.filter((l) => montantLigne(l) === 500_000 && dateLigne(l) >= '2027-01-01').map((l) => l.id);
  const lettrageB = await c.req('POST', `/comptes/${idCompte(c, '40110000')}/lettrage`, { ligneIds: b });
  const er2027 = await etatSyc(c, n1, 'projet/emplois-ressources');
  const budget2027 = await etatSyc(c, n1, 'projet/execution-budgetaire');
  const budget2026Relu = await etatSyc(c, n, 'projet/execution-budgetaire');
  const cloture2027 = await cloturer(c, '2027');
  const er2027Apres = await etatSyc(c, n1, 'projet/emplois-ressources');

  const cle = (etat) => Object.keys(etat?.lignes?.[0] ?? etat ?? {});
  const bud26 = lignesBudget(budget2026);
  const bud27 = lignesBudget(budget2027);
  const bud26r = lignesBudget(budget2026Relu);
  const ligneBud = (etat, code, champ) => (etat[code] ? etat[code][champ] : null);
  const cmpBud = (nom, etat, attendu) =>
    Object.entries(attendu).flatMap(([code, champs]) =>
      Object.entries(champs).map(([champ, montant]) => {
        const omegax = ligneBud(etat, code, champ);
        return { etat: nom, ref: `${code}.${champ}`, attendu: montant, omegax, ecart: omegax === null || omegax === undefined ? 'ABSENT' : Math.round((omegax - montant) * 100) / 100 };
      }),
    );
  return {
    clotures: { 2026: cloture2026, 2027: cloture2027 },
    lettrages: { A: lettrageA.statut, B: { statut: lettrageB.statut, lignes: b.length, motif: lettrageB.statut < 400 ? undefined : lettrageB.corps?.message } },
    lu: {
      clesER: cle(er2026), clesBudget: cle(budget2026),
      fondsDisponibles2026: Object.fromEntries(['FU', 'FV', 'FW', 'FX', 'FY', 'FZ'].map((r) => [r, colonneER(er2026, 'exerciceN')[r] ?? colonneER(er2026, 'montant')[r]])),
      compteExploitation2026: JSON.stringify(ce2026).slice(0, 600),
      budget2026: budget2026.lignes, budget2027: budget2027.lignes, budget2026Relu: budget2026Relu.lignes,
    },
    comparaisons: {
      er2026: etiqueter('Emplois-ressources 2026, exercice', comparer(C10_ER_2026, colonneER(er2026, 'montant'))),
      er2026Fin: etiqueter('Emplois-ressources 2026, cumul fin', comparer(C10_ER_2026, colonneER(er2026, 'montantCumulFin'))),
      er2027: etiqueter('Emplois-ressources 2027, exercice', comparer(C10_ER_2027_EXERCICE, colonneER(er2027, 'montant'))),
      er2027Debut: etiqueter('Emplois-ressources 2027, cumul début', comparer(C10_ER_2027_DEBUT, colonneER(er2027, 'montantCumulDebut'))),
      er2027Fin: etiqueter('Emplois-ressources 2027, cumul fin', comparer(C10_ER_2027_FIN, colonneER(er2027, 'montantCumulFin'))),
      er2027Apres: etiqueter('Emplois-ressources 2027 après clôture, exercice', comparer(C10_ER_2027_EXERCICE, colonneER(er2027Apres, 'montant'))),
      budget2026: cmpBud('Exécution budgétaire 2026', bud26, {
        B1: { budget: 2_500_000, decaissement: 1_500_000, engagement: 500_000, realisation: 2_000_000, creditDisponible: 500_000 },
        B2: { budget: 500_000, decaissement: 400_000, engagement: 0, realisation: 400_000, creditDisponible: 100_000 },
        B3: { budget: 1_200_000, decaissement: 1_000_000, engagement: 0, realisation: 1_000_000, creditDisponible: 200_000 },
        B4: { budget: 3_200_000, decaissement: 3_100_000, engagement: 0, realisation: 3_100_000, creditDisponible: 100_000 },
      }),
      budget2027: cmpBud('Exécution budgétaire 2027', bud27, {
        B1: { budget: 1_200_000, decaissement: 1_500_000, engagement: 0, realisation: 1_500_000, creditDisponible: -300_000 },
        B3: { budget: 1_000_000, decaissement: 800_000, engagement: 0, realisation: 800_000, creditDisponible: 200_000 },
        B4: { budget: 3_000_000, decaissement: 3_000_000, engagement: 0, realisation: 3_000_000, creditDisponible: 0 },
      }),
      budget2026Relu: cmpBud('Exécution budgétaire 2026 relue après le règlement de 2027', bud26r, {
        B1: { decaissement: 1_500_000, engagement: 500_000 },
      }),
      gestes: [
        { etat: 'Contrepartie de l’État déclarée sur la caisse', ref: 'Q2 · 57100000', attendu: 200, omegax: contrepartie.statut, ecart: contrepartie.statut === 200 ? 0 : contrepartie.statut - 200 },
        { etat: 'Contrepartie de l’État refusée sur la banque du bailleur', ref: 'Q2 · 52110000', attendu: 400, omegax: contrepartieSurBailleur.statut, ecart: contrepartieSurBailleur.statut === 400 ? 0 : contrepartieSurBailleur.statut - 400 },
        verifie('Emplois-ressources 2026 · aucune dette non rattachée', 'B4', 0, (er2026.avertissements ?? []).some((a) => a.includes('ne se rattache à aucune facture'))),
        verifie('Emplois-ressources 2027 · aucune dette non rattachée', 'B4', 0, (er2027.avertissements ?? []).some((a) => a.includes('ne se rattache à aucune facture'))),
        verifie('Exécution budgétaire 2027 · aucune dépense de 2026 non suivie', 'B3', 0, Boolean(budget2027.engagementsAnterieursNonSuivis)),
      ],
    },
    deductionsER: Object.fromEntries((er2026.lignes ?? []).filter((l) => ['FM', 'FN', 'FO'].includes(l.ref)).map((l) => [l.ref, { correction: l.correction ?? null, nonRattachee: l.correctionNonRattachee ?? null }])),
    avertissementsER: er2026.avertissements,
    avertissementsER2027: er2027.avertissements,
    nonSuivis2027: budget2027.engagementsAnterieursNonSuivis ?? null,
  };
});

// --- C11 · SYCEBNL, Système minimal de trésorerie d'une petite association ---

const C11_BILAN_2026 = { GA: 400_000, GB: 150_000, GC: 300_000, GD: 1_400_000, GE: 0, GZ: 2_250_000, HA: 1_000_000, HB: 1_050_000, HC: 0, HD: 200_000, HZ: 2_250_000 };
const C11_CR_2026 = { KA: 2_000_000, KB: 1_500_000, KX: 3_500_000, JA: 1_200_000, JB: 400_000, JC: 900_000, JF: 0, JX: 2_500_000, KZ: 1_000_000, KZC: 1_050_000 };
const C11_BILAN_2027 = { GA: 200_000, GB: 100_000, GC: 100_000, GD: 2_500_000, GE: 0, GZ: 2_900_000, HA: 1_000_000, HB: 850_000, HC: 1_050_000, HD: 0, HZ: 2_900_000 };
const C11_CR_2027 = { KA: 2_500_000, KB: 1_500_000, KX: 4_000_000, JA: 1_500_000, JB: 400_000, JC: 1_000_000, JF: 0, JX: 2_900_000, KZ: 1_100_000, KZC: 850_000 };

/** Compte de résultat SMT SYCEBNL · lignes, et totaux KX, JX, KZ, KZC en champs nommés. */
function crSmtSycebnl(r) {
  const m = aplatirTout(r);
  const total = (ref, champ) => {
    const v = r[champ];
    m[ref] = { n: v ?? null, n1: r[`${champ}N1`] ?? null };
  };
  total('KX', 'totalRecettes');
  total('JX', 'totalDepenses');
  total('KZ', 'soldeCaisse');
  total('KZC', 'resultatNet');
  return m;
}

cas('C11', 'SYCEBNL Système minimal de trésorerie · petite association, deux exercices et deux clôtures', async () => {
  const c = await dossier('Cas clôture C11 Association SMT', {
    referentiel: 'SYCEBNL', jeu: 'SYSTEME_MINIMAL_TRESORERIE', exercice: ['2026-01-01', '2026-12-31'],
  });
  const K = '57100000';
  const n = c.exercices.get('2026');
  const e = (ex, d, l, lignes) => ecriture(c, ex, d, l, lignes);
  await e(n, '2026-01-05', 'Dotation des membres fondateurs', [[K, 1_000_000, 0], ['10110000', 0, 1_000_000]]);
  await e(n, '2026-01-10', 'Matériel de bureau', [['24410000', 600_000, 0], [K, 0, 600_000]]);
  await e(n, '2026-03-31', 'Cotisations encaissées', [[K, 2_000_000, 0], ['70100000', 0, 2_000_000]]);
  await e(n, '2026-04-30', 'Subvention d’exploitation encaissée', [[K, 1_500_000, 0], ['71100000', 0, 1_500_000]]);
  await e(n, '2026-06-30', 'Achats de biens liés à l’activité', [['60110000', 1_200_000, 0], [K, 0, 1_200_000]]);
  await e(n, '2026-06-30', 'Loyer', [['62220000', 400_000, 0], [K, 0, 400_000]]);
  await e(n, '2026-06-30', 'Salaires', [['66110000', 900_000, 0], [K, 0, 900_000]]);
  await e(n, '2026-12-31', 'Cotisations restant dues', [['41100000', 300_000, 0], ['70100000', 0, 300_000]]);
  await e(n, '2026-12-31', 'Dettes fournisseurs à la clôture', [['60110000', 200_000, 0], ['40110000', 0, 200_000]]);
  await e(n, '2026-12-31', 'Stock final', [['31100000', 150_000, 0], ['60310000', 0, 150_000]]);
  await e(n, '2026-12-31', 'Amortissement', [['68130000', 200_000, 0], ['28440000', 0, 200_000]]);
  await valider(c, n, '2026-12-31');
  const bilan2026 = aplatirTout(await etatSyc(c, n, 'smt/bilan'));
  const cr2026Brut = await etatSyc(c, n, 'smt/compte-de-resultat');
  const cr2026 = crSmtSycebnl(cr2026Brut);
  const cloture2026 = await cloturer(c, '2026');
  const n1 = c.exercices.get('2027');
  await rechargerComptes(c);
  const affectation = await c.req('POST', '/affectation-resultat', {
    exerciceId: n, dateDecision: '2027-03-31', organe: 'Assemblée générale', lignes: [{ compteId: idCompte(c, '12100000'), montant: 1_050_000 }],
  });
  await e(n1, '2027-01-20', 'Cotisations 2026 encaissées', [[K, 300_000, 0], ['41100000', 0, 300_000]]);
  await e(n1, '2027-01-20', 'Règlement du fournisseur 2026', [['40110000', 200_000, 0], [K, 0, 200_000]]);
  await e(n1, '2027-03-31', 'Cotisations encaissées', [[K, 2_200_000, 0], ['70100000', 0, 2_200_000]]);
  await e(n1, '2027-04-30', 'Subvention d’exploitation encaissée', [[K, 1_500_000, 0], ['71100000', 0, 1_500_000]]);
  await e(n1, '2027-06-30', 'Achats de biens liés à l’activité', [['60110000', 1_300_000, 0], [K, 0, 1_300_000]]);
  await e(n1, '2027-06-30', 'Loyer', [['62220000', 400_000, 0], [K, 0, 400_000]]);
  await e(n1, '2027-06-30', 'Salaires', [['66110000', 1_000_000, 0], [K, 0, 1_000_000]]);
  await e(n1, '2027-12-31', 'Cotisations restant dues', [['41100000', 100_000, 0], ['70100000', 0, 100_000]]);
  await e(n1, '2027-12-31', 'Annulation du stock initial', [['60310000', 150_000, 0], ['31100000', 0, 150_000]]);
  await e(n1, '2027-12-31', 'Stock final', [['31100000', 100_000, 0], ['60310000', 0, 100_000]]);
  await e(n1, '2027-12-31', 'Amortissement', [['68130000', 200_000, 0], ['28440000', 0, 200_000]]);
  await valider(c, n1, '2027-12-31');
  // N3 et N4 · le règlement du fournisseur 2026 lettré avec sa ligne d'à-nouveau.
  const dette2026 = (await lignesOuvertes(c, '40110000'))
    .filter((l) => montantLigne(l) === 200_000 && dateLigne(l) >= '2027-01-01' && dateLigne(l) <= '2027-01-20')
    .map((l) => l.id);
  const lettrageDette = await c.req('POST', `/comptes/${idCompte(c, '40110000')}/lettrage`, { ligneIds: dette2026 });
  const bilan2027 = aplatirTout(await etatSyc(c, n1, 'smt/bilan'));
  const cr2027Brut = await etatSyc(c, n1, 'smt/compte-de-resultat');
  const cr2027 = crSmtSycebnl(cr2027Brut);
  const cloture2027 = await cloturer(c, '2027');
  const bilan2027Apres = aplatirTout(await etatSyc(c, n1, 'smt/bilan'));
  const cr2027Apres = crSmtSycebnl(await etatSyc(c, n1, 'smt/compte-de-resultat'));
  return {
    clotures: { 2026: cloture2026, 2027: cloture2027 },
    affectation: affectation.statut,
    lettrageDette2026: { statut: lettrageDette.statut, lignes: dette2026.length, motif: lettrageDette.statut < 400 ? undefined : lettrageDette.corps?.message },
    lu: {
      reglementsNonRattaches2027: cr2027Brut.reglementsNonRattaches,
      kb2026: cr2026.KB, kb2027: cr2027.KB, jf2027: cr2027.JF,
      variations2026: Object.fromEntries(['VA', 'VB', 'VC', 'JG'].map((r) => [r, cr2026[r]])),
      variations2027: Object.fromEntries(['VA', 'VB', 'VC', 'JG'].map((r) => [r, cr2027[r]])),
      cles: Object.keys(cr2026Brut),
      controle2026: cr2026Brut.controle, controle2027: cr2027Brut.controle,
      totaux2026: { totalRecettes: cr2026Brut.totalRecettes, soldeCaisse: cr2026Brut.soldeCaisse, resultatNet: cr2026Brut.resultatNet },
      recettes2026: cr2026Brut.recettes, depenses2026: cr2026Brut.depenses,
    },
    comparaisons: {
      bilan2026: etiqueter('Bilan SMT 2026', comparer(C11_BILAN_2026, bilan2026)),
      cr2026: etiqueter('CR SMT 2026', comparer(C11_CR_2026, cr2026)),
      bilan2027: etiqueter('Bilan SMT 2027', comparer(C11_BILAN_2027, bilan2027)),
      bilan2027N1: etiqueter('Bilan SMT 2027, colonne N-1', comparer(C11_BILAN_2026, bilan2027, 'n1')),
      cr2027: etiqueter('CR SMT 2027', comparer(C11_CR_2027, cr2027)),
      cr2027N1: etiqueter('CR SMT 2027, colonne N-1', comparer(C11_CR_2026, cr2027, 'n1')),
      bilan2027Apres: etiqueter('Bilan SMT 2027 après clôture', comparer(C11_BILAN_2027, bilan2027Apres)),
      cr2027Apres: etiqueter('CR SMT 2027 après clôture', comparer(C11_CR_2027, cr2027Apres)),
    },
  };
});

// --- C12 · SARL · acquisition et cession HAO en N+1, flux d'investissement ----

const C12_CR_2027 = { TA: 7_000_000, XB: 7_000_000, RH: -3_500_000, XC: 3_500_000, XD: 3_500_000, RL: -1_100_000, XE: 2_400_000, XG: 2_400_000, TN: 4_000_000, RO: -3_500_000, XH: 500_000, XI: 2_900_000 };
const C12_BILAN_2027 = { AM: 0, AN: 2_400_000, AI: 2_400_000, AZ: 2_400_000, BS: 10_500_000, BT: 10_500_000, BZ: 12_900_000, CA: 8_000_000, CF: 200_000, CH: 1_800_000, CJ: 2_900_000, CP: 12_900_000, DZ: 12_900_000 };
const C12_TFT_2027 = { ZA: 6_000_000, FA: 3_500_000, FB: 0, FC: 0, FD: 0, FE: 0, ZB: 3_500_000, FF: 0, FG: -3_000_000, FH: 0, FI: 4_000_000, FJ: 0, ZC: 1_000_000, ZD: 0, ZE: 0, ZF: 0, ZG: 4_500_000, ZH: 10_500_000 };

cas('C12', 'SARL · acquisition d’un véhicule et cession HAO du matériel en N+1, flux d’investissement reconstitués', async () => {
  const c = await dossier('Cas clôture C12 SARL cession', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', forme: 'SOCIETE_RESPONSABILITE_LIMITEE', exercice: ['2026-01-01', '2026-12-31'],
  });
  const B = '52110000';
  const n = c.exercices.get('2026');
  const e = (ex, d, l, lignes) => ecriture(c, ex, d, l, lignes);
  await e(n, '2026-01-02', 'Apport du capital', [[B, 8_000_000, 0], ['10130000', 0, 8_000_000]]);
  await e(n, '2026-01-02', 'Matériel de bureau', [['24410000', 5_000_000, 0], [B, 0, 5_000_000]]);
  await e(n, '2026-06-30', 'Ventes au comptant', [[B, 6_000_000, 0], ['70110000', 0, 6_000_000]]);
  await e(n, '2026-06-30', 'Entretien', [['62410000', 3_000_000, 0], [B, 0, 3_000_000]]);
  await e(n, '2026-12-31', 'Dotation aux amortissements', [['68130000', 1_000_000, 0], ['28440000', 0, 1_000_000]]);
  await valider(c, n, '2026-12-31');
  const cloture2026 = await cloturer(c, '2026');
  const n1 = c.exercices.get('2027');
  await rechargerComptes(c);
  const affectation = await c.req('POST', '/affectation-resultat', {
    exerciceId: n, dateDecision: '2027-04-30', organe: 'Assemblée générale ordinaire',
    lignes: [{ compteId: idCompte(c, '11100000'), montant: 200_000 }, { compteId: idCompte(c, '12100000'), montant: 1_800_000 }],
  });
  await e(n1, '2027-01-02', 'Véhicule', [['24510000', 3_000_000, 0], [B, 0, 3_000_000]]);
  await e(n1, '2027-06-30', 'Dotation du matériel jusqu’à la cession', [['68130000', 500_000, 0], ['28440000', 0, 500_000]]);
  await e(n1, '2027-06-30', 'Sortie du matériel cédé', [['28440000', 1_500_000, 0], ['81200000', 3_500_000, 0], ['24410000', 0, 5_000_000]]);
  await e(n1, '2027-06-30', 'Prix de cession du matériel', [[B, 4_000_000, 0], ['82200000', 0, 4_000_000]]);
  await e(n1, '2027-06-30', 'Ventes au comptant', [[B, 7_000_000, 0], ['70110000', 0, 7_000_000]]);
  await e(n1, '2027-06-30', 'Entretien', [['62410000', 3_500_000, 0], [B, 0, 3_500_000]]);
  await e(n1, '2027-12-31', 'Dotation du véhicule', [['68130000', 600_000, 0], ['28450000', 0, 600_000]]);
  // Clôture demandée avec des écritures au brouillard · refus attendu (AUDCIF art. 22, 2°).
  const clotureAuBrouillard = await c.req('POST', `/exercices/${n1}/cloturer`, {});
  await valider(c, n1, '2027-12-31');
  const bilan = await bilanSyscohada(c, n1);
  const cr = await resultatSyscohada(c, n1);
  const tft = await fluxSyscohada(c, n1);
  const cloture2027 = await cloturer(c, '2027');
  const tftApres = await fluxSyscohada(c, n1);
  return {
    clotures: { 2026: cloture2026, 2027: cloture2027 }, affectation: affectation.statut,
    lu: { tft: { nonCalculables: tft.postesNonCalculables, nonVentiles: tft.comptesNonVentiles, tropAgreges: tft.comptesTropAgreges, controle: tft.controle } },
    comparaisons: {
      cr2027: etiqueter('CR 2027', comparer(C12_CR_2027, cr.postes)),
      bilan2027: etiqueter('Bilan 2027', comparer(C12_BILAN_2027, bilan.postes)),
      tft2027: etiqueter('TFT 2027', comparer(C12_TFT_2027, tft.postes)),
      tft2027Apres: etiqueter('TFT 2027 après clôture', comparer(C12_TFT_2027, tftApres.postes)),
      gestes: [
        { etat: 'Clôture avec du brouillard (refus attendu)', ref: 'art. 22, 2°', attendu: 400, omegax: clotureAuBrouillard.statut, ecart: clotureAuBrouillard.statut === 400 ? 0 : clotureAuBrouillard.statut - 400 },
        verifie('TFT 2027 · aucune réserve « réévaluation hors module » sur FG (dotations au 28)', 'N2 · FG', 0, reserveSur(tft.postesNonCalculables, 'FG')),
      ],
    },
    motifClotureAuBrouillard: clotureAuBrouillard.corps?.message,
  };
});

// --- C13 · SYCEBNL projet · facture de N-1 réglée en partie avant sa clôture ---
// Relecture du 2026-10-07, bloquant 1 · Application 22, règles (c) et (d).
// 2026 · facture de 1 000 000 (B1), 400 000 réglés et lettrés en partiel ·
// décaissement 400 000, engagement 600 000. 2027 · les 600 000 réglés et
// lettrés avec les lignes d'à-nouveau · décaissement de 2027 600 000, jamais
// 1 000 000.

cas('C13', 'SYCEBNL projet · facture de N-1 réglée en partie en N-1, soldée en N · seul le reste dû se décaisse en N', async () => {
  const c = await dossier('Cas clôture C13 Projet partiel', {
    referentiel: 'SYCEBNL', jeu: 'PROJETS_DEVELOPPEMENT', exercice: ['2026-01-01', '2026-12-31'],
  });
  const B = '52110000';
  const F = '40110000';
  const n = c.exercices.get('2026');
  const plan = await c.ok('POST', '/analytique/plans', { code: 'BUD', intitule: 'Nomenclature budgétaire', classesVentilees: '6', gererBudgets: true });
  const s1 = (await c.ok('POST', `/analytique/plans/${plan.id}/sections`, { code: 'B1', intitule: 'Fournitures' })).id;
  await c.ok('POST', `/analytique/sections/${s1}/budget`, { exerciceId: n, montantAnnuel: 1_500_000 });
  const e = (ex, d, l, lignes) => ecriture(c, ex, d, l, lignes);
  await e(n, '2026-01-05', 'Fonds du bailleur', [[B, 2_000_000, 0], ['46200000', 0, 2_000_000]]);
  await e(n, '2026-06-01', 'Facture F fournitures', [['60110000', 1_000_000, 0, [{ sectionId: s1, debit: 1_000_000 }]], [F, 0, 1_000_000]]);
  await e(n, '2026-07-01', 'Acompte sur la facture F', [[F, 400_000, 0], [B, 0, 400_000]]);
  await valider(c, n, '2026-12-31');
  const ouv26 = await lignesOuvertes(c, F);
  const partiel = await c.req('POST', `/comptes/${idCompte(c, F)}/lettrage`, { ligneIds: ouv26.map((l) => l.id), autoriserPartiel: true });
  const budget2026 = lignesBudget(await etatSyc(c, n, 'projet/execution-budgetaire'));
  const cloture2026 = await cloturer(c, '2026');
  const n1 = c.exercices.get('2027');
  await c.ok('POST', `/analytique/sections/${s1}/budget`, { exerciceId: n1, montantAnnuel: 1_000_000 });
  await e(n1, '2027-02-01', 'Solde de la facture F', [[F, 600_000, 0], [B, 0, 600_000]]);
  await valider(c, n1, '2027-12-31');
  // Le solde se lettre avec les lignes reportées · dans leur groupe s'il a
  // été reporté (AU1), sinon les trois ensemble.
  const lignes27 = (await c.ok('GET', `/comptes/${idCompte(c, F)}/lettrage`));
  const toutes27 = Array.isArray(lignes27) ? lignes27 : (lignes27.lignes ?? []);
  const reglement = toutes27.find((l) => montantLigne(l) === 600_000 && dateLigne(l) >= '2027-02-01');
  const report = toutes27.filter((l) => dateLigne(l) === '2027-01-01');
  const groupe = report.find((l) => l.lettrageId)?.lettrageId;
  const solde = groupe
    ? await c.req('POST', `/comptes/${idCompte(c, F)}/lettrage/${groupe}/completer`, { ligneIds: [reglement.id] })
    : await c.req('POST', `/comptes/${idCompte(c, F)}/lettrage`, { ligneIds: [...report.map((l) => l.id), reglement.id] });
  const budget2027Brut = await etatSyc(c, n1, 'projet/execution-budgetaire');
  const budget2027 = lignesBudget(budget2027Brut);
  const champ = (etat, k) => (etat.B1 ? etat.B1[k] : null);
  const cmp = (nom, etat, attendu) =>
    Object.entries(attendu).map(([k, montant]) => {
      const omegax = champ(etat, k);
      return { etat: nom, ref: `B1.${k}`, attendu: montant, omegax, ecart: omegax === null || omegax === undefined ? 'ABSENT' : Math.round((omegax - montant) * 100) / 100 };
    });
  return {
    clotures: { 2026: cloture2026 },
    lettrages: { partiel: partiel.statut, solde: { statut: solde.statut, groupeReporte: Boolean(groupe), motif: solde.statut < 400 ? undefined : solde.corps?.message } },
    comparaisons: {
      budget2026: cmp('Exécution budgétaire 2026', budget2026, { budget: 1_500_000, decaissement: 400_000, engagement: 600_000, realisation: 1_000_000, creditDisponible: 500_000 }),
      budget2027: cmp('Exécution budgétaire 2027', budget2027, { budget: 1_000_000, decaissement: 600_000, engagement: 0, realisation: 600_000, creditDisponible: 400_000 }),
      gestes: [
        { etat: 'Lettrage partiel de 2026', ref: 'partiel', attendu: 201, omegax: partiel.statut, ecart: partiel.statut < 300 ? 0 : partiel.statut - 201 },
        { etat: 'Solde lettré en 2027', ref: 'solde', attendu: 201, omegax: solde.statut, ecart: solde.statut < 300 ? 0 : solde.statut - 201 },
        verifie('Exécution budgétaire 2027 · aucune dépense de 2026 non suivie', 'B3', 0, Boolean(budget2027Brut.engagementsAnterieursNonSuivis)),
      ],
    },
  };
});

// --- C14 · SYSCOHADA, premier exercice dont l'ouverture est passée en OD au premier jour ---
// Relecture du 2026-10-07, bloquant 2 · AUDCIF art. 34. Sans exercice
// précédent ni à-nouveau, une position de bilan passée en OD au 1er janvier
// peut être le bilan d'ouverture d'un dossier repris ou l'apport qui fait
// naître la société · ni flux ni ouverture, postes vides et motif. Une
// société qui naît sans OD du premier jour · ouverture présumée nulle, DITE.

cas('C14', 'SYSCOHADA · ouverture saisie en OD au premier jour d’un premier exercice, et société qui naît', async () => {
  const c = await dossier('Cas clôture C14 SARL ouverture en OD', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', forme: 'SOCIETE_RESPONSABILITE_LIMITEE', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026');
  const e = (d, l, lignes) => ecriture(c, n, d, l, lignes);
  await e('2026-01-01', 'Bilan d’ouverture saisi en OD', [['24410000', 2_100_000, 0], ['52110000', 200_000, 0], ['10130000', 0, 2_000_000], ['40110000', 0, 300_000]]);
  await e('2026-03-31', 'Ventes au comptant', [['52110000', 1_000_000, 0], ['70110000', 0, 1_000_000]]);
  await valider(c, n, '2026-12-31');
  const bilan = await bilanSyscohada(c, n);
  const tft = await fluxSyscohada(c, n);
  const vides = new Set(tft.postesVides ?? []);

  const nait = await dossier('Cas clôture C14 SARL qui naît', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', forme: 'SOCIETE_RESPONSABILITE_LIMITEE', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n2 = nait.exercices.get('2026');
  await ecriture(nait, n2, '2026-01-05', 'Apport en capital', [['52110000', 1_000_000, 0], ['10130000', 0, 1_000_000]]);
  await valider(nait, n2, '2026-12-31');
  const bilanNait = await bilanSyscohada(nait, n2);
  const tftNait = await fluxSyscohada(nait, n2);
  const contient = (texte, morceau) => typeof texte === 'string' && texte.includes(morceau);
  return {
    lu: { mentionComparatif: bilan.mentionComparatif, mentionOuverture: tft.mentionOuverture, postesVides: tft.postesVides, naissance: { bilan: bilanNait.mentionComparatif, tft: tftNait.mentionOuverture, za: tftNait.postes.ZA } },
    comparaisons: {
      gestes: [
        verifie('OD du premier jour · aucune colonne N-1 au bilan', 'B1 · comparatif', 0, bilan.comparatif !== null && bilan.comparatif !== undefined),
        verifie('OD du premier jour · le bilan nomme la pièce et l’issue', 'B1 · mention', 1, contient(bilan.mentionComparatif, 'passez-le en à-nouveau')),
        verifie('OD du premier jour · ZA vide', 'B1 · ZA', 1, vides.has('ZA')),
        verifie('OD du premier jour · acquisitions vides, jamais 2 100 000', 'B1 · FF', 1, vides.has('FF')),
        verifie('OD du premier jour · apport en capital vide, jamais 2 000 000', 'B1 · FK', 1, vides.has('FK')),
        verifie('OD du premier jour · le tableau des flux le dit', 'B1 · mentionOuverture', 1, contient(tft.mentionOuverture, 'OD n°')),
        verifie('Société qui naît · bilan, ouverture présumée nulle dite', 'B1 · naissance', 1, contient(bilanNait.mentionComparatif, 'présumée nulle')),
        verifie('Société qui naît · tableau des flux, ouverture présumée nulle dite', 'B1 · naissance', 1, contient(tftNait.mentionOuverture, 'présumée nulle')),
      ],
      tftNaissance: etiqueter('TFT 2026 de la société qui naît', comparer({ ZA: 0, ZH: 1_000_000 }, tftNait.postes)),
    },
  };
});

// --- C15 · SMT · dettes du 401 nées d'immobilisations, trois cas ------------
// Relecture du 2026-10-07, majeur 3 et sa suite. La fiche du compte 40 des
// deux plans renvoie les fournisseurs d'immobilisations au 481 ; passée au
// 401, la dette d'une immobilisation sort de la variation des dettes
// d'exploitation (VC, ligne E au SYSCOHADA), et son règlement sort des
// dépenses (classe 2, flux hors exploitation), par la même règle. Trois cas ·
// facture due à la clôture de 2026 ; la même réglée en 2027 ; une seconde
// facture d'immobilisation passée et réglée en 2027. KZC (SG) égal au
// résultat du bilan chaque année · 2026, 300 000 ; 2027, 400 000.

cas('C15', 'SMT · dettes du 401 nées d’immobilisations · due à la clôture, réglée en N+1, réglée dans l’exercice · SYCEBNL et SYSCOHADA', async () => {
  const jouer = async (c, K) => {
    const n = c.exercices.get('2026');
    const e = (ex, d, l, lignes) => ecriture(c, ex, d, l, lignes);
    await e(n, '2026-01-05', 'Dotation', [[K, 1_000_000, 0], [c.capital, 0, 1_000_000]]);
    await e(n, '2026-04-30', 'Recettes 2026', [[K, 300_000, 0], [c.produit, 0, 300_000]]);
    await e(n, '2026-12-01', 'Facture du mobilier', [['24410000', 600_000, 0], ['40110000', 0, 600_000]]);
    await valider(c, n, '2026-12-31');
    const cr2026 = await c.cr(n);
    const cloture2026 = await cloturer(c, '2026');
    const n1 = c.exercices.get('2027');
    await e(n1, '2027-03-01', 'Règlement du mobilier', [['40110000', 600_000, 0], [K, 0, 600_000]]);
    await e(n1, '2027-04-30', 'Recettes', [[K, 500_000, 0], [c.produit, 0, 500_000]]);
    await e(n1, '2027-05-01', 'Facture de l’ordinateur', [['24410000', 800_000, 0], ['40110000', 0, 800_000]]);
    await e(n1, '2027-06-01', 'Règlement de l’ordinateur', [['40110000', 800_000, 0], [K, 0, 800_000]]);
    await e(n1, '2027-06-30', 'Achats au comptant', [['60110000', 100_000, 0], [K, 0, 100_000]]);
    await valider(c, n1, '2027-12-31');
    // Chaque règlement lettré avec sa facture (celle de 2026 par sa ligne d'à-nouveau).
    const ouvertes = (await lignesOuvertes(c, '40110000')).filter((l) => dateLigne(l) >= '2027-01-01');
    const lettrer = (montant) =>
      c.req('POST', `/comptes/${idCompte(c, '40110000')}/lettrage`, { ligneIds: ouvertes.filter((l) => montantLigne(l) === montant).map((l) => l.id) });
    const lettrages = [(await lettrer(600_000)).statut, (await lettrer(800_000)).statut];
    const cr2027 = await c.cr(n1);
    return { cloture2026, lettrages, cr2026, cr2027 };
  };
  const syc = await dossier('Cas clôture C15 Association SMT', {
    referentiel: 'SYCEBNL', jeu: 'SYSTEME_MINIMAL_TRESORERIE', exercice: ['2026-01-01', '2026-12-31'],
  });
  Object.assign(syc, { capital: '10110000', produit: '70100000', cr: (ex) => etatSyc(syc, ex, 'smt/compte-de-resultat') });
  const rSyc = await jouer(syc, '57100000');
  const sys = await dossier('Cas clôture C15 EI SMT', {
    referentiel: 'SYSCOHADA', systeme: 'MINIMAL_TRESORERIE', forme: 'ENTREPRISE_INDIVIDUELLE', exercice: ['2026-01-01', '2026-12-31'],
  });
  Object.assign(sys, { capital: '10300000', produit: '70110000', cr: (ex) => etatSys(sys, ex, 'smt/compte-de-resultat') });
  const rSys = await jouer(sys, '57110000');
  const sg = (cr) => aplatirTout(cr).SG?.n ?? null;
  const ligne = (etat, ref, attendu, omegax) => ({
    etat, ref, attendu, omegax, ecart: omegax === null || omegax === undefined ? 'ABSENT' : Math.round((omegax - attendu) * 100) / 100,
  });
  const sansNomme = (cr) => !(cr.reglementsNonRattaches ?? []).some((x) => Math.round(x.montant) === 600_000 || Math.round(x.montant) === 800_000);
  return {
    clotures: { syc: rSyc.cloture2026, sys: rSys.cloture2026 },
    lettrages: { syc: rSyc.lettrages, sys: rSys.lettrages },
    lu: {
      syc: { 2026: { kzc: rSyc.cr2026.resultatNet, controle: rSyc.cr2026.controle }, 2027: { kzc: rSyc.cr2027.resultatNet, controle: rSyc.cr2027.controle, nonRattaches: rSyc.cr2027.reglementsNonRattaches } },
      sys: { 2026: { SG: sg(rSys.cr2026), controle: rSys.cr2026.controle }, 2027: { SG: sg(rSys.cr2027), controle: rSys.cr2027.controle, nonRattaches: rSys.cr2027.reglementsNonRattaches } },
    },
    comparaisons: {
      resultats: [
        ligne('SMT SYCEBNL 2026 · facture due à la clôture', 'KZC', 300_000, rSyc.cr2026.resultatNet),
        ligne('SMT SYCEBNL 2027 · réglée en N+1 et facture réglée dans l’exercice', 'KZC', 400_000, rSyc.cr2027.resultatNet),
        ligne('SMT SYSCOHADA 2026 · facture due à la clôture', 'SG', 300_000, sg(rSys.cr2026)),
        ligne('SMT SYSCOHADA 2027 · réglée en N+1 et facture réglée dans l’exercice', 'SG', 400_000, sg(rSys.cr2027)),
      ],
      gestes: [
        { etat: 'Lettrages de 2027 (SYCEBNL, SYSCOHADA)', ref: 'lettrage', attendu: 201, omegax: [...rSyc.lettrages, ...rSys.lettrages].join(','), ecart: [...rSyc.lettrages, ...rSys.lettrages].every((x) => x < 300) ? 0 : 'REFUS' },
        verifie('SMT SYCEBNL 2026 · concordant', 'majeur 3', 1, rSyc.cr2026.controle?.concordant === true),
        verifie('SMT SYCEBNL 2027 · concordant', 'majeur 3', 1, rSyc.cr2027.controle?.concordant === true),
        verifie('SMT SYSCOHADA 2026 · concordant', 'majeur 3', 1, rSys.cr2026.controle?.concordant === true),
        verifie('SMT SYSCOHADA 2027 · concordant', 'majeur 3', 1, rSys.cr2027.controle?.concordant === true),
        verifie('SMT SYCEBNL 2027 · aucun règlement d’immobilisation laissé en dépense', 'majeur 3', 1, sansNomme(rSyc.cr2027)),
        ligne('SMT SYCEBNL 2027 · règlements des immobilisations en flux hors exploitation', 'fluxHorsExploitation', -1_400_000, rSyc.cr2027.controle?.fluxHorsExploitation),
        ligne('SMT SYSCOHADA 2026 · aucun résiduel inexpliqué', 'residuel', 0, rSys.cr2026.controle?.residuel),
        ligne('SMT SYSCOHADA 2027 · aucun résiduel inexpliqué', 'residuel', 0, rSys.cr2027.controle?.residuel),
        verifie('SMT SYSCOHADA 2027 · aucun règlement d’immobilisation laissé en dépense', 'majeur 3', 1, sansNomme(rSys.cr2027)),
      ],
    },
  };
});

// @@SITUATIONS@@

// --- Exécution --------------------------------------------------------------

const resultats = {};
const filtre = process.env.OMEGAX_CAS ? new Set(process.env.OMEGAX_CAS.split(',')) : null;
let comparaisons = 0;
let nbEcarts = 0;
for (const { code, titre, fn } of CAS.filter((x) => !filtre || filtre.has(x.code))) {
  try {
    const r = await fn();
    resultats[code] = { titre, ...r };
    const toutes = Object.values(r.comparaisons ?? {}).flat();
    comparaisons += toutes.length;
    const e = ecarts(toutes);
    nbEcarts += e.length;
    console.log(`${code} · ${toutes.length} comparaisons, ${e.length} écart(s)`);
    for (const x of e) console.log(`   ${x.etat ?? ''} ${x.ref} · attendu ${x.attendu} · OmegaX ${x.omegax} · écart ${x.ecart}`);
  } catch (e) {
    resultats[code] = { titre, erreur: e.message };
    console.log(`${code} · ÉCHEC · ${e.message}`);
  }
}
console.log(`TOTAL · ${comparaisons} comparaisons, ${nbEcarts} écart(s)`);
const sortie = process.argv[2] ?? 'rejeu-cloture.json';
writeFileSync(sortie, JSON.stringify(resultats, null, 2));
console.log(`Résultats écrits dans ${sortie}`);
