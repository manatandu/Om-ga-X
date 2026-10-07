import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { MODELES_AUDITES } from '../../common/audit/champs-audites';
import { MODELES_CLOISONNES } from '../../common/cloisonnement/modeles-cloisonnes';
import { ImputationsPaiementsService } from './imputations-paiements.service';
import { TauxTvaService } from './taux-tva.service';

/**
 * L'IMPUTATION DÉCLARÉE D'UN PAIEMENT SE SAISIT AVEC SA PIÈCE, AU JOURNAL
 * D'AUDIT (décision par la loi du 2026-10-07, point 4 ; Code civil, Livre III,
 * art. 151 et 153). Jeu · paiement R de 700 000 au crédit du client, le
 * 15 février, factures A (600 000, 10 janvier) et B (600 000, 20 janvier) au
 * débit, validées, lettrées dans le groupe G.
 *
 * LA DOUBLURE HONORE LA REQUÊTE · les lignes par identifiant ou par groupe,
 * les déclarations par paiement (un seul ou une liste), actives seulement.
 */
type Ligne = {
  id: string;
  compteId: string;
  debit: number;
  credit: number;
  lettrageId: string | null;
  numero: string;
  statut: string;
  date: string;
  piece: number;
  exercice: string;
};
const ligne = (id: string, debit: number, credit: number, date: string, piece: number, autre: Partial<Ligne> = {}): Ligne => ({
  id,
  compteId: 'c411',
  debit,
  credit,
  lettrageId: 'G',
  numero: '41110101',
  statut: 'VALIDEE',
  date,
  piece,
  exercice: 'OUVERT',
  ...autre,
});
type Active = { id: string; ligneReglementId: string; ligneFactureId: string; montant: number; retiree?: boolean };

function doublure(lignes: Ligne[], actives: Active[] = [], liquidation: { dateDebut: Date; dateFin: Date } | null = null) {
  const crees: unknown[] = [];
  const misesAJour: unknown[] = [];
  const executes: string[] = [];
  const enEcriture = (l: Ligne) => ({
    id: `e-${l.id}`,
    date: new Date(`${l.date}T00:00:00.000Z`),
    libelle: `Pièce ${l.piece}`,
    numeroPiece: l.piece,
    statut: l.statut,
    exercice: { statut: l.exercice },
  });
  const actif = (a: Active) => !a.retiree;
  const base = {
    ligneEcriture: {
      findFirst: jest.fn(({ where }: { where: { id: string; ecriture: { tenantId: string } } }) => {
        const l = where.ecriture.tenantId === 't1' ? lignes.find((x) => x.id === where.id) : undefined;
        return Promise.resolve(l ? { id: l.id, lettrageId: l.lettrageId, compte: { numero: l.numero, intitule: 'Client' }, lettrage: { statut: 'PARTIEL' } } : null);
      }),
      findMany: jest.fn(({ where }: { where: { id?: { in: string[] }; lettrageId?: string; ecriture: { tenantId: string } } }) => {
        if (where.ecriture.tenantId !== 't1') return Promise.resolve([]);
        const lues = where.id ? lignes.filter((l) => where.id!.in.includes(l.id)) : lignes.filter((l) => l.lettrageId === where.lettrageId);
        return Promise.resolve(
          lues.map((l) => ({ ...l, dateEcheance: null, libelle: null, compte: { numero: l.numero }, ecriture: enEcriture(l) })),
        );
      }),
    },
    imputationPaiement: {
      count: jest.fn(({ where }: { where: { ligneReglementId: string } }) =>
        Promise.resolve(actives.filter((a) => actif(a) && a.ligneReglementId === where.ligneReglementId).length),
      ),
      findMany: jest.fn(({ where }: { where: { ligneReglementId: string | { in: string[] } } }) => {
        const vise = (id: string) => (typeof where.ligneReglementId === 'string' ? where.ligneReglementId === id : where.ligneReglementId.in.includes(id));
        return Promise.resolve(actives.filter((a) => actif(a) && vise(a.ligneReglementId)).map((a) => ({ ...a })));
      }),
      create: jest.fn(({ data }: { data: { montant: number } }) => {
        crees.push(data);
        return Promise.resolve({ id: `i${crees.length}`, ...data });
      }),
      update: jest.fn((args: unknown) => {
        misesAJour.push(args);
        return Promise.resolve(args);
      }),
    },
    liquidationTva: {
      findFirst: jest.fn(({ where }: { where: { dateDebut: { lte: Date }; dateFin: { gte: Date } } }) =>
        Promise.resolve(
          liquidation && liquidation.dateDebut <= where.dateDebut.lte && liquidation.dateFin >= where.dateFin.gte ? liquidation : null,
        ),
      ),
    },
    $executeRaw: jest.fn((gabarit: TemplateStringsArray, ...valeurs: unknown[]) => {
      executes.push(String(valeurs[0]));
      return Promise.resolve(1);
    }),
  };
  const prisma = { ...base, $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)) };
  const tva = {
    declaration: jest.fn().mockResolvedValue({ totalCollecte: 0, totalDeductible: 0 }),
    // Sans report, le groupe rendu tel quel (le cas d'un report se joue à part).
    traduireLesReports: jest.fn((_t: string, g: unknown) => Promise.resolve(g)),
  };
  const s = new ImputationsPaiementsService(prisma as unknown as PrismaService, tva as unknown as TauxTvaService);
  return { s, prisma, tva, crees, misesAJour, executes };
}

