import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L5, FONCTION 75 · BANQUES DU SALARIÉ ET PAIEMENT DES SALAIRES,
 * SUR VRAIE BASE, À TRAVERS UNE CLÔTURE.
 *
 * Deux salariés payés 780 000 FC par mois · KASONGO par virement (mode et RIB
 * déclarés à l'écran, le RIB par l'administrateur), MUTOMBO en espèces. Les
 * bulletins de décembre 2026 sont émis et passés au journal (C 422 des deux
 * nets), l'exercice 2026 est clôturé, le 422 s'ouvre en 2027 au crédit des
 * deux nets. Les salaires de décembre se paient le 5 janvier 2027 à l'écran ·
 * le virement depuis BQ fait naître l'ordre de virement, les espèces depuis
 * CA gardent leur billetage. Validé, le 422 est soldé, la caisse créditée du
 * net de MUTOMBO. Le paiement en espèces annulé s'inscrit en négatif · le 422
 * revient au crédit de ce net, la caisse à zéro, et le bulletin est de
 * nouveau à payer ; celui du virement annulé emporte son ordre.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string; statut: string }
interface Journal { id: string; code: string; type: string }
interface Bulletin { id: string; netAPayerFc: number | string }
interface LigneBalance { numero: string; reportCredit: number; mouvementDebit: number; mouvementCredit: number; solde: number }
interface Proposition {
  aPayer: { bulletinId: string; nomComplet: string; montant: number; mode: string | null }[];
  paiements: { id: string; mode: string; total: number; annuleLe: string | null; ordreVirement: { numero: number; statut: string } | null }[];
}
interface Ordre { id: string; numero: number; total: number | string; statut: string; lignes: { beneficiaire: string; salarieId: string | null; montant: number | string }[] }

