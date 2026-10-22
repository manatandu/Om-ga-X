import { NatureRemise, Referentiel, StatutRemiseEnBanque, StatutValeurRecue, TypeCompteDetailTotal, TypeJournal } from '@prisma/client';
import {
  COMPTE_COMMISSION_CARTES,
  MODELE_BORDEREAU_PAR_DEFAUT,
  documentBordereau,
  lignesAvisCredit,
  lignesImpaye,
  lignesReception,
  lignesRemise,
  motifRefusAvisCredit,
  motifRefusImpaye,
  motifRefusModeleBordereau,
  motifRefusTypeRemise,
  motifRefusValeur,
  racineDuRole,
  racineImpaye,
  type TypeRemiseJuge,
} from './remise-en-banque';

/**
 * REMISES DE CHÈQUES ET DE CARTES (ligne sage-l3, fonction 40) · les règles
 * tiennent à la fiche du compte 51 des deux plans (513, 514, 515, commissions
 * en services bancaires) et à celle du compte 41 (impayés au 413). Ce qui
 * casserait en silence · un compte hors racine admis sur un type, un 413 du
 * mauvais plan, une commission qui déséquilibre l'avis, un bordereau dont le
 * total ne somme pas les lignes arrondies.
 */
const compte = (numero: string, actif = true, type: TypeCompteDetailTotal = TypeCompteDetailTotal.DETAIL) => ({ numero, typeCompte: type, estActif: actif });
const journal = (type: TypeJournal, numero: string | null = null, actif = true) => ({ type, estActif: actif, compteTresorerie: numero ? { numero } : null });

const TYPE_CHEQUES: TypeRemiseJuge = {
  code: 'CHQ',
  intitule: 'Chèques Rawbank',
  nature: NatureRemise.CHEQUES,
  journalBanque: journal(TypeJournal.TRESORERIE, '52110001'),
  journalOperations: journal(TypeJournal.GENERAL),
  compteReception: compte('51300000'),
  compteTransit: compte('51400000'),
  compteCommission: null,
  modeleBordereau: null,
};

describe('type de remise · les comptes que la fiche du compte 51 prescrit', () => {
  it('un type de chèques complet passe ; les cartes prennent le 515 sans transit, avec la commission au 631', () => {
    expect(motifRefusTypeRemise(TYPE_CHEQUES)).toBeNull();
    expect(
      motifRefusTypeRemise({ ...TYPE_CHEQUES, nature: NatureRemise.CARTES, compteReception: compte('51500000'), compteTransit: null, compteCommission: compte('63150000') }),
    ).toBeNull();
  });

  it('refuse, en le nommant, un compte hors racine, un total, un compte en sommeil', () => {
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, compteReception: compte('51500000') })).toMatch(/réception.*51500000.*513/);
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, compteTransit: compte('51300000') })).toMatch(/transit.*514/);
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, compteReception: compte('513', true, TypeCompteDetailTotal.TOTAL) })).toMatch(/TOTAL/);
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, compteReception: compte('51300000', false) })).toMatch(/sommeil/);
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, compteCommission: compte('62700000') })).toMatch(/commission.*631/);
  });

  it('une carte ne transite par aucun 514 · un transit posé sur un type de cartes est refusé', () => {
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, nature: NatureRemise.CARTES, compteReception: compte('51500000') })).toMatch(/515 jusqu'à l'avis/);
  });

  it('la banque de remise est un journal de trésorerie au 52 ou au 53, jamais une caisse ; les opérations passent en journal général', () => {
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, journalBanque: journal(TypeJournal.TRESORERIE, '57100000') })).toMatch(/caisse/);
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, journalBanque: journal(TypeJournal.GENERAL) })).toMatch(/TRÉSORERIE/);
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, journalBanque: journal(TypeJournal.TRESORERIE, '53100000') })).toBeNull();
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, journalOperations: journal(TypeJournal.VENTES) })).toMatch(/OPÉRATIONS DIVERSES/);
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, journalOperations: null })).toMatch(/introuvable/);
  });

  it('le code est de un à dix caractères majuscules ou chiffres', () => {
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, code: 'chq' })).toMatch(/code/);
    expect(motifRefusTypeRemise({ ...TYPE_CHEQUES, code: 'CHQRAWBANK1' })).toMatch(/code/);
  });

  it('racineDuRole · 513 ou 515, 514 pour les seuls chèques, 631, 413', () => {
    expect(racineDuRole('RECEPTION', NatureRemise.CHEQUES)).toBe('513');
    expect(racineDuRole('RECEPTION', NatureRemise.CARTES)).toBe('515');
    expect(racineDuRole('TRANSIT', NatureRemise.CHEQUES)).toBe('514');
    expect(racineDuRole('TRANSIT', NatureRemise.CARTES)).toBeNull();
    expect(racineDuRole('COMMISSION', NatureRemise.CARTES)).toBe('631');
    expect(COMPTE_COMMISSION_CARTES).toBe('6315');
  });
});

