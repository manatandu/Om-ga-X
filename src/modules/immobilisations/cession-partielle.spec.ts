import { motifRefusSortiePartielle, partDesUnites, resteDuLot, type FaitsDuLot } from './cession-partielle';
import { estDepreciationAnterieure } from './transfert-groupe';

/**
 * LA SORTIE D'UNE PARTIE DES UNITÉS D'UN LOT (ligne immos, fonction n° 65).
 * Ce qui casserait en silence · une part arrondie deux fois, et le brut
 * restant au registre diffère d'un centime du solde du 2x ; une dépréciation
 * du lot laissée entière sur les unités qui restent (le plan les amortirait
 * trop peu) ; une part prise sur un cumul qui ignore un exercice ouvert non
 * doté.
 */

const LOT = { brut: 1_000_000, valeurResiduelle: 0, cumulOuverture: 333_333.33, depreciation: 100_000, complement: 83_333.33, quantite: 3 };

describe('la part des unités, au centime', () => {
  it('une unité sur trois · chaque montant arrondi au centime', () => {
    expect(partDesUnites(LOT, 1)).toEqual({ brut: 333_333.33, valeurResiduelle: 0, cumulOuverture: 111_111.11, depreciation: 33_333.33, complement: 27_777.78 });
  });

  it('le lot garde la DIFFÉRENCE exacte · la dernière unité prend le reste, la somme fait le tout', () => {
    const p1 = partDesUnites(LOT, 1);
    const reste = resteDuLot(LOT, p1);
    expect(reste.brut).toBe(666_666.67);
    expect(Math.round((reste.brut + p1.brut) * 100)).toBe(100_000_000);
    // Deux sorties d'une unité, puis la dernière en entier · rien ne se perd.
    const lot2 = { ...LOT, ...reste, complement: 0, quantite: 2 };
    const p2 = partDesUnites(lot2, 1);
    const fin = resteDuLot(lot2, p2);
    expect(Math.round((p1.brut + p2.brut + fin.brut) * 100)).toBe(100_000_000);
    expect(Math.round((p1.depreciation + p2.depreciation + fin.depreciation) * 100)).toBe(10_000_000);
  });

  it('une valeur nulle reste nulle, et les montants négatifs n’existent pas ici', () => {
    expect(partDesUnites({ ...LOT, depreciation: 0, complement: 0 }, 2)).toMatchObject({ depreciation: 0, complement: 0 });
  });
});

const FAITS: FaitsDuLot = {
  enService: true,
  quantite: 10,
  quantiteSortie: 3,
  estComposant: false,
  composantsEnService: 0,
  unitesOeuvre: false,
  degressifFiscal: false,
  derogatoires: 0,
  financeeParUnFonds: false,
  reevaluee: false,
  locationAcquisition: false,
  acquisitionAleatoire: false,
  demantelement: false,
  dotationDejaPassee: false,
  exerciceAnterieurNonDote: null,
  repriseDejaPasseeCetExercice: false,
  deprecie: false,
};

describe('les refus nommés, avec leur issue', () => {
  it('un lot ordinaire passe', () => expect(motifRefusSortiePartielle(FAITS)).toBeNull());

  it('une seule unité, ou toutes · c’est la sortie entière, par « Sortir »', () => {
    expect(motifRefusSortiePartielle({ ...FAITS, quantite: 1, quantiteSortie: 1 })).toMatch(/une seule unité.*déclarez d’abord sa quantité/);
    expect(motifRefusSortiePartielle({ ...FAITS, quantiteSortie: 10 })).toMatch(/sortir le bien en entier/);
    expect(motifRefusSortiePartielle({ ...FAITS, quantiteSortie: 0 })).toMatch(/au moins une/);
    expect(motifRefusSortiePartielle({ ...FAITS, quantiteSortie: 1.5 })).toMatch(/un entier/);
  });

  it('la dotation de l’exercice déjà passée · annuler, sortir, repasser', () => {
    expect(motifRefusSortiePartielle({ ...FAITS, dotationDejaPassee: true })).toMatch(/Annulez la dotation/);
  });

  it('un exercice antérieur ouvert sans la dotation du lot est nommé', () => {
    expect(motifRefusSortiePartielle({ ...FAITS, exerciceAnterieurNonDote: '2025-12-31' })).toMatch(/clos le 2025-12-31/);
  });

  it('composant, unités d’œuvre, dérogatoire, fonds, réévaluation, engagements · chacun son motif', () => {
    expect(motifRefusSortiePartielle({ ...FAITS, composantsEnService: 2 })).toMatch(/composant/);
    expect(motifRefusSortiePartielle({ ...FAITS, unitesOeuvre: true })).toMatch(/unités d’œuvre/);
    expect(motifRefusSortiePartielle({ ...FAITS, derogatoires: 1 })).toMatch(/dérogatoire/);
    expect(motifRefusSortiePartielle({ ...FAITS, financeeParUnFonds: true })).toMatch(/fonds/);
    expect(motifRefusSortiePartielle({ ...FAITS, reevaluee: true })).toMatch(/réévalué/);
    expect(motifRefusSortiePartielle({ ...FAITS, demantelement: true })).toMatch(/démantèlement/);
  });

  it('une seconde reprise de dépréciation dans le même exercice se refuse, sans dépréciation elle passe', () => {
    expect(motifRefusSortiePartielle({ ...FAITS, deprecie: true, repriseDejaPasseeCetExercice: true })).toMatch(/exercice suivant/);
    expect(motifRefusSortiePartielle({ ...FAITS, deprecie: false, repriseDejaPasseeCetExercice: true })).toBeNull();
  });
});

describe('la reprise de la part sortie ré-étale le lot dès l’exercice de la sortie', () => {
  const N = { dateFin: new Date('2026-12-31') };
  it('comptée pour la dotation de l’exercice même, et des suivants', () => {
    expect(estDepreciationAnterieure({ sens: 'REPRISE', nature: 'CESSION_PARTIELLE', exercice: N }, N)).toBe(true);
    expect(estDepreciationAnterieure({ sens: 'REPRISE', nature: 'CESSION_PARTIELLE', exercice: N }, { dateFin: new Date('2027-12-31') })).toBe(true);
    expect(estDepreciationAnterieure({ sens: 'REPRISE', nature: 'CESSION_PARTIELLE', exercice: { dateFin: new Date('2027-12-31') } }, N)).toBe(false);
    // Une dépréciation de clôture de l'exercice ne compte pas pour sa propre dotation.
    expect(estDepreciationAnterieure({ sens: 'DOTATION', nature: 'CLOTURE', exercice: N }, N)).toBe(false);
  });
});
