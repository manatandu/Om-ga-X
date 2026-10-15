import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LES LIEUX DE LIVRAISON D'UN CLIENT (ligne sage-l2, fonction 31). Sur la
 * fiche d'un client, le premier lieu est principal d'office, un second le
 * devient sur demande et retire la marque au premier, un intitulé déjà pris
 * est refusé, un lieu mis en sommeil perd la marque ; un fournisseur n'a pas
 * le volet, et le serveur le refuse.
 */
interface Lieu { id: string; intitule: string; estPrincipal: boolean; estActif: boolean }

test('SYSCOHADA · lieux de livraison d’un client, un seul principal', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Livraison e2e SARL', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const client = await appelApi<{ id: string }>(page, 'POST', '/tiers', { type: 'CLIENT', code: 'CLI-LIV', nom: 'Client livré' });
  const fournisseur = await appelApi<{ id: string }>(page, 'POST', '/tiers', { type: 'FOURNISSEUR', code: 'FRS-LIV', nom: 'Fournisseur livré' });
  const lieux = async () => (await appelApi<{ lieux: Lieu[] }>(page, 'GET', `/tiers/${client.id}/lieux-livraison`)).lieux;

  await page.goto('/#/tiers');
  await page.getByRole('button', { name: /CLI-LIV/ }).click();
  await expect(page.getByText('Aucun lieu de livraison.')).toBeVisible();

  const ajouter = async (intitule: string, ville: string) => {
    await page.getByRole('button', { name: 'Ajouter un lieu' }).click();
    await page.getByLabel('Intitulé du lieu').fill(intitule);
    await page.getByLabel('Ville du lieu').fill(ville);
    await page.getByRole('button', { name: 'Enregistrer le lieu' }).click();
  };
  await ajouter('Siège', 'Kinshasa');
  await expect.poll(async () => (await lieux()).map((l) => [l.intitule, l.estPrincipal])).toEqual([['Siège', true]]);
  await ajouter('Entrepôt Limete', 'Kinshasa');
  await expect.poll(async () => (await lieux()).map((l) => [l.intitule, l.estPrincipal])).toEqual([
    ['Siège', true],
    ['Entrepôt Limete', false],
  ]);

  // Un intitulé déjà pris, sans égard à la casse · refusé, le motif dit.
  await ajouter('ENTREPÔT LIMETE', 'Goma');
  await expect(page.getByRole('alert').filter({ hasText: /déjà un lieu « Entrepôt Limete »/ })).toBeVisible();
  await page.getByRole('button', { name: 'Annuler' }).click();

  // Rendre principal le second retire la marque au premier.
  await page.getByRole('button', { name: 'Rendre principal le lieu Entrepôt Limete' }).click();
  await expect.poll(async () => (await lieux()).filter((l) => l.estPrincipal).map((l) => l.intitule)).toEqual(['Entrepôt Limete']);

  // Mis en sommeil, il perd la marque · le client reste sans principal.
  await page.getByRole('button', { name: 'Mettre en sommeil le lieu Entrepôt Limete' }).click();
  await expect.poll(async () => (await lieux()).find((l) => l.intitule === 'Entrepôt Limete')).toEqual(
    expect.objectContaining({ estActif: false, estPrincipal: false }),
  );

  // Un fournisseur n'a pas le volet, et le serveur refuse.
  await page.getByRole('button', { name: /FRS-LIV/ }).click();
  await expect(page.getByText('Lieux de livraison')).toHaveCount(0);
  const refus = await appelApi(page, 'POST', `/tiers/${fournisseur.id}/lieux-livraison`, { intitule: 'Dépôt' }).then(
    () => 'accepté',
    (e: unknown) => String(e),
  );
  expect(refus).toMatch(/se rattache à un client/);
  expect(pannes).toEqual([]);
});
