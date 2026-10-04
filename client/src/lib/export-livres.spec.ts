// Pas d'import de « vitest » · convention du dépôt (voir calcul.spec.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  adresseGrandLivreDuCompte,
  cheminBalance,
  cheminBalanceTiers,
  cheminGrandLivre,
  cheminGrandLivreTiers,
  compteDeLAdresse,
} from './export-livres';

/**
 * LES ADRESSES DES EXPORTS DE LIVRES (ligne FPM) · la présentation du cabinet
 * et les feuilles par compte sont le DÉFAUT, aucun paramètre ne part tant que
 * l'utilisateur n'a pas choisi l'autre voie.
 */
describe('exports des balances et grands livres', () => {
  it('le grand livre sort dans la présentation du cabinet sans paramètre, à plat sur demande', () => {
    expect(cheminGrandLivre('ex', 'fpm')).toBe('/exports/grand-livre?exerciceId=ex');
    expect(cheminGrandLivre('ex', 'plat')).toBe('/exports/grand-livre?exerciceId=ex&format=plat');
  });

  it('la balance porte les feuilles par compte, sauf balance seule', () => {
    expect(cheminBalance('ex', false)).toBe('/exports/balance?exerciceId=ex');
    expect(cheminBalance('ex', true)).toBe('/exports/balance?exerciceId=ex&grandsLivres=non');
    expect(cheminBalanceTiers('ex', 'SALARIES', false)).toBe('/exports/balance-auxiliaire?exerciceId=ex&type=SALARIES');
    expect(cheminGrandLivreTiers('ex', 'AUTRES')).toBe('/exports/grand-livre-tiers?exerciceId=ex&type=AUTRES');
  });

  it('le double-clic d’une balance des tiers ouvre le grand livre filtré sur le compte, que l’adresse rend', () => {
    const adresse = adresseGrandLivreDuCompte('c-401');
    expect(adresse).toBe('/journal?onglet=grand-livre&compte=c-401');
    expect(compteDeLAdresse(adresse)).toBe('c-401');
    expect(compteDeLAdresse('/journal?onglet=balance')).toBeNull();
    expect(compteDeLAdresse(undefined)).toBeNull();
  });

  it('les écrans appellent ces adresses, jamais une adresse recopiée', () => {
    const journal = readFileSync(join(__dirname, '..', 'pages', 'JournalPage.tsx'), 'utf8');
    const tiers = readFileSync(join(__dirname, '..', 'pages', 'BalanceAuxiliairePage.tsx'), 'utf8');
    expect(journal).toContain('cheminBalance(exerciceCourant.id, balanceSeule)');
    expect(journal).toContain('cheminGrandLivre(exerciceCourant.id, formatGrandLivre)');
    expect(journal).toContain('onDoubleClick');
    expect(tiers).toContain('cheminBalanceTiers(exerciceCourant.id, famille, balanceSeule)');
    expect(tiers).toContain('navigate(adresseGrandLivreDuCompte(c.compteId))');
  });
});