const R = ligne('R', 0, 700_000, '2026-02-15', 31);
const A = ligne('A', 600_000, 0, '2026-01-10', 10);
const B = ligne('B', 600_000, 0, '2026-01-20', 11);
const dto = (factures: Array<{ ligneFactureId: string; montant: number }>, autre: Record<string, unknown> = {}) => ({
  ligneReglementId: 'R',
  fondement: 'DECLARATION_DU_DEBITEUR' as const,
  pieceReference: ' OV 2026-031 ',
  pieceDate: '2026-02-15',
  factures,
  ...autre,
});

describe('ImputationsPaiementsService · déclarer', () => {
  it('une ligne par facture, par un create unitaire, sous les verrous du paiement, des factures et du groupe, pièce datée gardée', async () => {
    const d = doublure([R, A, B]);
    const res = await d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'B', montant: 600_000 }, { ligneFactureId: 'A', montant: 100_000 }]));
    expect(res.imputations.map((x) => x.montant)).toEqual([600_000, 100_000]);
    expect(res.liquidation).toBeNull();
    expect(d.crees).toEqual([
      expect.objectContaining({ tenantId: 't1', ligneReglementId: 'R', ligneFactureId: 'B', montant: 600_000, pieceReference: 'OV 2026-031', createdBy: 'u1', preuveAcceptation: null }),
      expect.objectContaining({ ligneFactureId: 'A', montant: 100_000, fondement: 'DECLARATION_DU_DEBITEUR' }),
    ]);
    expect((d.crees[0] as { pieceDate: Date }).pieceDate.toISOString().slice(0, 10)).toBe('2026-02-15');
    // Les verrous sont pris DANS la transaction, dans un ordre fixe (trié).
    expect(d.executes).toEqual([
      'imputation-paiement:t1:facture:A',
      'imputation-paiement:t1:facture:B',
      'imputation-paiement:t1:groupe:G',
      'imputation-paiement:t1:paiement:R',
    ]);
    expect(d.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('un refus nommé en 400, rien n’est écrit · part au-delà du reste de la facture', async () => {
    const d = doublure([R, A, B]);
    await expect(d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'A', montant: 600_001 }]))).rejects.toThrow(BadRequestException);
    expect(d.crees).toEqual([]);
  });

  it('M3 · une déclaration du débiteur datée APRÈS le paiement est refusée (art. 151, « lorsqu’il paye »)', async () => {
    const d = doublure([R, A, B]);
    await expect(d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'A', montant: 1 }], { pieceDate: '2026-02-16' }))).rejects.toThrow(
      'La pièce du 16/02/2026 est postérieure au paiement du 15/02/2026',
    );
  });

  it('M3 · la quittance acceptée exige la preuve de l’acceptation, et la garde', async () => {
    const d = doublure([R, A, B]);
    const q = { fondement: 'QUITTANCE_ACCEPTEE' as const, pieceDate: '2026-02-20' };
    await expect(d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'A', montant: 1 }], q))).rejects.toThrow('La preuve de l’acceptation est exigée');
    await d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'A', montant: 1 }], { ...q, preuveAcceptation: ' Contreseing du client ' }));
    expect(d.crees).toEqual([expect.objectContaining({ fondement: 'QUITTANCE_ACCEPTEE', preuveAcceptation: 'Contreseing du client' })]);
  });

  it('les déclarations actives d’un autre paiement DU GROUPE sont déduites, et ce paiement est nommé', async () => {
    const R0 = ligne('R0', 0, 550_000, '2026-02-10', 12);
    const d = doublure([R0, R, A, B], [{ id: 'x', ligneReglementId: 'R0', ligneFactureId: 'A', montant: 550_000 }]);
    await expect(d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'A', montant: 100_000 }]))).rejects.toThrow(
      'après 550000.00 déjà imputés ou déclarés sur d’autres paiements (pièce 12 du 10/02/2026)',
    );
  });

  it('M4 · la déclaration d’un paiement SORTI du groupe ne retient plus rien', async () => {
    const R0 = ligne('R0', 0, 550_000, '2026-02-10', 12, { lettrageId: 'H' });
    const d = doublure([R0, R, A, B], [{ id: 'x', ligneReglementId: 'R0', ligneFactureId: 'A', montant: 550_000 }]);
    await d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'A', montant: 100_000 }]));
    expect(d.crees).toHaveLength(1);
  });

  it('un paiement ANTÉRIEUR sans déclaration a déjà payé par l’art. 154 · la plus ancienne (A) d’abord', async () => {
    const R0 = ligne('R0', 0, 650_000, '2026-02-10', 12);
    const d = doublure([R0, R, A, B]);
    await expect(d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'A', montant: 1 }]))).rejects.toThrow(
      'dépasse ce qui reste de la facture (0.00, après 600000.00 déjà imputés ou déclarés sur d’autres paiements (pièce 12 du 10/02/2026))',
    );
    // B a reçu 50 000 de R0 · il en reste 550 000.
    await d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'B', montant: 550_000 }]));
    expect(d.crees).toHaveLength(1);
  });

  it('une ligne d’un autre dossier est introuvable', async () => {
    const d = doublure([R, A, B]);
    await expect(d.s.declarer('t2', 'u1', dto([{ ligneFactureId: 'A', montant: 1 }]))).rejects.toThrow('introuvable');
  });

  it('une déclaration concurrente passée entre la vérification et les verrous · 409, rien n’est écrit', async () => {
    const d = doublure([R, A, B]);
    d.prisma.imputationPaiement.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await expect(d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'A', montant: 1 }]))).rejects.toThrow(ConflictException);
    expect(d.crees).toEqual([]);
  });

  it('M3 · un paiement d’une période LIQUIDÉE · le geste dit la taxe portée au premier jour non liquidé, lue avant et après', async () => {
    const d = doublure([R, A, B], [], { dateDebut: new Date('2026-02-01T00:00:00.000Z'), dateFin: new Date('2026-02-28T00:00:00.000Z') });
    d.tva.declaration.mockResolvedValueOnce({ totalCollecte: 10_000, totalDeductible: 0 }).mockResolvedValueOnce({ totalCollecte: 26_000, totalDeductible: 0 });
    const res = await d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'B', montant: 600_000 }]));
    expect(res.liquidation).toEqual(
      expect.objectContaining({ du: '2026-02-01', au: '2026-02-28', premierJourLibre: '2026-03-01', collecte: 16_000, deductible: 0 }),
    );
    expect(res.liquidation!.message).toContain('portée au premier jour non liquidé, le 01/03/2026 · collecte +16000.00 CDF');
    // Le moteur est lu sur ce SEUL jour.
    expect(d.tva.declaration).toHaveBeenCalledWith('t1', new Date('2026-03-01T00:00:00.000Z'), new Date('2026-03-01T23:59:59.999Z'));
  });

  it('M3 · le montant non calculé se dit, jamais un zéro, et le geste n’est pas défait', async () => {
    const d = doublure([R, A, B], [], { dateDebut: new Date('2026-02-01T00:00:00.000Z'), dateFin: new Date('2026-02-28T00:00:00.000Z') });
    d.tva.declaration.mockRejectedValue(new Error('lecture impossible'));
    const res = await d.s.declarer('t1', 'u1', dto([{ ligneFactureId: 'B', montant: 600_000 }]));
    expect(d.crees).toHaveLength(1);
    expect(res.liquidation).toEqual(expect.objectContaining({ collecte: null, deductible: null }));
    expect(res.liquidation!.message).toContain('montant non calculé (lecture impossible)');
  });
});

