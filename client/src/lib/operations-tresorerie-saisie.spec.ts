// Aucun import de « vitest » · convention du dépôt.
import { corpsOperation, interetsProposesAu, montantExige, type ChampsOperation } from './operations-tresorerie-saisie';

/**
 * Ce qui casserait en silence · un champ illisible qui partirait en `null`
 * (« non déclaré » au serveur), un montant au point des milliers lu 500, un
 * taux de référence envoyé avec un taux fixe.
 */
const champs = (c: Partial<ChampsOperation> = {}): ChampsOperation => ({
  type: 'FINANCEMENT',
  modeInterets: 'POST_COMPTES',
  reference: ' CT-01 ',
  journalBanqueId: 'jbq',
  journalOdId: 'jod',
  comptePrincipalId: 'c561',
  compteInteretsId: 'c6745',
  compteCourusId: 'c566',
  compteFraisId: '',
  taux: 'FIXE',
  tauxFixe: '12',
  marge: '',
  baseCalcul: '360',
  montant: '10 000 000',
  frais: '',
  interetsPrecomptes: '',
  deblocableAToutMoment: '',
  dateMiseEnPlace: '2026-10-01',
  dateEcheance: '2027-03-30',
  referenceConvention: 'Convention 7',
  dateConvention: '2026-09-20',
  ...c,
});

describe('operations-tresorerie-saisie', () => {
  it('un crédit à taux fixe part complet, sans taux de référence ni compte de frais vide', () => {
    const r = corpsOperation(champs());
    expect('corps' in r && r.corps).toMatchObject({ reference: 'CT-01', tauxFixe: 12, montant: 10_000_000, frais: null, baseCalcul: 360 });
    expect('corps' in r && 'tauxReferenceId' in r.corps).toBe(false);
    expect('corps' in r && 'compteFraisId' in r.corps).toBe(false);
  });
  it("une marge vide n'est pas zéro · refusée avec un taux de référence, 0 tapé accepté", () => {
    expect(corpsOperation(champs({ taux: 'tr1', marge: '' }))).toEqual({ refus: expect.stringMatching(/marge est exigée/) });
    expect(corpsOperation(champs({ taux: 'tr1', marge: '0' }))).toHaveProperty('corps.marge', 0);
  });
  it('un taux de référence part avec sa marge, jamais avec un taux fixe', () => {
    const r = corpsOperation(champs({ taux: 'tr1', marge: '3,75', tauxFixe: '99' }));
    expect('corps' in r && r.corps).toMatchObject({ tauxReferenceId: 'tr1', marge: 3.75 });
    expect('corps' in r && 'tauxFixe' in r.corps).toBe(false);
  });
  it('refuse un montant au point des milliers et un taux illisible, en le nommant', () => {
    expect(corpsOperation(champs({ montant: '500.000' }))).toEqual({ refus: expect.stringMatching(/Montant illisible/) });
    expect(corpsOperation(champs({ tauxFixe: 'douze' }))).toEqual({ refus: expect.stringMatching(/taux fixe est exigé/) });
  });
  it('des précomptés exigent leurs intérêts, un placement dit son déblocage', () => {
    expect(corpsOperation(champs({ modeInterets: 'PRECOMPTES' }))).toEqual({ refus: expect.stringMatching(/précomptés/) });
    const r = corpsOperation(champs({ type: 'PLACEMENT', deblocableAToutMoment: 'non' }));
    expect('corps' in r && r.corps.deblocableAToutMoment).toBe(false);
  });
  it('un montant seul · vide ou illisible est un refus, jamais un zéro', () => {
    expect(montantExige('', 'Le montant')).toEqual({ refus: 'Le montant est exigé.' });
    expect(montantExige('303 333,33', 'Le montant')).toEqual({ corps: 303_333.33 });
  });
});

describe('interetsProposesAu · la proposition suit la date de l’échéance', () => {
  const op = { montant: 10_000_000, tauxApplique: 12, baseCalcul: 360, dateMiseEnPlace: '2026-01-01T00:00:00.000Z' };
  it('compte les jours de la mise en place à la date choisie, comme le serveur', () => {
    expect(interetsProposesAu(op, '2026-04-01')).toBe(300_000);
    expect(interetsProposesAu(op, '2026-02-01')).toBe(103_333.33);
  });
  it('ne propose rien sur une date illisible ou qui ne suit pas la mise en place', () => {
    expect(interetsProposesAu(op, '')).toBeNull();
    expect(interetsProposesAu(op, '2026-01-01')).toBeNull();
    expect(interetsProposesAu(op, '2025-12-31')).toBeNull();
  });
});
