import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { CompteService } from './compte.service';
import { comptesNonPersonnalises, motifComptesNonPersonnalises } from './comptes-proposes';
import { PLAN_COMPTES_SYCEBNL } from './compte-seed';
import { PLAN_COMPTES_SYSCOHADA } from './compte-seed-syscohada';
import { numerosSemes, sousComptePropose } from './subdivisions-du-plan';
import { EcritureService } from '../comptabilite/ecriture.service';
import { TiersService } from '../tiers/tiers.service';
import { JournalService } from '../journaux/journal.service';

/**
 * COMPTES PERSONNALISÉS (décision de Manasse du 2026-10-09 · « seuls les
 * numéros personnalisés sont ceux qui s'affichent et permettent de passer les
 * écritures » ; « on ne peut pas rattacher un numéro de compte dans un tiers
 * ou une banque sans que ce numéro ne soit créé ou personnalisé » ; « ces
 * comptes personnalisés fonctionnent exactement comme leur compte racine »).
 *
 * Personnalisé = RETENU par le cabinet (adopté ou créé) ou UTILISÉ (adopté
 * d'office). La doublure honore ses filtres · la lecture des comptes rend
 * ceux du dossier, de l'identifiant demandé, non retenus et d'imputation
 * seulement, et chaque relation ne rend que les identifiants demandés.
 */
type C = { id: string; tenantId: string; numero: string; intitule: string; estRetenu: boolean; typeCompte: 'DETAIL' | 'TOTAL'; classe?: string };
const COMPTES: C[] = [
  // Adopté par le cabinet.
  { id: 'c411', tenantId: 't1', numero: '41110000', intitule: 'Clients', estRetenu: true, typeCompte: 'DETAIL', classe: 'CLASSE_4' },
  // Utilisé · une écriture de paie l'a mouvementé, il est personnalisé d'office.
  { id: 'c661', tenantId: 't1', numero: '66110000', intitule: 'Appointements', estRetenu: false, typeCompte: 'DETAIL' },
  // Porté par le journal BQ semé · personnalisé d'office.
  { id: 'c521', tenantId: 't1', numero: '52110000', intitule: 'Banques locales', estRetenu: false, typeCompte: 'DETAIL', classe: 'CLASSE_5' },
  // Ni retenu ni utilisé · non personnalisé.
  { id: 'c622', tenantId: 't1', numero: '62200000', intitule: 'Locations et charges locatives', estRetenu: false, typeCompte: 'DETAIL' },
  { id: 'c4011', tenantId: 't1', numero: '40110000', intitule: 'Fournisseurs', estRetenu: false, typeCompte: 'DETAIL', classe: 'CLASSE_4' },
  { id: 'c5212', tenantId: 't1', numero: '52120000', intitule: 'Banques autres États', estRetenu: false, typeCompte: 'DETAIL', classe: 'CLASSE_5' },
  // Un Total n'est jamais jugé ici · sa propre règle le refuse.
  { id: 't62', tenantId: 't1', numero: '62', intitule: 'Services extérieurs', estRetenu: false, typeCompte: 'TOTAL' },
  // Le même numéro dans un autre dossier, retenu · jamais lu pour t1.
  { id: 'v622', tenantId: 't2', numero: '62200000', intitule: 'Locations', estRetenu: false, typeCompte: 'DETAIL' },
];
const REFERENCES: Record<string, Record<string, string>[]> = {
  ligneEcriture: [{ compteId: 'c661' }],
  journal: [{ compteTresorerieId: 'c521' }],
};

type Where = { tenantId?: string; id?: string | { in: string[] }; estRetenu?: boolean; typeCompte?: string };

/** La lecture « qui se réfère à ces comptes » d'une relation, telle que `identifiantsUtilises` la fait (un regroupement). */
function lectureDesReferences(nom: string) {
  return jest.fn(async ({ where, by }: { where: Record<string, { in: string[] }>; by: string[] }) => {
    const champ = by[0];
    const lignes = (REFERENCES[nom] ?? []).filter((l) => l[champ] && where[champ]?.in?.includes(l[champ]));
    return [...new Map(lignes.map((l) => [l[champ], { [champ]: l[champ] }])).values()];
  });
}

