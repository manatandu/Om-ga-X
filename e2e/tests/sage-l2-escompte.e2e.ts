import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * ESCOMPTE ET ÉCART DE RÈGLEMENT (ligne sage-l2, fonction 36). Un fournisseur
 * payé avant le terme accorde un escompte · le 401 est soldé du payé ET de
 * l'escompte, l'escompte au 773, la TVA qu'il ne régularise pas est dite.
 * Sans seuil, « Solder l'écart » est fermé ; le seuil fixé dans Paramètres du
 * dossier, le reste qu'un client ne paie pas passe au 6588, le 411 soldé.
 */
interface Exercice { id: string; dateDebut: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string; compteTresorerieId: string | null; estActif: boolean }
interface Ligne { compteId: string; debit: number | string; credit: number | string }
interface Ecriture { libelle: string; createdAt?: string; lignes: Ligne[] }

test('SYSCOHADA · escompte obtenu d’un fournisseur, puis écart d’un client soldé sous le seuil du dossier', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Escompte e2e SARL', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = exercice.dateDebut.slice(0, 4);

  const fournisseurCree = await appelApi<{ compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', {
    type: 'FOURNISSEUR',
    code: 'FRS-ESC',
    nom: 'Fournisseur escompte',
  });
  const clientCree = await appelApi<{ compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', {
    type: 'CLIENT',
    code: 'CLI-ESC',
    nom: 'Client écart',
  });
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const parNumero = (n: string) => comptes.find((c) => c.numero === n)!;
  const fournisseur = parNumero(fournisseurCree.compteIndividuel.numero);
  const client = parNumero(clientCree.compteIndividuel.numero);
  const achat = comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith('601'))!;
  const vente = comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith('701'))!;
  for (const c of [achat, vente]) await appelApi(page, 'PATCH', `/comptes/${c.id}`, { estRetenu: true });
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const achats = journaux.find((j) => j.type === 'ACHATS')!;
  const ventes = journaux.find((j) => j.type === 'VENTES')!;
  const tresorerie = journaux.find((j) => j.type === 'TRESORERIE' && j.estActif && j.compteTresorerieId)!;

  // La facture d'achat, à échéance du 30 avril · payée le 20 mars, avant le terme.
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: achats.id,
    date: `${annee}-03-10`,
    libelle: 'Facture escompte e2e',
    lignes: [
      { compteId: achat.id, libelle: 'Marchandises', debit: 1_160_000, credit: 0 },
      { compteId: fournisseur.id, libelle: 'Fournisseur escompte', debit: 0, credit: 1_160_000, dateEcheance: `${annee}-04-30` },
    ],
  });
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: ventes.id,
    date: `${annee}-03-12`,
    libelle: 'Facture client e2e',
    lignes: [
      { compteId: client.id, libelle: 'Client écart', debit: 500_000, credit: 0 },
      { compteId: vente.id, libelle: 'Ventes', debit: 0, credit: 500_000 },
    ],
  });

  const pieceDuReglement = async (compteTiersId: string) => {
    const { ecritures } = await appelApi<{ ecritures: Ecriture[] }>(page, 'GET', `/ecritures?exerciceId=${exercice.id}&journalId=${tresorerie.id}`);
    const e = ecritures.find((x) => x.libelle.startsWith('Règlement') && x.lignes.some((l) => l.compteId === compteTiersId));
    // L'ordre de lecture des lignes n'est pas celui de la pièce · rangées par numéro.
    return (e?.lignes ?? [])
      .map((l) => [comptes.find((c) => c.id === l.compteId)?.numero ?? l.compteId, Number(l.debit), Number(l.credit)] as [string, number, number])
      .sort((a, b) => a[0].localeCompare(b[0]));
  };

  // L'ESCOMPTE OBTENU · le payé par défaut est le dû moins l'escompte.
  await page.goto('/#/reglements');
  await page.getByLabel("Échéances jusqu'au").fill(`${annee}-12-31`);
  await page.getByLabel('Journal de trésorerie').selectOption(tresorerie.id);
  await page.getByLabel('Date du règlement').fill(`${annee}-03-20`);
  await page.getByRole('checkbox', { name: 'Régler cette facture' }).first().check();
  await page.getByLabel(`Escompte · ${fournisseur.numero}`).fill('12 000');
  await expect(page.getByLabel(`Montant réglé · ${fournisseur.numero}`)).toHaveAttribute('placeholder', /1\s148\s000,00/);
  // Aucun seuil fixé · l'écart ne se solde pas.
  await expect(page.getByLabel(`Solder l'écart · ${fournisseur.numero}`)).toBeDisabled();
  await page.getByRole('button', { name: /Enregistrer 1 règlement/ }).click();
  await expect(page.getByText(/escompte de 12\s000,00/)).toBeVisible();
  await expect(page.getByText(/ne sort de la base de la TVA que s'il figure sur une facture initiale ou rectificative/)).toBeVisible();
  await expect
    .poll(() => pieceDuReglement(fournisseur.id))
    .toEqual([
      [fournisseur.numero, 1_160_000, 0],
      [comptes.find((c) => c.id === tresorerie.compteTresorerieId)!.numero, 0, 1_148_000],
      ['77300000', 0, 12_000],
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

  // LE SEUIL DU DOSSIER · Paramètres du dossier, Régime fiscal.
  await page.goto('/#/parametres-dossier');
  await page.getByRole('button', { name: 'Régime fiscal' }).click();
  const seuil = page.getByLabel('Seuil de l’écart de règlement');
  await seuil.fill('1 000');
  await seuil.locator('..').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText(/Les écarts de règlement jusqu’à 1\s000,00 se passent en charge/)).toBeVisible();

  // LE RESTE QU'UN CLIENT NE PAIE PAS · 600 au 6588, le 411 soldé.
  await page.goto('/#/reglements');
  await page.getByLabel('Sens du règlement').selectOption('CLIENT');
  await page.getByLabel("Échéances jusqu'au").fill(`${annee}-12-31`);
  await page.getByLabel('Journal de trésorerie').selectOption(tresorerie.id);
  await page.getByLabel('Date du règlement').fill(`${annee}-03-25`);
  await page.getByRole('checkbox', { name: 'Régler cette facture' }).first().check();
  await page.getByLabel(`Montant réglé · ${client.numero}`).fill('499 400');
  await page.getByLabel(`Solder l'écart · ${client.numero}`).check();
  await page.getByRole('button', { name: /Enregistrer 1 règlement/ }).click();
  await expect(page.getByText(/écart de règlement de 600,00 en charge/)).toBeVisible();
  await expect
    .poll(() => pieceDuReglement(client.id))
    .toEqual([
      [comptes.find((c) => c.id === tresorerie.compteTresorerieId)!.numero, 499_400, 0],
      ['65880000', 600, 0],
      [client.numero, 0, 500_000],
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  expect(pannes).toEqual([]);
});
