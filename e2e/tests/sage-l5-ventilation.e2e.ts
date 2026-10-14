import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L5, FONCTION 88 · LA VENTILATION ANALYTIQUE DE LA PAIE, SUR
 * VRAIE BASE, À TRAVERS UNE CLÔTURE.
 *
 * Association SYCEBNL, plan PROJ semé, deux sections · P1 (eau), P2 (école).
 * KASONGO se répartit 60 % P1, 40 % P2 à partir de décembre 2026 (déclaré à
 * l'écran), MUTOMBO 100 % P2. Les deux bulletins de décembre (780 000 FC,
 * identiques) passés au journal · chaque ligne de classe 6 se partage 30 %
 * P1, 70 % P2 ; le plan BAIL, sans répartition, le dit. L'exercice 2026 est
 * clôturé. KASONGO passe à 100 % P1 à partir de janvier 2027 · janvier se
 * partage 50 / 50, et décembre, déjà passé, ne bouge pas. Puis le bulletin de
 * décembre de KASONGO est annulé et réémis à 800 000 FC, et décembre se
 * repasse dans 2027 · le réémis suit la répartition de DÉCEMBRE (60 / 40, le
 * mois de paie, jamais la date de passation), la reprise en négatif part
 * sans ventilation, et le contrôle des cumuls compte exactement ces lignes.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string; statut: string }
interface Journal { id: string; code: string; type: string }
interface Bulletin { id: string }
interface Plan { id: string; code: string }
interface Ventilation { planCode: string; sectionCode: string; montantFc: number }
interface Proposition {
  lignes: { compte: string; sens: 'DEBIT' | 'CREDIT'; montantFc: number; negatif?: boolean }[];
  ventilation: {
    parLigne: Ventilation[][];
    nonVentilees: { index: number; compte: string; planCode: string; cause: string; motif: string }[];
    reserves: string[];
    obligatoires: string[];
  };
}
interface LigneBalanceAnalytique { code: string; debit: number; credit: number }
interface ControleCumuls {
  planCode: string;
  mouvementsGenerauxDebit: number;
  mouvementsAnalytiquesDebit: number;
  nombreSansRepartition: number;
}

const centimes = (n: number) => Math.round(n * 100);

