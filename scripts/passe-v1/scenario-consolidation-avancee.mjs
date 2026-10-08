/**
 * SCÉNARIO · CONSOLIDATION AVANCÉE (AUDCIF art. 74 à 98, D4C Titres XII et
 * XIII) ET IFRS DU GROUPE (IFRS 1, 10, 11, 12, IAS 21, IAS 7, IFRS 18),
 * simulation du logiciel complet, lot J.
 *
 * Le lot C (`scenario-consolidation.mjs`) a joué l'intégration globale, la
 * mise en équivalence, les corrigés CPCC et l'IFRS de base. Ce lot joue ce
 * qu'il n'a pas touché, sur trois groupes nés par l'inscription.
 *
 * A · « Ituri Holding SA », 2025, 2026 et 2027 (2025 donne l'ouverture du
 *     comparatif IFRS, IFRS 1 § 21 et annexe A) · filiale Bunia (IG 80 %),
 *     deux entités sous contrôle CONJOINT (Mambasa 50 %, Komanda 40 %,
 *     accords déclarés · art. 78 et 80), résultats internes IG → IP (au
 *     pourcentage de l'IP) et IP → IP (au plus faible des deux, D4C ch. XII-5
 *     § 5), écarts d'évaluation des trois sorts (amortissable avec son 28,
 *     non amortissable, réalisé), impôts différés (taux déclaré avec sa
 *     source, marges au taux de la VENDEUSE, impôts individuels déclarés),
 *     provisions réglementées contre-passées (15, 851, 861), états N et N-1,
 *     flux et variation des capitaux propres ; puis l'IFRS du GROUPE ·
 *     première application consolidée avec l'exemption C1, rapprochements du
 *     § 24, parts des minoritaires effet par effet, IFRS 12, flux et variation
 *     des capitaux propres avec leur comparatif.
 * B · « Katanga Holding SA », 2026 et 2027 · filiale étrangère en USD (IG
 *     70 %) et associée étrangère en USD (ME 30 %), conversion au cours de
 *     clôture (D4C ch. XII-4 § 3), écart d'acquisition converti, refus, puis
 *     la reclassification IAS 21 en OCI dans les IFRS consolidés.
 * C · « Kasaï Holding SA », 2026 et 2027 · écarts de conversion des comptes
 *     individuels (478, 479) et provision pour pertes de change dans sa
 *     famille (D4C ch. XII-3 § 2, Titre VIII ch. 22 § 2.3), et la lecture du
 *     résultat N-1 non encore affecté de la consolidante.
 * Et les comptes COMBINÉS (Titre XIII), dont l'absence est prouvée.
 *
 * SOURCES DES RÈGLES (relues, jamais de mémoire) · `audcif-acte-uniforme`,
 * `titre-12-13-d4c-consolidation-combinaison.md` (ch. XII-3 à XII-8, XIII) ;
 * `ifrs` (IFRS 1 § 11, § 21, § 24, § C1, § C4 g et h ; IFRS 10 § B94 ;
 * IFRS 11 § 24 ; IFRS 12 § 12, § 21 ; IAS 21 § 39, § 41) ; loi n° 23/053,
 * art. 56 (taux de l'IS, 30 %, `fiscalite-rdc/code-general-2026`) ; AUSCGIE
 * art. 346 et 546 (réserve légale). Les cours de change et les montants des
 * filiales sont des DONNÉES du banc, pas des normes.
 *
 * CONVENTION DES BALANCES IMPORTÉES · six colonnes [numéro, intitulé,
 * report (débit − crédit), mouvement débit, mouvement crédit], le solde se
 * déduit · le tableau des flux consolidé exige les mouvements (D4C ch. XII-8
 * § 4). Chaque attendu est calculé à la main dans le commentaire qui le
 * précède, depuis les opérations du banc et le texte.
 */
import { cloturer, compte, ecriture, etape, nouveauDossier, rechargerExercices, validerJusqua } from './lib.mjs';

const BQ = '52110000';
const PRESENTATION = 'CDF'; // Tenant.devise, défaut du schéma · « unité monétaire ayant cours légal » (art. 87)
/** Loi n° 23/053, art. 56 · « Le taux de l'Impôt sur les Sociétés est fixé à 30 % du bénéfice net imposable ». */
const SOURCE_TAUX = 'Loi n° 23/053 du 30 novembre 2023, art. 56 · 30 % du bénéfice net imposable (promulguée, en vigueur à la clôture au sens du D4C ch. XII-3 § 3)';

// --- Outils du scénario -------------------------------------------------------

const b64 = (texte) => Buffer.from(texte, 'utf8').toString('base64');

/** Balance à quatre colonnes · [numéro, intitulé, solde débit moins crédit]. */
function csv4(lignes) {
  const corps = lignes.map(([n, i, s]) => [n, i, s > 0 ? s : 0, s < 0 ? -s : 0].join(';'));
  return b64(['Numero;Intitule;Debit;Credit', ...corps].join('\n'));
}

/** Balance à six colonnes · [numéro, intitulé, report, mouvement débit, mouvement crédit]. */
function csv6(lignes) {
  const dc = (x) => [x > 0 ? x : 0, x < 0 ? -x : 0];
  const corps = lignes.map(([n, i, rep, md, mc]) => [n, i, ...dc(rep), md, mc, ...dc(rep + md - mc)].join(';'));
  return b64(['Numero;Intitule;Report debit;Report credit;Mouvements debit;Mouvements credit;Solde debit;Solde credit', ...corps].join('\n'));
}

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
async function refusAttendu(c, R, libelle, methode, chemin, corps, motif, statut = 400) {
  const r = await c.req(methode, chemin, corps);
  R.egal(`${libelle} · refusé en ${statut}`, statut, r.statut);
  if (motif) R.egal(`${libelle} · le refus nomme sa cause`, true, motif.test(JSON.stringify(r.corps ?? '')));
  return r;
}

const ligne = (lignes, cle) => (lignes ?? []).find((l) => l.cle === cle);
const net = (lignes, cle) => ligne(lignes, cle)?.net ?? null;
const ifrs = (lignes, cle) => ligne(lignes, cle)?.ifrs ?? null;
const contient = (liste, motif) => (liste ?? []).some((m) => motif.test(String(m)));

/** Une entité du périmètre et la participation directe de la consolidante. */
async function entite(c, exerciceId, nom, pct, an, faits = {}) {
  const e = await c.geste(`Entité ${nom} (${an})`, 'POST', '/consolidation/entites', { exerciceId, nom, dateCloture: `${an}-12-31`, ...faits });
  if (!e) return null;
  const lien = await c.geste(`Participation dans ${nom} (${an})`, 'POST', '/consolidation/liens', { exerciceId, detenueId: e.id, pctDroitsVote: pct, pctCapital: pct });
  return { id: e.id, lienId: lien?.id ?? null, nom };
}

const acquisition = (c, e, corps, an) =>
  e?.lienId && c.geste(`Acquisition de ${e.nom} (${an})`, 'PUT', `/consolidation/liens/${e.lienId}/acquisition`, corps);
const balanceEntite = (c, e, nomFichier, contenuBase64) =>
  e && c.geste(`Balance de ${e.nom} (${nomFichier})`, 'POST', `/consolidation/entites/${e.id}/balance`, { nomFichier, contenuBase64 });
const monnaie = (c, e, corps = { monnaieBalance: PRESENTATION }) =>
  e && c.geste(`Monnaie de ${e.nom}`, 'PUT', `/consolidation/entites/${e.id}/monnaie`, corps);
const fiscalite = (c, exerciceId, e, corps, libelle) =>
  c.geste(`Fiscalité · ${libelle}`, 'PUT', '/consolidation/fiscalite', { exerciceId, entiteId: e ? e.id : null, ...corps });
const reciproque = (c, exerciceId, a, compteA, b, compteB, montant, libelle) =>
  c.geste(`Réciproque · ${libelle}`, 'POST', '/consolidation/reciproques', { exerciceId, entiteAId: a ? a.id : null, compteA, entiteBId: b ? b.id : null, compteB, montant, libelle });
const resultatInterne = (c, exerciceId, vendeuse, acheteuse, ouv, clo, libelle) =>
  c.geste(`Résultat interne · ${libelle}`, 'POST', '/consolidation/resultats-internes', {
    exerciceId, vendeuseId: vendeuse ? vendeuse.id : null, acheteuseId: acheteuse ? acheteuse.id : null,
    nature: 'STOCK', compteActif: '31110000', margeOuverture: ouv, margeCloture: clo, libelle,
  });

const affecter = (c, exerciceId, date, lignes) =>
  c.geste('Affectation du résultat', 'POST', '/affectation-resultat', {
    exerciceId, dateDecision: date, organe: 'Assemblée générale ordinaire des actionnaires',
    lignes: lignes.map(([numero, montant]) => ({ compteId: compte(c, numero), montant })),
  });

/** Contrôles d'un bilan et d'un compte de résultat consolidés · { clé: attendu }. */
function controlerEtats(R, prefixe, e, bilanActif, bilanPassif, cr) {
  for (const [cle, att] of Object.entries(bilanActif)) R.montant(`${prefixe} · actif · ${cle}`, att, net(e?.bilan?.actif, cle));
  for (const [cle, att] of Object.entries(bilanPassif)) R.montant(`${prefixe} · passif · ${cle}`, att, net(e?.bilan?.passif, cle));
  for (const [cle, att] of Object.entries(cr)) R.montant(`${prefixe} · résultat · ${cle}`, att, net(e?.compteDeResultat, cle));
  R.egal(`${prefixe} · les trois contrôles des états consolidés bouclent`, true, (e?.controles ?? []).length > 0 && e.controles.every((x) => x.ok));
}

// =============================================================================
// GROUPE A · ITURI HOLDING SA
// =============================================================================

const BUNIA = 'Bunia Négoce SARL';
const MAMBASA = 'Mambasa Logistique SA';
const KOMANDA = 'Komanda Mines SARL';

/**
 * BALANCES DES ENTITÉS DU GROUPE A, six colonnes. Chaque balance est vérifiée
 * à la main · report équilibré, mouvements débit = crédit, solde = report +
 * mouvements, résultat des classes 6 et 7 indiqué.
 *
 * BUNIA (IG 80 %) · entrée le 1er janvier 2025, capitaux propres d'entrée
 * 8 000 000 (capital 5 000 000, réserves 3 000 000).
 * 2025 · ventes 13 000 000 (dont 1 000 000 à Ituri), achats 7 000 000,
 * dotation 300 000, stock 1 500 000 → 2 000 000 (6031 C 500 000),
 * amortissements dérogatoires D 851 / C 151 400 000. Résultat 5 800 000,
 * banque 700 000 + 13 000 000 − 7 000 000 − 500 000 = 6 200 000.
 */
const BUNIA_2025 = [
  ['22320000', 'Terrain', 2_000_000, 0, 0], ['23130000', 'Bâtiment commercial', 6_000_000, 0, 0],
  ['28310000', 'Amortissements bâtiment', -1_200_000, 0, 300_000], ['31110000', 'Marchandises', 1_500_000, 500_000, 0],
  ['41110000', 'Clients', 1_000_000, 0, 0], [BQ, 'Banque', 700_000, 13_000_000, 7_500_000],
  ['10130000', 'Capital', -5_000_000, 0, 0], ['11810000', 'Réserves', -3_000_000, 0, 0], ['15100000', 'Amortissements dérogatoires', 0, 0, 400_000],
  ['40110000', 'Fournisseurs', -2_000_000, 500_000, 0], ['70110000', 'Ventes', 0, 0, 13_000_000], ['60110000', 'Achats', 0, 7_000_000, 0],
  ['60310000', 'Variation des stocks', 0, 0, 500_000], ['68130000', 'Dotations aux amortissements', 0, 300_000, 0],
  ['85100000', 'Dotations aux provisions réglementées', 0, 400_000, 0],
];
/**
 * 2026 · affectation de 5 800 000 (réserve légale 580 000, dixième du
 * bénéfice, AUSCGIE art. 346 ; dividendes 2 000 000 ; report 3 220 000),
 * dividendes payés, ventes 15 500 000 (dont 1 500 000 à Ituri), achats
 * 8 000 000, fournisseurs payés 500 000, dotation 300 000, stock + 400 000,
 * dérogatoire doté 300 000 et repris 100 000. Résultat 15 500 000 − 8 000 000
 * + 400 000 − 300 000 − 300 000 + 100 000 = 7 400 000 ; banque 6 200 000 +
 * 15 500 000 − 10 500 000 = 11 200 000 ; 151 −600 000.
 */
const BUNIA_2026 = [
  ['22320000', 'Terrain', 2_000_000, 0, 0], ['23130000', 'Bâtiment commercial', 6_000_000, 0, 0],
  ['28310000', 'Amortissements bâtiment', -1_500_000, 0, 300_000], ['31110000', 'Marchandises', 2_000_000, 400_000, 0],
  ['41110000', 'Clients', 1_000_000, 0, 0], [BQ, 'Banque', 6_200_000, 15_500_000, 10_500_000],
  ['10130000', 'Capital', -5_000_000, 0, 0], ['11810000', 'Réserves', -3_000_000, 0, 0], ['11100000', 'Réserve légale', 0, 0, 580_000],
  ['12100000', 'Report à nouveau', 0, 0, 3_220_000], ['13010000', 'Résultat en instance d’affectation', -5_800_000, 5_800_000, 0],
  ['15100000', 'Amortissements dérogatoires', -400_000, 100_000, 300_000], ['40110000', 'Fournisseurs', -1_500_000, 500_000, 0],
  ['46500000', 'Dividendes à payer', 0, 2_000_000, 2_000_000], ['70110000', 'Ventes', 0, 0, 15_500_000], ['60110000', 'Achats', 0, 8_000_000, 0],
  ['60310000', 'Variation des stocks', 0, 0, 400_000], ['68130000', 'Dotations aux amortissements', 0, 300_000, 0],
  ['85100000', 'Dotations aux provisions réglementées', 0, 300_000, 0], ['86100000', 'Reprises de provisions réglementées', 0, 0, 100_000],
];
/**
 * 2027 · affectation de 7 400 000 (réserve légale 420 000, ce qui la porte au
 * cinquième du capital, 1 000 000, art. 346 ; dividendes 3 000 000 ; report
 * 3 980 000), dividendes payés, ventes 17 000 000 (dont 2 000 000 à Ituri),
 * achats 9 000 000, dotation 300 000, stock + 200 000, dérogatoire repris
 * 200 000. Résultat 17 000 000 − 9 000 000 + 200 000 − 300 000 + 200 000 =
 * 8 100 000 ; banque 11 200 000 + 17 000 000 − 12 000 000 = 16 200 000.
 */
const BUNIA_2027 = [
  ['22320000', 'Terrain', 2_000_000, 0, 0], ['23130000', 'Bâtiment commercial', 6_000_000, 0, 0],
  ['28310000', 'Amortissements bâtiment', -1_800_000, 0, 300_000], ['31110000', 'Marchandises', 2_400_000, 200_000, 0],
  ['41110000', 'Clients', 1_000_000, 0, 0], [BQ, 'Banque', 11_200_000, 17_000_000, 12_000_000],
  ['10130000', 'Capital', -5_000_000, 0, 0], ['11810000', 'Réserves', -3_000_000, 0, 0], ['11100000', 'Réserve légale', -580_000, 0, 420_000],
  ['12100000', 'Report à nouveau', -3_220_000, 0, 3_980_000], ['13010000', 'Résultat en instance d’affectation', -7_400_000, 7_400_000, 0],
  ['15100000', 'Amortissements dérogatoires', -600_000, 200_000, 0], ['40110000', 'Fournisseurs', -1_000_000, 0, 0],
  ['46500000', 'Dividendes à payer', 0, 3_000_000, 3_000_000], ['70110000', 'Ventes', 0, 0, 17_000_000], ['60110000', 'Achats', 0, 9_000_000, 0],
  ['60310000', 'Variation des stocks', 0, 0, 200_000], ['68130000', 'Dotations aux amortissements', 0, 300_000, 0],
  ['86100000', 'Reprises de provisions réglementées', 0, 0, 200_000],
];

/**
 * MAMBASA (IP 50 %) · entrée le 1er janvier 2025, capitaux propres 5 000 000.
 * 2025 · achats à Ituri 2 000 000 (dont 1 200 000 payés), ventes 10 500 000
 * (dont 1 500 000 à Komanda, non encaissés), achats extérieurs 5 000 000,
 * dotation 400 000, stock 1 000 000 → 1 600 000. Résultat 10 500 000 −
 * 7 000 000 + 600 000 − 400 000 = 3 700 000 ; banque 2 000 000 + 9 000 000 −
 * 6 200 000 = 4 800 000 ; 401 −2 800 000 (dont 800 000 dus à Ituri).
 */
const MAMBASA_2025 = [
  ['24110000', 'Matériel', 4_000_000, 0, 0], ['28410000', 'Amortissements matériel', 0, 0, 400_000],
  ['31110000', 'Marchandises', 1_000_000, 600_000, 0], ['41110000', 'Clients', 0, 1_500_000, 0],
  [BQ, 'Banque', 2_000_000, 9_000_000, 6_200_000], ['10130000', 'Capital', -4_000_000, 0, 0], ['11810000', 'Réserves', -1_000_000, 0, 0],
  ['40110000', 'Fournisseurs', -2_000_000, 1_200_000, 2_000_000], ['70110000', 'Ventes', 0, 0, 10_500_000],
  ['60110000', 'Achats', 0, 7_000_000, 0], ['60310000', 'Variation des stocks', 0, 0, 600_000], ['68130000', 'Dotations aux amortissements', 0, 400_000, 0],
];
/**
 * 2026 · affectation de 3 700 000 (réserve légale 370 000, dixième, AUSCGIE
 * art. 546 ; réserves 3 330 000), achats à Ituri 3 000 000 (2 800 000
 * payés), ventes 12 000 000 (dont 2 000 000 à Komanda, 2 500 000 encaissés de
 * Komanda), achats extérieurs 5 500 000, dotation 400 000, stock + 400 000.
 * Résultat 12 000 000 − 8 500 000 + 400 000 − 400 000 = 3 500 000 ; banque
 * 4 800 000 + 12 500 000 − 8 300 000 = 9 000 000 ; 401 −3 000 000 (1 000 000 dus à
 * Ituri) ; 411 1 000 000 (sur Komanda).
 */
