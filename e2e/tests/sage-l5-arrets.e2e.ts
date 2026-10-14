import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 3 · LES ARRÊTS ET L'INDEMNITÉ DE LA
 * CAISSE, SUR VRAIE BASE.
 *
 * Une salariée payée 780 000 FC par mois. Accident du travail du 7 au
 * 9 septembre 2026 (trois jours aux deux tiers, art. 106) · la Caisse verse
 * 20 000, que l'employeur DÉDUIT (art. 106, al. 2) · septembre propose
 * 780 000 × 23 / 26 = 690 000 de salaire et 780 000 × 3 × 2/3 / 26 − 20 000 =
 * 40 000 d'indemnité. Une maladie ordinaire n'ouvre aucune indemnité de la
 * Caisse (arrêté n° 146/2018, art. 63 et 87), la déduction ne vise pas la
 * maternité. Maternité du 5 au 7 octobre · subrogée pour la rémunération
 * entière (art. 139, al. 2), octobre se paie à plein, 90 000 à recevoir de la
 * Caisse ; subrogée dans la limite des deux tiers versés (al. 3), octobre
 * revient à 690 000 et 60 000. Un accident du travail de plus de six mois dit
 * que les deux tiers de l'employeur s'arrêtent (art. 106).
 */
interface Proposition {
  salaireDesJoursDus: number | null;
  indemniteDeuxTiers: number | null;
  joursDeuxTiers: number;
  deductionsCaisse: number;
  aRecevoirDeLaCaisse: number;
}
interface IndemniteLue { id: string; traitement: string; annuleLe: string | null }
interface Absence { id: string; nature: string; du: string; informations: string[]; indemnitesCaisse: IndemniteLue[] }

