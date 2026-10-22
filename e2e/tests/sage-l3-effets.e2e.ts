import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * EFFETS DE COMMERCE (ligne sage-l3, n° 39 · Sage, « Moyens de paiement »,
 * LCR à l'encaissement et à décaisser), sur le serveur réel et une vraie
 * base, à travers une clôture. AUDCIF Titre VII · fiche du 41 (412 en
 * portefeuille, 415 escompté non échu, 4132 impayé), du 51 (512 à
 * l'encaissement), du 56 (565, trois temps de l'escompte), du 67 (675), du
 * 63 (6312). Décret n° 011/42, art. 57 · la TVA de la prestation payée par
 * traite est exigible à l'ÉCHÉANCE, ni à l'acceptation ni au jour de
 * l'encaissement. Ici · une acceptation lettrée avec sa facture, une remise
 * et son encaissement avec commission, un effet escompté en novembre dont le
 * décompte tombe en N, l'échéance et le dénouement en N+1 (415 et 565
 * traversent la clôture), un impayé qui reprend le décompte sur la banque,
 * l'annulation à rebours, et au SYCEBNL l'effet à payer seul.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string }
interface Ligne { id: string; libelle: string | null; debit: number; credit: number; lettrageId: string | null }
interface LigneBalance { numero: string; reportDebit: number; reportCredit: number; mouvementDebit: number; mouvementCredit: number; solde: number }
interface Effet { id: string; statut: string; actes: Array<{ id: string; nature: string; annuleLe: string | null; ecriture: { numeroPiece: number | null; statut: string } | null }>; lettre?: string | null; acteId?: string }
interface Declaration { totalCollecte: number; tvaEnAttenteEncaissement: number }

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);
const refusDe = (p: Promise<unknown>) => p.then(() => 'accepté', (e: unknown) => String(e));
const fin = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
const debut = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`;

test('SYSCOHADA · effets à recevoir · acceptation lettrée, TVA à l’échéance, remise et encaissement, escompte à travers la clôture, impayé, annulation à rebours', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Effets e2e SARL', montant: 5_000_000 });
  await seConnecter(page, dossier.email);
  await appelApi(page, 'PATCH', '/dossier/regime', { assujettiTva: true });
  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = Number(N.dateDebut.slice(0, 4));
  const balance = async (exerciceId: string) => (await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${exerciceId}`)).lignes;
  const solde = (lignes: LigneBalance[], racine: string) => lignes.filter((l) => l.numero.startsWith(racine)).reduce((s, l) => s + l.solde, 0);
  const declaration = (a: number, m: number) => appelApi<Declaration>(page, 'GET', `/taux-tva/declaration?dateDebut=${debut(a, m)}&dateFin=${fin(a, m)}`);
  const valider = (e: Exercice, jusqua?: string) => appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: e.id, dateLimite: jusqua ?? jour(e.dateFin) });

  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const bq = journaux.find((j) => j.code === 'BQ')!;
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const compte = (numero: string) => comptes.find((c) => c.numero === numero)!;
  const taux = (await appelApi<Array<{ id: string; taux: number }>>(page, 'GET', '/taux-tva')).find((t) => Number(t.taux) === 16)!;
  const client = await appelApi<Compte>(page, 'POST', '/comptes', { numero: '41110101', intitule: 'Client Traites', typeCompte: 'DETAIL', lettrable: true, modeReportANouveau: 'DETAIL' });
  const [c706, c4432] = [comptes.find((c) => c.numero.startsWith('706'))!, comptes.find((c) => c.numero.startsWith('4432'))!];
  const prestation = (exerciceId: string, date: string, ht: number, libelle: string) =>
    appelApi(page, 'POST', '/ecritures', {
      exerciceId,
      journalId: od.id,
      date,
      libelle,
      lignes: [
        { compteId: client.id, debit: ht * 1.16, credit: 0, dateEcheance: date },
        { compteId: c706.id, debit: 0, credit: ht },
        { compteId: c4432.id, debit: 0, credit: ht * 0.16, tauxTvaId: taux.id },
      ],
    });
  const lignes = async () => (await appelApi<{ lignes: Ligne[] }>(page, 'GET', `/comptes/${client.id}/lettrage`)).lignes;
  const comptesDuRole = (role: string, sens = 'A_RECEVOIR') => appelApi<{ racines: string[] | null; comptes: Array<{ id: string; numero: string }>; motif: string | null }>(page, 'GET', `/effets/comptes?role=${role}&sens=${sens}`);
  const accepter = (exerciceId: string, dateCreation: string, dateEcheance: string, montant: number, reference: string, ligneIds?: string[]) =>
    appelApi<Effet>(page, 'POST', '/effets', { exerciceId, sens: 'A_RECEVOIR', journalId: od.id, compteTiersId: client.id, compteEffetId: compte('41210000').id, montant, reference, tire: 'Client Traites', dateCreation, dateEcheance, ligneIds });

  // (1) F1 · prestation de janvier, 1 000 000 HT ; l'effet accepté le 1er
  // mars à échéance du 31 mai, lettré avec la facture.
  await prestation(N.id, `${annee}-01-15`, 1_000_000, 'F1 prestation de janvier');
  await valider(N);
  const f1 = (await lignes()).find((l) => l.debit === 1_160_000)!;
  const e1 = await accepter(N.id, `${annee}-03-01`, `${annee}-05-31`, 1_160_000, 'LCR 12', [f1.id]);
  expect([e1.statut, typeof e1.lettre]).toEqual(['EN_PORTEFEUILLE', 'string']);
  let b = await balance(N.id);
  expect([solde(b, '412'), solde(b, client.numero)]).toEqual([1_160_000, 0]);
  await valider(N);
  // LA TVA À L'ÉCHÉANCE (décret n° 011/42, art. 57) · rien en mars, 160 000 en mai.
  expect((await declaration(annee, 3)).totalCollecte).toBe(0);
  expect((await declaration(annee, 5)).totalCollecte).toBe(160_000);
  // Les comptes d'un rôle sous la racine de sa fiche.
  expect((await comptesDuRole('ENCAISSEMENT')).racines).toEqual(['512']);
  expect((await comptesDuRole('CREDIT_ESCOMPTE')).racines).toEqual(['564', '565']);

  // (2) REMISE À L'ENCAISSEMENT (D 512 / C 412), puis ENCAISSEMENT au BQ avec
  // commission au 6312 · un acte hors statut est refusé en nommant l'admis.
  expect(await refusDe(appelApi(page, 'POST', `/effets/${e1.id}/encaisser`, { date: `${annee}-06-02`, journalBanqueId: bq.id, referencePiece: 'Avis 6' }))).toMatch(/n'admet pas « Encaissement »/);
  await appelApi(page, 'POST', `/effets/${e1.id}/remettre`, { date: `${annee}-03-10`, compteEncaissementId: compte('51200000').id });
  b = await balance(N.id);
  expect([solde(b, '412'), solde(b, '512')]).toEqual([0, 1_160_000]);
  const banqueAvant = solde(b, '52');
  const enc = await appelApi<Effet>(page, 'POST', `/effets/${e1.id}/encaisser`, { date: `${annee}-06-02`, journalBanqueId: bq.id, commission: 5_000, compteCommissionId: compte('63120000').id, referencePiece: 'Avis 6' });
  expect(enc.statut).toBe('ENCAISSE');
  b = await balance(N.id);
  expect([solde(b, '512'), solde(b, '6312'), solde(b, '52') - banqueAvant]).toEqual([0, 5_000, 1_155_000]);

  // (3) F2 · prestation de novembre (500 000 HT), effet accepté le 1er
  // novembre à échéance du 31 janvier N+1, ESCOMPTÉ le 10, décompte le 12
  // (frais 20 000 au 675, commission 2 000 au 6312, net 558 000).
  await prestation(N.id, `${annee}-11-02`, 500_000, 'F2 prestation de novembre');
  await valider(N);
  const f2 = (await lignes()).find((l) => l.debit === 580_000 && !l.lettrageId)!;
  const e2 = await accepter(N.id, `${annee}-11-01`, `${annee + 1}-01-31`, 580_000, 'LCR 13', [f2.id]);
  await appelApi(page, 'POST', `/effets/${e2.id}/escompter`, { date: `${annee}-11-10`, compteEscompteNonEchuId: compte('41500000').id });
  expect(await refusDe(appelApi(page, 'POST', `/effets/${e2.id}/denouer`, { date: `${annee}-12-15` }))).toMatch(/passez d'abord le décompte/);
  expect(await refusDe(appelApi(page, 'POST', `/effets/${e2.id}/decompte`, { date: `${annee}-11-12`, journalBanqueId: bq.id, compteCreditEscompteId: compte('56500000').id, frais: 20_000, referencePiece: 'Décompte 11' }))).toMatch(/exigent leur compte/);
  await appelApi(page, 'POST', `/effets/${e2.id}/decompte`, {
    date: `${annee}-11-12`,
    journalBanqueId: bq.id,
    compteCreditEscompteId: compte('56500000').id,
    frais: 20_000,
    compteFraisId: compte('67500000').id,
    commission: 2_000,
    compteCommissionId: compte('63120000').id,
    referencePiece: 'Décompte 11',
  });
  b = await balance(N.id);
  expect([solde(b, '412'), solde(b, '415'), solde(b, '565'), solde(b, '675'), solde(b, '6312')]).toEqual([0, 580_000, -580_000, 20_000, 7_000]);
  expect(solde(b, '52') - banqueAvant).toBe(1_155_000 + 558_000);
  await valider(N);
  // La TVA de F2 n'est exigible ni en novembre (acceptation, escompte) ni en
  // décembre · « même si elle a été remise à l'escompte », à l'échéance.
  expect((await declaration(annee, 11)).totalCollecte).toBe(0);
  expect((await declaration(annee, 12)).totalCollecte).toBe(0);

  // (4) LA CLÔTURE · 415 et 565 traversent ; le dénouement du 31 janvier
  // tombe dans N+1, dans l'exercice de sa date, et janvier déclare 80 000.
  const debutSuivant = lendemain(N.dateFin);
  const N1 = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${annee + 1}-12-31` });
  await appelApi(page, 'POST', `/exercices/${N.id}/cloturer`);
  expect(await refusDe(appelApi(page, 'POST', `/effets/${e2.id}/denouer`, { date: `${annee + 1}-01-30` }))).toMatch(/au plus tôt/);
  const den = await appelApi<Effet>(page, 'POST', `/effets/${e2.id}/denouer`, { date: `${annee + 1}-01-31` });
  expect(den.statut).toBe('ENCAISSE');
  b = await balance(N1.id);
  const c415 = b.find((l) => l.numero === '41500000')!;
  const c565 = b.find((l) => l.numero === '56500000')!;
  expect([c415.reportDebit, c415.mouvementCredit, c415.solde]).toEqual([580_000, 580_000, 0]);
  expect([c565.reportCredit, c565.mouvementDebit, c565.solde]).toEqual([580_000, 580_000, 0]);
  await valider(N1, `${annee + 1}-01-31`);
  expect((await declaration(annee + 1, 1)).totalCollecte).toBe(80_000);

  // (5) L'ANNULATION À REBOURS · le dénouement validé s'inscrit en négatif,
  // l'effet redevient escompté ; l'IMPAYÉ reprend alors le décompte sur la
  // banque (D 4132 / C 415, D 565 / C 52), au journal de la banque.
  const denouement = (await appelApi<Effet>(page, 'GET', `/effets/${e2.id}`)).actes.find((a) => a.nature === 'DENOUEMENT_ESCOMPTE' && !a.annuleLe)!;
  expect(await refusDe(appelApi(page, 'POST', `/effets/${e2.id}/actes/${den.actes[0].id}/annuler`, { motif: 'essai hors ordre' }))).toMatch(/annulez d'abord « Dénouement de l'escompte »/);
  const annule = await appelApi<{ statut: string; traitement: string; ecritureNegatifId: string | null }>(page, 'POST', `/effets/${e2.id}/actes/${denouement.id}/annuler`, { motif: 'dénoué par erreur · effet revenu impayé' });
  expect([annule.statut, annule.traitement, typeof annule.ecritureNegatifId]).toEqual(['ESCOMPTE', 'INSCRITE_EN_NEGATIF', 'string']);
  b = await balance(N1.id);
  expect([solde(b, '415'), solde(b, '565')]).toEqual([580_000, -580_000]);
  const impayes = await comptesDuRole('IMPAYE');
  expect(impayes.racines).toEqual(['4132']);
  const banqueN1Avant = solde(b, '52');
  const imp = await appelApi<Effet>(page, 'POST', `/effets/${e2.id}/impaye`, { date: `${annee + 1}-02-03`, compteImpayeId: impayes.comptes[0].id });
  expect(imp.statut).toBe('IMPAYE');
  b = await balance(N1.id);
  expect([solde(b, '4132'), solde(b, '415'), solde(b, '565'), solde(b, '52') - banqueN1Avant]).toEqual([580_000, 0, 0, -580_000]);
  // L'impayé au brouillard s'annule · pièce retirée, l'effet redevient escompté.
  const impaye = (await appelApi<Effet>(page, 'GET', `/effets/${e2.id}`)).actes.find((a) => a.nature === 'IMPAYE' && !a.annuleLe)!;
  const annule2 = await appelApi<{ statut: string; traitement: string }>(page, 'POST', `/effets/${e2.id}/actes/${impaye.id}/annuler`, { motif: 'impayé déclaré sur le mauvais effet' });
  expect([annule2.statut, annule2.traitement]).toEqual(['ESCOMPTE', 'SUPPRIMEE']);
  expect(solde(await balance(N1.id), '4132')).toBe(0);
  const liste = await appelApi<{ effets: Effet[]; total: number }>(page, 'GET', `/effets?exerciceId=${N.id}&sens=A_RECEVOIR`);
  expect(liste.effets.map((e) => e.statut).sort()).toEqual(['ENCAISSE', 'ESCOMPTE']);
  expect(pannes).toEqual([]);
});

test('SYCEBNL · l’effet à payer seul · acceptation D 401 / C 402 lettrée, bon à payer, paiement ; l’effet à recevoir est refusé avec son motif', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Effets e2e ASBL', montant: 3_000_000 });
  await seConnecter(page, dossier.email);
  const [N] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const annee = N.dateDebut.slice(0, 4);
  const balance = async () => (await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${N.id}`)).lignes;
  const solde = (lignes: LigneBalance[], racine: string) => lignes.filter((l) => l.numero.startsWith(racine)).reduce((s, l) => s + l.solde, 0);
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const bq = journaux.find((j) => j.code === 'BQ')!;
  const od = journaux.find((j) => j.type === 'GENERAL')!;
  const achats = journaux.find((j) => j.type === 'ACHATS')!;
  const fournisseur = await appelApi<{ id: string; compteIndividuel: { id: string; numero: string } }>(page, 'POST', '/tiers', { type: 'FOURNISSEUR', code: 'FRN-LCR', nom: 'Fournisseur Traites' });
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const compte = (numero: string) => comptes.find((c) => c.numero === numero)!;
  const charge = comptes.find((c) => c.numero.startsWith('601'))!;
  await appelApi(page, 'PATCH', `/comptes/${charge.id}`, { estRetenu: true });
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: N.id,
    journalId: achats.id,
    date: `${annee}-04-02`,
    libelle: 'Facture fournisseur',
    lignes: [
      { compteId: charge.id, libelle: 'Achats', debit: 900_000, credit: 0 },
      { compteId: fournisseur.compteIndividuel.id, libelle: 'Fournisseur Traites', debit: 0, credit: 900_000, dateEcheance: `${annee}-06-30` },
    ],
  });
  const facture = (await appelApi<{ lignes: Ligne[] }>(page, 'GET', `/comptes/${fournisseur.compteIndividuel.id}/lettrage`)).lignes.find((l) => l.credit === 900_000)!;
  // L'effet À RECEVOIR est refusé au SYCEBNL, avec le motif de sa fiche.
  const aRecevoir = await appelApi<{ racines: string[] | null; motif: string | null }>(page, 'GET', '/effets/comptes?role=PORTEFEUILLE&sens=A_RECEVOIR');
  expect([aRecevoir.racines, aRecevoir.motif]).toEqual([null, expect.stringMatching(/Clients-usagers/)]);
  expect(await refusDe(appelApi(page, 'POST', '/effets', { exerciceId: N.id, sens: 'A_RECEVOIR', journalId: od.id, compteTiersId: fournisseur.compteIndividuel.id, compteEffetId: compte('40210000').id, montant: 1, reference: 'x', dateCreation: `${annee}-04-10`, dateEcheance: `${annee}-04-10` }))).toMatch(/Clients-usagers/);
  const e = await appelApi<Effet>(page, 'POST', '/effets', {
    exerciceId: N.id,
    sens: 'A_PAYER',
    journalId: od.id,
    compteTiersId: fournisseur.compteIndividuel.id,
    compteEffetId: compte('40210000').id,
    montant: 900_000,
    reference: 'BOR 7',
    dateCreation: `${annee}-04-10`,
    dateEcheance: `${annee}-06-30`,
    ligneIds: [facture.id],
  });
  expect([e.statut, typeof e.lettre]).toEqual(['EN_PORTEFEUILLE', 'string']);
  let b = await balance();
  expect([solde(b, '402'), solde(b, fournisseur.compteIndividuel.numero)]).toEqual([-900_000, 0]);
  expect(await refusDe(appelApi(page, 'POST', `/effets/${e.id}/remettre`, { date: `${annee}-05-01`, compteEncaissementId: compte('40210000').id }))).toMatch(/se paie \(D 402 \/ C 52\)/);
  const bon = await appelApi<Effet>(page, 'POST', `/effets/${e.id}/bon-a-payer`, { date: `${annee}-06-25`, referencePiece: 'Relevé LCR 06' });
  expect(bon.statut).toBe('BON_A_PAYER');
  const banqueAvant = solde(b, '52');
  const paye = await appelApi<Effet>(page, 'POST', `/effets/${e.id}/payer`, { date: `${annee}-06-30`, journalBanqueId: bq.id, referencePiece: 'Avis de débit 30/06' });
  expect(paye.statut).toBe('PAYE');
  b = await balance();
  expect([solde(b, '402'), solde(b, '52') - banqueAvant]).toEqual([0, -900_000]);
  // Le paiement au brouillard s'annule, le bon à payer (sans pièce) aussi, à rebours.
  const actes = (await appelApi<Effet>(page, 'GET', `/effets/${e.id}`)).actes.filter((a) => !a.annuleLe);
  const paiement = actes.find((a) => a.nature === 'PAIEMENT')!;
  const bonAPayer = actes.find((a) => a.nature === 'BON_A_PAYER')!;
  expect(await refusDe(appelApi(page, 'POST', `/effets/${e.id}/actes/${bonAPayer.id}/annuler`, { motif: 'hors ordre' }))).toMatch(/annulez d'abord « Paiement »/);
  expect(await appelApi<{ statut: string; traitement: string }>(page, 'POST', `/effets/${e.id}/actes/${paiement.id}/annuler`, { motif: 'payé sur le mauvais compte' })).toMatchObject({ statut: 'BON_A_PAYER', traitement: 'SUPPRIMEE' });
  expect(await appelApi<{ statut: string; traitement: string }>(page, 'POST', `/effets/${e.id}/actes/${bonAPayer.id}/annuler`, { motif: 'relevé lu de travers' })).toMatchObject({ statut: 'EN_PORTEFEUILLE', traitement: 'SANS_PIECE' });
  expect(solde(await balance(), '402')).toBe(-900_000);
  expect(pannes).toEqual([]);
});
