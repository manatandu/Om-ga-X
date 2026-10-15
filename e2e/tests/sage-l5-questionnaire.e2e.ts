import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L5, FONCTION 85 · LE QUESTIONNAIRE SOCIÉTÉ ET SALARIÉ.
 *
 * L'assistant pose les questions de la paie et écrit les champs qui existent ·
 * paramètres du dossier (effectif permanent, affiliation CNSS de l'employeur),
 * mode de paiement du salarié, monnaie du contrat (complétée une fois), et les
 * champs de la simulation (nature INPP, effectif, classe, personnes à charge).
 * Une question sans réponse reste « pas encore dit » ; une proposition
 * (l'effectif du registre) ne s'écrit qu'au clic ; une valeur enregistrée
 * laissée sans réponse est GARDÉE, jamais effacée. Aucune écriture comptable ·
 * pas de scénario de clôture.
 */
interface Parametres { effectifPermanent: number; numeroAffiliationCnssEmployeur: string | null }
interface Questionnaire { salarie: { modePaiement: string | null; contrat: { deviseRemuneration: string | null } | null } | null }

test('SYSCOHADA · le questionnaire écrit le dossier, le salarié, le contrat et la simulation, et ne devine rien', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Questionnaire paie SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
  const s = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'KASONGO', prenoms: 'Jean', sexe: 'MASCULIN', dateNaissance: '1985-04-12' });
  // Un contrat sans montant convenu · sa monnaie n'est pas encore dite.
  await appelApi(page, 'POST', `/personnel/salaries/${s.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: '2026-01-01',
    periodiciteRemuneration: 'MOIS',
    classeProfessionnelle: 5,
  });

  // Recharger D'ABORD, puis aller par le seul fragment · recharger une
  // fenêtre qui charge coupe ses requêtes, et WebKit les rend en exceptions
  // (« due to access control checks », run 269 et run du 2026-10-15).
  await page.reload();
  await page.goto('/#/personnel?onglet=simulation');
  await expect(page.getByRole('button', { name: 'Questionnaire de paie…' })).toBeVisible();
  await page.getByLabel('Mois de paie').fill('2026-10');
  await page.getByLabel('Salarié (facultatif)').selectOption({ label: 'KASONGO Jean' });
  await page.getByRole('button', { name: 'Questionnaire de paie…' }).click();
  const modale = page.getByRole('dialog', { name: 'Questionnaire de paie' });
  const suivant = () => modale.getByRole('button', { name: 'Suivant' }).click();

  // Société.
  await expect(modale.getByText("Dit aujourd'hui · Pas encore dit")).toBeVisible();
  await modale.getByLabel("Nature de l'employeur pour la cotisation INPP", { exact: true }).selectOption('PRIVE');
  await suivant();
  await modale.getByRole('button', { name: "Reprendre l'effectif du registre (1)" }).click();
  await expect(modale.getByLabel("Effectif de l'employeur (tranche INPP, privé)", { exact: true })).toHaveValue('1');
  await suivant();
  await modale.getByLabel('Effectif permanent du dossier', { exact: true }).fill('7');
  await suivant();
  await modale.getByLabel("Numéro d'affiliation de l'employeur à la CNSS", { exact: true }).fill('CNSS-0042');
  await suivant();
  // Salarié · le régime reste « pas encore dit ».
  await suivant();
  await modale.getByLabel('Mode de paiement convenu', { exact: true }).selectOption('ESPECES');
  await suivant();
  await modale.getByLabel('Monnaie de la rémunération du contrat', { exact: true }).selectOption('CDF');
  await suivant();
  await modale.getByLabel('Classe professionnelle (1 à 17)', { exact: true }).fill('18');
  await expect(modale.getByRole('alert')).toContainText('dix-sept classes');
  await expect(modale.getByRole('button', { name: 'Suivant' })).toBeDisabled();
  await modale.getByRole('button', { name: 'Reprendre la classe du contrat (5)' }).click();
  await suivant();
  await modale.getByLabel('Personnes à charge (au 1er janvier)', { exact: true }).fill('2');
  await suivant();
  await suivant();

  // Le récapitulatif dit où chaque réponse s'écrit.
  await expect(modale.getByRole('row', { name: /Effectif permanent du dossier 7 Paramètres du dossier/ })).toBeVisible();
  await expect(modale.getByRole('row', { name: /Régime de la retenue .* Pas encore dit Inchangée/ })).toBeVisible();
  await modale.getByRole('button', { name: 'Enregistrer les réponses' }).click();
  await expect(modale.getByText('Écrit · Paramètres du dossier, Mode de paiement, Monnaie du contrat, Simulation du mois.')).toBeVisible();
  await modale.getByRole('button', { name: 'Fermer' }).last().click();

  // La simulation porte les réponses, et rien d'autre.
  await expect(page.getByLabel('Employeur INPP')).toHaveValue('PRIVE');
  await expect(page.getByLabel('Effectif (privé)')).toHaveValue('1');
  await expect(page.getByLabel('Classe professionnelle')).toHaveValue('5');
  await expect(page.getByLabel('Personnes à charge')).toHaveValue('2');
  await expect(page.getByLabel('Régime de la retenue')).toHaveValue('');

  // Le dossier, le salarié et le contrat, relus au serveur.
  const parametres = await appelApi<Parametres>(page, 'GET', '/dossier/parametres');
  expect([parametres.effectifPermanent, parametres.numeroAffiliationCnssEmployeur]).toEqual([7, 'CNSS-0042']);
  const lu = await appelApi<Questionnaire>(page, 'GET', `/personnel/questionnaire-paie?salarieId=${s.id}&mois=2026-10`);
  expect([lu.salarie?.modePaiement, lu.salarie?.contrat?.deviseRemuneration]).toEqual(['ESPECES', 'CDF']);

  // Une valeur enregistrée laissée sans réponse est GARDÉE · et la monnaie ne se change plus.
  await page.getByRole('button', { name: 'Questionnaire de paie…' }).click();
  await suivant();
  await suivant();
  await modale.getByLabel('Effectif permanent du dossier', { exact: true }).fill('');
  for (let i = 0; i < 4; i++) await suivant();
  await expect(modale.getByText('Déjà déclarée · elle ne se change plus.')).toBeVisible();
  for (let i = 0; i < 4; i++) await suivant();
  await expect(modale.getByRole('row', { name: /Effectif permanent du dossier 7 Gardée/ })).toBeVisible();
  await modale.getByRole('button', { name: 'Enregistrer les réponses' }).click();
  await expect(modale.getByText("Rien n'a changé · aucune écriture.")).toBeVisible();
  expect((await appelApi<Parametres>(page, 'GET', '/dossier/parametres')).effectifPermanent).toBe(7);

  expect(pannes).toEqual([]);
});
