import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LES COMPTES PERSONNALISÉS À TRAVERS UNE CLÔTURE (décision de Manasse du
 * 2026-10-09 · « les écritures n'admettraient que les comptes personnalisés
 * du dossier »). Sur vraie base, par l'API du serveur compilé (CLAUDE.md
 * § 10) · un journal de banque naît avec SON compte, ouvert sous un compte
 * de la classe 5 du plan au numéro proposé ; dès lors la saisie refuse le
 * compte du plan qu'il subdivise, en nommant le compte du dossier, sauf la
 * pièce qui reporte un montant déjà porté au compte du plan. Le compte du
 * plan qu'un journal de trésorerie TIENT reste ouvert · le journal semé ne
 * s'enferme pas quand un second journal ouvre son compte dessous. La
 * clôture reporte les deux comptes chacun pour soi, et la règle tient en
 * N+1. À l'écran, la création d'un journal de trésorerie ouvre son compte
 * par défaut, numéro proposé.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; intitule: string; typeCompte: string }
interface Journal { id: string; code: string; type: string; compteTresorerie: { numero: string; intitule: string } | null }
interface LigneBalance { numero: string; reportDebit: number; reportCredit: number }
interface Propose { numero: string | null; racine: string; longueur: number; compteDuPlan: { numero: string }; motif: string | null }

const AVANT = 80_000;
const APRES = 50_000;
const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);

