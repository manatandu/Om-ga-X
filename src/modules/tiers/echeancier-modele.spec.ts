import { ConditionEcheance, TypeEcheance, TypeJournal } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
import { dateEcheanceDuModele, echeancierDuModele, motifSansEcheancierDuModele } from './echeancier-modele';
import { TiersService } from './tiers.service';

/**
 * L'ÉCHÉANCIER DU MODÈLE APPLIQUÉ À LA LIGNE DE FACTURE (ligne sage-l2,
 * fonction 3). Ce que ces tests empêchent · une facture de 1 000 000 en trois
 * tiers qui laisse un centime hors des échéances (la ligne découpée ne
 * solderait plus la pièce) ; une avance au 409 ou une facture non parvenue
 * au 408 rangée à une échéance inventée ; le compte d'un autre dossier lu.
 */
const jour = (d: Date) => d.toISOString().slice(0, 10);
const modele = { delaiJours: 30, echeance: ConditionEcheance.NET, modeReglementId: 'mVir' };
const ech = (ordre: number, type: TypeEcheance, valeur: number | null, delaiJours: number, echeance: ConditionEcheance = ConditionEcheance.NET, mode: string | null = null) => ({
  ordre,
  type,
  valeur,
  delaiJours,
  echeance,
  modeReglementId: mode,
});

describe('la date d’échéance', () => {
  it('net · la date de la facture plus le délai', () => {
    expect(jour(dateEcheanceDuModele(new Date('2026-12-10'), 30, ConditionEcheance.NET))).toBe('2027-01-09');
  });
  it('fin de mois · la fin du mois de la facture plus le délai, février compris', () => {
    expect(jour(dateEcheanceDuModele(new Date('2026-01-31'), 0, ConditionEcheance.FIN_DE_MOIS))).toBe('2026-01-31');
    expect(jour(dateEcheanceDuModele(new Date('2026-01-15'), 28, ConditionEcheance.FIN_DE_MOIS))).toBe('2026-02-28');
  });
});

describe('l’échéancier', () => {
  it('sans fractionnement · une échéance, le montant entier, au mode du modèle', () => {
    expect(echeancierDuModele(modele, [], new Date('2026-03-10'), 1_160_000, 'mHab')).toEqual([
      { ordre: 1, type: null, montant: 1_160_000, dateEcheance: new Date('2026-04-09'), modeReglementId: 'mVir' },
    ]);
  });

  it('le mode habituel du tiers vaut quand ni le modèle ni l’échéance n’en disent', () => {
    const [e] = echeancierDuModele({ ...modele, modeReglementId: null }, [], new Date('2026-03-10'), 100, 'mHab');
    expect(e.modeReglementId).toBe('mHab');
  });

  it('trois tiers d’un million · la somme rend le montant au centime, la dernière prend le reste', () => {
    const r = echeancierDuModele(
      modele,
      [ech(1, TypeEcheance.POURCENTAGE, 33.33, 0), ech(2, TypeEcheance.POURCENTAGE, 33.33, 30), ech(3, TypeEcheance.EQUILIBRE, null, 60)],
      new Date('2026-03-10'),
      1_000_000.01,
    );
    expect(r.map((e) => e.montant)).toEqual([333_300, 333_300, 333_400.01]);
    expect(Math.round(r.reduce((s, e) => s + e.montant, 0) * 100)).toBe(100_000_001);
  });

  it('l’Équilibre se calcule en dernier quel que soit son rang, et un montant fixe est borné au reste', () => {
    const r = echeancierDuModele(
      modele,
      [ech(1, TypeEcheance.EQUILIBRE, null, 0), ech(2, TypeEcheance.MONTANT, 900, 30, ConditionEcheance.FIN_DE_MOIS, 'mChq')],
      new Date('2026-03-10'),
      500,
    );
    expect(r).toEqual([
      { ordre: 1, type: TypeEcheance.EQUILIBRE, montant: 0, dateEcheance: new Date('2026-03-10'), modeReglementId: null },
      { ordre: 2, type: TypeEcheance.MONTANT, montant: 500, dateEcheance: new Date('2026-04-30'), modeReglementId: 'mChq' },
    ]);
  });
});

