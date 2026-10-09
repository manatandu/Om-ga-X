/**
 * SCÉNARIO PAQUET 1 · LIGNE A (états et clôture), docs/plan-version-1.md § 7.
 *
 * Chaque point est joué sur un dossier neuf, par l'API du serveur compilé,
 * À TRAVERS UNE CLÔTURE quand il la touche (N clôturé, N+1 lu). Chaque
 * contrôle exprime le comportement JUSTE · contre `main` (avant correction),
 * il sort en écart ; après correction, il concorde.
 *
 * PAQUET1_A_POINTS=A8,A1 ne joue que les points nommés (tous par défaut).
 *
 * Tous les montants attendus sont calculés à la main en commentaire, à côté
 * de leur contrôle ; aucun numéro de compte n'est deviné (`compte()` lève si
 * le plan semé ne l'a pas).
 */
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { evaluateur, relireLiasse } from './parcours.mjs';
import {
  aplatir, balance, cloturer, compte, ecriture, etape, ligneDe, nouveauDossier,
  rechargerComptes, rechargerExercices, solde, tiers, validerJusqua,
} from './lib.mjs';

const BQ = '52110000';
const POINTS = (process.env.PAQUET1_A_POINTS ?? 'A8,A8M,A1,A4,A7,A3,A2,A10,A9,A5,A6,B2').split(',').map((s) => s.trim()).filter(Boolean);

