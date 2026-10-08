/**
 * SCÉNARIO « PAIE, LE COMPLÉMENT » · ce que le lot de la paie avancée n'a pas
 * joué, sur 2026, 2027 et l'ouverture de 2028, clôtures comprises, sur une base
 * PostgreSQL jetable, par l'API du serveur compilé.
 *
 *  A. SARL SYSCOHADA privée (« Ateliers de la Gombe », fictive) ·
 *     saisie-arrêt notifiée et quotité de l'art. 114 (un cinquième, un tiers,
 *     deux cinquièmes), cession en la forme de l'AUPSRVE (non tenue, dite),
 *     décomptes finals du terme d'un CDD, d'une démission, d'une faute
 *     lourde, d'une force majeure et d'un délégué syndical (le double, trois
 *     mois de date à date, un férié du dimanche dans le délai), réduction du
 *     taux INPP déclarée avec son acte, majoration des risques
 *     professionnels, employeur sans nature, régimes libératoires de
 *     l'art. 121, registre des retenues de 2027 entier, clôtures de 2026 et
 *     2027, ouverture de 2028 depuis le report, reversements tardifs dits,
 *     INPP du quatrième trimestre au 31 janvier 2028, rôle de gestionnaire de
 *     paie (ce qui lui est ouvert, ce qui lui est refusé).
 *  B. Régie publique SYSCOHADA (fictive) · employeur PUBLIC (taux unique),
 *     allocations familiales légales (enfants à charge et bénéficiaires,
 *     colonne 19 du décret n° 25/22, les deux débiteurs), passation refusée
 *     faute de compte, décompte final qui les porte.
 *  C. Association SYCEBNL · paie d'une année, retraite obligatoire au
 *     43210000 (jamais 432 ni 4313), clôture, à-nouveau et registre de 2027.
 *
 * CHAQUE MONTANT ATTENDU EST CALCULÉ ICI DEPUIS LES TEXTES (`attendu`,
 * `irppDuMois`, `quotite`), jamais recopié de ce que le serveur rend. Textes
 * lus · décret n° 18/041, art. 2 à 5 et 8 (CNSS, majoration des risques
 * professionnels au double au plus) ; arrêté n° 140/2018, art. 22 et 24
 * (majoration de 50 %, de 100 % en récidive) ; arrêté interministériel
 * n° 002/CAB/MET/2025, art. 1er (INPP · public 4 %, privé 3,5 / 3 / 2 % par
 * tranche d'effectif) ; ordonnance n° 84/186, art. 1er, al. 2 (réduction du
 * taux, « le quart » au plus) et art. 3 (versement trimestriel) ; arrêté
 * n° 028/2025 (ONEM 0,5 %, le 15) ; loi n° 23/053, art. 68 à 71, 118, 119,
 * 121 (régime libératoire), 123 à 125 et 150 ; décret n° 25/22, art. 2, 4 à 7
 * et annexe 2 (taux par classe, colonne 19 · 796,30 FC, colonne 20 · 159,26
 * FC, vingt-six jours) ; Code du travail, art. 7 point 8, 60 c), 63 à 67, 69,
 * 72, 93, 114, 141, 142, 144, 258 ; ordonnance n° 23-042, art. 1er et 2
 * (fériés, congé du férié du dimanche reporté au samedi) ; AUPSRVE, art. 177,
 * 184 à 189, 201, 205 à 212 ; loi n° 004/2003, art. 18 et 110 bis.
 *
 * DEUX CONVENTIONS D'OMEGAX, déclarées par le logiciel et reprises telles · la
 * mensualisation de l'IRPP et la règle du mois entamé du préavis (1/26 du
 * salaire mensuel par jour payable, décision par la loi du 2026-10-07).
 */
import { Client, balance, cloturer, ecriture, etape, nouveauDossier, solde, validerJusqua } from './lib.mjs';

const SCENARIO = 'paie-complement';
const BQ = '52110000';

// --- Le calcul attendu, depuis les textes -----------------------------------

/** Décret n° 18/041, art. 2 à 4 · 6,5 % familles, 5 % + 5 % pensions, 1,5 % risques professionnels. */
const TAUX_CNSS = { pf: 6.5, pe: 5, pt: 5, rp: 1.5 };
/** Arrêté n° 028/2025, art. 1er · ONEM 0,5 %. */
const TAUX_ONEM = 0.5;
/** Arrêté interministériel n° 002/CAB/MET/2025, art. 1er · privé de 1 à 50 travailleurs. */
const TAUX_INPP_PRIVE = 3.5;
/** Même arrêté · employeur public, un seul taux, aucune tranche d'effectif. */
const TAUX_INPP_PUBLIC = 4;
/** Décret n° 25/22, art. 2 et annexe 2 · taux journalier du manœuvre ordinaire depuis janvier 2026. */
const SMIG_2026 = 21_500;
/** Décret n° 25/22, annexe 2 · taux journalier par classe (tension × 21 500 / 100). */
const TAUX_CLASSE = { 1: 21_500, 2: 24_940, 3: 28_595, 4: 33_110, 5: 38_270, 6: 44_290, 7: 50_955 };
/** Décret n° 25/22, art. 5 et annexe 2 · colonne 19, allocation familiale par jour et par enfant. */
const COLONNE_19 = 796.3;
/** Décret n° 25/22, art. 6 et annexe 2 · colonne 20, contre-valeur du logement (1/5 de la colonne 19). */
const COLONNE_20 = 159.26;
/** Décret n° 25/22, art. 7 · vingt-six jours par mois. */
const JOURS_MOIS = 26;

/** Loi n° 23/053, art. 150 · la décimale, puis la tranche de 50 FC à la centaine. */
function arrondiArticle150(x) {
  const unite = Math.round(x);
  const reste = unite % 100;
  return reste >= 50 ? unite - reste + 100 : unite - reste;
}

/** Loi n° 23/053, art. 118 · le barème annuel, quatre tranches. */
const TRANCHES_118 = [[0, 1_944_000, 3], [1_944_000, 21_600_000, 15], [21_600_000, 43_200_000, 30], [43_200_000, Infinity, 40]];
const bareme118 = (revenu) => TRANCHES_118.reduce((s, [de, a, t]) => s + (revenu > de ? ((Math.min(revenu, a) - de) * t) / 100 : 0), 0);

/**
 * Loi n° 23/053, art. 118 (barème sur le revenu arrondi au millier inférieur,
 * plafond de 30 %), art. 123 (2 % par personne à charge, neuf au plus, sur
 * l'impôt des trois premières tranches seulement) et art. 119 (retenue
 * mensuelle, dans la convention de mensualisation que le logiciel déclare).
 */
function irppDuMois(netFiscalMensuel, personnesACharge = 0) {
  const annuel = Math.floor((netFiscalMensuel * 12) / 1000) * 1000;
  let impot = Math.min(bareme118(annuel), annuel * 0.3);
  if (personnesACharge > 0) impot -= (2 * Math.min(personnesACharge, 9) * bareme118(Math.min(annuel, 43_200_000))) / 100;
  return arrondiArticle150(impot / 12);
}

/** Les natures de la rémunération de l'art. 7, point 8 du Code du travail que le banc emploie · elles font l'assiette sociale. */
const NATURES_ASSIETTE = new Set([
  'SALAIRE_OU_TRAITEMENT', 'PRIME', 'INDEMNITE_DE_FIN_DE_CONTRAT', 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE',
]);
/** Compte de charge de chaque nature · fiche du compte 66, mêmes numéros aux deux plans (P3). */
const COMPTE_NATURE = {
  SALAIRE_OU_TRAITEMENT: '66110000',
  PRIME: '66120000',
  ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE: '66130000',
  INDEMNITE_DE_FIN_DE_CONTRAT: '66140000',
};

/**
 * LE BULLETIN ATTENDU · cotisations sur l'assiette sociale (les allocations
 * familiales légales en sont exclues, art. 7, point 8), IRPP sur le brut
 * fiscal (art. 68), l'allocation familiale n'y entrant que pour l'excédent du
 * taux légal (art. 69, 1 · colonne 19 × enfants bénéficiaires × jours), net
 * de la quote-part ouvrière (art. 71) ; net = versé − quote-part − IRPP −
 * retenue du registre des avances (art. 112).
 */
function attendu({ elements, tauxInpp = TAUX_INPP_PRIVE, tauxRp = TAUX_CNSS.rp, personnesACharge = 0, tauxLegalAf = null, retenue = 0, compteRetenue = null }) {
  const somme = (f) => elements.filter(f).reduce((s, e) => s + e.montantFc, 0);
  const assiette = somme((e) => NATURES_ASSIETTE.has(e.nature));
  const af = somme((e) => e.nature === 'ALLOCATIONS_FAMILIALES_LEGALES');
  const afImposable = af > 0 ? Math.max(0, af - (tauxLegalAf ?? 0)) : 0;
  const brutFiscal = somme((e) => e.nature !== 'ALLOCATIONS_FAMILIALES_LEGALES') + afImposable;
  const totalVerse = somme(() => true);
  const pct = (t) => (assiette * t) / 100;
  const pf = pct(TAUX_CNSS.pf);
  const pe = pct(TAUX_CNSS.pe);
  const pt = pct(TAUX_CNSS.pt);
  const rp = pct(tauxRp);
  const inpp = pct(tauxInpp);
  const onem = pct(TAUX_ONEM);
  const irpp = irppDuMois(brutFiscal - pt, personnesACharge);
  return { elements, assiette, af, afImposable, totalVerse, pf, pe, pt, rp, inpp, onem, irpp, retenue, compteRetenue, net: totalVerse - pt - irpp - retenue };
}

/**
 * Le livre attendu · les mouvements par compte que les écritures doivent
 * porter. `pension` est LE compte qui diverge entre les deux plans (P3) ·
 * 43130000 au SYSCOHADA, 43210000 au SYCEBNL.
 */
class LivreAttendu {
  constructor(pension = '43130000') { this.m = new Map(); this.pension = pension; }
  add(compte, d, c) {
    const x = this.m.get(compte) ?? { d: 0, c: 0 };
    x.d += d; x.c += c;
    this.m.set(compte, x);
  }
  solde(compte) { const x = this.m.get(compte); return x ? Math.round((x.d - x.c) * 100) / 100 : 0; }
  /** P3 · trois temps, puis les impôts et taxes sur salaires, et la retenue du registre des avances (D 422 / C 42 ou 27). */
  passer(b) {
    for (const e of b.elements) this.add(COMPTE_NATURE[e.nature], e.montantFc, 0);
    this.add('42200000', b.pt + b.irpp + b.retenue, b.totalVerse);
    this.add('43110000', 0, b.pf);
    this.add('43120000', 0, b.rp);
    this.add(this.pension, 0, b.pe + b.pt);
    this.add('66410000', b.pf + b.pe + b.rp, 0);
    this.add('44720000', 0, b.irpp);
    this.add('64150000', b.inpp, 0);
    this.add('64130000', b.onem, 0);
    this.add('44280000', 0, b.inpp + b.onem);
    if (b.retenue) this.add(b.compteRetenue, 0, b.retenue);
  }
  /** L'à-nouveau · les comptes de bilan (classes 1 à 5) passent à l'exercice suivant, la gestion repart de zéro. */
  reporter() {
    const n = new LivreAttendu(this.pension);
    for (const [compte] of this.m) {
      if (!/^[1-5]/.test(compte)) continue;
      const s = this.solde(compte);
      if (Math.abs(s) > 0.004) n.add(compte, s > 0 ? s : 0, s < 0 ? -s : 0);
    }
    return n;
  }
}

/**
 * ARTICLE 114 DU CODE DU TRAVAIL · base = rémunération − retenues fiscales et
 * sociales − évaluation forfaitaire du logement fourni en nature (al. 4 ;
 * arrêté n° 12/CAB.MIN/TPS/110/2005, art. 10 · un cinquième de la colonne 19,
 * soit la colonne 20, par jour, × 26) ; un cinquième jusqu'à cinq fois le
 * minimum mensuel de la classe, un tiers au-delà (al. 1er) ; deux cinquièmes
 * de la base pour une obligation alimentaire (al. 2), cumulables (al. 3).
 */
function quotite({ remuneration, impot, qpo, classe, logementEnNature = false }) {
  const logement = logementEnNature ? COLONNE_20 * JOURS_MOIS : 0;
  const base = remuneration - impot - qpo - logement;
  const seuil = 5 * TAUX_CLASSE[classe] * JOURS_MOIS;
  const ordinaire = Math.min(base, seuil) / 5 + Math.max(0, base - seuil) / 3;
  return { logement, base, seuil, ordinaire, alimentaire: (base * 2) / 5 };
}

// --- Le calendrier ------------------------------------------------------------

const iso = (d) => d.toISOString().slice(0, 10);
const jourUtc = (s) => new Date(`${s}T00:00:00.000Z`);
const finDeMois = (mois) => iso(new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0)));
const moisSuivant = (mois) => iso(new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 1))).slice(0, 7);
const moisDe = (annee, m) => `${annee}-${String(m).padStart(2, '0')}`;
/** Ordonnance n° 23-042, art. 1er · dix jours fériés à date fixe. */
const FERIES = ['01-01', '01-04', '01-16', '01-17', '04-06', '05-01', '05-17', '06-30', '08-01', '12-25'];
/**
 * LE JOUR OUVRABLE FISCAL · l'IRPP se verse au guichet, ouvert du lundi au
 * vendredi (décret n° 24/09, art. 1er), hors fériés ; l'échéance non ouvrable
 * se reporte au premier jour ouvrable qui suit (loi n° 004/2003, art. 110 bis).
 */
function premierJourOuvrableFiscal(s) {
  let d = jourUtc(s);
  for (;;) {
    const j = d.getUTCDay();
    if (j !== 0 && j !== 6 && !FERIES.includes(iso(d).slice(5))) return iso(d);
    d = new Date(d.getTime() + 86_400_000);
  }
}
/** IRPP · le 15 du mois suivant (loi n° 004/2003, art. 18), reporté (art. 110 bis). */
const echeanceIrpp = (mois) => premierJourOuvrableFiscal(`${moisSuivant(mois)}-15`);
/** CNSS · dans les quinze jours suivant le mois civil (arrêté n° 138/2018, art. 2), aucun report lu. */
const echeanceCnss = (mois) => `${moisSuivant(mois)}-15`;
/** ONEM · le 15 du mois suivant (arrêté n° 028/2025, art. 3), aucun report lu. */
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
async function refusAttendu(c, R, libelle, methode, chemin, corps, statuts = [400], motif = null) {
  const r = await c.req(methode, chemin, corps);
  const ok = statuts.includes(r.statut);
  R.egal(`${libelle} · refusé (${statuts.join(' ou ')})`, true, ok);
  if (!ok) R.note(`${libelle} · statut ${r.statut} · ${JSON.stringify(r.corps).slice(0, 400)}`);
  else if (motif) R.egal(`${libelle} · le refus nomme son motif (${motif})`, true, JSON.stringify(r.corps ?? '').includes(motif));
  return r;
}

const lu = (x) => (x === undefined ? 'absente' : x);
const nombre = (x) => (x === null || x === undefined ? null : Number(x));
const tuple = (b) => b && [nombre(b.totalVerseFc), nombre(b.assietteSocialeFc), nombre(b.cotisationsTravailleurFc), nombre(b.irppFc), nombre(b.netAPayerFc)];
const tupleAttendu = (a) => [a.totalVerse, a.assiette, a.pt, a.irpp, a.net].map((x) => Math.round(x * 100) / 100);
const ligneCot = (calcul, cle) => (calcul?.cotisations?.lignes ?? []).find((l) => l.cle === cle) ?? null;
const rubrique = (calc, cle) => calc?.rubriques?.find((r) => r.cle === cle) ?? null;
const salaire = (montantFc, libelle = 'Salaire de base') => ({ nature: 'SALAIRE_OU_TRAITEMENT', libelle, montantFc });
const r2 = (x) => Math.round(x * 100) / 100;

