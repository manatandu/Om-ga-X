import { rangApresTab, SELECTEUR_FOCALISABLE } from './piege-focus';

describe('piège de focus · le prochain rang', () => {
  it('à l’intérieur, le navigateur suit son ordre', () => {
    expect(rangApresTab(4, 1, false)).toBeNull();
    expect(rangApresTab(4, 2, true)).toBeNull();
  });
  it('Tab sur le dernier revient au premier, Maj+Tab sur le premier va au dernier', () => {
    expect(rangApresTab(4, 3, false)).toBe(0);
    expect(rangApresTab(4, 0, true)).toBe(3);
  });
  it('un focus sorti de la modale y rentre par le bon bout', () => {
    expect(rangApresTab(4, -1, false)).toBe(0);
    expect(rangApresTab(4, -1, true)).toBe(3);
  });
  it('un seul élément boucle sur lui-même', () => {
    expect(rangApresTab(1, 0, false)).toBe(0);
    expect(rangApresTab(1, 0, true)).toBe(0);
  });
  it('sans élément focalisable, la modale prend elle-même le focus', () => {
    expect(rangApresTab(0, -1, false)).toBe(-2);
  });
  it('le sélecteur écarte les éléments désactivés et cachés', () => {
    expect(SELECTEUR_FOCALISABLE).toContain('button:not([disabled])');
    expect(SELECTEUR_FOCALISABLE).toContain('input:not([disabled]):not([type="hidden"])');
    expect(SELECTEUR_FOCALISABLE).toContain('[tabindex]:not([tabindex="-1"])');
  });
});
