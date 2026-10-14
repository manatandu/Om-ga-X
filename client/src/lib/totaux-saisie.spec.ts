import { CLE_MASQUER_TOTAUX_SAISIE, lireMasquerTotaux, memoriserMasquerTotaux } from './totaux-saisie';

/**
 * MASQUER LES TOTAUX DE LA SAISIE (ligne sage-l1, fonction 11) · une
 * préférence du poste, sous `try/catch`. Écrit sans import de vitest · le
 * fichier tourne aussi sous Jest (racine du dépôt).
 */
describe('masquer les totaux de la saisie · préférence du poste', () => {
  const g = globalThis as { localStorage?: unknown };
  let avant: PropertyDescriptor | undefined;
  beforeEach(() => {
    avant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  });
  afterEach(() => {
    if (avant) Object.defineProperty(globalThis, 'localStorage', avant);
    else delete g.localStorage;
  });
  const poser = (valeur: unknown) => Object.defineProperty(globalThis, 'localStorage', { value: valeur, configurable: true, writable: true });
  const magasin = () => {
    const m = new Map<string, string>();
    poser({
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    });
    return m;
  };

  it('les totaux sont montrés tant que rien n’est retenu', () => {
    magasin();
    expect(lireMasquerTotaux()).toBe(false);
  });

  it('retient le choix sous sa clé et le relit, puis le lève', () => {
    const m = magasin();
    memoriserMasquerTotaux(true);
    expect(m.get(CLE_MASQUER_TOTAUX_SAISIE)).toBe('oui');
    expect(lireMasquerTotaux()).toBe(true);
    memoriserMasquerTotaux(false);
    expect(m.has(CLE_MASQUER_TOTAUX_SAISIE)).toBe(false);
    expect(lireMasquerTotaux()).toBe(false);
  });

  it('un stockage qui jette (fenêtre privée) ou absent ne casse rien et montre les totaux', () => {
    const jette = () => {
      throw new Error('bloqué');
    };
    poser({ getItem: jette, setItem: jette, removeItem: jette });
    expect(lireMasquerTotaux()).toBe(false);
    expect(() => memoriserMasquerTotaux(true)).not.toThrow();
    poser(undefined);
    expect(lireMasquerTotaux()).toBe(false);
    expect(() => memoriserMasquerTotaux(false)).not.toThrow();
  });
});
