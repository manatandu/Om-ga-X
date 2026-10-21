import { describe, expect, it } from 'vitest';
import { delaiDeReprise, estConflitAReprendre, REPRISES_MAX } from './reprise-conflit';

describe('reprise automatique d’un conflit de sérialisation (ligne k6-defauts)', () => {
  it('ne reprend que le 409 « au même instant » du serveur', () => {
    expect(estConflitAReprendre(409, 'Trop d’écritures enregistrées au même instant sur le journal CA · veuillez réessayer.')).toBe(true);
    expect(estConflitAReprendre(409, 'Trop de lettrages effectués au même instant sur ce compte · veuillez réessayer.')).toBe(true);
    // Un autre 409 dit un état qui ne changera pas en attendant.
    expect(estConflitAReprendre(409, 'Un virement est déjà en cours sur ce dossier.')).toBe(false);
    expect(estConflitAReprendre(500, 'au même instant')).toBe(false);
    expect(estConflitAReprendre(400, 'au même instant')).toBe(false);
  });

  it('attend un délai croissant et aléatoire, deux reprises au plus', () => {
    expect(REPRISES_MAX).toBe(2);
    expect(delaiDeReprise(1, () => 0)).toBe(300);
    expect(delaiDeReprise(2, () => 0)).toBe(600);
    expect(delaiDeReprise(1, () => 0.999)).toBeLessThan(1000);
    expect(delaiDeReprise(2, () => 0.999)).toBeLessThan(2000);
    // Deux reprises tirées au sort ne se percutent pas à nouveau · l'aléa pèse.
    expect(delaiDeReprise(1, () => 0.5)).not.toBe(delaiDeReprise(1, () => 0.25));
  });
});
