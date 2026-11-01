import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClasseCompte } from '@prisma/client';
import { type LigneBalanceFpm, virementDeClotureAuxMouvements } from './balance-fpm';

/**
 * RELEVÉS DU PAQUET 1, LIGNE A, VOISIN A4 · « Mouvements au <veille> » de la
 * balance FPM portait le virement du résultat antérieur non affecté, que la
 * clôture date du DERNIER jour · le 12 et le 13 s'y lisaient déjà virés.
 */
const ligne = (compteId: string, numero: string, avantDebit: number, avantCredit: number): LigneBalanceFpm => ({
  compteId,
  numero,
  intitule: numero,
  classe: ClasseCompte.CLASSE_1,
  avantDebit,
  avantCredit,
  mouvementDebit: 0,
  mouvementCredit: 0,
  totalDebit: avantDebit,
  totalCredit: avantCredit,
});

describe('balance FPM · le virement de clôture du 13 n’est pas « au <veille> »', () => {
  it('le 13 et le 121 gardent l’ouverture, le virement passe aux mouvements, les totaux restent', () => {
    // Ouverture · 13 créditeur de 500 000 ; virement au dernier jour, D 13 / C 121.
    const brutes = [ligne('c13', '13100000', 500_000, 500_000), ligne('c121', '12100000', 0, 500_000)];
    const avant = new Map([
      ['c13', { reportDebit: 0, reportCredit: 500_000 }],
      ['c121', { reportDebit: 0, reportCredit: 0 }],
    ]);
    const [l13, l121] = virementDeClotureAuxMouvements(brutes, avant);
    expect([l13.avantDebit, l13.avantCredit, l13.mouvementDebit, l13.mouvementCredit]).toEqual([0, 500_000, 500_000, 0]);
    expect([l121.avantDebit, l121.avantCredit, l121.mouvementDebit, l121.mouvementCredit]).toEqual([0, 0, 0, 500_000]);
    expect([l13.totalDebit, l13.totalCredit, l121.totalCredit]).toEqual([500_000, 500_000, 500_000]);
  });

  it('la balance exportée et les feuilles BALANCE de la liasse lisent le report avant la clôture', () => {
    const fpm = readFileSync(join(__dirname, 'export-fpm.service.ts'), 'utf8');
    const liasse = readFileSync(join(__dirname, 'export.service.ts'), 'utf8');
    for (const source of [fpm, liasse]) {
      expect(source).toMatch(/\{ avantLaCloture: true \}/);
      expect(source).toMatch(/virementDeClotureAuxMouvements\(/);
    }
  });
});
