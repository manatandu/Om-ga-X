import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LA QUALITÉ DU TIERS (ligne sage-l2, fonction 24). Sur la fiche du tiers,
 * un libellé proposé dans une liste et libre · rangé sans blancs de bord,
 * effacé par un champ vidé, imprimé à l'édition du plan des tiers.
 */
interface Tiers { id: string; code: string; qualite: string | null }

test('SYCEBNL · la qualité se pose, se range et s’efface sur la fiche du tiers', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Qualité e2e ASBL', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const cree = await appelApi<{ id: string }>(page, 'POST', '/tiers', { type: 'FOURNISSEUR', code: 'FRS-QUAL', nom: 'Fournisseur qualité' });
  const qualite = async () => (await appelApi<Tiers[]>(page, 'GET', '/tiers')).find((t) => t.id === cree.id)?.qualite ?? null;

  await page.goto('/#/tiers');
  await page.getByRole('button', { name: /FRS-QUAL/ }).click();
  const champ = page.getByLabel('Qualité :');
  await champ.fill('  Société   anonyme ');
  await champ.blur();
  await expect.poll(qualite).toBe('Société anonyme');

  // Un champ vidé efface la qualité, jamais une chaîne vide gardée.
  await champ.fill('');
  await champ.blur();
  await expect.poll(qualite).toBeNull();
  expect(pannes).toEqual([]);
});
