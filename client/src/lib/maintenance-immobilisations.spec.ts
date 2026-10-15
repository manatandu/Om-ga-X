import { PARAMETRES_INITIAUX, requeteRenumerotation } from './maintenance-immobilisations';

/**
 * RENUMÉROTATION DES BIENS (ligne sage-l4, n° 73) · ce que l'écran envoie.
 * Ce qui casserait en silence · un préfixe à « / » ou « & » coupé dans la
 * requête de l'aperçu (l'aperçu ne dirait pas la renumérotation confirmée),
 * tout le parc renuméroté par défaut.
 */
describe('la requête de l’aperçu', () => {
  it('encode le préfixe et chaque paramètre', () => {
    const q = new URLSearchParams(requeteRenumerotation({ ...PARAMETRES_INITIAUX, prefixe: 'A/B&C', premierNumero: ' 7 ' }));
    expect(q.get('prefixe')).toBe('A/B&C');
    expect(q.get('premierNumero')).toBe('7');
    expect(q.get('largeur')).toBe('4');
  });

  it('les biens sans numéro d’abord · tout le parc n’est jamais le défaut', () => {
    expect(PARAMETRES_INITIAUX.perimetre).toBe('SANS_NUMERO');
  });
});
