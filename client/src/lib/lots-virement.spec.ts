import { lignesDepuisSelection, rappelerLot, type LotVirement } from './lots-virement';

const lot = (montant: number): LotVirement => ({
  id: 'l', nom: 'Loyers', journalId: null,
  lignes: [{ compteId: 'f1', numero: '40110001', intitule: 'Bailleur', montant }],
});
const groupes = [
  { compteId: 'f1', lignes: [
    { id: 'recent', echeance: '2027-03-01', montant: 1000 },
    { id: 'ancien', echeance: '2027-01-01', montant: 1000 },
  ] },
];

describe('rappel d’un lot de virements', () => {
  it('prend les factures les plus anciennes d’abord', () => {
    expect(rappelerLot(lot(1000), groupes)).toEqual({ cochees: ['ancien'], montants: {}, constats: [] });
  });

  it('un montant qui couvre une facture et demie règle la seconde en partie', () => {
    const r = rappelerLot(lot(1500), groupes);
    expect(r.cochees).toEqual(['ancien', 'recent']);
    expect(r.montants).toEqual({ f1: '1500' });
  });

  // Ligne lettrage-cloture, D5 · l'échéancier sert la facture d'un lettrage
  // partiel pour son RESTE · le lot rappelle ce reste, jamais la facture
  // entière (1 000 000 facturés, 400 000 d'acompte · 600 000 servis).
  it('une facture d’un lettrage partiel se rappelle pour le reste servi', () => {
    const r = rappelerLot(lot(1_000_000), [
      { compteId: 'f1', lignes: [{ id: 'partielle', echeance: '2027-01-01', montant: 600_000 }] },
    ]);
    expect(r.cochees).toEqual(['partielle']);
    expect(r.montants).toEqual({});
    expect(r.constats[0]).toMatch(/dû 600\s000,00, sous le montant habituel/);
  });

  it('au-delà du dû, seul le dû est proposé, et c’est dit', () => {
    const r = rappelerLot(lot(5000), groupes);
    expect(r.cochees).toEqual(['ancien', 'recent']);
    expect(r.montants).toEqual({});
    expect(r.constats[0]).toMatch(/sous le montant habituel/);
  });

  // Relecture adverse d'A6 · un lot en francs ne rappelle pas une facture en
  // devise · le montant habituel n'y était pas lu, et 1 500 FC d'acompte sur
  // une facture de 1 160 USD devenaient un règlement entier.
  it('une facture en devise n’est pas rappelée, et c’est dit', () => {
    const mixtes = [
      { compteId: 'f1', lignes: [
        { id: 'usd', echeance: '2026-12-01', montant: 1_948_800, deviseId: 'd-usd' },
        { id: 'fc', echeance: '2027-01-01', montant: 1000 },
      ] },
    ];
    const r = rappelerLot(lot(1500), mixtes);
    expect(r.cochees).toEqual(['fc']);
    expect(r.constats[0]).toMatch(/1 facture\(s\) en devise non rappelée\(s\)/);
    const seule = rappelerLot(lot(1500), [{ compteId: 'f1', lignes: [mixtes[0].lignes[0]] }]);
    expect(seule.cochees).toEqual([]);
    expect(seule.montants).toEqual({});
    expect(seule.constats).toHaveLength(1);
  });

  it('sans facture ouverte, rien n’est proposé · une avance est une autre opération', () => {
    const r = rappelerLot(lot(1000), []);
    expect(r.cochees).toEqual([]);
    expect(r.constats[0]).toMatch(/aucune facture ouverte/);
  });

  it('enregistrer depuis la sélection retient le montant réglé de chaque tiers', () => {
    expect(lignesDepuisSelection(groupes, new Set(['ancien']), {})).toEqual([{ compteId: 'f1', montant: 1000 }]);
    expect(lignesDepuisSelection(groupes, new Set(['ancien', 'recent']), { f1: '1500,5' })).toEqual([{ compteId: 'f1', montant: 1500.5 }]);
    expect(lignesDepuisSelection(groupes, new Set(), {})).toEqual([]);
  });
});