test('SYSCOHADA · indemnité de la Caisse déclarée à l’écran, déduite ou subrogée, et reprise à la proposition du mois', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Arrets e2e SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'KABEYA', prenoms: 'Ruth', sexe: 'FEMININ', dateNaissance: '1990-07-11' });
  await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: '2025-01-01',
    periodiciteRemuneration: 'MOIS',
    remunerationBase: 780_000,
    deviseRemuneration: 'CDF',
  });

  const declarer = (corps: Record<string, unknown>) => appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/absences`, corps);
  await declarer({ nature: 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE', du: '2026-09-07', au: '2026-09-09', piece: 'Certificat du Dr Ilunga' });
  await declarer({ nature: 'MALADIE_OU_ACCIDENT', du: '2026-09-14', au: '2026-09-15', piece: 'Certificat du Dr Ilunga' });
  await declarer({ nature: 'MATERNITE', du: '2026-10-05', au: '2026-10-07', piece: 'Certificat de grossesse' });
  // Un accident du travail de plus de six mois · l'information de l'art. 106.
  await declarer({ nature: 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE', du: '2025-02-03', au: '2025-08-29', piece: 'Certificat du Dr Ilunga' });

  const lister = async () => (await appelApi<{ absences: Absence[] }>(page, 'GET', `/personnel/salaries/${salarie.id}/absences`)).absences;
  const absences = await lister();
  const maladie = absences.find((a) => a.nature === 'MALADIE_OU_ACCIDENT')!;
  const maternite = absences.find((a) => a.nature === 'MATERNITE')!;
  const atLong = absences.find((a) => a.du.startsWith('2025-02-03'))!;
  expect(atLong.informations.join(' ')).toContain('art. 106');

  // À l'écran · l'indemnité de la Caisse sur l'accident du travail, déduite.
  await page.goto('/#/personnel?onglet=absences');
  await expect(page.getByText('Accident du travail ou maladie professionnelle').first()).toBeVisible();
  await expect(page.getByText(/Les deux tiers dus par l'employeur s'arrêtent/)).toBeVisible();
  const ligneAt = page.getByRole('row').filter({ hasText: '07/09/2026' });
  await ligneAt.getByRole('button', { name: 'Indemnité de la Caisse' }).click();
  const modale = page.getByRole('dialog', { name: /Indemnité de la Caisse/ });
  await modale.getByLabel('Mois', { exact: true }).fill('2026-09');
  await modale.getByLabel('Montant versé par la Caisse').fill('20000');
  await modale.getByLabel('Traitement').selectOption({ label: 'Déduite de l’indemnité' });
  // Sans sa pièce, l'indemnité ne part pas.
  await modale.getByRole('button', { name: 'Déclarer' }).click();
  await expect(modale.getByRole('alert')).toContainText('pièce');
  await modale.getByLabel('Pièce de la Caisse').fill('Bordereau CNSS 2026-09-118');
  await modale.getByRole('button', { name: 'Déclarer' }).click();
  await expect(modale).toBeHidden();
  await expect(page.getByText(/Caisse 2026-09 · 20\s000,00/)).toBeVisible();
  // La maladie ordinaire n'a pas le bouton.
  await expect(page.getByRole('row').filter({ hasText: '14/09/2026' }).getByRole('button', { name: 'Indemnité de la Caisse' })).toHaveCount(0);

  // Le serveur refuse aussi · maladie ordinaire, déduction sur une maternité.
  await expect(
    appelApi(page, 'POST', `/personnel/absences/${maladie.id}/indemnites-caisse`, { mois: '2026-09', montant: 5_000, traitement: 'DEDUITE', piece: 'Bordereau' }),
  ).rejects.toThrow(/aucune indemnité journalière/);
  await expect(
    appelApi(page, 'POST', `/personnel/absences/${maternite.id}/indemnites-caisse`, { mois: '2026-10', montant: 5_000, traitement: 'DEDUITE', piece: 'Bordereau' }),
  ).rejects.toThrow(/art\. 106, al\. 2/);

  const lire = (mois: string) =>
    appelApi<{ proposition: Proposition }>(page, 'GET', `/personnel/salaries/${salarie.id}/absences/mois/${mois}?moyenne=0`).then((r) => r.proposition);

  // Septembre · accident du travail déduit, maladie ordinaire aux deux tiers.
  // 5 jours aux deux tiers (3 + 2) · 780 000 × 21 / 26 = 630 000 ;
  // 780 000 × 5 × 2/3 / 26 = 100 000, moins les 20 000 de la Caisse sur la
  // seule part de l'accident (60 000) · 80 000.
  expect(await lire('2026-09')).toMatchObject({ joursDeuxTiers: 5, salaireDesJoursDus: 630_000, deductionsCaisse: 20_000, indemniteDeuxTiers: 80_000, aRecevoirDeLaCaisse: 0 });

  // Octobre · maternité subrogée pour la rémunération entière.
  await appelApi(page, 'POST', `/personnel/absences/${maternite.id}/indemnites-caisse`, { mois: '2026-10', montant: 90_000, traitement: 'SUBROGATION', piece: 'Décision CNSS 2026-10-07' });
  expect(await lire('2026-10')).toMatchObject({ joursDeuxTiers: 0, salaireDesJoursDus: 780_000, indemniteDeuxTiers: 0, aRecevoirDeLaCaisse: 90_000 });
  // Une seconde indemnité sur le même arrêt et le même mois est refusée.
  await expect(
    appelApi(page, 'POST', `/personnel/absences/${maternite.id}/indemnites-caisse`, { mois: '2026-10', montant: 60_000, traitement: 'SUBROGATION_PARTIELLE', piece: 'Décision CNSS' }),
  ).rejects.toThrow(/déjà déclarée/);

  // Annulée, puis subrogée dans la limite des deux tiers versés.
  const ij = (await lister()).find((a) => a.id === maternite.id)!.indemnitesCaisse.find((i) => !i.annuleLe)!;
  await appelApi(page, 'POST', `/personnel/indemnites-caisse/${ij.id}/annulation`, { motif: 'La Caisse ne verse que les deux tiers' });
  await appelApi(page, 'POST', `/personnel/absences/${maternite.id}/indemnites-caisse`, { mois: '2026-10', montant: 60_000, traitement: 'SUBROGATION_PARTIELLE', piece: 'Décision CNSS 2026-10-09' });
  expect(await lire('2026-10')).toMatchObject({ joursDeuxTiers: 3, salaireDesJoursDus: 690_000, indemniteDeuxTiers: 60_000, aRecevoirDeLaCaisse: 60_000 });

  // À l'écran · l'onglet Simulation dit la déduction et la reprend au clic.
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await page.getByLabel('Mois de paie').fill('2026-09');
  await page.getByLabel('Salarié (facultatif)').selectOption({ label: 'KABEYA Ruth' });
  await expect(page.getByText('Absences et congés du mois')).toBeVisible();
  await page.getByLabel('Moyenne mensuelle des douze mois').fill('0');
  await expect(page.getByText(/après déduction de 20\s000,00 CDF versés par la Caisse/)).toBeVisible();
  await page.getByRole('button', { name: 'Reprendre au bulletin' }).click();
  const valeurs = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => (i as HTMLInputElement).value));
  expect(valeurs).toEqual(expect.arrayContaining(['630000.00', '80000.00']));
  // Octobre · la subrogation dite à l'écran.
  await page.getByLabel('Mois de paie').fill('2026-10');
  await expect(page.getByText(/60\s000,00 CDF à recevoir de la Caisse par subrogation/)).toBeVisible();

  expect(pannes).toEqual([]);
});
