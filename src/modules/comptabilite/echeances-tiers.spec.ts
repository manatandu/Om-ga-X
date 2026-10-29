import { StatutEcriture } from '@prisma/client';
import { EcheancesTiersService, PLAFOND_ECHEANCES_TIERS } from './echeances-tiers.service';

/**
 * Ligne gl-saisie, fonction 34 · les échéances proches des tiers au tableau
 * de bord. À échoir et échu, comptés sur tout le périmètre ; le sens normal
 * seul ; une ligne sans échéance comptée à part, jamais rangée.
 */
describe('échéances proches des tiers', () => {
  // Midi à Kinshasa, le 1er juin 2026 · le jour de référence est le 1er juin.
  const MAINTENANT = new Date('2026-06-01T11:00:00Z');
  const d = (j: string) => new Date(`${j}T00:00:00Z`);
  let n = 0;
  const l = (numero: string, debit: number, credit: number, echeance: string | null, nom = 'Tiers') => ({
    id: `l${++n}`,
    debit,
    credit,
    lettrageId: null,
    deviseId: null,
    montantDevise: null,
    libelle: null,
    dateEcheance: echeance ? d(echeance) : null,
    compte: { numero, tiersCompte: { tiers: { nom } } },
    ecriture: { date: d('2026-05-01'), libelle: `Facture ${numero}` },
  });
  function service(lignes: ReturnType<typeof l>[]) {
    const prisma = {
      ligneEcriture: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn(async ({ cursor }: { cursor?: unknown; where?: unknown }) => (cursor ? [] : lignes)),
      },
    };
    return { svc: new EcheancesTiersService(prisma as never), prisma };
  }

  it('range à échoir dans les trente jours et déjà échu, au sens normal, sans échéance compté à part', async () => {
    const { svc, prisma } = service([
      l('41110001', 100_000, 0, '2026-06-10', 'Client A'),
      l('40110001', 0, 60_000, '2026-06-30', 'Fournisseur B'),
      l('41110002', 25_000, 0, '2026-05-15'),
      l('41110003', 9_000, 0, '2026-08-01'),
      l('41110004', 7_000, 0, null),
      // Un règlement non lettré, un avoir, une avance · aucun n'échoit.
      l('41110001', 0, 30_000, '2026-06-05'),
      l('40110001', 10_000, 0, '2026-06-05'),
      l('41910000', 0, 5_000, '2026-06-05'),
    ]);
    const r = await svc.echeancesProches('t1', 'x1', MAINTENANT);
    expect(r.dateReference).toBe('2026-06-01');
    expect(r.aEchoir).toEqual({ nombre: 2, aEncaisser: 100_000, aPayer: 60_000 });
    expect(r.echu).toEqual({ nombre: 1, aEncaisser: 25_000, aPayer: 0 });
    expect(r.sansEcheance).toBe(1);
    expect(r.proches.map((p) => [p.compteNumero, p.sens, p.joursRestants, p.tiers])).toEqual([
      ['41110001', 'A_ENCAISSER', 9, 'Client A'],
      ['40110001', 'A_PAYER', 29, 'Fournisseur B'],
    ]);
    // La lecture porte le dossier, l'exercice et écarte les simulations, lettrées exclues.
    const where = prisma.ligneEcriture.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ ecriture: { tenantId: 't1', exerciceId: 'x1', statut: { not: StatutEcriture.SITUATION } }, lettre: null });
  });

  it('borne la liste aux plus proches et le dit, les cumuls restent entiers', async () => {
    const lignes = Array.from({ length: PLAFOND_ECHEANCES_TIERS + 5 }, (_, i) => l('41110001', 1_000, 0, `2026-06-${String(2 + (i % 28)).padStart(2, '0')}`));
    const r = await service(lignes).svc.echeancesProches('t1', 'x1', MAINTENANT);
    expect(r.proches).toHaveLength(PLAFOND_ECHEANCES_TIERS);
    expect(r.tronque).toBe(true);
    expect(r.aEchoir.nombre).toBe(PLAFOND_ECHEANCES_TIERS + 5);
    expect(r.proches[0].date <= r.proches[r.proches.length - 1].date).toBe(true);
  });
});
