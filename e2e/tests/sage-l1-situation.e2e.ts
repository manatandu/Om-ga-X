import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LE JOURNAL DE SITUATION (ligne sage-l1, fonction 12 · décision par la loi,
 * AUDCIF art. 19 ; art. 22, 2° et 3°). Une écriture saisie dans un journal de
 * situation naît au statut SITUATION, ne se valide pas, n'entre ni à la
 * balance ni au livre-journal, et l'état des journaux de saisie la montre
 * sous son propre sigle. Le journal ne se clôture pas.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string }
interface LigneBalance { numero: string; solde: number }

test('SYSCOHADA · une simulation reste hors du livre-journal et se montre à part', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Situation e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);

  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const detail = (racine: string) => comptes.find((c) => c.numero.startsWith(racine))!;
  const banque = detail('521');
  const charge = detail('605');
  const sit = await appelApi<Journal>(page, 'POST', '/journaux', {
    code: 'SIT',
    intitule: 'Simulations',
    type: 'SITUATION',
    numerotation: 'CONTINUE_JOURNAL',
  });
  const date = `${exercice.dateDebut.slice(0, 4)}-04-10`;
  const simulation = await appelApi<{ id: string; statut: string }>(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: sit.id,
    date,
    libelle: 'Simulation e2e',
    reference: 'SIM-1',
    lignes: [
      { compteId: charge.id, debit: 250_000, credit: 0 },
      { compteId: banque.id, debit: 0, credit: 250_000 },
    ],
  });
  expect(simulation.statut).toBe('SITUATION');

  // Ni validée, ni à la balance de travail.
  await expect(appelApi(page, 'POST', '/ecritures/valider', { ecritureIds: [simulation.id] })).rejects.toThrow(/situation/);
  const { lignes } = await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${exercice.id}`);
  expect(lignes.filter((l) => l.numero.startsWith('605')).reduce((s, l) => s + l.solde, 0)).toBe(0);
  await expect(
    appelApi(page, 'POST', `/exercices/${exercice.id}/clotures/totale`, { journalId: sit.id }),
  ).rejects.toThrow(/ne se clôture pas/);

  // L'état des journaux de saisie la montre sous son sigle, et la légende le nomme.
  await page.goto('/#/saisie');
  const caseDuMois = page.getByRole('button', { name: `SIT Avril ${date.slice(0, 4)}`, exact: true });
  await expect(caseDuMois).toHaveText('S');
  await expect(caseDuMois).toHaveAttribute('title', /Situation · 1 écriture/);
  // La légende porte le sigle puis son libellé dans le même élément.
  await expect(page.getByText(/^S\s?Situation$/)).toBeVisible();

  expect(pannes).toEqual([]);
});
