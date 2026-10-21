import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LE VIREMENT DE FONDS À TRAVERS UNE CLÔTURE (demande de Manasse du
 * 2026-10-09). Sur vraie base, par l'API du serveur compilé et par l'écran
 * (CLAUDE.md § 10) · banque vers caisse, banque vers banque, caisse vers
 * banque, chacun en deux pièces, une par journal, par le sous-compte du 585
 * propre à son sens, que le dossier a reçu à sa création ; le porteur exigé
 * dès qu'une caisse est en jeu ; une pièce jointe ; une annulation au
 * brouillard (pièces retirées) et une après validation (inscription en
 * négatif). Chaque compte de passage revient à zéro, la clôture ne reporte
 * rien sur lui, et l'annulation d'un virement d'un exercice clôturé est
 * refusée. DEUX OPÉRATIONS, DEUX PIÈCES (demande du 2026-10-16) · la sortie et
 * l'entrée ont chacune leur pièce, qui date leur écriture (AUDCIF art. 16,
 * al. 2) ; l'entrée ne précède pas la sortie et ne tombe pas sur l'exercice
 * suivant, le 585 se soldant à la clôture (fiche du compte 58).
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Journal { id: string; code: string; type: string; compteTresorerie: { numero: string } | null }
interface Compte { id: string; numero: string }
interface LigneBalance { numero: string; reportDebit: number; reportCredit: number; mouvementDebit: number; mouvementCredit: number }
interface Virement { id: string; sens: string; piecesPassees: string | null; annuleLe: string | null; comptePassage?: { numero: string }; pieces: { nomFichier: string; operation: string | null }[] }
interface Ecriture { date: string; reference: string | null }
interface Liste { comptesDePassage: { sens: string; compte: { numero: string } | null }[]; virements: Virement[] }

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);
// Un PDF réduit à sa signature · le serveur lit le format dans les octets.
const PDF = Buffer.from('%PDF-1.4\n% bordereau e2e\n%%EOF\n', 'latin1');

