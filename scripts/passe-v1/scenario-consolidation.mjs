/**
 * SCÉNARIO · CONSOLIDATION SYSCOHADA (AUDCIF art. 74 à 98, D4C Titre XII) ET
 * IFRS (IFRS 18, IFRS 1, IAS 7, IFRS 10 et 12), simulation du logiciel
 * complet, lot C.
 *
 * Quatre dossiers, tous nés par l'inscription.
 *
 * 1. Un dossier SYCEBNL, pour le CLOISONNEMENT · l'art. 3 du SYCEBNL écarte
 *    les art. 73 à 113 de l'AUDCIF, la consolidation et l'IFRS se refusent.
 * 2. « GINGER SA », corrigé A du cours CPCC de S. Bamba Makola (chapitre 3,
 *    § 3.4.1, compétence `mes-cours-comptabilite-audit`, dossier
 *    `consolidation-bamba-makola`) · intégration globale à 55 %. L'ATTENDU EST
 *    LE CORRIGÉ (bilan consolidé de 3 255 000).
 * 3. « GINGER Mining SA », corrigé C du même chapitre · mise en équivalence à
 *    25 %, GECAMINES à 12,5 % non consolidée. L'ATTENDU EST LE CORRIGÉ (bilan
 *    consolidé de 4 820 000).
 * 4. « Kivu Holding SARL », groupe du banc, 2026 (N) et 2027 (N+1), clôtures
 *    comprises · filiale « Lualaba Distribution SARL » en intégration globale
 *    (80 %), associée « Tanganyika Logistique SA » mise en équivalence (30 %),
 *    écart d'acquisition et son plan, opérations réciproques, dividendes
 *    internes, marge interne en stock, impôts différés, états consolidés N et
 *    N+1, tableau des flux et variation des capitaux propres en N+1. Puis
 *    l'IFRS individuel de la mère (2026 comparatif, 2027 premier exercice
 *    IFRS) et l'IFRS consolidé de 2027. Les refus documentés (participations
 *    au-delà de 100 %, participation croisée, entrée en cours d'exercice) sont
 *    éprouvés sur le périmètre de 2026.
 *
 * LE CORRIGÉ DU COURS N'EST PAS UNE SOURCE DE RÈGLE (il confirme
 * l'arithmétique) · les règles viennent du D4C (compétence
 * `audcif-acte-uniforme`, `titre-12-13-d4c-consolidation-combinaison.md`) et
 * de l'AUDCIF art. 81 et 82. Deux mises en scène, comme dans les tests du
 * dépôt : l'entrée se date de l'ouverture de l'exercice (le moteur refuse
 * l'entrée en cours d'exercice, le cours ne calcule aucun écart d'acquisition),
 * et les capitaux propres d'entrée se déclarent égaux au coût divisé par le
 * pourcentage, ce qui rend l'écart nul comme le cours le suppose.
 *
 * Chaque attendu du groupe Kivu est calculé à la main dans le commentaire qui
 * le précède, depuis les opérations du banc et le texte.
 */
import { balance, cloturer, compte, ecriture, etape, nouveauDossier, rechargerExercices, solde, validerJusqua } from './lib.mjs';

const BQ = '52110000';
const PRESENTATION = 'CDF'; // Tenant.devise, défaut du schéma · « unité monétaire ayant cours légal » (art. 87)

// --- Outils du scénario -------------------------------------------------------

const b64 = (texte) => Buffer.from(texte, 'utf8').toString('base64');

/** Balance à quatre colonnes · [numéro, intitulé, solde débit moins crédit]. */
function csv4(lignes) {
  const corps = lignes.map(([n, i, s]) => [n, i, s > 0 ? s : 0, s < 0 ? -s : 0].join(';'));
  return b64(['Numero;Intitule;Debit;Credit', ...corps].join('\n'));
}

/**
 * Balance à SIX colonnes (report, mouvements, solde) · le tableau des flux
 * consolidé exige les mouvements de l'exercice (D4C ch. XII-8 § 4, flux « bruts
 * en principe »). [numéro, intitulé, report (débit − crédit), mouvement débit,
 * mouvement crédit] · le solde se déduit, report + mouvements.
 */
function csv6(lignes) {
  const dc = (x) => [x > 0 ? x : 0, x < 0 ? -x : 0];
  const corps = lignes.map(([n, i, rep, md, mc]) => [n, i, ...dc(rep), md, mc, ...dc(rep + md - mc)].join(';'));
  return b64(['Numero;Intitule;Report debit;Report credit;Mouvements debit;Mouvements credit;Solde debit;Solde credit', ...corps].join('\n'));
}

/** Le bilan d'ouverture, importé comme au scénario SARL, puis validé. */
async function bilanOuverture(c, exerciceId, date, lignes) {
  const csv = ['Compte;Intitule;Debit;Credit', ...lignes.map((l) => l.join(';'))].join('\n');
  await c.geste('Import du bilan d’ouverture', 'POST', '/import/executer', {
    type: 'BALANCE', nomFichier: `ouverture-${date}.csv`, contenuBase64: b64(csv),
    mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
    exerciceId, dateOperation: date, bilanDOuverture: true, separateur: ';',
  });
  await validerJusqua(c, exerciceId, date);
}

const activerModules = (c) =>
  c.geste('Activation des modules Consolidation et IFRS', 'PATCH', '/dossier/modules', { modulesActives: ['CONSOLIDATION', 'IFRS'] });

/**
 * UN REFUS ATTENDU · le geste est joué tel quel, son statut et son motif sont
 * comparés à ce que le texte et la documentation du module disent. Ce n'est
 * pas une erreur du banc, c'est un contrôle.
 */
async function refusAttendu(c, R, libelle, methode, chemin, corps, motif) {
  const r = await c.req(methode, chemin, corps);
  R.egal(`${libelle} · refusé en 400`, 400, r.statut);
  if (motif) R.egal(`${libelle} · le refus nomme sa cause`, true, motif.test(JSON.stringify(r.corps ?? '')));
  return r;
}

const ligne = (lignes, cle) => (lignes ?? []).find((l) => l.cle === cle);
const net = (lignes, cle) => ligne(lignes, cle)?.net ?? null;
const ifrs = (lignes, cle) => ligne(lignes, cle)?.ifrs ?? null;

/** Une entité du périmètre, sa participation directe par la consolidante et son acquisition. */
async function declarerEntite(c, exerciceId, nom, pct, acquisition, an = '2026') {
  // Même date de clôture que la consolidante · aucun décalage (art. 97).
  const e = await c.geste(`Entité ${nom} (${an})`, 'POST', '/consolidation/entites', { exerciceId, nom, dateCloture: `${an}-12-31` });
  if (!e) return null;
  const lien = await c.geste(`Participation dans ${nom}`, 'POST', '/consolidation/liens', { exerciceId, detenueId: e.id, pctDroitsVote: pct, pctCapital: pct });
  if (lien && acquisition) await c.geste(`Acquisition de ${nom}`, 'PUT', `/consolidation/liens/${lien.id}/acquisition`, acquisition);
  return { id: e.id, lienId: lien?.id ?? null };
}

/** La monnaie de la balance importée · celle de présentation, aucune conversion (D4C ch. XII-4). */
const monnaie = (c, e, nom) => e && c.geste(`Monnaie de ${nom}`, 'PUT', `/consolidation/entites/${e.id}/monnaie`, { monnaieBalance: PRESENTATION });

// --- 1 · Cloisonnement -----------------------------------------------------------

