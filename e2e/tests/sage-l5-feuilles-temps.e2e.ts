import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · LES FEUILLES DE TEMPS, SUR VRAIE BASE.
 *
 * Une feuille de juillet 2026 · le lundi 6, dix heures, puis huit heures du
 * mardi au samedi (Code du travail, art. 119 · deux heures au-delà de huit
 * dans la journée, 48 dans les huit, trois au-delà de quarante-cinq · cinq
 * heures supplémentaires, jamais sept). Saisies à l'écran, proposées à
 * l'onglet Simulation et reprises au clic, la majoration présélectionnée
 * parce qu'elle est seule ; la semaine du 29 juin, payée en juillet, n'est
 * couverte que du 1er au 5 · le compte se dit « au moins ». Le bulletin émis
 * garde ses heures · le jour payé ne se corrige plus.
 */
test('SYSCOHADA · feuille de temps saisie à l’écran, heures supplémentaires proposées à la simulation, jour payé figé', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Temps e2e SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'MBUYI', prenoms: 'Anne', sexe: 'FEMININ', dateNaissance: '1991-04-12' });
  await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: '2026-01-01',
    periodiciteRemuneration: 'MOIS',
    remunerationBase: 780_000,
    deviseRemuneration: 'CDF',
  });
  const hs = await appelApi<{ id: string }>(page, 'POST', '/personnel/majorations-heures', {
    nature: 'HEURES_SUPPLEMENTAIRES',
    libelle: 'Heures supplémentaires',
    tauxPourCent: 30,
    source: 'Convention collective, art. 18',
    dateEffet: '2026-01-01',
  });

  // À l'écran · onglet Feuilles de temps.
  await page.goto('/#/personnel?onglet=temps');
  // Seul salarié du registre · présélectionné.
  await expect(page.getByLabel('Salarié', { exact: true })).toHaveValue(salarie.id);
  await expect(page.getByText('Aucune feuille de temps.')).toBeVisible();
  await page.getByRole('button', { name: 'Nouveau compteur' }).click();
  const compteur = page.getByRole('dialog', { name: 'Nouveau compteur libre' });
  await compteur.getByLabel('Code', { exact: true }).fill('ASTR');
  await compteur.getByLabel('Nom', { exact: true }).fill('Astreintes');
  await compteur.getByRole('button', { name: 'Créer le compteur' }).click();
  await expect(compteur).toBeHidden();
  await expect(page.getByText('ASTR · Astreintes')).toBeVisible();

  await page.getByRole('button', { name: 'Nouvelle feuille' }).click();
  const ouverture = page.getByRole('dialog', { name: 'Nouvelle feuille de temps' });
  await ouverture.getByLabel('Premier jour', { exact: true }).fill('2026-07-01');
  await ouverture.getByLabel('Dernier jour', { exact: true }).fill('2026-07-31');
  await ouverture.getByRole('button', { name: 'Ouvrir la feuille' }).click();
  await expect(ouverture).toBeHidden();
  await expect(page.getByLabel('Heures du 2026-07-06')).toBeVisible();
  await page.getByLabel('Heures du 2026-07-06').fill('10');
  for (const j of ['07', '08', '09', '10', '11']) await page.getByLabel(`Heures du 2026-07-${j}`).fill('8');
  await page.getByLabel('Compteur ASTR du 2026-07-12').fill('5');
  // Le dimanche 12 juillet se nomme.
  await expect(page.getByRole('row').filter({ hasText: 'Dimanche' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  const feuille = page.getByRole('region', { name: 'Feuille du 01/07/2026 au 31/07/2026' });
  await expect(page.getByRole('status').filter({ hasText: 'Feuille enregistrée.' })).toBeVisible();
  // La feuille se RELIT après l'enregistrement · on attend la valeur relue et
  // le bouton revenu à l'état « rien à enregistrer » avant de retaper, sans
  // quoi la relecture écrasait la saisie suivante.
  await expect(page.getByLabel('Heures du 2026-07-06')).toHaveValue('10');
  await expect(feuille.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  await expect(page.getByLabel('Heures du 2026-07-13')).toBeEnabled();

  // La nuit au-delà de dix heures est refusée par le serveur, dite telle quelle.
  await page.getByLabel('Heures du 2026-07-13').fill('12');
  await page.getByLabel('Heures de nuit du 2026-07-13').fill('11');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('alert')).toContainText('art. 124');
  await page.getByLabel('Heures du 2026-07-13').fill('');
  await page.getByLabel('Heures de nuit du 2026-07-13').fill('');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  // Le refus n'a rien écrit (tout ou rien) · la feuille vidée du 13 est celle
  // déjà enregistrée, et c'est ce que le serveur répond.
  await expect(page.getByRole('status').filter({ hasText: 'Rien à enregistrer · la feuille était à jour.' })).toBeVisible();

  // À l'onglet Simulation · cinq heures supplémentaires, un minimum (la
  // semaine du 29 juin n'est couverte qu'à partir du 1er juillet).
  const mois = await appelApi<{ totaux: { supplementaires: number; supplementairesIncompletes: boolean }; lignes: { majorationId: string | null; heures: number }[] }>(
    page,
    'GET',
    `/personnel/salaries/${salarie.id}/feuilles-temps/mois/2026-07`,
  );
  expect(mois.totaux).toMatchObject({ supplementaires: 5, supplementairesIncompletes: true });
  expect(mois.lignes[0]).toMatchObject({ majorationId: hs.id, heures: 5 });

  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await page.getByLabel('Mois de paie').fill('2026-07');
  await page.getByLabel('Salarié (facultatif)').selectOption({ label: 'MBUYI Anne' });
  await expect(page.getByText(/aucune feuille ne couvre 2026-06-29, 2026-06-30/)).toBeVisible();
  await page.getByRole('button', { name: 'Reprendre les heures' }).click();
  await expect(page.getByLabel('Heures de la ligne 1')).toHaveValue('5');
  await expect(page.getByLabel('Taux horaire de la ligne 1')).toHaveValue('');
  // Une seconde reprise remplace la première, jamais ne double les heures.
  const lignes = mois.lignes.length;
  await page.getByRole('button', { name: 'Reprendre les heures' }).click();
  await expect(page.getByLabel(`Heures de la ligne ${lignes}`)).toBeVisible();
  await expect(page.getByLabel(`Heures de la ligne ${lignes + 1}`)).toHaveCount(0);

  // Le bulletin de juillet émis, le 7 juillet ne se corrige plus.
  await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/bulletins`, {
    moisDePaie: '2026-07',
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780_000 }],
    natureEmployeurInpp: 'PRIVE',
    effectif: 12,
    heuresMajorees: [{ majorationId: hs.id, heures: 5, tauxHoraire: 3_750 }],
  });
  const { feuilles } = await appelApi<{ feuilles: { id: string }[] }>(page, 'GET', `/personnel/salaries/${salarie.id}/feuilles-temps`);
  await expect(appelApi(page, 'PUT', `/personnel/feuilles-temps/${feuilles[0].id}/jours`, { jours: [{ jour: '2026-07-07', heures: 7 }] })).rejects.toThrow(/déjà émis/);

  expect(pannes).toEqual([]);
});
