import { expect, test } from '@playwright/test';
import { MOT_DE_PASSE, appelApi, creerDossier, entrerDansUnLogiciel, surveiller } from './outils';

/**
 * UNE PERSONNE, PLUSIEURS DOSSIERS (ligne multi-dossiers, 2026-11-01, gel levé
 * par Manasse · « Enchaîne le point 3 et 4 »).
 *
 * Sur le serveur réel et une vraie base · l'administrateur du dossier B
 * (SYSCOHADA) rattache à SON dossier l'adresse de l'administrateur du dossier
 * A (SYCEBNL). Cette personne, à sa connexion, voit la liste de SES deux
 * dossiers avant l'écran des logiciels, entre dans B, n'y lit que B, revient
 * dans A par Fichier > Changer de dossier ; et quand l'administrateur de B
 * retire son appartenance, la session ouverte dans B tombe aussitôt et B ne
 * lui est plus ouvert.
 */
interface Me {
  tenant: { id: string; referentiel: string };
  plusieursDossiers?: boolean;
}
interface Exercice {
  id: string;
}
interface Utilisateur {
  id: string;
  email: string;
}

test('une personne dans deux dossiers de référentiels différents · elle choisit, change, ne voit jamais l’autre, et le retrait coupe l’accès', async ({
  page,
  browser,
}) => {
  const pannes = surveiller(page);
  const a = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Association multi e2e', montant: 1_111 });
  const b = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Société multi e2e', montant: 2_222 });

  // L'administrateur de B, sur son propre navigateur, rattache l'adresse de A.
  const admin = await (await browser.newContext()).newPage();
  const entetesAdmin = { 'X-Forwarded-For': `10.251.${Date.now() % 250}.9` };
  await admin.goto('/');
  await appelApi(admin, 'POST', '/auth/login', { email: b.email, motDePasse: MOT_DE_PASSE }, entetesAdmin);
  const rattache = await appelApi<Record<string, unknown>>(admin, 'POST', '/utilisateurs', { email: a.email, motDePasse: 'Choisi-par-B-2026!', role: 'COMPTABLE' }, entetesAdmin);
  expect(rattache).not.toHaveProperty('compteDeConnexionId');
  const dossierB = (await appelApi<Me>(admin, 'GET', '/auth/me', undefined, entetesAdmin)).tenant.id;

  // La personne se connecte · la liste de SES dossiers d'abord.
  await page.goto('/');
  await page.fill('input[type=email]', a.email);
  await page.fill('input[type=password]', MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
  const liste = page.getByRole('table', { name: 'Mes dossiers' });
  await expect(liste).toBeVisible();
  await expect(liste.locator('tbody tr')).toHaveCount(2);
  await expect(liste.getByText('Association multi e2e')).toBeVisible();
  await expect(liste.getByText('Société multi e2e')).toBeVisible();

  // Elle entre dans B · l'écran des logiciels de B suit.
  await liste.locator('tr[data-dossier="Société multi e2e"]').click();
  await entrerDansUnLogiciel(page);
  const meB = await appelApi<Me>(page, 'GET', '/auth/me');
  expect([meB.tenant.id, meB.tenant.referentiel, meB.plusieursDossiers]).toEqual([dossierB, 'SYSCOHADA', true]);
  // Elle ne lit que B · l'exercice lu est celui de B, jamais celui de A.
  const exercicesB = await appelApi<Exercice[]>(page, 'GET', '/exercices');
  expect(exercicesB.map((e) => e.id)).toContain(b.exerciceId);
  expect(exercicesB.map((e) => e.id)).not.toContain(a.exerciceId);
  // Un paramètre de requête ne change pas le dossier.
  const parametre = await appelApi<Exercice[]>(page, 'GET', `/exercices?dossierId=${encodeURIComponent(a.exerciceId)}`).catch(() => null);
  if (parametre) expect(parametre.map((e) => e.id)).not.toContain(a.exerciceId);

  // Fichier > Changer de dossier · retour dans A.
  await page.getByRole('button', { name: 'Fichier', exact: true }).click();
  await page.getByText('Changer de dossier…', { exact: true }).click();
  const modale = page.getByRole('dialog', { name: 'Changer de dossier' });
  await expect(modale).toBeVisible();
  await modale.locator('tr[data-dossier="Association multi e2e"]').click();
  await entrerDansUnLogiciel(page);
  const meA = await appelApi<Me>(page, 'GET', '/auth/me');
  expect(meA.tenant.referentiel).toBe('SYCEBNL');
  expect((await appelApi<Exercice[]>(page, 'GET', '/exercices')).map((e) => e.id)).toContain(a.exerciceId);

  // De nouveau dans B, puis l'administrateur de B retire l'appartenance.
  await appelApi(page, 'POST', '/auth/changer-dossier', { dossierId: dossierB });
  await appelApi(page, 'GET', '/exercices');
  // La révocation se compare à la SECONDE · voir deconnexion-utilisateur.e2e.ts.
  await page.waitForTimeout(1_100);
  const ligne = (await appelApi<Utilisateur[]>(admin, 'GET', '/utilisateurs', undefined, entetesAdmin)).find((u) => u.email === a.email);
  expect(ligne).toBeTruthy();
  await appelApi(admin, 'PATCH', `/utilisateurs/${ligne!.id}`, { estActif: false }, entetesAdmin);
  const refus = await appelApi(page, 'GET', '/exercices').then(
    () => null,
    (e: Error) => e.message,
  );
  expect(refus).toContain('401');

  // Reconnectée, elle n'a plus que A, et B ne s'ouvre plus.
  await page.waitForTimeout(1_100);
  await page.goto('/');
  await appelApi(page, 'POST', '/auth/login', { email: a.email, motDePasse: MOT_DE_PASSE });
  expect((await appelApi<Me>(page, 'GET', '/auth/me')).plusieursDossiers).toBe(false);
  const ferme = await appelApi(page, 'POST', '/auth/changer-dossier', { dossierId: dossierB }).then(
    () => null,
    (e: Error) => e.message,
  );
  expect(ferme).toContain('404');
  await admin.context().close();
  expect(pannes).toEqual([]);
});
