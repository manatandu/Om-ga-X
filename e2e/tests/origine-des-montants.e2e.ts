import { expect, test, type Page } from '@playwright/test';
import { appelApi, creerDossier, rechargerAuRepos, seConnecter, surveiller } from './outils';

/**
 * D'OÙ VIENT CE CHIFFRE, SUR LA BASE RÉELLE (ligne origine-des-montants) · le
 * zoom de Sage 100, du bilan jusqu'à la pièce, à travers une clôture.
 *
 * Le dossier passe une recette en N, clôture N, en passe une seconde en N+1.
 * Sur le bilan de N+1, la trésorerie N (report de N plus la recette de N+1)
 * et N-1 (la clôture de N) se remontent à leurs comptes au centime, servies
 * par la route de l'origine sur la vraie balance ; puis l'écran les ouvre au
 * double-clic, descend au grand livre du compte de banque et à la pièce.
 * Les doublures des tests unitaires ne lisent ni à-nouveau ni clôture · c'est
 * là que la règle d'un état change, et c'est ici qu'elle se rejoue.
 */
const MONTANT = 150_000;
const SECONDE = 47_250.5;

interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string }
interface Origine {
  montant: number | null;
  nature: string;
  total: number | null;
  ecart: number | null;
  exerciceDesComptesId: string | null;
  groupes: { comptes: { numero: string; montant: number; compteId: string | null }[] }[];
  composants: { ref: string; montant: number | null }[];
}

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);

/** Le poste de trésorerie-actif où va la banque · un numéro, deux plans. */
const POSTE_BANQUE = { SYSCOHADA: 'BS', SYCEBNL: 'BW' } as const;
const BASE = { SYSCOHADA: '/etats-financiers-syscohada', SYCEBNL: '/etats-financiers' } as const;

async function passerUneRecette(page: Page, exercice: Exercice, montant: number) {
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const detail = (racine: string) => comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith(racine))!;
  const journal = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
  const date = new Date((Date.parse(exercice.dateDebut) + Date.parse(exercice.dateFin)) / 2).toISOString().slice(0, 10);
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: exercice.id,
    journalId: journal.id,
    date,
    libelle: 'Recette N+1 e2e',
    lignes: [
      { compteId: detail('52').id, libelle: 'Recette N+1 e2e', debit: montant, credit: 0 },
      { compteId: detail('7').id, libelle: 'Recette N+1 e2e', debit: 0, credit: montant },
    ],
  });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
}

