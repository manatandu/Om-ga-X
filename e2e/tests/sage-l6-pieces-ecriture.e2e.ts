import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { API, appelApi, creerDossier, rechargerAuRepos, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L6, FONCTION N° 22 · LA PIÈCE JUSTIFICATIVE D'UNE ÉCRITURE, SUR
 * VRAIE BASE, À TRAVERS UNE CLÔTURE.
 *
 * Au journal, la pièce se joint à l'écriture au brouillard, se télécharge
 * telle qu'elle a été déposée (attachment, nosniff), se retire tant que
 * l'écriture est au brouillard ; un fichier dont le contenu contredit
 * l'extension est refusé. Validée, l'écriture garde sa pièce · le retrait est
 * fermé, à l'écran comme au serveur (AUDCIF art. 22, 2° et 7° ; art. 24).
 * Une écriture retirée au brouillard laisse sa pièce DÉTACHÉE, lisible dans
 * « Pièces détachées », jamais perdue. L'à-nouveau provisoire de N+1 refuse
 * une pièce ; N se clôture · la pièce de l'écriture de N se lit encore, au
 * même octet, ne se retire toujours pas, et l'écriture d'un exercice clôturé
 * reçoit encore une pièce.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string; statut: string }
interface Ecriture { id: string; statut: string; libelle: string; estANouveauProvisoire?: boolean }
interface Liste { description: string; pieces: { id: string; nomFichier: string }[]; retrait: { permis: boolean; motif: string | null }; depot: { permis: boolean; motif: string | null } }

const PDF = '%PDF-1.7\n% facture SNEL de mars\n';
const jour = (iso: string) => iso.slice(0, 10);

/** Un dépôt multipart par la page · le cookie et le jeton CSRF de la session, comme l'écran. */
async function deposer(page: Page, chemin: string, nom: string, contenu: string) {
  return page.evaluate(
    async ({ api, chemin, nom, contenu }) => {
      const csrf = localStorage.getItem('omegax:csrf');
      const corps = new FormData();
      corps.append('fichier', new Blob([contenu]), nom);
      const res = await fetch(api + chemin, { method: 'POST', credentials: 'include', headers: csrf ? { 'X-CSRF-Token': csrf } : {}, body: corps });
      return { statut: res.status, texte: await res.text() };
    },
    { api: API, chemin, nom, contenu },
  );
}

/** Le téléchargement par la page · le contenu et les en-têtes servis. */
async function telecharger(page: Page, chemin: string) {
  return page.evaluate(
    async ({ api, chemin }) => {
      const res = await fetch(api + chemin, { credentials: 'include' });
      return {
        statut: res.status,
        disposition: res.headers.get('content-disposition'),
        nosniff: res.headers.get('x-content-type-options'),
        texte: await res.text(),
      };
    },
    { api: API, chemin },
  );
}

