/**
 * SCÉNARIO « IMMOBILISATIONS » · le module des immobilisations avancées, dans
 * les deux référentiels, sur 2026 (N) et 2027 (N+1), clôtures comprises.
 *
 * Quatre dossiers, parce que certaines opérations s'excluent dans un même
 * dossier · la réévaluation légale porte sur TOUT le périmètre des 22 à 24, 26
 * et 27 (AUDCIF art. 62 ; loi n° 23/053, art. 130) et s'arrête devant un bien
 * sous option dégressive fiscale (décision D-36) · elle a donc son dossier.
 *
 *  1. SYSCOHADA normal · « Industries du Katanga SARL » · composants et
 *     renouvellement, composant « révisions majeures », dépréciation et reprise
 *     plafonnée, unités d'œuvre, dégressif fiscal et dérogatoire, amortissement
 *     exceptionnel, coûts d'emprunt d'un bien en cours puis mise en service,
 *     marque à durée non limitée puis limitée, révisions du plan, prix global,
 *     rente viagère, cession avec dotation arrêtée à la sortie.
 *  2. SYSCOHADA normal · « Immobilière du Lac SARL » · réévaluation légale à la
 *     clôture de 2026 (écart au 1061 et au 154), sorties de 2027 (reprise du
 *     154 au 861, 1061 vers une réserve non distribuable choisie), reprise
 *     annuelle de la provision spéciale.
 *  3. SYCEBNL associations · « Association Solidarité du Kwilu » · dégressif
 *     comptable au taux de la loi, legs grevé de dettes (4861, 167, reprise au
 *     7923), subvention en numéraire rattachée (reprise au 799), donation
 *     temporaire d'usufruit (2011, 171, reprise au 7961).
 *  4. SYCEBNL associations · « Fondation Lumière de Kisangani » · réévaluation
 *     de 2026 (10611), sortie de 2027 vers le 118 imposé.
 *
 * TOUS LES ATTENDUS SONT CALCULÉS À LA MAIN depuis le texte et les données du
 * banc, le calcul écrit à côté du contrôle. Conventions lues aux sources ·
 * annuité linéaire = base / durée, première annuité au prorata « à compter du
 * premier jour du mois de mise en service » (loi n° 23/053, art. 30 et 34),
 * mois de sortie compris (fiche du compte 81 ; Guide, Application 16,
 * « 180 × 9/12 »).
 */
import { aplatir, balance, compte, ecriture, etape, nouveauDossier, rechargerComptes, rechargerExercices, solde, validerJusqua } from './lib.mjs';

const BQ = '52110000';

// --- Outils du scénario ------------------------------------------------------

/** Ouverture au 1er janvier 2026 · la banque et la dotation en capital (ou dotation de l'association). */
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
    if (!motif.test(texte)) R.note(`${libelle} · corps lu · ${texte.slice(0, 300)}`);
  }
  return r;
}

/** La ligne « TOTAL GÉNÉRAL » d'une note (ou la ligne dont le libellé correspond). */
function ligneDeNote(notes, code, motif = /TOTAL G[EÉ]N[EÉ]RAL/i) {
  return (notes?.notes ?? []).filter((x) => x.code === code).flatMap((x) => x.lignes ?? []).find((l) => motif.test(l.libelle ?? ''));
}

/** Le total d'une note · « TOTAL GÉNÉRAL », à défaut la dernière ligne de total. */
function totalDeNote(notes, code) {
  const lignes = (notes?.notes ?? []).filter((x) => x.code === code).flatMap((x) => x.lignes ?? []);
  return lignes.find((l) => /TOTAL G[EÉ]N[EÉ]RAL/i.test(l.libelle ?? '')) ?? [...lignes].reverse().find((l) => l.estTotal);
}

/** La ligne d'un bien au tableau des amortissements de l'exercice. */
function ligneTableau(t, id) {
  return (t?.groupes ?? []).flatMap((g) => g.lignes ?? []).find((l) => l.id === id);
}

/** Les contrôles d'immobilisations qui ne doivent PAS se lever · tout passe par le module. */
async function controlesImmobilisations(c, R, libelle, exerciceId, attendus = []) {
  const rapport = await c.lire(`Contrôles ${libelle}`, `/controles?exerciceId=${exerciceId}`);
  if (!rapport) return;
  const leves = new Set((rapport.anomalies ?? []).map((a) => a.code));
  for (const code of ['IMMO_SANS_DOTATION', 'AMORTISSEMENT_IMMO_HORS_MODULE', 'DEPRECIATION_IMMO_HORS_MODULE', 'REEVALUATION_IMMO_HORS_MODULE']) {
    R.egal(`${libelle} · contrôle ${code} non levé (tout passe par le module)`, false, leves.has(code));
    if (leves.has(code)) {
      const a = rapport.anomalies.find((x) => x.code === code);
      R.note(`${libelle} · ${code} · ${(a.occurrences ?? []).slice(0, 5).map((o) => `${o.reference ?? ''} ${o.detail ?? ''}`).join(' | ')}`);
    }
  }
  for (const code of attendus) R.egal(`${libelle} · contrôle ${code} levé`, true, leves.has(code));
  R.note(`${libelle} · contrôles levés · ${[...leves].sort().join(', ')}`);
}

/** Les soldes attendus d'une balance · { racine: solde débit moins crédit }. */
function soldes(R, an, b, attendus) {
  R.montant(`${an} · balance équilibrée`, 0, b ? b.totalDebit - b.totalCredit : null);
  for (const [racine, m] of Object.entries(attendus)) R.montant(`${an} · solde ${racine}`, m, solde(b, racine));
}

export default async function scenarioImmobilisations(registre) {
  await industrie(registre);
  await immobiliere(registre);
  await association(registre);
  await fondation(registre);
}

