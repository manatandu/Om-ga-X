import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LE MODE ASSISTANT DE CRÉATION (ligne sage-l1, fonction 18). Un compte et un
 * code journal se créent étape par étape, et « Créer et continuer » garde la
 * boîte ouverte pour le suivant · la même route et le même corps que le
 * formulaire, le serveur juge comme avant.
 */
interface Compte { id: string; numero: string }
interface Journal { id: string; code: string; intitule: string; type: string }

test('SYSCOHADA · un compte puis deux journaux par l’assistant, en création enchaînée', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Assistant e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);

  const plan = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const duPlan = plan.find((c) => c.numero.startsWith('605') && /0000$/.test(c.numero))!;
  const racine = (duPlan.numero.replace(/0+$/, '') + '00000000').slice(0, 7);

  // Le compte · trois étapes, puis « Créer et continuer ».
  await page.goto('/#/comptes');
  await page.getByRole('button', { name: 'Nouveau compte' }).click();
  const boite = page.getByRole('form', { name: 'Nouveau compte général' });
  await boite.getByLabel('Mode assistant').check();
  await expect(boite.getByText('Étape 1 sur 3')).toBeVisible();
  await boite.getByLabel('Numéro :').fill(`${racine}7`);
  await boite.getByLabel('Intitulé :').fill('Fournitures de l’atelier');
  await boite.getByRole('button', { name: 'Suivant' }).click();
  await expect(boite.getByText('Étape 2 sur 3')).toBeVisible();
  await boite.getByRole('button', { name: 'Suivant' }).click();
  await expect(boite.getByText(`${racine}7`)).toBeVisible();
  await boite.getByRole('button', { name: 'Créer et continuer' }).click();
  await expect(boite.getByText(`Compte ${racine}7 Fournitures de l’atelier créé.`)).toBeVisible();
  // La boîte est revenue à la première étape, vide.
  await expect(boite.getByText('Étape 1 sur 3')).toBeVisible();
  await expect(boite.getByLabel('Numéro :')).toHaveValue('');
  await boite.getByLabel('Mode assistant').uncheck();
  await boite.getByLabel('Numéro :').fill(`${racine}8`);
  await boite.getByLabel('Intitulé :').fill('Fournitures du magasin');
  await boite.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(boite).toHaveCount(0);
  const apres = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  expect(apres.filter((c) => [`${racine}7`, `${racine}8`].includes(c.numero)).map((c) => c.numero).sort()).toEqual([
    `${racine}7`,
    `${racine}8`,
  ]);

  // Deux journaux d'opérations diverses en création enchaînée.
  await page.goto('/#/journaux');
  await page.getByRole('button', { name: 'Nouveau journal' }).click();
  const fenetre = page.locator('form', { hasText: 'Nouveau code journal' });
  await fenetre.getByLabel('Mode assistant').check();
  await expect(fenetre.getByText('Étape 1 sur 4')).toBeVisible();
  await fenetre.getByLabel('Type :').selectOption('GENERAL');
  await fenetre.getByRole('button', { name: 'Suivant' }).click();
  await fenetre.getByLabel('Code :').fill('OD2');
  await fenetre.getByLabel('Intitulé :').fill('Opérations diverses bis');
  await fenetre.getByRole('button', { name: 'Suivant' }).click();
  await fenetre.getByRole('button', { name: 'Suivant' }).click();
  await expect(fenetre.getByText('Étape 4 sur 4')).toBeVisible();
  await fenetre.getByRole('button', { name: 'Créer et continuer' }).click();
  await expect(fenetre.getByText('Journal OD2 Opérations diverses bis créé.')).toBeVisible();
  await fenetre.getByRole('button', { name: 'Suivant' }).click();
  await fenetre.getByLabel('Code :').fill('OD3');
  await fenetre.getByLabel('Intitulé :').fill('Opérations diverses ter');
  await fenetre.getByRole('button', { name: 'Suivant' }).click();
  await fenetre.getByRole('button', { name: 'Suivant' }).click();
  await fenetre.getByRole('button', { name: 'Créer le journal' }).click();
  await expect(fenetre).toHaveCount(0);
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  expect(journaux.filter((j) => ['OD2', 'OD3'].includes(j.code)).map((j) => [j.code, j.type]).sort()).toEqual([
    ['OD2', 'GENERAL'],
    ['OD3', 'GENERAL'],
  ]);

  // La préférence du poste survit à la fenêtre.
  await page.reload();
  await page.goto('/#/journaux');
  await page.getByRole('button', { name: 'Nouveau journal' }).click();
  await expect(page.locator('form', { hasText: 'Nouveau code journal' }).getByLabel('Mode assistant')).toBeChecked();

  expect(pannes).toEqual([]);
});