/** Une devise USD du dossier, créée si le semis ne l'a pas, et ses cours. */
async function dollar(c, cours) {
  const liste = (await c.lire('Devises', '/devises')) ?? [];
  const usd = (Array.isArray(liste) ? liste : liste.devises ?? []).find((d) => d.code === 'USD')
    ?? (await c.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
  for (const [date, valeur] of cours) {
    await c.geste(`Cours USD du ${date}`, 'POST', `/devises/${usd?.id}/cours`, { date, cours: valeur, source: 'Banque centrale du Congo (banc paquet 1)' });
  }
  return usd;
}

// ==============================================================================
// A8 · LA CONTRE-PASSATION D'UNE RÉÉVALUATION AU PREMIER JOUR DE N+1, N OUVERT
// ==============================================================================
//
// AUDCIF art. 54 et Titre VIII ch. 22 § 2.3 (Application 84 · « au 01/01/N+1 »,
// les écarts de conversion sont contre-passés). La contre-passation est passée
// par le module (`extourne`), au journal d'opérations diverses, datée du
// premier jour de N+1, pendant que N est encore ouvert (admis, ligne A5 ter).
// Elle n'est PAS une position d'ouverture · le report de N (AUDCIF art. 34)
// passe entier, et la contre-passation reste · en N+1, la créance et la dette
// reviennent au coût historique, le 478 et le 479 à zéro.
//
// Chiffres · client 1 000 USD au 02/03/2026 (2 800) = 2 800 000 ; fournisseur
// 500 USD au même cours = 1 400 000 ; cours de clôture 2 900 ·
//   client 1 000 × 2 900 = 2 900 000, gain latent 100 000 (479) ;
//   fournisseur 500 × 2 900 = 1 450 000, perte latente 50 000 (478),
//   provision 50 000 (4991, dotée au 6591, art. 54).
// Résultat 2026 · 2 800 000 − 1 400 000 − 50 000 = 1 350 000.
// En 2027 après la clôture et la contre-passation · client 2 800 000,
// fournisseur −1 400 000, 478 et 479 à zéro, 4991 −50 000 (la provision ne
// se contre-passe pas, elle s'ajuste à la réévaluation suivante), banque
// 50 000 000, résultat 2026 au 13 (−1 350 000).

// Deux voies de contre-passation, le même attendu · par le MODULE (`extourne`,
// liaison `ecritureExtourneId`), ou À LA MAIN par une OD du 01/01/2027 que le
// cabinet DÉCLARE ensuite (`contre-passation-manuelle`, liaison
// `contrePassationDeclareeId`, A5 bis).
async function pointA8(R, voie = 'MODULE') {
  const P = voie === 'MODULE' ? 'A8' : 'A8 (main)';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · Kasaï Négoce SARL`, {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: voie === 'MODULE' ? 'p1a-a8' : 'p1a-a8m', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ven = c.journal('VEN') ?? c.od;
  const ach = c.journal('ACH') ?? c.od;
  const ctx = {};

  await etape(R, `${P} · dossier, dollar, tiers, opérations de 2026`, async () => {
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    ctx.usd = await dollar(c, [['2026-03-02', 2_800], ['2026-12-31', 2_900]]);
    ctx.cli = await tiers(c, 'CLIENT', 'CLI-A8', 'Copper Trading Ltd');
    ctx.frs = await tiers(c, 'FOURNISSEUR', 'FRS-A8', 'Johannesburg Supplies');
    const usd = (m, cours) => ({ deviseId: ctx.usd?.id, montantDevise: m, coursApplique: cours });
    await ecriture(c, 'Capital libéré', n, '2026-01-02', 'Apport des associés', [[BQ, 50_000_000, 0], ['10130000', 0, 50_000_000]], { journal: bq });
    await ecriture(c, 'Vente en dollars', n, '2026-03-02', 'Facture FV-A8-1', [[ctx.cli.numero, 2_800_000, 0, usd(1_000, 2_800)], ['70110000', 0, 2_800_000]], { journal: ven });
    await ecriture(c, 'Achat en dollars', n, '2026-03-02', 'Facture JS-A8-1', [['60110000', 1_400_000, 0], [ctx.frs.numero, 0, 1_400_000, usd(500, 2_800)]], { journal: ach });
    await validerJusqua(c, n, '2026-12-31');
  });
  if (!ctx.cli || !ctx.frs || !ctx.usd) return R.note(`${P} · tiers ou devise absents, la suite n’est pas jouée`);

  await etape(R, `${P} · réévaluation au 31/12/2026`, async () => {
    ctx.reeval = await c.geste('Réévaluation au 31/12/2026', 'POST', '/devises/reevaluation', { exerciceId: n });
    await validerJusqua(c, n, '2026-12-31');
    const b = await balance(c, n);
    R.montant(`${P} · 2026 · client au cours de clôture (1 000 × 2 900)`, 2_900_000, solde(b, ctx.cli.numero));
    R.montant(`${P} · 2026 · fournisseur au cours de clôture (500 × 2 900)`, -1_450_000, solde(b, ctx.frs.numero));
    R.montant(`${P} · 2026 · 479 gain latent`, -100_000, solde(b, '479'));
    R.montant(`${P} · 2026 · 478 perte latente`, 50_000, solde(b, '478'));
    R.montant(`${P} · 2026 · 4991 provision`, -50_000, solde(b, '4991'));
  });

  await etape(R, `${P} · 2027 ouvert avec ses reports provisoires, contre-passation au 01/01/2027, 2026 ouvert`, async () => {
    await c.geste('Nouvel exercice avec reports provisoires', 'POST', `/exercices/${n}/a-nouveaux-provisoires`, {});
    await rechargerExercices(c);
    ctx.n1 = c.exercices.get('2027')?.id;
    if (!ctx.n1 || !ctx.reeval?.reevaluationId) return R.note(`${P} · 2027 ou réévaluation absents`);
    if (voie === 'MODULE') {
      ctx.extourne = await c.geste('Contre-passation de la réévaluation 2026', 'POST', `/devises/reevaluation/${ctx.reeval.reevaluationId}/extourne`, { exerciceSuivantId: ctx.n1 });
      R.egal(`${P} · la contre-passation passe, 2026 encore ouvert`, true, Boolean(ctx.extourne?.ecritureExtourneId));
      await validerJusqua(c, ctx.n1, '2027-01-01');
      return;
    }
    // À LA MAIN · l'OD du 01/01/2027 inverse l'écart sur les comptes que la
    // réévaluation a portés (sous-comptes du 478 et du 479 lus sur la balance de
    // 2026, jamais devinés), puis le cabinet la déclare.
    await rechargerComptes(c);
    const b26 = await balance(c, n);
    const comptesEcart = [...(b26?.parNumero ?? new Map())].filter(([num, l]) => num && /^47[89]/.test(num) && l.solde !== 0);
    const lignes = [
      ...comptesEcart.map(([num, l]) => [num, l.solde < 0 ? -l.solde : 0, l.solde > 0 ? l.solde : 0]),
      [ctx.cli.numero, 0, 100_000],
      [ctx.frs.numero, 50_000, 0],
    ];
    const od = await ecriture(c, 'Contre-passation à la main au 01/01/2027', ctx.n1, '2027-01-01', 'Contre-passation des écarts de conversion 2026', lignes);
    await validerJusqua(c, ctx.n1, '2027-01-01');
    const decl = od?.id
      ? await c.geste('Déclaration de la contre-passation manuelle', 'POST', `/devises/reevaluations/${ctx.reeval.reevaluationId}/contre-passation-manuelle`, {
          ecritureId: od.id,
          motif: 'Contre-passation saisie à la main au 01/01/2027 (banc paquet 1)',
        })
      : null;
    R.egal(`${P} · la contre-passation manuelle se déclare, 2026 encore ouvert`, true, Boolean(decl?.contrePassationDeclareeId));
  });
  if (!ctx.n1) return;

  await etape(R, `${P} · aperçu de l’ouverture suivante, puis clôture de 2026`, async () => {
    const apercu = await c.lire('Aperçu de l’ouverture 2027', `/exercices/${n}/ouverture-suivante`);
    // La contre-passation n'est pas une ouverture · rien à déclarer, aucune position divergente.
    R.egal(`${P} · aperçu · aucune déclaration requise (la contre-passation n’est pas une ouverture)`, false, apercu?.declarationRequise ?? null);
    R.montant(`${P} · aperçu · aucune position divergente`, 0, apercu?.total ?? NaN);
    const r = await c.req('POST', `/exercices/${n}/cloturer`, {});
    R.egal(`${P} · clôture de 2026 sans déclaration · passe`, true, r.statut < 400);
    if (r.statut >= 400) {
      R.note(`${P} · clôture refusée (${r.statut}) · ${JSON.stringify(r.corps).slice(0, 500)}`);
      // La seule issue que le refus ouvre · « Rectifier l'import ». On la joue
      // pour lire ce qu'elle fait de la contre-passation.
      const rect = await c.geste('Clôture de 2026 en déclarant « Rectifier »', 'POST', `/exercices/${n}/cloturer`, { ouvertureImportee: 'RECTIFIER' });
      R.note(`${P} · clôture avec RECTIFIER · ${rect ? 'passée' : 'refusée'}`);
    } else {
      R.note(`${P} · clôture passée · ${JSON.stringify(r.corps?.messages ?? r.corps?.issueOuverture ?? null).slice(0, 400)}`);
    }
    await rechargerExercices(c);
  });

  await etape(R, `${P} · 2027 après la clôture · la contre-passation tient`, async () => {
    await rechargerComptes(c);
    const b = await balance(c, ctx.n1);
    R.montant(`${P} · 2027 · client au coût historique (contre-passation tenue)`, 2_800_000, solde(b, ctx.cli.numero));
    R.montant(`${P} · 2027 · fournisseur au coût historique`, -1_400_000, solde(b, ctx.frs.numero));
    R.montant(`${P} · 2027 · 479 à zéro`, 0, solde(b, '479'));
    R.montant(`${P} · 2027 · 478 à zéro`, 0, solde(b, '478'));
    R.montant(`${P} · 2027 · 4991 provision reportée (non contre-passée)`, -50_000, solde(b, '4991'));
    R.montant(`${P} · 2027 · banque`, 50_000_000, solde(b, BQ));
    R.montant(`${P} · 2027 · résultat 2026 au 13`, -1_350_000, solde(b, '13'));
    R.montant(`${P} · 2027 · balance équilibrée`, 0, b ? b.totalDebit - b.totalCredit : NaN);
    const reevals = await c.lire('Réévaluations de 2026', `/devises/reevaluation/liste?exerciceId=${n}`);
    const liste = Array.isArray(reevals) ? reevals : (reevals?.reevaluations ?? reevals?.liste ?? []);
    const r26 = liste.find((x) => x.id === ctx.reeval?.reevaluationId);
    R.egal(`${P} · la réévaluation 2026 garde sa contre-passation liée`, true, Boolean(r26?.ecritureExtourne?.id ?? r26?.ecritureExtourneId ?? r26?.contrePassationDeclaree?.id ?? r26?.contrePassationDeclareeId));
  });
}


// ==============================================================================
// A1 · UN EXERCICE CLÔTURÉ AVANT LE VIREMENT DU RÉSULTAT NON AFFECTÉ, LU EN N-1
// ==============================================================================
//
// AUDCIF, Titre VII, compte 13 ; SYCEBNL, Partie 2 ch. 3, compte 13 · « En fin
// d'exercice, le résultat de l'exercice précédent non affecté [...] est viré au
// compte de report à nouveau. » La clôture d'OmegaX le fait depuis le
// 2026-10-08 ; un exercice clôturé AVANT garde ce résultat au 13. L'état d'un
// tel dossier HÉRITÉ se reconstitue ici sur la base jetable du banc · la
// clôture de 2026 passe (avec son virement), puis le virement est retiré en base
// et le report de 2027 rendu au 13, comme l'ancienne clôture l'aurait laissé.
// C'est la seule manière d'obtenir l'état d'un dossier clôturé avant la
// correction, qu'aucune route ne produit plus (psql sur SA base jetable, comme
// le drapeau d'opérateur des scénarios voisins).
//
// Chiffres · capital 10 000 000 ; produit 2025 de 1 000 000 (bénéfice ou
// excédent R1), 2025 clôturé (rien au 13 à virer) ; produit 2026 de 400 000
// (R2), 2026 clôturé sans affectation. Dossier hérité · 2026 porte R1 au 13 à
// sa clôture, le poste du résultat de 2026 vaut R1 + R2 = 1 400 000, et le
// report de 2027 porte 1 400 000 au 13.
// En 2027 (N+1), la colonne N-1 du bilan reprend 1 400 000 au poste du
// résultat · elle doit DIRE que 1 000 000 y est le résultat de 2025 non viré, et
// la liasse de 2027 doit lever l'anomalie, sans rien recalculer.

function psql(sql) {
  const url = process.env.PASSE_DATABASE_URL;
  if (!url) throw new Error('PASSE_DATABASE_URL absente · l’état hérité ne peut pas se reconstituer');
  try {
    return execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qtAc', sql], { encoding: 'utf8' }).trim();
  } catch (e) {
    throw new Error(`psql a échoué (code ${e.status ?? '?'})`);
  }
}

/** Les lignes de la feuille ANOMALIES d'une liasse · [type, ref, objet, motif, action]. */
async function anomaliesDeLaLiasse(c, chemin, libelle) {
  const r = await c.lire(`Liasse ${libelle}`, chemin);
  if (!r?.contenu) return null;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(r.contenu);
  const ws = wb.getWorksheet('ANOMALIES');
  if (!ws) return null;
  const lignes = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    lignes.push([1, 2, 3, 4, 5].map((i) => String(row.getCell(i).value ?? '')));
  });
  return lignes;
}

async function pointA1(R, referentiel) {
  const sycebnl = referentiel === 'SYCEBNL';
  const P = sycebnl ? 'A1 (SYCEBNL)' : 'A1 (SYSCOHADA)';
  const poste = sycebnl ? 'CH' : 'CJ';
  const etats = sycebnl ? '/etats-financiers' : '/etats-financiers-syscohada';
  const liasse = sycebnl ? '/exports/etats-financiers/liasse-complete' : '/exports/etats-financiers-syscohada/liasse-complete';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · dossier hérité`, sycebnl
    ? { referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'p1a-a1s', exercice: ['2025-01-01', '2025-12-31'] }
    : { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1a-a1', exercice: ['2025-01-01', '2025-12-31'] });
  const bq = c.journal('BQ') ?? c.od;
  // Comptes lus au plan semé de chaque référentiel · fonds ou capital, produit.
  const fonds = sycebnl ? '10110000' : '10130000';
  const produit = sycebnl ? '70410000' : '70110000';
  const ctx = {};

  await etape(R, `${P} · 2025 · apport et produit, clôture`, async () => {
    if (!sycebnl) await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    const n25 = c.exercices.get('2025').id;
    await ecriture(c, 'Apport 2025', n25, '2025-01-02', 'Apport initial', [[BQ, 10_000_000, 0], [fonds, 0, 10_000_000]], { journal: bq });
    await ecriture(c, 'Produit 2025', n25, '2025-06-30', 'Produit de 2025', [[BQ, 1_000_000, 0], [produit, 0, 1_000_000]], { journal: bq });
    await validerJusqua(c, n25, '2025-12-31');
    ctx.clos25 = await cloturer(c, '2025');
    R.egal(`${P} · clôture de 2025`, true, ctx.clos25);
  });
  if (!ctx.clos25) return;

  await etape(R, `${P} · 2026 · produit, clôture sans affectation`, async () => {
    const n26 = c.exercices.get('2026')?.id;
    if (!n26) return R.note(`${P} · 2026 absent après la clôture de 2025`);
    await ecriture(c, 'Produit 2026', n26, '2026-06-30', 'Produit de 2026', [[BQ, 400_000, 0], [produit, 0, 400_000]], { journal: bq });
    await validerJusqua(c, n26, '2026-12-31');
    ctx.clos26 = await cloturer(c, '2026');
    R.egal(`${P} · clôture de 2026`, true, ctx.clos26);
  });
  if (!ctx.clos26) return;
  const n26 = c.exercices.get('2026').id;
  const n27 = c.exercices.get('2027')?.id;
  if (!n27) return R.note(`${P} · 2027 absent après la clôture de 2026`);

  await etape(R, `${P} · état hérité · le virement de 2026 retiré, le report de 2027 rendu au 13`, async () => {
    const t = c.tenantId;
    const sql = `DO $$
DECLARE v text; c13 text; c12 text;
BEGIN
  SELECT id INTO v FROM ecritures WHERE "tenantId" = '${t}' AND "exerciceId" = '${n26}' AND "estGenereeParCloture"
    AND libelle LIKE 'Résultat de l''exercice précédent non affecté viré%';
  IF v IS NULL THEN RAISE EXCEPTION 'virement introuvable'; END IF;
  SELECT l."compteId" INTO c13 FROM lignes_ecriture l JOIN comptes k ON k.id = l."compteId" WHERE l."ecritureId" = v AND k.numero LIKE '13%' LIMIT 1;
  SELECT l."compteId" INTO c12 FROM lignes_ecriture l JOIN comptes k ON k.id = l."compteId" WHERE l."ecritureId" = v AND k.numero NOT LIKE '13%' LIMIT 1;
  UPDATE lignes_ecriture SET "compteId" = c13 WHERE "compteId" = c12
    AND "ecritureId" IN (SELECT id FROM ecritures WHERE "tenantId" = '${t}' AND "exerciceId" = '${n27}' AND "estGenereeParCloture");
  DELETE FROM lignes_ecriture WHERE "ecritureId" = v;
  DELETE FROM ecritures WHERE id = v;
END $$;`;
    psql(sql);
    R.note(`${P} · état hérité reconstitué par psql sur la base jetable du banc (virement de 2026 retiré, report de 2027 rendu au 13)`);
    const b26 = await balance(c, n26);
    // Le 13 de 2026, hors l'écriture qui solde les comptes de gestion, porte R1 · lu à la balance comme report + solde (R1 + R2).
    R.montant(`${P} · 2026 hérité · le 13 porte R1 + R2 (aucun virement)`, -1_400_000, solde(b26, '13'));
  });

  await etape(R, `${P} · 2026 · son propre bilan le dit (déjà sur main)`, async () => {
    const b = await c.lire('Bilan 2026', `${etats}/bilan?exerciceId=${n26}`);
    R.montant(`${P} · bilan 2026 · résultat antérieur non viré nommé`, 1_000_000, b?.resultatAnterieurNonVire?.montant ?? null);
  });

  await etape(R, `${P} · 2027 · la colonne N-1 et la liasse le disent`, async () => {
    const b = await c.lire('Bilan 2027', `${etats}/bilan?exerciceId=${n27}`);
    const ligne = (b?.passif ?? []).find((l) => l.ref === poste);
    R.montant(`${P} · bilan 2027 · ${poste} N-1 reprend R1 + R2 (rien n'est recalculé)`, 1_400_000, ligne?.montantN1 ?? null);
    R.montant(`${P} · bilan 2027 · la colonne N-1 nomme le résultat 2025 non viré`, 1_000_000, b?.resultatAnterieurNonVireN1?.montant ?? null);
    R.egal(`${P} · bilan 2027 · au poste ${poste}`, poste, b?.resultatAnterieurNonVireN1?.poste ?? null);
    R.egal(`${P} · bilan 2027 · 2027 ouvert, rien n'est dit sur sa colonne N`, null, b?.resultatAnterieurNonVire ?? null);
    const anomalies = await anomaliesDeLaLiasse(c, `${liasse}?exerciceId=${n27}`, '2027');
    const lue = (anomalies ?? []).find((a) => a[1] === poste && /N-1/.test(a[2]) && /1 ?\s?000 ?\s?000|1 000 000/.test(a[3]));
    R.egal(`${P} · liasse 2027 · l'anomalie de la colonne N-1 est levée (${poste})`, true, Boolean(lue));
    if (anomalies && !lue) R.note(`${P} · anomalies de la liasse 2027 · ${JSON.stringify(anomalies.map((a) => a.slice(0, 3)))}`);
  });
}


// ==============================================================================
// A4 · PREMIER EXERCICE CLOS PAR LA NOUVELLE CLÔTURE · L'OUVERTURE EST L'OUVERTURE
// ==============================================================================
//
// Dossier repris, premier exercice tenu dans OmegaX (2026), bilan d'ouverture
// IMPORTÉ au 01/01/2026 · capital ou dotation 10 000 000, banque 12 000 000,
// résultat 2025 non affecté 2 000 000 au 13 (aucun report à nouveau). Produit
// 2026 de 500 000. La clôture de 2026 vire le 13 de l'ouverture au report à
// nouveau en fin d'exercice (fiche du compte 13 des deux plans), par une
// écriture de clôture datée du 31/12/2026.
// Sans exercice 2025 dans OmegaX, la colonne N-1 du bilan de 2026 est le bilan
// d'ouverture (AUDCIF art. 34 ; SYCEBNL art. 16, 4)) · au 01/01/2026, le
// résultat 2025 est au poste du résultat (2 000 000) et le report à nouveau à
// zéro. Lue sur la colonne REPORT de la balance clôturée, qui compte aussi le
// virement de fin d'exercice, l'ouverture présentait 0 au résultat et
// 2 000 000 au report · totaux justes, reclassement faux.
// Au bilan de 2026 lui-même (N) · report à nouveau 2 000 000 (viré),
// résultat 500 000. Au tableau des flux, la trésorerie d'ouverture (ZA) reste
// 12 000 000.

async function pointA4(R, referentiel) {
  const sycebnl = referentiel === 'SYCEBNL';
  const P = sycebnl ? 'A4 (SYCEBNL)' : 'A4 (SYSCOHADA)';
  const resultat = sycebnl ? 'CH' : 'CJ';
  const report = sycebnl ? 'CG' : 'CH';
  const etats = sycebnl ? '/etats-financiers' : '/etats-financiers-syscohada';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · dossier repris`, sycebnl
    ? { referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'p1a-a4s', exercice: ['2026-01-01', '2026-12-31'] }
    : { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1a-a4', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const fonds = sycebnl ? '10110000' : '10130000';
  const produit = sycebnl ? '70410000' : '70110000';
  const ctx = {};

  await etape(R, `${P} · bilan d'ouverture importé au 01/01/2026, produit, clôture`, async () => {
    if (!sycebnl) await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    const lignes = [
      [BQ, 'Banque', 12_000_000, 0],
      [fonds, 'Capital ou dotation', 0, 10_000_000],
      ['13100000', 'Résultat 2025 non affecté', 0, 2_000_000],
    ];
    const csv = ['Compte;Intitule;Debit;Credit', ...lignes.map((l) => l.join(';'))].join('\n');
    await c.geste('Import du bilan d’ouverture', 'POST', '/import/executer', {
      type: 'BALANCE', nomFichier: 'ouverture-2026.csv', contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
      mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
      exerciceId: n, dateOperation: '2026-01-01', bilanDOuverture: true, separateur: ';',
    });
    await validerJusqua(c, n, '2026-01-01');
    await ecriture(c, 'Produit 2026', n, '2026-06-30', 'Produit de 2026', [[BQ, 500_000, 0], [produit, 0, 500_000]], { journal: bq });
    await validerJusqua(c, n, '2026-12-31');
    ctx.clos = await cloturer(c, '2026');
    R.egal(`${P} · clôture de 2026 (virement du 13 d'ouverture compris)`, true, ctx.clos);
  });
  if (!ctx.clos) return;

  await etape(R, `${P} · bilan de 2026 · la colonne N-1 est le bilan d'ouverture`, async () => {
    const b = await c.lire('Bilan 2026', `${etats}/bilan?exerciceId=${n}`);
    const ligne = (ref) => (b?.passif ?? []).find((l) => l.ref === ref);
    R.egal(`${P} · colonne N-1 lue sur le bilan d'ouverture`, 'BILAN_D_OUVERTURE', b?.comparatif ?? null);
    R.montant(`${P} · ${resultat} N-1 · le résultat 2025 au 01/01/2026`, 2_000_000, ligne(resultat)?.montantN1 ?? null);
    R.montant(`${P} · ${report} N-1 · aucun report à nouveau au 01/01/2026`, 0, ligne(report)?.montantN1 ?? null);
    R.montant(`${P} · total passif N-1`, 12_000_000, b?.totalPassifN1 ?? null);
    R.montant(`${P} · ${resultat} N · le résultat 2026`, 500_000, ligne(resultat)?.montant ?? null);
    R.montant(`${P} · ${report} N · le résultat 2025 viré au report`, 2_000_000, ligne(report)?.montant ?? null);
    const tft = aplatir(await c.lire('Flux 2026', `${etats}/tableau-flux-tresorerie?exerciceId=${n}`));
    R.montant(`${P} · flux · trésorerie d'ouverture ZA`, 12_000_000, tft?.ZA?.n ?? null);
  });
}

