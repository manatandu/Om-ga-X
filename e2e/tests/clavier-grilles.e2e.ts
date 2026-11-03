import { expect, test } from '@playwright/test';
import { creerDossier, seConnecter, surveiller } from './outils';

/**
 * LOT 3 DU DESIGN · le clavier dans les grilles et dans les modales, au
 * navigateur (Chromium ; WebKit si PW_WEBKIT). Les unitaires n'ont pas de DOM :
 * ici le focus bouge pour de bon.
 */
const MONTANT = 150_000;

test('balance · tableau nommé, en-têtes triables, grand livre ouvert à Entrée comme au double-clic', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Clavier e2e balance', montant: MONTANT });
  await seConnecter(page, dossier.email);

  await page.goto('/#/journal?onglet=balance');
  const balance = page.getByRole('table', { name: 'Balance des comptes' });
  await expect(balance).toBeVisible();
  await expect(balance.getByRole('columnheader').first()).toBeVisible();

  // En-tête figé : le groupe d'en-têtes est collant, et le pied aussi.
  const collant = await balance.locator('.entete-fixe').first().evaluate((el) => getComputedStyle(el).position);
  expect(collant).toBe('sticky');
  const piedCollant = await balance.locator('.pied-fixe').first().evaluate((el) => getComputedStyle(el).position);
  expect(piedCollant).toBe('sticky');

  // Tri par clic : aria-sort passe de none à ascending puis descending, puis revient.
  const intitule = balance.getByRole('columnheader', { name: /Intitulé du compte/ });
  await expect(intitule).toHaveAttribute('aria-sort', 'none');
  await intitule.getByRole('button').click();
  await expect(intitule).toHaveAttribute('aria-sort', 'ascending');
  await intitule.getByRole('button').click();
  await expect(intitule).toHaveAttribute('aria-sort', 'descending');
  await intitule.getByRole('button').click();
  await expect(intitule).toHaveAttribute('aria-sort', 'none');

  // Filtre : un texte absent vide la liste mais pas les totaux.
  await page.getByLabel('Filtrer la balance par numéro ou intitulé de compte').fill('zzzz-introuvable');
  await expect(page.getByText('Aucun compte ne correspond au filtre.')).toBeVisible();
  await expect(balance.getByText(/Totaux généraux \(balance entière\)/)).toBeVisible();
  await page.getByLabel('Filtrer la balance par numéro ou intitulé de compte').fill('');

  // Au clavier : la ligne du compte est atteignable, Entrée ouvre son grand livre.
  const ligne = balance.locator('[role=row][tabindex="0"]').first();
  await ligne.focus();
  await expect(ligne).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('table', { name: /^Grand livre du compte/ }).first()).toBeVisible();

  // Le double-clic reste.
  await page.getByRole('button', { name: 'Balance', exact: true }).click();
  await expect(balance).toBeVisible();
  await balance.locator('[role=row][tabindex="0"]').first().dblclick();
  await expect(page.getByRole('table', { name: /^Grand livre du compte/ }).first()).toBeVisible();

  expect(pannes).toEqual([]);
});


test('modale · le focus boucle dans la boîte et revient au déclencheur à la fermeture', async ({ page }) => {
  test.setTimeout(90_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Clavier e2e modale', montant: MONTANT });
  await seConnecter(page, dossier.email);

  await page.goto('/#/journal?onglet=journal');
  const declencheur = page.getByTitle('Fiche d\'imputation').first();
  await declencheur.focus();
  await declencheur.press('Enter');
  const boite = page.getByRole('dialog').first();
  await expect(boite).toBeVisible();
  await expect(boite).toHaveAttribute('aria-modal', 'true');
  expect(await boite.getAttribute('aria-labelledby') ?? await boite.getAttribute('aria-label')).toBeTruthy();

  const dedans = () => page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
  // Tab 12 fois puis Maj+Tab 12 fois : le focus ne sort jamais de la boîte.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dedans(), `Tab n°${i + 1}`).toBe(true);
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await dedans(), `Maj+Tab n°${i + 1}`).toBe(true);
  }

  // Échap ferme (inchangé) et le focus revient au bouton qui a ouvert la boîte.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(declencheur).toBeFocused();

  expect(pannes).toEqual([]);
});

test('aide « ? » · reliée à sa bulle, Échap la ferme et rend le focus', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Clavier e2e aide', montant: MONTANT });
  await seConnecter(page, dossier.email);

  await page.goto('/#/journal?onglet=balance');
  const aide = page.getByRole('button', { name: /^Aide : Balance regroupée par collectif/ });
  await aide.focus();
  const bulle = page.getByRole('tooltip');
  await expect(bulle).toBeVisible();
  const id = await bulle.getAttribute('id');
  expect(id).toBeTruthy();
  await expect(aide).toHaveAttribute('aria-describedby', id!);

  // Flèche bas : le clavier va dans la bulle ; Échap la ferme et rend le « ? ».
  await page.keyboard.press('ArrowDown');
  await expect(bulle).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(aide).toBeFocused();

  expect(pannes).toEqual([]);
});
