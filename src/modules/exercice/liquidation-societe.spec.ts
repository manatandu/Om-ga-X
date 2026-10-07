import { FormeJuridiqueSyscohada, Referentiel, RegimeLiquidation } from '@prisma/client';
import { jalonsLiquidation } from './liquidation-societe';
import { TenantService } from '../tenant/tenant.service';
import { ExerciceService } from './exercice.service';

/**
 * LIQUIDATION D'UNE SOCIÉTÉ COMMERCIALE (décision par la loi du 2026-10-04,
 * point 4) · AUDCIF art. 7, 39, Titre VIII ch. 40 ; AUSCGIE art. 201, 203,
 * 216 à 220, 223, 228, 232, 233, 266.
 */
const iso = (d: Date | null) => (d === null ? null : d.toISOString().slice(0, 10));
const EX_2026 = { dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) };
const EX_2027 = { dateDebut: new Date(Date.UTC(2027, 0, 1)), dateFin: new Date(Date.UTC(2027, 11, 31)) };
const EX_2025 = { dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) };
const AUJOURDHUI = new Date(Date.UTC(2026, 9, 1));
const base = {
  forme: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
  dateDissolution: new Date(Date.UTC(2026, 4, 31)),
  dateNominationLiquidateur: new Date(Date.UTC(2026, 5, 15)),
  regimeLiquidation: null as RegimeLiquidation | null,
};
const parLibelle = (j: ReturnType<typeof jalonsLiquidation>) => new Map(j.map((x) => [x.libelle, x]));

describe('Liquidation d’une société commerciale au planning', () => {
  it('chapitre 1 · bilan avant liquidation, publication à un mois, clôture à trois ans DATE À DATE', () => {
    const j = parLibelle(jalonsLiquidation(base, EX_2026, AUJOURDHUI));
    expect(iso(j.get('Bilan avant liquidation')!.echeance)).toBe('2026-05-31');
    expect(j.get('Bilan avant liquidation')!.detail).toContain('AUDCIF art. 39');
    expect(iso(j.get('Publication de la nomination du liquidateur')!.echeance)).toBe('2026-07-15');
    expect(j.get('Publication de la nomination du liquidateur')!.enRetard).toBe(true);
    // 31 mai 2026 + trois ans · 31 mai 2029.
    expect(iso(j.get('Clôture de la liquidation')!.echeance)).toBe('2029-05-31');
    // Régime non déclaré · situation provisoire au 31 décembre, et le manque dit.
    const situation = j.get('Situation annuelle provisoire de liquidation')!;
    expect(iso(situation.echeance)).toBe('2026-12-31');
    expect(situation.detail).toContain('Régime de la liquidation non déclaré');
    // Aucun jalon du chapitre 2 hors des cas de l'art. 223.
    expect(j.has('Rapport du liquidateur à l’assemblée des associés')).toBe(false);
  });

  it('art. 223 · rapport à six mois de la nomination, états à trois mois et assemblée à six mois de CHAQUE clôture', () => {
    const faits = { ...base, regimeLiquidation: RegimeLiquidation.ARTICLE_223_2_JUDICIAIRE };
    const j2026 = parLibelle(jalonsLiquidation(faits, EX_2026, AUJOURDHUI));
    expect(iso(j2026.get('Rapport du liquidateur à l’assemblée des associés')!.echeance)).toBe('2026-12-15');
    expect(iso(j2026.get('États financiers annuels et rapport écrit du liquidateur')!.echeance)).toBe('2027-03-31');
    expect(iso(j2026.get('Assemblée des associés sur les états annuels de liquidation')!.echeance)).toBe('2027-06-30');
    expect(j2026.has('Situation annuelle provisoire de liquidation')).toBe(false);
    // L'exercice suivant · au 31 décembre, jamais à l'anniversaire de la dissolution.
    const j2027 = parLibelle(jalonsLiquidation(faits, EX_2027, AUJOURDHUI));
    expect(iso(j2027.get('États financiers annuels et rapport écrit du liquidateur')!.echeance)).toBe('2028-03-31');
    expect(j2027.has('Bilan avant liquidation')).toBe(false);
    expect(j2027.has('Rapport du liquidateur à l’assemblée des associés')).toBe(false);
    expect(iso(j2027.get('Clôture de la liquidation')!.echeance)).toBe('2029-05-31');
  });

  it('sans nomination déclarée · échéances non calculées, jamais supposées', () => {
    const j = parLibelle(
      jalonsLiquidation(
        { ...base, dateNominationLiquidateur: null, regimeLiquidation: RegimeLiquidation.ARTICLE_223_1 },
        EX_2026,
        AUJOURDHUI,
      ),
    );
    expect(j.get('Publication de la nomination du liquidateur')!.echeance).toBeNull();
    expect(j.get('Rapport du liquidateur à l’assemblée des associés')!.echeance).toBeNull();
  });

  it('procédure collective · rien de l’AUSCGIE n’est calculé, et c’est dit ; exercice antérieur, coopérative · rien', () => {
    const pc = jalonsLiquidation({ ...base, regimeLiquidation: RegimeLiquidation.PROCEDURE_COLLECTIVE }, EX_2026, AUJOURDHUI);
    expect(pc).toHaveLength(1);
    expect(pc[0].source).toBe('AUSCGIE, art. 203 al. 2');
    expect(pc[0].echeance).toBeNull();
    expect(jalonsLiquidation(base, EX_2025, AUJOURDHUI)).toEqual([]);
    expect(jalonsLiquidation({ ...base, forme: FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE }, EX_2026, AUJOURDHUI)).toEqual([]);
    expect(jalonsLiquidation({ ...base, dateDissolution: null }, EX_2026, AUJOURDHUI)).toEqual([]);
  });
});

