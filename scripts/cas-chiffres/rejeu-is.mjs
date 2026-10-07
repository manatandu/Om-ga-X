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
import { execFileSync } from 'node:child_process';
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

// --- Second tour (2026-10-04) · B1, B2, P1, sur trois exercices et leurs clôtures

/** Clôture dans l'ordre · un refus est relevé, pas avalé. */
async function cloturer(c, ids) {
  const clotures = {};
  for (const [a, id] of ids) {
    const r = await c.req('POST', `/exercices/${id}/cloturer`, {});
    clotures[a] = r.statut < 400 ? 'CLOTURE' : `REFUS ${r.statut} · ${JSON.stringify(r.corps).slice(0, 300)}`;
  }
  return clotures;
}

cas('B1', 'Entreprise individuelle, premier exercice du 01/09/2026 au 31/12/2027 · aucun déficit inventé en 2028', async () => {
  const c = await dossier('Cas IS B1', 'ENTREPRISE_INDIVIDUELLE', ['2026-09-01', '2027-12-31']);
  const p = c.exercices.get('2026-09-01');
  await venteEtCharges(c, p, '2026-11-30', 1_000_000, []);
  await venteEtCharges(c, p, '2027-06-30', 0, [['60410000', 600_000]]);
  await valider(c, p, '2027-12-31');
  const n = await exercice(c, '2028-01-01', '2028-12-31');
  await venteEtCharges(c, n, '2028-06-30', 2_000_000, []);
  await valider(c, n, '2028-12-31');
  const avant = lecture(await fiscal(c, n));
  const clotures = await cloturer(c, [['2026-2027', p]]);
  return { avant, clotures, apres: lecture(await fiscal(c, n)) };
});

cas('B2', 'Perte 2025 recalculée 1 000 000, déclarée 400 000 à l\'ouverture de 2026, bénéfice 2026 300 000 · 2027 voit 100 000', async () => {
  const c = await dossier('Cas IS B2', 'SOCIETE_RESPONSABILITE_LIMITEE', ['2025-01-01', '2025-12-31']);
  const a25 = c.exercices.get('2025-01-01');
  await venteEtCharges(c, a25, '2025-06-30', 0, [['60410000', 1_000_000]]);
  await valider(c, a25, '2025-12-31');
  const a26 = await exercice(c, '2026-01-01', '2026-12-31');
  await venteEtCharges(c, a26, '2026-06-30', 300_000, []);
  await valider(c, a26, '2026-12-31');
  const a27 = await exercice(c, '2027-01-01', '2027-12-31');
  await venteEtCharges(c, a27, '2027-06-30', 2_000_000, []);
  await valider(c, a27, '2027-12-31');
  const sansSaisie = lecture(await fiscal(c, a27));
  await c.ok('PATCH', `/fiscalite/exercices/${a26}/dossier`, { deficitAnterieurSaisi: 400_000 });
  const saisieSansOrigine = lecture(await fiscal(c, a27));
  await c.ok('PATCH', `/fiscalite/exercices/${a26}/dossier`, {
    deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: 400_000 }],
  });
  const avant = { a2026: lecture(await fiscal(c, a26)), a2027: lecture(await fiscal(c, a27)) };
  const clotures = await cloturer(c, [['2025', a25], ['2026', a26]]);
  const refusSurClos = await c.req('PATCH', `/fiscalite/exercices/${a26}/dossier`, { deficitAnterieurSaisi: 1 });
  return {
    sansSaisie,
    saisieSansOrigine,
    avant,
    clotures,
    apres: { a2026: lecture(await fiscal(c, a26)), a2027: lecture(await fiscal(c, a27)) },
    refusSurClos: { statut: refusSurClos.statut, message: refusSurClos.corps?.message },
  };
});

cas('P1', 'Dossier repris en 2026 avec 800 000 de déficit déclaré, bénéfice 2026 300 000 · 500 000 en 2027, et 2028', async () => {
  const c = await dossier('Cas IS P1', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const a26 = c.exercices.get('2026-01-01');
  await venteEtCharges(c, a26, '2026-06-30', 300_000, []);
  await valider(c, a26, '2026-12-31');
  await c.ok('PATCH', `/fiscalite/exercices/${a26}/dossier`, {
    deficitAnterieurSaisi: 800_000,
    deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: 800_000 }],
  });
  const a27 = await exercice(c, '2027-01-01', '2027-12-31');
  await venteEtCharges(c, a27, '2027-06-30', 200_000, []);
  await valider(c, a27, '2027-12-31');
  const a28 = await exercice(c, '2028-01-01', '2028-12-31');
  await venteEtCharges(c, a28, '2028-06-30', 1_000_000, []);
  await valider(c, a28, '2028-12-31');
  const avant = { a2026: lecture(await fiscal(c, a26)), a2027: lecture(await fiscal(c, a27)), a2028: lecture(await fiscal(c, a28)) };
  const clotures = await cloturer(c, [['2026', a26], ['2027', a27]]);
  return {
    avant,
    clotures,
    apres: { a2026: lecture(await fiscal(c, a26)), a2027: lecture(await fiscal(c, a27)), a2028: lecture(await fiscal(c, a28)) },
  };
});

