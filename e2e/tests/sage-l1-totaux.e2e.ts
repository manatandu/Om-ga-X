import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * MASQUER LES TOTAUX DE LA SAISIE (ligne sage-l1, fonction 11) · une
 * préférence du poste. Cochée, les lignes « Totaux journal » et « Totaux
 * pièce » disparaissent, l'état d'équilibre de la pièce reste ; la préférence
 * survit au rechargement de la page (même poste).
 */
interface Journal { id: string; code: string; type: string }

test('SYCEBNL · les totaux se masquent, l’équilibre reste, le choix est retenu par le poste', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Totaux e2e', montant: 2_000 });
  await seConnecter(page, dossier.email);
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];

  const ouvrir = async () => {
    await page.goto('/#/saisie');
    await page.getByRole('button', { name: od.code, exact: true }).first().click();
    await page.getByLabel('Saisie par pièce').check();
    await page.getByRole('button', { name: 'Ouvrir le journal' }).click();
    await expect(page.getByText('Pièce en cours de saisie')).toBeVisible();
  };

  await ouvrir();
  await expect(page.getByText('Totaux journal')).toBeVisible();
  await expect(page.getByText('Totaux pièce')).toBeVisible();
  await page.getByLabel('Masquer les totaux').check();
  await expect(page.getByText('Totaux journal')).toHaveCount(0);
  await expect(page.getByText('Totaux pièce')).toHaveCount(0);
  // L'équilibre de la pièce ne se masque jamais.
  await expect(page.getByText('Pièce vide')).toBeVisible();

  await page.reload();
  await ouvrir();
  await expect(page.getByLabel('Masquer les totaux')).toBeChecked();
  await expect(page.getByText('Totaux journal')).toHaveCount(0);
  await page.getByLabel('Masquer les totaux').uncheck();
  await expect(page.getByText('Totaux journal')).toBeVisible();

  expect(pannes).toEqual([]);
});