// ==============================================================================
// A7 · UNE OUVERTURE SAISIE EN OD AU PREMIER JOUR, SANS REPORT NI EXERCICE
// PRÉCÉDENT · le tableau des flux ne la lit ni comme flux ni comme ouverture
// ==============================================================================
//
// AUDCIF art. 34 ; SYCEBNL art. 16, 4) et cadre conceptuel § 3.3.1.2.4 · le
// bilan d'ouverture correspond au bilan de clôture précédent. Une position de
// bilan passée en OD au premier jour peut être la reprise d'un dossier ou
// l'apport qui fait naître l'entité · rien ne les distingue. Le SYSCOHADA la
// nomme et vide les postes qui lisent l'ouverture ou les mouvements (bloquant 2
// du 2026-10-07) ; les associations doivent suivre la même règle.
async function pointA7(R, referentiel) {
  const sycebnl = referentiel === 'SYCEBNL';
  const P = sycebnl ? 'A7 (SYCEBNL)' : 'A7 (SYSCOHADA)';
  const etats = sycebnl ? '/etats-financiers' : '/etats-financiers-syscohada';
  const apport = sycebnl ? 'FM' : 'FK';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · ouverture en OD`, sycebnl
    ? { referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'p1a-a7s', exercice: ['2026-01-01', '2026-12-31'] }
    : { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1a-a7', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const fonds = sycebnl ? '10110000' : '10130000';
  const produit = sycebnl ? '70410000' : '70110000';
  let ok = false;
  await etape(R, `${P} · bilan d'ouverture passé en OD au 01/01/2026, produit`, async () => {
    if (!sycebnl) await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    const od = await ecriture(c, 'Ouverture en OD', n, '2026-01-01', 'Bilan d’ouverture saisi en OD', [
      [BQ, 12_000_000, 0], [fonds, 0, 10_000_000], ['13100000', 0, 2_000_000],
    ]);
    await ecriture(c, 'Produit 2026', n, '2026-06-30', 'Produit de 2026', [[BQ, 500_000, 0], [produit, 0, 500_000]], { journal: bq });
    await validerJusqua(c, n, '2026-12-31');
    ok = Boolean(od);
  });
  if (!ok) return;
  await etape(R, `${P} · bilan et tableau des flux de 2026`, async () => {
    const b = await c.lire('Bilan 2026', `${etats}/bilan?exerciceId=${n}`);
    R.egal(`${P} · bilan · colonne N-1 non servie, l'OD du premier jour nommée`, true,
      (b?.comparatif ?? null) === null && String(b?.mentionComparatif ?? '').includes('opérations diverses'));
    const t = await c.lire('Flux 2026', `${etats}/tableau-flux-tresorerie?exerciceId=${n}`);
    R.egal(`${P} · flux · la mention d'ouverture nomme l'OD du premier jour`, true, String(t?.mentionOuverture ?? '').includes('opérations diverses'));
    const vides = new Set(t?.postesVides ?? []);
    R.egal(`${P} · flux · ZA laissée vide`, true, vides.has('ZA'));
    R.egal(`${P} · flux · ${apport} (apports) laissé vide, jamais lu comme un encaissement de 10 000 000`, true, vides.has(apport));
    const lignesFlux = aplatir(t);
    R.note(`${P} · servi · ${apport} ${lignesFlux?.[apport]?.n ?? 'absent'}, ZA ${lignesFlux?.ZA?.n ?? 'absent'}, mention « ${String(t?.mentionOuverture ?? '').slice(0, 80)} »`);
    const motif = (t?.postesNonCalculables ?? []).find((p) => p.ref === apport)?.raison ?? null;
    R.egal(`${P} · flux · le motif de ${apport} nomme la pièce`, true, Boolean(motif && /OD n° /.test(motif)));
  });
  // À travers la clôture · 2026 devient la colonne N-1 du tableau de 2027, et
  // ses postes vides le restent (jamais des zéros), motif compris.
  let clos = false;
  await etape(R, `${P} · clôture de 2026, tableau des flux de 2027`, async () => {
    clos = await cloturer(c, '2026');
    R.egal(`${P} · clôture de 2026`, true, clos);
  });
  if (!clos) return;
  await etape(R, `${P} · colonne N-1 du tableau des flux de 2027`, async () => {
    const n27 = c.exercices.get('2027')?.id;
    const t = await c.lire('Flux 2027', `${etats}/tableau-flux-tresorerie?exerciceId=${n27}`);
    const ligne = (ref) => (t?.lignes ?? []).find((l) => l.ref === ref);
    R.egal(`${P} · 2027 · ${apport} N-1 laissé vide (aucun montant servi)`, true, ligne(apport) !== undefined && ligne(apport).montantN1 === undefined);
    R.egal(`${P} · 2027 · ZA N-1 laissée vide`, true, ligne('ZA') !== undefined && ligne('ZA').montantN1 === undefined);
    const motifN1 = (t?.postesNonCalculablesN1 ?? []).find((p) => p.ref === apport)?.raison ?? null;
    R.egal(`${P} · 2027 · le motif de la colonne N-1 nomme la pièce`, true, Boolean(motifN1 && /OD n° /.test(motifN1)));
    // La colonne N de 2027 part de la clôture de 2026 · ZA = 12 500 000.
    R.montant(`${P} · 2027 · ZA N · la trésorerie de clôture de 2026`, 12_500_000, ligne('ZA')?.montant ?? null);
  });
  // RELECTURE B1 · la fiche de synthèse des notes (33 des associations, 34 du
  // SYSCOHADA) relit le tableau des flux sur la balance mémorisée de l'appel ·
  // 2026 CLÔTURÉ, elle doit laisser vides les postes que le tableau laisse
  // vides (financement et variation de la trésorerie), jamais les chiffrer.
  await etape(R, `${P} · fiche de synthèse des notes de 2026, après la clôture`, async () => {
    const t = await c.lire('Flux 2026 après clôture', `${etats}/tableau-flux-tresorerie?exerciceId=${n}`);
    const vides = new Set(t?.postesVides ?? []);
    R.egal(`${P} · flux 2026 après clôture · ${apport} toujours vide`, true, vides.has(apport));
    const r = sycebnl
      ? await c.lire('Notes 2026', `/notes-annexes/associations?exerciceId=${n}`)
      : await c.lire('Notes 2026', `/etats-financiers-syscohada/notes?exerciceId=${n}`);
    const note = (r?.notes ?? []).find((x) => x.code === (sycebnl ? '33' : '34'));
    const valeur = (cle) => {
      const l = (note?.lignes ?? []).find((x) => x.cle === cle);
      return l ? (l.saisie ?? [])[0] ?? null : 'absente';
    };
    const cles = sycebnl
      ? ['flux-de-tresorerie-des-activites-de-financement', 'variation-de-la-tresorerie-nette-de-la-periode']
      : ['flux-financement'];
    for (const cle of cles) {
      R.egal(`${P} · note ${sycebnl ? '33' : '34'} de 2026 après clôture · « ${cle} » laissée vide (le tableau des flux la laisse vide)`, null, valeur(cle));
    }
  });
}

