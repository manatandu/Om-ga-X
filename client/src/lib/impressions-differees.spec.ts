import {
  criteresDeLaDemande,
  doitFaireProduire,
  garderLesPlusAnciennes,
  libelleEtat,
  messageLicenceEchue,
  poursuivreImpressions,
  productionEnCours,
  resteAProduire,
  type ImpressionServie,
  type ListeImpressions,
} from './impressions-differees';

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
const liste = (impressions: ImpressionServie[], enAttente = 0): ListeImpressions => ({
  impressions,
  total: impressions.length,
  tronque: false,
  plusAnciensAvant: null,
  enAttente,
});

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

  it('la relance ne part que s’il reste à produire, qu’aucune production ne tourne et qu’aucun refus ne l’a suspendue (second tour, 1)', () => {
    const attente = liste([base], 1);
    expect(doitFaireProduire(attente, false)).toBe(true);
    // Une production tourne (un autre poste, ou le serveur après un 504) · on relit seulement.
    expect(doitFaireProduire(liste([{ ...base, id: 'i2', numero: 2, etat: 'EN_COURS' }, base], 1), false)).toBe(false);
    // Une production tombée se fait déclarer par le traitement.
    expect(doitFaireProduire(liste([{ ...base, etat: 'EN_COURS', interrompue: true }]), false)).toBe(true);
    // Un refus nommé suspend la relance jusqu'au prochain geste.
    expect(doitFaireProduire(attente, true)).toBe(false);
    expect(doitFaireProduire(liste([{ ...base, etat: 'PRETE' }]), false)).toBe(false);
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

  it('la page suivante s’ajoute ; une relecture de la première page garde les plus anciennes chargées (m5)', () => {
    const i = (n: number) => ({ ...base, id: `i${n}`, numero: n });
    const premiere = { ...liste([i(4), i(3)]), total: 4, tronque: true, plusAnciensAvant: 3 };
    const toute = poursuivreImpressions(premiere, { ...liste([i(2), i(1)]), total: 4 });
    expect([toute.impressions.map((x) => x.numero), toute.tronque, toute.plusAnciensAvant]).toEqual([[4, 3, 2, 1], false, null]);
    const relue = garderLesPlusAnciennes(toute, { ...liste([{ ...i(4), etat: 'PRETE' }, i(3)]), total: 4, tronque: true, plusAnciensAvant: 3 });
    expect([relue.impressions.map((x) => x.numero), relue.impressions[0].etat, relue.plusAnciensAvant]).toEqual([[4, 3, 2, 1], 'PRETE', null]);
    expect(garderLesPlusAnciennes(null, premiere)).toBe(premiere);
  });

  it('une licence échue se dit à côté du refus, et renvoie vers l’export direct (m10)', () => {
    class ErreurApi extends Error {
      constructor(public status: number, message: string) {
        super(message);
      }
    }
    const refus = new ErreurApi(403, "Abonnement expiré · le dossier est en lecture seule : consultation et impression possibles, aucune modification jusqu'au renouvellement de l'abonnement.");
    expect(messageLicenceEchue(refus)).toMatch(/Une licence échue ne produit plus d'impression différée · téléchargez le livre directement/);
    expect(messageLicenceEchue(new ErreurApi(403, 'Accès refusé : licence invalide'))).toBeNull();
    expect(messageLicenceEchue(new TypeError('Failed to fetch'))).toBeNull();
  });
});

