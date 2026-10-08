/**
 * SCÉNARIO « IMMOBILISATIONS, COMPLÉMENT » (lot K) · tout ce que le scénario
 * « immobilisations » (lot F) n'a pas joué, sur 2026 (N) et 2027 (N+1),
 * clôtures comprises, dans les deux référentiels.
 *
 * Cinq dossiers, parce que la réévaluation est GLOBALE (AUDCIF art. 62 ;
 * loi n° 23/053, art. 130) · un dossier qui réévalue doit réévaluer tout son
 * périmètre, d'où une société à part pour la réévaluation libre.
 *
 *  1. SYSCOHADA normal · « Complément · Transports et Mines du Kasaï SARL » ·
 *     deux crédits-bails mobiliers (option levée en 2027, option NON levée en
 *     2027), démantèlement (provision à l'actif et au passif, désactualisation,
 *     reprise à la cession du sous-jacent), échange d'un véhicule, pièces de
 *     sécurité et de rechange, partie non identifiée détachée puis renouvelée,
 *     fonds de commerce à prix global avec stocks, matériel récupéré au 388,
 *     réserve de propriété au 4816, nature et pièce de chaque sortie.
 *  1 bis. SYSCOHADA normal · « Complément · Station-service de Kolwezi SARL » ·
 *     fonds commercial à durée LIMITÉE (adossé à une concession) acquis par
 *     le même geste de prix global, et sa dotation.
 *  2. SYSCOHADA normal · « Complément · Brasserie du Tanganyika SARL » ·
 *     réévaluation LIBRE · méthode 2 (élimination des amortissements) en 2026,
 *     méthode 1 (ajustement) en 2027, encadré de la note 3E, tableau relu tel
 *     qu'il était, part de l'annuité due à la réévaluation, déclaration
 *     spéciale, sortie d'un terrain réévalué vers une réserve choisie.
 *  3. SYCEBNL associations · « Complément · Association Lumière du Kasaï » ·
 *     crédit-bail mobilier au 187, démantèlement, réévaluation libre (1061x
 *     et 1062x selon le droit de reprise), note 5H, réserve de propriété au
 *     48162, véhicule en cours au 2495 puis mis en service, matériel récupéré
 *     au 378, écart vers le 118 imposé.
 *  4. SYCEBNL projets de développement · « Complément · Projet Eau Potable
 *     Kananga » · les six issues de la fin de projet (SYCEBNL Partie 3 ch. 3
 *     § 2.5), pompe en cours au 2491 puis mise en service.
 *
 * TOUS LES ATTENDUS SONT CALCULÉS À LA MAIN depuis le texte et les données du
 * banc, le calcul écrit à côté du contrôle. Conventions lues aux sources ·
 * annuité linéaire = base / durée, première annuité au prorata des mois « à
 * compter du premier jour du mois de mise en service » (loi n° 23/053,
 * art. 30 et 34), mois de sortie compris (fiche du compte 81 ; Guide,
 * Application 16, « 180 × 9/12 »). Montants arrondis au centime à chaque pas.
 */
import { aplatir, auCentime, balance, compte, ecriture, etape, nouveauDossier, rechargerComptes, rechargerExercices, solde, validerJusqua } from './lib.mjs';

const BQ = '52110000';

// --- Outils du scénario (repris du lot F, sans y toucher) ---------------------

/** Ouverture au 1er janvier 2026 · la banque contre le capital (ou la dotation de l'association). */
async function ouverture(c, n, capital, montant) {
  const csv = ['Compte;Intitule;Debit;Credit', `${BQ};Banque;${montant};0`, `${capital};Capital;0;${montant}`].join('\n');
  await c.geste('Import du bilan d’ouverture', 'POST', '/import/executer', {
    type: 'BALANCE', nomFichier: 'ouverture-2026.csv', contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
    mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
    exerciceId: n, dateOperation: '2026-01-01', bilanDOuverture: true, separateur: ';',
  });
  await validerJusqua(c, n, '2026-01-01');
}

/** Un bien par le module, financé par la banque sauf contrepartie donnée. */
function bien(c, geste, n, journal, champs) {
  const { compte: numero, contrepartie = BQ, ...reste } = champs;
  return c.geste(geste, 'POST', '/immobilisations', {
    compteImmobilisationId: compte(c, numero), modeAmortissement: 'LINEAIRE',
    compteContrepartieId: compte(c, contrepartie), exerciceId: n, journalId: journal.id, ...reste,
  });
}

/** Le corps d'un bien, sans le poster · pour les refus. */
function corpsBien(c, n, journal, champs) {
  const { compte: numero, contrepartie = BQ, ...reste } = champs;
  return {
    compteImmobilisationId: compte(c, numero), modeAmortissement: 'LINEAIRE',
    compteContrepartieId: compte(c, contrepartie), exerciceId: n, journalId: journal.id, ...reste,
  };
}

/** La dotation d'un bien, et son montant confronté à l'attendu calculé à la main. */
async function doter(c, R, an, cle, im, exerciceId, attendu) {
  if (!im) return R.note(`${an} · ${cle} · bien absent, dotation non passée`);
  const d = await c.geste(`Dotation ${an} · ${cle}`, 'POST', `/immobilisations/${im.id}/dotation`, { exerciceId, journalId: c.od.id });
  if (attendu !== undefined) R.montant(`${an} · ${cle} · dotation de l’exercice`, attendu, d?.montant);
  return d;
}

/** Un refus attendu · le geste est joué tel quel, le statut et le motif sont relus. */
async function refus(c, R, libelle, methode, chemin, corps, motif) {
  const r = await c.req(methode, chemin, corps);
  R.egal(`${libelle} · refusé`, true, r.statut >= 400 && r.statut < 500);
  if (motif) {
    const texte = JSON.stringify(r.corps ?? '');
    R.egal(`${libelle} · motif`, true, motif.test(texte));
    if (!motif.test(texte)) R.note(`${libelle} · corps lu (statut ${r.statut}) · ${texte.slice(0, 400)}`);
  }
  return r;
}

/** La ligne d'une note dont le libellé correspond (par défaut « TOTAL GÉNÉRAL »). */
function ligneDeNote(notes, code, motif = /TOTAL G[EÉ]N[EÉ]RAL/i) {
  return (notes?.notes ?? []).filter((x) => x.code === code).flatMap((x) => x.lignes ?? []).find((l) => motif.test(l.libelle ?? ''));
}

/** La ligne d'un bien au tableau des amortissements de l'exercice. */
function ligneTableau(t, id) {
  return (t?.groupes ?? []).flatMap((g) => g.lignes ?? []).find((l) => l.id === id);
}

/** Les contrôles d'immobilisations qui ne doivent PAS se lever · tout passe par le module. */
async function controles(c, R, libelle, exerciceId, { leves: attendus = [], nonLeves = [] } = {}) {
  const rapport = await c.lire(`Contrôles ${libelle}`, `/controles?exerciceId=${exerciceId}`);
  if (!rapport) return new Set();
  const leves = new Set((rapport.anomalies ?? []).map((a) => a.code));
  for (const code of ['AMORTISSEMENT_IMMO_HORS_MODULE', 'DEPRECIATION_IMMO_HORS_MODULE', 'REEVALUATION_IMMO_HORS_MODULE', ...nonLeves]) {
    R.egal(`${libelle} · contrôle ${code} non levé`, false, leves.has(code));
    if (leves.has(code)) {
      const a = rapport.anomalies.find((x) => x.code === code);
      R.note(`${libelle} · ${code} · ${(a.occurrences ?? []).slice(0, 5).map((o) => `${o.reference ?? ''} ${o.detail ?? ''}`).join(' | ')}`);
    }
  }
  for (const code of attendus) R.egal(`${libelle} · contrôle ${code} levé`, true, leves.has(code));
  R.note(`${libelle} · contrôles levés · ${[...leves].sort().join(', ')}`);
  return leves;
}

/** Les soldes attendus d'une balance · { racine: solde débit moins crédit }. */
function soldes(R, an, b, attendus) {
  R.montant(`${an} · balance équilibrée`, 0, b ? b.totalDebit - b.totalCredit : null);
  for (const [racine, m] of Object.entries(attendus)) R.montant(`${an} · solde ${racine}`, m, solde(b, racine));
}

/** Les écritures d'une pièce (même référence), relues au journal de l'exercice. */
async function ecrituresDeLaPiece(c, exerciceId, reference) {
  const r = await c.lire(`Écritures de la pièce ${reference}`, `/ecritures?exerciceId=${exerciceId}&reference=${encodeURIComponent(reference)}`);
  return (r?.ecritures ?? []).filter((e) => e.reference === reference);
}

/** Le solde (débit moins crédit) par compte d'une liste d'écritures. */
function parCompte(c, ecritures) {
  const numeroDe = new Map((c.plan ?? []).map((x) => [x.id, x.numero]));
  const m = {};
  for (const e of ecritures) {
    for (const l of e.lignes ?? []) {
      const num = l.compte?.numero ?? numeroDe.get(l.compteId) ?? '?';
      m[num] = auCentime((m[num] ?? 0) + Number(l.debit ?? 0) - Number(l.credit ?? 0));
    }
  }
  return m;
}

/** Somme d'une racine dans un relevé par compte. */
const racine = (m, r) => auCentime(Object.entries(m).filter(([k]) => k.startsWith(r)).reduce((t, [, v]) => t + v, 0));

/** Une sortie, son corps complet · nature et pièce exigées à la route (ligne A14). */
function corpsSortie(c, exerciceId, journal, s) {
  const { contrepartie, fonds, stock, reserve, ...reste } = s;
  return {
    exerciceId, journalId: journal.id, ...reste,
    ...(contrepartie ? { compteContrepartieId: compte(c, contrepartie) } : {}),
    ...(fonds ? { compteFondsProjetId: compte(c, fonds) } : {}),
    ...(stock ? { compteStockRecupereId: compte(c, stock) } : {}),
    ...(reserve ? { compteReserveEcartId: compte(c, reserve) } : {}),
  };
}

/** La clôture d'un contrat de location-acquisition pour un exercice, confrontée à la ventilation calculée à la main. */
async function clotureContrat(c, R, an, cle, contrat, exerciceId, journal, att) {
  if (!contrat) return R.note(`${an} · ${cle} · contrat absent, clôture non passée`);
  const chemin = `/immobilisations/location-acquisition/contrats/${contrat.id}/cloture`;
  const p = await c.lire(`Proposition de clôture ${an} · ${cle}`, `${chemin}?exerciceId=${exerciceId}`);
  if (att.extourne !== undefined) R.montant(`${an} · ${cle} · extourne des courus de l’exercice précédent`, att.extourne, p?.extourne);
  R.egal(`${an} · ${cle} · proposition sans refus`, [], p?.refus ?? null);
  const r = await c.geste(`Clôture ${an} du contrat ${cle}`, 'POST', chemin, { exerciceId, journalId: journal.id });
  R.montant(`${an} · ${cle} · loyers échus virés du 623`, att.loyers, r?.loyers);
  R.montant(`${an} · ${cle} · part de capital (débit 17)`, att.capital, r?.capital);
  R.montant(`${an} · ${cle} · part d’intérêts (débit 672)`, att.interets, r?.interets);
  R.montant(`${an} · ${cle} · intérêts courus (672 / 176)`, att.courus, r?.interetsCourus);
  return r;
}

/** Les contrats du dossier, retrouvés par le bien qu'ils portent. */
async function contratsDuDossier(c, exerciceId) {
  const l = await c.lire('Contrats de location-acquisition', `/immobilisations/location-acquisition/contrats?exerciceId=${exerciceId}`);
  return Array.isArray(l) ? l : [];
}

export default async function scenarioImmobilisationsComplement(registre) {
  await transports(registre);
  await stationService(registre);
  await brasserie(registre);
  await association(registre);
  await projet(registre);
}

