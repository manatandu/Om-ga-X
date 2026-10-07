#!/usr/bin/env node
/**
 * REJEU DES CAS CHIFFRÉS DE LA PAIE · docs/cas-chiffres/paie.md.
 *
 * Méthode décidée par Manasse le 2026-10-04 pour l'IS, reprise à l'identique ·
 * on part des CALCULS. Chaque cas est calculé à la main dans le document,
 * texte par texte (Code du travail ; loi n° 23/053, art. 68 à 71, 116 à 125,
 * 150 ; décret n° 18/041 ; arrêtés INPP de 2006 et 2025 ; arrêté ONEM
 * n° 028/2025 ; décrets n° 25/21 et 25/22 ; arrêté n° 12/CAB.MIN/TPS/110/2005 ;
 * fiches des comptes 42, 43 et 66), puis rejoué ici dans OmegaX, sur une
 * VRAIE base, par l'API du serveur compilé · inscription d'un dossier,
 * registre du personnel, simulation, émission du bulletin, passation de la
 * paie du mois, validation, clôture quand le cas la demande, puis lecture de
 * ce qu'OmegaX rend.
 *
 * Ce script NE CORRIGE RIEN et NE TRANCHE RIEN · il relève. Chaque montant
 * attendu porté ici est celui du document, recopié pour que l'écart s'imprime
 * au rejeu, au centime (`comparer`).
 *
 * Usage (serveur compilé démarré contre une base JETABLE, jamais celle de
 * production, avec INSCRIPTION_PUBLIQUE=true) :
 *
 *   OMEGAX_API=http://localhost:8131 node scripts/cas-chiffres/rejeu-paie.mjs [sortie.json]
 *
 * OMEGAX_CAS=P01,P14 · ne rejoue que les cas nommés (tous par défaut).
 */
import { writeFileSync } from 'node:fs';

const BASE = process.env.OMEGAX_API ?? 'http://localhost:8131';
const MOT_DE_PASSE = 'MotDePasse-cas-paie-2026!';
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
      throw new Error(`${methode} ${chemin} · ${r.statut} · ${JSON.stringify(r.corps).slice(0, 900)}`);
    }
    return r.corps;
  }
}

// --- Comparaison au centime --------------------------------------------------

const ecarts = [];
let comparaisons = 0;
const auCentime = (x) => (x === null || x === undefined ? x : Math.round(x * 100) / 100);

/**
 * Compare une grandeur rendue par OmegaX à l'attendu du document, AU CENTIME.
 * `null` attendu veut dire « non chiffré » · il ne se confond jamais avec zéro.
 */
function comparer(cas, grandeur, attendu, rendu) {
  comparaisons += 1;
  const a = typeof attendu === 'number' ? auCentime(attendu) : attendu;
  const r = typeof rendu === 'number' ? auCentime(rendu) : rendu;
  const egal = typeof a === 'number' && typeof r === 'number' ? Math.abs(a - r) < 0.005 : a === r;
  if (!egal) ecarts.push({ cas, grandeur, attendu: a, rendu: r });
  return { grandeur, attendu: a, rendu: r, egal };
}

// --- Dossiers et registre ------------------------------------------------------

