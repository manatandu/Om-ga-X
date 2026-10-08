/**
 * SCÉNARIO SMT · le SYSTÈME MINIMAL DE TRÉSORERIE dans les DEUX référentiels,
 * exercices 2026 (N) et 2027 (N+1), clôtures comprises.
 *
 * Trois dossiers.
 *  1. « Les Amis de Kalemie », association SYCEBNL au jeu SMT (Acte uniforme
 *     SYCEBNL art. 5 et 6 ; Partie 4 ch. 4, bilan GA à HZ, compte de résultat
 *     KA à KZC, notes 1 à 5). Tenue en TRÉSORERIE autant que possible
 *     (Partie 4 ch. 1 § 1.3, « le fait générateur de l'enregistrement
 *     comptable est l'encaissement (recette) ou le décaissement (dépense) »),
 *     plus une créance et une dette non échues à la clôture, comme
 *     l'inventaire extra-comptable les fait naître.
 *  2. « Boutique Neema », entreprise individuelle SYSCOHADA au SMT (AUDCIF
 *     art. 11 et 13, Titre X) · ventes au comptant, achats payés, apport et
 *     prélèvement de l'exploitant (comptes 103 et 104), un bien amorti
 *     « linéaire sans prorata temporis » (Titre X ch. 1 § 1), créance et dette
 *     non échues, stock final.
 *  3. « Atelier bascule », SARL SYSCOHADA née au Système normal, qui prend
 *     l'option du dégressif sur un bien REPRIS (fiche sans écriture) puis
 *     passe au SMT avant toute écriture · c'est le seul chemin par lequel une
 *     option antérieure au SMT existe, et donc le seul où le refus d'un
 *     NOUVEAU dérogatoire (`motifRefusAmortissementNonLineaireSmt`) se lit.
 *
 * Tous les montants attendus sont calculés À LA MAIN ci-dessous, en
 * commentaire à côté de chaque contrôle, depuis les opérations du banc et les
 * textes cités · jamais recopiés d'une réponse du serveur.
 */
import {
  aplatir, balance, cloturer, compte, ecriture, etape, ligneDe, nouveauDossier,
  rechargerComptes, rechargerExercices, solde, tiers, validerJusqua,
} from './lib.mjs';
import { confronterControles, relireLiasse } from './parcours.mjs';

// --- Outils propres au scénario -------------------------------------------------

/** Le motif que les refus du SMT portent tous (common/systeme-minimal.ts). */
const MOTIF_SMT = /Système minimal de trésorerie/;

/** Le texte d'un corps de refus, quelle qu'en soit la forme (message chaîne ou tableau). */
const texteRefus = (corps) => {
  const m = corps?.message ?? corps;
  return Array.isArray(m) ? m.join(' | ') : typeof m === 'string' ? m : JSON.stringify(m ?? '');
};

/**
 * UN REFUS ATTENDU · le geste DOIT être refusé (400) et le motif doit être
 * celui du SMT. Il passe par `req`, pas par `geste` · un refus voulu n'est pas
 * une erreur HTTP du banc, c'est le contrôle lui-même. Un geste accepté à tort
 * est consigné avec son corps.
 */
async function refusSmt(c, R, libelle, methode, chemin, corps) {
  const r = await c.req(methode, chemin, corps);
  R.egal(`${libelle} · refusé (400)`, 400, r.statut);
  R.egal(`${libelle} · le motif est celui du SMT`, true, MOTIF_SMT.test(texteRefus(r.corps)));
  if (r.statut < 400) R.note(`${libelle} · ACCEPTÉ à tort · ${JSON.stringify(r.corps).slice(0, 300)}`);
  return r;
}

/**
 * UNE PORTE QUI DOIT RESTER OUVERTE au SMT · la règle du SMT ne refuse que les
 * CRÉATIONS (common/systeme-minimal.ts, « ce qui solde une opération
 * antérieure reste ouvert »). Le geste peut être refusé pour une AUTRE raison
 * (rien à reprendre), jamais au motif du SMT.
 */
async function porteOuverte(c, R, libelle, methode, chemin, corps) {
  const r = await c.req(methode, chemin, corps);
  R.egal(`${libelle} · non refusé au motif du SMT`, false, r.statut >= 400 && MOTIF_SMT.test(texteRefus(r.corps)));
  R.note(`${libelle} · statut ${r.statut} · ${texteRefus(r.corps).slice(0, 200)}`);
  return r;
}

/** Une ligne d'état par sa référence · undefined si absente. */
const parRef = (liste, ref) => (liste ?? []).find((x) => x.ref === ref);

/** Les sommes de ventilation d'un journal de la NOTE 4, colonne par colonne. */
function sommesVentilation(journal) {
  const s = {};
  for (const o of journal?.operations ?? []) {
    for (const [cle, v] of Object.entries(o.ventilation ?? {})) {
      const k = `${o.sens}:${cle}`;
      s[k] = (s[k] ?? 0) + Number(v);
    }
  }
  return s;
}

/** La ligne d'à-nouveau d'un tiers dans l'exercice `annee`, par son montant. */
async function ligneANouveau(c, t, annee, montant, sens) {
  const ouvertes = (await c.lire(`Lignes non lettrées ${t.numero}`, `/comptes/${t.compteId}/lettrage?nonLettreesSeulement=true`)) ?? [];
  const liste = Array.isArray(ouvertes) ? ouvertes : (ouvertes.lignes ?? []);
  return liste.find((l) => Math.abs(Number(sens === 'DEBIT' ? l.debit : l.credit) - montant) < 0.005 && String(l.date).slice(0, 4) === annee) ?? null;
}

/** Un stock de fin d'exercice · campagne, fiche comptée, variation proposée puis passée (inventaire intermittent). */
async function stockFinal(c, R, an, exerciceId, numero, designation, unite, quantite, valeur) {
  const camp = await c.geste(`Campagne d’inventaire ${an}`, 'POST', '/inventaire', { exerciceId, dateInventaire: `${an}-12-31`, libelle: `Inventaire de fin d’année ${an}` });
  const fiche = camp && (await c.geste(`Fiche d’inventaire ${an}`, 'POST', `/inventaire/${camp.id}/fiches`, { compteId: compte(c, numero), designation, uniteMesure: unite }));
  if (fiche) await c.geste(`Comptage ${an}`, 'PATCH', `/inventaire/fiches/${fiche.id}`, { quantiteComptee: quantite, valeurInventaire: valeur });
  await c.geste(`Variation des stocks ${an}`, 'POST', '/stocks/variation', { exerciceId, journalId: c.od.id, date: `${an}-12-31` });
}

/** Les exports SMT unitaires · produits, non vides. */
async function exportsSmt(c, R, an, exerciceId, racine, onglets) {
  for (const o of onglets) {
    const r = await c.lire(`Export SMT ${o} ${an}`, `/exports/${racine}/smt/${o}?exerciceId=${exerciceId}`);
    R.egal(`${an} · export SMT « ${o} » produit (classeur non vide)`, true, Boolean(r?.octets > 1000));
  }
}

const IMPORT_BALANCE = (c, n, lignes) => {
  const csv = ['Compte;Intitule;Debit;Credit', ...lignes.map((l) => l.join(';'))].join('\n');
  return c.geste('Import du bilan d’ouverture', 'POST', '/import/executer', {
    type: 'BALANCE', nomFichier: 'ouverture-2026.csv', contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
    mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
    exerciceId: n, dateOperation: '2026-01-01', bilanDOuverture: true, separateur: ';',
  });
};

// Les contrôles de clôture attendus · un code levé hors de la liste est un
// contrôle levé à tort, un code de la liste absent un contrôle manquant.
// CHARGE_SANS_TIERS N'Y EST PAS · le contrôle écarte le SMT, « comptabilité de
// trésorerie par construction » (controles.service.ts) · un achat payé
// directement est la tenue même du texte (Partie 4 ch. 1 § 1.3 ; Titre X
// ch. 1 § 1).
const CONTROLES_COMMUNS = {
  CLOTURE_INFORMATIQUE_EN_RETARD: 'aucune clôture de période posée dans OmegaX, échéance du premier trimestre passée au 15/02/2028',
  DATE_ARRETE_NON_RENSEIGNEE: 'le banc ne saisit pas la date d’arrêté des comptes',
  MANUEL_PROCEDURES_ABSENT: 'aucun manuel des procédures enregistré',
  SANS_PIECE: 'des écritures du banc sans référence de pièce',
  VALIDATION_PAR_SON_AUTEUR: 'un seul utilisateur saisit et valide',
  BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE: { raison: 'la banque n’est pas rapprochée par le banc', references: ['52110000'] },
};

// En 2027, les contrôles se lisent AVANT la cession du bien qui sort en cours
// d'année (étapes de cession) · ce bien n'a encore aucune dotation 2027, et le
// contrôle le dit à juste titre (sa dotation passe par la sortie ensuite).
const CONTROLES_2027 = {
  ...CONTROLES_COMMUNS,
  IMMO_SANS_DOTATION: 'le bien cédé en cours d’année n’a pas encore sa dotation 2027 au moment de la lecture',
};

export default async function scenarioSmt(registre) {
  await scenarioSmtSycebnl(registre);
  await scenarioSmtSyscohada(registre);
  await scenarioBascule(registre);
}

// =============================================================================
// 1. ASSOCIATION SYCEBNL AU SMT
// =============================================================================

