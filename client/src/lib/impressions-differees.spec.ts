import { criteresDeLaDemande, libelleEtat, productionEnCours, resteAProduire, type ImpressionServie, type ListeImpressions } from './impressions-differees';

// Pas d'import de « vitest » · convention du dépôt (le jest de la racine
// ramasse aussi client/src, describe/it/expect arrivent par les globales).

const base: ImpressionServie = {
  id: 'i1',
  numero: 1,
  nature: 'BALANCE',
  libelle: 'Balance',
  etat: 'EN_ATTENTE',
  demandeLe: '2026-10-15T08:00:00Z',
  demandePar: 'a@b.cd',
  commenceLe: null,
  produitLe: null,
  motifEchec: null,
  nomFichier: null,
  taille: null,
  empreinte: null,
  fichierRetireLe: null,
  interrompue: false,
};
const liste = (impressions: ImpressionServie[], enAttente = 0): ListeImpressions => ({ impressions, total: impressions.length, tronque: false, enAttente });

const champs = {
  exerciceId: 'e',
  journalId: '',
  dateDebut: '',
  dateFin: '',
  inclureBrouillard: true,
  format: 'fpm' as const,
  grandsLivres: true,
};

describe('impressions différées · ce que la fenêtre en dit', () => {
  it('une production tombée se dit interrompue, jamais en cours ; un fichier retiré le dit', () => {
    expect(libelleEtat({ etat: 'EN_COURS', interrompue: false, fichierRetireLe: null })).toBe('En cours');
    expect(libelleEtat({ etat: 'EN_COURS', interrompue: true, fichierRetireLe: null })).toBe('Interrompue');
    expect(libelleEtat({ etat: 'PRETE', interrompue: false, fichierRetireLe: '2026-10-15' })).toBe('Prête · fichier retiré');
    expect(libelleEtat({ etat: 'ECHOUEE', interrompue: false, fichierRetireLe: null })).toBe('Échouée');
  });

  it('il reste à produire tant qu’une demande attend ou qu’une production est tombée', () => {
    expect(resteAProduire(liste([base], 1))).toBe(true);
    expect(resteAProduire(liste([{ ...base, etat: 'EN_COURS', interrompue: true }]))).toBe(true);
    expect(resteAProduire(liste([{ ...base, etat: 'EN_COURS' }]))).toBe(false);
    expect(productionEnCours(liste([{ ...base, etat: 'EN_COURS' }]))).toBe(true);
    expect(productionEnCours(liste([{ ...base, etat: 'PRETE' }]))).toBe(false);
  });

  it('les critères envoyés sont ceux du livre demandé, et eux seuls', () => {
    expect(criteresDeLaDemande('JOURNAL', { ...champs, journalId: 'j', dateFin: '2026-03-31', inclureBrouillard: false })).toEqual({
      exerciceId: 'e',
      journalId: 'j',
      dateFin: '2026-03-31',
      inclureBrouillard: false,
    });
    expect(criteresDeLaDemande('GRAND_LIVRE', { ...champs, format: 'plat' })).toEqual({ exerciceId: 'e', format: 'plat' });
    expect(criteresDeLaDemande('BALANCE', { ...champs, grandsLivres: false })).toEqual({ exerciceId: 'e', grandsLivres: false });
  });
});
