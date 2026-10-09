import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LES COMPTES PERSONNALISÉS À TRAVERS UNE CLÔTURE (décision de Manasse du
 * 2026-10-09 · « les écritures n'admettraient que les comptes personnalisés
 * du dossier »). Sur vraie base, par l'API du serveur compilé (CLAUDE.md
 * § 10) · un journal de banque naît avec SON compte, ouvert sous un compte
 * de la classe 5 du plan au numéro proposé ; dès lors la saisie refuse le
 * compte du plan qu'il subdivise, en nommant le compte du dossier, sauf la
 * pièce qui reporte un montant déjà porté au compte du plan. Le compte du
 * plan qu'un journal de trésorerie TIENT reste ouvert · le journal semé ne
 * s'enferme pas quand un second journal ouvre son compte dessous. La
 * clôture reporte les deux comptes chacun pour soi, et la règle tient en
 * N+1. À l'écran, la création d'un journal de trésorerie ouvre son compte
 * par défaut, numéro proposé.
 */
interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; intitule: string; typeCompte: string }
interface Journal { id: string; code: string; type: string; compteTresorerie: { numero: string; intitule: string } | null }
interface LigneBalance { numero: string; reportDebit: number; reportCredit: number }
interface Propose { numero: string | null; racine: string; longueur: number; compteDuPlan: { numero: string }; motif: string | null }

const AVANT = 80_000;
const APRES = 50_000;
const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);

