/**
 * SCÉNARIO « FIN D'UNE SOCIÉTÉ » · l'impôt sur le résultat, la dissolution et
 * la liquidation d'une société commerciale, et l'entreprise du portefeuille
 * de l'État, au SYSCOHADA (système normal), exercices 2026 et 2027.
 *
 * Trois dossiers.
 *  A. « Kasaï Négoce SARL » · bénéficiaire en 2026 (écriture de l'impôt
 *     proposée, passée, annulée puis repassée, acomptes imputés au 4492),
 *     clôture de 2026 ; dissoute le 30 juin 2027 et liquidée jusqu'au
 *     31 décembre 2027 · faits de la dissolution, arrêt de l'exercice (refus
 *     de la dotation de l'année entière, retrait sur accord), annulation de
 *     l'arrêt puis nouvel arrêt, écritures datées après la dissolution qui
 *     suivent leur date sans changer, deux cotisations spéciales sur UNE
 *     assiette (loi n° 23/053, art. 11, 1°, 12 al. 4 et 13), trop-payé de la
 *     première porté D 441 / C 8994, acomptes de l'année de la dissolution,
 *     aucun exercice civil après elle, clôture de la liquidation.
 *  B. « Minière de la Lufira SA » · entreprise MINIÈRE du portefeuille de
 *     l'État (O.-L. n° 13/003, art. 112 et 113 ; arrêté interministériel du
 *     10 décembre 2025) · assemblée au 31 mars, délais francs, RCCM, PV à
 *     l'Administration des recettes non fiscales, dividende prioritaire
 *     (provisoire puis arrêté, note de perception et paiement), aucun
 *     dividende sur une perte, PV de la LPF art. 13 bis.
 *  C. « Lualaba Services SARLU » · associé unique personne morale, dissoute
 *     le 30 septembre 2026 SANS liquidation (AUSCGIE art. 201 al. 4) ·
 *     cotisation unique, acomptes bornés, clôture sans exercice suivant.
 *
 * Textes lus pour les attendus (compétences, chemin abrégé SK/) ·
 *  - loi n° 23/053 (SK/fiscalite-rdc/code-general-2026/references/04-…) ·
 *    art. 56 « Le taux de l'Impôt sur les Sociétés est fixé à 30 % du
 *    bénéfice net imposable » ; art. 57 « impôt minimum fixé à 1 % du chiffre
 *    d'affaires déclaré » ; art. 11, 1° (bénéfices de la liquidation « sans
 *    distinguer ») ; art. 12 al. 1 (comptes arrêtés hors du 31 décembre « en
 *    cas de cession ou de cessation ») et al. 4 (« les résultats en sont
 *    totalisés pour l'assiette de l'impôt dû au titre de ladite année ») ;
 *    art. 13 (deux cotisations spéciales, la seconde « rattachée à
 *    l'exercice désigné par le millésime de l'année de la dissolution ») ;
 *    art. 150 (arrondi à la centaine) ;
 *  - LPF (17-… et 19-…) · art. 13 bis (PV dans les dix jours de l'assemblée
 *    « approuvant les états financiers certifiés par les commissaires aux
 *    comptes ») ; art. 16 (« dans le mois » en cas de dissolution) ;
 *    art. 57 bis (acomptes de 30 %, 30 % et 20 % de l'impôt de l'exercice
 *    précédent, au plus tard les 25 juillet, 25 septembre et 25 novembre) ;
 *    art. 57 ter (excédent d'acomptes, crédit au compte courant fiscal) ;
 *  - AUSCGIE (SK/auscgie-acte-uniforme) · art. 201 (al. 4, associé unique,
 *    « sans qu'il y ait lieu à liquidation ») ; art. 216 (clôture « dans un
 *    délai de trois (3) ans à compter de la dissolution ») ; art. 266
 *    (publication de la nomination « dans le délai d'un (1) mois ») ;
 *  - décisions du dépôt · docs/decisions-par-la-loi-2026-10-07-quater.md
 *    (points 1 à 5) et CLAUDE.md (« Liquidation d'une société commerciale »,
 *    « Entreprise du portefeuille de l'État », ligne A11).
 *
 * Tous les montants attendus sont calculés À LA MAIN en commentaire à côté de
 * chaque contrôle, depuis les opérations du banc · jamais recopiés d'une
 * réponse du serveur. Jours de la semaine relus au calendrier · 1er janvier
 * 2026 jeudi, 1er janvier 2027 vendredi, 1er janvier 2028 samedi.
 */
import { balance, compte, ecriture, etape, nouveauDossier, solde, validerJusqua } from './lib.mjs';

// --- Outils propres au scénario -------------------------------------------------

const BQ = '52110000';
const VENTES = '70110000';
const ACHATS = '60110000';
const LOYER = '62220000';
const HONORAIRES = '63240000';

/** Un jour AAAA-MM-JJ, quelle que soit la forme lue (ISO, Date, null). */
const jour = (d) => (d ? String(d).slice(0, 10) : null);

/** Le texte d'un corps de refus, quelle qu'en soit la forme. */
const texteRefus = (corps) => {
  const m = corps?.message ?? corps;
  return Array.isArray(m) ? m.join(' | ') : typeof m === 'string' ? m : JSON.stringify(m ?? '');
};

/**
 * UN REFUS ATTENDU · le geste DOIT être refusé (4xx) et son motif doit dire
 * ce que le texte fonde. Passé par `req` · un refus voulu est le contrôle
 * lui-même, pas une erreur HTTP du banc.
 */
async function refusAttendu(c, R, libelle, methode, chemin, corps, motif) {
  const r = await c.req(methode, chemin, corps);
  R.egal(`${libelle} · refusé (4xx)`, true, r.statut >= 400 && r.statut < 500);
  if (motif) R.egal(`${libelle} · le motif nomme la règle`, true, motif.test(texteRefus(r.corps)));
  if (r.statut < 400) R.note(`${libelle} · ACCEPTÉ à tort · ${JSON.stringify(r.corps).slice(0, 300)}`);
  else R.note(`${libelle} · motif lu · ${texteRefus(r.corps).slice(0, 260)}`);
  return r;
}

/** Les exercices du dossier, lus à chaque fois (l'arrêt en crée et en retire). */
async function exercices(c) {
  return (await c.lire('Exercices du dossier', '/exercices')) ?? [];
}
const exerciceDebutant = (liste, debut) => liste.find((e) => jour(e.dateDebut) === debut) ?? null;

/** Un jalon du planning, par son libellé (et son étape quand elle départage). */
const jalon = (planning, libelle, etapeNum) =>
  (planning?.jalons ?? []).find((j) => (etapeNum === undefined || j.etape === etapeNum) && libelle.test(j.libelle ?? '')) ?? null;

/** Une ligne de l'échéancier fiscal par sa clé. */
const echeanceDe = (ech, cle) => (ech?.echeances ?? []).find((e) => e.cle === cle) ?? null;

/** Clôture annuelle d'un exercice par son identifiant · rend la réponse ou null. */
const cloturerExercice = (c, libelle, id) => c.geste(`Clôture · ${libelle}`, 'POST', `/exercices/${id}/cloturer`, {});

/** Les écritures d'un exercice, indexées par identifiant. */
async function ecrituresDe(c, exerciceId) {
  const l = (await c.lire('Écritures de l’exercice', `/ecritures?exerciceId=${exerciceId}`))?.ecritures ?? [];
  return new Map(l.map((e) => [e.id, e]));
}

/** Une aplatisseuse de bilan · la référence de poste et son montant N. */
async function bilanDe(c, exerciceId) {
  const b = await c.lire('Bilan', `/etats-financiers-syscohada/bilan?exerciceId=${exerciceId}`);
  const m = {};
  const visiter = (o) => {
    if (Array.isArray(o)) return o.forEach(visiter);
    if (o && typeof o === 'object') {
      if (typeof o.ref === 'string' && ('montant' in o || 'net' in o)) m[o.ref] = m[o.ref] ?? (o.net ?? o.montant ?? null);
      Object.values(o).forEach((v) => v && typeof v === 'object' && visiter(v));
    }
  };
  visiter(b);
  return m;
}

/** Un bilan d'ouverture importé au 1er janvier, puis validé (même chemin que le scénario SARL). */
async function ouverture(c, exerciceId, date, lignes) {
  const csv = ['Compte;Intitule;Debit;Credit', ...lignes.map((l) => l.join(';'))].join('\n');
  await c.geste('Import du bilan d’ouverture', 'POST', '/import/executer', {
    type: 'BALANCE', nomFichier: `ouverture-${date}.csv`, contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
    mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
    exerciceId, dateOperation: date, bilanDOuverture: true, separateur: ';',
  });
  await validerJusqua(c, exerciceId, date);
}

