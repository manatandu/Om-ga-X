import { expect, test, type Page } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE TVA-DECISIONS, SUR LA BASE RÉELLE ET À TRAVERS UNE CLÔTURE · rejouée
 * avant intégration par l'API du serveur compilé, gelée ici.
 *
 *  (A) la vente annulée par inscription en négatif (AUDCIF art. 20, al. 2) se
 *      lit au signe près · période liquidée, sa taxe se RÉCUPÈRE une fois au
 *      premier jour non liquidé (O.-L. n° 10/001, art. 52, al. 1 ; décret
 *      n° 011/42, art. 126) ;
 *  (B) la ligne validée après la liquidation de sa période se rattache au
 *      premier jour non liquidé (AUDCIF art. 22, 4°), nommée ;
 *  (D) décision de Manasse du 2026-10-08 · l'exemple de référence · vente de
 *      1 000 000 HT + 160 000 de TVA, reclassée au 4162, dépréciée de 50 %,
 *      perdue en N+1 avec le duplicata · la créance revient au 4111, puis
 *      D 6511 1 000 000 / D 4431 160 000 / C 4111 1 160 000 · aucun montant
 *      négatif, aucun crédit au 651 ; le 443 débité est lu en déduction le
 *      mois suivant. Une prestation (taxe à l'encaissement) s'annule au 4432
 *      sans être déduite ni lue comme un encaissement.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Ligne { id: string; debit: number; credit: number; lettre: string | null }

async function preparer(page: Page, nom: string) {
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom, montant: 10_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/regime', { assujettiTva: true });
  const [ex] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const a = Number(ex.dateDebut.slice(0, 4));
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const detail = (r: string) => comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith(r))!;
  const journaux = await appelApi<Array<{ id: string; type: string; compteTresorerieId: string | null }>>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const bq = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerieId)!;
  const taux = (await appelApi<Array<{ id: string; taux: number }>>(page, 'GET', '/taux-tva')).find((t) => Number(t.taux) === 16)!;
  const nouveau = (numero: string) =>
    appelApi<Compte>(page, 'POST', '/comptes', { numero, intitule: `Client ${numero}`, typeCompte: 'DETAIL', lettrable: true, modeReportANouveau: 'DETAIL' });
  const ecrire = (e: Exercice, date: string, libelle: string, lignes: unknown[]) =>
    appelApi<{ id: string }>(page, 'POST', '/ecritures', { exerciceId: e.id, journalId: od.id, date, libelle, lignes });
  const valider = (e: Exercice) => appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: e.id, dateLimite: e.dateFin.slice(0, 10) });
  const vente = (e: Exercice, compteId: string, date: string, ttc: number, ht: number, tva: number, produit = '701', compteTva = '4431') =>
    ecrire(e, date, `Vente ${date}`, [
      { compteId, debit: ttc, credit: 0 },
      { compteId: detail(produit).id, debit: 0, credit: ht },
      { compteId: detail(compteTva).id, debit: 0, credit: tva, tauxTvaId: taux.id },
    ]);
  const comptant = (e: Exercice, date: string, ttc: number, ht: number, tva: number) => vente(e, bq.compteTresorerieId!, date, ttc, ht, tva);
  const declaration = (d: string, f: string) => appelApi<Record<string, any>>(page, 'GET', `/taux-tva/declaration?dateDebut=${d}&dateFin=${f}`);
  const liquider = async (e: Exercice, d: string, f: string) => {
    await appelApi(page, 'POST', '/taux-tva/declaration/comptabiliser', { exerciceId: e.id, dateDebut: d, dateFin: f });
    await valider(e);
  };
  const balance = async (e: Exercice) => {
    const { lignes } = await appelApi<{ lignes: Array<{ numero: string; solde: number }> }>(page, 'GET', `/ecritures/balance?exerciceId=${e.id}`);
    return (n: string) => lignes.find((l) => l.numero === n)?.solde ?? 0;
  };
  return { ex, a, detail, od, bq, nouveau, ecrire, valider, vente, comptant, declaration, liquider, balance };
}

