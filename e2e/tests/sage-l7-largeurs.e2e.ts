import { expect, test, type Page } from '@playwright/test';
import { creerDossier, seConnecter, surveiller } from './outils';

/**
 * LES FENÊTRES DE LA LIGNE SAGE-L7 À 390 ET À 1440 PX · aucune ne fait
 * défiler la page de côté, et la commande principale reste dans l'écran
 * (CLAUDE.md § 9 ter ; les tableaux défilent dans leur propre conteneur).
 */

async function sansDebordement(page: Page, largeur: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  return largeur;
}

async function dansLEcran(page: Page, nom: string, largeur: number) {
  const bouton = page.getByRole('button', { name: nom, exact: true });
  await expect(bouton).toBeVisible();
  const boite = await bouton.boundingBox();
  expect([nom, boite !== null && boite.x >= 0 && boite.x + boite.width <= largeur]).toEqual([nom, true]);
}

test('SYSCOHADA · export des modifications, impressions différées et modèle d’édition tiennent à 390 et à 1440 px', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Largeurs sage-l7 e2e', montant: 900 });
  await seConnecter(page, dossier.email);

  for (const largeur of [390, 1440]) {
    await page.setViewportSize({ width: largeur, height: 820 });
    const fenetres: Array<[string, string, string]> = [
      ['/#/exports-ecritures', 'Exporter les modifications', 'Fermer Exporter les modifications'],
      ['/#/impressions-differees', "Demander l'impression", 'Fermer Impressions différées'],
      ['/#/comptes', "Personnaliser l'édition…", 'Fermer Plan comptable'],
    ];
    for (const [adresse, commande, fermer] of fenetres) {
      await page.goto(adresse);
      await dansLEcran(page, commande, largeur);
      await sansDebordement(page, largeur);
      await page.getByRole('button', { name: fermer }).click();
    }
  }

  expect(pannes).toEqual([]);
});
