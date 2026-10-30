import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  AVERTISSEMENT_PLAN_AUTEUR_INCONNU,
  MOTIF_PLAN_CHANGE_DEPUIS_LA_LECTURE,
  MOTIF_VISA_PLAN_PAR_SON_AUTEUR,
  motifPlanNonPropose,
  motifRefusVisaPlan,
  planChange,
  planVise,
  saisieDuPlan,
} from './visa-plan-etalement';
import { AvancesRubriquesService, etalementDeLAvanceVisee } from './avances-rubriques.service';

/**
 * LIGNE PAIE-SUITE · le visa d'un plan d'étalement. Ce qui casserait en
 * silence · un auteur qui se vise, un plan changé depuis la lecture et visé
 * quand même, un plan non visé proposé au bulletin, un plan non visé TU (la
 * simulation croirait l'avance soldée), un envoi identique qui efface un visa.
 */
const saisiLe = new Date('2026-10-29T08:00:00.000Z');
const plan = { premierMoisRetenue: '2026-11', planSaisiPar: 'u1', planSaisiLe: saisiLe, planVisePar: null, planViseLe: null };

describe('visa des plans · les règles', () => {
  it("l'auteur ne vise pas son propre plan · un autre utilisateur le peut", () => {
    expect(motifRefusVisaPlan(plan, 'u1', saisiLe.toISOString())).toBe(MOTIF_VISA_PLAN_PAR_SON_AUTEUR);
    expect(motifRefusVisaPlan(plan, 'u2', saisiLe.toISOString())).toBeNull();
  });

  it('le visa vise ce qui a été lu', () => {
    expect(motifRefusVisaPlan(plan, 'u2', '2026-10-29T07:00:00.000Z')).toBe(MOTIF_PLAN_CHANGE_DEPUIS_LA_LECTURE);
  });

  it("un plan d'avant la règle se vise, une fois ; une avance sans plan ne se vise pas", () => {
    const ancien = { ...plan, planSaisiPar: null, planSaisiLe: null };
    expect(motifRefusVisaPlan(ancien, 'u1', null)).toBeNull();
    expect(motifRefusVisaPlan({ ...ancien, planVisePar: 'u2', planViseLe: new Date() }, 'u1', null)).toMatch(/déjà visé/);
    expect(motifRefusVisaPlan({ ...ancien, premierMoisRetenue: null }, 'u1', null)).toMatch(/aucun plan/);
  });

  it('une saisie du plan fait tomber le visa ; retirer le plan efface les traces', () => {
    expect(saisieDuPlan('u3', saisiLe, true)).toEqual({ planSaisiPar: 'u3', planSaisiLe: saisiLe, planVisePar: null, planViseLe: null });
    expect(saisieDuPlan('u3', saisiLe, false)).toEqual({ planSaisiPar: null, planSaisiLe: null, planVisePar: null, planViseLe: null });
  });

  it('le plan change au centime · un envoi identique ne change rien', () => {
    const a = { premierMoisRetenue: '2026-11', nombreEcheances: null, retenueMensuelleFc: 40_000 };
    expect(planChange(a, { ...a })).toBe(false);
    expect(planChange(a, { ...a, retenueMensuelleFc: 40_000.004 })).toBe(false);
    expect(planChange(a, { ...a, retenueMensuelleFc: 40_000.01 })).toBe(true);
    expect(planChange(a, { ...a, premierMoisRetenue: '2026-12' })).toBe(true);
  });

  it('visé, ce sont les deux traces · une trace absente n’est pas un visa', () => {
    expect(planVise({ planVisePar: 'u2', planViseLe: new Date() })).toBe(true);
    expect(planVise({ planVisePar: 'u2' })).toBe(false);
  });

  it("sans l'option, tout plan se propose ; avec, seul le plan visé, et le refus est dit", () => {
    expect(motifPlanNonPropose(false, plan, 'Avance')).toBeNull();
    expect(motifPlanNonPropose(true, plan, 'Avance du 2026-10-01')).toMatch(/n'est pas visé.*pas proposée/);
    expect(motifPlanNonPropose(true, { ...plan, planVisePar: 'u2', planViseLe: new Date() }, 'Avance')).toBeNull();
  });

  it("la liste ne propose pas la retenue d'un plan non visé, et dit pourquoi", () => {
    const a = { montantFc: 90_000, premierMoisRetenue: '2026-11', nombreEcheances: 3, retenueMensuelleFc: null, planVisePar: null, planViseLe: null };
    const sans = etalementDeLAvanceVisee(a, 90_000, '2026-11', false);
    expect(sans.proposition?.montantFc).toBe(30_000);
    const avec = etalementDeLAvanceVisee(a, 90_000, '2026-11', true);
    expect(avec.proposition).toBeNull();
    expect(avec.plan?.echeancier).toHaveLength(3);
    expect(avec.planNonPropose).toMatch(/pas visé/);
  });
});

describe('visa des plans · le service', () => {
  const monter = (ligne: Record<string, unknown> | null) => {
    const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'a1', planSaisiPar: ligne?.planSaisiPar ?? null, ...data }));
    const prisma = {
      $transaction: async (f: (tx: unknown) => unknown) => f(prisma),
      $queryRaw: jest.fn(async () => []),
      avanceSalaire: {
        findFirst: jest.fn(async ({ where }: { where: { tenantId: string } }) => (where.tenantId === 't' ? ligne : null)),
        update,
      },
    };
    return { svc: new AvancesRubriquesService(prisma as never), update };
  };

  it("l'auteur reçoit un 403, un plan changé un 409", async () => {
    const { svc } = monter({ id: 'a1', ...plan });
    await expect(svc.viserPlan('t', 'a1', 'u1', saisiLe.toISOString())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.viserPlan('t', 'a1', 'u2', null)).rejects.toBeInstanceOf(ConflictException);
  });

  it('un autre utilisateur vise ; un plan sans auteur connu se vise et le dit', async () => {
    const { svc, update } = monter({ id: 'a1', ...plan });
    const r = await svc.viserPlan('t', 'a1', 'u2', saisiLe.toISOString());
    expect(update.mock.calls[0][0].data).toMatchObject({ planVisePar: 'u2' });
    expect(r.avertissement).toBeNull();
    const ancien = monter({ id: 'a1', ...plan, planSaisiPar: null, planSaisiLe: null });
    expect((await ancien.svc.viserPlan('t', 'a1', 'u1', null)).avertissement).toBe(AVERTISSEMENT_PLAN_AUTEUR_INCONNU);
  });

  it("modifier le plan fait tomber le visa, un envoi identique le garde", async () => {
    const existante = { id: 'a1', type: 'AVANCE', montantFc: 90_000, dateOctroi: new Date('2026-10-01'), retenueMensuelleFc: null, premierMoisRetenue: '2026-11', nombreEcheances: 3 };
    const { svc, update } = monter(existante);
    await svc.modifierEtalement('t', 'u3', 'a1', { premierMoisRetenue: '2026-11', nombreEcheances: 3 });
    expect(update.mock.calls[0][0].data).not.toHaveProperty('planVisePar');
    await svc.modifierEtalement('t', 'u3', 'a1', { premierMoisRetenue: '2026-11', nombreEcheances: 4 });
    expect(update.mock.calls[1][0].data).toMatchObject({ planSaisiPar: 'u3', planVisePar: null, planViseLe: null });
  });
});
