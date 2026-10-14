import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L4, FONCTION N° 18 · L'ASSISTANT DE CRÉATION D'UN BIEN, sur la
 * base réelle. Ce qui casserait en silence · un assistant qui créerait par
 * un autre chemin que le formulaire (une fiche sans son écriture
 * d'acquisition), un bien repris qui passerait quand même une écriture, une
 * série enchaînée qui garderait la valeur du bien précédent.
 */

interface Exercice { id: string; dateDebut: string }

test('SYSCOHADA · l’assistant crée un bien en huit étapes, puis un second enchaîné', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Assistant L4 e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const debut = exercice.dateDebut.slice(0, 10);
  const plan = await appelApi<Array<{ id: string; numero: string }>>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const c2451 = plan.find((c) => c.numero === '24510000');
  if (!c2451) throw new Error('24510000 absent');
  await appelApi(page, 'PATCH', `/comptes/${c2451.id}`, { estRetenu: true });
  const mouvement2451 = async () => {
    const { lignes } = await appelApi<{ lignes: Array<{ numero: string; mouvementDebit: number }> }>(page, 'GET', `/ecritures/balance?exerciceId=${exercice.id}`);
    return Number(lignes.find((l) => l.numero === '24510000')?.mouvementDebit ?? 0);
  };

  await page.goto('/#/immobilisations');
  await page.getByRole('button', { name: 'Assistant' }).click();
  const assistant = page.getByRole('dialog', { name: 'Assistant de création d’un bien' });
  const suivant = assistant.getByRole('button', { name: 'Suivant' });

  // 1. Désignation · on n'avance pas sans elle.
  await expect(suivant).toBeDisabled();
  // Le focus est au premier champ de l'étape, et Entrée avance (relecture).
  await expect(assistant.getByLabel('Désignation')).toBeFocused();
  await assistant.getByLabel('Désignation').fill('Camion assistant');
  await page.keyboard.press('Enter');
  // 2. Compte.
  await expect(assistant.getByLabel('Compte du bien')).toBeFocused();
  await assistant.getByLabel('Compte du bien').selectOption(c2451.id);
  await suivant.click();
  // 3. Origine · acquis dans l'exercice.
  await suivant.click();
  // 4. Dates.
  await assistant.getByLabel('Date d’acquisition').fill(debut);
  await assistant.getByLabel('Mise en service').fill(debut);
  await suivant.click();
  // 5. Valeur.
  // Un montant tapé avec ses espaces se lit (relecture).
  await assistant.getByLabel('Valeur d’origine').fill('8 000 000');
  await suivant.click();
  // 6. Financement · la liste du formulaire, et le journal.
  const financement = assistant.getByLabel('Financement');
  await expect(financement.locator('option')).not.toHaveCount(1);
  await financement.selectOption({ index: 1 });
  await assistant.getByLabel('Journal').selectOption({ label: 'OD · Opérations diverses' });
  await suivant.click();
  // 7. Amortissement.
  await assistant.getByLabel('Durée (ans)').fill('4');
  await suivant.click();
  // 8. Récapitulatif, puis création par la route du formulaire.
  await expect(assistant.getByRole('cell', { name: 'Camion assistant' })).toBeVisible();
  await expect(assistant.getByRole('cell', { name: /8\s000\s000,00/ })).toBeVisible();
  await expect(assistant.getByRole('button', { name: 'Créer le bien' })).toBeFocused();
  await assistant.getByRole('button', { name: 'Créer le bien' }).click();
  await expect(assistant.getByText('Bien « Camion assistant » créé.')).toBeVisible();
  expect(await mouvement2451()).toBe(8_000_000);

  // Création enchaînée · la série reste, la valeur part.
  await assistant.getByRole('button', { name: 'Créer un autre bien' }).click();
  await expect(assistant.getByLabel('Désignation')).toHaveValue('');
  await assistant.getByLabel('Désignation').fill('Camion assistant 2');
  await suivant.click();
  await expect(assistant.getByLabel('Compte du bien')).toHaveValue(c2451.id);
  await suivant.click();
  // Repris au bilan d'ouverture · aucune écriture, l'étape Financement disparaît.
  await assistant.getByLabel(/Repris au bilan d’ouverture/).check();
  await expect(assistant.getByRole('button', { name: /Financement/ })).toHaveCount(0);
  await suivant.click();
  await suivant.click();
  await expect(assistant.getByLabel('Valeur d’origine')).toHaveValue('');
  await assistant.getByLabel('Valeur d’origine').fill('5000000');
  await suivant.click();
  await suivant.click();
  await assistant.getByRole('button', { name: 'Créer le bien' }).click();
  // Le serveur refuse un bien « repris » acquis dans l'exercice · le refus se
  // dit au récapitulatif, rien n'est créé.
  await expect(assistant.getByText(/Un bien repris est un bien déjà porté au bilan d'ouverture/)).toBeVisible();
  expect(await mouvement2451()).toBe(8_000_000);
  const biens = await appelApi<Array<{ designation: string }>>(page, 'GET', '/immobilisations');
  expect(biens.map((b) => b.designation)).toEqual(['Camion assistant']);

  expect(pannes).toEqual([]);
});
