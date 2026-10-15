import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LE JOURNAL MARQUÉ IMPRIMÉ (ligne sage-l1, fonction 60 · décision par la
 * loi, AUDCIF art. 22, 1°, 3° et 7°). Le dossier qui a choisi l'option
 * refuse de clôturer une période dont des écritures validées ne figurent sur
 * aucune impression faite après leur validation ; « Imprimer le journal »
 * enregistre l'impression (numérotée, datée) au serveur avant d'ouvrir la
 * boîte d'impression, et la clôture passe ensuite.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }

test('SYSCOHADA · la clôture attend l’impression du journal, et l’impression s’enregistre', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Impression e2e', montant: 3_000 });
  await seConnecter(page, dossier.email);

  const exercice = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id === dossier.exerciceId)!;
  await appelApi(page, 'PATCH', '/dossier/refus-cloture-non-imprime', { refusClotureJournalNonImprime: true });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: exercice.dateFin.slice(0, 10) });
  const fin = exercice.dateFin.slice(0, 10);

  // Validée, jamais imprimée · la clôture de période est refusée et nomme le mois.
  await expect(
    appelApi(page, 'POST', `/exercices/${exercice.id}/clotures/periode`, { dateLimite: fin }),
  ).rejects.toThrow(/non imprimé/);

  // La boîte d'impression du navigateur ne s'ouvre pas sous Playwright · le
  // geste compte par ce que le serveur enregistre AVANT elle.
  await page.goto('/#/journal?onglet=journal');
  await page.evaluate(() => {
    window.print = () => undefined;
  });
  // UN JOURNAL SANS PIÈCE N'EST PAS UNE IMPRESSION (relecture M6) · enregistrée,
  // elle retenait le journal et tenait son exercice sans rien attester.
  const journaux = await appelApi<{ id: string; code: string; type: string }[]>(page, 'GET', '/journaux');
  let vide: string | null = null;
  for (const j of journaux.filter((x) => x.type !== 'SITUATION')) {
    const lu = await appelApi<{ total: number }>(page, 'GET', `/ecritures?exerciceId=${exercice.id}&journalId=${j.id}&limite=1`);
    if (lu.total === 0) {
      vide = j.id;
      break;
    }
  }
  expect(vide).not.toBeNull();
  const sansPiece = await appelApi<{ numero: number | null }>(page, 'POST', '/impressions-journal', { exerciceId: exercice.id, journalId: vide });
  expect(sansPiece.numero).toBeNull();

  await page.getByRole('button', { name: 'Imprimer le journal' }).click();
  await expect(page.getByText(/Impression n° 1 du journal enregistrée/)).toBeVisible();
  // LA PAGE IMPRIMÉE PORTE SON NUMÉRO ET SA DATE (relecture m2) · posés avant
  // la boîte d'impression, lus sous le média d'impression.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByText(/Impression n° 1 du journal · enregistrée le \d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}/)).toBeVisible();
  await page.emulateMedia({ media: 'screen' });

  const liste = await appelApi<{ impressions: { numero: number; forme: string }[]; total: number }>(
    page,
    'GET',
    `/impressions-journal?exerciceId=${exercice.id}`,
  );
  expect(liste.impressions.map((i) => [i.numero, i.forme])).toEqual([[1, 'IMPRESSION']]);
  await appelApi(page, 'POST', `/exercices/${exercice.id}/clotures/periode`, { dateLimite: fin });

  expect(pannes).toEqual([]);
});

test('SYSCOHADA · l’impression d’un journal de situation ne prend aucun numéro de la suite (second tour, d)', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Impression situation e2e', montant: 2_000 });
  await seConnecter(page, dossier.email);

  // Une simulation saisie dans un journal de situation, à côté de la pièce du dossier.
  const sit = await appelApi<{ id: string }>(page, 'POST', '/journaux', {
    code: 'SIM',
    intitule: 'Simulations',
    type: 'SITUATION',
    numerotation: 'CONTINUE_JOURNAL',
  });
  const exercice = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id === dossier.exerciceId)!;
  // Les deux comptes que la pièce du dossier a mouvementés (`creerDossier`) · utilisés, donc personnalisés.
  const plan = await appelApi<{ id: string; numero: string; typeCompte: string }[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const detail = (racine: string) => plan.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith(racine))!;
  const [a, b] = [detail('52'), detail('7')];
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: sit.id,
    date: exercice.dateDebut.slice(0, 10),
    libelle: 'Simulation',
    lignes: [
      { compteId: a.id, debit: 500, credit: 0 },
      { compteId: b.id, debit: 0, credit: 500 },
    ],
  });

  // La suite numérotée atteste le livre-journal (AUDCIF art. 22, 1° et 7°) ·
  // le journal de situation s'imprime sans y prendre de numéro, et la réponse le dit.
  const r = await appelApi<{ numero: number | null; motif?: string }>(page, 'POST', '/impressions-journal', {
    exerciceId: exercice.id,
    journalId: sit.id,
  });
  expect(r.numero).toBeNull();
  expect(r.motif).toMatch(/journal de situation/);
  const liste = await appelApi<{ total: number }>(page, 'GET', `/impressions-journal?exerciceId=${exercice.id}`);
  expect(liste.total).toBe(0);

  expect(pannes).toEqual([]);
});
