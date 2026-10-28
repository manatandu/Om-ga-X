import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * CHÈQUES ÉMIS · ÉMIS, POINTÉ, ENCAISSÉ, À TRAVERS UNE CLÔTURE (ligne
 * microfina-m2, idée 9, relecture m12).
 *
 * Sur le serveur réel et une vraie base · un carnet sur le RIB du journal de
 * banque, un chèque tiré en N et relié à sa pièce, en circulation tant que la
 * banque ne l'a pas débité ; la ligne de la pièce pointée au rapprochement du
 * 31 mars le rend ENCAISSÉ, ce que l'écran lit après la clôture de N. Le
 * total en circulation se relit à une date d'arrêté (m9) · la veille du
 * relevé il porte le chèque, le jour du relevé il ne le porte plus.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string }
interface Journal { id: string; code: string; type: string; compteTresorerieId: string | null }
interface Registre { cheques: Array<{ id: string; etat: string; encaisseLe: string | null }>; enCirculation: { nombre: number; montant: number; au: string | null } }

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);

test('chèque émis puis pointé au rapprochement · encaissé, lu après la clôture', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Chèques e2e SARL', montant: 5_000_000 });
  await seConnecter(page, dossier.email);
  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = N.dateDebut.slice(0, 4);

  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const bq = journaux.find((j) => j.code === 'BQ')!;
  const banqueCompte = bq.compteTresorerieId!;
  const banque = await appelApi<{ id: string }>(page, 'POST', '/banques', { intitule: 'Rawbank' });
  await appelApi(page, 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW', numeroCompte: '0001234', journalId: bq.id });
  const ribs = (await appelApi<Array<{ id: string; ribs: Array<{ id: string }> }>>(page, 'GET', '/banques')).find((b) => b.id === banque.id)!.ribs;
  const fournisseur = await appelApi<{ id: string; compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', { type: 'FOURNISSEUR', code: 'FRS-CHQ', nom: 'Papeterie du Fleuve' });
  const compteFournisseur = (await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL')).find((c) => c.numero === fournisseur.compteIndividuel.numero)!;

  // Le carnet, puis la pièce de la banque qui paie par chèque, validée en N.
  const carnet = await appelApi<{ id: string }>(page, 'POST', '/cheques/chequiers', { ribId: ribs[0].id, numeroDebut: 201, numeroFin: 225, largeur: 7, dateReception: `${annee}-01-05` });
  const piece = await appelApi<{ id: string; lignes: Array<{ id: string; compteId: string }> }>(page, 'POST', '/ecritures', {
    exerciceId: N.id,
    journalId: bq.id,
    date: `${annee}-03-20`,
    libelle: 'Paiement Papeterie par chèque 201',
    lignes: [
      { compteId: compteFournisseur.id, libelle: 'Chèque 201', debit: 75_000, credit: 0 },
      { compteId: banqueCompte, libelle: 'Chèque 201', debit: 0, credit: 75_000 },
    ],
  });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: N.id, dateLimite: jour(N.dateFin) });
  const cheque = await appelApi<{ id: string }>(page, 'POST', '/cheques', {
    chequierId: carnet.id,
    numero: 201,
    dateEmission: `${annee}-03-20`,
    beneficiaire: 'Papeterie du Fleuve',
    montant: 75_000,
    ecritureId: piece.id,
  });
  let registre = await appelApi<Registre>(page, 'GET', '/cheques');
  expect(registre.cheques.find((c) => c.id === cheque.id)!.etat).toBe('EN_CIRCULATION');

  // Le relevé du 31 mars porte le débit · la ligne de la pièce est pointée.
  const rapprochement = await appelApi<{ id: string }>(page, 'POST', '/rapprochements', { compteId: banqueCompte, dateReleve: `${annee}-03-31`, soldeReleve: -75_000 });
  await appelApi(page, 'PATCH', `/rapprochements/${rapprochement.id}/depart`, { soldeDepart: 0, dateDepart: jour(N.dateDebut) });
  await appelApi(page, 'POST', `/rapprochements/${rapprochement.id}/pointer`, { ligneIds: [piece.lignes.find((l) => l.compteId === banqueCompte)!.id] });

  // La date d'arrêté · la veille du relevé, le chèque circule encore ; le jour du relevé, plus.
  const veille = await appelApi<Registre>(page, 'GET', `/cheques?au=${annee}-03-30`);
  expect(veille.enCirculation).toEqual({ nombre: 1, montant: 75_000, au: `${annee}-03-30` });
  const releve = await appelApi<Registre>(page, 'GET', `/cheques?au=${annee}-03-31`);
  expect(releve.enCirculation.montant).toBe(0);

  // La clôture de N · l'état se lit toujours au rapprochement.
  const N1 = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: lendemain(N.dateFin), dateFin: `${Number(annee) + 1}-12-31` });
  expect(N1.id).toBeTruthy();
  await appelApi(page, 'POST', `/exercices/${N.id}/cloturer`);
  registre = await appelApi<Registre>(page, 'GET', '/cheques');
  expect(registre.cheques.find((c) => c.id === cheque.id)).toMatchObject({ etat: 'ENCAISSE', encaisseLe: `${annee}-03-31` });

  // L'écran le dit, sans bouton d'annulation (la banque l'a payé).
  await page.goto('/#/cheques-emis');
  // La ligne du CHÈQUE, pas celle du chéquier (« 0000201 à … ») qui porte le
  // même numéro dans sa plage · nom de la ligne lu au début, date d'émission comprise.
  const ligne = page.getByRole('row', { name: /^RAW 0000201 \d{2}\/\d{2}\/\d{4}/ });
  await expect(ligne).toContainText(`Encaissé le 31/03/${annee}`);
  await expect(ligne.getByRole('button', { name: 'Annuler' })).toHaveCount(0);
  await expect(page.getByText(/En circulation · 0 chèque\(s\)/)).toBeVisible();

  expect(pannes).toEqual([]);
});
