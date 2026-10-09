import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { montantDuPosteDeFlux, postesParMotif } from './postes-de-flux-vides';

/**
 * PAQUET 1, A7 · le serveur laisse vides les postes du tableau des flux des
 * associations qu'une ouverture passée en OD au premier jour rend illisibles,
 * et les sert à 0 · l'écran les écrit « · » et dit leur motif, une fois par
 * motif. Les specs client ne chargent pas React (`specs-sans-react.spec.ts`)
 * · la page se lit sur sa source.
 */
describe('postes du tableau des flux laissés vides', () => {
  it('un poste vide n’a pas de montant à l’écran, les autres gardent le leur, zéro compris', () => {
    expect(montantDuPosteDeFlux('FM', 0, ['ZA', 'FM'])).toBeUndefined();
    expect(montantDuPosteDeFlux('FA', 0, ['ZA', 'FM'])).toBe(0);
    expect(montantDuPosteDeFlux('FA', 1200, undefined)).toBe(1200);
  });

  it('un même motif se dit une fois, ses postes dans l’ordre du tableau', () => {
    expect(
      postesParMotif([
        { ref: 'ZA', raison: 'OD n° 1' },
        { ref: 'FA', raison: 'OD n° 1' },
        { ref: 'FM', raison: 'OD n° 1' },
        { ref: 'FI', raison: 'autre' },
      ]),
    ).toEqual([
      { refs: ['ZA', 'FA', 'FM'], raison: 'OD n° 1' },
      { refs: ['FI'], raison: 'autre' },
    ]);
    expect(postesParMotif(undefined)).toEqual([]);
  });

  it('l’écran des associations écrit ses postes vides par cette règle et en dit le motif, colonne N et colonne N-1', () => {
    const page = readFileSync(join(__dirname, '..', 'pages', 'EtatsFinanciersPage.tsx'), 'utf8');
    expect(page).toMatch(/montant\(montantDuPosteDeFlux\(l\.ref, l\.montant, vides\)\)/);
    expect(page).toContain('ligneFlux(l, tft.postesVides)');
    expect(page).toContain('postesParMotif(tft.postesNonCalculables)');
    expect(page).toContain('postesParMotif(tft.postesNonCalculablesN1)');
  });
});
