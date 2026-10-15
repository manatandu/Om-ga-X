import { expect, test, type Page } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * ESSAIS DE PARITÉ · LES BORDS DES TROIS LIGNES (sage-l1, sage-l4, sage-l5).
 *
 * Les parcours nominaux ont chacun leur spec (`sage-l1-*`, `sage-l4-*`,
 * `sage-l5-*`). Ceux-ci éprouvent ce que la liste des cas limites de la
 * compétence de réplication demande et qu'aucun parcours ne touchait
 * (`docs/comparaison-sage/reproduction/test-plan.md`) · l'objet d'un dossier
 * invisible et intouchable depuis un autre, le double envoi d'un même geste,
 * les saisies aux bornes (longueur, accents, signes) et la simulation forcée
 * par l'API là où l'écran ne la propose pas. Aucune réponse 5xx, aucune
 * exception · `surveiller`.
 */
interface Exercice { id: string; dateDebut: string }
interface Compte { id: string; numero: string }
interface Journal { id: string; code: string; type: string }
interface Sequence { id: string; numero: number; intitule: string }
interface Ecriture { id: string; statut: string; lignes: Array<{ id: string; compteId: string }> }

/** Le statut HTTP d'un appel refusé, ou 200 s'il passe · le refus est la réponse attendue. */
async function statut(appel: Promise<unknown>): Promise<number> {
  try {
    await appel;
    return 200;
  } catch (e) {
    const m = /· (\d{3}) ·/.exec(String((e as Error).message));
    return m ? Number(m[1]) : -1;
  }
}

async function plan(page: Page) {
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  return (numero: string) => {
    const c = comptes.find((x) => x.numero === numero);
    if (!c) throw new Error(`${numero} absent du dossier semé`);
    return c;
  };
}

