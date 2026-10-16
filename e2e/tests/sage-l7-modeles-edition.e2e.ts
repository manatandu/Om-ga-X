import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LES MODÈLES D'ÉDITION ET LES SAUTS (ligne sage-l7, fonction 59 · décision
 * L7-1). Une édition de TRAVAIL (le plan comptable) se personnalise · les
 * colonnes facultatives se taisent, celles qui identifient la ligne restent,
 * et chaque classe s'imprime sur sa page, l'en-tête des colonnes repris. Le
 * modèle est gardé au dossier.
 */

test('SYSCOHADA · le plan comptable s’imprime sous un modèle du dossier, une classe par page', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Modèles e2e', montant: 1_500 });
  await seConnecter(page, dossier.email);

  await page.goto('/#/comptes');
  await expect(page.getByRole('combobox', { name: "Modèle d'édition" })).toHaveValue('');
  await page.getByRole('button', { name: "Personnaliser l'édition…" }).click();
  const boite = page.getByRole('dialog', { name: "Personnaliser l'édition" });
  await boite.getByLabel('Nom du modèle').fill('Liste courte');
  // Les colonnes qui identifient la ligne ne se décochent pas.
  await expect(boite.getByLabel('N° de compte')).toBeDisabled();
  await expect(boite.getByLabel('Intitulé')).toBeDisabled();
  for (const c of ['Type', 'Nature', 'Report à-nouveau', 'Lettrable']) await boite.getByLabel(c).uncheck();
  await boite.getByLabel('Une nouvelle page').check();
  await boite.getByRole('button', { name: 'Enregistrer le modèle' }).click();
  await expect(boite).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: "Modèle d'édition" }).locator('option:checked')).toHaveText('Liste courte');

  // Sous le média d'impression · trois colonnes, une table par classe, la
  // suivante sur une nouvelle page, et le périmètre qui nomme le modèle.
  await page.emulateMedia({ media: 'print' });
  const edition = page.locator('.edition-structure').first();
  await expect(edition).toBeVisible();
  await expect(edition).toContainText('modèle « Liste courte »');
  await expect(edition.locator('table').first().locator('th')).toHaveText(['N° de compte', 'Intitulé', 'État']);
  const tables = await edition.locator('table').count();
  expect(tables).toBeGreaterThan(5);
  await expect(edition.locator('table').nth(1)).toHaveClass(/edition-saut-page/);
  await expect(edition.locator('table').first()).not.toHaveClass(/edition-saut-page/);
  await expect(edition.locator('table').first().locator('tr.edition-titre-groupe')).toHaveText('Classe 1');
  await page.emulateMedia({ media: 'screen' });

  const lus = await appelApi<{ modeles: { nom: string; colonnes: string[]; saut: string }[] }>(page, 'GET', '/modeles-edition?edition=PLAN_COMPTABLE');
  expect(lus.modeles.map((m) => [m.nom, m.colonnes, m.saut])).toEqual([['Liste courte', ['etat'], 'PAGE']]);

  // Le plan analytique porte désormais son édition, sous les mêmes règles ·
  // la fenêtre du plan comptable fermée d'abord, ses commandes portant les
  // mêmes noms.
  await page.getByRole('button', { name: 'Fermer Plan comptable' }).click();
  // La fermeture joue son mouvement de sortie avant de retirer la fenêtre
  // (`lib/fermeture-fenetre.ts`) · on attend que son bouton de la barre des
  // fenêtres soit parti, sans quoi la navigation qui suit trouvait encore ses
  // commandes à côté de celles du plan analytique.
  await expect(page.getByRole('button', { name: 'Fermer Plan comptable' })).toHaveCount(0);
  await page.goto('/#/plans-analytiques');
  await expect(page.getByRole('combobox', { name: "Modèle d'édition" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imprimer la liste' })).toBeVisible();

  expect(pannes).toEqual([]);
});
