import { expect, test } from '@playwright/test';
import { MOT_DE_PASSE, appelApi, creerDossier, surveiller } from './outils';

/**
 * L'ÉCRAN DES LOGICIELS (2026-10-25, gel levé par Manasse pour cette ligne) ·
 * après la connexion, l'utilisateur choisit le logiciel qui le concerne, et sa
 * barre de menus se restreint à ses commandes. L'administrateur attribue les
 * logiciels de chaque collaborateur ; null = tous.
 *
 * Sur le serveur réel et une vraie base · les suites unitaires tournent sur
 * des Prisma factices, et seule une vraie session prouve que /auth/me rend
 * l'attribution relue à chaque appel (donc sans fermer de session).
 *
 * C'EST UN AFFICHAGE : la dernière assertion vérifie qu'une fenêtre hors du
 * logiciel choisi s'ouvre encore par son adresse (masquer n'est pas refuser ;
 * le refus par le serveur est le niveau 3, au suivi).
 */
test('l’écran des logiciels : choix, rappel, attribution par l’administrateur', async ({ page, browser }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Logiciels e2e SARL', montant: 1_000 });

  // --- L'administrateur : toutes les tuiles que le dossier sert, écran à la connexion.
  await page.goto('/');
  await page.fill('input[type=email]', dossier.email);
  await page.fill('input[type=password]', MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
  const ecran = page.getByRole('region', { name: 'Choix du logiciel' });
  await expect(ecran).toBeVisible();
  for (const nom of ['Comptabilité', 'Tiers et trésorerie', 'Immobilisations', 'Révision et audit', 'Administration']) {
    await expect(ecran.getByRole('button', { name: nom, exact: true })).toBeVisible();
  }

  // Choisir « Tiers et trésorerie » restreint la barre de menus.
  await ecran.getByRole('button', { name: 'Tiers et trésorerie', exact: true }).click();
  await expect(ecran).toHaveCount(0);
  await page.getByRole('button', { name: 'Structure', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Plan comptable' })).toHaveCount(0);
  // La commande s'ouvre PAR LA BARRE restreinte, pas seulement par l'adresse.
  await page.getByRole('menuitem', { name: 'Plan des tiers' }).click();
  const croix = page.locator('button[aria-label^="Fermer "]');
  await expect(croix).toHaveCount(1);
  await expect(page).toHaveURL(/#\/tiers/);

  // Masquer n'est pas refuser : la fenêtre hors du logiciel s'ouvre encore par son adresse.
  await page.goto('/#/comptes');
  await expect(croix).toHaveCount(2);

  // Échap sous l'écran rappelé : il revient au logiciel en cours et ne ferme
  // AUCUNE des fenêtres cachées dessous.
  await page.getByRole('button', { name: 'Logiciels', exact: true }).click();
  await expect(ecran).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ecran).toHaveCount(0);
  await expect(croix).toHaveCount(2);
  await page.getByRole('button', { name: 'Structure', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Plan des tiers' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Le bouton « Logiciels » rappelle l'écran, sans fermer la fenêtre ouverte.
  await page.getByRole('button', { name: 'Logiciels', exact: true }).click();
  await expect(ecran).toBeVisible();
  await ecran.getByRole('button', { name: 'Comptabilité', exact: true }).click();
  await page.getByRole('button', { name: 'Structure', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Plan comptable' })).toBeVisible();
  await page.keyboard.press('Escape');

  // --- Un administrateur n'est jamais restreint.
  const moi = (await appelApi<Array<{ id: string; email: string }>>(page, 'GET', '/utilisateurs')).find((u) => u.email === dossier.email)!;
  const refusAdmin = await appelApi(page, 'PUT', `/utilisateurs/${moi.id}/logiciels`, { restreindre: true, logiciels: ['COMPTABILITE'] }).then(
    () => 'accepté',
    (e: Error) => e.message,
  );
  expect(refusAdmin).toContain('400');

  // --- Un collaborateur : l'administrateur lui attribue deux logiciels, puis un seul.
  const collaborateur = `e2e-logiciels-${Date.now()}@exemple.cd`;
  const sonMotDePasse = `${MOT_DE_PASSE}-l2`;
  const cree = await appelApi<{ id: string }>(page, 'POST', '/utilisateurs', { email: collaborateur, motDePasse: MOT_DE_PASSE, role: 'COMPTABLE' });
  const autre = await (await browser.newContext()).newPage();
  const entetes = { 'X-Forwarded-For': `10.252.${Date.now() % 250}.5` };
  await autre.goto('/');
  await appelApi(autre, 'POST', '/auth/login', { email: collaborateur, motDePasse: MOT_DE_PASSE }, entetes);
  await appelApi(autre, 'POST', '/auth/changer-mot-de-passe', { motDePasseActuel: MOT_DE_PASSE, nouveauMotDePasse: sonMotDePasse }, entetes);
  await autre.waitForTimeout(1_100);
  await appelApi(autre, 'POST', '/auth/login', { email: collaborateur, motDePasse: sonMotDePasse }, entetes);

  // Sans attribution (null = toutes), le collaborateur a l'écran complet.
  await autre.goto('/');
  const ecranAutre = autre.getByRole('region', { name: 'Choix du logiciel' });
  await expect(ecranAutre.getByRole('button', { name: 'Comptabilité', exact: true })).toBeVisible();

  await appelApi(page, 'PUT', `/utilisateurs/${cree.id}/logiciels`, { restreindre: true, logiciels: ['TIERS_TRESORERIE', 'IMMOBILISATIONS'] });
  // Aucune session fermée : l'attribution se lit à la prochaine ouverture, sans nouvelle connexion.
  await autre.reload();
  await expect(ecranAutre.getByRole('button', { name: 'Tiers et trésorerie', exact: true })).toBeVisible();
  await expect(ecranAutre.getByRole('button', { name: 'Immobilisations', exact: true })).toBeVisible();
  await expect(ecranAutre.getByRole('button', { name: 'Comptabilité', exact: true })).toHaveCount(0);
  await expect(ecranAutre.getByRole('button', { name: 'Administration', exact: true })).toHaveCount(0);

  // Un seul logiciel : on y entre directement, sans écran.
  await appelApi(page, 'PUT', `/utilisateurs/${cree.id}/logiciels`, { restreindre: true, logiciels: ['IMMOBILISATIONS'] });
  await autre.reload();
  await expect(autre.getByRole('button', { name: 'Structure', exact: true })).toBeVisible();
  await expect(ecranAutre).toHaveCount(0);
  await expect(autre.getByRole('button', { name: 'Logiciels', exact: true })).toHaveCount(0);
  await autre.getByRole('button', { name: 'Structure', exact: true }).click();
  await expect(autre.getByRole('menuitem', { name: 'Immobilisations' })).toBeVisible();
  await expect(autre.getByRole('menuitem', { name: 'Plan comptable' })).toHaveCount(0);

  // Lever la restriction rend toutes les tuiles.
  await appelApi(page, 'PUT', `/utilisateurs/${cree.id}/logiciels`, { restreindre: false, logiciels: [] });
  await autre.reload();
  await expect(ecranAutre.getByRole('button', { name: 'Comptabilité', exact: true })).toBeVisible();

  await autre.context().close();
  expect(pannes).toEqual([]);
});