test('SYSCOHADA · RIB et mode du salarié à l’écran, salaires de décembre payés en janvier par virement et en espèces, annulation en négatif', async ({ page }) => {
  test.setTimeout(300_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Paiement e2e SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });

  const salarie = async (nom: string, prenoms: string) => {
    const s = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom, prenoms, sexe: 'MASCULIN', dateNaissance: '1985-04-12' });
    await appelApi(page, 'POST', `/personnel/salaries/${s.id}/contrats`, {
      type: 'DUREE_INDETERMINEE',
      dateEntreeEnVigueur: '2026-01-01',
      periodiciteRemuneration: 'MOIS',
      remunerationBase: 780_000,
      deviseRemuneration: 'CDF',
    });
    return s;
  };
  const kasongo = await salarie('KASONGO', 'Jean');
  const mutombo = await salarie('MUTOMBO', 'Alain');
  const corps = { moisDePaie: '2026-12', elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780_000 }], natureEmployeurInpp: 'PRIVE', effectif: 12 };
  const bk = await appelApi<Bulletin>(page, 'POST', `/personnel/salaries/${kasongo.id}/bulletins`, corps);
  const bm = await appelApi<Bulletin>(page, 'POST', `/personnel/salaries/${mutombo.id}/bulletins`, corps);
  const netK = Number(bk.netAPayerFc);
  const netM = Number(bm.netAPayerFc);
  expect(netK).toBeGreaterThan(0);

  // À l'écran · le registre · mode convenu de KASONGO, et son RIB par l'administrateur.
  await page.goto('/#/personnel?onglet=registre');
  await page.getByRole('row').filter({ hasText: 'KASONGO Jean' }).click();
  await expect(page.getByText('Aucun RIB enregistré.')).toBeVisible();
  await page.getByLabel('Mode de paiement convenu').selectOption({ label: 'Virement' });
  await page.getByRole('button', { name: 'Ajouter un RIB' }).click();
  const modale = page.getByRole('dialog', { name: 'Ajouter un RIB au salarié' });
  await modale.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(modale.getByRole('alert')).toContainText('banque');
  await modale.getByLabel('Banque', { exact: true }).fill('Equity BCDC');
  await modale.getByRole('button', { name: 'Enregistrer' }).click();
  // Sans numéro ni IBAN, le serveur refuse · un RIB qui ne permet pas de payer.
  await expect(modale.getByRole('alert')).toContainText('IBAN ni numéro de compte');
  await modale.getByLabel('Numéro de compte').fill('00123456789');
  await modale.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(modale).toBeHidden();
  await expect(page.getByRole('cell', { name: /Equity BCDC · principal/ })).toBeVisible();
  await appelApi(page, 'POST', `/personnel/salaries/${mutombo.id}/mode-paiement`, { modePaiement: 'ESPECES' });
  // Une clé absente n'efface pas le mode.
  await expect(appelApi(page, 'POST', `/personnel/salaries/${mutombo.id}/mode-paiement`, {})).rejects.toThrow(/400/);

  // Le RIB du journal de banque, donneur de l'ordre.
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const bq = journaux.find((j) => j.code === 'BQ')!;
  const ca = journaux.find((j) => j.code === 'CA')!;
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const banque = await appelApi<{ id: string }>(page, 'POST', '/banques', { intitule: 'Rawbank' });
  await appelApi(page, 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW', numeroCompte: '0001234', journalId: bq.id });

  // Décembre passé au journal, 2026 clôturé · le 422 s'ouvre en 2027.
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  await appelApi(page, 'POST', '/personnel/paie-du-mois/2026-12/comptabilisation', { exerciceId: exercice.id, journalId: od.id, date: '2026-12-31' });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: '2026-12-31' });
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);
  const balance = async () => (await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`)).lignes;
  const ligne = (lignes: LigneBalance[], numero: string) => lignes.find((l) => l.numero === numero);
  expect(ligne(await balance(), '42200000')?.reportCredit).toBeCloseTo(netK + netM, 2);

  // Les refus · un virement depuis la caisse, MUTOMBO par virement.
  await expect(
    appelApi(page, 'POST', '/personnel/paiement-salaires/2026-12', { mode: 'VIREMENT', exerciceId: suivant.id, journalId: ca.id, date: '2027-01-05', bulletinIds: [bk.id] }),
  ).rejects.toThrow(/ne sort pas d'une caisse/);
  await expect(
    appelApi(page, 'POST', '/personnel/paiement-salaires/2026-12', { mode: 'VIREMENT', exerciceId: suivant.id, journalId: bq.id, date: '2027-01-05', bulletinIds: [bm.id] }),
  ).rejects.toThrow(/mode convenu/);

  // À l'écran · l'onglet Bulletins, décembre · le virement de KASONGO.
  await page.goto('/#/personnel?onglet=bulletins');
  await page.reload();
  await page.getByLabel('Mois de paie').fill('2026-12');
  await expect(page.getByText('Paiement des salaires du mois')).toBeVisible();
  await page.getByRole('button', { name: 'Virement (1)', exact: true }).click();
  await page.getByLabel('Payer KASONGO Jean').check();
  await page.getByLabel('Journal du paiement').selectOption(bq.id);
  await page.getByLabel('Date du paiement').fill('2027-01-05');
  await page.getByRole('button', { name: /^Payer / }).click();
  await expect(page.getByText(/ordre de virement n° \d+/)).toBeVisible();

  // Les espèces de MUTOMBO, billetage déclaré.
  await page.getByRole('button', { name: 'Espèces (1)', exact: true }).click();
  await page.getByLabel('Coupures déclarées').fill('20000 10000 5000 1000 500');
  await page.getByRole('button', { name: 'Calculer le billetage' }).click();
  await expect(page.getByText('Total par coupure')).toBeVisible();
  await page.getByLabel('Payer MUTOMBO Alain').check();
  await page.getByLabel('Journal du paiement').selectOption(ca.id);
  await page.getByLabel('Date du paiement').fill('2027-01-05');
  await page.getByRole('button', { name: /^Payer / }).click();
  await expect(page.getByText(/pièce CA n° \d+/)).toBeVisible();

  // Rien ne reste à payer ; un bulletin payé ne se paie pas deux fois.
  const lire = () => appelApi<Proposition>(page, 'GET', '/personnel/paiement-salaires/2026-12');
  const apres = await lire();
  expect(apres.aPayer).toEqual([]);
  expect(apres.paiements.map((p) => [p.mode, p.total]).sort()).toEqual([['ESPECES', netM], ['VIREMENT', netK]].sort());
  await expect(
    appelApi(page, 'POST', '/personnel/paiement-salaires/2026-12', { mode: 'VIREMENT', exerciceId: suivant.id, journalId: bq.id, date: '2027-01-06', bulletinIds: [bk.id] }),
  ).rejects.toThrow(/déjà payé/);

  // L'ordre de virement · le module existant, KASONGO à son RIB principal.
  const virement = apres.paiements.find((p) => p.mode === 'VIREMENT')!;
  const { ordres } = await appelApi<{ ordres: Ordre[] }>(page, 'GET', '/ordres-virement');
  const ordre = await appelApi<Ordre>(page, 'GET', `/ordres-virement/${ordres.find((o) => o.numero === virement.ordreVirement!.numero)!.id}`);
  expect([Number(ordre.total), ordre.lignes.map((l) => [l.beneficiaire.toUpperCase(), l.salarieId, Number(l.montant)])]).toEqual([netK, [['KASONGO JEAN', kasongo.id, netK]]]);

  // Validé, le 422 est soldé, la caisse créditée du net de MUTOMBO.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: suivant.id, dateLimite: '2027-01-31' });
  let lignes = await balance();
  expect(ligne(lignes, '42200000')?.solde).toBeCloseTo(0, 2);
  const caisse = lignes.find((l) => l.numero.startsWith('57'))!;
  expect(caisse.solde).toBeCloseTo(-netM, 2);

  // L'annulation des espèces, validées · inscrites en négatif.
  const especes = apres.paiements.find((p) => p.mode === 'ESPECES')!;
  await appelApi(page, 'POST', `/personnel/paiements-salaires/${especes.id}/annulation`, { motif: 'Enveloppe non remise, salarié absent' });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: suivant.id, dateLimite: '2027-01-31' });
  lignes = await balance();
  expect(ligne(lignes, '42200000')?.solde).toBeCloseTo(-netM, 2);
  // La caisse revient à zéro · son mouvement et son négatif s'annulent, et la balance ne la porte plus.
  expect(lignes.find((l) => l.numero === caisse.numero)?.solde ?? 0).toBeCloseTo(0, 2);
  const relu = await lire();
  expect(relu.aPayer.map((l) => [l.nomComplet.toUpperCase(), l.montant])).toEqual([['MUTOMBO ALAIN', netM]]);

  // L'annulation du virement emporte son ordre.
  await appelApi(page, 'POST', `/personnel/paiements-salaires/${virement.id}/annulation`, { motif: 'Virement rejeté par la banque' });
  const fin = await lire();
  expect(fin.paiements.find((p) => p.id === virement.id)?.ordreVirement?.statut).toBe('ANNULE');
  expect(fin.aPayer.map((l) => l.nomComplet.toUpperCase()).sort()).toEqual(['KASONGO JEAN', 'MUTOMBO ALAIN']);

  expect(pannes).toEqual([]);
});

/**
 * SYCEBNL · le même 422 (fiche du compte 42 du plan SYCEBNL, « débité […] des
 * rémunérations versées au personnel, par le crédit des comptes de
 * trésorerie »), payé en espèces au BROUILLARD puis annulé · la pièce est
 * retirée, rien ne reste au journal, et le bulletin est de nouveau à payer.
 */
test('SYCEBNL · paiement en espèces au brouillard, annulé · la pièce est retirée', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Paiement e2e ASBL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
  const s = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'LUKUSA', prenoms: 'Marie', sexe: 'FEMININ', dateNaissance: '1991-09-02' });
  await appelApi(page, 'POST', `/personnel/salaries/${s.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: '2026-01-01',
    periodiciteRemuneration: 'MOIS',
    remunerationBase: 780_000,
    deviseRemuneration: 'CDF',
  });
  const b = await appelApi<Bulletin>(page, 'POST', `/personnel/salaries/${s.id}/bulletins`, {
    moisDePaie: '2026-09',
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780_000 }],
    natureEmployeurInpp: 'PRIVE',
    effectif: 12,
  });
  const net = Number(b.netAPayerFc);
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const ca = journaux.find((j) => j.code === 'CA')!;
  const lire = () => appelApi<Proposition>(page, 'GET', '/personnel/paiement-salaires/2026-09');

  // Sans mode convenu, le salarié se dit et ne se paie pas.
  expect((await lire()).aPayer.map((l) => l.mode)).toEqual([null]);
  await expect(
    appelApi(page, 'POST', '/personnel/paiement-salaires/2026-09', { mode: 'ESPECES', exerciceId: dossier.exerciceId, journalId: ca.id, date: '2026-10-02', bulletinIds: [b.id] }),
  ).rejects.toThrow(/pas encore dit/);
  await appelApi(page, 'POST', `/personnel/salaries/${s.id}/mode-paiement`, { modePaiement: 'ESPECES' });
  const r = await appelApi<{ piecePassee: string; total: number; billetage: { resteTotal: number } | null }>(page, 'POST', '/personnel/paiement-salaires/2026-09', {
    mode: 'ESPECES',
    exerciceId: dossier.exerciceId,
    journalId: ca.id,
    date: '2026-10-02',
    bulletinIds: [b.id],
    coupures: [20_000, 10_000, 5_000, 1_000, 500, 100],
  });
  expect(r.total).toBeCloseTo(net, 2);
  expect(r.billetage).not.toBeNull();
  const { paiements } = await lire();
  const brouillard = paiements[0];

  // L'écriture tenue par le paiement ne se supprime pas depuis le journal.
  const ecritures = await appelApi<{ ecritures: { id: string; libelle: string }[] }>(page, 'GET', `/ecritures?exerciceId=${dossier.exerciceId}&journalId=${ca.id}`);
  const piece = ecritures.ecritures.find((e) => e.libelle.startsWith('Salaires 2026-09'))!;
  await expect(appelApi(page, 'DELETE', `/ecritures/${piece.id}`)).rejects.toThrow(/paiement des salaires/);

  await appelApi(page, 'POST', `/personnel/paiements-salaires/${brouillard.id}/annulation`, { motif: 'Saisi sur le mauvais mois' });
  const apres = await appelApi<{ ecritures: { id: string }[] }>(page, 'GET', `/ecritures?exerciceId=${dossier.exerciceId}&journalId=${ca.id}`);
  expect(apres.ecritures.some((e) => e.id === piece.id)).toBe(false);
  const fin = await lire();
  expect([fin.aPayer.map((l) => l.montant), fin.paiements[0].annuleLe !== null]).toEqual([[net], true]);

  // Payé, puis le bulletin annulé et réémis plus haut · le réémis ne paie que la différence.
  await appelApi(page, 'POST', '/personnel/paiement-salaires/2026-09', { mode: 'ESPECES', exerciceId: dossier.exerciceId, journalId: ca.id, date: '2026-10-02', bulletinIds: [b.id] });
  await appelApi(page, 'POST', `/personnel/bulletins/${b.id}/annulation`, { motif: 'Prime oubliée' });
  const b2 = await appelApi<Bulletin>(page, 'POST', `/personnel/salaries/${s.id}/bulletins`, {
    moisDePaie: '2026-09',
    elements: [
      { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780_000 },
      { nature: 'PRIME', libelle: 'Prime', montantFc: 50_000 },
    ],
    natureEmployeurInpp: 'PRIVE',
    effectif: 12,
  });
  const net2 = Number(b2.netAPayerFc);
  const reemis = (await lire()).aPayer.find((l) => l.bulletinId === b2.id)!;
  expect([reemis.montant, net2 > net]).toEqual([Math.round((net2 - net) * 100) / 100, true]);
  expect(pannes).toEqual([]);
});
