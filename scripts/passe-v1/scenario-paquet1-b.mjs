/**
 * SCÉNARIO PAQUET 1 · LIGNE B (tiers, lettrage, trésorerie), docs/plan-version-1.md § 7.
 *
 * Chaque point est joué sur un dossier neuf, par l'API du serveur compilé,
 * À TRAVERS UNE CLÔTURE quand il la touche (N clôturé, N+1 lu). Chaque
 * contrôle exprime le comportement JUSTE · contre `main` (avant correction),
 * il sort en écart ; après correction, il concorde.
 *
 * PAQUET1_B_POINTS=B10,B1 ne joue que les points nommés (tous par défaut).
 *
 * Les montants attendus sont calculés à la main en commentaire, à côté de
 * leur contrôle ; aucun numéro de compte n'est deviné (`compte()` lève si le
 * plan semé ne l'a pas · numéros relus dans `compte-seed.ts` et
 * `compte-seed-syscohada.ts`).
 */
import {
  balance, cloturer, compte, ecriture, etape, ligneDe, lettrer, nouveauDossier,
  rechargerComptes, rechargerExercices, solde, tiers, validerJusqua,
} from './lib.mjs';

const BQ = '52110000';
const POINTS = (process.env.PAQUET1_B_POINTS ?? 'B10,B1,B2,B9,B3,B7,B6,B5,B4,B8,M1,M1B,M2,MIN2,MIN3,MIN4,MIN5,MIN6,VOISIN').split(',').map((s) => s.trim()).filter(Boolean);

/** Les anomalies d'un contrôle du rapport de l'exercice. */
async function anomaliesDe(c, exerciceId, code) {
  const r = await c.lire(`Contrôles (${code})`, `/controles?exerciceId=${exerciceId}`);
  return (r?.anomalies ?? []).filter((a) => a.code === code);
}

/** Une sous-commission signable · un inventoriant et un témoin. */
async function sousCommission(c, campagneId, nom) {
  const sc = await c.geste(`Sous-commission ${nom}`, 'POST', `/inventaire/${campagneId}/sous-commissions`, { nom });
  if (!sc) return null;
  await c.geste('Membre inventoriant', 'POST', `/inventaire/sous-commissions/${sc.id}/membres`, { nom: 'MUKENDI', fonction: 'Caissière', role: 'INVENTORIANT' });
  await c.geste('Membre témoin', 'POST', `/inventaire/sous-commissions/${sc.id}/membres`, { nom: 'ILUNGA', fonction: 'Trésorier', role: 'TEMOIN' });
  return sc;
}