/** Les retenues attendues d'un mois de paie, par nature, pour le registre. */
function cumulateur() {
  const parMois = new Map();
  return {
    parMois,
    ajouter(mois, a) {
      const x = parMois.get(mois) ?? { irpp: 0, cnss: 0, pf: 0, rp: 0, pension: 0, inpp: 0, onem: 0, nets: 0, saisies: 0 };
      x.irpp += a.irpp; x.cnss += a.pf + a.pe + a.pt + a.rp; x.pf += a.pf; x.rp += a.rp; x.pension += a.pe + a.pt;
      x.inpp += a.inpp; x.onem += a.onem; x.nets += a.net; x.saisies += a.compteRetenue === '42320000' ? a.retenue : 0;
      parMois.set(mois, x);
    },
    get(mois) { return parMois.get(mois) ?? { irpp: 0, cnss: 0, pf: 0, rp: 0, pension: 0, inpp: 0, onem: 0, nets: 0, saisies: 0 }; },
  };
}

/** La nature d'un registre des retenues, et ses lignes (part INPP, ONEM, ou toutes). */
const natureDu = (reg, cle) => (reg?.natures ?? []).find((x) => x.cle === cle) ?? null;
const lignesDe = (nat, part = null, anterieur = false) => (nat?.mois ?? []).filter((x) => (part ? x.part === part : true) && Boolean(x.anterieur) === anterieur);

// ==============================================================================
// A. SARL · ATELIERS DE LA GOMBE
// ==============================================================================

/**
 * LE PERSONNEL DE LA SARL · classes et rémunérations au-dessus du minimum de la
 * classe (décret n° 25/22, art. 4 et 7, annexe 2 · taux journalier × 26) ·
 * classe 1 · 559 000 ; 2 · 648 440 ; 3 · 743 470 ; 4 · 860 860 ; 6 · 1 151 540.
 * `de` et `a` bornent les mois d'un bulletin ORDINAIRE (le mois du décompte
 * final en est exclu · il le remplace).
 */
const PERSONNEL_SARL = {
  E1: { nom: 'MWANZA', sexe: 'MASCULIN', de: '2026-01', a: '2028-01', mensuel: 1_200_000, contrat: { dateEntreeEnVigueur: '2022-01-03', natureTravail: 'Mécanicien d’atelier', classeProfessionnelle: 4 } },
  E2: { nom: 'LUKUSA', sexe: 'FEMININ', de: '2026-01', a: '2026-07', mensuel: 1_040_000, contrat: { dateEntreeEnVigueur: '2022-06-01', natureTravail: 'Secrétaire de direction', classeProfessionnelle: 3 } },
  E3: { nom: 'NSIMBA', sexe: 'MASCULIN', de: '2026-01', a: '2026-09', mensuel: 780_000, contrat: { dateEntreeEnVigueur: '2020-03-01', natureTravail: 'Magasinier', classeProfessionnelle: 2 } },
  E4: { nom: 'KAZADI', sexe: 'MASCULIN', de: '2026-01', a: '2026-04', mensuel: 650_000, contrat: { type: 'DUREE_DETERMINEE', dateEntreeEnVigueur: '2025-12-01', dateFinPrevue: '2026-05-31', natureTravail: 'Aide-soudeur', classeProfessionnelle: 2 } },
  E5: { nom: 'BAHATI', sexe: 'FEMININ', de: '2026-01', a: '2026-09', mensuel: 1_820_000, contrat: { dateEntreeEnVigueur: '2024-01-15', natureTravail: 'Cheffe d’atelier', classeProfessionnelle: 6 } },
  E6: { nom: 'MUTOMBO', sexe: 'MASCULIN', de: '2026-01', a: '2027-06', mensuel: 1_300_000, contrat: { dateEntreeEnVigueur: '2024-02-01', natureTravail: 'Tourneur, délégué syndical', classeProfessionnelle: 6 } },
  E7: { nom: 'MBALA', sexe: 'MASCULIN', de: '2026-01', a: '2028-01', mensuel: 600_000, contrat: { dateEntreeEnVigueur: '2025-01-01', natureTravail: 'Manœuvre ordinaire', classeProfessionnelle: 1 } },
  E9: { nom: 'NGOMA', sexe: 'FEMININ', de: '2027-03', a: '2028-01', mensuel: 950_000, contrat: { dateEntreeEnVigueur: '2027-03-01', natureTravail: 'Comptable', classeProfessionnelle: 4 }, embaucheEn2027: true },
};

/** Les faits communs d'un décompte · zéro est une réponse, jamais une absence. */
const ZEROS = { moyenneMensuelleArticle66Fc: 0, moyenneMensuelleArticle142Fc: 0, avantagesPendantPreavisFc: 0, gratificationFc: 0, enfantsBeneficiairesAllocations: 0 };
/** Effectif déclaré au bulletin · sept travailleurs, tranche de 1 à 50 de l'arrêté INPP de 2025. */
const PRIVE = { natureEmployeurInpp: 'PRIVE', effectif: 7, regimeSalarial: 'BAREME_ARTICLE_118' };
/**
 * LA RÉDUCTION DU TAUX INPP POUR 2027 · ordonnance n° 84/186, art. 1er, al. 2 ·
 * « réduit […] au plus du quart » sur décision du ministère · 3,5 × 1/4 =
 * 0,875 point, le plafond exact · taux appliqué 2,625 %. L'acte est une
 * DONNÉE FICTIVE du banc, déclarée avec sa référence comme le veut le texte.
 */
const REDUCTION_2027 = {
  reductionTauxInppPoints: 0.875,
  referenceReductionInpp: 'Arrêté fictif du banc n° 12/CAB.MIN/ETPS/2027/004 du 4 janvier 2027 portant réduction du taux de la cotisation INPP',
};
/** LA MAJORATION DES RISQUES PROFESSIONNELS d'avril à juin 2027 · arrêté n° 140/2018, art. 22 (50 %), notifiée par la Caisse (donnée fictive). */
const MAJORATION_2027 = { majorationRisquesProfessionnelsPourCent: 50 };
const avecMajoration = (mois) => mois >= '2027-04' && mois <= '2027-06';
const paramsSarl = (mois) => ({ ...PRIVE, ...(mois.startsWith('2027') ? REDUCTION_2027 : {}), ...(avecMajoration(mois) ? MAJORATION_2027 : {}) });
const tauxInppSarl = (mois) => (mois.startsWith('2027') ? 2.625 : TAUX_INPP_PRIVE);
/** 1,5 × 1,5 = 2,25 % pendant la majoration (décret n° 18/041, art. 5 · le double au plus). */
const tauxRpSarl = (mois) => (avecMajoration(mois) ? 2.25 : TAUX_CNSS.rp);

/**
 * LA SAISIE-ARRÊT DE MWANZA · notifiée le 08/04/2026 (AUPSRVE, art. 184 ·
 * acte fictif), 1 200 000 FC, retenue de 150 000 FC d'avril à septembre puis
 * 100 000 FC en octobre · 1 000 000 retenus ; mainlevée le 31/10/2026 (art.
 * 201), le reste (200 000) payé directement par le débiteur au créancier.
 */
const retenueSaisie = (cle, mois) => (cle !== 'E1' ? 0 : mois >= '2026-04' && mois <= '2026-09' ? 150_000 : mois === '2026-10' ? 100_000 : 0);

