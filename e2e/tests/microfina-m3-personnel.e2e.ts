import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, MOT_DE_PASSE, seConnecter, surveiller } from './outils';

/**
 * Le statut HTTP d'un refus, LU sur la réponse (le message d'`appelApi` porte
 * « MÉTHODE chemin · statut · corps ») · jamais un « 409 » cherché n'importe
 * où dans le texte, qu'un montant ou un numéro pourrait contenir.
 */
// Le code se lit SANS ANCRE · Playwright préfixe le message d'une erreur levée
// dans la page (« page.evaluate: Error: … »), et l'ancre rendait -1 sur un
// vrai 409 (même lecture que sage-parite-bords.e2e.ts).
const statutDuRefus = (p: Promise<unknown>) =>
  p.then(
    () => 0,
    (e: unknown) => Number(/· (\d{3}) ·/.exec(String(e instanceof Error ? e.message : e))?.[1] ?? -1),
  );

/**
 * LIGNE MICROFINA-M3 · RETENUE ÉTALÉE ET FRAIS DE MISSION, SUR VRAIE BASE.
 *
 * Une avance de 100 000 FC étalée sur trois mois dès décembre 2026 · le plan
 * se lit à l'écran (dernière échéance prenant le reste), la retenue de
 * décembre est PRÉREMPLIE à la simulation (33 333,33) sans être imposée. Une
 * mission ordonnée à l'écran, ses frais qualifiés un à un · un remboursement
 * sans pièce est refusé (loi n° 23/053, art. 68, 1°). Le bulletin de décembre
 * porte la retenue et la mission · forfait imposable, remboursement hors
 * impôt, aucun des deux dans la rémunération (Code du travail, art. 7,
 * point 8). La mission portée ne change plus.
 */
interface Avance { id: string; proposition: { montantFc: number | null } | null; plan: { echeancier: { mois: string; montantFc: number }[] } | null }
interface Bulletin { id: string; numero: number; totalVerseFc: number | string; calcul: { assiettes: { assietteSocialeFc: number; assietteFiscaleBruteFc: number } } }