describe('Liquidation · câblée au planning de clôture', () => {
  it('le planning de l’exercice de dissolution sert les jalons de la liquidation, après ceux de l’exercice', async () => {
    const exercice = { id: 'e1', tenantId: 't1', ...EX_2026, statut: 'OUVERT', dateAssembleeGenerale: null, dateDepotEtatsPortefeuille: null };
    const prisma = {
      exercice: { findFirst: jest.fn().mockResolvedValue(exercice) },
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          referentiel: Referentiel.SYSCOHADA,
          formeJuridique: 'ASSOCIATION',
          formeJuridiqueSyscohada: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
          droitEtranger: false,
          associeUniqueSas: null,
          entreprisePortefeuilleEtat: null,
          dateDissolution: base.dateDissolution,
          dateNominationLiquidateur: base.dateNominationLiquidateur,
          regimeLiquidation: null,
        }),
      },
      ecriture: { count: jest.fn().mockResolvedValue(0) },
      transcriptionInventaire: { count: jest.fn().mockResolvedValue(0) },
      rapportActivite: { count: jest.fn().mockResolvedValue(0) },
      donation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const p = await new ExerciceService(prisma as never, {} as never).planningCloture('t1', 'e1');
    const libelles = p.jalons.map((j: { libelle: string }) => j.libelle);
    expect(libelles).toContain('Bilan avant liquidation');
    expect(libelles.indexOf('Bilan avant liquidation')).toBeGreaterThan(libelles.indexOf('Affectation du résultat'));
  });
});

describe('Liquidation · faits déclarés au dossier', () => {
  function service(tenant: Record<string, unknown>, capture: { data?: Record<string, unknown> } = {}) {
    const t = { id: 't1', referentiel: Referentiel.SYSCOHADA, ...tenant };
    return new TenantService({
      tenant: {
        findUnique: async () => t,
        findUniqueOrThrow: async () => t,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          capture.data = data;
          return { id: 't1' };
        },
      },
      exercice: { findFirst: async () => null, count: async () => 0 },
      ecriture: { count: async () => 0 },
      compte: { findMany: async () => [] },
    } as never);
  }

  it('associé unique personne morale · aucune liquidation (art. 201 al. 4), le refus le dit', async () => {
    const sa = { formeJuridiqueSyscohada: FormeJuridiqueSyscohada.SOCIETE_ANONYME };
    await expect(
      service(sa).modifierIdentite('t1', { associeUniquePersonneMorale: 'OUI', dateDissolution: '2026-05-31' }),
    ).rejects.toThrow('art. 201 al. 4');
    await expect(
      service({ ...sa, associeUniquePersonneMorale: true }).modifierIdentite('t1', { dateDissolution: '2026-05-31' }),
    ).rejects.toThrow('sans qu’il y ait lieu');
    const capture: { data?: Record<string, unknown> } = {};
    await service(sa, capture).modifierIdentite('t1', {
      dateDissolution: '2026-05-31',
      dateNominationLiquidateur: '2026-06-15',
      regimeLiquidation: 'ARTICLE_223_1',
      associeUniquePersonneMorale: 'NON',
    });
    expect(capture.data).toMatchObject({ regimeLiquidation: 'ARTICLE_223_1', associeUniquePersonneMorale: false });
  });

  it('nomination avant la dissolution refusée ; régime refusé hors société commerciale', async () => {
    const sarl = { formeJuridiqueSyscohada: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE };
    await expect(
      service(sarl).modifierIdentite('t1', { dateDissolution: '2026-05-31', dateNominationLiquidateur: '2026-05-01' }),
    ).rejects.toThrow('art. 204');
    await expect(
      service({ formeJuridiqueSyscohada: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE }).modifierIdentite('t1', {
        regimeLiquidation: 'AMIABLE_STATUTAIRE',
      }),
    ).rejects.toThrow('société commerciale');
  });
});
