import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LA DUPLICATION D'UN TIERS (ligne sage-l2, fonction 32). « Dupliquer… »
 * remplit le formulaire de création de la copie · nom, qualité,
 * coordonnées, modèle et mode de règlement repris ; Numéro Impôt et RIB non
 * repris, et la fenêtre le dit ; rien n'est écrit avant « Créer le tiers ».
 */
interface Tiers {
  id: string;
  code: string;
  nom: string;
  qualite: string | null;
  ville: string | null;
  numeroImpot: string | null;
  modeleReglementId: string | null;
  modeReglementId: string | null;
}

test('SYSCOHADA · un fournisseur se duplique, sans son Numéro Impôt ni son RIB', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Duplication e2e SARL', montant: 1_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'POST', '/modes-reglement/usuels', {});
  const vir = (await appelApi<Array<{ id: string; code: string }>>(page, 'GET', '/modes-reglement')).find((m) => m.code === 'VIR')!;
  const modele = await appelApi<{ id: string }>(page, 'POST', '/modeles-reglement', { intitule: '30 jours net', delaiJours: 30, echeance: 'NET' });
  const source = await appelApi<{ id: string }>(page, 'POST', '/tiers', {
    type: 'FOURNISSEUR',
    code: 'FRS-SRC',
    nom: 'Imprimerie du Fleuve',
    qualite: 'Société',
    ville: 'Kinshasa',
    numeroImpot: 'A1234567B',
    modeleReglementId: modele.id,
    modeReglementId: vir.id,
  });
  await appelApi(page, 'POST', `/tiers/${source.id}/ribs`, { banque: 'Rawbank', numeroCompte: '0001234' });
  const tous = () => appelApi<Tiers[]>(page, 'GET', '/tiers');
  const avant = (await tous()).length;

  await page.goto('/#/tiers');
  await page.getByRole('button', { name: /FRS-SRC/ }).click();
  await page.getByRole('button', { name: 'Dupliquer…' }).click();
  await expect(page.getByText('Copie de FRS-SRC')).toBeVisible();
  await expect(page.getByText(/Non repris · .*Numéro Impôt \(identifiant propre à chaque contribuable\).*Coordonnées bancaires/)).toBeVisible();
  // Rien n'est écrit avant la confirmation.
  expect((await tous()).length).toBe(avant);

  await page.getByPlaceholder('ex. CLI-0001').fill('FRS-COPIE');
  await page.getByRole('button', { name: 'Créer le tiers' }).click();
  await expect.poll(async () => (await tous()).find((t) => t.code === 'FRS-COPIE')).toEqual(
    expect.objectContaining({
      nom: 'Imprimerie du Fleuve',
      qualite: 'Société',
      ville: 'Kinshasa',
      numeroImpot: null,
      modeleReglementId: modele.id,
      modeReglementId: vir.id,
    }),
  );
  const copie = (await tous()).find((t) => t.code === 'FRS-COPIE')!;
  expect(await appelApi<unknown[]>(page, 'GET', `/tiers/${copie.id}/ribs`)).toEqual([]);
  expect(pannes).toEqual([]);
});