test('SYSCOHADA · virements de fonds par le 585, pièce jointe, annulations, à travers une clôture', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Virements de fonds e2e', montant: 2_000_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const an = exercice.dateDebut.slice(0, 4);

  // Les quatre comptes de passage sont nés avec le dossier, un par sens.
  const liste0 = await appelApi<Liste>(page, 'GET', `/virements-fonds?exerciceId=${exercice.id}`);
  expect(liste0.comptesDePassage.map((c) => [c.sens, c.compte?.numero])).toEqual([
    ['BANQUE_BANQUE', '58500001'],
    ['BANQUE_CAISSE', '58500002'],
    ['CAISSE_BANQUE', '58500003'],
    ['CAISSE_CAISSE', '58500004'],
  ]);

  // Une seconde banque en francs, sous le 5211, son compte ouvert avec elle
  // (le 5215 « Banques en devises » refuse un virement en francs).
  const duPlan = await appelApi<Compte[]>(page, 'GET', '/journaux/comptes-du-plan');
  await appelApi(page, 'POST', '/journaux', {
    code: 'BQ2',
    intitule: 'Rawbank',
    type: 'TRESORERIE',
    ouvrirCompteSousId: duPlan.find((c) => c.numero === '52110000')!.id,
  });
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const j = (code: string) => journaux.find((x) => x.code === code)!;
  const [bq, ca, bq2] = [j('BQ'), j('CA'), j('BQ2')];
  expect([bq.compteTresorerie?.numero, ca.compteTresorerie?.numero, bq2.compteTresorerie?.numero]).toEqual(['52110000', '57110000', '52110001']);

  const solde = async (exerciceId: string, numero: string) => {
    const { lignes } = await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${exerciceId}`);
    const l = lignes.find((x) => x.numero === numero);
    return l ? Math.round((l.reportDebit - l.reportCredit + l.mouvementDebit - l.mouvementCredit) * 100) / 100 : 0;
  };
  const banqueAvant = await solde(exercice.id, '52110000');
  const piece = (nature: string, reference: string, date: string) => ({ nature, reference, date });
  // La pièce suit la trésorerie de son côté (demande du 2026-10-16) · avis de
  // crédit à l'entrée d'une banque, bon d'entrée à celle d'une caisse.
  const base = (date: string, entree = date, natureEntree = 'AVIS_CREDIT') => ({
    exerciceId: exercice.id,
    sortie: piece('ORDRE_VIREMENT', 'OV-001', date),
    entree: piece(natureEntree, 'AC-001', entree),
  });

  // Une caisse en devises (5712) ne reçoit pas un virement en francs · la
  // réévaluation de clôture ne lit que les lignes en devise (relecture B1).
  await appelApi(page, 'POST', '/journaux', {
    code: 'CAUSD',
    intitule: 'Caisse dollars',
    type: 'TRESORERIE',
    ouvrirCompteSousId: duPlan.find((c) => c.numero === '57120000')!.id,
  });
  const causd = (await appelApi<Journal[]>(page, 'GET', '/journaux')).find((x) => x.code === 'CAUSD')!;
  await expect(
    appelApi(page, 'POST', '/virements-fonds', {
      ...base(`${an}-07-09`, `${an}-07-09`, 'BON_ENTREE_CAISSE'),
      journalOrigineId: bq.id,
      journalDestinationId: causd.id,
      montant: 100_000,
      objet: 'Achat de dollars',
      porteur: 'Kalala',
    }),
  ).rejects.toThrow(/tenu en devise/);

  // Banque vers caisse · le porteur des espèces est exigé.
  const juillet = `${an}-07-10`;
  await expect(
    appelApi(page, 'POST', '/virements-fonds', {
      ...base(juillet, juillet, 'BON_ENTREE_CAISSE'),
      journalOrigineId: bq.id,
      journalDestinationId: ca.id,
      montant: 400_000,
      objet: 'Alimentation de la caisse',
    }),
  ).rejects.toThrow(/porteur/);
  const v1 = await appelApi<Virement>(page, 'POST', '/virements-fonds', {
    ...base(juillet, juillet, 'BON_ENTREE_CAISSE'),
    journalOrigineId: bq.id,
    journalDestinationId: ca.id,
    montant: 400_000,
    objet: 'Alimentation de la caisse',
    porteur: 'Kalala',
  });
  expect(v1).toMatchObject({ sens: 'BANQUE_CAISSE', comptePassage: { numero: '58500002' } });
  expect(v1.piecesPassees).toMatch(/^BQ n° \S+ · CA n° \S+$/);

  // Banque vers banque, au brouillard, puis annulé · ses pièces sont retirées.
  const v2 = await appelApi<Virement>(page, 'POST', '/virements-fonds', {
    ...base(juillet),
    sortie: piece('CHEQUE', 'CHQ 0042', juillet),
    journalOrigineId: bq.id,
    journalDestinationId: bq2.id,
    montant: 300_000,
    objet: 'Approvisionnement du compte Rawbank',
  });
  expect(await solde(exercice.id, '52110001')).toBe(300_000);
  await appelApi(page, 'POST', `/virements-fonds/${v2.id}/annuler`, { motif: 'Chèque saisi deux fois' });
  expect(await solde(exercice.id, '52110001')).toBe(0);

  // Banque vers banque, VALIDÉ, puis annulé · inscrit en négatif.
  const aout = `${an}-08-05`;
  const v4 = await appelApi<Virement>(page, 'POST', '/virements-fonds', {
    ...base(aout),
    sortie: piece('ORDRE_VIREMENT', 'OV-002', aout),
    journalOrigineId: bq.id,
    journalDestinationId: bq2.id,
    montant: 100_000,
    objet: 'Provision du compte Rawbank',
  });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: aout });
  await appelApi(page, 'POST', `/virements-fonds/${v4.id}/annuler`, { motif: 'Virement non exécuté par la banque' });

  // L'entrée ne précède pas la sortie, et ne tombe pas sur l'exercice suivant.
  await expect(
    appelApi(page, 'POST', '/virements-fonds', { ...base(`${an}-09-02`, `${an}-09-01`), journalOrigineId: bq.id, journalDestinationId: bq2.id, montant: 10_000, objet: 'Ordre inversé' }),
  ).rejects.toThrow(/datée avant leur sortie/);
  await expect(
    appelApi(page, 'POST', '/virements-fonds', {
      ...base(jour(exercice.dateFin), lendemain(exercice.dateFin)),
      journalOrigineId: bq.id,
      journalDestinationId: bq2.id,
      montant: 10_000,
      objet: 'Entrée sur l’exercice suivant',
    }),
  ).rejects.toThrow(/hors de l'exercice/);

  // À l'écran · caisse vers banque, la sortie le 15 sur bon de caisse, l'entrée
  // le 16 sur le bordereau de versement, scanné et joint à l'entrée.
  await page.goto('/#/virements-fonds');
  const sortie = page.getByRole('group', { name: 'Sortie des fonds' });
  const entree = page.getByRole('group', { name: 'Entrée des fonds' });
  await page.getByLabel('Montant').fill('150 000');
  await page.getByLabel('Objet').fill('Versement de la recette');
  await sortie.getByLabel('De (banque ou caisse)').selectOption(ca.id);
  // Une banque ne propose pas le bon de caisse, une caisse si.
  await expect(sortie.getByLabel('Pièce justificative').locator('option[value="BON_SORTIE_CAISSE"]')).toHaveCount(1);
  await expect(sortie.getByLabel('Pièce justificative').locator('option[value="ORDRE_VIREMENT"]')).toHaveCount(0);
  await sortie.getByLabel('Pièce justificative').selectOption('BON_SORTIE_CAISSE');
  await sortie.getByLabel('Référence de la pièce').fill('BC-41');
  await sortie.getByLabel('Date de la pièce').fill(`${an}-09-15`);
  await entree.getByLabel('Vers (banque ou caisse)').selectOption(bq.id);
  await entree.getByLabel('Pièce justificative').selectOption('BORDEREAU_VERSEMENT');
  await entree.getByLabel('Référence de la pièce').fill('BV-118');
  await entree.getByLabel('Date de la pièce').fill(`${an}-09-16`);
  await entree.getByLabel('Scan de la pièce').setInputFiles({ name: 'bordereau-118.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByLabel('Porteur des espèces').fill('Mbuyi');
  await page.getByRole('button', { name: 'Passer le virement' }).click();
  await expect(page.getByText(/Virement passé · CA n° \S+ · BQ n° \S+\. Scan joint à l’entrée des fonds\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'bordereau-118.pdf' })).toBeVisible();
  // Chaque écriture porte et prend la date de SA pièce.
  const ecrituresDe = async (journalId: string) =>
    (await appelApi<{ ecritures: Ecriture[] }>(page, 'GET', `/ecritures?exerciceId=${exercice.id}&journalId=${journalId}`)).ecritures;
  const ecritureSortie = (await ecrituresDe(ca.id)).find((e) => e.reference === 'Bon de sortie de caisse BC-41');
  const ecritureEntree = (await ecrituresDe(bq.id)).find((e) => e.reference === 'Bordereau de versement BV-118');
  expect([ecritureSortie && jour(ecritureSortie.date), ecritureEntree && jour(ecritureEntree.date)]).toEqual([`${an}-09-15`, `${an}-09-16`]);
  const v3 = (await appelApi<Liste>(page, 'GET', `/virements-fonds?exerciceId=${exercice.id}`)).virements.find((x) => x.sens === 'CAISSE_BANQUE')!;
  expect(v3.pieces).toEqual([expect.objectContaining({ nomFichier: 'bordereau-118.pdf', operation: 'ENTREE' })]);

  // Les comptes de passage sont soldés, les trésoreries portent le net.
  for (const n of ['58500001', '58500002', '58500003', '58500004']) expect(await solde(exercice.id, n)).toBe(0);
  expect(await solde(exercice.id, '52110000')).toBe(banqueAvant - 400_000 + 150_000);
  expect(await solde(exercice.id, '57110000')).toBe(250_000);
  expect(await solde(exercice.id, '52110001')).toBe(0);

  // La clôture ne reporte rien sur le 585, et le reste à sa valeur.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
  const debutSuivant = lendemain(exercice.dateFin);
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${debutSuivant.slice(0, 4)}-12-31` });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);
  for (const n of ['58500001', '58500002', '58500003', '58500004']) expect(await solde(suivant.id, n)).toBe(0);
  expect(await solde(suivant.id, '57110000')).toBe(250_000);
  expect(await solde(suivant.id, '52110000')).toBe(banqueAvant - 250_000);

  // Un virement d'un exercice clôturé ne s'annule plus ; N+1 en passe de nouveaux.
  await expect(appelApi(page, 'POST', `/virements-fonds/${v1.id}/annuler`, { motif: 'Trop tard' })).rejects.toThrow(/exercice clôturé/);
  const dateN1 = `${debutSuivant.slice(0, 4)}-01-20`;
  const v5 = await appelApi<Virement>(page, 'POST', '/virements-fonds', {
    exerciceId: suivant.id,
    sortie: { nature: 'BON_SORTIE_CAISSE', reference: 'BC-7', date: dateN1 },
    entree: { nature: 'BORDEREAU_VERSEMENT', reference: 'BV-9', date: dateN1 },
    journalOrigineId: ca.id,
    journalDestinationId: bq.id,
    montant: 50_000,
    objet: 'Versement de janvier',
    porteur: 'Mbuyi',
  });
  expect(v5.comptePassage?.numero).toBe('58500003');
  expect(await solde(suivant.id, '58500003')).toBe(0);
  expect(await solde(suivant.id, '57110000')).toBe(200_000);

  expect(pannes).toEqual([]);
});

