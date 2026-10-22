import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * ORDRE DE VIREMENT EN DEVISE (ligne sage-l3, n° 37 · Sage, « devise du
 * compte bancaire » du donneur d'ordre), sur le serveur réel et une vraie
 * base, à travers une clôture.
 *
 * Décision D1 de la ligne · la loi n° 23/053, art. 141, 1° impose la monnaie
 * de la TENUE des comptes, pas celle du compte bancaire ; un RIB en dollars
 * porte donc un ordre en dollars, dont chaque ligne est réglée dans cette
 * monnaie. Ici · un RIB SANS devise refuse la ligne en dollars en nommant
 * l'issue ; la devise posée sur le RIB, l'ordre part en USD avec sa
 * contrevaleur en francs ; un RIB en dollars refuse encore un règlement en
 * francs ; la clôture de N passe et l'ordre de N+1 suit la numérotation.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string }
interface Groupe { compteId: string; lignes: Array<{ id: string }> }
interface Ordre {
  numero: number;
  devise: string | null;
  total: string | number;
  totalDevise: string | number | null;
  lignes: Array<{ montant: string | number; montantDevise: string | number | null; beneficiaire: string }>;
}

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);
const refusDe = (p: Promise<unknown>) => p.then(() => 'accepté', (e: unknown) => String(e));

