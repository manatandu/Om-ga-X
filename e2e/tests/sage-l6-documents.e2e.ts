import { expect, test, type Locator, type Page } from '@playwright/test';
import { API, appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L6, FONCTION N° 22 · LES DOCUMENTS DE LA SECTION, DU BIEN ET DU
 * SALARIÉ, CHACUN CHEZ LUI, SUR VRAIE BASE.
 *
 * Le même volet, posé dans la fiche de la section (plans analytiques), dans
 * l'onglet Documents de la fiche du bien, et dans la fiche du salarié
 * (registre du personnel). Chaque document se joint, se lit, se commente et
 * se retire ; une section ou une fiche qui porte un document ne se supprime
 * pas sans que le refus le nomme. Le document du salarié n'entre pas au
 * journal d'audit par son nom.
 */
interface Exercice { id: string; dateDebut: string }

/** Joint un fichier depuis un volet ouvert, et attend qu'il s'affiche. */
async function joindre(volet: Locator, nom: string, contenu: string, commentaire: string) {
  await volet.getByLabel('Fichier à joindre').setInputFiles({ name: nom, mimeType: 'application/pdf', buffer: Buffer.from(contenu) });
  await volet.getByLabel('Commentaire', { exact: true }).fill(commentaire);
  await volet.getByRole('button', { name: 'Joindre', exact: true }).click();
  await expect(volet.getByRole('button', { name: nom })).toBeVisible();
  await expect(volet.getByText(commentaire)).toBeVisible();
}

/** Retire un document depuis son volet, la confirmation acceptée. */
async function retirer(page: Page, volet: Locator, nom: string) {
  page.once('dialog', (d) => void d.accept());
  await volet.getByRole('button', { name: 'Retirer' }).click();
  await expect(volet.getByRole('button', { name: nom })).toHaveCount(0);
  await expect(volet.getByText('Aucune pièce jointe.')).toBeVisible();
}

test('SYSCOHADA · documents de la section, du bien et du salarié · joints, lus, retirés, et la suppression qui le dit', async ({ page }) => {
  test.setTimeout(300_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Documents L6 e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });

  // --- La section analytique.
  const [plan] = await appelApi<Array<{ id: string; code: string }>>(page, 'GET', '/analytique/plans');
  const section = await appelApi<{ id: string }>(page, 'POST', `/analytique/plans/${plan.id}/sections`, { code: 'EAU01', intitule: 'Adduction d’eau' });
  await page.goto('/#/plans-analytiques');
  await page.getByRole('button', { name: /EAU01/ }).click();
  const voletSection = page.getByRole('region', { name: 'Documents de la section' });
  await expect(voletSection.getByText('Aucune pièce jointe.')).toBeVisible();
  await joindre(voletSection, 'Convention.pdf', '%PDF-1.4 convention', 'Convention signée');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Supprimer la section' }).click();
  await expect(page.getByText(/documents joints \(volet Documents de la section\) \(1\)/)).toBeVisible();
  await retirer(page, voletSection, 'Convention.pdf');
  await appelApi(page, 'DELETE', `/analytique/sections/${section.id}`);

  // --- Le bien · onglet Documents de sa fiche.
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const comptes = await appelApi<Array<{ id: string; numero: string }>>(page, 'GET', '/immobilisations/comptes-du-bien');
  const vehicule = comptes.find((c) => c.numero === '24510000')!;
  const contreparties = await appelApi<Array<{ id: string; mode: string | null }>>(
    page,
    'GET',
    `/immobilisations/contreparties-acquisition?compteImmobilisationId=${vehicule.id}`,
  );
  const od = (await appelApi<Array<{ id: string; code: string }>>(page, 'GET', '/journaux')).find((j) => j.code === 'OD')!;
  const bien = await appelApi<{ id: string }>(page, 'POST', '/immobilisations', {
    compteImmobilisationId: vehicule.id,
    designation: 'Camion D e2e',
    dateAcquisition: exercice.dateDebut.slice(0, 10),
    dateMiseEnService: exercice.dateDebut.slice(0, 10),
    valeurOrigine: 9_000_000,
    dureeAmortissementAns: 4,
    modeAmortissement: 'LINEAIRE',
    compteContrepartieId: contreparties.find((c) => c.mode === 'ACHAT_COMPTANT')!.id,
    journalId: od.id,
    exerciceId: exercice.id,
  });
  await page.goto('/#/immobilisations');
  await page.getByRole('button', { name: 'Fiche', exact: true }).click();
  const fiche = page.getByRole('dialog', { name: 'Fiche · Camion D e2e' });
  await fiche.getByRole('tab', { name: 'Documents' }).click();
  await joindre(fiche, 'Carte grise.pdf', '%PDF-1.4 carte grise', 'Carte grise du camion');
  // La fiche qui porte un document ne se supprime pas · le refus le nomme.
  await expect(appelApi(page, 'DELETE', `/immobilisations/${bien.id}`)).rejects.toThrow(/porte 1 document\(s\) joint\(s\)/);
  await retirer(page, fiche, 'Carte grise.pdf');
  await page.keyboard.press('Escape');
  await expect(fiche).toBeHidden();

  // --- Le salarié · sa fiche au registre du personnel.
  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'KABEYA', prenoms: 'Marie', sexe: 'FEMININ', dateNaissance: '1990-02-03' });
  await page.goto('/#/personnel?onglet=registre');
  await page.getByRole('row').filter({ hasText: 'KABEYA Marie' }).click();
  const voletSalarie = page.getByRole('region', { name: 'Documents du salarié' });
  await joindre(voletSalarie, 'Contrat KABEYA.pdf', '%PDF-1.4 contrat', 'Contrat signé');
  // Le journal d'audit garde l'acte, jamais le nom ni le commentaire du document.
  const audit = JSON.stringify(await appelApi<unknown>(page, 'GET', '/journal-audit?entite=PieceJointeSalarie'));
  expect(audit).toContain('PieceJointeSalarie');
  expect(audit).not.toContain('Contrat KABEYA.pdf');
  expect(audit).not.toContain('Contrat signé');
  const liste = await appelApi<{ pieces: { id: string }[] }>(page, 'GET', `/personnel/salaries/${salarie.id}/pieces-jointes`);
  const servi = await page.evaluate(
    async ({ api, chemin }) => {
      const r = await fetch(api + chemin, { credentials: 'include' });
      return [r.status, r.headers.get('x-content-type-options'), await r.text()];
    },
    { api: API, chemin: `/personnel/pieces-jointes/${liste.pieces[0].id}/fichier` },
  );
  expect(servi).toEqual([200, 'nosniff', '%PDF-1.4 contrat']);
  await retirer(page, voletSalarie, 'Contrat KABEYA.pdf');

  expect(pannes).toEqual([]);
});