describe('ImputationsPaiementsService · retirer', () => {
  it('chaque part active, relue sous le verrou, se marque par un update UNITAIRE qui porte le motif, jamais supprimée', async () => {
    const d = doublure([R, A, B], [
      { id: 'i1', ligneReglementId: 'R', ligneFactureId: 'B', montant: 600_000 },
      { id: 'i2', ligneReglementId: 'R', ligneFactureId: 'A', montant: 100_000 },
    ]);
    expect(await d.s.retirer('t1', 'u2', 'R', { motif: ' Ordre de virement mal lu ' })).toEqual({ retirees: 2, liquidation: null });
    expect(d.misesAJour).toEqual([
      { where: { id: 'i1' }, data: expect.objectContaining({ retireePar: 'u2', motifRetrait: 'Ordre de virement mal lu' }) },
      { where: { id: 'i2' }, data: expect.objectContaining({ retireePar: 'u2', motifRetrait: 'Ordre de virement mal lu' }) },
    ]);
    expect(d.executes).toEqual(['imputation-paiement:t1:facture:A', 'imputation-paiement:t1:facture:B', 'imputation-paiement:t1:paiement:R']);
  });

  it('M3 · un paiement d’un exercice CLÔTURÉ · retrait refusé, rien n’est touché', async () => {
    const d = doublure([{ ...R, exercice: 'CLOTURE' }, A, B], [{ id: 'i1', ligneReglementId: 'R', ligneFactureId: 'B', montant: 600_000 }]);
    await expect(d.s.retirer('t1', 'u2', 'R', { motif: 'erreur' })).rejects.toThrow('exercice clôturé');
    expect(d.misesAJour).toEqual([]);
  });

  it('M4 · retirée entre la lecture et le verrou · 409, rien n’est touché', async () => {
    const actives: Active[] = [{ id: 'i1', ligneReglementId: 'R', ligneFactureId: 'B', montant: 600_000 }];
    const d = doublure([R, A, B], actives);
    d.prisma.$executeRaw.mockImplementationOnce(() => {
      actives[0].retiree = true;
      return Promise.resolve(1);
    });
    await expect(d.s.retirer('t1', 'u2', 'R', { motif: 'erreur' })).rejects.toThrow(ConflictException);
    expect(d.misesAJour).toEqual([]);
  });

  it('rien à retirer · 404 nommé', async () => {
    const d = doublure([R, A, B]);
    await expect(d.s.retirer('t1', 'u2', 'R', { motif: 'erreur' })).rejects.toThrow(NotFoundException);
  });
});