const MAMBASA_2026 = [
  ['24110000', 'Matériel', 4_000_000, 0, 0], ['28410000', 'Amortissements matériel', -400_000, 0, 400_000],
  ['31110000', 'Marchandises', 1_600_000, 400_000, 0], ['41110000', 'Clients', 1_500_000, 2_000_000, 2_500_000],
  [BQ, 'Banque', 4_800_000, 12_500_000, 8_300_000], ['10130000', 'Capital', -4_000_000, 0, 0], ['11100000', 'Réserve légale', 0, 0, 370_000],
  ['11810000', 'Réserves', -1_000_000, 0, 3_330_000], ['13010000', 'Résultat en instance d’affectation', -3_700_000, 3_700_000, 0],
  ['40110000', 'Fournisseurs', -2_800_000, 2_800_000, 3_000_000], ['70110000', 'Ventes', 0, 0, 12_000_000],
  ['60110000', 'Achats', 0, 8_500_000, 0], ['60310000', 'Variation des stocks', 0, 0, 400_000], ['68130000', 'Dotations aux amortissements', 0, 400_000, 0],
];
/**
 * 2027 · affectation de 3 500 000 (réserve légale 350 000 ; réserves
 * 3 150 000), achats à Ituri 3 500 000 payés, ventes 13 500 000 (dont
 * 2 500 000 à Komanda, encaissés), achats extérieurs 6 000 000, dotation
 * 400 000, stock + 300 000. Résultat 13 500 000 − 9 500 000 + 300 000 −
 * 400 000 = 3 900 000 ; banque 9 000 000 + 13 500 000 − 9 500 000 =
 * 13 000 000 ; 401 −3 000 000 (1 000 000 dus à Ituri) ; 411 1 000 000.
 */
const MAMBASA_2027 = [
  ['24110000', 'Matériel', 4_000_000, 0, 0], ['28410000', 'Amortissements matériel', -800_000, 0, 400_000],
  ['31110000', 'Marchandises', 2_000_000, 300_000, 0], ['41110000', 'Clients', 1_000_000, 2_500_000, 2_500_000],
  [BQ, 'Banque', 9_000_000, 13_500_000, 9_500_000], ['10130000', 'Capital', -4_000_000, 0, 0], ['11100000', 'Réserve légale', -370_000, 0, 350_000],
  ['11810000', 'Réserves', -4_330_000, 0, 3_150_000], ['13010000', 'Résultat en instance d’affectation', -3_500_000, 3_500_000, 0],
  ['40110000', 'Fournisseurs', -3_000_000, 3_500_000, 3_500_000], ['70110000', 'Ventes', 0, 0, 13_500_000],
  ['60110000', 'Achats', 0, 9_500_000, 0], ['60310000', 'Variation des stocks', 0, 0, 300_000], ['68130000', 'Dotations aux amortissements', 0, 400_000, 0],
];

/**
 * KOMANDA (IP 40 %) · entrée le 1er janvier 2025, capitaux propres 4 000 000.
 * 2025 · achats à Mambasa 1 500 000 (non payés), ventes 4 000 000, achats
 * extérieurs 2 000 000, stock 0 → 1 000 000. Résultat 1 500 000 ; banque
 * 3 000 000. 2026 · affectation (réserve légale 150 000, réserves 1 350 000),
 * achats à Mambasa 2 000 000 (2 500 000 payés), ventes 5 000 000, achats
 * 2 000 000, stock + 200 000 · résultat 1 200 000, banque 3 500 000, 401
 * −1 000 000. 2027 · affectation (120 000 et 1 080 000), achats à Mambasa
 * 2 500 000 payés, ventes 5 500 000, achats 2 500 000, stock + 300 000 ·
 * résultat 800 000, banque 4 000 000.
 */
const KOMANDA_2025 = [
  ['24110000', 'Matériel', 3_000_000, 0, 0], ['31110000', 'Marchandises', 0, 1_000_000, 0], [BQ, 'Banque', 1_000_000, 4_000_000, 2_000_000],
  ['10130000', 'Capital', -4_000_000, 0, 0], ['40110000', 'Fournisseurs', 0, 0, 1_500_000], ['70110000', 'Ventes', 0, 0, 4_000_000],
  ['60110000', 'Achats', 0, 3_500_000, 0], ['60310000', 'Variation des stocks', 0, 0, 1_000_000],
];
const KOMANDA_2026 = [
  ['24110000', 'Matériel', 3_000_000, 0, 0], ['31110000', 'Marchandises', 1_000_000, 200_000, 0], [BQ, 'Banque', 3_000_000, 5_000_000, 4_500_000],
  ['10130000', 'Capital', -4_000_000, 0, 0], ['11100000', 'Réserve légale', 0, 0, 150_000], ['11810000', 'Réserves', 0, 0, 1_350_000],
  ['13010000', 'Résultat en instance d’affectation', -1_500_000, 1_500_000, 0], ['40110000', 'Fournisseurs', -1_500_000, 2_500_000, 2_000_000],
  ['70110000', 'Ventes', 0, 0, 5_000_000], ['60110000', 'Achats', 0, 4_000_000, 0], ['60310000', 'Variation des stocks', 0, 0, 200_000],
];
const KOMANDA_2027 = [
  ['24110000', 'Matériel', 3_000_000, 0, 0], ['31110000', 'Marchandises', 1_200_000, 300_000, 0], [BQ, 'Banque', 3_500_000, 5_500_000, 5_000_000],
  ['10130000', 'Capital', -4_000_000, 0, 0], ['11100000', 'Réserve légale', -150_000, 0, 120_000], ['11810000', 'Réserves', -1_350_000, 0, 1_080_000],
  ['13010000', 'Résultat en instance d’affectation', -1_200_000, 1_200_000, 0], ['40110000', 'Fournisseurs', -1_000_000, 2_500_000, 2_500_000],
  ['70110000', 'Ventes', 0, 0, 5_500_000], ['60110000', 'Achats', 0, 5_000_000, 0], ['60310000', 'Variation des stocks', 0, 0, 300_000],
];

/**
 * LES ACQUISITIONS, entrée au 1er janvier 2025 (le moteur refuse l'entrée en
 * cours d'exercice, art. 82).
 * Bunia · coût 9 000 000 ; capitaux propres d'entrée 8 000 000 + écarts
 * d'évaluation nets d'impôt (3 500 000 × 70 % = 2 450 000) = 10 450 000 ;
 * quote-part 80 % = 8 360 000 ; écart d'acquisition 640 000, durée limitée
 * huit ans (80 000 par an, prorata au mois de la convention du dépôt).
 * Mambasa · coût 3 000 000 pour 50 % de 5 000 000 · écart 500 000, durée non
 * déterminable · dix ans (ch. XII-6 § 4), 50 000 par an.
 * Komanda · coût 1 600 000 pour 40 % de 4 000 000 · écart nul.
 */
const ACQ_BUNIA = (div) => ({
  coutAcquisition: 9_000_000, compteTitres: '26100000', dateEntree: '2025-01-01', capitauxPropresEntree: 8_000_000,
  modeDureeEcart: 'LIMITEE', dureeEcartAnnees: 8, dividendesExercice: div, ...(div > 0 ? { compteDividendes: '77210000' } : {}),
});
const ACQ_MAMBASA = { coutAcquisition: 3_000_000, compteTitres: '26200000', dateEntree: '2025-01-01', capitauxPropresEntree: 5_000_000, modeDureeEcart: 'NON_DETERMINABLE', dividendesExercice: 0 };
const ACQ_KOMANDA = { coutAcquisition: 1_600_000, compteTitres: '26200000', dateEntree: '2025-01-01', capitauxPropresEntree: 4_000_000, modeDureeEcart: 'NON_DETERMINABLE', dividendesExercice: 0 };

/**
 * LES ÉCARTS D'ÉVALUATION DE BUNIA À L'ENTRÉE (D4C ch. XII-6 § 1 et § 3),
 * redéclarés chaque exercice (le périmètre se recrée par exercice) · le
 * terrain (+1 000 000, non amortissable), le bâtiment (+2 000 000, amorti sur
 * la durée d'utilité restant à courir, dix ans, au 28310000), le stock
 * (+500 000, réalisé le 30 juin 2025, vendu au premier semestre).
 */
const ECARTS_BUNIA = [
  { compte: '22320000', libelle: 'Terrain réestimé à la juste valeur', montant: 1_000_000, mode: 'NON_AMORTISSABLE' },
  { compte: '23130000', compteAmortissement: '28310000', libelle: 'Bâtiment réestimé à la juste valeur', montant: 2_000_000, mode: 'AMORTISSABLE', dureeAnnees: 10 },
  { compte: '31110000', libelle: 'Stock réestimé, vendu au premier semestre 2025', montant: 500_000, mode: 'REALISE', dateRealisation: '2025-06-30' },
];

/** Bunia déclare des impôts différés actifs individuels (décalages temporaires), avec le motif de leur probabilité. */
const JUSTIFICATION_IDA = 'Décalage temporaire · provision pour congés payés déductible à son paiement ; bénéfices imposables prévus aux budgets 2026 à 2028 approuvés par le conseil (D4C ch. XII-3 § 3).';
const fiscaliteBunia = (ouv, clo) => ({ tauxImpotDiffere: 30, sourceTauxImpot: SOURCE_TAUX, idaOuverture: ouv, idaCloture: clo, idpOuverture: 0, idpCloture: 0, justificationIda: JUSTIFICATION_IDA });
const FISCALITE_SIMPLE = { tauxImpotDiffere: 30, sourceTauxImpot: SOURCE_TAUX, idaOuverture: 0, idaCloture: 0, idpOuverture: 0, idpCloture: 0 };

/**
 * Le périmètre d'un exercice, déclaré en entier · entités, accords de contrôle
 * conjoint, acquisitions, balances, monnaies, écarts d'évaluation, fiscalité,
 * réciproques et résultats internes. `options.sansMambasaFiscal` laisse
 * Mambasa sans réponse fiscale (2025, premier passage).
 */
async function perimetreIturi(c, R, n, an, d) {
  const B = await entite(c, n, BUNIA, 80, an);
  const M = await entite(c, n, MAMBASA, 50, an, d.accordDirect ? { accordControleConjoint: true } : {});
  const K = await entite(c, n, KOMANDA, 40, an, d.accordDirect ? { accordControleConjoint: true } : {});
  if (!B || !M || !K) return null;
  if (!d.accordDirect) {
    // ART. 78 · le contrôle conjoint « suppose un accord contractuel » · aucun
    // pourcentage ne le révèle. Sans accord déclaré, 50 % (pas « la majorité ») et
    // 40 % (pas « plus de 40 % ») ne donnent qu'une influence notable présumée
    // (au moins un cinquième) · mise en équivalence (art. 80).
    const p0 = await c.lire(`Périmètre ${an} sans accord`, `/consolidation/perimetre?exerciceId=${n}`);
    const r0 = (nom) => (p0?.resultats ?? []).find((x) => x.nom === nom);
    R.egal(`${an} · Mambasa 50 % sans accord déclaré · influence notable, mise en équivalence`, ['INFLUENCE_NOTABLE', 'ME'], [r0(MAMBASA)?.natureControle, r0(MAMBASA)?.methode]);
    R.egal(`${an} · Komanda 40 % sans accord déclaré · influence notable, mise en équivalence`, ['INFLUENCE_NOTABLE', 'ME'], [r0(KOMANDA)?.natureControle, r0(KOMANDA)?.methode]);
    await c.geste('Accord de contrôle conjoint de Mambasa', 'PATCH', `/consolidation/entites/${M.id}`, { accordControleConjoint: true });
    await c.geste('Accord de contrôle conjoint de Komanda', 'PATCH', `/consolidation/entites/${K.id}`, { accordControleConjoint: true });
  }
  const p = await c.lire(`Périmètre ${an}`, `/consolidation/perimetre?exerciceId=${n}`);
  const r = (nom) => (p?.resultats ?? []).find((x) => x.nom === nom);
  R.egal(`${an} · Bunia · contrôle exclusif de droit, IG, 80 % d’intérêt`, ['EXCLUSIF_DE_DROIT', 'IG', 80], [r(BUNIA)?.natureControle, r(BUNIA)?.methode, r(BUNIA)?.pctInteret]);
  R.egal(`${an} · Mambasa · accord déclaré · contrôle conjoint, intégration proportionnelle (art. 78 et 80)`, ['CONJOINT', 'IP', 50], [r(MAMBASA)?.natureControle, r(MAMBASA)?.methode, r(MAMBASA)?.pctInteret]);
  R.egal(`${an} · Komanda · accord déclaré · contrôle conjoint, intégration proportionnelle`, ['CONJOINT', 'IP', 40], [r(KOMANDA)?.natureControle, r(KOMANDA)?.methode, r(KOMANDA)?.pctInteret]);

  await acquisition(c, B, ACQ_BUNIA(d.dividendesBunia), an);
  await acquisition(c, M, ACQ_MAMBASA, an);
  await acquisition(c, K, ACQ_KOMANDA, an);
  await balanceEntite(c, B, `bunia-${an}.csv`, csv6(d.bunia));
  await balanceEntite(c, M, `mambasa-${an}.csv`, csv6(d.mambasa));
  await balanceEntite(c, K, `komanda-${an}.csv`, csv6(d.komanda));
  for (const e of [B, M, K]) await monnaie(c, e);
  for (const ev of ECARTS_BUNIA) await c.geste(`Écart d’évaluation ${an} · ${ev.libelle}`, 'POST', `/consolidation/liens/${B.lienId}/ecarts-evaluation`, ev);
  await fiscalite(c, n, null, FISCALITE_SIMPLE, `${an} · Ituri Holding`);
  await fiscalite(c, n, B, fiscaliteBunia(d.idaBunia[0], d.idaBunia[1]), `${an} · Bunia`);
  await fiscalite(c, n, K, FISCALITE_SIMPLE, `${an} · Komanda`);
  if (!d.sansMambasaFiscal) await fiscalite(c, n, M, FISCALITE_SIMPLE, `${an} · Mambasa`);
  for (const [a, ca, b, cb, m, l] of d.reciproques({ B, M, K })) await reciproque(c, n, a, ca, b, cb, m, l);
  for (const [v, a, o, cl, l] of d.internes({ B, M, K })) await resultatInterne(c, n, v, a, o, cl, l);
  return { B, M, K };
}

/**
 * Réciproques d'un exercice (montants à 100 %, le moteur applique le facteur
 * du ch. XII-5 § 5) · [entité A, compte A, entité B, compte B, montant, libellé].
 */
const reciproquesIturi = (creanceMambasa, ventesMambasa, ventesBunia, creanceKomanda, ventesKomanda) => ({ M, B, K }) => [
  [null, '41110000', M, '40110000', creanceMambasa, 'Créance d’Ituri sur Mambasa'],
  [null, '70110000', M, '60110000', ventesMambasa, 'Ventes d’Ituri à Mambasa'],
  [B, '70110000', null, '60110000', ventesBunia, 'Ventes de Bunia à Ituri'],
  [M, '41110000', K, '40110000', creanceKomanda, 'Créance de Mambasa sur Komanda'],
  [M, '70110000', K, '60110000', ventesKomanda, 'Ventes de Mambasa à Komanda'],
];
/** Résultats internes d'un exercice · [vendeuse, acheteuse, marge d'ouverture, marge de clôture, libellé], à 100 %. */
const internesIturi = (m1, m2, m3) => ({ M, B, K }) => [
  [null, M, m1[0], m1[1], 'Marchandises d’Ituri en stock chez Mambasa (IG → IP)'],
  [M, K, m2[0], m2[1], 'Marchandises de Mambasa en stock chez Komanda (IP → IP)'],
  [B, null, m3[0], m3[1], 'Marchandises de Bunia en stock chez Ituri (IG → IG)'],
];

