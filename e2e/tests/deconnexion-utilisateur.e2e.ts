import { expect, test } from '@playwright/test';
import { MOT_DE_PASSE, appelApi, creerDossier, seConnecter } from './outils';

/**
 * DÉCONNECTER UN UTILISATEUR (2026-10-21, gel levé par Manasse · « la 2e
 * possibilité. Fais le proprement », fonction vue chez Microfina++, p. 18).
 *
 * Sur le serveur réel et une vraie base · l'administrateur ferme, depuis la
 * fenêtre des autorisations d'accès, les sessions d'un collaborateur connecté
 * sur un autre navigateur. La session du collaborateur tombe en « session
 * perdue », celle de l'administrateur reste ouverte, et le collaborateur se
 * reconnecte avec SON mot de passe, inchangé. Les suites unitaires tournent
 * sur des Prisma factices · seule une vraie session prouve que la pose de la
 * révocation est relue par la stratégie de session.
 */
test('l’administrateur ferme les sessions d’un collaborateur, et seulement les siennes', async ({ page, browser }) => {
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Déconnexion e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);

  const collaborateur = `e2e-collab-${Date.now()}@exemple.cd`;
  await appelApi(page, 'POST', '/utilisateurs', { email: collaborateur, motDePasse: MOT_DE_PASSE, role: 'COMPTABLE' });

  // Le collaborateur, sur un autre navigateur, depuis une autre adresse.
  const autre = await (await browser.newContext()).newPage();
  const entetes = { 'X-Forwarded-For': `10.250.${Date.now() % 250}.7` };
  await autre.goto('/');
  await appelApi(autre, 'POST', '/auth/login', { email: collaborateur, motDePasse: MOT_DE_PASSE }, entetes);
  await appelApi(autre, 'GET', '/auth/me', undefined, entetes);

  // La révocation se compare à la SECONDE (jwt.strategy.ts) · un jeton signé
  // dans la seconde même du geste lui survit, comme pour toute révocation.
  await autre.waitForTimeout(1_100);

  await page.goto('/#/utilisateurs');
  const ligne = page.locator('div.grid').filter({ hasText: collaborateur });
  page.once('dialog', (d) => void d.accept());
  await ligne.getByRole('button', { name: 'Déconnecter' }).click();
  await expect(page.getByText(`Sessions de ${collaborateur} fermées.`)).toBeVisible();

  // Sa session tombe, en session perdue nommée.
  const refus = await appelApi(autre, 'GET', '/auth/me', undefined, entetes).then(
    () => null,
    (e: Error) => e.message,
  );
  expect(refus).toContain('401');
  expect(refus).toContain('perdue');

  // Celle de l'administrateur reste ouverte, et sa propre ligne n'offre pas le geste.
  await appelApi(page, 'GET', '/utilisateurs');
  const sienne = page.locator('div.grid').filter({ hasText: dossier.email });
  await expect(sienne.getByRole('button', { name: 'Déconnecter' })).toHaveCount(0);

  // Le collaborateur rentre avec son mot de passe, que le geste n'a pas touché.
  await appelApi(autre, 'POST', '/auth/login', { email: collaborateur, motDePasse: MOT_DE_PASSE }, entetes);
  await appelApi(autre, 'GET', '/auth/me', undefined, entetes);
  await autre.context().close();
});