describe('ImputationsPaiementsService · le groupe, lu tel que le moteur le retient (mineur)', () => {
  it('un report d’à-nouveau se lit par la facture qu’il reporte · sa date, et la ligne à désigner reste le report', async () => {
    const AN = ligne('AN', 600_000, 0, '2026-01-01', 1);
    const d = doublure([R, AN, B], [{ id: 'i1', ligneReglementId: 'R', ligneFactureId: 'AN', montant: 600_000 }]);
    const origine = { ...AN, id: 'O', lettrageId: null, dateEcheance: null, libelle: null, ecriture: { id: 'e-O', date: new Date('2025-11-10T00:00:00.000Z'), libelle: 'Facture F7', numeroPiece: 7, statut: 'VALIDEE' } };
    d.tva.traduireLesReports.mockImplementationOnce((_t: string, g: { lignes: Array<{ id: string }> }) =>
      Promise.resolve({ ...g, lignes: g.lignes.map((x) => (x.id === 'AN' ? origine : x)), reportsVers: new Map([['AN', 'O']]) }),
    );
    const g = await d.s.groupe('t1', 'R');
    const factures = g.factures as unknown as Array<{ id: string; imputations: unknown }>;
    const f7 = factures.find((f) => f.id === 'O')!;
    expect(f7).toEqual(expect.objectContaining({ ligneADesigner: 'AN', reportee: true, date: '2025-11-10', libelle: 'Facture F7' }));
    // La déclaration posée sur le report vise la facture qu'il reporte (B2).
    expect(f7.imputations).toEqual([{ paiementId: 'R', date: '2026-02-15', montant: 600_000, fondement: 'DECLAREE' }]);
    expect(factures.find((f) => f.id === 'B')).toEqual(expect.objectContaining({ ligneADesigner: 'B', reportee: false }));
  });

  it('un compte ni client ni fournisseur n’est pas servi, et le dit', async () => {
    const d = doublure([{ ...R, numero: '47100000' }]);
    expect(await d.s.groupe('t1', 'R')).toEqual(expect.objectContaining({ nonServi: expect.stringContaining('ni un compte client (41) ni un compte fournisseur (40)') }));
  });
});

