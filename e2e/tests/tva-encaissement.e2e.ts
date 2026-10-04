import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LIGNE A7 BIS, PARTIE 1, SUR LA BASE RÉELLE ET À TRAVERS UNE CLÔTURE ·
 * O.-L. n° 10/001, art. 25, 2° (« au moment de l'encaissement du prix, des
 * acomptes ou avances ») et décret n° 011/42, art. 57 (chaque perception).
 * Une prestation de 1 000 000 HT à 16 % facturée en janvier, réglée 40 % en
 * mars et 60 % en mai · 64 000 en mars, 96 000 en mai, rien en janvier. Une
 * prestation de décembre N réglée en février N+1, lettrée avec sa ligne
 * d'à-nouveau · rien en décembre, 160 000 en février N+1. Rejoué avant
 * intégration par l'API du serveur compilé (AVANCEMENT-A7bis.md), gelé ici.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Ligne { id: string; libelle: string | null; debit: number; credit: number; lettrageId: string | null }
interface Declaration { totalCollecte: number; tvaEnAttenteEncaissement: number }

test('SYSCOHADA · la TVA d’une prestation est exigible à chaque encaissement, jamais à la facture impayée', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'TVA à l’encaissement e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/regime', { assujettiTva: true });
  const [ex] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = Number(ex.dateDebut.slice(0, 4));
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const detail = (racine: string) => comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith(racine))!;
  const journaux = await appelApi<Array<{ id: string; type: string }>>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
  const taux = (await appelApi<Array<{ id: string; taux: number }>>(page, 'GET', '/taux-tva')).find((t) => Number(t.taux) === 16)!;
  const [c706, c4432, banque] = [detail('706'), detail('4432'), detail('521')];
  const client = await appelApi<Compte>(page, 'POST', '/comptes', {
    numero: '41110101',
    intitule: 'Client Kasa',
    typeCompte: 'DETAIL',
    lettrable: true,
    modeReportANouveau: 'DETAIL',
  });
  const ecrire = (exerciceId: string, date: string, libelle: string, lignes: unknown[]) =>
    appelApi(page, 'POST', '/ecritures', { exerciceId, journalId: od.id, date, libelle, lignes });
  const prestation = (exerciceId: string, date: string, libelle: string) =>
    ecrire(exerciceId, date, libelle, [
      { compteId: client.id, debit: 1_160_000, credit: 0 },
      { compteId: c706.id, debit: 0, credit: 1_000_000 },
      { compteId: c4432.id, debit: 0, credit: 160_000, tauxTvaId: taux.id },
    ]);
  const reglement = (exerciceId: string, date: string, montant: number) =>
    ecrire(exerciceId, date, `Règlement ${montant}`, [
      { compteId: banque.id, debit: montant, credit: 0 },
      { compteId: client.id, debit: 0, credit: montant },
    ]);
  const valider = (e: Exercice) => appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: e.id, dateLimite: e.dateFin.slice(0, 10) });
  const fin = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const debut = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`;
  const declaration = (a: number, m: number) =>
    appelApi<Declaration>(page, 'GET', `/taux-tva/declaration?dateDebut=${debut(a, m)}&dateFin=${fin(a, m)}`);
  const liquider = (e: Exercice, a: number, m: number) =>
    appelApi(page, 'POST', '/taux-tva/declaration/comptabiliser', { exerciceId: e.id, dateDebut: debut(a, m), dateFin: fin(a, m) });
  const lignes = async () => (await appelApi<{ lignes: Ligne[] }>(page, 'GET', `/comptes/${client.id}/lettrage`)).lignes;

  await prestation(ex.id, `${annee}-01-15`, 'F1 prestation de janvier');
  await reglement(ex.id, `${annee}-03-12`, 464_000);
  await valider(ex);
  expect(await declaration(annee, 1)).toMatchObject({ totalCollecte: 0, tvaEnAttenteEncaissement: 160_000 });
  let ls = await lignes();
  const f1 = ls.find((l) => l.debit === 1_160_000)!;
  await appelApi(page, 'POST', `/comptes/${client.id}/lettrage`, { ligneIds: [f1.id, ls.find((l) => l.credit === 464_000)!.id], autoriserPartiel: true });
  expect((await declaration(annee, 3)).totalCollecte).toBe(64_000);
  await liquider(ex, annee, 3);
  await reglement(ex.id, `${annee}-05-20`, 696_000);
  await valider(ex);
  ls = await lignes();
  const groupe = ls.find((l) => l.id === f1.id)!.lettrageId!;
  await appelApi(page, 'POST', `/comptes/${client.id}/lettrage/${groupe}/completer`, { ligneIds: [ls.find((l) => l.credit === 696_000)!.id] });
  expect((await declaration(annee, 5)).totalCollecte).toBe(96_000);
  // Mars garde ce qu'il a liquidé.
  expect((await declaration(annee, 3)).totalCollecte).toBe(64_000);
  await liquider(ex, annee, 5);

  await prestation(ex.id, `${annee}-12-10`, 'F2 prestation de décembre');
  await valider(ex);
  expect(await declaration(annee, 12)).toMatchObject({ totalCollecte: 0, tvaEnAttenteEncaissement: 160_000 });
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: `${annee + 1}-01-01`, dateFin: `${annee + 1}-12-31` });
  await valider(ex);
  await appelApi(page, 'POST', `/exercices/${ex.id}/cloturer`);

  await reglement(suivant.id, `${annee + 1}-02-15`, 1_160_000);
  await valider(suivant);
  ls = await lignes();
  const aNouveau = ls.filter((l) => !l.lettrageId && l.debit === 1_160_000 && (l.libelle ?? '').startsWith('RAN'));
  expect(aNouveau).toHaveLength(1);
  await appelApi(page, 'POST', `/comptes/${client.id}/lettrage`, {
    ligneIds: [aNouveau[0].id, ls.find((l) => !l.lettrageId && l.credit === 1_160_000)!.id],
  });
  expect((await declaration(annee + 1, 2)).totalCollecte).toBe(160_000);
  await liquider(suivant, annee + 1, 2);
  await valider(suivant);
  const { lignes: balance } = await appelApi<{ lignes: Array<{ numero: string; solde: number }> }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`);
  expect(balance.find((l) => l.numero === c4432.numero)?.solde ?? 0).toBe(0);
  expect(balance.find((l) => l.numero === '44410000')?.solde).toBe(-320_000);
  expect(pannes).toEqual([]);
});

