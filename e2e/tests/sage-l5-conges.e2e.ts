import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE SAGE-L5, FONCTION 79 · LES CONGÉS ACQUIS CHAQUE MOIS, SUR VRAIE BASE.
 *
 * Un salarié entré le 1er juin 2025 · ses sept mois de 2025 sont REPRIS
 * (déclarés à l'écran avec leur source, aucun bulletin d'avant 2026 ne
 * s'émettant, faute de barème de l'impôt), et chaque mois de 2026 est payé
 * par un bulletin émis. L'année de services révolue au 31 mai 2026 fait
 * naître douze jours (art. 140, al. 3 ; art. 141), juin et juillet 2026 sont
 * en cours d'acquisition. Le congé du 3 au 15 août 2026 compte douze jours
 * ouvrables ; son allocation (art. 142) est rejouée au serveur à 12 × 40 000
 * FC, la rémunération mensuelle ramenée au jour par 26 et une moyenne des
 * douze mois DÉCLARÉE nulle (sept bulletins seulement, la moyenne ne se
 * propose pas), puis portée par le bulletin d'août, qui la verse en plus du
 * salaire. Le congé porté ne s'annule pas ; le bulletin annulé le libère.
 */
interface Periode { du: string; au: string; etat: string; moisAcquis: number; joursAcquis: number | null }
interface Compteur { periodes: Periode[]; droitsNes: number | null; pris: number; solde: number | null; enCours: number | null }
interface Conge {
  id: string;
  bulletin: { numero: number; statut: string } | null;
  annuleLe: string | null;
  allocation: { jours: number | null; montant: number | null; devise: string | null };
}
interface Reponse { compteur: Compteur | { refus: string }; conges: Conge[] }
interface Bulletin { id: string; numero: number; moisDePaie: string; statut: string; totalVerseFc: number }

const MOIS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];

