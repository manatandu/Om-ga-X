import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * AU1 ET AU2, SUR LA BASE RÉELLE ET À TRAVERS UNE CLÔTURE.
 *
 * AU2 · un bilan d'ouverture importé dans N+1, puis la clôture de N · la
 * clôture AJOUTAIT son report à l'import, chaque compte doublé dans N+1, la
 * balance bouclée. La clôture confronte désormais l'import au bilan de
 * clôture, compte par compte · concordant, rien n'est ajouté ; divergent,
 * l'écran Fin d'exercice montre les comptes et fait déclarer lequel fait foi
 * (AUDCIF art. 34 · SYCEBNL art. 16, 4) · AUDCIF art. 20, al. 2).
 *
 * AU1 · une ligne de l'à-nouveau PROVISOIRE ne se lettre plus (AUDCIF
 * art. 22, 2°) · lettrée puis figée par une clôture de période de N+1, elle
 * enfermait N. Le report du lettrage d'un dossier HÉRITÉ sur l'à-nouveau
 * définitif ne se rejoue pas ici (il faut une ligne lettrée avant le
 * correctif) · il est gelé par `cloture-annuelle.spec.ts` et a été rejoué sur
 * vraie base (AVANCEMENT-AU1.md).
 */
const MONTANT = 150_000;
interface Exercice { id: string; dateDebut: string; dateFin: string; statut: string }
interface Compte { id: string; numero: string; typeCompte: string }

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);