async function scenarioSmtSycebnl(registre) {
  registre.scenario = 'SMT SYCEBNL';
  const R = registre;
  const c = await nouveauDossier(R, 'Passe smt · Les Amis de Kalemie', {
    referentiel: 'SYCEBNL', jeu: 'SYSTEME_MINIMAL_TRESORERIE', cle: 'smt-asbl', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const BQ = '52110000';
  const CAISSE = '57100000';
  const STOCK = '31100000';
  const bq = c.journal('BQ') ?? c.od;
  const ca = c.journal('CA') ?? c.od;
  const ach = c.journal('ACH') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const ctx = {};

  await etape(R, 'Paramètres · cotisations à l’encaissement, inventaire intermittent', async () => {
    // Comptabilité de trésorerie (Partie 4 ch. 1 § 1.3) · la cotisation se
    // constate à l'encaissement (cadre conceptuel § 5.4.2.1, seconde branche).
    // Au SMT, le fait générateur est déjà l'encaissement (Partie 4 ch. 1
    // § 1.3) · un refus de déclarer la méthode du § 5.4.2.1 se comprend, mais
    // son motif ne peut pas faire de l'association un projet de
    // développement (art. 6 · « les petites entités », associations comprises).
    const r = await c.req('PATCH', '/dossier/methode-cotisations', { methodeCotisations: 'ENCAISSEMENT' });
    R.note(`Méthode des cotisations au SMT · statut ${r.statut} · ${texteRefus(r.corps).slice(0, 200)}`);
    if (r.statut >= 400) {
      R.egal('Méthode des cotisations · le refus ne présente pas l’association au SMT comme un projet de développement', false, /projet de développement/.test(texteRefus(r.corps)));
    }
    await c.geste('Inventaire intermittent', 'PATCH', '/dossier/methode-inventaire-stocks', { methodeInventaireStocks: 'INTERMITTENT' });
  });

  await etape(R, 'Reprise · bilan d’ouverture importé au 1er janvier 2026', async () => {
    await IMPORT_BALANCE(c, n, [
      [BQ, 'Banque', 3_000_000, 0], [CAISSE, 'Caisse', 500_000, 0],
      ['10110000', 'Dotation non consomptible', 0, 3_000_000], ['12100000', 'Report à nouveau', 0, 500_000],
    ]);
    await validerJusqua(c, n, '2026-01-01');
  });

  const frs1 = await tiers(c, 'FOURNISSEUR', 'FRS-1', 'Librairie du Tanganyika');
  const frs2 = await tiers(c, 'FOURNISSEUR', 'FRS-2', 'Distribution d’électricité de Kalemie');
  const cli = await tiers(c, 'CLIENT', 'CLI-1', 'Paroisse Saint-Paul de Kalemie');

  const regler = (geste, sens, ex, date, t, ligneId, montant) => {
    if (!t || !ligneId) return R.note(`${geste} · tiers ou ligne absent, règlement non passé`);
    return c.geste(geste, 'POST', '/reglements', { sens, exerciceId: ex, journalId: bq.id, date, reglements: [{ compteId: t.compteId, ligneIds: [ligneId], montant }] });
  };

  // --- 2026 ---------------------------------------------------------------------
  await etape(R, '2026 · recettes et dépenses de trésorerie', async () => {
    await ecriture(c, 'Cotisations encaissées (caisse)', n, '2026-01-31', 'Cotisations 2026 encaissées', [[CAISSE, 1_200_000, 0], ['70100000', 0, 1_200_000]], { journal: ca });
    const don = await ecriture(c, 'Don reçu en banque', n, '2026-02-15', 'Don Fondation Tanganyika', [[BQ, 2_000_000, 0], ['70410000', 0, 2_000_000]], { journal: bq });
    // Le registre des donateurs (art. 17) reste tenu au SMT (CLAUDE.md, menus par profil).
    await c.geste('Registre · don de 2 000 000', 'POST', '/registre-donateurs', {
      dateOperation: '2026-02-15', nature: 'DON', typeDonateur: 'PERSONNE_MORALE', denomination: 'Fondation Tanganyika',
      numeroImmatriculation: 'RCCM-KLM-2018-B-007', adresseSiegeSocial: 'Kalemie', montant: 2_000_000, modeLiberation: 'VIREMENT', ecritureId: don?.id,
    });
    const fac = await ecriture(c, 'Facture FRS-1 · kits scolaires', n, '2026-03-10', 'Kits scolaires (40 + 60)',
      [['60110000', 1_000_000, 0], [frs1.numero, 0, 1_000_000, { dateEcheance: '2026-04-10' }]], { journal: ach });
    await regler('Règlement FRS-1', 'FOURNISSEUR', n, '2026-04-10', frs1, ligneDe(c, fac, frs1.numero)?.id, 1_000_000);
    await ecriture(c, 'Salaires du premier semestre', n, '2026-06-30', 'Salaires janvier à juin 2026', [['66110000', 600_000, 0], [BQ, 0, 600_000]], { journal: bq });
    ctx.immo = await c.geste('Matériel informatique (module)', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24420000'), designation: 'Ordinateur et imprimante', dateAcquisition: '2026-07-01', dateMiseEnService: '2026-07-01',
      valeurOrigine: 1_200_000, dureeAmortissementAns: 4, modeAmortissement: 'LINEAIRE', compteContrepartieId: compte(c, BQ), exerciceId: n, journalId: bq.id,
    });
    // Vidéoprojecteur payé en espèces, trois ans · cédé en 2027 (étape de la cession).
    ctx.projecteur = await c.geste('Vidéoprojecteur (module)', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24420000'), designation: 'Vidéoprojecteur', dateAcquisition: '2026-07-01', dateMiseEnService: '2026-07-01',
      valeurOrigine: 300_000, dureeAmortissementAns: 3, modeAmortissement: 'LINEAIRE', compteContrepartieId: compte(c, CAISSE), exerciceId: n, journalId: ca.id,
    });
    await ecriture(c, 'Fournitures de bureau (caisse)', n, '2026-08-15', 'Fournitures de bureau', [['60550000', 300_000, 0], [CAISSE, 0, 300_000]], { journal: ca });
    await ecriture(c, 'Loyer du local', n, '2026-09-01', 'Loyer septembre 2026 à août 2027', [['62220000', 360_000, 0], [BQ, 0, 360_000]], { journal: bq });
    await ecriture(c, 'Impôt foncier', n, '2026-10-01', 'Impôt foncier 2026', [['64110000', 50_000, 0], [BQ, 0, 50_000]], { journal: bq });
    await ecriture(c, 'Versement de la caisse à la banque', n, '2026-11-30', 'Versement d’espèces en banque', [[BQ, 500_000, 0], [CAISSE, 0, 500_000]], { journal: bq });
    await ecriture(c, 'Prestation facturée, non échue', n, '2026-12-15', 'Animation de la kermesse paroissiale',
      [[cli.numero, 250_000, 0, { dateEcheance: '2027-01-15' }], ['70520000', 0, 250_000]], { journal: ven });
    await ecriture(c, 'Facture d’électricité, non échue', n, '2026-12-20', 'Électricité de décembre 2026',
      [['60520000', 150_000, 0], [frs2.numero, 0, 150_000, { dateEcheance: '2027-01-20' }]], { journal: ach });
    await ecriture(c, 'Salaires du second semestre', n, '2026-12-31', 'Salaires juillet à décembre 2026', [['66110000', 600_000, 0], [BQ, 0, 600_000]], { journal: bq });
  });

  await etape(R, '2026 · refus du SMT · dépréciation d’immobilisation', async () => {
    // SYCEBNL Partie 4 ch. 4 · le modèle n'ouvre aucun poste de dépréciation,
    // sa seule charge calculée est JG « Dotations aux amortissements ».
    if (!ctx.immo) return R.note('Immobilisation absente · refus de dépréciation non éprouvé');
    await refusSmt(c, R, '2026 · dotation à une dépréciation du matériel informatique', 'POST', `/immobilisations/${ctx.immo.id}/depreciation`, {
      exerciceId: n, journalId: c.od.id, sens: 'DOTATION', montant: 100_000, compteDepreciationId: compte(c, '29440000'),
      compteContrepartieId: compte(c, '69140000'), indice: 'Bris d’écran constaté le 31/12/2026',
    });
  });

  await etape(R, '2026 · stock final et dotation', async () => {
    // 40 kits restants à 10 000 · stock final 400 000, initial nul ·
    // variation D 31100000 / C 60310000 400 000 (fiche SYCEBNL des comptes 31 à 36).
    await stockFinal(c, R, '2026', n, STOCK, 'Kits scolaires', 'kit', 40, 400_000);
    // Le SYCEBNL ne prescrit AUCUN mode à son SMT (la Note 1 ne demande que la
    // « durée d'utilité ») · le prorata reste · 1 200 000 / 4 × 6/12 = 150 000.
    if (ctx.immo) await c.geste('Dotation 2026', 'POST', `/immobilisations/${ctx.immo.id}/dotation`, { exerciceId: n, journalId: c.od.id });
    // Vidéoprojecteur · 300 000 / 3 × 6/12 = 50 000.
    if (ctx.projecteur) await c.geste('Dotation 2026 · vidéoprojecteur', 'POST', `/immobilisations/${ctx.projecteur.id}/dotation`, { exerciceId: n, journalId: c.od.id });
    await validerJusqua(c, n, '2026-12-31');
  });

  await etape(R, '2026 · balance, états et notes du SMT', async () => {
    await rechargerComptes(c);
    const b = await balance(c, n);
    R.montant('2026 · balance équilibrée', 0, b ? b.totalDebit - b.totalCredit : null);
    // Banque · 3 000 000 + 2 000 000 − 1 000 000 − 600 000 − 1 200 000 − 360 000 − 50 000 + 500 000 − 600 000 = 1 690 000.
    // Caisse · 500 000 + 1 200 000 − 300 000 (vidéoprojecteur) − 300 000 − 500 000 = 600 000.
    const att = {
      [BQ]: 1_690_000, [CAISSE]: 600_000, '2442': 1_500_000, '2844': -200_000, '311': 400_000, '412': 250_000, '401': -150_000,
      '101': -3_000_000, '121': -500_000, '701': -1_200_000, '7041': -2_000_000, '7052': -250_000,
      '6011': 1_000_000, '6031': -400_000, '6055': 300_000, '6052': 150_000, '6222': 360_000, '6411': 50_000, '6611': 1_200_000, '6813': 200_000,
    };
    for (const [racine, m] of Object.entries(att)) R.montant(`2026 · solde ${racine}`, m, solde(b, racine));
    // Produits 3 450 000 (1 200 000 + 2 000 000 + 250 000) ; charges 2 860 000
    // (1 000 000 − 400 000 + 300 000 + 150 000 + 360 000 + 50 000 + 1 200 000 + 200 000).
    R.montant('2026 · résultat (classes 6 à 8)', 590_000, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));

    const bilan = await c.lire('Bilan SMT 2026', `/etats-financiers/smt/bilan?exerciceId=${n}`);
    const f = aplatir(bilan);
    // GA (1 200 000 − 150 000) + (300 000 − 50 000) ; GC la créance de CLI-1 ; HD la dette FRS-2.
    for (const [ref, m] of Object.entries({ GA: 1_300_000, GB: 400_000, GC: 250_000, GD: 600_000, GE: 1_690_000, GZ: 4_240_000, HA: 3_000_000, HB: 590_000, HC: 500_000, HD: 150_000, HZ: 4_240_000 })) {
      R.montant(`2026 · bilan SMT · ${ref}`, m, f[ref]?.n);
    }
    R.egal('2026 · bilan SMT équilibré', true, bilan?.equilibre);
    // Sans exercice N-1, le comparatif est le bilan d'ouverture (Q3, SYCEBNL
    // Partie 4 ch. 1 § 1.4) · GD 500 000 + GE 3 000 000 = 3 500 000.
    R.montant('2026 · bilan SMT · comparatif = bilan d’ouverture (GZ N-1)', 3_500_000, bilan?.totalActifN1);

    const cr = await c.lire('Compte de résultat SMT 2026', `/etats-financiers/smt/compte-de-resultat?exerciceId=${n}`);
    const g = aplatir(cr);
    // A · cotisations 1 200 000 + don 2 000 000 (KA = 70 et les 41) ; le
    // versement caisse → banque est un virement interne, ni recette ni dépense.
    // B · JA = kits 1 000 000 (règlement de FRS-1 rattaché à sa facture 601,
    // constat N4) + fournitures 300 000 ; JB loyer 360 000 ; JC 1 200 000 ;
    // JD 50 000 ; JF nul (le matériel payé est hors exploitation, constat B2).
    for (const [ref, m] of Object.entries({ KA: 3_200_000, KB: 0, JA: 1_300_000, JB: 360_000, JC: 1_200_000, JD: 50_000, JE: 0, JF: 0 })) {
      R.montant(`2026 · compte de résultat SMT · ${ref}`, m, g[ref]?.n);
    }
    R.montant('2026 · compte de résultat SMT · KX (A)', 3_200_000, cr?.totalRecettes);
    R.montant('2026 · compte de résultat SMT · JX (B)', 2_910_000, cr?.totalDepenses);
    R.montant('2026 · compte de résultat SMT · KZ (C = A − B)', 290_000, cr?.soldeCaisse);
    // VA = GB 400 000 − 0 ; VB = GC 250 000 − 0 ; VC = dettes 150 000 − 0 ; JG = 68 150 000 + 50 000.
    for (const [ref, m] of Object.entries({ VA: 400_000, VB: 250_000, VC: 150_000, JG: 200_000 })) R.montant(`2026 · compte de résultat SMT · ${ref}`, m, g[ref]?.n);
    // KZC = KZ + VA + VB − VC − JG = 290 000 + 400 000 + 250 000 − 150 000 − 200 000 = 590 000.
    R.montant('2026 · compte de résultat SMT · KZC', 590_000, cr?.resultatNet);
    R.egal('2026 · compte de résultat SMT · KZC concorde avec le résultat du bilan', true, cr?.controle?.concordant);
    // Flux hors exploitation · le matériel payé (− 1 200 000 en banque, − 300 000 en caisse).
    R.montant('2026 · compte de résultat SMT · flux hors exploitation', -1_500_000, cr?.controle?.fluxHorsExploitation);
    R.egal('2026 · compte de résultat SMT · aucun règlement fournisseur laissé non rattaché', [], (cr?.reglementsNonRattaches ?? []).map((x) => `${x.numero} ${x.montant}`));
    ctx.cr26 = cr;

    const notes = await c.lire('Notes SMT 2026', `/etats-financiers/smt/notes?exerciceId=${n}`);
    // L'ordre est celui de la fiche récapitulative (Partie 1 · notes 1, 2, 3, 5 ; Partie 2 · note 4).
    R.egal('2026 · notes applicables (fiche récapitulative)', [1, 2, 3, 5, 4], notes?.applicables);
    R.montant('2026 · note 1 · total du registre', 1_500_000, notes?.note1?.total);
    R.montant('2026 · note 1 · deux lignes', 2, notes?.note1?.lignes?.length);
    R.montant('2026 · note 2 · stock final', 400_000, notes?.note2?.valeurStockFinal);
    R.montant('2026 · note 2 · stock initial', 0, notes?.note2?.valeurStockInitial);
    const l2 = (notes?.note2?.lignes ?? []).find((l) => String(l.numero ?? l.reference ?? '').startsWith('311'));
    R.egal('2026 · note 2 · quantité et prix unitaire tirés du comptage (40 × 10 000)', [40, 10_000], [Number(l2?.quantite), Number(l2?.prixUnitaire)]);
    R.montant('2026 · note 3 · total des créances', 250_000, notes?.note3?.totalCreances);
    R.montant('2026 · note 3 · créances non échues', 250_000, notes?.note3?.totalCreancesNonEchues);
    R.montant('2026 · note 3 · total des dettes', 150_000, notes?.note3?.totalDettes);
    R.montant('2026 · note 3 · dettes non échues', 150_000, notes?.note3?.totalDettesNonEchues);
    R.montant('2026 · note 5 · dotation non consomptible', 3_000_000, notes?.note5?.rubriques?.find((r) => r.cle === 'nonConsomptible')?.montant);
    R.montant('2026 · note 5 · total', 3_000_000, notes?.note5?.total);

    const jt = await c.lire('Journal de trésorerie SMT 2026', `/etats-financiers/smt/journal-tresorerie?exerciceId=${n}`);
    const jbq = (jt?.journaux ?? []).find((j) => j.numero === BQ);
    const jca = (jt?.journaux ?? []).find((j) => j.numero === CAISSE);
    // Banque · recettes don 2 000 000 + versement 500 000 ; dépenses 1 000 000 + 600 000 + 1 200 000 + 360 000 + 50 000 + 600 000.
    R.montant('2026 · note 4 · banque · report à nouveau', 3_000_000, jbq?.reportANouveau);
    R.montant('2026 · note 4 · banque · recettes', 2_500_000, jbq?.totalRecettes);
    R.montant('2026 · note 4 · banque · dépenses', 3_810_000, jbq?.totalDepenses);
    R.montant('2026 · note 4 · banque · solde à reporter', 1_690_000, jbq?.soldeAReporter);
    R.egal('2026 · note 4 · banque · le journal reboucle sur la balance', true, jbq?.boucle);
    R.montant('2026 · note 4 · caisse · report à nouveau', 500_000, jca?.reportANouveau);
    R.montant('2026 · note 4 · caisse · recettes', 1_200_000, jca?.totalRecettes);
    // Caisse · dépenses fournitures 300 000 + vidéoprojecteur 300 000 + versement 500 000.
    R.montant('2026 · note 4 · caisse · dépenses', 1_100_000, jca?.totalDepenses);
    R.montant('2026 · note 4 · caisse · solde à reporter', 600_000, jca?.soldeAReporter);
    const vbq = sommesVentilation(jbq);
    const vca = sommesVentilation(jca);
    R.montant('2026 · note 4 · caisse · colonne Cotisations', 1_200_000, vca['RECETTE:cotisations']);
    R.montant('2026 · note 4 · banque · colonne Salaires', 1_200_000, vbq['DEPENSE:salaires']);
    // Le règlement de la facture de kits (601) EST une dépense sur achats en
    // comptabilité de trésorerie (Partie 4 ch. 1, section 4, « Décaissements
    // au cours de l'exercice N = Achats (N) + Dettes (N – 1) – Dettes N ») ·
    // le compte de résultat le rattache à JA (constat N4) ; la colonne
    // « Achats de biens liés à l'activité » du journal qui le justifie doit
    // donc le porter aussi.
    R.montant('2026 · note 4 · banque · colonne Achats de biens liés à l’activité (règlement des kits)', 1_000_000, vbq['DEPENSE:achatsActivite']);
    R.note(`2026 · note 4 · ventilation banque ${JSON.stringify(vbq)} · caisse ${JSON.stringify(vca)}`);

    // Article 6 · ressources par catégorie, 30 000 000 FCFA chacune.
    const el = await c.lire('Éligibilité SMT 2026', `/etats-financiers/smt/eligibilite?exerciceId=${n}`);
    const cat = (k) => el?.categories?.find((x) => x.cle === k)?.montant;
    R.montant('2026 · éligibilité · cotisations et autres revenus (701 + 7052)', 1_450_000, cat('cotisationsRevenus'));
    R.montant('2026 · éligibilité · dons et legs (704)', 2_000_000, cat('donsLegs'));
    R.montant('2026 · éligibilité · subventions', 0, cat('subventions'));
    R.montant('2026 · éligibilité · total des ressources', 3_450_000, el?.totalRessources);
    R.egal('2026 · éligibilité · cumul sur deux exercices non mesurable (premier exercice)', null, el?.cumulBiennal ?? null);
    R.egal('2026 · éligibilité · aucune conversion inventée (seuil en FCFA)', false, el?.conversionAppliquee);

    const rapport = await c.lire('Registre des donateurs · rapport 2026', `/registre-donateurs/rapport-conformite?exerciceId=${n}`);
    R.montant('2026 · registre des donateurs · total inscrit', 2_000_000, rapport?.rapprochement?.totalRegistre);
    R.montant('2026 · registre des donateurs · total comptabilisé', 2_000_000, rapport?.rapprochement?.totalComptable);

    await relireLiasse(c, R, '2026', `/exports/etats-financiers/liasse-complete?exerciceId=${n}`, { GZ: 4_240_000, HZ: 4_240_000, KZC: 590_000, HB: 590_000 });
    await exportsSmt(c, R, '2026', n, 'etats-financiers', ['bilan', 'compte-de-resultat', 'journal-tresorerie', 'notes', 'eligibilite']);
    await confronterControles(c, R, '2026 · contrôles de clôture', n, CONTROLES_COMMUNS);
  });

  const clos = await etape(R, 'Clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('SMT SYCEBNL · 2027 non joué · la clôture de 2026 n’a pas abouti ou 2027 manque');

  // --- 2027 ---------------------------------------------------------------------
  await etape(R, '2027 · à-nouveaux et bilan d’ouverture', async () => {
    const b = await balance(c, n1);
    R.montant('2027 · à-nouveau banque', 1_690_000, solde(b, BQ));
    R.montant('2027 · à-nouveau caisse', 600_000, solde(b, CAISSE));
    R.montant('2027 · à-nouveau résultat 2026 au 13', -590_000, solde(b, '13'));
    R.montant('2027 · à-nouveau stock', 400_000, solde(b, '311'));
    R.montant('2027 · à-nouveau créance CLI-1', 250_000, solde(b, '412'));
    R.montant('2027 · à-nouveau dette FRS-2', -150_000, solde(b, '401'));
    const bilan = await c.lire('Bilan SMT 2027 à l’ouverture', `/etats-financiers/smt/bilan?exerciceId=${n1}`);
    const f = aplatir(bilan);
    // Avant toute opération · le résultat 2026 non affecté reste au 13, lu en HB.
    R.montant('2027 · bilan SMT à l’ouverture · GZ', 4_240_000, f.GZ?.n);
    R.montant('2027 · bilan SMT à l’ouverture · HB (résultat 2026 non affecté)', 590_000, f.HB?.n);
    R.egal('2027 · bilan SMT à l’ouverture · équilibré', true, bilan?.equilibre);
  });

  await etape(R, '2027 · opérations', async () => {
    const aCli = await ligneANouveau(c, cli, '2027', 250_000, 'DEBIT');
    await regler('Encaissement de la créance CLI-1', 'CLIENT', n1, '2027-01-15', cli, aCli?.id, 250_000);
    const aFrs = await ligneANouveau(c, frs2, '2027', 150_000, 'CREDIT');
    await regler('Règlement de la facture d’électricité de 2026', 'FOURNISSEUR', n1, '2027-01-20', frs2, aFrs?.id, 150_000);
    await ecriture(c, 'Cotisations 2027 encaissées (caisse)', n1, '2027-01-31', 'Cotisations 2027 encaissées', [[CAISSE, 1_400_000, 0], ['70100000', 0, 1_400_000]], { journal: ca });
    const don = await ecriture(c, 'Don 2027', n1, '2027-03-15', 'Don Fondation Tanganyika 2027', [[BQ, 1_000_000, 0], ['70410000', 0, 1_000_000]], { journal: bq });
    await c.geste('Registre · don de 1 000 000', 'POST', '/registre-donateurs', {
      dateOperation: '2027-03-15', nature: 'DON', typeDonateur: 'PERSONNE_MORALE', denomination: 'Fondation Tanganyika',
      numeroImmatriculation: 'RCCM-KLM-2018-B-007', adresseSiegeSocial: 'Kalemie', montant: 1_000_000, modeLiberation: 'VIREMENT', ecritureId: don?.id,
    });
    // Achat payé comptant, saisi 60 / 52 · la tenue même du SMT.
    await ecriture(c, 'Kits scolaires payés comptant', n1, '2027-03-20', 'Kits scolaires 2027', [['60110000', 800_000, 0], [BQ, 0, 800_000]], { journal: bq });
    await ecriture(c, 'Salaires du premier semestre 2027', n1, '2027-06-30', 'Salaires janvier à juin 2027', [['66110000', 600_000, 0], [BQ, 0, 600_000]], { journal: bq });
    await ecriture(c, 'Fournitures de bureau 2027 (caisse)', n1, '2027-08-15', 'Fournitures de bureau 2027', [['60550000', 200_000, 0], [CAISSE, 0, 200_000]], { journal: ca });
    await ecriture(c, 'Loyer 2027', n1, '2027-09-01', 'Loyer septembre 2027 à août 2028', [['62220000', 360_000, 0], [BQ, 0, 360_000]], { journal: bq });
    await ecriture(c, 'Versement de la caisse à la banque 2027', n1, '2027-11-30', 'Versement d’espèces en banque', [[BQ, 1_000_000, 0], [CAISSE, 0, 1_000_000]], { journal: bq });
    await ecriture(c, 'Prestation 2027 non échue', n1, '2027-12-15', 'Animation de Noël',
      [[cli.numero, 300_000, 0, { dateEcheance: '2028-01-15' }], ['70520000', 0, 300_000]], { journal: ven });
    await ecriture(c, 'Électricité de décembre 2027, non échue', n1, '2027-12-20', 'Électricité de décembre 2027',
      [['60520000', 180_000, 0], [frs2.numero, 0, 180_000, { dateEcheance: '2028-01-20' }]], { journal: ach });
    await ecriture(c, 'Salaires du second semestre 2027', n1, '2027-12-31', 'Salaires juillet à décembre 2027', [['66110000', 600_000, 0], [BQ, 0, 600_000]], { journal: bq });
    // 25 kits à 10 000 · stock final 250 000 contre 400 000 · D 6031 / C 3110 150 000.
    await stockFinal(c, R, '2027', n1, STOCK, 'Kits scolaires', 'kit', 25, 250_000);
    // Le matériel informatique seul · le vidéoprojecteur sort en cours d'année
    // (étape de la cession), sa dotation 2027 est passée par la sortie.
    if (ctx.immo) await c.geste('Dotation 2027', 'POST', `/immobilisations/${ctx.immo.id}/dotation`, { exerciceId: n1, journalId: c.od.id });
    await validerJusqua(c, n1, '2027-12-31');
  });

  await etape(R, '2027 · situation avant l’affectation, puis affectation', async () => {
    const bilan = await c.lire('Bilan SMT 2027 avant affectation', `/etats-financiers/smt/bilan?exerciceId=${n1}`);
    const f = aplatir(bilan);
    // HB = 590 000 (13) − 490 000 (classes 6 à 8) = 100 000 ; HC = 500 000 ;
    // GA = 750 000 + vidéoprojecteur encore détenu 250 000.
    R.montant('2027 · bilan SMT avant affectation · HB', 100_000, f.HB?.n);
    R.montant('2027 · bilan SMT avant affectation · HC', 500_000, f.HC?.n);
    R.montant('2027 · bilan SMT avant affectation · GZ', 3_780_000, f.GZ?.n);
    R.egal('2027 · bilan SMT avant affectation · équilibré', true, bilan?.equilibre);
    await c.geste('Affectation du résultat 2026', 'POST', '/affectation-resultat', {
      exerciceId: n, dateDecision: '2027-06-30', organe: 'Assemblée générale ordinaire', lignes: [{ compteId: compte(c, '12100000'), montant: 590_000 }],
    });
    await validerJusqua(c, n1, '2027-12-31');
  });

  await etape(R, '2027 · balance, états et notes du SMT', async () => {
    const b = await balance(c, n1);
    R.montant('2027 · balance équilibrée', 0, b ? b.totalDebit - b.totalCredit : null);
    // Banque · 1 690 000 + 250 000 − 150 000 + 1 000 000 − 800 000 − 600 000 − 360 000 + 1 000 000 − 600 000 = 1 430 000.
    // Caisse · 600 000 + 1 400 000 − 200 000 − 1 000 000 = 800 000.
    // 2844 · − 200 000 à l'ouverture − 300 000 ; 121 · 500 000 + 590 000.
    const att = {
      [BQ]: 1_430_000, [CAISSE]: 800_000, '2844': -500_000, '311': 250_000, '412': 300_000, '401': -180_000,
      '121': -1_090_000, '13': 0, '701': -1_400_000, '7041': -1_000_000, '7052': -300_000,
      '6011': 800_000, '6031': 150_000, '6055': 200_000, '6052': 180_000, '6222': 360_000, '6611': 1_200_000, '6813': 300_000,
    };
    for (const [racine, m] of Object.entries(att)) R.montant(`2027 · solde ${racine}`, m, solde(b, racine));
    // Produits 2 700 000 ; charges 3 190 000 · déficit de 490 000.
    R.montant('2027 · résultat (classes 6 à 8)', -490_000, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));

    const bilan = await c.lire('Bilan SMT 2027', `/etats-financiers/smt/bilan?exerciceId=${n1}`);
    const f = aplatir(bilan);
    for (const [ref, m] of Object.entries({ GA: 1_000_000, GB: 250_000, GC: 300_000, GD: 800_000, GE: 1_430_000, GZ: 3_780_000, HA: 3_000_000, HB: -490_000, HC: 1_090_000, HD: 180_000, HZ: 3_780_000 })) {
      R.montant(`2027 · bilan SMT · ${ref}`, m, f[ref]?.n);
    }
    for (const [ref, m] of Object.entries({ GZ: 4_240_000, HB: 590_000, HZ: 4_240_000 })) R.montant(`2027 · bilan SMT · colonne N-1 · ${ref}`, m, f[ref]?.n1);

    const cr = await c.lire('Compte de résultat SMT 2027', `/etats-financiers/smt/compte-de-resultat?exerciceId=${n1}`);
    const g = aplatir(cr);
    // KA = cotisations 1 400 000 + don 1 000 000 + encaissement CLI-1 250 000.
    // JA = kits 800 000 + fournitures 200 000 + électricité 2026 payée 150 000
    // (rattachée à sa facture 6052 par l'à-nouveau, constat N4).
    for (const [ref, m] of Object.entries({ KA: 2_650_000, KB: 0, JA: 1_150_000, JB: 360_000, JC: 1_200_000, JD: 0, JE: 0, JF: 0 })) {
      R.montant(`2027 · compte de résultat SMT · ${ref}`, m, g[ref]?.n);
    }
    R.montant('2027 · compte de résultat SMT · KZ', -60_000, cr?.soldeCaisse);
    // VA 250 000 − 400 000 ; VB 300 000 − 250 000 ; VC 180 000 − 150 000 ; JG 300 000.
    for (const [ref, m] of Object.entries({ VA: -150_000, VB: 50_000, VC: 30_000, JG: 300_000 })) R.montant(`2027 · compte de résultat SMT · ${ref}`, m, g[ref]?.n);
    // KZC = − 60 000 − 150 000 + 50 000 − 30 000 − 300 000 = − 490 000.
    R.montant('2027 · compte de résultat SMT · KZC', -490_000, cr?.resultatNet);
    R.egal('2027 · compte de résultat SMT · KZC concorde avec le résultat du bilan', true, cr?.controle?.concordant);
    R.egal('2027 · compte de résultat SMT · aucun règlement fournisseur laissé non rattaché', [], (cr?.reglementsNonRattaches ?? []).map((x) => `${x.numero} ${x.montant}`));
    // La colonne N-1 rejoue 2026 sur un exercice CLÔTURÉ · mêmes chiffres qu'en 2026.
    R.montant('2027 · compte de résultat SMT · colonne N-1 · KZC', 590_000, cr?.resultatNetN1);
    R.montant('2027 · compte de résultat SMT · colonne N-1 · KX', 3_200_000, cr?.totalRecettesN1);
    R.montant('2027 · compte de résultat SMT · colonne N-1 · JG', 200_000, g.JG?.n1);
    R.montant('2027 · compte de résultat SMT · colonne N-1 · VA', 400_000, g.VA?.n1);

    const notes = await c.lire('Notes SMT 2027', `/etats-financiers/smt/notes?exerciceId=${n1}`);
    R.montant('2027 · note 2 · stock final', 250_000, notes?.note2?.valeurStockFinal);
    R.montant('2027 · note 2 · stock initial', 400_000, notes?.note2?.valeurStockInitial);
    R.montant('2027 · note 3 · total des créances', 300_000, notes?.note3?.totalCreances);
    R.montant('2027 · note 3 · créances non échues', 300_000, notes?.note3?.totalCreancesNonEchues);
    R.montant('2027 · note 3 · total des dettes', 180_000, notes?.note3?.totalDettes);
    R.montant('2027 · note 3 · dettes non échues', 180_000, notes?.note3?.totalDettesNonEchues);
    const c3 = (notes?.note3?.creances ?? []).find((x) => String(x.numero ?? '').startsWith('412'));
    R.montant('2027 · note 3 · créance CLI-1 au 1er janvier', 250_000, c3?.montantOuverture);

    const jt = await c.lire('Journal de trésorerie SMT 2027', `/etats-financiers/smt/journal-tresorerie?exerciceId=${n1}`);
    const jbq = (jt?.journaux ?? []).find((j) => j.numero === BQ);
    const jca = (jt?.journaux ?? []).find((j) => j.numero === CAISSE);
    R.montant('2027 · note 4 · banque · report à nouveau', 1_690_000, jbq?.reportANouveau);
    R.montant('2027 · note 4 · banque · recettes', 2_250_000, jbq?.totalRecettes);
    R.montant('2027 · note 4 · banque · dépenses', 2_510_000, jbq?.totalDepenses);
    R.montant('2027 · note 4 · banque · solde à reporter', 1_430_000, jbq?.soldeAReporter);
    R.egal('2027 · note 4 · banque · le journal reboucle', true, jbq?.boucle);
    R.montant('2027 · note 4 · caisse · solde à reporter', 800_000, jca?.soldeAReporter);

    const el = await c.lire('Éligibilité SMT 2027', `/etats-financiers/smt/eligibilite?exerciceId=${n1}`);
    const cat = (k) => el?.categories?.find((x) => x.cle === k)?.montant;
    const cum = (k) => el?.cumulBiennal?.find((x) => x.cle === k);
    R.montant('2027 · éligibilité · cotisations et autres revenus (1 400 000 + 300 000)', 1_700_000, cat('cotisationsRevenus'));
    R.montant('2027 · éligibilité · dons et legs', 1_000_000, cat('donsLegs'));
    // Art. 6, seconde phrase · le cumul relit 2026, exercice CLÔTURÉ, avant le
    // solde de ses comptes de gestion.
    R.montant('2027 · éligibilité · cumul biennal · cotisations (1 450 000 + 1 700 000)', 3_150_000, cum('cotisationsRevenus')?.cumule);
    R.montant('2027 · éligibilité · cumul biennal · dons (2 000 000 + 1 000 000)', 3_000_000, cum('donsLegs')?.cumule);

    await relireLiasse(c, R, '2027', `/exports/etats-financiers/liasse-complete?exerciceId=${n1}`, { GZ: 3_780_000, HZ: 3_780_000, KZC: -490_000, HB: -490_000 });
    await exportsSmt(c, R, '2027', n1, 'etats-financiers', ['bilan', 'compte-de-resultat', 'journal-tresorerie', 'notes', 'eligibilite']);
    await confronterControles(c, R, '2027 · contrôles de clôture', n1, CONTROLES_2027);
  });

  await etape(R, '2027 · cession du vidéoprojecteur (jumeau de l’anomalie n° 22)', async () => {
    if (!ctx.projecteur) return R.note('Vidéoprojecteur absent · cession non jouée');
    // Vendu 180 000 en espèces le 30/06/2027. Dotation arrêtée à la sortie
    // (fiche du COMPTE 81) · prorata maintenu au SMT SYCEBNL, six mois ·
    // 100 000 × 6/12 = 50 000 ; cumul 100 000 ; valeur nette 200 000 au 812,
    // prix au 822.
    await c.geste('Cession du vidéoprojecteur', 'POST', `/immobilisations/${ctx.projecteur.id}/sortie`, {
      dateSortie: '2027-06-30', type: 'CESSION', natureSortie: 'VENTE', prixCession: 180_000, compteContrepartieId: compte(c, CAISSE),
      exerciceId: n1, journalId: ca.id, referencePieceSortie: 'VTE-PROJ-2027', datePieceSortie: '2027-06-30',
    });
    await validerJusqua(c, n1, '2027-12-31');
    const b = await balance(c, n1);
    // 2844 · − 500 000 − 50 000 + 100 000 ; 6813 · 300 000 + 50 000.
    for (const [racine, m] of Object.entries({ [CAISSE]: 980_000, '2844': -450_000, '812': 200_000, '822': -180_000, '6813': 350_000 })) {
      R.montant(`2027 après cession · solde ${racine}`, m, solde(b, racine));
    }
    // − 490 000 + 180 000 − 200 000 − 50 000 = − 560 000.
    R.montant('2027 après cession · résultat (classes 6 à 8)', -560_000, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));
    const bilan = await c.lire('Bilan SMT 2027 après cession', `/etats-financiers/smt/bilan?exerciceId=${n1}`);
    const f = aplatir(bilan);
    for (const [ref, m] of Object.entries({ GA: 750_000, GD: 980_000, GZ: 3_710_000, HB: -560_000, HZ: 3_710_000 })) R.montant(`2027 après cession · bilan SMT · ${ref}`, m, f[ref]?.n);
    const cr = await c.lire('Compte de résultat SMT 2027 après cession', `/etats-financiers/smt/compte-de-resultat?exerciceId=${n1}`);
    const g = aplatir(cr);
    // KB · le prix au 822 ; JG 350 000 ; la valeur nette (812) n'a aucune
    // contrepartie de trésorerie · KZ = 2 830 000 − 2 710 000 = 120 000 ;
    // KZC = 120 000 − 150 000 + 50 000 − 30 000 − 350 000 = − 360 000, contre
    // − 560 000 au bilan · écart de la valeur nette, que le contrôle doit dire.
    for (const [ref, m] of Object.entries({ KB: 180_000, JG: 350_000 })) R.montant(`2027 après cession · compte de résultat SMT · ${ref}`, m, g[ref]?.n);
    R.montant('2027 après cession · compte de résultat SMT · KZ', 120_000, cr?.soldeCaisse);
    R.montant('2027 après cession · compte de résultat SMT · KZC', -360_000, cr?.resultatNet);
    R.egal('2027 après cession · l’écart de la valeur nette est EXPOSÉ (non concordant)', false, cr?.controle?.concordant);
    R.montant('2027 après cession · écart KZC − résultat du bilan = valeur nette cédée', 200_000, cr?.controle?.ecart);
    const notes = await c.lire('Notes SMT 2027 après cession', `/etats-financiers/smt/notes?exerciceId=${n1}`);
    const sortie = (notes?.note1?.sortiesDeLExercice ?? [])[0];
    R.egal('2027 après cession · note 1 · le bien sorti figure à part, prix de cession', ['Vidéoprojecteur', 180_000], [sortie?.designation ?? null, sortie?.prixCession ?? null]);
    const jt = await c.lire('Journal de trésorerie SMT 2027 après cession', `/etats-financiers/smt/journal-tresorerie?exerciceId=${n1}`);
    const jca = (jt?.journaux ?? []).find((j) => j.numero === CAISSE);
    R.montant('2027 après cession · note 4 · caisse · colonne Matériel, mobilier et autres', 180_000, sommesVentilation(jca)['RECETTE:materiel']);
    R.montant('2027 après cession · note 4 · caisse · solde à reporter', 980_000, jca?.soldeAReporter);
  });

  await etape(R, 'Clôture 2027', () => cloturer(c, '2027'));
  await etape(R, '2028 · à-nouveaux de la clôture de 2027', async () => {
    await rechargerExercices(c);
    const n2 = c.exercices.get('2028')?.id;
    if (!n2) return R.note('2028 absent après la clôture de 2027');
    const b = await balance(c, n2);
    R.montant('2028 · à-nouveau banque', 1_430_000, solde(b, BQ));
    R.montant('2028 · à-nouveau caisse', 980_000, solde(b, CAISSE));
    R.montant('2028 · à-nouveau déficit 2027 au 13', 560_000, solde(b, '13'));
    R.montant('2028 · à-nouveau report à nouveau', -1_090_000, solde(b, '121'));
    R.montant('2028 · à-nouveau stock', 250_000, solde(b, '311'));
  });
}

