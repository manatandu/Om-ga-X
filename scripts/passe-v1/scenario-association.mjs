/**
 * SCÉNARIO 1 · ASSOCIATION (SYCEBNL, jeu « associations et ordres
 * professionnels »), exercices 2026 (N) et 2027 (N+1).
 *
 * Bilan d'ouverture IMPORTÉ avec une banque en dollars, cotisations à
 * l'APPEL, dons et legs au registre des donateurs, fonds affecté à un projet
 * spécifique et sa reprise (Partie 3 ch. 2 § 1.2.1 · 165 puis 7925),
 * subvention d'investissement et sa reprise (14 puis 799), bien reçu en don
 * (167 puis 7923, § 1.2.2), achats, paie de deux salariés sur deux mois,
 * créance d'adhérent douteuse dépréciée puis éteinte, charge à payer et charge
 * constatée d'avance, réévaluation de la banque en dollars, clôture de 2026,
 * affectation en 2027, opérations de 2027, clôture de 2027.
 *
 * Tous les montants attendus sont calculés à la main dans README.md
 * (section « Association »), poste par poste.
 */
import {
  aplatir, balance, cloturer, compte, ecriture, etape, ligneDe, nouveauDossier,
  rechargerComptes, rechargerExercices, solde, tiers, validerJusqua,
} from './lib.mjs';

const BQ = '52110000';
const BQ_USD = '52150000';
const CAISSE = '57100000';
const PIECES = [{ nature: 'Courrier de relance', reference: 'REL-2026-10', date: '2026-10-15' }];

