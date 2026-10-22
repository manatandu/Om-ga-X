import { expect, test, type Page } from '@playwright/test';
import { inflateRawSync } from 'node:zlib';
import { API, appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * EXTRAITS BANCAIRES (ligne sage-l3, n° 45 · Sage 100 Moyens de paiement,
 * « imprimer successivement plusieurs extraits de compte à partir de la liste
 * des comptes bancaires »), sur le serveur réel et une vraie base, à travers
 * une clôture. Un relevé importé en N dans un rapprochement, une ligne
 * rapprochée à une écriture de banque, l'exercice clôturé, un second relevé
 * importé en N+1 · la liste par compte rend les deux extraits du plus ancien
 * au plus récent avec leurs nombres, l'édition chaînée sert un classeur à une
 * feuille par extrait dans cet ordre, les bornes écartent un extrait, et les
 * refus sont nommés (compte d'un autre dossier, bornes illisibles).
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string; compteTresorerie?: { id: string } | null }
interface TeteExtrait {
  rapprochementId: string;
  compteId: string;
  compteNumero: string;
  dateReleve: string;
  soldeReleve: number;
  soldeDepart: number | null;
  mouvementsNet: number;
  ecartReleve: number | null;
  nombreLignes: number;
  nombreRapprochees: number;
  statut: string;
  releveImporteLe: string | null;
  releveNomFichier: string | null;
}

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);
const refusDe = (p: Promise<unknown>) => p.then(() => 'accepté', (e: unknown) => String(e));

