#!/usr/bin/env node
/**
 * REJEU DES CAS CHIFFRÉS DE L'IMPÔT SUR LES SOCIÉTÉS · docs/cas-chiffres/is.md.
 *
 * Méthode décidée par Manasse le 2026-10-04 · on part des CALCULS. Chaque cas
 * est calculé à la main dans le document, article par article (loi n° 23/053
 * du 30 novembre 2023, Titre II ; loi de procédures fiscales, art. 57 bis),
 * puis rejoué ici dans OmegaX, sur une VRAIE base, par l'API du serveur
 * compilé · inscription d'un dossier, écritures, validation, clôture quand le
 * cas la demande, puis lecture de ce qu'OmegaX rend (résultat fiscal,
 * propositions de retraitement, écriture de l'impôt A11, acomptes).
 *
 * Ce script NE CORRIGE RIEN et NE TRANCHE RIEN · il relève, et la comparaison
 * avec l'attendu est écrite dans le document. Les montants attendus portés
 * ici sont ceux du document, recopiés pour que l'écart s'imprime au rejeu.
 *
 * Usage (serveur compilé démarré contre une base JETABLE, jamais celle de
 * production, avec INSCRIPTION_PUBLIQUE=true) :
 *
 *   OMEGAX_API=http://localhost:8118 node scripts/cas-chiffres/rejeu-is.mjs [sortie.json]
 */
import { writeFileSync } from 'node:fs';

const BASE = process.env.OMEGAX_API ?? 'http://localhost:8118';
const MOT_DE_PASSE = 'MotDePasse-cas-is-2026!';
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

  /** Comme `req`, mais un refus arrête le cas avec son motif. */
  async ok(methode, chemin, corps) {
    const r = await this.req(methode, chemin, corps);
    if (r.statut >= 400) {
      throw new Error(`${methode} ${chemin} · ${r.statut} · ${JSON.stringify(r.corps).slice(0, 600)}`);
    }
    return r.corps;
  }
}

/**
 * Un dossier SYSCOHADA neuf · inscription (premier exercice éventuellement
 * imposé), forme juridique, plan et journal OD chargés.
 */
