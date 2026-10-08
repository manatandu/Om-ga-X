/**
 * SCÉNARIO « PAIE AVANCÉE » · la paie au-delà du banc de base, les retenues
 * sur deux exercices et les démarches d'une ONG de droit étranger.
 *
 * La paie de base (salarié, contrat, bulletin, passation) est déjà jouée par
 * la SARL du banc · ce scénario va au-delà, sur une base PostgreSQL jetable,
 * par l'API du serveur compilé.
 *
 *  1. SARL SYSCOHADA privée de plus de dix salariés (« Chantiers du Kivu ») ·
 *     rubriques du cabinet (dont une refusée pour sa nature), bulletin modèle,
 *     salaire stipulé en dollars converti au cours de la mise à disposition,
 *     avance et prêt retenus sur bulletins, avantage en nature (6617 / 781),
 *     bulletin annulé puis repris en négatif à la passation, livre de paie,
 *     décompte final d'un licenciement (préavis de l'art. 64 placé par la
 *     notification, congé de l'art. 141, indemnité au 66140000), départ à
 *     mi-préavis (art. 66), registre et échéancier des retenues sur l'année,
 *     reversements imputés sur la dette échue la plus ancienne, clôture de
 *     2026, ouverture de 2027 depuis le report, barème SMIG du cabinet daté
 *     de janvier 2027 et son effet (plancher CNSS, minimum du contrat).
 *  2. ONG de droit étranger (SYCEBNL) · accord-cadre avec le Ministère du
 *     Plan, checklist de constitution, exonérations ; ONG congolaise à qui
 *     l'accord-cadre dit « non concerné ».
 *
 * CHAQUE MONTANT ATTENDU EST CALCULÉ ICI DEPUIS LES TEXTES (`attenduBulletin`,
 * `irppDuMois`), jamais recopié de ce que le serveur rend. Les textes lus ·
 * décret n° 18/041, art. 2 à 4 et 8 (CNSS 6,5 + 5 + 5 + 1,5 %, plancher au
 * SMIG) ; arrêté interministériel n° 002/CAB/MET/2025, art. 1er (INPP privé
 * de 1 à 50 travailleurs, 3,5 %) ; arrêté n° 028/2025, art. 1er à 3 (ONEM
 * 0,5 %, déclaration le 10, paiement le 15) ; loi n° 23/053, art. 68 à 71,
 * 118, 119 et 150 (barème, plafond de 30 %, arrondi) ; décret n° 25/22,
 * art. 2, 4 et 7, annexe 2 (SMIG 21 500 FC, tensions, 26 jours) ; Code du
 * travail, art. 7 point 8, 63 à 66, 93, 141, 142, 144, 213 à 215 ;
 * ordonnance n° 23-042 (jours fériés) ; ordonnance n° 84/186, art. 3 (INPP
 * trimestriel) ; arrêté n° 138/2018, art. 2 (CNSS dans les quinze jours
 * suivant le mois civil) ; loi n° 004/2003, art. 18 et 110 bis (IRPP le 15,
 * report au jour ouvrable) ; loi n° 004/2001, art. 4, 29 à 37 ; note
 * circulaire n° 003/2013 ; modèle d'accord-cadre du guide Kahasha, art. IX.
 *
 * DEUX CONVENTIONS D'OMEGAX, déclarées par le logiciel et reprises telles ·
 * la mensualisation de l'IRPP (le mois porté à l'année, barème annuel,
 * ramené au mois) et la règle du mois entamé du préavis (1/26 du salaire
 * mensuel par jour payable, décision par la loi du 2026-10-07).
 */
import { balance, cloturer, ecriture, etape, nouveauDossier, rechargerComptes, solde, validerJusqua } from './lib.mjs';

const BQ = '52110000';
const PRIVE = { natureEmployeurInpp: 'PRIVE', effectif: 12, regimeSalarial: 'BAREME_ARTICLE_118' };

// --- Le calcul attendu, depuis les textes -----------------------------------

/** Décret n° 18/041, art. 2 à 4 · 6,5 % familles, 5 % + 5 % pensions, 1,5 % risques. */
const TAUX_CNSS = { pf: 6.5, pe: 5, pt: 5, rp: 1.5 };
/** Arrêté interministériel n° 002/CAB/MET/2025, art. 1er · privé de 1 à 50 travailleurs. */
const TAUX_INPP = 3.5;
/** Arrêté ministériel n° 028/CAB/MIN.ET/FMM/RK/09/2025, art. 1er. */
const TAUX_ONEM = 0.5;
/** Décret n° 25/22, art. 2 et annexe 2 · SMIG journalier du manœuvre ordinaire depuis janvier 2026. */
const SMIG_2026 = 21_500;
/**
 * LE SMIG DE JANVIER 2027 EST UNE DONNÉE DU SCÉNARIO, pas un texte lu · le
 * décret n° 25/21 (art. 10 et 11) fait ajuster le SMIG « à partir du mois de
 * janvier de chaque année » par arrêté ; le cabinet du banc en saisit un,
 * fictif, et le scénario vérifie l'effet de la saisie, non le montant.
 */
const SMIG_CABINET_2027 = 24_000;

/** Loi n° 23/053, art. 150 · la décimale, puis la tranche de 50 FC à la centaine. */
function arrondiArticle150(x) {
  const unite = Math.round(x);
  const reste = unite % 100;
  return reste >= 50 ? unite - reste + 100 : unite - reste;
}

/**
 * Loi n° 23/053, art. 118 (barème sur le revenu net global arrondi au millier
 * inférieur, plafond de 30 %) et art. 119 (retenue mensuelle), dans la
 * convention de mensualisation que le logiciel déclare (le mois × 12).
 */
function irppDuMois(netFiscalMensuel) {
  const annuel = Math.floor((netFiscalMensuel * 12) / 1000) * 1000;
  const tranches = [[0, 1_944_000, 3], [1_944_000, 21_600_000, 15], [21_600_000, 43_200_000, 30], [43_200_000, Infinity, 40]];
  let impot = 0;
  for (const [de, a, t] of tranches) if (annuel > de) impot += ((Math.min(annuel, a) - de) * t) / 100;
  impot = Math.min(impot, annuel * 0.3);
  return arrondiArticle150(impot / 12);
}

/**
 * La rémunération de l'art. 7, point 8 du Code du travail · ces natures-là
 * seules entrent dans l'assiette sociale (les cinq exclusions n'y sont pas, le
 * banc ne les emploie pas). L'indemnité de fin de contrat y entre par la
 * décision T7 (art. 63, al. 3 ; arrêté n° 146/2018, art. 20).
 */
const NATURES_ASSIETTE = new Set([
  'SALAIRE_OU_TRAITEMENT', 'PRIME', 'PRESTATION_SUPPLEMENTAIRE', 'AVANTAGE_EN_NATURE',
  'INDEMNITE_DE_FIN_DE_CONTRAT', 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE',
]);
/** Compte de charge de chaque nature · plan SYSCOHADA (compétence `syscohada`, fiche du compte 66). */
const COMPTE_NATURE = {
  SALAIRE_OU_TRAITEMENT: '66110000',
  PRIME: '66120000',
  ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE: '66130000',
  INDEMNITE_DE_FIN_DE_CONTRAT: '66140000',
  AVANTAGE_EN_NATURE: '66170000',
  PRESTATION_SUPPLEMENTAIRE: '66180000',
};

/**
 * LE BULLETIN ATTENDU · cotisations sur l'assiette sociale (plancher CNSS au
 * SMIG des jours payés, décret n° 18/041, art. 8), INPP et ONEM sans
 * plancher, IRPP sur le brut fiscal (art. 68, avantages en nature compris)
 * net de la quote-part ouvrière (art. 70, 71), net = versé − retenues.
 * L'avantage en nature reste dans les assiettes et sort du versé.
 */
function attenduBulletin({ elements, joursPayes = null, smig = SMIG_2026, retenue = 0, compteRetenue = null }) {
  const somme = (f) => elements.filter(f).reduce((s, e) => s + e.montantFc, 0);
  const assiette = somme((e) => NATURES_ASSIETTE.has(e.nature));
  const brutFiscal = somme(() => true);
  const aen = somme((e) => e.nature === 'AVANTAGE_EN_NATURE');
  const totalVerse = brutFiscal - aen;
  const baseCnss = Math.max(assiette, joursPayes ? smig * joursPayes : 0);
  const pct = (b, t) => (b * t) / 100;
  const pf = pct(baseCnss, TAUX_CNSS.pf);
  const pe = pct(baseCnss, TAUX_CNSS.pe);
  const pt = pct(baseCnss, TAUX_CNSS.pt);
  const rp = pct(baseCnss, TAUX_CNSS.rp);
  const inpp = pct(assiette, TAUX_INPP);
  const onem = pct(assiette, TAUX_ONEM);
  const irpp = irppDuMois(brutFiscal - pt);
  return { elements, assiette, baseCnss, aen, totalVerse, pf, pe, pt, rp, inpp, onem, irpp, retenue, compteRetenue, net: totalVerse - pt - irpp - retenue };
}

/** Le livre attendu · les mouvements par compte, débit et crédit, que les écritures doivent porter. */
class LivreAttendu {
  constructor() { this.m = new Map(); }
  add(compte, d, c) {
    const x = this.m.get(compte) ?? { d: 0, c: 0 };
    x.d += d; x.c += c;
    this.m.set(compte, x);
  }
  solde(compte) { const x = this.m.get(compte); return x ? Math.round((x.d - x.c) * 100) / 100 : 0; }
  /** P3 · trois temps, plus l'avantage en nature (D 6617 / C 781) et la retenue d'avance (D 422 / C 42 ou 27). */
  passer(b) {
    for (const e of b.elements) this.add(COMPTE_NATURE[e.nature], e.montantFc, 0);
    if (b.aen) this.add('78100000', 0, b.aen);
    this.add('42200000', b.pt + b.irpp + b.retenue, b.totalVerse);
    this.add('43110000', 0, b.pf);
    this.add('43120000', 0, b.rp);
    this.add('43130000', 0, b.pe + b.pt);
    this.add('66410000', b.pf + b.pe + b.rp, 0);
    this.add('44720000', 0, b.irpp);
    this.add('64150000', b.inpp, 0);
    this.add('64130000', b.onem, 0);
    this.add('44280000', 0, b.inpp + b.onem);
    if (b.retenue) this.add(b.compteRetenue, 0, b.retenue);
  }
}

// --- Le calendrier ------------------------------------------------------------