describe('ImputationPaiement · au journal d’audit et cloisonnée', () => {
  it('le modèle est audité et cloisonné', () => {
    expect(MODELES_AUDITES.has('ImputationPaiement')).toBe(true);
    expect(MODELES_CLOISONNES.has('ImputationPaiement')).toBe(true);
  });
});

/**
 * SECOND TOUR (relecture du 2026-10-07, B-1, B-2, M-a, M-b) · LA PORTE ET LA
 * FENÊTRE LISENT LE GROUPE COMME LE MOTEUR, par le VRAI service de la TVA.
 * La doublure tient une seule base de lignes (N et N+1) et honore chaque
 * lecture par sa forme · lignes par identifiant ou par groupe, pièce
 * d'origine d'un report (hors à-nouveaux, antérieure, mêmes montants),
 * reports d'une pièce (à-nouveaux, postérieurs, mêmes montants), à-nouveau
 * postérieur, déclarations actives.
 */
type EnBase = {
  id: string;
  debit: number;
  credit: number;
  lettrageId: string | null;
  date: string;
  piece: number;
  libelle: string;
  /** Report d'à-nouveau · son libellé recopie celui de la pièce d'origine. */
  report?: boolean;
  exercice?: string;
  avoir?: boolean;
};
const enBase = (id: string, debit: number, credit: number, date: string, piece: number, libelle: string, lettrageId: string | null, autre: Partial<EnBase> = {}): EnBase => ({
  id,
  debit,
  credit,
  lettrageId,
  date,
  piece,
  libelle,
  ...autre,
});
const reportDe = (id: string, o: EnBase, lettrageId: string | null): EnBase => ({
  ...o,
  id,
  date: '2027-01-01',
  piece: 1,
  libelle: `RAN détail 41110101 · ${o.libelle}`,
  lettrageId,
  report: true,
  exercice: 'OUVERT',
});
function porte(base: EnBase[], actives: Active[] = []) {
  const crees: unknown[] = [];
  const lue = (l: EnBase) => ({
    id: l.id,
    compteId: 'c411',
    debit: l.debit,
    credit: l.credit,
    lettrageId: l.lettrageId,
    dateEcheance: null,
    deviseId: null,
    montantDevise: null,
    libelle: l.report ? l.libelle : null,
    compte: { numero: '41110101', intitule: 'Client' },
    lettrage: { statut: 'PARTIEL' },
    ecriture: {
      id: `e-${l.id}`,
      date: new Date(`${l.date}T00:00:00.000Z`),
      libelle: l.report ? 'À-nouveau' : l.libelle,
      numeroPiece: l.piece,
      statut: 'VALIDEE',
      createdAt: new Date(`${l.date}T00:00:00.000Z`),
      estGenereeParCloture: !!l.report,
      estANouveauProvisoire: false,
      corrigeEcritureId: null,
      _count: { lignes: l.avoir ? 1 : 0 },
      exercice: { statut: l.exercice ?? 'OUVERT' },
    },
  });
  const lues = base.map(lue);
  type Ou = {
    id?: string | { in: string[] };
    lettrageId?: string;
    compteId?: string;
    ecriture?: { tenantId?: string; NOT?: unknown; date?: { lt?: Date; gt?: Date } };
    OR?: Array<{ debit: number; credit: number }>;
  };
  const memesMontants = (where: Ou, l: ReturnType<typeof lue>) => !where.OR || where.OR.some((m) => m.debit === l.debit && m.credit === l.credit);
  const actif = (a: Active) => !a.retiree;
  const prisma = {
    ligneEcriture: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(lues.find((l) => l.id === where.id) ?? null)),
      findMany: jest.fn(({ where }: { where: Ou }) => {
        if (where.ecriture?.tenantId !== 't1') return Promise.resolve([]);
        if (typeof where.id === 'object') return Promise.resolve(lues.filter((l) => (where.id as { in: string[] }).in.includes(l.id)));
        if (where.lettrageId) return Promise.resolve(lues.filter((l) => l.lettrageId === where.lettrageId));
        if (where.compteId && where.ecriture?.NOT) {
          return Promise.resolve(lues.filter((l) => !l.ecriture.estGenereeParCloture && l.ecriture.date < where.ecriture!.date!.lt! && memesMontants(where, l)));
        }
        if (where.compteId) {
          return Promise.resolve(lues.filter((l) => l.ecriture.estGenereeParCloture && l.ecriture.date > where.ecriture!.date!.gt! && memesMontants(where, l)));
        }
        return Promise.resolve([]);
      }),
    },
    ecriture: {
      findFirst: jest.fn(({ where }: { where: { date?: { gt?: Date } } }) =>
        Promise.resolve(lues.some((l) => l.ecriture.estGenereeParCloture && (!where.date?.gt || l.ecriture.date > where.date.gt)) ? { id: 'an' } : null),
      ),
    },
    imputationPaiement: {
      count: jest.fn(({ where }: { where: { ligneReglementId: string } }) =>
        Promise.resolve(actives.filter((a) => actif(a) && a.ligneReglementId === where.ligneReglementId).length),
      ),
      findMany: jest.fn(({ where }: { where: { ligneReglementId: string | { in: string[] } } }) => {
        const vise = (id: string) => (typeof where.ligneReglementId === 'string' ? where.ligneReglementId === id : where.ligneReglementId.in.includes(id));
        return Promise.resolve(actives.filter((a) => actif(a) && vise(a.ligneReglementId)).map((a) => ({ ...a })));
      }),
      create: jest.fn(({ data }: { data: unknown }) => {
        crees.push(data);
        return Promise.resolve({ id: `i${crees.length}`, ...(data as object) });
      }),
    },
    liquidationTva: { findFirst: jest.fn().mockResolvedValue(null) },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const client = { ...prisma, $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)) };
  const tva = new TauxTvaService(client as unknown as PrismaService, {} as never);
  return { s: new ImputationsPaiementsService(client as unknown as PrismaService, tva), crees };
}
/** Le groupe servi à l'écran, lu comme l'écran le lit. */
type GroupeServi = {
  nonServi?: string;
  factures: Array<{ id: string; ligneADesigner: string | null; reportee: boolean; imputations: unknown }>;
  paiements: Array<{ id: string; designable: boolean; motifNonDesignable?: string }>;
};
const declarer = (ligneReglementId: string, factures: Array<{ ligneFactureId: string; montant: number }>, pieceDate: string) => ({
  ligneReglementId,
  fondement: 'DECLARATION_DU_DEBITEUR' as const,
  pieceReference: 'Lettre du client',
  pieceDate,
  factures,
});

