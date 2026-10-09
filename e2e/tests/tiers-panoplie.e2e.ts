import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LA PANOPLIE D'UN TIERS À TRAVERS UNE CLÔTURE (décision de Manasse du
 * 2026-10-09 · « chaque client doit avoir dans un arsenal tous les sous
 * comptes du compte 41 », « Refus nommé »). Sur vraie base, par l'API du
 * serveur compilé (CLAUDE.md § 10) · un client naît avec ses cinq comptes au
 * même rang, la saisie refuse son collectif, sa créance et son avance passent
 * sur SES comptes, la clôture les reporte compte par compte en N+1, où le
 * collectif refuse encore la saisie. Un journal de banque ne prend pas le
 * compte d'un autre.
 *
 * LE NUMÉRO CHOISI À LA CRÉATION (décision de Manasse du 2026-10-09,
 * « Choisi à la création ») · OmegaX propose le premier numéro libre, le
 * client naît sous le numéro que le cabinet a choisi, sa panoplie au même
 * rang, et c'est ce numéro qui traverse la clôture. Pris, il est refusé ; à
 * l'écran, la fenêtre de création le propose et le garde modifiable.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string; compteTresorerieId: string | null }
interface LigneBalance { numero: string; reportDebit: number; reportCredit: number }
interface Panoplie { crees: { role: string; numero: string }[] }

const CREANCE = 100_000;
const AVANCE = 30_000;
const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);