/** Un dossier neuf · SYSCOHADA (société) ou SYCEBNL (association). */
async function dossier(nom, referentiel = 'SYSCOHADA', forme = 'SOCIETE_RESPONSABILITE_LIMITEE') {
  const c = new Client();
  await c.ok('POST', '/auth/register', {
    nomEntite: nom,
    referentiel,
    ...(referentiel === 'SYSCOHADA'
      ? { systemeComptableSyscohada: 'NORMAL' }
      : { jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' }),
    email: `cas-paie-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.cd`,
    motDePasse: MOT_DE_PASSE,
  });
  if (referentiel === 'SYSCOHADA' && forme) {
    await c.ok('PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: forme });
  }
  const comptes = await c.ok('GET', '/comptes?typeCompte=DETAIL');
  c.comptes = new Map(comptes.map((x) => [x.numero, x.id]));
  c.numeros = new Map(comptes.map((x) => [x.id, x.numero]));
  const journaux = await c.ok('GET', '/journaux');
  c.journaux = journaux;
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

/** Un salarié et son contrat à durée indéterminée, mensuel, en francs. */
async function salarie(c, nom, { entree = '2025-01-01', salaire = 1_000_000, classe = 5, devise = 'CDF', enfants = 0, conjoint = null } = {}) {
  const s = await c.ok('POST', '/personnel/salaries', {
    nom,
    sexe: 'MASCULIN',
    nationalite: 'congolaise',
    ...(conjoint ? { nomConjoint: conjoint } : {}),
    ...(enfants ? { enfants: Array.from({ length: enfants }, (_, i) => ({ nom: `${nom} enfant ${i + 1}` })) } : {}),
  });
  const k = await c.ok('POST', `/personnel/salaries/${s.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: entree,
    natureTravail: 'Comptable',
    classeProfessionnelle: classe,
    periodiciteRemuneration: 'MOIS',
    remunerationBase: salaire,
    deviseRemuneration: devise,
  });
  return { id: s.id, contratId: k.id };
}

const SALAIRE = (montantFc, libelle = 'Salaire de base') => ({ nature: 'SALAIRE_OU_TRAITEMENT', libelle, montantFc });

/** Le corps d'une paie · employeur privé de trente travailleurs, sauf mention. */
const paie = (moisDePaie, elements, plus = {}) => ({
  moisDePaie,
  elements,
  natureEmployeurInpp: 'PRIVE',
  effectif: 30,
  regimeSalarial: 'BAREME_ARTICLE_118',
  ...plus,
});

const simuler = (c, corps, salarieId) =>
  c.req('POST', `/personnel/simulation${salarieId ? `?salarieId=${salarieId}` : ''}`, corps);
const emettre = (c, salarieId, corps) => c.req('POST', `/personnel/salaries/${salarieId}/bulletins`, corps);

/** Ce qu'une simulation rend, réduit aux montants que le document compare. */
function lectureSimulation(s) {
  if (!s || typeof s !== 'object' || !s.cotisations) return { brut: s };
  const ligne = (cle) => s.cotisations.lignes.find((l) => l.cle === cle);
  return {
    assietteSociale: s.assiettes?.assietteSocialeFc ?? null,
    assietteFiscaleBrute: s.assiettes?.assietteFiscaleBruteFc ?? null,
    retenuesArticle71: s.assiettes?.retenuesArticle71Fc ?? null,
    assietteFiscaleNette: s.assiettes?.assietteFiscaleNetteFc ?? null,
    cnssPf: ligne('cnss-pf')?.montantFc ?? null,
    cnssPensionEmployeur: ligne('cnss-pension-employeur')?.montantFc ?? null,
    cnssPensionTravailleur: ligne('cnss-pension-travailleur')?.montantFc ?? null,
    cnssRp: ligne('cnss-rp')?.montantFc ?? null,
    baseCnss: ligne('cnss-pension-travailleur')?.assietteFc ?? ligne('cnss-rp')?.assietteFc ?? null,
    inppTaux: ligne('inpp')?.tauxPourCent ?? null,
    inpp: ligne('inpp')?.montantFc ?? null,
    onemTaux: ligne('onem')?.tauxPourCent ?? null,
    onem: ligne('onem')?.montantFc ?? null,
    totalEmployeur: s.cotisations.totalEmployeurFc,
    totalTravailleur: s.cotisations.totalTravailleurFc,
    abstentionsCotisations: s.cotisations.abstentions,
    plancherCnss: s.cotisations.plancherCnss ?? null,
    revenuAnnualise: s.retenue?.revenuAnnualiseFc ?? null,
    assietteArrondieAnnuelle: s.retenue?.annuel?.assietteArrondieFc ?? null,
    impotBaremeAnnuel: s.retenue?.annuel?.impotDuBaremeFc ?? null,
    plafondApplique: s.retenue?.annuel?.plafondApplique ?? null,
    impotArticle118Annuel: s.retenue?.annuel?.impotArticle118Fc ?? null,
    baseQuotite: s.retenue?.annuel?.baseDeLaQuotiteFc ?? null,
    reductionAnnuelle: s.retenue?.annuel?.reductionFc ?? null,
    impotAnnuel: s.retenue?.annuel?.impotDuFc ?? null,
    retenueAvantArrondi: s.retenue?.mensuel?.retenueAvantArrondiFc ?? null,
    irpp: s.retenue ? s.retenue.retenueFc : null,
    totalVerse: s.net?.totalVerseFc ?? null,
    net: s.net?.netAPayerFc ?? null,
    tauxLegalAF: s.tauxLegalAllocationsFamilialesFc ?? null,
    abstentionsFiscales: (s.assiettes?.abstentions ?? []).map((a) => a.motif),
    sortsFiscaux: (s.assiettes?.sortsFiscaux ?? []).map((x) => `${x.libelle} · ${x.imposableFc}`),
    reservesAssiettes: s.assiettes?.reserves ?? [],
    quotite: s.quotite
      ? {
          base: s.quotite.baseFc,
          forfaitLogement: s.quotite.evaluationForfaitaireLogementFc,
          seuil: s.quotite.seuilFc,
          ordinaire: s.quotite.quotiteOrdinaireFc,
          alimentaire: s.quotite.quotiteAlimentaireFc,
          cumulee: s.quotite.quotiteCumuleeFc,
          abstentions: s.quotite.abstentions.map((a) => a.motif),
        }
      : null,
    passation: s.passation
      ? {
          refus: s.passation.refus.map((r) => r.motif),
          lignes: s.passation.lignes.map((l) => `${l.bloc} ${l.sens === 'DEBIT' ? 'D' : 'C'} ${l.compte} ${auCentime(l.montantFc)}`),
        }
      : null,
    conversion: s.conversion ? { cours: s.conversion.cours, dateCours: s.conversion.dateCours, elements: s.conversion.elements } : null,
    personnesAChargeRetenues: s.personnesAChargeRetenues,
    propositionPersonnesACharge: s.propositionPersonnesACharge,
    reservesRetenue: s.retenue?.reserves ?? [],
    baremeApplicable: s.baremeApplicable,
  };
}

/** Compare une simulation à un jeu d'attendus nommés comme `lectureSimulation`. */
function confronter(cas, lu, attendus) {
  return Object.entries(attendus).map(([k, v]) => comparer(cas, k, v, lu[k]));
}

// --- Les cas --------------------------------------------------------------------

const CAS = [];
const cas = (code, titre, fn) => CAS.push({ code, titre, fn });

cas('P01', 'Salarié mensuel en francs, sans avantage, 1 000 100 FC (mars 2026)', async () => {
  const c = await dossier('Cas paie 01');
  const s = await salarie(c, 'KABONGO', { salaire: 1_000_100 });
  const r = await simuler(c, paie('2026-03', [SALAIRE(1_000_100)]), s.id);
  const lu = lectureSimulation(r.corps);
  const comparaison = confronter('P01', lu, {
    assietteSociale: 1_000_100,
    cnssPf: 65_006.5,
    cnssPensionEmployeur: 50_005,
    cnssPensionTravailleur: 50_005,
    cnssRp: 15_001.5,
    inpp: 35_003.5,
    onem: 5_000.5,
    totalEmployeur: 170_017,
    assietteFiscaleNette: 950_095,
    assietteArrondieAnnuelle: 11_401_000,
    impotAnnuel: 1_476_870,
    retenueAvantArrondi: 123_072.5,
    irpp: 123_100,
    net: 826_995,
  });
  const e = await emettre(c, s.id, paie('2026-03', [SALAIRE(1_000_100)]));
  return { statut: r.statut, lu, comparaison, emission: { statut: e.statut, numero: e.corps?.numero, net: e.corps?.netAPayerFc, irpp: e.corps?.irppFc } };
});

cas('P02', 'Personnes à charge (art. 123 à 125) · 0, 3 et 11 déclarées, proposition du registre', async () => {
  const c = await dossier('Cas paie 02');
  const s = await salarie(c, 'MBUYI', { salaire: 1_000_100, conjoint: 'MBUYI Marie', enfants: 2 });
  const corps = (pac) => paie('2026-03', [SALAIRE(1_000_100)], pac === undefined ? {} : { personnesACharge: pac });
  const sans = lectureSimulation((await simuler(c, corps(undefined), s.id)).corps);
  const trois = lectureSimulation((await simuler(c, corps(3), s.id)).corps);
  const onze = lectureSimulation((await simuler(c, corps(11), s.id)).corps);
  return {
    sans,
    trois,
    onze,
    comparaison: [
      comparer('P02', 'proposition du registre', 3, sans.propositionPersonnesACharge),
      comparer('P02', 'retenues sans déclaration', 0, sans.personnesAChargeRetenues),
      comparer('P02', 'IRPP sans déclaration', 123_100, sans.irpp),
      ...confronter('P02', trois, { reductionAnnuelle: 88_612.2, impotAnnuel: 1_388_257.8, retenueAvantArrondi: 115_688.15, irpp: 115_700, net: 834_395 }),
      ...confronter('P02', onze, { reductionAnnuelle: 265_836.6, impotAnnuel: 1_211_033.4, irpp: 100_900, net: 849_195 }),
    ],
  };
});

cas('P03', 'Haut salaire · plafond de 30 % (art. 118), seuil de 77 932 800 FC, quotité sur l\'impôt plafonné', async () => {
  const c = await dossier('Cas paie 03');
  const s = await salarie(c, 'TSHIMANGA', { salaire: 8_000_000, classe: 17 });
  const lire = async (brut, plus = {}) => lectureSimulation((await simuler(c, paie('2026-03', [SALAIRE(brut)], plus), s.id)).corps);
  const haut = await lire(8_000_000);
  const hautQuatre = await lire(8_000_000, { personnesACharge: 4 });
  const sousSeuil = await lire(6_836_000);
  const surSeuil = await lire(6_837_000);
  return {
    haut,
    hautQuatre,
    sousSeuil,
    surSeuil,
    comparaison: [
      ...confronter('P03', haut, {
        cnssPensionTravailleur: 400_000,
        assietteFiscaleNette: 7_600_000,
        assietteArrondieAnnuelle: 91_200_000,
        impotBaremeAnnuel: 28_686_720,
        plafondApplique: true,
        impotArticle118Annuel: 27_360_000,
        irpp: 2_280_000,
        net: 5_320_000,
      }),
      ...confronter('P03', hautQuatre, { baseQuotite: 9_486_720, reductionAnnuelle: 758_937.6, impotAnnuel: 26_601_062.4, irpp: 2_216_800, net: 5_383_200 }),
      // Décision par la loi du 2026-10-07, troisième lot, point 2 · la réduction du plafond se rapporte à la
      // part au-delà de la troisième tranche ; la quotité joue sur l'impôt du barème des trois premières, la règle est dite.
      comparer('P03', 'règle · quotité sur l\'impôt des trois premières tranches (9 486 720)', true, hautQuatre.reservesRetenue.some((x) => x.includes('se rapporte à la seule part du revenu imposable qui excède la troisième tranche') && x.includes('reste celui du barème, 9486720.00 FC'))),
      ...confronter('P03', sousSeuil, { assietteArrondieAnnuelle: 77_930_000, impotBaremeAnnuel: 23_378_720, plafondApplique: false, irpp: 1_948_200 }),
      ...confronter('P03', surSeuil, { assietteArrondieAnnuelle: 77_941_000, impotBaremeAnnuel: 23_383_120, plafondApplique: true, impotArticle118Annuel: 23_382_300, irpp: 1_948_500 }),
    ],
  };
});

const LOGEMENT = (montantFc, plus = {}) => ({ nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Indemnité de logement', montantFc, ...plus });

cas('P04', 'Indemnité de logement · 30 % exacts (immunisée) et 40 % (imposée en entier, art. 69, 8, a)', async () => {
  const c = await dossier('Cas paie 04');
  const s = await salarie(c, 'ILUNGA');
  const trente = lectureSimulation((await simuler(c, paie('2026-03', [SALAIRE(1_000_000), LOGEMENT(300_000)]), s.id)).corps);
  const quarante = lectureSimulation((await simuler(c, paie('2026-03', [SALAIRE(1_000_000), LOGEMENT(400_000)]), s.id)).corps);
  return {
    trente,
    quarante,
    comparaison: [
      ...confronter('P04', trente, { assietteSociale: 1_000_000, cnssPensionTravailleur: 50_000, assietteFiscaleBrute: 1_000_000, irpp: 123_100, totalVerse: 1_300_000, net: 1_126_900 }),
      ...confronter('P04', quarante, { assietteSociale: 1_000_000, assietteFiscaleBrute: 1_400_000, assietteFiscaleNette: 1_350_000, irpp: 183_100, net: 1_166_900 }),
      // Décision T3 · la condition est tranchée par le texte · l'autre lecture ne se chiffre plus en réserve.
      comparer('P04', 'autre lecture retirée de la réserve', false, quarante.reservesAssiettes.some((x) => x.includes('100000.00 FC'))),
    ],
  };
});

cas('P05', 'Transport et soins · non attestés (abstention), attestés, non remplis (art. 69, 8, b et c)', async () => {
  const c = await dossier('Cas paie 05');
  const s = await salarie(c, 'LUMBALA');
  const elements = (atteste) => [
    SALAIRE(1_000_000),
    { nature: 'INDEMNITE_DE_TRANSPORT', libelle: 'Transport', montantFc: 100_000, ...(atteste === undefined ? {} : { conditionArticle69Attestee: atteste }) },
    { nature: 'SOINS_DE_SANTE', libelle: 'Frais médicaux', montantFc: 50_000, ...(atteste === undefined ? {} : { conditionArticle69Attestee: atteste }) },
  ];
  const absent = lectureSimulation((await simuler(c, paie('2026-03', elements(undefined)), s.id)).corps);
  const emissionAbsent = await emettre(c, s.id, paie('2026-03', elements(undefined)));
  const atteste = lectureSimulation((await simuler(c, paie('2026-03', elements(true)), s.id)).corps);
  const nonRempli = lectureSimulation((await simuler(c, paie('2026-03', elements(false)), s.id)).corps);
  const transportSeul = lectureSimulation(
    (await simuler(c, paie('2026-03', [SALAIRE(1_000_000), { nature: 'INDEMNITE_DE_TRANSPORT', libelle: 'Transport', montantFc: 100_000, conditionArticle69Attestee: true }]), s.id)).corps,
  );
  return {
    absent,
    emissionAbsent: { statut: emissionAbsent.statut, message: emissionAbsent.corps?.message },
    atteste,
    nonRempli,
    transportSeul,
    comparaison: [
      ...confronter('P05', absent, { assietteSociale: 1_000_000, cnssPensionTravailleur: 50_000, assietteFiscaleBrute: null, irpp: null, net: null }),
      comparer('P05', 'émission refusée sans attestation', 400, emissionAbsent.statut),
      ...confronter('P05', atteste, { assietteFiscaleBrute: 1_000_000, irpp: 123_100, totalVerse: 1_150_000, net: 976_900 }),
      ...confronter('P05', nonRempli, { assietteFiscaleBrute: 1_150_000, irpp: 145_600, net: 954_400 }),
      ...confronter('P05', transportSeul, { irpp: 123_100, net: 926_900 }),
    ],
  };
});

cas('P06', 'Avantages en nature · logement fourni en nature et véhicule (6617 / 781, hors du net)', async () => {
  const c = await dossier('Cas paie 06');
  const s = await salarie(c, 'MUKENDI');
  const corps = paie('2026-03', [
    SALAIRE(1_000_000),
    LOGEMENT(250_000, { libelle: 'Logement fourni', enNature: true }),
    { nature: 'AVANTAGE_EN_NATURE', libelle: 'Véhicule de fonction (usage privé)', montantFc: 200_000 },
  ]);
  const lu = lectureSimulation((await simuler(c, corps, s.id)).corps);
  const e = await emettre(c, s.id, corps);
  return {
    lu,
    emission: { statut: e.statut, net: e.corps?.netAPayerFc },
    comparaison: [
      ...confronter('P06', lu, {
        assietteSociale: 1_200_000,
        cnssPensionTravailleur: 60_000,
        totalEmployeur: 204_000,
        assietteFiscaleBrute: 1_200_000,
        assietteFiscaleNette: 1_140_000,
        irpp: 151_600,
        totalVerse: 1_000_000,
        net: 788_400,
      }),
      comparer('P06', 'passation · 6617 au débit', true, lu.passation.lignes.includes('AVANTAGES_EN_NATURE D 66170000 450000')),
      comparer('P06', 'passation · 781 au crédit', true, lu.passation.lignes.includes('AVANTAGES_EN_NATURE C 78100000 450000')),
      comparer('P06', 'passation · 422 crédité du versé', true, lu.passation.lignes.includes('BRUT C 42200000 1000000')),
      comparer('P06', 'net émis', 788_400, Number(e.corps?.netAPayerFc)),
    ],
  };
});

cas('P07', 'Plancher CNSS au SMIG du manœuvre (décret n° 18/041, art. 8) · 2026 et mai à décembre 2025', async () => {
  const c = await dossier('Cas paie 07');
  const s = await salarie(c, 'NGOY', { salaire: 400_000, classe: 1 });
  const lire = async (mois, brut, plus = {}) => lectureSimulation((await simuler(c, paie(mois, [SALAIRE(brut)], plus), s.id)).corps);
  const declares = await lire('2026-03', 400_000, { joursPayes: 26 });
  const sansJours = await lire('2026-03', 400_000);
  const emissionSansJours = await emettre(c, s.id, paie('2026-03', [SALAIRE(400_000)]));
  const treizeJours = await lire('2026-04', 250_000, { joursPayes: 13 });
  const nov2025Bas = await lire('2025-11', 400_000, { joursPayes: 26 });
  const nov2025Haut = await lire('2025-11', 600_000, { joursPayes: 26 });
  // Décision T4 · de mai à décembre 2025, le plancher est le SMIG PAYÉ · 14 500 × 26 = 377 000.
  const nov2025TresBas = await lire('2025-11', 300_000, { joursPayes: 26 });
  const nov2025SansJours = await lire('2025-11', 300_000);
  // Le contrat lui-même · 400 000 FC par mois en classe 1, sous le minimum
  // (21 500 × 26 = 559 000, décret n° 25/22, art. 2 et 7) · le registre doit
  // le dire (décret n° 25/21, art. 3 ; Code du travail, art. 37).
  const confrontation = await c.ok('GET', '/personnel/confrontation');
  const fiche = confrontation.fiches.find((f) => f.salarieId === s.id);
  return {
    minimum: fiche?.remunerationMinimale ?? null,
    declares,
    sansJours,
    emissionSansJours: { statut: emissionSansJours.statut, motifs: emissionSansJours.corps?.motifs },
    treizeJours,
    nov2025Bas,
    nov2025Haut,
    nov2025TresBas,
    nov2025SansJours,
    comparaison: [
      ...confronter('P07', declares, {
        baseCnss: 559_000,
        cnssPensionTravailleur: 27_950,
        cnssPf: 36_335,
        cnssRp: 8_385,
        inpp: 14_000,
        onem: 2_000,
        assietteFiscaleNette: 372_050,
        irpp: 36_400,
        net: 335_650,
      }),
      // Sans les jours payés, la CNSS s'abstient · la quote-part ouvrière
      // n'étant pas chiffrée, l'assiette fiscale nette (art. 71) ne l'est pas,
      // et l'impôt et le net non plus (null n'est pas zéro).
      ...confronter('P07', sansJours, { cnssPensionTravailleur: null, assietteFiscaleNette: null, irpp: null, net: null }),
      comparer('P07', 'émission refusée sans jours payés', 400, emissionSansJours.statut),
      ...confronter('P07', treizeJours, { baseCnss: 279_500, cnssPensionTravailleur: 13_975, irpp: 16_000, net: 220_025 }),
      ...confronter('P07', nov2025Bas, { baseCnss: 400_000, cnssPensionTravailleur: 20_000, irpp: null, net: null }),
      ...confronter('P07', nov2025TresBas, { baseCnss: 377_000, cnssPensionTravailleur: 18_850, irpp: null }),
      ...confronter('P07', nov2025SansJours, { cnssPensionTravailleur: null, irpp: null, net: null }),
      ...confronter('P07', nov2025Haut, { baseCnss: 600_000, cnssPensionTravailleur: 30_000, inpp: 21_000, onem: 3_000, irpp: null }),
      comparer('P07', 'contrat sous le minimum de sa classe signalé', false, fiche?.remunerationMinimale?.conforme ?? null),
    ],
  };
});

cas('P08', 'INPP · public, privé par tranche d\'effectif, avant et après le 24 septembre 2025 ; ONEM', async () => {
  const c = await dossier('Cas paie 08');
  const lire = async (mois, nature, effectif) =>
    lectureSimulation(
      (await simuler(c, { moisDePaie: mois, elements: [SALAIRE(1_000_000)], regimeSalarial: 'BAREME_ARTICLE_118', ...(nature ? { natureEmployeurInpp: nature } : {}), ...(effectif === undefined ? {} : { effectif }) })).corps,
    );
  const grille = [
    ['2026-03', 'PUBLIC', 10, 40_000, 5_000],
    ['2026-03', 'PRIVE', 50, 35_000, 5_000],
    ['2026-03', 'PRIVE', 51, 30_000, 5_000],
    ['2026-03', 'PRIVE', 300, 30_000, 5_000],
    ['2026-03', 'PRIVE', 301, 20_000, 5_000],
    ['2025-08', 'PUBLIC', 10, 30_000, 2_000],
    ['2025-08', 'PRIVE', 50, 30_000, 2_000],
    ['2025-08', 'PRIVE', 51, 20_000, 2_000],
    ['2025-08', 'PRIVE', 301, 10_000, 2_000],
    ['2025-09', 'PRIVE', 50, 35_000, 5_000],
  ];
  const comparaison = [];
  const lectures = {};
  for (const [mois, nature, effectif, inpp, onem] of grille) {
    const lu = await lire(mois, nature, effectif);
    lectures[`${mois} ${nature} ${effectif}`] = { inppTaux: lu.inppTaux, inpp: lu.inpp, onemTaux: lu.onemTaux, onem: lu.onem };
    comparaison.push(comparer('P08', `INPP ${mois} ${nature} ${effectif}`, inpp, lu.inpp), comparer('P08', `ONEM ${mois}`, onem, lu.onem));
  }
  const sansEffectif = await lire('2026-03', 'PRIVE', undefined);
  const sansNature = await lire('2026-03', undefined, 30);
  // Décision T5 · en septembre 2025, l'INPP suit la date de mise à disposition de la rémunération.
  const auJour = async (date) =>
    lectureSimulation(
      (await simuler(c, { moisDePaie: '2025-09', elements: [SALAIRE(1_000_000)], regimeSalarial: 'BAREME_ARTICLE_118', natureEmployeurInpp: 'PRIVE', effectif: 50, dateMiseADisposition: date })).corps,
    );
  const verse20 = await auJour('2025-09-20');
  const verse30 = await auJour('2025-09-30');
  lectures['2025-09 PRIVE 50 versé le 20'] = { inpp: verse20.inpp, onem: verse20.onem };
  lectures['2025-09 PRIVE 50 versé le 30'] = { inpp: verse30.inpp, onem: verse30.onem };
  comparaison.push(
    comparer('P08', 'INPP septembre 2025 versé le 20 (barème de 2006, 3 %)', 30_000, verse20.inpp),
    comparer('P08', 'INPP septembre 2025 versé le 30 (barème de 2025, 3,5 %)', 35_000, verse30.inpp),
    comparer('P08', 'INPP privé sans effectif (abstention)', null, sansEffectif.inpp),
    comparer('P08', 'INPP sans nature (abstention)', null, sansNature.inpp),
    comparer('P08', 'net sans nature (l\'INPP est patronal)', 826_900, sansNature.net),
  );
  return { lectures, sansEffectif: sansEffectif.abstentionsCotisations, sansNature: sansNature.abstentionsCotisations, comparaison };
});

/** Le jour de Kinshasa (UTC+1), AAAA-MM-JJ · celui que la paie en dollars lit. */
function jourDeKinshasa(decalageJours = 0) {
  const d = new Date(Date.now() + 3_600_000 + decalageJours * 86_400_000);
  return d.toISOString().slice(0, 10);
}

cas('P09', 'Salaire stipulé en dollars · converti au cours du jour de Kinshasa ; refus nommé sans cours du jour', async () => {
  const c = await dossier('Cas paie 09');
  const s = await salarie(c, 'KASONGO', { salaire: 500, devise: 'USD' });
  const devises = await c.ok('GET', '/devises');
  let usd = devises.find((d) => d.code === 'USD');
  if (!usd) usd = await c.ok('POST', '/devises', { code: 'USD', intitule: 'Dollar américain' });
  const corps = paie('2026-03', [
    { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire (USD)', montantUsd: 500 },
    { nature: 'PRIME', libelle: 'Prime (USD)', montantUsd: 120.5 },
  ], { deviseStipulation: 'USD' });
  const sansCours = await simuler(c, corps, s.id);
  // Le cours de la VEILLE seul · il ne doit pas être repris.
  await c.ok('POST', `/devises/${usd.id}/cours`, { date: jourDeKinshasa(-1), cours: 2_800, source: 'Cas chiffré · veille' });
  const coursVeille = await simuler(c, corps, s.id);
  await c.ok('POST', `/devises/${usd.id}/cours`, { date: jourDeKinshasa(0), cours: 2_850.25, source: 'Cas chiffré · BCC du jour' });
  const lu = lectureSimulation((await simuler(c, corps, s.id)).corps);
  // Décision T8 · la rémunération mise à disposition la veille se convertit au cours de la veille.
  const miseLaVeille = lectureSimulation((await simuler(c, { ...corps, dateMiseADisposition: jourDeKinshasa(-1) }, s.id)).corps);
  const e = await emettre(c, s.id, corps);
  return {
    miseLaVeille: miseLaVeille.conversion,
    sansCours: { statut: sansCours.statut, message: sansCours.corps?.message },
    coursVeille: { statut: coursVeille.statut, message: coursVeille.corps?.message },
    lu,
    emission: { statut: e.statut, net: e.corps?.netAPayerFc, conversion: e.corps?.calcul?.conversion ?? null },
    comparaison: [
      comparer('P09', 'refus sans aucun cours', 400, sansCours.statut),
      comparer('P09', 'refus avec le seul cours de la veille', 400, coursVeille.statut),
      comparer('P09', 'cours appliqué', 2_850.25, lu.conversion?.cours),
      comparer('P09', 'date du cours', jourDeKinshasa(0), lu.conversion?.dateCours),
      comparer('P09', 'prime convertie (centime supérieur)', 343_455.13, lu.conversion?.elements?.[1]?.montantFc),
      comparer('P09', 'mise à disposition la veille · cours de la veille', 2_800, miseLaVeille.conversion?.cours),
      comparer('P09', 'mise à disposition la veille · prime convertie', 337_400, miseLaVeille.conversion?.elements?.[1]?.montantFc),
      ...confronter('P09', lu, {
        assietteSociale: 1_768_580.13,
        cnssPensionTravailleur: 88_429.0065,
        totalEmployeur: 300_658.6221,
        assietteFiscaleNette: 1_680_151.1235,
        assietteArrondieAnnuelle: 20_161_000,
        irpp: 232_600,
        net: 1_447_551.1235,
      }),
      comparer('P09', 'net émis (Decimal 18,2)', 1_447_551.12, Number(e.corps?.netAPayerFc)),
    ],
  };
});

cas('P10', 'Avance (4211) et prêt (2728) · retenues à l\'émission, solde calculé, dépassement et net négatif refusés', async () => {
  const c = await dossier('Cas paie 10');
  const s = await salarie(c, 'KALALA');
  const avance = await c.ok('POST', `/personnel/salaries/${s.id}/avances`, {
    type: 'AVANCE',
    dateOctroi: '2026-02-10',
    montantFc: 300_000,
    retenueMensuelleFc: 100_000,
    objet: 'Avance sur salaire',
    pieceJustificative: 'Reçu n° A-001',
  });
  const pret = await c.ok('POST', `/personnel/salaries/${s.id}/avances`, {
    type: 'PRET',
    categoriePret: 'AUTRE',
    dateOctroi: '2026-01-15',
    montantFc: 1_200_000,
    retenueMensuelleFc: 200_000,
    objet: 'Prêt au personnel',
    pieceJustificative: 'Contrat de prêt n° P-001',
  });
  const soldes = async () => {
    const l = await c.ok('GET', `/personnel/avances?salarieId=${s.id}`);
    const liste = Array.isArray(l) ? l : (l.avances ?? l.lignes ?? []);
    const de = (id) => liste.find((a) => a.id === id);
    return { avance: de(avance.id)?.soldeFc ?? null, pret: de(pret.id)?.soldeFc ?? null, brut: Array.isArray(l) ? null : Object.keys(l) };
  };
  const mars = paie('2026-03', [SALAIRE(1_000_000)], {
    retenuesAvances: [
      { avanceId: avance.id, montantFc: 100_000 },
      { avanceId: pret.id, montantFc: 200_000 },
    ],
  });
  const lu = lectureSimulation((await simuler(c, mars, s.id)).corps);
  const eMars = await emettre(c, s.id, mars);
  const apresMars = await soldes();
  const avrilTrop = await emettre(c, s.id, paie('2026-04', [SALAIRE(1_000_000)], { retenuesAvances: [{ avanceId: avance.id, montantFc: 250_000 }] }));
  const eAvril = await emettre(
    c,
    s.id,
    paie('2026-04', [SALAIRE(1_000_000)], { retenuesAvances: [{ avanceId: avance.id, montantFc: 200_000 }, { avanceId: pret.id, montantFc: 200_000 }] }),
  );
  const apresAvril = await soldes();
  const annulation = await c.req('POST', `/personnel/bulletins/${eAvril.corps?.id}/annulation`, { motif: 'Cas chiffré · retenue à refaire' });
  const apresAnnulation = await soldes();
  const mai = await simuler(c, paie('2026-05', [SALAIRE(1_000_000)], { retenuesAvances: [{ avanceId: pret.id, montantFc: 1_000_000 }] }), s.id);
  return {
    lu,
    emissionMars: { statut: eMars.statut, net: eMars.corps?.netAPayerFc },
    apresMars,
    avrilTrop: { statut: avrilTrop.statut, message: avrilTrop.corps?.message },
    emissionAvril: { statut: eAvril.statut, net: eAvril.corps?.netAPayerFc },
    apresAvril,
    annulation: { statut: annulation.statut },
    apresAnnulation,
    maiNetNegatif: { statut: mai.statut, message: mai.corps?.message },
    comparaison: [
      ...confronter('P10', lu, { irpp: 123_100, net: 526_900 }),
      comparer('P10', 'passation · 422 débité des retenues', true, lu.passation.lignes.includes('RETENUES D 42200000 473100')),
      comparer('P10', 'passation · 4211 crédité de l\'avance retenue', true, lu.passation.lignes.includes('RETENUES C 42110000 100000')),
      comparer('P10', 'passation · 2728 crédité du prêt retenu', true, lu.passation.lignes.includes('RETENUES C 27280000 200000')),
      comparer('P10', 'net émis en mars', 526_900, Number(eMars.corps?.netAPayerFc)),
      comparer('P10', 'solde de l\'avance après mars', 200_000, apresMars.avance),
      comparer('P10', 'solde du prêt après mars', 1_000_000, apresMars.pret),
      comparer('P10', 'retenue au-delà du solde refusée', 400, avrilTrop.statut),
      comparer('P10', 'net émis en avril', 426_900, Number(eAvril.corps?.netAPayerFc)),
      comparer('P10', 'solde de l\'avance après avril', 0, apresAvril.avance),
      comparer('P10', 'solde du prêt après avril', 800_000, apresAvril.pret),
      comparer('P10', 'solde de l\'avance après annulation d\'avril', 200_000, apresAnnulation.avance),
      comparer('P10', 'solde du prêt après annulation d\'avril', 1_000_000, apresAnnulation.pret),
      comparer('P10', 'net négatif refusé', 400, mai.statut),
    ],
  };
});

const AF = (montantFc) => ({ nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations familiales', montantFc });

cas('P11', 'Allocations familiales · taux légal de la colonne 19 (décret n° 25/22) et immunité de l\'art. 69, 1', async () => {
  const c = await dossier('Cas paie 11');
  const s = await salarie(c, 'BANZA');
  const lire = async (mois, montantAf, plus) => lectureSimulation((await simuler(c, paie(mois, [SALAIRE(1_000_000), AF(montantAf)], plus), s.id)).corps);
  const excedent = await lire('2026-03', 70_000, { enfantsBeneficiairesAllocations: 3 });
  const vingtJours = await lire('2026-03', 70_000, { enfantsBeneficiairesAllocations: 3, joursAllocationsFamiliales: 20 });
  const juste = await lire('2026-03', 62_111.4, { enfantsBeneficiairesAllocations: 3 });
  const sansEnfants = await lire('2026-03', 70_000, {});
  const annexe1 = await lire('2025-11', 70_000, { enfantsBeneficiairesAllocations: 3 });
  return {
    excedent,
    vingtJours,
    juste,
    sansEnfants,
    annexe1: { tauxLegalAF: annexe1.tauxLegalAF },
    comparaison: [
      ...confronter('P11', excedent, { tauxLegalAF: 62_111.4, assietteSociale: 1_000_000, assietteFiscaleBrute: 1_007_888.6, irpp: 124_200, totalVerse: 1_070_000, net: 895_800 }),
      ...confronter('P11', vingtJours, { tauxLegalAF: 47_778, assietteFiscaleBrute: 1_022_222, irpp: 126_400, net: 893_600 }),
      ...confronter('P11', juste, { assietteFiscaleBrute: 1_000_000, irpp: 123_100, net: 889_011.4 }),
      ...confronter('P11', sansEnfants, { tauxLegalAF: null, assietteFiscaleBrute: null, irpp: null, net: null }),
      comparer('P11', 'taux légal annexe 1 (nov. 2025)', 41_889.12, annexe1.tauxLegalAF),
      comparer('P11', 'passation refusée (aucune fiche ne nomme le compte)', true, excedent.passation.refus.includes('NATURE_SANS_IMPUTATION')),
    ],
  };
});

cas('P12', 'Quotité saisissable (art. 114) · logement fourni en nature défalqué (arrêté de 2005, art. 10)', async () => {
  const c = await dossier('Cas paie 12');
  const s = await salarie(c, 'MWAMBA');
  const lire = async (brut, plus, elements = [SALAIRE(brut)]) => lectureSimulation((await simuler(c, paie('2026-03', elements, plus), s.id)).corps);
  const a = await lire(1_000_000, { classeProfessionnelle: 5, logementFourniEnNature: true });
  const b = await lire(1_000_000, { classeProfessionnelle: 5, logementFourniEnNature: true, obligationAlimentaireLegale: true });
  const cDejaDefalque = await lire(1_000_000, { classeProfessionnelle: 5, logementFourniEnNature: true, logementEnNatureDejaDefalque: true });
  const d = await lire(4_000_000, { classeProfessionnelle: 1, logementFourniEnNature: true });
  const e = await lire(1_000_000, { logementFourniEnNature: true });
  // Le logement saisi EN NATURE sur le bulletin, sans la case de l'art. 114.
  const f = await lire(1_000_000, { classeProfessionnelle: 5 }, [SALAIRE(1_000_000), LOGEMENT(250_000, { libelle: 'Logement fourni', enNature: true })]);
  return {
    a: a.quotite,
    b: b.quotite,
    cDejaDefalque: cDejaDefalque.quotite,
    d: d.quotite,
    e: e.quotite,
    f: f.quotite,
    comparaison: [
      comparer('P12', '(a) forfait logement', 4_140.76, a.quotite?.forfaitLogement),
      comparer('P12', '(a) base', 822_759.24, a.quotite?.base),
      comparer('P12', '(a) seuil (5 × 26 × 38 270)', 4_975_100, a.quotite?.seuil),
      comparer('P12', '(a) quotité ordinaire', 164_551.848, a.quotite?.ordinaire),
      comparer('P12', '(b) quotité alimentaire', 329_103.696, b.quotite?.alimentaire),
      comparer('P12', '(b) cumul', 493_655.544, b.quotite?.cumulee),
      comparer('P12', '(c) base sans seconde défalcation', 826_900, cDejaDefalque.quotite?.base),
      comparer('P12', '(c) quotité', 165_380, cDejaDefalque.quotite?.ordinaire),
      comparer('P12', '(d) base', 2_925_259.24, d.quotite?.base),
      comparer('P12', '(d) seuil (5 × 26 × 21 500)', 2_795_000, d.quotite?.seuil),
      comparer('P12', '(d) quotité ordinaire', 602_419.7467, d.quotite?.ordinaire),
      comparer('P12', '(e) sans classe · abstention', null, e.quotite?.ordinaire),
      comparer('P12', '(f) logement en nature au bulletin · forfait défalqué', 4_140.76, f.quotite?.forfaitLogement),
      comparer('P12', '(f) base', 822_759.24, f.quotite?.base),
    ],
  };
});

/** Le verdict du décompte, réduit aux rubriques que le document compare. */
function lectureDecompte(v) {
  if (!v || !v.rubriques) return { brut: v };
  const rub = (cle) => v.rubriques.find((r) => r.cle === cle);
  return {
    preavisJours: v.preavis?.joursOuvrables ?? null,
    motifAucunPreavis: v.preavis?.motifAucunPreavis ? 'oui' : null,
    congeJours: v.conge?.joursOuvrables ?? null,
    arrieres: rub('arrieres')?.montantFc ?? null,
    preavis: rub('preavis')?.montantFc ?? null,
    preavisReserve: rub('preavis')?.reserve ?? null,
    tempsRestant: rub('remuneration-preavis-restant')?.montantFc ?? null,
    dommagesArt70: rub('dommages-interets-art-70')?.montantFc ?? null,
    regleMoisEntame: rub('preavis')?.fondement?.includes('le mois entamé à 1/26 du salaire mensuel par jour payable') ? 'oui' : null,
    conge: rub('conge')?.montantFc ?? null,
    regleMoyenneConge: rub('conge')?.fondement?.includes('ramenée au jour à 1/26') && rub('conge')?.fondement?.includes('par analogie de la loi la plus proche') ? 'oui' : null,
    gratification: rub('gratification')?.montantFc ?? null,
    totalDu: v.totalDuAuTravailleurFc ?? null,
    duParLeTravailleur: (v.duParLeTravailleur ?? []).map((r) => ({ cle: r.cle, montantFc: r.montantFc })),
  };
}

cas('P13', 'Décompte final · licenciement (art. 63, 64, 141 à 144) émis à la place du bulletin de mai ; démission, faute lourde, délégué', async () => {
  const c = await dossier('Cas paie 13');
  const s = await salarie(c, 'LUBOYA', { entree: '2019-03-01', salaire: 1_040_000, classe: 8 });
  const faits = {
    anneesAnciennete: 7,
    moisNonCouvertsParUnConge: 10,
    typeContrat: 'DUREE_INDETERMINEE',
    remunerationJournaliereFc: 40_000,
    moyenneMensuelleArticle66Fc: 52_000,
    moyenneMensuelleArticle142Fc: 52_000,
    avantagesPendantPreavisFc: 0,
    gratificationFc: 0,
    enfantsBeneficiairesAllocations: 0,
    arrieresFc: 120_000,
  };
  const calcul = async (plus) => {
    const r = await c.req('POST', '/personnel/decompte-final', { ...faits, ...plus });
    return { statut: r.statut, ...lectureDecompte(r.corps), message: r.statut >= 400 ? r.corps?.message : undefined };
  };
  const licenciement = await calcul({ initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR', dateNotification: '2026-05-04' });
  const demissionPrestee = await calcul({ initiative: 'TRAVAILLEUR', motif: 'DEMISSION', executionPreavis: 'PRESTE', dateNotification: '2026-05-04' });
  const demissionNonObservee = await calcul({ initiative: 'TRAVAILLEUR', motif: 'DEMISSION', executionPreavis: 'NON_OBSERVE', joursPreavisNonObserves: 31.5, dateNotification: '2026-05-04' });
  // Décision T9 · sans date de notification, le délai ne se place pas · l'indemnité n'est pas chiffrée.
  const sansNotification = await calcul({ initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR' });
  // Décision par la loi du 2026-10-07, troisième lot, point 3 · au mois, les mois entiers au salaire du mois et
  // le mois entamé à 1/26 par jour payable, du lundi au samedi, fériés compris.
  const licenciementAuMois = await calcul({ initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR', dateNotification: '2026-05-04', remunerationMensuelleFc: 1_040_000 });
  // Relecture B1 · délégué de trois ans au mois, notifié le SAMEDI 2 mai · le délai court du dimanche 3 mai.
  const delegueAuMoisSamedi = await calcul({ anneesAnciennete: 3, initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR', delegueSyndical: true, dateNotification: '2026-05-02', remunerationMensuelleFc: 1_040_000 });
  // Relecture M2 · le temps restant à courir (art. 66) et la période jusqu'au terme (art. 70), fériés compris.
  const departAMiPreavis = await calcul({ initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', executionPreavis: 'DEPART_A_MI_PREAVIS', joursPreavisNonObserves: 31.5, avantagesEnNatureRestantsFc: 0, dateNotification: '2026-05-04' });
  const cddRompu = await calcul({ typeContrat: 'DUREE_DETERMINEE', initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', dateRuptureContrat: '2026-06-19', dateTermeContrat: '2026-08-21', avantagesJusquAuTermeFc: 0 });
  const fauteLourde = await calcul({ initiative: 'EMPLOYEUR', motif: 'FAUTE_LOURDE' });
  const delegue = await calcul({ initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR', delegueSyndical: true, dateNotification: '2026-05-04' });
  // Délégué de trois ans · le double (2 × 35 = 70) reste sous le plancher de
  // trois mois (art. 258), qui se compte en jours ouvrables du 5 mai au
  // 4 août 2026 · le 17 mai, férié, tombe un dimanche, et l'ordonnance
  // n° 23-042, art. 2, en reporte le congé au samedi 16 mai.
  const delegueTroisAns = await calcul({ anneesAnciennete: 3, initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR', delegueSyndical: true, dateNotification: '2026-05-04' });

  // ÉMISSION · un bulletin de mai d'abord, que le décompte doit remplacer.
  await c.ok('POST', `/personnel/contrats/${s.contratId}/fin`, { dateFin: '2026-05-04', motifFin: 'Licenciement, préavis dispensé par l\'employeur' });
  const elementsMai = [SALAIRE(120_000, 'Salaire des jours prestés de mai')];
  const bulletinMai = await emettre(c, s.id, paie('2026-05', elementsMai, { joursPayes: 3 }));
  const corpsDecompte = {
    decompte: { ...faits, initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR', dateNotification: '2026-05-04', moisDeCessation: '2026-05' },
    paie: paie('2026-05', elementsMai),
  };
  const refusTantQueBulletin = await c.req('POST', `/personnel/salaries/${s.id}/decompte-final`, corpsDecompte);
  await c.req('POST', `/personnel/bulletins/${bulletinMai.corps?.id}/annulation`, { motif: 'Remplacé par le décompte final' });
  const emis = await c.req('POST', `/personnel/salaries/${s.id}/decompte-final`, corpsDecompte);
  const calculEmis = emis.corps?.calcul ? lectureSimulation(emis.corps.calcul) : null;
  const proposition = await c.ok('GET', '/personnel/paie-du-mois/2026-05');
  return {
    licenciement,
    demissionPrestee,
    demissionNonObservee,
    sansNotification,
    licenciementAuMois,
    delegueAuMoisSamedi,
    departAMiPreavis,
    cddRompu,
    fauteLourde,
    delegue,
    delegueTroisAns,
    bulletinMai: { statut: bulletinMai.statut, net: bulletinMai.corps?.netAPayerFc },
    refusTantQueBulletin: { statut: refusTantQueBulletin.statut, message: refusTantQueBulletin.corps?.message },
    emis: { statut: emis.statut, nature: emis.corps?.nature, net: emis.corps?.netAPayerFc, irpp: emis.corps?.irppFc, message: emis.statut >= 400 ? emis.corps : undefined },
    calculEmis,
    proposition: { refus: proposition.refus, lignes: proposition.lignes?.map((l) => `${l.sens === 'DEBIT' ? 'D' : 'C'} ${l.compte} ${l.montantFc}`) },
    comparaison: [
      // Décisions T6 (tranche d'ancienneté entière · 11 jours de congé) et T9 (rémunération du délai,
      // fériés compris · du 5 mai au 18 juillet 2026, 63 jours ouvrables, 65 jours rémunérés).
      ...confronter('P13', licenciement, { preavisJours: 63, congeJours: 11, preavis: 2_730_000, conge: 462_000, arrieres: 120_000, totalDu: 3_312_000 }),
      ...confronter('P13', demissionPrestee, { preavisJours: 31.5, preavis: 0, conge: 462_000, totalDu: 582_000 }),
      // 31,5 jours ouvrables du 5 mai au 11 juin, le samedi 16 mai rémunéré · 32,5 × 42 000.
      comparer('P13', 'démission non observée · dû par le travailleur', 1_365_000, demissionNonObservee.duParLeTravailleur?.[0]?.montantFc),
      comparer('P13', 'démission non observée · total dû au travailleur', 582_000, demissionNonObservee.totalDu),
      comparer('P13', 'licenciement sans date de notification · indemnité non chiffrée', null, sansNotification.preavis),
      // Du 5 mai au 18 juillet · deux mois entiers (5 mai au 4 juillet) et 12 jours payables du 6 au 18 juillet
      // (le 12, dimanche, exclu) · 2 × 1 092 000 + 12 × 1 092 000 / 26.
      comparer('P13', 'licenciement au mois · deux mois entiers et douze vingt-sixièmes', 2_688_000, licenciementAuMois.preavis),
      comparer('P13', 'licenciement au mois · règle du mois entamé citée au fondement', 'oui', licenciementAuMois.regleMoisEntame),
      comparer('P13', 'licenciement au mois · aucune réserve sur le préavis', null, licenciementAuMois.preavisReserve),
      // B1 · trois mois de date à date du 3 mai au 3 août exclu · 3 × 1 092 000 (le rejeu de l'ancien code rendait 3 234 000).
      comparer('P13', 'délégué au mois notifié un samedi · trois mois entiers', 3_276_000, delegueAuMoisSamedi.preavis),
      // M2 · les 31,5 derniers jours ouvrables du délai, le 30 juin férié payé · 32,5 × 42 000.
      comparer('P13', 'départ à mi-préavis · temps restant à courir, fériés compris', 1_365_000, departAMiPreavis.tempsRestant),
      // M2 · du 20 juin au 21 août 2026, 54 jours du lundi au samedi dont le 30 juin et le 1er août · 54 × 40 000.
      comparer('P13', 'CDD rompu par l\'employeur · période jusqu\'au terme, fériés compris', 2_160_000, cddRompu.dommagesArt70),
      // Jumeau de T9 · la moyenne de l'art. 142, al. 2 ramenée au jour à 1/26 (11 × (40 000 + 2 000)), règle citée au fondement.
      comparer('P13', 'congé · conversion à 1/26 citée au fondement (décret n° 25/22, art. 7, par analogie)', 'oui', licenciement.regleMoyenneConge),
      ...confronter('P13', fauteLourde, { preavis: 0, conge: 462_000, totalDu: 582_000 }),
      // 126 jours ouvrables du 5 mai au 1er octobre ; rémunérés 129 (16 mai, 30 juin, 1er août).
      ...confronter('P13', delegue, { preavisJours: 126, preavis: 5_418_000 }),
      comparer('P13', 'délégué de trois ans · plancher de trois mois (77 jours moins le 16 mai, art. 2 de l\'ordonnance n° 23-042)', 76, delegueTroisAns.preavisJours),
      // Trois mois de date à date, du 5 mai au 4 août · 92 jours moins 13 dimanches = 79 jours rémunérés.
      comparer('P13', 'délégué de trois ans · rémunération du délai (79 × 42 000)', 3_318_000, delegueTroisAns.preavis),
      comparer('P13', 'décompte refusé tant que le bulletin de mai est actif', 400, refusTantQueBulletin.statut),
      comparer('P13', 'décompte émis après annulation du bulletin', 201, emis.statut),
      ...(calculEmis
        ? confronter('P13', calculEmis, {
            // 120 000 + 2 730 000 + 462 000 ; ouvrière 5 % ; patronal 17 % ; base 3 146 400 → 37 756 800
            // → 37 756 000 → 58 320 + 2 948 400 + 30 % × 16 156 000 = 7 853 520 → 654 460 → 654 500.
            assietteSociale: 3_312_000,
            cnssPensionTravailleur: 165_600,
            totalEmployeur: 563_040,
            assietteFiscaleNette: 3_146_400,
            assietteArrondieAnnuelle: 37_756_000,
            irpp: 654_500,
            net: 2_491_900,
          })
        : []),
      comparer('P13', 'passation · 6614 indemnité de préavis', true, proposition.lignes?.some((l) => l.compte === '66140000' && l.montantFc === 2_730_000)),
      comparer('P13', 'passation · 6613 indemnité compensatoire de congé', true, proposition.lignes?.some((l) => l.compte === '66130000' && l.montantFc === 462_000)),
    ],
  };
});

/** Le solde d'un compte à la balance · débit moins crédit, toutes colonnes. */
async function soldes(c, exerciceId, numeros) {
  const b = await c.ok('GET', `/ecritures/balance?exerciceId=${exerciceId}`);
  const lignes = Array.isArray(b) ? b : (b.lignes ?? b.comptes ?? []);
  const rendu = {};
  for (const n of numeros) {
    const l = lignes.find((x) => (x.numero ?? x.compte?.numero) === n);
    rendu[n] = l ? auCentime(Number(l.totalDebit ?? 0) - Number(l.totalCredit ?? 0)) : 0;
  }
  return { rendu, cles: lignes[0] ? Object.keys(lignes[0]) : [] };
}

/** Deux bulletins aux montants impairs · les centimes de chaque ligne s'arrondissent un à un. */
async function deuxBulletinsAuJournal(referentiel, nom) {
  const c = await dossier(nom, referentiel);
  const a = await salarie(c, 'AMISI', { salaire: 1_234_567.89 });
  const b = await salarie(c, 'BOKETSHU', { salaire: 987_654.32 });
  const ea = await emettre(c, a.id, paie('2026-04', [SALAIRE(1_234_567.89)]));
  const eb = await emettre(c, b.id, paie('2026-04', [SALAIRE(987_654.32)]));
  const proposition = await c.ok('GET', '/personnel/paie-du-mois/2026-04');
  const n = c.exercices.get('2026-01-01');
  const passee = await c.ok('POST', '/personnel/paie-du-mois/2026-04/comptabilisation', { exerciceId: n, journalId: c.od.id, date: '2026-04-30' });
  await c.ok('POST', '/ecritures/valider-jusqua', { exerciceId: n, dateLimite: '2026-04-30' });
  const retraite = referentiel === 'SYSCOHADA' ? '43130000' : '43210000';
  const comptes = ['66110000', '66410000', '64150000', '64130000', '42200000', '43110000', '43120000', retraite, '44280000', '43340000', '43350000', '44720000'];
  const bal = await soldes(c, n, comptes);
  // Relecture M1 · une AUTRE taxe portée au 4428 en mars, sans lien avec la
  // paie · le registre des retenues ne la compte pas dans l'INPP et l'ONEM, ne
  // la dit pas en retard, et la nomme.
  await c.ok('POST', '/ecritures', {
    exerciceId: n,
    journalId: c.od.id,
    date: '2026-03-10',
    libelle: 'Autre taxe portée au 4428',
    lignes: [
      { compteId: c.comptes.get('64180000'), libelle: 'Autre taxe', debit: 50_000, credit: 0 },
      { compteId: c.comptes.get('44280000'), libelle: 'Autre taxe', debit: 0, credit: 50_000 },
    ],
  });
  await c.ok('POST', '/ecritures/valider-jusqua', { exerciceId: n, dateLimite: '2026-04-30' });
  const registre = await c.ok('GET', `/retenues/registre?exerciceId=${n}&dateReference=2026-06-30`);
  const inppOnem = (registre.natures ?? []).find((x) => x.cle === 'inppOnem') ?? {};
  return {
    c,
    registre: { retenu: inppOnem.retenu ?? null, moisEnRetard: inppOnem.moisEnRetard ?? null, mention: inppOnem.mention4428 ?? null },
    nets: [Number(ea.corps?.netAPayerFc), Number(eb.corps?.netAPayerFc)],
    irpp: [Number(ea.corps?.irppFc), Number(eb.corps?.irppFc)],
    proposition: {
      lignes: proposition.lignes.map((l) => `${l.bloc} ${l.sens === 'DEBIT' ? 'D' : 'C'} ${l.compte} ${l.montantFc}`),
      solde422: proposition.solde422Fc,
      sommeDesNets: proposition.sommeDesNetsFc,
      reserves: proposition.reserves,
      equilibree: proposition.equilibree,
    },
    ecriture: passee.ecriture?.id,
    balance: bal.rendu,
    clesBalance: bal.cles,
    retraite,
  };
}

cas('P14', 'Passation au journal en trois temps, deux bulletins impairs, dans les deux référentiels (4313 contre 4321)', async () => {
  const comparaison = [];
  const rendus = {};
  for (const referentiel of ['SYSCOHADA', 'SYCEBNL']) {
    const r = await deuxBulletinsAuJournal(referentiel, `Cas paie 14 ${referentiel}`);
    delete r.c;
    rendus[referentiel] = r;
    const R = referentiel;
    comparaison.push(
      comparer('P14', `${R} · net A`, 1_016_339.5, r.nets[0]),
      comparer('P14', `${R} · net B`, 816_971.6, r.nets[1]),
      comparer('P14', `${R} · IRPP A`, 156_500, r.irpp[0]),
      comparer('P14', `${R} · IRPP B`, 121_300, r.irpp[1]),
      comparer('P14', `${R} · 6611 au débit`, 2_222_222.21, r.balance['66110000']),
      // Décision T1 · l'INPP et l'ONEM passent du 6641 au 6415 et au 6413, leur dette au 4428.
      comparer('P14', `${R} · 6641 au débit (CNSS seule)`, 288_888.88, r.balance['66410000']),
      comparer('P14', `${R} · 6415 INPP`, 77_777.78, r.balance['64150000']),
      comparer('P14', `${R} · 6413 ONEM`, 11_111.11, r.balance['64130000']),
      comparer('P14', `${R} · 4311 prestations familiales`, -144_444.44, r.balance['43110000']),
      comparer('P14', `${R} · 4312 risques professionnels`, -33_333.33, r.balance['43120000']),
      comparer('P14', `${R} · ${r.retraite} retraite obligatoire (part ouvrière et patronale)`, -222_222.22, r.balance[r.retraite]),
      comparer('P14', `${R} · 4428 INPP et ONEM`, -88_888.89, r.balance['44280000']),
      comparer('P14', `${R} · 4334 et 4335 non semés, non mouvementés`, 0, r.balance['43340000'] + r.balance['43350000']),
      comparer('P14', `${R} · 4472 IRPP retenu`, -277_800, r.balance['44720000']),
      comparer('P14', `${R} · 422 soldé au net (somme des nets figés)`, -1_833_311.1, r.balance['42200000']),
      comparer('P14', `${R} · 422 de la proposition`, 1_833_311.1, r.proposition.solde422),
      comparer('P14', `${R} · somme des nets`, 1_833_311.1, r.proposition.sommeDesNets),
      // M1 · le 4428 mêlé · seule la dette de la paie est de l'INPP et de l'ONEM ; avril, échu le 15 mai, en retard ; mars jamais.
      comparer('P14', `${R} · registre · INPP et ONEM, la seule dette de la paie`, 88_888.89, r.registre.retenu),
      comparer('P14', `${R} · registre · un mois en retard (avril), la taxe de mars hors`, 1, r.registre.moisEnRetard),
      comparer('P14', `${R} · registre · la taxe étrangère du 4428 nommée`, true, typeof r.registre.mention === 'string' && r.registre.mention.includes('50000.00 FC')),
    );
  }
  return { rendus, comparaison };
});

cas('P15', 'Paie traversant la clôture · décembre 2026 passé, clôturé, payé en 2027 ; bulletin annulé en N+1 ; grille SMIG du cabinet en 2027', async () => {
  const c = await dossier('Cas paie 15');
  const n = c.exercices.get('2026-01-01');
  const n1 = await exercice(c, '2027-01-01', '2027-12-31');
  const banque = c.journaux.find((j) => j.code === 'BQ') ?? c.journaux.find((j) => String(j.type).includes('TRESO')) ?? c.od;
  const a = await salarie(c, 'KABEYA', { salaire: 1_000_100 });
  const b = await salarie(c, 'MPOYI', { salaire: 600_000, classe: 1 });

  // La grille du cabinet · un SMIG hypothétique de 25 000 FC à partir de janvier 2027.
  const version = await c.ok('POST', '/personnel/baremes', {
    bareme: 'SMIG',
    aPartirDu: '2027-01-01',
    reference: 'Arrêté hypothétique du cas chiffré P15, SMIG du manœuvre ordinaire à 25 000 FC',
    valeurs: { smigJournalierFc: 25_000 },
  });
  const versionId = version.version?.id ?? version.id;

  // DÉCEMBRE 2026 · émis, passé au 31 décembre, validé.
  const decA = await emettre(c, a.id, paie('2026-12', [SALAIRE(1_000_100)]));
  const decB = await emettre(c, b.id, paie('2026-12', [SALAIRE(600_000)], { joursPayes: 26 }));
  const passeeDec = await c.ok('POST', '/personnel/paie-du-mois/2026-12/comptabilisation', { exerciceId: n, journalId: c.od.id, date: '2026-12-31' });
  await c.ok('POST', '/ecritures/valider-jusqua', { exerciceId: n, dateLimite: '2026-12-31' });
  const comptes = ['66110000', '66410000', '64150000', '64130000', '42200000', '43110000', '43120000', '43130000', '44280000', '44720000'];
  const balance2026 = (await soldes(c, n, comptes)).rendu;

  // CLÔTURE 2026, puis l'à-nouveau de 2027.
  const cloture = await c.req('POST', `/exercices/${n}/cloturer`, {});
  const ouverture2027 = (await soldes(c, n1, comptes)).rendu;

  // PAIEMENT des nets de décembre, le 5 janvier 2027, D 422 / C 521.
  await c.ok('POST', '/ecritures', {
    exerciceId: n1,
    journalId: banque.id,
    date: '2027-01-05',
    libelle: 'Paiement des salaires de décembre 2026',
    lignes: [
      { compteId: c.comptes.get('42200000'), libelle: 'Salaires de décembre 2026', debit: 1_330_895, credit: 0 },
      { compteId: c.comptes.get('52110000'), libelle: 'Salaires de décembre 2026', debit: 0, credit: 1_330_895 },
    ],
  });
  await c.ok('POST', '/ecritures/valider-jusqua', { exerciceId: n1, dateLimite: '2027-01-05' });
  const apresPaiement = (await soldes(c, n1, ['42200000'])).rendu;

  // JANVIER 2027 · la grille du cabinet relève le plancher CNSS de B.
  const janA = await emettre(c, a.id, paie('2027-01', [SALAIRE(1_000_100)]));
  const simJanB = lectureSimulation((await simuler(c, paie('2027-01', [SALAIRE(600_000)], { joursPayes: 26 }), b.id)).corps);
  const janB = await emettre(c, b.id, paie('2027-01', [SALAIRE(600_000)], { joursPayes: 26 }));
  const retraitVersion = await c.req('DELETE', `/personnel/baremes/${versionId}`);

  // ANNULATION EN 2027 du bulletin de décembre 2026 de B, passé et validé dans un exercice clos.
  const annulation = await c.req('POST', `/personnel/bulletins/${decB.corps?.id}/annulation`, { motif: 'Salaire de décembre erroné, découvert en janvier 2027' });
  const propositionDec = await c.ok('GET', '/personnel/paie-du-mois/2026-12');
  const reemis = await emettre(c, b.id, paie('2026-12', [SALAIRE(620_000)], { joursPayes: 26 }));
  const propositionDecApres = await c.ok('GET', '/personnel/paie-du-mois/2026-12');
  const passageDansExerciceClos = await c.req('POST', '/personnel/paie-du-mois/2026-12/comptabilisation', { exerciceId: n, journalId: c.od.id, date: '2026-12-31' });
  // C2 · la reprise en négatif de l'ancien bulletin se confirme ; sans confirmation, refus nommé.
  const passageSansConfirmation = await c.req('POST', '/personnel/paie-du-mois/2026-12/comptabilisation', { exerciceId: n1, journalId: c.od.id, date: '2027-01-01' });
  const passageEn2027 = await c.req('POST', '/personnel/paie-du-mois/2026-12/comptabilisation', { exerciceId: n1, journalId: c.od.id, date: '2027-01-01', inscrireNegatifs: true });
  const propositionDecFinale = await c.ok('GET', '/personnel/paie-du-mois/2026-12');
  const passeeJan = await c.req('POST', '/personnel/paie-du-mois/2027-01/comptabilisation', { exerciceId: n1, journalId: c.od.id, date: '2027-01-31' });
  await c.ok('POST', '/ecritures/valider-jusqua', { exerciceId: n1, dateLimite: '2027-01-31' });
  const balance2027 = (await soldes(c, n1, ['42200000', '66110000', '66410000', '64150000', '64130000', '44280000'])).rendu;
  const listeEcritures2027 = await c.req('GET', `/ecritures?exerciceId=${n1}`);
  const ecritures2027 = Array.isArray(listeEcritures2027.corps) ? listeEcritures2027.corps : (listeEcritures2027.corps?.ecritures ?? listeEcritures2027.corps?.lignes ?? []);
  const ecritureCorrection = ecritures2027.find((x) => x.id === passageEn2027.corps?.ecriture?.id);

  return {
    decA: { statut: decA.statut, net: decA.corps?.netAPayerFc },
    decB: { statut: decB.statut, net: decB.corps?.netAPayerFc },
    passeeDec: passeeDec.ecriture?.id,
    balance2026,
    cloture: { statut: cloture.statut, message: cloture.statut >= 400 ? cloture.corps : undefined },
    ouverture2027,
    apresPaiement,
    janA: { statut: janA.statut, net: janA.corps?.netAPayerFc },
    simJanB: { baseCnss: simJanB.baseCnss, plancher: simJanB.plancherCnss, irpp: simJanB.irpp, net: simJanB.net },
    janB: { statut: janB.statut, net: janB.corps?.netAPayerFc },
    retraitVersion: { statut: retraitVersion.statut, message: retraitVersion.corps?.message },
    annulation: { statut: annulation.statut, message: annulation.statut >= 400 ? annulation.corps?.message : undefined },
    propositionDec: { annulesApresPassation: propositionDec.annulesApresPassation, reserves: propositionDec.reserves },
    reemis: { statut: reemis.statut, net: reemis.corps?.netAPayerFc, message: reemis.statut >= 400 ? reemis.corps?.message : undefined },
    propositionDecApres: {
      aPasser: propositionDecApres.aPasser?.map((x) => x.numero),
      annulesApresPassation: propositionDecApres.annulesApresPassation?.map((x) => x.numero),
      lignes: propositionDecApres.lignes?.map((l) => `${l.sens === 'DEBIT' ? 'D' : 'C'} ${l.compte} ${l.montantFc}`),
    },
    passageDansExerciceClos: { statut: passageDansExerciceClos.statut, message: passageDansExerciceClos.corps?.message },
    passageSansConfirmation: { statut: passageSansConfirmation.statut, message: passageSansConfirmation.corps?.message },
    passageEn2027: {
      statut: passageEn2027.statut,
      message: passageEn2027.statut >= 400 ? passageEn2027.corps?.message : undefined,
      ecriture: passageEn2027.corps?.ecriture?.id,
      dateValeur: passageEn2027.corps?.dateValeur ?? null,
      reprisEnNegatif: passageEn2027.corps?.reprisEnNegatif?.map((x) => x.numero),
    },
    ecritureCorrection: ecritureCorrection ? { date: ecritureCorrection.date, dateValeur: ecritureCorrection.dateValeur ?? null } : null,
    propositionDecFinale: {
      aPasser: propositionDecFinale.aPasser?.map((x) => x.numero),
      negatifsAPasser: propositionDecFinale.negatifsAPasser?.map((x) => x.numero),
      annulesApresPassation: propositionDecFinale.annulesApresPassation,
    },
    passeeJan: { statut: passeeJan.statut, message: passeeJan.statut >= 400 ? passeeJan.corps?.message : undefined },
    balance2027,
    comparaison: [
      comparer('P15', 'décembre A · net', 826_995, Number(decA.corps?.netAPayerFc)),
      comparer('P15', 'décembre B · net (base 600 000, SMIG 21 500)', 503_900, Number(decB.corps?.netAPayerFc)),
      comparer('P15', '2026 · 6611', 1_600_100, balance2026['66110000']),
      // Décision T1 · CNSS patronale seule au 6641 (130 013 + 78 000) ; INPP et ONEM au 6415 et au 6413.
      comparer('P15', '2026 · 6641 (CNSS)', 208_013, balance2026['66410000']),
      comparer('P15', '2026 · 6415 INPP', 56_003.5, balance2026['64150000']),
      comparer('P15', '2026 · 6413 ONEM', 8_000.5, balance2026['64130000']),
      comparer('P15', '2026 · 4428 INPP et ONEM', -64_004, balance2026['44280000']),
      comparer('P15', '2026 · 422 au net', -1_330_895, balance2026['42200000']),
      comparer('P15', '2026 · 4313', -160_010, balance2026['43130000']),
      comparer('P15', '2026 · 4472', -189_200, balance2026['44720000']),
      comparer('P15', 'clôture 2026', 201, cloture.statut),
      comparer('P15', '2027 · à-nouveau 422', -1_330_895, ouverture2027['42200000']),
      comparer('P15', '2027 · à-nouveau 4313', -160_010, ouverture2027['43130000']),
      comparer('P15', '2027 · à-nouveau 4311', -104_006.5, ouverture2027['43110000']),
      comparer('P15', '2027 · à-nouveau 4428', -64_004, ouverture2027['44280000']),
      comparer('P15', '2027 · à-nouveau 4472', -189_200, ouverture2027['44720000']),
      comparer('P15', '2027 · à-nouveau 6611 (soldé)', 0, ouverture2027['66110000']),
      comparer('P15', '2027 · 422 après paiement', 0, apresPaiement['42200000']),
      comparer('P15', 'janvier A · net', 826_995, Number(janA.corps?.netAPayerFc)),
      comparer('P15', 'janvier B · base CNSS relevée (25 000 × 26)', 650_000, simJanB.baseCnss),
      comparer('P15', 'janvier B · IRPP', 65_700, simJanB.irpp),
      comparer('P15', 'janvier B · net', 501_800, Number(janB.corps?.netAPayerFc)),
      comparer('P15', 'retrait de la grille refusé (bulletin émis sur sa période)', 400, retraitVersion.statut),
      comparer('P15', 'décembre B réémis à 620 000 · net', 520_100, Number(reemis.corps?.netAPayerFc)),
      comparer('P15', 'passation dans l\'exercice clos refusée', true, passageDansExerciceClos.statut >= 400),
      comparer('P15', 'reprise en négatif non confirmée · refusée', 400, passageSansConfirmation.statut),
      comparer('P15', 'reprise en négatif confirmée · passée', 201, passageEn2027.statut),
      comparer('P15', 'bulletin repris en négatif (numéro)', String(decB.corps?.numero), passageEn2027.corps?.reprisEnNegatif?.map((x) => x.numero).join(',') ?? null),
      comparer('P15', 'date de valeur du mois de paie (AUDCIF art. 22, 4°)', '2026-12-31', String(ecritureCorrection?.dateValeur ?? passageEn2027.corps?.dateValeur ?? '').slice(0, 10)),
      comparer('P15', 'plus rien à reprendre ensuite', 0, propositionDecFinale.negatifsAPasser?.length ?? null),
      // APRÈS LE BULLETIN ANNULÉ EN N+1 ET RÉÉMIS · le salaire de décembre de B
      // a été passé en 2026 (600 000, net 503 900, payé le 5 janvier) ; le
      // bulletin corrigé (620 000, net 520 100) ne doit peser sur 2027 que par
      // la DIFFÉRENCE, l'ancien étant inscrit en négatif (AUDCIF art. 20).
      // Attendus · janvier (A et B) plus la seule correction de décembre.
      comparer('P15', '2027 · 422 (nets de janvier 1 328 795 + différence de décembre 16 200)', -1_344_995, balance2027['42200000']),
      comparer('P15', '2027 · 6611 (janvier 1 600 100 + différence 20 000)', 1_620_100, balance2027['66110000']),
      // Décision T1 · la CNSS seule au 6641 · janvier 130 013 + 84 500, différence 13 % × 20 000 = 2 600.
      comparer('P15', '2027 · 6641 (janvier 214 513 + différence 2 600)', 217_113, balance2027['66410000']),
      comparer('P15', '2027 · 6415 (janvier 56 003,50 + différence 700)', 56_703.5, balance2027['64150000']),
      comparer('P15', '2027 · 6413 (janvier 8 000,50 + différence 100)', 8_100.5, balance2027['64130000']),
    ],
  };
});

// --- Exécution ------------------------------------------------------------------

const resultats = {};
const filtre = process.env.OMEGAX_CAS ? new Set(process.env.OMEGAX_CAS.split(',')) : null;
for (const { code, titre, fn } of CAS.filter((x) => !filtre || filtre.has(x.code))) {
  try {
    resultats[code] = { titre, ...(await fn()) };
    const siens = ecarts.filter((e) => e.cas === code);
    console.log(`${code} · rejoué · ${siens.length} écart(s)`);
    for (const e of siens) console.log(`   ${e.grandeur} · attendu ${JSON.stringify(e.attendu)} · rendu ${JSON.stringify(e.rendu)}`);
  } catch (e) {
    resultats[code] = { titre, erreur: e.message };
    console.log(`${code} · ÉCHEC · ${e.message}`);
  }
}
resultats._synthese = { comparaisons, ecarts };
const sortie = process.argv[2] ?? 'rejeu-paie.json';
writeFileSync(sortie, JSON.stringify(resultats, null, 2));
console.log(`${comparaisons} comparaison(s), ${ecarts.length} écart(s) · résultats écrits dans ${sortie}`);