test('SYSCOHADA · un journal de banque ouvre son compte, la saisie refuse le compte du plan qu’il subdivise', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Comptes personnalisés e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);

  // Les comptes du plan offerts sont les comptes d'imputation semés de la classe 5.
  const duPlan = await appelApi<Compte[]>(page, 'GET', '/journaux/comptes-du-plan');
  const numerosDuPlan = duPlan.map((c) => c.numero);
  expect(numerosDuPlan).toEqual(expect.arrayContaining(['52110000', '52150000', '52400000', '57110000']));
  expect(numerosDuPlan.every((n) => /^5[2357]/.test(n) || /^58[12]/.test(n))).toBe(true);
  // Jamais un compte qui ne tient pas de fonds (fiches de la classe 5).
  for (const n of ['59000000', '58500000', '52610000', '56100000', '50220000']) expect(numerosDuPlan).not.toContain(n);
  const sous = (n: string) => duPlan.find((c) => c.numero === n)!.id;
  const depreciation = (await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL')).find((c) => c.numero === '59000000')!;
  await expect(
    appelApi(page, 'POST', '/journaux', { code: 'BQX', intitule: 'Erreur', type: 'TRESORERIE', ouvrirCompteSousId: depreciation.id }),
  ).rejects.toThrow(/fiche du compte 59/);

  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const produit = comptes.find((c) => c.numero.startsWith('701'))!;
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.type === 'GENERAL');
  if (!od) throw new Error('Aucun journal d’opérations diverses semé · le scénario ne peut pas passer ses pièces.');
  const date = `${exercice.dateDebut.slice(0, 4)}-06-15`;
  const piece = (exerciceId: string, d: string, lignes: { compteId: string; debit: number; credit: number }[], libelle: string) => ({
    exerciceId,
    journalId: od.id,
    date: d,
    libelle,
    lignes: lignes.map((l) => ({ ...l, libelle })),
  });

  // Avant toute subdivision, le compte du plan se saisit.
  const id5215 = comptes.find((c) => c.numero === '52150000')!.id;
  await appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: id5215, debit: AVANT, credit: 0 }, { compteId: produit.id, debit: 0, credit: AVANT }], 'Remise au compte du plan'));

  // Le numéro proposé est le premier libre sous la racine, à la longueur du dossier.
  expect(await appelApi<Propose>(page, 'GET', `/journaux/compte-propose?sousId=${sous('52150000')}`)).toMatchObject({
    numero: '52150001',
    racine: '5215',
    longueur: 8,
    compteDuPlan: { numero: '52150000' },
    motif: null,
  });
  await appelApi(page, 'POST', '/journaux', { code: 'BQ2', intitule: 'Rawbank', type: 'TRESORERIE', ouvrirCompteSousId: sous('52150000') });
  const bq2 = (await appelApi<Journal[]>(page, 'GET', '/journaux')).find((j) => j.code === 'BQ2')!;
  expect(bq2.compteTresorerie).toEqual(expect.objectContaining({ numero: '52150001', intitule: 'Rawbank' }));
  expect((await appelApi<Propose>(page, 'GET', `/journaux/compte-propose?sousId=${sous('52150000')}`)).numero).toBe('52150002');

  // Pris, le numéro est refusé ; hors de la racine aussi ; un refus n'ouvre rien.
  await expect(
    appelApi(page, 'POST', '/journaux', { code: 'BQ3', intitule: 'Equity', type: 'TRESORERIE', ouvrirCompteSousId: sous('52150000'), numeroCompte: '52150001' }),
  ).rejects.toThrow(/Le compte 52150001 existe déjà dans ce dossier/);
  await expect(
    appelApi(page, 'POST', '/journaux', { code: 'BQ3', intitule: 'Equity', type: 'TRESORERIE', ouvrirCompteSousId: sous('52150000'), numeroCompte: '52110009' }),
  ).rejects.toThrow(/ne commence pas par 5215/);
  expect((await appelApi<Journal[]>(page, 'GET', '/journaux')).some((j) => j.code === 'BQ3')).toBe(false);

  // Le compte du plan subdivisé refuse la saisie, en nommant le compte du dossier.
  const plan = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const id = (n: string) => plan.find((c) => c.numero === n)!.id;
  await expect(
    appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: id('52150000'), debit: APRES, credit: 0 }, { compteId: produit.id, debit: 0, credit: APRES }], 'Remise refusée')),
  ).rejects.toThrow(/Compte du plan subdivisé par le dossier : 52150000 \(52150001 Rawbank/);
  await appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: id('52150001'), debit: APRES, credit: 0 }, { compteId: produit.id, debit: 0, credit: APRES }], 'Remise Rawbank'));

  // Le compte du plan que le journal semé TIENT reste ouvert, même subdivisé.
  await appelApi(page, 'POST', '/journaux', { code: 'BQ3', intitule: 'Equity', type: 'TRESORERIE', ouvrirCompteSousId: sous('52110000') });
  const plan2 = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  expect(plan2.some((c) => c.numero === '52110001')).toBe(true);
  const id5211 = plan2.find((c) => c.numero === '52110000')!.id;
  await appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: id5211, debit: 1_000, credit: 0 }, { compteId: produit.id, debit: 0, credit: 1_000 }], 'Remise banque du journal semé'));

  // La clôture reporte chaque compte pour soi.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
  const debutSuivant = lendemain(exercice.dateFin);
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${debutSuivant.slice(0, 4)}-12-31` });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);
  const { lignes } = await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`);
  const report = (n: string) => {
    const l = lignes.find((x) => x.numero === n);
    return l ? [l.reportDebit, l.reportCredit] : null;
  };
  expect({ plan: report('52150000'), rawbank: report('52150001') }).toEqual({ plan: [AVANT, 0], rawbank: [APRES, 0] });

  // En N+1, le montant resté au compte du plan se reporte sur le compte du dossier,
  // et la saisie ordinaire y reste refusée.
  const dateN1 = `${debutSuivant.slice(0, 4)}-02-10`;
  await expect(
    appelApi(page, 'POST', '/ecritures', piece(suivant.id, dateN1, [{ compteId: id('52150000'), debit: 10_000, credit: 0 }, { compteId: produit.id, debit: 0, credit: 10_000 }], 'Remise refusée N+1')),
  ).rejects.toThrow(/Compte du plan subdivisé par le dossier : 52150000/);
  await appelApi(page, 'POST', '/ecritures', piece(suivant.id, dateN1, [{ compteId: id('52150001'), debit: AVANT, credit: 0 }, { compteId: id('52150000'), debit: 0, credit: AVANT }], 'Report sur Rawbank'));

  // À l'écran · la création d'un journal de trésorerie ouvre son compte, numéro proposé.
  await page.goto('/#/journaux');
  await page.getByRole('button', { name: 'Nouveau journal' }).click();
  const fenetre = page.locator('form');
  await fenetre.getByPlaceholder('ACH, VEN, BQ…').fill('BQ4');
  await fenetre.getByRole('textbox').nth(1).fill('Ecobank');
  await fenetre.locator('select').first().selectOption('TRESORERIE');
  await expect(fenetre.getByRole('radio', { name: 'Ouvrir son compte' })).toBeChecked();
  await fenetre.getByLabel('Sous le compte :').selectOption(sous('52400000'));
  const numero = fenetre.getByLabel('N° de compte :');
  await expect(numero).toHaveValue('52400001');
  await fenetre.getByRole('button', { name: 'Créer le journal' }).click();
  await expect(page.getByText('52400001 Ecobank')).toBeVisible();

  expect(pannes).toEqual([]);
});