test('SYSCOHADA · avance étalée préremplie au bulletin, mission ordonnée et portée au bulletin', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Personnel M3 SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'KABILA', prenoms: 'Marie', sexe: 'FEMININ', dateNaissance: '1988-03-02' });
  await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: '2026-01-01',
    periodiciteRemuneration: 'MOIS',
    remunerationBase: 780_000,
    deviseRemuneration: 'CDF',
  });
  const avance = await appelApi<{ id: string }>(page, 'POST', `/personnel/salaries/${salarie.id}/avances`, {
    type: 'AVANCE',
    dateOctroi: '2026-11-20',
    montantFc: 100_000,
    objet: 'Loyer',
    pieceJustificative: 'Reconnaissance du 20 novembre',
    premierMoisRetenue: '2026-12',
    nombreEcheances: 3,
  });
  const { avances } = await appelApi<{ avances: Avance[] }>(page, 'GET', `/personnel/avances?salarieId=${salarie.id}&moisDePaie=2026-12`);
  const lue = avances.find((a) => a.id === avance.id)!;
  expect(lue.plan?.echeancier.map((e) => e.montantFc)).toEqual([33_333.33, 33_333.33, 33_333.34]);
  expect(lue.proposition?.montantFc).toBe(33_333.33);

  // À l'écran · l'onglet Rubriques et avances dit le plan.
  await page.goto('/#/personnel?onglet=rubriques');
  await expect(page.getByText(/Étalée dès 2026-12 · 3 échéances/)).toBeVisible();

  // À l'écran · l'onglet Missions · l'ordre, puis ses frais.
  await page.goto('/#/personnel?onglet=missions');
  // La liste LUE · jamais présumée vide (un échec de lecture ne l'est pas).
  await expect(page.getByText('Lecture des missions…')).toHaveCount(0);
  await page.getByLabel('Salarié en mission').selectOption({ label: 'KABILA Marie' });
  await page.getByLabel('Objet de la mission').fill('Atelier de suivi');
  await page.getByLabel('Destination').fill('Goma');
  await page.getByLabel('Date de départ').fill('2026-12-10');
  await page.getByLabel('Date de retour').fill('2026-12-14');
  await page.getByRole('button', { name: 'Ordonner la mission' }).click();
  const bloc = page.getByRole('group', { name: 'Mission n° 1' });
  await expect(bloc).toBeVisible();
  // Un montant au point des milliers est AMBIGU · refusé à l'écran, rien ne part.
  await bloc.getByLabel('Montant du frais de la mission 1').fill('90.000');
  await bloc.getByRole('button', { name: 'Ajouter le frais' }).click();
  await expect(page.getByText(/Montant du frais illisible/)).toBeVisible();
  await bloc.getByLabel('Montant du frais de la mission 1').fill('90000');
  await bloc.getByRole('button', { name: 'Ajouter le frais' }).click();
  // Un remboursement sans pièce n'est pas une dépense effective.
  await expect(page.getByText(/pièce justificative/)).toBeVisible();
  await bloc.getByLabel('Pièce du frais de la mission 1').fill('Facture hôtel 118');
  await bloc.getByRole('button', { name: 'Ajouter le frais' }).click();
  await expect(bloc.getByRole('cell', { name: 'Facture hôtel 118' })).toBeVisible();
  await bloc.getByLabel('Élément de frais de la mission 1').selectOption({ label: 'Restauration' });
  await bloc.getByLabel('Qualification du frais de la mission 1').selectOption({ label: 'Indemnité forfaitaire' });
  await bloc.getByLabel('Montant du frais de la mission 1').fill('30000');
  await bloc.getByRole('button', { name: 'Ajouter le frais' }).click();
  await expect(bloc.getByText(/dont forfait imposable 30\s000,00/)).toBeVisible();

  // À l'écran · la simulation de décembre préremplit la retenue et propose la mission.
  await page.goto('/#/personnel?onglet=simulation');
  await page.getByLabel('Mois de paie').fill('2026-12');
  await page.getByLabel('Salarié (facultatif)').selectOption({ label: 'KABILA Marie' });
  await expect(page.getByLabel('Retenue sur Loyer')).toHaveValue('33333.33');
  await expect(page.getByText(/Mission n° 1 · Goma/)).toBeVisible();

  // Le bulletin · même corps que l'écran.
  const { missions } = await appelApi<{ missions: { id: string }[] }>(page, 'GET', `/personnel/missions?salarieId=${salarie.id}`);
  const bulletin = await appelApi<Bulletin>(page, 'POST', `/personnel/salaries/${salarie.id}/bulletins`, {
    moisDePaie: '2026-12',
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780_000 }],
    natureEmployeurInpp: 'PRIVE',
    effectif: 12,
    retenuesAvances: [{ avanceId: avance.id, montantFc: 33_333.33 }],
    missionsPortees: [{ missionId: missions[0].id }],
  });
  expect(Number(bulletin.totalVerseFc)).toBe(900_000);
  expect(bulletin.calcul.assiettes.assietteSocialeFc).toBe(780_000);
  expect(bulletin.calcul.assiettes.assietteFiscaleBruteFc).toBe(810_000);

  // La mission portée ne change plus · l'écran le dit, le serveur le refuse.
  await page.goto('/#/personnel?onglet=missions');
  const blocPorte = page.getByRole('group', { name: 'Mission n° 1' });
  await expect(blocPorte.getByText(`portée par le bulletin n° ${bulletin.numero} (2026-12)`)).toBeVisible();
  await expect(blocPorte.getByRole('button', { name: 'Ajouter le frais' })).toHaveCount(0);
  expect(
    await statutDuRefus(
      appelApi(page, 'POST', `/personnel/missions/${missions[0].id}/frais`, { element: 'DIVERS', qualification: 'FORFAIT', montantFc: 1_000 }),
    ),
  ).toBe(409);

  expect(pannes).toEqual([]);
});

