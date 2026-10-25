import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { etatDesLignes, famille, ligne, nonCalculee, synthese } from './concordance';
import { ConcordanceService } from './concordance.service';

/**
 * LA CONCORDANCE DES MODULES (ligne microfina-m1, idée 12). Ce qui casserait
 * en silence ·
 *  · un refus du module lu comme une concordance (« rien d'écart ») · la
 *    réponse favorable à la question que l'écran pose ;
 *  · un montant absent lu comme zéro · un écart nul fabriqué ;
 *  · une confrontation recalculée ici, qui divergerait de celle du module ;
 *  · une écriture, ou une route qui écrit.
 */

describe('les lignes et l’état d’une famille', () => {
  it('l’écart est la comptabilité moins le module, au centime', () => {
    expect(ligne('2441', 'Mobilier', 1_000_000, 1_000_000.004).ecart).toBe(0);
    expect(ligne('2441', 'Mobilier', 1_000_000, 950_000).ecart).toBe(-50_000);
  });

  it('un montant absent ne fabrique jamais un écart nul', () => {
    expect(ligne('521', 'Banque', 100, null).ecart).toBeNull();
    expect(etatDesLignes([ligne('a', '', 1, 1), ligne('b', '', 2, null)])).toBe('NON_CALCULE');
  });

  it('concorde, écart, sans objet', () => {
    expect(etatDesLignes([ligne('a', '', 1, 1)])).toBe('CONCORDE');
    expect(etatDesLignes([ligne('a', '', 1, 1), ligne('b', '', 2, 3)])).toBe('ECART');
    expect(etatDesLignes([])).toBe('SANS_OBJET');
  });

  it('une famille non calculée ne compte jamais parmi celles qui concordent', () => {
    const e = { cle: 'X', libelle: 'X', source: 's', ecran: 'e', chemin: '/x' };
    const s = synthese([famille(e, [ligne('a', '', 1, 1)]), nonCalculee(e, 'refus'), famille(e, [])]);
    expect(s).toEqual({ concordent: 1, ecarts: 0, nonCalculees: 1, sansObjet: 1 });
  });
});

