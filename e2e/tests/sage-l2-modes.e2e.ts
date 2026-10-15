import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LES MODES DE RÈGLEMENT (ligne sage-l2, fonction 1). Les modes usuels se
 * créent d'un geste dans Structure > Paramètres de saisie, un mode se pose
 * sur la fiche du tiers, un mode porté ne se supprime pas, et le règlement
 * d'une facture fournisseur de 1 500 000 FC en espèces est AVERTI (O.-L.
 * n° 10/001, art. 59 bis et 74 bis), passé, chaque ligne portant le mode.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string; compteTresorerieId: string | null; estActif: boolean }
interface Mode { id: string; code: string; intitule: string; nature: string }
interface Tiers { id: string; code: string; modeReglementId: string | null }

test('SYSCOHADA · modes usuels, mode du tiers, et l’avertissement du paiement en espèces', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Modes e2e SARL', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);

  await page.goto('/#/modes-reglement');
  await expect(page.getByText('Aucun mode de règlement.')).toBeVisible();
  await page.getByRole('button', { name: 'Créer les modes usuels' }).click();
  await expect(page.getByText('Créés · Espèces, Chèque, Virement bancaire, Carte bancaire, Monnaie électronique.')).toBeVisible();
  await expect(page.getByLabel('Intitulé du mode ESP')).toHaveValue('Espèces');

  // Un mode propre au cabinet.
  await page.getByLabel('Code du nouveau mode').fill('mps');
  await page.getByLabel('Intitulé du nouveau mode').fill('M-Pesa');
  await page.getByLabel('Nature du nouveau mode').selectOption({ label: 'Monnaie électronique' });
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByLabel('Intitulé du mode MPS')).toHaveValue('M-Pesa');
  const modes = await appelApi<Mode[]>(page, 'GET', '/modes-reglement');
  const especes = modes.find((m) => m.code === 'ESP')!;
  expect(modes.find((m) => m.code === 'MPS')?.nature).toBe('MONNAIE_ELECTRONIQUE');

  // LE MODE HABITUEL DU TIERS · posé sur sa fiche.
  const cree = await appelApi<{ id: string; compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', {
    type: 'FOURNISSEUR',
    code: 'FRS-MODES',
    nom: 'Fournisseur des modes',
  });
  await page.goto('/#/tiers');
  await page.getByRole('button', { name: /FRS-MODES/ }).click();
  await page.getByLabel('Mode de règlement du tiers').selectOption({ label: 'ESP · Espèces' });
  await expect
    .poll(async () => (await appelApi<Tiers[]>(page, 'GET', '/tiers')).find((t) => t.id === cree.id)?.modeReglementId)
    .toBe(especes.id);

  // Un mode porté ne se supprime pas · le refus nomme l'usage et l'issue.
  await page.goto('/#/modes-reglement');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('row', { name: /ESP/ }).getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByText(/Le mode de règlement ESP.*sommeil/)).toBeVisible();

  // LA FACTURE DE 1 500 000 FC, RÉGLÉE EN ESPÈCES · avertie, passée.
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const fournisseur = comptes.find((c) => c.numero === cree.compteIndividuel.numero)!;
  const achat = comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith('601'))!;
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const achats = journaux.find((j) => j.type === 'ACHATS')!;
  const tresorerie = journaux.find((j) => j.type === 'TRESORERIE' && j.estActif && j.compteTresorerieId)!;
  const dateFacture = `${exercice.dateDebut.slice(0, 4)}-03-10`;
  const dateReglement = `${exercice.dateDebut.slice(0, 4)}-03-20`;
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: achats.id,
    date: dateFacture,
    libelle: 'Facture modes e2e',
    lignes: [
      { compteId: achat.id, libelle: 'Marchandises', debit: 1_500_000, credit: 0 },
      { compteId: fournisseur.id, libelle: 'Fournisseur des modes', debit: 0, credit: 1_500_000 },
    ],
  });

  await page.goto('/#/reglements');
  await page.getByLabel("Échéances jusqu'au").fill(dateReglement);
  await page.getByLabel('Journal de trésorerie').selectOption(tresorerie.id);
  await page.getByLabel('Mode de règlement', { exact: true }).selectOption({ label: 'ESP · Espèces' });
  await page.getByLabel('Date du règlement').fill(dateReglement);
  await page.getByRole('checkbox', { name: 'Régler cette facture' }).first().check();
  await page.getByRole('button', { name: /Enregistrer 1 règlement/ }).click();
  await expect(page.getByText(/art\. 59 bis/)).toBeVisible();
  await expect(page.getByText(/1 règlement\(s\) passé\(s\) au brouillard/)).toBeVisible();

  // CHAQUE LIGNE DE LA PIÈCE PORTE LE MODE.
  const { ecritures } = await appelApi<{ ecritures: Array<{ libelle: string; lignes: Array<{ modeReglementId: string | null }> }> }>(
    page,
    'GET',
    `/ecritures?exerciceId=${exercice.id}`,
  );
  const reglement = ecritures.find((e) => e.libelle.startsWith('Règlement'))!;
  expect(reglement.lignes.map((l) => l.modeReglementId)).toEqual(reglement.lignes.map(() => especes.id));
  expect(pannes).toEqual([]);
});