// =====================================================================================
// DOSSIER A · Kasaï Négoce SARL · impôt 2026, dissolution et liquidation en 2027
// =====================================================================================

async function dossierSarlDissoute(R) {
  const c = await nouveauDossier(R, 'Passe V1 · Kasaï Négoce SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'fin-sarl', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const od = c.od;
  const ctx = {};

  await etape(R, 'A · paramètres et ouverture 2026', async () => {
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await ouverture(c, n, '2026-01-01', [[BQ, 'Banque', 50_000_000, 0], ['10130000', 'Capital', 0, 50_000_000]]);
  });

  // --- 2026 · un exercice bénéficiaire ------------------------------------------
  await etape(R, 'A · 2026 · opérations', async () => {
    ctx.vehicule = await c.geste('Acquisition du véhicule', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(c, '24510000'), designation: 'Camion Hino 300', dateAcquisition: '2026-04-01', dateMiseEnService: '2026-04-01',
      valeurOrigine: 24_000_000, dureeAmortissementAns: 4, modeAmortissement: 'LINEAIRE', compteContrepartieId: compte(c, BQ), exerciceId: n, journalId: bq.id,
    });
    await ecriture(c, 'Achat de marchandises 2026', n, '2026-05-15', 'Achat de ciment', [[ACHATS, 20_000_000, 0], [BQ, 0, 20_000_000]], { journal: bq, reference: 'FA-2026-01' });
    await ecriture(c, 'Vente de marchandises 2026', n, '2026-06-30', 'Vente de ciment', [[BQ, 60_000_000, 0], [VENTES, 0, 60_000_000]], { journal: bq, reference: 'FV-2026-01' });
    // ACOMPTES 2026 (LPF art. 57 bis) · 30 %, 30 % et 20 % de l'impôt déclaré au
    // titre de 2025, posé par le banc à 3 000 000 · 900 000, 900 000, 600 000.
    // Le 25 juillet 2026 est un samedi · versé la veille.
    for (const [date, m] of [['2026-07-24', 900_000], ['2026-09-25', 900_000], ['2026-11-25', 600_000]]) {
      await ecriture(c, `Acompte d’IS du ${date}`, n, date, 'Acompte provisionnel IS', [['44920000', m, 0], [BQ, 0, m]], { journal: bq, reference: `ACP-${date}` });
    }
    await ecriture(c, 'Loyer 2026', n, '2026-12-01', 'Loyer de l’entrepôt', [[LOYER, 6_000_000, 0], [BQ, 0, 6_000_000]], { journal: bq, reference: 'LOY-2026' });
    if (ctx.vehicule) await c.geste('Dotation 2026 · véhicule', 'POST', `/immobilisations/${ctx.vehicule.id}/dotation`, { exerciceId: n, journalId: od.id });
    await validerJusqua(c, n, '2026-12-31');
  });

  await etape(R, 'A · 2026 · résultat fiscal et écriture de l’impôt (proposée, passée, annulée, repassée)', async () => {
    await c.geste('Acomptes d’IS versés en 2026', 'PATCH', `/fiscalite/exercices/${n}/dossier`, { acomptesVerses: 2_400_000 });
    const rf = await c.lire('Résultat fiscal 2026', `/fiscalite/resultat-fiscal?exerciceId=${n}`);
    // Résultat avant impôt · 60 000 000 − 20 000 000 − 6 000 000 − dotation
    // (24 000 000 / 4 × 9/12 = 4 500 000, avril à décembre) = 29 500 000.
    R.montant('A 2026 · résultat comptable avant impôt', 29_500_000, rf?.resultatComptable);
    R.montant('A 2026 · résultat fiscal', 29_500_000, rf?.resultatFiscal);
    // Art. 56 · 30 % × 29 500 000 = 8 850 000 (aucune décimale, tranche 0, art. 150).
    R.montant('A 2026 · impôt dû (30 %, art. 56)', 8_850_000, rf?.impotDu);
    // Art. 57 · 1 % × 60 000 000 = 600 000, inférieur · non retenu.
    R.montant('A 2026 · impôt minimum (1 % du chiffre d’affaires, art. 57)', 600_000, rf?.impotMinimum);
    // Acomptes 2027 · 30 % × 8 850 000 = 2 655 000 ; 2 655 000 ; 20 % = 1 770 000.
    R.egal('A 2026 · acomptes de 2027 (30 %, 30 %, 20 % de l’impôt)', [2_655_000, 2_655_000, 1_770_000], (rf?.acomptesProchainExercice ?? []).map((a) => a.montant));

    const prop = await c.lire('Écriture de l’impôt 2026 · proposition', `/fiscalite/exercices/${n}/ecriture-impot`);
    R.montant('A 2026 · proposition · impôt', 8_850_000, prop?.proposition?.impot);
    R.egal('A 2026 · proposition · aucun motif de refus', [], prop?.motifsRefus ?? null);
    // Imputation · le plus petit des acomptes déclarés (2 400 000), du solde du 4492 (2 400 000) et de l'impôt.
    R.montant('A 2026 · proposition · acomptes imputables', 2_400_000, prop?.proposition?.imputation?.montant);
    const lignes = (prop?.proposition?.lignes ?? []).map((l) => [l.numero, l.debit, l.credit]);
    R.egal('A 2026 · proposition · D 89110000 / C 44100000 de l’impôt entier', [['89110000', 8_850_000, 0], ['44100000', 0, 8_850_000]], lignes);

    const p1 = await c.geste('Écriture de l’impôt 2026 (premier passage)', 'POST', `/fiscalite/exercices/${n}/ecriture-impot`, { imputerAcomptes: true });
    R.montant('A 2026 · constat · impôt', 8_850_000, p1?.constat?.montantImpot);
    R.montant('A 2026 · constat · acomptes imputés', 2_400_000, p1?.constat?.montantImpute);
    await validerJusqua(c, n, '2026-12-31');
    // Un second clic est refusé tant que le premier constat tient.
    await refusAttendu(c, R, 'A 2026 · second constat sur le premier', 'POST', `/fiscalite/exercices/${n}/ecriture-impot`, { imputerAcomptes: true }, /déjà constaté/);
    // ANNULATION (AUDCIF art. 20, al. 2) · l'écriture validée s'inscrit en négatif.
    await c.geste('Annulation du constat 2026', 'POST', `/fiscalite/exercices/${n}/ecriture-impot/annuler`, { motif: 'Imputation à revoir avec le dirigeant' });
    await validerJusqua(c, n, '2026-12-31');
    let b = await balance(c, n);
    // Après le négatif · 891 et 441 reviennent à zéro, le 4492 retrouve 2 400 000.
    R.montant('A 2026 · après annulation · 891 net', 0, solde(b, '891'));
    R.montant('A 2026 · après annulation · 441 net', 0, solde(b, '441'));
    R.montant('A 2026 · après annulation · 4492', 2_400_000, solde(b, '4492'));
    const etat = await c.lire('Écriture de l’impôt 2026 · après annulation', `/fiscalite/exercices/${n}/ecriture-impot`);
    R.egal('A 2026 · après annulation · plus de constat en place', null, etat?.constat ?? null);
    R.montant('A 2026 · après annulation · un constat annulé compté', 1, etat?.annulees);
    R.montant('A 2026 · après annulation · proposition rejouée', 8_850_000, etat?.proposition?.impot);
    const p2 = await c.geste('Écriture de l’impôt 2026 (repassée)', 'POST', `/fiscalite/exercices/${n}/ecriture-impot`, { imputerAcomptes: true });
    R.montant('A 2026 · constat repassé · impôt', 8_850_000, p2?.constat?.montantImpot);
    await validerJusqua(c, n, '2026-12-31');
    // L'impôt n'est pas déductible de son propre calcul (art. 45) · réintégré à sa mesure.
    await c.geste('Réintégration de l’impôt 2026', 'POST', `/fiscalite/exercices/${n}/retraitements`, { code: 'IMPOT_SUR_LE_RESULTAT', montant: 8_850_000, commentaire: 'Impôt sur le résultat comptabilisé au 891' });
    const rf2 = await c.lire('Résultat fiscal 2026 après l’écriture de l’impôt', `/fiscalite/resultat-fiscal?exerciceId=${n}`);
    R.montant('A 2026 · après réintégration · résultat fiscal inchangé', 29_500_000, rf2?.resultatFiscal);
    R.montant('A 2026 · après réintégration · impôt inchangé', 8_850_000, rf2?.impotDu);
    b = await balance(c, n);
    // 891 = 8 850 000 ; 441 = −8 850 000 + 2 400 000 = −6 450 000 ; 4492 = 0.
    R.montant('A 2026 · 891 · impôt de l’exercice', 8_850_000, solde(b, '891'));
    R.montant('A 2026 · 441 · reste dû à l’État', -6_450_000, solde(b, '441'));
    R.montant('A 2026 · 4492 · acomptes imputés', 0, solde(b, '4492'));
    // Banque · 50 000 000 − 24 000 000 − 20 000 000 + 60 000 000 − 2 400 000 − 6 000 000 = 57 600 000.
    R.montant('A 2026 · banque', 57_600_000, solde(b, BQ));
    const bil = await bilanDe(c, n);
    // Actif · 24 000 000 − 4 500 000 + 57 600 000 = 77 100 000 ; passif · 50 000 000
    // + résultat 20 650 000 (29 500 000 − 8 850 000) + 441 6 450 000.
    R.montant('A 2026 · bilan · total actif (BZ)', 77_100_000, bil.BZ);
    R.montant('A 2026 · bilan · total passif (DZ)', 77_100_000, bil.DZ);
    R.montant('A 2026 · bilan · résultat net (CJ)', 20_650_000, bil.CJ);
  });

  const clos26 = await etape(R, 'A · clôture 2026', () => cloturerExercice(c, '2026', n));
  let liste = await exercices(c);
  const n1 = exerciceDebutant(liste, '2027-01-01')?.id;
  if (!clos26 || !n1) {
    R.note('A · 2027 non joué · la clôture de 2026 n’a pas abouti ou 2027 manque');
    return;
  }

  // --- 2027 · l'activité jusqu'à la dissolution, et après elle ------------------
  const avant = {};
  await etape(R, 'A · 2027 · opérations avant l’arrêt (dont trois datées après le 30 juin)', async () => {
    await ecriture(c, 'Vente 2027', n1, '2027-03-15', 'Vente de ciment', [[BQ, 30_000_000, 0], [VENTES, 0, 30_000_000]], { journal: bq, reference: 'FV-2027-01' });
    await ecriture(c, 'Solde de l’IS 2026', n1, '2027-04-30', 'Solde IS 2026', [['44100000', 6_450_000, 0], [BQ, 0, 6_450_000]], { journal: bq, reference: 'IS-2026' });
    await ecriture(c, 'Achat 2027', n1, '2027-05-10', 'Achat de ciment', [[ACHATS, 8_000_000, 0], [BQ, 0, 8_000_000]], { journal: bq, reference: 'FA-2027-01' });
    // Le 25 juillet 2027 est un dimanche · premier acompte versé le vendredi 23.
    const a1 = await ecriture(c, 'Acompte d’IS du 2027-07-23', n1, '2027-07-23', 'Acompte provisionnel IS', [['44920000', 2_655_000, 0], [BQ, 0, 2_655_000]], { journal: bq, reference: 'ACP-2027-07' });
    const v2 = await ecriture(c, 'Vente du stock restant', n1, '2027-09-15', 'Vente du stock restant', [[BQ, 10_000_000, 0], [VENTES, 0, 10_000_000]], { journal: bq, reference: 'FV-2027-02' });
    await validerJusqua(c, n1, '2027-09-15');
    // Les honoraires du liquidateur restent au brouillard · une écriture au
    // brouillard suit sa date comme une écriture validée.
    const h = await ecriture(c, 'Honoraires du liquidateur', n1, '2027-10-10', 'Honoraires du liquidateur', [[HONORAIRES, 14_500_000, 0], [BQ, 0, 14_500_000]], { journal: bq, reference: 'HON-LIQ' });
    const lues = await ecrituresDe(c, n1);
    for (const [cle, e] of [['acompte', a1], ['vente', v2], ['honoraires', h]]) {
      const l = e?.id ? lues.get(e.id) : null;
      if (l) avant[cle] = { id: l.id, date: jour(l.date), numeroPiece: l.numeroPiece, statut: l.statut };
    }
    R.egal('A 2027 · trois écritures datées après le 30/06 relues avant l’arrêt', 3, Object.keys(avant).length);
    // LA DOTATION DE L'ANNÉE ENTIÈRE · passée avant que la dissolution soit
    // connue, sur l'exercice du 01/01 au 31/12/2027 · 24 000 000 / 4 = 6 000 000.
    if (ctx.vehicule) ctx.dotationPleine = await c.geste('Dotation 2027 sur l’année entière', 'POST', `/immobilisations/${ctx.vehicule.id}/dotation`, { exerciceId: n1, journalId: od.id });
    const b = await balance(c, n1);
    R.montant('A 2027 · dotation de l’année entière au brouillard (6813)', 6_000_000, solde(b, '6813'));
  });

  await etape(R, 'A · faits de la dissolution déclarés', async () => {
    // Dissolution au 30/06/2027, liquidateur nommé le même jour, liquidation
    // amiable statutaire, plusieurs associés, clôture prévue au 31/12/2027.
    await c.geste('Faits de la dissolution', 'PATCH', '/dossier/identite', {
      dateDissolution: '2027-06-30', liquidateurs: 'Me Kabeya Mutombo', dateNominationLiquidateur: '2027-06-30',
      regimeLiquidation: 'AMIABLE_STATUTAIRE', associeUniquePersonneMorale: 'NON', dateClotureLiquidation: '2027-12-31',
    });
    const pl = await c.lire('Planning 2027 avant l’arrêt', `/exercices/${n1}/planning-cloture`);
    R.egal('A 2027 · planning · arrêt proposé (la dotation se retire sur accord)', true, pl?.dissolution?.arretPropose);
    R.egal('A 2027 · planning · la dotation de l’année entière est nommée à retirer', true,
      (pl?.dissolution?.actesDeLaPeriodeARetirer ?? []).some((a) => /dotation aux amortissements/.test(a)));
  });

  await etape(R, 'A · arrêt de l’exercice à la dissolution', async () => {
    // AUDCIF art. 59 · la dotation calculée sur douze mois ne peut ni suivre
    // son écriture ni rester · le geste sans accord est refusé et la nomme.
    await refusAttendu(c, R, 'A · arrêt sans accord pour la dotation de l’année entière', 'POST', `/exercices/${n1}/arreter-a-la-dissolution`, {}, /dotation aux amortissements/);
    const r = await c.geste('Arrêt à la dissolution (accord de retrait des actes de la période)', 'POST', `/exercices/${n1}/arreter-a-la-dissolution`, { retirerActesDeLaPeriode: true });
    R.egal('A · arrêt · l’exercice finit le 30/06/2027', '2027-06-30', jour(r?.exercice?.dateFin));
    R.egal('A · arrêt · exercice de liquidation du 01/07/2027', '2027-07-01', jour(r?.exerciceDeLiquidation?.dateDebut));
    R.egal('A · arrêt · exercice de liquidation jusqu’à la clôture déclarée, 31/12/2027', '2027-12-31', jour(r?.exerciceDeLiquidation?.dateFin));
    R.montant('A · arrêt · trois écritures rattachées à la liquidation', 3, r?.ecrituresRattachees);
    R.montant('A · arrêt · un acte de la période retiré (la dotation)', 1, (r?.actesRetires ?? []).length);
    liste = await exercices(c);
    const liq = exerciceDebutant(liste, '2027-07-01');
    const lues = liq ? await ecrituresDe(c, liq.id) : new Map();
    for (const [cle, a] of Object.entries(avant)) {
      const l = lues.get(a.id);
      // AUDCIF art. 22 · ni la date, ni le numéro, ni le statut ne changent.
      R.egal(`A · arrêt · ${cle} dans l’exercice de liquidation, date, pièce et statut inchangés`, [a.date, a.numeroPiece, a.statut],
        l ? [jour(l.date), l.numeroPiece, l.statut] : null);
    }
    const b = await balance(c, n1);
    R.montant('A · arrêt · la dotation de l’année entière est retirée (6813 de l’exercice arrêté)', 0, solde(b, '6813'));
    const pl = await c.lire('Planning de l’exercice arrêté', `/exercices/${n1}/planning-cloture`);
    R.egal('A · arrêt · annulation de l’arrêt proposée', true, pl?.dissolution?.annulationProposee);
  });

  await etape(R, 'A · annulation de l’arrêt, puis nouvel arrêt', async () => {
    const r = await c.geste('Annulation de l’arrêt', 'POST', `/exercices/${n1}/annuler-arret-dissolution`, {});
    // L'exercice retrouve son 31 décembre ; la liquidation (01/07 au 31/12/2027)
    // ne va pas au-delà · elle disparaît et ses trois écritures reviennent.
    R.egal('A · annulation · l’exercice retrouve le 31/12/2027', '2027-12-31', jour(r?.exercice?.dateFin));
    R.montant('A · annulation · trois écritures rendues à l’exercice', 3, r?.ecrituresRattachees);
    liste = await exercices(c);
    R.egal('A · annulation · plus d’exercice de liquidation', null, exerciceDebutant(liste, '2027-07-01'));
    const lues = await ecrituresDe(c, n1);
    R.egal('A · annulation · les trois écritures sont revenues, inchangées', Object.values(avant).map((a) => [a.date, a.numeroPiece, a.statut]),
      Object.values(avant).map((a) => { const l = lues.get(a.id); return l ? [jour(l.date), l.numeroPiece, l.statut] : null; }));
    const r2 = await c.geste('Nouvel arrêt à la dissolution', 'POST', `/exercices/${n1}/arreter-a-la-dissolution`, {});
    R.egal('A · nouvel arrêt · l’exercice finit le 30/06/2027', '2027-06-30', jour(r2?.exercice?.dateFin));
    R.montant('A · nouvel arrêt · trois écritures rattachées', 3, r2?.ecrituresRattachees);
  });

  liste = await exercices(c);
  const liqEx = exerciceDebutant(liste, '2027-07-01');
  const lq = liqEx?.id;
  if (!lq) {
    R.note('A · exercice de liquidation absent · la suite n’est pas jouée');
    return;
  }

  await etape(R, 'A · aucun exercice civil après la dissolution', async () => {
    // AUDCIF art. 7 al. 4 · la liquidation forme un seul exercice.
    await refusAttendu(c, R, 'A · création d’un exercice civil 2028', 'POST', '/exercices', { dateDebut: '2028-01-01', dateFin: '2028-12-31' }, /liquidation|dissolution/i);
  });

  await etape(R, 'A · exercice arrêté · dotation au prorata et première cotisation', async () => {
    // Dotation de la période du 01/01 au 30/06/2027 · 6 000 000 × 6/12 = 3 000 000.
    if (ctx.vehicule) await c.geste('Dotation de la période d’activité', 'POST', `/immobilisations/${ctx.vehicule.id}/dotation`, { exerciceId: n1, journalId: od.id });
    await validerJusqua(c, n1, '2027-06-30');
    const b0 = await balance(c, n1);
    R.montant('A · exercice arrêté · dotation de six mois (6813)', 3_000_000, solde(b0, '6813'));
    const rf = await c.lire('Résultat fiscal de la période d’activité', `/fiscalite/resultat-fiscal?exerciceId=${n1}`);
    // 30 000 000 − 8 000 000 − 3 000 000 = 19 000 000 ; impôt 30 % = 5 700 000 ;
    // minimum 1 % × 30 000 000 = 300 000, non retenu.
    R.montant('A · exercice arrêté · résultat fiscal', 19_000_000, rf?.resultatFiscal);
    R.montant('A · exercice arrêté · première cotisation (30 %)', 5_700_000, rf?.impotDu);
    R.egal('A · exercice arrêté · rôle « première cotisation »', 'PREMIERE_COTISATION', rf?.bilansSuccessifs?.role);
    R.egal('A · exercice arrêté · aucun acompte proposé pour l’année suivant la dissolution', [], rf?.acomptesProchainExercice ?? null);
    const p = await c.geste('Écriture de la première cotisation', 'POST', `/fiscalite/exercices/${n1}/ecriture-impot`, {});
    R.montant('A · exercice arrêté · constat de la première cotisation', 5_700_000, p?.constat?.montantImpot);
    await validerJusqua(c, n1, '2027-06-30');
    await c.geste('Réintégration de la première cotisation', 'POST', `/fiscalite/exercices/${n1}/retraitements`, { code: 'IMPOT_SUR_LE_RESULTAT', montant: 5_700_000, commentaire: 'Première cotisation spéciale comptabilisée au 891' });
    const b = await balance(c, n1);
    // Banque · 57 600 000 + 30 000 000 − 6 450 000 − 8 000 000 = 73 150 000.
    R.montant('A · exercice arrêté · banque au 30/06', 73_150_000, solde(b, BQ));
    R.montant('A · exercice arrêté · 441 (première cotisation due)', -5_700_000, solde(b, '441'));
    const bil = await bilanDe(c, n1);
    // Actif · 24 000 000 − 7 500 000 + 73 150 000 = 89 650 000 ; passif · capital
    // 50 000 000 + résultat 2026 au 13 20 650 000 + résultat 13 300 000 + 441 5 700 000.
    R.montant('A · exercice arrêté · bilan avant liquidation, total actif (BZ)', 89_650_000, bil.BZ);
    R.montant('A · exercice arrêté · bilan avant liquidation, total passif (DZ)', 89_650_000, bil.DZ);
    R.montant('A · exercice arrêté · résultat net (CJ) · 19 000 000 − 5 700 000', 13_300_000, bil.CJ);
  });

  await etape(R, 'A · planning de l’exercice arrêté et de la liquidation', async () => {
    const pa = await c.lire('Planning de l’exercice arrêté', `/exercices/${n1}/planning-cloture`);
    // LPF art. 16 · « dans le mois » de date à date (décision, point 5) · 30/06 → 30/07/2027, un vendredi.
    R.egal('A · planning arrêté · première cotisation, échéance 30/07/2027', '2027-07-30', jour(jalon(pa, /cotisation spéciale \(période d’activité\)/)?.echeance));
    R.egal('A · planning arrêté · l’autre lecture du mois (CPC art. 195) dite, 31/07/2027', true,
      /31\/07\/2027/.test(jalon(pa, /cotisation spéciale \(période d’activité\)/)?.detail ?? ''));
    // AUSCGIE art. 266 · un mois de la nomination (30/06/2027) → 30/07/2027.
    R.egal('A · planning arrêté · publication de la nomination du liquidateur, 30/07/2027', '2027-07-30', jour(jalon(pa, /Publication de la nomination du liquidateur/)?.echeance));
    R.egal('A · planning arrêté · bilan avant liquidation, sans délai', true, jalon(pa, /Bilan avant liquidation/)?.sansDelai === true);
    // AUSCGIE art. 216 · trois ans de la dissolution → 30/06/2030.
    R.egal('A · planning · clôture de la liquidation au plus tard le 30/06/2030', '2030-06-30',
      jour((jalon(pa, /^Clôture de la liquidation$/) ?? jalon(await c.lire('Planning de la liquidation', `/exercices/${lq}/planning-cloture`), /^Clôture de la liquidation$/))?.echeance));
    // LPF art. 16 sur l'art. 12 · plus de déclaration annuelle de l'IS pour l'année de la dissolution.
    R.egal('A · planning arrêté · plus de déclaration annuelle de l’IS', null, jalon(pa, /^Déclarations fiscales annuelles$/));
    const pl = await c.lire('Planning de la liquidation', `/exercices/${lq}/planning-cloture`);
    // Clôture déclarée 31/12/2027 → 31/01/2028, un lundi.
    R.egal('A · planning liquidation · seconde cotisation, échéance 31/01/2028', '2028-01-31', jour(jalon(pl, /cotisation spéciale \(dernier bilan de liquidation\)/)?.echeance));
    R.egal('A · planning liquidation · plus de déclaration annuelle de l’IS', null, jalon(pl, /^Déclarations fiscales annuelles$/));
    R.egal('A · planning liquidation · exercice de liquidation reconnu', true, pl?.dissolution?.exerciceDeLiquidation);
  });

  await etape(R, 'A · échéancier fiscal de l’année de la dissolution', async () => {
    const e1 = await c.lire('Échéancier au 01/07/2027', `/retenues/echeancier?exerciceId=${n1}&dateReference=2027-07-01`);
    // Décision, point 3 · acomptes de l'année de la dissolution dus jusqu'à la
    // dernière cotisation (31/01/2028). 25/07/2027 dimanche → lundi 26/07 ;
    // 25/09/2027 samedi, gardé (paiement en banque) ; 25/11/2027 jeudi.
    R.egal('A · échéancier 01/07/2027 · premier acompte (26/07/2027)', '2027-07-26', jour(echeanceDe(e1, 'premierAcompteIs')?.date));
    R.egal('A · échéancier 01/07/2027 · deuxième acompte (25/09/2027)', '2027-09-25', jour(echeanceDe(e1, 'deuxiemeAcompteIs')?.date));
    R.egal('A · échéancier 01/07/2027 · troisième acompte (25/11/2027)', '2027-11-25', jour(echeanceDe(e1, 'troisiemeAcompteIs')?.date));
    R.egal('A · échéancier 01/07/2027 · l’acompte dit s’imputer sur les cotisations', true, /Société dissoute/.test(echeanceDe(e1, 'premierAcompteIs')?.reserve ?? ''));
    R.egal('A · échéancier 01/07/2027 · cotisation de la période d’activité (30/07/2027)', '2027-07-30', jour(echeanceDe(e1, 'cotisationSpecialeActivite')?.date));
    R.egal('A · échéancier 01/07/2027 · seconde cotisation (31/01/2028)', '2028-01-31', jour(echeanceDe(e1, 'cotisationSpecialeLiquidation')?.date));
    // Décision, point 4 · la déclaration du 30/04/2028 (revenus 2027) n'est pas due.
    R.egal('A · échéancier 01/07/2027 · plus de déclaration annuelle de l’IS', null, echeanceDe(e1, 'declarationImpotSocietes'));
    const e2 = await c.lire('Échéancier au 05/01/2028', `/retenues/echeancier?exerciceId=${lq}&dateReference=2028-01-05`);
    // Les prochains acomptes tomberaient en 2028, année suivant la dissolution · aucun.
    R.egal('A · échéancier 05/01/2028 · aucun acompte de 2028', [null, null, null],
      ['premierAcompteIs', 'deuxiemeAcompteIs', 'troisiemeAcompteIs'].map((k) => echeanceDe(e2, k)));
    R.egal('A · échéancier 05/01/2028 · seconde cotisation encore servie', '2028-01-31', jour(echeanceDe(e2, 'cotisationSpecialeLiquidation')?.date));
  });

  await etape(R, 'A · clôture de l’exercice arrêté (bilan avant liquidation)', async () => {
    const r = await cloturerExercice(c, 'exercice arrêté au 30/06/2027', n1);
    R.egal('A · clôture de l’exercice arrêté', true, r !== null);
    const b = await balance(c, lq);
    // À-nouveaux au 01/07/2027 · banque 73 150 000, 441 −5 700 000, capitaux
    // propres 50 000 000 + 20 650 000 + 13 300 000 (12 et 13 ensemble).
    R.montant('A · liquidation · à-nouveau banque', 73_150_000, solde(b, BQ));
    R.montant('A · liquidation · à-nouveau 441', -5_700_000, solde(b, '441'));
    R.montant('A · liquidation · à-nouveau report et résultat (12 + 13)', -33_950_000, auC(solde(b, '12') + solde(b, '13')));
  });

  await etape(R, 'A · opérations de la liquidation', async () => {
    // La première cotisation se règle « immédiatement » (art. 13 al. 1) · le 30/07/2027.
    await ecriture(c, 'Paiement de la première cotisation', lq, '2027-07-30', 'Cotisation spéciale · période d’activité', [['44100000', 5_700_000, 0], [BQ, 0, 5_700_000]], { journal: bq, reference: 'CS-ACT' });
    await ecriture(c, 'Acompte d’IS du 2027-09-24', lq, '2027-09-24', 'Acompte provisionnel IS', [['44920000', 2_655_000, 0], [BQ, 0, 2_655_000]], { journal: bq, reference: 'ACP-2027-09' });
    await ecriture(c, 'Acompte d’IS du 2027-11-25', lq, '2027-11-25', 'Acompte provisionnel IS', [['44920000', 1_770_000, 0], [BQ, 0, 1_770_000]], { journal: bq, reference: 'ACP-2027-11' });
    if (ctx.vehicule) {
      // Cession au 30/09/2027 pour 9 000 000 · dotation arrêtée à la sortie,
      // mois de sortie compris (juillet à septembre) · 6 000 000 × 3/12 = 1 500 000 ;
      // cumul 4 500 000 + 3 000 000 + 1 500 000 = 9 000 000 ; VNC 15 000 000.
      await c.geste('Cession du véhicule en liquidation', 'POST', `/immobilisations/${ctx.vehicule.id}/sortie`, {
        dateSortie: '2027-09-30', type: 'CESSION', exerciceId: lq, journalId: od.id, prixCession: 9_000_000, compteContrepartieId: compte(c, BQ),
        natureSortie: 'VENTE', referencePieceSortie: 'ACTE-CESSION-2027', datePieceSortie: '2027-09-30',
      });
    }
    await validerJusqua(c, lq, '2027-12-31');
    const b = await balance(c, lq);
    R.montant('A · liquidation · dotation jusqu’à la sortie (6813)', 1_500_000, solde(b, '6813'));
    R.montant('A · liquidation · valeur comptable sortie (812)', 15_000_000, solde(b, '812'));
    R.montant('A · liquidation · prix de cession (822)', -9_000_000, solde(b, '822'));
    R.montant('A · liquidation · ventes (7011)', -10_000_000, solde(b, '7011'));
    R.montant('A · liquidation · honoraires du liquidateur (6324)', 14_500_000, solde(b, '6324'));
    R.montant('A · liquidation · acomptes de l’année au 4492 (2 655 000 × 2 + 1 770 000)', 7_080_000, solde(b, '4492'));
    R.montant('A · liquidation · véhicule sorti (2451 et 2845 soldés)', 0, auC(solde(b, '2451') + solde(b, '2845')));
  });

  await etape(R, 'A · totalisation de l’année de la dissolution et seconde cotisation', async () => {
    await c.geste('Acomptes versés pendant la liquidation', 'PATCH', `/fiscalite/exercices/${lq}/dossier`, { acomptesVerses: 7_080_000 });
    const rf = await c.lire('Résultat fiscal de la liquidation', `/fiscalite/resultat-fiscal?exerciceId=${lq}`);
    const t = rf?.bilansSuccessifs?.totalisation;
    R.egal('A · liquidation · rôle « seconde cotisation »', 'SECONDE_COTISATION', rf?.bilansSuccessifs?.role);
    R.egal('A · liquidation · première cotisation lue sur son constat', 'CONSTAT', rf?.bilansSuccessifs?.sourcePremiereCotisation);
    // Liquidation · 10 000 000 + 9 000 000 − 15 000 000 − 1 500 000 − 14 500 000 = −12 000 000.
    R.montant('A · liquidation · résultat comptable', -12_000_000, rf?.resultatComptable);
    R.montant('A · totalisation · période d’activité', 19_000_000, t?.periodeActivite?.resultatFiscalAvantReport);
    R.montant('A · totalisation · liquidation', -12_000_000, t?.liquidation?.resultatFiscalAvantReport);
    // Art. 12 al. 4 · 19 000 000 − 12 000 000 = 7 000 000.
    R.montant('A · totalisation · total des bilans successifs', 7_000_000, t?.total);
    R.montant('A · totalisation · chiffre d’affaires de l’année (30 000 000 + 10 000 000)', 40_000_000, t?.chiffreAffaires);
    // 30 % × 7 000 000 = 2 100 000 ; minimum 1 % × 40 000 000 = 400 000.
    R.montant('A · totalisation · impôt de l’année (30 %)', 2_100_000, t?.impotTotal);
    R.montant('A · totalisation · impôt minimum de l’année', 400_000, t?.impotMinimum);
    // Réglé · 5 700 000 + 7 080 000 = 12 780 000 ; excédent 12 780 000 − 2 100 000 = 10 680 000.
    R.montant('A · totalisation · déjà réglé (première cotisation et acomptes)', 12_780_000, t?.dejaRegle);
    R.montant('A · totalisation · seconde cotisation', 0, t?.secondeCotisation);
    R.montant('A · totalisation · excédent réglé', 10_680_000, t?.excedent);
    R.montant('A · totalisation · impôt du 891 de la liquidation (2 100 000 − 5 700 000, borné à 0)', 0, t?.cotisationDeLExercice);
    // Trop-payé de la première · 5 700 000 − 2 100 000 = 3 600 000 (D 441 / C 8994).
    R.montant('A · totalisation · trop-payé de la première cotisation', 3_600_000, t?.tropPayePremiereCotisation);
    // Excédent d'acomptes · 10 680 000 − 3 600 000 = 7 080 000, reste au 4492 (art. 57 ter).
    R.montant('A · totalisation · excédent d’acomptes restant au 4492', 7_080_000, t?.excedentAcomptes);

    const prop = await c.lire('Écriture de l’impôt de la liquidation · proposition', `/fiscalite/exercices/${lq}/ecriture-impot`);
    R.montant('A · liquidation · proposition · impôt de l’exercice', 0, prop?.proposition?.impot);
    R.montant('A · liquidation · proposition · trop-payé', 3_600_000, prop?.proposition?.tropPaye);
    R.egal('A · liquidation · proposition · D 44100000 / C 89940000 du trop-payé', [['44100000', 3_600_000, 0], ['89940000', 0, 3_600_000]],
      (prop?.proposition?.lignes ?? []).map((l) => [l.numero, l.debit, l.credit]));
    // L'impôt de l'exercice est nul · imputer les acomptes est refusé (art. 57 ter).
    await refusAttendu(c, R, 'A · liquidation · imputation des acomptes sur un impôt nul', 'POST', `/fiscalite/exercices/${lq}/ecriture-impot`, { imputerAcomptes: true }, /57 ter|Aucun impôt/);
    const p = await c.geste('Écriture du trop-payé de la première cotisation', 'POST', `/fiscalite/exercices/${lq}/ecriture-impot`, {});
    R.montant('A · liquidation · constat · trop-payé', 3_600_000, p?.constat?.tropPayeLiquidation);
    await validerJusqua(c, lq, '2027-12-31');
    const b = await balance(c, lq);
    // 441 · −5 700 000 (à-nouveau) + 5 700 000 (paiement) + 3 600 000 = +3 600 000, créance sur l'État.
    R.montant('A · liquidation · 441 débiteur du trop-payé', 3_600_000, solde(b, '441'));
    R.montant('A · liquidation · 8994 crédité', -3_600_000, solde(b, '8994'));
    R.montant('A · liquidation · 891 non mouvementé', 0, solde(b, '891'));
    R.montant('A · liquidation · 4492 inchangé', 7_080_000, solde(b, '4492'));
    // Banque · 73 150 000 − 5 700 000 − 2 655 000 × 2 + 10 000 000 + 9 000 000 − 14 500 000 − 1 770 000.
    R.montant('A · liquidation · banque', 64_870_000, solde(b, BQ));

    // LE 8994 SUIT LE SORT DU 899 · nommé, jamais déduit d'office.
    const rf2 = await c.lire('Résultat fiscal de la liquidation après le trop-payé', `/fiscalite/resultat-fiscal?exerciceId=${lq}`);
    R.montant('A · liquidation · résultat comptable avec le 8994 (−12 000 000 + 3 600 000)', -8_400_000, rf2?.resultatComptable);
    R.egal('A · liquidation · le 8994 est nommé (observation du dégrèvement)', true, JSON.stringify(rf2?.observations ?? []).includes('DÉGRÈVEMENT AU 899'));
    const e1 = await c.lire('Constat de la liquidation · avant la déduction', `/fiscalite/exercices/${lq}/ecriture-impot`);
    // Sans déduction · total 19 000 000 − 8 400 000 = 10 600 000 → 3 180 000 · trop-payé 2 520 000, l'écart dit.
    R.montant('A · liquidation · trop-payé recalculé sans la déduction du 8994', 2_520_000, e1?.constat?.tropPayeRecalcule);
    await c.geste('Déduction du 8994 (ligne libre)', 'POST', `/fiscalite/exercices/${lq}/retraitements`, {
      code: 'AUTRE', sens: 'DEDUCTION', libelle: 'Annulation de la première cotisation au 8994', montant: 3_600_000,
      commentaire: 'Loi n° 23/053, art. 45 a contrario · l’annulation de l’IS, impôt non déductible, n’est pas une recette imposable',
    });
    const e2 = await c.lire('Constat de la liquidation · après la déduction', `/fiscalite/exercices/${lq}/ecriture-impot`);
    R.montant('A · liquidation · trop-payé recalculé après la déduction', 3_600_000, e2?.constat?.tropPayeRecalcule);
    R.montant('A · liquidation · écart du constat avec le calcul', 0, e2?.constat?.ecartAvecCalcul);
    const bil = await bilanDe(c, lq);
    // Actif · banque 64 870 000 + 441 3 600 000 + 4492 7 080 000 = 75 550 000 ;
    // passif · 50 000 000 + 33 950 000 − 8 400 000 = 75 550 000.
    R.montant('A · liquidation · bilan, total actif (BZ)', 75_550_000, bil.BZ);
    R.montant('A · liquidation · bilan, total passif (DZ)', 75_550_000, bil.DZ);
    R.montant('A · liquidation · résultat net (CJ)', -8_400_000, bil.CJ);
  });

  await etape(R, 'A · clôture de la liquidation', async () => {
    const r = await cloturerExercice(c, 'exercice de liquidation', lq);
    R.egal('A · clôture de la liquidation · passée', true, r !== null);
    R.egal('A · clôture de la liquidation · aucun exercice ne suit (message)', true, /aucun exercice ne suit/.test(JSON.stringify(r?.issueOuverture ?? '')));
    liste = await exercices(c);
    R.egal('A · après la clôture · aucun exercice postérieur au 31/12/2027', [], liste.filter((e) => jour(e.dateDebut) > '2027-12-31').map((e) => jour(e.dateDebut)));
    R.egal('A · après la clôture · trois exercices (2026, arrêté, liquidation)', 3, liste.length);
  });
}

