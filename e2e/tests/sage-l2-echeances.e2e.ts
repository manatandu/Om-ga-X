import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * L'ÉCHÉANCIER DU MODÈLE DE RÈGLEMENT EN SAISIE (ligne sage-l2, fonction 3).
 * Un fournisseur porte un modèle « moitié à 30 jours, le reste à 60 » ; la
 * ligne de sa facture ouvre la fenêtre des échéances, refuse un découpage qui
 * ne refait pas la ligne au centime, et se découpe en deux lignes datées et
 * munies de leur mode. Coché « Échéancier appliqué d'office », la facture
 * suivante se découpe sans fenêtre, et la saisie l'annonce.
 */
interface Exercice { id: string; dateDebut: string }
interface Journal { id: string; code: string; type: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Mode { id: string; code: string }
interface Ligne { compteId: string; debit: number | string; credit: number | string; dateEcheance: string | null; modeReglementId: string | null }
interface Ecriture { libelle: string; reference: string | null; lignes: Ligne[] }

test('SYSCOHADA · la facture d’un fournisseur se découpe selon son modèle de règlement', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Échéances e2e SARL', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = exercice.dateDebut.slice(0, 4);

  await appelApi(page, 'POST', '/modes-reglement/usuels', {});
  const vir = (await appelApi<Mode[]>(page, 'GET', '/modes-reglement')).find((m) => m.code === 'VIR')!;
  const modele = await appelApi<{ id: string }>(page, 'POST', '/modeles-reglement', { intitule: 'Moitié 30, reste 60', delaiJours: 30, echeance: 'NET' });
  await appelApi(page, 'POST', `/modeles-reglement/${modele.id}/echeances`, {
    ordre: 1,
    type: 'POURCENTAGE',
    valeur: 50,
    delaiJours: 30,
    echeance: 'NET',
    modeReglementId: vir.id,
  });
  await appelApi(page, 'POST', `/modeles-reglement/${modele.id}/echeances`, { ordre: 2, type: 'EQUILIBRE', delaiJours: 60, echeance: 'NET' });
  const tiers = await appelApi<{ id: string; compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', {
    type: 'FOURNISSEUR',
    code: 'FRS-ECH',
    nom: 'Fournisseur à échéances',
    modeleReglementId: modele.id,
  });
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const achat = comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith('601'))!;
  await appelApi(page, 'PATCH', `/comptes/${achat.id}`, { estRetenu: true });
  const fournisseur = comptes.find((c) => c.numero === tiers.compteIndividuel.numero)!;
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const achats = journaux.find((j) => j.type === 'ACHATS')!;

  await page.goto('/#/saisie');
  await page.getByRole('button', { name: achats.code, exact: true }).first().click();
  await page.getByLabel('Saisie par pièce').check();
  await page.getByRole('button', { name: 'Ouvrir le journal' }).click();
  await expect(page.getByText('Pièce en cours de saisie')).toBeVisible();

  const compte = page.getByPlaceholder('n° ou F4');
  const ligne = async (numero: string, sens: 'debit' | 'credit', montant: number) => {
    await compte.fill(numero);
    await compte.press('Enter');
    await page.getByPlaceholder('libellé de la ligne').fill('Facture à échéances');
    const champs = page.locator('input[type=number][step="0.01"]');
    await champs.nth(sens === 'debit' ? 0 : 1).fill(String(montant));
    await page.getByTitle('Valider la ligne (Entrée)').click();
  };
  const piece = async (reference: string) => {
    await page.getByLabel('Date de la pièce').fill(`${annee}-03-10`);
    await page.getByPlaceholder('n° facture, chèque…').fill(reference);
    await ligne(achat.numero, 'debit', 1_160_000);
    await ligne(fournisseur.numero, 'credit', 1_160_000);
  };

  // LA FENÊTRE DES ÉCHÉANCES · le modèle propose deux moitiés. Elle est
  // ANNONCÉE, jamais ouverte en pleine frappe (second tour de relecture, M1
  // et mineur 2), et la pièce ne part pas tant qu'elle attend.
  await piece('ECH-1');
  const annonce = page.getByRole('status').filter({ hasText: /découpe la ligne en 2 échéances/ });
  await expect(annonce).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer la pièce' })).toBeDisabled();
  const fenetre = page.getByRole('dialog', { name: 'Échéances de la ligne' });
  await expect(fenetre).toHaveCount(0);
  await annonce.getByRole('button', { name: 'Ouvrir les échéances' }).click();
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByLabel("Montant de l'échéance 1")).toHaveValue('580000.00');
  await expect(fenetre.getByLabel("Date de l'échéance 1")).toHaveValue(`${annee}-04-09`);
  await expect(fenetre.getByLabel("Date de l'échéance 2")).toHaveValue(`${annee}-05-09`);
  await expect(fenetre.getByLabel("Mode de l'échéance 1")).toHaveValue(vir.id);

  // Un découpage qui ne refait pas la ligne au centime est refusé, l'écart dit.
  await fenetre.getByLabel("Montant de l'échéance 1").fill('600000');
  await expect(fenetre.getByText(/écart de -20\s000,00/)).toBeVisible();
  await expect(fenetre.getByRole('button', { name: 'Appliquer les échéances' })).toBeDisabled();
  await fenetre.getByLabel("Montant de l'échéance 2").fill('560000');
  await fenetre.getByRole('button', { name: 'Appliquer les échéances' }).click();
  await expect(page.getByText(/ligne découpée en 2 échéances/)).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer la pièce' }).click();

  const lignesDuTiers = async (reference: string) => {
    const r = await appelApi<{ ecritures: Ecriture[] }>(page, 'GET', `/ecritures?exerciceId=${exercice.id}&journalId=${achats.id}`);
    const e = r.ecritures.find((x) => x.reference === reference);
    return (e?.lignes ?? [])
      .filter((l) => l.compteId === fournisseur.id)
      .map((l) => [Number(l.credit), l.dateEcheance?.slice(0, 10) ?? null, l.modeReglementId])
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  };
  await expect
    .poll(() => lignesDuTiers('ECH-1'))
    .toEqual([
      [600_000, `${annee}-04-09`, vir.id],
      [560_000, `${annee}-05-09`, null],
    ]);

  // L'ÉCHÉANCIER APPLIQUÉ D'OFFICE · coché sur la fiche, la ligne se découpe sans fenêtre.
  await appelApi(page, 'PATCH', `/tiers/${tiers.id}`, { validationAutomatiqueEcheances: true });
  await piece('ECH-2');
  await expect(page.getByText(/ligne découpée en 2 échéances \(modèle « Moitié 30, reste 60 », appliqué d'office\)/)).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Échéances de la ligne' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Enregistrer la pièce' }).click();
  await expect
    .poll(() => lignesDuTiers('ECH-2'))
    .toEqual([
      [580_000, `${annee}-04-09`, vir.id],
      [580_000, `${annee}-05-09`, null],
    ]);
  expect(pannes).toEqual([]);
});
