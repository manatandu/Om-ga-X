import { expect, test } from '@playwright/test';
import { appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LE 130 « RÉSULTAT EN INSTANCE D'AFFECTATION », SUR LA BASE RÉELLE (paquet 1,
 * A6, décision de Manasse du 2026-10-09).
 *
 * AUDCIF, Titre VII, compte 13 · « À la réouverture des comptes de l'exercice
 * suivant, les entités ont la possibilité d'utiliser un compte spécial
 * "Résultat en instance d'affectation" (130) » ; « le compte 13 est donc
 * soldé lors de la comptabilisation de cette affectation ». Le cabinet vire
 * le bénéfice de N au 1301 après la clôture · le bilan de N+1, arrêté avant
 * l'assemblée, le lit dans CJ et s'équilibre ; l'affectation solde le 1301,
 * jamais le 131 déjà vidé (il passait en négatif et le résultat comptait deux
 * fois). Ce parcours traverse la clôture de N (CLAUDE.md § 10).
 */
const MONTANT = 150_000;

interface Exercice { id: string; dateDebut: string; dateFin: string }
interface Compte { id: string; numero: string; typeCompte: string }
interface Journal { id: string; code: string; type: string }
interface LigneBalance { numero: string; solde: number }
interface Poste { ref: string; montant: number }
interface Bilan { passif: Poste[]; equilibre: boolean; resultatEnInstance: number | null; comptesNonRattaches: { numero: string }[] }

const jour = (iso: string) => iso.slice(0, 10);
const lendemain = (iso: string) => new Date(Date.parse(jour(iso)) + 86_400_000).toISOString().slice(0, 10);

test('SYSCOHADA · le bénéfice viré au 130 est au résultat du bilan, et l’affectation solde le 130', async ({ page }) => {
  const pannes = surveiller(page);
  const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Résultat en instance e2e', montant: MONTANT });
  await seConnecter(page, dossier.email);

  const [exercice] = (await appelApi<Exercice[]>(page, 'GET', '/exercices')).filter((e) => e.id === dossier.exerciceId);
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: exercice.id, dateLimite: jour(exercice.dateFin) });
  const debutSuivant = lendemain(exercice.dateFin);
  const suivant = await appelApi<Exercice>(page, 'POST', '/exercices', {
    dateDebut: debutSuivant,
    dateFin: `${Number(debutSuivant.slice(0, 4))}-12-31`,
  });
  await appelApi(page, 'POST', `/exercices/${exercice.id}/cloturer`);

  // Le cabinet vire le bénéfice de N au 1301, le lendemain de l'ouverture.
  const comptes = await appelApi<Compte[]>(page, 'GET', '/comptes?typeCompte=DETAIL');
  const detail = (racine: string) => comptes.find((c) => c.typeCompte === 'DETAIL' && c.numero.startsWith(racine))!;
  const c131 = detail('131');
  const c1301 = detail('1301');
  const c121 = detail('121');
  const journaux = await appelApi<Journal[]>(page, 'GET', '/journaux');
  const od = journaux.find((j) => j.code === 'OD') ?? journaux.find((j) => j.type === 'GENERAL')!;
  const date = lendemain(debutSuivant);
  await appelApi(page, 'POST', '/ecritures', {
    exerciceId: suivant.id,
    journalId: od.id,
    date,
    libelle: 'Résultat en instance d’affectation',
    lignes: [
      { compteId: c131.id, libelle: 'Résultat en instance', debit: MONTANT, credit: 0 },
      { compteId: c1301.id, libelle: 'Résultat en instance', debit: 0, credit: MONTANT },
    ],
  });
  await appelApi(page, 'POST', '/ecritures/valider-jusqua', { exerciceId: suivant.id, dateLimite: date });

  // Le bilan de N+1, avant l'assemblée · le 130 est dans CJ, le bilan s'équilibre.
  const bilan = await appelApi<Bilan>(page, 'GET', `/etats-financiers-syscohada/bilan?exerciceId=${suivant.id}`);
  expect({
    cj: bilan.passif.find((p) => p.ref === 'CJ')?.montant,
    enInstance: bilan.resultatEnInstance,
    equilibre: bilan.equilibre,
    orphelin130: bilan.comptesNonRattaches.some((c) => c.numero.startsWith('130')),
  }).toEqual({ cj: MONTANT, enInstance: MONTANT, equilibre: true, orphelin130: false });

  // L'affectation solde le 1301, jamais le 131.
  await appelApi(page, 'POST', '/affectation-resultat', {
    exerciceId: exercice.id,
    dateDecision: `${debutSuivant.slice(0, 4)}-06-30`,
    organe: 'Assemblée générale ordinaire',
    reference: 'PV-AGO-E2E',
    lignes: [{ compteId: c121.id, montant: MONTANT }],
  });
  const { lignes } = await appelApi<{ lignes: LigneBalance[] }>(page, 'GET', `/ecritures/balance?exerciceId=${suivant.id}`);
  const solde = (racine: string) => lignes.filter((l) => l.numero.startsWith(racine)).reduce((s, l) => s + l.solde, 0);
  expect({ s130: solde('130'), s131: solde('131'), s121: solde('121') }).toEqual({ s130: 0, s131: 0, s121: -MONTANT });

  expect(pannes).toEqual([]);
});