async function groupeIturi(R) {
  const c = await nouveauDossier(R, 'Passe V1 · Ituri Holding SA (consolidation avancée)', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'conso2-ituri', exercice: ['2025-01-01', '2025-12-31'],
  });
  const n25 = c.exercices.get('2025')?.id;
  await activerModules(c);
  await c.geste('Forme juridique SA', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });

  // COMPTES COMBINÉS (D4C Titre XIII) · le module n'en porte AUCUNE route ·
  // le contrôleur `consolidation` ne sert que le périmètre, le cumul, les états
  // et leurs déclarations (Titre XII), et `docs/releve-de-manques-referentiels.md`
  // range les art. 74 à 110 « combinaison » parmi ce qui est hors du logiciel ;
  // le dossier de combinaison du module groupe est UNE entité en plusieurs
  // dossiers (`groupe/fondement-elimination.ts` · le D4C n'y est qu'une
  // « référence empruntée »). La preuve par l'API · la route n'existe pas.
  await etape(R, 'Comptes combinés (Titre XIII) · absence prouvée', async () => {
    const r = await c.req('GET', `/consolidation/combinaison?exerciceId=${n25}`);
    R.egal('Comptes combinés · aucune route de combinaison au module de consolidation (404)', 404, r.statut);
    R.note('Comptes combinés (D4C Titre XIII) · non portés par OmegaX · aucune route (404), consolidation.controller.ts ne sert que le Titre XII, et docs/releve-de-manques-referentiels.md les déclare hors du logiciel.');
  });

  // --- 2025 · comptes de la consolidante ----------------------------------
  /**
   * Ouverture au 1er janvier 2025 · matériel 20 000 000, titres Bunia
   * 9 000 000 (261), titres Mambasa et Komanda 4 600 000 (262), stock
   * 5 000 000, banque 11 400 000 · capital 30 000 000, réserves 10 000 000,
   * fournisseurs 10 000 000.
   * 2025 · ventes extérieures 40 000 000, ventes à Mambasa 2 000 000 (dont
   * 1 200 000 encaissés), achats extérieurs 30 000 000, achats à Bunia
   * 1 000 000 payés, fournisseurs payés 4 000 000, stock + 1 000 000.
   * Résultat 42 000 000 − 31 000 000 + 1 000 000 = 12 000 000 ; banque
   * 11 400 000 + 40 000 000 + 1 200 000 − 30 000 000 − 1 000 000 − 4 000 000 =
   * 17 600 000.
   */
  await etape(R, 'Ituri · 2025 · comptes de la consolidante', async () => {
    await bilanOuverture(c, n25, '2025-01-01', [
      ['24110000', 'Matériel industriel', 20_000_000, 0], ['26100000', 'Titres Bunia', 9_000_000, 0], ['26200000', 'Titres Mambasa et Komanda', 4_600_000, 0],
      ['31110000', 'Marchandises', 5_000_000, 0], [BQ, 'Banque', 11_400_000, 0],
      ['10130000', 'Capital', 0, 30_000_000], ['11810000', 'Réserves facultatives', 0, 10_000_000], ['40110000', 'Fournisseurs', 0, 10_000_000],
    ]);
    await ecriture(c, 'Ventes extérieures 2025', n25, '2025-02-28', 'Ventes extérieures', [[BQ, 40_000_000, 0], ['70110000', 0, 40_000_000]]);
    await ecriture(c, 'Ventes à Mambasa 2025', n25, '2025-03-31', 'Ventes à Mambasa', [['41110000', 2_000_000, 0], ['70110000', 0, 2_000_000]]);
    await ecriture(c, 'Achats extérieurs 2025', n25, '2025-04-30', 'Achats de marchandises', [['60110000', 30_000_000, 0], [BQ, 0, 30_000_000]]);
    await ecriture(c, 'Achats à Bunia 2025', n25, '2025-05-31', 'Achats à Bunia', [['60110000', 1_000_000, 0], [BQ, 0, 1_000_000]]);
    await ecriture(c, 'Règlement de Mambasa 2025', n25, '2025-06-30', 'Règlement Mambasa', [[BQ, 1_200_000, 0], ['41110000', 0, 1_200_000]]);
    await ecriture(c, 'Fournisseurs payés 2025', n25, '2025-09-30', 'Règlement fournisseurs', [['40110000', 4_000_000, 0], [BQ, 0, 4_000_000]]);
    await ecriture(c, 'Variation de stock 2025', n25, '2025-12-31', 'Stock final', [['31110000', 1_000_000, 0], ['60310000', 0, 1_000_000]]);
    await validerJusqua(c, n25, '2025-12-31');
  });

  const ctx = {};
  await etape(R, 'Ituri · 2025 · périmètre, déclarations et refus', async () => {
    ctx.e25 = await perimetreIturi(c, R, n25, '2025', {
      accordDirect: false, dividendesBunia: 0, bunia: BUNIA_2025, mambasa: MAMBASA_2025, komanda: KOMANDA_2025,
      idaBunia: [0, 60_000], sansMambasaFiscal: true,
      reciproques: reciproquesIturi(800_000, 2_000_000, 1_000_000, 1_500_000, 1_500_000),
      internes: internesIturi([0, 400_000], [0, 300_000], [0, 250_000]),
    });
    if (!ctx.e25) return;
    const { B, M, K } = ctx.e25;
    // Les refus de la porte · un écart d'évaluation s'affecte à un élément
    // IDENTIFIABLE (2, 3, 16 à 19), jamais aux capitaux propres (ch. XII-6
    // § 1) ; amortissable, il exige la durée restant à courir et son 28.
    await refusAttendu(c, R, 'Écart d’évaluation affecté aux capitaux propres (11810000)', 'POST', `/consolidation/liens/${B.lienId}/ecarts-evaluation`,
      { compte: '11810000', libelle: 'Réserve de réestimation', montant: 100_000, mode: 'NON_AMORTISSABLE' }, /IDENTIFIABLE/);
    await refusAttendu(c, R, 'Écart d’évaluation amortissable sans compte 28', 'POST', `/consolidation/liens/${B.lienId}/ecarts-evaluation`,
      { compte: '24110000', libelle: 'Matériel réestimé', montant: 100_000, mode: 'AMORTISSABLE', dureeAnnees: 5 }, /compte 28/);
    // Fiscalité · un taux se déclare AVEC sa source ; un impôt différé actif
    // n'est comptabilisé que si son imputation est PROBABLE (ch. XII-3 § 3).
    await refusAttendu(c, R, 'Taux d’impôt différé déclaré sans source', 'PUT', '/consolidation/fiscalite',
      { exerciceId: n25, entiteId: K.id, tauxImpotDiffere: 30 }, /source/);
    await refusAttendu(c, R, 'Impôt différé actif déclaré sans motif de probabilité', 'PUT', '/consolidation/fiscalite',
      { exerciceId: n25, entiteId: K.id, ...FISCALITE_SIMPLE, idaCloture: 50_000 }, /probable/);

    // MAMBASA N'A RIEN RÉPONDU · « null n'est pas zéro ». Deux manques nommés ·
    // ses impôts différés individuels, et le taux de la VENDEUSE de la marge
    // Mambasa → Komanda (art. 92, 2° · « au taux de la vendeuse, qui a payé
    // l'impôt ») · Komanda, l'acheteuse, a un taux, et il ne sert pas.
    const cu0 = await c.lire('Cumul 2025 (Mambasa sans réponse fiscale)', `/consolidation/cumul?exerciceId=${n25}`);
    const inc = cu0?.impotsDifferesIncomplets ?? [];
    R.egal('2025 · Mambasa sans réponse · impôts différés incomplets, ses comptes individuels nommés', true, contient(inc, /Mambasa Logistique SA.*n’a pas déclaré les impôts différés/));
    R.egal('2025 · marge Mambasa → Komanda · c’est le taux de la VENDEUSE qui manque, pas celui de l’acheteuse', true, contient(inc, /aucun taux d’impôt déclaré pour « Mambasa Logistique SA »/));
    const e0 = await c.lire('États 2025 (Mambasa sans réponse fiscale)', `/consolidation/etats?exerciceId=${n25}`);
    // IDA sans la marge Mambasa · 60 000 (Ituri, 30 % de 200 000) + 75 000
    // (Bunia, 30 % de 250 000) + 60 000 (Bunia, déclaré) = 195 000.
    R.montant('2025 · Mambasa sans réponse · IDA sans la marge Mambasa → Komanda (60 000 + 75 000 + 60 000)', 195_000, net(e0?.bilan?.actif, 'IMPOTS_DIFFERES_ACTIF'));
    R.egal('2025 · Mambasa sans réponse · bilan et résultat non publiables, motif nommé', [false, true],
      [e0?.bilanEtResultatPubliables, contient(e0?.motifsNonPubliable, /Impôts différés incomplets.*Mambasa/)]);
    await fiscalite(c, n25, M, FISCALITE_SIMPLE, '2025 · Mambasa (réponse donnée)');

    // IP À DEUX DÉTENTRICES · l'art. 81 parle de « la fraction représentative
    // des intérêts de l'entité détentrice » · aucun texte ne dit laquelle
    // retenir quand il y en a deux. Une participation de Bunia dans Komanda,
    // le temps du refus, puis retirée.
    const tmp = await c.geste('Participation temporaire Bunia → Komanda (5 %)', 'POST', '/consolidation/liens',
      { exerciceId: n25, detentriceId: B.id, detenueId: K.id, pctDroitsVote: 5, pctCapital: 5 });
    if (tmp) {
      await c.geste('Acquisition temporaire Bunia → Komanda', 'PUT', `/consolidation/liens/${tmp.id}/acquisition`,
        { ...ACQ_KOMANDA, coutAcquisition: 200_000 });
      await refusAttendu(c, R, 'Intégration proportionnelle à deux détentrices déclarées', 'GET', `/consolidation/cumul?exerciceId=${n25}`, undefined, /2 détentrices/);
      await c.geste('Retrait de la participation temporaire', 'DELETE', `/consolidation/liens/${tmp.id}`);
    }
  });

  /**
   * ATTENDUS 2025, à la main (moteur · art. 81 à 86, D4C ch. XII-3, XII-5,
   * XII-6). Facteurs · Ituri et Bunia 1, Mambasa 0,5, Komanda 0,4 ; part du
   * groupe · Bunia 0,8, les deux IP 1 (intérêt ÷ fraction).
   *
   * Bunia · écarts · terrain 1 000 000 (IDP 300 000) ; bâtiment 2 000 000
   * amorti 200 000 (au 2831, au résultat ; reste 1 800 000, IDP 540 000) ;
   * stock 500 000 réalisé au résultat (IDP soldé) · résultat − 700 000, impôt
   * différé + 210 000. Marge Bunia → Ituri 250 000 éliminée, IDA 75 000.
   * Dérogatoire · 851 de 400 000 retiré du résultat, IDP 120 000, charge
   * 120 000. IDA déclaré 60 000 (produit 60 000). Résultat retraité ·
   * 5 800 000 + 400 000 − 700 000 − 250 000 + 225 000 = 5 475 000 · groupe
   * 4 380 000, minoritaires 1 095 000 ; capitaux propres retraités 10 450 000
   * · minoritaires 2 090 000.
   * Ituri · 12 000 000 − dotations des écarts 130 000 (80 000 + 50 000) −
   * marge chez Mambasa 400 000 × 50 % = 200 000 + IDA 60 000 = 11 730 000.
   * Mambasa · 3 700 000 × 50 % = 1 850 000 − marge chez Komanda 300 000 ×
   * min(50 %, 40 %) = 120 000 + IDA 36 000 = 1 766 000. Komanda · 600 000.
   * Résultat groupe 11 730 000 + 4 380 000 + 1 766 000 + 600 000 =
   * 18 476 000 ; ensemble 19 571 000. Réserves · entrée au 1er janvier, rien
   * d'acquis depuis · 10 000 000 (celles d'Ituri).
   * Bilan · corporelles brut 3 000 000 + 8 000 000 + 23 200 000 (24 · 20 M +
   * 4 M × 50 % + 3 M × 40 %), amortissements 1 700 000 + 200 000 · net
   * 32 300 000 ; écart d'acquisition 1 140 000 − 130 000 = 1 010 000 ; IDA
   * 60 000 + 75 000 + 60 000 + 36 000 = 231 000 ; stocks 5 800 000 +
   * 1 750 000 + 680 000 + 400 000 = 8 630 000 ; clients 800 000 + 1 000 000 +
   * 750 000 − 400 000 − 600 000 = 1 550 000 ; banque 17 600 000 + 6 200 000 +
   * 2 400 000 + 1 200 000 = 27 400 000 · total 71 121 000. Passif · capital
   * 30 000 000, réserves 10 000 000, résultat 18 476 000, minoritaires
   * 3 185 000, IDP 960 000, fournisseurs 6 000 000 + 1 500 000 + 1 400 000 +
   * 600 000 − 400 000 − 600 000 = 8 500 000.
   * Résultat · CA 42 + 13 + 5,25 + 1,6 − 1 − 1 − 0,6 = 59 250 000 ; achats
   * 40 300 000 − variation 2 200 000 = 38 100 000 ; dotations 500 000 +
   * 130 000 ; marges éliminées 200 000 + 120 000 + 250 000 = 570 000.
   */
  await etape(R, 'Ituri · 2025 · cumul et états consolidés', async () => {
    const cu = await c.lire('Cumul 2025', `/consolidation/cumul?exerciceId=${n25}`);
    const ec = (nom) => (cu?.ecarts ?? []).find((x) => x.detenue === nom);
    R.montant('2025 · écart d’acquisition Bunia (9 000 000 − 80 % × 10 450 000)', 640_000, ec(BUNIA)?.ecart);
    R.montant('2025 · quote-part d’entrée de Bunia, écarts d’évaluation nets d’impôt compris', 8_360_000, ec(BUNIA)?.quotePartCapitauxPropresEntree);
    R.montant('2025 · dotation de l’écart Bunia (640 000 × 12/96)', 80_000, ec(BUNIA)?.dotationExercice);
    R.egal('2025 · écart d’acquisition Mambasa · méthode IP', 'IP', ec(MAMBASA)?.methode);
    R.montant('2025 · écart d’acquisition Mambasa (3 000 000 − 50 % × 5 000 000)', 500_000, ec(MAMBASA)?.ecart);
    R.montant('2025 · dotation de l’écart Mambasa (500 000 × 12/120)', 50_000, ec(MAMBASA)?.dotationExercice);
    R.montant('2025 · écart d’acquisition Komanda nul', 0, ec(KOMANDA)?.ecart);
    const ev = (lib) => (cu?.ecartsEvaluation ?? []).find((x) => x.detenue === BUNIA && x.libelle.startsWith(lib));
    R.montant('2025 · écart du terrain (non amortissable) · restant 1 000 000', 1_000_000, ev('Terrain')?.restantCloture);
    R.montant('2025 · écart du terrain · impôt différé passif 30 %', -300_000, ev('Terrain')?.impotDiffereCloture);
    R.montant('2025 · écart du bâtiment · restant 2 000 000 − 200 000', 1_800_000, ev('Bâtiment')?.restantCloture);
    R.montant('2025 · écart du bâtiment · impôt différé passif 30 % de 1 800 000', -540_000, ev('Bâtiment')?.impotDiffereCloture);
    R.montant('2025 · écart du stock réalisé le 30 juin · restant nul', 0, ev('Stock')?.restantCloture);
    R.egal('2025 · impôts différés complets', [], cu?.impotsDifferesIncomplets ?? null);
    R.montant('2025 · cumul équilibré', 0, cu?.equilibre);
    R.montant('2025 · réserves du groupe (celles d’Ituri, entrée au 1er janvier)', 10_000_000, cu?.capitauxPropres?.reservesGroupe);
    R.montant('2025 · intérêts minoritaires hors résultat (20 % × 10 450 000)', 2_090_000, cu?.capitauxPropres?.interetsMinoritairesHorsResultat);
    R.montant('2025 · résultat du groupe', 18_476_000, cu?.capitauxPropres?.resultatGroupe);
    R.montant('2025 · résultat des minoritaires (20 % × 5 475 000)', 1_095_000, cu?.capitauxPropres?.resultatMinoritaires);
    const e = await c.lire('États consolidés 2025', `/consolidation/etats?exerciceId=${n25}`);
    controlerEtats(R, '2025', e,
      { ECART_ACQUISITION: 1_010_000, IMMOBILISATIONS_CORPORELLES: 32_300_000, IMPOTS_DIFFERES_ACTIF: 231_000, STOCKS: 8_630_000, CLIENTS: 1_550_000, TRESORERIE_ACTIF: 27_400_000, TOTAL_GENERAL_ACTIF: 71_121_000 },
      { CAPITAL: 30_000_000, PRIMES_RESERVES_CONSOLIDEES: 10_000_000, RESULTAT_CONSOLIDANTE: 18_476_000, PART_MINORITAIRES: 3_185_000, IMPOTS_DIFFERES_PASSIF: 960_000, FOURNISSEURS: 8_500_000, TOTAL_GENERAL_PASSIF: 71_121_000 },
      { CHIFFRE_AFFAIRES: 59_250_000, ACHATS_CONSOMMES: -38_100_000, DOTATIONS: -630_000, ELIMINATION_RESULTATS_INTERNES: -570_000, ECARTS_EVALUATION_RESULTAT: -700_000, IMPOTS_DIFFERES: 321_000, RESULTAT_ENSEMBLE: 19_571_000, RESULTAT_MINORITAIRES: 1_095_000, RESULTAT_CONSOLIDANTE_CR: 18_476_000 });
    // Les provisions réglementées sont contre-passées · leur ligne de garde
    // ne doit jamais porter un solde (« un solde ici est un défaut du moteur »).
    R.egal('2025 · aucune provision réglementée laissée au bilan consolidé', true, !ligne(e?.bilan?.passif, 'PROVISIONS_REGLEMENTEES'));
    R.egal('2025 · bilan et résultat publiables (le jeu, lui, ne l’est pas · premier exercice)', [true, false], [e?.bilanEtResultatPubliables, e?.publiable]);
    const np = (nom) => (e?.notePerimetre?.lignes ?? []).find((x) => x.denomination === nom);
    R.egal('2025 · note du périmètre · Mambasa IP, 50 % de contrôle et d’intérêt', ['IP', 50, 50], [np(MAMBASA)?.methodeN, np(MAMBASA)?.pctControleN, np(MAMBASA)?.pctInteretN]);
    R.egal('2025 · note du périmètre · Komanda IP, 40 %', ['IP', 40, 40], [np(KOMANDA)?.methodeN, np(KOMANDA)?.pctControleN, np(KOMANDA)?.pctInteretN]);
  });

  const clos25 = await etape(R, 'Ituri · clôture 2025', () => cloturer(c, '2025'));
  await rechargerExercices(c);
  const n26 = c.exercices.get('2026')?.id;
  if (!clos25 || !n26) return R.note('Ituri · 2026 et 2027 non joués · la clôture de 2025 n’a pas abouti');

  /**
   * 2026 · affectation de 12 000 000 (réserve légale 1 200 000, dixième du
   * bénéfice, AUSCGIE art. 546 ; dividendes 4 000 000 ; report 6 800 000),
   * dividendes payés, ventes extérieures 45 000 000, ventes à Mambasa
   * 3 000 000, achats 33 000 000, achats à Bunia 1 500 000, dividende de Bunia
   * 1 600 000 (80 % de 2 000 000), règlement de Mambasa 2 800 000,
   * fournisseurs 1 000 000, stock + 500 000. Résultat 48 000 000 + 1 600 000
   * + 500 000 − 34 500 000 = 15 600 000 ; banque 17 600 000 − 4 000 000 +
   * 45 000 000 − 33 000 000 − 1 500 000 + 1 600 000 + 2 800 000 − 1 000 000 =
   * 27 500 000.
   */
  await etape(R, 'Ituri · 2026 · comptes de la consolidante', async () => {
    await affecter(c, n25, '2026-04-30', [['11100000', 1_200_000], ['46500000', 4_000_000], ['12100000', 6_800_000]]);
    await ecriture(c, 'Ventes extérieures 2026', n26, '2026-02-28', 'Ventes extérieures', [[BQ, 45_000_000, 0], ['70110000', 0, 45_000_000]]);
    await ecriture(c, 'Ventes à Mambasa 2026', n26, '2026-03-31', 'Ventes à Mambasa', [['41110000', 3_000_000, 0], ['70110000', 0, 3_000_000]]);
    await ecriture(c, 'Achats extérieurs 2026', n26, '2026-04-30', 'Achats de marchandises', [['60110000', 33_000_000, 0], [BQ, 0, 33_000_000]]);
    await ecriture(c, 'Dividendes 2025 payés', n26, '2026-05-15', 'Dividendes payés', [['46500000', 4_000_000, 0], [BQ, 0, 4_000_000]]);
    await ecriture(c, 'Achats à Bunia 2026', n26, '2026-05-31', 'Achats à Bunia', [['60110000', 1_500_000, 0], [BQ, 0, 1_500_000]]);
    await ecriture(c, 'Dividende de Bunia 2026', n26, '2026-06-15', 'Dividende Bunia (80 % de 2 000 000)', [[BQ, 1_600_000, 0], ['77210000', 0, 1_600_000]]);
    await ecriture(c, 'Règlement de Mambasa 2026', n26, '2026-06-30', 'Règlement Mambasa', [[BQ, 2_800_000, 0], ['41110000', 0, 2_800_000]]);
    await ecriture(c, 'Fournisseurs payés 2026', n26, '2026-09-30', 'Règlement fournisseurs', [['40110000', 1_000_000, 0], [BQ, 0, 1_000_000]]);
    await ecriture(c, 'Variation de stock 2026', n26, '2026-12-31', 'Stock final', [['31110000', 500_000, 0], ['60310000', 0, 500_000]]);
    await validerJusqua(c, n26, '2026-12-31');
  });
  await etape(R, 'Ituri · 2026 · périmètre et déclarations', async () => {
    ctx.e26 = await perimetreIturi(c, R, n26, '2026', {
      accordDirect: true, dividendesBunia: 1_600_000, bunia: BUNIA_2026, mambasa: MAMBASA_2026, komanda: KOMANDA_2026,
      idaBunia: [60_000, 90_000],
      reciproques: reciproquesIturi(1_000_000, 3_000_000, 1_500_000, 1_000_000, 2_000_000),
      internes: internesIturi([400_000, 500_000], [300_000, 400_000], [250_000, 300_000]),
    });
  });

  /**
   * ATTENDUS 2026, à la main. Bunia · écarts · bâtiment 200 000 au résultat,
   * reste 1 600 000 (IDP 480 000), terrain IDP 300 000 ; dérogatoire · 851
   * 300 000 et 861 100 000 retirés, IDP 180 000, charge 60 000, l'ouverture
   * (400 000 × 70 %) aux réserves ; marge Bunia → Ituri 250 000 → 300 000,
   * 50 000 au résultat, IDA 90 000 ; IDA déclaré 60 000 → 90 000 (produit
   * 30 000). Résultat retraité 7 400 000 + 300 000 − 100 000 − 200 000 −
   * 50 000 + 45 000 = 7 395 000 · groupe 5 916 000, minoritaires 1 479 000.
   * Ituri · 15 600 000 − dividende interne 1 600 000 − 130 000 − marge chez
   * Mambasa (500 000 − 400 000) × 50 % = 50 000 + 15 000 = 13 835 000.
   * Mambasa · 1 750 000 − (400 000 − 300 000) × 40 % + 12 000 = 1 722 000 ;
   * Komanda 480 000. Résultat groupe 21 953 000, ensemble 23 432 000.
   * Réserves 10 000 000 + 18 476 000 − dividendes d'Ituri 4 000 000 =
   * 24 476 000 ; minoritaires 3 185 000 − 400 000 de dividendes + 1 479 000 =
   * 4 264 000. Bilan · corporelles 3 000 000 + 8 000 000 + 23 200 000 −
   * 2 200 000 − 400 000 = 31 600 000 ; écart 1 140 000 − 260 000 = 880 000 ;
   * IDA 75 000 + 180 000 + 48 000 = 303 000 ; stocks 6 250 000 + 2 100 000 +
   * 840 000 + 480 000 = 9 670 000 ; clients 1 000 000 + 1 000 000 + 500 000 −
   * 500 000 − 400 000 = 1 600 000 ; banque 27 500 000 + 11 200 000 +
   * 4 500 000 + 1 400 000 = 44 600 000 · total 88 653 000 ; fournisseurs
   * 7 900 000 − 900 000 = 7 000 000 ; IDP 960 000.
   * CA 48 + 15,5 + 6 + 2 − 1,5 − 1,5 − 0,8 = 67 700 000 ; achats 44 550 000 −
   * 1 180 000 = 43 370 000.
   * FLUX (D4C ch. XII-8 § 4) · ouverture 27 400 000 ; CAFG = EBE
   * 24 330 000 − marges éliminées 140 000 = 24 190 000 ; stocks −1 040 000,
   * créances −50 000, fournisseurs −1 500 000 · BF −2 590 000 ; opérationnels
   * 21 600 000 ; dividendes d'Ituri −4 000 000, aux minoritaires
   * (3 185 000 + 1 479 000 − 4 264 000) −400 000 ; variation 17 200 000 ;
   * clôture 44 600 000.
   */
  await etape(R, 'Ituri · 2026 · états consolidés, flux et capitaux propres', async () => {
    const cu = await c.lire('Cumul 2026', `/consolidation/cumul?exerciceId=${n26}`);
    R.montant('2026 · réserves du groupe (10 000 000 + 18 476 000 − 4 000 000)', 24_476_000, cu?.capitauxPropres?.reservesGroupe);
    R.montant('2026 · intérêts minoritaires hors résultat (3 185 000 − 400 000)', 2_785_000, cu?.capitauxPropres?.interetsMinoritairesHorsResultat);
    R.egal('2026 · report variable · taux N-1 retrouvé, aucun avertissement', false, contient(cu?.avertissements, /Report variable/));
    const e = await c.lire('États consolidés 2026', `/consolidation/etats?exerciceId=${n26}`);
    controlerEtats(R, '2026', e,
      { ECART_ACQUISITION: 880_000, IMMOBILISATIONS_CORPORELLES: 31_600_000, IMPOTS_DIFFERES_ACTIF: 303_000, STOCKS: 9_670_000, CLIENTS: 1_600_000, TRESORERIE_ACTIF: 44_600_000, TOTAL_GENERAL_ACTIF: 88_653_000 },
      { CAPITAL: 30_000_000, PRIMES_RESERVES_CONSOLIDEES: 24_476_000, RESULTAT_CONSOLIDANTE: 21_953_000, PART_MINORITAIRES: 4_264_000, IMPOTS_DIFFERES_PASSIF: 960_000, FOURNISSEURS: 7_000_000, TOTAL_GENERAL_PASSIF: 88_653_000 },
      { CHIFFRE_AFFAIRES: 67_700_000, ACHATS_CONSOMMES: -43_370_000, DOTATIONS: -630_000, ELIMINATION_RESULTATS_INTERNES: -140_000, ECARTS_EVALUATION_RESULTAT: -200_000, IMPOTS_DIFFERES: 72_000, PRODUITS_FINANCIERS: 0, RESULTAT_ENSEMBLE: 23_432_000, RESULTAT_MINORITAIRES: 1_479_000, RESULTAT_CONSOLIDANTE_CR: 21_953_000 });
    R.montant('2026 · colonne N-1 · total actif 2025', 71_121_000, ligne(e?.bilan?.actif, 'TOTAL_GENERAL_ACTIF')?.netN1);
    const T = e?.tableauDesFlux;
    R.egal('2026 · tableau des flux établi (même périmètre, balances à six colonnes)', [], T?.obstacles ?? null);
    if (T?.lignes) {
      const f = (cle) => net(T.lignes, cle);
      R.montant('2026 · flux · trésorerie d’ouverture', 27_400_000, f('TRESORERIE_OUVERTURE'));
      R.montant('2026 · flux · CAFG (24 330 000 − 140 000)', 24_190_000, f('CAFG'));
      R.montant('2026 · flux · variation du besoin de financement', -2_590_000, f('VARIATION_BF'));
      R.montant('2026 · flux · opérationnels', 21_600_000, f('FLUX_OPERATIONNELS'));
      R.montant('2026 · flux · investissement', 0, f('FLUX_INVESTISSEMENT'));
      R.montant('2026 · flux · dividendes d’Ituri', -4_000_000, f('DIVIDENDES_CONSOLIDANTE'));
      R.montant('2026 · flux · dividendes aux minoritaires (20 % de 2 000 000)', -400_000, f('DIVIDENDES_MINORITAIRES'));
      R.montant('2026 · flux · variation de la trésorerie', 17_200_000, f('VARIATION_PERIODE'));
      R.montant('2026 · flux · trésorerie de clôture', 44_600_000, f('TRESORERIE_CLOTURE'));
      R.egal('2026 · flux · trésorerie par les flux = trésorerie du bilan', true, T.controle?.ok);
    }
    const V = e?.variationCapitauxPropres?.lignes ?? [];
    const v = (cle, col) => V.find((x) => x.cle === cle)?.montants?.[col] ?? null;
    R.montant('2026 · variation des CP · ouverture, groupe (30 + 10 + 18,476 M)', 58_476_000, v('CLOTURE_N1', 'groupe'));
    R.montant('2026 · variation des CP · ouverture, minoritaires', 3_185_000, v('CLOTURE_N1', 'minoritaires'));
    R.montant('2026 · variation des CP · distributions d’Ituri', -4_000_000, v('DISTRIBUTIONS_CONSOLIDANTE', 'reserves'));
    R.montant('2026 · variation des CP · autres variations des réserves (nulles)', 0, v('AUTRES_RESERVES', 'reserves'));
    R.montant('2026 · variation des CP · minoritaires, distributions', -400_000, v('MINORITAIRES_DISTRIBUTIONS', 'minoritaires'));
    R.montant('2026 · variation des CP · clôture, total', 80_693_000, v('CLOTURE_N', 'total'));
  });

  const clos26 = await etape(R, 'Ituri · clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n27 = c.exercices.get('2027')?.id;
  if (!clos26 || !n27) return R.note('Ituri · 2027 non joué · la clôture de 2026 n’a pas abouti');

  /**
   * 2027 · affectation de 15 600 000 (réserve légale 1 560 000, la portant à
   * 2 760 000, sous le cinquième du capital, art. 546 ; dividendes
   * 5 000 000 ; report 9 040 000), dividendes payés, ventes extérieures
   * 50 000 000, ventes à Mambasa 3 500 000 (encaissées, et l'ancien solde de
   * 1 000 000 aussi), achats 36 000 000, achats à Bunia 2 000 000, dividende
   * de Bunia 2 400 000 (80 % de 3 000 000), fournisseurs 1 000 000, stock +
   * 500 000. Résultat 53 500 000 + 2 400 000 + 500 000 − 38 000 000 =
   * 18 400 000 ; banque 27 500 000 − 5 000 000 + 50 000 000 + 3 500 000 −
   * 36 000 000 − 2 000 000 + 2 400 000 − 1 000 000 = 39 400 000.
   */
  await etape(R, 'Ituri · 2027 · comptes de la consolidante', async () => {
    await affecter(c, n26, '2027-04-30', [['11100000', 1_560_000], ['46500000', 5_000_000], ['12100000', 9_040_000]]);
    await ecriture(c, 'Ventes extérieures 2027', n27, '2027-02-28', 'Ventes extérieures', [[BQ, 50_000_000, 0], ['70110000', 0, 50_000_000]]);
    await ecriture(c, 'Ventes à Mambasa 2027', n27, '2027-03-31', 'Ventes à Mambasa', [['41110000', 3_500_000, 0], ['70110000', 0, 3_500_000]]);
    await ecriture(c, 'Achats extérieurs 2027', n27, '2027-04-30', 'Achats de marchandises', [['60110000', 36_000_000, 0], [BQ, 0, 36_000_000]]);
    await ecriture(c, 'Dividendes 2026 payés', n27, '2027-05-15', 'Dividendes payés', [['46500000', 5_000_000, 0], [BQ, 0, 5_000_000]]);
    await ecriture(c, 'Achats à Bunia 2027', n27, '2027-05-31', 'Achats à Bunia', [['60110000', 2_000_000, 0], [BQ, 0, 2_000_000]]);
    await ecriture(c, 'Dividende de Bunia 2027', n27, '2027-06-15', 'Dividende Bunia (80 % de 3 000 000)', [[BQ, 2_400_000, 0], ['77210000', 0, 2_400_000]]);
    await ecriture(c, 'Règlement de Mambasa 2027', n27, '2027-06-30', 'Règlement Mambasa', [[BQ, 3_500_000, 0], ['41110000', 0, 3_500_000]]);
    await ecriture(c, 'Fournisseurs payés 2027', n27, '2027-09-30', 'Règlement fournisseurs', [['40110000', 1_000_000, 0], [BQ, 0, 1_000_000]]);
    await ecriture(c, 'Variation de stock 2027', n27, '2027-12-31', 'Stock final', [['31110000', 500_000, 0], ['60310000', 0, 500_000]]);
    await validerJusqua(c, n27, '2027-12-31');
  });
  await etape(R, 'Ituri · 2027 · périmètre et déclarations', async () => {
    ctx.e27 = await perimetreIturi(c, R, n27, '2027', {
      accordDirect: true, dividendesBunia: 2_400_000, bunia: BUNIA_2027, mambasa: MAMBASA_2027, komanda: KOMANDA_2027,
      idaBunia: [90_000, 30_000],
      reciproques: reciproquesIturi(1_000_000, 3_500_000, 2_000_000, 1_000_000, 2_500_000),
      internes: internesIturi([500_000, 600_000], [400_000, 500_000], [300_000, 350_000]),
    });
  });

  /**
   * ATTENDUS 2027, à la main. Bunia · bâtiment 200 000 au résultat, reste
   * 1 400 000 (IDP 420 000) ; dérogatoire repris 200 000 (861 retiré, impôt
   * différé produit 60 000, IDP 120 000 sur le 151 de 400 000) ; marge
   * 300 000 → 350 000 (50 000, IDA 105 000) ; IDA déclaré 90 000 → 30 000
   * (charge 60 000). Résultat retraité 8 100 000 − 200 000 − 200 000 −
   * 50 000 + 75 000 = 7 725 000 · groupe 6 180 000, minoritaires 1 545 000.
   * Ituri · 18 400 000 − 2 400 000 − 130 000 − 50 000 + 15 000 = 15 835 000 ;
   * Mambasa · 1 950 000 − 40 000 + 12 000 = 1 922 000 ; Komanda 320 000.
   * Résultat groupe 24 257 000, ensemble 25 802 000. Réserves 24 476 000 +
   * 21 953 000 − 5 000 000 = 41 429 000 ; minoritaires 2 785 000 + 1 479 000
   * − 600 000 + 1 545 000 = 5 209 000. Bilan · corporelles 34 200 000 −
   * 2 700 000 − 600 000 = 30 900 000 ; écart 1 140 000 − 390 000 = 750 000 ;
   * IDA 90 000 + 135 000 + 60 000 = 285 000 ; stocks 6 700 000 + 2 250 000 +
   * 950 000 + 600 000 = 10 500 000 ; clients 1 600 000 ; banque 39 400 000 +
   * 16 200 000 + 6 500 000 + 1 600 000 = 63 700 000 · total 107 735 000 ;
   * fournisseurs 6 900 000 − 900 000 = 6 000 000 ; IDP 840 000.
   * CA 53,5 + 17 + 6,75 + 2,2 − 1,75 − 2 − 1 = 74 700 000 ; achats
   * 49 000 000 − 970 000 = 48 030 000.
   * FLUX · ouverture 44 600 000 ; CAFG 26 670 000 − 140 000 = 26 530 000 ;
   * BF · stocks −830 000, créances 0, fournisseurs −1 000 000 ; opérationnels
   * 24 700 000 ; dividendes −5 000 000 et −600 000 ; variation 19 100 000.
   */
  await etape(R, 'Ituri · 2027 · états consolidés, flux et capitaux propres', async () => {
    const e = await c.lire('États consolidés 2027', `/consolidation/etats?exerciceId=${n27}`);
    controlerEtats(R, '2027', e,
      { ECART_ACQUISITION: 750_000, IMMOBILISATIONS_CORPORELLES: 30_900_000, IMPOTS_DIFFERES_ACTIF: 285_000, STOCKS: 10_500_000, CLIENTS: 1_600_000, TRESORERIE_ACTIF: 63_700_000, TOTAL_GENERAL_ACTIF: 107_735_000 },
      { CAPITAL: 30_000_000, PRIMES_RESERVES_CONSOLIDEES: 41_429_000, RESULTAT_CONSOLIDANTE: 24_257_000, PART_MINORITAIRES: 5_209_000, IMPOTS_DIFFERES_PASSIF: 840_000, FOURNISSEURS: 6_000_000, TOTAL_GENERAL_PASSIF: 107_735_000 },
      { CHIFFRE_AFFAIRES: 74_700_000, ACHATS_CONSOMMES: -48_030_000, DOTATIONS: -630_000, ELIMINATION_RESULTATS_INTERNES: -140_000, ECARTS_EVALUATION_RESULTAT: -200_000, IMPOTS_DIFFERES: 102_000, RESULTAT_ENSEMBLE: 25_802_000, RESULTAT_MINORITAIRES: 1_545_000, RESULTAT_CONSOLIDANTE_CR: 24_257_000 });
    const T = e?.tableauDesFlux;
    R.egal('2027 · tableau des flux établi', [], T?.obstacles ?? null);
    if (T?.lignes) {
      const f = (cle) => net(T.lignes, cle);
      R.montant('2027 · flux · CAFG (26 670 000 − 140 000)', 26_530_000, f('CAFG'));
      R.montant('2027 · flux · variation du besoin de financement', -1_830_000, f('VARIATION_BF'));
      R.montant('2027 · flux · opérationnels', 24_700_000, f('FLUX_OPERATIONNELS'));
      R.montant('2027 · flux · dividendes aux minoritaires (20 % de 3 000 000)', -600_000, f('DIVIDENDES_MINORITAIRES'));
      R.montant('2027 · flux · financement', -5_600_000, f('FLUX_FINANCEMENT'));
      R.montant('2027 · flux · trésorerie de clôture', 63_700_000, f('TRESORERIE_CLOTURE'));
      R.egal('2027 · flux · trésorerie par les flux = trésorerie du bilan', true, T.controle?.ok);
    }
    const V = e?.variationCapitauxPropres?.lignes ?? [];
    const v = (cle, col) => V.find((x) => x.cle === cle)?.montants?.[col] ?? null;
    R.montant('2027 · variation des CP · affectation du résultat 2026', 21_953_000, v('AFFECTATION_N1', 'reserves'));
    R.montant('2027 · variation des CP · autres variations des réserves (nulles)', 0, v('AUTRES_RESERVES', 'reserves'));
    R.montant('2027 · variation des CP · clôture, part du groupe', 95_686_000, v('CLOTURE_N', 'groupe'));
    R.montant('2027 · variation des CP · clôture, total', 100_895_000, v('CLOTURE_N', 'total'));
  });

  await etape(R, 'Ituri · IFRS du groupe (IFRS 1 consolidé, parts des minoritaires, IFRS 12, flux, capitaux propres)', () => ifrsIturi(c, R, n25, n26, n27));

  await etape(R, 'Ituri · clôture 2027 et relecture', async () => {
    R.egal('Ituri · clôture 2027 aboutie', true, await cloturer(c, '2027'));
    const e = await c.lire('États consolidés 2027 après clôture', `/consolidation/etats?exerciceId=${n27}`);
    R.montant('2027 après clôture · résultat de l’ensemble inchangé', 25_802_000, net(e?.compteDeResultat, 'RESULTAT_ENSEMBLE'));
    R.montant('2027 après clôture · total actif inchangé', 107_735_000, net(e?.bilan?.actif, 'TOTAL_GENERAL_ACTIF'));
  });
}

