import { expect, test, type Browser, type Page } from '@playwright/test';
import { MOT_DE_PASSE, creerDossier } from './outils';

/**
 * « RESTER CONNECTÉ SUR CET APPAREIL » SURVIT À LA FERMETURE DU NAVIGATEUR
 * (2026-10-09, question de Manasse · « ça ne fonctionne pas »). Aucun parcours
 * ne rouvrait le navigateur · on se connecte, on garde ce que le navigateur
 * garderait en le fermant (les cookies datés, jamais un cookie de session), on
 * rouvre, et l'espace de travail doit s'ouvrir sans mot de passe. Case
 * décochée, la même réouverture ramène à la connexion (audit final F270).
 */
async function connecter(page: Page, email: string, rester: boolean) {
  await page.goto('/');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', MOT_DE_PASSE);
  if (rester) await page.getByRole('checkbox', { name: 'Rester connecté sur cet appareil' }).check();
  await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
  await expect(page.getByRole('button', { name: 'Structure', exact: true })).toBeVisible();
}

/** Ferme le navigateur et le rouvre · seuls les cookies datés passent. */
async function rouvrir(browser: Browser, page: Page) {
  const etat = await page.context().storageState();
  await page.context().close();
  const persistants = etat.cookies.filter((c) => c.expires > 0);
  const contexte = await browser.newContext({ storageState: { cookies: persistants, origins: etat.origins } });
  return { page: await contexte.newPage(), persistants };
}

test('case cochée · la session survit à la fermeture du navigateur', async ({ page, browser }) => {
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Rester connecté e2e', montant: 1_000 });
  await page.context().clearCookies();
  await connecter(page, dossier.email, true);

  const { page: reouverte, persistants } = await rouvrir(browser, page);
  const session = persistants.find((c) => c.name === '__session');
  // Sept jours sans usage au plus (session-longue.ts) · le cookie est daté.
  expect(session?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + 6 * 86_400);
  await reouverte.goto('/');
  await expect(reouverte.getByRole('button', { name: 'Structure', exact: true })).toBeVisible();
});

test('case décochée · la fermeture du navigateur ramène à la connexion', async ({ page, browser }) => {
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Session courte e2e', montant: 1_000 });
  await page.context().clearCookies();
  await connecter(page, dossier.email, false);

  const { page: reouverte, persistants } = await rouvrir(browser, page);
  expect(persistants.find((c) => c.name === '__session')).toBeUndefined();
  await reouverte.goto('/');
  await expect(reouverte.getByRole('button', { name: 'Ouvrir le dossier' })).toBeVisible();
});