async function sarl(R) {
  R.scenario = SCENARIO;
  const c = await nouveauDossier(R, 'Passe paie complément · Ateliers de la Gombe SARL', {
    cle: 'paie2-sarl', referentiel: 'SYSCOHADA', systeme: 'NORMAL', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  let L = new LivreAttendu('43130000');
  const banque = (montant) => L.add(BQ, montant > 0 ? montant : 0, montant < 0 ? -montant : 0);
  const cum = cumulateur();
  const ctx = { sal: {}, att: {} };

  await etape(R, 'SARL · dossier, module de paie, apport, registre du personnel', async () => {
    const m = await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    R.egal('SARL · module de paie activé', true, Boolean(m && JSON.stringify(m).includes('PAIE')));
    await ecriture(c, 'Apport en capital', n, '2026-01-01', 'Apport des associés', [[BQ, 300_000_000, 0], ['10130000', 0, 300_000_000]], { journal: bq });
    banque(300_000_000); L.add('10130000', 0, 300_000_000);
    for (const [cle, p] of Object.entries(PERSONNEL_SARL)) {
      if (p.embaucheEn2027) continue;
      await creerSalarie(cle, p);
    }
  });

  async function creerSalarie(cle, p) {
    const s = await c.geste(`Salarié ${p.nom}`, 'POST', '/personnel/salaries', { nom: p.nom, sexe: p.sexe, nationalite: 'congolaise', lieuNaissance: 'Kinshasa' });
    if (!s) return;
    const k = await c.geste(`Contrat ${p.nom}`, 'POST', `/personnel/salaries/${s.id}/contrats`, {
      type: 'DUREE_INDETERMINEE', lieuExecution: 'Kinshasa', periodiciteRemuneration: 'MOIS', remunerationBase: p.mensuel, deviseRemuneration: 'CDF', ...p.contrat,
    });
    ctx.sal[cle] = { id: s.id, nom: p.nom, contratId: k?.id ?? null };
  }

  /**
   * POINT 4 et 5 · L'EMPLOYEUR SANS NATURE ET LES RÉGIMES DE L'ART. 121, joués
   * sur MBALA avant son premier bulletin (simulations, puis émissions
   * refusées, qui ne créent rien). MBALA · 600 000 FC, quote-part 30 000 ;
   * 570 000 × 12 = 6 840 000 ; barème 58 320 + 4 896 000 × 15 % = 792 720 ;
   * / 12 = 66 060 → 66 100 (art. 150) ; net 503 900.
   */
  await etape(R, 'SARL · employeur sans nature, tranches INPP, régimes libératoires', async () => {
    const s = ctx.sal.E7;
    const el = [salaire(600_000)];
    const corps = { moisDePaie: '2026-01', elements: el, effectif: 7, regimeSalarial: 'BAREME_ARTICLE_118' };
    const sansNature = await c.geste('Simulation · employeur sans nature', 'POST', `/personnel/simulation?salarieId=${s?.id}`, corps);
    // L'abstention de l'INPP ne porte QUE sur l'INPP · CNSS, ONEM, impôt et net restent chiffrés (P2b).
    R.egal('employeur sans nature · lignes de cotisation chiffrées (sans INPP)',
      ['cnss-pension-employeur', 'cnss-pension-travailleur', 'cnss-pf', 'cnss-rp', 'onem'],
      (sansNature?.cotisations?.lignes ?? []).map((l) => l.cle).sort());
    R.egal('employeur sans nature · une seule abstention, nommée (INPP · la NATURE)', [true, 1],
      [Boolean((sansNature?.cotisations?.abstentions ?? [])[0]?.startsWith("INPP · le taux dépend d'abord de la NATURE")), (sansNature?.cotisations?.abstentions ?? []).length]);
    R.montant('employeur sans nature · ONEM chiffré (0,5 % de 600 000)', 3_000, ligneCot(sansNature, 'onem')?.montantFc);
    R.montant('employeur sans nature · net à payer chiffré', 503_900, sansNature?.net?.netAPayerFc);
    await refusAttendu(c, R, 'Bulletin de janvier de MBALA sans nature d’employeur', 'POST', `/personnel/salaries/${s?.id}/bulletins`, corps, [400], 'INPP');
    // Arrêté de 2025, art. 1er · privé 3,5 % (1 à 50), 3 % (51 à 300), 2 % (au-delà).
    for (const [effectif, taux] of [[120, 3], [400, 2]]) {
      const x = await c.geste(`Simulation · privé, effectif ${effectif}`, 'POST', `/personnel/simulation?salarieId=${s?.id}`, { ...corps, natureEmployeurInpp: 'PRIVE', effectif });
      R.montant(`INPP privé, effectif ${effectif} · taux`, taux, ligneCot(x, 'inpp')?.tauxPourCent);
    }
    // Loi n° 23/053, art. 121, al. 2 · forfait LIBÉRATOIRE (arrêté
    // n° 019/2025 · 24 et 36 dollars par an) · le cours de conversion est
    // renvoyé à une circulaire absente du corpus · OmegaX ne le chiffre pas.
    for (const regime of ['FORFAIT_PERSONNEL_DOMESTIQUE', 'FORFAIT_SALARIE_DE_MICRO_ENTREPRISE']) {
      const x = await c.geste(`Simulation · ${regime}`, 'POST', `/personnel/simulation?salarieId=${s?.id}`, { ...corps, ...PRIVE, regimeSalarial: regime });
      R.egal(`${regime} · [régime, déclaré, calculable, retenue, IRPP, net]`, [regime, true, false, null, null, null],
        [x?.regimeSalarial?.regime ?? null, x?.regimeSalarial?.declare ?? null, x?.regimeSalarial?.calculable ?? null, lu(x?.retenue), lu(x?.net?.irppFc), lu(x?.net?.netAPayerFc)]);
      R.egal(`${regime} · le motif dit le forfait libératoire et l'arrêté n° 019/2025`, [true, true],
        [/libératoire/i.test(x?.regimeSalarial?.motif ?? ''), Boolean(x?.regimeSalarial?.motif?.includes('019/CAB/MIN/FINANCES/2025'))]);
      R.montant(`${regime} · la CNSS reste chiffrée (quote-part 5 %)`, 30_000, x?.net?.quotePartOuvriereFc);
      await refusAttendu(c, R, `Bulletin de MBALA sous ${regime}`, 'POST', `/personnel/salaries/${s?.id}/bulletins`, { ...corps, ...PRIVE, regimeSalarial: regime }, [400], "Retenue de l'article 119 non chiffrée");
    }
    const nonDeclare = await c.geste('Simulation · régime non déclaré', 'POST', `/personnel/simulation?salarieId=${s?.id}`, { moisDePaie: '2026-01', elements: el, natureEmployeurInpp: 'PRIVE', effectif: 7 });
    R.egal('régime non déclaré · [régime retenu, déclaré, calculable]', ['BAREME_ARTICLE_118', false, true],
      [nonDeclare?.regimeSalarial?.regime ?? null, nonDeclare?.regimeSalarial?.declare ?? null, nonDeclare?.regimeSalarial?.calculable ?? null]);
    R.egal('régime non déclaré · la réserve le dit', true, Boolean(nonDeclare?.regimeSalarial?.motif?.startsWith('RÉGIME NON DÉCLARÉ')));
    R.montant('régime non déclaré · IRPP au barème de l’art. 118', 66_100, nonDeclare?.net?.irppFc);
  });

  /** Émet le bulletin ordinaire d'un salarié, le compare à l'attendu. */
  const emettre = async (cle, mois, client = c) => {
    const s = ctx.sal[cle];
    const p = PERSONNEL_SARL[cle];
    if (!s || !p || mois < p.de || mois > p.a) return null;
    const retenue = retenueSaisie(cle, mois);
    const el = [salaire(p.mensuel)];
    const corps = {
      moisDePaie: mois, ...paramsSarl(mois), elements: el,
      // La classe se déclare au bulletin pour chiffrer la quotité (P5) · sur les mois de la saisie.
      ...(retenue ? { retenuesAvances: [{ avanceId: ctx.saisie?.id, montantFc: retenue }], classeProfessionnelle: 4 } : {}),
    };
    const a = attendu({ elements: el, tauxInpp: tauxInppSarl(mois), tauxRp: tauxRpSarl(mois), retenue, compteRetenue: retenue ? '42320000' : null });
    const b = await client.geste(`Bulletin ${s.nom} ${mois}`, 'POST', `/personnel/salaries/${s.id}/bulletins`, corps);
    if (!b) return null;
    R.egal(`${mois} · bulletin ${s.nom} · [versé, assiette sociale, quote-part ouvrière, IRPP, net]`, tupleAttendu(a), tuple(b));
    ctx.att[`${cle}-${mois}`] = { a, b };
    return { a, b };
  };

  /** Passe la paie du mois, paie les nets, tient le livre attendu et valide. */
  const passerLeMois = async (exerciceId, mois, actifs) => {
    const p = await c.geste(`Passation de la paie ${mois}`, 'POST', `/personnel/paie-du-mois/${mois}/comptabilisation`, { exerciceId, journalId: od.id, date: finDeMois(mois) });
    let nets = 0;
    for (const x of actifs) { L.passer(x.a); cum.ajouter(mois, x.a); nets += x.a.net; }
    nets = r2(nets);
    if (p) {
      await ecriture(c, `Paiement des nets ${mois}`, exerciceId, finDeMois(mois), `Salaires nets ${mois}`, [['42200000', nets, 0], [BQ, 0, nets]], { journal: bq });
      L.add('42200000', nets, 0); banque(-nets);
    }
    await validerJusqua(c, exerciceId, finDeMois(mois));
    return p;
  };

  const reverserCnssOnem = async (exerciceId, mois, date) => {
    const x = cum.get(mois);
    if (!x.cnss) return;
    await ecriture(c, `Reversement CNSS ${mois}`, exerciceId, date, `Cotisations CNSS ${mois}`,
      [['43110000', r2(x.pf), 0], ['43120000', r2(x.rp), 0], ['43130000', r2(x.pension), 0], [BQ, 0, r2(x.cnss)]], { journal: bq });
    L.add('43110000', x.pf, 0); L.add('43120000', x.rp, 0); L.add('43130000', x.pension, 0); banque(-x.cnss);
    await ecriture(c, `Reversement ONEM ${mois}`, exerciceId, date, `Contribution ONEM ${mois}`, [['44280000', r2(x.onem), 0], [BQ, 0, r2(x.onem)]], { journal: bq });
    L.add('44280000', x.onem, 0); banque(-x.onem);
  };
  const reverserIrpp = async (exerciceId, date, montant, libelle) => {
    await ecriture(c, `Reversement IRPP · ${libelle}`, exerciceId, date, `IRPP ${libelle}`, [['44720000', r2(montant), 0], [BQ, 0, r2(montant)]], { journal: bq });
    L.add('44720000', montant, 0); banque(-montant);
  };
  const reverser4428 = async (exerciceId, date, montant, libelle) => {
    await ecriture(c, `Reversement · ${libelle}`, exerciceId, date, libelle, [['44280000', r2(montant), 0], [BQ, 0, r2(montant)]], { journal: bq });
    L.add('44280000', montant, 0); banque(-montant);
  };
  const inppDuTrimestre = (mois) => mois.reduce((s, m) => s + cum.get(m).inpp, 0);
  /** AUPSRVE, art. 188 · l'employeur verse chaque mois au greffe ce qu'il a retenu. */
  const verserAuGreffe = async (exerciceId, mois, date) => {
    const x = cum.get(mois).saisies;
    if (!x) return;
    await ecriture(c, `Versement au greffe · saisie de ${mois}`, exerciceId, date, `Saisie-arrêt MWANZA ${mois}`, [['42320000', x, 0], [BQ, 0, x]], { journal: bq });
    L.add('42320000', x, 0); banque(-x);
  };

  // --- 2026, mois par mois -----------------------------------------------------
  for (let m = 1; m <= 12; m += 1) {
    const mois = moisDe(2026, m);
    const prec = m > 1 ? moisDe(2026, m - 1) : null;
    await etape(R, `SARL · paie de ${mois}`, async () => {
      if (prec) {
        await reverserCnssOnem(n, prec, `${mois}-14`);
        await reverserIrpp(n, `${mois}-14`, cum.get(prec).irpp, prec);
        await verserAuGreffe(n, prec, `${mois}-10`);
      }
      if (mois === '2026-04') await reverser4428(n, '2026-04-30', inppDuTrimestre(['2026-01', '2026-02', '2026-03']), 'INPP du premier trimestre 2026');
      if (mois === '2026-07') await reverser4428(n, '2026-07-31', inppDuTrimestre(['2026-04', '2026-05', '2026-06']), 'INPP du deuxième trimestre 2026');
      if (mois === '2026-10') await reverser4428(n, '2026-10-30', inppDuTrimestre(['2026-07', '2026-08', '2026-09']), 'INPP du troisième trimestre 2026');
      if (mois === '2026-04') await saisieNotifiee();
      if (mois === '2026-11') await apresMainlevee();
      const actifs = [];
      for (const cle of Object.keys(ctx.sal)) {
        const x = await emettre(cle, mois);
        if (x) actifs.push(x);
      }
      if (mois === '2026-05') actifs.push(...(await decompteKazadi()));
      if (mois === '2026-08') actifs.push(...(await decompteLukusa()));
      if (mois === '2026-10') actifs.push(...(await decompteNsimba()));
      if (mois === '2026-12') actifs.push(...(await decompteBahati()));
      await passerLeMois(n, mois, actifs);
      if (mois === '2026-04') await quotitesEtSaisie();
      if (mois === '2026-10') await mainlevee();
    });
  }

  /**
   * POINT 2 · LA SAISIE-ARRÊT NOTIFIÉE. AUPSRVE, art. 184 (acte notifié au
   * tiers saisi), 187 (indisponibilité dès la notification), 188 (versement
   * au greffe), 201 (mainlevée). Le registre des avances la tient au
   * 42320000 « Personnel, saisies-arrêts » (Guide SYSCOHADA, Partie 1 ch. 3,
   * § 4.3), et exige l'acte, le greffe et le destinataire.
   */
  async function saisieNotifiee() {
    const s = ctx.sal.E1;
    const base = { dateOctroi: '2026-04-08', montantFc: 1_200_000, retenueMensuelleFc: 150_000, objet: 'Saisie-arrêt au profit d’un créancier du travailleur (fictive)', pieceJustificative: 'Acte de saisie-arrêt notifié le 8 avril 2026' };
    const acte = { referenceActe: 'RCE 0412/2026 · Tribunal de commerce de Kinshasa/Gombe (acte fictif du banc)', greffe: 'Greffe du tribunal de commerce de Kinshasa/Gombe', destinataire: 'Greffe du tribunal de commerce de Kinshasa/Gombe' };
    await refusAttendu(c, R, 'Saisie-arrêt sans la référence de l’acte', 'POST', `/personnel/salaries/${s?.id}/avances`, { type: 'SAISIE_ARRET', ...base, greffe: acte.greffe, destinataire: acte.destinataire });
    await refusAttendu(c, R, 'Saisie-arrêt sans le greffe', 'POST', `/personnel/salaries/${s?.id}/avances`, { type: 'SAISIE_ARRET', ...base, referenceActe: acte.referenceActe, destinataire: acte.destinataire }, [400], 'art. 183');
    await refusAttendu(c, R, 'Prêt portant une référence d’acte de saisie', 'POST', `/personnel/salaries/${s?.id}/avances`, { type: 'PRET', categoriePret: 'AUTRE', ...base, ...acte });
    // AUPSRVE, art. 205 · la cession se fait par déclaration du cédant au
    // greffe ; le registre des avances ne la tient pas (aucun type « CESSION »).
    await refusAttendu(c, R, 'Cession de rémunération portée au registre des avances', 'POST', `/personnel/salaries/${s?.id}/avances`, { type: 'CESSION', ...base, ...acte });
    ctx.saisie = await c.geste('Saisie-arrêt notifiée pour MWANZA', 'POST', `/personnel/salaries/${s?.id}/avances`, { type: 'SAISIE_ARRET', ...base, ...acte });
    const av = await c.lire('Registre des avances', '/personnel/avances');
    const lue = (av?.avances ?? []).find((x) => x.id === ctx.saisie?.id) ?? null;
    R.egal('saisie-arrêt · compte du registre (42320000)', '42320000', lue?.compte?.compte ?? null);
    // Art. 187 · la quotité n'est indisponible qu'à compter de la notification · la paie de mars ne peut pas la porter.
    await refusAttendu(c, R, 'Retenue de saisie sur la paie de mars (avant la notification du 08/04)', 'POST', `/personnel/simulation?salarieId=${s?.id}`, {
      moisDePaie: '2026-03', ...PRIVE, classeProfessionnelle: 4, elements: [salaire(1_200_000)], retenuesAvances: [{ avanceId: ctx.saisie?.id, montantFc: 150_000 }],
    }, [400], 'art. 187');
  }

  /**
   * LA QUOTITÉ DE L'ART. 114 SUR LE BULLETIN D'AVRIL ET EN SIMULATION ·
   * MWANZA, classe 4 · rémunération 1 200 000, quote-part 60 000, IRPP ·
   * 1 140 000 × 12 = 13 680 000 ; 58 320 + 11 736 000 × 15 % = 1 818 720 ;
   * / 12 = 151 560 → 151 600 · base 988 400 ; seuil 5 × 33 110 × 26 =
   * 4 304 300 · quotité 988 400 / 5 = 197 680 ; alimentaire 2/5 = 395 360 ;
   * logement en nature · 159,26 × 26 = 4 140,76, base 984 259,24, quotité
   * 196 851,848.
   */
  async function quotitesEtSaisie() {
    const s = ctx.sal.E1;
    const q = quotite({ remuneration: 1_200_000, impot: 151_600, qpo: 60_000, classe: 4 });
    const b = ctx.att['E1-2026-04']?.b;
    R.montant('2026-04 · MWANZA · quotité saisissable du bulletin (classe déclarée)', q.ordinaire, b?.calcul?.quotite?.quotiteOrdinaireFc);
    R.egal('2026-04 · MWANZA · retenue de 150 000 sous la quotité · aucune réserve de saisie', null, lu(b?.calcul?.reserveSaisies));
    R.egal('2026-04 · MWANZA · retenue de saisie figée (littera g, 150 000)', ['g', 150_000], [b?.calcul?.retenuesAvances?.[0]?.littera ?? null, nombre(b?.calcul?.retenuesAvances?.[0]?.montantFc)]);
    const sim = (libelle, extra) => c.geste(`Simulation · ${libelle}`, 'POST', `/personnel/simulation?salarieId=${s?.id}`, {
      moisDePaie: '2026-05', ...PRIVE, elements: [salaire(1_200_000)], ...extra,
    });
    // AUPSRVE, art. 188 · « sans excéder la portion saisissable » · dit, jamais refusé.
    const trop = await sim('retenue de 250 000 au-delà de la quotité', { classeProfessionnelle: 4, retenuesAvances: [{ avanceId: ctx.saisie?.id, montantFc: 250_000 }] });
    R.egal('retenue de saisie de 250 000 > quotité 197 680 · réserve « dépasse la quotité »', true, Boolean(trop?.reserveSaisies?.includes('dépasse la quotité saisissable')));
    R.montant('retenue au-delà de la quotité · net diminué de la retenue (988 400 − 250 000)', 738_400, trop?.net?.netAPayerFc);
    const sansClasse = await sim('retenue sans la classe déclarée', { retenuesAvances: [{ avanceId: ctx.saisie?.id, montantFc: 150_000 }] });
    R.egal('sans la classe · quotité non chiffrée, abstention nommée, réserve « pas chiffrée »', [null, 'CLASSE_PROFESSIONNELLE_ABSENTE', true],
      [lu(sansClasse?.quotite?.quotiteOrdinaireFc), sansClasse?.quotite?.abstentions?.[0]?.motif ?? null, Boolean(sansClasse?.reserveSaisies?.includes("n'est pas chiffrée"))]);
    const logement = await sim('logement fourni en nature', { classeProfessionnelle: 4, logementFourniEnNature: true });
    const ql = quotite({ remuneration: 1_200_000, impot: 151_600, qpo: 60_000, classe: 4, logementEnNature: true });
    R.montant('logement en nature · évaluation forfaitaire (colonne 20 × 26)', ql.logement, logement?.quotite?.evaluationForfaitaireLogementFc);
    R.montant('logement en nature · base de la quotité', ql.base, logement?.quotite?.baseFc);
    R.montant('logement en nature · quotité ordinaire', ql.ordinaire, logement?.quotite?.quotiteOrdinaireFc);
    const defalque = await sim('logement déjà défalqué par l’employeur', { classeProfessionnelle: 4, logementFourniEnNature: true, logementEnNatureDejaDefalque: true });
    R.montant('logement déjà défalqué · aucune seconde déduction', q.ordinaire, defalque?.quotite?.quotiteOrdinaireFc);
    const alim = await sim('obligation alimentaire légale', { classeProfessionnelle: 4, obligationAlimentaireLegale: true });
    R.montant('obligation alimentaire · deux cinquièmes de la base', q.alimentaire, alim?.quotite?.quotiteAlimentaireFc);
    R.montant('obligation alimentaire · cumul (al. 3)', q.ordinaire + q.alimentaire, alim?.quotite?.quotiteCumuleeFc);
    R.montant('obligation alimentaire · part insaisissable', q.base - q.ordinaire - q.alimentaire, alim?.quotite?.partInsaisissableFc);
    R.egal('obligation alimentaire · la réserve du cumul non plafonné est servie', true, (alim?.quotite?.reserves ?? []).some((r) => r.startsWith('ALINÉA 3')));
    // AU-DELÀ DU SEUIL · classe 1, 4 000 000 · quote-part 200 000 ; IRPP ·
    // 3 800 000 × 12 = 45 600 000 ; 58 320 + 2 948 400 + 6 480 000 +
    // 2 400 000 × 40 % = 10 446 720 ; / 12 = 870 560 → 870 600 · base
    // 2 929 400 ; seuil 5 × 559 000 = 2 795 000 · 559 000 + 134 400 / 3 = 603 800.
    const haut = await c.geste('Simulation · au-delà du seuil de l’art. 114', 'POST', '/personnel/simulation', {
      moisDePaie: '2026-05', ...PRIVE, classeProfessionnelle: 1, elements: [salaire(4_000_000)],
    });
    const qh = quotite({ remuneration: 4_000_000, impot: 870_600, qpo: 200_000, classe: 1 });
    R.egal('au-delà du seuil · [base, seuil, quotité (1/5 puis 1/3)]', [qh.base, qh.seuil, qh.ordinaire],
      [nombre(haut?.quotite?.baseFc), nombre(haut?.quotite?.seuilFc), nombre(haut?.quotite?.quotiteOrdinaireFc)]);
    // LA CESSION · AUPSRVE, art. 205 à 212 · ni tenue ni calculée, et dite.
    R.egal('la cession en la forme de l’AUPSRVE est dite (déclaration au greffe, art. 205)', true, Boolean(q && trop?.retenuesAutorisees?.cessionSyndicale?.includes('AU GREFFE (art. 205)')));
    R.egal('la cotisation syndicale ne se retient pas sur la paie (art. 279 et 112)', true, Boolean(trop?.retenuesAutorisees?.cotisationSyndicale?.startsWith('LA COTISATION SYNDICALE NE SE RETIENT PAS')));
    R.egal('le net dit que la cession notifiée n’est pas tenue au registre', true, (trop?.net?.reserves ?? []).some((r) => r.includes("LA CESSION NOTIFIÉE n'est pas tenue au registre")));
  }

  /** Octobre · mainlevée de la saisie (AUPSRVE, art. 201), le reste payé directement au créancier. */
  async function mainlevee() {
    if (!ctx.saisie) return;
    await refusAttendu(c, R, 'Mainlevée antérieure à la notification', 'PATCH', `/personnel/avances/${ctx.saisie.id}/fin`, { dateFin: '2026-04-01' });
    await c.geste('Mainlevée de la saisie au 31/10/2026', 'PATCH', `/personnel/avances/${ctx.saisie.id}/fin`, { dateFin: '2026-10-31' });
    await refusAttendu(c, R, 'Seconde mainlevée de la même saisie', 'PATCH', `/personnel/avances/${ctx.saisie.id}/fin`, { dateFin: '2026-11-15' }, [400, 409]);
    const av = await c.lire('Registre des avances après la mainlevée', '/personnel/avances');
    const lue = (av?.avances ?? []).find((x) => x.id === ctx.saisie.id) ?? null;
    // 1 200 000 − 6 × 150 000 − 100 000 = 200 000.
    R.montant('saisie après mainlevée · reste au registre', 200_000, lue?.soldeFc);
  }

  /** Novembre · la saisie levée ne mord plus sur la paie (art. 201), même avec un reste au registre. */
  async function apresMainlevee() {
    await refusAttendu(c, R, 'Retenue de saisie sur la paie de novembre (après la mainlevée du 31/10)', 'POST', `/personnel/simulation?salarieId=${ctx.sal.E1?.id}`, {
      moisDePaie: '2026-11', ...PRIVE, classeProfessionnelle: 4, elements: [salaire(1_200_000)], retenuesAvances: [{ avanceId: ctx.saisie?.id, montantFc: 50_000 }],
    }, [400], 'art. 201');
  }

  /** Émet un décompte final et le compare au bulletin attendu. */
  async function emettreDecompte(cle, mois, faits, elementsMois, indemnites, dateFin, motifFin, client = c) {
    const s = ctx.sal[cle];
    if (!s) return [];
    await c.geste(`Fin du contrat de ${s.nom}`, 'POST', `/personnel/contrats/${s.contratId}/fin`, { dateFin, motifFin });
    const b = await client.geste(`Décompte final de ${s.nom} (émission)`, 'POST', `/personnel/salaries/${s.id}/decompte-final`, { decompte: faits, paie: { moisDePaie: mois, elements: elementsMois, ...paramsSarl(mois) } });
    const a = attendu({ elements: [...elementsMois, ...indemnites], tauxInpp: tauxInppSarl(mois), tauxRp: tauxRpSarl(mois) });
    if (!b) return [];
    R.egal(`${mois} · décompte ${s.nom} · [nature, versé, assiette sociale, quote-part ouvrière, IRPP, net]`, ['DECOMPTE_FINAL', ...tupleAttendu(a)], [b.nature ?? null, ...tuple(b)]);
    return [{ a, b }];
  }

  /**
   * MAI · TERME DU CDD DE KAZADI (du 01/12/2025 au 31/05/2026). Art. 69 · le
   * contrat « prend fin à l'expiration du terme » · aucun préavis. Congé
   * (art. 141, 144) · six mois entiers (décembre à mai), un jour chacun, aucune
   * tranche de cinq ans · 6 × 650 000 / 26 = 6 × 25 000 = 150 000. Arriérés ·
   * le salaire de mai, 650 000. Total · 800 000. Bulletin · quote-part 40 000 ;
   * 760 000 × 12 = 9 120 000 ; 58 320 + 7 176 000 × 15 % = 1 134 720 ; / 12 =
   * 94 560 → 94 600 ; net 665 400.
   */
  async function decompteKazadi() {
    const faits = {
      ...ZEROS, anneesAnciennete: 0, moisNonCouvertsParUnConge: 6, initiative: 'EMPLOYEUR', motif: 'TERME_DU_CDD', typeContrat: 'DUREE_DETERMINEE',
      remunerationJournaliereFc: 25_000, remunerationMensuelleFc: 650_000, arrieresFc: 650_000, moisDeCessation: '2026-05',
    };
    const calc = await c.geste('Décompte final de KAZADI (calcul)', 'POST', '/personnel/decompte-final', faits);
    R.egal('KAZADI · aucun préavis au terme du CDD (art. 69)', [0, true], [nombre(rubrique(calc, 'preavis')?.montantFc), Boolean(rubrique(calc, 'preavis')?.fondement?.startsWith('Article 69'))]);
    R.montant('KAZADI · indemnité compensatrice de congé', 150_000, rubrique(calc, 'conge')?.montantFc);
    R.montant('KAZADI · total dû au travailleur', 800_000, calc?.totalDuAuTravailleurFc);
    await refusAttendu(c, R, 'Terme du CDD déclaré sur un contrat à durée indéterminée', 'POST', '/personnel/decompte-final', { ...faits, typeContrat: 'DUREE_INDETERMINEE' }, [400], 'art. 69');
    return emettreDecompte('E4', '2026-05', faits, [salaire(650_000, 'Salaire de mai')],
      [{ nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', libelle: 'Congé', montantFc: 150_000 }], '2026-05-31', 'Terme du contrat à durée déterminée');
  }

  /**
   * AOÛT · DÉMISSION DE LUKUSA (entrée le 01/06/2022), notifiée le
   * 03/08/2026 · quatre années entières · préavis de l'employeur 14 + 4 × 7 =
   * 42 jours ouvrables, la MOITIÉ pour une démission (art. 64, al. 2) · 21,
   * du 04/08 (mardi) au 27/08 (jeudi), aucun férié dans le délai · PRESTÉ,
   * il se paie en salaire (aux arriérés). Arriérés · août jusqu'au 27 · 23
   * jours payables (le 1er août, samedi férié, art. 93, et 22 jours ouvrables)
   * × 1 040 000 / 26 = 23 × 40 000 = 920 000. Congé · sept mois entiers
   * (janvier à juillet), aucune tranche · 7 × 40 000 = 280 000. Total ·
   * 1 200 000. Bulletin · quote-part 60 000, IRPP 151 600, net 988 400.
   */
  async function decompteLukusa() {
    const faits = {
      ...ZEROS, anneesAnciennete: 4, moisNonCouvertsParUnConge: 7, initiative: 'TRAVAILLEUR', motif: 'DEMISSION', typeContrat: 'DUREE_INDETERMINEE',
      dateNotification: '2026-08-03', executionPreavis: 'PRESTE', remunerationJournaliereFc: 40_000, remunerationMensuelleFc: 1_040_000,
      arrieresFc: 920_000, moisDeCessation: '2026-08',
    };
    const calc = await c.geste('Décompte final de LUKUSA (calcul)', 'POST', '/personnel/decompte-final', faits);
    R.montant('LUKUSA · préavis de démission (moitié de 42 jours ouvrables)', 21, calc?.preavis?.joursOuvrables);
    R.montant('LUKUSA · préavis presté · indemnité nulle', 0, rubrique(calc, 'preavis')?.montantFc);
    R.montant('LUKUSA · indemnité compensatrice de congé', 280_000, rubrique(calc, 'conge')?.montantFc);
    R.montant('LUKUSA · total dû au travailleur', 1_200_000, calc?.totalDuAuTravailleurFc);
    // Le préavis NON OBSERVÉ par la démissionnaire · elle le DOIT (art. 63,
    // al. 3) · 21 jours du lundi au samedi du 04/08 au 27/08, aucun mois
    // entier · 21 × 1 040 000 / 26 = 840 000, hors du total qui lui revient.
    const non = await c.geste('Décompte de LUKUSA (préavis non observé, calcul)', 'POST', '/personnel/decompte-final', { ...faits, executionPreavis: 'NON_OBSERVE', joursPreavisNonObserves: 21 });
    R.egal('LUKUSA · préavis non observé · [dû par la travailleuse, dû à elle au titre du préavis]', [840_000, 0],
      [nombre(non?.duParLeTravailleur?.[0]?.montantFc), nombre(rubrique(non, 'preavis')?.montantFc)]);
    // Art. 64, al. 2 · une démission est l'initiative du travailleur.
    await refusAttendu(c, R, 'Démission déclarée à l’initiative de l’employeur', 'POST', '/personnel/decompte-final', { ...faits, initiative: 'EMPLOYEUR' }, [400], 'démission');
    return emettreDecompte('E2', '2026-08', faits, [salaire(920_000, 'Salaire du 1er au 27 août')],
      [{ nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', libelle: 'Congé', montantFc: 280_000 }], '2026-08-27', 'Démission, préavis presté');
  }

  /**
   * OCTOBRE · FAUTE LOURDE DE NSIMBA (entré le 01/03/2020), notifiée le
   * 12/10/2026 · art. 72, « résilié immédiatement sans préavis » · le zéro est
   * une RÉPONSE. Congé · neuf mois entiers (janvier à septembre) + une tranche
   * de cinq ans (six années, art. 141 ; tranche due entière, décision T6) ·
   * 10 × 30 000 = 300 000. Arriérés · du 1er au 12 octobre, 10 jours
   * payables (jeudi 1er au lundi 12, aucun férié) × 30 000 = 300 000. Total ·
   * 600 000. Bulletin · quote-part 30 000, IRPP 66 100, net 503 900.
   */
  async function decompteNsimba() {
    const faits = {
      ...ZEROS, anneesAnciennete: 6, moisNonCouvertsParUnConge: 9, initiative: 'EMPLOYEUR', motif: 'FAUTE_LOURDE', typeContrat: 'DUREE_INDETERMINEE',
      dateNotification: '2026-10-12', remunerationJournaliereFc: 30_000, remunerationMensuelleFc: 780_000, arrieresFc: 300_000, moisDeCessation: '2026-10',
    };
    const calc = await c.geste('Décompte final de NSIMBA (calcul)', 'POST', '/personnel/decompte-final', faits);
    R.egal('NSIMBA · faute lourde · préavis zéro, fondé sur l’art. 72', [0, true], [nombre(rubrique(calc, 'preavis')?.montantFc), Boolean(rubrique(calc, 'preavis')?.fondement?.startsWith('Article 72'))]);
    R.montant('NSIMBA · jours de congé (9 + une tranche de cinq ans)', 10, calc?.conge?.joursOuvrables);
    R.montant('NSIMBA · indemnité compensatrice de congé', 300_000, rubrique(calc, 'conge')?.montantFc);
    R.montant('NSIMBA · total dû au travailleur', 600_000, calc?.totalDuAuTravailleurFc);
    return emettreDecompte('E3', '2026-10', faits, [salaire(300_000, 'Salaire du 1er au 12 octobre')],
      [{ nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', libelle: 'Congé', montantFc: 300_000 }], '2026-10-12', 'Licenciement pour faute lourde (art. 72)');
  }

  /**
   * DÉCEMBRE · FORCE MAJEURE (BAHATI, entrée le 15/01/2024, 1 820 000 FC,
   * 70 000 FC par jour) · contrat suspendu en octobre et novembre (art. 57,
   * 8°), résilié le 05/12/2026. Art. 60 c) · « sans indemnité, après deux
   * mois de suspension », le cas constaté par l'Inspecteur du travail
   * (art. 57). Sans le constat déclaré, le préavis est indéterminé et rien ne
   * s'émet ; avec lui, zéro préavis. Congé · neuf mois entiers non couverts
   * (janvier à septembre), deux années, aucune tranche · 9 × 70 000 =
   * 630 000. Aucun arriéré (suspendue). Bulletin · quote-part 31 500 ;
   * 598 500 × 12 = 7 182 000 ; 58 320 + 5 238 000 × 15 % = 844 020 ; / 12 =
   * 70 335 → 70 300 ; net 528 200.
   */
  async function decompteBahati() {
    const s = ctx.sal.E5;
    const faits = {
      ...ZEROS, anneesAnciennete: 2, moisNonCouvertsParUnConge: 9, initiative: 'EMPLOYEUR', motif: 'FORCE_MAJEURE', typeContrat: 'DUREE_INDETERMINEE',
      remunerationJournaliereFc: 70_000, remunerationMensuelleFc: 1_820_000, arrieresFc: 0, moisDeCessation: '2026-12',
    };
    const sans = await c.geste('Décompte de BAHATI sans le constat (calcul)', 'POST', '/personnel/decompte-final', faits);
    R.egal('BAHATI · force majeure non constatée · préavis et total indéterminés', [null, null], [lu(rubrique(sans, 'preavis')?.montantFc), lu(sans?.totalDuAuTravailleurFc)]);
    await c.geste('Fin du contrat de BAHATI', 'POST', `/personnel/contrats/${s?.contratId}/fin`, { dateFin: '2026-12-05', motifFin: 'Force majeure constatée, après deux mois de suspension (art. 57 et 60 c)' });
    await refusAttendu(c, R, 'Décompte de BAHATI émis sans le constat de l’Inspecteur', 'POST', `/personnel/salaries/${s?.id}/decompte-final`, { decompte: faits, paie: { moisDePaie: '2026-12', elements: [], ...PRIVE } }, [400], 'Inspecteur');
    const avec = { ...faits, forceMajeureConstateeParInspecteur: true, deuxMoisDeSuspension: true };
    const calc = await c.geste('Décompte final de BAHATI (calcul)', 'POST', '/personnel/decompte-final', avec);
    R.egal('BAHATI · constat et deux mois déclarés · préavis zéro (art. 57 et 60 c)', [0, 'Articles 57 et 60 c)'], [nombre(rubrique(calc, 'preavis')?.montantFc), calc?.preavis?.fondement ?? null]);
    R.montant('BAHATI · indemnité compensatrice de congé', 630_000, rubrique(calc, 'conge')?.montantFc);
    R.montant('BAHATI · total dû au travailleur', 630_000, calc?.totalDuAuTravailleurFc);
    // Le contrat est déjà terminé au registre · émission directe.
    const b = await c.geste('Décompte final de BAHATI (émission)', 'POST', `/personnel/salaries/${s?.id}/decompte-final`, { decompte: avec, paie: { moisDePaie: '2026-12', elements: [], ...PRIVE } });
    const a = attendu({ elements: [{ nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', libelle: 'Congé', montantFc: 630_000 }] });
    if (!b) return [];
    R.egal('2026-12 · décompte BAHATI · [nature, versé, assiette sociale, quote-part ouvrière, IRPP, net]', ['DECOMPTE_FINAL', ...tupleAttendu(a)], [b.nature ?? null, ...tuple(b)]);
    return [{ a, b }];
  }

  await etape(R, 'SARL · décomptes calculés · férié du dimanche dans le délai, délégué au taux journalier', async () => {
    // ORDONNANCE n° 23-042, ART. 2 · le 17/05/2026 (Fête de la libération)
    // tombe un dimanche · le congé est pris « le jour précédent », le samedi
    // 16 · non ouvrable, rémunéré (décision T9). Licenciement d'un an notifié
    // le 11/05/2026 · 14 + 7 = 21 jours ouvrables du 12/05 · 12 au 15 (4), le
    // 16 exclu, 18 au 23 (10), 25 au 30 (16), 1er au 5 juin (21) · fin le
    // 05/06. Dispense par l'employeur · 22 jours payables du lundi au samedi
    // (le 16 compris, art. 93) × 30 000 = 660 000 ; au mois · aucun mois
    // entier (12/05 → 11/06 dépasse le 05/06), 22 × 780 000 / 26 = 660 000.
    const f = {
      ...ZEROS, anneesAnciennete: 1, moisNonCouvertsParUnConge: 4, initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', typeContrat: 'DUREE_INDETERMINEE',
      dateNotification: '2026-05-11', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR', remunerationJournaliereFc: 30_000, remunerationMensuelleFc: 780_000, arrieresFc: 0,
    };
    const x = await c.geste('Décompte · licenciement notifié le 11/05/2026 (calcul)', 'POST', '/personnel/decompte-final', f);
    R.montant('préavis notifié le 11/05/2026 · jours ouvrables (art. 64)', 21, x?.preavis?.joursOuvrables);
    R.montant('préavis notifié le 11/05/2026 · rémunération du délai, samedi 16 mai compris', 660_000, rubrique(x, 'preavis')?.montantFc);
    R.egal('préavis notifié le 11/05/2026 · l’explication nomme un samedi portant le congé d’un férié du dimanche', true, Boolean(rubrique(x, 'preavis')?.fondement?.includes('dont 1 férié(s) ou samedi(s)')));
  });

  await etape(R, 'SARL · registre des retenues et balance de 2026', async () => {
    const reg = await c.lire('Registre des retenues au 31/12/2026', `/retenues/registre?exerciceId=${n}&dateReference=2026-12-31`);
    const dec = cum.get('2026-12');
    const q4 = inppDuTrimestre(['2026-10', '2026-11', '2026-12']);
    R.montant('registre 2026 · IRPP dû au 31/12 (décembre)', dec.irpp, natureDu(reg, 'irppSalaires')?.solde);
    R.montant('registre 2026 · CNSS due au 31/12 (décembre)', dec.cnss, natureDu(reg, 'cnss')?.solde);
    R.montant('registre 2026 · INPP et ONEM dus au 31/12 (ONEM de décembre + INPP du 4e trimestre)', dec.onem + q4, natureDu(reg, 'inppOnem')?.solde);
    R.egal('registre 2026 · aucun mois en retard au 31/12', 0, (reg?.natures ?? []).reduce((s, x) => s + (x.moisEnRetard ?? 0), 0));
    const b = await balance(c, n);
    for (const compte of ['66110000', '66130000', '66410000', '64150000', '64130000', '42200000', '43110000', '43120000', '43130000', '44720000', '44280000', '42320000', BQ]) {
      R.montant(`balance 2026 · ${compte}`, L.solde(compte), solde(b, compte));
    }
    // L'indemnité de fin de contrat de 2026 · aucune (terme, démission, faute lourde, force majeure sans préavis).
    R.montant('balance 2026 · 66140000 (aucune indemnité de rupture en 2026)', 0, solde(b, '66140000'));
    const ef = await c.lire('Effectif au 31/12/2026', '/personnel/effectif?ala=2026-12-31');
    // KAZADI (31/05), LUKUSA (27/08), NSIMBA (12/10), BAHATI (05/12) sortis · MWANZA, MUTOMBO, MBALA.
    R.montant('effectif du registre au 31/12/2026', 3, ef?.effectif);
  });

  const clos26 = await etape(R, 'SARL · clôture de 2026', () => cloturer(c, '2026'));
  R.egal('SARL · clôture de 2026', true, Boolean(clos26));
  const n1 = c.exercices.get('2027')?.id;
  if (!n1) { R.note('Exercice 2027 absent après la clôture · la suite de la SARL est sautée'); return; }
  L = L.reporter();

  await etape(R, 'SARL · 2027 · ouverture, réduction INPP et majoration (simulations), embauche', async () => {
    const dec = cum.get('2026-12');
    const q4 = inppDuTrimestre(['2026-10', '2026-11', '2026-12']);
    const b = await balance(c, n1);
    R.montant('à-nouveau 2027 · IRPP de décembre (4472)', -dec.irpp, solde(b, '44720000'));
    R.montant('à-nouveau 2027 · retraite (4313)', -dec.pension, solde(b, '43130000'));
    R.montant('à-nouveau 2027 · INPP et ONEM (4428)', -(dec.onem + q4), solde(b, '44280000'));
    R.montant('à-nouveau 2027 · saisies-arrêts (4232) soldées', 0, solde(b, '42320000'));
    const reg = await c.lire('Registre des retenues 2027 à l’ouverture', `/retenues/registre?exerciceId=${n1}&dateReference=2027-01-02`);
    R.montant('registre 2027 · IRPP · solde d’ouverture', dec.irpp, natureDu(reg, 'irppSalaires')?.soldeOuverture);
    R.montant('registre 2027 · CNSS · solde d’ouverture', dec.cnss, natureDu(reg, 'cnss')?.soldeOuverture);
    R.montant('registre 2027 · INPP et ONEM · solde d’ouverture', dec.onem + q4, natureDu(reg, 'inppOnem')?.soldeOuverture);
    // ORDONNANCE n° 84/186, ART. 1er, AL. 2 · réduction au plus du quart ·
    // 0,9 point dépasse 0,875 · l'INPP s'abstient, le motif nommé ; sans la
    // référence de l'acte, de même ; avec elle, 2,625 %.
    const s = ctx.sal.E1;
    const sim = (libelle, extra) => c.geste(`Simulation · ${libelle}`, 'POST', `/personnel/simulation?salarieId=${s?.id}`, { moisDePaie: '2027-01', ...PRIVE, elements: [salaire(1_200_000)], ...extra });
    const au = await sim('réduction INPP de 0,9 point', { reductionTauxInppPoints: 0.9, referenceReductionInpp: REDUCTION_2027.referenceReductionInpp });
    R.egal('réduction de 0,9 point (> le quart de 3,5) · INPP en abstention, aucune ligne', [true, null],
      [(au?.cotisations?.abstentions ?? []).some((a) => a.startsWith('INPP ·')), ligneCot(au, 'inpp')]);
    const sansActe = await sim('réduction sans acte', { reductionTauxInppPoints: 0.875 });
    R.egal('réduction sans la référence de l’acte · INPP en abstention, l’acte réclamé', true, (sansActe?.cotisations?.abstentions ?? []).some((a) => a.includes("référence de l'acte")));
    const ok = await sim('réduction au quart avec son acte', REDUCTION_2027);
    R.egal('réduction au quart avec son acte · [taux INPP, cotisation]', [2.625, 31_500], [nombre(ligneCot(ok, 'inpp')?.tauxPourCent), nombre(ligneCot(ok, 'inpp')?.montantFc)]);
    // DÉCRET n° 18/041, ART. 5 · le double au plus ; arrêté n° 140/2018,
    // art. 24 · 100 % en récidive · 1,5 × 2 = 3 %.
    const recidive = await sim('majoration de 100 % des risques professionnels', { majorationRisquesProfessionnelsPourCent: 100 });
    R.egal('majoration de 100 % · [taux risques professionnels, cotisation]', [3, 36_000], [nombre(ligneCot(recidive, 'cnss-rp')?.tauxPourCent), nombre(ligneCot(recidive, 'cnss-rp')?.montantFc)]);
    await refusAttendu(c, R, 'Majoration de 75 % (ni 50 ni 100)', 'POST', `/personnel/simulation?salarieId=${s?.id}`, { moisDePaie: '2027-01', ...PRIVE, elements: [salaire(1_200_000)], majorationRisquesProfessionnelsPourCent: 75 });
    await creerSalarie('E9', PERSONNEL_SARL.E9);
  });

  // --- 2027, mois par mois -----------------------------------------------------
  for (let m = 1; m <= 12; m += 1) {
    const mois = moisDe(2027, m);
    const prec = m === 1 ? '2026-12' : moisDe(2027, m - 1);
    await etape(R, `SARL · paie de ${mois}`, async () => {
      if (mois === '2027-08') await retardDeJuin();
      await reverserCnssOnem(n1, prec, `${mois}-14`);
      // L'IRPP de juin n'est PAS reversé le 14 juillet · il l'est le 13 août avec celui de juillet.
      if (prec !== '2027-06' && prec !== '2027-07') await reverserIrpp(n1, `${mois}-14`, cum.get(prec).irpp, prec);
      if (mois === '2027-01') await reverser4428(n1, '2027-01-29', inppDuTrimestre(['2026-10', '2026-11', '2026-12']), 'INPP du quatrième trimestre 2026');
      if (mois === '2027-04') await reverser4428(n1, '2027-04-29', inppDuTrimestre(['2027-01', '2027-02', '2027-03']), 'INPP du premier trimestre 2027');
      if (mois === '2027-07') await reverser4428(n1, '2027-07-29', inppDuTrimestre(['2027-04', '2027-05', '2027-06']), 'INPP du deuxième trimestre 2027');
      if (mois === '2027-10') await reverser4428(n1, '2027-10-29', inppDuTrimestre(['2027-07', '2027-08', '2027-09']), 'INPP du troisième trimestre 2027');
      const actifs = [];
      for (const cle of Object.keys(ctx.sal)) {
        const x = await emettre(cle, mois);
        if (x) actifs.push(x);
      }
      if (mois === '2027-04') {
        const b = ctx.att['E1-2027-04']?.b;
        R.egal('2027-04 · MWANZA · [taux INPP réduit, taux des risques professionnels majoré de 50 %]', [2.625, 2.25],
          [nombre(ligneCot(b?.calcul, 'inpp')?.tauxPourCent), nombre(ligneCot(b?.calcul, 'cnss-rp')?.tauxPourCent)]);
      }
      if (mois === '2027-07') actifs.push(...(await decompteMutombo()));
      await passerLeMois(n1, mois, actifs);
    });
  }

  /**
   * AOÛT 2027 · L'IRPP DE JUIN N'A PAS ÉTÉ REVERSÉ À SON ÉCHÉANCE (jeudi
   * 15/07/2027). Lu le 02/08, avant tout versement d'août · juin en retard,
   * signalé au titre de l'art. 20 (déductibilité de la charge) ; juillet,
   * échu le lundi 16/08 (le 15 est un dimanche), ne l'est pas encore. Le
   * 13/08, juin et juillet sont reversés ensemble.
   */
  async function retardDeJuin() {
    const juin = cum.get('2027-06').irpp;
    const juillet = cum.get('2027-07').irpp;
    const reg = await c.lire('Registre des retenues au 02/08/2027', `/retenues/registre?exerciceId=${n1}&dateReference=2027-08-02`);
    const irpp = natureDu(reg, 'irppSalaires');
    const ligne = (m) => lignesDe(irpp).find((x) => x.mois === m) ?? null;
    R.egal('registre au 02/08/2027 · IRPP de juin · [solde, échéance, en retard]', [juin, '2027-07-15', true],
      [nombre(ligne('2027-06')?.solde), ligne('2027-06')?.echeance?.slice(0, 10) ?? null, ligne('2027-06')?.enRetard ?? null]);
    R.egal('registre au 02/08/2027 · IRPP de juillet · [échéance reportée au lundi, en retard]', [echeanceIrpp('2027-07'), false],
      [ligne('2027-07')?.echeance?.slice(0, 10) ?? null, ligne('2027-07')?.enRetard ?? null]);
    R.montant('registre au 02/08/2027 · IRPP · mois en retard', 1, irpp?.moisEnRetard);
    const sig = (reg?.signalementsDeductibilite ?? []).find((x) => x.cle === 'irppSalaires') ?? null;
    R.montant('registre au 02/08/2027 · signalement de l’art. 20 · retenue échue non reversée', juin, sig?.montantEchuNonReverse);
    await reverserIrpp(n1, '2027-08-13', juin + juillet, 'juin (en retard) et juillet 2027');
  }

  /**
   * JUILLET 2027 · LICENCIEMENT DE MUTOMBO, DÉLÉGUÉ SYNDICAL (entré le
   * 01/02/2024), notifié le 15/07/2027 · trois années entières · art. 64 · 14 +
   * 21 = 35 jours ouvrables ; art. 258 · « le double » (70), « sans pouvoir
   * être inférieure à trois mois » · du 16/07 au 16/10/2027 exclu, 79 jours du
   * lundi au samedi dont le SAMEDI 31/07, qui porte le congé de la Fête des
   * parents tombée le dimanche 1er août (ordonnance n° 23-042, art. 2) · 78
   * jours ouvrables > 70 · retenus. Dispense par l'employeur · au mois, trois
   * mois entiers de date à date (16/07 → 15/08, → 15/09, → 15/10) ·
   * 3 × 1 300 000 = 3 900 000 ; au seul taux journalier, 79 jours payables
   * (le 31/07 rémunéré, art. 93) × 50 000 = 3 950 000. Congé · six mois
   * entiers (janvier à juin), aucune tranche · 6 × 50 000 = 300 000.
   * Arriérés · 1er au 15 juillet, 13 jours payables × 50 000 = 650 000.
   * Total · 4 850 000. Bulletin (INPP réduit à 2,625 %) · quote-part 242 500 ;
   * 4 607 500 × 12 = 55 290 000 ; 58 320 + 2 948 400 + 6 480 000 + 12 090 000
   * × 40 % = 14 322 720 (sous 30 % · 16 587 000) ; / 12 = 1 193 560 →
   * 1 193 600 ; net 3 413 900.
   */
  async function decompteMutombo() {
    const faits = {
      ...ZEROS, anneesAnciennete: 3, moisNonCouvertsParUnConge: 6, initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', typeContrat: 'DUREE_INDETERMINEE',
      delegueSyndical: true, dateNotification: '2027-07-15', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR',
      remunerationJournaliereFc: 50_000, remunerationMensuelleFc: 1_300_000, arrieresFc: 650_000, moisDeCessation: '2027-07',
    };
    const calc = await c.geste('Décompte final de MUTOMBO (calcul)', 'POST', '/personnel/decompte-final', faits);
    R.egal('MUTOMBO · préavis du délégué · [jours ouvrables, du, au exclu]', [78, '2027-07-16', '2027-10-16'],
      [nombre(calc?.preavis?.joursOuvrables), calc?.preavis?.delaiDeDateADate?.du ?? null, calc?.preavis?.delaiDeDateADate?.auExclu ?? null]);
    R.montant('MUTOMBO · indemnité de préavis (trois mois entiers)', 3_900_000, rubrique(calc, 'preavis')?.montantFc);
    R.montant('MUTOMBO · indemnité compensatrice de congé', 300_000, rubrique(calc, 'conge')?.montantFc);
    R.montant('MUTOMBO · total dû au travailleur', 4_850_000, calc?.totalDuAuTravailleurFc);
    const auJour = await c.geste('Décompte de MUTOMBO au seul taux journalier (calcul)', 'POST', '/personnel/decompte-final', { ...faits, remunerationMensuelleFc: undefined });
    R.montant('MUTOMBO · au taux journalier · 79 jours payables, samedi 31/07 compris', 3_950_000, rubrique(auJour, 'preavis')?.montantFc);
    return emettreDecompte('E6', '2027-07', faits, [salaire(650_000, 'Salaire du 1er au 15 juillet')], [
      { nature: 'INDEMNITE_DE_FIN_DE_CONTRAT', libelle: 'Préavis', montantFc: 3_900_000 },
      { nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', libelle: 'Congé', montantFc: 300_000 },
    ], '2027-07-15', 'Licenciement d’un délégué syndical, préavis dispensé');
  }

  await etape(R, 'SARL · registre des retenues de 2027 entier et balance avant clôture', async () => {
    const reg = await c.lire('Registre des retenues au 31/12/2027', `/retenues/registre?exerciceId=${n1}&dateReference=2027-12-31`);
    const tous = [...cum.parMois.keys()].filter((m) => m.startsWith('2027')).sort();
    const verifier = (cle, part, champ, echeance, libelle, restants) => {
      const l = lignesDe(natureDu(reg, cle), part);
      R.egal(`registre 2027 · ${libelle} · retenu par mois`, tous.map((m) => [m, r2(cum.get(m)[champ])]), l.map((x) => [x.mois, nombre(x.retenu)]).sort());
      R.egal(`registre 2027 · ${libelle} · échéances`, tous.map((m) => [m, echeance(m)]), l.map((x) => [x.mois, x.echeance?.slice(0, 10)]).sort());
      R.egal(`registre 2027 · ${libelle} · mois restant dus au 31/12`, restants, l.filter((x) => Math.abs(x.solde) > 0.005).map((x) => x.mois).sort());
      R.egal(`registre 2027 · ${libelle} · aucun mois en retard au 31/12`, [], l.filter((x) => x.enRetard).map((x) => x.mois));
    };
    verifier('irppSalaires', null, 'irpp', echeanceIrpp, 'IRPP', ['2027-12']);
    verifier('cnss', null, 'cnss', echeanceCnss, 'CNSS', ['2027-12']);
    verifier('inppOnem', 'ONEM', 'onem', echeanceOnem, 'ONEM', ['2027-12']);
    verifier('inppOnem', 'INPP', 'inpp', echeanceInpp, 'INPP', ['2027-10', '2027-11', '2027-12']);
    const anterieures = ['irppSalaires', 'cnss', 'inppOnem'].flatMap((k) => lignesDe(natureDu(reg, k), null, true).map((x) => ({ k, ...x })));
    // Décembre 2026 · IRPP, CNSS, ONEM ; INPP d'octobre, novembre et décembre · six lignes reprises.
    R.egal('registre 2027 · lignes de 2026 reprises à l’ouverture · [nombre, restant dues]', [6, []],
      [anterieures.length, anterieures.filter((x) => Math.abs(x.solde) > 0.005).map((x) => `${x.k} ${x.mois}`)]);
    const dec = cum.get('2027-12');
    ctx.q4_2027 = inppDuTrimestre(['2027-10', '2027-11', '2027-12']);
    R.montant('registre 2027 · IRPP dû au 31/12', dec.irpp, natureDu(reg, 'irppSalaires')?.solde);
    R.montant('registre 2027 · CNSS due au 31/12', dec.cnss, natureDu(reg, 'cnss')?.solde);
    R.montant('registre 2027 · INPP et ONEM dus au 31/12', dec.onem + ctx.q4_2027, natureDu(reg, 'inppOnem')?.solde);
    const b = await balance(c, n1);
    for (const compte of ['66110000', '66130000', '66140000', '66410000', '64150000', '64130000', '42200000', '43110000', '43120000', '43130000', '44720000', '44280000', BQ]) {
      R.montant(`balance 2027 · ${compte}`, L.solde(compte), solde(b, compte));
    }
  });

  const clos27 = await etape(R, 'SARL · clôture de 2027', () => cloturer(c, '2027'));
  R.egal('SARL · clôture de 2027', true, Boolean(clos27));
  const n2 = c.exercices.get('2028')?.id;
  if (!n2) { R.note('Exercice 2028 absent après la clôture de 2027 · l’ouverture de 2028 est sautée'); return; }
  L = L.reporter();

  /**
   * 2028 · L'OUVERTURE DEPUIS LE REPORT. Restent dus au 31/12/2027 · IRPP,
   * CNSS et ONEM de décembre, INPP du quatrième trimestre. Décembre 2027 ·
   * MWANZA 1 200 000, MBALA 600 000, NGOMA 950 000 · assiette 2 750 000 ·
   * CNSS 18 % = 495 000 ; ONEM 0,5 % = 13 750 ; INPP 2,625 % = 72 187,50 par
   * mois, 216 562,50 pour le trimestre ; IRPP 151 600 + 66 100 + 115 900 =
   * 333 600 (NGOMA · 902 500 × 12 = 10 830 000 ; 58 320 + 8 886 000 × 15 % =
   * 1 391 220 ; / 12 = 115 935 → 115 900).
   */
  const dec27 = cum.get('2027-12');
  await etape(R, 'SARL · 2028 · à-nouveau et registre d’ouverture', async () => {
    const b = await balance(c, n2);
    R.montant('à-nouveau 2028 · IRPP de décembre 2027 (4472)', -dec27.irpp, solde(b, '44720000'));
    R.montant('à-nouveau 2028 · CNSS de décembre (431)', -dec27.cnss, solde(b, '431'));
    R.montant('à-nouveau 2028 · INPP et ONEM (4428)', -(dec27.onem + ctx.q4_2027), solde(b, '44280000'));
    R.montant('à-nouveau 2028 · rémunérations dues (422) soldées', 0, solde(b, '42200000'));
    const reg = await c.lire('Registre des retenues 2028 à l’ouverture', `/retenues/registre?exerciceId=${n2}&dateReference=2028-01-02`);
    R.montant('registre 2028 · IRPP · solde d’ouverture', dec27.irpp, natureDu(reg, 'irppSalaires')?.soldeOuverture);
    R.montant('registre 2028 · CNSS · solde d’ouverture', dec27.cnss, natureDu(reg, 'cnss')?.soldeOuverture);
    R.montant('registre 2028 · INPP et ONEM · solde d’ouverture', dec27.onem + ctx.q4_2027, natureDu(reg, 'inppOnem')?.soldeOuverture);
    // Le solde d'ouverture du 4428 se VENTILE mois par mois sur le registre de 2027 (il le rend au centime).
    const ant = lignesDe(natureDu(reg, 'inppOnem'), null, true).map((x) => [x.mois, x.part, nombre(x.retenu), x.echeance?.slice(0, 10)]);
    R.egal('registre 2028 · ouverture INPP et ONEM ventilée (part, retenu, échéance)', [
      ['2027-12', 'ONEM', r2(dec27.onem), '2028-01-15'],
      ['2027-10', 'INPP', r2(cum.get('2027-10').inpp), '2028-01-31'],
      ['2027-11', 'INPP', r2(cum.get('2027-11').inpp), '2028-01-31'],
      ['2027-12', 'INPP', r2(cum.get('2027-12').inpp), '2028-01-31'],
    ], ant);
  });

  await etape(R, 'SARL · 2028 · reversements de janvier, retards dits, INPP du quatrième trimestre', async () => {
    // IRPP de décembre · échéance du 15/01/2028 (samedi), 16 (dimanche,
    // férié), 17 (lundi, férié) · reportée au mardi 18 (art. 110 bis) · versé
    // le vendredi 14.
    await reverserIrpp(n2, '2028-01-14', dec27.irpp, 'décembre 2027');
    await validerJusqua(c, n2, '2028-01-14');
    const reg = await c.lire('Registre des retenues au 17/01/2028', `/retenues/registre?exerciceId=${n2}&dateReference=2028-01-17`);
    const ant = (cle, part = null) => lignesDe(natureDu(reg, cle), part, true);
    R.egal('registre au 17/01/2028 · IRPP de décembre · [solde, échéance reportée au mardi 18]', [0, '2028-01-18'],
      [nombre(ant('irppSalaires')[0]?.solde), ant('irppSalaires')[0]?.echeance?.slice(0, 10) ?? null]);
    R.egal('registre au 17/01/2028 · CNSS de décembre · [solde, échéance, en retard]', [dec27.cnss, '2028-01-15', true],
      [nombre(ant('cnss')[0]?.solde), ant('cnss')[0]?.echeance?.slice(0, 10) ?? null, ant('cnss')[0]?.enRetard ?? null]);
    R.egal('registre au 17/01/2028 · ONEM de décembre en retard, INPP du trimestre pas encore', [true, false, false, false],
      [ant('inppOnem', 'ONEM')[0]?.enRetard ?? null, ...ant('inppOnem', 'INPP').map((x) => x.enRetard)]);
    // Loi n° 23/053, art. 20, dernier alinéa · la preuve de « la retenue
    // correspondante pour les sommes donnant lieu à un prélèvement ou à une
    // retenue à la source » · le registre ne la rattache qu'à l'IRPP retenu
    // sur les salaires (correspondance-retenues.ts) ; l'IRPP de décembre est
    // versé le 14 · aucun signalement, malgré la CNSS et l'ONEM échus.
    R.egal('registre au 17/01/2028 · signalements de l’art. 20 (IRPP versé, CNSS et ONEM hors de l’article)', [], (reg?.signalementsDeductibilite ?? []).map((x) => x.cle).sort());
    await reverserCnssOnemDec27();
    await validerJusqua(c, n2, '2028-01-20');
    const ech = await c.lire('Échéancier au 20/01/2028', `/retenues/echeancier?exerciceId=${n2}&dateReference=2028-01-20`);
    const e = (cle) => (ech?.echeances ?? []).find((x) => x.cle === cle) ?? null;
    R.egal('échéancier au 20/01/2028 · INPP · [date, montant dû (4e trimestre)]', ['2028-01-31', r2(ctx.q4_2027)], [e('inppOnem-inpp')?.date?.slice(0, 10) ?? null, nombre(e('inppOnem-inpp')?.montantDu)]);
    R.egal('échéancier au 20/01/2028 · ONEM · [date, montant dû (décembre, en retard)]', ['2028-02-15', r2(dec27.onem), 1], [e('inppOnem-onem')?.date?.slice(0, 10) ?? null, nombre(e('inppOnem-onem')?.montantDu), e('inppOnem-onem')?.moisEnRetard ?? null]);
    // Le 28/01, le cabinet verse au 4428 le montant de l'INPP du trimestre,
    // l'ONEM de décembre restant impayé · le registre impute le versement sur
    // la dette échue la plus ancienne (ONEM, 15/01), puis sur l'INPP · il reste
    // 13 750 sur l'INPP de décembre (Code civil, Livre III, art. 154, par analogie).
    await reverser4428(n2, '2028-01-28', ctx.q4_2027, 'INPP du quatrième trimestre 2027');
    await validerJusqua(c, n2, '2028-01-28');
  });

  async function reverserCnssOnemDec27() {
    // CNSS de décembre versée le jeudi 20/01, en retard ; l'ONEM ne l'est pas.
    const x = dec27;
    await ecriture(c, 'Reversement CNSS 2027-12 (tardif)', n2, '2028-01-20', 'Cotisations CNSS 2027-12',
      [['43110000', r2(x.pf), 0], ['43120000', r2(x.rp), 0], ['43130000', r2(x.pension), 0], [BQ, 0, r2(x.cnss)]], { journal: bq });
    L.add('43110000', x.pf, 0); L.add('43120000', x.rp, 0); L.add('43130000', x.pension, 0); banque(-x.cnss);
  }

  /**
   * POINT 8 · LE GESTIONNAIRE DE PAIE (roles-cantonnes.ts, F247) · il n'a
   * RIEN qu'une route ne lui ouvre · le personnel, son propre compte, les
   * exercices, les devises en lecture et la cotation de l'USD du jour de
   * Kinshasa, en création seule. Il émet les bulletins de janvier 2028 ; il
   * ne les passe pas au journal (`@ReserveAuComptable`).
   */
  await etape(R, 'SARL · 2028 · le gestionnaire de paie', async () => {
    const email = `passe-v1-gestionnaire-paie-${Date.now()}@exemple.cd`;
    const provisoire = 'Provisoire-Paie-2028!';
    const definitif = 'Gestion-Paie-Definitif-2028!';
    const u = await c.geste('Création du gestionnaire de paie', 'POST', '/utilisateurs', { email, motDePasse: provisoire, role: 'GESTIONNAIRE_PAIE' });
    R.egal('gestionnaire de paie créé', 'GESTIONNAIRE_PAIE', u?.role ?? null);
    const g0 = new Client(R);
    const l0 = await g0.req('POST', '/auth/login', { email, motDePasse: provisoire });
    const moi0 = (await g0.req('GET', '/auth/me')).corps;
    R.egal('gestionnaire · connexion au mot de passe provisoire · changement exigé', [true, true], [l0.statut < 300, moi0?.doitChangerMotDePasse ?? null]);
    // Mot de passe provisoire · le serveur est FERMÉ jusqu'au changement.
    await refusAttendu(g0, R, 'Gestionnaire au mot de passe provisoire · liste des salariés', 'GET', '/personnel/salaries', undefined, [403]);
    const ch = await g0.req('POST', '/auth/changer-mot-de-passe', { motDePasseActuel: provisoire, nouveauMotDePasse: definitif });
    R.egal('gestionnaire · changement de son mot de passe', true, ch.statut < 400);
    const g = new Client(R);
    const l1 = await g.req('POST', '/auth/login', { email, motDePasse: definitif });
    const moi = (await g.req('GET', '/auth/me')).corps;
    R.egal('gestionnaire · reconnecté · [connexion, rôle, changement exigé]', [true, 'GESTIONNAIRE_PAIE', false], [l1.statut < 300, moi?.role ?? moi?.user?.role ?? null, moi?.doitChangerMotDePasse ?? null]);
    // CE QUI LUI EST OUVERT.
    for (const [libelle, chemin] of [
      ['exercices', '/exercices'], ['salariés', '/personnel/salaries'], ['bulletins de décembre 2027', '/personnel/bulletins?mois=2027-12'],
      ['rubriques', '/personnel/rubriques'], ['barèmes', '/personnel/baremes'], ['registre des avances', '/personnel/avances'],
      ['proposition de la paie de décembre 2027', '/personnel/paie-du-mois/2027-12'], ['devises', '/devises'], ['double authentification', '/auth/double-authentification'],
    ]) {
      const r = await g.req('GET', chemin);
      R.egal(`gestionnaire · lecture ouverte · ${libelle}`, 200, r.statut);
      if (r.statut !== 200) R.note(`gestionnaire · ${chemin} · ${r.statut} · ${JSON.stringify(r.corps).slice(0, 300)}`);
    }
    const sim = await g.req('POST', `/personnel/simulation?salarieId=${ctx.sal.E7?.id}`, { moisDePaie: '2028-01', ...PRIVE, elements: [salaire(600_000)] });
    R.egal('gestionnaire · simulation ouverte', true, sim.statut < 300);
    // Les bulletins de janvier 2028, émis par lui · INPP au taux plein (la réduction valait pour 2027).
    ctx.jan28 = [];
    for (const cle of ['E1', 'E7', 'E9']) {
      const x = await emettre(cle, '2028-01', g);
      if (x) ctx.jan28.push(x);
    }
    R.montant('gestionnaire · trois bulletins de janvier 2028 émis', 3, ctx.jan28.length);
    // CE QUI LUI EST REFUSÉ · le grand livre, la structure, les retenues, la passation.
    const passation = await c.lire('Passation de décembre 2027 (pour son identifiant)', '/personnel/bulletins?mois=2027-12');
    const ecritureDec = (Array.isArray(passation) ? passation : passation?.bulletins ?? []).find((x) => x.ecritureId)?.ecritureId ?? '00000000-0000-4000-8000-000000000000';
    for (const [libelle, methode, chemin, corps] of [
      ['passer la paie de janvier 2028 au journal', 'POST', '/personnel/paie-du-mois/2028-01/comptabilisation', { exerciceId: n2, journalId: od.id, date: '2028-01-31' }],
      ['retirer la passation de décembre 2027', 'DELETE', `/personnel/paie-du-mois/comptabilisation/${ecritureDec}`, undefined],
      ['balance', 'GET', `/ecritures/balance?exerciceId=${n2}`, undefined],
      ['plan des comptes', 'GET', '/comptes', undefined],
      ['journaux', 'GET', '/journaux', undefined],
      ['saisir une écriture', 'POST', '/ecritures', { exerciceId: n2, journalId: od.id, date: '2028-01-31', libelle: 'Tentative', lignes: [] }],
      ['registre des retenues', 'GET', `/retenues/registre?exerciceId=${n2}`, undefined],
      ['échéancier fiscal', 'GET', `/retenues/echeancier?exerciceId=${n2}`, undefined],
      ['utilisateurs', 'GET', '/utilisateurs', undefined],
      ['tiers', 'GET', '/tiers', undefined],
      ['modules du dossier', 'PATCH', '/dossier/modules', { modulesActives: [] }],
      ['créer une devise', 'POST', '/devises', { code: 'GBP', intitule: 'Livre sterling' }],
      ['créer un exercice', 'POST', '/exercices', { dateDebut: '2029-01-01', dateFin: '2029-12-31' }],
      ['journal d’audit', 'GET', '/journal-audit', undefined],
      ['restitution du dossier', 'GET', '/restitution/archive', undefined],
    ]) {
      await refusAttendu(g, R, `gestionnaire · ${libelle}`, methode, chemin, corps, [403]);
    }
    // LE COURS DE L'USD DU JOUR DE KINSHASA · en création seule (horloge du serveur · 15/02/2028).
    const devises = (await c.lire('Devises', '/devises')) ?? [];
    const liste = Array.isArray(devises) ? devises : devises.devises ?? [];
    const usd = liste.find((d) => d.code === 'USD') ?? (await c.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
    const eur = liste.find((d) => d.code === 'EUR') ?? (await c.geste('Devise EUR', 'POST', '/devises', { code: 'EUR', intitule: 'Euro' }));
    const coter = (devise, date) => g.req('POST', `/devises/${devise?.id}/cours`, { date, cours: 2_950, source: 'Banque centrale du Congo (banc paie complément)' });
    const c1 = await coter(usd, '2028-02-15');
    R.egal('gestionnaire · cours de l’USD du jour coté', true, c1.statut === 200 || c1.statut === 201);
    if (c1.statut >= 400) R.note(`cotation de l'USD du jour · ${c1.statut} · ${JSON.stringify(c1.corps).slice(0, 300)}`);
    R.egal('gestionnaire · second cours de l’USD du même jour · 409, jamais réécrit', 409, (await coter(usd, '2028-02-15')).statut);
    R.egal('gestionnaire · cours de l’USD d’une autre date · 403', 403, (await coter(usd, '2028-02-14')).statut);
    R.egal('gestionnaire · cours d’une autre devise que l’USD · 403', 403, (await coter(eur, '2028-02-15')).statut);
  });

  await etape(R, 'SARL · 2028 · passation de janvier par le comptable, registre de février', async () => {
    await passerLeMois(n2, '2028-01', ctx.jan28 ?? []);
    const jan = cum.get('2028-01');
    // MWANZA, MBALA, NGOMA · 2 750 000 · INPP 3,5 % = 96 250 ; ONEM 13 750.
    R.montant('janvier 2028 · INPP au taux plein (3,5 % de 2 750 000)', 96_250, jan.inpp);
    const reg = await c.lire('Registre des retenues au 05/02/2028', `/retenues/registre?exerciceId=${n2}&dateReference=2028-02-05`);
    const nat = natureDu(reg, 'inppOnem');
    const ant = (part, mois) => lignesDe(nat, part, true).find((x) => x.mois === mois) ?? null;
    R.egal('registre au 05/02/2028 · ONEM de décembre éteint par le versement du 28/01 (échu le premier)', 0, nombre(ant('ONEM', '2027-12')?.solde));
    R.egal('registre au 05/02/2028 · INPP d’octobre et novembre éteints', [0, 0], [nombre(ant('INPP', '2027-10')?.solde), nombre(ant('INPP', '2027-11')?.solde)]);
    R.egal('registre au 05/02/2028 · INPP de décembre · [reste (l’ONEM absorbé), en retard]', [r2(dec27.onem), true], [nombre(ant('INPP', '2027-12')?.solde), ant('INPP', '2027-12')?.enRetard ?? null]);
    R.egal('registre au 05/02/2028 · janvier 2028 · [ONEM, échéance, INPP, échéance]', [r2(jan.onem), '2028-02-15', r2(jan.inpp), '2028-04-30'],
      [nombre(lignesDe(nat, 'ONEM').find((x) => x.mois === '2028-01')?.retenu), lignesDe(nat, 'ONEM').find((x) => x.mois === '2028-01')?.echeance?.slice(0, 10) ?? null,
        nombre(lignesDe(nat, 'INPP').find((x) => x.mois === '2028-01')?.retenu), lignesDe(nat, 'INPP').find((x) => x.mois === '2028-01')?.echeance?.slice(0, 10) ?? null]);
    await reverser4428(n2, '2028-02-10', dec27.onem, 'ONEM de décembre 2027');
    await validerJusqua(c, n2, '2028-02-10');
    const fin = await c.lire('Registre des retenues au 15/02/2028', `/retenues/registre?exerciceId=${n2}&dateReference=2028-02-15`);
    R.egal('registre au 15/02/2028 · aucun mois en retard (janvier échoit ce jour, dépassé demain)', 0, (fin?.natures ?? []).reduce((s, x) => s + (x.moisEnRetard ?? 0), 0));
    R.egal('registre au 15/02/2028 · soldes [IRPP, CNSS, INPP et ONEM] = janvier 2028', [r2(jan.irpp), r2(jan.cnss), r2(jan.onem + jan.inpp)],
      [nombre(natureDu(fin, 'irppSalaires')?.solde), nombre(natureDu(fin, 'cnss')?.solde), nombre(natureDu(fin, 'inppOnem')?.solde)]);
    R.egal('registre au 15/02/2028 · aucun signalement de l’art. 20', [], (fin?.signalementsDeductibilite ?? []).map((x) => x.cle));
    const b = await balance(c, n2);
    for (const compte of ['44720000', '44280000', '43110000', '43120000', '43130000', '42200000', BQ]) {
      R.montant(`balance 2028 au 15/02 · ${compte}`, L.solde(compte), solde(b, compte));
    }
  });
}

// ==============================================================================
// B. RÉGIE PUBLIQUE · ALLOCATIONS FAMILIALES
// ==============================================================================

/**
 * L'EMPLOYEUR PUBLIC · arrêté de 2025, art. 1er · 4 %, sans tranche
 * d'effectif (l'effectif de 400 déclaré donnerait 2 % à un privé).
 */
const PUBLIC = { natureEmployeurInpp: 'PUBLIC', effectif: 400, regimeSalarial: 'BAREME_ARTICLE_118' };

async function regiePublique(R) {
  R.scenario = SCENARIO;
  const c = await nouveauDossier(R, 'Passe paie complément · Régie des marchés de Matadi (fictive)', {
    cle: 'paie2-regie', referentiel: 'SYSCOHADA', systeme: 'NORMAL', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const od = c.od;
  const ctx = {};

  await etape(R, 'Régie · module, registre, conjoint et enfants', async () => {
    await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    const p1 = await c.geste('Salarié LONGO', 'POST', '/personnel/salaries', { nom: 'LONGO', sexe: 'MASCULIN', nationalite: 'congolaise', lieuNaissance: 'Matadi' });
    if (p1) await c.geste('Contrat LONGO', 'POST', `/personnel/salaries/${p1.id}/contrats`, {
      type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2015-03-02', natureTravail: 'Percepteur', classeProfessionnelle: 5, periodiciteRemuneration: 'MOIS', remunerationBase: 1_100_000, deviseRemuneration: 'CDF', lieuExecution: 'Matadi',
    });
    const p2 = await c.geste('Salariée MASIKA (conjoint, quatre enfants)', 'POST', '/personnel/salaries', {
      nom: 'MASIKA', sexe: 'FEMININ', nationalite: 'congolaise', lieuNaissance: 'Boma', nomConjoint: 'LUZOLO Albert',
      enfants: [
        { nom: 'LUZOLO', prenoms: 'Grâce', dateNaissance: '2012-04-10' },
        { nom: 'LUZOLO', prenoms: 'Daniel', dateNaissance: '2015-09-21' },
        { nom: 'LUZOLO', prenoms: 'Ruth', dateNaissance: '2019-02-14' },
        { nom: 'LUZOLO', prenoms: 'Patrick', dateNaissance: '1999-11-03' },
      ],
    });
    const k2 = p2 ? await c.geste('Contrat MASIKA', 'POST', `/personnel/salaries/${p2.id}/contrats`, {
      type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2020-01-06', natureTravail: 'Cheffe de service', classeProfessionnelle: 7, periodiciteRemuneration: 'MOIS', remunerationBase: 1_560_000, deviseRemuneration: 'CDF', lieuExecution: 'Matadi',
    }) : null;
    ctx.p1 = p1; ctx.p2 = p2; ctx.k2 = k2;
  });

  /**
   * JANVIER · LONGO, 1 100 000 · INPP PUBLIC 4 % = 44 000 (et non 2 %, la
   * tranche d'effectif ne joue que pour le privé) ; ONEM 5 500 ; quote-part
   * 55 000 ; 1 045 000 × 12 = 12 540 000 ; 58 320 + 10 596 000 × 15 % =
   * 1 647 720 ; / 12 = 137 310 → 137 300 ; net 907 700.
   */
  await etape(R, 'Régie · janvier · employeur public, passation', async () => {
    const el = [salaire(1_100_000)];
    const b = await c.geste('Bulletin LONGO 2026-01', 'POST', `/personnel/salaries/${ctx.p1?.id}/bulletins`, { moisDePaie: '2026-01', ...PUBLIC, elements: el });
    const a = attendu({ elements: el, tauxInpp: TAUX_INPP_PUBLIC });
    R.egal('2026-01 · bulletin LONGO · [versé, assiette sociale, quote-part ouvrière, IRPP, net]', tupleAttendu(a), tuple(b));
    R.egal('2026-01 · LONGO · INPP public · [taux, cotisation] malgré 400 travailleurs', [4, 44_000], [nombre(ligneCot(b?.calcul, 'inpp')?.tauxPourCent), nombre(ligneCot(b?.calcul, 'inpp')?.montantFc)]);
    await c.geste('Passation de la paie 2026-01', 'POST', '/personnel/paie-du-mois/2026-01/comptabilisation', { exerciceId: n, journalId: od.id, date: '2026-01-31' });
    const bal = await balance(c, n);
    R.egal('balance de janvier · [6415 INPP, 6413 ONEM, 4428]', [44_000, 5_500, -49_500], [solde(bal, '64150000'), solde(bal, '64130000'), solde(bal, '44280000')]);
  });

  /**
   * FÉVRIER · MASIKA, 1 560 000, allocations familiales légales de 70 000
   * pour trois enfants BÉNÉFICIAIRES (fait déclaré du dossier · le quatrième,
   * né en 1999, n'y ouvre plus droit selon le dossier), cinq personnes à
   * charge (art. 124 · le conjoint et les quatre enfants célibataires).
   * Art. 69, 1 · immunisées « dans la mesure où elles ne dépassent pas les
   * taux légaux » · colonne 19 × enfants × jours · 796,30 × 3 × 26 =
   * 62 111,40 · excédent imposable 7 888,60. Hors de l'assiette sociale
   * (art. 7, point 8) · CNSS sur 1 560 000, quote-part 78 000. IRPP ·
   * (1 560 000 + 7 888,60 − 78 000) × 12 = 17 878 663,20 → 17 878 000 ;
   * barème 58 320 + 15 934 000 × 15 % = 2 448 420 ; art. 123 · − 10 % =
   * 2 203 578 ; / 12 = 183 631,50 → 183 600. Net · 1 630 000 − 78 000 −
   * 183 600 = 1 368 400. INPP 4 % = 62 400.
   */
  await etape(R, 'Régie · février · allocations familiales légales', async () => {
    const p2 = ctx.p2;
    const af = (montantFc) => ({ nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations familiales', montantFc });
    const base = { moisDePaie: '2026-02', ...PUBLIC, personnesACharge: 5 };
    const sansEnfants = await c.geste('Simulation · allocations sans enfants bénéficiaires', 'POST', `/personnel/simulation?salarieId=${p2?.id}`, { ...base, elements: [salaire(1_560_000), af(70_000)] });
    R.egal('sans enfants bénéficiaires · abstention nommée, assiette fiscale et IRPP non chiffrés', ['TAUX_LEGAL_ALLOCATIONS_FAMILIALES_NON_FOURNI', null, null],
      [sansEnfants?.assiettes?.abstentions?.[0]?.motif ?? null, lu(sansEnfants?.assiettes?.assietteFiscaleNetteFc), lu(sansEnfants?.net?.irppFc)]);
    R.egal('l’abstention renvoie à un identifiant interne (« voir RESOLUTION_TAUX_LEGAL_ALLOCATIONS ») qu’aucune réponse ne sert', false,
      Boolean(sansEnfants?.assiettes?.abstentions?.[0]?.explication?.includes('RESOLUTION_TAUX_LEGAL_ALLOCATIONS')));
    R.egal('sans enfants bénéficiaires · l’assiette sociale reste chiffrée (l’abstention fiscale n’emporte pas la sociale)', 1_560_000, nombre(sansEnfants?.assiettes?.assietteSocialeFc));
    await refusAttendu(c, R, 'Bulletin de MASIKA aux allocations sans enfants bénéficiaires', 'POST', `/personnel/salaries/${p2?.id}/bulletins`, { ...base, elements: [salaire(1_560_000), af(70_000)] }, [400]);
    const plein = await c.geste('Simulation · allocations au taux légal exact', 'POST', `/personnel/simulation?salarieId=${p2?.id}`, { ...base, enfantsBeneficiairesAllocations: 3, elements: [salaire(1_560_000), af(62_111.4)] });
    const sortPlein = (plein?.assiettes?.sortsFiscaux ?? []).find((x) => x.libelle === 'Allocations familiales') ?? null;
    R.montant('allocations égales au taux légal · taux journalier de la colonne 19', COLONNE_19, plein?.tauxJournalierAllocationsFamilialesFc);
    R.montant('allocations égales au taux légal · plafond (796,30 × 3 × 26)', 62_111.4, plein?.tauxLegalAllocationsFamilialesFc);
    R.montant('allocations égales au taux légal · part imposable', 0, sortPlein?.imposableFc);
    R.egal('allocations égales au taux légal · le motif dit « entièrement immunisée »', true, Boolean(sortPlein?.motif?.includes('entièrement immunisée')));
    if (!sortPlein?.motif?.includes('entièrement immunisée')) R.note(`motif lu · ${sortPlein?.motif ?? 'absent'} · part imposable brute ${sortPlein?.imposableFc}`);
    R.egal('proposition des personnes à charge · conjoint et quatre enfants du registre (art. 124)', 5, nombre(plein?.propositionPersonnesACharge));
    // Mention 28 · vingt jours ouvrant droit · 796,30 × 3 × 20 = 47 778 · 62 111,40 − 47 778 = 14 333,40 imposables.
    const vingt = await c.geste('Simulation · vingt jours ouvrant droit', 'POST', `/personnel/simulation?salarieId=${p2?.id}`, { ...base, enfantsBeneficiairesAllocations: 3, joursAllocationsFamiliales: 20, elements: [salaire(1_560_000), af(62_111.4)] });
    R.montant('vingt jours ouvrant droit · plafond (796,30 × 3 × 20)', 47_778, vingt?.tauxLegalAllocationsFamilialesFc);
    R.montant('vingt jours ouvrant droit · part imposable', 14_333.4, (vingt?.assiettes?.sortsFiscaux ?? []).find((x) => x.libelle === 'Allocations familiales')?.imposableFc);
    const el = [salaire(1_560_000), af(70_000)];
    const b = await c.geste('Bulletin MASIKA 2026-02', 'POST', `/personnel/salaries/${p2?.id}/bulletins`, { ...base, enfantsBeneficiairesAllocations: 3, elements: el });
    const a = attendu({ elements: el, tauxInpp: TAUX_INPP_PUBLIC, personnesACharge: 5, tauxLegalAf: 3 * COLONNE_19 * JOURS_MOIS });
    R.egal('2026-02 · bulletin MASIKA · [versé, assiette sociale, quote-part ouvrière, IRPP, net]', tupleAttendu(a), tuple(b));
    R.montant('2026-02 · MASIKA · part imposable des allocations', 7_888.6, (b?.calcul?.assiettes?.sortsFiscaux ?? []).find((x) => x.libelle === 'Allocations familiales')?.imposableFc);
    await c.geste('Bulletin LONGO 2026-02', 'POST', `/personnel/salaries/${ctx.p1?.id}/bulletins`, { moisDePaie: '2026-02', ...PUBLIC, elements: [salaire(1_100_000)] });
    // P3 · LES ALLOCATIONS FAMILIALES N'ONT PAS DE COMPTE · aucune fiche du
    // compte 66 ne le nomme · la passation du mois est REFUSÉE, nommée, et
    // LONGO n'est pas passé non plus (« un bulletin refusé arrête le mois »).
    const prop = await c.lire('Proposition de la paie de février', '/personnel/paie-du-mois/2026-02');
    const refus = (prop?.refus ?? []).map((r) => r.nomComplet);
    R.egal('février · proposition · le seul bulletin refusé est celui de MASIKA', ['MASIKA'], refus);
    const motif = JSON.stringify(prop?.refus ?? []);
    R.egal('février · le refus dit les deux débiteurs (colonne 19 due par l’employeur, 8 100 FC de la Caisse)', [true, true], [motif.includes('colonne 19'), motif.includes('8 100 FC')]);
    await refusAttendu(c, R, 'Passation de la paie de février (allocations familiales sans compte)', 'POST', '/personnel/paie-du-mois/2026-02/comptabilisation', { exerciceId: n, journalId: od.id, date: '2026-02-28' }, [400], 'MASIKA');
  });

  /**
   * MARS · LICENCIEMENT DE MASIKA (entrée le 06/01/2020), notifié le lundi
   * 02/03/2026 · six années · art. 64 · 14 + 42 = 56 jours ouvrables du
   * 03/03 au 08/05/2026 (lundi de Pâques fixe du 6 avril et 1er mai, fériés,
   * exclus) · dispense par l'employeur · au mois, deux mois entiers (03/03 →
   * 02/04, → 02/05) + 5 jours payables (4 au 8 mai) × 1 560 000 / 26 · 3 120 000
   * + 300 000 = 3 420 000. Congé · deux mois entiers + une tranche de cinq ans
   * · 3 × 60 000 = 180 000. Arriérés · le 2 mars, 60 000. Allocations
   * familiales (art. 66, 142, hors du brut) · 3 enfants × 26 jours × 796,30 =
   * 62 111,40. Total · 3 722 111,40. Bulletin · assiette 3 660 000 ;
   * quote-part 183 000 ; allocations immunisées en entier (le taux légal est
   * leur montant) ; 3 477 000 × 12 = 41 724 000 ; barème 58 320 + 2 948 400 +
   * 20 124 000 × 30 % = 9 043 920 ; − 10 % = 8 139 528 ; / 12 = 678 294 →
   * 678 300 ; net 3 722 111,40 − 183 000 − 678 300 = 2 860 811,40.
   */
  await etape(R, 'Régie · mars · décompte final portant des allocations familiales', async () => {
    const p2 = ctx.p2;
    const faits = {
      anneesAnciennete: 6, moisNonCouvertsParUnConge: 2, initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', typeContrat: 'DUREE_INDETERMINEE',
      dateNotification: '2026-03-02', executionPreavis: 'DISPENSE_PAR_EMPLOYEUR', remunerationJournaliereFc: 60_000, remunerationMensuelleFc: 1_560_000,
      moyenneMensuelleArticle66Fc: 0, moyenneMensuelleArticle142Fc: 0, avantagesPendantPreavisFc: 0, gratificationFc: 0, arrieresFc: 60_000,
      enfantsBeneficiairesAllocations: 3, joursAllocationsFamiliales: 26, moisDeCessation: '2026-03',
    };
    const calc = await c.geste('Décompte final de MASIKA (calcul)', 'POST', '/personnel/decompte-final', faits);
    R.montant('MASIKA · préavis (jours ouvrables)', 56, calc?.preavis?.joursOuvrables);
    R.montant('MASIKA · indemnité de préavis (deux mois entiers et cinq jours)', 3_420_000, rubrique(calc, 'preavis')?.montantFc);
    R.montant('MASIKA · indemnité compensatrice de congé', 180_000, rubrique(calc, 'conge')?.montantFc);
    R.montant('MASIKA · allocations familiales hors du brut (colonne 19)', 62_111.4, (calc?.horsBrut ?? []).find((x) => x.cle === 'allocations-familiales')?.montantFc);
    R.montant('MASIKA · total dû à la travailleuse', 3_722_111.4, calc?.totalDuAuTravailleurFc);
    await c.geste('Fin du contrat de MASIKA', 'POST', `/personnel/contrats/${ctx.k2?.id}/fin`, { dateFin: '2026-03-02', motifFin: 'Licenciement, préavis dispensé par l’employeur' });
    // Un taux légal déclaré à côté des allocations du décompte · refusé (le décompte le pose).
    await refusAttendu(c, R, 'Décompte de MASIKA avec un taux légal des allocations déclaré', 'POST', `/personnel/salaries/${p2?.id}/decompte-final`, {
      decompte: faits, paie: { moisDePaie: '2026-03', ...PUBLIC, personnesACharge: 5, tauxLegalAllocationsFamilialesFc: 50_000, elements: [salaire(60_000, 'Salaire du 2 mars')] },
    }, [400], 'taux légal');
    const b = await c.geste('Décompte final de MASIKA (émission)', 'POST', `/personnel/salaries/${p2?.id}/decompte-final`, {
      decompte: faits, paie: { moisDePaie: '2026-03', ...PUBLIC, personnesACharge: 5, elements: [salaire(60_000, 'Salaire du 2 mars')] },
    });
    const el = [salaire(60_000), { nature: 'INDEMNITE_DE_FIN_DE_CONTRAT', montantFc: 3_420_000 }, { nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', montantFc: 180_000 }, { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', montantFc: 62_111.4 }];
    const a = attendu({ elements: el, tauxInpp: TAUX_INPP_PUBLIC, personnesACharge: 5, tauxLegalAf: 62_111.4 });
    R.egal('2026-03 · décompte MASIKA · [versé, assiette sociale, quote-part ouvrière, IRPP, net]', tupleAttendu(a), tuple(b));
    R.egal('décompte MASIKA · avertissement · les allocations ne passeront pas au journal', true,
      (b?.avertissements ?? []).some((x) => x.startsWith('ALLOCATIONS_FAMILIALES_LEGALES · CE DOCUMENT NE PASSERA PAS AU JOURNAL')));
    R.montant('décompte MASIKA · INPP public 4 % de 3 660 000', 146_400, ligneCot(b?.calcul, 'inpp')?.montantFc);
    await c.geste('Bulletin LONGO 2026-03', 'POST', `/personnel/salaries/${ctx.p1?.id}/bulletins`, { moisDePaie: '2026-03', ...PUBLIC, elements: [salaire(1_100_000)] });
    await refusAttendu(c, R, 'Passation de la paie de mars (décompte portant des allocations familiales)', 'POST', '/personnel/paie-du-mois/2026-03/comptabilisation', { exerciceId: n, journalId: od.id, date: '2026-03-31' }, [400], 'colonne 19');
  });
}

// ==============================================================================
// C. ASSOCIATION SYCEBNL · LA RETRAITE AU 4321
// ==============================================================================

/**
 * L'ASSOCIATION · KABONGO (classe 5, 1 100 000 ≥ 38 270 × 26 = 995 020) et
 * SAFI (classe 2, 700 000 ≥ 648 440). Masse 1 800 000 par mois · CNSS 18 % =
 * 324 000 (dont pensions 10 % = 180 000 au 43210000, SYCEBNL Partie 2 ·
 * « 4321 · obligatoire ») ; INPP 3,5 % = 63 000 ; ONEM 9 000 ; IRPP ·
 * KABONGO 137 300 (1 045 000 × 12 = 12 540 000 → 1 647 720 / 12 = 137 310 →
 * 137 300), SAFI 80 300 (665 000 × 12 = 7 980 000 ; 58 320 + 6 036 000 ×
 * 15 % = 963 720 ; / 12 = 80 310 → 80 300).
 */
async function association(R) {
  R.scenario = SCENARIO;
  const c = await nouveauDossier(R, 'Passe paie complément · Maraîchers de Kimpese (association fictive)', {
    cle: 'paie2-asso', referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const L = new LivreAttendu('43210000');
  const cum = cumulateur();
  const sal = {};
  const ASSO = { natureEmployeurInpp: 'PRIVE', effectif: 2, regimeSalarial: 'BAREME_ARTICLE_118' };
  const personnel = { A1: ['KABONGO', 'MASCULIN', 5, 1_100_000], A2: ['SAFI', 'FEMININ', 2, 700_000] };

  await etape(R, 'Association · module, dotation, registre', async () => {
    await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    await ecriture(c, 'Dotation en numéraire', n, '2026-01-01', 'Dotation initiale', [[BQ, 60_000_000, 0], ['10110000', 0, 60_000_000]], { journal: bq });
    L.add(BQ, 60_000_000, 0);
    // SYCEBNL · le 431 n'ouvre AUCUN 4313 (P0, P3) · la retraite obligatoire est au 4321.
    R.egal('plan SYCEBNL · [43130000 absent, 43210000 ouvert]', [false, true], [c.comptes.has('43130000'), c.comptes.has('43210000')]);
    for (const [cle, [nom, sexe, classe, mensuel]] of Object.entries(personnel)) {
      const s = await c.geste(`Salarié ${nom}`, 'POST', '/personnel/salaries', { nom, sexe, nationalite: 'congolaise', lieuNaissance: 'Kimpese' });
      if (!s) continue;
      await c.geste(`Contrat ${nom}`, 'POST', `/personnel/salaries/${s.id}/contrats`, {
        type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2024-01-02', natureTravail: cle === 'A1' ? 'Coordinateur' : 'Animatrice', classeProfessionnelle: classe,
        periodiciteRemuneration: 'MOIS', remunerationBase: mensuel, deviseRemuneration: 'CDF', lieuExecution: 'Kimpese',
      });
      sal[cle] = { id: s.id, nom, mensuel };
    }
  });

  for (let m = 1; m <= 12; m += 1) {
    const mois = moisDe(2026, m);
    const prec = m > 1 ? moisDe(2026, m - 1) : null;
    await etape(R, `Association · paie de ${mois}`, async () => {
      if (prec) {
        const x = cum.get(prec);
        await ecriture(c, `Reversement CNSS ${prec}`, n, `${mois}-14`, `CNSS ${prec}`, [['43110000', r2(x.pf), 0], ['43120000', r2(x.rp), 0], ['43210000', r2(x.pension), 0], [BQ, 0, r2(x.cnss)]], { journal: bq });
        L.add('43110000', x.pf, 0); L.add('43120000', x.rp, 0); L.add('43210000', x.pension, 0); L.add(BQ, 0, x.cnss);
        await ecriture(c, `Reversement ONEM ${prec}`, n, `${mois}-14`, `ONEM ${prec}`, [['44280000', r2(x.onem), 0], [BQ, 0, r2(x.onem)]], { journal: bq });
        L.add('44280000', x.onem, 0); L.add(BQ, 0, x.onem);
        await ecriture(c, `Reversement IRPP ${prec}`, n, `${mois}-14`, `IRPP ${prec}`, [['44720000', r2(x.irpp), 0], [BQ, 0, r2(x.irpp)]], { journal: bq });
        L.add('44720000', x.irpp, 0); L.add(BQ, 0, x.irpp);
      }
      const trimestre = { '2026-04': ['2026-01', '2026-02', '2026-03'], '2026-07': ['2026-04', '2026-05', '2026-06'], '2026-10': ['2026-07', '2026-08', '2026-09'] }[mois];
      if (trimestre) {
        const inpp = trimestre.reduce((s, x) => s + cum.get(x).inpp, 0);
        await ecriture(c, `Reversement INPP ${trimestre[0]} à ${trimestre[2]}`, n, `${mois}-28`, 'INPP du trimestre', [['44280000', r2(inpp), 0], [BQ, 0, r2(inpp)]], { journal: bq });
        L.add('44280000', inpp, 0); L.add(BQ, 0, inpp);
      }
      const actifs = [];
      for (const s of Object.values(sal)) {
        const el = [salaire(s.mensuel)];
        const b = await c.geste(`Bulletin ${s.nom} ${mois}`, 'POST', `/personnel/salaries/${s.id}/bulletins`, { moisDePaie: mois, ...ASSO, elements: el });
        const a = attendu({ elements: el });
        if (!b) continue;
        R.egal(`${mois} · bulletin ${s.nom} · [versé, assiette sociale, quote-part ouvrière, IRPP, net]`, tupleAttendu(a), tuple(b));
        actifs.push({ a, b });
      }
      if (mois === '2026-01') {
        // P3 · LA RETRAITE OBLIGATOIRE AU 43210000 · jamais le 432 (total),
        // le 4322 (complémentaire) ni le 4313 (SYSCOHADA, absent du plan).
        const prop = await c.lire('Proposition de la paie de janvier', '/personnel/paie-du-mois/2026-01');
        const parCompte = (num) => (prop?.lignes ?? []).filter((l) => l.compte === num).reduce((s, l) => s + Number(l.montantFc), 0);
        R.montant('janvier · pensions (5 % + 5 % de 1 800 000) au 43210000', 180_000, parCompte('43210000'));
        R.egal('janvier · aucune ligne au 4313, au 432 total ni au 4322', [], (prop?.lignes ?? []).map((l) => l.compte).filter((x) => /^(4313|432$|4320|4322)/.test(x)));
        R.egal('janvier · [6415 INPP, 6413 ONEM, 4428]', [63_000, 9_000, 72_000], [parCompte('64150000'), parCompte('64130000'), parCompte('44280000')]);
      }
      const p = await c.geste(`Passation de la paie ${mois}`, 'POST', `/personnel/paie-du-mois/${mois}/comptabilisation`, { exerciceId: n, journalId: od.id, date: finDeMois(mois) });
      let nets = 0;
      for (const x of actifs) { L.passer(x.a); cum.ajouter(mois, x.a); nets += x.a.net; }
      if (p) {
        await ecriture(c, `Paiement des nets ${mois}`, n, finDeMois(mois), `Salaires nets ${mois}`, [['42200000', r2(nets), 0], [BQ, 0, r2(nets)]], { journal: bq });
        L.add('42200000', nets, 0); L.add(BQ, 0, nets);
      }
      await validerJusqua(c, n, finDeMois(mois));
    });
  }

  await etape(R, 'Association · registre et balance de 2026', async () => {
    const reg = await c.lire('Registre des retenues au 31/12/2026', `/retenues/registre?exerciceId=${n}&dateReference=2026-12-31`);
    const cnss = natureDu(reg, 'cnss');
    R.egal('association · la nature CNSS lit le 43210000', true, (cnss?.comptes ?? []).some((x) => x.numero === '43210000'));
    R.montant('association · CNSS due au 31/12 (décembre, 18 % de 1 800 000)', 324_000, cnss?.solde);
    R.egal('association · CNSS · mois restant dus (décembre seul)', ['2026-12'], lignesDe(cnss).filter((x) => Math.abs(x.solde) > 0.005).map((x) => x.mois));
    R.montant('association · IRPP dû au 31/12', cum.get('2026-12').irpp, natureDu(reg, 'irppSalaires')?.solde);
    const q4 = ['2026-10', '2026-11', '2026-12'].reduce((s, x) => s + cum.get(x).inpp, 0);
    R.montant('association · INPP et ONEM dus au 31/12', cum.get('2026-12').onem + q4, natureDu(reg, 'inppOnem')?.solde);
    const b = await balance(c, n);
    for (const compte of ['66110000', '66410000', '64150000', '64130000', '42200000', '43110000', '43120000', '43210000', '44720000', '44280000', BQ]) {
      R.montant(`association · balance 2026 · ${compte}`, L.solde(compte), solde(b, compte));
    }
    R.montant('association · balance 2026 · aucun mouvement au 4313', 0, solde(b, '4313'));
  });

  const clos = await etape(R, 'Association · clôture de 2026', () => cloturer(c, '2026'));
  R.egal('association · clôture de 2026', true, Boolean(clos));
  const n1 = c.exercices.get('2027')?.id;
  if (!n1) { R.note('Association · exercice 2027 absent après la clôture'); return; }
  await etape(R, 'Association · à-nouveau et registre de 2027', async () => {
    const b = await balance(c, n1);
    R.montant('association · à-nouveau 2027 · pensions de décembre au 43210000', -cum.get('2026-12').pension, solde(b, '43210000'));
    R.montant('association · à-nouveau 2027 · CNSS (431 et 4321)', -cum.get('2026-12').cnss, solde(b, '431') + solde(b, '43210000'));
    const reg = await c.lire('Registre des retenues 2027 à l’ouverture', `/retenues/registre?exerciceId=${n1}&dateReference=2027-01-02`);
    R.montant('association · registre 2027 · CNSS · solde d’ouverture', 324_000, natureDu(reg, 'cnss')?.soldeOuverture);
    R.montant('association · registre 2027 · IRPP · solde d’ouverture', cum.get('2026-12').irpp, natureDu(reg, 'irppSalaires')?.soldeOuverture);
  });
}

export default async function (R) {
  await sarl(R);
  await regiePublique(R);
  await association(R);
}
