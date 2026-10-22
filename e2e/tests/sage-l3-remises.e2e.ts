import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * REMISES DE CHÈQUES (ligne sage-l3, n° 40 · Sage, « Moyens de paiement »,
 * remise en deux temps), sur le serveur réel et une vraie base, à travers
 * une clôture. Fiche du compte 51 des deux plans · 513 à la réception par le
 * crédit du tiers, 514 au bordereau, soldé par la banque à l'avis de crédit,
 * la commission en services bancaires (6315) ; fiche du compte 41 · l'impayé
 * au 413 (4131 chèques impayés au SYSCOHADA). Ici · une réception lettrée
 * avec sa facture, un bordereau numéroté et imprimé, un avis avec commission,
 * un chèque remis en décembre dont le 514 traverse la clôture et se solde par
 * l'avis de janvier, un impayé au 4131 puis son annulation, et les refus
 * nommés (transit sur des cartes, remise créditée qu'on annule).
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string }
interface Groupe { compteId: string; lignes: Array<{ id: string }> }
interface LigneBalance { numero: string; reportDebit: number; reportCredit: number; mouvementDebit: number; mouvementCredit: number; solde: number }

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);
const refusDe = (p: Promise<unknown>) => p.then(() => 'accepté', (e: unknown) => String(e));

