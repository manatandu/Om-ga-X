import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L4, FONCTION N° 66 · MODIFIER, DUPLIQUER, SUPPRIMER LA FICHE
 * D'UN BIEN, sur la base réelle (décision D7 · AUDCIF art. 20 et 22, 2°).
 * Ce qui casserait en silence · la valeur modifiée sur la fiche et pas au
 * journal, la fiche supprimée qui laisse son écriture au brouillard, un
 * champ figé que l'écran laisserait saisir.
 */

interface Exercice { id: string; dateDebut: string; dateFin: string }

test('SYSCOHADA · la fiche se modifie au brouillard, se duplique, se supprime, et se fige une fois validée', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Fiche L4 e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const debut = exercice.dateDebut.slice(0, 10);
  const comptes = await appelApi<Array<{ id: string; numero: string }>>(page, 'GET', '/immobilisations/comptes-du-bien');
  const vehicule = comptes.find((c) => c.numero === '24510000');
  if (!vehicule) throw new Error('Aucun 24510000 au plan semé');
  const contreparties = await appelApi<Array<{ id: string; mode: string | null }>>(
    page,
    'GET',
    `/immobilisations/contreparties-acquisition?compteImmobilisationId=${vehicule.id}`,
  );
  const tresorerie = contreparties.find((c) => c.mode === 'ACHAT_COMPTANT');
  const od = (await appelApi<Array<{ id: string; code: string }>>(page, 'GET', '/journaux')).find((j) => j.code === 'OD');
  if (!tresorerie || !od) throw new Error('Contrepartie ou journal OD absents');
  await appelApi(page, 'POST', '/immobilisations', {
    compteImmobilisationId: vehicule.id,
    designation: 'Camion F e2e',
    dateAcquisition: debut,
    dateMiseEnService: debut,
    valeurOrigine: 12_000_000,
    dureeAmortissementAns: 4,
    modeAmortissement: 'LINEAIRE',
    compteContrepartieId: tresorerie.id,
    journalId: od.id,
    exerciceId: exercice.id,
  });
  const balance2451 = async () => {
    const { lignes } = await appelApi<{ lignes: Array<{ numero: string; mouvementDebit: number }> }>(
      page,
      'GET',
      `/ecritures/balance?exerciceId=${exercice.id}`,
    );
    return Number(lignes.find((l) => l.numero === '24510000')?.mouvementDebit ?? 0);
  };

  await page.goto('/#/immobilisations');
  await page.getByRole('button', { name: 'Fiche', exact: true }).click();
  const fiche = page.getByRole('dialog', { name: 'Fiche · Camion F e2e' });
  await expect(fiche.getByRole('tab', { name: 'Général' })).toHaveAttribute('aria-selected', 'true');
  // Au brouillard · valeur et désignation se modifient, l'écriture suit.
  await expect(fiche.getByLabel('Valeur d’origine')).toBeEnabled();
  await fiche.getByLabel('Désignation').fill('Camion F modifié');
  await fiche.getByLabel('Valeur d’origine').fill('15000000');
  await fiche.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Fiche « Camion F modifié » modifiée.')).toBeVisible();
  expect(await balance2451()).toBe(15_000_000);

  // Dupliquer · la copie remplit le formulaire de création, rien n'est écrit.
  await fiche.getByRole('button', { name: 'Dupliquer' }).click();
  await expect(fiche).toBeHidden();
  await expect(page.getByText(/Copie préparée dans « Nouvelle immobilisation »/)).toBeVisible();
  await expect(page.getByLabel('Désignation', { exact: true })).toHaveValue('Camion F modifié (copie)');
  await expect(page.getByLabel('Valeur d\'origine', { exact: true })).toHaveValue('15000000');
  expect(await balance2451()).toBe(15_000_000);

  // Validée, la valeur se fige et la suppression se refuse, motif dit.
  const { ecritures } = await appelApi<{ ecritures: Array<{ id: string; statut: string }> }>(page, 'GET', `/ecritures?exerciceId=${exercice.id}`);
  await appelApi(page, 'POST', '/ecritures/valider', { ecritureIds: ecritures.filter((e) => e.statut === 'BROUILLARD').map((e) => e.id) });
  await page.reload();
  await page.getByRole('button', { name: 'Fiche', exact: true }).click();
  const ficheModifiee = page.getByRole('dialog', { name: 'Fiche · Camion F modifié' });
  await expect(ficheModifiee.getByText(/est validée · valeur, compte, dates et plan/)).toBeVisible();
  await expect(ficheModifiee.getByLabel('Valeur d’origine')).toBeDisabled();
  await expect(ficheModifiee.getByRole('button', { name: 'Supprimer la fiche' })).toBeDisabled();
  await expect(ficheModifiee.getByLabel('Désignation')).toBeEnabled();
  await page.keyboard.press('Escape');

  // Un second bien, au brouillard, se supprime avec son écriture.
  await appelApi(page, 'POST', '/immobilisations', {
    compteImmobilisationId: vehicule.id,
    designation: 'Camion G e2e',
    dateAcquisition: debut,
    dateMiseEnService: debut,
    valeurOrigine: 5_000_000,
    dureeAmortissementAns: 4,
    modeAmortissement: 'LINEAIRE',
    compteContrepartieId: tresorerie.id,
    journalId: od.id,
    exerciceId: exercice.id,
  });
  expect(await balance2451()).toBe(20_000_000);
  await page.reload();
  await page.getByRole('button', { name: 'Fiche', exact: true }).nth(1).click();
  const ficheG = page.getByRole('dialog', { name: 'Fiche · Camion G e2e' });
  await ficheG.getByRole('button', { name: 'Supprimer la fiche' }).click();
  await ficheG.getByRole('button', { name: 'Confirmer la suppression' }).click();
  await expect(page.getByText(/Fiche « Camion G e2e » supprimée/)).toBeVisible();
  expect(await balance2451()).toBe(15_000_000);

  expect(pannes).toEqual([]);
});
