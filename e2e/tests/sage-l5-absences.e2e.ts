import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 1 · LES ABSENCES, SUR VRAIE BASE.
 *
 * Un salarié payé 780 000 FC par mois (au-dessus du plancher de la CNSS) · deux jours d'absence non autorisée en
 * août 2026 (non payés, art. 93), trois jours de maladie (deux tiers,
 * art. 105). Déclarées à l'écran, la maladie refusée sans son certificat, le
 * congé de circonstance refusé au-delà des jours de son événement (art. 146).
 * Le mois d'août propose 780 000 × 21 / 26 = 630 000 de salaire et une
 * indemnité de 780 000 × 3 × 2/3 / 26 = 60 000, que l'onglet Simulation
 * reprend au clic. L'absence non autorisée rend août non entier au compteur
 * des congés (art. 141, al. 2) ; annulée, il redevient acquis.
 */
interface Compteur { periodes: { mois: { du: string; statut: string }[] }[] }
interface Proposition { salaireDesJoursDus: number | null; indemniteDeuxTiers: number | null; joursNonDus: number; joursDeuxTiers: number }
interface Absence { id: string; nature: string }

test('SYSCOHADA · absences déclarées à l’écran, proposition du mois reprise au bulletin, effet sur le compteur des congés', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Absences e2e SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'MBALA', prenoms: 'Grace', sexe: 'FEMININ', dateNaissance: '1992-02-20' });
  await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: '2026-01-01',
    periodiciteRemuneration: 'MOIS',
    remunerationBase: 780_000,
    deviseRemuneration: 'CDF',
  });
  for (const m of ['2026-06', '2026-07', '2026-08']) {
    await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/bulletins`, {
      moisDePaie: m,
      elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780_000 }],
      natureEmployeurInpp: 'PRIVE',
      effectif: 12,
    });
  }

  await page.goto('/#/personnel?onglet=absences');
  await expect(page.getByText('Aucune absence déclarée.')).toBeVisible();

  const declarer = async (cause: string, du: string, au: string, autre: { evenement?: string; piece?: string } = {}) => {
    await page.getByRole('button', { name: 'Déclarer une absence' }).click();
    const modale = page.getByRole('dialog', { name: 'Déclarer une absence' });
    await modale.getByLabel('Cause').selectOption({ label: cause });
    if (autre.evenement) await modale.getByLabel('Événement').selectOption({ label: autre.evenement });
    await modale.getByLabel('Premier jour', { exact: true }).fill(du);
    await modale.getByLabel('Dernier jour', { exact: true }).fill(au);
    if (autre.piece) await modale.getByLabel(/^Pièce/).fill(autre.piece);
    await modale.getByRole('button', { name: 'Déclarer' }).click();
    return modale;
  };

  const nonAutorisee = await declarer('Absence non autorisée', '2026-08-04', '2026-08-05');
  await expect(nonAutorisee).toBeHidden();
  await expect(page.getByRole('cell', { name: 'Non payée' })).toBeVisible();

  // Sans son certificat, la maladie est refusée ; avec, elle passe.
  const maladie = await declarer('Maladie ou accident', '2026-08-10', '2026-08-12');
  await expect(maladie.getByRole('alert')).toContainText('certificat médical');
  await maladie.getByLabel(/^Pièce/).fill('Certificat du Dr Kalala');
  await maladie.getByRole('button', { name: 'Déclarer' }).click();
  await expect(maladie).toBeHidden();
  await expect(page.getByRole('cell', { name: 'Deux tiers' })).toBeVisible();

  // Le mariage du travailleur ouvre deux jours · trois sont refusés.
  const mariage = await declarer('Congé de circonstance', '2026-09-01', '2026-09-03', { evenement: 'Mariage du travailleur · 2 jour(s)' });
  await expect(mariage.getByRole('alert')).toContainText('ouvre 2 jour(s)');
  await page.keyboard.press('Escape');
  await expect(mariage).toBeHidden();

  // La proposition du mois, au serveur.
  const lire = (moyenne?: string) =>
    appelApi<{ proposition: Proposition }>(page, 'GET', `/personnel/salaries/${salarie.id}/absences/mois/2026-08${moyenne === undefined ? '' : `?moyenne=${moyenne}`}`);
  expect((await lire()).proposition).toMatchObject({ joursNonDus: 2, joursDeuxTiers: 3, salaireDesJoursDus: 630_000, indemniteDeuxTiers: null });
  expect((await lire('0')).proposition).toMatchObject({ salaireDesJoursDus: 630_000, indemniteDeuxTiers: 60_000 });

  // À l'écran · l'onglet Simulation la reprend au clic.
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await page.getByLabel('Mois de paie').fill('2026-08');
  await page.getByLabel('Salarié (facultatif)').selectOption({ label: 'MBALA Grace' });
  await expect(page.getByText('Absences et congés du mois')).toBeVisible();
  await page.getByLabel('Moyenne mensuelle des douze mois').fill('0');
  await expect(page.getByText(/Salaire des jours dus 630\s000,00 CDF/)).toBeVisible();
  await page.getByRole('button', { name: 'Reprendre au bulletin' }).click();
  const valeurs = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => (i as HTMLInputElement).value));
  expect(valeurs).toEqual(expect.arrayContaining(['630000.00', '60000.00']));

  // Le compteur des congés · août n'est pas entier tant que l'absence non
  // autorisée tient ; annulée, il redevient acquis.
  const statutAout = async () => {
    const r = await appelApi<{ compteur: Compteur }>(page, 'GET', `/personnel/salaries/${salarie.id}/conges?ala=2026-10-14`);
    return r.compteur.periodes[0].mois.find((m) => m.du === '2026-08-01')?.statut;
  };
  expect(await statutAout()).toBe('NON_ENTIER');
  const { absences } = await appelApi<{ absences: Absence[] }>(page, 'GET', `/personnel/salaries/${salarie.id}/absences`);
  const aAnnuler = absences.find((a) => a.nature === 'ABSENCE_NON_AUTORISEE')!;
  await appelApi(page, 'POST', `/personnel/absences/${aAnnuler.id}/annulation`, { motif: 'Absence couverte par une autorisation retrouvée' });
  expect(await statutAout()).toBe('ACQUIS');

  expect(pannes).toEqual([]);
});
