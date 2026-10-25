import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L4, N° 73 · le transfert d'un bien entre deux dossiers du groupe,
 * sur le serveur réel. Le job des tests navigateur n'a pas d'opérateur de la
 * console · aucun plafond de cellules ne s'y pose, et le parcours complet
 * (siège, cellule, transfert à travers une clôture) est rejoué sur vraie base
 * par l'API du serveur compilé (fiche d'avancement de la ligne). Ce qui
 * casserait en silence ici · la fenêtre Groupe qui plante sur le nouvel
 * onglet, le refus du serveur qui ne s'affiche pas, et l'onglet servi à une
 * association, que le serveur refuse (fiche du compte 58 du SYCEBNL).
 */
test('SYSCOHADA · l’onglet des transferts se lit et dit le refus d’un dossier sans cellule', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Transfert groupe e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  await page.goto('/#/groupe');
  await page.getByRole('button', { name: 'Transferts de biens' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'aucune cellule' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Transférer un bien' })).toHaveCount(0);
  expect(pannes).toEqual([]);
});

test('SYCEBNL · aucun onglet des transferts, et la route est refusée au serveur', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Transfert groupe asbl e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  await page.goto('/#/groupe');
  await expect(page.getByRole('button', { name: 'Supervision' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Transferts de biens' })).toHaveCount(0);
  await expect(appelApi(page, 'GET', '/immobilisations/transferts-groupe/contexte')).rejects.toThrow(/403|SYSCOHADA|référentiel/i);
  expect(pannes).toEqual([]);
});
