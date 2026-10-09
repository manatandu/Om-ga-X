import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIBELLES_NATURE_PIECE, NATURES_PIECE, caisseEnJeu, sensDuVirement } from './virement-fonds';

// Aucun import de « vitest » (globales) · convention du dépôt.

/**
 * MIROIR DU SERVEUR · le sens et les libellés de pièce affichés avant l'envoi
 * sont ceux que le serveur retient (src/modules/virements-fonds/virement-fonds.ts).
 */
const serveur = readFileSync(join(__dirname, '../../../src/modules/virements-fonds/virement-fonds.ts'), 'utf8');

describe('virement de fonds · le sens, comme au serveur', () => {
  it.each([
    ['52110000', '52120000', 'BANQUE_BANQUE'],
    ['52110000', '57110000', 'BANQUE_CAISSE'],
    ['57110000', '52110000', 'CAISSE_BANQUE'],
    ['57110000', '57120000', 'CAISSE_CAISSE'],
    ['53100000', '55100000', 'BANQUE_BANQUE'],
  ])('%s vers %s · %s', (o, d, sens) => {
    expect(sensDuVirement(o, d)).toBe(sens);
  });

  it('le porteur n’est exigé qu’avec une caisse', () => {
    expect(caisseEnJeu('BANQUE_BANQUE')).toBe(false);
    expect(caisseEnJeu('CAISSE_BANQUE')).toBe(true);
  });

  it('la caisse se reconnaît au 57 des deux côtés', () => {
    expect(serveur).toMatch(/return numeroCompte\.startsWith\('57'\);/);
  });

  it('chaque nature de pièce porte le libellé du serveur, et toutes sont proposées', () => {
    for (const n of NATURES_PIECE) expect(serveur).toContain(`${n}: '${LIBELLES_NATURE_PIECE[n]}'`);
    const naturesServeur = [...serveur.matchAll(/^\s{2}([A-Z_]+): '[^']+',$/gm)].map((m) => m[1]).filter((n) => n in LIBELLES_NATURE_PIECE);
    expect([...NATURES_PIECE].sort()).toEqual([...new Set(naturesServeur)].sort());
  });
});
