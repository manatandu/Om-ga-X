import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE AU3, SUR LA BASE RÉELLE ET À TRAVERS UNE CLÔTURE · une balance
 * d'ouverture importée garde la devise de ses lignes, et une ligne importée
 * sans devise se DÉCLARE. N · bilan importé avec une créance (k1) et une
 * dette (f1) de 1 500 USD pour 3 200 000 ; une créance k2 importée en francs,
 * validée, déclarée 1 500 USD (inscrite en négatif puis exacte, AUDCIF
 * art. 20, al. 2) ; une créance k4 déclarée AU BROUILLARD, 500 USD pour
 * 1 100 000, le reste en francs. Réévaluation à la clôture de N au cours de
 * 2 400 (art. 54) · créances +400 000 et +400 000 et +100 000 au 479 (GAIN
 * latent, sans provision), dette −400 000 au 478 et provision 400 000 au
 * 4991 par le 6591. N clôturé, écarts contre-passés à l'ouverture de N+1 ;
 * règlement en devise au cours de 2 500 · 1 500 × 2 500 = 3 750 000 reçus,
 * gain RÉALISÉ de 550 000 au 756 (art. 55) pour k1 comme pour k2. Rejoué
 * avant intégration par l'API du serveur compilé (40 contrôles), gelé ici.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface LigneEcr { id: string; compteId: string; debit: string; credit: string; deviseId: string | null; montantDevise: string | null; coursApplique: string | null }
interface Ecr { id: string; libelle: string; lignes: LigneEcr[] }