/** Arrondi au centime pour une somme de soldes. */
const auC = (x) => (x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x * 100) / 100);

// =====================================================================================
// DOSSIER B · Minière de la Lufira SA · entreprise minière du portefeuille de l'État
// =====================================================================================

async function dossierPortefeuille(R) {
  const c = await nouveauDossier(R, 'Passe V1 · Minière de la Lufira SA', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'fin-sa', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;

  await etape(R, 'B · paramètres · SA du portefeuille, secteur minier, quote-part de l’État', async () => {
    await c.geste('Forme SA', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });
    // Décision du 2026-10-07, point 3 · la quote-part se déclare AVEC sa source.
    await refusAttendu(c, R, 'B · quote-part de l’État sans source', 'PATCH', '/dossier/identite', { quotePartEtatCapital: 20 }, /source/i);
    await c.geste('Portefeuille de l’État, secteur minier, quote-part 20 %', 'PATCH', '/dossier/identite', {
      entreprisePortefeuilleEtat: 'OUI', portefeuilleSecteurMinier: 'OUI', quotePartEtatCapital: 20,
      sourceQuotePartEtat: 'Registre des actionnaires au 31/12/2026, art. 6 des statuts (banc passe V1)',
    });
    await ouverture(c, n, '2026-01-01', [[BQ, 'Banque', 100_000_000, 0], ['10130000', 'Capital', 0, 100_000_000]]);
  });

  await etape(R, 'B · 2026 · bénéfice, impôt, dividende provisoire', async () => {
    await ecriture(c, 'Vente de minerai 2026', n, '2026-06-15', 'Vente de cuivre', [[BQ, 40_000_000, 0], [VENTES, 0, 40_000_000]], { journal: bq, reference: 'FV-LUF-01' });
    await ecriture(c, 'Loyer 2026', n, '2026-09-01', 'Loyer du dépôt', [[LOYER, 15_000_000, 0], [BQ, 0, 15_000_000]], { journal: bq, reference: 'LOY-LUF' });
    await validerJusqua(c, n, '2026-12-31');
    // 40 000 000 − 15 000 000 = 25 000 000 ; IS 30 % = 7 500 000 (minimum 400 000).
    const p = await c.geste('Écriture de l’impôt 2026 (SA)', 'POST', `/fiscalite/exercices/${n}/ecriture-impot`, {});
    R.montant('B 2026 · impôt constaté (30 % × 25 000 000)', 7_500_000, p?.constat?.montantImpot);
    await validerJusqua(c, n, '2026-12-31');
    await c.geste('Réintégration de l’impôt 2026', 'POST', `/fiscalite/exercices/${n}/retraitements`, { code: 'IMPOT_SUR_LE_RESULTAT', montant: 7_500_000, commentaire: 'Impôt comptabilisé au 891' });
    const pl = await c.lire('Planning 2026 avant l’arrêté', `/exercices/${n}/planning-cloture`);
    const decl = jalon(pl, /^Déclaration du dividende prioritaire de l’État$/);
    // Arrêté du 10/12/2025, art. 2 et 3 · bénéfice net comptable 25 000 000 − 7 500 000
    // = 17 500 000 × 20 % = 3 500 000, au plus tard le 15 mai de l'année qui suit.
    R.montant('B 2026 · dividende prioritaire (17 500 000 × 20 %)', 3_500_000, decl?.montant);
    R.egal('B 2026 · dividende provisoire (exercice ni clôturé ni arrêté)', true, decl?.montantProvisoire === true);
    R.egal('B 2026 · déclaration du dividende au 15/05/2027', '2027-05-15', jour(decl?.echeance));
    R.egal('B 2026 · paiement en attente de la note de perception', 'En attente de la note de perception', jalon(pl, /^Paiement du dividende prioritaire de l’État$/)?.enAttente ?? null);
    // O.-L. n° 13/003, art. 112 · assemblée au 31 mars de l'année qui suit.
    R.egal('B 2026 · assemblée (étape 23) au 31/03/2027', '2027-03-31', jour(jalon(pl, /./, 23)?.echeance));
    // AUSCGIE art. 140, délai franc · 31/03/2027 − 46 jours = 13/02/2027.
    R.egal('B 2026 · envoi aux commissaires (étape 17) au 13/02/2027', '2027-02-13', jour(jalon(pl, /./, 17)?.echeance));
    R.egal('B 2026 · délai franc dit, avec l’autre lecture', true, /jours francs/.test(jalon(pl, /./, 17)?.detail ?? ''));
    // AUSCGIE art. 269 · un mois de l'assemblée · 30/04/2027.
    R.egal('B 2026 · dépôt au RCCM (étape 24) au 30/04/2027', '2027-04-30', jour(jalon(pl, /./, 24)?.echeance));
    // Art. 112 · PV dix jours calendaires après le 31 mars, faute d'assemblée déclarée · 10/04/2027.
    R.egal('B 2026 · PV à l’Administration des recettes non fiscales au 10/04/2027', '2027-04-10', jour(jalon(pl, /Procès-verbal à l’Administration des recettes non fiscales/)?.echeance));
  });

  await etape(R, 'B · 2026 · arrêté des comptes, dates déclarées, dividende payé', async () => {
    await c.geste('Arrêté des comptes 2026', 'POST', `/exercices/${n}/arrete-comptes`, { dateArreteComptes: '2027-03-01' });
    let pl = await c.lire('Planning 2026 après l’arrêté', `/exercices/${n}/planning-cloture`);
    const decl = jalon(pl, /^Déclaration du dividende prioritaire de l’État$/);
    R.montant('B 2026 · après l’arrêté · dividende', 3_500_000, decl?.montant);
    R.egal('B 2026 · après l’arrêté · le montant n’est plus provisoire', false, decl?.montantProvisoire === true);
    await c.geste('Dates du portefeuille · assemblée, PV, dépôt, déclaration, note', 'POST', `/exercices/${n}/dates-portefeuille`, {
      dateAssembleeGenerale: '2027-03-25', dateTransmissionPvPortefeuille: '2027-04-02', dateDepotEtatsPortefeuille: '2027-04-05',
      dateDeclarationDividendeEtat: '2027-05-10', dateNotePerceptionDividende: '2027-05-20',
    });
    // Arrêté, art. 2 · le paiement court de la réception de la note et ne la précède pas.
    await refusAttendu(c, R, 'B · paiement du dividende avant la note de perception', 'POST', `/exercices/${n}/dates-portefeuille`, { datePaiementDividendeEtat: '2027-05-18' }, /note de perception/);
    await c.geste('Paiement du dividende', 'POST', `/exercices/${n}/dates-portefeuille`, { datePaiementDividendeEtat: '2027-05-27' });
    pl = await c.lire('Planning 2026 avec les dates déclarées', `/exercices/${n}/planning-cloture`);
    // 25/03/2027 − 46 jours = 07/02/2027 ; RCCM 25/04/2027 ; PV 25/03 + 10 = 04/04/2027 ;
    // affectation 05/04/2027 + 60 jours = 04/06/2027 ; paiement 20/05 + 8 = 28/05/2027.
    R.egal('B 2026 · étape 17 recomptée sur l’assemblée déclarée (07/02/2027)', '2027-02-07', jour(jalon(pl, /./, 17)?.echeance));
    R.egal('B 2026 · RCCM recompté (25/04/2027)', '2027-04-25', jour(jalon(pl, /./, 24)?.echeance));
    const pv = jalon(pl, /Procès-verbal à l’Administration des recettes non fiscales/);
    R.egal('B 2026 · PV recompté (04/04/2027) et levé', ['2027-04-04', true], [jour(pv?.echeance), pv?.observation?.satisfait === true]);
    R.egal('B 2026 · affectation, soixante jours du dépôt (04/06/2027)', '2027-06-04', jour(jalon(pl, /^Affectation des résultats · entreprise du portefeuille/)?.echeance));
    const pai = jalon(pl, /^Paiement du dividende prioritaire de l’État$/);
    R.egal('B 2026 · paiement du dividende, huit jours de la note (28/05/2027), levé', ['2027-05-28', true], [jour(pai?.echeance), pai?.observation?.satisfait === true]);
    R.egal('B 2026 · déclaration du dividende levée', true, jalon(pl, /^Déclaration du dividende prioritaire de l’État$/)?.observation?.satisfait === true);
  });

  await etape(R, 'B · 2026 · PV de la LPF art. 13 bis', async () => {
    // AG du 25/03/2027 + 10 jours = 04/04/2027, un dimanche · reporté au lundi
    // 05/04/2027 (LPF art. 110 bis, al. 2 ; le 6 avril est férié, pas le 5).
    let e = await c.lire('Échéancier au 26/03/2027', `/retenues/echeancier?exerciceId=${n}&dateReference=2027-03-26`);
    let pv = echeanceDe(e, 'procesVerbalAssemblee');
    R.egal('B · PV art. 13 bis · dû le 05/04/2027', '2027-04-05', jour(pv?.date));
    // SA sans mandat enregistré · servi « à confirmer » (AUSCGIE art. 694, 702).
    R.egal('B · PV art. 13 bis · « à confirmer » sans mandat enregistré', true, /à confirmer/.test(pv?.echeance ?? ''));
    await c.geste('Mandat du commissaire aux comptes', 'POST', '/mandat-auditeur', {
      nom: 'Cabinet Ngoie & Associés', inscriptionOrdre: 'ONEC n° 0420 (banc)', organeDesignation: 'ASSEMBLEE_GENERALE_ORDINAIRE',
      dateDesignation: '2026-03-30', premierExercice: 2026, nombreExercices: 6,
    });
    e = await c.lire('Échéancier au 26/03/2027 avec le mandat', `/retenues/echeancier?exerciceId=${n}&dateReference=2027-03-26`);
    pv = echeanceDe(e, 'procesVerbalAssemblee');
    R.egal('B · PV art. 13 bis · servi sans réserve une fois le mandat enregistré', ['2027-04-05', false], [jour(pv?.date), /à confirmer/.test(pv?.echeance ?? '')]);
  });

  const clos = await etape(R, 'B · clôture 2026', () => cloturerExercice(c, '2026 (SA)', n));
  const n1 = exerciceDebutant(await exercices(c), '2027-01-01')?.id;
  if (!clos || !n1) return R.note('B · 2027 non joué');

  await etape(R, 'B · 2027 · perte · aucun dividende', async () => {
    await ecriture(c, 'Vente de minerai 2027', n1, '2027-05-10', 'Vente de cuivre', [[BQ, 5_000_000, 0], [VENTES, 0, 5_000_000]], { journal: bq, reference: 'FV-LUF-02' });
    await ecriture(c, 'Loyer 2027', n1, '2027-08-01', 'Loyer du dépôt', [[LOYER, 20_000_000, 0], [BQ, 0, 20_000_000]], { journal: bq, reference: 'LOY-LUF-2' });
    await validerJusqua(c, n1, '2027-12-31');
    // Perte 15 000 000 · impôt minimum 1 % × 5 000 000 = 50 000 au 895 (art. 57).
    const p = await c.geste('Écriture de l’impôt 2027 (minimum)', 'POST', `/fiscalite/exercices/${n1}/ecriture-impot`, {});
    R.montant('B 2027 · impôt minimum constaté', 50_000, p?.constat?.montantImpot);
    await validerJusqua(c, n1, '2027-12-31');
    const b = await balance(c, n1);
    R.montant('B 2027 · impôt minimum au 895', 50_000, solde(b, '895'));
    let pl = await c.lire('Planning 2027 avant l’arrêté', `/exercices/${n1}/planning-cloture`);
    let decl = jalon(pl, /^Déclaration du dividende prioritaire de l’État$/);
    // Exercice ouvert, résultat provisoire en perte · le montant attend le résultat.
    R.egal('B 2027 · perte provisoire · montant en attente du résultat', [null, true], [decl?.montant ?? null, decl?.montantEnAttente === true]);
    await c.geste('Arrêté des comptes 2027', 'POST', `/exercices/${n1}/arrete-comptes`, { dateArreteComptes: '2028-02-01' });
    pl = await c.lire('Planning 2027 après l’arrêté', `/exercices/${n1}/planning-cloture`);
    decl = jalon(pl, /^Déclaration du dividende prioritaire de l’État$/);
    // Arrêté, art. 2 · « lorsqu'un bénéfice net comptable est réalisé » · comptes arrêtés en perte, rien n'est dû.
    R.montant('B 2027 · comptes arrêtés en perte · dividende nul', 0, decl?.montant);
    R.egal('B 2027 · comptes arrêtés en perte · jalon levé (aucun dividende)', true, decl?.observation?.satisfait === true);
    R.egal('B 2027 · comptes arrêtés en perte · aucun paiement servi', null, jalon(pl, /^Paiement du dividende prioritaire de l’État$/));
  });
}