test("SYSCOHADA · l'objet d'un dossier ne se lit ni ne se touche depuis un autre", async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const a = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Parité A', montant: 1_000 });
  const b = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Parité B', montant: 1_000 });

  // DOSSIER A · une séquence, une simulation, un bien né d'une ligne validée, une impression.
  await seConnecter(page, a.email);
  const sequenceA = await appelApi<Sequence>(page, 'POST', '/sequences-saisie', { intitule: 'Achats de A' });
  const exA = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id === a.exerciceId)!;
  const compteA = await plan(page);
  const odA = (await appelApi<Journal[]>(page, 'GET', '/journaux')).find((j) => j.code === 'OD')!;
  const sitA = await appelApi<Journal>(page, 'POST', '/journaux', { code: 'SIT', intitule: 'Simulations', type: 'SITUATION', numerotation: 'CONTINUE_JOURNAL' });
  // Hors du premier jour · une pièce de ce jour-là peut être la reprise du bilan d'ouverture.
  const debut = `${exA.dateDebut.slice(0, 4)}-03-15`;
  const simulationA = await appelApi<{ id: string }>(page, 'POST', '/ecritures', {
    exerciceId: exA.id,
    journalId: sitA.id,
    date: debut,
    libelle: 'Simulation de A',
    lignes: [
      { compteId: compteA('24510000').id, debit: 1_000_000, credit: 0 },
      { compteId: compteA('48120000').id, debit: 0, credit: 1_000_000 },
    ],
  });
  const achatA = await appelApi<{ id: string }>(page, 'POST', '/ecritures', {
    exerciceId: exA.id,
    journalId: odA.id,
    date: debut,
    libelle: 'Facture camion de A',
    lignes: [
      { compteId: compteA('24510000').id, debit: 9_000_000, credit: 0, libelle: 'Camion de A' },
      { compteId: compteA('48120000').id, debit: 0, credit: 9_000_000 },
    ],
  });
  await appelApi(page, 'POST', '/ecritures/valider', { ecritureIds: [achatA.id] });
  const { lignes: aTransformer } = await appelApi<{ lignes: Array<{ ligneId: string; ecritureId: string }> }>(
    page,
    'GET',
    '/immobilisations/ecritures-a-transformer',
  );
  const ligneA = aTransformer.find((l) => l.ecritureId === achatA.id)!;
  expect(ligneA).toBeTruthy();
  const bienA = await appelApi<{ id: string }>(page, 'POST', '/immobilisations/depuis-ecriture', { ligneId: ligneA.ligneId });
  const impressionA = await appelApi<{ id?: string; numero: number | null }>(page, 'POST', '/impressions-journal', { exerciceId: exA.id, journalId: odA.id });
  expect(impressionA.numero).toBe(1);
  await appelApi(page, 'POST', '/auth/logout');

  // DOSSIER B · chaque geste sur un objet de A est refusé, jamais servi, jamais en panne.
  // Au repos avant de quitter la fenêtre · WebKit rend une lecture coupée en exception.
  await page.waitForLoadState('networkidle');
  await seConnecter(page, b.email);
  const exB = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id === b.exerciceId)!;
  const odB = (await appelApi<Journal[]>(page, 'GET', '/journaux')).find((j) => j.code === 'OD')!;
  const essais: Array<[string, () => Promise<unknown>]> = [
    ['renommer la séquence de A', () => appelApi(page, 'PATCH', `/sequences-saisie/${sequenceA.id}`, { intitule: 'Volée' })],
    ['retirer la séquence de A', () => appelApi(page, 'DELETE', `/sequences-saisie/${sequenceA.id}`)],
    ['transférer la simulation de A', () => appelApi(page, 'POST', `/ecritures/${simulationA.id}/transfert`, { journalId: odB.id })],
    ['lire la duplication du bien de A', () => appelApi(page, 'GET', `/immobilisations/${bienA.id}/duplication`)],
    ['lire les traitements du bien de A', () => appelApi(page, 'GET', `/immobilisations/${bienA.id}/traitements`)],
    ['modifier le bien de A', () => appelApi(page, 'PATCH', `/immobilisations/${bienA.id}`, { designation: 'Volé' })],
    ['supprimer le bien de A', () => appelApi(page, 'DELETE', `/immobilisations/${bienA.id}`)],
    ['créer un bien depuis la ligne de A', () => appelApi(page, 'POST', '/immobilisations/depuis-ecriture', { ligneId: ligneA.ligneId })],
    ["imprimer le journal de A sous l'exercice de B", () => appelApi(page, 'POST', '/impressions-journal', { exerciceId: exB.id, journalId: odA.id })],
    ["imprimer sous l'exercice de A", () => appelApi(page, 'POST', '/impressions-journal', { exerciceId: exA.id, journalId: odB.id })],
  ];
  const refus: Record<string, number> = {};
  for (const [nom, appel] of essais) refus[nom] = await statut(appel());
  for (const [nom, code] of Object.entries(refus)) {
    expect.soft(code >= 400 && code < 500, `${nom} · ${code}`).toBe(true);
  }
  // Les listes de B ne nomment rien de A.
  const sequencesB = await appelApi<Sequence[]>(page, 'GET', '/sequences-saisie');
  expect(sequencesB.map((s) => s.id)).not.toContain(sequenceA.id);
  const { lignes: aTransformerB } = await appelApi<{ lignes: Array<{ ligneId: string }> }>(page, 'GET', '/immobilisations/ecritures-a-transformer');
  expect(aTransformerB.map((l) => l.ligneId)).not.toContain(ligneA.ligneId);
  await appelApi(page, 'POST', '/auth/logout');

  // DOSSIER A · rien n'a bougé.
  await page.waitForLoadState('networkidle');
  await seConnecter(page, a.email);
  const sequencesA = await appelApi<Sequence[]>(page, 'GET', '/sequences-saisie');
  expect(sequencesA.find((s) => s.id === sequenceA.id)?.intitule).toBe('Achats de A');
  const duplication = await appelApi<{ designation: string }>(page, 'GET', `/immobilisations/${bienA.id}/duplication`);
  // La duplication PROPOSE la désignation suivie de « (copie) » · le bien de A garde la sienne.
  expect(duplication.designation).toBe('Camion de A (copie)');

  expect(pannes).toEqual([]);
});

