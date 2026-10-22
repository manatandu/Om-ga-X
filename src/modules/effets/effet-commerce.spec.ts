import { NatureActeEffet, Referentiel, SensEffet, StatutEffet } from '@prisma/client';
import {
  ACTES_ADMIS,
  MOTIF_SYCEBNL_A_RECEVOIR,
  lignesAcceptation,
  lignesDecompte,
  lignesEncaissement,
  lignesImpaye,
  motifRefusActe,
  motifRefusDecompte,
  motifRefusEffet,
  racinesDuRole,
  racineTiers,
  statutApresActes,
} from './effet-commerce';

/**
 * LES RÈGLES PURES DES EFFETS DE COMMERCE (ligne sage-l3, fonction 39) · ce
 * qui casserait en silence. (1) Un numéro, deux plans · le SYCEBNL n'ouvre que
 * le 402, tout autre rôle y est refusé avec son motif, jamais une racine du
 * SYSCOHADA servie à une association. (2) Chaque pièce boucle, le net est ce
 * qui reste du nominal. (3) Les transitions sont une liste fermée · un acte
 * hors statut, un dénouement avant décompte ou avant l'échéance, un acte
 * antidaté sont nommés. (4) Le statut se rejoue sur les actes vivants.
 */
describe('effet-commerce · un numéro, deux plans', () => {
  it('le SYSCOHADA ouvre chaque rôle sous la racine de sa fiche (41, 51, 56, 63, 67)', () => {
    expect(racinesDuRole(Referentiel.SYSCOHADA, 'PORTEFEUILLE', SensEffet.A_RECEVOIR)).toEqual({ racines: ['412'], motif: null });
    expect(racinesDuRole(Referentiel.SYSCOHADA, 'PORTEFEUILLE', SensEffet.A_PAYER)).toEqual({ racines: ['402'], motif: null });
    expect(racinesDuRole(Referentiel.SYSCOHADA, 'ENCAISSEMENT', SensEffet.A_RECEVOIR).racines).toEqual(['512']);
    expect(racinesDuRole(Referentiel.SYSCOHADA, 'ESCOMPTE_NON_ECHU', SensEffet.A_RECEVOIR).racines).toEqual(['415']);
    expect(racinesDuRole(Referentiel.SYSCOHADA, 'CREDIT_ESCOMPTE', SensEffet.A_RECEVOIR).racines).toEqual(['564', '565']);
    expect(racinesDuRole(Referentiel.SYSCOHADA, 'FRAIS_ESCOMPTE', SensEffet.A_RECEVOIR).racines).toEqual(['675']);
    expect(racinesDuRole(Referentiel.SYSCOHADA, 'COMMISSION', SensEffet.A_RECEVOIR).racines).toEqual(['6312']);
    expect(racinesDuRole(Referentiel.SYSCOHADA, 'IMPAYE', SensEffet.A_RECEVOIR).racines).toEqual(['4132']);
  });

  it("le SYCEBNL n'ouvre que l'effet à payer (402) · tout autre rôle est refusé avec son motif", () => {
    expect(racinesDuRole(Referentiel.SYCEBNL, 'PORTEFEUILLE', SensEffet.A_PAYER)).toEqual({ racines: ['402'], motif: null });
    for (const role of ['PORTEFEUILLE', 'ENCAISSEMENT', 'ESCOMPTE_NON_ECHU', 'CREDIT_ESCOMPTE', 'FRAIS_ESCOMPTE', 'COMMISSION', 'IMPAYE'] as const) {
      const r = racinesDuRole(Referentiel.SYCEBNL, role, SensEffet.A_RECEVOIR);
      expect(r.racines).toBeNull();
      expect(r.motif).toBe(MOTIF_SYCEBNL_A_RECEVOIR);
    }
    expect(MOTIF_SYCEBNL_A_RECEVOIR).toMatch(/412 est « Clients-usagers »/);
  });

  it("un effet à payer n'a ni remise, ni escompte, ni impayé · il se paie", () => {
    expect(racinesDuRole(Referentiel.SYSCOHADA, 'ENCAISSEMENT', SensEffet.A_PAYER).motif).toMatch(/se paie \(D 402 \/ C 52\)/);
    expect(racineTiers(SensEffet.A_RECEVOIR)).toBe('411');
    expect(racineTiers(SensEffet.A_PAYER)).toBe('401');
  });
});