const iso = (d) => d.toISOString().slice(0, 10);
const jourUtc = (s) => new Date(`${s}T00:00:00.000Z`);
const finDeMois = (mois) => iso(new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0)));
const moisSuivant = (mois) => iso(new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 1))).slice(0, 7);
/** Ordonnance n° 23-042, art. 1er · dix jours fériés à date fixe. */
const FERIES = ['01-01', '01-04', '01-16', '01-17', '04-06', '05-01', '05-17', '06-30', '08-01', '12-25'];
/**
 * LE JOUR OUVRABLE FISCAL · l'IRPP se verse « accompagné d'une déclaration à
 * souscrire auprès du Service » (loi n° 004/2003, art. 18) · au guichet,
 * ouvert du lundi au vendredi (décret n° 24/09, art. 1er), hors fériés.
 * L'art. 110 bis, al. 2 reporte l'échéance au premier jour ouvrable qui suit.
 */
function premierJourOuvrableFiscal(s) {
  let d = jourUtc(s);
  for (;;) {
    const j = d.getUTCDay();
    if (j !== 0 && j !== 6 && !FERIES.includes(iso(d).slice(5))) return iso(d);
    d = new Date(d.getTime() + 86_400_000);
  }
}
/** IRPP du mois · le 15 du mois suivant (art. 18), reporté (art. 110 bis). */
const echeanceIrpp = (mois) => premierJourOuvrableFiscal(`${moisSuivant(mois)}-15`);
/** CNSS · « dans les quinze jours suivant le mois civil » (arrêté n° 138/2018, art. 2) · aucun report lu. */
const echeanceCnss = (mois) => `${moisSuivant(mois)}-15`;
/** ONEM · paiement au plus tard le 15 du mois suivant (arrêté n° 028/2025, art. 3) · aucun report lu. */
const echeanceOnem = (mois) => `${moisSuivant(mois)}-15`;
/** INPP · ordonnance n° 84/186, art. 3 · 30 avril, 31 juillet, 31 octobre, 31 janvier, sans report. */
function echeanceInpp(mois) {
  const a = Number(mois.slice(0, 4));
  const m = Number(mois.slice(5, 7));
  if (m <= 3) return `${a}-04-30`;
  if (m <= 6) return `${a}-07-31`;
  if (m <= 9) return `${a}-10-31`;
  return `${a + 1}-01-31`;
}

// --- Outils du scénario --------------------------------------------------------

/** UN REFUS ATTENDU · le geste est juste refusé par la règle ; le banc vérifie le refus, il ne le contourne pas. */
async function refusAttendu(c, R, libelle, methode, chemin, corps, statuts = [400]) {
  const r = await c.req(methode, chemin, corps);
  const ok = statuts.includes(r.statut);
  R.egal(`${libelle} · refusé (${statuts.join(' ou ')})`, true, ok);
  if (!ok) R.note(`${libelle} · statut ${r.statut} · ${JSON.stringify(r.corps).slice(0, 400)}`);
  return r;
}

const nombre = (x) => (x === null || x === undefined ? null : Number(x));
const tuple = (b) => b && [nombre(b.totalVerseFc), nombre(b.assietteSocialeFc), nombre(b.cotisationsTravailleurFc), nombre(b.irppFc), nombre(b.netAPayerFc)];
const tupleAttendu = (a) => [a.totalVerse, a.assiette, a.pt, a.irpp, a.net];

/** Les cours du dollar de chaque fin de mois · multiples de 4 FC, pour que les francs convertis restent entiers (1 400 USD × 4). */
const COURS_FIN_DE_MOIS = {
  '2026-01': 2_848, '2026-02': 2_852, '2026-03': 2_856, '2026-04': 2_860, '2026-05': 2_864, '2026-06': 2_868,
  '2026-07': 2_872, '2026-08': 2_876, '2026-09': 2_880, '2026-10': 2_884, '2026-11': 2_888, '2026-12': 2_892,
  '2027-01': 2_896, '2027-02': 2_900, '2027-03': 2_904,
};

// ==============================================================================
// 1. SARL · CHANTIERS DU KIVU
// ==============================================================================

