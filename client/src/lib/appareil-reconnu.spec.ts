import { ADRESSES_GARDEES, garderJetonDeLAppareil, JOURS_GARDES, jetonDeLAppareil } from './appareil-reconnu';

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
    const t = Date.now() - 1000;
    for (let i = 0; i <= ADRESSES_GARDEES; i += 1) garderJetonDeLAppareil(`p${i}@x.cd`, `j${i}`, t + i);
    expect(jetonDeLAppareil('p0@x.cd')).toBeUndefined();
    expect(jetonDeLAppareil(`p${ADRESSES_GARDEES}@x.cd`)).toBe(`j${ADRESSES_GARDEES}`);
  });

  it('oublie une entrée de plus de quatre-vingt-dix jours, à la lecture comme à l’écriture', () => {
    const t0 = Date.UTC(2026, 10, 20);
    const jour = 86_400_000;
    garderJetonDeLAppareil('vieux@x.cd', 'jv', t0);
    expect(jetonDeLAppareil('vieux@x.cd', t0 + JOURS_GARDES * jour)).toBe('jv');
    expect(jetonDeLAppareil('vieux@x.cd', t0 + JOURS_GARDES * jour + 1)).toBeUndefined();
    garderJetonDeLAppareil('neuf@x.cd', 'jn', t0 + (JOURS_GARDES + 1) * jour);
    expect(localStorage.getItem('omegax:appareils')).not.toContain('vieux@x.cd');
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