test('SYSCOHADA · congés acquis par bulletin, posés à l’écran, portés au bulletin, libérés par son annulation', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Congés e2e SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });

  const salarie = await appelApi<{ id: string }>(page, 'POST', '/personnel/salaries', {
    nom: 'KABONGO',
    prenoms: 'Jean',
    sexe: 'MASCULIN',
    dateNaissance: '1990-04-12',
  });
  await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/contrats`, {
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: '2025-06-01',
    periodiciteRemuneration: 'MOIS',
    remunerationBase: 1_040_000,
    deviseRemuneration: 'CDF',
  });
  const paie = (moisDePaie: string, extra: Record<string, unknown> = {}) => ({
    moisDePaie,
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_040_000 }],
    natureEmployeurInpp: 'PRIVE',
    effectif: 12,
    ...extra,
  });
  for (const m of MOIS) await appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/bulletins`, paie(m));

  // À l'écran · l'onglet Congés, le compteur lu à la date, la reprise déclarée.
  await page.goto('/#/personnel?onglet=conges');
  await page.getByLabel('Date de lecture du compteur').fill('2026-08-02');
  await expect(page.getByText('Aucune reprise déclarée.')).toBeVisible();
  await page.getByRole('button', { name: 'Déclarer la reprise' }).click();
  const reprise = page.getByRole('dialog', { name: 'Déclarer la reprise des congés' });
  await reprise.getByLabel('Arrêtée au').fill('2025-12-31');
  await reprise.getByLabel('Jours nés et non pris').fill('0');
  await reprise.getByLabel('Mois accomplis de la période en cours').fill('7');
  await reprise.getByLabel('Source').fill('Registre des congés tenu sur papier');
  await reprise.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(reprise).toBeHidden();
  await expect(page.getByText(/Arrêtée au 31\/12\/2025/)).toBeVisible();

  // Le compteur à la veille du départ · douze jours nés, deux mois en cours.
  const lire = (aLa?: string) => appelApi<Reponse>(page, 'GET', `/personnel/salaries/${salarie.id}/conges${aLa ? `?ala=${aLa}` : ''}`);
  const veille = await lire('2026-08-02');
  const c0 = veille.compteur as Compteur;
  expect([c0.droitsNes, c0.pris, c0.solde, c0.enCours]).toEqual([12, 0, 12, 2]);
  expect(c0.periodes.map((p) => [p.du, p.au, p.etat, p.moisAcquis, p.joursAcquis])).toEqual([
    ['2025-06-01', '2026-05-31', 'NEE', 12, 12],
    ['2026-06-01', '2027-05-31', 'EN_COURS', 2, 2],
  ]);

  // Au-delà des droits nés, le congé ne passe que dit.
  await expect(
    appelApi(page, 'POST', `/personnel/salaries/${salarie.id}/conges`, { du: '2026-09-01', au: '2026-09-30', moisDePaie: '2026-09' }),
  ).rejects.toThrow(/Au-delà du solde/);

  // Le congé posé à l'écran.
  const fenetre = page.locator('.ecran-seul').filter({ hasText: 'Périodes de services' }).first();
  await expect(fenetre.getByText('Droits nés')).toBeVisible();
  await expect(fenetre.getByText('12 j').first()).toBeVisible();

  await page.getByRole('button', { name: 'Poser un congé' }).click();
  const modale = page.getByRole('dialog', { name: 'Poser un congé' });
  await expect(modale).toBeVisible();
  // Échap ferme la modale, et elle seule.
  await page.keyboard.press('Escape');
  await expect(modale).toBeHidden();
  await page.getByRole('button', { name: 'Poser un congé' }).click();
  await modale.getByLabel('Premier jour').fill('2026-08-03');
  await modale.getByLabel('Dernier jour').fill('2026-08-15');
  await expect(modale.getByText(/Rémunération journalière proposée · 40\s000,00 CDF/)).toBeVisible();
  await expect(modale.getByText(/7 bulletin\(s\) émis sur les douze mois/)).toBeVisible();
  await modale.getByRole('button', { name: 'Reprendre les propositions' }).click();
  await expect(modale.getByLabel('Rémunération journalière')).toHaveValue('40000');
  await expect(modale.getByLabel('Moyenne mensuelle des douze mois')).toHaveValue('');
  await modale.getByLabel('Moyenne mensuelle des douze mois').fill('0');
  await modale.getByRole('button', { name: 'Poser le congé' }).click();
  await expect(modale).toBeHidden();
  await expect(page.getByText('À porter au bulletin de 2026-08')).toBeVisible();
  await expect(page.getByText(/480\s000,00 CDF/)).toBeVisible();

  // Ni page plus large que l'écran à 390 px.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Le bulletin d'août porte l'allocation rejouée · 1 040 000 + 480 000.
  const [conge] = (await lire()).conges;
  expect(conge.allocation).toMatchObject({ jours: 12, montant: 480_000, devise: 'CDF' });
  const aout = await appelApi<Bulletin>(page, 'POST', `/personnel/salaries/${salarie.id}/bulletins`, paie('2026-08', { allocationsConge: [{ congeId: conge.id }] }));
  const { bulletins } = await appelApi<{ bulletins: Bulletin[] }>(page, 'GET', '/personnel/bulletins?mois=2026-08');
  expect(bulletins.find((b) => b.id === aout.id)?.totalVerseFc).toBe(1_520_000);
  const apres = await lire();
  const c1 = apres.compteur as Compteur;
  expect([c1.droitsNes, c1.pris, c1.solde]).toEqual([12, 12, 0]);
  expect(apres.conges[0].bulletin).toMatchObject({ numero: aout.numero, statut: 'EMIS' });

  // Porté, le congé ne s'annule pas et ne se paie pas une seconde fois.
  await expect(appelApi(page, 'POST', `/personnel/conges/${conge.id}/annulation`, { motif: 'Erreur de dates' })).rejects.toThrow(/annulez d'abord le bulletin/);
  await expect(
    appelApi(page, 'POST', '/personnel/simulation?salarieId=' + salarie.id, paie('2026-08', { allocationsConge: [{ congeId: conge.id }] })),
  ).rejects.toThrow(/déjà portée par le bulletin/);

  // Le bulletin annulé libère le congé, qui s'annule à son tour avec son motif.
  await appelApi(page, 'POST', `/personnel/bulletins/${aout.id}/annulation`, { motif: 'Dates du congé erronées' });
  await appelApi(page, 'POST', `/personnel/conges/${conge.id}/annulation`, { motif: 'Dates du congé erronées' });
  const fin = await lire();
  const c2 = fin.compteur as Compteur;
  expect([c2.pris, c2.solde]).toEqual([0, 12]);
  await page.reload();
  await expect(page.getByText('Annulé', { exact: true })).toBeVisible();

  expect(pannes).toEqual([]);
});
