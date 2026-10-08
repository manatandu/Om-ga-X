/**
 * LOT L · LES POINTS TRANSVERSAUX qu'aucun autre scénario n'a joués.
 *
 * Sept familles, chacune dans son dossier né par l'inscription, sur 2026 et
 * 2027 clôtures comprises quand le sujet a une dimension d'exercice :
 *
 *   1. le Système minimal de trésorerie · la paie passée au journal d'une
 *      association SYCEBNL au SMT et d'une entreprise SYSCOHADA au SMT, la
 *      créance douteuse au SMT (reclassement, dotation refusée, reprise
 *      ouverte, perte), les unités d'œuvre au SMT SYCEBNL (non refusées), la
 *      restitution du dossier et les trois livres exportés, RELUS ;
 *   2. la coopérative dissoute (AUSCOOP art. 196) et la société en procédure
 *      collective (AUSCGIE art. 203 al. 2 ; AUPCAP art. 53), cotisations
 *      spéciales comprises ;
 *   3. la Fiche R2 (cases ZN à ZS) et le dividende prioritaire minier d'un
 *      exercice qui suit une dissolution ;
 *   4. les factures en dollars, le règlement partiel puis le solde en devise,
 *      l'écart réalisé passé au clic, la réévaluation qui ne relit pas une
 *      position dénouée ;
 *   5. les pièces imprimées (ce que le serveur rend, ou pas) ;
 *   6. les rôles cantonnés, la lecture seule, le profil de fonctions, les
 *      journaux autorisés et la fermeture des sessions ;
 *   7. le sur site · état et dépôt de licence, ce que le serveur EN LIGNE
 *      refuse.
 *
 * Chaque montant attendu est calculé à la main dans le commentaire qui le
 * précède, depuis le texte lu (compétences et code cité) et les données du
 * banc. Un refus attendu est un contrôle ; un refus inattendu est consigné
 * (statut et corps) et le scénario continue.
 */
import { createHash, generateKeyPairSync, sign as signer, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import {
  BASE, Client, MOT_DE_PASSE, auCentime, aujourdhui, balance, cloturer, compte, ecriture, etape, ligneDe, lettrer,
  nouveauDossier, rechargerComptes, rechargerExercices, restitution, solde, tiers, validerJusqua,
} from './lib.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..', '..');
const BQ = '52110000';
const PIECE = (nature, reference, date) => [{ nature, reference, date }];

// --- Outils du scénario ---------------------------------------------------------

/** Un jour AAAA-MM-JJ, quelle que soit la forme lue. */
const jour = (d) => (d ? String(d).slice(0, 10) : null);

/** Le texte d'un corps de refus, quelle qu'en soit la forme. */
const texteRefus = (corps) => {
  const m = corps?.message ?? corps;
  return Array.isArray(m) ? m.join(' | ') : typeof m === 'string' ? m : JSON.stringify(m ?? '');
};

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * UN REFUS ATTENDU · joué par `req` (le refus voulu est le contrôle lui-même,
 * pas une erreur du banc), statut et motif relus. Un geste accepté à tort est
 * dit en note avec son corps.
 */
async function refus(c, R, libelle, methode, chemin, corps, { statuts = [400, 403, 409], motif = null } = {}) {
  const r = await c.req(methode, chemin, corps);
  R.egal(`${libelle} · refusé (${statuts.join(' ou ')})`, true, statuts.includes(r.statut));
  if (motif && r.statut >= 400) R.egal(`${libelle} · le motif nomme la règle`, true, motif.test(texteRefus(r.corps)));
  if (r.statut < 400) R.note(`${libelle} · ACCEPTÉ alors qu’un refus était attendu · ${JSON.stringify(r.corps).slice(0, 300)}`);
  else R.note(`${libelle} · ${r.statut} · ${texteRefus(r.corps).slice(0, 300)}`);
  return r;
}

/** Les exercices du dossier, relus à chaque fois (l'arrêt à la dissolution en crée et en re-date). */
async function listeExercices(c) {
  const l = await c.lire('Exercices du dossier', '/exercices');
  return Array.isArray(l) ? l : (l?.exercices ?? []);
}
const exerciceDebutant = (liste, debut) => liste.find((e) => jour(e.dateDebut) === debut) ?? null;

/** Un jalon du planning par son libellé. */
const jalonDe = (planning, re) => (planning?.jalons ?? []).find((j) => re.test(j.libelle ?? '')) ?? null;
const jalonsDe = (planning, re) => (planning?.jalons ?? []).filter((j) => re.test(j.libelle ?? ''));
/** Une ligne de l'échéancier fiscal par sa clé. */
const echeanceDe = (ech, cle) => (ech?.echeances ?? []).find((e) => e.cle === cle) ?? null;

/** Les lignes d'un compte de tiers, ouvertes ou non, telles que la fenêtre de lettrage les lit. */
async function lignesLettrage(c, compteId) {
  const lu = (await c.lire('Lignes du compte (lettrage)', `/comptes/${compteId}/lettrage`)) ?? {};
  return { lignes: lu.lignes ?? (Array.isArray(lu) ? lu : []), lettrages: lu.lettrages ?? [] };
}

// --- Relecture des classeurs ---------------------------------------------------------

async function lireClasseur(octets) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(octets);
  return wb;
}
/** La valeur lisible d'une cellule · le résultat d'une formule, le texte d'un texte riche. */
function valeur(v) {
  if (v && typeof v === 'object') {
    if ('result' in v) return v.result;
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return v.text;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return v;
}
/** Les rangées d'une feuille · `vals[col]` en base 1, comme ExcelJS. */
function rangees(ws) {
  const out = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    const vals = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => { vals[col] = valeur(cell.value); });
    out.push({ n, vals });
  });
  return out;
}
const nombreCellule = (x) => (x === null || x === undefined || x === '' ? 0 : Number(x));

/**
 * LE JOURNAL EXPORTÉ, RELU · la ligne « TOTAUX DE LA PÉRIODE » porte deux
 * formules (débit, crédit) dont le résultat est la somme des lignes écrites
 * (export.service.ts, journalExcel) · comparées au total calculé à la main.
 */
async function relireJournal(c, R, lib, exerciceId, attendu) {
  const r = await c.lire(`Export journal ${lib}`, `/exports/journal?exerciceId=${exerciceId}`);
  if (!r?.contenu) return R.note(`${lib} · journal exporté illisible, non relu`);
  const wb = await lireClasseur(r.contenu);
  let totaux = null;
  let lignes = 0;
  for (const ws of wb.worksheets) {
    for (const { vals } of rangees(ws)) {
      if (vals.includes('TOTAUX DE LA PÉRIODE')) totaux = vals.filter((v) => typeof v === 'number');
      else if (vals.some((v) => v === 'Validée' || v === 'Brouillard')) lignes += 1;
    }
  }
  R.montant(`${lib} · journal exporté · total débit`, attendu.total, totaux?.[0]);
  R.montant(`${lib} · journal exporté · total crédit`, attendu.total, totaux?.[1]);
  if (attendu.lignes !== undefined) R.montant(`${lib} · journal exporté · lignes d’écriture`, attendu.lignes, lignes);
}

/**
 * LE GRAND LIVRE EXPORTÉ (présentation du cabinet, FPM), RELU · un bloc
 * « Total du compte » par compte mouvementé, puis le contrôle « Solde à la
 * balance générale » et « Écart : aucun » (export-fpm.service.ts).
 */
async function relireGrandLivre(c, R, lib, exerciceId, comptesMouvementes) {
  const r = await c.lire(`Export grand livre ${lib}`, `/exports/grand-livre?exerciceId=${exerciceId}`);
  if (!r?.contenu) return R.note(`${lib} · grand livre exporté illisible, non relu`);
  const wb = await lireClasseur(r.contenu);
  let blocs = 0;
  let ecartNul = false;
  let ecartDit = false;
  for (const ws of wb.worksheets) {
    for (const { vals } of rangees(ws)) {
      if (vals.some((v) => typeof v === 'string' && v.startsWith('Total du compte'))) blocs += 1;
      if (vals.includes('Écart : aucun')) ecartNul = true;
      if (vals.some((v) => typeof v === 'string' && v.startsWith('Écart avec la balance'))) ecartDit = true;
    }
  }
  R.montant(`${lib} · grand livre exporté · un bloc « Total du compte » par compte mouvementé`, comptesMouvementes, blocs);
  R.egal(`${lib} · grand livre exporté · contrôle contre la balance « Écart : aucun »`, [true, false], [ecartNul, ecartDit]);
}

/**
 * LA BALANCE EXPORTÉE (FPM), RELUE · colonnes C à H (report débit et crédit,
 * mouvements débit et crédit, solde débiteur et créditeur), ligne « Totaux de
 * la balance » et lignes de compte (numéro en colonne A, lien vers sa feuille).
 * Un zéro est une cellule vide (balance-fpm.ts).
 */
async function relireBalance(c, R, lib, exerciceId, { totalDebit, totalCredit, mouvementsDebit, soldes = {} }) {
  const r = await c.lire(`Export balance ${lib}`, `/exports/balance?exerciceId=${exerciceId}`);
  if (!r?.contenu) return R.note(`${lib} · balance exportée illisible, non relue`);
  const wb = await lireClasseur(r.contenu);
  let lignes = null;
  for (const ws of wb.worksheets) {
    const rs = rangees(ws);
    if (rs.some(({ vals }) => vals[2] === 'Totaux de la balance')) { lignes = rs; break; }
  }
  if (!lignes) return R.note(`${lib} · balance exportée sans ligne « Totaux de la balance »`);
  const tot = lignes.find(({ vals }) => vals[2] === 'Totaux de la balance').vals;
  R.montant(`${lib} · balance exportée · total des débits (report + mouvements)`, totalDebit, nombreCellule(tot[3]) + nombreCellule(tot[5]));
  R.montant(`${lib} · balance exportée · total des crédits (report + mouvements)`, totalCredit, nombreCellule(tot[4]) + nombreCellule(tot[6]));
  if (mouvementsDebit !== undefined) R.montant(`${lib} · balance exportée · colonne « Mouvements » débit`, mouvementsDebit, nombreCellule(tot[5]));
  for (const [numero, attendu] of Object.entries(soldes)) {
    const l = lignes.find(({ vals }) => String(vals[1] ?? '') === numero);
    R.montant(`${lib} · balance exportée · solde du ${numero}`, attendu, l ? nombreCellule(l.vals[7]) - nombreCellule(l.vals[8]) : null);
  }
}

// --- La paie, calculée depuis les textes -----------------------------------------------

/** Décret n° 18/041, art. 2 à 4 (compétence cnss-cotisations-sociales-rdc) · 6,5 % familles, 5 % + 5 % pensions, 1,5 % risques. */
const TAUX_CNSS = { pf: 6.5, pe: 5, pt: 5, rp: 1.5 };
/** Arrêté interministériel n° 002/CAB/MET/2025, art. 1er · privé de 1 à 50 travailleurs (cotisations-paie.ts, BAREMES_INPP). */
const TAUX_INPP = 3.5;
/** Arrêté ministériel n° 028/2025, art. 1er · 0,5 % de la rémunération payée. */
const TAUX_ONEM = 0.5;
/** Loi n° 23/053, art. 150 · la décimale, puis la tranche de 50 FC à la centaine. */
function arrondiArticle150(x) {
  const unite = Math.round(x);
  const reste = unite % 100;
  return reste >= 50 ? unite - reste + 100 : unite - reste;
}
/**
 * Loi n° 23/053, art. 118 (barème sur le revenu net global arrondi au millier
 * inférieur, 3 / 15 / 30 / 40 %, plafond de 30 % · compétence fiscalite-rdc,
 * parametres-2026.md) et art. 119 (retenue mensuelle, mois annualisé).
 */
function irppDuMois(netFiscalMensuel) {
  const annuel = Math.floor((netFiscalMensuel * 12) / 1000) * 1000;
  const tranches = [[0, 1_944_000, 3], [1_944_000, 21_600_000, 15], [21_600_000, 43_200_000, 30], [43_200_000, Infinity, 40]];
  const bareme = tranches.reduce((s, [de, a, t]) => s + (annuel > de ? ((Math.min(annuel, a) - de) * t) / 100 : 0), 0);
  return arrondiArticle150(Math.min(bareme, annuel * 0.3) / 12);
}
/** Un bulletin à salaire seul · cotisations, IRPP sur le brut net de la quote-part ouvrière (art. 71), net. */
function bulletinAttendu(salaire) {
  const pct = (t) => (salaire * t) / 100;
  const pf = pct(TAUX_CNSS.pf);
  const pe = pct(TAUX_CNSS.pe);
  const pt = pct(TAUX_CNSS.pt);
  const rp = pct(TAUX_CNSS.rp);
  const inpp = pct(TAUX_INPP);
  const onem = pct(TAUX_ONEM);
  const irpp = irppDuMois(salaire - pt);
  return { salaire, pf, pe, pt, rp, inpp, onem, irpp, net: salaire - pt - irpp };
}

/** Salarié, contrat CDI en francs, module de paie actif · rend l'identifiant du salarié. */
async function salarieEnFrancs(c, nom, salaire, debut) {
  const s = await c.geste(`Salarié ${nom}`, 'POST', '/personnel/salaries', { nom, sexe: 'MASCULIN', nationalite: 'congolaise' });
  if (!s) return null;
  await c.geste(`Contrat ${nom}`, 'POST', `/personnel/salaries/${s.id}/contrats`, {
    type: 'DUREE_INDETERMINEE', lieuExecution: 'Siège', dateEntreeEnVigueur: debut, natureTravail: 'Agent administratif',
    classeProfessionnelle: 2, periodiciteRemuneration: 'MOIS', remunerationBase: salaire, deviseRemuneration: 'CDF',
  });
  return s.id;
}

/** Émet le bulletin du mois et le confronte à l'attendu · [versé, assiette, quote-part ouvrière, IRPP, net]. */
async function bulletin(c, R, lib, salarieId, mois, dateMiseADisposition, a) {
  const b = await c.geste(`Bulletin ${mois}`, 'POST', `/personnel/salaries/${salarieId}/bulletins`, {
    moisDePaie: mois, dateMiseADisposition, natureEmployeurInpp: 'PRIVE', effectif: 5, regimeSalarial: 'BAREME_ARTICLE_118',
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: a.salaire }],
  });
  const n = (x) => (x === null || x === undefined ? null : Number(x));
  R.egal(`${lib} · bulletin ${mois} · [versé, assiette sociale, quote-part ouvrière, IRPP, net]`,
    [a.salaire, a.salaire, a.pt, a.irpp, a.net],
    b ? [n(b.totalVerseFc), n(b.assietteSocialeFc), n(b.cotisationsTravailleurFc), n(b.irppFc), n(b.netAPayerFc)] : null);
  return b;
}

// ==============================================================================
// 1 a. ASSOCIATION SYCEBNL AU SYSTÈME MINIMAL DE TRÉSORERIE
// ==============================================================================