// ==============================================================================
// A3 · L'EXERCICE PRÉCÉDENT OUVERT SANS ÉCRITURE · la colonne N-1 des états
// ==============================================================================
async function pointA3(R, referentiel) {
  const sycebnl = referentiel === 'SYCEBNL';
  const P = sycebnl ? 'A3 (SYCEBNL)' : 'A3 (SYSCOHADA)';
  const etats = sycebnl ? '/etats-financiers' : '/etats-financiers-syscohada';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · exercice précédent vide`, sycebnl
    ? { referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'p1a-a3s', exercice: ['2026-01-01', '2026-12-31'] }
    : { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1a-a3', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const fonds = sycebnl ? '10110000' : '10130000';
  const produit = sycebnl ? '70410000' : '70110000';
  let ok = false;
  await etape(R, `${P} · 2025 ouvert sans écriture, apport et produit en 2026`, async () => {
    if (!sycebnl) await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    const e25 = await c.geste('Exercice 2025, vide', 'POST', '/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
    await rechargerExercices(c);
    await ecriture(c, 'Apport', n, '2026-03-01', 'Apport', [[BQ, 1_000_000, 0], [fonds, 0, 1_000_000]], { journal: bq });
    await ecriture(c, 'Produit', n, '2026-06-30', 'Produit de 2026', [[BQ, 500_000, 0], [produit, 0, 500_000]], { journal: bq });
    await validerJusqua(c, n, '2026-12-31');
    ok = Boolean(e25 && c.exercices.get('2025'));
  });
  if (!ok) return;
  await etape(R, `${P} · les trois états de 2026 et leur colonne N-1`, async () => {
    const b = await c.lire('Bilan 2026', `${etats}/bilan?exerciceId=${n}`);
    const cr = await c.lire('Compte de résultat 2026', `${etats}/compte-de-resultat?exerciceId=${n}`);
    const t = await c.lire('Flux 2026', `${etats}/tableau-flux-tresorerie?exerciceId=${n}`);
    const fb = aplatir(b), fc = aplatir(cr), ft = aplatir(t);
    R.note(`${P} · bilan · disponible ${b?.exerciceN1Disponible}, comparatif ${b?.comparatif ?? null}, mention « ${String(b?.mentionComparatif ?? '').slice(0, 120)} », BZ N-1 ${fb?.BZ?.n1 ?? 'absent'}`);
    R.note(`${P} · compte de résultat · disponible ${cr?.exerciceN1Disponible}, motif « ${String(cr?.motifComparatifAbsent ?? '').slice(0, 120)} »`);
    R.note(`${P} · flux · disponible ${t?.exerciceN1Disponible}, mention « ${String(t?.mentionOuverture ?? '').slice(0, 160)} », ZA N-1 ${ft?.ZA?.n1 ?? 'absent'}, ZB N-1 ${ft?.ZB?.n1 ?? 'absent'}, N-1 non calculables ${(t?.postesNonCalculablesN1 ?? []).map((p) => p.ref).join(',')}`);
    // Le point A3 vise le tableau des ASSOCIATIONS · la colonne N-1 d'un
    // exercice précédent qui ne tient aucune écriture est vide et dite, jamais
    // des zéros (le SYSCOHADA, les bilans et les comptes de résultat sont
    // relevés, non codés).
    if (!sycebnl) return;
    const lignesFlux = (t?.lignes ?? []).filter((l) => l.ref);
    R.egal(`${P} · flux · colonne N-1 vide, aucun montant servi (ZA, ZB, ZF)`, true,
      lignesFlux.length > 0 && ['ZA', 'ZB', 'ZF'].every((r) => lignesFlux.find((l) => l.ref === r)?.montantN1 === undefined));
    R.egal(`${P} · flux · aucune ligne de la colonne N-1 n'est chiffrée`, true, lignesFlux.every((l) => l.montantN1 === undefined));
    R.egal(`${P} · flux · la colonne N-1 dit pourquoi elle est vide`, true,
      (t?.postesNonCalculablesN1 ?? []).some((p) => p.ref === 'ZA' && /sans aucune écriture/.test(p.raison)));
    R.egal(`${P} · flux · l'exercice précédent reste disponible, comme au bilan et au compte de résultat`, true,
      t?.exerciceN1Disponible === true && b?.exerciceN1Disponible === true && cr?.exerciceN1Disponible === true);
  });
  if (!sycebnl) return;
  // À travers une clôture · 2025, vide, est clôturé · il ne tient toujours
  // aucune écriture, et sa colonne reste vide.
  let clos = false;
  await etape(R, `${P} · clôture de 2025 (vide), tableau des flux de 2026`, async () => {
    clos = await cloturer(c, '2025');
    R.egal(`${P} · clôture de 2025 sans écriture`, true, clos);
  });
  if (!clos) return;
  await etape(R, `${P} · 2025 clôturé · la colonne N-1 de 2026`, async () => {
    const t = await c.lire('Flux 2026', `${etats}/tableau-flux-tresorerie?exerciceId=${n}`);
    const lignesFlux = (t?.lignes ?? []).filter((l) => l.ref);
    R.egal(`${P} · 2025 clôturé · aucune ligne de la colonne N-1 n'est chiffrée`, true,
      lignesFlux.length > 0 && lignesFlux.every((l) => l.montantN1 === undefined));
    R.egal(`${P} · 2025 clôturé · la colonne N-1 dit pourquoi elle est vide`, true,
      (t?.postesNonCalculablesN1 ?? []).some((p) => p.ref === 'ZA' && /sans aucune écriture/.test(p.raison)));
  });
}

