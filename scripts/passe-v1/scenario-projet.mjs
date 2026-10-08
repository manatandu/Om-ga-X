/**
 * SCÉNARIO 2 · PROJET DE DÉVELOPPEMENT (SYCEBNL, jeu « projets de
 * développement »), exercices 2026 (N) et 2027 (N+1).
 *
 * Écritures du Guide, Partie 3 ch. 3 · décaissement du bailleur au crédit du
 * 162 (investissement) et du 462 (administration) ; charges au débit de la
 * classe 6 neutralisées au fil de l'engagement par le débit du 462 et le
 * crédit du 702 ; immobilisations au débit de la classe 2 par le crédit du 481,
 * SANS amortissement (Acte uniforme SYCEBNL art. 7 et 9). Les attendus sont
 * calculés à la main dans README.md (section « Projet »).
 */
import {
  aplatir, balance, cloturer, compte, ecriture, etape, lettrer, ligneDe, lignesDuCompte,
  livresExportes, nouveauDossier, rechargerExercices, restitution, solde, tiers, validerJusqua,
} from './lib.mjs';
import { confronterControles, relireLiasse } from './parcours.mjs';

/** Les contrôles que la fin de chaque exercice doit lever · README, « Contrôles de clôture ». */
const CONTROLES_ATTENDUS_2026 = {
  BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE: { raison: 'la banque du projet n’est pas rapprochée par le banc', references: ['52110000'] },
  CHARGE_SANS_TIERS: 'missions, entretien, transport et maintenance payés directement par la banque',
  CLOTURE_INFORMATIQUE_EN_RETARD: 'aucune clôture de période posée dans OmegaX, échéance du premier trimestre passée au 15/02/2028',
  DATE_ARRETE_NON_RENSEIGNEE: 'le banc ne saisit pas la date d’arrêté des comptes',
  MANUEL_PROCEDURES_ABSENT: 'aucun manuel des procédures enregistré',
  SANS_PIECE: 'des écritures du banc sans référence de pièce',
  VALIDATION_PAR_SON_AUTEUR: 'un seul utilisateur saisit et valide',
};
const CONTROLES_ATTENDUS_2027 = {
  BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE: { raison: 'la banque du projet n’est pas rapprochée par le banc', references: ['52110000'] },
  CHARGE_SANS_TIERS: 'missions, entretien, transport et maintenance payés directement par la banque',
  CLOTURE_INFORMATIQUE_EN_RETARD: 'aucune clôture de période posée dans OmegaX, échéance du premier trimestre passée au 15/02/2028',
  DATE_ARRETE_NON_RENSEIGNEE: 'le banc ne saisit pas la date d’arrêté des comptes',
  MANUEL_PROCEDURES_ABSENT: 'aucun manuel des procédures enregistré',
  SANS_PIECE: 'des écritures du banc sans référence de pièce',
  VALIDATION_PAR_SON_AUTEUR: 'un seul utilisateur saisit et valide',
};

const BQ = '52110000';
const F162 = '16200000';
const F462 = '46200000';
const Q702 = '70200000';
const FRS_INV = '48120000';

/**
 * Intérêts du dépôt à terme de 2026 · le seul produit NON neutralisé du
 * projet. `PASSE_PROJET_SANS_INTERETS=1` le retire, pour éprouver 2027 tant
 * que le constat P1 (le bilan du projet ne lit pas le solde de l'exercice
 * avant la clôture) refuse la clôture de 2026 · tous les attendus en
 * dépendent par `I`.
 */
const I = process.env.PASSE_PROJET_SANS_INTERETS === '1' ? 0 : 120_000;

