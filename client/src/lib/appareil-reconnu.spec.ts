import { ADRESSES_GARDEES, garderJetonDeLAppareil, jetonDeLAppareil } from './appareil-reconnu';

// Pas d'import de « vitest » · convention du dépôt (voir calcul.spec.ts).

/**
 * L'APPAREIL RECONNU (audit de sécurité du 2026-11-19) · le jeton se garde par
 * adresse, se relit à la connexion suivante, et un stockage absent ne casse
 * jamais la connexion.
 */
function stockage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe('appareil-reconnu', () => {
  const origine = (globalThis as { localStorage?: unknown }).localStorage;
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = stockage();
  });
  afterAll(() => {
    (globalThis as { localStorage?: unknown }).localStorage = origine;
  });

  it('garde le jeton par adresse, sans égard à la casse', () => {
    garderJetonDeLAppareil('Chef@Asbl.cd', 'j1');
    expect(jetonDeLAppareil('chef@asbl.cd ')).toBe('j1');
    expect(jetonDeLAppareil('autre@asbl.cd')).toBeUndefined();
  });

  it('ne garde que les dernières adresses d’un poste partagé', () => {
    for (let i = 0; i <= ADRESSES_GARDEES; i += 1) garderJetonDeLAppareil(`p${i}@x.cd`, `j${i}`, 1000 + i);
    expect(jetonDeLAppareil('p0@x.cd')).toBeUndefined();
    expect(jetonDeLAppareil(`p${ADRESSES_GARDEES}@x.cd`)).toBe(`j${ADRESSES_GARDEES}`);
  });

  it('un stockage qui jette ne casse rien', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error('privé');
      },
      setItem: () => {
        throw new Error('privé');
      },
    };
    expect(() => garderJetonDeLAppareil('a@b.cd', 'j')).not.toThrow();
    expect(jetonDeLAppareil('a@b.cd')).toBeUndefined();
  });
});
