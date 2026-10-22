import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * CONDITIONS BANCAIRES, AUTORISATIONS, UNIONS (ligne sage-l3, n° 46 ·
 * décision D15), sur le serveur réel et une vraie base, à travers une
 * clôture. Un RIB rattaché au journal de banque porte deux versions de
 * conditions et un découvert autorisé de 500 000 ; le compte finit N
 * créditeur · le découvert utilisé se lit sur ce solde, le dépassement se
 * dit, le hors-bilan se propose au 9011 / 9111. N+1 ouvert avant la clôture,
 * la situation de janvier remonte N ; N clôturé, elle se lit sur
 * l'à-nouveau · le même montant. Une union d'une même monnaie se crée, une
 * union mêlant deux monnaies est refusée, et le RIB qui porte ses
 * déclarations ne se retire pas.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string }
interface Journal { id: string; code: string; type: string; compteTresorerie?: { id: string; numero?: string } | null }
interface Situation { utilise: number | null; nonUtilise: number | null; depassement: number | null }
interface Lecture {
  ribs: Array<{
    id: string;
    abrege: string;
    conditions: Array<{ id: string; dateEffet: string; enVigueur: boolean }>;
    autorisations: Array<{ id: string; situation: Situation | null; motifSituation: string | null; horsBilan: { debit: string; credit: string } | null }>;
  }>;
  unions: Array<{ code: string; position: { total: number | null; nonLus: string[] } }>;
}

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(`${jour(iso)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

async function refusDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'accepté';
  } catch (e) {
    return String((e as Error).message);
  }
}

test('conditions bancaires · découvert utilisé lu sur le solde, à travers une clôture ; unions ; RIB retenu', async ({ page }) => {
  test.setTimeout(180_000);
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Conditions e2e SARL', montant: 1_000_000 });
  await seConnecter(page, dossier.email);
  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = N.dateDebut.slice(0, 4);
  const suivante = String(Number(annee) + 1);

  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const journalBanque = journaux.find((j) => j.type === 'TRESORERIE' && comptes.some((c) => c.id === j.compteTresorerie?.id && c.numero.startsWith('52')))!;
  const compteBanque = comptes.find((c) => c.id === journalBanque.compteTresorerie!.id)!;
  const recetteDuDossier = comptes.find((c) => c.numero.startsWith('52'))!.id === compteBanque.id ? 1_000_000 : 0;
  const charge = comptes.find((c) => c.numero.startsWith('60'))!;

  // (1) Une sortie de 1 800 000 au dernier jour de N · le compte finit créditeur.
  const sortie = 1_800_000;
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: N.id,
    journalId: od.id,
    date: jour(N.dateFin),
    libelle: 'Achat payé par la banque',
    lignes: [
      { compteId: charge.id, libelle: 'Achat payé par la banque', debit: sortie, credit: 0 },
      { compteId: compteBanque.id, libelle: 'Achat payé par la banque', debit: 0, credit: sortie },
    ],
  });
  const utilise = sortie - recetteDuDossier;

  // (2) La banque, deux RIB en francs (l'un sur le journal), un en dollars.
  const banque = await appelApi<{ id: string }>(page, 'POST', '/banques', { intitule: 'Rawbank e2e' });
  const rib = await appelApi<{ id: string }>(page, 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW-CDF', journalId: journalBanque.id });
  const rib2 = await appelApi<{ id: string }>(page, 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW-CDF2' });
  const ribUsd = await appelApi<{ id: string }>(page, 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW-USD', devise: 'USD' });

  // (3) Deux versions de conditions · la seconde en vigueur au dernier jour de N.
  const conditions = { referenceConvention: 'CONV-RAW-1', dateConvention: jour(N.dateDebut), typePalier: 'SEUIL', paliers: [{ plafond: 500_000, taux: 14 }], baseCalcul: 360 };
  await appelApi(page, 'POST', `/conditions-bancaires/ribs/${rib.id}/conditions`, { ...conditions, dateEffet: jour(N.dateDebut) });
  await appelApi(page, 'POST', `/conditions-bancaires/ribs/${rib.id}/conditions`, { ...conditions, dateEffet: `${annee}-07-01`, fraisTenueCompte: 15_000, periodiciteFrais: 'MENSUELLE' });
  expect(await refusDe(appelApi(page, 'POST', `/conditions-bancaires/ribs/${rib.id}/conditions`, { ...conditions, dateEffet: `${annee}-07-01` }))).toMatch(/409|déjà des conditions/);
  expect(await refusDe(appelApi(page, 'POST', `/conditions-bancaires/ribs/${rib.id}/conditions`, { ...conditions, dateEffet: `${annee}-08-01`, referenceConvention: '' }))).toMatch(/400|convention/);

  // (4) Un découvert autorisé de 500 000, irrévocable, sur N et N+1.
  await appelApi(page, 'POST', `/conditions-bancaires/ribs/${rib.id}/autorisations`, {
    nature: 'DECOUVERT',
    montant: 500_000,
    dateDebut: jour(N.dateDebut),
    dateFin: `${suivante}-12-31`,
    irrevocable: true,
    referenceConvention: 'AUT-RAW-1',
    dateConvention: jour(N.dateDebut),
  });

  const situation = async (au: string) => {
    const l = await appelApi<Lecture>(page, 'GET', `/conditions-bancaires?au=${au}`);
    return l.ribs.find((r) => r.id === rib.id)!;
  };
  const attendue = { utilise, nonUtilise: Math.max(0, 500_000 - utilise), depassement: Math.max(0, utilise - 500_000) };
  const finN = await situation(jour(N.dateFin));
  expect(finN.conditions.map((c) => [jour(c.dateEffet), c.enVigueur])).toEqual([
    [jour(N.dateDebut), false],
    [`${annee}-07-01`, true],
  ]);
  expect(finN.autorisations[0].situation).toEqual(attendue);
  expect(finN.autorisations[0].horsBilan).toEqual({ debit: '90110000', credit: '91110000', fondement: expect.any(String) });

  // (5) N+1 ouvert AVANT la clôture de N · la situation de janvier remonte N.
  await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: lendemain(N.dateFin), dateFin: `${suivante}-12-31` });
  expect((await situation(`${suivante}-01-10`)).autorisations[0].situation).toEqual(attendue);

  // (6) N clôturé · l'à-nouveau porte le compte, la situation de janvier est la même.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: N.id, dateLimite: jour(N.dateFin) });
  await appelApi(page, 'POST', `/exercices/${N.id}/cloturer`);
  expect((await situation(`${suivante}-01-10`)).autorisations[0].situation).toEqual(attendue);

  // (7) Unions · une même monnaie se crée, sa position dit le compte non lu ; deux monnaies refusées.
  expect(await refusDe(appelApi(page, 'POST', '/conditions-bancaires/unions', { code: 'MIX', intitule: 'Mélange', ribIds: [rib.id, ribUsd.id] }))).toMatch(/400|même monnaie/);
  await appelApi(page, 'POST', '/conditions-bancaires/unions', { code: 'raw', intitule: 'Rawbank francs', ribIds: [rib.id, rib2.id], fusionEchelles: true });
  const lecture = await appelApi<Lecture>(page, 'GET', `/conditions-bancaires?au=${suivante}-01-10`);
  expect(lecture.unions.map((u) => [u.code, u.position])).toEqual([['RAW', { total: null, nonLus: ['RAW-CDF2'] }]]);

  // (8) Le RIB qui porte ses déclarations ne se retire pas, ni sa banque.
  expect(await refusDe(appelApi(page, 'DELETE', `/ribs-banque/${rib.id}`))).toMatch(/409|retirez-les/);
  expect(await refusDe(appelApi(page, 'DELETE', `/banques/${banque.id}`))).toMatch(/409|ne se supprime pas/);

  // (9) La fenêtre · les conditions, la version en vigueur, le dépassement, l'union.
  await page.goto(`/#/conditions-bancaires`);
  await expect(page.getByRole('table', { name: 'Conditions du RIB RAW-CDF' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Autorisations du RIB RAW-CDF' })).toContainText('Découvert autorisé · irrévocable');
  await expect(page.getByRole('table', { name: 'Unions' })).toContainText('Rawbank francs');
  expect(pannes).toEqual([]);
});
