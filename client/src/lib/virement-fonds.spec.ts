import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIBELLES_NATURE_PIECE, LIBELLES_OPERATION, NATURES_PROPOSEES, caisseEnJeu, naturesDeLaPiece, sensDuVirement } from './virement-fonds';

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

  it('chaque nature de pièce porte le libellé du serveur, et le serveur n’en a pas d’autre', () => {
    // Un libellé à apostrophe s'écrit entre guillemets doubles des deux côtés.
    const litteral = (l: string) => (l.includes("'") ? `"${l}"` : `'${l}'`);
    for (const [n, l] of Object.entries(LIBELLES_NATURE_PIECE)) expect(serveur).toContain(`${n}: ${litteral(l)}`);
    const naturesServeur = [...serveur.matchAll(/^\s{2}([A-Z_]+): (?:'[^']+'|"[^"]+"),$/gm)].map((m) => m[1]).filter((n) => n in LIBELLES_NATURE_PIECE);
    expect(Object.keys(LIBELLES_NATURE_PIECE).sort()).toEqual([...new Set(naturesServeur)].sort());
  });

  it('les pièces proposées par trésorerie et par opération sont celles du serveur, dans son ordre', () => {
    const bloc = serveur.slice(serveur.indexOf('export const NATURES_PROPOSEES'), serveur.indexOf('export function naturesProposees'));
    const lu: Record<string, Record<string, string[]>> = {};
    for (const [, tresorerie, corps] of bloc.matchAll(/^ {2}(CAISSE|BANQUE): \{([\s\S]*?)^ {2}\},$/gm)) {
      lu[tresorerie] = {};
      for (const [, operation, liste] of corps.matchAll(/(SORTIE|ENTREE): \[([\s\S]*?)\]/g)) {
        lu[tresorerie][operation] = [...liste.matchAll(/NaturePieceVirement\.([A-Z_]+)/g)].map((m) => m[1]);
      }
    }
    expect(lu).toEqual(JSON.parse(JSON.stringify(NATURES_PROPOSEES)));
  });

  it('une caisse propose ses bons, une banque ses pièces, « Autre pièce » toujours en dernier', () => {
    expect(naturesDeLaPiece('57110000', 'SORTIE')).toEqual(['BON_SORTIE_CAISSE', 'AUTRE']);
    expect(naturesDeLaPiece('57110000', 'ENTREE')).toEqual(['BON_ENTREE_CAISSE', 'AUTRE']);
    expect(naturesDeLaPiece('52110000', 'SORTIE')).toEqual(['ORDRE_VIREMENT', 'CHEQUE', 'AVIS_DEBIT', 'EXTRAIT_COMPTE', 'AUTRE']);
    expect(naturesDeLaPiece('52110000', 'ENTREE')).toEqual(['BORDEREAU_VERSEMENT', 'BORDEREAU_REMISE_CHEQUE', 'AVIS_CREDIT', 'EXTRAIT_COMPTE', 'AUTRE']);
    for (const parOperation of Object.values(NATURES_PROPOSEES)) for (const liste of Object.values(parOperation)) expect(liste[liste.length - 1]).toBe('AUTRE');
  });

  it('sans banque ni caisse choisie, rien n’est proposé ; les natures d’avant se lisent sans être proposées', () => {
    expect(naturesDeLaPiece(null, 'SORTIE')).toEqual([]);
    const proposees = new Set(Object.values(NATURES_PROPOSEES).flatMap((p) => Object.values(p).flat()));
    for (const ancienne of ['BON_CAISSE', 'AVIS_DEBIT_CREDIT'] as const) {
      expect(proposees.has(ancienne)).toBe(false);
      expect(LIBELLES_NATURE_PIECE[ancienne]).toBeTruthy();
    }
  });

  it('les deux opérations, sortie et entrée, portent le libellé du serveur', () => {
    expect(Object.keys(LIBELLES_OPERATION)).toEqual(['SORTIE', 'ENTREE']);
    for (const [o, l] of Object.entries(LIBELLES_OPERATION)) expect(serveur).toContain(`${o}: '${l}'`);
  });
});