export async function scenarioAssociation(registre) {
  registre.scenario = 'Association';
  const R = registre;
  const c = await nouveauDossier(R, 'Passe V1 · Association Lumière du Kasaï', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'asso', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const ctx = { immos: {}, creance: null, regul: {}, usd: null };

  // --- Paramètres, devise et reprise -----------------------------------------
  await etape(R, 'Paramètres · méthode des cotisations, devise, cours', async () => {
    await c.geste('Méthode des cotisations (appel)', 'PATCH', '/dossier/methode-cotisations', { methodeCotisations: 'APPEL' });
    const devises = (await c.lire('Devises', '/devises')) ?? [];
    ctx.usd = devises.find((d) => d.code === 'USD') ?? (await c.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
    for (const [date, cours] of [['2026-01-01', 2_800], ['2026-08-15', 2_850], ['2026-12-31', 2_900], ['2027-12-31', 3_000]]) {
      await c.geste(`Cours USD du ${date}`, 'POST', `/devises/${ctx.usd?.id}/cours`, { date, cours, source: 'Banque centrale du Congo (banc passe V1)' });
    }
  });

  await etape(R, 'Reprise · bilan d’ouverture importé au 1er janvier 2026', async () => {
    const lignes = [
      ['52110000', 'Banque en francs', 20_000_000, 0, '', '', ''],
      ['52150000', 'Banque en dollars', 14_000_000, 0, '5000', 'USD', '2800'],
      ['57100000', 'Caisse', 1_000_000, 0, '', '', ''],
      ['40110000', 'Fournisseurs', 0, 2_000_000, '', '', ''],
      ['10110000', 'Dotation', 0, 30_000_000, '', '', ''],
      ['12100000', 'Report à nouveau', 0, 3_000_000, '', '', ''],
    ];
    const csv = ['Compte;Intitule;Debit;Credit;Montant en devise;Devise;Cours', ...lignes.map((l) => l.join(';'))].join('\n');
    await c.geste('Import du bilan d’ouverture', 'POST', '/import/executer', {
      type: 'BALANCE', nomFichier: 'ouverture-2026.csv', contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
      mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit', montantDevise: 'Montant en devise', devise: 'Devise', cours: 'Cours' },
      exerciceId: n, dateOperation: '2026-01-01', bilanDOuverture: true, separateur: ';',
    });
    await validerJusqua(c, n, '2026-01-01');
  });

  const adhA = await tiers(c, 'ADHERENT', 'ADH-A', 'Membres à jour');
  const adhB = await tiers(c, 'ADHERENT', 'ADH-B', 'Membre défaillant');
  const frs = await tiers(c, 'FOURNISSEUR', 'FRS-1', 'Fournitures et énergie du Kasaï');

  /** Un règlement de tiers par le module (Règlement des tiers), lettré aussitôt. */
  const regler = async (geste, sens, ex, date, t, ligneId, montant) => {
    if (!t || !ligneId) return R.note(`${geste} · tiers ou ligne absent, règlement non passé`);
    return c.geste(geste, 'POST', '/reglements', {
      sens, exerciceId: ex, journalId: bq.id, date,
      reglements: [{ compteId: t.compteId, ligneIds: [ligneId], montant }],
    });
  };

  /** Une libéralité au registre des donateurs (art. 17). */
  const registreDon = (geste, date, nature, typeDonateur, identite, montant, modeLiberation, ecritureId, designationNature) =>
    c.geste(geste, 'POST', '/registre-donateurs', {
      dateOperation: date, nature, typeDonateur, ...identite, montant, modeLiberation,
      ...(designationNature ? { designationNature } : {}), ...(ecritureId ? { ecritureId } : {}),
    });

  /** Une immobilisation par le module, linéaire sur cinq ans. */
  const immobilisation = async (geste, ex, date, designation, numero, montant, contrepartie, journal) =>
    c.geste(geste, 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, numero), designation, dateAcquisition: date, dateMiseEnService: date,
      valeurOrigine: montant, dureeAmortissementAns: 5, modeAmortissement: 'LINEAIRE',
      compteContrepartieId: compte(c, contrepartie), exerciceId: ex, journalId: journal.id,
    });

  // --- Exercice 2026 ---------------------------------------------------------
  await etape(R, '2026 · cotisations, fournisseurs, fonds affecté, subvention', async () => {
    const appel = await ecriture(c, 'Appel des cotisations 2026', n, '2026-01-15', 'Appel des cotisations 2026',
      [[adhA.numero, 1_800_000, 0], [adhB.numero, 200_000, 0], ['70100000', 0, 2_000_000]]);
    ctx.appelB = ligneDe(c, appel, adhB.numero)?.id;
    await ecriture(c, 'Règlement du fournisseur repris', n, '2026-01-20', 'Règlement fournisseur (ouverture)', [['40110000', 2_000_000, 0], [BQ, 0, 2_000_000]], { journal: bq });
    await ecriture(c, 'Fonds affecté reçu', n, '2026-02-01', 'Fondation Eau Vive · projet puits', [[BQ, 5_000_000, 0], ['16500000', 0, 5_000_000]], { journal: bq });
    const fac = await ecriture(c, 'Facture FRS-1 fournitures', n, '2026-02-10', 'Fournitures de bureau',
      [['60550000', 1_500_000, 0], [frs.numero, 0, 1_500_000]], { journal: c.journal('ACH') ?? od });
    await regler('Règlement FRS-1 (fournitures)', 'FOURNISSEUR', n, '2026-03-10', frs, ligneDe(c, fac, frs.numero)?.id, 1_500_000);
    // Fiche SYCEBNL du compte 14 · l'octroi crédite le 14 « par le débit […]
    // du compte 4731 Subventions d'équipement à recevoir » ; l'encaissement
    // solde ensuite le 4731 par la trésorerie.
    await c.geste('Octroi de la subvention d’équipement', 'POST', '/immobilisations/subventions-rattachees/octrois', {
      compteSubventionId: compte(c, '14170000'), compteContrepartieId: compte(c, '47310000'), exerciceId: n, journalId: od.id,
      date: '2026-03-01', montant: 6_000_000, reference: 'CONV-ONU-2026-01',
    });
    await ecriture(c, 'Encaissement de la subvention d’équipement', n, '2026-03-15', 'Encaissement subvention ONU', [[BQ, 6_000_000, 0], ['47310000', 0, 6_000_000]], { journal: bq });
    await regler('Encaissement des cotisations ADH-A', 'CLIENT', n, '2026-03-31', adhA, ligneDe(c, appel, adhA.numero)?.id, 1_800_000);
  });

  await etape(R, '2026 · immobilisations, dons, legs, bien reçu en don', async () => {
    ctx.immos.info = await immobilisation('Matériel informatique (subventionné)', n, '2026-04-01', 'Parc informatique', '24420000', 6_000_000, BQ, bq);
    if (ctx.immos.info) {
      await c.geste('Rattachement de la subvention au bien', 'POST', '/immobilisations/subventions-rattachees', {
        compteSubventionId: compte(c, '14170000'), dateOctroi: '2026-03-01', reference: 'CONV-ONU-2026-01',
        lignes: [{ immobilisationId: ctx.immos.info.id, montant: 6_000_000 }],
      });
    }
    const don = await ecriture(c, 'Don de la Fondation', n, '2026-04-10', 'Don Fondation Solidarité', [[BQ, 8_000_000, 0], ['70410000', 0, 8_000_000]], { journal: bq });
    await registreDon('Registre · don de 8 000 000', '2026-04-10', 'DON', 'PERSONNE_MORALE',
      { denomination: 'Fondation Solidarité', numeroImmatriculation: 'RCCM-KIN-2019-B-001', adresseSiegeSocial: 'Kinshasa, Gombe' }, 8_000_000, 'VIREMENT', don?.id);
    const legs = await ecriture(c, 'Legs en numéraire', n, '2026-05-20', 'Legs de feu M. Kabeya', [[BQ, 2_000_000, 0], ['70420000', 0, 2_000_000]], { journal: bq });
    await registreDon('Registre · legs de 2 000 000', '2026-05-20', 'LEGS', 'PERSONNE_PHYSIQUE',
      { nom: 'Kabeya', prenoms: 'Jean', domicile: 'Mbuji-Mayi' }, 2_000_000, 'VIREMENT', legs?.id);
    await ecriture(c, 'Missions du projet puits', n, '2026-06-30', 'Missions du projet puits', [['63840000', 3_000_000, 0], [BQ, 0, 3_000_000]], { journal: bq });
    await ecriture(c, 'Reprise du fonds affecté consommé', n, '2026-06-30', 'Reprise du fonds affecté', [['16500000', 3_000_000, 0], ['79250000', 0, 3_000_000]]);
    ctx.immos.vehicule = await immobilisation('Véhicule reçu en don', n, '2026-07-01', 'Véhicule Toyota Hilux (don)', '24510000', 9_000_000, '16710000', od);
    await registreDon('Registre · véhicule reçu en don', '2026-07-01', 'DON', 'PERSONNE_MORALE',
      { denomination: 'Mission évangélique du Kasaï', numeroImmatriculation: 'F92-1234', adresseSiegeSocial: 'Kananga' }, 9_000_000, 'NATURE',
      ctx.immos.vehicule?.ecritureAcquisitionId, 'Véhicule Toyota Hilux, châssis 1234');
  });

  await etape(R, '2026 · colloque payé en dollars, assurance, créance douteuse', async () => {
    await ecriture(c, 'Colloque réglé en dollars', n, '2026-08-15', 'Colloque régional (1 000 USD)',
      [['62770000', 2_850_000, 0], [BQ_USD, 0, 2_850_000, { deviseId: ctx.usd?.id, montantDevise: 1_000, coursApplique: 2_850 }]]);
    await ecriture(c, 'Assurance multirisque annuelle', n, '2026-10-01', 'Assurance 01/10/2026 au 30/09/2027', [['62510000', 3_650_000, 0], [BQ, 0, 3_650_000]], { journal: bq });
    ctx.creance = await c.geste('Reclassement de la créance de ADH-B', 'POST', '/creances-douteuses', {
      motif: 'Membre relancé trois fois sans réponse, cotisation 2026 impayée', pieces: PIECES,
      exerciceId: n, journalId: od.id, date: '2026-10-31', compteCreanceId: adhB.compteId, nature: 'DOUTEUSE', montant: 200_000,
    });
  });

  await etape(R, '2026 · paie de novembre et décembre, deux salariés', async () => {
    ctx.salaries = [];
    for (const [nom, salaire, classe] of [['MUKENDI', 1_500_000, 6], ['ILUNGA', 900_000, 1]]) {
      const s = await c.geste(`Salarié ${nom}`, 'POST', '/personnel/salaries', { nom, sexe: 'MASCULIN', nationalite: 'congolaise' });
      if (!s) continue;
      await c.geste(`Contrat ${nom}`, 'POST', `/personnel/salaries/${s.id}/contrats`, {
        type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-11-01', natureTravail: 'Animateur', classeProfessionnelle: classe,
        periodiciteRemuneration: 'MOIS', remunerationBase: salaire, deviseRemuneration: 'CDF',
      });
      ctx.salaries.push({ id: s.id, nom, salaire });
    }
    for (const mois of ['2026-11', '2026-12']) {
      for (const s of ctx.salaries) {
        await c.geste(`Bulletin ${s.nom} ${mois}`, 'POST', `/personnel/salaries/${s.id}/bulletins`, {
          moisDePaie: mois, elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: s.salaire }],
          natureEmployeurInpp: 'PRIVE', effectif: 2, regimeSalarial: 'BAREME_ARTICLE_118',
        });
      }
      const fin = mois === '2026-11' ? '2026-11-30' : '2026-12-31';
      await c.geste(`Passation de la paie ${mois}`, 'POST', `/personnel/paie-du-mois/${mois}/comptabilisation`, { exerciceId: n, journalId: od.id, date: fin });
      await ecriture(c, `Paiement des nets ${mois}`, n, fin, `Salaires nets ${mois}`, [['42200000', 1_976_900, 0], [BQ, 0, 1_976_900]], { journal: bq });
    }
    await ecriture(c, 'Versement des retenues et cotisations de novembre', n, '2026-12-15', 'CNSS, IRPP et ONEM de novembre', [
      ['43110000', 156_000, 0], ['43120000', 36_000, 0], ['43210000', 240_000, 0], ['44720000', 303_100, 0], ['44280000', 12_000, 0], [BQ, 0, 747_100],
    ], { journal: bq });
  });

  await etape(R, '2026 · travaux de clôture (régularisations, dotations, reprises, revue, réévaluation)', async () => {
    ctx.regul.cap = await c.geste('Charge à payer · électricité de décembre', 'POST', '/regularisations', {
      exerciceId: n, type: 'CHARGE_A_PAYER', libelle: 'Électricité de décembre 2026', compteChargeProduitId: compte(c, '60520000'),
      montantTotal: 300_000, periodeDebut: '2026-12-01', periodeFin: '2026-12-31', natureTiers: 'FOURNISSEURS', journalId: od.id,
    });
    ctx.regul.cca = await c.geste('Charge constatée d’avance · assurance', 'POST', '/regularisations', {
      exerciceId: n, type: 'CHARGE_CONSTATEE_AVANCE', libelle: 'Assurance du 01/10/2026 au 30/09/2027', compteChargeProduitId: compte(c, '62510000'),
      montantTotal: 3_650_000, periodeDebut: '2026-10-01', periodeFin: '2027-09-30', journalId: od.id,
    });
    for (const [cle, im] of Object.entries(ctx.immos)) {
      if (!im) continue;
      await c.geste(`Dotation 2026 · ${cle}`, 'POST', `/immobilisations/${im.id}/dotation`, { exerciceId: n, journalId: od.id });
      await c.geste(`Reprise du fonds 2026 · ${cle}`, 'POST', `/immobilisations/${im.id}/reprise-subvention`, { exerciceId: n, journalId: od.id });
    }
    if (ctx.creance) {
      await c.geste('Revue 2026 de la créance douteuse', 'POST', `/creances-douteuses/${ctx.creance.id}/revue`, {
        motif: 'Dépréciation à 50 % · membre injoignable, promesse orale de paiement partiel', pieces: PIECES,
        exerciceId: n, journalId: od.id, depreciationNecessaire: 100_000,
      });
    }
    await validerJusqua(c, n, '2026-12-31');
    ctx.reeval26 = await c.geste('Réévaluation des devises au 31/12/2026', 'POST', '/devises/reevaluation', { exerciceId: n });
    await validerJusqua(c, n, '2026-12-31');
  });

  // --- Contrôles 2026 --------------------------------------------------------
  await etape(R, '2026 · contrôles avant clôture', async () => {
    await rechargerComptes(c);
    const b = await balance(c, n);
    R.montant('2026 · balance équilibrée', 0, b ? b.totalDebit - b.totalCredit : null);
    const att = {
      [BQ]: 21_949_100, [BQ_USD]: 11_600_000, [CAISSE]: 1_000_000, '2442': 6_000_000, '2451': 9_000_000, '284': -1_800_000,
      '411': 0, '4161': 200_000, '491': -100_000, '476': 2_730_000, '4731': 0, '40': -300_000, '408': -300_000, '422': 0,
      '4311': -156_000, '4312': -36_000, '4321': -240_000, '4472': -303_100, '4428': -180_000,
      '1417': -5_100_000, '1671': -8_100_000, '165': -2_000_000, '101': -30_000_000, '121': -3_000_000,
      '701': -2_000_000, '7041': -8_000_000, '7042': -2_000_000, '7925': -3_000_000, '799': -900_000, '7923': -900_000, '776': -450_000,
      '6055': 1_500_000, '6384': 3_000_000, '6277': 2_850_000, '6052': 300_000, '6251': 920_000,
      '6611': 4_800_000, '6641': 624_000, '6415': 168_000, '6413': 24_000, '6594': 100_000, '6813': 1_800_000,
    };
    for (const [racine, m] of Object.entries(att)) R.montant(`2026 · solde ${racine}`, m, solde(b, racine));
    R.montant('2026 · résultat (classes 6 à 8, produits moins charges)', 1_164_000, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));

    const bilan = await c.lire('Bilan 2026', `/etats-financiers/bilan?exerciceId=${n}`);
    R.montant('2026 · bilan · total actif', 50_579_100, bilan?.totalActif);
    R.montant('2026 · bilan · total passif', 50_579_100, bilan?.totalPassif);
    const cr = await c.lire('Compte de résultat 2026', `/etats-financiers/compte-de-resultat?exerciceId=${n}`);
    R.montant('2026 · compte de résultat · total des produits', 17_250_000, cr?.totalProduits);
    R.montant('2026 · compte de résultat · total des charges', 16_086_000, cr?.totalCharges);
    R.montant('2026 · compte de résultat · résultat net', 1_164_000, cr?.resultatNet);
    const tft = await c.lire('Flux de trésorerie 2026', `/etats-financiers/tableau-flux-tresorerie?exerciceId=${n}`);
    const f = aplatir(tft);
    R.montant('2026 · TFT · trésorerie au 1er janvier (ZA)', 35_000_000, f.ZA?.n);
    R.montant('2026 · TFT · variation (ZF)', -450_900, f.ZF?.n);
    R.montant('2026 · TFT · trésorerie au 31 décembre (ZG)', 34_549_100, f.ZG?.n);
    ctx.bilan26 = bilan;
    ctx.cr26 = cr;

    const notes = await c.lire('Notes annexes 2026', `/notes-annexes/associations?exerciceId=${n}`);
    const totalNote = (code, cle) => (notes?.notes ?? []).filter((x) => x.code === code).flatMap((x) => x.lignes ?? []).find((l) => /TOTAL GENERAL/i.test(l.libelle ?? ''))?.valeurs?.[cle];
    R.montant('2026 · note 5B · immobilisations brutes, acquisitions', 15_000_000, totalNote('5B', 'AUGMENTATIONS'));
    R.montant('2026 · note 5B · immobilisations brutes à la clôture', 15_000_000, totalNote('5B', 'CLOTURE'));

    const rapport = await c.lire('Registre des donateurs · rapport', `/registre-donateurs/rapport-conformite?exerciceId=${n}`);
    R.montant('2026 · registre des donateurs · total inscrit', 19_000_000, rapport?.rapprochement?.totalRegistre);
    R.montant('2026 · registre des donateurs · total comptabilisé', 19_000_000, rapport?.rapprochement?.totalComptable);
  });

  const clos = await etape(R, 'Clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) {
    R.note('Association · 2027 non joué · la clôture de 2026 n’a pas abouti ou l’exercice 2027 manque');
    return;
  }

  // --- Exercice 2027 ---------------------------------------------------------
  await etape(R, '2027 · à-nouveaux, reprises d’ouverture, affectation', async () => {
    const b = await balance(c, n1);
    // Une situation au 1er trimestre, avant l'assemblée · le résultat 2026 non
    // encore affecté reste au 13, et le bilan doit le porter.
    const situation = await c.lire('Bilan 2027 avant affectation', `/etats-financiers/bilan?exerciceId=${n1}`);
    R.montant('2027 · bilan avant affectation · actif moins passif', 0, situation ? situation.totalActif - situation.totalPassif : null);
    R.montant('2027 · à-nouveau banque en francs', 21_949_100, solde(b, BQ));
    R.montant('2027 · à-nouveau banque en dollars', 11_600_000, solde(b, BQ_USD));
    R.montant('2027 · à-nouveau résultat 2026 au 13', -1_164_000, solde(b, '13'));
    for (const [cle, r] of Object.entries(ctx.regul)) {
      if (r) await c.geste(`Reprise à l’ouverture · ${cle}`, 'POST', `/regularisations/${r.id}/reprise`, { exerciceCibleId: n1 });
    }
    const prep = await c.lire('Préparation de l’affectation 2026', `/affectation-resultat/exercice/${n}`);
    R.montant('2026 · résultat lu par l’affectation', 1_164_000, prep?.resultat ?? prep?.montant ?? null);
    await c.geste('Affectation du résultat 2026', 'POST', '/affectation-resultat', {
      exerciceId: n, dateDecision: '2027-06-30', organe: 'Assemblée générale ordinaire',
      lignes: [{ compteId: compte(c, '12100000'), montant: 1_164_000 }],
    });
  });

  await etape(R, '2027 · opérations de l’exercice', async () => {
    await ecriture(c, 'Versement des retenues et cotisations de décembre', n1, '2027-01-15', 'CNSS, IRPP, INPP et ONEM de décembre', [
      ['43110000', 156_000, 0], ['43120000', 36_000, 0], ['43210000', 240_000, 0], ['44720000', 303_100, 0], ['44280000', 180_000, 0], [BQ, 0, 915_100],
    ], { journal: bq });
    const fac = await ecriture(c, 'Facture d’électricité de décembre 2026', n1, '2027-01-20', 'Électricité décembre 2026',
      [['60520000', 300_000, 0], [frs.numero, 0, 300_000]], { journal: c.journal('ACH') ?? od });
    await regler('Règlement FRS-1 (électricité)', 'FOURNISSEUR', n1, '2027-02-10', frs, ligneDe(c, fac, frs.numero)?.id, 300_000);
    const appel = await ecriture(c, 'Appel des cotisations 2027', n1, '2027-01-31', 'Appel des cotisations 2027', [[adhA.numero, 2_200_000, 0], ['70100000', 0, 2_200_000]]);
    await regler('Encaissement des cotisations 2027', 'CLIENT', n1, '2027-03-31', adhA, ligneDe(c, appel, adhA.numero)?.id, 2_200_000);
    const don = await ecriture(c, 'Don 2027', n1, '2027-04-15', 'Don Fondation Solidarité 2027', [[BQ, 1_500_000, 0], ['70410000', 0, 1_500_000]], { journal: bq });
    await registreDon('Registre · don de 1 500 000', '2027-04-15', 'DON', 'PERSONNE_MORALE',
      { denomination: 'Fondation Solidarité', numeroImmatriculation: 'RCCM-KIN-2019-B-001', adresseSiegeSocial: 'Kinshasa, Gombe' }, 1_500_000, 'VIREMENT', don?.id);
    await ecriture(c, 'Missions du projet puits 2027', n1, '2027-05-31', 'Missions du projet puits (fin)', [['63840000', 2_000_000, 0], [BQ, 0, 2_000_000]], { journal: bq });
    await ecriture(c, 'Reprise du solde du fonds affecté', n1, '2027-05-31', 'Reprise du fonds affecté (solde)', [['16500000', 2_000_000, 0], ['79250000', 0, 2_000_000]]);
    if (ctx.creance) {
      await c.geste('Recouvrement partiel de la créance douteuse', 'POST', `/creances-douteuses/${ctx.creance.id}/recouvrement`, {
        motif: 'Versement partiel du membre', pieces: [{ nature: 'Bordereau de versement', reference: 'BV-2027-06', date: '2027-06-30' }],
        exerciceId: n1, journalId: bq.id, date: '2027-06-30', montant: 50_000,
      });
      await c.geste('Perte sur la créance douteuse', 'POST', `/creances-douteuses/${ctx.creance.id}/perte`, {
        motif: 'Membre radié, créance définitivement irrécouvrable', pieces: [{ nature: 'Procès-verbal du bureau', reference: 'PV-2027-09', date: '2027-09-30' }],
        exerciceId: n1, journalId: od.id, date: '2027-09-30', montant: 150_000,
      });
    }
    for (const [cle, im] of Object.entries(ctx.immos)) {
      if (!im) continue;
      await c.geste(`Dotation 2027 · ${cle}`, 'POST', `/immobilisations/${im.id}/dotation`, { exerciceId: n1, journalId: od.id });
      await c.geste(`Reprise du fonds 2027 · ${cle}`, 'POST', `/immobilisations/${im.id}/reprise-subvention`, { exerciceId: n1, journalId: od.id });
    }
    if (ctx.creance) {
      await c.geste('Revue 2027 de la créance douteuse', 'POST', `/creances-douteuses/${ctx.creance.id}/revue`, {
        motif: 'Créance éteinte · dépréciation sans objet', pieces: [{ nature: 'Procès-verbal du bureau', reference: 'PV-2027-09', date: '2027-09-30' }],
        exerciceId: n1, journalId: od.id, depreciationNecessaire: 0,
      });
    }
    await validerJusqua(c, n1, '2027-12-31');
    await c.geste('Réévaluation des devises au 31/12/2027', 'POST', '/devises/reevaluation', { exerciceId: n1 });
    await validerJusqua(c, n1, '2027-12-31');
  });

  await etape(R, '2027 · contrôles avant clôture', async () => {
    const b = await balance(c, n1);
    R.montant('2027 · balance équilibrée', 0, b ? b.totalDebit - b.totalCredit : null);
    const att = {
      [BQ]: 22_484_000, [BQ_USD]: 12_000_000, [CAISSE]: 1_000_000, '284': -4_800_000, '411': 0, '4161': 0, '491': 0,
      '476': 0, '40': 0, '408': 0, '43': 0, '447': 0, '4428': 0, '1417': -3_900_000, '1671': -6_300_000, '165': 0,
      '121': -4_164_000, '13': 0,
      '701': -2_200_000, '7041': -1_500_000, '7925': -2_000_000, '799': -1_200_000, '7923': -1_800_000, '7594': -100_000, '776': -400_000,
      '6052': 0, '6251': 2_730_000, '6384': 2_000_000, '6512': 150_000, '6813': 3_000_000,
    };
    for (const [racine, m] of Object.entries(att)) R.montant(`2027 · solde ${racine}`, m, solde(b, racine));
    R.montant('2027 · résultat (classes 6 à 8)', 1_320_000, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));
    const bilan = await c.lire('Bilan 2027', `/etats-financiers/bilan?exerciceId=${n1}`);
    R.montant('2027 · bilan · total actif', 45_684_000, bilan?.totalActif);
    R.montant('2027 · bilan · total passif', 45_684_000, bilan?.totalPassif);
    R.montant('2027 · bilan · colonne N-1 · total actif = bilan 2026', 50_579_100, bilan?.totalActifN1);
    R.montant('2027 · bilan · colonne N-1 · total passif = bilan 2026', 50_579_100, bilan?.totalPassifN1);
    const cr = await c.lire('Compte de résultat 2027', `/etats-financiers/compte-de-resultat?exerciceId=${n1}`);
    R.montant('2027 · compte de résultat · résultat net', 1_320_000, cr?.resultatNet);
    R.montant('2027 · compte de résultat · colonne N-1 · résultat net = 2026', 1_164_000, cr?.resultatNetN1);
    R.montant('2027 · compte de résultat · colonne N-1 · produits = 2026', 17_250_000, cr?.totalProduitsN1);
    const tft = await c.lire('Flux de trésorerie 2027', `/etats-financiers/tableau-flux-tresorerie?exerciceId=${n1}`);
    const f = aplatir(tft);
    R.montant('2027 · TFT · trésorerie au 1er janvier (ZA)', 34_549_100, f.ZA?.n);
    R.montant('2027 · TFT · variation (ZF)', 934_900, f.ZF?.n);
    R.montant('2027 · TFT · trésorerie au 31 décembre (ZG)', 35_484_000, f.ZG?.n);
    R.montant('2027 · TFT · colonne N-1 · trésorerie au 31 décembre 2026', 34_549_100, f.ZG?.n1);
    const notes = await c.lire('Notes annexes 2027', `/notes-annexes/associations?exerciceId=${n1}`);
    const totalNote = (code, cle) => (notes?.notes ?? []).filter((x) => x.code === code).flatMap((x) => x.lignes ?? []).find((l) => /TOTAL GENERAL/i.test(l.libelle ?? ''))?.valeurs?.[cle];
    R.montant('2027 · note 5B · immobilisations brutes à l’ouverture', 15_000_000, totalNote('5B', 'OUVERTURE'));
    R.montant('2027 · note 5B · immobilisations brutes à la clôture', 15_000_000, totalNote('5B', 'CLOTURE'));
    const rapport = await c.lire('Registre des donateurs · rapport 2027', `/registre-donateurs/rapport-conformite?exerciceId=${n1}`);
    R.montant('2027 · registre des donateurs · total inscrit', 1_500_000, rapport?.rapprochement?.totalRegistre);
    R.montant('2027 · registre des donateurs · total comptabilisé', 1_500_000, rapport?.rapprochement?.totalComptable);
  });

  await etape(R, 'Clôture 2027', () => cloturer(c, '2027'));
  await etape(R, '2028 · à-nouveaux de la clôture de 2027', async () => {
    await rechargerExercices(c);
    const n2 = c.exercices.get('2028')?.id;
    if (!n2) return R.note('2028 absent après la clôture de 2027');
    const b = await balance(c, n2);
    R.montant('2028 · à-nouveau banque en francs', 22_484_000, solde(b, BQ));
    R.montant('2028 · à-nouveau résultat 2027 au 13', -1_320_000, solde(b, '13'));
    R.montant('2028 · à-nouveau report à nouveau', -4_164_000, solde(b, '121'));
  });
}
