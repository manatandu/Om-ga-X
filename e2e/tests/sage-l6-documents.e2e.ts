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
 * pas sans que le refus le nomme, et un document ne fige jamais la fiche du
 * bien. Le document du salarié n'entre pas au journal d'audit par son nom.
 * Un test par objet, chacun dans son dossier.
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

/** Un dossier neuf, ouvert à l'écran. */
async function ouvrir(page: Page, nom: string, paie = false) {
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom, montant: 10_000 });
  await seConnecter(page, dossier.email);
  if (paie) await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
  return dossier;
}

test('SYSCOHADA · le document d’une section · joint, retiré, et la suppression qui le nomme', async ({ page }) => {
  const pannes = surveiller(page);
  await ouvrir(page, 'Section L6 e2e');
  const [plan] = await appelApi<Array<{ id: string; code: string }>>(page, 'GET', '/analytique/plans');
  const section = await appelApi<{ id: string }>(page, 'POST', `/analytique/plans/${plan.id}/sections`, { code: 'EAU01', intitule: 'Adduction d’eau' });
  await page.goto('/#/plans-analytiques');
  await page.getByRole('button', { name: /EAU01/ }).click();
  const volet = page.getByRole('region', { name: 'Documents de la section' });
  await expect(volet.getByText('Aucune pièce jointe.')).toBeVisible();
  await joindre(volet, 'Convention.pdf', '%PDF-1.4 convention', 'Convention signée');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Supprimer la section' }).click();
  await expect(page.getByText(/documents joints \(volet Documents de la section\) \(1\)/)).toBeVisible();
  await retirer(page, volet, 'Convention.pdf');
  await appelApi(page, 'DELETE', `/analytique/sections/${section.id}`);
  expect(pannes).toEqual([]);
});