test('SYSCOHADA · le recouvrement d’une créance douteuse encaisse ses factures désignées, et celui d’une créance sans facture est nommé', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'TVA créances douteuses e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/regime', { assujettiTva: true });
  const [ex] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = Number(ex.dateDebut.slice(0, 4));
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const detail = (racine: string) => comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith(racine))!;
  const journaux = await appelApi<Array<{ id: string; type: string; compteTresorerieId: string | null }>>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const bq = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerieId)!;
  const taux = (await appelApi<Array<{ id: string; taux: number }>>(page, 'GET', '/taux-tva')).find((t) => Number(t.taux) === 16)!;
  const nouveau = (numero: string) =>
    appelApi<Compte>(page, 'POST', '/comptes', { numero, intitule: `Client ${numero}`, typeCompte: 'DETAIL', lettrable: true, modeReportANouveau: 'DETAIL' });
  const [k1, k2] = [await nouveau('41110101'), await nouveau('41110102')];
  const prestation = (client: Compte, ttc: number, tva: number) =>
    appelApi(page, 'POST', '/ecritures', {
      exerciceId: ex.id,
      journalId: od.id,
      date: `${annee}-12-10`,
      libelle: `Prestation ${client.numero}`,
      lignes: [
        { compteId: client.id, debit: ttc, credit: 0 },
        { compteId: detail('706').id, debit: 0, credit: ttc - tva },
        { compteId: detail('4432').id, debit: 0, credit: tva, tauxTvaId: taux.id },
      ],
    });
  await prestation(k1, 1_160_000, 160_000);
  await prestation(k2, 580_000, 80_000);
  const valider = (e: Exercice) => appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: e.id, dateLimite: e.dateFin.slice(0, 10) });
  await valider(ex);
  const ligneF = (await appelApi<{ lignes: Ligne[] }>(page, 'GET', `/comptes/${k1.id}/lettrage`)).lignes.find((l) => l.debit === 1_160_000)!;
  const pieces = [{ nature: 'Mise en demeure', reference: 'MD-1' }];
  const reclasser = (client: Compte, montant: number, factures?: unknown[]) =>
    appelApi<{ id: string }>(page, 'POST', '/creances-douteuses', {
      exerciceId: ex.id,
      journalId: od.id,
      date: `${annee}-12-28`,
      compteCreanceId: client.id,
      nature: 'DOUTEUSE',
      montant,
      motif: 'Client défaillant',
      pieces,
      ...(factures ? { factures } : {}),
    });
  const cr1 = await reclasser(k1, 1_160_000, [{ ligneEcritureId: ligneF.id, montant: 1_160_000 }]);
  const cr2 = await reclasser(k2, 580_000);
  await valider(ex);
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: `${annee + 1}-01-01`, dateFin: `${annee + 1}-12-31` });
  await appelApi(page, 'POST', `/exercices/${ex.id}/cloturer`);
  const recouvrer = (cr: { id: string }, montant: number) =>
    appelApi(page, 'POST', `/creances-douteuses/${cr.id}/recouvrement`, {
      exerciceId: suivant.id,
      journalId: bq.id,
      date: `${annee + 1}-03-10`,
      montant,
      motif: 'Versement du client',
      pieces,
    });
  await recouvrer(cr1, 580_000);
  await recouvrer(cr2, 290_000);
  await valider(suivant);
  const mars = await appelApi<Declaration & { recouvrementsSansFactureDesignee: Array<{ recouvreSansFacture: number }>; mentionExigibilite: string }>(
    page,
    'GET',
    `/taux-tva/declaration?dateDebut=${annee + 1}-03-01&dateFin=${annee + 1}-03-31`,
  );
  // 50 % de la créance recouvrés · 80 000 des 160 000 de TVA de la facture désignée.
  expect(mars.totalCollecte).toBe(80_000);
  expect(mars.recouvrementsSansFactureDesignee.map((c) => c.recouvreSansFacture)).toEqual([290_000]);
  expect(mars.mentionExigibilite).toContain('TVA à déclarer par le cabinet faute de facture désignée');
  expect(pannes).toEqual([]);
});