// --- IFRS du groupe Ituri -----------------------------------------------------

const REGLES_IFRS_ITURI = [
  ['22', 'SF_IMMOBILISATIONS_CORPORELLES'], ['23', 'SF_IMMOBILISATIONS_CORPORELLES'], ['24', 'SF_IMMOBILISATIONS_CORPORELLES'], ['28', 'SF_IMMOBILISATIONS_CORPORELLES'],
  ['26', 'SF_ACTIFS_FINANCIERS_NC'], ['31', 'SF_STOCKS'], ['41', 'SF_CREANCES_CLIENTS'], ['52', 'SF_TRESORERIE'], ['101', 'SF_CAPITAL'],
  ['11', 'SF_RESERVES'], ['12', 'SF_RESERVES'], ['13', 'SF_RESERVES'], ['15', 'SF_RESERVES'], ['40', 'SF_FOURNISSEURS'], ['46', 'SF_FOURNISSEURS'],
  ['70', 'PL_PRODUITS'], ['60', 'PL_ACHATS_CONSOMMES'], ['68', 'PL_AMORTISSEMENTS'], ['85', 'PL_AUTRES_CHARGES_OPERATIONNELLES'],
  ['86', 'PL_AUTRES_PRODUITS_OPERATIONNELS'], ['77', 'PL_PRODUITS_INVESTISSEMENT'],
];

const BUNIA_IFRS12 = (resultat) => ({
  etablissement: 'Bunia, province de l’Ituri (RDC)', resultatMinoritaires: resultat, cumulMinoritaires: 5_309_000, dividendesMinoritaires: 600_000,
});

