import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L6, FONCTION N° 50 · LA LONGUEUR FIXE DES CODES DE SECTION, SUR
 * VRAIE BASE.
 *
 * L'axe PROJ porte une rubrique « 1 », une feuille « 101 » et une feuille
 * « 20 ». Trois caractères se refusent tant que « 20 » existe · le refus la
 * nomme, et l'enregistrement reste fermé à l'écran. « 20 » retirée, l'écran
 * propose la longueur commune de ses feuilles, la pose, et la frappe du code
 * d'une nouvelle section s'y borne ; le serveur refuse une feuille de
 * quatre caractères et une rubrique de trois, accepte « 102 », et l'axe
 * revient à la longueur libre sans rien renuméroter.
 */
interface Plan { id: string; code: string; longueurSections: number | null }

test('SYCEBNL · longueur des codes de section · refusée nommée, proposée, posée, respectée, retirée', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Longueur L6 e2e', montant: 5_000 });
  await seConnecter(page, dossier.email);
  const proj = (await appelApi<Plan[]>(page, 'GET', '/analytique/plans')).find((p) => p.code === 'PROJ')!;
  const sections = `/analytique/plans/${proj.id}/sections`;
  await appelApi(page, 'POST', sections, { code: '1', intitule: 'Personnel', type: 'TOTAL' });
  await appelApi(page, 'POST', sections, { code: '101', intitule: 'Salaires' });
  const vingt = await appelApi<{ id: string }>(page, 'POST', sections, { code: '20', intitule: 'Formation' });

  // Le serveur refuse la pose, et nomme la section qui l'empêche.
  await expect(appelApi(page, 'PATCH', `/analytique/plans/${proj.id}`, { longueurSections: 3 })).rejects.toThrow(
    /400.*20 \(section Détail de 2 caractères au lieu de 3\)/,
  );

  // À l'écran · l'aperçu dit le même refus, et l'enregistrement reste fermé.
  await page.goto('/#/plans-analytiques');
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  const longueur = page.getByRole('combobox', { name: 'Longueur des codes de section' });
  await longueur.selectOption('3');
  await expect(page.getByText(/Le plan PROJ ne peut pas passer à des codes de 3 caractères/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();

  // « 20 » retirée, l'écran propose la longueur commune des feuilles.
  await appelApi(page, 'DELETE', `/analytique/sections/${vingt.id}`);
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await expect(page.getByText('Les sections de l\'axe ont toutes des codes de 3 caractères.')).toBeVisible();
  await page.getByRole('button', { name: 'Retenir', exact: true }).click();
  await expect(longueur).toHaveValue('3');
  await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText(/codes de 3 caractères/)).toBeVisible();
  expect((await appelApi<Plan[]>(page, 'GET', '/analytique/plans')).find((p) => p.id === proj.id)!.longueurSections).toBe(3);

  // La frappe du code se borne à la longueur ; le serveur refuse le reste.
  await page.getByRole('button', { name: 'Nouvelle section', exact: true }).click();
  const code = page.getByPlaceholder('3 caractères');
  await code.pressSequentially('10234');
  await expect(code).toHaveValue('102');
  await code.fill('20');
  await page.getByPlaceholder("Accès à l'eau potable · Nord-Kivu").fill('Formation');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(page.getByText(/Le code 20 est une section Détail de 2 caractères au lieu de 3/)).toBeVisible();
  await expect(appelApi(page, 'POST', sections, { code: '1011', intitule: 'Trop long' })).rejects.toThrow(/400.*exactement 3 caractères/);
  await expect(appelApi(page, 'POST', sections, { code: '102', intitule: 'Rubrique trop longue', type: 'TOTAL' })).rejects.toThrow(
    /400.*une rubrique ne regroupe que des codes plus longs/,
  );
  await appelApi(page, 'POST', sections, { code: '102', intitule: 'Charges sociales' });

  // Retour à la longueur libre · rien n'est renuméroté.
  await appelApi(page, 'PATCH', `/analytique/plans/${proj.id}`, { longueurSections: null });
  const codes = (await appelApi<Array<{ code: string }>>(page, 'GET', sections)).map((s) => s.code).sort();
  expect(codes).toEqual(['1', '101', '102']);
  // Hors bornes · refusé au serveur.
  await expect(appelApi(page, 'PATCH', `/analytique/plans/${proj.id}`, { longueurSections: 14 })).rejects.toThrow(/400/);

  expect(pannes).toEqual([]);
});
