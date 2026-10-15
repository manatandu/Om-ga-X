import { expect, test, type Page } from '@playwright/test';
import { appelApi, creerDossier, rechargerAuRepos, seConnecter, surveiller } from './outils';

/**
 * L'EXPORT DES SEULES MODIFICATIONS (ligne sage-l7, fonction 99 · décisions
 * L7-3 et L7-4, AUDCIF art. 20, al. 2 et art. 22, 1°, 2° et 7°). Fichier >
 * Exporter les modifications · chaque export prend un numéro continu, son
 * fichier est gardé et se retélécharge ; un export suivant ne porte que ce qui
 * a changé · l'écriture nouvelle, le brouillard modifié depuis son envoi, le
 * retrait d'un brouillard parti (dit à part), et la validation d'une écriture
 * partie au brouillard. Rien à exporter ne prend aucun numéro.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Ecriture { id: string; libelle: string; journalId: string; date: string; lignes: { compteId: string; debit: string | number; credit: string | number }[] }

async function exporterParLeBouton(page: Page, nom: string): Promise<string> {
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: nom, exact: true }).click()]);
  return telechargement.suggestedFilename();
}

async function cocherLeBrouillard(page: Page) {
  await page.getByLabel('Brouillard compris').check();
}

test('SYSCOHADA · un export ne porte que ce qui a changé depuis le précédent, numéroté, et se retélécharge', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Export modifications e2e', montant: 4_000 });
  await seConnecter(page, dossier.email);
  const exercice = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id === dossier.exerciceId)!;
  const [premiere] = (await appelApi<{ ecritures: Ecriture[] }>(page, 'GET', `/ecritures?exerciceId=${exercice.id}`)).ecritures;

  await page.goto('/#/exports-ecritures');
  // Le livre-journal seul · la pièce du dossier est au brouillard, rien ne part.
  await expect(page.getByText('Aucune écriture à exporter.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exporter les modifications', exact: true })).toBeDisabled();
  await expect(page.getByText('Aucun export.')).toBeVisible();

  // Brouillard compris · le premier export porte la pièce.
  await cocherLeBrouillard(page);
  await expect(page.getByText('1 nouvelle, 0 modifiée, 0 supprimée · 2 lignes')).toBeVisible();
  expect(await exporterParLeBouton(page, 'Exporter les modifications')).toMatch(/^ecritures-export-0001-\d{4}-\d{2}-\d{2}\.xlsx$/);
  await expect(page.getByText(/Export n° 1 produit · 1 écriture, 0 retrait, 2 lignes/)).toBeVisible();
  await expect(page.getByText("Aucune modification depuis l'export n° 1.")).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Premier export' })).toBeVisible();

  // La pièce partie au brouillard est modifiée, une seconde est saisie.
  await appelApi(page, 'PATCH', `/ecritures/${premiere.id}`, { libelle: 'Recette e2e corrigée au brouillard' });
  const seconde = await appelApi<{ id: string }>(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: premiere.journalId,
    date: premiere.date.slice(0, 10),
    libelle: 'Seconde recette e2e',
    lignes: premiere.lignes.map((l) => ({ compteId: l.compteId, debit: Number(l.debit) > 0 ? 1_500 : 0, credit: Number(l.credit) > 0 ? 1_500 : 0 })),
  });
  await rechargerAuRepos(page);
  await cocherLeBrouillard(page);
  await expect(page.getByText("Depuis l'export n° 1", { exact: true })).toBeVisible();
  await expect(page.getByText('1 nouvelle, 1 modifiée, 0 supprimée · 4 lignes')).toBeVisible();
  expect(await exporterParLeBouton(page, 'Exporter les modifications')).toMatch(/^ecritures-export-0002-/);
  await expect(page.getByText(/Export n° 2 produit · 2 écritures, 0 retrait, 4 lignes/)).toBeVisible();

  // La seconde, partie au brouillard, est retirée · l'export suivant le dit, sans ligne.
  await appelApi(page, 'DELETE', `/ecritures/${seconde.id}`);
  await rechargerAuRepos(page);
  await cocherLeBrouillard(page);
  await expect(page.getByText('0 nouvelle, 0 modifiée, 1 supprimée · 0 ligne')).toBeVisible();
  expect(await exporterParLeBouton(page, 'Exporter les modifications')).toMatch(/^ecritures-export-0003-/);
  await expect(page.getByText(/Export n° 3 produit · 0 écriture, 1 retrait, 0 ligne/)).toBeVisible();

  // Validée depuis son envoi au brouillard · elle repart une fois, au livre-journal seul.
  await appelApi(page, 'POST', '/ecritures/valider', { ecritureIds: [premiere.id] });
  await rechargerAuRepos(page);
  await expect(page.getByText('0 nouvelle, 1 modifiée, 0 supprimée · 2 lignes')).toBeVisible();
  expect(await exporterParLeBouton(page, 'Exporter les modifications')).toMatch(/^ecritures-export-0004-/);
  await expect(page.getByText("Aucune modification depuis l'export n° 4.")).toBeVisible();

  // L'export complet renvoie tout sous un nouveau numéro, après confirmation.
  await page.getByRole('button', { name: 'Export complet…' }).click();
  expect(await exporterParLeBouton(page, "Confirmer l'export complet")).toMatch(/^ecritures-export-0005-/);
  await expect(page.getByRole('cell', { name: 'Export complet' })).toBeVisible();

  // Un fichier gardé se retélécharge depuis la liste.
  const [ancien] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: "Télécharger l'export n° 2" }).click(),
  ]);
  expect(ancien.suggestedFilename()).toMatch(/^ecritures-export-0002-/);

  const liste = await appelApi<{ exports: { numero: number; nombreNouvelles: number; nombreModifiees: number; nombreSupprimees: number }[] }>(
    page,
    'GET',
    '/exports-ecritures',
  );
  expect(liste.exports.map((e) => [e.numero, e.nombreNouvelles, e.nombreModifiees, e.nombreSupprimees])).toEqual([
    [5, 0, 0, 0],
    [4, 0, 1, 0],
    [3, 0, 0, 1],
    [2, 1, 1, 0],
    [1, 1, 0, 0],
  ]);
  // Rien à exporter ne prend aucun numéro.
  await expect(appelApi(page, 'POST', '/exports-ecritures', { mode: 'MODIFICATIONS', inclureBrouillard: false })).rejects.toThrow(
    /Aucune modification depuis l'export n° 5/,
  );

  expect(pannes).toEqual([]);
});