async function dossier(nom, forme, premierExercice) {
  const c = new Client();
  await c.ok('POST', '/auth/register', {
    nomEntite: nom,
    referentiel: 'SYSCOHADA',
    systemeComptableSyscohada: 'NORMAL',
    email: `cas-is-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.cd`,
    motDePasse: MOT_DE_PASSE,
    ...(premierExercice ? { dateDebutExercice: premierExercice[0], dateFinExercice: premierExercice[1] } : {}),
  });
  if (forme) await c.ok('PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: forme });
  const comptes = await c.ok('GET', '/comptes?typeCompte=DETAIL');
  c.comptes = new Map(comptes.map((x) => [x.numero, x.id]));
  const journaux = await c.ok('GET', '/journaux');
  c.od = journaux.find((j) => j.code === 'OD') ?? journaux.find((j) => j.type === 'GENERAL');
  const exercices = await c.ok('GET', '/exercices');
  c.exercices = new Map(exercices.map((e) => [e.dateDebut.slice(0, 10), e.id]));
  return c;
}

async function exercice(c, debut, fin) {
  if (c.exercices.has(debut)) return c.exercices.get(debut);
  const e = await c.ok('POST', '/exercices', { dateDebut: debut, dateFin: fin });
  c.exercices.set(debut, e.id);
  return e.id;
}

function idCompte(c, numero) {
  const id = c.comptes.get(numero);
  if (!id) throw new Error(`Compte ${numero} absent du plan semé`);
  return id;
}

/** Une écriture au journal OD · lignes [numéro, débit, crédit]. */
async function ecriture(c, exerciceId, date, libelle, lignes) {
  const e = await c.ok('POST', '/ecritures', {
    exerciceId,
    journalId: c.od.id,
    date,
    libelle,
    lignes: lignes.map(([numero, debit, credit]) => ({ compteId: idCompte(c, numero), libelle, debit, credit })),
  });
  return e.id;
}

/** Vente (D 52 / C 701) et charge (D compte / C 52), le plus courant des cas. */
async function venteEtCharges(c, exerciceId, date, ca, charges) {
  if (ca) await ecriture(c, exerciceId, date, "Chiffre d'affaires", [['52110000', ca, 0], ['70110000', 0, ca]]);
  for (const [numero, montant] of charges) {
    await ecriture(c, exerciceId, date, `Charge ${numero}`, [[numero, montant, 0], ['52110000', 0, montant]]);
  }
}

const valider = (c, exerciceId, dateLimite) => c.ok('POST', '/ecritures/valider-jusqua', { exerciceId, dateLimite });
const fiscal = (c, exerciceId) => c.ok('GET', `/fiscalite/resultat-fiscal?exerciceId=${exerciceId}`);
const retraiter = (c, exerciceId, code, montant, commentaire = 'Cas chiffré IS') =>
  c.ok('POST', `/fiscalite/exercices/${exerciceId}/retraitements`, { code, montant, commentaire });
const etatImpot = (c, exerciceId) => c.ok('GET', `/fiscalite/exercices/${exerciceId}/ecriture-impot`);

/** Ce qu'OmegaX rend, réduit aux chiffres que le document compare. */
function lecture(f) {
  return {
    regime: f.regime,
    resultatComptable: f.resultatComptable,
    sourceResultat: f.sourceResultat,
    chiffreAffaires: f.chiffreAffaires,
    totalReintegrations: f.totalReintegrations,
    totalDeductions: f.totalDeductions,
    resultatFiscalBrut: f.resultatFiscalBrut,
    deficitAnterieur: f.deficitAnterieur?.montant,
    deficitImpute: f.deficitImpute,
    resultatFiscal: f.resultatFiscal,
    impotTheorique: f.impotTheorique,
    impotMinimum: f.impotMinimum,
    impotDu: f.impotDu,
    minimumApplique: f.minimumApplique,
    soldeAPayer: f.soldeAPayer,
    baseAcomptes: f.baseAcomptes,
    acomptesProchainExercice: (f.acomptesProchainExercice ?? []).map((a) => a.montant),
    definitif: f.definitif,
    brouillard: f.brouillard,
    simulationAvantLaLoi: f.simulationAvantLaLoi,
    deficitDetail: (f.deficitAnterieur?.detail ?? []).map((d) => ({ dateFin: d.dateFin?.slice(0, 10), montant: d.montant, simulation: d.simulation })),
    periodeCreation: f.periodeCreation
      ? {
          source: f.periodeCreation.source,
          resultatFiscal: f.periodeCreation.resultatFiscal,
          chiffreAffaires: f.periodeCreation.chiffreAffaires,
          impotDu: f.periodeCreation.impotDu,
          minimumApplique: f.periodeCreation.minimumApplique,
          acomptesExercice: f.periodeCreation.acomptesExercice.map((a) => `${a.montant} au ${a.echeance} ${a.annee}`),
        }
      : null,
    impotTotalExercice: f.impotTotalExercice,
    plafondDons: (f.plafonds ?? []).find((p) => p.code === 'DONS_EXCEDENT')?.enonce,
    explication: f.explication,
    observations: f.observations,
  };
}

function lectureA11(e) {
  return {
    proposition: e.proposition
      ? {
          impot: e.proposition.impot,
          minimumApplique: e.proposition.minimumApplique,
          lignes: e.proposition.lignes.map((l) => `${l.numero} D ${l.debit} C ${l.credit}`),
          imputation: e.proposition.imputation?.lignes?.map((l) => `${l.numero} D ${l.debit} C ${l.credit}`),
          imputationRefus: e.proposition.imputation?.motifRefus ?? null,
        }
      : null,
    constat: e.constat ? { montantImpot: e.constat.montantImpot, compteCharge: e.constat.compteCharge, montantImpute: e.constat.montantImpute } : null,
    motifsRefus: e.motifsRefus,
  };
}

// --- Les cas --------------------------------------------------------------

const CAS = [];
const cas = (code, titre, fn) => CAS.push({ code, titre, fn });

cas('C01', 'Bénéfice simple, SARL, puis écriture A11 et sa réintégration', async () => {
  const c = await dossier('Cas IS 01', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const n = c.exercices.get('2026-01-01');
  await venteEtCharges(c, n, '2026-06-30', 100_000_000, [['60410000', 60_000_000]]);
  await valider(c, n, '2026-12-31');
  const avant = lecture(await fiscal(c, n));
  const a11 = lectureA11(await etatImpot(c, n));
  const passe = await c.ok('POST', `/fiscalite/exercices/${n}/ecriture-impot`, {});
  await valider(c, n, '2026-12-31');
  const apresValidationSansReintegration = lecture(await fiscal(c, n));
  await retraiter(c, n, 'IMPOT_SUR_LE_RESULTAT', avant.impotDu);
  const apresReintegration = lecture(await fiscal(c, n));
  const a11Final = lectureA11(await etatImpot(c, n));
  return { avant, a11, passe, apresValidationSansReintegration, apresReintegration, a11Final };
});

cas('C01-bis', 'Même dossier, charges restées au brouillard', async () => {
  const c = await dossier('Cas IS 01 bis', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const n = c.exercices.get('2026-01-01');
  await venteEtCharges(c, n, '2026-06-30', 10_000_000, []);
  await valider(c, n, '2026-12-31');
  await venteEtCharges(c, n, '2026-07-31', 0, [['60410000', 8_000_000]]);
  return { fiscal: lecture(await fiscal(c, n)), a11: lectureA11(await etatImpot(c, n)) };
});

cas('C02', 'Déficit avec chiffre d\'affaires, impôt minimum', async () => {
  const c = await dossier('Cas IS 02', 'SOCIETE_ANONYME');
  const n = c.exercices.get('2026-01-01');
  await venteEtCharges(c, n, '2026-06-30', 50_000_000, [['60410000', 53_000_000]]);
  await valider(c, n, '2026-12-31');
  return { fiscal: lecture(await fiscal(c, n)), a11: lectureA11(await etatImpot(c, n)) };
});

cas('C03', 'Égalité entre l\'impôt au taux et le minimum', async () => {
  const c = await dossier('Cas IS 03', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const n = c.exercices.get('2026-01-01');
  await venteEtCharges(c, n, '2026-06-30', 30_000_000, [['60410000', 29_000_000]]);
  await valider(c, n, '2026-12-31');
  return { fiscal: lecture(await fiscal(c, n)), a11: lectureA11(await etatImpot(c, n)) };
});

cas('C04', 'Report déficitaire sur trois exercices, puis expiration (clôtures traversées)', async () => {
  const c = await dossier('Cas IS 04', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const annees = [
    ['2026', 5_000_000, 6_000_000],
    ['2027', 20_000_000, 19_800_000],
    ['2028', 20_000_000, 19_700_000],
    ['2029', 20_000_000, 19_900_000],
    ['2030', 20_000_000, 19_000_000],
  ];
  const ids = {};
  for (const [a, ca, ch] of annees) {
    ids[a] = await exercice(c, `${a}-01-01`, `${a}-12-31`);
    await venteEtCharges(c, ids[a], `${a}-06-30`, ca, [['60410000', ch]]);
    await valider(c, ids[a], `${a}-12-31`);
  }
  const clotures = {};
  for (const a of ['2026', '2027', '2028', '2029']) {
    const r = await c.req('POST', `/exercices/${ids[a]}/cloturer`, {});
    clotures[a] = r.statut < 400 ? 'CLOTURE' : `REFUS ${r.statut} · ${JSON.stringify(r.corps).slice(0, 400)}`;
  }
  const lectures = {};
  for (const [a] of annees) lectures[a] = lecture(await fiscal(c, ids[a]));
  return { clotures, lectures };
});

cas('C05', 'Ordre d\'imputation des déficits (le plus ancien d\'abord) au bord de la fenêtre', async () => {
  const c = await dossier('Cas IS 05', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const annees = [
    ['2026', 10_000_000, 10_100_000],
    ['2027', 10_000_000, 10_500_000],
    ['2028', 10_000_000, 9_940_000],
    ['2029', 10_000_000, 9_970_000],
    ['2030', 10_000_000, 9_000_000],
  ];
  const ids = {};
  for (const [a, ca, ch] of annees) {
    ids[a] = await exercice(c, `${a}-01-01`, `${a}-12-31`);
    await venteEtCharges(c, ids[a], `${a}-06-30`, ca, [['60410000', ch]]);
    await valider(c, ids[a], `${a}-12-31`);
  }
  // Lu AVANT puis APRÈS les clôtures de 2026 à 2029 · le report rejoué dans
  // l'ordre doit rendre le même chiffre de part et d'autre (CLAUDE.md § 10).
  const avantClotures = {};
  for (const [a] of annees) avantClotures[a] = lecture(await fiscal(c, ids[a]));
  const clotures = {};
  for (const a of ['2026', '2027', '2028', '2029']) {
    const r = await c.req('POST', `/exercices/${ids[a]}/cloturer`, {});
    clotures[a] = r.statut < 400 ? 'CLOTURE' : `REFUS ${r.statut} · ${JSON.stringify(r.corps).slice(0, 400)}`;
  }
  const lectures = {};
  for (const [a] of annees) lectures[a] = lecture(await fiscal(c, ids[a]));
  return { clotures, avantClotures, lectures };
});

cas('C06', 'Dons au-delà du plafond de l\'art. 44 et amende (art. 50, 3°)', async () => {
  const c = await dossier('Cas IS 06', 'SOCIETE_ANONYME');
  const n = c.exercices.get('2026-01-01');
  await venteEtCharges(c, n, '2026-06-30', 200_000_000, [
    ['60410000', 183_500_000],
    ['65820000', 3_000_000],
    ['64710000', 500_000],
  ]);
  await valider(c, n, '2026-12-31');
  await c.ok('PATCH', `/comptes/${idCompte(c, '65820000')}`, { codeRetraitementFiscal: 'DONS_EXCEDENT' });
  await c.ok('PATCH', `/comptes/${idCompte(c, '64710000')}`, { codeRetraitementFiscal: 'AMENDES_PENALITES' });
  const propositions = await c.ok('GET', `/fiscalite/exercices/${n}/propositions-retraitements`);
  for (const p of propositions.propositions) await retraiter(c, n, p.code, p.montant);
  return {
    propositions: propositions.propositions.map((p) => ({ code: p.code, mouvement: p.mouvement, montantAdmis: p.montantAdmis, montant: p.montant })),
    fiscal: lecture(await fiscal(c, n)),
  };
});

cas('C07', 'Dons sur exercice déficitaire (condition de l\'art. 44, al. 2, 2°), puis report en N+1', async () => {
  const c = await dossier('Cas IS 07', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const n = c.exercices.get('2026-01-01');
  await venteEtCharges(c, n, '2026-06-30', 20_000_000, [
    ['60410000', 20_200_000],
    ['65820000', 300_000],
  ]);
  await valider(c, n, '2026-12-31');
  await c.ok('PATCH', `/comptes/${idCompte(c, '65820000')}`, { codeRetraitementFiscal: 'DONS_EXCEDENT' });
  const propositions = await c.ok('GET', `/fiscalite/exercices/${n}/propositions-retraitements`);
  for (const p of propositions.propositions) await retraiter(c, n, p.code, p.montant);
  const n1 = await exercice(c, '2027-01-01', '2027-12-31');
  await venteEtCharges(c, n1, '2027-06-30', 10_000_000, [['60410000', 9_000_000]]);
  await valider(c, n1, '2027-12-31');
  return {
    propositions: propositions.propositions.map((p) => ({ code: p.code, mouvement: p.mouvement, montantAdmis: p.montantAdmis, montant: p.montant, plafondEnonce: p.plafondEnonce })),
    fiscalN: lecture(await fiscal(c, n)),
    fiscalN1: lecture(await fiscal(c, n1)),
  };
});

cas('C08', 'Premier exercice de moins de douze mois (1er mars au 31 décembre 2026)', async () => {
  const c = await dossier('Cas IS 08', 'SOCIETE_RESPONSABILITE_LIMITEE', ['2026-03-01', '2026-12-31']);
  const n = c.exercices.get('2026-03-01');
  await venteEtCharges(c, n, '2026-06-30', 40_000_000, [['60410000', 38_000_000]]);
  await valider(c, n, '2026-12-31');
  return { fiscal: lecture(await fiscal(c, n)) };
});

cas('C09', 'Premier exercice de plus de douze mois, entreprise créée après le 30 juin 2026', async () => {
  const c = await dossier('Cas IS 09', 'SOCIETE_RESPONSABILITE_LIMITEE', ['2026-09-01', '2027-12-31']);
  const n = c.exercices.get('2026-09-01');
  await venteEtCharges(c, n, '2026-11-30', 30_000_000, [['60410000', 29_900_000]]);
  await venteEtCharges(c, n, '2027-06-30', 40_000_000, [['60410000', 35_000_000]]);
  await valider(c, n, '2027-12-31');
  return { fiscal: lecture(await fiscal(c, n)), a11: lectureA11(await etatImpot(c, n)) };
});

cas('C10', 'Premier exercice ouvert le 1er septembre 2025 et clos le 31 décembre 2026', async () => {
  const c = await dossier('Cas IS 10', 'SOCIETE_RESPONSABILITE_LIMITEE', ['2025-09-01', '2026-12-31']);
  const n = c.exercices.get('2025-09-01');
  await venteEtCharges(c, n, '2025-11-30', 10_000_000, [['60410000', 9_000_000]]);
  await venteEtCharges(c, n, '2026-06-30', 50_000_000, [['60410000', 45_000_000]]);
  await valider(c, n, '2026-12-31');
  return { fiscal: lecture(await fiscal(c, n)), a11: lectureA11(await etatImpot(c, n)) };
});

cas('C11', 'Acomptes versés, imputés, et acomptes de l\'exercice suivant avec supplément', async () => {
  const c = await dossier('Cas IS 11', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const n = c.exercices.get('2026-01-01');
  await venteEtCharges(c, n, '2026-06-30', 80_000_000, [['60410000', 70_000_000]]);
  await ecriture(c, n, '2026-07-25', 'Acompte provisionnel versé', [['44920000', 900_000, 0], ['52110000', 0, 900_000]]);
  await valider(c, n, '2026-12-31');
  await c.ok('PATCH', `/fiscalite/exercices/${n}/dossier`, { acomptesVerses: 900_000, supplementsAdministration: 500_000 });
  const avant = lecture(await fiscal(c, n));
  const a11 = lectureA11(await etatImpot(c, n));
  const passe = await c.ok('POST', `/fiscalite/exercices/${n}/ecriture-impot`, { imputerAcomptes: true });
  const suivi = (await fiscal(c, n)).suiviAcomptes;
  return { fiscal: avant, a11, passe, a11Final: lectureA11(await etatImpot(c, n)), suiviAcomptes: suivi };
});

cas('C12', 'Arrondi de l\'art. 150 · (a) arrondi qui rend les deux impôts égaux, (b) tranche de 50 FC', async () => {
  const a = await dossier('Cas IS 12a', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const na = a.exercices.get('2026-01-01');
  await venteEtCharges(a, na, '2026-06-30', 123_456_789, [['60410000', 119_341_567]]);
  await valider(a, na, '2026-12-31');
  const b = await dossier('Cas IS 12b', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const nb = b.exercices.get('2026-01-01');
  await venteEtCharges(b, nb, '2026-06-30', 10_000_000, [['60410000', 8_999_833]]);
  await valider(b, nb, '2026-12-31');
  return {
    a: { fiscal: lecture(await fiscal(a, na)), a11: lectureA11(await etatImpot(a, na)) },
    b: { fiscal: lecture(await fiscal(b, nb)), a11: lectureA11(await etatImpot(b, nb)) },
  };
});

cas('C13', 'Entreprise individuelle (personne physique), hors IS', async () => {
  const c = await dossier('Cas IS 13', 'ENTREPRISE_INDIVIDUELLE');
  const n = c.exercices.get('2026-01-01');
  await venteEtCharges(c, n, '2026-06-30', 400_000_000, [['60410000', 350_000_000]]);
  await valider(c, n, '2026-12-31');
  return { fiscal: lecture(await fiscal(c, n)), a11: lectureA11(await etatImpot(c, n)) };
});

cas('C14', 'Entité publique (art. 5, 1°)', async () => {
  const c = await dossier('Cas IS 14', 'ENTITE_PUBLIQUE');
  const n = c.exercices.get('2026-01-01');
  await venteEtCharges(c, n, '2026-06-30', 10_000_000, [['60410000', 8_000_000]]);
  await valider(c, n, '2026-12-31');
  const passeSansAttestation = await c.req('POST', `/fiscalite/exercices/${n}/ecriture-impot`, {});
  return {
    fiscal: lecture(await fiscal(c, n)),
    a11: lectureA11(await etatImpot(c, n)),
    passeSansAttestation: { statut: passeSansAttestation.statut, message: passeSansAttestation.corps?.message },
  };
});

cas('C15', 'Déficit de l\'exercice 2025 imputé sur 2026', async () => {
  const c = await dossier('Cas IS 15', 'SOCIETE_RESPONSABILITE_LIMITEE', ['2025-01-01', '2025-12-31']);
  const n0 = c.exercices.get('2025-01-01');
  await venteEtCharges(c, n0, '2025-06-30', 10_000_000, [['60410000', 12_000_000]]);
  await valider(c, n0, '2025-12-31');
  const n = await exercice(c, '2026-01-01', '2026-12-31');
  await venteEtCharges(c, n, '2026-06-30', 30_000_000, [['60410000', 25_000_000]]);
  await valider(c, n, '2026-12-31');
  return { fiscal2025: lecture(await fiscal(c, n0)), fiscal2026: lecture(await fiscal(c, n)) };
});

// --- Exécution --------------------------------------------------------------

const resultats = {};
for (const { code, titre, fn } of CAS) {
  try {
    resultats[code] = { titre, ...(await fn()) };
    console.log(`${code} · rejoué`);
  } catch (e) {
    resultats[code] = { titre, erreur: e.message };
    console.log(`${code} · ÉCHEC · ${e.message}`);
  }
}
const sortie = process.argv[2] ?? 'rejeu-is.json';
writeFileSync(sortie, JSON.stringify(resultats, null, 2));
console.log(`Résultats écrits dans ${sortie}`);