describe('SECOND TOUR B-2 · la porte lit le groupe sur les factures que les reports portent', () => {
  /*
    S (5 décembre 2026, 1 160 000) et X (10 décembre, 1 000 000), impayées et
    lettrées avec rien dans N (clôturé) ; leurs reports anS et anX au
    1er janvier 2027, lettrés avec P1 (600 000, 15 janvier) et P2 (1 000 000,
    15 février). Le moteur · P1 paie S, la plus ancienne (art. 154) · X garde
    1 000 000. Le client déclare que P2 paie X en entier · ADMISE. La porte
    lisait les reports, nés le même jour, au prorata · « 722 222,22 après
    277 777,78 » et refusait.
  */
  const S = enBase('S', 1_160_000, 0, '2026-12-05', 10, 'Facture S', null, { exercice: 'CLOTURE' });
  const X = enBase('X', 1_000_000, 0, '2026-12-10', 11, 'Facture X', null, { exercice: 'CLOTURE' });
  const anS = reportDe('anS', S, 'G');
  const anX = reportDe('anX', X, 'G');
  const P1 = enBase('P1', 0, 600_000, '2027-01-15', 40, 'Paiement P1', 'G');
  const P2 = enBase('P2', 0, 1_000_000, '2027-02-15', 41, 'Paiement P2', 'G');

  it('P2 déclaré sur le report de X pour 1 000 000 · admise, une part écrite', async () => {
    const { s, crees } = porte([S, X, anS, anX, P1, P2]);
    await s.declarer('t1', 'u1', declarer('P2', [{ ligneFactureId: 'anX', montant: 1_000_000 }], '2027-02-15'));
    expect(crees).toEqual([expect.objectContaining({ ligneReglementId: 'P2', ligneFactureId: 'anX', montant: 1_000_000 })]);
  });

  it('P1 déjà déclaré sur X (600 000) · la part de P2 sur X est bornée à 400 000, P1 nommé', async () => {
    const { s, crees } = porte([S, X, anS, anX, P1, P2], [{ id: 'i0', ligneReglementId: 'P1', ligneFactureId: 'anX', montant: 600_000 }]);
    await expect(s.declarer('t1', 'u1', declarer('P2', [{ ligneFactureId: 'anX', montant: 1_000_000 }], '2027-02-15'))).rejects.toThrow(
      'dépasse ce qui reste de la facture (400000.00, après 600000.00 déjà imputés ou déclarés sur d’autres paiements (pièce 40 du 15/01/2027))',
    );
    expect(crees).toEqual([]);
  });
});

