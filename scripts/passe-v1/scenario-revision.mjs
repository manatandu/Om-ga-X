/**
 * SCÉNARIO D · LA RÉVISION ET LES CONTRÔLES DE FIN D'EXERCICE, dans les deux
 * référentiels, exercices 2026 (N) et 2027 (N+1), clôture de 2026 comprise.
 *
 * Trois dossiers.
 *  1. « Lualaba Industries SA », société anonyme SYSCOHADA au système normal
 *     (AUSCGIE art. 702, commissaire aux comptes sans condition de taille).
 *     Un COMPTABLE saisit les opérations courantes, l'administrateur du
 *     cabinet passe l'ouverture et les écritures d'inventaire · c'est ce qui
 *     donne au test des écritures de journal (ISA 240) un auteur à juger.
 *  2. « Association Espoir du Kivu », association SYCEBNL au jeu
 *     « associations et ordres professionnels », cotisations à l'APPEL.
 *  3. « Atelier Kasaï SARL », dossier SANS écriture, pour la seule durée du
 *     mandat du commissaire d'une SARL (AUSCGIE art. 379).
 *
 * Ce qui est simulé · circularisation (ISA 505), registre des faiblesses
 * (ISA 265), questionnaire de révision du CPCC, mandat du contrôleur des
 * comptes (SYCEBNL art. 21 et 22, AUSCGIE art. 379, 703, 704 et 709), manuel
 * des procédures (AUDCIF art. 16 al. 1, art. 17, 3°), registre des provisions
 * (AUDCIF Titre VIII ch. 18, ligne A16), inventaire physique et PV de comptage
 * par caisse, livre d'inventaire et rapport (documents obligatoires), test
 * des écritures de journal et contrôles de clôture.
 *
 * Chaque taux, total et décompte attendu est calculé À LA MAIN en commentaire
 * à côté du contrôle, depuis les opérations du banc · jamais recopié d'une
 * réponse du serveur. Les numéros de compte sont lus dans le plan SEMÉ du
 * dossier (`compte()`), et ont été relus dans les compétences `syscohada`,
 * `sycebnl` et `audcif-acte-uniforme` (fiche du compte 19 · « crédité […]
 * par le débit du compte 69 (691 […]) » ; fiche SYCEBNL du compte 19, même
 * phrase ; 4991 doté par le 6591, `provisions/court-terme-et-conditions.ts`).
 */
import ExcelJS from 'exceljs';
import {
  Client, MOT_DE_PASSE, auCentime, balance, cloturer, compte, ecriture, etape, nouveauDossier,
  rechargerComptes, rechargerExercices, solde, tiers, validerJusqua,
} from './lib.mjs';
import { confronterControles } from './parcours.mjs';

// --- Outils propres au scénario ------------------------------------------------

/** Le texte d'un corps de refus, quelle qu'en soit la forme. */
const texteRefus = (corps) => {
  const m = corps?.message ?? corps;
  return Array.isArray(m) ? m.join(' | ') : typeof m === 'string' ? m : JSON.stringify(m ?? '');
};

/**
 * UN REFUS ATTENDU · le geste DOIT être refusé avec ce statut, et le motif
 * doit dire ce qu'on attend qu'il dise. Il passe par `req` · un refus voulu
 * est le contrôle lui-même, pas une erreur du banc. Un geste accepté à tort
 * est consigné avec son corps.
 */
async function refus(c, R, libelle, methode, chemin, corps, statut, motif) {
  const r = await c.req(methode, chemin, corps);
  R.egal(`${libelle} · refusé (${statut})`, statut, r.statut);
  if (motif) R.egal(`${libelle} · le motif le dit`, true, motif.test(texteRefus(r.corps)));
  if (r.statut < 400) R.note(`${libelle} · ACCEPTÉ à tort · ${JSON.stringify(r.corps).slice(0, 300)}`);
  return r;
}

/** Un nombre lu dans une réponse (Decimal sérialisé en chaîne compris). */
const nb = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

/** Bilan d'ouverture importé, comme les scénarios de la première passe. */
async function importerOuverture(c, exerciceId, lignes) {
  const csv = ['Compte;Intitule;Debit;Credit', ...lignes.map((l) => l.join(';'))].join('\n');
  await c.geste('Import du bilan d’ouverture', 'POST', '/import/executer', {
    type: 'BALANCE', nomFichier: 'ouverture-2026.csv', contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
    mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
    exerciceId, dateOperation: '2026-01-01', bilanDOuverture: true, separateur: ';',
  });
}

/**
 * UN COMPTABLE DU DOSSIER · créé par l'administrateur, mot de passe
 * provisoire changé à la première connexion (`MotDePasseAChangerGuard`). Il
 * partage le plan, les journaux et les exercices déjà lus par l'administrateur
 * (même dossier), et saisit sous SON identité · c'est ce qui donne à
 * l'ISA 240 § A44 b) une écriture « attendue » à côté de celles de
 * l'administrateur.
 */
async function comptableDu(c, R, cle) {
  const email = `passe-v1-${cle}-comptable-${Date.now()}@exemple.cd`;
  const provisoire = 'Provisoire-Comptable-2026!';
  const cree = await c.geste('Création du comptable du dossier', 'POST', '/utilisateurs', { email, motDePasse: provisoire, role: 'COMPTABLE' });
  if (!cree) return null;
  let k = new Client(R);
  let r = await k.req('POST', '/auth/login', { email, motDePasse: provisoire });
  if (r.statut >= 400) {
    R.erreurHttp('Connexion du comptable', 'POST', '/auth/login', r.statut, r.corps);
    return null;
  }
  const moi = (await k.req('GET', '/auth/me')).corps;
  if (moi?.doitChangerMotDePasse) {
    await k.req('POST', '/auth/changer-mot-de-passe', { motDePasseActuel: provisoire, nouveauMotDePasse: `${MOT_DE_PASSE}C` });
    k = new Client(R);
    r = await k.req('POST', '/auth/login', { email, motDePasse: `${MOT_DE_PASSE}C` });
    if (r.statut >= 400) {
      R.erreurHttp('Reconnexion du comptable', 'POST', '/auth/login', r.statut, r.corps);
      return null;
    }
  }
  k.moi = (await k.req('GET', '/auth/me')).corps;
  k.userId = cree.id;
  Object.assign(k, { plan: c.plan, comptes: c.comptes, journaux: c.journaux, journal: c.journal, od: c.od, exercices: c.exercices, tenantId: c.tenantId, nom: c.nom });
  return k;
}

/**
 * LE CLASSEUR DU TEST DES ÉCRITURES DE JOURNAL (ISA 240), relu · le nombre
 * d'écritures retenues par critère (feuille « Critères »), le pied
 * « N écriture(s) retenue(s) sur M », et pour chaque écriture sélectionnée son
 * libellé et ses critères.
 */
async function lireTestIsa240(c, R, libelle, exerciceId) {
  const r = await c.lire(`Test des écritures de journal ${libelle}`, `/exports/test-ecritures-journal?exerciceId=${exerciceId}`);
  if (!R.egal(`${libelle} · classeur ISA 240 produit`, true, Boolean(r?.contenu))) return null;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(r.contenu);
  const texte = (v) => (v && typeof v === 'object' ? (v.richText ? v.richText.map((x) => x.text).join('') : v.text ?? v.result ?? '') : String(v ?? ''));
  const garde = wb.getWorksheet('Critères');
  const parTitre = {};
  let pied = null;
  garde?.eachRow((row) => {
    const a = texte(row.getCell(1).value);
    const e = row.getCell(5).value;
    if (/écriture\(s\) retenue\(s\) sur/.test(a)) pied = a;
    else if (a && typeof e === 'number') parTitre[a] = e;
  });
  const feuille = wb.getWorksheet('Écritures sélectionnées');
  const lignes = [];
  let entete = null;
  feuille?.eachRow((row) => {
    const vals = row.values.slice(1).map(texte);
    if (!entete) {
      if (vals.includes('Date comptable') && vals.includes('Critères')) entete = vals;
      return;
    }
    const o = {};
    entete.forEach((h, i) => { o[h] = vals[i]; });
    if (o['Libellé'] || o['Critères']) lignes.push(o);
  });
  const m = /^(\d+) écriture\(s\) retenue\(s\) sur (\d+)/.exec(pied ?? '');
  return { parTitre, retenues: m ? Number(m[1]) : null, total: m ? Number(m[2]) : null, lignes };
}

// --- Les contrôles de clôture attendus, avec leur raison ------------------------
//
// Un code levé hors de la liste est un contrôle levé À TORT tant que la raison
// n'est pas écrite ici ; un code de la liste absent est un contrôle MANQUANT.

const CONTROLES_SA_2026 = {
  // AUSCGIE art. 702 · « Les sociétés anonymes […] sont tenues de désigner un
  // commissaire aux comptes » · information servie à toute SA (règle TOUJOURS).
  COMMISSAIRE_AUX_COMPTES_OBLIGATOIRE: 'SA · commissaire aux comptes sans condition de taille (AUSCGIE art. 702)',
  // Fiche du compte 52 · le 52110000 a bougé et aucun relevé n'est rapproché.
  BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE: { raison: 'banque mouvementée, aucun rapprochement clos', references: ['52110000'] },
  // AUDCIF art. 22, 3° · aucune clôture de période posée dans OmegaX.
  CLOTURE_INFORMATIQUE_EN_RETARD: 'aucune clôture de période posée, horloge au 15/02/2028',
  // Fournitures payées comptant (D 605 / C 571) · une charge sans compte de tiers.
  CHARGE_SANS_TIERS: 'fournitures payées comptant par la caisse',
  // SANS_PIECE N'EST PAS ATTENDU · « Ajust. » est passée au journal OD, que
  // la règle écarte avec l'AN (`controles.service.ts`, sansReference) · une
  // OD d'inventaire porte sa pièce interne. Elle reste retenue par l'ISA 240.
  // L'administrateur a passé ET validé l'ouverture et les écritures d'inventaire.
  VALIDATION_PAR_SON_AUTEUR: 'l’administrateur valide ses propres écritures',
  // C1, C3, C4 et F1, F3 portent des factures non lettrées de plus de quatre-vingt-dix jours.
  TIERS_ANCIEN_NON_LETTRE: 'factures partiellement réglées, non lettrées',
};

export default async function scenarioRevision(registre) {
  const R = registre;
  await societeAnonyme(R);
  await association(R);
  await sarlMandat(R);
}

// ================================================================================
// 1. LA SOCIÉTÉ ANONYME (SYSCOHADA)
// ================================================================================