// ==============================================================================
// A2 · L'EXERCICE PRÉCÉDENT QUI N'A QUE DU BROUILLARD · la mention dit de le
// valider (AUDCIF art. 22, 2°), elle ne conseille pas d'importer une balance
// ==============================================================================
async function pointA2(R, referentiel) {
  const sycebnl = referentiel === 'SYCEBNL';
  const P = sycebnl ? 'A2 (SYCEBNL)' : 'A2 (SYSCOHADA)';
  const etats = sycebnl ? '/etats-financiers' : '/etats-financiers-syscohada';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · exercice précédent au brouillard`, sycebnl
    ? { referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'p1a-a2s', exercice: ['2026-01-01', '2026-12-31'] }
    : { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1a-a2', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const fonds = sycebnl ? '10110000' : '10130000';
  const produit = sycebnl ? '70410000' : '70110000';
  let n25 = null;
  await etape(R, `${P} · 2025 tenu au brouillard seulement, 2026 validé`, async () => {
    if (!sycebnl) await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await c.geste('Exercice 2025', 'POST', '/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
    await rechargerExercices(c);
    n25 = c.exercices.get('2025')?.id ?? null;
    if (!n25) return;
    // 2025 · au brouillard, jamais validé.
    await ecriture(c, 'Apport 2025', n25, '2025-03-01', 'Apport', [[BQ, 1_000_000, 0], [fonds, 0, 1_000_000]], { journal: bq });
    await ecriture(c, 'Produit 2025', n25, '2025-06-30', 'Produit de 2025', [[BQ, 300_000, 0], [produit, 0, 300_000]], { journal: bq });
    // 2026 · validé.
    await ecriture(c, 'Produit 2026', n, '2026-06-30', 'Produit de 2026', [[BQ, 500_000, 0], [produit, 0, 500_000]], { journal: bq });
    await validerJusqua(c, n, '2026-12-31');
  });
  if (!n25) return;
  await etape(R, `${P} · tableau des flux de 2026`, async () => {
    const t = await c.lire('Flux 2026', `${etats}/tableau-flux-tresorerie?exerciceId=${n}`);
    const mention = String(t?.mentionOuverture ?? '');
    R.note(`${P} · mention servie « ${mention} »`);
    R.egal(`${P} · la mention dit que l'exercice précédent n'a que du brouillard`, true, /brouillard/.test(mention));
    R.egal(`${P} · la mention dit de valider ses écritures (AUDCIF art. 22, 2°)`, true, /[Vv]alidez/.test(mention) && /art\. 22, 2°/.test(mention));
    R.egal(`${P} · la mention ne conseille plus d'importer la balance de clôture`, true, !/Importez la balance de clôture/.test(mention));
    if (!sycebnl) return;
    const motif = (t?.postesNonCalculablesN1 ?? []).find((p) => p.ref === 'ZA')?.raison ?? '';
    R.note(`${P} · motif de la colonne N-1 « ${motif} »`);
    R.egal(`${P} · la colonne N-1 dit le brouillard et de le valider`, true, /brouillard/.test(motif) && /[Vv]alidez/.test(motif));
  });
  // L'issue que la mention donne, suivie à travers la clôture · 2025 validé
  // puis clôturé, 2026 lit sa clôture · plus de mention, ZA = 1 300 000.
  let clos = false;
  await etape(R, `${P} · 2025 validé puis clôturé`, async () => {
    await validerJusqua(c, n25, '2025-12-31');
    clos = await cloturer(c, '2025');
    R.egal(`${P} · clôture de 2025 après validation`, true, clos);
  });
  if (!clos) return;
  await etape(R, `${P} · tableau des flux de 2026 après la validation de 2025`, async () => {
    const t = await c.lire('Flux 2026', `${etats}/tableau-flux-tresorerie?exerciceId=${n}`);
    R.egal(`${P} · 2025 tenu · plus de mention d'ouverture`, null, t?.mentionOuverture ?? null);
    const za = (t?.lignes ?? []).find((l) => l.ref === 'ZA');
    R.montant(`${P} · 2025 tenu · ZA de 2026, la trésorerie de clôture de 2025`, 1_300_000, za?.montant ?? null);
  });
}

// ==============================================================================
// A5 · LES INTÉRÊTS COURUS SUR EMPRUNTS AU TABLEAU DES FLUX SYSCOHADA
// ==============================================================================
//
// Constat de la passe · « la variation des intérêts courus (1662) entre en FE
// (passif circulant) quand le bilan les range en DA ». Lu au texte · AUDCIF
// Titre IX ch. 5 § 1.2.1.3, passage de la CAFG au flux opérationnel ·
// « + Variation du passif circulant ET DES INTÉRÊTS DES EMPRUNTS ET DETTES
// FINANCIÈRES COURUS (exercices N–N-1) (b) et (1) », et pour l'actif « –
// Variation des créances […] et des intérêts courus des immobilisations
// financières ». Le ch. 7 range bien le 166 en DA (« 16, 181, 182, 183,
// 184 »), mais c'est le ch. 5 qui dit où va sa VARIATION au tableau des
// flux · en FE, hors de FO à FQ, cohérent avec la CAFG qui porte déjà la
// charge (671) courus compris. Les contrôles disent ce que le texte
// prescrit ; ils concordent avant toute correction.
//
// Chiffres · 2026 · apport 2 000 000 (FK) ; emprunt 1 000 000 au 162 (FO) ;
// vente 500 000 ; intérêts courus 50 000 au 31/12 (D 6712 / C 1662).
// CAFG 450 000 (EBE 500 000, résultat financier −50 000) ; FE +50 000 (Δ166) ;
// ZB 500 000 ; ZD 2 000 000 ; ZE 1 000 000 ; ZH 3 500 000 = banque ; DA au
// bilan 1 050 000 (162 et 1662). 2027, à travers la clôture · contre-passation
// des courus au 01/01 (D 1662 / C 6712, fiche du compte 16, « débité, à
// l'ouverture »), intérêts payés 50 000 (D 6712 / C 52), principal remboursé
// 200 000 (D 162 / C 52) · CAFG 0, FE −50 000, FQ −200 000, ZA 3 500 000,
// ZH 3 250 000.
async function pointA5(R) {
  const P = 'A5 (SYSCOHADA)';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · intérêts courus sur emprunt`, { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1a-a5', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  await etape(R, `${P} · apport, emprunt, vente, intérêts courus de 2026`, async () => {
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await ecriture(c, 'Apport en capital', n, '2026-01-15', 'Apport en numéraire', [[BQ, 2_000_000, 0], ['10130000', 0, 2_000_000]], { journal: bq });
    await ecriture(c, 'Emprunt bancaire', n, '2026-03-01', 'Emprunt BCDC', [[BQ, 1_000_000, 0], ['16200000', 0, 1_000_000]], { journal: bq });
    await ecriture(c, 'Vente', n, '2026-06-30', 'Vente au comptant', [[BQ, 500_000, 0], ['70110000', 0, 500_000]], { journal: bq });
    await ecriture(c, 'Intérêts courus', n, '2026-12-31', 'Intérêts courus au 31/12', [['67120000', 50_000, 0], ['16620000', 0, 50_000]]);
    await validerJusqua(c, n, '2026-12-31');
  });
  const lire = async (an, id) => {
    const t = await c.lire(`Flux ${an}`, `/etats-financiers-syscohada/tableau-flux-tresorerie?exerciceId=${id}`);
    return aplatir(t) ?? {};
  };
  await etape(R, `${P} · tableau des flux et bilan de 2026`, async () => {
    const f = await lire('2026', n);
    R.montant(`${P} · 2026 · FA (CAFG)`, 450_000, f.FA?.n ?? null);
    R.montant(`${P} · 2026 · FE · la variation du passif circulant et des intérêts courus (ch. 5 § 1.2.1.3)`, 50_000, f.FE?.n ?? null);
    R.montant(`${P} · 2026 · FO · l'emprunt seul, sans les intérêts courus`, 1_000_000, f.FO?.n ?? null);
    R.montant(`${P} · 2026 · FP`, 0, f.FP?.n ?? 0);
    R.montant(`${P} · 2026 · ZB`, 500_000, f.ZB?.n ?? null);
    R.montant(`${P} · 2026 · ZH · la trésorerie de clôture`, 3_500_000, f.ZH?.n ?? null);
    const b = aplatir(await c.lire('Bilan 2026', `/etats-financiers-syscohada/bilan?exerciceId=${n}`)) ?? {};
    R.montant(`${P} · 2026 · bilan · DA porte l'emprunt et ses intérêts courus (ch. 7)`, 1_050_000, b.DA?.n ?? null);
  });
  const clos = await etape(R, `${P} · clôture de 2026`, () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note(`${P} · 2027 non joué · clôture de 2026 non aboutie ou exercice 2027 absent`);
  await etape(R, `${P} · 2027 · contre-passation, intérêts payés, remboursement`, async () => {
    await ecriture(c, 'Contre-passation des intérêts courus', n1, '2027-01-01', 'Contre-passation intérêts courus', [['16620000', 50_000, 0], ['67120000', 0, 50_000]]);
    await ecriture(c, 'Intérêts payés', n1, '2027-03-01', 'Échéance d’intérêts', [['67120000', 50_000, 0], [BQ, 0, 50_000]], { journal: bq });
    await ecriture(c, 'Remboursement', n1, '2027-03-01', 'Remboursement du principal', [['16200000', 200_000, 0], [BQ, 0, 200_000]], { journal: bq });
    await validerJusqua(c, n1, '2027-12-31');
  });
  await etape(R, `${P} · tableau des flux de 2027`, async () => {
    const f = await lire('2027', n1);
    R.montant(`${P} · 2027 · FA (CAFG)`, 0, f.FA?.n ?? null);
    R.montant(`${P} · 2027 · FE · les intérêts courus payés sortent par la variation`, -50_000, f.FE?.n ?? null);
    R.montant(`${P} · 2027 · FQ · le principal seul`, -200_000, f.FQ?.n ?? null);
    R.montant(`${P} · 2027 · ZA`, 3_500_000, f.ZA?.n ?? null);
    R.montant(`${P} · 2027 · ZH`, 3_250_000, f.ZH?.n ?? null);
    R.montant(`${P} · 2027 · colonne N-1 · FE de 2026`, 50_000, f.FE?.n1 ?? null);
  });
}