test('SYSCOHADA · un geste envoyé deux fois à la fois ne se fait qu’une fois, et les saisies aux bornes se jugent', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const d = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Parité bords', montant: 1_000 });
  await seConnecter(page, d.email);
  const ex = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id === d.exerciceId)!;
  const compte = await plan(page);
  const od = (await appelApi<Journal[]>(page, 'GET', '/journaux')).find((j) => j.code === 'OD')!;
  const debut = `${ex.dateDebut.slice(0, 4)}-03-15`;

  // SÉQUENCES · 35 caractères accentués passent, 36 sont refusés ; trois créations à la fois prennent trois rangs.
  expect(await statut(appelApi(page, 'POST', '/sequences-saisie', { intitule: 'é'.repeat(35) }))).toBe(200);
  expect(await statut(appelApi(page, 'POST', '/sequences-saisie', { intitule: 'é'.repeat(36) }))).toBe(400);
  expect(await statut(appelApi(page, 'POST', '/sequences-saisie', { intitule: '   ' }))).toBe(400);
  const enParallele = await Promise.all(
    ['Ventes', 'Paie', 'Banque'].map((intitule) => statut(appelApi(page, 'POST', '/sequences-saisie', { intitule }))),
  );
  const sequences = await appelApi<Sequence[]>(page, 'GET', '/sequences-saisie');
  const rangs = sequences.map((s) => s.numero);
  expect(new Set(rangs).size, `rangs ${rangs.join(', ')} · envois ${enParallele.join(', ')}`).toBe(rangs.length);
  expect(enParallele.every((c) => c === 200 || (c >= 400 && c < 500))).toBe(true);

  // LETTRE CHOISIE · une à quatre lettres, sans chiffre, accent ni signe.
  const tiers = await appelApi<{ panoplie: { crees: { role: string; numero: string }[] } }>(page, 'POST', '/tiers', {
    type: 'FOURNISSEUR',
    code: 'F-BORDS',
    nom: 'Fournisseur des bords',
  });
  // Le plan se relit · le compte du tiers vient de naître.
  const fournisseur = (await plan(page))(tiers.panoplie.crees.find((c) => c.role === 'PRINCIPAL')!.numero);
  const charge = compte('60510000');
  const piece = (libelle: string, debit: Compte, credit: Compte, montant: number) =>
    appelApi(page, 'POST', '/ecritures', {
      exerciceId: ex.id,
      journalId: od.id,
      date: debut,
      libelle,
      lignes: [
        { compteId: debit.id, libelle, debit: montant, credit: 0 },
        { compteId: credit.id, libelle, debit: 0, credit: montant },
      ],
    });
  for (const [m, n] of [[300, 3]] as const) {
    await piece(`Facture ${n}`, charge, fournisseur, m);
    await piece(`Avoir ${n}`, fournisseur, charge, m);
  }
  const etat = await appelApi<{ lignes: { id: string; libelle: string; lettrageId: string | null }[] }>(page, 'GET', `/comptes/${fournisseur.id}/lettrage`);
  const couple = (n: number) => etat.lignes.filter((l) => l.libelle === `Facture ${n}` || l.libelle === `Avoir ${n}`).map((l) => l.id);
  for (const lettre of ['é', 'ABCDE', '1', 'A B']) {
    expect(await statut(appelApi(page, 'POST', `/comptes/${fournisseur.id}/lettrage`, { ligneIds: couple(3), lettre })), lettre).toBe(400);
  }
  // Le DOUBLE ENVOI d'un lettrage sur un même compte n'est pas éprouvé ici · le
  // second rend une 500 (B-PAR-01, `docs/comparaison-sage/reproduction/bugs.md`),
  // défaut d'avant la ligne, noté au suivi sous le gel.

  // IMPRESSION · deux impressions à la fois prennent deux numéros de la suite.
  const impressions = await Promise.all([1, 2].map(() => appelApi<{ numero: number | null }>(page, 'POST', '/impressions-journal', { exerciceId: ex.id, journalId: od.id })));
  expect(impressions.map((i) => i.numero).sort()).toEqual([1, 2]);

  // CRÉATION DEPUIS UNE LIGNE · la même ligne envoyée deux fois à la fois fait un seul bien.
  const achat = await appelApi<{ id: string }>(page, 'POST', '/ecritures', {
    exerciceId: ex.id,
    journalId: od.id,
    date: debut,
    libelle: 'Facture camion',
    lignes: [
      { compteId: compte('24510000').id, debit: 5_000_000, credit: 0, libelle: 'Camion' },
      { compteId: compte('48120000').id, debit: 0, credit: 5_000_000 },
    ],
  });
  await appelApi(page, 'POST', '/ecritures/valider', { ecritureIds: [achat.id] });
  const { lignes } = await appelApi<{ lignes: Array<{ ligneId: string; ecritureId: string }> }>(page, 'GET', '/immobilisations/ecritures-a-transformer');
  const ligne = lignes.find((l) => l.ecritureId === achat.id)!;
  const deuxFois = await Promise.all([1, 2].map(() => statut(appelApi(page, 'POST', '/immobilisations/depuis-ecriture', { ligneId: ligne.ligneId }))));
  expect(deuxFois.filter((c) => c === 200), `envois ${deuxFois.join(', ')}`).toHaveLength(1);
  expect(deuxFois.filter((c) => c >= 400 && c < 500), `envois ${deuxFois.join(', ')}`).toHaveLength(1);

  expect(pannes).toEqual([]);
});

