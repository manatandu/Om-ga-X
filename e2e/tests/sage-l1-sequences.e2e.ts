import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LES SÉQUENCES DE SAISIE (ligne sage-l1, fonction 19). Une séquence se crée
 * dans Structure > Paramètres de saisie, un modèle s'y range, et la barre
 * « Appeler un modèle » de la saisie ne propose que les modèles de la
 * séquence choisie.
 */
interface Compte { id: string; numero: string }
interface Journal { id: string; code: string; type: string }
interface Sequence { id: string; numero: number; intitule: string }

test('SYSCOHADA · une séquence range un modèle, et la saisie propose les modèles par séquence', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Séquences e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);

  await page.goto('/#/sequences-saisie');
  await expect(page.getByText('Aucune séquence.')).toBeVisible();
  await page.getByLabel('Intitulé de la nouvelle séquence').fill('Achats du mois');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByLabel('Intitulé de la séquence 1')).toHaveValue('Achats du mois');
  const [sequence] = await appelApi<Sequence[]>(page, 'GET', '/sequences-saisie');

  const plan = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const banque = plan.find((c) => c.numero.startsWith('521'))!;
  const charge = plan.find((c) => c.numero.startsWith('605'))!;
  for (const c of [banque, charge]) await appelApi(page, 'PATCH', `/comptes/${c.id}`, { estRetenu: true });
  const lignes = [
    { compteId: charge.id, sens: 'DEBIT' },
    { compteId: banque.id, sens: 'CREDIT' },
  ];
  await appelApi(page, 'POST', '/modeles-saisie', { intitule: 'Achat comptant', sequenceSaisieId: sequence.id, lignes });
  await appelApi(page, 'POST', '/modeles-saisie', { intitule: 'Écriture libre', lignes });

  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
  await page.goto('/#/saisie');
  await page.getByRole('button', { name: od.code, exact: true }).first().click();
  await page.getByLabel('Saisie par pièce').check();
  await page.getByRole('button', { name: 'Ouvrir le journal' }).click();
  await expect(page.getByText('Pièce en cours de saisie')).toBeVisible();

  const modeles = page.locator('select', { has: page.locator('option', { hasText: 'Modèle de saisie…' }) });
  await expect(modeles.locator('option')).toHaveText(['Modèle de saisie…', 'Achat comptant · tous journaux', 'Écriture libre · tous journaux']);
  await page.getByLabel('Séquence de saisie').selectOption({ label: '1 · Achats du mois' });
  await expect(modeles.locator('option')).toHaveText(['Modèle de saisie…', 'Achat comptant · tous journaux']);
  await page.getByLabel('Séquence de saisie').selectOption({ label: 'Sans séquence' });
  await expect(modeles.locator('option')).toHaveText(['Modèle de saisie…', 'Écriture libre · tous journaux']);

  // Une séquence qui range un modèle ne se retire pas · le refus le dit.
  await page.goto('/#/sequences-saisie');
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByText('La séquence « Achats du mois » range 1 modèle(s) de saisie')).toBeVisible();

  expect(pannes).toEqual([]);
});
