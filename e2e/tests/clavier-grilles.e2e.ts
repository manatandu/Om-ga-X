import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LOT 3 DU DESIGN · le clavier dans les grilles et dans les modales, au
 * navigateur (Chromium ; WebKit si PW_WEBKIT). Les unitaires n'ont pas de DOM :
 * ici le focus bouge pour de bon.
 */
const MONTANT = 150_000;

test('balance · tableau nommé, en-têtes triables, grand livre ouvert à Entrée comme au double-clic', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Clavier e2e balance', montant: MONTANT });
  await seConnecter(page, dossier.email);

  await page.goto('/#/journal?onglet=balance');
  const balance = page.getByRole('table', { name: 'Balance des comptes' });
  await expect(balance).toBeVisible();
  await expect(balance.getByRole('columnheader').first()).toBeVisible();

  // En-tête figé : le groupe d'en-têtes est collant, et le pied aussi.
  const collant = await balance.locator('.entete-fixe').first().evaluate((el) => getComputedStyle(el).position);
  expect(collant).toBe('sticky');
  const piedCollant = await balance.locator('.pied-fixe').first().evaluate((el) => getComputedStyle(el).position);
  expect(piedCollant).toBe('sticky');

  // Tri par clic : aria-sort passe de none à ascending puis descending, puis revient.
  const intitule = balance.getByRole('columnheader', { name: /Intitulé du compte/ });
  await expect(intitule).toHaveAttribute('aria-sort', 'none');
  await intitule.getByRole('button').click();
  await expect(intitule).toHaveAttribute('aria-sort', 'ascending');
  await intitule.getByRole('button').click();
  await expect(intitule).toHaveAttribute('aria-sort', 'descending');
  await intitule.getByRole('button').click();
  await expect(intitule).toHaveAttribute('aria-sort', 'none');

  // Filtre : un texte absent vide la liste mais pas les totaux.
  await page.getByLabel('Filtrer la balance par numéro ou intitulé de compte').fill('zzzz-introuvable');
  await expect(page.getByText('Aucun compte ne correspond au filtre.')).toBeVisible();
  await expect(balance.getByText(/Totaux généraux \(balance entière\)/)).toBeVisible();
  await page.getByLabel('Filtrer la balance par numéro ou intitulé de compte').fill('');

  // Au clavier : la ligne du compte est atteignable, Entrée ouvre son grand livre.
  const ligne = balance.locator('[role=row][tabindex="0"]').first();
  await ligne.focus();
  await expect(ligne).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('table', { name: /^Grand livre du compte/ }).first()).toBeVisible();

  // Le double-clic reste.
  await page.getByRole('button', { name: 'Balance', exact: true }).click();
  await expect(balance).toBeVisible();
  await balance.locator('[role=row][tabindex="0"]').first().dblclick();
  await expect(page.getByRole('table', { name: /^Grand livre du compte/ }).first()).toBeVisible();

  expect(pannes).toEqual([]);
});


test('modale · le focus boucle dans la boîte et revient au déclencheur à la fermeture', async ({ page }) => {
  test.setTimeout(90_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Clavier e2e modale', montant: MONTANT });
  await seConnecter(page, dossier.email);

  await page.goto('/#/journal?onglet=journal');
  const declencheur = page.getByTitle('Fiche d\'imputation').first();
  await declencheur.focus();
  await declencheur.press('Enter');
  const boite = page.getByRole('dialog').first();
  await expect(boite).toBeVisible();
  await expect(boite).toHaveAttribute('aria-modal', 'true');
  expect(await boite.getAttribute('aria-labelledby') ?? await boite.getAttribute('aria-label')).toBeTruthy();

  const dedans = () => page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
  // Tab 12 fois puis Maj+Tab 12 fois : le focus ne sort jamais de la boîte.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dedans(), `Tab n°${i + 1}`).toBe(true);
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await dedans(), `Maj+Tab n°${i + 1}`).toBe(true);
  }

  // Échap ferme (inchangé) et le focus revient au bouton qui a ouvert la boîte.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(declencheur).toBeFocused();

  expect(pannes).toEqual([]);
});

test('aide « ? » · reliée à sa bulle, Échap la ferme et rend le focus', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Clavier e2e aide', montant: MONTANT });
  await seConnecter(page, dossier.email);

  await page.goto('/#/journal?onglet=balance');
  const aide = page.getByRole('button', { name: /^Aide : Balance regroupée par collectif/ });
  await aide.focus();
  const bulle = page.getByRole('region', { name: /Balance regroupée par collectif/ });
  await expect(bulle).toBeVisible();
  const id = await bulle.getAttribute('id');
  expect(id).toBeTruthy();
  await expect(aide).toHaveAttribute('aria-describedby', id!);

  // Flèche bas : le clavier va dans la bulle ; Échap la ferme et rend le « ? ».
  await page.keyboard.press('ArrowDown');
  await expect(bulle).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: /Balance regroupée par collectif/ })).toHaveCount(0);
  await expect(aide).toBeFocused();

  expect(pannes).toEqual([]);
});