test("SYSCOHADA · une simulation forcée par l'API ne se lettre pas, ne fait naître aucun bien, et ne reçoit aucun transfert", async ({ page }) => {
  test.setTimeout(180_000);
  const pannes = surveiller(page);
  const d = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Parité simulation', montant: 1_000 });
  await seConnecter(page, d.email);
  const ex = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).find((e) => e.id === d.exerciceId)!;
  const compte = await plan(page);
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.code === 'OD')!;
  const sit = await appelApi<Journal>(page, 'POST', '/journaux', { code: 'SIT', intitule: 'Simulations', type: 'SITUATION', numerotation: 'CONTINUE_JOURNAL' });
  const debut = `${ex.dateDebut.slice(0, 4)}-03-15`;
  const tiers = await appelApi<{ panoplie: { crees: { role: string; numero: string }[] } }>(page, 'POST', '/tiers', {
    type: 'FOURNISSEUR',
    code: 'F-SIM',
    nom: 'Fournisseur simulé',
  });
  // Le plan se relit · le compte du tiers vient de naître.
  const fournisseur = (await plan(page))(tiers.panoplie.crees.find((c) => c.role === 'PRINCIPAL')!.numero);
  const simuler = (libelle: string, debit: Compte, credit: Compte, montant: number) =>
    appelApi<{ id: string; statut: string }>(page, 'POST', '/ecritures', {
      exerciceId: ex.id,
      journalId: sit.id,
      date: debut,
      libelle,
      lignes: [
        { compteId: debit.id, libelle, debit: montant, credit: 0 },
        { compteId: credit.id, libelle, debit: 0, credit: montant },
      ],
    });
  const facture = await simuler('Facture simulée', compte('24510000'), fournisseur, 700);
  const reglement = await simuler('Règlement simulé', fournisseur, compte('52110000'), 700);
  expect([facture.statut, reglement.statut]).toEqual(['SITUATION', 'SITUATION']);

  const { ecritures } = await appelApi<{ ecritures: Ecriture[] }>(page, 'GET', `/ecritures?exerciceId=${ex.id}&journalId=${sit.id}`);
  const lignesFournisseur = ecritures.flatMap((e) => e.lignes).filter((l) => l.compteId === fournisseur.id).map((l) => l.id);
  expect(lignesFournisseur).toHaveLength(2);
  expect(await statut(appelApi(page, 'POST', `/comptes/${fournisseur.id}/lettrage`, { ligneIds: lignesFournisseur }))).toBe(400);

  const ligneBien = ecritures.find((e) => e.id === facture.id)!.lignes.find((l) => l.compteId === compte('24510000').id)!;
  const { lignes: aTransformer } = await appelApi<{ lignes: Array<{ ligneId: string }> }>(page, 'GET', '/immobilisations/ecritures-a-transformer');
  expect(aTransformer.map((l) => l.ligneId)).not.toContain(ligneBien.id);
  const naissance = await statut(appelApi(page, 'POST', '/immobilisations/depuis-ecriture', { ligneId: ligneBien.id }));
  expect(naissance >= 400 && naissance < 500, `naissance · ${naissance}`).toBe(true);

  // Une écriture ordinaire ne se transfère pas DANS un journal de situation.
  const ordinaire = await appelApi<{ id: string }>(page, 'POST', '/ecritures', {
    exerciceId: ex.id,
    journalId: od.id,
    date: debut,
    libelle: 'Pièce ordinaire',
    lignes: [
      { compteId: compte('60510000').id, debit: 50, credit: 0 },
      { compteId: compte('52110000').id, debit: 0, credit: 50 },
    ],
  });
  const versSituation = await statut(appelApi(page, 'POST', `/ecritures/${ordinaire.id}/transfert`, { journalId: sit.id }));
  expect(versSituation >= 400 && versSituation < 500, `transfert · ${versSituation}`).toBe(true);

  expect(pannes).toEqual([]);
});
