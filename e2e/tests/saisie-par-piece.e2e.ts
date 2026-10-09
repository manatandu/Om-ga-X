import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LA SAISIE PAR PIÈCE PASSE UNE ÉCRITURE À LA MAIN (2026-10-09, question de
 * Manasse · « je ne vois pas où on passe les écritures à la main »). Aucun
 * parcours ne montait ce mode · on choisit le journal par son CODE (un clic
 * sur un mois décoche la case), on coche « Saisie par pièce », on ouvre, et
 * la pièce se tape avec sa date complète, deux lignes, puis s'enregistre. Le
 * montant se relit sur l'écriture créée.
 */
const MONTANT = 4_321;

interface Exercice { id: string; dateDebut: string }
interface Journal { id: string; code: string; type: string }
interface Ecriture { journalId: string; libelle: string; lignes: { debit: number; credit: number }[] }

test('SYSCOHADA · une écriture se passe à la main en saisie par pièce', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Saisie par pièce e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);

  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
  const date = `${exercice.dateDebut.slice(0, 4)}-03-15`;

  await page.goto('/#/saisie');
  await page.getByRole('button', { name: od.code, exact: true }).first().click();
  await page.getByLabel('Saisie par pièce').check();
  await page.getByRole('button', { name: 'Ouvrir le journal' }).click();

  await expect(page.getByText('Pièce en cours de saisie')).toBeVisible();
  await page.getByLabel('Date de la pièce').fill(date);
  await page.getByPlaceholder('n° facture, chèque…').fill('PP-1');

  const compte = page.getByPlaceholder('n° ou F4');
  const ligne = async (numero: string, sens: 'debit' | 'credit') => {
    await compte.fill(numero);
    await compte.press('Enter');
    await page.getByPlaceholder('libellé de la ligne').fill('Pièce saisie à la main');
    const champs = page.locator('input[type=number][step="0.01"]');
    await champs.nth(sens === 'debit' ? 0 : 1).fill(String(MONTANT));
    await page.getByTitle('Valider la ligne (Entrée)').click();
  };
  await ligne('5211', 'debit');
  await ligne('7011', 'credit');
  await page.getByRole('button', { name: 'Enregistrer la pièce' }).click();

  await expect
    .poll(async () => {
      const r = await appelApi<{ ecritures?: Ecriture[] } | Ecriture[]>(page, 'GET', `/ecritures?exerciceId=${exercice.id}&journalId=${od.id}`);
      const liste = Array.isArray(r) ? r : (r.ecritures ?? []);
      return liste
        .filter((e) => e.lignes.some((l) => Number(l.debit) === MONTANT))
        .map((e) => e.lignes.reduce((s, l) => s + Number(l.debit), 0));
    })
    .toEqual([MONTANT]);

  expect(pannes).toEqual([]);
});
