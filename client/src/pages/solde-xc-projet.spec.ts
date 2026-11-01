import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SECOND TOUR DU PAQUET 1, LIGNE A, VOISIN A9 · le solde XC du compte
 * d'exploitation d'un projet se DIT, il n'est pas une égalité du texte
 * (Partie 4 ch. 3 l'imprime « (+excédent, -déficit) »). Le classeur le disait
 * ainsi depuis A9 ; l'écran disait encore « (≈ 0) · régime normal ».
 */
describe('compte d’exploitation du projet · le solde XC se dit, sans verdict', () => {
  it('l’écran ne juge plus le zéro « régime normal »', () => {
    const source = readFileSync(join(__dirname, 'EtatsFinanciersPage.tsx'), 'utf8');
    expect(source).not.toMatch(/régime normal pour ce jeu/);
    expect(source).toContain("Solde des opérations de l'exercice : XC = ${montant(ceProjet.solde)}");
    expect(source).toContain('à expliquer en Notes (produit ou charge hors de la neutralisation par le 702)');
  });
});