export async function scenarioProjet(registre) {
  registre.scenario = 'Projet';
  const R = registre;
  const c = await nouveauDossier(R, 'Passe V1 · Projet Eau potable Kasaï', {
    referentiel: 'SYCEBNL', jeu: 'PROJETS_DEVELOPPEMENT', cle: 'projet', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;

  // --- Préparation · bailleur, nomenclature budgétaire, budgets, fournisseur ---
  const prep = await etape(R, 'Bailleur, nomenclature budgétaire et budgets 2026', async () => {
    const bailleur = await c.geste('Bailleur', 'POST', '/bailleurs', { code: 'FME', nom: 'Fonds mondial pour l’eau' });
    const plan = await c.geste('Plan analytique budgétaire', 'POST', '/analytique/plans', {
      code: 'BUD', intitule: 'Nomenclature budgétaire du projet', classesVentilees: '2,6', gererBudgets: true,
    });
    const sections = {};
    for (const [code, intitule] of [['R1', 'Équipements'], ['R2', 'Fournitures et consommables'], ['R3', 'Missions et transports'], ['R4', 'Services extérieurs']]) {
      const s = await c.geste(`Section ${code}`, 'POST', `/analytique/plans/${plan?.id}/sections`, {
        code, intitule, type: 'DETAIL', ...(bailleur ? { bailleurId: bailleur.id } : {}),
      });
      sections[code] = s?.id;
    }
    for (const [code, montant] of [['R1', 22_000_000], ['R2', 6_000_000], ['R3', 4_000_000], ['R4', 5_000_000]]) {
      await c.geste(`Budget 2026 ${code}`, 'POST', `/analytique/sections/${sections[code]}/budget`, { exerciceId: n, montantAnnuel: montant });
    }
    const f1 = await tiers(c, 'FOURNISSEUR', 'F-PRJ1', 'Papeterie du Centre');
    return { plan, sections, f1 };
  });
  const S = prep?.sections ?? {};
  const v = (code, montant) => (S[code] ? { ventilations: [{ sectionId: S[code], debit: montant }] } : undefined);
  const f1 = prep?.f1;

  /** Une charge du projet et sa neutralisation au 702 (Guide, Partie 3 ch. 3 § 2.2). */
  const charge = async (geste, ex, date, libelle, numeroCharge, montant, contrepartie, section, journal = c.od) => {
    const e = await ecriture(c, geste, ex, date, libelle, [[numeroCharge, montant, 0, v(section, montant)], [contrepartie, 0, montant]], { journal });
    await ecriture(c, `${geste} · neutralisation`, ex, date, `Neutralisation · ${libelle}`, [[F462, montant, 0], [Q702, 0, montant]]);
    return e;
  };

  /** Une immobilisation du projet par le module, puis la ventilation de sa ligne d'acquisition. */
  const immobilisation = async (geste, ex, date, designation, numero, montant, contrepartie, section) => {
    const im = await c.geste(geste, 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, numero), designation, dateAcquisition: date, dateMiseEnService: date,
      valeurOrigine: montant, dureeAmortissementAns: 5, compteContrepartieId: compte(c, contrepartie),
      exerciceId: ex, journalId: c.od.id,
    });
    if (!im) return null;
    const lignes = await lignesDuCompte(c, numero, ex);
    // Le grand livre ne rend pas l'écriture de la ligne · la ligne d'acquisition
    // est celle du montant et du libellé « Acquisition » que le module écrit.
    const ligne = lignes.find((l) => Math.abs(Number(l.debit) - montant) < 0.005 && String(l.libelle ?? '').startsWith('Acquisition'));
    if (ligne && S[section]) {
      await c.geste(`${geste} · ventilation ${section}`, 'POST', `/analytique/lignes/${ligne.id ?? ligne.ligneId}/ventilations`, {
        ventilations: [{ sectionId: S[section], debit: montant }],
      });
    } else {
      R.note(`${geste} · ligne d'acquisition introuvable au grand livre, ventilation non posée`);
    }
    return im;
  };

  // --- Exercice 2026 ---------------------------------------------------------
  await etape(R, '2026 · décaissement du bailleur, équipements, charges', async () => {
    await ecriture(c, 'Décaissement du bailleur 2026', n, '2026-02-01', 'Décaissement FME tranche 1',
      [[BQ, 40_000_000, 0], [F162, 0, 22_000_000], [F462, 0, 18_000_000]], { journal: bq });
    await immobilisation('Pompe de forage', n, '2026-03-15', 'Pompe de forage immergée', '24110000', 15_000_000, FRS_INV, 'R1');
    const paiement = await ecriture(c, 'Paiement du fournisseur d’investissement', n, '2026-04-15', 'Règlement pompe de forage',
      [[FRS_INV, 15_000_000, 0], [BQ, 0, 15_000_000]], { journal: bq });
    const lignes481 = (await lignesDuCompte(c, FRS_INV, n)).map((l) => l.id ?? l.ligneId).filter(Boolean);
    if (lignes481.length === 2) await lettrer(c, FRS_INV, lignes481);
    else R.note(`481 · ${lignes481.length} lignes lues au grand livre, lettrage non posé`);
    await immobilisation('Véhicule de chantier', n, '2026-06-01', 'Pick-up de chantier', '24510000', 6_000_000, BQ, 'R1');
    void paiement;

    if (f1) {
      const fac = await charge('Fournitures (facture F1)', n, '2026-05-10', 'Fournitures de chantier', '60470000', 4_000_000, f1.numero, 'R2', c.journal('ACH') ?? c.od);
      const reg = await ecriture(c, 'Règlement F1', n, '2026-06-10', 'Règlement fournitures', [[f1.numero, 4_000_000, 0], [BQ, 0, 4_000_000]], { journal: bq });
      const l1 = ligneDe(c, fac, f1.numero);
      const l2 = ligneDe(c, reg, f1.numero);
      if (l1 && l2) await lettrer(c, f1.numero, [l1.id, l2.id]);
      await charge('Fournitures de décembre (non payées)', n, '2026-12-15', 'Fournitures de fin d’année', '60470000', 1_000_000, f1.numero, 'R2', c.journal('ACH') ?? c.od);
    }
    await charge('Missions de terrain', n, '2026-07-20', 'Missions de terrain', '61810000', 2_500_000, BQ, 'R3', bq);
    await charge('Entretien des installations', n, '2026-09-30', 'Entretien des installations', '62420000', 3_000_000, BQ, 'R4', bq);
    // Intérêts du dépôt · un produit NON neutralisé, qui fait un solde des
    // opérations de l'exercice (CC) non nul, à affecter en 2027.
    if (I) await ecriture(c, 'Intérêts créditeurs', n, '2026-12-31', 'Intérêts du dépôt à terme', [[BQ, I, 0], ['77470000', 0, I]], { journal: bq });
    await validerJusqua(c, n, '2026-12-31');
  });

  // --- Contrôles 2026 --------------------------------------------------------
  await etape(R, '2026 · contrôles avant clôture', async () => {
    const b = await balance(c, n);
    R.montant('2026 · balance équilibrée (débit moins crédit)', 0, b ? b.totalDebit - b.totalCredit : null);
    R.montant('2026 · solde banque 52110000', 9_500_000 + I, solde(b, BQ));
    R.montant('2026 · solde 162 (fonds d’investissement)', -22_000_000, solde(b, '162'));
    R.montant('2026 · solde 462 (fonds d’administration)', -7_500_000, solde(b, '462'));
    R.montant('2026 · solde fournisseurs 40', -1_000_000, solde(b, '40'));
    R.montant('2026 · solde 481', 0, solde(b, '481'));
    R.montant('2026 · immobilisations classe 2 (brut)', 21_000_000, solde(b, '2'));
    R.montant('2026 · 702 quote-part transférée', -10_500_000, solde(b, '702'));
    await controlesEtatsProjet(c, R, n, '2026', {
      er: { FA: 40_000_000, FD: I, GR: 40_000_000 + I, FI: 15_000_000, FJ: 6_000_000, GS: 21_000_000, FM: 4_000_000, FN: 2_500_000, FO: 3_000_000, GT: 9_500_000, GU: 30_500_000, GV: 9_500_000 + I, GW: 0, GX: 9_500_000 + I, GY: 9_500_000 + I },
      budget: { R1: [22_000_000, 21_000_000, 0], R2: [6_000_000, 4_000_000, 1_000_000], R3: [4_000_000, 2_500_000, 0], R4: [5_000_000, 3_000_000, 0] },
      reconciliation: { A: 0, B: 40_000_000, C: I, F: 30_500_000, G: 9_500_000 + I },
      bilan: { actif: 30_500_000 + I, passif: 30_500_000 + I, postes: { CA: 22_000_000, CC: I, DF: 7_500_000, DG: 1_000_000, BW: 9_500_000 + I } },
      exploitation: { RA: 10_500_000 },
    });
    await relireLiasse(c, R, '2026', `/exports/etats-financiers/liasse-complete?exerciceId=${n}`, { BZ: 30_500_000 + I, DZ: 30_500_000 + I, XC: I });
    await confronterControles(c, R, '2026 · contrôles de clôture', n, CONTROLES_ATTENDUS_2026);
  });

  await etape(R, 'Livres exportés de 2026', () => livresExportes(c, R, n, '2026'));

  const clos = await etape(R, 'Clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) {
    R.note('Projet · 2027 non joué · la clôture de 2026 n’a pas abouti ou l’exercice 2027 manque');
    await etape(R, 'Restitution du dossier', () => restitution(c, R));
    return;
  }

  // --- Exercice 2027 ---------------------------------------------------------
  await etape(R, '2027 · affectation du solde des opérations 2026', async () => {
    const prep = await c.lire('Préparation de l’affectation 2026', `/affectation-resultat/exercice/${n}`);
    R.montant('2026 · résultat à affecter lu par l’affectation', I, prep?.resultat ?? prep?.montant ?? prep?.resultatExercice ?? null);
    if (!I) return;
    await c.geste('Affectation du résultat 2026', 'POST', '/affectation-resultat', {
      exerciceId: n, dateDecision: '2027-03-31', organe: 'Comité de pilotage du projet',
      lignes: [{ compteId: compte(c, '12100000'), montant: I }],
    });
  });

  await etape(R, '2027 · budgets, décaissement, équipement, charges', async () => {
    for (const [code, montant] of [['R1', 5_000_000], ['R2', 1_000_000], ['R3', 4_000_000], ['R4', 7_000_000]]) {
      await c.geste(`Budget 2027 ${code}`, 'POST', `/analytique/sections/${S[code]}/budget`, { exerciceId: n1, montantAnnuel: montant });
    }
    if (f1) {
      const reg = await ecriture(c, 'Règlement F1 de la facture de décembre 2026', n1, '2027-01-20', 'Règlement fournitures de fin d’année',
        [[f1.numero, 1_000_000, 0], [BQ, 0, 1_000_000]], { journal: bq });
      const ouvertes = (await c.lire('Lignes F1 non lettrées', `/comptes/${f1.compteId}/lettrage?nonLettreesSeulement=true`)) ?? [];
      const liste = Array.isArray(ouvertes) ? ouvertes : (ouvertes.lignes ?? []);
      // La liste du compte court sur tous les exercices · la ligne à lettrer en
      // 2027 est l'à-nouveau qui reporte la facture, pas la facture de 2026.
      const an = liste.find((l) => Math.abs(Number(l.credit) - 1_000_000) < 0.005 && String(l.date).slice(0, 4) === '2027');
      const lr = ligneDe(c, reg, f1.numero);
      if (an && lr) await lettrer(c, f1.numero, [an.id, lr.id]);
      else R.note('F1 · à-nouveau ou règlement introuvable, lettrage 2027 non posé');
    }
    await ecriture(c, 'Décaissement du bailleur 2027', n1, '2027-02-15', 'Décaissement FME tranche 2',
      [[BQ, 20_000_000, 0], [F162, 0, 5_000_000], [F462, 0, 15_000_000]], { journal: bq });
    await immobilisation('Ordinateurs du projet', n1, '2027-03-10', 'Ordinateurs portables', '24420000', 4_000_000, BQ, 'R1');
    await charge('Transport de matériel', n1, '2027-04-10', 'Transport de matériel', '61830000', 3_000_000, BQ, 'R3', bq);
    await charge('Maintenance des pompes', n1, '2027-08-31', 'Maintenance des pompes', '62430000', 6_000_000, BQ, 'R4', bq);
    await validerJusqua(c, n1, '2027-12-31');
  });

  await etape(R, '2027 · contrôles avant clôture', async () => {
    const b = await balance(c, n1);
    R.montant('2027 · balance équilibrée', 0, b ? b.totalDebit - b.totalCredit : null);
    R.montant('2027 · solde banque 52110000', 15_500_000 + I, solde(b, BQ));
    R.montant('2027 · report à nouveau 121 après affectation', -I, solde(b, '121'));
    R.montant('2027 · résultat 13 soldé par l’affectation', 0, solde(b, '13'));
    R.montant('2027 · solde 162', -27_000_000, solde(b, '162'));
    R.montant('2027 · solde 462', -13_500_000, solde(b, '462'));
    R.montant('2027 · solde fournisseurs 40', 0, solde(b, '40'));
    R.montant('2027 · immobilisations classe 2 (brut)', 25_000_000, solde(b, '2'));
    await controlesEtatsProjet(c, R, n1, '2027', {
      er: { FA: 20_000_000, FD: 0, GR: 20_000_000, FI: 4_000_000, FJ: 0, GS: 4_000_000, FM: 1_000_000, FN: 3_000_000, FO: 6_000_000, GT: 10_000_000, GU: 14_000_000, GV: 6_000_000, GW: 9_500_000 + I, GX: 15_500_000 + I, GY: 15_500_000 + I },
      erCumulDebut: { GR: 40_000_000 + I, GS: 21_000_000, GT: 9_500_000, GU: 30_500_000, GY: 9_500_000 + I },
      erCumulFin: { GR: 60_000_000 + I, GS: 25_000_000, GT: 19_500_000, GU: 44_500_000, GY: 15_500_000 + I },
      budget: { R1: [5_000_000, 4_000_000, 0], R3: [4_000_000, 3_000_000, 0], R4: [7_000_000, 6_000_000, 0] },
      reconciliation: { A: 9_500_000 + I, B: 20_000_000, C: 0, F: 14_000_000, G: 15_500_000 + I },
      bilan: { actif: 40_500_000 + I, passif: 40_500_000 + I, actifN1: 30_500_000 + I, postes: { CA: 27_000_000, CB: I, CC: 0, DF: 13_500_000, DG: 0, BW: 15_500_000 + I } },
      exploitation: { RA: 9_000_000 },
    });
    await relireLiasse(c, R, '2027', `/exports/etats-financiers/liasse-complete?exerciceId=${n1}`, { BZ: 40_500_000 + I, DZ: 40_500_000 + I, XC: 0 });
    await confronterControles(c, R, '2027 · contrôles de clôture', n1, CONTROLES_ATTENDUS_2027);
  });

  await etape(R, 'Livres exportés de 2027 et restitution', async () => {
    await livresExportes(c, R, n1, '2027');
    await restitution(c, R);
  });

  await etape(R, 'Clôture 2027', () => cloturer(c, '2027'));
  await etape(R, '2028 · à-nouveaux de la clôture de 2027', async () => {
    await rechargerExercices(c);
    const n2 = c.exercices.get('2028')?.id;
    if (!n2) return R.note('2028 absent après la clôture de 2027');
    const b = await balance(c, n2);
    R.montant('2028 · à-nouveau banque', 15_500_000 + I, solde(b, BQ));
    R.montant('2028 · à-nouveau 162', -27_000_000, solde(b, '162'));
    R.montant('2028 · à-nouveau 462', -13_500_000, solde(b, '462'));
  });
}