test('remises de chèques · réception lettrée, bordereau imprimé, avis avec commission, clôture traversée, impayé au 4131', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Remises e2e SARL', montant: 5_000_000 });
  await seConnecter(page, dossier.email);
  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = N.dateDebut.slice(0, 4);
  const balance = async (exerciceId: string) => (await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${exerciceId}`)).lignes;
  const solde = (lignes: LigneBalance[], racine: string) => lignes.filter((l) => l.numero.startsWith(racine)).reduce((s, l) => s + l.solde, 0);

  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const bq = journaux.find((j) => j.code === 'BQ')!;
  const ventes = journaux.find((j) => j.type === 'VENTES')!;
  const od = journaux.find((j) => j.type === 'GENERAL')!;

  const client = await appelApi<{ id: string; compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', { type: 'CLIENT', code: 'CLI-CHQ', nom: 'Client Chèques' });
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const compte = (numero: string) => comptes.find((c) => c.numero === numero)!;
  const produit = comptes.find((c) => c.numero.startsWith('701'))!;
  await appelApi(page, 'PATCH', `/comptes/${produit.id}`, { estRetenu: true });
  const compteClient = compte(client.compteIndividuel.numero);

  // LE TYPE DE REMISE · chèques, banque BQ, opérations au journal général,
  // 513 / 514 / 6315 ; un type de cartes qui porte un transit est refusé.
  const type = await appelApi<{ id: string; code: string }>(page, 'POST', '/remises/types', {
    code: 'CHQ',
    intitule: 'Chèques Rawbank',
    nature: 'CHEQUES',
    journalBanqueId: bq.id,
    journalOperationsId: od.id,
    compteReceptionId: compte('51300000').id,
    compteTransitId: compte('51400000').id,
    compteCommissionId: compte('63150000').id,
  });
  expect(
    await refusDe(
      appelApi(page, 'POST', '/remises/types', {
        code: 'CB',
        intitule: 'Cartes',
        nature: 'CARTES',
        journalBanqueId: bq.id,
        journalOperationsId: od.id,
        compteReceptionId: compte('51500000').id,
        compteTransitId: compte('51400000').id,
      }),
    ),
  ).toMatch(/515 jusqu'à l'avis/);

  // UNE FACTURE DE VENTE, puis le chèque qui la règle, lettré avec elle.
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: N.id,
    journalId: ventes.id,
    date: `${annee}-03-02`,
    libelle: 'Facture client',
    lignes: [
      { compteId: compteClient.id, libelle: 'Client Chèques', debit: 1_160_000, credit: 0, dateEcheance: `${annee}-03-31` },
      { compteId: produit.id, libelle: 'Vente', debit: 0, credit: 1_160_000 },
    ],
  });
  const groupes = await appelApi<Groupe[]>(page, 'GET', `/reglements/echeances?exerciceId=${N.id}&sens=CLIENT`);
  const facture = groupes.find((g) => g.compteId === compteClient.id)!.lignes[0];
  const recevoir = (exerciceId: string, date: string, montant: number, reference: string, ligneIds?: string[]) =>
    appelApi<{ id: string; lettre: string | null; statut: string }>(page, 'POST', '/remises/valeurs', {
      exerciceId,
      typeRemiseId: type.id,
      compteTiersId: compteClient.id,
      date,
      montant,
      reference,
      banqueTiree: 'Equity BCDC',
      ligneIds,
    });
  const v1 = await recevoir(N.id, `${annee}-03-10`, 1_160_000, 'CHQ 0042', [facture.id]);
  expect(v1.lettre).not.toBeNull();
  const v2 = await recevoir(N.id, `${annee}-03-11`, 500_000, 'CHQ 0043');
  let b = await balance(N.id);
  expect(solde(b, '513')).toBe(1_660_000);
  expect(solde(b, compteClient.numero)).toBe(-500_000);

  // LE BORDEREAU · n° 1, D 514 / C 513, imprimé (enregistré au serveur).
  const remise1 = await appelApi<{ id: string; numero: number; total: number }>(page, 'POST', '/remises', {
    exerciceId: N.id,
    typeRemiseId: type.id,
    date: `${annee}-03-12`,
    valeurIds: [v1.id, v2.id],
  });
  expect([remise1.numero, remise1.total]).toEqual([1, 1_660_000]);
  const impression = await appelApi<{ document: string; duplicata: boolean }>(page, 'POST', `/remises/${remise1.id}/impression`, {});
  expect(impression.document).toContain('BORDEREAU DE REMISE N° 1');
  expect(impression.document).toContain('CHQ 0042');
  expect(impression.duplicata).toBe(false);
  b = await balance(N.id);
  expect([solde(b, '513'), solde(b, '514')]).toEqual([0, 1_660_000]);

  // L'AVIS DE CRÉDIT · D 52 (net) et D 6315 (commission) / C 514 pour solde.
  const banqueAvant = solde(b, '52');
  await appelApi(page, 'POST', `/remises/${remise1.id}/avis-credit`, { date: `${annee}-03-15`, referenceAvis: 'Relevé 03', commission: 5_000 });
  b = await balance(N.id);
  expect([solde(b, '514'), solde(b, '6315'), solde(b, '52') - banqueAvant]).toEqual([0, 5_000, 1_655_000]);
  expect(await refusDe(appelApi(page, 'POST', `/remises/${remise1.id}/annuler`, { motif: 'essai' }))).toMatch(/annulez d'abord l'avis de crédit/);

  // UN CHÈQUE REMIS EN DÉCEMBRE, NON CRÉDITÉ · le 514 traverse la clôture.
  const v3 = await recevoir(N.id, `${annee}-12-20`, 300_000, 'CHQ 0044');
  // Et UN CHÈQUE REÇU EN DÉCEMBRE, NON REMIS avant la clôture (relecture, M1) ·
  // le 513 le reporte, le bordereau de janvier le propose encore.
  const v4 = await recevoir(N.id, `${annee}-12-28`, 120_000, 'CHQ 0045');
  const remise2 = await appelApi<{ id: string; numero: number }>(page, 'POST', '/remises', { exerciceId: N.id, typeRemiseId: type.id, date: `${annee}-12-22`, valeurIds: [v3.id] });
  expect(remise2.numero).toBe(2);
  // UN IMPAYÉ DÉCLARÉ AVANT LE CRÉDIT FERME L'AVIS (BLOQUANT B1 de la
  // relecture) · l'avis créditait le total figé, 514 créditeur et 52 majoré.
  const comptesImpaye = await appelApi<{ racine: string; comptes: Array<{ id: string; numero: string }> }>(
    page,
    'GET',
    `/remises/comptes?role=IMPAYE&nature=CHEQUES&compteTiersId=${compteClient.id}`,
  );
  expect(comptesImpaye.racine).toBe('4131');
  await appelApi(page, 'POST', `/remises/valeurs/${v3.id}/impaye`, { date: `${annee}-12-27`, compteImpayeId: comptesImpaye.comptes[0].id });
  expect(await refusDe(appelApi(page, 'POST', `/remises/${remise2.id}/avis-credit`, { date: `${annee}-12-29`, referenceAvis: 'Relevé 12' }))).toMatch(
    /CHQ 0044.*impayée avant le crédit.*annulez l'impayé/,
  );
  await appelApi(page, 'POST', `/remises/valeurs/${v3.id}/impaye/annuler`, { motif: 'impayé déclaré par erreur avant le crédit' });
  expect(solde(await balance(N.id), '4131')).toBe(0);
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: N.id, dateLimite: jour(N.dateFin) });
  const debutSuivant = lendemain(N.dateFin);
  const N1 = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${debutSuivant.slice(0, 4)}-12-31` });
  await appelApi(page, 'POST', `/exercices/${N.id}/cloturer`);
  const anneeSuivante = debutSuivant.slice(0, 4);
  expect(solde(await balance(N.id), '514')).toBe(300_000);
  expect(solde(await balance(N.id), '513')).toBe(120_000);

  // L'AVIS DE JANVIER solde le 514 reporté · l'écriture est dans N+1.
  await appelApi(page, 'POST', `/remises/${remise2.id}/avis-credit`, { date: `${anneeSuivante}-01-08`, referenceAvis: 'Relevé 01' });
  b = await balance(N1.id);
  const c514 = b.find((l) => l.numero === '51400000')!;
  expect([c514.reportDebit, c514.mouvementCredit, c514.solde]).toEqual([300_000, 300_000, 0]);

  // LE CHÈQUE DE DÉCEMBRE NON REMIS se remet en janvier (M1) · la liste des
  // valeurs à remettre n'a pas de borne d'exercice, et le 513 reporté se solde.
  const aRemettre = await appelApi<{ valeurs: Array<{ id: string; exercice: { id: string } }>; total: number }>(page, 'GET', `/remises/valeurs/a-remettre?typeRemiseId=${type.id}`);
  expect(aRemettre.valeurs.map((v) => [v.id, v.exercice.id])).toEqual([[v4.id, N.id]]);
  const remise3 = await appelApi<{ id: string; numero: number }>(page, 'POST', '/remises', { exerciceId: N1.id, typeRemiseId: type.id, date: `${anneeSuivante}-01-10`, valeurIds: [v4.id] });
  expect(remise3.numero).toBe(3);
  b = await balance(N1.id);
  expect([solde(b, '513'), solde(b, '514')]).toEqual([0, 120_000]);
  // L'AVIS DE JANVIER D'UN BORDEREAU DE DÉCEMBRE S'ANNULE DANS N+1 (BLOQUANT
  // B2) · jugé sur l'exercice du bordereau, clôturé, l'avis faux était enfermé.
  const avisAnnule = await appelApi<{ statut: string; ecritureNegatifCreditId: string | null }>(page, 'POST', `/remises/${remise2.id}/avis-credit/annuler`, { motif: 'avis saisi sur le mauvais relevé' });
  expect([avisAnnule.statut, avisAnnule.ecritureNegatifCreditId]).toEqual(['REMISE', null]);
  expect(solde(await balance(N1.id), '514')).toBe(420_000);
  await appelApi(page, 'POST', `/remises/${remise2.id}/avis-credit`, { date: `${anneeSuivante}-01-08`, referenceAvis: 'Relevé 01' });
  expect(solde(await balance(N1.id), '514')).toBe(120_000);

  // L'IMPAYÉ d'un chèque crédité · D 4131 / C 52, puis son annulation.
  const impaye = await appelApi<{ compteImpaye: string; statut: string }>(page, 'POST', `/remises/valeurs/${v3.id}/impaye`, {
    date: `${anneeSuivante}-01-15`,
    compteImpayeId: comptesImpaye.comptes[0].id,
  });
  expect([impaye.compteImpaye, impaye.statut]).toEqual(['41310000', 'IMPAYEE']);
  b = await balance(N1.id);
  expect(solde(b, '4131')).toBe(300_000);
  const annule = await appelApi<{ statut: string; ecritureNegatifImpayeId: string | null }>(page, 'POST', `/remises/valeurs/${v3.id}/impaye/annuler`, { motif: 'erreur de lecture du relevé' });
  expect([annule.statut, annule.ecritureNegatifImpayeId]).toEqual(['CREDITEE', null]);
  expect(solde(await balance(N1.id), '4131')).toBe(0);

  // L'ÉCRAN · les bordereaux et les types se lisent.
  await page.goto('/#/remises');
  await page.getByRole('tab', { name: 'Bordereaux de remise' }).click();
  await expect(page.getByRole('columnheader', { name: 'Avis de crédit', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Relevé 01', exact: false }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Types de remise' }).click();
  await expect(page.getByRole('cell', { name: 'CHQ', exact: true })).toBeVisible();

  expect(pannes).toEqual([]);
});