describe('la ligne qui reçoit l’échéancier', () => {
  it('la facture · fournisseur au crédit, client au débit, hors trésorerie', () => {
    expect(motifSansEcheancierDuModele({ numero: '40110001', sens: 'CREDIT', typeJournal: TypeJournal.ACHATS })).toBeNull();
    expect(motifSansEcheancierDuModele({ numero: '41110001', sens: 'DEBIT', typeJournal: TypeJournal.VENTES })).toBeNull();
    expect(motifSansEcheancierDuModele({ numero: '41110001', sens: 'DEBIT', typeJournal: null })).toBeNull();
  });

  it.each(['40810000', '40910000', '41620000', '41810000', '41910000'])('le %s ne reçoit pas d’échéance tirée d’un modèle', (numero) => {
    const sens = numero.startsWith('40') ? 'CREDIT' : 'DEBIT';
    expect(motifSansEcheancierDuModele({ numero, sens, typeJournal: TypeJournal.GENERAL })).toContain('ne reçoit pas');
  });

  it('un avoir, un règlement ou un journal de trésorerie non plus', () => {
    expect(motifSansEcheancierDuModele({ numero: '40110001', sens: 'DEBIT', typeJournal: TypeJournal.ACHATS })).toContain('sens inverse');
    expect(motifSansEcheancierDuModele({ numero: '41110001', sens: 'DEBIT', typeJournal: TypeJournal.TRESORERIE })).toContain('trésorerie');
    expect(motifSansEcheancierDuModele({ numero: '60110000', sens: 'DEBIT', typeJournal: TypeJournal.ACHATS })).toContain('fournisseur (40) ou de client (41)');
  });
});

describe('TiersService.echeancierDeLigne', () => {
  function service(opts: { compte?: { id: string; numero: string } | null; tiers?: unknown; modes?: Array<{ id: string; code: string; estActif: boolean }> }) {
    const prisma = {
      compte: { findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) => (where.tenantId === 't' ? (opts.compte ?? null) : null)) },
      tiersCompte: { findFirst: jest.fn(async () => (opts.tiers === undefined ? null : { tiers: opts.tiers })) },
      modeReglement: { findMany: jest.fn(async () => opts.modes ?? []) },
    };
    return { s: new TiersService(prisma as unknown as PrismaService), prisma };
  }
  const dto = { date: '2026-12-10', montant: 1_160_000, sens: 'CREDIT' as const, typeJournal: TypeJournal.ACHATS };
  const tiers = (extra: Record<string, unknown> = {}) => ({
    id: 'tr',
    code: 'FRS1',
    nom: 'Fournisseur',
    estActif: true,
    validationAutomatiqueEcheances: false,
    modeReglement: { id: 'mEsp', code: 'ESP', estActif: true },
    modeleReglement: {
      id: 'mod',
      intitule: '50/50',
      estActif: true,
      delaiJours: 30,
      echeance: ConditionEcheance.NET,
      modeReglementId: null,
      echeances: [ech(1, TypeEcheance.POURCENTAGE, 50, 30, ConditionEcheance.NET, 'mVir'), ech(2, TypeEcheance.EQUILIBRE, null, 60)],
    },
    ...extra,
  });

  it('le compte d’un autre dossier est introuvable', async () => {
    const { s } = service({ compte: { id: 'c', numero: '40110001' } });
    await expect(s.echeancierDeLigne('autre', 'c', dto)).rejects.toThrow('Compte introuvable pour ce dossier.');
  });

  it('deux échéances · chacune son mode, le mode habituel pour celle qui n’en dit pas', async () => {
    const { s } = service({
      compte: { id: 'c', numero: '40110001' },
      tiers: tiers(),
      modes: [{ id: 'mVir', code: 'VIR', estActif: true }],
    });
    const r = await s.echeancierDeLigne('t', 'c', dto);
    expect(r.motif).toBeNull();
    expect(r.echeances).toEqual([
      { ordre: 1, montant: 580_000, dateEcheance: '2027-01-09', modeReglementId: 'mVir', modeCode: 'VIR' },
      { ordre: 2, montant: 580_000, dateEcheance: '2027-02-08', modeReglementId: 'mEsp', modeCode: 'ESP' },
    ]);
    expect(r.modele).toEqual({ id: 'mod', intitule: '50/50' });
  });

  it('un mode d’échéance mis en sommeil n’est pas posé d’office', async () => {
    const { s } = service({
      compte: { id: 'c', numero: '40110001' },
      tiers: tiers({ modeReglement: null }),
      modes: [{ id: 'mVir', code: 'VIR', estActif: false }],
    });
    const r = await s.echeancierDeLigne('t', 'c', dto);
    expect(r.echeances[0]).toMatchObject({ modeReglementId: null, modeCode: null });
  });

  it('un tiers sans modèle · aucune échéance, le motif et le mode habituel', async () => {
    const { s } = service({ compte: { id: 'c', numero: '40110001' }, tiers: tiers({ modeleReglement: null }) });
    const r = await s.echeancierDeLigne('t', 'c', dto);
    expect(r.echeances).toEqual([]);
    expect(r.motif).toContain("n'a pas de modèle de règlement");
    expect(r.modeHabituel).toEqual({ id: 'mEsp', code: 'ESP' });
    expect(r.applicable).toBe(true);
  });

  it('une avance au 409 · aucune échéance, le motif dit pourquoi', async () => {
    const { s } = service({ compte: { id: 'c', numero: '40910001' }, tiers: tiers() });
    const r = await s.echeancierDeLigne('t', 'c', { ...dto, sens: 'DEBIT' });
    expect(r.echeances).toEqual([]);
    expect(r.motif).toContain('409');
    expect(r.applicable).toBe(false);
  });
});
