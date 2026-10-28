import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE MICROFINA-M3 · RETENUE ÉTALÉE ET FRAIS DE MISSION, SUR VRAIE BASE.
 *
 * Une avance de 100 000 FC étalée sur trois mois dès décembre 2026 · le plan
 * se lit à l'écran (dernière échéance prenant le reste), la retenue de
 * décembre est PRÉREMPLIE à la simulation (33 333,33) sans être imposée. Une
 * mission ordonnée à l'écran, ses frais qualifiés un à un · un remboursement
 * sans pièce est refusé (loi n° 23/053, art. 68, 1°). Le bulletin de décembre
 * porte la retenue et la mission · forfait imposable, remboursement hors
 * impôt, aucun des deux dans la rémunération (Code du travail, art. 7,
 * point 8). La mission portée ne change plus.
 */
interface Avance { id: string; proposition: { montantFc: number | null } | null; plan: { echeancier: { mois: string; montantFc: number }[] } | null }
interface Bulletin { id: string; numero: number; totalVerseFc: number | string; calcul: { assiettes: { assietteSocialeFc: number; assietteFiscaleBruteFc: number } } }

test('SYSCOHADA · avance étalée préremplie au bulletin, mission ordonnée et portée au bulletin', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Personnel M3 SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'KABILA', prenoms: 'Marie', sexe: 'FEMININ', dateNaissance: '1988-03-02' });
  await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: '2026-01-01',
    periodiciteRemuneration: 'MOIS',
    remunerationBase: 780_000,
    deviseRemuneration: 'CDF',
  });
  const avance = await appelApi<{ id: string }>(page, 'POST', `/personnel/salaries/${salarie.id}/avances`, {
    type: 'AVANCE',
    dateOctroi: '2026-11-20',
    montantFc: 100_000,
    objet: 'Loyer',
    pieceJustificative: 'Reconnaissance du 20 novembre',
    premierMoisRetenue: '2026-12',
    nombreEcheances: 3,
  });
  const { avances } = await appelApi<{ avances: Avance[] }>(page, 'GET', `/personnel/avances?salarieId=${salarie.id}&moisDePaie=2026-12`);
  const lue = avances.find((a) => a.id === avance.id)!;
  expect(lue.plan?.echeancier.map((e) => e.montantFc)).toEqual([33_333.33, 33_333.33, 33_333.34]);
  expect(lue.proposition?.montantFc).toBe(33_333.33);

  // À l'écran · l'onglet Rubriques et avances dit le plan.
  await page.goto('/#/personnel?onglet=rubriques');
  await expect(page.getByText(/Étalée dès 2026-12 · 3 échéances/)).toBeVisible();

  // À l'écran · l'onglet Missions · l'ordre, puis ses frais.
  await page.goto('/#/personnel?onglet=missions');
  await expect(page.getByText('Aucune mission.')).toBeVisible();
  await page.getByLabel('Salarié en mission').selectOption({ label: 'KABILA Marie' });
  await page.getByLabel('Objet de la mission').fill('Atelier de suivi');
  await page.getByLabel('Destination').fill('Goma');
  await page.getByLabel('Date de départ').fill('2026-12-10');
  await page.getByLabel('Date de retour').fill('2026-12-14');
  await page.getByRole('button', { name: 'Ordonner la mission' }).click();
  await expect(page.getByText('n° 1', { exact: true })).toBeVisible();
  await page.getByLabel('Montant du frais de la mission 1').fill('90000');
  await page.getByRole('button', { name: 'Ajouter le frais' }).click();
  // Un remboursement sans pièce n'est pas une dépense effective.
  await expect(page.getByText(/pièce justificative/)).toBeVisible();
  await page.getByLabel('Pièce du frais de la mission 1').fill('Facture hôtel 118');
  await page.getByRole('button', { name: 'Ajouter le frais' }).click();
  await expect(page.getByRole('cell', { name: 'Facture hôtel 118' })).toBeVisible();
  await page.getByLabel('Élément de frais de la mission 1').selectOption({ label: 'Restauration' });
  await page.getByLabel('Qualification du frais de la mission 1').selectOption({ label: 'Indemnité forfaitaire' });
  await page.getByLabel('Montant du frais de la mission 1').fill('30000');
  await page.getByRole('button', { name: 'Ajouter le frais' }).click();
  await expect(page.getByText(/dont forfait imposable 30\s000,00/)).toBeVisible();

  // À l'écran · la simulation de décembre préremplit la retenue et propose la mission.
  await page.goto('/#/personnel?onglet=simulation');
  await page.getByLabel('Mois de paie').fill('2026-12');
  await page.getByLabel('Salarié (facultatif)').selectOption({ label: 'KABILA Marie' });
  await expect(page.getByLabel('Retenue sur Loyer')).toHaveValue('33333.33');
  await expect(page.getByText(/Mission n° 1 · Goma/)).toBeVisible();

  // Le bulletin · même corps que l'écran.
  const { missions } = await appelApi<{ missions: { id: string }[] }>(page, 'GET', `/personnel/missions?salarieId=${salarie.id}`);
  const bulletin = await appelApi<Bulletin>(page, 'POST', `/personnel/salaries/${salarie.id}/bulletins`, {
    moisDePaie: '2026-12',
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780_000 }],
    natureEmployeurInpp: 'PRIVE',
    effectif: 12,
    retenuesAvances: [{ avanceId: avance.id, montantFc: 33_333.33 }],
    missionsPortees: [{ missionId: missions[0].id }],
  });
  expect(Number(bulletin.totalVerseFc)).toBe(900_000);
  expect(bulletin.calcul.assiettes.assietteSocialeFc).toBe(780_000);
  expect(bulletin.calcul.assiettes.assietteFiscaleBruteFc).toBe(810_000);

  // La mission portée ne change plus · l'écran le dit, le serveur le refuse.
  await page.goto('/#/personnel?onglet=missions');
  await expect(page.getByText(`portée par le bulletin n° ${bulletin.numero} (2026-12)`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter le frais' })).toHaveCount(0);
  await expect(
    appelApi(page, 'POST', `/personnel/missions/${missions[0].id}/frais`, { element: 'DIVERS', qualification: 'FORFAIT', montantFc: 1_000 }),
  ).rejects.toThrow(/409/);

  expect(pannes).toEqual([]);
});