async function smtAssociation(R) {
  R.scenario = 'transversal · SMT SYCEBNL';
  const c = await nouveauDossier(R, 'Passe transversal · Association Tujenge de Bukavu', {
    referentiel: 'SYCEBNL', jeu: 'SYSTEME_MINIMAL_TRESORERIE', cle: 'tr-smt-asbl', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ca = c.journal('CA') ?? c.od;
  const od = c.od;
  const CAISSE = '57100000';
  // dot26 et dot27 · les dotations aux unités d'œuvre RÉELLEMENT passées ·
  // refusées, elles sortent des totaux attendus en aval (le défaut est relevé
  // une fois, à sa racine, et non répété sur chaque total qui en découle).
  const ctx = { dot26: 0, dot27: 0 };
  // Retraite obligatoire au 4321 SYCEBNL (passation-paie.ts · « un numéro, deux sens », le 431 SYCEBNL n'ouvre aucun 4313).
  const RETRAITE = '43210000';

  await etape(R, 'SMT SYCEBNL · module de paie, salarié, dotation initiale, don', async () => {
    const m = await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    R.egal('SMT SYCEBNL · module de paie activé', true, Boolean(m && JSON.stringify(m).includes('PAIE')));
    ctx.sal = await salarieEnFrancs(c, 'MWAMBA', 800_000, '2026-01-01');
    ctx.frs = await tiers(c, 'FOURNISSEUR', 'FRS-BUR', 'Bureautique du Kivu');
    await ecriture(c, 'Dotation initiale', n, '2026-01-02', 'Dotation des membres fondateurs', [[BQ, 15_000_000, 0], ['10110000', 0, 15_000_000]], { journal: bq });
    await ecriture(c, 'Don 2026', n, '2026-02-15', 'Don de la Fondation des Grands Lacs', [[BQ, 10_000_000, 0], ['70410000', 0, 10_000_000]], { journal: bq });
  });

  // MWAMBA, 800 000 FC · CNSS 52 000 + 40 000 + 40 000 + 12 000 ; INPP 28 000 ;
  // ONEM 4 000 ; IRPP · (800 000 − 40 000) × 12 = 9 120 000 → 58 320 +
  // 15 % × 7 176 000 = 1 134 720 ; / 12 = 94 560 → 94 600 (art. 150) ;
  // net 800 000 − 40 000 − 94 600 = 665 400.
  const a = bulletinAttendu(800_000);

  await etape(R, 'SMT SYCEBNL · paie de mars 2026 passée au journal', async () => {
    if (!ctx.sal) return R.note('SMT SYCEBNL · salarié absent, paie non jouée');
    await bulletin(c, R, 'SMT SYCEBNL', ctx.sal, '2026-03', '2026-03-31', a);
    await c.geste('Passation de la paie de mars 2026', 'POST', '/personnel/paie-du-mois/2026-03/comptabilisation', { exerciceId: n, journalId: od.id, date: '2026-03-31' });
    await validerJusqua(c, n, '2026-03-31');
    const b = await balance(c, n);
    // P3 · trois temps, puis l'INPP et l'ONEM en impôts et taxes (décision T1).
    R.montant('SMT SYCEBNL · 6611 salaire brut', 800_000, solde(b, '6611'));
    R.montant('SMT SYCEBNL · 6641 charges sociales patronales (52 000 + 40 000 + 12 000)', 104_000, solde(b, '6641'));
    R.montant('SMT SYCEBNL · 6415 INPP (3,5 %)', 28_000, solde(b, '6415'));
    R.montant('SMT SYCEBNL · 6413 ONEM (0,5 %)', 4_000, solde(b, '6413'));
    R.montant('SMT SYCEBNL · 422 = net à payer', -665_400, solde(b, '422'));
    R.montant('SMT SYCEBNL · 4311 prestations familiales', -52_000, solde(b, '4311'));
    R.montant('SMT SYCEBNL · 4312 risques professionnels', -12_000, solde(b, '4312'));
    R.montant(`SMT SYCEBNL · ${RETRAITE} retraite obligatoire (40 000 + 40 000)`, -80_000, solde(b, RETRAITE));
    R.montant('SMT SYCEBNL · 4313 jamais employé au SYCEBNL', 0, solde(b, '4313'));
    R.montant('SMT SYCEBNL · 4472 IRPP retenu', -94_600, solde(b, '4472'));
    R.montant('SMT SYCEBNL · 4428 INPP et ONEM', -32_000, solde(b, '4428'));
    await ecriture(c, 'Paiement du net de mars', n, '2026-03-31', 'Net de mars MWAMBA', [['42200000', 665_400, 0], [BQ, 0, 665_400]], { journal: bq });
    await ecriture(c, 'Reversement des retenues et cotisations de mars', n, '2026-04-15', 'CNSS, IRPP, INPP, ONEM de mars', [
      ['43110000', 52_000, 0], ['43120000', 12_000, 0], [RETRAITE, 80_000, 0], ['44720000', 94_600, 0], ['44280000', 32_000, 0], [BQ, 0, 270_600],
    ], { journal: bq });
  });

  await etape(R, 'SMT SYCEBNL · photocopieuse aux unités d’œuvre (non refusée au SMT SYCEBNL)', async () => {
    // AUDCIF art. 45, non exclu par l'art. 3 du SYCEBNL · common/systeme-minimal.ts
    // ne refuse les modes non linéaires qu'au SMT SYSCOHADA (Titre X ch. 1 § 1).
    ctx.immo = await c.geste('Photocopieuse aux unités d’œuvre', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24420000'), designation: 'Photocopieuse numérique', dateAcquisition: '2026-04-01',
      dateMiseEnService: '2026-04-01', valeurOrigine: 6_000_000, dureeAmortissementAns: 5, modeAmortissement: 'UNITES_DOEUVRE',
      unitesOeuvrePrevues: 500_000, uniteOeuvreLibelle: 'copies', compteContrepartieId: compte(c, BQ), exerciceId: n, journalId: bq.id,
    });
    R.egal('SMT SYCEBNL · bien aux unités d’œuvre créé (non refusé)', 'UNITES_DOEUVRE', ctx.immo?.modeAmortissement ?? null);
    await ecriture(c, 'Cotisations 2026 encaissées', n, '2026-05-31', 'Cotisations des membres 2026', [[CAISSE, 2_000_000, 0], ['70100000', 0, 2_000_000]], { journal: ca });
    if (!ctx.immo) return;
    // Dotation REFUSÉE sans relevé (CLAUDE.md, amortissement aux unités d'œuvre).
    await refus(c, R, 'SMT SYCEBNL · dotation sans relevé d’unités', 'POST', `/immobilisations/${ctx.immo.id}/dotation`, { exerciceId: n, journalId: od.id }, { statuts: [400] });
    await c.geste('Relevé 2026 de la photocopieuse', 'POST', `/immobilisations/${ctx.immo.id}/consommation`, { exerciceId: n, unitesConsommees: 75_000, source: 'Compteur de la photocopieuse relevé le 31/12/2026' });
    // AD = 6 000 000 × 75 000 / 500 000 = 900 000, aucun prorata temporis (art. 45).
    const d = await c.geste('Dotation 2026 de la photocopieuse', 'POST', `/immobilisations/${ctx.immo.id}/dotation`, { exerciceId: n, journalId: od.id });
    R.montant('SMT SYCEBNL · dotation 2026 aux unités d’œuvre (6 000 000 × 75 000 / 500 000)', 900_000, d?.montant);
    ctx.dot26 = d ? 900_000 : 0;
    if (!d) R.note('SMT SYCEBNL · dotation 2026 non passée · les totaux attendus en aval la retranchent (conséquence du refus ci-dessus)');
  });

  await etape(R, 'SMT SYCEBNL · 2026 · soldes, Fiche R2 refusée, livres exportés relus', async () => {
    await validerJusqua(c, n, '2026-12-31');
    const b = await balance(c, n);
    // Banque · 15 000 000 + 10 000 000 − 665 400 − 270 600 − 6 000 000 = 18 064 000.
    R.montant('SMT SYCEBNL 2026 · banque', 18_064_000, solde(b, BQ));
    R.montant('SMT SYCEBNL 2026 · caisse', 2_000_000, solde(b, CAISSE));
    R.montant('SMT SYCEBNL 2026 · photocopieuse (2442)', 6_000_000, solde(b, '2442'));
    R.montant('SMT SYCEBNL 2026 · amortissement (284)', -ctx.dot26, solde(b, '284'));
    R.montant('SMT SYCEBNL 2026 · dotation (6813)', ctx.dot26, solde(b, '6813'));
    for (const r of ['422', '431', '432', '4472', '4428']) R.montant(`SMT SYCEBNL 2026 · ${r} soldé après les versements`, 0, solde(b, r));
    // Résultat · 10 000 000 + 2 000 000 − (800 000 + 104 000 + 32 000) = 11 064 000, moins la dotation (900 000) · 10 164 000.
    R.montant('SMT SYCEBNL 2026 · résultat (classes 6 et 7)', 11_064_000 - ctx.dot26, -(solde(b, '6') + solde(b, '7')));
    // La Fiche R2 est de l'AUDCIF (Titre IX ch. 2) · route SYSCOHADA seule.
    await refus(c, R, 'SMT SYCEBNL · Fiche R2 déclarée sur un dossier SYCEBNL', 'POST', `/exercices/${n}/fiche-r2`, { nombreEtablissementsPays: 1 }, { statuts: [403] });
    // Total du journal 2026 · 15 000 000 + 10 000 000 + paie 1 070 600
    // (800 000 + 134 600 + 104 000 + 32 000) + net 665 400 + reversements
    // 270 600 + photocopieuse 6 000 000 + cotisations 2 000 000 + dotation
    // 900 000 = 35 906 600 (35 006 600 sans la dotation).
    const total26 = 35_006_600 + ctx.dot26;
    await relireJournal(c, R, 'SMT SYCEBNL 2026', n, { total: total26 });
    // Dix-huit comptes mouvementés · 5211, 1011, 7041, 6611, 422, 4321, 4472,
    // 6641, 4311, 4312, 6415, 6413, 4428, 2442, 5710, 7010, plus 6813 et 284x
    // quand la dotation est passée.
    await relireGrandLivre(c, R, 'SMT SYCEBNL 2026', n, 16 + (ctx.dot26 ? 2 : 0));
    await relireBalance(c, R, 'SMT SYCEBNL 2026', n, {
      totalDebit: total26, totalCredit: total26, mouvementsDebit: total26,
      soldes: { [BQ]: 18_064_000, [CAISSE]: 2_000_000, '24420000': 6_000_000, '70410000': -10_000_000 },
    });
  });

  const clos = await etape(R, 'SMT SYCEBNL · clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('SMT SYCEBNL · 2027 non joué · clôture 2026 non aboutie ou 2027 absent');

  await etape(R, 'SMT SYCEBNL · 2027 · paie de février, don, relevé, livres relus', async () => {
    if (ctx.sal) {
      await bulletin(c, R, 'SMT SYCEBNL 2027', ctx.sal, '2027-02', '2027-02-28', a);
      await c.geste('Passation de la paie de février 2027', 'POST', '/personnel/paie-du-mois/2027-02/comptabilisation', { exerciceId: n1, journalId: od.id, date: '2027-02-28' });
    }
    await ecriture(c, 'Paiement du net de février 2027', n1, '2027-02-28', 'Net de février MWAMBA', [['42200000', 665_400, 0], [BQ, 0, 665_400]], { journal: bq });
    await ecriture(c, 'Reversement des retenues et cotisations de février 2027', n1, '2027-03-15', 'CNSS, IRPP, INPP, ONEM de février', [
      ['43110000', 52_000, 0], ['43120000', 12_000, 0], [RETRAITE, 80_000, 0], ['44720000', 94_600, 0], ['44280000', 32_000, 0], [BQ, 0, 270_600],
    ], { journal: bq });
    await ecriture(c, 'Don 2027', n1, '2027-04-10', 'Don de la Fondation des Grands Lacs 2027', [[BQ, 5_000_000, 0], ['70410000', 0, 5_000_000]], { journal: bq });
    if (ctx.immo) {
      await c.geste('Relevé 2027 de la photocopieuse', 'POST', `/immobilisations/${ctx.immo.id}/consommation`, { exerciceId: n1, unitesConsommees: 100_000, source: 'Compteur de la photocopieuse relevé le 31/12/2027' });
      // 6 000 000 × 100 000 / 500 000 = 1 200 000.
      const d = await c.geste('Dotation 2027 de la photocopieuse', 'POST', `/immobilisations/${ctx.immo.id}/dotation`, { exerciceId: n1, journalId: od.id });
      R.montant('SMT SYCEBNL 2027 · dotation aux unités d’œuvre (6 000 000 × 100 000 / 500 000)', 1_200_000, d?.montant);
      ctx.dot27 = d ? 1_200_000 : 0;
      if (!d) R.note('SMT SYCEBNL · dotation 2027 non passée · les totaux attendus en aval la retranchent');
    }
    await validerJusqua(c, n1, '2027-12-31');
    const b = await balance(c, n1);
    // 18 064 000 − 665 400 − 270 600 + 5 000 000 = 22 128 000.
    R.montant('SMT SYCEBNL 2027 · banque', 22_128_000, solde(b, BQ));
    R.montant('SMT SYCEBNL 2027 · amortissement cumulé (900 000 + 1 200 000)', -(ctx.dot26 + ctx.dot27), solde(b, '284'));
    for (const r of ['422', '431', '432', '4472', '4428']) R.montant(`SMT SYCEBNL 2027 · ${r} soldé`, 0, solde(b, r));
    // 5 000 000 − (800 000 + 104 000 + 32 000) = 4 064 000, moins la dotation (1 200 000) · 2 864 000.
    R.montant('SMT SYCEBNL 2027 · résultat (classes 6 et 7)', 4_064_000 - ctx.dot27, -(solde(b, '6') + solde(b, '7')));
    // Journal 2027 · à-nouveau 26 064 000 (banque 18 064 000, caisse
    // 2 000 000, photocopieuse 6 000 000 au débit ; 284 900 000, dotation
    // 15 000 000, résultat 10 164 000 au crédit) + paie 1 070 600 + net
    // 665 400 + reversements 270 600 + don 5 000 000 + dotation 1 200 000.
    // L'à-nouveau vaut 26 064 000 avec ou sans la dotation de 2026 (le 284
    // et le résultat se compensent au crédit).
    const mvt27 = 7_006_600 + ctx.dot27;
    await relireJournal(c, R, 'SMT SYCEBNL 2027', n1, { total: 26_064_000 + mvt27 });
    await relireBalance(c, R, 'SMT SYCEBNL 2027', n1, {
      totalDebit: 26_064_000 + mvt27, totalCredit: 26_064_000 + mvt27, mouvementsDebit: mvt27, soldes: { [BQ]: 22_128_000 },
    });
  });

  await etape(R, 'SMT SYCEBNL · clôture 2027 et restitution du dossier relue', async () => {
    await cloturer(c, '2027');
    await rechargerExercices(c);
    await restitution(c, R, 'SMT SYCEBNL · restitution');
  });
}

// ==============================================================================
// 1 b. ENTREPRISE SYSCOHADA AU SYSTÈME MINIMAL DE TRÉSORERIE · paie et créances douteuses
// ==============================================================================

async function smtEntreprise(R) {
  R.scenario = 'transversal · SMT SYSCOHADA';
  const c = await nouveauDossier(R, 'Passe transversal · Quincaillerie de Mbuji-Mayi', {
    referentiel: 'SYSCOHADA', systeme: 'MINIMAL_TRESORERIE', cle: 'tr-smt-ent', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const ven = c.journal('VEN') ?? od;
  const ctx = {};

  await etape(R, 'SMT SYSCOHADA · reprise au 01/01/2026 et créance douteuse déclarée', async () => {
    // Bilan d'ouverture importé · banque 8 000 000, créance douteuse reprise
    // 800 000 au 4162 dépréciée de 400 000 au 4912, capital 8 400 000.
    const csv = ['Compte;Intitule;Debit;Credit', [BQ, 'Banque', 8_000_000, 0], ['41620000', 'Créances douteuses', 800_000, 0],
      ['49120000', 'Dépréciation des créances douteuses', 0, 400_000], ['10130000', 'Capital', 0, 8_400_000]].map((l) => (Array.isArray(l) ? l.join(';') : l)).join('\n');
    await c.geste('Import du bilan d’ouverture', 'POST', '/import/executer', {
      type: 'BALANCE', nomFichier: 'ouverture-2026.csv', contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
      mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
      exerciceId: n, dateOperation: '2026-01-01', bilanDOuverture: true, separateur: ';',
    });
    await validerJusqua(c, n, '2026-01-01');
    ctx.cliA = await tiers(c, 'CLIENT', 'CLI-A', 'Entreprise Kasaï Bâtiment');
    ctx.cliB = await tiers(c, 'CLIENT', 'CLI-B', 'Société Lubilanji Construction');
    if (!ctx.cliB) return;
    // M3 · créance reprise DÉCLARÉE au début de l'exercice, sans écriture, source
    // exigée, bornée par l'à-nouveau du 416 (800 000) et du 491 (400 000).
    ctx.B = await c.geste('Créance B reprise, déclarée au 01/01/2026', 'POST', '/creances-douteuses/declarations', {
      exerciceId: n, compteCreanceId: ctx.cliB.compteId, compte416Id: compte(c, '41620000'), compte491Id: compte(c, '49120000'),
      nature: 'DOUTEUSE', montant: 800_000, depreciationOuverture: 400_000,
      source: 'Balance d’ouverture importée au 01/01/2026 · dossier repris du cabinet précédent', motif: 'Client en retard de paiement depuis 2025',
    });
  });

  await etape(R, 'SMT SYSCOHADA · vente à crédit et reclassement de la créance A', async () => {
    if (!ctx.cliA) return;
    await ecriture(c, 'Vente à crédit à CLI-A', n, '2026-02-10', 'Facture FA-2026-001', [[ctx.cliA.numero, 1_000_000, 0], ['70110000', 0, 1_000_000]], { journal: ven });
    await validerJusqua(c, n, '2026-02-10');
    // Fiche du compte 41 · D 4162 / C compte du client (SYSCOHADA · 4162 « créances douteuses »).
    ctx.A = await c.geste('Reclassement de la créance A', 'POST', '/creances-douteuses', {
      motif: 'Le client ne répond plus aux relances depuis mars 2026', pieces: PIECE('Lettre de relance recommandée', 'REL-2026-014', '2026-06-20'),
      exerciceId: n, journalId: od.id, date: '2026-06-30', compteCreanceId: ctx.cliA.compteId,
      compte416Id: compte(c, '41620000'), compte491Id: compte(c, '49120000'), nature: 'DOUTEUSE', montant: 1_000_000,
    });
  });

  // KABONGO, 600 000 FC · CNSS 39 000 + 30 000 + 30 000 + 9 000 ; INPP 21 000 ;
  // ONEM 3 000 ; IRPP · 570 000 × 12 = 6 840 000 → 58 320 + 15 % × 4 896 000 =
  // 792 720 ; / 12 = 66 060 → 66 100 ; net 600 000 − 30 000 − 66 100 = 503 900.
  const a = bulletinAttendu(600_000);

  await etape(R, 'SMT SYSCOHADA · paie d’avril 2026 passée au journal', async () => {
    const m = await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    R.egal('SMT SYSCOHADA · module de paie activé', true, Boolean(m && JSON.stringify(m).includes('PAIE')));
    const sal = await salarieEnFrancs(c, 'KABONGO', 600_000, '2026-01-01');
    if (!sal) return;
    await bulletin(c, R, 'SMT SYSCOHADA', sal, '2026-04', '2026-04-30', a);
    await c.geste('Passation de la paie d’avril 2026', 'POST', '/personnel/paie-du-mois/2026-04/comptabilisation', { exerciceId: n, journalId: od.id, date: '2026-04-30' });
    await validerJusqua(c, n, '2026-04-30');
    const b = await balance(c, n);
    R.montant('SMT SYSCOHADA · 6611', 600_000, solde(b, '6611'));
    R.montant('SMT SYSCOHADA · 6641 (39 000 + 30 000 + 9 000)', 78_000, solde(b, '6641'));
    R.montant('SMT SYSCOHADA · 6415 INPP', 21_000, solde(b, '6415'));
    R.montant('SMT SYSCOHADA · 6413 ONEM', 3_000, solde(b, '6413'));
    R.montant('SMT SYSCOHADA · 422 = net', -503_900, solde(b, '422'));
    // Retraite obligatoire au 4313 SYSCOHADA (sous 431), jamais au 432 (complémentaire).
    R.montant('SMT SYSCOHADA · 4313 retraite obligatoire (30 000 + 30 000)', -60_000, solde(b, '4313'));
    R.montant('SMT SYSCOHADA · 432 jamais employé (retraite complémentaire)', 0, solde(b, '432'));
    R.montant('SMT SYSCOHADA · 4472 IRPP', -66_100, solde(b, '4472'));
    R.montant('SMT SYSCOHADA · 4428 INPP et ONEM', -24_000, solde(b, '4428'));
    await ecriture(c, 'Paiement du net d’avril', n, '2026-04-30', 'Net d’avril KABONGO', [['42200000', 503_900, 0], [BQ, 0, 503_900]], { journal: bq });
    await ecriture(c, 'Reversement des retenues et cotisations d’avril', n, '2026-05-14', 'CNSS, IRPP, INPP, ONEM d’avril', [
      ['43110000', 39_000, 0], ['43120000', 9_000, 0], ['43130000', 60_000, 0], ['44720000', 66_100, 0], ['44280000', 24_000, 0], [BQ, 0, 198_100],
    ], { journal: bq });
  });

  await etape(R, 'SMT SYSCOHADA · revues 2026 · dotation refusée, reprise ouverte', async () => {
    await validerJusqua(c, n, '2026-12-31');
    // SMT · « son modèle d'états n'ouvre aucun poste de dépréciation » (common/systeme-minimal.ts).
    if (ctx.A) {
      await refus(c, R, 'SMT SYSCOHADA · revue de A portée à 500 000 (dotation)', 'POST', `/creances-douteuses/${ctx.A.id}/revue`, {
        motif: 'Recouvrement compromis', pieces: PIECE('Note du recouvrement', 'NR-2026-31', '2026-12-31'), exerciceId: n, journalId: od.id, depreciationNecessaire: 500_000,
      }, { statuts: [400], motif: /Système minimal de trésorerie/ });
      // Maintenue à zéro · aucune écriture, la revue est gardée.
      await c.geste('Revue de A maintenue à zéro', 'POST', `/creances-douteuses/${ctx.A.id}/revue`, {
        motif: 'Aucune dépréciation au Système minimal', pieces: PIECE('Note du recouvrement', 'NR-2026-31', '2026-12-31'), exerciceId: n, journalId: od.id, depreciationNecessaire: 0,
      });
    }
    if (ctx.B) {
      // En place 400 000, nécessaire 150 000 · reprise de l'écart, 250 000, D 4912 / C 7594 (REPRISE ouverte au SMT).
      await c.geste('Revue de B ramenée à 150 000 (reprise)', 'POST', `/creances-douteuses/${ctx.B.id}/revue`, {
        motif: 'Le client a proposé un échéancier', pieces: PIECE('Échéancier signé', 'ECH-2026-07', '2026-12-15'), exerciceId: n, journalId: od.id, depreciationNecessaire: 150_000,
      });
    }
    await validerJusqua(c, n, '2026-12-31');
    const b = await balance(c, n);
    // Banque · 8 000 000 − 503 900 − 198 100 = 7 298 000.
    R.montant('SMT SYSCOHADA 2026 · banque', 7_298_000, solde(b, BQ));
    R.montant('SMT SYSCOHADA 2026 · 4162 (800 000 + 1 000 000)', 1_800_000, solde(b, '4162'));
    R.montant('SMT SYSCOHADA 2026 · 4912 (−400 000 + 250 000)', -150_000, solde(b, '4912'));
    R.montant('SMT SYSCOHADA 2026 · 7594 reprise', -250_000, solde(b, '7594'));
    R.montant('SMT SYSCOHADA 2026 · 6594 aucune dotation', 0, solde(b, '6594'));
    R.montant('SMT SYSCOHADA 2026 · client A soldé par le reclassement', 0, solde(b, ctx.cliA?.numero ?? 'x'));
    // 1 000 000 + 250 000 − (600 000 + 78 000 + 24 000) = 548 000.
    R.montant('SMT SYSCOHADA 2026 · résultat', 548_000, -(solde(b, '6') + solde(b, '7')));
    // Journal · import 8 800 000 + vente 1 000 000 + reclassement 1 000 000 +
    // paie 798 100 + net 503 900 + reversements 198 100 + reprise 250 000.
    await relireJournal(c, R, 'SMT SYSCOHADA 2026', n, { total: 12_550_100 });
  });

  const clos = await etape(R, 'SMT SYSCOHADA · clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('SMT SYSCOHADA · 2027 non joué');

  await etape(R, 'SMT SYSCOHADA · 2027 · recouvrement, pertes, reprise du solde', async () => {
    if (ctx.B) {
      await c.geste('Recouvrement partiel de B', 'POST', `/creances-douteuses/${ctx.B.id}/recouvrement`, {
        motif: 'Virement reçu', pieces: PIECE('Avis de crédit', 'AC-2027-0315', '2027-03-15'), exerciceId: n1, journalId: bq.id, date: '2027-03-15', montant: 600_000,
      });
    }
    if (ctx.A) {
      // Fiche du compte 65 · D 651 / C 416, au TTC entier (aucune TVA ici).
      await c.geste('Perte sur la créance A', 'POST', `/creances-douteuses/${ctx.A.id}/perte`, {
        motif: 'Liquidation du client clôturée pour insuffisance d’actif', pieces: PIECE('Jugement de clôture', 'TC-MBM-2027-118', '2027-06-25'),
        exerciceId: n1, journalId: od.id, date: '2027-06-30', montant: 1_000_000,
      });
    }
    if (ctx.B) {
      await c.geste('Perte sur le reste de B', 'POST', `/creances-douteuses/${ctx.B.id}/perte`, {
        motif: 'Abandon du solde après transaction', pieces: PIECE('Protocole transactionnel', 'PT-2027-09', '2027-09-28'),
        exerciceId: n1, journalId: od.id, date: '2027-09-30', montant: 200_000,
      });
      await validerJusqua(c, n1, '2027-12-31');
      // En place 150 000, nécessaire 0 · reprise de 150 000 (D 4912 / C 7594).
      await c.geste('Revue de B 2027 · plus rien à déprécier', 'POST', `/creances-douteuses/${ctx.B.id}/revue`, {
        motif: 'Créance éteinte', pieces: PIECE('Protocole transactionnel', 'PT-2027-09', '2027-09-28'), exerciceId: n1, journalId: od.id, depreciationNecessaire: 0,
      });
    }
    await validerJusqua(c, n1, '2027-12-31');
    const b = await balance(c, n1);
    R.montant('SMT SYSCOHADA 2027 · banque (7 298 000 + 600 000)', 7_898_000, solde(b, BQ));
    R.montant('SMT SYSCOHADA 2027 · 4162 éteint (1 800 000 − 600 000 − 1 000 000 − 200 000)', 0, solde(b, '4162'));
    R.montant('SMT SYSCOHADA 2027 · 4912 éteint', 0, solde(b, '4912'));
    R.montant('SMT SYSCOHADA 2027 · 651 pertes (1 000 000 + 200 000)', 1_200_000, solde(b, '651'));
    R.montant('SMT SYSCOHADA 2027 · 7594 reprise', -150_000, solde(b, '7594'));
    R.montant('SMT SYSCOHADA 2027 · résultat (150 000 − 1 200 000)', -1_050_000, -(solde(b, '6') + solde(b, '7')));
  });

  await etape(R, 'SMT SYSCOHADA · clôture 2027 et restitution', async () => {
    R.egal('SMT SYSCOHADA · clôture 2027 (dépréciation reprise, aucune orpheline)', true, await cloturer(c, '2027'));
    await rechargerExercices(c);
    await restitution(c, R, 'SMT SYSCOHADA · restitution');
  });
}

// ==============================================================================
// 2 a. COOPÉRATIVE DISSOUTE (AUSCOOP)
// ==============================================================================

async function cooperative(R) {
  R.scenario = 'transversal · coopérative';
  const c = await nouveauDossier(R, 'Passe transversal · Coopérative des transporteurs du Lomami', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'tr-coop', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const ctx = {};
  const ATTESTATION = 'Coopérative de transport routier de personnes et de marchandises · ni agricole ni de forme civile (statuts, art. 3)';

  await etape(R, 'Coopérative · forme, variante COOP-CA, siège, registre, activité 2026', async () => {
    await c.geste('Forme · société coopérative', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_COOPERATIVE' });
    await c.geste('Variante COOP-CA et registre', 'PATCH', '/dossier/identite', { varianteCooperative: 'COOP_CA', numeroRegistreCooperatives: 'RSC-KBD-2019-C-0042' });
    await c.geste('Siège social', 'PATCH', '/dossier/coordonnees', { adresse: 'Avenue du Lomami 12', ville: 'Kabinda' });
    await ecriture(c, 'Capital des coopérateurs', n, '2026-01-02', 'Parts sociales libérées', [[BQ, 30_000_000, 0], ['10130000', 0, 30_000_000]], { journal: bq });
    ctx.v1 = await ecriture(c, 'Services de transport', n, '2026-03-15', 'Transports du premier trimestre', [[BQ, 20_000_000, 0], ['70610000', 0, 20_000_000]], { journal: bq });
    await ecriture(c, 'Carburant', n, '2026-04-15', 'Gasoil du semestre', [['60420000', 8_000_000, 0], [BQ, 0, 8_000_000]], { journal: bq });
    await validerJusqua(c, n, '2026-06-30');
    await c.geste('Facture de transport du 15/03/2026', 'POST', '/facturation', {
      sens: 'VENTE', numeroSerie: 'COOP-2026-001', dateFacture: '2026-03-15', contrepartieNom: 'Brasserie du Sankuru', contrepartieAdresse: 'Lusambo',
      autresImpotsEtTaxes: 0, ecritureId: ctx.v1?.id,
      lignes: [{ designation: 'Transport de marchandises, premier trimestre', quantite: 1, prixUnitaire: 20_000_000, montantHT: 20_000_000, imposable: false }],
    });
  });

  await etape(R, 'Coopérative · dissolution au 30/06/2026, liquidation de l’art. 223, arrêt', async () => {
    // AUSCOOP art. 196 renvoie aux art. 203 à 241 de l'AUSCGIE à défaut de
    // clauses statutaires · régime de l'art. 223, 1°, déclaré.
    await c.geste('Faits de la dissolution', 'PATCH', '/dossier/identite', {
      dateDissolution: '2026-06-30', liquidateurs: 'M. Kalala Ilunga', dateNominationLiquidateur: '2026-07-15',
      regimeLiquidation: 'ARTICLE_223_1', dateClotureLiquidation: '2027-12-31',
    });
    const r = await c.geste('Arrêt de l’exercice à la dissolution', 'POST', `/exercices/${n}/arreter-a-la-dissolution`, {});
    R.egal('Coopérative · exercice arrêté au 30/06/2026', '2026-06-30', jour(r?.exercice?.dateFin));
    // La clôture déclarée (31/12/2027) fixe la fin de l'exercice de liquidation (exercice.service.ts).
    R.egal('Coopérative · exercice de liquidation du 01/07/2026 au 31/12/2027', ['2026-07-01', '2027-12-31'],
      [jour(r?.exerciceDeLiquidation?.dateDebut), jour(r?.exerciceDeLiquidation?.dateFin)]);
    ctx.lq = r?.exerciceDeLiquidation?.id ?? exerciceDebutant(await listeExercices(c), '2026-07-01')?.id;
  });

  await etape(R, 'Coopérative · factures émises avant et après la dissolution (AUSCOOP art. 183)', async () => {
    await c.geste('Facture datée du 10/05/2026 (avant la dissolution)', 'POST', '/facturation', {
      sens: 'VENTE', numeroSerie: 'COOP-2026-002', dateFacture: '2026-05-10', contrepartieNom: 'Minoterie de Mwene-Ditu',
      autresImpotsEtTaxes: 0, lignes: [{ designation: 'Transport de farine', quantite: 1, prixUnitaire: 1, montantHT: 1, imposable: false }],
    });
    ctx.v2 = ctx.lq && (await ecriture(c, 'Transport pendant la liquidation', ctx.lq, '2026-08-20', 'Transport de liquidation', [[BQ, 5_000_000, 0], ['70610000', 0, 5_000_000]], { journal: bq }));
    await c.geste('Facture datée du 20/08/2026 (pendant la liquidation)', 'POST', '/facturation', {
      sens: 'VENTE', numeroSerie: 'COOP-2026-003', dateFacture: '2026-08-20', contrepartieNom: 'Brasserie du Sankuru',
      autresImpotsEtTaxes: 0, ecritureId: ctx.v2?.id,
      lignes: [{ designation: 'Transport de liquidation', quantite: 1, prixUnitaire: 5_000_000, montantHT: 5_000_000, imposable: false }],
    });
    const f = (await c.lire('Factures de vente', '/facturation?sens=VENTE'))?.factures ?? [];
    const ligne = (num) => f.find((x) => x.numeroSerie === num)?.mentionsSocieteEmetteur?.ligne ?? null;
    // Art. 183 · « société en liquidation » et le liquidateur, en tête, sur les pièces datées de la dissolution ou après.
    R.egal('Coopérative · facture du 20/08/2026 · « Société en liquidation · liquidateur : M. Kalala Ilunga » en tête', true,
      (ligne('COOP-2026-003') ?? '').startsWith('Société en liquidation · liquidateur : M. Kalala Ilunga'));
    R.egal('Coopérative · facture du 10/05/2026 · aucune mention de liquidation (pièce antérieure)', false, /liquidation/i.test(ligne('COOP-2026-002') ?? ''));
    // Art. 19 al. 3, 205 et 268 · expression et sigle, siège, numéro au Registre des Sociétés Coopératives.
    R.egal('Coopérative · mentions de l’AUSCOOP art. 19 · expression, sigle, siège et registre', true,
      /COOP-CA/.test(ligne('COOP-2026-002') ?? '') && /Kabinda/.test(ligne('COOP-2026-002') ?? '') && /RSC-KBD-2019-C-0042/.test(ligne('COOP-2026-002') ?? ''));
  });

  await etape(R, 'Coopérative · première cotisation spéciale (période d’activité)', async () => {
    const rf = await c.lire('Résultat fiscal de la période d’activité', `/fiscalite/resultat-fiscal?exerciceId=${n}`);
    // 20 000 000 − 8 000 000 = 12 000 000 ; 30 % (loi n° 23/053, art. 56) = 3 600 000 ;
    // minimum 1 % × 20 000 000 = 200 000 (art. 57), non retenu.
    R.montant('Coopérative · période d’activité · résultat fiscal', 12_000_000, rf?.resultatFiscal);
    R.montant('Coopérative · période d’activité · première cotisation (30 %)', 3_600_000, rf?.impotDu);
    R.egal('Coopérative · période d’activité · rôle « première cotisation »', 'PREMIERE_COTISATION', rf?.bilansSuccessifs?.role ?? null);
    // La coopérative doit les cotisations (décision du 2026-10-07, point 7), sous attestation (art. 5, 2°).
    await refus(c, R, 'Coopérative · écriture de la première cotisation sans attestation du régime', 'POST', `/fiscalite/exercices/${n}/ecriture-impot`, {}, { statuts: [400], motif: /société coopérative/ });
    const p = await c.geste('Écriture de la première cotisation', 'POST', `/fiscalite/exercices/${n}/ecriture-impot`, { attestationRegime: ATTESTATION });
    R.montant('Coopérative · constat de la première cotisation', 3_600_000, p?.constat?.montantImpot);
    await validerJusqua(c, n, '2026-06-30');
    await c.geste('Réintégration de la première cotisation', 'POST', `/fiscalite/exercices/${n}/retraitements`, { code: 'IMPOT_SUR_LE_RESULTAT', montant: 3_600_000, commentaire: 'Première cotisation spéciale au 891' });
    const b = await balance(c, n);
    R.montant('Coopérative · exercice arrêté · banque (30 000 000 + 20 000 000 − 8 000 000)', 42_000_000, solde(b, BQ));
    R.montant('Coopérative · exercice arrêté · 441 première cotisation due', -3_600_000, solde(b, '441'));
    R.montant('Coopérative · exercice arrêté · résultat net (12 000 000 − 3 600 000)', 8_400_000, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));
  });

  await etape(R, 'Coopérative · planning de l’exercice arrêté (AUSCOOP)', async () => {
    const pa = await c.lire('Planning de l’exercice arrêté', `/exercices/${n}/planning-cloture`);
    const cot = jalonDe(pa, /cotisation spéciale \(période d’activité\)/);
    // LPF art. 16 · « dans le mois » de date à date · 30/06/2026 → 30/07/2026, un jeudi.
    R.egal('Coopérative · première cotisation à déclarer le 30/07/2026', '2026-07-30', jour(cot?.echeance));
    // Fin de mois · la lecture du CPC art. 195 finirait le 31/07/2026 (autreLectureDuMois).
    R.egal('Coopérative · l’autre lecture du mois (31/07/2026) est dite', true, /31\/07\/2026/.test(cot?.detail ?? ''));
    R.egal('Coopérative · réserve de la coopérative agricole de forme civile dite', true, /forme civile/.test(cot?.detail ?? ''));
    const bal = jalonDe(pa, /^Bilan avant liquidation$/);
    R.egal('Coopérative · bilan avant liquidation, sans délai, sous l’AUSCOOP art. 180 et 183', [true, true],
      [bal?.sansDelai === true, /AUSCOOP, art\. 180 et 183/.test(bal?.source ?? '')]);
    R.egal('Coopérative · aucune publication de la nomination (art. 266 hors des art. 203 à 241)', null, jalonDe(pa, /Publication de la nomination/));
  });

  if (!ctx.lq) return R.note('Coopérative · exercice de liquidation absent, la suite n’est pas jouée');
  const lq = ctx.lq;

  await etape(R, 'Coopérative · clôture de l’exercice arrêté', async () => {
    const r = await c.geste('Clôture de l’exercice arrêté au 30/06/2026', 'POST', `/exercices/${n}/cloturer`, {});
    R.egal('Coopérative · exercice arrêté clôturé', true, r !== null);
  });

  await etape(R, 'Coopérative · planning de la liquidation (AUSCOOP art. 191 à 196)', async () => {
    const pl = await c.lire('Planning de la liquidation', `/exercices/${lq}/planning-cloture`);
    const rapport = jalonDe(pl, /Rapport du liquidateur/);
    // Art. 228 par l'AUSCOOP art. 196 · six mois de la nomination (15/07/2026) → 15/01/2027.
    R.egal('Coopérative · rapport du liquidateur au 15/01/2027, AUSCOOP art. 196', ['2027-01-15', true, null],
      [jour(rapport?.echeance), /AUSCOOP, art\. 196/.test(rapport?.source ?? ''), rapport?.sanction ?? null]);
    // Situation au 31/12/2026 (seul 31 décembre strictement entre la dissolution et la clôture) · trois et six mois.
    const etats = jalonsDe(pl, /États financiers annuels et rapport écrit/);
    const assemblees = jalonsDe(pl, /Assemblée des associés sur les états annuels/);
    R.egal('Coopérative · états annuels de liquidation · un seul jeu, au 31/03/2027', ['2027-03-31'], etats.map((j) => jour(j.echeance)));
    R.egal('Coopérative · assemblée sur les états annuels · une seule, au 30/06/2027', ['2027-06-30'], assemblees.map((j) => jour(j.echeance)));
    R.egal('Coopérative · états et assemblée sous l’AUSCOOP art. 196, sans sanction de l’AUSCGIE', [true, true, null, null],
      [/AUSCOOP, art\. 196/.test(etats[0]?.source ?? ''), /AUSCOOP, art\. 196/.test(assemblees[0]?.source ?? ''), etats[0]?.sanction ?? null, assemblees[0]?.sanction ?? null]);
    const clot = jalonDe(pl, /^Clôture de la liquidation$/);
    // AUSCOOP art. 191 · trois ans de la dissolution → 30/06/2029 ; clôture déclarée le 31/12/2027, passée au 15/02/2028.
    R.egal('Coopérative · clôture de la liquidation · AUSCOOP art. 191, 30/06/2029, « Liquidation clôturée »', ['AUSCOOP, art. 191', '2029-06-30', true],
      [clot?.source ?? null, jour(clot?.echeance), /Liquidation clôturée/.test(clot?.observation?.libelle ?? '')]);
    const defin = jalonDe(pl, /Comptes définitifs/);
    R.egal('Coopérative · comptes définitifs · AUSCOOP art. 192 et 193, sans sanction', ['AUSCOOP, art. 192 et 193', null], [defin?.source ?? null, defin?.sanction ?? null]);
    R.egal('Coopérative · liquidation · aucune publication de la nomination', null, jalonDe(pl, /Publication de la nomination/));
    // Seconde cotisation · un mois de la clôture déclarée · 31/12/2027 → 31/01/2028, un lundi.
    R.egal('Coopérative · seconde cotisation à déclarer le 31/01/2028', '2028-01-31', jour(jalonDe(pl, /dernier bilan de liquidation/)?.echeance));
    const ech = await c.lire('Échéancier au 01/07/2026', `/retenues/echeancier?exerciceId=${lq}&dateReference=2026-07-01`);
    R.egal('Coopérative · échéancier · deux cotisations (30/07/2026, 31/01/2028)', ['2026-07-30', '2028-01-31'],
      [jour(echeanceDe(ech, 'cotisationSpecialeActivite')?.date), jour(echeanceDe(ech, 'cotisationSpecialeLiquidation')?.date)]);
  });

  await etape(R, 'Coopérative · opérations de liquidation et seconde cotisation', async () => {
    await ecriture(c, 'Paiement de la première cotisation', lq, '2026-07-30', 'Cotisation spéciale de la période d’activité', [['44100000', 3_600_000, 0], [BQ, 0, 3_600_000]], { journal: bq });
    await ecriture(c, 'Honoraires du liquidateur', lq, '2027-06-30', 'Honoraires de M. Kalala Ilunga', [['63240000', 2_000_000, 0], [BQ, 0, 2_000_000]], { journal: bq });
    await validerJusqua(c, lq, '2027-12-31');
    const rf = await c.lire('Résultat fiscal de la liquidation', `/fiscalite/resultat-fiscal?exerciceId=${lq}`);
    const t = rf?.bilansSuccessifs?.totalisation;
    // Une assiette, deux cotisations (art. 12 al. 4) · 12 000 000 + (5 000 000 − 2 000 000) = 15 000 000 ;
    // impôt 30 % = 4 500 000 ; minimum 1 % × 25 000 000 = 250 000 ; seconde = 4 500 000 − 3 600 000 = 900 000.
    R.egal('Coopérative · liquidation · rôle « seconde cotisation »', 'SECONDE_COTISATION', rf?.bilansSuccessifs?.role ?? null);
    R.montant('Coopérative · totalisation · résultat de la période d’activité', 12_000_000, t?.periodeActivite?.resultatFiscalAvantReport);
    R.montant('Coopérative · totalisation · résultat de la liquidation (5 000 000 − 2 000 000)', 3_000_000, t?.liquidation?.resultatFiscalAvantReport);
    R.montant('Coopérative · totalisation · assiette totale', 15_000_000, t?.total);
    R.montant('Coopérative · totalisation · chiffre d’affaires total', 25_000_000, t?.chiffreAffaires);
    R.montant('Coopérative · totalisation · impôt sur le total', 4_500_000, t?.impotTotal);
    R.montant('Coopérative · totalisation · minimum (1 %)', 250_000, t?.impotMinimum);
    R.montant('Coopérative · totalisation · seconde cotisation', 900_000, t?.secondeCotisation ?? t?.cotisationDeLExercice);
    const p = await c.geste('Écriture de la seconde cotisation', 'POST', `/fiscalite/exercices/${lq}/ecriture-impot`, { attestationRegime: ATTESTATION });
    R.montant('Coopérative · constat de la seconde cotisation', 900_000, p?.constat?.montantImpot);
    await validerJusqua(c, lq, '2027-12-31');
    await c.geste('Réintégration de la seconde cotisation', 'POST', `/fiscalite/exercices/${lq}/retraitements`, { code: 'IMPOT_SUR_LE_RESULTAT', montant: 900_000, commentaire: 'Seconde cotisation spéciale au 891' });
    const b = await balance(c, lq);
    // 42 000 000 + 5 000 000 − 3 600 000 − 2 000 000 = 41 400 000.
    R.montant('Coopérative · liquidation · banque', 41_400_000, solde(b, BQ));
    R.montant('Coopérative · liquidation · 441 seconde cotisation due', -900_000, solde(b, '441'));
    R.montant('Coopérative · liquidation · résultat (3 000 000 − 900 000)', 2_100_000, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));
  });

  await etape(R, 'Coopérative · clôture de la liquidation à la date déclarée', async () => {
    const r = await c.geste('Clôture de l’exercice de liquidation', 'POST', `/exercices/${lq}/cloturer`, {});
    R.egal('Coopérative · liquidation clôturée au 31/12/2027 (clôture déclarée)', true, r !== null);
    const ex = await listeExercices(c);
    R.egal('Coopérative · aucun exercice ne suit la liquidation', null, ex.find((e) => jour(e.dateDebut) === '2028-01-01') ?? null);
  });
}

// ==============================================================================
// 2 b. SOCIÉTÉ EN PROCÉDURE COLLECTIVE (AUPCAP)
// ==============================================================================

async function procedureCollective(R) {
  R.scenario = 'transversal · procédure collective';
  const c = await nouveauDossier(R, 'Passe transversal · Transports du Kwango SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'tr-pcoll', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ctx = {};

  await etape(R, 'Procédure collective · SARL, mentions de l’art. 17, activité 2026, clôture', async () => {
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await c.geste('Siège et capital', 'PATCH', '/dossier/coordonnees', { adresse: 'Route de Kenge 7', ville: 'Bandundu', capitalSocial: 10_000_000 });
    await c.geste('RCCM', 'PATCH', '/dossier/identite', { rccm: 'CD/BDD/RCCM/24-B-0077', numeroImpot: 'A2400077K' });
    await ecriture(c, 'Capital libéré', n, '2026-01-02', 'Apport des associés', [[BQ, 10_000_000, 0], ['10130000', 0, 10_000_000]], { journal: bq });
    await ecriture(c, 'Transports 2026', n, '2026-05-10', 'Transports de l’exercice', [[BQ, 30_000_000, 0], ['70610000', 0, 30_000_000]], { journal: bq });
    await ecriture(c, 'Carburant 2026', n, '2026-06-10', 'Gasoil 2026', [['60420000', 10_000_000, 0], [BQ, 0, 10_000_000]], { journal: bq });
    await validerJusqua(c, n, '2026-12-31');
    R.egal('Procédure collective · clôture 2026', true, await cloturer(c, '2026'));
  });
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!n1) return R.note('Procédure collective · 2027 absent, la suite n’est pas jouée');

  await etape(R, 'Procédure collective · 2027, dissolution par la liquidation des biens, arrêt', async () => {
    await ecriture(c, 'Transports 2027', n1, '2027-02-15', 'Transports du premier trimestre', [[BQ, 8_000_000, 0], ['70610000', 0, 8_000_000]], { journal: bq });
    await ecriture(c, 'Carburant 2027', n1, '2027-03-10', 'Gasoil du trimestre', [['60420000', 3_000_000, 0], [BQ, 0, 3_000_000]], { journal: bq });
    await validerJusqua(c, n1, '2027-03-31');
    // AUSCGIE art. 200, 6° (jugement de liquidation des biens) ; art. 203 al. 2 et AUPCAP art. 53.
    await c.geste('Faits · liquidation des biens prononcée le 31/03/2027', 'PATCH', '/dossier/identite', {
      dateDissolution: '2027-03-31', liquidateurs: 'Me Mbuyi Kanku, syndic', dateNominationLiquidateur: '2027-03-31',
      regimeLiquidation: 'PROCEDURE_COLLECTIVE', associeUniquePersonneMorale: 'NON',
    });
    const r = await c.geste('Arrêt de l’exercice à la dissolution', 'POST', `/exercices/${n1}/arreter-a-la-dissolution`, {});
    R.egal('Procédure collective · exercice arrêté au 31/03/2027', '2027-03-31', jour(r?.exercice?.dateFin));
    // Sans clôture déclarée, la fin d'origine (31/12/2027).
    R.egal('Procédure collective · exercice de liquidation du 01/04/2027 au 31/12/2027', ['2027-04-01', '2027-12-31'],
      [jour(r?.exerciceDeLiquidation?.dateDebut), jour(r?.exerciceDeLiquidation?.dateFin)]);
    ctx.lq = r?.exerciceDeLiquidation?.id ?? exerciceDebutant(await listeExercices(c), '2027-04-01')?.id;
  });

  await etape(R, 'Procédure collective · planning · art. 203 al. 2 et cotisations', async () => {
    const pa = await c.lire('Planning de l’exercice arrêté', `/exercices/${n1}/planning-cloture`);
    const pc = jalonDe(pa, /Liquidation dans une procédure collective/);
    R.egal('Procédure collective · jalon « hors des art. 203 à 241 », AUSCGIE art. 203 al. 2 et AUPCAP art. 53', ['AUSCGIE, art. 203 al. 2 ; AUPCAP, art. 53', true],
      [pc?.source ?? null, pc?.observation?.satisfait ?? null]);
    R.egal('Procédure collective · ni bilan avant liquidation ni publication du liquidateur (chapitre écarté)', [null, null],
      [jalonDe(pa, /^Bilan avant liquidation$/), jalonDe(pa, /Publication de la nomination/)]);
    const cot = jalonDe(pa, /cotisation spéciale \(période d’activité\)/);
    // 31/03/2027 → 30/04/2027 (fin de mois · mois d'arrivée à trente jours, aucune autre lecture), un vendredi.
    R.egal('Procédure collective · première cotisation à déclarer le 30/04/2027', '2027-04-30', jour(cot?.echeance));
    R.egal('Procédure collective · la lecture du CPC art. 195 coïncide · non dite', false, /Code de procédure civile/.test(cot?.detail ?? ''));
    if (ctx.lq) {
      const pl = await c.lire('Planning de la liquidation', `/exercices/${ctx.lq}/planning-cloture`);
      const sec = jalonDe(pl, /dernier bilan de liquidation/);
      R.egal('Procédure collective · seconde cotisation · échéance non calculée (clôture non déclarée)', [null, true],
        [sec ? jour(sec.echeance) : 'absent', /Échéance non calculée/.test(sec?.detail ?? '')]);
      R.egal('Procédure collective · aucun jalon de clôture de la liquidation (AUSCGIE art. 216 écarté)', null, jalonDe(pl, /^Clôture de la liquidation$/));
      const ech = await c.lire('Échéancier au 01/04/2027', `/retenues/echeancier?exerciceId=${ctx.lq}&dateReference=2027-04-01`);
      R.egal('Procédure collective · échéancier · première cotisation 30/04/2027, seconde non datée', ['2027-04-30', null],
        [jour(echeanceDe(ech, 'cotisationSpecialeActivite')?.date), echeanceDe(ech, 'cotisationSpecialeLiquidation')]);
    }
  });

  await etape(R, 'Procédure collective · première cotisation et mentions des pièces', async () => {
    const rf = await c.lire('Résultat fiscal de la période d’activité', `/fiscalite/resultat-fiscal?exerciceId=${n1}`);
    // 8 000 000 − 3 000 000 = 5 000 000 ; 30 % = 1 500 000 ; minimum 1 % × 8 000 000 = 80 000.
    R.montant('Procédure collective · résultat fiscal de la période d’activité', 5_000_000, rf?.resultatFiscal);
    R.montant('Procédure collective · première cotisation (30 %)', 1_500_000, rf?.impotDu);
    R.egal('Procédure collective · rôle « première cotisation » (la procédure collective doit les cotisations)', 'PREMIERE_COTISATION', rf?.bilansSuccessifs?.role ?? null);
    const p = await c.geste('Écriture de la première cotisation', 'POST', `/fiscalite/exercices/${n1}/ecriture-impot`, {});
    R.montant('Procédure collective · constat de la première cotisation', 1_500_000, p?.constat?.montantImpot);
    await validerJusqua(c, n1, '2027-03-31');
    await c.geste('Réintégration de la première cotisation', 'POST', `/fiscalite/exercices/${n1}/retraitements`, { code: 'IMPOT_SUR_LE_RESULTAT', montant: 1_500_000, commentaire: 'Première cotisation au 891' });
    await c.geste('Facture du syndic du 10/05/2027', 'POST', '/facturation', {
      sens: 'VENTE', numeroSerie: 'TKW-2027-005', dateFacture: '2027-05-10', contrepartieNom: 'Huilerie de Kikwit', autresImpotsEtTaxes: 0,
      lignes: [{ designation: 'Cession de pneus de réserve', quantite: 4, prixUnitaire: 250_000, montantHT: 1_000_000, imposable: false }],
    });
    const f = (await c.lire('Factures de vente', '/facturation?sens=VENTE'))?.factures ?? [];
    const ligne = f.find((x) => x.numeroSerie === 'TKW-2027-005')?.mentionsSocieteEmetteur?.ligne ?? '';
    // Art. 203 al. 2 écarte le chapitre qui porte l'art. 204 · aucune mention « société en liquidation » (mentions-societe.ts).
    R.egal('Procédure collective · facture postérieure · aucune mention « société en liquidation »', false, /liquidation/i.test(ligne));
    R.egal('Procédure collective · facture postérieure · ligne de l’art. 17 (capital, siège, RCCM)', true, /capital/.test(ligne) && /RCCM/.test(ligne));
  });

  await etape(R, 'Procédure collective · clôtures', async () => {
    const r = await c.geste('Clôture de l’exercice arrêté au 31/03/2027', 'POST', `/exercices/${n1}/cloturer`, {});
    R.egal('Procédure collective · exercice arrêté clôturé', true, r !== null);
    // AUDCIF art. 7 al. 4 · la liquidation ne se clôture qu'à la clôture déclarée · ici non déclarée.
    if (ctx.lq) await refus(c, R, 'Procédure collective · clôture de la liquidation sans clôture déclarée', 'POST', `/exercices/${ctx.lq}/cloturer`, {}, { statuts: [400, 409] });
  });
}

// ==============================================================================
// 3. MINIÈRE DU PORTEFEUILLE · FICHE R2 ET DIVIDENDE APRÈS DISSOLUTION
// ==============================================================================

/** La Fiche R2 de la liasse, relue · { code → [valeurs dans l'ordre] } (deux ZQ). */
async function ficheR2(c, R, lib, exerciceId) {
  const r = await c.lire(`Liasse ${lib}`, `/exports/etats-financiers-syscohada/liasse-complete?exerciceId=${exerciceId}`);
  if (!r?.contenu) return null;
  const wb = await lireClasseur(r.contenu);
  const ws = wb.getWorksheet('Fiche R2');
  if (!ws) { R.note(`${lib} · liasse sans feuille « Fiche R2 »`); return null; }
  const m = {};
  for (let ligne = 10; ligne <= 18; ligne++) {
    const code = valeur(ws.getCell(ligne, 1).value);
    const v = valeur(ws.getCell(ligne, 7).value);
    if (typeof code === 'string') (m[code] ??= []).push(v === null || v === undefined ? '' : String(v));
  }
  return m;
}

async function miniere(R) {
  R.scenario = 'transversal · minière R2';
  const c = await nouveauDossier(R, 'Passe transversal · Minière de Kipushi SA', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'tr-mine', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ctx = {};
  const ZK_PROPOSE = 'Non renseigné · la NOTE 36 donne 00 (10 avec agrément prioritaire) · SA à participation publique, entreprise du portefeuille de l’État déclarée';

  await etape(R, 'Minière · SA du portefeuille, secteur minier, 60 % à l’État, activité 2026', async () => {
    await c.geste('Forme SA', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });
    await c.geste('Portefeuille de l’État, secteur minier, quote-part', 'PATCH', '/dossier/identite', {
      modeAdministrationSa: 'CONSEIL_ADMINISTRATION', entreprisePortefeuilleEtat: 'OUI', portefeuilleSecteurMinier: 'OUI',
      quotePartEtatCapital: 60, sourceQuotePartEtat: 'Statuts coordonnés du 12 mars 2019, art. 6',
    });
    await ecriture(c, 'Capital', n, '2026-01-02', 'Capital libéré', [[BQ, 100_000_000, 0], ['10130000', 0, 100_000_000]], { journal: bq });
    await ecriture(c, 'Ventes de cuivre 2026', n, '2026-04-10', 'Ventes 2026', [[BQ, 50_000_000, 0], ['70110000', 0, 50_000_000]], { journal: bq });
    await ecriture(c, 'Achats 2026', n, '2026-05-10', 'Réactifs et pièces 2026', [['60110000', 20_000_000, 0], [BQ, 0, 20_000_000]], { journal: bq });
    await validerJusqua(c, n, '2026-12-31');
    // Bénéfice net comptable 30 000 000 × 60 % = 18 000 000, PROVISOIRE tant que
    // l'exercice n'est ni clôturé ni arrêté (portefeuille-etat.ts) ; 15 mai 2027.
    const pl = await c.lire('Planning 2026 (ouvert)', `/exercices/${n}/planning-cloture`);
    const d = jalonDe(pl, /^Déclaration du dividende prioritaire de l’État$/);
    R.egal('Minière 2026 ouvert · dividende prioritaire · 15/05/2027, 18 000 000 provisoire', ['2027-05-15', 18_000_000, true],
      [jour(d?.echeance), d?.montant ?? null, d?.montantProvisoire === true]);
  });

  await etape(R, 'Minière · Fiche R2 2026 · faits déclarés, propositions ZQ et ZK', async () => {
    await c.geste('Fiche R2 2026 · établissements et première année', 'POST', `/exercices/${n}/fiche-r2`, {
      nombreEtablissementsPays: 3, nombreEtablissementsHorsPays: 0, premiereAnneeExercicePays: 2015,
    });
    const f = await ficheR2(c, R, 'Minière 2026', n);
    // Siège compté en ZN ; ZQ « public » PROPOSÉ au-delà de 50 % ; ZK 00 proposé à une SA du portefeuille.
    R.egal('Minière 2026 · ZN, ZO, ZP déclarés', [['3'], ['0'], ['2015']], [f?.ZN ?? null, f?.ZO ?? null, f?.ZP ?? null]);
    R.egal('Minière 2026 · ZQ · contrôle public PROPOSÉ (60 %), privé national non renseigné', ['Non renseignée · contrôle public proposé (quote-part de l’État déclarée · 60 %)', 'Non renseignée'], f?.ZQ ?? null);
    R.egal('Minière 2026 · ZS non renseignée', ['Non renseignée'], f?.ZS ?? null);
    R.egal('Minière 2026 · ZK · 00 proposé à la SA du portefeuille', [ZK_PROPOSE], f?.ZK ?? null);
    await c.geste('Fiche R2 2026 · contrôle public déclaré', 'POST', `/exercices/${n}/fiche-r2`, {
      nombreEtablissementsPays: 3, nombreEtablissementsHorsPays: 0, premiereAnneeExercicePays: 2015, controleEntreprise: 'PUBLIC',
    });
    const g = await ficheR2(c, R, 'Minière 2026 (contrôle déclaré)', n);
    R.egal('Minière 2026 · contrôle PUBLIC déclaré · X au premier ZQ, vide au second et au ZS', [['X', ''], ['']], [g?.ZQ ?? null, g?.ZS ?? null]);
  });

  await etape(R, 'Minière · clôture 2026, dividende devenu définitif', async () => {
    R.egal('Minière · clôture 2026', true, await cloturer(c, '2026'));
    const pl = await c.lire('Planning 2026 (clôturé)', `/exercices/${n}/planning-cloture`);
    const d = jalonDe(pl, /^Déclaration du dividende prioritaire de l’État$/);
    R.egal('Minière 2026 clôturé · dividende 18 000 000, plus provisoire', [18_000_000, false], [d?.montant ?? null, d?.montantProvisoire === true]);
  });
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!n1) return R.note('Minière · 2027 absent');

  await etape(R, 'Minière · 2027 · R2 non déclarée, dissolution, exercice de liquidation sans dividende', async () => {
    const f = await ficheR2(c, R, 'Minière 2027', n1);
    // Déclarées PAR EXERCICE · rien n'est repris de 2026.
    R.egal('Minière 2027 · ZN, ZO, ZP « Non renseignée » (rien de 2026 n’est repris)', [['Non renseignée'], ['Non renseignée'], ['Non renseignée']], [f?.ZN ?? null, f?.ZO ?? null, f?.ZP ?? null]);
    R.egal('Minière 2027 · ZQ public proposé de nouveau', 'Non renseignée · contrôle public proposé (quote-part de l’État déclarée · 60 %)', f?.ZQ?.[0] ?? null);
    await ecriture(c, 'Ventes de cuivre 2027', n1, '2027-03-10', 'Ventes 2027', [[BQ, 10_000_000, 0], ['70110000', 0, 10_000_000]], { journal: bq });
    await validerJusqua(c, n1, '2027-06-30');
    await c.geste('Faits de la dissolution', 'PATCH', '/dossier/identite', {
      dateDissolution: '2027-06-30', liquidateurs: 'Me Ilunga Kasongo', dateNominationLiquidateur: '2027-06-30',
      regimeLiquidation: 'AMIABLE_STATUTAIRE', associeUniquePersonneMorale: 'NON', dateClotureLiquidation: '2027-12-31',
    });
    const r = await c.geste('Arrêt de l’exercice 2027 à la dissolution', 'POST', `/exercices/${n1}/arreter-a-la-dissolution`, {});
    ctx.lq = r?.exerciceDeLiquidation?.id ?? exerciceDebutant(await listeExercices(c), '2027-07-01')?.id;
    if (!ctx.lq) return R.note('Minière · exercice de liquidation absent');
    const pl = await c.lire('Planning de la liquidation', `/exercices/${ctx.lq}/planning-cloture`);
    // Arrêté du 10 décembre 2025, art. 1er (points 2 et 4) · après la dissolution, un boni de liquidation, pas un dividende.
    const d = jalonDe(pl, /Dividende prioritaire de l’État · société dissoute/);
    R.egal('Minière · liquidation · « société dissoute », sans délai ni montant', [true, null, undefined], [d?.sansDelai === true, d ? jour(d.echeance) : 'absent', d?.montant]);
    R.egal('Minière · liquidation · aucune déclaration de dividende prioritaire', null, jalonDe(pl, /^Déclaration du dividende prioritaire de l’État$/));
    R.egal('Minière · liquidation · aucun paiement de dividende prioritaire', null, jalonDe(pl, /^Paiement du dividende prioritaire de l’État$/));
  });
}

// ==============================================================================
// 4 et 5. FACTURES EN DOLLARS, RÈGLEMENTS, ÉCART RÉALISÉ, RÉÉVALUATION · PIÈCES IMPRIMÉES
// ==============================================================================

async function devises(R) {
  R.scenario = 'transversal · dollars';
  const c = await nouveauDossier(R, 'Passe transversal · Lubumbashi Négoce International SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'tr-usd', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const ven = c.journal('VEN') ?? od;
  const ach = c.journal('ACH') ?? od;
  const ctx = {};
  const enUsd = (usd, cours) => ({ deviseId: ctx.usd?.id, montantDevise: usd, coursApplique: cours });

  await etape(R, 'Dollars · dossier, dollar et cours, tiers', async () => {
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await c.geste('Siège et capital (30 000 000)', 'PATCH', '/dossier/coordonnees', { adresse: 'Avenue Mama Yemo 45', ville: 'Lubumbashi', capitalSocial: 30_000_000 });
    await c.geste('RCCM et numéro d’impôt', 'PATCH', '/dossier/identite', { rccm: 'CD/LSH/RCCM/26-B-0101', numeroImpot: 'A2600101X' });
    const liste = (await c.lire('Devises', '/devises')) ?? [];
    ctx.usd = (Array.isArray(liste) ? liste : liste.devises ?? []).find((d) => d.code === 'USD')
      ?? (await c.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
    for (const [date, cours] of [['2026-03-02', 2_800], ['2026-04-15', 2_850], ['2026-05-10', 2_900], ['2026-06-20', 2_760], ['2026-09-01', 2_820],
      ['2026-10-15', 2_880], ['2026-11-20', 2_880], ['2026-12-31', 2_900], ['2027-02-10', 2_950], ['2027-03-20', 2_950], ['2027-12-31', 3_000]]) {
      await c.geste(`Cours USD du ${date}`, 'POST', `/devises/${ctx.usd?.id}/cours`, { date, cours, source: 'Banque centrale du Congo (banc transversal)' });
    }
    ctx.cli = await tiers(c, 'CLIENT', 'CLI-USD', 'Copper Trading Ltd');
    ctx.frs = await tiers(c, 'FOURNISSEUR', 'FRS-USD', 'Johannesburg Mining Supplies');
    await ecriture(c, 'Capital libéré', n, '2026-01-02', 'Apport des associés', [[BQ, 50_000_000, 0], ['10130000', 0, 50_000_000]], { journal: bq });
  });
  if (!ctx.cli || !ctx.frs || !ctx.usd) return R.note('Dollars · tiers ou devise absents, la suite n’est pas jouée');
  const { cli, frs } = ctx;

  await etape(R, 'Dollars · facture de vente V1 de 1 000 USD (écriture et facture)', async () => {
    // 1 000 USD au cours du 02/03/2026 (2 800) = 2 800 000 FC (AUDCIF art. 52).
    ctx.V1 = await ecriture(c, 'Vente V1 en dollars', n, '2026-03-02', 'Facture FV-USD-001', [[cli.numero, 2_800_000, 0, enUsd(1_000, 2_800)], ['70110000', 0, 2_800_000]], { journal: ven });
    ctx.fV1 = await c.geste('Facture de vente FV-USD-001', 'POST', '/facturation', {
      sens: 'VENTE', numeroSerie: 'FV-USD-001', dateFacture: '2026-03-02', tiersId: cli.id, contrepartieAdresse: 'Plot 12, Kitwe, Zambie',
      autresImpotsEtTaxes: 0, ecritureId: ctx.V1?.id,
      lignes: [{ designation: 'Cathodes de cuivre · 1 000 USD au cours de 2 800', quantite: 1, prixUnitaire: 2_800_000, montantHT: 2_800_000, imposable: false }],
    });
    // La facture ne porte aucune monnaie (facture.dto.ts) · ses montants sont des francs.
    R.egal('Dollars · la facture enregistrée ne porte aucun champ de devise', [], Object.keys(ctx.fV1 ?? {}).filter((k) => /devise|cours/i.test(k)));
    await validerJusqua(c, n, '2026-03-02');
  });

  await etape(R, 'Dollars · règlement partiel de V1 puis solde, dans sa devise', async () => {
    const lV1 = ligneDe(c, ctx.V1, cli.numero);
    if (!lV1) return R.note('Dollars · ligne de V1 introuvable');
    // 400 USD au 15/04/2026 (2 850) · payé 1 140 000 ; tiers soldé au coût historique
    // 400 / 1 000 × 2 800 000 = 1 120 000 ; gain réalisé 20 000 au 756 (art. 55 ; Titre VIII ch. 22 § 2.3).
    await c.geste('Règlement partiel de V1 (400 USD)', 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: n, journalId: bq.id, date: '2026-04-15', reglements: [{ compteId: cli.compteId, ligneIds: [lV1.id], montantDevise: 400, coursReglement: 2_850 }],
    });
    // 600 USD au 10/05/2026 (2 900) · payé 1 740 000 contre 1 680 000 · gain 60 000.
    await c.geste('Solde de V1 (600 USD)', 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: n, journalId: bq.id, date: '2026-05-10', reglements: [{ compteId: cli.compteId, ligneIds: [lV1.id], montantDevise: 600, coursReglement: 2_900 }],
    });
    await validerJusqua(c, n, '2026-05-10');
    const b = await balance(c, n);
    R.montant('Dollars · client soldé au coût historique après V1 (2 800 000 − 1 120 000 − 1 680 000)', 0, solde(b, cli.numero));
    R.montant('Dollars · 756 gains de change réalisés (20 000 + 60 000)', -80_000, solde(b, '756'));
    R.montant('Dollars · banque après V1 (50 000 000 + 1 140 000 + 1 740 000)', 52_880_000, solde(b, BQ));
    const { lettrages } = await lignesLettrage(c, cli.compteId);
    R.egal('Dollars · V1 lettrée en un groupe soldé', true, lettrages.some((g) => g.statut === 'SOLDE' || g.statut === 'TOTAL' || Math.abs(Number(g.solde ?? 1)) < 0.005));
  });

  await etape(R, 'Dollars · facture d’achat A1 de 2 000 USD, payée à un autre cours, écart réalisé passé au clic', async () => {
    // 2 000 USD au 20/06/2026 (2 760) = 5 520 000.
    ctx.A1 = await ecriture(c, 'Achat A1 en dollars', n, '2026-06-20', 'Facture JMS-7781', [['60110000', 5_520_000, 0], [frs.numero, 0, 5_520_000, enUsd(2_000, 2_760)]], { journal: ach });
    await c.geste('Facture d’achat JMS-7781', 'POST', '/facturation', {
      sens: 'ACHAT', numeroSerie: 'JMS-7781', dateFacture: '2026-06-20', dateReception: '2026-06-22', tiersId: frs.id, contrepartieAdresse: 'Johannesburg, Afrique du Sud',
      autresImpotsEtTaxes: 0, ecritureId: ctx.A1?.id,
      lignes: [{ designation: 'Pièces de concasseur · 2 000 USD au cours de 2 760', quantite: 1, prixUnitaire: 5_520_000, montantHT: 5_520_000, imposable: false }],
    });
    // Payée à la main au 01/09/2026 (2 820) · 5 640 000 FC pour les mêmes 2 000 USD.
    ctx.P1 = await ecriture(c, 'Paiement de A1 en dollars', n, '2026-09-01', 'Virement JMS-7781', [[frs.numero, 5_640_000, 0, enUsd(2_000, 2_820)], [BQ, 0, 5_640_000]], { journal: bq });
    await validerJusqua(c, n, '2026-09-01');
    const l1 = ligneDe(c, ctx.A1, frs.numero);
    const l2 = ligneDe(c, ctx.P1, frs.numero);
    if (!l1 || !l2) return R.note('Dollars · lignes de A1 introuvables');
    // Soldées en devise (2 000 contre 2 000) mais pas en francs · le lettrage total est refusé, l'écart nommé.
    await refus(c, R, 'Dollars · lettrage total de A1 soldé en devise et non en francs', 'POST', `/comptes/${frs.compteId}/lettrage`, { ligneIds: [l1.id, l2.id] },
      { statuts: [400], motif: /soldées dans leur devise/ });
    const g = await lettrer(c, frs.numero, [l1.id, l2.id], true);
    R.egal('Dollars · A1 lettrée en partiel', 'PARTIEL', g?.statut ?? null);
    // La réponse du lettrage ne porte que la lettre · le groupe se lit sur les lignes.
    const { lignes } = await lignesLettrage(c, frs.compteId);
    ctx.gA1 = lignes.find((l) => l.id === l1.id)?.lettrageId ?? null;
    if (!ctx.gA1) return R.note('Dollars · groupe de A1 non lu');
    const prop = await c.lire('Écart de change proposé pour A1', `/comptes/${frs.compteId}/lettrage/${ctx.gA1}/ecart-change`);
    // Dette réglée 5 640 000 pour 5 520 000 inscrits · perte réalisée 120 000, au 656 (fiche du compte 656 ; ch. 22 § 2.3).
    R.montant('Dollars · écart proposé pour A1 (5 640 000 − 5 520 000)', 120_000, prop?.ecart);
    R.egal('Dollars · écart de A1 · une perte, au 65600000', ['PERTE', '65600000'], [prop?.sens ?? null, prop?.comptePrescrit?.numero ?? prop?.numeroPrescrit ?? null]);
  });

  await etape(R, 'Dollars · A2 et V2 ouvertes à la clôture, V3 passée depuis le facturier', async () => {
    // 1 500 USD au 15/10/2026 (2 880) = 4 320 000 ; 500 USD au même cours = 1 440 000.
    await ecriture(c, 'Achat A2 en dollars', n, '2026-10-15', 'Facture JMS-8120', [['60110000', 4_320_000, 0], [frs.numero, 0, 4_320_000, enUsd(1_500, 2_880)]], { journal: ach });
    ctx.V2 = await ecriture(c, 'Vente V2 en dollars', n, '2026-10-15', 'Facture FV-USD-002', [[cli.numero, 1_440_000, 0, enUsd(500, 2_880)], ['70110000', 0, 1_440_000]], { journal: ven });
    // V3 · la facture du facturier (300 USD au cours de 2 880 = 864 000) et son écriture proposée.
    const f3 = await c.geste('Facture de vente FV-USD-003 (facturier)', 'POST', '/facturation', {
      sens: 'VENTE', numeroSerie: 'FV-USD-003', dateFacture: '2026-11-20', tiersId: cli.id, contrepartieAdresse: 'Plot 12, Kitwe, Zambie', autresImpotsEtTaxes: 0,
      lignes: [{ designation: 'Cathodes de cuivre · 300 USD au cours de 2 880', quantite: 1, prixUnitaire: 864_000, montantHT: 864_000, imposable: false }],
    });
    const e3 = f3 && (await c.geste('Écriture de FV-USD-003 depuis la facture', 'POST', `/facturation/${f3.id}/comptabiliser`, { journalId: ven.id, compteGestionId: compte(c, '70110000') }));
    const id3 = e3?.ecritureId ?? e3?.ecriture?.id ?? e3?.id ?? null;
    const liste3 = id3 ? await c.lire('Écritures du journal des ventes', `/ecritures?exerciceId=${n}&journalId=${ven.id}`) : null;
    const lue = (liste3?.ecritures ?? (Array.isArray(liste3) ? liste3 : [])).find((e) => e.id === id3) ?? null;
    const ligneCli = (lue?.lignes ?? []).find((l) => l.compteId === cli.compteId);
    // Le facturier ne connaît que les francs · la ligne du client naît sans devise (ecriture-facture.ts).
    R.egal('Dollars · V3 depuis le facturier · ligne du client sans devise', [864_000, null], ligneCli ? [Number(ligneCli.debit), ligneCli.deviseId ?? null] : null);
    // L'écriture tenue par la facture ne se modifie pas · la devise ne s'y rend
    // pas (le refus dit la voie · la supprimer au brouillard et repasser la
    // facture, qui ne connaît que les francs). V3 reste donc une créance en
    // francs, hors de la réévaluation de l'art. 54.
    if (lue && ligneCli) {
      await refus(c, R, 'Dollars · V3 · devise ajoutée à l’écriture tenue par la facture', 'PATCH', `/ecritures/${id3}`, {
        lignes: lue.lignes.map((l) => ({
          compteId: l.compteId, libelle: l.libelle, debit: Number(l.debit), credit: Number(l.credit),
          ...(l.compteId === cli.compteId ? enUsd(300, 2_880) : {}),
        })),
      }, { statuts: [400], motif: /ne se modifie pas d'ici/ });
    }
    await validerJusqua(c, n, '2026-12-31');
  });

  await etape(R, 'Dollars · réévaluation au 31/12/2026 · la position dénouée de A1 n’est pas relue', async () => {
    const sim = await c.geste('Réévaluation 2026 simulée', 'POST', '/devises/reevaluation', { exerciceId: n, simulation: true });
    const rap = sim?.rapport ?? sim;
    // Fournisseur · seule A2 (−1 500 USD, 4 320 000) · réévaluée 1 500 × 2 900 = 4 350 000 · perte latente 30 000.
    // Client · V2 (500 USD, 1 440 000) → 1 450 000, gain 10 000 · V3, en francs, n'est pas lue.
    const gain = 10_000;
    R.montant('Dollars · 2026 · perte latente (A2 seule)', 30_000, rap?.perteLatente);
    R.montant('Dollars · 2026 · gain latent (V2)', gain, rap?.gainLatent);
    R.montant('Dollars · 2026 · provision pour perte de change (art. 54)', 30_000, rap?.provision);
    const nonLue = (rap?.positionsNonReevaluees ?? []).find((p) => p.numero === frs.numero);
    R.egal('Dollars · 2026 · A1, dénouée dans sa devise, nommée hors réévaluation (lettrage)', true, Boolean(nonLue) && /lettrage/i.test(nonLue.motif ?? ''));
    const pf = (rap?.positions ?? []).filter((p) => p.numero === frs.numero);
    R.montant('Dollars · 2026 · position fournisseur réévaluée · 1 500 USD (A1 écartée)', 1_500, Math.abs(pf.reduce((s, p) => s + Number(p.montantDevise ?? 0), 0)));
    ctx.reeval26 = await c.geste('Réévaluation au 31/12/2026', 'POST', '/devises/reevaluation', { exerciceId: n });
    await validerJusqua(c, n, '2026-12-31');
    const b = await balance(c, n);
    R.montant('Dollars · 2026 · 4783 augmentation des dettes d’exploitation', 30_000, solde(b, '4783'));
    R.montant('Dollars · 2026 · 4791 augmentation des créances d’exploitation', -gain, solde(b, '4791'));
    R.montant('Dollars · 2026 · 4991 provision (dotée au 6591)', -30_000, solde(b, '4991'));
    R.montant('Dollars · 2026 · 6591 dotation', 30_000, solde(b, '6591'));
  });

  await etape(R, 'Dollars · clôture 2026 refusée tant que l’écart de A1 n’est pas passé, puis passée', async () => {
    // D3 · art. 55 · la clôture refuse un lettrage dénoué dans l'exercice dont le réalisé n'est pas constaté.
    await refus(c, R, 'Dollars · clôture 2026 avant l’écart réalisé de A1', 'POST', `/exercices/${n}/cloturer`, {}, { statuts: [400, 409], motif: /change/i });
    const e = await c.geste('Écart de change réalisé de A1, passé au clic', 'POST', '/reglements/ecart-change', {
      lettrageId: ctx.gA1, exerciceId: n, journalId: od.id, date: '2026-09-01',
    });
    R.montant('Dollars · écart passé · 120 000', 120_000, e?.ecart);
    await validerJusqua(c, n, '2026-12-31');
    const b = await balance(c, n);
    R.montant('Dollars · 2026 · 656 perte réalisée', 120_000, solde(b, '656'));
    // Fournisseur · −5 520 000 + 5 640 000 − 120 000 (écart) − 4 320 000 (A2) − 30 000 (réévaluation) = −4 350 000 = 1 500 USD × 2 900.
    R.montant('Dollars · 2026 · fournisseur au cours de clôture', -4_350_000, solde(b, frs.numero));
    // Client · V2 1 440 000 + 10 000, plus V3 en francs 864 000.
    R.montant('Dollars · 2026 · client (V2 au cours de clôture, V3 en francs)', 2_314_000, solde(b, cli.numero));
    // Banque · 52 880 000 − 5 640 000 = 47 240 000.
    R.montant('Dollars · 2026 · banque', 47_240_000, solde(b, BQ));
    // Résultat · ventes 2 800 000 + 1 440 000 + 864 000 + gains réalisés 80 000 − achats 9 840 000 − 656 120 000 − 6591 30 000.
    R.montant('Dollars · 2026 · résultat', -4_806_000, -(solde(b, '6') + solde(b, '7')));
    R.egal('Dollars · clôture 2026 après l’écart', true, await cloturer(c, '2026'));
  });
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!n1) return R.note('Dollars · 2027 absent');

  await etape(R, 'Dollars · 2027 · extourne, règlements des positions, provision reprise', async () => {
    const id = ctx.reeval26?.reevaluationId;
    if (id) await c.geste('Extourne de la réévaluation 2026', 'POST', `/devises/reevaluation/${id}/extourne`, { exerciceSuivantId: n1 });
    else R.note('Dollars · réévaluation 2026 sans identifiant lu · extourne non passée');
    const ouvertes = async (t, sens, montant) => {
      const { lignes } = await lignesLettrage(c, t.compteId);
      return lignes.find((l) => String(l.date).slice(0, 4) === '2027' && Math.abs(Number(sens === 'D' ? l.debit : l.credit) - montant) < 0.005 && l.devise === 'USD') ?? null;
    };
    const ranA2 = await ouvertes(frs, 'C', 4_320_000);
    const ranV2 = await ouvertes(cli, 'D', 1_440_000);
    R.egal('Dollars · 2027 · A2 reportée au détail avec sa devise', true, Boolean(ranA2));
    R.egal('Dollars · 2027 · V2 reportée au détail avec sa devise', true, Boolean(ranV2));
    // A2 · 1 500 USD au 10/02/2027 (2 950) · payé 4 425 000 contre 4 320 000 · perte 105 000.
    if (ranA2) {
      await c.geste('Règlement de A2 (1 500 USD)', 'POST', '/reglements', {
        sens: 'FOURNISSEUR', exerciceId: n1, journalId: bq.id, date: '2027-02-10', reglements: [{ compteId: frs.compteId, ligneIds: [ranA2.id], montantDevise: 1_500, coursReglement: 2_950 }],
      });
    }
    // V2 · 500 USD au 20/03/2027 (2 950) · encaissé 1 475 000 contre 1 440 000 · gain 35 000.
    if (ranV2) {
      await c.geste('Règlement de V2 (500 USD)', 'POST', '/reglements', {
        sens: 'CLIENT', exerciceId: n1, journalId: bq.id, date: '2027-03-20', reglements: [{ compteId: cli.compteId, ligneIds: [ranV2.id], montantDevise: 500, coursReglement: 2_950 }],
      });
    }
    await validerJusqua(c, n1, '2027-12-31');
    // Réévaluation 2027 · plus aucune dette en devise · la provision de 30 000 se reprend au 7591 (ch. 22 § 2.3).
    // V3 reste, mais en francs · aucune position en devise, aucun gain latent.
    const r27 = await c.geste('Réévaluation au 31/12/2027', 'POST', '/devises/reevaluation', { exerciceId: n1 });
    const rap = r27?.rapport ?? r27;
    R.montant('Dollars · 2027 · perte latente nulle', 0, rap?.perteLatente);
    R.montant('Dollars · 2027 · gain latent nul (V3 en francs)', 0, rap?.gainLatent);
    const aj = (rap?.ajustementsProvision ?? []).reduce((s, x) => s + Number(x.reprise ?? 0), 0);
    R.montant('Dollars · 2027 · reprise de la provision devenue sans objet', 30_000, aj);
    await validerJusqua(c, n1, '2027-12-31');
    const b = await balance(c, n1);
    R.montant('Dollars · 2027 · 656 perte réalisée sur A2', 105_000, solde(b, '656'));
    R.montant('Dollars · 2027 · 756 gain réalisé sur V2', -35_000, solde(b, '756'));
    R.montant('Dollars · 2027 · 4991 provision reprise', 0, solde(b, '4991'));
    R.montant('Dollars · 2027 · 7591 reprise', -30_000, solde(b, '7591'));
    R.montant('Dollars · 2027 · fournisseur soldé', 0, solde(b, frs.numero));
    // 47 240 000 − 4 425 000 + 1 475 000 = 44 290 000.
    R.montant('Dollars · 2027 · banque', 44_290_000, solde(b, BQ));
    R.egal('Dollars · clôture 2027', true, await cloturer(c, '2027'));
  });

  await etape(R, 'Pièces imprimées · ce que le serveur rend', async () => {
    // Aucune route d'impression au serveur (FacturationController · GET '', GET
    // 'etat-detaille', POST '', POST ':id/note-de-credit', POST
    // ':id/comptabiliser', DELETE ':id' ; CommercialController · devis) · la
    // pièce s'imprime à l'écran (client/src/pages/FacturationPage.tsx) depuis
    // la liste, qui porte les mentions RECOPIÉES à la date de la pièce.
    const routes = routesDuServeur().filter((r) => /^\/(facturation|commercial)/.test(r.chemin));
    R.egal('Pièces imprimées · aucune route d’impression ou de PDF au serveur', [], routes.filter((r) => /impr|pdf|imprimer/i.test(r.chemin)).map((r) => `${r.verbe} ${r.chemin}`));
    const essai = await c.req('GET', `/facturation/${ctx.fV1?.id ?? '00000000-0000-4000-8000-000000000000'}`);
    R.egal('Pièces imprimées · GET /facturation/:id n’existe pas (404)', 404, essai.statut);
    const f = (await c.lire('Factures de vente', '/facturation?sens=VENTE'))?.factures ?? [];
    const v1 = f.find((x) => x.numeroSerie === 'FV-USD-001');
    // AUSCGIE art. 17 · forme, capital, siège, RCCM recopiés à la date de la pièce.
    R.egal('Pièces imprimées · FV-USD-001 · ligne de l’art. 17 recopiée (capital 30 000 000, siège, RCCM)', true,
      /responsabilité limitée/i.test(v1?.mentionsSocieteEmetteur?.ligne ?? '') && /30[\s  ]?000[\s  ]?000/.test(v1?.mentionsSocieteEmetteur?.ligne ?? '') && /CD\/LSH\/RCCM\/26-B-0101/.test(v1?.mentionsSocieteEmetteur?.ligne ?? ''));
    // Le capital change après la pièce · la copie d'origine ne bouge pas.
    await c.geste('Augmentation du capital (40 000 000)', 'PATCH', '/dossier/coordonnees', { capitalSocial: 40_000_000 });
    const f2 = (await c.lire('Factures de vente après le changement de capital', '/facturation?sens=VENTE'))?.factures ?? [];
    const v1b = f2.find((x) => x.numeroSerie === 'FV-USD-001');
    R.egal('Pièces imprimées · FV-USD-001 garde le capital de sa date', v1?.mentionsSocieteEmetteur?.ligne ?? 'absente', v1b?.mentionsSocieteEmetteur?.ligne ?? null);
    R.egal('Pièces imprimées · la mention « non homologué » n’est pas servie par le serveur (l’écran l’imprime)', false, /homologu/i.test(JSON.stringify(v1b ?? {})));
  });
}

// ==============================================================================
// 6. RÔLES, PROFIL DE FONCTIONS, JOURNAUX AUTORISÉS
// ==============================================================================

/**
 * LES ROUTES DU SERVEUR, LUES DANS LES CONTRÔLEURS · verbe, chemin, garde
 * d'authentification, `@Roles` (méthode puis classe, comme `getAllAndOverride`)
 * et accès des rôles cantonnés (`@ReserveAuComptable`, `@AccesRolesCantonnes`,
 * méthode puis classe). Lu dans le CODE, jamais recopié · une route ajoutée
 * entre d'office dans les balayages.
 */
function routesDuServeur() {
  const fichiers = (d) => readdirSync(d).flatMap((x) => {
    const p = join(d, x);
    return statSync(p).isDirectory() ? fichiers(p) : x.endsWith('.controller.ts') ? [p] : [];
  });
  const decorateur = (lignes, i) => {
    let texte = lignes[i].trim();
    let j = i;
    let prof = 0;
    const compter = (t) => { for (const ch of t) { if ('({['.includes(ch)) prof++; else if (')}]'.includes(ch)) prof--; } };
    compter(texte);
    while (prof > 0 && j + 1 < lignes.length) { j++; const t = lignes[j].trim(); texte += ` ${t}`; compter(t); }
    return { texte, fin: j };
  };
  const accesDe = (liste) => {
    const d = liste.find((x) => x.startsWith('@AccesRolesCantonnes(') || x === '@ReserveAuComptable()');
    if (!d) return undefined;
    if (d === '@ReserveAuComptable()') return { aideComptable: false, gestionnairePaie: false };
    const v = (k) => { const m = new RegExp(`${k}:\\s*(true|false)`).exec(d); return m ? m[1] === 'true' : undefined; };
    return { aideComptable: v('aideComptable'), gestionnairePaie: v('gestionnairePaie') };
  };
  const routes = [];
  const src = join(RACINE, 'src');
  for (const f of fichiers(src)) {
    const lignes = readFileSync(f, 'utf8').split('\n');
    let bloc = [];
    let classe = null;
    let prefixe = '';
    let decClasse = [];
    for (let i = 0; i < lignes.length; i++) {
      const t = lignes[i].trim();
      if (t.startsWith('@')) { const d = decorateur(lignes, i); bloc.push(d.texte); i = d.fin; continue; }
      if (t === '' || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
      if (/^export class /.test(t)) {
        classe = /export class (\w+)/.exec(t)[1];
        decClasse = bloc;
        bloc = [];
        const ctl = decClasse.find((d) => d.startsWith('@Controller('));
        prefixe = ctl ? ((/@Controller\(\s*'([^']*)'/.exec(ctl) ?? [])[1] ?? '') : '';
        continue;
      }
      if (bloc.length && classe) {
        const route = bloc.find((d) => /^@(Get|Post|Patch|Put|Delete)\(/.test(d));
        if (route) {
          const m = /^@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?/.exec(route);
          const gardes = [...decClasse, ...bloc].filter((d) => d.startsWith('@UseGuards(')).join(' ');
          const roles = bloc.find((d) => d.startsWith('@Roles(')) ?? decClasse.find((d) => d.startsWith('@Roles(')) ?? null;
          const acc = accesDe(bloc) ?? accesDe(decClasse) ?? {};
          routes.push({
            fichier: relative(src, f), classe, methode: (/^(?:async\s+)?(\w+)\s*\(/.exec(t) ?? [])[1] ?? '?', verbe: m[1].toUpperCase(),
            chemin: `/${[prefixe, m[2] ?? ''].filter((x) => x !== '').join('/')}`,
            authentifiee: /JwtAuthGuard/.test(gardes),
            roles: roles ? [...roles.matchAll(/RoleUtilisateur\.(\w+)/g)].map((x) => x[1]) : null,
            aideComptable: acc.aideComptable, gestionnairePaie: acc.gestionnairePaie,
          });
        }
      }
      bloc = [];
    }
  }
  return routes;
}

/** Un chemin jouable · chaque paramètre remplacé par une valeur de sa forme (un identifiant inconnu). */
const cheminJouable = (chemin) => chemin.replace(/:(\w+)/g, (_, p) => (
  p === 'mois' ? '2026-03' : p === 'annee' ? '2026' : p === 'lettre' ? 'AA' : p === 'code' ? 'ESSENTIEL' : '00000000-0000-4000-8000-000000000000'));

/**
 * UN BALAYAGE · chaque route jouée telle quelle, sans corps utile · la garde
 * doit refuser AVANT toute validation (les pipes de Nest passent après les
 * gardes). Rend les routes non refusées et les refus d'un autre motif.
 */
async function balayer(c, routes, motif) {
  const nonRefusees = [];
  const autreMotif = [];
  for (const rt of routes) {
    const r = await c.req(rt.verbe, cheminJouable(rt.chemin), rt.verbe === 'GET' || rt.verbe === 'DELETE' ? undefined : {});
    const m = texteRefus(r.corps);
    if (r.statut !== 403) nonRefusees.push(`${rt.verbe} ${rt.chemin} → ${r.statut} ${m.slice(0, 100)}`);
    else if (!motif.test(m)) autreMotif.push(`${rt.verbe} ${rt.chemin} → ${m.slice(0, 100)}`);
  }
  return { nonRefusees, autreMotif };
}

/** Une connexion d'un compte créé par l'administrateur · le mot de passe provisoire se change d'abord. */
async function connecter(R, email, provisoire, definitif) {
  const u = new Client(R);
  u.email = email;
  const r = await u.req('POST', '/auth/login', { email, motDePasse: provisoire });
  if (r.statut >= 400) { R.erreurHttp(`Connexion ${email}`, 'POST', '/auth/login', r.statut, r.corps); return null; }
  const moi = (await u.req('GET', '/auth/me')).corps;
  if (!moi?.doitChangerMotDePasse) { u.moi = moi; return u; }
  await u.req('POST', '/auth/changer-mot-de-passe', { motDePasseActuel: provisoire, nouveauMotDePasse: definitif });
  return reconnecter(R, email, definitif);
}
async function reconnecter(R, email, motDePasse) {
  const u = new Client(R);
  u.email = email;
  const r = await u.req('POST', '/auth/login', { email, motDePasse });
  if (r.statut >= 400) { R.erreurHttp(`Connexion ${email}`, 'POST', '/auth/login', r.statut, r.corps); return null; }
  u.moi = (await u.req('GET', '/auth/me')).corps;
  return u;
}

const MOTIF_AIDE = /réservée au comptable · l'aide-comptable saisit au brouillard/;
const MOTIF_GESTIONNAIRE = /Votre rôle est cantonné au personnel et à la paie/;
const MOTIF_ROLE = /Rôle insuffisant/;

async function roles(R) {
  R.scenario = 'transversal · rôles';
  const c = await nouveauDossier(R, 'Passe transversal · Cabinet des rôles SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'tr-roles', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const ctx = { u: {} };
  const routes = routesDuServeur();
  const sfx = Date.now();
  const DEFINITIF = 'Definitif-transversal-2026!';
  const ecritureOd = (libelle) => ({ exerciceId: n, journalId: od.id, date: '2026-03-31', libelle, lignes: [
    { compteId: compte(c, '62410000'), libelle, debit: 50_000, credit: 0 }, { compteId: compte(c, '40110000'), libelle, debit: 0, credit: 50_000 }] });

  await etape(R, 'Rôles · dossier, paie, dollar, utilisateurs', async () => {
    await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    const liste = (await c.lire('Devises', '/devises')) ?? [];
    ctx.usd = (Array.isArray(liste) ? liste : liste.devises ?? []).find((d) => d.code === 'USD')
      ?? (await c.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
    ctx.sal = await salarieEnFrancs(c, 'LUKUSA', 700_000, '2026-01-01');
    await ecriture(c, 'Capital libéré', n, '2026-01-02', 'Apport', [[BQ, 5_000_000, 0], ['10130000', 0, 5_000_000]], { journal: bq });
    await validerJusqua(c, n, '2026-01-02');
    for (const [cle, role] of [['aide', 'AIDE_COMPTABLE'], ['gest', 'GESTIONNAIRE_PAIE'], ['lect', 'LECTURE_SEULE'], ['prof', 'COMPTABLE'], ['jour', 'COMPTABLE']]) {
      const email = `passe-tr-${cle}-${sfx}@exemple.cd`;
      const u = await c.geste(`Utilisateur ${role} (${cle})`, 'POST', '/utilisateurs', { email, motDePasse: `Provisoire-${cle}-2026!`, role });
      ctx.u[cle] = { id: u?.id, email, client: u ? await connecter(R, email, `Provisoire-${cle}-2026!`, DEFINITIF) : null };
    }
  });

  // --- Le relevé d'unités d'œuvre hors du SMT (témoin du refus relevé au SMT SYCEBNL) ---
  await etape(R, 'Unités d’œuvre au Système normal · le relevé, témoin', async () => {
    const im = await c.geste('Chariot élévateur aux unités d’œuvre', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24110000'), designation: 'Chariot élévateur', dateAcquisition: '2026-02-01', dateMiseEnService: '2026-02-01',
      valeurOrigine: 12_000_000, dureeAmortissementAns: 5, modeAmortissement: 'UNITES_DOEUVRE', unitesOeuvrePrevues: 10_000, uniteOeuvreLibelle: 'heures',
      compteContrepartieId: compte(c, BQ), exerciceId: n, journalId: bq.id,
    });
    if (!im) return;
    ctx.chariot = 12_000_000;
    const r = await c.req('POST', `/immobilisations/${im.id}/consommation`, { exerciceId: n, unitesConsommees: 1_500, source: 'Compteur horaire relevé le 31/12/2026' });
    R.egal('Unités d’œuvre au Système normal · relevé enregistré (201)', 201, r.statut);
    if (r.statut >= 400) R.note(`Unités d’œuvre au Système normal · relevé · ${r.statut} · ${texteRefus(r.corps).slice(0, 200)}`);
  });

  // --- L'aide-comptable --------------------------------------------------------
  await etape(R, 'Rôles · aide-comptable · saisit, ne valide pas, n’entre pas au personnel', async () => {
    const u = ctx.u.aide?.client;
    if (!u) return R.note('Aide-comptable non connecté');
    const e = await u.geste('Aide-comptable · écriture au brouillard', 'POST', '/ecritures', ecritureOd('Entretien saisi par l’aide-comptable'));
    R.egal('Aide-comptable · saisie au brouillard admise', 'BROUILLARD', e?.statut ?? null);
    await refus(u, R, 'Aide-comptable · validation de sa pièce', 'POST', '/ecritures/valider', { ecritureIds: [e?.id ?? '00000000-0000-4000-8000-000000000000'] }, { statuts: [403], motif: MOTIF_AIDE });
    await refus(u, R, 'Aide-comptable · registre du personnel', 'GET', '/personnel/salaries', undefined, { statuts: [403], motif: MOTIF_AIDE });
    // Toutes les routes `@ReserveAuComptable()` ou fermées à l'aide-comptable, lues dans les contrôleurs.
    const fermees = routes.filter((r) => r.authentifiee && r.aideComptable === false && r.classe !== 'AuthController');
    const { nonRefusees, autreMotif } = await balayer(u, fermees, MOTIF_AIDE);
    R.egal(`Aide-comptable · ${fermees.length} routes réservées au comptable, toutes refusées (403)`, [], nonRefusees.slice(0, 10));
    R.egal('Aide-comptable · le refus dit la réserve au comptable', [], autreMotif.slice(0, 10));
    R.egal('Aide-comptable · la passation de la paie est dans le balayage', true, fermees.some((r) => /paie-du-mois\/:mois\/comptabilisation/.test(r.chemin)));
  });

  // --- Le gestionnaire de paie --------------------------------------------------
  await etape(R, 'Rôles · gestionnaire de paie · sa liste fermée, rien d’autre', async () => {
    const u = ctx.u.gest?.client;
    if (!u) return R.note('Gestionnaire de paie non connecté');
    const s = await u.lire('Gestionnaire · registre du personnel', '/personnel/salaries');
    R.egal('Gestionnaire · registre du personnel lu', true, Boolean(s));
    const ex = await u.lire('Gestionnaire · exercices', '/exercices');
    R.egal('Gestionnaire · exercices lus', true, Boolean(ex));
    if (ctx.sal) {
      const b = await u.geste('Gestionnaire · bulletin de mars 2026', 'POST', `/personnel/salaries/${ctx.sal}/bulletins`, {
        moisDePaie: '2026-03', dateMiseADisposition: '2026-03-31', natureEmployeurInpp: 'PRIVE', effectif: 5, regimeSalarial: 'BAREME_ARTICLE_118',
        elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: 700_000 }],
      });
      // 700 000 − 35 000 − IRPP · 665 000 × 12 = 7 980 000 → 58 320 + 15 % × 6 036 000 = 963 720 / 12 = 80 310 → 80 300.
      R.montant('Gestionnaire · bulletin émis · net (700 000 − 35 000 − 80 300)', 584_700, b?.netAPayerFc);
      await refus(u, R, 'Gestionnaire · passation de la paie au journal', 'POST', '/personnel/paie-du-mois/2026-03/comptabilisation', { exerciceId: n, journalId: od.id, date: '2026-03-31' },
        { statuts: [403], motif: MOTIF_GESTIONNAIRE });
    }
    const dv = await u.lire('Gestionnaire · devises', '/devises');
    R.egal('Gestionnaire · devises lues (F247)', true, Boolean(dv));
    // F247 · le cours de l'USD du JOUR de Kinshasa, en création seule.
    const auj = aujourdhui();
    const k = await u.geste(`Gestionnaire · cours de l’USD du ${auj}`, 'POST', `/devises/${ctx.usd?.id}/cours`, { date: auj, cours: 3_050, source: 'Banque centrale du Congo, cours du jour' });
    R.egal('Gestionnaire · cours du jour coté', true, Boolean(k));
    await refus(u, R, 'Gestionnaire · second cours du même jour', 'POST', `/devises/${ctx.usd?.id}/cours`, { date: auj, cours: 3_060, source: 'BCC' }, { statuts: [409] });
    await refus(u, R, 'Gestionnaire · cours d’un autre jour', 'POST', `/devises/${ctx.usd?.id}/cours`, { date: '2026-03-31', cours: 2_850, source: 'BCC' }, { statuts: [403] });
    await refus(u, R, 'Gestionnaire · grand livre d’un compte', 'GET', `/ecritures/grand-livre/${compte(c, BQ)}?exerciceId=${n}`, undefined, { statuts: [403], motif: MOTIF_GESTIONNAIRE });
    await refus(u, R, 'Gestionnaire · grand livre exporté', 'GET', `/exports/grand-livre?exerciceId=${n}`, undefined, { statuts: [403], motif: MOTIF_GESTIONNAIRE });
    // Tout ce qui n'est pas ouvert au gestionnaire · lectures comprises (défaut fermé).
    const fermees = routes.filter((r) => r.authentifiee && r.gestionnairePaie !== true && r.classe !== 'AuthController');
    const { nonRefusees, autreMotif } = await balayer(u, fermees, MOTIF_GESTIONNAIRE);
    R.egal(`Gestionnaire · ${fermees.length} routes hors de sa liste, toutes refusées (403)`, [], nonRefusees.slice(0, 10));
    R.egal('Gestionnaire · le refus dit le rôle cantonné', [], autreMotif.slice(0, 10));
    if (nonRefusees.length) R.note(`Gestionnaire · non refusées · ${nonRefusees.join(' ; ').slice(0, 2000)}`);
  });

  // --- La lecture seule ----------------------------------------------------------
  await etape(R, 'Rôles · lecture seule · lit, n’écrit rien', async () => {
    const u = ctx.u.lect?.client;
    if (!u) return R.note('Lecture seule non connectée');
    const b = await balance(u, n);
    // Apport 5 000 000, moins le chariot payé par la banque (12 000 000).
    R.montant('Lecture seule · balance lue · banque', 5_000_000 - (ctx.chariot ?? 0), solde(b, BQ));
    await refus(u, R, 'Lecture seule · écriture', 'POST', '/ecritures', ecritureOd('Essai en lecture seule'), { statuts: [403], motif: MOTIF_ROLE });
    // Toute route d'écriture qui porte `@Roles` sans la lecture seule.
    const ecritures = routes.filter((r) => r.authentifiee && r.verbe !== 'GET' && r.roles && !r.roles.includes('LECTURE_SEULE') && r.classe !== 'AuthController');
    const { nonRefusees, autreMotif } = await balayer(u, ecritures, MOTIF_ROLE);
    R.egal(`Lecture seule · ${ecritures.length} routes d’écriture, toutes refusées (403)`, [], nonRefusees.slice(0, 10));
    R.egal('Lecture seule · le refus dit le rôle requis', [], autreMotif.slice(0, 10));
    if (autreMotif.length) R.note(`Lecture seule · refus d’un autre motif · ${autreMotif.join(' ; ').slice(0, 2000)}`);
  });

  // --- Profil de fonctions ---------------------------------------------------------
  await etape(R, 'Rôles · profil de fonctions restreint à la saisie', async () => {
    const p = ctx.u.prof;
    if (!p?.client) return R.note('Comptable à profil non connecté');
    await attendre(1_100);
    await c.geste('Profil · saisie seule', 'PUT', `/utilisateurs/${p.id}/fonctions`, { restreindre: true, fonctions: ['SAISIE'] });
    const ancien = await p.client.req('GET', '/auth/me');
    // Poser un profil ferme les sessions (CLAUDE.md § 8, révocation de session).
    R.egal('Profil · la session ouverte avant est fermée (401, session perdue)', [401, 'perdue'], [ancien.statut, ancien.corps?.session ?? null]);
    const u = await reconnecter(R, p.email, DEFINITIF);
    if (!u) return;
    const e = await u.geste('Profil · écriture (saisie)', 'POST', '/ecritures', ecritureOd('Saisie sous profil'));
    R.egal('Profil · saisie admise', true, Boolean(e?.id));
    await refus(u, R, 'Profil · création d’un tiers (fonction « Tiers »)', 'POST', '/tiers', { type: 'CLIENT', code: 'CLI-PRF', nom: 'Client du profil', creerCompteIndividuel: true },
      { statuts: [403], motif: /« Tiers et modèles de règlement » ne vous est pas ouverte/ });
    await refus(u, R, 'Profil · validation (fonction « Validation »)', 'POST', '/ecritures/valider-jusqua', { exerciceId: n, dateLimite: '2026-03-31' },
      { statuts: [403], motif: /« Validation des écritures » ne vous est pas ouverte/ });
    const t = await u.lire('Profil · lecture des tiers', '/tiers');
    R.egal('Profil · les lectures restent ouvertes', true, Boolean(t));
  });

  // --- Journaux autorisés -------------------------------------------------------------
  await etape(R, 'Rôles · journaux autorisés · OD seul, puis aucun', async () => {
    const p = ctx.u.jour;
    if (!p?.client) return R.note('Comptable aux journaux non connecté');
    await attendre(1_100);
    await c.geste('Journaux autorisés · OD seul', 'PUT', `/utilisateurs/${p.id}/journaux`, { restreindre: true, journaux: [od.id] });
    const ancien = await p.client.req('GET', '/auth/me');
    R.egal('Journaux · la session ouverte avant est fermée (401, session perdue)', [401, 'perdue'], [ancien.statut, ancien.corps?.session ?? null]);
    let u = await reconnecter(R, p.email, DEFINITIF);
    if (!u) return;
    await refus(u, R, 'Journaux · écriture au journal de banque (hors périmètre)', 'POST', '/ecritures', {
      exerciceId: n, journalId: bq.id, date: '2026-03-31', libelle: 'Frais bancaires', lignes: [
        { compteId: compte(c, '63180000'), libelle: 'Frais', debit: 10_000, credit: 0 }, { compteId: compte(c, BQ), libelle: 'Frais', debit: 0, credit: 10_000 }],
    }, { statuts: [403], motif: /n'est pas dans votre périmètre de saisie/ });
    const e = await u.geste('Journaux · écriture au journal OD', 'POST', '/ecritures', ecritureOd('Saisie au journal autorisé'));
    R.egal('Journaux · saisie au journal autorisé admise', true, Boolean(e?.id));
    const lu = await u.lire('Journaux · lecture du journal de banque', `/ecritures?exerciceId=${n}&journalId=${bq.id}`);
    R.egal('Journaux · la lecture du journal non autorisé reste ouverte', true, Boolean(lu));
    await attendre(1_100);
    await c.geste('Journaux autorisés · liste vide', 'PUT', `/utilisateurs/${p.id}/journaux`, { restreindre: true, journaux: [] });
    u = await reconnecter(R, p.email, DEFINITIF);
    if (u) await refus(u, R, 'Journaux · liste vide · aucune saisie, même en OD', 'POST', '/ecritures', ecritureOd('Saisie sans journal'), { statuts: [403], motif: /périmètre de saisie/ });
  });

  // --- Changement de rôle ------------------------------------------------------------------
  await etape(R, 'Rôles · changer un rôle ferme les sessions', async () => {
    const a = ctx.u.aide;
    if (!a?.client) return;
    const avant = await a.client.req('GET', '/auth/me');
    R.egal('Changement de rôle · session de l’aide-comptable ouverte avant', 200, avant.statut);
    await attendre(1_100);
    await c.geste('Aide-comptable passé en lecture seule', 'PATCH', `/utilisateurs/${a.id}`, { role: 'LECTURE_SEULE' });
    const apres = await a.client.req('GET', '/auth/me');
    R.egal('Changement de rôle · l’ancienne session est refusée (401, session perdue)', [401, 'perdue'], [apres.statut, apres.corps?.session ?? null]);
    const u = await reconnecter(R, a.email, DEFINITIF);
    R.egal('Changement de rôle · la nouvelle session porte le nouveau rôle', 'LECTURE_SEULE', u?.moi?.role ?? u?.moi?.user?.role ?? null);
  });
}

// ==============================================================================
// 7. SUR SITE · CE QUE LE SERVEUR EN LIGNE REFUSE, ET LE SERVICE COMPILÉ
// ==============================================================================

/** TOTP, RFC 6238 · même calcul que l'application d'un opérateur (scenario-plateforme). */
function depuisBase32(texte) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let v = 0;
  const octets = [];
  for (const ch of texte.toUpperCase().replace(/[\s=-]/g, '')) {
    v = (v << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) { octets.push((v >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(octets);
}
function codeTotp(secret, instantMs) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.floor(instantMs / 1000 / 30)));
  const h = createHmac('sha1', depuisBase32(secret)).update(message).digest();
  const o = h[h.length - 1] & 0x0f;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
async function heureServeur() {
  const r = await fetch(`${BASE}/health`);
  return Date.parse(r.headers.get('date'));
}

/** Une licence de TEST · signée par une clé du banc, au format de licence-signee.ts (ordre fixe des clés). */
function licenceDeTest(clePrivee, contenu) {
  const serie = JSON.stringify([contenu.format, contenu.numero, contenu.titulaire, contenu.empreinteMachine, contenu.emiseLe, contenu.finMaintenance, contenu.expiration, contenu.dossiersMax]);
  return JSON.stringify({ contenu, signature: signer(null, Buffer.from(serie, 'utf8'), clePrivee).toString('base64') });
}
const empreinte = (id) => createHash('sha256').update(`omegax:${id.trim().toLowerCase()}`).digest('hex');
const motifDe = (f) => { try { f(); return null; } catch (e) { return e?.message ?? String(e); } };

async function surSite(R) {
  R.scenario = 'transversal · sur site';
  const anonyme = new Client(R);

  await etape(R, 'Sur site · état et dépôt publics sur le serveur EN LIGNE', async () => {
    const e = await anonyme.req('GET', '/sur-site/etat');
    R.egal('Sur site · état public, sans session · le serveur en ligne n’est pas une installation sur site', [200, false], [e.statut, e.corps?.surSite ?? null]);
    // Un fichier à signature fausse · le serveur en ligne le refuse AVANT toute vérification (licence-sur-site.service.ts, deposer).
    const faux = JSON.stringify({ contenu: { format: 1, numero: 'OMX-2028-001', titulaire: 'Client', empreinteMachine: empreinte('poste'), emiseLe: '2028-02-01', finMaintenance: '2028-12-31', expiration: null, dossiersMax: 3 }, signature: 'AAAA' });
    await refus(anonyme, R, 'Sur site · dépôt d’un fichier de licence sur le serveur en ligne', 'POST', '/sur-site/licence', { contenu: faux },
      { statuts: [400], motif: /n’est pas une installation sur site/ });
  });

  await etape(R, 'Sur site · la console refuse la licence « Perpétuelle (sur site) » et ne signe rien sans clé privée', async () => {
    const ed = await nouveauDossier(R, 'Passe transversal · console de l’opérateur', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'tr-console', exercice: ['2027-01-01', '2027-12-31'] });
    const url = process.env.PASSE_DATABASE_URL;
    if (!url) return R.note('Sur site · PASSE_DATABASE_URL absente · drapeau d’opérateur non posé, console non jouée');
    // Le drapeau ne s'accorde par aucune route (CLAUDE.md § 8) · posé en base sur la seule base jetable du banc.
    const pose = execFileSync('psql', [url, '-qtAc', `UPDATE users SET "estOperateurPlateforme" = true WHERE email = '${ed.email.replace(/'/g, "''")}' RETURNING email`], { encoding: 'utf8' }).trim() === ed.email;
    R.note(`Sur site · drapeau d’opérateur posé par psql sur la base jetable (${pose ? 'une ligne' : 'aucune ligne'})`);
    const init = await ed.geste('Double authentification · clé', 'POST', '/auth/double-authentification/initier', {});
    if (!init?.secret) return;
    await ed.geste('Double authentification · activation', 'POST', '/auth/double-authentification/activer', { motDePasseActuel: MOT_DE_PASSE, code: codeTotp(init.secret, await heureServeur()) });
    const sfx = Date.now();
    await refus(ed, R, 'Console · création d’un cabinet en licence « Perpétuelle (sur site) »', 'POST', '/plateforme/cabinets', {
      nomEntite: 'Passe transversal · cabinet sur site refusé', emailAdmin: `passe-tr-site-${sfx}@exemple.cd`, referentiel: 'SYSCOHADA',
      dateDebutExercice: '2027-01-01', dateFinExercice: '2027-12-31', typeLicence: 'PERPETUEL_ONPREMISE',
    }, { statuts: [400], motif: /non attribuable à un dossier hébergé/ });
    const cree = await ed.geste('Console · création d’un cabinet en abonnement', 'POST', '/plateforme/cabinets', {
      nomEntite: 'Passe transversal · cabinet hébergé', emailAdmin: `passe-tr-heb-${sfx}@exemple.cd`, referentiel: 'SYSCOHADA',
      dateDebutExercice: '2027-01-01', dateFinExercice: '2027-12-31',
    });
    const t = cree?.tenant?.id;
    if (t) {
      await refus(ed, R, 'Console · licence d’un cabinet hébergé passée en « Perpétuelle (sur site) »', 'PATCH', `/plateforme/cabinets/${t}/licence`, { type: 'PERPETUEL_ONPREMISE' },
        { statuts: [400], motif: /non attribuable à un dossier hébergé/ });
    }
    // Sans la clé privée (secret API_CLE_PRIVEE_LICENCE), aucune licence sur site ne s'émet.
    await refus(ed, R, 'Console · émission d’une licence sur site sans clé privée posée', 'POST', '/plateforme/licences-sur-site', {
      titulaire: 'Cabinet du poste de Kolwezi', empreinteMachine: empreinte('MACHINE-KOLWEZI-01'), finMaintenance: '2028-12-31', dossiersMax: 3,
    }, { statuts: [400], motif: /clé privée de signature n’est pas posée/ });
  });

  await etape(R, 'Sur site · l’inscription publique et la licence « Perpétuelle (sur site) »', async () => {
    // Le jumeau de F171 · la porte publique (ouverte au banc, INSCRIPTION_PUBLIQUE=true) reçoit-elle ce type ?
    const v = new Client(R);
    const email = `passe-tr-pub-${Date.now()}@exemple.cd`;
    const r = await v.req('POST', '/auth/register', {
      nomEntite: 'Passe transversal · inscription « sur site »', referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL', email, motDePasse: MOT_DE_PASSE,
      dateDebutExercice: '2027-01-01', dateFinExercice: '2027-12-31', typeLicence: 'PERPETUEL_ONPREMISE',
    });
    R.egal('Inscription publique · « Perpétuelle (sur site) » refusée en ligne, comme à la console (F171)', true, r.statut === 400);
    if (r.statut < 400) {
      const lu = await v.req('GET', '/comptes');
      R.note(`Inscription publique en « Perpétuelle (sur site) » ACCEPTÉE (${r.statut}) · le dossier naît, puis GET /comptes · ${lu.statut} · ${texteRefus(lu.corps).slice(0, 220)}`);
    }
    // Même porte, « Perpétuelle (SaaS) » · constat seul (aucun texte ni décision lue ne fixe la licence d'une inscription publique, porte fermée en production).
    const w = new Client(R);
    const r2 = await w.req('POST', '/auth/register', {
      nomEntite: 'Passe transversal · inscription « perpétuelle SaaS »', referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL', email: `passe-tr-saas-${Date.now()}@exemple.cd`,
      motDePasse: MOT_DE_PASSE, dateDebutExercice: '2027-01-01', dateFinExercice: '2027-12-31', typeLicence: 'PERPETUEL_SAAS',
    });
    const lu2 = r2.statut < 400 ? await w.req('GET', '/comptes') : null;
    R.note(`Inscription publique en « Perpétuelle (SaaS) » · ${r2.statut} · puis GET /comptes · ${lu2?.statut ?? '·'}`);
  });

  await etape(R, 'Sur site · le service de licence COMPILÉ, hors API (clé de TEST du banc)', async () => {
    // Le serveur en ligne ne dépose rien · le service du paquet est construit ici,
    // comme le lanceur sur site le fait (installation/demarrer.cjs), sur un poste
    // VIRTUEL (fichiers en mémoire) et avec une paire Ed25519 du banc · jamais la
    // clé de VMG, que le banc n'a pas.
    const require = createRequire(import.meta.url);
    const { LicenceSurSiteService } = require(join(RACINE, 'dist/modules/sur-site/licence-sur-site.service.js'));
    const { CLE_PUBLIQUE_EDITEUR } = require(join(RACINE, 'dist/modules/sur-site/cle-publique-editeur.js'));
    const poste = new Map([['/poste-virtuel/version/version-sur-site.json', JSON.stringify({ date: '2028-01-10' })]]);
    const ID = 'MACHINE-BANC-TRANSVERSAL-01';
    const acces = { identifiantSysteme: () => ID, lire: (p) => poste.get(p) ?? null, ecrire: (p, t) => poste.set(p, t), aujourdhui: () => '2028-02-15' };
    const env = { MODE_INSTALLATION: 'SUR_SITE', DOSSIER_DONNEES: '/poste-virtuel/donnees' };
    // La version compilée ne porte pas encore la clé de VMG (cle-publique-editeur.ts, « null tant que Manasse ne l'a pas posée »).
    const reel = new LicenceSurSiteService(acces, env, CLE_PUBLIQUE_EDITEUR, '/poste-virtuel/version');
    R.egal('Service compilé avec la clé livrée · CLE_EDITEUR_ABSENTE (paquet non installable chez un client)', 'CLE_EDITEUR_ABSENTE', reel.etat().statut);
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const autre = generateKeyPairSync('ed25519');
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    const s = new LicenceSurSiteService(acces, env, pem, '/poste-virtuel/version');
    R.egal('Service de test · aucune licence déposée · ABSENTE', 'ABSENTE', s.etat().statut);
    const base = { format: 1, titulaire: 'Cabinet du banc', empreinteMachine: empreinte(ID), finMaintenance: '2028-12-31', expiration: null, dossiersMax: 3 };
    R.egal('Dépôt · signature fausse refusée', true, /signature de la licence est invalide/.test(motifDe(() => s.deposer(licenceDeTest(autre.privateKey, { ...base, numero: 'OMX-2028-002', emiseLe: '2028-02-10' }))) ?? ''));
    const fichier = JSON.parse(licenceDeTest(privateKey, { ...base, numero: 'OMX-2028-002', emiseLe: '2028-02-10' }));
    const falsifie = JSON.stringify({ contenu: { ...fichier.contenu, dossiersMax: 99 }, signature: fichier.signature });
    R.egal('Dépôt · contenu retouché (99 dossiers) sous une signature authentique · refusé', true, /signature de la licence est invalide/.test(motifDe(() => s.deposer(falsifie)) ?? ''));
    R.egal('Dépôt · licence d’un autre poste refusée', true, /émise pour un autre poste/.test(motifDe(() => s.deposer(licenceDeTest(privateKey, { ...base, empreinteMachine: empreinte('AUTRE-POSTE'), numero: 'OMX-2028-003', emiseLe: '2028-02-10' }))) ?? ''));
    const ok = s.deposer(JSON.stringify(fichier));
    R.egal('Dépôt · licence authentique de ce poste · VALIDE', 'VALIDE', ok?.statut ?? null);
    R.egal('Dépôt · émission antérieure refusée (la plus récente garde la place)', true,
      /est plus récente que celle déposée/.test(motifDe(() => s.deposer(licenceDeTest(privateKey, { ...base, numero: 'OMX-2028-001', emiseLe: '2028-01-05' }))) ?? ''));
    R.egal('Plafond · trois dossiers ouverts, le quatrième refusé', true, /couvre 3 dossier\(s\)/.test(motifDe(() => s.verifierPlafondDossiers(3)) ?? ''));
    R.egal('Plafond · deux dossiers ouverts, le troisième admis', null, motifDe(() => s.verifierPlafondDossiers(2)));
  });
}

export default async function scenarioTransversal(registre) {
  const R = registre;
  const parties = (process.env.PASSE_TRANSVERSAL ?? 'smt-asbl,smt-ent,coop,pcoll,mine,usd,roles,site').split(',').map((s) => s.trim());
  const table = { 'smt-asbl': smtAssociation, 'smt-ent': smtEntreprise, coop: cooperative, pcoll: procedureCollective, mine: miniere, usd: devises, roles, site: surSite };
  for (const p of parties) {
    if (!table[p]) continue;
    try {
      await table[p](R);
    } catch (e) {
      R.note(`Partie ${p} interrompue · ${e.stack ?? e.message}`);
    }
  }
}