function prisma(extra: Record<string, unknown> = {}) {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(cible, nom: string) {
      if (nom in cible) {
        const d = cible[nom] as Record<string, unknown>;
        // Une table que le test double pour son propre geste répond aussi à
        // la lecture des références, sans que le test ait à l'écrire.
        if (d && typeof d === 'object' && nom !== 'compte' && !('groupBy' in d)) d.groupBy = lectureDesReferences(nom);
        return d;
      }
      return { groupBy: lectureDesReferences(nom) };
    },
  };
  const compte = {
    findMany: jest.fn(async ({ where }: { where: Where }) =>
      COMPTES.filter(
        (c) =>
          c.tenantId === where.tenantId &&
          (typeof where.id !== 'object' || where.id.in.includes(c.id)) &&
          (where.estRetenu === undefined || c.estRetenu === where.estRetenu) &&
          (where.typeCompte === undefined || c.typeCompte === where.typeCompte),
      ),
    ),
    findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
      COMPTES.find((c) => c.id === where.id && c.tenantId === where.tenantId) ?? null,
    ),
  };
  return new Proxy({ compte, ...extra } as Record<string, unknown>, handler);
}

describe('le compte personnalisé · une seule règle', () => {
  it('rend les comptes ni retenus ni utilisés, jamais un retenu, un utilisé, un Total ou le compte d’un voisin', async () => {
    const non = await comptesNonPersonnalises(prisma(), 't1', ['c411', 'c661', 'c521', 'c622', 't62', 'v622', 'c622']);
    expect(non.map((c) => c.numero)).toEqual(['62200000']);
  });

  it('un identifiant répété n’est demandé qu’une fois', async () => {
    const p = prisma();
    await comptesNonPersonnalises(p, 't1', ['c622', 'c622', 'c411']);
    const where = ((p.compte as { findMany: jest.Mock }).findMany.mock.calls[0][0] as { where: { id: { in: string[] } } }).where;
    expect(where.id.in).toEqual(['c622', 'c411']);
  });

  it('aucun identifiant, aucune lecture', async () => {
    const p = prisma();
    await expect(comptesNonPersonnalises(p, 't1', [])).resolves.toEqual([]);
    expect((p.compte as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
  });

  it('le refus nomme le compte, le geste, et dit comment le lever', () => {
    expect(motifComptesNonPersonnalises([], 'une saisie')).toBeNull();
    const m = motifComptesNonPersonnalises([{ numero: '62200000', intitule: 'Locations' }], 'une saisie');
    expect(m).toContain('Compte non personnalisé : 62200000 Locations');
    expect(m).toContain('une saisie ne se fait que sur un compte personnalisé');
    expect(m).toContain('Plan comptable');
    expect(m).toMatch(/adoptez le compte du plan tel quel, ou ouvrez un sous-compte/);
    // Le comptable ne personnalise pas lui-même · le refus dit à qui revient le geste.
    expect(m).toContain("geste de l'administrateur du dossier");
  });

  it('au-delà de cinq comptes, le refus compte les autres au lieu de les taire', () => {
    const six = Array.from({ length: 7 }, (_, i) => ({ numero: `6220000${i}`, intitule: 'L' }));
    expect(motifComptesNonPersonnalises(six, 'une saisie')).toContain('et 2 autre(s)');
  });
});

describe('la saisie n’admet que les comptes personnalisés', () => {
  const ecritures = () => new EcritureService(prisma() as never, {} as never, {} as never, {} as never);

  it('refuse une pièce qui porte un compte non personnalisé, en le nommant', async () => {
    await expect(
      ecritures().verifierComptesPersonnalises('t1', [{ compteId: 'c521' }, { compteId: 'c622' }]),
    ).rejects.toThrow(/Compte non personnalisé : 62200000/);
  });

  it('admet un compte adopté, un compte mouvementé et le compte d’un journal', async () => {
    await expect(
      ecritures().verifierComptesPersonnalises('t1', [{ compteId: 'c411' }, { compteId: 'c661' }, { compteId: 'c521' }]),
    ).resolves.toBeUndefined();
  });

  it('nomme le geste de la réimputation', async () => {
    await expect(ecritures().verifierComptesPersonnalises('t1', [{ compteId: 'c622' }], 'une réimputation')).rejects.toThrow(
      /une réimputation ne se fait que sur un compte personnalisé/,
    );
  });
});

describe('un tiers ou une banque ne se rattache qu’à un compte personnalisé', () => {
  it('le tiers refuse un compte de classe 4 non personnalisé, sans rien écrire', async () => {
    const tiersCompte = { findUnique: jest.fn(async () => null), create: jest.fn() };
    const p = prisma({ tiers: { findFirst: jest.fn(async () => ({ id: 'ti1', tenantId: 't1' })) }, tiersCompte });
    const svc = new TiersService(p as never);
    await expect(svc.rattacherCompte('t1', 'ti1', { compteId: 'c4011' } as never)).rejects.toThrow(BadRequestException);
    await expect(svc.rattacherCompte('t1', 'ti1', { compteId: 'c4011' } as never)).rejects.toThrow(
      /le rattachement à un tiers ne se fait que sur un compte personnalisé/,
    );
    expect(tiersCompte.create).not.toHaveBeenCalled();
  });

  it('le journal de banque refuse un compte existant non personnalisé, à la création et à la modification', async () => {
    const journal = {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async ({ where }: { where: { id?: string } }) =>
        where.id === 'j1' ? { id: 'j1', tenantId: 't1', code: 'BQ2', type: 'TRESORERIE', compteTresorerieId: 'c521' } : null,
      ),
      create: jest.fn(),
      update: jest.fn(),
    };
    const p = prisma({ journal, tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA' })) } });
    const svc = new JournalService(p as never);
    await expect(
      svc.creer('t1', { code: 'BQ3', intitule: 'Rawbank', type: 'TRESORERIE', compteTresorerieId: 'c5212' } as never),
    ).rejects.toThrow(/le rattachement à un journal ne se fait que sur un compte personnalisé/);
    await expect(svc.modifier('t1', 'j1', { compteTresorerieId: 'c5212' } as never)).rejects.toThrow(/Compte non personnalisé : 52120000/);
    expect(journal.create).not.toHaveBeenCalled();
    expect(journal.update).not.toHaveBeenCalled();
  });
});

describe('un sous-compte fonctionne comme son compte du plan', () => {
  function monde(parent: Record<string, unknown> | null) {
    const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => data);
    const p = {
      tenant: { findUniqueOrThrow: jest.fn(async () => ({ id: 't1', longueurCompte: 8, referentiel: 'SYSCOHADA' })) },
      compte: {
        findUnique: jest.fn(async ({ where }: { where: { tenantId_numero: { numero: string } } }) =>
          where.tenantId_numero.numero === '52110000' ? parent : null,
        ),
        create,
      },
      natureCompte: { findMany: jest.fn(async () => []), createMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 7) },
    };
    return { svc: new CompteService(p as never), create, p };
  }
  const DU_PLAN = {
    lettrable: true,
    modeReportANouveau: 'DETAIL',
    tauxTvaDefautId: 'tva-16',
    comportementGestion: 'FIXE',
    partVariableGestionPct: null,
    codeRetraitementFiscal: 'AMENDES',
  };

  it('reprend lettrage, report, taxe et comportement de gestion du compte du plan qu’il subdivise', async () => {
    const { svc, create, p } = monde(DU_PLAN);
    await svc.creer('t1', { numero: '52110001', intitule: 'Rawbank' } as never);
    expect(p.compte.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId_numero: { tenantId: 't1', numero: '52110000' } } }));
    expect(create.mock.calls[0][0].data).toMatchObject({
      numero: '52110001',
      lettrable: true,
      modeReportANouveau: 'DETAIL',
      tauxTvaDefautId: 'tva-16',
      comportementGestion: 'FIXE',
    });
    // Le traitement fiscal est la décision du cabinet sur SON compte · jamais
    // hérité. Le fonds d'un bailleur non plus · il en nomme UN.
    expect(create.mock.calls[0][0].data).not.toHaveProperty('codeRetraitementFiscal');
    expect(create.mock.calls[0][0].data).not.toHaveProperty('bailleurId');
    expect(create.mock.calls[0][0].data).not.toHaveProperty('porteFondsContrepartieEtat');
    // Un compte de banque n'est pas le collectif d'une panoplie de tiers.
    expect(create.mock.calls[0][0].data).not.toHaveProperty('collectifId');
  });

  it('sous le collectif d’une panoplie de tiers, le compte s’y rattache comme celui que la panoplie ouvre', async () => {
    const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => data);
    const p = {
      tenant: { findUniqueOrThrow: jest.fn(async () => ({ id: 't1', longueurCompte: 8, referentiel: 'SYSCOHADA' })) },
      compte: {
        findUnique: jest.fn(async ({ where }: { where: { tenantId_numero: { numero: string } } }) =>
          where.tenantId_numero.numero === '40110000' ? { id: 'c4011', ...DU_PLAN } : null,
        ),
        create,
      },
      natureCompte: { findMany: jest.fn(async () => []), createMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 7) },
    };
    await new CompteService(p as never).creer('t1', { numero: '40110001', intitule: 'Nova Services' } as never);
    expect(create.mock.calls[0][0].data).toMatchObject({ numero: '40110001', collectifId: 'c4011' });
  });

  it('ce que la création précise prime sur le compte du plan', async () => {
    const { svc, create } = monde(DU_PLAN);
    await svc.creer('t1', { numero: '52110001', intitule: 'Rawbank', lettrable: false, tauxTvaDefautId: null } as never);
    expect(create.mock.calls[0][0].data).toMatchObject({ lettrable: false, tauxTvaDefautId: null });
  });

  it('un numéro qui ne subdivise aucun compte du plan ne reprend rien', async () => {
    const { svc, create, p } = monde(DU_PLAN);
    await svc.creer('t1', { numero: '52100001', intitule: 'Hors racine' } as never);
    expect(p.compte.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId_numero: { tenantId: 't1', numero: '52110000' } } }),
    );
    expect(create.mock.calls[0][0].data).not.toHaveProperty('tauxTvaDefautId');
  });
});