test('SYSCOHADA · (A) la vente annulée en négatif après sa liquidation se récupère une fois ; (B) la ligne validée après la liquidation se rattache au premier jour non liquidé', async ({ page }) => {
  const pannes = surveiller(page);
  const t = await preparer(page, 'TVA négatifs e2e');
  const { ex, a } = t;
  const k1 = await t.nouveau('41110201');
  const v1 = await t.vente(ex, k1.id, `${a}-02-10`, 1_160_000, 1_000_000, 160_000);
  await t.valider(ex);
  expect((await t.declaration(`${a}-02-01`, `${a}-02-28`)).totalCollecte).toBe(160_000);
  await t.liquider(ex, `${a}-02-01`, `${a}-02-28`);
  await appelApi(page, 'POST', `/ecritures/${v1.id}/correction`, { date: `${a}-03-05`, motifCorrection: 'Vente annulée, marchandise reprise' });
  await t.valider(ex);
  // Février reste ce qu'il a déclaré ; mars récupère la taxe, nommée.
  expect((await t.declaration(`${a}-02-01`, `${a}-02-28`)).totalCollecte).toBe(160_000);
  const mars = await t.declaration(`${a}-03-01`, `${a}-03-31`);
  expect(mars.netAvantImputation).toBe(-160_000);
  expect(mars.negatifsDeFactures[0]).toMatchObject({ montant: 160_000, pese: 'REPRISE_ICI', factureCorrigee: { date: `${a}-02-10` } });
  await t.liquider(ex, `${a}-03-01`, `${a}-03-31`);
  // (B) mai et juin liquidés, puis une vente du 15 mai saisie et validée.
  await t.comptant(ex, `${a}-05-20`, 232_000, 200_000, 32_000);
  await t.valider(ex);
  await t.liquider(ex, `${a}-05-01`, `${a}-05-31`);
  await t.comptant(ex, `${a}-06-10`, 116_000, 100_000, 16_000);
  await t.valider(ex);
  await t.liquider(ex, `${a}-06-01`, `${a}-06-30`);
  await t.comptant(ex, `${a}-05-15`, 116_000, 100_000, 16_000);
  await t.valider(ex);
  expect((await t.declaration(`${a}-05-01`, `${a}-05-31`)).totalCollecte).toBe(32_000);
  const juillet = await t.declaration(`${a}-07-01`, `${a}-07-31`);
  expect(juillet.totalCollecte).toBe(16_000);
  expect(juillet.rattachementsTardifs).toEqual([expect.objectContaining({ dateOrigine: `${a}-05-15`, rattacheeAu: `${a}-07-01`, nature: 'COLLECTE', montant: 16_000 })]);
  await t.liquider(ex, `${a}-07-01`, `${a}-07-31`);
  expect((await t.balance(ex))(t.detail('4431').numero)).toBe(0);
  expect(pannes).toEqual([]);
});

