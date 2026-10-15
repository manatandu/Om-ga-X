import { journauxDuMode, lireCoupures, type JournalDePaiement } from './paiement-salaires';

const j = (code: string, compte: string | null, caisse: boolean): JournalDePaiement => ({ id: code, code, intitule: code, compte, caisse, devise: null });

describe('paiement des salaires · ce que l’écran choisit', () => {
  it('une caisse pour les espèces, une banque pour le virement et le chèque', () => {
    const journaux = [j('BQ', '52110000', false), j('CA', '57110000', true), j('XX', null, false)];
    expect(journauxDuMode(journaux, 'ESPECES').map((x) => x.code)).toEqual(['CA']);
    expect(journauxDuMode(journaux, 'VIREMENT').map((x) => x.code)).toEqual(['BQ']);
    expect(journauxDuMode(journaux, 'CHEQUE').map((x) => x.code)).toEqual(['BQ']);
  });

  it('lit les coupures tapées, la virgule décimale comprise, et dit une valeur illisible', () => {
    expect(lireCoupures('20000 10000; 5000  0,50')).toEqual([20000, 10000, 5000, 0.5]);
    expect(lireCoupures('   ')).toEqual([]);
    expect(lireCoupures('20000 dix')).toBeNull();
    expect(lireCoupures('20000 -5')).toBeNull();
  });
});
