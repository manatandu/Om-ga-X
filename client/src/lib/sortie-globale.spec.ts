import { corpsSortieGlobale } from './sortie-globale';

/**
 * Ligne immos, n° 69 · ce qui casserait en silence · un prix vide envoyé
 * comme zéro (le bien cédé sortirait sans produit au 82), un bien décoché
 * envoyé quand même.
 */
describe('le corps de la sortie globale', () => {
  it('une mise hors service n’envoie que les biens cochés, sans prix', () => {
    expect(
      corpsSortieGlobale({ a: { choisi: true, prix: '' }, b: { choisi: false, prix: '' }, c: { choisi: true, prix: '9' } }, 'MISE_HORS_SERVICE'),
    ).toEqual({ biens: [{ immobilisationId: 'a' }, { immobilisationId: 'c' }] });
  });

  it('une cession exige le prix de chaque bien coché, lu à la virgule et aux espaces', () => {
    expect(corpsSortieGlobale({ a: { choisi: true, prix: '150 000,50' }, b: { choisi: true, prix: '0' } }, 'CESSION')).toEqual({
      biens: [
        { immobilisationId: 'a', prixCession: 150_000.5 },
        { immobilisationId: 'b', prixCession: 0 },
      ],
    });
    expect(corpsSortieGlobale({ a: { choisi: true, prix: '' }, b: { choisi: true, prix: 'douze' } }, 'CESSION')).toEqual({
      motif: expect.stringContaining('2 prix de cession'),
    });
  });

  it('un seul bien coché ne fait pas un lot', () => {
    expect(corpsSortieGlobale({ a: { choisi: true, prix: '' } }, 'MISE_HORS_SERVICE')).toEqual({ motif: expect.any(String) });
  });
});