/** Une association (SYCEBNL) avec 1 300 000 en caisse au 31/12/2026. */
async function associationAvecCaisse(R, nom, cle) {
  const c = await nouveauDossier(R, nom, { referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle, exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ca = c.journal('CA') ?? c.od;
  await ecriture(c, 'Dotation reçue', n, '2026-01-05', 'Dotation initiale', [[BQ, 5_000_000, 0], ['10110000', 0, 5_000_000]], { journal: bq, reference: 'DOT-1' });
  await ecriture(c, 'Approvisionnement de la caisse', n, '2026-02-01', 'Retrait pour la caisse', [['57100000', 1_300_000, 0], [BQ, 0, 1_300_000]], { journal: ca, reference: 'CHQ-1' });
  await validerJusqua(c, n, '2026-12-31');
  return { c, n, bq, ca };
}

// ==============================================================================
// B10 · UNE CAMPAGNE QUI NE PORTE QUE LA CAISSE SE CLÔT
// ==============================================================================
//
// CPCC, étape 2 et § VI (« la caisse SIÈGE, [...] la caisse AGENCE, [...] la
// caisse DE SECOURS » · un PV par caisse) ; CLAUDE.md, « Procès-verbal de
// comptage par caisse ». Une association sans stock ni bien compte sa seule
// caisse · PV de caisse établi (1 300 000 comptés, 1 300 000 au livre-journal,
// écart nul), PV de campagne signé · rien ne reste à arbitrer, la campagne se
// clôt. Les refus voulus demeurent · un écart de caisse non arbitré, une caisse
// non comptée, une campagne où rien n'a été compté.

async function pointB10(R) {
  R.scenario = 'paquet1-b · B10';
  const { c, n } = await associationAvecCaisse(R, 'Paquet 1 B10 · Amis de Kindu', 'p1b-b10');
  const CAISSE = '57100000';

  await etape(R, 'B10 · campagne de caisse seule, écart nul', async () => {
    const camp = await c.geste('Campagne de caisse seule', 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-31', libelle: 'Comptage de la caisse 2026' });
    if (!camp) return;
    const sc = await sousCommission(c, camp.id, 'Caisse du siège');
    if (!sc) return;
    const apercu = await c.lire('Aperçu du PV de caisse', `/inventaire/${camp.id}/pv-caisse/apercu?compteId=${compte(c, CAISSE)}&dateComptage=2026-12-31`);
    R.montant('B10 · solde du livre-journal au 31/12/2026', 1_300_000, apercu?.soldeComptable);
    const pv = await c.geste('PV de comptage de la caisse', 'POST', `/inventaire/${camp.id}/pv-caisse`, {
      compteId: compte(c, CAISSE), sousCommissionId: sc.id, dateComptage: '2026-12-31', heureComptage: '17:00',
      modeComparaison: apercu?.modeComparaison ?? 'FRANCS', especesComptees: 1_300_000,
      attestationEtablieLe: '2026-12-31', attestationPar: 'ILUNGA, trésorier',
    });
    R.montant('B10 · écart du PV (1 300 000 − 1 300 000)', 0, pv?.ecart);
    await c.geste('PV de la campagne', 'POST', `/inventaire/${camp.id}/proces-verbal`, { dateEtablissement: '2027-01-05' });
    const cl = await c.req('POST', `/inventaire/${camp.id}/clore`, {});
    if (cl.statut >= 400) R.note(`B10 · clôture refusée (${cl.statut}) · ${JSON.stringify(cl.corps).slice(0, 300)}`);
    R.egal('B10 · la campagne de caisse seule se clôt (PV de caisse et PV de campagne faits)', 'CLOTUREE', cl.statut < 400 ? cl.corps?.statut : `refus ${cl.statut}`);
  });

  // Les refus voulus · un manquant de caisse que personne n'a arbitré ne se
  // perd pas dans une campagne close (CPCC, étape 5).
  await etape(R, 'B10 · campagne de caisse seule avec un manquant non arbitré · refusée, issue nommée', async () => {
    const camp = await c.geste('Seconde campagne de caisse', 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-31', libelle: 'Recomptage de la caisse' });
    if (!camp) return;
    const sc = await sousCommission(c, camp.id, 'Caisse du siège (recomptage)');
    if (!sc) return;
    const pv = await c.geste('PV de comptage · 1 295 000 comptés', 'POST', `/inventaire/${camp.id}/pv-caisse`, {
      compteId: compte(c, CAISSE), sousCommissionId: sc.id, dateComptage: '2026-12-31', modeComparaison: 'FRANCS', especesComptees: 1_295_000,
    });
    R.montant('B10 · écart du PV (1 295 000 − 1 300 000)', -5_000, pv?.ecart);
    const cl = await c.req('POST', `/inventaire/${camp.id}/clore`, {});
    R.egal('B10 · campagne au manquant de caisse non arbitré · clôture refusée', true, cl.statut >= 400);
    R.egal('B10 · le refus nomme l’arbitrage par la fiche de la caisse', true, /fiche/i.test(JSON.stringify(cl.corps ?? '')) && /arbitr/i.test(JSON.stringify(cl.corps ?? '')));
  });

  await etape(R, 'B10 · campagne où rien n’a été compté · refusée', async () => {
    const camp = await c.geste('Campagne vide', 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-31', libelle: 'Campagne sans comptage' });
    if (!camp) return;
    const cl = await c.req('POST', `/inventaire/${camp.id}/clore`, {});
    R.egal('B10 · campagne sans aucun comptage · clôture refusée', true, cl.statut >= 400);
  });
}

// ==============================================================================
// B1 · LE REDRESSEMENT DU MANQUANT DE CAISSE QUE L'INVENTAIRE RETIENT
// ==============================================================================
//
// L'écart de la caisse (995 000 comptés, 1 000 000 au livre) arbitré « à
// redresser », responsable nommé ; le cabinet passe D 658 / C 571 et le
// rattache à l'écart (EcartInventaire.ecritureId, la LIAISON). CHARGE_SANS_TIERS
// ne le vise pas · la sous-commission a nommé qui en répond. Une dépense de
// caisse ordinaire sans tiers (fournitures, D 6052 / C 571) reste signalée.

async function pointB1(R) {
  R.scenario = 'paquet1-b · B1';
  const { c, n, ca } = await associationAvecCaisse(R, 'Paquet 1 B1 · Lumière de Bukavu', 'p1b-b1');
  const CAISSE = '57100000';
  await ecriture(c, 'Fournitures payées en caisse', n, '2026-03-10', 'Fournitures de bureau payées comptant', [['60520000', 300_000, 0], [CAISSE, 0, 300_000]], { journal: ca, reference: 'BC-7' });
  await validerJusqua(c, n, '2026-12-31');
  // Caisse au 31/12 · 1 300 000 − 300 000 = 1 000 000 ; 995 000 comptés.

  await etape(R, 'B1 · inventaire de la caisse, manquant arbitré et redressé', async () => {
    const camp = await c.geste('Campagne d’inventaire', 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-31', libelle: 'Inventaire 2026' });
    if (!camp) return;
    const sc = await sousCommission(c, camp.id, 'Caisse du siège');
    if (!sc) return;
    const fiche = await c.geste('Fiche · caisse', 'POST', `/inventaire/${camp.id}/fiches`, { compteId: compte(c, CAISSE), sousCommissionId: sc.id, designation: 'Espèces en caisse' });
    if (fiche) await c.geste('Comptage · espèces', 'PATCH', `/inventaire/fiches/${fiche.id}`, { valeurInventaire: 995_000, referencePiece: 'PV-CAISSE-2026' });
    await c.geste('PV de la campagne', 'POST', `/inventaire/${camp.id}/proces-verbal`, { dateEtablissement: '2026-12-31' });
    const rap = await c.geste('Rapprochement', 'POST', `/inventaire/${camp.id}/rapprocher`);
    const ecart = (rap?.ecarts ?? []).find((e) => e.compte?.numero === CAISSE);
    R.montant('B1 · écart de la caisse (995 000 − 1 000 000)', -5_000, ecart?.ecart);
    if (!ecart) return;
    await c.geste('Arbitrage · à redresser', 'PATCH', `/inventaire/ecarts/${ecart.id}`, {
      decision: 'A_REDRESSER', responsable: 'MUKENDI, caissière', explication: 'Manquant constaté au comptage, non justifié',
    });
    const e = await ecriture(c, 'Redressement du manquant de caisse', n, '2026-12-31', 'Manquant de caisse constaté à l’inventaire',
      [['65800000', 5_000, 0], [CAISSE, 0, 5_000]], { journal: c.od, reference: 'PV-CAISSE-2026' });
    await validerJusqua(c, n, '2026-12-31');
    const rat = e ? await c.geste('Rattachement du redressement', 'POST', `/inventaire/ecarts/${ecart.id}/ecriture`, { ecritureId: e.id }) : null;
    R.egal('B1 · redressement rattaché à l’écart (liaison posée)', true, Boolean(rat?.rattache));
  });

  await etape(R, 'B1 · CHARGE_SANS_TIERS · le redressement retenu n’y est pas, la dépense ordinaire y reste', async () => {
    const charges = (await anomaliesDe(c, n, 'CHARGE_SANS_TIERS')).flatMap((a) => a.occurrences ?? []);
    R.egal('B1 · le redressement du manquant de caisse retenu par l’inventaire n’est pas signalé', false, charges.some((o) => /Manquant de caisse/.test(`${o.detail}`)));
    R.egal('B1 · la dépense de caisse sans tiers reste signalée (le contrôle n’est pas aveuglé)', true, charges.some((o) => /Fournitures de bureau/.test(`${o.detail}`)));
  });
}

// ==============================================================================
// B2 · LES INTÉRÊTS D'EMPRUNT PRÉLEVÉS PAR LA BANQUE (6712 CONTRE 521)
// ==============================================================================
//
// Fiche du compte 67 des DEUX plans (AUDCIF Titre VII ; SYCEBNL Partie 2 ch. 3) ·
// « Le compte 67 (sauf 679) est débité des frais dus [...] par le crédit des
// comptes de tiers concernés OU DES COMPTES DE TRÉSORERIE » ; éléments de
// contrôle · « relevés de banque ; décomptes d'intérêt ». 6712 « Emprunts auprès
// des établissements de crédit » et 52 « Banques » aux deux semis. Le cas
// reste un signal (le relevé et le décompte le justifient), NOMMÉ comme le cas
// admis ; un loyer payé par la banque, ou une écriture qui mêle des intérêts et
// une autre charge, reste un vrai oubli de tiers.

async function pointB2(R) {
  for (const [ref, options, cle] of [
    ['SYSCOHADA', { referentiel: 'SYSCOHADA', systeme: 'NORMAL' }, 'p1b-b2s'],
    ['SYCEBNL', { referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' }, 'p1b-b2e'],
  ]) {
    R.scenario = `paquet1-b · B2 ${ref}`;
    const c = await nouveauDossier(R, `Paquet 1 B2 · ${ref} Tanganyika`, { ...options, cle, exercice: ['2026-01-01', '2026-12-31'] });
    const n = c.exercices.get('2026').id;
    const bq = c.journal('BQ') ?? c.od;
    await etape(R, `B2 ${ref} · intérêts, loyer et écriture mêlée payés par la banque`, async () => {
      await ecriture(c, 'Dotation ou capital', n, '2026-01-05', 'Apport initial', [[BQ, 20_000_000, 0], ['10110000', 0, 20_000_000]], { journal: bq, reference: 'APP-1' });
      await ecriture(c, 'Intérêts d’emprunt prélevés', n, '2026-06-30', 'Intérêts emprunt BCDC S1', [['67120000', 300_000, 0], [BQ, 0, 300_000]], { journal: bq, reference: 'REL-06' });
      await ecriture(c, 'Loyer prélevé', n, '2026-07-02', 'Loyer bureau juillet', [['62210000', 400_000, 0], [BQ, 0, 400_000]], { journal: bq, reference: 'REL-07' });
      await ecriture(c, 'Intérêts et loyer mêlés', n, '2026-08-02', 'Intérêts et loyer août', [['67120000', 100_000, 0], ['62210000', 400_000, 0], [BQ, 0, 500_000]], { journal: bq, reference: 'REL-08' });
      await validerJusqua(c, n, '2026-12-31');
    });
    await etape(R, `B2 ${ref} · CHARGE_SANS_TIERS nomme le cas admis par la fiche du compte 67`, async () => {
      const anomalies = await anomaliesDe(c, n, 'CHARGE_SANS_TIERS');
      const occ = anomalies.flatMap((a) => a.occurrences ?? []);
      const interets = occ.find((o) => /Intérêts emprunt BCDC/.test(o.detail ?? ''));
      const loyer = occ.find((o) => /Loyer bureau juillet/.test(o.detail ?? ''));
      const meles = occ.find((o) => /Intérêts et loyer août/.test(o.detail ?? ''));
      R.egal(`B2 ${ref} · les intérêts prélevés restent un signal`, true, Boolean(interets));
      R.egal(`B2 ${ref} · les intérêts prélevés sont nommés comme le cas admis par la fiche du compte 67`, true, /fiche du compte 67/.test(interets?.detail ?? ''));
      R.egal(`B2 ${ref} · le loyer prélevé reste un oubli de tiers, non nommé comme cas admis`, [true, false], [Boolean(loyer), /fiche du compte 67/.test(loyer?.detail ?? '')]);
      R.egal(`B2 ${ref} · l’écriture qui mêle intérêts et loyer reste un oubli de tiers`, [true, false], [Boolean(meles), /fiche du compte 67/.test(meles?.detail ?? '')]);
      R.egal(`B2 ${ref} · avertissement maintenu tant qu’un vrai oubli de tiers existe`, 'AVERTISSEMENT', anomalies[0]?.gravite ?? null);
    });
  }
}

// ==============================================================================
// B9 · LES PROPOSITIONS DU RAPPROCHEMENT SANS FENÊTRE DE DATES
// ==============================================================================
//
// `fenetreJours` est déclaré facultatif · sans lui, la fenêtre par défaut de
// l'écran (15 jours, convention d'OmegaX, `FENETRE_JOURS_DEFAUT`) ; un
// paramètre illisible reste refusé en 400 nommé.

async function pointB9(R) {
  R.scenario = 'paquet1-b · B9';
  const c = await nouveauDossier(R, 'Paquet 1 B9 · Comptoir de Matadi SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1b-b9', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  await ecriture(c, 'Capital libéré', n, '2026-01-05', 'Apport des associés', [[BQ, 10_000_000, 0], ['10130000', 0, 10_000_000]], { journal: bq, reference: 'APP-1' });
  await validerJusqua(c, n, '2026-12-31');
  await etape(R, 'B9 · rapprochement et propositions', async () => {
    const r = await c.geste('Rapprochement · ouverture', 'POST', '/rapprochements', { compteId: compte(c, BQ), dateReleve: '2026-01-31', soldeReleve: 10_000_000 });
    if (!r) return;
    await c.geste('Solde de départ déclaré', 'PATCH', `/rapprochements/${r.id}/depart`, { soldeDepart: 0, dateDepart: '2026-01-01' });
    const csv = ['Date;Libellé;Débit;Crédit', '06/01/2026;Versement apport;;10000000'].join('\n');
    await c.geste('Import du relevé', 'POST', `/rapprochements/${r.id}/releve`, { nomFichier: 'releve-janvier.csv', contenuBase64: Buffer.from(csv, 'utf8').toString('base64') });
    const sans = await c.req('GET', `/rapprochements/${r.id}/propositions`);
    if (sans.statut >= 400) R.note(`B9 · sans fenêtre · ${sans.statut} · ${JSON.stringify(sans.corps).slice(0, 200)}`);
    R.egal('B9 · propositions sans fenêtre de dates · servies (200)', 200, sans.statut);
    R.montant('B9 · sans fenêtre · la fenêtre par défaut de l’écran (15 jours) est appliquée', 15, sans.corps?.fenetreJours);
    R.montant('B9 · sans fenêtre · la ligne du relevé trouve son écriture', 1, (sans.corps?.propositions ?? []).length);
    const quinze = await c.req('GET', `/rapprochements/${r.id}/propositions?fenetreJours=15`);
    R.egal('B9 · propositions à 15 jours · servies, identiques', [200, 1], [quinze.statut, (quinze.corps?.propositions ?? []).length]);
    const illisible = await c.req('GET', `/rapprochements/${r.id}/propositions?fenetreJours=abc`);
    R.egal('B9 · fenêtre illisible · refus 400', 400, illisible.statut);
    R.egal('B9 · le refus nomme la fenêtre', true, /fen[eê]tre/i.test(JSON.stringify(illisible.corps ?? '')));
  });
}

// ==============================================================================
// B3 · BALANCE ÂGÉE · UNE LIGNE AU SOLDE NUL N'EST PAS EN SENS INVERSE
// ==============================================================================
//
// C3 · facture 1 000 000 le 10/03/2026 et règlement 1 000 000 le 10/10/2026,
// non lettrés · solde nul, pièces ouvertes qui se compensent, dans deux
// tranches différentes (le bloc « reste de l'exercice » et octobre). C3B · facture
// 500 000 le 15/04/2026, ouverte. Balance âgée des clients au 31/12/2026 ·
// débiteurs 500 000 (C3B), aucun solde en sens inverse, net 500 000 = solde du
// 411. C3 est dit à part (pièces non lettrées qui se compensent).

async function pointB3(R) {
  R.scenario = 'paquet1-b · B3';
  const c = await nouveauDossier(R, 'Paquet 1 B3 · Quincaillerie du Lac SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1b-b3', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const c3 = await tiers(c, 'CLIENT', 'C3', 'Nul et Compensé');
  const c3b = await tiers(c, 'CLIENT', 'C3B', 'Débiteur Ordinaire');
  if (!c3 || !c3b) return R.note('B3 · tiers absents');
  await ecriture(c, 'Facture C3', n, '2026-03-10', 'Facture FV-B3-1', [[c3.numero, 1_000_000, 0], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-B3-1' });
  await ecriture(c, 'Règlement C3', n, '2026-10-10', 'Règlement FV-B3-1', [[BQ, 1_000_000, 0], [c3.numero, 0, 1_000_000]], { journal: bq, reference: 'VIR-B3-1' });
  await ecriture(c, 'Facture C3B', n, '2026-04-15', 'Facture FV-B3-2', [[c3b.numero, 500_000, 0], ['70110000', 0, 500_000]], { journal: ven, reference: 'FV-B3-2' });
  await validerJusqua(c, n, '2026-12-31');
  await etape(R, 'B3 · balance âgée des clients au 31/12/2026', async () => {
    const ba = await c.lire('Balance âgée', `/ecritures/balance-agee?exerciceId=${n}&dateReference=2026-12-31&type=CLIENTS_41`);
    const nom = (l) => `${l.libelle}`;
    R.egal('B3 · la ligne au solde nul n’est pas rendue « en sens inverse »', false, (ba?.sensInverse ?? []).some((l) => nom(l).includes('C3 -')));
    R.montant('B3 · total des soldes en sens inverse', 0, ba?.totaux?.sensInverse);
    R.montant('B3 · débiteurs ventilés (C3B)', 500_000, ba?.totaux?.debiteurs);
    R.montant('B3 · net = solde du 411', 500_000, ba?.totaux?.net);
    R.egal('B3 · la ligne au solde nul est dite à part (pièces ouvertes qui se compensent)', true, (ba?.soldesNuls ?? []).some((l) => nom(l).includes('C3 -')));
    const b = await balance(c, n);
    R.montant('B3 · solde du 411 à la balance', 500_000, solde(b, '411'));
  });
}

// ==============================================================================
// B7 · UN GROUPE D'À-NOUVEAUX LETTRÉ À LA MAIN S'IMPUTE PAR LA LOI
// ==============================================================================
//
// Code civil, Livre III, art. 154, lu dans la compétence code-civil-livre-iii-rdc
// (« sinon sur la dette échue, quoique moins onéreuse que celles qui ne le
// sont point. Si les dettes sont d'égale nature, l'imputation se fait sur la
// plus ancienne: toutes choses égales, elle se fait proportionnellement »).
// Deux factures de 2026, reportées au DÉTAIL en 2027,
// réglées en partie en 2027 et lettrées à la main avec leurs lignes
// d'à-nouveau (aucun groupe de 2026 reconduit) · la plus ANCIENNE pièce est
// éteinte la première. Sur `main`, les deux lignes d'à-nouveau portent la date
// du 1er janvier 2027 et s'éteignent au prorata.
//
// C7 · F1 du 01/03/2026 (échéance 31/03/2026) 1 000 000, F2 du 01/09/2026
// (échéance 30/09/2026) 1 000 000, libellés distincts ; règlement de 1 000 000
// le 15/02/2027. Les deux sont échues au 15/02/2027 · F1, la plus ancienne,
// est éteinte, F2 reste due en entier. Relance au 15/03/2027 · dû 1 000 000,
// échéance la plus ancienne 30/09/2026, retard 166 jours (31 + 30 + 31 + 31 +
// 28 + 15), une seule ligne, F2, de 1 000 000.
// C7B · même cas, MÊME libellé et même montant (600 000 le 01/02/2026,
// échéance 28/02/2026 ; 600 000 le 01/08/2026, échéance 31/08/2026),
// règlement de 600 000 le 20/02/2027 · seule l'échéance distingue les deux
// reports · reste la facture d'août, échéance 31/08/2026, retard 196 jours
// (30 + 31 + 30 + 31 + 31 + 28 + 15).

async function pointB7(R) {
  R.scenario = 'paquet1-b · B7';
  const c = await nouveauDossier(R, 'Paquet 1 B7 · Comptoir de la Gombe SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1b-b7', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const c7 = await tiers(c, 'CLIENT', 'C7', 'Ordre Légal');
  const c7b = await tiers(c, 'CLIENT', 'C7B', 'Même Libellé');
  if (!c7 || !c7b) return R.note('B7 · tiers absents');
  await ecriture(c, 'Facture F1 de C7', n, '2026-03-01', 'Facture FV-B7-1', [[c7.numero, 1_000_000, 0, { dateEcheance: '2026-03-31' }], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-B7-1' });
  await ecriture(c, 'Facture F2 de C7', n, '2026-09-01', 'Facture FV-B7-2', [[c7.numero, 1_000_000, 0, { dateEcheance: '2026-09-30' }], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-B7-2' });
  await ecriture(c, 'Facture de février de C7B', n, '2026-02-01', 'Vente marchandises', [[c7b.numero, 600_000, 0, { dateEcheance: '2026-02-28' }], ['70110000', 0, 600_000]], { journal: ven, reference: 'FV-B7-3' });
  await ecriture(c, 'Facture d’août de C7B', n, '2026-08-01', 'Vente marchandises', [[c7b.numero, 600_000, 0, { dateEcheance: '2026-08-31' }], ['70110000', 0, 600_000]], { journal: ven, reference: 'FV-B7-4' });
  await validerJusqua(c, n, '2026-12-31');
  const clos = await etape(R, 'B7 · clôture de 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('B7 · 2027 non joué · la clôture de 2026 n’a pas abouti ou l’exercice 2027 manque');
  await ecriture(c, 'Règlement de C7 en 2027', n1, '2027-02-15', 'Règlement C7', [[BQ, 1_000_000, 0], [c7.numero, 0, 1_000_000]], { journal: bq, reference: 'VIR-B7-1' });
  await ecriture(c, 'Règlement de C7B en 2027', n1, '2027-02-20', 'Règlement C7B', [[BQ, 600_000, 0], [c7b.numero, 0, 600_000]], { journal: bq, reference: 'VIR-B7-2' });
  await validerJusqua(c, n1, '2027-02-28');
  await etape(R, 'B7 · lettrage manuel des à-nouveaux avec le règlement de 2027', async () => {
    for (const t of [c7, c7b]) {
      const lu = await c.lire(`Lignes ouvertes de ${t.numero}`, `/comptes/${t.compteId}/lettrage?nonLettreesSeulement=true`);
      // Les lignes de 2027 seules · les factures de 2026 restent au compte, ouvertes, dans l’exercice clos.
      const lignes = (lu?.lignes ?? []).filter((l) => String(l.date).slice(0, 4) === '2027');
      R.egal(`B7 · ${t.numero} · deux lignes d’à-nouveau et un règlement ouverts`, [2, 1], [lignes.filter((l) => Number(l.debit) > 0).length, lignes.filter((l) => Number(l.credit) > 0).length]);
      await lettrer(c, t.numero, lignes.map((l) => l.id), true);
    }
  });
  await etape(R, 'B7 · relance au 15/03/2027', async () => {
    const pos = (await c.lire('Positions à relancer au 15/03/2027', `/relances?exerciceId=${n1}&type=RAPPEL&dateReference=2027-03-15`)) ?? [];
    const p7 = pos.find((x) => x.compteId === c7.compteId);
    R.montant('B7 · C7 · dû', 1_000_000, p7?.montantDu);
    R.egal('B7 · C7 · échéance la plus ancienne et retard · F1, la plus ancienne, est éteinte la première (art. 154)', ['2026-09-30', 166], [p7?.echeancePlusAncienne, p7?.retardMaxJours]);
    R.egal('B7 · C7 · une seule ligne réclamée, F2, de 1 000 000', [[1_000_000]], [(p7?.lignes ?? []).map((l) => Number(l.montant))]);
    const p7b = pos.find((x) => x.compteId === c7b.compteId);
    R.montant('B7 · C7B · dû', 600_000, p7b?.montantDu);
    R.egal('B7 · C7B · même libellé, même montant · l’échéance distingue les reports, la facture de février est éteinte', ['2026-08-31', 196], [p7b?.echeancePlusAncienne, p7b?.retardMaxJours]);
    R.egal('B7 · C7B · une seule ligne réclamée, de 600 000', [[600_000]], [(p7b?.lignes ?? []).map((l) => Number(l.montant))]);
    const b = await balance(c, n1);
    R.montant('B7 · solde de C7 à la balance de 2027', 1_000_000, solde(b, c7.numero));
    R.montant('B7 · solde de C7B à la balance de 2027', 600_000, solde(b, c7b.numero));
  });
}

// ==============================================================================
// B6 · UNE FACTURE SOLDÉE DANS SA DEVISE NE SE RÉCLAME PLUS
// ==============================================================================
//
// AUDCIF art. 55 (« À la date de règlement des créances et dettes, les pertes
// et gains de change à cette date sont constatés par rapport à leur coût
// historique ») ; ligne A6 · le groupe soldé dans sa devise et non en francs
// porte un écart réalisé que le cabinet passe au lettrage. Le client ne doit
// plus rien de cette facture · la relance ne la réclame pas, ne déduit pas le
// règlement d'une autre, et NOMME l'écart à passer.
//
// C6 · facture de 1 000 USD au cours de 2 800 (2 800 000) le 01/03/2026,
// échéance 31/03/2026, reportée au détail en 2027 ; règlement de 1 000 USD au
// cours de 2 900 (2 900 000) le 10/02/2027, lettré en partiel avec son
// à-nouveau · gain réalisé de 100 000 non passé. Facture en francs de 500 000
// le 01/10/2026, échéance 31/10/2026. Relance au 15/03/2027 · dû 500 000, une
// seule ligne, et l'écart (gain de 100 000) nommé. Sur `main` · dû 400 000
// (2 800 000 − 2 900 000 + 500 000), trois lignes.
// C6B · même facture en USD réglée au cours de 2 700 (2 700 000) · perte
// réalisée de 100 000 non passée ; facture en francs de 300 000 · dû 300 000,
// et non 400 000 (la perte réclamée au client).

async function pointB6(R) {
  R.scenario = 'paquet1-b · B6';
  const c = await nouveauDossier(R, 'Paquet 1 B6 · Négoce du Pool SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1b-b6', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const devises = (await c.lire('Devises', '/devises')) ?? [];
  const usd = devises.find((d) => d.code === 'USD') ?? (await c.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
  if (!usd?.id) return R.note('B6 · devise USD absente');
  for (const [date, cours] of [['2026-03-01', 2_800], ['2026-12-31', 2_800], ['2027-02-10', 2_900]]) {
    await c.geste(`Cours USD du ${date}`, 'POST', `/devises/${usd.id}/cours`, { date, cours, source: 'Banque centrale du Congo (paquet 1, B6)' });
  }
  const c6 = await tiers(c, 'CLIENT', 'C6', 'Gain Non Passé');
  const c6b = await tiers(c, 'CLIENT', 'C6B', 'Perte Non Passée');
  if (!c6 || !c6b) return R.note('B6 · tiers absents');
  const enUsd = (montant, cours) => ({ deviseId: usd.id, montantDevise: montant, coursApplique: cours });
  for (const [t, ref] of [[c6, 'FV-B6-1'], [c6b, 'FV-B6-3']]) {
    await ecriture(c, `Facture en USD de ${t.numero}`, n, '2026-03-01', `Facture ${ref}`, [[t.numero, 2_800_000, 0, { dateEcheance: '2026-03-31', ...enUsd(1_000, 2_800) }], ['70110000', 0, 2_800_000]], { journal: ven, reference: ref });
  }
  await ecriture(c, 'Facture en francs de C6', n, '2026-10-01', 'Facture FV-B6-2', [[c6.numero, 500_000, 0, { dateEcheance: '2026-10-31' }], ['70110000', 0, 500_000]], { journal: ven, reference: 'FV-B6-2' });
  await ecriture(c, 'Facture en francs de C6B', n, '2026-10-01', 'Facture FV-B6-4', [[c6b.numero, 300_000, 0, { dateEcheance: '2026-10-31' }], ['70110000', 0, 300_000]], { journal: ven, reference: 'FV-B6-4' });
  await validerJusqua(c, n, '2026-12-31');
  const clos = await etape(R, 'B6 · clôture de 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('B6 · 2027 non joué · la clôture de 2026 n’a pas abouti ou l’exercice 2027 manque');
  await ecriture(c, 'Règlement en USD de C6 (2 900)', n1, '2027-02-10', 'Règlement FV-B6-1', [[BQ, 2_900_000, 0], [c6.numero, 0, 2_900_000, enUsd(1_000, 2_900)]], { journal: bq, reference: 'VIR-B6-1' });
  await ecriture(c, 'Règlement en USD de C6B (2 700)', n1, '2027-02-10', 'Règlement FV-B6-3', [[BQ, 2_700_000, 0], [c6b.numero, 0, 2_700_000, enUsd(1_000, 2_700)]], { journal: bq, reference: 'VIR-B6-3' });
  await validerJusqua(c, n1, '2027-02-28');
  await etape(R, 'B6 · lettrage de chaque facture en USD avec son règlement', async () => {
    for (const t of [c6, c6b]) {
      const lu = await c.lire(`Lignes ouvertes de ${t.numero}`, `/comptes/${t.compteId}/lettrage?nonLettreesSeulement=true`);
      const enDevise = (lu?.lignes ?? []).filter((l) => String(l.date).slice(0, 4) === '2027' && l.devise === 'USD');
      R.egal(`B6 · ${t.numero} · à-nouveau en USD et règlement en USD ouverts`, 2, enDevise.length);
      await lettrer(c, t.numero, enDevise.map((l) => l.id), true);
    }
  });
  await etape(R, 'B6 · relance au 15/03/2027', async () => {
    const pos = (await c.lire('Positions à relancer au 15/03/2027', `/relances?exerciceId=${n1}&type=RAPPEL&dateReference=2027-03-15`)) ?? [];
    const p6 = pos.find((x) => x.compteId === c6.compteId);
    R.montant('B6 · C6 · dû (la facture en francs seule)', 500_000, p6?.montantDu);
    R.egal('B6 · C6 · une seule ligne réclamée, de 500 000', [500_000], (p6?.lignes ?? []).map((l) => Number(l.montant)));
    R.egal('B6 · C6 · l’écart réalisé non passé est nommé (gain de 100 000)', [-100_000], (p6?.ecartsChangeNonPasses ?? []).map((e) => Number(e.ecart)));
    const p6b = pos.find((x) => x.compteId === c6b.compteId);
    R.montant('B6 · C6B · dû (la facture en francs seule, jamais la perte de change)', 300_000, p6b?.montantDu);
    R.egal('B6 · C6B · une seule ligne réclamée, de 300 000', [300_000], (p6b?.lignes ?? []).map((l) => Number(l.montant)));
    R.egal('B6 · C6B · l’écart réalisé non passé est nommé (perte de 100 000)', [100_000], (p6b?.ecartsChangeNonPasses ?? []).map((e) => Number(e.ecart)));
    const b = await balance(c, n1);
    R.montant('B6 · solde de C6 à la balance de 2027 (gain non passé compris)', 400_000, solde(b, c6.numero));
    R.montant('B6 · solde de C6B à la balance de 2027 (perte non passée comprise)', 400_000, solde(b, c6b.numero));
  });
}

// ==============================================================================
// B5 · UN GROUPE QUI NE SE RÉPARTIT PAS SÛREMENT EST DIT, PARTOUT OÙ IL EST LU
// ==============================================================================
//
// Le reste d'un groupe de lettrage partiel se répartit entre ses factures
// (`reste-des-lignes-ouvertes.ts`) · quand il ne se lit pas sûrement (reste
// en devise qui ne rend pas le solde en francs, négatif sans son origine,
// part déclarée au-delà de la facture), le groupe garde la lecture ligne à
// ligne · son total reste exact, mais la répartition par échéance ne l'est
// plus. `main` ne le consignait qu'au journal du serveur · chaque état qui le
// lit doit le SERVIR (borné, avec son total) et l'écran le dire.
//
// C5 · facture de 1 000 USD à 2 800 (2 800 000) le 01/03/2026, échéance
// 31/03/2026 ; règlement de 600 USD à 3 000 (1 800 000) le 10/06/2026,
// lettré en partiel · reste au coût historique 1 120 000 (400 USD), solde du
// compte 1 000 000 · le groupe ne se répartit pas. Lu par la note par
// échéance, la balance âgée, l'échéancier et la relance d'une SARL (système
// normal), et par la NOTE 3 des deux Systèmes minimaux de trésorerie.

async function dossierAvecGroupeNonReparti(R, nom, cle, options, venteCompte) {
  const c = await nouveauDossier(R, nom, { ...options, cle, exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const devises = (await c.lire('Devises', '/devises')) ?? [];
  const usd = devises.find((d) => d.code === 'USD') ?? (await c.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
  if (!usd?.id) return { c, n, t: null };
  for (const [date, cours] of [['2026-03-01', 2_800], ['2026-06-10', 3_000]]) {
    await c.geste(`Cours USD du ${date}`, 'POST', `/devises/${usd.id}/cours`, { date, cours, source: 'Banque centrale du Congo (paquet 1, B5)' });
  }
  const t = await tiers(c, 'CLIENT', 'C5', 'Reste en Devise');
  if (!t) return { c, n, t: null };
  await ecriture(c, 'Facture en USD de C5', n, '2026-03-01', 'Facture FV-B5-1', [[t.numero, 2_800_000, 0, { dateEcheance: '2026-03-31', deviseId: usd.id, montantDevise: 1_000, coursApplique: 2_800 }], [venteCompte, 0, 2_800_000]], { journal: ven, reference: 'FV-B5-1' });
  await ecriture(c, 'Règlement partiel en USD de C5', n, '2026-06-10', 'Règlement FV-B5-1', [[BQ, 1_800_000, 0], [t.numero, 0, 1_800_000, { deviseId: usd.id, montantDevise: 600, coursApplique: 3_000 }]], { journal: bq, reference: 'VIR-B5-1' });
  await validerJusqua(c, n, '2026-12-31');
  const lu = await c.lire(`Lignes ouvertes de ${t.numero}`, `/comptes/${t.compteId}/lettrage?nonLettreesSeulement=true`);
  await lettrer(c, t.numero, (lu?.lignes ?? []).map((l) => l.id), true);
  return { c, n, t };
}

function groupeDit(R, libelle, g, numero) {
  R.egal(`${libelle} · le groupe lu ligne à ligne est servi (total, compte)`, [1, numero], [g?.total ?? null, g?.groupes?.[0]?.compte ?? null]);
}

async function pointB5(R) {
  R.scenario = 'paquet1-b · B5';
  const a = await dossierAvecGroupeNonReparti(R, 'Paquet 1 B5 · Change du Kasaï SARL', 'p1b-b5', { referentiel: 'SYSCOHADA', systeme: 'NORMAL' }, '70110000');
  if (a.t) {
    await etape(R, 'B5 · SARL · notes, balance âgée, échéancier, relance', async () => {
      const notes = await a.c.lire('Notes annexes', `/etats-financiers-syscohada/notes?exerciceId=${a.n}`);
      groupeDit(R, 'B5 · notes annexes (échéances)', notes?.groupesLusLigneALigne, a.t.numero);
      const ba = await a.c.lire('Balance âgée', `/ecritures/balance-agee?exerciceId=${a.n}&dateReference=2026-12-31&type=CLIENTS_41`);
      groupeDit(R, 'B5 · balance âgée', ba?.groupesLusLigneALigne, a.t.numero);
      R.montant('B5 · balance âgée · net = solde du client (le total reste exact)', 1_000_000, ba?.totaux?.net);
      const ech = await a.c.lire('Échéancier', `/ecritures/echeancier?exerciceId=${a.n}&dateReference=2026-12-31`);
      groupeDit(R, 'B5 · échéancier', ech?.groupesLusLigneALigne, a.t.numero);
      const pos = (await a.c.lire('Relances au 31/12/2026', `/relances?exerciceId=${a.n}&type=RAPPEL&dateReference=2026-12-31`)) ?? [];
      const p5 = pos.find((x) => x.compteId === a.t.compteId);
      groupeDit(R, 'B5 · relance', p5?.groupesLusLigneALigne, a.t.numero);
      R.montant('B5 · relance · dû (le total reste exact)', 1_000_000, p5?.montantDu);
    });
  }
  const b = await dossierAvecGroupeNonReparti(R, 'Paquet 1 B5 · Kiosque du Marché (SMT)', 'p1b-b5-smt', { referentiel: 'SYSCOHADA', systeme: 'MINIMAL_TRESORERIE' }, '70110000');
  if (b.t) {
    await etape(R, 'B5 · SMT SYSCOHADA · NOTE 3', async () => {
      const r = await b.c.lire('Notes du SMT (SYSCOHADA)', `/etats-financiers-syscohada/smt/notes?exerciceId=${b.n}`);
      groupeDit(R, 'B5 · NOTE 3 du SMT SYSCOHADA', r?.note3?.groupesLusLigneALigne, b.t.numero);
    });
  }
  const s = await dossierAvecGroupeNonReparti(R, 'Paquet 1 B5 · Amicale des Pêcheurs (SMT)', 'p1b-b5-asso', { referentiel: 'SYCEBNL', jeu: 'SYSTEME_MINIMAL_TRESORERIE' }, '70510000');
  if (s.t) {
    await etape(R, 'B5 · SMT SYCEBNL · NOTE 3', async () => {
      const r = await s.c.lire('Notes du SMT (SYCEBNL)', `/etats-financiers/smt/notes?exerciceId=${s.n}`);
      groupeDit(R, 'B5 · NOTE 3 du SMT SYCEBNL', r?.note3?.groupesLusLigneALigne, s.t.numero);
    });
  }
}

// ==============================================================================
// B8 · LE BROUILLARD N'ENTRE NI DANS LA NOTE PAR ÉCHÉANCE NI DANS LA NOTE 3
// ==============================================================================
//
// Point de TESTS (doublures qui n'honoraient pas le filtre) · vérifié quand
// même sur vraie base. AUDCIF art. 22, 2° · seul le livre-journal fait foi.
// C8 · facture de 1 000 000 le 05/11/2026, échéance 28/02/2027 (non échue au
// 31/12/2026), règlement de 300 000 le 20/11/2026, validés ; règlement de
// 200 000 le 10/12/2026 resté au BROUILLARD ; les trois lettrés en partiel.
// Au 31/12/2026, la créance du livre-journal vaut 700 000, toute à un an au
// plus et non échue, rien de non ventilé · le brouillard lu ferait 500 000 et
// 200 000 de non ventilé.

async function dossierAvecBrouillard(R, nom, cle, options, venteCompte) {
  const c = await nouveauDossier(R, nom, { ...options, cle, exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const t = await tiers(c, 'CLIENT', 'C8', 'Brouillard Écarté');
  if (!t) return { c, n, t: null };
  await ecriture(c, 'Facture de C8', n, '2026-11-05', 'Facture FV-B8-1', [[t.numero, 1_000_000, 0, { dateEcheance: '2027-02-28' }], [venteCompte, 0, 1_000_000]], { journal: ven, reference: 'FV-B8-1' });
  await ecriture(c, 'Règlement validé de C8', n, '2026-11-20', 'Règlement FV-B8-1', [[BQ, 300_000, 0], [t.numero, 0, 300_000]], { journal: bq, reference: 'VIR-B8-1' });
  await validerJusqua(c, n, '2026-11-30');
  await ecriture(c, 'Règlement au brouillard de C8', n, '2026-12-10', 'Règlement FV-B8-1 (bis)', [[BQ, 200_000, 0], [t.numero, 0, 200_000]], { journal: bq, reference: 'VIR-B8-2' });
  const lu = await c.lire(`Lignes ouvertes de ${t.numero}`, `/comptes/${t.compteId}/lettrage?nonLettreesSeulement=true`);
  R.egal(`B8 · ${nom} · trois lignes ouvertes au compte du client`, 3, (lu?.lignes ?? []).length);
  await lettrer(c, t.numero, (lu?.lignes ?? []).map((l) => l.id), true);
  return { c, n, t };
}

async function pointB8(R) {
  R.scenario = 'paquet1-b · B8';
  const a = await dossierAvecBrouillard(R, 'Paquet 1 B8 · Brasserie du Fleuve SARL', 'p1b-b8', { referentiel: 'SYSCOHADA', systeme: 'NORMAL' }, '70110000');
  if (a.t) {
    await etape(R, 'B8 · SARL · notes annexes, ventilation par échéance', async () => {
      const notes = await a.c.lire('Notes annexes', `/etats-financiers-syscohada/notes?exerciceId=${a.n}`);
      // Les rubriques à colonnes d'échéance servent `valeurs.ECHEANCE_1AN` et
      // `echeanceNonVentilee` (absent quand rien n'est non ventilé).
      const clients = (notes?.notes ?? []).flatMap((nt) =>
        (nt.lignes ?? [])
          .filter((l) => l.valeurs && l.valeurs.ECHEANCE_1AN !== undefined && Math.abs(Number(l.montantN) - 700_000) < 0.01)
          .map((l) => ({ note: nt.code, libelle: l.libelle, l })),
      );
      R.egal('B8 · notes · une rubrique ventilée porte la créance de 700 000', true, clients.length > 0);
      for (const v of clients) {
        R.egal(`B8 · notes · ${v.note} « ${v.libelle} » · à un an au plus 700 000, rien de non ventilé (le brouillard écarté)`, [700_000, 0], [v.l.valeurs.ECHEANCE_1AN, v.l.echeanceNonVentilee ?? 0]);
      }
    });
  }
  for (const [cle, nom, options, vente, chemin] of [
    ['p1b-b8-smt', 'Paquet 1 B8 · Kiosque de la Gare (SMT)', { referentiel: 'SYSCOHADA', systeme: 'MINIMAL_TRESORERIE' }, '70110000', '/etats-financiers-syscohada/smt/notes'],
    ['p1b-b8-asso', 'Paquet 1 B8 · Amicale des Cheminots (SMT)', { referentiel: 'SYCEBNL', jeu: 'SYSTEME_MINIMAL_TRESORERIE' }, '70510000', '/etats-financiers/smt/notes'],
  ]) {
    const b = await dossierAvecBrouillard(R, nom, cle, options, vente);
    if (!b.t) continue;
    await etape(R, `B8 · ${nom} · NOTE 3`, async () => {
      const r = await b.c.lire(`Notes du SMT (${nom})`, `${chemin}?exerciceId=${b.n}`);
      const ligne = (r?.note3?.creances ?? []).find((x) => x.numero === b.t.numero);
      R.egal(`B8 · ${nom} · NOTE 3 · solde 700 000, non échu 700 000, rien de non ventilé`, [700_000, 700_000, 0], [ligne?.montantCloture ?? null, ligne?.montantNonEchu ?? null, ligne?.montantNonVentile ?? null]);
    });
  }
}

// ==============================================================================
// PREMIER TOUR DE RELECTURE (échecs silencieux) · M1, M2, mineurs, voisin
// ==============================================================================

/** Un bilan d'ouverture importé · lignes [compte, intitulé, débit, crédit]. */
async function importerOuverture(c, n, date, nomFichier, lignes) {
  const csv = ['Compte;Intitule;Debit;Credit', ...lignes.map((l) => l.join(';'))].join('\n');
  return c.geste(`Import du bilan d’ouverture (${nomFichier})`, 'POST', '/import/executer', {
    type: 'BALANCE', nomFichier, contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
    mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
    exerciceId: n, dateOperation: date, bilanDOuverture: true, separateur: ';',
  });
}

/** Les lignes ouvertes d'un compte de tiers, d'un exercice (année de la date). */
async function lignesOuvertes(c, t, annee) {
  const lu = await c.lire(`Lignes ouvertes de ${t.numero}`, `/comptes/${t.compteId}/lettrage?nonLettreesSeulement=true`);
  return (lu?.lignes ?? []).filter((l) => String(l.date).slice(0, 4) === annee);
}

// M1 · LE PREMIER EXERCICE TENU, OUVERT PAR UN BILAN IMPORTÉ (le cas du pilote).
// 2026 est le premier exercice du dossier, ouvert par un bilan importé au
// 01/01/2026 · F0, 1 000 000 au client C11 (échéance 30/11/2025, complétée au
// brouillard de l'import) ; F1, 1 000 000 le 01/03/2026, échéance 31/03/2026.
// Clôture · les deux se reportent au détail en 2027. Règlement de 1 000 000 le
// 15/02/2027, lettré à la main en partiel avec les deux reports. Code civil,
// Livre III, art. 154 · les deux dettes sont échues, « l'imputation se fait sur
// la plus ancienne » · F0 (sa pièce précède l'ouverture du 01/01/2026) est
// éteinte, F1 reste due en entier. Relance au 15/03/2027 · dû 1 000 000, une
// ligne (F1, 1 000 000), échéance la plus ancienne 31/03/2026, retard 349 jours
// (365 − 16). Sur main · F0 n'est ni origine ni introuvable, le groupe tombe au
// prorata (500 000 et 500 000), échéance la plus ancienne 30/11/2025.
// Dans 2026 même (C12) · import 600 000, facture 400 000 le 01/04/2026
// (échéance 30/04/2026), règlement 700 000 le 15/05/2026, les trois lettrés en
// partiel · la ligne importée EST l'origine (premier exercice tenu), le groupe
// n'est pas nommé.

async function pointM1(R) {
  R.scenario = 'paquet1-b · M1';
  const c = await nouveauDossier(R, 'Paquet 1 M1 · Comptoir repris de Kolwezi SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1b-m1', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const c11 = await tiers(c, 'CLIENT', 'C11', 'Client du Pilote');
  const c12 = await tiers(c, 'CLIENT', 'C12', 'Premier Exercice');
  if (!c11 || !c12) return R.note('M1 · tiers absents');
  await importerOuverture(c, n, '2026-01-01', 'ouverture-m1.csv', [
    [c11.numero, 'Client du Pilote', 1_000_000, 0],
    [c12.numero, 'Premier Exercice', 600_000, 0],
    ['10130000', 'Capital', 0, 1_600_000],
  ]);
  await etape(R, 'M1 · échéance de F0 complétée au brouillard de l’import', async () => {
    const r = await c.lire('Écriture importée', `/ecritures?exerciceId=${n}&reference=IMPORT`);
    const e = (r?.ecritures ?? [])[0];
    if (!e?.lignes) return R.note('M1 · écriture importée introuvable · F0 reste sans échéance');
    await c.geste('Échéance de F0 au 30/11/2025', 'PATCH', `/ecritures/${e.id}`, {
      lignes: e.lignes.map((l) => ({
        compteId: l.compteId, debit: Number(l.debit), credit: Number(l.credit),
        ...(l.libelle ? { libelle: l.libelle } : {}),
        ...(l.compteId === c11.compteId ? { dateEcheance: '2025-11-30' } : {}),
      })),
    });
  });
  await ecriture(c, 'Facture F1 de C11', n, '2026-03-01', 'Facture FV-M1-1', [[c11.numero, 1_000_000, 0, { dateEcheance: '2026-03-31' }], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-M1-1' });
  await ecriture(c, 'Facture de C12', n, '2026-04-01', 'Facture FV-M1-2', [[c12.numero, 400_000, 0, { dateEcheance: '2026-04-30' }], ['70110000', 0, 400_000]], { journal: ven, reference: 'FV-M1-2' });
  await ecriture(c, 'Règlement de C12', n, '2026-05-15', 'Règlement C12', [[BQ, 700_000, 0], [c12.numero, 0, 700_000]], { journal: bq, reference: 'VIR-M1-0' });
  await validerJusqua(c, n, '2026-12-31');
  await etape(R, 'M1 · 2026, premier exercice · le groupe de C12 avec la ligne importée', async () => {
    const lignes = await lignesOuvertes(c, c12, '2026');
    R.egal('M1 · C12 · ligne importée, facture et règlement ouverts', 3, lignes.length);
    await lettrer(c, c12.numero, lignes.map((l) => l.id), true);
    const ba = await c.lire('Balance âgée 2026', `/ecritures/balance-agee?exerciceId=${n}&dateReference=2026-06-30&type=CLIENTS_41`);
    R.egal('M1 · 2026 · aucun groupe nommé (la ligne importée du premier exercice EST l’origine)', 0, ba?.groupesLusLigneALigne?.total ?? null);
    const pos = (await c.lire('Relances au 30/06/2026', `/relances?exerciceId=${n}&type=RAPPEL&dateReference=2026-06-30`)) ?? [];
    const p12 = pos.find((x) => x.compteId === c12.compteId);
    // Import 600 000 (01/01/2026) d'abord, puis la facture · reste 300 000 sur elle.
    R.egal('M1 · C12 · reste 300 000 sur la facture du 01/04/2026 (l’import éteint d’abord)', [[300_000], '2026-04-30'], [(p12?.lignes ?? []).map((l) => Number(l.montant)), p12?.echeancePlusAncienne ?? null]);
  });
  const clos = await etape(R, 'M1 · clôture de 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('M1 · 2027 non joué · la clôture de 2026 n’a pas abouti ou l’exercice 2027 manque');
  await ecriture(c, 'Règlement de C11 en 2027', n1, '2027-02-15', 'Règlement C11', [[BQ, 1_000_000, 0], [c11.numero, 0, 1_000_000]], { journal: bq, reference: 'VIR-M1-1' });
  await validerJusqua(c, n1, '2027-02-28');
  await etape(R, 'M1 · lettrage à la main des deux reports avec le règlement de 2027', async () => {
    const lignes = await lignesOuvertes(c, c11, '2027');
    R.egal('M1 · C11 · deux reports et un règlement ouverts en 2027', [2, 1], [lignes.filter((l) => Number(l.debit) > 0).length, lignes.filter((l) => Number(l.credit) > 0).length]);
    await lettrer(c, c11.numero, lignes.map((l) => l.id), true);
  });
  await etape(R, 'M1 · relance au 15/03/2027', async () => {
    const pos = (await c.lire('Positions à relancer au 15/03/2027', `/relances?exerciceId=${n1}&type=RAPPEL&dateReference=2027-03-15`)) ?? [];
    const p = pos.find((x) => x.compteId === c11.compteId);
    R.montant('M1 · C11 · dû', 1_000_000, p?.montantDu);
    R.egal('M1 · C11 · F0, la plus ancienne (bilan importé), est éteinte · F1 seule réclamée, 1 000 000', [[1_000_000]], [(p?.lignes ?? []).map((l) => Number(l.montant))]);
    R.egal('M1 · C11 · échéance la plus ancienne 31/03/2026, retard 349 jours', ['2026-03-31', 349], [p?.echeancePlusAncienne ?? null, p?.retardMaxJours ?? null]);
    R.egal('M1 · C11 · aucun groupe nommé (les deux reports ont retrouvé leur pièce)', 0, p?.groupesLusLigneALigne?.total ?? null);
  });
}

// M1 (suite) et MINEUR 1 · UN À-NOUVEAU SANS ORIGINE EST NOMMÉ, ET LE TOUT OU
// RIEN VAUT POUR TOUTES LES LIGNES D'À-NOUVEAU DU GROUPE. Dossier tenu depuis
// 2025 (exercice vide, gardé), dont 2026 s'ouvre par un bilan importé · la
// ligne importée a un exercice précédent qui ne la porte pas, sa pièce
// d'origine ne se retrouve pas (rien n'est deviné).
// C21 (2026) · import 1 000 000 ; facture 1 000 000 le 01/03/2026 (échéance
// 31/03/2026) ; règlement 1 200 000 le 10/06/2026 ; les trois lettrés en
// partiel · le groupe est NOMMÉ, motif « à-nouveau sans origine », à la balance
// âgée et à la relance. Sur main · rien n'est servi (le journal du serveur).
// C22 (mineur 1) · import 1 000 000 ; facture F 1 000 000 le 01/03/2026
// (31/03/2026) et règlement P 400 000 le 10/06/2026 lettrés en partiel en 2026
// (le groupe est reconduit sur leurs reports) ; en 2027, règlement P2 de
// 600 000 le 15/02/2027, et le groupe reconduit complété à la main par le
// report de l'import et P2. Le report de l'import n'a pas d'origine · TOUTES
// les lignes d'à-nouveau du groupe s'imputent à la date du report, au prorata
// à date égale (art. 154) · 500 000 restent sur chacune, le groupe est nommé.
// Sur main · F, datée par la reconduction au 01/03/2026, passe avant l'import
// (daté du 01/01/2027) et s'éteint seule · 1 000 000 réclamés sur l'import.

async function pointM1B(R) {
  R.scenario = 'paquet1-b · M1 suite et mineur 1';
  const c = await nouveauDossier(R, 'Paquet 1 M1B · Dépôt de Likasi SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1b-m1b', exercice: ['2025-01-01', '2025-12-31'] });
  await c.geste('Exercice 2026', 'POST', '/exercices', { dateDebut: '2026-01-01', dateFin: '2026-12-31' });
  await rechargerExercices(c);
  const n = c.exercices.get('2026')?.id;
  if (!n) return R.note('M1B · exercice 2026 non créé');
  const bq = c.journal('BQ') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const c21 = await tiers(c, 'CLIENT', 'C21', 'Sans Origine');
  const c22 = await tiers(c, 'CLIENT', 'C22', 'Groupe Reconduit');
  if (!c21 || !c22) return R.note('M1B · tiers absents');
  await importerOuverture(c, n, '2026-01-01', 'ouverture-m1b.csv', [
    [c21.numero, 'Sans Origine', 1_000_000, 0],
    [c22.numero, 'Groupe Reconduit', 1_000_000, 0],
    ['10130000', 'Capital', 0, 2_000_000],
  ]);
  await ecriture(c, 'Facture de C21', n, '2026-03-01', 'Facture FV-M1B-1', [[c21.numero, 1_000_000, 0, { dateEcheance: '2026-03-31' }], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-M1B-1' });
  await ecriture(c, 'Règlement de C21', n, '2026-06-10', 'Règlement C21', [[BQ, 1_200_000, 0], [c21.numero, 0, 1_200_000]], { journal: bq, reference: 'VIR-M1B-1' });
  await ecriture(c, 'Facture F de C22', n, '2026-03-01', 'Facture FV-M1B-2', [[c22.numero, 1_000_000, 0, { dateEcheance: '2026-03-31' }], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-M1B-2' });
  await ecriture(c, 'Règlement P de C22', n, '2026-06-10', 'Règlement C22', [[BQ, 400_000, 0], [c22.numero, 0, 400_000]], { journal: bq, reference: 'VIR-M1B-2' });
  await validerJusqua(c, n, '2026-12-31');
  await etape(R, 'M1B · 2026 · lettrages partiels', async () => {
    const l21 = await lignesOuvertes(c, c21, '2026');
    R.egal('M1B · C21 · import, facture et règlement ouverts', 3, l21.length);
    await lettrer(c, c21.numero, l21.map((l) => l.id), true);
    const l22 = (await lignesOuvertes(c, c22, '2026')).filter((l) => /FV-M1B-2|C22/.test(`${l.libelle}`));
    R.egal('M1B · C22 · facture et règlement de 2026 ouverts (l’import reste à part)', 2, l22.length);
    await lettrer(c, c22.numero, l22.map((l) => l.id), true);
  });
  await etape(R, 'M1B · C21 · le groupe sans origine est servi, avec son motif', async () => {
    const ba = await c.lire('Balance âgée 2026', `/ecritures/balance-agee?exerciceId=${n}&dateReference=2026-06-30&type=CLIENTS_41`);
    R.egal('M1B · balance âgée · un groupe nommé, compte de C21, motif à-nouveau sans origine', [1, c21.numero, 'A_NOUVEAU_SANS_ORIGINE'], [ba?.groupesLusLigneALigne?.total ?? null, ba?.groupesLusLigneALigne?.groupes?.[0]?.compte ?? null, ba?.groupesLusLigneALigne?.groupes?.[0]?.motif ?? null]);
    const pos = (await c.lire('Relances au 30/06/2026', `/relances?exerciceId=${n}&type=RAPPEL&dateReference=2026-06-30`)) ?? [];
    const p = pos.find((x) => x.compteId === c21.compteId);
    R.egal('M1B · relance · le groupe est nommé sur la position de C21, avec son motif', [1, 'A_NOUVEAU_SANS_ORIGINE'], [p?.groupesLusLigneALigne?.total ?? null, p?.groupesLusLigneALigne?.groupes?.[0]?.motif ?? null]);
    R.montant('M1B · C21 · dû 800 000 (2 000 000 − 1 200 000)', 800_000, p?.montantDu);
  });
  const clos25 = await etape(R, 'M1B · clôture de 2025 (vide)', () => cloturer(c, '2025'));
  const clos26 = clos25 ? await etape(R, 'M1B · clôture de 2026', () => cloturer(c, '2026')) : null;
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos26 || !n1) return R.note('M1B · 2027 non joué · une clôture n’a pas abouti ou l’exercice 2027 manque');
  await ecriture(c, 'Règlement P2 de C22 en 2027', n1, '2027-02-15', 'Règlement C22 (2027)', [[BQ, 600_000, 0], [c22.numero, 0, 600_000]], { journal: bq, reference: 'VIR-M1B-3' });
  await validerJusqua(c, n1, '2027-02-28');
  await etape(R, 'M1B · C22 · le groupe reconduit complété à la main par le report de l’import et P2', async () => {
    const lignes = await lignesOuvertes(c, c22, '2027');
    const reconduit = lignes.find((l) => l.lettrageId)?.lettrageId;
    const libres = lignes.filter((l) => !l.lettrageId);
    R.egal('M1B · C22 · un groupe reconduit (deux lignes) et deux lignes libres (report de l’import, P2)', [2, 2], [lignes.filter((l) => l.lettrageId).length, libres.length]);
    if (!reconduit) return;
    await c.geste('Complément du groupe reconduit', 'POST', `/comptes/${c22.compteId}/lettrage/${reconduit}/completer`, { ligneIds: libres.map((l) => l.id) });
  });
  await etape(R, 'M1B · C22 · relance au 15/03/2027', async () => {
    const pos = (await c.lire('Positions à relancer au 15/03/2027', `/relances?exerciceId=${n1}&type=RAPPEL&dateReference=2027-03-15`)) ?? [];
    const p = pos.find((x) => x.compteId === c22.compteId);
    R.montant('M1B · C22 · dû', 1_000_000, p?.montantDu);
    R.egal('M1B · C22 · tout ou rien · les deux à-nouveaux à la date du report, au prorata · 500 000 et 500 000', [500_000, 500_000], (p?.lignes ?? []).map((l) => Number(l.montant)).sort((a, b) => a - b));
    R.egal('M1B · C22 · le groupe est nommé, motif à-nouveau sans origine', [1, 'A_NOUVEAU_SANS_ORIGINE'], [p?.groupesLusLigneALigne?.total ?? null, p?.groupesLusLigneALigne?.groupes?.[0]?.motif ?? null]);
  });
}

// M2 ET MINEUR 7 · UN GROUPE QUI NE SE RÉPARTIT PAS SE RÉCLAME POUR SON NET.
// C51 (2027 seul) · F0, facture de 1 500 000 le 05/01/2027, échéance
// 31/01/2027 ; facture de 1 000 USD à 2 800 (2 800 000) le 20/01/2027,
// échéance 30/04/2027 ; règlement de 600 USD à 3 000 (1 800 000) saisi au
// journal le 15/02/2027, lettré en partiel avec la facture en USD · le groupe
// ne se répartit pas (reste au coût historique 400 × 2 800 = 1 120 000 contre
// un net de 1 000 000). PRÉVENTIF au 01/03/2027 · dû 1 000 000, le net du
// groupe à l'échéance de sa facture encore ouverte (30/04/2027), une ligne.
// RAPPEL au 01/03/2027 · dû 1 500 000, F0 seule, une ligne. Sur main ·
// préventif 2 800 000 (la facture entière, le règlement écarté par sa date) ;
// rappel · F0 moins le règlement, −300 000, le compte sort des positions et F0
// n'est jamais relancée. Mineur 7 · le groupe est servi avec son motif ·
// facture en devise réglée en PARTIE (l'écart réalisé ne se passe qu'au groupe
// soldé, ligne A6), jamais « écart de change non passé ».

async function pointM2(R) {
  R.scenario = 'paquet1-b · M2 et mineur 7';
  const c = await nouveauDossier(R, 'Paquet 1 M2 · Import-Export de Boma SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1b-m2', exercice: ['2027-01-01', '2027-12-31'] });
  const n = c.exercices.get('2027').id;
  const bq = c.journal('BQ') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const devises = (await c.lire('Devises', '/devises')) ?? [];
  const usd = devises.find((d) => d.code === 'USD') ?? (await c.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
  if (!usd?.id) return R.note('M2 · devise USD absente');
  for (const [date, cours] of [['2027-01-20', 2_800], ['2027-02-15', 3_000]]) {
    await c.geste(`Cours USD du ${date}`, 'POST', `/devises/${usd.id}/cours`, { date, cours, source: 'Banque centrale du Congo (paquet 1, M2)' });
  }
  const t = await tiers(c, 'CLIENT', 'C51', 'Net du Groupe');
  if (!t) return R.note('M2 · tiers absent');
  await ecriture(c, 'Facture F0 de C51', n, '2027-01-05', 'Facture FV-M2-0', [[t.numero, 1_500_000, 0, { dateEcheance: '2027-01-31' }], ['70110000', 0, 1_500_000]], { journal: ven, reference: 'FV-M2-0' });
  await ecriture(c, 'Facture en USD de C51', n, '2027-01-20', 'Facture FV-M2-1', [[t.numero, 2_800_000, 0, { dateEcheance: '2027-04-30', deviseId: usd.id, montantDevise: 1_000, coursApplique: 2_800 }], ['70110000', 0, 2_800_000]], { journal: ven, reference: 'FV-M2-1' });
  await ecriture(c, 'Règlement partiel en USD de C51', n, '2027-02-15', 'Règlement FV-M2-1', [[BQ, 1_800_000, 0], [t.numero, 0, 1_800_000, { deviseId: usd.id, montantDevise: 600, coursApplique: 3_000 }]], { journal: bq, reference: 'VIR-M2-1' });
  await validerJusqua(c, n, '2027-02-28');
  await etape(R, 'M2 · lettrage partiel de la facture en USD et de son règlement', async () => {
    const lignes = (await lignesOuvertes(c, t, '2027')).filter((l) => l.devise === 'USD');
    R.egal('M2 · facture et règlement en USD ouverts', 2, lignes.length);
    await lettrer(c, t.numero, lignes.map((l) => l.id), true);
  });
  await etape(R, 'M2 · relances au 01/03/2027', async () => {
    const prev = (await c.lire('Préventif au 01/03/2027', `/relances?exerciceId=${n}&type=PREVENTIVE&dateReference=2027-03-01`)) ?? [];
    const pp = prev.find((x) => x.compteId === t.compteId);
    R.montant('M2 · préventif · dû 1 000 000 (le net du groupe, jamais la facture entière)', 1_000_000, pp?.montantDu);
    R.egal('M2 · préventif · une ligne de 1 000 000, à l’échéance du 30/04/2027', [[1_000_000], '2027-04-30'], [(pp?.lignes ?? []).map((l) => Number(l.montant)), pp?.echeancePlusAncienne ?? null]);
    const rap = (await c.lire('Rappel au 01/03/2027', `/relances?exerciceId=${n}&type=RAPPEL&dateReference=2027-03-01`)) ?? [];
    const pr = rap.find((x) => x.compteId === t.compteId);
    R.montant('M2 · rappel · dû 1 500 000 (F0 échue, que le règlement du groupe ne retranche pas)', 1_500_000, pr?.montantDu);
    R.egal('M2 · rappel · une ligne, F0, de 1 500 000', [[1_500_000]], [(pr?.lignes ?? []).map((l) => Number(l.montant))]);
  });
  await etape(R, 'M2 · mineur 7 · le motif du groupe est servi', async () => {
    const ba = await c.lire('Balance âgée au 01/03/2027', `/ecritures/balance-agee?exerciceId=${n}&dateReference=2027-03-01&type=CLIENTS_41`);
    R.egal('Mineur 7 · balance âgée · le groupe est servi, motif « facture en devise réglée en partie »', [1, 'DEVISE_REGLEE_EN_PARTIE'], [ba?.groupesLusLigneALigne?.total ?? null, ba?.groupesLusLigneALigne?.groupes?.[0]?.motif ?? null]);
    R.montant('Mineur 7 · balance âgée · net = solde du client (2 500 000)', 2_500_000, ba?.totaux?.net);
  });
}

// MINEUR 2 · LES ORIGINES SE CHERCHENT PAR LE FILTRE DU REPORT. C31 · facture
// de 1 000 000 le 01/03/2026, SANS échéance, validée ; la même pièce saisie une
// seconde fois (même compte, montant et libellé), le doublon resté au
// brouillard. 2027 est ouvert par les à-nouveaux PROVISOIRES, qui ne lisent que
// le livre-journal · un seul report. Relance au 15/02/2027 · la ligne reportée
// garde la date de sa pièce, 01/03/2026, retard 351 jours (365 − 14). Sur main ·
// deux candidates (le brouillard lu) pour un report, aucune origine sûre · la
// ligne se date du 01/01/2027, retard 45 jours.

async function pointMIN2(R) {
  R.scenario = 'paquet1-b · mineur 2';
  const c = await nouveauDossier(R, 'Paquet 1 MIN2 · Papeterie de Kananga SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1b-min2', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const ven = c.journal('VEN') ?? c.od;
  const t = await tiers(c, 'CLIENT', 'C31', 'Doublon au Brouillard');
  if (!t) return R.note('MIN2 · tiers absent');
  await ecriture(c, 'Facture de C31', n, '2026-03-01', 'Facture FV-MIN2-1', [[t.numero, 1_000_000, 0], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-MIN2-1' });
  await validerJusqua(c, n, '2026-03-31');
  await ecriture(c, 'Doublon de la facture de C31 (brouillard)', n, '2026-04-02', 'Facture FV-MIN2-1', [[t.numero, 1_000_000, 0], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-MIN2-1-BIS' });
  const prov = await etape(R, 'MIN2 · 2027 ouvert par les à-nouveaux provisoires', () => c.geste('À-nouveaux provisoires', 'POST', `/exercices/${n}/a-nouveaux-provisoires`, {}));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!prov || !n1) return R.note('MIN2 · 2027 non ouvert');
  await etape(R, 'MIN2 · relance au 15/02/2027', async () => {
    const pos = (await c.lire('Positions à relancer au 15/02/2027', `/relances?exerciceId=${n1}&type=RAPPEL&dateReference=2027-02-15`)) ?? [];
    const p = pos.find((x) => x.compteId === t.compteId);
    R.egal('MIN2 · C31 · une ligne reportée, datée de sa pièce (01/03/2026), retard 351 jours', [['2026-03-01'], 351], [(p?.lignes ?? []).map((l) => l.date), p?.retardMaxJours ?? null]);
  });
}

// MINEUR 4 · UNE CAISSE COMPTÉE APRÈS LA CLÔTURE · le refus nomme la valeur
// reconstituée. Caisse de 1 300 000 au 31/12/2026 ; 2027 ouvert ; dépense de
// caisse de 100 000 le 03/01/2027 ; comptage le 05/01/2027 · 1 190 000 comptés
// contre 1 200 000 au livre-journal ce jour-là, écart −10 000. Espèces existant
// à la clôture, reconstituées (ligne A10) · 1 190 000 + 100 000 = 1 290 000. La
// campagne de caisse seule refuse sa clôture (écart non arbitré) et dit de
// porter sur la fiche de la caisse 1 290 000, la valeur figée sur le PV pour la
// clôture, jamais les espèces du jour du comptage. Sur main · « portez le
// comptage sur une fiche », sans valeur · porté tel quel (1 190 000), il
// fabriquerait un écart de −110 000 contre le solde de clôture.

async function pointMIN4(R) {
  R.scenario = 'paquet1-b · mineur 4';
  const { c, n, ca } = await associationAvecCaisse(R, 'Paquet 1 MIN4 · Amis de Kalemie', 'p1b-min4');
  const CAISSE = '57100000';
  await c.geste('Exercice 2027', 'POST', '/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!n1) return R.note('MIN4 · exercice 2027 non créé');
  await ecriture(c, 'Dépense de caisse de 2027', n1, '2027-01-03', 'Fournitures payées comptant', [['60520000', 100_000, 0], [CAISSE, 0, 100_000]], { journal: ca, reference: 'BC-2027-1' });
  await validerJusqua(c, n1, '2027-01-31');
  await etape(R, 'MIN4 · comptage après la clôture, écart non arbitré', async () => {
    const camp = await c.geste('Campagne de caisse', 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-31', libelle: 'Comptage tardif de la caisse' });
    if (!camp) return;
    const sc = await sousCommission(c, camp.id, 'Caisse du siège');
    if (!sc) return;
    const apercu = await c.lire('Aperçu du PV', `/inventaire/${camp.id}/pv-caisse/apercu?compteId=${compte(c, CAISSE)}&dateComptage=2027-01-05`);
    R.montant('MIN4 · solde du livre-journal au jour du comptage', 1_200_000, apercu?.soldeComptable);
    const pv = await c.geste('PV de comptage · 1 190 000', 'POST', `/inventaire/${camp.id}/pv-caisse`, {
      compteId: compte(c, CAISSE), sousCommissionId: sc.id, dateComptage: '2027-01-05', modeComparaison: apercu?.modeComparaison ?? 'FRANCS', especesComptees: 1_190_000,
    });
    R.montant('MIN4 · écart du PV (1 190 000 − 1 200 000)', -10_000, pv?.ecart);
    await c.geste('PV de la campagne', 'POST', `/inventaire/${camp.id}/proces-verbal`, { dateEtablissement: '2027-01-06' });
    const cl = await c.req('POST', `/inventaire/${camp.id}/clore`, {});
    const texte = JSON.stringify(cl.corps ?? '').replace(/\s/g, '');
    R.egal('MIN4 · clôture refusée (écart non arbitré)', true, cl.statut >= 400);
    R.egal('MIN4 · le refus dit de porter la valeur reconstituée à la clôture, 1 290 000, figée sur le PV', true, texte.includes('1290000,00') && /reconstitu/i.test(texte));
  });
}

// MINEUR 5 · SOLDES NULS · une facture et son règlement non lettrés DANS LA
// MÊME TRANCHE (facture de 500 000 le 10/02/2027, échéance 28/02/2027 ;
// règlement de 500 000 le 20/02/2027) · au 01/03/2027 la ligne du tiers a un
// solde nul et deux pièces ouvertes · elle est rendue avec les soldes nuls. Sur
// main · ses tranches valent zéro, la ligne disparaît.

async function pointMIN5(R) {
  R.scenario = 'paquet1-b · mineur 5';
  const c = await nouveauDossier(R, 'Paquet 1 MIN5 · Droguerie de Mbandaka SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1b-min5', exercice: ['2027-01-01', '2027-12-31'] });
  const n = c.exercices.get('2027').id;
  const bq = c.journal('BQ') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const t = await tiers(c, 'CLIENT', 'C55', 'Même Tranche');
  const t2 = await tiers(c, 'CLIENT', 'C56', 'Débiteur');
  if (!t || !t2) return R.note('MIN5 · tiers absents');
  await ecriture(c, 'Facture de C55', n, '2027-02-10', 'Facture FV-MIN5-1', [[t.numero, 500_000, 0, { dateEcheance: '2027-02-28' }], ['70110000', 0, 500_000]], { journal: ven, reference: 'FV-MIN5-1' });
  await ecriture(c, 'Règlement de C55', n, '2027-02-20', 'Règlement C55', [[BQ, 500_000, 0], [t.numero, 0, 500_000]], { journal: bq, reference: 'VIR-MIN5-1' });
  await ecriture(c, 'Facture de C56', n, '2027-02-12', 'Facture FV-MIN5-2', [[t2.numero, 300_000, 0, { dateEcheance: '2027-03-31' }], ['70110000', 0, 300_000]], { journal: ven, reference: 'FV-MIN5-2' });
  await validerJusqua(c, n, '2027-02-28');
  await etape(R, 'MIN5 · balance âgée au 01/03/2027', async () => {
    const ba = await c.lire('Balance âgée au 01/03/2027', `/ecritures/balance-agee?exerciceId=${n}&dateReference=2027-03-01&type=CLIENTS_41`);
    R.egal('MIN5 · C55 (deux pièces ouvertes, même tranche, solde nul) est rendu avec les soldes nuls', true, (ba?.soldesNuls ?? []).some((l) => String(l.libelle).startsWith('C55')));
    R.montant('MIN5 · net = solde des clients (300 000)', 300_000, ba?.totaux?.net);
  });
}

// MINEUR 6 · LE MONTANT DE L'OCCURRENCE · une pièce qui redresse le manquant de
// caisse (D 658 5 000 / C 571 5 000, rattachée à l'écart) et porte AUSSI une
// dépense sans tiers (D 6052 2 000 / C 571 2 000) · l'occurrence de
// CHARGE_SANS_TIERS vaut 2 000, et ne nomme que le 6052. Sur main · 7 000, le
// 658 du manquant compté.

async function pointMIN6(R) {
  R.scenario = 'paquet1-b · mineur 6';
  const { c, n } = await associationAvecCaisse(R, 'Paquet 1 MIN6 · Lumière de Kikwit', 'p1b-min6');
  const CAISSE = '57100000';
  await etape(R, 'MIN6 · manquant arbitré, redressé dans une pièce qui porte aussi une dépense', async () => {
    const camp = await c.geste('Campagne d’inventaire', 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-31', libelle: 'Inventaire 2026' });
    if (!camp) return;
    const sc = await sousCommission(c, camp.id, 'Caisse du siège');
    if (!sc) return;
    const fiche = await c.geste('Fiche · caisse', 'POST', `/inventaire/${camp.id}/fiches`, { compteId: compte(c, CAISSE), sousCommissionId: sc.id, designation: 'Espèces en caisse' });
    if (fiche) await c.geste('Comptage · espèces', 'PATCH', `/inventaire/fiches/${fiche.id}`, { valeurInventaire: 1_295_000, referencePiece: 'PV-CAISSE-2026' });
    await c.geste('PV de la campagne', 'POST', `/inventaire/${camp.id}/proces-verbal`, { dateEtablissement: '2026-12-31' });
    const rap = await c.geste('Rapprochement', 'POST', `/inventaire/${camp.id}/rapprocher`);
    const ecart = (rap?.ecarts ?? []).find((e) => e.compte?.numero === CAISSE);
    R.montant('MIN6 · écart de la caisse (1 295 000 − 1 300 000)', -5_000, ecart?.ecart);
    if (!ecart) return;
    await c.geste('Arbitrage · à redresser', 'PATCH', `/inventaire/ecarts/${ecart.id}`, {
      decision: 'A_REDRESSER', responsable: 'MUKENDI, caissière', explication: 'Manquant constaté au comptage, non justifié',
    });
    const e = await ecriture(c, 'Redressement du manquant et dépense', n, '2026-12-31', 'Manquant de caisse et fournitures',
      [['65800000', 5_000, 0], [CAISSE, 0, 5_000], ['60520000', 2_000, 0], [CAISSE, 0, 2_000]], { journal: c.od, reference: 'PV-CAISSE-2026' });
    await validerJusqua(c, n, '2026-12-31');
    const rat = e ? await c.geste('Rattachement du redressement', 'POST', `/inventaire/ecarts/${ecart.id}/ecriture`, { ecritureId: e.id }) : null;
    R.egal('MIN6 · redressement rattaché à l’écart', true, Boolean(rat?.rattache));
    const occ = (await anomaliesDe(c, n, 'CHARGE_SANS_TIERS')).flatMap((a) => a.occurrences ?? []).find((o) => /Manquant de caisse et fournitures/.test(`${o.detail}`));
    R.egal('MIN6 · la dépense glissée dans la pièce reste signalée', true, Boolean(occ));
    R.montant('MIN6 · montant de l’occurrence · la dépense seule (2 000), jamais le manquant', 2_000, occ?.montant);
    R.egal('MIN6 · l’occurrence ne nomme que le 6052', false, /65800000/.test(`${occ?.detail}`));
  });
}

// VOISIN · LES RELANCES DE N COMPTENT EN N+1. C41 · facture de 1 000 000 le
// 01/03/2026, échéance 31/03/2026 ; mise en demeure (niveau 3 du SYSCOHADA,
// seuil 45 jours) émise le 30/06/2026. Clôture ; le report porte l'échéance.
// Relance au 15/02/2027 · la ligne garde la date de sa pièce (01/03/2026), la
// mise en demeure de 2026 est la dernière relance (niveau 3, 30/06/2026), et
// aucun niveau n'est suggéré (rien au-delà du 3, audit final F169). Sur main ·
// la pièce se date du 01/01/2027, la relance de 2026 sort du décompte et la
// mise en demeure est resuggérée.

async function pointVOISIN(R) {
  R.scenario = 'paquet1-b · voisin (relances)';
  const c = await nouveauDossier(R, 'Paquet 1 VOISIN · Tannerie de Bunia SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1b-vois', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const ven = c.journal('VEN') ?? c.od;
  const t = await tiers(c, 'CLIENT', 'C41', 'Mis en Demeure');
  if (!t) return R.note('VOISIN · tiers absent');
  await ecriture(c, 'Facture de C41', n, '2026-03-01', 'Facture FV-VOIS-1', [[t.numero, 1_000_000, 0, { dateEcheance: '2026-03-31' }], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-VOIS-1' });
  await validerJusqua(c, n, '2026-12-31');
  await etape(R, 'VOISIN · mise en demeure émise le 30/06/2026', async () => {
    const niveaux = (await c.lire('Niveaux de relance', '/relances/niveaux')) ?? [];
    const trois = (Array.isArray(niveaux) ? niveaux : niveaux.niveaux ?? []).find((x) => x.niveau === 3);
    if (!trois) return R.note('VOISIN · niveau 3 absent');
    const em = await c.geste('Émission du niveau 3', 'POST', '/relances/emettre', { exerciceId: n, compteIds: [t.compteId], niveauId: trois.id, dateReference: '2026-06-30' });
    R.egal('VOISIN · la mise en demeure est émise en 2026', true, Boolean(em));
  });
  const clos = await etape(R, 'VOISIN · clôture de 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note('VOISIN · 2027 non joué');
  await etape(R, 'VOISIN · relance au 15/02/2027', async () => {
    const pos = (await c.lire('Positions à relancer au 15/02/2027', `/relances?exerciceId=${n1}&type=RAPPEL&dateReference=2027-02-15`)) ?? [];
    const p = pos.find((x) => x.compteId === t.compteId);
    R.egal('VOISIN · la ligne reportée garde la date de sa pièce (01/03/2026)', ['2026-03-01'], (p?.lignes ?? []).map((l) => l.date));
    R.egal('VOISIN · la mise en demeure de 2026 compte · dernière relance niveau 3 du 30/06/2026', [3, '2026-06-30'], [p?.derniereRelance?.niveau ?? null, p?.derniereRelance?.date ?? null]);
    R.egal('VOISIN · aucun niveau suggéré (la mise en demeure n’est pas resuggérée)', null, p?.niveauSuggere ?? null);
  });
}

// MINEUR 3 · LA CLÔTURE D'UNE CAMPAGNE NE PASSE QU'UNE FOIS. Six campagnes de
// caisse seule prêtes à clore (PV de caisse sans écart, PV de campagne) · deux
// demandes de clôture partent ENSEMBLE sur chacune. Une seule doit aboutir,
// l'autre refusée. Sur main · les deux lisent la campagne ouverte avant
// qu'aucune n'écrive, et les deux clôtures passent (deux actes au journal
// d'audit pour une clôture). Sonde de concurrence · l'entrelacement n'est pas
// garanti, le décompte est noté.

async function pointMIN3(R) {
  R.scenario = 'paquet1-b · mineur 3';
  const { c, n } = await associationAvecCaisse(R, 'Paquet 1 MIN3 · Amis de Gemena', 'p1b-min3');
  const CAISSE = '57100000';
  let doubles = 0;
  let simples = 0;
  const statuts = [];
  for (let i = 0; i < 6; i++) {
    const camp = await c.geste(`Campagne ${i + 1}`, 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-31', libelle: `Comptage ${i + 1}` });
    if (!camp) continue;
    const sc = await sousCommission(c, camp.id, `Caisse ${i + 1}`);
    if (!sc) continue;
    await c.geste('PV de caisse', 'POST', `/inventaire/${camp.id}/pv-caisse`, {
      compteId: compte(c, CAISSE), sousCommissionId: sc.id, dateComptage: '2026-12-31', modeComparaison: 'FRANCS', especesComptees: 1_300_000,
    });
    await c.geste('PV de campagne', 'POST', `/inventaire/${camp.id}/proces-verbal`, { dateEtablissement: '2027-01-05' });
    const [a, b] = await Promise.all([c.req('POST', `/inventaire/${camp.id}/clore`, {}), c.req('POST', `/inventaire/${camp.id}/clore`, {})]);
    statuts.push(`${a.statut}/${b.statut}`);
    const ok = [a, b].filter((x) => x.statut < 400).length;
    if (ok === 2) doubles++;
    else if (ok === 1) simples++;
  }
  R.note(`MIN3 · deux clôtures simultanées par campagne · ${statuts.join(', ')} · ${doubles} close(s) deux fois, ${simples} une fois`);
  R.egal('MIN3 · aucune campagne n’est close deux fois par deux demandes simultanées', 0, doubles);
  R.egal('MIN3 · chaque campagne est close une fois', 6, simples);
}

export default async function scenarioPaquet1B(registre) {
  const table = { B10: pointB10, B1: pointB1, B2: pointB2, B9: pointB9, B3: pointB3, B7: pointB7, B6: pointB6, B5: pointB5, B8: pointB8, M1: pointM1, M1B: pointM1B, M2: pointM2, MIN2: pointMIN2, MIN3: pointMIN3, MIN4: pointMIN4, MIN5: pointMIN5, MIN6: pointMIN6, VOISIN: pointVOISIN };
  for (const p of POINTS) {
    const fn = table[p];
    if (!fn) continue;
    console.log(`\n--- ${p} ---`);
    try {
      await fn(registre);
    } catch (e) {
      registre.scenario = `paquet1-b · ${p}`;
      registre.note(`${p} interrompu · ${e.stack ?? e.message}`);
    }
  }
}

// Gardés pour les points suivants (B7, B6, B5, B8) · lus ici pour que
// l'import ne tombe pas sur un nom inutilisé.
void ligneDe; void rechargerComptes;
