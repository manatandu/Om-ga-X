import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE MICROFINA M4 · LE DÉTENTEUR D'UN BIEN, sur la base réelle. Ce qui
 * casserait en silence · un volet qui plante au rendu, une affectation qui
 * passerait une écriture, un reçu sans numéro, une signature présumée, une
 * seconde affectation acceptée sur un bien déjà détenu, un suivi vide.
 */

interface Exercice { id: string; dateDebut: string; dateFin: string }

test('SYSCOHADA · affecter un bien à un salarié, déclarer la signature du reçu, puis le lire au suivi', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Détenteur M4 e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  // Relecture m10 · la remise se date au plus petit du début de l'exercice et
  // du jour de Kinshasa · un exercice qui s'ouvre plus tard que le jour ferait
  // une remise future, que le serveur refuse.
  const aujourdhui = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
  const debut = exercice.dateDebut.slice(0, 10) < aujourdhui ? exercice.dateDebut.slice(0, 10) : aujourdhui;

  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'KABILA', prenoms: 'Jean', sexe: 'MASCULIN' });
  await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2025-01-01' });
  const comptes = await appelApi<Array<{ id: string; numero: string }>>(page, 'GET', '/immobilisations/comptes-du-bien');
  const vehicule = comptes.find((c) => c.numero === '24510000');
  if (!vehicule) throw new Error('Aucun 24510000 au plan semé');
  const bien = await appelApi<{ id: string }>(page, 'POST', '/immobilisations', {
    compteImmobilisationId: vehicule.id,
    designation: 'Moto M4 e2e',
    dateAcquisition: '2025-06-01',
    dateMiseEnService: '2025-06-01',
    valeurOrigine: 4_000_000,
    dureeAmortissementAns: 4,
    amortissementAnterieur: 500_000,
    repris: true,
    exerciceId: exercice.id,
  });
  const balance = async () =>
    (await appelApi<{ lignes: Array<{ mouvementDebit: number; mouvementCredit: number }> }>(page, 'GET', `/ecritures/balance?exerciceId=${exercice.id}`)).lignes.reduce(
      (s, l) => s + Number(l.mouvementDebit) + Number(l.mouvementCredit),
      0,
    );
  const balanceAvant = await balance();

  await page.goto('/#/immobilisations');
  await page.getByRole('button', { name: 'Fiche', exact: true }).click();
  const fiche = page.getByRole('dialog', { name: 'Fiche · Moto M4 e2e' });
  await expect(fiche).toBeVisible();
  await fiche.getByRole('tab', { name: 'Détenteur' }).click();
  await expect(fiche.getByTestId('detenteur-actuel')).toHaveText('Aucun détenteur');

  await fiche.getByRole('button', { name: 'Affecter' }).click();
  await fiche.getByLabel('Date du geste').fill(debut);
  // Un seul salarié sous contrat · présélectionné.
  await expect(fiche.getByLabel('Salarié détenteur')).toHaveValue(salarie.id);
  await fiche.getByLabel('Observation').fill('Remise avec casque');
  await fiche.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(fiche.getByTestId('detenteur-actuel')).toContainText('KABILA Jean');
  const recu = fiche.getByTestId('recu-detention');
  await expect(recu).toContainText('N° 1');
  await expect(recu).toContainText('Signature non déclarée');

  await recu.getByLabel('Signé par').fill('Jean Kabila');
  await recu.getByLabel('Date de la signature').fill(debut);
  await recu.getByRole('button', { name: 'Déclarer la signature' }).click();
  await expect(recu.getByTestId('signature-declaree')).toContainText('Jean Kabila');

  // Le bien détenu ne se réaffecte pas · le bouton n'est plus offert, et le serveur refuse.
  await expect(fiche.getByRole('button', { name: 'Affecter' })).toHaveCount(0);
  await expect(appelApi(page, 'POST', `/immobilisations/${bien.id}/detentions/affectation`, { salarieId: salarie.id, date: debut })).rejects.toThrow(/détenu par KABILA Jean/);
  // Aucune écriture comptable.
  expect(await balance()).toBe(balanceAvant);

  await fiche.getByRole('button', { name: 'Fermer la fiche' }).click();
  await page.getByRole('tab', { name: 'Détenteurs' }).click();
  const suivi = page.getByTestId('suivi-detentions');
  await suivi.getByLabel('Début de la période').fill(debut);
  await suivi.getByRole('button', { name: 'Afficher' }).click();
  await expect(suivi.getByRole('row', { name: /Moto M4 e2e.*KABILA Jean.*en cours/ })).toBeVisible();

  // Relecture B1 · l'affectation se défait à rebours, avec son motif · la
  // détention et son reçu restent, marqués annulés, et le bien n'a plus de
  // détenteur ; le suivi ne la montre plus.
  await page.getByRole('tab', { name: 'Biens' }).click();
  await page.getByRole('button', { name: 'Fiche', exact: true }).click();
  await expect(fiche).toBeVisible();
  await fiche.getByRole('tab', { name: 'Détenteur' }).click();
  await fiche.getByRole('button', { name: /Annuler le dernier acte \(reçu n° 1\)/ }).click();
  await fiche.getByLabel('Motif de l’annulation').fill('Remise saisie sur la mauvaise fiche');
  await fiche.getByRole('button', { name: 'Confirmer l’annulation' }).click();
  await expect(fiche.getByTestId('detenteur-actuel')).toHaveText('Aucun détenteur');
  await expect(fiche.getByRole('row', { name: /KABILA Jean · annulée/ })).toBeVisible();
  await expect(fiche.getByRole('button', { name: /n° 1 \(annulé\)/ })).toBeVisible();
  expect(await balance()).toBe(balanceAvant);
  await fiche.getByRole('button', { name: 'Fermer la fiche' }).click();
  await page.getByRole('tab', { name: 'Détenteurs' }).click();
  await suivi.getByLabel('Début de la période').fill(debut);
  await suivi.getByRole('button', { name: 'Afficher' }).click();
  await expect(suivi.getByRole('row', { name: /Moto M4 e2e/ })).toHaveCount(0);

  expect(pannes).toEqual([]);
});
