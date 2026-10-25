import { etatDuCheque, motifRefusChequier, motifRefusNumero, numeroImprime, prochainNumeroLibre } from './cheques';

/**
 * REGISTRE DES CHÈQUES ÉMIS (ligne microfina-m2, idée 9). Ce qui casserait en
 * silence · deux carnets qui se recouvrent (deux chèques sous un numéro), un
 * chèque dit encaissé sans que la banque l'ait débité.
 */
describe('le registre des chèques émis · règles pures', () => {
  it('le numéro imprimé garde ses zéros de tête', () => {
    expect(numeroImprime(42, 7)).toBe('0000042');
  });

  it('un carnet ne chevauche aucun autre carnet du même compte', () => {
    expect(motifRefusChequier(101, 150, 7, [{ numeroDebut: 51, numeroFin: 100 }])).toBeNull();
    expect(motifRefusChequier(100, 150, 7, [{ numeroDebut: 51, numeroFin: 100 }])).toMatch(/chevauche/);
    expect(motifRefusChequier(150, 101, 7, [])).toMatch(/précède/);
    expect(motifRefusChequier(1, 100000, 4, [])).toMatch(/ne tient pas sur 4 chiffres/);
    expect(motifRefusChequier(0, 10, 4, [])).toMatch(/positifs/);
  });

  it('un numéro hors du carnet est refusé', () => {
    expect(motifRefusNumero(50, { numeroDebut: 51, numeroFin: 100 })).toMatch(/pas dans le carnet/);
    expect(motifRefusNumero(51, { numeroDebut: 51, numeroFin: 100 })).toBeNull();
  });

  it('le prochain numéro libre parcourt les numéros servis, jamais la plage', () => {
    const carnet = { numeroDebut: 51, numeroFin: 2_000_000_000 };
    expect(prochainNumeroLibre(carnet, [])).toBe(51);
    expect(prochainNumeroLibre(carnet, [51, 52, 54])).toBe(53);
    expect(prochainNumeroLibre({ numeroDebut: 1, numeroFin: 2 }, [1, 2])).toBeNull();
  });

  it("ENCAISSÉ se lit au rapprochement · toutes les lignes de banque de la pièce pointées, et rien d'autre", () => {
    expect(etatDuCheque({ etat: 'ANNULE', aUnePiece: false, lignesBanque: 0, lignesPointees: 0 })).toBe('ANNULE');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: false, lignesBanque: 0, lignesPointees: 0 })).toBe('EMIS_SANS_PIECE');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: true, lignesBanque: 1, lignesPointees: 0 })).toBe('EN_CIRCULATION');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: true, lignesBanque: 2, lignesPointees: 1 })).toBe('EN_CIRCULATION');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: true, lignesBanque: 0, lignesPointees: 0 })).toBe('EN_CIRCULATION');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: true, lignesBanque: 1, lignesPointees: 1 })).toBe('ENCAISSE');
  });
});

describe('routes du registre des chèques', () => {
  it('`numeros/annulation` est déclarée avant `:id/annulation` · sinon Express la lit comme le chèque « numeros »', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ChequesController } = require('./cheques.controller');
    const methodes = Object.getOwnPropertyNames(ChequesController.prototype);
    const chemin = (m: string) => Reflect.getMetadata('path', ChequesController.prototype[m]);
    expect(chemin('annulerNumero')).toBe('numeros/annulation');
    expect(chemin('annuler')).toBe(':id/annulation');
    expect(methodes.indexOf('annulerNumero')).toBeLessThan(methodes.indexOf('annuler'));
  });
});