describe('le Plan comptable dit le compte du plan et le compte subdivisé', () => {
  it('un compte du plan sous lequel le dossier a ouvert un compte actif est subdivisé, sauf celui d’un journal de banque', async () => {
    const plan = [
      { id: 'a', tenantId: 't1', numero: '52110000', typeCompte: 'DETAIL', estActif: true, estRetenu: false },
      { id: 'b', tenantId: 't1', numero: '52110001', typeCompte: 'DETAIL', estActif: true, estRetenu: true },
      { id: 'c', tenantId: 't1', numero: '62210000', typeCompte: 'DETAIL', estActif: true, estRetenu: false },
      { id: 'd', tenantId: 't1', numero: '62210001', typeCompte: 'DETAIL', estActif: true, estRetenu: true },
      { id: 'e', tenantId: 't1', numero: '62220000', typeCompte: 'DETAIL', estActif: true, estRetenu: false },
      // Un sous-compte en sommeil rend son compte du plan à la saisie.
      { id: 'f', tenantId: 't1', numero: '62220001', typeCompte: 'DETAIL', estActif: false, estRetenu: true },
    ];
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(cible, nom: string) {
        return nom in cible ? cible[nom] : { groupBy: jest.fn(async () => []) };
      },
    };
    const p = new Proxy(
      {
        compte: { findMany: jest.fn(async () => plan) },
        natureCompte: { findMany: jest.fn(async () => []), createMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 7) },
        tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA' })) },
        journal: { findMany: jest.fn(async () => [{ compteTresorerieId: 'a' }]), groupBy: jest.fn(async () => [{ compteTresorerieId: 'a' }]) },
      } as Record<string, unknown>,
      handler,
    );
    const r = await new CompteService(p as never).lister('t1', { usage: true });
    const lu = (n: string) => r.find((c) => c.numero === n) as { duPlan: boolean; subdivise: boolean };
    expect(lu('52110000')).toMatchObject({ duPlan: true, subdivise: false });
    expect(lu('52110001')).toMatchObject({ duPlan: false, subdivise: false });
    expect(lu('62210000')).toMatchObject({ duPlan: true, subdivise: true });
    expect(lu('62220000')).toMatchObject({ duPlan: true, subdivise: false });
  });
});