async function cloisonnement(R) {
  const c = await nouveauDossier(R, 'Passe V1 · Association témoin (cloisonnement consolidation)', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'conso-asso', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  await activerModules(c);
  // L'art. 3 du SYCEBNL écarte les art. 73 à 113 de l'AUDCIF · la route se
  // refuse même module activé (masquer n'est pas refuser, § 6 de CLAUDE.md).
  const p = await c.req('GET', `/consolidation/perimetre?exerciceId=${n}`);
  R.egal('SYCEBNL · le périmètre de consolidation se refuse (403)', 403, p.statut);
  const i = await c.req('GET', `/ifrs?exerciceId=${n}`);
  R.egal('SYCEBNL · les états IFRS se refusent (403)', 403, i.statut);
}

// --- 2 · Corrigé CPCC A · intégration globale à 55 % ----------------------------

async function corrigeA(R) {
  const c = await nouveauDossier(R, 'Passe V1 · GINGER SA (corrigé CPCC A)', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'conso-ginger-a', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  await activerModules(c);
  // GINGER au 31 décembre (corrigé, p. 41) · immobilisations 2 700 000, titres
  // 55 000, actifs circulants et trésorerie 245 000, capital 2 000 000,
  // réserves 500 000, passif circulant 400 000, produits 8 000 000, charges
  // 7 900 000. Ouverture · banque 245 000 − 100 000 de résultat = 145 000.
  await bilanOuverture(c, n, '2026-01-01', [
    ['24110000', 'Immobilisations', 2_700_000, 0], ['26100000', 'Titres BLEU CIEL', 55_000, 0], [BQ, 'Banque', 145_000, 0],
    ['10130000', 'Capital', 0, 2_000_000], ['11810000', 'Réserves', 0, 500_000], ['40110000', 'Passif circulant', 0, 400_000],
  ]);
  await ecriture(c, 'Produits 2026', n, '2026-06-30', 'Produits de l’exercice', [[BQ, 8_000_000, 0], ['70110000', 0, 8_000_000]]);
  await ecriture(c, 'Charges 2026', n, '2026-06-30', 'Charges de l’exercice', [['60110000', 7_900_000, 0], [BQ, 0, 7_900_000]]);
  await validerJusqua(c, n, '2026-12-31');

  const bc = await declarerEntite(c, n, 'BLEU CIEL SA', 55, {
    coutAcquisition: 55_000, compteTitres: '26100000', dateEntree: '2026-01-01',
    capitauxPropresEntree: 100_000, modeDureeEcart: 'NON_DETERMINABLE', dividendesExercice: 0,
  });
  if (!bc) return;
  // BLEU CIEL (corrigé, p. 41) · immobilisations 200 000, actifs circulants et
  // trésorerie 110 000, capital 100 000, réserves 80 000, passif 100 000,
  // produits 900 000, charges 870 000.
  await c.geste('Balance de BLEU CIEL', 'POST', `/consolidation/entites/${bc.id}/balance`, {
    nomFichier: 'bleu-ciel-2026.csv',
    contenuBase64: csv4([
      ['24100000', 'Immobilisations', 200_000], ['52100000', 'Trésorerie', 110_000], ['10100000', 'Capital', -100_000],
      ['11800000', 'Réserves', -80_000], ['70100000', 'Produits', -900_000], ['60100000', 'Charges', 870_000], ['40100000', 'Passif circulant', -100_000],
    ]),
  });
  await monnaie(c, bc, 'BLEU CIEL');
  const e = await c.lire('États consolidés GINGER', `/consolidation/etats?exerciceId=${n}`);
  if (!e) return;
  const A = e.bilan.actif;
  const P = e.bilan.passif;
  const CR = e.compteDeResultat;
  // Corrigé A, bilan consolidé (p. 43).
  R.montant('Corrigé A · immobilisations (2 700 000 + 200 000)', 2_900_000, net(A, 'IMMOBILISATIONS_CORPORELLES'));
  R.montant('Corrigé A · actifs circulants et trésorerie (245 000 + 110 000)', 355_000, net(A, 'TRESORERIE_ACTIF'));
  R.montant('Corrigé A · total actif', 3_255_000, net(A, 'TOTAL_GENERAL_ACTIF'));
  R.montant('Corrigé A · capital du groupe', 2_000_000, net(P, 'CAPITAL'));
  R.montant('Corrigé A · réserves consolidées (500 000 + 80 000 × 55 %)', 544_000, net(P, 'PRIMES_RESERVES_CONSOLIDEES'));
  R.montant('Corrigé A · résultat consolidé, part du groupe (100 000 + 30 000 × 55 %)', 116_500, net(P, 'RESULTAT_CONSOLIDANTE'));
  R.montant('Corrigé A · capitaux propres du groupe', 2_660_500, net(P, 'PART_CONSOLIDANTE'));
  R.montant('Corrigé A · intérêts minoritaires (45 000 + 36 000 + 13 500)', 94_500, net(P, 'PART_MINORITAIRES'));
  R.montant('Corrigé A · passif circulant (400 000 + 100 000)', 500_000, net(P, 'FOURNISSEURS'));
  R.montant('Corrigé A · total passif', 3_255_000, net(P, 'TOTAL_GENERAL_PASSIF'));
  // Corrigé A, compte de résultat consolidé (p. 44).
  R.montant('Corrigé A · produits (8 000 000 + 900 000)', 8_900_000, net(CR, 'CHIFFRE_AFFAIRES'));
  R.montant('Corrigé A · charges (7 900 000 + 870 000)', -8_770_000, net(CR, 'ACHATS_CONSOMMES'));
  R.montant('Corrigé A · résultat net consolidé', 130_000, net(CR, 'RESULTAT_ENSEMBLE'));
  R.montant('Corrigé A · intérêts minoritaires au résultat', 13_500, net(CR, 'RESULTAT_MINORITAIRES'));
  R.montant('Corrigé A · résultat part du groupe', 116_500, net(CR, 'RESULTAT_CONSOLIDANTE_CR'));
  R.egal('Corrigé A · les contrôles des états consolidés bouclent', true, (e.controles ?? []).every((x) => x.ok));
  // Aucun impôt différé déclaré · « null n'est pas zéro », l'état le dit.
  R.egal('Corrigé A · impôts différés non déclarés · le jeu n’est pas publiable', false, e.publiable);
  R.egal('Corrigé A · premier exercice, comparatif absent et dit', false, e.comparatif?.disponible);
}

// --- 3 · Corrigé CPCC C · mise en équivalence à 25 % -----------------------------

async function corrigeC(R) {
  const c = await nouveauDossier(R, 'Passe V1 · GINGER Mining SA (corrigé CPCC C)', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'conso-ginger-c', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  await activerModules(c);
  // GINGER SA (corrigé, p. 47) · immobilisations 1 950 000, titres de
  // participation 60 000 (BLEU CIEL 50 000 au 263, GECAMINES 10 000 au 268),
  // clients et trésorerie 2 750 000, capital 1 000 000, réserves 975 000,
  // résultat 275 000, provisions pour risques 250 000, passif circulant
  // 2 260 000. Ouverture · banque 2 750 000 − 275 000 = 2 475 000.
  await bilanOuverture(c, n, '2026-01-01', [
    ['24110000', 'Immobilisations corporelles', 1_950_000, 0], ['26300000', 'Titres BLEU CIEL', 50_000, 0],
    ['26800000', 'Titres GECAMINES', 10_000, 0], [BQ, 'Banque', 2_475_000, 0],
    ['10130000', 'Capital', 0, 1_000_000], ['11810000', 'Réserves', 0, 975_000], ['19100000', 'Provisions pour risques', 0, 250_000],
    ['40110000', 'Passif circulant', 0, 2_260_000],
  ]);
  await ecriture(c, 'Produits 2026', n, '2026-06-30', 'Produits de l’exercice', [[BQ, 1_275_000, 0], ['70110000', 0, 1_275_000]]);
  await ecriture(c, 'Charges 2026', n, '2026-06-30', 'Charges de l’exercice', [['60110000', 1_000_000, 0], [BQ, 0, 1_000_000]]);
  await validerJusqua(c, n, '2026-12-31');

  const bc = await declarerEntite(c, n, 'BLEU CIEL', 25, {
    coutAcquisition: 50_000, compteTitres: '26300000', dateEntree: '2026-01-01',
    capitauxPropresEntree: 200_000, modeDureeEcart: 'NON_DETERMINABLE', dividendesExercice: 0,
  });
  // GECAMINES · 12,5 %, sous le cinquième de l'art. 78 · ni contrôle ni
  // influence notable, titres non consolidés (corrigé · « ne sera pas
  // consolidée, ses titres seront maintenus »).
  const gec = await declarerEntite(c, n, 'GECAMINES SA', 12.5, null);
  if (!bc) return;
  await c.geste('Balance de BLEU CIEL', 'POST', `/consolidation/entites/${bc.id}/balance`, {
    nomFichier: 'bleu-ciel-me-2026.csv',
    contenuBase64: csv4([
      ['24100000', 'Immobilisations corporelles', 400_000], ['52100000', 'Clients et trésorerie', 460_000], ['10100000', 'Capital', -200_000],
      ['11800000', 'Réserves', -180_000], ['13100000', 'Résultat', -60_000], ['40100000', 'Passif circulant', -420_000],
    ]),
  });
  await monnaie(c, bc, 'BLEU CIEL');
  const per = await c.lire('Périmètre GINGER Mining', `/consolidation/perimetre?exerciceId=${n}`);
  const r = (nom) => (per?.resultats ?? []).find((x) => x.nom === nom);
  R.egal('Corrigé C · BLEU CIEL à 25 % · mise en équivalence (art. 78 et 80)', 'ME', r('BLEU CIEL')?.methode);
  R.egal('Corrigé C · GECAMINES à 12,5 % · non consolidée', 'NC', gec ? r('GECAMINES SA')?.methode : 'NC');
  const e = await c.lire('États consolidés GINGER Mining', `/consolidation/etats?exerciceId=${n}`);
  if (!e) return;
  const A = e.bilan.actif;
  const P = e.bilan.passif;
  // Corrigé C (p. 48 et 49) · 25 % × 440 000 = 110 000 substitués aux 50 000.
  R.montant('Corrigé C · titres mis en équivalence (25 % × 440 000)', 110_000, net(A, 'TITRES_MIS_EN_EQUIVALENCE'));
  R.montant('Corrigé C · titres de participation restants (GECAMINES)', 10_000, net(A, 'PARTICIPATIONS_CREANCES_RATTACHEES'));
  R.montant('Corrigé C · immobilisations corporelles', 1_950_000, net(A, 'IMMOBILISATIONS_CORPORELLES'));
  R.montant('Corrigé C · clients et trésorerie', 2_750_000, net(A, 'TRESORERIE_ACTIF'));
  R.montant('Corrigé C · total actif', 4_820_000, net(A, 'TOTAL_GENERAL_ACTIF'));
  R.montant('Corrigé C · capital du groupe', 1_000_000, net(P, 'CAPITAL'));
  R.montant('Corrigé C · réserves consolidées (975 000 + 95 000 − 50 000)', 1_020_000, net(P, 'PRIMES_RESERVES_CONSOLIDEES'));
  R.montant('Corrigé C · résultat consolidé (275 000 + 15 000)', 290_000, net(P, 'RESULTAT_CONSOLIDANTE'));
  R.montant('Corrigé C · capitaux propres', 2_310_000, net(P, 'TOTAL_CAPITAUX_PROPRES'));
  R.montant('Corrigé C · aucun intérêt minoritaire', 0, net(P, 'PART_MINORITAIRES'));
  R.montant('Corrigé C · provisions pour risques', 250_000, net(P, 'PROVISIONS'));
  R.montant('Corrigé C · passif circulant', 2_260_000, net(P, 'FOURNISSEURS'));
  R.montant('Corrigé C · total passif', 4_820_000, net(P, 'TOTAL_GENERAL_PASSIF'));
  R.montant('Corrigé C · quote-part du résultat de BLEU CIEL (25 % × 60 000)', 15_000, net(e.compteDeResultat, 'PART_RESULTATS_ME'));
  R.montant('Corrigé C · résultat de l’ensemble', 290_000, net(e.compteDeResultat, 'RESULTAT_ENSEMBLE'));
  R.egal('Corrigé C · les contrôles des états consolidés bouclent', true, (e.controles ?? []).every((x) => x.ok));
}

// --- 4 · Le groupe Kivu ------------------------------------------------------------

const LUALABA = 'Lualaba Distribution SARL';
const TANGANYIKA = 'Tanganyika Logistique SA';
/** Taux de l'IS, loi n° 23/053, art. 56 · « fixé à 30 % du bénéfice net imposable » (compilation DGI 2026). */
const FISCALITE = { tauxImpotDiffere: 30, sourceTauxImpot: 'Loi n° 23/053, art. 56 · taux de l’impôt sur les sociétés, 30 %', idaOuverture: 0, idaCloture: 0, idpOuverture: 0, idpCloture: 0 };

/**
 * LUALABA, balances à six colonnes · [numéro, intitulé, report, mouvement
 * débit, mouvement crédit].
 *
 * 2026 · ouverture 24 6 000 000, 31 1 000 000, banque 5 000 000, capital
 * 8 000 000, réserves 2 000 000, fournisseurs 2 000 000. Achats à Kivu
 * 6 000 000 (dont 4 000 000 payés), achats extérieurs 4 000 000 payés, ventes
 * 14 000 000 encaissées, stock final 3 000 000 (variation 2 000 000).
 * Résultat 14 − 10 + 2 = 6 000 000 · banque 5 − 4 − 4 + 14 = 11 000 000 ·
 * fournisseurs 2 + 6 − 4 = 4 000 000 (dont 2 000 000 dus à Kivu).
 */
const LUALABA_2026 = [
  ['24110000', 'Matériel industriel', 6_000_000, 0, 0], ['31110000', 'Marchandises', 1_000_000, 2_000_000, 0],
  [BQ, 'Banque', 5_000_000, 14_000_000, 8_000_000], ['10130000', 'Capital', -8_000_000, 0, 0], ['11810000', 'Réserves', -2_000_000, 0, 0],
  ['40110000', 'Fournisseurs', -2_000_000, 4_000_000, 6_000_000], ['70110000', 'Ventes', 0, 0, 14_000_000],
  ['60110000', 'Achats', 0, 10_000_000, 0], ['60310000', 'Variation des stocks', 0, 0, 2_000_000],
];
/**
 * 2027 · report = clôture 2026, résultat au 131. Affectation (réserve légale
 * 600 000, dividendes 2 000 000, report à nouveau 3 400 000), dividendes payés
 * (1 600 000 à Kivu, 400 000 aux minoritaires), dette 2026 envers Kivu payée,
 * achats à Kivu 8 000 000 (dont 5 000 000 payés), achats extérieurs 5 000 000
 * payés, ventes 20 000 000 encaissées, stock final 4 000 000 (variation
 * 1 000 000). Résultat 20 − 13 + 1 = 8 000 000 · banque 11 + 20 − 2 − 2 − 5 −
 * 5 = 17 000 000 · fournisseurs 4 − 2 − 5 + 8 = 5 000 000 (dont 3 000 000 dus
 * à Kivu).
 */
const LUALABA_2027 = [
  ['24110000', 'Matériel industriel', 6_000_000, 0, 0], ['31110000', 'Marchandises', 3_000_000, 1_000_000, 0],
  [BQ, 'Banque', 11_000_000, 20_000_000, 14_000_000], ['10130000', 'Capital', -8_000_000, 0, 0], ['11810000', 'Réserves', -2_000_000, 0, 0],
  ['11100000', 'Réserve légale', 0, 0, 600_000], ['12100000', 'Report à nouveau', 0, 0, 3_400_000], ['13100000', 'Résultat 2026', -6_000_000, 6_000_000, 0],
  ['46500000', 'Dividendes à payer', 0, 2_000_000, 2_000_000], ['40110000', 'Fournisseurs', -4_000_000, 7_000_000, 8_000_000],
  ['70110000', 'Ventes', 0, 0, 20_000_000], ['60110000', 'Achats', 0, 13_000_000, 0], ['60310000', 'Variation des stocks', 0, 0, 1_000_000],
];
/**
 * TANGANYIKA (mise en équivalence, soldes seuls) · 2026 · capital 4 000 000,
 * réserves 500 000 (1 000 000 moins 500 000 de dividendes versés en 2026),
 * résultat 2 000 000 (9 000 000 − 7 000 000). 2027 · réserves 1 500 000
 * (500 000 + 2 000 000 − 1 000 000 de dividendes), résultat 3 000 000.
 */
const TANGANYIKA_2026 = [
  ['24110000', 'Matériel', 3_000_000], [BQ, 'Banque', 5_500_000], ['10130000', 'Capital', -4_000_000], ['11810000', 'Réserves', -500_000],
  ['70110000', 'Ventes', -9_000_000], ['60110000', 'Achats', 7_000_000], ['40110000', 'Fournisseurs', -2_000_000],
];
const TANGANYIKA_2027 = [
  ['24110000', 'Matériel', 3_000_000], [BQ, 'Banque', 7_500_000], ['10130000', 'Capital', -4_000_000], ['11810000', 'Réserves', -1_500_000],
  ['70110000', 'Ventes', -10_000_000], ['60110000', 'Achats', 7_000_000], ['40110000', 'Fournisseurs', -2_000_000],
];

/**
 * Les acquisitions · entrée au 1er janvier 2026, ouverture du premier exercice
 * consolidé. Lualaba · coût 9 000 000 pour 80 % de capitaux propres d'entrée
 * de 10 000 000 → quote-part 8 000 000, écart 1 000 000, durée d'utilité
 * limitée à cinq ans (amorti linéairement, ch. XII-6 § 4). Tanganyika · coût
 * 1 800 000 pour 30 % de 5 000 000 → quote-part 1 500 000, écart 300 000 inclus
 * dans les titres mis en équivalence, durée non déterminable (dix ans).
 */
const acquisitionLualaba = (dividendes) => ({
  coutAcquisition: 9_000_000, compteTitres: '26100000', dateEntree: '2026-01-01', capitauxPropresEntree: 10_000_000,
  modeDureeEcart: 'LIMITEE', dureeEcartAnnees: 5, dividendesExercice: dividendes, ...(dividendes > 0 ? { compteDividendes: '77210000' } : {}),
});
const acquisitionTanganyika = (dividendes) => ({
  coutAcquisition: 1_800_000, compteTitres: '26300000', dateEntree: '2026-01-01', capitauxPropresEntree: 5_000_000,
  modeDureeEcart: 'NON_DETERMINABLE', dividendesExercice: dividendes, compteDividendes: '77210000',
});

async function perimetreEtDeclarations(c, R, exerciceId, an, { lualaba, tanganyika, dividendesL, dividendesT, reciproques, marge }) {
  const L = await declarerEntite(c, exerciceId, LUALABA, 80, acquisitionLualaba(dividendesL), an);
  const T = await declarerEntite(c, exerciceId, TANGANYIKA, 30, acquisitionTanganyika(dividendesT), an);
  if (!L || !T) return null;
  await c.geste(`Balance ${an} de Lualaba (six colonnes)`, 'POST', `/consolidation/entites/${L.id}/balance`, { nomFichier: `lualaba-${an}.csv`, contenuBase64: csv6(lualaba) });
  await c.geste(`Balance ${an} de Tanganyika`, 'POST', `/consolidation/entites/${T.id}/balance`, { nomFichier: `tanganyika-${an}.csv`, contenuBase64: csv4(tanganyika) });
  await monnaie(c, L, LUALABA);
  await monnaie(c, T, TANGANYIKA);
  await c.geste(`Fiscalité ${an} de la consolidante`, 'PUT', '/consolidation/fiscalite', { exerciceId, entiteId: null, ...FISCALITE });
  await c.geste(`Fiscalité ${an} de Lualaba`, 'PUT', '/consolidation/fiscalite', { exerciceId, entiteId: L.id, ...FISCALITE });
  for (const [compteA, compteB, montant, libelle] of reciproques) {
    await c.geste(`Réciproque ${an} · ${libelle}`, 'POST', '/consolidation/reciproques', { exerciceId, entiteAId: null, compteA, entiteBId: L.id, compteB, montant, libelle });
  }
  await c.geste(`Marge interne ${an} en stock`, 'POST', '/consolidation/resultats-internes', {
    exerciceId, vendeuseId: null, acheteuseId: L.id, nature: 'STOCK', compteActif: '31110000', margeOuverture: marge[0], margeCloture: marge[1],
    libelle: 'Marchandises vendues par Kivu à Lualaba, en stock chez Lualaba',
  });
  return { L, T };
}

/** Les attendus d'un exercice consolidé, calculés à la main dans `groupeKivu`. */
function controlerConsolidation(R, an, e, att) {
  const A = e.bilan.actif;
  const P = e.bilan.passif;
  const CR = e.compteDeResultat;
  R.montant(`${an} · consolidé · écart d’acquisition net`, att.ecartNet, net(A, 'ECART_ACQUISITION'));
  R.montant(`${an} · consolidé · immobilisations corporelles`, 16_000_000, net(A, 'IMMOBILISATIONS_CORPORELLES'));
  R.montant(`${an} · consolidé · titres mis en équivalence`, att.tme, net(A, 'TITRES_MIS_EN_EQUIVALENCE'));
  R.montant(`${an} · consolidé · impôts différés actif (30 % de la marge en stock)`, att.ida, net(A, 'IMPOTS_DIFFERES_ACTIF'));
  R.montant(`${an} · consolidé · stocks (marge interne retranchée)`, att.stocks, net(A, 'STOCKS'));
  R.montant(`${an} · consolidé · clients (réciproque éliminée)`, 0, net(A, 'CLIENTS'));
  R.montant(`${an} · consolidé · trésorerie`, att.tresorerie, net(A, 'TRESORERIE_ACTIF'));
  R.montant(`${an} · consolidé · total actif`, att.total, net(A, 'TOTAL_GENERAL_ACTIF'));
  R.montant(`${an} · consolidé · capital`, 20_000_000, net(P, 'CAPITAL'));
  R.montant(`${an} · consolidé · réserves consolidées`, att.reserves, net(P, 'PRIMES_RESERVES_CONSOLIDEES'));
  R.montant(`${an} · consolidé · résultat part du groupe`, att.resultatGroupe, net(P, 'RESULTAT_CONSOLIDANTE'));
  R.montant(`${an} · consolidé · intérêts minoritaires (résultat compris)`, att.minoritaires, net(P, 'PART_MINORITAIRES'));
  R.montant(`${an} · consolidé · fournisseurs (réciproque éliminée)`, 7_000_000, net(P, 'FOURNISSEURS'));
  R.montant(`${an} · consolidé · total passif`, att.total, net(P, 'TOTAL_GENERAL_PASSIF'));
  R.montant(`${an} · consolidé · chiffre d’affaires (ventes internes éliminées)`, att.ca, net(CR, 'CHIFFRE_AFFAIRES'));
  R.montant(`${an} · consolidé · achats consommés`, att.achats, net(CR, 'ACHATS_CONSOMMES'));
  R.montant(`${an} · consolidé · dotations (écarts d’acquisition)`, -230_000, net(CR, 'DOTATIONS'));
  R.montant(`${an} · consolidé · élimination de la marge interne (variation)`, att.elimination, net(CR, 'ELIMINATION_RESULTATS_INTERNES'));
  R.montant(`${an} · consolidé · revenus financiers (dividendes internes éliminés)`, 0, net(CR, 'PRODUITS_FINANCIERS'));
  R.montant(`${an} · consolidé · impôts différés (produit)`, att.impotsDifferes, net(CR, 'IMPOTS_DIFFERES'));
  R.montant(`${an} · consolidé · quote-part des mises en équivalence`, att.quotePartMe, net(CR, 'PART_RESULTATS_ME'));
  R.montant(`${an} · consolidé · résultat de l’ensemble`, att.ensemble, net(CR, 'RESULTAT_ENSEMBLE'));
  R.montant(`${an} · consolidé · résultat des minoritaires`, att.resultatMinoritaires, net(CR, 'RESULTAT_MINORITAIRES'));
  R.egal(`${an} · consolidé · les trois contrôles bouclent`, true, (e.controles ?? []).every((x) => x.ok));
  const note = e.notePerimetre?.lignes ?? [];
  const lu = (nom) => note.find((x) => x.denomination === nom);
  R.egal(`${an} · note du périmètre · Lualaba IG, 80 % de contrôle et d’intérêt`, ['IG', 80, 80], [lu(LUALABA)?.methodeN, lu(LUALABA)?.pctControleN, lu(LUALABA)?.pctInteretN]);
  R.egal(`${an} · note du périmètre · Tanganyika ME, 30 % de contrôle et d’intérêt`, ['ME', 30, 30], [lu(TANGANYIKA)?.methodeN, lu(TANGANYIKA)?.pctControleN, lu(TANGANYIKA)?.pctInteretN]);
}

async function groupeKivu(R) {
  const c = await nouveauDossier(R, 'Passe V1 · Kivu Holding SARL (consolidante)', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'conso-kivu', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  await activerModules(c);
  await c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });

  // --- 2026, comptes individuels de la mère --------------------------------
  // Ouverture · 24 10 000 000, titres Lualaba 9 000 000, titres Tanganyika
  // 1 800 000, stock 2 000 000, banque 7 200 000 · capital 20 000 000,
  // réserves 5 000 000, fournisseurs 5 000 000 (30 000 000 des deux côtés).
  await etape(R, 'Kivu · 2026 · ouverture et opérations de la mère', async () => {
    await bilanOuverture(c, n, '2026-01-01', [
      ['24110000', 'Matériel industriel', 10_000_000, 0], ['26100000', 'Titres Lualaba', 9_000_000, 0], ['26300000', 'Titres Tanganyika', 1_800_000, 0],
      ['31110000', 'Marchandises', 2_000_000, 0], [BQ, 'Banque', 7_200_000, 0],
      ['10130000', 'Capital', 0, 20_000_000], ['11810000', 'Réserves facultatives', 0, 5_000_000], ['40110000', 'Fournisseurs', 0, 5_000_000],
    ]);
    await ecriture(c, 'Ventes extérieures 2026', n, '2026-03-31', 'Ventes extérieures', [[BQ, 30_000_000, 0], ['70110000', 0, 30_000_000]]);
    await ecriture(c, 'Ventes à Lualaba 2026', n, '2026-04-30', 'Ventes à Lualaba', [['41110000', 6_000_000, 0], ['70110000', 0, 6_000_000]]);
    await ecriture(c, 'Achats 2026', n, '2026-05-31', 'Achats de marchandises', [['60110000', 26_000_000, 0], [BQ, 0, 26_000_000]]);
    await ecriture(c, 'Règlement de Lualaba 2026', n, '2026-06-30', 'Règlement Lualaba', [[BQ, 4_000_000, 0], ['41110000', 0, 4_000_000]]);
    await ecriture(c, 'Dividende de Tanganyika 2026', n, '2026-07-31', 'Dividende Tanganyika', [[BQ, 150_000, 0], ['77210000', 0, 150_000]]);
    await validerJusqua(c, n, '2026-12-31');
    const b = await balance(c, n);
    // Banque · 7 200 000 + 30 000 000 − 26 000 000 + 4 000 000 + 150 000.
    R.montant('Kivu 2026 · banque de la mère', 15_350_000, solde(b, BQ));
    // Résultat individuel · 36 000 000 − 26 000 000 + 150 000.
    R.montant('Kivu 2026 · résultat individuel de la mère (classes 6 à 8)', -10_150_000, ['6', '7', '8'].reduce((s, k) => s + (solde(b, k) ?? 0), 0));
  });

  // --- 2026, le périmètre et ses trois refus -------------------------------
  const ctx = {};
  await etape(R, 'Kivu · 2026 · périmètre, refus documentés et déclarations', async () => {
    ctx.n = await perimetreEtDeclarations(c, R, n, '2026', {
      lualaba: LUALABA_2026, tanganyika: TANGANYIKA_2026, dividendesL: 0, dividendesT: 150_000,
      // Kivu · 411 de 2 000 000 contre le 401 de Lualaba ; ventes internes 6 000 000.
      reciproques: [['41110000', '40110000', 2_000_000, 'Créance de Kivu sur Lualaba'], ['70110000', '60110000', 6_000_000, 'Ventes de Kivu à Lualaba']],
      // Marge 25 % du prix de vente interne · 2 000 000 en stock chez Lualaba au 31/12/2026 → 500 000.
      marge: [0, 500_000],
    });
    if (!ctx.n) return R.note('Kivu · périmètre 2026 non déclaré, consolidation 2026 non jouée');
    const { L, T } = ctx.n;
    // (1) Art. 78 · aucune entité ne se détient au-delà de 100 % · 80 % + 25 %.
    await refusAttendu(c, R, 'Refus · participations au-delà de 100 % sur Lualaba (80 % + 25 %)', 'POST', '/consolidation/liens',
      { exerciceId: n, detentriceId: T.id, detenueId: L.id, pctDroitsVote: 25, pctCapital: 25 }, /dépassent 100 %/);
    // (2) D4C ch. XII-5 § 3 · Lualaba → Tanganyika 5 %, puis Tanganyika →
    // Lualaba 5 % · la chaîne ne se referme pas, le moteur refuse.
    const temporaire = await c.geste('Participation temporaire Lualaba → Tanganyika (5 %)', 'POST', '/consolidation/liens',
      { exerciceId: n, detentriceId: L.id, detenueId: T.id, pctDroitsVote: 5, pctCapital: 5 });
    await refusAttendu(c, R, 'Refus · participation croisée Tanganyika → Lualaba', 'POST', '/consolidation/liens',
      { exerciceId: n, detentriceId: T.id, detenueId: L.id, pctDroitsVote: 5, pctCapital: 5 }, /Participations croisées/);
    if (temporaire) await c.geste('Retrait de la participation temporaire', 'DELETE', `/consolidation/liens/${temporaire.id}`);
    // (3) Art. 82 · une entrée au 1er juillet 2026 · la part du résultat
    // antérieure à l'entrée ne se lit pas dans une balance annuelle.
    await c.geste('Acquisition déclarée au 1er juillet 2026 (essai)', 'PUT', `/consolidation/liens/${L.lienId}/acquisition`, { ...acquisitionLualaba(0), dateEntree: '2026-07-01' });
    await refusAttendu(c, R, 'Refus · entrée de Lualaba en cours d’exercice', 'GET', `/consolidation/cumul?exerciceId=${n}`, undefined, /en cours d’exercice/);
    await c.geste('Acquisition de Lualaba rétablie au 1er janvier 2026', 'PUT', `/consolidation/liens/${L.lienId}/acquisition`, acquisitionLualaba(0));
    const per = await c.lire('Périmètre 2026', `/consolidation/perimetre?exerciceId=${n}`);
    const r = (nom) => (per?.resultats ?? []).find((x) => x.nom === nom);
    R.egal('Kivu 2026 · périmètre rétabli après le retrait · Tanganyika à 30 % d’intérêt, ME', [30, 'ME'], [r(TANGANYIKA)?.pctInteret, r(TANGANYIKA)?.methode]);
    R.egal('Kivu 2026 · Lualaba à 80 %, intégration globale (contrôle exclusif de droit)', [80, 'IG'], [r(LUALABA)?.pctInteret, r(LUALABA)?.methode]);
  });

  /**
   * ATTENDUS 2026, à la main (moteur · art. 81 et 82, D4C ch. XII-5 et XII-6).
   * Lualaba (IG, 80 %) · écart 1 000 000 amorti 12/60 = 200 000. Tanganyika
   * (ME, 30 %) · écart 300 000 amorti 12/120 = 30 000 ; titres = 30 % ×
   * 6 500 000 + 270 000 = 2 220 000 ; quote-part du résultat 30 % ×
   * 2 000 000 = 600 000 ; dividende reçu 150 000 éliminé (aux réserves).
   * Marge en stock 500 000 éliminée, impôt différé actif 30 % = 150 000.
   * Mère, résultat retraité · 10 150 000 − 150 000 − 230 000 + 600 000 −
   * 500 000 + 150 000 = 10 020 000 ; Lualaba 6 000 000 → groupe 4 800 000,
   * minoritaires 1 200 000. Résultat groupe 14 820 000, ensemble 16 020 000.
   * Réserves · 5 000 000 de la mère, rien de Lualaba depuis l'entrée.
   * Minoritaires · 20 % × 10 000 000 + 1 200 000 = 3 200 000.
   * Actif · 24 16 000 000 + écart 800 000 + titres ME 2 220 000 + IDA 150 000
   * + stocks (2 000 000 − 500 000 + 3 000 000) 4 500 000 + banque
   * (15 350 000 + 11 000 000) 26 350 000 = 50 020 000. Passif · 20 000 000 +
   * 5 000 000 + 14 820 000 + 3 200 000 + fournisseurs (5 000 000 + 4 000 000
   * − 2 000 000) 7 000 000 = 50 020 000. CA · 36 + 14 − 6 = 44 000 000 ;
   * achats consommés · 26 + 10 − 6 − 2 = 28 000 000.
   */
  const ATTENDU_2026 = {
    ecartNet: 800_000, tme: 2_220_000, ida: 150_000, stocks: 4_500_000, tresorerie: 26_350_000, total: 50_020_000,
    reserves: 5_000_000, resultatGroupe: 14_820_000, minoritaires: 3_200_000, ca: 44_000_000, achats: -28_000_000,
    elimination: -500_000, impotsDifferes: 150_000, quotePartMe: 600_000, ensemble: 16_020_000, resultatMinoritaires: 1_200_000,
  };
  await etape(R, 'Kivu · 2026 · cumul et états consolidés', async () => {
    const cumul = await c.lire('Cumul 2026', `/consolidation/cumul?exerciceId=${n}`);
    const ec = (nom) => (cumul?.ecarts ?? []).find((x) => x.detenue === nom);
    R.montant('Kivu 2026 · écart d’acquisition sur Lualaba (9 000 000 − 80 % × 10 000 000)', 1_000_000, ec(LUALABA)?.ecart);
    R.montant('Kivu 2026 · dotation de l’écart sur Lualaba (1 000 000 × 12/60)', 200_000, ec(LUALABA)?.dotationExercice);
    R.montant('Kivu 2026 · écart d’acquisition sur Tanganyika (1 800 000 − 30 % × 5 000 000)', 300_000, ec(TANGANYIKA)?.ecart);
    R.montant('Kivu 2026 · dotation de l’écart sur Tanganyika (300 000 × 12/120)', 30_000, ec(TANGANYIKA)?.dotationExercice);
    R.montant('Kivu 2026 · cumul équilibré', 0, cumul?.equilibre);
    R.montant('Kivu 2026 · résultat de l’ensemble au cumul', 16_020_000, cumul?.capitauxPropres?.resultatEnsemble);
    R.egal('Kivu 2026 · impôts différés complets (taux et impôts individuels déclarés)', [], cumul?.impotsDifferesIncomplets ?? null);
    const e = await c.lire('États consolidés 2026', `/consolidation/etats?exerciceId=${n}`);
    if (!e) return;
    controlerConsolidation(R, 'Kivu 2026', e, ATTENDU_2026);
    R.egal('Kivu 2026 · premier exercice · comparatif absent, et le motif le dit', [false, true], [e.comparatif?.disponible, /Premier exercice/.test(e.comparatif?.motif ?? '')]);
    R.egal('Kivu 2026 · tableau des flux non établi sans consolidation N-1', null, e.tableauDesFlux?.lignes ?? null);
    R.egal('Kivu 2026 · jeu non publiable (flux, variation, notes du D4C)', false, e.publiable);
    ctx.etats2026 = e;
  });

  // --- Clôture de 2026, relecture ----------------------------------------
  const clos = await etape(R, 'Kivu · clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) {
    R.note('Kivu · 2027 non joué · la clôture de 2026 n’a pas abouti ou l’exercice 2027 manque');
    return;
  }
  await etape(R, 'Kivu · 2026 · les états consolidés se relisent à l’identique après la clôture', async () => {
    // La consolidante se lit AVANT le solde de ses comptes de gestion (audit
    // final F4) · la clôture ne change ni le résultat ni le total.
    const e = await c.lire('États consolidés 2026 après clôture', `/consolidation/etats?exerciceId=${n}`);
    R.montant('Kivu 2026 après clôture · résultat de l’ensemble inchangé', 16_020_000, net(e?.compteDeResultat, 'RESULTAT_ENSEMBLE'));
    R.montant('Kivu 2026 après clôture · total actif inchangé', 50_020_000, net(e?.bilan?.actif, 'TOTAL_GENERAL_ACTIF'));
  });

  // --- 2027, comptes individuels de la mère --------------------------------
  await etape(R, 'Kivu · 2027 · affectation et opérations de la mère', async () => {
    // AUSCGIE art. 346 (SARL) · « une dotation égale à un dixième au moins »
    // du bénéfice à la réserve légale tant qu'elle n'atteint pas le cinquième
    // du capital · 10 % × 10 150 000 = 1 015 000 (cinquième du capital ·
    // 4 000 000). Dividendes 3 000 000, report à nouveau 6 135 000.
    await c.geste('Affectation du résultat 2026', 'POST', '/affectation-resultat', {
      exerciceId: n, dateDecision: '2027-04-30', organe: 'Assemblée générale ordinaire des associés',
      lignes: [
        { compteId: compte(c, '11100000'), montant: 1_015_000 }, { compteId: compte(c, '46500000'), montant: 3_000_000 },
        { compteId: compte(c, '12100000'), montant: 6_135_000 },
      ],
    });
    await ecriture(c, 'Règlement de Lualaba (créance 2026)', n1, '2027-01-20', 'Règlement Lualaba', [[BQ, 2_000_000, 0], ['41110000', 0, 2_000_000]]);
    await ecriture(c, 'Ventes extérieures 2027', n1, '2027-03-31', 'Ventes extérieures', [[BQ, 32_000_000, 0], ['70110000', 0, 32_000_000]]);
    await ecriture(c, 'Ventes à Lualaba 2027', n1, '2027-04-30', 'Ventes à Lualaba', [['41110000', 8_000_000, 0], ['70110000', 0, 8_000_000]]);
    await ecriture(c, 'Paiement des dividendes', n1, '2027-05-15', 'Dividendes 2026 payés', [['46500000', 3_000_000, 0], [BQ, 0, 3_000_000]]);
    await ecriture(c, 'Achats 2027', n1, '2027-05-31', 'Achats de marchandises', [['60110000', 28_000_000, 0], [BQ, 0, 28_000_000]]);
    await ecriture(c, 'Dividende de Lualaba 2027', n1, '2027-06-15', 'Dividende Lualaba (80 % de 2 000 000)', [[BQ, 1_600_000, 0], ['77210000', 0, 1_600_000]]);
    await ecriture(c, 'Règlement de Lualaba 2027', n1, '2027-06-30', 'Règlement Lualaba', [[BQ, 5_000_000, 0], ['41110000', 0, 5_000_000]]);
    await ecriture(c, 'Dividende de Tanganyika 2027', n1, '2027-07-31', 'Dividende Tanganyika (30 % de 1 000 000)', [[BQ, 300_000, 0], ['77210000', 0, 300_000]]);
    await validerJusqua(c, n1, '2027-12-31');
    const b = await balance(c, n1);
    // 15 350 000 + 2 000 000 + 32 000 000 − 3 000 000 − 28 000 000 + 1 600 000 + 5 000 000 + 300 000.
    R.montant('Kivu 2027 · banque de la mère', 25_250_000, solde(b, BQ));
    R.montant('Kivu 2027 · résultat 2026 affecté, compte 13 soldé', 0, solde(b, '13'));
    R.montant('Kivu 2027 · réserve légale dotée', -1_015_000, solde(b, '111'));
    // 40 000 000 − 28 000 000 + 1 900 000.
    R.montant('Kivu 2027 · résultat individuel de la mère', -13_900_000, ['6', '7', '8'].reduce((s, k) => s + (solde(b, k) ?? 0), 0));
  });

  await etape(R, 'Kivu · 2027 · périmètre et déclarations', async () => {
    ctx.n1 = await perimetreEtDeclarations(c, R, n1, '2027', {
      lualaba: LUALABA_2027, tanganyika: TANGANYIKA_2027, dividendesL: 1_600_000, dividendesT: 300_000,
      reciproques: [['41110000', '40110000', 3_000_000, 'Créance de Kivu sur Lualaba'], ['70110000', '60110000', 8_000_000, 'Ventes de Kivu à Lualaba']],
      // 2 400 000 de marchandises Kivu en stock chez Lualaba au 31/12/2027, marge 25 % → 600 000.
      marge: [500_000, 600_000],
    });
  });

  /**
   * ATTENDUS 2027, à la main. Lualaba · écart amorti 24/60 = 400 000, dotation
   * 200 000 ; dividende interne 1 600 000 éliminé. Tanganyika · écart amorti
   * 24/120 = 60 000, dotation 30 000 ; titres 30 % × 8 500 000 + 240 000 =
   * 2 790 000 ; quote-part 900 000 ; dividende 300 000 éliminé. Marge · 600 000
   * en stock, 100 000 au résultat, 500 000 aux réserves ; IDA 180 000, produit
   * 30 000 (taux 30 % N et N-1, report variable sans effet). Mère retraitée ·
   * 13 900 000 − 1 900 000 − 230 000 + 900 000 − 100 000 + 30 000 =
   * 12 600 000 ; Lualaba 8 000 000 → 6 400 000 et 1 600 000. Résultat groupe
   * 19 000 000, ensemble 20 600 000. Réserves · 5 000 000 + 14 820 000 −
   * 3 000 000 distribués = 16 820 000. Minoritaires · 3 200 000 − 400 000 +
   * 1 600 000 = 4 400 000. Actif · 16 000 000 + 600 000 + 2 790 000 + 180 000
   * + stocks (2 000 000 − 600 000 + 4 000 000) 5 400 000 + banque
   * (25 250 000 + 17 000 000) 42 250 000 = 67 220 000. CA · 40 + 20 − 8 =
   * 52 000 000 ; achats consommés · 28 + 13 − 8 − 1 = 32 000 000.
   */
  const ATTENDU_2027 = {
    ecartNet: 600_000, tme: 2_790_000, ida: 180_000, stocks: 5_400_000, tresorerie: 42_250_000, total: 67_220_000,
    reserves: 16_820_000, resultatGroupe: 19_000_000, minoritaires: 4_400_000, ca: 52_000_000, achats: -32_000_000,
    elimination: -100_000, impotsDifferes: 30_000, quotePartMe: 900_000, ensemble: 20_600_000, resultatMinoritaires: 1_600_000,
  };
  await etape(R, 'Kivu · 2027 · états consolidés, flux et variation des capitaux propres', async () => {
    const e = await c.lire('États consolidés 2027', `/consolidation/etats?exerciceId=${n1}`);
    if (!e) return;
    controlerConsolidation(R, 'Kivu 2027', e, ATTENDU_2027);
    R.egal('Kivu 2027 · comparatif 2026 consolidé disponible', true, e.comparatif?.disponible);
    R.montant('Kivu 2027 · colonne N-1 · total actif 2026', 50_020_000, ligne(e.bilan.actif, 'TOTAL_GENERAL_ACTIF')?.netN1);
    R.montant('Kivu 2027 · colonne N-1 · résultat de l’ensemble 2026', 16_020_000, ligne(e.compteDeResultat, 'RESULTAT_ENSEMBLE')?.netN1);
    const note = (e.notePerimetre?.lignes ?? []).find((x) => x.denomination === LUALABA);
    R.egal('Kivu 2027 · note du périmètre · Lualaba IG à 80 % en N-1 aussi', ['IG', 80], [note?.methodeN1, note?.pctInteretN1]);

    /**
     * TABLEAU DES FLUX 2027 (D4C ch. XII-8 § 4) · trésorerie d'ouverture
     * 26 350 000. CAFG · EBE consolidé 52 000 000 − 32 000 000 = 20 000 000,
     * moins la marge éliminée de l'exercice 100 000 = 19 900 000. Besoin de
     * financement · stocks 4 500 000 → 5 400 000, −900 000 ; clients et
     * fournisseurs inchangés (0 et 7 000 000). Dividendes reçus de la ME
     * 300 000. Opérationnels · 19 300 000. Investissement · aucun. Financement ·
     * dividendes de Kivu −3 000 000, aux minoritaires (3 200 000 + 1 600 000 −
     * 4 400 000) −400 000 → −3 400 000. Variation 15 900 000, clôture
     * 42 250 000 (= 26 350 000 + 15 900 000).
     */
    const T = e.tableauDesFlux;
    R.egal('Kivu 2027 · tableau des flux établi (aucun obstacle)', [], T?.obstacles ?? null);
    if (T?.lignes) {
      const f = (cle) => net(T.lignes, cle);
      R.montant('Kivu 2027 · flux · trésorerie d’ouverture', 26_350_000, f('TRESORERIE_OUVERTURE'));
      R.montant('Kivu 2027 · flux · CAFG (20 000 000 − 100 000)', 19_900_000, f('CAFG'));
      R.montant('Kivu 2027 · flux · variation du besoin de financement (stocks)', -900_000, f('VARIATION_BF'));
      R.montant('Kivu 2027 · flux · dividendes reçus de la mise en équivalence', 300_000, f('DIVIDENDES_RECUS_ME'));
      R.montant('Kivu 2027 · flux · opérationnels', 19_300_000, f('FLUX_OPERATIONNELS'));
      R.montant('Kivu 2027 · flux · investissement', 0, f('FLUX_INVESTISSEMENT'));
      R.montant('Kivu 2027 · flux · dividendes versés par Kivu', -3_000_000, f('DIVIDENDES_CONSOLIDANTE'));
      R.montant('Kivu 2027 · flux · dividendes versés aux minoritaires', -400_000, f('DIVIDENDES_MINORITAIRES'));
      R.montant('Kivu 2027 · flux · financement', -3_400_000, f('FLUX_FINANCEMENT'));
      R.montant('Kivu 2027 · flux · variation de la trésorerie', 15_900_000, f('VARIATION_PERIODE'));
      R.montant('Kivu 2027 · flux · trésorerie de clôture', 42_250_000, f('TRESORERIE_CLOTURE'));
      R.egal('Kivu 2027 · flux · trésorerie par les flux = trésorerie du bilan', true, T.controle?.ok);
    }
    /**
     * VARIATION DES CAPITAUX PROPRES 2027 (§ 5) · ouverture groupe 39 820 000
     * (20 000 000 + 5 000 000 + 14 820 000), minoritaires 3 200 000 ;
     * affectation 14 820 000 du résultat aux réserves ; distributions de Kivu
     * −3 000 000 ; résultat 19 000 000 et 1 600 000 ; minoritaires −400 000 ;
     * autres variations nulles ; clôture groupe 55 820 000, minoritaires
     * 4 400 000, total 60 220 000.
     */
    const V = e.variationCapitauxPropres?.lignes ?? [];
    const v = (cle, col) => V.find((x) => x.cle === cle)?.montants?.[col] ?? null;
    R.montant('Kivu 2027 · variation des CP · ouverture, part du groupe', 39_820_000, v('CLOTURE_N1', 'groupe'));
    R.montant('Kivu 2027 · variation des CP · affectation du résultat 2026 aux réserves', 14_820_000, v('AFFECTATION_N1', 'reserves'));
    R.montant('Kivu 2027 · variation des CP · distributions de Kivu', -3_000_000, v('DISTRIBUTIONS_CONSOLIDANTE', 'reserves'));
    R.montant('Kivu 2027 · variation des CP · autres variations des réserves (nulles)', 0, v('AUTRES_RESERVES', 'reserves'));
    R.montant('Kivu 2027 · variation des CP · minoritaires, distributions', -400_000, v('MINORITAIRES_DISTRIBUTIONS', 'minoritaires'));
    R.montant('Kivu 2027 · variation des CP · clôture, part du groupe', 55_820_000, v('CLOTURE_N', 'groupe'));
    R.montant('Kivu 2027 · variation des CP · clôture, total', 60_220_000, v('CLOTURE_N', 'total'));
    R.egal('Kivu 2027 · le jeu reste non publiable (notes du D4C non produites, dit)', [false, true], [e.publiable, (e.motifsNonPubliable ?? []).some((m) => /Notes annexes consolidées non produites/.test(m))]);
    ctx.etats2027 = e;
  });

  await etape(R, 'Kivu · IFRS individuel de la mère (2026 comparatif, 2027 premier exercice IFRS)', () => ifrsIndividuel(c, R, n, n1));
  await etape(R, 'Kivu · IFRS consolidé 2027', () => ifrsConsolide(c, R, n, n1));

  await etape(R, 'Kivu · clôture 2027 et relecture des états consolidés', async () => {
    const ok = await cloturer(c, '2027');
    R.egal('Kivu · clôture 2027 aboutie', true, ok);
    const e = await c.lire('États consolidés 2027 après clôture', `/consolidation/etats?exerciceId=${n1}`);
    R.montant('Kivu 2027 après clôture · résultat de l’ensemble inchangé', 20_600_000, net(e?.compteDeResultat, 'RESULTAT_ENSEMBLE'));
    R.montant('Kivu 2027 après clôture · total actif inchangé', 67_220_000, net(e?.bilan?.actif, 'TOTAL_GENERAL_ACTIF'));
    R.egal('Kivu 2027 après clôture · tableau des flux toujours établi', true, Array.isArray(e?.tableauDesFlux?.lignes));
  });
}

// --- IFRS individuel ---------------------------------------------------------------

/** Les règles de correspondance du dossier · une rubrique d'IFRS 18 par racine utilisée. */
const REGLES_IFRS = [
  ['24', 'SF_IMMOBILISATIONS_CORPORELLES'], ['26', 'SF_ACTIFS_FINANCIERS_NC'], ['31', 'SF_STOCKS'], ['41', 'SF_CREANCES_CLIENTS'],
  ['52', 'SF_TRESORERIE'], ['101', 'SF_CAPITAL'], ['11', 'SF_RESERVES'], ['12', 'SF_RESERVES'], ['40', 'SF_FOURNISSEURS'],
  ['46', 'SF_FOURNISSEURS'], ['70', 'PL_PRODUITS'], ['60', 'PL_ACHATS_CONSOMMES'],
  // Dividendes reçus de participations · catégorie investissement (IFRS 18 § 53 et § 54) pour une entité dont ce n'est pas l'activité principale.
  ['77', 'PL_PRODUITS_INVESTISSEMENT'],
];

async function ifrsIndividuel(c, R, n, n1) {
  await c.geste('Activité principale IFRS (aucune activité spécifiée)', 'PUT', '/ifrs/activite', { activitePrincipale: 'AUCUNE' });
  for (const [prefixe, rubrique] of REGLES_IFRS) await c.geste(`Règle IFRS ${prefixe}`, 'POST', '/ifrs/regles', { prefixe, rubrique });
  // Une règle qui enverrait un compte de gestion (classes 6 à 8) à la
  // situation financière se refuse à la porte (`motifRefusRegle`) · un tel
  // reclassement passe par un retraitement déclaré, jamais par une règle.
  await refusAttendu(c, R, 'IFRS · règle d’un compte de gestion vers une rubrique de bilan', 'POST', '/ifrs/regles', { prefixe: '60', rubrique: 'SF_STOCKS' }, /compte de gestion/);
  await c.geste('Premier exercice IFRS · 2027 (comparatif 2026)', 'PUT', '/ifrs/premiere-application', { premierExerciceIfrsId: n1, dejaAdoptant: false });
  // Deux retraitements de 2027, chacun avec sa norme · une dépréciation du
  // stock à la valeur nette de réalisation (IAS 2 § 9 et § 34), au résultat ;
  // une réévaluation du matériel (IAS 16 § 31 et § 39), en autres éléments du
  // résultat global non recyclables.
  await c.geste('Retraitement IFRS 2027 · dépréciation du stock', 'POST', '/ifrs/retraitements', {
    exerciceId: n1, libelle: 'Stock ramené à sa valeur nette de réalisation', fondement: 'IAS 2 § 9 et § 34',
    lignes: [{ rubrique: 'PL_ACHATS_CONSOMMES', montant: 100_000 }, { rubrique: 'SF_STOCKS', montant: -100_000 }],
  });
  await c.geste('Retraitement IFRS 2027 · réévaluation du matériel', 'POST', '/ifrs/retraitements', {
    exerciceId: n1, libelle: 'Réévaluation du matériel industriel', fondement: 'IAS 16 § 31 et § 39',
    lignes: [{ rubrique: 'SF_IMMOBILISATIONS_CORPORELLES', montant: 500_000 }, { rubrique: 'OCI_NR_AUTRES', montant: -500_000 }],
  });
  await c.geste('Distribution 2027 déclarée (IFRS 18 § 107 c iii)', 'POST', '/ifrs/mouvements-capitaux-propres', {
    exerciceId: n1, type: 'DISTRIBUTION', composante: 'RESERVES', montant: -3_000_000, libelle: 'Dividendes 2026 mis en paiement',
    justification: 'Procès-verbal de l’assemblée générale ordinaire du 30 avril 2027',
  });
  await c.geste('Notes IFRS 2027 · conformité déclarée', 'PUT', '/ifrs/notes', { exerciceId: n1, contenu: { conformiteDeclaree: true } });

  // 2026 · projection du comparatif, sans retraitement · 10 000 000, titres
  // 10 800 000, stock 2 000 000, créance 2 000 000, banque 15 350 000 =
  // 40 150 000 ; capital 20 000 000, réserves 5 000 000, résultat 10 150 000,
  // fournisseurs 5 000 000.
  const e26 = await c.lire('IFRS 2026', `/ifrs?exerciceId=${n}`);
  if (e26?.n) {
    R.montant('IFRS 2026 · total de l’actif', 40_150_000, ifrs(e26.n.situation, 'TOTAL_ACTIF'));
    R.montant('IFRS 2026 · résultat net (36 000 000 − 26 000 000 + 150 000)', 10_150_000, ifrs(e26.n.resultat, 'RESULTAT_NET'));
    R.montant('IFRS 2026 · produits des investissements (dividende reçu)', 150_000, ifrs(e26.n.resultat, 'PL_PRODUITS_INVESTISSEMENT'));
    R.egal('IFRS 2026 · aucun compte sans rubrique', [], e26.n.nonClasses);
  }

  const e = await c.lire('IFRS 2027', `/ifrs?exerciceId=${n1}`);
  if (!e?.n) return;
  const S = e.n.situation;
  const P = e.n.resultat;
  /**
   * 2027, à la main · légal 10 000 000 + 10 800 000 + 2 000 000 + 3 000 000 +
   * 25 250 000 = 51 050 000 ; retraitements + 500 000 − 100 000 → 51 450 000.
   * Capitaux propres · capital 20 000 000, réserves 5 000 000 + 1 015 000 +
   * 6 135 000 = 12 150 000, résultat 13 900 000 − 100 000 = 13 800 000, OCI
   * 500 000 → 46 450 000 ; fournisseurs 5 000 000. Résultat opérationnel
   * 40 000 000 − 28 100 000 = 11 900 000 ; investissement 1 900 000 ; net
   * 13 800 000 ; global 14 300 000.
   */
  R.montant('IFRS 2027 · immobilisations corporelles (réévaluées de 500 000)', 10_500_000, ifrs(S, 'SF_IMMOBILISATIONS_CORPORELLES'));
  R.montant('IFRS 2027 · stocks (dépréciés de 100 000)', 1_900_000, ifrs(S, 'SF_STOCKS'));
  R.montant('IFRS 2027 · trésorerie', 25_250_000, ifrs(S, 'SF_TRESORERIE'));
  R.montant('IFRS 2027 · total de l’actif', 51_450_000, ifrs(S, 'TOTAL_ACTIF'));
  R.montant('IFRS 2027 · réserves (111, 118, 121)', 12_150_000, ifrs(S, 'SF_RESERVES'));
  R.montant('IFRS 2027 · total des capitaux propres', 46_450_000, ifrs(S, 'TOTAL_CAPITAUX_PROPRES'));
  R.montant('IFRS 2027 · total des capitaux propres et du passif', 51_450_000, ifrs(S, 'TOTAL_CAPITAUX_PROPRES_PASSIF'));
  R.montant('IFRS 2027 · résultat opérationnel', 11_900_000, ifrs(P, 'RESULTAT_OPERATIONNEL'));
  R.montant('IFRS 2027 · produits des investissements (dividendes reçus)', 1_900_000, ifrs(P, 'PL_PRODUITS_INVESTISSEMENT'));
  R.montant('IFRS 2027 · résultat net', 13_800_000, ifrs(P, 'RESULTAT_NET'));
  R.montant('IFRS 2027 · résultat global (13 800 000 + 500 000)', 14_300_000, ifrs(e.n.resultatGlobal, 'RESULTAT_GLOBAL'));
  R.montant('IFRS 2027 · rapprochement · résultat SYSCOHADA', 13_900_000, e.n.rapprochements?.resultatSyscohada);
  R.montant('IFRS 2027 · rapprochement · capitaux propres SYSCOHADA', 46_050_000, e.n.rapprochements?.capitauxPropresSyscohada);
  R.egal('IFRS 2027 · contrôles de la situation et du résultat', true, (e.n.controles ?? []).every((x) => x.ok));
  R.egal('IFRS 2027 · IFRS 18 appliquée par anticipation ? non (exercice ouvert le 1er janvier 2027) · aucune mention', false,
    (e.n.mentions ?? []).some((m) => /par anticipation/.test(m)));
  // IFRS 1 · transition au 1er janvier 2026 · capitaux propres SYSCOHADA
  // 25 000 000 = IFRS (aucun ajustement de transition) ; au 31/12/2026,
  // 35 150 000 des deux côtés.
  const pa = e.premiereApplication;
  R.egal('IFRS 1 · première application établie, date de transition au 1er janvier 2026', '2026-01-01', pa?.dateTransition?.slice(0, 10) ?? e.motifPremiereApplication);
  if (pa) {
    const [t0, t1] = pa.rapprochements ?? [];
    R.montant('IFRS 1 · capitaux propres à la transition (SYSCOHADA)', 25_000_000, t0?.depart);
    R.montant('IFRS 1 · capitaux propres à la transition (IFRS)', 25_000_000, t0?.arrivee);
    R.montant('IFRS 1 · capitaux propres au 31/12/2026 (IFRS)', 35_150_000, t1?.arrivee);
    R.montant('IFRS 1 · aucun écart non expliqué', 0, Math.abs(t0?.ecart ?? NaN) + Math.abs(t1?.ecart ?? NaN));
  }
  // Variation des capitaux propres · ouverture 35 150 000, résultat
  // 13 800 000, OCI 500 000, distribution −3 000 000 → 46 450 000, sans écart.
  const V = e.variationCapitauxPropres?.n?.lignes ?? [];
  const v = (cle) => V.find((x) => x.cle === cle)?.total ?? null;
  R.montant('IFRS 2027 · variation des CP · ouverture publiée', 35_150_000, v('OUVERTURE_PUBLIEE'));
  R.montant('IFRS 2027 · variation des CP · distributions', -3_000_000, v('DISTRIBUTIONS'));
  R.montant('IFRS 2027 · variation des CP · résultat global', 14_300_000, v('RESULTAT_GLOBAL'));
  R.montant('IFRS 2027 · variation des CP · clôture', 46_450_000, v('CLOTURE'));
  R.egal('IFRS 2027 · variation des CP · aucun écart non expliqué', null, v('ECART_NON_EXPLIQUE'));
  /**
   * FLUX IFRS 2027 (IAS 7 modifiée par IFRS 18) · exploitation · résultat
   * opérationnel 11 900 000 + 100 000 de retraitement sans trésorerie −
   * 1 000 000 de créances (2 000 000 → 3 000 000) = 11 000 000 ; dividendes
   * reçus en investissement 1 900 000 (§ 34A b) ; dividendes versés en
   * financement −3 000 000 (§ 33A) ; variation 9 900 000, de 15 350 000 à
   * 25 250 000.
   */
  const F = e.fluxTresorerie?.n;
  R.egal('IFRS 2027 · tableau des flux établi', true, Boolean(F?.lignes) || e.fluxTresorerie?.motifN);
  if (F?.lignes) {
    const f = (cle) => F.lignes.find((x) => x.cle === cle)?.montant ?? null;
    R.montant('IFRS 2027 · flux opérationnels', 11_000_000, f('E_TOTAL'));
    R.montant('IFRS 2027 · flux d’investissement (dividendes reçus)', 1_900_000, f('I_TOTAL'));
    R.montant('IFRS 2027 · flux de financement (dividendes versés)', -3_000_000, f('F_TOTAL'));
    R.montant('IFRS 2027 · variation de la trésorerie', 9_900_000, f('T_VARIATION'));
    R.montant('IFRS 2027 · trésorerie de clôture', 25_250_000, f('T_CLOTURE'));
    R.egal('IFRS 2027 · flux · aucun écart non expliqué', null, f('T_ECART'));
  }
  // Notes · la conformité déclarée n'est jamais imprimée sur un jeu non
  // publiable (IAS 8 § 6B) · le § 113 b n'est pas servi, le jeu ne l'est pas.
  const textes = JSON.stringify(e.notes?.notes ?? []);
  R.egal('IFRS 2027 · notes établies', true, (e.notes?.notes ?? []).length > 0);
  R.egal('IFRS 2027 · conformité déclarée et NON imprimée sur un jeu non publiable', [true, false],
    [/NON IMPRIMÉE/.test(textes), /Les états financiers sont conformes aux normes IFRS/.test(textes)]);
  R.egal('IFRS 2027 · non publiable, motif du § 113 b dit', true, (e.n.motifsNonPubliable ?? []).some((m) => /113 b/.test(m)));
}

// --- IFRS consolidé ---------------------------------------------------------------

async function ifrsConsolide(c, R, n, n1) {
  // Les postes qui se DÉCLARENT · la dotation de l'écart d'acquisition en
  // dotations aux amortissements (IFRS 18 § 78 a) ; l'élimination de la marge
  // interne corrige les marchandises consommées, où la marge avait été portée.
  await c.geste('Règle de poste · dotation de l’écart', 'POST', '/ifrs/regles-consolidation', { poste: 'DOTATION_ECART_ACQUISITION', rubrique: 'PL_AMORTISSEMENTS' });
  await c.geste('Règle de poste · marge interne éliminée', 'POST', '/ifrs/regles-consolidation', { poste: 'ELIMINATION_RESULTATS_INTERNES', rubrique: 'PL_ACHATS_CONSOMMES' });

  // Projection seule d'abord · aucun retraitement consolidé.
  const brut = await c.lire('IFRS consolidé 2027 (projection)', `/ifrs/consolide?exerciceId=${n1}`);
  if (!brut?.n) return R.note(`IFRS consolidé 2027 non établi · ${brut?.motifN ?? 'lecture refusée'}`);
  /**
   * PROJECTION 2027, à la main, de la balance du D4C · goodwill 1 000 000 −
   * 400 000 = 600 000 ; participations ME 2 790 000 ; IDA 180 000 ;
   * marchandises consommées 33 000 000 − 1 000 000 + 100 000 = 32 100 000 ;
   * amortissements 230 000 ; résultat net 20 600 000, dont 1 600 000 aux
   * participations ne donnant pas le contrôle et 19 000 000 aux propriétaires.
   */
  R.montant('IFRS consolidé 2027 · goodwill (amorti selon l’AUDCIF)', 600_000, ifrs(brut.n.situation, 'SF_GOODWILL'));
  R.montant('IFRS consolidé 2027 · participations mises en équivalence', 2_790_000, ifrs(brut.n.situation, 'SF_PARTICIPATIONS_MEE'));
  R.montant('IFRS consolidé 2027 · marchandises consommées', -32_100_000, ifrs(brut.n.resultat, 'PL_ACHATS_CONSOMMES'));
  R.montant('IFRS consolidé 2027 · résultat net', 20_600_000, ifrs(brut.n.resultat, 'RESULTAT_NET'));
  R.montant('IFRS consolidé 2027 · résultat net attribuable aux minoritaires', 1_600_000, ifrs(brut.n.resultat, 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'));
  R.montant('IFRS consolidé 2027 · résultat net attribuable aux propriétaires', 19_000_000, ifrs(brut.n.resultat, 'RN_PROPRIETAIRES'));
  R.egal('IFRS consolidé 2027 · goodwill amorti · non publiable, et dit', true, (brut.n.motifsNonPubliable ?? []).some((m) => /B63 a/.test(m)));

  // Retraitements du goodwill (IFRS 3 § B63 a, IAS 36 § 90) · 2026, la
  // dotation de 200 000 annulée ; 2027, le cumul de 400 000 rétabli, dont
  // 200 000 au résultat et 200 000 aux réserves. L'écart d'acquisition de
  // l'AUDCIF est celui du groupe seul (quote-part du coût) · aucune part des
  // minoritaires, déclarée zéro (IFRS 10 § B94).
  const parts = { partMinoritairesResultat: 0, partMinoritairesOci: 0, partMinoritairesCapitauxPropres: 0 };
  await c.geste('Retraitement consolidé 2026 · goodwill non amorti', 'POST', '/ifrs/retraitements', {
    exerciceId: n, consolide: true, libelle: 'Annulation de l’amortissement du goodwill', fondement: 'IFRS 3 § B63 a, IAS 36 § 90',
    lignes: [{ rubrique: 'SF_GOODWILL', montant: 200_000 }, { rubrique: 'PL_AMORTISSEMENTS', montant: -200_000 }], ...parts,
  });
  await c.geste('Retraitement consolidé 2027 · goodwill non amorti', 'POST', '/ifrs/retraitements', {
    exerciceId: n1, consolide: true, libelle: 'Annulation de l’amortissement du goodwill', fondement: 'IFRS 3 § B63 a, IAS 36 § 90',
    lignes: [{ rubrique: 'SF_GOODWILL', montant: 400_000 }, { rubrique: 'PL_AMORTISSEMENTS', montant: -200_000 }, { rubrique: 'SF_RESERVES', montant: -200_000 }], ...parts,
  });
  await c.geste('Distribution consolidée 2027 · propriétaires', 'POST', '/ifrs/mouvements-capitaux-propres', {
    exerciceId: n1, consolide: true, type: 'DISTRIBUTION', composante: 'RESERVES', montant: -3_000_000, libelle: 'Dividendes de Kivu Holding',
    justification: 'Procès-verbal de l’assemblée générale ordinaire du 30 avril 2027',
  });
  await c.geste('Distribution consolidée 2027 · minoritaires', 'POST', '/ifrs/mouvements-capitaux-propres', {
    exerciceId: n1, consolide: true, type: 'DISTRIBUTION', composante: 'MINORITAIRES', montant: -400_000, libelle: 'Dividendes de Lualaba aux associés minoritaires',
    justification: 'Procès-verbal de l’assemblée de Lualaba Distribution SARL · 20 % de 2 000 000',
  });
  await c.geste('IFRS 1 du groupe · premier exercice 2027, exemption C1 prise', 'PUT', '/ifrs/premiere-application', { consolide: true, premierExerciceIfrsId: n1, exemptionRegroupementsC1: true });

  const e = await c.lire('IFRS consolidé 2027', `/ifrs/consolide?exerciceId=${n1}`);
  if (!e?.n) return R.note(`IFRS consolidé 2027 non établi · ${e?.motifN ?? 'lecture refusée'}`);
  const S = e.n.situation;
  const P = e.n.resultat;
  /**
   * AVEC LE RETRAITEMENT · goodwill 1 000 000 ; amortissements 230 000 −
   * 200 000 = 30 000 (celui de l'écart inclus dans les titres ME) ; résultat
   * net 20 800 000, propriétaires 19 200 000, minoritaires 1 600 000 ;
   * réserves 16 820 000 + 200 000 = 17 020 000 ; capitaux propres des
   * propriétaires 20 000 000 + 17 020 000 + 19 200 000 = 56 220 000 ;
   * participations ne donnant pas le contrôle 4 400 000 ; actif 67 220 000 +
   * 400 000 = 67 620 000.
   */
  R.montant('IFRS consolidé 2027 · goodwill au coût', 1_000_000, ifrs(S, 'SF_GOODWILL'));
  R.montant('IFRS consolidé 2027 · amortissements restants', -30_000, ifrs(P, 'PL_AMORTISSEMENTS'));
  R.montant('IFRS consolidé 2027 · quote-part des mises en équivalence', 900_000, ifrs(P, 'PL_QUOTE_PART_MEE'));
  R.montant('IFRS consolidé 2027 · résultat net', 20_800_000, ifrs(P, 'RESULTAT_NET'));
  R.montant('IFRS consolidé 2027 · résultat net, propriétaires', 19_200_000, ifrs(P, 'RN_PROPRIETAIRES'));
  R.montant('IFRS consolidé 2027 · résultat net, minoritaires', 1_600_000, ifrs(P, 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'));
  R.montant('IFRS consolidé 2027 · résultat global, propriétaires', 19_200_000, ifrs(e.n.resultatGlobal, 'RG_PROPRIETAIRES'));
  R.montant('IFRS consolidé 2027 · réserves', 17_020_000, ifrs(S, 'SF_RESERVES'));
  R.montant('IFRS consolidé 2027 · capitaux propres des propriétaires', 56_220_000, ifrs(S, 'TOTAL_CAPITAUX_PROPRES_PROPRIETAIRES'));
  R.montant('IFRS consolidé 2027 · participations ne donnant pas le contrôle', 4_400_000, ifrs(S, 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'));
  R.montant('IFRS consolidé 2027 · total de l’actif', 67_620_000, ifrs(S, 'TOTAL_ACTIF'));
  R.montant('IFRS consolidé 2027 · total des capitaux propres et du passif', 67_620_000, ifrs(S, 'TOTAL_CAPITAUX_PROPRES_PASSIF'));
  R.egal('IFRS consolidé 2027 · contrôles (situation, résultat, résultat de l’ensemble D4C)', true, (e.n.controles ?? []).every((x) => x.ok));
  R.egal('IFRS consolidé 2027 · le motif du goodwill amorti est levé par le retraitement', false, (e.n.motifsNonPubliable ?? []).some((m) => /B63 a/.test(m)));
  // IAS 28 § 32 a · « le goodwill lié à l'entreprise associée […] est inclus
  // dans la valeur comptable de la participation. L'amortissement de ce
  // goodwill n'est pas autorisé » · les 30 000 amortis sur l'écart inclus dans
  // les titres de Tanganyika restent dans l'état IFRS et doivent rester dits.
  R.egal('IFRS consolidé 2027 · l’amortissement de l’écart inclus dans les titres ME (30 000) reste signalé (IAS 28 § 32 a)', true,
    (e.n.motifsNonPubliable ?? []).some((m) => /mise en équivalence|IAS 28/.test(m) && /amorti/.test(m)));

  // C3 · variation des capitaux propres consolidés · ouverture (clôture IFRS
  // 2026 retraitée) propriétaires 20 000 000 + 5 000 000 + 14 820 000 +
  // 200 000 = 40 020 000, minoritaires 3 200 000 ; résultat 19 200 000 et
  // 1 600 000 ; distributions −3 000 000 et −400 000 ; clôture 56 220 000 et
  // 4 400 000, total 60 620 000.
  const V = e.variationCapitauxPropres?.n?.lignes ?? [];
  const v = (cle, col) => V.find((x) => x.cle === cle)?.[col] ?? null;
  R.egal('IFRS consolidé 2027 · variation des CP établie', true, V.length > 0 || e.variationCapitauxPropres?.motifN);
  if (V.length) {
    R.montant('IFRS consolidé 2027 · variation · ouverture, propriétaires', 40_020_000, v('OUVERTURE_PUBLIEE', 'groupe'));
    R.montant('IFRS consolidé 2027 · variation · ouverture, minoritaires', 3_200_000, v('OUVERTURE_PUBLIEE', 'minoritaires'));
    R.montant('IFRS consolidé 2027 · variation · distributions, total', -3_400_000, v('DISTRIBUTIONS', 'total'));
    R.montant('IFRS consolidé 2027 · variation · clôture, total', 60_620_000, v('CLOTURE', 'total'));
    R.egal('IFRS consolidé 2027 · variation · aucun écart non expliqué', null, v('ECART_NON_EXPLIQUE', 'total'));
  }
  // C2 · flux consolidés · variation de la trésorerie 26 350 000 → 42 250 000.
  const F = e.fluxTresorerie?.n;
  if (F?.lignes) {
    const f = (cle) => F.lignes.find((x) => x.cle === cle)?.montant ?? null;
    R.montant('IFRS consolidé 2027 · flux · variation de la trésorerie', 15_900_000, f('T_VARIATION'));
    R.montant('IFRS consolidé 2027 · flux · dividendes versés aux minoritaires', -400_000, f('F_DIVIDENDES_MINORITAIRES'));
    R.montant('IFRS consolidé 2027 · flux · dividendes reçus de la mise en équivalence', 300_000, f('I_DIVIDENDES_MEE'));
    R.montant('IFRS consolidé 2027 · flux · trésorerie de clôture', 42_250_000, f('T_CLOTURE'));
  } else {
    R.note(`IFRS consolidé 2027 · flux non établis · ${e.fluxTresorerie?.motifN ?? 'sans motif'}`);
  }
  // C4 · note IFRS 12 · Lualaba, 20 % de minoritaires.
  R.egal('IFRS consolidé 2027 · note IFRS 12 présente', true, JSON.stringify(e.notes?.notes ?? []).includes('IFRS 12'));
  // C5 · IFRS 1 du groupe · l'ouverture est la consolidation de clôture de
  // l'exercice qui précède le comparatif (2025), absente du dossier · non
  // établie, et le motif le dit.
  R.egal('IFRS consolidé 2027 · IFRS 1 du groupe · ouverture 2025 absente, motif dit', true, e.premiereApplication == null && Boolean(e.motifPremiereApplication));
}

export default async function scenarioConsolidation(registre) {
  registre.scenario = 'consolidation';
  const R = registre;
  await etape(R, 'Cloisonnement · un dossier SYCEBNL n’atteint ni la consolidation ni l’IFRS', () => cloisonnement(R));
  await etape(R, 'Corrigé CPCC A · intégration globale à 55 %', () => corrigeA(R));
  await etape(R, 'Corrigé CPCC C · mise en équivalence à 25 %', () => corrigeC(R));
  await etape(R, 'Groupe Kivu · 2026 et 2027', () => groupeKivu(R));
}