// =============================================================================
// 2. ENTREPRISE INDIVIDUELLE SYSCOHADA AU SMT
// =============================================================================

async function scenarioSmtSyscohada(registre) {
  registre.scenario = 'SMT SYSCOHADA';
  const R = registre;
  const c = await nouveauDossier(R, 'Passe smt · Boutique Neema', {
    referentiel: 'SYSCOHADA', systeme: 'MINIMAL_TRESORERIE', cle: 'smt-ei', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const BQ = '52110000';
  const CAISSE = '57110000';
  const STOCK = '31110000';
  const VENTES = '70110000';
  const ACHATS = '60110000';
  const bq = c.journal('BQ') ?? c.od;
  const ca = c.journal('CA') ?? c.od;
  const ach = c.journal('ACH') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const ctx = {};

  await etape(R, 'Paramètres · entreprise individuelle, inventaire intermittent', async () => {
    await c.geste('Forme · entreprise individuelle', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'ENTREPRISE_INDIVIDUELLE' });
    await c.geste('Inventaire intermittent', 'PATCH', '/dossier/methode-inventaire-stocks', { methodeInventaireStocks: 'INTERMITTENT' });
  });

  await etape(R, 'Reprise · bilan d’ouverture importé au 1er janvier 2026', async () => {
    await IMPORT_BALANCE(c, n, [
      [BQ, 'Banque', 2_000_000, 0], [CAISSE, 'Caisse', 300_000, 0], [STOCK, 'Pagnes wax', 500_000, 0],
      ['10300000', 'Capital personnel', 0, 2_800_000],
    ]);
    await validerJusqua(c, n, '2026-01-01');
  });

  const c1 = await tiers(c, 'CLIENT', 'C1', 'Restaurant du Lac Kivu');
  const c2 = await tiers(c, 'CLIENT', 'C2', 'Hôtel du Mont Goma');
  const f1 = await tiers(c, 'FOURNISSEUR', 'F1', 'Grossiste de Kinshasa');
  const regler = (geste, sens, ex, date, t, ligneId, montant) => {
    if (!t || !ligneId) return R.note(`${geste} · tiers ou ligne absent, règlement non passé`);
    return c.geste(geste, 'POST', '/reglements', { sens, exerciceId: ex, journalId: bq.id, date, reglements: [{ compteId: t.compteId, ligneIds: [ligneId], montant }] });
  };
  const ventes = (an, date, m) => ecriture(c, `Ventes au comptant ${date}`, an, date, `Ventes au comptant au ${date}`, [[CAISSE, m, 0], [VENTES, 0, m]], { journal: ca });
  const salaire = (an, date) => ecriture(c, `Salaire du vendeur ${date}`, an, date, `Salaire du vendeur, trimestre au ${date}`, [['66110000', 450_000, 0], [CAISSE, 0, 450_000]], { journal: ca });
  const virement = (an, date, m) => ecriture(c, `Versement caisse → banque ${date}`, an, date, 'Versement d’espèces en banque', [[BQ, m, 0], [CAISSE, 0, m]], { journal: bq });
  const achatPaye = (an, date, m) => ecriture(c, `Achat de marchandises payé ${date}`, an, date, `Achat de pagnes au ${date}`, [[ACHATS, m, 0], [BQ, 0, m]], { journal: bq });
  const loyer = (an, date) => ecriture(c, `Loyer ${date}`, an, date, `Loyer du semestre au ${date}`, [['62220000', 600_000, 0], [BQ, 0, 600_000]], { journal: bq });

  // --- 2026 ---------------------------------------------------------------------
  await etape(R, '2026 · recettes et dépenses de trésorerie', async () => {
    await loyer(n, '2026-01-05');
    // Apport temporaire de l'exploitant · crédit du 104 (Titre VII, COMPTE 104).
    await ecriture(c, 'Apport de l’exploitant', n, '2026-01-10', 'Apport temporaire de l’exploitant', [[BQ, 1_400_000, 0], ['10410000', 0, 1_400_000]], { journal: bq });
    // Étagères et comptoir, payés en banque, quatre ans · cédés en 2027.
    ctx.mobilier = await c.geste('Étagères et comptoir (module)', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24440000'), designation: 'Étagères et comptoir', dateAcquisition: '2026-02-01', dateMiseEnService: '2026-02-01',
      valeurOrigine: 400_000, dureeAmortissementAns: 4, modeAmortissement: 'LINEAIRE', compteContrepartieId: compte(c, BQ), exerciceId: n, journalId: bq.id,
    });
    await achatPaye(n, '2026-02-15', 2_000_000);
    await ventes(n, '2026-03-31', 2_500_000);
    await salaire(n, '2026-03-31');
    await virement(n, '2026-04-10', 2_000_000);
    await achatPaye(n, '2026-05-15', 2_000_000);
    await ventes(n, '2026-06-30', 3_000_000);
    await salaire(n, '2026-06-30');
    await ecriture(c, 'Patente 2026', n, '2026-06-30', 'Patente 2026', [['64120000', 100_000, 0], [BQ, 0, 100_000]], { journal: bq });
    await virement(n, '2026-07-01', 2_000_000);
    await loyer(n, '2026-07-05');
    await ventes(n, '2026-09-30', 2_500_000);
    await salaire(n, '2026-09-30');
    ctx.immo = await c.geste('Caisse enregistreuse et ordinateur (module)', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24420000'), designation: 'Caisse enregistreuse et ordinateur', dateAcquisition: '2026-10-01', dateMiseEnService: '2026-10-01',
      valeurOrigine: 1_200_000, dureeAmortissementAns: 4, modeAmortissement: 'LINEAIRE', compteContrepartieId: compte(c, BQ), exerciceId: n, journalId: bq.id,
    });
    // Prélèvement de l'exploitant · débit du 104 (Titre VII, COMPTE 104).
    await ecriture(c, 'Prélèvement de l’exploitant', n, '2026-10-31', 'Prélèvement de l’exploitant', [['10480000', 300_000, 0], [CAISSE, 0, 300_000]], { journal: ca });
    await ecriture(c, 'Vente à crédit à C1, non échue', n, '2026-12-15', 'Pagnes livrés au Restaurant du Lac Kivu',
      [[c1.numero, 400_000, 0, { dateEcheance: '2027-01-15' }], [VENTES, 0, 400_000]], { journal: ven });
    await ecriture(c, 'Achat à crédit chez F1, non échu', n, '2026-12-20', 'Pagnes reçus du grossiste',
      [[ACHATS, 600_000, 0], [f1.numero, 0, 600_000, { dateEcheance: '2027-01-20' }]], { journal: ach });
    await salaire(n, '2026-12-31');
  });

  await etape(R, '2026 · refus du SMT SYSCOHADA (dépréciation, dégressif)', async () => {
    if (!ctx.immo) return R.note('Immobilisation absente · refus non éprouvés');
    // Titre X ch. 2 · aucun poste de dépréciation au modèle.
    await refusSmt(c, R, '2026 · dotation à une dépréciation de la caisse enregistreuse', 'POST', `/immobilisations/${ctx.immo.id}/depreciation`, {
      exerciceId: n, journalId: c.od.id, sens: 'DOTATION', montant: 100_000, compteDepreciationId: compte(c, '29440000'),
      compteContrepartieId: compte(c, '69140000'), indice: 'Panne constatée le 31/12/2026',
    });
    // Titre X ch. 1 § 1 · « mode linéaire sans prorata temporis » · l'option
    // du dégressif est refusée au motif du SMT avant même la forme.
    await refusSmt(c, R, '2026 · option du dégressif fiscal', 'POST', `/immobilisations/${ctx.immo.id}/option-degressif`, {
      categorie: 'MACHINES_DE_BUREAU', bienNeuf: true, dureeFiscaleAns: 4,
    });
  });

  await etape(R, '2026 · stock final, dotation, solde du compte de l’exploitant', async () => {
    // 70 pièces à 10 000 · stock final 700 000 contre 500 000 à l'ouverture ·
    // D 31110000 / C 60310000 200 000.
    await stockFinal(c, R, '2026', n, STOCK, 'Pagnes wax', 'pièce', 70, 700_000);
    // SMT SYSCOHADA · « linéaire sans prorata temporis » (Titre X ch. 1 § 1) ·
    // 1 200 000 / 4 = 300 000 la première année, bien entré le 1er octobre
    // (le Système normal aurait doté 300 000 × 3/12 = 75 000).
    if (ctx.immo) {
      const d = await c.geste('Dotation 2026 · caisse enregistreuse', 'POST', `/immobilisations/${ctx.immo.id}/dotation`, { exerciceId: n, journalId: c.od.id });
      R.montant('2026 · dotation SMT de la caisse enregistreuse (annuité pleine, entrée le 1er octobre)', 300_000, d?.montant);
    }
    // Étagères · 400 000 / 4 = 100 000, entrées le 1er février, annuité pleine.
    if (ctx.mobilier) {
      const d = await c.geste('Dotation 2026 · étagères', 'POST', `/immobilisations/${ctx.mobilier.id}/dotation`, { exerciceId: n, journalId: c.od.id });
      R.montant('2026 · dotation SMT des étagères (annuité pleine, entrées le 1er février)', 100_000, d?.montant);
    }
    // Fiche du COMPTE 104 · « débité, à la clôture, du montant de son solde
    // créditeur, par le crédit du 103 » · 1 400 000 d'apport moins 300 000
    // de prélèvement = 1 100 000 viré au capital personnel.
    await ecriture(c, 'Solde du compte de l’exploitant au 103', n, '2026-12-31', 'Virement du compte de l’exploitant au capital personnel',
      [['10410000', 1_400_000, 0], ['10480000', 0, 300_000], ['10300000', 0, 1_100_000]]);
    await validerJusqua(c, n, '2026-12-31');
  });

  await etape(R, '2026 · balance, états et notes du SMT', async () => {
    await rechargerComptes(c);
    const b = await balance(c, n);
    R.montant('2026 · balance équilibrée', 0, b ? b.totalDebit - b.totalCredit : null);
    // Banque · 2 000 000 − 600 000 + 1 400 000 − 400 000 − 2 000 000 + 2 000 000 − 2 000 000 − 100 000 + 2 000 000 − 600 000 − 1 200 000 = 500 000.
    // Caisse · 300 000 + 8 000 000 − 4 × 450 000 − 4 000 000 − 300 000 = 2 200 000.
    const att = {
      [BQ]: 500_000, [CAISSE]: 2_200_000, '2442': 1_200_000, '2444': 400_000, '2844': -400_000, '311': 700_000, '411': 400_000, '401': -600_000,
      '103': -3_900_000, '104': 0, '7011': -8_400_000, '6011': 4_600_000, '6031': -200_000, '6222': 1_200_000, '6412': 100_000, '6611': 1_800_000, '6813': 400_000,
    };
    for (const [racine, m] of Object.entries(att)) R.montant(`2026 · solde ${racine}`, m, solde(b, racine));
    // Produits 8 400 000 ; charges 4 600 000 − 200 000 + 1 200 000 + 100 000 + 1 800 000 + 400 000 = 7 900 000.
    R.montant('2026 · résultat (classes 6 à 8)', 500_000, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));

    const bilan = await c.lire('Bilan SMT 2026', `/etats-financiers-syscohada/smt/bilan?exerciceId=${n}`);
    const f = aplatir(bilan);
    // SA1 (1 200 000 − 300 000) + (400 000 − 100 000) ; SP1 = 103 (2 800 000 + 1 100 000), 104 soldé.
    for (const [ref, m] of Object.entries({ SA1: 1_200_000, SA2: 700_000, SA3: 400_000, SA4: 2_200_000, SA5: 500_000, SAZ: 5_000_000, SP1: 3_900_000, SP2: 500_000, SP3: 0, SP4: 600_000, SPZ: 5_000_000 })) {
      R.montant(`2026 · bilan SMT · ${ref}`, m, f[ref]?.n);
    }
    // Comparatif sans N-1 · le bilan d'ouverture · 2 000 000 + 300 000 + 500 000.
    R.montant('2026 · bilan SMT · comparatif = bilan d’ouverture (total actif N-1)', 2_800_000, bilan?.totalActifN1);

    const cr = await c.lire('Compte de résultat SMT 2026', `/etats-financiers-syscohada/smt/compte-de-resultat?exerciceId=${n}`);
    const g = aplatir(cr);
    // A · ventes au comptant 8 000 000 (la vente à crédit n'est pas encaissée).
    // B · achats payés 4 000 000, loyers 1 200 000, salaires 1 800 000, patente 100 000.
    // Variations (N-1) − N (anomalie n° 2 de la table, le sens du 603) ·
    // SV1 500 000 − 700 000, SV2 0 − 400 000, SV3 0 − 600 000 ; F 300 000 + 100 000.
    // G = C − D + E − F = 900 000 − (−200 000 − 400 000) + (−600 000) − 400 000 = 500 000.
    for (const [ref, m] of Object.entries({
      SR1: 8_000_000, SR2: 0, SRA: 8_000_000, SD1: 4_000_000, SD2: 1_200_000, SD3: 1_800_000, SD4: 100_000, SD5: 0, SD6: 0, SDB: 7_100_000,
      SC: 900_000, SV1: -200_000, SV2: -400_000, SV3: -600_000, SF: 400_000, SG: 500_000,
    })) R.montant(`2026 · compte de résultat SMT · ${ref}`, m, g[ref]?.n);
    R.montant('2026 · compte de résultat SMT · lettre D (SV1 + SV2)', -600_000, cr?.lettres?.D);
    R.montant('2026 · compte de résultat SMT · lettre E (SV3)', -600_000, cr?.lettres?.E);
    R.egal('2026 · compte de résultat SMT · G concorde avec le résultat du bilan', true, cr?.controle?.concordant);
    // Hors A et B (anomalie n° 13) · apport + 1 400 000, prélèvement − 300 000, matériel − 1 200 000 et − 400 000.
    const hors = (cr?.fluxHorsResultat ?? []).reduce((s, x) => s + Number(x.montant ?? 0), 0);
    R.montant('2026 · compte de résultat SMT · flux hors résultat (apport, prélèvement, matériel)', -500_000, hors);

    const notes = await c.lire('Notes SMT 2026', `/etats-financiers-syscohada/smt/notes?exerciceId=${n}`);
    R.montant('2026 · note 1 · total du registre (deux biens)', 1_600_000, notes?.note1?.total);
    R.egal('2026 · note 1 · amortissement linéaire sans prorata temporis', false, notes?.note1?.amortissement?.prorataTemporis ?? null);
    R.montant('2026 · note 2 · stock final', 700_000, notes?.note2?.valeurStockFinal);
    R.montant('2026 · note 2 · stock initial', 500_000, notes?.note2?.valeurStockInitial);
    R.montant('2026 · note 2 · variation SV1 = ligne du compte de résultat', g.SV1?.n ?? NaN, notes?.note2?.variationSv1);
    const l2 = (notes?.note2?.lignes ?? []).find((l) => String(l.numero ?? l.reference ?? '').startsWith('311'));
    R.egal('2026 · note 2 · quantité et prix unitaire tirés du comptage (70 × 10 000)', [70, 10_000], [Number(l2?.quantite), Number(l2?.prixUnitaire)]);
    R.montant('2026 · note 3 · créances non échues', 400_000, notes?.note3?.totalCreancesNonEchues);
    R.montant('2026 · note 3 · dettes non échues', 600_000, notes?.note3?.totalDettesNonEchues);
    R.montant('2026 · note 3 · variation SV2 = ligne du compte de résultat', g.SV2?.n ?? NaN, notes?.note3?.variationSv2);
    R.montant('2026 · note 3 · variation SV3 = ligne du compte de résultat', g.SV3?.n ?? NaN, notes?.note3?.variationSv3);

    const jt = await c.lire('Journal de trésorerie SMT 2026', `/etats-financiers-syscohada/smt/journal-tresorerie?exerciceId=${n}`);
    const jbq = (jt?.journaux ?? []).find((j) => j.numero === BQ);
    const jca = (jt?.journaux ?? []).find((j) => j.numero === CAISSE);
    // Banque · recettes apport 1 400 000 + versements 4 000 000 ; dépenses 600 000 × 2 + 2 000 000 × 2 + 100 000 + 1 200 000 + 400 000.
    R.montant('2026 · note 4 · banque · report à nouveau', 2_000_000, jbq?.reportANouveau);
    R.montant('2026 · note 4 · banque · recettes', 5_400_000, jbq?.totalRecettes);
    R.montant('2026 · note 4 · banque · dépenses', 6_900_000, jbq?.totalDepenses);
    R.montant('2026 · note 4 · banque · solde à reporter', 500_000, jbq?.soldeAReporter);
    R.egal('2026 · note 4 · banque · le journal reboucle', true, jbq?.boucle);
    // Caisse · recettes 8 000 000 ; dépenses salaires 1 800 000 + versements 4 000 000 + prélèvement 300 000.
    R.montant('2026 · note 4 · caisse · recettes', 8_000_000, jca?.totalRecettes);
    R.montant('2026 · note 4 · caisse · dépenses', 6_100_000, jca?.totalDepenses);
    R.montant('2026 · note 4 · caisse · solde à reporter', 2_200_000, jca?.soldeAReporter);
    const vbq = sommesVentilation(jbq);
    const vca = sommesVentilation(jca);
    R.montant('2026 · note 4 · caisse · colonne Ventes', 8_000_000, vca['RECETTE:ventes']);
    R.montant('2026 · note 4 · banque · colonne Achats marchandises', 4_000_000, vbq['DEPENSE:achatsMarchandises']);
    R.montant('2026 · note 4 · colonne Compte exploitant (apport)', 1_400_000, vbq['RECETTE:compteExploitant']);
    R.montant('2026 · note 4 · colonne Compte exploitant (prélèvement)', 300_000, vca['DEPENSE:compteExploitant']);

    // Art. 13 · chiffre d'affaires HT de l'exercice face aux trois seuils.
    const el = await c.lire('Éligibilité SMT 2026', `/etats-financiers-syscohada/smt/eligibilite?exerciceId=${n}`);
    R.montant('2026 · éligibilité art. 13 · chiffre d’affaires (8 000 000 + 400 000)', 8_400_000, el?.chiffreAffaires);
    R.egal('2026 · éligibilité art. 13 · trois seuils servis (négoce, artisanat, services)', 3, el?.seuils?.length);
    R.egal('2026 · éligibilité art. 13 · aucune conversion inventée', false, el?.conversionAppliquee);
    R.egal('2026 · éligibilité art. 13 · système actuel', 'MINIMAL_TRESORERIE', el?.systemeActuel);

    const lia = await relireLiasse(c, R, '2026', `/exports/etats-financiers-syscohada/liasse-complete?exerciceId=${n}`);
    const ligneLiasse = (debut) => (lia?.lignes ?? []).find((l) => l.intitule.startsWith(debut));
    R.montant('2026 · liasse · total actif lu par CONTROLES', 5_000_000, ligneLiasse('Total actif')?.valeur);
    R.montant('2026 · liasse · résultat G lu par CONTROLES', 500_000, ligneLiasse('RÉSULTAT EXERCICE')?.valeur);
    await exportsSmt(c, R, '2026', n, 'etats-financiers-syscohada', ['bilan', 'compte-de-resultat', 'journal-tresorerie', 'notes']);
    await confronterControles(c, R, '2026 · contrôles de clôture', n, CONTROLES_COMMUNS);
  });

  const clos = await etape(R, 'Clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('SMT SYSCOHADA · 2027 non joué · la clôture de 2026 n’a pas abouti ou 2027 manque');

  // --- 2027 ---------------------------------------------------------------------
  await etape(R, '2027 · à-nouveaux', async () => {
    const b = await balance(c, n1);
    R.montant('2027 · à-nouveau banque', 500_000, solde(b, BQ));
    R.montant('2027 · à-nouveau caisse', 2_200_000, solde(b, CAISSE));
    R.montant('2027 · à-nouveau capital personnel', -3_900_000, solde(b, '103'));
    R.montant('2027 · à-nouveau compte de l’exploitant (soldé)', 0, solde(b, '104'));
    R.montant('2027 · à-nouveau résultat 2026 au 13', -500_000, solde(b, '13'));
    R.montant('2027 · à-nouveau stock', 700_000, solde(b, '311'));
  });

  await etape(R, '2027 · opérations', async () => {
    await virement(n1, '2027-01-10', 2_000_000);
    const aC1 = await ligneANouveau(c, c1, '2027', 400_000, 'DEBIT');
    await regler('Encaissement de la créance C1', 'CLIENT', n1, '2027-01-15', c1, aC1?.id, 400_000);
    const aF1 = await ligneANouveau(c, f1, '2027', 600_000, 'CREDIT');
    await regler('Règlement de la dette F1', 'FOURNISSEUR', n1, '2027-01-20', f1, aF1?.id, 600_000);
    await loyer(n1, '2027-01-20');
    await achatPaye(n1, '2027-02-15', 1_500_000);
    await ventes(n1, '2027-03-31', 3_000_000);
    await salaire(n1, '2027-03-31');
    await virement(n1, '2027-04-10', 2_000_000);
    await achatPaye(n1, '2027-05-15', 2_000_000);
    await ventes(n1, '2027-06-30', 3_000_000);
    await salaire(n1, '2027-06-30');
    await ecriture(c, 'Patente 2027 (caisse)', n1, '2027-06-30', 'Patente 2027', [['64120000', 100_000, 0], [CAISSE, 0, 100_000]], { journal: ca });
    await virement(n1, '2027-07-01', 2_000_000);
    await loyer(n1, '2027-07-05');
    await ventes(n1, '2027-09-30', 2_000_000);
    await salaire(n1, '2027-09-30');
    await ecriture(c, 'Prélèvement de l’exploitant 2027', n1, '2027-10-31', 'Prélèvement de l’exploitant', [['10480000', 500_000, 0], [CAISSE, 0, 500_000]], { journal: ca });
    await ecriture(c, 'Vente à crédit à C2, non échue', n1, '2027-12-20', 'Pagnes livrés à l’Hôtel du Mont Goma',
      [[c2.numero, 500_000, 0, { dateEcheance: '2028-01-20' }], [VENTES, 0, 500_000]], { journal: ven });
    await ecriture(c, 'Achat à crédit chez F1, non échu', n1, '2027-12-22', 'Pagnes reçus du grossiste',
      [[ACHATS, 800_000, 0], [f1.numero, 0, 800_000, { dateEcheance: '2028-01-22' }]], { journal: ach });
    await salaire(n1, '2027-12-31');
    // 40 pièces à 10 000 · 400 000 contre 700 000 · D 6031 / C 3111 300 000.
    await stockFinal(c, R, '2027', n1, STOCK, 'Pagnes wax', 'pièce', 40, 400_000);
    // La caisse enregistreuse seule · les étagères sortent en cours d'année
    // (étape de la cession, plus bas), leur annuité 2027 est passée par la sortie.
    if (ctx.immo) await c.geste('Dotation 2027', 'POST', `/immobilisations/${ctx.immo.id}/dotation`, { exerciceId: n1, journalId: c.od.id });
    // Fiche du COMPTE 104 · solde débiteur de 500 000 viré au 103.
    await ecriture(c, 'Solde du compte de l’exploitant au 103', n1, '2027-12-31', 'Virement du compte de l’exploitant au capital personnel',
      [['10300000', 500_000, 0], ['10480000', 0, 500_000]]);
    await validerJusqua(c, n1, '2027-12-31');
  });

  await etape(R, '2027 · situation avant l’affectation, puis affectation au 103', async () => {
    const bilan = await c.lire('Bilan SMT 2027 avant affectation', `/etats-financiers-syscohada/smt/bilan?exerciceId=${n1}`);
    const f = aplatir(bilan);
    // SP1 = 3 900 000 − 500 000 ; SP2 = 500 000 (13) + 500 000 (6 à 8) ;
    // SA1 = caisse enregistreuse 600 000 + étagères encore détenues 300 000.
    R.montant('2027 · bilan SMT avant affectation · SP1', 3_400_000, f.SP1?.n);
    R.montant('2027 · bilan SMT avant affectation · SP2', 1_000_000, f.SP2?.n);
    R.montant('2027 · bilan SMT avant affectation · SAZ', 5_200_000, f.SAZ?.n);
    R.montant('2027 · bilan SMT avant affectation · SPZ', 5_200_000, f.SPZ?.n);
    // COMPTE 103 · « crédité, à l'ouverture de l'exercice, du montant de
    // l'affectation du résultat de l'exercice précédent, par le débit du 131 ».
    await c.geste('Affectation du résultat 2026 au capital personnel', 'POST', '/affectation-resultat', {
      exerciceId: n, dateDecision: '2027-03-31', organe: 'Décision de l’exploitant', lignes: [{ compteId: compte(c, '10300000'), montant: 500_000 }],
    });
    await validerJusqua(c, n1, '2027-12-31');
  });

  await etape(R, '2027 · balance, états et notes du SMT', async () => {
    const b = await balance(c, n1);
    R.montant('2027 · balance équilibrée', 0, b ? b.totalDebit - b.totalCredit : null);
    // Banque · 500 000 + 2 000 000 + 400 000 − 600 000 − 600 000 − 1 500 000 + 2 000 000 − 2 000 000 + 2 000 000 − 600 000 = 1 600 000.
    // Caisse · 2 200 000 − 6 000 000 + 8 000 000 − 1 800 000 − 100 000 − 500 000 = 1 800 000.
    // 2844 · − 400 000 à l'ouverture − 300 000 de l'année ; 103 · 3 900 000 + 500 000 − 500 000.
    const att = {
      [BQ]: 1_600_000, [CAISSE]: 1_800_000, '2844': -700_000, '311': 400_000, '411': 500_000, '401': -800_000, '103': -3_900_000, '104': 0, '13': 0,
      '7011': -8_500_000, '6011': 4_300_000, '6031': 300_000, '6222': 1_200_000, '6412': 100_000, '6611': 1_800_000, '6813': 300_000,
    };
    for (const [racine, m] of Object.entries(att)) R.montant(`2027 · solde ${racine}`, m, solde(b, racine));
    R.montant('2027 · résultat (classes 6 à 8)', 500_000, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));

    const bilan = await c.lire('Bilan SMT 2027', `/etats-financiers-syscohada/smt/bilan?exerciceId=${n1}`);
    const f = aplatir(bilan);
    for (const [ref, m] of Object.entries({ SA1: 900_000, SA2: 400_000, SA3: 500_000, SA4: 1_800_000, SA5: 1_600_000, SAZ: 5_200_000, SP1: 3_900_000, SP2: 500_000, SP3: 0, SP4: 800_000, SPZ: 5_200_000 })) {
      R.montant(`2027 · bilan SMT · ${ref}`, m, f[ref]?.n);
    }
    for (const [ref, m] of Object.entries({ SAZ: 5_000_000, SP2: 500_000, SPZ: 5_000_000 })) R.montant(`2027 · bilan SMT · colonne N-1 · ${ref}`, m, f[ref]?.n1);

    const cr = await c.lire('Compte de résultat SMT 2027', `/etats-financiers-syscohada/smt/compte-de-resultat?exerciceId=${n1}`);
    const g = aplatir(cr);
    // SR1 = ventes au comptant 8 000 000 + encaissement de C1 400 000 (constat N3).
    // SD1 = achats payés 3 500 000 + règlement de F1 600 000 rattaché à sa facture 601.
    // SV1 700 000 − 400 000 ; SV2 400 000 − 500 000 ; SV3 600 000 − 800 000 ; F 300 000.
    // G = 1 200 000 − (300 000 − 100 000) + (− 200 000) − 300 000 = 500 000.
    for (const [ref, m] of Object.entries({
      SR1: 8_400_000, SR2: 0, SRA: 8_400_000, SD1: 4_100_000, SD2: 1_200_000, SD3: 1_800_000, SD4: 100_000, SD5: 0, SD6: 0, SDB: 7_200_000,
      SC: 1_200_000, SV1: 300_000, SV2: -100_000, SV3: -200_000, SF: 300_000, SG: 500_000,
    })) R.montant(`2027 · compte de résultat SMT · ${ref}`, m, g[ref]?.n);
    R.egal('2027 · compte de résultat SMT · G concorde avec le résultat du bilan', true, cr?.controle?.concordant);
    R.egal('2027 · compte de résultat SMT · aucun règlement fournisseur laissé non rattaché', [], (cr?.reglementsNonRattaches ?? []).map((x) => `${x.numero} ${x.montant}`));
    // Colonne N-1 rejouée sur 2026 CLÔTURÉ · F lu dans les mouvements, pas dans le solde.
    for (const [ref, m] of Object.entries({ SRA: 8_000_000, SF: 400_000, SG: 500_000 })) R.montant(`2027 · compte de résultat SMT · colonne N-1 · ${ref}`, m, g[ref]?.n1);

    const notes = await c.lire('Notes SMT 2027', `/etats-financiers-syscohada/smt/notes?exerciceId=${n1}`);
    R.montant('2027 · note 2 · stock final', 400_000, notes?.note2?.valeurStockFinal);
    R.montant('2027 · note 2 · stock initial', 700_000, notes?.note2?.valeurStockInitial);
    R.montant('2027 · note 3 · créances non échues', 500_000, notes?.note3?.totalCreancesNonEchues);
    R.montant('2027 · note 3 · dettes non échues', 800_000, notes?.note3?.totalDettesNonEchues);
    R.montant('2027 · note 3 · variation SV2 = ligne du compte de résultat', g.SV2?.n ?? NaN, notes?.note3?.variationSv2);
    R.montant('2027 · note 3 · variation SV3 = ligne du compte de résultat', g.SV3?.n ?? NaN, notes?.note3?.variationSv3);

    const jt = await c.lire('Journal de trésorerie SMT 2027', `/etats-financiers-syscohada/smt/journal-tresorerie?exerciceId=${n1}`);
    const jbq = (jt?.journaux ?? []).find((j) => j.numero === BQ);
    const jca = (jt?.journaux ?? []).find((j) => j.numero === CAISSE);
    R.montant('2027 · note 4 · banque · report à nouveau', 500_000, jbq?.reportANouveau);
    R.montant('2027 · note 4 · banque · recettes (versements 6 000 000 + C1 400 000)', 6_400_000, jbq?.totalRecettes);
    R.montant('2027 · note 4 · banque · dépenses', 5_300_000, jbq?.totalDepenses);
    R.montant('2027 · note 4 · banque · solde à reporter', 1_600_000, jbq?.soldeAReporter);
    R.montant('2027 · note 4 · caisse · solde à reporter', 1_800_000, jca?.soldeAReporter);
    const vbq = sommesVentilation(jbq);
    // Même lecture que SR1 et SD1 · l'encaissement de la créance C1 est une
    // recette sur ventes, le règlement de F1 un achat de marchandises
    // (Titre X ch. 1 § 1, comptabilité de trésorerie · constat N3).
    R.montant('2027 · note 4 · banque · colonne Ventes (encaissement de C1)', 400_000, vbq['RECETTE:ventes']);
    R.montant('2027 · note 4 · banque · colonne Achats marchandises (3 500 000 + règlement F1 600 000)', 4_100_000, vbq['DEPENSE:achatsMarchandises']);
    R.note(`2027 · note 4 · ventilation banque ${JSON.stringify(vbq)}`);

    const el = await c.lire('Éligibilité SMT 2027', `/etats-financiers-syscohada/smt/eligibilite?exerciceId=${n1}`);
    R.montant('2027 · éligibilité art. 13 · chiffre d’affaires', 8_500_000, el?.chiffreAffaires);

    const lia = await relireLiasse(c, R, '2027', `/exports/etats-financiers-syscohada/liasse-complete?exerciceId=${n1}`);
    const ligneLiasse = (debut) => (lia?.lignes ?? []).find((l) => l.intitule.startsWith(debut));
    R.montant('2027 · liasse · total actif lu par CONTROLES', 5_200_000, ligneLiasse('Total actif')?.valeur);
    R.montant('2027 · liasse · résultat G lu par CONTROLES', 500_000, ligneLiasse('RÉSULTAT EXERCICE')?.valeur);
    await exportsSmt(c, R, '2027', n1, 'etats-financiers-syscohada', ['bilan', 'compte-de-resultat', 'journal-tresorerie', 'notes']);
    await confronterControles(c, R, '2027 · contrôles de clôture', n1, CONTROLES_2027);
  });

  // CESSION AU SMT · les étagères vendues 250 000 en espèces le 30/06/2027.
  // Fiches des COMPTES 81 et 82 · prix au 822, valeur nette au 812 ; l'annuité
  // de l'année de sortie est « sans prorata temporis » au SMT (Titre X ch. 1
  // § 1, lecture d'OmegaX · annuité pleine, 100 000) ; cumul 200 000, valeur
  // nette 200 000. Le Titre X n'ouvre aucune ligne pour la valeur nette · le G
  // du SMT en est majoré, TROU DU TEXTE que la table documente (anomalie
  // n° 22 de `correspondance-smt-syscohada.ts`) et que le contrôle de
  // concordance doit EXPOSER, jamais absorber. Joué APRÈS la relecture des
  // états de 2027 pour que la liasse ci-dessus juge un dossier sans cession.
  await etape(R, '2027 · cession des étagères (anomalie n° 22 du Titre X)', async () => {
    if (!ctx.mobilier) return R.note('Étagères absentes · cession non jouée');
    await c.geste('Cession des étagères', 'POST', `/immobilisations/${ctx.mobilier.id}/sortie`, {
      dateSortie: '2027-06-30', type: 'CESSION', natureSortie: 'VENTE', prixCession: 250_000, compteContrepartieId: compte(c, CAISSE),
      exerciceId: n1, journalId: ca.id, referencePieceSortie: 'VTE-ETAG-2027', datePieceSortie: '2027-06-30',
    });
    await validerJusqua(c, n1, '2027-12-31');
    const b = await balance(c, n1);
    // 6813 · 300 000 + 100 000 ; 2844 · − 700 000 − 100 000 + 200 000 soldé avec le bien.
    for (const [racine, m] of Object.entries({ [CAISSE]: 2_050_000, '2444': 0, '2844': -600_000, '812': 200_000, '822': -250_000, '6813': 400_000 })) {
      R.montant(`2027 après cession · solde ${racine}`, m, solde(b, racine));
    }
    // 500 000 + 250 000 − 200 000 − 100 000 = 450 000.
    R.montant('2027 après cession · résultat (classes 6 à 8)', 450_000, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));
    const bilan = await c.lire('Bilan SMT 2027 après cession', `/etats-financiers-syscohada/smt/bilan?exerciceId=${n1}`);
    const f = aplatir(bilan);
    // SA1 600 000 ; SA4 2 050 000 ; SP2 450 000 · le bilan, lu en soldes, reste juste.
    for (const [ref, m] of Object.entries({ SA1: 600_000, SA4: 2_050_000, SAZ: 5_150_000, SP2: 450_000, SPZ: 5_150_000 })) R.montant(`2027 après cession · bilan SMT · ${ref}`, m, f[ref]?.n);
    const cr = await c.lire('Compte de résultat SMT 2027 après cession', `/etats-financiers-syscohada/smt/compte-de-resultat?exerciceId=${n1}`);
    const g = aplatir(cr);
    // SR2 · le prix au 822 (« crédité des produits de cession d'actif… par le
    // débit d'un compte de trésorerie », COMPTE 82) ; F 300 000 + 100 000 ;
    // G = (8 650 000 − 7 200 000) − (300 000 − 100 000) + (− 200 000) − 400 000 = 650 000.
    for (const [ref, m] of Object.entries({ SR2: 250_000, SRA: 8_650_000, SC: 1_450_000, SF: 400_000, SG: 650_000 })) R.montant(`2027 après cession · compte de résultat SMT · ${ref}`, m, g[ref]?.n);
    R.egal('2027 après cession · l’écart de la valeur nette est EXPOSÉ (non concordant)', false, cr?.controle?.concordant);
    R.montant('2027 après cession · écart G − résultat du bilan = valeur nette cédée', 200_000, cr?.controle?.ecart);
    R.montant('2027 après cession · écart entièrement expliqué (résiduel nul)', 0, cr?.controle?.residuel);
    const notes = await c.lire('Notes SMT 2027 après cession', `/etats-financiers-syscohada/smt/notes?exerciceId=${n1}`);
    const sortie = (notes?.note1?.sortiesDeLExercice ?? [])[0];
    R.egal('2027 après cession · note 1 · le bien sorti figure à part, prix de cession', ['Étagères et comptoir', 250_000], [sortie?.designation ?? null, sortie?.prixCession ?? null]);
    R.montant('2027 après cession · note 1 · total des biens détenus', 1_200_000, notes?.note1?.total);
    const jt = await c.lire('Journal de trésorerie SMT 2027 après cession', `/etats-financiers-syscohada/smt/journal-tresorerie?exerciceId=${n1}`);
    const jca = (jt?.journaux ?? []).find((j) => j.numero === CAISSE);
    R.montant('2027 après cession · note 4 · caisse · colonne Matériel et Mobilier', 250_000, sommesVentilation(jca)['RECETTE:materielMobilier']);
    R.montant('2027 après cession · note 4 · caisse · solde à reporter', 2_050_000, jca?.soldeAReporter);
  });

  await etape(R, 'Clôture 2027', () => cloturer(c, '2027'));
  await etape(R, '2028 · à-nouveaux de la clôture de 2027', async () => {
    await rechargerExercices(c);
    const n2 = c.exercices.get('2028')?.id;
    if (!n2) return R.note('2028 absent après la clôture de 2027');
    const b = await balance(c, n2);
    R.montant('2028 · à-nouveau banque', 1_600_000, solde(b, BQ));
    R.montant('2028 · à-nouveau caisse', 2_050_000, solde(b, CAISSE));
    R.montant('2028 · à-nouveau résultat 2027 au 13', -450_000, solde(b, '13'));
    R.montant('2028 · à-nouveau capital personnel', -3_900_000, solde(b, '103'));
  });
}

