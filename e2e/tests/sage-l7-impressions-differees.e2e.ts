import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * L'IMPRESSION DIFFÉRÉE (ligne sage-l7, fonction 59 · décision L7-2, AUDCIF
 * art. 22, 6° et 7°). Fichier > Impressions différées · la demande prend un
 * numéro, le serveur la produit par le moteur de l'export du même livre, et
 * la fenêtre la retrouve « Prête » avec son fichier ; le journal entier
 * produit s'enregistre comme imprimé ; un fichier retiré laisse la demande.
 */
interface Exercice { id: string; dateFin: string }

test('SYSCOHADA · une édition demandée maintenant se retrouve prête, numérotée, et son fichier se télécharge', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Impressions différées e2e', montant: 6_000 });
  await seConnecter(page, dossier.email);
  const exercice = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id === dossier.exerciceId)!;
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: exercice.dateFin.slice(0, 10) });

  await page.goto('/#/impressions-differees');
  await expect(page.getByText('Aucune impression demandée.')).toBeVisible();

  // La balance avec ses grands livres.
  await page.getByLabel('Édition').selectOption('BALANCE');
  await page.getByRole('button', { name: "Demander l'impression" }).click();
  await expect(page.getByText(/Impression n° 1 demandée/)).toBeVisible();
  const ligneBalance = page.getByRole('row').filter({ hasText: 'Balance · exercice' });
  await expect(ligneBalance).toContainText('Prête', { timeout: 60_000 });
  const [balance] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: "Télécharger l'impression n° 1" }).click(),
  ]);
  expect(balance.suggestedFilename()).toMatch(/\.xlsx$/);

  // Le journal entier, livre-journal seul · produit, il s'enregistre comme imprimé.
  await page.getByLabel('Édition').selectOption('JOURNAL');
  await page.getByLabel('Brouillard compris').uncheck();
  await page.getByRole('button', { name: "Demander l'impression" }).click();
  await expect(page.getByText(/Impression n° 2 demandée/)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'livre-journal seul' })).toContainText('Prête', { timeout: 60_000 });
  const imprimes = await appelApi<{ impressions: { numero: number }[] }>(page, 'GET', `/impressions-journal?exerciceId=${exercice.id}`);
  expect(imprimes.impressions.length).toBe(1);

  // Retirer le fichier · la demande reste, numérotée, son fichier ne se sert plus.
  // Le retrait se confirme en ligne (relecture des écrans, second tour, 7).
  await page.getByRole('button', { name: "Retirer le fichier de l'impression n° 1" }).click();
  await expect(ligneBalance).toContainText('Prête');
  await expect(ligneBalance).not.toContainText('fichier retiré');
  await page.getByRole('button', { name: "Confirmer le retrait du fichier de l'impression n° 1" }).click();
  await expect(ligneBalance).toContainText('Prête · fichier retiré');
  await expect(page.getByRole('button', { name: "Télécharger l'impression n° 1" })).toHaveCount(0);
  const liste = await appelApi<{ impressions: { numero: number; etat: string; fichierRetireLe: string | null }[] }>(
    page,
    'GET',
    '/impressions-differees',
  );
  expect(liste.impressions.map((i) => [i.numero, i.etat, i.fichierRetireLe !== null])).toEqual([
    [2, 'PRETE', false],
    [1, 'PRETE', true],
  ]);
  await expect(appelApi(page, 'GET', `/impressions-differees/${(liste.impressions[1] as unknown as { id: string }).id}/fichier`)).rejects.toThrow(
    /a été retiré/,
  );

  expect(pannes).toEqual([]);
});
