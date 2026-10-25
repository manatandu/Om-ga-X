import { expect, test, type Page } from '@playwright/test';
import { MOT_DE_PASSE, appelApi, creerDossier, entrerDansUnLogiciel, seConnecter, surveiller } from './outils';

/**
 * VISA D'UN RIB PAR UN SECOND UTILISATEUR (2026-10-21, gel levé par Manasse ·
 * « Lève le gel pour le visa d'un RIB », vu chez Microfina++).
 *
 * Sur le serveur réel et une vraie base, à travers une clôture · l'option
 * posée dans Paramètres du dossier, l'ordre de virement est refusé tant que le
 * RIB principal du fournisseur n'est pas visé ; l'administrateur qui l'a saisi
 * ne peut pas le viser ; un comptable le vise depuis la fiche du tiers ; le
 * visa tient après la clôture de N ; changer le numéro en N+1 le fait tomber,
 * et un visa posé sur la lecture d'avant est refusé.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string }
interface Groupe { compteId: string; lignes: Array<{ id: string }> }
interface Rib { id: string; numeroCompte: string | null; visa: { vise: boolean; saisiLe: string | null; saisiParVous: boolean; visePar: string | null } }

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);
const refusDe = (p: Promise<unknown>) => p.then(() => 'accepté', (e: unknown) => String(e));

test('visa des RIB · refus, visa par un second utilisateur, visa qui tient à la clôture et tombe au changement', async ({ page, browser }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Visa RIB e2e SARL', montant: 5_000_000 });
  await seConnecter(page, dossier.email);
  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = N.dateDebut.slice(0, 4);

  // Le comptable, second utilisateur du dossier, sur un autre navigateur.
  const comptable = `e2e-visa-${Date.now()}@exemple.cd`;
  const sonMotDePasse = `${MOT_DE_PASSE}-v2`;
  await appelApi(page, 'POST', '/utilisateurs', { email: comptable, motDePasse: MOT_DE_PASSE, role: 'COMPTABLE' });
  const autre = await (await browser.newContext()).newPage();
  const entetes = { 'X-Forwarded-For': `10.251.${Date.now() % 250}.9` };
  await autre.goto('/');
  await appelApi(autre, 'POST', '/auth/login', { email: comptable, motDePasse: MOT_DE_PASSE }, entetes);
  await appelApi(autre, 'POST', '/auth/changer-mot-de-passe', { motDePasseActuel: MOT_DE_PASSE, nouveauMotDePasse: sonMotDePasse }, entetes);
  await autre.waitForTimeout(1_100);
  await appelApi(autre, 'POST', '/auth/login', { email: comptable, motDePasse: sonMotDePasse }, entetes);

  // Le donneur d'ordre, le fournisseur et son RIB, saisi par l'administrateur.
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const bq = journaux.find((j) => j.code === 'BQ')!;
  const banque = await appelApi<{ id: string }>(page, 'POST', '/banques', { intitule: 'Rawbank' });
  await appelApi(page, 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW', numeroCompte: '0001234', journalId: bq.id });
  const fournisseur = await appelApi<{ id: string; compteIndividuel: { numero: string } }>(page, 'POST', '/tiers', {
    type: 'FOURNISSEUR',
    code: 'FRS-VISA',
    nom: 'Imprimerie du Fleuve',
  });
  await appelApi(page, 'POST', `/tiers/${fournisseur.id}/ribs`, { banque: 'Equity BCDC', numeroCompte: '0009876' });
  const ribs = () => appelApi<Rib[]>(page, 'GET', `/tiers/${fournisseur.id}/ribs`);
  const [rib] = await ribs();
  expect(rib.visa).toMatchObject({ vise: false, saisiParVous: true });

  // L'OPTION SE POSE À L'ÉCRAN, par l'administrateur.
  await page.goto('/#/parametres-dossier');
  await page.getByRole('button', { name: 'Régime fiscal', exact: true }).click();
  // Case tenue par la réponse du serveur · elle ne se coche qu'au retour, d'où le clic suivi de l'attente.
  const option = page.getByLabel('Visa des RIB par un second utilisateur');
  await option.click();
  await expect(page.getByText('Visa des RIB exigé')).toBeVisible();
  await expect(option).toBeChecked();

  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const achat = comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith('601'))!;
  await appelApi(page, 'PATCH', `/comptes/${achat.id}`, { estRetenu: true });
  const compteFournisseur = comptes.find((c) => c.numero === fournisseur.compteIndividuel.numero)!.id;
  const achats = journaux.find((j) => j.type === 'ACHATS')!;

  const facturer = (exerciceId: string, date: string, montant: number) =>
    appelApi(page, 'POST', '/ecritures', {
      exerciceId,
      journalId: achats.id,
      date,
      libelle: `Facture fournisseur ${date}`,
      lignes: [
        { compteId: achat.id, libelle: 'Fournitures', debit: montant, credit: 0 },
        { compteId: compteFournisseur, libelle: 'Imprimerie du Fleuve', debit: 0, credit: montant, dateEcheance: date },
      ],
    });
  const payer = async (exerciceId: string, date: string, montant: number) => {
    const groupes = await appelApi<Groupe[]>(page, 'GET', `/reglements/echeances?exerciceId=${exerciceId}&sens=FOURNISSEUR`);
    const facture = groupes.find((g) => g.compteId === compteFournisseur)!.lignes[0];
    return appelApi<{ ordre: { id: string; numero: number } }>(page, 'POST', '/reglements', {
      exerciceId,
      journalId: bq.id,
      sens: 'FOURNISSEUR',
      date,
      ordreVirement: true,
      reglements: [{ compteId: compteFournisseur, ligneIds: [facture.id], montant, imputation: [{ ligneId: facture.id, montant }] }],
    });
  };

  await facturer(N.id, `${annee}-02-12`, 1_160_000);

  // REFUSÉ TANT QUE LE RIB N'EST PAS VISÉ, avant toute pièce.
  expect(await refusDe(payer(N.id, `${annee}-03-15`, 1_160_000))).toMatch(/Imprimerie du Fleuve n'est pas visé/);

  // L'AUTEUR NE VISE PAS SON PROPRE RIB · ni bouton, ni route.
  await page.goto('/#/tiers');
  await page.getByRole('button', { name: /FRS-VISA/ }).click();
  await expect(page.getByText('Non visé · exigé pour les virements')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Viser le RIB Equity BCDC', exact: true })).toHaveCount(0);
  expect(await refusDe(appelApi(page, 'POST', `/ribs-tiers/${rib.id}/viser`, { saisiLeLu: rib.visa.saisiLe }))).toMatch(/403/);

  // LE COMPTABLE LE VISE DEPUIS LA FICHE DU TIERS.
  await viserALEcran(autre);
  const [vise] = await ribs();
  expect(vise.visa).toMatchObject({ vise: true, visePar: comptable });

  // L'ordre part, sur le RIB visé.
  const premier = await payer(N.id, `${annee}-03-15`, 1_160_000);
  expect(premier.ordre.numero).toBeGreaterThan(0);

  // LA CLÔTURE DE N · le visa n'est pas de l'exercice, il tient.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: N.id, dateLimite: jour(N.dateFin) });
  const debutSuivant = lendemain(N.dateFin);
  const N1 = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${debutSuivant.slice(0, 4)}-12-31` });
  await appelApi(page, 'POST', `/exercices/${N.id}/cloturer`);
  const anneeSuivante = debutSuivant.slice(0, 4);

  await facturer(N1.id, `${anneeSuivante}-02-10`, 580_000);
  const second = await payer(N1.id, `${anneeSuivante}-03-10`, 580_000);
  expect(second.ordre.numero).toBe(premier.ordre.numero + 1);

  // CHANGER LE NUMÉRO EN N+1 FAIT TOMBER LE VISA, et l'ordre est de nouveau refusé.
  await appelApi(page, 'PATCH', `/ribs-tiers/${rib.id}`, { banque: 'Equity BCDC', numeroCompte: '0005555', estPrincipal: true });
  const [change] = await ribs();
  expect(change.visa.vise).toBe(false);
  await facturer(N1.id, `${anneeSuivante}-04-10`, 232_000);
  expect(await refusDe(payer(N1.id, `${anneeSuivante}-05-10`, 232_000))).toMatch(/n'est pas visé/);

  // UN VISA POSÉ SUR LA LECTURE D'AVANT LE CHANGEMENT EST REFUSÉ (409).
  expect(await refusDe(appelApi(autre, 'POST', `/ribs-tiers/${rib.id}/viser`, { saisiLeLu: vise.visa.saisiLe }, entetes))).toMatch(/409/);
  await appelApi(autre, 'POST', `/ribs-tiers/${rib.id}/viser`, { saisiLeLu: change.visa.saisiLe }, entetes);
  const troisieme = await payer(N1.id, `${anneeSuivante}-05-10`, 232_000);
  const ordre = await appelApi<{ lignes: Array<{ numeroCompte: string | null; coordonnees?: string }> }>(page, 'GET', `/ordres-virement/${troisieme.ordre.id}`);
  expect(JSON.stringify(ordre)).toContain('0005555');

  // UN RIB QUI CHANGE DE BÉNÉFICIAIRE PERD SON VISA · un doublon au RIB visé,
  // fusionné dans le fournisseur, n'apporte pas son visa.
  const doublon = await appelApi<{ id: string }>(page, 'POST', '/tiers', { type: 'FOURNISSEUR', code: 'FRS-DBL', nom: 'Imprimerie du Fleuve bis' });
  await appelApi(page, 'POST', `/tiers/${doublon.id}/ribs`, { banque: 'Rawbank', numeroCompte: '0004444' });
  const [ribDoublon] = await appelApi<Rib[]>(page, 'GET', `/tiers/${doublon.id}/ribs`);
  await appelApi(autre, 'POST', `/ribs-tiers/${ribDoublon.id}/viser`, { saisiLeLu: ribDoublon.visa.saisiLe }, entetes);
  expect((await appelApi<Rib[]>(page, 'GET', `/tiers/${doublon.id}/ribs`))[0].visa.vise).toBe(true);
  await appelApi(page, 'POST', `/tiers/${doublon.id}/fusion/${fournisseur.id}`);
  const apresFusion = (await ribs()).find((r) => r.id === ribDoublon.id)!;
  expect(apresFusion.visa).toMatchObject({ vise: false, saisiParVous: true });

  await autre.context().close();
  expect(pannes).toEqual([]);
});

/** Le comptable, déjà connecté sur son navigateur, vise le RIB depuis la fiche du fournisseur. */
async function viserALEcran(autre: Page) {
  await autre.goto('/');
  await entrerDansUnLogiciel(autre);
  await autre.goto('/#/tiers');
  await autre.getByRole('button', { name: /FRS-VISA/ }).click();
  await autre.getByRole('button', { name: 'Viser le RIB Equity BCDC', exact: true }).click();
  await expect(autre.getByText(/^Visé par /)).toBeVisible();
}