// =============================================================================
// 3. LA BASCULE · une option prise au Système normal, le dossier passé au SMT
// =============================================================================

async function scenarioBascule(registre) {
  registre.scenario = 'SMT bascule';
  const R = registre;
  const c = await nouveauDossier(R, 'Passe smt · Atelier bascule SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'smt-bascule', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const ctx = {};

  await etape(R, 'Système normal · bien repris et option du dégressif, sans écriture', async () => {
    await c.geste('Forme · SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    // Bien REPRIS (acquis le 20/12/2025, avant l'ouverture) · la fiche naît
    // SANS écriture (audit final F32), mis en service le 05/01/2026, donc dans
    // le régime du dégressif de la loi n° 23/053 (art. 153).
    ctx.photocopieur = await c.geste('Photocopieur repris', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24410000'), designation: 'Photocopieur', dateAcquisition: '2025-12-20', dateMiseEnService: '2026-01-05',
      valeurOrigine: 2_000_000, dureeAmortissementAns: 5, modeAmortissement: 'LINEAIRE', repris: true, exerciceId: n,
    });
    R.egal('Bascule · le bien repris naît sans écriture d’acquisition', null, ctx.photocopieur?.ecritureAcquisitionId ?? null);
    if (ctx.photocopieur) {
      // Art. 31 · « machines de bureau », bien neuf, durée fiscale de 5 ans.
      const opt = await c.geste('Option du dégressif (Système normal)', 'POST', `/immobilisations/${ctx.photocopieur.id}/option-degressif`, {
        categorie: 'MACHINES_DE_BUREAU', bienNeuf: true, dureeFiscaleAns: 5,
      });
      R.egal('Bascule · option du dégressif admise au Système normal', true, Boolean(opt));
    }
    const ecr = (await c.lire('Écritures du dossier', `/ecritures?exerciceId=${n}`)) ?? [];
    R.montant('Bascule · aucune écriture avant le passage au SMT', 0, Array.isArray(ecr) ? ecr.length : (ecr.total ?? ecr.ecritures?.length ?? NaN));
  });

  await etape(R, 'Passage au Système minimal de trésorerie', async () => {
    const p = await c.geste('Système · SMT', 'PATCH', '/dossier/systeme-syscohada', { systemeComptableSyscohada: 'MINIMAL_TRESORERIE' });
    R.egal('Bascule · le dossier tient désormais le SMT', 'MINIMAL_TRESORERIE', p?.systemeComptableSyscohada ?? null);
  });

  await etape(R, 'Au SMT · ce qui crée est refusé, ce qui solde reste ouvert', async () => {
    const im = ctx.photocopieur;
    if (!im) return R.note('Bien absent · refus non éprouvés');
    const corpsDerog = { exerciceId: n, journalId: c.od.id };
    // Un NOUVEAU dérogatoire, même sur une option antérieure (degressif.service.ts, `passer`).
    await refusSmt(c, R, 'Bascule · nouvel amortissement dérogatoire 2026', 'POST', `/immobilisations/${im.id}/derogatoire`, corpsDerog);
    // Le SOLDE du dérogatoire (`solder`) n'est pas fermé par le SMT · ici il
    // n'y a rien à reprendre, le refus doit le dire, pas invoquer le SMT.
    await porteOuverte(c, R, 'Bascule · reprise du solde du dérogatoire', 'POST', `/immobilisations/${im.id}/derogatoire/solde`, corpsDerog);
    const dep = { exerciceId: n, journalId: c.od.id, montant: 100_000, compteDepreciationId: compte(c, '29440000'), indice: 'Bascule · test du SMT' };
    await refusSmt(c, R, 'Bascule · dotation à une dépréciation', 'POST', `/immobilisations/${im.id}/depreciation`, { ...dep, sens: 'DOTATION', compteContrepartieId: compte(c, '69140000') });
    // La REPRISE d'une dépréciation n'est refusée qu'à la dotation (« la
    // reprise d'une dépréciation posée avant le passage au SMT solde l'historique »).
    await porteOuverte(c, R, 'Bascule · reprise d’une dépréciation', 'POST', `/immobilisations/${im.id}/depreciation`, { ...dep, sens: 'REPRISE', compteContrepartieId: compte(c, '79140000') });
    // Un bien aux unités d'œuvre (Titre X ch. 1 § 1, « linéaire ») · repris
    // pour qu'aucune écriture ne naisse même si le refus manquait.
    await refusSmt(c, R, 'Bascule · bien amorti aux unités d’œuvre', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24410000'), designation: 'Presse à imprimer', dateAcquisition: '2025-12-20', dateMiseEnService: '2026-01-05',
      valeurOrigine: 3_000_000, dureeAmortissementAns: 5, modeAmortissement: 'UNITES_DOEUVRE', unitesOeuvrePrevues: 500_000, uniteOeuvreLibelle: 'pages imprimées',
      repris: true, exerciceId: n,
    });
    // Une NOUVELLE option du dégressif, sur un second bien repris.
    const second = await c.geste('Second bien repris (linéaire)', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24410000'), designation: 'Relieuse', dateAcquisition: '2025-12-20', dateMiseEnService: '2026-01-05',
      valeurOrigine: 1_000_000, dureeAmortissementAns: 5, modeAmortissement: 'LINEAIRE', repris: true, exerciceId: n,
    });
    if (second) {
      await refusSmt(c, R, 'Bascule · nouvelle option du dégressif', 'POST', `/immobilisations/${second.id}/option-degressif`, {
        categorie: 'MACHINES_DE_BUREAU', bienNeuf: true, dureeFiscaleAns: 5,
      });
    }
    // La dotation LINÉAIRE reste ouverte · 2 000 000 / 5 = 400 000 (entrée en
    // janvier, prorata ou non le chiffre est le même).
    const d = await c.geste('Dotation linéaire 2026 du photocopieur', 'POST', `/immobilisations/${im.id}/dotation`, { exerciceId: n, journalId: c.od.id });
    R.montant('Bascule · dotation linéaire 2026', 400_000, d?.montant ?? d?.dotation?.montant ?? null);
  });
}
