// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import {
  imputationDuReglement,
  montantRegle,
  motifDePart,
  motifPieceImputation,
  nomDeFacture,
  partsServies,
  reprendreLesParts,
  sommeDesParts,
  type FactureCochee,
} from './imputation-reglement';

/** Jumeau 3 du point 4 (décision par la loi du 2026-10-07) · Code civil, Livre III, art. 151. */
const f1: FactureCochee = { id: 'f1', montant: 600, journalCode: 'AC', numeroPiece: 12 };
const f2: FactureCochee = { id: 'f2', montant: 400, journalCode: 'AC', numeroPiece: 15 };
const lignes = [f1, f2];

describe('la part de chaque facture d’un règlement fournisseur', () => {
  it('aucune part · rien n’est envoyé (imputation légale, dite par le serveur)', () => {
    expect(imputationDuReglement({ lignes, parts: {}, montantSaisi: '500' })).toEqual({});
  });

  it('toutes les parts · l’imputation et le montant, somme des parts', () => {
    expect(imputationDuReglement({ lignes, parts: { f1: '100', f2: '400,00' }, montantSaisi: undefined })).toEqual({
      imputation: [
        { ligneId: 'f1', montant: 100 },
        { ligneId: 'f2', montant: 400 },
      ],
      montant: 500,
    });
  });

  it('une part manquante, illisible, nulle, au-delà du dû, ou une somme qui diffère · motif nommé, la facture désignée', () => {
    expect(imputationDuReglement({ lignes, parts: { f1: '100' }, montantSaisi: undefined }).motif).toBe('Donnez la part de chaque facture cochée, ou d’aucune.');
    expect(imputationDuReglement({ lignes, parts: { f1: 'cent', f2: '10' }, montantSaisi: undefined }).motif).toBe('La part de pièce AC 12 est illisible (« cent »).');
    expect(imputationDuReglement({ lignes, parts: { f1: '0', f2: '10' }, montantSaisi: undefined }).motif).toBe(
      'La part de pièce AC 12 doit être un montant strictement positif.',
    );
    expect(imputationDuReglement({ lignes, parts: { f1: '100', f2: '400,01' }, montantSaisi: undefined }).motif).toMatch(/^La part de pièce AC 15 \(400,01\) dépasse son dû \(400,00\)\.$/);
    expect(imputationDuReglement({ lignes, parts: { f1: '100', f2: '300' }, montantSaisi: '500' }).motif).toMatch(/^La somme des parts \(400,00\) diffère du montant réglé \(500,00\)\.$/);
    expect(imputationDuReglement({ lignes, parts: { f1: '100', f2: '300' }, montantSaisi: 'x' }).motif).toBe('Le montant réglé est illisible (« x »).');
  });

  it('le champ « Part » · fournisseur, deux factures au moins, ni devise ni à cheval, le motif dit sinon', () => {
    expect(partsServies({ sens: 'FOURNISSEUR', cochees: lignes })).toEqual({ servies: true, motif: null });
    expect(partsServies({ sens: 'CLIENT', cochees: lignes })).toEqual({ servies: false, motif: null });
    expect(partsServies({ sens: 'FOURNISSEUR', cochees: [f1] })).toEqual({ servies: false, motif: null });
    expect(partsServies({ sens: 'FOURNISSEUR', cochees: [f1, { ...f2, deviseId: 'usd' }] }).motif).toContain('Facture en devise');
    expect(partsServies({ sens: 'FOURNISSEUR', cochees: [f1, { ...f2, regleParLettrageACheval: { groupe: 'A', montant: 1 } }] }).motif).toContain('à cheval');
  });

  it('« Réglé » et la somme des parts se lisent par la même règle', () => {
    expect(montantRegle('')).toEqual({});
    expect(montantRegle('1 000,5')).toEqual({ montant: 1000.5 });
    expect(montantRegle('-3').motif).toBe('Le montant réglé doit être un montant strictement positif.');
    expect(sommeDesParts(lignes, { f1: '100', f2: 'x' })).toBe(100);
    expect(sommeDesParts(lignes, {})).toBeNull();
    expect(motifDePart(f1, '')).toBeNull();
  });

  it('une part ne disparaît pas sans un mot · reprise dans « Réglé » vide, ou retirée en le disant', () => {
    const repris = reprendreLesParts({ lignes, restantes: [f1], parts: { f1: '250', f2: '300', autre: '9' }, montantSaisi: '' });
    expect(repris).toEqual({ parts: { autre: '9' }, montantSaisi: '250', constat: 'La part saisie de pièce AC 12 (250) est reprise dans « Réglé ».' });
    const retire = reprendreLesParts({ lignes, restantes: [f1], parts: { f1: '250' }, montantSaisi: '300' });
    expect(retire.constat).toBe('La part saisie de pièce AC 12 (250) est retirée · « Réglé » garde 300.');
    expect(retire.montantSaisi).toBe('300');
    const f3: FactureCochee = { id: 'f3', montant: 10, libelle: 'Loyer' };
    const gardees = reprendreLesParts({ lignes: [f1, f2, f3], restantes: [f1, f3], parts: { f1: '1', f2: '2', f3: '3' }, montantSaisi: '' });
    expect(gardees).toEqual({ parts: { f1: '1', f3: '3' }, montantSaisi: '', constat: null });
    expect(nomDeFacture(f3)).toBe('« Loyer »');
  });

  it('M6 · la pièce qui notifie l’imputation, exigée sans ordre de virement', () => {
    expect(motifPieceImputation({ avecParts: true, ordreVirement: false, pieceImputation: '' })).toContain('Préparez l’ordre de virement');
    expect(motifPieceImputation({ avecParts: true, ordreVirement: true, pieceImputation: '' })).toBeNull();
    expect(motifPieceImputation({ avecParts: true, ordreVirement: false, pieceImputation: 'Lettre L-14' })).toBeNull();
    expect(motifPieceImputation({ avecParts: false, ordreVirement: false, pieceImputation: '' })).toBeNull();
  });
});
