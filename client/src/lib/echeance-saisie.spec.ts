// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { centimesSaisis, decouperLigne, echeancesSaisissables, motifEcheancesSaisies, porteUneEcheance } from './echeance-saisie';

/**
 * LA LIGNE DÉCOUPÉE PAR L'ÉCHÉANCIER (ligne sage-l2, fonction 3) · ce que ces
 * tests empêchent · une pièce qui ne s'équilibre plus parce que les
 * échéances retouchées ne refont pas la ligne au centime, une échéance à zéro
 * devenue ligne vide, une facture au crédit découpée au débit.
 */
describe('la zone de l’échéance', () => {
  it('ne s’ouvre que sur un compte de tiers', () => {
    expect(porteUneEcheance('40110001')).toBe(true);
    expect(porteUneEcheance('60110000')).toBe(false);
    expect(porteUneEcheance(null)).toBe(false);
  });
});

describe('les échéances retouchées', () => {
  const e = (montant: string, dateEcheance = '2027-01-09', modeReglementId = '') => ({ montant, dateEcheance, modeReglementId });

  it('un montant tapé avec espaces et virgule se lit au centime', () => {
    expect(centimesSaisis('580 000,50')).toBe(58_000_050);
    expect(centimesSaisis('12.345')).toBeNull();
    expect(centimesSaisis('abc')).toBeNull();
  });

  it('refont la ligne au centime, sinon l’écart est dit', () => {
    expect(motifEcheancesSaisies([e('580000'), e('580000')], 1_160_000)).toBeNull();
    expect(motifEcheancesSaisies([e('580000'), e('579999.99')], 1_160_000)).toContain('écart de 0,01');
  });

  it('une échéance à zéro, illisible ou sans date est refusée', () => {
    expect(motifEcheancesSaisies([e('0'), e('1160000')], 1_160_000)).toContain('positif');
    expect(motifEcheancesSaisies([e('x')], 1_160_000)).toContain('illisible');
    expect(motifEcheancesSaisies([e('1160000', '')], 1_160_000)).toContain('date');
  });

  it('une ligne par échéance, au sens de la ligne d’origine, chacune sa date et son mode', () => {
    const ligne = { compteId: 'c', libelle: 'Facture', debit: 0, credit: 1_160_000, cle: 'k' };
    const r = decouperLigne(ligne, [e('580000', '2027-01-09', 'mVir'), e('580000', '2027-02-08')], (id) => (id === 'mVir' ? 'VIR' : undefined));
    expect(r).toEqual([
      { compteId: 'c', libelle: 'Facture', debit: 0, credit: 580_000, cle: 'k', dateEcheance: '2027-01-09', modeReglementId: 'mVir', modeCode: 'VIR' },
      { compteId: 'c', libelle: 'Facture', debit: 0, credit: 580_000, cle: 'k-2', dateEcheance: '2027-02-08', modeReglementId: undefined, modeCode: undefined },
    ]);
  });

  it('le mode choisi à la main sur la ligne prime sur celui du modèle', () => {
    const ech = [{ ordre: 1, montant: 100, dateEcheance: '2027-01-09', modeReglementId: 'mVir', modeCode: 'VIR' }];
    expect(echeancesSaisissables(ech, 'mChq')[0].modeReglementId).toBe('mChq');
    expect(echeancesSaisissables(ech, undefined)[0]).toEqual({ montant: '100.00', dateEcheance: '2027-01-09', modeReglementId: 'mVir' });
  });
});