function monter(o: {
  maintenance?: () => Promise<unknown>;
  provisions?: () => Promise<unknown>;
  creances?: () => Promise<unknown>;
  analytique?: () => Promise<unknown>;
  rapprochements?: unknown[];
  obtenir?: (tenantId: string, id: string) => Promise<unknown>;
} = {}) {
  const prisma = {
    exercice: { findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) => (where.id === 'ex' && where.tenantId === 't' ? { id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' } : null)) },
    rapprochementBancaire: { findMany: jest.fn(async () => o.rapprochements ?? []) },
  };
  const maintenance = {
    maintenance: jest.fn(
      o.maintenance ??
        (async () => ({
          comptesBien: [{ numero: '24410000', intitule: 'Mobilier', registre: 1_000_000, balance: 1_000_000, ecart: 0, lignesSansFiche: { nombre: 0, montant: 0 } }],
          comptesAmortissement: [{ numero: '28441000', intitule: 'Amort. mobilier', registre: 200_000, balance: 150_000, ecart: -50_000 }],
          dotationsAPasser: { nombre: 1, montant: 50_000 },
          reclassesApresLaClotureTotal: 0,
        })),
    ),
  };
  const provisions = { tableauDeVariation: jest.fn(o.provisions ?? (async () => ({ rapprochement: [], passifsEventuels: [] }))) };
  const creances = { lister: jest.fn(o.creances ?? (async () => ({ total: 0, rapprochement: null }))) };
  const analytique = { controleCumuls: jest.fn(o.analytique ?? (async () => [])) };
  const rapprochements = { obtenir: jest.fn(o.obtenir ?? (async () => ({}))) };
  const svc = new ConcordanceService(prisma as never, maintenance as never, provisions as never, creances as never, analytique as never, rapprochements as never);
  return { svc, maintenance, prisma, rapprochements };
}

describe('la concordance relit les confrontations des modules', () => {
  it('l’exercice d’un autre dossier est un 404 nommé', async () => {
    await expect(monter().svc.concordance('autre', 'ex')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('relit le registre des biens tel que la maintenance le confronte, sans le recalculer', async () => {
    const { svc, maintenance } = monter();
    const r = await svc.concordance('t', 'ex');
    expect(maintenance.maintenance).toHaveBeenCalledWith('t', 'ex');
    const brut = r.familles.find((f) => f.cle === 'IMMOBILISATIONS')!;
    expect(brut.etat).toBe('CONCORDE');
    const amort = r.familles.find((f) => f.cle === 'AMORTISSEMENTS')!;
    expect(amort.etat).toBe('ECART');
    expect(amort.lignes[0]).toMatchObject({ module: 200_000, comptabilite: 150_000, ecart: -50_000 });
    expect(brut.mentions.join(' ')).toMatch(/dotation calculée non passée/);
  });

  it('un refus du module rend la famille NON CALCULÉE avec son motif, jamais concordante', async () => {
    const { svc } = monter({ maintenance: async () => Promise.reject(new BadRequestException('Plus de 5000 fiches · la maintenance ne les relit pas d’un coup.')) });
    const r = await svc.concordance('t', 'ex');
    for (const cle of ['IMMOBILISATIONS', 'AMORTISSEMENTS']) {
      const f = r.familles.find((x) => x.cle === cle)!;
      expect(f.etat).toBe('NON_CALCULE');
      expect(f.motif).toMatch(/Plus de 5000 fiches/);
    }
    // Les autres familles sont lues quand même.
    expect(r.familles.find((x) => x.cle === 'PROVISIONS')!.etat).toBe('SANS_OBJET');
  });

  it('une panne imprévue est consignée au journal du serveur, et la famille dite non calculée', async () => {
    const { svc } = monter({ provisions: async () => Promise.reject(new TypeError('boom')) });
    const journal = jest.spyOn((svc as unknown as { journalServeur: { error: (...a: unknown[]) => void } }).journalServeur, 'error').mockImplementation(() => undefined);
    const r = await svc.concordance('t', 'ex');
    expect(journal).toHaveBeenCalled();
    expect(r.familles.find((x) => x.cle === 'PROVISIONS')!).toMatchObject({ etat: 'NON_CALCULE', motif: expect.stringMatching(/consigné/) });
  });

  it('les créances douteuses · le 416 et le 491 du module face aux soldes, provisoires dits', async () => {
    const { svc } = monter({
      creances: async () => ({
        total: 1,
        rapprochement: { provisoire: true, reportProvisoire: false, solde416: 1_160_000, resteModule: 1_160_000, solde491: 400_000, depreciationModule: 500_000, horsModule491: 0 },
      }),
    });
    const f = (await svc.concordance('t', 'ex')).familles.find((x) => x.cle === 'CREANCES_DOUTEUSES')!;
    expect(f.etat).toBe('ECART');
    expect(f.lignes.map((l) => [l.reference, l.ecart])).toEqual([
      ['416', 0],
      ['491', -100_000],
    ]);
    expect(f.mentions.join(' ')).toMatch(/provisoires/);
  });

  it('la banque · relevé face au solde pointé du module ; sans solde de départ, non calculé', async () => {
    const { svc, rapprochements } = monter({
      rapprochements: [
        { id: 'r1', statut: 'CLOTURE', dateReleve: new Date('2026-12-31'), compte: { numero: '52110000', intitule: 'Banque A' } },
        { id: 'r2', statut: 'EN_COURS', dateReleve: new Date('2026-12-31'), compte: { numero: '52120000', intitule: 'Banque B' } },
      ],
      obtenir: async (_t: string, id: string) =>
        id === 'r1' ? { rapprochement: { soldeReleve: '2500000' }, soldePointe: 2_500_000 } : { rapprochement: { soldeReleve: '900000' }, soldePointe: null },
    });
    const f = (await svc.concordance('t', 'ex')).familles.find((x) => x.cle === 'BANQUES')!;
    expect(rapprochements.obtenir).toHaveBeenCalledWith('t', 'r1');
    expect(f.etat).toBe('NON_CALCULE');
    expect(f.lignes[0]).toMatchObject({ reference: '52110000', ecart: 0 });
    expect(f.lignes[1]).toMatchObject({ reference: '52120000', comptabilite: null, ecart: null });
  });

  it('ce qu’aucun module ne confronte se dit · jamais tu, jamais concordant', async () => {
    const r = await monter().svc.concordance('t', 'ex');
    expect(r.familles.find((x) => x.cle === 'STOCKS')!.etat).toBe('NON_CALCULE');
    expect(r.familles.find((x) => x.cle === 'PAIE')!.etat).toBe('NON_CALCULE');
    expect(r.familles.find((x) => x.cle === 'TIERS')!.etat).toBe('SANS_OBJET');
  });
});

describe('une LECTURE, et rien d’autre', () => {
  it('le contrôleur n’a aucune route qui écrit, le service aucun appel qui écrit', () => {
    const controleur = readFileSync(join(__dirname, 'concordance.controller.ts'), 'utf8');
    expect(controleur).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
    const service = readFileSync(join(__dirname, 'concordance.service.ts'), 'utf8');
    expect(service).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/);
    expect(service).not.toMatch(/\$executeRaw|\$queryRaw/);
  });

  it('la liste des banques est bornée et le dépassement se dit', () => {
    const service = readFileSync(join(__dirname, 'concordance.service.ts'), 'utf8');
    expect(service).toContain('take: PLAFOND_BANQUES + 1');
    expect(service).toContain('Plus de ${PLAFOND_BANQUES} comptes rapprochés');
  });
});