async function societeAnonyme(R) {
  R.scenario = 'Revision SA';
  const c = await nouveauDossier(R, 'Passe révision · Lualaba Industries SA', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'revision-sa', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ca = c.journal('CA') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const ach = c.journal('ACH') ?? c.od;
  const od = c.od;
  const ctx = { ecritures: [] };

  await etape(R, 'Paramètres · forme SA, module de révision, date d’arrêté', async () => {
    await c.geste('Forme juridique SA', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });
    const m = await c.geste('Activation du module de révision', 'PATCH', '/dossier/modules', { modulesActives: ['REVISION'] });
    R.egal('SA · module REVISION activé', true, JSON.stringify(m ?? {}).includes('REVISION'));
    // L'arrêté suit la clôture, dans les quatre mois (AUDCIF Titre VIII
    // ch. 31 § 1.3) · posé pour que la quatrième mention soit servie.
    await c.geste('Date d’arrêté des comptes 2026', 'POST', `/exercices/${n}/arrete-comptes`, { dateArreteComptes: '2027-03-31' });
  });

  await etape(R, 'Reprise · bilan d’ouverture au 1er janvier 2026', async () => {
    // D 52110000 50 000 000 · D 57110000 2 000 000 (caisse siège) · D 57210000
    // 500 000 (caisse succursale A) · D 31110000 10 000 000 · C 10130000
    // 60 000 000 · C 12100000 2 500 000. Débits 62 500 000 = crédits.
    await importerOuverture(c, n, [
      ['52110000', 'Banque', 50_000_000, 0], ['57110000', 'Caisse siège', 2_000_000, 0], ['57210000', 'Caisse agence', 500_000, 0],
      ['31110000', 'Marchandises A1', 10_000_000, 0], ['10130000', 'Capital', 0, 60_000_000], ['12100000', 'Report à nouveau', 0, 2_500_000],
    ]);
    await validerJusqua(c, n, '2026-01-01');
  });

  const t = {};
  for (const [k, type, code, nom] of [
    ['c1', 'CLIENT', 'C1', 'Mines du Katanga'], ['c2', 'CLIENT', 'C2', 'Brasserie de l’Est'], ['c3', 'CLIENT', 'C3', 'Pharmacie Centrale'],
    ['c4', 'CLIENT', 'C4', 'Hôtel du Lac'], ['f1', 'FOURNISSEUR', 'F1', 'Grossiste de Kinshasa'], ['f2', 'FOURNISSEUR', 'F2', 'Transports Rapides'],
    ['f3', 'FOURNISSEUR', 'F3', 'Imprimerie Moderne'],
  ]) t[k] = await tiers(c, type, code, nom);

  const k = await etape(R, 'Comptable du dossier', () => comptableDu(c, R, 'revision-sa'));
  const saisisseur = k ?? c;
  if (!k) R.note('SA · comptable non créé · l’administrateur saisit tout, le test ISA 240 § A44 b) n’a plus d’écriture « attendue »');

  /** Une écriture de 2026, gardée au registre du banc avec son auteur. */
  const passer = async (qui, geste, date, libelle, lignes, options) => {
    const e = await ecriture(qui, geste, n, date, libelle, lignes, options);
    if (e) ctx.ecritures.push({ id: e.id, auteur: qui === c ? 'ADMIN' : 'COMPTABLE', date, libelle, reference: options?.reference ?? null, lignes, createdAt: e.createdAt });
    return e;
  };

  await etape(R, '2026 · opérations courantes (saisies par le comptable)', async () => {
    const s = saisisseur;
    await passer(s, 'Facture F1', '2026-02-01', 'Facture marchandises Grossiste', [['60110000', 6_000_000, 0], [t.f1.numero, 0, 6_000_000]], { journal: ach, reference: 'FA-F1-01' });
    await passer(s, 'Vente C1', '2026-03-15', 'Facture vente Mines du Katanga', [[t.c1.numero, 12_000_000, 0], ['70110000', 0, 12_000_000]], { journal: ven, reference: 'FV-001' });
    await passer(s, 'Règlement F1', '2026-03-15', 'Règlement Grossiste par virement', [[t.f1.numero, 4_000_000, 0], ['52110000', 0, 4_000_000]], { journal: bq, reference: 'VIR-001' });
    await passer(s, 'Vente C2', '2026-04-20', 'Facture vente Brasserie de l’Est', [[t.c2.numero, 8_000_000, 0], ['70110000', 0, 8_000_000]], { journal: ven, reference: 'FV-002' });
    await passer(s, 'Facture F2', '2026-05-01', 'Facture transport marchandises', [['60110000', 2_500_000, 0], [t.f2.numero, 0, 2_500_000]], { journal: ach, reference: 'FA-F2-01' });
    await passer(s, 'Vente C3', '2026-06-10', 'Facture vente Pharmacie Centrale', [[t.c3.numero, 3_000_000, 0], ['70110000', 0, 3_000_000]], { journal: ven, reference: 'FV-003' });
    await passer(s, 'Règlement F2', '2026-06-15', 'Règlement Transports Rapides', [[t.f2.numero, 2_500_000, 0], ['52110000', 0, 2_500_000]], { journal: bq, reference: 'VIR-002' });
    await passer(s, 'Encaissement C1', '2026-06-30', 'Encaissement Mines du Katanga', [['52110000', 4_000_000, 0], [t.c1.numero, 0, 4_000_000]], { journal: bq, reference: 'REC-001' });
    await passer(s, 'Encaissement C2', '2026-07-31', 'Encaissement Brasserie de l’Est', [['52110000', 8_000_000, 0], [t.c2.numero, 0, 8_000_000]], { journal: bq, reference: 'REC-002' });
    await passer(s, 'Facture F3', '2026-08-01', 'Facture imprimés Imprimerie Moderne', [['60550000', 500_000, 0], [t.f3.numero, 0, 500_000]], { journal: ach, reference: 'FA-F3-01' });
    await passer(s, 'Vente C4', '2026-09-05', 'Facture vente Hôtel du Lac', [[t.c4.numero, 1_000_000, 0], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-004' });
    await passer(s, 'Encaissement C3', '2026-09-30', 'Encaissement Pharmacie Centrale', [['52110000', 1_000_000, 0], [t.c3.numero, 0, 1_000_000]], { journal: bq, reference: 'REC-003' });
    await passer(s, 'Fournitures comptant', '2026-10-10', 'Fournitures payées comptant', [['60550000', 300_000, 0], ['57110000', 0, 300_000]], { journal: ca, reference: 'BC-001' });
    // L'ÉCRITURE QUE L'ISA 240 § A44 c) DÉSIGNE · libellé de six caractères,
    // aucune pièce (« peu ou pas de justification ou de description »).
    await passer(s, 'Ajustement sans pièce', '2026-11-01', 'Ajust.', [['57310000', 200_000, 0], ['57110000', 0, 200_000]], { journal: od });
    await passer(s, 'Retour de la caisse de secours', '2026-11-20', 'Retour fonds caisse de secours', [['57110000', 200_000, 0], ['57310000', 0, 200_000]], { journal: od, reference: 'PC-002' });
    await validerJusqua(c, n, '2026-12-31');
  });

  // --- Provisions pour risques et charges (AUDCIF Titre VIII ch. 18) ----------
  await etape(R, '2026 · registre des provisions', () => provisionsSa(c, R, n, ctx, passer, od));

  // --- Inventaire physique et PV de caisse ------------------------------------
  await etape(R, '2026 · inventaire physique, PV de comptage des caisses', () => inventaireSa(c, R, n, ctx, passer, od));

  await etape(R, '2026 · balance de contrôle avant les travaux de révision', async () => {
    const b = await balance(c, n);
    // 52110000 · 50 000 000 − 4 000 000 − 2 500 000 + 4 000 000 + 8 000 000 + 1 000 000.
    R.montant('SA 2026 · banque 52110000', 56_500_000, solde(b, '52110000'));
    // 57110000 · 2 000 000 − 300 000 − 200 000 + 200 000.
    R.montant('SA 2026 · caisse siège 57110000', 1_700_000, solde(b, '57110000'));
    R.montant('SA 2026 · caisse de secours 57310000 (aller et retour)', 0, solde(b, '57310000'));
    // C1 8 000 000 + C3 2 000 000 + C4 1 000 000 (C2 soldé).
    R.montant('SA 2026 · clients 411', 11_000_000, solde(b, '411'));
    // F1 −2 000 000 + F3 −500 000 (F2 soldé).
    R.montant('SA 2026 · fournisseurs 401', -2_500_000, solde(b, '401'));
    // 10 000 000 − 600 000 (manquant redressé).
    R.montant('SA 2026 · stock 31110000 après redressement', 9_400_000, solde(b, '31110000'));
    R.montant('SA 2026 · total débit = total crédit', b?.totalDebit ?? NaN, b?.totalCredit);
  });

  // --- Circularisation (ISA 505) ----------------------------------------------
  await etape(R, '2026 · circularisation des clients', () => circularisationClientsSa(c, R, n, t));
  await etape(R, '2026 · circularisation des fournisseurs (forme négative)', () => circularisationFournisseursSa(c, R, n, t));

  // --- Faiblesses (ISA 265) ---------------------------------------------------
  const faiblesses = await etape(R, '2026 · registre des faiblesses du contrôle interne', () => faiblessesSa(c, R, n));

  // --- Questionnaire CPCC -----------------------------------------------------
  await etape(R, '2026 · questionnaire de révision', () => questionnaireSa(c, R, n));

  // --- Mandat du commissaire aux comptes -------------------------------------
  const mandat = await etape(R, 'Mandat du commissaire aux comptes (SA)', () => mandatSa(c, R));

  // --- Manuel des procédures --------------------------------------------------
  await etape(R, 'Manuel des procédures (SA)', () => manuelSa(c, R, n));

  // --- Test des écritures de journal (ISA 240) --------------------------------
  const isa = await etape(R, '2026 · test des écritures de journal avant clôture', () => testIsa240Sa(c, R, n, ctx));

  await etape(R, '2026 · contrôles de clôture', () => confronterControles(c, R, 'SA 2026 · contrôles de clôture', n, CONTROLES_SA_2026));

  // --- Clôture 2026 -----------------------------------------------------------
  const clos = await etape(R, 'Clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;

  await etape(R, '2026 · test des écritures de journal après clôture', async () => {
    if (!clos) return R.note('SA · clôture 2026 refusée, relecture du test ISA 240 après clôture sautée');
    // « Le test des écritures de journal ne compte pas les écritures de
    // clôture » (CLAUDE.md, clôture annuelle) · le décompte avant clôture
    // doit rester le même après elle.
    const apres = await lireTestIsa240(c, R, 'SA 2026 après clôture', n);
    if (!apres || !isa) return;
    R.montant('SA 2026 · ISA 240 · écritures examinées après clôture = avant clôture', isa.total ?? NaN, apres.total);
    R.montant('SA 2026 · ISA 240 · écritures retenues après clôture = avant clôture', isa.retenues ?? NaN, apres.retenues);
    const avantLib = new Set(isa.lignes.map((l) => `${l['Date comptable']}|${l['Libellé']}`));
    const enPlus = apres.lignes.filter((l) => !avantLib.has(`${l['Date comptable']}|${l['Libellé']}`));
    R.egal('SA 2026 · ISA 240 · aucune écriture de clôture dans la sélection', [], enPlus.map((l) => `${l['Libellé']} (${l['Journal']}, ${l['Critères']})`));
  });

  // --- Documents obligatoires de 2026 -----------------------------------------
  await etape(R, '2026 · livre d’inventaire et rapport de gestion', () => documentsSa(c, R, n));

  if (!n1) {
    R.note('SA · 2027 non joué · exercice 2027 absent après la clôture');
    return;
  }

  // --- 2027 ---------------------------------------------------------------------
  await etape(R, '2027 · provisions reportées à l’ouverture, reprise', () => provisions2027Sa(c, R, n, n1, od));
  await etape(R, '2027 · report des faiblesses', () => faiblesses2027Sa(c, R, n1, faiblesses));
  await etape(R, '2027 · mandat prorogé, puis refus exprès, puis nouveau mandat', () => mandat2027Sa(c, R, n1, mandat));

  await etape(R, 'Exercice 2026 clos · inventaire et report à rebours', async () => {
    // « l'inventaire se dresse AVANT les écritures d'inventaire » · un
    // exercice clos n'ouvre plus de campagne.
    await refus(c, R, 'SA · campagne d’inventaire sur l’exercice clos', 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-31', libelle: 'Essai après clôture' }, 403, /clos/);
    // § 5.3 · « la valeur comptable à l'OUVERTURE » est la clôture de
    // l'exercice PRÉCÉDENT · un report de 2027 vers 2026 n'a pas de sens.
    const base = { obligationExiste: true, resulteEvenementPasse: true, sortieProbable: true, estimationFiable: true };
    await c.geste('Provision P4 née en 2027', 'POST', `/provisions/${n1}`, {
      ...base, objet: 'Litige commercial né en 2027', nature: 'LITIGE', compteId: compte(c, '19100000'), statut: 'COMPTABILISEE',
      justificationObligation: 'Assignation du 10/10/2027', echeanceAttendue: '2029-06-30', dotationsExercice: 300_000,
    });
    await refus(c, R, 'SA · report des provisions de 2027 vers 2026 (à rebours)', 'POST', '/provisions/reporter/ouverture', { exerciceSourceId: n1, exerciceCibleId: n }, 400);
  });

  // SONDE · le registre des provisions d'un exercice CLÔTURÉ se retouche-t-il ?
  await etape(R, 'Sonde · provision 2026 retouchée après la clôture', async () => {
    const lignes = (await c.lire('Provisions 2026 après clôture', `/provisions?exerciceId=${n}`)) ?? [];
    const p1 = lignes.find((l) => l.objet?.startsWith('Litige prud'));
    if (!p1) return;
    const r = await c.req('PATCH', `/provisions/${p1.id}`, { dotationsExercice: 2_000_000 });
    R.note(`SA · SONDE provision P1 de 2026 retouchée après la clôture de 2026 · statut ${r.statut} · ${texteRefus(r.corps).slice(0, 160)}`);
    if (r.statut < 400) await c.req('PATCH', `/provisions/${p1.id}`, { dotationsExercice: 1_500_000 });
  });
}

// --- SA · provisions ----------------------------------------------------------------

async function provisionsSa(c, R, n, ctx, passer, od) {
  const id = (num) => compte(c, num);
  const base = {
    obligationExiste: true, resulteEvenementPasse: true, sortieProbable: true, estimationFiable: true,
  };
  // P1 · litige prud'homal, échéance au-delà d'un an (30/06/2028 contre
  // clôture 31/12/2026 + 1 an = 31/12/2027) · au 19, compte 191 du litige.
  const p1 = await c.geste('Provision P1 · litige prud’homal', 'POST', `/provisions/${n}`, {
    ...base, objet: 'Litige prud’homal ancien directeur commercial', nature: 'LITIGE', compteId: id('19100000'), statut: 'COMPTABILISEE',
    justificationObligation: 'Assignation du 15/09/2026 devant le tribunal du travail, avis de l’avocat du 10/12/2026',
    echeanceAttendue: '2028-06-30', dotationsExercice: 1_500_000, incertitudes: 'Montant demandé 2 500 000, estimation de l’avocat 1 500 000',
  });
  // P2 · litige fournisseur jugé en mars 2027 · à moins d'un an, au 4991
  // (fiche du compte 49 ; ligne A16), doté par le 6591.
  const p2 = await c.geste('Provision P2 · litige fournisseur à court terme', 'POST', `/provisions/${n}`, {
    ...base, objet: 'Pénalités de retard réclamées par un fournisseur', nature: 'LITIGE', compteId: id('49910000'), statut: 'COMPTABILISEE',
    courtTerme: true, justificationObligation: 'Mise en demeure du 20/11/2026, audience fixée au 15/03/2027',
    echeanceAttendue: '2027-03-31', dotationsExercice: 400_000,
  });
  // P3 · PASSIF ÉVENTUEL · la sortie n'est pas probable (§ 2.1) · motif écrit,
  // aucun compte, aucun montant.
  const p3 = await c.geste('Provision P3 · passif éventuel', 'POST', `/provisions/${n}`, {
    obligationExiste: true, resulteEvenementPasse: true, sortieProbable: false, estimationFiable: true,
    objet: 'Réclamation d’un client sur une livraison de 2026', nature: 'LITIGE', statut: 'PASSIF_EVENTUEL',
    justificationObligation: 'Courrier du client du 05/12/2026', motifNonComptabilisation: 'Sortie de ressources jugée possible mais non probable par la direction',
    incertitudes: 'Le client n’a engagé aucune procédure',
  });
  ctx.provisions = { p1, p2, p3 };

  // LES REFUS DU MODULE.
  await refus(c, R, 'SA · provision à plus d’un an portée au 499', 'POST', `/provisions/${n}`, {
    ...base, objet: 'Essai long terme au 499', nature: 'LITIGE', compteId: id('49910000'), statut: 'COMPTABILISEE',
    justificationObligation: 'Essai', echeanceAttendue: '2028-12-31', dotationsExercice: 100_000,
  }, 400, /plus d'un an se porte au 19/);
  await refus(c, R, 'SA · provision à moins d’un an portée au 19', 'POST', `/provisions/${n}`, {
    ...base, objet: 'Essai court terme au 19', nature: 'LITIGE', compteId: id('19100000'), statut: 'COMPTABILISEE', courtTerme: true,
    justificationObligation: 'Essai', echeanceAttendue: '2027-03-31', dotationsExercice: 100_000,
  }, 400, /moins d'un an se porte au 4991/);
  await refus(c, R, 'SA · échéance dans l’année déclarée à long terme', 'POST', `/provisions/${n}`, {
    ...base, objet: 'Essai horizon', nature: 'LITIGE', compteId: id('19100000'), statut: 'COMPTABILISEE',
    justificationObligation: 'Essai', echeanceAttendue: '2027-06-30', dotationsExercice: 100_000,
  }, 400, /tombe dans l'année qui suit la clôture/);
  await refus(c, R, 'SA · provision comptabilisée sans sortie probable', 'POST', `/provisions/${n}`, {
    ...base, sortieProbable: false, objet: 'Essai conditions', nature: 'LITIGE', compteId: id('19100000'), statut: 'COMPTABILISEE',
    justificationObligation: 'Essai', echeanceAttendue: '2028-06-30', dotationsExercice: 100_000,
  }, 400, /PASSIF_EVENTUEL/);
  await refus(c, R, 'SA · passif éventuel sans motif écrit', 'POST', `/provisions/${n}`, {
    ...base, sortieProbable: false, objet: 'Essai passif sans motif', nature: 'LITIGE', statut: 'PASSIF_EVENTUEL', justificationObligation: 'Essai',
  }, 400, /sans motif écrit/);
  await refus(c, R, 'SA · provision pour grosses réparations comptabilisée (interdite, § 4.11.2)', 'POST', `/provisions/${n}`, {
    ...base, objet: 'Révision de la chaudière', nature: 'GROSSES_REPARATIONS', statut: 'COMPTABILISEE', justificationObligation: 'Plan d’entretien',
  }, 400, /INTERDITES/);
  await refus(c, R, 'SA · nature SYCEBNL (charges sur donations et legs) refusée au SYSCOHADA', 'POST', `/provisions/${n}`, {
    ...base, objet: 'Essai 192 SYCEBNL', nature: 'CHARGES_DONATIONS_LEGS', statut: 'EN_EXAMEN', justificationObligation: 'Essai',
  }, 400, /n'existe pas dans le plan de comptes SYSCOHADA/);
  await refus(c, R, 'SA · litige porté au compte d’une autre nature (1988)', 'POST', `/provisions/${n}`, {
    ...base, objet: 'Essai 1988', nature: 'LITIGE', compteId: id('19880000'), statut: 'COMPTABILISEE',
    justificationObligation: 'Essai', echeanceAttendue: '2028-06-30', dotationsExercice: 100_000,
  }, 400, /n'est pas un 191/);
  await refus(c, R, 'SA · remboursement attendu non certain (§ 3.1.4)', 'POST', `/provisions/${n}`, {
    ...base, objet: 'Essai remboursement', nature: 'LITIGE', compteId: id('19100000'), statut: 'COMPTABILISEE',
    justificationObligation: 'Essai', echeanceAttendue: '2028-06-30', dotationsExercice: 100_000, remboursementAttendu: 50_000,
  }, 400, /CERTAIN/);
  await refus(c, R, 'SA · restructuration sans ses conditions propres (§ 4.1)', 'POST', `/provisions/${n}`, {
    ...base, objet: 'Fermeture du dépôt de Likasi', nature: 'RESTRUCTURATION', compteId: id('19700000'), statut: 'COMPTABILISEE',
    justificationObligation: 'Décision du conseil', echeanceAttendue: '2028-06-30', dotationsExercice: 100_000,
  }, 400, /conditions/);
  // La grosse réparation se PROPOSE (en examen) pour être refusée au passage
  // en comptabilisée, avec sa voie de rechange.
  const gr = await c.geste('Provision pour grosses réparations en examen', 'POST', `/provisions/${n}`, {
    objet: 'Révision de la chaudière (en examen)', nature: 'GROSSES_REPARATIONS', statut: 'EN_EXAMEN', justificationObligation: 'Plan d’entretien',
  });
  if (gr) {
    await refus(c, R, 'SA · grosses réparations passées en comptabilisée', 'PATCH', `/provisions/${gr.id}/statut`, { statut: 'COMPTABILISEE' }, 400, /composant/i);
  }

  // Les dotations, passées par l'administrateur au dernier jour (le module ne
  // poste rien · « ni écriture », § 3.1.1).
  await passer(c, 'Dotation P1', '2026-12-31', 'Dotation provision litige prud’homal', [['69110000', 1_500_000, 0], ['19100000', 0, 1_500_000]], { journal: od, reference: 'PV-PROV-01' });
  await passer(c, 'Dotation P2', '2026-12-31', 'Dotation provision litige fournisseur', [['65910000', 400_000, 0], ['49910000', 0, 400_000]], { journal: od, reference: 'PV-PROV-02' });
  await validerJusqua(c, n, '2026-12-31');

  const v = await c.lire('Tableau de variation des provisions 2026', `/provisions/variation/${n}`);
  if (v) {
    // Dotations · 1 500 000 (P1) + 400 000 (P2) + 0 (P3, grosses réparations).
    R.montant('SA 2026 · provisions · dotations de l’exercice', 1_900_000, v.totaux?.dotationsExercice);
    R.montant('SA 2026 · provisions · montant de clôture', 1_900_000, v.totaux?.montantCloture);
    R.montant('SA 2026 · provisions · passifs éventuels listés', 1, v.passifsEventuels?.length);
    const r191 = (v.rapprochement ?? []).find((x) => x.numero === '19100000');
    const r499 = (v.rapprochement ?? []).find((x) => x.numero === '49910000');
    // Rapprochement en valeur absolue · registre 1 500 000 contre |−1 500 000|.
    R.montant('SA 2026 · rapprochement 19100000 · registre', 1_500_000, r191?.montantRegistre);
    R.montant('SA 2026 · rapprochement 19100000 · solde comptable', 1_500_000, r191?.soldeComptable);
    R.montant('SA 2026 · rapprochement 19100000 · écart', 0, r191?.ecart);
    R.montant('SA 2026 · rapprochement 49910000 · écart', 0, r499?.ecart);
    R.montant('SA 2026 · rapprochement · aucun compte pour le passif éventuel', 2, v.rapprochement?.length);
    // Ligne A16 · le court terme du SYSCOHADA porte quatre comptes (4991,
    // 4997, 4998, 599).
    R.egal('SA 2026 · comptes de court terme servis (SYSCOHADA)', ['4991', '4997', '4998', '599'], (v.comptesCourtTerme ?? []).map((x) => x.compte));
  }
}

// --- SA · inventaire --------------------------------------------------------------

async function inventaireSa(c, R, n, ctx, passer, od) {
  const camp = await c.geste('Campagne d’inventaire 2026', 'POST', '/inventaire', {
    exerciceId: n, dateInventaire: '2026-12-31', libelle: 'Inventaire de clôture 2026', instructions: 'Instruction générale du 01/12/2026',
  });
  if (!camp) return;
  const scStock = await c.geste('Sous-commission stocks', 'POST', `/inventaire/${camp.id}/sous-commissions`, { nom: 'Magasin central', perimetre: 'Marchandises' });
  const scCaisse = await c.geste('Sous-commission caisse siège', 'POST', `/inventaire/${camp.id}/sous-commissions`, { nom: 'Caisse siège' });
  const scAgence = await c.geste('Sous-commission caisse agence', 'POST', `/inventaire/${camp.id}/sous-commissions`, { nom: 'Caisse agence' });
  for (const sc of [scStock, scCaisse]) {
    if (!sc) continue;
    await c.geste('Membre inventoriant', 'POST', `/inventaire/sous-commissions/${sc.id}/membres`, { nom: 'Jean Mbuyi', fonction: 'Magasinier', role: 'INVENTORIANT' });
    await c.geste('Membre témoin', 'POST', `/inventaire/sous-commissions/${sc.id}/membres`, { nom: 'Claire Ngalula', fonction: 'Contrôleuse', role: 'TEMOIN' });
  }
  // La sous-commission de l'agence n'a qu'un inventoriant · son PV se refuse.
  if (scAgence) await c.geste('Membre inventoriant de l’agence', 'POST', `/inventaire/sous-commissions/${scAgence.id}/membres`, { nom: 'Paul Kasongo', role: 'INVENTORIANT' });

  const f1 = await c.geste('Fiche · marchandises A1', 'POST', `/inventaire/${camp.id}/fiches`, { compteId: compte(c, '31110000'), sousCommissionId: scStock?.id, designation: 'Marchandises A1 · rayon nord', uniteMesure: 'carton' });
  const f2 = await c.geste('Fiche · marchandises A2', 'POST', `/inventaire/${camp.id}/fiches`, { compteId: compte(c, '31120000'), sousCommissionId: scStock?.id, designation: 'Marchandises A2 · lot trouvé hors fichier', uniteMesure: 'carton' });
  if (f1) await c.geste('Comptage A1', 'PATCH', `/inventaire/fiches/${f1.id}`, { quantiteComptee: 470, valeurInventaire: 9_400_000, referencePiece: 'FC-001' });
  // UNE FICHE NON VALORISÉE REFUSE LE RAPPROCHEMENT · « pas encore compté »
  // n'est pas zéro.
  await refus(c, R, 'SA · rapprochement avec une fiche non valorisée', 'POST', `/inventaire/${camp.id}/rapprocher`, {}, 400, /sans valeur d'inventaire/);
  if (f2) await c.geste('Comptage A2', 'PATCH', `/inventaire/fiches/${f2.id}`, { quantiteComptee: 10, valeurInventaire: 200_000, referencePiece: 'FC-002' });

  // LES CAISSES À COMPTER avant tout PV · 57110000 (1 700 000) et 57210000
  // (500 000) ; le 57310000, mouvementé mais à solde nul, n'est pas réclamé.
  const nonComptees = await c.lire('Caisses non comptées', `/inventaire/${camp.id}/caisses-non-comptees`);
  R.egal('SA 2026 · caisses à solde non nul sans PV (le 57310000 à solde nul écarté)', ['57110000', '57210000'], (nonComptees ?? []).map((x) => x.numero));
  R.montant('SA 2026 · caisse siège à compter · solde', 1_700_000, (nonComptees ?? []).find((x) => x.numero === '57110000')?.solde);

  const rap = await c.geste('Rapprochement de l’inventaire', 'POST', `/inventaire/${camp.id}/rapprocher`, {});
  const ecarts = rap?.ecarts ?? [];
  const eA1 = ecarts.find((e) => e.compte?.numero === '31110000');
  const eA2 = ecarts.find((e) => e.compte?.numero === '31120000');
  // A1 · 9 400 000 comptés contre 10 000 000 au livre-journal · manquant
  // 600 000. A2 · 200 000 contre 0 · excédent 200 000.
  R.montant('SA 2026 · écart A1 (manquant)', -600_000, eA1?.ecart);
  R.montant('SA 2026 · solde figé A1', 10_000_000, eA1?.soldeComptable);
  R.montant('SA 2026 · écart A2 (excédent)', 200_000, eA2?.ecart);
  if (eA2) {
    // AUDCIF art. 43 · un excédent ne se redresse pas.
    await refus(c, R, 'SA · excédent arbitré « à redresser »', 'PATCH', `/inventaire/ecarts/${eA2.id}`, { decision: 'A_REDRESSER', responsable: 'Magasinier' }, 400, /EXCÉDENT/);
    await c.geste('Arbitrage A2 · excédent non comptabilisé', 'PATCH', `/inventaire/ecarts/${eA2.id}`, { decision: 'EXCEDENT_NON_COMPTABILISE', explication: 'Lot reçu en consignation, non facturé · maintenu hors bilan (art. 43)' });
    const prop2 = await c.lire('Proposition sur l’excédent', `/inventaire/ecarts/${eA2.id}/proposition`);
    R.egal('SA 2026 · aucune écriture proposée sur un excédent', false, prop2?.proposable);
  }
  if (eA1) {
    await refus(c, R, 'SA · manquant à redresser sans responsable', 'PATCH', `/inventaire/ecarts/${eA1.id}`, { decision: 'A_REDRESSER' }, 400, /responsable/);
    await c.geste('Arbitrage A1 · à redresser', 'PATCH', `/inventaire/ecarts/${eA1.id}`, { decision: 'A_REDRESSER', responsable: 'Chef magasinier' });
    const prop = await c.lire('Proposition de redressement A1', `/inventaire/ecarts/${eA1.id}/proposition`);
    const credit = (prop?.lignes ?? []).find((l) => l.sens === 'CREDIT');
    const debit = (prop?.lignes ?? []).find((l) => l.sens === 'DEBIT');
    R.egal('SA 2026 · redressement proposé · compte crédité', '31110000', credit?.compte);
    R.montant('SA 2026 · redressement proposé · montant', 600_000, credit?.montant);
    R.egal('SA 2026 · redressement proposé · contrepartie laissée vide', null, debit?.compte ?? null);
    const e = await passer(c, 'Redressement du manquant A1', '2026-12-31', 'Manquant d’inventaire marchandises A1', [['60310000', 600_000, 0], ['31110000', 0, 600_000]], { journal: od, reference: 'PV-INV-2026' });
    if (e) {
      await validerJusqua(c, n, '2026-12-31');
      await c.geste('Rattachement du redressement', 'POST', `/inventaire/ecarts/${eA1.id}/ecriture`, { ecritureId: e.id });
    }
  }

  // CLÔTURE DE LA CAMPAGNE · refusée tant qu'une caisse à solde non nul n'a
  // pas son PV (CPCC § VI).
  await refus(c, R, 'SA · campagne close sans PV des caisses', 'POST', `/inventaire/${camp.id}/clore`, {}, 403, /sans procès-verbal de comptage/);

  // PV DE COMPTAGE DE CAISSE · quatre refus, puis les deux PV.
  const baseCaisse = { sousCommissionId: scCaisse?.id, dateComptage: '2026-12-31', heureComptage: '17h30', modeComparaison: 'FRANCS' };
  await refus(c, R, 'SA · PV de comptage sur une banque (52)', 'POST', `/inventaire/${camp.id}/pv-caisse`, { ...baseCaisse, compteId: compte(c, '52110000'), especesComptees: 1 }, 400, /n'est pas une caisse/);
  await refus(c, R, 'SA · PV de caisse sans témoin dans la sous-commission', 'POST', `/inventaire/${camp.id}/pv-caisse`, { ...baseCaisse, sousCommissionId: scAgence?.id, compteId: compte(c, '57210000'), especesComptees: 500_000 }, 400, /témoin/);
  await refus(c, R, 'SA · ventilation par coupure différente du total', 'POST', `/inventaire/${camp.id}/pv-caisse`, { ...baseCaisse, compteId: compte(c, '57110000'), especesComptees: 1_690_000, coupures: [{ valeurUnitaire: 20_000, nombre: 84 }] }, 400, /ventilation par coupure/);
  await refus(c, R, 'SA · attestation sans signataire', 'POST', `/inventaire/${camp.id}/pv-caisse`, { ...baseCaisse, compteId: compte(c, '57110000'), especesComptees: 1_690_000, attestationEtablieLe: '2026-12-31' }, 400, /signataire|nommez/);
  const apercu = await c.lire('Aperçu du PV de la caisse siège', `/inventaire/${camp.id}/pv-caisse/apercu?compteId=${compte(c, '57110000')}&dateComptage=2026-12-31`);
  R.montant('SA 2026 · aperçu du PV · solde du livre-journal à la date du comptage', 1_700_000, apercu?.soldeComptable ?? apercu?.solde);
  // Caisse siège · 84 × 20 000 + 1 × 10 000 = 1 690 000 comptés contre
  // 1 700 000 au livre-journal · écart −10 000.
  const pv = await c.geste('PV de comptage · caisse siège', 'POST', `/inventaire/${camp.id}/pv-caisse`, {
    ...baseCaisse, compteId: compte(c, '57110000'), especesComptees: 1_690_000,
    coupures: [{ valeurUnitaire: 20_000, nombre: 84 }, { valeurUnitaire: 10_000, nombre: 1 }],
    attestationEtablieLe: '2026-12-31', attestationPar: 'Directeur financier', observations: 'Écart de 10 000 non expliqué au comptage',
  });
  R.montant('SA 2026 · PV caisse siège · solde figé', 1_700_000, pv?.soldeComptableFige);
  R.montant('SA 2026 · PV caisse siège · écart', -10_000, pv?.ecart);
  await refus(c, R, 'SA · second PV pour la même caisse', 'POST', `/inventaire/${camp.id}/pv-caisse`, { ...baseCaisse, compteId: compte(c, '57110000'), especesComptees: 1_700_000 }, 409, /existe déjà/);
  const pvA = await c.geste('PV de comptage · caisse agence', 'POST', `/inventaire/${camp.id}/pv-caisse`, { ...baseCaisse, compteId: compte(c, '57210000'), especesComptees: 500_000 });
  R.montant('SA 2026 · PV caisse agence · écart', 0, pvA?.ecart);
  const reste = await c.lire('Caisses non comptées après les PV', `/inventaire/${camp.id}/caisses-non-comptees`);
  R.egal('SA 2026 · plus aucune caisse à compter', [], (reste ?? []).map((x) => x.numero));

  await c.geste('Procès-verbal de la campagne', 'POST', `/inventaire/${camp.id}/proces-verbal`, { dateEtablissement: '2027-01-05' });
  const close = await c.geste('Clôture de la campagne d’inventaire', 'POST', `/inventaire/${camp.id}/clore`, {});
  R.egal('SA 2026 · campagne d’inventaire close', 'CLOTUREE', close?.statut);
  ctx.campagne = camp;
  if (f1) await refus(c, R, 'SA · comptage retouché après la clôture de la campagne', 'PATCH', `/inventaire/fiches/${f1.id}`, { valeurInventaire: 1 }, 403, /figés/);

  // SONDE · UN INVENTAIRE TOURNANT DATÉ DU 15 DÉCEMBRE. Au 15/12 le 31110000
  // vaut 10 000 000 (le redressement de 600 000 est du 31/12) ; compté
  // 10 000 000, l'écart à cette date est nul. Le rapprochement lit-il la
  // balance à la date de la campagne ou à la fin de l'exercice ?
  const tournant = await c.geste('Campagne tournante au 15/12', 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-15', libelle: 'Inventaire tournant A1' });
  if (tournant) {
    const ft = await c.geste('Fiche A1 au 15/12', 'POST', `/inventaire/${tournant.id}/fiches`, { compteId: compte(c, '31110000'), designation: 'Marchandises A1 au 15/12' });
    if (ft) await c.geste('Comptage A1 au 15/12', 'PATCH', `/inventaire/fiches/${ft.id}`, { quantiteComptee: 500, valeurInventaire: 10_000_000, referencePiece: 'FC-T01' });
    const rt = await c.geste('Rapprochement au 15/12', 'POST', `/inventaire/${tournant.id}/rapprocher`, {});
    const et = (rt?.ecarts ?? [])[0];
    // Le PV de caisse compare au livre-journal À LA DATE DU COMPTAGE (ligne
    // A10) · la fiche se juge de même contre le solde à la date de la
    // campagne (AUDCIF art. 42, « à leur valeur effective du moment »).
    R.montant('SA · inventaire tournant au 15/12 · solde figé à la date de la campagne', 10_000_000, et?.soldeComptable);
    R.montant('SA · inventaire tournant au 15/12 · écart (comptage 10 000 000 contre 10 000 000)', 0, et?.ecart);
  }
}

// --- SA · circularisation -----------------------------------------------------------

async function circularisationClientsSa(c, R, n, t) {
  await refus(c, R, 'SA · campagne arrêtée hors de l’exercice', 'POST', '/circularisation', {
    exerciceId: n, libelle: 'Essai hors exercice', dateArrete: '2027-03-31', cycle: 'CLIENTS_ADHERENTS',
  }, 400, /doit tomber dans l'exercice/);

  // UNE CAMPAGNE INTERMÉDIAIRE AU 30 JUIN (audit final F70 à F72) · les soldes
  // sont lus À CETTE DATE · C1 12 000 000 − 4 000 000 (encaissé le 30/06) =
  // 8 000 000 ; C2 8 000 000 (réglé le 31/07) ; C3 3 000 000 ; C4 pas encore
  // facturé · total 19 000 000.
  const inter = await c.geste('Campagne clients au 30 juin', 'POST', '/circularisation', {
    exerciceId: n, libelle: 'Confirmation intermédiaire clients', dateArrete: '2026-06-30', cycle: 'CLIENTS_ADHERENTS',
  });
  if (inter) {
    const e = await c.lire('Échantillon au 30 juin', `/circularisation/${inter.id}/echantillon`);
    R.montant('SA · circularisation au 30/06 · total du cycle', 19_000_000, e?.totalCycle);
    R.egal('SA · circularisation au 30/06 · comptes candidats', [t.c1.numero, t.c2.numero, t.c3.numero].sort(), (e?.candidats ?? []).map((x) => x.numero).sort());
  }

  const camp = await c.geste('Campagne clients au 31 décembre', 'POST', '/circularisation', {
    exerciceId: n, libelle: 'Confirmation des soldes clients 2026', dateArrete: '2026-12-31', cycle: 'CLIENTS_ADHERENTS',
    methodeSelection: 'Tous les soldes non nuls du cycle',
  });
  if (!camp) return;
  const ech = await c.lire('Échantillon clients au 31/12', `/circularisation/${camp.id}/echantillon`);
  // C1 8 000 000 + C3 2 000 000 + C4 1 000 000 = 11 000 000 ; C2 soldé écarté.
  R.montant('SA · circularisation clients · total du cycle', 11_000_000, ech?.totalCycle);
  R.egal('SA · circularisation clients · ordre des candidats (du plus gros au plus petit)', [t.c1.numero, t.c3.numero, t.c4.numero], (ech?.candidats ?? []).map((x) => x.numero));
  // Poids · 8/11 = 72,73 % ; 2/11 = 18,18 % ; 1/11 = 9,09 %.
  R.montant('SA · circularisation clients · poids de C1', 72.73, (ech?.candidats ?? [])[0]?.poids);
  R.montant('SA · circularisation clients · poids de C4', 9.09, (ech?.candidats ?? [])[2]?.poids);

  const d = {};
  for (const [cle, tt, nom] of [['c1', t.c1, 'Mines du Katanga'], ['c3', t.c3, 'Pharmacie Centrale'], ['c4', t.c4, 'Hôtel du Lac']]) {
    d[cle] = await c.geste(`Demande de confirmation ${nom}`, 'POST', `/circularisation/${camp.id}/demandes`, { compteId: tt.compteId, tiersId: tt.id, destinataire: nom });
  }
  R.montant('SA · lettre C1 · solde à confirmer (balance au 31/12)', 8_000_000, nb(d.c1?.soldeAConfirmer));
  await refus(c, R, 'SA · seconde lettre sur le même compte', 'POST', `/circularisation/${camp.id}/demandes`, { compteId: t.c1.compteId, destinataire: 'Mines du Katanga bis' }, 409, /déjà sa demande/);
  await refus(c, R, 'SA · campagne close avant l’envoi', 'POST', `/circularisation/${camp.id}/clore`, {}, 403, /PREPARATION|statut/);
  const env = await c.geste('Envoi des lettres clients', 'POST', `/circularisation/${camp.id}/envoyer`, { date: '2027-01-10' });
  R.egal('SA · circularisation clients · campagne envoyée', 'ENVOYEE', env?.statut);
  await refus(c, R, 'SA · lettre ajoutée après l’envoi', 'POST', `/circularisation/${camp.id}/demandes`, { compteId: t.c2.compteId, destinataire: 'Brasserie de l’Est' }, 403, /PREPARATION/);

  if (d.c1) await c.geste('Réponse de C1 · concordante', 'PATCH', `/circularisation/demandes/${d.c1.id}`, { statut: 'REPONSE_RECUE', date: '2027-01-25', soldeConfirme: 8_000_000 });
  if (d.c3) {
    // C3 dit devoir 1 800 000 · écart −200 000, un règlement en route (§ A22, délai).
    await refus(c, R, 'SA · écart non qualifié (ISA 505 § 14)', 'PATCH', `/circularisation/demandes/${d.c3.id}`, { statut: 'REPONSE_RECUE', soldeConfirme: 1_800_000 }, 400, /à qualifier/);
    await refus(c, R, 'SA · écart qualifié sans investigation', 'PATCH', `/circularisation/demandes/${d.c3.id}`, { statut: 'REPONSE_RECUE', soldeConfirme: 1_800_000, natureEcart: 'DELAI' }, 400, /investigation/);
    const r3 = await c.geste('Réponse de C3 · écart qualifié', 'PATCH', `/circularisation/demandes/${d.c3.id}`, {
      statut: 'REPONSE_RECUE', date: '2027-01-28', soldeConfirme: 1_800_000, natureEcart: 'DELAI',
      investigation: 'Chèque de 200 000 émis le 30/12/2026, encaissé le 05/01/2027 (relevé de janvier)',
    });
    R.montant('SA · réponse de C3 · écart calculé', -200_000, nb(r3?.ecart));
  }
  if (d.c4) {
    await refus(c, R, 'SA · dépouillement en « envoyée »', 'PATCH', `/circularisation/demandes/${d.c4.id}`, { statut: 'ENVOYEE' }, 400, /classe une lettre partie/);
    await c.geste('C4 · sans réponse', 'PATCH', `/circularisation/demandes/${d.c4.id}`, { statut: 'SANS_REPONSE' });
  }
  if (d.c1) await refus(c, R, 'SA · procédures alternatives sur une réponse reçue', 'PATCH', `/circularisation/demandes/${d.c1.id}/procedures-alternatives`, { proceduresAlternatives: 'Essai' }, 400, /NON-RÉPONSE/);
  const lu = await c.lire('Campagne clients après dépouillement', `/circularisation/${camp.id}`);
  R.egal('SA · circularisation clients · campagne dépouillée (chaque lettre classée)', 'DEPOUILLEE', lu?.statut);
  // ISA 505 § 12 · une non-réponse n'est pas une confirmation.
  await refus(c, R, 'SA · clôture avec une non-réponse sans procédure alternative', 'POST', `/circularisation/${camp.id}/clore`, {}, 403, /§ 12/);
  if (d.c4) await c.geste('Procédures alternatives C4', 'PATCH', `/circularisation/demandes/${d.c4.id}/procedures-alternatives`, { proceduresAlternatives: 'Facture FV-004 et bon de livraison signé, encaissement du 15/01/2027 rapproché' });
  const clos = await c.geste('Clôture de la campagne clients', 'POST', `/circularisation/${camp.id}/clore`, {});
  R.egal('SA · circularisation clients · campagne close', 'CLOTUREE', clos?.statut);
  const s = (await c.lire('Synthèse clients', `/circularisation/${camp.id}`))?.synthese;
  R.montant('SA · circularisation clients · lettres envoyées', 3, s?.envoyees);
  R.montant('SA · circularisation clients · réponses', 2, s?.reponses);
  // Taux de réponse · 2 réponses sur 3 lettres = 66,7 %.
  R.montant('SA · circularisation clients · taux de réponse', 66.7, s?.tauxReponse);
  // Taux de couverture · soldes des lettres répondues (8 000 000 + 2 000 000)
  // sur le total du cycle (11 000 000) = 90,9 %.
  R.montant('SA · circularisation clients · taux de couverture', 90.9, s?.tauxCouverture);
  R.montant('SA · circularisation clients · solde confirmé', 10_000_000, s?.soldeConfirme);
  R.montant('SA · circularisation clients · écarts', 1, s?.ecarts);
  R.montant('SA · circularisation clients · non-réponses sans procédure', 0, s?.nonReponsesSansProcedure);
  if (d.c1) await refus(c, R, 'SA · dépouillement d’une campagne close', 'PATCH', `/circularisation/demandes/${d.c1.id}`, { statut: 'SANS_REPONSE' }, 403, /close/);
}

async function circularisationFournisseursSa(c, R, n, t) {
  const toutes = ['RISQUE_FAIBLE_ET_CONTROLES_TESTES', 'POPULATION_NOMBREUSE_PETITE_HOMOGENE', 'TAUX_EXCEPTION_ATTENDU_TRES_FAIBLE', 'AUCUNE_RAISON_DE_CROIRE_A_UN_REJET'];
  // ISA 505 § 15 · la demande négative exige les QUATRE conditions.
  await refus(c, R, 'SA · demande négative sans ses quatre conditions', 'POST', '/circularisation', {
    exerciceId: n, libelle: 'Fournisseurs négative incomplète', dateArrete: '2026-12-31', cycle: 'FOURNISSEURS', forme: 'NEGATIVE', conditionsNegativeReunies: toutes.slice(0, 3),
  }, 400, /AUCUNE_RAISON_DE_CROIRE_A_UN_REJET/);
  const camp = await c.geste('Campagne fournisseurs (négative)', 'POST', '/circularisation', {
    exerciceId: n, libelle: 'Confirmation des soldes fournisseurs 2026', dateArrete: '2026-12-31', cycle: 'FOURNISSEURS', forme: 'NEGATIVE', conditionsNegativeReunies: toutes,
  });
  if (!camp) return;
  const ech = await c.lire('Échantillon fournisseurs', `/circularisation/${camp.id}/echantillon`);
  // |−2 000 000| (F1) + |−500 000| (F3) = 2 500 000 ; F2 soldé écarté.
  R.montant('SA · circularisation fournisseurs · total du cycle', 2_500_000, ech?.totalCycle);
  R.montant('SA · circularisation fournisseurs · poids de F1', 80, (ech?.candidats ?? [])[0]?.poids);
  const d1 = await c.geste('Demande F1', 'POST', `/circularisation/${camp.id}/demandes`, { compteId: t.f1.compteId, tiersId: t.f1.id, destinataire: 'Grossiste de Kinshasa' });
  const d3 = await c.geste('Demande F3', 'POST', `/circularisation/${camp.id}/demandes`, { compteId: t.f3.compteId, tiersId: t.f3.id, destinataire: 'Imprimerie Moderne' });
  const d2 = await c.geste('Demande F2 (retenue par erreur)', 'POST', `/circularisation/${camp.id}/demandes`, { compteId: t.f2.compteId, tiersId: t.f2.id, destinataire: 'Transports Rapides' });
  R.montant('SA · lettre F1 · solde à confirmer', -2_000_000, nb(d1?.soldeAConfirmer));
  if (d2) await c.geste('Retrait de la lettre F2 non partie', 'DELETE', `/circularisation/demandes/${d2.id}`);
  await c.geste('Envoi des lettres fournisseurs', 'POST', `/circularisation/${camp.id}/envoyer`, { date: '2027-01-10' });
  const rel = await c.geste('Relance des fournisseurs', 'POST', `/circularisation/${camp.id}/envoyer`, { date: '2027-02-10' });
  R.egal('SA · circularisation fournisseurs · campagne relancée', 'RELANCEE', rel?.statut);
  R.egal('SA · circularisation fournisseurs · lettres relancées', ['RELANCEE', 'RELANCEE'], (rel?.demandes ?? []).map((x) => x.statut));
  if (d1) await refus(c, R, 'SA · retrait d’une lettre partie', 'DELETE', `/circularisation/demandes/${d1.id}`, undefined, 400, /est partie/);
  // ISA 505 § 7 c) · une réponse passée par l'entité est marquée, pas rejetée.
  const r1 = d1 ? await c.geste('Réponse de F1 (parvenue par l’entité)', 'PATCH', `/circularisation/demandes/${d1.id}`, { statut: 'REPONSE_RECUE', date: '2027-02-20', soldeConfirme: -2_000_000, reponseIndirecte: true }) : null;
  R.egal('SA · réponse indirecte · doute de fiabilité inscrit', true, Boolean(r1?.doutefiabilite));
  if (d3) {
    await c.geste('F3 · lettre non distribuée', 'PATCH', `/circularisation/demandes/${d3.id}`, { statut: 'NON_DISTRIBUEE' });
    await c.geste('Procédures alternatives F3', 'PATCH', `/circularisation/demandes/${d3.id}/procedures-alternatives`, { proceduresAlternatives: 'Bon de réception et facture FA-F3-01, adresse corrigée au fichier' });
  }
  await c.geste('Clôture de la campagne fournisseurs', 'POST', `/circularisation/${camp.id}/clore`, {});
  const s = (await c.lire('Synthèse fournisseurs', `/circularisation/${camp.id}`))?.synthese;
  // 1 réponse sur 2 lettres = 50,0 % ; couverture 2 000 000 / 2 500 000 = 80,0 %.
  R.montant('SA · circularisation fournisseurs · taux de réponse', 50, s?.tauxReponse);
  R.montant('SA · circularisation fournisseurs · taux de couverture', 80, s?.tauxCouverture);
  R.montant('SA · circularisation fournisseurs · réponses indirectes', 1, s?.reponsesIndirectes);
  R.montant('SA · circularisation fournisseurs · lettres (F2 retirée)', 2, s?.demandes);
}

// --- SA · faiblesses ------------------------------------------------------------------

async function faiblessesSa(c, R, n) {
  const reg = await c.geste('Registre des faiblesses 2026 (révision interne)', 'POST', '/faiblesses', { exerciceId: n, origine: 'REVISION_INTERNE', libelle: 'Faiblesses relevées en 2026' });
  if (!reg) return null;
  await refus(c, R, 'SA · révision interne avec un émetteur de lettre', 'POST', '/faiblesses', { exerciceId: n, origine: 'REVISION_INTERNE', libelle: 'Essai', emetteur: 'Cabinet X' }, 400, /émetteur|lettre/);
  await refus(c, R, 'SA · indicateur hors § A7', 'POST', `/faiblesses/${reg.id}/faiblesses`, {
    reference: 'X-01', intitule: 'Essai', description: 'Essai', effetPotentiel: 'Essai', indicateursA7: ['INDICATEUR_INVENTE'],
  }, 400, /hors § A7/);
  const ajout = (reference, intitule, indicateursA7) => c.geste(`Faiblesse ${reference}`, 'POST', `/faiblesses/${reg.id}/faiblesses`, {
    reference, intitule, description: `${intitule} · constat des travaux de révision`, effetPotentiel: 'Risque de détournement ou d’erreur non détectée',
    recommandation: 'Mettre en place une procédure écrite', indicateursA7,
  });
  const f1 = await ajout('F-01', 'Une seule personne encaisse, enregistre et compte la caisse', ['ENVIRONNEMENT_DE_CONTROLE_INEFFICACE']);
  const f2 = await ajout('F-02', 'Aucun rapprochement bancaire mensuel', []);
  const f3 = await ajout('F-03', 'Bons de commande non numérotés', []);
  R.egal('SA · faiblesse ajoutée non qualifiée', 'NON_QUALIFIEE', f1?.qualification);
  await refus(c, R, 'SA · registre clos avec des faiblesses non qualifiées (§ 8)', 'POST', `/faiblesses/${reg.id}/clore`, {}, 403, /non qualifiée/);
  if (f3) await refus(c, R, 'SA · écrit avant qualification', 'PATCH', `/faiblesses/faiblesses/${f3.id}/communication`, { communiqueeLe: '2027-02-15', communiqueeA: 'Direction générale' }, 400, /Qualifier d'abord/);
  if (f1) await refus(c, R, 'SA · « non qualifiée » n’est pas une décision', 'PATCH', `/faiblesses/faiblesses/${f1.id}/qualification`, { qualification: 'NON_QUALIFIEE', justification: 'Essai' }, 400, /état de départ/);
  if (f1) await c.geste('Qualification F-01 · significative', 'PATCH', `/faiblesses/faiblesses/${f1.id}/qualification`, { qualification: 'SIGNIFICATIVE', justification: 'Cumul des fonctions incompatibles sur la caisse, écart de comptage constaté au PV' });
  if (f2) await c.geste('Qualification F-02 · autre', 'PATCH', `/faiblesses/faiblesses/${f2.id}/qualification`, { qualification: 'AUTRE', justification: 'Rapprochement fait à la clôture, aucun écart relevé' });
  if (f3) await c.geste('Qualification F-03 · autre', 'PATCH', `/faiblesses/faiblesses/${f3.id}/qualification`, { qualification: 'AUTRE', justification: 'Volume d’achats faible' });
  // § 9 · une significative se communique PAR ÉCRIT à la gouvernance.
  await refus(c, R, 'SA · registre clos avec une significative jamais écrite (§ 9)', 'POST', `/faiblesses/${reg.id}/clore`, {}, 403, /IN WRITING|écrit/i);
  if (f1) await c.geste('Écrit F-01 à la gouvernance', 'PATCH', `/faiblesses/faiblesses/${f1.id}/communication`, { communiqueeLe: '2027-02-15', communiqueeA: 'Conseil d’administration' });
  if (f3) await c.geste('Écrit F-03 à la direction', 'PATCH', `/faiblesses/faiblesses/${f3.id}/communication`, { communiqueeLe: '2027-02-15', communiqueeA: 'Direction générale' });
  // § A24 · l'escalade est un acte daté et motivé · elle remet l'écrit à faire.
  if (f2) {
    await refus(c, R, 'SA · escalade sans motif', 'POST', `/faiblesses/faiblesses/${f2.id}/escalade`, { motif: ' ' }, 400, /motif|jugement/i);
    const esc = await c.geste('Escalade F-02 en significative', 'POST', `/faiblesses/faiblesses/${f2.id}/escalade`, { motif: 'Non remédiée malgré la lettre de l’exercice précédent' });
    R.egal('SA · F-02 escaladée en significative', 'SIGNIFICATIVE', esc?.qualification);
    await refus(c, R, 'SA · registre clos après escalade sans écrit', 'POST', `/faiblesses/${reg.id}/clore`, {}, 403, /F-02/);
    await c.geste('Écrit F-02 à la gouvernance', 'PATCH', `/faiblesses/faiblesses/${f2.id}/communication`, { communiqueeLe: '2027-02-20', communiqueeA: 'Conseil d’administration' });
  }
  // § A28 · la réponse est celle de la DIRECTION · l'auteur du constat ne la signe pas.
  if (f1) {
    await refus(c, R, 'SA · réponse de la direction signée par l’auteur du constat', 'PATCH', `/faiblesses/faiblesses/${f1.id}/reponse-direction`, { reponseDirection: 'Nous allons séparer les fonctions' }, 403, /auteur du constat/);
    await c.geste('Réponse de la direction F-01', 'PATCH', `/faiblesses/faiblesses/${f1.id}/reponse-direction`, { reponseDirection: 'Recrutement d’un caissier au premier trimestre 2027', reponseDirectionPar: 'M. Ilunga, directeur général' });
  }
  if (f3) {
    await refus(c, R, 'SA · remédiée sans dire si le cabinet a vérifié (§ A28)', 'PATCH', `/faiblesses/faiblesses/${f3.id}/suivi`, { statut: 'REMEDIEE' }, 400, /vérifié/);
    await c.geste('F-03 remédiée et vérifiée', 'PATCH', `/faiblesses/faiblesses/${f3.id}/suivi`, { statut: 'REMEDIEE', verificationCabinet: 'Carnet de bons numérotés constaté le 20/02/2027' });
  }
  const lu = await c.lire('Registre 2026 avant clôture', `/faiblesses/${reg.id}`);
  // § 11 b) · trois mentions de contexte (ce n'est pas un audit, l'examen
  // oriente les travaux, le registre ne recense pas tout).
  R.montant('SA · faiblesses · mentions du § 11 b) servies', 3, lu?.mentionsContexte?.length);
  const avant = lu?.synthese;
  // F-01 et F-02 significatives (F-02 par escalade), F-03 autre et remédiée.
  R.montant('SA · faiblesses 2026 · total', 3, avant?.total);
  R.montant('SA · faiblesses 2026 · significatives', 2, avant?.significatives);
  R.montant('SA · faiblesses 2026 · autres', 1, avant?.autres);
  R.montant('SA · faiblesses 2026 · remédiées', 1, avant?.remediees);
  R.montant('SA · faiblesses 2026 · escaladées', 1, avant?.escaladees);
  R.montant('SA · faiblesses 2026 · significatives sans écrit', 0, avant?.significativesSansEcrit);
  R.egal('SA · faiblesses 2026 · significatives non remédiées à reporter (§ A17)', ['F-01', 'F-02'], [...(avant?.referencesAReporter ?? [])].sort());
  const clos = await c.geste('Clôture du registre 2026', 'POST', `/faiblesses/${reg.id}/clore`, { motifCloture: 'Travaux de révision 2026 terminés' });
  R.egal('SA · registre 2026 clos', 'CLOS', clos?.statut);
  if (f3) await refus(c, R, 'SA · faiblesse modifiée dans un registre clos', 'PATCH', `/faiblesses/faiblesses/${f3.id}/suivi`, { statut: 'SANS_OBJET' }, 403, /clos/);

  // RECOMMANDATION EXTERNE · porte-documents.
  await refus(c, R, 'SA · lettre externe sans émetteur', 'POST', '/faiblesses', { exerciceId: n, origine: 'RECOMMANDATION_EXTERNE', libelle: 'Lettre du commissaire' }, 400, /émetteur|lettre/);
  const ext = await c.geste('Registre 2026 · lettre du commissaire aux comptes', 'POST', '/faiblesses', {
    exerciceId: n, origine: 'RECOMMANDATION_EXTERNE', libelle: 'Lettre de recommandations 2026', emetteur: 'Cabinet Kalala & Associés', dateLettre: '2027-03-20', referenceLettre: 'LR-2026-01',
  });
  if (ext) {
    const r1 = await c.geste('Recommandation R-01 (significative selon la lettre)', 'POST', `/faiblesses/${ext.id}/faiblesses`, {
      reference: 'R-01', intitule: 'Absence de procédure de clôture', description: 'Selon la lettre', effetPotentiel: 'Selon la lettre', qualification: 'SIGNIFICATIVE',
    });
    const r2 = await c.geste('Recommandation R-02 (autre selon la lettre)', 'POST', `/faiblesses/${ext.id}/faiblesses`, {
      reference: 'R-02', intitule: 'Archivage des pièces', description: 'Selon la lettre', effetPotentiel: 'Selon la lettre', qualification: 'AUTRE',
    });
    R.egal('SA · qualification de la lettre recopiée', 'SIGNIFICATIVE', r1?.qualification);
    if (r2) {
      // F73 · le cabinet ne requalifie ni n'escalade une lettre reçue.
      await refus(c, R, 'SA · requalifier une recommandation externe', 'PATCH', `/faiblesses/faiblesses/${r2.id}/qualification`, { qualification: 'SIGNIFICATIVE', justification: 'Essai' }, 403, /porte-documents/);
      await refus(c, R, 'SA · escalader une recommandation externe', 'POST', `/faiblesses/faiblesses/${r2.id}/escalade`, { motif: 'Essai' }, 403, /porte-documents/);
    }
    const cExt = await c.geste('Clôture du registre externe (sans écrit exigé)', 'POST', `/faiblesses/${ext.id}/clore`, {});
    R.egal('SA · registre externe clos sans exigence d’écrit', 'CLOS', cExt?.statut);
  }
  return { reg, ext, f1, f2, f3 };
}

async function faiblesses2027Sa(c, R, n1, faiblesses) {
  if (!faiblesses?.reg) return R.note('SA · faiblesses 2026 absentes, report non joué');
  const { f1, f2, f3, ext } = faiblesses;
  const reg = await c.geste('Registre des faiblesses 2027', 'POST', '/faiblesses', { exerciceId: n1, origine: 'REVISION_INTERNE', libelle: 'Faiblesses 2027' });
  const regExt = await c.geste('Registre externe 2027', 'POST', '/faiblesses', { exerciceId: n1, origine: 'RECOMMANDATION_EXTERNE', libelle: 'Lettre 2027', emetteur: 'Cabinet Kalala & Associés', dateLettre: '2028-01-31' });
  if (!reg) return;
  // § A17 · une significative non remédiée se REPÈTE, ou se référence.
  if (f1) {
    await refus(c, R, 'SA · report d’une significative non remédiée sans reconduire l’écrit (§ A17)', 'POST', `/faiblesses/faiblesses/${f1.id}/report`, { registreCibleId: reg.id }, 403, /§ A17|REPEAT/);
    if (regExt) await refus(c, R, 'SA · report vers un registre d’une autre origine', 'POST', `/faiblesses/faiblesses/${f1.id}/report`, { registreCibleId: regExt.id, communicationReconduite: 'Voir lettre du 15/02/2027' }, 400, /origine/);
    await refus(c, R, 'SA · report vers son propre registre', 'POST', `/faiblesses/faiblesses/${f1.id}/report`, { registreCibleId: faiblesses.reg.id, communicationReconduite: 'x' }, 403, /CLOS|statut/);
    const rep = await c.geste('Report de F-01 en 2027', 'POST', `/faiblesses/faiblesses/${f1.id}/report`, { registreCibleId: reg.id, communicationReconduite: 'Référence à l’écrit du 15/02/2027 au conseil d’administration', motifNonRemediation: 'Caissier non encore recruté' });
    R.egal('SA · F-01 reportée · qualification conservée', 'SIGNIFICATIVE', rep?.qualification);
    R.egal('SA · F-01 reportée · rouverte en 2027', 'OUVERTE', rep?.statut);
    await refus(c, R, 'SA · second report de F-01', 'POST', `/faiblesses/faiblesses/${f1.id}/report`, { registreCibleId: reg.id, communicationReconduite: 'x' }, 403, /déjà reportée/);
  }
  // F-03 remédiée · régime libre, aucun écrit à reconduire.
  if (f3) await c.geste('Report de F-03 (remédiée) en 2027', 'POST', `/faiblesses/faiblesses/${f3.id}/report`, { registreCibleId: reg.id });
  const s = (await c.lire('Registre 2027', `/faiblesses/${reg.id}`))?.synthese;
  R.montant('SA · faiblesses 2027 · reconduites', 2, s?.reconduites);
  const s26 = (await c.lire('Registre 2026 après report', `/faiblesses/${faiblesses.reg.id}`))?.synthese;
  // F-02 reste la seule significative non remédiée non reportée.
  R.egal('SA · faiblesses 2026 · reste à reporter après le report de F-01', ['F-02'], s26?.referencesAReporter);
  if (ext && f2) R.note('SA · faiblesses · F-02 laissée sans report (le registre 2026 la nomme)');
}

// --- SA · questionnaire --------------------------------------------------------------

async function questionnaireSa(c, R, n) {
  const q = await c.geste('Questionnaire de révision 2026', 'POST', '/questionnaire-revision', {
    exerciceId: n, libelle: 'Questionnaire 2026 · inventaire physique et documentaire', cycles: ['IMMOBILISATIONS', 'CAISSES', 'BANQUES', 'DETTES_FOURNISSEURS'],
  });
  if (!q) return;
  const rep = (code, corps) => c.geste(`Réponse ${code}`, 'POST', `/questionnaire-revision/${q.id}/reponses`, { code, ...corps });
  const chemin = `/questionnaire-revision/${q.id}/reponses`;
  // « À quels moments les biens ont-ils été valorisés ? » appelle une DONNÉE.
  await refus(c, R, 'SA · questionnaire · une date répondue par « Oui »', 'POST', chemin, { code: 'CPCC-IMM-1', reponse: 'OUI' }, 400, /n'est pas une question fermée/);
  await refus(c, R, 'SA · questionnaire · un travail répondu par « Oui »', 'POST', chemin, { code: 'CPCC-BAN-3', reponse: 'OUI' }, 400, /n'est pas une question fermée/);
  // « Si oui, une attestation a-t-elle été établie ? » sans le « Oui » du parent.
  await refus(c, R, 'SA · questionnaire · réponse orpheline (CAI-2 avant CAI-1)', 'POST', chemin, { code: 'CPCC-CAI-2', reponse: 'OUI' }, 400, /orpheline/);
  await refus(c, R, 'SA · questionnaire · item propre au SYCEBNL', 'POST', chemin, { code: 'VMG-ENG-3', reponse: 'OUI' }, 400, /ne se pose qu'en SYCEBNL/);
  await refus(c, R, 'SA · questionnaire · question fermée sans réponse', 'POST', chemin, { code: 'CPCC-IMM-2', commentaire: 'x' }, 400, /question fermée/);
  // LA PREMIÈRE RÉPONSE VALIDE, éprouvée seule · si elle tombe, le reste du
  // parcours (synthèses, chaînes, clôture) n'a plus d'objet et n'est pas
  // rejoué réponse par réponse.
  const premiere = await c.req('POST', chemin, { code: 'CPCC-IMM-1', valeur: 'Au 31/12/2026, lors de l’inventaire de clôture' });
  if (!R.egal('SA · questionnaire · une réponse valide s’enregistre', true, premiere.statut < 400)) {
    R.erreurHttp('Réponse CPCC-IMM-1 (donnée)', 'POST', chemin, premiere.statut, premiere.corps);
    const lu = await c.lire('Questionnaire après l’échec', `/questionnaire-revision/${q.id}`);
    R.montant('SA · questionnaire · aucune réponse conservée après l’échec', 0, lu?.reponses?.length);
    R.note('SA · questionnaire · aucune réponse ne s’enregistre · synthèses, chaînes et clôture non jouées');
    return;
  }
  await rep('CPCC-IMM-2', { reponse: 'OUI' });
  await rep('CPCC-CAI-1', { reponse: 'OUI' });
  await rep('CPCC-CAI-2', { reponse: 'OUI' });
  await rep('CPCC-CAI-3', { reponse: 'OUI', commentaire: 'Caisse siège et caisse agence comptées, caisse de secours à solde nul' });
  // Polarité inversée · « Y a-t-il un chevauchement […] ? » · le « Oui » est l'exception.
  await rep('CPCC-CAI-4', { reponse: 'OUI' });
  await rep('CPCC-CAI-5', { reponse: 'NON', commentaire: 'Écart de 10 000 de la caisse siège non encore analysé' });
  await rep('CPCC-BAN-1', { reponse: 'OUI' });
  await rep('CPCC-BAN-2', { renvoiTravaux: 'PT-BAN-02' });
  await rep('CPCC-BAN-3', { renvoiTravaux: 'PT-BAN-03' });
  await rep('CPCC-DET-1', { renvoiTravaux: 'PT-DET-01' });
  await rep('CPCC-DET-2', { reponse: 'OUI' });
  await refus(c, R, 'SA · questionnaire · « Si non » ouvert par un « Oui » (DET-3)', 'POST', chemin, { code: 'CPCC-DET-3', valeur: 'Sélection par montant' }, 400, /orpheline/);
  await rep('CPCC-DET-4', { valeur: 'Écart de F1 nul, F3 non distribuée traitée par procédure alternative' });
  let s = (await c.lire('Questionnaire · synthèse 1', `/questionnaire-revision/${q.id}`))?.synthese;
  // Questions ouvertes hors travaux · IMM-1, IMM-2, CAI-1 à CAI-5, BAN-1,
  // DET-2, DET-4 = 10 (DET-3 fermé par DET-2 = OUI) ; dix répondues.
  R.montant('SA · questionnaire · questions ouvertes', 10, s?.questions);
  R.montant('SA · questionnaire · taux de réponse', 100, s?.tauxReponse);
  // Travaux ouverts · IMM-3 à IMM-6, BAN-2, BAN-3, DET-1, DET-5 = 8 ; faits 3.
  R.montant('SA · questionnaire · travaux ouverts', 8, s?.travaux);
  R.montant('SA · questionnaire · travaux faits', 3, s?.travauxFaits);
  // Exceptions · CAI-4 « Oui » (polarité inversée) et CAI-5 « Non ».
  R.montant('SA · questionnaire · exceptions', 2, s?.exceptions);
  R.montant('SA · questionnaire · exceptions sans commentaire', 1, s?.exceptionsSansCommentaire);
  // 6 items IMM + 5 CAI + 3 BAN + 5 DET, tous du CPCC.
  R.montant('SA · questionnaire · items CPCC retenus', 19, s?.itemsCpcc);
  // La chaîne « Non → suite » · DET-2 passe à « Non », DET-3 s'ouvre.
  await rep('CPCC-DET-2', { reponse: 'NON', commentaire: 'Seuls les deux soldes non nuls ont été circularisés' });
  s = (await c.lire('Questionnaire · synthèse 2', `/questionnaire-revision/${q.id}`))?.synthese;
  // 11 questions (DET-3 ouvert), 10 répondues · 10/11 = 90,9 %.
  R.montant('SA · questionnaire · questions après DET-2 = Non', 11, s?.questions);
  R.montant('SA · questionnaire · taux de réponse avec DET-3 ouvert', 90.9, s?.tauxReponse);
  await rep('CPCC-DET-3', { valeur: 'Soldes non nuls de la balance au 31/12/2026, tirés par le module' });
  await refus(c, R, 'SA · questionnaire clos avec des travaux non faits et une exception nue', 'POST', `/questionnaire-revision/${q.id}/clore`, {}, 403, /sans réponse/);
  for (const code of ['CPCC-IMM-3', 'CPCC-IMM-4', 'CPCC-IMM-5', 'CPCC-IMM-6', 'CPCC-DET-5']) await rep(code, { renvoiTravaux: `PT-${code}` });
  await refus(c, R, 'SA · questionnaire clos avec une exception sans commentaire', 'POST', `/questionnaire-revision/${q.id}/clore`, {}, 403, /CPCC-CAI-4/);
  await rep('CPCC-CAI-4', { reponse: 'OUI', commentaire: 'Encaissement du 31/12 saisi au 02/01, reclassé' });
  const clos = await c.geste('Clôture du questionnaire', 'POST', `/questionnaire-revision/${q.id}/clore`, {});
  R.egal('SA · questionnaire clos', 'CLOS', clos?.statut);
  s = (await c.lire('Questionnaire · synthèse finale', `/questionnaire-revision/${q.id}`))?.synthese;
  R.montant('SA · questionnaire · taux de réponse final', 100, s?.tauxReponse);
  R.montant('SA · questionnaire · exceptions finales (CAI-4, CAI-5, DET-2)', 3, s?.exceptions);
  await refus(c, R, 'SA · réponse après clôture du questionnaire', 'POST', chemin, { code: 'CPCC-CAI-5', reponse: 'OUI' }, 403, /CLOS/);
}

// --- SA · mandat ------------------------------------------------------------------------

async function mandatSa(c, R) {
  const dStatuts = await c.lire('Durée proposée · statuts', '/mandat-auditeur/duree?organe=STATUTS_OU_AG_CONSTITUTIVE');
  const dAgo = await c.lire('Durée proposée · AGO', '/mandat-auditeur/duree?organe=ASSEMBLEE_GENERALE_ORDINAIRE');
  // AUSCGIE art. 704 · deux exercices par les statuts, six par l'AGO.
  R.montant('SA · mandat · durée par les statuts (art. 704 al. 1)', 2, dStatuts?.exercices);
  R.montant('SA · mandat · durée par l’AGO (art. 704 al. 2)', 6, dAgo?.exercices);
  R.egal('SA · mandat · aucun plafond de renouvellement lu', null, dAgo?.mandatsMaximum ?? null);
  const base = { nom: 'Cabinet Kalala & Associés', inscriptionOrdre: 'ONEC n° 0123', dateDesignation: '2025-01-15' };
  await refus(c, R, 'SA · mandat statutaire de trois exercices', 'POST', '/mandat-auditeur', { ...base, organeDesignation: 'STATUTS_OU_AG_CONSTITUTIVE', premierExercice: 2025, nombreExercices: 3 }, 400, /2 exercice/);
  await refus(c, R, 'SA · commissaire nommé par les associés (art. 703)', 'POST', '/mandat-auditeur', { ...base, organeDesignation: 'ASSOCIES', premierExercice: 2025, nombreExercices: 2 }, 400, /703/);
  await refus(c, R, 'SA · mandat sans inscription à l’ordre', 'POST', '/mandat-auditeur', { ...base, inscriptionOrdre: '  ', organeDesignation: 'STATUTS_OU_AG_CONSTITUTIVE', premierExercice: 2025, nombreExercices: 2 }, 400, /inscription au tableau/);
  // Premier commissaire désigné dans les statuts · exercices 2025 et 2026.
  const m = await c.geste('Mandat statutaire 2025-2026', 'POST', '/mandat-auditeur', { ...base, organeDesignation: 'STATUTS_OU_AG_CONSTITUTIVE', premierExercice: 2025, nombreExercices: 2 });
  const l = await c.lire('Mandats', '/mandat-auditeur');
  R.montant('SA · mandat · dernier exercice couvert', 2026, (l?.mandats ?? [])[0]?.dernierExerciceCouvert);
  return m;
}

async function mandat2027Sa(c, R, n1, m) {
  const codes = async (libelle) => {
    const r = await c.lire(`Contrôles ${libelle}`, `/controles?exerciceId=${n1}`);
    return new Set((r?.anomalies ?? []).map((a) => a.code));
  };
  // 2027 · le mandat (2025-2026) est échu · AUSCGIE art. 709, « sa mission est
  // prorogée jusqu'à la plus prochaine assemblée générale ordinaire annuelle »
  // · information, jamais un manquement.
  let k = await codes('2027 avant refus');
  R.egal('SA 2027 · MANDAT_AUDITEUR_PROROGE levé (art. 709)', true, k.has('MANDAT_AUDITEUR_PROROGE'));
  R.egal('SA 2027 · aucun « sans mandat » pendant la prorogation', false, k.has('AUDITEUR_OBLIGATOIRE_SANS_MANDAT'));
  if (!m) return;
  // Le refus EXPRÈS du commissaire ouvre le trou (art. 709, « sauf refus exprès »).
  await c.geste('Refus exprès de la prorogation', 'PATCH', `/mandat-auditeur/${m.id}/prorogation`, { refus: true });
  k = await codes('2027 après refus');
  R.egal('SA 2027 · MANDAT_AUDITEUR_SANS_PROROGATION levé après le refus exprès', true, k.has('MANDAT_AUDITEUR_SANS_PROROGATION'));
  R.egal('SA 2027 · plus de prorogation après le refus', false, k.has('MANDAT_AUDITEUR_PROROGE'));
  await refus(c, R, 'SA · mandat de l’AGO de cinq exercices', 'POST', '/mandat-auditeur', { nom: 'Cabinet Mbala', inscriptionOrdre: 'ONEC n° 0456', organeDesignation: 'ASSEMBLEE_GENERALE_ORDINAIRE', dateDesignation: '2027-06-30', premierExercice: 2027, nombreExercices: 5 }, 400, /6 exercice/);
  await c.geste('Nouveau mandat de l’AGO 2027-2032', 'POST', '/mandat-auditeur', { nom: 'Cabinet Mbala', inscriptionOrdre: 'ONEC n° 0456', organeDesignation: 'ASSEMBLEE_GENERALE_ORDINAIRE', dateDesignation: '2027-06-30', premierExercice: 2027, nombreExercices: 6 });
  k = await codes('2027 avec le nouveau mandat');
  R.egal('SA 2027 · aucun contrôle de mandat une fois l’exercice couvert', [], ['MANDAT_AUDITEUR_PROROGE', 'MANDAT_AUDITEUR_SANS_PROROGATION', 'AUDITEUR_OBLIGATOIRE_SANS_MANDAT'].filter((x) => k.has(x)));
}

// --- SA · manuel des procédures ------------------------------------------------------------

async function manuelSa(c, R, n) {
  const sq = await c.lire('Squelette du manuel', '/documents-obligatoires/manuel-procedures/squelette');
  const sections = Array.isArray(sq) ? sq : sq?.sections ?? [];
  R.montant('SA · manuel · squelette de sept rubriques', 7, sections.length);
  R.egal('SA · manuel · rubriques proposées vides', true, sections.length > 0 && sections.every((s) => !String(s.texte ?? '').trim()));
  let k = new Set(((await c.lire('Contrôles 2026 sans manuel', `/controles?exerciceId=${n}`))?.anomalies ?? []).map((a) => a.code));
  R.egal('SA 2026 · MANUEL_PROCEDURES_ABSENT sans manuel', true, k.has('MANUEL_PROCEDURES_ABSENT'));
  await refus(c, R, 'SA · manuel à deux sections de même clé', 'POST', '/documents-obligatoires/manuel-procedures', {
    dateApplication: '2026-01-01', sections: [{ cle: 'a', titre: 'A', texte: 'x' }, { cle: 'a', titre: 'B', texte: 'y' }],
  }, 400, /même clé/);
  await refus(c, R, 'SA · manuel sans aucune section', 'POST', '/documents-obligatoires/manuel-procedures', { dateApplication: '2026-01-01', sections: [] }, 400);
  const v1 = await c.geste('Manuel · version 1 (sans classement)', 'POST', '/documents-obligatoires/manuel-procedures', {
    dateApplication: '2026-01-01', sections: [{ cle: 'organisation', titre: 'Organisation du service comptable', texte: 'Un chef comptable, un comptable, un caissier.' }],
  });
  R.montant('SA · manuel · version 1', 1, v1?.version);
  k = new Set(((await c.lire('Contrôles 2026 manuel v1', `/controles?exerciceId=${n}`))?.anomalies ?? []).map((a) => a.code));
  // AUDCIF art. 17, 3° · sans ordre de classement défini, l'article est sans objet.
  R.egal('SA 2026 · MANUEL_SANS_ORDRE_DE_CLASSEMENT avec la version 1', true, k.has('MANUEL_SANS_ORDRE_DE_CLASSEMENT'));
  R.egal('SA 2026 · plus de MANUEL_PROCEDURES_ABSENT avec la version 1', false, k.has('MANUEL_PROCEDURES_ABSENT'));
  const v2 = await c.geste('Manuel · version 2 (avec classement)', 'POST', '/documents-obligatoires/manuel-procedures', {
    dateApplication: '2026-07-01', sections: [
      { cle: 'organisation', titre: 'Organisation du service comptable', texte: 'Un chef comptable, un comptable, un caissier.' },
      { cle: 'classement-archivage', titre: 'Classement et archivage des pièces', texte: 'Pièces classées par journal puis par numéro de pièce, archivées dix ans.' },
    ],
  });
  R.montant('SA · manuel · version 2 (une version par mise à jour, jamais un écrasement)', 2, v2?.version);
  const conf = await c.lire('Conformité du manuel', '/documents-obligatoires/manuel-procedures/conformite');
  R.montant('SA · manuel · versions conservées', 2, conf?.nombreVersions);
  R.montant('SA · manuel · version en vigueur', 2, conf?.versionEnVigueur);
  R.egal('SA · manuel · ordre de classement renseigné', true, conf?.classementRenseigne);
  k = new Set(((await c.lire('Contrôles 2026 manuel v2', `/controles?exerciceId=${n}`))?.anomalies ?? []).map((a) => a.code));
  R.egal('SA 2026 · aucun contrôle de manuel avec la version 2', [], ['MANUEL_PROCEDURES_ABSENT', 'MANUEL_SANS_ORDRE_DE_CLASSEMENT'].filter((x) => k.has(x)));
}

// --- SA · test ISA 240 ----------------------------------------------------------------------

async function testIsa240Sa(c, R, n, ctx) {
  const r = await lireTestIsa240(c, R, 'SA 2026', n);
  if (!r) return null;
  // LES ÉCRITURES DE L'EXERCICE · l'import d'ouverture (une pièce), quinze
  // opérations du comptable, deux dotations et le redressement de
  // l'administrateur · 19 pièces. Lues aussi au journal (inputs du test ·
  // auteur, date de saisie, pièce), jamais sa sélection.
  const liste = await c.lire('Écritures 2026', `/ecritures?exerciceId=${n}`);
  const ecr = Array.isArray(liste) ? liste : liste?.ecritures ?? liste?.lignes ?? [];
  R.montant('SA 2026 · ISA 240 · écritures examinées (1 import + 15 + 3)', 19, r.total);
  // AUDCIF art. 22, 4° · la date de SAISIE de chaque pièce est un fait du
  // journal · relue sur une pièce pour savoir si elle tombe après le 31/12/2026.
  const saisie = ctx.ecritures[0]?.createdAt ? new Date(ctx.ecritures[0].createdAt) : null;
  const apresCloture = saisie ? saisie > new Date('2026-12-31T00:00:00Z') : null;
  R.note(`SA 2026 · ISA 240 · date de saisie relue ${saisie?.toISOString() ?? 'absente'} · ${apresCloture ? 'toutes les pièces sont saisies après la clôture' : 'aucune pièce saisie après la clôture'}`);
  const par = (titre) => r.parTitre[titre];
  // § A44 b) · l'administrateur a passé l'import d'ouverture, les deux
  // dotations et le redressement · 4 pièces.
  R.montant('SA 2026 · ISA 240 · auteur inattendu (administrateur)', 4, par("Passées par une personne qui n'est pas censée en passer"));
  // § 33 a) ii) · pièces datées du 25 au 31 décembre · les deux dotations et
  // le redressement, datés du 31/12 · 3.
  R.montant('SA 2026 · ISA 240 · fin de période (7 derniers jours)', 3, par('Écritures de fin de période'));
  // § A44 e) · total ≥ 1 000 000 et multiple de 1 000 000 · FA-F1-01 (6 M),
  // FV-001 (12 M), VIR-001 (4 M), FV-002 (8 M), FV-003 (3 M), REC-001 (4 M),
  // REC-002 (8 M), FV-004 (1 M), REC-003 (1 M) · 9 ; l'ouverture (62,5 M),
  // les deux de 2,5 M et les dotations ne sont pas rondes.
  R.montant('SA 2026 · ISA 240 · montants ronds', 9, par('Chiffres ronds'));
  // § A44 c) · « Ajust. » (6 caractères, sans pièce), plus l'import s'il n'a
  // pas de référence ou un libellé court · lu sur la pièce importée.
  const importee = ecr.find((e) => String(e.date).slice(0, 10) === '2026-01-01');
  const importSansJustif = importee ? (String(importee.libelle ?? '').trim().length < 12 || !String(importee.reference ?? '').trim()) : false;
  R.montant('SA 2026 · ISA 240 · peu ou pas de justification', 1 + (importSansJustif ? 1 : 0), par('Peu ou pas de justification'));
  // § A44 a) · un compte mouvementé au plus deux fois · toutes les pièces en
  // touchent un (57210000, 31110000, 10130000, 12100000 à l'ouverture ; chaque
  // tiers a au plus deux lignes ; 60110000, 60550000, 57310000 deux ; les
  // comptes de dotation et de variation une).
  R.montant('SA 2026 · ISA 240 · comptes rarement utilisés', 19, par('Comptes rarement utilisés'));
  R.montant('SA 2026 · ISA 240 · saisies après la clôture', apresCloture ? 19 : 0, par('Saisies après la date de clôture'));
  R.montant('SA 2026 · ISA 240 · écritures retenues', 19, r.retenues);
  const ajust = r.lignes.find((l) => l['Libellé'] === 'Ajust.');
  R.egal('SA 2026 · ISA 240 · « Ajust. » retenue pour défaut de justification', true, /justification/i.test(ajust?.['Critères'] ?? ''));
  R.egal('SA 2026 · ISA 240 · « Ajust. » saisie par le comptable', true, /comptable/.test(String(ajust?.['Saisie par'] ?? '')));
  return r;
}

// --- SA · documents obligatoires -----------------------------------------------------------

async function documentsSa(c, R, n) {
  const tr = await c.geste('Transcription au livre d’inventaire 2026', 'POST', '/documents-obligatoires/livre-inventaire', { exerciceId: n });
  R.montant('SA · livre d’inventaire · version 1', 1, tr?.version);
  let conf = await c.lire('Conformité du livre d’inventaire', `/documents-obligatoires/livre-inventaire/conformite?exerciceId=${n}`);
  R.egal('SA · livre d’inventaire · fondement (AUDCIF art. 19)', 'AUDCIF art. 19', conf?.fondement?.article);
  // Art. 19 · bilan, compte de résultat, tableau des flux.
  R.egal('SA · livre d’inventaire · trois états transcrits', [true, true, true], (conf?.etatsExiges ?? []).map((e) => e.transcrit));
  R.egal('SA · livre d’inventaire · incomplet sans le résumé de l’opération', false, conf?.complete);
  if (tr) await c.geste('Résumé de l’opération d’inventaire', 'PATCH', `/documents-obligatoires/livre-inventaire/${tr.id}/resume`, { resumeOperationInventaire: 'Inventaire du 31/12/2026 · manquant A1 de 600 000 redressé, excédent A2 maintenu hors bilan, caisse siège −10 000' });
  conf = await c.lire('Conformité du livre d’inventaire après résumé', `/documents-obligatoires/livre-inventaire/conformite?exerciceId=${n}`);
  R.egal('SA · livre d’inventaire · complet avec le résumé', true, conf?.complete);
  const bilan = tr?.etats?.bilan ?? tr?.etats?.BILAN;
  if (bilan) {
    // Total de l'actif au 31/12/2026 · stocks 9 400 000 + clients 11 000 000 +
    // banque 56 500 000 + caisses 1 700 000 + 500 000 = 79 100 000.
    const plat = JSON.stringify(bilan);
    R.egal('SA · livre d’inventaire · le bilan transcrit porte le total 79 100 000', true, plat.includes('79100000'));
  }

  // RAPPORT DE GESTION · AUSCGIE art. 138, plus art. 141 et 547-1 (SA).
  await refus(c, R, 'SA · rapport de gestion daté avant la clôture', 'POST', '/documents-obligatoires/rapport-activite', { exerciceId: n, etabliLe: '2026-12-15', sections: { situationExerciceEcoule: 'x' } }, 400, /antérieure à la clôture/);
  const sections = {
    situationExerciceEcoule: 'Chiffre d’affaires de 24 000 000, bénéfice de 12 200 000.',
    evolutionPrevisible: 'Ouverture d’un second dépôt en 2027.',
    evenementsPosterieurs: 'Néant.',
    continuationActivite: 'Aucune incertitude sur la continuité.',
    evolutionTresorerie: 'Trésorerie de 58 700 000 au 31/12/2026.',
    planFinancement: 'Autofinancement.',
    modificationsPresentationMethodes: 'Néant.',
  };
  await c.geste('Rapport de gestion 2026 (version 1, sept sections)', 'POST', '/documents-obligatoires/rapport-activite', { exerciceId: n, etabliLe: '2027-03-15', sections });
  let rg = await c.lire('Conformité du rapport de gestion', `/documents-obligatoires/rapport-activite/conformite?exerciceId=${n}`);
  // Six sections de l'art. 138, la mention de l'art. 141, et la participation
  // des salariés au capital propre à la SA (art. 547-1) · huit.
  R.montant('SA · rapport de gestion · sections exigées (SA)', 8, rg?.sections?.length);
  R.egal('SA · rapport de gestion · section manquante nommée', ['participationSalariesCapital'], (rg?.sections ?? []).filter((s) => !s.renseignee).map((s) => s.cle));
  R.egal('SA · rapport de gestion · incomplet', false, rg?.complet);
  await c.geste('Rapport de gestion 2026 (version 2, huit sections)', 'POST', '/documents-obligatoires/rapport-activite', { exerciceId: n, etabliLe: '2027-03-20', sections: { ...sections, participationSalariesCapital: 'Aucun salarié actionnaire.' } });
  rg = await c.lire('Conformité du rapport de gestion v2', `/documents-obligatoires/rapport-activite/conformite?exerciceId=${n}`);
  R.montant('SA · rapport de gestion · version 2', 2, rg?.version);
  R.egal('SA · rapport de gestion · complet', true, rg?.complet);
}

// --- SA · 2027 provisions ------------------------------------------------------------------

async function provisions2027Sa(c, R, n, n1, od) {
  const rep = await c.geste('Report des provisions à l’ouverture de 2027', 'POST', '/provisions/reporter/ouverture', { exerciceSourceId: n, exerciceCibleId: n1 });
  // P1 (1 500 000), P2 (400 000) et le passif éventuel P3 (reporté à zéro) ·
  // la grosse réparation en examen à zéro ne se reporte pas.
  R.montant('SA 2027 · provisions reportées', 3, rep?.reportees);
  // Le report ne se fait pas deux fois · la valeur d'ouverture du § 5.3 ne se saisit pas deux fois.
  const bis = await c.geste('Second report à l’ouverture', 'POST', '/provisions/reporter/ouverture', { exerciceSourceId: n, exerciceCibleId: n1 });
  R.montant('SA 2027 · second report · aucune ligne doublée', 0, bis?.reportees);
  const lignes = (await c.lire('Provisions 2027', `/provisions?exerciceId=${n1}`)) ?? [];
  const p1 = lignes.find((l) => l.objet?.startsWith('Litige prud'));
  R.montant('SA 2027 · P1 · ouverture = clôture 2026', 1_500_000, nb(p1?.montantOuverture));
  const p3 = lignes.find((l) => l.statut === 'PASSIF_EVENTUEL');
  R.egal('SA 2027 · le passif éventuel suit le report', true, Boolean(p3));
  // Le risque baisse · reprise non utilisée de 500 000 (D 191 / C 7911).
  if (p1) await c.geste('P1 · reprise non utilisée de 500 000', 'PATCH', `/provisions/${p1.id}`, { reprisesNonUtilisees: 500_000 });
  await ecriture(c, 'Reprise de la provision P1', n1, '2027-12-31', 'Reprise partielle provision litige prud’homal', [['19100000', 500_000, 0], ['79110000', 0, 500_000]], { journal: od, reference: 'PV-PROV-03' });
  await validerJusqua(c, n1, '2027-12-31');
  const v = await c.lire('Tableau de variation 2027', `/provisions/variation/${n1}`);
  const r191 = (v?.rapprochement ?? []).find((x) => x.numero === '19100000');
  // 1 500 000 à l'ouverture − 500 000 repris = 1 000 000 ; à-nouveau
  // −1 500 000 + reprise 500 000 au 191 · |−1 000 000|.
  R.montant('SA 2027 · P1 · montant de clôture', 1_000_000, (v?.detail ?? []).find((d) => d.id === p1?.id)?.montantCloture);
  R.montant('SA 2027 · rapprochement 19100000 · solde comptable', 1_000_000, r191?.soldeComptable);
  R.montant('SA 2027 · rapprochement 19100000 · écart', 0, r191?.ecart);
  R.montant('SA 2027 · total des reprises non utilisées', 500_000, v?.totaux?.reprisesNonUtilisees);
}

// ================================================================================
// 2. L'ASSOCIATION (SYCEBNL)
// ================================================================================

const CONTROLES_ASSO_2026 = {
  BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE: { raison: 'banque mouvementée, aucun rapprochement clos', references: ['52110000'] },
  CLOTURE_INFORMATIQUE_EN_RETARD: 'aucune clôture de période posée, horloge au 15/02/2028',
  CHARGE_SANS_TIERS: 'dépense de caisse sans tiers',
  VALIDATION_PAR_SON_AUTEUR: 'un seul utilisateur saisit et valide',
  TIERS_ANCIEN_NON_LETTRE: 'cotisations et factures non lettrées',
};

async function association(R) {
  R.scenario = 'Revision association';
  const c = await nouveauDossier(R, 'Passe révision · Association Espoir du Kivu', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'revision-asso', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ca = c.journal('CA') ?? c.od;
  const ach = c.journal('ACH') ?? c.od;
  const od = c.od;

  await etape(R, 'Paramètres de l’association', async () => {
    await c.geste('Méthode des cotisations (appel)', 'PATCH', '/dossier/methode-cotisations', { methodeCotisations: 'APPEL' });
    await c.geste('Activation du module de révision', 'PATCH', '/dossier/modules', { modulesActives: ['REVISION'] });
    await c.geste('Date d’arrêté des comptes 2026', 'POST', `/exercices/${n}/arrete-comptes`, { dateArreteComptes: '2027-03-31' });
  });

  await etape(R, 'Reprise · bilan d’ouverture', async () => {
    // D 52110000 30 000 000 · D 57100000 1 500 000 · C 10110000 28 000 000 ·
    // C 12100000 3 500 000 · 31 500 000 de part et d'autre.
    await importerOuverture(c, n, [
      ['52110000', 'Banque', 30_000_000, 0], ['57100000', 'Caisse', 1_500_000, 0],
      ['10110000', 'Dotation', 0, 28_000_000], ['12100000', 'Report à nouveau', 0, 3_500_000],
    ]);
    await validerJusqua(c, n, '2026-01-01');
  });

  const t = {};
  for (const [k, type, code, nom] of [
    ['a1', 'ADHERENT', 'A1', 'Mme Bahati'], ['a2', 'ADHERENT', 'A2', 'M. Mukendi'], ['a3', 'ADHERENT', 'A3', 'Mme Furaha'],
    ['f1', 'FOURNISSEUR', 'F1', 'Papeterie du Kivu'], ['f2', 'FOURNISSEUR', 'F2', 'Garage Central'],
  ]) t[k] = await tiers(c, type, code, nom);

  await etape(R, '2026 · opérations', async () => {
    await ecriture(c, 'Appel des cotisations', n, '2026-01-15', 'Appel des cotisations 2026', [[t.a1.numero, 600_000, 0], [t.a2.numero, 400_000, 0], [t.a3.numero, 200_000, 0], ['70100000', 0, 1_200_000]], { journal: od, reference: 'APP-2026' });
    await ecriture(c, 'Facture F1', n, '2026-03-01', 'Facture Papeterie du Kivu', [['60550000', 800_000, 0], [t.f1.numero, 0, 800_000]], { journal: ach, reference: 'FA-PK-01' });
    await ecriture(c, 'Encaissement A1', n, '2026-03-31', 'Encaissement cotisation Bahati', [['52110000', 600_000, 0], [t.a1.numero, 0, 600_000]], { journal: bq, reference: 'REC-A1' });
    await ecriture(c, 'Règlement F1', n, '2026-04-01', 'Règlement Papeterie du Kivu', [[t.f1.numero, 500_000, 0], ['52110000', 0, 500_000]], { journal: bq, reference: 'VIR-PK' });
    await ecriture(c, 'Encaissement partiel A2', n, '2026-06-30', 'Encaissement partiel cotisation Mukendi', [['52110000', 100_000, 0], [t.a2.numero, 0, 100_000]], { journal: bq, reference: 'REC-A2' });
    await ecriture(c, 'Facture F2', n, '2026-09-01', 'Facture Garage Central', [['60550000', 1_200_000, 0], [t.f2.numero, 0, 1_200_000]], { journal: ach, reference: 'FA-GC-01' });
    await ecriture(c, 'Dépense de caisse', n, '2026-11-15', 'Achat de fournitures en espèces', [['60550000', 200_000, 0], ['57100000', 0, 200_000]], { journal: ca, reference: 'BC-A01' });
    await validerJusqua(c, n, '2026-12-31');
  });

  await etape(R, '2026 · provisions (SYCEBNL)', async () => {
    const base = { obligationExiste: true, resulteEvenementPasse: true, sortieProbable: true, estimationFiable: true };
    // UN NUMÉRO, DEUX SENS · le 192 du SYCEBNL porte les charges sur donations
    // et legs ; les garanties aux clients n'y existent pas.
    await refus(c, R, 'Association · garanties données aux clients (nature SYSCOHADA)', 'POST', `/provisions/${n}`, {
      ...base, objet: 'Essai garantie', nature: 'GARANTIE_CLIENTS', statut: 'EN_EXAMEN', justificationObligation: 'Essai',
    }, 400, /n'existe pas dans le plan de comptes SYCEBNL/);
    await c.geste('Provision · charges sur legs', 'POST', `/provisions/${n}`, {
      ...base, objet: 'Entretien d’un immeuble reçu en legs', nature: 'CHARGES_DONATIONS_LEGS', compteId: compte(c, '19200000'), statut: 'COMPTABILISEE',
      justificationObligation: 'Clause du testament imposant la remise en état', echeanceAttendue: '2028-12-31', dotationsExercice: 800_000,
    });
    await ecriture(c, 'Dotation provision charges sur legs', n, '2026-12-31', 'Dotation provision charges sur legs', [['69110000', 800_000, 0], ['19200000', 0, 800_000]], { journal: od, reference: 'PV-PROV-A1' });
    await validerJusqua(c, n, '2026-12-31');
    const v = await c.lire('Tableau de variation des provisions', `/provisions/variation/${n}`);
    const r192 = (v?.rapprochement ?? []).find((x) => x.numero === '19200000');
    R.montant('Association 2026 · rapprochement 19200000 · écart', 0, r192?.ecart);
    R.montant('Association 2026 · rapprochement 19200000 · solde comptable', 800_000, r192?.soldeComptable);
    // Ligne A16 · le SYCEBNL n'ouvre aucun 4997 · trois comptes de court terme.
    R.egal('Association · comptes de court terme servis (SYCEBNL, sans 4997)', ['4991', '4998', '599'], (v?.comptesCourtTerme ?? []).map((x) => x.compte));
    R.egal('Association · nature du 192 (SYCEBNL)', 'CHARGES_DONATIONS_LEGS', (v?.natures ?? []).find((x) => x.compte === '192')?.nature);
  });

  await etape(R, '2026 · test des écritures de journal (association)', async () => {
    const r = await lireTestIsa240(c, R, 'Association 2026', n);
    if (!r) return;
    // Neuf pièces · l'import d'ouverture, sept opérations, la dotation.
    R.montant('Association 2026 · ISA 240 · écritures examinées', 9, r.total);
    // Un seul utilisateur, administrateur · les neuf (§ A44 b)).
    R.montant('Association 2026 · ISA 240 · auteur inattendu', 9, r.parTitre["Passées par une personne qui n'est pas censée en passer"]);
    // Seule la dotation du 31/12 tombe dans les sept derniers jours.
    R.montant('Association 2026 · ISA 240 · fin de période', 1, r.parTitre['Écritures de fin de période']);
    // Aucun total multiple de 1 000 000 · ouverture 31 500 000, appel 1 200 000,
    // facture 1 200 000, le reste sous le million.
    R.montant('Association 2026 · ISA 240 · montants ronds', 0, r.parTitre['Chiffres ronds']);
    // Chaque pièce touche un compte mouvementé au plus deux fois (57100000,
    // 10110000, 12100000 à l'ouverture ; chaque tiers ; 70100000 ; 69110000 et
    // 19200000) · seul le 60550000 (trois lignes) et la banque (quatre) ne le sont pas.
    R.montant('Association 2026 · ISA 240 · comptes rarement utilisés', 9, r.parTitre['Comptes rarement utilisés']);
  });

  await etape(R, '2026 · balance de contrôle', async () => {
    const b = await balance(c, n);
    // 30 000 000 + 600 000 − 500 000 + 100 000.
    R.montant('Association 2026 · banque', 30_200_000, solde(b, '52110000'));
    R.montant('Association 2026 · caisse', 1_300_000, solde(b, '57100000'));
    // A2 300 000 + A3 200 000.
    R.montant('Association 2026 · adhérents 411', 500_000, solde(b, '411'));
    // F1 −300 000, F2 −1 200 000.
    R.montant('Association 2026 · fournisseurs 401', -1_500_000, solde(b, '401'));
  });

  await etape(R, '2026 · inventaire · une campagne qui ne compte qu’une caisse', async () => {
    const camp = await c.geste('Campagne d’inventaire', 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-31', libelle: 'Inventaire de clôture 2026' });
    if (!camp) return;
    const sc = await c.geste('Sous-commission caisse', 'POST', `/inventaire/${camp.id}/sous-commissions`, { nom: 'Caisse siège' });
    if (sc) {
      await c.geste('Membre inventoriant', 'POST', `/inventaire/sous-commissions/${sc.id}/membres`, { nom: 'Trésorière', role: 'INVENTORIANT' });
      await c.geste('Membre témoin', 'POST', `/inventaire/sous-commissions/${sc.id}/membres`, { nom: 'Commissaire aux comptes de l’association', role: 'TEMOIN' });
    }
    // 1 300 000 au livre-journal, 1 300 000 comptés · écart nul.
    const pv = await c.geste('PV de comptage de la caisse', 'POST', `/inventaire/${camp.id}/pv-caisse`, {
      compteId: compte(c, '57100000'), sousCommissionId: sc?.id, dateComptage: '2026-12-31', modeComparaison: 'FRANCS', especesComptees: 1_300_000,
      attestationEtablieLe: '2026-12-31', attestationPar: 'Présidente',
    });
    R.montant('Association 2026 · PV de caisse · solde figé', 1_300_000, pv?.soldeComptableFige);
    R.montant('Association 2026 · PV de caisse · écart', 0, pv?.ecart);
    const lu = await c.lire('Campagne après le PV', `/inventaire/${camp.id}`);
    R.egal('Association 2026 · compter une caisse ouvre le recensement (F134)', 'RECENSEMENT', lu?.statut);
    // LA CAMPAGNE D'UNE ASSOCIATION SANS STOCK NI IMMOBILISATION · le PV de
    // caisse est fait, le PV de campagne signé, aucun écart n'est à
    // arbitrer · rien ne reste à faire avant la clôture.
    await c.geste('PV de la campagne', 'POST', `/inventaire/${camp.id}/proces-verbal`, { dateEtablissement: '2027-01-05' });
    const cl = await c.req('POST', `/inventaire/${camp.id}/clore`, {});
    if (!R.egal('Association 2026 · une campagne de caisse seule se clôt (PV de caisse et PV de campagne faits)', true, cl.statut < 400)) {
      const ra = await c.req('POST', `/inventaire/${camp.id}/rapprocher`, {});
      R.note(`Association 2026 · campagne de caisse seule · clôture ${cl.statut} (${texteRefus(cl.corps).slice(0, 140)}) · rapprochement ${ra.statut} (${texteRefus(ra.corps).slice(0, 100)}) · issue par une fiche sur la caisse`);
    } else return;
    // L'issue que le module laisse · une fiche sur la caisse, rapprochée.
    const f = await c.geste('Fiche · caisse', 'POST', `/inventaire/${camp.id}/fiches`, { compteId: compte(c, '57100000'), sousCommissionId: sc?.id, designation: 'Espèces en caisse' });
    if (f) await c.geste('Valorisation de la fiche caisse', 'PATCH', `/inventaire/fiches/${f.id}`, { valeurInventaire: 1_300_000, referencePiece: 'PV-CAISSE-2026' });
    const rap = await c.geste('Rapprochement', 'POST', `/inventaire/${camp.id}/rapprocher`, {});
    const ec = (rap?.ecarts ?? [])[0];
    R.montant('Association 2026 · écart de la fiche caisse', 0, ec?.ecart);
    await refus(c, R, 'Association · campagne close avec un écart (même nul) sans décision', 'POST', `/inventaire/${camp.id}/clore`, {}, 403, /sans décision/);
    if (ec) await c.geste('Arbitrage · expliqué', 'PATCH', `/inventaire/ecarts/${ec.id}`, { decision: 'EXPLIQUE', explication: 'Aucun écart · comptage concordant' });
    const clos = await c.geste('Clôture de la campagne', 'POST', `/inventaire/${camp.id}/clore`, {});
    R.egal('Association 2026 · campagne close', 'CLOTUREE', clos?.statut);
  });

  await etape(R, '2026 · circularisation', async () => {
    const cli = await c.geste('Campagne adhérents', 'POST', '/circularisation', { exerciceId: n, libelle: 'Confirmation des cotisations dues', dateArrete: '2026-12-31', cycle: 'CLIENTS_ADHERENTS' });
    if (cli) {
      const e = await c.lire('Échantillon adhérents', `/circularisation/${cli.id}/echantillon`);
      // A2 300 000 + A3 200 000 ; A1 soldé écarté.
      R.montant('Association · circularisation adhérents · total du cycle', 500_000, e?.totalCycle);
      const d2 = await c.geste('Lettre A2', 'POST', `/circularisation/${cli.id}/demandes`, { compteId: t.a2.compteId, tiersId: t.a2.id, destinataire: 'M. Mukendi' });
      const d3 = await c.geste('Lettre A3', 'POST', `/circularisation/${cli.id}/demandes`, { compteId: t.a3.compteId, tiersId: t.a3.id, destinataire: 'Mme Furaha' });
      await c.geste('Envoi', 'POST', `/circularisation/${cli.id}/envoyer`, { date: '2027-01-12' });
      if (d2) await c.geste('Réponse A2', 'PATCH', `/circularisation/demandes/${d2.id}`, { statut: 'REPONSE_RECUE', soldeConfirme: 300_000, date: '2027-01-30' });
      if (d3) {
        await c.geste('A3 non distribuée', 'PATCH', `/circularisation/demandes/${d3.id}`, { statut: 'NON_DISTRIBUEE' });
        await c.geste('Procédures alternatives A3', 'PATCH', `/circularisation/demandes/${d3.id}/procedures-alternatives`, { proceduresAlternatives: 'Encaissement du 20/01/2027 au relevé bancaire' });
      }
      await c.geste('Clôture', 'POST', `/circularisation/${cli.id}/clore`, {});
      const s = (await c.lire('Synthèse adhérents', `/circularisation/${cli.id}`))?.synthese;
      // 1 réponse sur 2 = 50,0 % ; couverture 300 000 / 500 000 = 60,0 %.
      R.montant('Association · circularisation adhérents · taux de réponse', 50, s?.tauxReponse);
      R.montant('Association · circularisation adhérents · taux de couverture', 60, s?.tauxCouverture);
    }
    const fou = await c.geste('Campagne fournisseurs', 'POST', '/circularisation', { exerciceId: n, libelle: 'Confirmation fournisseurs', dateArrete: '2026-12-31', cycle: 'FOURNISSEURS' });
    if (fou) {
      const d = await c.geste('Lettre F2 seule', 'POST', `/circularisation/${fou.id}/demandes`, { compteId: t.f2.compteId, tiersId: t.f2.id, destinataire: 'Garage Central' });
      await c.geste('Envoi', 'POST', `/circularisation/${fou.id}/envoyer`, { date: '2027-01-12' });
      if (d) await c.geste('Réponse F2', 'PATCH', `/circularisation/demandes/${d.id}`, { statut: 'REPONSE_RECUE', soldeConfirme: -1_200_000, date: '2027-01-25' });
      await c.geste('Clôture', 'POST', `/circularisation/${fou.id}/clore`, {});
      const s = (await c.lire('Synthèse fournisseurs', `/circularisation/${fou.id}`))?.synthese;
      // 1 sur 1 = 100 % ; mais le DÉNOMINATEUR de la couverture est le total du
      // cycle (F70) · 1 200 000 / (300 000 + 1 200 000) = 80,0 %, pas 100 %.
      R.montant('Association · circularisation fournisseurs · taux de réponse', 100, s?.tauxReponse);
      R.montant('Association · circularisation fournisseurs · taux de couverture (sur le total du cycle)', 80, s?.tauxCouverture);
      R.montant('Association · circularisation fournisseurs · total du cycle', 1_500_000, s?.totalCycle);
    }
  });

  const regFaiblesse = await etape(R, '2026 · faiblesse (régime « autre »)', async () => {
    const reg = await c.geste('Registre 2026', 'POST', '/faiblesses', { exerciceId: n, origine: 'REVISION_INTERNE', libelle: 'Faiblesses 2026' });
    if (!reg) return null;
    const f = await c.geste('Faiblesse A-01', 'POST', `/faiblesses/${reg.id}/faiblesses`, { reference: 'A-01', intitule: 'Reçus de cotisation non prénumérotés', description: 'Reçus manuscrits libres', effetPotentiel: 'Cotisation encaissée non enregistrée' });
    await refus(c, R, 'Association · registre clos avec une faiblesse non qualifiée', 'POST', `/faiblesses/${reg.id}/clore`, {}, 403, /non qualifiée/);
    if (f) {
      await c.geste('Qualification A-01 · autre', 'PATCH', `/faiblesses/faiblesses/${f.id}/qualification`, { qualification: 'AUTRE', justification: 'Montants faibles, encaissements bancaires majoritaires' });
      await c.geste('Écrit A-01 à la direction (§ 10 b)', 'PATCH', `/faiblesses/faiblesses/${f.id}/communication`, { communiqueeLe: '2027-02-10', communiqueeA: 'Secrétaire exécutif' });
    }
    const clos = await c.geste('Clôture du registre 2026', 'POST', `/faiblesses/${reg.id}/clore`, {});
    R.egal('Association · registre 2026 clos', 'CLOS', clos?.statut);
    return { reg, f };
  });

  await etape(R, '2026 · questionnaire (item propre au SYCEBNL)', async () => {
    const q = await c.geste('Questionnaire 2026', 'POST', '/questionnaire-revision', { exerciceId: n, libelle: 'Caisses et engagements', cycles: ['CAISSES', 'ENGAGEMENTS_HORS_BILAN'] });
    if (!q) return;
    const rep = (code, corps) => c.geste(`Réponse ${code}`, 'POST', `/questionnaire-revision/${q.id}/reponses`, { code, ...corps });
    const premiere = await c.req('POST', `/questionnaire-revision/${q.id}/reponses`, { code: 'CPCC-CAI-1', reponse: 'NON', commentaire: 'Comptage fait le 31/12 au soir, attestation à venir' });
    if (!R.egal('Association · questionnaire · une réponse valide s’enregistre', true, premiere.statut < 400)) {
      R.erreurHttp('Réponse CPCC-CAI-1', 'POST', `/questionnaire-revision/${q.id}/reponses`, premiere.statut, premiere.corps);
      R.note('Association · questionnaire · aucune réponse ne s’enregistre · suite non jouée');
      return;
    }
    await refus(c, R, 'Association · « Si oui, une attestation… » après un « Non »', 'POST', `/questionnaire-revision/${q.id}/reponses`, { code: 'CPCC-CAI-2', reponse: 'OUI' }, 400, /orpheline/);
    await rep('CPCC-CAI-3', { reponse: 'OUI' });
    await rep('CPCC-CAI-4', { reponse: 'NON' });
    await rep('CPCC-CAI-5', { reponse: 'OUI' });
    await rep('VMG-ENG-1', { reponse: 'NON', commentaire: 'Aucune caution donnée' });
    await rep('VMG-ENG-3', { reponse: 'OUI' });
    const s = (await c.lire('Synthèse', `/questionnaire-revision/${q.id}`))?.synthese;
    // Questions ouvertes · CAI-1, CAI-3, CAI-4, CAI-5, ENG-1, ENG-3 = 6
    // (CAI-2 et ENG-2 fermées par un « Non ») ; 6 répondues.
    R.montant('Association · questionnaire · questions ouvertes', 6, s?.questions);
    R.montant('Association · questionnaire · taux de réponse', 100, s?.tauxReponse);
    // Exceptions · CAI-1 « Non », ENG-1 « Non » ; CAI-4 « Non » n'en est pas une.
    R.montant('Association · questionnaire · exceptions', 2, s?.exceptions);
    // ENG-1, ENG-2, ENG-3 (ce dernier seulement au SYCEBNL).
    R.montant('Association · questionnaire · items de l’éditeur', 3, s?.itemsVmg);
    const clos = await c.geste('Clôture du questionnaire', 'POST', `/questionnaire-revision/${q.id}/clore`, {});
    R.egal('Association · questionnaire clos', 'CLOS', clos?.statut);
  });

  const mandat = await etape(R, 'Mandat de l’auditeur (SYCEBNL art. 21)', async () => {
    const d = await c.lire('Durée proposée', '/mandat-auditeur/duree?organe=ASSEMBLEE_GENERALE_ORDINAIRE');
    // « L'auditeur est nommé pour trois (3) exercices renouvelables une fois. »
    R.montant('Association · mandat · trois exercices', 3, d?.exercices);
    R.montant('Association · mandat · deux mandats au plus', 2, d?.mandatsMaximum);
    R.egal('Association · mandat · réduction possible (existence inférieure à trois exercices)', true, d?.reductionPossible);
    const base = { nom: 'Cabinet Mwamba', inscriptionOrdre: 'ONEC n° 0789', organeDesignation: 'ASSEMBLEE_GENERALE_ORDINAIRE', dateDesignation: '2024-03-30' };
    await refus(c, R, 'Association · mandat de quatre exercices', 'POST', '/mandat-auditeur', { ...base, premierExercice: 2024, nombreExercices: 4 }, 400, /au plus 3/);
    await refus(c, R, 'Association · troisième mandat consécutif', 'POST', '/mandat-auditeur', { ...base, premierExercice: 2024, nombreExercices: 3, rang: 3 }, 400, /UNE FOIS/);
    return c.geste('Mandat 2024-2026', 'POST', '/mandat-auditeur', { ...base, premierExercice: 2024, nombreExercices: 3 });
  });

  await etape(R, 'Manuel des procédures (association)', async () => {
    await c.geste('Manuel · version 1', 'POST', '/documents-obligatoires/manuel-procedures', {
      dateApplication: '2026-01-01', sections: [{ cle: 'classement-archivage', titre: 'Classement des pièces', texte: 'Par journal et par date, archives dix ans.' }],
    });
    const conf = await c.lire('Conformité du manuel', '/documents-obligatoires/manuel-procedures/conformite');
    R.egal('Association · manuel · ordre de classement renseigné', true, conf?.classementRenseigne);
  });

  await etape(R, '2026 · contrôles de clôture', () => confronterControles(c, R, 'Association 2026 · contrôles de clôture', n, CONTROLES_ASSO_2026));

  const clos = await etape(R, 'Clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;

  await etape(R, '2026 · documents obligatoires (SYCEBNL)', async () => {
    const tr = await c.geste('Livre d’inventaire 2026', 'POST', '/documents-obligatoires/livre-inventaire', { exerciceId: n, resumeOperationInventaire: 'Caisse comptée le 31/12/2026, concordante.' });
    const conf = await c.lire('Conformité du livre', `/documents-obligatoires/livre-inventaire/conformite?exerciceId=${n}`);
    R.egal('Association · livre d’inventaire · fondement (art. 14, point 1)', 'Art. 14, point 1', conf?.fondement?.article);
    R.egal('Association · livre d’inventaire · complet', true, conf?.complete);
    R.egal('Association · livre d’inventaire · transcrit', true, Boolean(tr));
    const sections = { situationExerciceEcoule: 'Déficit de 1 800 000.', perspectivesDeveloppement: 'Campagne d’adhésion 2027.', evolutionTresorerie: 'Trésorerie de 31 500 000.', evenementsPosterieurs: 'Néant.' };
    await c.geste('Rapport d’activité 2026', 'POST', '/documents-obligatoires/rapport-activite', { exerciceId: n, etabliLe: '2027-03-10', ...sections, entiteAvecAuditeur: true });
    const rc = await c.lire('Conformité du rapport', `/documents-obligatoires/rapport-activite/conformite?exerciceId=${n}`);
    // Art. 16-3 · quatre sections ; art. 18 · la déclaration des dirigeants
    // n'est attendue que faute d'auditeur.
    R.montant('Association · rapport d’activité · quatre sections (art. 16-3)', 4, rc?.sections?.length);
    R.egal('Association · rapport · déclaration de l’art. 18 non attendue (auditeur)', false, rc?.declarationRegistreDonateurs?.attendue);
    R.egal('Association · rapport d’activité · complet', true, rc?.complet);
  });

  if (!clos || !n1) {
    R.note('Association · 2027 non joué · clôture 2026 refusée ou exercice 2027 absent');
    return;
  }

  await etape(R, '2027 · mandat prorogé (SYCEBNL art. 22), puis renouvelé', async () => {
    const codes = async () => new Set(((await c.lire('Contrôles 2027', `/controles?exerciceId=${n1}`))?.anomalies ?? []).map((a) => a.code));
    let k = await codes();
    // Mandat 2024-2026 échu · « la mission de l'auditeur est prorogée »
    // jusqu'à la plus prochaine assemblée · information, dite même quand
    // l'obligation reste indéterminée (seuils en FCFA).
    R.egal('Association 2027 · MANDAT_AUDITEUR_PROROGE levé (SYCEBNL art. 22)', true, k.has('MANDAT_AUDITEUR_PROROGE'));
    await c.geste('Renouvellement 2027-2029 (second et dernier mandat)', 'POST', '/mandat-auditeur', {
      nom: 'Cabinet Mwamba', inscriptionOrdre: 'ONEC n° 0789', organeDesignation: 'ASSEMBLEE_GENERALE_ORDINAIRE', dateDesignation: '2027-03-30', premierExercice: 2027, nombreExercices: 3, rang: 2,
    });
    k = await codes();
    R.egal('Association 2027 · plus de prorogation une fois renouvelé', false, k.has('MANDAT_AUDITEUR_PROROGE'));
    // « renouvelables UNE FOIS » (SYCEBNL art. 21) · le même cabinet, même
    // inscription, après 2024-2026 et 2027-2029, pour 2030-2032, sans rang
    // déclaré · c'est un TROISIÈME mandat consécutif, que le registre connaît.
    await refus(c, R, 'Association · troisième mandat consécutif du même auditeur, rang non déclaré', 'POST', '/mandat-auditeur', {
      nom: 'Cabinet Mwamba', inscriptionOrdre: 'ONEC n° 0789', organeDesignation: 'ASSEMBLEE_GENERALE_ORDINAIRE', dateDesignation: '2030-03-30', premierExercice: 2030, nombreExercices: 3,
    }, 400, /UNE FOIS/);
    if (mandat) R.note('Association · mandat initial conservé au registre (non clos)');
  });

  await etape(R, '2027 · report d’une faiblesse « autre » (§ A24, aucun écrit à reconduire)', async () => {
    if (!regFaiblesse?.f) return R.note('Association · faiblesse 2026 absente, report non joué');
    const reg = await c.geste('Registre 2027', 'POST', '/faiblesses', { exerciceId: n1, origine: 'REVISION_INTERNE', libelle: 'Faiblesses 2027' });
    if (!reg) return;
    // § A24 · « need not repeat » · une faiblesse AUTRE non remédiée se
    // reporte sans reconduire l'écrit.
    const rep = await c.geste('Report de A-01 sans écrit reconduit', 'POST', `/faiblesses/faiblesses/${regFaiblesse.f.id}/report`, { registreCibleId: reg.id });
    R.egal('Association 2027 · A-01 reportée (régime libre)', 'AUTRE', rep?.qualification);
  });
}

// ================================================================================
// 3. LA SARL · durée du mandat (AUSCGIE art. 379)
// ================================================================================

async function sarlMandat(R) {
  R.scenario = 'Revision SARL';
  const c = await nouveauDossier(R, 'Passe révision · Atelier Kasaï SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'revision-sarl', exercice: ['2026-01-01', '2026-12-31'],
  });
  await c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
  const d = await c.lire('Durée proposée · associés', '/mandat-auditeur/duree?organe=ASSOCIES');
  // « Le commissaire aux comptes est nommé pour trois (3) exercices par un ou
  // plusieurs associés représentant plus de la moitié du capital social. »
  R.montant('SARL · mandat · trois exercices (art. 379)', 3, d?.exercices);
  R.egal('SARL · mandat · aucune limite de renouvellement lue', null, d?.mandatsMaximum ?? null);
  const base = { nom: 'Cabinet Tshibangu', inscriptionOrdre: 'ONEC n° 0999', organeDesignation: 'ASSOCIES', dateDesignation: '2026-02-01', premierExercice: 2026 };
  await refus(c, R, 'SARL · mandat de deux exercices', 'POST', '/mandat-auditeur', { ...base, nombreExercices: 2 }, 400, /3 exercice/);
  await refus(c, R, 'SARL · mandat de six exercices', 'POST', '/mandat-auditeur', { ...base, nombreExercices: 6 }, 400, /3 exercice/);
  const m = await c.geste('Mandat SARL 2026-2028', 'POST', '/mandat-auditeur', { ...base, nombreExercices: 3 });
  R.egal('SARL · mandat enregistré', true, Boolean(m?.id));
  // Aucun texte lu ne borne le renouvellement d'un commissaire de SARL · un
  // quatrième mandat se saisit (l'art. 21 du SYCEBNL ne s'y transpose pas).
  const m4 = await c.geste('Mandat SARL de rang 4', 'POST', '/mandat-auditeur', { ...base, premierExercice: 2029, dateDesignation: '2029-02-01', nombreExercices: 3, rang: 4 });
  R.egal('SARL · un quatrième mandat n’est pas refusé (aucun plafond lu)', true, Boolean(m4?.id));
  // La SARL ne proroge pas (art. 709 propre à la SA) · aucun texte lu.
  const n = c.exercices.get('2026').id;
  let k = new Set(((await c.lire('Contrôles 2026', `/controles?exerciceId=${n}`))?.anomalies ?? []).map((a) => a.code));
  R.egal('SARL 2026 · aucune prorogation annoncée', false, k.has('MANDAT_AUDITEUR_PROROGE'));
  R.egal('SARL 2026 · MANUEL_PROCEDURES_ABSENT sans manuel', true, k.has('MANUEL_PROCEDURES_ABSENT'));
  // SONDE · un manuel qui ne s'applique qu'à partir du 01/01/2027 ne décrit
  // pas l'organisation de 2026 · les contrôles de 2026 le lisent-ils ?
  await c.geste('Manuel applicable au 01/01/2027', 'POST', '/documents-obligatoires/manuel-procedures', {
    dateApplication: '2027-01-01', sections: [{ cle: 'classement-archivage', titre: 'Classement', texte: 'Par journal.' }],
  });
  k = new Set(((await c.lire('Contrôles 2026 avec un manuel de 2027', `/controles?exerciceId=${n}`))?.anomalies ?? []).map((a) => a.code));
  // La version porte « la date à partir de laquelle [elle] décrit
  // l'organisation réelle » (EnregistrerManuelDto) · en 2026, aucune version
  // ne s'appliquait encore.
  R.egal('SARL 2026 · MANUEL_PROCEDURES_ABSENT toujours levé avec un manuel applicable au 01/01/2027', true, k.has('MANUEL_PROCEDURES_ABSENT'));
  void auCentime;
  void rechargerComptes;
}