describe('le numéro proposé d’un sous-compte', () => {
  it('le premier libre sous la racine, à la longueur du dossier', () => {
    expect(sousComptePropose('SYSCOHADA', '52110000', 8, [])).toBe('52110001');
    expect(sousComptePropose('SYSCOHADA', '52110000', 8, ['52110001', '52110000'])).toBe('52110002');
    expect(sousComptePropose('SYSCOHADA', '52110000', 10, [])).toBe('5211000001');
  });

  it('la racine officielle, jamais le numéro dépouillé · le 49000000 est le 490', () => {
    expect(sousComptePropose('SYSCOHADA', '49000000', 8, [])).toBe('49000001');
  });

  it('jamais sous une racine semée plus profonde · le 8311 relève du 8311, pas du 831', () => {
    expect(sousComptePropose('SYCEBNL', '83100000', 4, [])).toBe('8312');
  });

  it('rien pour un Total, un numéro hors du plan, ou une racine pleine', () => {
    expect(sousComptePropose('SYSCOHADA', '52', 8, [])).toBeNull();
    expect(sousComptePropose('SYSCOHADA', '52110001', 8, [])).toBeNull();
    const pleins = Array.from({ length: 9999 }, (_, i) => `5211${String(i + 1).padStart(4, '0')}`);
    expect(sousComptePropose('SYSCOHADA', '52110000', 8, pleins)).toBeNull();
  });
});

