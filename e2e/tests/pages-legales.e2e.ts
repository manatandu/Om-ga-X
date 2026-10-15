import { expect, test } from '@playwright/test';
import { API, appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LES PAGES LÉGALES ET L'AIDE (ligne pages-legales, 2026-10-15).
 *
 * Sans session · les trois pages s'ouvrent depuis l'écran d'ouverture, et
 * aucune ne touche une route qui exige une session (une page publique qui
 * tomberait en 401 ne s'afficherait pas chez un visiteur).
 *
 * Avec session · le menu « ? » les ouvre en fenêtre ; la fenêtre du contrat
 * dit l'état de l'acceptation du dossier, que le serveur tient FERMÉE tant
 * que l'offre ne dit pas ce que la loi exige (Code du numérique, art. 54,
 * al. 2) · et « À propos » dit la mise en production et la langue, sans rien
 * inventer d'une construction qui n'a pas été publiée.
 */

test('sans session, les trois pages s’ouvrent depuis l’écran d’ouverture', async ({ page }) => {
  const pannes = surveiller(page);
  // Au démarrage, `/auth/me` et le préchargement de `/exercices` partent
  // ensemble et reçoivent un 401 sans session, à dessein (lib/prechargement.ts).
  // Tout autre refus viendrait d'une page publique qui lit une route privée.
  const DEMARRAGE = new Set(['/auth/me', '/exercices']);
  const refusees: string[] = [];
  page.on('response', (r) => {
    const chemin = r.url().slice(API.length);
    if (r.url().startsWith(API) && r.status() === 401 && !DEMARRAGE.has(chemin)) refusees.push(chemin);
  });
  await page.goto('/#/connexion');

  await page.getByRole('link', { name: 'Questions fréquentes' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Questions fréquentes sur OmegaX' })).toBeVisible();
  await page.getByRole('searchbox').fill('verrou');
  await expect(page.getByText('Ma connexion est refusée après plusieurs essais.')).toBeVisible();
  await expect(page.getByText('Après cinq essais manqués', { exact: false })).toBeVisible();

  await page.getByRole('link', { name: 'Contrat de licence' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Contrat de licence d’OmegaX' })).toBeVisible();
  await expect(page.getByText(/^Version \d+ du .+ · langue du contrat · français$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '4. Droits de VMG Consulting sur OmegaX' })).toBeVisible();
  await expect(page.getByText('(à arrêter par VMG Consulting)').first()).toBeVisible();
  // La page publique ne porte pas l'acceptation · elle n'a pas de dossier.
  await expect(page.getByText('Acceptation par ce dossier')).toHaveCount(0);

  await page.getByRole('link', { name: 'Politique de confidentialité' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité d’OmegaX' })).toBeVisible();
  await expect(page.getByText('VMG Consulting ne consulte pas le contenu de vos dossiers.')).toBeVisible();

  await page.getByRole('link', { name: 'Retour à l’ouverture du fichier comptable' }).click();
  await expect(page.getByRole('button', { name: 'Ouvrir le dossier' })).toBeVisible();

  expect(refusees, 'routes qui exigent une session').toEqual([]);
  expect(pannes, 'exceptions et réponses 5xx').toEqual([]);
});

test('avec session, le menu « ? » ouvre les pages en fenêtre, et l’acceptation se dit fermée', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Pages légales e2e', montant: 1000 });
  await seConnecter(page, dossier.email);

  // Le rappel ne s'affiche pas · l'acceptation est fermée.
  await expect(page.getByText('Les conditions de licence en vigueur n’ont pas encore été acceptées pour ce dossier.')).toHaveCount(0);

  await page.getByRole('button', { name: '?', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Contrat de licence' }).click();
  await expect(page.getByText('Acceptation par ce dossier')).toBeVisible();
  await expect(page.getByText('Aucune acceptation enregistrée pour ce dossier.')).toBeVisible();
  await expect(page.getByText(/L’acceptation en ligne s’ouvrira quand l’offre dira ce que la loi exige/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accepter les conditions' })).toHaveCount(0);
  // Le serveur refuse de même, en le disant.
  await expect(appelApi(page, 'POST', '/conditions-licence/acceptation', { version: 1, lu: true })).rejects.toThrow(/409 .*art\. 54, al\. 2/);

  await page.getByRole('button', { name: '?', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Questions fréquentes' }).click();
  await expect(page.getByText('Pourquoi un compte du plan est-il refusé à la saisie ?')).toBeVisible();

  await page.getByRole('button', { name: '?', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Politique de confidentialité' }).click();
  await expect(page.getByText('Dernière mise à jour · 15 octobre 2026')).toBeVisible();
  // Dans une fenêtre, la barre de titre porte le titre · pas de titre de page.
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité d’OmegaX' })).toHaveCount(0);

  await page.getByRole('button', { name: '?', exact: true }).click();
  await page.getByRole('menuitem', { name: 'À propos d’OmegaX' }).click();
  await expect(page.getByText('Langue de l’interface · français, seule langue disponible.')).toBeVisible();
  await expect(page.getByText(/^Mise en production/)).toBeVisible();

  expect(pannes, 'exceptions et réponses 5xx').toEqual([]);
});
