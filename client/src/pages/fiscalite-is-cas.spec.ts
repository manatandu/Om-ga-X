import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CAS CHIFFRÉS IS · ce que l'écran de l'impôt doit dire (mineurs des deux
 * relectures de la ligne IS-CAS). Lecture de la SOURCE, comme
 * `restitution-fiscale.spec.ts` · aucun import de `vitest`, les globales
 * suffisent aux deux lanceurs.
 */
const page = () => readFileSync(join(__dirname, 'FiscalitePage.tsx'), 'utf8');

describe('Impôt · report déclaré sans origine', () => {
  it('la borne de prudence est dite jouer dans les exercices SUIVANTS, pas dans celui de la saisie', () => {
    const s = page();
    expect(s).toContain('Origine non déclarée · report borné par prudence dans les exercices suivants');
    expect(s).toContain('dans les exercices suivants, OmegaX le borne par prudence');
  });
});
