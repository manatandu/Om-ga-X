import { expect, test } from '@playwright/test';
import { API } from './outils';

/**
 * LA DEMANDE D'INFORMATION DE LA PAGE PUBLIQUE (ligne commercial-site) · le
 * formulaire part en JSON à la route publique du serveur réel, à travers le
 * relais /api. Le job n'a AUCUNE messagerie · le serveur répond 503, et la
 * page DOIT le dire, sans rien annoncer d'enregistré. Le parcours réussi
 * (message en file, courriel à l'opérateur) est prouvé par
 * `scripts/rejouer-commercial-site.cjs`, avec une boîte SMTP de poche.
 */
test('la page publique envoie la demande et dit le refus du serveur sans messagerie', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `10.249.${Date.now() % 250}.9` });
  await page.goto('/vitrine/#demande');
  const envoyer = page.getByRole('button', { name: 'Envoyer la demande' });
  await expect(envoyer).toBeVisible();

  // Sans la case cochée, rien ne part.
  let postes = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().startsWith(`${API}/demandes/information`)) postes += 1;
  });
  await page.getByLabel('Nom', { exact: true }).fill('Ruth Kabeya');
  await page.getByLabel('Organisation').fill('ASBL Lumière e2e');
  await page.getByLabel('Adresse électronique').fill('ruth@exemple.cd');
  await page.getByLabel('Message').fill('Nous voulons tenir notre comptabilité avec OmegaX.');
  await envoyer.click();
  await expect(page.locator('#demande-etat')).toContainText('Cochez la case');
  expect(postes).toBe(0);

  await page.getByLabel("J'accepte que ces informations servent à répondre à ma demande.").check();
  const reponse = page.waitForResponse((r) => r.url().startsWith(`${API}/demandes/information`));
  await envoyer.click();
  expect((await reponse).status()).toBe(503);
  await expect(page.locator('#demande-etat')).toContainText("aucune messagerie n'est configurée");
  await expect(page.locator('#demande-etat')).not.toContainText('enregistrée pour');
  await expect(envoyer).toBeEnabled();
  expect(erreurs).toEqual([]);
});