/** Les quatre états propres au projet, lus contre leurs attendus. */
async function controlesEtatsProjet(c, R, ex, an, att) {
  const er = await c.lire(`Emplois-ressources ${an}`, `/etats-financiers/projet/emplois-ressources?exerciceId=${ex}`);
  if (er) {
    const lignes = er.lignes ?? er.postes ?? [];
    // Un poste peut porter une ligne par bailleur (clé BAILLEUR:…) · on somme.
    const lu = (ref, col) => {
      const ls = lignes.filter((x) => x.ref === ref);
      if (!ls.length) return null;
      const champ = col === 'debut' ? 'montantCumulDebut' : col === 'fin' ? 'montantCumulFin' : 'montant';
      if (ls.some((l) => l[champ] === null || l[champ] === undefined)) return null;
      return ls.reduce((s, l) => s + Number(l[champ]), 0);
    };
    for (const [ref, m] of Object.entries(att.er)) R.montant(`${an} · emplois-ressources ${ref} (exercice)`, m, lu(ref, 'n'));
    for (const [ref, m] of Object.entries(att.erCumulDebut ?? {})) R.montant(`${an} · emplois-ressources ${ref} (cumul début)`, m, lu(ref, 'debut'));
    for (const [ref, m] of Object.entries(att.erCumulFin ?? {})) R.montant(`${an} · emplois-ressources ${ref} (cumul fin)`, m, lu(ref, 'fin'));
  }
  const plans = (await c.lire('Plans analytiques', '/analytique/plans')) ?? [];
  const plan = plans.find((p) => p.code === 'BUD');
  const eb = await c.lire(`Exécution budgétaire ${an}`, `/etats-financiers/projet/execution-budgetaire?exerciceId=${ex}${plan ? `&planId=${plan.id}` : ''}`);
  if (eb) {
    const lignes = eb.lignes ?? eb.sections ?? [];
    for (const [code, [budget, decaisse, engage]] of Object.entries(att.budget)) {
      const l = lignes.find((x) => x.code === code || x.sectionCode === code);
      R.montant(`${an} · exécution budgétaire ${code} · budget`, budget, l?.budget ?? null);
      R.montant(`${an} · exécution budgétaire ${code} · décaissement`, decaisse, l?.decaissement ?? null);
      R.montant(`${an} · exécution budgétaire ${code} · engagement`, engage, l?.engagement ?? null);
      R.montant(`${an} · exécution budgétaire ${code} · crédit disponible`, budget - decaisse - engage, l?.creditDisponible ?? null);
    }
  }
  const rt = await c.lire(`Réconciliation de trésorerie ${an}`, `/etats-financiers/projet/reconciliation-tresorerie?exerciceId=${ex}`);
  if (rt) {
    const lignes = rt.lignes ?? [];
    for (const [rep, m] of Object.entries(att.reconciliation)) {
      const l = lignes.find((x) => x.rep === rep);
      R.montant(`${an} · réconciliation de trésorerie ${rep}`, m, l?.montant ?? null);
    }
  }
  const bilan = await c.lire(`Bilan projet ${an}`, `/etats-financiers/projet/bilan?exerciceId=${ex}`);
  if (bilan) {
    const p = aplatir(bilan);
    R.montant(`${an} · bilan projet · total actif (BZ)`, att.bilan.actif, p.BZ?.n ?? bilan.totalActif ?? null);
    R.montant(`${an} · bilan projet · total passif (DZ)`, att.bilan.passif, p.DZ?.n ?? bilan.totalPassif ?? null);
    if (att.bilan.actifN1 !== undefined) R.montant(`${an} · bilan projet · colonne N-1 total actif`, att.bilan.actifN1, p.BZ?.n1 ?? bilan.totalActifN1 ?? null);
    for (const [ref, m] of Object.entries(att.bilan.postes ?? {})) R.montant(`${an} · bilan projet · poste ${ref}`, m, p[ref]?.n ?? null);
  }
  const ce = await c.lire(`Compte d’exploitation ${an}`, `/etats-financiers/projet/compte-exploitation?exerciceId=${ex}`);
  if (ce) {
    const p = aplatir(ce);
    for (const [ref, m] of Object.entries(att.exploitation)) R.montant(`${an} · compte d’exploitation ${ref}`, m, p[ref]?.n ?? null);
  }
}