test('SYCEBNL · répartition par salarié appliquée à la passation, version par mois de paie, à travers la clôture 2026 / 2027', async ({ page }) => {
  test.setTimeout(360_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Ventilation paie e2e', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });

  const plans = await appelApi<Plan[]>(page, 'GET', '/analytique/plans');
  const proj = plans.find((p) => p.code === 'PROJ')!;
  const p1 = await appelApi<{ id: string }>(page, 'POST', `/analytique/plans/${proj.id}/sections`, { code: 'P1', intitule: 'Projet eau' });
  const p2 = await appelApi<{ id: string }>(page, 'POST', `/analytique/plans/${proj.id}/sections`, { code: 'P2', intitule: 'Projet école' });

  const salarie = async (nom: string, prenoms: string) => {
    const s = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom, prenoms, sexe: 'MASCULIN', dateNaissance: '1985-04-12' });
    await appelApi(page, 'POST', `/personnel/salaries/${s.id}/contrats`, {
      type: 'DUREE_INDETERMINEE',
      dateEntreeEnVigueur: '2026-01-01',
      periodiciteRemuneration: 'MOIS',
      remunerationBase: 780_000,
      deviseRemuneration: 'CDF',
    });
    return s;
  };
  const kasongo = await salarie('KASONGO', 'Jean');
  const mutombo = await salarie('MUTOMBO', 'Alain');

  // À l'écran · la répartition de KASONGO, 60 / 40 à partir de décembre 2026.
  await page.goto('/#/personnel?onglet=registre');
  await page.getByRole('row').filter({ hasText: 'KASONGO Jean' }).click();
  await expect(page.getByText('Aucune répartition déclarée.')).toBeVisible();
  await page.getByRole('button', { name: 'Déclarer une répartition' }).click();
  const modale = page.getByRole('dialog', { name: 'Déclarer une répartition analytique' });
  await modale.getByLabel('Plan analytique').selectOption(proj.id);
  await modale.getByLabel('À partir du mois de paie').fill('2026-12');
  await modale.getByLabel('Section 1').selectOption(p1.id);
  await modale.getByLabel('Pourcentage 1').fill('60');
  await modale.getByRole('button', { name: 'Ajouter une section' }).click();
  await modale.getByLabel('Section 2').selectOption(p2.id);
  await modale.getByLabel('Pourcentage 2').fill('30');
  await expect(modale.getByText('Total · 90 %')).toBeVisible();
  // Le serveur refuse ce qui ne fait pas 100 %, et le dit.
  await modale.getByRole('button', { name: 'Déclarer', exact: true }).click();
  await expect(modale.getByRole('alert')).toContainText('font 90.00 %');
  await modale.getByLabel('Pourcentage 2').fill('40');
  await modale.getByRole('button', { name: 'Déclarer', exact: true }).click();
  await expect(modale).toBeHidden();
  await expect(page.getByRole('cell', { name: 'P1 60 % · P2 40 %' })).toBeVisible();

  await appelApi(page, 'POST', `/personnel/salaries/${mutombo.id}/repartitions-analytiques`, {
    planId: proj.id,
    moisEffet: '2026-12',
    lignes: [{ sectionId: p2.id, pourcentage: 100 }],
  });
  // Une version ne se modifie pas · la même, au même mois, est refusée.
  await expect(
    appelApi(page, 'POST', `/personnel/salaries/${mutombo.id}/repartitions-analytiques`, {
      planId: proj.id,
      moisEffet: '2026-12',
      lignes: [{ sectionId: p1.id, pourcentage: 100 }],
    }),
  ).rejects.toThrow(/409/);

  const emettre = (salarieId: string, mois: string, salaire = 780_000) =>
    appelApi<Bulletin>(page, 'POST', `/personnel/salaries/${salarieId}/bulletins`, {
      moisDePaie: mois,
      elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: salaire }],
      natureEmployeurInpp: 'PRIVE',
      effectif: 12,
    });
  const bkDec = await emettre(kasongo.id, '2026-12');
  await emettre(mutombo.id, '2026-12');

  // La proposition de décembre · 66110000 de 1 560 000, P1 468 000 (60 % de 780 000), P2 1 092 000.
  const lire = (mois: string) => appelApi<Proposition>(page, 'GET', `/personnel/paie-du-mois/${mois}`);
  const dec = await lire('2026-12');
  const iSalaires = dec.lignes.findIndex((l) => l.compte === '66110000' && !l.negatif);
  expect(dec.lignes[iSalaires].montantFc).toBe(1_560_000);
  expect(dec.ventilation.parLigne[iSalaires].map((v) => [v.planCode, v.sectionCode, v.montantFc])).toEqual([
    ['PROJ', 'P1', 468_000],
    ['PROJ', 'P2', 1_092_000],
  ]);
  expect(dec.ventilation.nonVentilees.filter((n) => n.planCode === 'PROJ')).toEqual([]);
  expect(dec.ventilation.reserves.join(' ')).toMatch(/Plan BAIL · aucune répartition de la paie n'y est déclarée/);
  // Chaque ligne de classe 6 · le plan PROJ égale la ligne, au centime, et P1 en porte 30 %.
  const projDe = (p: Proposition, section: string) =>
    p.ventilation.parLigne.flat().filter((v) => v.planCode === 'PROJ' && v.sectionCode === section).reduce((n, v) => n + centimes(v.montantFc), 0);
  const classe6 = (p: Proposition) => p.lignes.filter((l) => l.compte.startsWith('6')).reduce((n, l) => n + centimes(l.montantFc), 0);
  dec.lignes.forEach((l, i) => {
    if (l.compte.startsWith('6')) {
      expect(dec.ventilation.parLigne[i].filter((v) => v.planCode === 'PROJ').reduce((n, v) => n + centimes(v.montantFc), 0)).toBe(centimes(l.montantFc));
    }
  });
  const nbLignes6 = dec.lignes.filter((l) => l.compte.startsWith('6')).length;
  expect(Math.abs(projDe(dec, 'P1') - Math.round(classe6(dec) * 0.3))).toBeLessThanOrEqual(nbLignes6);
  expect(projDe(dec, 'P1') + projDe(dec, 'P2')).toBe(classe6(dec));

  // À l'écran · la colonne Analytique de la paie du mois.
  await page.goto('/#/personnel?onglet=bulletins');
  await page.reload();
  await page.getByLabel('Mois de paie').fill('2026-12');
  await expect(page.getByText(/PROJ P1 · 468\s000,00/)).toBeVisible();

  // Décembre passé au journal, validé, 2026 clôturé.
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const balanceAnalytique = async (exerciceId: string) =>
    (await appelApi<{ lignes: LigneBalanceAnalytique[] }>(page, 'GET', `/analytique/etats/balance?planId=${proj.id}&exerciceId=${exerciceId}`)).lignes;
  const debitDe = (lignes: LigneBalanceAnalytique[], code: string) => centimes(lignes.find((l) => l.code === code)?.debit ?? 0);
  const controle = async (exerciceId: string) =>
    (await appelApi<ControleCumuls[]>(page, 'GET', `/analytique/etats/controle-cumuls?exerciceId=${exerciceId}&planId=${proj.id}`)).find((c) => c.planCode === 'PROJ')!;
  // Avant la paie · la seule ligne sans répartition est le produit de la
  // création du dossier (classe 7, que PROJ ventile) · la paie n'en ajoute aucune.
  const avant = await controle(exercice.id);
  await appelApi(page, 'POST', '/personnel/paie-du-mois/2026-12/comptabilisation', { exerciceId: exercice.id, journalId: od.id, date: '2026-12-31' });
  let b2026 = await balanceAnalytique(exercice.id);
  expect([debitDe(b2026, 'P1'), debitDe(b2026, 'P2')]).toEqual([projDe(dec, 'P1'), projDe(dec, 'P2')]);
  const c2026 = await controle(exercice.id);
  expect(c2026.nombreSansRepartition).toBe(avant.nombreSansRepartition);
  expect(centimes(c2026.mouvementsAnalytiquesDebit)).toBe(centimes(c2026.mouvementsGenerauxDebit));

  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: '2026-12-31' });
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);

  // KASONGO à 100 % P1 à partir de janvier 2027 · janvier se partage 50 / 50.
  await appelApi(page, 'POST', `/personnel/salaries/${kasongo.id}/repartitions-analytiques`, {
    planId: proj.id,
    moisEffet: '2027-01',
    lignes: [{ sectionId: p1.id, pourcentage: 100 }],
  });
  await emettre(kasongo.id, '2027-01');
  await emettre(mutombo.id, '2027-01');
  const jan = await lire('2027-01');
  expect(projDe(jan, 'P1')).toBe(projDe(jan, 'P2'));
  expect(projDe(jan, 'P1') + projDe(jan, 'P2')).toBe(classe6(jan));
  await appelApi(page, 'POST', '/personnel/paie-du-mois/2027-01/comptabilisation', { exerciceId: suivant.id, journalId: od.id, date: '2027-01-31' });

  // Décembre, clos, n'a pas bougé.
  b2026 = await balanceAnalytique(exercice.id);
  expect([debitDe(b2026, 'P1'), debitDe(b2026, 'P2')]).toEqual([projDe(dec, 'P1'), projDe(dec, 'P2')]);

  // Le bulletin de décembre de KASONGO, annulé et réémis à 800 000 · décembre se repasse dans 2027.
  await appelApi(page, 'POST', `/personnel/bulletins/${bkDec.id}/annulation`, { motif: 'Prime de fin d’année oubliée' });
  await emettre(kasongo.id, '2026-12', 800_000);
  const reprise = await lire('2026-12');
  const iReemis = reprise.lignes.findIndex((l) => l.compte === '66110000' && !l.negatif);
  // La répartition de DÉCEMBRE (60 / 40), pas celle de janvier · le mois de paie décide.
  expect(reprise.ventilation.parLigne[iReemis].map((v) => [v.sectionCode, v.montantFc])).toEqual([
    ['P1', 480_000],
    ['P2', 320_000],
  ]);
  const sansVentilation = reprise.ventilation.nonVentilees.filter((n) => n.planCode === 'PROJ');
  expect(sansVentilation.length).toBeGreaterThan(0);
  expect(sansVentilation.every((n) => n.cause === 'REPRISE_EN_NEGATIF')).toBe(true);
  expect(reprise.ventilation.reserves.join(' ')).toMatch(/REPRISE EN NÉGATIF · ses lignes ne se ventilent pas d'office/);
  await appelApi(page, 'POST', '/personnel/paie-du-mois/2026-12/comptabilisation', {
    exerciceId: suivant.id,
    journalId: od.id,
    date: '2027-01-31',
    inscrireNegatifs: true,
  });

  // 2027 · la balance analytique est la somme des deux passations, et le
  // contrôle des cumuls compte EXACTEMENT les lignes de la reprise, laissées
  // sans ventilation (elles se ventilent à la main, ligne par ligne).
  const b2027 = await balanceAnalytique(suivant.id);
  expect([debitDe(b2027, 'P1'), debitDe(b2027, 'P2')]).toEqual([
    projDe(jan, 'P1') + projDe(reprise, 'P1'),
    projDe(jan, 'P2') + projDe(reprise, 'P2'),
  ]);
  const c2027 = await controle(suivant.id);
  expect(c2027.nombreSansRepartition).toBe(sansVentilation.length);

  expect(pannes).toEqual([]);
});
