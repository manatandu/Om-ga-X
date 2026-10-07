import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { montant } from '../lib/montants';
import { gabaritGrilleNote } from '../lib/grille-note';

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
    expect(source).toContain("import { gabaritGrilleNote } from '../lib/grille-note';");
    // La première piste a un MINIMUM FIXE · un `1.6fr` nu (minimum `auto`)
    // se réduisait au mot le plus long de chaque ligne, et la grille glissait.
    expect(gabaritGrilleNote(16)).toBe('minmax(11rem, 1.6fr) repeat(16, minmax(108px, 1fr))');
    expect(gabaritGrilleNote(16).split(' repeat(')[0]).toMatch(/^minmax\(\d+(\.\d+)?(rem|px), 1\.6fr\)$/);
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

  /**
   * RELECTURE 2, BLOQUANT · la saisie au format antérieur des notes 20B et
   * 29B se rend TELLE QU'ELLE A ÉTÉ SAISIE. Ces colonnes étaient LIBRES,
   * gardées en texte · passée par montant(), « 150.000 » (150 000 FC, point
   * des milliers) devenait « 150,00 » et « 1.500 » « 1,50 ».
   */
  it('la saisie au format antérieur s’écrit telle qu’elle a été saisie, jamais par montant()', () => {
    // Le piège, éprouvé · un point des milliers lu comme un point décimal.
    expect(montant(Number('150.000'))).toBe(montant(150));
    expect(montant(Number('1.500'))).toBe(montant(1.5));
    const debut = source.indexOf('Saisie antérieure à reporter');
    const fin = source.indexOf('{saisie?.retirerFormatAnterieur && (', debut);
    expect(debut).toBeGreaterThan(0);
    // Le code seul · un commentaire qui explique le piège le nomme.
    const bloc = source.slice(debut, fin).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    expect(bloc).toContain('<td className="py-0.5">{g.valeur}</td>');
    expect(bloc).not.toMatch(/montant\(|Number\(|nombreSaisi/);
    // En-têtes de colonne dans un thead, portée déclarée.
    expect(bloc.match(/<th scope="col"/g)).toHaveLength(3);
    expect(bloc).toContain('<thead>');
  });

  it('le motif du retrait ne se vide qu’au succès ; les lignes demandées se gardent par exercice et sortent vidées', () => {
    expect(source).toContain("if (await saisie.retirerFormatAnterieur!(note.code, motifRetrait.trim())) setMotifRetrait('');");
    expect(source).toContain("const tableau = `${saisie?.exerciceId ?? ''}::${note.code}::${note.sousTableau ?? ''}`;");
    expect(source).toContain('if (ok && rang !== undefined && ligneVideeApres(l.saisie, colonne, valeur)) {');
    expect(source).toContain('saisie={saisiePour(l)}');
  });
});