test('SYCEBNL · la pièce se joint au journal, se garde validée, survit à la clôture, et l’écriture retirée laisse sa pièce détachée', async ({ page }) => {
  test.setTimeout(300_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Pièces L6 e2e', montant: 250_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const lister = async (exerciceId: string) => (await appelApi<{ ecritures: Ecriture[] }>(page, 'GET', `/ecritures?exerciceId=${exerciceId}`)).ecritures;
  const recette = (await lister(exercice.id)).find((e) => e.libelle === dossier.libelle)!;
  expect(recette.statut).toBe('BROUILLARD');

  // --- À l'écran, au journal · l'écriture au brouillard reçoit sa pièce.
  await page.goto('/#/journal?onglet=journal');
  await page.getByRole('button', { name: 'Aucune pièce jointe' }).first().click();
  const boite = page.getByRole('dialog', { name: 'Pièces jointes de l’écriture' });
  await expect(boite.getByText(dossier.libelle)).toBeVisible();
  await expect(boite.getByText('Aucune pièce jointe.')).toBeVisible();

  // Un fichier dont le contenu contredit l'extension est refusé, nommé.
  await boite.getByLabel('Fichier à joindre').setInputFiles({ name: 'piege.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html><script>alert(1)</script></html>') });
  await boite.getByRole('button', { name: 'Joindre', exact: true }).click();
  await expect(boite.getByRole('alert')).toContainText('ne correspond pas à son extension');

  await boite.getByLabel('Fichier à joindre').setInputFiles({ name: 'Facture SNEL.pdf', mimeType: 'application/pdf', buffer: Buffer.from(PDF) });
  await boite.getByLabel('Commentaire', { exact: true }).fill('Facture de mars');
  await boite.getByRole('button', { name: 'Joindre', exact: true }).click();
  await expect(boite.getByRole('button', { name: 'Facture SNEL.pdf' })).toBeVisible();
  await expect(boite.getByText('Facture de mars')).toBeVisible();
  await expect(boite.getByRole('button', { name: 'Retirer' })).toBeVisible();

  // Le téléchargement rend la pièce telle quelle, en pièce jointe.
  const [telechargement] = await Promise.all([page.waitForEvent('download'), boite.getByRole('button', { name: 'Facture SNEL.pdf' }).click()]);
  // Le nom que le NAVIGATEUR retient n'est pas celui d'OmegaX · le WebKit des
  // machines Ubuntu 26 de GitHub (depuis le 2026-10-19) remplace l'espace par
  // « _ », sur le code d'avant comme sur le suivant (contrôle rejoué sur
  // d9af8aa, même échec). Ce qui est gelé · le nom proposé est celui de la
  // pièce, au seul blanc près que le navigateur peut réécrire, et le nom
  // gardé par le serveur reste exact (lu plus bas, `nomFichier`).
  expect(telechargement.suggestedFilename().replace(/_/g, ' ')).toBe('Facture SNEL.pdf');
  await boite.getByRole('button', { name: 'Fermer' }).click();
  await expect(boite).toBeHidden();
  await expect(page.getByRole('button', { name: '1 pièce jointe' })).toBeVisible();

  const liste = await appelApi<Liste>(page, 'GET', `/ecritures/${recette.id}/pieces-jointes`);
  const piece = liste.pieces[0];
  const servie = await telecharger(page, `/pieces-jointes-ecritures/${piece.id}/fichier`);
  expect([servie.statut, servie.nosniff, servie.disposition?.startsWith('attachment;'), servie.texte]).toEqual([200, 'nosniff', true, PDF]);

  // --- Une écriture retirée au brouillard laisse sa pièce détachée.
  const comptes = await appelApi<Array<{ id: string; numero: string; typeCompte: string }>>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const journaux = await appelApi<Array<{ id: string; type: string }>>(page, 'GET', '/journaux');
  const banque = comptes.find((c) => c.numero.startsWith('52'))!;
  const produit = comptes.find((c) => c.numero.startsWith('7'))!;
  const milieu = new Date((Date.parse(exercice.dateDebut) + Date.parse(exercice.dateFin)) / 2).toISOString().slice(0, 10);
  const aRetirer = await appelApi<{ id: string }>(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: (journaux.find((j) => j.type === 'GENERAL') ?? journaux[0]).id,
    date: milieu,
    libelle: 'Recette saisie par erreur',
    lignes: [
      { compteId: banque.id, debit: 1_000, credit: 0 },
      { compteId: produit.id, debit: 0, credit: 1_000 },
    ],
  });
  expect((await deposer(page, `/ecritures/${aRetirer.id}/pieces-jointes`, 'Reçu.pdf', '%PDF-1.4 reçu')).statut).toBe(201);
  // La même pièce deux fois sur la même écriture · conflit nommé.
  const doublon = await deposer(page, `/ecritures/${aRetirer.id}/pieces-jointes`, 'Reçu (2).pdf', '%PDF-1.4 reçu');
  expect([doublon.statut, doublon.texte.includes('déjà joint')]).toEqual([409, true]);
  // Relecture « échecs silencieux », mineurs 1 et 2 · l'écriture corrigée au
  // brouillard, la description de sa pièce suit ; supprimée, la réponse dit la
  // pièce détachée.
  await appelApi(page, 'PATCH', `/ecritures/${aRetirer.id}`, { libelle: 'Recette saisie par erreur (corrigée)' });
  expect(await appelApi(page, 'DELETE', `/ecritures/${aRetirer.id}`)).toEqual({ supprime: true, piecesDetachees: 1 });
  const detachees = await appelApi<{ pieces: { nomFichier: string; ecritureDecrite: string }[]; total: number }>(page, 'GET', '/pieces-jointes-ecritures/detachees');
  expect(detachees.pieces.map((p) => [p.nomFichier, p.ecritureDecrite.endsWith('Recette saisie par erreur (corrigée)')])).toEqual([['Reçu.pdf', true]]);
  await rechargerAuRepos(page);
  await page.getByRole('button', { name: 'Pièces détachées…' }).click();
  const boiteDetachees = page.getByRole('dialog', { name: 'Pièces détachées' });
  await expect(boiteDetachees.getByText(/Recette saisie par erreur/)).toBeVisible();
  await expect(boiteDetachees.getByRole('button', { name: 'Reçu.pdf' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(boiteDetachees).toBeHidden();

  // --- Validée, l'écriture garde sa pièce · le retrait se ferme aux deux bouts.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
  await expect(appelApi(page, 'DELETE', `/pieces-jointes-ecritures/${piece.id}`)).rejects.toThrow(/409.*ne se retire plus/);
  await rechargerAuRepos(page);
  await page.getByRole('button', { name: '1 pièce jointe' }).first().click();
  const boiteValidee = page.getByRole('dialog', { name: 'Pièces jointes de l’écriture' });
  await expect(boiteValidee.getByRole('button', { name: 'Facture SNEL.pdf' })).toBeVisible();
  await expect(boiteValidee.getByText(/validée · elle se conserve avec elle/)).toBeVisible();
  await expect(boiteValidee.getByRole('button', { name: 'Retirer' })).toHaveCount(0);
  await boiteValidee.getByRole('button', { name: 'Fermer' }).click();

  // --- L'à-nouveau provisoire de N+1 ne reçoit pas de pièce.
  await appelApi(page, 'POST', `/exercices/${exercice.id}/a-nouveaux-provisoires`, {});
  const suivant = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id !== exercice.id)!;
  const provisoire = (await lister(suivant.id)).find((e) => e.estANouveauProvisoire);
  expect(provisoire).toBeDefined();
  const refus = await deposer(page, `/ecritures/${provisoire!.id}/pieces-jointes`, 'Bilan.pdf', '%PDF-1.4 bilan');
  expect([refus.statut, refus.texte.includes('à-nouveau provisoire')]).toEqual([400, true]);

  // --- N se clôture · la pièce se lit encore, au même octet, et ne se retire toujours pas.
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);
  expect((await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id === exercice.id)!.statut).toBe('CLOTURE');
  const apres = await appelApi<Liste>(page, 'GET', `/ecritures/${recette.id}/pieces-jointes`);
  expect([apres.pieces.map((p) => p.nomFichier), apres.retrait.permis, apres.depot.permis]).toEqual([['Facture SNEL.pdf'], false, true]);
  const relue = await telecharger(page, `/pieces-jointes-ecritures/${piece.id}/fichier`);
  expect(createHash('sha256').update(relue.texte).digest('hex')).toBe(createHash('sha256').update(PDF).digest('hex'));
  await expect(appelApi(page, 'DELETE', `/pieces-jointes-ecritures/${piece.id}`)).rejects.toThrow(/409/);
  // L'écriture d'un exercice clôturé reçoit encore sa pièce (art. 17, 3°).
  expect((await deposer(page, `/ecritures/${recette.id}/pieces-jointes`, 'Bordereau.pdf', '%PDF-1.4 bordereau')).statut).toBe(201);
  // Le commentaire, annotation d'OmegaX, se retouche encore.
  await appelApi(page, 'PATCH', `/pieces-jointes-ecritures/${piece.id}`, { commentaire: 'Facture de mars, original au classeur 3' });

  // L'à-nouveau de N+1, qui fait foi, reçoit une pièce.
  const ouverture = (await lister(suivant.id)).find((e) => !e.estANouveauProvisoire);
  expect(ouverture).toBeDefined();
  expect((await deposer(page, `/ecritures/${ouverture!.id}/pieces-jointes`, 'Balance.pdf', '%PDF-1.4 balance')).statut).toBe(201);

  expect(pannes).toEqual([]);
});
