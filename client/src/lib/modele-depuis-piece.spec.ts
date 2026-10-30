// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { motifRefusFonctions } from '../../../src/modules/modeles-saisie/fonctions-modele';
import { lignesDuModele, motifRefusModeleDepuisPiece, type LigneDeLaPiece } from './modele-depuis-piece';

/** Ligne gl-saisie, fonction 15 · créer un modèle de saisie depuis la pièce en cours. */
describe('modèle depuis la pièce', () => {
  const achat: LigneDeLaPiece[] = [
    { compteId: 'c605', libelle: 'Électricité mars', debit: 100000, credit: 0 },
    { compteId: 'c445', libelle: 'TVA', debit: 16000, credit: 0, tauxTvaId: 't16' },
    { compteId: 'c401', libelle: 'Électricité mars', debit: 0, credit: 116000 },
  ];

  it('la charge se saisit, la taxe se calcule à son taux, le fournisseur équilibre', () => {
    const l = lignesDuModele(achat, { garderLesMontants: false, derniereEquilibre: true });
    expect(l.map((x) => [x.compteId, x.sens, x.fonction, x.montant, x.tauxTvaId])).toEqual([
      ['c605', 'DEBIT', 'SAISIR', undefined, undefined],
      ['c445', 'DEBIT', 'CALCULER', undefined, 't16'],
      ['c401', 'CREDIT', 'EQUILIBRER', undefined, undefined],
    ]);
  });

  it('les montants ne se figent qu’à la demande, et seulement sur les lignes « Saisir »', () => {
    const l = lignesDuModele(achat, { garderLesMontants: true, derniereEquilibre: false });
    expect(l.map((x) => [x.fonction, x.montant])).toEqual([
      ['SAISIR', 100000],
      ['CALCULER', undefined],
      ['SAISIR', 116000],
    ]);
  });

  it('ce que la traduction rend passe les règles des fonctions du serveur, dans tous les cas', () => {
    for (const garderLesMontants of [true, false]) {
      for (const derniereEquilibre of [true, false]) {
        expect(motifRefusFonctions(lignesDuModele(achat, { garderLesMontants, derniereEquilibre }))).toBeNull();
      }
    }
    // Une taxe en tête n'a rien à calculer · elle se saisit, sans taux.
    const enTete = lignesDuModele([achat[1], achat[0], achat[2]], { garderLesMontants: false, derniereEquilibre: true });
    expect(enTete[0]).toMatchObject({ fonction: 'SAISIR' });
    expect(enTete[0].tauxTvaId).toBeUndefined();
    expect(motifRefusFonctions(enTete)).toBeNull();
  });

  it('refuse avant l’envoi une pièce trop courte ou sans intitulé', () => {
    expect(motifRefusModeleDepuisPiece('Électricité', achat.slice(0, 1))).toMatch(/deux lignes/);
    expect(motifRefusModeleDepuisPiece(' ', achat)).toMatch(/intitulé/);
    expect(motifRefusModeleDepuisPiece('Électricité', achat)).toBeNull();
  });
});