describe('effet-commerce · les pièces bouclent', () => {
  const somme = (l: Array<{ debit: number; credit: number }>) => [l.reduce((t, x) => t + x.debit, 0), l.reduce((t, x) => t + x.credit, 0)];

  it("l'acceptation suit le sens · D 412 / C 411 à recevoir, D 401 / C 402 à payer", () => {
    const r = lignesAcceptation({ sens: SensEffet.A_RECEVOIR, compteEffetId: 'c412', compteTiersId: 'c411', montant: 1160000, libelle: 'x' });
    expect(r.map((l) => [l.compteId, l.debit, l.credit])).toEqual([['c412', 1160000, 0], ['c411', 0, 1160000]]);
    const p = lignesAcceptation({ sens: SensEffet.A_PAYER, compteEffetId: 'c402', compteTiersId: 'c401', montant: 500000, libelle: 'x' });
    expect(p.map((l) => [l.compteId, l.debit, l.credit])).toEqual([['c401', 500000, 0], ['c402', 0, 500000]]);
  });

  it('le décompte crédite le net, les frais au 675 et la commission au 6312, le nominal au 565 · au centime', () => {
    const l = lignesDecompte({ compteBanqueId: 'b', compteFraisId: 'f', compteCommissionId: 'k', compteCreditEscompteId: 'e', montant: 1000000.1, frais: 12000.05, commission: 3000.02, libelle: 'x' });
    expect(l.map((x) => [x.compteId, x.debit, x.credit])).toEqual([['b', 985000.03, 0], ['f', 12000.05, 0], ['k', 3000.02, 0], ['e', 0, 1000000.1]]);
    expect(somme(l)[0]).toBeCloseTo(somme(l)[1], 2);
    // Sans frais ni commission, deux lignes seulement · aucune ligne à zéro.
    expect(lignesDecompte({ compteBanqueId: 'b', compteFraisId: null, compteCommissionId: null, compteCreditEscompteId: 'e', montant: 100, frais: 0, commission: 0, libelle: 'x' })).toHaveLength(2);
    expect(lignesEncaissement({ compteBanqueId: 'b', compteCommissionId: null, compteEncaissementId: 'e', montant: 100, commission: 0, libelle: 'x' })).toHaveLength(2);
  });

  it("l'impayé d'un effet escompté et décompté reprend le nominal sur la banque, dans la même pièce", () => {
    const l = lignesImpaye({ compteImpayeId: 'i', compteCrediteId: 'e415', montant: 1000, libelle: 'x', repriseBanque: { compteCreditEscompteId: 'e565', compteBanqueId: 'b' } });
    expect(l.map((x) => [x.compteId, x.debit, x.credit])).toEqual([['i', 1000, 0], ['e415', 0, 1000], ['e565', 1000, 0], ['b', 0, 1000]]);
    expect(lignesImpaye({ compteImpayeId: 'i', compteCrediteId: 'c412', montant: 1000, libelle: 'x', repriseBanque: null })).toHaveLength(2);
  });

  it('frais et commission se jugent avant toute ligne · compte exigé, jamais le nominal entier', () => {
    expect(motifRefusDecompte({ montant: 1000, frais: 10, commission: 0, referencePiece: 'D1', compteFraisId: null, compteCommissionId: null })).toMatch(/exigent leur compte/);
    expect(motifRefusDecompte({ montant: 1000, frais: 600, commission: 400, referencePiece: 'D1', compteFraisId: 'f', compteCommissionId: 'k' })).toMatch(/atteignent le nominal/);
    expect(motifRefusDecompte({ montant: 1000, frais: 10.001, commission: 0, referencePiece: 'D1', compteFraisId: 'f', compteCommissionId: null })).toMatch(/au centime/);
    expect(motifRefusDecompte({ montant: 1000, frais: 10, commission: 0, referencePiece: '', compteFraisId: 'f', compteCommissionId: null })).toMatch(/référence de la pièce/);
    expect(motifRefusDecompte({ montant: 1000, frais: 10, commission: 5, referencePiece: 'D1', compteFraisId: 'f', compteCommissionId: 'k' })).toBeNull();
  });

  it("l'effet se juge entier · montant, référence, échéance après la création", () => {
    const bon = { montant: 1000, reference: 'LCR 12', dateCreation: '2026-03-01', dateEcheance: '2026-05-31' };
    expect(motifRefusEffet(bon)).toBeNull();
    expect(motifRefusEffet({ ...bon, montant: 10.001 })).toMatch(/centime/);
    expect(motifRefusEffet({ ...bon, reference: '' })).toMatch(/référence/);
    expect(motifRefusEffet({ ...bon, dateEcheance: '2026-02-28' })).toMatch(/antérieure à sa création/);
    expect(motifRefusEffet({ ...bon, dateEcheance: '2026-13-01' })).toMatch(/jour/);
  });
});

