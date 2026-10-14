import {
  billetage,
  billetageDuPaiement,
  echeanceArticle99,
  motifRefusCoupures,
  motifRefusJournalDuPaiement,
  motifRefusReferencesCheques,
  resteAPayer,
  type JournalDuPaiement,
} from './paiement-salaires';

/**
 * LIGNE SAGE-L5, FONCTION 75 · le moteur pur du paiement des salaires.
 */
const journal = (numero: string, autre: Partial<JournalDuPaiement> = {}): JournalDuPaiement => ({
  code: numero.startsWith('57') ? 'CA' : 'BQ',
  type: 'TRESORERIE',
  estActif: true,
  compteTresorerie: { numero },
  ...autre,
});

describe('le journal qui paie suit le mode (fiches des comptes 42, 52 et 57)', () => {
  it('les espèces sortent d’une caisse, le virement et le chèque d’une banque', () => {
    expect(motifRefusJournalDuPaiement('ESPECES', journal('57110000'), null)).toBeNull();
    expect(motifRefusJournalDuPaiement('ESPECES', journal('52110000'), null)).toMatch(/sort d'une caisse/);
    expect(motifRefusJournalDuPaiement('VIREMENT', journal('52110000'), null)).toBeNull();
    expect(motifRefusJournalDuPaiement('CHEQUE', journal('57100000'), null)).toMatch(/ne sort pas d'une caisse/);
  });

  it('un journal hors trésorerie, en sommeil ou sans compte est refusé, une banque en devise aussi', () => {
    expect(motifRefusJournalDuPaiement('VIREMENT', journal('52110000', { type: 'GENERAL' }), null)).toMatch(/n'est pas un journal de banque/);
    expect(motifRefusJournalDuPaiement('VIREMENT', journal('52110000', { estActif: false }), null)).toMatch(/en sommeil/);
    expect(motifRefusJournalDuPaiement('VIREMENT', journal('52110000', { compteTresorerie: null }), null)).toMatch(/pas de compte/);
    expect(motifRefusJournalDuPaiement('VIREMENT', journal('52150000'), 'USD')).toMatch(/tenu en USD/);
    expect(motifRefusJournalDuPaiement('VIREMENT', journal('52110000'), 'CDF')).toBeNull();
    expect(motifRefusJournalDuPaiement('VIREMENT', null, null)).toMatch(/introuvable/);
  });
});

describe('le billetage · les plus grosses coupures d’abord, le reste dit', () => {
  it('ventile un net exact', () => {
    expect(billetage(578_500, [500, 20_000, 1_000, 5_000, 10_000])).toEqual({
      detail: [
        { valeur: 20_000, nombre: 28 },
        { valeur: 10_000, nombre: 1 },
        { valeur: 5_000, nombre: 1 },
        { valeur: 1_000, nombre: 3 },
        { valeur: 500, nombre: 1 },
      ],
      reste: 0,
    });
  });

  it('dit ce qui ne se ventile pas, au centime, jamais arrondi', () => {
    expect(billetage(12_345.67, [10_000, 1_000, 100])).toEqual({
      detail: [
        { valeur: 10_000, nombre: 1 },
        { valeur: 1_000, nombre: 2 },
        { valeur: 100, nombre: 3 },
      ],
      reste: 45.67,
    });
    // Le flottant ferait de 0,30 un 0,29999 · le calcul est en centimes entiers.
    expect(billetage(0.3, [0.1]).detail).toEqual([{ valeur: 0.1, nombre: 3 }]);
  });

  it('totalise chaque coupure sur tous les salariés', () => {
    const b = billetageDuPaiement(
      [
        { salarieId: 's1', nomComplet: 'A', montant: 25_000 },
        { salarieId: 's2', nomComplet: 'B', montant: 15_500 },
      ],
      [5_000, 20_000, 500],
    );
    expect(b.coupures).toEqual([20_000, 5_000, 500]);
    expect(b.totaux).toEqual([
      { valeur: 20_000, nombre: 1 },
      { valeur: 5_000, nombre: 4 },
      { valeur: 500, nombre: 1 },
    ]);
    expect(b.resteTotal).toBe(0);
  });

  it('les coupures se déclarent · positives, au centime, distinctes', () => {
    expect(motifRefusCoupures([])).toMatch(/au moins une coupure/);
    expect(motifRefusCoupures([0])).toMatch(/strictement positive/);
    expect(motifRefusCoupures([1.005])).toMatch(/au centime/);
    expect(motifRefusCoupures([500, 500])).toMatch(/deux fois/);
    expect(motifRefusCoupures([Number.NaN])).toMatch(/strictement positive/);
    expect(motifRefusCoupures([20_000, 10_000, 5_000])).toBeNull();
  });
});

describe('art. 99, al. 2 · « dans les six jours suivant la période »', () => {
  it('six jours de calendrier après le dernier jour du mois', () => {
    expect(echeanceArticle99('2026-08')).toBe('2026-09-06');
    expect(echeanceArticle99('2026-12')).toBe('2027-01-06');
    expect(echeanceArticle99('2028-02')).toBe('2028-03-06');
  });
});

describe('ce qui reste à payer · un bulletin annulé déjà payé ne se paie pas deux fois', () => {
  it('le réémis paie la différence', () => {
    expect(resteAPayer({ id: 'b2', salarieId: 's', netAPayer: 620_000, dejaPayeAutres: 600_000 })).toEqual({ montant: 20_000, tropPaye: 0 });
    expect(resteAPayer({ id: 'b2', salarieId: 's', netAPayer: 600_000, dejaPayeAutres: 600_000 })).toEqual({ montant: 0, tropPaye: 0 });
  });

  it('un trop-perçu se dit, il ne se compense pas', () => {
    expect(resteAPayer({ id: 'b2', salarieId: 's', netAPayer: 580_000, dejaPayeAutres: 600_000.5 })).toEqual({ montant: 0, tropPaye: 20_000.5 });
  });
});

describe('le chèque porte son numéro (AUDCIF art. 17, 3° et 5°)', () => {
  it('refuse un numéro absent ou donné à deux salariés', () => {
    expect(motifRefusReferencesCheques([{ nomComplet: 'A', reference: '' }])).toMatch(/manque pour A/);
    expect(
      motifRefusReferencesCheques([
        { nomComplet: 'A', reference: '00412' },
        { nomComplet: 'B', reference: ' 00412 ' },
      ]),
    ).toMatch(/donné à A et à B/);
    expect(
      motifRefusReferencesCheques([
        { nomComplet: 'A', reference: '00412' },
        { nomComplet: 'B', reference: '00413' },
      ]),
    ).toBeNull();
  });
});
