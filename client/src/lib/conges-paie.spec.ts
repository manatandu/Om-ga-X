import { dateCourte, etatConge, jours, lireNombre, motifCongeNonPortable, moisDuDepart, type CongeDuMois, type CongeLu } from './conges-paie';

// Aucun import de « vitest » · convention du dépôt.

/**
 * LIGNE SAGE-L5, FONCTION 79 · ce que l'écran des congés dit d'un compteur
 * et d'un congé. Ce qui casserait en silence · un solde non chiffré écrit
 * « 0 », un congé déjà payé proposé une seconde fois au bulletin.
 */

const conge = (p: Partial<CongeLu> = {}): CongeLu => ({
  id: 'c',
  du: '2026-08-03',
  au: '2026-08-15',
  joursVoyage: 0,
  moisDePaie: '2026-08',
  deviseAllocation: 'CDF',
  remunerationJournaliere: 20_000,
  moyenneMensuelleArticle142: 52_000,
  auDelaDuSolde: false,
  motifAuDelaDuSolde: null,
  annuleLe: null,
  motifAnnulation: null,
  bulletin: null,
  paiementAuPlusTard: '2026-07-31',
  allocation: { jours: 12, montant: 264_000, tauxJournalier: 22_000, devise: 'CDF', motif: null },
  ...p,
});

describe('les durées et les dates du compteur', () => {
  it('un nombre de jours absent ne s’écrit jamais zéro', () => {
    expect(jours(null)).toBe('·');
    expect(jours(undefined)).toBe('·');
    expect(jours(Number.NaN)).toBe('·');
    expect(jours(0)).toBe('0');
    expect(jours(13.5)).toBe('13,5');
  });

  it('les dates se lisent JJ/MM/AAAA, une absence se dit', () => {
    expect(dateCourte('2026-07-31')).toBe('31/07/2026');
    expect(dateCourte(null)).toBe('·');
  });

  it('le mois de paie proposé est celui du départ (art. 145)', () => {
    expect(moisDuDepart('2026-08-03')).toBe('2026-08');
    expect(moisDuDepart('')).toBe('');
  });

  it('un nombre vide ou illisible est absent, jamais zéro ; la virgule se lit', () => {
    expect(lireNombre('')).toBeUndefined();
    expect(lireNombre('abc')).toBeUndefined();
    expect(lireNombre('1 234,5')).toBe(1234.5);
    expect(lireNombre('0')).toBe(0);
  });
});

describe("l'état d'un congé", () => {
  it('annulé, payé, non chiffré, à porter', () => {
    expect(etatConge(conge({ annuleLe: '2026-08-01T00:00:00Z' }))).toBe('Annulé');
    expect(etatConge(conge({ bulletin: { numero: 7, statut: 'EMIS', moisDePaie: '2026-08' } }))).toBe('Payé au bulletin n° 7');
    expect(etatConge(conge({ allocation: { jours: 12, montant: null, tauxJournalier: null, devise: 'CDF', motif: 'manque' } }))).toBe(
      'Allocation non chiffrée',
    );
    expect(etatConge(conge({ bulletin: { numero: 7, statut: 'ANNULE', moisDePaie: '2026-08' } }))).toBe('À porter au bulletin de 2026-08');
  });
});

describe('un congé ne se coche au bulletin que portable', () => {
  const duMois = (p: Partial<CongeDuMois> = {}): CongeDuMois => ({
    id: 'c',
    du: '2026-08-03',
    au: '2026-08-15',
    portePar: null,
    allocation: { jours: 12, montant: 264_000, tauxJournalier: 22_000, devise: 'CDF', motif: null },
    ...p,
  });

  it('libre, chiffré, dans la monnaie du bulletin', () => {
    expect(motifCongeNonPortable(duMois(), 'CDF')).toBeNull();
  });

  it('déjà porté, non chiffré, ou dans une autre monnaie', () => {
    expect(motifCongeNonPortable(duMois({ portePar: 4 }), 'CDF')).toContain('n° 4');
    expect(motifCongeNonPortable(duMois({ allocation: { jours: 12, montant: null, tauxJournalier: null, devise: null, motif: 'Moyenne non déclarée.' } }), 'CDF')).toBe(
      'Moyenne non déclarée.',
    );
    expect(motifCongeNonPortable(duMois(), 'USD')).toContain('bulletin en USD');
  });
});
