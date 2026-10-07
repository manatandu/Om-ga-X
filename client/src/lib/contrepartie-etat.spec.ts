import { comptesDeFondsProjet } from './contrepartie-etat';
import type { Compte } from './types';

const compte = (numero: string, typeCompte: 'DETAIL' | 'TOTAL' = 'DETAIL') =>
  ({ id: numero, numero, intitule: numero, typeCompte, bailleurId: null }) as unknown as Compte;

describe('Contrepartie de l’État · les comptes candidats (Q2)', () => {
  it('ne propose que les comptes de détail 51, 52, 53, 55 et 57, comme le serveur', () => {
    const r = comptesDeFondsProjet([
      compte('51210000'),
      compte('52110000'),
      compte('53110000'),
      compte('55100000'),
      compte('57100000'),
      compte('57', 'TOTAL'),
      compte('56100000'),
      compte('46300000'),
    ]);
    expect(r.map((c) => c.numero)).toEqual(['51210000', '52110000', '53110000', '55100000', '57100000']);
  });
});