/**
 * AU SYCEBNL, le même 585 (Partie 2 ch. 3, compte 58, « soldés à la fin de
 * l'exercice ») · le bilan des associations ne lit aucun 58, et un compte de
 * passage laissé ouvert y ferait un écart. Le virement le solde à l'instant,
 * et la clôture passe.
 */
test('SYCEBNL · banque vers caisse par le 58500002, la clôture passe et ne reporte rien sur lui', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Virements de fonds SYCEBNL e2e', montant: 900_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const bq = journaux.find((x) => x.code === 'BQ')!;
  const ca = journaux.find((x) => x.code === 'CA')!;
  expect(ca.compteTresorerie?.numero).toBe('57100000');
  const date = `${exercice.dateDebut.slice(0, 4)}-10-02`;
  const v = await appelApi<Virement>(page, 'POST', '/virements-fonds', {
    exerciceId: exercice.id,
    sortie: { nature: 'CHEQUE', reference: 'CHQ 1187', date },
    entree: { nature: 'BON_ENTREE_CAISSE', reference: 'BC-3', date },
    journalOrigineId: bq.id,
    journalDestinationId: ca.id,
    montant: 120_000,
    objet: 'Caisse de la mission de terrain',
    porteur: 'Ilunga',
  });
  expect(v.comptePassage?.numero).toBe('58500002');

  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
  const debutSuivant = lendemain(exercice.dateFin);
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${debutSuivant.slice(0, 4)}-12-31` });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);
  const { lignes } = await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`);
  const report = (n: string) => {
    const l = lignes.find((x) => x.numero === n);
    return l ? l.reportDebit - l.reportCredit : 0;
  };
  expect({ passage: report('58500002'), caisse: report('57100000') }).toEqual({ passage: 0, caisse: 120_000 });

  expect(pannes).toEqual([]);
});
