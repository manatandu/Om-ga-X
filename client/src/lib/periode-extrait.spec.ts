import { describe, expect, it } from 'vitest';
import { bornesDeLaPeriode, estUnExtrait, motifPeriodeSaisie, requetePeriode, titreExtrait, veille } from './periode-extrait';

/**
 * LA PÉRIODE À L'ÉCRAN (ligne export-periode) · la même règle que le serveur
 * (`periodeDeLExtrait`) · une période qui couvre l'exercice n'est pas un
 * extrait, et un extrait se dit toujours (condition 2).
 */
const EXERCICE = { dateDebut: '2026-01-01T00:00:00.000Z', dateFin: '2026-12-31T00:00:00.000Z' };

describe('la période de la balance et du grand livre', () => {
  it('sans borne, ou bornée à l’exercice entier, ce n’est pas un extrait', () => {
    expect(estUnExtrait(EXERCICE, { du: '', au: '' })).toBe(false);
    expect(estUnExtrait(EXERCICE, { du: '2026-01-01', au: '2026-12-31' })).toBe(false);
    expect(estUnExtrait(EXERCICE, { du: '2026-04-01', au: '' })).toBe(true);
  });

  it('une borne vide prend celle de l’exercice, et le titre dit l’extrait', () => {
    expect(bornesDeLaPeriode(EXERCICE, { du: '', au: '2026-06-30' })).toEqual({ du: '2026-01-01', au: '2026-06-30' });
    expect(titreExtrait(EXERCICE, { du: '2026-04-01', au: '2026-06-30' })).toBe('Extrait du 01/04/2026 au 30/06/2026');
    expect(veille('2026-04-01')).toBe('2026-03-31');
    expect(veille('2026-01-01')).toBe('2025-12-31');
  });

  it('l’adresse ne porte que les bornes posées', () => {
    expect(requetePeriode({ du: '', au: '' })).toBe('');
    expect(requetePeriode({ du: '2026-04-01', au: '2026-06-30' })).toBe('&du=2026-04-01&au=2026-06-30');
  });

  it('hors de l’exercice ou à l’envers, refusée avant l’envoi', () => {
    expect(motifPeriodeSaisie(EXERCICE, { du: '2025-12-01', au: '' })).toMatch(/tenir dans l'exercice/);
    expect(motifPeriodeSaisie(EXERCICE, { du: '2026-06-30', au: '2026-04-01' })).toMatch(/dépasse sa date de fin/);
    expect(motifPeriodeSaisie(EXERCICE, { du: '2026-04-01', au: '2026-06-30' })).toBeNull();
  });
});
