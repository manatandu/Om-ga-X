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
 * refusée.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Journal { id: string; code: string; type: string; compteTresorerie: { numero: string } | null }
interface Compte { id: string; numero: string }
interface LigneBalance { numero: string; reportDebit: number; reportCredit: number; mouvementDebit: number; mouvementCredit: number }
interface Virement { id: string; sens: string; piecesPassees: string | null; annuleLe: string | null; comptePassage?: { numero: string }; pieces: { nomFichier: string }[] }
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

  // Une seconde banque, sous le 5215, son compte ouvert avec elle.
  const duPlan = await appelApi<Compte[]>(page, 'GET', '/journaux/comptes-du-plan');
  await appelApi(page, 'POST', '/journaux', {
    code: 'BQ2',
    intitule: 'Rawbank',
    type: 'TRESORERIE',
    ouvrirCompteSousId: duPlan.find((c) => c.numero === '52150000')!.id,
  });
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const j = (code: string) => journaux.find((x) => x.code === code)!;
  const [bq, ca, bq2] = [j('BQ'), j('CA'), j('BQ2')];
  expect([bq.compteTresorerie?.numero, ca.compteTresorerie?.numero, bq2.compteTresorerie?.numero]).toEqual(['52110000', '57110000', '52150001']);

  const solde = async (exerciceId: string, numero: string) => {
    const { lignes } = await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${exerciceId}`);
    const l = lignes.find((x) => x.numero === numero);
    return l ? Math.round((l.reportDebit - l.reportCredit + l.mouvementDebit - l.mouvementCredit) * 100) / 100 : 0;
  };
  const banqueAvant = await solde(exercice.id, '52110000');
  const base = (date: string) => ({ exerciceId: exercice.id, date, datePiece: date, naturePiece: 'ORDRE_VIREMENT', referencePiece: 'OV-001' });

  // Banque vers caisse · le porteur des espèces est exigé.
  const juillet = `${an}-07-10`;
  await expect(
    appelApi(page, 'POST', '/virements-fonds', { ...base(juillet), journalOrigineId: bq.id, journalDestinationId: ca.id, montant: 400_000, objet: 'Alimentation de la caisse' }),
  ).rejects.toThrow(/porteur/);
  const v1 = await appelApi<Virement>(page, 'POST', '/virements-fonds', {
    ...base(juillet),
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
    naturePiece: 'CHEQUE',
    referencePiece: 'CHQ 0042',
    journalOrigineId: bq.id,
    journalDestinationId: bq2.id,
    montant: 300_000,
    objet: 'Approvisionnement du compte Rawbank',
  });
  expect(await solde(exercice.id, '52150001')).toBe(300_000);
  await appelApi(page, 'POST', `/virements-fonds/${v2.id}/annuler`, { motif: 'Chèque saisi deux fois' });
  expect(await solde(exercice.id, '52150001')).toBe(0);

  // Banque vers banque, VALIDÉ, puis annulé · inscrit en négatif.
  const aout = `${an}-08-05`;
  const v4 = await appelApi<Virement>(page, 'POST', '/virements-fonds', {
    ...base(aout),
    referencePiece: 'OV-002',
    journalOrigineId: bq.id,
    journalDestinationId: bq2.id,
    montant: 100_000,
    objet: 'Provision du compte Rawbank',
  });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: aout });
  await appelApi(page, 'POST', `/virements-fonds/${v4.id}/annuler`, { motif: 'Virement non exécuté par la banque' });

  // À l'écran · caisse vers banque, avec le bordereau joint.
  await page.goto('/#/virements-fonds');
  await page.getByLabel('De (banque ou caisse)').selectOption(ca.id);
  await page.getByLabel('Vers (banque ou caisse)').selectOption(bq.id);
  await expect(page.getByText('58500003')).toBeVisible();
  await page.getByLabel('Date du virement').fill(`${an}-09-15`);
  await page.getByLabel('Montant').fill('150 000');
  await page.getByLabel('Pièce justificative').selectOption('BORDEREAU_VERSEMENT');
  await page.getByLabel('Référence de la pièce').fill('BV-118');
  await page.getByLabel('Date de la pièce').fill(`${an}-09-15`);
  await page.getByLabel('Objet').fill('Versement de la recette');
  await page.getByLabel('Porteur des espèces').fill('Mbuyi');
  await page.getByLabel('Scan de la pièce').setInputFiles({ name: 'bordereau-118.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByRole('button', { name: 'Passer le virement' }).click();
  await expect(page.getByText(/Virement passé · CA n° \S+ · BQ n° \S+, au compte 58500003\. Pièce jointe\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'bordereau-118.pdf' })).toBeVisible();

  // Les comptes de passage sont soldés, les trésoreries portent le net.
  for (const n of ['58500001', '58500002', '58500003', '58500004']) expect(await solde(exercice.id, n)).toBe(0);
  expect(await solde(exercice.id, '52110000')).toBe(banqueAvant - 400_000 + 150_000);
  expect(await solde(exercice.id, '57110000')).toBe(250_000);
  expect(await solde(exercice.id, '52150001')).toBe(0);

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
    date: dateN1,
    datePiece: dateN1,
    naturePiece: 'BON_CAISSE',
    referencePiece: 'BC-7',
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
    date,
    datePiece: date,
    naturePiece: 'CHEQUE',
    referencePiece: 'CHQ 1187',
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