test('SYSCOHADA · le document d’un bien · onglet Documents, la fiche reste modifiable, sa suppression le nomme', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await ouvrir(page, 'Bien L6 e2e');
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const comptes = await appelApi<Array<{ id: string; numero: string }>>(page, 'GET', '/immobilisations/comptes-du-bien');
  const vehicule = comptes.find((c) => c.numero === '24510000')!;
  const contreparties = await appelApi<Array<{ id: string; mode: string | null }>>(
    page,
    'GET',
    `/immobilisations/contreparties-acquisition?compteImmobilisationId=${vehicule.id}`,
  );
  const od = (await appelApi<Array<{ id: string; code: string }>>(page, 'GET', '/journaux')).find((j) => j.code === 'OD')!;
  // Relecture « échecs silencieux », M1 · un journal numéroté par MOIS, pour
  // que la date d'acquisition déplacée d'un mois REMPLACE l'écriture.
  await appelApi(page, 'PATCH', `/journaux/${od.id}`, { numerotation: 'MENSUELLE' });
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
  // La facture jointe à l'écriture d'acquisition SUIT l'écriture qui la
  // remplace · jamais détachée en silence.
  const acquisitionDe = async () =>
    (await appelApi<Array<{ id: string; ecritureAcquisitionId: string | null }>>(page, 'GET', '/immobilisations')).find((b) => b.id === bien.id)!
      .ecritureAcquisitionId!;
  const ancienne = await acquisitionDe();
  const facture = await page.evaluate(
    async ({ api, chemin }) => {
      const csrf = localStorage.getItem('omegax:csrf') ?? '';
      const corps = new FormData();
      corps.append('fichier', new Blob(['%PDF-1.4 facture camion'], { type: 'application/pdf' }), 'Facture camion.pdf');
      const r = await fetch(api + chemin, { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': csrf }, body: corps });
      return r.status;
    },
    { api: API, chemin: `/ecritures/${ancienne}/pieces-jointes` },
  );
  expect(facture).toBe(201);
  const moisSuivant = (() => {
    const d = new Date(`${exercice.dateDebut.slice(0, 10)}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1, 10);
    return d.toISOString().slice(0, 10);
  })();
  await appelApi(page, 'PATCH', `/immobilisations/${bien.id}`, { dateAcquisition: moisSuivant, dateMiseEnService: moisSuivant });
  const neuve = await acquisitionDe();
  expect(neuve).not.toBe(ancienne);
  const suivies = await appelApi<{ description: string; pieces: Array<{ id: string; nomFichier: string }> }>(page, 'GET', `/ecritures/${neuve}/pieces-jointes`);
  expect(suivies.pieces.map((p) => p.nomFichier)).toEqual(['Facture camion.pdf']);
  expect(suivies.description).toContain(moisSuivant.split('-').reverse().join('/'));
  const detachees = await appelApi<{ pieces: Array<{ nomFichier: string }> }>(page, 'GET', '/pieces-jointes-ecritures/detachees');
  expect(detachees.pieces.map((p) => p.nomFichier)).not.toContain('Facture camion.pdf');
  // Retirée au brouillard avant la suite · la suppression de la fiche l'aurait détachée.
  await appelApi(page, 'DELETE', `/pieces-jointes-ecritures/${suivies.pieces[0].id}`);

  await page.goto('/#/immobilisations');
  await page.getByRole('button', { name: 'Fiche', exact: true }).click();
  const fiche = page.getByRole('dialog', { name: 'Fiche · Camion D e2e' });
  await fiche.getByRole('tab', { name: 'Documents' }).click();
  await joindre(fiche, 'Carte grise.pdf', '%PDF-1.4 carte grise', 'Carte grise du camion');
  // Un document n'est pas un traitement · la valeur se modifie encore au brouillard.
  await appelApi(page, 'PATCH', `/immobilisations/${bien.id}`, { valeurOrigine: 9_500_000 });
  // La fiche qui porte un document ne se supprime pas · le refus le nomme.
  await expect(appelApi(page, 'DELETE', `/immobilisations/${bien.id}`)).rejects.toThrow(/porte 1 document\(s\) joint\(s\)/);
  await retirer(page, fiche, 'Carte grise.pdf');
  await page.keyboard.press('Escape');
  await expect(fiche).toBeHidden();
  await appelApi(page, 'DELETE', `/immobilisations/${bien.id}`);
  expect(pannes).toEqual([]);
});

test('SYSCOHADA · le document d’un salarié · au registre, servi en pièce jointe, hors du journal d’audit par son nom', async ({ page }) => {
  const pannes = surveiller(page);
  await ouvrir(page, 'Salarié L6 e2e', true);
  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', { nom: 'KABEYA', prenoms: 'Marie', sexe: 'FEMININ', dateNaissance: '1990-02-03' });
  await page.goto('/#/personnel?onglet=registre');
  await page.getByRole('row').filter({ hasText: 'KABEYA Marie' }).click();
  const volet = page.getByRole('region', { name: 'Documents du salarié' });
  await joindre(volet, 'Contrat KABEYA.pdf', '%PDF-1.4 contrat', 'Contrat signé');
  // Le journal d'audit garde l'acte, jamais le nom ni le commentaire du document.
  const audit = JSON.stringify(await appelApi<unknown>(page, 'GET', '/journal-audit?entite=PieceJointeSalarie'));
  expect(audit).toContain('PieceJointeSalarie');
  expect(audit).not.toContain('Contrat KABEYA.pdf');
  expect(audit).not.toContain('Contrat signé');
  const liste = await appelApi<{ pieces: { id: string }[] }>(page, 'GET', `/personnel/salaries/${salarie.id}/pieces-jointes`);
  const servi = await page.evaluate(
    async ({ api, chemin }) => {
      const r = await fetch(api + chemin, { credentials: 'include' });
      return [r.status, r.headers.get('x-content-type-options'), r.headers.get('content-disposition')?.startsWith('attachment;'), await r.text()];
    },
    { api: API, chemin: `/personnel/pieces-jointes/${liste.pieces[0].id}/fichier` },
  );
  expect(servi).toEqual([200, 'nosniff', true, '%PDF-1.4 contrat']);
  await retirer(page, volet, 'Contrat KABEYA.pdf');
  expect(pannes).toEqual([]);
});