describe('SECOND TOUR B-1, M-a, M-b · ce que la porte refuse, et la fenêtre le dit', () => {
  /*
    F1 (5 décembre 2026, 1 160 000) et P0 (400 000, 20 décembre) lettrés dans
    G1, exercice 2026 clôturé ; leurs reports rF1 et rP0 lettrés en 2027 avec
    F2 (580 000, 10 janvier) et P (500 000, 15 février) dans G2.
  */
  const F1 = enBase('F1', 1_160_000, 0, '2026-12-05', 10, 'Facture F1', 'G1', { exercice: 'CLOTURE' });
  const P0 = enBase('P0', 0, 400_000, '2026-12-20', 20, 'Paiement P0', 'G1', { exercice: 'CLOTURE' });
  const rF1 = reportDe('rF1', F1, 'G2');
  const rP0 = reportDe('rP0', P0, 'G2');
  const F2 = enBase('F2', 580_000, 0, '2027-01-10', 30, 'Facture F2', 'G2');
  const P = enBase('P', 0, 500_000, '2027-02-15', 31, 'Paiement P', 'G2');
  const base = [F1, P0, rF1, rP0, F2, P];

  it('B-1 · une déclaration posée sur le REPORT d’un paiement est refusée, le paiement d’origine nommé (art. 151)', async () => {
    const { s, crees } = porte(base);
    await expect(s.declarer('t1', 'u1', declarer('rP0', [{ ligneFactureId: 'F2', montant: 400_000 }], '2027-01-01'))).rejects.toThrow(
      'report à nouveau d’un paiement d’un exercice précédent (pièce 20 du 20/12/2026)',
    );
    expect(crees).toEqual([]);
  });

  it('M-a · un paiement d’un exercice clôturé ne se déclare pas, par le motif du retrait', async () => {
    const { s } = porte(base);
    await expect(s.declarer('t1', 'u1', declarer('P0', [{ ligneFactureId: 'F1', montant: 400_000 }], '2026-12-20'))).rejects.toThrow(
      'appartient à un exercice clôturé · son imputation ne se déclare ni ne se retire plus',
    );
  });

  it('la fenêtre · le report de P0 n’est pas un paiement du groupe, F1 se désigne par son report et reçoit P0 puis P', async () => {
    const { s } = porte(base);
    const g = (await s.groupe('t1', 'P')) as unknown as GroupeServi;
    expect(g.nonServi).toBeUndefined();
    expect(g.paiements.map((p) => [p.id, p.designable])).toEqual([
      ['P0', false],
      ['P', true],
    ]);
    const p0 = g.paiements.find((p) => p.id === 'P0')!;
    expect(p0.motifNonDesignable).toContain('autre groupe de lettrage');
    const f1 = g.factures.find((f) => f.id === 'F1')!;
    expect(f1).toEqual(expect.objectContaining({ ligneADesigner: 'rF1', reportee: true }));
    expect(f1.imputations).toEqual([
      { paiementId: 'P0', date: '2026-12-20', montant: 400_000, fondement: 'LEGALE' },
      { paiementId: 'P', date: '2027-02-15', montant: 500_000, fondement: 'LEGALE' },
    ]);
  });

  it('M-b · un groupe qui porte un avoir · la porte refuse, la fenêtre le dit, par le même motif', async () => {
    const A = enBase('A', 1_160_000, 0, '2027-01-05', 50, 'Facture A', 'GA');
    const B = enBase('B', 580_000, 0, '2027-01-10', 51, 'Facture B', 'GA');
    const AV = enBase('AV', 0, 116_000, '2027-01-20', 52, 'Avoir', 'GA', { avoir: true });
    const R = enBase('R', 0, 500_000, '2027-02-15', 53, 'Paiement R', 'GA');
    const { s, crees } = porte([A, B, AV, R]);
    await expect(s.declarer('t1', 'u1', declarer('R', [{ ligneFactureId: 'B', montant: 500_000 }], '2027-02-15'))).rejects.toThrow(
      'Le moteur de la TVA lit ce groupe en bloc (un avoir dans le groupe)',
    );
    expect(crees).toEqual([]);
    expect(((await s.groupe('t1', 'R')) as unknown as GroupeServi).nonServi).toContain('Le moteur de la TVA lit ce groupe en bloc (un avoir dans le groupe)');
  });
});