for (const referentiel of ['SYSCOHADA', 'SYCEBNL'] as const) {
  test(`${referentiel} · bilan d'ouverture importé divergent, rectifié à la clôture, jamais doublé`, async ({ page }) => {
    const pannes = surveiller(page);
    const dossier = await creerDossier(page, { referentiel, nom: `Ouverture e2e ${referentiel}`, montant: MONTANT });
    await seConnecter(page, dossier.email);
    const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
    await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
    const debut = lendemain(exercice.dateFin);
    const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debut, dateFin: `${debut.slice(0, 4)}-12-31` });

    // Le bilan de clôture de N · banque MONTANT, résultat MONTANT au crédit du 131.
    const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
    const banque = comptes.find((c) => c.numero.startsWith('52'))!;
    const resultat = comptes.find((c) => c.numero.startsWith('131'))!;
    // L'import se trompe de 40 000 sur la banque et sur le résultat.
    const faux = MONTANT + 40_000;
    const csv = `numero;intitule;debit;credit\n${banque.numero};Banque;${faux};0\n${resultat.numero};Resultat;0;${faux}\n`;
    await appelApi(page, 'POST', '/import/executer', {
      type: 'BALANCE',
      nomFichier: 'ouverture.csv',
      contenuBase64: Buffer.from(csv).toString('base64'),
      mapping: { numero: 'numero', intitule: 'intitule', debit: 'debit', credit: 'credit' },
      exerciceId: suivant.id,
      bilanDOuverture: true,
      separateur: ';',
    });

    // Au brouillard, la clôture le refuse et nomme le geste ouvert.
    await expect(appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`, {})).rejects.toThrow(/au premier jour des écritures au brouillard/);
    await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: suivant.id, dateLimite: debut });
    // Validé et divergent · refus sans déclaration.
    await expect(appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`, {})).rejects.toThrow(/qui diffère du bilan de clôture/);

    // L'écran montre les comptes divergents et fait choisir.
    await page.goto('/#/exercice');
    await page.locator('select').first().selectOption(exercice.id);
    await expect(page.getByText(/différente du bilan de clôture/)).toBeVisible();
    await expect(page.getByRole('cell', { name: new RegExp(banque.numero) })).toBeVisible();
    await page.getByLabel(/Rectifier l'import/).check();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: "Clôturer l'exercice" }).click();
    await expect(page.getByText(/inscrites en négatif et le report exact est passé/)).toBeVisible();

    // L'ouverture de N+1 vaut le bilan de clôture de N, compte par compte.
    const { lignes } = await appelApi<{ lignes: { numero: string; solde: number }[] }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`);
    const solde = (n: string) => lignes.filter((l) => l.numero === n).reduce((t, l) => t + Number(l.solde), 0);
    expect({ banque: solde(banque.numero), resultat: solde(resultat.numero) }).toEqual({ banque: MONTANT, resultat: -MONTANT });

    expect(pannes).toEqual([]);
  });
}

test('SYSCOHADA · AU1 · une ligne d’à-nouveau provisoire ne se lettre pas', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'AU1 e2e', montant: MONTANT });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const journaux = await appelApi<Array<{ id: string; type: string; code: string }>>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.code === 'OD') ?? journaux[0];
  const client = comptes.find((c) => c.numero === '41110000')!;
  const produit = comptes.find((c) => c.numero.startsWith('706'))!;
  const banque = comptes.find((c) => c.numero.startsWith('521'))!;
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: exercice.id, journalId: od.id, date: `${exercice.dateDebut.slice(0, 4)}-03-15`, libelle: 'Vente',
    lignes: [{ compteId: client.id, debit: 500_000, credit: 0 }, { compteId: produit.id, debit: 0, credit: 500_000 }],
  });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/a-nouveaux-provisoires`, {});
  const suivant = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.dateDebut > exercice.dateFin)!;
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: suivant.id, journalId: od.id, date: `${suivant.dateDebut.slice(0, 4)}-01-20`, libelle: 'Encaissement',
    lignes: [{ compteId: banque.id, debit: 500_000, credit: 0 }, { compteId: client.id, debit: 0, credit: 500_000 }],
  });
  const { lignes } = await appelApi<{ lignes: Array<{ id: string; date: string; debit: number; credit: number }> }>(
    page,
    'GET',
    `/comptes/${client.id}/lettrage`,
  );
  // Les deux lignes de N+1 · l'à-nouveau provisoire du 1er janvier et l'encaissement.
  const ids = lignes.filter((l) => l.date >= suivant.dateDebut && (l.debit === 500_000 || l.credit === 500_000)).map((l) => l.id);
  expect(ids).toHaveLength(2);
  await expect(appelApi(page, 'POST', `/comptes/${client.id}/lettrage`, { ligneIds: ids })).rejects.toThrow(/PROVISOIRE/);
  // La clôture de période de N+1 reste ouverte, et la clôture de N passe.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: suivant.id, dateLimite: `${suivant.dateDebut.slice(0, 4)}-01-31` });
  await appelApi(page, 'POST', `/exercices/${suivant.id}/clotures/periode`, { dateLimite: `${suivant.dateDebut.slice(0, 4)}-01-31` });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`, {});
  expect(pannes).toEqual([]);
});

/**
 * R1 (second tour) · une ouverture SAISIE À LA MAIN par OD au premier jour de
 * N+1, sans import · la clôture la lisait pas, et le report la doublait. Le
 * périmètre est désormais le premier jour, toutes origines.
 */
for (const referentiel of ['SYSCOHADA', 'SYCEBNL'] as const) {
  test(`${referentiel} · R1 · une ouverture saisie par OD au premier jour n'est jamais doublée par la clôture`, async ({ page }) => {
    const pannes = surveiller(page);
    const dossier = await creerDossier(page, { referentiel, nom: `R1 e2e ${referentiel}`, montant: MONTANT });
    await seConnecter(page, dossier.email);
    const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
    await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
    const debut = lendemain(exercice.dateFin);
    const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debut, dateFin: `${debut.slice(0, 4)}-12-31` });
    const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
    const banque = comptes.find((c) => c.numero.startsWith('52'))!;
    const resultat = comptes.find((c) => c.numero.startsWith('131'))!;
    const journaux = await appelApi<Array<{ id: string; type: string }>>(page, 'GET', '/journaux');
    const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
    await appelApi(page, 'POST', '/ecritures', {
      exerciceId: suivant.id, journalId: od.id, date: debut, libelle: 'Ouverture saisie à la main',
      lignes: [{ compteId: banque.id, debit: MONTANT, credit: 0 }, { compteId: resultat.id, debit: 0, credit: MONTANT }],
    });
    await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: suivant.id, dateLimite: debut });

    await page.goto('/#/exercice');
    await page.locator('select').first().selectOption(exercice.id);
    await expect(page.getByText(/concordante, aucun report ne sera ajouté/)).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: "Clôturer l'exercice" }).click();
    await expect(page.getByText(/correspond au bilan de clôture, par compte et par devise/)).toBeVisible();

    const { lignes } = await appelApi<{ lignes: { numero: string; solde: number }[] }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`);
    const solde = (n: string) => lignes.filter((l) => l.numero === n).reduce((t, l) => t + Number(l.solde), 0);
    expect({ banque: solde(banque.numero), resultat: solde(resultat.numero) }).toEqual({ banque: MONTANT, resultat: -MONTANT });
    expect(pannes).toEqual([]);
  });
}
