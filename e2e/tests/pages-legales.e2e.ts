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

test('sans session, les trois pages s’ouvrent depuis l’écran d’ouverture', async ({ page: ouverture }) => {
  const pannes = surveiller(ouverture);
  // Au démarrage, `/auth/me` et le préchargement de `/exercices` partent
  // ensemble et reçoivent un 401 sans session, à dessein (lib/prechargement.ts).
  // Tout autre refus viendrait d'une page publique qui lit une route privée.
  const DEMARRAGE = new Set(['/auth/me', '/exercices']);
  const refusees: string[] = [];
  const ecouter = (p: typeof ouverture) =>
    p.on('response', (r) => {
      const chemin = r.url().slice(API.length);
      if (r.url().startsWith(API) && r.status() === 401 && !DEMARRAGE.has(chemin)) refusees.push(chemin);
    });
  ecouter(ouverture);
  await ouverture.goto('/#/connexion');

  // Les textes s'ouvrent dans un NOUVEL ONGLET depuis l'écran d'ouverture
  // (2026-10-17) · un formulaire de connexion commencé n'est pas perdu.
  const [page] = await Promise.all([
    ouverture.waitForEvent('popup'),
    ouverture.getByRole('link', { name: 'Questions fréquentes' }).click(),
  ]);
  const pannesOnglet = surveiller(page);
  ecouter(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Questions fréquentes sur OmegaX' })).toBeVisible();
  await page.getByRole('searchbox').fill('verrou');
  await expect(page.getByText('Ma connexion est refusée après plusieurs essais.')).toBeVisible();
  await expect(page.getByText('Après cinq essais manqués', { exact: false })).toBeVisible();
  // L'apostrophe DROITE du clavier trouve le texte écrit à l'apostrophe
  // typographique (second tour, M2).
  await page.getByRole('searchbox').fill('l\'essai');
  await expect(page.getByText('Combien de temps dure l’essai ?')).toBeVisible();

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
  expect(pannesOnglet, 'exceptions et réponses 5xx du nouvel onglet').toEqual([]);
});

test('avec session, le menu « ? » ouvre les pages en fenêtre, et l’acceptation se dit fermée', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Pages légales e2e', montant: 1000 });
  await seConnecter(page, dossier.email);

  await page.getByRole('button', { name: '?', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Contrat de licence' }).click();
  await expect(page.getByText('Acceptation par ce dossier')).toBeVisible();
  await expect(page.getByText('Aucune acceptation enregistrée pour ce dossier.')).toBeVisible();
  await expect(page.getByText(/L’acceptation en ligne s’ouvrira quand l’offre dira ce que la loi exige/)).toBeVisible();
  // Le rappel ne s'affiche pas · l'acceptation est fermée. Vérifié APRÈS que
  // l'état a été lu et rendu (second tour, mineur 9) · plus tôt, l'absence
  // passait avant même que le bandeau ait reçu sa réponse.
  await expect(page.getByText('Les conditions de licence en vigueur n’ont pas encore été acceptées pour ce dossier.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Accepter les conditions' })).toHaveCount(0);
  // Le serveur sert la version en vigueur avec l'empreinte de son texte, et
  // refuse de même l'acceptation du bon texte, en le disant · la fermeture de
  // l'art. 54 se juge avant l'abonnement affiché (second tour, M-a).
  const etat = await appelApi<{ version: { numero: number; empreinte: string } }>(page, 'GET', '/conditions-licence');
  expect(etat.version.empreinte).toMatch(/^[0-9a-f]{64}$/);
  const empreinteCommande = '0'.repeat(64);
  await expect(
    appelApi(page, 'POST', '/conditions-licence/acceptation', { version: etat.version.numero, empreinte: etat.version.empreinte, empreinteCommande, lu: true }),
  ).rejects.toThrow(/409 .*art\. 54, al\. 2/);
  // Sans empreinte du texte, ou de l'abonnement affiché, l'acceptation reçue
  // est mal formée (relecture M1 ; second tour, M-a).
  await expect(appelApi(page, 'POST', '/conditions-licence/acceptation', { version: etat.version.numero, empreinteCommande, lu: true })).rejects.toThrow(/400/);
  await expect(
    appelApi(page, 'POST', '/conditions-licence/acceptation', { version: etat.version.numero, empreinte: etat.version.empreinte, lu: true }),
  ).rejects.toThrow(/400/);

  await page.getByRole('button', { name: '?', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Questions fréquentes' }).click();
  await expect(page.getByText('Pourquoi un compte du plan est-il refusé à la saisie ?')).toBeVisible();

  await page.getByRole('button', { name: '?', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Politique de confidentialité' }).click();
  // La date suit la politique en vigueur · elle se lit, elle ne se recopie pas.
  await expect(page.getByText(/^Dernière mise à jour · \d{1,2} \S+ \d{4}$/)).toBeVisible();
  // Dans une fenêtre, la barre de titre porte le titre · pas de titre de page.
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité d’OmegaX' })).toHaveCount(0);
  // Le lien vers le contrat ouvre la FENÊTRE du contrat, sans quitter
  // l'espace de travail (second tour, M1) · la route publique le démontait.
  await page.getByRole('link', { name: 'contrat de licence', exact: true }).click();
  await expect(page).toHaveURL(/#\/aide\/contrat-de-licence$/);
  await expect(page.getByText('Acceptation par ce dossier')).toBeVisible();
  await expect(page.getByRole('button', { name: '?', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '?', exact: true }).click();
  await page.getByRole('menuitem', { name: 'À propos d’OmegaX' }).click();
  await expect(page.getByText('Langue de l’interface · français, seule langue disponible.')).toBeVisible();
  await expect(page.getByText(/^Mise en production/)).toBeVisible();
  // Une boîte de dialogue · le focus sur « Fermer », Échap la ferme (second tour, mineur 10).
  const apropos = page.getByRole('dialog', { name: 'À propos d\'OmegaX' });
  await expect(apropos).toBeVisible();
  await expect(apropos.getByRole('button', { name: 'Fermer', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(apropos).toHaveCount(0);

  expect(pannes, 'exceptions et réponses 5xx').toEqual([]);
});
