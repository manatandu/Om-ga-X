import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * UN LETTRAGE PARTIEL TRAVERSE LA CLÔTURE (ligne lettrage-cloture, AUDCIF
 * art. 34 ; fiches des comptes 40 et 41).
 *
 * Le défaut de la simulation du 2026-10-08 · une facture client de
 * 34 800 000 et son acompte de 20 000 000, réunis en lettrage partiel en N,
 * arrivaient en N+1 SÉPARÉS par le report Détail · le règlement de la
 * facture entière passait, et le client finissait créditeur de 20 000 000
 * sans un mot. Ce parcours passe par les routes, le serveur compilé et une
 * base PostgreSQL · le groupe est reconstitué sur les lignes d'à-nouveau,
 * l'écran sert la facture pour son reste, le règlement de la facture entière
 * est refusé, celui du reste solde le groupe.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string; compteTresorerieId: string | null; estActif: boolean }
interface LigneLettrage { id: string; debit: number; credit: number; lettrageId: string | null }
interface Groupe { id: string; code: string; statut: string; origine: string; solde: number }

const jour = (iso: string) => iso.slice(0, 10);
const jourPlus = (iso: string, jours: number) => new Date(Date.parse(jour(iso)) + jours * 86_400_000).toISOString().slice(0, 10);

test('SYSCOHADA · facture et acompte lettrés en partiel en N · reconduits à la clôture, réglés pour le reste en N+1', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Lettrage clôture e2e SARL', montant: 10_000 });
  await seConnecter(page, dossier.email);

  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const vente = comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith('701'))!;
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const general = journaux.find((j) => j.type === 'GENERAL')!;
  const tresorerie = journaux.find((j) => j.type === 'TRESORERIE' && j.estActif && j.compteTresorerieId)!;
  const client = await appelApi<Compte>(page, 'POST', '/comptes', {
    numero: '41110101',
    intitule: 'Client Matadi e2e',
    typeCompte: 'DETAIL',
    lettrable: true,
    modeReportANouveau: 'DETAIL',
  });

  // N · l'acompte, puis la facture, lettrés en PARTIEL.
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: N.id, journalId: tresorerie.id, date: jourPlus(N.dateDebut, 40), libelle: 'Acompte Matadi',
    lignes: [
      { compteId: tresorerie.compteTresorerieId, libelle: 'Acompte Matadi', debit: 20_000_000, credit: 0 },
      { compteId: client.id, libelle: 'Acompte Matadi', debit: 0, credit: 20_000_000 },
    ],
  });
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: N.id, journalId: general.id, date: jourPlus(N.dateDebut, 60), libelle: 'Facture V-1 Matadi',
    lignes: [
      { compteId: client.id, libelle: 'Facture V-1', debit: 34_800_000, credit: 0 },
      { compteId: vente.id, libelle: 'Facture V-1', debit: 0, credit: 34_800_000 },
    ],
  });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: N.id, dateLimite: jour(N.dateFin) });
  const lignesN = (await appelApi<{ lignes: LigneLettrage[] }>(page, 'GET', `/comptes/${client.id}/lettrage`)).lignes;
  await appelApi(page, 'POST', `/comptes/${client.id}/lettrage`, { ligneIds: lignesN.map((l) => l.id), autoriserPartiel: true });

  // N+1, puis la clôture de N · la reconduction est dite.
  const debutN1 = jourPlus(N.dateFin, 1);
  const N1 = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutN1, dateFin: `${debutN1.slice(0, 4)}-12-31` });
  const cloture = await appelApi<{ issueOuverture: string[] }>(page, 'POST', `/exercices/${N.id}/cloturer`, {});
  expect(cloture.issueOuverture.join(' ')).toMatch(/1 lettrage\(s\) partiel\(s\) reconduit\(s\)/);

  // N+1 · le groupe est reconstitué sur les deux lignes d'à-nouveau.
  const etat = await appelApi<{ lignes: LigneLettrage[]; lettrages: Groupe[] }>(page, 'GET', `/comptes/${client.id}/lettrage`);
  const reconduit = etat.lettrages.find((g) => g.origine === 'CLOTURE')!;
  expect({ statut: reconduit.statut, solde: reconduit.solde }).toEqual({ statut: 'PARTIEL', solde: 14_800_000 });

  // Le règlement de la facture entière est refusé, nommé.
  const echeances = await appelApi<Array<{ compteId: string; lignes: Array<{ id: string; montant: number }> }>>(
    page, 'GET', `/reglements/echeances?exerciceId=${N1.id}&sens=CLIENT`,
  );
  const facture = echeances.find((g) => g.compteId === client.id)!.lignes;
  expect(facture.map((l) => l.montant)).toEqual([14_800_000]);
  await expect(
    appelApi(page, 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: N1.id, journalId: tresorerie.id, date: jourPlus(debutN1, 30),
      reglements: [{ compteId: client.id, ligneIds: [facture[0].id], montant: 34_800_000 }],
    }),
  ).rejects.toThrow(/dépasse le reste dû \(14800000\.00\).*lettrage partiel/);

  // L'ÉCRAN · la facture est servie pour son reste, et dit ce que le lettrage en a réglé.
  await page.reload();
  await page.goto('/#/reglements');
  await page.getByLabel(/^Règlement/).selectOption('CLIENT');
  await page.getByLabel('Échéances jusqu\'au').fill(jour(N1.dateFin));
  await expect(page.getByText(/déjà réglés dans le lettrage partiel b/)).toBeVisible();
  await page.getByLabel('Journal de trésorerie').selectOption(tresorerie.id);
  await page.getByLabel('Date du règlement').fill(jourPlus(debutN1, 30));
  await page.getByRole('checkbox', { name: 'Régler cette facture' }).first().check();
  await page.getByRole('button', { name: /Enregistrer 1 règlement/ }).click();

  // Le reste solde le groupe · le client finit à zéro.
  await expect
    .poll(async () => (await appelApi<{ lettrages: Groupe[] }>(page, 'GET', `/comptes/${client.id}/lettrage`)).lettrages.find((g) => g.id === reconduit.id)?.statut)
    .toBe('SOLDE');
  const { lignes } = await appelApi<{ lignes: Array<{ numero: string; solde: number }> }>(page, 'GET', `/ecritures/balance?exerciceId=${N1.id}`);
  expect(Number(lignes.find((l) => l.numero === client.numero)?.solde ?? 0)).toBe(0);
  expect(pannes).toEqual([]);
});