// =============================================================================
// 1 · INDUSTRIES DU KATANGA SARL (SYSCOHADA normal)
// =============================================================================
async function industrie(R) {
  R.scenario = 'Immobilisations · SYSCOHADA industrie';
  const c = await nouveauDossier(R, 'Immobilisations · Industries du Katanga SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'immo-ind', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const b = {};

  await etape(R, 'Paramètres et ouverture', async () => {
    // « Les sociétés peuvent opter » pour le dégressif (loi n° 23/053, art. 31).
    await c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await ouverture(c, n, '10130000', 600_000_000);
  });

  await etape(R, '2026 · acquisitions', async () => {
    // APPROCHE PAR COMPOSANTS (AUDCIF Titre VIII ch. 4) · structure 100 000 000
    // sur 25 ans, ascenseur 10 000 000 sur 10 ans, chacun son plan (§ 1).
    b.structure = await bien(c, 'Immeuble industriel (structure)', n, bq, {
      compte: '23110000', designation: 'Usine de Likasi · structure', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 100_000_000, dureeAmortissementAns: 25,
    });
    b.ascenseur = await bien(c, 'Composant ascenseur', n, bq, {
      compte: '23110000', designation: 'Usine de Likasi · ascenseur', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 10_000_000, dureeAmortissementAns: 10, immobilisationPrincipaleId: b.structure?.id, typeComposant: 'COMPOSANT',
      justificationDecomposition: 'Durée d’utilité de dix ans contre vingt-cinq pour la structure, coût significatif (fiche du fabricant)',
    });
    // RÉVISIONS MAJEURES (ch. 5 § 1, exemple 190 000 000 sur six ans, révision
    // 10 000 000 tous les deux ans) · ici 57 000 000 sur six ans et une révision
    // de 3 000 000 sur l'intervalle de deux ans. Une durée égale à la structure
    // n'est pas une révision · refusée.
    b.four = await bien(c, 'Four industriel (structure)', n, bq, {
      compte: '24110000', designation: 'Four de cuisson · structure', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 57_000_000, dureeAmortissementAns: 6,
    });
    await refus(c, R, 'Révision majeure amortie sur la durée de la structure', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24110000'), designation: 'Four · révision (durée fausse)', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 3_000_000, dureeAmortissementAns: 6, modeAmortissement: 'LINEAIRE', compteContrepartieId: compte(c, BQ), exerciceId: n, journalId: bq.id,
      immobilisationPrincipaleId: b.four?.id, typeComposant: 'REVISION_MAJEURE', justificationDecomposition: 'Révision tous les deux ans',
    }, /r[ée]vision|ch\. 5/i);
    b.revision = await bien(c, 'Composant révisions majeures', n, bq, {
      compte: '24110000', designation: 'Four de cuisson · révisions majeures', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 3_000_000, dureeAmortissementAns: 2, immobilisationPrincipaleId: b.four?.id, typeComposant: 'REVISION_MAJEURE',
      justificationDecomposition: 'Révision imposée par le constructeur tous les deux ans, coût fiable (devis)',
    });
    // DÉPRÉCIATION (ch. 12 § 2.4.2, exemple de 30 000 000 sur dix ans).
    b.presse = await bien(c, 'Presse hydraulique', n, bq, {
      compte: '24110000', designation: 'Presse hydraulique', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 30_000_000, dureeAmortissementAns: 10,
    });
    // UNITÉS D'ŒUVRE (AUDCIF art. 45 ; glossaire) · 400 000 km prévus.
    b.camion = await bien(c, 'Camion benne aux unités d’œuvre', n, bq, {
      compte: '24510000', designation: 'Camion benne', dateAcquisition: '2026-04-01', dateMiseEnService: '2026-04-01',
      valeurOrigine: 24_000_000, dureeAmortissementAns: 5, modeAmortissement: 'UNITES_DOEUVRE', unitesOeuvrePrevues: 400_000, uniteOeuvreLibelle: 'kilomètres',
    });
    // DÉGRESSIF FISCAL ET EXCEPTIONNEL (loi n° 23/053, art. 31 à 38) · deux biens
    // neufs de la catégorie 1° de l'art. 31, linéaires en comptabilité.
    b.ligne = await bien(c, 'Ligne d’embouteillage (dégressif)', n, bq, {
      compte: '24110000', designation: 'Ligne d’embouteillage', dateAcquisition: '2026-03-01', dateMiseEnService: '2026-03-01',
      valeurOrigine: 20_000_000, dureeAmortissementAns: 5,
    });
    b.conditionneuse = await bien(c, 'Machine de conditionnement (exceptionnel)', n, bq, {
      compte: '24110000', designation: 'Machine de conditionnement', dateAcquisition: '2026-06-01', dateMiseEnService: '2026-06-01',
      valeurOrigine: 10_000_000, dureeAmortissementAns: 5,
    });
    // INCORPOREL À DURÉE NON LIMITÉE (ch. 2 § 4.2.2) · marque acquise.
    b.marque = await bien(c, 'Marque « Katanga Brew »', n, bq, {
      compte: '21400000', designation: 'Marque Katanga Brew', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 8_000_000, dureeNonLimitee: true,
      justificationDureeNonLimitee: 'Marque protégée, renouvelable sans limite, aucune fin prévisible des avantages (étude de marché 2025)',
    });
    // RÉVISIONS DU PLAN (décision D-24).
    b.mobilier = await bien(c, 'Mobilier de bureau (révision prospective)', n, bq, {
      compte: '24440000', designation: 'Mobilier du siège', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 6_000_000, dureeAmortissementAns: 6,
    });
    b.bureau = await bien(c, 'Matériel de bureau (révision rétroactive)', n, bq, {
      compte: '24410000', designation: 'Matériel de bureau', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 12_000_000, dureeAmortissementAns: 4,
    });
    // CESSION DE 2027 (fiche du compte 81).
    b.pickup = await bien(c, 'Pick-up de livraison', n, bq, {
      compte: '24510000', designation: 'Pick-up de livraison', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 18_000_000, dureeAmortissementAns: 5,
    });
  });

  await etape(R, '2026 · option du dégressif et de l’amortissement exceptionnel', async () => {
    await c.geste('Option dégressive · ligne d’embouteillage', 'POST', `/immobilisations/${b.ligne?.id}/option-degressif`, {
      categorie: 'MATERIEL_INDUSTRIEL', bienNeuf: true, dureeFiscaleAns: 5,
    });
    // Art. 36 · prorata à l'export « au moins égal à 20 % » · 15 % est refusé.
    await refus(c, R, 'Exceptionnel sous 20 % d’export', 'POST', `/immobilisations/${b.conditionneuse?.id}/option-degressif`, {
      categorie: 'MATERIEL_INDUSTRIEL', bienNeuf: true, dureeFiscaleAns: 5, exceptionnel: true, activiteIndustrielle: true,
      chiffreAffairesExportHt: 15_000_000, chiffreAffairesTotalHt: 100_000_000, sourceChiffreAffaires: 'Déclaration TVA 2026',
    }, /20 %/);
    await c.geste('Option exceptionnelle · machine de conditionnement', 'POST', `/immobilisations/${b.conditionneuse?.id}/option-degressif`, {
      categorie: 'MATERIEL_INDUSTRIEL', bienNeuf: true, dureeFiscaleAns: 5, exceptionnel: true, activiteIndustrielle: true,
      chiffreAffairesExportHt: 30_000_000, chiffreAffairesTotalHt: 100_000_000, sourceChiffreAffaires: 'Déclaration TVA 2026',
    });
  });

  await etape(R, '2026 · bien en cours et coûts d’emprunt (ch. 7)', async () => {
    // Exemple du ch. 7 § 2.2.3 ramené à 60 000 000 · emprunt du 1er mars 2026 à
    // 12 %, construction du 1er avril 2026 au 30 juin 2027, placement temporaire
    // des fonds rapportant 400 000.
    await ecriture(c, 'Emprunt bancaire du siège', n, '2026-03-01', 'Emprunt BCDC siège social', [[BQ, 60_000_000, 0], ['16200000', 0, 60_000_000]], { journal: bq });
    b.siege = await bien(c, 'Siège social en construction', n, bq, {
      compte: '23130000', compteEnCoursId: compte(c, '23910000'), designation: 'Siège social de Lubumbashi', dateAcquisition: '2026-04-01',
      valeurOrigine: 60_000_000, dureeAmortissementAns: 25,
    });
    // Intérêts de 2026 · 60 000 000 × 12 % × 10/12 = 6 000 000 (mars à décembre).
    await ecriture(c, 'Intérêts de l’emprunt 2026', n, '2026-12-31', 'Intérêts emprunt siège 2026', [['67120000', 6_000_000, 0], [BQ, 0, 6_000_000]], { journal: bq });
    // Incorporable · 60 000 000 × 12 % × 9/12 − 400 000 = 5 000 000 (ch. 7 § 2.1).
    const inc = await c.geste('Coûts d’emprunt incorporés 2026', 'POST', `/immobilisations/${b.siege?.id}/couts-emprunt`, {
      exerciceId: n, journalId: od.id, nature: 'SPECIFIQUE', debutPreparation: '2026-04-01', finPreparation: '2027-06-30',
      dateDebut: '2026-04-01', dateFin: '2026-12-31', base: 60_000_000, tauxPourcent: 12, produitsPlacement: 400_000,
    });
    R.montant('2026 · coûts d’emprunt incorporés (60 000 000 × 12 % × 9/12 − 400 000)', 5_000_000, inc?.montant);
  });

  await etape(R, '2026 · prix global et rente viagère', async () => {
    // PRIX GLOBAL (AUDCIF art. 38 ; Titre VIII ch. 11 § 1.7.1) · terrain évalué
    // par comparaison (12 000 000), bâtiment par différence · 50 000 000 −
    // 12 000 000 = 38 000 000.
    const pg = await c.geste('Acquisition à prix global', 'POST', '/immobilisations/prix-global', {
      exerciceId: n, journalId: bq.id, dateAcquisition: '2026-02-01', referenceActe: 'Acte notarié n° 125/2026', compteContrepartieId: compte(c, BQ),
      prix: 50_000_000, nature: 'ENSEMBLE', fondement: 'COMPARAISON_TERRAINS_NUS', sourceValeurs: 'Cadastre de Lubumbashi, ventes de terrains nus 2025',
      biens: [
        { compteImmobilisationId: compte(c, '22320000'), designation: 'Terrain du dépôt', montant: 12_000_000 },
        { compteImmobilisationId: compte(c, '23130000'), designation: 'Dépôt de Kipushi', parDifference: true, dureeAmortissementAns: 20, dateMiseEnService: '2026-02-01' },
      ],
    });
    const liste = (await c.lire('Biens du dossier', '/immobilisations')) ?? [];
    const tous = Array.isArray(liste) ? liste : (liste.immobilisations ?? liste.lignes ?? []);
    b.terrain = tous.find((x) => x.designation === 'Terrain du dépôt');
    b.depot = tous.find((x) => x.designation === 'Dépôt de Kipushi');
    R.montant('2026 · prix global · terrain par comparaison', 12_000_000, b.terrain?.valeurOrigine);
    R.montant('2026 · prix global · bâtiment par différence (50 000 000 − 12 000 000)', 38_000_000, b.depot?.valeurOrigine);
    if (!pg) R.note('Prix global refusé · les deux biens manquent');
    // RENTE VIAGÈRE (Titre VIII ch. 11 § 2) · prix stipulé 40 000 000, bouquet
    // 10 000 000 en banque, 30 000 000 au 1681 (§ 2.3.1).
    b.viager = await c.geste('Immeuble acquis en viager', 'POST', '/immobilisations/prix-aleatoire', {
      nature: 'RENTE_VIAGERE', compteImmobilisationId: compte(c, '23130000'), designation: 'Immeuble de Kolwezi (viager)',
      dateAcquisition: '2026-07-01', dateMiseEnService: '2026-07-01', valeurOrigine: 40_000_000, dureeAmortissementAns: 20,
      fondement: 'PRIX_STIPULE', sourceValeur: 'Acte de vente en viager n° 77/2026', compteDetteId: compte(c, '16810000'),
      comptant: 10_000_000, compteComptantId: compte(c, BQ), exerciceId: n, journalId: bq.id,
    });
    // § 2.3.2 · chaque versement débite le 1681 en entier.
    await ecriture(c, 'Rente viagère du second semestre 2026', n, '2026-12-31', 'Rente viagère 2026', [['16810000', 3_000_000, 0], [BQ, 0, 3_000_000]], { journal: bq });
  });

  await etape(R, '2026 · dotations, dépréciation, dérogatoires', async () => {
    // Linéaire · base / durée × mois / 12.
    await doter(c, R, '2026', 'structure', b.structure, n, 4_000_000); // 100 000 000 / 25
    await doter(c, R, '2026', 'ascenseur', b.ascenseur, n, 1_000_000); // 10 000 000 / 10
    await doter(c, R, '2026', 'four', b.four, n, 9_500_000); // 57 000 000 / 6
    await doter(c, R, '2026', 'révisions majeures', b.revision, n, 1_500_000); // 3 000 000 / 2
    await doter(c, R, '2026', 'presse', b.presse, n, 3_000_000); // 30 000 000 / 10
    // Unités d'œuvre · pas de dotation sans relevé, puis 24 000 000 × 60 000 /
    // 400 000 = 3 600 000, sans prorata temporis (glossaire).
    await refus(c, R, '2026 · camion · dotation sans relevé d’unités', 'POST', `/immobilisations/${b.camion?.id}/dotation`, { exerciceId: n, journalId: od.id });
    await c.geste('Relevé 2026 du camion', 'POST', `/immobilisations/${b.camion?.id}/consommation`, { exerciceId: n, unitesConsommees: 60_000, source: 'Compteur kilométrique relevé le 31/12/2026' });
    await doter(c, R, '2026', 'camion', b.camion, n, 3_600_000);
    await doter(c, R, '2026', 'ligne d’embouteillage', b.ligne, n, 3_333_333.33); // 20 000 000 / 5 × 10/12
    await doter(c, R, '2026', 'machine de conditionnement', b.conditionneuse, n, 1_166_666.67); // 10 000 000 / 5 × 7/12
    await refus(c, R, '2026 · marque à durée non limitée · dotation', 'POST', `/immobilisations/${b.marque?.id}/dotation`, { exerciceId: n, journalId: od.id }, /non limit|n'est pas amorti|pas amorti/i);
    await doter(c, R, '2026', 'mobilier', b.mobilier, n, 1_000_000); // 6 000 000 / 6
    await doter(c, R, '2026', 'matériel de bureau', b.bureau, n, 3_000_000); // 12 000 000 / 4
    await doter(c, R, '2026', 'pick-up', b.pickup, n, 3_600_000); // 18 000 000 / 5
    await doter(c, R, '2026', 'dépôt (prix global)', b.depot, n, 1_741_666.67); // 38 000 000 / 20 × 11/12
    await refus(c, R, '2026 · terrain · dotation', 'POST', `/immobilisations/${b.terrain?.id}/dotation`, { exerciceId: n, journalId: od.id });
    await doter(c, R, '2026', 'immeuble en viager', b.viager, n, 1_000_000); // 40 000 000 / 20 × 6/12
    await refus(c, R, '2026 · siège en cours · dotation', 'POST', `/immobilisations/${b.siege?.id}/dotation`, { exerciceId: n, journalId: od.id }, /mis en service|AUDCIF art\. 45/i);

    // Dépréciation · VNC 27 000 000, valeur actuelle 22 500 000 · 4 500 000
    // au 2941 par le 6914 (ch. 12 § 2.3.2 ; seed 6914 « immobilisations
    // corporelles »).
    const dep = await c.geste('Dépréciation 2026 de la presse', 'POST', `/immobilisations/${b.presse?.id}/depreciation`, {
      exerciceId: n, journalId: od.id, sens: 'DOTATION', montant: 4_500_000, compteDepreciationId: compte(c, '29410000'),
      compteContrepartieId: compte(c, '69140000'), indice: 'Prix du même matériel neuf en forte baisse (catalogue fournisseur 2026)',
    });
    R.egal('2026 · dépréciation de la presse passée', true, Boolean(dep));

    // Dérogatoire · art. 33 et 34 · 20 000 000 × (1/5 × 2) × 10/12 =
    // 6 666 666.67 ; écart avec la dotation comptable 3 333 333.33 ·
    // 3 333 333.34 au 851 / 151.
    const plan = await c.lire('Plan fiscal · ligne d’embouteillage', `/immobilisations/${b.ligne?.id}/plan-fiscal`);
    const l26 = plan?.lignes?.find((l) => l.exerciceId === n);
    R.montant('2026 · ligne · annuité fiscale (20 000 000 × 40 % × 10/12)', 6_666_666.67, l26?.annuiteFiscale);
    const d1 = await c.geste('Dérogatoire 2026 · ligne', 'POST', `/immobilisations/${b.ligne?.id}/derogatoire`, { exerciceId: n, journalId: od.id });
    R.montant('2026 · ligne · dérogatoire doté (6 666 666.67 − 3 333 333.33)', 3_333_333.34, d1?.dotation);
    // Exceptionnel · art. 38, 1° · 60 % plein la première période (D-8) ·
    // 6 000 000 ; dérogatoire 6 000 000 − 1 166 666.67 = 4 833 333.33.
    const planE = await c.lire('Plan fiscal · conditionneuse', `/immobilisations/${b.conditionneuse?.id}/plan-fiscal`);
    R.montant('2026 · conditionneuse · annuité exceptionnelle (60 % de 10 000 000)', 6_000_000, planE?.lignes?.find((l) => l.exerciceId === n)?.annuiteFiscale);
    const d2 = await c.geste('Dérogatoire 2026 · conditionneuse', 'POST', `/immobilisations/${b.conditionneuse?.id}/derogatoire`, { exerciceId: n, journalId: od.id });
    R.montant('2026 · conditionneuse · dérogatoire doté (6 000 000 − 1 166 666.67)', 4_833_333.33, d2?.dotation);
  });

  await etape(R, '2026 · reconstitution d’une révision majeure', async () => {
    // Ch. 5 § 1 · l'estimation ne vise que le bien dont la révision « n'a pas
    // été comptabilisée séparément » · le four porte la sienne, elle se lit et
    // ne s'estime pas (refus attendu). Le pick-up n'en porte pas · « coût de
    // révision actuel amorti », comme si la révision avait été faite à
    // l'acquisition · 4 000 000 sur un intervalle de deux ans, une année écoulée
    // (du 01/01/2026 au 01/01/2027) · 2 000 000 amortis.
    await refus(c, R, 'Reconstitution sur un bien qui porte déjà sa révision', 'GET',
      `/immobilisations/${b.four?.id}/reconstitution-revision-majeure?coutRevisionActuel=4000000&intervalleRevisionsAns=2&dateReconstitution=2027-01-01`, undefined, /d[ée]j[àa] un composant/i);
    const q = (date) => `/immobilisations/${b.pickup?.id}/reconstitution-revision-majeure?coutRevisionActuel=4000000&intervalleRevisionsAns=2&dateReconstitution=${date}`;
    const r = await c.lire('Reconstitution au 01/01/2027', q('2027-01-01'));
    R.egal('Reconstitution · possible', true, r?.possible);
    R.montant('Reconstitution · amortissement estimé (4 000 000 × 1 an / 2 ans)', 2_000_000, r?.amortissementEstime);
    R.montant('Reconstitution · valeur nette estimée', 2_000_000, r?.valeurNetteEstimee);
    // Au-delà d'un intervalle, la date de la dernière révision réalisée est exigée.
    const r2 = await c.lire('Reconstitution au 30/06/2028', q('2028-06-30'));
    R.egal('Reconstitution au-delà d’un intervalle · non calculée', false, r2?.possible);
  });

  await etape(R, '2026 · contrôles, états et notes', async () => {
    await validerJusqua(c, n, '2026-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n);
    // Brut · 2311 110 000 000 ; 2411 57 + 3 + 30 + 20 + 10 = 120 000 000 ;
    // 2451 24 + 18 = 42 000 000 ; 2391 60 + 5 = 65 000 000 ; 2313 38 + 40 =
    // 78 000 000. Amortissements · 2831 4 + 1 + 1.74166667 + 1 = 7 741 666.67 ;
    // 2841 9.5 + 1.5 + 3 + 3.33333333 + 1.16666667 = 18 500 000 ; 2845 3.6 +
    // 3.6 = 7 200 000 ; 2844 1 + 3 = 4 000 000. Banque · 600 + 60 − 427 =
    // 233 000 000 (acquisitions, intérêts, bouquet et rente).
    soldes(R, '2026', bal, {
      [BQ]: 233_000_000, '2311': 110_000_000, '2411': 120_000_000, '2451': 42_000_000, '2391': 65_000_000, '2140': 8_000_000,
      '2444': 6_000_000, '2441': 12_000_000, '2232': 12_000_000, '2313': 78_000_000,
      '2831': -7_741_666.67, '2841': -18_500_000, '2845': -7_200_000, '2844': -4_000_000, '2814': 0, '2941': -4_500_000,
      '151': -8_166_666.67, '162': -60_000_000, '1681': -27_000_000,
      '6813': 37_441_666.67, '6812': 0, '6914': 4_500_000, '851': 8_166_666.67, '7221': -5_000_000, '6712': 6_000_000,
    });
    // Résultat · 5 000 000 − (37 441 666.67 + 4 500 000 + 6 000 000 + 8 166 666.67).
    R.montant('2026 · résultat (classes 6 à 8)', -51_108_333.34, -(solde(bal, '6') + solde(bal, '7') + solde(bal, '8')));

    const t = await c.lire('Tableau des amortissements 2026', `/immobilisations/tableau-amortissements?exerciceId=${n}`);
    R.montant('2026 · tableau · dotations de l’exercice (6813 + 6812)', 37_441_666.67, t?.totaux?.dotation);
    R.montant('2026 · tableau · presse · dépréciations', 4_500_000, ligneTableau(t, b.presse?.id)?.depreciations);
    R.montant('2026 · tableau · presse · valeur nette (30 − 3 − 4.5)', 22_500_000, ligneTableau(t, b.presse?.id)?.valeurNette);
    R.montant('2026 · tableau · marque non amortie · dotation', 0, ligneTableau(t, b.marque?.id)?.dotation ?? 0);

    const notes = await c.lire('Notes annexes 2026', `/etats-financiers-syscohada/notes?exerciceId=${n}`);
    const n3a = ligneDeNote(notes, '3A');
    R.montant('2026 · note 3A · ouverture', 0, n3a?.valeurs?.OUVERTURE);
    R.montant('2026 · note 3A · acquisitions (453 000 000, coûts d’emprunt compris)', 453_000_000, n3a?.valeurs?.AUGMENTATIONS);
    R.montant('2026 · note 3A · clôture', 453_000_000, n3a?.valeurs?.CLOTURE);
    const n3c = ligneDeNote(notes, '3C');
    R.montant('2026 · note 3C · amortissements à la clôture', 37_441_666.67, n3c?.valeurs?.CLOTURE);
    const emp = await c.lire('Coûts d’emprunt incorporés 2026', `/immobilisations/couts-emprunt-incorpores?exerciceId=${n}`);
    R.montant('2026 · note des coûts d’emprunt · montant incorporé', 5_000_000,
      emp?.total ?? (emp?.lignes ?? (Array.isArray(emp) ? emp : [])).reduce((s, l) => s + Number(l.montant ?? 0), 0));

    const bil = aplatir(await c.lire('Bilan 2026', `/etats-financiers-syscohada/bilan?exerciceId=${n}`));
    R.montant('2026 · bilan · actif égal au passif', 0, bil.BZ?.n != null && bil.DZ?.n != null ? bil.BZ.n - bil.DZ.n : null);
    const tft = aplatir(await c.lire('Flux de trésorerie 2026', `/etats-financiers-syscohada/tableau-flux-tresorerie?exerciceId=${n}`));
    R.montant('2026 · TFT · trésorerie à l’ouverture (ZA)', 600_000_000, tft.ZA?.n);
    R.montant('2026 · TFT · trésorerie à la clôture (ZH, banque)', 233_000_000, tft.ZH?.n);
    await controlesImmobilisations(c, R, '2026 · contrôles', n);
  });

  const clos = await etape(R, 'Clôture 2026', async () => {
    const r = await c.geste('Clôture de l’exercice 2026', 'POST', `/exercices/${n}/cloturer`, {});
    await rechargerExercices(c);
    return r !== null;
  });
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('Industrie · 2027 non joué · clôture de 2026 refusée ou 2027 absent');

  await etape(R, '2027 · opérations sur les biens', async () => {
    // Révisions du plan, AVANT les dotations de l'exercice (D-24).
    // Prospective · le reliquat de 5 000 000 sur deux ans résiduels · 2 500 000.
    const p = await c.geste('Révision prospective du mobilier', 'POST', `/immobilisations/${b.mobilier?.id}/revision-plan`, {
      nature: 'PROSPECTIVE', dateDecision: '2027-03-01', nouvelleDureeAns: 2, motif: 'Déménagement du siège prévu fin 2028, mobilier abandonné',
    });
    R.montant('2027 · mobilier · durée totale après révision (1 an écoulé + 2)', 3, p?.dureeAmortissementAns);
    // Rétroactive · plan rejoué sur six ans · 2026 aurait doté 2 000 000 au lieu
    // de 3 000 000 · reprise 1 000 000 D 2844 / C 798.
    const r = await c.geste('Révision rétroactive du matériel de bureau', 'POST', `/immobilisations/${b.bureau?.id}/revision-plan`, {
      nature: 'RETROACTIVE', dateDecision: '2027-02-01', nouvelleDureeAns: 6, motif: 'Erreur d’estimation de la durée d’utilité, constat du fournisseur', journalId: od.id,
    });
    R.montant('2027 · matériel de bureau · reprise au 798 (3 000 000 − 2 000 000)', 1_000_000, r?.montantReprise);

    // Marque · la durée devient limitée le 1er juillet 2027 · quatre ans
    // résiduels, plan à compter de la décision (ch. 2 § 4.2.2, exemple).
    await c.geste('Marque · durée devenue limitée', 'POST', `/immobilisations/${b.marque?.id}/duree-limitee`, {
      dateDecision: '2027-07-01', dureeResiduelleAns: 4, motif: 'Abandon de la marque décidé pour le 30 juin 2031',
      testDepreciation: 'Valeur actuelle supérieure à la valeur comptable (évaluation du 30/06/2027) · aucune dépréciation',
    });

    // Coûts d'emprunt de 2027 · le plafond (intérêts de l'exercice) refuse
    // tant qu'aucun intérêt de 2027 n'est passé (ch. 7 § 2.1).
    const corpsInc = {
      exerciceId: n1, journalId: od.id, nature: 'SPECIFIQUE', debutPreparation: '2026-04-01', finPreparation: '2027-06-30',
      dateDebut: '2027-01-01', dateFin: '2027-06-30', base: 60_000_000, tauxPourcent: 12,
    };
    await refus(c, R, '2027 · incorporation sans intérêt passé', 'POST', `/immobilisations/${b.siege?.id}/couts-emprunt`, corpsInc, /d[ée]passerai|co[ûu]ts d'emprunt support/i);
    await ecriture(c, 'Intérêts du premier semestre 2027', n1, '2027-06-30', 'Intérêts emprunt siège S1 2027', [['67120000', 3_600_000, 0], [BQ, 0, 3_600_000]], { journal: bq });
    const inc = await c.geste('Coûts d’emprunt incorporés 2027', 'POST', `/immobilisations/${b.siege?.id}/couts-emprunt`, corpsInc);
    R.montant('2027 · coûts d’emprunt incorporés (60 000 000 × 12 % × 6/12)', 3_600_000, inc?.montant);
    // La mise en service ne précède pas la fin de l'incorporation (§ 2.2.3).
    await refus(c, R, '2027 · mise en service avant la fin de l’incorporation', 'PATCH', `/immobilisations/${b.siege?.id}/mise-en-service`, { date: '2027-06-15', exerciceId: n1, journalId: od.id }, /incorpor/i);
    await c.geste('Mise en service du siège', 'PATCH', `/immobilisations/${b.siege?.id}/mise-en-service`, { date: '2027-07-01', exerciceId: n1, journalId: od.id });
    await ecriture(c, 'Intérêts du second semestre 2027', n1, '2027-12-31', 'Intérêts emprunt siège S2 2027', [['67120000', 3_600_000, 0], [BQ, 0, 3_600_000]], { journal: bq });

    // Renouvellement de l'ascenseur au 1er juillet 2027 (ch. 4 § 4.1) ·
    // complément de dotation 10 000 000 / 10 × 6/12 = 500 000, valeur nette
    // 10 000 000 − 1 500 000 = 8 500 000 au 812, remplaçant 12 000 000 sur huit ans.
    await refus(c, R, '2027 · sortie de la structure avec un composant en service', 'POST', `/immobilisations/${b.structure?.id}/sortie`, {
      dateSortie: '2027-03-31', type: 'MISE_HORS_SERVICE', exerciceId: n1, journalId: od.id, natureSortie: 'MISE_AU_REBUT',
      referencePieceSortie: 'PV-2027-01', datePieceSortie: '2027-03-31',
    }, /composant/i);
    b.ascenseur2 = await c.geste('Renouvellement de l’ascenseur', 'POST', `/immobilisations/${b.ascenseur?.id}/renouvellement`, {
      dateRenouvellement: '2027-07-01', exerciceId: n1, journalId: bq.id, designation: 'Usine de Likasi · ascenseur (2027)',
      coutRenouvellement: 12_000_000, compteContrepartieId: compte(c, BQ), dureeAmortissementAns: 8,
    });

    // Rente viagère · versement du premier semestre, puis décès du crédirentier
    // le 30/09/2027 · 30 000 000 − 6 000 000 versés = 24 000 000 au 841 (§ 2.3.3).
    await ecriture(c, 'Rente viagère du premier semestre 2027', n1, '2027-06-30', 'Rente viagère S1 2027', [['16810000', 3_000_000, 0], [BQ, 0, 3_000_000]], { journal: bq });
    const sd = await c.geste('Extinction de la rente au décès', 'POST', `/immobilisations/${b.viager?.id}/solde-dette-aleatoire`, {
      exerciceId: n1, journalId: od.id, date: '2027-09-30', versementsCumules: 6_000_000, sourceVersements: 'Relevés bancaires 2026 et 2027',
    });
    R.montant('2027 · rente viagère éteinte au 841 (30 000 000 − 6 000 000)', 24_000_000, sd?.solde?.montant);

    // Cession du pick-up le 30/09/2027 · dotation arrêtée à la sortie (fiche du
    // compte 81) · 3 600 000 × 9/12 = 2 700 000 ; VNC 18 000 000 − 6 300 000 =
    // 11 700 000 au 812, prix 12 000 000 au 822.
    await c.geste('Cession du pick-up', 'POST', `/immobilisations/${b.pickup?.id}/sortie`, {
      dateSortie: '2027-09-30', type: 'CESSION', exerciceId: n1, journalId: bq.id, prixCession: 12_000_000, compteContrepartieId: compte(c, BQ),
      natureSortie: 'VENTE', referencePieceSortie: 'Facture de cession FC-2027-01', datePieceSortie: '2027-09-30',
    });
  });

  await etape(R, '2027 · dotations, reprise de dépréciation, dérogatoires, sortie', async () => {
    await doter(c, R, '2027', 'structure', b.structure, n1, 4_000_000);
    await doter(c, R, '2027', 'ascenseur renouvelé', b.ascenseur2, n1, 750_000); // 12 000 000 / 8 × 6/12
    await doter(c, R, '2027', 'four', b.four, n1, 9_500_000);
    await doter(c, R, '2027', 'révisions majeures', b.revision, n1, 1_500_000);
    // Ré-étalement (ch. 12 § 2.4.1) · 22 500 000 sur les neuf ans restants.
    await doter(c, R, '2027', 'presse (ré-étalée)', b.presse, n1, 2_500_000);
    await refus(c, R, '2027 · camion · dotation sans relevé de l’exercice', 'POST', `/immobilisations/${b.camion?.id}/dotation`, { exerciceId: n1, journalId: od.id });
    await c.geste('Relevé 2027 du camion', 'POST', `/immobilisations/${b.camion?.id}/consommation`, { exerciceId: n1, unitesConsommees: 90_000, source: 'Carnet de bord 2027' });
    await doter(c, R, '2027', 'camion', b.camion, n1, 5_400_000); // 24 000 000 × 90 000 / 400 000
    await doter(c, R, '2027', 'ligne d’embouteillage', b.ligne, n1, 4_000_000);
    await doter(c, R, '2027', 'machine de conditionnement', b.conditionneuse, n1, 2_000_000);
    await doter(c, R, '2027', 'marque (devenue limitée)', b.marque, n1, 1_000_000); // 8 000 000 / 4 × 6/12
    await doter(c, R, '2027', 'mobilier (prospective)', b.mobilier, n1, 2_500_000); // 5 000 000 / 2
    await doter(c, R, '2027', 'matériel de bureau (rétroactive)', b.bureau, n1, 2_000_000); // 12 000 000 / 6
    await doter(c, R, '2027', 'dépôt (prix global)', b.depot, n1, 1_900_000); // 38 000 000 / 20
    await doter(c, R, '2027', 'immeuble en viager', b.viager, n1, 2_000_000);
    await doter(c, R, '2027', 'siège mis en service', b.siege, n1, 1_372_000); // 68 600 000 / 25 × 6/12

    // Reprise plafonnée (ch. 12 § 2.4.2) · VNC 22 500 000 − 2 500 000 =
    // 20 000 000 ; sans dépréciation 30 000 000 − 6 000 000 = 24 000 000 ;
    // valeur actuelle 25 000 000 · reprise limitée à 4 000 000.
    const pl = await c.lire('Plafond de reprise de la presse', `/immobilisations/${b.presse?.id}/plafond-reprise-depreciation?exerciceId=${n1}`);
    R.note(`2027 · presse · plafond servi · ${JSON.stringify(pl).slice(0, 300)}`);
    R.montant('2027 · presse · plafond de reprise (24 000 000 − 20 000 000)', 4_000_000, pl?.plafond ?? pl?.plafondReprise);
    const corpsRep = (montant) => ({
      exerciceId: n1, journalId: od.id, sens: 'REPRISE', montant, compteDepreciationId: compte(c, '29410000'),
      compteContrepartieId: compte(c, '79140000'), indice: 'Remontée des prix du matériel neuf (catalogue 2027), valeur actuelle 25 000 000',
    });
    await refus(c, R, '2027 · reprise au-delà du plafond (5 000 000)', 'POST', `/immobilisations/${b.presse?.id}/depreciation`, corpsRep(5_000_000));
    await c.geste('Reprise plafonnée de la dépréciation', 'POST', `/immobilisations/${b.presse?.id}/depreciation`, corpsRep(4_000_000));

    // Dérogatoires 2027 · ligne · vr 13 333 333.33 × 40 % = 5 333 333.33
    // (au-dessus de 13 333 333.33 / 4.1667 ans · art. 35) ; écart 1 333 333.33.
    const plan = await c.lire('Plan fiscal 2027 · ligne', `/immobilisations/${b.ligne?.id}/plan-fiscal`);
    R.montant('2027 · ligne · annuité fiscale (13 333 333.33 × 40 %)', 5_333_333.33, plan?.lignes?.find((l) => l.exerciceId === n1)?.annuiteFiscale);
    const d1 = await c.geste('Dérogatoire 2027 · ligne', 'POST', `/immobilisations/${b.ligne?.id}/derogatoire`, { exerciceId: n1, journalId: od.id });
    R.montant('2027 · ligne · dérogatoire doté', 1_333_333.33, d1?.dotation);
    // Conditionneuse · art. 38, 2° · 4 000 000 × 40 % = 1 600 000, sous la
    // dotation comptable 2 000 000 · reprise de 400 000 au 861.
    const planE = await c.lire('Plan fiscal 2027 · conditionneuse', `/immobilisations/${b.conditionneuse?.id}/plan-fiscal`);
    R.montant('2027 · conditionneuse · annuité fiscale (4 000 000 × 40 %, art. 38, 2°)', 1_600_000, planE?.lignes?.find((l) => l.exerciceId === n1)?.annuiteFiscale);
    const d2 = await c.geste('Dérogatoire 2027 · conditionneuse', 'POST', `/immobilisations/${b.conditionneuse?.id}/derogatoire`, { exerciceId: n1, journalId: od.id });
    R.montant('2027 · conditionneuse · dérogatoire repris (2 000 000 − 1 600 000)', 400_000, d2?.reprise);
    // La ligne est cédée le 31/12/2027 · refusée tant que le 151 porte son
    // dérogatoire, puis le solde est repris au 861 (4 666 666.67).
    const sortieLigne = {
      dateSortie: '2027-12-31', type: 'CESSION', exerciceId: n1, journalId: bq.id, prixCession: 14_000_000, compteContrepartieId: compte(c, BQ),
      natureSortie: 'VENTE', referencePieceSortie: 'Facture de cession FC-2027-02', datePieceSortie: '2027-12-31',
    };
    await refus(c, R, '2027 · cession d’un bien qui porte un dérogatoire', 'POST', `/immobilisations/${b.ligne?.id}/sortie`, sortieLigne, /d[ée]rogatoire/i);
    const s = await c.geste('Reprise du solde du dérogatoire · ligne', 'POST', `/immobilisations/${b.ligne?.id}/derogatoire/solde`, { exerciceId: n1, journalId: od.id });
    R.montant('2027 · ligne · solde du dérogatoire repris (3 333 333.34 + 1 333 333.33)', 4_666_666.67, s?.reprise ?? s?.montant);
    await c.geste('Cession de la ligne d’embouteillage', 'POST', `/immobilisations/${b.ligne?.id}/sortie`, sortieLigne);
  });

  await etape(R, '2027 · contrôles, états et notes', async () => {
    await validerJusqua(c, n1, '2027-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n1);
    // 2311 · 110 + 12 − 10 = 112 000 000. 2831 · 7 741 666.67 + (4 + 0.5 +
    // 0.75 + 1.372 + 1.9 + 2) − 1.5 = 16 763 666.67. 2841 · 18 500 000 + 19 500 000
    // − 7 333 333.33 = 30 666 666.67. 2845 · 7.2 + 5.4 + 2.7 − 6.3 = 9 000 000.
    // 2844 · 4 + 2.5 + 2 − 1 = 7 500 000. 151 · le seul dérogatoire de la
    // conditionneuse, 4 833 333.33 − 400 000. Banque · 233 − 12 − 7.2 − 3 + 14
    // + 12 = 236 800 000.
    soldes(R, '2027', bal, {
      [BQ]: 236_800_000, '2311': 112_000_000, '2411': 100_000_000, '2451': 24_000_000, '2391': 0, '2140': 8_000_000,
      '2444': 6_000_000, '2441': 12_000_000, '2232': 12_000_000, '2313': 146_600_000,
      '2831': -16_763_666.67, '2841': -30_666_666.67, '2845': -9_000_000, '2844': -7_500_000, '2814': -1_000_000, '2941': -500_000,
      '151': -4_433_333.33, '1681': 0, '162': -60_000_000,
      '6813': 42_622_000, '6812': 1_000_000, '7914': -4_000_000, '798': -1_000_000, '812': 32_866_666.67, '822': -26_000_000,
      '851': 1_333_333.33, '861': -5_066_666.67, '841': -24_000_000, '7221': -3_600_000, '6712': 7_200_000,
    });
    const t = await c.lire('Tableau des amortissements 2027', `/immobilisations/tableau-amortissements?exerciceId=${n1}`);
    R.montant('2027 · tableau · presse · dotation ré-étalée', 2_500_000, ligneTableau(t, b.presse?.id)?.dotation);
    R.montant('2027 · tableau · presse · dépréciation restante (4 500 000 − 4 000 000)', 500_000, ligneTableau(t, b.presse?.id)?.depreciations);
    R.montant('2027 · tableau · siège · dotation', 1_372_000, ligneTableau(t, b.siege?.id)?.dotation);
    R.montant('2027 · tableau · marque · cumul', 1_000_000, ligneTableau(t, b.marque?.id)?.cumulN);
    // Cumul et valeur nette de chaque bien en service au 31/12/2027 (le camion,
    // dont le relevé ne s'enregistre pas, est relu par ses soldes).
    for (const [cle, cumul, net] of [
      ['structure', 8_000_000, 92_000_000], ['ascenseur2', 750_000, 11_250_000], ['four', 19_000_000, 38_000_000],
      ['revision', 3_000_000, 0], ['presse', 5_500_000, 24_000_000], ['conditionneuse', 3_166_666.67, 6_833_333.33],
      ['marque', 1_000_000, 7_000_000], ['mobilier', 3_500_000, 2_500_000], ['bureau', 4_000_000, 8_000_000],
      ['depot', 3_641_666.67, 34_358_333.33], ['viager', 3_000_000, 37_000_000], ['siege', 1_372_000, 67_228_000], ['terrain', 0, 12_000_000],
    ]) {
      const l = ligneTableau(t, b[cle]?.id);
      R.montant(`2027 · tableau · ${cle} · cumul des amortissements`, cumul, l?.cumulN ?? (l ? 0 : null));
      R.montant(`2027 · tableau · ${cle} · valeur nette`, net, l?.valeurNette);
    }

    const notes = await c.lire('Notes annexes 2027', `/etats-financiers-syscohada/notes?exerciceId=${n1}`);
    const n3a = ligneDeNote(notes, '3A');
    R.note(`2027 · note 3A · total lu · ${JSON.stringify(n3a?.valeurs)}`);
    R.montant('2027 · note 3A · ouverture', 453_000_000, n3a?.valeurs?.OUVERTURE);
    // Acquisitions · ascenseur 12 000 000 et coûts incorporés 3 600 000.
    R.montant('2027 · note 3A · acquisitions (12 000 000 + 3 600 000)', 15_600_000, n3a?.valeurs?.AUGMENTATIONS);
    // La mise en service est un virement de poste à poste (2391 vers 2313).
    R.montant('2027 · note 3A · virements, augmentation (68 600 000)', 68_600_000, n3a?.valeurs?.VIREMENTS_AUGMENTATION);
    R.montant('2027 · note 3A · virements, diminution (68 600 000)', 68_600_000, n3a?.valeurs?.VIREMENTS_DIMINUTION);
    R.montant('2027 · note 3A · cessions et hors service (10 + 20 + 18)', 48_000_000, n3a?.valeurs?.DIMINUTIONS);
    R.montant('2027 · note 3A · clôture', 420_600_000, n3a?.valeurs?.CLOTURE);
    const n3c = ligneDeNote(notes, '3C');
    R.note(`2027 · note 3C · total lu · ${JSON.stringify(n3c?.valeurs)}`);
    R.montant('2027 · note 3C · ouverture', 37_441_666.67, n3c?.valeurs?.OUVERTURE);
    R.montant('2027 · note 3C · clôture (16.76 + 30.67 + 9 + 7.5 + 1)', 64_930_333.34, n3c?.valeurs?.CLOTURE);
    const bil = aplatir(await c.lire('Bilan 2027', `/etats-financiers-syscohada/bilan?exerciceId=${n1}`));
    R.montant('2027 · bilan · actif égal au passif', 0, bil.BZ?.n != null && bil.DZ?.n != null ? bil.BZ.n - bil.DZ.n : null);
    const tft = aplatir(await c.lire('Flux de trésorerie 2027', `/etats-financiers-syscohada/tableau-flux-tresorerie?exerciceId=${n1}`));
    R.montant('2027 · TFT · trésorerie à l’ouverture (ZA)', 233_000_000, tft.ZA?.n);
    R.montant('2027 · TFT · trésorerie à la clôture (ZH, banque)', 236_800_000, tft.ZH?.n);
    await controlesImmobilisations(c, R, '2027 · contrôles', n1);
  });

  await etape(R, 'Clôture 2027', async () => {
    const r = await c.geste('Clôture de l’exercice 2027', 'POST', `/exercices/${n1}/cloturer`, {});
    R.egal('Clôture 2027 passée', true, r !== null);
  });
}

// =============================================================================
// 2 · IMMOBILIÈRE DU LAC SARL (SYSCOHADA normal) · réévaluation légale
// =============================================================================
async function immobiliere(R) {
  R.scenario = 'Immobilisations · SYSCOHADA réévaluation';
  const c = await nouveauDossier(R, 'Immobilisations · Immobilière du Lac SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'immo-reev', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const b = {};

  await etape(R, 'Ouverture et acquisitions de 2026', async () => {
    await c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await ouverture(c, n, '10130000', 200_000_000);
    b.terrain = await bien(c, 'Terrain à bâtir', n, bq, {
      compte: '22210000', designation: 'Terrain de Goma', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01', valeurOrigine: 20_000_000,
    });
    b.immeuble = await bien(c, 'Immeuble de bureaux', n, bq, {
      compte: '23130000', designation: 'Immeuble de bureaux de Goma', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 50_000_000, dureeAmortissementAns: 25,
    });
    b.mobilier = await bien(c, 'Mobilier de bureau', n, bq, {
      compte: '24440000', designation: 'Mobilier de bureau', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 12_000_000, dureeAmortissementAns: 6,
    });
    // La dotation de l'exercice se passe AVANT la réévaluation (D-38).
    await doter(c, R, '2026', 'immeuble', b.immeuble, n, 2_000_000); // 50 000 000 / 25
    await doter(c, R, '2026', 'mobilier', b.mobilier, n, 2_000_000); // 12 000 000 / 6
  });

  await etape(R, '2026 · réévaluation légale à la clôture', async () => {
    const categories = [
      { cle: 'IMMEUBLES', libelle: 'Terrains et constructions', coefficient: 1.2, source: 'Coefficient fictif du banc (arrêté non publié)' },
      { cle: 'MOBILIER', libelle: 'Mobilier et matériel', coefficient: 1.1, source: 'Coefficient fictif du banc (arrêté non publié)' },
    ];
    const corps = (lignes) => ({
      exerciceId: n, journalId: od.id, type: 'LEGALE', neutraliteFiscale: true,
      decision: 'Procès-verbal de l’assemblée générale extraordinaire du 20/12/2026',
      traitementFiscal: 'Neutralité fiscale déclarée · écart des biens amortissables à la provision spéciale (154)',
      methodeEvaluation: 'Coefficients légaux plafonnés à la valeur actuelle (expertise du 15/12/2026)', categories, lignes,
    });
    const lignes = [
      { immobilisationId: b.terrain?.id, categorie: 'IMMEUBLES', valeurActuelle: 25_000_000 },
      { immobilisationId: b.immeuble?.id, categorie: 'IMMEUBLES', valeurActuelle: 60_000_000 },
      { immobilisationId: b.mobilier?.id, categorie: 'MOBILIER', valeurActuelle: 10_500_000 },
    ];
    // Toute réévaluation partielle est interdite (art. 62 ; loi n° 23/053, art. 130).
    await refus(c, R, 'Réévaluation partielle (mobilier omis)', 'POST', '/immobilisations/reevaluation-bilan', corps(lignes.slice(0, 2)), /partielle/i);
    // Ch. 28 § 4.2.1 · terrain 20 000 000 × 1.2 = 24 000 000 (sous 25 000 000) ·
    // écart 4 000 000 au 1061 (non amortissable, D-43). Immeuble VNC 48 000 000
    // × 1.2 = 57 600 000 · brut 60 000 000, amortissements 2 400 000, écart
    // 9 600 000 au 154. Mobilier VNC 10 000 000 × 1.1 = 11 000 000 plafonné à
    // la valeur actuelle 10 500 000 · k' = 1.05 (§ 4.2.1.3), brut 12 600 000,
    // amortissements 2 100 000, écart 500 000 au 154.
    const r = await c.geste('Réévaluation légale 2026', 'POST', '/immobilisations/reevaluation-bilan', corps(lignes));
    R.egal('2026 · réévaluation légale passée', true, Boolean(r));
  });

  await etape(R, '2026 · contrôles et notes', async () => {
    await validerJusqua(c, n, '2026-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n);
    soldes(R, '2026', bal, {
      '2221': 24_000_000, '2313': 60_000_000, '2831': -2_400_000, '2444': 12_600_000, '2844': -2_100_000,
      '1061': -4_000_000, '154': -10_100_000, '6813': 4_000_000,
    });
    const notes = await c.lire('Notes annexes 2026', `/etats-financiers-syscohada/notes?exerciceId=${n}`);
    const n3a = ligneDeNote(notes, '3A');
    R.note(`2026 · note 3A · total lu · ${JSON.stringify(n3a?.valeurs)}`);
    R.montant('2026 · note 3A · acquisitions', 82_000_000, n3a?.valeurs?.AUGMENTATIONS);
    R.montant('2026 · note 3A · réévaluation (4 000 000 + 10 000 000 + 600 000)', 14_600_000, n3a?.valeurs?.REEVALUATION);
    R.montant('2026 · note 3A · clôture', 96_600_000, n3a?.valeurs?.CLOTURE);
    // La NOTE 3E reçoit un encadré en lecture seule (ch. 28 § 8 ; ligne A15) ·
    // l'opération de l'exercice et son écart total, 4 000 000 + 9 600 000 + 500 000.
    const n3e = await c.lire('Encadré de la note 3E', `/immobilisations/reevaluation-bilan/note?exerciceId=${n}`);
    R.egal('2026 · encadré des réévaluations · note 3E', '3E', n3e?.codeNote);
    R.montant('2026 · encadré · écart total de l’opération', 14_100_000, n3e?.reevaluations?.[0]?.totalEcart);
    const ds = await c.lire('Déclaration spéciale de réévaluation', `/immobilisations/reevaluation-bilan/declaration-speciale?exerciceId=${n}`);
    R.egal('2026 · déclaration spéciale éditée', true, Boolean(ds));
    await controlesImmobilisations(c, R, '2026 · contrôles', n, ['DECLARATION_REEVALUATION_A_DEPOSER']);
  });

  const clos = await etape(R, 'Clôture 2026', async () => {
    const r = await c.geste('Clôture de l’exercice 2026', 'POST', `/exercices/${n}/cloturer`, {});
    await rechargerExercices(c);
    return r !== null;
  });
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('Réévaluation · 2027 non joué');

  await etape(R, '2027 · sorties des biens réévalués', async () => {
    // Mobilier cédé le 30/06/2027 pour 9 000 000 · plan reparti du brut
    // réévalué · 12 600 000 / 6 × 6/12 = 1 050 000 ; cumul 3 150 000 ; VNC
    // 9 450 000 au 812. Le 154 du bien (500 000) est repris EN ENTIER au 861.
    await c.geste('Cession du mobilier réévalué', 'POST', `/immobilisations/${b.mobilier?.id}/sortie`, {
      dateSortie: '2027-06-30', type: 'CESSION', exerciceId: n1, journalId: bq.id, prixCession: 9_000_000, compteContrepartieId: compte(c, BQ),
      natureSortie: 'VENTE', referencePieceSortie: 'Facture FC-2027-11', datePieceSortie: '2027-06-30',
    });
    // Terrain cédé le 30/09/2027 pour 30 000 000 · VNC réévaluée 24 000 000 au
    // 812 ; son 1061 de 4 000 000 va à une réserve non distribuable (ch. 28 § 6)
    // CHOISIE sous 111, 112 ou 1138, le 118 des réserves libres refusé.
    const ecart = await c.lire('Écart du terrain à la sortie', `/immobilisations/reevaluation-bilan/ecart-a-la-sortie?immobilisationId=${b.terrain?.id}`);
    R.note(`2027 · terrain · écart servi à la sortie · ${JSON.stringify(ecart).slice(0, 300)}`);
    const sortieTerrain = (reserve) => ({
      dateSortie: '2027-09-30', type: 'CESSION', exerciceId: n1, journalId: bq.id, prixCession: 30_000_000, compteContrepartieId: compte(c, BQ),
      natureSortie: 'VENTE', referencePieceSortie: 'Acte de vente n° 301/2027', datePieceSortie: '2027-09-30', compteReserveEcartId: compte(c, reserve),
    });
    await refus(c, R, '2027 · écart du terrain vers le 118 (réserve libre)', 'POST', `/immobilisations/${b.terrain?.id}/sortie`, sortieTerrain('11810000'));
    await c.geste('Cession du terrain réévalué', 'POST', `/immobilisations/${b.terrain?.id}/sortie`, sortieTerrain('11380000'));
    // Immeuble · 60 000 000 / 25 = 2 400 000 (ch. 28 § 4.2.2, anciennes
    // annuités × 1.2), et reprise du supplément 2 400 000 − 2 000 000 = 400 000
    // au 861 (§ 4.2.4.2).
    await doter(c, R, '2027', 'immeuble réévalué', b.immeuble, n1, 2_400_000);
    const prop = await c.lire('Reprise de la provision spéciale 2027', `/immobilisations/reevaluation-bilan/reprise-provision?exerciceId=${n1}`);
    R.note(`2027 · reprise de la provision spéciale proposée · ${JSON.stringify(prop).slice(0, 500)}`);
    const rep = await c.geste('Reprise de la provision spéciale 2027', 'POST', '/immobilisations/reevaluation-bilan/reprise-provision', { exerciceId: n1, journalId: od.id });
    R.egal('2027 · reprise de la provision spéciale passée', true, Boolean(rep));
  });

  await etape(R, '2027 · contrôles', async () => {
    await validerJusqua(c, n1, '2027-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n1);
    // 154 · 10 100 000 − 500 000 (mobilier sorti) − 400 000 (supplément de
    // l'immeuble) = 9 200 000. 861 · 900 000. 812 · 9 450 000 + 24 000 000.
    // 822 · 9 000 000 + 30 000 000. 6813 · 1 050 000 + 2 400 000.
    soldes(R, '2027', bal, {
      '2221': 0, '2313': 60_000_000, '2831': -4_800_000, '2444': 0, '2844': 0, '1061': 0, '1138': -4_000_000, '118': 0,
      '154': -9_200_000, '861': -900_000, '812': 33_450_000, '822': -39_000_000, '6813': 3_450_000,
    });
    const t = await c.lire('Tableau des amortissements 2027', `/immobilisations/tableau-amortissements?exerciceId=${n1}`);
    R.note(`2027 · tableau · totaux · ${JSON.stringify(t?.totaux).slice(0, 400)}`);
    R.montant('2027 · tableau · immeuble · dotation', 2_400_000, ligneTableau(t, b.immeuble?.id)?.dotation);
    // Cumul 2 400 000 (2026 réévalué × 1.2) + 2 400 000 ; valeur nette 55 200 000.
    R.montant('2027 · tableau · immeuble · cumul', 4_800_000, ligneTableau(t, b.immeuble?.id)?.cumulN);
    R.montant('2027 · tableau · immeuble · valeur nette', 55_200_000, ligneTableau(t, b.immeuble?.id)?.valeurNette);
    // Supplément de l'exercice (ch. 28 § 4.2.4.2) · immeuble 2 400 000 −
    // 2 000 000, mobilier 1 050 000 − 1 000 000 · 450 000.
    R.montant('2027 · tableau · supplément d’amortissement dû à la réévaluation', 450_000, t?.totaux?.supplementReevaluation);
    const bil = aplatir(await c.lire('Bilan 2027', `/etats-financiers-syscohada/bilan?exerciceId=${n1}`));
    R.montant('2027 · bilan · actif égal au passif', 0, bil.BZ?.n != null && bil.DZ?.n != null ? bil.BZ.n - bil.DZ.n : null);
    const notes = await c.lire('Notes annexes 2027', `/etats-financiers-syscohada/notes?exerciceId=${n1}`);
    const n3a = ligneDeNote(notes, '3A');
    R.montant('2027 · note 3A · ouverture', 96_600_000, n3a?.valeurs?.OUVERTURE);
    R.montant('2027 · note 3A · cessions (24 000 000 + 12 600 000)', 36_600_000, n3a?.valeurs?.DIMINUTIONS);
    R.montant('2027 · note 3A · clôture', 60_000_000, n3a?.valeurs?.CLOTURE);
    await controlesImmobilisations(c, R, '2027 · contrôles', n1);
    const r = await c.geste('Clôture de l’exercice 2027', 'POST', `/exercices/${n1}/cloturer`, {});
    R.egal('Clôture 2027 passée', true, r !== null);
  });
}

// =============================================================================
// 3 · ASSOCIATION SOLIDARITÉ DU KWILU (SYCEBNL associations)
// =============================================================================
async function association(R) {
  R.scenario = 'Immobilisations · SYCEBNL association';
  const c = await nouveauDossier(R, 'Immobilisations · Association Solidarité du Kwilu', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'immo-asso', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const b = {};

  await etape(R, 'Ouverture et entrées de 2026', async () => {
    await ouverture(c, n, '10110000', 200_000_000);
    // Dégressif COMPTABLE au taux de la loi n° 23/053 (D-25, D-26) · durée de
    // cinq ans, coefficient 2 (art. 33), taux 40 %.
    b.vehicule = await bien(c, 'Véhicule en dégressif', n, bq, {
      compte: '24510000', designation: 'Véhicule de terrain', dateAcquisition: '2026-04-01', dateMiseEnService: '2026-04-01',
      valeurOrigine: 8_000_000, dureeAmortissementAns: 5, modeAmortissement: 'DEGRESSIF',
    });
    // Subvention en numéraire (fiche du compte 14) · octroi, encaissement,
    // bien acquis et rattachement (lot 5).
    await c.geste('Octroi de la subvention d’équipement', 'POST', '/immobilisations/subventions-rattachees/octrois', {
      compteSubventionId: compte(c, '14170000'), compteContrepartieId: compte(c, '47310000'), exerciceId: n, journalId: od.id,
      date: '2026-02-01', montant: 12_000_000, reference: 'CONV-UE-2026-07',
    });
    await ecriture(c, 'Encaissement de la subvention', n, '2026-02-15', 'Encaissement subvention UE', [[BQ, 12_000_000, 0], ['47310000', 0, 12_000_000]], { journal: bq });
    b.materiel = await bien(c, 'Matériel subventionné', n, bq, {
      compte: '24410000', designation: 'Matériel et mobilier du centre', dateAcquisition: '2026-03-01', dateMiseEnService: '2026-03-01',
      valeurOrigine: 15_000_000, dureeAmortissementAns: 5,
    });
    await c.geste('Rattachement de la subvention', 'POST', '/immobilisations/subventions-rattachees', {
      compteSubventionId: compte(c, '14170000'), dateOctroi: '2026-02-01', reference: 'CONV-UE-2026-07',
      lignes: [{ immobilisationId: b.materiel?.id, montant: 12_000_000 }],
    });
    // Donation temporaire d'usufruit (Partie 3 ch. 2 § 2.3) · D 2011 / C 171,
    // cinq ans, amortie linéairement.
    b.usufruit = await bien(c, 'Usufruit temporaire d’un immeuble', n, od, {
      compte: '20110000', contrepartie: '17100000', designation: 'Usufruit de l’immeuble de Bandundu (cinq ans)',
      dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01', valeurOrigine: 10_000_000, dureeAmortissementAns: 5,
    });
    // Legs grevé de dettes (§ 1.2.2 ; D-15, D-16) · une maison 30 000 000 et un
    // véhicule 10 000 000, dettes 8 000 000 réparties au prorata · 6 000 000 et
    // 2 000 000 ; fonds 24 000 000 et 8 000 000 au 1671.
    const legs = await c.geste('Legs grevé de dettes', 'POST', '/immobilisations/legs', {
      exerciceId: n, journalId: od.id, dateActe: '2026-07-01', referenceActe: 'Testament de feu M. Mbuyi, acte n° 45/2026',
      compteFondsId: compte(c, '16710000'), dettes: 8_000_000, compteDettesId: compte(c, '48610000'),
      biens: [
        { compteImmobilisationId: compte(c, '23130000'), designation: 'Maison léguée', valeurOrigine: 30_000_000, dureeAmortissementAns: 20, dateMiseEnService: '2026-07-01' },
        { compteImmobilisationId: compte(c, '24510000'), designation: 'Véhicule légué', valeurOrigine: 10_000_000, dureeAmortissementAns: 5, dateMiseEnService: '2026-07-01' },
      ],
    });
    const liste = (await c.lire('Biens du dossier', '/immobilisations')) ?? [];
    const tous = Array.isArray(liste) ? liste : (liste.immobilisations ?? liste.lignes ?? []);
    b.maison = tous.find((x) => x.designation === 'Maison léguée');
    b.vehiculeLegue = tous.find((x) => x.designation === 'Véhicule légué');
    if (!legs) R.note('Legs refusé · la maison et le véhicule légués manquent');
    // § 1.2.2 · le paiement des dettes du donateur débite le 4861.
    await ecriture(c, 'Paiement des dettes du legs', n, '2026-08-01', 'Dettes de la succession Mbuyi', [['48610000', 8_000_000, 0], [BQ, 0, 8_000_000]], { journal: bq });
    // Un usufruit ne se cède pas (§ 2.3.2) · rétrocession en hors service seulement.
    await refus(c, R, 'Cession d’un usufruit temporaire', 'POST', `/immobilisations/${b.usufruit?.id}/sortie`, {
      dateSortie: '2026-12-31', type: 'CESSION', exerciceId: n, journalId: bq.id, prixCession: 1_000_000, compteContrepartieId: compte(c, BQ),
      natureSortie: 'VENTE', referencePieceSortie: 'X', datePieceSortie: '2026-12-31',
    }, /usufruit/i);
  });

  /** Dotation, puis reprise du fonds qui finance le bien, confrontées aux attendus. */
  const doterEtReprendre = async (an, ex, cle, im, dotation, reprise) => {
    await doter(c, R, an, cle, im, ex, dotation);
    if (reprise === undefined) return;
    const r = await c.geste(`Reprise du fonds ${an} · ${cle}`, 'POST', `/immobilisations/${im?.id}/reprise-subvention`, { exerciceId: ex, journalId: od.id });
    R.montant(`${an} · ${cle} · reprise du fonds`, reprise, r?.montant);
  };

  await etape(R, '2026 · dotations et reprises', async () => {
    // Dégressif · 8 000 000 × 40 % × 9/12 = 2 400 000 (art. 33 et 34).
    await doterEtReprendre('2026', n, 'véhicule dégressif', b.vehicule, 2_400_000);
    // Subvention · dotation 15 000 000 / 5 × 10/12 = 2 500 000 ; reprise
    // 2 500 000 × 12/15 = 2 000 000 (au 799).
    await doterEtReprendre('2026', n, 'matériel subventionné', b.materiel, 2_500_000, 2_000_000);
    // Usufruit · 10 000 000 / 5 = 2 000 000 au 680 / 280, reprise du 171 au
    // 7961 « dans la même quotité que l'amortissement ».
    await doterEtReprendre('2026', n, 'usufruit', b.usufruit, 2_000_000, 2_000_000);
    // Legs · maison 30 000 000 / 20 × 6/12 = 750 000, reprise × 24/30 =
    // 600 000 ; véhicule 10 000 000 / 5 × 6/12 = 1 000 000, reprise × 8/10 =
    // 800 000 (quote-part du 167 · D-15).
    await doterEtReprendre('2026', n, 'maison léguée', b.maison, 750_000, 600_000);
    await doterEtReprendre('2026', n, 'véhicule légué', b.vehiculeLegue, 1_000_000, 800_000);
  });

  await etape(R, '2026 · contrôles et notes', async () => {
    await validerJusqua(c, n, '2026-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n);
    // Banque · 200 − 8 + 12 − 15 − 8 = 181 000 000. 1671 · −32 + 1.4.
    soldes(R, '2026', bal, {
      [BQ]: 181_000_000, '2451': 18_000_000, '2845': -3_400_000, '2313': 30_000_000, '2831': -750_000, '2441': 15_000_000, '2844': -2_500_000,
      '2011': 10_000_000, '2800': -2_000_000, '1671': -30_600_000, '4861': 0, '1417': -10_000_000, '4731': 0, '171': -8_000_000,
      '6813': 6_650_000, '6800': 2_000_000, '7923': -1_400_000, '799': -2_000_000, '7961': -2_000_000,
    });
    const notes = await c.lire('Notes annexes 2026', `/notes-annexes/associations?exerciceId=${n}`);
    const n5b = ligneDeNote(notes, '5B');
    R.note(`2026 · note 5B · total lu · ${JSON.stringify(n5b?.valeurs)}`);
    R.montant('2026 · note 5B · acquisitions et entrées (8 + 15 + 30 + 10, hors usufruit de la division 20)', 63_000_000, n5b?.valeurs?.AUGMENTATIONS);
    // L'usufruit (division 20) a ses notes 5A et 5D ; amortissements des autres
    // biens en 5E · 3 400 000 + 750 000 + 2 500 000.
    R.montant('2026 · note 5A · usufruit reçu', 10_000_000, totalDeNote(notes, '5A')?.valeurs?.AUGMENTATIONS);
    R.montant('2026 · note 5D · amortissement de l’usufruit', 2_000_000, totalDeNote(notes, '5D')?.valeurs?.CLOTURE);
    R.montant('2026 · note 5E · amortissements à la clôture', 6_650_000, totalDeNote(notes, '5E')?.valeurs?.CLOTURE);
    const bil = await c.lire('Bilan 2026', `/etats-financiers/bilan?exerciceId=${n}`);
    R.montant('2026 · bilan · actif égal au passif', 0, bil ? bil.totalActif - bil.totalPassif : null);
    await controlesImmobilisations(c, R, '2026 · contrôles', n);
  });

  const clos = await etape(R, 'Clôture 2026', async () => {
    const r = await c.geste('Clôture de l’exercice 2026', 'POST', `/exercices/${n}/cloturer`, {});
    await rechargerExercices(c);
    return r !== null;
  });
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('Association · 2027 non joué');

  await etape(R, '2027 · dotations, reprises, contrôles', async () => {
    // Dégressif · reliquat 5 600 000 × 40 % = 2 240 000, au-dessus de
    // 5 600 000 / 4.25 ans restants (art. 35).
    await doterEtReprendre('2027', n1, 'véhicule dégressif', b.vehicule, 2_240_000);
    // Subvention · 3 000 000 ; reprise 10 000 000 × 3 000 000 / 12 500 000 =
    // 2 400 000 (prospective, D-12).
    await doterEtReprendre('2027', n1, 'matériel subventionné', b.materiel, 3_000_000, 2_400_000);
    await doterEtReprendre('2027', n1, 'usufruit', b.usufruit, 2_000_000, 2_000_000);
    await doterEtReprendre('2027', n1, 'maison léguée', b.maison, 1_500_000, 1_200_000);
    await doterEtReprendre('2027', n1, 'véhicule légué', b.vehiculeLegue, 2_000_000, 1_600_000);
    await validerJusqua(c, n1, '2027-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n1);
    soldes(R, '2027', bal, {
      '2845': -7_640_000, '2831': -2_250_000, '2844': -5_500_000, '2800': -4_000_000,
      '1671': -27_800_000, '1417': -7_600_000, '171': -6_000_000,
      '6813': 8_740_000, '6800': 2_000_000, '7923': -2_800_000, '799': -2_400_000, '7961': -2_000_000,
    });
    const t = await c.lire('Tableau des amortissements 2027', `/immobilisations/tableau-amortissements?exerciceId=${n1}`);
    for (const [cle, cumul, net] of [
      ['vehicule', 4_640_000, 3_360_000], ['materiel', 5_500_000, 9_500_000], ['usufruit', 4_000_000, 6_000_000],
      ['maison', 2_250_000, 27_750_000], ['vehiculeLegue', 3_000_000, 7_000_000],
    ]) {
      const l = ligneTableau(t, b[cle]?.id);
      R.montant(`2027 · tableau · ${cle} · cumul des amortissements`, cumul, l?.cumulN);
      R.montant(`2027 · tableau · ${cle} · valeur nette`, net, l?.valeurNette);
    }
    const bil = await c.lire('Bilan 2027', `/etats-financiers/bilan?exerciceId=${n1}`);
    R.montant('2027 · bilan · actif égal au passif', 0, bil ? bil.totalActif - bil.totalPassif : null);
    const notes = await c.lire('Notes annexes 2027', `/notes-annexes/associations?exerciceId=${n1}`);
    R.montant('2027 · note 5B · ouverture', 63_000_000, totalDeNote(notes, '5B')?.valeurs?.OUVERTURE);
    R.montant('2027 · note 5B · clôture', 63_000_000, totalDeNote(notes, '5B')?.valeurs?.CLOTURE);
    R.montant('2027 · note 5E · amortissements à la clôture (6 650 000 + 8 740 000)', 15_390_000, totalDeNote(notes, '5E')?.valeurs?.CLOTURE);
    R.montant('2027 · note 5D · amortissement de l’usufruit', 4_000_000, totalDeNote(notes, '5D')?.valeurs?.CLOTURE);
    await controlesImmobilisations(c, R, '2027 · contrôles', n1);
    const r = await c.geste('Clôture de l’exercice 2027', 'POST', `/exercices/${n1}/cloturer`, {});
    R.egal('Clôture 2027 passée', true, r !== null);
  });
}

// =============================================================================
// 4 · FONDATION LUMIÈRE DE KISANGANI (SYCEBNL associations) · réévaluation
// =============================================================================
async function fondation(R) {
  R.scenario = 'Immobilisations · SYCEBNL réévaluation';
  const c = await nouveauDossier(R, 'Immobilisations · Fondation Lumière de Kisangani', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'immo-fond', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const b = {};

  await etape(R, '2026 · acquisition, dotation, réévaluation', async () => {
    await ouverture(c, n, '10110000', 100_000_000);
    b.batiment = await bien(c, 'Bâtiment administratif', n, bq, {
      compte: '23130000', designation: 'Siège de la fondation', dateAcquisition: '2026-01-01', dateMiseEnService: '2026-01-01',
      valeurOrigine: 40_000_000, dureeAmortissementAns: 20,
    });
    await doter(c, R, '2026', 'bâtiment', b.batiment, n, 2_000_000); // 40 000 000 / 20
    // VNC 38 000 000 × 1.25 = 47 500 000 (sous la valeur actuelle 50 000 000) ·
    // brut 50 000 000, amortissements 2 500 000, écart 9 500 000 au 10611 (bien
    // sans droit de reprise, SYCEBNL Partie 2 ch. 2 ; D-31).
    const r = await c.geste('Réévaluation de 2026', 'POST', '/immobilisations/reevaluation-bilan', {
      exerciceId: n, journalId: od.id, type: 'LEGALE', neutraliteFiscale: false,
      decision: 'Délibération du conseil d’administration du 15/12/2026', traitementFiscal: 'Association exemptée · aucun impôt sur l’écart',
      methodeEvaluation: 'Coefficient plafonné à la valeur actuelle (expertise du 10/12/2026)',
      categories: [{ cle: 'CONSTRUCTIONS', libelle: 'Constructions', coefficient: 1.25, source: 'Coefficient fictif du banc (arrêté non publié)' }],
      lignes: [{ immobilisationId: b.batiment?.id, categorie: 'CONSTRUCTIONS', valeurActuelle: 50_000_000, droitDeReprise: false }],
    });
    R.egal('2026 · réévaluation passée', true, Boolean(r));
    await validerJusqua(c, n, '2026-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n);
    soldes(R, '2026', bal, { '2313': 50_000_000, '2831': -2_500_000, '10611': -9_500_000, '6813': 2_000_000 });
    const notes = await c.lire('Notes annexes 2026', `/notes-annexes/associations?exerciceId=${n}`);
    R.montant('2026 · note 5B · acquisitions', 40_000_000, totalDeNote(notes, '5B')?.valeurs?.AUGMENTATIONS);
    R.montant('2026 · note 5B · réévaluation (50 000 000 − 40 000 000)', 10_000_000, totalDeNote(notes, '5B')?.valeurs?.REEVALUATION);
    R.montant('2026 · note 5B · clôture', 50_000_000, totalDeNote(notes, '5B')?.valeurs?.CLOTURE);
    R.montant('2026 · note 5E · amortissements à la clôture (2 000 000 × 1.25)', 2_500_000, totalDeNote(notes, '5E')?.valeurs?.CLOTURE);
    const n5h = await c.lire('Encadré de la note 5H', `/immobilisations/reevaluation-bilan/note?exerciceId=${n}`);
    R.egal('2026 · encadré des réévaluations · note 5H', '5H', n5h?.codeNote);
    R.montant('2026 · encadré · écart total de l’opération', 9_500_000, n5h?.reevaluations?.[0]?.totalEcart);
    await controlesImmobilisations(c, R, '2026 · contrôles', n);
  });

  const clos = await etape(R, 'Clôture 2026', async () => {
    const r = await c.geste('Clôture de l’exercice 2026', 'POST', `/exercices/${n}/cloturer`, {});
    await rechargerExercices(c);
    return r !== null;
  });
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('Fondation · 2027 non joué');

  await etape(R, '2027 · cession du bâtiment réévalué', async () => {
    // Complément · 50 000 000 / 20 × 6/12 = 1 250 000 ; cumul 3 750 000 ; VNC
    // 46 250 000 au 812 ; prix 45 000 000 au 822. Le 10611 du bien (9 500 000)
    // va au 118 IMPOSÉ (décision de Manasse du 2026-10-04) · un autre compte
    // envoyé est refusé.
    const sortie = (extra = {}) => ({
      dateSortie: '2027-06-30', type: 'CESSION', exerciceId: n1, journalId: bq.id, prixCession: 45_000_000, compteContrepartieId: compte(c, BQ),
      natureSortie: 'VENTE', referencePieceSortie: 'Acte de vente n° 88/2027', datePieceSortie: '2027-06-30', ...extra,
    });
    await refus(c, R, '2027 · écart vers une autre réserve que le 118', 'POST', `/immobilisations/${b.batiment?.id}/sortie`, sortie({ compteReserveEcartId: compte(c, '11200000') }), /118/);
    await c.geste('Cession du bâtiment réévalué', 'POST', `/immobilisations/${b.batiment?.id}/sortie`, sortie());
    await validerJusqua(c, n1, '2027-12-31');
    await rechargerComptes(c);
    const bal = await balance(c, n1);
    soldes(R, '2027', bal, {
      '2313': 0, '2831': 0, '10611': 0, '118': -9_500_000, '812': 46_250_000, '822': -45_000_000, '6813': 1_250_000,
      [BQ]: 100_000_000 - 40_000_000 + 45_000_000,
    });
    const notes = await c.lire('Notes annexes 2027', `/notes-annexes/associations?exerciceId=${n1}`);
    R.montant('2027 · note 5B · ouverture', 50_000_000, totalDeNote(notes, '5B')?.valeurs?.OUVERTURE);
    R.montant('2027 · note 5B · cessions', 50_000_000, totalDeNote(notes, '5B')?.valeurs?.DIMINUTIONS);
    R.montant('2027 · note 5B · clôture', 0, totalDeNote(notes, '5B')?.valeurs?.CLOTURE);
    await controlesImmobilisations(c, R, '2027 · contrôles', n1);
    const r = await c.geste('Clôture de l’exercice 2027', 'POST', `/exercices/${n1}/cloturer`, {});
    R.egal('Clôture 2027 passée', true, r !== null);
  });
}