test('SYSCOHADA · demande de congé saisie à l’écran, accordée par un second utilisateur, titre servi', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Congés M3 SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'MBUYI', prenoms: 'Paul', sexe: 'MASCULIN', dateNaissance: '1985-06-14' });
  await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: '2025-01-01',
    periodiciteRemuneration: 'MOIS',
    remunerationBase: 780_000,
    deviseRemuneration: 'CDF',
  });

  // La demande, saisie à l'écran par l'administrateur.
  await page.goto('/#/personnel?onglet=demandes');
  await page.getByLabel('Salarié qui demande').selectOption({ label: 'MBUYI Paul' });
  await page.getByLabel('Premier jour demandé').fill('2027-02-01');
  await page.getByLabel('Dernier jour demandé').fill('2027-02-06');
  await page.getByLabel("Mois de paie de l'allocation").fill('2027-02');
  await page.getByLabel('Date de la demande').fill('2027-01-10');
  await page.getByRole('button', { name: 'Enregistrer la demande' }).click();
  const tableau = page.getByRole('table', { name: 'Demandes de congé' });
  await expect(tableau.getByRole('cell', { name: 'En attente' })).toBeVisible();

  // Le double envoi, et le chevauchement d'une demande en attente · refusés.
  const corps = { du: '2027-02-03', au: '2027-02-05', moisDePaie: '2027-02', demandeLe: '2027-01-10' };
  expect(await statutDuRefus(appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/demandes-conge`, corps))).toBe(409);

  const { demandes } = await appelApi<{ demandes: { id: string; statut: string; congeId: string | null }[] }>(
    page,
    'GET',
    `/personnel/demandes-conge?salarieId=${salarie.id}`,
  );
  expect(demandes).toHaveLength(1);
  // Son auteur ne l'accorde pas.
  expect(await statutDuRefus(appelApi(page, 'POST', `/personnel/demandes-conge/${demandes[0].id}/accord`, {}))).toBe(403);

  // Le comptable, second utilisateur, l'accorde.
  const comptable = `e2e-conge-${Date.now()}@exemple.cd`;
  const sonMotDePasse = `${MOT_DE_PASSE}-c2`;
  await appelApi(page, 'POST', '/utilisateurs', { email: comptable, motDePasse: MOT_DE_PASSE, role: 'COMPTABLE' });
  const autre = await (await browser.newContext()).newPage();
  const entetes = { 'X-Forwarded-For': `10.252.${Date.now() % 250}.9` };
  await autre.goto('/');
  await appelApi(autre, 'POST', '/auth/login', { email: comptable, motDePasse: MOT_DE_PASSE }, entetes);
  await appelApi(autre, 'POST', '/auth/changer-mot-de-passe', { motDePasseActuel: MOT_DE_PASSE, nouveauMotDePasse: sonMotDePasse }, entetes);
  await autre.waitForTimeout(1_100);
  await appelApi(autre, 'POST', '/auth/login', { email: comptable, motDePasse: sonMotDePasse }, entetes);
  const accord = await appelApi<{ congeId: string }>(autre, 'POST', `/personnel/demandes-conge/${demandes[0].id}/accord`, {
    auDelaDuSolde: true,
    motifAuDelaDuSolde: 'Droits acquis hors OmegaX, repris au registre papier',
  }, entetes);
  // Accordée ET liée à son congé, en une écriture · jamais l'une sans l'autre.
  const relue = (await appelApi<{ demandes: { id: string; statut: string; congeId: string | null }[] }>(page, 'GET', `/personnel/demandes-conge?salarieId=${salarie.id}`)).demandes[0];
  expect(relue).toMatchObject({ statut: 'ACCORDEE', congeId: accord.congeId });
  // Une seconde décision est refusée.
  expect(await statutDuRefus(appelApi(autre, 'POST', `/personnel/demandes-conge/${demandes[0].id}/accord`, {}, entetes))).toBe(409);

  await page.goto('/#/personnel?onglet=demandes');
  const tableauRelu = page.getByRole('table', { name: 'Demandes de congé' });
  await expect(tableauRelu.getByText('Accordée')).toBeVisible();
  await tableauRelu.getByRole('button', { name: 'Titre de congé' }).click();
  await expect(page.getByLabel('Titre de congé').getByText(/du 2027-02-01 au 2027-02-06/)).toBeVisible();

  expect(pannes).toEqual([]);
});