/**
 * SEULS LES COMPTES PERSONNALISÉS (décision de Manasse du 2026-10-09 · « seuls
 * les numéros personnalisés sont ceux qui s'affichent et permettent de passer
 * les écritures » ; « on ne peut pas rattacher un numéro de compte dans un
 * tiers ou une banque sans que ce numéro ne soit créé ou personnalisé » ; « ces
 * comptes personnalisés fonctionnent exactement comme leur compte racine »).
 * Sur vraie base, à travers une clôture · un compte du plan ni adopté ni
 * utilisé est refusé à la saisie et aux rattachements ; le sous-compte
 * proposé naît personnalisé et reprend les réglages de son compte du plan ;
 * l'écriture que la clôture passe adopte d'office le compte de résultat
 * qu'elle mouvemente.
 */
interface CompteUsage extends Compte { estRetenu: boolean; utilise?: boolean; lettrable: boolean; modeReportANouveau: string }

test('SYSCOHADA · seuls les comptes personnalisés se saisissent et se rattachent, à travers une clôture', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Personnalisés v2 e2e', montant: 1_000 });
  await seConnecter(page, dossier.email);
  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  const plan = await appelApi<CompteUsage[]>(page, 'GET', '/comptes?typeCompte=DETAIL&usage=true');
  const du = (n: string) => {
    const c = plan.find((x) => x.numero === n);
    if (!c) throw new Error(`Le compte ${n} manque au plan semé`);
    return c;
  };
  const od = (await appelApi<Journal[]>(page, 'GET', '/journaux')).find((j) => j.type === 'GENERAL')!;
  const date = `${exercice.dateDebut.slice(0, 4)}-05-20`;
  const piece = (exerciceId: string, d: string, lignes: { compteId: string; debit: number; credit: number }[], libelle: string) => ({
    exerciceId,
    journalId: od.id,
    date: d,
    libelle,
    lignes: lignes.map((l) => ({ ...l, libelle })),
  });
  const sansAdopter = { personnaliserAvant: false };

  // Un compte du plan semé, ni adopté ni utilisé · ni proposé ni saisissable.
  const loyer = plan.find((c) => c.numero.startsWith('622') && !c.estRetenu && !c.utilise)!;
  const caisse = plan.find((c) => c.numero.startsWith('571') && !c.estRetenu && !c.utilise)!;
  expect(loyer && caisse).toBeTruthy();
  const proposes = (await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL&retenus=true')).map((c) => c.numero);
  expect(proposes).not.toContain(loyer.numero);
  await expect(
    appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: loyer.id, debit: 300_000, credit: 0 }, { compteId: caisse.id, debit: 0, credit: 300_000 }], 'Loyer refusé'), {}, sansAdopter),
  ).rejects.toThrow(new RegExp(`Compte non personnalisé : ${caisse.numero}.*${loyer.numero}|Compte non personnalisé : ${loyer.numero}`));

  // Le sous-compte proposé sous le compte du plan naît personnalisé et en reprend les réglages.
  const propose = await appelApi<{ numero: string | null; intitule: string; motif: string | null }>(page, 'GET', `/comptes/${loyer.id}/sous-compte-propose`);
  expect(propose).toMatchObject({ numero: `${loyer.numero.slice(0, 4)}0001`.slice(0, 8), motif: null });
  const sousLoyer = await appelApi<CompteUsage>(page, 'POST', '/comptes', { numero: propose.numero, intitule: 'Loyer du siège' });
  expect(sousLoyer).toMatchObject({ estRetenu: true, lettrable: loyer.lettrable, modeReportANouveau: loyer.modeReportANouveau });
  // Le compte de caisse du plan, ADOPTÉ tel quel, avec l'intitulé du cabinet.
  await appelApi(page, 'PATCH', `/comptes/${caisse.id}`, { estRetenu: true, intitule: 'Caisse siège' });
  await appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: sousLoyer.id, debit: 300_000, credit: 0 }, { compteId: caisse.id, debit: 0, credit: 300_000 }], 'Loyer de mai'), {}, sansAdopter);
  // Le compte du plan qu'il subdivise reste refusé · le refus de la subdivision
  // passe d'abord, il nomme le sous-compte où la ligne doit aller.
  await expect(
    appelApi(page, 'POST', '/ecritures', piece(exercice.id, date, [{ compteId: loyer.id, debit: 1, credit: 0 }, { compteId: caisse.id, debit: 0, credit: 1 }], 'Loyer au compte du plan'), {}, sansAdopter),
  ).rejects.toThrow(new RegExp(`Compte du plan subdivisé par le dossier : ${loyer.numero} \\(${sousLoyer.numero} Loyer du siège`));

  // Un tiers ne se rattache qu'à un compte personnalisé.
  const tiers = await appelApi<{ id: string }>(page, 'POST', '/tiers', { type: 'FOURNISSEUR', code: 'F-NOVA', nom: 'Nova Services', creerCompteIndividuel: false });
  const fournisseurs = du('40110000');
  await expect(appelApi(page, 'POST', `/tiers/${tiers.id}/comptes`, { compteId: fournisseurs.id, estPrincipal: true })).rejects.toThrow(
    /le rattachement à un tiers ne se fait que sur un compte personnalisé/,
  );
  const numeroNova = (await appelApi<{ numero: string | null }>(page, 'GET', `/comptes/${fournisseurs.id}/sous-compte-propose`)).numero!;
  const nova = await appelApi<Compte>(page, 'POST', '/comptes', { numero: numeroNova, intitule: 'Nova Services' });
  await appelApi(page, 'POST', `/tiers/${tiers.id}/comptes`, { compteId: nova.id, estPrincipal: true });

  // Un journal de banque ne prend pas un compte du plan non personnalisé.
  const banqueLibre = plan.find((c) => c.numero.startsWith('524') && !c.estRetenu && !c.utilise)!;
  await expect(
    appelApi(page, 'POST', '/journaux', { code: 'BQ7', intitule: 'Equity', type: 'TRESORERIE', compteTresorerieId: banqueLibre.id }),
  ).rejects.toThrow(/le rattachement à un journal ne se fait que sur un compte personnalisé/);

  // La clôture adopte d'office le compte de résultat qu'elle mouvemente.
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
  const debutSuivant = lendemain(exercice.dateFin);
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', { dateDebut: debutSuivant, dateFin: `${debutSuivant.slice(0, 4)}-12-31` });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);
  const apres = await appelApi<CompteUsage[]>(page, 'GET', '/comptes?typeCompte=DETAIL&usage=true');
  const resultat = apres.filter((c) => c.numero.startsWith('13') && c.utilise);
  expect(resultat.length).toBeGreaterThan(0);
  const proposesN1 = (await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL&retenus=true')).map((c) => c.numero);
  for (const c of resultat) expect(proposesN1).toContain(c.numero);
  // Les comptes du dossier passent la clôture · le loyer se saisit encore en N+1, au solde reporté.
  const { lignes } = await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`);
  expect(lignes.find((l) => l.numero === caisse.numero)).toMatchObject({ reportCredit: 300_000 });
  const dateN1 = `${debutSuivant.slice(0, 4)}-01-31`;
  await appelApi(page, 'POST', '/ecritures', piece(suivant.id, dateN1, [{ compteId: sousLoyer.id, debit: 300_000, credit: 0 }, { compteId: caisse.id, debit: 0, credit: 300_000 }], 'Loyer de janvier'), {}, sansAdopter);
  await expect(
    appelApi(page, 'POST', '/ecritures', piece(suivant.id, dateN1, [{ compteId: banqueLibre.id, debit: 1, credit: 0 }, { compteId: caisse.id, debit: 0, credit: 1 }], 'Banque non personnalisée'), {}, sansAdopter),
  ).rejects.toThrow(new RegExp(`Compte non personnalisé : ${banqueLibre.numero}`));

  // À l'écran · « Personnaliser » adopte un compte du plan, l'option ne montre que les personnalisés.
  await page.goto('/#/comptes');
  await page.getByPlaceholder('Rechercher (numéro ou intitulé)…').fill(banqueLibre.numero);
  await page.getByRole('button', { name: new RegExp(banqueLibre.numero) }).first().click();
  await page.getByRole('button', { name: 'Personnaliser…' }).click();
  const boite = page.getByRole('dialog', { name: `Personnaliser le compte ${banqueLibre.numero}` });
  await expect(boite.getByLabel('Numéro :')).toHaveCount(0);
  await boite.getByLabel('Intitulé :').fill('Equity BCDC');
  await boite.getByRole('button', { name: 'Adopter le compte' }).click();
  await expect(page.getByText(`Le compte ${banqueLibre.numero} est personnalisé.`)).toBeVisible();
  const relu = (await appelApi<CompteUsage[]>(page, 'GET', '/comptes?typeCompte=DETAIL&usage=true')).find((c) => c.id === banqueLibre.id)!;
  expect(relu).toMatchObject({ estRetenu: true, intitule: 'Equity BCDC' });
  await page.getByPlaceholder('Rechercher (numéro ou intitulé)…').fill('');
  await page.getByLabel('Comptes personnalisés seulement').check();
  await page.getByRole('button', { name: /^Classe 6/ }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${sousLoyer.numero}`) })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^${loyer.numero}`) })).toHaveCount(0);

  expect(pannes).toEqual([]);
});