/** Le classeur servi, en octets · le statut d'abord, un refus n'étant pas un fichier. */
async function telecharger(page: Page, chemin: string) {
  return page.evaluate(
    async ({ api, chemin }) => {
      const res = await fetch(api + chemin, { credentials: 'include' });
      const octets = Array.from(new Uint8Array(await res.arrayBuffer()));
      return { statut: res.status, octets, type: res.headers.get('content-type') ?? '' };
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

const feuillesDe = (parties: Map<string, string>) => [...(parties.get('xl/workbook.xml') ?? '').matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]);

test('extraits bancaires · relevé importé en N et rapproché, clôture traversée, second relevé en N+1, liste par compte et édition chaînée', async ({ page }) => {
  test.setTimeout(180_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Extraits e2e SARL', montant: 5_000_000 });
  await seConnecter(page, dossier.email);
  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = N.dateDebut.slice(0, 4);

  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  // Le compte de banque que le dossier d'essai a semé (recette au milieu de N).
  const banque = comptes.find((c) => c.numero.startsWith('52'))!;
  const charge = comptes.find((c) => c.numero.startsWith('60'))!;
  const produit = comptes.find((c) => c.numero.startsWith('7'))!;

  // (1) Deux opérations de banque en mars N, validées, que le relevé de mars porte.
  const passer = (date: string, libelle: string, debitBanque: number, creditBanque: number, contrepartie: Compte) =>
    appelApi<{ id: string; lignes: Array<{ id: string; compteId: string }> }>(page, 'POST', '/ecritures', {
      exerciceId: N.id,
      journalId: od.id,
      date,
      libelle,
      lignes: [
        { compteId: banque.id, libelle, debit: debitBanque, credit: creditBanque },
        { compteId: contrepartie.id, libelle, debit: creditBanque, credit: debitBanque },
      ],
    });
  const frais = await passer(`${annee}-03-10`, 'Frais de tenue de compte', 0, 150_000, charge);
  const virement = await passer(`${annee}-03-20`, 'Virement reçu', 300_000, 0, produit);
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: N.id, dateLimite: jour(N.dateFin) });
  const ligneFrais = frais.lignes.find((l) => l.compteId === banque.id)!;
  const ligneVirement = virement.lignes.find((l) => l.compteId === banque.id)!;

  // (2) Premier rapprochement, au 31 mars · départ déclaré à zéro au premier
  // jour (rien au livre avant), relevé importé (sens de la banque · débit =
  // sortie), les deux lignes rapprochées, puis clos · l'écart est nul.
  const r1 = await appelApi<{ id: string }>(page, 'POST', '/rapprochements', { compteId: banque.id, dateReleve: `${annee}-03-31`, soldeReleve: 150_000 });
  await appelApi(page, 'PATCH', `/rapprochements/${r1.id}/depart`, { soldeDepart: 0, dateDepart: jour(N.dateDebut) });
  const csv1 = `Date;Libellé;Référence;Débit;Crédit\n${annee}-03-10;FRAIS TENUE DE COMPTE;FR-03;150000;0\n${annee}-03-20;VIREMENT RECU CLIENT;VIR-77;0;300000\n`;
  await appelApi(page, 'POST', `/rapprochements/${r1.id}/releve`, { nomFichier: 'releve-mars.csv', contenuBase64: Buffer.from(csv1, 'utf8').toString('base64') });
  const detail1 = await appelApi<{ releve: Array<{ id: string; libelle: string }> }>(page, 'GET', `/rapprochements/${r1.id}`);
  const releveFrais = detail1.releve.find((l) => l.libelle.startsWith('FRAIS'))!;
  const releveVirement = detail1.releve.find((l) => l.libelle.startsWith('VIREMENT'))!;
  await appelApi(page, 'POST', `/rapprochements/${r1.id}/correspondances`, {
    correspondances: [
      { ligneReleveId: releveFrais.id, ligneEcritureIds: [ligneFrais.id] },
      { ligneReleveId: releveVirement.id, ligneEcritureIds: [ligneVirement.id] },
    ],
  });
  await appelApi(page, 'POST', `/rapprochements/${r1.id}/cloturer`);

  // (3) La liste de N · un extrait clos, deux lignes rapprochées, l'import daté et nommé.
  let liste = await appelApi<{ extraits: TeteExtrait[]; total: number; tronque: boolean }>(page, 'GET', `/rapprochements/extraits?compteId=${banque.id}`);
  expect([liste.total, liste.tronque]).toEqual([1, false]);
  expect(liste.extraits.map((e) => [e.rapprochementId, e.nombreLignes, e.nombreRapprochees, e.soldeDepart, e.mouvementsNet, e.ecartReleve, e.statut, e.releveNomFichier])).toEqual([
    [r1.id, 2, 2, 0, 150_000, 0, 'CLOTURE', 'releve-mars.csv'],
  ]);
  expect(liste.extraits[0].releveImporteLe).not.toBeNull();

  // (4) Clôture de N, puis un relevé importé en N+1 sur le même compte · son
  // solde de départ est ANCRÉ sur le solde imprimé du rapprochement clos.
  const N1 = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: lendemain(N.dateFin), dateFin: `${Number(annee) + 1}-12-31` });
  await appelApi(page, 'POST', `/exercices/${N.id}/cloturer`);
  const r2 = await appelApi<{ id: string }>(page, 'POST', '/rapprochements', { compteId: banque.id, dateReleve: `${Number(annee) + 1}-01-31`, soldeReleve: 200_000 });
  const csv2 = `Date;Libellé;Débit;Crédit\n${Number(annee) + 1}-01-15;DEPOT ESPECES;0;50000\n`;
  await appelApi(page, 'POST', `/rapprochements/${r2.id}/releve`, { nomFichier: 'releve-janvier.csv', contenuBase64: Buffer.from(csv2, 'utf8').toString('base64') });

  liste = await appelApi(page, 'GET', `/rapprochements/extraits`);
  expect(liste.extraits.map((e) => [e.rapprochementId, jour(e.dateReleve), e.nombreLignes, e.soldeDepart, e.mouvementsNet, e.ecartReleve])).toEqual([
    [r1.id, `${annee}-03-31`, 2, 0, 150_000, 0],
    [r2.id, `${Number(annee) + 1}-01-31`, 1, 150_000, 50_000, 0],
  ]);
  expect(N1.id).toBeTruthy();

  // (5) L'édition chaînée · un classeur, le sommaire puis une feuille par extrait, du plus ancien au plus récent.
  const servi = await telecharger(page, `/rapprochements/extraits/edition?compteIds=${banque.id}`);
  expect(servi.statut).toBe(200);
  expect(servi.type).toContain('spreadsheetml');
  const parties = partiesDuZip(servi.octets);
  expect(feuillesDe(parties)).toEqual(['Sommaire', `${banque.numero} ${annee}-03-31`, `${banque.numero} ${Number(annee) + 1}-01-31`]);
  const feuilleMars = parties.get('xl/worksheets/sheet2.xml') ?? '';
  expect(feuilleMars).toContain('FRAIS TENUE DE COMPTE');
  expect(feuilleMars).toContain('Solde du relevé (imprimé par la banque)');
  expect(feuilleMars).toContain('releve-mars.csv');
  expect(feuilleMars).toContain('2 ligne(s) rapprochée(s) sur 2');

  // (6) Les bornes sur la date du relevé écartent mars · une seule feuille d'extrait.
  const borne = await telecharger(page, `/rapprochements/extraits/edition?du=${Number(annee) + 1}-01-01`);
  expect(borne.statut).toBe(200);
  expect(feuillesDe(partiesDuZip(borne.octets))).toEqual(['Sommaire', `${banque.numero} ${Number(annee) + 1}-01-31`]);

  // (7) Refus nommés · bornes illisibles (400), compte inconnu du dossier (404), sélection vide (400).
  expect((await telecharger(page, `/rapprochements/extraits/edition?du=${annee}-12-31&au=${annee}-01-01`)).statut).toBe(400);
  expect((await telecharger(page, `/rapprochements/extraits/edition?compteIds=00000000-0000-4000-8000-000000000000`)).statut).toBe(404);
  expect((await telecharger(page, `/rapprochements/extraits/edition?au=${Number(annee) - 1}-01-01`)).statut).toBe(400);
  expect(await refusDe(appelApi(page, 'GET', `/rapprochements/extraits?compteId=00000000-0000-4000-8000-000000000000`))).toMatch(/404|introuvable/i);

  // (8) La fenêtre · la liste par compte, les deux extraits, le bouton d'édition actif.
  await page.goto(`/#/extraits-bancaires`);
  const fenetre = page.getByRole('button', { name: 'Éditer tous les extraits' });
  await expect(fenetre).toBeEnabled();
  await expect(page.getByText(`${banque.numero} ·`)).toBeVisible();
  await expect(page.getByText('releve-janvier.csv', { exact: false })).toBeVisible();
  expect(pannes).toEqual([]);
});
