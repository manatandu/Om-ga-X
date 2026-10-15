import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, rechargerAuRepos, seConnecter, surveiller } from './outils';

/**
 * CRÉER UN COMPTE PENDANT LA SAISIE (ligne sage-l1, fonction 14 · option du
 * dossier). Sous l'option, un numéro tapé dans la grille et inconnu du
 * dossier s'offre à la création ; la boîte nomme le compte du plan qu'il
 * subdivise, le compte naît personnalisé et la grille le prend aussitôt.
 * Sans l'option, rien n'est offert.
 */
interface Journal { id: string; code: string; type: string }
interface Compte { id: string; numero: string; intitule: string; estRetenu?: boolean }

test('SYSCOHADA · un numéro inconnu tapé en saisie s’ouvre en sous-compte du plan', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Compte en saisie e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);

  const plan = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  // Un compte d'imputation du plan sous le 605, tel que le dossier l'a reçu.
  const duPlan = plan.find((c) => c.numero.startsWith('605') && /0000$/.test(c.numero))!;
  const numero = `${(duPlan.numero.replace(/0+$/, '') + '00000000').slice(0, 7)}5`;
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];

  const ouvrir = async () => {
    await page.goto('/#/saisie');
    await page.getByRole('button', { name: od.code, exact: true }).first().click();
    await page.getByLabel('Saisie par pièce').check();
    await page.getByRole('button', { name: 'Ouvrir le journal' }).click();
    await expect(page.getByText('Pièce en cours de saisie')).toBeVisible();
  };

  // Sans l'option · le numéro inconnu n'offre rien.
  await ouvrir();
  const compte = page.getByPlaceholder('n° ou F4');
  await compte.fill(numero);
  await expect(page.getByText(`Compte ${numero} inconnu du plan du dossier.`)).toHaveCount(0);

  await appelApi(page, 'PATCH', '/dossier/creation-compte-en-saisie', { creationCompteEnSaisie: true });
  await rechargerAuRepos(page);
  await ouvrir();
  await compte.fill(numero);
  await expect(page.getByText(`Compte ${numero} inconnu du plan du dossier.`)).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Créer le compte' }).click();

  const boite = page.getByRole('dialog', { name: 'Nouveau compte' });
  await expect(boite.getByText(`${duPlan.numero} ${duPlan.intitule}`)).toBeVisible();
  await expect(boite.getByLabel('Intitulé :')).toHaveValue(duPlan.intitule);
  await boite.getByLabel('Intitulé :').fill('Fournitures du dépôt');
  await boite.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(boite).toHaveCount(0);
  // La grille a pris le compte créé.
  await expect(page.getByText('Fournitures du dépôt', { exact: true })).toBeVisible();

  const proposes = await appelApi<Compte[]>(page, 'GET', '/comptes?actifsSeuls=true&typeCompte=DETAIL&retenus=true');
  expect(proposes.find((c) => c.numero === numero)).toMatchObject({ intitule: 'Fournitures du dépôt' });

  expect(pannes).toEqual([]);
});