for (const referentiel of ['SYSCOHADA', 'SYCEBNL'] as const) {
  test(`${referentiel} · un montant du bilan remonte à ses comptes, au grand livre et à la pièce, à travers une clôture`, async ({ page }) => {
    const pannes = surveiller(page);
    const dossier = await creerDossier(page, { referentiel, nom: `Origine e2e ${referentiel}`, montant: MONTANT });
    await seConnecter(page, dossier.email);

    const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
    await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
    const debutSuivant = lendemain(exercice.dateFin);
    const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', {
      dateDebut: debutSuivant,
      dateFin: `${Number(debutSuivant.slice(0, 4))}-12-31`,
    });
    await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);
    await passerUneRecette(page, suivant, SECONDE);

    // LA ROUTE, SUR LA VRAIE BALANCE · N porte le report de N et la recette
    // de N+1, N-1 la clôture de N ; chaque total refait le bilan au centime.
    const ref = POSTE_BANQUE[referentiel];
    const lire = (colonne: string, r: string = ref) =>
      appelApi<Origine>(page, 'GET', `${BASE[referentiel]}/origine?exerciceId=${suivant.id}&etat=bilan&ref=${r}&colonne=${colonne}`);
    const bilan = await appelApi<{ actif: { ref: string; montant: number; montantN1?: number }[] }>(
      page,
      'GET',
      `${BASE[referentiel]}/bilan?exerciceId=${suivant.id}`,
    );
    const poste = bilan.actif.find((l) => l.ref === ref)!;
    const [n, n1, total] = await Promise.all([lire('N'), lire('N1'), lire('N', 'BZ')]);
    expect({ montant: poste.montant, montantN1: poste.montantN1 }).toEqual({ montant: MONTANT + SECONDE, montantN1: MONTANT });
    expect([n.montant, n.total, n.ecart, n.exerciceDesComptesId]).toEqual([MONTANT + SECONDE, MONTANT + SECONDE, 0, suivant.id]);
    expect([n1.montant, n1.total, n1.ecart, n1.exerciceDesComptesId]).toEqual([MONTANT, MONTANT, 0, exercice.id]);
    expect(n.groupes.flatMap((g) => g.comptes).every((c) => c.compteId !== null)).toBe(true);
    expect([total.nature, total.ecart]).toEqual(['FORMULE', 0]);

    // TOUT MONTANT CHIFFRÉ DES TROIS ÉTATS, N ET N-1, SUR LA VRAIE BALANCE ·
    // le résultat de N repris en N+1 (13, puis classes 6 à 8), les flux lus
    // contre l'ouverture, les totaux · aucun écart, au centime.
    const ecarts: string[] = [];
    let lus = 0;
    for (const etat of ['bilan', 'compte-de-resultat', 'tableau-flux-tresorerie'] as const) {
      const lu = await appelApi<Record<string, unknown>>(page, 'GET', `${BASE[referentiel]}/${etat}?exerciceId=${suivant.id}`);
      const lignes = Object.values(lu)
        .filter(Array.isArray)
        .flat()
        .filter((l): l is { ref: string; montant?: number; montantN1?: number } => typeof l === 'object' && l !== null && 'ref' in l);
      for (const l of lignes) {
        for (const colonne of ['N', 'N1'] as const) {
          const valeur = colonne === 'N' ? l.montant : l.montantN1;
          if (valeur === undefined || Math.abs(valeur) < 0.005) continue;
          const o = await appelApi<Origine>(
            page,
            'GET',
            `${BASE[referentiel]}/origine?exerciceId=${suivant.id}&etat=${etat}&ref=${l.ref}&colonne=${colonne}`,
          );
          lus++;
          if (o.ecart !== null && o.ecart !== 0) ecarts.push(`${etat} ${l.ref} ${colonne} · écart ${o.ecart}`);
        }
      }
    }
    // Et toute ligne chiffrée des notes annexes, colonnes N et N-1.
    const notes = await appelApi<{ notes: { code: string; sousTableau?: string; lignes: { montantN: number; montantN1?: number }[] }[] }>(
      page,
      'GET',
      referentiel === 'SYSCOHADA' ? `/etats-financiers-syscohada/notes?exerciceId=${suivant.id}` : `/notes-annexes/associations?exerciceId=${suivant.id}`,
    );
    const routeNotes = referentiel === 'SYSCOHADA' ? '/etats-financiers-syscohada/notes/origine' : '/notes-annexes/origine';
    for (const note of notes.notes) {
      for (const [i, l] of note.lignes.entries()) {
        for (const colonne of ['N', 'N1'] as const) {
          const valeur = colonne === 'N' ? l.montantN : l.montantN1;
          if (valeur === undefined || Math.abs(valeur) < 0.005) continue;
          const sous = note.sousTableau ? `&sousTableau=${encodeURIComponent(note.sousTableau)}` : '';
          const o = await appelApi<Origine>(page, 'GET', `${routeNotes}?exerciceId=${suivant.id}&ref=${encodeURIComponent(note.code)}${sous}&ligne=${i}&colonne=${colonne}`);
          lus++;
          if (o.ecart !== null && o.ecart !== 0) ecarts.push(`note ${note.code} ligne ${i} ${colonne} · écart ${o.ecart}`);
        }
      }
    }
    expect(ecarts).toEqual([]);
    // Le balayage a lu des montants · un balayage vide ne prouverait rien.
    expect(lus).toBeGreaterThan(10);

    // L'ÉCRAN · double-clic sur le montant N, puis le compte, puis la ligne.
    // Rechargé d'abord · l'exercice ouvert est N+1, créé après la connexion.
    await rechargerAuRepos(page);
    await page.goto('/#/etats-financiers');
    const cellule = page.locator(`[data-origine="bilan:${ref}:N"]`);
    await expect(cellule).toBeVisible();
    await cellule.dblclick();
    const fenetre = page.getByRole('dialog', { name: /Origine du montant/ });
    await expect(fenetre).toBeVisible();
    await expect(fenetre.locator('[data-total-origine]')).toHaveText(/197\s?250,50/);
    await expect(fenetre.locator('[data-ecart-origine]')).toHaveCount(0);
    await fenetre.locator('[data-compte-origine^="52"]').first().dblclick();
    const lignes = fenetre.locator('[data-ligne-grand-livre]');
    await expect(lignes.first()).toBeVisible();
    // La recette de N+1 est une ligne du grand livre de N+1 · elle ouvre sa pièce.
    await lignes.filter({ hasText: 'Recette N+1 e2e' }).first().dblclick();
    await expect(page.getByRole('dialog', { name: "Fiche d'imputation" })).toBeVisible();
    await expect(page.getByRole('dialog', { name: "Fiche d'imputation" })).toContainText('Recette N+1 e2e');
    // Échap ferme la pièce, puis remonte au poste, puis ferme la fenêtre.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: "Fiche d'imputation" })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(fenetre.locator('[data-total-origine]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fenetre).toHaveCount(0);

    // AU CLAVIER · Entrée sur la cellule N-1 ouvre la colonne de la clôture.
    await page.locator(`[data-origine="bilan:${ref}:N1"]`).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: /Origine du montant/ }).locator('[data-total-origine]')).toHaveText(/150\s?000,00/);
    await page.keyboard.press('Escape');

    // UN TOTAL DE NOTE DESCEND À SES RUBRIQUES, jamais ne se rouvre lui-même
    // (relecture du 2026-11-01, majeur 1) · le total chiffré d'une note, puis
    // une rubrique servie qu'il additionne.
    type Ligne = { libelle: string; estTotal: boolean; montantN: number; saisie?: unknown };
    const avecTotal = notes.notes.find((x) =>
      (x as unknown as { lignes: Ligne[] }).lignes.some((l) => l.estTotal && Math.abs(l.montantN) > 0.005 && l.saisie === undefined),
    ) as unknown as { code: string; sousTableau?: string; lignes: Ligne[] };
    const rangTotal = avecTotal.lignes.findIndex((l) => l.estTotal && Math.abs(l.montantN) > 0.005 && l.saisie === undefined);
    await page.goto('/#/notes-annexes');
    await page.getByRole('button', { name: new RegExp(`^${avecTotal.code}\\s`) }).first().click();
    await page.locator(`[data-origine="note:${avecTotal.code}:${rangTotal}:N"]`).first().dblclick();
    const fenetreNote = page.getByRole('dialog', { name: /Origine du montant/ });
    const rubriques = fenetreNote.locator('[data-composant-origine]');
    await expect(rubriques.first()).toBeVisible();
    const ouvrable = fenetreNote.locator('tr[role="button"][data-composant-origine]').first();
    const rangRubrique = Number(await ouvrable.getAttribute('data-composant-origine'));
    expect(rangRubrique).not.toBe(rangTotal);
    await ouvrable.dblclick();
    await expect(fenetreNote).toHaveAccessibleName(new RegExp(`ligne ${rangTotal + 1} › ${avecTotal.code} ligne ${rangRubrique + 1}`));
    await expect(fenetreNote.locator('[data-composant-origine]')).toHaveCount(0);
    await expect(fenetreNote).toContainText(avecTotal.lignes[rangRubrique].libelle);

    expect(pannes).toEqual([]);
  });
}