test('SYSCOHADA · une balance importée garde sa devise, une ligne importée sans elle se déclare, et la réévaluation la lit à travers la clôture', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Devise AU3 e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  const [ex] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const a = Number(ex.dateDebut.slice(0, 4));
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const detail = (r: string) => comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith(r))!;
  const journaux = await appelApi<Array<{ id: string; type: string; compteTresorerieId: string | null }>>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const bq = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerieId)!;
  const banque = comptes.find((c) => c.id === bq.compteTresorerieId)!;
  const nouveau = (numero: string, intitule: string) =>
    appelApi<Compte>(page, 'POST', '/comptes', { numero, intitule, typeCompte: 'DETAIL', lettrable: true, modeReportANouveau: 'DETAIL' });
  const k1 = await nouveau('41110101', 'Client Lubumbashi');
  const k2 = await nouveau('41110102', 'Client Goma');
  const k4 = await nouveau('41110104', 'Client Kolwezi');
  const f1 = await nouveau('40110101', 'Fournisseur Durban');
  const capital = detail('1013');
  const c756 = detail('756');
  const usd = await appelApi<{ id: string }>(page, 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' });
  await appelApi(page, 'POST', `/devises/${usd.id}/cours`, { date: `${a}-12-31`, cours: 2400 });
  await appelApi(page, 'POST', `/devises/${usd.id}/cours`, { date: `${a + 1}-03-15`, cours: 2500 });

  // Le bilan d'ouverture, avec la devise de ses lignes.
  const fichier = [
    'Numéro de compte;Intitulé;Solde débiteur;Solde créditeur;Montant en devise;Devise;Cours',
    `${k1.numero};Client Lubumbashi;3200000;0;1500;USD;`,
    `${k2.numero};Client Goma;3200000;0;;;`,
    `${k4.numero};Client Kolwezi;2000000;0;;;`,
    `${f1.numero};Fournisseur Durban;0;3200000;1500;USD;2133,333333`,
    `${banque.numero};Banque;1000000;0;;;`,
    `${capital.numero};Capital;0;6200000;;;`,
  ].join('\n');
  const rapport = await appelApi<{ ecrituresCreees: number; anomalies: unknown[] }>(page, 'POST', '/import/executer', {
    type: 'BALANCE',
    nomFichier: 'bilan.csv',
    contenuBase64: Buffer.from(fichier, 'utf8').toString('base64'),
    mapping: {
      numero: 'Numéro de compte', intitule: 'Intitulé', debit: 'Solde débiteur', credit: 'Solde créditeur',
      montantDevise: 'Montant en devise', devise: 'Devise', cours: 'Cours',
    },
    exerciceId: ex.id,
    journalId: od.id,
    bilanDOuverture: true,
  });
  expect(rapport).toMatchObject({ ecrituresCreees: 1, anomalies: [] });
  const ecritures = async (e: Exercice) => {
    const r = await appelApi<{ ecritures?: Ecr[] } | Ecr[]>(page, 'GET', `/ecritures?exerciceId=${e.id}`);
    return Array.isArray(r) ? r : (r.ecritures ?? []);
  };
  const bilan = async () => (await ecritures(ex)).find((e) => e.libelle.startsWith("Bilan d'ouverture"))!;
  const ligne = (e: Ecr, k: Compte) => e.lignes.find((l) => l.compteId === k.id)!;
  // Les décimaux arrivent en chaîne · lus par leur valeur.
  const lk1 = ligne(await bilan(), k1);
  expect(Number(lk1.montantDevise)).toBe(1500);
  expect(Number(lk1.coursApplique)).toBe(2133.333333);

  const declarer = (ligneId: string, parts: unknown[]) =>
    appelApi<{ messages: string[] }>(page, 'POST', '/devises/a-nouveaux/declaration', { ligneId, parts, source: 'Facture d’origine en USD' });
  // Au brouillard · k4 complétée en place.
  await declarer(ligne(await bilan(), k4).id, [{ deviseId: usd.id, montantDevise: 500, montant: 1_100_000 }]);
  const valider = (e: Exercice) => appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: e.id, dateLimite: e.dateFin.slice(0, 10) });
  await valider(ex);
  // Validée · k2 inscrite en négatif puis exacte.
  const d2 = await declarer(ligne(await bilan(), k2).id, [{ deviseId: usd.id, montantDevise: 1500, montant: 3_200_000 }]);
  expect(d2.messages.join(' ')).toContain('inscrite en négatif');

  const balance = async (e: Exercice) =>
    (await appelApi<{ lignes: Array<{ numero: string; solde: number }> }>(page, 'GET', `/ecritures/balance?exerciceId=${e.id}`)).lignes;
  const solde = (b: Array<{ numero: string; solde: number }>, n: string) => b.filter((l) => l.numero === n).reduce((s, l) => s + Number(l.solde), 0);
  const racine = (b: Array<{ numero: string; solde: number }>, r: string) => b.filter((l) => l.numero.startsWith(r)).reduce((s, l) => s + Number(l.solde), 0);

  const reev = await appelApi<{ reevaluationId: string }>(page, 'POST', '/devises/reevaluation', { exerciceId: ex.id });
  await valider(ex);
  let b = await balance(ex);
  expect(solde(b, k1.numero)).toBe(3_600_000);
  expect(solde(b, k2.numero)).toBe(3_600_000);
  expect(solde(b, k4.numero)).toBe(2_100_000);
  expect(solde(b, f1.numero)).toBe(-3_600_000);
  expect(racine(b, '479')).toBe(-900_000);
  expect(racine(b, '478')).toBe(400_000);
  expect(racine(b, '4991')).toBe(-400_000);
  expect(racine(b, '6591')).toBe(400_000);

  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: `${a + 1}-01-01`, dateFin: `${a + 1}-12-31` });
  await appelApi(page, 'POST', `/exercices/${ex.id}/cloturer`);
  await appelApi(page, 'POST', `/devises/reevaluation/${reev.reevaluationId}/extourne`, { exerciceSuivantId: suivant.id });
  await valider(suivant);
  const report = (await ecritures(suivant)).find((e) => e.libelle.startsWith('Report à-nouveau'))!;
  for (const k of [k1, k2]) {
    const enDevise = report.lignes.filter((l) => l.compteId === k.id && l.deviseId);
    expect(enDevise.reduce((s, l) => s + Number(l.montantDevise), 0)).toBe(1500);
    await appelApi(page, 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: suivant.id, journalId: bq.id, date: `${a + 1}-03-15`,
      reglements: [{ compteId: k.id, ligneIds: [enDevise[0].id], montantDevise: 1500, coursReglement: 2500, compteEcartChangeId: c756.id }],
    });
  }
  await valider(suivant);
  b = await balance(suivant);
  expect(solde(b, k1.numero)).toBe(0);
  expect(solde(b, k2.numero)).toBe(0);
  expect(racine(b, '756')).toBe(-1_100_000);
  expect(racine(b, '479')).toBe(0);

  // L'écran · la liste de ce qui reste à déclarer se rend (la banque en francs y reste, à trancher).
  await page.goto('/#/devises');
  await expect(page.getByText('À-nouveaux sans devise').first()).toBeVisible();
  expect(pannes).toEqual([]);
});