cas('V2', 'Saisie 2026 de 500 000 d\'origine 2021-12-31, fenêtre close en 2024 · refusée, impôt 300 000', async () => {
  const c = await dossier('Cas IS V2', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const n = c.exercices.get('2026-01-01');
  await venteEtCharges(c, n, '2026-06-30', 1_000_000, []);
  await valider(c, n, '2026-12-31');
  const refus = await c.req('PATCH', `/fiscalite/exercices/${n}/dossier`, {
    deficitAnterieurSaisi: 500_000,
    deficitAnterieurOrigines: [{ dateFin: '2021-12-31', montant: 500_000 }],
  });
  return { exerciceId: n, refus: { statut: refus.statut, message: refus.corps?.message }, fiscal: lecture(await fiscal(c, n)) };
});

// --- Troisième tour (2026-10-07) · la fenêtre de l'art. 51, N-4 contre N-3 ---

cas('V3', 'Pertes calculées de 2026 (N-4) et 2027 (N-3), 2028 et 2029 à zéro · 2030 n\'impute que 2027 (clôtures traversées)', async () => {
  const c = await dossier('Cas IS V3', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const annees = [
    ['2026', 1_000_000, 1_100_000],
    ['2027', 1_000_000, 1_200_000],
    ['2028', 1_000_000, 1_000_000],
    ['2029', 1_000_000, 1_000_000],
    ['2030', 2_000_000, 1_000_000],
  ];
  const ids = {};
  for (const [a, ca, ch] of annees) {
    ids[a] = await exercice(c, `${a}-01-01`, `${a}-12-31`);
    await venteEtCharges(c, ids[a], `${a}-06-30`, ca, [['60410000', ch]]);
    await valider(c, ids[a], `${a}-12-31`);
  }
  const avantClotures = {};
  for (const [a] of annees) avantClotures[a] = lecture(await fiscal(c, ids[a]));
  const clotures = await cloturer(c, [['2026', ids['2026']], ['2027', ids['2027']], ['2028', ids['2028']], ['2029', ids['2029']]]);
  const lectures = {};
  for (const [a] of annees) lectures[a] = lecture(await fiscal(c, ids[a]));
  return { clotures, avantClotures, lectures };
});

cas('V4', 'Report déclaré en 2026 · origine 2022 (N-4) refusée, origine 2023 (N-3) imputée, éteinte en 2027', async () => {
  const c = await dossier('Cas IS V4', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const a26 = c.exercices.get('2026-01-01');
  await venteEtCharges(c, a26, '2026-06-30', 100_000, []);
  await valider(c, a26, '2026-12-31');
  const refusN4 = await c.req('PATCH', `/fiscalite/exercices/${a26}/dossier`, {
    deficitAnterieurSaisi: 800_000,
    deficitAnterieurOrigines: [
      { dateFin: '2022-12-31', montant: 500_000 },
      { dateFin: '2023-12-31', montant: 300_000 },
    ],
  });
  await c.ok('PATCH', `/fiscalite/exercices/${a26}/dossier`, {
    deficitAnterieurSaisi: 300_000,
    deficitAnterieurOrigines: [{ dateFin: '2023-12-31', montant: 300_000 }],
  });
  const a27 = await exercice(c, '2027-01-01', '2027-12-31');
  await venteEtCharges(c, a27, '2027-06-30', 1_000_000, []);
  await valider(c, a27, '2027-12-31');
  const avant = { a2026: lecture(await fiscal(c, a26)), a2027: lecture(await fiscal(c, a27)) };
  const clotures = await cloturer(c, [['2026', a26]]);
  return {
    refusN4: { statut: refusN4.statut, message: refusN4.corps?.message },
    avant,
    clotures,
    apres: { a2026: lecture(await fiscal(c, a26)), a2027: lecture(await fiscal(c, a27)) },
  };
});

/*
  V5 · UNE DÉCLARATION D'AVANT LE TROISIÈME TOUR. La porte refuse désormais une
  origine hors fenêtre (V2, V4) · une ligne enregistrée avant ce refus ne
  passe plus par elle. Le cas la POSE dans la base jetable (psql, adresse lue
  dans OMEGAX_BASE_JETABLE, jamais imprimée) pour éprouver la LECTURE · seule
  la part de 2023 s'impute en 2026, et la part de 2022 est nommée. Sans la
  variable, le cas est sauté et le dit.
*/
cas('V5', 'Déclaration enregistrée avant le troisième tour · 500 000 de 2022 (N-4) et 300 000 de 2023 (N-3) · 2026 n\'impute que 300 000', async () => {
  if (!process.env.OMEGAX_BASE_JETABLE) return { saute: 'OMEGAX_BASE_JETABLE absente · cas non rejoué' };
  const c = await dossier('Cas IS V5', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const a26 = c.exercices.get('2026-01-01');
  await venteEtCharges(c, a26, '2026-06-30', 1_000_000, []);
  await valider(c, a26, '2026-12-31');
  await c.ok('PATCH', `/fiscalite/exercices/${a26}/dossier`, {
    deficitAnterieurSaisi: 800_000,
    deficitAnterieurOrigines: [
      { dateFin: '2023-12-31', montant: 500_000 },
      { dateFin: '2024-12-31', montant: 300_000 },
    ],
  });
  if (!/^[0-9a-f-]{36}$/i.test(a26)) throw new Error(`Identifiant d'exercice inattendu · ${a26}`);
  const origines = JSON.stringify([
    { dateFin: '2022-12-31', montant: 500_000 },
    { dateFin: '2023-12-31', montant: 300_000 },
  ]);
  execFileSync(
    'psql',
    [
      process.env.OMEGAX_BASE_JETABLE,
      '-v',
      'ON_ERROR_STOP=1',
      '-qc',
      `UPDATE dossiers_fiscaux_exercice SET "deficitAnterieurOrigines" = '${origines}'::jsonb WHERE "exerciceId" = '${a26}'`,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  const a27 = await exercice(c, '2027-01-01', '2027-12-31');
  await venteEtCharges(c, a27, '2027-06-30', 1_000_000, []);
  await valider(c, a27, '2027-12-31');
  const brut = await fiscal(c, a26);
  return {
    a2026: { ...lecture(brut), montantSaisi: brut.deficitAnterieur?.montantSaisi, origines: brut.deficitAnterieur?.origines },
    a2027: lecture(await fiscal(c, a27)),
  };
});

cas('V6', 'Report de 800 000 (origine 2025) ramené à 600 000 par la saisie seule · l\'origine caduque tombe, puis se redéclare', async () => {
  const c = await dossier('Cas IS V6', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const a26 = c.exercices.get('2026-01-01');
  await venteEtCharges(c, a26, '2026-06-30', 300_000, []);
  await valider(c, a26, '2026-12-31');
  await c.ok('PATCH', `/fiscalite/exercices/${a26}/dossier`, {
    deficitAnterieurSaisi: 800_000,
    deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: 800_000 }],
  });
  const a27 = await exercice(c, '2027-01-01', '2027-12-31');
  await venteEtCharges(c, a27, '2027-06-30', 200_000, []);
  await valider(c, a27, '2027-12-31');
  const a28 = await exercice(c, '2028-01-01', '2028-12-31');
  await venteEtCharges(c, a28, '2028-06-30', 1_000_000, []);
  await valider(c, a28, '2028-12-31');
  // L'écran envoie le montant seul (FiscalitePage, champ « Déficits antérieurs »).
  await c.ok('PATCH', `/fiscalite/exercices/${a26}/dossier`, { deficitAnterieurSaisi: 600_000 });
  const brut26 = await fiscal(c, a26);
  const apresSaisieSeule = {
    a2026: { ...lecture(brut26), origines: brut26.deficitAnterieur?.origines },
    a2028: lecture(await fiscal(c, a28)),
  };
  await c.ok('PATCH', `/fiscalite/exercices/${a26}/dossier`, {
    deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: 600_000 }],
  });
  const clotures = await cloturer(c, [['2026', a26], ['2027', a27]]);
  return {
    apresSaisieSeule,
    clotures,
    apresRedeclaration: { a2026: lecture(await fiscal(c, a26)), a2027: lecture(await fiscal(c, a27)), a2028: lecture(await fiscal(c, a28)) },
  };
});

// --- Exécution --------------------------------------------------------------

const resultats = {};
// OMEGAX_CAS=V3,V6 · ne rejoue que les cas nommés (tous par défaut).
const filtre = process.env.OMEGAX_CAS ? new Set(process.env.OMEGAX_CAS.split(',')) : null;
for (const { code, titre, fn } of CAS.filter((x) => !filtre || filtre.has(x.code))) {
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