describe('effet-commerce · transitions et statut', () => {
  const base = { sens: SensEffet.A_RECEVOIR, statut: StatutEffet.ESCOMPTE, dateCreation: '2026-03-01', dateEcheance: '2026-05-31' };

  it('un acte hors statut est refusé en nommant ce que le statut admet', () => {
    const m = motifRefusActe({ ...base, statut: StatutEffet.ENCAISSE, actes: [] }, { nature: NatureActeEffet.REMISE_ESCOMPTE, date: '2026-04-01' });
    expect(m).toMatch(/« Encaissé » n'admet pas « Remise à l'escompte »/);
    expect(motifRefusActe({ ...base, statut: StatutEffet.EN_PORTEFEUILLE, actes: [] }, { nature: NatureActeEffet.REMISE_ESCOMPTE, date: '2026-04-01' })).toBeNull();
    // La liste est fermée · un effet à payer n'admet que le bon à payer et le paiement.
    expect(ACTES_ADMIS.A_PAYER.EN_PORTEFEUILLE).toEqual([NatureActeEffet.BON_A_PAYER, NatureActeEffet.PAIEMENT]);
    expect(ACTES_ADMIS.A_PAYER.ESCOMPTE).toBeUndefined();
  });

  it("l'escompte se dénoue après son décompte et à l'échéance au plus tôt (fiche du 56, « après l'échéance »)", () => {
    const actes = [{ nature: NatureActeEffet.ACCEPTATION, date: '2026-03-01' }, { nature: NatureActeEffet.REMISE_ESCOMPTE, date: '2026-03-10' }];
    expect(motifRefusActe({ ...base, actes }, { nature: NatureActeEffet.DENOUEMENT_ESCOMPTE, date: '2026-06-01' })).toMatch(/passez d'abord le décompte/);
    const avecDecompte = [...actes, { nature: NatureActeEffet.DECOMPTE_ESCOMPTE, date: '2026-03-12' }];
    expect(motifRefusActe({ ...base, actes: avecDecompte }, { nature: NatureActeEffet.DENOUEMENT_ESCOMPTE, date: '2026-05-30' })).toMatch(/2026-05-31/);
    expect(motifRefusActe({ ...base, actes: avecDecompte }, { nature: NatureActeEffet.DENOUEMENT_ESCOMPTE, date: '2026-05-31' })).toBeNull();
    expect(motifRefusActe({ ...base, actes: avecDecompte }, { nature: NatureActeEffet.DECOMPTE_ESCOMPTE, date: '2026-03-13' })).toMatch(/déjà passé/);
  });

  it('un acte ne se date pas avant le précédent, et sa date est un jour', () => {
    const actes = [{ nature: NatureActeEffet.ACCEPTATION, date: '2026-03-01' }, { nature: NatureActeEffet.REMISE_ESCOMPTE, date: '2026-03-10' }];
    expect(motifRefusActe({ ...base, actes }, { nature: NatureActeEffet.DECOMPTE_ESCOMPTE, date: '2026-03-09' })).toMatch(/ne se date pas avant le précédent/);
    expect(motifRefusActe({ ...base, actes }, { nature: NatureActeEffet.DECOMPTE_ESCOMPTE, date: 12 })).toMatch(/est un jour/);
  });

  it('le statut se rejoue sur les actes vivants · à rebours, chaque annulation rend le statut d\'avant', () => {
    const A = NatureActeEffet;
    expect(statutApresActes(SensEffet.A_RECEVOIR, [A.ACCEPTATION])).toBe(StatutEffet.EN_PORTEFEUILLE);
    expect(statutApresActes(SensEffet.A_RECEVOIR, [A.ACCEPTATION, A.REMISE_ENCAISSEMENT])).toBe(StatutEffet.REMIS_A_L_ENCAISSEMENT);
    expect(statutApresActes(SensEffet.A_RECEVOIR, [A.ACCEPTATION, A.REMISE_ENCAISSEMENT, A.ENCAISSEMENT])).toBe(StatutEffet.ENCAISSE);
    expect(statutApresActes(SensEffet.A_RECEVOIR, [A.ACCEPTATION, A.REMISE_ESCOMPTE, A.DECOMPTE_ESCOMPTE])).toBe(StatutEffet.ESCOMPTE);
    expect(statutApresActes(SensEffet.A_RECEVOIR, [A.ACCEPTATION, A.REMISE_ESCOMPTE, A.DECOMPTE_ESCOMPTE, A.DENOUEMENT_ESCOMPTE])).toBe(StatutEffet.ENCAISSE);
    expect(statutApresActes(SensEffet.A_RECEVOIR, [A.ACCEPTATION, A.REMISE_ESCOMPTE, A.IMPAYE])).toBe(StatutEffet.IMPAYE);
    expect(statutApresActes(SensEffet.A_PAYER, [A.ACCEPTATION, A.BON_A_PAYER])).toBe(StatutEffet.BON_A_PAYER);
    expect(statutApresActes(SensEffet.A_PAYER, [A.ACCEPTATION, A.BON_A_PAYER, A.PAIEMENT])).toBe(StatutEffet.PAYE);
    expect(statutApresActes(SensEffet.A_PAYER, [])).toBe(StatutEffet.ANNULE);
  });
});
