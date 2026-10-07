import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * NOTES ANNEXES · UNE SEULE GRILLE (relecture du 2026-10-07) · l'en-tête
 * posait `repeat(n, 108px)` et les lignes `repeat(n, 1fr)` : sur les seize
 * colonnes M / F des notes 20B et 29B, les colonnes glissaient et un M se
 * saisissait sous l'en-tête F. Les deux lisent désormais le même gabarit.
 * Et le retrait de la saisie au format antérieur n'est offert qu'à qui écrit.
 */
const source = readFileSync(join(__dirname, 'NotesAnnexesRendu.tsx'), 'utf8');

describe('rendu des notes · grille et gestes', () => {
  it('tout `gridTemplateColumns` du rendu lit `gabaritGrilleNote`, en-tête comme lignes', () => {
    const usages = [...source.matchAll(/gridTemplateColumns:\s*([^}]+)\}/g)].map((m) => m[1].trim());
    expect(usages.length).toBeGreaterThanOrEqual(2);
    for (const u of usages) expect(u.startsWith('gabaritGrilleNote(')).toBe(true);
    expect(source).toContain('export const gabaritGrilleNote = (nbColonnes: number) => `1.6fr repeat(${nbColonnes}, minmax(108px, 1fr))`;');
  });

  it('chaque champ saisi se nomme « ligne · colonne » et prend toute sa cellule', () => {
    expect(source).toContain('aria-label={nom}');
    expect(source).toContain("const nom = `${ligne.libelle} · ${c.libelle}${ligne.rang ? ` · ligne ${ligne.rang + 1}` : ''}`;");
    expect(source.match(/className=\{?[`"]w-full min-w-0 border/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('« Retirer la saisie au format antérieur » n’est rendu que sous le geste servi par l’écran qui écrit', () => {
    const debut = source.indexOf('{saisie?.retirerFormatAnterieur && (');
    expect(debut).toBeGreaterThan(0);
    expect(source.slice(debut, debut + 1500)).toContain('Retirer la saisie au format antérieur');
  });
});