test('SYSCOHADA · une facture à deux échéances, les deux désignées, est encaissée par le recouvrement · une désignation se retire', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'TVA échéances e2e', montant: 10_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/regime', { assujettiTva: true });
  const [ex] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = Number(ex.dateDebut.slice(0, 4));
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const detail = (racine: string) => comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith(racine))!;
  const journaux = await appelApi<Array<{ id: string; type: string; compteTresorerieId: string | null }>>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const bq = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerieId)!;
  const taux = (await appelApi<Array<{ id: string; taux: number }>>(page, 'GET', '/taux-tva')).find((t) => Number(t.taux) === 16)!;
  const client = await appelApi<Compte>(page, 'POST', '/comptes', { numero: '41110101', intitule: 'Client Mbuyi', typeCompte: 'DETAIL', lettrable: true, modeReportANouveau: 'DETAIL' });
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: ex.id,
    journalId: od.id,
    date: `${annee}-12-12`,
    libelle: 'Prestation en deux échéances',
    lignes: [
      { compteId: client.id, debit: 580_000, credit: 0, dateEcheance: `${annee + 1}-01-12` },
      { compteId: client.id, debit: 580_000, credit: 0, dateEcheance: `${annee + 1}-02-12` },
      { compteId: detail('706').id, debit: 0, credit: 1_000_000 },
      { compteId: detail('4432').id, debit: 0, credit: 160_000, tauxTvaId: taux.id },
    ],
  });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: ex.id, dateLimite: ex.dateFin.slice(0, 10) });
  const echeances = (await appelApi<{ lignes: Ligne[] }>(page, 'GET', `/comptes/${client.id}/lettrage`)).lignes.filter((l) => l.debit === 580_000);
  const pieces = [{ nature: 'Mise en demeure', reference: 'MD-1' }];
  const creance = await appelApi<{ id: string }>(page, 'POST', '/creances-douteuses', {
    exerciceId: ex.id,
    journalId: od.id,
    date: `${annee}-12-28`,
    compteCreanceId: client.id,
    nature: 'DOUTEUSE',
    montant: 1_160_000,
    motif: 'Client défaillant',
    pieces,
    factures: [{ ligneEcritureId: echeances[0].id, montant: 290_000 }],
  });
  // La part saisie est fausse · retirée, puis les deux échéances désignées en entier.
  const lues = await appelApi<{ designees: Array<{ id: string }> }>(page, 'GET', `/creances-douteuses/${creance.id}/factures`);
  await appelApi(page, 'POST', `/creances-douteuses/${creance.id}/factures/${lues.designees[0].id}/retirer`, { motif: 'Part saisie fausse' });
  await appelApi(page, 'POST', `/creances-douteuses/${creance.id}/factures`, {
    factures: echeances.map((l) => ({ ligneEcritureId: l.id, montant: 580_000 })),
  });
  await appelApi(page, 'POST', `/creances-douteuses/${creance.id}/recouvrement`, {
    exerciceId: ex.id,
    journalId: bq.id,
    date: `${annee}-12-30`,
    montant: 1_160_000,
    motif: 'Versement du client',
    pieces,
  });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: ex.id, dateLimite: ex.dateFin.slice(0, 10) });
  const decembre = await appelApi<Declaration & { recouvrementsSansFactureDesignee: unknown[] }>(
    page,
    'GET',
    `/taux-tva/declaration?dateDebut=${annee}-12-01&dateFin=${annee}-12-31`,
  );
  expect(decembre.totalCollecte).toBe(160_000);
  expect(decembre.recouvrementsSansFactureDesignee).toEqual([]);
  expect(pannes).toEqual([]);
});
