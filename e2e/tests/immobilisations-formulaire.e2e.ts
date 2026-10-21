import { expect, test, type Page } from '@playwright/test';
import { inflateRawSync } from 'node:zlib';
import { API, appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE IMMO-FORMULAIRE · le formulaire de la nouvelle immobilisation et le
 * classeur unique des tableaux, sur la base réelle, à travers une clôture.
 * Ce qui casserait en silence · la nature du barème effacée par le compte
 * qu'elle vient de poser, un compte proposé que personne ne peut choisir
 * faute d'être personnalisé, un classeur daté hors de son exercice (le bien
 * lu à une date que l'exercice ne couvre pas), une feuille perdue.
 */

interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Nature { cle: string; comptes?: string[] }
interface Compte { id: string; numero: string; estRetenu: boolean; estActif: boolean; subdivise?: boolean }

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);

/** Le classeur servi, en octets · le statut d'abord, un refus n'étant pas un fichier. */
async function telecharger(page: Page, chemin: string) {
  return page.evaluate(
    async ({ api, chemin }) => {
      const res = await fetch(api + chemin, { credentials: 'include' });
      const octets = Array.from(new Uint8Array(await res.arrayBuffer()));
      return { statut: res.status, octets };
    },
    { api: API, chemin },
  );
}

/** Les parties d'un ZIP lues par son répertoire central · e2e n'emporte pas ExcelJS. */
function partiesDuZip(octets: number[]): Map<string, string> {
  const zip = Buffer.from(octets);
  let fin = zip.length - 22;
  while (fin >= 0 && zip.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error('Pas un classeur · aucun répertoire central');
  const nombre = zip.readUInt16LE(fin + 10);
  let p = zip.readUInt32LE(fin + 16);
  const parties = new Map<string, string>();
  for (let i = 0; i < nombre; i++) {
    const methode = zip.readUInt16LE(p + 10);
    const taille = zip.readUInt32LE(p + 20);
    const lgNom = zip.readUInt16LE(p + 28);
    const lgExtra = zip.readUInt16LE(p + 30);
    const lgComm = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const nom = zip.subarray(p + 46, p + 46 + lgNom).toString('utf8');
    const debut = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const brut = zip.subarray(debut, debut + taille);
    parties.set(nom, (methode === 8 ? inflateRawSync(brut) : brut).toString('utf8'));
    p += 46 + lgNom + lgExtra + lgComm;
  }
  return parties;
}

test('SYSCOHADA · la nature personnalise son compte et le garde, le bien traverse la clôture, le classeur se date dans son exercice', async ({ page }) => {
  test.setTimeout(240_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Formulaire immo e2e', montant: 50_000_000 });
  await seConnecter(page, dossier.email);
  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const debut = jour(N.dateDebut);

  // Une nature à compte unique, dont le compte du plan n'est pas encore
  // personnalisé · c'est le cas que le bouton de la fiche sert.
  const bareme = await appelApi<Nature[]>(page, 'GET', '/immobilisations/bareme-fiscal');
  const plan = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL&usage=true');
  const libre = (numero: string) => plan.find((c) => c.numero === numero && !c.estRetenu && c.estActif && !c.subdivise);
  const nature = bareme.find((n) => n.comptes?.length === 1 && libre(n.comptes[0]) && n.comptes[0].startsWith('24'));
  if (!nature?.comptes) throw new Error('Aucune nature à compte unique non personnalisé au barème');
  const numero = nature.comptes[0];
  const compte = libre(numero)!;

  await page.goto('/#/immobilisations');
  await page.getByRole('button', { name: 'Nouvelle immobilisation', exact: true }).click();
  const choixNature = page.getByLabel('Nature du bien (barème fiscal)');
  await choixNature.selectOption(nature.cle);
  await expect(page.getByText(`Le compte que cette catégorie propose (${numero}) n'est pas encore personnalisé.`)).toBeVisible();
  await page.getByRole('button', { name: 'Le personnaliser et le choisir', exact: true }).click();
  // Le compte posé ne défait pas la nature qui l'a proposé.
  // La liste du compte du bien, seule à porter ce compte parmi ses options.
  const compteDuBien = page.locator('select', { has: page.locator(`option[value="${compte.id}"]`) });
  await expect(compteDuBien).toHaveValue(compte.id);
  await expect(compteDuBien.locator('option:checked')).toHaveText(new RegExp(`^${numero} · `));
  await expect(choixNature).toHaveValue(nature.cle);
  const relu = (await appelApi<Compte[]>(page, 'GET', `/comptes?typeCompte=DETAIL&usage=true&recherche=${numero}`)).find((c) => c.id === compte.id);
  expect(relu?.estRetenu).toBe(true);

  // Le bien de N, doté puis porté par la clôture.
  const contreparties = await appelApi<Array<{ id: string; mode: string | null }>>(
    page,
    'GET',
    `/immobilisations/contreparties-acquisition?compteImmobilisationId=${compte.id}`,
  );
  const tresorerie = contreparties.find((c) => c.mode === 'ACHAT_COMPTANT');
  const od = (await appelApi<Array<{ id: string; code: string }>>(page, 'GET', '/journaux')).find((j) => j.code === 'OD');
  if (!tresorerie || !od) throw new Error('Contrepartie au comptant ou journal OD absents');
  const bien = await appelApi<{ id: string }>(page, 'POST', '/immobilisations', {
    compteImmobilisationId: compte.id,
    designation: 'Bien du formulaire e2e',
    natureFiscaleCle: nature.cle,
    dateAcquisition: debut,
    dateMiseEnService: debut,
    valeurOrigine: 12_000_000,
    dureeAmortissementAns: 4,
    modeAmortissement: 'LINEAIRE',
    compteContrepartieId: tresorerie.id,
    journalId: od.id,
    exerciceId: N.id,
  });
  const dotation = await appelApi<{ montant: number }>(page, 'POST', `/immobilisations/${bien.id}/dotation`, { exerciceId: N.id, journalId: od.id });
  expect(Number(dotation.montant)).toBeGreaterThan(0);
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: N.id, dateLimite: jour(N.dateFin) });
  const debutSuivant = lendemain(N.dateFin);
  const N1 = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${debutSuivant.slice(0, 4)}-12-31` });
  await appelApi(page, 'POST', `/exercices/${N.id}/cloturer`);

  // Le classeur de N · une date d'arrêté hors de l'exercice, ou qui n'existe
  // pas, est refusée avant le premier octet.
  const horsExercice = await telecharger(page, `/exports/tableaux-immobilisations?exerciceId=${N.id}&dateArret=${debutSuivant}`);
  expect(horsExercice.statut).toBe(400);
  const inexistante = await telecharger(page, `/exports/tableaux-immobilisations?exerciceId=${N.id}&dateArret=${debut.slice(0, 4)}-02-30`);
  expect(inexistante.statut).toBe(400);

  for (const exerciceId of [N.id, N1.id]) {
    const servi = await telecharger(page, `/exports/tableaux-immobilisations?exerciceId=${exerciceId}`);
    expect(servi.statut).toBe(200);
    const parties = partiesDuZip(servi.octets);
    const feuilles = [...(parties.get('xl/workbook.xml') ?? '').matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]);
    expect(feuilles).toEqual(['Immobilisations', 'Amortissements', 'Réévaluations']);
    // Le bien de N est encore à l'actif de N+1 · la clôture ne l'a pas perdu.
    expect([...parties.values()].some((x) => x.includes('Bien du formulaire e2e'))).toBe(true);
  }

  expect(pannes).toEqual([]);
});
