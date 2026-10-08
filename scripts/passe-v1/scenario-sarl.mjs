/**
 * SCÉNARIO 3 · SARL (SYSCOHADA, système normal, assujettie à la TVA),
 * exercices 2026 (N) et 2027 (N+1).
 *
 * Bilan d'ouverture importé (stock de marchandises compris), factures de vente
 * et d'achat avec TVA à 16 % par le module de facturation, acompte client
 * imputé et lettré en partiel, facture en dollars réglée en partie en 2026 et
 * le reste en 2027 (écart de change réalisé, réévaluation et extourne), stocks
 * en inventaire intermittent (campagne d'inventaire, variation proposée),
 * acquisition et cession d'un véhicule, paie de deux mois, déclaration et
 * liquidation de la TVA de janvier et février, résultat fiscal, acomptes et
 * écriture d'impôt, clôture, liasse, puis 2027 avec l'affectation du résultat
 * (réserve légale).
 *
 * Attendus calculés à la main · README.md, section « SARL ».
 */
import {
  aplatir, balance, cloturer, compte, ecriture, etape, ligneDe, lettrer, nouveauDossier,
  livresExportes, rechargerComptes, rechargerExercices, restitution, solde, tiers, validerJusqua,
} from './lib.mjs';

const BQ = '52110000';
const VENTES = '70110000';
const EXPORT = '70120000';
const ACHATS = '60110000';
const STOCK = '31110000';

