// Aucun import de « vitest » · convention du dépôt (jest relit aussi les specs du client).
import { corpsMouvement, valeurUnitaireLue } from './titres-placement-saisie';

const bon = { journalBanqueId: 'j', date: '2026-03-02', quantite: '12,5', prix: '1 050 000', frais: '', reference: ' AO-12 ' };

describe('saisie d’un titre de placement', () => {
  it('lit parts, prix et frais à la française, frais absents laissés nuls', () => {
    expect(corpsMouvement(bon)).toEqual({ corps: { journalBanqueId: 'j', date: '2026-03-02', quantite: 12.5, prix: 1_050_000, frais: null, reference: 'AO-12' } });
  });
  it('refuse le point des milliers, jamais lu comme une décimale', () => {
    expect(corpsMouvement({ ...bon, prix: '1.050.000' })).toHaveProperty('refus');
    expect(valeurUnitaireLue('98.000')).toHaveProperty('refus');
  });
  it('nomme ce qui manque', () => {
    expect(corpsMouvement({ ...bon, journalBanqueId: '' })).toEqual({ refus: expect.stringMatching(/journal/) });
    expect(corpsMouvement({ ...bon, quantite: '0' })).toEqual({ refus: expect.stringMatching(/parts/) });
    expect(corpsMouvement({ ...bon, frais: 'dix' })).toEqual({ refus: expect.stringMatching(/frais/i) });
    expect(corpsMouvement({ ...bon, reference: ' ' })).toEqual({ refus: expect.stringMatching(/référence/) });
  });
  it('une valeur nulle est une réponse', () => {
    expect(valeurUnitaireLue('0')).toEqual({ corps: 0 });
  });
});

describe('nombre de parts au point des milliers', () => {
  it('« 1.000 » est refusé, jamais lu 1 part', () => {
    expect(corpsMouvement({ journalBanqueId: 'j', date: '2026-03-02', quantite: '1.000', prix: '1 000', frais: '', reference: 'AO' })).toEqual({ refus: expect.stringMatching(/ambigu/) });
  });
});
