import { apparierRubriques } from './rubrique-de-ligne';
import { NOTES_ASSOCIATIONS } from './correspondance-notes-associations';
import { NOTES_PROJETS } from './correspondance-notes-projets';
import type { SpecificationNote } from './note-annexe.types';

/**
 * LA RUBRIQUE D'UNE LIGNE SERVIE (relecture du 2026-11-01, mineur 3) · sans
 * clé, « Intérêts courus » est deux fois dans la note 18A des associations et
 * dans la note 11 des projets. La première venue montrait, pour la seconde
 * ligne, les comptes de la première.
 */
const spec = {
  code: 'T',
  titre: 'T',
  colonnes: [],
  rubriques: [
    { libelle: 'Emprunts', comptes: ['16'] },
    { libelle: 'Intérêts courus', comptes: ['166'] },
    { libelle: 'Dettes', cle: 'dettes', comptes: ['40'] },
    { libelle: 'Intérêts courus', comptes: ['186'] },
    { libelle: 'TOTAL', totalDeRubriques: [0, 1, 2, 3] },
  ],
} as unknown as SpecificationNote;

describe('apparierRubriques', () => {
  it('les deux rubriques du même libellé servies · la k-ième ligne est la k-ième rubrique', () => {
    const lignes = [{ libelle: 'Intérêts courus' }, { libelle: 'Dettes', cle: 'dettes' }, { libelle: 'Intérêts courus' }, { libelle: 'TOTAL' }];
    const { rubriqueDeLigne, ligneDeRubrique } = apparierRubriques(spec, lignes);
    expect([rubriqueDeLigne.get(0), rubriqueDeLigne.get(1), rubriqueDeLigne.get(2), rubriqueDeLigne.get(3)]).toEqual([1, 2, 3, 4]);
    expect([ligneDeRubrique.get(0), ligneDeRubrique.get(1), ligneDeRubrique.get(3)]).toEqual([undefined, 0, 2]);
  });

  it("une seule des deux servie · ambiguë, jamais la première venue", () => {
    const lignes = [{ libelle: 'Intérêts courus' }, { libelle: 'TOTAL' }];
    const { rubriqueDeLigne, ligneDeRubrique } = apparierRubriques(spec, lignes);
    expect(rubriqueDeLigne.get(0)).toBe('ambigu');
    expect([ligneDeRubrique.get(1), ligneDeRubrique.get(3)]).toEqual(['ambigu', 'ambigu']);
  });

  it('les libellés en double des tables réelles sont bien ceux que la règle couvre', () => {
    const doubles = (specs: SpecificationNote[]) =>
      specs.flatMap((s) => {
        const vus = s.rubriques.filter((r) => !r.cle).map((r) => r.libelle);
        return [...new Set(vus.filter((l, i) => vus.indexOf(l) !== i))].map((l) => `${s.code} ${l}`);
      });
    expect([...doubles(NOTES_ASSOCIATIONS), ...doubles(NOTES_PROJETS)]).toEqual(['18A Intérêts courus', '11 Intérêts courus']);
  });
});