describe("l'impayé · le 413 de la fiche du compte 41, un numéro deux sens", () => {
  it('SYSCOHADA · par nature, 4131 chèques et 4133 cartes, quel que soit le débiteur', () => {
    expect(racineImpaye(Referentiel.SYSCOHADA, NatureRemise.CHEQUES, '41110001')).toBe('4131');
    expect(racineImpaye(Referentiel.SYSCOHADA, NatureRemise.CARTES, '41110001')).toBe('4133');
  });

  it('SYCEBNL · par débiteur et nature · adhérent 4131 / 4133, client-usager 4132 / 4138, autre tiers sous le 413 entier', () => {
    expect(racineImpaye(Referentiel.SYCEBNL, NatureRemise.CHEQUES, '41100001')).toBe('4131');
    expect(racineImpaye(Referentiel.SYCEBNL, NatureRemise.CARTES, '41100001')).toBe('4133');
    expect(racineImpaye(Referentiel.SYCEBNL, NatureRemise.CHEQUES, '41200001')).toBe('4132');
    expect(racineImpaye(Referentiel.SYCEBNL, NatureRemise.CARTES, '41200001')).toBe('4138');
    expect(racineImpaye(Referentiel.SYCEBNL, NatureRemise.CHEQUES, '47100000')).toBe('413');
  });

  it("refuse l'impayé d'une valeur non remise, déjà impayée, antidaté, ou sur un compte hors racine", () => {
    const base = { statut: StatutValeurRecue.REMISE, dateValeur: '2026-03-10', date: '2026-03-20', numeroImpaye: '41310000', racine: '4131' };
    expect(motifRefusImpaye(base)).toBeNull();
    expect(motifRefusImpaye({ ...base, statut: StatutValeurRecue.RECUE })).toMatch(/non encore remise/);
    expect(motifRefusImpaye({ ...base, statut: StatutValeurRecue.IMPAYEE })).toMatch(/déjà/);
    expect(motifRefusImpaye({ ...base, date: '2026-03-01' })).toMatch(/ne précède pas/);
    expect(motifRefusImpaye({ ...base, numeroImpaye: '41330000' })).toMatch(/41330000.*4131/);
    expect(motifRefusImpaye({ ...base, numeroImpaye: null })).toMatch(/introuvable/);
  });
});

describe('la valeur reçue et le modèle du bordereau', () => {
  it('montant positif au centime, référence, jour · chaque refus nomme le champ', () => {
    expect(motifRefusValeur({ montant: 150000, reference: 'CHQ 0042', date: '2026-03-10' })).toBeNull();
    expect(motifRefusValeur({ montant: 0, reference: 'x', date: '2026-03-10' })).toMatch(/montant/);
    expect(motifRefusValeur({ montant: 10.005, reference: 'x', date: '2026-03-10' })).toMatch(/centime/);
    expect(motifRefusValeur({ montant: 10, reference: '  ', date: '2026-03-10' })).toMatch(/référence/);
    expect(motifRefusValeur({ montant: 10, reference: 'x', date: '2026-03' })).toMatch(/jour/);
    expect(motifRefusValeur({ montant: 10, reference: 'x', date: '2026-03-10', titulaire: 42 })).toMatch(/titulaire/i);
  });

  it('un jeton inconnu est refusé et nommé ; {lignes} est exigé une fois ; null vaut la présentation par défaut', () => {
    expect(motifRefusModeleBordereau(null)).toBeNull();
    expect(motifRefusModeleBordereau(MODELE_BORDEREAU_PAR_DEFAUT)).toBeNull();
    expect(motifRefusModeleBordereau('Remise {numero}\n{lignes}\n{signature}')).toMatch(/\{signature\}/);
    expect(motifRefusModeleBordereau('Remise {numero}')).toMatch(/\{lignes\} une fois/);
    expect(motifRefusModeleBordereau('{lignes}{lignes}')).toMatch(/\{lignes\} une fois/);
  });

  it('le bordereau rendu porte chaque valeur sur sa ligne, le nombre et le total en francs', () => {
    const doc = documentBordereau({
      dossier: 'SARL Kin',
      banque: 'BQ · Rawbank',
      type: 'Chèques Rawbank',
      numero: 7,
      date: '2026-03-15',
      nature: NatureRemise.CHEQUES,
      lignes: [
        { reference: 'CHQ 0042', titulaire: 'Kinshasa Supplies', banqueTiree: 'Equity', montant: 1500000 },
        { reference: 'CHQ 0043', titulaire: null, banqueTiree: null, montant: 250.5 },
      ],
      total: 1500250.5,
      modele: null,
    });
    expect(doc).toContain('BORDEREAU DE REMISE N° 7 · Chèques');
    expect(doc).toContain('Date · 15/03/2026');
    expect(doc).toContain('CHQ 0042 · Kinshasa Supplies · Equity · 1 500 000,00');
    expect(doc).toContain('CHQ 0043 ·  ·  · 250,50');
    expect(doc).toContain('2 valeur(s) · total 1 500 250,50');
  });
});

