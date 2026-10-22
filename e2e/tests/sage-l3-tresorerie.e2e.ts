import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * FINANCEMENTS ET PLACEMENTS (ligne sage-l3, n° 47, décision D16 · Sage,
 * F_TAUXREFERENCE, F_OPFINANCEMENT, F_OPPLACEMENT), sur le serveur réel et
 * une vraie base, à travers une clôture. Fiches des comptes 52 (525 ou 2784),
 * 56 (561, 566), 67 (6745), 63 (631), 77 (774, 5267) et 47 (476, 477) ·
 * postulat de spécialisation des exercices. Ici · un taux de référence et ses
 * cours, un crédit de trésorerie à intérêts post-comptés et un dépôt à terme
 * à intérêts précomptés, à cheval sur la clôture ; la régularisation de N, la
 * clôture, la contre-passation à l'ouverture de N+1, les échéances aux
 * intérêts déclarés, chaque solde lu contre le montant calculé à la main, et
 * l'annulation à rebours, au brouillard puis en négatif.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string }
interface Journal { id: string; code: string; type: string }
interface LigneBalance { numero: string; reportDebit: number; reportCredit: number; mouvementDebit: number; mouvementCredit: number; solde: number }
interface Acte { id: string; nature: string; annuleLe: string | null; ecriture: { id: string; statut: string } | null; ecritureNegatif: { id: string } | null }
interface Operation {
  id: string;
  statut: string;
  tauxApplique: number;
  interetsProposes: number;
  regularisationProposee: { date: string; montant: number; compte: string } | null;
  contrePassationProposee: { regularisationId: string; date: string; montant: number } | null;
  actes: Acte[];
}

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);
const refusDe = (p: Promise<unknown>) => p.then(() => 'accepté', (e: unknown) => String(e));
const centimes = (x: number) => Math.round(x * 100);

