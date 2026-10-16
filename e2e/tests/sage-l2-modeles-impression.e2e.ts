import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LES MODÈLES D'IMPRESSION DU TIERS (ligne sage-l2, fonction 27). Un modèle
 * sans {document} est refusé à l'écran ; le modèle de rappel choisi sur la
 * fiche d'un client habille sa lettre de relance, et le modèle d'avis choisi
 * sur la fiche d'un fournisseur habille l'avis de règlement de son ordre de
 * virement imprimé, qui porte les factures que le paiement acquitte. Un
 * modèle d'une autre nature est refusé sur la fiche ; un modèle choisi ne se
 * supprime pas.
 */
interface Exercice { id: string; dateDebut: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string }
interface Modele { id: string; nature: string; intitule: string; nombreTiers: number }
interface Tiers { id: string; code: string; modeleImpressionRappelId: string | null }
interface Groupe { compteId: string; lignes: Array<{ id: string }> }

test('SYSCOHADA · le rappel et l’avis de règlement habillés du modèle de leur tiers', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Impression e2e SARL', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = exercice.dateDebut.slice(0, 4);

  // LE MODÈLE DE RAPPEL, à l'écran · sans {document}, refusé et dit.
  await page.goto('/#/modeles-impression');
  await page.getByRole('button', { name: 'Nouveau modèle' }).click();
  await page.getByLabel('Document du modèle').selectOption('RAPPEL');
  await page.getByLabel('Intitulé du modèle').fill('Contrat cadre');
  await page.getByLabel('Texte du modèle').fill('À l’attention de {contact}');
  await page.getByRole('button', { name: 'Enregistrer le modèle' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /sans ce qu'elle réclame ou acquitte/ })).toBeVisible();
  await page.getByLabel('Texte du modèle').fill('À l’attention de {contact}\n\n{document}\n\nRéf. contrat 2026-07');
  await page.getByRole('button', { name: 'Enregistrer le modèle' }).click();
  await expect(page.getByText('Modèle créé.')).toBeVisible();
  const avisModele = await appelApi<{ id: string }>(page, 'POST', '/modeles-impression', {
    nature: 'REGLEMENT',
    intitule: 'Avis fournisseurs',
    texte: 'Service fournisseurs\n{document}\nCopie : direction',
  });
  const rappel = (await appelApi<Modele[]>(page, 'GET', '/modeles-impression')).find((m) => m.intitule === 'Contrat cadre')!;

  const client = await appelApi<{ id: string; compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', {
    type: 'CLIENT',
    code: 'CLI-IMP',
    nom: 'Brasserie du Fleuve',
    contact: 'Mme Mbuyi',
  });
  const fournisseur = await appelApi<{ id: string; compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', {
    type: 'FOURNISSEUR',
    code: 'FRS-IMP',
    nom: 'Imprimerie du Fleuve',
    ville: 'Kinshasa',
  });

  // UN MODÈLE SE CHOISIT DANS LA ZONE DE SA NATURE · refusé au serveur.
  const refus = await appelApi(page, 'PATCH', `/tiers/${client.id}`, { modeleImpressionRappelId: avisModele.id }).then(
    () => 'accepté',
    (e: unknown) => String(e),
  );
  expect(refus).toMatch(/pas le rappel/);

  // Le modèle de rappel, choisi sur la fiche du client.
  await page.goto('/#/tiers');
  await page.getByRole('button', { name: /CLI-IMP/ }).click();
  await page.getByLabel('Modèle rappel du tiers', { exact: true }).selectOption(rappel.id);
  await expect
    .poll(async () => (await appelApi<Tiers[]>(page, 'GET', '/tiers')).find((t) => t.code === 'CLI-IMP')?.modeleImpressionRappelId)
    .toBe(rappel.id);
  await appelApi(page, 'PATCH', `/tiers/${fournisseur.id}`, { modeleImpressionReglementId: avisModele.id });

  // CHOISI, IL NE SE SUPPRIME PAS.
  const suppression = await appelApi(page, 'DELETE', `/modeles-impression/${rappel.id}`).then(
    () => 'supprimé',
    (e: unknown) => String(e),
  );
  expect(suppression).toMatch(/sur la fiche de ces tiers/);

  // Une vente échue au client, un achat au fournisseur.
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const parNumero = (n: string) => comptes.find((c) => c.numero === n)!;
  const achat = comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith('601'))!;
  const vente = comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith('701'))!;
  for (const c of [achat, vente]) await appelApi(page, 'PATCH', `/comptes/${c.id}`, { estRetenu: true });
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const bq = journaux.find((j) => j.code === 'BQ')!;
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: journaux.find((j) => j.type === 'VENTES')!.id,
    date: `${annee}-02-10`,
    libelle: 'Facture client e2e',
    lignes: [
      { compteId: parNumero(client.compteIndividuel.numero).id, libelle: 'Brasserie du Fleuve', debit: 500_000, credit: 0, dateEcheance: `${annee}-03-10` },
      { compteId: vente.id, libelle: 'Ventes', debit: 0, credit: 500_000 },
    ],
  });
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: journaux.find((j) => j.type === 'ACHATS')!.id,
    date: `${annee}-02-12`,
    libelle: 'Facture fournisseur e2e',
    lignes: [
      { compteId: achat.id, libelle: 'Fournitures', debit: 1_160_000, credit: 0 },
      { compteId: parNumero(fournisseur.compteIndividuel.numero).id, libelle: 'Imprimerie du Fleuve', debit: 0, credit: 1_160_000, dateEcheance: `${annee}-03-12` },
    ],
  });

  // LE RAPPEL · la lettre du niveau, habillée du modèle du client.
  await page.goto('/#/relances');
  await page.getByLabel(`Sélectionner le compte ${client.compteIndividuel.numero}`).check();
  await page.getByRole('button', { name: 'Préparer les courriers (1)' }).click();
  await expect(page.getByText('modèle « Contrat cadre »')).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: /^À l’attention de Mme Mbuyi\n\n[\s\S]*Réf\. contrat 2026-07$/ })).toBeVisible();

  // L'AVIS DE RÈGLEMENT · l'ordre de virement du fournisseur, imprimé.
  const banque = await appelApi<{ id: string }>(page, 'POST', '/banques', { intitule: 'Rawbank' });
  await appelApi(page, 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW', numeroCompte: '0001234', journalId: bq.id });
  await appelApi(page, 'POST', `/tiers/${fournisseur.id}/ribs`, { banque: 'Equity BCDC', numeroCompte: '0009876' });
  const compteFournisseur = parNumero(fournisseur.compteIndividuel.numero).id;
  const groupes = await appelApi<Groupe[]>(page, 'GET', `/reglements/echeances?exerciceId=${exercice.id}&sens=FOURNISSEUR`);
  const facture = groupes.find((g) => g.compteId === compteFournisseur)!.lignes[0];
  const r = await appelApi<{ ordre: { id: string; numero: number } }>(page, 'POST', '/reglements', {
    exerciceId: exercice.id,
    journalId: bq.id,
    sens: 'FOURNISSEUR',
    date: `${annee}-03-15`,
    ordreVirement: true,
    reglements: [{ compteId: compteFournisseur, ligneIds: [facture.id], montant: 1_160_000, imputation: [{ ligneId: facture.id, montant: 1_160_000 }] }],
  });
  // Avant l'impression de l'ordre, aucun avis · la banque n'a rien reçu.
  const avant = await appelApi(page, 'GET', `/ordres-virement/${r.ordre.id}/avis-reglement`).then(
    () => 'servi',
    (e: unknown) => String(e),
  );
  expect(avant).toMatch(/pas encore imprimé/);
  await appelApi(page, 'POST', `/ordres-virement/${r.ordre.id}/impression`, {});

  await page.goto('/#/reglements');
  await page.getByRole('tab', { name: 'Ordres de virement' }).click();
  // La première cellule de la ligne est le numéro de l'ordre.
  await page.getByRole('cell', { name: String(r.ordre.numero), exact: true }).first().click();
  await page.getByRole('button', { name: 'Avis de règlement', exact: true }).click();
  await expect(page.getByText('modèle « Avis fournisseurs »')).toBeVisible();
  const avis = page.locator('article pre').filter({ hasText: 'Imprimerie du Fleuve' }).or(page.locator('article pre').filter({ hasText: 'Service fournisseurs' }));
  await expect(avis.first()).toContainText(`ordre de virement n° ${r.ordre.numero}`);
  await expect(avis.first()).toContainText('Factures payées');
  await expect(avis.first()).toContainText('Copie : direction');
  await expect(page.getByRole('button', { name: 'Imprimer les avis' })).toBeVisible();
  expect(pannes).toEqual([]);
});