async function ifrsIturi(c, R, n25, n26, n27) {
  await c.geste('Activité principale IFRS (aucune activité spécifiée)', 'PUT', '/ifrs/activite', { activitePrincipale: 'AUCUNE' });
  for (const [prefixe, rubrique] of REGLES_IFRS_ITURI) await c.geste(`Règle IFRS ${prefixe}`, 'POST', '/ifrs/regles', { prefixe, rubrique });
  // Les postes de consolidation qui se DÉCLARENT · la dotation de l'écart et
  // l'amortissement de l'écart d'évaluation du bâtiment en dotations (IFRS 18
  // § 78 a) ; la marge éliminée corrige les marchandises consommées.
  for (const [poste, rubrique] of [['DOTATION_ECART_ACQUISITION', 'PL_AMORTISSEMENTS'], ['ECARTS_EVALUATION_RESULTAT', 'PL_AMORTISSEMENTS'], ['ELIMINATION_RESULTATS_INTERNES', 'PL_ACHATS_CONSOMMES']]) {
    await c.geste(`Règle de poste ${poste}`, 'POST', '/ifrs/regles-consolidation', { poste, rubrique });
  }
  await refusAttendu(c, R, 'IFRS · règle sur un poste qu’IFRS 18 range lui-même (écart d’acquisition)', 'POST', '/ifrs/regles-consolidation',
    { poste: 'ECART_ACQUISITION', rubrique: 'SF_IMMOBILISATIONS_INCORPORELLES' }, /rangé par IFRS 18/);
  await c.geste('Trésorerie du groupe · ni devises ni découverts (IAS 7 § 8 et § 28)', 'PUT', '/ifrs/tresorerie', { tresorerieGroupeEnDevises: false, decouvertsDansTresorerie: false });

  // IFRS 1 DU GROUPE · premier exercice IFRS 2027, comparatif 2026, date de
  // transition le 1er janvier 2026 (annexe A) · exemption § C1 prise.
  const GOODWILL_TRANSITION = {
    exerciceId: n26, consolide: true, aLaTransition: true, libelle: 'Test de dépréciation du goodwill à la date de transition',
    fondement: 'IFRS 1 § C4 g ii, IAS 36', lignes: [{ rubrique: 'SF_GOODWILL', montant: -100_000 }, { rubrique: 'SF_RESERVES', montant: 100_000 }],
    partMinoritairesCapitauxPropres: 0,
  };
  await refusAttendu(c, R, 'IFRS 1 · ajustement de transition avant la déclaration du premier exercice du groupe', 'POST', '/ifrs/retraitements', GOODWILL_TRANSITION, /premier exercice IFRS du groupe/);
  await c.geste('IFRS 1 du groupe · premier exercice 2027, exemption C1 prise', 'PUT', '/ifrs/premiere-application', { consolide: true, premierExerciceIfrsId: n27, exemptionRegroupementsC1: true });
  await refusAttendu(c, R, 'IFRS 1 · ajustement de transition posé sur le premier exercice et non sur le comparatif', 'POST', '/ifrs/retraitements', { ...GOODWILL_TRANSITION, exerciceId: n27 }, /comparatif/);
  await refusAttendu(c, R, 'IFRS 1 § 11 · ajustement de transition porté au résultat', 'POST', '/ifrs/retraitements',
    // La part des minoritaires de l'effet au résultat est déclarée (zéro), sans
    // quoi la porte refuse d'abord au nom d'IFRS 10 § B94 et le § 11 n'est pas
    // éprouvé.
    { ...GOODWILL_TRANSITION, partMinoritairesResultat: 0, lignes: [{ rubrique: 'SF_GOODWILL', montant: -100_000 }, { rubrique: 'PL_AMORTISSEMENTS', montant: 100_000 }] }, /IFRS 1 § 11/);
  // § C4 g ii · test de dépréciation du goodwill à la transition · une perte de
  // 100 000 aux résultats non distribués. Le goodwill est celui du groupe seul
  // (quote-part du coût, art. 82) · aucune part des minoritaires, zéro déclaré.
  await c.geste('IFRS 1 · ajustement de transition · perte de valeur du goodwill', 'POST', '/ifrs/retraitements', GOODWILL_TRANSITION);

  /**
   * RETRAITEMENTS CONSOLIDÉS 2026 (comparatif) · (1) la perte de valeur de la
   * transition, redéclarée (« ce qu'il laisse au bilan à la clôture du
   * comparatif s'y redéclare ») ; (2) l'amortissement 2026 du goodwill annulé
   * (IFRS 3 § B63 a ; § C4 h ii n'interdit que de toucher l'amortissement
   * ANTÉRIEUR à la transition) · 80 000 + 50 000 ; (3) Bunia · stock ramené à
   * la valeur nette de réalisation (IAS 2 § 9), 200 000 au résultat, part des
   * minoritaires 20 % · −40 000 (IFRS 10 § B94).
   */
  const DEPRECIATION_STOCK_BUNIA = {
    exerciceId: n26, consolide: true, libelle: 'Bunia · stock à la valeur nette de réalisation', fondement: 'IAS 2 § 9 et § 34',
    lignes: [{ rubrique: 'PL_ACHATS_CONSOMMES', montant: 200_000 }, { rubrique: 'SF_STOCKS', montant: -200_000 }],
  };
  await refusAttendu(c, R, 'IFRS 10 § B94 · retraitement consolidé sans la part des minoritaires de son effet au résultat', 'POST', '/ifrs/retraitements', DEPRECIATION_STOCK_BUNIA, /B94/);
  await c.geste('Retraitement 2026 · perte de valeur du goodwill (redéclarée)', 'POST', '/ifrs/retraitements', { ...GOODWILL_TRANSITION, aLaTransition: false, libelle: 'Perte de valeur du goodwill de la transition' });
  await c.geste('Retraitement 2026 · amortissement du goodwill annulé', 'POST', '/ifrs/retraitements', {
    exerciceId: n26, consolide: true, libelle: 'Annulation de l’amortissement 2026 du goodwill', fondement: 'IFRS 3 § B63 a, IAS 36 § 90, IFRS 1 § C4 h ii',
    lignes: [{ rubrique: 'SF_GOODWILL', montant: 130_000 }, { rubrique: 'PL_AMORTISSEMENTS', montant: -130_000 }], partMinoritairesResultat: 0,
  });
  await c.geste('Retraitement 2026 · Bunia, stock déprécié', 'POST', '/ifrs/retraitements', { ...DEPRECIATION_STOCK_BUNIA, partMinoritairesResultat: -40_000 });

  /**
   * RETRAITEMENTS CONSOLIDÉS 2027 · (1) perte de valeur redéclarée ; (2)
   * amortissement annulé depuis la transition · 260 000 au goodwill, 130 000
   * au résultat, 130 000 aux réserves (part des minoritaires nulle aux deux) ;
   * (3) le stock déprécié de Bunia est vendu · 200 000 reviennent au résultat
   * et sortent des réserves d'ouverture · deux effets, deux parts (+40 000,
   * −40 000) ; (4) Bunia · terrain au modèle de la réévaluation (IAS 16 § 31
   * et § 39), +500 000 en autres éléments non recyclables, part des
   * minoritaires 100 000.
   */
  const REEVALUATION_TERRAIN = {
    exerciceId: n27, consolide: true, libelle: 'Bunia · terrain réévalué', fondement: 'IAS 16 § 31 et § 39',
    lignes: [{ rubrique: 'SF_IMMOBILISATIONS_CORPORELLES', montant: 500_000 }, { rubrique: 'OCI_NR_AUTRES', montant: -500_000 }],
  };
  await refusAttendu(c, R, 'IFRS 10 § B94 · réévaluation sans part des minoritaires aux autres éléments', 'POST', '/ifrs/retraitements', REEVALUATION_TERRAIN, /B94/);
  await refusAttendu(c, R, 'IFRS 10 § B94 · part des minoritaires au-delà de l’effet', 'POST', '/ifrs/retraitements', { ...REEVALUATION_TERRAIN, partMinoritairesOci: 600_000 }, /ne le dépasse pas/);
  await c.geste('Retraitement 2027 · perte de valeur du goodwill (redéclarée)', 'POST', '/ifrs/retraitements', { ...GOODWILL_TRANSITION, exerciceId: n27, aLaTransition: false, libelle: 'Perte de valeur du goodwill de la transition' });
  await c.geste('Retraitement 2027 · amortissement du goodwill annulé depuis la transition', 'POST', '/ifrs/retraitements', {
    exerciceId: n27, consolide: true, libelle: 'Annulation de l’amortissement du goodwill depuis la transition', fondement: 'IFRS 3 § B63 a, IAS 36 § 90, IFRS 1 § C4 h ii',
    lignes: [{ rubrique: 'SF_GOODWILL', montant: 260_000 }, { rubrique: 'PL_AMORTISSEMENTS', montant: -130_000 }, { rubrique: 'SF_RESERVES', montant: -130_000 }],
    partMinoritairesResultat: 0, partMinoritairesCapitauxPropres: 0,
  });
  await c.geste('Retraitement 2027 · Bunia, stock déprécié vendu', 'POST', '/ifrs/retraitements', {
    exerciceId: n27, consolide: true, libelle: 'Bunia · dépréciation du stock reprise à la vente', fondement: 'IAS 2 § 34',
    lignes: [{ rubrique: 'PL_ACHATS_CONSOMMES', montant: -200_000 }, { rubrique: 'SF_RESERVES', montant: 200_000 }],
    partMinoritairesResultat: 40_000, partMinoritairesCapitauxPropres: -40_000,
  });
  await c.geste('Retraitement 2027 · Bunia, terrain réévalué', 'POST', '/ifrs/retraitements', { ...REEVALUATION_TERRAIN, partMinoritairesOci: 100_000 });

  // Distributions du groupe (IFRS 18 § 107 c iii) · celles de la mère et celles
  // de Bunia à ses minoritaires. En comptes individuels, une composante
  // « minoritaires » n'existe pas.
  await refusAttendu(c, R, 'Mouvement de capitaux propres des minoritaires en comptes individuels', 'POST', '/ifrs/mouvements-capitaux-propres',
    { exerciceId: n27, type: 'DISTRIBUTION', composante: 'MINORITAIRES', montant: -600_000, libelle: 'Dividendes de Bunia aux minoritaires', justification: 'PV de Bunia' }, /consolidés/);
  for (const [ex, an, mere, mino] of [[n26, '2026', -4_000_000, -400_000], [n27, '2027', -5_000_000, -600_000]]) {
    await c.geste(`Distribution ${an} · Ituri`, 'POST', '/ifrs/mouvements-capitaux-propres', {
      exerciceId: ex, consolide: true, type: 'DISTRIBUTION', composante: 'RESERVES', montant: mere, libelle: `Dividendes d’Ituri Holding (${an})`, justification: `PV de l’assemblée générale ordinaire d’Ituri Holding SA (${an})`,
    });
    await c.geste(`Distribution ${an} · minoritaires de Bunia`, 'POST', '/ifrs/mouvements-capitaux-propres', {
      exerciceId: ex, consolide: true, type: 'DISTRIBUTION', composante: 'MINORITAIRES', montant: mino, libelle: `Dividendes de Bunia aux minoritaires (${an})`, justification: `PV de l’assemblée de Bunia Négoce SARL · 20 % des dividendes (${an})`,
    });
  }
  await c.geste('Notes consolidées 2027 · conformité déclarée', 'PUT', '/ifrs/notes', { exerciceId: n27, consolide: true, contenu: { conformiteDeclaree: true } });
  // IFRS 12 · d'abord le résultat légal des minoritaires (1 545 000) au lieu
  // du résultat IFRS, et la question des entités structurées sans réponse ·
  // les deux se disent.
  const ifrs12 = (resultat, structurees) => ({
    exerciceId: n27,
    contenu: {
      jugements: 'Contrôle conjoint de Mambasa et de Komanda fondé sur les pactes d’associés exigeant l’unanimité pour les décisions sur les activités pertinentes.',
      restrictions: 'Aucune restriction importante.',
      ...(structurees === undefined ? {} : { entitesStructurees: structurees }),
      filiales: { [BUNIA]: BUNIA_IFRS12(resultat) },
      partenaires: {
        [MAMBASA]: { etablissement: 'Mambasa, Ituri (RDC)', natureRelation: 'Logistique du groupe', typePartenariat: 'COENTREPRISE', dividendesRecus: 0 },
        [KOMANDA]: { etablissement: 'Komanda, Ituri (RDC)', natureRelation: 'Exploitation minière en commun, droits sur les actifs et obligations au titre des passifs', typePartenariat: 'ENTREPRISE_COMMUNE', dividendesRecus: 0 },
      },
    },
  });
  await c.geste('IFRS 12 · déclarations (premier passage)', 'PUT', '/ifrs/notes-ifrs12', ifrs12(1_545_000, undefined));
  const e0 = await c.lire('IFRS consolidé 2027 (IFRS 12 incomplète)', `/ifrs/consolide?exerciceId=${n27}`);
  // Le total des minoritaires de l'état IFRS est 1 585 000 (légal 1 545 000 +
  // part de la reprise de la dépréciation 40 000) · la ventilation déclarée en
  // diffère de −40 000.
  R.egal('IFRS 12 · ventilation des minoritaires qui ne rend pas le total · nommée', true, contient(e0?.n?.motifsNonPubliable, /filiale par filiale, diffère de -40000/));
  R.egal('IFRS 12 · entités structurées sans réponse · nommées', true, contient(e0?.n?.motifsNonPubliable, /entités structurées · question non répondue/));
  await c.geste('IFRS 12 · déclarations corrigées', 'PUT', '/ifrs/notes-ifrs12', ifrs12(1_585_000, false));

  const e = await c.lire('IFRS consolidé 2027', `/ifrs/consolide?exerciceId=${n27}`);
  if (!e?.n) return R.note(`IFRS consolidé 2027 non établi · ${e?.motifN ?? 'lecture refusée'}`);
  const S = e.n.situation;
  const P = e.n.resultat;
  const G = e.n.resultatGlobal;
  /**
   * IFRS CONSOLIDÉ 2027, à la main · projection du cumul du D4C, puis
   * retraitements. Goodwill 750 000 − 100 000 + 260 000 = 910 000 ;
   * corporelles 30 900 000 + 500 000 = 31 400 000 ; actif 107 735 000 −
   * 100 000 + 260 000 + 500 000 = 108 395 000. Résultat net 25 802 000 +
   * 130 000 + 200 000 = 26 132 000 · minoritaires 1 545 000 + 40 000 =
   * 1 585 000, propriétaires 24 547 000. Autres éléments 500 000 · global
   * minoritaires 1 685 000, propriétaires 24 947 000. Réserves 41 429 000 −
   * 170 000 + 40 000 (part des minoritaires de l'effet aux capitaux propres) =
   * 41 299 000 ; capitaux propres des propriétaires 30 000 000 + 41 299 000 +
   * 24 547 000 + 400 000 = 96 246 000 ; minoritaires 5 209 000 + 40 000 +
   * 100 000 − 40 000 = 5 309 000.
   */
  R.montant('IFRS consolidé 2027 · goodwill (valeur AUDCIF de la transition, perte de valeur, plus d’amortissement)', 910_000, ifrs(S, 'SF_GOODWILL'));
  R.montant('IFRS consolidé 2027 · immobilisations corporelles (terrain réévalué)', 31_400_000, ifrs(S, 'SF_IMMOBILISATIONS_CORPORELLES'));
  R.montant('IFRS consolidé 2027 · impôts différés actif (rangés par IFRS 18 § 103 r)', 285_000, ifrs(S, 'SF_IMPOTS_DIFFERES_ACTIF'));
  R.montant('IFRS consolidé 2027 · impôts différés passif', 840_000, ifrs(S, 'SF_IMPOTS_DIFFERES_PASSIF'));
  R.montant('IFRS consolidé 2027 · total de l’actif', 108_395_000, ifrs(S, 'TOTAL_ACTIF'));
  R.montant('IFRS consolidé 2027 · résultat net', 26_132_000, ifrs(P, 'RESULTAT_NET'));
  R.montant('IFRS consolidé 2027 · résultat net, minoritaires (1 545 000 + 40 000)', 1_585_000, ifrs(P, 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'));
  R.montant('IFRS consolidé 2027 · résultat net, propriétaires', 24_547_000, ifrs(P, 'RN_PROPRIETAIRES'));
  R.montant('IFRS consolidé 2027 · autres éléments non recyclables (réévaluation)', 500_000, ifrs(G, 'OCI_NR_AUTRES'));
  R.montant('IFRS consolidé 2027 · résultat global, minoritaires (1 585 000 + 100 000)', 1_685_000, ifrs(G, 'RG_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'));
  R.montant('IFRS consolidé 2027 · résultat global, propriétaires', 24_947_000, ifrs(G, 'RG_PROPRIETAIRES'));
  R.montant('IFRS consolidé 2027 · réserves (part des minoritaires de l’effet aux capitaux propres retirée)', 41_299_000, ifrs(S, 'SF_RESERVES'));
  R.montant('IFRS consolidé 2027 · autres éléments de l’exercice, propriétaires', 400_000, ifrs(S, 'SF_OCI_EXERCICE'));
  R.montant('IFRS consolidé 2027 · capitaux propres des propriétaires', 96_246_000, ifrs(S, 'TOTAL_CAPITAUX_PROPRES_PROPRIETAIRES'));
  R.montant('IFRS consolidé 2027 · participations ne donnant pas le contrôle', 5_309_000, ifrs(S, 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'));
  R.montant('IFRS consolidé 2027 · total des capitaux propres et du passif', 108_395_000, ifrs(S, 'TOTAL_CAPITAUX_PROPRES_PASSIF'));
  R.egal('IFRS consolidé 2027 · contrôles (situation, résultat, résultat de l’ensemble D4C)', true, (e.n.controles ?? []).length > 0 && e.n.controles.every((x) => x.ok));
  R.egal('IFRS consolidé 2027 · goodwill retraité · le motif du § B63 a est levé', false, contient(e.n.motifsNonPubliable, /B63 a/));
  R.egal('IFRS consolidé 2027 · aucun poste de consolidation sans rubrique', false, contient(e.n.motifsNonPubliable, /sans rubrique IFRS/));
  R.egal('IFRS 11 § 24 · Mambasa, coentreprise intégrée proportionnellement · « à retraiter », dit', true, contient(e.n.motifsNonPubliable, /IFRS 11 § 24 · Mambasa/));
  R.egal('IFRS 11 · Komanda, entreprise commune · aucun retraitement réclamé', false, contient(e.n.motifsNonPubliable, /IFRS 11 § 24 · Komanda/));
  R.egal('IFRS 12 corrigée · plus d’écart de ventilation ni de question sans réponse', [false, false],
    [contient(e.n.motifsNonPubliable, /filiale par filiale, diffère/), contient(e.n.motifsNonPubliable, /entités structurées/)]);

  /**
   * COMPARATIF 2026 IFRS · goodwill 880 000 − 100 000 + 130 000 = 910 000 ;
   * stocks 9 670 000 − 200 000 = 9 470 000 ; résultat net 23 432 000 +
   * 130 000 − 200 000 = 23 362 000 · minoritaires 1 479 000 − 40 000 =
   * 1 439 000 ; réserves 24 476 000 − 100 000 = 24 376 000 ; capitaux propres
   * 30 000 000 + 24 376 000 + 21 923 000 + 4 224 000 = 80 523 000.
   */
  const S1 = e.n1?.situation;
  R.montant('IFRS consolidé 2026 (comparatif) · goodwill', 910_000, ifrs(S1, 'SF_GOODWILL'));
  R.montant('IFRS consolidé 2026 · stocks dépréciés', 9_470_000, ifrs(S1, 'SF_STOCKS'));
  R.montant('IFRS consolidé 2026 · résultat net', 23_362_000, ifrs(e.n1?.resultat, 'RESULTAT_NET'));
  R.montant('IFRS consolidé 2026 · résultat net, minoritaires (1 479 000 − 40 000)', 1_439_000, ifrs(e.n1?.resultat, 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'));
  R.montant('IFRS consolidé 2026 · total des capitaux propres', 80_523_000, ifrs(S1, 'TOTAL_CAPITAUX_PROPRES'));

  /**
   * IFRS 1 DU GROUPE (§ 24, C5). Ouverture au 1er janvier 2026 = consolidation
   * de clôture 2025 · capitaux propres D4C 30 000 000 + 10 000 000 +
   * 18 476 000 + 2 090 000 + 1 095 000 = 61 661 000 ; perte de valeur de la
   * transition −100 000 → 61 561 000. Clôture du comparatif · D4C 30 000 000
   * + 24 476 000 + 21 953 000 + 2 785 000 + 1 479 000 = 80 693 000 ;
   * retraitements −100 000 + 130 000 − 200 000 → 80 523 000. Résultat global
   * 2026 · 23 432 000 + 130 000 − 200 000 = 23 362 000.
   */
  const pa = e.premiereApplication;
  R.egal('IFRS 1 du groupe · établie, transition au 1er janvier 2026', '2026-01-01', pa?.dateTransition ?? e.motifPremiereApplication);
  if (pa) {
    const [t0, t1, gl] = pa.rapprochements ?? [];
    R.montant('IFRS 1 § 24 a i · capitaux propres D4C à la transition (consolidation 2025, minoritaires compris)', 61_661_000, t0?.depart);
    R.montant('IFRS 1 § 24 a i · capitaux propres IFRS à la transition', 61_561_000, t0?.arrivee);
    R.montant('IFRS 1 § 24 a ii · capitaux propres D4C à la clôture du comparatif', 80_693_000, t1?.depart);
    R.montant('IFRS 1 § 24 a ii · capitaux propres IFRS à la clôture du comparatif', 80_523_000, t1?.arrivee);
    R.montant('IFRS 1 § 24 b · résultat global IFRS du comparatif', 23_362_000, gl?.arrivee);
    R.montant('IFRS 1 · aucun écart non expliqué', 0, Math.abs(t0?.ecart ?? NaN) + Math.abs(t1?.ecart ?? NaN) + Math.abs(gl?.ecart ?? NaN));
    R.montant('IFRS 1 · état d’ouverture · goodwill (1 010 000 AUDCIF − 100 000)', 910_000, ifrs(pa.ouverture?.situation, 'SF_GOODWILL'));
    R.egal('IFRS 1 § C1 · exemption des regroupements prise, et dite', true, contient(pa.mentions, /§ C1 · les regroupements d’entreprises antérieurs à la date de transition ne sont pas retraités/));
    R.egal('IFRS 1 · la note de transition est servie (§ 23 à 26)', true, (e.notes?.notes ?? []).some((x) => x.cle === 'TRANSITION'));
  }

  /**
   * VARIATION DES CAPITAUX PROPRES CONSOLIDÉS (IFRS 18 § 107). 2027 ·
   * ouverture = clôture IFRS 2026 · propriétaires 30 000 000 + 24 376 000 +
   * 21 923 000 = 76 299 000, minoritaires 4 224 000 ; résultat 24 547 000 et
   * 1 585 000 ; OCI 400 000 et 100 000 ; distributions −5 000 000 et −600 000
   * · clôture 101 555 000. 2026 (bloc comparatif, ouverture = état IFRS 1) ·
   * propriétaires 30 000 000 + 9 900 000 + 18 476 000 = 58 376 000,
   * minoritaires 3 185 000 ; résultat 21 923 000 et 1 439 000 ; distributions
   * −4 400 000 · clôture 80 523 000.
   */
  const VN = e.variationCapitauxPropres?.n?.lignes ?? [];
  const VN1 = e.variationCapitauxPropres?.n1?.lignes ?? [];
  const v = (L, cle, col) => L.find((x) => x.cle === cle)?.[col] ?? null;
  R.egal('IFRS consolidé · variation des CP 2027 établie', true, VN.length > 0 || e.variationCapitauxPropres?.motifN);
  R.montant('IFRS consolidé 2027 · variation · ouverture, propriétaires', 76_299_000, v(VN, 'OUVERTURE_PUBLIEE', 'groupe'));
  R.montant('IFRS consolidé 2027 · variation · ouverture, minoritaires', 4_224_000, v(VN, 'OUVERTURE_PUBLIEE', 'minoritaires'));
  R.montant('IFRS consolidé 2027 · variation · autres éléments, minoritaires', 100_000, v(VN, 'OCI', 'minoritaires'));
  R.montant('IFRS consolidé 2027 · variation · distributions, total', -5_600_000, v(VN, 'DISTRIBUTIONS', 'total'));
  R.montant('IFRS consolidé 2027 · variation · clôture, total', 101_555_000, v(VN, 'CLOTURE', 'total'));
  R.egal('IFRS consolidé 2027 · variation · aucun écart non expliqué', null, v(VN, 'ECART_NON_EXPLIQUE', 'total'));
  R.egal('IFRS consolidé · bloc comparatif 2026 établi', true, VN1.length > 0 || e.variationCapitauxPropres?.motifN1);
  R.montant('IFRS consolidé 2026 · variation · ouverture (état IFRS 1), propriétaires', 58_376_000, v(VN1, 'OUVERTURE_PUBLIEE', 'groupe'));
  R.montant('IFRS consolidé 2026 · variation · clôture, total', 80_523_000, v(VN1, 'CLOTURE', 'total'));
  R.egal('IFRS consolidé 2026 · variation · aucun écart non expliqué', null, v(VN1, 'ECART_NON_EXPLIQUE', 'total'));

  /**
   * FLUX IFRS CONSOLIDÉS (IAS 7 modifiée par IFRS 18). 2027 · résultat
   * d'exploitation IFRS 74 700 000 − 47 970 000 − 700 000 = 26 030 000 ;
   * retraitements sans trésorerie −330 000 ; éléments sans trésorerie
   * 26 530 000 − 25 700 000 = 830 000 ; BFR −1 830 000 · exploitation
   * 24 700 000 ; investissement 0 ; financement −5 000 000 − 600 000 ;
   * variation 19 100 000, de 44 600 000 à 63 700 000. 2026 · 23 290 000 +
   * 70 000 + 830 000 − 2 590 000 = 21 600 000 ; financement −4 400 000 ;
   * variation 17 200 000, de 27 400 000 à 44 600 000.
   */
  const FN = e.fluxTresorerie?.n;
  const FN1 = e.fluxTresorerie?.n1;
  const fl = (F, cle) => (F?.lignes ?? []).find((x) => x.cle === cle)?.montant ?? null;
  R.egal('IFRS consolidé · flux 2027 établis', true, Boolean(FN?.lignes) || e.fluxTresorerie?.motifN);
  if (FN?.lignes) {
    R.montant('IFRS consolidé 2027 · flux · résultat d’exploitation IFRS', 26_030_000, fl(FN, 'E_RESULTAT_EXPLOITATION'));
    R.montant('IFRS consolidé 2027 · flux · retraitements sans trésorerie retirés', -330_000, fl(FN, 'E_RETRAITEMENTS'));
    R.montant('IFRS consolidé 2027 · flux · exploitation', 24_700_000, fl(FN, 'E_TOTAL'));
    R.montant('IFRS consolidé 2027 · flux · investissement', 0, fl(FN, 'I_TOTAL'));
    R.montant('IFRS consolidé 2027 · flux · dividendes de la mère', -5_000_000, fl(FN, 'F_DIVIDENDES'));
    R.montant('IFRS consolidé 2027 · flux · dividendes aux minoritaires', -600_000, fl(FN, 'F_DIVIDENDES_MINORITAIRES'));
    R.montant('IFRS consolidé 2027 · flux · variation', 19_100_000, fl(FN, 'T_VARIATION'));
    R.montant('IFRS consolidé 2027 · flux · trésorerie de clôture', 63_700_000, fl(FN, 'T_CLOTURE'));
    R.egal('IFRS consolidé 2027 · flux · aucun écart non expliqué', null, fl(FN, 'T_ECART'));
  }
  R.egal('IFRS consolidé · flux comparatifs 2026 établis (consolidation 2025 en N-2)', true, Boolean(FN1?.lignes) || e.fluxTresorerie?.motifN1);
  if (FN1?.lignes) {
    R.montant('IFRS consolidé 2026 · flux · exploitation', 21_600_000, fl(FN1, 'E_TOTAL'));
    R.montant('IFRS consolidé 2026 · flux · financement', -4_400_000, fl(FN1, 'F_TOTAL'));
    R.montant('IFRS consolidé 2026 · flux · trésorerie d’ouverture', 27_400_000, fl(FN1, 'T_OUVERTURE'));
    R.montant('IFRS consolidé 2026 · flux · trésorerie de clôture', 44_600_000, fl(FN1, 'T_CLOTURE'));
  }

  // IFRS 12 · composition, minoritaires de Bunia (20 % des titres), partenariats.
  const note12 = (e.notes?.notes ?? []).find((x) => x.cle === 'IFRS12_INTERETS_AUTRES_ENTITES');
  R.egal('IFRS 12 · note présente', true, Boolean(note12));
  const tab = (titre) => (note12?.blocs ?? []).find((b) => b.type === 'tableau' && b.titre?.startsWith(titre));
  const compo = tab('Composition du groupe');
  const lc = (nom) => compo?.lignes?.find((l) => l.libelle === nom)?.valeurs;
  R.egal('IFRS 12 § 10 a i · Komanda · intégration proportionnelle, 40 % de contrôle et d’intérêt', ['Intégration proportionnelle', 40, 40], (lc(KOMANDA) ?? []).slice(0, 3));
  const fil = tab('Filiales dont des participations');
  const lf = fil?.lignes?.find((l) => l.libelle === BUNIA)?.valeurs;
  R.egal('IFRS 12 § 12 · Bunia · 20 % des titres aux minoritaires, résultat 1 585 000, cumul 5 309 000, dividendes 600 000',
    [20, 1_585_000, 5_309_000, 600_000], lf ? [lf[1], lf[3], lf[4], lf[5]] : null);
  const part = tab('Partenariats');
  R.egal('IFRS 12 § 21 · les deux partenariats présentés, avec leur type', ['Coentreprise', 'Entreprise commune'],
    [part?.lignes?.find((l) => l.libelle === MAMBASA)?.valeurs?.[2], part?.lignes?.find((l) => l.libelle === KOMANDA)?.valeurs?.[2]]);
}

// =============================================================================
// GROUPE B · KATANGA HOLDING SA · conversion des entités étrangères
// =============================================================================

const ZAMBEZI = 'Zambezi Copper Ltd';
const KAFUE = 'Kafue Trading Ltd';
const JUSTIF_USD = 'Prix de vente du cuivre fixés en dollars, coûts et financement en dollars (D4C ch. XII-4 § 1, facteurs essentiels et auxiliaires).';

/**
 * ZAMBEZI (IG 70 %), balance tenue en USD, sa monnaie fonctionnelle.
 * Entrée le 1er janvier 2026 · capitaux propres 10 000 USD au cours d'entrée
 * de 2 800 = 28 000 000 CDF ; coût des titres 22 400 000 · écart
 * d'acquisition 22 400 000 − 70 % × 28 000 000 = 2 800 000 (1 000 USD),
 * durée limitée cinq ans.
 * 2026 (USD) · ventes 20 000, achats 15 000 · résultat 5 000, banque 9 000.
 * 2027 (USD) · affectation de 5 000 (réserves 3 000, dividendes 2 000 payés
 * · 1 400 à Katanga, 600 aux minoritaires), ventes 22 000, achats 16 000 ·
 * résultat 6 000, banque 13 000.
 */
const ZAMBEZI_2026 = [
  ['24110000', 'Matériel', 8_000, 0, 0], [BQ, 'Banque', 4_000, 20_000, 15_000], ['10130000', 'Capital', -8_000, 0, 0], ['11810000', 'Réserves', -2_000, 0, 0],
  ['40110000', 'Fournisseurs', -2_000, 0, 0], ['70110000', 'Ventes', 0, 0, 20_000], ['60110000', 'Achats', 0, 15_000, 0],
];
const ZAMBEZI_2027 = [
  ['24110000', 'Matériel', 8_000, 0, 0], [BQ, 'Banque', 9_000, 22_000, 18_000], ['10130000', 'Capital', -8_000, 0, 0], ['11810000', 'Réserves', -2_000, 0, 3_000],
  ['13010000', 'Résultat en instance d’affectation', -5_000, 5_000, 0], ['40110000', 'Fournisseurs', -2_000, 0, 0], ['46500000', 'Dividendes à payer', 0, 2_000, 2_000],
  ['70110000', 'Ventes', 0, 0, 22_000], ['60110000', 'Achats', 0, 16_000, 0],
];
/**
 * KAFUE (ME 30 %), USD · entrée le 1er janvier 2026, capitaux propres 20 000
 * USD × 2 800 = 56 000 000 ; coût 16 800 000 = 30 % · écart nul. 2026 ·
 * résultat 4 000 ; 2027 · affectation (réserves 1 000, dividendes 3 000, dont
 * 900 à Katanga), résultat 5 000.
 */
const KAFUE_2026 = [
  ['24110000', 'Matériel', 15_000], [BQ, 'Banque', 11_000], ['10130000', 'Capital', -15_000], ['11810000', 'Réserves', -5_000],
  ['40110000', 'Fournisseurs', -2_000], ['70110000', 'Ventes', -30_000], ['60110000', 'Achats', 26_000],
];
const KAFUE_2027 = [
  ['24110000', 'Matériel', 15_000], [BQ, 'Banque', 13_000], ['10130000', 'Capital', -15_000], ['11810000', 'Réserves', -6_000],
  ['40110000', 'Fournisseurs', -2_000], ['70110000', 'Ventes', -32_000], ['60110000', 'Achats', 27_000],
];

/**
 * LES COURS (DONNÉES DU BANC, unités de CDF pour un USD) · entrée 2 800 ;
 * 2026 · moyen 2 900, clôture 3 000 ; 2027 · moyen 3 100, clôture 3 200.
 * Capitaux propres historiques (hors résultat de l'exercice, au cours de leur
 * constitution) · Zambezi 2026 · 10 000 × 2 800 = 28 000 000 ; 2027 ·
 * 28 000 000 + résultat 2026 5 000 × 2 900 − dividendes 2 000 × 3 100 =
 * 36 300 000. Kafue 2026 · 56 000 000 ; 2027 · 56 000 000 + 4 000 × 2 900 −
 * 3 000 × 3 100 = 58 300 000.
 */
const monnaieUsd = (cloture, moyen, historiques, extra = {}) => ({
  monnaieBalance: 'USD', justificationMonnaie: JUSTIF_USD, coursCloture: cloture, coursProduitsCharges: moyen, coursEntree: 2_800, capitauxPropresHistoriques: historiques, ...extra,
});
const ACQ_ZAMBEZI = (div) => ({
  coutAcquisition: 22_400_000, compteTitres: '26100000', dateEntree: '2026-01-01', capitauxPropresEntree: 28_000_000,
  modeDureeEcart: 'LIMITEE', dureeEcartAnnees: 5, dividendesExercice: div, ...(div > 0 ? { compteDividendes: '77210000' } : {}),
});
const ACQ_KAFUE = (div) => ({
  coutAcquisition: 16_800_000, compteTitres: '26300000', dateEntree: '2026-01-01', capitauxPropresEntree: 56_000_000,
  modeDureeEcart: 'NON_DETERMINABLE', dividendesExercice: div, ...(div > 0 ? { compteDividendes: '77210000' } : {}),
});
const FISCALITE_ZERO = { idaOuverture: 0, idaCloture: 0, idpOuverture: 0, idpCloture: 0 };

async function groupeKatanga(R) {
  const c = await nouveauDossier(R, 'Passe V1 · Katanga Holding SA (conversion)', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'conso2-katanga', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n26 = c.exercices.get('2026')?.id;
  await activerModules(c);
  await c.geste('Forme juridique SA', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });
  /**
   * Katanga · ouverture · matériel 30 000 000, titres Zambezi 22 400 000,
   * titres Kafue 16 800 000, banque 10 800 000 · capital 50 000 000,
   * réserves 20 000 000, fournisseurs 10 000 000. 2026 · ventes 40 000 000,
   * achats 32 000 000 · résultat 8 000 000, banque 18 800 000.
   */
  await etape(R, 'Katanga · 2026 · comptes de la consolidante', async () => {
    await bilanOuverture(c, n26, '2026-01-01', [
      ['24110000', 'Matériel', 30_000_000, 0], ['26100000', 'Titres Zambezi', 22_400_000, 0], ['26300000', 'Titres Kafue', 16_800_000, 0], [BQ, 'Banque', 10_800_000, 0],
      ['10130000', 'Capital', 0, 50_000_000], ['11810000', 'Réserves', 0, 20_000_000], ['40110000', 'Fournisseurs', 0, 10_000_000],
    ]);
    await ecriture(c, 'Ventes 2026', n26, '2026-03-31', 'Ventes', [[BQ, 40_000_000, 0], ['70110000', 0, 40_000_000]]);
    await ecriture(c, 'Achats 2026', n26, '2026-04-30', 'Achats', [['60110000', 32_000_000, 0], [BQ, 0, 32_000_000]]);
    await validerJusqua(c, n26, '2026-12-31');
  });

  const ctx = {};
  await etape(R, 'Katanga · 2026 · périmètre, monnaies et refus', async () => {
    const Z = await entite(c, n26, ZAMBEZI, 70, '2026');
    const K = await entite(c, n26, KAFUE, 30, '2026');
    if (!Z || !K) return;
    ctx.n = { Z, K };
    await acquisition(c, Z, ACQ_ZAMBEZI(0), '2026');
    await acquisition(c, K, ACQ_KAFUE(0), '2026');
    await balanceEntite(c, Z, 'zambezi-2026.csv', csv6(ZAMBEZI_2026));
    await balanceEntite(c, K, 'kafue-2026.csv', csv4(KAFUE_2026));
    await fiscalite(c, n26, null, FISCALITE_SIMPLE, '2026 · Katanga');
    await fiscalite(c, n26, Z, FISCALITE_ZERO, '2026 · Zambezi (aucun impôt différé)');

    // MONNAIE FONCTIONNELLE · une balance en USD sans les facteurs qui en
    // font la monnaie fonctionnelle se refuse (D4C ch. XII-4 § 1).
    await refusAttendu(c, R, 'Monnaie USD déclarée sans dire pourquoi elle est fonctionnelle', 'PUT', `/consolidation/entites/${Z.id}/monnaie`, { monnaieBalance: 'USD' }, /FONCTIONNELLE/);
    // Puis sans les cours · le cumul refuse (« il faut son cours de clôture »).
    await monnaie(c, Z, { monnaieBalance: 'USD', justificationMonnaie: JUSTIF_USD });
    await monnaie(c, K, monnaieUsd(3_000, 2_900, 56_000_000));
    await refusAttendu(c, R, 'Entité en USD sans ses cours (clôture, charges et produits, historique)', 'GET', `/consolidation/cumul?exerciceId=${n26}`, undefined, /cours de clôture/);
    // L'écart d'acquisition d'une entité convertie se convertit au cours de
    // clôture (§ 3) · il faut le cours d'entrée.
    await monnaie(c, Z, monnaieUsd(3_000, 2_900, 28_000_000, { coursEntree: null }));
    await refusAttendu(c, R, 'Écart d’acquisition d’une entité convertie sans cours d’entrée', 'GET', `/consolidation/cumul?exerciceId=${n26}`, undefined, /cours à la date d’entrée/);
    // Monnaie hyperinflationniste · le retraitement par un indice des prix
    // (§ 4) n'est pas servi · refus nommé.
    await monnaie(c, Z, monnaieUsd(3_000, 2_900, 28_000_000, { hyperinflation: true }));
    await refusAttendu(c, R, 'Monnaie fonctionnelle hyperinflationniste', 'GET', `/consolidation/cumul?exerciceId=${n26}`, undefined, /hyperinflationniste/);
    await monnaie(c, Z, monnaieUsd(3_000, 2_900, 28_000_000));
    // ÉCART D'ÉVALUATION SUR UNE ENTITÉ CONVERTIE · sa conversion au cours de
    // clôture n'est pas servie · le cumul le refuse, puis on le retire.
    const ev = await c.geste('Écart d’évaluation sur Zambezi (essai)', 'POST', `/consolidation/liens/${Z.lienId}/ecarts-evaluation`,
      { compte: '24110000', compteAmortissement: '28410000', libelle: 'Matériel réestimé', montant: 1_000_000, mode: 'AMORTISSABLE', dureeAnnees: 5 });
    await refusAttendu(c, R, 'Écart d’évaluation déclaré sur une entité convertie', 'GET', `/consolidation/cumul?exerciceId=${n26}`, undefined, /entité convertie/);
    if (ev) await c.geste('Retrait de l’écart d’évaluation sur Zambezi', 'DELETE', `/consolidation/ecarts-evaluation/${ev.id}`);
  });

  /**
   * ATTENDUS 2026, à la main (D4C ch. XII-4 § 3). Zambezi convertie · actifs et
   * passifs au cours de clôture 3 000, résultat au cours moyen 2 900 · actif
   * net 15 000 USD × 3 000 = 45 000 000 ; capitaux propres historiques
   * 28 000 000 + résultat 5 000 × 2 900 = 14 500 000 · écart de conversion
   * 2 500 000 (groupe 70 % = 1 750 000, minoritaires 750 000).
   * Écart d'acquisition · 1 000 USD au cours de clôture = 3 000 000 brut ;
   * amortissement 200 USD = 600 000 au bilan, dotation au cours moyen 580 000 ;
   * écart de conversion du goodwill (3 000 000 − 600 000 + 580 000) −
   * 2 800 000 = 180 000, au groupe.
   * Kafue (ME) · actif net 24 000 USD × 3 000 = 72 000 000 ; historique
   * 56 000 000 + 4 000 × 2 900 = 67 600 000 · écart 4 400 000 ; titres 30 % ×
   * 72 000 000 = 21 600 000 ; quote-part du résultat 30 % × 11 600 000 =
   * 3 480 000 ; écart de conversion né de la ME 30 % × 4 400 000 = 1 320 000.
   * Écarts de conversion du groupe · 180 000 + 1 750 000 + 1 320 000 =
   * 3 250 000. Résultat · Katanga 8 000 000 − 580 000 + 3 480 000 =
   * 10 900 000 ; Zambezi 14 500 000 × 70 % = 10 150 000 · groupe 21 050 000,
   * minoritaires 4 350 000. Réserves · 20 000 000 (entrée au 1er janvier).
   * Minoritaires · 30 % × 28 000 000 + 750 000 + 4 350 000 = 13 500 000.
   * Bilan · corporelles 30 000 000 + 24 000 000 = 54 000 000 ; écart net
   * 2 400 000 ; titres ME 21 600 000 ; banque 18 800 000 + 27 000 000 =
   * 45 800 000 · total 123 800 000 ; fournisseurs 10 000 000 + 6 000 000.
   */
  await etape(R, 'Katanga · 2026 · cumul et états consolidés convertis', async () => {
    const cu = await c.lire('Cumul 2026', `/consolidation/cumul?exerciceId=${n26}`);
    const cv = (nom) => (cu?.conversions ?? []).find((x) => x.entite === nom);
    R.montant('2026 · écart de conversion né de la balance de Zambezi (45 000 000 − 42 500 000)', 2_500_000, cv(ZAMBEZI)?.ecartConversion);
    R.montant('2026 · écart de conversion né de la balance de Kafue (72 000 000 − 67 600 000)', 4_400_000, cv(KAFUE)?.ecartConversion);
    R.montant('2026 · écarts de conversion, part du groupe (180 000 + 1 750 000 + 1 320 000)', 3_250_000, cu?.capitauxPropres?.ecartsConversion);
    R.montant('2026 · écarts de conversion, part des minoritaires (30 % × 2 500 000)', 750_000, cu?.capitauxPropres?.ecartsConversionMinoritaires);
    R.montant('2026 · écarts de conversion nés de la mise en équivalence (30 % × 4 400 000)', 1_320_000, cu?.capitauxPropres?.ecartsConversionMe);
    R.egal('2026 · aucune conversion incomplète', [], cu?.conversionsIncompletes ?? null);
    const e = await c.lire('États consolidés 2026', `/consolidation/etats?exerciceId=${n26}`);
    controlerEtats(R, 'Katanga 2026', e,
      { ECART_ACQUISITION: 2_400_000, IMMOBILISATIONS_CORPORELLES: 54_000_000, TITRES_MIS_EN_EQUIVALENCE: 21_600_000, TRESORERIE_ACTIF: 45_800_000, TOTAL_GENERAL_ACTIF: 123_800_000 },
      { CAPITAL: 50_000_000, PRIMES_RESERVES_CONSOLIDEES: 20_000_000, ECARTS_CONVERSION: 3_250_000, RESULTAT_CONSOLIDANTE: 21_050_000, PART_MINORITAIRES: 13_500_000, FOURNISSEURS: 16_000_000, TOTAL_GENERAL_PASSIF: 123_800_000 },
      { CHIFFRE_AFFAIRES: 98_000_000, ACHATS_CONSOMMES: -75_500_000, DOTATIONS: -580_000, PART_RESULTATS_ME: 3_480_000, RESULTAT_ENSEMBLE: 25_400_000, RESULTAT_MINORITAIRES: 4_350_000, RESULTAT_CONSOLIDANTE_CR: 21_050_000 });
    const brut = ligne(e?.bilan?.actif, 'ECART_ACQUISITION');
    R.montant('2026 · écart d’acquisition converti au cours de clôture · brut 1 000 USD × 3 000', 3_000_000, brut?.brut);
  });

  const clos = await etape(R, 'Katanga · clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n27 = c.exercices.get('2027')?.id;
  if (!clos || !n27) return R.note('Katanga · 2027 non joué · la clôture de 2026 n’a pas abouti');
  /**
   * Katanga 2027 · affectation de 8 000 000 (réserve légale 800 000, AUSCGIE
   * art. 546 ; dividendes 3 000 000 ; report 4 200 000), dividendes payés,
   * ventes 42 000 000, achats 33 000 000, dividendes reçus de Zambezi 1 400
   * USD × 3 100 = 4 340 000 et de Kafue 900 USD × 3 100 = 2 790 000.
   * Résultat 16 130 000 ; banque 18 800 000 − 3 000 000 + 42 000 000 −
   * 33 000 000 + 4 340 000 + 2 790 000 = 31 930 000.
   */
  await etape(R, 'Katanga · 2027 · comptes et déclarations', async () => {
    await affecter(c, n26, '2027-04-30', [['11100000', 800_000], ['46500000', 3_000_000], ['12100000', 4_200_000]]);
    await ecriture(c, 'Ventes 2027', n27, '2027-03-31', 'Ventes', [[BQ, 42_000_000, 0], ['70110000', 0, 42_000_000]]);
    await ecriture(c, 'Achats 2027', n27, '2027-04-30', 'Achats', [['60110000', 33_000_000, 0], [BQ, 0, 33_000_000]]);
    await ecriture(c, 'Dividendes 2026 payés', n27, '2027-05-15', 'Dividendes payés', [['46500000', 3_000_000, 0], [BQ, 0, 3_000_000]]);
    await ecriture(c, 'Dividende de Zambezi', n27, '2027-06-15', 'Dividende Zambezi (1 400 USD au cours 3 100)', [[BQ, 4_340_000, 0], ['77210000', 0, 4_340_000]]);
    await ecriture(c, 'Dividende de Kafue', n27, '2027-06-30', 'Dividende Kafue (900 USD au cours 3 100)', [[BQ, 2_790_000, 0], ['77210000', 0, 2_790_000]]);
    await validerJusqua(c, n27, '2027-12-31');
    const Z = await entite(c, n27, ZAMBEZI, 70, '2027');
    const K = await entite(c, n27, KAFUE, 30, '2027');
    if (!Z || !K) return;
    await acquisition(c, Z, ACQ_ZAMBEZI(4_340_000), '2027');
    await acquisition(c, K, ACQ_KAFUE(2_790_000), '2027');
    await balanceEntite(c, Z, 'zambezi-2027.csv', csv6(ZAMBEZI_2027));
    await balanceEntite(c, K, 'kafue-2027.csv', csv4(KAFUE_2027));
    await monnaie(c, Z, monnaieUsd(3_200, 3_100, 36_300_000));
    await monnaie(c, K, monnaieUsd(3_200, 3_100, 58_300_000));
    await fiscalite(c, n27, null, FISCALITE_SIMPLE, '2027 · Katanga');
    await fiscalite(c, n27, Z, FISCALITE_ZERO, '2027 · Zambezi');
  });

  /**
   * ATTENDUS 2027, à la main. Zambezi · actif net 19 000 USD × 3 200 =
   * 60 800 000 ; historique 36 300 000 + 6 000 × 3 100 = 54 900 000 · écart
   * cumulé 5 900 000 (groupe 4 130 000, minoritaires 1 770 000). Goodwill ·
   * 1 000 USD × 3 200 = 3 200 000 brut, amortissement 400 USD = 1 280 000,
   * dotation 200 × 3 100 = 620 000 ; écart de conversion (3 200 000 −
   * 1 280 000 + 620 000) − (2 800 000 − 1 120 000 + 560 000) = 300 000.
   * CE CALCUL SUIT LA LECTURE D'OMEGAX (cumul-consolidation.ts, « ce que les
   * réserves en ont reçu les exercices passés reste à la valeur d'entrée ») ·
   * l'amortissement de 2026 y vaut 200 × 2 800 = 560 000. Le texte
   * (ch. XII-4 § 3, « capitaux propres (capital, réserves) · cours
   * historique ») le garde au cours où il est entré au résultat, 200 × 2 900
   * = 580 000 · écart 320 000, conversion du groupe 7 270 000, réserves
   * 38 050 000. Le défaut n'est relevé qu'UNE fois, sur les réserves
   * ci-dessous · les contrôles de conversion et d'IAS 21 sont écrits sur la
   * lecture d'OmegaX pour éprouver leur propre mécanique sans recompter le
   * même écart de 20 000.
   * Kafue · actif net 26 000 × 3 200 = 83 200 000 ; historique 58 300 000 +
   * 5 000 × 3 100 = 73 800 000 · écart 9 400 000, part 2 820 000 ; titres 30 %
   * × 83 200 000 = 24 960 000 ; quote-part 30 % × 15 500 000 = 4 650 000.
   * Écarts de conversion du groupe · 300 000 + 4 130 000 + 2 820 000 =
   * 7 250 000. Résultat · Katanga 16 130 000 − 7 130 000 de dividendes
   * internes − 620 000 + 4 650 000 = 13 030 000 ; Zambezi 18 600 000 × 70 % =
   * 13 020 000 · groupe 26 050 000, minoritaires 5 580 000.
   */
  await etape(R, 'Katanga · 2027 · états convertis, refus du tableau des flux', async () => {
    const cu = await c.lire('Cumul 2027', `/consolidation/cumul?exerciceId=${n27}`);
    R.montant('2027 · écarts de conversion, part du groupe', 7_250_000, cu?.capitauxPropres?.ecartsConversion);
    R.montant('2027 · écarts de conversion, part des minoritaires (30 % × 5 900 000)', 1_770_000, cu?.capitauxPropres?.ecartsConversionMinoritaires);
    R.montant('2027 · écarts de conversion nés de la mise en équivalence (30 % × 9 400 000)', 2_820_000, cu?.capitauxPropres?.ecartsConversionMe);
    R.montant('2027 · dividendes reçus de la mise en équivalence', 2_790_000, cu?.dividendesRecusMe);
    const e = await c.lire('États consolidés 2027', `/consolidation/etats?exerciceId=${n27}`);
    controlerEtats(R, 'Katanga 2027', e,
      { ECART_ACQUISITION: 1_920_000, TITRES_MIS_EN_EQUIVALENCE: 24_960_000, TRESORERIE_ACTIF: 73_530_000, TOTAL_GENERAL_ACTIF: 156_010_000 },
      { ECARTS_CONVERSION: 7_250_000, RESULTAT_CONSOLIDANTE: 26_050_000, FOURNISSEURS: 16_400_000, TOTAL_GENERAL_PASSIF: 156_010_000 },
      { CHIFFRE_AFFAIRES: 110_200_000, DOTATIONS: -620_000, PART_RESULTATS_ME: 4_650_000, RESULTAT_ENSEMBLE: 31_630_000, RESULTAT_MINORITAIRES: 5_580_000 });
    /**
     * RÉSERVES 2027 SELON LE TEXTE · « capitaux propres (capital, réserves) ·
     * cours historique » (ch. XII-4 § 3) · la dotation 2026 du goodwill est
     * entrée au résultat 2026 au cours moyen 2026 (580 000) · réserves
     * 20 000 000 + 21 050 000 − 3 000 000 de dividendes = 38 050 000.
     * CLAUDE.md (tranche 4c, 4) déclare la lecture d'OmegaX · « les réserves
     * passées restent à la valeur d'entrée » (560 000), soit 38 070 000.
     */
    R.montant('2027 · réserves consolidées au cours historique de chaque exercice (20 000 000 + 21 050 000 − 3 000 000)', 38_050_000, net(e?.bilan?.passif, 'PRIMES_RESERVES_CONSOLIDEES'));
    R.egal('2027 · tableau des flux refusé · entité convertie nommée (incidence G non séparée)', [null, true],
      [e?.tableauDesFlux?.lignes ?? null, contient(e?.tableauDesFlux?.obstacles, /« Zambezi Copper Ltd » est convertie de USD en CDF/)]);
    const V = e?.variationCapitauxPropres?.lignes ?? [];
    const v = (cle, col) => V.find((x) => x.cle === cle)?.montants?.[col] ?? null;
    R.montant('2027 · variation des CP · variation des écarts de conversion (7 250 000 − 3 250 000)', 4_000_000, v('VARIATION_CONVERSION', 'conversion'));
  });

  /**
   * IAS 21 DANS LES IFRS CONSOLIDÉS 2027 (§ 39 c, § 41 ; IFRS 18 § 89 a) ·
   * variation de l'exercice = différence de deux cumuls · groupe 7 250 000 −
   * 3 250 000 = 4 000 000 (dont 1 500 000 nés de la ME), minoritaires
   * 1 770 000 − 750 000 = 1 020 000. OCI · « autres éléments recyclables »
   * 4 000 000 + 1 020 000 − 1 500 000 = 3 520 000 ; « quote-part des ME »
   * 1 500 000 ; total 5 020 000. Résultat global · 31 630 000 + 5 020 000 ;
   * minoritaires 5 580 000 + 1 020 000 = 6 600 000 ; propriétaires
   * 30 050 000. Composante cumulée · 7 250 000 − 4 000 000 = 3 250 000, et
   * 4 000 000 en OCI de l'exercice des propriétaires.
   */
  await etape(R, 'Katanga · IFRS consolidés 2027 · reclassification IAS 21', async () => {
    await c.geste('Activité principale IFRS (aucune activité spécifiée)', 'PUT', '/ifrs/activite', { activitePrincipale: 'AUCUNE' });
    for (const [prefixe, rubrique] of [['24', 'SF_IMMOBILISATIONS_CORPORELLES'], ['26', 'SF_ACTIFS_FINANCIERS_NC'], ['52', 'SF_TRESORERIE'], ['101', 'SF_CAPITAL'],
      ['11', 'SF_RESERVES'], ['12', 'SF_RESERVES'], ['13', 'SF_RESERVES'], ['40', 'SF_FOURNISSEURS'], ['46', 'SF_FOURNISSEURS'],
      ['70', 'PL_PRODUITS'], ['60', 'PL_ACHATS_CONSOMMES'], ['77', 'PL_PRODUITS_INVESTISSEMENT']]) {
      await c.geste(`Règle IFRS ${prefixe}`, 'POST', '/ifrs/regles', { prefixe, rubrique });
    }
    await c.geste('Règle de poste · dotation de l’écart', 'POST', '/ifrs/regles-consolidation', { poste: 'DOTATION_ECART_ACQUISITION', rubrique: 'PL_AMORTISSEMENTS' });
    const e = await c.lire('IFRS consolidé 2027', `/ifrs/consolide?exerciceId=${n27}`);
    if (!e?.n) return R.note(`IFRS consolidé 2027 non établi · ${e?.motifN ?? 'lecture refusée'}`);
    const G = e.n.resultatGlobal;
    const S = e.n.situation;
    R.montant('IAS 21 § 39 c · OCI recyclables, autres (4 000 000 + 1 020 000 − 1 500 000)', 3_520_000, ifrs(G, 'OCI_R_AUTRES'));
    R.montant('IFRS 18 § 89 a · OCI recyclables, quote-part des mises en équivalence', 1_500_000, ifrs(G, 'OCI_R_QUOTE_PART_MEE'));
    R.montant('IAS 21 · total des autres éléments du résultat global', 5_020_000, ifrs(G, 'TOTAL_OCI'));
    R.montant('IAS 21 § 41 · résultat global attribué aux minoritaires (5 580 000 + 1 020 000)', 6_600_000, ifrs(G, 'RG_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'));
    R.montant('IAS 21 · résultat global attribué aux propriétaires', 30_050_000, ifrs(G, 'RG_PROPRIETAIRES'));
    R.montant('IAS 21 · composante cumulée hors l’exercice (7 250 000 − 4 000 000)', 3_250_000, ifrs(S, 'SF_AUTRES_COMPOSANTES_CP'));
    R.montant('IAS 21 · OCI de l’exercice des propriétaires', 4_000_000, ifrs(S, 'SF_OCI_EXERCICE'));
    R.montant('IAS 21 · minoritaires (12 660 000 + 5 580 000), conversion comprise une fois', 18_240_000, ifrs(S, 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'));
    R.montant('IAS 21 · total de l’actif inchangé par la reclassification', 156_010_000, ifrs(S, 'TOTAL_ACTIF'));
    R.egal('IAS 21 · la situation boucle', true, (e.n.controles ?? []).every((x) => x.ok));
    R.egal('IAS 21 · la mention de la reclassification est servie', true, contient(e.n.mentions, /IAS 21 § 39 c/));
    R.egal('IAS 21 · comparatif 2026 · sans consolidation N-1, la variation ne se sépare pas, et c’est dit', true, contient(e.n1?.motifsNonPubliable, /Sans consolidation de l’exercice précédent, la variation de l’exercice ne se sépare pas/));
    R.egal('IFRS consolidé 2027 · flux refusés (entité convertie), motif dit', true, !e.fluxTresorerie?.n && /convertie/.test(e.fluxTresorerie?.motifN ?? ''));
  });
}

// =============================================================================
// GROUPE C · KASAÏ HOLDING SA · écarts de conversion des comptes individuels
// =============================================================================

const TSHIKAPA = 'Tshikapa Commerce SARL';
/**
 * TSHIKAPA (IG 100 %), entrée le 1er janvier 2026, capitaux propres 6 000 000,
 * coût 6 000 000 · écart nul.
 * 2026 · ventes 9 000 000, achats 6 000 000 ; créance en devises réévaluée à
 * la baisse (D 478 / C 411, 200 000), dette en devises à la baisse (D 401 / C
 * 479, 50 000), provision pour pertes de change D 6591 / C 4991 200 000
 * (Titre VIII ch. 22 § 2.3). Résultat 2 800 000 ; banque 5 500 000.
 * 2027 · affectation aux réserves ; contre-passation à l'ouverture (D 411 / C
 * 478 200 000 ; D 479 / C 401 50 000) ; ventes 10 000 000, achats 7 000 000 ;
 * nouvelle perte latente D 478 / C 411 120 000 ; provision ajustée D 4991 /
 * C 7591 80 000. Résultat 3 080 000 ; banque 8 500 000 ; 411 1 380 000 ; 401
 * −2 000 000.
 */
const TSHIKAPA_2026 = [
  ['24110000', 'Matériel', 4_000_000, 0, 0], ['41110000', 'Clients', 1_500_000, 0, 200_000], [BQ, 'Banque', 2_500_000, 9_000_000, 6_000_000],
  ['47810000', 'Écart de conversion actif', 0, 200_000, 0], ['10130000', 'Capital', -5_000_000, 0, 0], ['11810000', 'Réserves', -1_000_000, 0, 0],
  ['40110000', 'Fournisseurs', -2_000_000, 50_000, 0], ['47930000', 'Écart de conversion passif', 0, 0, 50_000],
  ['49910000', 'Provision pour risques à court terme', 0, 0, 200_000], ['70110000', 'Ventes', 0, 0, 9_000_000], ['60110000', 'Achats', 0, 6_000_000, 0],
  ['65910000', 'Dotations aux provisions à court terme', 0, 200_000, 0],
];
const TSHIKAPA_2027 = [
  ['24110000', 'Matériel', 4_000_000, 0, 0], ['41110000', 'Clients', 1_300_000, 200_000, 120_000], [BQ, 'Banque', 5_500_000, 10_000_000, 7_000_000],
  ['47810000', 'Écart de conversion actif', 200_000, 120_000, 200_000], ['10130000', 'Capital', -5_000_000, 0, 0], ['11810000', 'Réserves', -1_000_000, 0, 2_800_000],
  ['13010000', 'Résultat en instance d’affectation', -2_800_000, 2_800_000, 0], ['40110000', 'Fournisseurs', -1_950_000, 0, 50_000],
  ['47930000', 'Écart de conversion passif', -50_000, 50_000, 0], ['49910000', 'Provision pour risques à court terme', -200_000, 80_000, 0],
  ['70110000', 'Ventes', 0, 0, 10_000_000], ['60110000', 'Achats', 0, 7_000_000, 0], ['75910000', 'Reprises de provisions à court terme', 0, 0, 80_000],
];
const ACQ_TSHIKAPA = { coutAcquisition: 6_000_000, compteTitres: '26100000', dateEntree: '2026-01-01', capitauxPropresEntree: 6_000_000, modeDureeEcart: 'NON_DETERMINABLE', dividendesExercice: 0 };

async function groupeKasai(R) {
  const c = await nouveauDossier(R, 'Passe V1 · Kasaï Holding SA (écarts de conversion individuels)', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'conso2-kasai', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n26 = c.exercices.get('2026')?.id;
  await activerModules(c);
  await c.geste('Forme juridique SA', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });
  /** Kasaï · ouverture · matériel 10 000 000, titres 6 000 000, banque 4 000 000 · capital 15 000 000, réserves 5 000 000. 2026 · ventes 20 000 000, achats 15 000 000 · résultat 5 000 000. */
  await etape(R, 'Kasaï · 2026 · comptes de la consolidante', async () => {
    await bilanOuverture(c, n26, '2026-01-01', [
      ['24110000', 'Matériel', 10_000_000, 0], ['26100000', 'Titres Tshikapa', 6_000_000, 0], [BQ, 'Banque', 4_000_000, 0],
      ['10130000', 'Capital', 0, 15_000_000], ['11810000', 'Réserves', 0, 5_000_000],
    ]);
    await ecriture(c, 'Ventes 2026', n26, '2026-03-31', 'Ventes', [[BQ, 20_000_000, 0], ['70110000', 0, 20_000_000]]);
    await ecriture(c, 'Achats 2026', n26, '2026-04-30', 'Achats', [['60110000', 15_000_000, 0], [BQ, 0, 15_000_000]]);
    await validerJusqua(c, n26, '2026-12-31');
  });

  const ctx = {};
  await etape(R, 'Kasaï · 2026 · 478 et 479 à retraiter, provision dans sa famille', async () => {
    const T = await entite(c, n26, TSHIKAPA, 100, '2026');
    if (!T) return;
    ctx.T26 = T;
    await acquisition(c, T, ACQ_TSHIKAPA, '2026');
    await balanceEntite(c, T, 'tshikapa-2026.csv', csv6(TSHIKAPA_2026));
    await monnaie(c, T);
    await fiscalite(c, n26, null, FISCALITE_SIMPLE, '2026 · Kasaï');
    await fiscalite(c, n26, T, FISCALITE_SIMPLE, '2026 · Tshikapa (positions N-1 non encore déclarées)');
    // SANS DÉCLARATION, 478 et 479 restent au bilan « à retraiter » (D4C
    // ch. XII-3 § 2) et l'état n'est pas publiable.
    const e0 = await c.lire('États 2026 (478 et 479 non déclarés)', `/consolidation/etats?exerciceId=${n26}`);
    R.montant('2026 · sans déclaration · écart de conversion-actif individuel à retraiter', 200_000, net(e0?.bilan?.actif, 'ECART_CONVERSION_ACTIF_INDIVIDUEL'));
    R.montant('2026 · sans déclaration · écart de conversion-passif individuel à retraiter', 50_000, net(e0?.bilan?.passif, 'ECART_CONVERSION_PASSIF_INDIVIDUEL'));
    R.egal('2026 · sans déclaration · non publiable, motif nommé', [false, true], [e0?.bilanEtResultatPubliables, contient(e0?.motifsNonPubliable, /Écarts de conversion-Actif des comptes individuels/)]);
    // LA FAMILLE DE LA PROVISION · Titre VIII ch. 22 § 2.3 · 194, 4991 ou 4997,
    // rien d'autre (porte) ; et la provision doit être portée par le compte
    // déclaré (cumul).
    await refusAttendu(c, R, 'Provision pour pertes de change hors des trois comptes du ch. 22 § 2.3 (1981)', 'POST', '/consolidation/provisions-change',
      { exerciceId: n26, entiteId: T.id, compteProvision: '19810000', cloture: 200_000, dotation: 200_000, reprise: 0 }, /194, au 4991 ou au 4997/);
    await refusAttendu(c, R, 'Provision dont l’ouverture (clôture − dotation + reprise) serait négative', 'POST', '/consolidation/provisions-change',
      { exerciceId: n26, entiteId: T.id, compteProvision: '49910000', cloture: 100_000, dotation: 200_000, reprise: 0 }, /négative/);
    await fiscalite(c, n26, T, { ...FISCALITE_SIMPLE, ecartConversionActifN1: 0, ecartConversionPassifN1: 0 }, '2026 · Tshikapa (positions 2025 nulles)');
    const p4997 = await c.geste('Provision déclarée au 4997 (essai, la balance la porte au 4991)', 'POST', '/consolidation/provisions-change',
      { exerciceId: n26, entiteId: T.id, compteProvision: '49970000', cloture: 200_000, dotation: 200_000, reprise: 0 });
    await refusAttendu(c, R, 'Provision déclarée au 4997 qu’aucun compte de la balance ne porte', 'GET', `/consolidation/cumul?exerciceId=${n26}`, undefined, /aucun compte 49970000/);
    if (p4997) await c.geste('Retrait de la provision au 4997', 'DELETE', `/consolidation/provisions-change/${p4997.id}`);
    await c.geste('Provision pour pertes de change au 4991 (dotation 6591)', 'POST', '/consolidation/provisions-change',
      { exerciceId: n26, entiteId: T.id, compteProvision: '49910000', cloture: 200_000, dotation: 200_000, reprise: 0 });
  });

  /**
   * ATTENDUS 2026, à la main (ch. XII-3 § 2) · 478 (200 000) et 479 (50 000)
   * annulés, provision 4991 et sa dotation 6591 retirées ; au résultat, la
   * position latente nette 200 000 − 50 000 = 150 000 de perte. Tshikapa ·
   * 9 000 000 − 6 000 000 − 150 000 = 2 850 000 ; Kasaï 5 000 000 · ensemble
   * 7 850 000. Réserves · 5 000 000 − 6 000 000 + 6 000 000 = 5 000 000.
   * Bilan · 14 000 000 + 1 300 000 + 14 500 000 = 29 800 000.
   */
  await etape(R, 'Kasaï · 2026 · états après retraitement', async () => {
    const e = await c.lire('États consolidés 2026', `/consolidation/etats?exerciceId=${n26}`);
    controlerEtats(R, 'Kasaï 2026', e,
      { CLIENTS: 1_300_000, TRESORERIE_ACTIF: 14_500_000, TOTAL_GENERAL_ACTIF: 29_800_000 },
      { PRIMES_RESERVES_CONSOLIDEES: 5_000_000, RESULTAT_CONSOLIDANTE: 7_850_000, FOURNISSEURS: 1_950_000, TOTAL_GENERAL_PASSIF: 29_800_000 },
      { ECARTS_CONVERSION_INDIVIDUELS_RESULTAT: -150_000, RESULTAT_FINANCIER: -150_000, RESULTAT_ENSEMBLE: 7_850_000 });
    R.egal('2026 · 478 et 479 éliminés · plus de ligne à retraiter', [false, false],
      [Boolean(ligne(e?.bilan?.actif, 'ECART_CONVERSION_ACTIF_INDIVIDUEL')), Boolean(ligne(e?.bilan?.passif, 'ECART_CONVERSION_PASSIF_INDIVIDUEL'))]);
    R.montant('2026 · provision 4991 retirée · autres dettes nulles', 0, net(e?.bilan?.passif, 'AUTRES_DETTES'));
  });

  const clos = await etape(R, 'Kasaï · clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n27 = c.exercices.get('2027')?.id;
  if (!clos || !n27) return R.note('Kasaï · 2027 non joué · la clôture de 2026 n’a pas abouti');

  await etape(R, 'Kasaï · 2027 · comptes et déclarations (résultat 2026 pas encore affecté)', async () => {
    await ecriture(c, 'Ventes 2027', n27, '2027-03-31', 'Ventes', [[BQ, 22_000_000, 0], ['70110000', 0, 22_000_000]]);
    await ecriture(c, 'Achats 2027', n27, '2027-04-30', 'Achats', [['60110000', 16_000_000, 0], [BQ, 0, 16_000_000]]);
    await validerJusqua(c, n27, '2027-12-31');
    const T = await entite(c, n27, TSHIKAPA, 100, '2027');
    if (!T) return;
    await acquisition(c, T, ACQ_TSHIKAPA, '2027');
    await balanceEntite(c, T, 'tshikapa-2027.csv', csv6(TSHIKAPA_2027));
    await monnaie(c, T);
    await fiscalite(c, n27, null, FISCALITE_SIMPLE, '2027 · Kasaï');
    await fiscalite(c, n27, T, { ...FISCALITE_SIMPLE, ecartConversionActifN1: 200_000, ecartConversionPassifN1: 50_000 }, '2027 · Tshikapa (positions 2026 déclarées)');
    await c.geste('Provision 2027 · 4991 ajustée (reprise 7591)', 'POST', '/consolidation/provisions-change',
      { exerciceId: n27, entiteId: T.id, compteProvision: '49910000', cloture: 120_000, dotation: 0, reprise: 80_000 });
  });

  /**
   * LE RÉSULTAT 2026 DE LA CONSOLIDANTE, NON ENCORE AFFECTÉ · la clôture
   * d'OmegaX le reporte au 131 de 2027, où il reste jusqu'à l'assemblée
   * (AUDCIF Titre VII, compte 13 · « l'affectation [...] est décidée [...] au
   * cours de l'exercice suivant ; le compte 13 est donc soldé lors de la
   * comptabilisation de cette affectation »). C'est le résultat d'un exercice
   * ANTÉRIEUR · la règle du dépôt pour les états individuels
   * (`resultatDeLExerciceAuxClassesDeGestion`, « un 13 qui ne porte que
   * l'à-nouveau tient le résultat d'exercices antérieurs »). Le résultat
   * consolidé 2027 est celui de l'exercice · Kasaï 22 000 000 − 16 000 000 =
   * 6 000 000, Tshikapa (ci-dessous) 3 030 000 · 9 030 000 ; les 5 000 000 de
   * 2026 sont des réserves (5 000 000 + 7 850 000 = 12 850 000).
   */
  await etape(R, 'Kasaï · 2027 · consolidation avant l’affectation du résultat 2026', async () => {
    const e = await c.lire('États consolidés 2027 (résultat 2026 au 131)', `/consolidation/etats?exerciceId=${n27}`);
    R.montant('2027 avant affectation · résultat de l’ensemble · celui de l’exercice seul (6 000 000 + 3 030 000)', 9_030_000, net(e?.compteDeResultat, 'RESULTAT_ENSEMBLE'));
    R.montant('2027 avant affectation · réserves consolidées (5 000 000 + 7 850 000)', 12_850_000, net(e?.bilan?.passif, 'PRIMES_RESERVES_CONSOLIDEES'));
    R.egal('2027 avant affectation · le résultat N-1 en instance n’est pas lu « balance reçue après clôture »', false,
      contient(e?.motifsNonPubliable, /Résultat porté au compte 13/));
    // Même cause, même lecture · la consolidante n'est pas « arrêtée après
    // clôture », ses classes 6 à 8 portent l'exercice 2027 entier ; le tableau
    // des flux n'a pas à être refusé pour cela.
    R.egal('2027 avant affectation · le tableau des flux n’est pas refusé pour une balance « arrêtée APRÈS clôture »', false,
      contient(e?.tableauDesFlux?.obstacles, /arrêtée APRÈS clôture/));
  });

  await etape(R, 'Kasaï · 2027 · affectation, puis états et tableau des flux', async () => {
    await affecter(c, n26, '2027-06-30', [['11100000', 500_000], ['12100000', 4_500_000]]);
    // L'affectation naît au brouillard, et la consolidante se lit au
    // livre-journal seul (`chargerLignes`) · elle n'entre au cumul qu'une fois
    // validée (AUDCIF art. 22, 2°).
    await validerJusqua(c, n27, '2027-12-31');
    /**
     * ATTENDUS 2027 · 478 (120 000) annulé, 4991 (120 000) et la reprise 7591
     * (80 000) retirées ; au résultat la variation de la position latente
     * nette 120 000 − (200 000 − 50 000) = −30 000 (gain) ; aux réserves la
     * position N-1 moins la provision d'ouverture · 150 000 − 200 000 =
     * −50 000. Tshikapa · 10 000 000 − 7 000 000 + 30 000 = 3 030 000 ;
     * capitaux propres 5 000 000 + 3 800 000 + 50 000 = 8 850 000. Ensemble
     * 9 030 000 ; réserves 4 000 000 + 8 850 000 = 12 850 000. Bilan ·
     * 14 000 000 + 1 380 000 + 23 500 000 = 38 880 000.
     * TABLEAU DES FLUX (ch. XII-8 § 4, CAFG du ch. 5 § 1.2.1.1 · « + gains de
     * change », le gain latent constaté en produit financier par le ch. XII-3
     * § 2) · CAFG 9 000 000 + 30 000 = 9 030 000 ; créances 1 300 000 →
     * 1 380 000 (−80 000), fournisseurs 1 950 000 → 2 000 000 (+50 000) ·
     * leur réévaluation n'est pas un flux, et la position latente la compense
     * · opérationnels 9 000 000 ; variation 9 000 000, de 14 500 000 à
     * 23 500 000 (banques 6 000 000 + 3 000 000 encaissés).
     */
    const e = await c.lire('États consolidés 2027', `/consolidation/etats?exerciceId=${n27}`);
    controlerEtats(R, 'Kasaï 2027', e,
      { CLIENTS: 1_380_000, TRESORERIE_ACTIF: 23_500_000, TOTAL_GENERAL_ACTIF: 38_880_000 },
      { PRIMES_RESERVES_CONSOLIDEES: 12_850_000, RESULTAT_CONSOLIDANTE: 9_030_000, FOURNISSEURS: 2_000_000, TOTAL_GENERAL_PASSIF: 38_880_000 },
      { ECARTS_CONVERSION_INDIVIDUELS_RESULTAT: 30_000, RESULTAT_ENSEMBLE: 9_030_000 });
    const T = e?.tableauDesFlux;
    R.egal('Kasaï 2027 · tableau des flux établi', [], T?.obstacles ?? null);
    if (T?.lignes) {
      const f = (cle) => net(T.lignes, cle);
      R.montant('Kasaï 2027 · flux · trésorerie d’ouverture', 14_500_000, f('TRESORERIE_OUVERTURE'));
      R.montant('Kasaï 2027 · flux · CAFG (9 000 000 + gain de change latent 30 000)', 9_030_000, f('CAFG'));
      R.montant('Kasaï 2027 · flux · variation du besoin de financement (−80 000 + 50 000)', -30_000, f('VARIATION_BF'));
      R.montant('Kasaï 2027 · flux · opérationnels (encaissements réels)', 9_000_000, f('FLUX_OPERATIONNELS'));
      R.montant('Kasaï 2027 · flux · variation de la trésorerie', 9_000_000, f('VARIATION_PERIODE'));
      R.montant('Kasaï 2027 · flux · trésorerie de clôture', 23_500_000, f('TRESORERIE_CLOTURE'));
      R.egal('Kasaï 2027 · flux · trésorerie par les flux = trésorerie du bilan', true, T.controle?.ok);
    }
  });
}

export default async function scenarioConsolidationAvancee(registre) {
  registre.scenario = 'consolidation-avancee';
  const R = registre;
  await etape(R, 'Groupe A · Ituri (IP, écarts d’évaluation, impôts différés, éliminations fiscales, IFRS du groupe)', () => groupeIturi(R));
  await etape(R, 'Groupe B · Katanga (conversion, IAS 21)', () => groupeKatanga(R));
  await etape(R, 'Groupe C · Kasaï (478, 479, provision de change, résultat non affecté)', () => groupeKasai(R));
}