describe('ne garder que les utilisés ne touche qu’au plan officiel', () => {
  it('les comptes que le cabinet a créés restent personnalisés', async () => {
    const updateMany = jest.fn(async () => ({ count: 3 }));
    const p = {
      tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYCEBNL' })) },
      compte: { updateMany },
    };
    await new CompteService(p as never).neRetenirQueLesUtilises('t1');
    const where = (updateMany.mock.calls[0] as unknown as [{ where: { tenantId: string; estRetenu: boolean; numero: { in: string[] } } }])[0].where;
    expect(where.tenantId).toBe('t1');
    expect(where.estRetenu).toBe(true);
    expect(new Set(where.numero.in)).toEqual(new Set(numerosSemes('SYCEBNL' as never)));
    expect(where.numero.in).not.toContain('52110001');
  });
});

describe('la migration des dossiers existants', () => {
  const sql = readFileSync(join(__dirname, '../../../prisma/migrations/20270164000000_comptes_personnalises/migration.sql'), 'utf8');

  it('porte les comptes d’imputation semés au jour de la migration, une fois chacun', () => {
    // UNE MIGRATION APPLIQUÉE NE SE RETOUCHE PAS · la liste est figée au jour
    // de son écriture (880 au SYCEBNL, 1 130 au SYSCOHADA, relus contre les
    // deux semis ce jour-là), jamais confrontée au semis VIVANT, qu'un ajout
    // légitime ferait diverger d'elle.
    const lus = [...sql.matchAll(/\('(SYCEBNL|SYSCOHADA)','(\d+)'\)/g)].map((m) => `${m[1]}:${m[2]}`);
    expect(new Set(lus).size).toBe(lus.length);
    expect(lus.filter((x) => x.startsWith('SYCEBNL:'))).toHaveLength(880);
    expect(lus.filter((x) => x.startsWith('SYSCOHADA:'))).toHaveLength(1130);
    for (const x of ['SYSCOHADA:52110000', 'SYSCOHADA:62210000', 'SYSCOHADA:40110000', 'SYCEBNL:41100000', 'SYCEBNL:52110000']) expect(lus).toContain(x);
    // Jamais un compte Total.
    const totaux = new Set([
      ...PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte === 'TOTAL').map((c) => `SYCEBNL:${c.numero}`),
      ...PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte === 'TOTAL').map((c) => `SYSCOHADA:${c.numero}`),
    ]);
    expect(lus.filter((x) => totaux.has(x))).toEqual([]);
  });

  it('ne touche qu’aux dossiers dont aucun compte n’est non retenu, et qu’aux comptes d’imputation', () => {
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM comptes c WHERE c\."tenantId" = t\.id AND c\."estRetenu" = false\)/);
    expect(sql).toMatch(/SET "estRetenu" = false/);
    expect(sql).toMatch(/c\."typeCompte" = 'DETAIL'/);
    expect(sql).toMatch(/s\.referentiel = i\.referentiel/);
  });
});

describe('les liens qui ne personnalisent pas', () => {
  it('chaque lien exclu de l’usage est une relation réelle vers Compte · un nom faux ne retirerait rien, en silence', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Prisma } = require('@prisma/client') as typeof import('@prisma/client');
    const reels = new Set<string>();
    for (const m of Prisma.dmmf.datamodel.models) {
      for (const f of m.fields) {
        if (f.kind === 'object' && f.type === 'Compte' && (f.relationFromFields ?? []).length === 1) reels.add(`${m.name}.${f.relationFromFields![0]}`);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LIENS_QUI_NE_RETIENNENT_PAS } = require('./comptes-proposes') as { LIENS_QUI_NE_RETIENNENT_PAS: string[] };
    expect(LIENS_QUI_NE_RETIENNENT_PAS.filter((l) => !reels.has(l))).toEqual([]);
    // Les liens qui composent des écritures ou que le module redresse RETIENNENT.
    for (const l of ['LigneEcriture.compteId', 'Journal.compteTresorerieId', 'TiersCompte.compteId', 'EcartInventaire.compteId']) {
      expect(LIENS_QUI_NE_RETIENNENT_PAS).not.toContain(l);
    }
  });
});
