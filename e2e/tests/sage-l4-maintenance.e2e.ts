import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L4, FONCTION N° 73 · RENUMÉROTATION ET MAINTENANCE DU REGISTRE,
 * sur la base réelle. Ce qui casserait en silence · un écart entre le
 * registre et la balance qui ne se dirait pas, une renumérotation qui
 * écrirait autre chose que son aperçu, ou qui partirait malgré un numéro
 * déjà porté.
 */

interface Exercice { id: string; dateDebut: string }

test('SYSCOHADA · la maintenance nomme l’écart du registre, la renumérotation suit son aperçu', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Maintenance L4 e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const debut = exercice.dateDebut.slice(0, 10);
  const plan = await appelApi<Array<{ id: string; numero: string }>>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const c2451 = plan.find((c) => c.numero === '24510000');
  const c4812 = plan.find((c) => c.numero === '48120000');
  const od = (await appelApi<Array<{ id: string; code: string }>>(page, 'GET', '/journaux')).find((j) => j.code === 'OD');
  if (!c2451 || !c4812 || !od) throw new Error('24510000, 48120000 ou journal OD absents');
  for (const c of [c2451, c4812]) await appelApi(page, 'PATCH', `/comptes/${c.id}`, { estRetenu: true });
  const contreparties = await appelApi<Array<{ id: string; mode: string | null }>>(page, 'GET', `/immobilisations/contreparties-acquisition?compteImmobilisationId=${c2451.id}`);
  const tresorerie = contreparties.find((c) => c.mode === 'ACHAT_COMPTANT');
  if (!tresorerie) throw new Error('Aucune contrepartie de trésorerie');
  // Un bien par le module, une acquisition passée hors du registre.
  await appelApi(page, 'POST', '/immobilisations', {
    compteImmobilisationId: c2451.id,
    designation: 'Camion M e2e',
    dateAcquisition: debut,
    dateMiseEnService: debut,
    valeurOrigine: 6_000_000,
    dureeAmortissementAns: 4,
    compteContrepartieId: tresorerie.id,
    journalId: od.id,
    exerciceId: exercice.id,
  });
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: od.id,
    date: debut,
    libelle: 'Remorque hors registre',
    lignes: [
      { compteId: c2451.id, debit: 1_000_000, credit: 0 },
      { compteId: c4812.id, debit: 0, credit: 1_000_000 },
    ],
  });

  await page.goto('/#/immobilisations');
  await page.getByRole('tab', { name: 'Opérations' }).click();
  const ligne2451 = page.getByRole('row').filter({ hasText: '24510000' }).first();
  await expect(ligne2451).toContainText(/6\s000\s000,00/);
  await expect(ligne2451).toContainText(/7\s000\s000,00/);
  await expect(ligne2451).toContainText('1 ligne(s) sans fiche');

  // Renumérotation · l'aperçu dit le numéro, la confirmation l'écrit.
  const renum = page.locator('form').filter({ hasText: 'Renumérotation des biens' });
  await renum.getByLabel('Préfixe').fill('E2E-');
  await renum.getByRole('button', { name: 'Aperçu' }).click();
  await expect(renum.getByRole('row').filter({ hasText: 'Camion M e2e' })).toContainText('E2E-0001');
  await renum.getByRole('button', { name: 'Renuméroter' }).click();
  await expect(page.getByText('1 bien(s) renuméroté(s), 0 déjà à leur numéro.')).toBeVisible();
  const biens = await appelApi<Array<{ designation: string; numeroInventaire: string | null }>>(page, 'GET', '/immobilisations');
  expect(biens.find((b) => b.designation === 'Camion M e2e')?.numeroInventaire).toBe('E2E-0001');

  expect(pannes).toEqual([]);
});
