import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE A7 BIS, PARTIE 2, SUR LA BASE RÉELLE ET À TRAVERS UNE CLÔTURE · la
 * récupération de la TVA d'une créance irrécouvrable (O.-L. n° 10/001, art.
 * 52 ; décret n° 011/42, art. 126 et 127). Une vente de marchandises de
 * 1 160 000 TTC (160 000 de TVA) en N, reclassée, recouvrée de 580 000, la
 * perte de 580 000 constatée en décembre ; N clôturé. En N+1, la récupération
 * rend 580 000 × 160 000 / 1 160 000 = 80 000 (HT 500 000), D 4431 / C 6511 ;
 * annulée validée, son négatif est lu ; refaite, elle est constatée en
 * janvier et inscrite en déduction de février. Une prestation (taxe à
 * l'encaissement) ne rend rien. Rejoué avant intégration par l'API du serveur
 * compilé, gelé ici.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Ligne { id: string; debit: number; credit: number }
interface Proposition {
  ouverte: boolean;
  motif: string | null;
  factures: Array<{ designationId: string; impayeTtc: number; impayeHt: number; tvaRecuperable: number; mention: string }>;
}

test('SYSCOHADA · la TVA acquittée d’une créance irrécouvrable se récupère en N+1, déduite le mois qui suit, et son annulation se lit', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'TVA art. 52 e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/regime', { assujettiTva: true });
  const [ex] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const a = Number(ex.dateDebut.slice(0, 4));
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const detail = (r: string) => comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith(r))!;
  const journaux = await appelApi<Array<{ id: string; type: string; compteTresorerieId: string | null }>>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const bq = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerieId)!;
  const taux = (await appelApi<Array<{ id: string; taux: number }>>(page, 'GET', '/taux-tva')).find((t) => Number(t.taux) === 16)!;
  const nouveau = (numero: string) =>
    appelApi<Compte>(page, 'POST', '/comptes', { numero, intitule: `Client ${numero}`, typeCompte: 'DETAIL', lettrable: true, modeReportANouveau: 'DETAIL' });
  const [k1, k2] = [await nouveau('41110101'), await nouveau('41110102')];
  const ecrire = (e: Exercice, date: string, libelle: string, lignes: unknown[]) =>
    appelApi(page, 'POST', '/ecritures', { exerciceId: e.id, journalId: od.id, date, libelle, lignes });
  const valider = (e: Exercice) => appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: e.id, dateLimite: e.dateFin.slice(0, 10) });
  await ecrire(ex, `${a}-02-10`, 'Vente k1', [
    { compteId: k1.id, debit: 1_160_000, credit: 0 },
    { compteId: detail('701').id, debit: 0, credit: 1_000_000 },
    { compteId: detail('4431').id, debit: 0, credit: 160_000, tauxTvaId: taux.id },
  ]);
  await ecrire(ex, `${a}-03-05`, 'Prestation k2', [
    { compteId: k2.id, debit: 580_000, credit: 0 },
    { compteId: detail('706').id, debit: 0, credit: 500_000 },
    { compteId: detail('4432').id, debit: 0, credit: 80_000, tauxTvaId: taux.id },
  ]);
  await valider(ex);
  await appelApi(page, 'POST', '/taux-tva/declaration/comptabiliser', { exerciceId: ex.id, dateDebut: `${a}-02-01`, dateFin: `${a}-02-28` });
  await valider(ex);
  const ligne = async (k: Compte, debit: number) => (await appelApi<{ lignes: Ligne[] }>(page, 'GET', `/comptes/${k.id}/lettrage`)).lignes.find((l) => l.debit === debit)!;
  const pieces = [{ nature: 'Mise en demeure', reference: 'MD-1' }];
  const preuve = [{ nature: 'Jugement de clôture pour insuffisance d’actif', reference: 'TC-118' }];
  const reclasser = async (k: Compte, montant: number) =>
    appelApi<{ id: string }>(page, 'POST', '/creances-douteuses', {
      exerciceId: ex.id, journalId: od.id, date: `${a}-04-30`, compteCreanceId: k.id, nature: 'DOUTEUSE', montant, motif: 'Client défaillant', pieces,
      factures: [{ ligneEcritureId: (await ligne(k, montant)).id, montant }],
    });
  const cr1 = await reclasser(k1, 1_160_000);
  const cr2 = await reclasser(k2, 580_000);
  await appelApi(page, 'POST', `/creances-douteuses/${cr1.id}/recouvrement`, { exerciceId: ex.id, journalId: bq.id, date: `${a}-05-10`, montant: 580_000, motif: 'Versement', pieces });
  for (const cr of [cr1, cr2]) {
    await appelApi(page, 'POST', `/creances-douteuses/${cr.id}/perte`, { exerciceId: ex.id, journalId: od.id, date: `${a}-12-20`, montant: 580_000, motif: 'Liquidation du client', pieces: preuve });
  }
  await valider(ex);
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: `${a + 1}-01-01`, dateFin: `${a + 1}-12-31` });
  await appelApi(page, 'POST', `/exercices/${ex.id}/cloturer`);

  const p1 = await appelApi<Proposition>(page, 'GET', `/creances-douteuses/${cr1.id}/recuperation-tva`);
  expect(p1.ouverte).toBe(true);
  expect(p1.factures[0]).toMatchObject({ impayeTtc: 580_000, impayeHt: 500_000, tvaRecuperable: 80_000 });
  expect(p1.factures[0].mention).toContain('FACTURE DEMEUREE IMPAYEE POUR LA SOMME DE');
  const p2 = await appelApi<Proposition>(page, 'GET', `/creances-douteuses/${cr2.id}/recuperation-tva`);
  expect(p2.motif).toContain('Aucune taxe acquittée');
  const recuperer = (date: string) =>
    appelApi<{ id: string; montantTva: number }>(page, 'POST', `/creances-douteuses/${cr1.id}/recuperation-tva`, {
      exerciceId: suivant.id, journalId: od.id, date, motif: 'Créance définitivement irrécouvrable', pieces: preuve,
      duplicatas: [{ designationId: p1.factures[0].designationId, reference: 'DUP-001', dateEnvoi: `${a + 1}-01-10` }],
    });
  const annuler = (id: string) => appelApi<{ annulation: { traitement: string } }>(page, 'POST', `/creances-douteuses/${cr1.id}/recuperations-tva/${id}/annuler`, { motif: 'Duplicata à refaire' });
  const premiere = await recuperer(`${a + 1}-01-15`);
  expect(premiere.montantTva).toBe(80_000);
  await valider(suivant);
  expect((await annuler(premiere.id)).annulation.traitement).toBe('INSCRITE_EN_NEGATIF');
  const declaration = (m: string, fin: string) =>
    appelApi<{ avoirsCollecteConstates: number; recuperationArt52: number; totalCollecte: number }>(page, 'GET', `/taux-tva/declaration?dateDebut=${a + 1}-${m}-01&dateFin=${a + 1}-${m}-${fin}`);
  expect((await declaration('01', '31')).avoirsCollecteConstates).toBe(0);
  await recuperer(`${a + 1}-01-20`);
  await ecrire(suivant, `${a + 1}-01-25`, 'Vente comptant', [
    { compteId: bq.compteTresorerieId!, debit: 116_000, credit: 0 },
    { compteId: detail('701').id, debit: 0, credit: 100_000 },
    { compteId: detail('4431').id, debit: 0, credit: 16_000, tauxTvaId: taux.id },
  ]);
  await valider(suivant);
  const janvier = await declaration('01', '31');
  expect(janvier).toMatchObject({ totalCollecte: 16_000, avoirsCollecteConstates: 80_000, recuperationArt52: 0 });
  await appelApi(page, 'POST', '/taux-tva/declaration/comptabiliser', { exerciceId: suivant.id, dateDebut: `${a + 1}-01-01`, dateFin: `${a + 1}-01-31` });
  await valider(suivant);
  expect((await declaration('02', '28')).recuperationArt52).toBe(80_000);
  await appelApi(page, 'POST', '/taux-tva/declaration/comptabiliser', { exerciceId: suivant.id, dateDebut: `${a + 1}-02-01`, dateFin: `${a + 1}-02-28` });
  await valider(suivant);
  const { lignes: balance } = await appelApi<{ lignes: Array<{ numero: string; solde: number }> }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`);
  const solde = (n: string) => balance.find((l) => l.numero === n)?.solde ?? 0;
  expect(solde(detail('4431').numero)).toBe(0);
  expect(solde(detail('6511').numero)).toBe(-80_000);
  expect(solde('44490000')).toBe(80_000);
  expect(pannes).toEqual([]);
});