test('SYSCOHADA · un journal de banque ouvre son compte, la saisie refuse le compte du plan qu’il subdivise', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Comptes personnalisés e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);

  // Les comptes du plan offerts sont les comptes d'imputation semés de la classe 5.
  const duPlan = await appelApi<Compte[]>(page, 'GET', '/journaux/comptes-du-plan');
  const numerosDuPlan = duPlan.map((c) => c.numero);
  expect(numerosDuPlan).toEqual(expect.arrayContaining(['52110000', '52150000', '52400000', '57110000']));
  expect(numerosDuPlan.every((n) => n.startsWith('5') && n.length === 8)).toBe(true);
  const sous = (n: string) => duPlan.find((c) => c.numero === n)!.id;

  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const produit = comptes.find((c) => c.numero.startsWith('701'))!;
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL');
  if (!od) throw new Error('Aucun journal d’opérations diverses semé · le scénario ne peut pas passer ses pièces.');
  const date = `${exercice.dateDebut.slice(0, 4)}-06-15`;
  const piece = (exerciceId: string, d: string, lignes: { compteId: string; debit: number; credit: number }[], libelle: string) => ({
    exerciceId,
    journalId: od.id,
    date: d,
    libelle,
    lignes: lignes.map((l) => ({ ...l, libelle })),
  });

  // Avant toute subdivision, le compte du plan se saisit.
  const id5215 = comptes.find((c) => c.numero === '52150000')!.id;
  await appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: id5215, debit: AVANT, credit: 0 }, { compteId: produit.id, debit: 0, credit: AVANT }], 'Remise au compte du plan'));

  // Le numéro proposé est le premier libre sous la racine, à la longueur du dossier.
  expect(await appelApi<Propose>(page, 'GET', `/journaux/compte-propose?sousId=${sous('52150000')}`)).toMatchObject({
    numero: '52150001',
    racine: '5215',
    longueur: 8,
    compteDuPlan: { numero: '52150000' },
    motif: null,
  });
  await appelApi(page, 'POST', '/journaux', { code: 'BQ2', intitule: 'Rawbank', type: 'TRESORERIE', ouvrirCompteSousId: sous('52150000') });
  const bq2 = (await appelApi<Journal[]>(page, 'GET', '/journaux')).find((j) => j.code === 'BQ2')!;
  expect(bq2.compteTresorerie).toEqual(expect.objectContaining({ numero: '52150001', intitule: 'Rawbank' }));
  expect((await appelApi<Propose>(page, 'GET', `/journaux/compte-propose?sousId=${sous('52150000')}`)).numero).toBe('52150002');

  // Pris, le numéro est refusé ; hors de la racine aussi ; un refus n'ouvre rien.
  await expect(
    appelApi(page, 'POST', '/journaux', { code: 'BQ3', intitule: 'Equity', type: 'TRESORERIE', ouvrirCompteSousId: sous('52150000'), numeroCompte: '52150001' }),
  ).rejects.toThrow(/Le compte 52150001 existe déjà dans ce dossier/);
  await expect(
    appelApi(page, 'POST', '/journaux', { code: 'BQ3', intitule: 'Equity', type: 'TRESORERIE', ouvrirCompteSousId: sous('52150000'), numeroCompte: '52110009' }),
  ).rejects.toThrow(/ne commence pas par 5215/);
  expect((await appelApi<Journal[]>(page, 'GET', '/journaux')).some((j) => j.code === 'BQ3')).toBe(false);

  // Le compte du plan subdivisé refuse la saisie, en nommant le compte du dossier.
  const plan = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const id = (n: string) => plan.find((c) => c.numero === n)!.id;
  await expect(
    appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: id('52150000'), debit: APRES, credit: 0 }, { compteId: produit.id, debit: 0, credit: APRES }], 'Remise refusée')),
  ).rejects.toThrow(/Compte du plan subdivisé par le dossier : 52150000 \(52150001 Rawbank/);
  await appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: id('52150001'), debit: APRES, credit: 0 }, { compteId: produit.id, debit: 0, credit: APRES }], 'Remise Rawbank'));

  // Le compte du plan que le journal semé TIENT reste ouvert, même subdivisé.
  await appelApi(page, 'POST', '/journaux', { code: 'BQ3', intitule: 'Equity', type: 'TRESORERIE', ouvrirCompteSousId: sous('52110000') });
  const plan2 = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  expect(plan2.some((c) => c.numero === '52110001')).toBe(true);
  const id5211 = plan2.find((c) => c.numero === '52110000')!.id;
  await appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: id5211, debit: 1_000, credit: 0 }, { compteId: produit.id, debit: 0, credit: 1_000 }], 'Remise banque du journal semé'));

  // La clôture reporte chaque compte pour soi.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
  const debutSuivant = lendemain(exercice.dateFin);
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${debutSuivant.slice(0, 4)}-12-31` });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);
  const { lignes } = await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`);
  const report = (n: string) => {
    const l = lignes.find((x) => x.numero === n);
    return l ? [l.reportDebit, l.reportCredit] : null;
  };
  expect({ plan: report('52150000'), rawbank: report('52150001') }).toEqual({ plan: [AVANT, 0], rawbank: [APRES, 0] });

  // En N+1, le montant resté au compte du plan se reporte sur le compte du dossier,
  // et la saisie ordinaire y reste refusée.
  const dateN1 = `${debutSuivant.slice(0, 4)}-02-10`;
  await expect(
    appelApi(page, 'POST', '/ecritures', piece(suivant.id, dateN1, [{ compteId: id('52150000'), debit: 10_000, credit: 0 }, { compteId: produit.id, debit: 0, credit: 10_000 }], 'Remise refusée N+1')),
  ).rejects.toThrow(/Compte du plan subdivisé par le dossier : 52150000/);
  await appelApi(page, 'POST', '/ecritures', piece(suivant.id, dateN1, [{ compteId: id('52150001'), debit: AVANT, credit: 0 }, { compteId: id('52150000'), debit: 0, credit: AVANT }], 'Report sur Rawbank'));

  // À l'écran · la création d'un journal de trésorerie ouvre son compte, numéro proposé.
  await page.goto('/#/journaux');
  await page.getByRole('button', { name: 'Nouveau journal' }).click();
  const fenetre = page.locator('form');
  await fenetre.getByPlaceholder('ACH, VEN, BQ…').fill('BQ4');
  await fenetre.getByRole('textbox').nth(1).fill('Ecobank');
  await fenetre.locator('select').first().selectOption('TRESORERIE');
  await expect(fenetre.getByRole('radio', { name: 'Ouvrir son compte' })).toBeChecked();
  await fenetre.getByLabel('Sous le compte :').selectOption(sous('52400000'));
  const numero = fenetre.getByLabel('N° de compte :');
  await expect(numero).toHaveValue('52400001');
  await fenetre.getByRole('button', { name: 'Créer le journal' }).click();
  await expect(page.getByText('52400001 Ecobank')).toBeVisible();

  expect(pannes).toEqual([]);
});
