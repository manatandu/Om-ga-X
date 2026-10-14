import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L4, FONCTION N° 68 · CRÉER LES BIENS DEPUIS LES ÉCRITURES DÉJÀ
 * PASSÉES, sur la base réelle. Ce qui casserait en silence · une fiche qui
 * passerait une seconde écriture d'acquisition (brut doublé, balance
 * bouclée), une ligne qui resterait proposée après sa fiche, un retrait qui
 * emporterait l'écriture validée du journal.
 */

interface Exercice { id: string; dateDebut: string; dateFin: string }

test('SYSCOHADA · la fiche naît d’une ligne validée, sans écriture, et se retire en laissant l’écriture au journal', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Depuis écritures L4 e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const debut = exercice.dateDebut.slice(0, 10);
  const plan = await appelApi<Array<{ id: string; numero: string }>>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const c2451 = plan.find((c) => c.numero === '24510000');
  const c4812 = plan.find((c) => c.numero === '48120000');
  const od = (await appelApi<Array<{ id: string; code: string }>>(page, 'GET', '/journaux')).find((j) => j.code === 'OD');
  if (!c2451 || !c4812 || !od) throw new Error('24510000, 48120000 ou journal OD absents du dossier semé');
  // Seul un compte personnalisé se saisit · adopté tel quel.
  for (const c of [c2451, c4812]) await appelApi(page, 'PATCH', `/comptes/${c.id}`, { estRetenu: true });
  const ecriture = await appelApi<{ id: string }>(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: od.id,
    date: debut,
    libelle: 'Facture camion',
    lignes: [
      { compteId: c2451.id, debit: 9_000_000, credit: 0, libelle: 'Camion E2E' },
      { compteId: c4812.id, debit: 0, credit: 9_000_000 },
    ],
  });
  await appelApi(page, 'POST', '/ecritures/valider', { ecritureIds: [ecriture.id] });
  const etat2451 = async () => {
    const { lignes } = await appelApi<{ lignes: Array<{ numero: string; mouvementDebit: number }> }>(
      page,
      'GET',
      `/ecritures/balance?exerciceId=${exercice.id}`,
    );
    const { ecritures } = await appelApi<{ ecritures: unknown[] }>(page, 'GET', `/ecritures?exerciceId=${exercice.id}`);
    return { debit: Number(lignes.find((l) => l.numero === '24510000')?.mouvementDebit ?? 0), ecritures: ecritures.length };
  };
  const avant = await etat2451();
  expect(avant.debit).toBe(9_000_000);

  await page.goto('/#/immobilisations');
  await page.getByRole('button', { name: 'Créer depuis les écritures' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Créer depuis les écritures' });
  const ligne = fenetre.getByRole('row').filter({ hasText: 'Camion E2E' });
  await expect(ligne).toContainText('24510000');
  await expect(ligne).toContainText(/9\s000\s000,00/);
  await ligne.getByRole('button', { name: 'Créer la fiche' }).click();
  const formulaire = fenetre.locator('form');
  await expect(formulaire.getByLabel('Désignation')).toHaveValue('Camion E2E');
  // La mise en service est PROPOSÉE à la date de la pièce, visible.
  await expect(formulaire.getByLabel('Mise en service')).toHaveValue(debut);
  await formulaire.getByLabel('Durée (ans)').fill('4');
  await formulaire.getByRole('button', { name: 'Créer la fiche' }).click();
  await expect(page.getByText(/Fiche « Camion E2E » créée depuis la pièce n° \d+ · aucune écriture passée\./)).toBeVisible();
  // La ligne sort de la liste relue.
  await expect(fenetre.getByText('Aucune ligne d’acquisition validée sans fiche dans les exercices ouverts.')).toBeVisible();
  expect(await etat2451()).toEqual(avant);
  await fenetre.getByRole('button', { name: 'Fermer' }).click();
  await expect(fenetre).toBeHidden();

  // La fiche dit son origine, et se retire · l'écriture reste au journal.
  await page.getByRole('button', { name: 'Fiche', exact: true }).click();
  const fiche = page.getByRole('dialog', { name: 'Fiche · Camion E2E' });
  await expect(fiche.getByText(/Née de l’écriture déjà passée · pièce n°/)).toBeVisible();
  await expect(fiche.getByLabel('Valeur d’origine')).toBeDisabled();
  await fiche.getByRole('button', { name: 'Retirer la fiche' }).click();
  await fiche.getByRole('button', { name: 'Confirmer le retrait' }).click();
  await expect(page.getByText(/Fiche « Camion E2E » retirée · son écriture reste au journal/)).toBeVisible();
  expect(await etat2451()).toEqual(avant);

  // La ligne revient à la liste.
  await page.getByRole('button', { name: 'Créer depuis les écritures' }).click();
  await expect(page.getByRole('dialog', { name: 'Créer depuis les écritures' }).getByRole('row').filter({ hasText: 'Camion E2E' })).toBeVisible();

  expect(pannes).toEqual([]);
});
