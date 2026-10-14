import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LA LETTRE DE LETTRAGE CHOISIE À LA MAIN (ligne sage-l1, fonction 16 ·
 * Traitement > Interrogation et lettrage). L'écran propose la lettre suivante
 * du compte ; le comptable en tape une autre, le lettrage la porte ; une
 * lettre déjà employée sur le compte est refusée en la nommant.
 */
interface Exercice { id: string; dateDebut: string }
interface Compte { id: string; numero: string }
interface Journal { id: string; type: string; compteTresorerieId?: string | null }
interface Panoplie { crees: { role: string; numero: string }[] }

test('SYSCOHADA · la lettre choisie est posée, une lettre déjà prise est refusée', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Lettre e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);

  const exercice = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id === dossier.exerciceId)!;
  const tiers = await appelApi<{ panoplie: Panoplie }>(page, 'POST', '/tiers', { type: 'FOURNISSEUR', code: 'F-LETTRE', nom: 'Fournisseur lettre' });
  const numeroTiers = tiers.panoplie.crees.find((c) => c.role === 'PRINCIPAL')!.numero;
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const fournisseur = comptes.find((c) => c.numero === numeroTiers)!;
  const charge = comptes.find((c) => c.numero.startsWith('605'))!;
  await appelApi(page, 'PATCH', `/comptes/${charge.id}`, { estRetenu: true });
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const date = `${exercice.dateDebut.slice(0, 4)}-05-12`;
  const piece = async (libelle: string, debit: Compte, credit: Compte, montant: number) =>
    appelApi(page, 'POST', '/ecritures', {
      exerciceId: exercice.id,
      journalId: od.id,
      date,
      libelle,
      lignes: [
        { compteId: debit.id, libelle, debit: montant, credit: 0 },
        { compteId: credit.id, libelle, debit: 0, credit: montant },
      ],
    });
  // Deux factures et leurs avoirs sur le compte du tiers · rien en trésorerie.
  await piece('Facture F1', charge, fournisseur, 1_000);
  await piece('Avoir F1', fournisseur, charge, 1_000);
  await piece('Facture F2', charge, fournisseur, 500);
  await piece('Avoir F2', fournisseur, charge, 500);

  await page.goto('/#/lettrage');
  await page.getByLabel('Compte à consulter').selectOption(fournisseur.id);
  const lettre = page.getByRole('textbox', { name: 'Lettre du lettrage' });
  // Rien encore lettré sur le compte · la lettre proposée est la première.
  await expect(lettre).toHaveAttribute('placeholder', 'A');
  const cocher = async (libelle: string) =>
    page.getByText(libelle, { exact: true }).locator('xpath=..').locator('input[type=checkbox]').check();
  await cocher('Facture F1');
  await cocher('Avoir F1');
  await lettre.fill('k');
  await page.getByRole('button', { name: 'Lettrer la sélection' }).click();
  await expect(page.getByText('2 ligne(s) lettrées (K).')).toBeVisible();
  // La suite repart après la lettre choisie.
  await expect(lettre).toHaveAttribute('placeholder', 'L');

  // Une lettre déjà prise sur le compte est refusée, nommée.
  const etat = await appelApi<{ lignes: { id: string; lettrageId: string | null }[] }>(page, 'GET', `/comptes/${fournisseur.id}/lettrage`);
  const libres = etat.lignes.filter((l) => l.lettrageId === null).map((l) => l.id);
  await expect(
    appelApi(page, 'POST', `/comptes/${fournisseur.id}/lettrage`, { ligneIds: libres, lettre: 'K' }),
  ).rejects.toThrow(/« K » est déjà employée sur le compte/);

  expect(pannes).toEqual([]);
});