// ==============================================================================
// A6 · LE 130 « RÉSULTAT EN INSTANCE D'AFFECTATION » (SYSCOHADA)
// ==============================================================================
//
// AUDCIF Titre VII, fiche du compte 13 · 130 est une subdivision du 13 (1301
// bénéfice, 1309 perte) ; « à la réouverture des comptes de l'exercice
// suivant, les entités ont la possibilité d'utiliser un compte spécial
// "Résultat en instance d'affectation" (130) » ; « en fin d'exercice, le
// résultat de l'exercice précédent non affecté […] est viré au compte de
// report à nouveau ». Titre IX ch. 7 · CJ « Résultat net de l'exercice »,
// comptes « 13 (131 ou 139) ». OmegaX lit CJ sur 131 à 139, jamais le 130
// (`resultat-de-l-exercice.ts`). Le point relève qu'un bilan intermédiaire
// est alors déséquilibré du montant du 130. Ce point CONSTATE, il ne juge
// pas · aucune règle n'est tranchée par le corpus (voir la fiche
// AVANCEMENT) ; les contrôles disent ce qui est servi.
//
// Chiffres · 2026 · apport 1 000 000, vente 300 000, clôture · 2027 s'ouvre
// avec le 131 à 300 000. Le 02/01/2027 le cabinet reclasse le résultat en
// instance (D 131 / C 1301, 300 000). Bilan de 2027 · actif 1 300 000 ;
// passif 1 000 000 (CA) + CJ, le 1301 hors poste.
async function pointA6(R) {
  const P = 'A6 (SYSCOHADA)';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · résultat en instance d'affectation`, { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1a-a6', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  await etape(R, `${P} · 2026 · apport, vente, clôture`, async () => {
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await ecriture(c, 'Apport', n, '2026-01-15', 'Apport en numéraire', [[BQ, 1_000_000, 0], ['10130000', 0, 1_000_000]], { journal: bq });
    await ecriture(c, 'Vente', n, '2026-06-30', 'Vente au comptant', [[BQ, 300_000, 0], ['70110000', 0, 300_000]], { journal: bq });
    await validerJusqua(c, n, '2026-12-31');
  });
  const clos = await etape(R, `${P} · clôture de 2026`, () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note(`${P} · 2027 non joué`);
  await etape(R, `${P} · 2027 · le résultat de 2026 reclassé au 1301 à la réouverture`, async () => {
    await ecriture(c, 'Reclassement en instance d’affectation', n1, '2027-01-02', 'Résultat 2026 en instance d’affectation', [['13100000', 300_000, 0], ['13010000', 0, 300_000]]);
    await validerJusqua(c, n1, '2027-12-31');
  });
  await etape(R, `${P} · 2027 · bilan servi avant l'affectation`, async () => {
    const b = await c.lire('Bilan 2027', `/etats-financiers-syscohada/bilan?exerciceId=${n1}`);
    const f = aplatir(b) ?? {};
    R.note(`${P} · 2027 · BZ ${f.BZ?.n ?? '?'}, DZ ${f.DZ?.n ?? '?'}, CJ ${f.CJ?.n ?? '?'}, équilibre ${String(b?.equilibre ?? b?.controle?.equilibre)}, non rattachés ${JSON.stringify((b?.comptesNonRattaches ?? []).map((x) => `${x.numero} ${x.montant ?? x.solde ?? ''}`))}`);
    R.montant(`${P} · 2027 · actif (BZ)`, 1_300_000, f.BZ?.n ?? null);
    R.egal(`${P} · 2027 · le 1301 est nommé parmi les comptes sans poste (constat, ni jugé juste ni faux)`, true, (b?.comptesNonRattaches ?? []).some((x) => String(x.numero).startsWith('130')));
  });
  await etape(R, `${P} · 2027 · clôture tentée avec le 1301 non soldé`, async () => {
    const id = c.exercices.get('2027')?.id;
    const r = await c.req('POST', `/exercices/${id}/cloturer`, {});
    R.note(`${P} · clôture de 2027, 1301 non soldé · statut ${r.statut} · ${JSON.stringify(r.corps?.message ?? r.corps?.statut ?? r.corps).slice(0, 400)}`);
    await rechargerExercices(c);
  });
  await etape(R, `${P} · après la clôture de 2027 · bilan clos et report sur 2028`, async () => {
    const b = await c.lire('Bilan 2027 clos', `/etats-financiers-syscohada/bilan?exerciceId=${n1}`);
    const f = aplatir(b) ?? {};
    R.note(`${P} · 2027 clos · BZ ${f.BZ?.n ?? '?'}, DZ ${f.DZ?.n ?? '?'}, CH ${f.CH?.n ?? '?'}, CJ ${f.CJ?.n ?? '?'}, équilibre ${String(b?.equilibre)}, à solder ${JSON.stringify(b?.comptesASolderALaCloture ?? null)}, non rattachés ${JSON.stringify((b?.comptesNonRattaches ?? []).map((x) => `${x.numero} ${x.montant ?? x.solde ?? ""}`))}`);
    const n2 = c.exercices.get('2028')?.id;
    if (!n2) return R.note(`${P} · 2028 absent`);
    const bal = await balance(c, n2);
    R.note(`${P} · 2028 · à-nouveau 1301 ${solde(bal, '1301')}, 12 ${solde(bal, '12')}, 131 ${solde(bal, '131')}`);
  });
}

// ==============================================================================
// A9 · LA FEUILLE CONTROLES DE LA LIASSE PROJET ET LE SOLDE DES OPÉRATIONS
// ==============================================================================
//
// SYCEBNL Partie 4 ch. 3, tableaux de correspondance · XC « SOLDE DES
// OPERATIONS DE L'EXERCICE (+excédent, -déficit) XA - XB » au compte
// d'exploitation, CC « Solde des opérations de l'exercice (+ ou déficit -) »,
// « 13 (131 ou 139) », au bilan, et CB « Report à nouveau (+ ou -) » pour le
// recevoir. La fiche du compte 13 le dit « toujours nul » parce que chaque
// charge engagée sur les fonds d'administration est neutralisée par le 702
// (Partie 3 ch. 3 § 2.2, note (2)) ; un produit hors de cette neutralisation
// (intérêts du dépôt, prix de cession au 82 du § 2.5.1) le rend non nul. La
// feuille CONTROLES (égalités qui doivent tenir, « Attendu 0 ») ne tient
// donc pas XC à zéro · elle confronte XC au CC du bilan, le même solde dans
// deux états, et XC y reste une valeur lue.
//
// Chiffres · décaissement du bailleur 10 000 000 (462) ; missions 2 500 000
// payées par la banque et neutralisées (D 462 / C 702) ; intérêts du dépôt
// 120 000 au 7747, non neutralisés. XC = (2 500 000 + 120 000) − 2 500 000
// = 120 000 ; CC = 120 000 ; XC − CC = 0. Après la clôture de 2026 et
// l'affectation du solde au 121 en 2027 · 2026 relu, XC = CC = 120 000 ;
// 2027, XC = 0, CC = 0.
async function pointA9(R) {
  const P = 'A9 (projet)';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · solde des opérations non nul`, {
    referentiel: 'SYCEBNL', jeu: 'PROJETS_DEVELOPPEMENT', cle: 'p1a-a9', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const I = 120_000;
  await etape(R, `${P} · décaissement, charge neutralisée, intérêts du dépôt`, async () => {
    await ecriture(c, 'Décaissement du bailleur', n, '2026-02-01', 'Décaissement tranche 1', [[BQ, 10_000_000, 0], ['46200000', 0, 10_000_000]], { journal: bq });
    await ecriture(c, 'Missions de terrain', n, '2026-07-20', 'Missions de terrain', [['61810000', 2_500_000, 0], [BQ, 0, 2_500_000]], { journal: bq });
    await ecriture(c, 'Missions · neutralisation', n, '2026-07-20', 'Neutralisation · missions', [['46200000', 2_500_000, 0], ['70200000', 0, 2_500_000]]);
    await ecriture(c, 'Intérêts du dépôt', n, '2026-12-31', 'Intérêts du dépôt à terme', [[BQ, I, 0], ['77470000', 0, I]], { journal: bq });
    await validerJusqua(c, n, '2026-12-31');
  });
  /** Les lignes de la feuille CONTROLES · { intitule, valeur, erreur, attendu }. */
  const controlesDe = async (an, id, xc) => {
    const r = await relireLiasse(c, R, `${P} · ${an}`, `/exports/etats-financiers/liasse-complete?exerciceId=${id}`, { XC: xc });
    return r?.lignes ?? null;
  };
  const juger = (an, lignes, xc, cc) => {
    if (!lignes) return R.note(`${P} · ${an} · feuille CONTROLES non relue`);
    const ligneXC = lignes.find((l) => /[( ]XC[ )]/.test(l.intitule));
    R.egal(`${P} · ${an} · CONTROLES · XC n'est pas tenu à zéro (attendu vide)`, true, ligneXC !== undefined && (ligneXC.attendu === null || ligneXC.attendu === ''));
    R.montant(`${P} · ${an} · CONTROLES · XC lu`, xc, ligneXC && !ligneXC.erreur ? ligneXC.valeur : null);
    const ligneCC = lignes.find((l) => /[( ]CC[ )]/.test(l.intitule));
    R.montant(`${P} · ${an} · CONTROLES · CC du bilan lu`, cc, ligneCC && !ligneCC.erreur ? ligneCC.valeur : null);
    const ecart = lignes.find((l) => /XC-CC/.test(l.intitule));
    R.montant(`${P} · ${an} · CONTROLES · écart XC-CC (attendu 0)`, 0, ecart && !ecart.erreur && ecart.attendu === 0 ? ecart.valeur : null);
    R.egal(`${P} · ${an} · CONTROLES · aucun intitulé ne dit « régime normal »`, [], lignes.filter((l) => /régime normal/.test(l.intitule)).map((l) => l.intitule));
  };
  await etape(R, `${P} · liasse 2026, feuille CONTROLES`, async () => {
    juger('2026', await controlesDe('2026', n, I), I, I);
  });
  await etape(R, `${P} · compte d'exploitation exporté seul, ligne de contrôle`, async () => {
    const r = await c.lire('Compte d’exploitation 2026', `/exports/etats-financiers/projet/compte-exploitation?exerciceId=${n}`);
    if (!r?.contenu) return R.note(`${P} · export du compte d'exploitation non relu`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.contenu);
    const textes = [];
    wb.getWorksheet('Compte Exploitation')?.eachRow((row) => row.eachCell((cell) => {
      if (typeof cell.value === 'string' && /XC/.test(cell.value)) textes.push(cell.value);
    }));
    const ligne = textes.find((t) => /XC =/.test(t)) ?? '';
    R.note(`${P} · ligne de contrôle « ${ligne} »`);
    R.egal(`${P} · la ligne de contrôle ne dit ni « régime normal » ni « ne boucle pas à zéro »`, true, Boolean(ligne) && !/régime normal/.test(ligne) && !/ne boucle pas/.test(ligne));
  });
  const clos = await etape(R, `${P} · clôture de 2026`, () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) return R.note(`${P} · 2027 non joué · clôture de 2026 non aboutie ou exercice 2027 absent`);
  await etape(R, `${P} · affectation du solde de 2026 au 121`, async () => {
    await c.geste('Affectation du solde 2026', 'POST', '/affectation-resultat', {
      exerciceId: n, dateDecision: '2027-03-31', organe: 'Comité de pilotage du projet',
      lignes: [{ compteId: compte(c, '12100000'), montant: I }],
    });
  });
  // L'affectation entre au brouillard · tant qu'elle n'est pas validée, le 13
  // de 2027 porte encore le solde de 2026, que CC lit (« 13 (131 ou 139) »)
  // et que XC de 2027 n'a pas · l'écart le dit, il ne se cache pas.
  await etape(R, `${P} · 2027, l'affectation encore au brouillard`, async () => {
    // Lu à part · la relecture commune jugerait cette ligne sur son zéro, et
    // c'est justement l'écart qu'elle doit montrer ici.
    const r = await c.lire('Liasse 2027 avant validation', `/exports/etats-financiers/liasse-complete?exerciceId=${n1}`);
    if (!r?.contenu) return R.note(`${P} · liasse 2027 avant validation non relue`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.contenu);
    const ev = evaluateur(wb);
    let lu = null;
    wb.getWorksheet('CONTROLES')?.eachRow((row, rang) => {
      if (/XC-CC/.test(String(row.getCell(1).value ?? ''))) {
        const v = ev.cellule('CONTROLES', `B${rang}`);
        lu = v.erreur ? null : v.valeur;
      }
    });
    R.montant(`${P} · 2027 avant validation · l'écart XC-CC dit le solde de 2026 resté au 13`, -I, lu);
  });
  await etape(R, `${P} · affectation validée, liasses relues à travers la clôture`, async () => {
    await validerJusqua(c, n1, '2027-12-31');
    juger('2026 clos', await controlesDe('2026 clos', n, I), I, I);
    juger('2027', await controlesDe('2027', n1, 0), 0, 0);
  });
}

