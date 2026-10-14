import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 2 · LES HEURES MAJORÉES, SUR VRAIE BASE.
 *
 * Aucun taux n'est au corpus (Code du travail, art. 120, e) et 124) · le
 * cabinet déclare 30 % pour les heures supplémentaires et 25 % pour la nuit,
 * avec leur source, refusés sans elle. Le bulletin d'août porte 10 heures
 * supplémentaires à 3 750 (entières et majorées · 48 750) et 8 heures de nuit
 * dans l'horaire (le seul supplément · 7 500) · 780 000 + 48 750 + 7 500 =
 * 836 250 versés, simulés puis émis ; une ligne d'heures incomplète est dite
 * à l'écran, jamais envoyée à moitié.
 */
interface Majoration { id: string; nature: string }
interface Bulletin { id: string; numero: number; totalVerseFc: number }

test('SYSCOHADA · majorations déclarées avec leur source, heures majorées simulées à l’écran et portées au bulletin', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Heures e2e SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'TSHIBANDA', prenoms: 'Paul', sexe: 'MASCULIN', dateNaissance: '1988-05-03' });
  await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: '2026-01-01',
    periodiciteRemuneration: 'MOIS',
    remunerationBase: 780_000,
    deviseRemuneration: 'CDF',
  });

  // À l'écran · onglet Barèmes, la majoration déclarée avec sa source.
  await page.goto('/#/personnel?onglet=baremes');
  await expect(page.getByText('Aucune majoration déclarée.')).toBeVisible();
  await page.getByLabel('Nature de la majoration').selectOption({ label: 'Heures supplémentaires' });
  await page.getByLabel('Intitulé de la majoration').fill('Heures supplémentaires de jour');
  await page.getByLabel('Taux de majoration').fill('30');
  await page.getByLabel("Date d'effet de la majoration").fill('2026-01-01');
  await page.getByRole('button', { name: 'Déclarer la majoration' }).click();
  await expect(page.getByRole('alert')).toContainText('source');
  await page.getByLabel('Source du taux').fill('Convention collective de la branche, art. 18');
  await page.getByRole('button', { name: 'Déclarer la majoration' }).click();
  await expect(page.getByRole('cell', { name: 'Heures supplémentaires de jour' })).toBeVisible();

  // Sans source, le serveur refuse aussi.
  await expect(
    appelApi(page, 'POST', '/personnel/majorations-heures', { nature: 'TRAVAIL_DE_NUIT', libelle: 'Nuit', tauxPourCent: 25, source: '', dateEffet: '2026-01-01' }),
  ).rejects.toThrow(/400/);
  await appelApi(page, 'POST', '/personnel/majorations-heures', {
    nature: 'TRAVAIL_DE_NUIT',
    libelle: 'Travail de nuit',
    tauxPourCent: 25,
    source: "Règlement d'entreprise, art. 9",
    dateEffet: '2026-01-01',
  });
  const { majorations } = await appelApi<{ majorations: Majoration[] }>(page, 'GET', '/personnel/majorations-heures');
  const hs = majorations.find((m) => m.nature === 'HEURES_SUPPLEMENTAIRES')!;
  const nuit = majorations.find((m) => m.nature === 'TRAVAIL_DE_NUIT')!;

  // À l'écran · onglet Simulation.
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await page.getByLabel('Mois de paie').fill('2026-08');
  await page.getByLabel('Salarié (facultatif)').selectOption({ label: 'TSHIBANDA Paul' });
  await page.getByRole('button', { name: 'Ajouter des heures' }).click();
  await page.getByLabel('Majoration de la ligne 1').selectOption({ label: 'Heures supplémentaires de jour · 30 %' });
  await page.getByLabel('Heures de la ligne 1').fill('10');
  await page.getByLabel('Taux horaire de la ligne 1').fill('3750');
  await page.getByRole('button', { name: 'Ajouter des heures' }).click();
  await page.getByLabel('Majoration de la ligne 2').selectOption({ label: 'Travail de nuit · 25 %' });
  await page.getByLabel('Heures de la ligne 2').fill('8');
  // Une ligne incomplète ne part pas · elle est dite.
  await page.getByRole('button', { name: 'Simuler', exact: true }).click();
  await expect(page.getByText(/ligne\(s\) d'heures majorées incomplète/)).toBeVisible();
  await page.getByLabel('Taux horaire de la ligne 2').fill('3750');
  await page.getByRole('button', { name: 'Simuler', exact: true }).click();
  await expect(page.getByText(/ligne\(s\) d'heures majorées incomplète/)).toBeHidden();

  // Le montant, rejoué au serveur sur le corps que l'écran envoie.
  const corps = {
    moisDePaie: '2026-08',
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780_000 }],
    natureEmployeurInpp: 'PRIVE',
    effectif: 12,
    heuresMajorees: [
      { majorationId: hs.id, heures: 10, tauxHoraire: 3_750 },
      { majorationId: nuit.id, heures: 8, tauxHoraire: 3_750 },
    ],
  };
  const simulation = await appelApi<{ net: { totalVerseFc: number } }>(page, 'POST', `/personnel/simulation?salarieId=${salarie.id}`, corps);
  expect(simulation.net.totalVerseFc).toBe(836_250);

  // Émis, le bulletin verse le même total.
  const b = await appelApi<Bulletin>(page, 'POST', `/personnel/salaries/${salarie.id}/bulletins`, corps);
  const { bulletins } = await appelApi<{ bulletins: Bulletin[] }>(page, 'GET', '/personnel/bulletins?mois=2026-08');
  expect(bulletins.find((x) => x.id === b.id)?.totalVerseFc).toBe(836_250);

  // Désactivée, la majoration ne se porte plus.
  await appelApi(page, 'POST', `/personnel/majorations-heures/${nuit.id}/desactivation`, {});
  await expect(appelApi(page, 'POST', `/personnel/simulation?salarieId=${salarie.id}`, corps)).rejects.toThrow(/désactivée/);

  expect(pannes).toEqual([]);
});