test('SYSCOHADA · crédit de trésorerie et dépôt à terme · taux de référence, régularisation à la clôture, contre-passation, échéances, annulation à rebours', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Trésorerie e2e SARL', montant: 50_000_000 });
  await seConnecter(page, dossier.email);
  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = Number(N.dateDebut.slice(0, 4));
  const balance = async (exerciceId: string) => (await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${exerciceId}`)).lignes;
  const solde = (lignes: LigneBalance[], racine: string) => lignes.filter((l) => l.numero.startsWith(racine)).reduce((s, l) => s + centimes(l.solde), 0) / 100;
  // La banque seule · le préfixe « 52 » prendrait aussi le dépôt à terme (525).
  const banqueDe = (lignes: LigneBalance[]) => (centimes(solde(lignes, '52')) - centimes(solde(lignes, '525'))) / 100;
  const valider = (e: Exercice) => appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: e.id, dateLimite: jour(e.dateFin) });
  const liste = async (e: Exercice) => (await appelApi<{ operations: Operation[] }>(page, 'GET', `/operations-tresorerie?exerciceId=${e.id}`)).operations;

  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const bq = journaux.find((j) => j.code === 'BQ')!;
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const comptesDuRole = async (type: string, role: string) => (await appelApi<{ racines: string[]; comptes: Compte[] }>(page, 'GET', `/operations-tresorerie/comptes?type=${type}&role=${role}`));
  const compte = async (type: string, role: string, numero: string) => (await comptesDuRole(type, role)).comptes.find((c) => c.numero === numero)!;
  expect((await comptesDuRole('FINANCEMENT', 'INTERETS')).racines).toEqual(['6745']);
  expect((await comptesDuRole('PLACEMENT', 'PRINCIPAL')).racines).toEqual(['525', '2784']);

  // (1) LE TAUX DE RÉFÉRENCE ET SES COURS · déclarés avec leur source.
  const tr = await appelApi<{ id: string }>(page, 'POST', '/taux-reference', { code: 'TBCC', intitule: 'Taux directeur de la Banque centrale' });
  expect(await refusDe(appelApi(page, 'POST', `/taux-reference/${tr.id}/cours`, { date: `${annee}-01-01`, valeur: 8.25, source: '' }))).toMatch(/source/);
  await appelApi(page, 'POST', `/taux-reference/${tr.id}/cours`, { date: `${annee}-01-01`, valeur: 8.25, source: 'Communiqué de la Banque centrale du 1er janvier' });
  expect(await refusDe(appelApi(page, 'POST', `/taux-reference/${tr.id}/cours`, { date: `${annee}-01-01`, valeur: 9, source: 'Doublon' }))).toMatch(/ne se réécrit pas/);

  const [c561, c6745, c566, c631] = [
    await compte('FINANCEMENT', 'PRINCIPAL', '56100000'),
    await compte('FINANCEMENT', 'INTERETS', '67450000'),
    await compte('FINANCEMENT', 'COURUS', '56600000'),
    await compte('FINANCEMENT', 'FRAIS', '63180000'),
  ];
  const financement = {
    type: 'FINANCEMENT',
    modeInterets: 'POST_COMPTES',
    reference: 'CT-01',
    journalBanqueId: bq.id,
    journalOdId: od.id,
    comptePrincipalId: c561.id,
    compteInteretsId: c6745.id,
    compteCourusId: c566.id,
    compteFraisId: c631.id,
    tauxReferenceId: tr.id,
    marge: 3.75,
    baseCalcul: 360,
    frais: 50_000,
    montant: 10_000_000,
    dateMiseEnPlace: `${annee}-10-01`,
    dateEcheance: `${annee + 1}-03-30`,
    referenceConvention: 'Convention de crédit 7/2026',
    dateConvention: `${annee}-09-20`,
  };
  // Un cours POSTÉRIEUR à la mise en place n'est jamais en vigueur.
  const tr2 = await appelApi<{ id: string }>(page, 'POST', '/taux-reference', { code: 'TARD', intitule: 'Taux publié trop tard' });
  await appelApi(page, 'POST', `/taux-reference/${tr2.id}/cours`, { date: `${annee}-11-01`, valeur: 5, source: 'Avis de la banque' });
  expect(await refusDe(appelApi(page, 'POST', '/operations-tresorerie', { ...financement, tauxReferenceId: tr2.id }))).toMatch(/aucun cours déclaré/);

  // (2) LA MISE EN PLACE DU CRÉDIT · 8,25 + 3,75 = 12 % figés · D 52 9 950 000, D 631 50 000 / C 561 10 000 000.
  const banque0 = banqueDe(await balance(N.id));
  const credit = await appelApi<Operation>(page, 'POST', '/operations-tresorerie', financement);
  expect([credit.statut, credit.tauxApplique, credit.interetsProposes]).toEqual(['EN_COURS', 12, 600_000]);
  let b = await balance(N.id);
  expect([solde(b, '561'), solde(b, '631'), banqueDe(b) - banque0]).toEqual([-10_000_000, 50_000, 9_950_000]);
  // Un cours déclaré ensuite ne change pas le taux figé.
  await appelApi(page, 'POST', `/taux-reference/${tr.id}/cours`, { date: `${annee}-12-01`, valeur: 10, source: 'Communiqué de décembre' });
  expect((await appelApi<Operation>(page, 'GET', `/operations-tresorerie/${credit.id}`)).tauxApplique).toBe(12);

  // (3) LE DÉPÔT À TERME · bloqué plus d'un an, il va au 2784, jamais au 525 ;
  // débloquable, au 525 · intérêts précomptés déclarés, 75 000.
  const [c525, c2784, c774] = [await compte('PLACEMENT', 'PRINCIPAL', '52500000'), await compte('PLACEMENT', 'PRINCIPAL', '27840000'), await compte('PLACEMENT', 'INTERETS', '77460000')];
  const depot = {
    type: 'PLACEMENT',
    modeInterets: 'PRECOMPTES',
    reference: 'DAT-01',
    journalBanqueId: bq.id,
    journalOdId: od.id,
    comptePrincipalId: c525.id,
    compteInteretsId: c774.id,
    tauxFixe: 6,
    baseCalcul: 360,
    montant: 5_000_000,
    interetsPrecomptes: 75_000,
    deblocableAToutMoment: false,
    dateMiseEnPlace: `${annee}-11-01`,
    dateEcheance: `${annee + 2}-04-30`,
    referenceConvention: 'Contrat de dépôt 3/2026',
    dateConvention: `${annee}-10-28`,
  };
  expect(await refusDe(appelApi(page, 'POST', '/operations-tresorerie', depot))).toMatch(/2784/);
  expect(c2784).toBeTruthy();
  const dat = await appelApi<Operation>(page, 'POST', '/operations-tresorerie', { ...depot, deblocableAToutMoment: true, dateEcheance: `${annee + 1}-04-30` });
  b = await balance(N.id);
  expect([solde(b, '525'), solde(b, '774'), banqueDe(b) - banque0]).toEqual([5_000_000, -75_000, 9_950_000 - 4_925_000]);

  // (4) L'ÉCHÉANCE NE TRAVERSE PAS UNE CLÔTURE OUVERTE SANS RÉGULARISATION.
  const N1 = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: lendemain(N.dateFin), dateFin: `${annee + 1}-12-31` });
  expect(await refusDe(appelApi(page, 'POST', `/operations-tresorerie/${credit.id}/echeance`, { date: `${annee + 1}-03-30`, interets: 600_000 }))).toMatch(/n'a pas rattaché ses intérêts/);

  // (5) LA RÉGULARISATION DE N · proposée au prorata des jours, déclarée.
  // Crédit · 180 jours, 91 courus au 31 décembre · 600 000 × 91 / 180 = 303 333,33 au 566.
  // Dépôt · 180 jours, 60 courus · part NON courue 75 000 × 120 / 180 = 50 000 au 477.
  const [lc, ld] = await liste(N).then((ops) => [ops.find((o) => o.id === credit.id)!, ops.find((o) => o.id === dat.id)!]);
  expect(lc.regularisationProposee).toEqual({ date: jour(N.dateFin), montant: 303_333.33, compte: '56600000' });
  expect(ld.regularisationProposee).toEqual({ date: jour(N.dateFin), montant: 50_000, compte: '47700000' });
  expect(await refusDe(appelApi(page, 'POST', `/operations-tresorerie/${dat.id}/regulariser`, { exerciceId: N.id, montant: 75_000.01 }))).toMatch(/ne dépasse pas/);
  await appelApi(page, 'POST', `/operations-tresorerie/${credit.id}/regulariser`, { exerciceId: N.id, montant: 303_333.33 });
  await appelApi(page, 'POST', `/operations-tresorerie/${dat.id}/regulariser`, { exerciceId: N.id, montant: 50_000 });
  expect(await refusDe(appelApi(page, 'POST', `/operations-tresorerie/${dat.id}/regulariser`, { exerciceId: N.id, montant: 50_000 }))).toMatch(/déjà régularisée/);
  b = await balance(N.id);
  expect([solde(b, '566'), solde(b, '6745'), solde(b, '477'), solde(b, '774')]).toEqual([-303_333.33, 303_333.33, -50_000, -25_000]);

  // (6) LA CLÔTURE DE N, puis la contre-passation à l'ouverture de N+1 · sans
  // elle, l'échéance est refusée (la part de N serait comptée deux fois).
  await valider(N);
  await appelApi(page, 'POST', `/exercices/${N.id}/cloturer`);
  expect(await refusDe(appelApi(page, 'POST', `/operations-tresorerie/${credit.id}/echeance`, { date: `${annee + 1}-03-30`, interets: 600_000 }))).toMatch(/n'est pas contre-passée/);
  const [pc, pd] = await liste(N1).then((ops) => [ops.find((o) => o.id === credit.id)!, ops.find((o) => o.id === dat.id)!]);
  expect([pc.contrePassationProposee?.date, pc.contrePassationProposee?.montant]).toEqual([lendemain(N.dateFin), 303_333.33]);
  await appelApi(page, 'POST', `/operations-tresorerie/${credit.id}/contre-passer`, { regularisationId: pc.contrePassationProposee!.regularisationId });
  await appelApi(page, 'POST', `/operations-tresorerie/${dat.id}/contre-passer`, { regularisationId: pd.contrePassationProposee!.regularisationId });
  b = await balance(N1.id);
  const l566 = b.find((l) => l.numero === '56600000')!;
  expect([l566.reportCredit, l566.mouvementDebit, l566.solde]).toEqual([303_333.33, 303_333.33, 0]);
  expect([solde(b, '6745'), solde(b, '477'), solde(b, '774')]).toEqual([-303_333.33, 0, -50_000]);

  // (7) LES ÉCHÉANCES DE N+1 · intérêts post-comptés déclarés (600 000) ·
  // la charge de N+1 est ce qui reste, 296 666,67 ; le 561 et le 525 soldés.
  const banque1 = banqueDe(await balance(N1.id));
  await appelApi(page, 'POST', `/operations-tresorerie/${credit.id}/echeance`, { date: `${annee + 1}-03-30`, interets: 600_000 });
  const echDepot = await appelApi<Operation>(page, 'POST', `/operations-tresorerie/${dat.id}/echeance`, { date: `${annee + 1}-04-30` });
  expect(echDepot.statut).toBe('ECHUE');
  b = await balance(N1.id);
  expect([solde(b, '561'), solde(b, '525'), solde(b, '6745'), banqueDe(b) - banque1]).toEqual([0, 0, 296_666.67, -10_600_000 + 5_000_000]);

  // (8) L'ANNULATION À REBOURS · la contre-passation ne s'annule pas avant
  // l'échéance ; l'échéance au brouillard est retirée, l'opération rouverte ;
  // repassée puis validée, elle s'inscrit en négatif ; la régularisation de
  // l'exercice clôturé ne s'annule plus.
  const contre = echDepot.actes.find((a) => a.nature === 'CONTRE_PASSATION' && !a.annuleLe)!;
  expect(await refusDe(appelApi(page, 'POST', `/operations-tresorerie/${dat.id}/actes/${contre.id}/annuler`, { motif: 'Essai' }))).toMatch(/à rebours/);
  const ech = echDepot.actes.find((a) => a.nature === 'ECHEANCE' && !a.annuleLe)!;
  const r1 = await appelApi<{ statut: string; traitement: string }>(page, 'POST', `/operations-tresorerie/${dat.id}/actes/${ech.id}/annuler`, { motif: 'Date erronée' });
  expect([r1.statut, r1.traitement]).toEqual(['EN_COURS', 'SUPPRIMEE']);
  const re = await appelApi<Operation>(page, 'POST', `/operations-tresorerie/${dat.id}/echeance`, { date: `${annee + 1}-04-30` });
  await valider(N1);
  const ech2 = re.actes.find((a) => a.nature === 'ECHEANCE' && !a.annuleLe)!;
  const r2 = await appelApi<{ statut: string; traitement: string }>(page, 'POST', `/operations-tresorerie/${dat.id}/actes/${ech2.id}/annuler`, { motif: 'Dépôt prorogé par la banque' });
  expect([r2.statut, r2.traitement]).toEqual(['EN_COURS', 'INSCRITE_EN_NEGATIF']);
  b = await balance(N1.id);
  expect(solde(b, '525')).toBe(5_000_000);
  const contre2 = (await appelApi<Operation>(page, 'GET', `/operations-tresorerie/${dat.id}`)).actes.find((a) => a.nature === 'CONTRE_PASSATION' && !a.annuleLe)!;
  await appelApi(page, 'POST', `/operations-tresorerie/${dat.id}/actes/${contre2.id}/annuler`, { motif: 'Refaire la contre-passation' });
  const reg = (await appelApi<Operation>(page, 'GET', `/operations-tresorerie/${dat.id}`)).actes.find((a) => a.nature === 'REGULARISATION' && !a.annuleLe)!;
  expect(await refusDe(appelApi(page, 'POST', `/operations-tresorerie/${dat.id}/actes/${reg.id}/annuler`, { motif: 'Essai' }))).toMatch(/exercice clôturé/);

  // (9) UN TAUX QUI PORTE UNE OPÉRATION NE SE RETIRE PAS, ni le cours qu'elle a retenu.
  expect(await refusDe(appelApi(page, 'DELETE', `/taux-reference/${tr.id}`))).toMatch(/ne se retire pas/);
  expect(pannes).toEqual([]);
});