// ==============================================================================
// A10 · LA PART NON VENTILÉE PAR ÉCHÉANCE, DITE À L'ÉCRAN DES NOTES
// ==============================================================================
//
// Notes par échéance (SYSCOHADA, note 7 · « Créances à un an au plus »,
// « à plus d'un an et à deux ans au plus », « à plus de deux ans »). Le
// serveur range chaque ligne OUVERTE à la clôture par sa date d'échéance, et
// sert à part le RESTE du solde qu'aucune échéance ne range
// (`echeanceNonVentilee`, audit final F10) · ce n'est pas une quatrième
// échéance, c'est ce que la tenue n'a pas daté. L'export le dit en
// commentaire de cellule ; l'écran (`NotesAnnexesRendu.tsx`) ne le disait
// pas · les colonnes d'échéance s'y lisaient complètes alors qu'elles
// laissaient 400 000 de côté.
//
// Chiffres · facture F1 de 1 000 000 au 01/03/2026, échéance 31/03/2027
// (à un an au plus de la clôture du 31/12/2026) ; facture F2 de 400 000 au
// 01/06/2026, SANS échéance. Note 7, ligne « Clients (hors réserves de
// propriété Groupe) » · N 1 400 000, à un an au plus 1 000 000, part non
// ventilée 400 000 (1 400 000 − 1 000 000).
//
// L'écran se prouve par sa source · PAQUET1_A_COPIE nomme la copie jouée
// (main avant, la copie de la ligne après) ; le composant et les modules
// `lib/` qu'il importe doivent lire `echeanceNonVentilee`.
async function pointA10(R) {
  const P = 'A10 (SYSCOHADA)';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · part non ventilée par échéance`, { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1a-a10', exercice: ['2026-01-01', '2026-12-31'] });
  const n = c.exercices.get('2026').id;
  const ven = c.journal('VEN') ?? c.od;
  const cl = await tiers(c, 'CLIENT', 'C10', 'Client sans échéance');
  if (!cl) return R.note(`${P} · tiers absent`);
  await etape(R, `${P} · deux factures, l'une datée d'une échéance, l'autre non`, async () => {
    await ecriture(c, 'Facture F1 datée', n, '2026-03-01', 'Facture FV-A10-1', [[cl.numero, 1_000_000, 0, { dateEcheance: '2027-03-31' }], ['70110000', 0, 1_000_000]], { journal: ven, reference: 'FV-A10-1' });
    await ecriture(c, 'Facture F2 sans échéance', n, '2026-06-01', 'Facture FV-A10-2', [[cl.numero, 400_000, 0], ['70110000', 0, 400_000]], { journal: ven, reference: 'FV-A10-2' });
    await validerJusqua(c, n, '2026-12-31');
  });
  await etape(R, `${P} · note 7 servie par le serveur`, async () => {
    const r = await c.lire('Notes annexes 2026', `/etats-financiers-syscohada/notes?exerciceId=${n}`);
    const note7 = (r?.notes ?? []).find((x) => x.code === '7');
    const ligne = (note7?.lignes ?? []).find((l) => /^Clients \(hors réserves/.test(l.libelle));
    R.montant(`${P} · note 7 · clients, exercice N`, 1_400_000, ligne?.montantN ?? null);
    R.montant(`${P} · note 7 · clients, à un an au plus`, 1_000_000, ligne?.valeurs?.ECHEANCE_1AN ?? null);
    R.montant(`${P} · note 7 · part non ventilée servie par le serveur`, 400_000, ligne?.echeanceNonVentilee ?? null);
  });
  await etape(R, `${P} · l'écran des notes lit la part non ventilée`, async () => {
    const copie = process.env.PAQUET1_A_COPIE;
    if (!copie) return R.note(`${P} · PAQUET1_A_COPIE absent · source de l'écran non relue`);
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dossier = path.join(copie, 'client/src/components');
    const composant = fs.readFileSync(path.join(dossier, 'NotesAnnexesRendu.tsx'), 'utf8');
    // Le composant et les modules `lib/` qu'il importe · la phrase peut vivre
    // dans un module pur, testé sans React. `lib/types.ts` n'en est pas · il
    // DÉCLARE le champ, il ne le lit pas.
    const libs = [...composant.matchAll(/from '\.\.\/lib\/([\w-]+)'/g)]
      .filter((m) => m[1] !== 'types')
      .map((m) => path.join(copie, 'client/src/lib', `${m[1]}.ts`))
      .filter((f) => fs.existsSync(f))
      .map((f) => fs.readFileSync(f, 'utf8'));
    const lit = [composant, ...libs].some((s) => /echeanceNonVentilee/.test(s));
    R.egal(`${P} · NotesAnnexesRendu (ou un module qu'il importe) lit echeanceNonVentilee`, true, lit);
  });
}