// =============================================================================
// 1 · TRANSPORTS ET MINES DU KASAÏ SARL (SYSCOHADA normal)
// =============================================================================
async function transports(R) {
  R.scenario = 'Immobilisations complément · SYSCOHADA transports';
  const c = await nouveauDossier(R, 'Complément · Transports et Mines du Kasaï SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'immo2-tr', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const b = {};
  const k = {}; // contrats

  await etape(R, 'Paramètres et ouverture', async () => {
    await c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await ouverture(c, n, '10130000', 800_000_000);
  });

  // ---------------------------------------------------------------------------
  // 1. LOCATION-ACQUISITION (AUDCIF Titre VIII ch. 8)
  // ---------------------------------------------------------------------------
  // Taux implicite annuel 10,25 %, loyers SEMESTRIELS · le taux périodique est
  // (1,1025)^(6/12) − 1 = 5 % exactement (convention du taux équivalent, dite
  // par le logiciel ; le § 2.1.3 ne dit pas comment lire un taux annuel sur
  // des loyers semestriels, et 5 % est aussi le taux proportionnel arrondi).
  //
  // CONTRAT A · chargeuse, 18 mois, 3 loyers échus de 10 000 000 au 1/7/2026,
  // 1/1/2027, 1/7/2027, option P = 1 000 000 au terme (t = 3).
  // Dette (§ 2.1.3) = 10 000 000 × (1/1,05 + 1/1,05² + 1/1,05³) + 1 000 000 / 1,05³
  //   = 10 000 000 × 2,723248029 + 863 837,60 = 27 232 480,29 + 863 837,60 = 28 096 317,89.
  // Échéancier au coût amorti (§ 2.1.4, exemple 520 000 × 7,86 %) ·
  //   L1 · intérêts 28 096 317,89 × 5 % = 1 404 815,89, capital 8 595 184,11, reste 19 501 133,78 ;
  //   L2 · intérêts 975 056,69, capital 9 024 943,31, reste 10 476 190,47 ;
  //   L3 · intérêts 523 809,52, capital 9 476 190,48, reste 999 999,99 ;
  //   option · capital 999 999,99 (le reste), intérêts 0,01.
  // Coût du bien (§ 2.1.5) = dette + coûts directs 500 000 − avantages reçus
  //   100 000 = 28 496 317,89 (« 520 000 + 25 000 − 5 000 = 540 000 »).
  //
  // CONTRAT B · camion-citerne, mêmes termes, loyer 4 000 000, option 500 000 ·
  // dette = 4 000 000 × 2,723248029 + 500 000 / 1,05³ = 10 892 992,12 + 431 918,80 = 11 324 910,92 ;
  //   L1 · 566 245,55 / 3 433 754,45, reste 7 891 156,47 ; L2 · 394 557,82 /
  //   3 605 442,18, reste 4 285 714,29 ; L3 · 214 285,71 / 3 785 714,29, reste
  //   500 000,00 ; option · capital 500 000,00.
  const contratA = (extra = {}) => ({
    compteImmobilisationId: compte(c, '24160000'), nature: 'CREDIT_BAIL_MOBILIER', datePriseEffet: '2026-01-01', dureeMois: 18,
    periodicite: 'SEMESTRIELLE', termeAEchoir: false, loyer: 10_000_000, prixOption: 1_000_000, tauxAnnuel: 0.1025,
    optionRaisonnablementCertaine: true, bienDeFaibleValeur: false, designation: 'Chargeuse sur pneus CAT 950', dureeAmortissementAns: 5,
    reference: 'CB-2026-01', dateConclusion: '2025-12-15', coutsDirects: 500_000, avantagesRecus: 100_000,
    compteContrepartieCoutsId: compte(c, BQ), exerciceId: n, journalId: bq.id, ...extra,
  });

  await etape(R, '2026 · location-acquisition · refus et entrées', async () => {
    // Location SIMPLE (§ 1.5.2) · douze mois ou moins, levée hypothétique,
    // bien de faible valeur · refusées avec leur motif, jamais au bilan.
    await refus(c, R, 'Contrat de douze mois', 'POST', '/immobilisations/location-acquisition', contratA({ dureeMois: 12 }), /location simple/i);
    await refus(c, R, 'Levée de l’option non raisonnablement certaine', 'POST', '/immobilisations/location-acquisition', contratA({ optionRaisonnablementCertaine: false }), /location simple/i);
    await refus(c, R, 'Bien de faible valeur', 'POST', '/immobilisations/location-acquisition', contratA({ bienDeFaibleValeur: true }), /location simple/i);
    await refus(c, R, 'Taux ET valeur du contrat', 'POST', '/immobilisations/location-acquisition', contratA({ valeurContrat: 28_000_000 }), /l.un des deux/i);
    // § 2.1.7 · le bien entre au sous-compte « de location-acquisition » de sa nature.
    await refus(c, R, 'Crédit-bail mobilier sur le 2411 (compte ordinaire)', 'POST', '/immobilisations/location-acquisition', contratA({ compteImmobilisationId: compte(c, '24110000') }), /location-acquisition/i);
    await refus(c, R, 'Crédit-bail immobilier sur un matériel (2416)', 'POST', '/immobilisations/location-acquisition', contratA({ nature: 'CREDIT_BAIL_IMMOBILIER' }), /immobilier/i);

    // La simulation ne prend que les termes du contrat (DTO de simulation).
    const { designation: _d, dureeAmortissementAns: _a, reference: _r, dateConclusion: _c, coutsDirects: _cd, avantagesRecus: _av,
      compteContrepartieCoutsId: _cc, exerciceId: _e, journalId: _j, ...termes } = contratA();
    const sim = await c.geste('Simulation du contrat A', 'POST', '/immobilisations/location-acquisition/simulation', termes);
    R.montant('Contrat A · simulation · dette (VA des loyers et de l’option)', 28_096_317.89, sim?.dette);

    const a = await c.geste('Entrée du contrat A (crédit-bail mobilier)', 'POST', '/immobilisations/location-acquisition', contratA());
    b.locA = a?.immobilisation;
    const l = a?.echeancier?.lignes ?? [];
    R.montant('Contrat A · dette initiale au 1730', 28_096_317.89, a?.echeancier?.dette);
    R.montant('Contrat A · L1 · intérêts (28 096 317,89 × 5 %)', 1_404_815.89, l[0]?.interets);
    R.montant('Contrat A · L1 · capital', 8_595_184.11, l[0]?.capital);
    R.montant('Contrat A · L2 · intérêts (19 501 133,78 × 5 %)', 975_056.69, l[1]?.interets);
    R.montant('Contrat A · L3 · capital', 9_476_190.48, l[2]?.capital);
    R.montant('Contrat A · option · capital restant dû', 999_999.99, l.find((x) => x.option)?.capital);
    R.egal('Contrat A · option au terme (1er juillet 2027)', '2027-07-01', String(l.find((x) => x.option)?.date ?? '').slice(0, 10));
    R.montant('Contrat A · coût du bien (dette + 500 000 − 100 000)', 28_496_317.89, b.locA?.valeurOrigine);

    const bb = await c.geste('Entrée du contrat B (crédit-bail mobilier)', 'POST', '/immobilisations/location-acquisition', {
      ...contratA({ compteImmobilisationId: compte(c, '24560000'), loyer: 4_000_000, prixOption: 500_000, designation: 'Camion-citerne Mercedes Actros',
        dureeAmortissementAns: 4, reference: 'CB-2026-02', journalId: od.id }),
      coutsDirects: undefined, avantagesRecus: undefined, compteContrepartieCoutsId: undefined,
    });
    b.locB = bb?.immobilisation;
    R.montant('Contrat B · dette initiale', 11_324_910.92, bb?.echeancier?.dette);
    R.montant('Contrat B · coût du bien (la dette seule)', 11_324_910.92, b.locB?.valeurOrigine);
    R.montant('Contrat B · option · capital restant dû', 500_000, (bb?.echeancier?.lignes ?? []).find((x) => x.option)?.capital);

    // L'écriture d'entrée · D 2416 28 496 317,89 / C 1730 28 096 317,89 / C 5211 400 000.
    const entree = parCompte(c, (await c.lire('Écritures 2026', `/ecritures?exerciceId=${n}&recherche=${encodeURIComponent('Chargeuse')}`))?.ecritures ?? []);
    R.montant('Contrat A · entrée · débit du 2416', 28_496_317.89, entree['24160000']);
    R.montant('Contrat A · entrée · crédit du 1730', -28_096_317.89, entree['17300000']);
    R.montant('Contrat A · entrée · coûts nets à la banque', -400_000, entree[BQ]);

    const liste = await contratsDuDossier(c, n);
    k.A = liste.find((x) => x.immobilisationId === b.locA?.id);
    k.B = liste.find((x) => x.immobilisationId === b.locB?.id);
    R.egal('Deux contrats au registre', 2, liste.length);
    // Loyers du premier semestre au 623 (§ 2.1.8.1), par le cabinet.
    await ecriture(c, 'Loyer CB-2026-01 · 1/7/2026', n, '2026-07-01', 'Loyer semestriel CB-2026-01', [['62330000', 10_000_000, 0], [BQ, 0, 10_000_000]], { journal: bq, reference: 'CB-2026-01/1' });
    await ecriture(c, 'Loyer CB-2026-02 · 1/7/2026', n, '2026-07-01', 'Loyer semestriel CB-2026-02', [['62330000', 4_000_000, 0], [BQ, 0, 4_000_000]], { journal: bq, reference: 'CB-2026-02/1' });
  });

  // ---------------------------------------------------------------------------
  // 2. DÉMANTÈLEMENT (AUDCIF Titre VIII ch. 6)
  // ---------------------------------------------------------------------------
  // Exemple du texte · « 10 000 000 dans dix ans à 12 % · 3 219 732 ». Valeur
  // actualisée 10 000 000 × 1,12^-10 = 3 219 732,37 · composant D 2411 / C 1984.
  await etape(R, '2026 · démantèlement', async () => {
    const va = await c.lire('Valeur actualisée proposée', '/immobilisations/demantelement/valeur-actualisee?coutFutur=10000000&tauxPourcent=12&annees=10');
    R.montant('Démantèlement · valeur actualisée (10 000 000 × 1,12^-10)', 3_219_732.37, va?.valeurActualisee);
    b.station = await bien(c, 'Station de traitement de minerai', n, bq, {
      compte: '24110000', designation: 'Station de traitement de Tshikapa', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 100_000_000, dureeAmortissementAns: 10,
    });
    const compo = (extra) => corpsBien(c, n, od, {
      compte: '24110000', contrepartie: '19840000', designation: 'Station · démantèlement et remise en état du site', dateAcquisition: '2026-01-01',
      dateMiseEnService: '2026-01-01', valeurOrigine: 3_219_732.37, dureeAmortissementAns: 10, immobilisationPrincipaleId: b.station?.id,
      typeComposant: 'DEMANTELEMENT', coutFuturDemantelement: 10_000_000, tauxActualisationDemantelementPourcent: 12,
      justificationDecomposition: 'Obligation de remise en état du site minier au terme de la concession (cahier des charges), coût estimé par expertise',
      ...extra,
    });
    // Le coût attendu sans taux, et une provision d'entrée au-delà du coût, sont refusés (§ 2.3).
    await refus(c, R, 'Démantèlement · coût attendu sans taux', 'POST', '/immobilisations', compo({ tauxActualisationDemantelementPourcent: undefined }), /taux/i);
    await refus(c, R, 'Démantèlement · valeur d’entrée au-delà du coût attendu', 'POST', '/immobilisations', compo({ coutFuturDemantelement: 3_000_000 }), /d[ée]passe/i);
    await refus(c, R, 'Démantèlement · paramètres sur un composant ordinaire', 'POST', '/immobilisations', compo({ typeComposant: 'COMPOSANT', contrepartie: undefined, compteContrepartieId: compte(c, BQ) }), /d[ée]mant[eè]lement/i);
    b.demant = await c.geste('Composant démantèlement', 'POST', '/immobilisations', compo());
    R.montant('Démantèlement · composant à l’actif', 3_219_732.37, b.demant?.valeurOrigine);
  });

  // ---------------------------------------------------------------------------
  // 3. ÉCHANGE (préparé), SÉCURITÉ ET RECHANGE, PARTIE NON IDENTIFIÉE (préparée)
  // ---------------------------------------------------------------------------
  await etape(R, '2026 · autres acquisitions', async () => {
    b.pickup = await bien(c, 'Pick-up (à échanger en 2027)', n, bq, {
      compte: '24510000', designation: 'Pick-up Toyota Hilux', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 12_000_000, dureeAmortissementAns: 4,
    });
    b.turbine = await bien(c, 'Turbine hydraulique (principal)', n, bq, {
      compte: '24110000', designation: 'Turbine de la microcentrale', dateAcquisition: '2026-03-01', dateMiseEnService: '2026-03-01',
      valeurOrigine: 30_000_000, dureeAmortissementAns: 10,
    });
    // PIÈCE DE SÉCURITÉ · « l'amortissement doit démarrer dès l'acquisition de
    // l'immobilisation principale » (AUDCIF Titre VIII ch. 14 § 1.2.3) · sa date
    // est le 1er mars 2026 ; une autre date, ou aucune, est refusée.
    const securite = (extra) => corpsBien(c, n, bq, {
      compte: '24110000', designation: 'Turbine · roue de secours (pièce de sécurité)', dateAcquisition: '2026-03-01', dateMiseEnService: '2026-03-01',
      valeurOrigine: 3_000_000, dureeAmortissementAns: 5, immobilisationPrincipaleId: b.turbine?.id, typeComposant: 'PIECE_DE_SECURITE',
      justificationDecomposition: 'Roue de rechange stratégique exigée par le constructeur, détenue pour la sécurité de la production', ...extra,
    });
    await refus(c, R, 'Pièce de sécurité amortie à son intégration (1/6/2026)', 'POST', '/immobilisations', securite({ dateMiseEnService: '2026-06-01' }), /s[ée]curit[ée]/i);
    await refus(c, R, 'Pièce de sécurité sans date de début', 'POST', '/immobilisations', securite({ dateMiseEnService: undefined }), /s[ée]curit[ée]/i);
    b.securite = await c.geste('Pièce de sécurité', 'POST', '/immobilisations', securite());
    // PIÈCE DE RECHANGE · « ne débute qu'à la date d'utilisation de la pièce, au
    // moment où elle est intégrée » (même §) · acquise sans mise en service.
    b.rechange = await c.geste('Pièce de rechange (non intégrée)', 'POST', '/immobilisations', corpsBien(c, n, bq, {
      compte: '24110000', designation: 'Turbine · jeu d’aubes de rechange', dateAcquisition: '2026-03-01', valeurOrigine: 2_400_000,
      dureeAmortissementAns: 4, immobilisationPrincipaleId: b.turbine?.id, typeComposant: 'PIECE_DE_RECHANGE',
      justificationDecomposition: 'Jeu d’aubes destiné au remplacement à l’usure, amorti à son intégration',
    }));
    b.structure = await bien(c, 'Entrepôt (structure)', n, bq, {
      compte: '23110000', designation: 'Entrepôt de Mbuji-Mayi', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 60_000_000, dureeAmortissementAns: 20,
    });
    b.compresseur = await bien(c, 'Compresseur (mis au rebut en 2027)', n, bq, {
      compte: '24110000', designation: 'Compresseur Atlas Copco', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 6_000_000, dureeAmortissementAns: 5,
    });
    b.laptop = await bien(c, 'Ordinateur portable (volé en 2027)', n, bq, {
      compte: '24420000', designation: 'Ordinateur portable du directeur', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 1_200_000, dureeAmortissementAns: 3,
    });
    b.clim = await bien(c, 'Climatiseur (détruit en 2027)', n, bq, {
      compte: '24410000', designation: 'Climatiseur de la salle des serveurs', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 900_000, dureeAmortissementAns: 3,
    });
  });

  // ---------------------------------------------------------------------------
  // 6. FONDS DE COMMERCE À PRIX GLOBAL (AUDCIF Titre VIII ch. 2 § 7.2.1)
  // ---------------------------------------------------------------------------
  // Prix 50 000 000 · matériel commercial 12 000 000, mobilier 3 000 000, stock
  // de marchandises 5 000 000 (ligne de classe 3), reliquat au fonds commercial
  // 50 − 12 − 3 − 5 = 30 000 000 au 21500000 (le texte dit « 2151 », le plan
  // n'ouvre que 215), non amortissable (§ 7.2.2.1).
  await etape(R, '2026 · fonds de commerce', async () => {
    const corps = (biens, stocks, extra = {}) => ({
      exerciceId: n, journalId: bq.id, dateAcquisition: '2026-06-01', referenceActe: 'Acte de cession de fonds n° 45/2026',
      compteContrepartieId: compte(c, BQ), prix: 50_000_000, nature: 'FONDS_DE_COMMERCE', biens, stocks, ...extra,
    });
    const elements = [
      { compteImmobilisationId: compte(c, '24130000'), designation: 'Fonds Kasaï Distribution · matériel commercial', montant: 12_000_000, dureeAmortissementAns: 5, dateMiseEnService: '2026-06-01' },
      { compteImmobilisationId: compte(c, '24440000'), designation: 'Fonds Kasaï Distribution · mobilier', montant: 3_000_000, dureeAmortissementAns: 10, dateMiseEnService: '2026-06-01' },
    ];
    const stocks = [{ compteId: compte(c, '31110000'), montant: 5_000_000 }];
    await refus(c, R, 'Fonds commercial saisi comme élément', 'POST', '/immobilisations/prix-global',
      corps([...elements, { compteImmobilisationId: compte(c, '21500000'), designation: 'Fonds commercial', montant: 30_000_000 }], stocks), /r[ée]siduel/i);
    await refus(c, R, 'Éléments et stocks au-delà du prix', 'POST', '/immobilisations/prix-global',
      corps(elements, [{ compteId: compte(c, '31110000'), montant: 40_000_000 }]), /d[ée]passent/i);
    const r = await c.geste('Acquisition du fonds de commerce', 'POST', '/immobilisations/prix-global', corps(elements, stocks));
    R.montant('Fonds · stocks repris', 5_000_000, r?.stocks);
    const fc = (r?.biens ?? []).find((x) => /Fonds commercial/i.test(x.designation ?? ''));
    R.montant('Fonds · reliquat au fonds commercial (50 − 12 − 3 − 5)', 30_000_000, fc?.montant);
    b.matcom = (r?.biens ?? [])[0];
    b.mobilier = (r?.biens ?? [])[1];
    b.fonds = fc;
  });

  // ---------------------------------------------------------------------------
  // 7. RÉSERVE DE PROPRIÉTÉ (4816)
  // ---------------------------------------------------------------------------
  await etape(R, '2026 · réserve de propriété', async () => {
    b.chariot = await bien(c, 'Chariot élévateur sous réserve de propriété', n, od, {
      compte: '24130000', contrepartie: '48160000', designation: 'Chariot élévateur Toyota 3T', dateAcquisition: '2026-05-01', dateMiseEnService: '2026-05-01',
      valeurOrigine: 9_000_000, dureeAmortissementAns: 5,
    });
    R.egal('Chariot · la dette au 4816 pose la réserve de propriété sur la fiche', true, b.chariot?.reserveDePropriete);
    await refus(c, R, 'Réserve de propriété retirée d’un bien dont la dette est au 4816', 'PATCH', `/immobilisations/${b.chariot?.id}/reserve-de-propriete`, { reserveDePropriete: false }, /4816/);
  });

  await etape(R, '2026 · dotations, désactualisation, clôture des contrats', async () => {
    await doter(c, R, '2026', 'chargeuse (A)', b.locA, n, 5_699_263.58); // 28 496 317,89 / 5, dès la prise d'effet (§ 2.1.6)
    await doter(c, R, '2026', 'camion-citerne (B)', b.locB, n, 2_831_227.73); // 11 324 910,92 / 4
    await doter(c, R, '2026', 'station', b.station, n, 10_000_000); // 100 000 000 / 10
    await doter(c, R, '2026', 'composant démantèlement', b.demant, n, 321_973.24); // 3 219 732,37 / 10
    await doter(c, R, '2026', 'pick-up', b.pickup, n, 3_000_000); // 12 000 000 / 4
    await doter(c, R, '2026', 'turbine', b.turbine, n, 2_500_000); // 30 000 000 / 10 × 10/12 (mars à décembre)
    await doter(c, R, '2026', 'pièce de sécurité', b.securite, n, 500_000); // 3 000 000 / 5 × 10/12
    await refus(c, R, '2026 · dotation de la pièce de rechange non intégrée', 'POST', `/immobilisations/${b.rechange?.id}/dotation`, { exerciceId: n, journalId: od.id }, /mise en service/i);
    await doter(c, R, '2026', 'entrepôt', b.structure, n, 3_000_000); // 60 000 000 / 20
    await doter(c, R, '2026', 'matériel commercial du fonds', b.matcom, n, 1_400_000); // 12 000 000 / 5 × 7/12 (juin à décembre)
    await doter(c, R, '2026', 'mobilier du fonds', b.mobilier, n, 175_000); // 3 000 000 / 10 × 7/12
    await refus(c, R, '2026 · dotation du fonds commercial (non amortissable)', 'POST', `/immobilisations/${b.fonds?.id}/dotation`, { exerciceId: n, journalId: od.id });
    // Le fonds commercial est un élément ACQUIS avec le fonds (§ 7.2.1), en
    // usage dès l'acte du 1/6/2026, comme les éléments séparables qui portent
    // cette date · présumé non limité (§ 7.2.2.1).
    const fiches = await c.lire('Liste des biens', '/immobilisations');
    const ficheFonds = (Array.isArray(fiches) ? fiches : (fiches?.immobilisations ?? [])).find((x) => x.id === b.fonds?.id);
    R.egal('2026 · fonds commercial · durée présumée non limitée', true, ficheFonds?.dureeNonLimitee ?? null);
    R.egal('2026 · fonds commercial · en usage depuis l’acte (1/6/2026)', '2026-06-01', ficheFonds?.dateMiseEnService ? String(ficheFonds.dateMiseEnService).slice(0, 10) : null);
    await doter(c, R, '2026', 'compresseur', b.compresseur, n, 1_200_000); // 6 000 000 / 5
    await doter(c, R, '2026', 'chariot', b.chariot, n, 1_200_000); // 9 000 000 / 5 × 8/12 (mai à décembre)
    await doter(c, R, '2026', 'ordinateur portable', b.laptop, n, 400_000); // 1 200 000 / 3
    await doter(c, R, '2026', 'climatiseur', b.clim, n, 300_000); // 900 000 / 3

    // Désactualisation (§ 2.3, exemple · « 3 219 732 × 12 % = 386 368 ») · D 6971 / C 1984.
    const d = await c.geste('Désactualisation 2026', 'POST', `/immobilisations/${b.demant?.id}/demantelement/desactualisation`, { exerciceId: n, journalId: od.id });
    R.montant('2026 · désactualisation (3 219 732,37 × 12 %)', 386_367.88, d?.montant);

    // Clôture des contrats (§ 2.1.8.2) · le 623 crédité par le 17 et le 672 ;
    // les courus au 176. A · loyer du 1/7 = 1 404 815,89 + 8 595 184,11 ;
    // courus du 1/7 au 31/12 = 19 501 133,78 × ((1,05)^(184/184) − 1) =
    // 975 056,69 (la période entière, le 31 décembre compté). B · 566 245,55 +
    // 3 433 754,45 ; courus 7 891 156,47 × 5 % = 394 557,82.
    await clotureContrat(c, R, '2026', 'contrat A', k.A, n, od, { loyers: 10_000_000, capital: 8_595_184.11, interets: 1_404_815.89, courus: 975_056.69 });
    await clotureContrat(c, R, '2026', 'contrat B', k.B, n, od, { loyers: 4_000_000, capital: 3_433_754.45, interets: 566_245.55, courus: 394_557.82 });
  });

  await etape(R, '2026 · contrôles, états et notes', async () => {
    await validerJusqua(c, n, '2026-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n);
    // Banque · 800 − 0,4 (coûts nets A) − 100 − 12 − 30 − 3 − 2,4 − 60 − 50 −
    // 6 − 1,2 − 0,9 − 14 (loyers) = 520 100 000. 1730 · 28 096 317,89 +
    // 11 324 910,92 − 8 595 184,11 − 3 433 754,45 = 27 392 290,25. 6723 ·
    // 1 404 815,89 + 975 056,69 + 566 245,55 + 394 557,82 = 3 340 675,95.
    // 6813 · somme des dotations ci-dessus = 32 527 464,55.
    soldes(R, '2026', bal, {
      [BQ]: 520_100_000, '2416': 28_496_317.89, '2456': 11_324_910.92, '2411': 144_619_732.37, '2451': 12_000_000, '2311': 60_000_000,
      '2413': 21_000_000, '2444': 3_000_000, '2150': 30_000_000, '3111': 5_000_000, '2442': 1_200_000, '2441': 900_000,
      '1730': -27_392_290.25, '1763': -1_369_614.51, '6233': 0, '6723': 3_340_675.95, '1984': -3_606_100.25, '6971': 386_367.88,
      '4816': -9_000_000, '6813': 32_527_464.55, '28': -32_527_464.55,
    });

    const t = await c.lire('Tableau des amortissements 2026', `/immobilisations/tableau-amortissements?exerciceId=${n}`);
    R.montant('2026 · tableau · dotations de l’exercice', 32_527_464.55, t?.totaux?.dotation);
    R.montant('2026 · tableau · pièce de rechange · dotation nulle', 0, ligneTableau(t, b.rechange?.id)?.dotation ?? 0);
    R.montant('2026 · tableau · pièce de rechange · valeur nette', 2_400_000, ligneTableau(t, b.rechange?.id)?.valeurNette);
    R.montant('2026 · tableau · fonds commercial · valeur nette', 30_000_000, ligneTableau(t, b.fonds?.id)?.valeurNette);
    R.montant('2026 · tableau · chargeuse · valeur nette (28 496 317,89 − 5 699 263,58)', 22_797_054.31, ligneTableau(t, b.locA?.id)?.valeurNette);

    const notes = await c.lire('Notes annexes 2026', `/etats-financiers-syscohada/notes?exerciceId=${n}`);
    R.montant('2026 · note 3A · acquisitions (somme des entrées)', 312_540_961.18, ligneDeNote(notes, '3A')?.valeurs?.AUGMENTATIONS);
    R.montant('2026 · note 3A · fonds commercial et droit au bail', 30_000_000, ligneDeNote(notes, '3A', /Fonds commercial/i)?.valeurs?.CLOTURE);
    R.montant('2026 · note 3B · biens pris en location-acquisition (A + B)', 39_821_228.81, ligneDeNote(notes, '3B')?.valeurs?.AUGMENTATIONS);
    R.montant('2026 · note 3B · matériel de transport (B)', 11_324_910.92, ligneDeNote(notes, '3B', /transport/i)?.valeurs?.CLOTURE);
    R.montant('2026 · note 3C · amortissements à la clôture', 32_527_464.55, ligneDeNote(notes, '3C')?.valeurs?.CLOTURE);

    const rp = await c.lire('Biens sous réserve de propriété 2026', `/immobilisations/reserve-de-propriete?exerciceId=${n}`);
    R.montant('2026 · réserve de propriété · total des biens frappés', 9_000_000, rp?.total);
    R.montant('2026 · réserve de propriété · nombre', 1, rp?.nombre);

    const bil = aplatir(await c.lire('Bilan 2026', `/etats-financiers-syscohada/bilan?exerciceId=${n}`));
    R.montant('2026 · bilan · actif égal au passif', 0, bil.BZ?.n != null && bil.DZ?.n != null ? bil.BZ.n - bil.DZ.n : null);
    const tft = aplatir(await c.lire('Flux de trésorerie 2026', `/etats-financiers-syscohada/tableau-flux-tresorerie?exerciceId=${n}`));
    R.montant('2026 · TFT · trésorerie à la clôture (ZH)', 520_100_000, tft.ZH?.n);
    // § 1.4 du ch. 5 · « remboursement de la dette de location-acquisition » ·
    // la part de capital des loyers payés, 8 595 184,11 + 3 433 754,45.
    R.montant('2026 · TFT · remboursements de la dette de location-acquisition (FQ)', -12_028_938.56, tft.FQ?.n);
    const tftBrut = await c.lire('Flux de trésorerie 2026 (contrôle)', `/etats-financiers-syscohada/tableau-flux-tresorerie?exerciceId=${n}`);
    R.note(`2026 · TFT · contrôle du serveur · ${JSON.stringify(tftBrut?.controle ?? null)} · postes non calculables · ${JSON.stringify((tftBrut?.postesNonCalculables ?? []).map((p) => `${p.ref} : ${String(p.raison).slice(0, 160)}`))}`);
    // AUDCIF Titre VIII ch. 9 § 3 · les biens frappés de réserve de propriété se mentionnent aux Notes annexes.
    await controles(c, R, '2026 · contrôles', n, { leves: ['RESERVE_PROPRIETE_A_MENTIONNER'] });
  });

  const clos = await etape(R, 'Clôture 2026', async () => {
    const r = await c.geste('Clôture de l’exercice 2026', 'POST', `/exercices/${n}/cloturer`, {});
    await rechargerExercices(c);
    R.egal('Clôture 2026 passée', true, r !== null);
    return r !== null;
  });
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('Transports · 2027 non joué · clôture de 2026 refusée ou 2027 absent');

  await etape(R, '2027 · location-acquisition · loyers, option levée, option non levée', async () => {
    await ecriture(c, 'Loyer CB-2026-01 · 1/1/2027', n1, '2027-01-01', 'Loyer semestriel CB-2026-01', [['62330000', 10_000_000, 0], [BQ, 0, 10_000_000]], { journal: bq, reference: 'CB-2026-01/2' });
    await ecriture(c, 'Loyer CB-2026-02 · 1/1/2027', n1, '2027-01-01', 'Loyer semestriel CB-2026-02', [['62330000', 4_000_000, 0], [BQ, 0, 4_000_000]], { journal: bq, reference: 'CB-2026-02/2' });
    // A · dernier loyer ET prix de levée le 1/7/2027 · « aucune écriture n'est
    // à passer » au-delà du schéma (§ 2.1.9 A) · le prix entre au 623 comme une échéance.
    await ecriture(c, 'Loyer et levée CB-2026-01 · 1/7/2027', n1, '2027-07-01', 'Dernier loyer et levée d’option CB-2026-01', [['62330000', 11_000_000, 0], [BQ, 0, 11_000_000]], { journal: bq, reference: 'CB-2026-01/3' });
    await ecriture(c, 'Loyer CB-2026-02 · 1/7/2027', n1, '2027-07-01', 'Dernier loyer CB-2026-02', [['62330000', 4_000_000, 0], [BQ, 0, 4_000_000]], { journal: bq, reference: 'CB-2026-02/3' });

    // L'option échoit dans l'exercice · la clôture du contrat est refusée tant
    // que sa levée n'est pas déclarée (§ 2.1.9).
    await refus(c, R, '2027 · clôture du contrat A avant la déclaration de l’option', 'POST', `/immobilisations/location-acquisition/contrats/${k.A?.id}/cloture`, { exerciceId: n1, journalId: od.id }, /option/i);
    await c.geste('Option du contrat A levée', 'POST', `/immobilisations/location-acquisition/contrats/${k.A?.id}/option`, { levee: true });
    await refus(c, R, '2027 · seconde déclaration de l’option A', 'POST', `/immobilisations/location-acquisition/contrats/${k.A?.id}/option`, { levee: true }, /d[ée]j[aà] d[ée]clar/i);

    // B · option NON levée (§ 2.1.9 B) · cession au bailleur le 1/7/2027 ·
    // dotation arrêtée à la sortie 2 831 227,73 × 7/12 = 1 651 549,51 ; cumul
    // 2 831 227,73 + 1 651 549,51 = 4 482 777,24 ; X = 11 324 910,92 −
    // 4 482 777,24 = 6 842 133,68 au 812 ; P = 500 000 (capital restant dû)
    // annule la dette · D 1730 / C 822 ; perte X − P = 6 342 133,68 en H.A.O.
    const nl = await c.geste('Option du contrat B non levée', 'POST', `/immobilisations/location-acquisition/contrats/${k.B?.id}/option`, { levee: false, exerciceId: n1, journalId: od.id });
    R.egal('Contrat B · le bien sort par la non-levée (cédé)', 'CEDEE', nl?.statut ?? null);
    R.egal('Contrat B · date de sortie = date de l’option', '2027-07-01', String(nl?.dateSortie ?? '').slice(0, 10));

    // Clôtures de 2027 · extourne des courus de 2026 (fiche du compte 17) puis
    // virement. A · loyers L2 + L3 + option = 21 000 000 ; capital 9 024 943,31
    // + 9 476 190,48 + 999 999,99 = 19 501 133,78 ; intérêts 1 498 866,22 ;
    // aucun courus (plus d'échéance). B · L2 + L3 = 8 000 000 (l'option non
    // levée n'est jamais virée) ; capital 3 605 442,18 + 3 785 714,29 =
    // 7 391 156,47 ; intérêts 608 843,53.
    await clotureContrat(c, R, '2027', 'contrat A', k.A, n1, od, { extourne: 975_056.69, loyers: 21_000_000, capital: 19_501_133.78, interets: 1_498_866.22, courus: 0 });
    await clotureContrat(c, R, '2027', 'contrat B', k.B, n1, od, { extourne: 394_557.82, loyers: 8_000_000, capital: 7_391_156.47, interets: 608_843.53, courus: 0 });
    const liste = await contratsDuDossier(c, n1);
    R.egal('2027 · registre · option A levée', true, liste.find((x) => x.id === k.A?.id)?.optionLevee ?? null);
    R.egal('2027 · registre · option B non levée, bien sorti', [false, true], [liste.find((x) => x.id === k.B?.id)?.optionLevee ?? null, liste.find((x) => x.id === k.B?.id)?.bienSorti ?? null]);
  });

  await etape(R, '2027 · démantèlement · reprise à la cession du sous-jacent', async () => {
    // § 4 · la cession du sous-jacent éteint l'obligation · la désactualisation
    // courue jusqu'au 30/6/2027 est passée par la reprise, au prorata des mois
    // traversés (convention du logiciel, dite · le texte ne compte qu'en
    // années) · 3 606 100,25 × (1,12^(6/12) − 1) = 210 237,54. Reprise ·
    // D 1984 3 816 337,79 / C 7911 3 219 732,37 (valeur d'entrée) / C 7971
    // 596 605,42 (386 367,88 + 210 237,54).
    const r = await c.geste('Reprise de la provision pour démantèlement', 'POST', `/immobilisations/${b.demant?.id}/demantelement/reprise`, {
      exerciceId: n1, journalId: od.id, date: '2027-06-30', motif: 'CESSION_SOUS_JACENT',
    });
    R.montant('2027 · reprise · total au débit du 1984', 3_816_337.79, r?.montant);
    R.montant('2027 · reprise · part d’exploitation (7911, valeur d’entrée)', 3_219_732.37, r?.repriseExploitation);
    R.montant('2027 · reprise · part financière (7971, désactualisations)', 596_605.42, r?.repriseFinanciere);
    await refus(c, R, '2027 · désactualisation après la reprise', 'POST', `/immobilisations/${b.demant?.id}/demantelement/desactualisation`, { exerciceId: n1, journalId: od.id });
    const etat = await c.lire('État de la provision 2027', `/immobilisations/${b.demant?.id}/demantelement?exerciceId=${n1}`);
    R.egal('2027 · provision · reprise faite', true, etat?.repriseFaite ?? null);
    R.montant('2027 · provision restante', 0, etat?.provision);

    // Le principal ne sort pas avec son composant en service (F127).
    const venteStation = corpsSortie(c, n1, bq, {
      dateSortie: '2027-06-30', type: 'CESSION', prixCession: 120_000_000, contrepartie: BQ, natureSortie: 'VENTE',
      referencePieceSortie: 'Facture de cession FC-2027-07', datePieceSortie: '2027-06-30',
    });
    await refus(c, R, '2027 · cession de la station avec le composant en service', 'POST', `/immobilisations/${b.station?.id}/sortie`, venteStation, /composant/i);
    // Le composant suit le bien vendu · complément 321 973,24 × 6/12 = 160 986,62 ;
    // VNC 3 219 732,37 − 321 973,24 − 160 986,62 = 2 736 772,51 au 812, sans prix.
    await c.geste('Sortie du composant démantèlement', 'POST', `/immobilisations/${b.demant?.id}/sortie`, corpsSortie(c, n1, bq, {
      dateSortie: '2027-06-30', type: 'CESSION', prixCession: 0, contrepartie: BQ, natureSortie: 'VENTE',
      referencePieceSortie: 'Facture de cession FC-2027-07', datePieceSortie: '2027-06-30',
    }));
    // Station · complément 10 000 000 × 6/12 = 5 000 000 ; VNC 100 − 15 = 85 000 000 ; prix 120 000 000 au 822.
    await c.geste('Cession de la station', 'POST', `/immobilisations/${b.station?.id}/sortie`, venteStation);
    const piece = parCompte(c, await ecrituresDeLaPiece(c, n1, 'Facture de cession FC-2027-07'));
    R.montant('2027 · pièce FC-2027-07 · 812 (85 000 000 + 2 736 772,51)', 87_736_772.51, racine(piece, '812'));
    R.montant('2027 · pièce FC-2027-07 · 822', -120_000_000, racine(piece, '822'));
    R.montant('2027 · pièce FC-2027-07 · 2411 crédité (100 000 000 + 3 219 732,37)', -103_219_732.37, racine(piece, '2411'));
  });

  await etape(R, '2027 · échange du pick-up', async () => {
    // Guide SYSCOHADA Partie 1 ch. 5 § 4.5 · vente au prix de reprise (D 485 /
    // C 82) et achat au prix de reprise + soulte (D 2 / C 481). Pick-up ·
    // complément 3 000 000 × 4/12 = 1 000 000 (janvier à avril), cumul
    // 4 000 000, VNC 8 000 000 au 812 ; reprise 7 000 000 ; soulte 9 000 000 ;
    // camion reçu 16 000 000 au 2451.
    const corps = (extra) => ({
      dateEchange: '2027-04-01', exerciceId: n1, journalId: od.id, prixDeReprise: 7_000_000, soulte: 9_000_000,
      compteCreanceId: compte(c, '48520000'), compteFournisseurId: compte(c, '48120000'), compteImmobilisationId: compte(c, '24510000'),
      designation: 'Camion Isuzu FVR (reçu en échange)', dureeAmortissementAns: 5, dateMiseEnService: '2027-04-01', ...extra,
    });
    await refus(c, R, '2027 · échange · le bien reçu porté à la banque', 'POST', `/immobilisations/${b.pickup?.id}/echange`, corps({ compteFournisseurId: compte(c, BQ) }), /fournisseur d.investissement/i);
    await refus(c, R, '2027 · échange · reprise portée au 4812', 'POST', `/immobilisations/${b.pickup?.id}/echange`, corps({ compteCreanceId: compte(c, '48120000') }), /485/);
    // L'échange n'est pas une sortie seule (ligne A14).
    await refus(c, R, '2027 · échange déclaré en sortie seule', 'POST', `/immobilisations/${b.pickup?.id}/sortie`, corpsSortie(c, n1, od, {
      dateSortie: '2027-04-01', type: 'CESSION', prixCession: 7_000_000, contrepartie: '48520000', natureSortie: 'ECHANGE',
      referencePieceSortie: 'Contrat d’échange EX-2027-01', datePieceSortie: '2027-04-01',
    }), /[ÉE]changer/i);
    const e = await c.geste('Échange du pick-up contre un camion', 'POST', `/immobilisations/${b.pickup?.id}/echange`, corps());
    b.camion = e?.nouveau;
    R.montant('2027 · échange · valeur du bien reçu (7 000 000 + 9 000 000)', 16_000_000, e?.valeurOrigine);
    R.egal('2027 · échange · nature de la sortie', 'ECHANGE', e?.sortie?.natureSortie ?? null);
    // Le cabinet règle le fournisseur · D 4812 16 000 000 / C 4852 7 000 000 / C 5211 9 000 000.
    await ecriture(c, 'Règlement de l’échange', n1, '2027-04-05', 'Règlement échange pick-up contre camion', [['48120000', 16_000_000, 0], ['48520000', 0, 7_000_000], [BQ, 0, 9_000_000]], { journal: bq, reference: 'EX-2027-01' });
  });

  await etape(R, '2027 · pièces, partie non identifiée, matériel récupéré, réserve, natures', async () => {
    // La pièce de rechange est intégrée le 1/4/2027 · son plan démarre alors.
    await c.geste('Intégration de la pièce de rechange', 'PATCH', `/immobilisations/${b.rechange?.id}/mise-en-service`, { date: '2027-04-01', exerciceId: n1, journalId: od.id });

    // PARTIE NON IDENTIFIÉE (ch. 4 § 4.2 et § 3.1.2) · toiture d'origine estimée
    // à 6 000 000 (coût actuel à neuf), amortissements au prorata du cumul
    // d'ouverture · 3 000 000 × 6/60 = 300 000 ; renouvelée le 1/7/2027 par le
    // § 4.1 · complément 6 000 000 / 20 × 7/12 = 175 000, VNC 6 000 000 −
    // 475 000 = 5 525 000 au 812 ; nouvelle toiture 9 000 000 sur dix ans.
    const corps = (extra) => ({
      dateRenouvellement: '2027-07-01', exerciceId: n1, journalId: bq.id, designation: 'Entrepôt · nouvelle toiture (2027)', coutRenouvellement: 9_000_000,
      compteContrepartieId: compte(c, BQ), dureeAmortissementAns: 10, designationPartie: 'Entrepôt · toiture d’origine', valeurOrigineEstimee: 6_000_000,
      methodeEstimation: 'COUT_ACTUEL_A_NEUF', sourceEstimation: 'Devis de réfection Toitures du Kasaï n° 2027-114 (coût actuel à neuf)',
      justificationDecomposition: 'Toiture détruite par la tempête du 15/06/2027, durée propre plus courte que la structure', ...extra,
    });
    await refus(c, R, '2027 · partie estimée à toute la base de la structure', 'POST', `/immobilisations/${b.structure?.id}/remplacement-imprevu`, corps({ valeurOrigineEstimee: 60_000_000 }), /absorbe/i);
    const rp = await c.geste('Remplacement de la toiture non identifiée', 'POST', `/immobilisations/${b.structure?.id}/remplacement-imprevu`, corps());
    R.montant('2027 · partie détachée · valeur estimée', 6_000_000, rp?.partie?.valeurOrigine);
    R.montant('2027 · partie détachée · amortissements au prorata (3 000 000 × 6/60)', 300_000, rp?.partie?.amortissements);
    b.toiture = rp?.remplacant;

    // MATÉRIEL RÉCUPÉRÉ (ch. 14 § 2.8) · compresseur mis au rebut le 30/9/2027 ·
    // complément 1 200 000 × 9/12 = 900 000 ; VNC 6 000 000 − 2 100 000 =
    // 3 900 000 ; pièces reprises 500 000 au 388 ; 3 400 000 au 812.
    const mc = await c.lire('Comptes du matériel récupéré', '/immobilisations/materiel-recupere/comptes');
    R.egal('2027 · matériel récupéré · racine du SYSCOHADA', '388', mc?.racine ?? null);
    const rebut = (extra) => corpsSortie(c, n1, od, {
      dateSortie: '2027-09-30', type: 'MISE_HORS_SERVICE', natureSortie: 'MISE_AU_REBUT', referencePieceSortie: 'PV de mise au rebut n° 2027-03',
      datePieceSortie: '2027-09-30', valeurMaterielRecupere: 500_000, stock: '38800000', sourceMaterielRecupere: 'Estimation du chef d’atelier (PV n° 2027-03)', ...extra,
    });
    await refus(c, R, '2027 · matériel récupéré au-delà de la valeur nette (4 000 000 > 3 900 000)', 'POST', `/immobilisations/${b.compresseur?.id}/sortie`, rebut({ valeurMaterielRecupere: 4_000_000 }), /d[ée]passe/i);
    await refus(c, R, '2027 · matériel récupéré hors du 388', 'POST', `/immobilisations/${b.compresseur?.id}/sortie`, rebut({ stock: '33100000' }), /388/);
    await refus(c, R, '2027 · matériel récupéré sur une cession', 'POST', `/immobilisations/${b.compresseur?.id}/sortie`, rebut({ type: 'CESSION', natureSortie: 'VENTE', prixCession: 1_000_000, contrepartie: BQ }), /cession/i);
    await refus(c, R, '2027 · matériel récupéré sans source', 'POST', `/immobilisations/${b.compresseur?.id}/sortie`, rebut({ sourceMaterielRecupere: ' ' }), /d.o[uù] vient/i);
    await c.geste('Mise au rebut du compresseur', 'POST', `/immobilisations/${b.compresseur?.id}/sortie`, rebut());
    const pr = await ecrituresDeLaPiece(c, n1, 'PV de mise au rebut n° 2027-03');
    const prm = parCompte(c, pr);
    R.montant('2027 · rebut · 388 débité', 500_000, prm['38800000']);
    R.montant('2027 · rebut · 812 (3 900 000 − 500 000)', 3_400_000, racine(prm, '812'));
    R.egal('2027 · rebut · la nature est au libellé', true, pr.some((e) => /Mise hors service \(mise au rebut\)/.test(e.libelle ?? '')));

    // RÉSERVE DE PROPRIÉTÉ · règlement final le 31/3/2027 · une levée datée
    // dans 2026 changerait la liste d'un exercice clos, refusée.
    await ecriture(c, 'Règlement final du chariot', n1, '2027-03-31', 'Règlement final chariot élévateur', [['48160000', 9_000_000, 0], [BQ, 0, 9_000_000]], { journal: bq, reference: 'RP-2027-01' });
    await refus(c, R, '2027 · levée de la réserve datée dans l’exercice clos', 'PATCH', `/immobilisations/${b.chariot?.id}/reserve-de-propriete`, { reserveDePropriete: true, leveeLe: '2026-06-30' }, /clos/i);
    await c.geste('Levée de la réserve de propriété', 'PATCH', `/immobilisations/${b.chariot?.id}/reserve-de-propriete`, { reserveDePropriete: true, leveeLe: '2027-03-31' });

    // NATURE ET PIÈCE DE LA SORTIE (ligne A14), liste fermée.
    const sortieLaptop = (extra) => corpsSortie(c, n1, od, {
      dateSortie: '2027-04-30', type: 'MISE_HORS_SERVICE', natureSortie: 'VOL', referencePieceSortie: 'Plainte n° 112/2027 (commissariat de Kananga)', datePieceSortie: '2027-04-30', ...extra,
    });
    await refus(c, R, '2027 · destruction déclarée en cession', 'POST', `/immobilisations/${b.laptop?.id}/sortie`, sortieLaptop({ type: 'CESSION', natureSortie: 'DESTRUCTION', prixCession: 100_000, contrepartie: BQ }), /vente/i);
    await refus(c, R, '2027 · vente déclarée en mise hors service', 'POST', `/immobilisations/${b.laptop?.id}/sortie`, sortieLaptop({ natureSortie: 'VENTE' }), /cession/i);
    await refus(c, R, '2027 · remise gratuite hors projet', 'POST', `/immobilisations/${b.laptop?.id}/sortie`, sortieLaptop({ natureSortie: 'REMISE_GRATUITE' }), /projet/i);
    await refus(c, R, '2027 · restitution hors projet et hors usufruit', 'POST', `/immobilisations/${b.laptop?.id}/sortie`, sortieLaptop({ natureSortie: 'RESTITUTION' }), /projet|usufruit/i);
    await refus(c, R, '2027 · sortie sans référence de pièce', 'POST', `/immobilisations/${b.laptop?.id}/sortie`, sortieLaptop({ referencePieceSortie: '   ' }), /r[ée]f[ée]rence/i);
    await refus(c, R, '2027 · fonds de projet sur une société', 'POST', `/immobilisations/${b.laptop?.id}/sortie`, sortieLaptop({ fonds: '10130000' }), /projet/i);
    // Vol · complément 400 000 × 4/12 = 133 333,33 ; VNC 1 200 000 − 533 333,33 = 666 666,67 au 812.
    await c.geste('Vol de l’ordinateur portable', 'POST', `/immobilisations/${b.laptop?.id}/sortie`, sortieLaptop());
    const pv = await ecrituresDeLaPiece(c, n1, 'Plainte n° 112/2027 (commissariat de Kananga)');
    R.egal('2027 · vol · la référence de la plainte est sur les écritures', true, pv.length >= 2);
    R.egal('2027 · vol · nature au libellé', true, pv.some((e) => /\(vol\)/.test(e.libelle ?? '')));
    R.montant('2027 · vol · 812', 666_666.67, racine(parCompte(c, pv), '812'));
    // Destruction · complément 300 000 × 8/12 = 200 000 ; VNC 400 000 au 812.
    await c.geste('Destruction du climatiseur', 'POST', `/immobilisations/${b.clim?.id}/sortie`, corpsSortie(c, n1, od, {
      dateSortie: '2027-08-31', type: 'MISE_HORS_SERVICE', natureSortie: 'DESTRUCTION', referencePieceSortie: 'PV de destruction (incendie) n° 2027-08', datePieceSortie: '2027-09-02',
    }));
    R.montant('2027 · destruction · 812', 400_000, racine(parCompte(c, await ecrituresDeLaPiece(c, n1, 'PV de destruction (incendie) n° 2027-08')), '812'));
  });

  await etape(R, '2027 · dotations, 388 soldé, états', async () => {
    await doter(c, R, '2027', 'chargeuse (A, option levée)', b.locA, n1, 5_699_263.58); // l'amortissement « est poursuivi jusqu'à son terme » (§ 2.1.9 A)
    await doter(c, R, '2027', 'camion reçu en échange', b.camion, n1, 2_400_000); // 16 000 000 / 5 × 9/12
    await doter(c, R, '2027', 'turbine', b.turbine, n1, 3_000_000);
    await doter(c, R, '2027', 'pièce de sécurité', b.securite, n1, 600_000);
    await doter(c, R, '2027', 'pièce de rechange intégrée', b.rechange, n1, 450_000); // 2 400 000 / 4 × 9/12 (avril à décembre)
    await doter(c, R, '2027', 'entrepôt (structure réduite)', b.structure, n1, 2_700_000); // (60 − 6) / 20
    await doter(c, R, '2027', 'nouvelle toiture', b.toiture, n1, 450_000); // 9 000 000 / 10 × 6/12
    await doter(c, R, '2027', 'matériel commercial du fonds', b.matcom, n1, 2_400_000);
    await doter(c, R, '2027', 'mobilier du fonds', b.mobilier, n1, 300_000);
    await doter(c, R, '2027', 'chariot', b.chariot, n1, 1_800_000);

    // 388 · « en fin d'exercice, le compte 388 est soldé par le débit du compte
    // 603 [...] Si des éléments de ce stock subsistent, ils sont inscrits dans
    // les comptes appropriés de la classe 3 par le crédit du compte 603 » (ch. 14
    // § 2.8). Contrôle levé avant, éteint après.
    await validerJusqua(c, n1, '2027-12-31');
    const avant = await controles(c, R, '2027 · contrôles avant le solde du 388', n1, { leves: ['STOCK_IMMOBILISATIONS_388_NON_SOLDE'] });
    void avant;
    await ecriture(c, 'Solde du 388 à la clôture', n1, '2027-12-31', 'Solde du stock provenant d’immobilisations', [['60330000', 500_000, 0], ['38800000', 0, 500_000]], { reference: 'INV-2027-388' });
    await ecriture(c, 'Pièces subsistantes au stock', n1, '2027-12-31', 'Pièces récupérées subsistant à la clôture', [['33100000', 500_000, 0], ['60330000', 0, 500_000]], { reference: 'INV-2027-331' });
    await validerJusqua(c, n1, '2027-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n1);
    // Banque · 520 100 000 − 14 000 000 (loyers 1/1) − 15 000 000 (loyers 1/7)
    // − 9 000 000 (soulte) − 9 000 000 (toiture) − 9 000 000 (chariot) +
    // 120 000 000 (station) = 584 100 000. 812 · 6 842 133,68 + 8 000 000 +
    // 2 736 772,51 + 85 000 000 + 5 525 000 + 3 400 000 + 666 666,67 + 400 000
    // = 112 570 572,86. 822 · 500 000 + 7 000 000 + 120 000 000. 6723 ·
    // 1 498 866,22 + 608 843,53 − 975 056,69 − 394 557,82 = 738 095,24.
    // 6813 · dotations de 2027 et compléments de sortie = 29 020 133,04.
    soldes(R, '2027', bal, {
      [BQ]: 584_100_000, '2416': 28_496_317.89, '2456': 0, '2411': 35_400_000, '2451': 16_000_000, '2311': 63_000_000, '2413': 21_000_000,
      '2444': 3_000_000, '2150': 30_000_000, '2442': 0, '2441': 0, '1730': 0, '1763': 0, '6233': 0, '6723': 738_095.24,
      '1984': 0, '6971': 210_237.54, '7911': -3_219_732.37, '7971': -596_605.42, '388': 0, '331': 500_000, '6033': 0,
      '4812': 0, '4852': 0, '4816': 0, '812': 112_570_572.86, '822': -127_500_000, '6813': 29_020_133.04,
    });
    await controles(c, R, '2027 · contrôles après le solde du 388', n1, { nonLeves: ['STOCK_IMMOBILISATIONS_388_NON_SOLDE', 'RESERVE_PROPRIETE_A_MENTIONNER'] });

    const t = await c.lire('Tableau des amortissements 2027', `/immobilisations/tableau-amortissements?exerciceId=${n1}`);
    R.montant('2027 · tableau · dotations de l’exercice (compléments de sortie compris)', 29_020_133.04, t?.totaux?.dotation);
    R.montant('2027 · tableau · entrepôt · cumul d’ouverture net de la partie (3 000 000 − 300 000)', 2_700_000, ligneTableau(t, b.structure?.id)?.cumulN1);
    R.montant('2027 · tableau · entrepôt · valeur brute (60 − 6)', 54_000_000, ligneTableau(t, b.structure?.id)?.valeurBrute);
    R.montant('2027 · tableau · chargeuse · valeur nette (28 496 317,89 − 2 × 5 699 263,58)', 17_097_790.73, ligneTableau(t, b.locA?.id)?.valeurNette);

    const notes = await c.lire('Notes annexes 2027', `/etats-financiers-syscohada/notes?exerciceId=${n1}`);
    const n3a = ligneDeNote(notes, '3A');
    R.montant('2027 · note 3A · ouverture', 312_540_961.18, n3a?.valeurs?.OUVERTURE);
    R.montant('2027 · note 3A · acquisitions (camion 16 + toiture 9)', 25_000_000, n3a?.valeurs?.AUGMENTATIONS);
    R.montant('2027 · note 3A · sorties', 140_644_643.29, n3a?.valeurs?.DIMINUTIONS);
    R.montant('2027 · note 3A · clôture', 196_896_317.89, n3a?.valeurs?.CLOTURE);
    const n3b = ligneDeNote(notes, '3B');
    R.montant('2027 · note 3B · sortie du bien de l’option non levée', 11_324_910.92, n3b?.valeurs?.DIMINUTIONS);
    R.montant('2027 · note 3B · clôture (la chargeuse seule)', 28_496_317.89, n3b?.valeurs?.CLOTURE);

    const rp = await c.lire('Biens sous réserve de propriété 2027', `/immobilisations/reserve-de-propriete?exerciceId=${n1}`);
    R.montant('2027 · réserve de propriété · plus aucun bien frappé à la clôture', 0, rp?.total);
    const rp26 = await c.lire('Biens sous réserve de propriété 2026 (relue)', `/immobilisations/reserve-de-propriete?exerciceId=${n}`);
    R.montant('2026 relu · le chariot reste frappé au 31/12/2026', 9_000_000, rp26?.total);

    const tft = aplatir(await c.lire('Flux de trésorerie 2027', `/etats-financiers-syscohada/tableau-flux-tresorerie?exerciceId=${n1}`));
    R.montant('2027 · TFT · trésorerie à l’ouverture (ZA)', 520_100_000, tft.ZA?.n);
    R.montant('2027 · TFT · trésorerie à la clôture (ZH)', 584_100_000, tft.ZH?.n);
    // Seuls les remboursements DÉCAISSÉS · 19 501 133,78 + 7 391 156,47. La
    // dette de 500 000 éteinte par la non-levée n'est pas un flux (« le prix de
    // rachat P représente le capital restant dû », annulé sans paiement,
    // § 2.1.9 B ; ch. 5 § 1.3, transactions sans effet de trésorerie).
    R.montant('2027 · TFT · remboursements de la dette de location-acquisition (FQ, décaissés)', -26_892_290.25, tft.FQ?.n);
    const tftBrut = await c.lire('Flux de trésorerie 2027 (contrôle)', `/etats-financiers-syscohada/tableau-flux-tresorerie?exerciceId=${n1}`);
    R.note(`2027 · TFT · FI lu ${tft.FI?.n} · FG lu ${tft.FG?.n} · contrôle du serveur · ${JSON.stringify(tftBrut?.controle ?? null)}`);
    const bil = aplatir(await c.lire('Bilan 2027', `/etats-financiers-syscohada/bilan?exerciceId=${n1}`));
    R.montant('2027 · bilan · actif égal au passif', 0, bil.BZ?.n != null && bil.DZ?.n != null ? bil.BZ.n - bil.DZ.n : null);
  });

  await etape(R, 'Clôture 2027', async () => {
    const r = await c.geste('Clôture de l’exercice 2027', 'POST', `/exercices/${n1}/cloturer`, {});
    R.egal('Clôture 2027 passée', true, r !== null);
  });
}

// =============================================================================
// 1 bis · STATION-SERVICE DE KOLWEZI SARL (SYSCOHADA normal) · fonds commercial
// à durée LIMITÉE, acquis par le même geste de prix global
// =============================================================================
async function stationService(R) {
  R.scenario = 'Immobilisations complément · SYSCOHADA fonds amortissable';
  const c = await nouveauDossier(R, 'Complément · Station-service de Kolwezi SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'immo2-ss', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  let fonds = null;
  let pompes = null;

  await etape(R, '2026 · fonds de commerce adossé à une concession de huit ans', async () => {
    await c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await ouverture(c, n, '10130000', 50_000_000);
    // § 7.2.2.1 · le fonds commercial « doit obligatoirement être amorti
    // lorsque la durée d'utilité est limitée et déterminable », par exemple
    // « adossé à un contrat (par exemple un contrat de concession) » · ici la
    // concession de distribution de huit ans. Prix 20 000 000 · pompes
    // 4 000 000, reliquat 16 000 000 au 21500000, amorti sur huit ans.
    const r = await c.geste('Acquisition du fonds de la station', 'POST', '/immobilisations/prix-global', {
      exerciceId: n, journalId: bq.id, dateAcquisition: '2026-06-01', referenceActe: 'Acte de cession de fonds n° 12/2026', compteContrepartieId: compte(c, BQ),
      prix: 20_000_000, nature: 'FONDS_DE_COMMERCE', stocks: [], dureeFondsCommercialAns: 8,
      biens: [{ compteImmobilisationId: compte(c, '24130000'), designation: 'Station · pompes à carburant', montant: 4_000_000, dureeAmortissementAns: 5, dateMiseEnService: '2026-06-01' }],
    });
    fonds = (r?.biens ?? []).find((x) => /Fonds commercial/i.test(x.designation ?? '')) ?? null;
    pompes = (r?.biens ?? [])[0] ?? null;
    R.montant('Fonds · reliquat au fonds commercial (20 − 4)', 16_000_000, fonds?.montant);
    // 16 000 000 / 8 × 7/12 (juin à décembre, acquis et exploité depuis l'acte) = 1 166 666,67.
    const d = await c.geste('Dotation 2026 du fonds commercial', 'POST', `/immobilisations/${fonds?.id}/dotation`, { exerciceId: n, journalId: od.id });
    R.montant('2026 · fonds commercial amortissable · dotation dès l’acte (16 000 000 / 8 × 7/12)', 1_166_666.67, d?.montant);
    if (!d) {
      // L'issue que le refus nomme · déclarer la mise en service, puis doter.
      await c.geste('Mise en service déclarée du fonds commercial', 'PATCH', `/immobilisations/${fonds?.id}/mise-en-service`, { date: '2026-06-01', exerciceId: n, journalId: od.id });
      const d2 = await c.geste('Dotation 2026 du fonds commercial (après la mise en service)', 'POST', `/immobilisations/${fonds?.id}/dotation`, { exerciceId: n, journalId: od.id });
      R.montant('2026 · fonds commercial · dotation après la mise en service déclarée', 1_166_666.67, d2?.montant);
    }
    await doter(c, R, '2026', 'pompes', pompes, n, 466_666.67); // 4 000 000 / 5 × 7/12
    await validerJusqua(c, n, '2026-12-31');
    await rechargerComptes(c);
    soldes(R, '2026', await balance(c, n), {
      // Le fonds commercial est incorporel · sa dotation au 6812, son cumul au 2815.
      [BQ]: 30_000_000, '2150': 16_000_000, '2413': 4_000_000, '2815': -1_166_666.67, '6812': 1_166_666.67, '6813': 466_666.67,
    });
    const r2 = await c.geste('Clôture de l’exercice 2026', 'POST', `/exercices/${n}/cloturer`, {});
    await rechargerExercices(c);
    R.egal('Clôture 2026 passée', true, r2 !== null);
  });
  const n1 = c.exercices.get('2027')?.id;
  if (!n1) return R.note('Station-service · 2027 non joué');
  await etape(R, '2027 · dotation du fonds commercial', async () => {
    await doter(c, R, '2027', 'fonds commercial (16 000 000 / 8)', fonds, n1, 2_000_000);
    await doter(c, R, '2027', 'pompes', pompes, n1, 800_000); // 4 000 000 / 5
    await validerJusqua(c, n1, '2027-12-31');
    await rechargerComptes(c);
    soldes(R, '2027', await balance(c, n1), { '2815': -3_166_666.67, '6812': 2_000_000, '6813': 800_000 });
    const r = await c.geste('Clôture de l’exercice 2027', 'POST', `/exercices/${n1}/cloturer`, {});
    R.egal('Clôture 2027 passée', true, r !== null);
  });
}

// =============================================================================
// 2 · BRASSERIE DU TANGANYIKA SARL (SYSCOHADA normal) · réévaluation LIBRE
// =============================================================================
async function brasserie(R) {
  R.scenario = 'Immobilisations complément · SYSCOHADA réévaluation libre';
  const c = await nouveauDossier(R, 'Complément · Brasserie du Tanganyika SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'immo2-br', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const b = {};

  await etape(R, '2026 · acquisitions et dotations', async () => {
    await c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await ouverture(c, n, '10130000', 200_000_000);
    b.batiment = await bien(c, 'Bâtiment commercial', n, bq, {
      compte: '23130000', designation: 'Dépôt commercial de Kalemie', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 60_000_000, dureeAmortissementAns: 20,
    });
    b.terrain = await bien(c, 'Terrain à bâtir', n, bq, {
      compte: '22210000', designation: 'Terrain du lac', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01', valeurOrigine: 20_000_000,
    });
    b.materiel = await bien(c, 'Matériel de bureau', n, bq, {
      compte: '24410000', designation: 'Matériel de bureau du siège', dateAcquisition: '2026-07-01', dateMiseEnService: '2026-07-01',
      valeurOrigine: 8_000_000, dureeAmortissementAns: 4,
    });
    await doter(c, R, '2026', 'bâtiment', b.batiment, n, 3_000_000); // 60 000 000 / 20
    await doter(c, R, '2026', 'matériel', b.materiel, n, 1_000_000); // 8 000 000 / 4 × 6/12
  });

  await etape(R, '2026 · réévaluation libre, méthode 2 (élimination)', async () => {
    // AUDCIF art. 35 et Titre VIII ch. 28 § 3.1.2 · « la valeur réévaluée est
    // toujours la valeur actuelle » ; § 4.3.1 méthode 2 · les amortissements
    // sont éliminés (D 283 / C 23), puis la nouvelle valeur entre au brut
    // (D 23 / C 1062). Exemple du texte · 150 / 30 / 135 · D 283 30 / C 23 30
    // puis D 23 15 / C 1062 15, annuité 135 / 24.
    // Bâtiment · VNC 57 000 000 → 66 500 000 · D 2831 3 000 000 / C 2313
    // 3 000 000 ; D 2313 9 500 000 / C 1062 9 500 000 ; 19 ans restants (20 ×
    // 57/60), annuité 66 500 000 / 19 = 3 500 000.
    // Terrain · non amortissable · D 2221 6 000 000 / C 1062 (20 → 26).
    // Matériel · premier exercice au prorata, 3,5 ans restants · la méthode 2
    // n'est pas portée (années entières), il est retenu à sa valeur nette.
    const corps = (lignes, extra = {}) => ({
      exerciceId: n, journalId: od.id, type: 'LIBRE', methodeLibre: 'ELIMINATION',
      decision: 'Assemblée générale du 20/12/2026 · réévaluation libre de l’ensemble des immobilisations corporelles',
      traitementFiscal: 'Écart au 1062, non distribuable (loi n° 23/053, art. 133) ; prélèvement libératoire de 20 % en cas d’application de l’art. 19, point 4 (art. 129)',
      methodeEvaluation: 'Valeurs actuelles (expertise immobilière du 10/12/2026), méthode de l’élimination des amortissements',
      lignes, ...extra,
    });
    const ligne = (im, va) => ({ immobilisationId: im?.id, valeurActuelle: va });
    const toutes = [ligne(b.batiment, 66_500_000), ligne(b.terrain, 26_000_000), ligne(b.materiel, 7_000_000)];
    await refus(c, R, '2026 · réévaluation libre sans méthode', 'POST', '/immobilisations/reevaluation-bilan', corps(toutes, { methodeLibre: undefined }), /m[ée]thode/i);
    await refus(c, R, '2026 · provision spéciale (154) sur une réévaluation libre', 'POST', '/immobilisations/reevaluation-bilan', corps(toutes, { neutraliteFiscale: true }), /154/);
    await refus(c, R, '2026 · réévaluation partielle (matériel omis)', 'POST', '/immobilisations/reevaluation-bilan', corps(toutes.slice(0, 2)), /partielle/i);
    await refus(c, R, '2026 · méthode 2 sur un reste d’années non entier', 'POST', '/immobilisations/reevaluation-bilan', corps([toutes[0], toutes[1], ligne(b.materiel, 7_700_000)]), /entier/i);
    await refus(c, R, '2026 · valeur actuelle sous la valeur nette', 'POST', '/immobilisations/reevaluation-bilan', corps([ligne(b.batiment, 50_000_000), toutes[1], toutes[2]]), /d[ée]pr[ée]ciation/i);
    const r = await c.geste('Réévaluation libre 2026', 'POST', '/immobilisations/reevaluation-bilan', corps(toutes));
    R.montant('2026 · réévaluation · écart total (9 500 000 + 6 000 000)', 15_500_000, r?.totalEcart);
    await refus(c, R, '2026 · seconde réévaluation du même exercice', 'POST', '/immobilisations/reevaluation-bilan', corps(toutes), /d[ée]j[aà]/i);
    const e = parCompte(c, ((await c.lire('Écritures 2026', `/ecritures?exerciceId=${n}&recherche=${encodeURIComponent('Réévaluation libre')}`))?.ecritures ?? []));
    // Méthode 2 · le cumul de 3 000 000 est éliminé · D 283 3 000 000 / C 2313.
    R.montant('2026 · écriture · 283 débité du cumul éliminé', 3_000_000, racine(e, '283'));
    R.montant('2026 · écriture · 2313 net (+9 500 000 − 3 000 000)', 6_500_000, racine(e, '2313'));
    R.montant('2026 · écriture · 1062 crédité', -15_500_000, racine(e, '1062'));
    const hist = await c.lire('Révisions du plan du bâtiment', `/immobilisations/${b.batiment?.id}/revisions-plan`);
    const revs = Array.isArray(hist) ? hist : (hist?.revisions ?? []);
    R.egal('2026 · méthode 2 · révision prospective inscrite (19 ans)', 19, revs.find((x) => x.nature === 'PROSPECTIVE')?.dureeApresAns ?? null);
  });

  await etape(R, '2026 · états, note 3E, déclaration spéciale', async () => {
    await validerJusqua(c, n, '2026-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n);
    soldes(R, '2026', bal, {
      '2313': 66_500_000, '283': 0, '2221': 26_000_000, '1062': -15_500_000, '2441': 8_000_000, '284': -1_000_000, '6813': 4_000_000,
      [BQ]: 112_000_000, // 200 − 60 − 20 − 8
    });
    const t = await c.lire('Tableau des amortissements 2026', `/immobilisations/tableau-amortissements?exerciceId=${n}`);
    const lb = ligneTableau(t, b.batiment?.id);
    // La dotation se passe avant, sur les valeurs anciennes (art. 63 ; § 3.2) ;
    // le cumul éliminé à la clôture · cumul d'ouverture 0, dotation 3 000 000,
    // ajustement −3 000 000, cumul de clôture 0, brut 66 500 000.
    R.montant('2026 · tableau · bâtiment · dotation sur l’ancienne valeur', 3_000_000, lb?.dotation);
    R.montant('2026 · tableau · bâtiment · ajustement de la réévaluation', -3_000_000, lb?.ajustementReevaluation);
    R.montant('2026 · tableau · bâtiment · cumul à la clôture', 0, lb?.cumulN);
    R.montant('2026 · tableau · bâtiment · valeur nette', 66_500_000, lb?.valeurNette);
    const n3e = await c.lire('Encadré de la note 3E 2026', `/immobilisations/reevaluation-bilan/note?exerciceId=${n}`);
    R.egal('2026 · encadré · note 3E', '3E', n3e?.codeNote ?? null);
    R.egal('2026 · encadré · réévaluation libre, méthode 2', ['LIBRE', 'ELIMINATION'], [n3e?.reevaluations?.[0]?.type ?? null, n3e?.reevaluations?.[0]?.methodeLibre ?? null]);
    R.montant('2026 · encadré · coût historique des biens réévalués (60 + 20)', 80_000_000, n3e?.total?.coutHistorique);
    R.montant('2026 · encadré · montant réévalué (66,5 + 26)', 92_500_000, n3e?.total?.valeurReevaluee);
    R.montant('2026 · encadré · écart au 106', 15_500_000, n3e?.total?.ecart106);
    R.montant('2026 · encadré · aucune provision spéciale', 0, n3e?.total?.provision154);
    const ds = await c.lire('Déclaration spéciale 2026', `/immobilisations/reevaluation-bilan/declaration-speciale?exerciceId=${n}`);
    R.montant('2026 · déclaration spéciale · valeur brute avant (60 + 20 + 8)', 88_000_000, ds?.total?.brutAvant);
    R.montant('2026 · déclaration spéciale · écart', 15_500_000, ds?.total?.ecart);
    R.egal('2026 · déclaration spéciale · ne se dit jamais déposée', true, /ne d[ée]pose rien/i.test(ds?.mentions?.depot ?? ''));
    const notes = await c.lire('Notes annexes 2026', `/etats-financiers-syscohada/notes?exerciceId=${n}`);
    // Colonne « suite à une réévaluation » · hausse de brut 9 500 000 − 3 000 000 + 6 000 000.
    R.montant('2026 · note 3A · colonne réévaluation (6 500 000 + 6 000 000)', 12_500_000, ligneDeNote(notes, '3A')?.valeurs?.REEVALUATION);
    await controles(c, R, '2026 · contrôles', n, { leves: ['DECLARATION_REEVALUATION_A_DEPOSER'] });
  });

  const clos = await etape(R, 'Clôture 2026', async () => {
    const r = await c.geste('Clôture de l’exercice 2026', 'POST', `/exercices/${n}/cloturer`, {});
    await rechargerExercices(c);
    R.egal('Clôture 2026 passée', true, r !== null);
    return r !== null;
  });
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('Brasserie · 2027 non joué');

  await etape(R, '2027 · dotations, cession du terrain, réévaluation méthode 1', async () => {
    await doter(c, R, '2027', 'bâtiment (66 500 000 / 19)', b.batiment, n1, 3_500_000);
    await doter(c, R, '2027', 'matériel', b.materiel, n1, 2_000_000);
    // Terrain cédé le 31/10/2027 pour 30 000 000 · VNC réévaluée 26 000 000 au
    // 812 (loi n° 23/053, art. 132 al. 2) ; l'écart de 6 000 000 va à une
    // réserve non distribuable CHOISIE (ch. 28 § 6) · le 118 refusé, le compte
    // absent refusé.
    const vente = (reserve) => corpsSortie(c, n1, bq, {
      dateSortie: '2027-10-31', type: 'CESSION', prixCession: 30_000_000, contrepartie: BQ, natureSortie: 'VENTE',
      referencePieceSortie: 'Acte de vente n° 212/2027', datePieceSortie: '2027-10-31', reserve,
    });
    const ecart = await c.lire('Écart du terrain à la sortie', `/immobilisations/reevaluation-bilan/ecart-a-la-sortie?immobilisationId=${b.terrain?.id}`);
    R.egal('2027 · terrain · l’écart à transférer est annoncé', true, JSON.stringify(ecart ?? {}).includes('6000000'));
    await refus(c, R, '2027 · terrain réévalué cédé sans réserve choisie', 'POST', `/immobilisations/${b.terrain?.id}/sortie`, vente(undefined), /r[ée]serve/i);
    await refus(c, R, '2027 · écart vers le 118 (réserve libre)', 'POST', `/immobilisations/${b.terrain?.id}/sortie`, vente('11810000'), /118|r[ée]serve/i);
    await c.geste('Cession du terrain réévalué', 'POST', `/immobilisations/${b.terrain?.id}/sortie`, vente('11200000'));
    // Réévaluation de 2027, méthode 1 (ajustement, § 4.3.1) · bâtiment VNC
    // 66 500 000 − 3 500 000 = 63 000 000, valeur actuelle 69 300 000, k' = 1,1 ·
    // amortissements 3 500 000 × 1,1 = 3 850 000 (+350 000), brut 69 300 000 +
    // 3 850 000 = 73 150 000 (+6 650 000), écart 6 300 000 au 1062. Matériel
    // VNC 5 000 000 retenu à sa valeur. Le terrain sorti n'est plus du périmètre.
    const r = await c.geste('Réévaluation libre 2027', 'POST', '/immobilisations/reevaluation-bilan', {
      exerciceId: n1, journalId: od.id, type: 'LIBRE', methodeLibre: 'AJUSTEMENT',
      decision: 'Assemblée générale du 18/12/2027 · réévaluation libre', traitementFiscal: 'Écart au 1062 (loi n° 23/053, art. 129 et 133)',
      methodeEvaluation: 'Valeurs actuelles (expertise du 15/12/2027), ajustement du brut et des amortissements',
      lignes: [{ immobilisationId: b.batiment?.id, valeurActuelle: 69_300_000 }, { immobilisationId: b.materiel?.id, valeurActuelle: 5_000_000 }],
    });
    R.montant('2027 · réévaluation · écart (69 300 000 − 63 000 000)', 6_300_000, r?.totalEcart);
  });

  await etape(R, '2027 · états, tableau relu tel qu’il était, note 3E', async () => {
    await validerJusqua(c, n1, '2027-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n1);
    soldes(R, '2027', bal, {
      '2313': 73_150_000, '283': -3_850_000, '2221': 0, '1062': -15_800_000, '1120': -6_000_000, '2441': 8_000_000, '284': -3_000_000,
      '812': 26_000_000, '822': -30_000_000, '6813': 5_500_000, [BQ]: 142_000_000, // 112 + 30
    });
    const t = await c.lire('Tableau des amortissements 2027', `/immobilisations/tableau-amortissements?exerciceId=${n1}`);
    const lb = ligneTableau(t, b.batiment?.id);
    // Annuité 3 500 000 = 3 000 000 × k' (66,5 / 57) · la part due à la
    // réévaluation est 3 500 000 × (1 − 57/66,5) = 500 000 (ch. 28 § 4.2.2 ;
    // loi n° 23/053, art. 135).
    R.montant('2027 · tableau · bâtiment · cumul d’ouverture (éliminé en 2026)', 0, lb?.cumulN1);
    R.montant('2027 · tableau · bâtiment · ajustement de la réévaluation de l’exercice', 350_000, lb?.ajustementReevaluation);
    R.montant('2027 · tableau · bâtiment · cumul de clôture (3 500 000 + 350 000)', 3_850_000, lb?.cumulN);
    R.montant('2027 · tableau · bâtiment · valeur nette', 69_300_000, lb?.valeurNette);
    R.montant('2027 · tableau · part de l’annuité due à la réévaluation', 500_000, lb?.reevaluation?.supplement);
    R.montant('2027 · tableau · total des suppléments', 500_000, t?.totaux?.supplementReevaluation);
    // Le tableau de 2026, RELU après la réévaluation de 2027, rend le bien tel
    // qu'il était à la clôture de 2026 · brut 66 500 000, cumul 0.
    const t26 = await c.lire('Tableau 2026 relu', `/immobilisations/tableau-amortissements?exerciceId=${n}`);
    const lb26 = ligneTableau(t26, b.batiment?.id);
    R.montant('2026 relu · bâtiment · valeur brute (sans la réévaluation de 2027)', 66_500_000, lb26?.valeurBrute);
    R.montant('2026 relu · bâtiment · cumul de clôture', 0, lb26?.cumulN);
    R.montant('2026 relu · bâtiment · valeur nette', 66_500_000, lb26?.valeurNette);
    const n3e = await c.lire('Encadré de la note 3E 2027', `/immobilisations/reevaluation-bilan/note?exerciceId=${n1}`);
    // Bâtiment · coût historique 60 000 000, montant de la DERNIÈRE réévaluation
    // 69 300 000, écarts 9 500 000 + 6 300 000 ; terrain (sorti dans
    // l'exercice, gardé) · 20 000 000, 26 000 000, 6 000 000.
    R.montant('2027 · encadré · coût historique (60 + 20)', 80_000_000, n3e?.total?.coutHistorique);
    R.montant('2027 · encadré · montant réévalué (69,3 + 26)', 95_300_000, n3e?.total?.valeurReevaluee);
    R.montant('2027 · encadré · écarts au 106 (9,5 + 6,3 + 6)', 21_800_000, n3e?.total?.ecart106);
    R.montant('2027 · encadré · amortissements supplémentaires de l’exercice', 500_000, n3e?.total?.amortissementsSupplementaires);
    const sorti = (n3e?.sortis ?? []).find((s) => s.immobilisationId === b.terrain?.id);
    R.montant('2027 · encadré · terrain sorti · écart transféré à la réserve', 6_000_000, sorti?.transfereReserve);
    await controles(c, R, '2027 · contrôles', n1, { leves: ['DECLARATION_REEVALUATION_A_DEPOSER'] });
    const r = await c.geste('Clôture de l’exercice 2027', 'POST', `/exercices/${n1}/cloturer`, {});
    R.egal('Clôture 2027 passée', true, r !== null);
  });
}

// =============================================================================
// 3 · ASSOCIATION LUMIÈRE DU KASAÏ (SYCEBNL associations)
// =============================================================================
async function association(R) {
  R.scenario = 'Immobilisations complément · SYCEBNL association';
  const c = await nouveauDossier(R, 'Complément · Association Lumière du Kasaï', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'immo2-as', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const b = {};
  let contrat = null;

  await etape(R, '2026 · acquisitions', async () => {
    await ouverture(c, n, '10110000', 150_000_000);
    b.batiment = await bien(c, 'Centre de formation', n, bq, {
      compte: '23110000', designation: 'Centre de formation de Tshikapa', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 40_000_000, dureeAmortissementAns: 20,
    });
    // Démantèlement aux deux référentiels (fiche SYCEBNL du compte 19 vers
    // l'AUDCIF ch. 18 et ch. 6) · 2 000 000 dans dix ans à 10 % · VA =
    // 2 000 000 × 1,1^-10 = 771 086,58.
    b.demant = await bien(c, 'Composant démantèlement du centre', n, od, {
      compte: '23110000', contrepartie: '19840000', designation: 'Centre · désamiantage et remise en état', dateAcquisition: '2026-01-01',
      dateMiseEnService: '2026-01-01', valeurOrigine: 771_086.58, dureeAmortissementAns: 10, immobilisationPrincipaleId: b.batiment?.id,
      typeComposant: 'DEMANTELEMENT', coutFuturDemantelement: 2_000_000, tauxActualisationDemantelementPourcent: 10,
      justificationDecomposition: 'Obligation de désamiantage au terme du bail emphytéotique (convention avec la commune)',
    });
    b.groupe = await bien(c, 'Groupe électrogène', n, bq, {
      compte: '24110000', designation: 'Groupe électrogène 100 kVA', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 10_000_000, dureeAmortissementAns: 5,
    });
    b.ordinateurs = await bien(c, 'Ordinateurs', n, bq, {
      compte: '24420000', designation: 'Ordinateurs de la salle de formation', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 3_000_000, dureeAmortissementAns: 3,
    });
    // Le matériel informatique n'est pas décomposable au SYCEBNL (liste fermée).
    await refus(c, R, 'Composant sur du matériel informatique', 'POST', '/immobilisations', corpsBien(c, n, bq, {
      compte: '24420000', designation: 'Ordinateurs · onduleurs', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01', valeurOrigine: 300_000,
      dureeAmortissementAns: 2, immobilisationPrincipaleId: b.ordinateurs?.id, typeComposant: 'COMPOSANT', justificationDecomposition: 'Durée plus courte',
    }), /informatique/i);
    // RÉSERVE DE PROPRIÉTÉ · au SYCEBNL le 4816 se subdivise (48161
    // incorporelles, 48162 corporelles) · le mobilier va au 48162.
    await refus(c, R, 'Mobilier sous réserve porté au 48161 (incorporelles)', 'POST', '/immobilisations', corpsBien(c, n, od, {
      compte: '24410000', contrepartie: '48161000', designation: 'Mobilier (essai)', dateAcquisition: '2026-04-01', dateMiseEnService: '2026-04-01',
      valeurOrigine: 6_000_000, dureeAmortissementAns: 5,
    }));
    b.mobilier = await bien(c, 'Mobilier sous réserve de propriété', n, od, {
      compte: '24410000', contrepartie: '48162000', designation: 'Mobilier des salles de classe', dateAcquisition: '2026-04-01', dateMiseEnService: '2026-04-01',
      valeurOrigine: 6_000_000, dureeAmortissementAns: 5,
    });
    R.egal('Mobilier · réserve de propriété posée par le 48162', true, b.mobilier?.reserveDePropriete);
    // EN COURS · le véhicule commandé le 1/10/2026, livré en 2027 · inscrit au
    // 2495 (« mêmes subdivisions que 241-248 »), son compte définitif 2451.
    await refus(c, R, 'Bien en cours sur un compte qui n’est pas un 2x9', 'POST', '/immobilisations', corpsBien(c, n, bq, {
      compte: '24510000', compteEnCoursId: compte(c, '24420000'), designation: 'Minibus (essai)', dateAcquisition: '2026-10-01', valeurOrigine: 15_000_000, dureeAmortissementAns: 5,
    }));
    b.vehicule = await bien(c, 'Minibus en cours de livraison', n, bq, {
      compte: '24510000', compteEnCoursId: compte(c, '24950000'), designation: 'Minibus Toyota Coaster', dateAcquisition: '2026-10-01',
      valeurOrigine: 15_000_000, dureeAmortissementAns: 5,
    });
    // LOCATION-ACQUISITION AU SYCEBNL (fiche du compte 18 vers l'AUDCIF ch. 8) ·
    // photocopieurs, 24 mois, deux loyers ANNUELS échus de 3 000 000, option
    // 500 000, taux 10 % · dette = 3 000 000 / 1,1 + 3 000 000 / 1,21 + 500 000
    // / 1,21 = 2 727 272,73 + 2 479 338,84 + 413 223,14 = 5 619 834,71.
    // L1 (1/1/2027) · intérêts 561 983,47, capital 2 438 016,53, reste 3 181 818,18.
    const corpsLoc = (extra) => ({
      compteImmobilisationId: compte(c, '24460000'), nature: 'CREDIT_BAIL_MOBILIER', datePriseEffet: '2026-01-01', dureeMois: 24, periodicite: 'ANNUELLE',
      termeAEchoir: false, loyer: 3_000_000, prixOption: 500_000, tauxAnnuel: 0.10, optionRaisonnablementCertaine: true, bienDeFaibleValeur: false,
      designation: 'Photocopieurs Ricoh (crédit-bail)', dureeAmortissementAns: 5, reference: 'CB-AS-2026', dateConclusion: '2025-12-20', exerciceId: n, journalId: od.id, ...extra,
    });
    // Le 187 n'ouvre aucune dette pour une « autre » location-acquisition.
    await refus(c, R, 'Location-acquisition « autre » au SYCEBNL', 'POST', '/immobilisations/location-acquisition', corpsLoc({ nature: 'AUTRE' }), /187/);
    const loc = await c.geste('Entrée du crédit-bail des photocopieurs', 'POST', '/immobilisations/location-acquisition', corpsLoc());
    b.loc = loc?.immobilisation;
    R.montant('Association · dette de location-acquisition (1872)', 5_619_834.71, loc?.echeancier?.dette);
    R.egal('Association · comptes du SYCEBNL (1872, 1876, 6722, 6233)', ['18720000', '18760000', '67220000', '62330000'],
      [loc?.comptes?.dette ?? null, loc?.comptes?.interetsCourus ?? null, loc?.comptes?.interets ?? null, loc?.comptes?.redevances ?? null]);
    contrat = (await contratsDuDossier(c, n)).find((x) => x.immobilisationId === b.loc?.id) ?? null;
    // Le fonds de commerce n'existe qu'au SYSCOHADA.
    await refus(c, R, 'Fonds de commerce dans une association', 'POST', '/immobilisations/prix-global', {
      exerciceId: n, journalId: bq.id, dateAcquisition: '2026-06-01', referenceActe: 'Acte n° 1', compteContrepartieId: compte(c, BQ), prix: 10_000_000,
      nature: 'FONDS_DE_COMMERCE', biens: [{ compteImmobilisationId: compte(c, '24410000'), designation: 'Mobilier', montant: 2_000_000, dureeAmortissementAns: 5, dateMiseEnService: '2026-06-01' }], stocks: [],
    }, /SYSCOHADA/);
  });

  await etape(R, '2026 · dotations, désactualisation, contrat, réévaluation', async () => {
    await doter(c, R, '2026', 'centre', b.batiment, n, 2_000_000); // 40 000 000 / 20
    await doter(c, R, '2026', 'composant démantèlement', b.demant, n, 77_108.66); // 771 086,58 / 10
    await doter(c, R, '2026', 'groupe électrogène', b.groupe, n, 2_000_000); // 10 000 000 / 5
    await doter(c, R, '2026', 'ordinateurs', b.ordinateurs, n, 1_000_000); // 3 000 000 / 3
    await doter(c, R, '2026', 'mobilier', b.mobilier, n, 900_000); // 6 000 000 / 5 × 9/12 (avril à décembre)
    await refus(c, R, '2026 · dotation du minibus non livré', 'POST', `/immobilisations/${b.vehicule?.id}/dotation`, { exerciceId: n, journalId: od.id }, /mise en service/i);
    await doter(c, R, '2026', 'photocopieurs', b.loc, n, 1_123_966.94); // 5 619 834,71 / 5
    const d = await c.geste('Désactualisation 2026 (association)', 'POST', `/immobilisations/${b.demant?.id}/demantelement/desactualisation`, { exerciceId: n, journalId: od.id });
    R.montant('2026 · désactualisation (771 086,58 × 10 %)', 77_108.66, d?.montant);
    // Aucun loyer échu en 2026 · seuls les courus · 5 619 834,71 × 10 % = 561 983,47.
    await clotureContrat(c, R, '2026', 'photocopieurs', contrat, n, od, { loyers: 0, capital: 0, interets: 0, courus: 561_983.47 });

    // RÉÉVALUATION LIBRE, méthode 1, sur TOUT le périmètre (art. 62 ; loi
    // n° 23/053, art. 130 et 131 · les biens en location-acquisition compris).
    // Centre · VNC 38 000 000 → 45 600 000 (k' 1,2) · brut 48 000 000, cumul
    // 2 400 000, écart 7 600 000 au 10611 (sans droit de reprise). Groupe ·
    // VNC 8 000 000 → 8 800 000 (k' 1,1) · brut 11 000 000, cumul 2 200 000,
    // écart 800 000 au 10621 (avec droit de reprise). Les autres à leur VNC.
    const lignes = (droitGroupe) => [
      { immobilisationId: b.batiment?.id, valeurActuelle: 45_600_000, droitDeReprise: false },
      { immobilisationId: b.demant?.id, valeurActuelle: 693_977.92, droitDeReprise: false },
      { immobilisationId: b.groupe?.id, valeurActuelle: 8_800_000, ...(droitGroupe === undefined ? {} : { droitDeReprise: droitGroupe }) },
      { immobilisationId: b.ordinateurs?.id, valeurActuelle: 2_000_000, droitDeReprise: false },
      { immobilisationId: b.mobilier?.id, valeurActuelle: 5_100_000, droitDeReprise: false },
      { immobilisationId: b.vehicule?.id, valeurActuelle: 15_000_000, droitDeReprise: false },
      { immobilisationId: b.loc?.id, valeurActuelle: 4_495_867.77, droitDeReprise: false },
    ];
    const corps = (l) => ({
      exerciceId: n, journalId: od.id, type: 'LIBRE', methodeLibre: 'AJUSTEMENT',
      decision: 'Assemblée générale du 19/12/2026 · réévaluation libre des immobilisations corporelles',
      traitementFiscal: 'Association exemptée de l’impôt sur les sociétés · aucun impôt sur l’écart',
      methodeEvaluation: 'Valeurs actuelles (expertise du 12/12/2026), ajustement du brut et des amortissements', lignes: l,
    });
    // Au SYCEBNL l'écart se range selon le droit de reprise · non déclaré, refus.
    await refus(c, R, '2026 · réévaluation sans le droit de reprise du groupe', 'POST', '/immobilisations/reevaluation-bilan', corps(lignes(undefined)), /droit de reprise/i);
    const r = await c.geste('Réévaluation libre 2026 (association)', 'POST', '/immobilisations/reevaluation-bilan', corps(lignes(true)));
    R.montant('2026 · réévaluation · écart total (7 600 000 + 800 000)', 8_400_000, r?.totalEcart);
  });

  await etape(R, '2026 · états et note 5H', async () => {
    await validerJusqua(c, n, '2026-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n);
    // 2311 · 40 000 000 + 771 086,58 + 8 000 000 ; banque · 150 − 40 − 10 − 3 − 15.
    soldes(R, '2026', bal, {
      [BQ]: 82_000_000, '2311': 48_771_086.58, '2411': 11_000_000, '2442': 3_000_000, '2441': 6_000_000, '2495': 15_000_000, '2451': 0,
      '2446': 5_619_834.71, '1872': -5_619_834.71, '1876': -561_983.47, '6722': 561_983.47, '1984': -848_195.24, '6971': 77_108.66,
      '10611': -7_600_000, '10621': -800_000, '48162': -6_000_000, '6813': 7_101_075.60,
      '28': -7_701_075.60, // dotations + 400 000 + 200 000 de réévaluation
    });
    const n5h = await c.lire('Encadré de la note 5H 2026', `/immobilisations/reevaluation-bilan/note?exerciceId=${n}`);
    R.egal('2026 · encadré · note 5H', '5H', n5h?.codeNote ?? null);
    R.montant('2026 · encadré · coût historique (40 + 10)', 50_000_000, n5h?.total?.coutHistorique);
    R.montant('2026 · encadré · montant réévalué (45,6 + 8,8)', 54_400_000, n5h?.total?.valeurReevaluee);
    R.montant('2026 · encadré · écarts au 106', 8_400_000, n5h?.total?.ecart106);
    const notes = await c.lire('Notes annexes 2026', `/notes-annexes/associations?exerciceId=${n}`);
    const n5b = ligneDeNote(notes, '5B');
    R.montant('2026 · note 5B · acquisitions (40 + 0,77 + 10 + 3 + 6 + 15 + 5,62)', 80_390_921.29, n5b?.valeurs?.AUGMENTATIONS);
    R.montant('2026 · note 5B · réévaluation (8 000 000 + 1 000 000)', 9_000_000, n5b?.valeurs?.REEVALUATION);
    R.montant('2026 · note 5B · clôture', 89_390_921.29, n5b?.valeurs?.CLOTURE);
    R.montant('2026 · note 5C · biens pris en location-acquisition', 5_619_834.71, ligneDeNote(notes, '5C', /TOTAL IMMOBILISATIONS EN LOCATION/i)?.valeurs?.CLOTURE);
    R.montant('2026 · note 5E · amortissements à la clôture', 7_701_075.60, ligneDeNote(notes, '5E')?.valeurs?.CLOTURE);
    const rp = await c.lire('Biens sous réserve de propriété 2026', `/immobilisations/reserve-de-propriete?exerciceId=${n}`);
    R.montant('2026 · réserve de propriété · total', 6_000_000, rp?.total);
    const fp = await c.lire('Fonds de projet proposés', '/immobilisations/comptes-fonds-projet');
    R.egal('Association · aucune liste de fonds de projet', 0, (fp?.comptes ?? []).length);
    await controles(c, R, '2026 · contrôles', n, { leves: ['DECLARATION_REEVALUATION_A_DEPOSER'] });
  });

  const clos = await etape(R, 'Clôture 2026', async () => {
    const r = await c.geste('Clôture de l’exercice 2026', 'POST', `/exercices/${n}/cloturer`, {});
    await rechargerExercices(c);
    R.egal('Clôture 2026 passée', true, r !== null);
    return r !== null;
  });
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('Association · 2027 non joué');

  await etape(R, '2027 · opérations sur les biens', async () => {
    await ecriture(c, 'Loyer des photocopieurs 1/1/2027', n1, '2027-01-01', 'Loyer annuel CB-AS-2026', [['62330000', 3_000_000, 0], [BQ, 0, 3_000_000]], { journal: bq, reference: 'CB-AS-2026/1' });
    await ecriture(c, 'Règlement final du mobilier', n1, '2027-02-28', 'Règlement final mobilier', [['48162000', 6_000_000, 0], [BQ, 0, 6_000_000]], { journal: bq, reference: 'RP-AS-01' });
    await c.geste('Levée de la réserve du mobilier', 'PATCH', `/immobilisations/${b.mobilier?.id}/reserve-de-propriete`, { reserveDePropriete: true, leveeLe: '2027-02-28' });
    // Mise en service du minibus · virement de poste à poste D 2451 / C 2495.
    await c.geste('Mise en service du minibus', 'PATCH', `/immobilisations/${b.vehicule?.id}/mise-en-service`, { date: '2027-03-01', exerciceId: n1, journalId: od.id });

    const sortieOrdi = (extra) => corpsSortie(c, n1, od, {
      dateSortie: '2027-05-31', type: 'MISE_HORS_SERVICE', natureSortie: 'VOL', referencePieceSortie: 'Plainte n° 77/2027', datePieceSortie: '2027-05-31', ...extra,
    });
    await refus(c, R, '2027 · remise gratuite dans une association', 'POST', `/immobilisations/${b.ordinateurs?.id}/sortie`, sortieOrdi({ natureSortie: 'REMISE_GRATUITE' }), /projet/i);
    await refus(c, R, '2027 · restitution dans une association', 'POST', `/immobilisations/${b.ordinateurs?.id}/sortie`, sortieOrdi({ natureSortie: 'RESTITUTION' }), /projet|usufruit/i);
    await refus(c, R, '2027 · cession courante au SYCEBNL', 'POST', `/immobilisations/${b.ordinateurs?.id}/sortie`, sortieOrdi({ type: 'CESSION', natureSortie: 'VENTE', prixCession: 500_000, contrepartie: BQ, cessionCourante: true }), /654/);
    await refus(c, R, '2027 · fonds de projet dans une association', 'POST', `/immobilisations/${b.ordinateurs?.id}/sortie`, sortieOrdi({ fonds: '16500000' }), /projet/i);
    // Vol · complément 1 000 000 × 5/12 = 416 666,67 ; VNC 3 000 000 − 1 416 666,67 = 1 583 333,33 au 812.
    await c.geste('Vol des ordinateurs', 'POST', `/immobilisations/${b.ordinateurs?.id}/sortie`, sortieOrdi());

    // Groupe électrogène mis au rebut le 30/9/2027 · complément 11 000 000 / 5
    // × 9/12 = 1 650 000 ; cumul 2 200 000 + 1 650 000 = 3 850 000 ; VNC
    // 7 150 000 ; pièces 600 000 au 378 (fiche SYCEBNL du compte 37) ; 812 ·
    // 6 550 000. L'écart de 800 000 (10621) va au 118 IMPOSÉ (décision du
    // 2026-10-04) · un autre compte est refusé.
    const mc = await c.lire('Comptes du matériel récupéré (SYCEBNL)', '/immobilisations/materiel-recupere/comptes');
    R.egal('2027 · matériel récupéré · racine du SYCEBNL', '378', mc?.racine ?? null);
    const rebut = (extra) => corpsSortie(c, n1, od, {
      dateSortie: '2027-09-30', type: 'MISE_HORS_SERVICE', natureSortie: 'MISE_AU_REBUT', referencePieceSortie: 'PV de mise au rebut AS-2027-01',
      datePieceSortie: '2027-09-30', valeurMaterielRecupere: 600_000, stock: '37800000', sourceMaterielRecupere: 'Estimation du technicien (PV AS-2027-01)', ...extra,
    });
    await refus(c, R, '2027 · matériel récupéré au 371 (en cours de route)', 'POST', `/immobilisations/${b.groupe?.id}/sortie`, rebut({ stock: '37100000' }), /378/);
    await refus(c, R, '2027 · matériel récupéré au-delà de la valeur nette (7 200 000 > 7 150 000)', 'POST', `/immobilisations/${b.groupe?.id}/sortie`, rebut({ valeurMaterielRecupere: 7_200_000 }), /d[ée]passe/i);
    await refus(c, R, '2027 · écart de réévaluation vers le 112', 'POST', `/immobilisations/${b.groupe?.id}/sortie`, rebut({ reserve: '11200000' }), /118/);
    const s = await c.geste('Mise au rebut du groupe électrogène', 'POST', `/immobilisations/${b.groupe?.id}/sortie`, rebut());
    void s;
    const pr = parCompte(c, await ecrituresDeLaPiece(c, n1, 'PV de mise au rebut AS-2027-01'));
    R.montant('2027 · rebut · 378 débité', 600_000, pr['37800000']);
    R.montant('2027 · rebut · 812 (7 150 000 − 600 000)', 6_550_000, racine(pr, '812'));
    R.montant('2027 · rebut · 10621 soldé', 800_000, pr['10621000']);
    R.montant('2027 · rebut · 118 crédité', -800_000, pr['11800000']);
  });

  await etape(R, '2027 · dotations, désactualisation, contrat, états', async () => {
    await doter(c, R, '2027', 'centre (48 000 000 / 20)', b.batiment, n1, 2_400_000);
    await doter(c, R, '2027', 'composant démantèlement', b.demant, n1, 77_108.66);
    await doter(c, R, '2027', 'mobilier', b.mobilier, n1, 1_200_000);
    await doter(c, R, '2027', 'minibus', b.vehicule, n1, 2_500_000); // 15 000 000 / 5 × 10/12 (mars à décembre)
    await doter(c, R, '2027', 'photocopieurs', b.loc, n1, 1_123_966.94);
    const d = await c.geste('Désactualisation 2027 (association)', 'POST', `/immobilisations/${b.demant?.id}/demantelement/desactualisation`, { exerciceId: n1, journalId: od.id });
    R.montant('2027 · désactualisation ((771 086,58 + 77 108,66) × 10 %)', 84_819.52, d?.montant);
    // § 4 · l'autre motif de reprise · les coûts de désamiantage engagés au
    // 31/12/2027 (le site est remis en état plus tôt que prévu). La
    // désactualisation de l'exercice est déjà passée jusqu'au 31/12 · rien de
    // couru en plus. D 1984 933 014,76 / C 7911 771 086,58 / C 7971
    // 161 928,18 (77 108,66 + 84 819,52).
    const rep = await c.geste('Reprise de la provision (coûts engagés)', 'POST', `/immobilisations/${b.demant?.id}/demantelement/reprise`, {
      exerciceId: n1, journalId: od.id, date: '2027-12-31', motif: 'ENGAGEMENT_COUTS',
    });
    R.montant('2027 · reprise (coûts engagés) · total', 933_014.76, rep?.montant);
    R.montant('2027 · reprise · part d’exploitation (7911)', 771_086.58, rep?.repriseExploitation);
    R.montant('2027 · reprise · part financière (7971)', 161_928.18, rep?.repriseFinanciere);
    // Extourne 561 983,47 ; L1 · capital 2 438 016,53, intérêts 561 983,47 ;
    // courus sur 3 181 818,18 × 10 % = 318 181,82.
    await clotureContrat(c, R, '2027', 'photocopieurs', contrat, n1, od, { extourne: 561_983.47, loyers: 3_000_000, capital: 2_438_016.53, interets: 561_983.47, courus: 318_181.82 });

    await validerJusqua(c, n1, '2027-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n1);
    // 6813 · 2 400 000 + 77 108,66 + 1 200 000 + 2 500 000 + 1 123 966,94 +
    // 416 666,67 + 1 650 000 = 9 367 742,27. 2831 · 2 000 000 + 400 000 +
    // 2 400 000 + 2 × 77 108,66 = 4 954 217,32.
    soldes(R, '2027', bal, {
      [BQ]: 73_000_000, '2311': 48_771_086.58, '283': -4_954_217.32, '2411': 0, '2442': 0, '2441': 6_000_000, '2451': 15_000_000, '2495': 0,
      '2446': 5_619_834.71, '378': 600_000, '118': -800_000, '10621': 0, '10611': -7_600_000, '812': 8_133_333.33,
      '1872': -3_181_818.18, '1876': -318_181.82, '6722': 318_181.82, '6233': 0, '1984': 0, '6971': 84_819.52, '7911': -771_086.58, '7971': -161_928.18,
      '48162': 0, '6813': 9_367_742.27,
    });
    const t = await c.lire('Tableau des amortissements 2027', `/immobilisations/tableau-amortissements?exerciceId=${n1}`);
    // Parts dues à la réévaluation · centre 2 400 000 × (1 − 1/1,2) = 400 000 ;
    // groupe (complément de sortie) 1 650 000 × (1 − 1/1,1) = 150 000.
    R.montant('2027 · tableau · centre · part de l’annuité due à la réévaluation', 400_000, ligneTableau(t, b.batiment?.id)?.reevaluation?.supplement);
    R.montant('2027 · tableau · total des suppléments (400 000 + 150 000)', 550_000, t?.totaux?.supplementReevaluation);
    const n5h = await c.lire('Encadré de la note 5H 2027', `/immobilisations/reevaluation-bilan/note?exerciceId=${n1}`);
    R.montant('2027 · encadré · amortissements supplémentaires', 550_000, n5h?.total?.amortissementsSupplementaires);
    R.montant('2027 · encadré · groupe sorti · écart transféré au 118', 800_000, (n5h?.sortis ?? []).find((x) => x.immobilisationId === b.groupe?.id)?.transfereReserve);
    const notes = await c.lire('Notes annexes 2027', `/notes-annexes/associations?exerciceId=${n1}`);
    const n5b = ligneDeNote(notes, '5B');
    R.montant('2027 · note 5B · ouverture', 89_390_921.29, n5b?.valeurs?.OUVERTURE);
    R.montant('2027 · note 5B · sorties (groupe 11 000 000 + ordinateurs 3 000 000)', 14_000_000, n5b?.valeurs?.DIMINUTIONS);
    R.montant('2027 · note 5B · virement de poste à poste reçu (2495 → 2451)', 15_000_000, n5b?.valeurs?.VIREMENTS_AUGMENTATION);
    R.montant('2027 · note 5B · virement de poste à poste donné', 15_000_000, n5b?.valeurs?.VIREMENTS_DIMINUTION);
    R.montant('2027 · note 5B · acquisitions (aucune, la mise en service n’en est pas une)', 0, n5b?.valeurs?.AUGMENTATIONS);
    R.montant('2027 · note 5B · clôture', 75_390_921.29, n5b?.valeurs?.CLOTURE);
    const rp = await c.lire('Biens sous réserve de propriété 2027', `/immobilisations/reserve-de-propriete?exerciceId=${n1}`);
    R.montant('2027 · réserve de propriété · levée', 0, rp?.total);
    await controles(c, R, '2027 · contrôles', n1);
    const r = await c.geste('Clôture de l’exercice 2027', 'POST', `/exercices/${n1}/cloturer`, {});
    R.egal('Clôture 2027 passée', true, r !== null);
  });
}

// =============================================================================
// 4 · PROJET EAU POTABLE KANANGA (SYCEBNL projets de développement)
// =============================================================================
async function projet(R) {
  R.scenario = 'Immobilisations complément · SYCEBNL projet';
  const c = await nouveauDossier(R, 'Complément · Projet Eau Potable Kananga', {
    referentiel: 'SYCEBNL', jeu: 'PROJETS_DEVELOPPEMENT', cle: 'immo2-pr', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const b = {};

  await etape(R, '2026 · décaissement, acquisitions, paiements', async () => {
    // § 2.1 · D 5 / C 162 (bailleur) et C 163 (État) selon la destination.
    await ecriture(c, 'Décaissement des bailleurs', n, '2026-02-15', 'Décaissement des fonds d’investissement', [[BQ, 65_000_000, 0], ['16200000', 0, 50_000_000], ['16300000', 0, 15_000_000]], { journal: bq, reference: 'DEC-2026-01' });
    // § 2.3 · D 2 / C 481 ; § 2.4 · D 481 / C 5.
    const acquerir = (geste, champs) => bien(c, geste, n, od, { contrepartie: '48120000', dateAcquisition: '2026-03-01', dateMiseEnService: '2026-03-01', dureeAmortissementAns: 5, ...champs });
    b.vehicule = await acquerir('Véhicule du projet', { compte: '24510000', designation: 'Land Cruiser du projet', valeurOrigine: 18_000_000 });
    b.ordinateurs = await acquerir('Ordinateurs du projet', { compte: '24420000', designation: 'Ordinateurs de l’unité de gestion', valeurOrigine: 6_000_000 });
    b.groupe = await acquerir('Groupe électrogène (financé par l’État)', { compte: '24110000', designation: 'Groupe électrogène de la station', valeurOrigine: 12_000_000 });
    b.moto = await acquerir('Moto du projet', { compte: '24510000', designation: 'Moto Yamaha AG 200', valeurOrigine: 3_000_000 });
    b.mobilier = await acquerir('Mobilier du projet', { compte: '24410000', designation: 'Mobilier de l’unité de gestion', valeurOrigine: 5_000_000 });
    b.imprimante = await acquerir('Imprimante du projet', { compte: '24420000', designation: 'Imprimante grand format', valeurOrigine: 1_000_000 });
    b.pompe = await bien(c, 'Pompe immergée en cours', n, od, {
      compte: '24110000', compteEnCoursId: compte(c, '24910000'), contrepartie: '48120000', designation: 'Pompe immergée du forage F3',
      dateAcquisition: '2026-05-01', valeurOrigine: 7_000_000, dureeAmortissementAns: 10,
    });
    await ecriture(c, 'Paiement des fournisseurs d’investissements', n, '2026-06-30', 'Règlement des fournisseurs d’investissements', [['48120000', 52_000_000, 0], [BQ, 0, 52_000_000]], { journal: bq, reference: 'PAI-2026-01' });
    // « Sans amortissement, ni dépréciation » (Acte uniforme SYCEBNL, art. 7 et 9).
    await refus(c, R, '2026 · dotation d’un bien de projet', 'POST', `/immobilisations/${b.vehicule?.id}/dotation`, { exerciceId: n, journalId: od.id }, /amortissement/i);
  });

  await etape(R, '2026 · états', async () => {
    await validerJusqua(c, n, '2026-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n);
    soldes(R, '2026', bal, {
      [BQ]: 13_000_000, '162': -50_000_000, '163': -15_000_000, '2451': 21_000_000, '2442': 7_000_000, '2411': 12_000_000, '2441': 5_000_000,
      '2491': 7_000_000, '4812': 0, '28': 0, '68': 0,
    });
    const notes = await c.lire('Notes annexes du projet 2026', `/notes-annexes/projet?exerciceId=${n}`);
    const n3a = ligneDeNote(notes, '3A');
    R.montant('2026 · note 3A · acquisitions (18 + 6 + 12 + 3 + 5 + 1 + 7)', 52_000_000, n3a?.valeurs?.AUGMENTATIONS);
    R.montant('2026 · note 3A · clôture', 52_000_000, n3a?.valeurs?.CLOTURE);
    const fp = await c.lire('Fonds de projet proposés', '/immobilisations/comptes-fonds-projet');
    const numeros = (fp?.comptes ?? []).map((x) => x.numero).sort();
    R.egal('Projet · fonds proposés à la sortie (162, 163, 164)', true, numeros.length > 0 && numeros.every((x) => /^16[234]/.test(x)));
    const r = await c.geste('Clôture de l’exercice 2026', 'POST', `/exercices/${n}/cloturer`, {});
    await rechargerExercices(c);
    R.egal('Clôture 2026 passée', true, r !== null);
  });
  const n1 = c.exercices.get('2027')?.id;
  if (!n1) return R.note('Projet · 2027 non joué');

  await etape(R, '2027 · mise en service et fin du projet', async () => {
    await c.geste('Mise en service de la pompe', 'PATCH', `/immobilisations/${b.pompe?.id}/mise-en-service`, { date: '2027-02-01', exerciceId: n1, journalId: od.id });
    const sortie = (im, s) => c.geste(`Fin de projet · ${s.natureSortie} · ${s.referencePieceSortie}`, 'POST', `/immobilisations/${im?.id}/sortie`,
      corpsSortie(c, n1, s.type === 'CESSION' ? bq : od, { dateSortie: '2027-06-30', datePieceSortie: '2027-06-30', ...s }));
    const vente = { type: 'CESSION', natureSortie: 'VENTE', prixCession: 10_000_000, contrepartie: BQ, referencePieceSortie: 'Facture de cession FC-P-01', fonds: '16200000' };
    const corpsVente = (extra) => corpsSortie(c, n1, bq, { dateSortie: '2027-06-30', datePieceSortie: '2027-06-30', ...vente, ...extra });
    // § 2.5 · le fonds affecté (162, 163, 164) reprend le bien, rien d'autre.
    await refus(c, R, '2027 · sortie sans fonds affecté', 'POST', `/immobilisations/${b.vehicule?.id}/sortie`, corpsVente({ fonds: undefined }), /162, 163 ou 164/);
    await refus(c, R, '2027 · sortie sur le 165 (fonds de projet spécifique)', 'POST', `/immobilisations/${b.vehicule?.id}/sortie`, corpsVente({ fonds: '16500000' }), /n.est pas un fonds affect/i);
    await refus(c, R, '2027 · sortie sur le 462 (fonds d’administration)', 'POST', `/immobilisations/${b.vehicule?.id}/sortie`, corpsVente({ fonds: '46200000' }), /n.est pas un fonds affect/i);
    await refus(c, R, '2027 · cession courante dans un projet', 'POST', `/immobilisations/${b.vehicule?.id}/sortie`, corpsVente({ cessionCourante: true }), /654/);
    await refus(c, R, '2027 · échange déclaré en sortie dans un projet', 'POST', `/immobilisations/${b.vehicule?.id}/sortie`, corpsVente({ natureSortie: 'ECHANGE' }), /[ÉE]changer/i);
    await refus(c, R, '2027 · matériel récupéré dans un projet', 'POST', `/immobilisations/${b.imprimante?.id}/sortie`, corpsSortie(c, n1, od, {
      dateSortie: '2027-06-30', datePieceSortie: '2027-06-30', type: 'MISE_HORS_SERVICE', natureSortie: 'MISE_AU_REBUT', referencePieceSortie: 'PV P-05',
      fonds: '16200000', valeurMaterielRecupere: 100_000, stock: '37800000', sourceMaterielRecupere: 'Estimation',
    }), /projet/i);
    // § 2.5.1 · cession · D 162 / C 2 du bien, puis D 5 / C 82 du prix.
    await sortie(b.vehicule, vente);
    // § 2.5.2 · remise gratuite ; § 2.5.3 · restitution, vol, destruction, rebut ·
    // D 162 (163 pour le bien de l'État) / C 2, sans 28 ni 81.
    await sortie(b.ordinateurs, { type: 'MISE_HORS_SERVICE', natureSortie: 'REMISE_GRATUITE', referencePieceSortie: 'PV de remise du bailleur n° 7', fonds: '16200000' });
    await sortie(b.groupe, { type: 'MISE_HORS_SERVICE', natureSortie: 'RESTITUTION', referencePieceSortie: 'PV de restitution à l’État n° 3', fonds: '16300000' });
    await sortie(b.moto, { type: 'MISE_HORS_SERVICE', natureSortie: 'VOL', referencePieceSortie: 'Plainte n° 45/2027', fonds: '16200000' });
    await sortie(b.mobilier, { type: 'MISE_HORS_SERVICE', natureSortie: 'DESTRUCTION', referencePieceSortie: 'PV de destruction (incendie) n° P-02', fonds: '16200000' });
    await sortie(b.imprimante, { type: 'MISE_HORS_SERVICE', natureSortie: 'MISE_AU_REBUT', referencePieceSortie: 'PV de mise au rebut n° P-05', fonds: '16200000' });

    const fc = parCompte(c, await ecrituresDeLaPiece(c, n1, 'Facture de cession FC-P-01'));
    R.montant('2027 · cession · 162 débité de la valeur d’entrée', 18_000_000, fc['16200000']);
    R.montant('2027 · cession · prix au 822', -10_000_000, racine(fc, '822'));
    R.montant('2027 · cession · aucun 81', 0, racine(fc, '81'));
    R.montant('2027 · cession · aucun 28', 0, racine(fc, '28'));
    for (const [cle, ref, fonds, montant, nature] of [
      ['ordinateurs', 'PV de remise du bailleur n° 7', '16200000', 6_000_000, 'remise gratuite'],
      ['groupe', 'PV de restitution à l’État n° 3', '16300000', 12_000_000, 'restitution'],
      ['moto', 'Plainte n° 45/2027', '16200000', 3_000_000, 'vol'],
      ['mobilier', 'PV de destruction (incendie) n° P-02', '16200000', 5_000_000, 'destruction'],
      ['imprimante', 'PV de mise au rebut n° P-05', '16200000', 1_000_000, 'mise au rebut'],
    ]) {
      const ecr = await ecrituresDeLaPiece(c, n1, ref);
      const m = parCompte(c, ecr);
      R.montant(`2027 · ${cle} · fonds ${fonds.slice(0, 3)} débité`, montant, m[fonds]);
      R.montant(`2027 · ${cle} · ni 81 ni 82`, 0, racine(m, '81') + racine(m, '82'));
      R.egal(`2027 · ${cle} · libellé « Fin de projet » avec sa nature`, true, ecr.some((e) => (e.libelle ?? '').startsWith('Fin de projet') && (e.libelle ?? '').includes(`(${nature})`)));
    }
  });

  await etape(R, '2027 · états', async () => {
    await validerJusqua(c, n1, '2027-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n1);
    // 162 · 50 − (18 + 6 + 3 + 5 + 1) = 17 000 000 ; 163 · 15 − 12 = 3 000 000 ;
    // banque · 13 + 10 = 23 000 000 ; seule la pompe reste, au 2411.
    soldes(R, '2027', bal, {
      [BQ]: 23_000_000, '162': -17_000_000, '163': -3_000_000, '822': -10_000_000, '81': 0, '28': 0,
      '2411': 7_000_000, '2491': 0, '2451': 0, '2442': 0, '2441': 0,
    });
    const notes = await c.lire('Notes annexes du projet 2027', `/notes-annexes/projet?exerciceId=${n1}`);
    const n3a = ligneDeNote(notes, '3A');
    R.montant('2027 · note 3A · ouverture', 52_000_000, n3a?.valeurs?.OUVERTURE);
    R.montant('2027 · note 3A · sorties de fin de projet (18 + 6 + 12 + 3 + 5 + 1)', 45_000_000, n3a?.valeurs?.DIMINUTIONS);
    R.montant('2027 · note 3A · virement reçu (2491 → 2411)', 7_000_000, n3a?.valeurs?.VIREMENTS_AUGMENTATION);
    R.montant('2027 · note 3A · virement donné', 7_000_000, n3a?.valeurs?.VIREMENTS_DIMINUTION);
    R.montant('2027 · note 3A · clôture (la pompe)', 7_000_000, n3a?.valeurs?.CLOTURE);
    await controles(c, R, '2027 · contrôles', n1);
    const r = await c.geste('Clôture de l’exercice 2027', 'POST', `/exercices/${n1}/cloturer`, {});
    R.egal('Clôture 2027 passée', true, r !== null);
  });
}