export async function scenarioSarl(registre) {
  registre.scenario = 'SARL';
  const R = registre;
  const c = await nouveauDossier(R, 'Passe V1 · Kivu Distribution SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'sarl', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const ven = c.journal('VEN') ?? od;
  const ach = c.journal('ACH') ?? od;
  const ctx = {};
  /** L'exercice d'une date · 2026 ou 2027. */
  const ex = (date) => c.exercices.get(date.slice(0, 4))?.id;

  await etape(R, 'Paramètres · forme, TVA, stocks, devise', async () => {
    await c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await c.geste('Assujettissement à la TVA', 'PATCH', '/dossier/regime', { assujettiTva: true, reponseAssujettissementTva: 'OUI', venteBiensServices: 'OUI' });
    await c.geste('Inventaire intermittent', 'PATCH', '/dossier/methode-inventaire-stocks', { methodeInventaireStocks: 'INTERMITTENT' });
    const taux = (await c.lire('Taux de TVA', '/taux-tva')) ?? [];
    ctx.tva16 = taux.find((t) => t.code === 'TVA16');
    const devises = (await c.lire('Devises', '/devises')) ?? [];
    ctx.usd = devises.find((d) => d.code === 'USD') ?? (await c.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
    for (const [date, cours] of [['2026-09-10', 2_850], ['2026-11-10', 2_880], ['2026-12-31', 2_900], ['2027-03-10', 2_950], ['2027-12-31', 3_000]]) {
      await c.geste(`Cours USD du ${date}`, 'POST', `/devises/${ctx.usd?.id}/cours`, { date, cours, source: 'Banque centrale du Congo (banc passe V1)' });
    }
  });

  await etape(R, 'Reprise · bilan d’ouverture importé au 1er janvier 2026', async () => {
    const lignes = [
      [BQ, 'Banque', 30_000_000, 0], [STOCK, 'Marchandises', 8_000_000, 0],
      ['40110000', 'Fournisseurs', 0, 8_000_000], ['10130000', 'Capital', 0, 25_000_000], ['12100000', 'Report à nouveau', 0, 5_000_000],
    ];
    const csv = ['Compte;Intitule;Debit;Credit', ...lignes.map((l) => l.join(';'))].join('\n');
    await c.geste('Import du bilan d’ouverture', 'POST', '/import/executer', {
      type: 'BALANCE', nomFichier: 'ouverture-2026.csv', contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
      mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
      exerciceId: n, dateOperation: '2026-01-01', bilanDOuverture: true, separateur: ';',
    });
    await validerJusqua(c, n, '2026-01-01');
  });

  const c1 = await tiers(c, 'CLIENT', 'C1', 'Mines du Sud');
  const c2 = await tiers(c, 'CLIENT', 'C2', 'Lusaka Trading Ltd');
  const f1 = await tiers(c, 'FOURNISSEUR', 'F1', 'Grossiste de Kinshasa');
  const c3 = await tiers(c, 'CLIENT', 'C3', 'Quincaillerie du Lac');

  /**
   * Une facture par le module de facturation, puis sa comptabilisation. UNE
   * FACTURE REÇUE DANS LE FUTUR NE SE DÉCLARE PAS REÇUE · le module refuse une
   * date de réception postérieure à aujourd'hui, et 2027 est encore à venir
   * le jour où le banc est écrit (2026-10-08). L'achat se saisit alors au
   * journal des achats, ligne de TVA portant son taux, comme le ferait le
   * cabinet sans le module · les attendus ne changent pas.
   */
  const facture = async (geste, sens, numero, date, t, ht, compteGestion, journal) => {
    const tva = Math.round(ht * 0.16 * 100) / 100;
    if (sens === 'ACHAT' && date > new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)) {
      R.note(`${geste} · reçue le ${date}, date à venir · saisie au journal des achats au lieu du module de facturation`);
      const e = await ecriture(c, geste, ex(date), date, `Facture ${numero}`, [
        [compteGestion, ht, 0], ['44520000', tva, 0, { tauxTvaId: ctx.tva16?.id }], [t.numero, 0, ht + tva],
      ], { journal, reference: numero });
      return { ecritureId: e?.id, ligneTiersId: ligneDe(c, e, t.numero)?.id, ttc: ht + tva };
    }
    const f = await c.geste(geste, 'POST', '/facturation', {
      // Une facture reçue s'enregistre à sa date de réception (AUDCIF art. 16, al. 2).
      sens, numeroSerie: numero, dateFacture: date, ...(sens === 'ACHAT' ? { dateReception: date } : {}),
      tiersId: t?.id, contrepartieAdresse: 'Kinshasa, Gombe', autresImpotsEtTaxes: 0,
      lignes: [{ designation: sens === 'VENTE' ? 'Ciment gris 50 kg' : 'Ciment gris 50 kg (achat)', quantite: ht / 50_000, prixUnitaire: 50_000, montantHT: ht, imposable: true, tauxTvaId: ctx.tva16?.id, tauxApplique: 16, montantTva: tva }],
    });
    if (!f) return null;
    const cp = await c.geste(`${geste} · comptabilisation`, 'POST', `/facturation/${f.id}/comptabiliser`, { journalId: journal.id, compteGestionId: compte(c, compteGestion) });
    if (!cp) return null;
    const lignes = (await c.lire(`${geste} · lignes du tiers`, `/comptes/${t.compteId}/lettrage?nonLettreesSeulement=true`))?.lignes ?? [];
    const ttc = ht + tva;
    const l = lignes.find((x) => Math.abs((sens === 'VENTE' ? Number(x.debit) : Number(x.credit)) - ttc) < 0.005 && String(x.date).slice(0, 10) === date);
    return { facture: f, ecritureId: cp.ecritureId, ligneTiersId: l?.id, ttc };
  };

  const regler = (geste, sens, ex, date, t, ligneId, montant, extra = {}) => {
    if (!t || !ligneId) return R.note(`${geste} · tiers ou ligne absent, règlement non passé`);
    return c.geste(geste, 'POST', '/reglements', {
      sens, exerciceId: ex, journalId: bq.id, date,
      reglements: [{ compteId: t.compteId, ligneIds: [ligneId], ...(montant !== undefined ? { montant } : {}), ...extra }],
    });
  };

  // --- Exercice 2026 ---------------------------------------------------------
  await etape(R, '2026 · janvier et février · achats, ventes, acompte client', async () => {
    await ecriture(c, 'Règlement du fournisseur repris', n, '2026-01-10', 'Règlement fournisseur (ouverture)', [['40110000', 8_000_000, 0], [BQ, 0, 8_000_000]], { journal: bq });
    ctx.a1 = await facture('Facture d’achat A1', 'ACHAT', 'FA-001', '2026-01-10', f1, 4_000_000, ACHATS, ach);
    await ecriture(c, 'Acompte reçu du client C1', n, '2026-01-15', 'Acompte sur commande ciment', [[BQ, 2_320_000, 0], ['41910000', 0, 2_320_000]], { journal: bq });
    ctx.v1 = await facture('Facture de vente V1', 'VENTE', 'FV-001', '2026-01-25', c1, 5_000_000, VENTES, ven);
    const imput = await ecriture(c, 'Imputation de l’acompte sur V1', n, '2026-01-25', 'Imputation acompte sur FV-001', [['41910000', 2_320_000, 0], [c1.numero, 0, 2_320_000]]);
    const li = ligneDe(c, imput, c1.numero);
    if (ctx.v1?.ligneTiersId && li) ctx.lettrageV1 = await lettrer(c, c1.numero, [ctx.v1.ligneTiersId, li.id], true);
    await regler('Règlement A1', 'FOURNISSEUR', n, '2026-02-10', f1, ctx.a1?.ligneTiersId, 4_640_000);
    ctx.a2 = await facture('Facture d’achat A2', 'ACHAT', 'FA-002', '2026-02-12', f1, 3_000_000, ACHATS, ach);
    const p2 = await ecriture(c, 'Règlement partiel de V1 par C1', n, '2026-02-20', 'Règlement partiel FV-001', [[BQ, 2_480_000, 0], [c1.numero, 0, 2_480_000]], { journal: bq });
    const lp2 = ligneDe(c, p2, c1.numero);
    // Le lettrage ne rend pas son identifiant · on le relit sur la ligne de V1.
    const lu = (await c.lire('Lignes de C1', `/comptes/${c1.compteId}/lettrage`)) ?? {};
    const lettrageId = (lu.lignes ?? []).find((l) => l.id === ctx.v1?.ligneTiersId)?.lettrageId;
    if (lettrageId && lp2) {
      await c.geste('Lettrage partiel complété (V1)', 'POST', `/comptes/${c1.compteId}/lettrage/${lettrageId}/completer`, { ligneIds: [lp2.id] });
    } else R.note('Lettrage partiel de V1 · groupe ou ligne introuvable, complément non posé');
    ctx.v2 = await facture('Facture de vente V2', 'VENTE', 'FV-002', '2026-02-20', c1, 6_000_000, VENTES, ven);
    await validerJusqua(c, n, '2026-02-28');
  });

  await etape(R, '2026 · TVA de janvier et février · déclaration et liquidation', async () => {
    for (const [debut, fin, collecte, deductible, paiement] of [
      ['2026-01-01', '2026-01-31', 800_000, 640_000, '2026-02-15'],
      ['2026-02-01', '2026-02-28', 960_000, 480_000, '2026-03-15'],
    ]) {
      const d = await c.lire(`Déclaration de TVA ${debut.slice(0, 7)}`, `/taux-tva/declaration?dateDebut=${debut}&dateFin=${fin}`);
      R.montant(`TVA ${debut.slice(0, 7)} · collectée`, collecte, d?.totalCollecte);
      R.montant(`TVA ${debut.slice(0, 7)} · déductible`, deductible, d?.totalDeductibleAdmise ?? d?.totalDeductible);
      R.montant(`TVA ${debut.slice(0, 7)} · net à payer`, collecte - deductible, d?.net);
      await c.geste(`Liquidation de la TVA ${debut.slice(0, 7)}`, 'POST', '/taux-tva/declaration/comptabiliser', { exerciceId: n, dateDebut: debut, dateFin: fin, date: fin });
      await validerJusqua(c, n, fin);
      await ecriture(c, `Paiement de la TVA ${debut.slice(0, 7)}`, n, paiement, `TVA ${debut.slice(0, 7)}`, [['44410000', collecte - deductible, 0], [BQ, 0, collecte - deductible]], { journal: bq });
    }
  });

  await etape(R, '2026 · mars à décembre · règlements, ventes, dollars, véhicule, paie', async () => {
    await regler('Règlement A2', 'FOURNISSEUR', n, '2026-03-15', f1, ctx.a2?.ligneTiersId, 3_480_000);
    // FACTURE ANNULÉE · V5 de mars, commande annulée par le client, corrigée
    // en avril par inscription en négatif (AUDCIF art. 20, al. 2). Attendu
    // avec la ligne `tva-decisions` (point A) · le négatif d'une facture se
    // lit à la date de la facture corrigée, mars ne déclare rien et avril non
    // plus. La facture et son négatif se lettrent entre eux.
    ctx.v5 = await facture('Facture de vente V5 (annulée ensuite)', 'VENTE', 'FV-005', '2026-03-05', c1, 1_000_000, VENTES, ven);
    await validerJusqua(c, n, '2026-03-31');
    if (ctx.v5?.ecritureId) {
      const neg = await c.geste('Inscription en négatif de V5', 'POST', `/ecritures/${ctx.v5.ecritureId}/correction`, {
        date: '2026-04-10', motifCorrection: 'Commande annulée par le client · facture FV-005 annulée',
      });
      await validerJusqua(c, n, '2026-04-30');
      const ouvertes = (await c.lire('Lignes ouvertes de C1 (V5)', `/comptes/${c1.compteId}/lettrage?nonLettreesSeulement=true`))?.lignes ?? [];
      const negatif = ouvertes.find((l) => String(l.date).slice(0, 10) === '2026-04-10' && Math.abs(Number(l.debit) + 1_160_000) < 0.005);
      if (neg && negatif && ctx.v5.ligneTiersId) await lettrer(c, c1.numero, [ctx.v5.ligneTiersId, negatif.id]);
      else R.note('V5 · ligne négative introuvable au compte du client, lettrage non posé');
    }
    for (const [debut, fin] of [['2026-03-01', '2026-03-31'], ['2026-04-01', '2026-04-30']]) {
      const d = await c.lire(`Déclaration de TVA ${debut.slice(0, 7)}`, `/taux-tva/declaration?dateDebut=${debut}&dateFin=${fin}`);
      R.montant(`TVA ${debut.slice(0, 7)} · collectée (V5 annulée, correction attendue « tva-decisions » point A)`, 0, d?.totalCollecte);
    }
    // CRÉANCE DOUTEUSE AVEC TVA · V6 jamais payée.
    ctx.v6 = await facture('Facture de vente V6 (impayée)', 'VENTE', 'FV-006', '2026-05-15', c3, 2_000_000, VENTES, ven);
    await regler('Encaissement V2', 'CLIENT', n, '2026-03-20', c1, ctx.v2?.ligneTiersId, 6_960_000);
    ctx.vehicule = await c.geste('Acquisition du véhicule utilitaire', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24510000'), designation: 'Camion Isuzu NPR', dateAcquisition: '2026-04-01', dateMiseEnService: '2026-04-01',
      valeurOrigine: 24_000_000, dureeAmortissementAns: 4, modeAmortissement: 'LINEAIRE', compteContrepartieId: compte(c, BQ), exerciceId: n, journalId: bq.id,
    });
    ctx.a3 = await facture('Facture d’achat A3', 'ACHAT', 'FA-003', '2026-06-10', f1, 6_000_000, ACHATS, ach);
    await regler('Règlement A3', 'FOURNISSEUR', n, '2026-07-10', f1, ctx.a3?.ligneTiersId, 6_960_000);
    ctx.v3 = await facture('Facture de vente V3', 'VENTE', 'FV-003', '2026-07-15', c1, 8_000_000, VENTES, ven);
    await regler('Encaissement V3', 'CLIENT', n, '2026-08-15', c1, ctx.v3?.ligneTiersId, 9_280_000);
    const vusd = await ecriture(c, 'Vente à l’export en dollars', n, '2026-09-10', 'Export ciment Lusaka (10 000 USD)',
      [[c2.numero, 28_500_000, 0, { deviseId: ctx.usd?.id, montantDevise: 10_000, coursApplique: 2_850 }], [EXPORT, 0, 28_500_000]], { journal: ven });
    ctx.ligneUsd = ligneDe(c, vusd, c2.numero)?.id;
    await validerJusqua(c, n, '2026-10-31');
    await regler('Encaissement partiel en dollars (6 000 USD)', 'CLIENT', n, '2026-11-10', c2, ctx.ligneUsd, undefined, { montantDevise: 6_000, coursReglement: 2_880 });
    for (const [date, m] of [['2026-07-25', 300_000], ['2026-09-25', 300_000], ['2026-11-25', 300_000]]) {
      await ecriture(c, `Acompte d’IS du ${date}`, n, date, 'Acompte provisionnel IS', [['44920000', m, 0], [BQ, 0, m]], { journal: bq });
    }
    await ecriture(c, 'Loyer annuel', n, '2026-12-01', 'Loyer de l’entrepôt 2026', [['62220000', 6_000_000, 0], [BQ, 0, 6_000_000]], { journal: bq });
    const s = await c.geste('Salarié KABILA', 'POST', '/personnel/salaries', { nom: 'KABILA', sexe: 'FEMININ', nationalite: 'congolaise' });
    if (s) {
      await c.geste('Contrat KABILA', 'POST', `/personnel/salaries/${s.id}/contrats`, {
        type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-11-01', natureTravail: 'Magasinière', classeProfessionnelle: 7,
        periodiciteRemuneration: 'MOIS', remunerationBase: 2_000_000, deviseRemuneration: 'CDF',
      });
      for (const [mois, fin] of [['2026-11', '2026-11-30'], ['2026-12', '2026-12-31']]) {
        await c.geste(`Bulletin KABILA ${mois}`, 'POST', `/personnel/salaries/${s.id}/bulletins`, {
          moisDePaie: mois, elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: 2_000_000 }],
          natureEmployeurInpp: 'PRIVE', effectif: 1, regimeSalarial: 'BAREME_ARTICLE_118',
        });
        await c.geste(`Passation de la paie ${mois}`, 'POST', `/personnel/paie-du-mois/${mois}/comptabilisation`, { exerciceId: n, journalId: od.id, date: fin });
        await ecriture(c, `Paiement du net ${mois}`, n, fin, `Salaire net ${mois}`, [['42200000', 1_619_400, 0], [BQ, 0, 1_619_400]], { journal: bq });
      }
    }
  });

  await etape(R, '2026 · créance douteuse de C3 (V6)', async () => {
    await validerJusqua(c, n, '2026-11-30');
    ctx.creance = await c.geste('Reclassement de la créance de C3', 'POST', '/creances-douteuses', {
      motif: 'Client en redressement, relances sans suite', pieces: [{ nature: 'Mise en demeure', reference: 'MED-2026-11', date: '2026-11-20' }],
      exerciceId: n, journalId: od.id, date: '2026-11-30', compteCreanceId: c3.compteId, nature: 'DOUTEUSE', montant: 2_320_000,
      ...(ctx.v6?.ligneTiersId ? { factures: [{ ligneEcritureId: ctx.v6.ligneTiersId, montant: 2_320_000 }] } : {}),
    });
    if (ctx.creance) {
      await c.geste('Revue 2026 de la créance de C3', 'POST', `/creances-douteuses/${ctx.creance.id}/revue`, {
        motif: 'Dépréciation à 50 % du TTC inscrit au 416', pieces: [{ nature: 'Mise en demeure', reference: 'MED-2026-11', date: '2026-11-20' }],
        exerciceId: n, journalId: od.id, depreciationNecessaire: 1_160_000,
      });
    }
  });

  await etape(R, '2026 · travaux de clôture · stock, dotation, réévaluation, impôt', async () => {
    const camp = await c.geste('Campagne d’inventaire 2026', 'POST', '/inventaire', { exerciceId: n, dateInventaire: '2026-12-31', libelle: 'Inventaire de fin d’année 2026' });
    const fiche = camp && (await c.geste('Fiche d’inventaire · marchandises', 'POST', `/inventaire/${camp.id}/fiches`, { compteId: compte(c, STOCK), designation: 'Ciment gris 50 kg', uniteMesure: 'sac' }));
    if (fiche) await c.geste('Comptage · marchandises', 'PATCH', `/inventaire/fiches/${fiche.id}`, { quantiteComptee: 190, valeurInventaire: 9_500_000 });
    const prop = await c.lire('Proposition de variation 2026', `/stocks/variation/${n}`);
    void prop;
    await c.geste('Variation des stocks 2026', 'POST', '/stocks/variation', { exerciceId: n, journalId: od.id, date: '2026-12-31' });
    if (ctx.vehicule) await c.geste('Dotation 2026 · véhicule', 'POST', `/immobilisations/${ctx.vehicule.id}/dotation`, { exerciceId: n, journalId: od.id });
    await validerJusqua(c, n, '2026-12-31');
    ctx.reeval26 = await c.geste('Réévaluation des devises au 31/12/2026', 'POST', '/devises/reevaluation', { exerciceId: n });
    await validerJusqua(c, n, '2026-12-31');
    await c.geste('Acomptes d’IS versés en 2026', 'PATCH', `/fiscalite/exercices/${n}/dossier`, { acomptesVerses: 900_000 });
    const rf = await c.lire('Résultat fiscal 2026', `/fiscalite/resultat-fiscal?exerciceId=${n}`);
    R.montant('2026 · résultat comptable avant impôt', 21_840_000, rf?.resultatComptable);
    R.montant('2026 · résultat fiscal', 21_840_000, rf?.resultatFiscal);
    R.montant('2026 · impôt dû (30 %)', 6_552_000, rf?.impotDu);
    R.montant('2026 · impôt minimum (1 % du chiffre d’affaires)', 495_000, rf?.impotMinimum);
    const ac = (rf?.acomptesProchainExercice ?? []).map((a) => a.montant);
    R.egal('2026 · acomptes 2027 (30 %, 30 %, 20 % de l’impôt)', [1_965_600, 1_965_600, 1_310_400], ac);
    await c.geste('Écriture de l’impôt 2026', 'POST', `/fiscalite/exercices/${n}/ecriture-impot`, { imputerAcomptes: true });
    await validerJusqua(c, n, '2026-12-31');
    await c.geste('Réintégration de l’impôt 2026', 'POST', `/fiscalite/exercices/${n}/retraitements`, { code: 'IMPOT_SUR_LE_RESULTAT', montant: 6_552_000, commentaire: 'Impôt sur le résultat comptabilisé (891)' });
    const rf2 = await c.lire('Résultat fiscal 2026 après l’écriture d’impôt', `/fiscalite/resultat-fiscal?exerciceId=${n}`);
    R.montant('2026 · impôt dû après l’écriture et sa réintégration', 6_552_000, rf2?.impotDu);
  });

  await etape(R, '2026 · contrôles avant clôture', async () => {
    await rechargerComptes(c);
    const b = await balance(c, n);
    R.montant('2026 · balance équilibrée', 0, b ? b.totalDebit - b.totalCredit : null);
    const att = {
      [BQ]: 10_461_200, [STOCK]: 9_500_000, '2451': 24_000_000, '2845': -4_500_000,
      '411': 12_600_000, '4162': 2_320_000, '4912': -1_160_000, '4191': 0, '401': 0, '4431': -1_600_000, '4452': 960_000, '4441': 0,
      '479': -200_000, '441': -5_652_000, '4492': 0, '422': 0, '4311': -260_000, '4312': -60_000, '4313': -400_000,
      '4472': -561_200, '4428': -160_000, '1013': -25_000_000, '121': -5_000_000,
      '7011': -21_000_000, '7012': -28_500_000, '756': -180_000, '6011': 13_000_000, '6031': -1_500_000, '6222': 6_000_000,
      '6611': 4_000_000, '6641': 520_000, '6415': 140_000, '6413': 20_000, '6813': 4_500_000, '6594': 1_160_000, '891': 6_552_000,
    };
    for (const [racine, m] of Object.entries(att)) R.montant(`2026 · solde ${racine}`, m, solde(b, racine));
    const bilan = aplatir(await c.lire('Bilan 2026', `/etats-financiers-syscohada/bilan?exerciceId=${n}`));
    R.montant('2026 · bilan · total actif (BZ)', 54_181_200, bilan.BZ?.n);
    R.montant('2026 · bilan · total passif (DZ)', 54_181_200, bilan.DZ?.n);
    R.montant('2026 · bilan · résultat net (CJ)', 15_288_000, bilan.CJ?.n);
    const cr = aplatir(await c.lire('Compte de résultat 2026', `/etats-financiers-syscohada/compte-de-resultat?exerciceId=${n}`));
    R.montant('2026 · compte de résultat · ventes de marchandises (TA)', 49_500_000, cr.TA?.n);
    R.montant('2026 · compte de résultat · résultat net (XI)', 15_288_000, cr.XI?.n);
    const tft = aplatir(await c.lire('Flux de trésorerie 2026', `/etats-financiers-syscohada/tableau-flux-tresorerie?exerciceId=${n}`));
    R.montant('2026 · TFT · trésorerie à l’ouverture (ZA)', 30_000_000, tft.ZA?.n);
    R.montant('2026 · TFT · variation (ZG)', -19_538_800, tft.ZG?.n);
    R.montant('2026 · TFT · trésorerie à la clôture (ZH)', 10_461_200, tft.ZH?.n);
    const notes = await c.lire('Notes annexes 2026', `/etats-financiers-syscohada/notes?exerciceId=${n}`);
    const n3a = (notes?.notes ?? []).filter((x) => x.code === '3A').flatMap((x) => x.lignes ?? []).find((l) => /TOTAL G[EÉ]N[EÉ]RAL/i.test(l.libelle ?? ''));
    R.montant('2026 · note 3A · acquisitions de l’exercice', 24_000_000, n3a?.valeurs?.AUGMENTATIONS);
    const liasse = await c.lire('Liasse Excel 2026', `/exports/etats-financiers-syscohada/liasse-complete?exerciceId=${n}`);
    R.egal('2026 · liasse Excel produite (classeur non vide)', true, Boolean(liasse?.octets > 1000));
  });

  await etape(R, 'Livres exportés de 2026', () => livresExportes(c, R, n, '2026'));

  const clos = await etape(R, 'Clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) {
    R.note('SARL · 2027 non joué · la clôture de 2026 n’a pas abouti ou l’exercice 2027 manque');
    await etape(R, 'Restitution du dossier', () => restitution(c, R));
    return;
  }

  /**
   * PERTE DE LA CRÉANCE DE C3 AVEC LE DUPLICATA SURCHARGÉ (O.-L. n° 10/001,
   * art. 52 al. 3 ; décret n° 011/42, art. 127 al. 2). Décision de Manasse du
   * 2026-10-08, attendue avec la ligne `tva-decisions` (point D) · la perte
   * qui porte ses duplicatas passe D 651 HT / D 443 / C compte d'origine,
   * AUCUN crédit au 651. Sans la correction, le DTO refuse le champ
   * `duplicatas` · la perte passe au TTC, puis « Récupérer la TVA » (D 443 /
   * C 651), le geste de `main`. Le banc prend la voie que le serveur ouvre et
   * lit les mouvements du 651 contre la règle de la décision.
   */
  const perteAvecDuplicata = async () => {
    if (!ctx.creance) return R.note('Créance de C3 absente, perte non passée');
    const factures = (await c.lire('Factures désignées de C3', `/creances-douteuses/${ctx.creance.id}/factures`)) ?? {};
    const designation = (factures.designees ?? []).find((d) => !d.retireeLe);
    const duplicatas = designation ? [{ designationId: designation.id, reference: 'DUP-FV-006', dateEnvoi: '2027-06-15' }] : [];
    const corps = {
      motif: 'Liquidation judiciaire clôturée pour insuffisance d’actif', pieces: [{ nature: 'Jugement de clôture', reference: 'JUG-2027-06', date: '2027-06-20' }],
      exerciceId: n1, journalId: od.id, date: '2027-06-30', montant: 2_320_000,
    };
    const essai = await c.req('POST', `/creances-douteuses/${ctx.creance.id}/perte`, { ...corps, duplicatas });
    if (essai.statut < 400) {
      R.egal('2027 · perte de C3 avec duplicata en une écriture (correction attendue « tva-decisions » point D)', true, true);
    } else if (JSON.stringify(essai.corps).includes('duplicatas')) {
      R.egal('2027 · perte de C3 avec duplicata en une écriture (correction attendue « tva-decisions » point D)', true, false);
      await c.geste('Perte de la créance de C3 (au TTC)', 'POST', `/creances-douteuses/${ctx.creance.id}/perte`, corps);
      await validerJusqua(c, n1, '2027-06-30');
      await c.geste('Récupération de la TVA de la créance de C3', 'POST', `/creances-douteuses/${ctx.creance.id}/recuperation-tva`, {
        motif: 'Duplicata surchargé envoyé au client', pieces: [{ nature: 'Duplicata', reference: 'DUP-FV-006', date: '2027-06-15' }],
        exerciceId: n1, journalId: od.id, date: '2027-06-30', duplicatas,
      });
    } else {
      R.erreurHttp('Perte de la créance de C3 avec duplicata', 'POST', `/creances-douteuses/${ctx.creance.id}/perte`, essai.statut, essai.corps);
    }
    await validerJusqua(c, n1, '2027-06-30');
    const b = await balance(c, n1);
    const l651 = [...(b?.parNumero ?? new Map()).entries()].filter(([num]) => num.startsWith('651')).map(([, l]) => l.brut);
    R.montant('2027 · 651 · débit (HT seul, décision du 2026-10-08)', 2_000_000, l651.reduce((x, l) => x + Number(l.mouvementDebit ?? 0), 0));
    R.montant('2027 · 651 · crédit (aucun, décision du 2026-10-08)', 0, l651.reduce((x, l) => x + Number(l.mouvementCredit ?? 0), 0));
  };

  // --- Exercice 2027 ---------------------------------------------------------
  await etape(R, '2027 · à-nouveaux, extourne, affectation', async () => {
    const b = await balance(c, n1);
    R.montant('2027 · à-nouveau banque', 10_461_200, solde(b, BQ));
    R.montant('2027 · à-nouveau clients', 12_600_000, solde(b, '411'));
    R.montant('2027 · à-nouveau résultat 2026 au 13', -15_288_000, solde(b, '13'));
    const id = ctx.reeval26?.reevaluationId;
    if (id) await c.geste('Extourne de la réévaluation 2026', 'POST', `/devises/reevaluation/${id}/extourne`, { exerciceSuivantId: n1 });
    else R.note('Réévaluation 2026 sans identifiant lu, extourne non passée');
  });

  await etape(R, '2027 · opérations de l’exercice', async () => {
    await ecriture(c, 'Versement des retenues et cotisations de la paie 2026', n1, '2027-01-15', 'CNSS, IRPP, INPP, ONEM 2026', [
      ['43110000', 260_000, 0], ['43120000', 60_000, 0], ['43130000', 400_000, 0], ['44720000', 561_200, 0], ['44280000', 160_000, 0], [BQ, 0, 1_441_200],
    ], { journal: bq });
    const p = await ecriture(c, 'Solde de V1 par C1', n1, '2027-02-15', 'Solde FV-001', [[BQ, 1_000_000, 0], [c1.numero, 0, 1_000_000]], { journal: bq });
    // LE LETTRAGE PARTIEL DE V1 TRAVERSE LA CLÔTURE · attendu avec la ligne
    // `lettrage-cloture` (en cours au gel) · les lignes d'à-nouveau qui
    // reportent V1, l'acompte imputé et le règlement partiel arrivent en 2027
    // réunies dans un groupe PARTIEL dont le reste est 1 000 000, que le
    // règlement du solde complète. Sans la correction, elles arrivent
    // séparées et non lettrées · le banc le relève, puis les lettre à la main
    // avec le règlement (le geste du cabinet), pour continuer.
    const lu = (await c.lire('Lignes de C1 en 2027', `/comptes/${c1.compteId}/lettrage`)) ?? {};
    const ran = (lu.lignes ?? []).filter((l) => String(l.date).slice(0, 4) === '2027' && String(l.libelle ?? '').startsWith('RAN'));
    const groupes = new Set(ran.map((l) => l.lettrageId).filter(Boolean));
    const reconduit = (lu.lettrages ?? []).find((g) => groupes.has(g.id) && g.statut === 'PARTIEL');
    R.egal('2027 · lettrage partiel de V1 reconduit à la clôture (correction attendue « lettrage-cloture »)', true, Boolean(reconduit));
    if (reconduit) R.montant('2027 · reste du groupe reconduit de V1', 1_000_000, Math.abs(Number(reconduit.solde)));
    const lp = ligneDe(c, p, c1.numero);
    if (reconduit && lp) {
      await c.geste('Lettrage reconduit de V1 complété par le solde', 'POST', `/comptes/${c1.compteId}/lettrage/${reconduit.id}/completer`, { ligneIds: [lp.id] });
    } else if (lp && ran.length) {
      R.note('2027 · groupe partiel de V1 non reconduit · lignes d’à-nouveau lettrées à la main avec le règlement du solde');
      await lettrer(c, c1.numero, [...ran.filter((l) => !l.lettrageId).map((l) => l.id), lp.id]);
    }
    const apres = (await c.lire('Lignes ouvertes de C1 après le solde de V1', `/comptes/${c1.compteId}/lettrage?nonLettreesSeulement=true`)) ?? {};
    R.montant('2027 · client C1 · lignes 2027 non lettrées après le solde de V1', 0,
      (apres.lignes ?? []).filter((l) => String(l.date).slice(0, 4) === '2027').length);
    ctx.a4 = await facture('Facture d’achat A4', 'ACHAT', 'FA-004', '2027-02-01', f1, 7_000_000, ACHATS, ach);
    await regler('Règlement A4', 'FOURNISSEUR', n1, '2027-03-01', f1, ctx.a4?.ligneTiersId, 8_120_000);
    const usd = (await c.lire('Lignes ouvertes de C2 en 2027', `/comptes/${c2.compteId}/lettrage?nonLettreesSeulement=true`)) ?? {};
    const anUsd = (usd.lignes ?? []).find((l) => String(l.date).slice(0, 4) === '2027' && Number(l.debit) > 0 && l.montantDevise);
    await regler('Encaissement du solde en dollars (4 000 USD)', 'CLIENT', n1, '2027-03-10', c2, anUsd?.id, undefined, { montantDevise: 4_000, coursReglement: 2_950 });
    ctx.v4 = await facture('Facture de vente V4', 'VENTE', 'FV-004', '2027-03-01', c1, 30_000_000, VENTES, ven);
    await regler('Encaissement V4', 'CLIENT', n1, '2027-04-01', c1, ctx.v4?.ligneTiersId, 34_800_000);
    await ecriture(c, 'Solde de l’IS 2026', n1, '2027-04-30', 'Solde IS 2026', [['44100000', 5_652_000, 0], [BQ, 0, 5_652_000]], { journal: bq });
    await perteAvecDuplicata();
    if (ctx.vehicule) {
      await c.geste('Cession du véhicule', 'POST', `/immobilisations/${ctx.vehicule.id}/sortie`, {
        dateSortie: '2027-06-30', type: 'CESSION', exerciceId: n1, journalId: od.id, prixCession: 18_000_000, compteContrepartieId: compte(c, BQ),
        natureSortie: 'VENTE', referencePieceSortie: 'ACTE-VENTE-2027-01', datePieceSortie: '2027-06-30',
      });
    }
    for (const [date, m] of [['2027-07-25', 1_965_600], ['2027-09-25', 1_965_600], ['2027-11-25', 1_310_400]]) {
      await ecriture(c, `Acompte d’IS du ${date}`, n1, date, 'Acompte provisionnel IS', [['44920000', m, 0], [BQ, 0, m]], { journal: bq });
    }
    await ecriture(c, 'Loyer annuel 2027', n1, '2027-12-01', 'Loyer de l’entrepôt 2027', [['62220000', 6_000_000, 0], [BQ, 0, 6_000_000]], { journal: bq });
    const camp = await c.geste('Campagne d’inventaire 2027', 'POST', '/inventaire', { exerciceId: n1, dateInventaire: '2027-12-31', libelle: 'Inventaire de fin d’année 2027' });
    const fiche = camp && (await c.geste('Fiche d’inventaire 2027', 'POST', `/inventaire/${camp.id}/fiches`, { compteId: compte(c, STOCK), designation: 'Ciment gris 50 kg', uniteMesure: 'sac' }));
    if (fiche) await c.geste('Comptage 2027', 'PATCH', `/inventaire/fiches/${fiche.id}`, { quantiteComptee: 140, valeurInventaire: 7_000_000 });
    await c.geste('Variation des stocks 2027', 'POST', '/stocks/variation', { exerciceId: n1, journalId: od.id, date: '2027-12-31' });
    await validerJusqua(c, n1, '2027-12-31');
    // Aucune réévaluation en 2027 · la créance en dollars est soldée le
    // 10 mars, il ne reste aucune position en devise au 31 décembre.
    if (ctx.creance) {
      await c.geste('Revue 2027 de la créance de C3', 'POST', `/creances-douteuses/${ctx.creance.id}/revue`, {
        motif: 'Créance éteinte par la perte · dépréciation sans objet', pieces: [{ nature: 'Jugement de clôture', reference: 'JUG-2027-06', date: '2027-06-20' }],
        exerciceId: n1, journalId: od.id, depreciationNecessaire: 0,
      });
      await validerJusqua(c, n1, '2027-12-31');
    }
    await c.geste('Acomptes d’IS versés en 2027', 'PATCH', `/fiscalite/exercices/${n1}/dossier`, { acomptesVerses: 5_241_600 });
    const rf = await c.lire('Résultat fiscal 2027', `/fiscalite/resultat-fiscal?exerciceId=${n1}`);
    R.montant('2027 · résultat comptable avant impôt', 12_560_000, rf?.resultatComptable);
    R.montant('2027 · impôt dû (30 %)', 3_768_000, rf?.impotDu);
    await c.geste('Écriture de l’impôt 2027', 'POST', `/fiscalite/exercices/${n1}/ecriture-impot`, { imputerAcomptes: true });
    await validerJusqua(c, n1, '2027-12-31');
  });

  // UNE SITUATION AVANT L'ASSEMBLÉE · les opérations de 2027 passées, le
  // résultat 2026 encore au 13 · le bilan doit porter les deux résultats.
  await etape(R, '2027 · situation avant l’affectation, puis affectation', async () => {
    const situation = aplatir(await c.lire('Bilan 2027 avant affectation (opérations passées)', `/etats-financiers-syscohada/bilan?exerciceId=${n1}`));
    R.montant('2027 · bilan avant affectation, opérations passées · actif moins passif', 0, (situation.BZ?.n ?? NaN) - (situation.DZ?.n ?? NaN));
    R.montant('2027 · bilan avant affectation · total actif', 60_160_000, situation.BZ?.n);
    await c.geste('Affectation du résultat 2026', 'POST', '/affectation-resultat', {
      exerciceId: n, dateDecision: '2027-04-30', organe: 'Assemblée générale ordinaire des associés',
      lignes: [{ compteId: compte(c, '11100000'), montant: 1_528_800 }, { compteId: compte(c, '12100000'), montant: 13_759_200 }],
    });
    await validerJusqua(c, n1, '2027-12-31');
  });

  await etape(R, '2027 · contrôles avant clôture', async () => {
    const b = await balance(c, n1);
    R.montant('2027 · balance équilibrée', 0, b ? b.totalDebit - b.totalCredit : null);
    const att = {
      [BQ]: 49_606_400, [STOCK]: 7_000_000, '2451': 0, '2845': 0, '411': 0, '416': 0, '491': 0, '401': 0, '479': 0, '4431': -6_080_000, '4452': 2_080_000,
      '441': 0, '4492': 1_473_600, '43': 0, '447': 0, '4428': 0, '111': -1_528_800, '121': -18_759_200, '13': 0,
      '7011': -30_000_000, '756': -400_000, '82': -18_000_000, '81': 16_500_000, '6011': 7_000_000, '6031': 2_500_000, '6222': 6_000_000,
      '681': 3_000_000, '651': 2_000_000, '7594': -1_160_000, '891': 3_768_000,
    };
    for (const [racine, m] of Object.entries(att)) R.montant(`2027 · solde ${racine}`, m, solde(b, racine));
    const bilan = aplatir(await c.lire('Bilan 2027', `/etats-financiers-syscohada/bilan?exerciceId=${n1}`));
    R.montant('2027 · bilan · total actif (BZ)', 60_160_000, bilan.BZ?.n);
    R.montant('2027 · bilan · total passif (DZ)', 60_160_000, bilan.DZ?.n);
    R.montant('2027 · bilan · colonne N-1 · total actif = 2026', 54_181_200, bilan.BZ?.n1);
    R.montant('2027 · bilan · résultat net (CJ)', 8_792_000, bilan.CJ?.n);
    const cr = aplatir(await c.lire('Compte de résultat 2027', `/etats-financiers-syscohada/compte-de-resultat?exerciceId=${n1}`));
    R.montant('2027 · compte de résultat · résultat net (XI)', 8_792_000, cr.XI?.n);
    R.montant('2027 · compte de résultat · colonne N-1 · résultat net = 2026', 15_288_000, cr.XI?.n1);
    const tft = aplatir(await c.lire('Flux de trésorerie 2027', `/etats-financiers-syscohada/tableau-flux-tresorerie?exerciceId=${n1}`));
    R.montant('2027 · TFT · trésorerie à l’ouverture (ZA)', 10_461_200, tft.ZA?.n);
    R.montant('2027 · TFT · variation (ZG)', 39_145_200, tft.ZG?.n);
    R.montant('2027 · TFT · trésorerie à la clôture (ZH)', 49_606_400, tft.ZH?.n);
    R.montant('2027 · TFT · colonne N-1 · trésorerie à la clôture 2026', 10_461_200, tft.ZH?.n1);
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
    R.montant('2028 · à-nouveau banque', 49_606_400, solde(b, BQ));
    R.montant('2028 · à-nouveau résultat 2027 au 13', -8_792_000, solde(b, '13'));
    R.montant('2028 · à-nouveau réserve légale', -1_528_800, solde(b, '111'));
  });
}