test('SYSCOHADA · un client et sa panoplie traversent la clôture, le collectif refuse la saisie', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Panoplie e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);

  // Le numéro proposé est le premier libre sous le 4111, à la longueur du dossier.
  expect(await appelApi(page, 'GET', '/tiers/numero-propose?type=CLIENT')).toEqual({
    numero: '41110001',
    collectif: '41110000',
    longueur: 8,
    motif: null,
  });
  const tiers = await appelApi<{ id: string; panoplie: Panoplie }>(page, 'POST', '/tiers', {
    type: 'CLIENT',
    code: 'ACME',
    nom: 'Acme',
    numeroCompte: '41110250',
  });
  const numero = Object.fromEntries(tiers.panoplie.crees.map((c) => [c.role, c.numero]));
  expect(Object.keys(numero)).toEqual(['PRINCIPAL', 'A_ETABLIR', 'AVANCES_RECUES', 'LITIGIEUSES', 'DOUTEUSES']);
  // Le numéro choisi, et la panoplie à son rang sous chaque collectif.
  expect(numero).toEqual({
    PRINCIPAL: '41110250',
    A_ETABLIR: '41810250',
    AVANCES_RECUES: '41910250',
    LITIGIEUSES: '41610250',
    DOUTEUSES: '41620250',
  });
  // Pris, il est refusé en le disant ; hors de la racine du collectif aussi.
  await expect(
    appelApi(page, 'POST', '/tiers', { type: 'CLIENT', code: 'ACME2', nom: 'Acme 2', numeroCompte: '41110250' }),
  ).rejects.toThrow(/Le compte 41110250 existe déjà dans ce dossier/);
  await expect(
    appelApi(page, 'POST', '/tiers', { type: 'CLIENT', code: 'ACME2', nom: 'Acme 2', numeroCompte: '40110250' }),
  ).rejects.toThrow(/ne commence pas par 4111/);
  // Rien n'est né des refus · la proposition reste le premier libre.
  expect((await appelApi<{ numero: string }>(page, 'GET', '/tiers/numero-propose?type=CLIENT')).numero).toBe('41110001');

  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const id = (n: string) => comptes.find((c) => c.numero === n)!.id;
  const produit = comptes.find((c) => c.numero.startsWith('701'))!;
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL');
  if (!od) throw new Error('Aucun journal d’opérations diverses semé · le scénario ne peut pas passer ses pièces.');
  const banque = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerieId)!;
  const date = `${exercice.dateDebut.slice(0, 4)}-06-15`;
  const piece = (lignes: { compteId: string; debit: number; credit: number }[], libelle: string) => ({
    exerciceId: exercice.id,
    journalId: od.id,
    date,
    libelle,
    lignes: lignes.map((l) => ({ ...l, libelle })),
  });

  // Le collectif refuse la ligne saisie, en nommant le compte du tiers.
  await expect(
    appelApi(page, 'POST', '/ecritures', piece([{ compteId: id('41110000'), debit: CREANCE, credit: 0 }, { compteId: produit.id, debit: 0, credit: CREANCE }], 'Facture au collectif')),
  ).rejects.toThrow(new RegExp(`Compte collectif : 41110000 \\(${numero.PRINCIPAL} Acme`));

  await appelApi(page, 'POST', '/ecritures', piece([{ compteId: id(numero.PRINCIPAL), debit: CREANCE, credit: 0 }, { compteId: produit.id, debit: 0, credit: CREANCE }], 'Facture Acme'));
  await appelApi(page, 'POST', '/ecritures', piece([{ compteId: banque.compteTresorerieId!, debit: AVANCE, credit: 0 }, { compteId: id(numero.AVANCES_RECUES), debit: 0, credit: AVANCE }], 'Avance Acme'));

  // Compléter ne rouvre rien de ce qu'il a.
  expect((await appelApi<Panoplie>(page, 'POST', `/tiers/${tiers.id}/panoplie`, {})).crees).toEqual([]);
  expect(await appelApi<{ comptesCrees: number; suivant: string | null }>(page, 'POST', '/tiers/panoplies', {})).toMatchObject({ comptesCrees: 0, suivant: null });

  // Un journal de banque ne prend pas le compte d'un autre.
  await expect(
    appelApi(page, 'POST', '/journaux', { code: 'BQ2', intitule: 'Banque 2', type: 'TRESORERIE', compteTresorerieId: banque.compteTresorerieId }),
  ).rejects.toThrow(new RegExp(`est déjà celui du journal ${banque.code}`));

  // La clôture reporte la créance et l'avance sur LES comptes du tiers.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
  const debutSuivant = lendemain(exercice.dateFin);
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${debutSuivant.slice(0, 4)}-12-31` });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);

  const { lignes } = await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`);
  const report = (n: string) => {
    const l = lignes.find((x) => x.numero === n);
    return l ? [l.reportDebit, l.reportCredit] : null;
  };
  expect({ creance: report(numero.PRINCIPAL), avance: report(numero.AVANCES_RECUES), collectif: report('41110000') }).toEqual({
    creance: [CREANCE, 0],
    avance: [0, AVANCE],
    collectif: null,
  });
  // La balance générale les fond sur leurs collectifs.
  const regroupee = await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}&regrouperTiers=1`);
  expect(regroupee.lignes.find((l) => l.numero === '41910000')?.reportCredit).toBe(AVANCE);

  // En N+1, l'avance s'impute sur la créance par les comptes du tiers, jamais par le collectif.
  const dateN1 = `${debutSuivant.slice(0, 4)}-02-10`;
  const imputation = (compteAvance: string) => ({
    exerciceId: suivant.id,
    journalId: od.id,
    date: dateN1,
    libelle: 'Imputation avance Acme',
    lignes: [
      { compteId: id(compteAvance), libelle: 'Imputation', debit: AVANCE, credit: 0 },
      { compteId: id(numero.PRINCIPAL), libelle: 'Imputation', debit: 0, credit: AVANCE },
    ],
  });
  await expect(appelApi(page, 'POST', '/ecritures', imputation('41910000'))).rejects.toThrow(/Compte collectif : 41910000/);
  await appelApi(page, 'POST', '/ecritures', imputation(numero.AVANCES_RECUES));

  // À l'écran · la fenêtre de création propose le numéro, et le numéro saisi est celui qui s'ouvre.
  await page.goto('/#/tiers');
  await page.getByRole('button', { name: 'Nouveau tiers' }).click();
  const champNumero = page.locator('#numero-compte-tiers');
  await expect(champNumero).toHaveValue('41110001');
  await page.getByPlaceholder('ex. CLI-0001').fill('BETA');
  await champNumero.fill('41110251');
  await page.locator('form').getByRole('textbox').nth(1).fill('Beta');
  await page.getByRole('button', { name: 'Créer le tiers' }).click();
  await expect(page.getByText(/Tiers BETA créé avec ses comptes 41110251, 41810251/)).toBeVisible();

  expect(pannes).toEqual([]);
});

test('SYCEBNL · un adhérent reçoit ses appels de fonds au 4181 et ses cotisations douteuses au 4161', async ({ page }) => {
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Panoplie adhérent e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const adherent = await appelApi<{ panoplie: Panoplie }>(page, 'POST', '/tiers', { type: 'ADHERENT', code: 'M1', nom: 'Membre' });
  expect(adherent.panoplie.crees.map((c) => [c.role, c.numero.slice(0, 4)])).toEqual([
    ['PRINCIPAL', '4110'],
    ['A_ETABLIR', '4181'],
    ['AVANCES_RECUES', '4191'],
    ['LITIGIEUSES_OU_DOUTEUSES', '4161'],
  ]);
  const usager = await appelApi<{ panoplie: Panoplie }>(page, 'POST', '/tiers', { type: 'CLIENT', code: 'U1', nom: 'Usager' });
  expect(usager.panoplie.crees.map((c) => c.numero.slice(0, 4))).toEqual(['4120', '4182', '4192', '4162']);
});
