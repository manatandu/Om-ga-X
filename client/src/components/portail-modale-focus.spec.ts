import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lot 3 du design · le piège de focus de `PortailModale`. Le calcul du rang est
 * éprouvé sans DOM (`lib/piege-focus.spec.ts`) et le parcours au clavier l'est
 * au navigateur (`e2e/tests/clavier-grilles.e2e.ts`). Ici, la STRUCTURE : ce
 * que le composant fait, jamais à quelle distance de caractères.
 */
const source = readFileSync(join(__dirname, 'PortailModale.tsx'), 'utf8');

describe('PortailModale · le clavier reste dans la modale', () => {
  it('écoute Tab au document et le retire à la fermeture', () => {
    expect(source).toContain("document.addEventListener('keydown', surTouche)");
    expect(source).toContain("document.removeEventListener('keydown', surTouche)");
    expect(source).toContain("e.key !== 'Tab'");
  });

  it('boucle par le calcul isolé, et seule la modale la plus haute pilote Tab', () => {
    expect(source).toContain('rangApresTab(liste.length, rang, e.shiftKey)');
    expect(source).toContain('modales[modales.length - 1] !== racine');
  });

  it('retient le déclencheur à l’ouverture et lui rend le focus à la fermeture, s’il est encore là', () => {
    expect(source).toContain('useState<HTMLElement | null>(() =>');
    expect(source).toContain('document.activeElement instanceof HTMLElement');
    expect(source).toContain('declencheur.isConnected');
    expect(source).toContain('declencheur.focus(');
  });

  it('pose aria-modal et aria-labelledby sans écraser ce que la modale a dit', () => {
    expect(source).toContain("hasAttribute('aria-modal')");
    expect(source).toContain("setAttribute('aria-modal', 'true')");
    expect(source).toContain("hasAttribute('aria-labelledby')");
    expect(source).toContain("setAttribute('aria-labelledby'");
  });

  it('l’entrée du focus ne tombe jamais sur le « ? » d’une aide, qui ouvrirait sa bulle au focus', () => {
    expect(source).toContain("focalisables().find((el) => !el.hasAttribute('aria-expanded'))");
  });

  it('ne touche pas à Échap · il reste à lib/echap.ts', () => {
    expect(source).not.toContain('Escape');
  });
});