test('plan comptable · une seule ligne dans la tabulation, flèches, Début et Fin, six cellules par ligne', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Clavier e2e plan', montant: MONTANT });
  await seConnecter(page, dossier.email);
  await page.goto('/#/comptes');
  const grille = page.getByRole('grid', { name: 'Plan comptable' });
  await expect(grille).toBeVisible();
  const lignes = grille.locator('[role=row][data-compte-id]');
  await expect(lignes.first()).toBeVisible();
  expect(await lignes.count()).toBeGreaterThan(10);
  // Une seule ligne à tabIndex 0, toutes les autres à -1.
  expect(await grille.locator('[role=row][data-compte-id][tabindex="0"]').count()).toBe(1);
  expect(await grille.locator('[role=row][data-compte-id][tabindex="-1"]').count()).toBe((await lignes.count()) - 1);
  // Six cellules par ligne (la sixième, « Personnalisé », comprise), et le colcount le dit.
  await expect(grille).toHaveAttribute('aria-colcount', '6');
  for (const i of [0, 1, 5]) expect(await lignes.nth(i).locator('[role=gridcell]').count()).toBe(6);

  await lignes.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(lignes.nth(1)).toBeFocused();
  await expect(lignes.nth(1)).toHaveAttribute('tabindex', '0');
  await expect(lignes.first()).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('ArrowDown');
  await expect(lignes.nth(2)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(lignes.nth(1)).toBeFocused();
  await page.keyboard.press('End');
  await expect(lignes.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(lignes.first()).toBeFocused();
  // Entrée choisit le compte.
  await page.keyboard.press('Enter');
  await expect(lignes.first()).toHaveAttribute('aria-selected', 'true');
  // Tab sort de la grille d'un seul pas (pas des centaines d'arrêts).
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role=row][data-compte-id]'))).toBe(false);

  expect(pannes).toEqual([]);
});

test('fenêtre flottante plus basse que l’écran · un seul défilement, le pied de totaux reste visible', async ({ page }) => {
  test.setTimeout(120_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Clavier e2e defilement', montant: MONTANT });
  await seConnecter(page, dossier.email);
  const comptes = await appelApi<{ id: string; numero: string; typeCompte: string }[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const journaux = await appelApi<{ id: string; type: string }[]>(page, 'GET', '/journaux');
  const banque = comptes.find((c) => c.numero.startsWith('52'))!;
  const produit = comptes.find((c) => c.numero.startsWith('7'))!;
  const journal = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
  for (let i = 0; i < 40; i++) {
    await appelApi(page, 'POST', '/ecritures', {
      exerciceId: dossier.exerciceId, journalId: journal.id, date: '2026-07-02', libelle: `Ligne ${i}`,
      lignes: [{ compteId: banque.id, libelle: `Ligne ${i}`, debit: 1000 + i, credit: 0 }, { compteId: produit.id, libelle: `Ligne ${i}`, debit: 0, credit: 1000 + i }],
    });
  }
  await page.goto('/#/journal?onglet=journal');
  await expect(page.getByText('Ligne 39').first()).toBeVisible();
  // Fenêtre flottante : « Restaurer » la sort de l'agrandissement (940 x 560 sur 900 de haut).
  await page.getByRole('button', { name: 'Restaurer' }).first().click();
  const table = page.getByRole('table', { name: 'Journal des écritures' });
  await expect(table).toBeVisible();

  const mesure = await page.evaluate(() => {
    const t = document.querySelector('[role=table][aria-label="Journal des écritures"]') as HTMLElement;
    let contenu: HTMLElement | null = t.parentElement;
    while (contenu && !(getComputedStyle(contenu).overflowY === 'auto' && contenu.className.includes('overflow-auto'))) contenu = contenu.parentElement;
    const pied = t.querySelector('.pied-fixe') as HTMLElement;
    const r = (e: HTMLElement) => e.getBoundingClientRect();
    return {
      fenetreDefile: !!contenu && contenu.scrollHeight > contenu.clientHeight + 1,
      grilleDefile: t.scrollHeight > t.clientHeight + 1,
      piedBas: r(pied).bottom,
      contenuBas: contenu ? r(contenu).bottom : 0,
      ecran: window.innerHeight,
    };
  });
  expect(mesure.grilleDefile).toBe(true);
  expect(mesure.fenetreDefile).toBe(false);
  expect(mesure.piedBas).toBeLessThanOrEqual(mesure.contenuBas + 1);
  expect(mesure.piedBas).toBeLessThanOrEqual(mesure.ecran);

  expect(pannes).toEqual([]);
});
