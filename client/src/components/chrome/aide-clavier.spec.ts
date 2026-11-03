import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Lot 3 du design · la bulle « ? » se lit et se ferme au clavier, sans changer d'apparence. */
const source = readFileSync(join(__dirname, 'Aide.tsx'), 'utf8');

describe('Aide · accessibilité de la bulle', () => {
  it('le bouton est relié à la bulle par aria-describedby tant qu’elle est ouverte', () => {
    expect(source).toContain('aria-describedby={ouvert && pos ? idBulle : undefined}');
    expect(source).toContain('id={idBulle}');
    expect(source).toContain('role="tooltip"');
  });

  it('la bulle reçoit le focus et ne se ferme pas quand il y passe', () => {
    expect(source).toContain('tabIndex={0}');
    expect(source).toContain('onFocus={annulerFermeture}');
  });

  it('la flèche bas du « ? » mène à la bulle, Tab n’est pas détourné', () => {
    expect(source).toContain("e.key === 'ArrowDown' && ouvert && bulle.current");
    expect(source).not.toContain("e.key === 'Tab'");
  });

  it('Échap ferme par la couche d’Échap et rend le focus au « ? » sans rouvrir la bulle', () => {
    expect(source).toContain('ecouterEchap(');
    expect(source).toContain('retourSansOuvrir.current = true');
    expect(source).toContain('if (!retourSansOuvrir.current) setOuvert(true)');
  });

  it('s’ouvre toujours au focus du « ? » (apparence et comportement d’avant)', () => {
    expect(source).toContain('onMouseEnter={() => {');
    expect(source).toContain('aria-expanded={ouvert}');
  });
});
