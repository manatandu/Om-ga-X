import { describe, expect, it } from 'vitest';
import { numeroAEnvoyer, type NumeroPropose } from './numero-compte-tiers';

const propose: NumeroPropose = { numero: '41110002', collectif: '41110000', longueur: 8, motif: null };

describe('numéro du compte principal envoyé à la création du tiers', () => {
  it('la proposition gardée ne part pas · le serveur prend le premier libre au moment de créer', () => {
    expect(numeroAEnvoyer('41110002', propose)).toBeUndefined();
    expect(numeroAEnvoyer(' 41110002 ', propose)).toBeUndefined();
  });

  it('un champ vidé ne part pas, un numéro changé part tel quel, sans espaces', () => {
    expect(numeroAEnvoyer('', propose)).toBeUndefined();
    expect(numeroAEnvoyer('   ', propose)).toBeUndefined();
    expect(numeroAEnvoyer(' 41110250 ', propose)).toBe('41110250');
  });

  it('sans proposition lue, le numéro saisi part, et le serveur le juge', () => {
    expect(numeroAEnvoyer('41110250', null)).toBe('41110250');
    expect(numeroAEnvoyer('4111ABC', { ...propose, numero: null })).toBe('4111ABC');
  });
});