// ==============================================================================
// RELECTURE B2 · UNE OD D'OUVERTURE DU PREMIER JOUR CORRIGÉE PAR UN NÉGATIF
// DATÉ PLUS TARD reste-t-elle une ouverture ?
// ==============================================================================
//
// AUDCIF art. 20, al. 2 · « Toute correction d'erreur commise et découverte sur
// l'exercice en cours s'effectue exclusivement par inscription en négatif des
// éléments erronés ; l'enregistrement exact est ensuite opéré. » ; art. 34 · le
// bilan d'ouverture correspond au bilan de clôture précédent. Une OD de bilan
// passée au 01/01/2027 puis annulée en entier par son négatif (fenêtre
// Journal, « Corriger », le 15/02/2027) ne laisse AUCUNE position d'ouverture ·
// la clôture de 2026 doit passer son report entier, sans déclaration, et 2027
// porter le bilan de clôture de 2026, une fois.
//
// Chiffres · 2026 · capital 10 000 000 encaissé, produit 500 000 encaissé ·
// banque 10 500 000, résultat 500 000. OD du 01/01/2027 · banque 10 500 000 /
// capital 10 000 000 / 13 500 000, puis son négatif au 15/02/2027. Après la
// clôture · banque 10 500 000, capital -10 000 000, 13 -500 000.
//
// Deux variantes · l'OD CONCORDE avec le report (la clôture la croyait déjà
// passée et n'ajoutait rien, 2027 restait à zéro), ou elle en DIFFÈRE
// (3 000 000 de banque et de capital · la clôture exigeait une déclaration, et
// RECTIFIER retranchait l'OD une seconde fois).
async function pointB2(R, variante = 'CONCORDANTE') {
  const P = variante === 'CONCORDANTE' ? 'B2' : 'B2 (divergente)';
  R.scenario = `paquet1-a · ${P}`;
  const c = await nouveauDossier(R, `Paquet 1 ${P} · OD d’ouverture corrigée`, {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: variante === 'CONCORDANTE' ? 'p1a-b2' : 'p1a-b2d', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ') ?? c.od;
  const ctx = {};
  await etape(R, `${P} · 2026, puis 2027 ouvert, OD d'ouverture au 01/01/2027 et son négatif au 15/02/2027`, async () => {
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await ecriture(c, 'Capital libéré', n, '2026-01-02', 'Apport des associés', [[BQ, 10_000_000, 0], ['10130000', 0, 10_000_000]], { journal: bq });
    await ecriture(c, 'Produit 2026', n, '2026-06-30', 'Produit de 2026', [[BQ, 500_000, 0], ['70110000', 0, 500_000]], { journal: bq });
    await validerJusqua(c, n, '2026-12-31');
    await c.geste('Nouvel exercice avec reports provisoires', 'POST', `/exercices/${n}/a-nouveaux-provisoires`, {});
    await rechargerExercices(c);
    ctx.n1 = c.exercices.get('2027')?.id;
    if (!ctx.n1) return R.note(`${P} · 2027 absent`);
    const lignesOd = variante === 'CONCORDANTE'
      ? [[BQ, 10_500_000, 0], ['10130000', 0, 10_000_000], ['13100000', 0, 500_000]]
      : [[BQ, 3_000_000, 0], ['10130000', 0, 3_000_000]];
    const od = await ecriture(c, 'OD d’ouverture au 01/01/2027', ctx.n1, '2027-01-01', 'Bilan d’ouverture saisi en OD', lignesOd);
    await validerJusqua(c, ctx.n1, '2027-01-01');
    const neg = od?.id
      ? await c.geste('Correction de l’OD par inscription en négatif', 'POST', `/ecritures/${od.id}/correction`, {
          date: '2027-02-15',
          motifCorrection: 'OD d’ouverture passée à tort · le report de clôture de 2026 en tiendra lieu (banc paquet 1, B2)',
        })
      : null;
    await validerJusqua(c, ctx.n1, '2027-02-15');
    ctx.ok = Boolean(neg?.id);
    R.egal(`${P} · le négatif de l'OD est passé au 15/02/2027`, true, ctx.ok);
  });
  if (!ctx.ok) return;
  await etape(R, `${P} · aperçu de l'ouverture suivante, puis clôture de 2026`, async () => {
    const apercu = await c.lire('Aperçu de l’ouverture 2027', `/exercices/${n}/ouverture-suivante`);
    R.egal(`${P} · aperçu · aucune déclaration requise (l'OD et son négatif se soldent)`, false, apercu?.declarationRequise ?? null);
    const r = await c.req('POST', `/exercices/${n}/cloturer`, {});
    R.egal(`${P} · clôture de 2026 sans déclaration · passe`, true, r.statut < 400);
    if (r.statut >= 400) {
      R.note(`${P} · clôture refusée (${r.statut}) · ${JSON.stringify(r.corps).slice(0, 400)}`);
      const rect = await c.geste('Clôture de 2026 en déclarant « Rectifier »', 'POST', `/exercices/${n}/cloturer`, { ouvertureImportee: 'RECTIFIER' });
      R.note(`${P} · clôture avec RECTIFIER · ${rect ? 'passée' : 'refusée'}`);
    }
    await rechargerExercices(c);
  });
  await etape(R, `${P} · 2027 porte le bilan de clôture de 2026, une fois`, async () => {
    await rechargerComptes(c);
    const b = await balance(c, ctx.n1);
    R.montant(`${P} · 2027 · banque (report seul, l'OD et son négatif se soldent)`, 10_500_000, solde(b, BQ));
    R.montant(`${P} · 2027 · capital`, -10_000_000, solde(b, '10130000'));
    R.montant(`${P} · 2027 · résultat 2026 au 13`, -500_000, solde(b, '13'));
    R.montant(`${P} · 2027 · balance équilibrée`, 0, b ? b.totalDebit - b.totalCredit : NaN);
  });
}

export default async function scenarioPaquet1A(registre) {
  const table = {
    A8: (r) => pointA8(r, 'MODULE'),
    A8M: (r) => pointA8(r, 'MAIN'),
    A1: async (r) => {
      await pointA1(r, 'SYSCOHADA');
      await pointA1(r, 'SYCEBNL');
    },
    A4: async (r) => {
      await pointA4(r, 'SYSCOHADA');
      await pointA4(r, 'SYCEBNL');
    },
    A2: async (r) => {
      await pointA2(r, 'SYSCOHADA');
      await pointA2(r, 'SYCEBNL');
    },
    A3: async (r) => {
      await pointA3(r, 'SYSCOHADA');
      await pointA3(r, 'SYCEBNL');
    },
    A7: async (r) => {
      await pointA7(r, 'SYSCOHADA');
      await pointA7(r, 'SYCEBNL');
    },
    A10: (r) => pointA10(r),
    A9: (r) => pointA9(r),
    A5: (r) => pointA5(r),
    A6: (r) => pointA6(r),
    B2: async (r) => {
      await pointB2(r, 'CONCORDANTE');
      await pointB2(r, 'DIVERGENTE');
    },
  };
  for (const p of POINTS) {
    const fn = table[p];
    if (!fn) continue;
    console.log(`\n--- ${p} ---`);
    try {
      await fn(registre);
    } catch (e) {
      registre.scenario = `paquet1-a · ${p}`;
      registre.note(`${p} interrompu · ${e.stack ?? e.message}`);
    }
  }
}
