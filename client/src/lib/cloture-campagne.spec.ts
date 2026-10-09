import { peutCloreLaCampagne } from './cloture-campagne';
import type { FicheInventaire, ProcesVerbalCaisse } from './types';

/**
 * Le bouton « Clore la campagne » (paquet 1, B10) · une campagne qui ne
 * compte que sa caisse restait au recensement, le bouton n'existant qu'à
 * l'arbitrage, que seul un rapprochement de fiches atteint.
 */
const FICHE = { id: 'f1' } as FicheInventaire;
const PV = { id: 'pv1' } as ProcesVerbalCaisse;

describe('peutCloreLaCampagne', () => {
  it("à l'arbitrage, toujours (chemin des fiches rapprochées)", () => {
    expect(peutCloreLaCampagne({ statut: 'ARBITRAGE', fiches: [FICHE], pvComptageCaisse: [] })).toBe(true);
  });

  it('au recensement, une campagne de caisses seules (aucune fiche, au moins un PV)', () => {
    expect(peutCloreLaCampagne({ statut: 'RECENSEMENT', fiches: [], pvComptageCaisse: [PV] })).toBe(true);
  });

  it('au recensement avec une fiche · le rapprochement passe avant', () => {
    expect(peutCloreLaCampagne({ statut: 'RECENSEMENT', fiches: [FICHE], pvComptageCaisse: [PV] })).toBe(false);
  });

  it("au recensement sans rien de compté · aucun inventaire n'est dressé", () => {
    expect(peutCloreLaCampagne({ statut: 'RECENSEMENT', fiches: [], pvComptageCaisse: [] })).toBe(false);
  });

  it('listes non lues · rien n\'est promis', () => {
    expect(peutCloreLaCampagne({ statut: 'RECENSEMENT' })).toBe(false);
  });

  it('en préparation et clôturée, jamais', () => {
    expect(peutCloreLaCampagne({ statut: 'PREPARATION', fiches: [], pvComptageCaisse: [PV] })).toBe(false);
    expect(peutCloreLaCampagne({ statut: 'CLOTUREE', fiches: [], pvComptageCaisse: [PV] })).toBe(false);
  });
});
