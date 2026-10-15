import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * L'ASSISTANT DE RÈGLEMENT (ligne sage-l2, fonction 18, part règlement). Le
 * règlement d'un fournisseur, une étape à la fois · le même `POST
 * /reglements` que le formulaire, la pièce au journal de trésorerie, la
 * facture lettrée en partiel. Plus que le dû est refusé par le serveur, et
 * le refus se dit au récapitulatif. « Régler un autre tiers » relit les
 * factures ouvertes.
 */
interface Exercice { id: string; dateDebut: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string; compteTresorerieId: string | null; estActif: boolean }
interface Ligne { compteId: string; debit: number | string; credit: number | string }
interface Ecriture { libelle: string; reference: string | null; lignes: Ligne[] }

test('SYSCOHADA · un fournisseur réglé par l’assistant, en partiel, puis un montant au-delà du dû refusé', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Assistant règlement e2e SARL', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = exercice.dateDebut.slice(0, 4);

  const cree = await appelApi<{ compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', { type: 'FOURNISSEUR', code: 'FRS-ASR', nom: 'Imprimerie du Fleuve' });
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const fournisseur = comptes.find((c) => c.numero === cree.compteIndividuel.numero)!;
  const achat = comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith('601'))!;
  await appelApi(page, 'PATCH', `/comptes/${achat.id}`, { estRetenu: true });
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const tresorerie = journaux.find((j) => j.type === 'TRESORERIE' && j.estActif && j.compteTresorerieId)!;
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: journaux.find((j) => j.type === 'ACHATS')!.id,
    date: `${annee}-03-10`,
    libelle: 'Factures assistant e2e',
    lignes: [
      { compteId: achat.id, libelle: 'Fournitures', debit: 1_660_000, credit: 0 },
      { compteId: fournisseur.id, libelle: 'Facture A', debit: 0, credit: 1_160_000, dateEcheance: `${annee}-04-10` },
      { compteId: fournisseur.id, libelle: 'Facture B', debit: 0, credit: 500_000, dateEcheance: `${annee}-05-10` },
    ],
  });

  await page.goto('/#/reglements');
  await page.getByRole('button', { name: 'Assistant de règlement…' }).click();
  const assistant = page.getByRole('dialog', { name: 'Assistant de règlement' });
  const suivant = () => assistant.getByRole('button', { name: 'Suivant' }).click();

  // 1. Sens · fournisseur, par défaut. 2. Trésorerie.
  await suivant();
  await assistant.getByLabel('Date du règlement').fill(`${annee}-03-20`);
  await assistant.getByLabel('Journal de trésorerie').selectOption(tresorerie.id);
  await suivant();
  // 3. Le seul fournisseur à régler est présélectionné.
  await expect(assistant.getByLabel('Tiers à régler')).toHaveValue(fournisseur.id);
  await suivant();
  // 4. Factures · aucune cochée d'office ; Suivant reste fermé.
  await expect(assistant.getByRole('button', { name: 'Suivant' })).toBeDisabled();
  await assistant.getByLabel('Facture Facture A').check();
  await suivant();
  // 5. Montant prérempli au dû, ramené à un partiel.
  await expect(assistant.getByLabel('Montant réglé')).toHaveValue('1160000.00');
  await assistant.getByLabel('Montant réglé').fill('1 000 000');
  await assistant.getByLabel('Référence').fill('VIR-AS-1');
  await suivant();
  await assistant.getByRole('button', { name: 'Passer le règlement' }).click();
  await expect(assistant.getByText(/^Règlement de 1\s000\s000,00 passé au brouillard et lettré \(partiel, lettrage partiel\)\.$/)).toBeVisible();

  // La pièce · le 401 débité du réglé, la trésorerie créditée, la référence portée.
  const { ecritures } = await appelApi<{ ecritures: Ecriture[] }>(page, 'GET', `/ecritures?exerciceId=${exercice.id}&journalId=${tresorerie.id}`);
  const piece = ecritures.find((e) => e.reference === 'VIR-AS-1')!;
  expect(piece.lignes.map((l) => [l.compteId === fournisseur.id ? '401' : 'tresorerie', Number(l.debit), Number(l.credit)]).sort()).toEqual([
    ['401', 1_000_000, 0],
    ['tresorerie', 0, 1_000_000],
  ]);

  // « Régler un autre tiers » · la séance gardée, les factures relues.
  await assistant.getByRole('button', { name: 'Régler un autre tiers' }).click();
  await expect(assistant.getByLabel('Tiers à régler')).toHaveValue(fournisseur.id);
  await suivant();
  await assistant.getByLabel('Facture Facture B').check();
  await suivant();
  await assistant.getByLabel('Montant réglé').fill('600000');
  await suivant();
  await assistant.getByRole('button', { name: 'Passer le règlement' }).click();
  await expect(assistant.getByRole('alert')).toContainText('dépasse le dû des factures choisies');
  await assistant.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByText(/Imprimerie du Fleuve · Règlement de 1\s000\s000,00/)).toBeVisible();
  expect(pannes).toEqual([]);
});