describe('les quatre écritures · équilibrées, aux comptes de la fiche du 51', () => {
  const solde = (l: Array<{ debit: number; credit: number }>) => Math.round(l.reduce((s, x) => s + x.debit - x.credit, 0) * 100);

  it('la réception · D 513 / C tiers', () => {
    const l = lignesReception({ compteReceptionId: 'c513', compteTiersId: 'c411', montant: 1500000, libelle: 'Chèque' });
    expect(l).toEqual([
      { compteId: 'c513', libelle: 'Chèque', debit: 1500000, credit: 0 },
      { compteId: 'c411', libelle: 'Chèque', debit: 0, credit: 1500000 },
    ]);
  });

  it('le bordereau · D 514 du total ARRONDI / C 513 par chèque (deux demi-centimes ne font pas un centime fantôme)', () => {
    const l = lignesRemise({
      compteTransitId: 'c514',
      compteReceptionId: 'c513',
      valeurs: [
        { montant: 10.005, libelle: 'a' },
        { montant: 10.005, libelle: 'b' },
      ],
      libelle: 'Remise',
    });
    expect(l[0]).toEqual({ compteId: 'c514', libelle: 'Remise', debit: 20.02, credit: 0 });
    expect(solde(l)).toBe(0);
  });

  it("l'avis de crédit · D 52 du net, D 6315 de la commission, C 514 du total · sans commission, deux lignes", () => {
    const avec = lignesAvisCredit({ compteBanqueId: 'c52', compteCommissionId: 'c6315', compteSoldeId: 'c515', total: 1000, commission: 15, libelle: 'Avis' });
    expect(avec.map((x) => [x.compteId, x.debit, x.credit])).toEqual([
      ['c52', 985, 0],
      ['c6315', 15, 0],
      ['c515', 0, 1000],
    ]);
    expect(solde(avec)).toBe(0);
    const sans = lignesAvisCredit({ compteBanqueId: 'c52', compteCommissionId: 'c6315', compteSoldeId: 'c514', total: 1000, commission: 0, libelle: 'Avis' });
    expect(sans).toHaveLength(2);
  });

  it("l'impayé · D 413 / C 514 ou 52", () => {
    expect(solde(lignesImpaye({ compteImpayeId: 'c4131', compteCrediteId: 'c514', montant: 99.99, libelle: 'Impayé' }))).toBe(0);
  });

  it("l'avis se juge avant la pièce · remise déjà créditée, date avant la remise, commission sans compte ou égale au total, référence absente", () => {
    const base = { statut: StatutRemiseEnBanque.REMISE, dateRemise: '2026-03-15', total: 1000, date: '2026-03-18', commission: 15, referenceAvis: 'Relevé 03/2026', compteCommissionId: 'c6315' };
    expect(motifRefusAvisCredit(base)).toBeNull();
    expect(motifRefusAvisCredit({ ...base, statut: StatutRemiseEnBanque.CREDITEE })).toMatch(/déjà créditée/);
    expect(motifRefusAvisCredit({ ...base, date: '2026-03-14' })).toMatch(/ne précède pas/);
    expect(motifRefusAvisCredit({ ...base, compteCommissionId: null })).toMatch(/compte de commission/);
    expect(motifRefusAvisCredit({ ...base, commission: 1000 })).toMatch(/atteindre le total/);
    expect(motifRefusAvisCredit({ ...base, commission: undefined, compteCommissionId: null })).toBeNull();
    expect(motifRefusAvisCredit({ ...base, referenceAvis: '' })).toMatch(/référence de l'avis/);
    expect(motifRefusAvisCredit({ ...base, commission: 0.005 })).toMatch(/centime/);
  });
});
