import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L4, FONCTION N° 67 · ANNULER UNE DOTATION OU UN TRAITEMENT,
 * depuis la fiche du bien, sur la base réelle (AUDCIF art. 20, al. 2 et 22).
 * Ce qui casserait en silence · la fenêtre qui plante au rendu, le bouton
 * ouvert sur un traitement que le serveur refuse, l'écriture au brouillard
 * qui reste au journal après l'annulation de sa dotation.
 */

interface Exercice { id: string; dateDebut: string; dateFin: string }

test('SYSCOHADA · la fiche du bien annule sa dotation au brouillard, et refuse celle qu’une dépréciation a lue', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Annulation L4 e2e', montant: 10_000 });
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
  const bien = await appelApi<{ id: string }>(page, 'POST', '/immobilisations', {
    compteImmobilisationId: vehicule.id,
    designation: 'Camion L4 e2e',
    dateAcquisition: debut,
    dateMiseEnService: debut,
    valeurOrigine: 12_000_000,
    dureeAmortissementAns: 4,
    modeAmortissement: 'LINEAIRE',
    compteContrepartieId: tresorerie.id,
    journalId: od.id,
    exerciceId: exercice.id,
  });
  await appelApi(page, 'POST', `/immobilisations/${bien.id}/dotation`, { exerciceId: exercice.id, journalId: od.id });

  await page.goto('/#/immobilisations');
  await page.getByRole('button', { name: 'Fiche', exact: true }).click();
  const fiche = page.getByRole('dialog', { name: 'Fiche · Camion L4 e2e' });
  await expect(fiche).toBeVisible();
  await fiche.getByRole('tab', { name: 'Traitements' }).click();
  await expect(fiche.getByRole('tab', { name: 'Traitements' })).toHaveAttribute('aria-selected', 'true');
  await expect(fiche.getByText('Aucune annulation sur ce bien.')).toBeVisible();
  const ligneDotation = fiche.getByRole('row', { name: /Dotation de l'exercice clos le/ });
  await expect(ligneDotation).toContainText('brouillard');
  await expect(ligneDotation).toContainText(/3\s000\s000,00/);

  // Annulation au brouillard · motif exigé, l'écriture part avec la dotation.
  await ligneDotation.getByRole('button', { name: 'Annuler' }).click();
  const confirmer = fiche.getByRole('button', { name: 'Confirmer l’annulation' });
  await expect(confirmer).toBeDisabled();
  await fiche.getByLabel('Motif').fill('Durée erronée');
  await confirmer.click();
  await expect(fiche.getByText('Aucun traitement sur ce bien.')).toBeVisible();
  await expect(fiche.getByText('Motif · Durée erronée')).toBeVisible();
  const { lignes } = await appelApi<{ lignes: Array<{ numero: string; mouvementDebit: number }> }>(
    page,
    'GET',
    `/ecritures/balance?exerciceId=${exercice.id}`,
  );
  expect(lignes.find((l) => l.numero === '68130000')).toBeUndefined();

  // Une dépréciation postérieure · la dotation repassée ne s'annule plus avant elle,
  // et le bouton le dit au lieu d'envoyer un geste refusé.
  await appelApi(page, 'POST', `/immobilisations/${bien.id}/dotation`, { exerciceId: exercice.id, journalId: od.id });
  const plan = await appelApi<Array<{ id: string; numero: string }>>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const id = (n: string) => plan.find((c) => c.numero === n)?.id;
  await appelApi(page, 'POST', `/immobilisations/${bien.id}/depreciation`, {
    exerciceId: exercice.id,
    journalId: od.id,
    sens: 'DOTATION',
    montant: 600_000,
    compteDepreciationId: id('29450000'),
    compteContrepartieId: id('69140000'),
    indice: 'Accident constaté',
  });
  await page.keyboard.press('Escape');
  await expect(fiche).toBeHidden();
  await page.getByRole('button', { name: 'Fiche', exact: true }).click();
  await expect(fiche).toBeVisible();
  await fiche.getByRole('tab', { name: 'Traitements' }).click();
  const dotation = fiche.getByRole('row', { name: /^Dotation de l'exercice clos le/ });
  await expect(dotation.getByRole('button', { name: 'Annuler' })).toBeDisabled();
  await expect(dotation).toContainText('Annulez d’abord le plus récent');
  await expect(fiche.getByRole('row', { name: /^Dépréciation de l'exercice clos le/ }).getByRole('button', { name: 'Annuler' })).toBeEnabled();

  // À 390 px, la fiche tient dans l'écran sans défilement horizontal de la page.
  await page.setViewportSize({ width: 390, height: 800 });
  const boite = await fiche.boundingBox();
  expect(boite && boite.x >= 0 && boite.x + boite.width <= 390).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  expect(pannes).toEqual([]);
});