// =====================================================================================
// DOSSIER C · Lualaba Services SARLU · dissolution sans liquidation (AUSCGIE art. 201 al. 4)
// =====================================================================================

async function dossierSansLiquidation(R) {
  const c = await nouveauDossier(R, 'Passe V1 · Lualaba Services SARLU', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'fin-sarlu', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;

  await etape(R, 'C · paramètres, ouverture et opérations 2026', async () => {
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await ouverture(c, n, '2026-01-01', [[BQ, 'Banque', 20_000_000, 0], ['10130000', 'Capital', 0, 20_000_000]]);
    await ecriture(c, 'Vente 2026', n, '2026-03-15', 'Prestation de service', [[BQ, 12_000_000, 0], [VENTES, 0, 12_000_000]], { journal: bq, reference: 'FV-LUA-01' });
    await ecriture(c, 'Loyer 2026', n, '2026-04-01', 'Loyer', [[LOYER, 2_000_000, 0], [BQ, 0, 2_000_000]], { journal: bq, reference: 'LOY-LUA' });
    // Acomptes 2026 sur l'impôt 2025 posé à 2 000 000 · 600 000, 600 000 (le 25/07/2026 est un samedi, versé la veille).
    for (const [date, m] of [['2026-07-24', 600_000], ['2026-09-25', 600_000]]) {
      await ecriture(c, `Acompte d’IS du ${date}`, n, date, 'Acompte provisionnel IS', [['44920000', m, 0], [BQ, 0, m]], { journal: bq, reference: `ACP-${date}` });
    }
    await validerJusqua(c, n, '2026-09-30');
  });

  let apres = null;
  await etape(R, 'C · dissolution sans liquidation · arrêt refusé tant qu’une opération suit', async () => {
    apres = await ecriture(c, 'Vente datée après la dissolution', n, '2026-10-10', 'Prestation après dissolution', [[BQ, 1_000_000, 0], [VENTES, 0, 1_000_000]], { journal: bq, reference: 'FV-LUA-02' });
    await c.geste('Faits · associé unique personne morale, dissolution au 30/09/2026', 'PATCH', '/dossier/identite', {
      dateDissolution: '2026-09-30', associeUniquePersonneMorale: 'OUI',
    });
    // AUSCGIE art. 201 al. 4 · le patrimoine passe à l'associé · l'opération
    // datée après la dissolution relève de sa comptabilité, refus nommé.
    await refusAttendu(c, R, 'C · arrêt avec une écriture datée après la dissolution', 'POST', `/exercices/${n}/arreter-a-la-dissolution`, {}, /201 al\. 4/);
    if (apres?.id) await c.geste('Suppression de l’écriture au brouillard datée après la dissolution', 'DELETE', `/ecritures/${apres.id}`);
    const r = await c.geste('Arrêt à la dissolution (sans liquidation)', 'POST', `/exercices/${n}/arreter-a-la-dissolution`, {});
    R.egal('C · arrêt · l’exercice finit le 30/09/2026', '2026-09-30', jour(r?.exercice?.dateFin));
    R.egal('C · arrêt · aucun exercice de liquidation', null, r?.exerciceDeLiquidation ?? null);
  });

  await etape(R, 'C · cotisation unique et acomptes bornés', async () => {
    await c.geste('Acomptes versés en 2026', 'PATCH', `/fiscalite/exercices/${n}/dossier`, { acomptesVerses: 1_200_000 });
    const rf = await c.lire('Résultat fiscal de la période d’activité', `/fiscalite/resultat-fiscal?exerciceId=${n}`);
    // 12 000 000 − 2 000 000 = 10 000 000 ; 30 % = 3 000 000 (minimum 120 000).
    R.egal('C · rôle « cotisation unique »', 'COTISATION_UNIQUE', rf?.bilansSuccessifs?.role);
    R.montant('C · cotisation unique (30 % × 10 000 000)', 3_000_000, rf?.impotDu);
    const p = await c.geste('Écriture de la cotisation unique', 'POST', `/fiscalite/exercices/${n}/ecriture-impot`, { imputerAcomptes: true });
    R.montant('C · constat · cotisation', 3_000_000, p?.constat?.montantImpot);
    R.montant('C · constat · acomptes imputés', 1_200_000, p?.constat?.montantImpute);
    await validerJusqua(c, n, '2026-09-30');
    const b = await balance(c, n);
    // 441 · −3 000 000 + 1 200 000 = −1 800 000 ; 4492 · 0.
    R.montant('C · 441 · reste dû', -1_800_000, solde(b, '441'));
    R.montant('C · 4492 · imputé', 0, solde(b, '4492'));
    // Dernière cotisation · la cotisation unique, dans le mois de la
    // dissolution · 30/09/2026 → 30/10/2026 (un vendredi). Au 01/07/2026 · les
    // acomptes du 25/07 (samedi, gardé) et du 25/09 restent dus, celui du
    // 25/11/2026 échoit après la dernière cotisation · plus dû (décision, point 3).
    const e = await c.lire('Échéancier au 01/07/2026', `/retenues/echeancier?exerciceId=${n}&dateReference=2026-07-01`);
    R.egal('C · échéancier · cotisation unique au 30/10/2026', '2026-10-30', jour(echeanceDe(e, 'cotisationSpecialeActivite')?.date));
    R.egal('C · échéancier · acomptes du 25/07 et du 25/09/2026 dus, pas celui du 25/11',
      ['2026-07-25', '2026-09-25', null], ['premierAcompteIs', 'deuxiemeAcompteIs', 'troisiemeAcompteIs'].map((k) => jour(echeanceDe(e, k)?.date)));
    R.egal('C · échéancier · aucune seconde cotisation', null, echeanceDe(e, 'cotisationSpecialeLiquidation'));
    const pl = await c.lire('Planning de l’exercice arrêté', `/exercices/${n}/planning-cloture`);
    R.egal('C · planning · dissolution sans liquidation nommée', true, Boolean(jalon(pl, /Dissolution sans liquidation/)));
    R.egal('C · planning · cotisation unique au 30/10/2026', '2026-10-30', jour(jalon(pl, /cotisation spéciale \(période d’activité\)/)?.echeance));
  });

  await etape(R, 'C · clôture sans exercice suivant', async () => {
    const r = await cloturerExercice(c, 'exercice arrêté sans liquidation', n);
    R.egal('C · clôture · passée', true, r !== null);
    R.egal('C · clôture · dernier exercice, aucun report (message)', true, /dissoute sans liquidation/.test(JSON.stringify(r?.issueOuverture ?? '')));
    const liste = await exercices(c);
    R.egal('C · après la clôture · un seul exercice, aucun exercice suivant', 1, liste.length);
  });
}

export default async function scenarioFinSociete(registre) {
  registre.scenario = 'fin-societe';
  const R = registre;
  await dossierSarlDissoute(R).catch((e) => R.note(`Dossier A interrompu · ${e.stack ?? e.message}`));
  await dossierPortefeuille(R).catch((e) => R.note(`Dossier B interrompu · ${e.stack ?? e.message}`));
  await dossierSansLiquidation(R).catch((e) => R.note(`Dossier C interrompu · ${e.stack ?? e.message}`));
}