test('ordre de virement en devise · refus sans devise au RIB, ordre en USD avec contrevaleur, clôture traversée', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Virement devise e2e SARL', montant: 5_000_000 });
  await seConnecter(page, dossier.email);
  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = N.dateDebut.slice(0, 4);

  // Le dollar, coté une fois pour toute la période · aucun écart de change,
  // la clôture n'a rien à réévaluer ni à constater.
  const usd = await appelApi<{ id: string }>(page, 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' });
  const coter = (date: string) => appelApi(page, 'POST', `/devises/${usd.id}/cours`, { date, cours: 1680 });
  await coter(`${annee}-02-01`);

  // Le donneur d'ordre · journal BQ, RIB d'abord SANS devise.
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const bq = journaux.find((j) => j.code === 'BQ')!;
  const achats = journaux.find((j) => j.type === 'ACHATS')!;
  const banque = await appelApi<{ id: string }>(page, 'POST', '/banques', { intitule: 'Rawbank' });
  const rib = await appelApi<{ id: string }>(page, 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW', numeroCompte: '0001234', journalId: bq.id });

  const fournisseur = await appelApi<{ id: string; compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', {
    type: 'FOURNISSEUR',
    code: 'FRS-USD',
    nom: 'Kinshasa Supplies',
  });
  await appelApi(page, 'POST', `/tiers/${fournisseur.id}/ribs`, { banque: 'Equity BCDC', numeroCompte: '0009876' });
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const achat = comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith('601'))!;
  await appelApi(page, 'PATCH', `/comptes/${achat.id}`, { estRetenu: true });
  const compteFournisseur = comptes.find((c) => c.numero === fournisseur.compteIndividuel.numero)!.id;

  // Une facture en dollars · 1 000 USD au cours de 1 680, soit 1 680 000 CDF.
  const facturer = (exerciceId: string, date: string, usdMontant: number) =>
    appelApi(page, 'POST', '/ecritures', {
      exerciceId,
      journalId: achats.id,
      date,
      libelle: `Facture Kinshasa Supplies ${date}`,
      lignes: [
        { compteId: achat.id, libelle: 'Fournitures', debit: usdMontant * 1680, credit: 0 },
        { compteId: compteFournisseur, libelle: 'Kinshasa Supplies', debit: 0, credit: usdMontant * 1680, dateEcheance: date, deviseId: usd.id, montantDevise: usdMontant, coursApplique: 1680 },
      ],
    });
  // Le règlement en dollars · aucune imputation déclarée (refusée en devise),
  // le cours du jour donné, le dû entier.
  const payer = async (exerciceId: string, date: string, enDevise: boolean) => {
    const groupes = await appelApi<Groupe[]>(page, 'GET', `/reglements/echeances?exerciceId=${exerciceId}&sens=FOURNISSEUR`);
    const facture = groupes.find((g) => g.compteId === compteFournisseur)!.lignes[0];
    return appelApi<{ ordre: { id: string; numero: number } }>(page, 'POST', '/reglements', {
      exerciceId,
      journalId: bq.id,
      sens: 'FOURNISSEUR',
      date,
      ordreVirement: true,
      ...(enDevise ? { tresorerieEnDevise: true, deviseTresorerieId: usd.id } : {}),
      reglements: [{ compteId: compteFournisseur, ligneIds: [facture.id], ...(enDevise ? { coursReglement: 1680 } : {}) }],
    });
  };

  await facturer(N.id, `${annee}-02-12`, 1000);

  // RIB SANS DEVISE · la ligne en dollars est refusée avant toute pièce, et
  // l'issue est nommée (renseigner la devise du RIB).
  expect(await refusDe(payer(N.id, `${annee}-03-15`, true))).toMatch(/aucune devise renseignée.*Structure > Banques/);

  // La devise posée sur le RIB · l'ordre part en USD.
  await appelApi(page, 'PATCH', `/ribs-banque/${rib.id}`, { devise: 'USD' });
  const premier = await payer(N.id, `${annee}-03-15`, true);
  const ordre = await appelApi<Ordre>(page, 'GET', `/ordres-virement/${premier.ordre.id}`);
  expect(ordre.devise).toBe('USD');
  expect(Number(ordre.totalDevise)).toBe(1000);
  expect(Number(ordre.total)).toBe(1_680_000);
  expect(ordre.lignes).toHaveLength(1);
  expect(Number(ordre.lignes[0].montantDevise)).toBe(1000);
  expect(Number(ordre.lignes[0].montant)).toBe(1_680_000);

  // L'ÉCRAN · la liste porte le montant en dollars, le détail sa colonne
  // « Montant USD » et la contrevaleur en francs.
  await page.goto('/#/reglements');
  await page.getByRole('tab', { name: 'Ordres de virement' }).click();
  await page.getByRole('cell', { name: String(premier.ordre.numero), exact: true }).first().click();
  await expect(page.getByRole('columnheader', { name: 'Montant USD', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Contrevaleur CDF', exact: true }).first()).toBeVisible();

  // RIB EN DOLLARS, FACTURE EN FRANCS · refusé (règle d'avant la ligne,
  // inchangée) · la trésorerie recevrait des francs sans leur devise.
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: N.id,
    journalId: achats.id,
    date: `${annee}-04-02`,
    libelle: 'Facture en francs',
    lignes: [
      { compteId: achat.id, libelle: 'Fournitures', debit: 232_000, credit: 0 },
      { compteId: compteFournisseur, libelle: 'Kinshasa Supplies', debit: 0, credit: 232_000, dateEcheance: `${annee}-04-02` },
    ],
  });
  expect(await refusDe(payer(N.id, `${annee}-04-20`, false))).toMatch(/tenu en USD et les factures choisies sont en francs/);

  // LA CLÔTURE DE N · le fournisseur est soldé dans sa devise, rien à
  // réévaluer ; la facture en francs reste ouverte et se reporte.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: N.id, dateLimite: jour(N.dateFin) });
  const debutSuivant = lendemain(N.dateFin);
  const N1 = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${debutSuivant.slice(0, 4)}-12-31` });
  await appelApi(page, 'POST', `/exercices/${N.id}/cloturer`);
  const anneeSuivante = debutSuivant.slice(0, 4);

  // EN N+1 · une seconde facture en dollars, un second ordre en USD qui suit
  // la numérotation continue du dossier.
  await coter(`${anneeSuivante}-01-15`);
  await facturer(N1.id, `${anneeSuivante}-02-10`, 500);
  const groupes = await appelApi<Groupe[]>(page, 'GET', `/reglements/echeances?exerciceId=${N1.id}&sens=FOURNISSEUR`);
  const facture = groupes.find((g) => g.compteId === compteFournisseur)!;
  // Le reporté en francs et la facture en dollars partagent le compte · on
  // ne règle que la ligne en dollars de N+1.
  const ligneUsd = facture.lignes[facture.lignes.length - 1];
  const second = await appelApi<{ ordre: { id: string; numero: number } }>(page, 'POST', '/reglements', {
    exerciceId: N1.id,
    journalId: bq.id,
    sens: 'FOURNISSEUR',
    date: `${anneeSuivante}-03-10`,
    ordreVirement: true,
    tresorerieEnDevise: true,
    deviseTresorerieId: usd.id,
    reglements: [{ compteId: compteFournisseur, ligneIds: [ligneUsd.id], coursReglement: 1680 }],
  });
  expect(second.ordre.numero).toBe(premier.ordre.numero + 1);
  const ordreN1 = await appelApi<Ordre>(page, 'GET', `/ordres-virement/${second.ordre.id}`);
  expect(ordreN1.devise).toBe('USD');
  expect(Number(ordreN1.totalDevise)).toBe(500);
  expect(Number(ordreN1.total)).toBe(840_000);

  // L'avis de règlement dit la somme virée en dollars et sa contrevaleur.
  await appelApi(page, 'POST', `/ordres-virement/${second.ordre.id}/impression`, {});
  const avis = await appelApi<{ avis: Array<{ document: string }> }>(page, 'GET', `/ordres-virement/${second.ordre.id}/avis-reglement`);
  expect(JSON.stringify(avis)).toMatch(/500,00 USD \(contrevaleur comptable 840\s000,00 CDF\)/);

  expect(pannes).toEqual([]);
});