test('SYSCOHADA · (D) l’exemple de référence · la perte récupère la TVA en deux pièces, sans négatif ni crédit au 651, à travers la clôture', async ({ page }) => {
  const pannes = surveiller(page);
  const t = await preparer(page, 'TVA perte e2e');
  const { ex, a, od } = t;
  const kL = await t.nouveau('41110301');
  const kM = await t.nouveau('41110302');
  await t.vente(ex, kL.id, `${a}-06-01`, 1_160_000, 1_000_000, 160_000);
  await t.vente(ex, kM.id, `${a}-06-02`, 580_000, 500_000, 80_000, '706', '4432');
  await t.valider(ex);
  await t.liquider(ex, `${a}-06-01`, `${a}-06-30`);
  const ligne = async (k: Compte, debit: number) => (await appelApi<{ lignes: Ligne[] }>(page, 'GET', `/comptes/${k.id}/lettrage`)).lignes.find((l) => l.debit === debit)!;
  const pieces = [{ nature: 'Mise en demeure', reference: 'MD-1' }];
  const preuve = [{ nature: 'Jugement de clôture pour insuffisance d’actif', reference: 'TC-118' }];
  const reclasser = async (k: Compte, montant: number) =>
    appelApi<{ id: string }>(page, 'POST', '/creances-douteuses', {
      exerciceId: ex.id, journalId: od.id, date: `${a}-08-31`, compteCreanceId: k.id, nature: 'DOUTEUSE', montant, motif: 'Client défaillant', pieces,
      factures: [{ ligneEcritureId: (await ligne(k, montant)).id, montant }],
    });
  const L = await reclasser(kL, 1_160_000);
  const M = await reclasser(kM, 580_000);
  // Dépréciation de 50 % de L · D 6594 / C 4912 580 000.
  await appelApi(page, 'POST', `/creances-douteuses/${L.id}/revue`, { exerciceId: ex.id, journalId: od.id, depreciationNecessaire: 580_000, motif: 'Client en difficulté', pieces });
  await t.valider(ex);
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: `${a + 1}-01-01`, dateFin: `${a + 1}-12-31` });
  await appelApi(page, 'POST', `/exercices/${ex.id}/cloturer`);

  // Janvier et février de N+1 liquidés · la perte de mars s'inscrit en avril.
  for (const [m, fin] of [['01', '31'], ['02', '28']]) {
    await t.comptant(suivant, `${a + 1}-${m}-25`, 116_000, 100_000, 16_000);
    await t.valider(suivant);
    await t.liquider(suivant, `${a + 1}-${m}-01`, `${a + 1}-${m}-${fin}`);
  }
  const perte = async (cr: { id: string }, montant: number, date: string) => {
    const p = await appelApi<{ factures: Array<{ designationId: string }> }>(page, 'GET', `/creances-douteuses/${cr.id}/recuperation-tva`);
    return appelApi<{ montantHt: number; montantTva: number; montantTvaAnnulee: number; lettrageOrigine: { pose: boolean } }>(page, 'POST', `/creances-douteuses/${cr.id}/perte`, {
      exerciceId: suivant.id, journalId: od.id, date, montant, motif: 'Liquidation du client', pieces: preuve,
      duplicatas: [{ designationId: p.factures[0].designationId, reference: `DUP-${cr.id.slice(0, 4)}`, dateEnvoi: `${a + 1}-03-01` }],
    });
  };
  const pL = await perte(L, 1_160_000, `${a + 1}-03-15`);
  expect(pL).toMatchObject({ montantHt: 1_000_000, montantTva: 160_000, montantTvaAnnulee: 0, lettrageOrigine: { pose: true } });
  const pM = await perte(M, 580_000, `${a + 1}-03-20`);
  expect(pM).toMatchObject({ montantHt: 500_000, montantTva: 0, montantTvaAnnulee: 80_000 });
  await t.comptant(suivant, `${a + 1}-03-25`, 116_000, 100_000, 16_000);
  await t.valider(suivant);
  const mars = await t.declaration(`${a + 1}-03-01`, `${a + 1}-03-31`);
  // La perte de M n'encaisse rien · seule la vente comptant est collectée.
  expect(mars).toMatchObject({ totalCollecte: 16_000, avoirsCollecteConstates: 160_000, avoirsSansNoteDeCredit: 0 });
  await t.liquider(suivant, `${a + 1}-03-01`, `${a + 1}-03-31`);
  expect((await t.declaration(`${a + 1}-04-01`, `${a + 1}-04-30`)).recuperationArt52).toBe(160_000);
  await t.liquider(suivant, `${a + 1}-04-01`, `${a + 1}-04-30`);
  // La dépréciation se reprend à la revue de N+1 · D 4912 / C 7594 580 000.
  await appelApi(page, 'POST', `/creances-douteuses/${L.id}/revue`, { exerciceId: suivant.id, journalId: od.id, depreciationNecessaire: 0, motif: 'Créance éteinte', pieces: preuve });
  await t.valider(suivant);
  const solde = await t.balance(suivant);
  expect(solde(t.detail('6511').numero)).toBe(1_500_000);
  expect(solde('41110301')).toBe(0);
  expect(solde('41110302')).toBe(0);
  expect(solde('41620000')).toBe(0);
  expect(solde('44310000')).toBe(0);
  expect(solde('44320000')).toBe(0);
  expect(solde('49120000')).toBe(0);
  expect(solde(t.detail('7594').numero)).toBe(-580_000);
  // Le retour et la perte se lettrent entre eux, jamais avec la facture.
  const lignesL = (await appelApi<{ lignes: Ligne[] }>(page, 'GET', `/comptes/${kL.id}/lettrage`)).lignes;
  expect(lignesL.filter((l) => l.lettre).length).toBe(2);
  expect(pannes).toEqual([]);
});