async function sarl(R) {
  R.scenario = 'paie-avancee';
  const c = await nouveauDossier(R, 'Passe paie avancée · Chantiers du Kivu SARL', {
    cle: 'paie-sarl', referentiel: 'SYSCOHADA', systeme: 'NORMAL', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ');
  const od = c.od;
  const L = new LivreAttendu();
  const ctx = { sal: {}, att: {}, bulletins: {} };
  // Le livre attendu de la banque · apport, puis chaque décaissement du banc.
  const banque = (montant) => L.add(BQ, montant > 0 ? montant : 0, montant < 0 ? -montant : 0);
  /** Les retenues attendues de chaque mois de versement, par nature. */
  const parMois = new Map();
  const cumulMois = (mois, a) => {
    const x = parMois.get(mois) ?? { irpp: 0, cnss: 0, pf: 0, rp: 0, pension: 0, inpp: 0, onem: 0, nets: 0 };
    x.irpp += a.irpp; x.cnss += a.pf + a.pe + a.pt + a.rp; x.pf += a.pf; x.rp += a.rp; x.pension += a.pe + a.pt;
    x.inpp += a.inpp; x.onem += a.onem; x.nets += a.net;
    parMois.set(mois, x);
  };

  await etape(R, 'SARL · dossier, module de paie, apport, dollar et cours', async () => {
    const m = await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    R.egal('module de paie activé', true, Boolean(m && JSON.stringify(m).includes('PAIE')));
    await ecriture(c, 'Apport en capital', n, '2026-01-01', 'Apport des associés', [[BQ, 500_000_000, 0], ['10130000', 0, 500_000_000]], { journal: bq });
    banque(500_000_000);
    L.add('10130000', 0, 500_000_000);
    const devises = (await c.lire('Devises', '/devises')) ?? [];
    ctx.usd = (Array.isArray(devises) ? devises : devises.devises ?? []).find((d) => d.code === 'USD')
      ?? (await c.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
    for (const [mois, cours] of Object.entries(COURS_FIN_DE_MOIS)) {
      await c.geste(`Cours USD du ${finDeMois(mois)}`, 'POST', `/devises/${ctx.usd?.id}/cours`, { date: finDeMois(mois), cours, source: 'Banque centrale du Congo (banc paie avancée)' });
    }
    // Un cours à trois décimales, pour l'arrondi au centime supérieur de la conversion.
    await c.geste('Cours USD du 2026-06-15', 'POST', `/devises/${ctx.usd?.id}/cours`, { date: '2026-06-15', cours: 2_850.125, source: 'Banque centrale du Congo (banc paie avancée)' });
  });

  await etape(R, 'SARL · rubriques du cabinet et bulletins modèles', async () => {
    ctx.prdt = await c.geste('Rubrique prime de rendement', 'POST', '/personnel/rubriques', {
      code: 'PRDT', libelle: 'Prime de rendement', nature: 'PRIME', fondement: "Accord d'entreprise du 2 janvier 2026, art. 4",
    });
    // Code du travail, art. 7, point 8 · le transport est l'une des cinq
    // exclusions · une rubrique ne sort pas un montant de l'assiette par son nom.
    await refusAttendu(c, R, 'Rubrique « prime de transport » de nature INDEMNITE_DE_TRANSPORT', 'POST', '/personnel/rubriques', {
      code: 'PTRP', libelle: 'Prime de transport', nature: 'INDEMNITE_DE_TRANSPORT', fondement: "Accord d'entreprise, art. 5",
    });
    ctx.anc = await c.geste('Rubrique prime d’ancienneté', 'POST', '/personnel/rubriques', {
      code: 'PANC', libelle: "Prime d'ancienneté", nature: 'PRIME', fondement: "Accord d'entreprise, art. 6",
    });
    if (ctx.anc) await c.geste('Désactivation de la prime d’ancienneté', 'PATCH', `/personnel/rubriques/${ctx.anc.id}`, { actif: false });
    // Le modèle envoie une nature fausse sur la ligne rattachée à la rubrique ·
    // la rubrique décide de la nature (modeles-bulletin.ts, règle 2).
    const mod = await c.geste('Modèle « Ouvrier qualifié »', 'POST', '/personnel/modeles-bulletin', {
      nom: 'Ouvrier qualifié', categorie: 'Ouvriers', deviseStipulation: 'CDF',
      lignes: [
        { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montant: 750_000 },
        { nature: 'INDEMNITE_DE_TRANSPORT', libelle: 'Prime de rendement', rubriqueId: ctx.prdt?.id, montant: 50_000 },
      ],
    });
    R.egal('modèle · la ligne rattachée à la rubrique prend la nature PRIME', 'PRIME', mod?.lignes?.[1]?.nature ?? null);
    await c.geste('Modèle « Encadrement en dollars »', 'POST', '/personnel/modeles-bulletin', {
      nom: 'Encadrement en dollars', categorie: 'Maîtrise', deviseStipulation: 'USD',
      lignes: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montant: 1_250 }, { nature: 'AVANTAGE_EN_NATURE', libelle: 'Véhicule de fonction', montant: 150 }],
    });
    await refusAttendu(c, R, 'Modèle portant une rubrique désactivée', 'POST', '/personnel/modeles-bulletin', {
      nom: 'Ancien modèle', deviseStipulation: 'CDF', lignes: [{ nature: 'PRIME', libelle: 'Ancienneté', rubriqueId: ctx.anc?.id, montant: 10_000 }],
    });
    const liste = (await c.lire('Bulletins modèles', '/personnel/modeles-bulletin')) ?? [];
    const modeles = Array.isArray(liste) ? liste : liste.modeles ?? [];
    ctx.modeleOuvrier = modeles.find((x) => x.nom === 'Ouvrier qualifié') ?? null;
    R.egal('deux bulletins modèles enregistrés', 2, modeles.length);
  });

  await etape(R, 'SARL · registre du personnel (treize salariés) et contrats', async () => {
    // Classes et rémunérations au-dessus du minimum de la classe (décret
    // n° 25/22, art. 4 et 7, annexe 2 · taux journalier × 26) ·
    // classe 7 · 50 955 × 26 = 1 324 830 ; classe 4 · 33 110 × 26 = 860 860 ;
    // classe 3 · 28 595 × 26 = 743 470 ; classe 2 · 24 940 × 26 = 648 440 ;
    // classe 1 · 21 500 par jour.
    const fiches = [
      ['E1', 'MBUYI', 'MASCULIN', { dateEntreeEnVigueur: '2024-01-01', natureTravail: 'Comptable', classeProfessionnelle: 7, periodiciteRemuneration: 'MOIS', remunerationBase: 1_500_000, deviseRemuneration: 'CDF' }],
      ['E2', 'KAPINGA', 'FEMININ', { dateEntreeEnVigueur: '2025-06-01', natureTravail: 'Cheffe de chantier', classeProfessionnelle: 10, periodiciteRemuneration: 'MOIS', remunerationBase: 1_250, deviseRemuneration: 'USD' }],
      ['E3', 'ILUNGA', 'MASCULIN', { dateEntreeEnVigueur: '2021-07-01', natureTravail: 'Maçon chef d’équipe', classeProfessionnelle: 4, periodiciteRemuneration: 'MOIS', remunerationBase: 884_000, deviseRemuneration: 'CDF' }],
      ['E4', 'KASONGO', 'MASCULIN', { dateEntreeEnVigueur: '2023-02-01', natureTravail: 'Ferrailleur', classeProfessionnelle: 3, periodiciteRemuneration: 'MOIS', remunerationBase: 780_000, deviseRemuneration: 'CDF' }],
      ['E5', 'TSHIBANDA', 'MASCULIN', { dateEntreeEnVigueur: '2026-10-01', natureTravail: 'Manœuvre ordinaire à temps partiel', classeProfessionnelle: 1, periodiciteRemuneration: 'JOUR', remunerationBase: 23_000, deviseRemuneration: 'CDF' }],
      ...['MUKENDI', 'KALONJI', 'NGOY', 'BANZA', 'KABEYA', 'LUMBU', 'MWAMBA', 'TSHOMBE'].map((nom, i) => [
        `E${6 + i}`, nom, i % 2 ? 'FEMININ' : 'MASCULIN',
        { dateEntreeEnVigueur: '2025-01-01', natureTravail: 'Ouvrier qualifié', classeProfessionnelle: 2, periodiciteRemuneration: 'MOIS', remunerationBase: 750_000, deviseRemuneration: 'CDF' },
      ]),
    ];
    for (const [cle, nom, sexe, contrat] of fiches) {
      const s = await c.geste(`Salarié ${nom}`, 'POST', '/personnel/salaries', { nom, sexe, nationalite: 'congolaise', lieuNaissance: 'Goma' });
      if (!s) continue;
      const k = await c.geste(`Contrat ${nom}`, 'POST', `/personnel/salaries/${s.id}/contrats`, { type: 'DUREE_INDETERMINEE', lieuExecution: 'Goma', ...contrat });
      ctx.sal[cle] = { id: s.id, nom, contratId: k?.id ?? null };
    }
    const ef = await c.lire('Effectif au 2026-03-31', '/personnel/effectif?ala=2026-03-31');
    // Au 31 mars · E1 à E4 et les huit ouvriers · TSHIBANDA n'entre qu'en octobre.
    R.montant('effectif du registre au 31/03/2026', 12, ef?.effectif);
    R.montant('part de main-d’œuvre nationale au 31/03/2026 (registre)', 100, ef?.partMainOeuvreNationale);
  });

  await etape(R, 'SARL · minimum de la classe avant le barème du cabinet', async () => {
    const conf = await c.lire('Confrontation du registre', '/personnel/confrontation');
    const fiche = (nom) => (conf?.fiches ?? []).find((f) => f.salarie === nom)?.remunerationMinimale ?? null;
    // Mois de référence · celui du serveur (février 2028), barème livré 21 500 FC.
    R.egal('TSHIBANDA (classe 1, 23 000 FC/jour) · conforme au SMIG de 21 500 FC', true, fiche('TSHIBANDA')?.conforme ?? null);
    R.montant('TSHIBANDA · minimum journalier de la classe 1', 21_500, fiche('TSHIBANDA')?.minimumFc);
    // 50 955 × 26 = 1 324 830 (classe 7, tension 237).
    R.montant('MBUYI · minimum mensuel de la classe 7', 1_324_830, fiche('MBUYI')?.minimumFc);
    // Le minimum du décret n° 25/22 est en francs · un contrat en dollars ne s'y compare pas (P1b, F226).
    R.egal('KAPINGA (rémunération stipulée en USD) · aucun verdict de conformité', null, fiche('KAPINGA')?.conforme ?? null);
  });

  await etape(R, 'SARL · avance et prêt au registre', async () => {
    ctx.avance = await c.geste('Avance sur salaire de MUKENDI', 'POST', `/personnel/salaries/${ctx.sal.E6?.id}/avances`, {
      type: 'AVANCE', dateOctroi: '2026-03-10', montantFc: 300_000, retenueMensuelleFc: 150_000, objet: 'Avance pour frais médicaux', pieceJustificative: 'Demande signée du 9 mars 2026',
    });
    await ecriture(c, 'Versement de l’avance de MUKENDI', n, '2026-03-10', 'Avance sur salaire MUKENDI', [['42110000', 300_000, 0], [BQ, 0, 300_000]], { journal: bq });
    L.add('42110000', 300_000, 0); banque(-300_000);
    ctx.pret = await c.geste('Prêt à MBUYI', 'POST', `/personnel/salaries/${ctx.sal.E1?.id}/avances`, {
      type: 'PRET', categoriePret: 'AUTRE', dateOctroi: '2026-04-01', montantFc: 1_200_000, retenueMensuelleFc: 100_000, objet: 'Prêt pour frais de scolarité', pieceJustificative: 'Contrat de prêt n° P-2026-01',
    });
    // Fiche du compte 27 · 2728 « Autres prêts au personnel » (catégorie AUTRE).
    R.egal('prêt imputé au 27280000', '27280000', ctx.pret ? (await c.lire('Avances', '/personnel/avances'))?.avances?.find((a) => a.id === ctx.pret.id)?.compte?.compte ?? null : null);
    await ecriture(c, 'Versement du prêt de MBUYI', n, '2026-04-01', 'Prêt MBUYI', [['27280000', 1_200_000, 0], [BQ, 0, 1_200_000]], { journal: bq });
    L.add('27280000', 1_200_000, 0); banque(-1_200_000);
  });

  /** Les éléments de chaque salarié pour un mois · `null` hors contrat. */
  const elementsDu = (cle, mois) => {
    const m = Number(mois.slice(5, 7));
    const an = Number(mois.slice(0, 4));
    if (cle === 'E1') {
      const el = [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: 1_500_000 }];
      if (mois === '2026-06') el.push({ nature: 'PRIME', libelle: 'Prime de rendement du semestre', montantFc: 300_000, rubriqueId: ctx.prdt?.id, natureEnvoyee: 'INDEMNITE_DE_TRANSPORT' });
      return el;
    }
    if (cle === 'E3') return an === 2026 && m <= 6 ? [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: 884_000 }] : null;
    if (cle === 'E4') return an === 2026 && m <= 10 ? [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: 780_000 }] : null;
    if (cle === 'E5') return an === 2027 || m >= 10 ? [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de 13 jours', montantFc: 13 * 23_000 }] : null;
    if (/^E([6-9]|1[0-3])$/.test(cle)) {
      return (ctx.modeleOuvrier?.lignes ?? []).map((l) => ({ nature: l.nature, libelle: l.libelle, montantFc: Number(l.montant), ...(l.rubriqueId ? { rubriqueId: l.rubriqueId } : {}) }));
    }
    return null;
  };

  /** Émet le bulletin d'un salarié, le compare à l'attendu, et le tient au livre attendu. */
  const emettre = async (cle, mois, { smig = SMIG_2026, extra = [] } = {}) => {
    const s = ctx.sal[cle];
    if (!s) return null;
    let corps;
    let a;
    if (cle === 'E2') {
      // Salaire stipulé en dollars · converti au cours de la DATE DE MISE À
      // DISPOSITION (décision T8 · loi n° 23/053, art. 115) · 1 250 USD de
      // salaire et 150 USD d'avantage en nature (véhicule).
      const cours = COURS_FIN_DE_MOIS[mois];
      corps = {
        moisDePaie: mois, deviseStipulation: 'USD', dateMiseADisposition: finDeMois(mois), ...PRIVE,
        elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantUsd: 1_250 }, { nature: 'AVANTAGE_EN_NATURE', libelle: 'Véhicule de fonction', montantUsd: 150 }],
      };
      a = attenduBulletin({ elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', montantFc: 1_250 * cours }, { nature: 'AVANTAGE_EN_NATURE', montantFc: 150 * cours }], smig });
    } else {
      const el = [...(elementsDu(cle, mois) ?? []), ...extra];
      if (el.length === 0) return null;
      const retenue = cle === 'E1' && mois >= '2026-04' && mois <= '2027-03' ? 100_000 : cle === 'E6' && (mois === '2026-04' || mois === '2026-05') ? 150_000 : 0;
      const avance = cle === 'E1' ? ctx.pret : ctx.avance;
      corps = {
        moisDePaie: mois, dateMiseADisposition: finDeMois(mois), ...PRIVE,
        elements: el.map((e) => ({ nature: e.natureEnvoyee ?? e.nature, libelle: e.libelle, montantFc: e.montantFc, ...(e.rubriqueId ? { rubriqueId: e.rubriqueId } : {}) })),
        ...(cle === 'E5' ? { joursPayes: 13 } : {}),
        ...(retenue ? { retenuesAvances: [{ avanceId: avance?.id, montantFc: retenue }] } : {}),
      };
      a = attenduBulletin({ elements: el, joursPayes: cle === 'E5' ? 13 : null, smig, retenue, compteRetenue: cle === 'E1' ? '27280000' : '42110000' });
    }
    const b = await c.geste(`Bulletin ${s.nom} ${mois}`, 'POST', `/personnel/salaries/${s.id}/bulletins`, corps);
    if (!b) return null;
    R.egal(`${mois} · bulletin ${s.nom} · [versé, assiette sociale, quote-part ouvrière, IRPP, net]`, tupleAttendu(a), tuple(b));
    ctx.att[`${cle}-${mois}`] = { a, b };
    return { a, b };
  };

  /** Passe la paie du mois, paie les nets, tient le livre attendu et valide. */
  const passerLeMois = async (exerciceId, mois, actifs, options = {}) => {
    const p = await c.geste(`Passation de la paie ${mois}`, 'POST', `/personnel/paie-du-mois/${mois}/comptabilisation`, { exerciceId, journalId: od.id, date: finDeMois(mois), ...options });
    let nets = 0;
    for (const x of actifs) {
      L.passer(x.a);
      cumulMois(mois, x.a);
      nets += x.a.net;
    }
    if (p) {
      await ecriture(c, `Paiement des nets ${mois}`, exerciceId, finDeMois(mois), `Salaires nets ${mois}`, [['42200000', nets, 0], [BQ, 0, nets]], { journal: bq });
      L.add('42200000', nets, 0); banque(-nets);
    }
    await validerJusqua(c, exerciceId, finDeMois(mois));
    return p;
  };

  /** Le reversement de la CNSS et de l'ONEM d'un mois, à la date donnée. */
  const reverserCnssOnem = async (exerciceId, mois, date) => {
    const x = parMois.get(mois);
    if (!x) return;
    await ecriture(c, `Reversement CNSS ${mois}`, exerciceId, date, `Cotisations CNSS ${mois}`,
      [['43110000', x.pf, 0], ['43120000', x.rp, 0], ['43130000', x.pension, 0], [BQ, 0, x.cnss]], { journal: bq });
    L.add('43110000', x.pf, 0); L.add('43120000', x.rp, 0); L.add('43130000', x.pension, 0); banque(-x.cnss);
    await ecriture(c, `Reversement ONEM ${mois}`, exerciceId, date, `Contribution ONEM ${mois}`, [['44280000', x.onem, 0], [BQ, 0, x.onem]], { journal: bq });
    L.add('44280000', x.onem, 0); banque(-x.onem);
  };
  const reverserIrpp = async (exerciceId, date, montant, libelle) => {
    await ecriture(c, `Reversement IRPP · ${libelle}`, exerciceId, date, `IRPP ${libelle}`, [['44720000', montant, 0], [BQ, 0, montant]], { journal: bq });
    L.add('44720000', montant, 0); banque(-montant);
  };
  const reverserInpp = async (exerciceId, date, moisDuTrimestre) => {
    const montant = moisDuTrimestre.reduce((s, m) => s + (parMois.get(m)?.inpp ?? 0), 0);
    await ecriture(c, `Reversement INPP ${moisDuTrimestre[0]} à ${moisDuTrimestre[2]}`, exerciceId, date, `Cotisation INPP du trimestre`, [['44280000', montant, 0], [BQ, 0, montant]], { journal: bq });
    L.add('44280000', montant, 0); banque(-montant);
  };

  // --- 2026, mois par mois ---------------------------------------------------
  for (let m = 1; m <= 12; m += 1) {
    const mois = `2026-${String(m).padStart(2, '0')}`;
    const prec = m > 1 ? `2026-${String(m - 1).padStart(2, '0')}` : null;
    await etape(R, `SARL · paie de ${mois}`, async () => {
      // LES REVERSEMENTS DU MOIS PRÉCÉDENT · CNSS et ONEM le 14 ; l'IRPP le 14
      // aussi, sauf janvier et février, qui servent l'imputation (art. 154).
      if (prec) await reverserCnssOnem(n, prec, `${mois}-14`);
      if (prec && m >= 5) await reverserIrpp(n, `${mois}-14`, parMois.get(prec).irpp, prec);
      if (mois === '2026-03') {
        // Janvier n'est pas reversé à son échéance ; le 13 mars, le cabinet
        // verse janvier et février moins 100 000 FC · la dette échue la plus
        // ancienne s'éteint d'abord (Code civil, Livre III, art. 154).
        await reverserIrpp(n, '2026-03-13', parMois.get('2026-01').irpp + parMois.get('2026-02').irpp - 100_000, 'janvier et février (partiel)');
      }
      if (mois === '2026-04') await reverserIrpp(n, '2026-04-14', 100_000 + parMois.get('2026-03').irpp, 'reste de février et mars');
      if (mois === '2026-04') await reverserInpp(n, '2026-04-30', ['2026-01', '2026-02', '2026-03']);
      if (mois === '2026-07') await reverserInpp(n, '2026-07-31', ['2026-04', '2026-05', '2026-06']);
      if (mois === '2026-10') await reverserInpp(n, '2026-10-30', ['2026-07', '2026-08', '2026-09']);

      const actifs = [];
      for (const cle of Object.keys(ctx.sal)) {
        const x = await emettre(cle, mois, mois === '2026-05' && cle === 'E1'
          ? { extra: [{ nature: 'PRESTATION_SUPPLEMENTAIRE', libelle: 'Heures supplémentaires (saisie erronée)', montantFc: 120_000 }] }
          : {});
        if (x) actifs.push(x);
      }
      if (mois === '2026-07') actifs.push(...(await decompteIlunga()));
      if (mois === '2026-11') actifs.push(...(await decompteKasongo()));
      if (mois === '2026-06') {
        // La rubrique impose sa nature · envoyée « transport », la prime de
        // rendement reste une PRIME, dans l'assiette sociale (rubriques-paie.ts).
        const b = ctx.att['E1-2026-06']?.b;
        R.egal('2026-06 · MBUYI · la prime envoyée « transport » est relue PRIME', 'PRIME', b?.entree?.elements?.find((e) => e.rubriqueId)?.nature ?? null);
      }
      if (mois === '2026-01') await verifierConversion();
      await passerLeMois(n, mois, actifs);
      if (mois === '2026-03') await registreApresImputation();
      if (mois === '2026-05') await corrigerMaiDeMbuyi();
    });
  }

  /** La trace de la conversion du salaire en dollars, et l'arrondi au centime supérieur. */
  async function verifierConversion() {
    const b = ctx.att['E2-2026-01']?.b;
    const conv = b?.calcul?.conversion ?? null;
    R.montant('2026-01 · KAPINGA · cours figé au bulletin (fin de mois)', 2_848, conv?.cours);
    R.egal('2026-01 · KAPINGA · date du cours = date de mise à disposition', ['2026-01-31', 'MISE_A_DISPOSITION'], [conv?.dateCours ?? null, conv?.origineDateCours ?? null]);
    // 1 250 USD × 2 848 = 3 560 000 FC.
    R.montant('2026-01 · KAPINGA · salaire converti', 3_560_000, conv?.elements?.[0]?.montantFc);
    // 333,33 USD × 2 850,125 = 950 032,16625 FC · « chaque élément converti
    // s'arrondit au CENTIME SUPÉRIEUR » (décision de Manasse du 2026-09-24) · 950 032,17.
    const sim = await c.geste('Simulation d’une prime de 333,33 USD au cours du 15 juin', 'POST', `/personnel/simulation?salarieId=${ctx.sal.E2?.id}`, {
      moisDePaie: '2026-06', deviseStipulation: 'USD', dateMiseADisposition: '2026-06-15', ...PRIVE,
      elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantUsd: 1_250 }, { nature: 'PRIME', libelle: 'Prime exceptionnelle', montantUsd: 333.33 }],
    });
    R.montant('simulation · 333,33 USD au cours de 2 850,125 · arrondi au centime supérieur', 950_032.17, sim?.conversion?.elements?.[1]?.montantFc);
    // Aucun cours n'est coté au jour du calcul (horloge du serveur, 15/02/2028) · refus nommé, jamais le dernier cours connu.
    await refusAttendu(c, R, 'Simulation en dollars sans date de mise à disposition, aucun cours au jour du calcul', 'POST', `/personnel/simulation?salarieId=${ctx.sal.E2?.id}`, {
      moisDePaie: '2026-06', deviseStipulation: 'USD', ...PRIVE, elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantUsd: 1_250 }],
    });
    // Remise du décompte écrit de l'art. 103 · déclarée une fois.
    const b1 = ctx.att['E1-2026-01']?.b;
    if (b1) {
      const r = await c.geste('Remise du bulletin de janvier de MBUYI', 'POST', `/personnel/bulletins/${b1.id}/remise`, { remisLe: '2026-02-02' });
      R.egal('remise du bulletin déclarée au 02/02/2026', '2026-02-02', r?.remisLe ? String(r.remisLe).slice(0, 10) : null);
      await refusAttendu(c, R, 'Seconde déclaration de remise du même bulletin', 'POST', `/personnel/bulletins/${b1.id}/remise`, { remisLe: '2026-02-03' });
    }
  }

  /** Le registre au 31 mars · l'imputation du reversement du 13 mars. */
  async function registreApresImputation() {
    const reg = await c.lire('Registre des retenues au 31/03/2026', `/retenues/registre?exerciceId=${n}&dateReference=2026-03-31`);
    const irpp = (reg?.natures ?? []).find((x) => x.cle === 'irppSalaires');
    const ligne = (mois) => (irpp?.mois ?? []).find((x) => x.mois === mois) ?? null;
    R.montant('registre au 31/03 · IRPP de janvier éteint en premier (art. 154)', 0, ligne('2026-01')?.solde);
    R.montant('registre au 31/03 · IRPP de février · reste 100 000', 100_000, ligne('2026-02')?.solde);
    R.egal('registre au 31/03 · IRPP de février en retard (échéance du 16/03, le 15 étant un dimanche)', [echeanceIrpp('2026-02'), true], [ligne('2026-02')?.echeance?.slice(0, 10) ?? null, ligne('2026-02')?.enRetard ?? null]);
    R.montant('registre au 31/03 · IRPP de mars', parMois.get('2026-03').irpp, ligne('2026-03')?.solde);
  }

  /** Mai · le bulletin de MBUYI portait des heures supplémentaires saisies à tort. */
  async function corrigerMaiDeMbuyi() {
    const orig = ctx.att['E1-2026-05'];
    if (!orig) return;
    // Validé, il s'annule (P9) · la passation du mois le reprend en négatif.
    await c.geste('Annulation du bulletin de mai de MBUYI', 'POST', `/personnel/bulletins/${orig.b.id}/annulation`, { motif: 'Heures supplémentaires saisies à tort sur le bulletin de mai' });
    const bis = await emettre('E1', '2026-05');
    await refusAttendu(c, R, 'Repasser mai sans confirmer la reprise en négatif', 'POST', '/personnel/paie-du-mois/2026-05/comptabilisation', { exerciceId: n, journalId: od.id, date: '2026-05-31' });
    const p = await c.geste('Passation corrective de mai (reprise en négatif confirmée)', 'POST', '/personnel/paie-du-mois/2026-05/comptabilisation', { exerciceId: n, journalId: od.id, date: '2026-05-31', inscrireNegatifs: true });
    R.montant('mai · un bulletin repris en négatif', 1, p?.reprisEnNegatif?.length);
    if (p && bis) {
      // Le livre attendu · l'original sort (négatif de ce qui a été passé), le réémis entre.
      const neg = { ...orig.a, elements: orig.a.elements.map((e) => ({ ...e, montantFc: -e.montantFc })) };
      for (const k of ['assiette', 'baseCnss', 'aen', 'totalVerse', 'pf', 'pe', 'pt', 'rp', 'inpp', 'onem', 'irpp', 'retenue', 'net']) neg[k] = -orig.a[k];
      L.passer(neg); cumulMois('2026-05', neg);
      L.passer(bis.a); cumulMois('2026-05', bis.a);
      // Le net de l'original a été payé le 31 mai · le trop-versé revient du salarié.
      const rendu = orig.a.net - bis.a.net;
      await ecriture(c, 'Remboursement du trop-versé de mai par MBUYI', n, '2026-06-10', 'Trop-versé mai MBUYI', [[BQ, rendu, 0], ['42200000', 0, rendu]], { journal: bq });
      L.add('42200000', 0, rendu); banque(rendu);
    }
    await validerJusqua(c, n, '2026-06-10');
  }

  /**
   * JUILLET · LICENCIEMENT D'ILUNGA, préavis dispensé par l'employeur.
   * Entré le 01/07/2021, notifié le 31/07/2026 · cinq années entières de date
   * à date. Art. 64 · 14 + 7 × 5 = 49 jours ouvrables à dater du lendemain,
   * le 01/08/2026 (samedi, férié · Fête des parents). Les 49 jours ouvrables
   * (lundi au samedi, art. 7 point 9 et 121) · 3 au 8 août (6), 10 au 15 (12),
   * 17 au 22 (18), 24 au 29 (24), 31 (25), 1er au 5 septembre (30), 7 au 12
   * (36), 14 au 19 (42), 21 au 26 (48), 28 (49) · délai du 01/08 au 28/09.
   * Art. 63, al. 3 et 93 · la rémunération du délai, fériés compris ·
   * un mois entier (août) à 884 000, puis 24 jours payables de septembre
   * (1er au 5, 7 au 12, 14 au 19, 21 au 26, 28) à 884 000 / 26 = 34 000 ·
   * 884 000 + 816 000 = 1 700 000.
   * Art. 141 et 144 · sept mois non couverts (janvier à juillet), un jour par
   * mois, plus un jour pour la tranche de cinq ans · 8 × 34 000 = 272 000.
   * Arriérés · le salaire de juillet, 884 000. Total dû · 2 856 000.
   */
  async function decompteIlunga() {
    const s = ctx.sal.E3;
    if (!s) return [];
    const faits = {
      anneesAnciennete: 5, moisNonCouvertsParUnConge: 7, initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', typeContrat: 'DUREE_INDETERMINEE',
      dateNotification: '2026-07-31', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR', remunerationJournaliereFc: 34_000, remunerationMensuelleFc: 884_000,
      moyenneMensuelleArticle66Fc: 0, moyenneMensuelleArticle142Fc: 0, avantagesPendantPreavisFc: 0, arrieresFc: 884_000, gratificationFc: 0,
      enfantsBeneficiairesAllocations: 0, moisDeCessation: '2026-07',
    };
    const calc = await c.geste('Décompte final d’ILUNGA (calcul)', 'POST', '/personnel/decompte-final', faits);
    const rub = (k) => calc?.rubriques?.find((r) => r.cle === k)?.montantFc ?? null;
    R.montant('ILUNGA · préavis de l’art. 64 (jours ouvrables)', 49, calc?.preavis?.joursOuvrables);
    R.montant('ILUNGA · indemnité compensatrice de préavis', 1_700_000, rub('preavis'));
    R.montant('ILUNGA · jours de congé de l’art. 141', 8, calc?.conge?.joursOuvrables);
    R.montant('ILUNGA · indemnité compensatrice de congé', 272_000, rub('conge'));
    R.montant('ILUNGA · total dû au travailleur', 2_856_000, calc?.totalDuAuTravailleurFc);
    await c.geste('Fin du contrat d’ILUNGA', 'POST', `/personnel/contrats/${s.contratId}/fin`, { dateFin: '2026-07-31', motifFin: 'Licenciement, préavis dispensé par l’employeur' });
    const elementsMois = [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de juillet', montantFc: 884_000 }];
    const b = await c.geste('Décompte final d’ILUNGA (émission)', 'POST', `/personnel/salaries/${s.id}/decompte-final`, { decompte: faits, paie: { moisDePaie: '2026-07', elements: elementsMois, ...PRIVE } });
    const a = attenduBulletin({ elements: [...elementsMois, { nature: 'INDEMNITE_DE_FIN_DE_CONTRAT', montantFc: 1_700_000 }, { nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', montantFc: 272_000 }] });
    if (!b) return [];
    R.egal('ILUNGA · décompte émis comme un bulletin (nature DECOMPTE_FINAL)', 'DECOMPTE_FINAL', b.nature ?? null);
    R.egal('2026-07 · décompte ILUNGA · [versé, assiette sociale, quote-part ouvrière, IRPP, net]', tupleAttendu(a), tuple(b));
    // Le décompte remplace le bulletin du mois · un seul document actif par salarié et par mois.
    await refusAttendu(c, R, 'Bulletin ordinaire de juillet pour ILUNGA après son décompte final', 'POST', `/personnel/salaries/${s.id}/bulletins`, { moisDePaie: '2026-07', elements: elementsMois, ...PRIVE });
    return [{ a, b }];
  }

  /**
   * NOVEMBRE · DÉPART DE KASONGO À MI-PRÉAVIS (art. 66). Entré le 01/02/2023,
   * préavis notifié le 15/10/2026 · trois années entières · 14 + 21 = 35 jours
   * ouvrables du 16/10 au 25/11 (16 et 17 octobre, 19 au 24, 26 au 31, 2 au
   * 7 novembre, 9 au 14, 16 au 21, 23 au 25 · aucun férié). Il cesse le
   * travail le 05/11, après 18 jours ouvrables (moitié · 17,5) · 17 restent à
   * courir, du 06/11 au 25/11 · 17 jours payables, aucun mois entier ·
   * 17 × 780 000 / 26 = 17 × 30 000 = 510 000 (art. 66, al. 2).
   * Congé · dix mois entiers non couverts (janvier à octobre), aucune tranche
   * de cinq ans · 10 × 30 000 = 300 000. Arriérés · quatre jours de novembre
   * (2 au 5) à 30 000 = 120 000. Total · 930 000.
   */
  async function decompteKasongo() {
    const s = ctx.sal.E4;
    if (!s) return [];
    const faits = {
      anneesAnciennete: 3, moisNonCouvertsParUnConge: 10, initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', typeContrat: 'DUREE_INDETERMINEE',
      dateNotification: '2026-10-15', executionPreavis: 'DEPART_A_MI_PREAVIS', joursPreavisNonObserves: 17, avantagesEnNatureRestantsFc: 0,
      remunerationJournaliereFc: 30_000, remunerationMensuelleFc: 780_000, moyenneMensuelleArticle66Fc: 0, moyenneMensuelleArticle142Fc: 0,
      arrieresFc: 120_000, gratificationFc: 0, enfantsBeneficiairesAllocations: 0, moisDeCessation: '2026-11',
    };
    const calc = await c.geste('Décompte final de KASONGO (calcul)', 'POST', '/personnel/decompte-final', faits);
    const rub = (k) => calc?.rubriques?.find((r) => r.cle === k)?.montantFc ?? null;
    R.montant('KASONGO · préavis de l’art. 64 (jours ouvrables)', 35, calc?.preavis?.joursOuvrables);
    R.montant('KASONGO · rémunération du préavis restant à courir (art. 66)', 510_000, rub('remuneration-preavis-restant'));
    R.montant('KASONGO · indemnité compensatrice de congé', 300_000, rub('conge'));
    R.montant('KASONGO · total dû au travailleur', 930_000, calc?.totalDuAuTravailleurFc);
    await c.geste('Fin du contrat de KASONGO', 'POST', `/personnel/contrats/${s.contratId}/fin`, { dateFin: '2026-11-05', motifFin: 'Départ à mi-préavis (art. 66)' });
    const elementsMois = [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire du 2 au 5 novembre', montantFc: 120_000 }];
    const b = await c.geste('Décompte final de KASONGO (émission)', 'POST', `/personnel/salaries/${s.id}/decompte-final`, { decompte: faits, paie: { moisDePaie: '2026-11', elements: elementsMois, ...PRIVE } });
    const a = attenduBulletin({ elements: [...elementsMois, { nature: 'INDEMNITE_DE_FIN_DE_CONTRAT', montantFc: 510_000 }, { nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', montantFc: 300_000 }] });
    if (!b) return [];
    R.egal('2026-11 · décompte KASONGO · [versé, assiette sociale, quote-part ouvrière, IRPP, net]', tupleAttendu(a), tuple(b));
    return [{ a, b }];
  }

  await etape(R, 'SARL · avances, livre de paie et échéancier en cours d’année', async () => {
    const av = await c.lire('Registre des avances', '/personnel/avances');
    const lue = (id) => (av?.avances ?? []).find((x) => x.id === id) ?? null;
    // Avance · 300 000 − 150 000 (avril) − 150 000 (mai) = 0.
    R.montant('avance de MUKENDI soldée', 0, lue(ctx.avance?.id)?.soldeFc);
    // Prêt · 1 200 000 − 9 × 100 000 (avril à décembre) = 300 000.
    R.montant('prêt de MBUYI · reste au 31/12/2026', 300_000, lue(ctx.pret?.id)?.soldeFc);
    await refusAttendu(c, R, 'Suppression d’une avance déjà retenue', 'DELETE', `/personnel/avances/${ctx.avance?.id}`, undefined, [400, 409]);
    await refusAttendu(c, R, 'Retenue au-delà du solde de l’avance (simulation)', 'POST', `/personnel/simulation?salarieId=${ctx.sal.E6?.id}`, {
      moisDePaie: '2026-12', ...PRIVE, elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 750_000 }], retenuesAvances: [{ avanceId: ctx.avance?.id, montantFc: 150_000 }],
    });
    // Art. 213 à 215 · fichier informatisé admis d'office (arrêté du 8 août
    // 2008, art. 1er), trente-trois énonciations, moins de vingt-cinq
    // travailleurs habituels (art. 215, al. 3) · livre inspiré admis.
    const toutes = Array.from({ length: 33 }, (_, i) => i + 1);
    const l1 = await c.geste('Livre de paie · fichier informatisé complet', 'POST', '/personnel/livre-de-paie', {
      siegeDExploitation: 'Goma, siège social', formeDuDocument: 'FICHIER_INFORMATISE', effectifHabituel: 12, mentionsPortees: toutes,
    });
    R.egal('livre de paie · [dû, remplacement admis, énonciations complètes, livre inspiré admis]', [true, true, true, true],
      [l1?.livreDu ?? null, l1?.remplacementAutorise ?? null, l1?.enonciationsCompletes ?? null, l1?.livreInspireAdmis ?? null]);
    const l2 = await c.geste('Livre de paie · autre document, trente et une mentions, trente travailleurs', 'POST', '/personnel/livre-de-paie', {
      siegeDExploitation: 'Goma, siège social', formeDuDocument: 'AUTRE_DOCUMENT', effectifHabituel: 30, mentionsPortees: toutes.slice(0, 31),
    });
    R.egal('livre de paie (autre document sans autorisation) · [remplacement admis, livre inspiré admis, mentions manquantes]', [false, false, [32, 33]],
      [l2?.remplacementAutorise ?? null, l2?.livreInspireAdmis ?? null, (l2?.mentionsManquantes ?? []).map((x) => x.rang)]);
    // Échéancier au 20/10/2026 · IRPP de septembre... le 15 novembre (dimanche) reporté au 16 (art. 110 bis) ;
    // CNSS et ONEM le 15 ; déclaration ONEM le 10 (arrêté n° 028/2025, art. 2) ; INPP du troisième trimestre le 31 octobre (samedi), sans report.
    const ech = await c.lire('Échéancier au 20/10/2026', `/retenues/echeancier?exerciceId=${n}&dateReference=2026-10-20`);
    const date = (cle) => (ech?.echeances ?? []).find((x) => x.cle === cle)?.date?.slice(0, 10) ?? null;
    R.egal('échéancier au 20/10/2026 · [INPP, IRPP, CNSS, ONEM, déclaration ONEM]',
      ['2026-10-31', '2026-11-16', '2026-11-15', '2026-11-15', '2026-11-10'],
      [date('inppOnem-inpp'), date('irppSalaires'), date('cnss'), date('inppOnem-onem'), date('declarationMensuelleOnem')]);
  });

  await etape(R, 'SARL · registre des retenues de 2026 et balance avant clôture', async () => {
    const reg = await c.lire('Registre des retenues au 31/12/2026', `/retenues/registre?exerciceId=${n}&dateReference=2026-12-31`);
    const nature = (cle) => (reg?.natures ?? []).find((x) => x.cle === cle) ?? null;
    const lignes = (cle, part = null) => (nature(cle)?.mois ?? []).filter((x) => (part ? x.part === part : true) && !x.anterieur);
    const tous = [...parMois.keys()].sort();
    const verifier = (cle, part, champ, echeance, libelle) => {
      const lu = lignes(cle, part);
      R.egal(`registre 2026 · ${libelle} · retenu par mois`, tous.map((m) => [m, Math.round(parMois.get(m)[champ] * 100) / 100]), lu.map((x) => [x.mois, x.retenu]).sort());
      R.egal(`registre 2026 · ${libelle} · échéances`, tous.map((m) => [m, echeance(m)]), lu.map((x) => [x.mois, x.echeance?.slice(0, 10)]).sort());
      R.egal(`registre 2026 · ${libelle} · mois restant dus (décembre seul)`, ['2026-12'], lu.filter((x) => Math.abs(x.solde) > 0.005).map((x) => x.mois).sort());
    };
    verifier('irppSalaires', null, 'irpp', echeanceIrpp, 'IRPP');
    verifier('cnss', null, 'cnss', echeanceCnss, 'CNSS');
    verifier('inppOnem', 'ONEM', 'onem', echeanceOnem, 'ONEM');
    const inpp = lignes('inppOnem', 'INPP');
    R.egal('registre 2026 · INPP · retenu par mois', tous.map((m) => [m, parMois.get(m).inpp]), inpp.map((x) => [x.mois, x.retenu]).sort());
    R.egal('registre 2026 · INPP · échéances trimestrielles', tous.map((m) => [m, echeanceInpp(m)]), inpp.map((x) => [x.mois, x.echeance?.slice(0, 10)]).sort());
    R.egal('registre 2026 · INPP · mois restant dus (quatrième trimestre)', ['2026-10', '2026-11', '2026-12'], inpp.filter((x) => Math.abs(x.solde) > 0.005).map((x) => x.mois).sort());
    const dec = parMois.get('2026-12');
    const q4 = ['2026-10', '2026-11', '2026-12'].reduce((s, m) => s + parMois.get(m).inpp, 0);
    R.montant('registre 2026 · IRPP dû au 31/12', dec.irpp, nature('irppSalaires')?.solde);
    R.montant('registre 2026 · CNSS due au 31/12', dec.cnss, nature('cnss')?.solde);
    R.montant('registre 2026 · INPP et ONEM dus au 31/12 (ONEM de décembre + INPP du 4e trimestre)', dec.onem + q4, nature('inppOnem')?.solde);

    const b = await balance(c, n);
    for (const compte of ['66110000', '66120000', '66130000', '66140000', '66170000', '66180000', '78100000', '66410000', '64150000', '64130000',
      '42200000', '43110000', '43120000', '43130000', '44720000', '44280000', '27280000', '42110000', BQ]) {
      R.montant(`balance 2026 · ${compte}`, L.solde(compte), solde(b, compte));
    }
    ctx.resultat2026 = ['661', '664', '641', '781'].reduce((s, r) => s + [...L.m.keys()].filter((k) => k.startsWith(r)).reduce((t, k) => t + L.solde(k), 0), 0);
    const bul = await c.lire('Bulletins de mai', '/personnel/bulletins?mois=2026-05');
    const liste = Array.isArray(bul) ? bul : bul?.bulletins ?? [];
    R.egal('mai · bulletins de MBUYI [annulé, émis]', ['ANNULE', 'EMIS'], liste.filter((x) => x.salarieId === ctx.sal.E1?.id).sort((x, y) => x.numero - y.numero).map((x) => x.statut));
    const ef = await c.lire('Effectif au 31/12/2026', '/personnel/effectif?ala=2026-12-31');
    // ILUNGA (fin le 31/07) et KASONGO (fin le 05/11) sortis · E1, E2, E5 et les huit ouvriers.
    R.montant('effectif du registre au 31/12/2026', 11, ef?.effectif);
  });

  const clos = await etape(R, 'SARL · clôture de 2026', () => cloturer(c, '2026'));
  R.egal('clôture de 2026', true, Boolean(clos));
  const n1 = c.exercices.get('2027')?.id;
  if (!n1) {
    R.note('Exercice 2027 absent après la clôture · la suite de la SARL est sautée');
    return;
  }

  await etape(R, 'SARL · 2027 · barème SMIG du cabinet et ouverture', async () => {
    // Une version vient un mois APRÈS la dernière connue (2026-01, annexe 2).
    await refusAttendu(c, R, 'Version SMIG datée du 15/01/2026 (même mois que l’annexe 2)', 'POST', '/personnel/baremes', {
      bareme: 'SMIG', aPartirDu: '2026-01-15', reference: 'Arrêté fictif du banc, ajustement antidaté', valeurs: { smigJournalierFc: SMIG_CABINET_2027 },
    });
    const v = await c.geste('Version SMIG du cabinet au 01/01/2027', 'POST', '/personnel/baremes', {
      bareme: 'SMIG', aPartirDu: '2027-01-01', reference: 'Arrêté ministériel fictif du banc portant ajustement du SMIG de janvier 2027 (décret n° 25/21, art. 10 et 11)', valeurs: { smigJournalierFc: SMIG_CABINET_2027 },
    });
    R.egal('version SMIG du cabinet enregistrée', true, Boolean(v?.version?.id));
    const conf = await c.lire('Confrontation après le barème', '/personnel/confrontation');
    const fiche = (nom) => (conf?.fiches ?? []).find((f) => f.salarie === nom)?.remunerationMinimale ?? null;
    // Classe 1 · 100 × 24 000 / 100 = 24 000 FC par jour ; 23 000 convenus · manque 1 000.
    R.egal('TSHIBANDA · [conforme, minimum, manque] au SMIG du cabinet', [false, 24_000, 1_000], [fiche('TSHIBANDA')?.conforme ?? null, nombre(fiche('TSHIBANDA')?.minimumFc), nombre(fiche('TSHIBANDA')?.manqueFc)]);
    // Classe 7 · 237 × 240 = 56 880 × 26 = 1 478 880 ≤ 1 500 000.
    R.egal('MBUYI · [conforme, minimum] au SMIG du cabinet', [true, 1_478_880], [fiche('MBUYI')?.conforme ?? null, nombre(fiche('MBUYI')?.minimumFc)]);
    // Contrat terminé · jugé sur son dernier mois (juillet 2026), au SMIG livré · 860 860 ≤ 884 000.
    R.egal('ILUNGA (contrat terminé) · [conforme, minimum] sur son dernier mois', [true, 860_860], [fiche('ILUNGA')?.conforme ?? null, nombre(fiche('ILUNGA')?.minimumFc)]);

    const b = await balance(c, n1);
    const dec = parMois.get('2026-12');
    const q4 = ['2026-10', '2026-11', '2026-12'].reduce((s, m) => s + parMois.get(m).inpp, 0);
    R.montant('à-nouveau 2027 · prêt au personnel 2728', 300_000, solde(b, '27280000'));
    R.montant('à-nouveau 2027 · IRPP de décembre (4472)', -dec.irpp, solde(b, '44720000'));
    R.montant('à-nouveau 2027 · INPP et ONEM (4428)', -(dec.onem + q4), solde(b, '44280000'));
    R.montant('à-nouveau 2027 · résultat 2026 (perte au 13)', Math.round(ctx.resultat2026 * 100) / 100, solde(b, '13'));
    const reg = await c.lire('Registre des retenues 2027 à l’ouverture', `/retenues/registre?exerciceId=${n1}&dateReference=2027-01-02`);
    const nature = (cle) => (reg?.natures ?? []).find((x) => x.cle === cle) ?? null;
    R.montant('registre 2027 · IRPP · solde d’ouverture (décembre 2026)', dec.irpp, nature('irppSalaires')?.soldeOuverture);
    R.egal('registre 2027 · IRPP · ligne antérieure à l’échéance du 15/01/2027', echeanceIrpp('2026-12'), (nature('irppSalaires')?.mois ?? []).find((x) => x.anterieur)?.echeance?.slice(0, 10) ?? null);
    R.montant('registre 2027 · CNSS · solde d’ouverture', dec.cnss, nature('cnss')?.soldeOuverture);
    R.montant('registre 2027 · INPP et ONEM · solde d’ouverture', dec.onem + q4, nature('inppOnem')?.soldeOuverture);
    const ech = await c.lire('Échéancier au 20/01/2027', `/retenues/echeancier?exerciceId=${n1}&dateReference=2027-01-20`);
    const date = (cle) => (ech?.echeances ?? []).find((x) => x.cle === cle)?.date?.slice(0, 10) ?? null;
    // INPP du 4e trimestre le 31/01/2027 (dimanche), sans report (ordonnance n° 84/186) ; IRPP le 15/02/2027 (lundi).
    R.egal('échéancier au 20/01/2027 · [INPP, IRPP, CNSS, ONEM, déclaration ONEM]',
      ['2027-01-31', '2027-02-15', '2027-02-15', '2027-02-15', '2027-02-10'],
      [date('inppOnem-inpp'), date('irppSalaires'), date('cnss'), date('inppOnem-onem'), date('declarationMensuelleOnem')]);
  });

  for (let m = 1; m <= 3; m += 1) {
    const mois = `2027-${String(m).padStart(2, '0')}`;
    const prec = m === 1 ? '2026-12' : `2027-${String(m - 1).padStart(2, '0')}`;
    await etape(R, `SARL · paie de ${mois}`, async () => {
      await reverserCnssOnem(n1, prec, `${mois}-14`);
      if (mois === '2027-01') await reverserInpp(n1, '2027-01-29', ['2026-10', '2026-11', '2026-12']);
      if (mois === '2027-02') {
        // L'IRPP de décembre n'a pas été reversé le 15 janvier · le 12
        // février, décembre et la moitié de janvier · l'antérieur d'abord.
        ctx.moitieJanvier = Math.round(parMois.get('2027-01').irpp / 2);
        await reverserIrpp(n1, '2027-02-12', parMois.get('2026-12').irpp + ctx.moitieJanvier, 'décembre 2026 et moitié de janvier');
      }
      if (mois === '2027-03') await reverserIrpp(n1, '2027-03-12', parMois.get('2027-01').irpp - ctx.moitieJanvier + parMois.get('2027-02').irpp, 'reste de janvier et février');
      if (mois === '2027-01') {
        // Sans date de mise à disposition, le cours est celui du jour du
        // calcul (15/02/2028), qui n'est pas coté · refus nommé (décision T8).
        await refusAttendu(c, R, 'Bulletin en dollars de janvier 2027 sans date de mise à disposition', 'POST', `/personnel/salaries/${ctx.sal.E2?.id}/bulletins`, {
          moisDePaie: mois, deviseStipulation: 'USD', ...PRIVE, elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantUsd: 1_250 }],
        });
      }
      const actifs = [];
      for (const cle of Object.keys(ctx.sal)) {
        const x = await emettre(cle, mois, { smig: SMIG_CABINET_2027 });
        if (x) actifs.push(x);
      }
      if (mois === '2027-01') {
        const b = ctx.att['E5-2027-01']?.b;
        // Plancher CNSS au SMIG du cabinet · 24 000 × 13 = 312 000 > 299 000 versés.
        R.montant('2027-01 · TSHIBANDA · base CNSS relevée au plancher du barème du cabinet', 312_000, b?.calcul?.cotisations?.plancherCnss?.baseFc);
      }
      await passerLeMois(n1, mois, actifs);
    });
  }

  await etape(R, 'SARL · 2027 · registre au 31/03 et prêt soldé', async () => {
    const reg = await c.lire('Registre des retenues au 31/03/2027', `/retenues/registre?exerciceId=${n1}&dateReference=2027-03-31`);
    const nature = (cle) => (reg?.natures ?? []).find((x) => x.cle === cle) ?? null;
    const restant = (cle, part = null) => (nature(cle)?.mois ?? []).filter((x) => (part ? x.part === part : true) && Math.abs(x.solde) > 0.005).map((x) => (x.anterieur && x.mois === 'ANTERIEUR' ? 'ANTERIEUR' : x.mois)).sort();
    R.egal('registre 2027 · IRPP · seul mars reste dû (antérieur et janvier éteints dans l’ordre)', ['2027-03'], restant('irppSalaires'));
    R.egal('registre 2027 · CNSS · seul mars reste dû', ['2027-03'], restant('cnss'));
    R.egal('registre 2027 · ONEM · seul mars reste dû', ['2027-03'], restant('inppOnem', 'ONEM'));
    R.egal('registre 2027 · INPP · le premier trimestre reste dû (échéance du 30/04)', ['2027-01', '2027-02', '2027-03'], restant('inppOnem', 'INPP'));
    const mar = parMois.get('2027-03');
    R.montant('registre 2027 · IRPP dû au 31/03', mar.irpp, nature('irppSalaires')?.solde);
    R.montant('registre 2027 · CNSS due au 31/03', mar.cnss, nature('cnss')?.solde);
    const av = await c.lire('Registre des avances', '/personnel/avances');
    R.montant('prêt de MBUYI soldé au 31/03/2027 (douze retenues)', 0, (av?.avances ?? []).find((x) => x.id === ctx.pret?.id)?.soldeFc);
    const b = await balance(c, n1);
    R.montant('balance 2027 · prêt au personnel 2728 soldé', 0, solde(b, '27280000'));
    R.montant('balance 2027 · 422 soldé (nets payés)', 0, solde(b, '42200000'));
  });

  await etape(R, 'SARL · l’accord-cadre est fermé au SYSCOHADA', async () => {
    await refusAttendu(c, R, 'Accord-cadre lu sur un dossier SYSCOHADA (loi n° 004/2001)', 'GET', '/accord-cadre', undefined, [400, 403]);
  });
}

// ==============================================================================
// 2. ONG DE DROIT ÉTRANGER, ET ONG CONGOLAISE
// ==============================================================================

async function ongEtrangere(R) {
  R.scenario = 'paie-avancee';
  const c = await nouveauDossier(R, 'Passe paie avancée · Santé Sans Frontières RDC', {
    cle: 'paie-ong', referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', exercice: ['2026-01-01', '2026-12-31'],
  });
  const ctx = {};

  await etape(R, 'ONG étrangère · forme, identité, registre du personnel', async () => {
    await c.geste('Forme juridique · ONG de droit étranger', 'PATCH', '/dossier/forme-juridique', { formeJuridique: 'ORGANISATION_NON_GOUVERNEMENTALE', droitEtranger: true });
    await c.geste('Identité légale', 'PATCH', '/dossier/identite', {
      actePersonnaliteJuridique: 'Décret n° 18/045 du 12 mars 2018 autorisant l’association à exercer en RDC', numeroEnregistrementSecteur: 'MIN-SANTE/ENR/2017/112',
    });
    await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    // Dix salariés · sept congolais, trois expatriés · 70 % de main-d'œuvre locale.
    const fiches = [
      ...['MUHINDO', 'KAVIRA', 'PALUKU', 'MASIKA', 'KAMBALE', 'KAHINDO', 'SIVYA'].map((nom) => [nom, 'congolaise']),
      ['DUPONT', 'belge'], ['MARTIN', 'française'], ['TREMBLAY', 'canadienne'],
    ];
    for (const [i, [nom, nationalite]] of fiches.entries()) {
      const s = await c.geste(`Salarié ${nom}`, 'POST', '/personnel/salaries', { nom, sexe: i % 2 ? 'FEMININ' : 'MASCULIN', nationalite });
      if (s) await c.geste(`Contrat ${nom}`, 'POST', `/personnel/salaries/${s.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2025-01-01', natureTravail: 'Agent de santé', classeProfessionnelle: 5, periodiciteRemuneration: 'MOIS', remunerationBase: 1_200_000, deviseRemuneration: 'CDF' });
    }
  });

  await etape(R, 'ONG étrangère · accord-cadre avec le Ministère du Plan', async () => {
    const e0 = await c.lire('Accord-cadre (avant enregistrement)', '/accord-cadre?dateReference=2028-02-15');
    R.egal('accord-cadre · applicable à l’ONG de droit étranger (art. 37)', true, e0?.applicable ?? null);
    // Art. 37, 4° · « à concurrence de 60 % au minimum ».
    R.montant('accord-cadre · part minimale de main-d’œuvre locale', 60, e0?.partMinimaleMainOeuvreLocale);
    // Le registre PROPOSE · 7 nationaux sur 10.
    R.egal('accord-cadre · main-d’œuvre proposée par le registre [part, effectif, nationaux]', [70, 10, 7],
      [e0?.propositionMainOeuvre?.part ?? null, e0?.propositionMainOeuvre?.effectif ?? null, e0?.propositionMainOeuvre?.nationaux ?? null]);
    // La loi ne fixe aucune durée · les dix ans et six mois viennent du MODÈLE Kahasha (art. IX).
    R.egal('accord-cadre · modèle Kahasha proposé [durée, préavis]', [10, 6], [e0?.modele?.dureeAnnees ?? null, e0?.modele?.preavisMois ?? null]);
    await refusAttendu(c, R, 'Accord-cadre sans durée (zéro an)', 'POST', '/accord-cadre', { reference: 'AC/PLAN/SSF/2017/045', dateSignature: '2017-03-15', dureeAnnees: 0 });
    ctx.accord = await c.geste('Accord-cadre signé le 15/03/2017, cinq ans, tacite reconduction, préavis de six mois', 'POST', '/accord-cadre', {
      reference: 'AC/PLAN/SSF/2017/045', dateSignature: '2017-03-15', dureeAnnees: 5, taciteReconduction: true, preavisMois: 6,
      representationRdc: 'Bureau de liaison de Goma', attestationsBonneConduiteLe: '2017-02-10',
    });
    // Périodes de cinq ans comptées de la signature · 2017→2022→2027→2032.
    // Au 15/02/2028 · période 2027-2032, dernier jour pour dénoncer = fin − 6 mois.
    const e1 = await c.lire('Accord-cadre au 15/02/2028', '/accord-cadre?dateReference=2028-02-15');
    const et1 = e1?.accords?.[0]?.etat ?? null;
    R.egal('accord-cadre au 15/02/2028 · [fin de période, période écoulée, tacite reconduction, dernier jour pour dénoncer]',
      ['2032-03-15', false, true, '2031-09-15'],
      [et1?.finDePeriode?.slice(0, 10) ?? null, et1?.periodeEcoulee ?? null, et1?.enTaciteReconduction ?? null, et1?.dernierJourPourDenoncer?.slice(0, 10) ?? null]);
    const e2 = await c.lire('Accord-cadre au 31/12/2026', '/accord-cadre?dateReference=2026-12-31');
    const et2 = e2?.accords?.[0]?.etat ?? null;
    R.egal('accord-cadre au 31/12/2026 · [fin de période, dernier jour pour dénoncer]', ['2027-03-15', '2026-09-15'],
      [et2?.finDePeriode?.slice(0, 10) ?? null, et2?.dernierJourPourDenoncer?.slice(0, 10) ?? null]);
    if (ctx.accord) {
      await refusAttendu(c, R, 'Part de main-d’œuvre déclarée sans source', 'PATCH', `/accord-cadre/${ctx.accord.id}/main-oeuvre`, { part: 70, source: '  ', date: '2028-02-15' });
      const d = await c.geste('Part de main-d’œuvre locale déclarée (70 %)', 'PATCH', `/accord-cadre/${ctx.accord.id}/main-oeuvre`, { part: 70, source: 'Registre du personnel et états de paie au 15/02/2028', date: '2028-02-15' });
      R.montant('accord-cadre · part de main-d’œuvre locale déclarée', 70, d?.partMainOeuvreLocale);
    }
    // Une nationalité manque · la part n'est plus proposée (un registre incomplet ne fait pas un pourcentage).
    const s = await c.geste('Salarié sans nationalité au registre', 'POST', '/personnel/salaries', { nom: 'BAHATI', sexe: 'FEMININ' });
    if (s) await c.geste('Contrat BAHATI', 'POST', `/personnel/salaries/${s.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01', natureTravail: 'Chauffeur', classeProfessionnelle: 3, periodiciteRemuneration: 'MOIS', remunerationBase: 800_000, deviseRemuneration: 'CDF' });
    const e3 = await c.lire('Accord-cadre après l’ajout', '/accord-cadre?dateReference=2028-02-15');
    R.egal('accord-cadre · part non proposée quand une nationalité manque [part, effectif]', [null, 11], [e3?.propositionMainOeuvre?.part ?? 'absente', e3?.propositionMainOeuvre?.effectif ?? null]);
  });

  await etape(R, 'ONG étrangère · checklist de constitution', async () => {
    const k = await c.lire('Parcours de constitution', '/constitution');
    // Art. 31 (avis et enregistrement au secteur), art. 30 (décret
    // d'autorisation, pièces de l'art. 4 par le renvoi de l'art. 31 al. 3),
    // note circulaire n° 003/2013 section A (Plan), art. 37 (ONG étrangère).
    R.egal('constitution · étapes de l’ONG étrangère', ['avis-enregistrement-secteur', 'personnalite-juridique', 'enregistrement-plan', 'conditions-ong-etrangere'], (k?.etapes ?? []).map((e) => e.cle));
    // LOI · cinq pièces de l'art. 4 a) à e) + l'acte du point A.3 ; PRATIQUE ·
    // points A.1, A.2, A.5 à A.10 ; USAGE · point A.4 (reconnaissance provinciale).
    R.egal('constitution · pièces par fondement', { LOI: 6, PRATIQUE_ADMINISTRATIVE: 8, USAGE_SANS_BASE_LEGALE: 1 }, k?.parFondement ?? null);
    const etape_ = (cle) => (k?.etapes ?? []).find((e) => e.cle === cle) ?? null;
    R.egal('constitution · produit de l’autorisation (décret, renseigné)', ['Décret d’autorisation', true], [etape_('personnalite-juridique')?.produitDetenu?.champ ?? null, etape_('personnalite-juridique')?.produitDetenu?.renseigne ?? null]);
    R.egal('constitution · certificat du Plan non renseigné', false, etape_('enregistrement-plan')?.produitDetenu?.renseigne ?? null);
    R.egal('constitution · conditions de l’art. 37 renvoyées à l’accord-cadre', 'Tenu dans la fenêtre Accord-cadre', etape_('conditions-ong-etrangere')?.motifSansProduit ?? null);
  });

  await etape(R, 'ONG étrangère · exonérations (arrêté interministériel)', async () => {
    const ref = await c.lire('Référentiel des exonérations', '/exonerations/referentiel');
    const modele = (type) => (ref?.modeles ?? []).find((m) => m.type === type) ?? null;
    // Note circulaire n° 003/2013, section B · I (13 pièces, dont pharmacie et
    // accord-cadre conditionnels), II (11, dont rapport annuel et accord-cadre
    // conditionnels), III (4).
    R.egal('exonérations · nombre de pièces [ponctuel, prévisionnel, renouvellement]', [13, 11, 4], ['PONCTUEL', 'PREVISIONNEL', 'RENOUVELLEMENT'].map((t) => modele(t)?.pieces?.length ?? null));
    // Section B.II, mot pour mot · requête, statuts, personnalité juridique,
    // liste quantifiée, attestation de don ou factures, certificat
    // d'enregistrement, numéro impôt, avis du ministère du secteur, rapport
    // annuel, accord-cadre, rapport de la Commission ad hoc. Ni lettre de
    // transport ni projet d'utilisation (pièces B.I.6 et B.I.7 du seul ponctuel).
    const B2 = ['accordCadre', 'attestationDon', 'avisMinistereSectoriel', 'certificatEnregistrement', 'listeBiens', 'numeroImpot', 'personnaliteJuridique', 'rapportAnnuel', 'rapportCommissionAdHoc', 'requete', 'statuts'];
    R.egal('exonérations · pièces du prévisionnel = section B.II de la note circulaire', B2, (modele('PREVISIONNEL')?.pieces ?? []).map((p) => p.cle).sort());
    await refusAttendu(c, R, 'Arrêté ACCORDÉ sans référence ni date', 'POST', '/exonerations', { type: 'PREVISIONNEL', objet: 'Médicaments', statut: 'ACCORDE', dateDebutValidite: '2026-03-01' });
    const x = await c.geste('Arrêté prévisionnel accordé (pièces de la section B.II)', 'POST', '/exonerations', {
      type: 'PREVISIONNEL', objet: 'Médicaments et matériel médical 2026-2028', statut: 'ACCORDE', referenceArrete: 'AI n° 1234/CAB/MIN/PL/2026 et n° 567/CAB/MIN/FIN/2026',
      dateArrete: '2026-02-20', dateDebutValidite: '2026-03-01', piecesFournies: B2,
    });
    const p = await c.geste('Arrêté ponctuel en préparation (onze pièces, sans l’accord-cadre)', 'POST', '/exonerations', {
      type: 'PONCTUEL', objet: 'Matériel informatique du bureau de Goma', piecesFournies: ['requete', 'statuts', 'personnaliteJuridique', 'listeBiens', 'attestationDon', 'lettreTransport', 'projetUtilisation', 'certificatEnregistrement', 'numeroImpot', 'avisMinistereSectoriel', 'rapportAnnuel'],
    });
    const l = await c.lire('Registre des exonérations au 15/02/2028', '/exonerations?dateReference=2028-02-15');
    const lu = (id) => (l?.dossiers ?? []).find((d) => d.id === id) ?? null;
    const dx = lu(x?.id);
    // Deux ans (note circulaire, section B.III) · du 01/03/2026 au 01/03/2028 ; au 15/02/2028, 15 jours.
    R.egal('prévisionnel accordé · [fin de validité, jours restants, alerte]', ['2028-03-01', 15, 'A_RENOUVELER'],
      [dx?.dateFinValidite?.slice(0, 10) ?? null, dx?.joursAvantExpiration ?? null, dx?.alerte ?? null]);
    R.egal('prévisionnel accordé avec les pièces de la section B.II · complet, aucune pièce manquante', [true, []], [dx?.complet ?? null, dx?.piecesManquantes ?? null]);
    // Section B.I.13 · « l'accord-cadre [...] pour les ONG internationales » ·
    // le dossier se déclare ONG de droit étranger, la pièce lui est due.
    R.egal('ponctuel d’une ONG de droit étranger sans accord-cadre · incomplet', false, lu(p?.id)?.complet ?? null);
  });

  await etape(R, 'ONG étrangère · dénonciation de l’accord-cadre', async () => {
    if (!ctx.accord) return;
    await c.geste('Dénonciation reçue le 01/10/2026', 'PATCH', `/accord-cadre/${ctx.accord.id}/denonciation`, { denonceLe: '2026-10-01', motif: 'Fin du programme de santé du Nord-Kivu, retrait volontaire de l’ONG' });
    const e = await c.lire('Accord-cadre après dénonciation', '/accord-cadre?dateReference=2028-02-15');
    const et = e?.accords?.[0]?.etat ?? null;
    // La dénonciation arrête la reconduction · période en cours au 01/10/2026 ·
    // 2022-2027, dernier jour pour dénoncer le 15/09/2026 · parvenue après.
    R.egal('accord-cadre dénoncé · [fin de période, période écoulée, tacite reconduction, hors préavis]', ['2027-03-15', true, false, true],
      [et?.finDePeriode?.slice(0, 10) ?? null, et?.periodeEcoulee ?? null, et?.enTaciteReconduction ?? null, et?.denonciationHorsPreavis ?? null]);
  });
}

async function ongCongolaise(R) {
  R.scenario = 'paie-avancee';
  const c = await nouveauDossier(R, 'Passe paie avancée · Action Paysanne du Kwilu', {
    cle: 'paie-ongcd', referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', exercice: ['2026-01-01', '2026-12-31'],
  });
  await etape(R, 'ONG congolaise · l’accord-cadre ne la concerne pas', async () => {
    await c.geste('Forme juridique · ONG de droit congolais', 'PATCH', '/dossier/forme-juridique', { formeJuridique: 'ORGANISATION_NON_GOUVERNEMENTALE', droitEtranger: false });
    const e = await c.lire('Accord-cadre', '/accord-cadre');
    // Art. 37 · sous-section II, organisations ÉTRANGÈRES seulement.
    R.egal('ONG congolaise · accord-cadre [applicable, accords, proposition]', [false, [], null], [e?.applicable ?? null, e?.accords ?? null, e?.propositionMainOeuvre ?? 'absente']);
    await refusAttendu(c, R, 'Accord-cadre enregistré pour une ONG de droit congolais', 'POST', '/accord-cadre', { reference: 'AC/PLAN/APK/2020/001', dateSignature: '2020-05-01', dureeAnnees: 10 });
    const k = await c.lire('Parcours de constitution', '/constitution');
    // Art. 3 et 4 (avis du ministère, personnalité juridique), note circulaire A.
    R.egal('ONG congolaise · étapes (sans les conditions de l’art. 37)', ['avis-tutelle', 'personnalite-juridique', 'enregistrement-plan'], (k?.etapes ?? []).map((x) => x.cle));
    // LOI · demande écrite (art. 3 et 4) + cinq pièces de l'art. 4 + acte du point A.3.
    R.egal('ONG congolaise · pièces par fondement', { LOI: 7, PRATIQUE_ADMINISTRATIVE: 8, USAGE_SANS_BASE_LEGALE: 1 }, k?.parFondement ?? null);
  });
}

export default async function (R) {
  await sarl(R);
  await ongEtrangere(R);
  await ongCongolaise(R);
}

// Les outils non employés hors de ce fichier restent importés pour une relecture à la main.
void rechargerComptes;
