import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, rechargerAuRepos, seConnecter, surveiller } from './outils';

/**
 * LES SÉLECTIONS ENREGISTRÉES (ligne sage-l7, fonction 59) · les filtres du
 * journal gardés sous un nom, AU DOSSIER, puis rappelés d'un choix · après un
 * rechargement (la sélection n'est pas une mémoire de la page) et par un
 * autre écran du même dossier ; jamais l'exercice ; un même nom se remplace.
 */

test('SYSCOHADA · une sélection du journal s’enregistre au dossier, se rappelle et se remplace', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Sélections e2e', montant: 2_500 });
  await seConnecter(page, dossier.email);

  await page.goto('/#/journal?onglet=journal');
  await page.getByRole('button', { name: /^Filtrer/ }).click();
  await page.getByLabel('Compte').fill('52');
  await page.getByRole('button', { name: 'Enregistrer la sélection…' }).click();
  await page.getByLabel('Nom de la sélection').fill('Banque');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Sélection « Banque » enregistrée.')).toBeVisible();

  // Rechargée, la fenêtre a tout oublié · la sélection, gardée au dossier, rappelle le filtre.
  await rechargerAuRepos(page);
  await page.getByRole('button', { name: /^Filtrer/ }).click();
  await expect(page.getByLabel('Compte')).toHaveValue('');
  await page.getByLabel('Sélection enregistrée').selectOption({ label: 'Banque' });
  await expect(page.getByLabel('Compte')).toHaveValue('52');
  await expect(page.getByRole('button', { name: 'Filtrer (actif)' })).toBeVisible();

  // Même nom · la sélection se remplace, jamais en double.
  await page.getByLabel('Compte').fill('521');
  await page.getByRole('button', { name: 'Enregistrer la sélection…' }).click();
  await expect(page.getByLabel('Nom de la sélection')).toHaveValue('Banque');
  await page.getByRole('button', { name: 'Remplacer « Banque »' }).click();
  await expect(page.getByText('Sélection « Banque » remplacée.')).toBeVisible();

  const lues = await appelApi<{ selections: { nom: string; criteres: Record<string, unknown> }[]; total: number }>(
    page,
    'GET',
    '/selections-edition?edition=JOURNAL',
  );
  expect(lues.total).toBe(1);
  expect(lues.selections[0].nom).toBe('Banque');
  expect(lues.selections[0].criteres.compte).toBe('521');
  expect(lues.selections[0].criteres).not.toHaveProperty('exerciceId');

  // Supprimée, elle ne se propose plus.
  await page.getByRole('button', { name: 'Supprimer la sélection' }).click();
  await expect(page.getByText('Sélection « Banque » supprimée.')).toBeVisible();
  await expect(page.getByLabel('Sélection enregistrée')).toBeDisabled();

  expect(pannes).toEqual([]);
});
